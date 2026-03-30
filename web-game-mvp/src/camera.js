import * as THREE from 'three';
import { collidables } from './assets.js';

/**
 * ============================================================
 *  RE4 / PS2-GRADE THIRD PERSON CAMERA  —  Tijuana Engine
 * ============================================================
 *  Philosophy (exactly Resident Evil 4):
 *  1. Camera ALWAYS hugs the player's RIGHT SHOULDER.
 *  2. Mouse X  →  Rotates PLAYER BODY (not the lens).
 *  3. Mouse Y  →  Tilts camera pitch only (never the body).
 *  4. "Lazy Corridor Follow" — if the player runs forward and
 *     stops steering, the camera auto-corrects behind them over
 *     ~1.5 seconds (no jarring snap).
 *  5. Z-Targeting (SHIFT)  →  Player & camera lock onto nearest
 *     threat; FOV narrows 12° for the "aim down sights" tension.
 *  6. Anti-clip  →  Predictive raycast shortens the arm if a
 *     wall is detected; pulls back with a spring, not a teleport.
 *  7. Camera Shake  →  Trauma-based decay (Squirrel AI approach),
 *     additive to position AND lookAt for full-frame impact.
 */

export class ThirdPersonCamera {
    constructor(camera) {
        this.camera = camera;
        this.target  = null;

        // --- Smoothed position & lookAt (applied each frame) ---
        this.currentPosition = new THREE.Vector3();
        this.currentLookAt   = new THREE.Vector3();

        // --- RE4 shoulder mount (right, up, back) ---
        this.shoulderIdle = new THREE.Vector3(0.75, 1.65, 3.8);
        this.shoulderAim  = new THREE.Vector3(0.45, 1.55, 1.8); // Closer and tighter
        this.shoulder     = this.shoulderIdle.clone();

        // --- Pitch state (mouse Y only) ---
        this.pitch    = 0.0;
        this.PITCH_MIN = -0.50;  // max look-down
        this.PITCH_MAX =  0.30;  // max look-up

        // --- Sensitivity & Inversion ---
        this.senX = 0.0025;
        this.senY = 0.0025;
        this.invertX = false;
        this.invertY = false;

        // --- Aiming & Z-Targeting ---
        this.isAiming     = false;
        this.lockOnTarget = null;
        this.BASE_FOV     = 75;
        this.AIM_FOV      = 55;   // narrows on lock-on or manual aim

        // --- Lazy auto-correct behind player ---
        // After `lazyDelay` seconds of no mouse input the camera
        // begins to drift back behind the player's heading.
        this.lazyDelay    = 1.4;  // seconds before auto-correct kicks in
        this.lazyTimer    = 0.0;
        this.lazyCorrecting = false;

        // --- Arm length for anti-clip ---
        this.armLength    = 3.8;  // nominal
        this.currentArm   = 3.8;  // smoothed

        // --- Trauma-based Camera Shake ---
        this.trauma       = 0.0;  // 0..1
        this.TRAUMA_DECAY = 0.8;  // how fast trauma fades per second

        // Scratch objects (avoid GC per frame)
        this._pitchQuat = new THREE.Quaternion();
        this._pitchAxis = new THREE.Vector3();
        this._dummy     = new THREE.Object3D();

        // ─────────────────────────────────────────────────────
        // FEATURE 1: CAMERA ZONES (Fixed-angle triggers)
        // Populated from JSON level data via registerCameraZone()
        // ─────────────────────────────────────────────────────
        this.cameraZones   = [];   // [{min, max, position, lookAt, fov}]
        this.activeZone    = null; // zone currently overriding the camera
        this._zoneBlend    = 0.0;  // 0=free, 1=fully locked to zone

        // ─────────────────────────────────────────────────────
        // FEATURE 2: C-UP FIRST-PERSON MODE
        // ─────────────────────────────────────────────────────
        this.firstPerson   = false;
        this.FP_FOV        = 68;
        this._fpBlend      = 0.0;  // 0=3p, 1=first person

        // ─────────────────────────────────────────────────────
        // FEATURE 3: CINEMATIC LETTERBOX
        // ─────────────────────────────────────────────────────
        this._letterboxActive = false;
        this._letterboxEl     = this._createLetterbox();

        // ─────────────────────────────────────────────────────
        // FEATURE 4: HEAD-BOB
        // ─────────────────────────────────────────────────────
        this._bobPhase  = 0.0;
        this.BOB_FREQ   = 6.5;  // cycles per second at full speed
        this.BOB_AMP    = 0.06; // max vertical displacement (meters)
        
        // ─────────────────────────────────────────────────────
        // CROSS-TEAM MODIFIERS & SYSTEMS
        // ─────────────────────────────────────────────────────
        this.isUnderwater = false;
        this.cinematicSpline = null;
        this.cinematicTime = 0;
        this.cinematicDuration = 1;
    }

