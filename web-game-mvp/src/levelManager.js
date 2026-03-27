import { loadLevelFromJson, clearLevelData } from './assets.js';
import { GlobalState } from './gameState.js';
import * as THREE from 'three';

export class LevelManager {
    constructor(scene, gameManager, player, enemyManager, bossManager) {
        this.scene = scene;
        this.gameManager = gameManager;
        this.player = player;
        this.enemyManager = enemyManager;
        this.bossManager = bossManager;
        
        this.isTransitioning = false;
        
        // Elemento UI de Carga (Cortina Teatral Asíncrona)
        this.fadeOverlay = document.createElement('div');
        this.fadeOverlay.style.position = 'fixed';
        this.fadeOverlay.style.top = '0';
        this.fadeOverlay.style.left = '0';
        this.fadeOverlay.style.width = '100vw';
        this.fadeOverlay.style.height = '100vh';
        this.fadeOverlay.style.backgroundColor = 'black';
        this.fadeOverlay.style.opacity = '1';
        this.fadeOverlay.style.transition = 'opacity 0.6s ease';
        this.fadeOverlay.style.zIndex = '9999';
        this.fadeOverlay.style.pointerEvents = 'none';
        document.body.appendChild(this.fadeOverlay);
    }

    async transitionTo(levelPath, missionID = 1) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // 1. Fade Out (Bloqueamos la vista)
        this.fadeOverlay.style.opacity = '1';
        await new Promise(res => setTimeout(res, 600));

        // 2. Destrucción Profunda (GC VRAM)
        this.disposeCurrentLevel();

        // 3. Reconstruir Mundo a través de nuevo JSON (Filtrado por missionID)
        GlobalState.currentLevel = levelPath;
        const levelData = await loadLevelFromJson(this.scene, this.gameManager, this.player, this.enemyManager, this.bossManager, levelPath, missionID);

        // 4. Fade In (Revelamos nuevo escenario)
        this.fadeOverlay.style.opacity = '0';
        this.isTransitioning = false;
        
        // 5. Iniciar Carta de Mision Cinematográfica Front-End
        if (levelData && levelData.name) {
             window.dispatchEvent(new CustomEvent('missionStart', { detail: { name: levelData.name } }));
        }
    }

    disposeCurrentLevel() {
        clearLevelData(); // Purgamos arreglos de RAM en assets.js
        if(this.gameManager) this.gameManager.clear(); // Limpiamos puzzles y gemas del nivel viejo

        const nodesToRemove = [];
        this.scene.children.forEach(child => {
            // Protección contra purga (Core Nodes que sobreviven la transición)
            if (child === this.player.mesh) return;
            if (child.isLight || child.isCamera) return;
            if (child.userData && child.userData.isVFX) return;
            if (child.userData && child.userData.isCore) return;
            
            nodesToRemove.push(child);
        });

        // Borrado Manual de VRAM Traverse
        nodesToRemove.forEach(node => {
            this.scene.remove(node);
            node.traverse((n) => {
                // Proteger materiales y geometrías estáticas compartidas en RAM (Goombas, Disparos)
                if (n.userData && n.userData.isShared) return;
                
                if (n.geometry) n.geometry.dispose();
                if (n.material) {
                    if (Array.isArray(n.material)) {
                        n.material.forEach(m => m.dispose());
                    } else {
                        n.material.dispose();
                    }
                }
            });
        });
        
        // Hard Flush Enemigos y Bosses
        if (this.enemyManager && this.enemyManager.enemies) {
            this.enemyManager.enemies.length = 0;
        }
        if (this.bossManager && this.bossManager.bosses) {
            this.bossManager.bosses.length = 0;
        }
        
        // Limpieza fondo viejo
        this.scene.background = null;
        this.scene.environment = null;
    }
}
