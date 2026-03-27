/**
 * LootSystem — Sistema de Drops de Enemigos (RE4 Grade)
 * 
 * RE4: Cada tipo de ganado tiene una tabla de probabilidades con loot diferente.
 * Aquí usamos una WeightedLootTable por spriteType.
 * 
 * Arquitectura:
 *   LOOT_TABLES: Map<spriteType, LootEntry[]>
 *   LootEntry: { itemType, weight, count }
 *   dropLoot(spriteType, position): selección pseudoaleatoria weighted O(n)
 * 
 * Result: Se llama a inventorySystem.addItem O al spawnCollectible 3D
 * dependiendo si el jugador está cerca (pick-up automático si < 3u).
 */
import * as THREE from 'three';
import { inventorySystem } from './inventory.js';
import MaterialManager from './materialManager.js';

// ─── TABLAS DE LOOT POR TIPO DE ENEMIGO ──────────────────────────────────────
// Cada entrada: { itemType, weight, count }
// weight = probabilidad relativa (se normaliza en runtime)
const LOOT_TABLES = new Map([
    ['aldeano_azteca',   [
        { itemType: 'health_herb',    weight: 20, count: 1 },
        { itemType: 'ammo_light',     weight: 40, count: 3 },
        { itemType: 'obsidian_shard', weight: 30, count: 2 },
        { itemType: null,             weight: 10, count: 0 }, // Drop vacío
    ]],
    ['jaguar',           [
        { itemType: 'obsidian_shard', weight: 35, count: 3 },
        { itemType: 'health_herb',    weight: 15, count: 1 },
        { itemType: 'ammo_light',     weight: 30, count: 5 },
        { itemType: null,             weight: 20, count: 0 },
    ]],
    ['serpiente',        [
        { itemType: 'health_herb',    weight: 50, count: 2 },
        { itemType: 'obsidian_shard', weight: 30, count: 1 },
        { itemType: null,             weight: 20, count: 0 },
    ]],
    ['colibri',          [
        { itemType: 'star_fragment',  weight: 15, count: 1 },
        { itemType: 'ammo_light',     weight: 50, count: 5 },
        { itemType: 'health_herb',    weight: 20, count: 1 },
        { itemType: null,             weight: 15, count: 0 },
    ]],
    ['huitzilopochtli',  [
        { itemType: 'star_fragment',  weight: 40, count: 1 },
        { itemType: 'health_herb',    weight: 30, count: 2 },
        { itemType: 'obsidian_shard', weight: 30, count: 5 },
    ]],
    ['guerrero_aguila',  [
        { itemType: 'obsidian_shard', weight: 40, count: 4 },
        { itemType: 'health_herb',    weight: 25, count: 1 },
        { itemType: 'ammo_light',     weight: 25, count: 5 },
        { itemType: null,             weight: 10, count: 0 },
    ]],
]);

// Tabla deafult para spriteTypes no registrados
const DEFAULT_TABLE = [
    { itemType: 'ammo_light', weight: 60, count: 3 },
    { itemType: 'health_herb', weight: 20, count: 1 },
    { itemType: null, weight: 20, count: 0 },
];

/**
 * Selección pesada pseudoaleatoria (Weighted Random O(n))
 * @param {LootEntry[]} table
 * @returns {LootEntry}
 */
function weightedRandom(table) {
    const totalWeight = table.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of table) {
        roll -= entry.weight;
        if (roll <= 0) return entry;
    }
    return table[table.length - 1];
}

class LootSystem {
    constructor() {
        this._scene    = null;
        this._player   = null;
        // Pool visual de drops físicos en el mundo: Array de { mesh, itemType, count, life }
        this._worldDrops = [];
    }

    /** Inyectar referencias después de init (evitar circulares) */
    register(scene, player) {
        this._scene  = scene;
        this._player = player;
    }

    /**
     * Ejecuta el drop de un enemigo muerto.
     * @param {string} spriteType - Tipo del enemigo
     * @param {THREE.Vector3} position - Posición del drop en el mundo
     */
    dropLoot(spriteType, position) {
        const table  = LOOT_TABLES.get(spriteType) || DEFAULT_TABLE;
        const result = weightedRandom(table);

        if (!result.itemType) return; // Tiró "vacío"

        // Si el jugador está cerca (< 4u) → auto-pickup sin mesh
        if (this._player) {
            const dist = position.distanceTo(this._player.mesh.position);
            if (dist < 4.0) {
                inventorySystem.addItem(result.itemType, result.count);
                console.log(`[LootSystem] Auto-pickup: ${result.count}x ${result.itemType}`);
                return;
            }
        }

        // Sino → spawnear orbe brillante en el mundo (pickup al acercarse)
        this._spawnWorldDrop(result.itemType, result.count, position);
    }

    /**
     * Crea un orbe visual de drop en el mundo.
     * @private
     */
    _spawnWorldDrop(itemType, count, position) {
        if (!this._scene) return;

        // Color por tipo de ítem
        const colors = {
            'health_herb':    0x00ff88,
            'ammo_light':     0xffaa00,
            'obsidian_shard': 0x8844ff,
            'star_fragment':  0xffff00,
            'key':            0x00ffff,
        };

        const color = colors[itemType] || 0xffffff;
        const geo   = new THREE.SphereGeometry(0.3, 8, 8);
        const mat   = MaterialManager.getMaterial({
            color,
            emissive: color,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position).add(new THREE.Vector3(
            (Math.random() - 0.5) * 1.5, 0.5,
            (Math.random() - 0.5) * 1.5
        ));
        mesh.userData = { isDrop: true, itemType, count };
        this._scene.add(mesh);

        this._worldDrops.push({ mesh, itemType, count, life: 15.0 }); // 15s antes de desaparecer
        console.log(`[LootSystem] Spawned drop: ${count}x ${itemType} at world`);
    }

    /**
     * Llamar desde el game loop. Detecta colisión jugador-drop y hace bob animation.
     * @param {number} delta
     */
    update(delta) {
        if (!this._player) return;
        const playerPos = this._player.mesh.position;
        const t = Date.now() * 0.002;

        for (let i = this._worldDrops.length - 1; i >= 0; i--) {
            const drop = this._worldDrops[i];
            drop.life -= delta;

            // Parpadeo al expirar (últimos 3 segundos)
            if (drop.life < 3.0) {
                drop.mesh.visible = Math.sin(t * 10) > 0;
            }

            if (drop.life <= 0) {
                this._scene.remove(drop.mesh);
                drop.mesh.geometry.dispose();
                drop.mesh.material.dispose();
                this._worldDrops.splice(i, 1);
                continue;
            }

            // Bob flotante
            drop.mesh.position.y = drop.mesh.userData._baseY
                = (drop.mesh.userData._baseY || drop.mesh.position.y);
            drop.mesh.position.y = drop.mesh.userData._baseY + Math.sin(t + i) * 0.2;
            drop.mesh.rotation.y += delta * 2.0;

            // Detección de pickup (radio 1.5u)
            const dist = drop.mesh.position.distanceTo(playerPos);
            if (dist < 1.5) {
                inventorySystem.addItem(drop.itemType, drop.count);
                this._scene.remove(drop.mesh);
                drop.mesh.geometry.dispose();
                drop.mesh.material.dispose();
                this._worldDrops.splice(i, 1);
                window.dispatchEvent(new CustomEvent('itemPickedUp', {
                    detail: { itemType: drop.itemType, count: drop.count }
                }));
            }
        }
    }
}

export const lootSystem = new LootSystem();