    // ── Private: build letterbox DOM elements ─────────────────
    _createLetterbox() {
        const style = 'position:fixed;left:0;width:100%;height:0;background:#000;transition:height 0.5s ease;z-index:9999;pointer-events:none;';
        const top = document.createElement('div');
        top.style.cssText = style + 'top:0;';
        const bot = document.createElement('div');
        bot.style.cssText = style + 'bottom:0;';
        document.body.appendChild(top);
        document.body.appendChild(bot);
        return { top, bot };
    }

    // -------------------------------------------------------
    shake(intensity = 0.5) {
        // Add trauma (capped at 1). Intensity 0..1
        this.trauma = Math.min(1.0, this.trauma + intensity);
    }

    // ── FEATURE 1: Register a Camera Zone from level JSON ─────
    registerCameraZone(zone) {
        // zone: { min:{x,y,z}, max:{x,y,z}, position:{x,y,z}, lookAt:{x,y,z}, fov:number }
        this.cameraZones.push({
            min:      new THREE.Vector3(zone.min.x,      zone.min.y,      zone.min.z),
            max:      new THREE.Vector3(zone.max.x,      zone.max.y,      zone.max.z),
            position: new THREE.Vector3(zone.position.x, zone.position.y, zone.position.z),
            lookAt:   new THREE.Vector3(zone.lookAt.x,   zone.lookAt.y,   zone.lookAt.z),
            fov:      zone.fov ?? 70
        });
    }

    clearCameraZones() { this.cameraZones = []; this.activeZone = null; }

    // ── FEATURE 2: Toggle First-Person C-Up ───────────────────
    toggleFirstPerson(on) { this.firstPerson = on; }

    // ── FEATURE 3: Letterbox on/off ───────────────────────────
    setLetterbox(on) {
        const h = on ? '8vh' : '0px';
        this._letterboxEl.top.style.height = h;
        this._letterboxEl.bot.style.height = h;
        this._letterboxActive = on;
    }

    // ── AIMING & QUICK TURN ────────────────────────────────────
    setAiming(isAiming) {
        this.isAiming = isAiming;
        
        // Visual Reticle overlay (Laser Sight)
        if (!this._reticle) {
            this._reticle = document.createElement('div');
            this._reticle.style.cssText = "position:absolute; top:50%; left:50%; width:10px; height:10px; transform:translate(-50%,-50%); border-radius:50%; border:2px solid red; background:rgba(255,0,0,0.5); pointer-events:none; z-index:1000; box-shadow: 0 0 8px red, 0 0 15px currentColor; display:none; transition: all 0.15s ease;";
            document.body.appendChild(this._reticle);
        }
        this._reticle.style.display = isAiming ? 'block' : 'none';
    }

    applyRecoil(verticalKick = 0.05) {
        this.pitch += verticalKick;
        this.pitch = THREE.MathUtils.clamp(this.pitch, this.PITCH_MIN, this.PITCH_MAX);
    }

    // ── CROSS TEAM SYNERGIES ───────────────────────────────────
    cycleTarget(enemiesList) {
        if (!enemiesList || enemiesList.length === 0) return;
        if (!this.target) return;
        const playerPos = this.target.position;
        // Filter valid enemies (alive, close enough) and sort by distance for predictable cycling
        const valid = enemiesList.map(e => e.mesh || e)
            .filter(mesh => typeof mesh.userData.hp === 'undefined' || mesh.userData.hp > 0)
            .filter(mesh => mesh.position.distanceTo(playerPos) < 30)
            .sort((a, b) => a.position.distanceToSquared(playerPos) - b.position.distanceToSquared(playerPos));
        
        if (valid.length === 0) {
            this.lockOnTarget = null;
            return;
        }

        // Find next target
        let currentIdx = valid.indexOf(this.lockOnTarget);
        currentIdx = (currentIdx + 1) % valid.length;
        this.lockOnTarget = valid[currentIdx];
    }

