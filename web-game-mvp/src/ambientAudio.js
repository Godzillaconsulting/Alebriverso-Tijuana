/**
 * AmbientAudioSystem — Sonido Ambiental 3D Posicional (RE4 Grade)
 * 
 * RE4: Cada zona tiene sonidos posicionales únicos:
 *   Pueblo → perros ladrando, lluvia, campanas
 *   Castillo → goteo de agua, antorchas crackle, viento
 *   Isla → motores, alarmas, mar
 * 
 * Arquitectura:
 *   AmbientTrigger: { id, position, radius, soundType, volume }
 *   Al ingresar en radio → fade-in del sonido posicional
 *   Al salir → fade-out
 *   Usa ObjectPool para los nodos de AudioContext (evita recrear por zona)
 * 
 * Tipos de sonidos procedurales (synth, no requieren assets):
 *   'water_drip', 'wind', 'torch', 'jungle', 'cave_echo', 'water_stream'
 */

class AmbientAudioSystem {
    constructor() {
        this._ctx     = null;         // AudioContext (inyectado desde initAudio)
        this._triggers = [];          // Array de AmbientTrigger activos
        // Map<triggerId, { osc, gain, isPlaying }>
        this._activeSources = new Map();
    }

    /**
     * Inyectar el AudioContext compartido con el engine.
     * @param {AudioContext} ctx
     */
    register(ctx) {
        this._ctx = ctx;
    }

    /**
     * Añade un trigger ambiental al mundo (llamado desde assets.js al parsear JSON)
     * @param {object} triggerData  - { id, position:{x,y,z}, radius, soundType, volume }
     */
    addTrigger(triggerData) {
        this._triggers.push({
            id:        triggerData.id,
            position:  triggerData.position,
            radius:    triggerData.radius || 12,
            soundType: triggerData.soundType || 'wind',
            volume:    triggerData.volume    || 0.15
        });
    }

    /**
     * Limpia todos los triggers (llamar en clearLevelData)
     */
    clear() {
        // Fade out todos los activos
        for (const [id, src] of this._activeSources) {
            this._stopSource(id);
        }
        this._triggers.length = 0;
    }

    /**
     * Llamar desde el game loop con la posición del jugador.
     * @param {THREE.Vector3} playerPos
     */
    update(playerPos) {
        if (!this._ctx || this._ctx.state === 'suspended') return;

        for (const trigger of this._triggers) {
            const dx   = playerPos.x - trigger.position.x;
            const dz   = playerPos.z - trigger.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const isInRange = dist <= trigger.radius;
            const isActive  = this._activeSources.has(trigger.id);

            if (isInRange && !isActive) {
                this._startSource(trigger);
            } else if (!isInRange && isActive) {
                this._stopSource(trigger.id);
            } else if (isInRange && isActive) {
                // Fade por distancia: más cerca → más volumen
                const src = this._activeSources.get(trigger.id);
                if (src?.gain) {
                    const distRatio = 1 - (dist / trigger.radius);
                    src.gain.gain.setTargetAtTime(trigger.volume * distRatio, this._ctx.currentTime, 0.2);
                }
            }
        }
    }

    _startSource(trigger) {
        if (!this._ctx) return;
        const synth = this._createSynth(trigger.soundType, trigger.volume);
        if (synth) {
            this._activeSources.set(trigger.id, synth);
        }
    }

    _stopSource(id) {
        const src = this._activeSources.get(id);
        if (!src) return;
        try {
            // Fade out suave antes de detener
            src.gain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.5);
            setTimeout(() => {
                try { src.osc?.stop(); } catch (_) {}
                try { src.osc2?.stop(); } catch (_) {}
            }, 800);
        } catch (_) {}
        this._activeSources.delete(id);
    }

    /**
     * Genera un oscilador sintético según el tipo de ambiente.
     * Todos son loops infinitos de bajo costo de CPU.
     * @private
     */
    _createSynth(type, volume) {
        const ctx = this._ctx;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.setTargetAtTime(volume, ctx.currentTime, 1.0); // Fade in 1s
        gain.connect(ctx.destination);

        switch (type) {
            case 'water_drip': {
                // Ruido blanco filtrado → goteo periódico
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, ctx.currentTime);
                osc.frequency.setValueAtTime(300, ctx.currentTime + 0.08);
                osc.connect(gain);
                osc.start();
                // Envolvente de goteo repetida via gain automation (hack)
                const repeat = () => {
                    const t = ctx.currentTime;
                    const g = gain.gain;
                    g.setValueAtTime(volume, t);
                    g.exponentialRampToValueAtTime(0.001, t + 0.2);
                    g.setValueAtTime(0.001, t + (1.2 + Math.random() * 2));
                    g.linearRampToValueAtTime(volume, t + (1.3 + Math.random() * 2));
                };
                const interval = setInterval(repeat, 2500);
                return { osc, gain, interval, stop: () => clearInterval(interval) };
            }

            case 'torch': {
                // Ruido de fuego: osciladores a diferentes frecuencias + ruido
                const osc  = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                osc.type  = 'sawtooth'; osc.frequency.value = 60;
                osc2.type = 'sine';     osc2.frequency.value = 120;
                osc.connect(gain); osc2.connect(gain);
                // Modulación de amplitud para simular parpadeo de fuego
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 7; lfoGain.gain.value = 0.4;
                lfo.connect(lfoGain); lfoGain.connect(gain.gain);
                lfo.start(); osc.start(); osc2.start();
                return { osc, osc2, gain };
            }

            case 'wind': {
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(80, ctx.currentTime);
                // Modulación lenta para efecto de viento variable
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 0.3; lfoGain.gain.value = 30;
                lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
                lfo.start(); osc.connect(gain); osc.start();
                return { osc, gain };
            }

            case 'cave_echo': {
                // Resonancia cavernosa
                const osc = ctx.createOscillator();
                osc.type = 'sine'; osc.frequency.value = 55;
                const delay = ctx.createDelay(1.0);
                delay.delayTime.value = 0.4;
                const fb = ctx.createGain(); fb.gain.value = 0.5;
                osc.connect(delay); delay.connect(fb); fb.connect(delay);
                delay.connect(gain); osc.start();
                return { osc, gain };
            }

            case 'water_stream': {
                // Corriente de agua: ruido de alta frecuencia filtrado
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth'; osc.frequency.value = 800;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 400;
                osc.connect(filter); filter.connect(gain); osc.start();
                return { osc, gain };
            }

            default:
                return null;
        }
    }
}

export const ambientAudio = new AmbientAudioSystem();
