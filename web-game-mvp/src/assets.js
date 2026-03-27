import * as THREE from 'three';
import MaterialManager from './materialManager.js';
import { createTree, createTule, createRock, createTorch, createPot, createTeocalli } from './propBuilder.js';
import { spatialGrid } from './spatialHash.js';
import { ambientAudio } from './ambientAudio.js';


// --- Base Geometry Functions ---
export function createBox(width, height, depth, matOpts = {}) {
    // Si es agua, necesitamos más subdivisiones horizontales para que el Shader de Vértices tenga qué deformar.
    const wSegs = matOpts.shader === 'water' ? Math.max(1, Math.floor(width / 2)) : 1;
    const dSegs = matOpts.shader === 'water' ? Math.max(1, Math.floor(depth / 2)) : 1;
    const geometry = new THREE.BoxGeometry(width, height, depth, wSegs, 1, dSegs);
    
    const material = matOpts.shader 
        ? MaterialManager.getProceduralMaterial(matOpts.shader, matOpts.textureUrl, matOpts.repeat) 
        : MaterialManager.getMaterial(matOpts);
    
    // Rescatamos color explícito si es agua para que no todos los estanques sean del mismo azul
    if (matOpts.shader === 'water' && matOpts.color) material.color.setHex(matOpts.color);
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function createSphere(radius, matOpts = {}) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = MaterialManager.getMaterial(matOpts);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function createCylinder(radiusTop, radiusBottom, height, matOpts = {}) {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32);
    const material = MaterialManager.getMaterial(matOpts);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

// --- Level Creation ---
export const collidables = []; // Array central para motor de Físicas
export const portals = [];
export const grabbables = []; // Array de vasijas y rocas agarrables
export const windZones = [];
export const waterZones = [];
export const tiltPlatforms = [];
export const movingPlatforms = []; // Rieles vectoriales

// === SM64 ZONAS ESPECIALES ===
export const lavaZones    = []; // { box: Box3 } — Muerte instantánea / knockback violento
export const quicksandZones = []; // { box: Box3, sinkRate: float } — Hunde al jugador
export const poleObjects  = []; // THREE.Mesh con userData.isPole = true
export const hazardNodes  = []; // { mesh, type: 'pendulum'|'thwomp', params } — Objetos letales oscilantes
export const waterSwitches = []; // { mesh, triggered, timer } — Botón Blue-Coin Timer
export const npcs          = []; // NPC estáticos con diálogo (futuro)

export function clearLevelData() {
    collidables.length = 0;
    portals.length = 0;
    grabbables.length = 0;
    windZones.length = 0;
    waterZones.length = 0;
    tiltPlatforms.length = 0;
    movingPlatforms.length = 0;
    lavaZones.length = 0;
    quicksandZones.length = 0;
    poleObjects.length = 0;
    hazardNodes.length = 0;
    waterSwitches.length = 0;
    npcs.length = 0;
    spatialGrid.clear(); // Purgar SpatialHashGrid al cambiar de nivel
    ambientAudio.clear(); // Purgar triggers de audio ambiental
}

/**
 * addCollidable — Registra un mesh en AMBAS estructuras:
 *   1. Array plano (compatibilidad con Raycaster legacy)
 *   2. SpatialHashGrid (consultas O(1) por zona)
 * Usar SIEMPRE en lugar de collidables.push() directamente.
 */
export function addCollidable(mesh) {
    mesh.updateMatrixWorld(); // Asegurar que la BBox esté en espacio mundo
    collidables.push(mesh);
    spatialGrid.insert(mesh);
}

export async function loadLevelFromJson(scene, gameManager, player, enemyManager, bossManager, url, missionID = 1) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        console.log(`[LevelParser] Loading Level: ${data.name} - Mission: ${missionID}`);
        
        const checkMission = (item) => {
            if (item.reqMission !== undefined && item.reqMission !== missionID) return false;
            return true;
        };
        
        // 1. Player Spawn Setup
        if (data.playerSpawn && player) {
            player.mesh.position.set(data.playerSpawn.x, data.playerSpawn.y, data.playerSpawn.z);
            // Reset velocity just in case
            player.velocity.set(0, 0, 0); 
        }

        // 2. Skybox Estático o Fondo Sólido con Niebla (Para Dungeons)
        if (data.skybox) {
            const textureLoader = new THREE.TextureLoader();
            const skyTexture = textureLoader.load(data.skybox);
            skyTexture.mapping = THREE.EquirectangularReflectionMapping; 
            skyTexture.magFilter = THREE.NearestFilter;
            scene.background = skyTexture;
            scene.environment = skyTexture;
            scene.fog = new THREE.FogExp2(0x6495ED, 0.005); // Niebla ligera estándar
        } else if (data.background) {
            scene.background = new THREE.Color(data.background);
            scene.environment = null;
        }

        if (data.fog) {
            scene.fog = new THREE.FogExp2(data.fog.color, data.fog.density);
        }

        // 2B. Transiciones Invisibles (Portales)
        if (data.portals) {
            data.portals.forEach(pData => {
                const min = new THREE.Vector3(
                    pData.position.x - pData.size.width/2,
                    pData.position.y - pData.size.height/2,
                    pData.position.z - pData.size.depth/2
                );
                const max = new THREE.Vector3(
                    pData.position.x + pData.size.width/2,
                    pData.position.y + pData.size.height/2,
                    pData.position.z + pData.size.depth/2
                );
                portals.push({
                    box: new THREE.Box3(min, max),
                    target: pData.target
                });
            });
        }
        
        // 3. Construir Geometría Computacional Dinámica (Con Texturas Cíclicas)
        // Fusionar platforms + platforms_sm64_test para retrocompatibilidad con el JSON existente
        const allPlatforms = [
            ...(data.platforms || []),
            ...(data.platforms_sm64_test || [])
        ];
        if (allPlatforms.length > 0) {
            allPlatforms.filter(checkMission).forEach(plat => {
                
                // Volúmenes Acuáticos (Flotabilidad)
                if (plat.isWater) {
                    const min = new THREE.Vector3(
                        plat.position.x - plat.size.width/2,
                        plat.position.y - plat.size.height/2,
                        plat.position.z - plat.size.depth/2
                    );
                    const max = new THREE.Vector3(
                        plat.position.x + plat.size.width/2,
                        plat.position.y + plat.size.height/2,
                        plat.position.z + plat.size.depth/2
                    );
                    waterZones.push({
                        box: new THREE.Box3(min, max),
                        // Corriente Direccional Opcional (SM64 Water Current)
                        current: plat.waterCurrent ? { x: plat.waterCurrent.x || 0, y: plat.waterCurrent.y || 0, z: plat.waterCurrent.z || 0 } : null
                    });
                    
                    const matOpts = { 
                        color: plat.color || 0x00aaff, 
                        shader: 'water',
                        repeat: [plat.size.width / 4, plat.size.depth / 4] 
                    };
                    const mesh = createBox(plat.size.width, plat.size.height, plat.size.depth, matOpts);
                    mesh.position.set(plat.position.x, plat.position.y, plat.position.z);
                    mesh.castShadow = false;
                    mesh.receiveShadow = false;
                    scene.add(mesh);
                    return; // Retornamos para aislar el agua de collidables sólidos
                }

                // === LAVA (SM64) — Knockback + Daño ===
                if (plat.isLava) {
                    const min = new THREE.Vector3(
                        plat.position.x - plat.size.width/2,
                        plat.position.y - plat.size.height/2,
                        plat.position.z - plat.size.depth/2
                    );
                    const max = new THREE.Vector3(
                        plat.position.x + plat.size.width/2,
                        plat.position.y + plat.size.height/2,
                        plat.position.z + plat.size.depth/2
                    );
                    lavaZones.push({ box: new THREE.Box3(min, max) });
                    // Renderizar como lava visible
                    const mat = { color: plat.color || 0xff4400, shader: 'water', repeat: [2, 2] };
                    const mesh = createBox(plat.size.width, plat.size.height, plat.size.depth, mat);
                    mesh.position.set(plat.position.x, plat.position.y, plat.position.z);
                    mesh.castShadow = false;
                    scene.add(mesh);
                    return;
                }

                // === QUICKSAND / LODO (SM64) — Hundimiento gradual ===
                if (plat.isQuicksand) {
                    const min = new THREE.Vector3(
                        plat.position.x - plat.size.width/2,
                        plat.position.y - plat.size.height/2,
                        plat.position.z - plat.size.depth/2
                    );
                    const max = new THREE.Vector3(
                        plat.position.x + plat.size.width/2,
                        plat.position.y + plat.size.height/2,
                        plat.position.z + plat.size.depth/2
                    );
                    quicksandZones.push({ box: new THREE.Box3(min, max), sinkRate: plat.sinkRate || 1.5 });
                    const mat = { color: plat.color || 0xC2A060, roughness: 0.95 };
                    const mesh = createBox(plat.size.width, plat.size.height, plat.size.depth, mat);
                    mesh.position.set(plat.position.x, plat.position.y, plat.position.z);
                    scene.add(mesh);
                    return;
                }

                // Volúmenes Interactivos (Viento)
                if (plat.isWind) {
                    const min = new THREE.Vector3(
                        plat.position.x - plat.size.width/2,
                        plat.position.y - plat.size.height/2,
                        plat.position.z - plat.size.depth/2
                    );
                    const max = new THREE.Vector3(
                        plat.position.x + plat.size.width/2,
                        plat.position.y + plat.size.height/2,
                        plat.position.z + plat.size.depth/2
                    );
                    windZones.push({
                        box: new THREE.Box3(min, max),
                        force: plat.windForce || { x: 0, y: 25, z: 0 } // Por defecto Tornado Ascendente
                    });
                    
                    // VFX Telegrafiado
                    if (gameManager && gameManager.vfxManager) {
                        gameManager.vfxManager.registerWindZone(min, max, plat.windForce || { x: 0, y: 25, z: 0 });
                    }
                    
                    return; // No itera meshes
                }

                let mesh;
                if (plat.type === 'obsidian_mirror') {
                    // Adaptación del código PBR propuesto por el Usuario
                    mesh = createCylinder(plat.size?.radius || 15.0, plat.size?.radius || 15.0, plat.size?.height || 0.5, { color: 0x050505, roughness: 0.1, metalness: 0.95 });
                }
                else if (plat.type === 'box' || !plat.type) {
                    const matOpts = { 
                        color: plat.color, 
                        textureUrl: plat.texture || '', 
                        shader: plat.shader || null,
                        repeat: [plat.size.width / 4, plat.size.depth / 4] 
                    };
                    mesh = createBox(plat.size.width, plat.size.height, plat.size.depth, matOpts);
                } else if (plat.type === 'pole') {
                    const matOpts = { color: plat.color || 0x5c4033, roughness: 0.9 };
                    mesh = createCylinder(plat.radius || 0.5, plat.radius || 0.5, plat.height || 10, matOpts);
                    mesh.userData.isPole = true;
                } else if (plat.type === 'monkeybar') {
                    const matOpts = { color: plat.color || 0x888888, roughness: 0.6, metalness: 0.5 };
                    mesh = createBox(plat.size.width, 0.4, plat.size.depth, matOpts);
                    mesh.userData.isMonkeyBar = true;
                }
                
                if (mesh) {
                    mesh.position.set(plat.position.x, plat.position.y, plat.position.z);
                    scene.add(mesh);
                    // Registrar en el motor de físicas lineal Y en la partición espacial
                    collidables.push(mesh);
                    spatialGrid.insert(mesh);
                    
                    // Físicas de Terreno
                    if (plat.isIce) mesh.userData.isIce = true;
                    if (plat.isLava) mesh.userData.isLava = true;
                    if (plat.isMud) mesh.userData.isMud = true;
                    
                    if (plat.isTilt) {
                        // Geometría Dinámica Sensible a Masa Sensorial SM64
                        mesh.userData.tiltLimits = { x: 0.35, z: 0.35 }; 
                        tiltPlatforms.push(mesh);
                    }
                    
                    if (plat.isMoving) {
                        // Geometría sobre Rieles Lerpeados Lineales
                        mesh.userData = {
                            isMoving: true,
                            startPos: new THREE.Vector3(plat.position.x, plat.position.y, plat.position.z),
                            endPos: new THREE.Vector3(plat.endPos.x, plat.endPos.y, plat.endPos.z),
                            speed: plat.speed || 0.5,
                            progress: 0.0,
                            direction: 1,
                            deltaPos: new THREE.Vector3() // Integración pasiva al jugador
                        };
                        movingPlatforms.push(mesh);
                    }

                    // === Registrar Poste en array para que movement.js lo detecte ===
                    if (plat.type === 'pole') poleObjects.push(mesh);
                }

                // === HAZARDS OSCILANTES (Thwomps / Péndulos SM64) ===
                if (plat.type === 'thwomp' || plat.type === 'pendulum') {
                    const geo = plat.type === 'thwomp'
                        ? new THREE.BoxGeometry(plat.size?.width || 3, plat.size?.height || 3, plat.size?.depth || 1)
                        : new THREE.CylinderGeometry(0.3, 0.3, plat.length || 6, 8);
                    const mat = new THREE.MeshStandardMaterial({ color: plat.color || 0x555566, roughness: 0.8, metalness: 0.3 });
                    const hazardMesh = new THREE.Mesh(geo, mat);
                    hazardMesh.castShadow = true;
                    hazardMesh.position.set(plat.position.x, plat.position.y, plat.position.z);
                    hazardMesh.userData.isHazard = true;
                    scene.add(hazardMesh);
                    collidables.push(hazardMesh);
                    spatialGrid.insert(hazardMesh);
                    hazardNodes.push({
                        mesh: hazardMesh,
                        type: plat.type,
                        origin: new THREE.Vector3(plat.position.x, plat.position.y, plat.position.z),
                        amplitude: plat.amplitude || (plat.type === 'thwomp' ? 8 : Math.PI * 0.7),
                        speed: plat.speed || (plat.type === 'thwomp' ? 2.5 : 1.5),
                        phase: (Math.random() * Math.PI * 2), // Desfase inicial aleatorio
                        timer: 0,
                        state: 'idle' // thwomp: idle, falling, recovering
                    });
                    return;
                }
            }); // fin forEach platforms
        } // fin if data.platforms


        // 3. Spawners de Objetos / GameLogic
        if (data.collectibles && gameManager) {
            data.collectibles.filter(checkMission).forEach(col => {
                if (col.type === 'obsidian') {
                    gameManager.spawnObsidianStone(col.position.x, col.position.y, col.position.z);
                } else if (col.type === 'star') {
                    gameManager.spawnStar(col);
                } else if (col.type === 'key') {
                    gameManager.spawnKey(col.position.x, col.position.y, col.position.z, col.targetDoor);
                }
            });
        }
        
        // 4. Arquitectura Interactiva (Píldoras Lógicas / Zelda Switches)
        if (data.doors && gameManager) {
            data.doors.filter(checkMission).forEach(door => gameManager.spawnDoor(door));
        }
        if (data.switches && gameManager) {
            data.switches.filter(checkMission).forEach(sw => gameManager.spawnSwitch(sw));
        }
        if (data.waterSwitches && gameManager) {
            data.waterSwitches.filter(checkMission).forEach(ws => gameManager.spawnWaterSwitch(ws));
        }
        if (data.timerSwitches && gameManager) {
            data.timerSwitches.filter(checkMission).forEach(ts => gameManager.spawnTimerSwitch(ts));
        }
        if (data.redCoins && gameManager) {
            data.redCoins.filter(checkMission).forEach(rc => gameManager.spawnRedCoin(rc));
        }
        
        // 4.5 NPCs (Letreros o Personajes)
        if (data.npcs && gameManager) {
            data.npcs.filter(checkMission).forEach(npc => gameManager.spawnNPC(npc));
        }
        
        // 5. Inteligencia Artificial Enemiga
        if (data.enemies) {
            data.enemies.filter(checkMission).forEach(foe => {
                if (foe.type === 'goomba' && enemyManager) {
                    enemyManager.spawnGoomba(foe.position.x, foe.position.y, foe.position.z, foe.spriteType);
                } else if (foe.type === 'tezcatlipoca' && bossManager) {
                    bossManager.spawnTezcatlipoca(foe.position.x, foe.position.y, foe.position.z);
                }
            });
        }
        
        // 6. Objetos de Escenografía / Props
        if (data.props) {
            data.props.filter(checkMission).forEach(prop => {
                let mesh;
                if (prop.type === 'tree') mesh = createTree(prop.position);
                else if (prop.type === 'tule') mesh = createTule(prop.position);
                else if (prop.type === 'rock') mesh = createRock(prop.position);
                else if (prop.type === 'torch') mesh = createTorch(prop.position);
                else if (prop.type === 'teocalli') mesh = createTeocalli(prop.position);
                else if (prop.type === 'pot') {
                    mesh = createPot(prop.position);
                }
                else if (prop.type === 'massive_rock') {
                    mesh = createRock(prop.position);
                    mesh.scale.set(2.5, 2.5, 2.5); // 2.5x más grande
                    mesh.position.y += 1.0;
                    mesh.userData.isMassive = true; // El modificador que el Arquitecto programó
                }
                
                if (mesh) {
                    scene.add(mesh);
                    if (prop.type === 'tree' || prop.type === 'rock' || prop.type === 'massive_rock' || prop.type === 'teocalli') {
                        collidables.push(mesh);
                        // Insertar en SpatialGrid para colisiones O(k)
                        spatialGrid.insert(mesh);
                    }
                    if (prop.type === 'rock' || prop.type === 'pot' || prop.type === 'massive_rock') {
                        mesh.userData.isGrabbable = true;
                        mesh.userData.propType = prop.type;
                        grabbables.push(mesh);
                    }
                }
            });
        }
        
        // 7. Ambient Audio Triggers (RE4 posicional por zona)
        if (data.ambientTriggers) {
            data.ambientTriggers.forEach(trigger => {
                ambientAudio.addTrigger(trigger);
            });
        }

        // 8. Hazard damage zones (trampas de daño activo, sin geométrica extra)
        if (data.hazardZones && gameManager) {
            data.hazardZones.filter(checkMission).forEach(hz => {
                const min = new THREE.Vector3(hz.position.x - hz.size.width/2, hz.position.y - hz.size.height/2, hz.position.z - hz.size.depth/2);
                const max = new THREE.Vector3(hz.position.x + hz.size.width/2, hz.position.y + hz.size.height/2, hz.position.z + hz.size.depth/2);
                gameManager.registerHazardZone({
                    box: new THREE.Box3(min, max),
                    damage: hz.damage || 1,
                    cooldown: hz.cooldown || 1.0,
                    type: hz.type || 'spike'
                });
            });
        }
        
        return data; // Retornamos el AST por si algún otro sistema lo requiere
    } catch (err) {
        console.error("[LevelParser] Failed to parse JSON level structure:", err);
    }
}
