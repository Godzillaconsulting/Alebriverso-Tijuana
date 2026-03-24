# INSTRUCCIONES ESTRICTAS PARA AGENTES (ENGINE ARCHITECTURE)
**Proyecto**: Tijuana: Alebrije en Vacaciones
**Framework Core**: Three.js (Motor Físico 3D) + Phaser (Capa UI de Cristal)

## REGLAS DE ORO
1. **Físicas y Personaje**: El juego corre en **3D REAL**. Nunca, bajo ninguna circunstancia, se debe usar `this.physics.add.sprite()` de Phaser para el Alebrije, los Enemigos o las Plataformas. Todo cálculo físico o instanciación en pantalla de juego debe pasar por el motor híbrido: `new AlebrijeController(this.threeScene)` y `new EnemyManager(this.threeScene)`.
2. **Rol de Phaser**: Phaser 3 ÚNICAMENTE se utiliza para la interfaz gráfica de usuario (UI), sistema de diálogos, barras de salud (`this.add.rectangle`), joysticks móviles invisibles y la pantalla de carga (`BootScene`). El `<canvas>` de Phaser está configurado con transparencia (`rgba(0,0,0,0)`) para revelar el `<div id="three-container">` por debajo.
3. **Escenas Dinámicas**: Se ha implementado un sistema paramétrico. Ya NO se deben crear archivos como `Epoca1Scene.js` o `Epoca2Scene.js`. TODO se carga dinámicamente inyectando parámetros a través de `this.scene.start('LevelScene', { epocaId: X })` y `this.scene.start('BossScene', { epocaId: X })`, alimentándose del diccionario `window.EpochData`.
4. **Actualizaciones**: Cuando crees lógicas de persecución, movimiento o daño, esto debe realizarse dentro del método `update(time, delta)` interceptando o leyendo las posiciones Z, X e Y del `AlebrijeController` o mediante la instancia del `EnemyManager`.
5. **No Descartes la Cámara**: Toda escena debe poseer `this.threeCamera = new THREE.PerspectiveCamera(...)` y su update local a través de `this.alebrije.update(delta)`. No inventes objetos globales (`window.game3D.controller`) fuera del estándar provisto.

Cualquier desvío a estas 5 reglas romperá el renderizado y resultará en la demolición de tu código por el Engine Specialist.
