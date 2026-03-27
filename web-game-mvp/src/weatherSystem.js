import * as THREE from 'three';

/**
 * Volumetric Weather System (PS2/RE4 Grade)
 * 
 * Este sistema renderiza hasta 10,000 partículas (lluvia o ceniza) usando 
 * ZERO CPU overhead. La física de caída libre y el looping se calculan enteramente
 * en la Tarjeta Gráfica (GPU) mediante un Vertex Shader personalizado usando aritmética de módulo.
 * Ideal para mantener los 60fps en dispositivos de gama baja.
 */
export class WeatherSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.weatherType = 'none'; // 'none', 'rain', 'ash'
        
        this.particleCount = 5000;
        this.boxSize = 40.0; // El volumen del clima rodea a la cámara
        
        this.geometry = new THREE.BufferGeometry();
        this.material = null;
        this.points = null;
        
        this._initParticles();
    }
    
    _initParticles() {
        const positions = new Float32Array(this.particleCount * 3);
        const offsets = new Float32Array(this.particleCount); // Para rands en shader
        
        for (let i = 0; i < this.particleCount; i++) {
            // Posición inicial aleatoria dentro del cubo de clima
            positions[i * 3]     = (Math.random() - 0.5) * this.boxSize;
            positions[i * 3 + 1] = (Math.random() - 0.5) * this.boxSize;
            positions[i * 3 + 2] = (Math.random() - 0.5) * this.boxSize;
            
            offsets[i] = Math.random();
        }
        
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
        
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uColor: { value: new THREE.Color(0x8899aa) },
                uDropSpeed: { value: 15.0 }, // m/s
                uSize: { value: 0.1 },
                uWind: { value: new THREE.Vector3(1.0, 0, 0.5) },
                uBoxSize: { value: this.boxSize }
            },
            vertexShader: `
                uniform float uTime;
                uniform float uDropSpeed;
                uniform float uSize;
                uniform vec3 uWind;
                uniform float uBoxSize;
                attribute float aOffset;
                
                varying float vAlpha;

                void main() {
                    vec3 pos = position; // Posición base local
                    
                    // Tiempo desfasado por partícula para que no caigan en bloque
                    float localTime = uTime + aOffset * 100.0;
                    
                    // Desplazamiento por gravedad y viento
                    pos.y -= localTime * uDropSpeed;
                    pos.x += localTime * uWind.x;
                    pos.z += localTime * uWind.z;
                    
                    // === AUTOMATIC GPU WRAPPING (Zero CPU Cost) ===
                    // Hace que las partículas reaparezcan arriba cuando tocan el fondo del box
                    float halfBox = uBoxSize * 0.5;
                    pos.x = mod(pos.x + halfBox, uBoxSize) - halfBox;
                    pos.y = mod(pos.y + halfBox, uBoxSize) - halfBox;
                    pos.z = mod(pos.z + halfBox, uBoxSize) - halfBox;
                    
                    // Añadir la posición de la cámara para que el clima SIEMPRE siga al jugador
                    // Nota: Se asume que este Points Object está en (0,0,0) del mundo.
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    
                    // Tamaño escalado con perspectiva
                    gl_PointSize = uSize * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Alpha fade out en los bordes para ocultar el wrapping
                    float dist = length(pos);
                    vAlpha = smoothstep(uBoxSize * 0.5, uBoxSize * 0.2, dist);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;
                void main() {
                    // Rain streak / ash mote suavizado geométricamente
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    // Si es ceniza (uDropSpeed bajo), hacer redondo. Si es lluvia, hacer alargado.
                    // Para simplificar sin uniform extras, usamos círculo siempre difuminado.
                    float dist = length(coord);
                    if (dist > 0.5) discard;
                    
                    float intensity = smoothstep(0.5, 0.0, dist);
                    gl_FragColor = vec4(uColor, intensity * vAlpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false; // El Shader mueve vértices, el bounding box nativo es inútil.
        this.points.visible = false;
        this.scene.add(this.points);
    }
    
    /**
     * Set the current weather pattern
     * @param {string} type - 'none', 'rain', 'ash'
     */
    setWeather(type) {
        this.weatherType = type;
        if (type === 'none') {
            this.points.visible = false;
            return;
        }
        
        this.points.visible = true;
        const u = this.material.uniforms;
        
        if (type === 'rain') {
            u.uColor.value.setHex(0xaaaaaa);
            u.uDropSpeed.value = 18.0; // Rápida y pesada
            u.uSize.value = 2.0;       // Alargada
            u.uWind.value.set(2.0, 0, 1.0);
            this.material.blending = THREE.AdditiveBlending;
        } else if (type === 'ash') {
            u.uColor.value.setHex(0xff7733); // Naranja brasa quemada (Estilo Silent Hill/Volcán)
            u.uDropSpeed.value = 1.5;  // Lenta y flotante
            u.uSize.value = 4.0;       // Más gruesa
            u.uWind.value.set(0.5, 0, 0.5);
            this.material.blending = THREE.NormalBlending;
        }
    }
    
    /** Call this every frame */
    update(delta) {
        if (this.weatherType === 'none' || !this.points.visible) return;
        
        // El Shader requiere el uTime continuo
        this.material.uniforms.uTime.value += delta;
        
        // Pega el volumen madre a la cámara para que el Alebrije siempre tenga clima a su alrededor
        if (this.camera) {
            this.points.position.copy(this.camera.position);
        }
    }
}
