/**
 * AudioManager.js
 * 
 * Especialista en Audio (@game_levels)
 * Evolución Arquitectura PS2 (SPU2):
 * - Modulación de PannerNode para Audio Espacial 3D (Posicional, usando HRTF).
 * - ConvolverNode para simulación acústica (Reverb).
 * - Generación procedural de osciladores para SFX base, reduciendo dependencia en assets externos.
 */

class AudioManager {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        
        // Cadena de Audio Global
        this.globalGainNode = this.context.createGain();
        
        // Reverb (Simulación SPU2 Core)
        this.reverbNode = this.context.createConvolver();
        this.reverbGain = this.context.createGain();
        this.reverbGain.gain.value = 0.35; // Nivel de Reverb (Ambiente)
        
        // Ruteo Complejo: Main -> [Dry Path & Wet Path (Reverb)] -> Destination
        this.globalGainNode.connect(this.reverbNode);
        this.reverbNode.connect(this.context.destination);
        this.globalGainNode.connect(this.context.destination);

        this.soundBanks = { bgm: {}, sfx: {} };
        this.currentBGMNode = null;
        this.bgmGain = this.context.createGain();
        this.bgmGain.connect(this.context.destination);
        this.bgmGain.gain.value = 0.4;

        // Generar un Impulse Response básico proceduralmente para el Reverb
        this._generateReverbImpulse(1.5); // 1.5s de decay
        
        // Configurar listener (Jugador / Cámara)
        this.context.listener.positionX.value = 0;
        this.context.listener.positionY.value = 0;
        this.context.listener.positionZ.value = 0;
    }

    /**
     * Genera un búfer de impulso matemático para el convolver (ruido decaído).
     * @param {number} duration Duración del impulso en segundos.
     */
    _generateReverbImpulse(duration) {
        const sampleRate = this.context.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.context.createBuffer(2, length, sampleRate);
        const impulseL = impulse.getChannelData(0);
        const impulseR = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const decay = Math.exp(-i / (sampleRate * (duration / 3)));
            impulseL[i] = (Math.random() * 2 - 1) * decay;
            impulseR[i] = (Math.random() * 2 - 1) * decay;
        }
        this.reverbNode.buffer = impulse;
    }

    /**
     * Actualiza la posición del oído virtual (Listener)
     */
    updateListenerPosition(x, y, z, forwardX = 0, forwardY = 0, forwardZ = -1) {
        this.context.listener.positionX.value = x;
        this.context.listener.positionY.value = y;
        this.context.listener.positionZ.value = z;
        this.context.listener.forwardX.value = forwardX;
        this.context.listener.forwardY.value = forwardY;
        this.context.listener.forwardZ.value = forwardZ;
    }

    /**
     * Sonido de salto/acción: Intenta buffer real, si no, usa síntesis procedural HRTF.
     */
    playJumpSynthesized(x = 0, y = 0, z = 0) {
        if (this.playReal3DSound('jump', x, y, z, 0.6)) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const panner = this.context.createPanner();

        // Configuración de audio espacial (3D)
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.positionX.value = x;
        panner.positionY.value = y;
        panner.positionZ.value = z;

        // Síntesis rápida (Pitch Modulation)
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(450, this.context.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(120, this.context.currentTime + 0.3);

        gain.gain.setValueAtTime(0.4, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.globalGainNode);

        osc.start();
        osc.stop(this.context.currentTime + 0.3);
    }

    /**
     * Recolección de Cacao/Semilla: Intercala buffer real o síntesis HRTF Orgánica de Madera.
     */
    playCacaoSynthesized(x = 0, y = 0, z = 0) {
        if (this.playReal3DSound('cacao', x, y, z, 0.8)) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const panner = this.context.createPanner();

        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.positionX.value = x;
        panner.positionY.value = y;
        panner.positionZ.value = z;

        osc.type = 'triangle'; // Tono opaco y orgánico (madera/semilla hueca)
        osc.frequency.setValueAtTime(400, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + 0.1); // Drop seco de frecuencia
        
        gain.gain.setValueAtTime(0, this.context.currentTime);
        gain.gain.linearRampToValueAtTime(0.8, this.context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.globalGainNode); // Pasa por el Reverb paralelo

        osc.start(this.context.currentTime);
        osc.stop(this.context.currentTime + 0.16);
    }
    
    /**
     * Impacto grave (Bonk/Ground Pound/Daño): Juega buffer si existe.
     */
    playThudSynthesized(x = 0, y = 0, z = 0) {
        if (this.playReal3DSound('thud', x, y, z, 1.0)) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const panner = this.context.createPanner();

        panner.panningModel = 'HRTF';
        panner.positionX.value = x;
        panner.positionY.value = y;
        panner.positionZ.value = z;

        osc.type = 'sawtooth'; // Ruido crudo
        osc.frequency.setValueAtTime(100, this.context.currentTime); // Grave
        osc.frequency.exponentialRampToValueAtTime(10, this.context.currentTime + 0.15); // Caída rápida sub-bass

        gain.gain.setValueAtTime(0.8, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.globalGainNode);

        osc.start();
        osc.stop(this.context.currentTime + 0.15);
    }

    // --- SISTEMA DE AUDIO REAL (Buffers, Spatials y BGM) ---

    /**
     * Carga asincrónica de un archivo de audio (.mp3, .ogg, .wav). Call during Init.
     */
    async loadSound(name, url, bank = 'sfx') {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.soundBanks[bank][name] = audioBuffer;
            console.log(`[AudioManager] Buffer cargado en memoria: ${bank} -> ${name}`);
        } catch (error) {
            console.warn(`[AudioManager] Error cargando audio en ${url}:`, error);
        }
    }

    /**
     * Reproductor Espacial 3D para AudioBuffers reales (Reemplaza a los Osciladores)
     * Retorna true si encontró el .wav y lo reprodujo, false para fallback.
     */
    playReal3DSound(name, x = 0, y = 0, z = 0, volume = 1.0) {
        const buffer = this.soundBanks.sfx[name];
        if (!buffer) return false;

        const source = this.context.createBufferSource();
        source.buffer = buffer;

        const panner = this.context.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 2.0;
        panner.maxDistance = 80.0;
        panner.positionX.value = x;
        panner.positionY.value = y;
        panner.positionZ.value = z;

        const gain = this.context.createGain();
        gain.gain.value = volume;

        // Ruteo: Archivo Wav -> Control Nivel -> Posición Esférica -> Emisión Global / Reverb
        source.connect(gain);
        gain.connect(panner);
        panner.connect(this.globalGainNode);

        source.start(0);
        return true;
    }

    /**
     * BGM Sinfónico en bucle perpetuo estéreo (Mantenido ajeno al procesador 3D)
     */
    playBGM(name) {
        const buffer = this.soundBanks.bgm[name];
        if (!buffer) {
            console.warn(`[AudioManager] BGM '${name}' no cargado.`);
            return;
        }

        this.stopBGM(); // Cortar anterior crossfades preventivo

        this.currentBGMNode = this.context.createBufferSource();
        this.currentBGMNode.buffer = buffer;
        this.currentBGMNode.loop = true;
        this.currentBGMNode.connect(this.bgmGain);
        this.currentBGMNode.start(0);
    }

    stopBGM() {
        if (this.currentBGMNode) {
            try { this.currentBGMNode.stop(0); } catch(e){}
            this.currentBGMNode.disconnect();
            this.currentBGMNode = null;
        }
    }
}

export default AudioManager;
