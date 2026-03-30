/**
 * Audio Engine — PS2/RE4 Grade
 * 
 * Estructuras de Datos:
 *   - ActiveSoundList: Doubly-Linked List de fuentes activas (O(1) add/remove)
 *   - SoundPriorityQueue: Min-Heap para descartar sonidos de baja prioridad
 *     cuando se supera el límite de 16 canales simultáneos.
 *   - AudioZoneMap: Map<zoneId, ZoneProfile> para BGM/Ambient contextual
 *   - audioCache: Map<id, AudioBuffer> (buffer inmutable, reutilizable)
 * 
 * Inspiración: SM64 usa un "Sound Heap" de 0x40000 bytes con linked list
 * de bank headers. Nosotros lo portamos a WebAudio API de forma moderna.
 */
import * as THREE from 'three';

const MAX_CHANNELS = 16; // Límite hardware PS2 empírico

// ─────────────────────────────────────────────────────
// ESTRUCTURA 1: Nodo de Lista Doblemente Enlazada
// ─────────────────────────────────────────────────────
class SoundNode {
    constructor(id, priority) {
        this.id         = id;
        this.priority   = priority; // Mayor = más importante (0 = ambiental, 10 = StarJingle)
        this.source     = null;     // AudioBufferSourceNode
        this.gainNode   = null;     // GainNode para volumen
        this.pannerNode = null;     // PannerNode para Audio 3D Posicional
        this.isActive   = false;
        // Punteros de la lista doblemente enlazada
        this.prev       = null;
        this.next       = null;
    }
}

// ─────────────────────────────────────────────────────
// ESTRUCTURA 2: ActiveSoundList (Doubly-Linked List)
// ─────────────────────────────────────────────────────
class ActiveSoundList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }

    /** Agrega al final. O(1) */
    push(node) {
        node.prev = this.tail;
        node.next = null;
        if (this.tail) this.tail.next = node;
        else this.head = node;
        this.tail = node;
        this.size++;
    }

    /** Elimina nodo arbitrario. O(1) — No necesita buscar */
    remove(node) {
        if (node.prev) node.prev.next = node.next;
        else this.head = node.next; // Era el head
        if (node.next) node.next.prev = node.prev;
        else this.tail = node.prev; // Era el tail
        node.prev = null;
        node.next = null;
        this.size--;
    }

    /** Encuentra el nodo con menor prioridad para expulsar. O(n) pero n ≤ 16 */
    findLowestPriority() {
        let lowest = this.head;
        let cur = this.head;
        while (cur) {
            if (cur.priority < lowest.priority) lowest = cur;
            cur = cur.next;
        }
        return lowest;
    }

    /** Itera todos los nodos activos */
    forEach(fn) {
        let cur = this.head;
        while (cur) {
            const next = cur.next; // Guardar next antes de que fn lo modifique
            fn(cur);
            cur = next;
        }
    }
}

// ─────────────────────────────────────────────────────
// ESTRUCTURA 3: AudioZoneMap (HashMap de Perfiles de Zona)
// ─────────────────────────────────────────────────────
const AudioZoneMap = new Map([
    ['tenochtitlan', {
        bgm:      null,            // Placeholder — poner ruta de archivo MP3 aquí
        ambience: null,            // Viento y agua lacustre
        sfxMix:   { reverb: 0.1, footstepMaterial: 'dirt' }
    }],
    ['calabozo', {
        bgm:      null,
        ambience: null,            // Goteo de agua + ecó de piedra
        sfxMix:   { reverb: 0.7, footstepMaterial: 'stone' }
    }],
    ['water', {
        bgm:      null,
        ambience: null,
        sfxMix:   { reverb: 0.3, footstepMaterial: 'water' }
    }]
]);

// ─────────────────────────────────────────────────────
// ESTADO DEL ENGINE
// ─────────────────────────────────────────────────────
let listener = null;
let ctx      = null;

