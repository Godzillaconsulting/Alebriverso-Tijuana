import * as THREE from 'three';
import { spatialGrid } from './spatialHash.js';
import { collidables } from './assets.js';

/**
 * ============================================================
 *  A* Pathfinding & NavMesh Generator — The Tijuana Engine
 * ============================================================
 * Generates an implicit 2.5D grid by querying the SpatialHashGrid.
 * It uses Downward Raycasts to find the floor height of each cell.
 * Connections between cells are valid if the Height Delta < 2.5m (Jumpable).
 */

class NavNode {
    constructor(cx, cz, y) {
        this.cx = cx;
        this.cz = cz;
        this.y = y; // Elevación del terreno
        this.worldPos = new THREE.Vector3(cx * 8 + 4, y, cz * 8 + 4); // Centro de celda (cellSize = 8)
        
        // A* properties
        this.g = 0;
        this.h = 0;
        this.f = 0;
        this.parent = null;
        this.isWall = y === -999; 
    }
}

export class NavMeshGenerator {
    constructor() {
        this.cellSize = 4; // Sub-dividimos la cuadrícula espacial (8) a la mitad para mayor fidelidad (4x4)
        this.nodes = new Map(); // "cx,cz" -> NavNode
        this._raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 100);
    }

    // Purgar y Escanear (Llamar tras cargar el nivel)
    build() {
        this.nodes.clear();
        console.log("[NavMesh] Escaneando topología del nivel...");
        
        // Determinar límites del mundo basándonos en los collidables
        let minX = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxZ = -Infinity;
        
        collidables.forEach(mesh => {
            mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
            if (box.min.x < minX) minX = box.min.x;
            if (box.min.z < minZ) minZ = box.min.z;
            if (box.max.x > maxX) maxX = box.max.x;
            if (box.max.z > maxZ) maxZ = box.max.z;
        });

        // Cell bounds
        const startCX = Math.floor(minX / this.cellSize);
        const startCZ = Math.floor(minZ / this.cellSize);
        const endCX = Math.ceil(maxX / this.cellSize);
        const endCZ = Math.ceil(maxZ / this.cellSize);

        for (let x = startCX; x <= endCX; x++) {
            for (let z = startCZ; z <= endCZ; z++) {
                const worldX = x * this.cellSize + (this.cellSize / 2);
                const worldZ = z * this.cellSize + (this.cellSize / 2);
                
                // Raycast desde las alturas para hallar el piso
                this._raycaster.ray.origin.set(worldX, 50, worldZ);
                const hits = this._raycaster.intersectObjects(collidables, true);
                
                let floorY = -999;
                if (hits.length > 0) {
                    floorY = hits[0].point.y;
                }
                
                this.nodes.set(`${x},${z}`, new NavNode(x, z, floorY));
            }
        }
        console.log(`[NavMesh] Construcción finalizada: ${this.nodes.size} nodos topológicos generados.`);
    }

    _getNode(x, z) {
        // Interfaz segura
        return this.nodes.get(`${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`);
    }

    _getNeighbors(node) {
        const neighbors = [];
        const offsets = [
            [0, 1], [1, 0], [0, -1], [-1, 0], // Cardinales
            [1, 1], [-1, 1], [1, -1], [-1, -1] // Diagonales
        ];

        for (let o of offsets) {
            const n = this.nodes.get(`${node.cx + o[0]},${node.cz + o[1]}`);
            if (n && !n.isWall) {
                // Verificar Slope / Salto (RE4 jump delta ~ 2.0u)
                if (Math.abs(n.y - node.y) < 2.5) {
                    neighbors.push(n);
                }
            }
        }
        return neighbors;
    }

    // === ALGORITMO A* ===
    findPath(startPos, endPos) {
        if (this.nodes.size === 0) return [endPos]; // Fallback si no hay NavMesh (Dev/Test)

        const startNode = this._getNode(startPos.x, startPos.z);
        const endNode = this._getNode(endPos.x, endPos.z);

        if (!startNode || !endNode || endNode.isWall) {
            return [endPos]; // Fallback straight line
        }

        const openSet = [];
        const closedSet = new Set();
        openSet.push(startNode);
        
        // Reset properties
        this.nodes.forEach(n => { n.g = 0; n.h = 0; n.f = 0; n.parent = null; });

        while (openSet.length > 0) {
            // Nodo con el menor F cost
            let lowestIdx = 0;
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < openSet[lowestIdx].f) lowestIdx = i;
            }
            
            let current = openSet[lowestIdx];

            // Llegamos al objetivo
            if (current === endNode) {
                const path = [];
                let temp = current;
                while (temp.parent) {
                    path.push(temp.worldPos.clone());
                    temp = temp.parent;
                }
                return path.reverse(); // Array Vector3 desde Start -> End
            }

            openSet.splice(lowestIdx, 1);
            closedSet.add(current);

            const neighbors = this._getNeighbors(current);
            for (let neighbor of neighbors) {
                if (closedSet.has(neighbor)) continue;

                const tentativeG = current.g + current.worldPos.distanceTo(neighbor.worldPos);

                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                } else if (tentativeG >= neighbor.g) {
                    continue; // Peor ruta abortada
                }

                // Matemática G, H, F
                neighbor.parent = current;
                neighbor.g = tentativeG;
                // Heurística Lineal Euclidiana 3D (Z-Aware)
                neighbor.h = neighbor.worldPos.distanceTo(endNode.worldPos);
                neighbor.f = neighbor.g + neighbor.h;
            }
        }

        // Si no hay ruta lógica, retornar la línea recta tradicional
        return [endPos];
    }
}

export const navMesh = new NavMeshGenerator();
