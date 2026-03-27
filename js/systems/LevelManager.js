import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class LevelManager {
    constructor(scene, collisionMeshes) {
        this.scene = scene;
        this.collisionMeshes = collisionMeshes;
        this.loader = new GLTFLoader();
    }

    loadLevel(url, onLoadCallback) {
        this.loader.load(
            url, 
            (gltf) => {
                const levelMesh = gltf.scene;
                
                // Procesamiento recurviso del modelo cargado
                levelMesh.traverse((child) => {
                    if (child.isMesh) {
                        child.receiveShadow = true;
                        child.castShadow = true;
                        
                        // Añadir como colisionable a menos que especifique lo contrario en UserData
                        if (child.userData.isCollision !== false) {
                            this.collisionMeshes.push(child);
                        }
                    }
                });
                
                this.scene.add(levelMesh);
                console.log(`[LevelManager] Nivel ${url} cargado exitosamente.`);
                if (onLoadCallback) onLoadCallback(levelMesh);
            },
            (xhr) => {
                console.log(`[LevelManager] ${(xhr.loaded / xhr.total * 100)}% loaded`);
            },
            (error) => {
                console.error('[LevelManager] Ha ocurrido un error al cargar el nivel:', error);
            }
        );
    }
}
