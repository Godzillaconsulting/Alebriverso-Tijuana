// js/scenes/MictlanHubScene.js — Hub central del Mictlán

class MictlanHubScene extends Phaser.Scene {
  constructor() { super({ key: 'MictlanHubScene' }); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    
    if(window.Jukebox) window.Jukebox.playTrack('hub');

    // Ocultar entorno 3D
    const threeDiv = document.getElementById('three-container');
    if (threeDiv) threeDiv.style.display = 'none';

    this.cameras.main.fadeIn(600);

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x08081e, 0x08081e, 0x180530, 0x0a001a, 0.2); // Transparente para ver 3D
    bg.fillRect(0, 0, W, H);
    
    // ── INICIALIZAR MUNDO 3D (Sandbox Mario 64) ──
    this.init3DWorld();

    this._drawCempas(W, H);

    this.add.text(W / 2, 40, '⚡ EL MICTLÁN', {
      fontFamily: 'Bebas Neue, sans-serif', fontSize: '36px',
      color: '#ffd700', stroke: '#ff3fa4', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(W / 2, 72, 'Elige tu próxima época', {
      fontFamily: 'Outfit', fontSize: '14px', color: '#00e5ff',
    }).setOrigin(0.5);

    this._drawStats(W);

    const epocas = [
      { num: 1, nombre: 'TENOCHTITLÁN', año: '1400 d.C.', emoji: '🌿', color: 0x2a6e1e, desbloqueado: true },
      { num: 2, nombre: 'LA CONQUISTA',  año: '1521',      emoji: '⚔️', color: 0x6e2a1e, desbloqueado: window.GameState.piedras.length >= 1 },
      { num: 3, nombre: 'NUEVA ESPAÑA',  año: '1650',      emoji: '🏰', color: 0x6e5a1e, desbloqueado: window.GameState.piedras.length >= 2 },
      { num: 4, nombre: 'INDEPENDENCIA', año: '1810',      emoji: '🔔', color: 0x1e3f6e, desbloqueado: window.GameState.piedras.length >= 3 },
      { num: 5, nombre: 'PORFIRIATO',    año: '1900',      emoji: '🎪', color: 0x4a1e6e, desbloqueado: window.GameState.piedras.length >= 4 },
      { num: 6, nombre: 'REVOLUCIÓN',    año: '1910',      emoji: '🌵', color: 0x6e3a1e, desbloqueado: window.GameState.piedras.length >= 5 },
    ];

    epocas.forEach((ep, i) => this._createPortal(ep, W / 2, 170 + i * 110));
    this._drawMictli(W * 0.82, H * 0.7);

    // Botón Tienda
    const btnTienda = this.add.text(W / 2, H - 25, '🛍️ TIENDA DIFICULTAD', {
      fontFamily: 'Bebas Neue', fontSize: '24px', color: '#ff3fa4',
      backgroundColor: '#1a1a3a', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive();

    btnTienda.on('pointerdown', () => {
      this.cameras.main.shake(100, 0.005);
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(450, () => this.scene.start('ShopScene'));
    });

    const dialogo = ['"Tijuana, ¡ya levántate!"', '"¿Cuánto falta? 5 más y Cancún."', '"El mundo no se va a salvar solo."'];
    let dIdx = 0;
    const dialogBox = this.add.text(W / 2, H - 60, dialogo[0], {
      fontFamily: 'Outfit', fontSize: '13px', color: '#fff',
      backgroundColor: '#1a0535', padding: { x: 12, y: 8 },
      wordWrap: { width: W - 40 }, align: 'center',
    }).setOrigin(0.5);
    this.time.addEvent({ delay: 3000, loop: true, callback: () => { dIdx = (dIdx + 1) % dialogo.length; dialogBox.setText(dialogo[dIdx]); } });

    // ── INPUTS DE CARÁCTER 3D (Mueve al personaje con WASD o Flechas) ──
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    // MOUSE DRAG PARA MOVER LA CÁMARA (LAKITU CAM)
    this.input.on('pointermove', (pointer) => {
        if (pointer.isDown && this.alebrijeCam) {
            this.alebrijeCam.orbitCamera(pointer.x - pointer.prevPosition.x, pointer.y - pointer.prevPosition.y);
        }
    });
  }

  init3DWorld() {
      const container = document.getElementById('three-container');
      if (container) {
          container.style.display = 'block';
          container.style.opacity = '1';
      }

      let scene = window.threeScene;
      let camera = window.threeCamera;
      if (window.game3D) {
          scene = window.game3D.scene;
          camera = window.game3D.camera;
      }
      if (!scene) return;

      // Desactivar controles de la escena del título
      if(window.threeControls) window.threeControls.enabled = false;

      // Remover o dejar el modelo del título atrás
      if (window.threeAlebrijeGroup) {
          window.threeAlebrijeGroup.position.set(-10, 10, -20); // Moverlo lejos
      }

      this.envMeshes = [];

      // TERRENO 3D
      const floorGeo = new THREE.PlaneGeometry(80, 80);
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2a1a, roughness: 1.0 });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      this.envMeshes.push(floor);

      // PLATAFORMAS FLOTANTES Y ESCALONES PARA SALTAR
      const boxGeo = new THREE.BoxGeometry(4, 2, 4);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, flatShading: true });
      
