import * as THREE from 'three';

/**
 * COLLECTIBLE: Fragmento de Obsidiana — PS2-era Quality Pass
 * ──────────────────────────────────────────────────────────────────────────────
 * Inspirado en:
 *   actors/star.c         → Flotación, rotación y detección de pickup
 *   object_helpers.c      → obj_become_intangible(), obj_mark_for_deletion()
 *   behavior_data.c       → bhvStar, bhvYellowCoin
 *
 * PS2-quality upgrades vs SM64 base:
 *   - Geometría dodecahedra facetada (no esfera simple)
 *   - PointLight dinámica pulsante con color propio
 *   - Anillo de suelo (shadow decal) con glow ring proyectado hacia abajo
 *   - Burst de partículas procedurales al recolectar (8 chispas radiales en XZ)
 *   - Zona magnética de atracción (no aparece de repente)
 *   - Usa window.scoreSystem en runtime (evita bug de init antes de crear ScoreSystem)
 */

const State = {
    IDLE:       'IDLE',
    MAGNETIZED: 'MAGNETIZED',
    COLLECTED:  'COLLECTED'
};

export class Collectible {
    constructor(scene, position, _scoreSystemIgnored = null, vfxManager = null) {
        this.scene      = scene;
        this.vfxManager = vfxManager;
        // ⚠️ NO capturar scoreSystem aquí — se lee de window.scoreSystem en runtime
        // para evitar la race condition donde Collectibles se instancian antes que ScoreSystem.

        this.basePosition = new THREE.Vector3().copy(position);
        this.currentState = State.IDLE;
        this.timeAlive    = 0;
        this.active       = true;

        // ── Geometría: Dodecahedro volcánico ─────────────────────────────────
        const geo = new THREE.DodecahedronGeometry(0.42, 0);
        const mat = new THREE.MeshPhysicalMaterial({
            color:               0x050510,
            emissive:            0x6600cc,
            emissiveIntensity:   0.55,
            metalness:           0.95,
            roughness:           0.04,
            clearcoat:           1.0,
            clearcoatRoughness:  0.03,
            reflectivity:        1.0,
            envMapIntensity:     1.2
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.basePosition);
        this.mesh.castShadow = true;

        // ── Aura pulsante ScreenSpace (PointLight local) ──────────────────────
        this.auraLight = new THREE.PointLight(0x9900ff, 2.2, 7);
        this.auraLight.castShadow = false;
        this.mesh.add(this.auraLight);

        // ── Glow Ring en el suelo (Shadow Decal emulado PS2) ─────────────────
        const ringGeo = new THREE.RingGeometry(0.6, 1.1, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color:       0x7700ff,
            transparent: true,
            opacity:     0.35,
            depthWrite:  false,
            side:        THREE.DoubleSide
        });
        this.groundRing = new THREE.Mesh(ringGeo, ringMat);
        this.groundRing.rotation.x = -Math.PI / 2;
        this.groundRing.position.copy(this.basePosition);
        this.groundRing.position.y = this.basePosition.y - 0.4;
        scene.add(this.groundRing);

        scene.add(this.mesh);
        this.hitboxRadius  = 1.4;
        this.magnetRadius  = 8;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    _getPlayerPos(player) {
        return player.mesh
            ? player.mesh.position
            : new THREE.Vector3(player.x, player.y, player.z);
    }

    _distSqToPlayer(player) {
        return this.mesh.position.distanceToSquared(this._getPlayerPos(player));
    }

    // ─── Actualización principal ──────────────────────────────────────────────

    update(deltaTime, player) {
        if (!this.active) return;
        this.timeAlive += deltaTime;

        // Pulso de aura (PS2: efectos de luz dinámica por objeto)
        this.auraLight.intensity = 1.5 + Math.sin(this.timeAlive * 5.0) * 0.9;

        // Glow ring pulso
        this.groundRing.material.opacity = 0.2 + Math.sin(this.timeAlive * 3.5) * 0.15;
        this.groundRing.scale.setScalar(1.0 + Math.sin(this.timeAlive * 2.5) * 0.06);

        switch (this.currentState) {

            case State.IDLE: {
                // Flotación + rotación suave
                this.mesh.rotation.y += 1.6 * deltaTime;
                this.mesh.rotation.x = Math.sin(this.timeAlive * 1.4) * 0.12;
                this.mesh.position.y = this.basePosition.y + Math.sin(this.timeAlive * 2.0) * 0.30;

                if (this._distSqToPlayer(player) < this.magnetRadius * this.magnetRadius) {
                    this.currentState = State.MAGNETIZED;
                }
                break;
            }

            case State.MAGNETIZED: {
                // Succión magnética acelerada
                this.mesh.rotation.y += 8.0 * deltaTime;
                const target = this._getPlayerPos(player);
                this.mesh.position.lerp(target, 9.0 * deltaTime);

                // Sincroniza el ring con la nueva pos (se va borrando con opacidad)
                this.groundRing.position.x = this.mesh.position.x;
                this.groundRing.position.z = this.mesh.position.z;
                this.groundRing.material.opacity *= 0.92;

                if (this._distSqToPlayer(player) < this.hitboxRadius * this.hitboxRadius) {
                    this._collect();
                }
                break;
            }

            case State.COLLECTED: {
                // Encogimiento rápido
                this.mesh.scale.multiplyScalar(1 - 14 * deltaTime);
                this.auraLight.intensity *= 0.8;

                if (this.mesh.scale.x < 0.04) this._destroy();
                break;
            }
        }
    }

    _collect() {
        this.currentState = State.COLLECTED;

        // ── Burst de partículas PS2-style (8 chispas radiales) ────────────────
        if (this.vfxManager) {
            for (let a = 0; a < 8; a++) {
                const angle = (a / 8) * Math.PI * 2;
                const ex = this.mesh.position.x + Math.cos(angle) * 0.8;
                const ez = this.mesh.position.z + Math.sin(angle) * 0.8;
                if (this.vfxManager.emitSparks) {
                    this.vfxManager.emitSparks(ex, this.mesh.position.y, ez, 3);
                } else if (this.vfxManager.createSparks) {
                    this.vfxManager.createSparks(
                        new THREE.Vector3(ex, this.mesh.position.y, ez), 3);
                }
            }
        }

        // ── ScoreSystem (leído en runtime para evitar race condition de init) ───
        if (window.scoreSystem) {
            window.scoreSystem.addObsidianShard();
        }

        window.dispatchEvent(new CustomEvent('obsidianCollected', {
            detail: { pos: this.mesh.position.clone() }
        }));
    }

    _destroy() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.groundRing);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.groundRing.geometry.dispose();
        this.groundRing.material.dispose();
        this.active = false;
    }
}
