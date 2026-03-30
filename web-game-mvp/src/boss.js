import * as THREE from 'three';
import { playLandSound, playJumpSound, playEnemyGrowl, playEnemyHit } from './audio.js';
import materialManager from './materialManager.js';

export class BossManager {
    constructor(scene, vfxManager) {
        this.scene = scene;
        this.vfxManager = vfxManager;
        this.bosses = [];

        this.matObsidian = materialManager.getMaterial({
            color: 0x111111, roughness: 0.1, metalness: 0.9
        });
        this.matGold = materialManager.getMaterial({
            color: 0xFFD700, roughness: 0.2, metalness: 1.0
        });
        this.matGold.emissive = new THREE.Color(0x332200);
        
        this.matEye = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        this.matFeather = materialManager.getMaterial({
            color: 0x00cc66, roughness: 0.5, metalness: 0.0
        });
    }

    spawnQuetzalcoatl(x, y, z) {
        const bossGroup = new THREE.Group();

        // 1. Cabeza
        const headGroup = new THREE.Group();
        const face = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 5), this.matObsidian);
        face.castShadow = true;
        const crest = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 8), this.matGold);
        crest.position.set(0, 3.5, -1);
        crest.rotation.x = -Math.PI / 6;

        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), this.matEye.clone());
        eyeL.position.set(-1.2, 0.5, 2.6);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), this.matEye.clone());
        eyeR.position.set(1.2, 0.5, 2.6);

        const auraLight = new THREE.PointLight(0x00ffcc, 5.0, 25);
        auraLight.position.set(0, 0, 3);

        headGroup.add(face, crest, eyeL, eyeR, auraLight);
        bossGroup.add(headGroup);

        // 2. Segmentos del Cuerpo (Serpiente Emplumada)
        const segments = [];
        const numSegments = 6;
        for (let j = 0; j < numSegments; j++) {
            const segRadius = 1.8 - (j * 0.2); // Se achica hacia la cola
            const segGeo = new THREE.CylinderGeometry(segRadius, segRadius, 2.5, 8);
            const seg = new THREE.Mesh(segGeo, this.matFeather);
            seg.rotation.x = Math.PI / 2;
            seg.castShadow = true;
            
            // Falsas plumas laterales extruyendo torus
            const featherRing = new THREE.Mesh(new THREE.TorusGeometry(segRadius + 0.3, 0.2, 8, 12), this.matGold);
            seg.add(featherRing);
            
            // Posición base
            seg.position.set(0, 0, -(j+1) * 3);
            bossGroup.add(seg);
            segments.push({ mesh: seg, baseZ: -(j+1) * 3 }); // Guardar offset
        }

        bossGroup.position.set(x, y + 15, z);

        bossGroup.userData = {
            isBoss: true,
            name: 'QUETZALCOATL',
            hp: 15,
            maxHp: 15,
            state: 'FLYING', // FLYING, SWOOP, VULNERABLE, DEAD
            timer: 0,
            origin: new THREE.Vector3(x, y + 15, z),
            bones: { head: headGroup, eyeL, eyeR, segments },
            light: auraLight,
            theta: 0 // Ángulo orbital
        };

        this.scene.add(bossGroup);
        this.bosses.push(bossGroup);

        window.dispatchEvent(new CustomEvent('bossFightStart', {
            detail: { name: bossGroup.userData.name }
        }));
    }

    update(delta, player, weaponManager) {
        const time = Date.now() * 0.001;

        for (let i = this.bosses.length - 1; i >= 0; i--) {
            const boss = this.bosses[i];
            const ud = boss.userData;
            ud.timer += delta;

            switch (ud.state) {
                case 'FLYING': {
                    // Volar en un círculo gigante encima de la arena
                    ud.theta += delta * 0.6;
                    const r = 25; // Radio orbital
                    const targetX = ud.origin.x + Math.cos(ud.theta) * r;
                    const targetZ = ud.origin.z + Math.sin(ud.theta) * r;
                    const targetY = ud.origin.y + Math.sin(time * 2) * 3.0;
                    
                    const p1 = boss.position.clone();
                    boss.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), delta * 2);
                    
                    // Apuntar slerp hacia donde va moviéndose (Tangente del círculo)
                    const dir = new THREE.Vector3().subVectors(boss.position, p1).normalize();
                    if (dir.lengthSq() > 0.01) {
                        const targetYaw = Math.atan2(dir.x, dir.z);
                        const qTarget = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetYaw);
                        boss.quaternion.slerp(qTarget, delta * 4);
                    }

                    // Después de rondar un rato, buscar hacer swooping (picado)
                    if (ud.timer > 8.0) {
                        ud.state = 'SWOOP_PREP';
                        ud.timer = 0;
                        ud.bones.eyeL.scale.set(1.5, 3, 1);
                        ud.bones.eyeR.scale.set(1.5, 3, 1);
                        playEnemyGrowl(boss.position);
                    }
                    break;
                }

                case 'SWOOP_PREP': {
                    // Pausa en el aire mirando al jugador
                    boss.position.y += delta * 2; // Sube tantito para encarrerarse
                    const dirToPlayer = new THREE.Vector3().subVectors(player.mesh.position, boss.position);
                    const yaw = Math.atan2(dirToPlayer.x, dirToPlayer.z);
                    const qTarget = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
                    boss.quaternion.slerp(qTarget, delta * 5);
                    
                    if (ud.timer > 2.0) {
                        ud.state = 'SWOOP';
                        ud.timer = 0;
                        // Guardar la cota destino (El jugador en el piso)
                        ud.targetPos = player.mesh.position.clone();
                    }
                    break;
                }

                case 'SWOOP': {
                    // Bajada en picado rápido usando lerp tenso
                    boss.position.lerp(ud.targetPos, delta * 6); // Rápido
                    
                    // Si llega al piso (crash) o impacta jugador
                    const distToFloor = boss.position.distanceTo(ud.targetPos);
                    
                    if (distToFloor < 3.0) {
                        // Impacto en el piso (Falla) -> Queda Estrellado / Aturdido
                        ud.state = 'VULNERABLE';
                        ud.timer = 0;
                        window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.6, intensity: 2.5 } }));
                        playLandSound();
                        if (this.vfxManager) this.vfxManager.createDustPuff(boss.position, 30);
                    } else if (distToFloor < 15.0 && ud.timer < 1.0) { 
                        // Raycast heurístico para herir al jugador si se atraviesa
                        if (boss.position.distanceTo(player.mesh.position) < 4.0) {
                            if (typeof player.takeDamage === 'function') player.takeDamage(boss.position, 'frontal');
                            if (this.vfxManager) this.vfxManager.createSparks(player.mesh.position, 15);
                            window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.3, intensity: 1.5 } }));
                        }
                    }
                    break;
                }

                case 'VULNERABLE': {
                    // Queda atascado contra el suelo con la luz parpadeando débil
                    boss.rotation.x = THREE.MathUtils.lerp(boss.rotation.x, -Math.PI / 6, delta * 3);
                    ud.bones.eyeL.material.color.setHex(0x333333);
                    ud.bones.eyeR.material.color.setHex(0x333333);
                    ud.light.intensity = 0.5 + Math.random() * 0.5;
                    
                    // Durante este state es débil a Macuahuitl y Atlatl de forma pasiva
                    
                    if (ud.timer > 6.0) {
                        ud.state = 'FLYING';
                        ud.timer = 0;
                        boss.rotation.x = 0;
                        ud.bones.eyeL.material.color.setHex(0x00ffcc);
                        ud.bones.eyeR.material.color.setHex(0x00ffcc);
                        ud.bones.eyeL.scale.set(1, 1, 1);
                        ud.bones.eyeR.scale.set(1, 1, 1);
                        ud.light.intensity = 5.0;
                    }
                    break;
                }

                case 'DEAD': {
                    // Se desintegra como RE4
                    boss.position.y += delta * 2;
                    boss.traverse(c => {
                       if (c.material) c.material.opacity = Math.max(0, c.material.opacity - delta);
                       if (c.material) c.material.transparent = true;
                    });
                    
                    if (ud.timer > 3.0) {
                        if (this.vfxManager) this.vfxManager.createSparks(boss.position, 100);
                        playEnemyHit(boss.position);
                        this.scene.remove(boss);
                        this.bosses.splice(i, 1);
                        window.dispatchEvent(new CustomEvent('starCollected', { detail: { id: 'BOSS_STAR' } }));
                        window.dispatchEvent(new CustomEvent('bossHPUpdate', { detail: { hpPercentage: 0 } }));
                    }
                    continue; // Skip segment undulation
                }
            }

            // Ondulación procedimental de los segmentos corporales (Siempre activo excepto muertos)
            if (ud.state !== 'DEAD') {
                for (let k = 0; k < ud.bones.segments.length; k++) {
                    const segInfo = ud.bones.segments[k];
                    const offsetIndex = k + 1;
                    
                    // Movimiento serpenteante en el eje X local
                    const waveX = Math.sin(time * 5 + offsetIndex * 0.8) * (2.0 + offsetIndex*0.5);
                    const waveY = Math.cos(time * 4 + offsetIndex * 0.6) * 1.5;
                    
                    segInfo.mesh.position.x = THREE.MathUtils.lerp(segInfo.mesh.position.x, waveX, delta * 3);
                    segInfo.mesh.position.y = THREE.MathUtils.lerp(segInfo.mesh.position.y, waveY, delta * 3);
                    segInfo.mesh.position.z = segInfo.baseZ; 
                    
                    // Rotar escamas
                    segInfo.mesh.rotation.y = Math.sin(time * 5 + offsetIndex * 0.8) * 0.3;
                }
            }

            // Recepción de daño del arsenal del jugador 
            // 1. Proyectiles (Atlatl / Portal Gun Orbs)
            if (weaponManager && weaponManager.projectiles && ud.state !== 'DEAD') {
                for (let p of weaponManager.projectiles) {
                     // Solo recibe daño en la cabeza (`boss.position` es root = cabeza aprox)
                     if (p.mesh.position.distanceTo(boss.position) < 5.0) {
                         this.dealDamageToBoss(boss, p.damage || 1);
                         p.life = 0; // Matar proyectil
                         if (this.vfxManager) this.vfxManager.createSparks(p.mesh.position, 20);
                     }
                }
            }
            
            // 2. Jugador (Macuahuitl)
            if (player.userData && player.userData.state === 'MACUAHUITL_SWING') {
                if (boss.position.distanceTo(player.mesh.position) < 5.5 && !ud.hitFrame) {
                    this.dealDamageToBoss(boss, 3); // Daño masivo melee
                    if (this.vfxManager) this.vfxManager.createSparks(boss.position, 40);
                    ud.hitFrame = true; // i-frames para el jefe
                    setTimeout(()=> ud.hitFrame = false, 1000);
                }
            }
        }
    }

    dealDamageToBoss(boss, dmg) {
        if (boss.userData.state === 'DEAD') return;
        
        // Quetzalcoatl tiene escudo pasivo cuando VUELA. 
        // Si no está vulnerable, recibe daño al 20%
        let finalDmg = boss.userData.state === 'VULNERABLE' ? dmg : dmg * 0.2;
        
        boss.userData.hp = Math.max(0, boss.userData.hp - finalDmg);
        const pct = (boss.userData.hp / boss.userData.maxHp) * 100;
        window.dispatchEvent(new CustomEvent('bossHPUpdate', { detail: { hpPercentage: pct } }));

        boss.traverse(child => {
            if (child.isMesh && child.material && child.material.emissive) {
                const old = child.material.emissive.getHex();
                child.material.emissive.setHex(0xffffff);
                setTimeout(() => { if (child.material) child.material.emissive.setHex(old); }, 200);
            }
        });

        playEnemyHit(boss.position);

        if (boss.userData.hp === 0) {
            boss.userData.state = 'DEAD';
            boss.userData.timer = 0;
            // Oculta UI
            document.getElementById('boss-ui').style.display = 'none';
        }
    }
}
