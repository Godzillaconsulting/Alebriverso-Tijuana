export default class EnemyAI {
    constructor() {
        this.visionRange = 25.0; // Rango de visión circular en metros
        this.chaseSpeed = 7.0;   // Velocidad al atacar/perseguir
        this.patrolSpeed = 2.5;  // Velocidad al merodear pacíficamente
    }

    update(dt, enemiesList, enemyNodes, player) {
        // Ignorar lógicas si el jugador no existe o está indispuesto a jugar
        if (!player || player.currentState === player.STATES.DEAD || player.currentState === player.STATES.CELEBRATE) return;

        for (let i = 0; i < enemiesList.length; i++) {
            const enemy = enemiesList[i];
            
            // Si el enemigo fue marcado para perecer (aplastado/pateado), ignorarlo
            if (enemy.isDead) continue;
            
            if (enemy.type === 'pot') continue; // Las vasijas/jarrones no tienen inteligencia

            // Inicializar memoria neuronal de IA si acaba de aparecer
            if (!enemy.ai) {
                enemy.ai = {
                    state: 'IDLE',
                    homeX: enemy.position.x,
                    homeZ: enemy.position.z,
                    patrolAngle: Math.random() * Math.PI * 2,
                    patrolTimer: 0
                };
            }

            // Distancia Cartesiana contra el Jugador Iguana
            const dx = player.x - enemy.position.x;
            const dz = player.z - enemy.position.z;
            const dy = player.y - (enemy.position.y || 0); // Dif Vertical
            const dist = Math.hypot(dx, dz);

            // Condición de Visibilidad (Cono Ciego Y-axis)
            // Si el jugador está flotando 5 metros sobre él, el enemigo no mira hacia arriba (lógica clásica 3D)
            if (Math.abs(dy) > 5.0) {
                enemy.ai.state = 'PATROL';
            } else if (dist < this.visionRange) {
                // Alerta! Inicia frenesí de persecución
                enemy.ai.state = 'CHASE';
            } else {
                enemy.ai.state = 'PATROL';
            }

            let vx = 0;
            let vz = 0;
            let targetRotationY = 0;

            if (enemy.ai.state === 'CHASE') {
                // Vector Director de Persecución
                const dirX = dx / dist;
                const dirZ = dz / dist;
                vx = dirX * this.chaseSpeed;
                vz = dirZ * this.chaseSpeed;
                
                // Que el enemigo visualmente voltee a mirar la furia
                targetRotationY = Math.atan2(dirX, dirZ);

            } else if (enemy.ai.state === 'PATROL') {
                // Reloj de Merodeo Aleatorio
                enemy.ai.patrolTimer -= dt;
                if (enemy.ai.patrolTimer <= 0) {
                    // Cambiar de rumbo pseudo-aleatorio
                    enemy.ai.patrolAngle += (Math.random() - 0.5) * Math.PI;
                    enemy.ai.patrolTimer = 1.0 + Math.random() * 3.0; // 1 a 4 Segundos
                }
                
                vx = Math.sin(enemy.ai.patrolAngle) * this.patrolSpeed;
                vz = Math.cos(enemy.ai.patrolAngle) * this.patrolSpeed;
                targetRotationY = enemy.ai.patrolAngle;

                // Cordón Umbilical: Limitar qué tan lejos puede vagar desde su 'Spawn Point' originario
                const distHome = Math.hypot(enemy.position.x - enemy.ai.homeX, enemy.position.z - enemy.ai.homeZ);
                if (distHome > 10.0) {
                    // Si se alejó demasiado, se da la vuelta apuntando a casa forzosamente
                    const hdx = enemy.ai.homeX - enemy.position.x;
                    const hdz = enemy.ai.homeZ - enemy.position.z;
                    enemy.ai.patrolAngle = Math.atan2(hdx, hdz);
                }
            }

            // Aplicar cinemática XZ
            enemy.position.x += vx * dt;
            enemy.position.z += vz * dt;

            // Transmitir cinemática puramente matemática al Mesh Gráfico Renderizable de Three.js
            const mesh = enemyNodes[i];
            if (mesh) {
                mesh.position.x = enemy.position.x;
                mesh.position.z = enemy.position.z;
                
                // Interpolación Angular manual (Previene giros robóticos instantáneos)
                // Normalize angle loop
                let diff = targetRotationY - mesh.rotation.y;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                
                mesh.rotation.y += diff * 8.0 * dt; 
            }
        }
    }
}
