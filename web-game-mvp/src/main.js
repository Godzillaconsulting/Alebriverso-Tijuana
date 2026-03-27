import './style.css';
import * as THREE from 'three';
import { loadLevelFromJson, tiltPlatforms, movingPlatforms, hazardNodes } from './assets.js';
import { dynamicLights } from './propBuilder.js';
import { initAudio, playBGM } from './audio.js';
import { PlayerController } from './movement.js';
import { ThirdPersonCamera } from './camera.js';
import { GameManager } from './gamelogic.js';
import { VFXManager } from './vfx.js';
import { EnemyManager } from './enemies.js';
import { BossManager } from './boss.js';
import MaterialManager from './materialManager.js';
import { LevelManager } from './levelManager.js';
import { PostProcessingManager } from './postProcessing.js';
import { WeaponManager } from './weapons.js';
import { UIManager } from './uiManager.js';
import { WeatherSystem } from './weatherSystem.js';
// === EPOCH 7: Sistemas RE4 Grade ===
import { saveSystem } from './saveSystem.js';
import { inventorySystem } from './inventory.js';
import { alertBus } from './alertBus.js';
import { merchantSystem } from './merchant.js';
import { GlobalState } from './gameState.js';
// === EPOCH 7B: RE4 Sistemas Adicionales ===
import { lootSystem } from './lootSystem.js';
import { weaponUpgradeSystem } from './weaponUpgrades.js';
import { ambientAudio } from './ambientAudio.js';


// Inicializar la Interfaz Next-Gen HUD 2D
const uiManager = new UIManager();

const canvas = document.querySelector('#game-canvas');

export const scene = new THREE.Scene();

