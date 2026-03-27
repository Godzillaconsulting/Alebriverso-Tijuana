import * as THREE from 'three';
import { playLandSound, playJumpSound } from './audio.js';
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
        this.matGold.emissive = new THREE.Color(0x553300);
        
        this.matEye = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    }

    spawnTezcatlipoca(x, y, z) {
        const bossGroup = new THREE.Group();

        const face = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 2), this.matObsidian);
        face.position.y = 2.5;
        face.castShadow = true;

        const crown = new THREE.Mesh(new THREE.ConeGeometry(3, 4, 4), this.matGold);
        crown.position.y = 6.5;
        crown.rotation.y = Math.PI / 4;

        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), this.matEye.clone());
        eyeL.position.set(-1, 3, 1.1);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), this.matEye.clone());
        eyeR.position.set(1, 3, 1.1);

        const auraLight = new THREE.PointLight(0xff0055, 3.0, 20);
        auraLight.position.set(0, 3, 2);

        bossGroup.add(face, crown, eyeL, eyeR, auraLight);
        bossGroup.position.set(x, y + 5, z);

        bossGroup.userData = {
            isBoss: true,
            name: 'TEZCATLIPOCA',
            hp: 3,
            maxHp: 3,
            state: 'INTRO',
            timer: 0,
            origin: new THREE.Vector3(x, y + 5, z),
            bones: { face, crown, eyeL, eyeR },
            light: auraLight
        };

        this.scene.add(bossGroup);
        this.bosses.push(bossGroup);

        window.dispatchEvent(new CustomEvent('bossFightStart', {
            detail: { name: bossGroup.userData.name }
        }));
    }

    update(delta, player, weaponManager) {
        for (let i = this.bosses.length - 1; i >= 0; i--) {
            const boss = this.bosses[i];
            const ud = boss.userData;
            ud.timer += delta;

            switch (ud.state) {
                case 'INTRO':
                    boss.position.y = THREE.MathUtils.lerp(boss.position.y, ud.origin.y, delta);
                    boss.rotation.y += delta;
                    if (ud.timer > 4.0) { ud.state = 'FLOAT'; ud.timer = 0; }
                    break;

                case 'FLOAT': {
                    boss.position.y = ud.origin.y + Math.sin(Date.now() * 0.002) * 1.5;
                    const dir = new THREE.Vector3().subVectors(player.mesh.position, boss.position);
                    dir.y = 0;
                    if (dir.lengthSq() > 0.1) {
                        const targetYaw = Math.atan2(dir.x, dir.z);
                        const qTarget = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetYaw);
                        boss.quaternion.slerp(qTarget, delta * 2);
                        if (dir.length() > 15) {
                            boss.position.addScaledVector(dir.normalize(), delta * 8);
                        }
                    }
                    if (ud.timer > 5.0) {
                        ud.state = 'ATTACK';
                        ud.timer = 0;
                        ud.bones.eyeL.scale.set(1.5, 2, 1);
                        ud.bones.eyeR.scale.set(1.5, 2, 1);
                        playJumpSound();
                    }
                    break;
                }

                case 'ATTACK':
                    boss.position.y = ud.origin.y + Math.sin(Date.now() * 0.01) * 3.0;
                    if (ud.timer > 1.0 && ud.timer < 1.1) {
                        const distToPlayer = boss.position.distanceTo(player.mesh.position);
                        if (distToPlayer < 12.0) {
                            if (typeof player.takeDamage === 'function') player.takeDamage(boss.position);
                            if (this.vfxManager) {
                                this.vfxManager.createDustPuff(player.mesh.position, 12);
                                this.vfxManager.createSparks(boss.position, 8);
                            }
                            window.dispatchEvent(new CustomEvent('cameraShake', { detail: { duration: 0.4, intensity: 2.0 } }));
                        }
                        ud.timer = 1.2;
                    }
                    if (ud.timer > 2.0) {
                        ud.state = 'FLOAT';
                        ud.timer = 0;
                        ud.bones.eyeL.scale.set(1, 1, 1);
                        ud.bones.eyeR.scale.set(1, 1, 1);
                    }
                    break;

                case 'VULNERABLE':
                    boss.position.y = THREE.MathUtils.lerp(boss.position.y, ud.origin.y - 4, delta * 5);
                    boss.rotation.x = THREE.MathUtils.lerp(boss.rotation.x, Math.PI / 4, delta * 5);
                    boss.rotation.y += delta * 5;
                    ud.bones.eyeL.material.color.setHex(0x333333);
                    ud.bones.eyeR.material.color.setHex(0x333333);
                    ud.light.intensity = 0.5;
                    if (ud.timer > 6.0) {
                        ud.state = 'FLOAT';
                        ud.timer = 0;
                        boss.rotation.x = 0;
                        ud.bones.eyeL.material.color.setHex(0xff0055);
                        ud.bones.eyeR.material.color.setHex(0xff0055);
                        ud.light.intensity = 3.0;
                    }
                    break;

                case 'DEAD':
                    boss.scale.subScalar(delta * 2);
                    boss.rotation.y += delta * 15;
                    boss.position.y += delta * 10;
                    if (boss.scale.x <= 0) {
                        if (this.vfxManager) this.vfxManager.createSparks(boss.position, 100);
                        playLandSound();
                        this.scene.remove(boss);
                        this.bosses.splice(i, 1);
                        window.dispatchEvent(new CustomEvent('starCollected', { detail: { id: 'BOSS_STAR' } }));
                        window.dispatchEvent(new CustomEvent('bossHPUpdate', { detail: { hpPercentage: 0 } }));
                    }
                    continue;
            }

            // Damage detection: thrown massive objects
            if (ud.state !== 'DEAD' && ud.state !== 'VULNERABLE') {
                const thrown = player.thrownObjects;
                if (thrown && thrown.length > 0) {
                    for (let j = thrown.length - 1; j >= 0; j--) {
                        const rock = thrown[j];
                        if (!rock || !rock.userData) continue;
                        const velSq = rock.userData.velocity ? rock.userData.velocity.lengthSq() : 0;
                        const dx = rock.position.x - boss.position.x;
                        const dy = rock.position.y - boss.position.y;
                        const dz = rock.position.z - boss.position.z;
                        const inRange = dx * dx + dy * dy + dz * dz < 25;
                        if (velSq > 4 && inRange) {
                            if (rock.userData.isMassive) {
                                this.dealDamageToBoss(boss, 1);
                                if (this.vfxManager) this.vfxManager.createSparks(boss.position, 50);
                                playLandSound();
                                if (ud.hp > 0) { ud.state = 'VULNERABLE'; ud.timer = 0; }
                                this.scene.remove(rock);
                                thrown.splice(j, 1);
                            } else {
                                rock.userData.velocity.multiplyScalar(-0.8);
                                if (this.vfxManager) this.vfxManager.createDustPuff(boss.position, 5);
                            }
                        }
                    }
                }
            }
        }
    }

    dealDamageToBoss(boss, dmg) {
        boss.userData.hp = Math.max(0, boss.userData.hp - dmg);
        const pct = (boss.userData.hp / boss.userData.maxHp) * 100;
        window.dispatchEvent(new CustomEvent('bossHPUpdate', { detail: { hpPercentage: pct } }));

        boss.traverse(child => {
            if (child.isMesh && child.material && child.material.emissive) {
                const old = child.material.emissive.getHex();
                child.material.emissive.setHex(0xffffff);
                setTimeout(() => { if (child.material) child.material.emissive.setHex(old); }, 200);
            }
        });

        if (boss.userData.hp === 0) boss.userData.state = 'DEAD';
    }
}
