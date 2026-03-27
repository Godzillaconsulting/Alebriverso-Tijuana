import * as THREE from 'three';
import { createBox, createCylinder, createSphere, collidables, grabbables, waterSwitches, npcs, addCollidable } from './assets.js';
import { playCollectSound, playLandSound, playRedCoinSound, playStarSound } from './audio.js';
import { spatialGrid } from './spatialHash.js';
import MaterialManager from './materialManager.js';

// ==========================================================
// GemBuffer: Buffer de posiciones de gemas en Float32Array
// La CPU lee 3 floats contiguos por gema — cache line perfecto.
// Comparado con perseguir punteros de objetos dispersos en heap.
// Soporta hasta MAX_GEMS gemas simultáneas.
// ==========================================================
const MAX_GEMS = 256;

class GemBuffer {
    constructor() {
        // [x0, y0, z0, x1, y1, z1 ... x255, y255, z255]
        this.positions = new Float32Array(MAX_GEMS * 3);
        // Punteros a los THREE.Object3D de cada slot (arreglo de punteros)
        this.objects   = new Array(MAX_GEMS).fill(null);
        // Metadatos compactos (bitfield): bit0=isStar, bit1=isKey, bit2=isRedCoin, bit3=alive
        this.flags     = new Uint8Array(MAX_GEMS);
        this.count     = 0;
    }

    /** Agrega una gema y retorna su slot ID. O(1) amortizado */
    add(group, isStar = false, isKey = false, isRedCoin = false) {
        if (this.count >= MAX_GEMS) return -1;
        const slot = this.count++;
        this.objects[slot] = group;
        this.positions[slot * 3]     = group.position.x;
        this.positions[slot * 3 + 1] = group.position.y;
        this.positions[slot * 3 + 2] = group.position.z;
        this.flags[slot] = 0b1000 | (isStar ? 0b001 : 0) | (isKey ? 0b010 : 0) | (isRedCoin ? 0b100 : 0);
        return slot;
    }

    /** Elimina un slot intercambiándolo con el último (swap-and-pop). O(1). */
    remove(slot) {
        if (slot < 0 || slot >= this.count) return;
        const last = this.count - 1;
        if (slot !== last) {
            // Copiar posición del último al slot eliminado
            this.positions[slot * 3]     = this.positions[last * 3];
            this.positions[slot * 3 + 1] = this.positions[last * 3 + 1];
            this.positions[slot * 3 + 2] = this.positions[last * 3 + 2];
            this.objects[slot] = this.objects[last];
            this.flags[slot]   = this.flags[last];
        }
        this.objects[last] = null;
        this.flags[last]   = 0;
        this.count--;
    }

    clear() {
        this.count = 0;
        this.objects.fill(null);
    }

    get length() { return this.count; } // Retrocompatibilidad
}

export class GameManager {
    constructor(scene, vfxManager) {
        this.scene = scene;
        this.vfxManager = vfxManager;
        
        // GemBuffer: arreglo plano de posiciones cache-friendly (en vez de Object[] disperso)
        this._gemBuffer = new GemBuffer();
        // Proxy de array para retrocompatibilidad (se usa en assets.js que hace gems.push)
        this.gems = { length: 0, push: (g) => this._gemBuffer.add(g, g.userData.isStar, g.userData.isKey, g.userData.isRedCoin) };
        this.doors = [];
        this.switches = [];
        this.score = 0;
        
        // Dungeon Crawler Inventory
        this.keysCollected = []; 
        
        // N64 Logic Paradigms
        this.redCoinsCollected = 0;
        this.starMarkerPos = new THREE.Vector3(0, 10, 0); // Default fallback
        this.eventTimer = 0;
        this.temporaryPlatforms = [];
        this.timerSwitches = [];
    }
    
    clear() {
        // Limpiar el GemBuffer correctamente (no el proxy sin length)
        this._gemBuffer.clear();
        this.doors.length = 0;
        this.switches.length = 0;
        this.keysCollected.length = 0; 
        this.redCoinsCollected = 0;
        this.eventTimer = 0;
        this.timerSwitches.length = 0;
        this.temporaryPlatforms.forEach(p => {
            if(p.geometry) p.geometry.dispose();
            if(p.material) p.material.dispose();
        });
        this.temporaryPlatforms.length = 0;
    }
    
