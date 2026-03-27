import * as THREE from 'three';
import { playLandSound } from './audio.js';
import { spatialGrid } from './spatialHash.js';
import MaterialManager from './materialManager.js';

// --- Pool Circular de Proyectiles (32 slots FIFO) ---
// Inspirado en el sistema de balas de RE4: sin malloc, sin GC, sin Array.splice.
// Cada slot tiene un puntero directo al Mesh y su estado de vida.
const POOL_SIZE = 32;

class ProjectilePool {
    constructor(scene, sphereGeo, matSun, matMoon) {
        // Arreglo plano de punteros a Meshes (index = slot ID)
        this.meshes = new Array(POOL_SIZE);
        // Float32Array para vida restante — localidad de caché máxima
        this.life   = new Float32Array(POOL_SIZE);
        // Stats dinámicos por proyectil (heredados al disparar)
        this.damage = new Float32Array(POOL_SIZE);
        this.radius = new Float32Array(POOL_SIZE);
        // Int8Array para tipo: 0 = Sol, 1 = Luna, -1 = inactivo
        this.types  = new Int8Array(POOL_SIZE).fill(-1);
        // Velocidades planas [vx0,vy0,vz0, vx1,vy1,vz1 ...] 
        this.vel    = new Float32Array(POOL_SIZE * 3);
        // Puntero HEAD circular
        this.head   = 0;
        // Contador de slots activos
        this.active = 0;

        // Pre-instanciar todos los meshes, ocultos por defecto
        for (let i = 0; i < POOL_SIZE; i++) {
            const mat = (i % 2 === 0) ? matSun.clone() : matMoon.clone();
            const mesh = new THREE.Mesh(sphereGeo, mat);
            mesh.visible = false;
            mesh.userData.isVFX = true;
            scene.add(mesh);
            this.meshes[i] = mesh;
        }
    }

    /**
     * Solicita el siguiente slot circular. Si está lleno, recicla el más viejo.
     * O(1) garantizado.
     */
    fire(origin, direction, type, pLight) {
        // Leer stats dinamicos del sistema de upgrades
        const stats = window.weaponUpgradeSystem ? window.weaponUpgradeSystem.getStats() : { damage: 1.0, blastRadius: 1.8, projectileLife: 3.0 };

        const slot = this.head;
        this.head  = (this.head + 1) % POOL_SIZE; // Avanza puntero circular
        if (this.active < POOL_SIZE) this.active++;

        const mesh = this.meshes[slot];
        // Reposicionar y activar
        mesh.position.copy(origin).addScaledVector(direction, 1.5);
        mesh.position.y += 1.2;
        mesh.visible = true;

        this.life[slot]       = stats.projectileLife;   // Alcance escalable
        this.damage[slot]     = stats.damage;           // Daño base del proyectil
        this.radius[slot]     = stats.blastRadius;      // Radio de explosión
        this.types[slot]      = type;
        // Escribir velocidad en arreglo plano (evita allocación de Vector3)
        this.vel[slot * 3]     = direction.x * 45.0;
        this.vel[slot * 3 + 1] = direction.y * 45.0;
        this.vel[slot * 3 + 2] = direction.z * 45.0;

        return slot;
    }

    /**
     * Desactiva el slot. O(1).
     */
    kill(slot) {
        this.meshes[slot].visible = false;
        this.types[slot] = -1;
        this.life[slot]  = 0;
        if (this.active > 0) this.active--;
    }
}

export class WeaponManager {
    constructor(scene, vfxManager, enemyManager) {
        this.scene = scene;
        this.vfxManager = vfxManager;
        this.enemyManager = enemyManager;
        
        // Geometría compartida (VRAM compartida — 0 duplicados)
        this.sphereGeo    = new THREE.SphereGeometry(0.3, 16, 16);
        this.sphereMatSun  = MaterialManager.getMaterial({ color: 0xff8800, emissive: 0xff3300, emissiveIntensity: 3.5 });
        this.sphereMatMoon = MaterialManager.getMaterial({ color: 0x00ccff, emissive: 0x0066ff, emissiveIntensity: 3.5 });
        
        // Pool circular de 32 proyectiles (sin GC)
        this.pool = new ProjectilePool(scene, this.sphereGeo, this.sphereMatSun, this.sphereMatMoon);
        
        // Portales (máximo 2 activos simultáneamente)
        this.portalGeo     = new THREE.CylinderGeometry(2.0, 2.0, 0.2, 32);
        this.portalMatSun  = MaterialManager.getMaterial({ color: 0xffaa00, emissive: 0xff5500, emissiveIntensity: 1.5, metalness: 0.8, roughness: 0.1 });
        this.portalMatMoon = MaterialManager.getMaterial({ color: 0x00eaff, emissive: 0x0088ff, emissiveIntensity: 1.5, metalness: 0.8, roughness: 0.1 });
        this.activePortals = [null, null]; // [Sol, Luna]
        
        // Luces por tipo (1 por tipo, sin clonar cada disparo)
        this.lightSun  = new THREE.PointLight(0xff5500, 2.0, 15);
        this.lightMoon = new THREE.PointLight(0x0088ff, 2.0, 15);
    }

