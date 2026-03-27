import * as THREE from 'three';

/**
 * Función para generar rampa de color (3 tonos escalonados) para Cel-Shading
 */
function createToonGradientMap() {
    const colors = new Uint8Array([
        0, 0, 0, 255,       // Sombra nítida (Oscuridad)
        120, 120, 120, 255, // Medio tono
        255, 255, 255, 255  // Luz completa
    ]);
    const gradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RGBAFormat);
    gradientMap.needsUpdate = true;
    gradientMap.magFilter = THREE.NearestFilter; // Evita el blur, haciendo los cortes celulares perfectos
    gradientMap.minFilter = THREE.NearestFilter;
    return gradientMap;
}

/**
 * Nodo de Lista Doblemente Enlazada (Doubly Linked List)
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
 * LRU Cache (Least Recently Used)
 * Buena Práctica (Estructuras de Datos): Garantiza acceso O(1) e inserción O(1)
 * Evita fugar memoria acumulando miles de materiales instanciados.
 */
class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();
        
        // Nodos "Dummy" o "Sentinels" para simplificar inserción/borrado en extremos
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
        // Añadir siempre al frente (Mas recientemente usado)
        node.prev = this.head;
        node.next = this.head.next;
        this.head.next.prev = node;
        this.head.next = node;
    }

    get(key) {
        if (this.cache.has(key)) {
            const node = this.cache.get(key);
            this._remove(node); // Lo sacamos de su posición
            this._add(node);    // Lo ponemos al frente (MRU)
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

        // Si excedemos capacidad, sacamos de la cola (Menos recientemente usado)
        if (this.cache.size > this.capacity) {
            const lruNode = this.tail.prev;
            this._remove(lruNode);
            this.cache.delete(lruNode.key);
            
            // Buenas prácticas WebGL: Limpiar VRAM manualmente al expulsar
            if (lruNode.material) {
                lruNode.material.dispose();
                if (lruNode.material.map) lruNode.material.map.dispose();
            }
        }
    }
}

/**
 * Gestor Central de Estilos
 */
class MaterialManager {
    constructor() {
        // Capacidad: 50 materiales únicos cacheados en memoria
        this.lru = new LRUCache(50); 
        this.textureLoader = new THREE.TextureLoader();
        this.gradientMap = createToonGradientMap();
    }

    /**
     * Obtiene o crea un material basado en firma (key).
     * @param {Object} options - Opciones del material { color, textureUrl, roughness, metalness }
     * @returns {THREE.Material}
     */
    getRetroMaterial(options = {}) {
        const { 
            color = 0xFFFFFF, 
            textureUrl = '', 
            roughness = 0.9, 
            metalness = 0.05 
        } = options;
        
        // Firma única del material
        const key = `mat_${color}_${textureUrl}_${roughness}_${metalness}`;

        // Obtener via LRU O(1)
        let material = this.lru.get(key);
        if (material) {
            return material; // Cache hit
        }

        // Crear nuevo (Cache miss)
        const matProps = { color, roughness, metalness };

        if (textureUrl) {
            const map = this.textureLoader.load(textureUrl);
            // Efecto Retro PS2: Sin alisado (Bilinear filtering off)
            map.magFilter = THREE.NearestFilter; 
            map.minFilter = THREE.NearestFilter;
            matProps.map = map;
        }

        material = new THREE.MeshStandardMaterial(matProps);
        
        // Insertar en caché
        this.lru.put(key, material);
        
        return material;
    }

    /**
     * Convierte de MeshStandardMaterial (GLTF crudo) a Toon Shading dinámico
     * respetando nuestra política de Caché y pixel art.
     */
    applyToonShading(mesh) {
        if (!mesh.isMesh) return;
        
        const processMaterial = (oldMat) => {
            const signature = `toon_${oldMat.uuid}`;
            let toonMat = this.lru.get(signature);
            if (toonMat) return toonMat;

            // Clonar propiedades base en un Material Toon
            toonMat = new THREE.MeshToonMaterial({
                color: oldMat.color,
                map: oldMat.map,
                gradientMap: this.gradientMap, // Aplica el escalonamiento duro de luz
            });
            
            // Forzar pixelado sobre la textura UV del Artista 3D
            if (toonMat.map) {
                toonMat.map.magFilter = THREE.NearestFilter;
                toonMat.map.minFilter = THREE.NearestFilter;
            }

            this.lru.put(signature, toonMat);
            return toonMat;
        };

        if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(processMaterial);
        } else {
            mesh.material = processMaterial(mesh.material);
        }
    }
}

// Exportamos un Singleton global para no duplicar el manager
export default new MaterialManager();
