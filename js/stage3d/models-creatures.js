/* AETHERVAULT — Phase Two pet families built on the creature kit (kit.js): no cloud skins, real anatomy.
 *   Ember line  — Emberkit (fox-kit, smouldering tail) → Pyrodrake (winged drake, flame-tipped tail, polite smoke)
 *   Grove line  — Mossback (meadow tortoise) → Grovewarden (a tree grows from the shell; lantern-fruit, roots, antlers)
 * Shared: K.skin bodies + K.taper limbs/tails/horns · K.face · K.mood (blink, look-at, hop, settle) · K.stageFx (L1–L4 + potential).
 * All creatures face +z. Click = hop (kit) / hide in shell (Mossback). Reduced motion freezes everything but the breathing pose. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, B = K.ball;
  const earShape = (w, h) => [[-w, 0], [-w * .55, h * .55], [0, h], [w * .55, h * .5], [w, 0]];
  const col3 = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

  /** Fur material: soft, sheen, takes the specimen's pattern/variant like every other model. */
  function furMat(ctx, hex, o = {}) {
    const m = ctx.F.body(hex, Object.assign({ rough: .8, clearcoat: 0, pat: .75, soft: true, vertexColors: !!o.vc }, o.mat || {}));
    if (m.isMeshPhysicalMaterial) { m.sheen = .35; m.sheenRoughness = .6; m.sheenColor = new THREE.Color(L.mix(ctx.item.pal[0], ctx.item.pal[3], .35)); }
    return m;
  }
  const pawGeo = ctx => ctx.geo('kpaw', () => { const g = new THREE.SphereGeometry(1, 16, 12); g.scale(1, .8, 1.15); return g; });

  // =================================================================== EMBER LINE
  function buildEmber(id, ctx) {
    const drake = id === 'pyrodrake', pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const cream = col3(L.mix(pal[3], '#ffe9c8', .4)), shadeB = K.shade({ top: 1.02, bot: .66, blue: .06 }, { c: [1, 1.32, 1.85], amt: .85, k: .12 });
    // ----- body
    const bodyBalls = drake
      ? [B(0, .6, .22, .42, 1, .95, 1.1), B(0, .55, -.2, .47, 1, .92, 1.25), B(0, .57, -.62, .38, .95, .9, 1.1), B(0, .5, -.95, .26, .9, .85, 1), B(0, .86, .55, .25, .9, 1, 1), B(0, 1.02, .72, .21, .85, 1, 1)]
      : [B(0, .42, -.02, .42, 1, .95, 1.05), B(0, .34, .16, .3), B(-.22, .27, -.22, .25), B(.22, .27, -.22, .25)];
    const bodyGeo = K.skin(ctx, id + '-body', bodyBalls, { cs: drake ? .06 : .05, noise: .05, colorFn: shadeB });
    const mat = furMat(ctx, pal[0], { vc: true }); body.add(new THREE.Mesh(bodyGeo, mat));
    // ----- head (own skin so the face and ears ride on it)
    const head = new THREE.Group(), hAt = drake ? [0, 1.16, .9] : [0, .98, .15]; head.position.set(...hAt); body.add(head);
    const headBalls = drake ? [B(0, 0, 0, .3, 1.05, .9, 1.1), B(0, -.07, .26, .15, .9, .7, 1.4), B(-.2, -.02, -.02, .13), B(.2, -.02, -.02, .13)] : [B(0, 0, 0, .42, 1.12, .92, .96), B(-.31, -.1, .05, .2), B(.31, -.1, .05, .2), B(0, -.1, .3, .17, 1, .8, 1.2)];
    const headGeo = K.skin(ctx, id + '-head', headBalls, { cs: .04, noise: .03, colorFn: K.shade({ top: 1.05, bot: .8, blue: .04 }, { c: [1, 1.3, 1.7], amt: .5, k: -.2 }) });
    head.add(new THREE.Mesh(headGeo, mat));
    const face = K.face(ctx, headGeo.userData.field, drake
      ? { eye: { y: .06, dx: .15, s: .062, tilt: .16, shape: 'round' }, mouth: { y: -.13, w: .07, kind: 'smirk' }, nose: null, brow: 'soft', iso: .5 }
      : { eye: { y: .05, dx: .18, s: .088, tilt: .1, shape: 'round' }, mouth: { y: -.17, w: .07, kind: 'smile' }, nose: { y: -.07, s: .032 }, cheek: { y: -.06, dx: .31 }, iso: .5 }, head);
    const earM = furMat(ctx, pal[0]), innerM = furMat(ctx, L.mix(pal[3], pal[1], .3), { mat: { rough: .9 } });
    const ears = [];
    if (!drake) [-1, 1].forEach(sd => { const g = new THREE.Group(); g.position.set(sd * .27, .3, -.04); g.rotation.z = -sd * .32; g.rotation.x = -.1;
      g.add(new THREE.Mesh(L.extrude(earShape(.15, .42), .07, .03, { bevelSeg: 2 }), earM)); const inn = new THREE.Mesh(L.extrude(earShape(.085, .27), .03, .01, { bevelSeg: 1 }), innerM); inn.position.set(0, .02, .04); g.add(inn); head.add(g); ears.push({ g, sd }); });
    // ----- tail (tapered, bushy mid-section, flame at the tip)
    const tailPts = drake ? [[0, .5, -.95], [0, .32, -1.35], [.3, .24, -1.7], [.7, .34, -1.78], [.98, .62, -1.6]] : [[0, .3, -.35], [.36, .2, -.55], [.74, .36, -.5], [.84, .8, -.34]];
    const tailGeo = K.taper(tailPts, drake ? .24 : .13, drake ? .05 : .06, { radial: 12, seg: 30, profile: t => (drake ? 1 : 1 + .55 * Math.sin(t * Math.PI)) });
    const tail = new THREE.Mesh(tailGeo, furMat(ctx, pal[0])); body.add(tail);
    const tip = tailPts[tailPts.length - 1], flameK = K.flame(ctx, body, { r: drake ? .15 : .12, h: drake ? .5 : .4, c1: '#ff7a1c', c2: '#fff0a0' }); flameK.group.position.set(tip[0], tip[1] - .03, tip[2]);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(drake ? .07 : .075, 12, 10), F.body(L.mix(pal[3], pal[1], .35), { rough: .8, clearcoat: 0, soft: true })); tailTip.position.set(tip[0], tip[1], tip[2]); body.add(tailTip);
    const tailLight = new THREE.PointLight(new THREE.Color('#ff8a30'), 0, 3.4, 1.6); tailLight.position.set(tip[0], tip[1] + .2, tip[2] + .2); body.add(tailLight);
    // ----- limbs
    const pawM = furMat(ctx, L.shade(pal[0], .8)), clawM = F.trim(L.mix(pal[3], '#fff', .4), { rough: .35, metal: 0, plain: true }), paw = pawGeo(ctx), legs = [];
    const leg = (x, z, y0, big) => { const g = new THREE.Group(); g.position.set(x, y0, z); const p = new THREE.Mesh(paw, pawM); p.scale.set(big * .13, big * .09, big * .17); p.position.y = big * .04; g.add(p); if (drake) for (let k = -1; k <= 1; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.018, .07, 6), clawM); c.rotation.x = Math.PI / 2; c.position.set(k * .045, big * .03, big * .19); g.add(c); ctx.disposables.push(c.geometry); } body.add(g); legs.push(g); return g; };
    if (drake) {
      [-1, 1].forEach(sd => { // thighs/forearms as tapered tubes
        body.add(new THREE.Mesh(K.taper([[sd * .3, .75, .3], [sd * .38, .45, .36], [sd * .36, .1, .42]], .13, .07, { radial: 8, seg: 10 }), pawM));
        body.add(new THREE.Mesh(K.taper([[sd * .34, .72, -.66], [sd * .46, .42, -.55], [sd * .4, .1, -.5]], .17, .075, { radial: 8, seg: 10 }), pawM)); leg(sd * .36, .44, 0, 1.15); leg(sd * .4, -.46, 0, 1.3); });
    } else { [-1, 1].forEach(sd => { leg(sd * .17, .38, .0, 1); leg(sd * .3, -.12, .0, 1.15); }); }
    // ----- drake extras: horns, wings, spine plates, smoke
    const wings = []; let smoke = null, embers = null; const plateM = F.trim(L.mix(pal[3], pal[1], .2), { rough: .45, metal: .1, plain: true });
    if (drake) {
      [-1, 1].forEach(sd => { const h = new THREE.Mesh(K.taper([[sd * .1, .2, -.08], [sd * .17, .4, -.26], [sd * .26, .5, -.5]], .055, .01, { radial: 7, seg: 12, ends: 'point' }), plateM); head.add(h); });
      const memM = F.body(L.mix('#d9421f', pal[0], .5), { rough: .7, metal: 0, clearcoat: 0, side: THREE.DoubleSide, soft: true, pat: .4 }); if (memM.isMeshPhysicalMaterial) { memM.sheen = 1; memM.sheenColor = new THREE.Color('#ff9a5a'); }
      const boneM = F.trim(L.shade(pal[0], .55), { rough: .5, metal: 0, plain: true });
      [-1, 1].forEach(sd => { const w = K.wing(ctx, { span: 1.55, chord: .72, bone: .034, mem: memM, boneMat: boneM, fingers: 3 }); const pv = new THREE.Group(); pv.position.set(sd * .26, .98, .1); pv.add(w.group); pv.scale.x = sd; pv.rotation.y = -sd * .25; body.add(pv); wings.push({ pv, w, sd }); });
      for (let i = 0; i < 8; i++) { const t = i / 7, s = new THREE.Mesh(ctx.geo('kplate', () => L.extrude([[-.05, 0], [.05, 0], [0, .16]], .03, .008, { bevelSeg: 1 })), plateM); s.position.set(0, 1.0 - t * .18 - .04 * Math.sin(t * 3), .6 - t * 1.75); s.rotation.x = -.35; s.scale.setScalar(1.15 - t * .5); body.add(s); }
      smoke = K.sparks(ctx, head, { n: 10, color: '#c9c1b8', smoke: true, size: .11, opacity: .32, rise: .25, spread: .05, at: [0, -.04, .42], life: 2 });
      embers = K.sparks(ctx, body, { n: 12, color: '#ffa040', size: .05, rise: .5, spread: 1.1, at: [0, .5, -.2], life: 2.2 });
    } else embers = K.sparks(ctx, body, { n: 8, color: '#ffa040', size: .045, rise: .45, spread: .2, at: [tip[0], tip[1] + .15, tip[2]], life: 1.4 });
    // ember mark on the brow (kit) / chest ember (both)
    const mark = new THREE.Mesh(new THREE.OctahedronGeometry(.045, 0), F.make('glow', { color: pal[1], glow: 1.7 })); mark.scale.set(.8, 1.3, .5); mark.position.set(0, drake ? .17 : .27, drake ? .17 : .3); head.add(mark); ctx.disposables.push(mark.geometry);
    const FR = drake ? { r: 1.8, h: 2.15 } : { r: 1.0, h: 1.95 };
    const fx = K.stageFx(ctx, root, { r: drake ? 1.2 : .82, h: FR.h, color: pal[1], core: [0, drake ? .8 : .5, .2] });
    // ----- behaviour
    const A = K.mood(); let flare = 0;
    const inst = { root, frame: FR, float: .03, rest: { yaw: drake ? -.7 : -.35, pitch: 0 } };
    inst.react = k => { A.react(k); if (k === 'click') flare = 1; };
    inst.update = (dt, t, st) => {
      const calm = ctx.reduced || st.reduced; A.step(dt, st, calm); flare = Math.max(0, flare - dt * 1.2);
      const br = calm ? 0 : Math.sin(t * (1.5 - A.settle * .5)) * .014;
      body.scale.set(1 - br * .5 + (1 - A.sq) * .6, 1 + br + (A.sq - 1) * .8, 1 - br * .5 + (1 - A.sq) * .6); body.position.y = A.hopY - A.settle * .04;
      head.rotation.y = A.look.x * .7; head.rotation.x = -A.look.y * .5 + A.settle * .22 + (drake ? Math.sin(t * .8) * .02 : 0); head.rotation.z = calm ? 0 : Math.sin(t * .7) * .03;
      ears.forEach(e => { e.g.rotation.z = -e.sd * (.32 + (calm ? 0 : Math.sin(t * 1.3 + e.sd) * .03) + (A.wide > 0 ? .12 : 0) + A.settle * .35); });
      face.update(A);
      const sway = calm ? 0 : Math.sin(t * 1.6) * (.07 + A.delight * .05) + Math.sin(t * .6) * .04; tail.rotation.y = sway; tailTip.rotation.y = sway; flameK.group.rotation.y = 0;
      // the tail flame follows the tail tip sway (rotate the tip position about the tail root)
      const cs = Math.cos(sway), sn = Math.sin(sway), root0 = tailPts[0], dx = tip[0] - root0[0], dz = tip[2] - root0[2];
      const fxp = root0[0] + dx * cs + dz * sn, fzp = root0[2] - dx * sn + dz * cs; flameK.group.position.set(fxp, tip[1] - .03, fzp); tailTip.position.set(fxp, tip[1], fzp); tailLight.position.set(fxp, tip[1] + .2, fzp + .2);
      flameK.update(t, (calm ? 1 : 1) + flare * .5 + A.delight * .2, 1); tailLight.intensity = (1.2 + flare * 4 + (calm ? 0 : Math.sin(t * 8) * .3)) * (drake ? 1.3 : 1);
      legs.forEach((l, i) => { l.position.y = A.hopY * .5 + (calm ? 0 : Math.sin(t * 1.4 + i) * .004); });
      wings.forEach(w => { const flap = calm ? 0 : Math.sin(t * (1.7 + A.delight * 5) + w.sd) * (.09 + A.hopY * .9 + A.delight * .25); w.w.arm.rotation.z = .55 + flap - A.settle * .35; w.w.hand.rotation.z = -.35 - flap * 1.5 - A.settle * .5; });
      if (smoke) smoke.update(dt, t, calm ? 0 : .25 + flare * 2); embers.update(dt, t, calm ? .2 : (drake ? .5 : .8) + flare * 3);
      fx.update(dt, t, calm);
    };
    return inst;
  }

  // =================================================================== GROVE LINE
  function buildGrove(id, ctx) {
    const warden = id === 'grovewarden', pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const sc = warden ? 1.32 : 1, rng = U.mulberry32(warden ? 4411 : 1273);
    const skinHex = warden ? '#b9a577' : '#d4c08e', skinM = furMat(ctx, skinHex, { mat: { rough: .85 } });
    // ----- shell: lathe dome + radial seams + rim + moss tufts
    const SR = .74 * sc, SH = .62 * sc, SY = .38 * sc, prof = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; prof.push([Math.sin(a) * SR, SY + Math.cos(a) * SH * (1 - .12 * Math.sin(a * 2))]); } prof.unshift([SR * 1.06, SY - .02], [SR * 1.06, SY]); prof.reverse();
    const shellGeo = ctx.geo('grove-shell:' + id, () => { const g = L.lathe(prof, 44); g.scale(1, 1, 1.12); return g; });
    const shellM = F.body(warden ? '#4d8a52' : '#68b468', { rough: .75, clearcoat: .1, soft: false, pat: .6, forceWear: true, metal: 0 });
    const shell = new THREE.Group(); shell.position.set(0, 0, -.06 * sc); body.add(shell); shell.add(new THREE.Mesh(shellGeo, shellM));
    const seamM = F.body(warden ? '#2a4a30' : '#3b7a44', { rough: .8, metal: 0, clearcoat: 0 }), rimM = F.trim(warden ? '#8a7a54' : '#c9b98e', { rough: .6, metal: .05, plain: true });
    const dome = (a, b) => [Math.sin(a) * (SR + .005) * Math.cos(b), SY + Math.cos(a) * SH * (1 - .12 * Math.sin(a * 2)) + .005, Math.sin(a) * (SR + .005) * Math.sin(b) * 1.12];
    for (let k = 0; k < 7; k++) { const b = k / 7 * TAU, pts = []; for (let i = 0; i <= 8; i++) pts.push(dome(i / 8 * 1.5, b)); shell.add(new THREE.Mesh(L.tube(pts, .016 * sc, 12, 5), seamM)); }
    [.55, 1.0].forEach(a => { const pts = []; for (let i = 0; i <= 28; i++) pts.push(dome(a, i / 28 * TAU)); shell.add(new THREE.Mesh(L.tube(pts, .014 * sc, 56, 5, true), seamM)); });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(SR * 1.04, .045 * sc, 8, 48), rimM); rim.rotation.x = Math.PI / 2; rim.position.y = SY - .0; rim.scale.set(1, 1.12, 1); shell.add(rim);
    // moss: instanced tufts on the dome (green gradient by height)
    const mossG = ctx.geo('moss-tuft', () => new THREE.IcosahedronGeometry(1, 1)), mossM = F.body(warden ? '#6fb15f' : '#8fd48a', { rough: .95, metal: 0, clearcoat: 0, soft: true, pat: .2 }), N = warden ? 60 : 44, mossI = new THREE.InstancedMesh(mossG, mossM, N), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < N; i++) { const a = Math.acos(rng() * .92 + .08) * .86, b = rng() * TAU, p = dome(a, b), s = (.035 + rng() * .06) * sc * (1.3 - a * .5); e.set(rng() * 3, rng() * 3, rng() * 3); q.setFromEuler(e); mm.compose(new THREE.Vector3(p[0] * .985, p[1], p[2] * .985), q, new THREE.Vector3(s * 1.3, s * .8, s * 1.3)); mossI.setMatrixAt(i, mm); }
    shell.add(mossI);
    // ----- head + neck (skin with face), legs, tail
    const head = new THREE.Group(); head.position.set(0, .34 * sc, .66 * sc); body.add(head);
    const hb = warden ? [B(0, 0, 0, .34, 1.05, .95, 1.1), B(0, -.04, .27, .19, .9, .75, 1.3), B(-.23, -.06, -.02, .16), B(.23, -.06, -.02, .16)] : [B(0, 0, 0, .2, 1.1, .95, 1.1), B(0, -.02, .14, .1, .9, .8, 1.2), B(-.12, -.03, 0, .09), B(.12, -.03, 0, .09)];
    const headGeo = K.skin(ctx, id + '-head', hb, { cs: .03, noise: .03, colorFn: K.shade({ top: 1.05, bot: .8, blue: 0 }) });
    head.add(new THREE.Mesh(headGeo, skinM));
    const neck = new THREE.Mesh(K.taper([[0, .02, -.3], [0, .02, -.12], [0, 0, 0]], warden ? .2 : .15, warden ? .15 : .11, { radial: 10, seg: 8, ends: 'flat' }), skinM); head.add(neck);
    const face = K.face(ctx, headGeo.userData.field, warden
      ? { eye: { y: .05, dx: .15, s: .07, tilt: .0, shape: 'calm' }, mouth: { y: -.12, w: .07, kind: 'smile' }, nose: null, brow: 'soft', iso: .5 }
      : { eye: { y: .035, dx: .095, s: .048, tilt: 0, shape: 'round' }, mouth: { y: -.075, w: .045, kind: 'smile' }, cheek: { y: -.04, dx: .17 }, iso: .5 }, head);
    const legs = []; const legM = skinM, paw = pawGeo(ctx);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { const g = new THREE.Group(); g.position.set(sx * .46 * sc, .13 * sc, sz * .32 * sc); const p = new THREE.Mesh(paw, legM); p.scale.set(.17 * sc, .15 * sc, .2 * sc); g.add(p); for (let k = -1; k <= 1; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(.03 * sc, 8, 6), rimM); c.position.set(k * .055 * sc, -.02 * sc, .17 * sc); g.add(c); ctx.disposables.push(c.geometry); } body.add(g); legs.push(g); });
    const tail = new THREE.Mesh(K.taper([[0, .22 * sc, -.7 * sc], [0, .18 * sc, -.88 * sc], [.04, .24 * sc, -1.02 * sc]], .08 * sc, .02, { radial: 8, seg: 8, ends: 'point' }), skinM); body.add(tail);
    // ----- flowers / mushrooms (Mossback) · tree, lantern fruit, roots, antlers (Grovewarden)
    const swayers = [], glowers = [], petalM = [F.body('#ff9ac0', { rough: .7, metal: 0, clearcoat: 0, soft: true }), F.body('#fff2a0', { rough: .7, metal: 0, clearcoat: 0, soft: true }), F.body('#c9a6ff', { rough: .7, metal: 0, clearcoat: 0, soft: true })];
    const stemM = F.body('#3d8a46', { rough: .8, metal: 0, clearcoat: 0 }), eyeM = F.make('glow', { color: '#ff7a2a', glow: 1.2 });
    const flower = (a, b, i, s) => { const p = dome(a, b), g = new THREE.Group(); g.position.set(p[0] * .97, p[1], p[2] * .97); const h = (.16 + rng() * .1) * s; g.add(new THREE.Mesh(L.tube([[0, 0, 0], [.012, h * .5, 0], [0, h, 0]], .008 * s, 8, 4), stemM)); const f = new THREE.Group(); f.position.y = h; for (let k = 0; k < 5; k++) { const pe = new THREE.Mesh(ctx.geo('petal', () => { const gg = new THREE.SphereGeometry(1, 8, 6); gg.scale(.9, .35, 1.2); return gg; }), petalM[i % 3]); const ang = k / 5 * TAU; pe.position.set(Math.cos(ang) * .035 * s, 0, Math.sin(ang) * .035 * s); pe.scale.setScalar(.03 * s); pe.rotation.y = -ang; f.add(pe); } const c = new THREE.Mesh(new THREE.SphereGeometry(.018 * s, 8, 6), eyeM); f.add(c); ctx.disposables.push(c.geometry); g.add(f); shell.add(g); swayers.push({ g, ph: i * 1.3 }); };
    if (!warden) { [[.5, .4], [.7, 1.9], [.35, 3.4], [.8, 4.7]].forEach(([a, b], i) => flower(a, b, i, 1)); }
    else flower(.9, .5, 0, 1.4), flower(1.05, 3.6, 1, 1.2), flower(.85, 5.2, 2, 1.3);
    // mushrooms
    const capG = ctx.geo('mush-cap', () => L.lathe([[0, .1], [.06, .1], [.11, .08], [.14, .03], [.13, 0], [0, 0]], 14)), stG = ctx.geo('mush-stem', () => L.lathe([[0, 0], [.03, 0], [.026, .06], [.03, .1], [0, .1]], 8)), capM = F.body('#d8553a', { rough: .6, metal: 0, clearcoat: .3 }), stM = F.body('#f0e4c8', { rough: .8, metal: 0, clearcoat: 0 });
    [[1.15, 1.2, 1.0], [1.2, 4.2, .8], warden ? [1.05, 2.6, 1.2] : null].filter(Boolean).forEach(([a, b, s]) => { const p = dome(a, b), g = new THREE.Group(); g.position.set(p[0], p[1] - .02, p[2]); g.rotation.z = rng() * .4 - .2; g.add(new THREE.Mesh(stG, stM)); const c = new THREE.Mesh(capG, capM); c.position.y = .1; g.add(c); g.scale.setScalar(s * sc * 1.1); shell.add(g); });
    let antlers = null, canopy = null, fruitMat = null, roots = null;
    if (warden) {
      // tree: trunk + branches + canopy + lantern fruit
      const bark = F.body('#6b4a2a', { rough: .9, metal: 0, clearcoat: 0, pat: .3 }), leaf = F.body('#5fae5c', { rough: .85, metal: 0, clearcoat: 0, soft: true, pat: .3 }), leaf2 = F.body('#86cf6f', { rough: .85, metal: 0, clearcoat: 0, soft: true });
      const tree = new THREE.Group(); tree.position.set(.06, SY + SH * .88, -.1); tree.scale.setScalar(1.25); shell.add(tree);
      tree.add(new THREE.Mesh(K.taper([[0, -.1, 0], [-.04, .35, .02], [.05, .75, -.02], [0, 1.1, .02]], .15, .05, { radial: 10, seg: 20, profile: t => 1 + .5 * Math.pow(1 - t, 4) }), bark));
      [[.0, .7, .6, 1], [.0, .85, -.7, -1], [0, .95, .15, 1]].forEach(([y, h, a, s], i) => { const pts = [[0, h * .8, 0], [s * .25, h * 1.0, .02 * i], [s * .5 + i * .02, h * 1.15, -.04]]; tree.add(new THREE.Mesh(K.taper(pts, .05, .02, { radial: 6, seg: 8, ends: 'point' }), bark)); });
      canopy = new THREE.Group(); canopy.position.set(0, 1.18, 0); tree.add(canopy); const leafG = ctx.geo('leaf-ball', () => new THREE.IcosahedronGeometry(1, 2));
      [[0, .12, 0, .5, leaf], [-.42, 0, .1, .36, leaf2], [.44, .02, -.06, .38, leaf], [.05, -.04, .4, .32, leaf2], [-.12, .32, -.12, .3, leaf2]].forEach(([x, y, z, s, m]) => { const b = new THREE.Mesh(leafG, m); b.position.set(x, y, z); b.scale.set(s * 1.1, s * .85, s); canopy.add(b); });
      fruitMat = F.make('glow', { color: '#ffd77a', glow: 1.7 }); const fG = ctx.geo('fruit', () => new THREE.SphereGeometry(.07, 14, 10));
      [[-.3, -.2, .3], [.35, -.18, .22], [.1, -.28, -.3], [-.1, .05, .5]].forEach(([x, y, z], i) => { const f = new THREE.Mesh(fG, fruitMat); f.position.set(x, y - .12, z); f.userData.i = i; canopy.add(f); const gl = L.sprite('#ffd77a', .5, .4); f.add(gl); glowers.push(f); canopy.add(new THREE.Mesh(L.tube([[x, y - .04, z], [x, y + .22, z * .8]], .004, 4, 3), stemM)); });
      // roots creeping over the shell shoulders to the ground
      roots = new THREE.Group(); [-1, 1].forEach(sd => { const pts = [[sd * .1, SY + SH * .74, .15], [sd * .45, SY + SH * .55, .35], [sd * .78, SY * .55, .55], [sd * .92, .03, .62]]; roots.add(new THREE.Mesh(K.taper(pts, .1, .04, { radial: 8, seg: 14 }), bark)); }); body.add(roots);
      // antlers: wooden branches with leaves
      antlers = new THREE.Group(); antlers.scale.setScalar(1.45); antlers.position.y = .06; [-1, 1].forEach(sd => { const a = new THREE.Group(); a.add(new THREE.Mesh(K.taper([[sd * .1, .12, -.05], [sd * .2, .38, -.1], [sd * .32, .6, -.06]], .035, .012, { radial: 6, seg: 10, ends: 'point' }), bark)); a.add(new THREE.Mesh(K.taper([[sd * .2, .38, -.1], [sd * .36, .46, -.12], [sd * .46, .56, -.1]], .022, .008, { radial: 5, seg: 6, ends: 'point' }), bark)); const lf = new THREE.Mesh(leafG, leaf2); lf.scale.set(.06, .04, .05); lf.position.set(sd * .46, .58, -.1); a.add(lf); const lf2 = lf.clone(); lf2.position.set(sd * .32, .64, -.06); a.add(lf2); antlers.add(a); }); head.add(antlers);
    }
    // ----- butterflies / fireflies
    const flies = [], wingGeo = ctx.geo('bfly-wing', () => new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(.08, .06), new THREE.Vector2(.1, -.01), new THREE.Vector2(.045, -.07)])));
    if (!warden) [['#ff9ac0', 0], ['#fff2a0', 2.1]].forEach(([c, ph]) => { const g = new THREE.Group(), m = K.basic(ctx, c, 1, false, { side: THREE.DoubleSide }); const w1 = new THREE.Mesh(wingGeo, m), w2 = new THREE.Mesh(wingGeo, m); w2.scale.x = -1; g.add(w1, w2); g.userData.noSil = true; body.add(g); flies.push({ g, w1, w2, ph }); });
    const fireflies = warden ? K.sparks(ctx, body, { n: 16, color: '#ffe08a', size: .06, rise: .1, spread: 2.2, at: [0, .6, 0], life: 4.5, opacity: .9 }) : null;
    const FR = warden ? { r: 1.55, h: 3.3 } : { r: 1.0, h: 1.3 };
    const fx = K.stageFx(ctx, root, { r: warden ? 1.3 : .85, h: FR.h, color: pal[1], core: [0, .5 * sc, .3] });
    // ----- behaviour
    const A = K.mood(); let hide = 0;
    const inst = { root, frame: FR, float: warden ? .02 : .025, rest: { yaw: warden ? -.55 : -.5, pitch: 0 } };
    inst.react = k => { if (k === 'click') { hide = 1.6; A.hop = 0; } else A.react(k); };
    inst.update = (dt, t, st) => {
      const calm = ctx.reduced || st.reduced; A.step(dt, st, calm); hide = Math.max(0, hide - dt);
      const tuck = hide > .25 ? Math.min(1, (1.6 - hide) / .3) : Math.min(1, hide / .25);
      const br = calm ? 0 : Math.sin(t * (1.1 - A.settle * .4)) * .012; shell.scale.set(1 - br * .4, 1 + br, 1 - br * .4);
      head.position.z = (.66 * sc) - tuck * .42 * sc; head.scale.setScalar(1 - tuck * .35); head.position.y = .34 * sc - tuck * .05 + (A.hopY * .4);
      head.rotation.y = A.look.x * .8 * (1 - tuck); head.rotation.x = -A.look.y * .5 * (1 - tuck) + A.settle * .18; face.update(Object.assign({}, A, { blink: tuck > .3 ? 1 : A.blink }));
      body.position.y = A.hopY * .6 - A.settle * .02; body.rotation.z = calm ? 0 : Math.sin(t * .5) * .01;
      legs.forEach((l, i) => { l.position.y = .13 * sc + (calm ? 0 : Math.sin(t * 1.1 + i * 1.6) * .004) + A.hopY * .3 - tuck * .05; });
      tail.rotation.y = calm ? 0 : Math.sin(t * 1.2) * .25;
      swayers.forEach(s => { s.g.rotation.z = calm ? 0 : Math.sin(t * 1.3 + s.ph) * .09; s.g.rotation.x = calm ? 0 : Math.cos(t * 1.1 + s.ph) * .06; });
      flies.forEach(f => { const a = t * .5 + f.ph, r = .95, fl = calm ? 0 : Math.sin(t * 22 + f.ph) * .9 + .3; f.g.position.set(Math.cos(a) * r, .95 + Math.sin(t * 1.3 + f.ph) * .12, Math.sin(a) * r * .8); f.g.rotation.y = -a + Math.PI / 2; f.w1.rotation.y = fl; f.w2.rotation.y = -fl; f.w1.rotation.x = f.w2.rotation.x = -1.2; });
      if (canopy) { canopy.rotation.z = calm ? 0 : Math.sin(t * .6) * .02; canopy.rotation.x = calm ? 0 : Math.cos(t * .5) * .015; }
      glowers.forEach(f => { f.scale.setScalar(1 + (calm ? 0 : Math.sin(t * 1.6 + f.userData.i * 1.7) * .08)); }); if (fruitMat) fruitMat.emissiveIntensity = 1.5 + (calm ? 0 : Math.sin(t * 1.4) * .4) + (A.delight > 0 ? 1 : 0);
      if (antlers) antlers.rotation.z = calm ? 0 : Math.sin(t * .8) * .02;
      if (fireflies) fireflies.update(dt, t, calm ? .08 : .5);
      fx.update(dt, t, calm);
    };
    return inst;
  }

  ['emberkit', 'pyrodrake'].forEach(id => S.registerModel(id, { rest: { yaw: id === 'pyrodrake' ? -.7 : -.35, pitch: 0 }, build: ctx => buildEmber(id, ctx) }));
  ['mossback', 'grovewarden'].forEach(id => S.registerModel(id, { rest: { yaw: -.5, pitch: 0 }, build: ctx => buildGrove(id, ctx) }));
})();
