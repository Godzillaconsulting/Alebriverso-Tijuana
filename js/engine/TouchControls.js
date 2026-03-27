// js/engine/TouchControls.js
// Overlay táctil para móviles — D-pad + botones A / Z
// Se inyecta sobre #app-wrapper y llama window.actualController.setInput()

(function () {
  'use strict';

  // ── Paleta ──────────────────────────────────────────────────────────────
  const PINK   = '#ff3fa4';
  const CYAN   = '#00e5ff';
  const GOLD   = '#ffd700';
  const BG     = 'rgba(10,10,26,0.55)';
  const SHADOW = '0 0 18px rgba(0,229,255,0.55)';

  // ── CSS ─────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #tc-root {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 100;
      user-select: none;
      -webkit-user-select: none;
    }
    #tc-root.tc-visible { pointer-events: all; }

    /* D-PAD */
    #tc-dpad {
      position: absolute;
      bottom: 18px;
      left: 18px;
      width: 130px;
      height: 130px;
      touch-action: none;
    }
    .tc-dpad-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid ${CYAN};
      background: ${BG};
      box-shadow: ${SHADOW};
    }
    /* Cross arms */
    .tc-arm {
      position: absolute;
      background: rgba(0,229,255,0.12);
      border: 1px solid rgba(0,229,255,0.35);
      border-radius: 4px;
      transition: background 0.06s, box-shadow 0.06s;
    }
    .tc-arm.h { top: 38%; left: 8%; width: 84%; height: 24%; }
    .tc-arm.v { top: 8%; left: 38%; width: 24%; height: 84%; }
    .tc-arm.active {
      background: rgba(0,229,255,0.45);
      box-shadow: 0 0 12px ${CYAN};
    }
    /* Thumb nub */
    #tc-nub {
      position: absolute;
      width: 40px; height: 40px;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0,229,255,0.7) 0%, rgba(0,229,255,0.15) 100%);
      border: 2px solid ${CYAN};
      box-shadow: 0 0 14px ${CYAN};
      pointer-events: none;
      transition: transform 0.05s, box-shadow 0.05s;
    }
    .tc-arrow-label {
      position: absolute;
      font-size: 13px;
      color: rgba(0,229,255,0.6);
      pointer-events: none;
      font-family: 'Bebas Neue', sans-serif;
    }

    /* BUTTONS */
    #tc-buttons {
      position: absolute;
      bottom: 18px;
      right: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    }
    .tc-btn {
      width: 58px; height: 58px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 18px;
      letter-spacing: 2px;
      color: #fff;
      position: relative;
      overflow: hidden;
      transition: transform 0.08s, box-shadow 0.08s;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .tc-btn:active { transform: scale(0.88); }
    #tc-btn-a {
      background: radial-gradient(circle at 40% 35%, ${PINK}, #8b005a);
      box-shadow: 0 0 18px ${PINK}, 0 4px 14px rgba(255,63,164,0.55);
    }
    #tc-btn-a.tc-pressed {
      box-shadow: 0 0 32px ${PINK}, 0 0 8px #fff;
    }
    #tc-btn-z {
      background: radial-gradient(circle at 40% 35%, ${GOLD}, #8b6000);
      box-shadow: 0 0 14px ${GOLD}, 0 4px 10px rgba(255,215,0,0.4);
      width: 50px; height: 50px; font-size: 15px;
    }
    #tc-btn-z.tc-pressed {
      box-shadow: 0 0 28px ${GOLD}, 0 0 6px #fff;
    }

    /* RIPPLE */
    .tc-ripple {
      position: absolute;
      border-radius: 50%;
      transform: scale(0);
      animation: tc-ripple-anim 0.5s ease-out forwards;
      pointer-events: none;
      background: rgba(255,255,255,0.45);
    }
    @keyframes tc-ripple-anim {
      to { transform: scale(3.5); opacity: 0; }
    }

    /* Glow pulse on press */
    @keyframes tc-glow-pulse {
      0%   { box-shadow: 0 0 18px ${PINK}; }
      50%  { box-shadow: 0 0 40px ${PINK}, 0 0 10px #fff; }
      100% { box-shadow: 0 0 18px ${PINK}; }
    }
    .tc-pulse-a { animation: tc-glow-pulse 0.35s ease-out; }
  `;
  document.head.appendChild(style);

  // ── DOM ─────────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'tc-root';

  // D-PAD
  const dpad = document.createElement('div');
  dpad.id = 'tc-dpad';
  dpad.innerHTML = `
    <div class="tc-dpad-ring"></div>
    <div class="tc-arm h"></div>
    <div class="tc-arm v"></div>
    <div id="tc-nub"></div>
    <span class="tc-arrow-label" style="top:8%;left:50%;transform:translateX(-50%)">▲</span>
    <span class="tc-arrow-label" style="bottom:8%;left:50%;transform:translateX(-50%)">▼</span>
    <span class="tc-arrow-label" style="left:8%;top:50%;transform:translateY(-50%)">◀</span>
    <span class="tc-arrow-label" style="right:8%;top:50%;transform:translateY(-50%)">▶</span>
  `;
  root.appendChild(dpad);

  // BUTTONS
  const btnRow = document.createElement('div');
  btnRow.id = 'tc-buttons';
  btnRow.innerHTML = `
    <button id="tc-btn-a" class="tc-btn">A</button>
    <button id="tc-btn-z" class="tc-btn">Z</button>
  `;
  root.appendChild(btnRow);

  // ── State ────────────────────────────────────────────────────────────────
  const state = { x: 0, y: 0, jump: false, action: false, jumpConsumed: false };
  let dpadActive = false;
  let dpadOriginX = 0, dpadOriginY = 0;
  const DPAD_RADIUS = 55; // px, dead zone + max deflection

  const nub    = root.querySelector('#tc-nub');
  const armH   = root.querySelectorAll('.tc-arm.h')[0];
  const armV   = root.querySelectorAll('.tc-arm.v')[0];

  // ── Helpers ──────────────────────────────────────────────────────────────
  function spawnRipple(el, clientX, clientY) {
    const rect = el.getBoundingClientRect();
    const r = document.createElement('div');
    r.className = 'tc-ripple';
    const size = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${size}px;height:${size}px;left:${clientX - rect.left - size / 2}px;top:${clientY - rect.top - size / 2}px`;
    el.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  }

  function updateNub(dx, dy) {
    const mx = dx * 16; // px offset from center
    const my = dy * 16;
    nub.style.transform = `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px))`;
    // Highlight cross arms
    armH.classList.toggle('active', Math.abs(dx) > 0.3);
    armV.classList.toggle('active', Math.abs(dy) > 0.3);
  }

  function pushInput() {
    const ctrl = window.actualController;
    if (!ctrl) return;
    const jump = state.jump && !state.jumpConsumed;
    if (jump) state.jumpConsumed = true;
    ctrl.setInput(state.x, state.y, jump, state.action);
  }

  // ── D-PAD touch events ───────────────────────────────────────────────────
  dpad.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const rect = dpad.getBoundingClientRect();
    dpadOriginX = rect.left + rect.width  / 2;
    dpadOriginY = rect.top  + rect.height / 2;
    dpadActive = true;
    processDpadTouch(t);
  }, { passive: false });

  dpad.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!dpadActive) return;
    processDpadTouch(e.changedTouches[0]);
  }, { passive: false });

  dpad.addEventListener('touchend', (e) => {
    e.preventDefault();
    dpadActive = false;
    state.x = 0; state.y = 0;
    updateNub(0, 0);
    pushInput();
  }, { passive: false });

  dpad.addEventListener('touchcancel', (e) => {
    dpadActive = false;
    state.x = 0; state.y = 0;
    updateNub(0, 0);
  }, { passive: false });

  function processDpadTouch(touch) {
    let dx = (touch.clientX - dpadOriginX) / DPAD_RADIUS;
    let dy = (touch.clientY - dpadOriginY) / DPAD_RADIUS;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; }
    // Dead zone
    if (Math.abs(dx) < 0.12) dx = 0;
    if (Math.abs(dy) < 0.12) dy = 0;
    state.x = dx;
    state.y = -dy; // Invert: up touch → positive Y in world
    updateNub(dx, -dy);
    pushInput();
  }

  // ── BUTTON A (Jump) ──────────────────────────────────────────────────────
  const btnA = root.querySelector('#tc-btn-a');
  btnA.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.jump = true;
    state.jumpConsumed = false;
    btnA.classList.add('tc-pressed', 'tc-pulse-a');
    spawnRipple(btnA, e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    pushInput();
    btnA.addEventListener('animationend', () => btnA.classList.remove('tc-pulse-a'), { once: true });
  }, { passive: false });

  btnA.addEventListener('touchend', (e) => {
    e.preventDefault();
    state.jump = false;
    state.jumpConsumed = false;
    btnA.classList.remove('tc-pressed');
  }, { passive: false });

  // Also support mouse for desktop testing
  btnA.addEventListener('pointerdown', () => {
    state.jump = true; state.jumpConsumed = false; pushInput();
  });
  btnA.addEventListener('pointerup', () => { state.jump = false; state.jumpConsumed = false; });

  // ── BUTTON Z (Action) ────────────────────────────────────────────────────
  const btnZ = root.querySelector('#tc-btn-z');
  btnZ.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.action = true;
    btnZ.classList.add('tc-pressed');
    spawnRipple(btnZ, e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    pushInput();
  }, { passive: false });

  btnZ.addEventListener('touchend', (e) => {
    e.preventDefault();
    state.action = false;
    btnZ.classList.remove('tc-pressed');
    pushInput();
  }, { passive: false });

  btnZ.addEventListener('pointerdown', () => { state.action = true;  pushInput(); });
  btnZ.addEventListener('pointerup',   () => { state.action = false; pushInput(); });

  // ── Polling loop (bridges to Phaser update) ──────────────────────────────
  // Called every rAF so the controller always gets the latest analog values
  let running = false;
  function poll() {
    if (!running) return;
    if (dpadActive || state.jump || state.action) pushInput();
    requestAnimationFrame(poll);
  }

  // ── Public API ───────────────────────────────────────────────────────────
  window.touchControls = {
    show() {
      const wrapper = document.getElementById('app-wrapper') || document.body;
      if (!root.parentNode) wrapper.appendChild(root);
      root.classList.add('tc-visible');
      running = true;
      poll();
    },
    hide() {
      root.classList.remove('tc-visible');
      running = false;
      state.x = 0; state.y = 0; state.jump = false; state.action = false;
    },
    /** Read current state (for Phaser scenes that poll manually) */
    getState() { return state; },
    /** Call from Phaser update() to merge touch + keyboard inputs */
    mergeInputs(kbX, kbY, kbJump, kbAction) {
      const x = kbX !== 0 ? kbX : state.x;
      const y = kbY !== 0 ? kbY : state.y;
      const jump   = kbJump   || (state.jump && !state.jumpConsumed);
      const action = kbAction || state.action;
      if (jump && state.jump) state.jumpConsumed = true;
      return { x, y, jump, action };
    },
  };

  // Auto-show on touch-capable devices
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    // Small delay so DOM is ready
    document.addEventListener('DOMContentLoaded', () => window.touchControls.show(), { once: true });
    if (document.readyState !== 'loading') window.touchControls.show();
  }
})();