      for(let i=0; i<8; i++) {
          const box = new THREE.Mesh(boxGeo, boxMat);
          box.position.set(Math.random()*20, i * 1.5, Math.random()*-20);
          box.receiveShadow = true; box.castShadow = true;
          scene.add(box);
          this.envMeshes.push(box);
      }

      // INICIAR MOTOR FISICO: ALEBRIJE CONTROLLER
      if (window.game3D) {
          this.alebrijeCam = window.game3D.controller;
          this.alebrijeCam.setEnvironment(this.envMeshes);
          window.actualController = this.alebrijeCam;
      } else if (typeof AlebrijeController !== 'undefined') {
          this.alebrijeCam = new AlebrijeController(scene, camera);
          this.alebrijeCam.setEnvironment(this.envMeshes);
          window.actualController = this.alebrijeCam;
      }
  }

  update(time, delta) {
      if (this.alebrijeCam) {
          let movX = 0, movY = 0;
          if (this.cursors.left.isDown || this.keys.A.isDown) movX = -1;
          if (this.cursors.right.isDown || this.keys.D.isDown) movX = 1;
          if (this.cursors.up.isDown || this.keys.W.isDown) movY = 1; // Arriba = Adelante
          if (this.cursors.down.isDown || this.keys.S.isDown) movY = -1;
          
          const jump = Phaser.Input.Keyboard.JustDown(this.cursors.space);
          
          this.alebrijeCam.setInput(movX, movY, jump);
          this.alebrijeCam.update(delta / 1000); // Se requiere pasar en segundos
          
          if (window.game3D) window.game3D.renderer.render(window.game3D.scene, window.game3D.camera);
          else if (window.threeRenderer) window.threeRenderer.render(window.threeScene, window.threeCamera);
      }
  }

  _createPortal(ep, x, y) {
    const g = this.add.graphics();
    const col = ep.desbloqueado ? ep.color : 0x1a1a2a;
    const bc  = ep.desbloqueado ? 0x00e5ff  : 0x333355;
    g.fillStyle(col, 0.9); g.fillRoundedRect(x - 170, y - 40, 340, 80, 14);
    g.lineStyle(2, bc, 1); g.strokeRoundedRect(x - 170, y - 40, 340, 80, 14);
    g.fillStyle(ep.desbloqueado ? 0xffd700 : 0x333355, 1); g.fillCircle(x - 145, y, 22);
    this.add.text(x - 145, y, `${ep.num}`, { fontFamily: 'Bebas Neue', fontSize: '22px', color: ep.desbloqueado ? '#000' : '#555' }).setOrigin(0.5);
    this.add.text(x - 110, y - 14, `${ep.emoji} ${ep.nombre}`, { fontFamily: 'Bebas Neue, sans-serif', fontSize: '20px', color: ep.desbloqueado ? '#fff' : '#444466' });
    this.add.text(x - 110, y + 8, ep.año, { fontFamily: 'Outfit', fontSize: '13px', color: ep.desbloqueado ? '#00e5ff' : '#333355' });
    this.add.text(x + 130, y, ep.desbloqueado ? '▶ JUGAR' : '🔒', { fontFamily: 'Bebas Neue', fontSize: '18px', color: ep.desbloqueado ? '#ffd700' : '#333355' }).setOrigin(1, 0.5);

    if (ep.desbloqueado) {
      const hit = this.add.rectangle(x, y, 340, 80, 0xffffff, 0).setInteractive();
      hit.on('pointerover', () => { g.clear(); g.fillStyle(col, 1); g.fillRoundedRect(x-170,y-40,340,80,14); g.lineStyle(3,0xff3fa4,1); g.strokeRoundedRect(x-170,y-40,340,80,14); });
      hit.on('pointerout',  () => { g.clear(); g.fillStyle(col,.9); g.fillRoundedRect(x-170,y-40,340,80,14); g.lineStyle(2,bc,1); g.strokeRoundedRect(x-170,y-40,340,80,14); });
      hit.on('pointerdown', () => {
        this.cameras.main.shake(150, 0.006);
        if (window.Jukebox) { window.Jukebox.stop(); window.Jukebox.sfxSelect(); }
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.time.delayedCall(550, () => { window.GameState.epocaActual = ep.num; this.scene.start('LevelScene', { epocaId: ep.num }); });
      });
    }
  }

  _drawStats(W) {
    const g = this.add.graphics();
    g.fillStyle(0x0d0d25, 0.8); g.fillRoundedRect(10, 90, W - 20, 55, 10);
    g.lineStyle(1, 0x00e5ff, 0.5); g.strokeRoundedRect(10, 90, W - 20, 55, 10);
    this.add.text(30, 103, `⭐ Tonalli: ${window.GameState.tonalli}`,  { fontFamily: 'Outfit', fontSize: '13px', color: '#ffd700' });
    this.add.text(30, 122, `🍫 Cacao: ${window.GameState.cacao}`,       { fontFamily: 'Outfit', fontSize: '13px', color: '#ff8c00' });
    this.add.text(W-30,103, `Niv. ${window.GameState.nivel}`,            { fontFamily: 'Bebas Neue', fontSize: '20px', color: '#00e5ff' }).setOrigin(1,0);
    this.add.text(W-30,122, `🔮 ${window.GameState.piedras.length}/6`,   { fontFamily: 'Outfit', fontSize: '13px', color: '#ff3fa4' }).setOrigin(1,0);
  }

  _drawMictli(x, y) {
    const g = this.add.graphics();
    g.fillStyle(0xf0e6d3,1); g.fillEllipse(x, y-20, 50, 55);
    g.fillStyle(0x0a0a1a,1); g.fillEllipse(x-10,y-18,14,16); g.fillEllipse(x+10,y-18,14,16);
    for(let i=-2;i<=2;i++) g.fillRect(x+i*7-2,y+6,5,8);
    g.fillStyle(0xff8c00,1); g.fillRect(x-25,y+16,50,30);
    this.tweens.add({ targets: g, y: '-=5', duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(x, y-60, '¡Apúrate!', { fontFamily: 'Outfit', fontSize: '11px', color: '#fff', backgroundColor: '#333366', padding:{x:6,y:3} }).setOrigin(0.5);
  }

  _drawCempas(W, H) {
    const g = this.add.graphics();
    g.fillStyle(0xff8c00, 0.1);
    for(let i=0;i<8;i++) g.fillCircle(Phaser.Math.Between(0,W), Phaser.Math.Between(H*.7,H), Phaser.Math.Between(15,35));

    // Botón flotante para la Tienda
    const shopBtn = this.add.circle(W - 45, H - 45, 30, 0xff3fa4, 0.8).setInteractive({ cursor: 'pointer' });
    shopBtn.setStrokeStyle(3, 0xffd700);
    this.add.text(W - 45, H - 45, '🛒', { fontSize: '30px' }).setOrigin(0.5);
    shopBtn.on('pointerover', () => shopBtn.setFillStyle(0xff3fa4, 1));
    shopBtn.on('pointerout', () => shopBtn.setFillStyle(0xff3fa4, 0.8));
    shopBtn.on('pointerdown', () => {
      this.cameras.main.shake(100, 0.01);
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('ShopScene'));
    });
  }
}