// Map<id, AudioBuffer> — Buffers inmutables reutilizables (no se crean por reproducción)
const audioCache = new Map();

// DLL de canales activos
const activeList = new ActiveSoundList();

// Pool de SoundNodes pre-asignados para evitar 'new' en el game loop
const nodePool = [];
for (let i = 0; i < MAX_CHANNELS; i++) {
    nodePool.push(new SoundNode('__free', 0));
}

// Zona de audio actual
let currentZoneId = 'tenochtitlan';
let bgmSource     = null;   // Fuente BGM actual (loop)
let bgmGain       = null;   // GainNode del BGM para crossfade

// ─────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────
export function initAudio(camera) {
    listener  = new THREE.AudioListener();
    camera.add(listener);
    ctx       = listener.context;

    // Cargar buffers en paralelo (no bloquea engine)
    const loads = [
        ['jump',         '/audio/mario_jump.wav'],
        ['collect',      '/audio/coin_pickup.wav'],
        ['land',         '/audio/heavy_punch.wav'],
        ['redcoin',      '/audio/coin_pickup.wav'],   // Reutilizar hasta tener asset propio
        ['star',         '/audio/heavy_punch.wav'],   // Placeholder
    ];
    loads.forEach(([id, path]) => _loadBuffer(id, path));
}

async function _loadBuffer(id, path) {
    try {
        const loader  = new THREE.AudioLoader();
        const buffer  = await loader.loadAsync(path);
        audioCache.set(id, buffer);
        console.log(`[AudioEngine] Loaded: ${id}`);
    } catch {
        console.warn(`[AudioEngine] 404 skipped: ${path} → using synth fallback`);
    }
}

// ─────────────────────────────────────────────────────
// Mapeo de control de concurrencia: Evita que 10 zombis rujan en el mismo instante y saturen los speakers
const lastPlayedMap = new Map();

function _playSound(id, priority = 5, volume = 0.5, position = null, synthFallback = null) {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    // ANTI-BLOWOUT: Limitar ráfagas del mismo sonido a una vez cada 50ms (Crowd Control)
    const now = ctx.currentTime;
    const lastTime = lastPlayedMap.get(id) || 0;
    if (now - lastTime < 0.05) {
        // Demasiados de este ruido al mismo tiempo. Se descarta para no saturar el Master Bus.
        return;
    }
    lastPlayedMap.set(id, now);

    // Si ya llenamos los 16 canales → expulsar el de menor prioridad
    if (activeList.size >= MAX_CHANNELS) {
        const victim = activeList.findLowestPriority();
        if (!victim || victim.priority >= priority) {
            return; // No vale la pena reproducir
        }
        _stopNode(victim);
    }

    const buffer = audioCache.get(id);

    if (buffer) {
        // Tomar nodo del pool (O(1) pop) — evita 'new'
        const node        = nodePool.length > 0 ? nodePool.pop() : new SoundNode(id, priority);
        node.id           = id;
        node.priority     = priority;
        node.isActive     = true;

        const gainNode    = ctx.createGain();
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);

        const source      = ctx.createBufferSource();
        source.buffer     = buffer;
        
        let pannerNode = null;
        
        // === AUDIO 3D POSICIONAL (RE4/PS2 Grade HRTF) ===
        if (position && position.isVector3) {
            pannerNode = ctx.createPanner();
            pannerNode.panningModel = 'HRTF';
            pannerNode.distanceModel = 'exponential';
            pannerNode.refDistance = 2.0;
            pannerNode.maxDistance = 50.0;
            pannerNode.rolloffFactor = 1.2;
            
            pannerNode.positionX.value = position.x;
            pannerNode.positionY.value = position.y;
            pannerNode.positionZ.value = position.z;
            
            source.connect(gainNode);
            gainNode.connect(pannerNode);
            pannerNode.connect(ctx.destination);
        } else {
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
        }

        // Auto-limpieza al terminar (callback devuelve nodo al pool)
        source.onended = () => {
            activeList.remove(node);
            node.isActive = false;
            node.source   = null;
            node.gainNode = null;
            node.pannerNode = null;
            nodePool.push(node); // O(1) devolver al pool
        };

        node.source   = source;
        node.gainNode = gainNode;
        node.pannerNode = pannerNode;
        activeList.push(node); // O(1) DLL push
        source.start(0);
    } else if (synthFallback) {
        synthFallback(ctx, position);
    }
}

