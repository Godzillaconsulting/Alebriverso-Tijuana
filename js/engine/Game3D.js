// js/engine/Game3D.js
// Gestor principal del entorno 3D (Three.js) que se comunica con Phaser (Overlay 2D)

class Game3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error("No 3D container found.");

        this.scene = new THREE.Scene();
        
        // Cielo (Fog)
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.Fog(0x0a0a1a, 10, 40);

        this.camera = new THREE.PerspectiveCamera(60, this.container.clientWidth / this.container.clientHeight, 0.1, 100);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        
        this.container.innerHTML = ''; // Limpiar el canvas de TitleScene
        this.container.appendChild(this.renderer.domElement);

        // Iluminación
        const ambient = new THREE.AmbientLight(0x404040, 1.5);
        this.scene.add(ambient);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.dirLight.position.set(10, 20, 10);
        this.dirLight.castShadow = true;
        this.scene.add(this.dirLight);

        // Clases de Motor Físico (Desarrolladas por el usuario)
        this.controller = new AlebrijeController(this.scene, this.camera);
        
        // Manejador de Entorno
        this.terrainGroup = new THREE.Group();
        this.scene.add(this.terrainGroup);
        this.environmentMeshes = [];

        this.enemyManager = new EnemyManager(this.scene, this.environmentMeshes);
        
        this.clock = new THREE.Clock();
        this.isRunning = false;
        
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this._animate = this._animate.bind(this);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._animate();
    }

    stop() {
        this.isRunning = false;
    }

    // Phaser llamará esta función cuando el nivel comience
    loadEpoch(epochId) {
        // Limpiar entorno anterior
        while(this.terrainGroup.children.length > 0) { 
            this.terrainGroup.remove(this.terrainGroup.children[0]); 
        }
        this.environmentMeshes.length = 0;
        this.enemyManager.enemies.forEach(e => {
            this.scene.remove(e.sprite); if(e.hitbox) this.scene.remove(e.hitbox);
        });
        this.enemyManager.enemies = [];

        // Leer paleta de Phaser (EpochData)
        let colBg = 0x0a0a1a;
        if (window.EpochData && window.EpochData[epochId]) {
            const hexCols = window.EpochData[epochId].colores;
            colBg = hexCols.cieloBot;
            this.scene.background = new THREE.Color(colBg);
            this.scene.fog = new THREE.Fog(colBg, 15, 80);
        }

        // GENERADOR PROCEDURAL SM64 (ADAPTATIVO)
        if (epochId === 1) {
            // *** ÉPOCA 1: TENOCHTITLÁN (PIRÁMIDES Y CHINAMPAS) ***
            
            // 1. Lago de Texcoco
            const waterGeo = new THREE.PlaneGeometry(300, 300);
            const waterMat = new THREE.MeshStandardMaterial({ color: 0x005588, roughness: 0.1, transparent: true, opacity: 0.85 });
            const water = new THREE.Mesh(waterGeo, waterMat);
            water.rotation.x = -Math.PI / 2; water.position.y = -2;
            water.receiveShadow = true;
            this.terrainGroup.add(water); this.environmentMeshes.push(water);

            // 2. Isla Central de Tenochtitlán
            const islandMat = new THREE.MeshStandardMaterial({ color: 0x3a5a2e, roughness: 0.9 }); // Terreno verde
            const island = new THREE.Mesh(new THREE.CylinderGeometry(40, 45, 4, 32), islandMat);
            island.position.y = 0; island.receiveShadow = true; island.castShadow = true;
            this.terrainGroup.add(island); this.environmentMeshes.push(island);

            // 3. Templo Mayor (Pirámide Escalonada Plataformera)
            const pyrMat = new THREE.MeshStandardMaterial({ color: 0x777766, roughness: 1.0 });
            for (let i = 0; i < 5; i++) {
                const stepSize = 24 - (i * 4.5);
                const stepHeight = 2.5;
                const step = new THREE.Mesh(new THREE.BoxGeometry(stepSize, stepHeight, stepSize), pyrMat);
                step.position.set(0, 2 + i * stepHeight, -10);
                step.castShadow = true; step.receiveShadow = true;
                this.terrainGroup.add(step); this.environmentMeshes.push(step);
            }
            
            // Altar Superior (Sacrificio)
            const altar = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 4), new THREE.MeshStandardMaterial({color: 0x881111}));
            altar.position.set(0, 14.5, -10);
            this.terrainGroup.add(altar); this.environmentMeshes.push(altar);

            // 4. Puentes y Chinampas Periféricas (Retos de salto)
            const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x6e4f3a });
            const br1 = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 20), bridgeMat);
            br1.position.set(0, 2, 30); this.terrainGroup.add(br1); this.environmentMeshes.push(br1);
            
            const plat1 = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 2, 16), islandMat);
            plat1.position.set(20, 1, 15); this.terrainGroup.add(plat1); this.environmentMeshes.push(plat1);
            const plat2 = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 2, 16), islandMat);
            plat2.position.set(-25, 4, 10); this.terrainGroup.add(plat2); this.environmentMeshes.push(plat2);

            // --- INYECCIÓN DE ENEMIGOS EN COORDENADAS ARQUITECTÓNICAS ---
            this.enemyManager.createEnemy('aldeano_azteca', new THREE.Vector3(12, 3, 5));
            this.enemyManager.createEnemy('serpiente_piedra', new THREE.Vector3(-15, 3, -2));
            this.enemyManager.createEnemy('jaguar_obsidiana', new THREE.Vector3(20, 3, 15));
            this.enemyManager.createEnemy('guerrero_aguila', new THREE.Vector3(-25, 12, 10)); // Sobrevuela la chinampa
            this.enemyManager.createEnemy('huitzilopochtli', new THREE.Vector3(0, 16, -10)); // Custodia el Altar
            
            this.controller.playerGroup.position.set(0, 5, 35); // Inicio en el puente

        } else if (epochId === 2) {
            // *** ÉPOCA 2: LA CONQUISTA (GALEONES ESPAÑOLES) ***
            const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x003366, transparent: true, opacity: 0.9 }));
            water.rotation.x = -Math.PI / 2; water.position.y = -2; this.terrainGroup.add(water); this.environmentMeshes.push(water);

            const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
            const muelle = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 30), woodMat);
            muelle.position.set(0, 0, 25); this.terrainGroup.add(muelle); this.environmentMeshes.push(muelle);

            const galeon = new THREE.Mesh(new THREE.BoxGeometry(24, 6, 50), woodMat);
            galeon.position.set(0, 1, -10); this.terrainGroup.add(galeon); this.environmentMeshes.push(galeon);

            const mastil = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 30), new THREE.MeshStandardMaterial({color: 0x3e2723}));
            mastil.position.set(0, 18, -10); this.terrainGroup.add(mastil); this.environmentMeshes.push(mastil);
            
            // Plataformas vela (Smash 64 style)
            const vela = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 6), new THREE.MeshStandardMaterial({color: 0xddddcc}));
            vela.position.set(0, 12, -5); this.terrainGroup.add(vela); this.environmentMeshes.push(vela);
            
            this.controller.playerGroup.position.set(0, 3, 35); // Comienza al final del muelle
        } else if (epochId === 3) {
            // *** ÉPOCA 3: NUEVA ESPAÑA – CATEDRAL Y PLAZA MAYOR ***
            // Colores: cieloBot 0x050518, platTop 0x50506a, sueloTop 0x30304a
            const groundMat = new THREE.MeshStandardMaterial({ color: 0x30304a, roughness: 1.0 });
            const stoneMat  = new THREE.MeshStandardMaterial({ color: 0x50506a, roughness: 0.9 });
            const darkMat   = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 1.0 });
            const goldMat   = new THREE.MeshStandardMaterial({ color: 0xd4aa40, roughness: 0.4, metalness: 0.6 });

            // 1. Plaza Mayor (base plana)
            const plaza = new THREE.Mesh(new THREE.BoxGeometry(100, 2, 100), groundMat);
            plaza.position.set(0, -1, 0); plaza.receiveShadow = true;
            this.terrainGroup.add(plaza); this.environmentMeshes.push(plaza);

            // 2. Nave central de la catedral (cuerpo principal)
            const nave = new THREE.Mesh(new THREE.BoxGeometry(20, 18, 50), stoneMat);
            nave.position.set(0, 10, -20); nave.castShadow = true; nave.receiveShadow = true;
            this.terrainGroup.add(nave); this.environmentMeshes.push(nave);

            // Techo triangular (frontón)
            const techo = new THREE.Mesh(new THREE.CylinderGeometry(0, 12, 8, 4), stoneMat);
            techo.position.set(0, 22, -20); techo.rotation.y = Math.PI / 4;
            this.terrainGroup.add(techo); this.environmentMeshes.push(techo);

            // 3. Torres gemelas (plataformas multi-nivel Smash)
            for (let side of [-12, 12]) {
                const tBase = new THREE.Mesh(new THREE.BoxGeometry(8, 30, 8), stoneMat);
                tBase.position.set(side, 16, -5); tBase.castShadow = true;
                this.terrainGroup.add(tBase); this.environmentMeshes.push(tBase);

                // Campanario octogonal
                const camp = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 8, 8), darkMat);
                camp.position.set(side, 34, -5);
                this.terrainGroup.add(camp); this.environmentMeshes.push(camp);

                // Cruz dorada en punta
                const cruz = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), goldMat);
                cruz.position.set(side, 40, -5);
                this.terrainGroup.add(cruz); this.environmentMeshes.push(cruz);
                const cruzH = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.5), goldMat);
                cruzH.position.set(side, 42, -5);
                this.terrainGroup.add(cruzH); this.environmentMeshes.push(cruzH);
            }

            // 4. Arcos de portales (plataformas flotantes medio nivel)
            for (let z of [-5, -30]) {
                const arco = new THREE.Mesh(new THREE.TorusGeometry(5, 1, 6, 12, Math.PI), stoneMat);
                arco.rotation.z = Math.PI; arco.position.set(0, 6, z);
                this.terrainGroup.add(arco); this.environmentMeshes.push(arco);
            }

            // 5. Plataformas de contrafuertes laterales
            for (let i = 0; i < 4; i++) {
                const cf = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 6), stoneMat);
                cf.position.set(i % 2 === 0 ? 14 : -14, 3 + i * 4, -10 - i * 6);
                this.terrainGroup.add(cf); this.environmentMeshes.push(cf);
            }

            // 6. Chipotles/mercado: plataformas en la plaza
            for (let i = 0; i < 5; i++) {
                const stall = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 5), groundMat);
                stall.position.set(-25 + i * 12, 1, 25);
                this.terrainGroup.add(stall); this.environmentMeshes.push(stall);
            }

            // 7. Enemigos posicionados arquitectónicamente
            this.enemyManager.createEnemy('fraile_antorcha', new THREE.Vector3(15, 1, 20));
            this.enemyManager.createEnemy('fraile_antorcha', new THREE.Vector3(-15, 1, 20));
            this.enemyManager.createEnemy('guardia_virreinal', new THREE.Vector3(0, 1, 5));
            this.enemyManager.createEnemy('inquisidor', new THREE.Vector3(-12, 32, -5)); // Torre izq.
            this.enemyManager.createEnemy('virrey_pomposo', new THREE.Vector3(0, 20, -5)); // Plataforma arco central

            this.controller.playerGroup.position.set(0, 5, 40);

        } else if (epochId === 4) {
            // *** ÉPOCA 4: INDEPENDENCIA – CAMPO DE DOLORES & CAMPANAS ***
            // Colores: cieloBot 0x180518, sueloTop 0x4a304a, platTop 0x6a506a
            const fieldMat  = new THREE.MeshStandardMaterial({ color: 0x4a304a, roughness: 1.0 });
            const stoneMat  = new THREE.MeshStandardMaterial({ color: 0x6a506a, roughness: 0.9 });
            const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x7d6030, roughness: 0.5, metalness: 0.7 });
            const woodMat   = new THREE.MeshStandardMaterial({ color: 0x3e2412, roughness: 1.0 });

            // 1. Llanura de Dolores Hidalgo
            const campo = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), fieldMat);
            campo.rotation.x = -Math.PI / 2; campo.position.y = -0.5; campo.receiveShadow = true;
            this.terrainGroup.add(campo); this.environmentMeshes.push(campo);

            // 2. Colina central (cerro del Grito)
            const cerro = new THREE.Mesh(new THREE.CylinderGeometry(25, 35, 8, 20), fieldMat);
            cerro.position.set(0, 3, -5); cerro.receiveShadow = true;
            this.terrainGroup.add(cerro); this.environmentMeshes.push(cerro);

            // 3. Torre del campanario de Dolores
            const torre = new THREE.Mesh(new THREE.BoxGeometry(10, 35, 10), stoneMat);
            torre.position.set(0, 19, -15); torre.castShadow = true;
            this.terrainGroup.add(torre); this.environmentMeshes.push(torre);

            // Plataformas intermedias de la torre
            for (let i = 1; i <= 3; i++) {
                const nivel = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 14), stoneMat);
                nivel.position.set(0, 5 + i * 9, -15);
                this.terrainGroup.add(nivel); this.environmentMeshes.push(nivel);
            }

            // 4. Campana (objeto icónico, plataforma en la cima)
            const campBase = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 8), stoneMat);
            campBase.position.set(0, 37, -15);
            this.terrainGroup.add(campBase); this.environmentMeshes.push(campBase);

            const campana = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 3.5, 5, 12, 1, true), bronzeMat);
            campana.position.set(0, 42, -15);
            this.terrainGroup.add(campana); this.environmentMeshes.push(campana);

            // 5. Hacienda y establos (plataformas bajas laterales)
            const hacienda = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 12), stoneMat);
            hacienda.position.set(-28, 3, 10);
            this.terrainGroup.add(hacienda); this.environmentMeshes.push(hacienda);
            const establo = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 10), woodMat);
            establo.position.set(28, 2.5, 10);
            this.terrainGroup.add(establo); this.environmentMeshes.push(establo);

            // 6. Cañones/barricadas (plataformas medias)
            for (let i = -1; i <= 1; i += 2) {
                const barricada = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 6), woodMat);
                barricada.position.set(i * 18, 5.5, -2);
                this.terrainGroup.add(barricada); this.environmentMeshes.push(barricada);
            }

            // 7. Enemigos insurgentes y realistas
            this.enemyManager.createEnemy('soldado_realista', new THREE.Vector3(18, 6, -2));
            this.enemyManager.createEnemy('soldado_realista', new THREE.Vector3(-18, 6, -2));
            this.enemyManager.createEnemy('soldado_realista', new THREE.Vector3(0, 8, 5));
            this.enemyManager.createEnemy('canon_vivo', new THREE.Vector3(-28, 7, 10));   // En hacienda
            this.enemyManager.createEnemy('hidra_realista', new THREE.Vector3(0, 38, -15)); // En la campana

            this.controller.playerGroup.position.set(0, 5, 35);

        } else if (epochId === 5) {
            // *** ÉPOCA 5: PORFIRIATO – LOCOMOTORAS Y ESTACIÓN DE TREN ***
            // Colores: cieloBot 0x050505, sueloTop 0x5a4a3a, platTop 0x766656
            const dirtMat   = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1.0 });
            const steelMat  = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.8 });
            const ironMat   = new THREE.MeshStandardMaterial({ color: 0x766656, roughness: 0.8 });
            const woodMat   = new THREE.MeshStandardMaterial({ color: 0x4a3820, roughness: 1.0 });
            const brickMat  = new THREE.MeshStandardMaterial({ color: 0x8a4a35, roughness: 0.9 });
            const glassMat  = new THREE.MeshStandardMaterial({ color: 0xaaccdd, roughness: 0.1, transparent: true, opacity: 0.4 });

            // 1. Explanada de la estación (tierra compactada)
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), dirtMat);
            ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; ground.receiveShadow = true;
            this.terrainGroup.add(ground); this.environmentMeshes.push(ground);

            // 2. Andén principal (plataforma larga horizontal)
            const anden = new THREE.Mesh(new THREE.BoxGeometry(80, 2, 12), ironMat);
            anden.position.set(0, 1, 0); anden.receiveShadow = true; anden.castShadow = true;
            this.terrainGroup.add(anden); this.environmentMeshes.push(anden);

            // 3. Edificio de la estación (3 pisos, pórtico)
            const fachada = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 14), brickMat);
            fachada.position.set(0, 9, -20); fachada.castShadow = true;
            this.terrainGroup.add(fachada); this.environmentMeshes.push(fachada);

            // Techo en arco (bóveda)
            const boveda = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 30, 12, 1, false, 0, Math.PI), glassMat);
            boveda.rotation.z = Math.PI / 2; boveda.position.set(0, 18, -20);
            this.terrainGroup.add(boveda);

            // Pórtico columnas
            for (let x of [-12, -4, 4, 12]) {
                const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 10, 8), ironMat);
                col.position.set(x, 6, -14); col.castShadow = true;
                this.terrainGroup.add(col); this.environmentMeshes.push(col);
            }

            // 4. Locomotora (vagón principal = plataformas de escalada)
            const caldera = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 20, 16), steelMat);
            caldera.rotation.z = Math.PI / 2; caldera.position.set(-25, 5, 10);
            this.terrainGroup.add(caldera); this.environmentMeshes.push(caldera);

            const cabina = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), brickMat);
            cabina.position.set(-34, 6, 10); cabina.castShadow = true;
            this.terrainGroup.add(cabina); this.environmentMeshes.push(cabina);

            const chimenea = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 6, 10), steelMat);
            chimenea.position.set(-20, 10, 10); chimenea.castShadow = true;
            this.terrainGroup.add(chimenea); this.environmentMeshes.push(chimenea);

            // 5. Vagones de carga (plataformas saltables a lo largo de la vía)
            for (let i = 0; i < 4; i++) {
                const vagon = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), woodMat);
                vagon.position.set(-6 + i * 12, 5, 25); vagon.castShadow = true;
                this.terrainGroup.add(vagon); this.environmentMeshes.push(vagon);
            }

            // 6. Torre del depósito de agua
            const deposito = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 12, 12), woodMat);
            deposito.position.set(35, 8, -5);
            this.terrainGroup.add(deposito); this.environmentMeshes.push(deposito);
            const tapaDep = new THREE.Mesh(new THREE.CylinderGeometry(0, 4.5, 5, 12), ironMat);
            tapaDep.position.set(35, 16, -5);
            this.terrainGroup.add(tapaDep); this.environmentMeshes.push(tapaDep);

            // 7. Plataformas de rieles elevados (tendidos eléctricos porfirianos)
            for (let i = -2; i <= 2; i++) {
                const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 18, 6), ironMat);
                poste.position.set(i * 18, 9, -8);
                this.terrainGroup.add(poste); this.environmentMeshes.push(poste);
                const cable = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 0.2), steelMat);
                cable.position.set(i * 18 - 9, 17, -8);
                this.terrainGroup.add(cable);
            }

            // 8. Enemigos en la estación
            this.enemyManager.createEnemy('rural_sombrero', new THREE.Vector3(0, 2, 5));
            this.enemyManager.createEnemy('rural_sombrero', new THREE.Vector3(20, 2, 5));
            this.enemyManager.createEnemy('rural_sombrero', new THREE.Vector3(-20, 2, 5));
            this.enemyManager.createEnemy('maquina_vapor', new THREE.Vector3(-25, 6, 10)); // Sobre la loco
            this.enemyManager.createEnemy('general_maquina', new THREE.Vector3(0, 10, -20)); // En la fachada

            this.controller.playerGroup.position.set(0, 3, 35);

        } else if (epochId === 6) {
            // *** ÉPOCA 6: REVOLUCIÓN – DESIERTO Y HACIENDA EN RUINAS ***
            // Colores: cieloBot 0x2a1a05, sueloTop 0x7a5a3a, platTop 0x866646
            const sandMat   = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1.0 });
            const ruinMat   = new THREE.MeshStandardMaterial({ color: 0x866646, roughness: 1.0 });
            const rockMat   = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
            const dustMat   = new THREE.MeshStandardMaterial({ color: 0x9a7050, roughness: 1.0 });
            const ropaMat   = new THREE.MeshStandardMaterial({ color: 0x3a2a10, roughness: 1.0 });

            // 1. Desierto plano (arena y polvo)
            const suelo = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), sandMat);
            suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.5; suelo.receiveShadow = true;
            this.terrainGroup.add(suelo); this.environmentMeshes.push(suelo);

            // 2. Dunas y montículos (plataformas naturales bajas)
            const dunaPos = [[0, 0, -10, 18, 5], [-30, 0, 5, 14, 4], [30, 0, 5, 12, 4], [-15, 0, 20, 10, 3]];
            for (let [x, y, z, r, h] of dunaPos) {
                const duna = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), sandMat);
                duna.position.set(x, y, z); duna.receiveShadow = true;
                this.terrainGroup.add(duna); this.environmentMeshes.push(duna);
            }

            // 3. Hacienda en ruinas (paredes parciales plataformables)
            // Muro frontal roto
            const muroF1 = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 2), ruinMat);
            muroF1.position.set(-12, 6, -20); muroF1.castShadow = true;
            this.terrainGroup.add(muroF1); this.environmentMeshes.push(muroF1);
            const muroF2 = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 2), ruinMat);
            muroF2.position.set(12, 4, -20); muroF2.castShadow = true;
            this.terrainGroup.add(muroF2); this.environmentMeshes.push(muroF2);

            // Muros laterales
            const muroL = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 30), ruinMat);
            muroL.position.set(-22, 7, -8); muroL.castShadow = true;
            this.terrainGroup.add(muroL); this.environmentMeshes.push(muroL);
            const muroR = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 20), ruinMat);
            muroR.position.set(22, 5, -15); muroR.castShadow = true;
            this.terrainGroup.add(muroR); this.environmentMeshes.push(muroR);

            // 4. Techumbre semiderruida (plataforma inclinada difícil)
            const techo = new THREE.Mesh(new THREE.BoxGeometry(30, 1.5, 18), ropaMat);
            techo.rotation.z = 0.25; techo.position.set(-8, 13, -8); techo.castShadow = true;
            this.terrainGroup.add(techo); this.environmentMeshes.push(techo);

            // 5. Vías del tren revolucionario (raíles cruzando el mapa)
            const riel1 = new THREE.Mesh(new THREE.BoxGeometry(120, 0.5, 1.5), rockMat);
            riel1.position.set(0, 0, 5);
            this.terrainGroup.add(riel1); this.environmentMeshes.push(riel1);
            const riel2 = new THREE.Mesh(new THREE.BoxGeometry(120, 0.5, 1.5), rockMat);
            riel2.position.set(0, 0, 8);
            this.terrainGroup.add(riel2); this.environmentMeshes.push(riel2);

            // Traviesas del tren
            for (let i = -10; i <= 10; i += 2) {
                const trav = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 6), ropaMat);
                trav.position.set(i * 5, 0, 6.5);
                this.terrainGroup.add(trav);
            }

            // 6. Peñascos / rocas monumentales (plataformas altas)
            for (let cfg of [{x:-40,y:8,z:-15,s:7},{x:40,y:6,z:-10,s:5},{x:0,y:10,z:-35,s:8}]) {
                const pena = new THREE.Mesh(new THREE.DodecahedronGeometry(cfg.s, 0), rockMat);
                pena.position.set(cfg.x, cfg.y, cfg.z); pena.castShadow = true;
                this.terrainGroup.add(pena); this.environmentMeshes.push(pena);
            }

            // 7. Tren villista (plataformas de vagones en las vías)
            for (let i = -3; i <= 1; i++) {
                const wagon = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 7), dustMat);
                wagon.position.set(i * 11, 4, 6.5); wagon.castShadow = true;
                this.terrainGroup.add(wagon); this.environmentMeshes.push(wagon);
            }

            // 8. Enemigos del desierto
            this.enemyManager.createEnemy('federal_pelon', new THREE.Vector3(-12, 13, -8));   // En el techo
            this.enemyManager.createEnemy('federal_pelon', new THREE.Vector3(22, 11, -15));   // Muro lateral
            this.enemyManager.createEnemy('federal_pelon', new THREE.Vector3(-22, 15, -5));   // Muro alto
            this.enemyManager.createEnemy('federales_canon', new THREE.Vector3(0, 1, 25));    // Frente del avance
            this.enemyManager.createEnemy('usurpador_gordo', new THREE.Vector3(0, 11, -35));  // Peñasco del fondo

            this.controller.playerGroup.position.set(0, 3, 40);

        } else {
            // *** FALLBACK PROCEDURAL (15 bloques aleatorios) ***
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 20), new THREE.MeshStandardMaterial({ color: 0x334433 }));
            floor.rotation.x = -Math.PI / 2; this.terrainGroup.add(floor); this.environmentMeshes.push(floor);
            for(let i=0; i<15; i++) {
                const box = new THREE.Mesh(new THREE.BoxGeometry(4, Math.random()*4 + 2, 4), new THREE.MeshStandardMaterial({color: 0x555555}));
                box.position.set(-10 + (Math.random()*40), box.geometry.parameters.height/2, -5 + (Math.random()*10));
                this.terrainGroup.add(box); this.environmentMeshes.push(box);
            }
            this.controller.playerGroup.position.set(0, 5, 0);
        }

        this.controller.setEnvironment(this.environmentMeshes);
        this.start();
    }

    _animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(this._animate);
        
        const delta = this.clock.getDelta();
        
        // Actualizar Física y Movimiento (User engine)
        if (this.controller) this.controller.update(delta);
        if (this.enemyManager) this.enemyManager.update(this.camera);

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.container) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
}
