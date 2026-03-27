// uiManager.js
// Gestor Desacoplado de Reglas de Interfaz HTML para aislar el Canvas 3D

export class UIManager {
    constructor() {
        // Cached DOM Elements
        this.startScreen = document.getElementById('start-screen');
        this.scoreDisplay = document.getElementById('score-display');
        this.cacaoText = document.getElementById('cacao-count');
        this.starText = document.getElementById('star-count');
        this.hpContainer = document.getElementById('hp-display');
        this.keyContainer = document.getElementById('key-display');
        this.gameOverScreen = document.getElementById('game-over-screen');
        
        // Elementos Boss
        this.bossUI = document.getElementById('boss-ui');
        this.bossName = document.getElementById('boss-name');
        this.bossHpFill = document.getElementById('boss-hp-fill');
        
        this.maxHP = 3; // Alebrije base HP
        this.keys = 0;
        
        // Listeners for Custom Events Dispatched by Three.js Kernel
        window.addEventListener('scoreUpdate', (e) => this.updateScore(e.detail.score));
        window.addEventListener('starCollected', (e) => this.triggerStarVictory(e.detail.id));
        window.addEventListener('keyCollected', (e) => this.addKey(e.detail.door));
        window.addEventListener('keyUsed', () => this.useKey());
        window.addEventListener('bossFightStart', (e) => this.showBossUI(e.detail.name));
        window.addEventListener('bossHPUpdate', (e) => this.updateBossHP(e.detail.hpPercentage));
        window.addEventListener('missionStart', (e) => this.showMissionSplash(e.detail.name));
        window.addEventListener('playerHurt', (e) => this.updateHP(e.detail.hp));
        window.addEventListener('gameOver', () => this.showGameOver());
        window.addEventListener('gameStart', () => this.hideStartScreen());
        window.addEventListener('gamePause', () => this.showPauseScreen());
        window.addEventListener('gameResume', () => this.hidePauseScreen());
        window.addEventListener('oxygenUpdate', (e) => this.updateOxygen(e.detail.oxygen));
        window.addEventListener('dialogueStart', (e) => this.startDialogue(e.detail.texts));
        window.addEventListener('dialogueNext', () => this.nextDialogue());

        // === EPOCH 7: INVENTARIO, MERCADER Y SAVE SLOTS ===
        window.addEventListener('inventoryUpdate', (e) => this.renderInventoryGrid(e.detail));
        window.addEventListener('merchantOpen',    (e) => this.openMerchantModal(e.detail));
        window.addEventListener('merchantClosed',  ()  => this.closeMerchantModal());
        window.addEventListener('merchantItemBought', (e) => this.refreshMerchantCoins(e.detail.coins));
        window.addEventListener('gameSaved',       (e) => this.flashSaveNotice(e.detail.slot));

        // Eventos estáticos de pestañas del Mercader
        const tabBuy = document.getElementById('tab-buy');
        const tabTune = document.getElementById('tab-tune');
        const contentBuy = document.getElementById('merchant-content-buy');
        const contentTune = document.getElementById('merchant-content-tune');
        
        if (tabBuy && tabTune && contentBuy && contentTune) {
            tabBuy.addEventListener('click', () => {
                tabBuy.classList.add('active');
                tabTune.classList.remove('active');
                contentBuy.style.display = 'block';
                contentTune.style.display = 'none';
            });
            tabTune.addEventListener('click', () => {
                tabTune.classList.add('active');
                tabBuy.classList.remove('active');
                contentTune.style.display = 'block';
                contentBuy.style.display = 'none';
            });
        }

        // Keybind I / Tab → Inventario
        window.addEventListener('keydown', (ev) => {
            if (ev.code === 'KeyI' || ev.code === 'Tab') {
                ev.preventDefault();
                this.toggleInventoryModal();
            }
            if (ev.code === 'F5') {
                ev.preventDefault();
                this.toggleSaveModal();
            }
        });

        
        this.pauseScreen = document.getElementById('pause-screen');
        this.oxygenContainer = document.getElementById('oxygen-container');
        this.oxygenBar = document.getElementById('oxygen-bar');
        
        this.dialogOverlay = document.getElementById('dialog-overlay');
        this.dialogText = document.getElementById('dialog-text');

        // === INTERACTION PROMPT (RE4 Contextual Hint) ===
        this._promptEl = document.createElement('div');
        this._promptEl.id = 'interaction-prompt';
        this._promptEl.style.cssText = `
            display: none;
            position: fixed;
            bottom: 22%; left: 50%; transform: translateX(-50%);
            background: rgba(10,5,0,0.88);
            border: 2px solid #d4af37;
            border-radius: 30px;
            padding: 8px 22px;
            color: #ffd700;
            font-family: 'Bangers', cursive;
            font-size: 1.4rem;
            letter-spacing: 2px;
            pointer-events: none;
            z-index: 150;
            box-shadow: 0 0 16px rgba(212,175,55,0.4);
            animation: panelSlideIn 0.15s ease-out;
        `;
        document.body.appendChild(this._promptEl);
        this._promptVisible = false;

        
        this.dialogueQueue = [];
        this.currentDialogIndex = 0;
        this.isTyping = false;
        
        // Pantalla de Victoria
        this.victoryScreen = document.getElementById('victory-screen');
        
        // Elementos Cinematicos de Mision
        this.missionSplash = document.getElementById('mission-splash');
        this.missionHeader = document.getElementById('mission-header');
        this.missionTitle = document.getElementById('mission-title');
        
        this.starsAcquired = 0;
        
        // Escuchar victoria de jefe: BOSS_STAR activa cinemática
        window.addEventListener('starCollected', (e) => {
            if (e.detail && e.detail.id === 'BOSS_STAR') {
                this.showVictoryScreen();
            }
        });
        
        // Render inicial apagado (Start screen activo)
        this.renderHearts(this.maxHP);
    }
    
