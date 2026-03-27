import * as THREE from 'three';

/**
 * VFXManager.js
 * Sistema de Partículas GPU
 * Usa THREE.InstancedMesh para alto rendimiento a 60FPS.
 */
export default class VFXManager {
    constructor(maxParticles = 1500) {
        this.maxParticles = maxParticles;
        this.particles = [];
        
        // Geometría Base (Billboard)
        const geometry = new THREE.PlaneGeometry(1, 1);
        
        // Uso de AdditiveBlending para que luzca brillante y el gris emule opacidad temporal cruzada
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            depthWrite: false, 
            blending: THREE.AdditiveBlending, 
            side: THREE.DoubleSide
        });
        
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, maxParticles);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instancedMesh.frustumCulled = false; 

        // Geometría para Escombros 3D (Rocas/Ladrillos)
        const debrisGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const debrisMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, roughness: 0.9, metalness: 0.1 
        });
        this.debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, 500);
        this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.debrisMesh.frustumCulled = false;
        this.debrisMesh.castShadow = true;
        
        this.vfxGroup = new THREE.Group();
        this.vfxGroup.add(this.instancedMesh);
        this.vfxGroup.add(this.debrisMesh);

        this.dummy = new THREE.Object3D();
        this.colorDummy = new THREE.Color();

        this.debrisParticles = [];
        for (let i = 0; i < 500; i++) {
            this.debrisMesh.setMatrixAt(i, new THREE.Matrix4().set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0));
            this.debrisMesh.setColorAt(i, new THREE.Color(0,0,0));
            this.debrisParticles.push({
                active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
                rx: 0, ry: 0, rz: 0, vrx: 0, vry: 0, vrz: 0,
                life: 0, maxLife: 0, bounceY: 0, r: 1, g: 1, b: 1
            });
        }
        
        for (let i = 0; i < maxParticles; i++) {
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
            this.instancedMesh.setColorAt(i, new THREE.Color(0,0,0));
            
            this.particles.push({
                active: false,
                type: 'dust',
                x: 0, y: 0, z: 0,
                vx: 0, vy: 0, vz: 0,
                life: 0, maxLife: 1,
                r: 1, g: 1, b: 1, a: 1,
                scale: 1,
                gravity: 15.0,
                friction: 0.95
            });
        }
    }

    getMesh() {
        return this.vfxGroup;
    }

    emitDust(x, y, z, count = 15) {
        let spawned = 0;
        
        // Detonador Situacional: ¿Estamos tocando el agua profunda (Y = -15 aprox)?
        const isSplash = (y <= -14.0);

        for (let i = 0; i < this.maxParticles && spawned < count; i++) {
            const p = this.particles[i];
            if (!p.active) {
                p.active = true;
                p.type = isSplash ? 'splash' : 'dust';
                p.x = x + (Math.random() - 0.5) * 1.5;
                p.y = y + Math.random() * 0.5;
                p.z = z + (Math.random() - 0.5) * 1.5;
                
                // Explota radialmente hacia afuera
                p.vx = (Math.random() - 0.5) * 8.0;
                p.vy = Math.random() * 6.0 + 2.0;
                p.vz = (Math.random() - 0.5) * 8.0;
                
                p.life = 0;
                p.maxLife = isSplash ? (0.6 + Math.random() * 0.3) : (0.5 + Math.random() * 0.4);
                
                if (isSplash) {
                    // Salpicadura azul / blanca
                    p.r = 0.6; p.g = 0.8; p.b = 1.0;
                    p.vy += 4.0; // Salpica más alto
                } else {
                    // Polvo de tierra o cemento
                    const brightness = 0.4 + Math.random() * 0.2;
                    p.r = brightness; p.g = brightness; p.b = brightness;
                }
                
                p.scale = isSplash ? (0.3 + Math.random() * 0.5) : (0.5 + Math.random() * 1.5);
                p.gravity = 5.0; 
                p.friction = 0.85; 
                
                spawned++;
            }
        }
    }

    emitDebris(x, y, z, count = 6, colorHex = 0x8B4513) {
        let spawned = 0;
        const baseColor = new THREE.Color(colorHex);
        for (let i = 0; i < 500 && spawned < count; i++) {
            const p = this.debrisParticles[i];
            if (!p.active) {
                p.active = true;
                p.x = x + (Math.random() - 0.5) * 2.0;
                p.y = y + Math.random() * 1.0;
                p.z = z + (Math.random() - 0.5) * 2.0;
                
                p.vx = (Math.random() - 0.5) * 15.0;
                p.vy = Math.random() * 12.0 + 8.0;
                p.vz = (Math.random() - 0.5) * 15.0;
                
                p.rx = Math.random() * Math.PI;
                p.ry = Math.random() * Math.PI;
                p.rz = Math.random() * Math.PI;
                p.vrx = (Math.random() - 0.5) * 15.0;
                p.vry = (Math.random() - 0.5) * 15.0;
                p.vrz = (Math.random() - 0.5) * 15.0;
                
                p.life = 0;
                p.maxLife = 1.0 + Math.random() * 1.5;
                p.bounceY = y - 0.5; // Aproxima el suelo donde detonó
                
                // Variar el color levemente para dar textura
                p.r = Math.max(0, Math.min(1, baseColor.r + (Math.random() - 0.5) * 0.2));
                p.g = Math.max(0, Math.min(1, baseColor.g + (Math.random() - 0.5) * 0.2));
                p.b = Math.max(0, Math.min(1, baseColor.b + (Math.random() - 0.5) * 0.2));
                this.debrisMesh.setColorAt(i, new THREE.Color(p.r, p.g, p.b));
                
                spawned++;
            }
        }
    }

    emitSparks(x, y, z, count = 20) {
        let spawned = 0;
        for (let i = 0; i < this.maxParticles && spawned < count; i++) {
            const p = this.particles[i];
            if (!p.active) {
                p.active = true;
                p.type = 'spark';
                p.x = x; p.y = y; p.z = z;
                
                // Explosión veloz
                p.vx = (Math.random() - 0.5) * 25.0;
                p.vy = Math.random() * 15.0 + 5.0;
                p.vz = (Math.random() - 0.5) * 25.0;
                
                p.life = 0;
                p.maxLife = 0.2 + Math.random() * 0.3; // Chispas mueren rápido
                
                // Naranja/Amarillo radiante
                p.r = 1.0; 
                p.g = 0.5 + Math.random() * 0.5; 
                p.b = 0.0;
                
                p.scale = 0.3 + Math.random() * 0.4;
                p.gravity = 30.0; // Caen pesadas pero su inercia inicial es brutal
                p.friction = 0.98; // Se frenan suavemente en el aire
                
                spawned++;
            }
        }
    }

    update(dt, camera) {
        let needsUpdate = false;

        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (p.active) {
                p.life += dt;
                
                if (p.life >= p.maxLife) {
                    p.active = false;
                    this.dummy.scale.set(0, 0, 0);
                    this.dummy.updateMatrix();
                    this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                    continue;
                }

                // Físicas Base
                p.vy -= p.gravity * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.z += p.vz * dt;
                p.vx *= p.friction;
                p.vz *= p.friction;

                // Atenuación Curvada (Fade Out Suavizado Logarítmico)
                const lifePct = p.life / p.maxLife;
                const fadeOut = 1.0 - Math.pow(lifePct, 2); 
                p.a = fadeOut;

                // Lógica Dinámica de Escalas (Scale Y encogiéndose vs Scale X)
                let scaleX = p.scale;
                let scaleY = p.scale;

                if (p.type === 'spark') {
                    // Chispas pierden volumen general, pero se encogen rápido
                    p.scale *= 0.92;
                    scaleX = p.scale;
                    scaleY = Math.max(0.01, p.scale * fadeOut * 2.0); // Se achata el Destello
                } else if (p.type === 'dust') {
                    // Polvo se disipa: Pierde altura (Fade-Out de Y) mientras su masa original fluye
                    p.scale += dt * 0.8; 
                    scaleX = p.scale;
                    scaleY = p.scale * fadeOut; // Efecto nube aplastándose al evaporarse
                } else if (p.type === 'splash') {
                    // Gotas de agua se estiran por la velocidad, como en wind waker
                    const velMag = Math.abs(p.vy);
                    scaleX = p.scale * fadeOut;
                    scaleY = Math.max(0.1, p.scale * (1.0 + velMag * 0.1) * fadeOut);
                }

                // Actualizar Matriz Espacial (Billboard Mode Tracking)
                this.dummy.position.set(p.x, p.y, p.z);
                this.dummy.scale.set(scaleX, scaleY, scaleX); // Z no rige visualmente en un plano 2D, pero empalmamos X
                if (camera) {
                    this.dummy.quaternion.copy(camera.quaternion); 
                }
                this.dummy.updateMatrix();
                
                this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
                
                // Mezcla de Pseudo Transparencia vía Color Base Multiplicado por FadeOut (Additive Blending)
                this.colorDummy.setRGB(p.r * p.a, p.g * p.a, p.b * p.a); 
                this.instancedMesh.setColorAt(i, this.colorDummy);
                
                needsUpdate = true;
            }
        }

        // Update 3D Debris
        let needsDebrisUpdate = false;
        for (let i = 0; i < 500; i++) {
            const p = this.debrisParticles[i];
            if (p.active) {
                p.life += dt;
                if (p.life >= p.maxLife) {
                    p.active = false;
                    this.dummy.scale.set(0, 0, 0);
                    this.dummy.updateMatrix();
                    this.debrisMesh.setMatrixAt(i, this.dummy.matrix);
                    needsDebrisUpdate = true;
                    continue;
                }
                
                p.vy -= 40.0 * dt; // Gravedad fuerte de rocas
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.z += p.vz * dt;
                
                p.rx += p.vrx * dt;
                p.ry += p.vry * dt;
                p.rz += p.vrz * dt;
                
                // Falso rebote en el piso de origen
                if (p.y < p.bounceY && p.vy < 0) {
                    p.y = p.bounceY;
                    p.vy *= -0.5;
                    p.vx *= 0.7;
                    p.vz *= 0.7;
                    p.vrx *= 0.5;
                    p.vry *= 0.5;
                    p.vrz *= 0.5;
                }
                
                // Encoger al morir suavemente
                const lifePct = p.life / p.maxLife;
                const scale = lifePct > 0.8 ? (1.0 - (lifePct - 0.8) * 5.0) : 1.0;
                
                this.dummy.position.set(p.x, p.y, p.z);
                this.dummy.rotation.set(p.rx, p.ry, p.rz);
                this.dummy.scale.set(scale, scale, scale);
                this.dummy.updateMatrix();
                this.debrisMesh.setMatrixAt(i, this.dummy.matrix);
                needsDebrisUpdate = true;
            }
        }

        // Commit GPU
        if (needsUpdate) {
            this.instancedMesh.instanceMatrix.needsUpdate = true;
            if (this.instancedMesh.instanceColor) {
                this.instancedMesh.instanceColor.needsUpdate = true;
            }
        }
        if (needsDebrisUpdate) {
            this.debrisMesh.instanceMatrix.needsUpdate = true;
            if (this.debrisMesh.instanceColor) {
                this.debrisMesh.instanceColor.needsUpdate = true;
            }
        }
    }
}