    spawnDoor(data) {
        const mesh = createBox(data.size.width, data.size.height, data.size.depth, { color: data.color || 0x444444 });
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        this.scene.add(mesh);
        
        // Convertirse legalmente en muro tangible del mundo
        collidables.push(mesh);
        
        this.doors.push({
            id: data.id,
            mesh: mesh,
            originalY: data.position.y,
            targetY: data.position.y - data.size.height * 0.95, // Se sepulta abajo al 95%
            isOpen: false,
            isLocked: data.isLocked || false // Zelda Style Lock
        });
    }

    spawnSwitch(data) {
        const mesh = createCylinder(0.8, 0.8, 0.2, { color: 0xff0000, roughness: 0.1, metalness: 0.8 });
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        this.scene.add(mesh);
        
        this.switches.push({
            id: data.id,
            targetDoor: data.targetDoor,
            mesh: mesh,
            originalY: data.position.y,
            isPressed: false
        });
    }
    
    spawnTimerSwitch(data) {
        const mesh = createCylinder(1.2, 1.2, 0.3, { color: 0x0044ff, roughness: 0.2, metalness: 0.9 });
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        this.scene.add(mesh);
        
        this.timerSwitches.push({
            id: data.id,
            duration: data.duration || 15.0, // Segundos
            mesh: mesh,
            originalY: data.position.y,
            isPressed: false
        });
    }
    
    spawnWaterSwitch(data) {
        // Un diamante de cristal azul
        const mesh = createBox(1, 1.5, 1, { color: 0x00ffff, roughness: 0.0, metalness: 1.0 });
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        this.scene.add(mesh);
        
        collidables.push(mesh);
        
        waterSwitches.push({
            id: data.id,
            mesh: mesh,
            originalY: data.position.y,
            targetWaterLevel: data.targetWaterLevel || 0,
            isActivated: false
        });
    }
    
    spawnNPC(data) {
        // Representado por un obelisco de piedra tallada (Letrero) 
        const mesh = createCylinder(0.5, 0.5, 2.0, { color: 0xcccccc, roughness: 0.9 });
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        this.scene.add(mesh);
        
        collidables.push(mesh);
        
        npcs.push({
            id: data.id,
            mesh: mesh,
            dialogue: data.dialogue || ["Nada está escrito."]
        });
    }
    
