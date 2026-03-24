class LevelScene extends Phaser.Scene {
  constructor() { super({ key: 'LevelScene' }); }
  init(data) {
    this.epocaId = data.epocaId || 1;
    this.epocaData = window.EpochData[this.epocaId];
    this.vida = window.GameState.vida || 3;
    this.cacaos3D = [];
  }
  create() {
    const W = this.scale.width; const H = this.scale.height;
    this.cameras.main.fadeIn(600);

    // 🎵 Música por época (Web Audio API procedural)
    if (window.Jukebox) window.Jukebox.playTrack('level_base', this.epocaId);

    this.scene.launch('UIScene');
    this.scene.get('UIScene').updateVida(this.vida, window.GameState.vidaMax || 3);
    this.scene.get('UIScene').updateEpoca(this.epocaData.nombre);

    const threeCont = document.getElementById('three-container');
    threeCont.innerHTML = '';
    threeCont.style.display = 'block'; threeCont.style.opacity = '1';

    this.threeScene = new THREE.Scene();
    const cols = this.epocaData.colores;
    this.threeScene.background = new THREE.Color(cols.cieloTop);
    this.threeScene.fog = new THREE.Fog(cols.cieloBot, 15, 80);

    this.threeCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    threeCont.appendChild(this.renderer.domElement);

    this.threeScene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirL = new THREE.DirectionalLight(0xffffff, 0.8);
    dirL.position.set(20, 30, -10); dirL.castShadow = true;
    this.threeScene.add(dirL);

    this.envMeshes = [];
    const platMat = new THREE.MeshStandardMaterial({ color: cols.platTop, roughness: 0.8 });

    // ── FOLLAJE INSTANCIADO (Pasto Neón y Cempasúchil) ──
    const grassGeo = new THREE.PlaneGeometry(1, 1);
    grassGeo.translate(0, 0.5, 0);
    const grassMat = new THREE.MeshBasicMaterial({color: 0x1a3a1a, side: THREE.DoubleSide, transparent: true, opacity: 0.9});
    this.grassInst = new THREE.InstancedMesh(grassGeo, grassMat, 3000);
    
    // Shader custom para Vertex Animation (Viento)
    grassMat.onBeforeCompile = (shader) => {
        shader.uniforms.time = { value: 0 };
        shader.vertexShader = `uniform float time;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
             // Oscilación basada en UV Y (solo la punta del pasto se mueve)
             float wave = sin(position.x * 5.0 + time * 3.0) * 0.2 * position.y;
             transformed.x += wave;
             transformed.z += wave;`
        );
        this.grassShader = shader;
    };
    this.threeScene.add(this.grassInst);

    // Cempasúchil (Partículas Low Poly)
    const florGeo = new THREE.ConeGeometry(0.3, 0.4, 5);
    const florMat = new THREE.MeshBasicMaterial({color: 0xff8c00});
    this.florInst = new THREE.InstancedMesh(florGeo, florMat, 800);
    this.threeScene.add(this.florInst);

    let gIdx = 0; let fIdx = 0;
    const dummy = new THREE.Object3D();
    
    let curZ = 0;
    for(let i=0; i<15; i++) {
        const w = Phaser.Math.Between(8, 14);
        const pMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2, 8), platMat);
        pMesh.position.set(Math.sin(i)*3, Phaser.Math.Between(-1, 1), curZ);
        pMesh.receiveShadow = true; pMesh.castShadow = true;
        this.threeScene.add(pMesh); this.envMeshes.push(pMesh);
        
        // Esparcir Pasto Neón X-Billboards (2 cruces)
        for(let g=0; g<120; g++) {
            if(gIdx >= 3000) break;
            const gx = pMesh.position.x + Phaser.Math.FloatBetween(-w/2, w/2);
            const gz = pMesh.position.z + Phaser.Math.FloatBetween(-4, 4);
            const sy = Phaser.Math.FloatBetween(0.8, 1.8);
            dummy.position.set(gx, pMesh.position.y + 1, gz);
            dummy.rotation.set(0, Math.random() * Math.PI, 0); dummy.scale.set(1, sy, 1); dummy.updateMatrix(); this.grassInst.setMatrixAt(gIdx++, dummy.matrix);
            dummy.rotation.set(0, dummy.rotation.y + Math.PI/2, 0); dummy.updateMatrix(); this.grassInst.setMatrixAt(gIdx++, dummy.matrix);
        }

        // Esparcir Cempasúchil
        for(let f=0; f<10; f++) {
            if(fIdx >= 800) break;
            dummy.position.set(pMesh.position.x + Phaser.Math.FloatBetween(-w/2, w/2), pMesh.position.y + 1.2, pMesh.position.z + Phaser.Math.FloatBetween(-4, 4));
            dummy.rotation.set(Math.random(), Math.random(), Math.random()); dummy.scale.set(1,1,1); dummy.updateMatrix();
            this.florInst.setMatrixAt(fIdx++, dummy.matrix);
        }
        
        if (Math.random() > 0.3) {
            const cacao = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshStandardMaterial({color: 0xD2691E, emissive: 0x8B4513}));
            cacao.position.set(pMesh.position.x, pMesh.position.y + 2, curZ);
            this.threeScene.add(cacao); this.cacaos3D.push(cacao);
        }
        curZ -= Phaser.Math.Between(10, 15);
    }

    this.bossZoneZ = curZ;
    const portal = new THREE.Mesh(new THREE.TorusGeometry(3, 0.5, 16, 100), new THREE.MeshBasicMaterial({color: 0xffd700, wireframe:true}));
    portal.position.set(0, 3, this.bossZoneZ);
    this.threeScene.add(portal);

    this.alebrije = new AlebrijeController(this.threeScene, this.threeCamera);
    this.alebrije.setEnvironment(this.envMeshes);
    this.alebrije.playerGroup.position.set(0, 5, 0);

    this.EnemyMan = new EnemyManager(this.threeScene, this.envMeshes);
    if (this.epocaId === 1) {
        this.EnemyMan.createEnemy('aldeano_azteca', new THREE.Vector3(1, 0, -2)); // NPC 
        const enemyList = ['serpiente_piedra', 'jaguar_obsidiana', 'guerrero_aguila'];
        for(let i=0; i<6; i++) {
            const tipo = enemyList[i % 3];
            const px = Phaser.Math.Between(-3, 3);
            const pz = Phaser.Math.Between(-15, this.bossZoneZ + 15);
            const py = tipo === 'guerrero_aguila' ? 4 : 0; 
            this.EnemyMan.createEnemy(tipo, new THREE.Vector3(px, py, pz));
        }
    } else {
        let sprDef = 'jaguar_obsidiana';
        for(let i=0; i<5; i++) this.EnemyMan.createEnemy(sprDef, new THREE.Vector3(Phaser.Math.Between(-3,3), 0, Phaser.Math.Between(-20, this.bossZoneZ + 20)));
    }

    // -- SHADOW TIJUANA (Cosmic Clone SM64 NEAT AI Mode) --
    // Un clon espectral que repite tus inputs tras 1.1s de retraso
    this.shadowClone = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.55, 1.1, 4, 8),
        new THREE.MeshStandardMaterial({color: 0xff0000, wireframe: true, emissive: 0xff0000, emissiveIntensity: 2.0, transparent: true, opacity: 0.8})
    );
    this.shadowClone.position.set(0, 10, 10);
    this.threeScene.add(this.shadowClone);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ W: 87, A: 65, S: 83, D: 68 });
    this._makeMobile(W, H);

    this.rez = () => {
      this.threeCamera.aspect = window.innerWidth / window.innerHeight;
      this.threeCamera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.rez);
  }

  update(time, delta) {
    if (!this.alebrije) return;
    let x = 0, y = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) x = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) x = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) y = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) y = 1;
    if (this.mDir && (this.mDir.x !== 0 || this.mDir.y !== 0)) { x = this.mDir.x; y = this.mDir.y; }

    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.space) || this.mobileJump;
    if (this.mobileJump) this.mobileJump = false;
    const action = this.mobileAttack;

    // 🔊 SFX Salto
    if (jump && window.Jukebox) window.Jukebox.sfxJump();

    this.alebrije.setInput(x, y, jump, action);
    this.alebrije.update(delta / 1000);
    
    if (this.EnemyMan) {
        this.EnemyMan.update(this.threeCamera, this.alebrije.playerGroup.position, delta/1000, time);
        
        // ── SM64 COMBAT ENGINE: Melee Collision ──
        if (this.alebrije.currentHitbox) {
            const hMesh = this.alebrije.currentHitbox.mesh;
            const hRad = this.alebrije.currentHitbox.radius;
            for(let en of this.EnemyMan.enemies) {
                if (en.state !== 'DEAD' && en.sprite.position.distanceTo(hMesh.position) < hRad + 2.0) {
                    en.state = 'DEAD';
                    this.threeScene.remove(en.sprite);
                    if(en.gltfModel) this.threeScene.remove(en.gltfModel);
                    if(en.hitbox) {
                        this.threeScene.remove(en.hitbox);
                        const idx = this.envMeshes.indexOf(en.hitbox);
                        if (idx > -1) this.envMeshes.splice(idx, 1);
                    }
                    
                    // FX / Feedback
                    window.GameState.cacao = (window.GameState.cacao || 0) + 15;
                    this.scene.get('UIScene')?.updateCacao(window.GameState.cacao);
                    this.cameras.main.shake(150, 0.015);
                    if (window.Jukebox) window.Jukebox.sfxAttack(); // 🔊 SFX golpe
                    this.alebrije._spawnDustParticles(en.sprite.position, 8);
                }
            }
        }
    // Validar Colisión Euclidiana (Interacción Jugador-Enemigo SM64)
        for (let i = this.EnemyMan.enemies.length - 1; i >= 0; i--) {
            const en = this.EnemyMan.enemies[i];
            if (en.type === 'aldeano_azteca') continue;
            
            if (en.sprite.position.distanceTo(this.alebrije.playerGroup.position) < 2.2) {
                if (this.alebrije.isAttacking) {
                     // Tijuana golpea al enemigo (Pisotón o Giro)
                     this.cameras.main.shake(100, 0.01);
                     
                     // Efecto de explosión del enemigo
                     const pGeo = new THREE.DodecahedronGeometry(1.5);
                     const pMat = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true});
                     const pop = new THREE.Mesh(pGeo, pMat);
                     pop.position.copy(en.sprite.position);
                     this.threeScene.add(pop);
                     
                     this.scene.scene.tweens.add({
                         targets: pop.scale, x: 3, y: 3, z: 3, duration: 300,
                         onUpdate: () => pop.material.opacity-=0.1,
                         onComplete: () => this.threeScene.remove(pop)
                     });

                     this.threeScene.remove(en.sprite);
                     if(en.hitbox) this.threeScene.remove(en.hitbox);
                     this.EnemyMan.enemies.splice(i, 1);
                     window.GameState.cacao += 10;
                     this.scene.get('UIScene')?.updateCacao(window.GameState.cacao);
                     if (window.Jukebox) window.Jukebox.sfxAttack(); // 🔊 SFX golpe
                     
                     // Pequeño rebotillo a lo Mario al pisar
                     if (this.alebrije.state === 'GROUND_POUND_DROP') this.alebrije.velocity.y = 15;
                } else {
                     // Recibir Daño
                     if (Date.now() - (this.lastHitTime || 0) > 1000) {
                          this.lastHitTime = Date.now();
                          this._dmg();
                          // Knockback Radial
                          const kb = this.alebrije.playerGroup.position.clone().sub(en.sprite.position).normalize().multiplyScalar(15);
                          kb.y = 8;
                          this.alebrije.velocity.copy(kb);
                     }
                }
            }
        }
    }

    for(let i = this.cacaos3D.length - 1; i >= 0; i--) {
        let c = this.cacaos3D[i]; c.rotation.y += 0.05; c.position.y += Math.sin(time*0.005)*0.01;
        if(this.alebrije.playerGroup.position.distanceTo(c.position) < 2.0) {
            this.threeScene.remove(c); this.cacaos3D.splice(i, 1);
            window.GameState.cacao += 5; this.scene.get('UIScene')?.updateCacao(window.GameState.cacao);
            if (window.Jukebox) window.Jukebox.sfxCollect(); // 🔊 SFX colección
        }
    }

    if (this.grassShader) this.grassShader.uniforms.time.value = time * 0.001;

    // -- SHADOW TIJUANA UPDATE (Persigue tu historial exacto) --
    if (this.alebrije.positionHistory && this.alebrije.positionHistory.length >= 70) {
        const past = this.alebrije.positionHistory[0];
        
        // Evitar teletransportes bruscos usando lerp
        this.shadowClone.position.lerp(past.pos, 0.5);
        this.shadowClone.rotation.y = past.rot;
        this.shadowClone.scale.copy(past.scale);
        
        // Daño de Paradoja (Si tocas tu propia sombra te castiga)
        if (this.alebrije.playerGroup.position.distanceTo(this.shadowClone.position) < 1.2 && !this.alebrije.isAttacking) {
             if (Date.now() - (this.lastHitTime || 0) > 1000) {
                  this.lastHitTime = Date.now();
                  this._dmg();
                  // Lanzado violentamente por la anomalía temporal
                  this.alebrije.velocity.set(0, 20, 15); 
                  this.cameras.main.shake(200, 0.02);
             }
        }
    }

    this.renderer.render(this.threeScene, this.threeCamera);

    if (this.alebrije.playerGroup.position.y < -10) this._dmg();
    if (this.alebrije.playerGroup.position.z < this.bossZoneZ + 2) {
      this.scene.stop('UIScene'); this.cameras.main.fadeOut(600, 0, 0, 0);
      this.alebrije = null; 
      this.time.delayedCall(650, () => this.scene.start('BossScene', { epocaId: this.epocaId }));
    }
  }

  _dmg() {
    window.GameState.vida -= 1;
    this.scene.get('UIScene')?.updateVida(window.GameState.vida, window.GameState.vidaMax || 3);
    this.cameras.main.shake(200, 0.015);
    if (window.Jukebox) window.Jukebox.sfxDamage(); // 🔊 SFX daño
    this.alebrije.playerGroup.position.set(0, 5, 0); this.alebrije.velocity.set(0, 0, 0);
    if (window.GameState.vida <= 0) {
      this.scene.pause(); this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(700, () => { window.GameState.vida = window.GameState.vidaMax || 3; this.scene.restart(); });
    }
  }

  _makeMobile(W, H) {
    this.mDir = { x: 0, y: 0 }; this.mobileJump = false;
    const ja = this.add.circle(W - 80, H - 80, 40, 0xff3fa4, 0.4).setScrollFactor(0).setInteractive();
    this.add.text(W - 80, H - 80, 'JUMP', { fontFamily: 'Outfit', color: '#fff' }).setOrigin(0.5).setScrollFactor(0);
    ja.on('pointerdown', () => this.mobileJump = true);

    // Attack/Action Button (Para Combate y Físicas SM64)
    const atk = this.add.circle(W - 200, H - 60, 35, 0xffd700, 0.3).setScrollFactor(0).setInteractive().setStrokeStyle(2, 0xffd700);
    this.add.text(W - 200, H - 60, 'ATK / Z', {fontFamily:'Bebas Neue', fontSize:'20px', color:'#fff'}).setOrigin(0.5).setScrollFactor(0);
    atk.on('pointerdown', ()=>{ 
        this.mobileAttack = true;
        // Lógica futura de combate cuerpo a cuerpo 3D
        if(window.game3D && window.game3D.enemyManager) {
            // Ejemplo: if close to enemy, hit
        }
    }); 
    atk.on('pointerup', ()=>{ this.mobileAttack = false; });
    atk.on('pointerout', ()=>{ this.mobileAttack = false; });
  }

  shutdown() {
    if (this.renderer) { this.renderer.dispose(); document.getElementById('three-container').innerHTML = ''; }
    window.removeEventListener('resize', this.rez);
  }
}
