import * as THREE from 'three';
import { collidables, portals, grabbables, windZones, waterZones, lavaZones, quicksandZones, npcs, waterSwitches, payphones } from './assets.js';
import { playJumpSound, playDoubleJumpSound, playLandSound, playFootstep } from './audio.js';
import { buildProceduralAlebrije } from './AlebrijeProceduralMesh.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { spatialGrid } from './spatialHash.js';

// === PS2 PHYSICS UPGRADE: Global Raycaster Pool ===
// Raycasters globales re-utilizables (sin new en hot-path, sin GC pressure)
const _downRay     = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
const _downRayL    = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)); // Punto izquierdo del cápsula
const _downRayR    = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)); // Punto derecho del cápsula
const _downRayFwd  = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)); // Punto frontal
const _hRay        = new THREE.Raycaster();
const _hRayHigh    = new THREE.Raycaster();
const _upRay       = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 1, 0));

// Vector3 auxiliares reutilizables (sin new en hot-path)
const _rayOriginDown  = new THREE.Vector3();
const _rayOriginH     = new THREE.Vector3();
const _rayOriginHH    = new THREE.Vector3();

// === PS2: CONTACT NORMAL RING BUFFER (3-frame moving average) ===
// Almacena las normales de los últimos 3 frames para suavizar el vector de piso
// Elimina el jitter visual en rampas y rebordes
const _normalBuffer = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 1, 0)
];
let _normalBufferIdx = 0;
const _smoothNormal = new THREE.Vector3(0, 1, 0); // Normal promediada, actualizada por frame

export class PlayerController {
    constructor(scene, vfxManager) {
        this.vfxManager = vfxManager;
        this.mesh = new THREE.Group();
        this.mesh.position.set(0, 5, 0);
        scene.add(this.mesh);
        
        // --- GAME FEEL: Blob Shadow (Sombra Fake de Caída) ---
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 128; shadowCanvas.height = 128;
        const ctx = shadowCanvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(0,0,0,0.7)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.3)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        const shadowTex = new THREE.CanvasTexture(shadowCanvas);
        
        this.blobShadow = new THREE.Mesh(
            new THREE.PlaneGeometry(2.0, 2.0),
            new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
        );
        this.blobShadow.rotation.x = -Math.PI / 2;
        scene.add(this.blobShadow);
        
        // --- Pipeline GLTF (Soporte Maya/Blender) ---
        this.mixer = null;
        this.animations = {};
        this.currentActionName = '';
        
        const loader = new GLTFLoader();
        loader.load('/assets/models/character.glb', (gltf) => {
            console.log("[GLTFLoader] Model character.glb successfully loaded via Pasive Mode.");
            const model = gltf.scene;
            
            // Ajustar sombras e IK
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
                if (child.isBone && child.name.toLowerCase().includes('spine')) {
                    this.spineBone = child;
                }
            });
            if (!this.spineBone) {
                // Fallback to finding any bone in case spine doesn't exist but hips do
                model.traverse((child) => {
                    if (child.isBone && child.name.toLowerCase().includes('chest')) this.spineBone = child;
                });
            }
            
            this.mesh.add(model);
            
            // Sustituir automáticamente el Alebrije Procedural Matemático
            if (this.alebrije) {
                this.mesh.remove(this.alebrije);
                this.alebrije = null; // Garbage Collect
            }
            
            // Action Mixer Node
            this.mixer = new THREE.AnimationMixer(model);
            
            // Mapeo Estricto de GDD
            gltf.animations.forEach((clip) => {
                const name = clip.name.toLowerCase();
                this.animations[name] = this.mixer.clipAction(clip);
            });
            
