import * as THREE from 'three';

/**
 * Physics.js
 * Especialista Motor de Colisiones (Vanguardia Raycast + AABB)
 * Elevado al modelo Raycaster para permitir Slopes Universales en cualquier Malla.
 */
export default class Physics {
    
    static raycaster = new THREE.Raycaster();
    static downVector = new THREE.Vector3(0, -1, 0);

    /**
     * Resuelve colisión de piso (Motor Raycaster)
     * Extrae `point.y` y `face.normal` para soportar colinas suaves, pirámides y laderas.
     */
    static checkFloorCollision(player, platforms) {
        if (!window.sceneStaticGroup || window.sceneStaticGroup.children.length === 0) return null;

        // Vector de casteo: Desde el abdomen hacia abajo
        const origin = new THREE.Vector3(player.x, player.y + player.height / 2, player.z);
        Physics.raycaster.set(origin, Physics.downVector);

        // Intersecamos con el mundo de mallas
        const intersects = Physics.raycaster.intersectObjects(window.sceneStaticGroup.children, false);

        // Filtramos hitos válidos (Ignorar paredes completamente verticales para el 'piso')
        const validHits = intersects.filter(hit => hit.face && hit.face.normal.y > 0.05);

        if (validHits.length > 0) {
            const hit = validHits[0];
            const floorY = hit.point.y;

            // Ventana de perdón de Frame-Drop: Si el jugador cayó muy rápido entre frames
            if (player.y >= floorY - 3.5) {
                const platData = hit.object.userData;
                return {
                    y: floorY,
                    normal: hit.face.normal,
                    platform: platData, // Heredar propiedades (movimiento, tipo)
                    isLava: platData.isLava === true || platData.type === 'lava',
                    isIce: platData.isIce === true,
                    isMud: platData.isMud === true
                };
            }
        }
        return false;
    }

    /**
     * Resuelve intersección radial con los Cañones distribuidos en el mapa.
     */
    static checkCannonIntersection(player, platforms) {
        if (!platforms) return null;
        for (const plat of platforms) {
            if (plat.type === 'cannon') {
                const dist = Math.hypot(player.x - plat.position.x, player.z - plat.position.z);
                if (dist < player.radius + 1.5 && Math.abs(player.y - plat.position.y) < 3.0) {
                    return plat;
                }
            }
        }
        return null;
    }
    /**
     * Resuelve colisión lateral (Rebota en Paredes).
     * Intersección Cilíndrica/AABB de la posición futura
     */
    static checkWallCollision(player, platforms) {
        let hitWall = false;

        // Doble pasada (Sweep) para resolver empujes cruzados en esquinas que harían atravesar paredes adyacentes
        for (let iter = 0; iter < 2; iter++) {
            for (const plat of platforms) {
                const hw = plat.size.width / 2;
                const hh = plat.size.height / 2;
                const hd = plat.size.depth / 2;

                const px = plat.position.x;
                const py = plat.position.y;
                const pz = plat.position.z;

                // Expandimos el AABB de la plataforma por el radio del jugador
                const minX = px - hw - player.radius;
                const maxX = px + hw + player.radius;
                const minZ = pz - hd - player.radius;
                const maxZ = pz + hd + player.radius;
                
                const bottomY = py - hh;
                const topY = py + hh;

                // Solo comprobamos paredes si el jugador está "dentro" del rango de Y (altura) de la caja
                if (player.y - (player.height * 0.9) < topY && player.y + (player.height * 0.9) > bottomY) {
                    
                    // Si el jugador intersecta X/Z
                    if (player.x > minX && player.x < maxX && player.z > minZ && player.z < maxZ) {
                        
                        hitWall = true;

                        // Averiguar de qué pared salimos (menor distancia de superposición)
                        const overlapXLeft = player.x - minX;
                        const overlapXRight = maxX - player.x;
                        const overlapZBack = player.z - minZ;
                        const overlapZFront = maxZ - player.z;

                        const minOverlap = Math.min(overlapXLeft, overlapXRight, overlapZBack, overlapZFront);

                        if (minOverlap === overlapXLeft) {
                            player.x = minX;
                        } else if (minOverlap === overlapXRight) {
                            player.x = maxX;
                        } else if (minOverlap === overlapZBack) {
                            player.z = minZ;
                        } else if (minOverlap === overlapZFront) {
                            player.z = maxZ;
                        }
                    }
                }
            }
        }
        
        return hitWall;
    }
}
