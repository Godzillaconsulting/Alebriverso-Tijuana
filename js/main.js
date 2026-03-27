import * as THREE from 'three';
import LevelLoader from './levels/LevelLoader.js';
import GeometryBuilder from './levels/GeometryBuilder.js';
import WebGLRenderer from './renderer/WebGLRenderer.js';
import AudioManager from './audio/AudioManager.js';
import MissionManager from './systems/MissionManager.js';
import HealthUI from './systems/HealthUI.js';
import PuzzleManager from './systems/PuzzleManager.js';
import EnemyAI from './systems/EnemyAI.js';
import CheckpointManager from './systems/CheckpointManager.js';
import ProjectileManager from './systems/ProjectileManager.js';
import PlayerController from './engine/PlayerController.js';
import CameraManager from './engine/CameraManager.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import VFXManager from './engine/VFXManager.js';
import MaterialManager from './renderer/MaterialManager.js';

// ── Nuevos sistemas de objetos (Especialista en Lógica de Juego) ─────────────
import { Collectible } from './objects/Collectible.js';
import { Enemy }       from './objects/Enemy.js';
import { MovingPlatform, PlatformMode } from './objects/MovingPlatform.js';
import { ScoreSystem } from './systems/ScoreSystem.js';

// Assets 3D Modulares (Three.js Graph Nodes)
import { createProtagonist, createEnemy } from '../src/models/modularCharacters.js';

