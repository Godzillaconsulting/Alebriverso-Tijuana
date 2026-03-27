// GameState Singleton
// Retiene información persistente (HP, Monedas, Estrellas, Inventario) mientras la escena WebGL se reinicia.

class GameState {
    constructor() {
        this.maxHealth = 8;
        this.currentHealth = 8;
        this.coins = 0;
        this.stars = []; 
        this.currentLevel = '/levels/level_tenochtitlan.json';
    }

    addCoin() {
        this.coins += 1;
        // Check 1UP at 100 coins
        if (this.coins >= 100) {
            this.coins -= 100;
            // 1 UP Logic
        }
        return this.coins;
    }

    collectStar(starId) {
        if (!this.stars.includes(starId)) {
            this.stars.push(starId);
        }
    }

    updateHealth(newHealth) {
        this.currentHealth = Math.max(0, Math.min(newHealth, this.maxHealth));
    }

    reset() {
        this.currentHealth = this.maxHealth;
        this.coins = 0;
        // this.stars = []; usually stars persist over game over depending on design
    }
}

export const GlobalState = new GameState();
