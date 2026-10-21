/* AETHERVAULT — Phase Three gear (batch B): the two shields.
 *   Oak Buckler       — round ringwood shield: planks, iron rim and straps, studded boss with a spike, dents. Click: it rings.
 *   Starforged Aegis  — heater shield of star-metal: gold border, raised inner field, eight-point star with a lit core,
 *                       constellation lines; star shards drift loose and reassemble. Click: a flare scatters them.
 * They are shields, not swords: a flat face turned to the viewer, a deliberate three-quarter rest, motion in the hardware. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, clamp = U.clamp;
  const own = (ctx, o) => { ctx.disposables.push(o); return o; };

  // =================================================================== OAK BUCKLER
  S.registerModel('oakbuckler', {
    rest: { yaw: -.5, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), sh = new THREE.Group(); sh.position.y = 1.08; sh.rotation.x = -.12; root.add(sh);
      const wood = F.body(pal[0], { rough: .72, metal: 0, clearcoat: 0, pat: .6 }), woodDk = F.body(L.shade(pal[0], .4), { rough: .85, metal: 0, clearcoat: 0, plain: true }), iron = F.trim('#6d727d', { rough: .46, metal: .85 }), ironDk = F.trim('#3a3e47', { rough: .5, metal: .8 }), brass = F.trim('#d7b46e', { rough: .3 });
      const R = .88;
      // dished disc: a lathe with a slight dome, wood grain carried by the shader pattern/wear
      const disc = new THREE.Mesh(ctx.geo('buck-disc', () => { const g = L.lathe([[0, .09], [R * .25, .095], [R * .6, .07], [R * .93, .045], [R, .03], [R, -.05], [R * .94, -.07], [R * .55, -.06], [0, -.04]], 56); g.rotateX(Math.PI / 2); return g; }), wood); sh.add(disc);
      // planks: six dark seams across the face
      for (let i = -2; i <= 3; i++) { const x = (i - .5) * R * .3, hh = Math.sqrt(Math.max(.001, R * R - x * x)) * .98, s = new THREE.Mesh(ctx.geo('buck-seam', () => new THREE.BoxGeometry(.012, 1, .012)), woodDk); s.position.set(x, 0, .092 - Math.abs(x) * .06); s.scale.y = hh * 2; sh.add(s); }
      // iron rim (the shield's own edge) + two riveted straps
      const rim = new THREE.Mesh(ctx.geo('buck-rim', () => new THREE.TorusGeometry(R, .05, 10, 64)), iron); rim.position.z = .01; sh.add(rim);
      [-1, 1].forEach(sd => { const st = new THREE.Mesh(ctx.geo('buck-strap', () => L.chamferBox(1.62, .12, .05, .015)), ironDk); st.position.set(0, sd * .36, .095); st.rotation.z = sd * .05; sh.add(st); sh.add(K.rivets(ctx, iron, [-.7, sd * .36 - .0, .125], [.7, sd * .36, .125], 7, .016)); });
      // boss: dome, ring, spike
      const boss = new THREE.Group(); boss.position.z = .1; sh.add(boss);
      boss.add(new THREE.Mesh(ctx.geo('buck-boss', () => L.lathe([[.25, 0], [.22, .05], [.15, .15], [.06, .19], [0, .2]], 28).rotateX(Math.PI / 2)), iron));
      const spike = new THREE.Mesh(ctx.geo('buck-spike', () => { const g = new THREE.ConeGeometry(.045, .2, 10); g.rotateX(Math.PI / 2); g.translate(0, 0, .26); return g; }), F.trim('#c9ccd6', { rough: .25 })); boss.add(spike);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), F.make('glow', { color: '#ffffff', glow: 1.4 })); glint.position.set(-.07, .09, .21); boss.add(glint); own(ctx, glint.geometry);
      // ring-wood heartwood medallion around the boss, carved
      const med = new THREE.Mesh(ctx.geo('buck-med', () => new THREE.TorusGeometry(.33, .018, 8, 40)), brass); med.position.z = .08; sh.add(med);
      const runes = new THREE.Mesh(new THREE.PlaneGeometry(.64, .64), K.basic(ctx, '#ffffff', 1, true, { map: K.runeTex(ctx, 311, 8, 1, 512, pal[1], { w: 512, h: 64, line: 4, gap: .1 }), depthWrite: false })); runes.userData.noSil = true; runes.visible = false; own(ctx, runes.geometry);
      // dents: shallow dark scoops
      const rng = U.mulberry32(5521), dentG = ctx.geo('buck-dent', () => { const g = new THREE.SphereGeometry(1, 10, 8); g.scale(1, 1, .18); return g; });
      for (let i = 0; i < 5; i++) { const a = rng() * TAU, rr = R * (.45 + rng() * .4), d = new THREE.Mesh(dentG, woodDk); d.position.set(Math.cos(a) * rr, Math.sin(a) * rr, .08 - rr * .06); d.scale.multiplyScalar(.05 + rng() * .06); d.rotation.z = rng() * 3; sh.add(d); }
      // back: grip strap (seen when turned)
      const grip = new THREE.Mesh(ctx.geo('buck-grip', () => L.tube([[-.3, 0, -.12], [-.3, 0, -.2], [.3, 0, -.2], [.3, 0, -.12]], .035, 12, 6)), woodDk); sh.add(grip);
      const clang = new THREE.Mesh(ctx.geo('buck-clang', () => new THREE.TorusGeometry(R * 1.02, .02, 6, 64)), K.basic(ctx, '#ffe9b0', 0, true)); clang.userData.noSil = true; clang.userData.noCast = true; clang.position.z = -.02; sh.add(clang);
      const fx = K.stageFx(ctx, root, { r: 1.05, h: 2.1, color: pal[1], core: [0, 1.08, .2] });
      let ring = 99, sway = 0; const inst = { root, frame: { r: 1.0, h: 2.05 }, float: .05, rest: { yaw: -.5, pitch: 0 } };
      inst.react = k => { if (k === 'click') { ring = 0; } };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; ring += dt;
        sh.position.y = 1.08 + (calm ? 0 : Math.sin(t * 1.0) * .03); sh.rotation.z = calm ? 0 : Math.sin(t * .6) * .03 + Math.sin(ring * 38) * .035 * Math.exp(-ring * 4);
        const k = clamp(ring / .9, 0, 1); clang.material.opacity = ring < .9 ? (1 - k) * .75 : 0; clang.scale.setScalar(1 + k * .35); glint.material.emissiveIntensity = 1.2 + (calm ? 0 : Math.sin(t * 1.7) * .4) + (ring < .5 ? 2 : 0);
        fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== STARFORGED AEGIS
  S.registerModel('aegis', {
    rest: { yaw: -.45, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), sh = new THREE.Group(); sh.position.y = 1.18; sh.rotation.x = -.06; root.add(sh);
      const steel = F.trim(pal[0], { rough: .2, metal: .95, env: 1.4, clearcoat: .7, ccRough: .08 }), field = F.trim(L.mix(pal[0], '#0b1a44', .45), { rough: .28, metal: .85, env: 1.2 }), gold = F.trim('#f6cf6a', { rough: .3, metal: .8, env: 1.9 }), core = F.make('glow', { color: pal[3], glow: 1.8 }), starM = F.make('glow', { color: pal[1], glow: 1.2 });
      const heater = (k) => [[-.72, .78], [.72, .78], [.72, .16], [.5, -.52], [0, -1.02], [-.5, -.52], [-.72, .16]].map(p => [p[0] * k, p[1] * k]);
      // gold border (back), steel face, raised inner field
      const border = new THREE.Mesh(ctx.geo('aeg-border', () => L.extrude(heater(1.06), .1, .03, { bevelSeg: 2 })), gold); border.position.z = -.04; sh.add(border);
      sh.add(new THREE.Mesh(ctx.geo('aeg-face', () => L.extrude(heater(1), .14, .03, { bevelSeg: 2 })), steel));
      const inner = new THREE.Mesh(ctx.geo('aeg-inner', () => L.extrude(heater(.84), .1, .02, { bevelSeg: 1 })), field); inner.position.z = .08; sh.add(inner);
      // star emblem: eight points, gold, over a lit core
      const star = new THREE.Group(); star.position.set(0, .1, .16); sh.add(star);
      const pts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - Math.PI / 2, r = i % 2 ? .13 : .42; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      star.add(new THREE.Mesh(ctx.geo('aeg-star', () => L.extrude(pts, .05, .012, { bevelSeg: 1 })), gold));
      const heart = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 12), core); heart.position.z = .04; star.add(heart); own(ctx, heart.geometry);
      const glow = L.sprite(pal[3], 1.2, .3); glow.position.z = .08; star.add(glow);
      // constellation: small lit stars joined by fine lines across the inner field
      const cs = [[-.38, .52], [-.2, .38], [-.34, .2], [.34, .5], [.22, .36], [.38, .18], [-.26, -.2], [-.1, -.36], [.08, -.28], [.22, -.44], [0, -.66]];
      const dots = new THREE.InstancedMesh(own(ctx, new THREE.OctahedronGeometry(.032, 0)), starM, cs.length), m4 = new THREE.Matrix4(); cs.forEach((p, i) => { m4.makeTranslation(p[0], p[1], .15); dots.setMatrixAt(i, m4); }); sh.add(dots);
      [[0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [8, 9], [9, 10]].forEach(([a, b]) => { sh.add(new THREE.Mesh(own(ctx, L.tube([[cs[a][0], cs[a][1], .145], [cs[b][0], cs[b][1], .145]], .005, 2, 4)), starM)); });
      sh.add(K.rivets(ctx, gold, [-.6, .66, .12], [.6, .66, .12], 7, .018));
      // loose star shards: drift, then are drawn back and reassemble when the shield is touched
      const shardG = ctx.geo('aeg-shard', () => { const g = new THREE.OctahedronGeometry(.07, 0); g.scale(.7, 1.4, .5); return g; }), shards = [];
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(shardG, i % 2 ? gold : starM); root.add(m); shards.push({ m, a: i / 6 * TAU, r: .95 + (i % 3) * .1, y: 1.0 + ((i * 37) % 7) / 7 * .6, sp: .3 + (i % 3) * .08 }); }
      const fx = K.stageFx(ctx, root, { r: 1.05, h: 2.3, color: pal[1], core: [0, 1.18, .3] });
      let flare = 0, scatter = 0; const inst = { root, frame: { r: 1.0, h: 2.3 }, float: .05, rest: { yaw: -.45, pitch: 0 } };
      inst.react = k => { if (k === 'click') { flare = 1; scatter = 1; } };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; flare = Math.max(0, flare - dt * 1.1); scatter = Math.max(0, scatter - dt * .6);
        sh.position.y = 1.18 + (calm ? 0 : Math.sin(t * .9) * .035); sh.rotation.y = calm ? 0 : Math.sin(t * .5) * .05; sh.rotation.z = calm ? 0 : Math.sin(t * .7) * .015;
        star.rotation.z = calm ? 0 : t * .12; heart.material.emissiveIntensity = 1.7 + (calm ? 0 : Math.sin(t * 2) * .35) + flare * 2.2; glow.material.opacity = .26 + flare * .3 + (calm ? 0 : Math.sin(t * 2) * .05); starM.emissiveIntensity = 1.1 + flare * 1.2 + (calm ? 0 : Math.sin(t * 1.3) * .2);
        shards.forEach((s, i) => { const a = s.a + (calm ? 0 : t * s.sp), rr = s.r * (1 + scatter * .8); s.m.position.set(Math.cos(a) * rr, s.y + (calm ? 0 : Math.sin(t * 1.2 + i) * .05) + scatter * .15, -Math.abs(Math.sin(a)) * rr * .55 - .15 + Math.cos(a) * .2); s.m.rotation.set(t * .5 + i, t * .7, 0); });
        fx.update(dt, t, calm);
      };
      return inst;
    },
  });
})();
