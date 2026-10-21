/* AETHERVAULT — Relic: Heart of Eternity. A faceted crystal heart suspended in an armillary cage, wrapped by an ∞ ribbon.
 * L1 gimbal ring · L2 second ring + shards · L3 full shard orbit + prism haze · L4 spire crown + halo. Beats once in a while. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util;
  const TAU = Math.PI * 2;

  function heartPoint(t, v, depth, k, out) {
    const x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const sv = Math.sin(v), table = Math.min(1, sv / .62); // flat "table" cut on the front/back faces
    out.set(x * k * table, (y + 2.5) * k * table, Math.cos(v) * depth * (1 - .08 * Math.abs(x) / 16));
    return out;
  }

  S.registerModel('heartofeternity', {
    rest: { yaw: -.35, pitch: 0 },
    build(ctx) {
      const F = ctx.F, pal = ctx.item.pal, lvl = ctx.level, root = new THREE.Group(), g = new THREE.Group(); root.add(g);
      const K = .056, DEPTH = .62;
      const geo = ctx.geo('heart-geo', () => {
        const a = L.paramSurface(26, 9, (u, v, p) => heartPoint(u * TAU, v * Math.PI, DEPTH, K, p), true).toNonIndexed(); a.computeVertexNormals();
        const col = new Float32Array(a.attributes.position.count * 3), pos = a.attributes.position, c1 = new THREE.Color(pal[0]).multiplyScalar(.85), c2 = new THREE.Color(pal[1]).multiplyScalar(.95), c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) { const y = U.clamp((pos.getY(i) + .55) / 1.35, 0, 1), h = (U.clamp(Math.sin(i * .37) * .5 + .5, 0, 1) - .5) * .12; c.copy(c1).lerp(c2, U.clamp(1 - y + h, 0, 1)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        a.setAttribute('color', new THREE.BufferAttribute(col, 3)); return a;
      });
      const mk = side => { const m = F.body('#ffffff', { rough: .16, metal: .05, clearcoat: .2, ccRough: .2, env: .55, vertexColors: true, flatShading: true, side, soft: true }); m.transparent = true; m.opacity = side === THREE.BackSide ? .7 : .86; m.depthWrite = side === THREE.BackSide; if (m.isMeshPhysicalMaterial) { m.iridescence = .8; m.iridescenceIOR = 1.5; m.iridescenceThicknessRange = [120, 520]; } return m; };
      const back = new THREE.Mesh(geo, mk(THREE.BackSide)), front = new THREE.Mesh(geo, mk(THREE.FrontSide)); back.renderOrder = 1; front.renderOrder = 3; back.userData.noCast = front.userData.noCast = true;
      const heart = new THREE.Group(); heart.add(back, front); g.add(heart);
      // inner core + veins of light
      const coreM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe3f8'), transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }); ctx.disposables.push(coreM);
      const core = new THREE.Mesh(geo, coreM); core.scale.setScalar(.5); core.renderOrder = 2; core.userData.noSil = true; heart.add(core);
      const glow = L.sprite(pal[1], 2.4, .55); glow.renderOrder = 4; glow.material.depthTest = false; heart.add(glow);
      const veinM = F.make('glow', { color: '#ffffff', glow: 1.6 });
      for (let i = 0; i < 5; i++) { const pts = [[0, .0, 0]]; const a = i / 5 * TAU + .5; for (let k = 1; k <= 5; k++) pts.push([Math.cos(a) * k * .1 + Math.sin(k * 1.7 + i) * .03, Math.sin(a) * k * .1 + .0, (Math.sin(k + i) * .08)]); const v = new THREE.Mesh(L.tube(pts, .007, 20, 4), veinM); v.userData.noCast = true; heart.add(v); }
      // ∞ ribbon (lemniscate), vertex-coloured cyan → magenta
      const N = 240, ipts = [], icol = new Float32Array((N + 1) * 3 * 0), c1 = new THREE.Color(pal[0]), c2 = new THREE.Color(pal[1]);
      for (let i = 0; i < N; i++) { const t = i / N * TAU, d = 1 + Math.sin(t) * Math.sin(t); ipts.push([1.35 * Math.cos(t) / d, 0.55 * Math.sin(t) * Math.cos(t) / d * 1.9, .0]); }
      const ig = L.tube(ipts, .018, 260, 8, true), cols = new Float32Array(ig.attributes.position.count * 3), ipos = ig.attributes.position, cc = new THREE.Color();
      for (let i = 0; i < ipos.count; i++) { const x = ipos.getX(i) / 1.35; cc.copy(c1).lerp(c2, .5 + x * .5); cols[i * 3] = cc.r; cols[i * 3 + 1] = cc.g; cols[i * 3 + 2] = cc.b; }
      ig.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const iM = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }); ctx.disposables.push(iM);
      const inf = new THREE.Mesh(ig, iM); inf.userData.noSil = true; inf.rotation.x = .25; g.add(inf);
      const silv = F.trim('#c8d2e6', { rough: .2, plain: true }), brass = F.trim('#b48d4c', { rough: .28, plain: true });
      // cradle: three claws from a ring beneath
      const base = new THREE.Mesh(L.lathe([[0, 0], [.55, 0], [.58, .03], [.5, .07], [.42, .09], [.3, .16], [.12, .22], [.08, .5], [.14, .56]], 40), F.trim('#2a2620', { rough: .45, metal: .7, plain: true })); root.add(base);
      const ring0 = new THREE.Mesh(new THREE.TorusGeometry(.5, .018, 8, 56), brass); ring0.rotation.x = Math.PI / 2; ring0.position.y = .05; root.add(ring0);
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .6, pts = [[Math.cos(a) * .32, .2, Math.sin(a) * .32], [Math.cos(a) * .42, .5, Math.sin(a) * .42], [Math.cos(a) * .5, .85, Math.sin(a) * .5], [Math.cos(a) * .36, 1.08, Math.sin(a) * .36]]; root.add(new THREE.Mesh(L.tube(pts, .022, 24, 8), brass)); }
      g.position.y = 1.5;
      // stage additions
      const rings = [], shards = [], extra = new THREE.Group(); g.add(extra);
      if (lvl >= 1) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.2, .016, 8, 96), silv); r.userData.ax = [1, .3, 0]; r.userData.stageRing = true; rings.push(r); extra.add(r); for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.OctahedronGeometry(.03, 0), F.make('glow', { color: '#ffffff', glow: 1.6 })); const a = i / 8 * TAU; b.position.set(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0); r.add(b); ctx.disposables.push(b.geometry); } }
      if (lvl >= 2) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.0, .014, 8, 96), brass); r.userData.ax = [.2, 1, .4]; r.userData.stageRing = true; rings.push(r); extra.add(r); }
      const nSh = lvl >= 3 ? 9 : lvl >= 2 ? 4 : 0;
      for (let i = 0; i < nSh; i++) { const m = new THREE.Mesh(ctx.geo('heart-shard', () => { const o = new THREE.OctahedronGeometry(.1, 0); o.scale(.55, 1.5, .55); return o; }), F.body(pal[0], { rough: .12, metal: .2, clearcoat: 1, env: 2 })); m.userData.i = i; shards.push(m); extra.add(m); }
      let haze = null, spires = null, halo = null;
      if (lvl >= 3) { haze = new THREE.Mesh(new THREE.TorusGeometry(1.55, .35, 8, 64), new THREE.MeshBasicMaterial({ map: L.glowTex(), color: new THREE.Color(pal[1]), transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false })); haze.rotation.x = Math.PI / 2; haze.userData.noSil = true; ctx.disposables.push(haze.material); g.add(haze); }
      if (lvl >= 4) {
        spires = new THREE.Group(); for (let i = 0; i < 7; i++) { const a = (i / 7 - .5) * 2.2, m = new THREE.Mesh(new THREE.PlaneGeometry(.12, 1.4 + (i % 3) * .35), new THREE.MeshBasicMaterial({ map: L.shaftTex(), color: new THREE.Color(i % 2 ? pal[0] : pal[1]), transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.set(Math.sin(a) * .9, .9 + Math.cos(a) * .6, -.2); m.rotation.z = -a; m.userData.noSil = true; spires.add(m); ctx.disposables.push(m.material); } g.add(spires);
        halo = new THREE.Mesh(new THREE.TorusGeometry(1.55, .012, 8, 96), brass); halo.rotation.x = Math.PI / 2 - .5; halo.position.y = -.2; g.add(halo);
      }
      // potential
      let motes = null; if (ctx.potentialTier >= 1) { const n = Math.round(18 * ctx.q.particles), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = .7 + Math.random() * .9; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (Math.random() - .5) * 1.6; pos[i * 3 + 2] = Math.sin(a) * r; } const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const mm = new THREE.PointsMaterial({ map: L.dotTex(), color: new THREE.Color('#ffffff'), size: .06, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }); motes = new THREE.Points(gg, mm); motes.userData.noSil = true; motes.userData.base = pos.slice(); g.add(motes); ctx.disposables.push(mm); }
      const inst = { root, frame: { r: 1.5, h: 3.1 }, float: .06, rest: { yaw: -.35, pitch: 0 }, beatT: 99 };
      inst.react = k => { if (k === 'click') inst.beatT = 0; };
      let nextBeat = 6;
      inst.update = (dt, t, st) => {
        const calm = st.reduced; if (!calm) { nextBeat -= dt; if (nextBeat <= 0) { inst.beatT = 0; nextBeat = 9 + Math.random() * 6; } } inst.beatT += dt;
        const bt = inst.beatT, beat = bt < 1.2 ? Math.exp(-bt * 3.2) * Math.sin(bt * 11) * .5 + Math.exp(-bt * 2) * .5 : 0;
        const sc = 1 + (calm ? 0 : Math.sin(t * 1.1) * .012) + beat * .06; heart.scale.setScalar(sc); heart.rotation.y = calm ? 0 : Math.sin(t * .4) * .12;
        coreM.opacity = .55 + beat * .5 + (calm ? 0 : Math.sin(t * 1.6) * .1); glow.material.opacity = .4 + beat * .5; veinM.emissiveIntensity = 1.4 + beat * 3;
        inf.rotation.y = calm ? 0 : t * .18; inf.rotation.z = calm ? 0 : Math.sin(t * .3) * .12;
        rings.forEach((r, i) => { const ax = r.userData.ax; r.rotation.x = (calm ? 0 : t * .2 * ax[0]) + i; r.rotation.y = (calm ? 0 : t * .25 * ax[1]); r.rotation.z = (calm ? 0 : t * .15 * ax[2]); });
        shards.forEach((m, i) => { const a = i / shards.length * TAU + t * .3, r = 1.05 + (i % 3) * .16; m.position.set(Math.cos(a) * r, Math.sin(t * .7 + i) * .45, Math.sin(a) * r); m.rotation.set(t * .5 + i, a, t * .3); });
        if (spires) spires.children.forEach((m, i) => (m.material.opacity = .5 + Math.sin(t * .9 + i) * .15)); if (halo) halo.rotation.z += dt * .1; if (haze) haze.material.opacity = .11 + Math.sin(t * .5) * .03;
        if (motes) { const p = motes.geometry.attributes.position, b = motes.userData.base; for (let i = 0; i < p.count; i++) { p.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * .5 + i * 1.3) * .15; p.array[i * 3] = b[i * 3] + Math.cos(t * .3 + i) * .06; } p.needsUpdate = true; }
      };
      return inst;
    },
  });
})();