    playCinematicTrack(points, lookAts, duration) {
        if (points.length < 2) return;
        this.cinematicSpline = new THREE.CatmullRomCurve3(points);
        this.cinematicLookAtSpline = new THREE.CatmullRomCurve3(lookAts);
        this.cinematicTime = 0;
        this.cinematicDuration = duration;
        // Mute input temporarily
        this.target = null;
    }

    quickTurn() {
        if (!this.target) return;
        // Instantly flip the player 180 degrees
        this.target.rotation.y += Math.PI;
        // Instantly snap the camera behind the newly flipped player
        const playerQuat = this.target.quaternion;
        const worldShoulder = this.shoulder.clone().applyQuaternion(playerQuat);
        this._pitchAxis.set(1, 0, 0).applyQuaternion(playerQuat);
        this._pitchQuat.setFromAxisAngle(this._pitchAxis, this.pitch);
        worldShoulder.applyQuaternion(this._pitchQuat);
        
        const idealCamPos = this.target.position.clone().add(worldShoulder);
        this.currentPosition.copy(idealCamPos);
        
        // Create trauma for the aggressive whip
        this.shake(0.3);
    }

    setTarget(target) {
        this.target = target;
        if (!target) return;
        // Snap immediately on first assignment (no lerp lag on scene load)
        const q = target.quaternion;
        const snap = this.shoulder.clone().applyQuaternion(q).add(target.position);
        this.currentPosition.copy(snap);
        this.currentLookAt.copy(
            target.position.clone().add(new THREE.Vector3(0, 1.5, 0))
        );
    }

    // -------------------------------------------------------
    // Called from main.js on every raw mousemove event.
    // -------------------------------------------------------
    onMouseMove(dx, dy) {
        // Reset lazy timer whenever the player steers manually
        this.lazyTimer = 0.0;
        this.lazyCorrecting = false;

        if (this.lockOnTarget) return; // Under lock-on: no manual yaw

        // Delegate horizontal rotation to the PLAYER BODY (RE4 core)
        // Aiming reduces sensitivity by 50% for precision. Water reduces by another 40%.
        let sensMult = this.isAiming ? 0.4 : 1.0;
        if (this.isUnderwater) sensMult *= 0.6;
        
        const invX = this.invertX ? -1 : 1;
        const invY = this.invertY ? -1 : 1;

        if (this.target) {
            this.target.rotation.y -= dx * this.senX * sensMult * invX;
        }

        // Vertical tilt is camera-only
        this.pitch -= dy * this.senY * sensMult * invY;
        const PITCH_CEILING = this.isUnderwater ? -0.1 : this.PITCH_MAX; // Lock looking straight up in water
        this.pitch  = THREE.MathUtils.clamp(this.pitch, this.PITCH_MIN, PITCH_CEILING);
    }

    // -------------------------------------------------------
    update(dt) {
        // ── CINEMATIC OVERRIDE ────────────────────────────────
        if (this.cinematicSpline) {
            this.cinematicTime += dt;
            const t = THREE.MathUtils.clamp(this.cinematicTime / this.cinematicDuration, 0, 1);
            const pos = this.cinematicSpline.getPoint(t);
            const look = this.cinematicLookAtSpline.getPoint(t);
            this.currentPosition.copy(pos);
            this.currentLookAt.copy(look);
            this.camera.position.copy(pos);
            this.camera.lookAt(look);
            if (t >= 1.0) {
                this.cinematicSpline = null;
                window.dispatchEvent(new CustomEvent('cinematicEnd'));
            }
            return;
        }

        if (!this.target) return;

        // ── 0. FEATURE 1: CHECK CAMERA ZONES ──────────────────
        let inZone = null;
        const pp = this.target.position;
        for (const z of this.cameraZones) {
            if (pp.x >= z.min.x && pp.x <= z.max.x &&
                pp.y >= z.min.y && pp.y <= z.max.y &&
                pp.z >= z.min.z && pp.z <= z.max.z) {
                inZone = z;
                break;
            }
        }
        this.activeZone = inZone;
        // Blend weight: snap in when entering, fade out when leaving
        this._zoneBlend = THREE.MathUtils.lerp(
            this._zoneBlend, inZone ? 1.0 : 0.0, dt * 5
        );

        // If fully in a zone, use fixed camera and skip all other logic
        if (this._zoneBlend > 0.98 && inZone) {
            this.camera.position.lerp(inZone.position, dt * 3);
            this.currentLookAt.lerp(inZone.lookAt, dt * 3);
            this.camera.lookAt(this.currentLookAt);
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, inZone.fov, dt * 4);
            this.camera.updateProjectionMatrix();
            return;
        }

