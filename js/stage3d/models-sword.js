/* AETHERVAULT — Swords: one parametric rig, two collectibles (Rustblade common, Prismedge mythic).
 * Layered construction: bevelled blade + raised fuller, wrapped grip, forged guard, pommel, gems, engraved serial plate.
 * Stage progression adds geometry: L1 runes+ferrule · L2 winged guard + gem · L3 edge light + orbiting rune arcs · L4 split shards + halo + beam. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util;
  const TAU = Math.PI * 2;

  const P = {
    rustblade: { steel: '#c4cad4', guardCol: '#a8794a', grip: '#3a2a1e', accent: '#d9b48c', bladeW: .17, tipY: 2.72, prism: false, wing: false, gem: '#d98a3a', engrave: .5 },
    prismedge: { steel: '#8fd0f2', guardCol: '#e6e9f2', grip: '#2a2f6a', accent: '#ff6fd8', bladeW: .21, tipY: 2.84, prism: true, wing: true, gem: '#ff6fd8', engrave: 1 },
  };

  function build(id, ctx) {
    const p = P[id], F = ctx.F, lvl = ctx.level, root = new THREE.Group(), sw = new THREE.Group(); root.add(sw);
    const steel = p.prism ? F.make('body', { color: p.steel, metal: .55, rough: .12, clearcoat: 1, ccRough: .04, env: 2.2, pat: .6 }) : F.trim(p.steel, { metal: .9, rough: .38, env: 1.5 });
    const guardM = F.trim(p.guardCol, { rough: .26 }), gripM = F.body(p.grip, { rough: .78, metal: 0, clearcoat: 0, pat: 0, plain: false }), cordM = F.body(L.mix(p.grip, p.accent, .28), { rough: .7, metal: 0, clearcoat: 0 });
    const gemM = F.make('glow', { color: p.gem, glow: 1.7 }), darkM = F.trim(L.shade(p.steel, p.prism ? .55 : .5), { rough: .42, metal: .9 }), brass = F.trim('#b48d4c', { rough: .3, plain: true });

    // ---- blade (bevelled silhouette) + fuller rib
    const w0 = p.bladeW, T = p.tipY, y0 = .98;
    const outline = [[-w0, y0], [-w0 * .98, y0 + .5], [-w0 * .86, T - .55], [-w0 * .5, T - .2], [0, T], [w0 * .5, T - .2], [w0 * .86, T - .55], [w0 * .98, y0 + .5], [w0, y0]];
    const bladeGeo = ctx.geo('blade:' + id, () => L.extrude(outline, p.prism ? .07 : .05, p.prism ? .03 : .018, { bevelSeg: 2 }));
    const blade = new THREE.Mesh(bladeGeo, steel); sw.add(blade);
    const fl = [[-.026, y0 + .12], [-.03, y0 + .3], [-.02, T - .5], [0, T - .36], [.02, T - .5], [.03, y0 + .3], [.026, y0 + .12]];
    const fuller = new THREE.Mesh(ctx.geo('fuller:' + id, () => L.extrude(fl, p.prism ? .095 : .07, .01, { bevelSeg: 1 })), darkM); sw.add(fuller);
    // engraved edge lines (thin raised inlays near both edges)
    [-1, 1].forEach(sd => { const e = new THREE.Mesh(ctx.geo('edge:' + id + sd, () => L.extrude([[sd * (w0 * .76), y0 + .1], [sd * (w0 * .72), y0 + .7], [sd * (w0 * .58), T - .6], [sd * (w0 * .5), T - .5], [sd * (w0 * .56), T - .75], [sd * (w0 * .68), y0 + .7], [sd * (w0 * .72), y0 + .1]], .058, .006, { bevelSeg: 1 })), darkM); sw.add(e); });
    // serial plate engraved on the ricasso (both faces)
    const sTex = L.paperTexture([{ text: '№ ' + U.pad(ctx.spec.serial || 0, 4), font: '600 58px "IBM Plex Mono", monospace', y: 64, color: '#2a2622' }], 256, 128, { paper: 'rgba(0,0,0,0)' });
    { const c = sTex.image.getContext('2d'); c.clearRect(0, 0, 256, 128); c.fillStyle = 'rgba(20,16,12,.78)'; c.font = '600 54px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('№ ' + U.pad(ctx.spec.serial || 0, 4), 128, 64); sTex.needsUpdate = true; }
    ctx.tex.push(sTex);
    const sMat = new THREE.MeshBasicMaterial({ map: sTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); ctx.disposables.push(sMat);
    [1, -1].forEach(sd => { const m = new THREE.Mesh(new THREE.PlaneGeometry(.24, .12), sMat); m.position.set(0, y0 + .2, sd * (p.prism ? .0355 : .026) + sd * .045 * 0); m.position.z = sd * (p.prism ? .1 : .075) * .5 + sd * .001; if (sd < 0) m.rotation.y = Math.PI; m.userData.noSil = true; m.scale.set(.9, .9, 1); sw.add(m); });

    // ---- guard
    const guardPts = p.wing
      ? [[0, .12], [.16, .13], [.32, .2], [.5, .38], [.64, .6], [.5, .28], [.56, .12], [.46, .0], [.26, -.06], [.1, -.08], [0, -.1]]
      : [[0, .1], [.14, .1], [.34, .08], [.46, .02], [.44, -.04], [.3, -.06], [.1, -.06], [0, -.06]];
    const half = guardPts.slice(0, -0), full = half.map(q => [-q[0], q[1]]).reverse().concat(half.slice(1, -1).length ? half.slice(0).map(q => q) : []);
    const poly = []; half.forEach(q => poly.push([q[0], q[1]])); for (let i = half.length - 1; i >= 0; i--) poly.push([-half[i][0], half[i][1]]);
    // build a clean closed polygon: right side up, then left side mirrored down
    const right = guardPts.map(q => [q[0], q[1]]), left = guardPts.slice().reverse().map(q => [-q[0], q[1]]);
    const guardGeo = ctx.geo('guard:' + id, () => L.extrude(right.concat(left), .11, .02, { bevelSeg: 2 }));
    const guard = new THREE.Mesh(guardGeo, guardM); guard.position.y = .88; sw.add(guard);
    const boss = new THREE.Mesh(L.lathe([[0, -.06], [.09, -.06], [.11, -.02], [.1, .06], [.07, .13], [0, .15]], 20), brass); boss.position.set(0, .88, 0); boss.scale.set(1, 1, 1.0); sw.add(boss);
    const gemC = new THREE.Mesh(new THREE.OctahedronGeometry(p.prism ? .085 : .06, 0), gemM); gemC.scale.set(1, 1.35, .8); gemC.position.set(0, .93, .075); sw.add(gemC); ctx.disposables.push(gemC.geometry);

    // ---- grip with wrapped cord, ferrule, pommel
    const gripCore = new THREE.Mesh(L.lathe([[0, .2], [.052, .2], [.055, .3], [.05, .55], [.056, .74], [0, .74]], 24), gripM); sw.add(gripCore);
    const helix = []; const turns = 13; for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * turns * TAU, r = .057 - Math.sin(t * Math.PI) * -.002; helix.push([Math.cos(a) * r, .22 + t * .5, Math.sin(a) * r]); }
    sw.add(new THREE.Mesh(L.tube(helix, .0105, 220, 6), cordM));
    const ferrule = new THREE.Mesh(L.lathe([[.06, .72], [.075, .72], [.08, .76], [.075, .8], [.06, .8]], 24), brass); sw.add(ferrule);
    const pommel = new THREE.Mesh(L.lathe(p.prism ? [[0, .02], [.07, .04], [.12, .1], [.13, .18], [.1, .24], [.05, .27], [0, .28]] : [[0, .04], [.08, .04], [.115, .09], [.12, .15], [.09, .2], [.05, .22], [0, .22]], p.prism ? 8 : 28), p.prism ? guardM : brass); sw.add(pommel);
    const pg = new THREE.Mesh(new THREE.OctahedronGeometry(.045, 0), gemM); pg.position.set(0, p.prism ? .15 : .13, .1); pg.scale.set(.7, 1, .7); sw.add(pg); ctx.disposables.push(pg.geometry);
    if (!p.prism) { // peened rivets on the guard
      const rg = new THREE.SphereGeometry(.016, 8, 6); ctx.disposables.push(rg); [-.3, -.18, .18, .3].forEach(x => { const r = new THREE.Mesh(rg, brass); r.position.set(x, .9, .062); sw.add(r); const r2 = r.clone(); r2.position.z = -.062; sw.add(r2); });
    }

    // ---- prism: refracted ghost layers + light edge
    const ghosts = [];
    if (p.prism) {
      const shp = new THREE.Shape(outline.map(q => new THREE.Vector2(q[0], q[1]))), sg = new THREE.ShapeGeometry(shp); ctx.disposables.push(sg);
      ['#ff5b8a', '#ffd84a', '#5bffb4', '#5bb8ff', '#a06bff'].forEach((c, i) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); ctx.disposables.push(m); const g = new THREE.Mesh(sg, m); g.userData.noSil = true; g.userData.ph = i; sw.add(g); ghosts.push(g); });
    }
    // ---- stage additions
    const runes = new THREE.Group(), orbit = new THREE.Group(), extra = new THREE.Group(); sw.add(runes, orbit, extra);
    if (lvl >= 1) { // runes along the fuller + ferrule ring
      const rm = F.make('glow', { color: p.gem, glow: 1.2 }), rg = new THREE.BoxGeometry(.03, .016, .012); ctx.disposables.push(rg);
      for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(rg, rm); r.position.set((i % 2 ? .012 : -.012), y0 + .45 + i * .15, .05 + (p.prism ? .01 : 0)); r.rotation.z = (i % 3) * .5; r.userData.noSil = true; runes.add(r); const r2 = r.clone(); r2.position.z *= -1; runes.add(r2); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.07, .01, 8, 28), brass); ring.rotation.x = Math.PI / 2; ring.position.y = .55; sw.add(ring);
    }
    if (lvl >= 2) { // winged plates + second gem
      const wing = ctx.geo('wing:' + id, () => L.extrude([[0, 0], [.26, .12], [.5, .3], [.3, .16], [.4, .04], [.2, -.02]], .04, .01, { bevelSeg: 1 }));
      [-1, 1].forEach(sd => { const w = new THREE.Mesh(wing, guardM); w.scale.x = sd; w.position.set(sd * .08, .96, -.01); w.rotation.z = sd * -.06; extra.add(w); });
      const g2 = new THREE.Mesh(new THREE.OctahedronGeometry(.05, 0), gemM); g2.position.set(0, 1.1, .03); g2.scale.set(.7, 1.3, .7); extra.add(g2); ctx.disposables.push(g2.geometry);
    }
    let edgeL = null;
    if (lvl >= 3) { // glowing edge tubes + orbiting rune arcs
      const em = F.make('glow', { color: p.gem, glow: 1.5 });
      [-1, 1].forEach(sd => { const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18, y = y0 + .05 + t * (T - y0 - .35), w = w0 * (1 - .5 * Math.pow(t, 2.2)) * .995 * sd; pts.push([w, y, 0]); } extra.add(new THREE.Mesh(L.tube(pts, .006, 40, 5), em)); });
      for (let i = 0; i < 3; i++) { const arc = new THREE.Mesh(new THREE.TorusGeometry(.42 + i * .0, .018, 6, 24, 1.6), F.make('glow', { color: p.gem, glow: 1.3 })); arc.rotation.x = Math.PI / 2; arc.rotation.z = i / 3 * TAU; arc.position.y = 1.7 + i * .35; arc.userData.i = i; orbit.add(arc); }
    }
    let shards = null, halo = null, beam = null;
    if (lvl >= 4) { // split shards, halo ring, light beam
      shards = new THREE.Group(); const sh = ctx.geo('shard:' + id, () => L.extrude([[0, 0], [.07, .1], [.05, .62], [0, .78], [-.05, .62], [-.07, .1]], .03, .008, { bevelSeg: 1 }));
      for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(sh, steel); m.userData.i = i; shards.add(m); } extra.add(shards);
      halo = new THREE.Group(); halo.position.set(0, .95, -.15); halo.add(new THREE.Mesh(new THREE.TorusGeometry(.62, .016, 8, 72), brass), new THREE.Mesh(new THREE.TorusGeometry(.5, .008, 6, 72), F.make('glow', { color: p.gem, glow: 1.4 }))); for (let i = 0; i < 12; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(.012, .06, .012), brass); const a = i / 12 * TAU; t.position.set(Math.cos(a) * .62, Math.sin(a) * .62, 0); t.rotation.z = a; halo.add(t); ctx.disposables.push(t.geometry); } extra.add(halo);
      beam = new THREE.Mesh(new THREE.PlaneGeometry(.5, 3.2), new THREE.MeshBasicMaterial({ map: L.shaftTex(), color: new THREE.Color(p.gem), transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 1.6; beam.userData.noSil = true; ctx.disposables.push(beam.material); extra.add(beam);
    }
    // ---- potential
    let motes = null, sleepGlow = null;
    if (ctx.potentialTier >= 1) { const n = Math.round(12 * ctx.q.particles), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * .8; pos[i * 3 + 1] = .5 + Math.random() * 2.3; pos[i * 3 + 2] = (Math.random() - .5) * .5; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.PointsMaterial({ map: L.dotTex(), color: new THREE.Color(p.gem), size: .06, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }); motes = new THREE.Points(g, m); motes.userData.noSil = true; motes.userData.base = pos.slice(); sw.add(motes); ctx.disposables.push(m); }
    if (ctx.potentialTier >= 2) { sleepGlow = L.sprite(ctx.rc, .5, .3); sleepGlow.position.set(0, 1.35, 0); sleepGlow.scale.set(.5, 1.8, 1); sw.add(sleepGlow); }

    sw.position.y = .25; sw.position.x = -1.0; sw.rotation.z = -.78;
    const inst = { root, frame: { r: 1.45, h: 2.5 }, float: .05, rest: { yaw: -.3, pitch: 0 } };
    inst.update = (dt, t, st) => {
      const calm = st.reduced;
      ghosts.forEach(g => { const ph = g.userData.ph; g.position.z = (calm ? 0 : Math.sin(t * .8 + ph * 1.3)) * .05 + (ph - 2) * .012; g.position.x = (calm ? 0 : Math.cos(t * .6 + ph)) * .012; g.material.opacity = .12 + (calm ? 0 : Math.sin(t * 1.2 + ph) * .05); });
      orbit.children.forEach(a => { a.rotation.z += dt * (.5 + a.userData.i * .15); a.position.y = 1.7 + a.userData.i * .35 + Math.sin(t + a.userData.i) * .05; });
      if (shards) shards.children.forEach((m, i) => { const a = i / 4 * TAU + t * .35; m.position.set(Math.cos(a) * .62, 1.25 + Math.sin(t * .8 + i) * .08 + i * .1, Math.sin(a) * .62); m.rotation.set(0, -a + Math.PI / 2, Math.cos(a) * .35); });
      if (halo) halo.rotation.z += dt * .12;
      if (beam) beam.material.opacity = .28 + Math.sin(t * 1.2) * .08;
      if (motes) { const q = motes.geometry.attributes.position, b = motes.userData.base; for (let i = 0; i < q.count; i++) { q.array[i * 3] = b[i * 3] + Math.sin(t * .6 + i) * .06; q.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * .8 + i * 2) * .1; } q.needsUpdate = true; }
      if (sleepGlow) sleepGlow.material.opacity = .12 + (Math.sin(t * .8) * .5 + .5) * .14;
      gemM.emissiveIntensity = 1.7 + (calm ? 0 : Math.sin(t * 2.2) * .4);
    };
    inst.react = k => { };
    return inst;
  }
  ['rustblade', 'prismedge'].forEach(id => S.registerModel(id, { rest: { yaw: -.3, pitch: 0 }, build: ctx => build(id, ctx) }));
})();
