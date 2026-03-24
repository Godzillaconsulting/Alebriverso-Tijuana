// js/engine/EnemyManager.js
// Sincronización de AGENTE_OPTIMIZADOR y AGENTE_ESCENA
// Genera Billboards 2D con hitboxes invisibles 3D y materiales emisivos

class EnemyManager {
    constructor(scene, environmentMeshes) {
        this.scene = scene;
        this.environmentMeshes = environmentMeshes; // Para inyectar los hitboxes de colisión
        this.enemies = []; // Guarda las referencias para actualizarlos en el update()
        
        this.textureLoader = new THREE.TextureLoader();
    }

    createEnemy(type, position) {
        let config = {};
        
        switch (type) {
            case 'serpiente_piedra':
                config = {
                    texture: 'assets/sprites/serpiente.png',
                    scale: new THREE.Vector3(2, 2, 2), // Escala teórica UE5 1.0 (ajustada a la escena)
                    hitboxSize: new THREE.Vector3(1, 2, 1), // Capsule (aproximado a Cajas / Cilindros en Three)
                    hitboxType: 'capsule',
                    emissiveColor: 0x00ff00, // Neon Green
                    emissiveIntensity: 0.8
                };
                break;
            case 'jaguar_obsidiana':
                config = {
                    texture: 'assets/sprites/jaguar.png',
                    scale: new THREE.Vector3(2.4, 2.4, 2.4),
                    hitboxSize: new THREE.Vector3(1.5, 1.5, 2), // Box
                    hitboxType: 'box',
                    emissiveColor: 0xff8800, // Neon Orange
                    emissiveIntensity: 0.8
                };
                break;
            case 'huitzilopochtli':
                config = {
                    texture: 'assets/sprites/huitzilopochtli.png',
                    scale: new THREE.Vector3(7, 7, 7), // Jefe gigante
                    hitboxSize: new THREE.Vector3(3, 7, 3), // Capsule grande
                    hitboxType: 'capsule',
                    emissiveColor: 0x00ffff, // Turquoise Neon sword
                    emissiveIntensity: 1.2
                };
                break;
            case 'guerrero_aguila':
                config = {
                    texture: 'assets/sprites/guerrero_aguila.png',
                    scale: new THREE.Vector3(2.5, 2.5, 2.5),
                    hitboxSize: new THREE.Vector3(1.2, 2.5, 1.2),
                    hitboxType: 'capsule',
                    emissiveColor: 0xffff00, // Neon Yellow Emissive
                    emissiveIntensity: 0.9
                };
                break;
            case 'aldeano_azteca':
                config = {
                    texture: 'assets/sprites/aldeano_azteca.png',
                    scale: new THREE.Vector3(2.0, 2.0, 2.0),
                    hitboxSize: new THREE.Vector3(1, 2.0, 1),
                    hitboxType: 'capsule',
                    emissiveColor: 0x995522,
                    emissiveIntensity: 0.2
                };
                break;

            // ===== ÉPOCA 3: NUEVA ESPAÑA =====
            case 'fraile_antorcha':
                config = {
                    texture: 'assets/sprites/fraile_antorcha.png',
                    scale: new THREE.Vector3(2.2, 2.2, 2.2),
                    hitboxSize: new THREE.Vector3(1, 2.2, 1),
                    hitboxType: 'capsule',
                    emissiveColor: 0xff6600, // Naranja antorcha
                    emissiveIntensity: 0.9
                };
                break;
            case 'guardia_virreinal':
                config = {
                    texture: 'assets/sprites/guardia_virreinal.png',
                    scale: new THREE.Vector3(2.4, 2.4, 2.4),
                    hitboxSize: new THREE.Vector3(1.2, 2.4, 1.2),
                    hitboxType: 'capsule',
                    emissiveColor: 0xaaaaaa, // Plateado armadura
                    emissiveIntensity: 0.5
                };
                break;
            case 'inquisidor':
                config = {
                    texture: 'assets/sprites/inquisidor.png',
                    scale: new THREE.Vector3(2.5, 2.5, 2.5),
                    hitboxSize: new THREE.Vector3(1.2, 2.5, 1.2),
                    hitboxType: 'capsule',
                    emissiveColor: 0x330033, // Púrpura oscuro inquisición
                    emissiveIntensity: 0.7
                };
                break;
            case 'virrey_pomposo':
                config = {
                    texture: 'assets/sprites/virrey_pomposo.png',
                    scale: new THREE.Vector3(6.0, 6.0, 6.0), // Boss grande
                    hitboxSize: new THREE.Vector3(2.5, 6, 2.5),
                    hitboxType: 'capsule',
                    emissiveColor: 0xdd2255, // Carmesí virreinal
                    emissiveIntensity: 1.0
                };
                break;

            // ===== ÉPOCA 4: INDEPENDENCIA =====
            case 'soldado_realista':
                config = {
                    texture: 'assets/sprites/soldado_realista.png',
                    scale: new THREE.Vector3(2.2, 2.2, 2.2),
                    hitboxSize: new THREE.Vector3(1, 2.2, 1),
                    hitboxType: 'capsule',
                    emissiveColor: 0x1144cc, // Azul uniforme realista
                    emissiveIntensity: 0.6
                };
                break;
            case 'canon_vivo':
                config = {
                    texture: 'assets/sprites/canon_vivo.png',
                    scale: new THREE.Vector3(4.0, 3.0, 4.0),
                    hitboxSize: new THREE.Vector3(2, 3, 3),
                    hitboxType: 'box',
                    emissiveColor: 0xff4400, // Fuego cañón
                    emissiveIntensity: 1.1
                };
                break;
            case 'hidra_realista':
                config = {
                    texture: 'assets/sprites/hidra_realista.png',
                    scale: new THREE.Vector3(7.0, 7.0, 7.0), // Boss
                    hitboxSize: new THREE.Vector3(3.5, 7, 3.5),
                    hitboxType: 'capsule',
                    emissiveColor: 0x00ccff, // Cyan hidra
                    emissiveIntensity: 1.2
                };
                break;

            // ===== ÉPOCA 5: PORFIRIATO =====
            case 'rural_sombrero':
                config = {
                    texture: 'assets/sprites/rural_sombrero.png',
                    scale: new THREE.Vector3(2.3, 2.3, 2.3),
                    hitboxSize: new THREE.Vector3(1.1, 2.3, 1.1),
                    hitboxType: 'capsule',
                    emissiveColor: 0x886644, // Cuero/tierra
                    emissiveIntensity: 0.4
                };
                break;
            case 'maquina_vapor':
                config = {
                    texture: 'assets/sprites/maquina_vapor.png',
                    scale: new THREE.Vector3(5.0, 4.0, 5.0),
                    hitboxSize: new THREE.Vector3(2.5, 4, 4),
                    hitboxType: 'box',
                    emissiveColor: 0xff2200, // Horno rojo vivo
                    emissiveIntensity: 1.3
                };
                break;
            case 'general_maquina':
                config = {
                    texture: 'assets/sprites/general_maquina.png',
                    scale: new THREE.Vector3(7.0, 7.0, 7.0), // Boss
                    hitboxSize: new THREE.Vector3(3.5, 7, 3.5),
                    hitboxType: 'capsule',
                    emissiveColor: 0xffaa00, // Latón/dorado porfiriano
                    emissiveIntensity: 1.2
                };
                break;

            // ===== ÉPOCA 6: REVOLUCIÓN =====
            case 'federal_pelon':
                config = {
                    texture: 'assets/sprites/federal_pelon.png',
                    scale: new THREE.Vector3(2.2, 2.2, 2.2),
                    hitboxSize: new THREE.Vector3(1, 2.2, 1),
                    hitboxType: 'capsule',
                    emissiveColor: 0x667722, // Caqui militar
                    emissiveIntensity: 0.4
                };
                break;
            case 'federales_canon':
                config = {
                    texture: 'assets/sprites/federales_canon.png',
                    scale: new THREE.Vector3(4.5, 3.5, 4.5),
                    hitboxSize: new THREE.Vector3(2.2, 3.5, 3.5),
                    hitboxType: 'box',
                    emissiveColor: 0xdd3300, // Explosión artillería
                    emissiveIntensity: 1.0
                };
                break;
            case 'usurpador_gordo':
                config = {
                    texture: 'assets/sprites/usurpador_gordo.png',
                    scale: new THREE.Vector3(8.0, 8.0, 8.0), // Boss final
                    hitboxSize: new THREE.Vector3(4, 8, 4),
                    hitboxType: 'capsule',
                    emissiveColor: 0xffd700, // Medalla de hojalata dorada
                    emissiveIntensity: 1.4
                };
                break;
        }

        // 1. Crear Material (AGENTE_ESCENA)
        // Usamos SpriteMaterial o PlaneGeometry. Usaremos un Plano para recibir/proyectar luz.
        const texture = this.textureLoader.load(config.texture);
        
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.5, // Evita z-fighting con las transparencias
            side: THREE.DoubleSide,
            emissive: new THREE.Color(config.emissiveColor),
            emissiveMap: texture, // Usa la textura como mapa emisivo
            emissiveIntensity: config.emissiveIntensity,
            roughness: 0.8
        });

        const geometry = new THREE.PlaneGeometry(config.scale.x, config.scale.y);
        const spriteMesh = new THREE.Mesh(geometry, material);
        spriteMesh.position.copy(position);
        spriteMesh.position.y += config.scale.y / 2; // Levantar desde el suelo
        spriteMesh.castShadow = true;
        spriteMesh.receiveShadow = true;
        
        this.scene.add(spriteMesh);

        // --- CARGA DE MODELO GLTF 3D OPCIONAL ---
        let gltfModel = null;
        let mixer = null;
        let animations = {};
        let currentAnim = null;

        if (typeof THREE.GLTFLoader !== 'undefined') {
            const loader = new THREE.GLTFLoader();
            loader.load(`assets/models/enemies/${type}.glb`, (gltf) => {
                gltfModel = gltf.scene;
                // Escalar al tamaño de config
                gltfModel.scale.copy(config.scale).multiplyScalar(0.5); // Ajuste razonable
                gltfModel.position.copy(position);
                
                gltfModel.traverse((child) => {
                    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
                });

                this.scene.add(gltfModel);
                spriteMesh.visible = false; // Ocultar sprite plano fallback

                // Extract Animations
                if (gltf.animations && gltf.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(gltfModel);
                    gltf.animations.forEach((clip) => {
                        animations[clip.name.toLowerCase()] = mixer.clipAction(clip);
                    });
                    
                    // Bindings inteligentes
                    const findAnim = (alias) => {
                        let found = alias.find(a => animations[a]);
                        return found ? animations[found] : null;
                    };
                    
                    animations['idle'] = findAnim(['idle', 'stand', 'posestatic']);
                    animations['chase'] = findAnim(['run', 'walk', 'chase', 'move']);
                    animations['attack'] = findAnim(['attack', 'bite', 'dive', 'strike']);
                    
                    if (animations['idle']) {
                        currentAnim = animations['idle'];
                        currentAnim.play();
                    }
                    
                    // Ligar variables al objeto del enemigo que ya se devolvió
                    const enemyRef = this.enemies.find(e => e.sprite === spriteMesh);
                    if (enemyRef) {
                        enemyRef.gltfModel = gltfModel;
                        enemyRef.mixer = mixer;
                        enemyRef.animations = animations;
                        enemyRef.currentAnim = currentAnim;
                    }
                }
            }, undefined, () => { /* No model found, silently fallback to planar sprite */ });
        }

        // 2. Crear Hitbox Invisible (AGENTE_OPTIMIZADOR)
        let hitboxGeo;
        if (config.hitboxType === 'box') {
            hitboxGeo = new THREE.BoxGeometry(config.hitboxSize.x, config.hitboxSize.y, config.hitboxSize.z);
        } else {
            // Emulando Capsula con Cilindro
            hitboxGeo = new THREE.CylinderGeometry(config.hitboxSize.x/2, config.hitboxSize.x/2, config.hitboxSize.y, 8);
        }
        
        const hitboxMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, visible: false }); // Invisible
        const hitboxMesh = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitboxMesh.position.copy(position);
        hitboxMesh.position.y += config.hitboxSize.y / 2;
        
        this.scene.add(hitboxMesh);
        
        // Inyectar a las físicas del entorno
        this.environmentMeshes.push(hitboxMesh);

        const enemyObj = {
            sprite: spriteMesh,
            hitbox: hitboxMesh,
            type: type,
            state: 'IDLE',
            origin: position.clone(),
            velocity: new THREE.Vector3(),
            timer: Math.random() * 10,
            mixer: null, // Será inyectado asíncronamente
            animations: {},
            currentAnim: null,
            gltfModel: null
        };
        this.enemies.push(enemyObj);
        
        return enemyObj;
    }

    update(camera, playerPos, delta, time) {
        if (!playerPos || !delta) return; // Salvaguarda si LevelScene manda argumentos truncados
        
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            // 1. Billboarding Óptico (El sprite siempre te mira)
            const target = new THREE.Vector3(camera.position.x, enemy.sprite.position.y, camera.position.z);
            enemy.sprite.lookAt(target);
            
            // Bosses y NPCs pasivos – no entran en el FSM de persecución
            const PASSIVE_TYPES = ['aldeano_azteca','huitzilopochtli','virrey_pomposo','hidra_realista','general_maquina','usurpador_gordo','canon_vivo','federales_canon','maquina_vapor'];
            if (PASSIVE_TYPES.includes(enemy.type)) continue;
            
            // 2. Inteligencia Artificial (Euclidiana Vectorial 3D)
            const dist = new THREE.Vector3(enemy.sprite.position.x, 0, enemy.sprite.position.z)
                         .distanceTo(new THREE.Vector3(playerPos.x, 0, playerPos.z));
            
            enemy.timer += delta;
            
            switch(enemy.state) {
                case 'IDLE':
                    this._playEnemyAnim(enemy, 'idle');
                    // Animación Aérea de espera
                    if (enemy.type === 'guerrero_aguila') {
                        enemy.sprite.position.y = enemy.origin.y + Math.sin(time*0.003 + enemy.origin.x)*1.0;
                    }
                    // Activar Visión Neuronal (Aggro)
                    if (dist < 15) {
                        enemy.state = 'CHASE';
                        enemy.sprite.material.emissive.setHex(0xff0000); // Emisividad de Furia Rojo Sangre
                        enemy.timer = 0;
                    }
                    break;
                    
                case 'CHASE':
                    this._playEnemyAnim(enemy, 'chase');
                    const dir = new THREE.Vector3().subVectors(playerPos, enemy.sprite.position);
                    dir.y = 0; dir.normalize();
                    
                    if (dist > 22) { // Escape Area
                        enemy.state = 'IDLE';
                        // Retornar a paleta nativa
                        if(enemy.type==='jaguar_obsidiana') enemy.sprite.material.emissive.setHex(0xff8800);
                        if(enemy.type==='serpiente_piedra') enemy.sprite.material.emissive.setHex(0x00ff00);
                        if(enemy.type==='guerrero_aguila') enemy.sprite.material.emissive.setHex(0xffff00);
                        enemy.velocity.set(0,0,0);
                    } else {
                        // Core Mechanics Específicas
                        if (enemy.type === 'jaguar_obsidiana') {
                            if (dist < 8 && enemy.timer > 2.0) { // Embestida violenta (Dash Smash)
                                enemy.velocity.copy(dir).multiplyScalar(22); 
                                enemy.timer = 0;
                            } else {
                                enemy.velocity.lerp(new THREE.Vector3(0,0,0), 6 * delta); // Derrape rápido de frenado
                            }
                        } 
                        else if (enemy.type === 'serpiente_piedra') {
                            enemy.velocity.copy(dir).multiplyScalar(4.5); // Snake slither track
                        }
                        else if (enemy.type === 'guerrero_aguila') {
                            enemy.sprite.position.y = enemy.origin.y + Math.sin(time*0.005)*0.5;
                            enemy.velocity.copy(dir).multiplyScalar(7.5);
                            if (dist < 3.5 && enemy.timer > 3.0) { // Pisotón inesquivable a quema-ropa si pasas debajo
                                enemy.state = 'DIVE'; enemy.timer = 0;
                                enemy.velocity.set(0, -28, 0); 
                            }
                        }
                    }
                    break;
                    
                case 'DIVE': // Impacto de Caída Águila
                    if (enemy.sprite.position.y <= 0.8) {
                        enemy.sprite.position.y = 0.8;
                        enemy.state = 'RECOVER';
                        this._playEnemyAnim(enemy, 'idle');
                        enemy.velocity.set(0, 0, 0);
                        enemy.timer = 0;
                    }
                    break;
                    
                case 'RECOVER': // Ascender al Nido Base
                    if (enemy.timer > 1.5) {
                        enemy.velocity.set(0, 4, 0);
                        if (enemy.sprite.position.y >= enemy.origin.y) {
                            enemy.velocity.set(0, 0, 0);
                            enemy.state = 'CHASE';
                            enemy.timer = 0;
                        }
                    }
                    break;
            }
            
            // Integración Inercial Físico-Matemática
            enemy.sprite.position.add(enemy.velocity.clone().multiplyScalar(delta));
            if (enemy.hitbox) { enemy.hitbox.position.y = enemy.sprite.position.y; enemy.hitbox.position.x = enemy.sprite.position.x; enemy.hitbox.position.z = enemy.sprite.position.z; }
            
            // Movimiento del Modelo 3D si existe
            if (enemy.gltfModel) {
                enemy.gltfModel.position.copy(enemy.sprite.position);
                // Mirar hacia la dirección de movimiento o hacia el jugador si está muy cerca
                if (enemy.velocity.lengthSq() > 0.1) {
                    const lookTarget = enemy.gltfModel.position.clone().add(enemy.velocity);
                    enemy.gltfModel.lookAt(lookTarget);
                } else {
                    enemy.gltfModel.lookAt(new THREE.Vector3(playerPos.x, enemy.gltfModel.position.y, playerPos.z));
                }
            }
            
            // Actualizar Mixer de Animación
            if (enemy.mixer) enemy.mixer.update(delta);
        }
    }
    
    _playEnemyAnim(enemy, name) {
        if (!enemy.mixer || !enemy.animations[name]) return;
        const nextAction = enemy.animations[name];
        if (enemy.currentAnim === nextAction) return;

        if (enemy.currentAnim) enemy.currentAnim.fadeOut(0.2);
        nextAction.reset().fadeIn(0.2).play();
        enemy.currentAnim = nextAction;
    }
}