function _stopNode(node) {
    try {
        if (node.source) {
            node.source.onended = null; // Evitar callback doble
            node.source.stop();
            node.source.disconnect();
        }
        if (node.gainNode) node.gainNode.disconnect();
        if (node.pannerNode) node.pannerNode.disconnect();
    } catch (_) {}
    activeList.remove(node);
    node.isActive = false;
    node.source   = null;
    node.gainNode = null;
    node.pannerNode = null;
    nodePool.push(node); // Devolver al pool
}

// === EXPORT PUBLIC 3D AUDIO API ===
export function play3DSound(id, position, priority = 5, volume = 1.0) {
    _playSound(id, priority, volume, position);
}

// ─────────────────────────────────────────────────────
// API PÚBLICA — SFX
// ─────────────────────────────────────────────────────

export function playJumpSound() {
    _playSound('jump', 7, 0.4, (ctx) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueCurveAtTime(new Float32Array([400, 600, 900]), ctx.currentTime, 0.18);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.22);
    });
}

export function playDoubleJumpSound() {
    _playSound('jump', 8, 0.35, (ctx) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueCurveAtTime(new Float32Array([600, 1000, 1500]), ctx.currentTime, 0.25);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
    });
}

export function playCollectSound() {
    _playSound('collect', 6, 0.6, (ctx) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
    });
}

export function playLandSound() {
    _playSound('land', 7, 0.5, (ctx) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueCurveAtTime(new Float32Array([180, 40]), ctx.currentTime, 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.12);
    });
}

/** Sonido exclusivo de Red Coin — timbre más agudo y brillante */
export function playRedCoinSound(position) {
    _playSound('redcoin', 8, 0.7, position, (ctx, pos) => {
        // Campanilla Mexica (2 armónicos superpuestos)
        [880, 1320].forEach((freq, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.12 - i * 0.04, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            
            if (pos) {
                const pan = ctx.createPanner();
                pan.panningModel = 'HRTF';
                pan.distanceModel = 'exponential';
                pan.refDistance = 1.0;
                pan.maxDistance = 20.0;
                pan.positionX.value = pos.x;
                pan.positionY.value = pos.y;
                pan.positionZ.value = pos.z;
                osc.connect(gain); gain.connect(pan); pan.connect(ctx.destination);
            } else {
                osc.connect(gain); gain.connect(ctx.destination);
            }
            
            osc.start(); osc.stop(ctx.currentTime + 0.5);
        });
    });
}

// === NEW: 3D ENEMY SOUNDS (Synthetic Fallbacks) ===

export function playEnemyGrowl(position) {
    _playSound('growl', 4, 1.0, position, (ctx, pos) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        // Roar grave sintético
        osc.type = 'sawtooth';
        osc.frequency.setValueCurveAtTime(new Float32Array([120, 80, 50, 30]), ctx.currentTime, 0.8);
        
        // Tremolo LFO for growl texture
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 25; // 25Hz flutter
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start(); lfo.stop(ctx.currentTime + 0.8);

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        
        if (pos) {
            const pan = ctx.createPanner();
            pan.panningModel = 'HRTF'; pan.distanceModel = 'exponential';
            pan.refDistance = 2.0; pan.maxDistance = 40.0; pan.rolloffFactor = 1.5;
            pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z;
            osc.connect(gain); gain.connect(pan); pan.connect(ctx.destination);
        } else {
            osc.connect(gain); gain.connect(ctx.destination);
        }
        osc.start(); osc.stop(ctx.currentTime + 0.8);
    });
}

