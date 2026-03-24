// js/main.js — Configuración principal de Phaser

const GAME_WIDTH = 932;
const GAME_HEIGHT = 430;

// Estado global del juego
window.GameState = {
  // Progresión
  tonalli: 0,                  // XP del jugador
  cacao: 0,                    // Moneda principal
  nivel: 1,
  // Vida
  vida: 3,
  vidaMax: 3,
  // Épocas
  epocaActual: 0,              // 0 = Mictlán Hub
  epocasDesbloqueadas: [1],    // Empezamos con era 1 disponible
  jefesVencidos: [],           // IDs de jefes derrotados
  // Coleccionables
  piedras: [],                 // Piedras del Quinto Sol (máx 6)
  disfracesDesbloqueados: ['base'], // Array de IDs comprados
  disfrazActual: 'base',            // ID del traje actualmente equipado
  items: {},                   // Ítems de tienda
};

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  transparent: true,
  backgroundColor: 'rgba(0,0,0,0)',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, MictlanHubScene, ShopScene, LevelScene, BossScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

window.onload = () => {
  window.game = new Phaser.Game(config);
  
  // Ocultar Three.js inicialmente
  document.getElementById('three-container').style.display = 'none';

  // Inicializar Motor 3D Global
  if (typeof Game3D !== 'undefined') {
    window.game3D = new Game3D('three-container');
  }
};
