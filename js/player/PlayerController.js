import * as THREE from 'three';

export class PlayerController {
    constructor(playerMesh, camera, collisionMeshes) {
        this.player = playerMesh;
        this.camera = camera;
        this.collisionMeshes = collisionMeshes;

        // Físicas del jugador
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 10.0;         // Velocidad base PS2
        this.jumpForce = 18.0;     // Fuerza de salto precisa
        this.gravity = -45.0;      // Gravedad contundente (menos flotante)
        
        // Físicas avanzadas
        this.acceleration = 45.0;
        this.friction = 25.0;      // Fricción en suelo
        this.airFriction = 5.0;    // Fricción en el aire
        this.terminalVelocity = -60.0;
        this.maxSlopeAngle = Math.PI / 4; // 45 grados máximo escalable

        this.onGround = false;

        // Combos y acrobacias
        this.jumpCount = 0;
        this.lastLandTime = 0;
        this.comboJumpWindow = 0.25;
        this.time = 0;
        this.touchingWallNormal = null;
        this.wasJumpPressed = false;
        
        // Raycaster para colisiones simples
        this.raycaster = new THREE.Raycaster();
        
        // Asume un CapsuleGeometry(0.5, 1) -> Radio = 0.5, Altura Total = 2.0
        this.playerHeight = 2.0;    
        this.playerRadius = 0.5;
        this.raycastSkinOffset = 0.1; // Margen de error para evitar clipeo
    }

    // Calcula movimiento horizontal relativo a la cámara
    calculateMovementDirection(inputs) {
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();

        const camRight = new THREE.Vector3();
        camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

        this.direction.set(0, 0, 0);

        if (inputs.forward) this.direction.add(camDir);
        if (inputs.backward) this.direction.sub(camDir);
        if (inputs.left) this.direction.sub(camRight);
        if (inputs.right) this.direction.add(camRight);

        if (this.direction.lengthSq() > 0) {
            this.direction.normalize();
        }
    }

