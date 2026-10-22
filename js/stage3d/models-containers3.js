/* AETHERVAULT — 3D containers (Phase Four): Relic Chest and Starlit Egg. Ritual API (same as the others): setProgress(p) · pulse() · open() · opened.
 *   Relic Chest — a ceremonial reliquary: stone footing, dark wood body bound in bronze, a bone-white carved front with a small lantern window,
 *                 an arched lid with bronze ribs and a star crest, three wax seals and a turning lock. Progress breaks the seals one by one
 *                 (wax halves fall and stay on the footing, dust puffs and settles); open() turns the lock, drops the hasp, lifts the heavy lid
 *                 and raises a velvet cradle on a bronze riser. Rarity shows only as the colour of the light inside (window, gaps, cradle).
 *   Starlit Egg — a night-blue egg made of six shell gores, engraved with a five-star constellation. Progress lights the stars and the lines
 *                 between them; open() blooms the gores outward like petals around a core of turning starlight. Not a recoloured Hatchling egg:
 *                 different silhouette, interaction (tracing stars, not tapping cracks) and opening (bloom, not a popped cap). */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, clamp = U.clamp;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** Dark ceremonial wood: low-contrast grain on a canvas (shared per build; tiny). */
  function woodTex(ctx) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d'), r = U.mulberry32(41);
    x.fillStyle = '#3d2416'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { const y = r() * 256, a = .05 + r() * .12; x.strokeStyle = r() < .5 ? `rgba(20,10,5,${a})` : `rgba(120,70,40,${a * .7})`; x.lineWidth = 1 + r() * 3; x.beginPath(); x.moveTo(0, y); for (let k = 1; k <= 8; k++) x.lineTo(k * 32, y + Math.sin(k * .9 + i) * (2 + r() * 4)); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; ctx.tex.push(t); return t;
  }
  /** Eight-point archive star outline. */
  const starPts = (R, r) => { const p = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + Math.PI / 2, rr = i % 2 ? r : R; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return p; };

  // =================================================================== RELIC CHEST
  S.registerModel('container:chest', {
    rest: { yaw: -.42, pitch: 0 },
    build(ctx) {
      const th = ctx.theme && ctx.theme.length ? ctx.theme : ['#ffc247', '#2fd6b4'], F = ctx.F, root = new THREE.Group(); F.crackColor = th[1];
      const glowCol = ctx.spec.color || th[1], low = !ctx.q.physical;
      const W = 1.5, H = .72, D = .96, y0 = .16, FEET = .07, yb = y0 + FEET, yt = yb + H;
      // materials
      const stone = F.body('#3a3732', { rough: .86, metal: 0, clearcoat: 0, forceWear: true }), bronze = F.trim('#9a7440', { rough: .38, plain: true }), bronzeDk = F.trim('#5a4022', { rough: .5, plain: true });
      const wt = woodTex(ctx); wt.repeat.set(2, 1);
      const wood = new THREE.MeshStandardMaterial({ map: wt, color: 0xb08a72, roughness: .72, metalness: .02, envMapIntensity: .6 }); ctx.disposables.push(wood);
      const bone = F.body('#d9ccb0', { rough: .58, clearcoat: .1 }), wax = F.body('#7d1b22', { rough: .42, clearcoat: .35, ccRough: .4 }), cloth = F.body('#4a1418', { rough: .9, clearcoat: 0 });
      const inner = K.basic(ctx, glowCol, 0, true, { side: THREE.DoubleSide, depthWrite: false });
      // footing + claw feet
      K.mesh(ctx.geo('ch-foot', () => L.chamferBox(1.82, .16, 1.26, .035)), stone, root, [0, y0 - .08, 0]);
      K.mesh(ctx.geo('ch-foot2', () => L.chamferBox(1.66, .03, 1.1, .01)), bronzeDk, root, [0, y0 + .005, 0]);
      const clawG = ctx.geo('ch-claw', () => L.lathe([[0, 0], [.07, 0], [.085, .025], [.06, .05], [.075, .075], [.05, .09], [0, .09]], 14));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => K.mesh(clawG, bronze, root, [sx * (W / 2 - .06), y0, sz * (D / 2 - .06)]));
      // body: wood box, bronze rails, corner straps, studs
      K.mesh(ctx.geo('ch-body', () => L.chamferBox(W, H, D, .03)), wood, root, [0, yb + H / 2, 0]);
      const rail = ctx.geo('ch-rail', () => L.chamferBox(W + .04, .055, D + .04, .012));
      [yb + .03, yt - .03].forEach(y => K.mesh(rail, bronze, root, [0, y, 0]));
      const strap = ctx.geo('ch-strap', () => L.chamferBox(.09, H - .02, .09, .012));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => K.mesh(strap, bronzeDk, root, [sx * (W / 2 - .02), yb + H / 2, sz * (D / 2 - .02)]));
      [yb + .1, yt - .1].forEach(y => { root.add(K.rivets(ctx, bronze, [-W / 2 + .16, y, D / 2 + .012], [W / 2 - .16, y, D / 2 + .012], 9, .016)); });
      // carved bone front panel with engraved runes and a lantern window (the rarity light shows through it)
      const panelY = yb + H * .5;
      K.mesh(ctx.geo('ch-panel', () => L.chamferBox(.98, .4, .03, .012)), bone, root, [0, panelY, D / 2 + .01]);
      const rt = K.runeTex(ctx, 913, 9, 2, 512, '#3a2a18', { h: 192, line: 6 }); const runeM = new THREE.MeshStandardMaterial({ map: rt, transparent: true, roughness: .7, metalness: .1 }); ctx.disposables.push(runeM);
      [-1, 1].forEach(sd => { const m = K.mesh(new THREE.PlaneGeometry(.3, .32), runeM, root, [sd * .3, panelY, D / 2 + .028]); m.userData.noSil = false; });
      const win = K.mesh(new THREE.CircleGeometry(.1, 28), inner, root, [0, panelY, D / 2 + .027]); win.userData.noSil = true; win.material = K.basic(ctx, glowCol, .35, true);
      const winRim = K.mesh(new THREE.TorusGeometry(.105, .016, 8, 32), bronze, root, [0, panelY, D / 2 + .03]);
      const glassM = F.glass('#d8f0ea', { opacity: .18 }); K.mesh(new THREE.CircleGeometry(.1, 28), glassM, root, [0, panelY, D / 2 + .034]);
      // lock plate on the seam, turning ring with a keyhole, hasp hanging from the lid
      const lockG = new THREE.Group(); lockG.position.set(0, yt - .1, D / 2 + .035); root.add(lockG);
      K.mesh(ctx.geo('ch-lockplate', () => L.extrude([[-.13, .1], [.13, .1], [.13, -.06], [0, -.16], [-.13, -.06]], .03, .008, { bevelSeg: 1 })), bronze, lockG);
      const ring = K.mesh(new THREE.TorusGeometry(.065, .018, 8, 28), bronzeDk, lockG, [0, -.01, .025]);
      const key = new THREE.Group(); key.position.set(0, -.01, .03); lockG.add(key);
      K.mesh(new THREE.BoxGeometry(.018, .06, .012), K.basic(ctx, '#140c06'), key, [0, -.008, 0]); K.mesh(new THREE.CircleGeometry(.018, 12), K.basic(ctx, '#140c06'), key, [0, .02, .007]);
      // lid: arched barrel vault on a back hinge, bronze ribs, star crest with a small gem in the rarity colour
      const pivot = new THREE.Group(); pivot.position.set(0, yt, -D / 2); root.add(pivot);
      const lid = new THREE.Group(); lid.position.set(0, 0, D / 2); pivot.add(lid);
      const arch = (w, hgt, n = 22) => { const p = []; for (let i = 0; i <= n; i++) { const a = Math.PI - i / n * Math.PI; p.push([Math.cos(a) * w / 2, Math.pow(Math.sin(a), .8) * hgt]); } return p; };
      const LW = W + .05, LH = .34;
      const lidG = ctx.geo('ch-lid', () => L.extrude(arch(LW, LH), D + .05, .02, { bevelSeg: 1 }));
      K.mesh(lidG, wood, lid);
      const ribG = ctx.geo('ch-rib', () => { const o = arch(LW + .05, LH + .03, 24), h = arch(LW - .02, LH - .02, 24).reverse(); return L.extrude(o.concat(h), .05, .008, { bevelSeg: 1 }); });
      [-D / 2 + .05, 0, D / 2 - .05].forEach(z => K.mesh(ribG, bronze, lid, [0, 0, z]));
      const crest = K.mesh(ctx.geo('ch-crest', () => L.extrude(starPts(.14, .055), .04, .01, { bevelSeg: 1 })), bronze, lid, [0, LH + .06, .0]);
      const gemM = F.make('glow', { color: glowCol, glow: .3 }); const gem = K.mesh(new THREE.OctahedronGeometry(.04, 0), gemM, lid, [0, LH + .06, .03]); ctx.disposables.push(gem.geometry);
      const hasp = new THREE.Group(); hasp.position.set(0, -.005, D / 2 + .035); lid.add(hasp);
      K.mesh(ctx.geo('ch-hasp', () => L.extrude([[-.045, 0], [.045, 0], [.045, -.1], [0, -.13], [-.045, -.1]], .025, .006, { bevelSeg: 1 })), bronzeDk, hasp);
      // three wax seals on ribbons: left/right front, and one over the crown of the lid
      const sealDisc = ctx.geo('ch-seal', () => { const g = new THREE.CylinderGeometry(.075, .08, .028, 22); g.rotateX(Math.PI / 2); return g; });
      const halfG = [0, 1].map(k => ctx.geo('ch-sealhalf' + k, () => { const g = new THREE.CylinderGeometry(.075, .08, .028, 12, 1, false, k * Math.PI, Math.PI); g.rotateX(Math.PI / 2); return g; }));
      const stampG = ctx.geo('ch-stamp', () => L.extrude(starPts(.04, .016), .008, .002, { bevelSeg: 1 }));
      const seals = [[-.52, yt - .02, D / 2 + .045, 0], [.52, yt - .02, D / 2 + .045, 0], [0, yt + LH + .005, .1, -Math.PI / 2 + .2]].map(([x, y, z, tilt], i) => {
        const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.x = tilt; root.add(g);
        const rib = K.mesh(new THREE.PlaneGeometry(.07, .26), cloth, g, [0, 0, -.004]); rib.material.side = THREE.DoubleSide;
        const disc = K.mesh(sealDisc, wax, g, [0, 0, .01]); const st = K.mesh(stampG, wax, disc, [0, 0, .016]); st.userData.noCast = true;
        const halves = halfG.map(hg => { const m = new THREE.Mesh(hg, wax); m.visible = false; m.userData.noShadow = true; root.add(m); return { m, v: new THREE.Vector3(), w: new THREE.Vector3(), live: false }; });
        return { g, rib, disc, halves, broken: false, t: 0, i };
      });
      // dust (shared pool), cradle on a riser, inner light
      const dustN = low ? 10 : 22, dust = []; for (let i = 0; i < dustN; i++) { const s = L.sprite('#d9c9a6', .07 + (i % 3) * .03, 0); s.userData.noSil = true; root.add(s); dust.push({ s, v: new THREE.Vector3(), life: 0, max: 1 }); }
      const puff = (x, y, z, n, up) => { let k = 0; for (const d of dust) { if (d.life > 0) continue; d.s.position.set(x + (Math.random() - .5) * .1, y, z + (Math.random() - .5) * .06); d.v.set((Math.random() - .5) * .5, (up || .2) + Math.random() * .3, (Math.random() - .5) * .3); d.max = d.life = .9 + Math.random() * .9; if (++k >= n) break; } };
      const footY = y0 + .02, settle = []; // wax halves come to rest on the footing; the dust imprint fades (see update)
      const imprintM = K.basic(ctx, '#2a1a10', 0, false, { map: L.shadowTex(), depthWrite: false });
      const riser = new THREE.Group(); riser.position.y = yt - .34; root.add(riser);
      K.mesh(ctx.geo('ch-riser', () => L.lathe([[0, 0], [.09, 0], [.06, .05], [.05, .22], [.12, .26], [.12, .29], [0, .29]], 20)), bronze, riser);
      const cushion = K.mesh(ctx.geo('ch-cush', () => L.roundedBox(.42, .08, .3, .035, 3)), F.body('#3a1030', { rough: .95, clearcoat: 0 }), riser, [0, .33, 0]);
      riser.visible = false;
      const innerPlane = K.mesh(new THREE.PlaneGeometry(W - .1, D - .1), inner, root, [0, yt - .01, 0]); innerPlane.rotation.x = -Math.PI / 2; innerPlane.userData.noSil = true;
      const beam = K.mesh(new THREE.PlaneGeometry(1.2, 2.8), K.basic(ctx, glowCol, 0, true, { map: L.shaftTex(), side: THREE.DoubleSide }), root, [0, yt + 1.35, 0]); beam.userData.noSil = true;
      const light = new THREE.PointLight(new THREE.Color(glowCol), 0, 4, 1.6); light.position.set(0, yt + .25, .2); root.add(light);
      const winLight = L.sprite(glowCol, .34, .1); winLight.position.set(0, panelY, D / 2 + .06); root.add(winLight);

      const inst = { root, frame: { r: 1.05, h: 1.72 }, float: 0, prog: 0, opened: false, openT: 0, kick: 0, broken: 0, imprint: [] };
      function breakSeal(sl) {
        if (sl.broken) return; sl.broken = true; sl.t = 0; sl.g.updateMatrixWorld(true);
        const wp = new THREE.Vector3(); sl.disc.getWorldPosition(wp); root.worldToLocal(wp);
        sl.disc.visible = false;
        sl.halves.forEach((h, k) => { h.live = true; h.m.visible = true; h.m.position.copy(wp); h.m.rotation.copy(sl.g.rotation); h.v.set((k ? 1 : -1) * (.3 + Math.random() * .3), .5 + Math.random() * .4, .12 + Math.random() * .15); h.w.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3); });
        puff(wp.x, wp.y, wp.z + .05, low ? 3 : 6, .35);
        // a faint imprint where the wax lands (creative detail: the seal leaves a mark on the footing that fades)
        const im = new THREE.Mesh(new THREE.PlaneGeometry(.34, .2), imprintM.clone()); ctx.disposables.push(im.material, im.geometry); im.rotation.x = -Math.PI / 2; im.position.set(clamp(wp.x, -.8, .8), footY + .002, D / 2 + .1); im.userData.noSil = true; im.userData.age = 0; root.add(im); inst.imprint.push(im);
      }
      inst.setProgress = p => { inst.prog = p; const want = Math.min(3, Math.floor(p * 3 + .001)); while (inst.broken < want) breakSeal(seals[inst.broken++]); };
      inst.pulse = () => { inst.kick = 1; };
      inst.open = () => { if (inst.opened) return; inst.setProgress(1); inst.opened = true; inst.openT = 0; riser.visible = true; };
      inst.update = (dt, t) => {
        const p = inst.prog, calm = ctx.reduced; inst.kick = Math.max(0, inst.kick - dt * 3.5);
        const beat = .5 + .5 * Math.sin(t * (1.6 + p * 3));
        root.position.x = calm ? 0 : Math.sin(t * 48) * inst.kick * .006;
        winLight.material.opacity = (.06 + p * .18 + beat * .04) * (inst.opened ? Math.max(.2, 1 - inst.openT) : 1);
        win.material.opacity = .12 + p * .22 + beat * .05; gemM.emissiveIntensity = .2 + p * 1.8 + beat * .3 * p;
        light.intensity = p * 3 + (inst.opened ? smooth(.4, 1.6, inst.openT) * 18 : 0);
        seals.forEach(sl => { if (sl.broken) { sl.t += dt; sl.rib.scale.y = Math.max(.001, 1 - sl.t * 2.5); sl.rib.position.y = -sl.t * .1; if (sl.t > .4) sl.rib.visible = false; } else if (!calm) sl.g.rotation.z = Math.sin(t * 3 + sl.i) * .02 * p; });
        seals.forEach(sl => sl.halves.forEach(h => { if (!h.live) return; h.v.y -= 5.5 * dt; h.m.position.addScaledVector(h.v, dt); h.m.rotation.x += h.w.x * dt; h.m.rotation.y += h.w.y * dt; h.m.rotation.z += h.w.z * dt;
          if (h.m.position.y <= footY + .015) { h.m.position.y = footY + .015; h.m.position.z = Math.min(h.m.position.z, .6); h.m.position.x = clamp(h.m.position.x, -.86, .86); h.m.rotation.set(Math.PI / 2, 0, h.m.rotation.z); h.live = false; puff(h.m.position.x, footY + .03, h.m.position.z, low ? 1 : 3, .12); } }));
        inst.imprint.forEach(im => { im.userData.age += dt; im.material.opacity = Math.min(.55, im.userData.age * 2) * (1 - smooth(3.5, 6, im.userData.age)); });
        dust.forEach(d => { if (d.life <= 0) { d.s.material.opacity = 0; return; } d.life -= dt; d.v.y -= .4 * dt; d.v.multiplyScalar(1 - dt * 1.5); d.s.position.addScaledVector(d.v, dt); d.s.material.opacity = Math.min(1, d.life / d.max * 2) * .55; });
        if (inst.opened) {
          const o = (inst.openT += dt);
          ring.rotation.z = -smooth(0, .35, o) * Math.PI / 2; key.rotation.z = ring.rotation.z; hasp.rotation.x = smooth(.25, .5, o) * .5;
          const k = ease(clamp((o - .35) / 1.5, 0, 1)); pivot.rotation.x = -k * 1.95 + (calm ? 0 : Math.sin(o * 10) * .015 * Math.exp(-Math.max(0, o - 1.85) * 4) * (o > 1.85 ? 1 : 0));
          if (o > .5 && o - dt <= .5) for (let i = 0; i < 4; i++) puff((Math.random() - .5) * W, yt + .05, D / 2, low ? 2 : 4, .05); // dust sliding off the lid edge
          riser.position.y = yt - .34 + ease(clamp((o - 1.0) / 1.2, 0, 1)) * .5;
          inner.opacity = smooth(.4, 1.2, o) * .75; beam.material.opacity = smooth(.9, 1.8, o) * (.5 + Math.sin(t * 2.2) * .08);
        }
      };
      inst.react = k => { if (k === 'click') inst.pulse(); };
      return inst;
    },
  });

  // =================================================================== STARLIT EGG
  S.registerModel('container:starlit', {
    rest: { yaw: -.3, pitch: 0 },
    build(ctx) {
      const th = ctx.theme && ctx.theme.length ? ctx.theme : ['#6cf2ff', '#b862ff'], F = ctx.F, root = new THREE.Group();
      const glowCol = ctx.spec.color || th[0];
      const A = .52, B = .76, EY = B + .24, N = 6;
      const rad = phi => A * Math.sin(phi) * (1 + .12 * Math.cos(phi)), yy = phi => EY - B * Math.cos(phi);
      // night-blue shell with a painted star field; constellation lines engraved in pale gold
      const sky = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'), r = U.mulberry32(7); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#1b1f52'); g.addColorStop(1, '#0b0c26'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 260; i++) { const a = r(); x.fillStyle = `rgba(${200 + r() * 55},${210 + r() * 45},255,${.25 + a * .7})`; const s = a > .96 ? 3.4 : a > .8 ? 2.2 : 1.3; x.fillRect(r() * 512, r() * 256, s, s); }
        x.globalAlpha = .18; for (let i = 0; i < 3; i++) { const gg = x.createRadialGradient(r() * 512, r() * 256, 0, r() * 512, r() * 256, 90); gg.addColorStop(0, '#8a6bff'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(0, 0, 512, 256); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; ctx.tex.push(t); return t; })();
      const shellM = ctx.q.physical ? new THREE.MeshPhysicalMaterial({ map: sky, roughness: .32, metalness: .15, clearcoat: .8, clearcoatRoughness: .15, envMapIntensity: 1.1, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ map: sky, roughness: .35, metalness: .15, side: THREE.DoubleSide });
      ctx.disposables.push(shellM);
      const innerM = new THREE.MeshStandardMaterial({ color: 0x1a1640, emissive: new THREE.Color(glowCol), emissiveIntensity: .25, roughness: .8, side: THREE.BackSide }); ctx.disposables.push(innerM);
      const gold = F.trim('#d8c27a', { rough: .3, plain: true });
      const PHI_H = .55; // gores hinge near the bottom
      const gores = []; const eggG = new THREE.Group(); root.add(eggG);
      for (let k = 0; k < N; k++) {
        const a0 = k / N, a1 = (k + 1) / N, mid = (k + .5) / N * TAU;
        const surf = (scale, phi0) => L.paramSurface(12, 26, (u, v, p) => { const a = (a0 + (a1 - a0) * u) * TAU, phi = phi0 + (Math.PI - phi0) * (1 - v), r = rad(phi) * scale; p.set(Math.cos(a) * r, EY + (yy(phi) - EY) * scale, Math.sin(a) * r); }, false);
        const hx = Math.cos(mid) * rad(PHI_H), hz = Math.sin(mid) * rad(PHI_H), hy = yy(PHI_H);
        const piv = new THREE.Group(); piv.position.set(hx, hy, hz); eggG.add(piv);
        const g = new THREE.Group(); g.position.set(-hx, -hy, -hz); piv.add(g);
        g.add(new THREE.Mesh(surf(1, PHI_H), shellM), new THREE.Mesh(surf(.95, PHI_H), innerM));
        gores.push({ piv, axis: new THREE.Vector3(Math.sin(mid), 0, -Math.cos(mid)), mid });
      }
      const cupProf = []; for (let i = 0; i <= 10; i++) { const phi = PHI_H * i / 10; cupProf.push([rad(phi) * 1.002, yy(phi)]); }
      K.mesh(L.lathe(cupProf, 48), shellM, eggG);
      // the five stars (front hemisphere) and the constellation lines between them
      const starAt = (u, phi) => { const a = u * TAU, r = rad(phi) + .008; return new THREE.Vector3(Math.cos(a) * r, yy(phi), Math.sin(a) * r); };
      const pts = [[.19, 1.0], [.23, 1.42], [.27, 1.86], [.3, 2.25], [.36, 1.6]].map(([u, phi]) => starAt(u, phi));
      const starM = pts.map(() => F.make('glow', { color: glowCol, glow: .15 })), starG = new THREE.OctahedronGeometry(.032, 0); ctx.disposables.push(starG);
      const stars = pts.map((p, i) => { const m = K.mesh(starG, starM[i], eggG, [p.x, p.y, p.z]); m.scale.set(1, 1.6, 1); return m; });
      const lineM = [0, 1, 2, 3].map(() => K.basic(ctx, glowCol, .12, true));
      const order = [[0, 1], [1, 2], [2, 3], [1, 4]];
      const lines = order.map(([a, b], i) => { const p0 = pts[a], p1 = pts[b], m0 = p0.clone().lerp(p1, .5).multiplyScalar(1.03); m0.y = (p0.y + p1.y) / 2; return K.mesh(L.tube([[p0.x, p0.y, p0.z], [m0.x, m0.y, m0.z], [p1.x, p1.y, p1.z]], .006, 12, 4), lineM[i], eggG); });
      const engr = order.map(([a, b]) => { const p0 = pts[a], p1 = pts[b], m0 = p0.clone().lerp(p1, .5).multiplyScalar(1.02); m0.y = (p0.y + p1.y) / 2; return K.mesh(L.tube([[p0.x, p0.y, p0.z], [m0.x, m0.y, m0.z], [p1.x, p1.y, p1.z]], .004, 12, 4), gold, eggG); });
      // cradle: a slim armillary-free stand (three tapered prongs on a dark disc), so the silhouette differs from the Hatchling cradle
      const dark = F.trim('#20223a', { rough: .45, metal: .7, plain: true });
      K.mesh(ctx.geo('st-base', () => L.lathe([[0, 0], [.6, 0], [.62, .04], [.5, .08], [.36, .1], [.3, .16], [0, .16]], 48)), dark, root);
      for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + .2; root.add(new THREE.Mesh(K.taper([[Math.cos(a) * .3, .14, Math.sin(a) * .3], [Math.cos(a) * .44, .32, Math.sin(a) * .44], [Math.cos(a) * rad(.75) * 1.06, yy(.75), Math.sin(a) * rad(.75) * 1.06]], .022, .01, { radial: 6, seg: 10 }), gold)); }
      // core of turning starlight + drifting motes (released on bloom)
      const core = L.sprite(glowCol, 1.4, 0); core.position.y = EY; root.add(core);
      const twinkle = []; for (let i = 0; i < (ctx.q.physical ? 14 : 7); i++) { const s = L.sprite(i % 3 ? '#ffffff' : glowCol, .08 + (i % 4) * .03, 0); s.userData.a = i / 14 * TAU; s.userData.r = .1 + (i % 5) * .07; s.userData.y = (i % 7) * .08; root.add(s); twinkle.push(s); }
      const light = new THREE.PointLight(new THREE.Color(glowCol), 0, 4, 1.6); light.position.y = EY; root.add(light);
      const inst = { root, frame: { r: .82, h: 1.82 }, float: .015, prog: 0, opened: false, openT: 0, kick: 0, lit: 0 };
      inst.setProgress = p => { inst.prog = p; inst.lit = Math.min(5, Math.round(p * 5)); };
      inst.pulse = () => { inst.kick = 1; };
      inst.open = () => { if (inst.opened) return; inst.setProgress(1); inst.opened = true; inst.openT = 0; };
      inst.update = (dt, t) => {
        const p = inst.prog, calm = ctx.reduced; inst.kick = Math.max(0, inst.kick - dt * 2.5);
        stars.forEach((m, i) => { const on = i < inst.lit; starM[i].emissiveIntensity = on ? 2.4 + (calm ? 0 : Math.sin(t * 5 + i) * .5) : .15 + (calm ? 0 : Math.max(0, Math.sin(t * 1.3 + i * 1.7)) * .25); m.rotation.y = calm ? 0 : t * .8; });
        lines.forEach((l, i) => { const on = order[i][1] < inst.lit && order[i][0] < inst.lit; l.material.opacity = on ? .85 + (calm ? 0 : Math.sin(t * 6 + i) * .1) : .08; });
        innerM.emissiveIntensity = .2 + p * 1.4; core.material.opacity = p * .45 + (inst.opened ? smooth(0, .8, inst.openT) * .55 : 0);
        light.intensity = p * 5 + (inst.opened ? smooth(.1, 1, inst.openT) * 20 : 0);
        eggG.rotation.y = calm ? 0 : Math.sin(t * .5) * .04 + inst.kick * .05 * Math.sin(t * 30);
        if (inst.opened) {
          const o = (inst.openT += dt), k = ease(clamp(o / 1.6, 0, 1));
          gores.forEach((g, i) => { g.piv.quaternion.setFromAxisAngle(g.axis, k * (1.05 + (i % 2) * .12)); });
          lines.forEach(l => (l.visible = o < .25)); engr.forEach(l => (l.visible = o < .25)); stars.forEach(s => (s.visible = o < .25));
        }
        twinkle.forEach((s, i) => { const u = s.userData, open = inst.opened ? smooth(.2, 1.4, inst.openT) : 0, a = u.a + (calm ? 0 : t * (.4 + (i % 3) * .2)); s.position.set(Math.cos(a) * (u.r + open * .5), EY - .1 + u.y + open * (.3 + u.y), Math.sin(a) * (u.r + open * .5)); s.material.opacity = (p * .5 + open * .5) * (calm ? .8 : .6 + Math.sin(t * 3 + i) * .4); });
      };
      inst.react = k => { if (k === 'click') inst.pulse(); };
      return inst;
    },
  });
})();