    hideStartScreen() {
        if(this.startScreen) {
            this.startScreen.style.opacity = '0';
            setTimeout(() => {
                this.startScreen.style.display = 'none';
            }, 500);
        }
        
        // Mostrar elementos de HUD Gameplay
        if(this.scoreDisplay) this.scoreDisplay.style.display = 'flex';
        if(this.hpContainer) this.hpContainer.style.display = 'flex';
        if(this.keyContainer) this.keyContainer.style.display = 'flex';
    }
    
    showVictoryScreen() {
        if (!this.victoryScreen) return;
        // Ocultar HUD de batalla
        if (this.bossUI) this.bossUI.style.display = 'none';
        // Pausa el juego antes del fade-in
        window.dispatchEvent(new CustomEvent('gamePause'));
        // Fade-in dramático
        this.victoryScreen.style.opacity = '0';
        this.victoryScreen.style.display = 'flex';
        let op = 0;
        const fadeIn = setInterval(() => {
            op = Math.min(op + 0.03, 1);
            this.victoryScreen.style.opacity = String(op);
            if (op >= 1) clearInterval(fadeIn);
        }, 16);
        // ESC para cerrar la pantalla de victoria
        const closeHandler = (e) => {
            if (e.key === 'Escape') {
                this.victoryScreen.style.display = 'none';
                window.removeEventListener('keydown', closeHandler);
            }
        };
        window.addEventListener('keydown', closeHandler);
    }
    
    addKey(doorId) {
        if (!this.keyContainer) return;
        this.keys++;
        const k = document.createElement('div');
        k.className = 'key-icon';
        this.keyContainer.appendChild(k);
    }
    
    useKey() {
        if (!this.keyContainer || this.keys <= 0) return;
        this.keys--;
        if (this.keyContainer.lastChild) {
            this.keyContainer.removeChild(this.keyContainer.lastChild);
        }
    }
    
    showBossUI(name) {
        if (!this.bossUI) return;
        this.bossUI.style.display = 'block';
        if (this.bossName) this.bossName.innerText = name;
        if (this.bossHpFill) this.bossHpFill.style.width = '100%';
    }
    
