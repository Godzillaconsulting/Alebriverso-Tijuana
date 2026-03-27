import * as THREE from 'three';

export class CameraController {
    /**
     * @param {THREE.PerspectiveCamera} camera 
     * @param {THREE.Scene} scene 
     * @param {Array<THREE.Object3D>} collisionObjects - Obstáculos a ignorar/colisionar
     */
    constructor(camera, scene, collisionObjects = []) {
        this.camera = camera;
        this.scene = scene;
        this.collisionObjects = collisionObjects;
        
        // Configuración de controles orbitales estilo PS2
        this.azimuthAngle = Math.PI; // Rotación horizontal (yaw)
        this.polarAngle = Math.PI / 3; // Rotación vertical (pitch)
        
        // Distancias predefinidas según el modo de juego
        this.modes = {
            CLOSE: { distance: 3.0, heightOffset: 1.0 },
            FAR: { distance: 8.0, heightOffset: 2.0 },
            PS2: { distance: 5.0, heightOffset: 1.5 } // Estilo PS2 intermedio y más enfocado
        };
        
        this.currentMode = 'PS2';
        this.idealDistance = this.modes[this.currentMode].distance;
        
        // Factores de suavizado (damping) para emular el 'feel' de PS2/SM64
        this.lerpSpeed = 5.0; // Velocidad con que la cámara alcanza la posición ideal
        this.lookAtSpeed = 10.0; // Velocidad con que el enfoque sigue al objetivo
        
        // Herramienta de raycasting para no atravesar paredes
        this.raycaster = new THREE.Raycaster();
        
        // Estado interno para la interpolación
        this.currentPosition = new THREE.Vector3().copy(this.camera.position);
        this.currentTarget = new THREE.Vector3();
    }

    /**
     * Cambia el modo de la cámara modificando su distancia ideal.
     * @param {string} mode - 'CLOSE', 'FAR', 'PS2'
     */
    setMode(mode) {
        if (this.modes[mode]) {
            this.currentMode = mode;
            this.idealDistance = this.modes[mode].distance;
            // Opcional: reiniciar el damping principal aquí si se desea corte directo
        }
    }

    /**
     * Lógica de actualización principal que debe ser llamada cada frame.
     * Inspirado en camera.c función update_camera, adaptado a Three.js.
     * Mejora el tracking al estilo PS2 usando coordenadas esféricas y suavizado superior.
     * 
     * @param {THREE.Vector3} targetPosition - Posición del jugador a seguir
     * @param {number} deltaTime - Tiempo delta desde el último frame
     */
    updateCamera(targetPosition, deltaTime = 0.016) {
        // 1. Calcular dónde debería enfocar la cámara basándose en el objetivo y el offset de altura
        const modeSettings = this.modes[this.currentMode];
        // En un juego estilo PS2 la cámara mira un "hombro" o un punto sobre la cabeza del prota.
        const targetFocus = targetPosition.clone().add(new THREE.Vector3(0, modeSettings.heightOffset, 0));
        
        // Interpolación suave del punto de enfoque (evita temblores bruscos)
        this.currentTarget.lerp(targetFocus, deltaTime * this.lookAtSpeed);
        
        // 2. Calcular la posición *ideal* de la cámara en su órbita esférica
        const idealPosition = new THREE.Vector3();
        // Convertir coordenadas esféricas a cartesianas
        idealPosition.x = this.currentTarget.x + (this.idealDistance * Math.sin(this.polarAngle) * Math.sin(this.azimuthAngle));
        idealPosition.y = this.currentTarget.y + (this.idealDistance * Math.cos(this.polarAngle));
        idealPosition.z = this.currentTarget.z + (this.idealDistance * Math.sin(this.polarAngle) * Math.cos(this.azimuthAngle));

        // 3. Evaluar colisiones con la geometría (Raycasting cruzado)
        // La cámara nunca debe atravesar paredes.
        const safePosition = this.raycastAgainstWalls(this.currentTarget, idealPosition);

        // 4. Mover físicamente la cámara hacia la posición segura con lerp
        this.currentPosition.lerp(safePosition, deltaTime * this.lerpSpeed);
        this.camera.position.copy(this.currentPosition);
        
        // 5. Apuntar correctamente al objetivo suavizado
        this.camera.lookAt(this.currentTarget);
    }

    /**
     * Traza un rayo desde el jugador (origen) hacia la cámara (idealEnd) para detectar obstáculos.
     * 
     * @param {THREE.Vector3} origin - Punto focal central (jugador)
     * @param {THREE.Vector3} idealEnd - Dónde la cámara "quiere" estar
     * @returns {THREE.Vector3} - La posición segura sin atravesar muros
     */
    raycastAgainstWalls(origin, idealEnd) {
        // Vector desde el jugador a la cámara
        const direction = new THREE.Vector3().subVectors(idealEnd, origin);
        const distance = direction.length();
        
        // Prevenir cálculo con distancia 0
        if (distance === 0) return idealEnd;
        
        direction.normalize();

        // Configurar el raycaster apuntando hacia afuera
        this.raycaster.set(origin, direction);
        this.raycaster.far = distance;

        // Comprobar colisiones
        const intersects = this.raycaster.intersectObjects(this.collisionObjects, true);

        if (intersects.length > 0) {
            // ¡Colisión detectada! Movemos la cámara justo delante de la pared
            const hit = intersects[0];
            // Aseguramos un offset de 0.2 unidades para evitar clipping en la malla
            const safeDistance = Math.max(0.5, hit.distance - 0.2); 
            
            // Retornamos esa posición más cercana
            return origin.clone().add(direction.multiplyScalar(safeDistance));
        }

        // Si no hay paredes, la posición ideal es segura
        return idealEnd;
    }
    
    // =========================================================
    // Métodos auxiliares para controles del Stick Derecho (PS2)
    // =========================================================

    /**
     * Rota la cámara horizontalmente (eje Y global). Útil para input de joystick derecho.
     */
    rotateAzimuth(delta) {
        this.azimuthAngle += delta;
    }
    
    /**
     * Rota la cámara verticalmente con limites restrictivos.
     */
    rotatePolar(delta) {
        this.polarAngle += delta;
        // Restricción para no mirar boca abajo (evita gimbal lock al mirar directo arr/aba)
        const minPolar = 0.1; // Cerca del cenit
        const maxPolar = Math.PI - 0.1; // Cerca del nadir
        this.polarAngle = Math.max(minPolar, Math.min(maxPolar, this.polarAngle));
    }
}
