import * as THREE from 'three';

/**
 * ProjectileManager.js
 * 
 * Gestiona el ciclo de vida y las colisiones de los dardos (Tlacochtli)
 * lanzados por el Atlatl del jugador hacia los enemigos.
 */
export default class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = []; // { mesh, dirX, dirZ, speed, age, isDead }
        this.maxAge = 3.0; // Segundos antes de desaparecer
        this.cachedEnemiesList = [];
    }

    executeMacuahuitlSweep(x, y, z, sweepRadius) {
        if (!this.cachedEnemiesList) return;
        
        let hitSomebody = false;
        for (let j = 0; j < this.cachedEnemiesList.length; j++) {
            const foe = this.cachedEnemiesList[j];
            if (foe.isDead) continue;

            const dx = foe.position.x - x;
            const dz = foe.position.z - z;
            const dist = Math.hypot(dx, dz);

            // Radio de barrido — ampliado a 7m si la Espada de Obsidiana fue desbloqueada
            const effectiveRadius = (window._obsidianSwordActive) ? 7.0 : sweepRadius;

            if (dist < effectiveRadius && Math.abs(foe.position.y - y) < 4.0) {
                foe.isDead = true;
                hitSomebody = true;
                
                // Notificar a la IA RE4 del mismo enemigo
                this._syncEnemyInstanceDeath(foe);

                // Efecto de Partículas Mesoamericanas
                const sparkColor = window._obsidianSwordActive ? 0xaa00ff : undefined;
                if (window.vfxManager) {
                    window.vfxManager.emitSparks(foe.position.x, foe.position.y + 1, foe.position.z, 30);
                }

                // Puntuación
                if (window.scoreSystem) window.scoreSystem.addKill();
            }
        }
        
        if (hitSomebody && window.audioManager) {
            window.audioManager.playThudSynthesized();
        }
    }

    /**
     * Sincroniza la muerte de un foe legacy con la instancia Enemy RE4.
     * Evita que tengamos dos sistemas de IA corriendo sin comunicarse.
     */
    _syncEnemyInstanceDeath(foe) {
        if (!window.enemyInstances) return;
        for (const ei of window.enemyInstances) {
            if (!ei.active) continue;
            const dx = ei.position.x - foe.position.x;
            const dz = ei.position.z - foe.position.z;
            if (Math.hypot(dx, dz) < 2.0) {
                ei.takeDamage(99); // Instakill en el sistema RE4
                break;
            }
        }
    }

    /**
     * @param {number} x Origen
     * @param {number} y Origen
     * @param {number} z Origen
     * @param {number} dirX Dirección Normalizada X
     * @param {number} dirZ Dirección Normalizada Z
     */
    throwDart(x, y, z, dirX, dirZ) {
        // Geometría del Dardo (Palo delgado de madera con punta de obsidiana simulada)
        const geo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x5c4033, 
            roughness: 0.9, 
            metalness: 0.1 
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        // Orientar el cilindro (por defecto apunta arriba en Y) para que apunte hacia dirX/dirZ
        mesh.position.set(x, y, z);
        
        const axis = new THREE.Vector3(0, 1, 0);
        const targetDir = new THREE.Vector3(dirX, 0, dirZ).normalize();
        mesh.quaternion.setFromUnitVectors(axis, targetDir);
        // Además, rotarlo 90° para que quede "acostado" volando hacia adelante
        mesh.rotateX(Math.PI / 2);
        
        mesh.castShadow = true;
        this.scene.add(mesh);

        this.projectiles.push({
            mesh: mesh,
            dirX: targetDir.x,
            dirZ: targetDir.z,
            speed: 35.0, // Muy rápido
            age: 0,
            isDead: false
        });

        // Feedback Sonoro
        if (window.audioManager) {
            window.audioManager.playJumpSynthesized(); // Sonido provisional tipo "swoosh"
        }
    }

    update(dt, enemiesList, enemiesNodes) {
        this.cachedEnemiesList = enemiesList; // Se actualiza cada frame para referencia de ataques Asíncronos

        // Movimiento de Dardos Activos
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (p.isDead) continue;

            p.age += dt;
            if (p.age > this.maxAge) {
                p.isDead = true;
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
                continue;
            }

            // Integración Cinemática
            p.mesh.position.x += p.dirX * p.speed * dt;
            p.mesh.position.z += p.dirZ * p.speed * dt;

            // Colisiones con Enemigos
            let hit = false;
            if (enemiesList && enemiesNodes) {
                for (let j = 0; j < enemiesList.length; j++) {
                    const foe = enemiesList[j];
                    if (foe.isDead) continue;

                    const dx = p.mesh.position.x - foe.position.x;
                    const dy = p.mesh.position.y - foe.position.y;
                    const dz = p.mesh.position.z - foe.position.z;
                    const dist = Math.hypot(dx, dy, dz);

                    // Radio de hit aproximado de un enemigo genérico (1.5)
                    if (dist < 2.0) {
                        foe.isDead = true; // Instakill Atlatl
                        hit = true;

                        // Notificar a la IA RE4 del mismo enemigo
                        this._syncEnemyInstanceDeath(foe);
                        
                        // Puntuación
                        if (window.scoreSystem) window.scoreSystem.addKill();
                        
                        // Partículas de Obsidiana destructiva
                        if (window.vfxManager) {
                            window.vfxManager.emitSparks(foe.position.x, foe.position.y, foe.position.z, 20);
                        }
                        if (window.audioManager) window.audioManager.playThudSynthesized();
                        break;
                    }
                }
            }

            if (hit) {
                p.isDead = true;
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }
}
