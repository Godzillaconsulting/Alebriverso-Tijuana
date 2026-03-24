// js/scenes/TitleScene.js
// Pantalla de título animada con menú principal

class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── INICIALIZAR FONDO 3D MID-POLY ──
    this.initThreeJSBackground();

    // Disparador de interacción para AudioContext
    this.input.once('pointerdown', () => {
      if(window.Jukebox) {
        window.Jukebox.init();
        window.Jukebox.playTrack('title');
      }
    });

    // Fondo Mictlán (Transparente para ver el 3D)
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a0a2a, 0x1a0a2a, 0x050010, 0x050010, 0.3);
    bg.fillRect(0, 0, W, H);

    this.createFlowers(W, H);
    // this.createPyramids(W, H); // Eliminado (Refactor a Todo 3D)
    this.createSouls(W, H);

    // ── TÍTULO (Glassmorphism Effect) ──
    const titleBg = this.add.graphics();
    titleBg.fillStyle(0x0a0515, 0.5);
    titleBg.fillRoundedRect(W / 2 - W * 0.45, H * 0.1, W * 0.9, 140, 20);
    titleBg.lineStyle(2, 0xff3fa4, 0.8);
    titleBg.strokeRoundedRect(W / 2 - W * 0.45, H * 0.1, W * 0.9, 140, 20);

    const titleText = this.add.text(W / 2, H * 0.20, 'TIJUANA', {
      fontFamily: 'Bebas Neue, Impact, sans-serif',
      fontSize: '90px',
      color: '#ffffff',
      stroke: '#ff3fa4',
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#00e5ff', blur: 25, fill: true, stroke: true },
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.32, 'ALEBRIJE EN VACACIONES', {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '22px',
      color: '#ffd700',
      letterSpacing: 8,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true }
    }).setOrigin(0.5);

    this.tweens.add({
      targets: titleText,
      scaleX: 1.04, scaleY: 1.04,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Tijuana 2D procedural (LO OCULTO PARA QUE VEAS EL 3D VERDADERO) ──
    // this.drawTijuana(W / 2, H * 0.57);

    // ── Piedras slots ──
    this.drawPiedrasSlots(W, H);

    // ── Frase ──
    const frase = this.add.text(W / 2, H * 0.82, '"Ya casi llego a Cancún..."', {
      fontFamily: 'Outfit, sans-serif', fontSize: '16px',
      color: '#ffaadd', fontStyle: 'italic',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: frase, alpha: 1, duration: 1500, delay: 800 });

    // ── Botón JUGAR ──
    this.createBoton(W / 2, H * 0.89, '▶  JUGAR', () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      const threeCont = document.getElementById('three-container');
      if (threeCont) {
        threeCont.style.transition = 'opacity 0.6s';
        threeCont.style.opacity = '0';
      }
      this.time.delayedCall(650, () => {
        if (threeCont) threeCont.style.display = 'none';
        this.scene.start('MictlanHubScene');
      });
    });

    this.add.text(W - 10, H - 10, 'v0.1 PROTOTIPO', {
      fontFamily: 'Outfit', fontSize: '10px', color: '#444466',
    }).setOrigin(1, 1);

    this.cameras.main.fadeIn(800);
  }

  drawTijuana(x, y) { return; // Rutina 2D Obsoleta. Héroe migrado a modelo 3D.
    const g = this.add.graphics();

    // Sombra
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x, y + 115, 160, 30);

    // Cola (curva aproximada con segments)
    g.lineStyle(18, 0xff3fa4, 1);
    g.beginPath();
    g.moveTo(x - 30, y + 70);
    g.lineTo(x - 70, y + 90);
    g.lineTo(x - 110, y + 80);
    g.lineTo(x - 140, y + 50);
    g.lineTo(x - 150, y - 20);
    g.strokePath();
    g.lineStyle(6, 0x00e5ff, 1);
    g.beginPath();
    g.moveTo(x - 30, y + 70);
    g.lineTo(x - 70, y + 90);
    g.lineTo(x - 110, y + 80);
    g.lineTo(x - 140, y + 50);
    g.lineTo(x - 150, y - 20);
    g.strokePath();

    // Cuerpo
    g.fillStyle(0xff3fa4, 1);
    g.fillEllipse(x, y, 130, 160);
    g.fillStyle(0x00e5ff, 1);
    g.fillTriangle(x, y - 50, x - 28, y, x, y + 50);
    g.fillTriangle(x, y - 50, x + 28, y, x, y + 50);
    g.fillStyle(0xff8c00, 1);
    g.fillTriangle(x - 28, y, x, y - 30, x + 28, y);
    g.fillTriangle(x - 28, y, x, y + 30, x + 28, y);

    // Ala izquierda
    g.fillStyle(0xff3fa4, 0.9);
    g.fillTriangle(x - 65, y - 30, x - 130, y - 80, x - 50, y + 10);
    g.fillStyle(0x00e5ff, 0.7);
    g.fillTriangle(x - 65, y - 30, x - 120, y - 60, x - 55, y);
    g.lineStyle(4, 0xffd700, 1);
    g.beginPath(); g.arc(x - 130, y - 75, 10, 0, Math.PI * 1.5, false); g.strokePath();

    // Ala derecha
    g.fillStyle(0xff3fa4, 0.9);
    g.fillTriangle(x + 65, y - 30, x + 130, y - 80, x + 50, y + 10);
    g.fillStyle(0x00e5ff, 0.7);
    g.fillTriangle(x + 65, y - 30, x + 120, y - 60, x + 55, y);
    g.lineStyle(4, 0xffd700, 1);
    g.beginPath(); g.arc(x + 130, y - 75, 10, 0, Math.PI * 1.5, true); g.strokePath();

    // Cabeza
    g.fillStyle(0xf5a623, 1);
    g.fillEllipse(x, y - 90, 90, 80);
    g.fillStyle(0xe8941a, 1);
    g.fillEllipse(x, y - 90, 78, 68);

    // Cresta
    g.fillStyle(0xff3fa4, 1);
    for (let i = -2; i <= 2; i++) {
      g.fillTriangle(x + i * 12, y - 135, x + i * 12 - 6, y - 110, x + i * 12 + 6, y - 110);
    }

    // GoPro
    g.fillStyle(0x222222, 1); g.fillRect(x - 16, y - 148, 32, 22);
    g.fillStyle(0x111111, 1); g.fillCircle(x, y - 140, 7);
    g.fillStyle(0x334455, 1); g.fillCircle(x, y - 140, 5);

    // Lentes
    g.fillStyle(0x111111, 0.9);
    g.fillRoundedRect(x - 36, y - 100, 30, 18, 4);
    g.fillRoundedRect(x + 6, y - 100, 30, 18, 4);
    g.lineStyle(3, 0x8B6914, 1);
    g.strokeRoundedRect(x - 36, y - 100, 30, 18, 4);
    g.strokeRoundedRect(x + 6, y - 100, 30, 18, 4);
    g.lineStyle(3, 0x8B6914, 1);
    g.beginPath(); g.moveTo(x - 6, y - 91); g.lineTo(x + 6, y - 91); g.strokePath();

    // Sonrisa + lengua
    g.lineStyle(3, 0xcc7a00, 1);
    g.beginPath(); g.arc(x, y - 72, 18, 0.1, Math.PI - 0.1, false); g.strokePath();
    g.fillStyle(0xff4444, 1); g.fillEllipse(x, y - 56, 10, 16);

    // Riñonera
    g.fillStyle(0x8B6914, 1); g.fillRoundedRect(x - 35, y + 40, 70, 45, 8);
    g.fillStyle(0xA0781F, 1); g.fillRoundedRect(x - 30, y + 45, 60, 35, 6);
    g.fillStyle(0xffd700, 0.6); g.fillEllipse(x, y + 62, 28, 14);

    // Piernas y garras
    g.fillStyle(0xff3fa4, 1);
    g.fillRoundedRect(x - 45, y + 85, 30, 50, 8);
    g.fillRoundedRect(x + 15, y + 85, 30, 50, 8);
    g.fillStyle(0xffd700, 1);
    for (let i = 0; i < 3; i++) {
      g.fillTriangle(x - 42 + i * 12, y + 135, x - 38 + i * 12, y + 148, x - 34 + i * 12, y + 135);
      g.fillTriangle(x + 18 + i * 12, y + 135, x + 22 + i * 12, y + 148, x + 26 + i * 12, y + 135);
    }

    // Brazos
    g.fillStyle(0xff3fa4, 1);
    g.fillRoundedRect(x - 75, y - 10, 25, 60, 8);
    g.fillRoundedRect(x + 50, y - 10, 25, 60, 8);

    // Idle bob
    this.tweens.add({
      targets: g, y: '-=8', duration: 1800,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  drawPiedrasSlots(W, H) {
    const slotY = H * 0.75;
    const startX = W / 2 - 100;
    const step = 40;
    this.add.text(W / 2, slotY - 22, 'PIEDRAS DEL QUINTO SOL', {
      fontFamily: 'Outfit', fontSize: '11px', color: '#ffd700', letterSpacing: 2,
    }).setOrigin(0.5);
    const ganadas = window.GameState.piedras.length;
    for (let i = 0; i < 6; i++) {
      const sx = startX + i * step;
      const g = this.add.graphics();
      g.fillStyle(i < ganadas ? 0xffd700 : 0x1a1a3a, 1);
      g.fillCircle(sx, slotY, 14);
      g.lineStyle(2, 0x00e5ff, 0.7);
      g.strokeCircle(sx, slotY, 14);
      if (i < ganadas) {
        this.add.text(sx, slotY, '★', { fontSize: '14px', color: '#ffd700' }).setOrigin(0.5);
      }
    }
  }

  createFlowers(W, H) {
    const cols = [0xff8c00, 0xffd700, 0xff6600];
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(20, W - 20);
      const y = Phaser.Math.Between(H * 0.6, H);
      const sz = Phaser.Math.Between(4, 12);
      const g = this.add.graphics();
      g.fillStyle(cols[i % 3], Phaser.Math.FloatBetween(0.2, 0.7));
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * sz, y + Math.sin(a) * sz, sz * 0.7);
      }
      g.fillStyle(0xffdd00, 0.9); g.fillCircle(x, y, sz * 0.5);
      this.tweens.add({
        targets: g, y: `-=${Phaser.Math.Between(30, 80)}`, alpha: 0,
        duration: Phaser.Math.Between(3000, 7000), delay: Phaser.Math.Between(0, 4000),
        repeat: -1, onRepeat: () => { g.y = H + 20; g.alpha = 1; },
      });
    }
  }

  createPyramids(W, H) { return; // Eliminado por estética full 3D
    const g = this.add.graphics();
    g.fillStyle(0x0d0d25, 1);
    g.fillTriangle(W * 0.1, H * 0.75, W * 0.25, H * 0.45, W * 0.4, H * 0.75);
    g.fillTriangle(W * 0.6, H * 0.75, W * 0.7, H * 0.55, W * 0.85, H * 0.75);
    g.fillStyle(0x1a1a40, 1); g.fillCircle(W * 0.8, H * 0.12, 30);
    g.fillStyle(0x0a0a1a, 1); g.fillCircle(W * 0.83, H * 0.11, 26);
  }

  createSouls(W, H) {
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(30, W - 30);
      const y = Phaser.Math.Between(H * 0.4, H * 0.95);
      const g = this.add.graphics();
      g.fillStyle(0x00e5ff, Phaser.Math.FloatBetween(0.1, 0.4));
      g.fillCircle(0, 0, Phaser.Math.Between(2, 5));
      g.setPosition(x, y);
      this.tweens.add({
        targets: g, y: y - Phaser.Math.Between(40, 120),
        x: x + Phaser.Math.Between(-20, 20), alpha: 0,
        duration: Phaser.Math.Between(2000, 5000), delay: Phaser.Math.Between(0, 3000),
        repeat: -1, onRepeat: () => { g.setPosition(x, y); g.alpha = Phaser.Math.FloatBetween(0.1, 0.4); },
      });
    }
  }

  createBoton(x, y, texto, callback) {
    const btnContainer = this.add.container(x, y);
    
    // Glow exterior
    const glow = this.add.graphics();
    glow.fillStyle(0xff3fa4, 0.4);
    glow.fillRoundedRect(-110, -35, 220, 70, 35);
    btnContainer.add(glow);

    // Botón principal
    const btn = this.add.graphics();
    btn.fillGradientStyle(0xff3fa4, 0xff007f, 0xff69d4, 0xff0044, 1);
    btn.fillRoundedRect(-100, -25, 200, 50, 25);
    btn.lineStyle(3, 0xffffff, 0.9);
    btn.strokeRoundedRect(-100, -25, 200, 50, 25);
    btnContainer.add(btn);

    const txt = this.add.text(0, 0, texto, {
      fontFamily: 'Bebas Neue, sans-serif', fontSize: '28px', color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true }
    }).setOrigin(0.5);
    btnContainer.add(txt);

    // Hitbox interactivo
    const hitbox = this.add.rectangle(0, 0, 200, 50, 0x000000, 0).setInteractive();
    btnContainer.add(hitbox);

    hitbox.on('pointerover', () => { 
        this.tweens.add({ targets: btnContainer, scaleX: 1.1, scaleY: 1.1, duration: 200, ease: 'Back.easeOut' });
        glow.setAlpha(0.8);
    });
    hitbox.on('pointerout', () => { 
        this.tweens.add({ targets: btnContainer, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' });
        glow.setAlpha(0.4);
    });
    hitbox.on('pointerdown', callback);

    this.tweens.add({ targets: glow, alpha: 0.1, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ── LÓGICA DE THREE.JS ──
  initThreeJSBackground() {
    const container = document.getElementById('three-container');
    if (!container) return;
    container.style.display = 'block';
    container.style.opacity = '1';

    if (window.threeRenderer) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.02);

    // Ajustar el aspect ratio
    const rect = container.getBoundingClientRect();
    const camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 100);
    camera.position.set(0, 2, 12);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    window.threeRenderer = renderer;
    window.threeScene = scene;
    window.threeCamera = camera;

    // ── CAMARA 3D MOVIBLE (OrbitControls estilo Mario 64) ──
    const phaserCanvas = document.querySelector('#game-container canvas');
    if (phaserCanvas && typeof THREE.OrbitControls !== 'undefined') {
        const controls = new THREE.OrbitControls(camera, phaserCanvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 5;
        controls.maxDistance = 30;
        // Evitar que la cámara baje por debajo del "suelo"
        controls.maxPolarAngle = Math.PI / 2 + 0.1;
        window.threeControls = controls;
    }

    // ── LUCES (Mictlán Neon PBR) ──
    const ambientLight = new THREE.AmbientLight(0x404040, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xff3fa4, 1.5);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x00e5ff, 2.5, 50);
    pointLight.position.set(-5, -2, 5);
    scene.add(pointLight);

    // ── ENTORNO RETRO-NEON MICTLÁN ──
    const group = new THREE.Group();
    scene.add(group);
    window.threeAlebrijeGroup = group;

    // Grid Neón Estilo Retrowave
    const gridHelper = new THREE.GridHelper(200, 80, 0xff3fa4, 0x111122);
    gridHelper.position.y = -2;
    gridHelper.material.opacity = 0.4;
    gridHelper.material.transparent = true;
    group.add(gridHelper);
    window.threeGrid = gridHelper;

    // Disco Lunar al fondo
    const moonGeo = new THREE.CircleGeometry(25, 64);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(0, 15, -60);
    group.add(moon);

    // Astro-Partículas (Almas 3D) orbitando a la cámara
    const particlesGeo = new THREE.BufferGeometry();
    const particlesCount = 800;
    const posArray = new Float32Array(particlesCount * 3);
    for(let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 150;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const pMaterial = new THREE.PointsMaterial({ size: 0.4, color: 0xffd700, transparent: true, opacity: 0.8 });
    const particlesMesh = new THREE.Points(particlesGeo, pMaterial);
    group.add(particlesMesh);
    window.threeParticles = particlesMesh;

    window.addEventListener('resize', () => {
      if(window.threeCamera && window.threeRenderer && container) {
        const r = container.getBoundingClientRect();
        window.threeCamera.aspect = r.width / r.height;
        window.threeCamera.updateProjectionMatrix();
        window.threeRenderer.setSize(r.width, r.height);
      }
    });
  }

  update(time, delta) {
    if (window.threeRenderer && window.threeScene && window.threeCamera && window.threeAlebrijeGroup) {
      // Actualizar físicas de cámara tipo Mario 64
      if (window.threeControls) window.threeControls.update();

      // Animar Voxel Grid hacia adelante (Retrowave)
      if (window.threeGrid) {
          window.threeGrid.position.z = (time * 0.015) % (200 / 80); // Move loop
      }
      
      // Rotar Galaxia de partículas almas
      if (window.threeParticles) {
          window.threeParticles.rotation.y = time * 0.00005;
      }

      window.threeRenderer.render(window.threeScene, window.threeCamera);
    }
  }
}