    updateBossHP(percentage) {
        if (this.bossHpFill) {
            this.bossHpFill.style.width = `${Math.max(0, percentage)}%`;
        }
        if (percentage <= 0 && this.bossUI) {
            setTimeout(() => { this.bossUI.style.display = 'none'; }, 2000); // Esconde la barra victoriosa
        }
    }
    
    updateScore(score) {
        if (this.cacaoText) {
            this.cacaoText.innerText = score.toString();
        }
        if(this.scoreDisplay) {
            this.scoreDisplay.classList.add('pop');
            setTimeout(() => this.scoreDisplay.classList.remove('pop'), 150);
        }
    }
    
    updateOxygen(value) { // 0.0 to 10.0
        if (!this.oxygenContainer || !this.oxygenBar) return;
        
        if (value >= 9.9) {
            this.oxygenContainer.style.display = 'none';
        } else {
            this.oxygenContainer.style.display = 'block';
            const percentage = (value / 10.0) * 100;
            this.oxygenBar.style.width = `${percentage}%`;
            
            // Si queda poco oxigeno, cambiar a rojo
            if (percentage < 30) {
                this.oxygenBar.style.background = 'red';
            } else {
                this.oxygenBar.style.background = 'linear-gradient(90deg, #00e5ff, #0077ff)';
            }
        }
    }
    
    startDialogue(texts) {
        if (!this.dialogOverlay || !texts || texts.length === 0) return;
        this.dialogueQueue = texts;
        this.currentDialogIndex = 0;
        this.dialogOverlay.style.display = 'flex';
        this.typeText();
    }
    
    nextDialogue() {
        if (this.isTyping) {
            // Skip typing and show full text immediately
            this.isTyping = false;
            this.dialogText.innerText = this.dialogueQueue[this.currentDialogIndex];
        } else {
            this.currentDialogIndex++;
            if (this.currentDialogIndex < this.dialogueQueue.length) {
                this.typeText();
            } else {
                // End dialogue
                this.dialogOverlay.style.display = 'none';
                window.dispatchEvent(new CustomEvent('dialogueEnd'));
            }
        }
    }
    
    typeText() {
        this.isTyping = true;
        const currentString = this.dialogueQueue[this.currentDialogIndex];
        this.dialogText.innerText = "";
        let charIndex = 0;
        
        const typeCharacter = () => {
            if (!this.isTyping || !this.dialogOverlay || this.dialogOverlay.style.display === 'none') {
                return; // Fue interrumpido o cerrado
            }
            if (charIndex < currentString.length) {
                this.dialogText.innerText += currentString.charAt(charIndex);
                charIndex++;
                setTimeout(typeCharacter, 30); // Velocidad de Máquina de escribir
            } else {
                this.isTyping = false;
            }
        };
        
        typeCharacter();
    }
    
    showMissionSplash(missionName) {
        if (!this.missionSplash) return;
        this.missionSplash.style.display = 'flex';
        this.missionHeader.innerText = 'OBJETIVO PRIMARIO';
        this.missionTitle.innerText = `⭐ Misión: ${missionName} ⭐`;
        this.missionTitle.className = 'mission-title';
        
        setTimeout(() => {
            this.missionTitle.classList.add('show');
            setTimeout(() => {
                this.missionTitle.classList.remove('show');
                setTimeout(() => {
                    this.missionSplash.style.display = 'none';
                }, 1000);
            }, 3000);
        }, 50);
    }

    triggerStarVictory(starId) {
        this.starsAcquired++;
        if (this.starText) this.starText.innerText = this.starsAcquired;
        
        if (!this.missionSplash) return;
        this.missionSplash.style.display = 'flex';
        this.missionHeader.innerText = 'ACADEMY COURSE CLEARED';
        this.missionTitle.innerText = '¡ESTRELLA CONSEGUIDA!';
        this.missionTitle.className = 'mission-title star-get';
        
        document.body.classList.add('cinematic-bars');
        
        setTimeout(() => {
            this.missionTitle.classList.add('show');
        }, 50);
        
        setTimeout(() => {
            this.missionTitle.classList.remove('show');
            document.body.classList.remove('cinematic-bars');
            setTimeout(() => {
                this.missionSplash.style.display = 'none';
            }, 1000);
        }, 5000);
    }
    
