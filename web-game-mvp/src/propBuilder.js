import * as THREE from 'three';
import MaterialManager from './materialManager.js';
import { createCylinder, createBox, createSphere } from './assets.js';

export const dynamicLights = [];

export function createTree(position) {
    const group = new THREE.Group();
    // Ahuejote Tronco (Esbelto y Recto, resistente al agua)
    const trunkMat = MaterialManager.getMaterial({ color: 0x5C4033, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 5, 8), trunkMat);
    trunk.position.set(0, 2.5, 0);

    // Follaje "Desparramado" usando Conos Alargados simulando ramas colgantes del Ahuejote
    const leavesMat = MaterialManager.getMaterial({ color: 0x1B4D3E, roughness: 1.0 });
    const crown = new THREE.Group();
    for (let i = 0; i < 7; i++) {
        const branch = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4.5, 5), leavesMat);
        branch.rotation.z = Math.PI / 5; // Cayendo verticalmente
        branch.rotation.y = (Math.PI * 2 / 7) * i;
        branch.position.y = -1;
        branch.position.x = Math.cos(branch.rotation.y) * 0.8;
        branch.position.z = Math.sin(branch.rotation.y) * 0.8;
        crown.add(branch);
    }
    crown.position.set(0, 5, 0);
    
    group.add(trunk, crown);
    group.traverse(c => { if(c.isMesh) c.castShadow = true; });
    if (position) group.position.set(position.x, position.y, position.z);
    return group;
}

export function createTule(position) {
    // Flora lacustre (Lirios y Carrizos)
    const group = new THREE.Group();
    const matOpts = MaterialManager.getMaterial({ color: 0x228B22, roughness: 0.9, side: THREE.DoubleSide });
    
    for(let i=0; i<6; i++){
        const height = 1.0 + Math.random();
        const reed = new THREE.Mesh(new THREE.PlaneGeometry(0.2, height), matOpts);
        reed.position.set((Math.random()-0.5)*1.5, height/2, (Math.random()-0.5)*1.5);
        reed.rotation.y = Math.random() * Math.PI;
        reed.castShadow = true;
        group.add(reed);
    }
    if (position) group.position.set(position.x, position.y, position.z);
    return group;
}

export function createPot(position) {
    // Vasijas ceremoniales Mexicas de tierra roja
    const group = new THREE.Group();
    const clayMat = MaterialManager.getMaterial({ color: 0xA0522D, roughness: 0.95 });
    
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 0.8, 12), clayMat);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.5, 12), clayMat);
    top.position.y = 0.65;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.3, 12), clayMat);
    neck.position.y = 1.05;
    
    group.add(base, top, neck);
    group.traverse(c => { if(c.isMesh) c.castShadow = true; });
    if (position) group.position.set(position.x, position.y + 0.4, position.z);
    return group;
}

export function createTeocalli(position) {
    // Rascacielos Prehispánico (Templo Mayor)
    const group = new THREE.Group();
    // Materiales Estocásticos (Fallback albedo)
    const stuccoR = MaterialManager.getMaterial({ color: 0x8B0000, roughness: 0.8 });
    const stuccoB = MaterialManager.getMaterial({ color: 0x0047AB, roughness: 0.8 });
    const stoneMat = MaterialManager.getMaterial({ color: 0x404040, roughness: 0.9 });

    // Basamento Piramidal de Inclinación Extrema
    let w = 24, d = 20, h = 4, y = 2;
    for(let i=0; i<4; i++) {
        const tier = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
        tier.position.y = y;
        group.add(tier);
        y += h;
        w -= 4; d -= 4; // Inclinación ~45 grados
    }
    
    // Adoratorios Gemelos
    y -= h/2; // Altura tope
    const shrineB = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4), stuccoB);
    shrineB.position.set(-4, y + 2.5, -2);
    
    const shrineR = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4), stuccoR);
    shrineR.position.set(4, y + 2.5, -2);
    
    group.add(shrineB, shrineR);
    group.traverse(c => { if(c.isMesh) c.castShadow = true; c.receiveShadow = true; });
    
    if (position) group.position.set(position.x, position.y, position.z);
    return group;
}

export function createRock(position) {
    const radius = 1 + Math.random() * 2;
    const geometry = new THREE.DodecahedronGeometry(radius, 1);
    
    // Deformación aleatoria estilo N64
    const posAttribute = geometry.attributes.position;
    for(let i=0; i<posAttribute.count; i++){
        posAttribute.setY(i, posAttribute.getY(i) * 0.8); // Achatamos la roca
    }
    
    const material = MaterialManager.getMaterial({ textureUrl: '/textures/stone.png', repeat: [2, 2] });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (position) mesh.position.set(position.x, position.y + radius*0.8, position.z); // Cae a nivel
    return mesh;
}

export function createTorch(position) {
    const group = new THREE.Group();
    const baseMatOpts = { color: '#8B4513' };
    const base = createBox(0.4, 1.5, 0.4, baseMatOpts);
    base.position.set(0, 0.75, 0);
    
    const fireMatOpts = { color: '#FFA500', roughness: 0.1 };
    const fire = createSphere(0.4, fireMatOpts);
    fire.position.set(0, 1.8, 0);
    // Se delega al VFXManager el humo o las chispas subsecuentes dentro del loop externo
    
    // Luz volumétrica local
    const pointLight = new THREE.PointLight(0xFFA500, 1.5, 12);
    pointLight.position.set(0, 2, 0);
    dynamicLights.push(pointLight); // Registrado para Animación de Parpadeo Constante
    
    group.add(base, fire, pointLight);
    if (position) group.position.set(position.x, position.y, position.z);
    return group;
}
