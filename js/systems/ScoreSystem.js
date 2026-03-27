/**
 * SCORE SYSTEM: Puntuación Moderna — PS2-era Quality Pass
 * ──────────────────────────────────────────────────────────────────────────────
 * Inspirado en:
 *   behavior_data.c → bhvYellowCoin, bhvStar (contadores SM64)
 *
 * PS2-quality upgrades vs SM64/N64 base:
 *   - Kill Streak Announcer (FIRST BLOOD / DOUBLE KILL / RAMPAGE...)
 *     inspirado en juegos PS2 del mismo periodo (Jak, Ratchet & Clank)
 *   - Multiplicador de Combo dinámico con decaimiento visual (barra curva)
 *   - HUD semitransparente con glassmorphism y micro-animaciones
 *   - Popups flotantes con easing cúbico en posición pantalla-relativa
 *   - Kill Streak que se resetea si pasan 4 segundos sin matar
 *   - Tracker visual de 5 Fragmentos de Obsidiana (progreso hacia la Espada)
 *   - Usa window.scoreSystem en collectible (no se pasa como param al construir)
 */

// ── Tabla de Kill Streak Announces ──────────────────────────────────────────
// Inspirada en la progresión dramática de Jak II y los Spartans de Halo PS2
const STREAK_NAMES = [
    null,          // 0
    null,          // 1
    '¡DOBLE!',     // 2
    '¡TRIPLE!',    // 3
    '¡MORTAL!',    // 4
    '¡DOMINANDO!', // 5
    '¡IMPARABLE!', // 6
    '¡RAMPAGE!',   // 7+
];

export class ScoreSystem {
    constructor() {
        this.score          = 0;
        this.combo          = 1;
        this.comboTimer     = 0;
        this.COMBO_WINDOW   = 3.5;
        this.MAX_COMBO      = 8;

        this.obsidianShards   = 0;
        this.SHARDS_FOR_SWORD = 5;
        this.swordUnlocked    = false;

        this.killStreak     = 0;
        this.streakTimer    = 0;
        this.STREAK_WINDOW  = 4.0; // Segundos para mantener streak vivo

        this.sessionKills   = 0;
        this.sessionPickups = 0;

        this._buildHUD();
        this._tickId = setInterval(() => this._tick(1 / 30), 1000 / 30);
    }

    // ─── API Pública ─────────────────────────────────────────────────────────

    addScore(base, type = 'generic') {
        const mult  = Math.round(base * this.combo);
        this.score += mult;
        this._refreshScore();
        this._spawnPopup(`+${mult.toLocaleString()}`, this._colorForType(type));
        return mult;
    }

    addKill() {
        this.sessionKills++;
        this.killStreak++;
        this.streakTimer = 0;
        this._bumpCombo();
        this.addScore(250, 'enemy');
        this._announceStreak();
        this._refreshComboUI();
    }

    addObsidianShard() {
        this.obsidianShards++;
        this.sessionPickups++;
        this._bumpCombo();
        this.addScore(100, 'pickup');
        this._refreshShardsUI();

        if (this.obsidianShards >= this.SHARDS_FOR_SWORD && !this.swordUnlocked) {
            this._unlockSword();
        }
    }

    resetCombo() {
        this.combo      = 1;
        this.comboTimer = 0;
        this.killStreak = 0;
        this._refreshComboUI();
    }

    getSummary() {
        return {
            score:   this.score,
            kills:   this.sessionKills,
            pickups: this.sessionPickups,
            sword:   this.swordUnlocked
        };
    }

    dispose() {
        clearInterval(this._tickId);
        if (this._root?.parentNode) this._root.parentNode.removeChild(this._root);
        if (this._popupCont?.parentNode) this._popupCont.parentNode.removeChild(this._popupCont);
    }

    // ─── Lógica interna ──────────────────────────────────────────────────────

    _bumpCombo() {
        this.comboTimer = 0;
        if (this.combo < this.MAX_COMBO) {
            this.combo++;
            if (this.combo > 2) {
                this._spawnPopup(`×${this.combo} COMBO`, '#f0a500');
            }
        }
    }

    _tick(dt) {
        // ── Decaimiento del Combo ──
        if (this.combo > 1) {
            this.comboTimer += dt;
            const pct = Math.max(0, 1 - this.comboTimer / this.COMBO_WINDOW);
            if (this._comboBar) {
                this._comboBar.style.width = `${pct * 100}%`;
                this._comboBar.style.opacity = pct > 0.1 ? '1' : '0.2';
            }
            if (this.comboTimer >= this.COMBO_WINDOW) {
                this.combo = Math.max(1, this.combo - 1);
                this.comboTimer = 0;
                this._refreshComboUI();
            }
        }

        // ── Decaimiento del Kill Streak ──
        if (this.killStreak > 0) {
            this.streakTimer += dt;
            if (this.streakTimer >= this.STREAK_WINDOW) {
                this.killStreak = 0;
                this.streakTimer = 0;
            }
        }
    }

