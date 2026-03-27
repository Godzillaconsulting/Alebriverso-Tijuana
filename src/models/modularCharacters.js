import * as THREE from 'three';
import MaterialManager from '../../web-game-mvp/src/materialManager.js';

// ==========================================
// FUNCIONES BASE DE CONSTRUCCIÓN MODULAR
// (Emulando Display Lists de SM64)
// Añadidas texturas URL
// ==========================================

export function createSphere(radius, color, position, textureUrl = '') {
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = MaterialManager.getMaterial({ color, textureUrl });
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function createBox(width, height, depth, color, position, pivotY = 0, textureUrl = '') {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.translate(0, pivotY, 0);
    const material = MaterialManager.getMaterial({ color, textureUrl });
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function createCylinder(radius, height, color, position, pivotY = 0, textureUrl = '') {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    geometry.translate(0, pivotY, 0);
    const material = MaterialManager.getMaterial({ color, textureUrl });
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function createGroup(parts, position) {
    const group = new THREE.Group();
    parts.forEach(part => {
        if (part) group.add(part);
    });
    if (position) group.position.set(position.x, position.y, position.z);
    return group;
}

// ==========================================
// ENSAMBLADORES DE PERSONAJES
// ==========================================

/**
 * Crea al Protagonista (Aldeano)
 */
export function createProtagonist(colors = {}, proportions = 1) {
    const skinColor = colors.skin || 0xE2A979;
    const tunicColor = colors.tunic || 0xD0BA90;
    const loinclothColor = colors.loincloth || 0xAD5B34;
    const hairColor = colors.hair || 0x1A1A1A;
    const detailColor = colors.detail || 0x3BB1A1;
    
    const texture = '/textures/aldeano_frente.jpg';

    const pelvis = new THREE.Group();

    // Torso con fototextura mapeada
    const torso = createBox(1.2, 1.5, 0.8, tunicColor, { x: 0, y: 0.75, z: 0 }, 0, texture);
    const loincloth = createBox(0.6, 0.8, 0.1, loinclothColor, { x: 0, y: -0.4, z: 0.45 });
    pelvis.add(torso);
    pelvis.add(loincloth);

    // Cabeza con fototextura mapeada
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.6, 0); 
    const headBase = createBox(1, 1, 1, skinColor, null, 0, texture);
    const hair = createBox(1.1, 0.4, 1.1, hairColor, { x: 0, y: 0.5, z: 0 });
    const headband = createBox(1.15, 0.2, 1.15, detailColor, { x: 0, y: 0.2, z: 0 });
    headGroup.add(headBase, hair, headband);
    torso.add(headGroup);

    // Extremidades sin textura para no sobrecargar el render estilo ps1
    const upperArmL = createBox(0.4, 0.8, 0.4, skinColor, { x: 0.8, y: 1.3, z: 0 }, -0.4); 
    const lowerArmL = createBox(0.35, 0.8, 0.35, skinColor, { x: 0, y: -0.8, z: 0 }, -0.4);
    const handL = createBox(0.3, 0.4, 0.3, skinColor, { x: 0, y: -0.8, z: 0 });
    lowerArmL.add(handL);
    upperArmL.add(lowerArmL);
    torso.add(upperArmL);

    const upperArmR = createBox(0.4, 0.8, 0.4, skinColor, { x: -0.8, y: 1.3, z: 0 }, -0.4); 
    const lowerArmR = createBox(0.35, 0.8, 0.35, skinColor, { x: 0, y: -0.8, z: 0 }, -0.4);
    const handR = createBox(0.3, 0.4, 0.3, skinColor, { x: 0, y: -0.8, z: 0 });
    lowerArmR.add(handR);
    upperArmR.add(lowerArmR);
    torso.add(upperArmR);

    const thighL = createBox(0.5, 0.9, 0.5, skinColor, { x: 0.3, y: 0, z: 0 }, -0.45);
    const calfL = createBox(0.45, 0.9, 0.45, skinColor, { x: 0, y: -0.9, z: 0 }, -0.45);
    const footL = createBox(0.5, 0.3, 0.7, loinclothColor, { x: 0, y: -0.9, z: 0.1 }); 
    calfL.add(footL);
    thighL.add(calfL);
    pelvis.add(thighL);

    const thighR = createBox(0.5, 0.9, 0.5, skinColor, { x: -0.3, y: 0, z: 0 }, -0.45);
    const calfR = createBox(0.45, 0.9, 0.45, skinColor, { x: 0, y: -0.9, z: 0 }, -0.45);
    const footR = createBox(0.5, 0.3, 0.7, loinclothColor, { x: 0, y: -0.9, z: 0.1 });
    calfR.add(footR);
    thighR.add(calfR);
    pelvis.add(thighR);

    pelvis.scale.set(proportions, proportions, proportions);

    return pelvis;
}

/**
 * Crea a un Enemigo según su tipo invocando la textura en la cabeza o cuerpo
 */
export function createEnemy(type, colors = {}) {
    const root = new THREE.Group();

    switch (type.toLowerCase()) {
        case 'colibri': {
            const colBase = colors.base || 0x2DC4AD;
            const colAccent = colors.accent || 0xD313D4;
            const colBeak = colors.beak || 0xD5C0A1;
            const texC = '/textures/colibri_frente.jpg';

            const torsoColibri = createCylinder(0.8, 1.8, colBase, { x: 0, y: 1.5, z: 0 }, 0, texC);
            root.add(torsoColibri);

            const headColibri = createSphere(0.7, colBase, { x: 0, y: 1.2, z: 0 }, texC);
            const beak = createCylinder(0.1, 0.8, colBeak, { x: 0, y: 0, z: 0.7 });
            beak.rotation.x = Math.PI / 2;
            const headdress = createBox(1.5, 1, 0.2, colAccent, { x: 0, y: 0.8, z: -0.2 });
            headColibri.add(beak, headdress);
            torsoColibri.add(headColibri);

            const wingL = createBox(2.5, 0.8, 0.1, colAccent, { x: 1.8, y: 0.4, z: -0.5 });
            const wingR = createBox(2.5, 0.8, 0.1, colAccent, { x: -1.8, y: 0.4, z: -0.5 });
            torsoColibri.add(wingL, wingR);
            break;
        }

        case 'huitzilo': {
            const hBase = colors.base || 0x2DC4AD;
            const hAccent1 = colors.accent1 || 0xC513D4; 
            const hAccent2 = colors.accent2 || 0xFA7315;
            const texH = '/textures/huitzilo_frente.jpg';

            const torsoH = createBox(1.4, 2, 0.9, hBase, { x: 0, y: 1.8, z: 0 }, 0, texH);
            const skirtH = createCylinder(1.2, 1, hAccent1, { x: 0, y: -1, z: 0 });
            torsoH.add(skirtH);
            root.add(torsoH);

            const headH = createBox(1.2, 1.2, 1.2, hBase, { x: 0, y: 1.4, z: 0 }, 0, texH);
            const beakH = createCylinder(0.2, 0.6, hAccent2, { x: 0, y: -0.2, z: 0.8 });
            beakH.rotation.x = Math.PI / 2;
            const crownH = createCylinder(1.8, 0.4, hAccent1, { x: 0, y: 0.8, z: -0.4 });
            crownH.rotation.x = Math.PI / 2; 
            headH.add(beakH, crownH);
            torsoH.add(headH);
            
            const armLH = createBox(0.6, 1.2, 0.6, hBase, { x: 1, y: 0.8, z: 0 }, -0.6);
            const armRH = createBox(0.6, 1.2, 0.6, hBase, { x: -1, y: 0.8, z: 0 }, -0.6);
            torsoH.add(armLH, armRH);
            break;
        }

        case 'jaguar': {
            const jBody = colors.base || 0x110D1A; 
            const jMarkings = colors.markings || 0xFF8C00;
            const texJ = '/textures/jaguar_frente.jpg';

            const bodyJ = createCylinder(1, 3, jBody, { x: 0, y: 1.5, z: 0 }, 0, texJ);
            bodyJ.rotation.x = Math.PI / 2; 
            root.add(bodyJ);

            for(let i=0; i<3; i++) {
                const spike = createCylinder(0.2, 0.8, jBody, { x: 0, y: -0.8, z: -1 + (i*1) });
                spike.rotation.x = Math.PI / 2;
                bodyJ.add(spike);
            }

            const headJ = createSphere(0.8, jBody, { x: 0, y: 0.5, z: 1.8 }, texJ);
            const eye1 = createSphere(0.15, jMarkings, { x: 0.3, y: 0.2, z: 0.7 });
            const eye2 = createSphere(0.15, jMarkings, { x: -0.3, y: 0.2, z: 0.7 });
            headJ.add(eye1, eye2);
            bodyJ.add(headJ);

            const legFL = createCylinder(0.3, 1.5, jBody, { x: 0.7, y: 0.75, z: 1.2 }, -0.75);
            const legFR = createCylinder(0.3, 1.5, jBody, { x: -0.7, y: 0.75, z: 1.2 }, -0.75);
            const legBL = createCylinder(0.4, 1.5, jBody, { x: 0.7, y: 0.75, z: -1.2 }, -0.75);
            const legBR = createCylinder(0.4, 1.5, jBody, { x: -0.7, y: 0.75, z: -1.2 }, -0.75);
            root.add(legFL, legFR, legBL, legBR);
            break;
        }

        case 'serpiente': {
            const sBase = colors.base || 0x39FF14;
            const sAccent = colors.accent || 0xFF0000;
            const texS = '/textures/serpiente_frente.jpg';

            const coil1 = createCylinder(2, 0.8, sBase, { x: 0, y: 0.4, z: 0 });
            const coil2 = createCylinder(1.5, 0.8, sBase, { x: 0, y: 1.0, z: 0 });
            root.add(coil1, coil2);

            const neck = createCylinder(0.6, 2, sBase, { x: 0, y: 2.2, z: 0 });
            const headS = createBox(1.2, 1, 1.8, sBase, { x: 0, y: 1.2, z: 0.5 }, 0, texS);
            
            const jaw = createBox(1.0, 0.4, 1.6, sAccent, { x: 0, y: -0.6, z: 0 });
            const fangL = createCylinder(0.1, 0.5, 0xFFFFFF, { x: 0.3, y: -0.7, z: 0.6 });
            const fangR = createCylinder(0.1, 0.5, 0xFFFFFF, { x: -0.3, y: -0.7, z: 0.6 });
            headS.add(jaw, fangL, fangR);
            
            const eyeS1 = createSphere(0.2, sAccent, { x: 0.6, y: 0.2, z: 0.4 });
            const eyeS2 = createSphere(0.2, sAccent, { x: -0.6, y: 0.2, z: 0.4 });
            headS.add(eyeS1, eyeS2);

            neck.add(headS);
            root.add(neck);
            break;
        }

        default:
            console.warn(`Enemigo desconocido: ${type}`);
            break;
    }

    return root;
}
