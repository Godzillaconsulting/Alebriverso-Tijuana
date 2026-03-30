import * as THREE from 'three';

export class CinematicsManager {
    constructor(scene, cameraController, playerController) {
        this.scene = scene;
        this.camera = cameraController;
        this.player = playerController;
        
        // Listeners for events
        window.addEventListener('cinematicEnd', () => this.endCinematic());
        
        // Pre-defined sequences
        this.sequences = new Map();
        
        // Default sequence: Boss Intro Tezcatlipoca
        this.registerSequence('intro_tezcatlipoca', {
            duration: 4.0,
            points: [
                new THREE.Vector3(0, 15, 30),
                new THREE.Vector3(10, 10, 20),
                new THREE.Vector3(0, 5, 10)
            ],
            lookAts: [
                new THREE.Vector3(0, 5, 0),
                new THREE.Vector3(0, 5, 0),
                new THREE.Vector3(0, 5, 0)
            ]
        });
    }

    registerSequence(id, sequenceData) {
        this.sequences.set(id, sequenceData);
    }

    play(id, lookTargetObj) {
        const seq = this.sequences.get(id);
        if (!seq) {
            console.warn(`[Cinematics] Sequence ${id} not found.`);
            return;
        }

        console.log(`[Cinematics] Playing sequence: ${id}`);
        
        // Enforce Letterbox
        if (this.camera.setLetterbox) this.camera.setLetterbox(true);

        // Lock Player (Assuming player has an input lock mechanism, else we just target null)
        this.playerLocked = true;
        this.previousTarget = this.camera.target;
        
        // Dynamically compute lookAts if a dynamic target is passed
        let lookAts = seq.lookAts;
        if (lookTargetObj) {
            lookAts = seq.points.map(() => lookTargetObj.position.clone().add(new THREE.Vector3(0, 2, 0)));
        }

        // Send to camera
        this.camera.playCinematicTrack(seq.points, lookAts, seq.duration);
    }

    endCinematic() {
        console.log(`[Cinematics] Ended.`);
        if (this.camera.setLetterbox) this.camera.setLetterbox(false);
        
        // Restore camera lock
        this.camera.setTarget(this.previousTarget);
    }
}
