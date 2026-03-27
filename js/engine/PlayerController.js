import Physics from './Physics.js';

export default class PlayerController {
    constructor(scene, audioManager, vfxManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.vfxManager = vfxManager;
        
        this.x = scene.playerSpawn ? scene.playerSpawn.x : 0;
        this.y = scene.playerSpawn ? scene.playerSpawn.y : 10;
        this.z = scene.playerSpawn ? scene.playerSpawn.z : 0;
        
        this.vy = 0;   
        
        this.radius = 1.0;
        this.height = 0.5; // Elevamos ligeramente el centro
        this.speed = 18.0; 
        this.jumpForce = 22.0; 
        this.gravity = 65.0; 
        this.isGrounded = false;
        
        // Machine State SM64 Completa
        this.STATES = {
            NORMAL: 0,
            CROUCHING: 1,
            LONG_JUMP: 2,
            GROUND_POUND: 3,
            BACKFLIP: 4,
            DIVE: 5,        // Agregado
            WALL_SLIDE: 6,   // Agregado
            SIDEFLIP: 7,
            BONK: 8,
            HARD_LANDING: 9,
            LEDGE_GRAB: 10,
            SWIMMING: 11,
            CELEBRATE: 12, // Estado cinemático indestructible
            HURT: 13,
            DEAD: 14,
            PUNCH: 15,
            JUMP_KICK: 16,
            LAVA_BURN: 17,
            POLE_CLIMBING: 18,
            ATLATL_THROW: 19,
            MACUAHUITL_SWING: 20,
            SLIDING_SLOPE: 21,
            CANNON_FLIGHT: 22,
            CANNON_AIMING: 23,
            WARPING: 24
        };
        this.currentState = this.STATES.NORMAL;
        this.activePole = null;
        this.attackTimer = 0.0;

        this.maxHealth = 8;
        this.health = 8;
        this.invulnTimer = 0.0;

        this.jumpCombo = 0;       
        this.groundTimer = 0.0;   
        this.poundTimer = 0.0;    
        this.stunTimer = 0.0;
        this.fallVelocity = 0.0;
        this.waterLevel = -15.0;
        
        this.coyoteTimer = 0.0;
        this.jumpBufferTimer = 0.0;
        
        this.momentumX = 0;
        this.momentumZ = -1;
        this.currentVelX = 0;
        this.currentVelZ = 0;
        
        this.currentFloorSurface = 'normal'; // 'normal', 'mud', 'obsidian'

        this.keys = { w: false, a: false, s: false, d: false, space: false, crouch: false, attack: false };
        this._setupInput();
    }

    _setupInput() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w' || k === 'arrowup') this.keys.w = true;
            if (k === 's' || k === 'arrowdown') {
                this.keys.s = true;
                if (this.currentState === this.STATES.LEDGE_GRAB) this.currentState = this.STATES.NORMAL; // Soltarse
            }
            if (k === 'a' || k === 'arrowleft') this.keys.a = true;
            if (k === 'd' || k === 'arrowright') this.keys.d = true;
            if (k === 'shift' || k === 'c') {
                this.keys.crouch = true;
                if (this.currentState === this.STATES.LEDGE_GRAB) this.currentState = this.STATES.NORMAL; // Soltarse
            }
            
            if (k === ' ' && !this.keys.space) {
                this.keys.space = true;
                
                // Wall Jump / Ledge Grab / Swim / Normal Jumps
                if (this.currentState === this.STATES.WALL_SLIDE) {
                    this.executeWallJump();
                } else if (this.currentState === this.STATES.LEDGE_GRAB) {
                    this.currentState = this.STATES.NORMAL;
                    this.vy = this.jumpForce * 1.1; // Climb up
                    // Empuje frontal mínimo en el aire tras escalar
                    this.momentumX = (this.keys.d ? 1 : (this.keys.a ? -1 : 0)) * 0.5;
                    this.momentumZ = (this.keys.s ? 1 : (this.keys.w ? -1 : 0)) * 0.5;
                    if (this.audioManager) this.audioManager.playJumpSynthesized(this.x, this.y, this.z);
                } else if (this.currentState === this.STATES.SWIMMING) {
                    this.vy = this.jumpForce * 0.6; // Nado fluido
                    if (this.audioManager) this.audioManager.playJumpSynthesized(this.x, this.y, this.z);
                } else if (this.currentState === this.STATES.DIVE) {
                    // Dive recovery jump
                    this.currentState = this.STATES.NORMAL;
                    this.vy = this.jumpForce * 0.8;
                } else if (this.isGrounded || this.coyoteTimer > 0) {
                    if (this.currentState === this.STATES.HARD_LANDING) {
                        // Cancel jump (stunned)
                    } else {
                        this.jump();
                        this.coyoteTimer = 0.0; // Consumir coyote time
                    }
                } else {
                    // Guardar intento de salto en el aire cercano a tocar el suelo (Jump Buffering)
                    this.jumpBufferTimer = 0.20;
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w' || k === 'arrowup') this.keys.w = false;
            if (k === 's' || k === 'arrowdown') this.keys.s = false;
            if (k === 'a' || k === 'arrowleft') this.keys.a = false;
            if (k === 'd' || k === 'arrowright') this.keys.d = false;
            if (k === 'shift' || k === 'c') this.keys.crouch = false;
            if (k === ' ') {
                this.keys.space = false;
                // Variable Jump Height: si soltamos en plena subida, perdemos la mitad del gas (Control fino)
                if (this.vy > 0 && !this.isGrounded && ![this.STATES.CELEBRATE, this.STATES.BONK, this.STATES.WALL_SLIDE].includes(this.currentState)) {
                    this.vy *= 0.5; 
                }
            }
            if (k === 'enter' || k === 'x' || k === 'f' || k === 'e') {
                this.keys.attack = false;
            }
        });

