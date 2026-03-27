// js/engine/GameManager.js
// Extraído de la prueba MVP (web-game-mvp) para gestionar coleccionables 3D y despachar eventos a Phaser 2D UI

class GameManager {
    constructor(scene) {
        this.scene = scene;
        this.gems = [];
        this.score = 0;
        
        // Obsidian stones iniciales para Época 1
        this.spawnObsidianStone(0, 16, -10); // Cerca del altar de Huitzilopochtli
        this.spawnObsidianStone(20, 3, 15);  // Chinampa adyacente
        this.spawnObsidianStone(-25, 6, 10); // Plataforma alta lateral
    }
    
    spawnObsidianStone(x, y, z) {
        const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x111111, 
            roughness: 0.1, 
            metalness: 0.5 
        });
        const gem = new THREE.Mesh(geo, mat);
        gem.position.set(x, y, z);
        gem.castShadow = true;
        
        this.scene.add(gem);
        this.gems.push(gem);
    }
    
    update(delta, playerPosition) {
        // Rotación continua a lo SM64
        const rotationSpeed = 2 * delta;
        
        for (let i = this.gems.length - 1; i >= 0; i--) {
            const gem = this.gems[i];
            
            gem.rotation.y += rotationSpeed;
            gem.rotation.x += rotationSpeed * 0.5;
            // Levitación Smooth
            gem.position.y += Math.sin(Date.now() * 0.005) * 0.005;
            
            const dist = playerPosition.distanceTo(gem.position);
            // Radio para recolectar
            if (dist < 3.0) { 
                this.collectGem(i);
            }
        }
    }
    
    collectGem(index) {
        const gem = this.gems[index];
        this.scene.remove(gem);
        this.gems.splice(index, 1);
        
        this.score += 10;
        
        // Emitir Evento Nativo de JS para que Phaser 3 lo escuche, y así unimos el 3D con el 2D.
        window.dispatchEvent(new CustomEvent('alebrije-collect-obsidian', { 
            detail: { score: this.score }
        }));
    }
}