    spawnObsidianStone(x, y, z) {
        // Procedural Obsidian Crystal
        const group = new THREE.Group();
        const gemMat = MaterialManager.getMaterial({ color: 0x221144, roughness: 0.1, metalness: 0.9 });
        
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 5), gemMat);
        const bot = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 5), gemMat);
        bot.rotation.x = Math.PI;
        bot.position.y = -1.2;
        
        group.add(top, bot);
        group.scale.set(0.6, 0.6, 0.6);
        group.position.set(x, y + 0.5, z);
        
        group.userData = { isStar: false };
        this.scene.add(group);
        this.gems.push(group);
    }
    
    spawnStar(data) {
        // Procedural Mario 64 Ring Star
        const group = new THREE.Group();
        const matStar = MaterialManager.getMaterial({
            color: 0xFFD700, roughness: 0.1, metalness: 1.0, 
            emissive: 0xB8860B, emissiveIntensity: 0.5
        });
        
        const starMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), matStar);
        const haloMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1.6, 0.08, 16, 32), 
            new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 })
        );
        haloMesh.rotation.x = Math.PI / 2;
        
        const light = new THREE.PointLight(0xFFD700, 2.0, 10);
        
        group.add(starMesh, haloMesh, light);
        group.position.set(data.position.x, data.position.y + 1.0, data.position.z);
        group.userData = { isStar: true, isKey: false, id: data.id };
        
        this.scene.add(group);
        this.gems.push(group);
    }
    
    spawnRedCoin(data) {
        const group = new THREE.Group();
        const matCoin = MaterialManager.getMaterial({
            color: 0xff1111, roughness: 0.2, metalness: 0.8, 
            emissive: 0x880000, emissiveIntensity: 0.6
        });
        const coinMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), matCoin);
        const light = new THREE.PointLight(0xff0000, 1.2, 4);
        group.add(coinMesh, light);
        group.position.set(data.position.x, data.position.y, data.position.z);
        group.userData = { isRedCoin: true };
        
        this.scene.add(group);
        this.gems.push(group);
    }
    
    setStarMarker(x, y, z) {
        this.starMarkerPos.set(x, y, z);
    }
    
    spawnKey(x, y, z, targetDoor) {
        // Procedural Zelda Boss Key
        const group = new THREE.Group();
        const matKey = MaterialManager.getMaterial({ 
            color: 0x00ffaa, roughness: 0.2, metalness: 0.9, 
            emissive: 0x004422 
        });
        
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5, 12), matKey);
        shaft.rotation.z = Math.PI / 2;
        
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 12, 24), matKey);
        ring.position.x = -0.75;
        
        const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.1), matKey);
        tooth1.position.set(0.5, -0.2, 0);
        
        const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.1), matKey);
        tooth2.position.set(0.2, -0.15, 0);
        
        const light = new THREE.PointLight(0x00ffaa, 1.5, 5);
        
        group.add(shaft, ring, tooth1, tooth2, light);
        group.position.set(x, y, z);
        group.userData = { isStar: false, isKey: true, targetDoor: targetDoor };
        
        this.scene.add(group);
        this.gems.push(group);
    }
    
    update(delta, playerPosition) {
        const rotationSpeed = 2 * delta;
        
        // === Puzzles Lógicos de Físicas (Switches de Presión) ===
        this.switches.forEach(sw => {
            let isHeavy = false;
            
            // 1. Revisa si el jugador está parado arriba
            if (playerPosition.distanceTo(sw.mesh.position) < 1.5) {
                isHeavy = true;
            } else {
                // 2. Revisa si una caja/vasija/roca (Grabbables libres) aplasta el botón
                for (let i = 0; i < grabbables.length; i++) {
                    const rock = grabbables[i];
                    if (rock.parent === this.scene) { // NO esta cargada en las manos
                        const dx = rock.position.x - sw.mesh.position.x;
                        const dz = rock.position.z - sw.mesh.position.z;
                        // Prisma de escaneo horizontal
                        if (Math.hypot(dx, dz) < 1.0 && Math.abs(rock.position.y - sw.mesh.position.y) < 2.5) {
                            isHeavy = true;
                            break;
                        }
                    }
                }
            }
            
            if (isHeavy !== sw.isPressed) {
                sw.isPressed = isHeavy;
                playLandSound(); // Audio "Click / Clunk" Pesado
                
                // Mapeo Cinético a la Puerta Objetivo
                const door = this.doors.find(d => d.id === sw.targetDoor);
                if (door) door.isOpen = sw.isPressed;
            }
            
            // Animación lerpeada magnética del botón (Pulsación material)
            sw.mesh.position.y = THREE.MathUtils.lerp(sw.mesh.position.y, sw.originalY - (sw.isPressed ? 0.18 : 0), delta * 5);
        });
        
        // === Tick-Tock P-Switches ===
        this.timerSwitches.forEach(ts => {
            let isHeavy = false;
            if (playerPosition.distanceTo(ts.mesh.position) < 1.5) {
                isHeavy = true;
            }
            if (isHeavy && !ts.isPressed) {
                ts.isPressed = true;
                playLandSound(); // Click
                this.startEventTimer(ts.duration);
            }
            // Los botones azules de SM64 no se despulsan hasta que el evento acaba
            if (this.eventTimer <= 0) ts.isPressed = false;
            ts.mesh.position.y = THREE.MathUtils.lerp(ts.mesh.position.y, ts.originalY - (ts.isPressed ? 0.25 : 0), delta * 5);
        });
        
        // === Logic Tick-Tock Timer ===
        if (this.eventTimer > 0) {
            this.eventTimer -= delta;
            // Intermitencia al acabar (Opacidad Parpadeante)
            if (this.eventTimer < 3.0) {
                this.temporaryPlatforms.forEach(p => {
                    p.material.opacity = Math.floor(this.eventTimer * 10) % 2 === 0 ? 0.5 : 0.1;
                });
            }
            if (this.eventTimer <= 0) {
                // PURGA VRAM + SpatialGrid
                this.temporaryPlatforms.forEach(p => {
                    this.scene.remove(p);
                    spatialGrid.remove(p); // Eliminar del grid para no dejar phantom de colisión
                    p.geometry.dispose();
                    p.material.dispose();
                    const idx = collidables.indexOf(p);
                    if (idx > -1) collidables.splice(idx, 1);
                });
                this.temporaryPlatforms.length = 0;
                playCollectSound();
            }
        }
        
        // === Animación Orgánica y Validación de Muros/Candados ===
        this.doors.forEach(door => {
            // Checkeo Físico de Llaves (Proximidad)
            if (door.isLocked && !door.isOpen && this.keysCollected.includes(door.id)) {
                // Si tienes la llave y chocas/te acercas mucho a la puerta de ese candado
                const distToDoor = new THREE.Vector2(door.mesh.position.x, door.mesh.position.z).distanceTo(new THREE.Vector2(playerPosition.x, playerPosition.z));
                if (distToDoor < 3.5) {
                    door.isOpen = true; // Consumimos la cerradura visualmente
                    playLandSound();
                    if(this.vfxManager) this.vfxManager.createSparks(door.mesh.position, 15);
                    window.dispatchEvent(new CustomEvent('keyUsed')); // Notifica actualización reactiva del UI
                }
            }
            
            const target = door.isOpen ? door.targetY : door.originalY;
            door.mesh.position.y = THREE.MathUtils.lerp(door.mesh.position.y, target, delta * 2.5);
            // Sincronizar Físicas de Motor (MatrixWorld)
            if (Math.abs(door.mesh.position.y - target) > 0.05) {
                door.mesh.updateMatrixWorld();
            }
        });
        
        // === Gemas Recompensa (Float) — GemBuffer O(1) swap-and-pop ===
        const gb = this._gemBuffer;
        const sinBob = Math.sin(Date.now() * 0.005) * 0.005;
        const rotDelta = 2 * delta;
        // Iteramos hacia atrás para que swap-and-pop no salte slots al borrar
        for (let i = gb.count - 1; i >= 0; i--) {
            const gem = gb.objects[i];
            if (!gem) continue;

            // Animación Orbitón
            gem.rotation.y += rotDelta;
            gem.position.y  += sinBob;

            // Sincronizar posición en buffer (la gema puede haber bobbed)
            gb.positions[i * 3 + 1] = gem.position.y;

            // Colisión via distancia cuadrática (sin sqrt)
            const dx = playerPosition.x - gb.positions[i * 3];
            const dy = playerPosition.y - gb.positions[i * 3 + 1];
            const dz = playerPosition.z - gb.positions[i * 3 + 2];
            const distSq = dx*dx + dy*dy + dz*dz;
            const isStar = (gb.flags[i] & 0b001) !== 0;
            const radiusSq = isStar ? 2.5*2.5 : 1.5*1.5;

            if (distSq < radiusSq) {
                this.collectGem(i);
            }
        }
    }
    
    collectGem(index) {
        const gb = this._gemBuffer;
        const gem = gb.objects[index];
        if (!gem) return;

        const isStar    = (gb.flags[index] & 0b001) !== 0;
        const isKey     = (gb.flags[index] & 0b010) !== 0;
        const isRedCoin = (gb.flags[index] & 0b100) !== 0;
        const starId    = gem.userData.id;
        const targetDoor = gem.userData.targetDoor;
        
        if(this.vfxManager) this.vfxManager.createSparks(gem.position, isStar ? 50 : 15);
        if (isStar)      playStarSound();
        else if (isRedCoin) playRedCoinSound();
        else             playCollectSound();
        
        this.scene.remove(gem);
        // swap-and-pop O(1) — no Array.splice
        gb.remove(index);
        
        if (isKey) {
            this.keysCollected.push(targetDoor);
            window.dispatchEvent(new CustomEvent('keyCollected', { detail: { door: targetDoor } }));
        } else if (isRedCoin) {
            this.redCoinsCollected++;
            window.dispatchEvent(new CustomEvent('redCoinCollected', { detail: { count: this.redCoinsCollected } }));
            if (this.redCoinsCollected === 8) {
                playLandSound();
                if(this.vfxManager) this.vfxManager.createSparks(this.starMarkerPos, 100);
                this.spawnStar({ position: { x: this.starMarkerPos.x, y: this.starMarkerPos.y, z: this.starMarkerPos.z }, id: 'redCoinsReward' });
            }
        } else if (isStar) {
            window.dispatchEvent(new CustomEvent('starCollected', { detail: { id: starId } }));
        } else {
            this.score += 10;
            window.dispatchEvent(new CustomEvent('scoreUpdate', { detail: { score: this.score } }));
        }
    }
    
    startEventTimer(seconds) {
        if (this.eventTimer <= 0) {
            this.eventTimer = seconds;
            this.spawnTemporaryPlatforms();
        }
    }
    
    spawnTemporaryPlatforms() {
        for (let i = 0; i < 4; i++) {
            const matOpts = { color: 0x88ccff, roughness: 0.1, transparent: true, opacity: 0.5 };
            const plat = createBox(4, 1, 4, matOpts);
            plat.position.set(0 + (i * 6), 5 + (i * 4), -20);
            this.scene.add(plat);
            collidables.push(plat);
            // Insertar en SpatialGrid para que el jugador las detecte O(k)
            spatialGrid.insert(plat);
            this.temporaryPlatforms.push(plat);
        }
    }
}
