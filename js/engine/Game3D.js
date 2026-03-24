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