// === SKYBOX DINÁMICO (PS2 Estilo) — Esfera gigante con gradiente cielo azul/horizon ===
const skyGeo = new THREE.SphereGeometry(900, 32, 16);
const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec3 vWorldPos;
        void main() {
            vWorldPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        void main() {
            float t = clamp((vWorldPos.y + 100.0) / 500.0, 0.0, 1.0);
            vec3 zenith  = vec3(0.18, 0.35, 0.82);  // Azul profundo
            vec3 horizon = vec3(0.72, 0.85, 1.0);   // Azul claro horizonte 
            // Nubes procedurales simples (ruido ondulado)
            float nx = vWorldPos.x * 0.002 + uTime * 0.012;
            float nz = vWorldPos.z * 0.002 + uTime * 0.008;
            float cloud = smoothstep(0.55, 0.8, 0.5 + 0.5 * sin(nx * 1.7) * sin(nz * 2.1));
            vec3 skyColor = mix(horizon, zenith, t);
            skyColor = mix(skyColor, vec3(1.0), cloud * 0.35 * (1.0 - t)); // Nubes más densas en horizonte
            gl_FragColor = vec4(skyColor, 1.0);
        }
    `
});
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
skyMesh.userData = { isCore: true };
scene.add(skyMesh);

scene.fog = new THREE.FogExp2(0x6495ED, 0.005); // Niebla muy lejana para permitir exploración

export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- OPTIMIZACIÓN 60 FPS / ESTILO PS2 ---
// Antialias desactivado: PS2 no tenía MSAA, y ahorra ~30% de cálculos GPU.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
// Clampear el PixelRatio a 1.0 evita que pantallas Retina (Macs/Móviles) intenten renderizar a 4K y maten los FPS.
renderer.setPixelRatio(1.0); 
renderer.shadowMap.enabled = true;
// BasicShadowMap: Sombras duras y pixeladas, típicas de PS2, y 10x más rápidas que PCFSoft.
renderer.shadowMap.type = THREE.BasicShadowMap;

// Tonemapping HDR Cinematográfico
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1; // Exposicion fotográfica base

// === PS2 TENEBRISM 3-POINT LIGHTING ===
// 1. Ambient / Fill Light (Oscuro y frío para que las sombras sean densas y misteriosas)
const ambientLight = new THREE.AmbientLight(0x2a3340, 0.6); // Azul agrisado, Tono MGS2/RE4
scene.add(ambientLight);

// 2. Key Light (Luna fría o atardecer quemado, luz principal dura)
const dirLight = new THREE.DirectionalLight(0xfff0d0, 1.2); // Base hueso
dirLight.position.set(15, 30, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;  // Shadows sharp but low-res feel
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.top = 35;
dirLight.shadow.camera.bottom = -35;
dirLight.shadow.camera.left = -35;
dirLight.shadow.camera.right = 35;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// 3. Rim Light (Luz de contorno atada a la cámara para "despegar" modelos de la oscuridad)
// Este truco se usaba exhaustivamente en la era PS2 para compensar la falta de Global Illumination.
const rimLight = new THREE.PointLight(0x88bbff, 3.5, 12.0);
rimLight.position.set(0, 1.5, 2.0); // Detrás de la cámara, apuntando al prota
camera.add(rimLight);
scene.add(camera); // Añadir cámara a la escena para que sus luces hijas operen

// System Initializations (Instanciación limpia)
const vfxManager = new VFXManager(scene);
const player = new PlayerController(scene, vfxManager);
const thirdPersonCamera = new ThirdPersonCamera(camera);
thirdPersonCamera.setTarget(player.mesh);
const gameManager = new GameManager(scene, vfxManager);
const enemyManager = new EnemyManager(scene, vfxManager);
const bossManager = new BossManager(scene, vfxManager);
const weaponManager = new WeaponManager(scene, vfxManager, enemyManager);
player.weaponManager = weaponManager; // Inyección de de dependencias para Disparo manual
const postProcessor = new PostProcessingManager(renderer, scene, camera);
player.enemyManagerRef = enemyManager; // RE4: Remate blow API

export const weatherSystem = new WeatherSystem(scene, camera);
// Por defecto iniciamos con lluvia de ceniza estilo Silent Hill / RE4 Volcano
weatherSystem.setWeather('ash');

// El Orquestador Multinivel espera asíncronamente con un Fade-In / Fade-Out automático
window.levelManager = new LevelManager(scene, gameManager, player, enemyManager, bossManager);
await window.levelManager.transitionTo('/levels/level_tenochtitlan.json');

// Arrancar motor de audio una vez cargado el nivel
initAudio(camera);

// === EPOCH 7: Registrar singletons como globals para acceso entre módulos ===
window.saveSystem      = saveSystem;
window.inventorySystem = inventorySystem;
window.alertBus        = alertBus;
window.merchantSystem  = merchantSystem;
window.player          = player;
window.thirdPersonCamera = thirdPersonCamera; // Expose for Spine Torso IK

// Conectar AlertBus al EnemyManager (inversión de dependencias)
alertBus.register(enemyManager);

// Cablear eventos de acción Epoch 7
window.addEventListener('saveRequest', (e) => {
    saveSystem.save(e.detail.slot, player.mesh.position, GlobalState.currentLevel, GlobalState.currentMissionID || 1, inventorySystem.getSnapshot());
});

window.addEventListener('loadRequest', (e) => {
    const snap = saveSystem.load(e.detail.slot);
    if (!snap) return;
    const { levelPath, missionID, playerPos, inventory } = saveSystem.applySnapshot(snap);
    inventorySystem.loadSnapshot(inventory);
    player.mesh.position.set(playerPos.x, playerPos.y, playerPos.z);
    window.levelManager.transitionTo(levelPath, missionID);
});

window.addEventListener('merchantBuy', (e) => {
    merchantSystem.buy(e.detail.index);
});

window.addEventListener('inventoryUseItem', (e) => {
    inventorySystem.useItem(e.detail.slotIndex);
});


let isPlaying = false;

// Inyectar referencia de cámara en el PlayerController para Billboard rotation de enemigos
player._camera = camera;

// === EPOCH 7B: Registrar sistemas adicionales RE4 ===
lootSystem.register(scene, player);
window.weaponUpgradeSystem = weaponUpgradeSystem;
// ambientAudio recibe el AudioContext cuando initAudio() lo cree
// (via evento audioContextReady dispatched desde audio.js)
window.addEventListener('audioContextReady', (e) => {
    ambientAudio.register(e.detail.ctx);
});

document.addEventListener('mousemove', (e) => {
    if (isPlaying && document.pointerLockElement) {
        thirdPersonCamera.onMouseMove(e.movementX, e.movementY);
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        thirdPersonCamera.lockOnTarget = null;
    }
});

// Bridge: every system dispatches 'cameraShake' with {intensity, duration}
// We convert to the new trauma-based API (intensity maps to 0..1 trauma).
window.addEventListener('cameraShake', (e) => {
    const raw = e.detail?.intensity ?? 1.0;
    const trauma = THREE.MathUtils.clamp(raw / 3.0, 0, 1);
    thirdPersonCamera.shake(trauma);
    
    // === PS2 RUMBLE (HAPTIC FEEDBACK) ===
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[0];
    if (pad && pad.vibrationActuator) {
        pad.vibrationActuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration: (e.detail?.duration ?? 0.3) * 1000,
            weakMagnitude: Math.min(1.0, trauma * 0.8),
            strongMagnitude: Math.min(1.0, trauma)
        }).catch(() => {}); // Catch on browsers without vibration API
    }
});

// Feature 2: C key — First Person C-Up toggle (hold C)
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC') thirdPersonCamera.toggleFirstPerson(true);
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyC') thirdPersonCamera.toggleFirstPerson(false);
});

// === RE4 QUICK TURN (Q) ===
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyQ' && isPlaying) {
        thirdPersonCamera.quickTurn();
    }
});

// === RE4 MOUSE AIM DOWN SIGHTS (Right Click) ===
document.addEventListener('contextmenu', e => e.preventDefault()); // Disable browser context menu
document.addEventListener('mousedown', (e) => {
    if (isPlaying && e.button === 2) thirdPersonCamera.setAiming(true);
});
document.addEventListener('mouseup', (e) => {
    if (isPlaying && e.button === 2) thirdPersonCamera.setAiming(false);
});

// Feature 3: Letterbox — auto-show on boss fight, hide on boss death
window.addEventListener('bossFightStart', () => thirdPersonCamera.setLetterbox(true));
window.addEventListener('bossHPUpdate',   (e) => {
    if (e.detail?.hpPercentage === 0) thirdPersonCamera.setLetterbox(false);
});

// === CLICK HANDLER DE INICIO (Triple fallback) ===
// 1. Listener directo en el start-screen (más confiable que document)
const _startEl = document.getElementById('start-screen');
function _startGame() {
    if (isPlaying) return;
    isPlaying = true;
    window.dispatchEvent(new CustomEvent('gameStart'));
    playBGM();
    // Intentar pointer lock — si falla, el juego igual arranca
    canvas.requestPointerLock().catch(() => {
        console.warn('[Main] Pointer Lock denegado, jugando en modo sin lock.');
    });
}
if (_startEl) _startEl.addEventListener('click', _startGame);

// 2. Fallback en document por si el usuario hace click fuera del start-screen 
document.addEventListener('click', () => {
    if (!isPlaying) _startGame();
});

// Reiniciar por Game Over y Pausa
document.addEventListener('keydown', (e) => {
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && isPlaying) {
        let closest = null;
        let minDist = 25;
        if (enemyManager && enemyManager.enemies) {
            enemyManager.enemies.forEach(en => {
                const mesh = en.mesh || en;
                const dist = player.mesh.position.distanceTo(mesh.position);
                if (dist < minDist) {
                    minDist = dist;
                    closest = mesh;
                }
            });
        }
        
        if (gameManager && gameManager.switches) {
            gameManager.switches.forEach(sw => {
                if (!sw.isPressed) {
                    const dist = player.mesh.position.distanceTo(sw.mesh.position);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = sw.mesh;
                    }
                }
            });
        }
        
        thirdPersonCamera.lockOnTarget = closest;
    }

    if (e.key.toLowerCase() === 'r' && player.hp <= 0) {
        window.location.reload();
    }
    
    // Toggle Pause con ESC o P
    if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && player.hp > 0 && document.getElementById('start-screen').style.display === 'none') {
        if (isPlaying) {
            isPlaying = false;
            window.dispatchEvent(new CustomEvent('gamePause'));
            document.exitPointerLock();
        } else {
            isPlaying = true;
            window.dispatchEvent(new CustomEvent('gameResume'));
            canvas.requestPointerLock();
        }
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    postProcessor.resize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
// --- BUCLE PRINCIPAL (RENDER LOOP DE 120 FPS) ---
// Dynamic Resolution Scaling (DRS) Constants
let stableFrames = 0;
let drsMode = window.devicePixelRatio;

let lastGamepadButtons = [];

function animate() {
    requestAnimationFrame(animate);

    // Cap delta time to prevent physics explosions when tab is backgrounded
    const delta = Math.min(clock.getDelta(), 0.1); 
    
    // --- Dynamic Resolution Scaling (DRS) ---
    if (delta > 0.025) { 
        stableFrames = 0;
        if (drsMode > 1.0) {
            drsMode -= 0.1;
            renderer.setPixelRatio(drsMode);
        }
    } else {
        stableFrames++;
        if (stableFrames > 60 && drsMode < window.devicePixelRatio) {
            drsMode += 0.1;
            renderer.setPixelRatio(Math.min(drsMode, window.devicePixelRatio));
            stableFrames = 0;
        }
    }

    if (isPlaying) {
        // === PS2 GAMEPAD INTEGRATION ===
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const pad = pads[0];
        if (pad && pad.connected) {
            let padActive = false;
            for (let i=0; i<4; i++) if (Math.abs(pad.axes[i]) > 0.15) padActive = true;
            for (let i=0; i<pad.buttons.length; i++) if (pad.buttons[i]?.pressed) padActive = true;
            
            if (padActive) {
                player.keys.w = pad.axes[1] < -0.3 || pad.buttons[12]?.pressed;
                player.keys.s = pad.axes[1] >  0.3 || pad.buttons[13]?.pressed;
                player.keys.a = pad.axes[0] < -0.3 || pad.buttons[14]?.pressed;
                player.keys.d = pad.axes[0] >  0.3 || pad.buttons[15]?.pressed;
                player.keys.space = pad.buttons[0]?.pressed; // X / A
            }
            
            // Right Stick Camera (scaled for 60fps delta)
            if (Math.abs(pad.axes[2]) > 0.1 || Math.abs(pad.axes[3]) > 0.1) {
                thirdPersonCamera.onMouseMove(pad.axes[2] * 40, pad.axes[3] * 40);
            }

            // L2 = AimDownSights
            if (pad.buttons[6]?.pressed) thirdPersonCamera.setAiming(true);
            else if (!document.pointerLockElement) thirdPersonCamera.setAiming(false);

            // R1 = Quick Turn
            const r1Pressed = pad.buttons[5]?.pressed;
            if (r1Pressed && !lastGamepadButtons[5]) thirdPersonCamera.quickTurn();

            // R2 or Square = Attack / Shoot
            const r2Pressed = (pad.buttons[7] && pad.buttons[7].pressed) || (pad.buttons[2] && pad.buttons[2].pressed);
            const isR2NewPress = r2Pressed && (!lastGamepadButtons[7] && !lastGamepadButtons[2]);
            if (isR2NewPress) {
                if (thirdPersonCamera.isAiming) player.executeAttack(1); // Projectile/Shoot
                else player.executeAttack(0); // Melee/Punch
            }

            for (let i=0; i<pad.buttons.length; i++) lastGamepadButtons[i] = pad.buttons[i].pressed;
        }

        player.update(delta, camera);
        player._syncCameraData(); // Bridge for camera head-bob
        thirdPersonCamera.update(delta);
        alertBus.tick(delta);
        alertBus.calmDown(delta);
        gameManager.update(delta, player.mesh.position);

        
        // --- Frustum Culling de IA (PS2-Grade) ---
        // Los enemigos fuera del frustum de la cámara no consumen CPU.
        // Solo actualizamos los que están a menos de 50u del jugador (heurística rápida O(1)).
        const playerPos = player.mesh.position;
        const enemies = enemyManager.enemies;
        for (let ei = 0; ei < enemies.length; ei++) {
            const e = enemies[ei];
            if (!e) continue;
            const edx = e.position.x - playerPos.x;
            const edz = e.position.z - playerPos.z;
            // Skip AI si está fuera del radio de activación (50u)
            e.visible = (edx*edx + edz*edz) < 50*50;
        }
        enemyManager.update(delta, player);
        
        bossManager.update(delta, player, weaponManager);
        weaponManager.update(delta);
        vfxManager.update(delta);
        MaterialManager.update(delta);
        weatherSystem.update(delta);
        
        // --- Física de Entorno Avanzada ---
        for (let i = 0; i < tiltPlatforms.length; i++) {
            const plat = tiltPlatforms[i];
            const dx = player.mesh.position.x - plat.position.x;
            const dz = player.mesh.position.z - plat.position.z;
            
            let targetX = 0, targetZ = 0;
            // Si el jugador está pseudo-sobre la plataforma (AABB Check visual)
            if (player.onGround && Math.abs(dx) < 12 && Math.abs(dz) < 12) {
                targetX = THREE.MathUtils.clamp(dz * 0.02, -plat.userData.tiltLimits.x, plat.userData.tiltLimits.x);
                targetZ = THREE.MathUtils.clamp(-dx * 0.02, -plat.userData.tiltLimits.z, plat.userData.tiltLimits.z);
            }
            
            plat.rotation.x = THREE.MathUtils.lerp(plat.rotation.x, targetX, delta * 3);
            plat.rotation.z = THREE.MathUtils.lerp(plat.rotation.z, targetZ, delta * 3);
            // Forzar actualización de matriz global para que el Raycaster detecte la superficie torcida
            plat.updateMatrixWorld();
        }
        
        // --- Plataformas Móviles y Fricción Estática ---
        for (let i = 0; i < movingPlatforms.length; i++) {
            const p = movingPlatforms[i];
            const oldPos = p.position.clone();
            
            p.userData.progress += p.userData.speed * delta * p.userData.direction;
            if (p.userData.progress >= 1.0) {
                p.userData.progress = 1.0;
                p.userData.direction = -1;
            } else if (p.userData.progress <= 0.0) {
                p.userData.progress = 0.0;
                p.userData.direction = 1;
            }
            // Suavizado Sine-InOut (Ease In/Out) Mágico
            const ease = 0.5 - 0.5 * Math.cos(Math.PI * p.userData.progress);
            p.position.copy(p.userData.startPos).lerp(p.userData.endPos, ease);
            
            p.userData.deltaPos = p.position.clone().sub(oldPos);
            p.updateMatrixWorld();
        }

        // --- Hazards Oscilantes SM64 (Péndulos / Thwomps) ---
        const elapsed = clock.elapsedTime;
        for (let i = 0; i < hazardNodes.length; i++) {
            const h = hazardNodes[i];
            if (h.type === 'pendulum') {
                // Oscilación Senoidal pura (igual que un péndulo real con RestForce)
                const angle = h.amplitude * Math.sin(elapsed * h.speed + h.phase);
                h.mesh.position.x = h.origin.x + Math.sin(angle) * (h.params?.radius || 6);
                h.mesh.position.y = h.origin.y - Math.abs(Math.cos(angle)) * (h.params?.radius || 6);
                h.mesh.updateMatrixWorld();
            } else if (h.type === 'thwomp') {
                // Estado máquina: idle (flota arriba) -> falling -> recovering
                const dxT = player.mesh.position.x - h.origin.x;
                const dzT = player.mesh.position.z - h.origin.z;
                const distPXZ = Math.sqrt(dxT*dxT + dzT*dzT);
                if (h.state === 'idle') {
                    // Flota amenazante en la posición origen
                    h.mesh.position.y = h.origin.y + Math.sin(elapsed * 1.2 + h.phase) * 0.3;
                    // Detectar jugador abajo (Trigger Zone XZ)
                    if (distPXZ < 5 && player.mesh.position.y < h.origin.y) {
                        h.state = 'falling';
                    }
                } else if (h.state === 'falling') {
                    h.mesh.position.y -= h.speed * 12 * delta;
                    // Aterrizaje (Aplastamiento)
                    if (h.mesh.position.y <= h.origin.y - h.amplitude) {
                        h.mesh.position.y = h.origin.y - h.amplitude;
                        h.state = 'recovering';
                        h.timer = 1.2; // Pausa aplastado 1.2s
                        vfxManager.createDustPuff(h.mesh.position, 30);
                    }
                    // Chequeo de daño al jugador (Bounding Sphere bruto)
                    if (h.mesh.position.distanceTo(player.mesh.position) < 3.5) {
                        player.takeDamage(h.mesh.position);
                        window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.6, intensity: 2.5 } }));
                    }
                } else if (h.state === 'recovering') {
                    h.timer -= delta;
                    if (h.timer <= 0) {
                        h.state = 'idle';
                        h.mesh.position.y = THREE.MathUtils.lerp(h.mesh.position.y, h.origin.y, delta * 3);
                    }
                }
                h.mesh.updateMatrixWorld();
            }
        }

        // Skybox sincronizado al reloj (nubes rotando)
        skyMat.uniforms.uTime.value = elapsed;
        skyMesh.position.copy(camera.position); // Centrar en cámara siempre

        // --- Flicker Dinámico de Torchas Volumétricas PBR ---
        const timeNow = Date.now();
        for (let i = 0; i < dynamicLights.length; i++) {
            // Un ruido combinatorio caótico tipo fuego
            dynamicLights[i].intensity = 1.0 + Math.sin(timeNow * 0.01 + i) * 0.2 + Math.cos(timeNow * 0.02) * 0.2;
        }

        // === EPOCH 7B: SISTEMAS RE4 UPDATE ===
        lootSystem.update(delta);                              // Drops flotantes + pickup detection
        ambientAudio.update(player.mesh.position);            // Audio posicional por zona
        alertBus.tick(delta);                                  // Reloj interno AlertBus
        alertBus.calmDown(delta);                              // Enemigos se calman gradualmente
    }

    // Usar la Composición Visual (SSAO + Bloom + Render RAW)
    postProcessor.render();
}

animate();

