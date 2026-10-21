/* AETHERVAULT — shared modelling kit (Phase Two). Reusable procedural parts so every new collectible is assembled, not hand-sculpted:
 *   organic   K.taper (tapered tube: limbs, tails, horns, necks) · K.skin/K.ball/K.shade (metaball skins) · K.wing · K.flame · K.sparks
 *   creature  K.face (eyes/brows/mouth/cheeks on any skin) · K.mood (blink, look-at, hop, settle — one behaviour model for every pet)
 *   hard      K.gearMesh · K.rivets · K.runeTex (engraved glyph sheets) · K.basic (additive/unlit helper that registers disposal)
 *   upgrade   K.stageFx — the L1–L4 stage additions (ring + sparks · orbit shards · halo arcs · rays + core) and potential motes/core
 * Everything is geometry-cached through ctx.geo and disposed by the View; nothing here owns a render loop. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, TAU = Math.PI * 2, clamp = U.clamp;
  const K = (S.kit = {});

  // ------------------------------------------------------------------ small helpers
  /** Unlit / additive material that registers itself for disposal with the model. */
  K.basic = (ctx, color, opacity = 1, additive = false, o = {}) => { const m = new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(color), transparent: opacity < 1 || additive, opacity, depthWrite: !additive && opacity >= 1, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }, o)); ctx.disposables.push(m); return m; };
  K.mesh = (geo, mat, parent, pos, rot) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); if (parent) parent.add(m); return m; };
  K.noSil = o => { o.traverse(c => { c.userData.noSil = true; c.userData.noCast = true; }); return o; };
  const unitSphere = ctx => ctx.geo('unit-sphere', () => new THREE.SphereGeometry(1, 28, 20));
  K.unitSphere = unitSphere;

  // ------------------------------------------------------------------ organic: tapered tube
  /** Tapered tube along a Catmull-Rom path. o: { radial, seg, tension, ends:'round'|'point'|'flat', profile(t)→scale }. */
  K.taper = function (pts, r0, r1, o = {}) {
    const radial = o.radial || 10, seg = o.seg || 24, ends = o.ends || 'round', prof = o.profile || (() => 1);
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', o.tension == null ? .5 : o.tension);
    const P = [], T = curve.computeFrenetFrames(seg, false); for (let i = 0; i <= seg; i++) P.push(curve.getPointAt(i / seg));
    return L.paramSurface(radial, seg, (u, v, out) => {
      const j = Math.round(v * seg), t = j / seg, a = u * TAU, p = P[j], n = T.normals[j], b = T.binormals[j], ca = Math.cos(a), sa = Math.sin(a);
      let r = (r0 + (r1 - r0) * t) * prof(t);
      if (ends === 'round') { const e = .06; if (t < e) r *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - t / e, 2))); else if (t > 1 - e) r *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - (1 - t) / e, 2))); }
      else if (ends === 'point') { if (t > .9) r *= (1 - t) / .1; }
      out.set(p.x + (n.x * ca + b.x * sa) * r, p.y + (n.y * ca + b.y * sa) * r, p.z + (n.z * ca + b.z * sa) * r);
    }, true);
  };

  // ------------------------------------------------------------------ organic: metaball skins
  const KK = 1 / .54;
  K.ball = (x, y, z, vr, sx = 1, sy = 1, sz = 1, w = 1) => ({ x, y, z, r: vr * KK, w, sx, sy, sz });
  const ballBounds = balls => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; balls.forEach(b => { if (b.w < 0) return; const r = b.r * .8; [[b.x, b.sx], [b.y, b.sy], [b.z, b.sz]].forEach(([c, s], i) => { mn[i] = Math.min(mn[i], c - r * s); mx[i] = Math.max(mx[i], c + r * s); }); }); return { mn, mx }; };
  /** Cached skin geometry. o: { cs (cell size), iso, noise, noiseScale, colorFn }. geometry.userData.field is the implicit field (for face placement). */
  K.skin = (ctx, key, balls, o = {}) => ctx.geo('kskin:' + key, () => { const { mn, mx } = ballBounds(balls), cs = o.cs || .05, cells = [0, 1, 2].map(i => Math.min(90, Math.max(4, Math.ceil((mx[i] - mn[i]) / cs)))); return L.blobSkin(balls, { min: mn, max: mx }, cells, Object.assign({ iso: .5, noiseScale: 5, seed: key.length * 31 + 7 }, o)); });
  /** Vertex-colour shader for skins: lighter on top, darker underneath, ambient-occlusion in creases, optional belly colour. */
  K.shade = (col, belly) => (x, y, z, nx, ny, nz, fv, field) => {
    const top = .5 + .5 * ny, out = field(x + nx * .1, y + ny * .1, z + nz * .1), ao = clamp(out * 3.2, 0, 1);
    let l = (col.bot + (col.top - col.bot) * Math.pow(top, .75) + Math.max(0, nz) * .05) * (1 - .5 * ao), r = l, g = l, b = l;
    if (belly) { const k = clamp((-ny - (belly.k == null ? .2 : belly.k)) * 2.2, 0, 1) * (belly.amt || .7); r = r * (1 - k) + belly.c[0] * l * k; g = g * (1 - k) + belly.c[1] * l * k; b = b * (1 - k) + belly.c[2] * l * k; }
    return [r * (1 - ao * .06), g * (1 - ao * .03), Math.min(1.2, b + (1 - top) * (col.blue || 0) + ao * .05)];
  };
  K.frontPoint = (field, x, y, iso = .5, zMax = 2.4, zMin = -.4) => { for (let z = zMax; z > zMin; z -= .02) if (field(x, y, z) > iso) { let a = z + .02, b = z; for (let i = 0; i < 7; i++) { const m = (a + b) / 2; if (field(x, y, m) > iso) b = m; else a = m; } return (a + b) / 2; } return null; };
  K.surfaceNormal = (field, x, y, z) => { const e = .03; return new THREE.Vector3(field(x - e, y, z) - field(x + e, y, z), field(x, y - e, z) - field(x, y + e, z), field(x, y, z - e) - field(x, y, z + e)).normalize(); };

  // ------------------------------------------------------------------ creature: face + behaviour
  /** Face on a skin. f: { eye:{y,dx,s,tilt,shape:'round'|'calm'|'angry'|'sleepy'}, mouth:{y,w,kind:'smile'|'tiny'|'fang'|'smirk'|'flat'}, nose:{y,s}, cheek:{y,dx}, brow:'soft'|'hard'|null, iso }. */
  K.face = function (ctx, field, f, parent) {
    const F = ctx.F, iso = f.iso || .5, dark = F.plain('#130e26', { rough: .2, metal: 0, clearcoat: 1, ccRough: .05, env: 1.6 }), white = K.basic(ctx, 0xffffff), sph = unitSphere(ctx), g = new THREE.Group(); parent.add(g);
    const E = f.eye, eyes = [], happy = [];
    [-1, 1].forEach(sd => {
      const x = sd * E.dx, zf = K.frontPoint(field, x, E.y, iso); if (zf == null) return;
      const n = K.surfaceNormal(field, x, E.y, zf), eg = new THREE.Group(); eg.position.set(x, E.y, zf - .012); eg.lookAt(eg.position.clone().add(n));
      const inner = new THREE.Group(); eg.add(inner);
      const ew = E.shape === 'angry' ? 1.05 : E.shape === 'calm' || E.shape === 'sleepy' ? 1.25 : .92, eh = E.shape === 'angry' ? .78 : E.shape === 'calm' ? .8 : E.shape === 'sleepy' ? .5 : 1.22;
      const eye = new THREE.Mesh(sph, dark); eye.scale.set(E.s * ew, E.s * eh, E.s * .55); inner.add(eye);
      const hl = [], h1 = new THREE.Mesh(sph, white), h2 = new THREE.Mesh(sph, white); h1.scale.setScalar(E.s * .3); h1.position.set(-E.s * .28, E.s * .36 * eh, E.s * .45); h2.scale.setScalar(E.s * .14); h2.position.set(E.s * .22, -E.s * .3 * eh, E.s * .42); inner.add(h1, h2); hl.push(h1, h2);
      inner.rotation.z = sd * (E.tilt || 0); g.add(eg); eyes.push({ g: eg, inner, eye, hl, sd, base: eye.scale.y });
    });
    eyes.forEach(e => { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8 * Math.PI; pts.push([Math.cos(t) * E.s * 1.1, Math.sin(t) * E.s * .9, 0]); } const m = new THREE.Mesh(L.tube(pts, .014, 12, 6), dark); m.visible = false; e.g.add(m); happy.push(m); });
    if (f.cheek) [-1, 1].forEach(sd => { const x = sd * f.cheek.dx, zf = K.frontPoint(field, x, f.cheek.y, iso); if (zf == null) return; const c = L.sprite('#ff9ab8', .22, .45); c.position.set(x, f.cheek.y, zf + .02); g.add(c); });
    let mouth = null; const M = f.mouth, mz = M ? K.frontPoint(field, 0, M.y, iso) : null;
    if (M && mz != null) {
      mouth = new THREE.Group(); mouth.position.set(0, M.y, mz - .006); mouth.lookAt(mouth.position.clone().add(K.surfaceNormal(field, 0, M.y, mz))); g.add(mouth); const w = M.w;
      if (M.kind === 'fang') { mouth.add(new THREE.Mesh(L.tube([[-w * 1.2, .02, 0], [-w * .8, -.03, 0], [-w * .4, .03, 0], [0, -.035, 0], [w * .4, .03, 0], [w * .8, -.03, 0], [w * 1.2, .02, 0]], .016, 24, 6), dark)); }
      else if (M.kind === 'flat') mouth.add(new THREE.Mesh(L.tube([[-w, 0, 0], [w, 0, 0]], .014, 8, 6), dark));
      else if (M.kind === 'smirk') mouth.add(new THREE.Mesh(L.tube([[-w, -.012, 0], [-w * .3, -.022, 0], [w * .4, -.006, 0], [w, .02, 0]], .014, 18, 6), dark));
      else mouth.add(new THREE.Mesh(L.tube([[-w, .012, 0], [-w * .5, -.018, 0], [0, -.026, 0], [w * .5, -.018, 0], [w, .012, 0]], M.kind === 'tiny' ? .011 : .014, 18, 6), dark));
    }
    let nose = null; if (f.nose) { const nz = K.frontPoint(field, 0, f.nose.y, iso); if (nz != null) { nose = new THREE.Mesh(sph, dark); nose.scale.set(f.nose.s * 1.3, f.nose.s, f.nose.s); nose.position.set(0, f.nose.y, nz); g.add(nose); } }
    const brows = [];
    if (f.brow) [-1, 1].forEach(sd => {
      const x = sd * E.dx, y = E.y + E.s * 1.75, zf = K.frontPoint(field, x, y, iso); if (zf == null) return; const hard = f.brow === 'hard', w = E.s * (hard ? 1.8 : 1.3);
      const b = new THREE.Group(); b.position.set(x, y, zf - .004); b.lookAt(b.position.clone().add(K.surfaceNormal(field, x, y, zf))); b.rotateZ(hard ? sd * .5 : sd * .06);
      b.add(new THREE.Mesh(L.tube([[-w, 0, 0], [0, hard ? -.008 : .012, 0], [w, 0, 0]], hard ? .019 : .012, 12, 6), dark)); g.add(b); brows.push(b);
    });
    return {
      group: g, eyes, mouth, nose, brows, dark,
      update(A) { eyes.forEach(e => { const open = A.delight > 0 ? 0 : (A.blink > 0 ? .08 : (1 - A.settle * .45)) * (1 + A.wide * .3); e.eye.scale.y = e.base * Math.max(.08, open); e.hl.forEach(h => (h.visible = open > .5)); e.eye.visible = A.delight <= 0; e.inner.position.x = A.look.x * .045; e.inner.position.y = A.look.y * .05; }); happy.forEach(h => (h.visible = A.delight > 0)); if (mouth) mouth.scale.y = A.delight > 0 ? 1.8 : 1; },
    };
  };
  /** One behaviour model for every companion: blink timer, cursor look-at (smoothed), click hop + squash, delight bounce, settle-when-idle. */
  K.mood = () => {
    const A = { blink: 0, nextBlink: 2 + Math.random() * 3, delight: 0, wide: 0, hop: 99, look: new THREE.Vector2(), settle: 0, hopY: 0, sq: 1, dance: 0 };
    A.react = k => { if (k === 'click') { A.hop = 0; A.wide = .6; } else if (k === 'delight') { A.delight = 2.4; A.hop = 0; } };
    A.step = (dt, st, calm) => {
      const idle = st.idle, target = idle > 20 ? clamp((idle - 20) / 6, 0, 1) : 0; A.settle += (target - A.settle) * .05;
      if (!calm) { A.nextBlink -= dt; if (A.nextBlink <= 0) { A.blink = .16; A.nextBlink = 2.4 + Math.random() * 4; if (Math.random() < .2) A.nextBlink = .25; } }
      A.blink = Math.max(0, A.blink - dt); A.delight = Math.max(0, A.delight - dt); A.hop += dt; A.wide = Math.max(0, A.wide - dt);
      const tx = calm ? 0 : st.pointer.x * .5 * (st.hover ? 1 : .35), ty = calm ? 0 : -st.pointer.y * .22 * (st.hover ? 1 : .35); A.look.x += (tx - A.look.x) * .08; A.look.y += (ty - A.look.y) * .08;
      A.hopY = (A.hop < .9 ? Math.sin(A.hop / .9 * Math.PI) * (.22 + (A.delight > 0 ? .1 : 0)) : 0) + (A.delight > 0 ? Math.abs(Math.sin(A.delight * 5)) * .1 : 0);
      A.sq = A.hop < .9 ? 1 - Math.sin(Math.min(1, A.hop / .25) * Math.PI) * .1 : 1;
    };
    return A;
  };

  // ------------------------------------------------------------------ organic: wing, flame, sparks
  /** Bat/drake wing in the XY plane, root at origin, spanning +x. Returns { group, arm, hand }; flap by rotating arm.z and hand.z. */
  K.wing = function (ctx, o) {
    const { span, chord, bone, mem, boneMat } = o, fingers = o.fingers || 3, g = new THREE.Group(), arm = new THREE.Group(), hand = new THREE.Group(); g.add(arm);
    const ex = span * .42, ey = chord * .4;
    arm.add(new THREE.Mesh(K.taper([[0, 0, 0], [ex * .5, ey * .75, 0], [ex, ey, 0]], bone * 1.15, bone * .85, { radial: 6, seg: 8 }), boneMat));
    const am = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(ex, ey), new THREE.Vector2(ex * .96, -chord * .15), new THREE.Vector2(ex * .45, -chord * .36), new THREE.Vector2(0, -chord * .3)]);
    arm.add(new THREE.Mesh(new THREE.ShapeGeometry(am), mem)); hand.position.set(ex, ey, 0); arm.add(hand);
    const tips = [], rest = span - ex;
    for (let i = 0; i < fingers; i++) { const a = .5 - i * (1.05 / Math.max(1, fingers - 1)), len = rest * (1 - i * .16), tx = Math.cos(a) * len, ty = Math.sin(a) * len * .8 - i * chord * .12; tips.push([tx, ty]); hand.add(new THREE.Mesh(K.taper([[0, 0, 0], [tx * .5, ty * .5 + .05, 0], [tx, ty, 0]], bone * .8, bone * .3, { radial: 5, seg: 8, ends: 'point' }), boneMat)); }
    const pts = [new THREE.Vector2(0, 0)]; tips.forEach((t, i) => { if (i) { const p = tips[i - 1]; pts.push(new THREE.Vector2((p[0] + t[0]) / 2 * .8, (p[1] + t[1]) / 2 * .8)); } pts.push(new THREE.Vector2(t[0], t[1])); }); pts.push(new THREE.Vector2(-ex * .1, -chord * .5));
    hand.add(new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), mem));
    return { group: g, arm, hand };
  };
  /** Stylised flame (outer + inner additive tear-drops + soft glow). update(t, k) flickers; k scales intensity. */
  K.flame = function (ctx, parent, o) {
    const g = new THREE.Group(), prof = (s) => [[0, 0], [.5, .12], [.86, .38], [.72, .7], [.34, .92], [0, 1]].map(([x, y]) => [x * o.r * s, y * o.h * s]);
    const outer = new THREE.Mesh(L.lathe(prof(1), 14), K.basic(ctx, o.c1, .78, true)), inner = new THREE.Mesh(L.lathe(prof(.55), 12), K.basic(ctx, o.c2, .95, true)); inner.position.y = o.h * .04;
    const glow = L.sprite(o.c1, o.r * 5, .55); glow.position.y = o.h * .4; g.add(outer, inner, glow); K.noSil(g); parent.add(g);
    return { group: g, update(t, k = 1, seed = 0) { const f = 1 + .14 * Math.sin(t * 11 + seed) + .07 * Math.sin(t * 17.3 + seed * 2); outer.scale.set(1 - (f - 1) * .5, f * k, 1 - (f - 1) * .5); inner.scale.set(1, (1 + .1 * Math.sin(t * 13 + seed)) * k, 1); g.rotation.z = Math.sin(t * 5 + seed) * .06; glow.material.opacity = (.4 + .15 * Math.sin(t * 9 + seed)) * clamp(k, .3, 1.5); } };
  };
  /** Small rising particle emitter (embers, smoke, spores). Returns { points, update(dt, t, rate) }. */
  K.sparks = function (ctx, parent, o) {
    const n = Math.max(4, Math.round((o.n || 14) * ctx.q.particles)), pos = new Float32Array(n * 3), life = new Float32Array(n), vel = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ map: L.dotTex(), color: new THREE.Color(o.color || '#ffb060'), size: o.size || .06, transparent: true, opacity: o.opacity || .85, blending: o.smoke ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false }); ctx.disposables.push(m);
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.noSil = true; parent.add(pts); const src = o.at || [0, 0, 0], sp = o.spread || .12, up = o.rise || .5;
    for (let i = 0; i < n; i++) { life[i] = Math.random(); pos[i * 3 + 1] = -99; }
    const respawn = i => { pos[i * 3] = src[0] + (Math.random() - .5) * sp; pos[i * 3 + 1] = src[1]; pos[i * 3 + 2] = src[2] + (Math.random() - .5) * sp; vel[i * 3] = (Math.random() - .5) * .15; vel[i * 3 + 1] = up * (.6 + Math.random() * .8); vel[i * 3 + 2] = (Math.random() - .5) * .15; life[i] = 1; };
    return { points: pts, update(dt, t, rate = 1) { for (let i = 0; i < n; i++) { life[i] -= dt / (o.life || 1.6); if (life[i] <= 0) { if (rate > 0 && Math.random() < rate * dt * 3) respawn(i); else { pos[i * 3 + 1] = -99; life[i] = 0; continue; } } pos[i * 3] += vel[i * 3] * dt + Math.sin(t * 3 + i) * .002; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; } g.attributes.position.needsUpdate = true; m.opacity = (o.opacity || .85); } };
  };

  // ------------------------------------------------------------------ hard-surface helpers
  /** Gear (cached extrusion). teeth, rIn, rOut, depth, optional lightening holes {n,r,s}. */
  K.gearMesh = function (ctx, key, teeth, rIn, rOut, depth, mat, holes) {
    const geo = ctx.geo('kgear:' + key, () => { const pts = [], step = TAU / teeth; for (let i = 0; i < teeth; i++) { const a = i * step; [[0, rIn], [.14, rIn], [.2, rOut], [.46, rOut], [.52, rIn]].forEach(([k, r]) => pts.push([Math.cos(a + k * step) * r, Math.sin(a + k * step) * r])); }
      const hs = []; if (holes) for (let i = 0; i < holes.n; i++) { const a = i / holes.n * TAU, cx = Math.cos(a) * holes.r, cy = Math.sin(a) * holes.r, h = []; for (let k = 0; k < 14; k++) { const b = -k / 14 * TAU; h.push([cx + Math.cos(b) * holes.s, cy + Math.sin(b) * holes.s]); } hs.push(h); }
      return L.extrude(pts, depth, Math.min(.02, depth * .2), { holes: hs, bevelSeg: 1, curveSeg: 4 }); });
    return new THREE.Mesh(geo, mat);
  };
  /** Row of small round rivets along a line (instanced, one draw call). */
  K.rivets = function (ctx, mat, from, to, n, r = .014) {
    const geo = ctx.geo('krivet:' + r, () => new THREE.SphereGeometry(r, 6, 5)), im = new THREE.InstancedMesh(geo, mat, n), m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1); m.makeTranslation(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t); im.setMatrixAt(i, m); }
    return im;
  };
  /** Sheet of pseudo-runes (seeded strokes) on a transparent canvas — engraved/lit glyph columns for tablets, tags and runic bands. */
  K.runeTex = function (ctx, seed, cols, rows, size, color = '#bff', o = {}) {
    const w = o.w || size, h = o.h || size, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), r = U.mulberry32(seed || 1);
    x.strokeStyle = color; x.lineWidth = o.line || Math.max(2, w / (cols * 14)); x.lineCap = 'round'; x.lineJoin = 'round';
    const cw = w / cols, ch = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { if (r() < (o.gap == null ? .12 : o.gap)) continue; const px = i * cw + cw / 2, py = j * ch + ch / 2, k = 3 + Math.floor(r() * 3); x.beginPath(); for (let n = 0; n < k; n++) { const sx = px + (r() - .5) * cw * .62, sy = py + (r() - .5) * ch * .7; if (n) x.lineTo(sx, sy); else x.moveTo(sx, sy); } x.stroke(); if (r() < .3) { x.beginPath(); x.arc(px + (r() - .5) * cw * .4, py + (r() - .5) * ch * .5, cw * .07, 0, TAU); x.stroke(); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ctx.tex.push(t); return t;
  };

  // ------------------------------------------------------------------ upgrade stages + potential (shared by every new model)
  /** Adds the stage additions as REAL geometry around the model and returns update(dt,t,calm).
   *  o: { r (radius of the staging), h (height), color, y0 (base height), core:[x,y,z] (where the sleeping core sits), bolt:false } */
  K.stageFx = function (ctx, parent, o) {
    const F = ctx.F, lvl = ctx.level, g = new THREE.Group(), r = o.r, h = o.h, y0 = o.y0 || 0, col = o.color || ctx.rc; g.position.y = y0; g.name = 'stagefx'; parent.add(g);
    const glow = F.make('glow', { color: col, glow: 1.3 }), parts = { orbit: [], sparks: [], arcs: null, ring: null, rays: null, core: null, pot: null, sleep: null, runes: null };
    const shard = ctx.geo('kshard', () => { const s = new THREE.OctahedronGeometry(.07, 0); s.scale(.6, 1.5, .6); return s; });
    if (lvl >= 1) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * .86, .018, 6, 72), glow); ring.rotation.x = Math.PI / 2; ring.position.y = .04; ring.userData.stageRing = true; g.add(ring); parts.ring = ring; for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(shard, glow); g.add(s); parts.sparks.push({ m: s, a: i / 3 * TAU }); } }
    if (lvl >= 2) for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(shard, F.trim(col, { rough: .2, plain: true })); s.scale.setScalar(1.5); g.add(s); parts.orbit.push({ m: s, a: i / 3 * TAU, sp: .5 + i * .13, y: h * (.42 + i * .1) }); }
    if (lvl >= 3) { const hg = new THREE.Group(); hg.position.set(0, h * .62, -r * .75); for (let i = 0; i < 6; i++) { const arc = new THREE.Mesh(new THREE.TorusGeometry(r * .78, .024, 6, 24, .62), glow); arc.rotation.z = i / 6 * TAU; hg.add(arc); } hg.add(new THREE.Mesh(new THREE.TorusGeometry(r * .62, .012, 6, 60), glow)); g.add(hg); parts.arcs = hg; }
    if (lvl >= 4) {
      const rg = new THREE.Group(); rg.position.set(0, h * .6, -r * .9);
      for (let i = 0; i < 11; i++) { const a = (i / 11 - .5) * 3, m = new THREE.Mesh(new THREE.PlaneGeometry(.07, h * .5), K.basic(ctx, col, .5, true, { map: L.shaftTex(), side: THREE.DoubleSide })); m.position.set(Math.sin(a) * r * 1.08, h * .12 * Math.cos(a), 0); m.rotation.z = -a; m.scale.y = 1 + (i % 3) * .3; rg.add(m); } K.noSil(rg); g.add(rg); parts.rays = rg;
      const core = L.sprite('#fff6d0', r * 1.2, .4); core.position.set(0, h * .45, .1); core.material.depthTest = false; core.renderOrder = 5; g.add(core); parts.core = core;
    }
    const pot = ctx.potentialTier;
    if (pot >= 1) { const n = Math.round(14 * ctx.q.particles), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, rr = r * (.35 + Math.random() * .7); pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = h * (.2 + Math.random() * .7); pos[i * 3 + 2] = Math.sin(a) * rr * .8; } const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.PointsMaterial({ map: L.dotTex(), color: new THREE.Color(col), size: .07, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }); ctx.disposables.push(m); const pts = new THREE.Points(gg, m); pts.userData.noSil = true; pts.userData.base = pos.slice(); pts.frustumCulled = false; g.add(pts); parts.pot = pts; }
    if (pot >= 2) { const sg = L.sprite(ctx.rc, r * .9, .24); const c = o.core || [0, h * .4, .05]; sg.position.set(c[0], c[1] - y0, c[2]); sg.material.depthTest = false; sg.renderOrder = 4; g.add(sg); parts.sleep = sg;
      if ((ctx.item && ctx.item.evolves || []).length) { const rg = new THREE.Group(); rg.position.set(0, h + .25, 0); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.045, 0), glow); m.userData.a = i / 3 * TAU; rg.add(m); } g.add(rg); parts.runes = rg; } }
    return {
      group: g,
      update(dt, t, calm) {
        if (parts.ring) parts.ring.material.opacity = 1;
        parts.sparks.forEach(s => { const a = s.a + t * .6; s.m.position.set(Math.cos(a) * r * .86, .14 + Math.sin(t * 1.7 + s.a) * .05, Math.sin(a) * r * .86); s.m.rotation.y = a * 2; });
        parts.orbit.forEach(o2 => { const a = o2.a + t * o2.sp; o2.m.position.set(Math.cos(a) * r, o2.y + Math.sin(t * 1.3 + o2.a) * .06, Math.sin(a) * r * .8); o2.m.rotation.set(Math.sin(t + o2.a) * .3, -a, 0); });
        if (parts.arcs) parts.arcs.rotation.z += dt * .15; if (parts.rays) parts.rays.rotation.z = Math.sin(t * .3) * .05; if (parts.core) parts.core.material.opacity = .26 + Math.sin(t * 1.4) * .1;
        if (parts.pot) { const p = parts.pot.geometry.attributes.position, b = parts.pot.userData.base; for (let i = 0; i < p.count; i++) { p.array[i * 3] = b[i * 3] + Math.sin(t * .6 + i) * .08; p.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * .8 + i * 1.7) * .1; p.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(t * .5 + i) * .08; } p.needsUpdate = true; }
        if (parts.sleep) parts.sleep.material.opacity = .14 + (Math.sin(t * .9) * .5 + .5) * .16;
        if (parts.runes) parts.runes.children.forEach(m => { const a = m.userData.a + t * .8; m.position.set(Math.cos(a) * .22, Math.sin(t * 1.6 + a) * .03, Math.sin(a) * .22); m.rotation.y = a; });
      },
    };
  };
})();
