import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Custom Shader para Color Quantization (Banding estilo SPU de PS2)
const PS2Shader = {
    uniforms: {
        'tDiffuse': { value: null },
        'colorDepth': { value: 12.0 } // 12 a 16 colores por canal da el feel exacto de Hardware antíguo
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float colorDepth;
        varying vec2 vUv;
        
        void main() {
            vec4 texColor = texture2D(tDiffuse, vUv);
            // Cuantización Matemática del Color
            texColor.rgb = floor(texColor.rgb * colorDepth + 0.5) / colorDepth;
            gl_FragColor = texColor;
        }
    `
};

export default class WebGLRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        
        // Inicializar renderer estándar 
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x6495ED); // Azul cielo tipo SM64
        
        // Configurar Sombras
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
        
        // Escena y Cámara
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 20); // Posición inicial

        this._setupLighting();

        // --- PIPELINE DE POSTPROCESAMIENTO PS2 ---
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Pass Custom: Color Banding
        this.ps2Pass = new ShaderPass(PS2Shader);
        this.composer.addPass(this.ps2Pass);

        // Downscale CRT Resolution (Estándar NTSC PS2 512x448)
        this.ps2Width = 512;
        this.ps2Height = 448;
        this.composer.setSize(this.ps2Width, this.ps2Height);
        
        // Evitar que el CSS del navegador desenfoque los pixeles estirados
        this.canvas.style.imageRendering = 'pixelated';

        // Resize Hook
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    _setupLighting() {
        // Atmospheric Fog PS2 (Distancia épica para Exploración de nivel masivo)
        this.scene.fog = new THREE.FogExp2(0x6495ED, 0.002);

        // Luz Ambiental Vibrante (Tarde dorada cálida mesoamericana muy expuesta)
        const ambientLight = new THREE.HemisphereLight(0xffeedd, 0x4455aa, 1.25);
        this.scene.add(ambientLight);

        // Luz Principal Direccional (El Sol)
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(30, 50, -30); // Ángulo diagonal de tarde
        dirLight.castShadow = true;
        
        // Configuración Amplia del Mapa de Sombras para cubrir el nivel
        dirLight.shadow.camera.top = 80;
        dirLight.shadow.camera.bottom = -80;
        dirLight.shadow.camera.left = -80;
        dirLight.shadow.camera.right = 80;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 300;
        dirLight.shadow.mapSize.width = 2048; // Alta resolución (estilo PS2 pro)
        dirLight.shadow.mapSize.height = 2048;
        
        this.scene.add(dirLight);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // El composer mantiene su ultra-baja resolución interna para asegurar los pixeles gordos al re-escalar
    }

    getScene() {
        return this.scene;
    }

    getCamera() {
        return this.camera;
    }

    /**
     * Renderiza el frame a través del pipeline de Post-Process (EffectComposer)
     */
    renderFrame() {
        this.composer.render();
    }
}
