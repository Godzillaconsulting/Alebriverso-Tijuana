import * as THREE from 'three';
import { playLandSound, playEnemyGrowl, playEnemyHit } from './audio.js';
import MaterialManager from './materialManager.js';
import { lootSystem } from './lootSystem.js';


// =========================================================
// ENEMY NODE: Nodo de Lista Doblemente Enlazada
// Cada enemigo en el mundo es un nodo. Spawn/Kill = O(1).
// =========================================================
class EnemyNode {
    constructor() {
        this.group = null;       // Puntero al THREE.Group del monstruo
        this.prev  = null;       // Puntero al nodo anterior (DLL)
        this.next  = null;       // Puntero al nodo siguiente (DLL)
        this.alive = false;      // Flag de estado en el pool
    }
}

// =========================================================
// ENEMY POOL: Free List pre-allocada de 64 nodos.
// Reemplaza el Array.push/splice con punteros directos.
// Basado en la filosofiía de Object Pool en motores de consola.
// =========================================================
const ENEMY_POOL_MAX = 64;

class EnemyPool {
    constructor() {
        // Arreglo fijo de punteros a nodos (como un array de punteros)
        this.nodes = new Array(ENEMY_POOL_MAX);
        for (let i = 0; i < ENEMY_POOL_MAX; i++) {
            this.nodes[i] = new EnemyNode();
        }
        
        // Free List: Lista enlazada de nodos libres
        // nodes[0].next = nodes[1] -> nodes[2] -> ... -> nodes[63(null]
        for (let i = 0; i < ENEMY_POOL_MAX - 1; i++) {
            this.nodes[i].next = this.nodes[i + 1];
        }
        this.freeHead = this.nodes[0]; // Puntero al primer nodo libre
        
        // Lista activa: DLL de nodos vivos
        this.activeHead = null;
        this.activeTail = null;
        this.activeCount = 0;
    }

    /** Solicita un nodo libre del pool en O(1) */
    acquire() {
        if (!this.freeHead) return null; // Pool lleno
        const node = this.freeHead;
        this.freeHead = node.next;    // Avanza el puntero free
        node.next = null;
        node.prev = null;
        node.alive = true;
        
        // Insertar al frente de la lista activa
        if (this.activeHead) {
            node.next = this.activeHead;
            this.activeHead.prev = node;
        } else {
            this.activeTail = node;
        }
        this.activeHead = node;
        this.activeCount++;
        return node;
    }

    /** Libera un nodo de vuelta al free pool en O(1) */
    release(node) {
        if (!node.alive) return;
        node.alive = false;
        
        // Desenlazar de la lista activa (DLL O(1) con punteros)
        if (node.prev) node.prev.next = node.next;
        else this.activeHead = node.next;
        if (node.next) node.next.prev = node.prev;
        else this.activeTail = node.prev;
        
        // Re-encabezar la free list
        node.prev = null;
        node.next = this.freeHead;
        this.freeHead = node;
        this.activeCount--;
    }
}

export class EnemyManager {
    constructor(scene, vfxManager) {
        this.scene = scene;
        this.vfxManager = vfxManager;
        
        // Pool de 64 nodos enemigos pre-allocados (Free List DLL)
        this._pool = new EnemyPool();
        
        // Retrocompatibilidad: las otras clases iteran 'this.enemies' como Array.
        // Lo mantenemos como un proxy-array que apunta a los grupos activos.
        // Se repobla en cada frame en update() — O(n) aceptable ya que n <= 64.
        this.enemies = [];
        
        // Materials for Procedural Enemies
        // Materials for Procedural Enemies (Using MaterialManager for PS2 Bump/Normal Maps)
        this.matSkin  = MaterialManager.getMaterial({ color: 0x4a2e15, roughness: 0.9, metalness: 0.0 });
        this.matBelly = MaterialManager.getMaterial({ color: 0xd9b38c, roughness: 0.9 });
        this.matEye   = MaterialManager.getMaterial({ color: 0xffffff, roughness: 0.2 });
        this.matPupil = MaterialManager.getMaterial({ color: 0x111111, roughness: 0.1 });
        this.matShoe  = MaterialManager.getMaterial({ color: 0x221100, roughness: 0.8 });
        
        // Shared Geometries (Prevention of VRAM Memory Leaks)
        this.bodyGeo = new THREE.SphereGeometry(0.6, 32, 16);
        this.bellyGeo = new THREE.SphereGeometry(0.4, 16, 16);
        this.eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
        this.pupilGeo = new THREE.SphereGeometry(0.05, 16, 16);
        this.shoeGeo = new THREE.CapsuleGeometry(0.15, 0.2, 8, 16);
    }
    
