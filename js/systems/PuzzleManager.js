/**
 * PuzzleManager.js
 * Orquestador de Switches (Interruptores) y Puertas.
 * Permite agrupar altares/interruptores que abren puertas gigantes al ser aplastados con Ground Pound.
 */
export default class PuzzleManager {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.switches = [];
        this.doors = [];
        this.activeGroups = new Set();
    }

    registerSwitch(platform) {
        platform.isActivated = false;
        platform.originalY = platform.position.y;
        this.switches.push(platform);
    }

    registerDoor(platform) {
        platform.isOpen = false;
        platform.originalY = platform.position.y;
        this.doors.push(platform);
    }

    checkGroundPound(player) {
        let activatedAny = false;

        for (const sw of this.switches) {
            if (sw.isActivated) continue;
            
            const dx = player.x - sw.position.x;
            const dz = player.z - sw.position.z;
            const dist = Math.hypot(dx, dz);
            
            // Asumiendo tamaño del altar (aprox 4x4)
            if (dist < 3.5) {
                // Checar que el jugador cayó sobre él (Hitbox Y)
                if (player.y >= sw.position.y - 1.0 && player.y <= sw.position.y + 4.0) {
                    sw.isActivated = true;
                    activatedAny = true;
                    
                    if (this.audioManager) this.audioManager.playThudSynthesized();
                    
                    // Comprobar si completaste el rompecabezas de esta puerta
                    this._checkGroupCompletion(sw.puzzleGroup);
                }
            }
        }

        if (activatedAny) {
            // Un pequeño rebote al hacer Ground Pound sobre un switch
            // player.vy = player.jumpForce * 0.5;
            // player.currentState = player.STATES.NORMAL;
        }
    }

    _checkGroupCompletion(groupName) {
        if (!groupName) return;
        
        // Filtrar todos los switches que abren la misma puerta
        const groupSwitches = this.switches.filter(s => s.puzzleGroup === groupName);
        
        // ¿Están todos pisados?
        const allActive = groupSwitches.every(s => s.isActivated);
        
        if (allActive && !this.activeGroups.has(groupName)) {
            this.activeGroups.add(groupName);
            console.log(`[PuzzleManager] ¡Puzzle ${groupName} resuelto! Abriendo puertas...`);
            
            // Abrir las puertas con esa ID
            for (const door of this.doors) {
                if (door.id === groupName) {
                    door.isOpen = true;
                    if (this.audioManager) {
                        this.audioManager.playCoinSynthesized(); // Sonido provisional brillante ("The Legend of Zelda" Chime)
                    }
                }
            }
        }
    }

    update(dt) {
        // 1. Animar interruptores que bajan al ser pisados
        for (const sw of this.switches) {
            if (sw.isActivated) {
                // Se sume 0.8 metros en la tierra
                const targetY = sw.originalY - 0.8;
                if (sw.position.y > targetY + 0.01) {
                    // Animación tipo resorte pesado
                    sw.position.y -= Math.max(0.5, (sw.position.y - targetY) * 5) * dt;
                    sw.meshNode.position.y = sw.position.y;
                }
            }
        }

        // 2. Animar puertas abriéndose deslizando (ej. targetY -3)
        for (const door of this.doors) {
            if (door.isOpen) {
                if (door.position.y > door.targetY + 0.01) {
                    door.position.y -= 2.5 * dt; // Caída constante pesada
                    door.meshNode.position.y = door.position.y;
                }
            }
        }
    }
}
