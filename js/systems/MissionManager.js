/**
 * MissionManager.js
 * Orquestador Lógico de Misiones, Objetivos (Estrellas) y UI Overlay (HUD Cinemático)
 */
export default class MissionManager {
    constructor(sceneData) {
        this.levelName = sceneData.name || "Nivel Desconocido";
        this.missions = [];
        
        // Auto-scan JSON for Star Objectives
        if (sceneData.collectibles) {
            sceneData.collectibles.forEach((c) => {
                if (c.type === 'star') {
                    // Limpieza del string (ej "star_peak" -> "PEAK")
                    const formatName = c.id.replace('star_', '').replace(/_/g, ' ').toUpperCase();
                    this.missions.push({
                        id: c.id,
                        name: `Misión: La Gran Estrella de ${formatName}`,
                        completed: false
                    });
                }
            });
        }
        
        if (this.missions.length === 0) {
            this.missions.push({ id: 'default', name: "Exploración Libre", completed: false });
        }

        this.activeMissionIndex = 0;
        this.isVictory = false;
        
        this.cacaoCount = 0;
        this.hasSpawnedCacaoStar = false;

        this._createUI();
        this.showSplash();
    }

    _createUI() {
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100vw';
        this.container.style.height = '100vh';
        this.container.style.pointerEvents = 'none';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.justifyContent = 'center';
        this.container.style.alignItems = 'center';
        this.container.style.zIndex = '1000';
        this.container.style.fontFamily = 'Impact, "Arial Black", sans-serif';
        this.container.style.textShadow = '4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'; // Borde rígido SM64
        
        this.titleElement = document.createElement('div');
        this.titleElement.style.color = '#fff';
        this.titleElement.style.fontSize = '3rem';
        this.titleElement.style.opacity = '0';
        this.titleElement.style.transition = 'opacity 1s ease, transform 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        this.titleElement.style.transform = 'translateY(-50px)';
        this.titleElement.style.textAlign = 'center';
        
        this.container.appendChild(this.titleElement);
        document.body.appendChild(this.container);

        // HUD Permanente (UI Coins / Stars)
        this.hudContainer = document.createElement('div');
        this.hudContainer.style.position = 'absolute';
        this.hudContainer.style.top = '25px';
        this.hudContainer.style.left = '35px';
        this.hudContainer.style.display = 'flex';
        this.hudContainer.style.flexDirection = 'column';
        this.hudContainer.style.gap = '15px';
        this.hudContainer.style.zIndex = '1000';
        this.hudContainer.style.fontFamily = 'Impact, "Arial Black", sans-serif';
        this.hudContainer.style.fontSize = '3rem';
        this.hudContainer.style.color = '#FFF';
        this.hudContainer.style.textShadow = '3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000';
        
        this.hudContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 1.1em; filter: drop-shadow(0 0 5px #4A2511);">🌰</span> 
                <span id="ui-cacao-count" style="display: inline-block; min-width: 70px; transition: transform 0.15s, color 0.15s;">0</span>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 1.1em; filter: drop-shadow(0 0 5px #FF8800);">☀️</span> 
                <span id="ui-star-count" style="display: inline-block; min-width: 70px; transition: transform 0.3s, color 0.3s;">0</span>
            </div>
        `;
        document.body.appendChild(this.hudContainer);
        this.uiCacaoCount = this.hudContainer.querySelector('#ui-cacao-count');
        this.uiStarCount = this.hudContainer.querySelector('#ui-star-count');
    }

    showSplash() {
        const curr = this.missions[this.activeMissionIndex];
        const missionText = curr ? curr.name : "Objetivo Oculto";
        this.titleElement.innerHTML = `<span style="font-size: 0.5em; color: #aaffaa; text-transform: uppercase;">${this.levelName}</span><br/><br/><span style="color:#ffffff;">⭐ ${missionText} ⭐</span>`;
        
        // Push In
        setTimeout(() => {
            this.titleElement.style.opacity = '1';
            this.titleElement.style.transform = 'translateY(0) scale(1)';
            
            // Pull Out
            setTimeout(() => {
                this.titleElement.style.opacity = '0';
                this.titleElement.style.transform = 'translateY(-30px) scale(0.9)';
            }, 4000);
        }, 500);
    }

    triggerVictory(starId) {
        if (this.isVictory) return;
        this.isVictory = true;

        const mis = this.missions.find(m => m.id === starId);
        if (mis) mis.completed = true;

        // Actualizar HUD Permanente
        const acquiredStars = this.missions.filter(m => m.completed).length;
        this.uiStarCount.innerText = acquiredStars;
        this.uiStarCount.style.transform = 'scale(1.8)';
        this.uiStarCount.style.color = '#FFD700';
        setTimeout(() => {
            this.uiStarCount.style.transform = 'scale(1)';
            this.uiStarCount.style.color = '#FFF';
        }, 300);

        // Cinematic Overlay
        this.titleElement.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        this.titleElement.innerHTML = `<span style="color: #FFD700; font-size: 1.5em; display:block; margin-bottom:10px;">¡CONSEGUISTE UNA ESTRELLA!</span><span style="font-size: 0.6em; color: #ffffff;">Curso Completado</span>`;
        
        // Rebotar a pantalla
        this.titleElement.style.opacity = '1';
        this.titleElement.style.transform = 'translateY(0) scale(1.1)';
        
        // Letterbox estilo cine
        document.body.style.boxShadow = 'inset 0 100px 0 #000, inset 0 -100px 0 #000';
        document.body.style.transition = 'box-shadow 1s ease';
    }

    collectCacao() {
        this.cacaoCount++;
        
        // Efecto Pálpito Visual HUD
        this.uiCacaoCount.innerText = this.cacaoCount;
        this.uiCacaoCount.style.transform = 'scale(1.5)';
        this.uiCacaoCount.style.color = '#763b15';
        setTimeout(() => {
            this.uiCacaoCount.style.transform = 'scale(1)';
            this.uiCacaoCount.style.color = '#FFF';
        }, 150);

        // TODO: En SM64 son 100. En este dev-build usaremos 10 cacaos para validación.
        if (this.cacaoCount === 10 && !this.hasSpawnedCacaoStar) {
            this.hasSpawnedCacaoStar = true;
            if (window.spawnDynamicStar) {
                // Al llegar al umbral, spawnear literalmente frente a la cara de la cámara/jugador
                const sx = window.currentPlayer ? window.currentPlayer.x : 0;
                const sy = window.currentPlayer ? window.currentPlayer.y + 12.0 : 20;
                const sz = window.currentPlayer ? window.currentPlayer.z : 0;
                
                window.spawnDynamicStar("star_100_cacaos", "Misión: Ofrenda de 10 Semillas de Cacao", sx, sy, sz);
            }
        }
        return this.cacaoCount;
    }
}