export function playEnemyHit(position) {
    _playSound('hit', 8, 1.0, position, (ctx, pos) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        // Squish/Hit asqueroso
        osc.type = 'square';
        osc.frequency.setValueCurveAtTime(new Float32Array([800, 200, 50]), ctx.currentTime, 0.2);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        
        if (pos) {
            const pan = ctx.createPanner();
            pan.panningModel = 'HRTF'; pan.distanceModel = 'exponential';
            pan.refDistance = 1.0; pan.maxDistance = 30.0;
            pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z;
            osc.connect(gain); gain.connect(pan); pan.connect(ctx.destination);
        } else {
            osc.connect(gain); gain.connect(ctx.destination);
        }
        osc.start(); osc.stop(ctx.currentTime + 0.2);
    });
}

/** Fanfarria de Estrella Recogida — Prioridad 10 (Máxima) */
export function playStarSound() {
    _playSound('star', 10, 0.8, (ctx) => {
        const notes = [523, 659, 784, 1047]; // Do-Mi-Sol-Do (octava arriba)
        notes.forEach((freq, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            const t    = ctx.currentTime + i * 0.12;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.25);
        });
    });
}

// ─────────────────────────────────────────────────────
// BGM CONTEXTUAL — Crossfade por Zona
// ─────────────────────────────────────────────────────

export async function playBGM(zoneId = 'tenochtitlan') {
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    currentZoneId = zoneId;

    const profile = AudioZoneMap.get(zoneId);
    const bgmPath = profile?.bgm;

    // Si no hay asset BGM, fade out del actual y silencio
    if (!bgmPath) {
        if (bgmGain) {
            bgmGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        }
        console.log(`[AudioEngine] No BGM asset for zone: ${zoneId}`);
        return;
    }

    // Crossfade: fade out anterior
    if (bgmSource && bgmGain) {
        bgmGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        bgmSource.stop(ctx.currentTime + 2.0);
    }

    // Cargar nuevo BGM si no está en cache
    if (!audioCache.has(`bgm_${zoneId}`)) {
        await _loadBuffer(`bgm_${zoneId}`, bgmPath);
    }

    const buf = audioCache.get(`bgm_${zoneId}`);
    if (!buf) return;

    // Fade in nuevo BGM
    bgmGain = ctx.createGain();
    bgmGain.gain.setValueAtTime(0, ctx.currentTime);
    bgmGain.gain.setTargetAtTime(0.4, ctx.currentTime + 0.5, 0.8);

    bgmSource = ctx.createBufferSource();
    bgmSource.buffer = buf;
    bgmSource.loop = true;
    bgmSource.connect(bgmGain);
    bgmGain.connect(ctx.destination);
    bgmSource.start(ctx.currentTime + 0.5);
}

/** Pasos diferenciados por material (RE4 style) */
export function playFootstep(material = 'dirt') {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    
    const configs = {
        stone: { freq: [150, 80], dur: 0.08, type: 'sawtooth', vol: 0.08 },
        dirt:  { freq: [100, 50], dur: 0.12, type: 'sawtooth', vol: 0.06 },
        water: { freq: [600, 400], dur: 0.2, type: 'sine',     vol: 0.05 },
        grass: { freq: [120, 60], dur: 0.15, type: 'sawtooth', vol: 0.04 },
    };
    const cfg = configs[material] || configs.dirt;
    
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = cfg.type;
    osc.frequency.setValueCurveAtTime(new Float32Array(cfg.freq), ctx.currentTime, cfg.dur);
    gain.gain.setValueAtTime(cfg.vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + cfg.dur);
}

/** Diagnóstico del engine para Debug HUD */
export function getAudioStats() {
    return {
        activeChannels: activeList.size,
        maxChannels: MAX_CHANNELS,
        poolAvailable: nodePool.length,
        cachedBuffers: audioCache.size,
        currentZone: currentZoneId
    };
}