            this.playAnimation('idle'); // Estado Cero
            
        }, undefined, (err) => {
            // Silencioso. El juego corre con el Procedural si el artista aún no sube el modelo.
        });
        
        // --- Fallback Inicial ---
        // Agregar Alebrije Procedural al root mientras no haya GLTF.
        // EXTRA: Utilizar inyección de Keyframes Baked a Tracks de Animación GLTF-Compatibles
        this.alebrije = buildProceduralAlebrije();
        this.alebrije.scale.set(0.6, 0.6, 0.6); // Escalar al tamaño base
        this.mesh.add(this.alebrije);
        
        // --- 🐉 TAREA DIRECTOR 3D: ENLAZAR ESQUELETOS (BONES Y MIXER) ---
        // Se ejecuta para modelar el Pipeline estándar sobre los Bakes procedimentales como exigió el Prompt.
        this.mixer = new THREE.AnimationMixer(this.alebrije);
        if (this.alebrije.animations) {
            this.alebrije.animations.forEach((clip) => {
                this.animations[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
            });
        }
        
        // Mapeo Estricto de GDD
        this.playAnimation('idle'); // Estado Cero
        
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        this.wasOnGround = true; // Para detectar el frame exacto de aterrizaje
        this.jumpCount = 0; // Para el combo de salto de SM64
        this.lastJumpTime = 0;
        
        // Sistema de Salud (HP y Daño)
        this.hp = 3;
        this.invulnerableTimer = 0;
        
        this.clock = new THREE.Clock();
        
        // Input state
        // Input state
        this.keys = { w: false, a: false, s: false, d: false, space: false, shift: false, e: false, f: false };
        
        document.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        document.addEventListener('keyup', (e) => this.onKeyUp(e), false);
        document.addEventListener('mousedown', (e) => this.onMouseDown(e), false);
        
        // Physics constants (SM64 tweaks)
        this.gravity = -35;
        this.jumpForce = 15;
        this.speed = 10;
        
        // Neo-Platforming variables
        this.currentVelocity = new THREE.Vector3();
        this.canDash = true;
        this.coyoteTimer = 0.0;
        
        this.isWallRunning = false;
        this.wallRunTimer = 0.0;
        this.isSliding = false;
        this.inWater = false;
        // === RE4 UPGRADES ===
        this.isDiving = false;
        this.diveTimer = 0.0;
        this.diveCooldown = 0.0;
        this.isLedgeGrabbing = false;
        this.ledgeGrabTimer = 0.0;
        this.ledgeGrabSurface = null;
        this.enemyManagerRef = null;
        
        // === RE4 2004 COMBAT PHYSICS ===
        this.isAiming    = false;     // Combat stance (ralentiza 30%)
        this.aimTimer    = 0.0;       // Tiempo en stance de combate
        this.perfectDodgeWindow = 0.0; // Ventana de perfect dodge (66ms = 4 frames a 60fps)
        this.lastMoveDir = new THREE.Vector3(); // Dirección del frame anterior para brake distance
        
        // === SM64 BASE COMPLETADO ===
        this.slopeSpeedAccum = 0.0;   // Acumulador de momentum en pendientes largas (SM64)
        this.footstepTimer = 0.0;     // Intervalo entre pasos
        this.isGroundPounding = false; // Flag dedicado para distinción del Game Feel
        this.electricTimer = 0.0;     // Timer de daño periódico por superficie eléctricase;
        this.wasInWater = false;
        
        // Agente de Físicas: Nuevos Estados Parkour/Terreno
        this.currentFloorSurface = 'normal';
        this.isClimbingPole = false;
        this.isHanging = false;
        this.poleObject = null;
        
        // === RE4 UPGRADES ===
        this.isDiving = false;        // Dive Roll activo (i-frames de esquive)
        this.diveTimer = 0.0;         // Duración del roll (0.35s)
        this.diveCooldown = 0.0;      // Cooldown anti-spam
        this.isLedgeGrabbing = false; // Colgado en borde
        this.ledgeGrabTimer = 0.0;    // Timeout para el pull-up
        this.ledgeGrabSurface = null; // Normal del borde para el pull-up
        this.enemyManagerRef = null;  // Inyectado externamente para hitEnemy()
        
        // --- Nado Libre 3D y Paravela (Alas Alebrije) ---
        this.oxygen = 10.0;
        this.drownTimer = 0.0;
        this.isGliding = false;
        this.gliderStamina = 3.0; // 3 Segundos de vuelo Zelda estricto
        
        // Carga y Lanzamiento
        this.sceneRef = scene; 
        this.carriedObject = null;
        this.thrownObjects = [];
    }
    
    onKeyDown(event) {
        switch(event.code) {
            case 'KeyW': this.keys.w = true; break;
            case 'KeyA': this.keys.a = true; break;
            case 'KeyS': this.keys.s = true; break;
            case 'KeyD': this.keys.d = true; break;
            case 'ShiftLeft':
            case 'ShiftRight':
                if (!this.keys.shift) {
                    if (this.onGround && this.diveCooldown <= 0 && !this.isDiving) {
                        // === DIVE ROLL (RE4) ===
                        // Detección de Backflip: Correr sin input de movimiento + Shift = Backflip
                        const isMovingForward = this.keys.w || this.keys.a || this.keys.s || this.keys.d;
                        
                        if (!isMovingForward) {
                            // Backflip lateral: propulsión hacia atrás + salto
                            const back = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                            this.currentVelocity.x = back.x * this.speed * 2.2;
                            this.currentVelocity.z = back.z * this.speed * 2.2;
                            this.velocity.y = this.jumpForce * 0.9;
                            this.onGround = false;
                            playDoubleJumpSound();
                        } else {
                            // Dive Roll en la dirección del movimiento
                            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
                            this.currentVelocity.x = fwd.x * this.speed * 2.8;
                            this.currentVelocity.z = fwd.z * this.speed * 2.8;
                            this.isDiving = true;
                            this.diveTimer = 0.35;
                            this.velocity.y = 3.0; // Ligero salto rasenśgan
                            // === RE4 #5: PERFECT DODGE WINDOW ===
                            // Abrir ventana de 66ms (4 frames a 60fps) al INICIO del roll.
                            // Si un golpe llega en este instante, el daño se niega y los i-frames son 2x.
                            this.perfectDodgeWindow = 0.066;
                        }
                        this.diveCooldown = 0.65;
                        if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 8);
                    } else if (!this.onGround && this.canDash) {
                        // Air Dash (funcionalidad previa preservada)
                        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
                        this.currentVelocity.x = fwd.x * this.speed * 3.5;
                        this.currentVelocity.z = fwd.z * this.speed * 3.5;
                        this.canDash = false;
                        this.velocity.y = 5.0;
                        if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 10);
                    }
                }
                this.keys.shift = true;
                break;
            case 'KeyE':
                if (!this.keys.e) {
                    this.keys.e = true;
                    // 1. Prioridad: Diálogos Activos
                    const dialogEl = document.getElementById('dialog-overlay');
                    if (dialogEl && dialogEl.style.display === 'flex') {
                        window.dispatchEvent(new CustomEvent('dialogueNext'));
                    } else {
                        // 1.5. Prioridad COMBATE: Remate a Enemigo Staggered (RE4 Parity)
                        let staggerTarget = null;
                        if (this.enemyManagerRef) {
                            for (let i = 0; i < this.enemyManagerRef.enemies.length; i++) {
                                const e = this.enemyManagerRef.enemies[i];
                                if (e.userData.state === 'STAGGER' && this.mesh.position.distanceToSquared(e.position) < 12.0) {
                                    staggerTarget = e; break;
                                }
                            }
                        }
                        
                        if (staggerTarget) {
                            // Suplex / Roundhouse Kick Invencible
                            this.enemyManagerRef.hitEnemy(staggerTarget, this.mesh.position, true); // true = isRemateBlow
                            if (this.vfxManager) this.vfxManager.createSparks(staggerTarget.position, 30);
                            
                            // Invulnerabilidad y Animación de poder
                            this.invulnerableTimer = 1.5;
                            this.velocity.y = 5.0; // Salto visual acrobático
                            window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.3, intensity: 2.0 } }));
                            
                            return; // Terminamos aquí la interacción
                        }

                        // 2. Prioridad: Iniciar Diálogo NPC cercano
                        let foundNPC = null;
                        for(let i = 0; i < npcs.length; i++) {
                            if (this.mesh.position.distanceToSquared(npcs[i].mesh.position) < 12.25) {
                                foundNPC = npcs[i]; break;
                            }
                        }
                        if (foundNPC) {
                            window.dispatchEvent(new CustomEvent('dialogueStart', { detail: { texts: foundNPC.dialogue } }));
                            this.currentVelocity.set(0,0,0); // Freno inercial
                            this.keys.w = this.keys.a = this.keys.s = this.keys.d = false;
                        } else {
                            // 2.5 Prioridad: Mercader (Billboard Pofesional)
                            let foundMerchant = null;
                            if (this.enemyManagerRef) {
                                for(let i = 0; i < this.enemyManagerRef.enemies.length; i++) {
                                    const e = this.enemyManagerRef.enemies[i];
                                    if (e.userData.state !== 'DEAD' && e.userData.spriteType === 'mercader' && this.mesh.position.distanceToSquared(e.position) < 12.25) {
                                        foundMerchant = e; break;
                                    }
                                }
                            }
                            
                            if (foundMerchant) {
                                window.dispatchEvent(new CustomEvent('merchantInteract', { detail: { npc: { mesh: foundMerchant } } }));
                                this.currentVelocity.set(0,0,0);
                                this.keys.w = this.keys.a = this.keys.s = this.keys.d = false;
                            } else {
                                // 2.7 Prioridad: Guardado (Payphones / RE4)
                                let foundPhone = null;
                                if (typeof payphones !== 'undefined') {
                                    for(let i=0; i<payphones.length; i++) {
                                        if (this.mesh.position.distanceToSquared(payphones[i].mesh.position) < 9.0) {
                                            foundPhone = payphones[i]; break;
                                        }
                                    }
                                }
                                
                                if (foundPhone && window.saveSystem) {
                                    window.saveSystem.save(
                                        0, // Sobreescribimos el slot automático por ahora o desencadenar UI (futuro)
                                        this.mesh.position, 
                                        window.GlobalState?.currentLevel || 'level1.json', 
                                        window.GlobalState?.currentMissionID || 1,
                                        window.inventorySystem?.getSnapshot() || {}
                                    );
                                    if (this.vfxManager) this.vfxManager.createSparks(foundPhone.mesh.position, 10, 0xFCCB00);
                                    window.dispatchEvent(new CustomEvent('showNotification', { detail: { text: "¡Partida Guardada!", type: "success" } }));
                                    this.currentVelocity.set(0,0,0);
                                    this.keys.w = this.keys.a = this.keys.s = this.keys.d = false;
                                } else {
                                    // 3. Prioridad: Sistema Físico Cargar/Arrojar
                                    this.tryGrabOrThrow();
                                }
                            }
                        }
                    }
                }
                break;
            case 'KeyF':
                if (!this.keys.f) {
                    this.keys.f = true;
                    this.executeAttack();
                }
                break;
            case 'Space': 
                if(!this.keys.space) {
                    if (this.onGround || this.coyoteTimer > 0) {
                        // === GROUND POUND CANCEL: si bajabamos en Ground Pound, interrumpir ===
                        this.isGroundPounding = false;
                        this.onGround = false;
                        this.coyoteTimer = 0.0; // Consumir Coyote
                        
                        const now = Date.now();
                        if (now - this.lastJumpTime < 500) {
                            this.jumpCount++;
                        } else {
                            this.jumpCount = 1;
                        }
                        this.lastJumpTime = now;
                        
                        // --- SISTEMA DE PESO MASIVO (BOSS FIGHT) ---
                        let localJumpForce = this.jumpForce;
                        if (this.carriedObject && this.carriedObject.userData.isMassive) {
                            localJumpForce *= 0.55; // 45% penalidad
                            this.jumpCount = 1; // Resetea combos
                        }

                        if (this.jumpCount === 2) {
                            this.velocity.y = localJumpForce * 1.25; // Salto Doble más alto
                            playDoubleJumpSound();
                        } else if (this.jumpCount >= 3) {
                            this.velocity.y = localJumpForce * 1.5; // Salto Triple enorme
                            playDoubleJumpSound();
                        } else {
                            this.velocity.y = localJumpForce;
                            playJumpSound();
                        }
                        // Feedback Visual Inmediato al despegar
                        if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 6);
                    } else if (!this.inWater && !this.isWallRunning && this.gliderStamina > 0 && this.velocity.y <= 0 && !this.isGroundPounding) {
                        // Desplegar Paravela / Alas de Alebrije en medio del aire
                        this.isGliding = true;
                        playJumpSound();
                    } else if (this.velocity.y > 0 && !this.onGround) {
                        // GROUND POUND: Salto + bajar en peña desde el aire (S + Space en el aire)
                        if (this.keys.s && !this.isGroundPounding) {
                            this.isGroundPounding = true;
                            this.isGliding = false;
                            this.velocity.y = -35.0; // Caída masiva vertical 
                            this.currentVelocity.x *= 0.1; // Pararse de golpe en X/Z
                            this.currentVelocity.z *= 0.1;
                            if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 5);
                        }
                    }
                }
                this.keys.space = true; 
                break;
        }
    }
    
    onKeyUp(event) {
        switch(event.code) {
            case 'KeyW': this.keys.w = false; break;
            case 'KeyA': this.keys.a = false; break;
            case 'KeyS': this.keys.s = false; break;
            case 'KeyD': this.keys.d = false; break;
            case 'ShiftLeft':
            case 'ShiftRight': this.keys.shift = false; break;
            case 'KeyE': this.keys.e = false; break;
            case 'KeyF': this.keys.f = false; break;
            case 'Space': 
                this.keys.space = false;  
                this.isGliding = false; // Plegar Paravela
                // Variable Jump Height
                if (this.velocity.y > 0 && !this.onGround) {
                    this.velocity.y *= 0.5;
                }
                break;
        }
    }
    
    onMouseDown(event) {
        if (document.pointerLockElement) {
            if (event.button === 0) { // Click Izquierdo (M1 - Portal Solar)
                this.executeAttack(0);
            } else if (event.button === 2) { // Click Derecho (M2 - Portal Lunar)
                this.executeAttack(1);
            }
        }
    }
    
    executeAttack(type = 0) {
        // === RE4 #4: Activar Combat Stance Speed Penalty limitado por el Fire Rate (Upgrades) ===
        // El jugador no puede sprinter después de atacar, el cooldown lo define la estadística del arma.
        const stats = window.weaponUpgradeSystem ? window.weaponUpgradeSystem.getStats() : { fireRate: 0.45 };
        this.aimTimer = stats.fireRate;
        
        // Proyectil si no hay enemigos en rango para remate
        if (this.weaponManager) {
            let forward, origin;
            
            if (window.thirdPersonCamera && window.thirdPersonCamera.isAiming) {
                // === RE4: DISPARO HITSCAN EXACTO DONDE APUNTA LA CÁMARA/LÁSER ===
                forward = new THREE.Vector3();
                window.thirdPersonCamera.camera.getWorldDirection(forward);
                
                origin = this.mesh.position.clone().add(new THREE.Vector3(0.3, 1.2, 0).applyQuaternion(this.mesh.quaternion));
                
                // Disparo Instantáneo Raycast (Hitscan) con soporte para Hitboxes!
                if (typeof this.weaponManager.fireHitscan === 'function') {
                    this.weaponManager.fireHitscan(origin, forward, type, collidables);
                } else {
                    this.weaponManager.fireEnergySphere(origin, forward, type);
                }
                
                // Shooting from stance -> Recoil fuerte a la cámara TPS
                window.thirdPersonCamera.applyRecoil(0.04);
                window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.1, intensity: 0.4 } }));
            } else {
                // Disparo de cadera o ataque Melee al vuelo (Sin Aim Stance)
                forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
                origin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                
                // Jump Kick / Ground Pound escape
                if (this.onGround) {
                    this.velocity.y = 8.0; 
                    playJumpSound();
                }
                // Ataque en área corto tipo escopeta o energía usando la esfera normal
                this.weaponManager.fireEnergySphere(origin, forward, type);
            }
            
            if (this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 6);
        }
    }

    update(delta, camera) {
        // === FPS STABILITY (Anti-Lag Spike) ===
        // Si el juego se congela (ej. carga pesada o celular lento), no queremos que la física
        // sume un delta gigante (túnel a través de paredes). Capamos el step a 0.1s máximo.
        if (delta > 0.1) delta = 0.1;

        // === INTERACTION PROMPT HINT (RE4 Grade) ===
        if (window.uiManager) {
            let promptShown = false;
            
            // 0. Prioridad Combate: Remate a Enemigo en Stagger
            if (this.enemyManagerRef) {
                for (let i = 0; i < this.enemyManagerRef.enemies.length; i++) {
                    const e = this.enemyManagerRef.enemies[i];
                    if (e.userData.state === 'STAGGER' && this.mesh.position.distanceToSquared(e.position) < 12.0) {
                        window.uiManager.showInteractionPrompt('Rematar');
                        promptShown = true;
                        break;
                    }
                }
            }

            // 1. Escanear Drops (Radio pequeño 2.5u)
            if (!promptShown && window.lootSystem) {
                for (const drop of window.lootSystem._worldDrops) {
                    if (this.mesh.position.distanceToSquared(drop.mesh.position) < 6.25) {
                        window.uiManager.showInteractionPrompt(`Recoger ${drop.itemType.replace('_', ' ')}`);
                        promptShown = true;
                        break;
                    }
                }
            }
            // 2. Escanear Switches (Placas de Presión, Timers) y NPCs (via UIManager dialogue state si existe)
            if (!promptShown && window.levelManager && window.levelManager.currentAST) {
                const ast = window.levelManager.currentAST;
                if (ast.npcs) {
                    for (const n of ast.npcs) {
                        const nx = n.position?.x || n.position[0];
                        const ny = n.position?.y || n.position[1];
                        const nz = n.position?.z || n.position[2];
                        _rayOriginDown.set(nx, ny, nz);
                        if (this.mesh.position.distanceToSquared(_rayOriginDown) < 16.0) {
                            window.uiManager.showInteractionPrompt(n.type === 'merchant' ? 'Comprar' : 'Hablar');
                            promptShown = true;
                            break;
                        }
                    }
                }
                // 3. Puertas
                if (!promptShown && ast.doors) {
                    for (const d of ast.doors) {
                        _rayOriginDown.set(d.position.x, d.position.y, d.position.z);
                        if (this.mesh.position.distanceToSquared(_rayOriginDown) < 16.0) {
                            window.uiManager.showInteractionPrompt('Abrir');
                            promptShown = true;
                            break;
                        }
                    }
                }
            }
            // 4. Objetos agarrables (Vasijas, Rocas)
            if (!promptShown && typeof grabbables !== 'undefined' && this.grabbedObject === null) {
                for (const g of grabbables) {
                    if (this.mesh.position.distanceToSquared(g.position) < 9.0) {
                        window.uiManager.showInteractionPrompt('Levantar');
                        promptShown = true;
                        break;
                    }
                }
            }
            
            // 5. Máquinas de Guardado (Payphones)
            if (!promptShown && typeof payphones !== 'undefined') {
                for (const p of payphones) {
                    if (this.mesh.position.distanceToSquared(p.mesh.position) < 9.0) {
                        window.uiManager.showInteractionPrompt('Guardar');
                        promptShown = true;
                        break;
                    }
                }
            }
            
            // Ocultar si nada cerca
            if (!promptShown) window.uiManager.hideInteractionPrompt();
        }

        // === RE4 #5: PERFECT DODGE WINDOW DECREMENT ===
        if (this.perfectDodgeWindow > 0) this.perfectDodgeWindow -= delta;
        
        // Gestión de Daño e Invulnerabilidad
        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer -= delta;
            // Titilar rojo intermitente (I-Frames)
            this.alebrije.visible = Math.floor(this.invulnerableTimer * 15) % 2 === 0;
        } else {
            this.alebrije.visible = true; // Volver a lo normal
        }
        
        if (this.coyoteTimer > 0) this.coyoteTimer -= delta;
        if (this.diveCooldown > 0) this.diveCooldown -= delta;
        if (this.wallRunTimer > 0) {
            this.wallRunTimer -= delta;
            if (this.wallRunTimer <= 0) this.isWallRunning = false;
        }
        
        // === RE4 DIVE ROLL TIMER (I-Frames por duración) ===
        if (this.isDiving) {
            this.diveTimer -= delta;
            this.invulnerableTimer = Math.max(this.invulnerableTimer, this.diveTimer);
            if (this.diveTimer <= 0) {
                this.isDiving = false;
                this.diveTimer = 0;
            }
        }
        
        // === LEDGE GRAB: Detectar Borde Mientras Cae ===
        if (!this.isLedgeGrabbing && !this.onGround && this.velocity.y < -1.0 && (this.keys.w || this.keys.a || this.keys.d || this.keys.s)) {
            // Raycast horizontal al frente para detectar pared
            const grabDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
            const grabRay = new THREE.Raycaster(
                new THREE.Vector3(this.mesh.position.x, this.mesh.position.y + 1.6, this.mesh.position.z),
                grabDir, 0, 1.0
            );
            const grabHits = grabRay.intersectObjects(collidables);
            
            if (grabHits.length > 0) {
                // Segundo rayo justo arriba del punto para detectar si hay espacio libre encima (= es borde)
                const aboveRay = new THREE.Raycaster(
                    new THREE.Vector3(grabHits[0].point.x, grabHits[0].point.y + 0.2, grabHits[0].point.z),
                    new THREE.Vector3(0, 1, 0), 0, 0.5
                );
                const aboveHits = aboveRay.intersectObjects(collidables);
                
                if (aboveHits.length === 0) {
                    // Es un borde libre: ENGANCHE
                    this.isLedgeGrabbing = true;
                    this.velocity.y = 0;
                    this.currentVelocity.set(0, 0, 0);
                    this.ledgeGrabSurface = grabHits[0].face ? grabHits[0].face.normal.clone().transformDirection(grabHits[0].object.matrixWorld).normalize() : null;
                    this.ledgeGrabTimer = 0.0;
                    // Snap al borde
                    const edgePoint = grabHits[0].point;
                    this.mesh.position.x = edgePoint.x - grabDir.x * 0.6;
                    this.mesh.position.z = edgePoint.z - grabDir.z * 0.6;
                    this.mesh.position.y = edgePoint.y - 1.6;
                    if(this.vfxManager) this.vfxManager.createDustPuff(edgePoint, 4);
                    playLandSound();
                }
            }
        }
        
        // === LEDGE GRAB: Comportamiento mientras colgado ===
        if (this.isLedgeGrabbing) {
            this.velocity.y = 0;
            this.currentVelocity.set(0, 0, 0);
            this.onGround = false;
            this.ledgeGrabTimer += delta;
            
            if (this.keys.space) {
                // Pull-up al borde (Trepar)
                this.isLedgeGrabbing = false;
                const pullDir = this.ledgeGrabSurface ? this.ledgeGrabSurface.clone().negate() : new THREE.Vector3(0, 0, -1);
                this.mesh.position.y += 2.2; // Sobre el borde
                this.mesh.position.x += pullDir.x * 0.5;
                this.mesh.position.z += pullDir.z * 0.5;
                this.velocity.y = 3.0;
                this.onGround = false;
                playJumpSound();
            } else if (this.keys.s || this.ledgeGrabTimer > 2.5) {
                // Caída voluntaria o timeout
                this.isLedgeGrabbing = false;
                this.velocity.y = -2.0;
            }
        }

        // --- PARKOUR LINEAL Z-AXIS: POSTES ---
        if (this.isClimbingPole) {
            this.velocity.y = 0;
            this.currentVelocity.set(0,0,0);
            this.onGround = false;
            
            // Gravedad cero, desplazamiento puro Y
            if (this.keys.w) this.mesh.position.y += 4.0 * delta;
            else if (this.keys.s) this.mesh.position.y -= 4.0 * delta;
            
            // Límite Inferior/Superior
            if (this.poleObject) {
                const poleBot = this.poleObject.position.y - this.poleObject.geometry.parameters.height/2;
                if (this.mesh.position.y < poleBot) this.isClimbingPole = false;
            }
            
            // Soltarse con salto ninja lateral
            if (this.keys.space) {
                this.isClimbingPole = false;
                this.velocity.y = this.jumpForce * 0.9;
                const pushForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
                this.currentVelocity.x = pushForward.x * this.speed;
                this.currentVelocity.z = pushForward.z * this.speed;
                playJumpSound();
            }
            
            // Loop forzado
            if (this.mixer) {
                this.mixer.update(delta);
                this.playAnimation('idle'); // Idealmente 'climbing', usamos 'idle' de fallback
            }
            return;
        }

        // --- PARKOUR LINEAL Z-AXIS: MONKEY BARS ---
        if (this.isHanging) {
            this.velocity.y = 0;
            this.onGround = false;
            
            // Check si soltarse (Space = Caer)
            if (this.keys.space) {
                this.isHanging = false;
                this.velocity.y = -2.0;
            } else {
                // Validación para ver si sigo bajo el techo de los MonkeyBars:
                const upRay = new THREE.Raycaster(this.mesh.position, new THREE.Vector3(0, 1, 0), 0, 2.5);
                const hits = upRay.intersectObjects(collidables);
                if (hits.length === 0 || !hits[0].object.userData.isMonkeyBar) {
                    this.isHanging = false; // Te caíste al final del pasamanos
                }
            }
        }

        // --- Zonas de Agua (Swimming) ---
        let currentGravity = this.gravity;
        
        this.wasInWater = this.inWater;
        this.inWater = false;
        for (let i = 0; i < waterZones.length; i++) {
            if (waterZones[i].box.containsPoint(this.mesh.position)) {
                this.inWater = true;
                // === WATER DIRECTIONAL CURRENT (SM64) ===
                // Si la zona de agua tiene un vector de corriente definido, empruja al jugador
                if (waterZones[i].current) {
                    const cur = waterZones[i].current;
                    this.currentVelocity.x += cur.x * delta;
                    this.currentVelocity.z += cur.z * delta;
                    this.velocity.y += cur.y * delta; // Corriente ascendente / submarina
                }
                break;
            }
        }
        
        // Splash Effect
        if (this.inWater !== this.wasInWater) {
            playLandSound();
            if (this.vfxManager && this.vfxManager.createSplash) {
                this.vfxManager.createSplash(this.mesh.position, 25);
            } else if (this.vfxManager) {
                this.vfxManager.createDustPuff(this.mesh.position, 15);
            }
            this.velocity.y *= 0.5; // Reduce trancazo al entrar
        }
        
        // Físicas Acuaticas (Estilo Minecraft Puro)
        if (this.inWater) {
            currentGravity = -0.05; // Extrema Flotabilidad / Densidad hídrica
            this.velocity.y *= 0.90; // Amortiguación del agua agresiva
            
            this.onGround = false;
            this.canDash = true; // Se puede dashear submarinamente
            this.jumpCount = 0;
            this.isWallRunning = false;
            this.isGliding = false;
            
            // Translación de Boyancia (Rise/Sink)
            if (this.keys.space) this.velocity.y += 20.0 * delta;
            if (this.keys.shift) this.velocity.y -= 20.0 * delta;
            
            // Sistema de Oxígeno
            this.oxygen -= delta;
            if (this.oxygen <= 0) {
                this.drownTimer -= delta;
                if (this.drownTimer <= 0) {
                    this.takeDamage(this.mesh.position); // Daño ahogamiento
                    this.drownTimer = 1.5; // Daño continuo cada 1.5s
                    // Burbujas letales (VFX placeholder)
                    if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 10);
                }
            }
            window.dispatchEvent(new CustomEvent('oxygenUpdate', { detail: { oxygen: Math.max(0, this.oxygen) } }));
        } else {
            if (this.oxygen < 10.0) {
                this.oxygen = 10.0;
                window.dispatchEvent(new CustomEvent('oxygenUpdate', { detail: { oxygen: 10.0 } }));
            }
            this.drownTimer = 0.0;
        }

        // === SM64: LAVA ZONES — Knockback Explosivo + Daño ===
        this.inLava = false;
        for (let i = 0; i < lavaZones.length; i++) {
            if (lavaZones[i].box.containsPoint(this.mesh.position)) {
                this.inLava = true;
                if (this.invulnerableTimer <= 0) {
                    // Knockback hacia arriba brutal (estilo SM64 al tocar lava)
                    this.velocity.y = 22.0;
                    // Dirección horizontal aleatoria desde el centro de la zona
                    const lavaPush = new THREE.Vector3(
                        (Math.random() - 0.5) * 18,
                        0,
                        (Math.random() - 0.5) * 18
                    );
                    this.currentVelocity.add(lavaPush);
                    this.onGround = false;
                    // Daño + I-Frames
                    this.takeDamage(this.mesh.position.clone().add(new THREE.Vector3(0, -1, 0)));
                    // VFX de Lava (Chispas naranjas + Polvo)
                    if (this.vfxManager) {
                        this.vfxManager.createSparks(this.mesh.position, 20);
                        this.vfxManager.createDustPuff(this.mesh.position, 8);
                    }
                    window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.4, intensity: 1.8 } }));
                }
                break;
            }
        }

        // === SM64: QUICKSAND / LODO — Hundimiento Gradual ===
        this.inQuicksand = false;
        for (let i = 0; i < quicksandZones.length; i++) {
            if (quicksandZones[i].box.containsPoint(this.mesh.position)) {
                this.inQuicksand = true;
                const sinkRate = quicksandZones[i].sinkRate || 1.5;
                // Reducir velocidad horizontal drásticamente (el lodo frenó tu ímpetu)
                this.currentVelocity.x *= 0.88;
                this.currentVelocity.z *= 0.88;
                // Hundir gradualmente ignorando el Raycaster de piso
                if (this.onGround) {
                    this.mesh.position.y -= sinkRate * delta;
                }
                // Muerte por asfixia si cruza el umbral inferior de la zona
                const qBox = quicksandZones[i].box;
                if (this.mesh.position.y < qBox.min.y - 1.5) {
                    this.takeDamage(this.mesh.position);
                    this.hp -= 2; // La asfixia es brutal
                    // Respawn sobre el borde superior de la arena
                    this.mesh.position.y = qBox.max.y + 1.0;
                    this.velocity.y = 8.0;
                    this.onGround = false;
                    if (this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 20);
                }
                // Saltar te saca — permite usar ESPACIO para escapar con costo de stamina
                if (this.keys.space && this.onGround) {
                    this.velocity.y = this.jumpForce * 0.85;
                    this.onGround = false;
                }
                break;
            }
        }


        if (this.isWallRunning && !this.inWater) {
            currentGravity = -2.0; // Gravity suspension during wall run
            if (this.keys.space) {
                // Wall Jump Action!
                this.velocity.y = this.jumpForce * 1.2;
                this.isWallRunning = false;
                this.wallRunTimer = 0.0;
                
                this.currentVelocity.x *= -1.5;
                this.currentVelocity.z *= -1.5; // Repulsión violenta
                
                if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 15);
                playDoubleJumpSound();
            }
        } else if (!this.keys.space && this.velocity.y > 0) {
            currentGravity *= 2.5; // Corte de salto
        }
        
        // --- AERODINÁMICA PARAVELA (Vuelo Zelda) ---
        if (this.isGliding && !this.inWater) {
            this.gliderStamina -= delta;
            if (this.gliderStamina <= 0) {
                this.isGliding = false;
                playLandSound(); // Audio "Fallo de stamina"
            } else {
                currentGravity = 0; // Suspensión térmica total
                // Velocidad paracaídas estabilizada, pero cae a 3m/s constante
                this.velocity.y = Math.max(this.velocity.y - (3.0 * delta), -3.0); 
                if (this.vfxManager && Math.random() < 0.05) this.vfxManager.createDustPuff(this.mesh.position, 1);
            }
        }
        
        this.velocity.y += currentGravity * delta;
        
        // --- Volúmenes de Fuerza Externa (Viento/Agua) ---
        for (let i = 0; i < windZones.length; i++) {
            if (windZones[i].box.containsPoint(this.mesh.position)) {
                this.velocity.y += windZones[i].force.y * delta;
                this.currentVelocity.x += windZones[i].force.x * delta;
                this.currentVelocity.z += windZones[i].force.z * delta;
                this.onGround = false; // Pierde fricción terrestre
                if (this.vfxManager && Math.random() < 0.1) this.vfxManager.createDustPuff(this.mesh.position, 1);
            }
        }
        
        // Movement relative to camera's forward vector
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();
        
        const moveDir = new THREE.Vector3();
        if (this.keys.w) moveDir.add(forward);
        if (this.keys.s) moveDir.sub(forward);
        if (this.keys.a) moveDir.sub(right);
        if (this.keys.d) moveDir.add(right);
        
        let targetSpeedX = 0;
        let targetSpeedZ = 0;

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            
            let baseSpeed = this.speed;
            if (this.carriedObject && this.carriedObject.userData.isMassive) baseSpeed *= 0.70;
            
            // === RE4 #4: COMBAT STANCE SPEED PENALTY ===
            // Inmediatamente después de un ataque (aimTimer activo), reducir velocidad a 30%
            // Simula el peso cinestésico de sostener el arma (RE4 no te deja correr apuntando).
            if (this.aimTimer > 0) {
                this.aimTimer -= delta;
                baseSpeed *= 0.30; // 70% lentitud — igual que en RE4 con la escopeta
                this.isAiming = true;
            } else {
                this.isAiming = false;
            }
            
            // === RE4 #2: INERTIA BRAKE DISTANCE (180° Turn) ===
            // Si el jugador invierte dirección abruptamente, aplicar fuerza de freno
            // antes de que la velocidad cambie de signo — evita el giro cartoon instantáneo.
            const velDir = new THREE.Vector3(this.currentVelocity.x, 0, this.currentVelocity.z).normalize();
            const dotDir = velDir.dot(moveDir); // 1 = misma dir, -1 = opuesto, 0 = perpendicular
            if (dotDir < -0.3 && this.currentVelocity.lengthSq() > 4.0) {
                // Frenar proporcional a la velocidad actual antes de redirigir
                const brakeForce = 1.0 - THREE.MathUtils.clamp((dotDir + 0.3) / -0.7, 0, 1) * 0.8;
                this.currentVelocity.x *= brakeForce;
                this.currentVelocity.z *= brakeForce;
            }
            this.lastMoveDir.copy(moveDir);
            
            const speedModifier = this.isSliding ? 0.1 : 1.0;
            targetSpeedX = moveDir.x * baseSpeed * speedModifier;
            targetSpeedZ = moveDir.z * baseSpeed * speedModifier;
            
            // --- RAYCAST PARA CHOQUES Y PARKOUR ---
            const hRayDir = moveDir.clone();
            const sweepY = this.mesh.position.y + 0.5;
            const rayDist = Math.max(0.7, this.currentVelocity.length() * delta + 0.6);

            // Consulta SpatialGrid O(k) para candidatos horizontales
            // Solo las celdas vecinas al jugador — no todo el nivel
            const nearH = spatialGrid.queryArray(
                this.mesh.position.x, this.mesh.position.z, 1
            );

            // Reconfigurar raycasters globales (sin new, sin GC)
            _rayOriginH.set(this.mesh.position.x, sweepY, this.mesh.position.z);
            _rayOriginHH.set(this.mesh.position.x, sweepY + 1.2, this.mesh.position.z);

            _hRay.set(_rayOriginH, hRayDir);
            _hRay.near = 0; _hRay.far = rayDist;

            _hRayHigh.set(_rayOriginHH, hRayDir);
            _hRayHigh.near = 0; _hRayHigh.far = rayDist;

            const hitsLow  = nearH.length > 0 ? _hRay.intersectObjects(nearH)     : [];
            const hitsHigh = nearH.length > 0 ? _hRayHigh.intersectObjects(nearH) : [];

            if (hitsLow.length > 0) {
                const hit = hitsLow[0];
                
                // ENGANCHE A POSTES
                if (hit.object.userData.isPole) {
                    this.isClimbingPole = true;
                    this.poleObject = hit.object;
                    // Snap Perfecto
                    this.mesh.position.x = hit.object.position.x;
                    this.mesh.position.z = hit.object.position.z;
                    if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 5);
                }
                
                // 1. AUTO LEDGE VAULT (Choque bajo pero cielo libre: Escalar)
                if (hitsHigh.length === 0 && this.velocity.y > -20.0 && !this.isWallRunning) {
                    this.velocity.y = this.jumpForce * 0.8; // Auparse solido
                    if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 5);
                }
                // 2. WALL RUN (Ángulo oblicuo a gran velocidad sin piso)
                else if (!this.onGround && this.currentVelocity.lengthSq() > 25 && hit.face) {
                    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                    normal.y = 0; normal.normalize();
                    
                    const dot = moveDir.dot(normal);
                    
                    if (dot > -0.8 && dot < -0.2) {
                        this.isWallRunning = true;
                        this.wallRunTimer = 0.6; // Segundos de Flow
                        
                        const crossDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), normal).normalize();
                        if (moveDir.dot(crossDir) < 0) crossDir.negate();
                        
                        targetSpeedX = crossDir.x * this.speed * 1.5;
                        targetSpeedZ = crossDir.z * this.speed * 1.5;
                        if (this.velocity.y < 0) this.velocity.y = 0; // Frena caída en seco
                        
                        // Alinear modelo al Wall Run
                        const alignTarget = this.mesh.position.clone().add(crossDir);
                        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(this.mesh.position, alignTarget, new THREE.Vector3(0, 1, 0)));
                        this.mesh.quaternion.slerp(q, 15 * delta);
                        
                        if(this.vfxManager && Math.random() < 0.2) this.vfxManager.createDustPuff(this.mesh.position, 2);
                    } else {
                        // === PS2 #1: WALL SLIDING (Contact Normal Deflection) ===
                        // En vez de frenar en seco, proyectamos la velocidad sobre el plano de la pared.
                        // El jugador SIGUE MOVIÉNDOSE a lo largo del muro en vez de pegarse como mosca.
                        if (hit.face) {
                            const wallNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                            wallNormal.y = 0; wallNormal.normalize();
                            // Proyección: quitar la componente paralela al muro, conservar la tangente
                            const dot = this.currentVelocity.dot(wallNormal);
                            if (dot < 0) { // Solo si vamos HACIA el muro
                                this.currentVelocity.x -= wallNormal.x * dot;
                                this.currentVelocity.z -= wallNormal.z * dot;
                                targetSpeedX = this.currentVelocity.x;
                                targetSpeedZ = this.currentVelocity.z;
                            }
                        } else {
                            targetSpeedX = 0; targetSpeedZ = 0;
                            this.currentVelocity.x = 0; this.currentVelocity.z = 0;
                        }
                        this.isWallRunning = false;
                    }
                } else {
                    // === PS2 #1: WALL SLIDING CASO 2 (Choque frontal sin normal de Wall Run) ===
                    if (hit.face) {
                        const wallNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                        wallNormal.y = 0; wallNormal.normalize();
                        const dot = this.currentVelocity.dot(wallNormal);
                        if (dot < 0) {
                            this.currentVelocity.x -= wallNormal.x * dot;
                            this.currentVelocity.z -= wallNormal.z * dot;
                            targetSpeedX = this.currentVelocity.x;
                            targetSpeedZ = this.currentVelocity.z;
                        }
                    } else {
                        targetSpeedX = 0; targetSpeedZ = 0;
                        this.currentVelocity.x = 0; this.currentVelocity.z = 0;
                    }
                    this.isWallRunning = false;
                }
            } else {
                this.isWallRunning = false;
                // === PS2 #5: ANGULAR SPEED CURVE (Velocity-based turn rate) ===
                // A alta velocidad el personaje tiene un radio de giro mayor (más realista).
                // A baja velocidad gira rápido y preciso (maniobra de precisión).
                // La curva es: turnRate = lerpf(maxTurn, minTurn, saturate(speed / speedCap))
                const horizSpeed = this.currentVelocity.length();
                const speedCap = this.speed * 2.0;   // Velocidad a la que el giro está al mínimo
                const t = Math.min(horizSpeed / speedCap, 1.0); // [0,1] normalizado
                const turnRate = THREE.MathUtils.lerp(12.0, 4.0, t); // 12 = giro brusco lento, 4 = arco suave rápido
                
                const targetPos = this.mesh.position.clone().add(moveDir);
                const q = new THREE.Quaternion().setFromRotationMatrix(
                    new THREE.Matrix4().lookAt(this.mesh.position, targetPos, new THREE.Vector3(0, 1, 0))
                );
                this.mesh.quaternion.slerp(q, turnRate * delta);
            }
        }
        
        if (this.thrownObjects.length > 0) this.updateThrows(delta);

        // Aplica Lerp a la velocidad horizontal para inercia/fricción suave
        // === PS2 UPGRADE: Static/Kinetic Friction Model ===
        // En física real, friction estática es ~1.3x la cinética.
        // Si la velocidad está por debajo del umbral estático, la fuerza se opone a 100%.
        // Si está en movimiento, aplicamos el coeficiente cinético (que SIEMPRE < estático).
        const staticFrictionThreshold = 0.5; // m/s — velocidad mínima para mantenerse "pegado"
        
        let localFriction;
        switch (this.currentFloorSurface) {
            case 'ice':      localFriction = 0.4;  break; // Jelly-smooth ice
            case 'mud':      localFriction = 28.0; break; // Alto desgaste
            case 'electric': localFriction = 6.0;  break; // Tembloroso
            default:         localFriction = 8.0;  break;
        }
        // i-frames de Dive Roll: friccion forzada a baja para conservar el impulso
        if (this.isDiving) localFriction = 1.0;
        if (this.isSliding) localFriction = 0.5;
        
        // En el agua la friccion es tremenda (1.5)
        // === PS2 #3: AIR CONTROL VELOCITY CURVE ===
        // A mayor velocidad horizontal en el aire, MENOS control direccional.
        // Simula la inercia de un cuerpo en movimiento (no puedes girar como un avión a 40 km/h).
        // Curva: airControl = lerp(maxAirCtrl, minAirCtrl, saturate(horizSpeed / horizCap))
        let airControl;
        if (!this.onGround && !this.inWater) {
            const horizSpd = Math.hypot(this.currentVelocity.x, this.currentVelocity.z);
            const airT = Math.min(horizSpd / (this.speed * 2.5), 1.0);
            airControl = THREE.MathUtils.lerp(4.5, 1.2, airT); // 4.5 (control normal) → 1.2 (casi glacial)
        } else {
            airControl = 3.0; // No aplica en suelo/agua
        }
        const accel = this.inWater ? 1.5 : (this.onGround ? localFriction : airControl);
        
        if (!this.isSliding) {
             const swiftX = this.inWater ? targetSpeedX * 0.45 : targetSpeedX;
             const swiftZ = this.inWater ? targetSpeedZ * 0.45 : targetSpeedZ;
             
             this.currentVelocity.x += (swiftX - this.currentVelocity.x) * accel * delta;
             this.currentVelocity.z += (swiftZ - this.currentVelocity.z) * accel * delta;
        }
        
        // === PS2 #2: CCD SUB-STEPPING (Prevención de Tunneling a Alta Velocidad) ===
        // Si la velocidad horizontal supera el doble del radio del personaje en un frame,
        // dividimos el área en 2 sub-pasos para que nunca 'atraviese' un muro delgado.
        const horizMag = Math.hypot(this.currentVelocity.x, this.currentVelocity.z);
        const CAPSULE_DIAM = 0.70; // Diámetro de la cápsula
        const subSteps = (horizMag * delta > CAPSULE_DIAM) ? 2 : 1;
        const subDelta = delta / subSteps;
        for (let _s = 0; _s < subSteps; _s++) {
            this.mesh.position.x += this.currentVelocity.x * subDelta;
            this.mesh.position.z += this.currentVelocity.z * subDelta;
        }
        
        // === RE4 2004 #6: CHARACTER-CHARACTER DEPENETRATION ===
        // Solucionador cinemático O(n) simple: empuja al jugador suavemente fuera 
        // del volumen de los enemigos si están overlapping (cápsula vs cilindro).
        if (this.enemyManagerRef && this.enemyManagerRef.enemies) {
            const PUSH_RADIUSD_SQ = 1.0; // Distancia al cuadrado (1.0m de separación)
            for (const enemy of this.enemyManagerRef.enemies) {
                // Chequeo rápido de altura para ignorar voladores muy altos
                if (Math.abs(enemy.position.y - this.mesh.position.y) > 2.0) continue;
                
                const dx = this.mesh.position.x - enemy.position.x;
                const dz = this.mesh.position.z - enemy.position.z;
                const distSq = dx*dx + dz*dz;
                
                if (distSq > 0.001 && distSq < PUSH_RADIUSD_SQ) {
                    const dist = Math.sqrt(distSq);
                    const overlap = 1.0 - dist;
                    // Empujar al jugador afuera (resolución suave 50% por frame para no rebotar feo)
                    this.mesh.position.x += (dx / dist) * overlap * 0.5;
                    this.mesh.position.z += (dz / dist) * overlap * 0.5;
                }
            }
        }
        
        // === PS2 UPGRADE: VELOCITY VERLET GRAVITY ===
        // Euler: pos += v * dt  (error O(dt)  — energización artificial)
        // Verlet: pos += v * dt + 0.5 * a * dt²  (error O(dt²) — conserva energía correctamente)
        // Resultado: Saltos predecibles y curvas perfectas sin correcciones manuales de 'jumpForce'
        const gravityAccel = this._prevGravity ?? this.gravity;
        const halfDtSqGrav = 0.5 * gravityAccel * delta * delta;
        let nextY = this.mesh.position.y + this.velocity.y * delta + halfDtSqGrav;
        this._prevGravity = this.gravity; // Guardar acel del frame actual para el próximo frame

        // Consulta SpatialGrid O(k): solo objetos en la celda actual + vecinas
        const nearDown = spatialGrid.queryArray(
            this.mesh.position.x, this.mesh.position.z, 1
        );
        const downCandidates = nearDown.length > 0 ? nearDown : collidables;

        // === PS2 UPGRADE: 3-POINT CAPSULE GROUND SWEEP ===
        // En vez de un solo rayo central, disparamos 3 puntos en la base de la cápsula:
        //   Centro  (detecta piso bajo los pies)
        //   Izq/Der (detecta bordes laterales, evita 'caer a través' de esquinas angostas)
        //   Frontal  (detecta escalones en la dirección de movimiento para vault predictivo)
        // Los 3 hits se consensan: se toma el groundY MÁS ALTO (conservador, anti-tunneling)
        const sweepO = new THREE.Vector3(
            this.mesh.position.x,
            Math.max(this.mesh.position.y + 1.0, nextY + 1.0),
            this.mesh.position.z
        );
        const capsuleRadius = 0.35; // Radio real de la cápsula del Alebrije
        const fwdN = new THREE.Vector3(this.currentVelocity.x, 0, this.currentVelocity.z).normalize();
        const rightN = new THREE.Vector3(-fwdN.z, 0, fwdN.x); // Perpendicular en XZ

        // Rayo Central
        _downRay.set(sweepO, new THREE.Vector3(0, -1, 0));
        // Rayo Izquierdo
        _downRayL.set(sweepO.clone().addScaledVector(rightN, -capsuleRadius), new THREE.Vector3(0,-1,0));
        // Rayo Derecho
        _downRayR.set(sweepO.clone().addScaledVector(rightN,  capsuleRadius), new THREE.Vector3(0,-1,0));
        // Rayo Frontal (solo si hay movimiento, para vault predictivo)
        const hasMoveInput = this.currentVelocity.lengthSq() > 0.5;
        if (hasMoveInput) _downRayFwd.set(sweepO.clone().addScaledVector(fwdN, capsuleRadius), new THREE.Vector3(0,-1,0));

        const hitsC   = _downRay.intersectObjects(downCandidates);
        const hitsL   = _downRayL.intersectObjects(downCandidates);
        const hitsR   = _downRayR.intersectObjects(downCandidates);
        const hitsFwd = hasMoveInput ? _downRayFwd.intersectObjects(downCandidates) : [];

        // Consenso: tomamos el hit más cercano (groundY más alto) entre los 4 rayos
        // Prioridad: Centro > Frontal > Laterales (evita falsos positivos en muros)
        const allHits = [hitsC, hitsFwd, hitsL, hitsR];
        let bestHit = null;
        for (const hits of allHits) {
            if (hits.length > 0) {
                if (!bestHit || hits[0].point.y > bestHit.point.y) {
                    bestHit = hits[0];
                }
            }
        }
        const groundHits = hitsC; // Mantener referencia central para compatibilidad con código existente
        
        let foundGround = false;
        let groundY = -999;
        let isOnSlope = false;
        let slopeNormal = null;
        
        // Usar bestHit del capsuleS weep si hay un consenso más alto que el rayo central
        const primaryHit = bestHit || (groundHits.length > 0 ? groundHits[0] : null);
        
        if (primaryHit) {
            groundY = primaryHit.point.y;
            foundGround = true;
            
            // Detector de Modificadores (Agente de Físicas)
            if (primaryHit.object.userData.isIce) this.currentFloorSurface = 'ice';
            else if (primaryHit.object.userData.isLava) this.currentFloorSurface = 'lava';
            else if (primaryHit.object.userData.isMud) this.currentFloorSurface = 'mud';
            else if (primaryHit.object.userData.isElectric) this.currentFloorSurface = 'electric';
            else this.currentFloorSurface = 'normal';
            
            if (primaryHit.face) {
                const rawNormal = primaryHit.face.normal.clone()
                    .transformDirection(primaryHit.object.matrixWorld).normalize();
                
                // === PS2: CONTACT NORMAL RING BUFFER SMOOTHING ===
                // Almacenar normal en el buffer circular y promediar los últimos 3 frames
                // Eliminamos el jitter en rampas largas y plataformas rotadas
                _normalBuffer[_normalBufferIdx].copy(rawNormal);
                _normalBufferIdx = (_normalBufferIdx + 1) % 3;
                _smoothNormal.set(
                    (_normalBuffer[0].x + _normalBuffer[1].x + _normalBuffer[2].x) / 3,
                    (_normalBuffer[0].y + _normalBuffer[1].y + _normalBuffer[2].y) / 3,
                    (_normalBuffer[0].z + _normalBuffer[1].z + _normalBuffer[2].z) / 3
                ).normalize();
                slopeNormal = _smoothNormal;
                
                const slopeAngle = Math.acos(Math.min(1, slopeNormal.y));
                if (slopeAngle > 0.785) isOnSlope = true;
            }
        }

        if (foundGround && nextY <= groundY) {
            
            // ===== LAVA BOUNCE DESTRUCTIVO =====
            if (this.currentFloorSurface === 'lava') {
                this.velocity.y = this.jumpForce * 1.5; // Yiiihaa!
                this.onGround = false;
                this.isSliding = false;
                this.takeDamage(this.mesh.position);
                if(this.vfxManager) this.vfxManager.createSplash(this.mesh.position, 15);
                playDoubleJumpSound(); // Re-utilizamos audio para el quemón
                
                // Knockback radial y cámara temblando
                this.currentVelocity.x = (Math.random() - 0.5) * 40;
                this.currentVelocity.z = (Math.random() - 0.5) * 40;
                window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.5, intensity: 2.0 } }));
                
                // Sobrescribe el 'y' pero lo tiramos p'arriba inercialmente
                nextY = groundY + 0.1;
            } else {
                // Comportamiento de Aterrizaje Normal
                
                // Fricción sobre Plataformas Móviles (Player arrastrado cinemáticamente)
                if (groundHits[0].object.userData.isMoving) {
                    const deltaPos = groundHits[0].object.userData.deltaPos;
                    if (deltaPos) this.mesh.position.add(deltaPos);
                }
                
                // === SLOPE ACCUMULATED MOMENTUM (SM64) ===
                if (isOnSlope) {
                    this.slopeSpeedAccum = Math.min(this.slopeSpeedAccum + 6.0 * delta, 25.0);
                } else if (this.slopeSpeedAccum > 1.0) {
                    const slopeDir = new THREE.Vector3(this.currentVelocity.x, 0, this.currentVelocity.z).normalize();
                    this.currentVelocity.x += slopeDir.x * this.slopeSpeedAccum;
                    this.currentVelocity.z += slopeDir.z * this.slopeSpeedAccum;
                    this.slopeSpeedAccum = 0.0;
                }
                
                // === PS2 #4: GROUND ADHESION FORCE ===
                // Al correr sobre rampa a alta velocidad, aplica fuerza perpendicular
                // al piso para que el personaje no rebote en descensos continuos.
                if (slopeNormal && this.onGround) {
                    const horizSpd = Math.hypot(this.currentVelocity.x, this.currentVelocity.z);
                    if (horizSpd > 3.0) {
                        const adhesionStrength = THREE.MathUtils.clamp(horizSpd * 0.6, 0, 18.0);
                        this.velocity.y = Math.min(this.velocity.y, -slopeNormal.y * adhesionStrength);
                    }
                }
            
            if (isOnSlope) {
                this.isSliding = true;
                this.onGround = true;
                this.canDash = false;
                
                const gravityStrength = 40.0 * delta; 
                this.currentVelocity.x += slopeNormal.x * gravityStrength;
                this.currentVelocity.z += slopeNormal.z * gravityStrength;
                
                nextY = groundY;
                this.velocity.y = 0;
            } else {
                this.isSliding = false;
                // EVENTO DE ATERRIZAJE (LANDING)
                if (!this.wasOnGround) {
                    // === GROUND POUND AREA SHOCKWAVE (SM64) ===
                    if (this.isGroundPounding) {
                        this.isGroundPounding = false;
                        window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.5, intensity: 3.0 } }));
                        if (this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 30);
                        playLandSound();
                        // Aturdir a todos los enemigos en radio de 5u
                        if (this.enemyManagerRef) {
                            for (const e of this.enemyManagerRef.enemies) {
                                if (e.userData.state !== 'DEAD') {
                                    const dSq = e.position.distanceToSquared(this.mesh.position);
                                    if (dSq < 25.0) {
                                        this.enemyManagerRef.hitEnemy(e, this.mesh.position, false);
                                    }
                                }
                            }
                        }
                    }
                    playLandSound();
                    if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 12);
                    
                    // Mapear Animación de Impacto Severo (Ground Pound y Caídas Duras)
                    if (this.velocity.y < -20.0) {
                        this.playAnimation('hard_landing', 0.1);
                        // Cinematic Camera Shake Fuerte (Game Feel)
                        window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.3, intensity: 1.5 } }));
                        
                        // INTERACCIÓN: Aplastar el WaterSwitch (Activar Mareas)
                        const hitObj = groundHits[0].object;
                        waterSwitches.forEach(ws => {
                            if (ws.mesh === hitObj) {
                                ws.isActivated = true;
                                playLandSound(); // Extra crunchy sound
                            }
                        });
                    } else if (this.velocity.y < -10.0) {
                        // Shake Pequeño
                        window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.15, intensity: 0.4 } }));
                    }
                }
                
                // Toca plataforma (o escalón de pirámide)
                nextY = groundY;
                
                // ELECTRIC SURFACE: daño periódico + sacudida muscular
                if (this.currentFloorSurface === 'electric') {
                    this.electricTimer -= (1.0 / 60.0); // Aproximación de delta sólido
                    if (this.electricTimer <= 0) {
                        this.electricTimer = 1.0; // 1 segundo entre pulsos
                        this.takeDamage(this.mesh.position);
                        // Sacudida aleatoria tipo paresia muscular
                        this.currentVelocity.x += (Math.random() - 0.5) * 12;
                        this.currentVelocity.z += (Math.random() - 0.5) * 12;
                        this.velocity.y = 4.0;
                        window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.3, intensity: 1.5 } }));
                        if (this.vfxManager) this.vfxManager.createSparks(this.mesh.position, 15);
                    }
                } else {
                    this.electricTimer = 0; // Reset al salir de la zona
                }
                
                // === FOOTSTEP DIFERENCIAL POR SUPERFICIE (RE4 Style) ===
                this.footstepTimer -= (1.0 / 60.0);
                const isMovingHoriz = this.currentVelocity.lengthSq() > 1.0;
                if (this.onGround && isMovingHoriz && this.footstepTimer <= 0) {
                    const surfaceToMaterial = {
                        ice: 'stone', lava: 'dirt', mud: 'water',
                        electric: 'dirt', normal: 'dirt'
                    };
                    playFootstep(surfaceToMaterial[this.currentFloorSurface] || 'dirt');
                    // Intervalo de paso — más rápido al correr
                    const spd = this.currentVelocity.length();
                    this.footstepTimer = spd > 8 ? 0.22 : 0.35;
                }
                
                // ARENA MOVEDIZA (Lodo Asfixiante) Death Trigger
                if (this.currentFloorSurface === 'mud') {
                     nextY -= 1.25 * delta; // Modifica el Eje Y para hundir al alebrije
                     // Si el personaje se hunde 1.5 mts de profundidad desde la capa visual, muere sofocado
                     if (groundY - this.mesh.position.y > 1.4) {
                         this.hp = 0;
                         this.takeDamage(this.mesh.position);
                         this.velocity.y = 8.0; // Lo escupe muerto
                     }
                }
                
                this.velocity.y = 0;
                this.onGround = true;
                this.coyoteTimer = 0.15;
                this.canDash = true;
                this.isGliding = false;
                this.gliderStamina = 3.0; // Recarga de Batería de Vuelo Zelda al tocar tierra
                
                // Inherit moving platform velocity (Rieles Mágicos)
                if (hit.object.userData.isMoving && hit.object.userData.deltaPos) {
                    this.mesh.position.add(hit.object.userData.deltaPos);
                }
            }
            }
        } else {
            // Sigue cayendo al vacío o saltando
            this.isSliding = false;
            this.onGround = false;
            // Si pasamos mucho tiempo en el aire, se resetea el combo de triple salto
            if (Date.now() - this.lastJumpTime > 800) this.jumpCount = 0;
        }
        
        this.wasOnGround = this.onGround;
        this.mesh.position.y = nextY;
        
        // --- COLISIÓN DE TECHO (SQUISH MECHANIC & MONKEY BARS) ---
        const upRay = new THREE.Raycaster(
            this.mesh.position,
            new THREE.Vector3(0, 1, 0),
            0, 2.3 // Radio virtual de Brazos extendidos hacia arriba para captar Mono
        );
        const ceilingHits = upRay.intersectObjects(collidables);
        
        if (ceilingHits.length > 0) {
            // MONKEY BARS
            if (ceilingHits[0].object.userData.isMonkeyBar && this.keys.space && this.velocity.y >= 0 && !this.onGround) {
                 this.isHanging = true;
                 this.mesh.position.y = ceilingHits[0].point.y - 1.8; // Colgado debajo a buena distancia
                 this.velocity.y = 0;
                 if(this.vfxManager) this.vfxManager.createDustPuff(ceilingHits[0].point, 3);
            }
            // SQUISH NORMAL (Si no es Monkey bar y saltamos de frente)
            else if (this.velocity.y > 0 && !this.isHanging) {
            // Chocamos la cabeza subiendo (Bonk vertical)
            this.velocity.y = -5.0; // Rebote hacia abajo
            playLandSound();
            if (this.vfxManager) this.vfxManager.createDustPuff(ceilingHits[0].point, 3);
        }
        }
        
        // SQUISH CHECK si estamos atorados entre techo desciente y piso estático (o viceversa)
        if (ceilingHits.length > 0 && foundGround) {
            const ceilDist = ceilingHits[0].distance;
            const floorDist = this.mesh.position.y - groundY;
            
            // Distancia total atrapada < Altitud humana mínima
            if (ceilDist + floorDist < 1.0 && this.hp > 0) {
                // SQUISHED!
                this.takeDamage(this.mesh.position); 
                this.hp -= 2; // Castigo brutal extra por aplastamiento
                
                // Camera Shake Extremo!
                window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.6, intensity: 3.0 } }));

                // Efecto visual grotesco de panqueque (Acordeón Y)
                this.mesh.scale.set(2.0, 0.1, 2.0);
                
                // Expulsado a los lados como semilla de limón
                this.currentVelocity.x = (Math.random() - 0.5) * 50;
                this.currentVelocity.z = (Math.random() - 0.5) * 50;
                this.velocity.y = 5.0;
                this.onGround = false;
                
                playLandSound();
                if (this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 20);
                
                // Si sobrevive, restauramos el modelo al segundo
                setTimeout(() => {
                    this.mesh.scale.set(1, 1, 1);
                }, 1000);
            }
        }
        
        // Muerte rápida por caída infinita en el abismo dimensional de las Chinampas
        if (this.mesh.position.y < -15) {
            this.hp = 0;
            window.dispatchEvent(new CustomEvent('playerHurt', { detail: { hp: this.hp } }));
            window.dispatchEvent(new CustomEvent('gameOver'));
            this.mesh.position.set(0, 5, 0); // Respawn arriba de todo
            this.velocity.set(0, 0, 0);
        }

        // --- ACTUALIZACIÓN DE BLOB SHADOW ---
        if (foundGround) {
            this.blobShadow.position.copy(groundHits[0].point);
            this.blobShadow.position.y += 0.05; // Prevenir Z-Fighting
            
            // Alinear sombra con la normal de pisos inclinados
            this.blobShadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), groundHits[0].face.normal);
            
            // Atenuamos la sombra según qué tan alto estemos volando
            const heightDiff = this.mesh.position.y - groundHits[0].point.y;
            this.blobShadow.material.opacity = Math.max(0, 1.0 - heightDiff / 15.0);
        } else {
            this.blobShadow.material.opacity = 0;
        }

        // --- Mapeo de Transiciones Animadas (GLTF vs Procedural) ---
        // --- Mapeo de Transiciones Animadas Avanzadas (State Machine GLTF Native) ---
        const time = this.clock.getElapsedTime();
        const isRunning = moveDir.lengthSq() > 0;
        
        if (this.mixer) {
            // Se sincroniza esqueleto y pesajes musculares (Bones)
            this.mixer.update(delta);
            
            let animState = 'idle';
            if (this.inWater) {
                animState = isRunning ? 'run' : (this.velocity.y > 0 ? 'jump' : 'swim');
            } else if (this.isWallRunning) {
                animState = 'dive'; // Wallslide / Dive
            } else if (this.isSliding) {
                animState = 'dive'; // Ocupamos la animación de Dive como 'Resbaladilla'
            } else if (!this.onGround) {
                // Aire
                if (!this.canDash) {
                    animState = 'dive'; // Símbolo AirDash Consumido
                } else if (this.velocity.y < -15.0) {
                    animState = 'pound'; // Caída libre masiva / Ground Pound
                } else {
                    animState = 'jump';
                }
            } else if (isRunning && !this.isSliding) {
                animState = 'run';
            }
            
            // Evitar pisar la animación 'hard_landing' a menos que haya pasado un momento o ya empiece a caminar
            if (this.currentActionName !== 'hard_landing' || this.velocity.lengthSq() > 2) {
                this.playAnimation(animState);
            }
            
            // === RE4 TORSO PITCH IK ===
            // We apply bone rotations AFTER the AnimationMixer evaluates the frame.
            this._applyTorsoIK();
        }
        
        // --- Escaneo Volumétrico de Portales Dimensionales (Nivel) ---
        if (!window.levelManager || !window.levelManager.isTransitioning) {
            // Inicializar Cooldown Timer si no existe
            if (this._portalCooldown === undefined) this._portalCooldown = 0;
            if (this._portalCooldown > 0) this._portalCooldown -= delta;

            if (this._portalCooldown <= 0) {
                const playerBox = new THREE.Box3().setFromCenterAndSize(
                    new THREE.Vector3(this.mesh.position.x, this.mesh.position.y + 1, this.mesh.position.z),
                    new THREE.Vector3(1.5, 2.5, 1.5) // Hitbox un poco grande para facilitar entrada
                );
                
                // PORTALES DINÁMICOS (NEXT-GEN)
                if (this.weaponManager && this.weaponManager.activePortals) {
                    const portalsLinked = this.weaponManager.activePortals;
                    if (portalsLinked[0] && portalsLinked[1]) {
                        // Check intersection con alguno de los dos
                        for (let i = 0; i < 2; i++) {
                            const pSource = portalsLinked[i];
                            const destType = i === 0 ? 1 : 0;
                            const pDest = portalsLinked[destType];
                            
                            const pBox = new THREE.Box3().setFromObject(pSource);
                            if (playerBox.intersectsBox(pBox)) {
                                // PREVENCIÓN DE LOOP INFINITO: Añadir Enfriamiento Físico
                                this._portalCooldown = 1.0; // 1 segundo de cooldown
                                
                                // Trasladar jugador a la salida
                                const exitNorm = pDest.userData.normal;
                                
                                // 1. Posición base (Sacarlo volando de la pared, un metro afuera)
                                this.mesh.position.copy(pDest.position).addScaledVector(exitNorm, 2.5);
                                this.mesh.position.y -= 1.0; // Ajustar pies a la altura del anillo
                                
                                // 2. Preservación y Transformación del Vector Cinemático (MOMENTUM)
                                const totalSpeed = Math.hypot(this.currentVelocity.x, this.currentVelocity.z, this.velocity.y);
                                const exitMag = Math.max(totalSpeed, 15.0); // Mínimo impulso de salida
                                
                                this.currentVelocity.x = exitNorm.x * exitMag;
                                this.currentVelocity.z = exitNorm.z * exitMag;
                                
                                // Si la pared proyecta hacia arriba (piso), inyectar energía a la gravedad en 'y'
                                if (exitNorm.y > 0.5) {
                                      this.velocity.y = exitMag * exitNorm.y;
                                } else {
                                      this.velocity.y = Math.max(5.0, exitMag * exitNorm.y);
                                }
                                
                                this.onGround = false;
                                window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.3, intensity: 2.0 } }));
                                playLandSound();
                                
                                // Destrucción Condicional: Si el nivel dicta portales de un solo uso
                                const ast = window.levelManager.currentAST;
                                if (ast && ast.metadata && ast.metadata.portalMode === 'single_use') {
                                    this.weaponManager.scene.remove(pSource);
                                    this.weaponManager.scene.remove(pDest);
                                    portalsLinked[0] = null;
                                    portalsLinked[1] = null;
                                }
                                
                                break;
                            }
                        }
                    }
                }
            }
            
            for (let i = 0; i < portals.length; i++) {
                if (playerBox.intersectsBox(portals[i].box)) {
                    if (window.levelManager) {
                        window.levelManager.transitionTo(portals[i].target);
                    }
                    break;
                }
            }
        }
    }

    // === CAMERA HEAD-BOB DATA BRIDGE ===
    // Exposes runtime state to mesh.userData so camera.js can read
    // speed and onGround without a circular import.
    _syncCameraData() {
        if (!this.mesh) return;
        this.mesh.userData._currentVelocity = this.currentVelocity;
        this.mesh.userData._onGround        = this.onGround;
        this.mesh.userData._inWater         = this.inWater;
    }

    // === RE4 TORSO PITCH IK ===
    _applyTorsoIK() {
        if (!window.thirdPersonCamera) return;
        
        const camPitch = window.thirdPersonCamera.pitch;
        // Only apply strong bend if aiming, otherwise gentle bend
        const aimMult = window.thirdPersonCamera.isAiming ? 1.0 : 0.4;
        const targetAngle = camPitch * aimMult;

        if (this.spineBone) {
            // GLTF Skeleton
            // Smooth interpolation to avoid snapping when exiting aim
            const currentX = this.spineBone.rotation.x;
            this.spineBone.rotation.x = THREE.MathUtils.lerp(currentX, currentX + targetAngle, 0.2);
        } else if (this.alebrije && this.alebrije.userData.parts) {
            // Procedural Alebrije Fallback
            const body = this.alebrije.userData.parts.bodyGroup;
            const head = this.alebrije.userData.parts.headGroup;
            const targetLean = targetAngle * 0.8;
            body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, targetLean, 0.2);
            head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetLean * 1.2, 0.2);
        }
    }

    // Motor Interno de CrossFading para GLTF
    playAnimation(name, crossFadeTime = 0.2) {
        if (!this.mixer || !this.animations[name]) return;
        if (this.currentActionName === name) return; // Previene reinicios
        
        const nextAction = this.animations[name];
        const prevAction = this.animations[this.currentActionName];
        
        nextAction.reset();
        
        // Loop Settings para Acrobacias
        if (name === 'jump' || name === 'dive' || name === 'pound' || name === 'hard_landing') {
            nextAction.setLoop(THREE.LoopOnce);
            nextAction.clampWhenFinished = true; // Se queda congelado al final del frame en el aire
        } else {
            nextAction.setLoop(THREE.LoopRepeat);
        }
        
        nextAction.play();
        
        if (prevAction) {
            nextAction.crossFadeFrom(prevAction, crossFadeTime, true);
        }
        
        this.currentActionName = name;
    }
    
    // Métodos para Interacción Extema (Enemies / Entorno)
    bounce(force = 15) {
        this.velocity.y = force;
        this.onGround = false;
        // Restaurar dashes y coyotes en el aire para combos acrobáticos extremos
        this.canDash = true; 
        this.jumpCount = 1; // Permite saltar de nuevo desde la cabeza de un enemigo
    }
    
    /**
     * takeDamage(sourcePos, hitType)
     * hitType: 'frontal' | 'back' | 'side' | 'sweep' | 'ranged'
     * === RE4 2004 #1: DIRECTIONAL KNOCKBACK ===
     * Cada tipo de golpe tiene una respuesta física distinta:
     *   frontal  → impulso hacia atrás + elevación   (bala/lanza frontal)
     *   back     → caída hacia adelante + giro 180°  (golpe por la espalda)
     *   side     → impulso lateral + stumble          (barrido)
     *   sweep    → knockdown completo (vy forzada abajo)
     *   ranged   → impulso recibido en dirección del proyectil, vy mínimo
     */
    takeDamage(sourcePos, hitType = 'frontal') {
        // === RE4 #5: PERFECT DODGE TIMING WINDOW ===
        // Si la ventana de perfect dodge está activa (66ms = 4 frames), negar daño
        // y aplicar i-frames 2x más largos + cámara slow-mo flash.
        if (this.perfectDodgeWindow > 0) {
            this.invulnerableTimer = 3.0; // I-frames dobles (bonus de habilidad)
            window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.1, intensity: 0.3 } }));
            return; // Daño negado — Perfect Dodge
        }
        
        if (this.invulnerableTimer > 0) return;
        
        this.hp -= 1;
        this.invulnerableTimer = 1.5;
        window.dispatchEvent(new CustomEvent('playerHurt', { detail: { hp: this.hp } }));
        
        // Dirección base del impacto (desde la fuente al jugador)
        const knock = new THREE.Vector3().subVectors(this.mesh.position, sourcePos);
        knock.y = 0;
        if (knock.lengthSq() < 0.001) knock.set(0, 0, 1); // Fallback: empujar hacia +Z si overlap
        knock.normalize();
        
        // Clasificar dirección de impacto respecto al forward del player
        const playerFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        const impactDot = playerFwd.dot(knock); // +1=espalda, -1=frontal, 0=lateral
        
        // === RESPUESTA DIFERENCIADA POR TIPO DE HIT (RE4 2004) ===
        switch (hitType) {
            case 'back':
                // Golpe en la espalda: caída hacia adelante, giro forzado
                this.currentVelocity.x = playerFwd.x * -20;
                this.currentVelocity.z = playerFwd.z * -20;
                this.velocity.y = 5;
                this.mesh.rotation.y += Math.PI; // Spin 180°
                break;
            case 'side':
                // Barrido lateral: impulso 90° + vy mínimo (stumble, no vuelo)
                const sideDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), knock);
                this.currentVelocity.x = sideDir.x * 18;
                this.currentVelocity.z = sideDir.z * 18;
                this.velocity.y = 4;
                break;
            case 'sweep':
                // Knockdown: el jugador cae al piso (vy negativo fuerte)
                this.currentVelocity.x = knock.x * 10;
                this.currentVelocity.z = knock.z * 10;
                this.velocity.y = -5; // Empujado hacia el suelo
                this.onGround = false;
                break;
            case 'ranged':
                // Proyectil: impulso en dirección de la bala, elevación mínima
                this.currentVelocity.x = knock.x * 15;
                this.currentVelocity.z = knock.z * 15;
                this.velocity.y = 3; // Sacudida leve, no vuelo total
                break;
            default: // 'frontal'
                this.currentVelocity.x = knock.x * 25;
                this.currentVelocity.z = knock.z * 25;
                this.velocity.y = 10;
                break;
        }
        
        this.onGround = false;
        playLandSound();
        const shakeIntensity = hitType === 'sweep' ? 2.0 : (hitType === 'ranged' ? 0.8 : 1.2);
        window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.4, intensity: shakeIntensity } }));
        if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 6);
        
        if (this.hp <= 0) {
            window.dispatchEvent(new CustomEvent('gameOver'));
            this.currentVelocity.set(0,0,0);
            this.speed = 0;
            this.jumpForce = 0;
        }
    }
    
    // --- LÓGICA DE AGARRE (GRAB & THROW) ---
    tryGrabOrThrow() {
        if (this.carriedObject) {
            // Lanza el objeto!
            const obj = this.carriedObject;
            this.mesh.remove(obj);
            
            // Re-anclar a la Escena Global preservando la Transformación de Mundo actual
            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);
            obj.position.copy(worldPos);
            obj.rotation.set(0,0,0); // Reset local rot
            this.sceneRef.add(obj);
            
            // Calcular vector parábola (Hacia adelante y hacia arriba)
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
            
            // Añadir momento lineal dependiente de la Masa
            const throwY = obj.userData.isMassive ? 6.0 : 15.0;
            const throwF = obj.userData.isMassive ? 15 : 25;
            obj.userData.velocity = new THREE.Vector3(
                (forward.x * throwF) + this.currentVelocity.x, 
                throwY, 
                (forward.z * throwF) + this.currentVelocity.z
            );
            
            this.thrownObjects.push(obj);
            this.carriedObject = null;
            
            // Animar Brazos
            this.playAnimation('pound', 0.1); 
            playJumpSound();
            
        } else {
            // Intentar Agarrar
            let closest = null;
            let minDist = 3.5; // Radio de búsqueda (Cercanía)
            
            for (let i = 0; i < grabbables.length; i++) {
                const item = grabbables[i];
                if (!item.parent || item.parent === this.mesh) continue; // Si ya esta cargado por algo mas
                
                const dx = item.position.x - this.mesh.position.x;
                const dy = item.position.y - this.mesh.position.y;
                const dz = item.position.z - this.mesh.position.z;
                const dist = Math.hypot(dx, dy, dz);
                
                if (dist < minDist) {
                    minDist = dist;
                    closest = item;
                }
            }
            
            if (closest) {
                // Acoplamiento Cinemático Binario (Bind to Player)
                if (closest.parent) closest.parent.remove(closest);
                this.mesh.add(closest);
                // Anclar justo arriba de la cabeza (Eje Y Local)
                closest.position.set(0, 3.5, 0); // Alto para la iguana
                this.carriedObject = closest;
                
                // Efectos gráficos Oomph!
                if(this.vfxManager) this.vfxManager.createDustPuff(this.mesh.position, 6);
                playLandSound();
            }
        }
    }
    
    updateThrows(dt) {
        for (let i = this.thrownObjects.length - 1; i >= 0; i--) {
            const obj = this.thrownObjects[i];
            const v = obj.userData.velocity;
            
            // Gravedad proyectil (Física independiente)
            v.y -= 50.0 * dt; 
            
            // Integración de Físicas
            obj.position.x += v.x * dt;
            obj.position.y += v.y * dt;
            obj.position.z += v.z * dt;
            
            // Rotación dramática aerodinámica en el aire
            obj.rotation.x += 10.0 * dt;
            obj.rotation.z += 8.0 * dt;
            
            // Colisión destructiva contra terreno bajo (Fast collision Check sin raycaster por rendimiento)
            const downRay = new THREE.Raycaster(obj.position, new THREE.Vector3(0, -1, 0), 0, 1.0);
            const hits = downRay.intersectObjects(collidables);
            
            if (obj.position.y <= -5 || hits.length > 0) { 
                // CRASH!
                this.sceneRef.remove(obj);
                
                // === BOSS FIGHT DAMAGE BRIDGE ===
                // Avisar al BossManager/EnemyManager sobre el impacto AoE
                window.dispatchEvent(new CustomEvent('heavyProjectileHit', { 
                    detail: { 
                        position: obj.position.clone(), 
                        isMassive: obj.userData.isMassive === true 
                    } 
                }));

                if(this.vfxManager) {
                    this.vfxManager.createDustPuff(obj.position, 30);
                }
                playLandSound();
                playLandSound(); // Doble Impacto explosivo
                
                // Recompensa Si es una vasija
                if (obj.userData.propType === 'pot') {
                     window.dispatchEvent(new CustomEvent('coinCollected')); 
                }
                
                this.thrownObjects.splice(i, 1);
            }
        }
    }
}
