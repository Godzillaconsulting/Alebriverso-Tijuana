// js/engine/MusicManager.js — Generador Procedural de Música 8-bit (Web Audio API)

class MusicManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.currentTrack = null;
    this.isPlaying = false;
    this.nextNoteTime = 0;
    this.noteIdx = 0;
    this.tempo = 120;
    this.sequence = [];
    this.synthInterval = null;
    
    // Frecuencias base (C4 = 261.6)
    this.notes = {
      'C3': 130.8, 'D3': 146.8, 'E3': 164.8, 'F3': 174.6, 'G3': 196.0, 'A3': 220.0, 'B3': 246.9,
      'C4': 261.6, 'D4': 293.7, 'E4': 329.6, 'F4': 349.2, 'G4': 392.0, 'A4': 440.0, 'B4': 493.9,
      'C5': 523.3, 'D5': 587.3, 'E5': 659.3, 'F5': 698.5, 'G5': 784.0, 'A5': 880.0, 'B5': 987.8,
      'REST': 0
    };

    // Tracks procedurales
    this.tracks = {
      'title': {
        tempo: 140,
        type: 'square',
        seq: ['C4', 'E4', 'G4', 'C5', 'REST', 'G4', 'E4', 'C4']
      },
      'hub': {
        tempo: 100,
        type: 'triangle',
        seq: ['A3', 'C4', 'E4', 'A4', 'E4', 'C4', 'A3', 'REST']
      },
      'level_base': {
        tempo: 160,
        type: 'square',
        // Se modifica según la época
        seq: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'REST']
      },
      'boss': {
        tempo: 200,
        type: 'sawtooth',
        seq: ['E3', 'E3', 'E4', 'REST', 'D3', 'D3', 'D4', 'REST', 'C3', 'C3', 'C4', 'REST', 'B2', 'REST', 'REST', 'REST']
      }
    };
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.1; // Volumen bajito por defecto
    this.masterGain.connect(this.ctx.destination);
    
    // Resume context if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      // Necesita intervención del usuario
      document.addEventListener('pointerdown', () => this.ctx.resume(), { once: true });
    }
  }

  playTrack(trackName, epochVariant = 1) {
    if (!this.ctx) this.init();
    if (!this.tracks[trackName]) return;
    
    this.stop();
    this.currentTrack = trackName;
    this.isPlaying = true;
    
    const track = this.tracks[trackName];
    this.tempo = track.tempo;
    this.waveType = track.type;
    this.sequence = [...track.seq];

    // Variaciones según época "Bien Mexa" si es música de nivel
    if (trackName === 'level_base') {
      switch (epochVariant) {
        case 1: 
          // 🌿 Época 1 (Tenochtitlán): Misterioso, simula Ocarina prehispánica
          this.waveType = 'sine'; // Tono suave como viento
          this.tempo = 90;
          this.sequence = ['A4', 'REST', 'C5', 'A4', 'E5', 'REST', 'D5', 'C5'];
          break;
        case 2:
          // ⚔️ Época 2 (Conquista): Marcha española / Tensión
          this.waveType = 'sawtooth'; // Metálico
          this.tempo = 110;
          this.sequence = ['E3', 'E3', 'REST', 'F3', 'E3', 'REST', 'A3', 'REST'];
          break;
        case 3:
          // ⛪ Época 3 (Nueva España): Barroco Colonial
          this.waveType = 'triangle'; // Eclesiástico 
          this.tempo = 100;
          this.sequence = ['C4', 'E4', 'G4', 'C5', 'B4', 'G4', 'E4', 'C4'];
          break;
        case 4:
          // 🔔 Época 4 (Independencia): Huapango norteño/ranchero 
          this.waveType = 'square'; // Estridente tipo trompeta/acordeón
          this.tempo = 180;
          this.sequence = ['C4', 'E4', 'C4', 'G4', 'REST', 'E4', 'G4', 'REST'];
          break;
        case 5:
          // 🎩 Época 5 (Porfiriato): Vals aristocrático (3/4 feel)
          this.waveType = 'triangle'; 
          this.tempo = 130;
          this.sequence = ['C4', 'E4', 'G4', 'REST']; 
          break;
        case 6:
          // 🚂 Época 6 (Revolución): Mariachi Cumbia Bélica
          this.waveType = 'square'; // Alegre y trompetona
          this.tempo = 160;
          this.sequence = ['G4', 'G4', 'B4', 'D5', 'C5', 'A4', 'G4', 'REST'];
          break;
      }
    }
    
    this.noteIdx = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this._scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.synthInterval) clearTimeout(this.synthInterval);
  }

  setVolume(vol) {
    if (this.masterGain) this.masterGain.gain.value = vol;
  }

  _scheduler() {
    if (!this.isPlaying) return;
    
    // Lookahead
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this._playNote(this.nextNoteTime);
      this._nextNote();
    }
    this.synthInterval = setTimeout(() => this._scheduler(), 25);
  }

  _playNote(time) {
    const noteName = this.sequence[this.noteIdx];
    const freq = this.notes[noteName];
    
    if (freq > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = this.waveType;
      osc.frequency.value = freq;
      
      // Envolvente rápida estilo 8-bit
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(1, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, time + (60.0 / this.tempo) - 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(time);
      osc.stop(time + (60.0 / this.tempo));
    }
  }

  _nextNote() {
    const secondsPerBeat = 60.0 / this.tempo;
    // Tocar corcheas
    this.nextNoteTime += 0.5 * secondsPerBeat;
    this.noteIdx++;
    if (this.noteIdx >= this.sequence.length) {
      this.noteIdx = 0;
    }
  }
}

// Global instance
window.Jukebox = new MusicManager();
