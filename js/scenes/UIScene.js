// js/scenes/UIScene.js — HUD superpuesto (corre en paralelo con las escenas de juego)

class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    this.vidaIcons = [];
    this.cacoTxt = null;
    this.epocaTxt = null;
    this.tonalliTxt = null;
  }

  create() {
    const W = this.scale.width;

    // ── Barra superior negra ──
    const bar = this.add.rectangle(W / 2, 28, W, 56, 0x000000, 0.75);
    bar.setStrokeStyle(1, 0x00e5ff, 0.4);

    // Época actual
    this.epocaTxt = this.add.text(W / 2, 16, '🌿 TENOCHTITLÁN', {
      fontFamily: 'Bebas Neue, sans-serif', fontSize: '18px', color: '#ffd700',
    }).setOrigin(0.5, 0);

    // Cacao
    this.cacoTxt = this.add.text(W - 14, 34, `🍫 ${window.GameState.cacao}`, {
      fontFamily: 'Outfit', fontSize: '15px', color: '#D2691E',
    }).setOrigin(1, 0.5);

    // Tonalli
    this.tonalliTxt = this.add.text(14, 34, `⭐ ${window.GameState.tonalli}`, {
      fontFamily: 'Outfit', fontSize: '15px', color: '#ffd700',
    }).setOrigin(0, 0.5);

    // Vida de Tijuana (corazones)
    this._buildVida(3, 3);

    // Botón pausa / menú
    const menuBtn = this.add.text(W / 2, 36, '≡', {
      fontFamily: 'Outfit', fontSize: '22px', color: '#888899',
    }).setOrigin(0.5).setInteractive();
    menuBtn.on('pointerdown', () => {
      this.scene.pause(window.GameState.epocaActual === 1 ? 'Epoca1Scene' : 'MictlanHubScene');
      this._showPauseMenu(W);
    });

    // Evento Global para actualizar HUD desde otras escenas
    this.events.on('updateHUD', () => {
      this.updateCacao(window.GameState.cacao);
      this.updateTonalli(window.GameState.tonalli);
      this.updateVida(window.GameState.vida, window.GameState.vidaMax);
    });
  }

  updateVida(current, max) {
    this.vidaIcons.forEach(i => i.destroy());
    this.vidaIcons = [];
    this._buildVida(current, max);
  }

  updateCacao(val) { if (this.cacoTxt) this.cacoTxt.setText(`🍫 ${val}`); }
  updateTonalli(val) { if (this.tonalliTxt) this.tonalliTxt.setText(`⭐ ${val}`); }
  updateEpoca(nombre) { if (this.epocaTxt) this.epocaTxt.setText(nombre); }

  _buildVida(current, max) {
    const W = this.scale.width;
    const startX = W / 2 - (max * 18) / 2;
    for (let i = 0; i < max; i++) {
      const icon = this.add.text(startX + i * 20, 52, i < current ? '❤️' : '🖤', {
        fontSize: '14px',
      });
      this.vidaIcons.push(icon);
    }
  }

  _showPauseMenu(W) {
    const overlay = this.add.rectangle(W / 2, 466, W, 932, 0x000000, 0.85);
    this.add.text(W / 2, 300, 'PAUSE', {
      fontFamily: 'Bebas Neue', fontSize: '64px', color: '#ffd700',
    }).setOrigin(0.5);

    const activeScene = window.GameState.epocaActual === 1 ? 'Epoca1Scene' : 'MictlanHubScene';

    const resumeBtn = this.add.text(W / 2, 430, '▶ CONTINUAR', {
      fontFamily: 'Bebas Neue', fontSize: '28px', color: '#ffffff',
      backgroundColor: '#ff3fa4', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive();
    resumeBtn.on('pointerdown', () => {
      overlay.destroy(); resumeBtn.destroy(); menuBtn2.destroy();
      this.scene.resume(activeScene);
    });

    const menuBtn2 = this.add.text(W / 2, 510, '🏠 MENÚ', {
      fontFamily: 'Bebas Neue', fontSize: '24px', color: '#00e5ff',
      backgroundColor: '#1a1a3a', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive();
    menuBtn2.on('pointerdown', () => {
      if (activeScene !== 'MictlanHubScene') {
        this.scene.stop(activeScene);
      }
      this.scene.stop('UIScene');
      this.scene.start('MictlanHubScene');
    });
  }
}
