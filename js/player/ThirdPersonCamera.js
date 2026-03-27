import * as THREE from 'three';

export class ThirdPersonCamera {
    constructor(camera, targetMesh) {
        this.camera = camera;
        this.target = targetMesh;
        
        // Initial vectors to prevent snapping
        this.currentPosition = new THREE.Vector3();
        if (this.camera && this.camera.position) {
            this.currentPosition.copy(this.camera.position);
        }

        this.currentLookat = new THREE.Vector3();
        this.currentLookat.copy(this.getTargetPosition());
    }

    getTargetPosition() {
        if (this.target.position) return this.target.position;
        return new THREE.Vector3(this.target.x || 0, this.target.y || 0, this.target.z || 0);
    }

    getTargetQuaternion() {
        if (this.target.quaternion) return this.target.quaternion;
        return new THREE.Quaternion(); // Identity si no tiene rotación
    }

    calculateIdealOffset() {
        const idealOffset = new THREE.Vector3(0, 4, -10);
        idealOffset.applyQuaternion(this.getTargetQuaternion());
        idealOffset.add(this.getTargetPosition());
        return idealOffset;
    }

    calculateIdealLookat() {
        const idealLookat = new THREE.Vector3(0, 2, 5);
        idealLookat.applyQuaternion(this.getTargetQuaternion());
        idealLookat.add(this.getTargetPosition());
        return idealLookat;
    }

    update(deltaTime) {
        const idealOffset = this.calculateIdealOffset();
        const idealLookat = this.calculateIdealLookat();

        // factor suavizado independiente del framerate
        // Un factor pequeño como 0.5 da un efecto trailing muy suave (PS2 style)
        // Usamos MathUtils.lerp manual vector-safe
        const tPos = 1.0 - Math.pow(0.001, deltaTime * 2.0);
        const tLook = 1.0 - Math.pow(0.001, deltaTime * 4.0);

        this.currentPosition.lerp(idealOffset, tPos);
        this.currentLookat.lerp(idealLookat, tLook);

        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookat);
    }
}
