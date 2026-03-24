// js/scenes/BootScene.js
// Pantalla de carga — sin assets externos, todo procedural

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('colibri', 'assets/sprites/colibri.png');
    this.load.image('jaguar', 'assets/sprites/jaguar.png');
    this.load.image('serpiente', 'assets/sprites/serpiente.png');
    // Sprites 3D HD Generados
    this.load.image('tijuana', 'assets/sprites/tijuana.png');
    this.load.image('huitzilopochtli', 'assets/sprites/huitzilopochtli.png');
    this.load.image('guerrero_aguila', 'assets/sprites/guerrero_aguila.png');
    this.load.image('aldeano', 'assets/sprites/aldeano_azteca.png');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Fondo oscuro
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRect(0, 0, W, H);

    // Título
    this.add.text(W / 2, H * 0.42, 'TIJUANA', {
      fontFamily: 'Bebas Neue, Impact, sans-serif',
      fontSize: '64px', color: '#ffd700',
      stroke: '#ff3fa4', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.52, 'Alebrije en Vacaciones', {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '18px', color: '#00e5ff',
    }).setOrigin(0.5);

    // Barra de carga falsa (todo es procedural, carga instantánea)
    const border = this.add.rectangle(W / 2, H * 0.6, 300, 12, 0x222244);
    border.setStrokeStyle(2, 0x00e5ff);
    const bar = this.add.rectangle(W / 2 - 150, H * 0.6, 0, 8, 0xff3fa4).setOrigin(0, 0.5);

    const loading = this.add.text(W / 2, H * 0.64, 'Preparando al Guardián...', {
      fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#888899',
    }).setOrigin(0.5);

    // Animación de carga fake → luego pasa a TitleScene
    this.tweens.add({
      targets: bar, width: 300, duration: 900, ease: 'Quad.easeIn',
      onComplete: () => {
        loading.setText('¡Listo! Tijuana despertando...');
        this.time.delayedCall(400, () => {
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.time.delayedCall(450, () => this.scene.start('TitleScene'));
        });
      },
    });
  }
}
