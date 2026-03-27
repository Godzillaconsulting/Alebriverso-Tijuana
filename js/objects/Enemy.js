import * as THREE from 'three';

/**
 * Mapa de assets PNG por tipo de enemigo.
 * Referencia: assets/sprites/ en el directorio raíz del proyecto.
 * REPLACE Goombas/Koopas SM64 → Entidades mesoamericanas propias.
 */
const SPRITE_MAP = {
    'jaguar':           'assets/sprites/jaguar.png',
    'guerrero_aguila':  'assets/sprites/guerrero_aguila.png',
    'serpiente':        'assets/sprites/serpiente.png',
    'aldeano_azteca':   'assets/sprites/aldeano_azteca.png',
    'colibri':          'assets/sprites/colibri.png',
    'huitzilopochtli':  'assets/sprites/huitzilopochtli.png',
    'default':          'assets/sprites/jaguar.png'
};

const _texLoader = new THREE.TextureLoader();

/**
 * Tipo de enemigo — afecta las decisiones de la IA en combate.
 * RE4 analogía: Ganado Melee vs Ganado Ballesta.
 */
export const EnemyType = {
    MELEE:  'MELEE',   // Jaguar, Serpiente — cuerpo a cuerpo
    RANGED: 'RANGED',  // Guerrero Águila — mantiene distancia, lanza proyectil
};

/**
 * Tabla de drops por tipo de enemigo.
 * RE4: los Ganados dropean Pesetas/Hierba — nosotros: Cacao / Obsidiana.
 * Formato: [ { type, chance }, ... ] donde chance ∈ [0,1]
 */
const DROP_TABLE = {
    [EnemyType.MELEE]:  [ { type: 'cacao', chance: 0.7 }, { type: 'obsidian', chance: 0.15 } ],
    [EnemyType.RANGED]: [ { type: 'cacao', chance: 0.5 }, { type: 'obsidian', chance: 0.30 } ]
};

/**
 * ENEMY: Guerrero Jaguar (IA Estilo RE4 / PS2-era)
 * ──────────────────────────────────────────────────────────────────────────────
 * Inspirado en:
 *   actors/goomba.c       → Patrullaje lineal, detección por radio
 *   actors/koopa.c        → Persecución + retornoo al waypoint base
 *   object_helpers.c      → obj_rotate_yaw_toward(), cur_obj_move_standard()
 *   behavior_data.c       → bhvGoomba, bhvKoopaWithoutShell
 *
 * Diseño Tijuana Engine (Estilo RE4 PS2-era):
 *   - IDLE        → espera, busca sonidos o movimiento ambiental
 *   - ALERT       → escuchó algo, gira la cabeza buscando
 *   - PATROL      → camina por waypoints definidos (no todo el terreno)
 *   - INVESTIGATE → fue al último lugar donde vio/oyó al jugador (sin LOS)
 *   - CHASE       → tiene Line-Of-Sight del jugador, persecución activa
 *   - STRAFE      → rodea al jugador para flanquear (mecánica característica RE4)
 *   - ATTACK      → embate cuerpo a cuerpo con telegraph animation
 *   - STAGGERED   → golpeado, tambalea antes de recuperar
 *   - DEAD        → animación de caída procedural
 */

const EnemyState = {
    IDLE:         'IDLE',
    ALERT:        'ALERT',
    PATROL:       'PATROL',
    INVESTIGATE:  'INVESTIGATE',
    CHASE:        'CHASE',
    STRAFE:       'STRAFE',
    ATTACK:       'ATTACK',
    STAGGERED:    'STAGGERED',
    DEAD:         'DEAD'
};

