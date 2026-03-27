/**
 * LevelLoader.js
 * 
 * Especialista en Audio y Construcción de Niveles (@game_levels)
 * 
 * Referencia SM64:
 * - levels/: En SM64, los niveles se definen mediante scripts de nivel (script.c) y geometría (geo.c).
 *   Este loader simula el parseo del leveldata y los spawns iniciales.
 *   El formato JSON empleado es extendible y mapea los "macro objetos" y posiciones de spawns.
 */

class LevelLoader {
    constructor() {
        this.currentScene = null;
    }

    /**
     * Carga y parsea el archivo JSON del nivel.
     * @param {string} levelUrl - Ruta del archivo JSON (ej. 'levels/level1.json')
     * @returns {Promise<Object>} Datos del nivel
     */
    async fetchLevelData(levelUrl) {
        try {
            const response = await fetch(levelUrl);
            const levelData = await response.json();
            return levelData;
        } catch (error) {
            console.error(`[LevelLoader] Error cargando nivel desde ${levelUrl}:`, error);
            throw error;
        }
    }

    /**
     * Construye la escena basándose en el JSON definido.
     * @param {Object} levelData - Objeto JSON con la definición del nivel.
     * @returns {Object} Escena construida con entidades
     */
    loadLevel(levelData) {
        console.log(`[LevelLoader] Construyendo nivel: ${levelData.name}`);

        const scene = {
            playerSpawn: null,
            platforms: [],
            collectibles: [],
            enemies: []
        };

        // 1. Posición inicial del jugador (Spawn)
        if (levelData.playerSpawn) {
            scene.playerSpawn = {
                x: levelData.playerSpawn.x,
                y: levelData.playerSpawn.y,
                z: levelData.playerSpawn.z
            };
            console.log(`[LevelLoader] Spawn del jugador en: ${scene.playerSpawn.x}, ${scene.playerSpawn.y}, ${scene.playerSpawn.z}`);
        }

        // 2. Plataformas (Geometría del nivel referenciando geo.c)
        if (levelData.platforms) {
            levelData.platforms.forEach(plat => {
                scene.platforms.push({
                    position: plat.position,
                    size: plat.size,
                    color: plat.color || '#FFFFFF'
                });
            });
            console.log(`[LevelLoader] ${scene.platforms.length} plataformas construidas.`);
        }

        // 3. Coleccionables y enemigos (Macro objetos referenciando script.c)
        if (levelData.collectibles) {
            levelData.collectibles.forEach(col => {
                scene.collectibles.push({
                    position: col.position,
                    type: col.type
                });
            });
            console.log(`[LevelLoader] ${scene.collectibles.length} coleccionables posicionados.`);
        }

        if (levelData.enemies) {
            levelData.enemies.forEach(enemy => {
                scene.enemies.push({
                    position: enemy.position,
                    type: enemy.type
                });
            });
            console.log(`[LevelLoader] ${scene.enemies.length} enemigos posicionados.`);
        }

        this.currentScene = scene;
        return scene;
    }
}

export default LevelLoader;
