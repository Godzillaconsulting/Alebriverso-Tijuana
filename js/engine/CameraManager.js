import * as THREE from 'three';

export default class CameraManager {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;

        this.MODES = {
            CHASE: 0,
            FIXED: 1,
            FIRST_PERSON: 2,
            CELEBRATE: 3
        };
        this.currentMode = this.MODES.CHASE;
        this.fixedPosition = new THREE.Vector3();

        // Zonas de Cámara y Oclusión
        this.zones = [];
        this.collisionMeshes = [];
        this.raycaster = new THREE.Raycaster();

        // Coordenadas esféricas relativas al jugador (Zoom Ultra Alejado para Panorama de Exploración)
        this.radius = 45.0;
        this.baseRadius = 45.0;
        this.azimuthAngle = Math.PI; // Iniciar detrás
        this.polarAngle = Math.PI / 3.5; 

        // Sistema elástico para seguimiento suave
        this.target = new THREE.Vector3(0, 0, 0);
        this.currentFocus = new THREE.Vector3(0, 0, 0);

        this.isDragging = false;
        
        this._setupInput();
    }

    setCollisionMeshes(meshes) {
        this.collisionMeshes = meshes;
    }

    addZone(zone) {
        this.zones.push(zone);
    }

    _setupInput() {
        this.domElement.addEventListener('mousedown', (e) => {
            // Solo actuar si clickamos en el canvas
            this.isDragging = true;
            this.domElement.requestPointerLock = this.domElement.requestPointerLock || this.domElement.mozRequestPointerLock;
            this.domElement.requestPointerLock();
        });

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement !== this.domElement) return;

            const deltaX = e.movementX || e.mozMovementX || 0;
            const deltaY = e.movementY || e.mozMovementY || 0;

            const sensitivity = 0.005;
            this.azimuthAngle -= deltaX * sensitivity;
            this.polarAngle -= deltaY * sensitivity;

            // Clamping vertical estándar excepto primera persona total
            const maxPitch = this.currentMode === this.MODES.FIRST_PERSON ? Math.PI - 0.1 : Math.PI / 2 - 0.1;
            this.polarAngle = Math.max(0.1, Math.min(maxPitch, this.polarAngle));
        });

        this.domElement.addEventListener('wheel', (e) => {
            this.baseRadius += e.deltaY * 0.02;
            this.baseRadius = Math.max(10, Math.min(60, this.baseRadius));
            if (this.currentMode === this.MODES.CHASE) this.radius = this.baseRadius;
        });

        // Switch Automático a Primera Persona
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'v') {
                if (this.currentMode === this.MODES.CHASE) {
                    this.currentMode = this.MODES.FIRST_PERSON;
                    this.radius = 0.1;
                } else if (this.currentMode === this.MODES.FIRST_PERSON) {
                    this.currentMode = this.MODES.CHASE;
                    this.radius = this.baseRadius;
                }
            }
        });
    }

    /**
     * Resuelve Físicas de Cámara, Perspectiva y Orbitaje cada Frame
     * @param {number} dt Delta time
     * @param {Object} player Hitbox o Posición de Tracking
     */
    update(dt, player) {
        if (!player) return;

        // 1. Check Camera Volume Triggers (CCTV Zones)
        let inFixedZone = false;
        for (const zone of this.zones) {
            if (zone.box.containsPoint(new THREE.Vector3(player.x, player.y, player.z))) {
                this.currentMode = this.MODES.FIXED;
                this.fixedPosition.copy(zone.cameraPos);
                inFixedZone = true;
                break;
            }
        }
        if (!inFixedZone && this.currentMode === this.MODES.FIXED) {
            this.currentMode = this.MODES.CHASE;
            this.radius = this.baseRadius;
        }

        // --- CANNON FIRST PERSON OVERRIDE ---
        if (player.currentState === player.STATES.CANNON_AIMING) {
            // First person looking out of the cannon
            this.camera.position.set(player.x, player.y + 1.0, player.z); // En la punta del cañón
            
            const aimPitch = player.cannonPitch || 0;
            const lookX = player.x + 10 * Math.sin(player.facingAngle) * Math.cos(aimPitch);
            const lookY = player.y + 1.0 + 10 * Math.sin(aimPitch);
            const lookZ = player.z + 10 * Math.cos(player.facingAngle) * Math.cos(aimPitch);
            
            this.camera.lookAt(lookX, lookY, lookZ);
            
            // Sync para que al volar no haya latigazo de cámara
            this.azimuthAngle = player.facingAngle + Math.PI;
            this.polarAngle = Math.PI / 2.5;
            this.currentFocus.set(player.x, player.y + 2.0, player.z);
            return;
        }

        // FOCO (Hacia dónde mira interesadamente la cámara)
        if (player.currentState === player.STATES.CANNON_FLIGHT) {
            this.target.set(player.x, player.y, player.z);
            this.currentFocus.lerp(this.target, 15.0 * dt); // Tracking de altísima G-Force
            
            const velMag = Math.hypot(player.momentumX, player.momentumZ);
            if (velMag > 2.0) {
                const flyAngle = Math.atan2(player.momentumX, player.momentumZ);
                // Interpolar Azimuth hacia la cola (Estilo persecución de bala)
                const diff = (flyAngle + Math.PI) - this.azimuthAngle;
                this.azimuthAngle += Math.atan2(Math.sin(diff), Math.cos(diff)) * 4.0 * dt;
            }
            
            // Dynamic Zoom Out
            this.radius = Math.min(75.0, this.radius + 15.0 * dt);
        } else {
            this.target.set(player.x, player.y + 2.0, player.z);
            this.currentFocus.lerp(this.target, 8.0 * dt);
            this.radius -= (this.radius - this.baseRadius) * 2.0 * dt; // Return to normal smooth
        }

        // 2. Modos Específicos Clásicos
        if (this.currentMode === this.MODES.FIXED) {
            // Lerp de posición hacia el poste de cámara anclado
            this.camera.position.lerp(this.fixedPosition, 4.0 * dt);
            this.camera.lookAt(this.currentFocus);
            return;
        }

        if (this.currentMode === this.MODES.FIRST_PERSON) {
            // C-Up Lakitu exacto (En la nariz del protagonista)
            this.camera.position.copy(this.currentFocus);
            const lookX = this.currentFocus.x + 10 * Math.sin(this.polarAngle) * Math.sin(this.azimuthAngle);
            const lookY = this.currentFocus.y + 10 * Math.cos(this.polarAngle);
            const lookZ = this.currentFocus.z + 10 * Math.sin(this.polarAngle) * Math.cos(this.azimuthAngle);
            this.camera.lookAt(lookX, lookY, lookZ);
            return;
        }

        // CHASE MODE PREDETERMINADO
        let actualRadius = this.radius;

        // Oclusión Dinámica (Previene enterrar la cámara en montículos o paredes)
        if (this.collisionMeshes && this.collisionMeshes.length > 0) {
            const camDir = new THREE.Vector3(
                Math.sin(this.polarAngle) * Math.sin(this.azimuthAngle),
                Math.cos(this.polarAngle),
                Math.sin(this.polarAngle) * Math.cos(this.azimuthAngle)
            ).normalize();

            this.raycaster.set(this.currentFocus, camDir);
            const hits = this.raycaster.intersectObjects(this.collisionMeshes, true);
            
            if (hits.length > 0 && hits[0].distance < this.radius) {
                // Si un pilar nos tapa, la cámara hace 'zoom in' violento contra la espalda del jugador
                actualRadius = Math.max(1.0, hits[0].distance - 0.8);
            }
        }

        // Conversión a Cartesianas (Esfera orbitable adaptativa)
        let camX = this.currentFocus.x + actualRadius * Math.sin(this.polarAngle) * Math.sin(this.azimuthAngle);
        let camY = this.currentFocus.y + actualRadius * Math.cos(this.polarAngle);
        let camZ = this.currentFocus.z + actualRadius * Math.sin(this.polarAngle) * Math.cos(this.azimuthAngle);

        // Anti-Clipping Dinámico: Si la cámara es arrinconada contra la pared y el jugador (< 4.0m)
        // se eleva en Y como un dron deportivo y pica la mirada a los pies del jugador para no atravesar la malla interna.
        let lookTarget = this.currentFocus;
        if (actualRadius < 4.0) {
            const verticalLift = (4.0 - actualRadius); // Sube progresivamente
            camY += verticalLift;
            
            // Bajar el centro de gravedad visual para que no lo mire al cuello
            lookTarget = this.currentFocus.clone();
            lookTarget.y -= 1.5; 
        }

        // Lerp Suave (Filtrado pasa-bajos) de posición final antes de lookAt
        this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 20.0 * dt);
        this.camera.lookAt(lookTarget);
    }

    /**
     * Cinemática Orbital SM64: La cámara gira lentamente enfocando al jugador triunfante.
     */
    updateCelebration(dt, player) {
        if (!player) return;

        // Forzar Acercamiento
        this.radius = Math.max(10.0, this.radius - (dt * 10.0));
        
        // Rotación Orbital Continua 
        this.azimuthAngle += dt * 1.2;
        this.polarAngle = Math.PI / 2.5; // Ángulo dramático desde abajo/frente

        this.target.set(player.x, player.y + 1.5, player.z);
        this.currentFocus.lerp(this.target, 8.0 * dt);

        const camX = this.currentFocus.x + this.radius * Math.sin(this.polarAngle) * Math.sin(this.azimuthAngle);
        const camY = this.currentFocus.y + this.radius * Math.cos(this.polarAngle);
        const camZ = this.currentFocus.z + this.radius * Math.sin(this.polarAngle) * Math.cos(this.azimuthAngle);

        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(this.currentFocus);
    }
}