export class Enemy {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Vector3} position
     * @param {Object} [config]  Parámetros opcionales para balancear dificultad
     * @param {THREE.Vector3[]} [config.waypoints]  Ruta de patrullaje manual
     * @param {number}  [config.health]      Default 3
     * @param {number}  [config.speed]       Default 4.5
     * @param {number}  [config.visionDist]  Default 14
     * @param {number}  [config.hearDist]    Default 6
     * @param {Object}  [scoreSystem]        Para sumar puntos al morir
     */
    constructor(scene, position, config = {}, scoreSystem = null) {
        this.scene       = scene;
        this.scoreSystem = scoreSystem;
        this.type        = config.enemyType ?? EnemyType.MELEE;

        this.startPosition = new THREE.Vector3().copy(position);
        this.lastKnownPlayerPos = null;

        this.currentState   = EnemyState.IDLE;
        this.stateTimer     = 0;
        this.alertTimer     = 0;
        this.attackCooldown = 0;
        this.rangedCooldown = 0;  // Solo usado por RANGED
        this._alertBroadcasted = false; // Evitar spam de alertBus
        this._pendingAlertPos = null; // Posición de alerta recibida del AlertBus

        // ── Estadísticas balanceadas (ajustables por config) ───────────────────────────────────
        // RANGED tiene menos salud pero más visión (francotirador mesoamericano)
        const isRanged = this.type === EnemyType.RANGED;
        this.health     = config.health    ?? (isRanged ? 2 : 3);
        this.moveSpeed  = config.speed     ?? (isRanged ? 3.0 : 4.5);
        this.rotSpeed   = 6.0;
        this.preferDist = isRanged ? 10.0 : 0;  // Distancia preferida para RANGED

        // Rangos de detección (RE4 los descompone en visión + audio)
        // RANGED: visión mucho mayor, el águila ve desde lejos
        this.visionDistSq  = (config.visionDist ?? (isRanged ? 22 : 14)) ** 2;
        this.hearDistSq    = (config.hearDist   ??  6) ** 2;
        this.attackDistSq  = (config.attackDist ?? (isRanged ? 12 : 2.2)) ** 2;
        this.loseDistSq    = ((config.visionDist ?? (isRanged ? 22 : 14)) * 1.5) ** 2;

        // ── Waypoints de patrullaje ──────────────────────────────────────────
        // Si no se pasan, genera 2 puntos simples a ±5u del spawn (No todo el esc.)
        this.waypoints = config.waypoints ?? [
            new THREE.Vector3(position.x + 5, position.y, position.z),
            new THREE.Vector3(position.x - 5, position.y, position.z)
        ];
        this.currentWaypoint = 0;

        // ── Mesh: Billboard Sprite desde PNG oficial del proyecto ─────────────────────────
        // Reemplaza completamente la geometría de placeholder SM64 (goomastigma caja/cápsula)
        // por el sprite mesoamericano real del artista.
        //
        // Referencia SM64: actors/goomba.c cargaba una textura de 16×16 sobre un plano.
        // Aquí usamos THREE.Sprite (billboard automático, siempre enfrenta la cámara).

        const spritePath = SPRITE_MAP[config.spriteType ?? 'default'] ?? SPRITE_MAP.default;
        this.spriteMat = new THREE.SpriteMaterial({
            map:         _texLoader.load(spritePath),
            transparent: true,
            alphaTest:   0.05,      // Recortar píxeles transparentes
            depthWrite:  false      // Evitar z-fighting contra el suelo
        });

        this.mesh = new THREE.Sprite(this.spriteMat);
        this.mesh.scale.set(2.5, 2.5, 1); // Escala base; se ajusta al aspecto real cuando carga
        this.mesh.position.copy(position);
        this.mesh.position.y += 1.25; // Centrar verticalmente sobre su hitbox

        // Ajustar escala al aspecto real de la textura cuando termine de cargar
        this.spriteMat.map.addEventListener('loaded', () => {
            const img = this.spriteMat.map.image;
            if (img) {
                const aspect = img.width / img.height;
                this.mesh.scale.set(2.5 * aspect, 2.5, 1);
            }
        });

        // Nodo de posición física invisible (hitbox) — separado del sprite visual
        this.hitbox = new THREE.Object3D();
        this.hitbox.position.copy(position);
        scene.add(this.hitbox);

        // Usar hitbox como nodo padre de la posición; el sprite sólo sigue en update()
        scene.add(this.mesh);

        this.position = position.clone(); // Posición lógica (reemplaza this.mesh.position direct.)
        this.facingDir  = new THREE.Vector3(0, 0, 1); // Dirección de vista lógica para LOS
        this.targetQuaternion = new THREE.Quaternion();
        this.active = true;

        // Suscribirse al AlertBus si existe
        if (window.alertBus) {
            window.alertBus.subscribe(this.onAlertReceived.bind(this));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Devuelve la posición Three.Vector3 del jugador sin importar tipo */
    _playerPos(player) {
        return player.mesh
            ? player.mesh.position
            : new THREE.Vector3(player.x, player.y, player.z);
    }

    /** Rotación suave de la posición lógica hacia un objetivo (no el sprite) */
    _rotateTowards(targetPos, dt) {
        const dir = new THREE.Vector3()
            .subVectors(targetPos, this.position);
        dir.y = 0;
        if (dir.lengthSq() < 0.001) return dir;
        dir.normalize();
        // Guardar dirección para cálculos de LOS (sprites no tienen quaternion real)
        this.facingDir.copy(dir);
        return dir;
    }

    /**
     * Cono de visión 120° usando la dirección de movimiento real del sprite.
     * RE4: los ganados no te ven si estás exactamente detrás.
     */
    _hasLOS(playerPos) {
        const toPlayer = new THREE.Vector3()
            .subVectors(playerPos, this.position); // Usa posición lógica
        if (toPlayer.lengthSq() > this.visionDistSq) return false;
        toPlayer.normalize();
        // facingDir se actualiza en _rotateTowards() cada frame
        return this.facingDir.dot(toPlayer) > 0.35; // ~110° apertura
    }

    /** Detección por sonido omnidireccional */
    _hearsPlayer(playerPos) {
        return this.position.distanceToSquared(playerPos) < this.hearDistSq;
    }

    /** Estado limpio */
    _setState(s) {
        this.currentState = s;
        this.stateTimer = 0;
    }

    /**
     * Tinte de sprite según alerta (reemplaza el antiguo set de ojos,
     * que ya no existe porque el render es un Sprite PNG).
     * colors: 0xff4400=idle, 0xffff00=alert, 0xff0000=chase, 0xff9955=investigate
     */
    _setEyeColor(hex) {
        if (this.spriteMat) this.spriteMat.color.setHex(hex);
    }

    /**
     * Emite una alerta al AlertBus global para que otros enemigos reaccionen.
     * @param {THREE.Vector3} pos La posición del jugador que causó la alerta.
     * @param {number} [radius=20] Radio de la alerta.
     * @param {boolean} [isAggressive=true] Si la alerta es de agresión (CHASE) o sospecha (INVESTIGATE).
     */
    _broadcastAlert(pos, radius = 20, isAggressive = true) {
        if (window.alertBus && !this._alertBroadcasted) {
            window.alertBus.dispatch({
                source: this.position.clone(),
                playerPos: pos.clone(),
                radius: radius,
                aggressive: isAggressive
            });
            this._alertBroadcasted = true; // Evitar spam por un corto periodo
            setTimeout(() => this._alertBroadcasted = false, 1000); // Reset después de 1 segundo
        }
    }

    /**
     * Callback para el AlertBus.
     * @param {Object} alertData
     * @param {THREE.Vector3} alertData.source Posición del enemigo que emitió la alerta.
     * @param {THREE.Vector3} alertData.playerPos Última posición conocida del jugador.
     * @param {number} alertData.radius Radio de la alerta.
     * @param {boolean} alertData.aggressive Si la alerta es agresiva.
     */
    onAlertReceived(alertData) {
        const distToAlert = this.position.distanceTo(alertData.source);
        if (distToAlert < alertData.radius) {
            // Si ya estamos en CHASE o ALERT, ignorar alertas menores
            if (this.currentState === EnemyState.CHASE || this.currentState === EnemyState.ALERT) {
                return;
            }

            // Si la alerta es agresiva, ir a ALERT, si no, a INVESTIGATE
            if (alertData.aggressive) {
                this._pendingAlertPos = alertData.playerPos.clone();
                this._setState(EnemyState.ALERT);
                this._setEyeColor(0xffff00);
            } else if (this.currentState === EnemyState.IDLE || this.currentState === EnemyState.PATROL) {
                this._pendingAlertPos = alertData.playerPos.clone();
                this._setState(EnemyState.INVESTIGATE);
            }
        }
    }

    /**
     * Dispara un proyectil (solo para RANGED).
     * @param {THREE.Vector3} targetPos
     */
    _fireRangedAttack(targetPos) {
        // Implementación de disparo de proyectil (ej. evento global)
        window.dispatchEvent(new CustomEvent('enemy:fireProjectile', {
            detail: {
                position: this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), // Desde la altura del enemigo
                direction: new THREE.Vector3().subVectors(targetPos, this.position).normalize(),
                speed: 15,
                damage: 1
            }
        }));
        // Animación de disparo o sonido
        this.spriteMat.color.setHex(0x00ffff); // Tinte temporal al disparar
        setTimeout(() => this.spriteMat.color.setHex(0xffffff), 100);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // API pública
    // ─────────────────────────────────────────────────────────────────────────

    /** Recibir daño (stagger temporal como en RE4) */
    takeDamage(amount = 1) {
        if (this.currentState === EnemyState.DEAD) return;
        this.health -= amount;

        if (this.health <= 0) {
            this._die();
        } else {
            this._setState(EnemyState.STAGGERED);
            this._setEyeColor(0xffffff);
        }
    }

    /** Llamado por el sistema de colisiones para confirmar si el jugador lo pisa */
    isVulnerableToStomp(playerPos) {
        if (this.currentState === EnemyState.DEAD) return false;
        const dist = this.mesh.position.distanceTo(playerPos);
        const vertDiff = playerPos.y - this.mesh.position.y;
        return dist < 2.0 && vertDiff > 1.0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Máquina de estados RE4-style
    // ─────────────────────────────────────────────────────────────────────────

    update(deltaTime, player) {
        if (!this.active || !player) return;

        this.stateTimer    += deltaTime;
        this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
        this.rangedCooldown = Math.max(0, this.rangedCooldown - deltaTime);

        // ── Leer alerta del AlertBus global (Vite enemigos alertan a los legacy) ──────
        if (window.alertBus && this._pendingAlertPos &&
            (this.currentState === EnemyState.IDLE || this.currentState === EnemyState.PATROL)) {
            this.lastKnownPlayerPos = this._pendingAlertPos;
            this._pendingAlertPos   = null;
            this._setState(EnemyState.INVESTIGATE);
        }

        const pPos   = this._playerPos(player);
        const distSq = this.position.distanceToSquared(pPos);

        // ── Dispatch de alertBus cuando este enemigo detecta al jugador ──────────

        switch (this.currentState) {

            // ── IDLE: espera estacionaria ─────────────────────────────────────
            case EnemyState.IDLE: {
                // Leve balanceo de sprite (idle breathing via scale)
                const breath = 1 + Math.sin(this.stateTimer * 1.2) * 0.015;
                this.mesh.scale.y = 2.5 * breath;

                if (this._hasLOS(pPos)) {
                    this.lastKnownPlayerPos = pPos.clone();
                    this._broadcastAlert(pPos); // ← Avisa a compañeros (RE4 style)
                    this._setState(EnemyState.ALERT);
                    this._setEyeColor(0xffff00);
                } else if (this._hearsPlayer(pPos)) {
                    this.lastKnownPlayerPos = pPos.clone();
                    this._broadcastAlert(pPos, 12, false); // Radio más pequeño, nivel SUSPICIOUS
                    this._setState(EnemyState.INVESTIGATE);
                } else if (this.stateTimer > 3.0) {
                    this._setState(EnemyState.PATROL);
                }
                break;
            }

            // ── ALERT: reacción al ver al jugador (0.4s de pausa dramática) ──
            // Inspirado en RE4: los ganados hacen pausa antes de atacar.
            case EnemyState.ALERT: {
                this._rotateTowards(pPos, deltaTime);
                this._setEyeColor(0xffff00); // Parpadeo amarillo

                if (this.stateTimer > 0.4) {
                    this._setState(EnemyState.CHASE);
                    this._setEyeColor(0xff0000);
                }
                break;
            }

            // ── PATROL: navega entre waypoints ────────────────────────────────
            case EnemyState.PATROL: {
                const wp = this.waypoints[this.currentWaypoint];
                const dir = this._rotateTowards(wp, deltaTime);
                this.position.addScaledVector(dir, this.moveSpeed * 0.5 * deltaTime);

                // Bobbing de marcha en el sprite
                const bob = 1 + Math.sin(this.stateTimer * 6) * 0.04;
                this.mesh.scale.y = 2.5 * bob;

                if (this.position.distanceToSquared(wp) < 1.5) {
                    this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
                }

                if (this._hasLOS(pPos)) {
                    this.lastKnownPlayerPos = pPos.clone();
                    this._setState(EnemyState.ALERT);
                } else if (this._hearsPlayer(pPos)) {
                    this.lastKnownPlayerPos = pPos.clone();
                    this._setState(EnemyState.INVESTIGATE);
                }
                break;
            }

            // ── INVESTIGATE: va al último punto conocido sin LOS ─────────────
            case EnemyState.INVESTIGATE: {
                if (!this.lastKnownPlayerPos) { this._setState(EnemyState.IDLE); break; }

                const dir = this._rotateTowards(this.lastKnownPlayerPos, deltaTime);
                this.position.addScaledVector(dir, this.moveSpeed * 0.65 * deltaTime);
                // Sprite tintado naranja (alerta parcial)
                this.spriteMat.color.setHex(0xff9955);

                if (this._hasLOS(pPos)) {
                    this.lastKnownPlayerPos = pPos.clone();
                    this._setState(EnemyState.CHASE);
                    this.spriteMat.color.setHex(0xffffff); // sin tinte = modo normal
                } else if (this.position.distanceToSquared(this.lastKnownPlayerPos) < 2) {
                    this._setState(EnemyState.IDLE);
                    this.spriteMat.color.setHex(0xffffff);
                } else if (this.stateTimer > 8.0) {
                    this._setState(EnemyState.PATROL);
                }
                break;
            }

            // ── CHASE: persecución activa con LOS ────────────────────────────
            case EnemyState.CHASE: {
                this.lastKnownPlayerPos = pPos.clone();

                if (this.type === EnemyType.RANGED) {
                    // ── RANGED (Guerrero Águila): mantiene distancia mínima y dispara ──
                    // RE4 analog: Ganado Ballesta retrocede cuando el jugador se acerca.
                    const dist = Math.sqrt(distSq);
                    if (dist < this.preferDist) {
                        // Retroceder
                        const awayDir = this._rotateTowards(
                            this.position.clone().sub(new THREE.Vector3().subVectors(pPos, this.position).normalize().multiplyScalar(3)),
                            deltaTime);
                        this.position.addScaledVector(awayDir, this.moveSpeed * 0.8 * deltaTime);
                    } else if (dist > this.preferDist + 4) {
                        // Acercarse si se alejó demasiado
                        const dir = this._rotateTowards(pPos, deltaTime);
                        this.position.addScaledVector(dir, this.moveSpeed * 0.5 * deltaTime);
                    }
                    // Disparar solo cuando tiene LOS y enfriamiento listo
                    if (this.rangedCooldown <= 0 && this._hasLOS(pPos) && distSq < this.attackDistSq * 4) {
                        this._fireRangedAttack(pPos);
                        this.rangedCooldown = 3.2;
                    }
                } else {
                    // ── MELEE: persecución normal ─────────────────────────────
                    const dir = this._rotateTowards(pPos, deltaTime);
                    this.position.addScaledVector(dir, this.moveSpeed * deltaTime);
                    // Flip horizontal del sprite según dirección de movimiento
                    if (dir.x < 0) this.mesh.scale.x = -Math.abs(this.mesh.scale.x);
                    else           this.mesh.scale.x =  Math.abs(this.mesh.scale.x);
                    // Bob de carrera
                    const runBob = 1 + Math.sin(this.stateTimer * 12) * 0.06;
                    this.mesh.scale.y = 2.5 * runBob;
                }

                if (distSq > this.loseDistSq || !this._hasLOS(pPos)) {
                    this._setState(EnemyState.INVESTIGATE);
                } else if (distSq < this.attackDistSq && this.attackCooldown <= 0) {
                    this._setState(EnemyState.ATTACK);
                } else if (distSq < 7 * 7 && this.stateTimer > 3.5 && Math.random() < 0.4) {
                    // Flanqueo lateral oportunista (RE4: los ganados te rodean)
                    this._setState(EnemyState.STRAFE);
                }
                break;
            }

            // ── STRAFE: rodeo lateral para flanquear ─────────────────────────
            case EnemyState.STRAFE: {
                const toPl = new THREE.Vector3().subVectors(pPos, this.position).normalize();
                const right = new THREE.Vector3(-toPl.z, 0, toPl.x);
                this.position.addScaledVector(right, this.moveSpeed * 0.7 * deltaTime);
                this._rotateTowards(pPos, deltaTime);

                if (this.stateTimer > 1.8 || distSq < this.attackDistSq) {
                    this._setState(EnemyState.CHASE);
                }
                break;
            }

            // ── ATTACK: embestida con telegraph (3 fases) ────────────────────
            case EnemyState.ATTACK: {
                if (this.stateTimer < 0.35) {
                    // Fase 1: Wind-up (sprite se achica)
                    this.mesh.scale.y = 2.5 * (1 - this.stateTimer * 0.5);
                } else if (this.stateTimer < 0.55) {
                    // Fase 2: Strike (squash horizontal)
                    this.mesh.scale.set(
                        Math.abs(this.mesh.scale.x) * 1.4,
                        2.5 * 0.7, 1);
                    if (distSq < this.attackDistSq * 1.5) {
                        window.dispatchEvent(new CustomEvent('enemyHitPlayer', {
                            detail: { damage: 1 }
                        }));
                    }
                } else if (this.stateTimer < 1.0) {
                    this.mesh.scale.x = THREE.MathUtils.lerp(this.mesh.scale.x, 2.5, deltaTime * 6);
                    this.mesh.scale.y = THREE.MathUtils.lerp(this.mesh.scale.y, 2.5, deltaTime * 6);
                } else {
                    this.attackCooldown = 1.8;
                    this._setState(EnemyState.CHASE);
                }
                break;
            }

            // ── STAGGERED: tambalea breve ─────────────────────────────────────
            case EnemyState.STAGGERED: {
                // Sprite oscila horizontalmente simulando dolor
                const shake = Math.sin(this.stateTimer * 25) * 0.15 * (1 - this.stateTimer / 0.8);
                this.mesh.position.x = this.position.x + shake;

                if (this.stateTimer > 0.8) {
                    this.mesh.position.x = this.position.x;
                    this.spriteMat.color.setHex(0xffffff);
                    this._setState(EnemyState.CHASE);
                }
                break;
            }

            // ── DEAD: fade-out del sprite ─────────────────────────────────────
            case EnemyState.DEAD: {
                this.mesh.position.y -= 1.2 * deltaTime;
                this.spriteMat.opacity = Math.max(0, this.spriteMat.opacity - 1.5 * deltaTime);
                this.mesh.scale.x *= 1 + 0.5 * deltaTime; // Stretch horizontal de muerte

                if (this.stateTimer > 1.5) this._destroy();
                break;
            }
        }

        // ── Sincronizar posición lógica con sprite visual ───────────────────────
        this.mesh.position.x = this.position.x;
        this.mesh.position.z = this.position.z;
        // .y se ajusta per-state (patrol, idle, dead ya lo mueven directamente)
    }

    _die() {
        this._setState(EnemyState.DEAD);
        this.spriteMat.color.setHex(0xaaaaaa); // Desaturar al morir

        // ── Drop de item (RE4: enemigos dropean recursos) ────────────────────────
        const dropEntries = DROP_TABLE[this.type] ?? DROP_TABLE[EnemyType.MELEE];
        for (const entry of dropEntries) {
            if (Math.random() < entry.chance) {
                // Notificar al inventorySystem si está disponible (Vite engine)
                if (window.inventorySystem) {
                    window.inventorySystem.addItem({ type: entry.type, qty: 1 });
                }
                // Notificar al ScoreSystem legacy
                if (window.scoreSystem && entry.type === 'obsidian') {
                    window.scoreSystem.addObsidianShard();
                } else if (window.scoreSystem && entry.type === 'cacao') {
                    window.scoreSystem.addScore(50, 'pickup');
                }
                window.dispatchEvent(new CustomEvent('itemDropped', {
                    detail: { type: entry.type, pos: this.position.clone() }
                }));
                break; // Solo un drop por enemigo (RE4 tampoco te da 3 cosas a la vez)
            }
        }

        // ── Score ─────────────────────────────────────────────────────
        if (window.scoreSystem) window.scoreSystem.addKill();
        else if (this.scoreSystem) this.scoreSystem.addKill();

        window.dispatchEvent(new CustomEvent('enemyKilled', {
            detail: { pos: this.position.clone() }
        }));
    }

    _destroy() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.hitbox);
        this.spriteMat.map.dispose();
        this.spriteMat.dispose();
        this.active = false;
    }
}
