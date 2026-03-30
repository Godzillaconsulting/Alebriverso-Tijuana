import * as THREE from 'three';

class ParticleNode {
    constructor(mesh) {
        this.mesh = mesh;
        this.prev = null;
        this.next = null;
    }
}

class DoublyLinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
    }
    
    add(node) {
        if (!this.head) {
            this.head = node;
            this.tail = node;
        } else {
            this.tail.next = node;
            node.prev = this.tail;
            this.tail = node;
        }
    }
    
    remove(node) {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }
        
        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }
        
        node.prev = null;
        node.next = null;
    }
}

export class VFXManager {
    constructor(scene) {
        this.scene = scene;
        this.activeParticles = new DoublyLinkedList();
        
        // Pools Estáticos para prevenir Memory Leaks (Punteros a Nodos Libres)
        this.dustPool = [];
        this.sparkPool = [];
        this.waterPool = [];
        
        // Decal Ring Buffer (FIFO estricto para impactos)
        this.decals = [];
        this.decalIndex = 0;
        this.MAX_DECALS = 50;
        
        // Geometrías Compartidas
        const dustGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const sparkGeo = new THREE.TetrahedronGeometry(0.5, 0);
        const dropGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const decalGeo = new THREE.PlaneGeometry(0.5, 0.5);
        
        const baseDustMat = new THREE.MeshBasicMaterial({ color: 0x667766, transparent: true });
        const baseSparkMat = new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true });
        const baseWaterMat = new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.8 });
        
        // Materiales Estocásticos para Decals (Agujeros de bala negros y Sangre negra)
        // Se usa polygonOffset para evitar Z-Fighting severo contra las paredes
        const decalBulletMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.0, polygonOffsetUnits: -1.0 });
        const decalBloodMat = new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.0, polygonOffsetUnits: -1.0 });

        this.decalMaterials = {
            'bullet': decalBulletMat,
            'blood': decalBloodMat
        };

        // Pre-instanciar 50 Decals inactivos
        for (let i = 0; i < this.MAX_DECALS; i++) {
            const mesh = new THREE.Mesh(decalGeo, decalBulletMat);
            mesh.visible = false;
            this.scene.add(mesh);
            this.decals.push(mesh);
        }

        // Pre-instanciar 200 mallas de polvo
        for (let i = 0; i < 200; i++) {
            const mesh = new THREE.Mesh(dustGeo, baseDustMat.clone());
            mesh.visible = false;
            mesh.userData.isVFX = true;
            this.scene.add(mesh);
            this.dustPool.push(new ParticleNode(mesh));
        }
        
        // Pre-instanciar 100 mallas de chispa
        for (let i = 0; i < 100; i++) {
            const mesh = new THREE.Mesh(sparkGeo, baseSparkMat.clone());
            mesh.visible = false;
            mesh.userData.isVFX = true;
            this.scene.add(mesh);
            this.sparkPool.push(new ParticleNode(mesh));
        }

        // Pre-instanciar 100 mallas de agua
        for (let i = 0; i < 100; i++) {
            const mesh = new THREE.Mesh(dropGeo, baseWaterMat.clone());
            mesh.visible = false;
            mesh.userData.isVFX = true;
            this.scene.add(mesh);
            this.waterPool.push(new ParticleNode(mesh));
        }

        // Zonas de Viento Atmosférico
        this.windZones = [];
    }

    registerWindZone(min, max, force) {
        this.windZones.push({ min, max, force });
    }

    createDecal(pos, normal, type = 'bullet') {
        const decal = this.decals[this.decalIndex];
        this.decalIndex = (this.decalIndex + 1) % this.MAX_DECALS;
        
        decal.position.copy(pos);
        // Orientar el plano estrictamente apuntando FUERA de la normal
        const lookAtTarget = pos.clone().add(normal);
        decal.lookAt(lookAtTarget);
        
        // Asignar material según tipo y ligera variación de tamaño (RE4 Vibe)
        decal.material = this.decalMaterials[type] || this.decalMaterials['bullet'];
        const s = type === 'blood' ? Math.random() * 1.5 + 1.0 : Math.random() * 0.4 + 0.6;
        decal.scale.set(s, s, 1);
        
        decal.visible = true;
    }

    createDustPuff(pos, count = 4) {
        for (let i = 0; i < count; i++) {
            if (this.dustPool.length === 0) return; // Operación Segura O(1)
            
            const node = this.dustPool.pop();
            const p = node.mesh;
            
            p.position.copy(pos);
            p.position.x += (Math.random() - 0.5) * 1.5;
            p.position.z += (Math.random() - 0.5) * 1.5;
            p.position.y += Math.random() * 0.5;
            p.scale.set(1, 1, 1);
            p.material.opacity = 0.7;
            
            p.userData = {
                vel: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 2 + 1, (Math.random() - 0.5) * 5),
                life: 1.0,
                decay: Math.random() * 1.5 + 1.0,
                type: 'dust'
            };
            p.visible = true;
            this.activeParticles.add(node);
        }
    }

    createSparks(pos, count = 10) {
        for (let i = 0; i < count; i++) {
            if (this.sparkPool.length === 0) return;
            
            const node = this.sparkPool.pop();
            const p = node.mesh;
            
            p.position.copy(pos);
            p.scale.set(1, 1, 1);
            p.material.opacity = 1.0;
            
            p.userData = {
                vel: new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 8 + 4, (Math.random() - 0.5) * 12),
                life: 1.0,
                decay: 2.5,
                type: 'spark'
            };
            p.visible = true;
            this.activeParticles.add(node);
        }
    }

    createSplash(pos, count = 20) {
        for (let i = 0; i < count; i++) {
            if (this.waterPool.length === 0) return;
            
            const node = this.waterPool.pop();
            const p = node.mesh;
            
            p.position.copy(pos);
            // Distribuir en el anillo exterior para emular estallido de tensión local
            const angle = Math.random() * Math.PI * 2;
            const rad = Math.random() * 1.5;
            p.position.x += Math.cos(angle) * rad;
            p.position.z += Math.sin(angle) * rad;
            
            p.scale.set(1, 1.5, 1); // Gota elipsoide
            p.material.opacity = 0.9;
            
            p.userData = {
                vel: new THREE.Vector3(Math.cos(angle) * 8, Math.random() * 10 + 5, Math.sin(angle) * 8),
                life: 1.0,
                decay: 1.5,
                type: 'water'
            };
            p.visible = true;
            this.activeParticles.add(node);
        }
    }

    update(delta) {
        let current = this.activeParticles.head;
        while (current) {
            const nextNode = current.next; // Guardar puntero futuro antes de posible borrado cruzado O(1)
            const p = current.mesh;
            
            p.position.addScaledVector(p.userData.vel, delta);
            
            if (p.userData.type === 'spark') {
                p.userData.vel.y -= 25 * delta; 
                p.rotation.x += 15 * delta;
                p.rotation.y += 15 * delta;
                p.scale.multiplyScalar(0.92);
            } else {
                p.userData.vel.y -= 2 * delta; 
                p.scale.addScalar(delta * 1.5); 
            }

            p.userData.life -= p.userData.decay * delta;
            p.material.opacity = Math.max(0, p.userData.life);
            
            if (p.userData.life <= 0) {
                // Matar partícula y reciclarla arrojando su puntero al Pool Estático
                p.visible = false;
                this.activeParticles.remove(current);
                
                if (p.userData.type === 'spark') {
                    this.sparkPool.push(current);
                } else if (p.userData.type === 'wind') {
                    this.dustPool.push(current);
                } else if (p.userData.type === 'water') {
                    this.waterPool.push(current);
                } else {
                    this.dustPool.push(current);
                }
            }
            
            current = nextNode; // Continuar iteración en O(n) cruzando puente seguro
        }

        // Emitir Viento (Telegrafiado Visual)
        this.windZones.forEach(zone => {
            // Emite con más frecuencia según el tamaño de la fuerza ascendente
            if (zone.force.y > 0 && Math.random() < 0.15) {
                if (this.dustPool.length === 0) return;
                
                const pos = new THREE.Vector3(
                    THREE.MathUtils.randFloat(zone.min.x, zone.max.x),
                    THREE.MathUtils.randFloat(zone.min.y, zone.min.y + 2),
                    THREE.MathUtils.randFloat(zone.min.z, zone.max.z)
                );
                
                const node = this.dustPool.pop();
                const p = node.mesh;
                
                p.position.copy(pos);
                p.scale.set(0.2, 5.0 + Math.random() * 5.0, 0.2); // Forma de Lazo/Rayo
                p.material.opacity = 0.4;
                
                p.userData = {
                    vel: new THREE.Vector3(
                        zone.force.x * 0.2 + (Math.random() - 0.5), 
                        zone.force.y * 0.4 + Math.random() * 5, 
                        zone.force.z * 0.2 + (Math.random() - 0.5)
                    ),
                    life: 1.0,
                    decay: 0.8,
                    type: 'wind'
                };
                p.visible = true;
                this.activeParticles.add(node);
            }
        });
    }
}