        // Ataque Principal (B-Button del N64) - Mapeado a Click Izquierdo o Teclas F/X/E/Enter
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && document.pointerLockElement) {
                this.executeAttack();
            }
        });
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'enter' || k === 'x' || k === 'f' || k === 'e') {
                if (!this.keys.attack) {
                    this.keys.attack = true;
                    this.executeAttack();
                }
            }
        });
    }

    jump() {
        if (this.currentState === this.STATES.NORMAL || this.currentState === this.STATES.DIVE) {
            // Check Sideflip (Instant 180 direction shift check)
            let dirX = 0; let dirZ = 0;
            if (this.keys.w) dirZ -= 1;
            if (this.keys.s) dirZ += 1;
            if (this.keys.a) dirX -= 1;
            if (this.keys.d) dirX += 1;
            
            let mag = Math.hypot(dirX, dirZ);
            if (mag > 0) { dirX /= mag; dirZ /= mag; }

            const speedMag = Math.hypot(this.momentumX, this.momentumZ);
            // Reducir tracción transversal de salto si estamos en hielo
            const isIce = (this.currentFloorSurface === 'obsidian');
            let force = this.jumpForce;
            
            // Penalidad de Lodo
            if (this.currentFloorSurface === 'mud') {
               force *= 0.6; // Salto pesado ahogado
               this.jumpCombo = 0; // Rompe combos
            }
            
            if (speedMag > 0.6 && dot < -0.7 && !isIce && this.currentFloorSurface !== 'mud') {
                // Trigger Sideflip
                this.currentState = this.STATES.SIDEFLIP;
                this.vy = force * 1.8; // Extremely high
                this.momentumX = dirX * 1.5; 
                this.momentumZ = dirZ * 1.5;
                this.jumpCombo = 0;
            } else {
                // Triple Jump
                if (this.jumpCombo === 0 || this.groundTimer > 0.25 || this.currentFloorSurface === 'mud') {
                    this.vy = force;
                    this.jumpCombo = 1;
                } else if (this.jumpCombo === 1) {
                    this.vy = force * 1.25; 
                    this.jumpCombo = 2;
                } else if (this.jumpCombo === 2) {
                    this.vy = force * 1.6; 
                    this.jumpCombo = 0; 
                }
            }
        } else if (this.currentState === this.STATES.CROUCHING) {
             let force = this.jumpForce;
             if (this.currentFloorSurface === 'mud') force *= 0.4; // Penalidad masiva

            const speedMag = Math.hypot(this.momentumX, this.momentumZ);
            if (speedMag > 0.1) {
                this.currentState = this.STATES.LONG_JUMP;
                this.vy = force * 0.6; 
            } else {
                this.currentState = this.STATES.BACKFLIP;
                this.vy = force * 1.6; 
            }
        } else if (this.currentState === this.STATES.SLIDING_SLOPE) {
            this.currentState = this.STATES.NORMAL;
            this.vy = this.jumpForce * 1.2; // Salto de auxilio en rampa
        }
        
        this.isGrounded = false;
        this.groundTimer = 0.0;
        if (this.audioManager) this.audioManager.playJumpSynthesized(this.x, this.y, this.z);
    }

    executeAttack() {
        if ([this.STATES.CELEBRATE, this.STATES.DEAD, this.STATES.HURT, this.STATES.SWIMMING].includes(this.currentState)) return;

        if (this.isGrounded) {
            const speedMag = Math.hypot(this.momentumX, this.momentumZ);
            
            // MODO MACUAHUITL (Estático / Caminata Lenta) - Rango de Acción Pesado
            if (speedMag < 2.5 && this.currentState !== this.STATES.MACUAHUITL_SWING) {
                this.currentState = this.STATES.MACUAHUITL_SWING;
                this.attackTimer = 0.40; 
                this.momentumX = 0; 
                this.momentumZ = 0; // Se planta firme
                
                if (this.audioManager) this.audioManager.playJumpSynthesized(); // Swoosh
                if (this.vfxManager) this.vfxManager.emitDust(this.x, this.y, this.z, 20);
                
                if (window.projectileManager) {
                    window.projectileManager.executeMacuahuitlSweep(this.x, this.y, this.z, 4.5);
                }
            } 
            // MODO ATLATL (Carrera Frontal) - Lanzamiento Balístico Rápido
            else if (speedMag >= 2.5 && this.currentState !== this.STATES.ATLATL_THROW) {
                this.currentState = this.STATES.ATLATL_THROW;
                this.attackTimer = 0.35;
                
                let fX = 0, fZ = -1;
                if (speedMag > 0.1) {
                    fX = this.momentumX / speedMag;
                    fZ = this.momentumZ / speedMag;
                }
                
                if (window.projectileManager) {
                    // Sale proyectado desde la cara/hombro
                    window.projectileManager.throwDart(this.x, this.y + 1.2, this.z, fX, fZ);
                }
                
                // Pierde un poco el balance inercial al lanzar con fuerza
                this.momentumX *= 0.7;
                this.momentumZ *= 0.7;
            }
        } else if (!this.isGrounded && ![this.STATES.GROUND_POUND, this.STATES.WALL_SLIDE, this.STATES.LEDGE_GRAB, this.STATES.JUMP_KICK, this.STATES.BONK].includes(this.currentState)) {
            // Patada Aérea (Air Kick)
            this.currentState = this.STATES.JUMP_KICK;
            this.attackTimer = 0.45;
            
            // Gravedad reducida momentáneamente para suspensión tipo patada voladora
            if (this.vy < 0) this.vy *= 0.3;
            
            // Boost de impulso hacia adelante
            const speedMag = Math.hypot(this.momentumX, this.momentumZ);
            if (speedMag > 0.1) {
                this.momentumX *= 1.4;
                this.momentumZ *= 1.4;
            }
            if (this.audioManager) this.audioManager.playJumpSynthesized();
        }
    }

    executeWallJump() {
        this.currentState = this.STATES.NORMAL;
        // Invertimos la inercia (Rebote) y añadimos fuera
        this.momentumX *= -1;
        this.momentumZ *= -1;
        this.vy = this.jumpForce * 1.4; // Gran impulso vertical
        
        // Push-out de pared instantáneo
        this.x += this.momentumX * 1.5;
        this.z += this.momentumZ * 1.5;
        
        if (this.audioManager) {
            this.audioManager.playJumpSynthesized(this.x, this.y, this.z);
            console.log("[Player] Wah! (Wall Jump)");
        }
    }

    update(dt, cameraManager = null) {
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        // Gestor de Tiempos de Animación de Combate
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                if ([this.STATES.MACUAHUITL_SWING, this.STATES.ATLATL_THROW, this.STATES.JUMP_KICK, this.STATES.PUNCH].includes(this.currentState)) {
                    this.currentState = this.STATES.NORMAL;
                }
            }
        }

        // --- SISTEMA CAÑONES (AIMING Y BALÍSTICA PARABÓLICA) ---
        if (![this.STATES.CANNON_AIMING, this.STATES.CANNON_FLIGHT, this.STATES.DEAD].includes(this.currentState)) {
             const cannon = Physics.checkCannonIntersection(this, this.scene.platforms);
             if (cannon && this.keys.space && this.vy <= 0) { // Al intentar saltar sobre/dentro del cañón
                 this.currentState = this.STATES.CANNON_AIMING;
                 this.activeCannon = cannon;
                 this.x = cannon.position.x;
                 this.y = cannon.position.y + 0.5;
                 this.z = cannon.position.z;
                 this.vy = 0;
                 this.momentumX = 0;
                 this.momentumZ = 0;
                 this.cannonPitch = Math.PI / 6; // 30 grados
             }
        }

        if (this.currentState === this.STATES.CANNON_AIMING) {
            this.vy = 0;
            this.momentumX = 0;
            this.momentumZ = 0;
            
            // Aiming libre en Primera Persona Cinematica (Mirilla controlable)
            let rotSpeed = 2.0;
            if (this.keys.a) this.facingAngle += rotSpeed * dt;
            if (this.keys.d) this.facingAngle -= rotSpeed * dt;
            if (this.keys.w) this.cannonPitch = Math.min(this.cannonPitch + rotSpeed * dt, Math.PI / 2.5);
            if (this.keys.s) this.cannonPitch = Math.max(this.cannonPitch - rotSpeed * dt, 0.1);
            
            // El motor central de render usa facingAngle de todas formas.
            return; 
        }

        if (this.currentState === this.STATES.CANNON_FLIGHT) {
            // Vuelo Bala Euclidiano Puro
            this.vy -= (this.gravity * 0.45) * dt; // Suspensión de aire Mario64
            this.y += this.vy * dt;
            this.x += this.momentumX * dt;
            this.z += this.momentumZ * dt;
            
            // Si nos estampamos contra la pared blindada
            if (Physics.checkWallCollision(this, this.scene.platforms)) {
                this.currentState = this.STATES.HARD_LANDING;
                this.stunTimer = 1.0;
                this.health -= 1;
                if (window.healthUI) window.healthUI.update(this.health);
                this.vy = 5;
                this.momentumX *= -0.2;
                this.momentumZ *= -0.2;
                if (this.audioManager) this.audioManager.playThudSynthesized();
                if (this.vfxManager) this.vfxManager.emitSparks(this.x, this.y, this.z, 20);
                return;
            }

            // Aterrizaje Paracaídas o Choque de Barriga
            const floorData = Physics.checkFloorCollision(this, this.scene.platforms);
            if (floorData !== null && this.vy <= 0) {
                this.currentState = this.STATES.HARD_LANDING; // Siempre duele aterrizar de cañón
                this.stunTimer = 1.5;
                this.y = floorData.y + this.height;
                this.vy = 0;
                this.momentumX *= 0.1;
                this.momentumZ *= 0.1;
                if (this.audioManager) this.audioManager.playThudSynthesized();
                if (this.vfxManager) this.vfxManager.emitDust(this.x, this.y, this.z, 25);
            }
            return; // Cortocircuito absoluto
        }

        // --- SISTEMA PRE-CINEMATICO POSTES (POLE CLIMBING) ---
        if (![this.STATES.POLE_CLIMBING, this.STATES.DEAD, this.STATES.CELEBRATE, this.STATES.HURT, this.STATES.LAVA_BURN].includes(this.currentState)) {
            const pole = Physics.checkPoleIntersection(this, this.scene.platforms);
            if (pole && this.vy <= 0) {
                this.currentState = this.STATES.POLE_CLIMBING;
                this.activePole = pole;
                this.vy = 0;
                this.momentumX = 0;
                this.momentumZ = 0;
                
                // Alineación circular magnética para posar como si abrazara el tubo
                const dx = this.x - pole.position.x;
                const dz = this.z - pole.position.z;
                const dist = Math.hypot(dx, dz) || 1;
                this.x = pole.position.x + (dx / dist) * (pole.radius + this.radius);
                this.z = pole.position.z + (dz / dist) * (pole.radius + this.radius);
                
                if (this.audioManager) this.audioManager.playThudSynthesized(); 
            }
        }

        if (this.currentState === this.STATES.POLE_CLIMBING && this.activePole) {
            this.vy = 0; // Deshabilitar gravedad mientras trepamos

            const poleTop = this.activePole.position.y + this.activePole.height / 2;
            const poleBottom = this.activePole.position.y - this.activePole.height / 2;

            // Trepar el tubo / deslizarse
            let climbDir = 0;
            if (this.keys.forward) climbDir = 1;
            else if (this.keys.backward) climbDir = -1;
            this.y += climbDir * 8.0 * dt; 

            // Limites Acrobáticos
            if (this.y > poleTop) {
                this.y = poleTop; // Handstand en el tope (Mario Style)
            } else if (this.y < poleBottom + this.height) {
                this.y = poleBottom + this.height;
                const floorData = Physics.checkFloorCollision(this, this.scene.platforms);
                if (floorData !== null) {
                    this.currentState = this.STATES.NORMAL;
                    this.activePole = null;
                }
            }

            // Rotación orbital con las cintas (A la Der/Izq de la cámara)
            if (this.keys.left || this.keys.right) {
                let rotSpeed = this.keys.left ? 4.0 : -4.0;
                const dx = this.x - this.activePole.position.x;
                const dz = this.z - this.activePole.position.z;
                
                const currentAngle = Math.atan2(dz, dx);
                const newAngle = currentAngle + rotSpeed * dt;
                const outRad = this.activePole.radius + this.radius;
                
                this.x = this.activePole.position.x + Math.cos(newAngle) * outRad;
                this.z = this.activePole.position.z + Math.sin(newAngle) * outRad;
            }

            // Desmontar Poste saltando locamente hacia atrás
            if (this.keys.jump && !this.lastJumpState) {
                this.currentState = this.STATES.BACKFLIP;
                this.vy = this.jumpForce * 0.9;
                
                const dx = this.x - this.activePole.position.x;
                const dz = this.z - this.activePole.position.z;
                const dist = Math.hypot(dx, dz) || 1;
                
                // Patada hacia afuera del poste
                this.momentumX = (dx / dist) * this.speed * 0.8;
                this.momentumZ = (dz / dist) * this.speed * 0.8;
                
                this.activePole = null;
                this.jumpCombo = 1;
                if (this.audioManager) this.audioManager.playJumpSynthesized();
            }
            this.lastJumpState = this.keys.jump;
            return; // Cortocircuito absoluto normal del Character Controller
        }

        // --- SISTEMA ESPEJOS DE OBSIDIANA (WARP ZONES) ---
        if (this.currentState === this.STATES.WARPING) {
            this.warpTimer += dt;
            this.vy = 0;
            this.momentumX = 0;
            this.momentumZ = 0;
            
            if (this.warpTimer < 1.0) {
                // Hundimiento dimensional suave (Animación inercial sin gravedad)
                this.y -= 2.0 * dt;
                this.facingAngle += 15.0 * dt; // Giro helicoidal tipo tubería SM64
            } else if (this.warpTimer >= 1.0 && this.warpTimer < 1.1) {
                // Teletransportación pura (Quantum Leap)
                if (this.warpTarget) {
                    this.x = this.warpTarget.x;
                    this.y = this.warpTarget.y - 1.5; // Empezar algo hundido abajo del nuevo espejo
                    this.z = this.warpTarget.z;
                }
                this.warpTimer = 1.1; // Ajuste step
            } else if (this.warpTimer >= 1.1 && this.warpTimer < 2.1) {
                // Emersión en tierra firme
                this.y += 2.0 * dt;
                this.facingAngle -= 15.0 * dt;
            } else {
                // Recuperar estado
                this.currentState = this.STATES.NORMAL;
                this.vy = 12.0; // Salta del hoyo hacia arriba
                this.y += 0.5;
                if (this.audioManager) this.audioManager.playJumpSynthesized();
            }
            return; // Cortocircuito mecánico para no recalcular gravedad ni suelo
        }

        // Lógicas Extremas (Roban ejecución inercial normal)
        if (this.currentState === this.STATES.DEAD) {
            this.vy -= this.gravity * dt;
            this.y += this.vy * dt;
            return; // Cae al vacío
        }

        if (this.currentState === this.STATES.HURT || this.currentState === this.STATES.LAVA_BURN) {
            this.vy -= this.gravity * dt;
            
            // Micro-stepping AABB (Previene atravesar paredes por alta velocidad)
            const steps = 3;
            const stepX = (this.momentumX * dt) / steps;
            const stepZ = (this.momentumZ * dt) / steps;
            for(let i=0; i<steps; i++) {
                this.x += stepX;
                this.z += stepZ;
                Physics.checkWallCollision(this, this.scene.platforms);
            }
            this.y += this.vy * dt;

            const floorData = Physics.checkFloorCollision(this, this.scene.platforms);
            if (floorData !== null && this.vy <= 0) {
                // Si seguimos cayendo sobre lava mientras saltábamos de dolor, volvemos a rebotar pero sin restar más vida si tenemos I-frames
                if (floorData.isLava) {
                    this.vy = this.jumpForce * 1.5; 
                    if (this.audioManager) this.audioManager.playThudSynthesized();
                } else {
                    this.y = floorData.y + this.height;
                    this.vy = 0;
                    this.momentumX = 0; this.momentumZ = 0;
                    this.currentState = this.STATES.NORMAL;
                }
            }
            return;
        }

        if (this.currentState === this.STATES.CELEBRATE) {
            // Congelamiento cinemático de inputs y físicas salvo gravedad pasiva
            this.vy -= this.gravity * dt;
            this.y += this.vy * dt;
            const floorData = Physics.checkFloorCollision(this, this.scene.platforms);
            if (floorData !== null && this.vy <= 0) {
                this.y = floorData.y + this.height;
                this.vy = 0;
            }
            return; // Detiene absolutamente todo el motor de movimiento convencional
        }

        let rawX = 0;
        let rawZ = 0;
        if (this.keys.w) rawZ -= 1;
        if (this.keys.s) rawZ += 1;
        if (this.keys.a) rawX -= 1;
        if (this.keys.d) rawX += 1;

        let mag = Math.hypot(rawX, rawZ);
        let dirX = 0, dirZ = 0;

        if (mag > 0) {
            rawX /= mag;
            rawZ /= mag;

            if (cameraManager) {
                const angle = cameraManager.azimuthAngle;
                // Rotación de vector cartesiano sobre Y
                dirX = rawX * Math.cos(angle) + rawZ * Math.sin(angle);
                dirZ = -rawX * Math.sin(angle) + rawZ * Math.cos(angle);
            } else {
                dirX = rawX; dirZ = rawZ;
            }
            
            // Guardar angulo de pecho (hacia dónde apunta el maniquí) para el motor visual
            if (![this.STATES.WALL_SLIDE, this.STATES.BONK, this.STATES.GROUND_POUND].includes(this.currentState)) {
                // Si la superficie es hielo y estamos resbalando casi de espaldas o lado, mantenemos mirada al frente
                const velMag = Math.hypot(this.currentVelX, this.currentVelZ);
                if (this.currentFloorSurface === 'obsidian' && velMag > 2.0 && mag === 0) {
                     this.facingAngle = Math.atan2(this.currentVelX, this.currentVelZ);
                } else {
                     this.facingAngle = Math.atan2(dirX, dirZ);
                }
            }
        }

        // Cache extreme fall speed for Hard Landing evaluations
        if (this.vy < this.fallVelocity) {
            this.fallVelocity = this.vy;
        }
        
        if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;

        // --- MASA DE AGUA VIRTUAL ---
        if (this.y < this.waterLevel) {
            if (this.currentState !== this.STATES.SWIMMING) {
                this.currentState = this.STATES.SWIMMING;
                this.vy = -2.0; // Frenar caída al impactar agua
                if (this.vfxManager) this.vfxManager.emitDust(this.x, this.waterLevel, this.z, 20); // Simulando salpicadura (Splash)
                if (this.audioManager) this.audioManager.playThudSynthesized(this.x, this.y, this.z);
            }
        } else if (this.currentState === this.STATES.SWIMMING && this.y >= this.waterLevel && this.vy > 0) {
            // Dolphin Jump (Salir del agua con gracia)
            this.currentState = this.STATES.NORMAL;
            this.vy = this.jumpForce * 1.3;
            if (this.vfxManager) this.vfxManager.emitDust(this.x, this.waterLevel, this.z, 20);
        }

        if (this.isGrounded) {
            this.coyoteTimer = 0.15; // Rellenar ventana de Coyote
            this.groundTimer += dt;
            
            // Procesar Buffer de Saltos Encadenados
            if (this.jumpBufferTimer > 0 && this.currentState !== this.STATES.HARD_LANDING && this.currentState !== this.STATES.CELEBRATE) {
                this.jump();
                this.jumpBufferTimer = 0;
                this.coyoteTimer = 0;
            }
            
            // Hard Landing trigger (Severe Fall Impact)
            if (this.fallVelocity < -75.0 && ![this.STATES.GROUND_POUND].includes(this.currentState)) {
                this.currentState = this.STATES.HARD_LANDING;
                this.stunTimer = 1.0; // Stun penalty SM64
                
                // SM64 Fall Damage Logic
                if (this.fallVelocity < -100.0) {
                    this.health -= 2;
                } else if (this.fallVelocity < -85.0) {
                    this.health -= 1;
                }
                
                if (window.healthUI) window.healthUI.update(this.health);
                if (this.audioManager) this.audioManager.playThudSynthesized(this.x, this.y, this.z);
                if (this.vfxManager) {
                    this.vfxManager.emitDust(this.x, this.y, this.z, 15);
                    this.vfxManager.emitDebris(this.x, this.y, this.z, 5, 0x888888);
                }

                if (this.health <= 0) {
                    this.currentState = this.STATES.DEAD;
                    this.vy = this.jumpForce;
                    if (window.healthUI) window.healthUI.showDeathScreen();
                    
                    setTimeout(() => {
                        if (window.checkpointManager) window.checkpointManager.respawnPlayer(this);
                        if (window.healthUI && window.healthUI.hideDeathScreen) window.healthUI.hideDeathScreen();
                    }, 2500);
                }
            }
            this.fallVelocity = 0.0;
            
            // Trigger feedback de caídas severas (Ground Pound Landing)
            if (this.currentState === this.STATES.GROUND_POUND) {
                if (this.audioManager) {
                    this.audioManager.playThudSynthesized(this.x, this.y, this.z);
                    console.log("[Player] BOOM! (Ground Pound Landed)");
                }
                if (this.vfxManager) {
                    this.vfxManager.emitDust(this.x, this.y, this.z, 30);
                    this.vfxManager.emitDebris(this.x, this.y, this.z, 8, 0x555555);
                }
            }

            // Clean aerial states
            if ([this.STATES.GROUND_POUND, this.STATES.LONG_JUMP, this.STATES.BACKFLIP, this.STATES.WALL_SLIDE, this.STATES.SIDEFLIP, this.STATES.BONK, this.STATES.LEDGE_GRAB].includes(this.currentState)) {
                if ([this.STATES.LONG_JUMP, this.STATES.DIVE].includes(this.currentState)) {
                    // Pulido: Polvo ligero por derrape de aterrizaje
                    if (this.vfxManager) this.vfxManager.emitDust(this.x, this.y, this.z, 5);
                }
                this.currentState = this.STATES.NORMAL;
            }
            
            if (this.currentState === this.STATES.HARD_LANDING) {
                // Player Stunned
                this.stunTimer -= dt;
                this.momentumX *= 0.5;
                this.momentumZ *= 0.5;
                if (this.stunTimer <= 0) {
                    this.currentState = this.STATES.NORMAL;
                }
            } else if (this.currentState === this.STATES.DIVE) {
                // Fricción severa en piso mientras dive
                this.momentumX *= 0.85;
                this.momentumZ *= 0.85;
                if (Math.hypot(this.momentumX, this.momentumZ) < 0.1) {
                    this.currentState = this.STATES.NORMAL; // Se levantó
                }
            } else {
                if (this.keys.crouch) {
                    // Running Dive Check
                    if (this.currentState === this.STATES.NORMAL && mag > 0.5) {
                        this.currentState = this.STATES.DIVE;
                        // Impulso tipo plancha
                        this.momentumX = dirX * 1.5; 
                        this.momentumZ = dirZ * 1.5;
                        this.vy = this.jumpForce * 0.4;
                        this.isGrounded = false;
                    } else {
                        // Check Warp Mirror (Obsidian Mirror Trigger)
                        let onMirror = false;
                        for (const plat of this.scene.platforms) {
                            if (plat.type === 'obsidian_mirror') {
                                const dist = Math.hypot(this.x - plat.position.x, this.z - plat.position.z);
                                if (dist < 2.5 && Math.abs(this.y - plat.position.y) < 2.0) {
                                    this.currentState = this.STATES.WARPING;
                                    this.warpTarget = plat.targetPos;
                                    this.warpTimer = 0.0;
                                    if (this.audioManager) this.audioManager.playExplosionSynthesized(); // Sonido místico
                                    onMirror = true;
                                    break;
                                }
                            }
                        }
                        if (!onMirror) this.currentState = this.STATES.CROUCHING;
                    }
                } else if (this.currentState === this.STATES.CROUCHING) {
                    this.currentState = this.STATES.NORMAL;
                }
            }
        } else {
            this.coyoteTimer -= dt; // Tick Coyote
            // Evaluaciones en aire
            if (this.currentState === this.STATES.WALL_SLIDE) {
                // Salir de pared si suelta dirX/Z (O se aleja)
                if (mag === 0) this.currentState = this.STATES.NORMAL;
            } else if (this.keys.crouch && ![this.STATES.GROUND_POUND, this.STATES.DIVE].includes(this.currentState)) {
                this.currentState = this.STATES.GROUND_POUND;
                this.poundTimer = 0.0;
                this.vy = 0; 
                this.jumpCombo = 0;
            }
        }

        // 1. Gravedad y Flotabilidad
        if (this.currentState === this.STATES.GROUND_POUND) {
            this.poundTimer += dt;
            this.vy = (this.poundTimer > 0.25) ? -120.0 : 0;
        } else if (this.currentState === this.STATES.WALL_SLIDE) {
            // Frotar contra la pared = caer más lento (Fricción vertical)
            this.vy -= (this.gravity * 0.2) * dt; 
        } else if (this.currentState === this.STATES.LEDGE_GRAB) {
            this.vy = 0; // Gravedad cero
        } else if (this.currentState === this.STATES.SWIMMING) {
            // Flotabilidad invertida masiva y empuje del agua
            this.vy += (this.gravity * 0.4) * dt;
            if (this.vy > 8.0) this.vy = 8.0; // Terminal flotational speed
        } else if (this.currentState === this.STATES.DIVE && !this.isGrounded) {
             this.vy -= this.gravity * dt; 
        } else {
            this.vy -= this.gravity * dt;
        }
        
        // Momentum Cache
        if (this.currentState === this.STATES.NORMAL && mag > 0) {
            this.momentumX = dirX;
            this.momentumZ = dirZ;
        }

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                // Volver a la normalidad al expirar el timer de golpe
                this.currentState = this.STATES.NORMAL;
            }
        }

        // 2. Velocidad Horizontal (Current Speed)
        let currentSpeed = this.speed;
        if (this.currentState === this.STATES.CROUCHING) {
            currentSpeed *= 0.3; 
        } else if (this.currentState === this.STATES.LONG_JUMP) {
            currentSpeed *= 1.8;
            dirX = (dirX * 0.1) + (this.momentumX * 0.9);
            dirZ = (dirZ * 0.1) + (this.momentumZ * 0.9);
        } else if (this.currentState === this.STATES.BACKFLIP || this.currentState === this.STATES.SIDEFLIP) {
            currentSpeed *= 0.4; 
        } else if (this.currentState === this.STATES.GROUND_POUND || this.currentState === this.STATES.HARD_LANDING || this.currentState === this.STATES.LEDGE_GRAB) {
            currentSpeed = 0.0; 
        } else if (this.currentState === this.STATES.PUNCH) {
            currentSpeed *= 0.2; // Frizz de movimiento al golpear
        } else if (this.currentState === this.STATES.JUMP_KICK) {
            dirX = this.momentumX;
            dirZ = this.momentumZ;
            currentSpeed *= 1.35; // Avanzar disparado
        } else if (this.currentState === this.STATES.BONK) {
            dirX = this.momentumX;
            dirZ = this.momentumZ;
            currentSpeed *= 0.8; // Push back from Bonk
        } else if (this.currentState === this.STATES.DIVE) {
            // Usa inercia forzada, resbala
            dirX = this.momentumX;
            dirZ = this.momentumZ;
            currentSpeed *= 1.3;
        } else if (this.currentState === this.STATES.SWIMMING) {
            currentSpeed *= 0.4; // Friccion del agua
        }

        // Modificadores Ambientales
        if (this.currentFloorSurface === 'mud' && this.isGrounded) {
            currentSpeed *= 0.35; // Lodo restringe velocidad maxima severamente
        }

        // Físicas Inerciales Hielo/Suelo
        let moveVX = dirX * currentSpeed;
        let moveVZ = dirZ * currentSpeed;
        
        if (this.currentState === this.STATES.NORMAL || this.currentState === this.STATES.CROUCHING) {
             let friccion = 12.0; // Pise solido normal
             if (!this.isGrounded) friccion = 4.0; // Control aéreo mitigable
             else if (this.currentFloorSurface === 'obsidian') friccion = 0.5; // Resbalón incontrolable (Hielo)
             
             this.currentVelX += (moveVX - this.currentVelX) * friccion * dt;
             this.currentVelZ += (moveVZ - this.currentVelZ) * friccion * dt;
             
             // Cast the new smoothed velocities for position update
             moveVX = this.currentVelX;
             moveVZ = this.currentVelZ;
        } else {
             // Estados rigidos o destructivos anulan la inercia nativa de interpolacion
             this.currentVelX = moveVX;
             this.currentVelZ = moveVZ;
        }

        // 3. Resoluciones de Colisión en Paredes Críticas (CCD Micro-Stepping X/Z)
        const steps = 3;
        const stepX = (moveVX * dt) / steps;
        const stepZ = (moveVZ * dt) / steps;
        let hitWall = false;
        
        for (let i = 0; i < steps; i++) {
            this.x += stepX;
            this.z += stepZ;
            if (Physics.checkWallCollision(this, this.scene.platforms)) hitWall = true;
        }
        
        // Analisis: Wall Slide, Bonk o Ledge Grab trigger
        if (hitWall) {
            if ([this.STATES.LONG_JUMP, this.STATES.DIVE, this.STATES.SIDEFLIP].includes(this.currentState) || (!this.isGrounded && mag > 0 && currentSpeed > this.speed * 1.5)) {
                // BONK (Wall Crash)
                this.currentState = this.STATES.BONK;
                this.momentumX *= -0.8; 
                this.momentumZ *= -0.8;
                this.vy = this.jumpForce * 0.4; // Bounce vertical
                this.isGrounded = false;
                if (this.audioManager) this.audioManager.playThudSynthesized(this.x, this.y, this.z);
                if (this.vfxManager) this.vfxManager.emitSparks(this.x + dirX, this.y + (this.height * 2.0), this.z + dirZ, 20);
            } else if (!this.isGrounded && this.vy < 0 && mag > 0 && ![this.STATES.BONK, this.STATES.LEDGE_GRAB].includes(this.currentState)) {
                
                // Ledge Grab si cae suavemente (indiciando final del arco del salto tocando el filo alto)
                if (this.vy >= -40.0 && this.vy <= 0) {
                    this.currentState = this.STATES.LEDGE_GRAB;
                    this.vy = 0;
                    this.momentumX = 0;
                    this.momentumZ = 0;
                    if (this.vfxManager) this.vfxManager.emitDust(this.x, this.y, this.z, 10);
                } else {
                    // Cae muy rápido (supera -40), entonces resbala la pared
                    this.currentState = this.STATES.WALL_SLIDE;
                    this.momentumX = -dirX;
                    this.momentumZ = -dirZ;
                }
            }
        }

        // 4. Integración Y
        this.y += this.vy * dt;

        // Borde Abismal (Void Death)
        if (this.y < -50 && this.currentState !== this.STATES.DEAD) {
            this.health = 0;
            if (window.healthUI) {
                window.healthUI.update(this.health);
                window.healthUI.showDeathScreen();
            }
            this.currentState = this.STATES.DEAD;
            this.vy = this.jumpForce;
            
            setTimeout(() => {
                if (window.checkpointManager) window.checkpointManager.respawnPlayer(this);
                if (window.healthUI && window.healthUI.hideDeathScreen) window.healthUI.hideDeathScreen();
            }, 2500);
        }

        // Coleccionables (Monedas vs Estrellas)
        for (let i = this.scene.collectibles.length - 1; i >= 0; i--) {
            const col = this.scene.collectibles[i];
            const dist = Math.hypot(this.x - col.position.x, this.y - col.position.y, this.z - col.position.z);
            if (dist < this.radius + 1.5) { 
                this.scene.collectibles.splice(i, 1);
                
                if (col.type === 'star') {
                    this.currentState = this.STATES.CELEBRATE;
                    this.vy = this.jumpForce * 0.8; // Salto de victoria!
                    this.momentumX = 0; this.momentumZ = 0;
                    if (this.audioManager) this.audioManager.playJumpSynthesized(); // TODO: Métrica sFX Victoria
                    
                    // Disparar UI Overlay
                    if (window.missionManager) window.missionManager.triggerVictory(col.id);
                    // Disparar VFX destellos mágicos masivos
                    if (this.vfxManager) {
                        this.vfxManager.emitSparks(this.x, this.y, this.z, 30);
                        this.vfxManager.emitSparks(this.x, this.y + 2, this.z, 30);
                    }
                } else {
                    if (window.missionManager) window.missionManager.collectCacao();
                    if (this.audioManager) this.audioManager.playCacaoSynthesized();
                }
            }
        }

        // 5. Suelo Estático/Kinemático y Lava
        const floorData = Physics.checkFloorCollision(this, this.scene.platforms);
        if (floorData !== null && this.vy <= 0) {
            
            // Evaluamos Hazard Mortal (Lava)
            if (floorData.isLava && this.invulnTimer <= 0 && this.currentState !== this.STATES.LAVA_BURN) {
                // ... logic de lava intacto ...
                this.currentState = this.STATES.LAVA_BURN;
                this.health -= 3;
                if (window.healthUI) window.healthUI.update(this.health);
                
                if (this.health <= 0) {
                    this.currentState = this.STATES.DEAD;
                    this.vy = this.jumpForce;
                    if (window.healthUI) window.healthUI.showDeathScreen();
                    setTimeout(() => {
                        if (window.checkpointManager) window.checkpointManager.respawnPlayer(this);
                        if (window.healthUI && window.healthUI.hideDeathScreen) window.healthUI.hideDeathScreen();
                    }, 2500);
                } else {
                    this.vy = this.jumpForce * 1.5; 
                    this.momentumX = (Math.random() - 0.5) * 40;
                    this.momentumZ = (Math.random() - 0.5) * 40;
                    this.invulnTimer = 3.0;
                    if (this.audioManager) this.audioManager.playThudSynthesized(); 
                }
                return; // Cortocircuito lógico (No aterrizar)
            }

            // Evaluamos Slope Physics (Rampas Matemáticas Raycast)
            const isSlope = floorData.normal.y < 0.85; // Mayor a ~31 grados

            if (isSlope && this.currentState !== this.STATES.LAVA_BURN) {
                if (this.currentState !== this.STATES.SLIDING_SLOPE) {
                    this.currentState = this.STATES.SLIDING_SLOPE;
                    if (this.audioManager) this.audioManager.playJumpSynthesized(); // Swoosh de resbalo
                }
                
                // Vector Tangencial de Gravedad (Resbala hacia abajo empujado por la normal plana)
                const slideGravity = 45.0; // Gravedad inercial de la Mega Pirámide
                this.momentumX += floorData.normal.x * slideGravity * dt;
                this.momentumZ += floorData.normal.z * slideGravity * dt;
                
                // Fricción reducida
                this.momentumX *= 0.98;
                this.momentumZ *= 0.98;
                
                if (this.vfxManager && Math.random() < 0.4) {
                    this.vfxManager.emitDust(this.x, this.y, this.z, 2);
                }
                
                this.facingAngle = Math.atan2(this.momentumX, this.momentumZ);
                this.y = floorData.y + this.height;
                this.vy = 0;
                this.isGrounded = true;
                this.currentFloorSurface = 'normal';
            } 
            else {
                // Salir del modo resbaladilla si llegamos al llano
                if (this.currentState === this.STATES.SLIDING_SLOPE) {
                    this.currentState = this.STATES.NORMAL;
                }

                if (floorData.platform && floorData.platform.isMud) {
                    this.currentFloorSurface = 'mud';
                    this.isGrounded = true;
                    this.vy = -3.5; // Factor de hundimiento Activo (Quicksand)
                    
                    if (this.y < floorData.y + this.height * -0.5) { // Mitad ahogado
                        this.health = 0;
                        this.currentState = this.STATES.DEAD;
                        this.vy = this.jumpForce;
                        if (window.healthUI) { window.healthUI.update(this.health); window.healthUI.showDeathScreen(); }
                        setTimeout(() => {
                            if (window.checkpointManager) window.checkpointManager.respawnPlayer(this);
                            if (window.healthUI && window.healthUI.hideDeathScreen) window.healthUI.hideDeathScreen();
                        }, 2500);
                    } else if (this.y > floorData.y + this.height) { // Superficie inicial lodo
                        this.y = floorData.y + this.height; 
                    }
                } else {
                    this.currentFloorSurface = (floorData.platform && (floorData.platform.isObsidian || floorData.platform.isIce)) ? 'obsidian' : 'normal';
                    this.y = floorData.y + this.height;
                    this.vy = 0;
                    this.isGrounded = true;
                }
            }

            // Inheritance Kinemático: Si la plataforma tiene velocidad propia, se hereda sumando al jugador.
            if (floorData.platform && floorData.platform.velocity) {
                this.x += floorData.platform.velocity.x * dt;
                this.z += floorData.platform.velocity.z * dt;
            }
        } else {
            this.currentFloorSurface = 'normal'; // En el aire normal
            this.isGrounded = false;
        }

        // 6. Colisiones Físicas con Enemigos (Combate Dinámico Hitbox vs Hurtbox)
        if (this.invulnTimer <= 0 && this.currentState !== this.STATES.CELEBRATE) {
            for (let i = this.scene.enemies.length - 1; i >= 0; i--) {
                const enemy = this.scene.enemies[i];
                if (enemy.isDead) continue; // Skip sync pending deletions

                const dx = this.x - enemy.position.x;
                const dz = this.z - enemy.position.z;
                const dist2D = Math.hypot(dx, dz);
                const dy = this.y - enemy.position.y;
                
                // Cilindro Hurtbox (Asumimos tamaño genérico 1.0 y 2.0 altura temporalmente)
                if (dist2D < this.radius + 1.2 && dy > -this.height && dy < 2.5) {
                    
                    // Ataque: Jugador está cayendo desde arriba o usando un movimiento Ofensivo Activo (Punch, Kick, Dive)
                    const isVulnerableAngle = (this.vy < 0 && dy > 1.2) || 
                                              [this.STATES.GROUND_POUND, this.STATES.DIVE, this.STATES.PUNCH, this.STATES.JUMP_KICK].includes(this.currentState);

                    if (isVulnerableAngle) {
                        // APLASTADO O PATEADO: Elimina al enemigo / vasija
                        enemy.isDead = true; 
                        
                        // Drop Global de Moneda por defunción (Aplica a Pots, Jaguars, etc.)
                        if (window.spawnDynamicCoin) window.spawnDynamicCoin(enemy.position.x, enemy.position.y, enemy.position.z);

                        if (enemy.type === 'pot') {
                            if (this.audioManager) this.audioManager.playThudSynthesized(); // Sonido provisional rotura
                            if (this.vfxManager) {
                                this.vfxManager.emitDust(enemy.position.x, enemy.position.y + 1, enemy.position.z, 30);
                                this.vfxManager.emitDebris(enemy.position.x, enemy.position.y + 1, enemy.position.z, 5, 0x8B4513);
                            }
                        } else {
                            // Bounce Rebotador Tipo Mario para enemigos orgánicos
                            if (this.currentState !== this.STATES.GROUND_POUND) {
                                this.vy = this.jumpForce * 0.8; 
                                this.currentState = this.STATES.NORMAL;
                            }
    
                            if (this.audioManager) this.audioManager.playThudSynthesized(); 
                            if (this.vfxManager) {
                                this.vfxManager.emitDust(enemy.position.x, enemy.position.y + 1, enemy.position.z, 20);
                                this.vfxManager.emitSparks(enemy.position.x, enemy.position.y + 1, enemy.position.z, 15); // Hit sparks
                            }
                        }
                        
                        // Opcional: Curarse 1 Quesito o Esparcir Moneda (Queda para Metamissions)
                    } else {
                        // RECIBE DAÑO: Lateral o no atacativo (Jugador es golpeado por Hurtbox Nemesis)
                        this.health -= 1;
                        if (window.healthUI) window.healthUI.update(this.health);

                        if (this.health <= 0) {
                            this.currentState = this.STATES.DEAD;
                            this.vy = this.jumpForce; // Salto hacia muerte
                            // Ocultará UI en prox frames etc.
                        } else {
                            this.currentState = this.STATES.HURT;
                            this.invulnTimer = 2.0; // I-Frames (2 Segundos de Invulnerabilidad)
                            
                            // Elevación Knockback Suave
                            this.vy = this.jumpForce * 0.5; 
                            
                            // Vector de Rechazo Fuerte desde el centro del impacto
                            const pushDir = (dist2D === 0) ? 0.001 : dist2D;
                            this.momentumX = (dx / pushDir) * 12.0;
                            this.momentumZ = (dz / pushDir) * 12.0;
                        }

                        if (this.audioManager) this.audioManager.playThudSynthesized(); 
                        if (this.vfxManager) this.vfxManager.emitSparks(this.x, this.y, this.z, 15);
                    }
                }
            }
        }
    }
}