    renderHearts(currentHP) {
        if (!this.hpContainer) return;
        this.hpContainer.innerHTML = '';
        
        for(let i = 0; i < this.maxHP; i++) {
            const heart = document.createElement('div');
            // Vida actual dicta si el corazón es de color o filtro grisáceo (Estilo Gema Hexagonal)
            heart.className = i < currentHP ? 'heart full' : 'heart empty';
            this.hpContainer.appendChild(heart);
        }
    }
    
    updateHP(hp) {
        this.renderHearts(hp);
        
        // Destello rojo en pantalla dañada (Full viewport)
        const flash = document.createElement('div');
        flash.className = 'damage-flash';
        document.body.appendChild(flash);
        // Destruir Nodo al terminar FadeOut
        setTimeout(() => flash.remove(), 250);
    }
    
    showGameOver() {
        if(this.gameOverScreen) {
            // Eliminar HUD temporalmente
            if(this.scoreDisplay) this.scoreDisplay.style.display = 'none';
            if(this.hpContainer) this.hpContainer.style.display = 'none';
            
            this.gameOverScreen.style.display = 'flex';
            // Trigger Opacity Transiticion Inmediata
            setTimeout(() => this.gameOverScreen.style.opacity = '1', 10);
        }
    }
    
    showPauseScreen() {
        if(this.pauseScreen) {
            this.pauseScreen.style.display = 'flex';
            this.pauseScreen.style.opacity = '1';
        }
    }
    
    hidePauseScreen() {
        if(this.pauseScreen) {
            this.pauseScreen.style.opacity = '0';
            setTimeout(() => {
                if (this.pauseScreen) this.pauseScreen.style.display = 'none';
            }, 300);
        }
    }

    hideGameOver() {
        if(this.gameOverScreen) {
            this.gameOverScreen.style.opacity = '0';
            setTimeout(() => this.gameOverScreen.style.display = 'none', 1000);
            
            // Regresar el HUD
            if(this.scoreDisplay) this.scoreDisplay.style.display = 'flex';
            if(this.hpContainer) this.hpContainer.style.display = 'flex';
        }
    }

    // ═══════════════════════════════════════════════════════
    // EPOCH 7 — INVENTARIO
    // ═══════════════════════════════════════════════════════

    toggleInventoryModal() {
        const modal = document.getElementById('inventory-modal');
        if (!modal) return;
        const isOpen = modal.style.display !== 'none';
        modal.style.display = isOpen ? 'none' : 'flex';
        // Bloquear input del juego mientras el modal está abierto
        window.dispatchEvent(new CustomEvent(isOpen ? 'inputUnlock' : 'inputLock'));
    }

    /**
     * Renderiza los 12 slots del inventario como un grid CSS 3x4.
     * @param {Array<{slotIndex, type, count, def}>} slots
     */
    renderInventoryGrid(slots) {
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;
        grid.innerHTML = '';

        slots.forEach(slot => {
            const el = document.createElement('div');
            el.className = 'inv-slot';
            el.dataset.slotIndex = slot.slotIndex;

            if (slot.type && slot.def) {
                const img = document.createElement('img');
                img.src = slot.def.icon;
                img.alt = slot.def.name;
                el.appendChild(img);

                if (slot.count > 1) {
                    const countEl = document.createElement('span');
                    countEl.className = 'slot-count';
                    countEl.textContent = `x${slot.count}`;
                    el.appendChild(countEl);
                }

                // Tooltip al hover
                el.addEventListener('mouseenter', () => {
                    const tip = document.getElementById('inventory-tooltip');
                    if (tip) tip.textContent = `${slot.def.name} — ${slot.def.description}`;
                });

                // Click → usar el ítem (herbs, etc.)
                el.addEventListener('click', () => {
                    window.dispatchEvent(new CustomEvent('inventoryUseItem', { detail: { slotIndex: slot.slotIndex } }));
                });
            } else {
                el.style.opacity = '0.3';
            }

            grid.appendChild(el);
        });

        const tip = document.getElementById('inventory-tooltip');
        if (tip && !grid.querySelector(':hover')) tip.textContent = '';
    }

