# Handoff para Agente de Diseño de Audio, Masterización y VFX

**Contexto:**
El motor corre a gran velocidad, y un factor vital en consolas PS2 era el *Game Feel* provocado por la rimbombancia acústica. Actualmente, `C:\Users\GODZILLA.IA\Tijuana\js\audio\AudioManager.js` engaña al motor usando "Síntesis Procedural de Osciladores" (`OscillatorNodes` puros sin librerías externas) que generan simples beeps. Tu deber es matar esto inyectando el componente Hollywood.

## Tareas en Inyección Directa (`AudioManager.js` / `VFX.js`)

#### 1. Implementación de Efectos Sonoros Básicos (Caché en Memoria RAM)
El `AudioManager.js` debe utilizar `AudioContext` puro o exponer `THREE.AudioListener`. Debes precargar obligatoriamente los siguientes `.mp3/.ogg` y reemplazar mis llamados sintéticos de parche:
- `playJump(x,y,z)`: Retirar `playJumpSynthesized` del *PlayerController*. Poner un Grito / Ahínco tipo "¡Wahoo!" o "¡Jeck!". Es un audio direccional 3D de alta repetición.
- `playThud(x,y,z)`: Ruido letal seco inyectado cuando cae un *Ground Pound*, mueres achicharrado, o estrellas tus huesos contra una pared.
- `playCoin() / playPasaje()`: Agudo y reconfortante.

#### 2. Música de Fondo Atmosférica (BGM Crossfading)
El nivel ha crecido monstruosamente a Mundo Abierto (`level1.json` de 5 micro-fases). Implementar un Track-Cycler:
- **IDLE THEME** (Tlatelolco y Chinampas): Flautas y ocarinas calmas.
- **HOSTILE THEME** (Volcán o Cuando la IA Jaguares detona "*CHASE*"): Cambiar canal a percusiones mexicas tensas.

*Regla Rígida*: Nunca detengas la pista completamente, haz un `GainNode.linearRampToValueAtTime()` de 2.0 segundos (Fade IN / OUT al chocar regiones cartesianas o evadir la agrobatería enemiga).

#### 3. Agente VFX (Sistemas de Partículas)
Actualmente operamos un burdo generador de polígonos aleatorios minúsculos refrayendo hacia arriba como "Polvo".
En `/js/engine/VFXManager.js` debes reemplazarlo implementando `THREE.InstancedMesh` o bien el módulo de ShaderParticles.
- `emitDust(x,y,z)`: Cada salto de lodo lanza partículas cafés oscuras.
- `emitSplash(x,y,z)`: Burbujas celestes cuando caen en `isMud` o `waterLevel = -15`.
- `emitSparks(x,y,z)`: Cuando rebotan con colisión lateral del *Guerrero Jaguar* (Rojo fuego + Glow shader).