        // ── 0.5. SHOULDER BLEND (AIMING vs IDLE) ──────────────
        const targetShoulder = this.isAiming ? this.shoulderAim : this.shoulderIdle;
        this.shoulder.lerp(targetShoulder, dt * 6.0);
        
        // ── 1. Z-TARGETING & AIMING ───────────────────────────
        if (this.lockOnTarget) {
            const toTarget = new THREE.Vector3()
                .subVectors(this.lockOnTarget.position, this.target.position);
            toTarget.y = 0;
            if (toTarget.lengthSq() > 0.01) {
                const wantedYaw = Math.atan2(toTarget.x, toTarget.z);
                // Smoothly rotate the player body toward the enemy
                const curY = this.target.rotation.y;
                let diff = wantedYaw - curY;
                // Wrap to [-PI, PI]
                while (diff >  Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.target.rotation.y += diff * Math.min(1, dt * 9);
            }
            // Pitch converges to "combat crouch" angle
            this.pitch = THREE.MathUtils.lerp(this.pitch, -0.18, dt * 5);

        }
        
        // ── 1.5. UNDERWATER MODIFIERS ─────────────────────────
        const currentlyUnderwater = this.target.userData._inWater === true;
        if (currentlyUnderwater !== this.isUnderwater) {
            this.isUnderwater = currentlyUnderwater;
            window.dispatchEvent(new CustomEvent('cameraUnderwater', { detail: { isUnderwater: this.isUnderwater } }));
        }
        
        const waterFOVPenalty = this.isUnderwater ? 12 : 0;

        // Narrow the FOV for that RE4 "weapon ready" feel + Water Warp
        if (this.lockOnTarget || this.isAiming) {
            this.camera.fov = THREE.MathUtils.lerp(
                this.camera.fov, this.AIM_FOV + waterFOVPenalty, dt * 6
            );
        } else {
            // Restore FOV when not aiming
            this.camera.fov = THREE.MathUtils.lerp(
                this.camera.fov, this.BASE_FOV + waterFOVPenalty, dt * 4
            );
        }
        this.camera.updateProjectionMatrix();

        // ── 2. LAZY AUTO-CORRECT (camera drifts behind player) ──
        if (!this.lockOnTarget) {
            this.lazyTimer += dt;
            if (this.lazyTimer > this.lazyDelay) {
                this.lazyCorrecting = true;
            }
            // Nothing extra needed: since camera follows body rotation
            // and we delegate yaw to the player, once the player moves
            // forward the body.rotation.y will already be correct and
            // the camera arm just needs to follow it — handled in step 3.
        }

        // ── 3. COMPUTE IDEAL CAMERA POSITION ────────────────
        const playerQuat = this.target.quaternion;

        // Shoulder offset in world space (uses player's current facing)
        const worldShoulder = this.shoulder.clone().applyQuaternion(playerQuat);

        // Apply camera pitch on top (rotate around the player's local right axis)
        this._pitchAxis.set(1, 0, 0).applyQuaternion(playerQuat);
        this._pitchQuat.setFromAxisAngle(this._pitchAxis, this.pitch);
        worldShoulder.applyQuaternion(this._pitchQuat);

        const idealCamPos = this.target.position.clone().add(worldShoulder);

        // ── 4. ANTI-CLIPPING (Raycast arm shortening) ───────
        const headPos = this.target.position.clone().add(new THREE.Vector3(0, 1.35, 0));
        const rayDir  = new THREE.Vector3().subVectors(idealCamPos, headPos);
        const rawDist = rayDir.length();
        rayDir.divideScalar(rawDist); // normalize in-place

        const ray = new THREE.Raycaster(headPos, rayDir, 0.15, rawDist);
        // === RE4 2004 #10.1: RECURSIVE RAYCASTING ===
        // Must check children because walls might be inside Groups (GLTF architecture)
        const hits = ray.intersectObjects(collidables, true);

        // Desired arm length: full length or clipped to wall hit
        let desiredArm = rawDist;
        if (hits.length > 0) {
            // Push camera further away from the wall to prevent near-plane clipping (0.4 offset)
            desiredArm = Math.max(0.1, hits[0].distance - 0.45);
        }

        // Spring-smooth the arm so the camera doesn't teleport
        const armSpring = hits.length > 0 ? 0.8 : dt * 3.5; // fast clip-in, slow recovery
        this.currentArm = THREE.MathUtils.lerp(this.currentArm, desiredArm, armSpring);

        // Rebuild position with clipped arm
        const finalCamPos = headPos.clone().addScaledVector(rayDir, this.currentArm);

        // ── 5. LOOK-AT TARGET ────────────────────────────────
        // Aim at a point slightly LEFT of center and AT chest height
        // (RE4's Leon is slightly left on screen while camera peeks right)
        const lookOffset = new THREE.Vector3(-0.15, 1.45, 0).applyQuaternion(playerQuat);
        const idealLook  = this.target.position.clone().add(lookOffset);

        // If locked-on, blend lookAt toward the enemy
        if (this.lockOnTarget) {
            const lockLook = this.lockOnTarget.position.clone();
            lockLook.y = Math.max(lockLook.y, idealLook.y); // never look at feet
            idealLook.lerp(lockLook, 0.35);
        }

        // ── 6. SMOOTHING  (spring-damper feel) ───────────────
        // Position: slightly snappier so the shoulder stays glued
        const posT  = 1.0 - Math.pow(0.0005, dt);
        // LookAt: even snappier so the crosshair feels responsive
        const lookT = 1.0 - Math.pow(0.0001, dt);

        this.currentPosition.lerp(finalCamPos,  posT);
        this.currentLookAt.lerp(idealLook,       lookT);

        // ── 7. TRAUMA SHAKE ────────────────────────────────────
        if (this.trauma > 0.001) {
            // trauma² keeps small shakes subtle, large shakes violent
            const s = this.trauma * this.trarama;
            // Seed with time so the pattern isn't perfectly regular
            const t = performance.now() * 0.001;
            const sx = (Math.sin(t * 27.3 + 1.1) * 0.5 + 0.5) * 2 - 1;
            const sy = (Math.sin(t * 19.7 + 2.3) * 0.5 + 0.5) * 2 - 1;
            const sz = (Math.sin(t * 33.1 + 0.7) * 0.5 + 0.5) * 2 - 1;

            const mag = s * 0.6;
            this.currentPosition.x += sx * mag;
            this.currentPosition.y += sy * mag * 0.6;
            this.currentPosition.z += sz * mag;

            this.currentLookAt.x   += sx * mag * 0.8;
            this.currentLookAt.y   += sy * mag * 0.8;

            // Decay
            this.trauma = Math.max(0, this.trauma - this.TRAUMA_DECAY * dt);
        }

        // ── FEATURE 2: FIRST PERSON (C-Up) OVERRIDE ───────────
        if (this.firstPerson) {
            this._fpBlend = Math.min(1, this._fpBlend + dt * 6);
        } else {
            this._fpBlend = Math.max(0, this._fpBlend - dt * 6);
        }

        if (this._fpBlend > 0.01) {
            // Eye position: inside the head
            const eyePos = this.target.position.clone().add(
                new THREE.Vector3(0, 1.72, 0).applyQuaternion(this.target.quaternion)
            );
            // Look straight ahead in first person
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.target.quaternion);
            const fpLook  = eyePos.clone().add(forward.multiplyScalar(10));

            this.currentPosition.lerp(eyePos,  this._fpBlend);
            this.currentLookAt.lerp(fpLook,    this._fpBlend);

            const fpFov = THREE.MathUtils.lerp(this.BASE_FOV, this.FP_FOV, this._fpBlend);
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fpFov, dt * 8);
            this.camera.updateProjectionMatrix();
        }

        // ── FEATURE 4: HEAD-BOB ────────────────────────────────
        // Sync bob phase to the player's horizontal speed
        if (this.target.userData && !this.firstPerson) {
            // Read speed from PlayerController if available, else estimate
            const vel    = this.target.userData._currentVelocity;
            const speed  = vel ? Math.hypot(vel.x, vel.z) : 0;
            const onGround = this.target.userData._onGround ?? true;

            if (onGround && speed > 1.5) {
                const freq = this.BOB_FREQ * (speed / 14.0); // scale freq with speed
                this._bobPhase += freq * dt * Math.PI * 2;
                const bob = Math.sin(this._bobPhase) * this.BOB_AMP * Math.min(speed / 8, 1);
                this.currentPosition.y += bob;
            } else {
                // Damp bob out when stopped
                this._bobPhase *= 0.85;
            }
        }

        // ── 8. COMMIT TO RENDERER ──────────────────────────────
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);
    }
}
