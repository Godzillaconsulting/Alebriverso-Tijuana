import * as THREE from 'three';
import { CameraController } from './camera/CameraController.js';
import { InputManager } from './input/InputManager.js';
import { PlayerController } from './player/PlayerController.js';

export class Engine {
    constructor(canvasId) {
        // Obtenemos el canvas HTML
        const canvas = document.getElementById(canvasId);
        if (!canvas) throw new Error("Canvas element not found");

        // Configuración básica de Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Cielo Azul (Skybox temporal)
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true; // Activar sombras básicas

        // Iluminación
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // ============================================
        // 1. Módulos Core / Lógica
        // ============================================
        this.inputManager = new InputManager();
        
        // Construimos el "Mario" / Personaje temporal (un simple cilindro o cubo verde)
        const playerGeometry = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8); // Estilo píldora (hitbox)
        const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
        this.playerMesh.castShadow = true;
        // Agregamos un indicador visual frontal para que notemos hacia dónde mira el personaje
        const noseGeo = new THREE.BoxGeometry(0.2, 0.2, 0.5);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.5, 0.5);
        this.playerMesh.add(nose); // Hijo del player mesh
        
        this.playerMesh.position.y = 1; // Un poco elevado respecto al piso
        this.scene.add(this.playerMesh);
        
        this.playerController = new PlayerController(this.playerMesh, this.camera);
        
        // ============================================
        // 2. Geometría Colisionable
        // ============================================
        this.collisionObjects = this._createEnvironment();
        
        // ============================================
        // 3. Sistema de Cámara (Nuestra Adaptación de SM64)
        // ============================================
        this.cameraController = new CameraController(this.camera, this.scene, this.collisionObjects);
        // Iniciamos la cámara detrás del jugador
        this.cameraController.currentPosition.set(0, 5, -10);
        
        // Resize listener
        window.addEventListener('resize', this._onWindowResize.bind(this));
        
        // Loop maestro
        this.clock = new THREE.Clock();
        this._loop = this._loop.bind(this);
        requestAnimationFrame(this._loop);
    }
    
    /**
     * Construye un entorno de prueba donde "Mario" pueda saltar por varios cuartos
     */
    _createEnvironment() {
        const objects = [];
        
        // Suelo principal
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        objects.push(floor); // El suelo también cuenta como geometría del raycast potencialmente
        
        // Edificios/Muros (Simulando "múltiples cuartos")
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xcc4444 });
        
        const buildWall = (w, h, d, x, y, z) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            wall.position.set(x, y, z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
            objects.push(wall);
            return wall;
        };

        // Construir algunas paredes aleatorias (como un pasillo)
        buildWall(2, 5, 20, 10, 2.5, 0); // Pared derecha
        buildWall(2, 5, 20, -10, 2.5, 0); // Pared izquierda
        buildWall(10, 5, 2, 0, 2.5, 10); // Obstáculo cruzado

        return objects;
    }

    _onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    _loop() {
        requestAnimationFrame(this._loop);
        
        const delta = Math.min(this.clock.getDelta(), 0.1); // Cap a máximo de tiempo para evitar bugs si dejas la ventana inactiva
        
        // 1. Obtención de Disparadores (Inputs)
        const movement = this.inputManager.getMovementVector();
        const isJumping = this.inputManager.keys.jump;
        const mouseDelta = this.inputManager.consumeMouseDelta();
        
        // 2. Rotación de Cámara (Equivalente al Joy Izq en PS2 / R3)
        if (mouseDelta.x !== 0) {
            // Sensibilidad mouse
            this.cameraController.rotateAzimuth(-mouseDelta.x * 0.005);
        }
        if (mouseDelta.y !== 0) {
            this.cameraController.rotatePolar(-mouseDelta.y * 0.005);
        }

        // 3. Mover al Personaje respecto a lo que la Cámara mira
        this.playerController.update(movement, isJumping, delta);
        
        // 4. Actualizar la cámara para que siga gentilmente al personaje sin colisionar
        this.cameraController.updateCamera(this.playerMesh.position, delta);
        
        // 5. Renderizado final
        this.renderer.render(this.scene, this.camera);
    }
}
