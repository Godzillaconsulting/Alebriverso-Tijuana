// js/scenes/ShopScene.js — Tienda de disfraces y dificultad dinámica

class ShopScene extends Phaser.Scene {
  constructor() { super({ key: 'ShopScene' }); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Fondo Mictlán pero más oscuro
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0515, 0x050010, 1);
    bg.fillRect(0, 0, W, H);

    // Título Tienda
    this.add.text(W / 2, 40, '🛒 TIENDA DEL MICTLÁN', {
      fontFamily: 'Bebas Neue, sans-serif', fontSize: '32px',
      color: '#ff8c00', stroke: '#ff3fa4', strokeThickness: 4,
    }).setOrigin(0.5);

    // Cacao actual
    this.cacaoTxt = this.add.text(W / 2, 75, `Tienes: 🍫 ${window.GameState.cacao} Cacaos`, {
      fontFamily: 'Outfit', fontSize: '16px', color: '#ffd700',
    }).setOrigin(0.5);

    // Catálogo de trajes
    // id: identificador, nombre: string, tipo: string (Fácil, Normal, Hardcore),
    // coste: int, dañoMult: float, xpMult: float, desc: string
    const trajes = [
      { id: 'base', nombre: 'Tijuana Clásico', tipo: 'Normal', coste: 0, dañoMult: 1.0, xpMult: 1.0, desc: 'Traje base. Sin bonos ni castigos.' },
      { id: 'adelita', nombre: 'Vestido Adelita', tipo: 'Fácil', coste: 50, dañoMult: 0.5, xpMult: 0.8, desc: 'Recibes MITAD de daño. Ganas 20% menos XP.' },
      { id: 'conquistador', nombre: 'Armadura Conquistador', tipo: 'Hardcore', coste: 100, dañoMult: 2.0, xpMult: 3.0, desc: 'Recibes DOBLE de daño. Ganas TRIPLE XP (Tonalli).' }
    ];

    const startY = 140;
    const stepY = 160;

    trajes.forEach((traje, i) => this._crearTarjetaTraje(traje, W / 2, startY + i * stepY));

    // Botón Volver
    const btnVolver = this.add.text(W / 2, H - 60, '◀ VOLVER AL HUB', {
      fontFamily: 'Bebas Neue', fontSize: '24px', color: '#00e5ff',
      backgroundColor: '#1a1a3a', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive();

    btnVolver.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(350, () => this.scene.start('MictlanHubScene'));
    });

    this.cameras.main.fadeIn(400);
  }

  _crearTarjetaTraje(traje, x, y) {
    const W = this.scale.width;
    const g = this.add.graphics();
    const esEquipado = window.GameState.disfrazActual === traje.id;
    const esComprado = window.GameState.disfracesDesbloqueados.includes(traje.id);

    const bgColor = esEquipado ? 0x2a1e3e : 0x1a1a2a;
    const borderColor = esEquipado ? 0xff3fa4 : 0x333355;

    g.fillStyle(bgColor, 0.9);
    g.fillRoundedRect(x - 180, y, 360, 140, 10);
    g.lineStyle(2, borderColor, 1);
    g.strokeRoundedRect(x - 180, y, 360, 140, 10);

    // Nombre y Tipo
    let colorTipo = '#fff';
    if (traje.tipo === 'Fácil') colorTipo = '#00ff88';
    if (traje.tipo === 'Hardcore') colorTipo = '#ff3333';
    
    this.add.text(x - 160, y + 15, traje.nombre, { fontFamily: 'Bebas Neue', fontSize: '22px', color: '#ffd700' });
    this.add.text(x + 160, y + 18, `[${traje.tipo}]`, { fontFamily: 'Outfit', fontSize: '13px', color: colorTipo, fontStyle: 'bold' }).setOrigin(1, 0);

    // Descripción y Efectos
    this.add.text(x - 160, y + 45, traje.desc, { fontFamily: 'Outfit', fontSize: '12px', color: '#bbbbcc', wordWrap: { width: 320 } });
    this.add.text(x - 160, y + 80, `Daño: x${traje.dañoMult} | XP: x${traje.xpMult}`, { fontFamily: 'Outfit', fontSize: '13px', color: '#ff8c00' });

    // Botón de Acción (Comprar / Equipar / Equipado)
    let btnText = '';
    let btnColor = '';
    let funcAccion = null;

    if (esEquipado) {
      btnText = '✅ EQUIPADO';
      btnColor = '#555555';
    } else if (esComprado) {
      btnText = '👕 EQUIPAR';
      btnColor = '#00e5ff';
      funcAccion = () => this._equipar(traje.id);
    } else {
      btnText = `🛒 COMPRAR (🍫 ${traje.coste})`;
      btnColor = window.GameState.cacao >= traje.coste ? '#ff3fa4' : '#555555';
      if (window.GameState.cacao >= traje.coste) funcAccion = () => this._comprar(traje);
    }

    const btn = this.add.text(x, y + 115, btnText, {
      fontFamily: 'Bebas Neue', fontSize: '18px', color: '#fff',
      backgroundColor: btnColor.replace('#', '0x'), padding: { x: 15, y: 5 },
    }).setOrigin(0.5);

    if (funcAccion) {
      btn.setInteractive();
      btn.on('pointerdown', () => {
        funcAccion();
        this.cameras.main.shake(100, 0.005);
        this.time.delayedCall(150, () => this.scene.restart()); // Recargar UI
      });
    }
  }

  _comprar(traje) {
    if (window.GameState.cacao >= traje.coste) {
      window.GameState.cacao -= traje.coste;
      window.GameState.disfracesDesbloqueados.push(traje.id);
      window.GameState.disfrazActual = traje.id; // Autoequip
    }
  }

  _equipar(id) {
    window.GameState.disfrazActual = id;
  }
}
