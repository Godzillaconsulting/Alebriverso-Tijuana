import * as THREE from 'three';
import MaterialManager from '../renderer/MaterialManager.js';

export default class GeometryBuilder {
    constructor() {
        // Obsolete custom VBO building props
    }

    /**
     * Construye un THREE.Group conteniendo todas las mallas estáticas del nivel
     */
    buildSceneStaticGeometry(platformsData) {
        const staticGroup = new THREE.Group();
        staticGroup.name = "LevelGeometry_Static";

        for (const plat of platformsData) {
            const mesh = this.buildPlatformNode(plat);
            staticGroup.add(mesh);
        }

        return staticGroup;
    }

    /**
     * Retorna un THREE.Mesh individual para una plataforma del nivel
     */
    buildPlatformNode(platData) {
        const pos = platData.position;
        // Parsear hexadecimal desde JSON ("#3cb043") a valor entero (0x3cb043)
        let colorNumber = 0xFFFFFF;
        if (platData.color) {
            colorNumber = parseInt(platData.color.replace('#', '0x'));
        }

        let geometry;
        if (platData.type === 'pole') {
            const radius = platData.radius || 0.5;
            const height = platData.height || 10;
            geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
        } else if (platData.type === 'cannon') {
            geometry = new THREE.CylinderGeometry(1.6, 1.4, 2.8, 16);
            geometry.rotateX(Math.PI / 4); // Cañón angulado hacia el cielo
            colorNumber = 0x222222; // Hierro oscuro
        } else if (platData.type === 'obsidian_mirror') {
            geometry = new THREE.CylinderGeometry(3.0, 3.0, 0.2, 32);
            colorNumber = 0x050505; // Negro Profundo (Tezcatlipoca)
        } else {
            const size = platData.size || {width: 1, height: 1, depth: 1};
            geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
        }
        const material = MaterialManager.getRetroMaterial({ 
            color: colorNumber,
            roughness: 0.9,     
            metalness: 0.05 
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { ...platData }; // Propagar lógica de nivel al nodo de colisión (isIce, isLava, etc.)

        mesh.position.set(pos.x, pos.y, pos.z);
        
        // Habilitar simulación de luz (PS2 no lo tenía dinámico, pero hoy sí se puede)
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }
}
