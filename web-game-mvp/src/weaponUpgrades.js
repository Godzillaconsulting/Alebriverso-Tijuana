/**
 * WeaponUpgradeSystem — Mejoras de Arma RE4 Style
 * 
 * RE4: El mercader ofrece upgrades: Poder de Fuego, Recarga, Capacidad, Mira exclusiva.
 * Aquí: Potencia de Proyectil, Radio de Daño, Cadencia de Disparo, Alcance.
 * 
 * Arquitectura:
 *   UpgradeTree: Map<upgradeId, UpgradeDef>
 *   UpgradeDef: { label, stat, levels: [{cost, value, label}], current: 0 }
 *   appliedStats: objeto plano que WeaponManager consume vía getStats()
 */
import { GlobalState } from './gameState.js';
import { saveSystem } from './saveSystem.js';

// ─── ÁRBOL DE UPGRADES ────────────────────────────────────────────────────────
const UPGRADE_TREE = new Map([
    ['firepower', {
        label: '🔥 Poder de Fuego',
        stat: 'damage',
        current: 0,
        levels: [
            { cost: 0,  value: 1.0,  label: 'Base' },
            { cost: 12, value: 1.4,  label: 'Nivel 2' },
            { cost: 20, value: 1.9,  label: 'Nivel 3' },
            { cost: 35, value: 2.6,  label: 'Nivel 4 (MAX)' },
        ]
    }],
    ['blast_radius', {
        label: '💥 Radio de Explosión',
        stat: 'blastRadius',
        current: 0,
        levels: [
            { cost: 0,  value: 1.8,  label: 'Base' },
            { cost: 15, value: 2.5,  label: 'Nivel 2' },
            { cost: 28, value: 3.5,  label: 'Nivel 3 (MAX)' },
        ]
    }],
    ['fire_rate', {
        label: '⚡ Cadencia',
        stat: 'fireRate',
        current: 0,
        levels: [
            { cost: 0,  value: 0.45, label: 'Base' },      // segundos entre disparos
            { cost: 10, value: 0.32, label: 'Rápida' },
            { cost: 18, value: 0.20, label: 'Semi-Auto' },
            { cost: 30, value: 0.12, label: 'Automática (MAX)' },
        ]
    }],
    ['range', {
        label: '🎯 Alcance',
        stat: 'projectileLife',
        current: 0,
        levels: [
            { cost: 0,  value: 3.0,  label: 'Base' },      // segundos de vida del proyectil
            { cost: 8,  value: 4.5,  label: 'Largo' },
            { cost: 15, value: 6.0,  label: 'Muy largo (MAX)' },
        ]
    }],
]);

class WeaponUpgradeSystem {
    constructor() {
        // Restaurar progreso de upgrades si existe en GlobalState
        this._load();
    }

    // ─── STATS EFECTIVOS ─────────────────────────────────────────────────────
    /**
     * Retorna el objeto de stats del arma para que WeaponManager los consuma.
     * WeaponManager debe llamar `upgradeSystem.getStats()` en su constructor/update.
     */
    getStats() {
        const stats = {};
        for (const [id, def] of UPGRADE_TREE) {
            const lvl = def.current;
            stats[def.stat] = def.levels[lvl].value;
        }
        return stats;
    }

    // ─── COMPRA DE UPGRADE ───────────────────────────────────────────────────
    /**
     * Intenta subir un upgrade al siguiente nivel.
     * @param {string} upgradeId
     * @returns {{ success: boolean, message: string }}
     */
    buy(upgradeId) {
        const def = UPGRADE_TREE.get(upgradeId);
        if (!def) return { success: false, message: 'Upgrade inválido.' };

        const nextLevel = def.current + 1;
        if (nextLevel >= def.levels.length) {
            return { success: false, message: '¡Ya está al máximo!' };
        }

        const cost = def.levels[nextLevel].cost;
        if (GlobalState.coins < cost) {
            return { success: false, message: `Necesitas ${cost} monedas.` };
        }

        GlobalState.coins -= cost;
        def.current = nextLevel;

        window.dispatchEvent(new CustomEvent('scoreUpdate', { detail: { score: GlobalState.coins } }));
        window.dispatchEvent(new CustomEvent('weaponUpgraded', {
            detail: { upgradeId, level: nextLevel, stats: this.getStats() }
        }));
        this._save();

        console.log(`[WeaponUpgrade] ${def.label} → Nivel ${nextLevel}`);
        return {
            success: true,
            message: `¡${def.label} mejorado a ${def.levels[nextLevel].label}!`
        };
    }

    /**
     * Retorna el catálogo de upgrades para la UI del mercader (sección Afinado).
     */
    getCatalog() {
        const catalog = [];
        for (const [id, def] of UPGRADE_TREE) {
            const nextLvl = def.current + 1;
            const maxed   = nextLvl >= def.levels.length;
            catalog.push({
                upgradeId:    id,
                label:        def.label,
                currentLabel: def.levels[def.current].label,
                nextLabel:    maxed ? 'MAX' : def.levels[nextLvl].label,
                cost:         maxed ? 0 : def.levels[nextLvl].cost,
                maxed
            });
        }
        return catalog;
    }

    // ─── PERSISTENCIA ────────────────────────────────────────────────────────
    _save() {
        const state = {};
        for (const [id, def] of UPGRADE_TREE) state[id] = def.current;
        try { localStorage.setItem('tijuana_upgrades', JSON.stringify(state)); } catch (_) {}
    }

    _load() {
        try {
            const raw = localStorage.getItem('tijuana_upgrades');
            if (!raw) return;
            const state = JSON.parse(raw);
            for (const [id, level] of Object.entries(state)) {
                const def = UPGRADE_TREE.get(id);
                if (def) def.current = Math.min(level, def.levels.length - 1);
            }
        } catch (_) {}
    }

    /** Reset upgrades (Game Over o Nueva Partida si se desea) */
    reset() {
        for (const def of UPGRADE_TREE.values()) def.current = 0;
        localStorage.removeItem('tijuana_upgrades');
    }
}

export const weaponUpgradeSystem = new WeaponUpgradeSystem();
