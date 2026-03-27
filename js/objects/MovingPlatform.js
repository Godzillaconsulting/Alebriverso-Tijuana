import * as THREE from 'three';

/**
 * MOVING PLATFORM: Plataformas Móviles Selectivas — PS2-era Quality Pass
 * ──────────────────────────────────────────────────────────────────────────────
 * Inspirado en:
 *   actors/moving_platform.c   → bhvPlatformOnTrack, bhvFloorSwitchHiddenObjects
 *   object_helpers.c           → cur_obj_move_using_fvel(), cur_obj_apply_drag_to_player
 *
 * PS2-quality upgrades vs SM64 base:
 *   - Borde de luz emissivo que pulsa (ambient glow edge ring) sobre cada plataforma
 *   - PointLight local bajo la plataforma que se mueve con ella (lighmap simulation)
 *   - Modo TRIGGER con visual de activación (parpadeo verde → listo / rojo → en movimiento)
 *   - Fricción estática real: el jugador hereda la velocidad delta de la plataforma
 *   - Ease Cubic InOut (más suave que Sine en plataformas largas)
 *
 * Modos:
 *   LINEAR   → A↔B con ease in/out, rebote en extremos
 *   CIRCULAR → Órbita de radio R alrededor de un centro
 *   TRIGGER  → Ascensor activado al pisarlo (0.6s pausa dramática)
 */

export const PlatformMode = {
    LINEAR:   'LINEAR',
    CIRCULAR: 'CIRCULAR',
    TRIGGER:  'TRIGGER'
};

