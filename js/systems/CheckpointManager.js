export default class CheckpointManager {
    constructor() {
        this.checkpoints = [];
        this.activeCheckpointIndex = -1;
        // Spawn original del mundo
        this.spawnX = 0;
        this.spawnY = 15;
        this.spawnZ = 0;
        this.respawning = false;
    }

    registerCheckpoint(platData) {
        this.checkpoints.push(platData);
    }

    update(player) {
        if (!player || player.currentState === player.STATES.DEAD) return;

        for (let i = 0; i < this.checkpoints.length; i++) {
            const cp = this.checkpoints[i];
            const dx = Math.abs(player.x - cp.position.x);
            const dz = Math.abs(player.z - cp.position.z);
            const hw = cp.size.width / 2;
            const hd = cp.size.depth / 2;
            const dy = player.y - cp.position.y;

            // Box Trigger amplio para detectar cruce del jugador
            if (dx < hw + player.radius && dz < hd + player.radius && dy >= 0 && dy < 4.0) {
                if (this.activeCheckpointIndex !== i) {
                    this.activeCheckpointIndex = i;
                    this.spawnX = cp.position.x;
                    this.spawnY = cp.position.y + 2.0;
                    this.spawnZ = cp.position.z;
                    console.log(`[Checkpoints] Bandera Salvada: ${this.spawnX.toFixed(1)}, ${this.spawnZ.toFixed(1)}`);
                    
                    // Efecto visual rápido
                    if (cp.meshNode && cp.meshNode.material) {
                        cp.meshNode.material.emissive.setHex(0x00ff00);
                    }
                }
            }
        }
    }

    respawnPlayer(player) {
        this.respawning = true;
        
        // Curar
        player.health = player.maxHealth;
        if (window.healthUI) window.healthUI.update(player.health);
        
        // Reset Cinemático
        player.x = this.spawnX;
        player.y = this.spawnY + 8.0; // Desplome del cielo
        player.z = this.spawnZ;
        player.vy = -10.0;
        player.momentumX = 0;
        player.momentumZ = 0;
        player.currentState = player.STATES.NORMAL;
        player.invulnTimer = 3.0;
        
        console.log(`[Checkpoints] La Iguana ha reaparecido.`);
        this.respawning = false;
    }
}
