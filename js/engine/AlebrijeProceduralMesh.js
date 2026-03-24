// js/engine/AlebrijeProceduralMesh.js
// Malla 3D procedural del personaje TIJUANA — Alebrije iguana turista
// Replicando el diseño de drawTijuana() en 2D como geometría 3D completa
// Colores: Rosa #ff3fa4 | Cian #00e5ff | Naranja #f5a623 | Dorado #ffd700 | Marrón #8B6914

/**
 * buildProceduralAlebrije()
 * Retorna un THREE.Group con todas las partes del personaje ensambladas.
 * El grupo completo tiene escala de ~2 unidades de alto (coordenadas del juego).
 *
 * Expone métodos de animación en el grupo:
 *   group.updateIdle(time)   — float + respiration idle
 *   group.updateRun(speed)   — lean hacia adelante al correr
 *   group.updateJump(vy)     — squash/stretch vertical por velocidad
 */
function buildProceduralAlebrije() {
    const root = new THREE.Group();
    root.name = 'AlebrijeProceduralMesh';

    // ── Materiales ──────────────────────────────────────────────────────────────
    const mRosa     = new THREE.MeshStandardMaterial({ color: 0xff3fa4, roughness: 0.5, metalness: 0.1 });
    const mCian     = new THREE.MeshStandardMaterial({ color: 0x00e5ff, roughness: 0.4, metalness: 0.2 });
    const mNaranja  = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.6, metalness: 0.0 });
    const mNarOsc   = new THREE.MeshStandardMaterial({ color: 0xe8941a, roughness: 0.7, metalness: 0.0 });
    const mDorado   = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.5 });
    const mMarro    = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8, metalness: 0.1 });
    const mMarroCl  = new THREE.MeshStandardMaterial({ color: 0xa0781f, roughness: 0.7, metalness: 0.1 });
    const mNegro    = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.0 });
    const mGrisMed  = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.1 });
    const mLente    = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.1, metalness: 0.8, envMapIntensity: 1 });
    const mOjBco    = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0 });
    const mLengua   = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.8, metalness: 0.0 });
    const mOrangeP  = new THREE.MeshStandardMaterial({ color: 0xff8c00, roughness: 0.5, metalness: 0.0 });
    const mCianT    = new THREE.MeshStandardMaterial({ color: 0x00e5ff, roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0.75 });
    const mRosaT    = new THREE.MeshStandardMaterial({ color: 0xff3fa4, roughness: 0.5, metalness: 0.1, transparent: true, opacity: 0.9 });

    // ────────────────────────────────────────────────────────────────────────────
    // ── CUERPO (elipsoide achatado) ──────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'body';
    root.add(bodyGroup);

    const bodyGeo = new THREE.SphereGeometry(0.52, 16, 12);
    const body = new THREE.Mesh(bodyGeo, mRosa);
    body.scale.set(1.0, 1.25, 0.85);
    body.position.set(0, 0.95, 0);
    body.castShadow = true;
    bodyGroup.add(body);

    // Patrones del cuerpo — diamantes cian y naranja (como en el drawTijuana() 2D)
    const diamondGeo = new THREE.OctahedronGeometry(0.13, 0);
    const d1 = new THREE.Mesh(diamondGeo, mCian);
    d1.position.set(0, 1.25, 0.5); d1.scale.set(1, 0.7, 0.3);
    bodyGroup.add(d1);
    const d2 = new THREE.Mesh(diamondGeo, mCian);
    d2.position.set(0, 0.65, 0.5); d2.scale.set(1, 0.7, 0.3);
    bodyGroup.add(d2);
    const d3 = new THREE.Mesh(diamondGeo, mOrangeP);
    d3.position.set(0, 0.95, 0.5); d3.scale.set(0.7, 0.7, 0.3);
    bodyGroup.add(d3);
    // Línea dorsal
    const spineGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6);
    const spine = new THREE.Mesh(spineGeo, mCian);
    spine.position.set(0, 0.95, -0.4); spine.rotation.x = Math.PI * 0.15;
    bodyGroup.add(spine);

    // ────────────────────────────────────────────────────────────────────────────
    // ── CUELLO ──────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    const neckGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.22, 8);
    const neck = new THREE.Mesh(neckGeo, mNaranja);
    neck.position.set(0, 1.68, 0.05);
    bodyGroup.add(neck);

    // ────────────────────────────────────────────────────────────────────────────
    // ── CABEZA ──────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    const headGroup = new THREE.Group();
    headGroup.name = 'head';
    headGroup.position.set(0, 2.0, 0.05);
    bodyGroup.add(headGroup);

    // Cráneo externo
    const headGeo = new THREE.SphereGeometry(0.36, 16, 12);
    const head = new THREE.Mesh(headGeo, mNaranja);
    head.scale.set(1.0, 0.88, 0.9);
    headGroup.add(head);

    // Hocico/Morro (snout)
    const snoutGeo = new THREE.SphereGeometry(0.2, 12, 8);
    const snout = new THREE.Mesh(snoutGeo, mNarOsc);
    snout.scale.set(0.9, 0.7, 1.2);
    snout.position.set(0, -0.1, 0.28);
    headGroup.add(snout);

    // ── CRESTA — 5 picos (como el drawTijuana) ──
    const crestGeo = new THREE.ConeGeometry(0.06, 0.2, 5);
    for (let i = -2; i <= 2; i++) {
        const crest = new THREE.Mesh(crestGeo, mRosa);
        crest.position.set(i * 0.1, 0.38, -0.05);
        crest.rotation.z = i * 0.12;
        headGroup.add(crest);
    }

    // ── GOPRO (cámara de acción en la cresta) ──
    const goProBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.1), mGrisMed);
    goProBody.position.set(0, 0.46, 0);
    headGroup.add(goProBody);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 10), mLente);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.46, 0.07);
    headGroup.add(lens);
    const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), mNegro);
    lensRing.rotation.x = Math.PI / 2;
    lensRing.position.set(0, 0.46, 0.07);
    headGroup.add(lensRing);

    // ── LENTES OSCUROS (2 rectángulos con marco marrón) ──
    const sungGeo = new THREE.BoxGeometry(0.14, 0.07, 0.04);
    const sungL = new THREE.Mesh(sungGeo, mNegro); sungL.position.set(-0.12, 0.06, 0.33); headGroup.add(sungL);
    const sungR = new THREE.Mesh(sungGeo, mNegro); sungR.position.set( 0.12, 0.06, 0.33); headGroup.add(sungR);
    // Marcos
    const frameGeo = new THREE.BoxGeometry(0.145, 0.075, 0.01);
    const fL = new THREE.Mesh(frameGeo, mMarro); fL.position.set(-0.12, 0.06, 0.36); headGroup.add(fL);
    const fR = new THREE.Mesh(frameGeo, mMarro); fR.position.set( 0.12, 0.06, 0.36); headGroup.add(fR);
    // Puente entre lentes
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), mMarro);
    bridge.position.set(0, 0.06, 0.34);
    headGroup.add(bridge);

    // ── SONRISA ──
    const smileArc = new THREE.TorusGeometry(0.1, 0.012, 6, 14, Math.PI);
    const smile = new THREE.Mesh(smileArc, mNarOsc);
    smile.rotation.x = Math.PI / 2;
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.13, 0.38);
    headGroup.add(smile);

    // ── LENGUA ──
    const tongueGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const tongue = new THREE.Mesh(tongueGeo, mLengua);
    tongue.scale.set(0.7, 1.4, 0.7);
    tongue.position.set(0, -0.2, 0.38);
    headGroup.add(tongue);

    // ── OJOS (debajo de los lentes) ──
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 6);
    const eL = new THREE.Mesh(eyeGeo, mOjBco); eL.position.set(-0.12, 0.09, 0.35); headGroup.add(eL);
    const eR = new THREE.Mesh(eyeGeo, mOjBco); eR.position.set( 0.12, 0.09, 0.35); headGroup.add(eR);

    // ────────────────────────────────────────────────────────────────────────────
    // ── COLA (TubeGeometry curva) ────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0,    0.85, -0.4),
        new THREE.Vector3(-0.3, 0.75, -0.7),
        new THREE.Vector3(-0.55,0.65, -0.8),
        new THREE.Vector3(-0.75,0.75, -0.6),
        new THREE.Vector3(-0.85,1.0,  -0.3),
    ]);
    const tailTube = new THREE.TubeGeometry(tailCurve, 14, 0.065, 8, false);
    const tail = new THREE.Mesh(tailTube, mRosa);
    tail.castShadow = true;
    root.add(tail);

    // Raya cian sobre la cola
    const tailAccent = new THREE.TubeGeometry(tailCurve, 14, 0.025, 6, false);
    const tailA = new THREE.Mesh(tailAccent, mCian);
    root.add(tailA);

    // Punta de la cola
    const tipGeo = new THREE.ConeGeometry(0.05, 0.2, 6);
    const tip = new THREE.Mesh(tipGeo, mDorado);
    tip.position.set(-0.85, 1.0, -0.3);
    tip.rotation.z = -0.8;
    root.add(tip);

    // ────────────────────────────────────────────────────────────────────────────
    // ── ALAS ────────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    // Ala izquierda
    const wingGeoL = new THREE.ConeGeometry(0.32, 0.55, 3, 1);
    const wingL = new THREE.Mesh(wingGeoL, mRosaT);
    wingL.position.set(-0.65, 1.1, -0.1);
    wingL.rotation.set(-0.3, 0.4, -Math.PI / 2.5);
    wingL.castShadow = true;
    root.add(wingL);

    const wingInnerL = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 3, 1), mCianT);
    wingInnerL.position.set(-0.58, 1.1, -0.05);
    wingInnerL.rotation.copy(wingL.rotation);
    root.add(wingInnerL);

    // Espina del ala izquierda (pequeño círculo dorado en la punta)
    const wingTipL = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), mDorado);
    wingTipL.position.set(-0.96, 1.38, -0.15);
    root.add(wingTipL);

    // Ala derecha
    const wingGeoR = new THREE.ConeGeometry(0.32, 0.55, 3, 1);
    const wingR = new THREE.Mesh(wingGeoR, mRosaT);
    wingR.position.set(0.65, 1.1, -0.1);
    wingR.rotation.set(-0.3, -0.4, Math.PI / 2.5);
    wingR.castShadow = true;
    root.add(wingR);

    const wingInnerR = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 3, 1), mCianT);
    wingInnerR.position.set(0.58, 1.1, -0.05);
    wingInnerR.rotation.copy(wingR.rotation);
    root.add(wingInnerR);

    const wingTipR = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), mDorado);
    wingTipR.position.set(0.96, 1.38, -0.15);
    root.add(wingTipR);

    // ────────────────────────────────────────────────────────────────────────────
    // ── RIÑONERA (cinturón de turista) ──────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    const beltGeo = new THREE.BoxGeometry(0.65, 0.2, 0.4);
    const belt = new THREE.Mesh(beltGeo, mMarro);
    belt.position.set(0, 0.48, 0.18);
    bodyGroup.add(belt);
    const beltInner = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.42), mMarroCl);
    beltInner.position.set(0, 0.48, 0.2);
    bodyGroup.add(beltInner);
    // Hebilla dorada
    const buckleGeo = new THREE.SphereGeometry(0.065, 8, 6);
    const buckle = new THREE.Mesh(buckleGeo, mDorado);
    buckle.scale.set(1, 0.6, 0.4);
    buckle.position.set(0, 0.48, 0.38);
    bodyGroup.add(buckle);

    // ────────────────────────────────────────────────────────────────────────────
    // ── BRAZOS ──────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    const armGeo = typeof THREE.CapsuleGeometry !== 'undefined'
        ? new THREE.CapsuleGeometry(0.1, 0.28, 4, 8)
        : new THREE.CylinderGeometry(0.1, 0.1, 0.38, 8);

    const armL = new THREE.Mesh(armGeo, mRosa);
    armL.position.set(-0.65, 0.9, 0.0);
    armL.rotation.z = 0.4;
    armL.castShadow = true;
    root.add(armL);

    const armR = new THREE.Mesh(armGeo, mRosa);
    armR.position.set(0.65, 0.9, 0.0);
    armR.rotation.z = -0.4;
    armR.castShadow = true;
    root.add(armR);

    // Manos/garras del brazo
    const handGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const handL = new THREE.Mesh(handGeo, mNaranja);
    handL.position.set(-0.82, 0.72, 0.0);
    root.add(handL);
    const handR = new THREE.Mesh(handGeo, mNaranja);
    handR.position.set(0.82, 0.72, 0.0);
    root.add(handR);

    // ────────────────────────────────────────────────────────────────────────────
    // ── PIERNAS ─────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    const legGeo = typeof THREE.CapsuleGeometry !== 'undefined'
        ? new THREE.CapsuleGeometry(0.12, 0.25, 4, 8)
        : new THREE.CylinderGeometry(0.12, 0.1, 0.38, 8);

    const legGroup = new THREE.Group();
    legGroup.name = 'legs';
    root.add(legGroup);

    const legL = new THREE.Mesh(legGeo, mRosa);
    legL.position.set(-0.22, 0.3, 0.05);
    legL.castShadow = true;
    legGroup.add(legL);

    const legR = new THREE.Mesh(legGeo, mRosa);
    legR.position.set( 0.22, 0.3, 0.05);
    legR.castShadow = true;
    legGroup.add(legR);

    // Pies/Tobillos
    const footGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const footL = new THREE.Mesh(footGeo, mNaranja);
    footL.scale.set(1.1, 0.7, 1.3);
    footL.position.set(-0.22, 0.06, 0.08);
    legGroup.add(footL);
    const footR = new THREE.Mesh(footGeo, mNaranja);
    footR.scale.set(1.1, 0.7, 1.3);
    footR.position.set( 0.22, 0.06, 0.08);
    legGroup.add(footR);

    // ── GARRAS (3 por pie) ────────────────────────────────────────────────────
    const clawGeo = new THREE.ConeGeometry(0.03, 0.1, 4);
    const clawOffsets = [-0.05, 0, 0.05];
    clawOffsets.forEach((ox, i) => {
        const clL = new THREE.Mesh(clawGeo, mDorado);
        clL.rotation.x = -Math.PI / 2.5;
        clL.position.set(-0.22 + ox, 0.02, 0.2);
        legGroup.add(clL);
        const clR = new THREE.Mesh(clawGeo, mDorado);
        clR.rotation.x = -Math.PI / 2.5;
        clR.position.set( 0.22 + ox, 0.02, 0.2);
        legGroup.add(clR);
    });

    // ────────────────────────────────────────────────────────────────────────────
    // ── SHADOWS para toda la malla ───────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    root.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // ────────────────────────────────────────────────────────────────────────────
    // ── REFERENCIAS INTERNAS para animación ──────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    root.userData.parts = {
        bodyGroup,
        headGroup,
        legGroup,
        wingL, wingR,
        wingInnerL, wingInnerR,
        armL, armR,
        legL, legR,
        footL, footR,
    };

    // ────────────────────────────────────────────────────────────────────────────
    // ── ANIMACIONES PROCEDURALES ─────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * updateIdle(time) — Llamar cada frame con el tiempo en segundos
     * Efecto de flotación suave + respiración del cuerpo + parpadeo de alas
     */
    root.updateIdle = function(time) {
        const parts = root.userData.parts;
        // Flotación vertical del personaje completo
        root.position.y = Math.sin(time * 1.4) * 0.06;
        // Respiración: escala del cuerpo
        const breathe = 1.0 + Math.sin(time * 2.2) * 0.025;
        parts.bodyGroup.scale.set(breathe, 1.0 + Math.sin(time * 2.2) * 0.015, breathe);
        // Cabeza con micro-bob
        parts.headGroup.position.y = 2.0 + Math.sin(time * 1.8 + 0.5) * 0.04;
        // Alas batiendo suavemente
        const wingFlap = Math.sin(time * 2.5) * 0.18;
        parts.wingL.rotation.z = -Math.PI / 2.5 + wingFlap;
        parts.wingR.rotation.z =  Math.PI / 2.5 - wingFlap;
        parts.wingInnerL.rotation.z = parts.wingL.rotation.z;
        parts.wingInnerR.rotation.z = parts.wingR.rotation.z;
        // Piernas: micro swing idle
        parts.legL.rotation.x = Math.sin(time * 1.4) * 0.05;
        parts.legR.rotation.x = Math.sin(time * 1.4 + Math.PI) * 0.05;
    };

    /**
     * updateRun(speed, time) — Inclinación al correr y piernas corriendo
     * speed: valor 0–1 (normalizado al max walk speed)
     */
    root.updateRun = function(speed, time) {
        const parts = root.userData.parts;
        // Lean hacia adelante según velocidad
        parts.bodyGroup.rotation.x = speed * 0.3;
        parts.headGroup.rotation.x = speed * -0.1; // compensa cabeza hacia arriba
        // Alas más recogidas al correr
        const wingAngle = Math.PI / 2.5 + speed * 0.4;
        parts.wingL.rotation.z = -wingAngle;
        parts.wingR.rotation.z =  wingAngle;
        // Piernas alternando (paso corriendo)
        const stride = speed * 0.5;
        parts.legL.rotation.x = Math.sin(time * 10) * stride;
        parts.legR.rotation.x = Math.sin(time * 10 + Math.PI) * stride;
        // Brazos alternando
        parts.armL.rotation.x = Math.sin(time * 10 + Math.PI) * stride * 0.6;
        parts.armR.rotation.x = Math.sin(time * 10) * stride * 0.6;
    };

    /**
     * resetAnimations() — Volver a pose base (para transición desde run a idle)
     */
    root.resetAnimations = function() {
        const parts = root.userData.parts;
        parts.bodyGroup.rotation.x = 0;
        parts.headGroup.rotation.x = 0;
        parts.armL.rotation.x = 0;
        parts.armR.rotation.x = 0;
        parts.legL.rotation.x = 0;
        parts.legR.rotation.x = 0;
    };

    return root;
}