    updateMovement(inputs, deltaTime) {
        this.time += deltaTime;
        this.touchingWallNormal = null;

        // 1. Calcular Input Horizontal
        this.calculateMovementDirection(inputs);

        // 2. Comprobar Suelo (Ground Detection)
        this.onGround = false;
        const origin = this.player.position.clone();
        
        // Raycaster hacia abajo desde el centro del jugador
        this.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
        let intersects = this.raycaster.intersectObjects(this.collisionMeshes, false);
        
        const halfHeight = this.playerHeight / 2;

        if (intersects.length > 0) {
            const hit = intersects[0];
            // Si la distancia al suelo es casi media altura (con margen para bajadas inclinadas)
            if (hit.distance <= halfHeight + 0.15) {
                // Si la asunción de velocidad y es negativa (cayendo), evaluamos suelo.
                if (this.velocity.y <= 0) {
                    let slopeAngle = 0;
                    if (hit.face) {
                        const normal = hit.face.normal.clone();
                        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                        normal.applyMatrix3(normalMatrix).normalize();
                        slopeAngle = normal.angleTo(new THREE.Vector3(0, 1, 0));
                    }

                    if (slopeAngle <= this.maxSlopeAngle) {
                        if (!this.onGround) {
                            this.lastLandTime = this.time;
                        }
                        this.onGround = true;
                        this.velocity.y = 0;
                        // Snap al nivel exacto del suelo para no clipear
                        this.player.position.y = hit.point.y + halfHeight;
                    }
                    // Si el ángulo es mayor, resbalamos y no nos plantamos
                }
            }
        }

        // 3. Salto (Combos: Doble y Triple)
        if (inputs.jump && this.onGround && !this.wasJumpPressed) {
            const horizSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
            
            if (this.time - this.lastLandTime <= this.comboJumpWindow && horizSpeed > 5.0) {
                this.jumpCount = Math.min(this.jumpCount + 1, 2);
            } else {
                this.jumpCount = 0;
            }

            let force = this.jumpForce;
            if (this.jumpCount === 1) force *= 1.25; // Salto Doble (25% más alto)
            if (this.jumpCount === 2) {
                force *= 1.45; // Salto Triple (45% más alto)
                // Boost frontal para el Triple Jump
                if (this.direction.lengthSq() > 0) {
                    this.velocity.x += this.direction.x * 6.0;
                    this.velocity.z += this.direction.z * 6.0;
                }
            }

            this.velocity.y = force;
            this.onGround = false;
            this.lastLandTime = 0; // Prevenir triggear repetidas veces en el frame
        }

        // 4. Aplicar Gravedad y Variable Jump
        if (!this.onGround) {
            let currentGrav = this.gravity;
            // Short hop: Si dejamos de presionar salto al subir, aplicamos extra gravedad
            if (!inputs.jump && this.velocity.y > 0) {
                currentGrav *= 2.0; 
            }
            this.velocity.y += currentGrav * deltaTime;
            
            if (this.velocity.y < this.terminalVelocity) {
                this.velocity.y = this.terminalVelocity;
            }
        }

        // 5. Aplicar Velocidad Horizontal (Inercia y Fricción)
        if (this.direction.lengthSq() > 0) {
            // Aceleración
            this.velocity.x += this.direction.x * this.acceleration * deltaTime;
            this.velocity.z += this.direction.z * this.acceleration * deltaTime;
            
            // Límite de velocidad
            const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
            if (horizontalSpeed > this.speed) {
                const ratio = this.speed / horizontalSpeed;
                this.velocity.x *= ratio;
                this.velocity.z *= ratio;
            }
        } else {
            // Fricción
            const currentFriction = this.onGround ? this.friction : this.airFriction;
            this.velocity.x -= this.velocity.x * currentFriction * deltaTime;
            this.velocity.z -= this.velocity.z * currentFriction * deltaTime;

            // Parada absoluta si es muy lento (para evitar micro deslizamientos)
            if (this.onGround && Math.abs(this.velocity.x) < 0.2) this.velocity.x = 0;
            if (this.onGround && Math.abs(this.velocity.z) < 0.2) this.velocity.z = 0;
        }

        // 6. Comprobar Colisión de Paredes Cruda (Horizontal Raycast)
        // Usamos la velocidad real (inercia) como dirección del rayo en vez del input del joystick
        const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
        
        if (horizontalVelocity.lengthSq() > 0.001) {
            const moveDir = horizontalVelocity.clone().normalize();
            const nextDist = horizontalVelocity.length() * deltaTime;

            // Evaluamos Cabeza, Centro y Pies para que no pase ni por arriba ni por abajo
            const castPoints = [
                this.player.position.clone().add(new THREE.Vector3(0, halfHeight - 0.2, 0)), // Cabeza
                this.player.position.clone(),                                                // Centro
                this.player.position.clone().add(new THREE.Vector3(0, -halfHeight + 0.2, 0)) // Pies
            ];
            
            for (let point of castPoints) {
                this.raycaster.set(point, moveDir);
                // true para detectar caras dentro de pirámides u objetos cargados (Groups/GLTF)
                let wallHits = this.raycaster.intersectObjects(this.collisionMeshes, true);
                
                if (wallHits.length > 0 && wallHits[0].distance < this.playerRadius + nextDist + this.raycastSkinOffset) {
                    const hit = wallHits[0];
                    if (hit.face) {
                        const normal = hit.face.normal.clone();
                        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                        normal.applyMatrix3(normalMatrix).normalize();
                        
                        // Extraemos la componente plana de la normal (ignorar si es suelo/techo)
                        const horizNormal = new THREE.Vector3(normal.x, 0, normal.z);
                        if (horizNormal.lengthSq() > 0.001) {
                            horizNormal.normalize();
                            const dot = horizontalVelocity.dot(horizNormal);
                            if (dot < 0) {
                                // Deslizamiento horizontal puro contra la pared
                                this.touchingWallNormal = horizNormal.clone(); // Guardamos para Wall Kick
                                const projection = horizNormal.multiplyScalar(dot);
                                horizontalVelocity.sub(projection);
                                
                                this.velocity.x = horizontalVelocity.x;
                                this.velocity.z = horizontalVelocity.z;
                            }
                        }
                    } else {
                        // Fallback: Si no hay cara detectada
                        this.velocity.x = 0;
                        this.velocity.z = 0;
                    }
                    break; // Solo corregimos velocidad una vez por frame (con el primer impacto cercano)
                }
            }
        }

        // 6.5 Wall Kick (Rebote en paredes SM64 style)
        if (!this.onGround && this.touchingWallNormal && inputs.jump && !this.wasJumpPressed) {
            // Fuerte impulso vertical
            this.velocity.y = this.jumpForce * 1.15;
            
            // Rebote físico hacia afuera de la pared
            this.velocity.x = this.touchingWallNormal.x * this.speed * 1.4;
            this.velocity.z = this.touchingWallNormal.z * this.speed * 1.4;
            
            // Giramos el personaje hacia donde sale rebotado
            this.direction.copy(this.touchingWallNormal);
            this.jumpCount = 0; // Reset de combo por seguridad
        }

        this.wasJumpPressed = inputs.jump;

        // 7. Actualizar Posición
        this.player.position.x += this.velocity.x * deltaTime;
        this.player.position.y += this.velocity.y * deltaTime;
        this.player.position.z += this.velocity.z * deltaTime;

        // 8. Rotar malla
        // NOTA: Para PS2+ el lerp de rotación de quaternion sería superior.
        if (this.direction.lengthSq() > 0.001) {
            const lookPos = this.player.position.clone().add(this.direction);
            
            // Creamos un dummy target para quaternions suaves
            const targetMatrix = new THREE.Matrix4().lookAt(
                this.player.position, 
                lookPos, 
                new THREE.Vector3(0, 1, 0)
            );
            const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(targetMatrix);
            this.player.quaternion.slerp(targetQuaternion, deltaTime * 12.0);
        }
    }
}
