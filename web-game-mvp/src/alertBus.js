/**
 * AlertBus — Sistema de IA Grupal / Groupthink
 * 
 * Arquitectura inspirada en RE4: cuando un Ganado detecta al jugador,
 * "grita" y todos los vecinos en el radio entran en modo ALERT.
 * 
 * Diseño:
 *   - AlertBus Singleton: receptor de eventos de detección
 *   - broadcast(origin: Vector3, radius: number, level: AlertLevel):
 *       * Recorre la DLL activa del EnemyPool (acceso via closure al manager)
 *       * Para cada nodo, calcula distancia euclidiana al origin
 *       * Si dentro del radio → eleva AlertLevel y escribe lastKnownPlayerPos
 *   - Los estados FSM de enemies.js leen userData.alertLevel en cada frame
 *
 * AlertLevel enum:
 *   CALM = 0    → patrullar normalmente
 *   SUSPICIOUS = 1 → moverse hacia lastKnownPlayerPos (Resident Evil 1 style)
 *   COMBAT = 2  → CHASE activo
 */
import * as THREE from 'three';

export const AlertLevel = Object.freeze({
    CALM:       0,
    SUSPICIOUS: 1,
    COMBAT:     2
});

class AlertBus {
    constructor() {
        // Referencia al EnemyManager inyectada en tiempo de ejecución
        this._enemyManager = null;
        
        // Cache del último frame de broadcast para evitar spam
        this._lastBroadcastTime = 0;
        this._broadcastCooldown = 0.4; // segundos mínimos entre broadcasts
        this._clock = { elapsed: 0 };
        
        // Vector reutilizable para cálculo de distancias (evita 'new' en loop)
        this._tempVec = new THREE.Vector3();
    }

    /**
     * Inyectar referencia al EnemyManager DESPUÉS de su creación.
     * (Inversión de dependencias para evitar imports circulares)
     */
    register(enemyManager) {
        this._enemyManager = enemyManager;
        console.log('[AlertBus] EnemyManager registrado.');
    }

    /**
     * Tick del reloj interno (llamar desde main.js update)
     */
    tick(delta) {
        this._clock.elapsed += delta;
    }

    /**
     * Notifica a todos los enemigos en radio que el jugador fue detectado.
     * @param {THREE.Vector3} origin     - Posición del enemigo que detectó
     * @param {THREE.Vector3} playerPos  - Última posición conocida del jugador
     * @param {number}        radius     - Radio de alerta en unidades del mundo
     * @param {AlertLevel}    level      - Nivel de alerta a propagar
     */
    broadcast(origin, playerPos, radius = 15.0, level = AlertLevel.SUSPICIOUS) {
        if (!this._enemyManager) return;
        
        // Throttling: evitar broadcast cada frame
        if (this._clock.elapsed - this._lastBroadcastTime < this._broadcastCooldown) return;
        this._lastBroadcastTime = this._clock.elapsed;

        let notified = 0;
        const radiusSq = radius * radius;

        // Recorrer DLL activa de EnemyPool — O(n) donde n ≤ 64
        let cur = this._enemyManager._pool.activeHead;
        while (cur) {
            const group = cur.group;
            if (group && group.userData.state !== 'DEAD') {
                // Cálculo de distancia sin sqrt usando distanceToSquared
                this._tempVec.copy(group.position);
                const distSq = this._tempVec.distanceToSquared(origin);
                
                if (distSq <= radiusSq) {
                    // Solo eleva el nivel — nunca lo baja en broadcast
                    if ((group.userData.alertLevel || AlertLevel.CALM) < level) {
                        group.userData.alertLevel = level;
                        group.userData.lastKnownPlayerPos = playerPos.clone();
                        notified++;
                    }
                }
            }
            cur = cur.next;
        }

        if (notified > 0) {
            console.info(`[AlertBus] Alerta Nivel ${level} → ${notified} enemigos en radio ${radius}u`);
        }
    }

    /**
     * Baja el alertLevel de TODOS los enemigos gradualmente (se calman).
     * Llamar periódicamente desde el update del EnemyManager.
     * @param {number} delta
     */
    calmDown(delta) {
        if (!this._enemyManager) return;
        
        let cur = this._enemyManager._pool.activeHead;
        while (cur) {
            const group = cur.group;
            if (group && group.userData.alertLevel > AlertLevel.CALM) {
                // Se calman 1 nivel cada 8 segundos (RE4 tiene timers similares)
                group.userData.alertCalmTimer = (group.userData.alertCalmTimer || 0) + delta;
                if (group.userData.alertCalmTimer > 8.0) {
                    group.userData.alertLevel = Math.max(AlertLevel.CALM, group.userData.alertLevel - 1);
                    group.userData.alertCalmTimer = 0;
                }
            }
            cur = cur.next;
        }
    }
}

// Singleton global
export const alertBus = new AlertBus();