    _announceStreak() {
        const name = STREAK_NAMES[Math.min(this.killStreak, STREAK_NAMES.length - 1)];
        if (!name) return;

        const el = document.createElement('div');
        el.style.cssText = `
            position: fixed; top: 38%; left: 50%;
            transform: translate(-50%, -50%) scale(0.6);
            font-family: 'Georgia', serif; font-size: 2.4rem; font-weight: 900;
            color: #fff; letter-spacing: 4px; text-transform: uppercase;
            text-shadow: 0 0 20px rgba(255,80,0,0.9), 0 2px 6px rgba(0,0,0,0.8);
            pointer-events: none; z-index: 9001;
            transition: transform 0.25s cubic-bezier(0.175,0.885,0.32,1.5), opacity 0.4s;
            opacity: 0;
        `;
        el.textContent = name;
        document.body.appendChild(el);

        requestAnimationFrame(() => {
            el.style.transform = 'translate(-50%, -50%) scale(1)';
            el.style.opacity   = '1';
        });

        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translate(-50%, -58%) scale(0.9)';
            setTimeout(() => document.body.removeChild(el), 450);
        }, 1100);
    }

    _colorForType(type) {
        return type === 'enemy' ? '#ff6644' : type === 'pickup' ? '#bb88ff' : '#ffffff';
    }

    _unlockSword() {
        this.swordUnlocked = true;
        window.dispatchEvent(new CustomEvent('obsidianSwordUnlocked'));
        this.addScore(1000, 'pickup');
        this._showSwordCinematic();
    }

    _showSwordCinematic() {
        const el = document.createElement('div');
        el.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%,-50%) scale(0.5);
            background: linear-gradient(135deg, #0d0015 0%, #2d0055 100%);
            border: 2px solid #bb44ff; border-radius: 20px;
            padding: 28px 50px; z-index: 9999; color: #fff;
            font-family: 'Georgia', serif; text-align: center;
            box-shadow: 0 0 60px rgba(170,0,255,0.9), inset 0 1px 0 rgba(255,255,255,0.08);
            transition: transform 0.5s cubic-bezier(0.175,0.885,0.32,1.5), opacity 0.5s;
            pointer-events: none; opacity: 0;
        `;
        el.innerHTML = `
            <div style="font-size:2.8rem; margin-bottom:10px; filter:drop-shadow(0 0 12px #aa00ff)">⚔️</div>
            <div style="font-size:1.5rem; font-weight:900; letter-spacing:3px; color:#cc88ff; text-transform:uppercase;">
                Espada de Obsidiana
            </div>
            <div style="font-size:0.9rem; margin-top:10px; color:#8855aa; letter-spacing:1px;">
                5 fragmentos consumidos — poder desbloqueado
            </div>
        `;
        document.body.appendChild(el);
        requestAnimationFrame(() => {
            el.style.transform = 'translate(-50%,-50%) scale(1)';
            el.style.opacity   = '1';
        });
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translate(-50%,-60%) scale(0.95)';
            setTimeout(() => document.body.removeChild(el), 600);
        }, 3200);
    }

    // ─── HUD ─────────────────────────────────────────────────────────────────

    _buildHUD() {
        // Google Font (Inter) cargada si no existe
        if (!document.querySelector('link[href*="Inter"]')) {
            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap';
            document.head.appendChild(link);
        }

        this._root = document.createElement('div');
        this._root.id = 'ss-hud';
        this._root.style.cssText = `
            position: fixed; top: 18px; right: 18px; min-width: 210px;
            padding: 14px 18px;
            background: rgba(4, 0, 12, 0.72);
            backdrop-filter: blur(14px) saturate(160%);
            border: 1px solid rgba(150,0,255,0.28);
            border-radius: 16px;
            color: #fff;
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            box-shadow: 0 0 30px rgba(120,0,220,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
            pointer-events: none; z-index: 1000;
            display: flex; flex-direction: column; gap: 9px;
        `;

        // Label
        const label = document.createElement('div');
        label.style.cssText = 'font-size:9px; letter-spacing:2.5px; color:rgba(255,255,255,0.3); text-transform:uppercase;';
        label.textContent = 'Puntaje';

        // Score
        this._scoreEl = document.createElement('div');
        this._scoreEl.style.cssText = `
            font-size: 30px; font-weight: 800; letter-spacing: 1px;
            text-shadow: 0 0 16px rgba(180,80,255,0.9);
            transition: transform 0.1s ease;
        `;
        this._scoreEl.textContent = '0';

        // Separador
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px; background:rgba(255,255,255,0.07);';

        // Combo row
        const comboRow = document.createElement('div');
        comboRow.style.cssText = 'display:flex; align-items:center; gap:8px;';
        this._comboLabel = document.createElement('span');
        this._comboLabel.style.cssText = 'font-size:12px; font-weight:700; color:#f0a500; letter-spacing:1px; min-width:70px;';
        this._comboLabel.textContent = '×1 COMBO';
        const barWrap = document.createElement('div');
        barWrap.style.cssText = 'flex:1; height:3px; background:rgba(255,255,255,0.08); border-radius:2px; overflow:hidden;';
        this._comboBar = document.createElement('div');
        this._comboBar.style.cssText = `
            height:100%; width:0; border-radius:2px;
            background: linear-gradient(90deg, #f0a500, #ff3300);
            transition: width 0.08s linear;
        `;
        barWrap.appendChild(this._comboBar);
        comboRow.append(this._comboLabel, barWrap);

        // Shards tracker
        this._shardsEl = document.createElement('div');
        this._shardsEl.style.cssText = 'display:flex; align-items:center; gap:5px; font-size:12px; color:#aa88ff;';
        this._refreshShardsUI();

        this._root.append(label, this._scoreEl, sep, comboRow, this._shardsEl);
        document.body.appendChild(this._root);

        // Popup container
        this._popupCont = document.createElement('div');
        this._popupCont.style.cssText = `
            position:fixed; top:0; left:0; width:100%; height:100%;
            pointer-events:none; z-index:999; overflow:hidden;
        `;
        document.body.appendChild(this._popupCont);
    }

    _refreshScore() {
        if (!this._scoreEl) return;
        this._scoreEl.textContent = this.score.toLocaleString();
        this._scoreEl.style.transform = 'scale(1.14)';
        setTimeout(() => { this._scoreEl.style.transform = 'scale(1)'; }, 90);
    }

    _refreshComboUI() {
        if (!this._comboLabel) return;
        this._comboLabel.textContent = `×${this.combo} COMBO`;
        this._comboLabel.style.color =
            this.combo >= 6 ? '#ff2200' :
            this.combo >= 4 ? '#ff7700' :
            this.combo >= 2 ? '#f0a500' : 'rgba(255,255,255,0.3)';
    }

    _refreshShardsUI() {
        if (!this._shardsEl) return;
        const pips = Array.from({ length: this.SHARDS_FOR_SWORD }, (_, i) => `
            <span style="
                display:inline-block; width:11px; height:11px;
                border-radius:2px; margin-right:3px;
                background:${i < this.obsidianShards
                    ? 'linear-gradient(135deg,#aa44ff,#6600cc)'
                    : 'rgba(255,255,255,0.12)'};
                transition:background 0.3s; box-shadow:${i < this.obsidianShards
                    ? '0 0 6px rgba(170,0,255,0.8)' : 'none'};
            "></span>`).join('');
        this._shardsEl.innerHTML = `<span style="margin-right:6px;">◆</span>${pips}
            <span style="margin-left:4px; color:rgba(255,255,255,0.4);">${this.obsidianShards}/${this.SHARDS_FOR_SWORD}</span>`;
    }

    // ── Popup flotante con easing cúbico (PS2-style juiciness) ───────────────
    _spawnPopup(text, color = '#fff') {
        const el = document.createElement('div');
        const x  = 55 + Math.random() * 20; // % horizontal centrado
        const y  = 28 + Math.random() * 8;  // % vertical

        el.style.cssText = `
            position: absolute;
            left: ${x}%; top: ${y}%;
            transform: translate(-50%,-50%) scale(0.7);
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 24px; font-weight: 800;
            color: ${color};
            text-shadow: 0 2px 10px rgba(0,0,0,0.7);
            pointer-events: none;
            opacity: 0;
            transition: transform 0.22s cubic-bezier(0.175,0.885,0.32,1.5),
                        opacity 0.15s ease,
                        top 0.7s cubic-bezier(0.25,0.46,0.45,0.94);
        `;
        el.textContent = text;
        this._popupCont.appendChild(el);

        requestAnimationFrame(() => {
            el.style.opacity   = '1';
            el.style.transform = 'translate(-50%,-50%) scale(1)';
        });

        setTimeout(() => {
            el.style.top     = `${parseFloat(el.style.top) - 7}%`;
            el.style.opacity = '0';
        }, 350);

        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 900);
    }
}
