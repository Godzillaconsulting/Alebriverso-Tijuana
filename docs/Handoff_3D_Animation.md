# Handoff para Agente de Modelado Animación y Asset Ops (3D)

**Contexto:**
El *"Tijuana Engine"* se encuentra en versión 2.0. Funciona un LevelLoader que parsea JSON instanciando colisionadores invisibles. Hasta el día de hoy, el Game Loop grafica y emparenta la lógica AABB con geometrías basurero (Primitivas). Es momento de migrar al estándar `THREE.GLTFLoader`.

## 1. El Protagonista (Iguana Alebrije)
El motor asume un Mesh llamado `protagonistNode` inyectado en `main.js`.
Debes generar o adaptar un archivo `alebrije_player.glb` y cargarlo vía `GLTFLoader`.

**Requisitos Críticos del AnimationMixer:**
Las físicas complejas dictadas por `PlayerController.js` hacen un *Bind* forzoso hacia un mapa de animaciones. Tu modelo **DEBE** contener **estrictamente** los siguientes Clips de animación, respetando la nomenclatura (Lower-Case):

- `idle` (Quieto, respirando relajado).
- `run` (Corriendo a cuatro o dos patas, muy veloz).
- `jump` (Salto estándar o mortal hacia adelante).
- `pound` (Animación icónica de *Sentón / Ground Pound*, las rodillas hacia el pecho).
- `dive` (Plancha o caída libre horizontal, brazos estirados).
- `slide` (Inercia arrastrándose boca abajo post-dive).
- `wallslide` (Agarrando la pared con una garra para resbalar lento hacia el suelo).
- `crouch` (Agachado preparándose para Backflip o evitar daño).
- `hard_landing` (Estrellado contra el piso sobandose la cabeza, stuneado).
- `swimming` (Pataleo suave acuático estilo rana/delfín).
- `ledge_grab` (Colgando al borde de un precipicio con las manos sudorosas).
- `hurt` (Impacto / Retroceso recibiendo daño genérico).

## 2. Los Enemigos
El JSON de `level1.json` carga entidades basadas en `type`.
Debes generar los siguientes modelos `GLTF` separados:
1. `alebrije_limo.glb`: Un monstruo baboso/básico (Reemplazo genérico Goomba).
2. `guerrero_jaguar.glb`: Monstruo alto/agresivo de persecución de Tlatelolco.
3. `espiritu_nahual.glb`: Entidad fantasmagórica estática rotatoria para la Selva.

Sus `AnimationMixer`s deben poseer mínimamente:
- `idle` (Merodeando, `PATROL` mode).
- `chase` (Corriendo agresivamente al jugador, `CHASE` mode).

## 3. Instrucción de Implementación
1. Revisa `C:\Users\GODZILLA.IA\Tijuana\js\main.js`, en el área `GLTFLoader`. Elimina el `BoxGeometry` negro.
2. Inyecta el `.glb`. Guarda los clips resultantes en el Array local `animationsMap` mapeados por su *nombre original*.
3. Asegurate de habilitar `Mesh.castShadow = true` en cada subcomponente dentro de `gltf.scene.traverse()`.
