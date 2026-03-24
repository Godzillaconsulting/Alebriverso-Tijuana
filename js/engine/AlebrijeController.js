// js/engine/AlebrijeController.js
// Controlador de personaje en 3D con físicas estilo Super Mario 64

class AlebrijeController {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // ── SM64 Física & States ──
        this.velocity = new THREE.Vector3();
        this.currentForwardSpeed = 0;
        this.maxWalkSpeed = 12;
        this.jumpForce = 18;
        this.gravity = -45;
        
        this.isOnGround = false;
        this.state = 'IDLE'; // IDLE, WALKING, JUMPING, FALLING
        
        // ── Input ──
        this.inputDir = new THREE.Vector2(0, 0); 
        this.inputVector = new THREE.Vector3(0, 0, 0); 
        this.jumpPressed = false;
        this.actionPressed = false; // Z Button (SM64)
        this.jumpCount = 0;
        this.lastJumpTime = 0;
        
        // ── Objeto del Jugador (Hitbox Físico) ──
        this.playerGroup = new THREE.Group();
        this.playerGroup.position.set(0, 5, 5); // Empezar un poco arriba y atrás
        this.scene.add(this.playerGroup);
        
        // Mesh Placeholder (Cápsula de colisión visible por defecto)
        const geometry = typeof THREE.CapsuleGeometry !== 'undefined' 
            ? new THREE.CapsuleGeometry(0.5, 1, 4, 8) 
            : new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xff3fa4, wireframe: false });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = 1;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.playerGroup.add(this.mesh);

        // --- SISTEMA DE ANIMACIÓN 3D (GLTF) ---
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.modelLoaded = false;
        
        this._loadModel();
        
        // ── Cámara Lakitu (Chase 3rd Person) ──
        this.cameraDistance = 12;
        this.cameraHeight = 5;
        this.cameraAngle = Math.PI; // Inicia mirando la espalda
        
        // Mundo
        this.environmentMeshes = [];
        this.raycaster = new THREE.Raycaster();
        
        // Anti-Jitter Camera Target
        this.smoothedLookTarget = new THREE.Vector3(0, 5, 0);
        
        // ── Combat & Effects ──
        this.currentHitbox = null;
        this.particles = [];    
        // SM64 Cosmic Clone (Memoria Vectorial Neuronal)
        this.positionHistory = [];
    }
    
    setEnvironment(meshes) {
        this.environmentMeshes = meshes;
    }
    
    setInput(x, y, jump, action) {
        this.inputVector.set(x, 0, y); // Y de joystick es Z en 3D
        if (this.inputVector.length() > 1) this.inputVector.normalize();
        this.jumpPressed = jump;
        this.actionPressed = action || false;
    }

    _loadModel() {
        if (typeof THREE.GLTFLoader === 'undefined') return;
        const loader = new THREE.GLTFLoader();
        loader.load('assets/models/tijuana.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(1, 1, 1);
            model.position.y = 0; // Base de la cápsula
            
            model.traverse((child) => {
                if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            });

            this.playerGroup.add(model);
            this.mesh.visible = false; // Ocultar cápsula de debug
            this.modelLoaded = true;
            this.gltfModel = model;

            // Configurar Animaciones
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(model);
                // Extraer animaciones por nombre o por índice
                gltf.animations.forEach((clip) => {
                    const action = this.mixer.clipAction(clip);
                    this.animations[clip.name.toLowerCase()] = action;
                });
                
                // Mapeo Inteligente (Tolerancia a nombres de Mixamo)
                this._bindAnimation('idle', ['idle', 'stand', 'posestatic']);
                this._bindAnimation('run', ['run', 'walk', 'sprint', 'move']);
                this._bindAnimation('jump', ['jump', 'leap', 'fall']);
                
                this.playAnimation('idle');
            }
            console.log("Alebrije GLTF Model Loaded successfully!");
        }, undefined, (error) => {
            console.warn("No Tijuana GLTF model found. Using procedural capsule fallback. Drop tijuana.glb in assets/models/ to see animations.");
        });
    }

    _bindAnimation(clave, aliasArray) {
        let found = aliasArray.find(a => this.animations[a]);
        if (found) this.animations[clave] = this.animations[found];
    }

    playAnimation(name) {
        if (!this.mixer || !this.animations[name]) return;
        const nextAction = this.animations[name];
        if (this.currentAction === nextAction) return;

        if (this.currentAction) {
            this.currentAction.fadeOut(0.2); // Smooth blending
        }
        nextAction.reset().fadeIn(0.2).play();
        this.currentAction = nextAction;
    }
    
    update(delta) {
        if (!this.targetScale) this.targetScale = new THREE.Vector3(1,1,1);
        this.playerGroup.scale.lerp(this.targetScale, 15 * delta);
        this._updateCombatAndEffects(delta);

        const inputMag = Math.min(this.inputVector.length(), 1.0);
        const actionJustPressed = this.actionPressed && !this.wasActionPressed;
        this.wasActionPressed = this.actionPressed;

        if (this.state !== 'ATTACK' && this.state !== 'GROUND_POUND_DROP') this.isAttacking = false;

        // --- SM64 MOVESET BÁSICO ---
        if (actionJustPressed) {
            if (this.isOnGround) {
                if (this.currentForwardSpeed > 6) {
                    this.state = 'CROUCH'; // Z mientras corres prepara Salto Largo
                    this.playerGroup.scale.set(1.5, 0.5, 1.5);
                } else {
                    this.state = 'ATTACK'; // Z Quieto = Spin Attack
                    this.actionTimer = 0;
                    this.isAttacking = true;
                    this._spawnDustParticles(this.playerGroup.position, 3);
                }
            } else {
                 if (this.state !== 'GROUND_POUND' && this.state !== 'GROUND_POUND_DROP') {
                     this.state = 'GROUND_POUND'; // Z en el aire = Pisotón
                     this.actionTimer = 0;
                     this.velocity.set(0, 0, 0); // Congelar caída a lo Mario
                     this.currentForwardSpeed = 0;
                     this.playerGroup.scale.set(0.6, 1.5, 0.6); // Stretch de preparación
                 }
            }
        }

        // Ejecución de Estados Especiales (SM64 Physics Overrides)
        if (this.state === 'GROUND_POUND') {
             this.actionTimer += delta;
             this.velocity.set(0, 0, 0); 
             this.playerGroup.rotation.y += 20 * delta; // Front flip exagerado
             if (this.actionTimer > 0.3) {
                 this.state = 'GROUND_POUND_DROP';
                 this.velocity.y = -60; // Caída terminal inmediata
                 this.playerGroup.scale.set(0.3, 2.0, 0.3); // High stretch
             }
        } else if (this.state === 'GROUND_POUND_DROP') {
             this.isAttacking = true;
             this.velocity.y -= 120 * delta; // Extra gravedad
        } else if (this.state === 'ATTACK') {
             this.actionTimer += delta;
             this.playerGroup.rotation.y += 25 * delta; // Spin de ataque tipo Crash
             this.currentForwardSpeed = Math.max(0, this.currentForwardSpeed - 50 * delta); // Fricción violenta
             if (this.actionTimer > 0.4) {
                 this.state = 'IDLE';
                 this.isAttacking = false;
                 this.playerGroup.rotation.y = 0;
             }
        } else if (!this.actionPressed && this.state === 'CROUCH') {
             this.state = 'IDLE';
        }

        // 1. Movimiento relativo a la cámara y Aceleración inercial (Estilo SM64)
        if (inputMag > 0.1 && this.state !== 'PUNCHING' && this.state !== 'ATTACK') {
            const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            camForward.y = 0; camForward.normalize();
            
            const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            camRight.y = 0; camRight.normalize();
            
            const moveDir = new THREE.Vector3()
                .addScaledVector(camRight, this.inputVector.x)
                .addScaledVector(camForward, this.inputVector.z) // Adelante = +Y en pad
                .normalize();
                
            const targetSpeed = inputMag * this.maxWalkSpeed;
            
            // Inercia suave hacia el target
            if (this.currentForwardSpeed < targetSpeed) {
                this.currentForwardSpeed += 25 * delta; // Aceleración
            } else {
                this.currentForwardSpeed -= 30 * delta; // Desaceleración al soltar/girar
            }
            this.currentForwardSpeed = Math.max(0, Math.min(this.currentForwardSpeed, targetSpeed));
            
            // Rotar malla suavemente hacia la dirección de movimiento
            const targetRotation = Math.atan2(moveDir.x, moveDir.z);
            let diff = targetRotation - this.playerGroup.rotation.y;
            while(diff < -Math.PI) diff += Math.PI * 2;
            while(diff > Math.PI) diff -= Math.PI * 2;
            
            this.playerGroup.rotation.y += diff * 12 * delta;
            
            if (this.isOnGround) this.state = 'WALKING';
        } else {
            // Fricción
            if (this.isOnGround) {
                this.currentForwardSpeed = Math.max(0, this.currentForwardSpeed - 40 * delta);
                if (this.currentForwardSpeed === 0 && this.state !== 'PUNCHING') this.state = 'IDLE';
            }
        }
        
        // --- Combate: PUNCHING COMBO (Z/ATK on ground, standing still) ---
        if (this.actionPressed && this.isOnGround && this.currentForwardSpeed < 3 && this.state !== 'PUNCHING' && this.state !== 'DIVING') {
            const now = Date.now();
            if (now - this.lastActionTime > 300) { // Cooldown entre golpes
                this.state = 'PUNCHING';
                this.punchComboStep = (this.punchComboStep || 0) + 1;
                if (this.punchComboStep > 3 || (now - this.lastActionTime > 800)) this.punchComboStep = 1; // Reset combo
                
                this.currentForwardSpeed = 0; this.velocity.x = 0; this.velocity.z = 0;
                this.lastActionTime = now;
                this.punchTimer = now;
                
                // Hitbox Frontal. Radio 1.5, offset 2, dura 300ms
                this._generateMeleeHitbox(1.5, 2.0, 300);
            }
        }

        // Resolución de PUNCHING state
        if (this.state === 'PUNCHING') {
            this.currentForwardSpeed = 0;
            if (Date.now() - this.punchTimer > 350) {
                this.state = 'IDLE';
            }
        }
        
        // Ground Pound (Z in air)
        if (this.actionPressed && !this.isOnGround && this.state !== 'GROUND_POUNDING' && this.state !== 'DIVING') {
            this.state = 'GROUND_POUNDING';
            this.currentForwardSpeed = 0;
            this.velocity.x = 0;
            this.velocity.z = 0;
            this.velocity.y = -60; // Caída hiper rápida
        }
        
        // Lógica de Salto
        if (this.jumpPressed && this.isOnGround) {
            const now = Date.now();
            
            if (this.state === 'CROUCH') {
                 // --- LONG JUMP / SALTO LARGO (YAHOO!) ---
                 this.velocity.y = this.jumpForce * 0.75; // Salto bajo
                 this.currentForwardSpeed = 22; // Inercia frontal masiva
                 this.playerGroup.scale.set(0.6, 1.2, 0.6);
            } else {
                 // Lógica de Triple Salto (Estilo SM64)
                 if (this.currentForwardSpeed > 4 && (now - this.lastJumpTime) < 600) {
                     this.jumpCount++;
                 } else {
                     this.jumpCount = 1;
                 }
                 
                 if (this.jumpCount > 3) this.jumpCount = 1;
                 
                 if (this.jumpCount === 1) this.velocity.y = this.jumpForce;
                 else if (this.jumpCount === 2) this.velocity.y = this.jumpForce * 1.15;
                 else if (this.jumpCount === 3) this.velocity.y = this.jumpForce * 1.45; // El gran salto final
                 
                 this.playerGroup.scale.set(0.5, 1.6, 0.5); // ¡STRETCH!
                 this._spawnDustParticles(this.playerGroup.position, 4);
            }

            this.lastJumpTime = now;
            this.isOnGround = false;
            this.state = 'JUMPING';
        } 
        else if (this.actionPressed && this.isOnGround && this.currentForwardSpeed > 4 && this.state !== 'DIVING') {
            // DIVE (Z while running)
            const now = Date.now();
            if (now - this.lastActionTime > 600) {
                this.state = 'DIVING';
                this.velocity.y = this.jumpForce * 0.4;
                this.currentForwardSpeed = Math.min(this.maxWalkSpeed * 1.5, this.currentForwardSpeed + 15);
                this.isOnGround = false;
                this.playerGroup.scale.set(0.8, 0.4, 1.8); // Stretch frontal
                this.lastActionTime = now;
                // Hitbox Frontal Grande (Tacleada). Radio 2, offset 1, dura 500ms
                this._generateMeleeHitbox(2.2, 1.0, 500);
            }
        }

        
        const forward = new THREE.Vector3(Math.sin(this.playerGroup.rotation.y), 0, Math.cos(this.playerGroup.rotation.y));
        this.velocity.x = forward.x * this.currentForwardSpeed;
        this.velocity.z = forward.z * this.currentForwardSpeed;
        
        // 2. Gravedad
        this.velocity.y += this.gravity * delta;
        
        // 3. Resolución Deslizante Continua (Continuous Collision / Slide)
        const nextPos = this.playerGroup.position.clone();
        
        // Detectar Paredes (Frente)
        if (this.environmentMeshes.length > 0 && this.currentForwardSpeed > 0) {
            const origin = nextPos.clone().add(new THREE.Vector3(0, 0.6, 0)); // Altura pecho
            this.raycaster.set(origin, forward);
            const intersects = this.raycaster.intersectObjects(this.environmentMeshes);
            if (intersects.length > 0 && intersects[0].distance < 0.8) {
                // Hay pared cerca -> Slide Effect
                const normal = intersects[0].face.normal.clone().transformDirection(intersects[0].object.matrixWorld).normalize();
                const velXZ = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
                const dot = velXZ.dot(normal);
                if (dot < 0) { // Si empuja contra la normal
                    velXZ.addScaledVector(normal, -dot); // Proyecta el remanente ortogonalmente
                    this.velocity.x = velXZ.x;
                    this.velocity.z = velXZ.z;
                    // Ajustar pos para prevenir interpenetración (Quarter step fix)
                    nextPos.addScaledVector(normal, 0.8 - intersects[0].distance);
                }
            }
        }
        
        // Aplicar Velocity Z, X
        nextPos.x += this.velocity.x * delta;
        nextPos.z += this.velocity.z * delta;
        nextPos.y += this.velocity.y * delta;
        
        // 4. Colisión Suelo/Techo
        this.isOnGround = false;
        
        if (this.environmentMeshes.length > 0) {
            // Rayo hacia abajo para encontrar Suelo
            this.raycaster.set(new THREE.Vector3(nextPos.x, nextPos.y + 1, nextPos.z), new THREE.Vector3(0,-1,0));
            const hitFloor = this.raycaster.intersectObjects(this.environmentMeshes);
            if (hitFloor.length > 0) {
                const groundHeight = hitFloor[0].point.y;
                if (nextPos.y <= groundHeight + 0.6) { // 0.6 = radio capsula inferior
                    nextPos.y = groundHeight + 0.6;
                    if (this.velocity.y <= 0) {
                        this.velocity.y = 0;
                        if (!this.isOnGround) {
                            if (this.state === 'GROUND_POUNDING') {
                                this.playerGroup.scale.set(2.4, 0.2, 2.4); // SUPER SQUASH
                                this._spawnDustParticles(this.playerGroup.position, 15);
                                this._generateMeleeHitbox(3.5, 0.0, 200); // Pisotón Radial AOE
                                // TODO: Shake Cam / Damage Area
                            } else {
                                this.playerGroup.scale.set(1.6, 0.5, 1.6); // SQUASH NORMAL
                                this._spawnDustParticles(this.playerGroup.position, 8);
                            }
                        }
                        this.isOnGround = true;

                        if (this.state === 'DIVING') {
                            this.currentForwardSpeed *= 0.5; // Fricción al aterrizar de pansa
                        } else if (this.state === 'GROUND_POUNDING') {
                            this.state = 'IDLE';
                        } else {
                            if (this.state !== 'WALKING') this.state = 'IDLE';
                        }
                    }
                }
            } else {
                // Abismo fallback provisorio
                if (nextPos.y < 0.6) {
                    nextPos.y = 0.6;
                    this.velocity.y = 0;
                    this.isOnGround = true;
                }
            }
            
            // Rayo hacia arriba (Techo) al saltar
            if (!this.isOnGround && this.velocity.y > 0) {
                this.raycaster.set(new THREE.Vector3(nextPos.x, nextPos.y + 0.6, nextPos.z), new THREE.Vector3(0,1,0));
                const hitCeil = this.raycaster.intersectObjects(this.environmentMeshes);
                if (hitCeil.length > 0 && hitCeil[0].distance < 0.8) { // Cerca del techo
                    this.velocity.y = -2; // Resbalar hacia abajo
                }
            }
            
        } else {
            // Piso por defecto sin mallas
            if (nextPos.y < 0.6) {
                nextPos.y = 0.6;
                if (this.velocity.y <= 0) {
                    this.velocity.y = 0;
                    if (!this.isOnGround) {
                        this.playerGroup.scale.set(1.6, 0.5, 1.6); // ¡SQUASH!
                        this._spawnDustParticles(this.playerGroup.position, this.state === 'GROUND_POUND_DROP' ? 15 : 8);
                        // Bounce if ground pound
                        if (this.state === 'GROUND_POUND_DROP') { this.velocity.y = 8; this.jumpCount = 0; }
                    }
                    this.isOnGround = true;
                    if (this.state !== 'CROUCH') this.state = 'IDLE';
                }
            }
        }
        
        // Partículas de polvo al correr
        if (this.isOnGround && this.currentForwardSpeed > 8 && Math.random() < 0.3) {
            this._spawnDustParticles(nextPos, 1);
        }

        // Aplicar Movimiento Físico
        this.playerGroup.position.copy(nextPos);
        
        // Grabar Memoria Neuronal (Para Shadow Clone estilo Super Mario Galaxy)
        this.positionHistory.push({
             pos: this.playerGroup.position.clone(),
             rot: this.playerGroup.rotation.y,
             scale: this.playerGroup.scale.clone()
        });
        if (this.positionHistory.length > 70) this.positionHistory.shift(); // Delay de ~1.1s (a 60fps)

        // 5. Cámara Lakitu: Persiguiendo al personaje con Lerp y Anti-clipping
        const idealOffset = new THREE.Vector3(
            Math.sin(this.cameraAngle) * this.cameraDistance,
            this.cameraHeight,
            Math.cos(this.cameraAngle) * this.cameraDistance
        );
        
        const idealCameraPos = this.playerGroup.position.clone().add(idealOffset);
        
        // Raycast desde el jugador hacia la cámara para evitar atravesar paredes
        const dirToCam = idealCameraPos.clone().sub(this.playerGroup.position).normalize();
        this.raycaster.set(this.playerGroup.position.clone().add(new THREE.Vector3(0, 1.5, 0)), dirToCam);
        
        if (this.environmentMeshes.length > 0) {
            const camHits = this.raycaster.intersectObjects(this.environmentMeshes);
            if (camHits.length > 0 && camHits[0].distance < this.cameraDistance) {
                // Acercar la cámara para que no perfore la pared
                idealCameraPos.copy(this.playerGroup.position).addScaledVector(dirToCam, camHits[0].distance - 0.5);
            }
        }
        
        // Acercar cámara suavemente (Efecto Resorte Lakitu)
        this.camera.position.lerp(idealCameraPos, 8 * delta);
        
        // Mirar siempre un poco por encima del jugador, suavizado
        const lookTarget = this.playerGroup.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        this.smoothedLookTarget.lerp(lookTarget, 10 * delta);
        
        this.camera.lookAt(this.smoothedLookTarget);

        // --- GESTIÓN DE ANIMACIONES ---
        this._updateAnimationState();
        if (this.mixer) this.mixer.update(delta);
    }
    
    _updateAnimationState() {
        if (!this.mixer) return;
        
        if (!this.isOnGround) {
            if (this.state === 'GROUND_POUNDING') this.playAnimation('attack');
            else if (this.state === 'DIVING') this.playAnimation('run');
            else this.playAnimation('jump');
        } else if (this.currentForwardSpeed > 0.1) {
            this.playAnimation('run');
            // Ajustar velocidad de la animación a la velocidad de movimiento
            if (this.currentAction && this.currentAction === this.animations['run']) {
                this.currentAction.timeScale = Math.max(0.5, this.currentForwardSpeed / this.maxWalkSpeed);
            }
        } else {
            if (this.state === 'GROUND_POUNDING') this.playAnimation('attack'); // Recuperación
            else this.playAnimation('idle');
            
            if (this.currentAction) this.currentAction.timeScale = 1.0;
        }
    }
    
    // ── Combat Hitboxes & FX ──
    _generateMeleeHitbox(radius, offsetForward, durationMs) {
        if (!this.scene) return;
        const hitboxMat = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true, transparent:true, opacity:0.3});
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), hitboxMat);
        
        const forward = new THREE.Vector3(Math.sin(this.playerGroup.rotation.y), 0, Math.cos(this.playerGroup.rotation.y));
        mesh.position.copy(this.playerGroup.position).addScaledVector(forward, offsetForward);
        mesh.position.y += 1;
        
        this.scene.add(mesh);
        this.currentHitbox = { mesh: mesh, birth: Date.now(), lifespan: durationMs, offsetForward: offsetForward, radius: radius };
    }

    _spawnDustParticles(pos, count) {
        if (!this.scene) return;
        for(let i=0; i<count; i++) {
            const size = Math.random() * 0.4 + 0.1;
            const mat = new THREE.MeshBasicMaterial({color: 0xdddddd, transparent:true, opacity:0.6});
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
            mesh.position.copy(pos);
            mesh.position.x += (Math.random()-0.5)*2; mesh.position.z += (Math.random()-0.5)*2;
            mesh.userData = { velY: Math.random()*3 + 1, birth: Date.now() };
            this.scene.add(mesh);
            this.particles.push(mesh);
        }
    }

    _updateCombatAndEffects(time) {
        // Hitbox Tracker
        if (this.currentHitbox) {
            const forward = new THREE.Vector3(Math.sin(this.playerGroup.rotation.y), 0, Math.cos(this.playerGroup.rotation.y));
            this.currentHitbox.mesh.position.copy(this.playerGroup.position).addScaledVector(forward, this.currentHitbox.offsetForward);
            this.currentHitbox.mesh.position.y += 1;
            
            if (Date.now() - this.currentHitbox.birth > this.currentHitbox.lifespan) {
                this.scene.remove(this.currentHitbox.mesh);
                this.currentHitbox = null;
            }
        }
        
        // Particles Tracker
        for(let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.position.y += p.userData.velY * 0.016;
            p.userData.velY -= 5 * 0.016; // gravity
            p.scale.multiplyScalar(0.95);
            if (Date.now() - p.userData.birth > 500) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            }
        }
    }
    
    // Orbital control
    orbitCamera(deltaX, deltaY) {
        this.cameraAngle -= deltaX * 0.01;
        this.cameraHeight += deltaY * 0.05;
        this.cameraHeight = Math.max(1, Math.min(this.cameraHeight, 15));
    }
}
