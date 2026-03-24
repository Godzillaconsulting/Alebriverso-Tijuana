// js/scenes/BossScene.js
class BossScene extends Phaser.Scene {
  constructor() { super({ key: 'BossScene' }); }
  init(data) {
    this.epocaId = data.epocaId || 1;
    this.epocaData = window.EpochData[this.epocaId];
    this.vida = window.GameState.vida || 3;
    this.bossHp = 10;
    this.maxBossHp = 10;
    this.bossState = 'chase';
    this.stateTimer = 0;
    this.bossPhase = 1;
    this.proyectiles3D = [];
  }

  create() {
    const W = this.scale.width; const H = this.scale.height;
    if(window.Jukebox) window.Jukebox.playTrack('boss', this.epocaId);
    this.cameras.main.fadeIn(500);

    this.scene.launch('UIScene');
    this.scene.get('UIScene').updateEpoca(`🔴 BOSS: ${this.epocaData.boss.nombre.toUpperCase()}`);
    this.scene.get('UIScene').updateVida(this.vida, window.GameState.vidaMax || 3);
    
    this.bossHpBarBg = this.add.rectangle(W/2, 80, 200, 15, 0x222222).setOrigin(0.5).setStrokeStyle(2, 0xff3fa4);
    this.bossHpBar = this.add.rectangle(W/2 - 100, 80, 200, 15, 0xff3fa4).setOrigin(0, 0.5);
    this.add.text(W/2, 65, this.epocaData.boss.nombre.toUpperCase(), { fontFamily: 'Bebas Neue', fontSize: '18px', color: '#ff8c00', shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true } }).setOrigin(0.5);

    const threeContainer = document.getElementById('three-container');
    threeContainer.innerHTML = '';
    
    this.threeScene = new THREE.Scene();
    const cols = this.epocaData.colores;
    this.threeScene.background = new THREE.Color(0x050010); // Void Arena
    this.threeScene.fog = new THREE.FogExp2(0x050010, 0.05);
    
    this.threeCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    threeContainer.appendChild(this.renderer.domElement);

    this.threeScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dl = new THREE.DirectionalLight(0xff3fa4, 1.5);
    dl.position.set(10, 20, 10); this.threeScene.add(dl);
    const pl = new THREE.PointLight(0x00e5ff, 2.0, 50);
    pl.position.set(-10, 5, -10); this.threeScene.add(pl);

