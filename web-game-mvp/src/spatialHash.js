/**
 * SpatialHashGrid — Particionamiento Espacial O(1) para Colisiones
 * 
 * Arquitectura:
 *   grid: Map<string, Set<Mesh>>
 *     key = "cellX,cellZ"  (enteros discretos)
 *     value = Set de meshes en esa celda
 * 
 * Complejidad:
 *   insert(mesh)  → O(1)
 *   remove(mesh)  → O(1) con referencia directa
 *   query(x, z)   → O(k) donde k = objetos en ~9 celdas vecinas
 *                   vs O(n) del array plano anterior
 * 
 * Inspiración: SM64 usa particionamiento de objetos por ObjNode linked list
 * por sector. Nosotros lo modernizamos con hash grid continuo.
 */
export class SpatialHashGrid {
    /**
     * @param {number} cellSize - Tamaño de cada celda en unidades del mundo (default: 8)
     */
    constructor(cellSize = 8) {
        this.cellSize = cellSize;
        // Map<cellKey:string, Set<Mesh>>
        this._grid = new Map();
        // Index inverso: Map<mesh, Set<cellKey>>  para remoción O(1)
        this._meshCells = new Map();
        this._insertCount = 0;
    }

    /**
     * Convierte coordenada de mundo a celda discreta
     * @param {number} val
     * @returns {number}
     */
    _toCell(val) {
        return Math.floor(val / this.cellSize);
    }

    /**
     * Genera clave de celda string para hashmap
     */
    _key(cx, cz) {
        return `${cx},${cz}`;
    }

    /**
     * Inserta un mesh en la celda correspondiente a su posición XZ actual.
     * Un mesh puede ocupar varias celdas si su bounding box es grande.
     * @param {THREE.Object3D} mesh
     */
    insert(mesh) {
        // Calcular celdas que ocupa el mesh con su BBox
        const cells = this._getCellsForMesh(mesh);
        const meshCellSet = new Set();

        cells.forEach(key => {
            if (!this._grid.has(key)) {
                this._grid.set(key, new Set());
            }
            this._grid.get(key).add(mesh);
            meshCellSet.add(key);
        });

        this._meshCells.set(mesh, meshCellSet);
        this._insertCount++;
    }

    /**
     * Remueve un mesh de todas sus celdas. O(celdas_ocupadas) ≈ O(1) para objetos pequeños.
     * @param {THREE.Object3D} mesh
     */
    remove(mesh) {
        const cellKeys = this._meshCells.get(mesh);
        if (!cellKeys) return;

        cellKeys.forEach(key => {
            const cell = this._grid.get(key);
            if (cell) {
                cell.delete(mesh);
                // Limpiar celda vacía para no desperdiciar memoria
                if (cell.size === 0) {
                    this._grid.delete(key);
                }
            }
        });

        this._meshCells.delete(mesh);
    }

    /**
     * Consulta todos los meshes en las celdas vecinas a una posición XZ.
     * @param {number} x - Coordenada mundo X
     * @param {number} z - Coordenada mundo Z
     * @param {number} range - Cuántas celdas de radio buscar (default: 1 → 3x3 = 9 celdas)
     * @returns {Set<THREE.Object3D>} Meshes candidatos para colisión
     */
    query(x, z, range = 1) {
        const cx = this._toCell(x);
        const cz = this._toCell(z);
        const results = new Set();

        for (let dx = -range; dx <= range; dx++) {
            for (let dz = -range; dz <= range; dz++) {
                const key = this._key(cx + dx, cz + dz);
                const cell = this._grid.get(key);
                if (cell) {
                    cell.forEach(mesh => results.add(mesh));
                }
            }
        }
        return results;
    }

    /**
     * Retorna array de candidatos (para compatibilidad con el Raycaster existente)
     * @param {number} x
     * @param {number} z
     * @param {number} range
     * @returns {THREE.Object3D[]}
     */
    queryArray(x, z, range = 1) {
        return Array.from(this.query(x, z, range));
    }

    /**
     * Calcula las celdas que ocupa un mesh según su BoundingBox
     * @private
     */
    _getCellsForMesh(mesh) {
        const keys = [];

        // Intentar usar bounding box si ya fue computado
        if (mesh.geometry) {
            mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox;
            if (box) {
                const world = box.clone().applyMatrix4(mesh.matrixWorld);
                const minCX = this._toCell(world.min.x);
                const maxCX = this._toCell(world.max.x);
                const minCZ = this._toCell(world.min.z);
                const maxCZ = this._toCell(world.max.z);

                for (let cx = minCX; cx <= maxCX; cx++) {
                    for (let cz = minCZ; cz <= maxCZ; cz++) {
                        keys.push(this._key(cx, cz));
                    }
                }
                return keys;
            }
        }

        // Fallback: usar solo la posición del mesh
        const cx = this._toCell(mesh.position.x);
        const cz = this._toCell(mesh.position.z);
        keys.push(this._key(cx, cz));
        return keys;
    }

    /**
     * Vacía el grid completamente (llamar en transición de nivel)
     */
    clear() {
        this._grid.clear();
        this._meshCells.clear();
        this._insertCount = 0;
    }

    /** Diagnóstico: número de celdas activas */
    get cellCount() { return this._grid.size; }
    /** Diagnóstico: número de meshes indexados */
    get meshCount() { return this._meshCells.size; }
}

// Instancia Global del Motor (Singleton)
export const spatialGrid = new SpatialHashGrid(8);
