import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const PS2Shader = {
    uniforms: {
        'tDiffuse': { value: null },
        'colorDepth': { value: 12.0 }
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
            vec4 color = texture2D(tDiffuse, vUv);
            
            // === RE4 2004 COLOR GRADING ===
            // 1. Contrast (S-Curve feel)
            color.rgb = (color.rgb - vec3(0.5)) * 1.25 + vec3(0.5);
            
            // 2. Desaturation & Sepia/Brown tint
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 sepia = vec3(lum * 1.1, lum * 0.95, lum * 0.8);
            // Mezclamos 50% hacia el sepia para dar ese tono lúgubre, oxidado de ps2.
            color.rgb = mix(color.rgb, sepia, 0.5);
            
            // === PS2 VRAM COLOR BANDING ===
            // Cuantización Matemática de Colores Estilo Tenebrista
            color.rgb = floor(color.rgb * colorDepth + vec3(0.5)) / colorDepth;
            
            gl_FragColor = color;
        }
    `
};

export class PostProcessingManager {
    constructor(renderer, scene, camera) {
        this.composer = new EffectComposer(renderer);
        
        // Forzar Pixelado Genuino: Resolucion NTSC y CSS Hard edge
        this.composer.setSize(512, 448);
        renderer.domElement.style.imageRendering = 'pixelated';
        renderer.domElement.style.width = '100vw';
        renderer.domElement.style.height = '100vh';

        // 1. Render Base (Color RAW sin efectos)
        const renderPass = new RenderPass(scene, camera);
        this.composer.addPass(renderPass);

        // --- OPTIMIZACIÓN DE FPS (60hz Obligatorio) ---
        // Se ha borrado el SSAO (Ambient Occlusion en Espacio de Pantalla).
        // PS2 NO tenía SSAO. Consumía el 40% del tiempo de GPU frame. Fuera.

        // 2. Unreal Bloom Pass (Resplandor Fotorealista)
        // Mantenemos esto porque es BARATO si la resolución es baja, y da el look RE4.
        // Hacemos el target render a mitad de resolución para triplicar los FPS del Bloom.
        const resolution = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
        this.bloomPass = new UnrealBloomPass(resolution, 1.2, 0.6, 0.85); 
        this.composer.addPass(this.bloomPass);

        // 3. Output Pass (Tone Mapping y Gama)
        this.outputPass = new OutputPass();
        this.composer.addPass(this.outputPass);
        
        // 4. PS2 Color Banding Shader Pass
        this.ps2Pass = new ShaderPass(PS2Shader);
        this.composer.addPass(this.ps2Pass);
    }

    resize(width, height) {
        // Bloqueamos el escalado responsivo para mantener los macro-píxeles 512x448.
        // CSS se encarga de estirar el canvas sin interpolación bilineal.
    }

    render() {
        this.composer.render();
    }
}
