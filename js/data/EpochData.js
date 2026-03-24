// js/data/EpochData.js — Datos de diseño y enemigos de las 6 épocas

window.EpochData = {
  1: {
    nombre: "🌿 TENOCHTITLÁN 1400 d.C.",
    bgType: 'piramides',
    colores: { cieloTop: 0x1a3a1a, cieloBot: 0x051018, bgElement: 0x1e3a1e, sueloTop: 0x2d5a1e, sueloBot: 0x1a3a10, platTop: 0x4a7c2e, platBot: 0x3a6a1e },
    piedra: "obsidiana",
    boss: { nombre: 'Huitzilopochtli', titulo: 'Huitzilo domado' },
    drawEnemigo: (g, x, y) => {
      // Serpiente de piedra
      g.fillStyle(0x666666, 1); g.fillEllipse(0, 0, 36, 24);
      g.fillStyle(0x444444, 1); g.fillEllipse(20, -4, 18, 16);
      g.fillStyle(0xff0000, 1); g.fillCircle(26, -7, 3); g.fillCircle(22, -7, 3);
      g.setPosition(x, y);
    },
    drawBoss: (g) => {
      // Huitzilopochtli Colibrí
      g.fillStyle(0xcc2222, 1); g.fillEllipse(50, 70, 80, 100);
      g.fillStyle(0x11aa55, 1); g.fillTriangle(10, 40, -40, 0, 10, 80); g.fillTriangle(90, 40, 140, 0, 90, 80);
      g.fillStyle(0xffaa00, 1); g.fillRect(30, 20, 40, 40);
      g.fillStyle(0xffffff, 1); g.fillCircle(40, 30, 8); g.fillCircle(60, 30, 8);
      g.fillStyle(0x00e5ff, 1); g.fillEllipse(40, 45, 6, 15); g.fillEllipse(60, 45, 6, 15); // Lágrimas
    }
  },
  2: {
    nombre: "⚔️ LA CONQUISTA 1521 d.C.",
    bgType: 'barcos',
    colores: { cieloTop: 0x3a1a1a, cieloBot: 0x180505, bgElement: 0x5a2d2d, sueloTop: 0x4a3a30, sueloBot: 0x2a1a10, platTop: 0x6a5c50, platBot: 0x4a3c30 },
    piedra: "jade",
    boss: { nombre: 'Hernán Cortex', titulo: 'Cortex Llorón' },
    drawEnemigo: (g, x, y) => {
      // Soldado español genérico (casco de metal)
      g.fillStyle(0xaaaaaa, 1); g.fillEllipse(0, 0, 24, 34); // Cuerpo armadura
      g.fillStyle(0xdddddd, 1); g.fillTriangle(-12, -15, 0, -30, 12, -15); // Casco picudo
      g.fillStyle(0xffccaa, 1); g.fillRect(-10, -10, 20, 10); // Cara
      g.fillStyle(0x000000, 1); g.fillCircle(-4, -6, 2); g.fillCircle(4, -6, 2);
      g.setPosition(x, y);
    },
    drawBoss: (g) => {
      // Hernán Cortex (Cabezón con armadura dorada)
      g.fillStyle(0xddaa00, 1); g.fillRoundedRect(10, 50, 80, 70, 10); // Armadura
      g.fillStyle(0xffccaa, 1); g.fillCircle(50, 30, 35); // Cabezota
      g.fillStyle(0x333333, 1); g.fillTriangle(15, 10, 50, -30, 85, 10); // Casco
      g.fillStyle(0x111111, 1); g.fillRect(30, 20, 40, 10); // Mostacho
      g.fillStyle(0xffffff, 1); g.fillCircle(40, 15, 5); g.fillCircle(60, 15, 5); // Ojos
    }
  },
  3: {
    nombre: "⛪ NUEVA ESPAÑA 1650 d.C.",
    bgType: 'catedral',
    colores: { cieloTop: 0x1a1a3a, cieloBot: 0x050518, bgElement: 0x2a2a4a, sueloTop: 0x30304a, sueloBot: 0x10102a, platTop: 0x50506a, platBot: 0x30304a },
    piedra: "amatista",
    boss: { nombre: 'Virrey Pomposo', titulo: 'Virrey empolvado' },
    drawEnemigo: (g, x, y) => {
      // Fraile con antorcha
      g.fillStyle(0x4a3018, 1); g.fillTriangle(-15, 15, 0, -20, 15, 15); // Hábito
      g.fillStyle(0xffccaa, 1); g.fillCircle(0, -20, 10); // Cabeza calva
      g.fillStyle(0xffaa00, 1); g.fillCircle(15, -10, 6); // Fuego antorcha
      g.setPosition(x, y);
    },
    drawBoss: (g) => {
      // Virrey enorme con peluca
      g.fillStyle(0x990033, 1); g.fillEllipse(50, 70, 100, 80); // Abrigo gigante
      g.fillStyle(0xffffff, 1); g.fillCircle(50, 20, 40); // Peluca blanca rizada
      g.fillStyle(0xffffff, 1); g.fillCircle(20, 20, 25); g.fillCircle(80, 20, 25); // Rizos lat
      g.fillStyle(0xffccaa, 1); g.fillRect(35, 20, 30, 30); // Cara 
      g.fillStyle(0x111111, 1); g.fillCircle(45, 30, 4); g.fillCircle(55, 30, 4); 
    }
  },
  4: {
    nombre: "🔔 INDEPENDENCIA 1810 d.C.",
    bgType: 'campanas',
    colores: { cieloTop: 0x3a1a3a, cieloBot: 0x180518, bgElement: 0x4a2a4a, sueloTop: 0x4a304a, sueloBot: 0x2a102a, platTop: 0x6a506a, platBot: 0x4a304a },
    piedra: "záfiro",
    boss: { nombre: 'Hidra Realista', titulo: 'Hidra Domada' },
    drawEnemigo: (g, x, y) => {
      // Soldado realista de azul
      g.fillStyle(0x1133aa, 1); g.fillRect(-10, -10, 20, 25); // Uniforme
      g.fillStyle(0xffffff, 1); g.fillRect(-10, -10, 20, 5); // Cuello blanco
      g.fillStyle(0xffccaa, 1); g.fillCircle(0, -15, 8); // Cabeza
      g.fillStyle(0x111111, 1); g.fillRect(-12, -25, 24, 6); // Sombrero recto
      g.setPosition(x, y);
    },
    drawBoss: (g) => {
      // Cañón Vivo (Hidra simplificada)
      g.fillStyle(0x444444, 1); g.fillRect(20, 50, 60, 50); // Base cañón
      g.fillStyle(0x222222, 1); g.fillCircle(20, 90, 20); g.fillCircle(80, 90, 20); // Ruedas
      g.fillStyle(0x333333, 1); g.fillRect(30, 10, 40, 60); // Tubo
      g.fillStyle(0xff4400, 1); g.fillCircle(50, 10, 15); // Fuego en boca
      g.fillStyle(0xffffff, 1); g.fillCircle(40, 50, 6); g.fillCircle(60, 50, 6); // Ojos locos
    }
  },
  5: {
    nombre: "🎩 PORFIRIATO 1900 d.C.",
    bgType: 'trenes',
    colores: { cieloTop: 0x2a2a2a, cieloBot: 0x050505, bgElement: 0x444444, sueloTop: 0x5a4a3a, sueloBot: 0x3a2a1a, platTop: 0x766656, platBot: 0x5a4a3a },
    piedra: "rubí",
    boss: { nombre: 'Gral. Máquina', titulo: 'Máquina Desbielada' },
    drawEnemigo: (g, x, y) => {
      // Rurales con sombrero
      g.fillStyle(0x554433, 1); g.fillRect(-10, -5, 20, 20); // Traje
      g.fillStyle(0xffccaa, 1); g.fillCircle(0, -10, 8); // Cabeza
      g.fillStyle(0x222222, 1); g.fillEllipse(0, -18, 26, 6); g.fillCircle(0, -22, 10); // Sombrero charro
      g.setPosition(x, y);
    },
    drawBoss: (g) => {
      // Locomotora Robot
      g.fillStyle(0x222222, 1); g.fillRoundedRect(10, 20, 80, 80, 10); // Caldera
      g.fillStyle(0x444444, 1); g.fillRect(40, -10, 20, 40); // Chimenea
      g.fillStyle(0xaaaaaa, 1); g.fillCircle(20, 90, 15); g.fillCircle(50, 90, 15); g.fillCircle(80, 90, 15); // Engranes
      g.fillStyle(0xff3300, 1); g.fillRect(30, 40, 40, 20); // Horno/Ojos
    }
  },
  6: {
    nombre: "🚂 REVOLUCIÓN 1914 d.C.",
    bgType: 'desierto',
    colores: { cieloTop: 0x5a3a1a, cieloBot: 0x2a1a05, bgElement: 0x6a4a2a, sueloTop: 0x7a5a3a, sueloBot: 0x4a2a1a, platTop: 0x866646, platBot: 0x6a4a2a },
    piedra: "cuarzo",
    boss: { nombre: 'Gran Usurpador', titulo: 'Usurpador Derrocado' },
    drawEnemigo: (g, x, y) => {
      // Federal / Pelón
      g.fillStyle(0x444422, 1); g.fillRect(-10, -5, 20, 20); // Traje caqui
      g.fillStyle(0x222222, 1); g.fillRect(-10, 0, 20, 5); // Carrillera cruzada
      g.fillStyle(0xffccaa, 1); g.fillCircle(0, -12, 10); // Cabeza pelona
      g.setPosition(x, y);
    },
    drawBoss: (g) => {
      // Gran Usurpador (Hombre gordo con bigote gigante y lentes)
      g.fillStyle(0x334422, 1); g.fillEllipse(50, 60, 90, 80); // Uniforme
      g.fillStyle(0xffccaa, 1); g.fillCircle(50, 20, 30); // Cabeza gruesa
      g.fillStyle(0x111111, 1); g.fillCircle(40, 15, 6); g.fillCircle(60, 15, 6); // Lentes oscuros
      g.fillStyle(0x111111, 1); g.fillRect(20, 25, 60, 10); // Bigotazo negro
      g.fillStyle(0xffd700, 1); g.fillCircle(50, 60, 8); // Medalla de lata
    }
  }
};
