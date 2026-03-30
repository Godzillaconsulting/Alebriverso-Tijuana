/**
 * MerchantSystem — Tienda RE4 Style
 * 
 * Integración: detecta NPCs con type='merchant' en el radio de interacción.
 * Al presionar E cerca de uno → abre MerchantModal en vez de DialogBox.
 * 
 * CatalogRegistry: Array de { itemType, price, stock }
 * Reutiliza el sistema de coins de GlobalState como moneda.
 */
import { GlobalState } from './gameState.js';
import { inventorySystem } from './inventory.js';

// ─── CATÁLOGO POR DEFECTO ─────────────────────────────────────────────────────
// Puede ser sobreescrito por el JSON del nivel: npc.catalog = [...]
export const DefaultCatalog = [
    { itemType: 'bolillo',        price: 5,  stock: 10, label: 'Bolillo Curativo' },
    { itemType: 'ammo_light',     price: 3,  stock: 20, label: 'Luz Solar (Munición Atlatl) x5' },
    { itemType: 'obsidian_shard', price: 8,  stock: 10, label: 'Obsidiana (Munición Macuahuitl) x5' },
    { itemType: 'star_fragment',  price: 15, stock: 3,  label: 'Fragmento de Jade Cósmico' },
];

class MerchantSystem {
    constructor() {
        this.isOpen     = false;
        this.catalog    = [...DefaultCatalog];
        this._activeMerchantNPC = null;

        // Escucha el evento del mercader detectado desde movement.js
        window.addEventListener('merchantInteract', (e) => {
            this.open(e.detail.npc);
        });

        window.addEventListener('merchantClose', () => {
            this.close();
        });
    }

    open(npcData) {
        if (this.isOpen) return;
        this.isOpen = true;
        this._activeMerchantNPC = npcData;

        // Si el NPC tiene catálogo propio, usarlo
        if (npcData.catalog && npcData.catalog.length > 0) {
            this.catalog = npcData.catalog;
        } else {
            this.catalog = [...DefaultCatalog];
        }

        window.dispatchEvent(new CustomEvent('merchantOpen', {
            detail: {
                catalog:   this.catalog,
                coins:     GlobalState.coins,
                merchantPos: npcData.mesh ? npcData.mesh.position : null
            }
        }));
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this._activeMerchantNPC = null;
        window.dispatchEvent(new CustomEvent('merchantClosed'));
    }

    /**
     * Compra un ítem del catálogo.
     * @param {number} catalogIndex
     * @returns {{ success: boolean, message: string }}
     */
    buy(catalogIndex) {
        const entry = this.catalog[catalogIndex];
        if (!entry) return { success: false, message: 'Ítem inválido.' };
        if (entry.stock <= 0) return { success: false, message: 'Sin stock.' };
        if (GlobalState.coins < entry.price) {
            return { success: false, message: `Necesitas ${entry.price} monedas.` };
        }

        // Intentar agregar al inventario primero (puede estar lleno)
        const added = inventorySystem.addItem(entry.itemType,
            entry.itemType === 'ammo_light' || entry.itemType === 'obsidian_shard' ? 5 : 1
        );

        if (!added) return { success: false, message: 'Inventario lleno.' };

        // Descontar coins y stock
        GlobalState.coins -= entry.price;
        entry.stock--;

        window.dispatchEvent(new CustomEvent('scoreUpdate', { detail: { score: GlobalState.coins } }));
        window.dispatchEvent(new CustomEvent('merchantItemBought', {
            detail: { catalog: this.catalog, coins: GlobalState.coins }
        }));

        return { success: true, message: `¡Comprado! (${GlobalState.coins} monedas restantes)` };
    }
}

export const merchantSystem = new MerchantSystem();
