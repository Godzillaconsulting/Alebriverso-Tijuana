import * as THREE from 'three';

export class AnimationController {
    constructor(model, animations) {
        this.mixer = new THREE.AnimationMixer(model);
        this.actions = {};
        this.currentAction = null;
        
        // Asumiendo que `animations` es un array de THREE.AnimationClip y vienen nombradas
        // Si no hay animaciones (por ejemplo, es una cápsula), esto funcionará sin crashear.
        if (animations && animations.length > 0) {
            animations.forEach((clip) => {
                this.actions[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
            });
        }
    }

    play(name, fadeDuration = 0.2) {
        if (!this.actions[name]) return; // Animación no existe
        
        const action = this.actions[name];
        
        if (this.currentAction === action) return; // Ya se está reproduciendo

        if (this.currentAction) {
            this.currentAction.fadeOut(fadeDuration);
        }

        action.reset().fadeIn(fadeDuration).play();
        this.currentAction = action;
    }

    update(deltaTime) {
        this.mixer.update(deltaTime);
    }
}
