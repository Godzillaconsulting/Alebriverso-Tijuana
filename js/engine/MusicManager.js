// js/engine/MusicManager.js — Generador Procedural de Música 8-bit + SFX (Web Audio API)
// Agente 4: Audio Engineer — Tijuana: Alebrije en Vacaciones

class MusicManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.currentTrack = null;
    this.isPlaying = false;
    this.nextNoteTime = 0;
    this.noteIdx = 0;
    this.tempo = 120;
    this.sequence = [];
    this.synthInterval = null;
    this._initialized = false;

    // Frecuencias base (Hz)
    this.notes = {
      'B2': 61.7,  'C3': 130.8, 'D3': 146.8, 'E3': 164.8, 'F3': 174.6,
      'G3': 196.0, 'A3': 220.0, 'B3': 246.9,
      'C4': 261.6, 'D4': 293.7, 'E4': 329.6, 'F4': 349.2,
      'G4': 392.0, 'A4': 440.0, 'B4': 493.9,
      'C5': 523.3, 'D5': 587.3, 'E5': 659.3, 'F5': 698.5,
      'G5': 784.0, 'A5': 880.0, 'B5': 987.8,
      'REST': 0
    };

    // ── TRACKS DE MÚSICA PROCEDURALES ──────────────────────────────────
    this.tracks = {
      'title': {
        tempo: 140, type: 'square',
        seq: ['C4','E4','G4','C5','REST','G4','E4','C4',
              'A3','C4','E4','A4','REST','E4','C4','A3']
      },
      'hub': {
        tempo: 100, type: 'triangle',
        seq: ['A3','C4','E4','A4','E4','C4','A3','REST',
              'G3','B3','D4','G4','D4','B3','G3','REST']
      },
      'level_base': {
        tempo: 160, type: 'square',
        seq: ['C4','C4','G4','G4','A4','A4','G4','REST',
              'F4','F4','E4','E4','D4','D4','C4','REST']
      },
      'boss': {
        tempo: 200, type: 'sawtooth',
        seq: ['E3','E3','E4','REST','D3','D3','D4','REST',
              'C3','C3','C4','REST','B2','REST','REST','REST',
              'G3','REST','G3','REST','A3','REST','F3','REST']
      },
      'shop': {
        tempo: 110, type: 'triangle',
        seq: ['C5','E5','G5','E5','C5','REST','A4','C5',
              'G4','B4','D5','B4','G4','REST','E4','G4']
      },
      'victory': {
        tempo: 160, type: 'square',
        seq: ['C4','C4','C4','REST','C4','E4','G4','C5',
              'C5','B4','A4','G4','E4','C4','G4','C5']
      },
      'gameover': {
        tempo: 70, type: 'sawtooth',
        seq: ['G4','REST','F4','REST','E4','REST','D4','REST',
              'C4','REST','B3','REST','A3','REST','G3','REST']
      }
    };
  }

  // ── INICIALIZACIÓN (requiere gesto del usuario) ─────────────────────
  init() {
    if (this._initialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) { console.warn('[Jukebox] Web Audio API no disponible'); return; }

    this.ctx = new AudioContext();

    // Nodo maestro
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.08;
    this.masterGain.connect(this.ctx.destination);

    // Nodo SFX (independiente del volumen de música)
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.25;
    this.sfxGain.connect(this.ctx.destination);

    // Compresor limiter para evitar clipping
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.ratio.value = 4;
    this.masterGain.connect(comp);
    comp.connect(this.ctx.destination);

    if (this.ctx.state === 'suspended') {
      document.addEventListener('pointerdown', () => this.ctx.resume(), { once: true });
    }

    this._initialized = true;
    console.log('[Jukebox] ✅ Inicializado — Web Audio API activa');
  }

  // ── REPRODUCIR TRACK DE MÚSICA ──────────────────────────────────────
  playTrack(trackName, epochVariant = 1) {
    if (!this._initialized) this.init();
    if (!this.ctx) return;

    this.stop();
    this.currentTrack = trackName;
    this.isPlaying = true;

    // Resumir contexto si está suspendido (autoplay policy)
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const track = this.tracks[trackName];
    if (!track) { console.warn(`[Jukebox] Track desconocido: ${trackName}`); return; }

    this.tempo = track.tempo;
    this.waveType = track.type;
    this.sequence = [...track.seq];

    // ── VARIACIONES POR ÉPOCA (level_base) ────────────────────────────
    if (trackName === 'level_base') {
      switch (epochVariant) {
        case 1:
          // 🌿 Tenochtitlán — Ocarina prehispánica, modal, misterioso
          this.waveType = 'sine';
          this.tempo = 90;
          this.sequence = ['A4','REST','C5','A4','E5','REST','D5','C5',
                           'A4','G4','E4','REST','C4','D4','E4','REST'];
          break;
        case 2:
          // ⚔️ Conquista — Marcha española, metálico, tensión
          this.waveType = 'sawtooth';
          this.tempo = 110;
          this.sequence = ['E3','E3','REST','F3','E3','REST','A3','REST',
                           'G3','G3','REST','A3','G3','REST','D3','REST'];
          break;
        case 3:
          // ⛪ Nueva España — Barroco colonial, eclesiástico
          this.waveType = 'triangle';
          this.tempo = 100;
          this.sequence = ['C4','E4','G4','C5','B4','G4','E4','C4',
                           'F4','A4','C5','A4','F4','E4','D4','C4'];
          break;
        case 4:
          // 🔔 Independencia — Huapango norteño/ranchero, estridente
          this.waveType = 'square';
          this.tempo = 180;
          this.sequence = ['C4','E4','C4','G4','REST','E4','G4','REST',
                           'A4','G4','E4','REST','D4','E4','G4','REST'];
          break;
        case 5:
          // 🎩 Porfiriato — Vals aristocrático (3/4)
          this.waveType = 'triangle';
          this.tempo = 130;
          this.sequence = ['C4','E4','G4','REST','E4','G4','C5','REST',
                           'B4','G4','E4','REST','D4','F4','A4','REST'];
          break;
        case 6:
          // 🚂 Revolución — Mariachi cumbia bélica, trompetona
          this.waveType = 'square';
          this.tempo = 160;
          this.sequence = ['G4','G4','B4','D5','C5','A4','G4','REST',
                           'E4','G4','B4','G4','E4','D4','C4','REST'];
          break;
      }
    }

    this.noteIdx = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this._scheduler();
    console.log(`[Jukebox] 🎵 Reproduciendo: ${trackName}${trackName === 'level_base' ? ` (Época ${epochVariant})` : ''}`);
  }

  stop() {
    this.isPlaying = false;
    if (this.synthInterval) { clearTimeout(this.synthInterval); this.synthInterval = null; }
  }

  setVolume(vol) {
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
  }

  setSfxVolume(vol) {
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  // ── EFECTOS DE SONIDO (SFX) ─────────────────────────────────────────

  /** Salto — chirp ascendente estilo Mario */
  sfxJump() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.1);
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.15);
  }

  /** Doble salto — chirp ascendente doble */
  sfxDoubleJump() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    [0, 0.08].forEach(delay => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(400 + delay * 2000, t + delay);
      osc.frequency.exponentialRampToValueAtTime(1200, t + delay + 0.1);
      g.gain.setValueAtTime(0.5, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.12);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t + delay); osc.stop(t + delay + 0.12);
    });
  }

  /** Daño recibido — ruido bajando (descenso de frecuencia) */
  sfxDamage() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.35);
    // Segundo chirrido de dolor
    const osc2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(200, t + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(50, t + 0.4);
    g2.gain.setValueAtTime(0.4, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc2.connect(g2); g2.connect(this.sfxGain);
    osc2.start(t + 0.1); osc2.stop(t + 0.45);
  }

  /** Recolectar cacao/moneda — ding brillante */
  sfxCollect() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const freqs = [523.3, 659.3, 784.0];
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t + i * 0.07);
      g.gain.linearRampToValueAtTime(0.5, t + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.15);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.15);
    });
  }

  /** Victoria / Boss derrotado — fanfarria corta */
  sfxVictory() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const melody = [
      { freq: 523.3, dur: 0.1, delay: 0 },
      { freq: 523.3, dur: 0.1, delay: 0.12 },
      { freq: 523.3, dur: 0.15, delay: 0.24 },
      { freq: 415.3, dur: 0.15, delay: 0.4 },  // Ab4
      { freq: 523.3, dur: 0.5,  delay: 0.56 },
      { freq: 415.3, dur: 0.15, delay: 0.56 },
      { freq: 523.3, dur: 0.8,  delay: 0.72 },
    ];
    melody.forEach(n => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = n.freq;
      g.gain.setValueAtTime(0, t + n.delay);
      g.gain.linearRampToValueAtTime(0.5, t + n.delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + n.delay + n.dur);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t + n.delay); osc.stop(t + n.delay + n.dur + 0.05);
    });
  }

  /** Game Over — descenso dramático (Kirby's Adventure style) */
  sfxGameOver() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const seq = [
      { freq: 659.3, delay: 0 },
      { freq: 587.3, delay: 0.3 },
      { freq: 523.3, delay: 0.6 },
      { freq: 392.0, delay: 0.9 },
      { freq: 293.7, delay: 1.2 },
    ];
    seq.forEach(n => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = n.freq;
      g.gain.setValueAtTime(0.6, t + n.delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + n.delay + 0.25);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t + n.delay); osc.stop(t + n.delay + 0.25);
    });
  }

  /** Seleccionar época / confirmar menú */
  sfxSelect() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(880, t + 0.06);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.15);
  }

  /** Hover de menú / campo brillante pequeño */
  sfxHover() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.06);
  }

  /** Ataque melee — golpe corto */
  sfxAttack() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 400;
    filt.Q.value = 0.5;
    src.buffer = buf;
    g.gain.value = 0.5;
    src.connect(filt); filt.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }

  /** Golpe boss (impacto pesado) */
  sfxBossHit() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.35);
    // Ruido de impacto
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.4;
    src.buffer = buf; src.connect(g2); g2.connect(this.sfxGain);
    src.start(t);
  }

  /** Proyectil del boss disparado */
  sfxProjectile() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.2);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.2);
  }

  /** Selfie! — clic de cámara */
  sfxSelfie() {
    if (!this._sfxReady()) return;
    const t = this.ctx.currentTime;
    // Flash sonoro (shutter)
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.buffer = buf; src.connect(g); g.connect(this.sfxGain);
    src.start(t);
    // Pitido confirmación
    const osc = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 1400;
    g2.gain.setValueAtTime(0.4, t + 0.05); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g2); g2.connect(this.sfxGain);
    osc.start(t + 0.05); osc.stop(t + 0.15);
  }

  // ── INTERNOS ────────────────────────────────────────────────────────
  _sfxReady() {
    if (!this._initialized) this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  _scheduler() {
    if (!this.isPlaying) return;
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
      const noteDur = 60.0 / this.tempo;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(1, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, time + noteDur * 0.5 - 0.02);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + noteDur * 0.5);
    }
  }

  _nextNote() {
    const secondsPerBeat = 60.0 / this.tempo;
    this.nextNoteTime += 0.5 * secondsPerBeat;
    this.noteIdx++;
    if (this.noteIdx >= this.sequence.length) this.noteIdx = 0;
  }
}

// ── INSTANCIA GLOBAL ────────────────────────────────────────────────
window.Jukebox = new MusicManager();
console.log('[Jukebox] window.Jukebox listo — Web Audio API procedural');
