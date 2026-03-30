import * as THREE from 'three';

const GLSL_NOISE = `
float hash(vec3 p) {
    p  = fract( p*0.3183099+vec3(0.1) );
    p *= 17.0;
    return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
}

float valueNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(vec3(3.0)-2.0*f);
    return mix(mix(mix( hash(i+vec3(0.0,0.0,0.0)), hash(i+vec3(1.0,0.0,0.0)),f.x),
                   mix( hash(i+vec3(0.0,1.0,0.0)), hash(i+vec3(1.0,1.0,0.0)),f.x),f.y),
               mix(mix( hash(i+vec3(0.0,0.0,1.0)), hash(i+vec3(1.0,0.0,1.0)),f.x),
                   mix( hash(i+vec3(0.0,1.0,1.0)), hash(i+vec3(1.0,1.0,1.0)),f.x),f.y),f.z);
}
`;

/**
 * Nodo de Lista Doblemente Enlazada
 */
class Node {
    constructor(key, material) {
        this.key = key;
        this.material = material;
        this.prev = null;
        this.next = null;
    }
}

/**
 * LRU Cache para reciclar Materiales
 */
class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();
        
        this.head = new Node("head", null);
        this.tail = new Node("tail", null);
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    _remove(node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    _add(node) {
        node.prev = this.head;
        node.next = this.head.next;
        this.head.next.prev = node;
        this.head.next = node;
    }

    get(key) {
        if (this.cache.has(key)) {
            const node = this.cache.get(key);
            this._remove(node);
            this._add(node);
            return node.material;
        }
        return null;
    }

    put(key, material) {
        if (this.cache.has(key)) {
            this._remove(this.cache.get(key));
        }
        
        const newNode = new Node(key, material);
        this._add(newNode);
        this.cache.set(key, newNode);

        if (this.cache.size > this.capacity) {
            const lruNode = this.tail.prev;
            this._remove(lruNode);
            this.cache.delete(lruNode.key);
            
            if (lruNode.material) {
                lruNode.material.dispose();
                if (lruNode.material.map) lruNode.material.map.dispose();
            }
        }
    }
}

/**
 * Gestor Global
 */
class MaterialManager {
    constructor() {
        this.lru = new LRUCache(50); 
        this.textureLoader = new THREE.TextureLoader();
        this.animatedMaterials = []; // Solución al TypeError (undefined .push)
    }

    getMaterial(options = {}) {
        const colorArg = options.color;
        
        // Parsear el string '#4a7c2e' entregado por el JSON
        let colorNumber = 0xFFFFFF;
        if (typeof colorArg === 'string' && colorArg.startsWith('#')) {
            colorNumber = parseInt(colorArg.replace('#', '0x'));
        } else if (typeof colorArg === 'number') {
            colorNumber = colorArg;
        }

        const textureUrl = options.textureUrl || '';
        const roughness = options.roughness !== undefined ? options.roughness : 0.9; 
        const metalness = options.metalness !== undefined ? options.metalness : 0.05;
        const repeatX = options.repeat ? options.repeat[0] : 1;
        const repeatY = options.repeat ? options.repeat[1] : 1;
        
        // Propiedades Expandidas para Retrocompatibilidad (Armas, Efectos, Player)
        const emissiveStr = options.emissive;
        let emissiveNum = 0x000000;
        if (typeof emissiveStr === 'string' && emissiveStr.startsWith('#')) emissiveNum = parseInt(emissiveStr.replace('#', '0x'));
        else if (typeof emissiveStr === 'number') emissiveNum = emissiveStr;
        
        const emissiveIntensity = options.emissiveIntensity !== undefined ? options.emissiveIntensity : 1.0;
        const transparent = options.transparent || false;
        const opacity = options.opacity !== undefined ? options.opacity : 1.0;
        const side = options.side !== undefined ? options.side : THREE.FrontSide;
        
        const key = `mat_${colorNumber}_${textureUrl}_${roughness}_${metalness}_${repeatX}_${repeatY}_${emissiveNum}_${emissiveIntensity}_${transparent}_${opacity}_${side}`;

        // Intentar Cache Hit O(1)
        let material = this.lru.get(key);
        if (material) {
            return material; 
        }

        // Crear material nuevo si no existía (Cache Miss)
        const matProps = { 
            color: colorNumber, roughness, metalness,
            emissive: emissiveNum, emissiveIntensity, transparent, opacity, side
        };

        if (textureUrl) {
            const map = this.textureLoader.load(textureUrl);
            map.magFilter = THREE.NearestFilter; 
            map.minFilter = THREE.NearestFilter;
            
            if (options.repeat && (options.repeat[0] > 1 || options.repeat[1] > 1)) {
                map.wrapS = THREE.RepeatWrapping;
                map.wrapT = THREE.RepeatWrapping;
                map.repeat.set(options.repeat[0], options.repeat[1]);
            }
            
            matProps.map = map;
        }

        // === PS2 UPGRADE: Procedural Normal Map for PBR Detail ===
        // Usamos nuestro generador de Normal Map de Canvas para agregar 'bump'
        // a las superficies planas, logrando ese look táctil de PS2 (piedra, lodo).
        let pbrType = 'normal';
        if (roughness > 0.8 && colorNumber < 0x888888) pbrType = 'stone';
        else if (metalness > 0.5) pbrType = 'metal';
        else if (colorNumber === 0x4a2e15 || colorNumber === 0x8b4513) pbrType = 'dirt';
        
        const normalMap = this.generateProceduralNormalMap(pbrType);
        matProps.normalMap = normalMap;
        matProps.normalScale = new THREE.Vector2(0.8, 0.8);

        material = new THREE.MeshStandardMaterial(matProps);
        
        this.lru.put(key, material);
        
        return material;
    }

