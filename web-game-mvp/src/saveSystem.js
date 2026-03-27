/**
 * SaveSystem — Sistema de Guardado RE4 Style
 * 
 * Arquitectura:
 *   - 3 slots de guardado independientes (String keys en localStorage)
 *   - Snapshot total del GlobalState + posición del jugador + nivel actual
 *   - Auto-save en eventos de estrella recolectada
 *   - Programación defensiva: try/catch en toda serialización
 * 
 * Estructura del Save Slot:
 *   {
 *     version: 1,
 *     timestamp: Date.now(),
 *     levelPath: string,
 *     missionID: number,
 *     playerPos: { x, y, z },
 *     health: number,
 *     coins: number,
 *     stars: string[],
 *     inventory: { [itemType]: count },
 *     playtime: seconds
 *   }
 */
import { GlobalState } from './gameState.js';

const SAVE_VERSION   = 1;
const SAVE_KEY_BASE  = 'tijuana_save_';
const NUM_SLOTS      = 3;

class SaveSystem {
    constructor() {
        this._playtimeStart = Date.now();
        this._playtimeAccum = 0; // Segundos acumulados de sesiones anteriores
        
        // Escuchar auto-save triggers
        window.addEventListener('starCollected', () => this.autoSave());
        window.addEventListener('levelLoaded',   () => this.autoSave());
    }

    // ─── GUARDADO ────────────────────────────────────────────────────
    
    /**
     * Guarda el estado actual en el slot indicado.
     * @param {number} slot 0-2
     * @param {THREE.Vector3} playerPos
     * @param {string} levelPath
     * @param {number} missionID
     * @param {Object} inventorySnapshot - { itemType: count }
     */
    save(slot, playerPos, levelPath, missionID, inventorySnapshot = {}) {
        if (slot < 0 || slot >= NUM_SLOTS) {
            console.error('[SaveSystem] Slot inválido:', slot);
            return false;
        }

        const playtime = this._playtimeAccum + Math.floor((Date.now() - this._playtimeStart) / 1000);

        const snapshot = {
            version:   SAVE_VERSION,
            timestamp: Date.now(),
            levelPath,
            missionID,
            playerPos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
            health:    GlobalState.currentHealth,
            coins:     GlobalState.coins,
            stars:     [...GlobalState.stars],
            inventory: inventorySnapshot,
            playtime
        };

        try {
            localStorage.setItem(`${SAVE_KEY_BASE}${slot}`, JSON.stringify(snapshot));
            console.log(`[SaveSystem] Guardado en Slot ${slot}:`, levelPath);
            window.dispatchEvent(new CustomEvent('gameSaved', { detail: { slot } }));
            return true;
        } catch (err) {
            console.error('[SaveSystem] Error al guardar (storage lleno?):', err);
            return false;
        }
    }

    /**
     * Carga un slot. Retorna el snapshot JSON o null si está vacío/corrupto.
     * @param {number} slot
     * @returns {Object|null}
     */
    load(slot) {
        try {
            const raw = localStorage.getItem(`${SAVE_KEY_BASE}${slot}`);
            if (!raw) return null;

            const data = JSON.parse(raw);
            if (data.version !== SAVE_VERSION) {
                console.warn(`[SaveSystem] Versión de save incompatible: ${data.version}`);
                return null;
            }
            return data;
        } catch (err) {
            console.error('[SaveSystem] Save corrupto en slot', slot, err);
            return null;
        }
    }

    /**
     * Aplica el snapshot al GlobalState y retorna la data para transición de nivel.
     * El LevelManager usará levelPath y missionID para cargar el nivel correcto.
     */
    applySnapshot(snapshot) {
        GlobalState.currentHealth  = snapshot.health;
        GlobalState.coins          = snapshot.coins;
        GlobalState.stars          = snapshot.stars || [];
        GlobalState.currentLevel   = snapshot.levelPath;
        this._playtimeAccum        = snapshot.playtime || 0;
        this._playtimeStart        = Date.now();

        window.dispatchEvent(new CustomEvent('healthUpdate', { detail: { health: GlobalState.currentHealth } }));
        window.dispatchEvent(new CustomEvent('scoreUpdate',  { detail: { score: GlobalState.coins } }));

        return {
            levelPath: snapshot.levelPath,
            missionID: snapshot.missionID || 1,
            playerPos: snapshot.playerPos,
            inventory: snapshot.inventory || {}
        };
    }

    /**
     * Borra un slot de guardado.
     */
    delete(slot) {
        localStorage.removeItem(`${SAVE_KEY_BASE}${slot}`);
        console.log(`[SaveSystem] Slot ${slot} borrado.`);
    }

    /**
     * Retorna metadatos de los 3 slots para la UI de selección (sin cargar todo).
     * @returns {Array<{slot, empty, levelPath, timestamp, playtime, health, stars}>}
     */
    getSlotsMetadata() {
        return Array.from({ length: NUM_SLOTS }, (_, i) => {
            const raw = localStorage.getItem(`${SAVE_KEY_BASE}${i}`);
            if (!raw) return { slot: i, empty: true };
            try {
                const d = JSON.parse(raw);
                return {
                    slot:      i,
                    empty:     false,
                    levelPath: d.levelPath,
                    timestamp: d.timestamp,
                    playtime:  d.playtime,
                    health:    d.health,
                    stars:     d.stars?.length || 0
                };
            } catch { return { slot: i, empty: true }; }
        });
    }

    /**
     * Auto-save en Slot 0 (slot de continuación automática).
     * Requiere que window.levelManager y window.player estén disponibles.
     */
    autoSave() {
        if (!window.player || !window.levelManager) return;
        const inventory = window.inventorySystem
            ? window.inventorySystem.getSnapshot()
            : {};
        this.save(
            0,
            window.player.mesh.position,
            GlobalState.currentLevel,
            GlobalState.currentMissionID || 1,
            inventory
        );
    }

    /** Playtime formateado HH:MM:SS */
    getFormattedPlaytime(snapshot) {
        const t = snapshot?.playtime || 0;
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = t % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
}

// Singleton global
export const saveSystem = new SaveSystem();