async function initGame() {
    console.log("[Engine] Inicializando Core Three.js...");

    const loader = new LevelLoader();
    const geomBuilder = new GeometryBuilder();
    const rendererSystem = new WebGLRenderer('gameCanvas');
    const scene = rendererSystem.getScene();
    
    let audioManager = null;
    let vfxManager = null;
    let player = null;
    let protagonistNode = null;
    const enemyNodes = [];

    document.getElementById('btnStart').addEventListener('click', async () => {
        document.getElementById('overlay').style.display = 'none';
        
        audioManager = new AudioManager();
        vfxManager = new VFXManager();

        // Precarga de AudioBuffers Reales (Fallback silencioso a procedural si no existen)
        await audioManager.loadSound('jump', 'assets/audio/mario_jump.wav', 'sfx');
        await audioManager.loadSound('coin', 'assets/audio/coin_pickup.wav', 'sfx');
        await audioManager.loadSound('thud', 'assets/audio/heavy_punch.wav', 'sfx');
        await audioManager.loadSound('level1_theme', 'assets/audio/bob_omb_battlefield.mp3', 'bgm');

        console.log("[Engine] Construyendo mundo 3D...");
        const levelData = await loader.fetchLevelData('levels/level1.json');
        const levelSceneData = loader.loadLevel(levelData);

        // 1. Geometría (Separación Estática vs Kinemática vs Puzzles)
        const staticPlatforms = [];
        const movingPlatforms = [];
        levelSceneData.platforms.forEach(p => {
            if (p.isCheckpoint) {
                p.meshNode = geomBuilder.buildPlatformNode(p);
                scene.add(p.meshNode);
                window.checkpointManager.registerCheckpoint(p);
                staticPlatforms.push(p);
            } else if (p.isSwitch) {
                p.meshNode = geomBuilder.buildPlatformNode(p);
                scene.add(p.meshNode);
                window.puzzleManager.registerSwitch(p);
                staticPlatforms.push(p);
            } else if (p.isDoor) {
                p.meshNode = geomBuilder.buildPlatformNode(p);
                scene.add(p.meshNode);
                window.puzzleManager.registerDoor(p);
                staticPlatforms.push(p);
            } else if (p.movement) {
                p.originalPos = { ...p.position };
                p.timer = 0;
                p.velocity = { x: 0, y: 0, z: 0 };
                
                // ── Construir con el nuevo MovingPlatform PS2-quality ─────
                const endPos = (() => {
                    const o = p.position;
                    const d = p.movement.distance;
                    if (p.movement.axis === 'x') return new THREE.Vector3(o.x + d, o.y, o.z);
                    if (p.movement.axis === 'y') return new THREE.Vector3(o.x, o.y + d, o.z);
                    return new THREE.Vector3(o.x, o.y, o.z + d);
                })();

                const mpInst = new MovingPlatform(scene, {
                    position:    new THREE.Vector3(p.position.x, p.position.y, p.position.z),
                    endPosition: endPos,
                    size:        { x: p.size.width, y: p.size.height, z: p.size.depth },
                    color:       parseInt(p.color?.replace('#', '0x') ?? '0x3d3d3d', 16),
                    speed:       p.movement.speed ?? 2.5,
                    mode:        PlatformMode.LINEAR
                });
                // Guardar referencia al new mesh para Physics.js (reemplaza meshNode)
                p.mpInstance = mpInst;
                p.meshNode   = mpInst.mesh; // Compat. con sistema de Physics
                movingPlatforms.push(p);
            } else {
                staticPlatforms.push(p);
            }
        });

        const staticGroup = geomBuilder.buildSceneStaticGeometry(staticPlatforms);
        scene.add(staticGroup);
        window.sceneStaticGroup = staticGroup; // API global para Motor de Raycasting de Físicas


        // 2. Jugador (Protagonista Modular)
        // Set scale proportion to 1.2
        protagonistNode = createProtagonist({
            tunic: 0xD0BA90,
            loincloth: 0xAD5B34,
            detail: 0x3BB1A1
        }, 1.2); 
        scene.add(protagonistNode);

        // 3. Enemigos y Entidades Destructibles
        for (const foe of levelSceneData.enemies) {
            let enemyNode;
            
            if (foe.type === 'pot') {
                const potGeo = new THREE.CylinderGeometry(0.8, 0.6, 2.0, 16);
                const potMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
                enemyNode = new THREE.Mesh(potGeo, potMat);
                enemyNode.castShadow = true;
                enemyNode.receiveShadow = true;
            } else {
                // Reemplazamos temporalmente al goomba estático por nuestro Jaguar (enemigo modular)
                enemyNode = createEnemy('jaguar');
            }
            
            enemyNode.position.set(foe.position.x, foe.position.y, foe.position.z);
            scene.add(enemyNode);
            enemyNodes.push(enemyNode);
        }

        // 4. Coleccionables — Fragmentos de Obsidiana (+ Cajas de Cacao Legacy)
        const collectibles = [];     // Meshes legacy para checkeo manual
        const obsidianInstances = []; // Instancias de la nueva clase Collectible

        for (const col of levelSceneData.collectibles) {
            if (col.type === 'obsidian') {
                // Nueva clase con IA de recoleccion propias
                const inst = new Collectible(
                    scene,
                    new THREE.Vector3(col.position.x, col.position.y, col.position.z),
                    window.scoreSystem,
                    vfxManager
                );
                obsidianInstances.push(inst);
            } else if (col.type === 'coin' || col.type === 'cacao') {
                // Mantener sistema heredado de granos de cacao
                const cacaoGeo = new THREE.CapsuleGeometry(0.5, 0.8, 8, 16);
                const cacaoMat = new THREE.MeshStandardMaterial({ color: 0x4A2511, roughness: 0.9 });
                const mesh = new THREE.Mesh(cacaoGeo, cacaoMat);
                mesh.position.set(col.position.x, col.position.y + 1, col.position.z);
                mesh.castShadow = true;
                scene.add(mesh);
                collectibles.push(mesh);
            }
            // Stars se manejan por MissionManager separadamente
        }

        // 5. Soporte para Modelo 3D Animado Esquelético
        let playerMixer = null;
        let animationsMap = {};
        let activeActionName = '';

        // Activar sombras dinámicas forzadas para el protagonista modular
        if (protagonistNode) {
            protagonistNode.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }

        const gltfLoader = new GLTFLoader();
        gltfLoader.load('assets/models/character.glb', (gltf) => {
            console.log("[Engine] GLTF Esquelético Cargado Exitosamente.");
            // Ocultar modelo retro (Placeholder modular) ya que tenemos uno real con huesos
            if (protagonistNode) protagonistNode.visible = false;
            
            const model = gltf.scene;
            // Escalar y ajustar asumiendo offsets de modelos estándar
            model.scale.set(1.5, 1.5, 1.5);
            
            // Re-procesar todos los materiales del modelo importado hacia Cel-Shading
            model.traverse((child) => {
                if (child.isMesh) {
                    MaterialManager.applyToonShading(child);
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(model);
            
            // Reemplazar el proxy visual por el modelo dinámico real
            protagonistNode = model;
            
            playerMixer = new THREE.AnimationMixer(model);
            
            // Mapeo dinámico de animaciones infiriendo nombres comunes (minúsculas)
            gltf.animations.forEach(clip => {
                animationsMap[clip.name.toLowerCase()] = playerMixer.clipAction(clip);
            });
            
            if(animationsMap['idle']) {
                animationsMap['idle'].play();
                activeActionName = 'idle';
            }
        }, undefined, (error) => {
            // Error silencioso esperado si no has metido el archivo .glb aún
            console.warn("[Engine] No se detectó 'assets/models/character.glb'. Operando con malla retro/modular.");
        });

        scene.add(vfxManager.getMesh());

        // Inyectamos Gestores de UI Globales y Lógica
        window.missionManager = new MissionManager(levelSceneData);
        window.healthUI = new HealthUI();
        window.puzzleManager = new PuzzleManager(audioManager);
        window.enemyAI = new EnemyAI();
        window.checkpointManager = new CheckpointManager();
        window.projectileManager = new ProjectileManager(scene);
        window.scoreSystem = new ScoreSystem();

        // Instanciar enemigos como IA RE4 usando el archivo Enemy.js
        const enemyInstances = [];
        for (const foe of levelSceneData.enemies) {
            if (foe.type === 'goomba') {
                const e = new Enemy(
                    scene,
                    new THREE.Vector3(foe.position.x, foe.position.y, foe.position.z),
                    { spriteType: foe.spriteType ?? 'jaguar', enemyType: foe.enemyType ?? 'MELEE' },
                    window.scoreSystem
                );
                enemyInstances.push(e);
            }
        }
        window.enemyInstances = enemyInstances;

        // ── Proyectiles de enemigos RANGED ──────────────────────────────────────────
        // RE4: el Ganado Ballesta lanza virotes. Nosotros: dardo de obsidiana.
        const rangedProjectiles = [];
        window.addEventListener('enemy:fireProjectile', (ev) => {
            const { position, direction, speed, damage } = ev.detail;
            const pGeo = new THREE.SphereGeometry(0.18, 6, 6);
            const pMat = new THREE.MeshStandardMaterial({
                color:    0x111111, metalness: 0.9, roughness: 0.05,
                emissive: 0x6600cc, emissiveIntensity: 1.2
            });
            const pMesh = new THREE.Mesh(pGeo, pMat);
            pMesh.position.copy(position);
            scene.add(pMesh);
            rangedProjectiles.push({ mesh: pMesh, dir: direction, speed, damage, age: 0 });
        });

        // Actualizar proyectiles RANGED en el game loop (se añade más abajo)
        window._rangedProjectiles = rangedProjectiles;

        // Escuchar evento de daño al jugador por enemigos
        window.addEventListener('enemyHitPlayer', (e) => {
            if (player && player.currentState !== player.STATES.HURT &&
                player.currentState !== player.STATES.DEAD && player.invulnTimer <= 0) {
                player.health -= e.detail.damage;
                player.currentState = player.STATES.HURT;
                player.invulnTimer = 1.5;
                if (window.healthUI) window.healthUI.update(player.health);
                if (vfxManager) vfxManager.emitSparks(player.x, player.y, player.z, 8);
                if (player.health <= 0) {
                    player.currentState = player.STATES.DEAD;
                    if (window.healthUI) window.healthUI.showDeathScreen();
                }
            }
        });

        // ── Espada de Obsidiana: recompensa al recolectar los 5 fragmentos ──────
        window.addEventListener('obsidianSwordUnlocked', () => {
            // Flag global que ProjectileManager ya monitorea para ampliar radio de Macuahuitl
            window._obsidianSwordActive = true;

            // Ampliar radio de golpe en el PlayerController legacy
            if (player && player.attackRadius !== undefined) {
                player.attackRadius = 7.0; // 4.5 → 7.0 metros
            }

            // Tintár el modelo del jugador con aura morada de Obsidiana
            if (protagonistNode) {
                protagonistNode.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material.emissive = new THREE.Color(0x4400aa);
                        child.material.emissiveIntensity = 0.6;
                    }
                });
            }

            // Anuncio de audio — reusa el sfx de "thud" como ruido de poder
            if (audioManager) audioManager.playThudSynthesized();

            console.log('[Main] ❤‍🔥 Espada de Obsidiana activa. Radio Macuahuitl: 7m');
        });

        // API Dinámica para Misiones Secretas
        window.spawnDynamicStar = function(id, missionName, px, py, pz) {
            levelSceneData.collectibles.push({ id: id, type: 'star', position: { x: px, y: py, z: pz } });
            
            const starGeo = new THREE.OctahedronGeometry(1.2, 0);
            const starMat = new THREE.MeshStandardMaterial({ 
                color: 0xFFD700, metalness: 1.0, roughness: 0.2, 
                emissive: 0xFFD700, emissiveIntensity: 0.5 
            });
            const mesh = new THREE.Mesh(starGeo, starMat);
            mesh.position.set(px, py, pz);
            scene.add(mesh);
            collectibles.push(mesh);
            
            window.missionManager.missions.push({ id: id, name: missionName, completed: false });
            window.missionManager.activeMissionIndex = window.missionManager.missions.length - 1;
            window.missionManager.showSplash();
            
            if (audioManager) audioManager.playCacaoSynthesized(); 
            if (vfxManager) vfxManager.emitSparks(px, py, pz, 100);
        };

        window.spawnDynamicCacao = function(px, py, pz) {
            levelSceneData.collectibles.push({ id: 'dyn_cacao_' + Date.now(), type: 'cacao', position: { x: px, y: py, z: pz } });
            const mesh = new THREE.Mesh(cacaoGeo, cacaoMat);
            mesh.position.set(px, py + 1.0, pz);
            mesh.castShadow = true;
            scene.add(mesh);
            collectibles.push(mesh);
        };

        player = new PlayerController(levelSceneData, audioManager, vfxManager);
        const cameraManager = new CameraManager(rendererSystem.getCamera(), rendererSystem.canvas);
        
        // Conectamos colisiones ambientales a la Cámara para Oclusión Mágica SM64
        cameraManager.setCollisionMeshes([staticGroup]);
        
        // Agregamos Zona de Cámara Fija (Prueba de Trigger)
        const testZoneBox = new THREE.Box3(
            new THREE.Vector3(10, 0, -30),
            new THREE.Vector3(30, 20, -10)
        );
        cameraManager.addZone({
            box: testZoneBox,
            cameraPos: new THREE.Vector3(40, 30, -40)
        });

        // Iniciar BGM Sinfónico del Nivel
        audioManager.playBGM('level1_theme');

        console.log("[Engine] Motores listos. Inicia Pipeline Main.");
        
        let lastTime = performance.now();
        
        function gameLoop(time) {
            const dt = Math.min((time - lastTime) / 1000.0, 0.1); 
            lastTime = time;

            // -- Plataformas Móviles: nueva clase PS2-quality + sync al sistema de Physics --
            movingPlatforms.forEach(p => {
                if (p.mpInstance) {
                    // Nueva ruta: deja que la clase maneje todo (posición, luz, ease, fricción)
                    p.mpInstance.update(dt, player);
                    // Sincronizar metadata de velocidad para Physics.js heredado
                    p.velocity.x = p.mpInstance.deltaPos.x / Math.max(dt, 0.001);
                    p.velocity.y = p.mpInstance.deltaPos.y / Math.max(dt, 0.001);
                    p.velocity.z = p.mpInstance.deltaPos.z / Math.max(dt, 0.001);
                    const np = p.mpInstance.mesh.position;
                    p.position.x = np.x; p.position.y = np.y; p.position.z = np.z;
                } else {
                    // Ruta legacy (plataformas que no tienen mpInstance)
                    p.timer += dt * p.movement.speed;
                    const offset  = Math.sin(p.timer) * p.movement.distance;
                    const vOffset = Math.cos(p.timer) * p.movement.speed * p.movement.distance;
                    p.velocity.x = 0; p.velocity.y = 0; p.velocity.z = 0;
                    if (p.movement.axis === 'x') { p.position.x = p.originalPos.x + offset; p.velocity.x = vOffset; }
                    else if (p.movement.axis === 'y') { p.position.y = p.originalPos.y + offset; p.velocity.y = vOffset; }
                    else { p.position.z = p.originalPos.z + offset; p.velocity.z = vOffset; }
                    p.meshNode.position.set(p.position.x, p.position.y, p.position.z);
                }
            });

            // -- Actualizar enemigos con IA RE4 --
            if (window.enemyInstances && player) {
                for (const e of window.enemyInstances) {
                    e.update(dt, player);
                }
            }

            // -- Proyectiles de enemigos RANGED (Guerrero Águila / Huitzilopochtli) --
            if (window._rangedProjectiles && player) {
                for (let i = window._rangedProjectiles.length - 1; i >= 0; i--) {
                    const rp = window._rangedProjectiles[i];
                    rp.age += dt;
                    rp.mesh.position.addScaledVector(rp.dir, rp.speed * dt);
                    // Chear si golpea al jugador
                    const pPos = player.mesh ? player.mesh.position
                        : new THREE.Vector3(player.x, player.y, player.z);
                    if (rp.mesh.position.distanceToSquared(pPos) < 2.5) {
                        window.dispatchEvent(new CustomEvent('enemyHitPlayer', { detail: { damage: rp.damage } }));
                        scene.remove(rp.mesh); rp.mesh.geometry.dispose(); rp.mesh.material.dispose();
                        window._rangedProjectiles.splice(i, 1);
                    } else if (rp.age > 4.0) {
                        scene.remove(rp.mesh); rp.mesh.geometry.dispose(); rp.mesh.material.dispose();
                        window._rangedProjectiles.splice(i, 1);
                    }
                }
            }

            // -- Actualizar Coleccionables de Obsidiana --
            if (player) {
                for (let i = obsidianInstances.length - 1; i >= 0; i--) {
                    obsidianInstances[i].update(dt, player);
                    if (!obsidianInstances[i].active) obsidianInstances.splice(i, 1);
                }
            }

            if (player && protagonistNode) {
                // -- Inteligencia Estratégica Computacional (Sistema Legado EnemyAI) --
                // Salta enemigos tipo 'goomba': ya los maneja Enemy.js RE4-style.
                if (window.enemyAI && levelSceneData.enemies) {
                    const legacyEnemies = levelSceneData.enemies.filter(e => e.type !== 'goomba');
                    const legacyNodes   = enemyNodes.filter((_, i) =>
                        levelSceneData.enemies[i]?.type !== 'goomba');
                    window.enemyAI.update(dt, legacyEnemies, legacyNodes, player);
                }
                if (window.checkpointManager) {
                    window.checkpointManager.update(player);
                }
                if (window.projectileManager) {
                    window.projectileManager.update(dt, levelSceneData.enemies, enemyNodes);
                }

                // Físicas y Lógica (Cámara Relativa)
                player.update(dt, cameraManager);
                
                // Actualizar Nodo 3D del Protagonista a la Posición Física
                protagonistNode.position.set(player.x, player.y + (player.radius/2), player.z);

                // Squah & Stretch Cosmético Temporal adaptado a escala del modelo
                const st = player.currentState;
                const speedMag = Math.hypot(player.momentumX, player.momentumZ);

                // Suavizar orientación del modelo 3D hacia el ángulo relacional analógico (+PI orienta la cara correctamente)
                if (speedMag > 0.1 && player.facingAngle !== undefined) {
                    const targetAngle = player.facingAngle + Math.PI;
                    const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
                    protagonistNode.quaternion.slerp(targetQuat, 12.0 * dt);
                }

                // Enrutador Principal: Estados SM64 -> Blend Tree Animations
                if (playerMixer) {
                    playerMixer.update(dt);
                    
                    const currentSpeedMag = Math.hypot(player.momentumX, player.momentumZ);
                    let targetAction = 'idle';
                    if (st === player.STATES.CELEBRATE) {
                        targetAction = 'celebrate'; 
                    } else if (st === player.STATES.HURT || st === player.STATES.LAVA_BURN || st === player.STATES.DEAD || st === player.STATES.BONK) {
                        targetAction = 'hurt';
                    } else if (st === player.STATES.SWIMMING) {
                        targetAction = 'swimming';
                    } else if (st === player.STATES.LEDGE_GRAB || st === player.STATES.POLE_CLIMBING) {
                        targetAction = 'ledge_grab';
                    } else if (st === player.STATES.MACUAHUITL_SWING || st === player.STATES.ATLATL_THROW || st === player.STATES.JUMP_KICK) {
                        targetAction = 'punch'; // Reusar animación ofensiva base
                    } else if (!player.isGrounded) {
                        if (st === player.STATES.DIVE || st === player.STATES.LONG_JUMP) targetAction = 'dive';
                        else if (st === player.STATES.GROUND_POUND) targetAction = 'pound';
                        else if (st === player.STATES.WALL_SLIDE) targetAction = 'wallslide';
                        else if (st === player.STATES.JUMP_KICK) targetAction = 'kick';
                        else targetAction = (player.vy > 0) ? 'jump' : 'fall'; 
                    } else {
                        if (st === player.STATES.CROUCHING) targetAction = 'crouch';
                        else if (st === player.STATES.DIVE) targetAction = 'slide'; 
                        else if (st === player.STATES.HARD_LANDING) targetAction = 'hard_landing';
                        else if (currentSpeedMag > 0.1) targetAction = 'run';
                        else targetAction = 'idle';
                    }
                    
                    // Si ocurre un cambio de estado válido, hacer Fade IN/OUT (Interpolación sin corte)
                    if (targetAction !== activeActionName && animationsMap[targetAction]) {
                        const currentAction = animationsMap[activeActionName];
                        const nextAction = animationsMap[targetAction];
                        if (currentAction) currentAction.fadeOut(0.2);
                        nextAction.reset().fadeIn(0.2).play();
                        activeActionName = targetAction;
                    }
                } else {
                    // Fallback Clásico: Deformation Scaling (Retro) cuando operamos sin animador de huesos
                    let pScaleX = 1.2;
                    let pScaleY = 1.2;
                    let pScaleZ = 1.2;
    
                    if (st === player.STATES.CROUCHING) {
                        pScaleY = 0.6; pScaleX = 1.6;
                    } else if (st === player.STATES.DIVE) {
                        pScaleY = 0.6; pScaleZ = 1.8; // Aún más elastiplano
                    } else if (st === player.STATES.LONG_JUMP) {
                        pScaleY = 0.8; pScaleZ = 1.8;
                    } else if (st === player.STATES.GROUND_POUND) {
                        pScaleY = 0.9; pScaleX = 1.5; pScaleZ = 1.5;
                    } else if (st === player.STATES.WALL_SLIDE) {
                        pScaleX = 0.8; pScaleY = 1.8;
                    }
                    
                    // Suavizar Squash & Stretch con Lerp (Bote elástico orgánico)
                    const targetScale = new THREE.Vector3(pScaleX, pScaleY, pScaleZ);
                    protagonistNode.scale.lerp(targetScale, 18.0 * dt);
                }

                // Rotación Visual de Malla Hacia Vector de Movimiento (Interpolación Esférica)
                if (player.facingAngle !== undefined && ![player.STATES.DEAD].includes(st)) {
                    const tQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.facingAngle);
                    protagonistNode.quaternion.slerp(tQuat, 12.0 * dt);
                }

                // Lógica de cámara Orbital Moderna vs Cinemática
                if (st === player.STATES.CELEBRATE) {
                    cameraManager.updateCelebration(dt, player);
                } else {
                    cameraManager.update(dt, player);
                }
                
                const camPos = rendererSystem.getCamera().position;
                audioManager.updateListenerPosition(camPos.x, camPos.y, camPos.z, 0, -0.3, -1);

                // Rotar coleccionables y levitación suave
                collectibles.forEach(c => {
                    c.rotation.z += 2 * dt;
                    // Mueve ligeramente en Y sin perder su altura base
                    c.position.y += Math.sin(time/200) * 0.01;
                });

                // Render Phase (Sin pasar cámara manual, manejado internamente)
                rendererSystem.renderFrame();
                
                if (vfxManager) {
                    vfxManager.update(dt, rendererSystem.getCamera());
                }

                // Sistemas de Puzzle y Eventos
                window.puzzleManager.update(dt);
                if (player.currentState === player.STATES.GROUND_POUND || player.currentState === player.STATES.HARD_LANDING) {
                    window.puzzleManager.checkGroundPound(player);
                }

                // Sincronización Lógica vs Gráfica (Eliminar visuales de Enemigos Derrotados)
                for (let i = levelSceneData.enemies.length - 1; i >= 0; i--) {
                    const foeData = levelSceneData.enemies[i];
                    if (foeData.isDead) {
                        const evtNode = enemyNodes[i];
                        if (evtNode) scene.remove(evtNode);
                        
                        // Sistema de Drop para Entidades Destructibles (Cacao)
                        if (foeData.type === 'pot') {
                            const cacaoGeoD = new THREE.CapsuleGeometry(0.5, 0.8, 8, 16);
                            const cacaoMatD = new THREE.MeshStandardMaterial({ color: 0x4A2511, roughness: 0.9, bumpScale: 0.05 });
                            const mesh = new THREE.Mesh(cacaoGeoD, cacaoMatD);
                            mesh.position.set(foeData.position.x, foeData.position.y + 1, foeData.position.z);
                            mesh.castShadow = true;
                            scene.add(mesh);
                            
                            collectibles.push(mesh);
                            levelSceneData.collectibles.push({
                                id: `dropped_cacao_${Math.floor(Math.random()*1000)}`,
                                type: 'cacao',
                                position: { x: foeData.position.x, y: foeData.position.y, z: foeData.position.z }
                            });
                        }

                        enemyNodes.splice(i, 1);
                        levelSceneData.enemies.splice(i, 1);
                    }
                }
            }

            requestAnimationFrame(gameLoop);
        }
        
        requestAnimationFrame(gameLoop);
    });
}
initGame();
