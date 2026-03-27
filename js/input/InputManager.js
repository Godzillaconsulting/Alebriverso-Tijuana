export class InputManager {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };
        
        // Mouse deltas para emular el joystick derecho (cámara)
        this.mouseDelta = { x: 0, y: 0 };
        this.isPointerLocked = false;
        
        this._initKeyboard();
        this._initMouse();
    }
    
    _initKeyboard() {
        document.addEventListener('keydown', (e) => this._onKeyDown(e));
        document.addEventListener('keyup', (e) => this._onKeyUp(e));
    }
    
    _onKeyDown(e) {
        switch(e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = true; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = true; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
            case 'Space': this.keys.jump = true; break;
        }
    }
    
    _onKeyUp(e) {
        switch(e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = false; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = false; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
            case 'Space': this.keys.jump = false; break;
        }
    }

    _initMouse() {
        document.addEventListener('mousemove', (e) => {
            if (this.isPointerLocked) {
                this.mouseDelta.x = e.movementX || 0;
                this.mouseDelta.y = e.movementY || 0;
            }
        });
        
        // Solicitar Pointer Lock (capturar el cursor) al hacer clic en la pantalla
        document.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                document.body.requestPointerLock();
            }
        });
        
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === document.body;
        });
    }

    /**
     * Devuelve el desplazamiento del mouse y lo resetea para el frame actual.
     */
    consumeMouseDelta() {
        const delta = { x: this.mouseDelta.x, y: this.mouseDelta.y };
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
        return delta;
    }

    /**
     * Calcula el vector de movimiento basado en WASD.
     * Retorna { x, z } normalizado (z es profundidad).
     */
    getMovementVector() {
        let x = 0;
        let z = 0;
        
        // En Three.js, negativo en Z suele significar 'adelante'
        if (this.keys.forward) z -= 1;
        if (this.keys.backward) z += 1;
        if (this.keys.left) x -= 1;
        if (this.keys.right) x += 1;
        
        // Normalizar para evitar que moverse en diagonal sea más rápido
        const length = Math.sqrt(x * x + z * z);
        if (length > 0) {
            x /= length;
            z /= length;
        }
        
        return { x, z };
    }
}