    // ═══════════════════════════════════════════════════════
    // EPOCH 7 — MERCADER
    // ═══════════════════════════════════════════════════════

    openMerchantModal({ catalog, coins }) {
        const modal = document.getElementById('merchant-modal');
        if (!modal) return;
        modal.style.display = 'flex';

        const coinsEl = document.getElementById('merchant-coins-count');
        if (coinsEl) coinsEl.textContent = coins;

        // Limpiar catálogos
        const catalogEl = document.getElementById('merchant-catalog');
        const upgradesEl = document.getElementById('merchant-upgrades');
        if (catalogEl) catalogEl.innerHTML = '';
        if (upgradesEl) upgradesEl.innerHTML = '';

        // Render Pestaña: Comprar (Items Base)
        catalog.forEach((entry, i) => {
            const li = document.createElement('li');
            li.className = 'merch-item';
            li.innerHTML = `
                <div class="merch-info">
                    <span class="merch-name">${entry.label}</span>
                    <span class="merch-stock">En Stock: ${entry.stock}</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="color:#ffd700; font-weight:bold;">🌰 ${entry.price}</span>
                    <button class="btn-buy" ${entry.stock <= 0 ? 'disabled' : ''} data-idx="${i}">Comprar</button>
                </div>
            `;
            li.querySelector('button').addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('merchantBuy', { detail: { index: i } }));
            });
            if (catalogEl) catalogEl.appendChild(li);
        });

        // Render Pestaña: Afinar Arma (Upgrades)
        if (window.weaponUpgradeSystem && upgradesEl) {
            const upCatalog = window.weaponUpgradeSystem.getCatalog();
            upCatalog.forEach((up) => {
                const li = document.createElement('li');
                li.className = 'upgrade-item';
                li.innerHTML = `
                    <div class="upgrade-info">
                        <span class="upgrade-name">${up.label}</span>
                        <span class="upgrade-detail">Nivel: ${up.currentLabel} → ${up.nextLabel}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="color:${up.maxed ? '#888' : '#ffd700'}; font-weight:bold;">${up.maxed ? 'MAX' : '🌰 ' + up.cost}</span>
                        <button class="btn-buy" ${up.maxed ? 'disabled' : ''}>Mejorar</button>
                    </div>
                `;
                li.querySelector('button').addEventListener('click', () => {
                    const res = window.weaponUpgradeSystem.buy(up.upgradeId);
                    this.showMerchantFeedback(res.message, res.success);
                    if (res.success) {
                        // Refrescar UI in-place sin cerrar el modal
                        this.openMerchantModal({ catalog, coins: GlobalState.coins });
                    }
                });
                upgradesEl.appendChild(li);
            });
        }

        window.dispatchEvent(new CustomEvent('inputLock'));
    }

    showMerchantFeedback(msg, success) {
        const feedback = document.getElementById('merchant-feedback');
        if (!feedback) return;
        feedback.textContent = msg;
        feedback.style.color = success ? '#00ff88' : '#ff5555';
        clearTimeout(this._merchantFeedbackTimer);
        this._merchantFeedbackTimer = setTimeout(() => { feedback.textContent = ''; }, 2000);
    }

    closeMerchantModal() {
        const modal = document.getElementById('merchant-modal');
        if (modal) modal.style.display = 'none';
        window.dispatchEvent(new CustomEvent('inputUnlock'));
    }

    refreshMerchantCoins(coins) {
        const el = document.getElementById('merchant-coins-count');
        if (el) el.textContent = coins;
    }

    // ═══════════════════════════════════════════════════════
    // EPOCH 7 — SAVE SLOTS
    // ═══════════════════════════════════════════════════════

    toggleSaveModal() {
        const modal = document.getElementById('save-modal');
        if (!modal) return;
        const isOpen = modal.style.display !== 'none';
        if (isOpen) {
            modal.style.display = 'none';
            window.dispatchEvent(new CustomEvent('inputUnlock'));
        } else {
            this._renderSaveSlots();
            modal.style.display = 'flex';
            window.dispatchEvent(new CustomEvent('inputLock'));
        }
    }

    _renderSaveSlots() {
        const container = document.getElementById('save-slots-container');
        if (!container) return;
        container.innerHTML = '';

        // Obtener metadata de los 3 slots
        const metadata = window.saveSystem?.getSlotsMetadata?.() || [];

        metadata.forEach(meta => {
            const el = document.createElement('div');
            el.className = 'save-slot';

            let infoHTML;
            if (meta.empty) {
                infoHTML = `<div class="slot-title">Slot ${meta.slot + 1}</div>
                            <div class="slot-info">— Vacío —</div>`;
            } else {
                const d = new Date(meta.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
                infoHTML = `<div class="slot-title">Slot ${meta.slot + 1} — ⭐${meta.stars}</div>
                            <div class="slot-info">HP: ${meta.health} &nbsp;|&nbsp; ${d}</div>`;
            }

            el.innerHTML = `
                <div>${infoHTML}</div>
                <div class="slot-btns">
                    <button class="btn-save" data-slot="${meta.slot}">Guardar</button>
                    ${!meta.empty ? `<button class="btn-load" data-slot="${meta.slot}">Cargar</button>` : ''}
                </div>`;

            el.querySelector('.btn-save').addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('saveRequest', { detail: { slot: meta.slot } }));
                this.toggleSaveModal();
            });

            if (!meta.empty) {
                el.querySelector('.btn-load').addEventListener('click', () => {
                    window.dispatchEvent(new CustomEvent('loadRequest', { detail: { slot: meta.slot } }));
                    this.toggleSaveModal();
                });
            }

            container.appendChild(el);
        });
    }

    /**
     * Notificación flash "Guardado en Slot N" tras auto-save o guardado manual.
     * @param {number} slot
     */
    flashSaveNotice(slot) {
        const notice = document.createElement('div');
        notice.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: rgba(15,8,2,0.92); border: 2px solid #d4af37;
            color: #ffd700; font-family: 'Bangers', cursive; font-size: 1.3rem;
            letter-spacing: 2px; padding: 10px 28px; border-radius: 10px;
            z-index: 9999; pointer-events: none;
            animation: panelSlideIn 0.3s ease-out;
        `;
        notice.textContent = `💾 Progreso Guardado — Slot ${slot + 1}`;
        document.body.appendChild(notice);
        setTimeout(() => notice.remove(), 2500);
    }

    // ═══════════════════════════════════════════════════════
    // EPOCH 7B — INTERACTION PROMPT (RE4 Style)
    // ═══════════════════════════════════════════════════════

    /**
     * Muestra el hint contextual en pantalla (tipo RE4 "[ E ] Interactuar").
     * Llamar desde el game loop cuando el jugador esté en radio de un NPC/switch/drop.
     * @param {string} label - Texto del prompt (e.g. "Hablar con Aldeano")
     */
    showInteractionPrompt(label = 'Interactuar') {
        if (!this._promptEl) return;
        if (this._promptVisible && this._promptEl.textContent === `[ E ]  ${label}`) return;
        this._promptEl.textContent = `[ E ]  ${label}`;
        this._promptEl.style.display = 'block';
        this._promptVisible = true;
    }

    /**
     * Oculta el hint de interacción.
     */
    hideInteractionPrompt() {
        if (!this._promptEl || !this._promptVisible) return;
        this._promptEl.style.display = 'none';
        this._promptVisible = false;
    }
}