    this.environmentMeshes = [];
    const arenaMat = new THREE.MeshStandardMaterial({color: cols.platBot, roughness: 0.9});
    const arenaMesh = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 2, 32), arenaMat);
    arenaMesh.position.y = -1;
    this.threeScene.add(arenaMesh);
    this.environmentMeshes.push(arenaMesh);

    // Muros invisibles (Ring of death)
    this.arenaRadius = 18;

    this.alebrije = new AlebrijeController(this.threeScene, this.threeCamera);
    this.alebrije.setEnvironment(this.environmentMeshes);
    this.alebrije.playerGroup.position.set(0, 2, 10);

    this.enemyManager = new EnemyManager(this.threeScene, this.environmentMeshes);
    // Empleamos al jefe Huitzilopochtli por defecto si no hay asset
    let bossAsset = this.epocaId === 1 ? 'huitzilopochtli' : 'huitzilopochtli';
    this.bossEnemy = this.enemyManager.createEnemy(bossAsset, new THREE.Vector3(0, 0, -10));
    
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ W: 87, A: 65, S: 83, D: 68 });
    this._createMobileControls(W, H);

    this.resizeListener = () => {
      this.threeCamera.aspect = window.innerWidth / window.innerHeight;
      this.threeCamera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.resizeListener);
  }

  update(time, delta) {
    if (!this.alebrije) return;

    let x = 0, y = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) x = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) x = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) y = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) y = 1;
    if (this.mobileDir && (this.mobileDir.x !== 0 || this.mobileDir.y !== 0)) { x = this.mobileDir.x; y = this.mobileDir.y; }

    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.space) || this.mobileJump;
    if (this.mobileJump) this.mobileJump = false;

    this.alebrije.setInput(x, y, jump);
    this.alebrije.update(delta / 1000);

    if (this.alebrije.playerGroup.position.length() > this.arenaRadius && this.alebrije.playerGroup.position.y > 0) {
        // Redirigir hacia adentro preventivamente
        this.alebrije.playerGroup.position.sub(this.alebrije.velocity.clone().multiplyScalar(delta/500));
    }

    if (this.enemyManager) this.enemyManager.update(this.threeCamera);

    if (this.bossState !== 'dead') {
       this._updateBossFSM(delta, time);
       this._checkCollisions();
    }

    for(let i=this.proyectiles3D.length-1; i>=0; i--) {
        let p = this.proyectiles3D[i];
        p.position.add(p.userData.velocity.clone().multiplyScalar(delta/1000));
        p.rotation.x += 0.1; p.rotation.y += 0.2;
        if(p.position.length() > 40) { this.threeScene.remove(p); this.proyectiles3D.splice(i, 1); continue; }
        
        if (this.alebrije.playerGroup.position.distanceTo(p.position) < 2.5) {
            this.threeScene.remove(p); this.proyectiles3D.splice(i, 1);
            this._takeDamage();
        }
    }

    this.renderer.render(this.threeScene, this.threeCamera);

    if (this.alebrije.playerGroup.position.y < -5) {
       this.alebrije.playerGroup.position.set(0, 5, 10); this._takeDamage();
    }
  }

  _updateBossFSM(delta, time) {
    this.stateTimer += delta;
    const playerPos = this.alebrije.playerGroup.position;
    const bossObj = this.bossEnemy.sprite;
    const bossHbox = this.bossEnemy.hitbox;
    
    const distTarget = new THREE.Vector3().subVectors(playerPos, bossObj.position);
    distTarget.y = 0; 
    const dist = distTarget.length();

    // -- Sensor Cilíndrico de "Raycast Vertical" (Pisotón) --
    if ((this.bossState === 'chase' || this.bossState === 'idle') && this.stateTimer > 500) {
        if (Math.abs(playerPos.x - bossObj.position.x) < 3.0 && Math.abs(playerPos.z - bossObj.position.z) < 3.0 && playerPos.y < bossObj.position.y) {
            this.bossState = 'dive_bomb';
            this.stateTimer = 0;
            this.bossEnemy.sprite.material.emissive.setHex(0xff0000); // Furia Neón
        }
    }

    switch(this.bossState) {
        case 'idle':
            if (this.stateTimer > 1500) { this.bossState = 'chase'; this.stateTimer = 0; }
            break;
        case 'chase':
            if (dist > 0.1 && dist < 30) {
                const dir = distTarget.normalize();
                const speed = 4.0 + (this.bossPhase * 1.5);
                bossObj.position.add(dir.multiplyScalar(speed * (delta/1000)));
                bossHbox.position.set(bossObj.position.x, bossHbox.position.y, bossObj.position.z);
            }
            if (dist < 15.0 && this.stateTimer > 2500) { this.bossState = 'windup'; this.stateTimer = 0; }
            break;
        case 'windup':
            bossObj.position.y = (bossHbox.position.y - bossHbox.geometry.parameters.height/2) + Math.sin(time*0.05)*0.5;
            if (this.stateTimer > 800) { 
                bossObj.position.y = bossHbox.position.y - bossHbox.geometry.parameters.height/2;
                this._executeAttack(playerPos); this.bossState = 'attack_recovery'; this.stateTimer = 0; 
            }
            break;
        case 'attack_recovery':
            if (this.stateTimer > 1000) { this.bossState = 'idle'; this.stateTimer = 0; }
            break;
        case 'dive_bomb':
            bossObj.position.y += 0.05; // Congelado momentáneo simulando recarga inercial vertical
            if (this.stateTimer > 600) {
                 bossObj.position.y -= (delta/1000) * 120; // Caída hiper rápida
                 if (bossObj.position.y <= 0) {
                     bossObj.position.y = 0; this.bossState = 'dive_recovery'; this.stateTimer = 0;
                     this._triggerShockwave();
                 }
            }
            bossHbox.position.set(bossObj.position.x, bossHbox.position.y, bossObj.position.z);
            break;
        case 'dive_recovery':
             if (this.stateTimer > 1500) {
                 this.bossState = 'chase'; this.stateTimer = 0;
                 this.bossEnemy.sprite.material.emissive.setHex(0x00ffff); // Vuelve a turquesa natural
                 bossObj.position.y = bossHbox.position.y;
             }
             break;
        case 'dizzy':
        case 'hurt':
            break;
    }
  }

  _executeAttack(playerPos) {
      const pMat = new THREE.MeshBasicMaterial({color: 0x00e5ff, wireframe:true});
      const pMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), pMat);
      pMesh.position.copy(this.bossEnemy.sprite.position);
      
      // -- SM64 AI: Input Predictivo Perceptual --
      // En vez de disparar a donde TÚ ESTÁS, el Jefe multiplica tu vector de velocidad por el tiempo estimado del recorrido.
      const playerVel = this.alebrije.velocity.clone();
      playerVel.y = 0; 
      const tiempoVuelo = pMesh.position.distanceTo(playerPos) / (15.0 + (this.bossPhase * 5));
      const targetPredictivo = playerPos.clone().add(playerVel.multiplyScalar(tiempoVuelo));
      
      const dir = new THREE.Vector3().subVectors(targetPredictivo, pMesh.position).normalize();
      const projSpeed = 15.0 + (this.bossPhase * 5);
      pMesh.userData.velocity = dir.multiplyScalar(projSpeed);
      this.threeScene.add(pMesh);
      this.proyectiles3D.push(pMesh);
      if (window.Jukebox) window.Jukebox.sfxProjectile(); // 🔊 SFX proyectil
  }

  _triggerShockwave() {
      this.cameras.main.shake(300, 0.03); 
      const dist = this.alebrije.playerGroup.position.distanceTo(this.bossEnemy.sprite.position);
      
      // Si recibes la onda del choque mientras estás en el piso -> Daño Crítico + Knockback
      if (dist < 6.0 && this.alebrije.playerGroup.position.y < 3.0) { 
          this._takeDamage();
          const knockDir = new THREE.Vector3().subVectors(this.alebrije.playerGroup.position, this.bossEnemy.sprite.position).normalize();
          this.alebrije.velocity.copy(knockDir.multiplyScalar(35));
          this.alebrije.velocity.y = 20; // Lanzado por el aire
      }
      
      // Partícula de la onda tipo Zelda Ocarina of Time
      const ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.5, 32), new THREE.MeshBasicMaterial({color: 0xff0000, side: THREE.DoubleSide, transparent: true}));
      ring.rotation.x = -Math.PI/2;
      ring.position.copy(this.bossEnemy.sprite.position);
      ring.position.y = 0.2;
      this.threeScene.add(ring);
      this.tweens.add({
          targets: ring.scale, x: 6, y: 6, duration: 600,
          onUpdate: () => ring.material.opacity -= 0.05,
          onComplete: () => this.threeScene.remove(ring)
      });
  }

  _checkCollisions() {
      const dist = this.alebrije.playerGroup.position.distanceTo(this.bossEnemy.sprite.position);
      // Validar golpe (Jump On Top o ATK)
      if (dist < 4.5 && this.isAttacking && this.bossState !== 'hurt') {
          this.bossState = 'hurt';
          this.bossHp -= 1.0;
          this.tweens.add({ targets: this.bossHpBar, width: 200 * (this.bossHp/this.maxBossHp), duration: 200 });
          this.bossEnemy.sprite.material.emissiveIntensity = 5.0; 
          if (window.Jukebox) window.Jukebox.sfxBossHit(); // 🔊 SFX golpe boss
          this.time.delayedCall(200, () => { if(this.bossEnemy) this.bossEnemy.sprite.material.emissiveIntensity = 0.8; });
          
          this.alebrije.velocity.set(0, 15, 15);
          
          if (this.bossHp <= 0) {
             this._bossDefeated();
          } else {
             if (this.bossHp < 5) this.bossPhase = 2; // Enfurecido
             this.time.delayedCall(800, () => { if(this.bossState !== 'dead') { this.bossState = 'chase'; this.stateTimer = 0; }});
          }
      } else if (dist < 3.0 && !this.isAttacking && this.bossState !== 'hurt' && this.bossState !== 'dizzy') {
          this._takeDamage();
          const knockDir = new THREE.Vector3().subVectors(this.alebrije.playerGroup.position, this.bossEnemy.sprite.position).normalize();
          this.alebrije.velocity.copy(knockDir.multiplyScalar(20));
          this.alebrije.velocity.y = 10;
      }
  }

  _takeDamage() {
      this.vida--; window.GameState.vida = this.vida;
      this.scene.get('UIScene')?.updateVida(this.vida, window.GameState.vidaMax || 3);
      this.cameras.main.shake(200, 0.015);
      if (window.Jukebox) window.Jukebox.sfxDamage(); // 🔊 SFX daño
      if (this.vida <= 0) {
          this.scene.pause(); this.cameras.main.fadeOut(600, 0, 0, 0);
          this.time.delayedCall(700, () => { window.GameState.vida = window.GameState.vidaMax || 3; this.scene.restart(); });
      }
  }

  _bossDefeated() {
    this.bossState = 'dead';
    this.tweens.killTweensOf(this.bossHpBar);
    this.bossEnemy.sprite.position.y = 0.5;
    this.bossEnemy.sprite.scale.set(this.bossEnemy.sprite.scale.x, 0.2, this.bossEnemy.sprite.scale.z);
    if (window.Jukebox) { window.Jukebox.stop(); window.Jukebox.sfxVictory(); } // 🔊 Fanfarria victoria
    this.time.delayedCall(1500, () => this._showSelfieQTE());
  }

  _showSelfieQTE() {
    const W = this.scale.width; const H = this.scale.height;
    const overlay = this.add.rectangle(W/2, H/2, W * 2, H * 2, 0x000000, 0.8).setScrollFactor(0);
    const dialog = this.add.text(W/2, H - 150, '"Sonríe pal pajarito cósmico."', { fontFamily: 'Outfit', fontSize: '20px', color: '#00e5ff', backgroundColor: '#1a1a3a', padding: { x: 15, y: 10 } }).setOrigin(0.5).setScrollFactor(0);
    this.time.delayedCall(2000, () => {
      const flash = this.add.rectangle(W/2, H/2, W, H, 0xffffff, 1).setScrollFactor(0);
      this.cameras.main.shake(100, 0.01);
      if (window.Jukebox) window.Jukebox.sfxSelfie(); // 🔊 Clic de cámara
      this.time.delayedCall(100, () => {
        flash.setAlpha(0); dialog.destroy();
        this.add.text(W/2, H/2, `¡PIEDRA DE ${this.epocaData.piedra.toUpperCase()} GANADA!`, { fontFamily: 'Bebas Neue', fontSize: '42px', color: '#ffd700', shadow: { offsetX: 0, offsetY: 4, color: '#ff3fa4', blur: 10, fill: true } }).setOrigin(0.5);
        this.input.once('pointerdown', () => {
          if (!window.GameState.piedras.includes(this.epocaData.piedra)) window.GameState.piedras.push(this.epocaData.piedra);
          if (!window.GameState.epocasDesbloqueadas.includes(this.epocaId + 1)) window.GameState.epocasDesbloqueadas.push(this.epocaId + 1);
          window.GameState.tonalli += 100;
          this.scene.stop('UIScene'); this.scene.start('MictlanHubScene');
        });
      });
    });
  }

  _createMobileControls(W, H) {
    this.mobileDir = { x: 0, y: 0 }; this.mobileJump = false; this.isAttacking = false;
    const sB = this.add.circle(80, H - 80, 50, 0xffffff, 0.1).setScrollFactor(0).setInteractive();
    const sH = this.add.circle(80, H - 80, 20, 0xffffff, 0.4).setScrollFactor(0);
    const updateStick = (p) => {
        const dx = p.x - sB.x; const dy = p.y - sB.y;
        const dist = Math.sqrt(dx*dx + dy*dy); const maxDist = 30;
        if (dist <= maxDist) { sH.setPosition(p.x, p.y); this.mobileDir.x = dx/maxDist; this.mobileDir.y = dy/maxDist; }
        else { const a = Math.atan2(dy, dx); sH.setPosition(sB.x + Math.cos(a)*maxDist, sB.y + Math.sin(a)*maxDist); this.mobileDir.x = Math.cos(a); this.mobileDir.y = Math.sin(a); }
    };
    sB.on('pointerdown', updateStick); sB.on('pointermove', (p) => { if(p.isDown) updateStick(p); });
    const rs = () => { sH.setPosition(80, H - 80); this.mobileDir.x = 0; this.mobileDir.y = 0; };
    sB.on('pointerup', rs); sB.on('pointerout', rs);

    const btnA = this.add.circle(W - 80, H - 50, 30, 0xff3fa4, 0.4).setInteractive().setStrokeStyle(2, 0xff3fa4);
    this.add.text(W - 80, H - 50, 'JUMP', { fontFamily: 'Outfit', fontSize: '12px', color: '#fff', shadow:{blur:2, color:'#000', fill:true} }).setOrigin(0.5);
    btnA.on('pointerdown', () => this.mobileJump = true); btnA.on('pointerup', () => this.mobileJump = false); btnA.on('pointerout', () => this.mobileJump = false);

    const btnB = this.add.circle(W - 140, H - 80, 30, 0xffd700, 0.4).setInteractive().setStrokeStyle(2, 0xffd700);
    this.add.text(W - 140, H - 80, 'ATK', { fontFamily: 'Outfit', fontSize: '12px', color: '#fff', shadow:{blur:2, color:'#000', fill:true} }).setOrigin(0.5);
    btnB.on('pointerdown', () => { this.isAttacking = true; this.cameras.main.shake(100, 0.005); }); btnB.on('pointerup', () => this.time.delayedCall(200, () => this.isAttacking = false));
  }

  shutdown() {
    if (this.renderer) { this.renderer.dispose(); document.getElementById('three-container').innerHTML = ''; }
    window.removeEventListener('resize', this.resizeListener);
  }
}