export class MovingPlatform {
    /**
     * @param {THREE.Scene} scene
     * @param {Object} config
     * @param {THREE.Vector3}  config.position
     * @param {THREE.Vector3}  [config.size]        {x, y, z} — default 6×0.5×6
     * @param {number}         [config.color]        Hex color (default 0x5e4d3b)
     * @param {string}         [config.mode]         PlatformMode (default LINEAR)
     * @param {THREE.Vector3}  [config.endPosition]  Para LINEAR y TRIGGER
     * @param {number}         [config.radius]       Para CIRCULAR
     * @param {number}         [config.speed]        Unidades/s (default 3)
     * @param {boolean}        [config.easeInOut]    Cubic ease (default true)
     */
    constructor(scene, config = {}) {
        this.scene = scene;

        this.mode    = config.mode     ?? PlatformMode.LINEAR;
        this.speed   = config.speed    ?? 3.0;
        this.easeIO  = config.easeInOut ?? true;

        // ── Estado LINEAR ─────────────────────────────────────────────────────
        this.startPos  = new THREE.Vector3().copy(config.position);
        this.endPos    = config.endPosition
            ? new THREE.Vector3().copy(config.endPosition)
            : new THREE.Vector3(config.position.x + 10, config.position.y, config.position.z);
        this.progress  = 0;
        this.direction = 1;

        // ── Estado CIRCULAR ───────────────────────────────────────────────────
        this.orbitRadius = config.radius ?? 8;
        this.orbitCenter = new THREE.Vector3().copy(config.position);
        this.orbitAngle  = 0;

        // ── Estado TRIGGER ────────────────────────────────────────────────────
        this.triggered    = false;
        this.triggerDelay = 0;
        this.triggerTarget = config.endPosition
            ? new THREE.Vector3().copy(config.endPosition)
            : new THREE.Vector3(config.position.x, config.position.y + 8, config.position.z);

        // Velocidad delta de este frame (para fricción estática con el jugador)
        this.deltaPos = new THREE.Vector3();

        // ── Mesh principal ────────────────────────────────────────────────────
        const size = config.size ?? { x: 6, y: 0.5, z: 6 };
        const geo  = new THREE.BoxGeometry(size.x, size.y, size.z);

        // Material PS2: PBR con textura procedimental de piedra volcánica gris-negra
        const mat = new THREE.MeshStandardMaterial({
            color:     config.color ?? 0x3d3d3d,
            roughness: 0.65,
            metalness: 0.15,
            emissive:  0x110022,
            emissiveIntensity: 0.3
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(config.position);
        this.mesh.castShadow    = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.isMovingPlatform = true;
        this.mesh.userData.platform = this;

        // ── Borde Emissivo (PS2 Edge Glow Ring) ───────────────────────────────
        // Un EdgeRing era imposible en N64/SM64 — en PS2 sí existía por vertex color
        const edgeGeo = new THREE.EdgesGeometry(geo);
        const edgeMat = new THREE.LineBasicMaterial({
            color: 0x8800ff,
            transparent: true,
            opacity: 0.5
        });
        this.edgeGlow = new THREE.LineSegments(edgeGeo, edgeMat);
        this.mesh.add(this.edgeGlow);

        // ── PointLight móvil bajo la plataforma (simula lightmap dinámico) ───
        this.underLight = new THREE.PointLight(0x6600cc, 0.8, 12);
        this.underLight.position.set(0, -(size.y / 2 + 1), 0);
        this.underLight.castShadow = false;
        this.mesh.add(this.underLight);

        // Indicador de estado TRIGGER (bolita de color en el centro superior)
        if (this.mode === PlatformMode.TRIGGER) {
            const indGeo = new THREE.SphereGeometry(0.18, 8, 6);
            this.triggerIndicatorMat = new THREE.MeshStandardMaterial({
                color:             0x00ff44,
                emissive:          0x00ff44,
                emissiveIntensity: 1.5
            });
            this.triggerIndicator = new THREE.Mesh(indGeo, this.triggerIndicatorMat);
            this.triggerIndicator.position.set(0, size.y / 2 + 0.25, 0);
            this.mesh.add(this.triggerIndicator);
        }

        scene.add(this.mesh);
        this._time = 0;
    }

    // ─── Ease cubic InOut (más cinematográfico que sine para plataformas largas) ─
    _cubicEase(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    isPlayerOnTop(player) {
        const px = player.mesh ? player.mesh.position.x : player.x;
        const py = player.mesh ? player.mesh.position.y : player.y;
        const pz = player.mesh ? player.mesh.position.z : player.z;

        const geo = /** @type {THREE.BoxGeometry} */ (this.mesh.geometry);
        const hw  = geo.parameters.width  / 2 + 0.35;
        const hd  = geo.parameters.depth  / 2 + 0.35;
        const top = this.mesh.position.y + geo.parameters.height / 2;

        return (
            Math.abs(px - this.mesh.position.x) < hw &&
            Math.abs(pz - this.mesh.position.z) < hd &&
            Math.abs(py - top) < 0.55
        );
    }

    activate() {
        if (this.mode === PlatformMode.TRIGGER && !this.triggered) {
            this.triggered    = true;
            this.triggerDelay = 0.6;
            if (this.triggerIndicatorMat) {
                this.triggerIndicatorMat.color.setHex(0xff3300);
                this.triggerIndicatorMat.emissive.setHex(0xff3300);
            }
        }
    }

    update(deltaTime, player = null) {
        this._time += deltaTime;
        const prevPos = this.mesh.position.clone();

        // Pulso del borde emissivo (PS2 vibe)
        this.edgeGlow.material.opacity = 0.3 + Math.sin(this._time * 3.0) * 0.2;
        this.underLight.intensity = 0.6 + Math.sin(this._time * 2.5) * 0.3;

        switch (this.mode) {

            case PlatformMode.LINEAR: {
                this.progress += (this.speed / Math.max(this.startPos.distanceTo(this.endPos), 0.01))
                    * this.direction * deltaTime;

                if (this.progress >= 1) { this.progress = 1; this.direction = -1; }
                if (this.progress <= 0) { this.progress = 0; this.direction =  1; }

                const t = this.easeIO ? this._cubicEase(this.progress) : this.progress;
                this.mesh.position.lerpVectors(this.startPos, this.endPos, t);
                break;
            }

            case PlatformMode.CIRCULAR: {
                this.orbitAngle += this.speed * deltaTime;
                this.mesh.position.set(
                    this.orbitCenter.x + Math.cos(this.orbitAngle) * this.orbitRadius,
                    this.orbitCenter.y,
                    this.orbitCenter.z + Math.sin(this.orbitAngle) * this.orbitRadius
                );
                break;
            }

            case PlatformMode.TRIGGER: {
                if (player && this.isPlayerOnTop(player)) this.activate();

                if (this.triggered) {
                    if (this.triggerDelay > 0) {
                        this.triggerDelay -= deltaTime;
                        // Vibración de pre-movimiento (PS2 style feedback)
                        this.mesh.rotation.z = Math.sin(this._time * 40) * 0.012 *
                            (this.triggerDelay / 0.6);
                    } else {
                        this.mesh.rotation.z = 0;
                        this.mesh.position.lerp(this.triggerTarget, deltaTime * 1.8);
                    }
                }
                break;
            }
        }

        // ── Fricción Estática: arrastrar al jugador con la plataforma ─────────
        this.deltaPos.copy(this.mesh.position).sub(prevPos);
        this.mesh.updateMatrixWorld();

        if (player && this.isPlayerOnTop(player)) {
            if (player.mesh) {
                player.mesh.position.add(this.deltaPos);
            } else {
                player.x += this.deltaPos.x;
                player.y += this.deltaPos.y;
                player.z += this.deltaPos.z;
            }
        }
    }
}