    fireEnergySphere(origin, forwardDirection, type = 0) {
        this.pool.fire(origin, forwardDirection, type, type === 0 ? this.lightSun : this.lightMoon);
    }

    update(delta) {
        const pool = this.pool;
        // Itera el Typed Array plano de 32 slots — sin branch de Array.length,
        // sin splice O(n), sin GC. CPU lee bloques contiguos de Float32Array.
        for (let i = 0; i < POOL_SIZE; i++) {
            if (pool.types[i] === -1) continue; // Slot inactivo — skip O(1)

            pool.life[i] -= delta;

            if (pool.life[i] <= 0) {
                pool.kill(i);
                continue;
            }

            const mesh = pool.meshes[i];
            // Integración cinemática usando el arreglo plano de velocidades
            // Sin allocar Vector3 — directo en los componentes de position
            mesh.position.x += pool.vel[i * 3]     * delta;
            mesh.position.y += pool.vel[i * 3 + 1] * delta;
            mesh.position.z += pool.vel[i * 3 + 2] * delta;

            // Estela de chispas (30% de probabilidad para no saturar el pool VFX)
            if (this.vfxManager && Math.random() < 0.3) {
                this.vfxManager.createSparks(mesh.position, 1);
            }

            let hit = false;

            // --- COLISIÓN CON ENTORNO via SpatialHashGrid O(k) ---
            const velLen = Math.sqrt(
                pool.vel[i * 3] ** 2 +
                pool.vel[i * 3 + 1] ** 2 +
                pool.vel[i * 3 + 2] ** 2
            );
            const dirX = pool.vel[i * 3]     / velLen;
            const dirY = pool.vel[i * 3 + 1] / velLen;
            const dirZ = pool.vel[i * 3 + 2] / velLen;
            const dir = new THREE.Vector3(dirX, dirY, dirZ);

            // queryArray devuelve solo los objetos en celdas cercanas (O(k))
            const nearCandidates = spatialGrid.queryArray(mesh.position.x, mesh.position.z, 1);
            if (nearCandidates.length > 0) {
                const ray = new THREE.Raycaster(mesh.position, dir, 0, velLen * delta + 0.5);
                const wallHits = ray.intersectObjects(nearCandidates);

                if (wallHits.length > 0) {
                    hit = true;
                    const hitPoint = wallHits[0].point;
                    const normal = wallHits[0].face
                        ? wallHits[0].face.normal.clone().transformDirection(wallHits[0].object.matrixWorld).normalize()
                        : new THREE.Vector3(0, 1, 0);

                    if (this.vfxManager) {
                        this.vfxManager.createDustPuff(hitPoint, 10);
                        this.vfxManager.createSparks(hitPoint, 15);
                    }
                    this.spawnPortal(hitPoint, normal, pool.types[i]);
                }
            }

            // --- COLISIÓN CON ENEMIGOS (Array iterable, sin splice) ---
            if (!hit) {
                const enemies = this.enemyManager.enemies;
                const hitRadius = pool.radius[i] || 1.8;
                for (let j = 0; j < enemies.length; j++) {
                    const enemy = enemies[j];
                    if (!enemy || enemy.userData.state === 'DEAD') continue;

                    const dx = mesh.position.x - enemy.position.x;
                    const dy = mesh.position.y - enemy.position.y;
                    const dz = mesh.position.z - enemy.position.z;
                    const distSq = dx*dx + dy*dy + dz*dz;

                    if (distSq < hitRadius * hitRadius) {
                        // TODO: Implementar HP en enemigos para usar pool.damage[i] en lugar de Insta-Kill
                        // Por AHORA, si vida==muerte (1 hit), muere. Si el enemigo tuviese HP, descontaríamos pool.damage[i].
                        // Esto deja preparado el motor de armas para cuando actualicemos HP a enemigos.
                        enemy.userData.state = 'DEAD';
                        if (this.vfxManager) {
                            this.vfxManager.createSparks(enemy.position, 30);
                            this.vfxManager.createDustPuff(enemy.position, 15);
                        }
                        playLandSound();
                        window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.25, intensity: 1.5 } }));
                        hit = true;
                        
                        // === LOOT DROP AL MORIR POR DISPARO ===
                        if (window.lootSystem) {
                            window.lootSystem.dropLoot(enemy.userData.spriteType || 'aldeano_azteca', enemy.position.clone());
                        }

                        break;
                    }
                }
            }

            if (hit) pool.kill(i);
        }
    }
    
    spawnPortal(position, normal, type) {
        // Remover portal viejo si existía
        if (this.activePortals[type]) {
            this.scene.remove(this.activePortals[type]);
        }
        
        const mat = type === 0 ? this.portalMatSun : this.portalMatMoon;
        const portalMesh = new THREE.Mesh(this.portalGeo, mat);
        
        // Desfasar ligeramente para evitar Z-Fighting
        portalMesh.position.copy(position).addScaledVector(normal, 0.1);
        
        // Orientar el parche cilíndrico copiando la normal del muro
        portalMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        
        portalMesh.userData = { normal: normal, type: type };
        
        this.scene.add(portalMesh);
        this.activePortals[type] = portalMesh;
        playLandSound(); // Thud sintético
    }
}
