/**
 * ObjectPool<T> — Pool Genérico de Alto Rendimiento
 * 
 * Arquitectura: Stack (LIFO) de Objetos Pre-asignados
 * acquire() → O(1)  pop del stack
 * release() → O(1)  push al stack
 * 
 * Elimina presión al GC evitando `new` / `delete` en el game loop.
 * Usado por: Partículas VFX, Proyectiles, SFX Nodes.
 */
export class ObjectPool {
    /**
     * @param {() => T} factory - Función creadora del objeto
     * @param {(obj: T) => void} reset - Función de limpieza al reciclar
     * @param {number} initialSize - Tamaño inicial del pool
     */
    constructor(factory, reset, initialSize = 16) {
        this._factory = factory;
        this._reset = reset;

        // Stack interno (Array como stack LIFO para O(1) push/pop)
        this._pool = [];
        this._activeCount = 0;
        this._totalCreated = 0;

        // Pre-calentar el pool con objetos iniciales
        for (let i = 0; i < initialSize; i++) {
            this._pool.push(this._factory());
            this._totalCreated++;
        }
    }

    /**
     * Adquiere un objeto del pool (O(1))
     * Si el pool está vacío, expande creando uno nuevo.
     * @returns {T}
     */
    acquire() {
        let obj;
        if (this._pool.length > 0) {
            obj = this._pool.pop(); // O(1) LIFO
        } else {
            // Pool exhausto: expande sin bloquear
            obj = this._factory();
            this._totalCreated++;
            console.warn(`[ObjectPool] Expanding pool. Total created: ${this._totalCreated}`);
        }
        this._activeCount++;
        return obj;
    }

    /**
     * Regresa un objeto al pool para reutilización (O(1))
     * @param {T} obj
     */
    release(obj) {
        if (obj === null || obj === undefined) return;
        this._reset(obj); // Limpiar estado antes de reutilizar
        this._pool.push(obj); // O(1) push
        this._activeCount--;
    }

    /**
     * Estadísticas de diagnóstico (Debug HUD)
     */
    get stats() {
        return {
            available: this._pool.length,
            active: this._activeCount,
            totalCreated: this._totalCreated
        };
    }

    /**
     * Vacía el pool liberando todos los objetos.
     * @param {(obj: T) => void} disposeFn - Función para liberar VRAM (geometry.dispose, etc.)
     */
    dispose(disposeFn) {
        if (disposeFn) {
            this._pool.forEach(disposeFn);
        }
        this._pool.length = 0;
        this._activeCount = 0;
    }
}
