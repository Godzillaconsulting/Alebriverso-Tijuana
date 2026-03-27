/**
 * InventorySystem — Grid 3×4 de Ítems (RE4 Attaché Case style)
 * 
 * Arquitectura:
 *   - Flat Array de 12 slots (Int8Array para tipo, Uint8Array para cantidad)
 *   - ItemRegistry: Map<string, ItemDef> con O(1) lookup
 *   - addItem: busca stack existente O(n), n≤12
 *   - removeItem: O(n), n≤12
 *   - Dispatch de eventos para que uiManager actualice el grid reactivamente
 */

import { GlobalState } from './gameState.js';

// ─── REGISTRO DE ÍTEMS ────────────────────────────────────────────────────────
// Cada ítem tiene: name, icon (ruta PNG), description, stackable, maxStack
export const ItemRegistry = new Map([
    ['health_herb',       { name: 'Hierba Medicinal',   icon: '/textures/ui/icono_hierba_verde.png',      description: 'Restaura 3 puntos de vida.',    stackable: true,  maxStack: 9 }],
    ['star_fragment',     { name: 'Fragmento de Jade',  icon: '/textures/ui/icono_fragmento_estrella.png', description: 'Fragmento de estrella antigua.', stackable: true,  maxStack: 5 }],
    ['obsidian_shard',    { name: 'Cristal de Obsidiana', icon: '/textures/ui/icono_obsidiana.png',        description: 'Munición concentrada de sombra.', stackable: true, maxStack: 20 }],
    ['ammo_light',        { name: 'Luz Solar',           icon: '/textures/ui/icono_municion.png',          description: 'Proyectil de energía solar.',   stackable: true,  maxStack: 30 }],
    ['key',               { name: 'Llave Jade',          icon: '/textures/ui/icono_llave_jade.png',        description: 'Abre una puerta sellada.',      stackable: false, maxStack: 1 }],
]);

const GRID_COLS  = 3;
const GRID_ROWS  = 4;
const GRID_SIZE  = GRID_COLS * GRID_ROWS; // 12 slots

class InventorySystem {
    constructor() {
        // Parallel arrays para cache-friendliness:
        // _types[i] = string del itemType ('health_herb') o null
        // _counts[i] = cantidad en ese slot
        this._types  = new Array(GRID_SIZE).fill(null);
        this._counts = new Uint8Array(GRID_SIZE);
        
        this.cols = GRID_COLS;
        this.rows = GRID_ROWS;
    }

    // ─── CORE API ────────────────────────────────────────────────────

    /**
     * Agrega un ítem al inventario.
     * Si es stackable, busca slot existente. Si no, primer slot vacío.
     * @returns {boolean} éxito
     */
    addItem(type, count = 1) {
        const def = ItemRegistry.get(type);
        if (!def) { console.warn(`[Inventory] Item desconocido: ${type}`); return false; }

        if (def.stackable) {
            // 1. Buscar slot con mismo tipo y espacio disponible
            for (let i = 0; i < GRID_SIZE; i++) {
                if (this._types[i] === type && this._counts[i] < def.maxStack) {
                    const space = def.maxStack - this._counts[i];
                    const adding = Math.min(count, space);
                    this._counts[i] += adding;
                    count -= adding;
                    if (count <= 0) {
                        this._emit();
                        return true;
                    }
                }
            }
        }

        // 2. Primer slot vacío para el remainder o item no-stackable
        for (let i = 0; i < GRID_SIZE; i++) {
            if (this._types[i] === null) {
                this._types[i]  = type;
                this._counts[i] = Math.min(count, def.maxStack);
                this._emit();
                return true;
            }
        }

        console.warn('[Inventory] Inventario lleno — no se puede agegar:', type);
        return false;
    }

    /**
     * Consume ítems del inventario.
     * @returns {boolean} éxito (tenía suficientes)
     */
    removeItem(type, count = 1) {
        for (let i = 0; i < GRID_SIZE; i++) {
            if (this._types[i] === type) {
                if (this._counts[i] >= count) {
                    this._counts[i] -= count;
                    if (this._counts[i] === 0) {
                        this._types[i]  = null;
                        this._counts[i] = 0;
                    }
                    this._emit();
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Verifica si el jugador tiene al menos N de un ítem.
     */
    hasItem(type, count = 1) {
        for (let i = 0; i < GRID_SIZE; i++) {
            if (this._types[i] === type && this._counts[i] >= count) return true;
        }
        return false;
    }

    /**
     * Usa un ítem (health_herb → restaura vida, etc.)
     * @param {number} slotIndex
     */
    useItem(slotIndex) {
        const type = this._types[slotIndex];
        if (!type || !window.player) return;

        let consumed = false;

        if (type === 'health_herb') {
            // Curar al jugador (PlayerController)
            window.player.hp = Math.min(window.uiManager ? window.uiManager.maxHP : 3, window.player.hp + 3);
            
            // Actualizar HUD disparando el mismo evento que usa el daño
            window.dispatchEvent(new CustomEvent('playerHurt', { detail: { hp: window.player.hp } }));
            
            // Efecto visual/sonoro de curación (Opcional, RE4 Vibe)
            if (window.vfxManager) window.vfxManager.createSparks(window.player.mesh.position, 15, 0x00ff00);
            
            consumed = true;
        }

        if (consumed) {
            this._counts[slotIndex]--;
            if (this._counts[slotIndex] <= 0) {
                this._types[slotIndex]  = null;
                this._counts[slotIndex] = 0;
            }
            this._emit();
        }
    }

    /**
     * Retorna snapshot plano { itemType: totalCount } para SaveSystem.
     */
    getSnapshot() {
        const snap = {};
        for (let i = 0; i < GRID_SIZE; i++) {
            if (this._types[i]) {
                snap[this._types[i]] = (snap[this._types[i]] || 0) + this._counts[i];
            }
        }
        return snap;
    }

    /**
     * Restaura inventario desde snapshot del SaveSystem.
     */
    loadSnapshot(snap) {
        this._types.fill(null);
        this._counts.fill(0);
        if (!snap) return;
        for (const [type, count] of Object.entries(snap)) {
            this.addItem(type, count);
        }
    }

    /**
     * Retorna array de { slotIndex, type, count, def } para que uiManager renderice el grid.
     */
    getSlots() {
        return this._types.map((type, i) => ({
            slotIndex: i,
            type:      type,
            count:     this._counts[i],
            def:       type ? ItemRegistry.get(type) : null
        }));
    }

    _emit() {
        window.dispatchEvent(new CustomEvent('inventoryUpdate', { detail: this.getSlots() }));
    }
}

export const inventorySystem = new InventorySystem();