    spawnGoomba(x, y, z, spriteType = 'aldeano_azteca') {
        // ─── Mapa de SpriteType → Ruta de Textura PNG ────────────────
        // Extiende este Map cuando el artista entregue nuevas texturas.
        // Diseño: O(1) lookup por Map.
        const SPRITE_MAP = new Map([
            ['aldeano_azteca',   '/textures/aldeano_frente.jpg'],
            ['jaguar',           '/textures/jaguar_frente.jpg'],
            ['colibri',          '/textures/colibri_frente.jpg'],
            ['serpiente',        '/textures/serpiente_frente.jpg'],
            ['huitzilopochtli',  '/textures/huitzilo_frente.jpg'],
            ['guerrero_aguila',  '/textures/jaguar_frente.jpg'],  // Fallback temporal
            ['mercader',         '/textures/ui/mercader_sprite.png'],
        ]);

        const texturePath = SPRITE_MAP.get(spriteType) ?? '/textures/jaguar_frente.jpg';

        // Assembly del Enemigo Procedural (Monstruo Hongo Carnívoro)
        const group = new THREE.Group();
        
        const body = new THREE.Mesh(this.bodyGeo, this.matSkin);
        body.scale.set(1.0, 0.8, 1.0);
        body.position.y = 0.5;
        body.castShadow = true;
        body.userData.isShared = true;
        group.add(body);
        
        const belly = new THREE.Mesh(this.bellyGeo, this.matBelly);
        belly.scale.set(1.1, 0.6, 0.4);
        belly.position.set(0, 0.35, 0.5);
        belly.userData.isShared = true;
        group.add(belly);

        // ─── SPRITE BILLBOARD (Arte del Artista) ─────────────────────
        // Un PlaneGeometry siempre orientado hacia la cámara.
        // Cargamos la textura de forma lazy — si no existe, el body 3D aún se ve.
        const spriteMat = new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const spritePlane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), spriteMat);
        spritePlane.position.set(0, 0.55, 0.55); // Frente del body
        spritePlane.userData.isBillboard = true;  // El update() rotará esto hacia la cámara
        group.add(spritePlane);

        // Carga asíncrona no-bloqueante: no congela el loop del motor
        new THREE.TextureLoader().loadAsync(texturePath)
            .then(tex => {
                spriteMat.map = tex;
                spriteMat.needsUpdate = true;
                // Una vez cargada la textura, ocultar el body 3D procedural
                // para que se vea limpio el sprite 2D artístico
                body.visible = false;
                belly.visible = false;
            })
            .catch(() => {
                // Textura no encontrada: el body 3D ya visible de fallback
                console.warn(`[EnemyManager] Sprite no encontrado: ${texturePath}`);
            });

        // Ojos Feroces (visibles sólo en fallback sin textura)
        const eyeGroup = new THREE.Group();
        
        const eL = new THREE.Mesh(this.eyeGeo, this.matEye); eL.position.set(-0.25, 0.6, 0.5); eL.userData.isShared = true;
        const pL = new THREE.Mesh(this.pupilGeo, this.matPupil); pL.position.set(-0.25, 0.6, 0.61); pL.userData.isShared = true;
        const eR = new THREE.Mesh(this.eyeGeo, this.matEye); eR.position.set(0.25, 0.6, 0.5); eR.userData.isShared = true;
        const pR = new THREE.Mesh(this.pupilGeo, this.matPupil); pR.position.set(0.25, 0.6, 0.61); pR.userData.isShared = true;
        
        eyeGroup.add(eL, pL, eR, pR);
        group.add(eyeGroup);
        
        // Patas
        const legL = new THREE.Mesh(this.shoeGeo, this.matShoe);
        legL.rotation.x = Math.PI / 2;
        legL.position.set(-0.3, 0.15, 0.1);
        legL.castShadow = true;
        legL.userData.isShared = true;
        group.add(legL);
        
        const legR = new THREE.Mesh(this.shoeGeo, this.matShoe);
        legR.rotation.x = Math.PI / 2;
        legR.position.set(0.3, 0.15, 0.1);
        legR.castShadow = true;
        legR.userData.isShared = true;
        group.add(legR);

        group.position.set(x, y, z);
        
        // Máquina de Estados (State Machine)
        group.userData = {
            state: 'PATROL',
            origin: new THREE.Vector3(x, y, z),
            patrolAngle: Math.random() * Math.PI * 2,
            speed: 2.5,
            aggroRange: 12.0,
            animOffset: Math.random() * 10,
            spriteType: spriteType,
            spritePlane: spritePlane,
            bones: { body, eyeGroup, legL, legR },
            // === STAGGER SYSTEM (RE4) ===
            hp: 3,                  // Puntos de vida del enemigo
            staggerTimer: 0.0,      // Tiempo restante en stagger
            staggerThreshold: 1,    // Golpes para entrar en stagger (reset en cada stagger)
            hitCount: 0,            // Contador de golpes en esta ventana
            hitCountResetTimer: 0.0 // Tiempo para resetear el contador de golpes sin stagger
        };
        
        // Enlazar al Pool en vez de hacer push al Array
        const node = this._pool.acquire();
        if (!node) { console.warn('[EnemyPool] Pool lleno — ignoring spawn'); return; }
        
        node.group = group;
        this.scene.add(group);
    }

    
    update(delta, playerController) {
        const playerPos = playerController.mesh.position;
        const camera = playerController._camera; // Se pasa la cámara desde main.js si está disponible
        
        // Reconstruir el array de referencia a partir de la DLL activa
        this.enemies.length = 0;
        let cur = this._pool.activeHead;
        while (cur) {
            if (cur.group) this.enemies.push(cur.group);
            cur = cur.next;
        }

        // Iterar el array proxy para actualizar lógica de cada enemigo
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            const distSq = e.position.distanceToSquared(playerPos);

            // --- BILLBOARD: Rotar sprite hacia la cámara (Doom-style) ---
            // El spritePlane tiene isBillboard=true; lo orientamos hacia el jugador en YXZ
            const spritePlane = e.userData.spritePlane;
            if (spritePlane && spritePlane.visible) {
                // Copiamos el quaternion de la cámara si existe, sino orientamos hacia el jugador
                if (camera) {
                    spritePlane.quaternion.copy(camera.quaternion);
                } else {
                    // Fallback: girar el plano para mirar al jugador en el eje Y
                    const toPlayer = new THREE.Vector3()
                        .subVectors(playerPos, e.position)
                        .setY(0).normalize();
                    if (toPlayer.lengthSq() > 0.001) {
                        spritePlane.quaternion.setFromUnitVectors(
                            new THREE.Vector3(0, 0, 1), toPlayer
                        );
                    }
                }
            }

            
            // Evaluación de Aggro (Transición de Estado) — Solo si no muerto/stagger y no es un NPC Pacífico
            if (e.userData.state !== 'DEAD' && e.userData.state !== 'STAGGER') {
                if (e.userData.spriteType === 'mercader') {
                    e.userData.state = 'IDLE'; // El mercader es pacífico
                } else if (distSq < e.userData.aggroRange * e.userData.aggroRange) {
                    if (e.userData.state === 'PATROL') playEnemyGrowl(e.position);
                    e.userData.state = 'CHASE';
                } else {
                    e.userData.state = 'PATROL';
                }
            }
            
            // Timer de hitCount ventana (si no golpean en 1.5s, resetar combo)
            if (e.userData.hitCountResetTimer > 0) {
                e.userData.hitCountResetTimer -= delta;
                if (e.userData.hitCountResetTimer <= 0) e.userData.hitCount = 0;
            }
            
            // Ejecución del Estado
            let isMoving = false;
            let currentSpeed = 0;
            
            if (e.userData.state === 'DEAD') {
                e.scale.y -= 15.0 * delta;
                e.scale.x += 2.0 * delta;
                e.scale.z += 2.0 * delta;
                
                if (e.scale.y <= 0.1) {
                    e.scale.y = 0.1;
                    
                    if (!e.userData.isFading) {
                        e.traverse(child => {
                            if (child.isMesh) {
                                child.material = child.material.clone();
                                child.material.transparent = true;
                            }
                        });
                        e.userData.isFading = true;
                        e.userData.fadeOpacity = 1.0;
                    }
                    
                    e.userData.fadeOpacity -= 1.5 * delta;
                    e.traverse(child => {
                        if (child.isMesh) child.material.opacity = e.userData.fadeOpacity;
                    });
                    
                    if (e.userData.fadeOpacity <= 0) {
                        this.scene.remove(e);
                        let nd = this._pool.activeHead;
                        while (nd) {
                            if (nd.group === e) { this._pool.release(nd); break; }
                            nd = nd.next;
                        }
                    }
                }
                continue;
            }

            // === STAGGER STATE (RE4) ===
            if (e.userData.state === 'STAGGER') {
                e.userData.staggerTimer -= delta;
                
                // Flash blanco para retroalimentación visual del impacto
                const flashOn = Math.floor(e.userData.staggerTimer * 20) % 2 === 0;
                e.traverse(child => { if (child.isMesh) child.visible = flashOn; });
                
                // Mantener knockback inercial hacia atrás (el enemigo retrocede)
                if (e.userData.staggerVelocity) {
                    e.position.addScaledVector(e.userData.staggerVelocity, delta);
                    e.userData.staggerVelocity.multiplyScalar(0.85); // Fricción rápida
                }
                
                if (e.userData.staggerTimer <= 0) {
                    e.userData.state = 'CHASE'; // Vuelve a la acción lleno de furia
                    e.userData.staggerTimer = 0;
                    e.traverse(child => { if (child.isMesh) child.visible = true; });
                }
                continue; // No puede atacar ni moverse normalmente durante stagger
            }

            if (e.userData.state === 'CHASE') {
                const targetPos = playerPos.clone();
                targetPos.y = e.position.y; // Evitar que el enemigo rote hacia arriba/abajo
                
                // Rotación fluida Quaternion (Evita Gimbal Lock)
                const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(e.position, targetPos, new THREE.Vector3(0, 1, 0)));
                e.quaternion.slerp(q, 10 * delta);
                
                // Movimiento Euclidiano hacia el jugador
                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(e.quaternion);
                currentSpeed = e.userData.speed;
                e.position.addScaledVector(forward, currentSpeed * delta);
                isMoving = true;
                
            } else if (e.userData.state === 'IDLE') {
                // NPC Pacífico (Mercader)
                const time = (Date.now() * 0.001 * 0.5) + e.userData.animOffset; // Use a fixed speed for idle bob
                e.position.y += Math.sin(time * 2.0) * delta * 0.5; // Respiración suave
                // Sin movimiento X/Z
            } else if (e.userData.state === 'PATROL') {
                e.userData.patrolAngle += 1.5 * delta;
                const offsetX = Math.cos(e.userData.patrolAngle) * 2;
                const offsetZ = Math.sin(e.userData.patrolAngle) * 2;
                
                const target = e.userData.origin.clone().add(new THREE.Vector3(offsetX, 0, offsetZ));
                const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(e.position, target, new THREE.Vector3(0, 1, 0)));
                e.quaternion.slerp(q, 5 * delta);
                
                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(e.quaternion);
                currentSpeed = e.userData.speed * 0.4;
                e.position.addScaledVector(forward, currentSpeed * delta);
                isMoving = true;
            }
            
            // --- ANIMACIÓN PROCEDURAL DE CAMINATA ESTILO NINTENDO ---
            if (isMoving && e.userData.bones) {
                const time = (Date.now() * 0.001 * currentSpeed * 4) + e.userData.animOffset;
                // Wobble lateral de todo el cuerpo
                e.userData.bones.body.rotation.z = Math.sin(time) * 0.15;
                e.userData.bones.body.rotation.x = Math.abs(Math.sin(time)) * 0.1;
                // Ojos siguiendo el wobble
                e.userData.bones.eyeGroup.rotation.z = Math.sin(time) * 0.15;
                // Swing de patas (Ping Pong)
                e.userData.bones.legL.position.y = 0.15 + Math.max(0, Math.sin(time))*0.15;
                e.userData.bones.legR.position.y = 0.15 + Math.max(0, -Math.sin(time))*0.15;
                e.userData.bones.legL.position.z = 0.1 + Math.sin(time)*0.2;
                e.userData.bones.legR.position.z = 0.1 + -Math.sin(time)*0.2;
            }
            
            // COMPROBACIÓN DEL DAÑO Euclidiano (Hitbox)
            if (dist < 1.4 && e.userData.state !== 'DEAD' && e.userData.state !== 'STAGGER') {
                if (playerController.velocity.y < -5.0 && playerPos.y > e.position.y + 0.5) {
                    // SQUASH (Muerte del Goomba / stomp)
                    e.userData.state = 'DEAD';
                    if(this.vfxManager) {
                        this.vfxManager.createDustPuff(e.position, 10);
                        this.vfxManager.createSparks(e.position, 15);
                    }
                    playEnemyHit(e.position);
                    playLandSound();
                    // === LOOT DROP (RE4 Grade) ===
                    lootSystem.dropLoot(e.userData.spriteType || 'aldeano_azteca', e.position.clone());
                    window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.3, intensity: 1.5 } }));
                    window.dispatchEvent(new CustomEvent('coinCollected'));
                    playerController.bounce(16);
                } else if (!playerController.isDiving) {
                    // Golpe frontal normal: jugador recibe daño
                    playerController.takeDamage(e.position);
                }
            }

        }
    }

    /**
     * hitEnemy() — Llamado desde PlayerController cuando F es presionado durante Dive Roll.
     * Aplica daño a UN enemigo específico y activa el Stagger si se alcanza el threshold.
     * @param {THREE.Group} enemyGroup - El grupo del enemigo a dañar
     * @param {THREE.Vector3} attackOrigin - Origen del golpe para cálculo de knockback
     * @param {boolean} isRemateBlow - true si el ataque se ejecuta durante el Stagger del enemigo (2x daño)
     */
    hitEnemy(enemyGroup, attackOrigin, isRemateBlow = false) {
        const ud = enemyGroup.userData;
        if (!ud || ud.state === 'DEAD' || ud.state === 'STAGGER' || ud.spriteType === 'mercader') return false;
        
        const dmg = isRemateBlow ? 2 : 1;
        ud.hp -= dmg;
        
        // Contador de golpes en ventana de tiempo
        ud.hitCount++;
        ud.hitCountResetTimer = 1.5; // Reiniciar ventana
        
        // Si HP llega a 0, muerte
        if (ud.hp <= 0) {
            ud.state = 'DEAD';
            if (this.vfxManager) {
                this.vfxManager.createDustPuff(enemyGroup.position, 12);
                this.vfxManager.createSparks(enemyGroup.position, 20);
            }
            playEnemyHit(enemyGroup.position);
            window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.4, intensity: 2.0 } }));
            window.dispatchEvent(new CustomEvent('coinCollected'));
            return true;
        }
        
        // Stagger al alcanzar threshold
        if (ud.hitCount >= ud.staggerThreshold) {
            ud.state = 'STAGGER';
            ud.staggerTimer = 0.55; // 0.55 segundos de ventana de remate RE4
            ud.hitCount = 0;
            
            // Knockback vectorial: empujar en dirección contraria al golpe
            const knockDir = new THREE.Vector3().subVectors(enemyGroup.position, attackOrigin).normalize();
            knockDir.y = 0;
            ud.staggerVelocity = knockDir.multiplyScalar(8.0);
            
            playEnemyHit(enemyGroup.position);
            if (this.vfxManager) this.vfxManager.createSparks(enemyGroup.position, 8);
            window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.2, intensity: 0.8 } }));
        }
        
        return false;
    }
}
