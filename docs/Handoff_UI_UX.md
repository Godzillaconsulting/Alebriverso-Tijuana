# Handoff para Ingeniería Frontend UX/UI (Web DOM HUD)

**Contexto:**
El ecosistema gráfico es 100% WebGL (`<canvas>`), y el Engine despacha eventos lógicos. Tu tarea como agente Frontend es interceptar esta lógica para inyectar sobre el `<canvas>` componentes HTML/CSS de altísima calidad visual, responsividad y feedback.

Actualmente, las clases falsas/Mock `HealthUI.js` y `MissionManager.js` instanciadas globalmente en el objeto estático `window` actúan como *Routers*. Estás a cargo de reescribiarlas usando un mini-framework o manipulando `Vanilla DOM`. ¡NO usar ThreeJS para texto 2D! (Resta rendimiento).

## A. Subsistema de Salud Visual (`window.healthUI`)
El motor de físicas reporta daño y manda a llamar estos Hooks:
1. `window.healthUI.update(currentVida)`:
   - El Engine define *Health Máximo = 8*.
   - **Misión de Diseño**: Recrear los icónicos "Quesitos" (Círculo de la Salud) o una "Máscara Maya" que fracciona 8 partes visuales. Cuando `update(3)` se lanza, aplicar transiciones al 37.5%, rotaciones sutiles vibrantes y alertas rojas si `(vida <= 2)`.
2. `window.healthUI.showDeathScreen()`:
   - Interfiere toda la pantalla: Fade-In negro absoluto con letra de tipografía masiva: "¡NOS CARGÓ PIMPI!".

## B. Subsistema de Progreso y Misiones (`window.missionManager`)
Gestiona Coleccionables y Estrellas, reaccionando a las colisiones del Jugador con objetos `#ffff00` dictados por `PlayerController.js`.
1. `window.missionManager.collectCoin()`:
   - Disparado ~150 veces por nivel. El HUD del recuento de "Pasaje (Monedas)" debe brincar/escalar y contar `(prev + 1)`. 
2. `window.missionManager.triggerVictory(starId)`:
   - Disparado cuando el usuario toca un "Fragmento del Sol" en la pirámide suprema o en el Foso de Agua.
   - **Misión de Diseño**: *Super Splash Screen* interrumpiendo el flujo. Un pop-up centrado renderizando un Titulo de Victoria con brillos dorados, un botón para continuar `("Salir del Nivel" / "Continuar Explorando")` o un delay temporal cinemático que luego devuelva el usuario a la base.

*Regla Rígida*: El DOM no tiene interactividad de *Click* sobre el Engine (ThreeJS secuestra PointerLock y WASD). Todos tus HUDs DOM deben tener `pointer-events: none;`, excepto la Pantalla de Pausa/Victoria.