    /**
     * Devuelve o crea un Material Inteligente basado en algoritmos GLSL inyectados a la GPU
     * Mezcla Texturas PBR (si existen) con Ecuaciones GLSL de Ruido para un look Híbrido.
     */
    getProceduralMaterial(type, textureUrl = null, repeat = [1, 1]) {
        const key = `proc_${type}_${textureUrl}`;
        let material = this.lru.get(key);
        if (material) {
            return material;
        }

        // PBR Base que recibe sombras
        material = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffff,
            roughness: type === 'stone' ? 0.7 : (type === 'water' ? 0.05 : 0.9),
            metalness: type === 'stone' ? 0.2 : (type === 'water' ? 0.1 : 0.0),
            transmission: type === 'water' ? 0.8 : 0.0, // Refracción del agua
            opacity: type === 'water' ? 0.7 : 1.0,
            transparent: type === 'water' ? true : false,
            ior: type === 'water' ? 1.33 : 1.5,
            side: type === 'water' ? THREE.DoubleSide : THREE.FrontSide,
            depthWrite: type !== 'water'
        });
        
        if (type === 'water') {
            material.metalness = 0.8;
            material.normalMap = this.generateProceduralNormalMap('stone', 512); // Ripples base
            material.normalScale = new THREE.Vector2(0.3, 0.3);
        } else {
            // === PS2 UPGRADE: Aplicar Normal Map también a los materiales procedimentales ===
            material.normalMap = this.generateProceduralNormalMap(type);
            material.normalScale = new THREE.Vector2(0.8, 0.8);
        }

        // Soporte de Texturas Híbridas (Tileable Patterns + Shader Shading)
        if (textureUrl) {
            const texture = this.textureLoader.load(textureUrl);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(repeat[0], repeat[1]);
            texture.magFilter = THREE.NearestFilter; // Para look retro-pixel PS1
            material.map = texture;
        }

        // Semilla para el DeltaTime del viento u ondulaciones
        material.userData = { uTime: { value: 0.0 } };
        this.animatedMaterials.push(material);

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = material.userData.uTime;

            // Inyectar Varying de Coordenadas de Mundo (Para Mapping 3D real sin UVs rasgados)
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                 varying vec3 vCustomWorldPos;
                 uniform float uTime;`
            );
            
            let vertexDisplacement = `
                 vec4 customWorldPosition = modelMatrix * vec4(position, 1.0);
                 vCustomWorldPos = customWorldPosition.xyz;
            `;
            
            // Si es agua, aplicamos físicas de olas 3D reales al vértice
            if (type === 'water') {
                vertexDisplacement = `
                     vec3 transformed = vec3(position);
                     // Olas físicas basadas en suma de senos y uTime
                     float waveX = sin(transformed.x * 2.0 + uTime * 2.5) * 0.15;
                     float waveZ = cos(transformed.z * 2.0 + uTime * 2.0) * 0.15;
                     float microWave = sin((transformed.x + transformed.z) * 5.0 - uTime * 4.0) * 0.05;
                     
                     transformed.y += waveX + waveZ + microWave;
                     
                     vec4 customWorldPosition = modelMatrix * vec4(transformed, 1.0);
                     vCustomWorldPos = customWorldPosition.xyz;
                `;
            }

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                 ${vertexDisplacement}
                `
            );

            // Inyectar Funciones Matemáticas de Ruido 3D
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                 varying vec3 vCustomWorldPos;
                 uniform float uTime;
                 ${GLSL_NOISE}
                `
            );

            // Computar color de pixel multiplicando el "diffuse" nativo (que puede venir de una Textura Map)
            let colorLogic = '';
            if (type === 'grass') {
                colorLogic = `
                    // Triplanar Noise for Grass with Wind
                    float noiseVal = valueNoise(vCustomWorldPos * 0.5 + vec3(uTime * 0.8, 0.0, uTime * 0.3));
                    float windShadow = mix(0.7, 1.25, smoothstep(0.3, 0.7, noiseVal));
                    
                    vec4 diffuseColor = vec4( diffuse * windShadow, opacity );
                `;
            } else if (type === 'water') {
                colorLogic = `
                    // Ondulaciones Senoidales para el Agua (Triplanar Fake Refraction)
                    float noiseVal = valueNoise(vCustomWorldPos * 2.0 + vec3(uTime, 0.0, uTime));
                    float nDetail = valueNoise(vCustomWorldPos * 5.0 - vec3(0.0, 0.0, uTime * 2.0));
                    
                    vec3 waterBase = vec3(0.0, 0.4, 0.8);
                    vec3 waterCrest = vec3(0.5, 0.9, 1.0);
                    
                    vec3 base = mix(waterBase, waterCrest, smoothstep(0.4, 0.8, noiseVal));
                    base = mix(base, vec3(1.0), smoothstep(0.8, 1.0, nDetail) * 0.5); // Escuma / Reflejos Speculares
                    
                    vec4 diffuseColor = vec4(base, opacity);
                `;
            } else if (type === 'stone') {
                colorLogic = `
                    // Triplanar Noise for Aztec Stone with Gold specks
                    float n1 = valueNoise(vCustomWorldPos * 0.6);
                    float n2 = valueNoise(vCustomWorldPos * 3.0);
                    
                    vec3 base = mix(diffuse, diffuse * 0.55, smoothstep(0.2, 0.8, n1)); // Relieve quemado
                    
                    // Flecos de Oro 
                    float speck = smoothstep(0.8, 0.95, n2) * smoothstep(0.4, 0.6, n1);
                    base = mix(base, vec3(1.3, 1.0, 0.3), speck * 0.8);
                    
                    vec4 diffuseColor = vec4( base, opacity );
                `;
            } else {
                 colorLogic = `vec4 diffuseColor = vec4( diffuse, opacity );`;
            }

            shader.fragmentShader = shader.fragmentShader.replace(
                'vec4 diffuseColor = vec4( diffuse, opacity );',
                colorLogic
            );
        };

        this.lru.put(key, material);
        return material;
    }

    /**
     * Sincroniza el DeltaTime (Viento, Animación) para los Procedurales
     */
    update(dt) {
        for (let i = 0; i < this.animatedMaterials.length; i++) {
            const mat = this.animatedMaterials[i];
            if (mat && mat.userData && mat.userData.uTime) {
                mat.userData.uTime.value += dt;
            }
        }
    }

    // === PS2 UPGRADE: Procedural Canvas Normal Maps ===
    // Genera mapas de normales estáticos inyectando ruido matemático en los canales X/Y
    // Ahorra VRAM y peticiones HTTP al vuelo.
    generateProceduralNormalMap(type = 'stone', size = 256) {
        const key = `normalMap_${type}_${size}`;
        if (this.lru.get(key)) return this.lru.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imgData = ctx.createImageData(size, size);
        const data = imgData.data;

        // Parámetros por material
        let intensity = 40;
        let scale = 1.0;
        if (type === 'stone') { intensity = 60; scale = 0.5; }
        else if (type === 'metal') { intensity = 15; scale = 2.0; }
        else if (type === 'dirt') { intensity = 80; scale = 0.2; }

        // Simple high-frequency noise perturbation for surface bump
        for (let i = 0; i < data.length; i += 4) {
            // Un poco de coherencia espacial cutre (look retro compresión)
            const param = (i / 4) * scale;
            const noiseX = (Math.sin(param * 133.3) + Math.cos(param * 71.1)) * intensity;
            const noiseY = (Math.cos(param * 93.3) + Math.sin(param * 111.9)) * intensity;
            
            data[i]     = 128 + noiseX; // R (X vector)
            data[i + 1] = 128 + noiseY; // G (Y vector)
            data[i + 2] = 255;          // B (Z up)
            data[i + 3] = 255;          // A
        }

        ctx.putImageData(imgData, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter; // PS2 crunch
        
        this.lru.put(key, texture);
        return texture;
    }
}

export default new MaterialManager();
