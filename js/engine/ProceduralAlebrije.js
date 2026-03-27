// js/engine/ProceduralAlebrije.js — Tijuana 3D Procedural (Three.js)
// Construye un Alebrije Iguana low-poly colorido con animación idle

/**
 * Construye la malla 3D procedural de Tijuana Alebrije.
 * Retorna un THREE.Group con:
 *   - Geometrías low-poly tipo PS2/Wind Waker
 *   - Colores neón: rosa (#ff3fa4), cyan (#00e5ff), dorado (#ffd700), naranja (#ff8c00)
 *   - Método .updateIdle(t) para animar cabeza y cola
 *
 * @returns {THREE.Group}
 */
function buildProceduralAlebrije() {
  const root = new THREE.Group();

  // ── PALETA ───────────────────────────────────────────────────────────
  const C = {
    pink:    new THREE.MeshStandardMaterial({ color: 0xff3fa4, roughness: 0.6, flatShading: true }),
    cyan:    new THREE.MeshStandardMaterial({ color: 0x00e5ff, roughness: 0.5, flatShading: true }),
    gold:    new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.4, flatShading: true }),
    orange:  new THREE.MeshStandardMaterial({ color: 0xff8c00, roughness: 0.6, flatShading: true }),
    dark:    new THREE.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.9, flatShading: true }),
    skin:    new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.7, flatShading: true }),
    glass:   new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.8 }),
    white:   new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, flatShading: true }),
    emit_pink: new THREE.MeshStandardMaterial({ color: 0xff3fa4, emissive: 0xff3fa4, emissiveIntensity: 0.3, roughness: 0.5, flatShading: true }),
    emit_cyan: new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.3, roughness: 0.4, flatShading: true }),
  };

  function mesh(geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // ── CUERPO PRINCIPAL (Torso de Iguana Low-Poly) ──────────────────────
  const body = new THREE.Group();
  root.add(body);

  // Torso — cápsula hexagonal aplastada
  const torsoGeo = new THREE.CylinderGeometry(0.55, 0.38, 1.2, 6);
  const torso = mesh(torsoGeo, C.pink);
  torso.rotation.z = Math.PI * 0.05;
  body.add(torso);

  // Panza — franja cuadrilátera ciánica
  const bellyGeo = new THREE.BoxGeometry(0.7, 0.5, 0.4);
  const belly = mesh(bellyGeo, C.cyan);
  belly.position.set(0, -0.05, 0.25);
  body.add(belly);

  // Rombos dorados decorativos (patrón Alebrije)
  const diamondGeo = new THREE.OctahedronGeometry(0.09, 0);
  [-0.28, 0, 0.28].forEach((x, i) => {
    const d = mesh(diamondGeo, i === 1 ? C.gold : C.orange);
    d.position.set(x, 0.1, 0.5);
    d.scale.set(1, 0.5, 0.5);
    body.add(d);
  });

  // ── CABEZA ───────────────────────────────────────────────────────────
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.92, 0);
  body.add(headGroup);
  root.userData.headGroup = headGroup; // Referencia para animación

  // Base de la cabeza — caja ligeramente romboidal
  const headGeo = new THREE.BoxGeometry(0.72, 0.52, 0.8);
  const head = mesh(headGeo, C.skin);
  headGroup.add(head);

  // Hocico
  const snoutGeo = new THREE.BoxGeometry(0.44, 0.3, 0.38);
  const snout = mesh(snoutGeo, C.skin);
  snout.position.set(0, -0.08, 0.48);
  headGroup.add(snout);

  // Lengua bifurcada (dos conos naranjas)
  [-0.06, 0.06].forEach(x => {
    const tongGeo = new THREE.ConeGeometry(0.028, 0.2, 4);
    const tong = mesh(tongGeo, C.orange);
    tong.position.set(x, -0.18, 0.72);
    tong.rotation.x = 0.4;
    headGroup.add(tong);
  });

  // Ojos — esferas con pupilas
  [-0.25, 0.25].forEach(x => {
    const eyeGeo = new THREE.SphereGeometry(0.11, 8, 6);
    const eye = mesh(eyeGeo, C.gold);
    eye.position.set(x, 0.1, 0.35);
    headGroup.add(eye);

    const pupilGeo = new THREE.SphereGeometry(0.055, 6, 4);
    const pupil = mesh(pupilGeo, C.dark);
    pupil.position.set(x * 1.01, 0.1, 0.44);
    headGroup.add(pupil);
  });

  // GoPro camera (icono de Tijuana)
  const camGeo = new THREE.BoxGeometry(0.28, 0.2, 0.14);
  const cam = mesh(camGeo, C.dark);
  cam.position.set(0, 0.3, 0.02);
  headGroup.add(cam);
  const lensGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8);
  const lens = mesh(lensGeo, C.glass);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.3, 0.1);
  headGroup.add(lens);

  // Cresta — triángulos rosa/cyan alternados
  for (let i = -1; i <= 1; i++) {
    const crestGeo = new THREE.ConeGeometry(0.055, 0.28, 3);
    const crest = mesh(crestGeo, i === 0 ? C.emit_cyan : C.emit_pink);
    crest.position.set(i * 0.18, 0.42, 0);
    headGroup.add(crest);
  }

  // ── ALAS DE MURCIÉLAGO (Traseras — membrana + costillas) ────────────
  const batWingMat = new THREE.MeshStandardMaterial({
    color: 0x3a0066, emissive: 0xff3fa4, emissiveIntensity: 0.35,
    roughness: 0.6, transparent: true, opacity: 0.88, side: THREE.DoubleSide,
  });

  const batWingGroup = new THREE.Group();
  batWingGroup.position.set(0, 0.1, -0.3);
  body.add(batWingGroup);
  root.userData.wingGroup = batWingGroup;

  function buildBatWing(side) {
    const wg = new THREE.Group();

    // Membrana (Shape)
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(side * 0.8, 0.55,  side * 1.45,  0.35);
    s.lineTo(side * 1.25, -0.45);
    s.quadraticCurveTo(side * 0.55, -0.6, 0, -0.12);
    s.closePath();
    const wingMesh = new THREE.Mesh(new THREE.ShapeGeometry(s), batWingMat);
    wg.add(wingMesh);

    // 3 costillas fluoescentes
    [[0.55, 0.2], [0.85, -0.05], [1.1, -0.35]].forEach(([wx, wy]) => {
      const bc = new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * wx, wy, 0)
      );
      wg.add(new THREE.Mesh(
        new THREE.TubeGeometry(bc, 6, 0.025, 4, false),
        C.emit_pink
      ));
    });

    wg.rotation.z = side * -0.15;
    wg.position.set(side * 0.5, 0, 0);
    return wg;
  }

  batWingGroup.add(buildBatWing(-1));
  batWingGroup.add(buildBatWing(1));

  // ── PLUMAS DECORATIVAS (Alas laterales pequeñas, estilo Alebrije) ────
  const featherGroup = new THREE.Group();
  body.add(featherGroup);
  [[C.emit_pink, 0.55, 0.18], [C.cyan, 0.42, 0.12], [C.gold, 0.3, 0.08]].forEach(([mat, len, width], i) => {
    [-1, 1].forEach(side => {
      const pGeo = new THREE.ConeGeometry(width, len, 3);
      const p = mesh(pGeo, mat);
      p.rotation.z = side * (Math.PI / 2 + i * 0.22);
      p.position.set(side * (0.62 + i * 0.06), 0.28 - i * 0.04, 0.1);
      featherGroup.add(p);
    });
  });

  // ── COLA ──────────────────────────────────────────────────────────────
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, -0.35, -0.55);
  body.add(tailGroup);
  root.userData.tailGroup = tailGroup;

  // Segmentos de cola en degradé de tamaño
  const tailSegs = [
    [0.22, 0, C.pink],   [0.17, -0.28, C.orange],
    [0.13, -0.52, C.cyan], [0.08, -0.68, C.gold],
  ];
  tailSegs.forEach(([r, z, mat]) => {
    const tGeo = new THREE.SphereGeometry(r, 5, 4);
    const t = mesh(tGeo, mat);
    t.position.set(0, 0, z);
    t.scale.set(1, 0.65, 1);
    tailGroup.add(t);
  });

  // ── PATAS ─────────────────────────────────────────────────────────────
  root.legs = [];
  function buildLeg(x, z, short) {
    const lg = new THREE.Group();
    const thighGeo = new THREE.CapsuleGeometry(0.1, short ? 0.22 : 0.32, 3, 5);
    const thigh = mesh(thighGeo, C.pink);
    thigh.position.set(0, -0.18, 0);
    lg.add(thigh);
    const footGeo = new THREE.BoxGeometry(0.22, 0.08, 0.28);
    const foot = mesh(footGeo, C.orange);
    foot.position.set(0, short ? -0.36 : -0.46, 0.06);
    lg.add(foot);
    [-0.06, 0, 0.06].forEach(gx => {
      const clawGeo = new THREE.ConeGeometry(0.025, 0.1, 3);
      const claw = mesh(clawGeo, C.gold);
      claw.rotation.x = 0.5;
      claw.position.set(gx, foot.position.y - 0.07, 0.16);
      lg.add(claw);
    });
    lg.position.set(x, -0.45, z);
    return lg;
  }
  const legFL = buildLeg(-0.45, 0.3, false); body.add(legFL); root.legs.push(legFL);
  const legFR = buildLeg( 0.45, 0.3, false); body.add(legFR); root.legs.push(legFR);
  const legBL = buildLeg(-0.38, -0.3, true); body.add(legBL); root.legs.push(legBL);
  const legBR = buildLeg( 0.38, -0.3, true); body.add(legBR); root.legs.push(legBR);

  // ── RIÑONERA (Fanny Pack turista) ─────────────────────────────────────
  const packGeo = new THREE.BoxGeometry(0.55, 0.32, 0.2);
  const pack = mesh(packGeo, C.gold);
  pack.position.set(0, -0.22, 0.48);
  body.add(pack);
  const bucGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 6);
  const buc = mesh(bucGeo, C.orange);
  buc.rotation.x = Math.PI / 2;
  buc.position.set(0, -0.22, 0.59);
  body.add(buc);

  // ── ANIMACIONES ───────────────────────────────────────────────────────
  root.updateIdle = function(t) {
    root.position.y = Math.sin(t * 1.5) * 0.06;
    if (root.userData.headGroup) {
      root.userData.headGroup.rotation.y = Math.sin(t * 0.7) * 0.18;
      root.userData.headGroup.rotation.x = Math.sin(t * 1.1 + 0.5) * 0.06;
    }
    // Alas de murciélago batiendo suavemente
    if (root.userData.wingGroup) {
      const flap = Math.sin(t * 2.8) * 0.18;
      root.userData.wingGroup.children[0].rotation.z = -flap - 0.15;
      root.userData.wingGroup.children[1].rotation.z =  flap + 0.15;
    }
    if (root.userData.tailGroup) {
      root.userData.tailGroup.rotation.x = Math.sin(t * 1.8 + 1.0) * 0.15;
      root.userData.tailGroup.rotation.z = Math.cos(t * 1.4) * 0.1;
    }
    // Patas quietas
    if (root.legs) root.legs.forEach((lg, i) => { lg.rotation.x = Math.sin(t * 1.6 + i * 0.5) * 0.05; });
  };

  root.updateRun = function(speed, t) {
    const freq = 7 + speed * 5;
    const amp  = 0.5 * Math.min(speed, 1.0);
    // Trot alterno: FL+BR en fase / FR+BL desfasados π
    if (root.legs) {
      const phases = [0, Math.PI, Math.PI, 0];
      root.legs.forEach((lg, i) => { lg.rotation.x = Math.sin(t * freq + phases[i]) * amp; });
    }
    // Alas extendidas hacia atrás al correr
    if (root.userData.wingGroup) {
      root.userData.wingGroup.children[0].rotation.z = -(0.4 + speed * 0.25);
      root.userData.wingGroup.children[1].rotation.z =  (0.4 + speed * 0.25);
    }
    // Squash horizontal
    body.scale.set(1.0 + speed * 0.1, 1.0 - speed * 0.05, 1.0 + speed * 0.1);
    // Cabeza inclinada hacia adelante
    if (root.userData.headGroup) root.userData.headGroup.rotation.x = -speed * 0.15;
  };

  root.resetAnimations = function() {
    body.scale.set(1, 1, 1);
    root.position.y = 0;
    if (root.userData.headGroup) { root.userData.headGroup.rotation.x = 0; root.userData.headGroup.rotation.y = 0; }
    if (root.userData.wingGroup) { root.userData.wingGroup.children[0].rotation.z = 0; root.userData.wingGroup.children[1].rotation.z = 0; }
    if (root.legs) root.legs.forEach(lg => { lg.rotation.x = 0; });
  };

  return root;
}

// Exponer globalmente para TitleScene y cualquier escena que lo necesite
window.buildProceduralAlebrije = buildProceduralAlebrije;
