/* AETHERVAULT — the Nimbus line as 3D companions: Nimbit → Nimbus → Tempestral / Pluvia → Storm Sovereign.
 * One cloud-skin technique (lobed metaball masses → surface nets → single smooth skin with baked creases), one face language,
 * floating hands/feet, and silhouettes that grow in complexity (mane, anvil, hat+droplets, cloak+crown) rather than size alone.
 * Behaviours: breathing, blinking, cursor look, electrical surges, posture shifts, click/delight reactions, settling when idle. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util;
  const TAU = Math.PI * 2, K = 1 / .54;
  const ball = (x, y, z, vr, sx = 1, sy = 1, sz = 1, w = 1) => ({ x, y, z, r: vr * K, w, sx, sy, sz });
  const hash1 = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  /** Lobed cloud mass: ellipsoid core + puffs around the top/sides + back lobes + flattened underside. */
  function cloud(o) {
    const { cx = 0, cy, rx, ry, rz, top = 5, anvil = false, back = 3, flatY, seed = 1, bump = 1 } = o;
    const bf = top <= 3 ? 1 : 1.2, b = [ball(cx, cy - ry * .22, 0, 1, rx * .74 * bf, ry * .5 * bf, rz * .74 * bf, .9)];
    const f = i => { const t = top === 1 ? .5 : i / (top - 1); return .78 + .42 * Math.sin(t * Math.PI) + (hash1(seed * 13 + i) - .5) * .14; };
    const sp = 1.56 * rx / Math.max(1, top - 1);
    for (let i = 0; i < top; i++) {
      const t = top === 1 ? 0 : (i / (top - 1)) * 2 - 1, x = cx + t * rx * .78, fr = f(i), vr = sp / 2.1 * fr * bump;
      const y = anvil ? cy + ry * (.2 + .22 * fr) : cy + ry * (.04 + .6 * Math.sqrt(Math.max(0, 1 - t * t * .72)));
      b.push(ball(x, y, (hash1(seed + i) - .5) * rz * .2, vr));
      if (i < top - 1) b.push(ball(x + sp * .5, y + (anvil ? 0 : -ry * .02) - ry * .02, -rz * .55, vr * .95)); // back row, offset
    }
    [-1, 1].forEach(sd => b.push(ball(cx + sd * rx * .9, cy - ry * .2, 0, sp / 2.3)));
    for (let i = 0; i < back; i++) { const t = back === 1 ? .5 : i / (back - 1); b.push(ball(cx + (t - .5) * rx * 1.2, cy + ry * (.1 + hash1(seed * 7 + i) * .3), -rz * .78, sp / 1.9)); }
    if (flatY != null) b.push(ball(cx, flatY - ry * .6, 0, .6, rx * 1.5, ry * .8, rz * 1.5, -1.5));
    return b;
  }

  const FORMS = {
    nimbit: {
      balls: () => cloud({ cy: .52, rx: .46, ry: .38, rz: .4, top: 3, lobe: .23, flatY: .2, seed: 2 }),
      eye: { y: .56, dx: .155, s: .074, tilt: 0, shape: 'round' }, mouth: { y: .43, w: .065, kind: 'smile' }, cheek: { y: .46, dx: .27 }, brow: false,
      frame: { r: .66, h: 1.2 }, bolt: { y: .96, len: .3, w: .13 }, belly: null, hands: { x: .52, y: .42, z: .1, vr: .115 }, feet: { x: .18, y: .16, z: .12, vr: .1 },
      noise: .08, colors: { top: 1.0, bot: .74, blue: .22 },
    },
    nimbus: {
      balls: () => cloud({ cy: .8, rx: .66, ry: .52, rz: .5, top: 4, bump: 1.15, flatY: .24, seed: 5 }).concat([ball(.55, .36, -.55, .17), ball(.74, .4, -.66, .13), ball(.88, .5, -.7, .09)]),
      eye: { y: .86, dx: .2, s: .084, tilt: .08, shape: 'round' }, mouth: { y: .66, w: .1, kind: 'smile' }, cheek: { y: .7, dx: .33 }, brow: 'soft',
      frame: { r: .9, h: 1.62 }, bolt: { y: 1.52, len: .5, w: .18 }, belly: { y: .5, len: .36, w: .15 }, hands: { x: .76, y: .62, z: .2, vr: .17 }, feet: { x: .26, y: .21, z: .16, vr: .14 },
      noise: .08, colors: { top: 1.0, bot: .7, blue: .22 },
    },
    tempestral: {
      balls: () => cloud({ cy: .98, rx: .9, ry: .62, rz: .6, top: 5, bump: 1.3, anvil: true, back: 4, flatY: .3, seed: 9 }),
      eye: { y: 1.0, dx: .22, s: .088, tilt: .34, shape: 'angry' }, mouth: { y: .74, w: .15, kind: 'fang' }, cheek: null, brow: 'hard',
      frame: { r: 1.2, h: 2.1 }, bolt: null, belly: { y: .56, len: .46, w: .2 }, hands: { x: .96, y: .74, z: .22, vr: .21 }, feet: { x: .3, y: .25, z: .2, vr: .17 },
      noise: .09, colors: { top: .88, bot: .45 },
    },
    pluvia: {
      balls: () => [ball(0, .44, 0, .55, 1, .95, 1, 1), ball(0, .86, 0, .36, .9, 1, .9, 1), ball(0, 1.18, 0, .24, .85, 1, .85, 1), ball(0, 1.42, 0, .13, .8, 1, .8, 1), ball(0, 1.58, 0, .06, .7, 1, .7, 1), ball(-.36, .4, .12, .15), ball(.36, .4, .12, .15)],
      eye: { y: .56, dx: .18, s: .08, tilt: -.1, shape: 'calm' }, mouth: { y: .4, w: .06, kind: 'tiny' }, cheek: { y: .42, dx: .3 }, brow: false,
      frame: { r: .95, h: 2.0 }, bolt: null, belly: null, hands: { x: .6, y: .48, z: .14, vr: .11 }, feet: null,
      noise: .05, colors: { top: .95, bot: .62 }, hat: true,
    },
    stormsovereign: {
      balls: () => cloud({ cy: 1.14, rx: .84, ry: .68, rz: .58, top: 5, bump: 1.3, back: 3, flatY: .42, seed: 14 }),
      eye: { y: 1.2, dx: .2, s: .082, tilt: .22, shape: 'regal' }, mouth: { y: 1.0, w: .13, kind: 'stern' }, cheek: null, brow: 'hard',
      frame: { r: 1.55, h: 2.5 }, bolt: null, belly: null, hands: { x: .98, y: .86, z: .26, vr: .2 }, feet: { x: .3, y: .36, z: .2, vr: .17 },
      noise: .09, colors: { top: .9, bot: .42 }, mantle: true, crownY: 1.94,
    },
  };

  const frontPoint = (field, x, y, iso = .35) => {
    for (let z = 2.4; z > -.4; z -= .02) if (field(x, y, z) > iso) { let a = z + .02, b = z; for (let i = 0; i < 7; i++) { const m = (a + b) / 2; if (field(x, y, m) > iso) b = m; else a = m; } return (a + b) / 2; }
    return null;
  };
  const gradNormal = (field, x, y, z) => { const e = .03; return new THREE.Vector3(field(x - e, y, z) - field(x + e, y, z), field(x, y - e, z) - field(x, y + e, z), field(x, y, z - e) - field(x, y, z + e)).normalize(); };

  const shadeFn = (col, tintBlue0 = .07) => (x, y, z, nx, ny, nz, fv, field) => {
    const tintBlue = col.blue != null ? col.blue : tintBlue0;
    const top = .5 + .5 * ny, out = field(x + nx * .1, y + ny * .1, z + nz * .1), ao = U.clamp(out * 3.2, 0, 1);
    const l = (col.bot + (col.top - col.bot) * Math.pow(top, .75) + Math.max(0, nz) * .05) * (1 - .5 * ao);
    return [l * (1 - ao * .06), l * (1 - ao * .03), Math.min(1.15, l + (1 - top) * tintBlue + ao * .06)];
  };
  function bounds(balls) {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    balls.forEach(b => { if (b.w < 0) return; const r = b.r * .8; [[b.x, b.sx], [b.y, b.sy], [b.z, b.sz]].forEach(([c, s], i) => { mn[i] = Math.min(mn[i], c - r * s); mx[i] = Math.max(mx[i], c + r * s); }); });
    return { mn, mx };
  }
  function skin(ctx, key, balls, o) {
    return ctx.geo('petskin:' + key, () => { const { mn, mx } = bounds(balls), cs = o.cs || .05, cells = [0, 1, 2].map(i => Math.min(90, Math.ceil((mx[i] - mn[i]) / cs))); return L.blobSkin(balls, { min: mn, max: mx }, cells, Object.assign({ iso: .5, noiseScale: 5, seed: key.length * 31 + 7 }, o)); });
  }
  const unitSphere = ctx => ctx.geo('unit-sphere', () => new THREE.SphereGeometry(1, 28, 20));

  function buildPet(id, ctx) {
    const form = FORMS[id], pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const bodyGeo = skin(ctx, id, form.balls(), { noise: form.noise, colorFn: shadeFn(form.colors) }), field = bodyGeo.userData.field;
    const tintBody = { nimbit: '#cfe3ff', nimbus: '#b4d0ff', tempestral: '#7060d0', pluvia: '#62d4c8', stormsovereign: '#5a48b8' }[id];
    const mkCloudMat = col => { const m = F.body(col, { rough: .8, vertexColors: true, clearcoat: 0, pat: .55, soft: true }); if (m.isMeshPhysicalMaterial) { m.sheen = 1; m.sheenRoughness = .5; m.sheenColor = new THREE.Color(L.mix(pal[3], '#ffffff', .35)); } return m; };
    const bodyMat = mkCloudMat(tintBody);
    body.add(new THREE.Mesh(bodyGeo, bodyMat));
    const yellow = id === 'pluvia' ? pal[1] : '#ffc81e', boltMat = F.make('glow', { color: yellow, glow: 1.25 }), goldMetal = F.trim('#d9b24a', { rough: .22, plain: true });
    const dark = F.plain('#130e26', { rough: .2, metal: 0, clearcoat: 1, ccRough: .05, env: 1.6 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff }); ctx.disposables.push(white);
    const face = new THREE.Group(); body.add(face), U1 = unitSphere(ctx);
    var U1;

    // ---- face
    const eyes = [], E = form.eye;
    [-1, 1].forEach(sd => {
      const x = sd * E.dx, zf = frontPoint(field, x, E.y); if (zf == null) return;
      const n = gradNormal(field, x, E.y, zf), g = new THREE.Group(); g.position.set(x, E.y, zf - .012); g.lookAt(g.position.clone().add(n));
      const inner = new THREE.Group(); g.add(inner);
      const ew = E.shape === 'angry' || E.shape === 'regal' ? 1.05 : E.shape === 'calm' ? 1.25 : .92, eh = E.shape === 'angry' || E.shape === 'regal' ? .78 : E.shape === 'calm' ? .8 : 1.22;
      const eye = new THREE.Mesh(U1, dark); eye.scale.set(E.s * ew, E.s * eh, E.s * .55); inner.add(eye);
      let glowEye = null;
      if (E.shape === 'angry' || E.shape === 'regal') { glowEye = new THREE.Mesh(U1, F.make('glow', { color: E.shape === 'regal' ? '#ffd84a' : '#ffe27a', glow: 1.6 })); glowEye.scale.set(E.s * ew * .9, E.s * eh * .6, E.s * .5); glowEye.position.z = .008; inner.add(glowEye); }
      const hl = [];
      if (!glowEye) { const h1 = new THREE.Mesh(U1, white); h1.scale.setScalar(E.s * .3); h1.position.set(-sd * E.s * .0 - E.s * .28, E.s * .36, E.s * .45); const h2 = new THREE.Mesh(U1, white); h2.scale.setScalar(E.s * .14); h2.position.set(E.s * .22, -E.s * .3, E.s * .42); inner.add(h1, h2); hl.push(h1, h2); }
      inner.rotation.z = sd * E.tilt; face.add(g); eyes.push({ g, inner, eye, hl, glowEye, sd, base: eye.scale.y });
    });
    const happy = [];
    eyes.forEach(e => { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8 * Math.PI; pts.push([Math.cos(t) * E.s * 1.1, Math.sin(t) * E.s * .9, 0]); } const m = new THREE.Mesh(L.tube(pts, .014, 12, 6), dark); m.visible = false; e.g.add(m); happy.push(m); });
    if (form.cheek) [-1, 1].forEach(sd => { const x = sd * form.cheek.dx, zf = frontPoint(field, x, form.cheek.y); if (zf == null) return; const c = L.sprite('#ff9ab8', .22, .45); c.position.set(x, form.cheek.y, zf + .02); face.add(c); });
    const M = form.mouth, mz = frontPoint(field, 0, M.y); let mouth = null;
    if (mz != null) {
      const g = new THREE.Group(); g.position.set(0, M.y, mz - .006); const n = gradNormal(field, 0, M.y, mz); g.lookAt(g.position.clone().add(n)); face.add(g); mouth = g;
      if (M.kind === 'fang') {
        g.add(new THREE.Mesh(L.tube([[-M.w * 1.2, .02, 0], [-M.w * .8, -.03, 0], [-M.w * .4, .03, 0], [0, -.035, 0], [M.w * .4, .03, 0], [M.w * .8, -.03, 0], [M.w * 1.2, .02, 0]], .016, 24, 6), dark));
        const fm = new THREE.MeshStandardMaterial({ color: 0xf4f0ff, roughness: .4 }); ctx.disposables.push(fm);
        [-1, 1].forEach(sd => { const f = new THREE.Mesh(L.extrude([[0, 0], [.03, 0], [0, -.055]], .012, .002, { bevelSeg: 1 }), fm); f.position.set(sd * M.w * .55, .016, .006); g.add(f); });
      } else if (M.kind === 'stern') g.add(new THREE.Mesh(L.tube([[-M.w, .01, 0], [-M.w * .3, -.014, 0], [M.w * .3, -.014, 0], [M.w, .01, 0]], .015, 18, 6), dark));
      else { const w = M.w; g.add(new THREE.Mesh(L.tube([[-w, .012, 0], [-w * .5, -.018, 0], [0, -.026, 0], [w * .5, -.018, 0], [w, .012, 0]], M.kind === 'tiny' ? .011 : .014, 18, 6), dark)); }
    }
    const brows = [];
    if (form.brow) [-1, 1].forEach(sd => {
      const x = sd * E.dx, y = E.y + E.s * 1.75, zf = frontPoint(field, x, y); if (zf == null) return; const n = gradNormal(field, x, y, zf), hard = form.brow === 'hard', w = E.s * (hard ? 1.8 : 1.3), tilt = hard ? .5 : .16;
      const g = new THREE.Group(); g.position.set(x, y, zf - .004); g.lookAt(g.position.clone().add(n)); g.rotateZ(hard ? sd * tilt : sd * .06);
      g.add(new THREE.Mesh(L.tube([[-w, 0, 0], [0, hard ? -.008 : .012, 0], [w, 0, 0]], hard ? .019 : .012, 12, 6), dark)); face.add(g); brows.push(g);
    });

    // ---- floating hands and feet (separate puffs: they make the silhouette readable and the creature alive)
    const limbMat = id === 'pluvia' ? mkCloudMat('#8ee4de') : bodyMat;
    const puffGeo = ctx.geo('petpuff', () => L.blobSkin([ball(0, 0, 0, 1, 1, .9, 1), ball(.45, .35, 0, .55), ball(-.4, .3, .1, .5), ball(0, .55, -.1, .45)], { min: [-1.5, -1.2, -1.5], max: [1.5, 1.6, 1.5] }, [34, 34, 34], { iso: .4, noise: .06, noiseScale: 5, colorFn: shadeFn({ top: .92, bot: .62 }) }));
    const limbs = [];
    [-1, 1].forEach(sd => {
      if (form.hands) { const h = new THREE.Mesh(puffGeo, limbMat), g = new THREE.Group(); g.add(h); h.scale.setScalar(form.hands.vr * 1.25); g.position.set(sd * form.hands.x, form.hands.y, form.hands.z); body.add(g); limbs.push({ g, sd, kind: 'hand', home: g.position.clone() });
        if (id === 'stormsovereign' || id === 'tempestral') { const br = new THREE.Mesh(new THREE.TorusGeometry(form.hands.vr * .95, form.hands.vr * .13, 8, 28), id === 'stormsovereign' ? goldMetal : boltMat); br.rotation.y = Math.PI / 2 - sd * .4; br.position.set(-sd * form.hands.vr * .5, -form.hands.vr * .15, 0); g.add(br); } }
      if (form.feet) { const f = new THREE.Mesh(puffGeo, limbMat), g = new THREE.Group(); g.add(f); f.scale.set(form.feet.vr * 1.3, form.feet.vr * 1.05, form.feet.vr * 1.4); g.position.set(sd * form.feet.x, form.feet.y, form.feet.z); body.add(g); limbs.push({ g, sd, kind: 'foot', home: g.position.clone() }); }
    });

    // ---- bolts
    const boltGeo = (len, w, seed) => ctx.geo(`bolt:${len}:${w}:${seed}`, () => L.extrude(L.boltOutline(len, w, 3, seed), .1, .022, { bevelSeg: 2 }));
    const boltMeshes = [], arcs = [], addBolt = (parent, len, w, seed, pos, rot, glow = true) => { const m = new THREE.Mesh(boltGeo(len, w, seed), boltMat); m.position.set(...pos); if (rot) m.rotation.set(...rot); parent.add(m); if (glow) { const gl = L.sprite(yellow, len * 1.2, .35); gl.position.set(0, 0, -.05); m.add(gl); } boltMeshes.push(m); return m; };
    if (form.bolt) { const t = addBolt(body, form.bolt.len, form.bolt.w, 3, [0, form.bolt.y, -.02], [0, 0, Math.PI + .12]); }
    if (form.belly) { const bz = frontPoint(field, 0, form.belly.y); if (bz != null) { const m = addBolt(face, form.belly.len, form.belly.w, 11, [0, form.belly.y, bz - .025], [0, 0, 0]); m.scale.z = .5; } }
    const light = new THREE.PointLight(new THREE.Color(yellow), 0, 3.8, 1.6); light.position.set(0, form.frame.h * .8, .8); body.add(light);

    // ---- per-form extras
    const extras = new THREE.Group(); root.add(extras), halos = [], drops = [], orbiters = [];
    var halos, drops, orbiters;
    if (id === 'tempestral') [-1, 1].forEach(sd => { const m = new THREE.Mesh(L.extrude([[0, 0], [.14 * sd, .26], [.05 * sd, .34], [.22 * sd, .72], [.0, .6], [.08 * sd, .92], [-.12 * sd, .56], [-.04 * sd, .5], [-.14 * sd, .24]], .1, .02, { bevelSeg: 2 }), boltMat); m.position.set(sd * .56, 1.5, -.05); m.rotation.set(0, sd * .15, -sd * .38); body.add(m); boltMeshes.push(m); const gl = L.sprite(yellow, 1, .3); gl.position.set(sd * .05, .45, -.05); m.add(gl); });
    if (id === 'stormsovereign') {
      const crown = new THREE.Group(); crown.position.set(0, form.crownY + .08, -.03); crown.scale.setScalar(1.4); const gemM = F.make('glow', { color: '#fff4c0', glow: 1.8 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(.34, .05, 12, 56), goldMetal); band.rotation.x = Math.PI / 2; crown.add(band);
      const band2 = new THREE.Mesh(new THREE.TorusGeometry(.34, .022, 8, 56), goldMetal); band2.rotation.x = Math.PI / 2; band2.position.y = .1; crown.add(band2);
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, tall = i % 2 ? .36 : .56; const m = new THREE.Mesh(L.extrude([[-.08, 0], [.08, 0], [.05, tall * .5], [.13, tall * .46], [0, tall], [-.11, tall * .55], [-.05, tall * .5]], .07, .014, { bevelSeg: 2 }), goldMetal); m.position.set(Math.sin(a) * .34, .04, Math.cos(a) * .34); m.rotation.y = a; m.rotation.x = -.14; crown.add(m); if (!(i % 2)) { const gm = new THREE.Mesh(new THREE.OctahedronGeometry(.035, 0), gemM); gm.position.set(0, tall * .62, .045); m.add(gm); ctx.disposables.push(gm.geometry); } }
      body.add(crown);
      [-1, 1].forEach(sd => { [[1.3, .34, 31, .55, 1.45, 1.1], [.9, .24, 32, .75, .98, .85]].forEach(([len, w, seed, rz, y, x]) => { const m = new THREE.Mesh(boltGeo(len, w, seed), boltMat); m.position.set(sd * x * 1.0, y, -.55); m.rotation.set(0, sd * .35, sd * rz); body.add(m); boltMeshes.push(m); const gl = L.sprite(yellow, len * 1.1, .3); gl.position.set(0, 0, -.06); m.add(gl); }); });
      // cloak: separate dark lobed cloud behind
      const cloakBalls = [ball(0, 1.05, -.62, 1, 1.0, .85, .22, .9), ball(-.78, .85, -.5, 1, .35, .8, .22, .9), ball(.78, .85, -.5, 1, .35, .8, .22, .9), ball(0, .5, -.7, 1, .8, .35, .2, .9), ball(-.55, .35, -.64, .26), ball(.55, .35, -.64, .26), ball(0, .22, -.66, .3), ball(-.9, 1.3, -.44, .26), ball(.9, 1.3, -.44, .26), ball(0, 1.78, -.5, .34), ball(-.5, 1.62, -.55, .3), ball(.5, 1.62, -.55, .3)];
      const cg = skin(ctx, 'cloak', cloakBalls, { noise: .1, colorFn: shadeFn({ top: .9, bot: .35 }, .1) }), cm = mkCloudMat('#241c5e'); body.add(new THREE.Mesh(cg, cm));
    }
    if (form.hat) { // Pluvia: soft cloud hat + hanging droplets
      const hatBalls = cloud({ cy: 1.78, rx: .4, ry: .13, rz: .4, top: 4, bump: 1.1, back: 3, seed: 21 });
      const hg = skin(ctx, 'pluvia-hat', hatBalls, { noise: .07, cs: .04, colorFn: shadeFn({ top: 1.0, bot: .7 }) }); body.add(new THREE.Mesh(hg, mkCloudMat('#e3f6ff')));
      const dg = ctx.geo('pluvia-drop', () => L.lathe([[0, 0], [.05, .02], [.09, .08], [.1, .15], [.08, .22], [.04, .3], [0, .4]], 20)), glass = F.make('glass', { color: pal[1], opacity: .78 }), rod = F.trim('#cfeff0', { rough: .3, plain: true }); glass.emissive = new THREE.Color(pal[1]); glass.emissiveIntensity = .55;
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3, r = .78 + (i % 2) * .08, dr = new THREE.Group(); dr.position.set(Math.cos(a) * r, .55 + (i % 3) * .3, Math.sin(a) * r * .8); const d = new THREE.Mesh(dg, glass); d.scale.setScalar(1.4 + (i % 2) * .45); dr.add(d); body.add(dr); drops.push({ g: dr, ph: i * .9, d, len: 0, y0: dr.position.y }); }
    }

    // ---- upgrade-stage additions (geometry + moving parts, not just glow)
    const FR = form.frame, haloMat = id === 'pluvia' ? F.make('glow', { color: pal[1], glow: 1.1 }) : boltMat;
    if (lvl >= 1) for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, m = new THREE.Mesh(boltGeo(.34, .11, 20 + i), boltMat); m.position.set(sd * FR.r * (.78 + (i > 1 ? .1 : 0)), FR.h * (.34 + (i > 1 ? .2 : 0)), -FR.r * .28); m.rotation.y = sd * .5; m.visible = false; extras.add(m); arcs.push(m); }
    const sparks = [];
    if (lvl >= 1) { const gr = new THREE.Mesh(new THREE.TorusGeometry(FR.r * .84, .018, 6, 72), haloMat); gr.rotation.x = Math.PI / 2; gr.position.y = .05; gr.userData.stageRing = true; extras.add(gr); halos.push({ m: gr, kind: 'ring' }); for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.OctahedronGeometry(.055, 0), haloMat); sp.scale.set(.7, 1.3, .7); extras.add(sp); sparks.push({ m: sp, a: i / 3 * TAU }); ctx.disposables.push(sp.geometry); } }
    if (lvl >= 2) for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(boltGeo(.28, .1, 40 + i), haloMat); orbiters.push({ m, a: i / 3 * TAU, r: FR.r * 1.0, y: FR.h * (.45 + i * .1), sp: .6 + i * .15 }); extras.add(m); }
    if (lvl >= 3) { const h = new THREE.Group(); h.position.set(0, FR.h * .62, -.55); for (let i = 0; i < 6; i++) { const arc = new THREE.Mesh(new THREE.TorusGeometry(FR.r * .8, .026, 6, 24, .62), haloMat); arc.rotation.z = i / 6 * TAU; h.add(arc); } h.add(new THREE.Mesh(new THREE.TorusGeometry(FR.r * .64, .014, 6, 60), haloMat)); extras.add(h); halos.push({ m: h, kind: 'halo' }); }
    if (lvl >= 4) {
      const g = new THREE.Group(); g.position.set(0, FR.h * .6, -.7);
      for (let i = 0; i < 11; i++) { const a = (i / 11 - .5) * 3.0, m = new THREE.Mesh(new THREE.PlaneGeometry(.07, FR.h * .5), new THREE.MeshBasicMaterial({ map: L.shaftTex(), color: new THREE.Color(yellow), transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.userData.noSil = true; m.position.set(Math.sin(a) * FR.r * 1.08, FR.h * .12 * Math.cos(a), 0); m.rotation.z = -a; m.scale.y = 1 + (i % 3) * .3; g.add(m); ctx.disposables.push(m.material); }
      extras.add(g); halos.push({ m: g, kind: 'rays' });
      const core = L.sprite('#fff6d0', FR.r * 1.2, .4); core.position.set(0, FR.h * .45, .1); core.material.depthTest = false; core.renderOrder = 5; extras.add(core); halos.push({ m: core, kind: 'core' });
    }
    // potential: latent motes (>=55) + sleeping core & evolution runes (>=80)
    const pot = ctx.potentialTier; let potMotes = null, sleepG = null, runes = null;
    if (pot >= 1) { const n = Math.round(14 * ctx.q.particles), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = FR.r * (.35 + Math.random() * .7); pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = FR.h * (.2 + Math.random() * .7); pos[i * 3 + 2] = Math.sin(a) * r * .8; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.PointsMaterial({ map: L.dotTex(), color: new THREE.Color(yellow), size: .07, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }); potMotes = new THREE.Points(g, m); potMotes.userData.noSil = true; potMotes.userData.base = pos.slice(); extras.add(potMotes); ctx.disposables.push(m); }
    if (pot >= 2) { sleepG = L.sprite(ctx.rc, FR.r * .9, .24); sleepG.position.set(0, form.belly ? form.belly.y + .1 : FR.h * .4, .05); sleepG.material.depthTest = false; sleepG.renderOrder = 4; body.add(sleepG);
      if ((ctx.item.evolves || []).length) { runes = new THREE.Group(); runes.position.set(0, FR.h + .25, 0); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.045, 0), F.make('glow', { color: '#ffffff', glow: 1.6 })); m.userData.a = i / 3 * TAU; runes.add(m); ctx.disposables.push(m.geometry); } extras.add(runes); } }

    // ---- behaviour
    const A = { blink: 0, nextBlink: 2 + Math.random() * 3, surge: 0, nextSurge: 5 + Math.random() * 6, posture: 0, postureT: 0, postureTarget: 0, nextPosture: 8 + Math.random() * 6, hop: 99, delight: 0, wide: 0, look: new THREE.Vector2(), settle: 0 };
    const inst = { root, frame: { r: FR.r, h: FR.h }, float: .04, rest: { yaw: -.3, pitch: 0 } };
    inst.react = k => { if (k === 'click') { A.hop = 0; A.surge = 1; A.wide = .6; } else if (k === 'delight') { A.delight = 2.4; A.hop = 0; A.surge = 1; } else if (k === 'surge') A.surge = 1; };
    inst.update = (dt, t, st) => {
      const calm = ctx.reduced || st.reduced, idle = st.idle, target = idle > 20 ? U.clamp((idle - 20) / 6, 0, 1) : 0; A.settle += (target - A.settle) * .05;
      if (!calm) {
        A.nextBlink -= dt; if (A.nextBlink <= 0) { A.blink = .16; A.nextBlink = 2.4 + Math.random() * 4; if (Math.random() < .2) A.nextBlink = .25; }
        A.nextSurge -= dt * (1 - A.settle * .8); if (A.nextSurge <= 0 && id !== 'pluvia') { A.surge = 1; A.nextSurge = 7 + Math.random() * 9; }
        A.nextPosture -= dt; if (A.nextPosture <= 0) { A.postureTarget = (Math.random() - .5) * .3; A.postureT = 2.2; A.nextPosture = 9 + Math.random() * 8; } A.postureT -= dt; if (A.postureT <= 0) A.postureTarget = 0;
      }
      A.blink = Math.max(0, A.blink - dt); A.surge = Math.max(0, A.surge - dt * 1.6); A.delight = Math.max(0, A.delight - dt); A.hop += dt; A.wide = Math.max(0, A.wide - dt); A.posture += (A.postureTarget - A.posture) * Math.min(1, dt * 2.5);
      const br = calm ? 0 : Math.sin(t * (1.5 - A.settle * .6)) * .016, big = id === 'stormsovereign' ? .55 : 1;
      const hop = A.hop < .9 ? Math.sin(A.hop / .9 * Math.PI) * (.22 + (A.delight > 0 ? .1 : 0)) * big : 0, dbounce = A.delight > 0 ? Math.abs(Math.sin(A.delight * 5)) * .1 * big : 0, sq = A.hop < .9 ? 1 - Math.sin(Math.min(1, A.hop / .25) * Math.PI) * .1 : 1;
      body.scale.set(1 - br * .5 + (1 - sq) * .6, 1 + br + (sq - 1) * .8, 1 - br * .5 + (1 - sq) * .6); body.position.y = hop + dbounce - A.settle * .05;
      const tx = calm ? 0 : st.pointer.x * .5 * (st.hover ? 1 : .35), ty = calm ? 0 : -st.pointer.y * .22 * (st.hover ? 1 : .35); A.look.x += (tx - A.look.x) * .08; A.look.y += (ty - A.look.y) * .08;
      body.rotation.y = A.look.x * .55; body.rotation.x = -A.look.y * .35 + A.settle * .06; body.rotation.z = A.posture + (id === 'tempestral' && !calm ? Math.sin(t * 24) * .003 * (1 + A.surge * 3) : 0);
      eyes.forEach(e => { const open = A.delight > 0 ? 0 : (A.blink > 0 ? .08 : (1 - A.settle * .45)) * (1 + A.wide * .3); e.eye.scale.y = e.base * Math.max(.08, open); e.hl.forEach(h => (h.visible = open > .5)); if (e.glowEye) e.glowEye.visible = open > .3; e.eye.visible = A.delight <= 0; e.inner.position.x = A.look.x * .045; e.inner.position.y = A.look.y * .05; });
      happy.forEach(h => (h.visible = A.delight > 0));
      limbs.forEach((l, i) => { const ph = i * 1.7, wave = l.kind === 'hand' && A.delight > 0 ? Math.sin(t * 9 + ph) * .12 + .18 : 0; l.g.position.y = l.home.y + (calm ? 0 : Math.sin(t * 1.3 + ph) * .02) + wave + (l.kind === 'hand' ? hop * .3 : 0); l.g.position.x = l.home.x + (calm ? 0 : Math.sin(t * .9 + ph) * .012) + (l.kind === 'hand' && A.delight > 0 ? l.sd * .05 : 0); });
      const sg = A.surge; boltMat.emissiveIntensity = 1.25 * (1 + sg * 1.6 + (calm ? 0 : Math.sin(t * 3) * .06)); light.intensity = sg * 7 * (id === 'pluvia' ? 0 : 1);
      arcs.forEach(m => { m.visible = sg > .15 && Math.random() < .55 + sg * .3; if (m.visible) { m.rotation.z = (Math.random() - .5) * 1.4; m.scale.setScalar(.7 + Math.random() * .7); } });
      orbiters.forEach(o => { const a = o.a + t * o.sp; o.m.position.set(Math.cos(a) * o.r, o.y + Math.sin(t * 1.3 + o.a) * .06, Math.sin(a) * o.r * .8); o.m.rotation.y = -a; o.m.rotation.z = Math.sin(t + o.a) * .3; });
      sparks.forEach(s => { const a = s.a + t * .6; s.m.position.set(Math.cos(a) * FR.r * .84, .14 + Math.sin(t * 1.7 + s.a) * .05, Math.sin(a) * FR.r * .84); s.m.rotation.y = a * 2; });
      halos.forEach(h => { if (h.kind === 'ring') h.m.material.opacity = 1; if (h.kind === 'halo') h.m.rotation.z += dt * .15; else if (h.kind === 'rays') h.m.rotation.z = Math.sin(t * .3) * .05; else if (h.kind === 'core') h.m.material.opacity = .26 + Math.sin(t * 1.4) * .1 + sg * .3; });
      drops.forEach(d => { d.g.position.y = d.y0 + (calm ? 0 : Math.sin(t * 1.1 + d.ph * 2) * .06); d.g.rotation.y = t * .4 + d.ph; });
      if (potMotes) { const p = potMotes.geometry.attributes.position, b = potMotes.userData.base; for (let i = 0; i < p.count; i++) { p.array[i * 3] = b[i * 3] + Math.sin(t * .6 + i) * .08; p.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * .8 + i * 1.7) * .1; p.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(t * .5 + i) * .08; } p.needsUpdate = true; }
      if (sleepG) sleepG.material.opacity = .14 + (Math.sin(t * .9) * .5 + .5) * .16;
      if (runes) runes.children.forEach(r => { const a = r.userData.a + t * .8; r.position.set(Math.cos(a) * .22, Math.sin(t * 1.6 + a) * .03, Math.sin(a) * .22); r.rotation.y = a; });
      if (mouth) mouth.scale.y = A.delight > 0 ? 1.8 : 1;
    };
    return inst;
  }

  ['nimbit', 'nimbus', 'tempestral', 'pluvia', 'stormsovereign'].forEach(id => S.registerModel(id, { rest: { yaw: -.3, pitch: 0 }, build: ctx => buildPet(id, ctx) }));
})();
