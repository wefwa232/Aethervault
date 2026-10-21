/* AETHERVAULT — Phase Three transformations and stage details (shared by every model).
 * One hook (S.forms.apply, called by View.setSpec after a model builds) reads the model's solid bounds and adds REAL geometry:
 *   stage details   category-specific structural additions for upgrade stages 1–4 (brackets, standing relic, fragments, mantle)
 *   form motifs     the geometry/animation vocabulary of a transformation (crown, wings, plates, spines, orbit, halo, vents, cage,
 *                   rift, blades, roots, crystals, tendrils, elem:*, eyes, gears, echo) — see progress.js for which form uses which
 * Nothing here is a ring around the specimen: parts sit behind, above, beside or on the pedestal. Everything is placed from bounds,
 * so it works for any model; it is deliberately generic attachment work, not hand-sculpted per item (documented limitation).
 * Cost: ≤ ~40 meshes per form, shared unit geometry, no extra lights, no per-frame allocation. Reduced motion freezes the animation. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, K = S.kit, U = AV.util, TAU = Math.PI * 2, clamp = U.clamp;
  const PR = () => AV.progress;
  const FM = (S.forms = { motifs: {} });

  /** AABB of the solid (non-glow) meshes of a model, in the model root's space. */
  function bounds(root) {
    root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m4 = new THREE.Matrix4(), p = new THREE.Vector3();
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; let meshes = 0;
    const walk = o => {
      if (o.userData.noSil || !o.visible || o.name === 'stagefx') return;
      if (o.isMesh && o.geometry) {
        const m = o.material; meshes++;
        if (!(m && !Array.isArray(m) && (m.blending === THREE.AdditiveBlending))) {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; m4.multiplyMatrices(inv, o.matrixWorld);
          if (b && isFinite(b.min.x)) for (let i = 0; i < 8; i++) { p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m4); for (let k = 0; k < 3; k++) { const v = k === 0 ? p.x : k === 1 ? p.y : p.z; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; } }
        }
      }
      o.children.forEach(walk);
    };
    walk(root);
    if (mn[0] > mx[0]) return null;
    const w = mx[0] - mn[0], h = mx[1] - mn[1], d = mx[2] - mn[2];
    return { min: { x: mn[0], y: mn[1], z: mn[2] }, max: { x: mx[0], y: mx[1], z: mx[2] }, cx: (mn[0] + mx[0]) / 2, cy: (mn[1] + mx[1]) / 2, cz: (mn[2] + mx[2]) / 2, w, h, d, r: Math.max(w, d) / 2, meshes };
  }

  // ------------------------------------------------------------------ shared builders (c = apply context)
  const geoU = (c, key, fn) => c.ctx.geo('f:' + key, fn);
  const own = (c, o) => { c.ctx.disposables.push(o); return o; };
  const trimM = (c, col, o) => c.F.trim(col || c.tint, Object.assign({ rough: .34, metal: .75 }, o));
  const bodyM = (c, col, o) => c.F.body(col, Object.assign({ rough: .6, metal: 0, clearcoat: 0 }, o));
  const glowM = (c, col, g = 1.3) => c.F.make('glow', { color: col || c.tint, glow: g });
  const spikeG = c => geoU(c, 'spike', () => { const s = new THREE.ConeGeometry(1, 1, 6); s.translate(0, .5, 0); return s; });
  const shardG = c => geoU(c, 'shard', () => { const s = new THREE.OctahedronGeometry(1, 0); s.scale(.5, 1.4, .5); return s; });
  const kiteG = c => geoU(c, 'kite', () => L.extrude([[0, -.5], [.09, .08], [0, .5], [-.09, .08]], .03, .006, { bevelSeg: 1 }));
  const sphG = c => K.unitSphere(c.ctx);
  const add = (c, parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  const grp = (c, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); c.g.add(g); return g; };
  const ext = (c, r, h) => { c.ext.r = Math.max(c.ext.r, r); c.ext.h = Math.max(c.ext.h, h); };

  // ------------------------------------------------------------------ form motifs
  const M = FM.motifs;
  M.crown = c => {
    const B = c.B, n = 7, r = Math.max(.2, B.r * .34), top = B.max.y + B.h * .09, g = grp(c, B.cx, top, B.cz), tm = trimM(c), gm = glowM(c, c.tint, 1.6);
    for (let i = 0; i < n; i++) { const a = i / n * TAU, h = r * (i % 2 ? .5 : .75), s = add(c, g, new THREE.Mesh(spikeG(c), tm), Math.cos(a) * r, 0, Math.sin(a) * r); s.scale.set(r * .16, h, r * .16); }
    const band = add(c, g, new THREE.Mesh(geoU(c, 'crownband', () => new THREE.TorusGeometry(1, .035, 6, 40)), tm), 0, 0, 0); band.rotation.x = Math.PI / 2; band.scale.setScalar(r);
    const gem = add(c, g, new THREE.Mesh(shardG(c), gm), 0, r * .35, 0); gem.scale.setScalar(r * .2);
    ext(c, r * 1.2, top + r * .8);
    c.ups.push((dt, t, calm) => { g.rotation.y = calm ? 0 : t * .35; g.position.y = top + (calm ? 0 : Math.sin(t * 1.2) * B.h * .012); gem.rotation.y = t * 1.2; });
  };
  M.wings = c => {
    const B = c.B, span = B.h * .8, chord = B.h * .46, mem = own(c, new THREE.MeshBasicMaterial({ color: new THREE.Color(c.tint), transparent: true, opacity: .46, side: THREE.DoubleSide, depthWrite: false })), bone = trimM(c);
    const wings = [-1, 1].map(sd => {
      const w = K.wing(c.ctx, { span, chord, bone: B.h * .016, mem, boneMat: bone, fingers: 4 }); w.group.position.set(B.cx + sd * B.w * .1, B.min.y + B.h * .6, B.cz - B.d * .3);
      if (sd < 0) w.group.scale.x = -1; w.group.rotation.set(0, sd * .55, sd * .3); c.g.add(w.group); return { w, sd };
    });
    ext(c, span * .8, B.max.y);
    c.ups.push((dt, t, calm) => wings.forEach(({ w, sd }) => { const f = calm ? 0 : Math.sin(t * 1.7); w.arm.rotation.z = f * .1; w.hand.rotation.z = f * .22 - .05; }));
  };
  M.plates = c => {
    const B = c.B, dm = trimM(c, '#5b4f44', { rough: .45, metal: .6, plain: true }), em = glowM(c, c.tint, 1.2);
    const half = geoU(c, 'half', () => new THREE.SphereGeometry(1, 18, 9, 0, TAU, 0, Math.PI / 2));
    if (c.fam === 'weapon' || c.fam === 'shield') { // curved side guards: a crescent that wraps the specimen, with a lit edge and three studs
      const ds = trimM(c, '#5b4f44', { rough: .4, metal: .7, side: THREE.DoubleSide }), cres = geoU(c, 'crescent', () => { const o = [], n = [], N = 14; for (let i = 0; i <= N; i++) { const a = (-.5 + i / N) * 2.2; o.push([Math.cos(a) * .55, Math.sin(a) * .5]); } for (let i = N; i >= 0; i--) { const a = (-.5 + i / N) * 2.2; n.push([Math.cos(a) * .38 - .02, Math.sin(a) * .42]); } return L.extrude(o.concat(n), .09, .015, { bevelSeg: 1 }); });
      [-1, 1].forEach(sd => { const g2 = grp(c, B.cx + sd * (B.w * .5 + B.h * .02), B.min.y + B.h * .5, B.cz - B.d * .05); const m = add(c, g2, new THREE.Mesh(cres, ds), 0, 0, 0); m.scale.set(sd * B.h * .5, B.h * .78, B.d * .4 + B.h * .08); g2.rotation.y = sd * -.35; for (let k = -1; k <= 1; k++) { const st = add(c, g2, new THREE.Mesh(sphG(c), em), sd * B.h * .26, k * B.h * .22, 0); st.scale.setScalar(B.h * .018); } }); }
    else [-1, 1].forEach(sd => { const p = add(c, c.g, new THREE.Mesh(half, dm), B.cx + sd * B.w * .38, B.min.y + B.h * .6, B.cz - B.d * .02); p.scale.set(B.w * .2, B.h * .13, B.d * .26); p.rotation.z = -sd * .45; const st = add(c, c.g, new THREE.Mesh(sphG(c), em), B.cx + sd * B.w * .38, B.min.y + B.h * .64, B.cz + B.d * .2); st.scale.setScalar(B.h * .018); });
    if (c.fam !== 'weapon' && c.fam !== 'shield') [0, 1, 2, 3].forEach(i => { const lam = add(c, c.g, new THREE.Mesh(geoU(c, 'lame', () => L.chamferBox(1, 1, 1, .12)), dm), B.cx, B.min.y + B.h * (.74 - i * .15), B.cz - B.d * (.44 + i * .03)); lam.scale.set(B.w * (.5 - i * .06), B.h * .14, B.d * .06); lam.rotation.x = .2 + i * .07; });
    ext(c, B.r * 1.2, B.max.y);
  };
  M.spines = c => {
    const B = c.B, n = 9, dm = trimM(c, '#2b2630', { rough: .5 }), tip = glowM(c, c.tint, 1.5), rng = U.mulberry32(c.seed ^ 0x51);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), y = B.min.y + B.h * (.18 + .66 * t), z = B.cz - B.d * (.36 + .12 * Math.sin(t * Math.PI)), h = B.h * (.34 - Math.abs(t - .45) * .2), s = add(c, c.g, new THREE.Mesh(spikeG(c), dm), B.cx + (rng() - .5) * B.w * .05, y, z);
      s.scale.set(B.h * .06, h, B.h * .06); s.rotation.x = -(.55 + t * .45);
      const tp = add(c, s, new THREE.Mesh(spikeG(c), tip), 0, .72, 0); tp.scale.set(.7, .3, .7);
    }
    ext(c, B.r * 1.15, B.max.y);
  };
  M.orbit = c => {
    const B = c.B, n = 6, tm = trimM(c, c.tint, { rough: .25 }), gm = glowM(c, c.tint, 1.4), items = [];
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(shardG(c), i % 2 ? gm : tm); m.scale.setScalar(B.h * .055); c.g.add(m); items.push({ m, a: i / n * TAU, sp: .35 + (i % 3) * .1, y: B.min.y + B.h * (.28 + (i % 3) * .26) }); }
    const rx = B.r * 1.05 + B.h * .08; ext(c, rx, B.max.y);
    c.ups.push((dt, t, calm) => items.forEach(o => { const a = o.a + (calm ? 0 : t * o.sp); o.m.position.set(B.cx + Math.cos(a) * rx, o.y + (calm ? 0 : Math.sin(t * 1.3 + o.a) * B.h * .02), B.cz + Math.sin(a) * rx * .6 - B.d * .15); o.m.rotation.set(0, -a, Math.sin(a) * .4); }));
  };
  M.halo = c => {
    const B = c.B, R = B.h * .44, g = grp(c, B.cx, B.min.y + B.h * .58, B.min.z - B.d * .22), am = K.basic(c.ctx, c.tint, .55, true);
    const ring = add(c, g, new THREE.Mesh(geoU(c, 'halotorus', () => new THREE.TorusGeometry(1, .012, 6, 72)), am), 0, 0, 0); ring.scale.setScalar(R); ring.userData.noSil = true; ring.userData.noCast = true;
    const ray = geoU(c, 'haloray', () => new THREE.PlaneGeometry(1, 1)); const sm = K.basic(c.ctx, c.tint, .4, true, { map: L.shaftTex(), side: THREE.DoubleSide });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, m = add(c, g, new THREE.Mesh(ray, sm), Math.cos(a) * R * .78, Math.sin(a) * R * .78, 0); m.scale.set(.045, R * .5, 1); m.rotation.z = a - Math.PI / 2; m.userData.noSil = true; }
    const gl = L.sprite(c.tint, R * 2.2, .22); g.add(gl); K.noSil(g);
    c.ups.push((dt, t, calm) => { if (!calm) g.rotation.z = t * .08; });
  };
  M.vents = c => {
    // swept-back exhaust: four curved pipes with flared bells, each firing a rearward jet; a heat glow and a little smoke
    const B = c.B, tm = trimM(c, '#7b808c', { rough: .38, metal: .85 }), bell = trimM(c, '#3a3d46', { rough: .5, metal: .7 }), jets = [], gl = L.sprite(c.tint, B.h * .9, .2);
    [[-.2, .66], [.2, .66], [-.3, .46], [.3, .46]].forEach(([dx, dy], i) => {
      const sd = dx < 0 ? -1 : 1, x = B.cx + dx * B.w, y = B.min.y + B.h * dy, z = B.cz - B.d * .3;
      const pts = [[0, 0, 0], [sd * B.h * .02, B.h * .06, -B.h * .08], [sd * B.h * .05, B.h * .09, -B.h * .2], [sd * B.h * .08, B.h * .08, -B.h * .3]];
      const pipe = add(c, c.g, new THREE.Mesh(own(c, K.taper(pts, B.h * .028, B.h * .022, { radial: 8, seg: 12, ends: 'flat' })), tm), x, y, z);
      const mouth = add(c, c.g, new THREE.Mesh(geoU(c, 'bell', () => { const g = L.lathe([[.5, 0], [.9, .5], [1, 1], [.8, 1], [.4, .1]], 12); g.rotateX(-Math.PI / 2); return g; }), bell), x + pts[3][0], y + pts[3][1], z + pts[3][2]);
      mouth.scale.setScalar(B.h * .06); mouth.rotation.x = .12;
      const f = K.flame(c.ctx, c.g, { r: B.h * .035, h: B.h * .22, c1: c.tint, c2: '#fff4d0' }); f.group.position.set(x + pts[3][0], y + pts[3][1], z + pts[3][2] - B.h * .02); f.group.rotation.x = -1.35; jets.push(f);
    });
    gl.position.set(B.cx, B.min.y + B.h * .6, B.cz - B.d * .55); c.g.add(gl);
    const smoke = K.sparks(c.ctx, c.g, { n: 10, color: '#8a8f99', size: B.h * .06, rise: B.h * .12, spread: B.w * .5, at: [B.cx, B.min.y + B.h * .62, B.cz - B.d * .7], life: 2.2, opacity: .3, smoke: true });
    ext(c, B.r * 1.15, B.max.y);
    c.ups.push((dt, t, calm) => { jets.forEach((f, i) => f.update(t, calm ? .9 : 1, i * 2)); gl.material.opacity = .18 + (calm ? 0 : Math.sin(t * 6) * .04); smoke.update(dt, t, calm ? .05 : .5); });
  };
  M.cage = c => {
    const B = c.B, tm = trimM(c, '#b99b5a', { rough: .35 }), gm = glowM(c, c.tint, 1.3), R = B.r * 1.12 + B.h * .03, top = B.max.y + B.h * .12, bar = geoU(c, 'bar', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 6); g.translate(0, .5, 0); return g; });
    const fin = add(c, c.g, new THREE.Mesh(shardG(c), gm), B.cx, top + B.h * .04, B.cz); fin.scale.setScalar(B.h * .05);
    const Y = new THREE.Vector3(0, 1, 0), tip = new THREE.Vector3(B.cx, top + B.h * .04, B.cz), dv = new THREE.Vector3();
    for (let i = 0; i < 5; i++) { // the front stays open: bars only on the sides and back
      const a = Math.PI / 2 + (.55 + i * ((TAU - 1.1) / 4)), x = B.cx + Math.cos(a) * R, z = B.cz + Math.sin(a) * R * .8, hgt = top - B.min.y;
      const b = add(c, c.g, new THREE.Mesh(bar, tm), x, B.min.y, z); b.scale.set(B.h * .008, hgt, B.h * .008);
      const sp = add(c, c.g, new THREE.Mesh(bar, tm), x, top, z); dv.set(tip.x - x, tip.y - top, tip.z - z); sp.scale.set(B.h * .006, dv.length(), B.h * .006); sp.quaternion.setFromUnitVectors(Y, dv.normalize()); sp.userData.noCast = true;
      const nd = add(c, c.g, new THREE.Mesh(sphG(c), gm), x, B.min.y + hgt * .5, z); nd.scale.setScalar(B.h * .018);
    }
    ext(c, R, top + B.h * .06);
    c.ups.push((dt, t, calm) => { fin.rotation.y = t * .8; });
  };
  M.rift = c => {
    const B = c.B, rng = U.mulberry32(c.seed ^ 0x7a), sm = K.basic(c.ctx, c.tint, .5, true, { side: THREE.DoubleSide }), dk = own(c, new THREE.MeshBasicMaterial({ color: new THREE.Color('#12061e'), transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false })), pl = geoU(c, 'plane', () => new THREE.PlaneGeometry(1, 1)), cube = geoU(c, 'cubeu', () => new THREE.BoxGeometry(1, 1, 1)), items = [];
    for (let i = 0; i < 9; i++) { const a = Math.PI * (.25 + rng() * 1.5), rr = B.r * (.95 + rng() * .5), h = B.h * (.25 + rng() * .5), m = add(c, c.g, new THREE.Mesh(pl, i % 3 ? sm : dk), B.cx + Math.cos(a) * rr, B.min.y + B.h * (.2 + rng() * .7), B.cz - Math.abs(Math.sin(a)) * rr * .8); m.scale.set(B.h * .012 + rng() * B.h * .02, h, 1); m.rotation.set(0, a, (rng() - .5) * .5); m.userData.noSil = true; m.userData.noCast = true; items.push({ m, ph: rng() * 6, sx: m.scale.x }); }
    const cubes = []; for (let i = 0; i < 7; i++) { const m = add(c, c.g, new THREE.Mesh(cube, i % 2 ? sm : dk), B.cx + (rng() - .5) * B.w * 1.6, B.min.y + B.h * (.15 + rng() * .8), B.cz - B.d * (.2 + rng() * .5)); m.scale.setScalar(B.h * (.02 + rng() * .035)); m.userData.noSil = true; cubes.push({ m, ph: rng() * 6, p: m.position.clone() }); }
    const gl = L.sprite(c.tint, B.h * 1.6, .18); gl.position.set(B.cx, B.cy, B.min.z - B.d * .2); c.g.add(gl); ext(c, B.r * 1.5, B.max.y + B.h * .1);
    c.ups.push((dt, t, calm) => { items.forEach(o => { const f = calm ? 1 : .5 + .5 * Math.sin(t * 3 + o.ph) * Math.sin(t * 1.3 + o.ph * 2); o.m.scale.x = o.sx * (.4 + f); o.m.visible = calm || f > .08; }); cubes.forEach(o => { o.m.position.x = o.p.x + (calm ? 0 : Math.sin(t * 2.2 + o.ph) * B.w * .02); o.m.position.y = o.p.y + (calm ? 0 : Math.sin(t * 1.1 + o.ph) * B.h * .03); o.m.rotation.set(t * .7 + o.ph, t * .5, 0); }); });
  };
  M.blades = c => {
    const B = c.B, tm = trimM(c, '#dfe6f2', { rough: .22 }), gm = glowM(c, c.tint, 1.5), items = [];
    for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, lvl = i < 2 ? .38 : .66, g = grp(c, B.cx + sd * (B.w * .5 + B.h * .07), B.min.y + B.h * lvl, B.cz - B.d * .1), a = add(c, g, new THREE.Mesh(kiteG(c), tm), 0, 0, 0), b = add(c, g, new THREE.Mesh(kiteG(c), gm), 0, 0, .012); a.scale.set(B.h * .5, B.h * .5, 1); b.scale.set(B.h * .5 * .4, B.h * .5 * .8, 1); g.rotation.z = -sd * (.25 + (i > 1 ? .2 : 0)); items.push({ g, y: g.position.y, ph: i * 1.3 }); }
    ext(c, B.r + B.h * .3, B.max.y);
    c.ups.push((dt, t, calm) => items.forEach(o => { o.g.position.y = o.y + (calm ? 0 : Math.sin(t * 1.4 + o.ph) * B.h * .02); }));
  };
  M.roots = c => {
    const B = c.B, rng = U.mulberry32(c.seed ^ 0x33), wood = bodyM(c, '#4a3a28', { rough: .8 }), leaf = glowM(c, c.tint, .9), items = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + rng() * .5, L2 = B.r * (1.1 + rng() * .5), pts = [[0, .06, 0], [Math.cos(a) * L2 * .35, .1 + rng() * .08, Math.sin(a) * L2 * .35], [Math.cos(a + .35) * L2 * .7, .08 + rng() * .1, Math.sin(a + .35) * L2 * .7], [Math.cos(a + .2) * L2, .16 + rng() * .1, Math.sin(a + .2) * L2]];
      const r = add(c, c.g, new THREE.Mesh(own(c, K.taper(pts, B.h * .028, B.h * .006, { radial: 6, seg: 14, ends: 'point' })), wood), B.cx, 0, B.cz);
      const lf = add(c, c.g, new THREE.Mesh(spikeG(c), leaf), B.cx + pts[3][0], pts[3][1], B.cz + pts[3][2]); lf.scale.set(B.h * .03, B.h * .08, B.h * .03); lf.rotation.set((rng() - .5) * .6, 0, (rng() - .5) * .6); items.push({ lf, ph: rng() * 6 });
    }
    ext(c, B.r * 1.5, B.max.y);
    c.ups.push((dt, t, calm) => items.forEach(o => { o.lf.rotation.z = calm ? 0 : Math.sin(t * 1.3 + o.ph) * .15; }));
  };
  M.crystals = c => {
    const B = c.B, rng = U.mulberry32(c.seed ^ 0x99), cm = glowM(c, c.tint, .85), cr = geoU(c, 'crystal', () => L.lathe([[0, 0], [.5, 0], [.55, .55], [.3, .85], [0, 1]], 6));
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (.2 + rng() * 1.6), rr = B.r * (.6 + rng() * .65), h = B.h * (.1 + rng() * .22), m = add(c, c.g, new THREE.Mesh(cr, cm), B.cx + Math.cos(a) * rr, 0, B.cz - Math.abs(Math.sin(a)) * rr * .9);
      m.scale.set(h * .35, h, h * .35); m.rotation.set((rng() - .5) * .7, rng() * TAU, (rng() - .5) * .7);
    }
    ext(c, B.r * 1.3, B.max.y);
  };
  M.tendrils = c => {
    const B = c.B, rng = U.mulberry32(c.seed ^ 0x21), dm = bodyM(c, '#1a1226', { rough: .5 }), items = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (.3 + i * .35), x = Math.cos(a) * B.r * .9, z = -Math.abs(Math.sin(a)) * B.r * .9 + B.cz * 0, H = B.h * (.55 + rng() * .4), cx = (rng() - .5) * B.h * .5;
      const pts = [[0, 0, 0], [cx * .4, H * .3, (rng() - .5) * .2], [cx, H * .6, (rng() - .5) * .3], [cx * .5 + (rng() - .5) * .3, H, (rng() - .5) * .2]];
      const g = grp(c, B.cx + x, .02, B.cz + z), m = add(c, g, new THREE.Mesh(own(c, K.taper(pts, B.h * .05, B.h * .006, { radial: 6, seg: 16, ends: 'point' })), dm), 0, 0, 0), tip = add(c, g, new THREE.Mesh(sphG(c), glowM(c, c.tint, 1.5)), pts[3][0], pts[3][1], pts[3][2]); tip.scale.setScalar(B.h * .024); items.push({ g, ph: rng() * 6 });
    }
    ext(c, B.r * 1.3, B.max.y);
    c.ups.push((dt, t, calm) => items.forEach(o => { o.g.rotation.z = calm ? 0 : Math.sin(t * .9 + o.ph) * .12; o.g.rotation.x = calm ? 0 : Math.cos(t * .7 + o.ph) * .08; }));
  };
  M.eyes = c => {
    const B = c.B, rng = U.mulberry32(c.seed ^ 0x65), white = K.basic(c.ctx, '#ffffff'), pup = own(c, new THREE.MeshBasicMaterial({ color: new THREE.Color(c.tint) })), items = [], cam = new THREE.Vector3();
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (.35 + rng() * 1.3), rr = B.r * (.85 + rng() * .35), g = grp(c, B.cx + Math.cos(a) * rr, B.min.y + B.h * (.2 + rng() * .75), B.cz - Math.abs(Math.sin(a)) * rr * .7), s = B.h * (.03 + rng() * .02);
      const e = add(c, g, new THREE.Mesh(sphG(c), white), 0, 0, 0); e.scale.setScalar(s); const p = add(c, g, new THREE.Mesh(sphG(c), pup), 0, 0, s * .72); p.scale.setScalar(s * .5); items.push({ g, e, ph: rng() * 6, nb: 2 + rng() * 3, y: g.position.y });
    }
    ext(c, B.r * 1.3, B.max.y);
    c.ups.push((dt, t, calm) => { const cm = c.ctx.view && c.ctx.view.camera; items.forEach(o => { if (cm) { cm.getWorldPosition(cam); o.g.lookAt(cam); } const bl = calm ? 1 : Math.max(.08, 1 - Math.max(0, Math.sin(t / o.nb * TAU * .3 + o.ph) - .95) * 18); o.e.scale.y = o.e.scale.x * bl; o.g.position.y = o.y + (calm ? 0 : Math.sin(t * .9 + o.ph) * B.h * .015); }); });
  };
  M.gears = c => {
    const B = c.B, tm = trimM(c, '#b99b5a', { rough: .38 }), rA = B.h * .2, rB = B.h * .14, y = B.min.y + B.h * .6, z = B.min.z - B.d * .12;
    const a = K.gearMesh(c.ctx, 'f-a' + Math.round(rA * 100), 14, rA * .84, rA, B.h * .04, tm, { n: 5, r: rA * .5, s: rA * .13 }), b = K.gearMesh(c.ctx, 'f-b' + Math.round(rB * 100), 10, rB * .84, rB, B.h * .04, tm);
    a.position.set(B.cx - rA * .62, y, z); b.position.set(B.cx + rB * .98, y + rA * .55, z); c.g.add(a, b);
    ext(c, B.r + rA, B.max.y);
    c.ups.push((dt, t, calm) => { a.rotation.z = calm ? 0 : t * .35; b.rotation.z = calm ? .2 : -t * .35 * 14 / 10 + .2; });
  };
  M.echo = c => {
    const B = c.B, heavy = B.meshes > 28 || c.inst.echoNative;
    if (heavy) { // too many meshes to duplicate cheaply: motion streaks instead
      const sm = K.basic(c.ctx, c.tint, .22, true, { side: THREE.DoubleSide }), pl = geoU(c, 'plane', () => new THREE.PlaneGeometry(1, 1));
      for (let i = 0; i < 4; i++) { const m = add(c, c.g, new THREE.Mesh(pl, sm), B.cx - B.w * (.5 + i * .12), B.min.y + B.h * (.3 + i * .12), B.cz - B.d * .3); m.scale.set(B.w * .4, B.h * .015, 1); m.userData.noSil = true; }
      return;
    }
    const ghosts = [], kids = c.ctx.rootKids();
    for (let i = 1; i <= 2; i++) {
      const gm = own(c, new THREE.MeshBasicMaterial({ color: new THREE.Color(c.tint), transparent: true, opacity: .2 / i + .04, blending: THREE.AdditiveBlending, depthWrite: false })), g = new THREE.Group();
      kids.forEach(k => g.add(k.clone(true)));
      g.traverse(o => { if (o.isMesh) { o.material = gm; o.castShadow = false; o.receiveShadow = false; } if (o.isSprite || o.isPoints || o.isLine) o.visible = false; o.userData.noSil = true; });
      c.g.add(g); ghosts.push({ g, gm, i, base: .2 / i + .04 });
    }
    ext(c, B.r + B.w * .5, B.max.y);
    c.ups.push((dt, t, calm) => ghosts.forEach(o => { const k = calm ? 0 : Math.sin(t * 1.2 + o.i) * .02; o.g.position.set(-B.w * .16 * o.i + k * B.w, B.h * .012 * o.i, -B.d * .08 * o.i); o.gm.opacity = o.base * (calm ? 1 : .75 + .25 * Math.sin(t * 2 + o.i * 2)); }));
  };
  M.elem = (c, kind) => {
    const B = c.B, at = [B.cx, B.min.y + B.h * .2, B.cz - B.d * .1];
    if (kind === 'flame') {
      const fl = [[-.5, .55], [.5, .42], [0, .86]].map(([dx, dy], i) => { const f = K.flame(c.ctx, c.g, { r: B.h * .045, h: B.h * .16, c1: c.tint, c2: '#fff0c0' }); f.group.position.set(B.cx + dx * B.w * .7, B.min.y + B.h * dy, B.cz - B.d * .4); return f; });
      const em = K.sparks(c.ctx, c.g, { n: 14, color: c.tint, size: B.h * .03, rise: B.h * .35, spread: B.w * .9, at, life: 2.2 });
      c.ups.push((dt, t, calm) => { fl.forEach((f, i) => f.update(t, calm ? .9 : 1, i * 1.7)); em.update(dt, t, calm ? .1 : .6); });
    } else if (kind === 'water') {
      const dr = K.sparks(c.ctx, c.g, { n: 14, color: c.tint, size: B.h * .035, rise: -B.h * .18, spread: B.w * 1.3, at: [B.cx, B.min.y + B.h * 1.0, B.cz - B.d * .1], life: 3, opacity: .75 }),
        gm = K.basic(c.ctx, c.tint, .5, true), bub = [0, 1, 2, 3, 4].map(i => { const m = add(c, c.g, new THREE.Mesh(sphG(c), gm), 0, 0, 0); m.scale.setScalar(B.h * (.018 + (i % 3) * .008)); m.userData.noSil = true; return m; });
      c.ups.push((dt, t, calm) => { dr.update(dt, t, calm ? .1 : .5); bub.forEach((m, i) => { const a = i / 5 * TAU + (calm ? 0 : t * .4); m.position.set(B.cx + Math.cos(a) * B.r * 1.1, B.min.y + B.h * (.2 + i * .15) + (calm ? 0 : Math.sin(t + i) * B.h * .02), B.cz - Math.abs(Math.sin(a)) * B.r * .8); }); });
    } else if (kind === 'bolt') {
      const lm = new THREE.LineBasicMaterial({ color: new THREE.Color(c.tint), transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }); own(c, lm);
      const lines = [0, 1, 2].map(i => { const g = new THREE.BufferGeometry(), n = 8; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); own(c, g); const l = new THREE.Line(g, lm); l.frustumCulled = false; l.userData.noSil = true; c.g.add(l); return { g, n, i }; });
      const sp = K.sparks(c.ctx, c.g, { n: 8, color: c.tint, size: B.h * .03, rise: B.h * .2, spread: B.w, at, life: 1.2 }); let acc = 9;
      const rebuild = () => lines.forEach(({ g, n, i }) => { const a = Math.PI * (.3 + i * .55), x0 = B.cx + Math.cos(a) * B.r * 1.15, z0 = B.cz - Math.abs(Math.sin(a)) * B.r * .8, p = g.attributes.position; for (let k = 0; k < n; k++) { const f = k / (n - 1); p.setXYZ(k, x0 + (Math.random() - .5) * B.w * .12 * (k > 0 && k < n - 1 ? 1 : 0), B.min.y + B.h * (1.05 - f * .95), z0 + (Math.random() - .5) * B.d * .12 * (k > 0 && k < n - 1 ? 1 : 0)); } p.needsUpdate = true; });
      rebuild(); c.ups.push((dt, t, calm) => { acc += dt; if (!calm && acc > .14) { acc = 0; rebuild(); lm.opacity = Math.random() < .25 ? .25 : .9; } sp.update(dt, t, calm ? 0 : .5); });
    } else if (kind === 'light') {
      const sp = K.sparks(c.ctx, c.g, { n: 14, color: c.tint, size: B.h * .035, rise: B.h * .3, spread: B.w * 1.1, at, life: 2.4 });
      const sm = K.basic(c.ctx, c.tint, .3, true, { map: L.shaftTex(), side: THREE.DoubleSide }), pl = geoU(c, 'plane', () => new THREE.PlaneGeometry(1, 1)), g = grp(c, B.cx, B.min.y + B.h * .5, B.min.z - B.d * .3);
      for (let i = 0; i < 7; i++) { const m = add(c, g, new THREE.Mesh(pl, sm), 0, 0, 0); m.scale.set(B.h * .07, B.h * .75, 1); m.rotation.z = (i / 6 - .5) * 2.2; m.userData.noSil = true; }
      c.ups.push((dt, t, calm) => { sp.update(dt, t, calm ? .1 : .6); g.rotation.z = calm ? 0 : Math.sin(t * .3) * .06; });
    } else { // dust / seeds / spores
      const sp = K.sparks(c.ctx, c.g, { n: 16, color: c.tint, size: B.h * .03, rise: B.h * .12, spread: B.w * 1.3, at, life: 4, opacity: .55, smoke: true });
      c.ups.push((dt, t, calm) => sp.update(dt, t, calm ? .05 : .4));
    }
    ext(c, B.r * 1.2, B.max.y + B.h * .1);
  };

  // ------------------------------------------------------------------ stage details (upgrade stages 1–4), by category
  const FRAG = { weapon: c => kiteG(c), shield: c => kiteG(c), pet: c => geoU(c, 'leaf', () => { const g = new THREE.SphereGeometry(1, 8, 6); g.scale(.35, 1, .1); return g; }), machine: c => geoU(c, 'cog', () => new THREE.CylinderGeometry(1, 1, .3, 8)), relic: c => geoU(c, 'tablet', () => L.chamferBox(.6, 1, .2, .06)), oddity: c => geoU(c, 'cubeu', () => new THREE.BoxGeometry(1, 1, 1)) };
  function stage(c) {
    const B = c.B, lvl = c.lvl, fam = c.fam, tm = trimM(c, '#b99b5a', { rough: .38 }), gm = glowM(c, c.tint, 1.3);
    if (lvl >= 1) { // brackets: two brass posts with a lit cap, either side of the base
      [-1, 1].forEach(sd => { const x = B.cx + sd * (B.r * 1.12 + B.h * .03), p = add(c, c.g, new THREE.Mesh(geoU(c, 'post', () => { const g = new THREE.CylinderGeometry(1, 1.3, 1, 8); g.translate(0, .5, 0); return g; }), tm), x, 0, B.cz - B.d * .1); p.scale.set(B.h * .026, B.h * .09, B.h * .026); const cap = add(c, c.g, new THREE.Mesh(sphG(c), gm), x, B.h * .105, B.cz - B.d * .1); cap.scale.setScalar(B.h * .026); });
    }
    if (lvl >= 2) { // a standing piece that suits the category, behind-left of the specimen
      const g = grp(c, B.cx - B.r * 1.05 - B.h * .06, 0, B.cz - B.d * .45), base = add(c, g, new THREE.Mesh(geoU(c, 'stonebase', () => L.chamferBox(1, .4, 1, .08)), trimM(c, '#6a645a', { rough: .6, metal: .2 })), 0, B.h * .02, 0); base.scale.set(B.h * .09, B.h * .04, B.h * .09);
      if (fam === 'relic') { const sl = add(c, g, new THREE.Mesh(new THREE.PlaneGeometry(B.h * .12, B.h * .22), K.basic(c.ctx, '#ffffff', 1, true, { map: K.runeTex(c.ctx, c.seed, 2, 5, 128, c.tint, { w: 128, h: 256 }), depthWrite: false })), 0, B.h * .17, 0); sl.userData.noSil = true; own(c, sl.geometry); }
      else if (fam === 'weapon' || fam === 'shield') { [-1, 1].forEach(sd => { const b = add(c, g, new THREE.Mesh(kiteG(c), tm), 0, B.h * .17, 0); b.scale.set(B.h * .24, B.h * .24, 1); b.rotation.z = sd * .45; }); }
      else if (fam === 'machine') { const m = add(c, g, new THREE.Mesh(geoU(c, 'mast', () => { const q = new THREE.CylinderGeometry(1, 1, 1, 6); q.translate(0, .5, 0); return q; }), tm), 0, B.h * .04, 0); m.scale.set(B.h * .008, B.h * .26, B.h * .008); const dish = add(c, g, new THREE.Mesh(geoU(c, 'dish', () => new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, 1.2)), tm), 0, B.h * .3, 0); dish.scale.setScalar(B.h * .05); dish.rotation.x = 2.6; }
      else if (fam === 'pet') { const m = add(c, g, new THREE.Mesh(geoU(c, 'mast', () => { const q = new THREE.CylinderGeometry(1, 1, 1, 6); q.translate(0, .5, 0); return q; }), tm), 0, B.h * .04, 0); m.scale.set(B.h * .008, B.h * .24, B.h * .008); const lamp = add(c, g, new THREE.Mesh(sphG(c), gm), 0, B.h * .29, 0); lamp.scale.setScalar(B.h * .035); }
      else { for (let i = 0; i < 3; i++) { const s = add(c, g, new THREE.Mesh(spikeG(c), gm), (i - 1) * B.h * .035, B.h * .04, 0); s.scale.set(B.h * .012, B.h * (.16 + i % 2 * .06), B.h * .012); s.rotation.z = (i - 1) * .22; } }
    }
    if (lvl >= 3) { // five fragments drifting in the back half
      const fg = FRAG[fam](c), fm = fam === 'oddity' ? gm : tm, items = [];
      for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(fg, i % 2 ? fm : gm); m.scale.setScalar(B.h * (fam === 'machine' ? .05 : .06)); if (fam === 'weapon' || fam === 'shield') m.scale.set(B.h * .13, B.h * .13, 1); c.g.add(m); items.push({ m, a: Math.PI * (1.1 + i * .2), y: B.min.y + B.h * (.35 + (i % 3) * .2) }); }
      const rx = B.r * 1.15 + B.h * .08;
      c.ups.push((dt, t, calm) => items.forEach((o, i) => { const a = o.a + (calm ? 0 : Math.sin(t * .35 + i) * .22); o.m.position.set(B.cx + Math.cos(a) * rx, o.y + (calm ? 0 : Math.sin(t * 1.1 + i) * B.h * .02), B.cz + Math.sin(a) * rx * .7); o.m.rotation.set(t * .4, t * .6 + i, 0); }));
      ext(c, rx, B.max.y);
    }
    if (lvl >= 4) { // signature mantle: five broad plates fanned behind the specimen, each with a thin lit edge
      const g = grp(c, B.cx, B.min.y + B.h * .5, B.min.z - B.d * .3), pm = trimM(c, L.mix('#3a3a46', c.tint, .18), { rough: .4 }), em = K.basic(c.ctx, c.tint, .55, true), pg = geoU(c, 'mantle', () => L.extrude([[-.5, -.5], [.5, -.5], [.46, .35], [0, .6], [-.46, .35]], .04, .008, { bevelSeg: 1 })), edge = geoU(c, 'edgeplane', () => new THREE.PlaneGeometry(1, 1));
      for (let i = 0; i < 5; i++) { const a = (i / 4 - .5) * 1.7, pl = new THREE.Group(); pl.rotation.z = -a; pl.position.y = -B.h * .08; const p = new THREE.Mesh(pg, pm); p.scale.set(B.h * .2, B.h * .5, 1); p.position.y = B.h * .26; const e = new THREE.Mesh(edge, em); e.scale.set(B.h * .012, B.h * .46, 1); e.position.set(0, B.h * .27, .03); e.userData.noSil = true; pl.add(p, e); g.add(pl); }
      c.ups.push((dt, t, calm) => { g.rotation.z = calm ? 0 : Math.sin(t * .4) * .015; });
      ext(c, B.h * .4, B.max.y + B.h * .05);
    }
  }

  // ------------------------------------------------------------------ entry point
  FM.apply = function (ctx, inst) {
    const spec = ctx.spec, arch = spec && spec.base && PR().ARCH[spec.base]; if (!arch || !inst || !inst.root) return;
    const lvl = ctx.level || 0, form = spec.form ? PR().form(spec.form) : null; if (!lvl && !form) return;
    if (form && form.item !== spec.base) return;
    const B = bounds(inst.root); if (!B || B.h < 0.05) return;
    const g = new THREE.Group(); g.name = 'p3-forms'; inst.root.add(g);
    const c = { ctx, inst, g, B, fam: arch.fam, tint: form ? form.tint : ctx.item.pal[1], F: ctx.F, ups: [], lvl, form, seed: (spec.seed >>> 0) || 1, ext: { r: 0, h: 0 } };
    ctx.rootKids = () => inst.root.children.filter(k => k !== g);
    try {
      if (lvl) stage(c);
      if (form) form.motifs.forEach(m => { const [name, arg] = m.split(':'); const fn = M[name]; if (fn) fn(c, arg); });
    } catch (e) { console.warn('[forms]', e); }
    g.traverse(o => { o.userData.noCast = true; }); // accessories never cast shadows: halves their draw calls on Medium/High
    if (!c.ups.length) return;
    const u0 = inst.update; inst.update = (dt, t, st) => { if (u0) u0(dt, t, st); const calm = !!(st && st.reduced); for (let i = 0; i < c.ups.length; i++) c.ups[i](dt, t, calm); };
    if (inst.frame) { const f = inst.frame; f.r = Math.max(f.r, Math.min(c.ext.r, f.r * 1.45)); f.h = Math.max(f.h, Math.min(c.ext.h, f.h * 1.3)); }
  };
})();
