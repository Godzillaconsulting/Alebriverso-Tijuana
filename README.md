# 🐾 TIJUANA: Alebrije en Vacaciones

> RPG de plataformas mexicano. Tijuana el Alebrije viaja por 6 épocas de la historia de México para llegar a Cancún.

---

## 🚀 Cómo levantar el juego localmente

### Requisitos previos

| Herramienta | Versión mínima | Descarga |
|------------|---------------|---------|
| Node.js    | 18+           | https://nodejs.org |
| npm / npx  | Incluido con Node.js | — |

> **No se necesita backend ni base de datos.** El juego es 100% client-side (HTML + JS + WebGL).

---

### ▶️ Opción A — Doble clic (Windows)

1. Navega a la carpeta del proyecto (`c:\Users\GODZILLA.IA\Tijuana`).
2. Haz doble clic en **`start.bat`**.
3. Se abrirá una terminal y el servidor se levantará en `http://localhost:5500`.
4. Abre tu navegador en esa URL.

---

### ▶️ Opción B — PowerShell (recomendado para devs)

```powershell
# Desde PowerShell, en la carpeta del proyecto:
.\start.ps1
```

> La primera vez puede pedir permiso de ejecución. Ejecuta esto una sola vez:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

El script **abre el navegador automáticamente** en `http://localhost:5500`.

---

### ▶️ Opción C — Manual (cualquier OS)

```bash
cd c:/Users/GODZILLA.IA/Tijuana
npx serve . --listen 5500 --cors
```

---

## 🌐 URL de desarrollo

```
http://localhost:5500
```

> **Nota:** El puerto 5500 se usa porque el puerto 3000 ya está ocupado por el servicio backend de Godzilla Consulting.

El archivo principal es `index.html` en la raíz del proyecto.

---

## 🗂️ Estructura del proyecto

```
Tijuana/
├── index.html              ← Punto de entrada del juego
├── start.bat               ← Launcher Windows (doble clic)
├── start.ps1               ← Launcher PowerShell (devs)
├── README.md               ← Este archivo
│
├── css/
│   └── style.css           ← Estilos globales
│
├── js/
│   ├── main.js             ← Inicialización de Phaser
│   ├── engine/
│   │   ├── AlebrijeController.js  ← Físicas del protagonista (SM64-style)
│   │   ├── EnemyManager.js        ← FSM de enemigos
│   │   ├── Game3D.js              ← Motor Three.js / WebGL
│   │   └── MusicManager.js        ← Sistema de audio
│   ├── scenes/
│   │   ├── BootScene.js           ← Precarga de assets
│   │   ├── TitleScene.js          ← Pantalla de título
│   │   ├── MictlanHubScene.js     ← Hub World central
│   │   ├── LevelScene.js          ← Niveles de épocas
│   │   ├── BossScene.js           ← Batallas de jefes
│   │   ├── ShopScene.js           ← Tienda de Cacao
│   │   └── UIScene.js             ← HUD superpuesto
│   └── data/
│       └── EpochData.js           ← Datos de las 6 épocas históricas
│
├── assets/                 ← Sprites, audio, modelos 3D
├── docs/                   ← Documentación adicional
└── scripts/                ← Scripts de utilidad
```

---

## 🛠️ Stack técnico

| Capa | Tecnología | Función |
|------|-----------|---------|
| 2D / HUD | [Phaser 3.70](https://phaser.io) | Escenas, físicas 2D, UI |
| 3D / Fondo | [Three.js r140](https://threejs.org) | Renderer WebGL, shaders |
| Tipografía | Google Fonts (Bebas Neue, Outfit) | — |
| Servidor dev | `npx serve` | Sirviendo archivos estáticos con CORS (puerto 5500) |

---

## ⚠️ Notas sobre CORS

El juego carga assets locales (imágenes, audio, scripts). Si se abre directamente con `file://`, el navegador **bloquea** esas peticiones por política CORS.

**Por eso es obligatorio usar el servidor local** (`npx serve . --cors`).  
La flag `--cors` agrega los headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
```

Esto resuelve todos los errores de tipo `Cross-Origin Resource Sharing`.

---

## 🎮 Épocas del juego

| # | Época | Estado |
|---|-------|--------|
| 1 | Tenochtitlán (1325) | ✅ Completada |
| 2 | La Conquista / Noche Triste (1520) | 🔧 En desarrollo |
| 3 | Independencia (1810) | 📋 Planeada |
| 4 | Revolución Mexicana (1910) | 📋 Planeada |
| 5 | Tijuana Dorada (1970s) | 📋 Planeada |
| 6 | Cancún Futuro (2099) | 📋 Planeada |

---

## 👾 Agentes de desarrollo

Este proyecto sigue una arquitectura multi-agente (ver `GDD_MASTER_SERVER_AGENTS.txt`):

- **Agente 1 — DevOps / Launcher**: Servidor local y documentación *(este README)*
- **Agente 2 — Arte / Assets**: Sprites, modelos 3D, shaders
- **Agente 3 — Engine / Física**: `AlebrijeController`, mecánicas SM64
- **Agente 4 — Diseño de Niveles**: Construcción de épocas y bosses
- **Agente 5 — QA / Testing**: Verificación de builds y regresiones

---

*Hecho con 🌮 en Tijuana, B.C. — ALEBRIVERSO © 2025*
