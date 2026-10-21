/* AETHERVAULT — Phase Three relics (batch C). Four objects with four different kinds of age:
 *   Bone Charm       — a carved knucklebone on a leather cord with two beads, hung from a brass crook. It swings; a click sets it swinging harder.
 *   Amber Fossil     — a honey-amber stone with a winged insect suspended inside, bubbles, brass claws. The wings tremble; the light drifts.
 *   Eclipse Scepter  — a banded staff cradling a black disc inside a corona of rays; a pool of shadow lies round its foot and breathes.
 *   Sunken Crown     — a gold crown with seven peaks and pearls, wearing coral, barnacles and swaying kelp; it drips.
 * Kit parts only; all keep a deliberate rest pose for thumbnails. Reduced motion freezes the swing/sway/drips. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, B = K.ball, clamp = U.clamp;
  const own = (ctx, o) => { ctx.disposables.push(o); return o; };
  const shadeV = (top, bot) => K.shade({ top, bot, blue: .02 });

  // =================================================================== BONE CHARM
  S.registerModel('bonecharm', {
    rest: { yaw: -.35, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group();
      const brass = F.trim('#b99b5a', { rough: .4, metal: .8 }), leather = F.body('#6a4a30', { rough: .85, metal: 0, clearcoat: 0, plain: false }), bone = F.body(pal[0], { rough: .55, metal: 0, clearcoat: .1, pat: .6, vertexColors: true }), carve = F.body('#3a2a1c', { rough: .9, metal: 0, clearcoat: 0, plain: true });
      // crook: a stand rising from the pedestal and bending over so the charm hangs in the middle of the stage
      root.add(new THREE.Mesh(own(ctx, K.taper([[-.8, 0, -.3], [-.8, 1.5, -.3], [-.7, 2.3, -.22], [-.4, 2.5, -.1], [0, 2.4, 0]], .05, .022, { radial: 8, seg: 30 })), brass));
      const knob = new THREE.Mesh(ctx.geo('bc-knob', () => new THREE.SphereGeometry(.075, 12, 10)), brass); knob.position.set(0, 2.38, 0); root.add(knob);
      const base = new THREE.Mesh(ctx.geo('bc-base', () => L.lathe([[0, 0], [.2, 0], [.22, .05], [.12, .12], [.07, .2], [0, .22]], 24)), brass); base.position.set(-.8, 0, -.3); root.add(base);
      const pend = new THREE.Group(); pend.position.set(0, 2.36, 0); root.add(pend);
      // cord: a loop down to the bone, with two beads
      const cordPts = [[0, 0, 0], [.07, -.18, .01], [.06, -.42, 0], [0, -.62, 0]]; pend.add(new THREE.Mesh(own(ctx, K.taper(cordPts, .03, .026, { radial: 6, seg: 14 })), leather));
      const bead = (y, col, r) => { const m = new THREE.Mesh(ctx.geo('bc-bead', () => new THREE.SphereGeometry(1, 14, 10)), F.body(col, { rough: .5, clearcoat: .2 })); m.position.set(.06, y, 0); m.scale.setScalar(r); pend.add(m); return m; };
      bead(-.26, '#e8d6b0', .05); bead(-.4, '#ffb43a', .045);
      // the knucklebone: three lobed ends and a waisted body, with carved notches
      const boneGeo = K.skin(ctx, 'bonecharm-bone', [B(0, 0, 0, .15, 1.05, 1.55, .95), B(-.13, .3, .0, .115, 1, 1, 1), B(.11, .31, .03, .105), B(-.1, -.3, -.02, .12), B(.13, -.28, .02, .11), B(0, .0, .0, .12, 1.15, 1.1, 1)], { cs: .03, noise: .035, noiseScale: 7, colorFn: shadeV(1.05, .72) });
      const bg = new THREE.Group(); bg.position.set(0, -1.08, 0); bg.scale.setScalar(1.75); pend.add(bg); bg.add(new THREE.Mesh(boneGeo, bone));
      [[-.1, .1, .12], [.02, .02, .14], [-.06, -.1, .13]].forEach(([x, y, z], i) => { const n = new THREE.Mesh(ctx.geo('bc-notch', () => new THREE.BoxGeometry(.1, .012, .012)), carve); n.position.set(x, y, z); n.rotation.z = .5 - i * .5; bg.add(n); });
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(.22, .3), K.basic(ctx, '#ffffff', 1, true, { map: K.runeTex(ctx, 77, 2, 3, 128, pal[1], { w: 128, h: 192, line: 4 }), depthWrite: false })); rune.position.set(0, .02, .15); rune.userData.noSil = true; rune.visible = ctx.level >= 1; bg.add(rune); own(ctx, rune.geometry);
      const loop = new THREE.Mesh(ctx.geo('bc-loop', () => new THREE.TorusGeometry(.05, .014, 6, 16)), leather); loop.position.set(0, -.6, 0); pend.add(loop);
      const fx = K.stageFx(ctx, root, { r: .85, h: 2.4, color: pal[1], core: [0, 1.25, .1] });
      let swing = 0; const inst = { root, frame: { r: .85, h: 2.45 }, float: 0, rest: { yaw: -.35, pitch: 0 } };
      inst.react = k => { if (k === 'click') swing = 1; };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; swing = Math.max(0, swing - dt * .35);
        pend.rotation.z = calm ? 0 : Math.sin(t * 1.15) * (.05 + swing * .35); pend.rotation.x = calm ? 0 : Math.sin(t * .9 + 1) * (.03 + swing * .12); bg.rotation.y = calm ? 0 : t * .25 + swing * Math.sin(t * 4) * .3; fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== AMBER FOSSIL
  S.registerModel('amberfossil', {
    rest: { yaw: -.5, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), gem = new THREE.Group(); gem.position.y = 1.12; root.add(gem);
      const brass = F.trim('#c9a24f', { rough: .32, metal: .9 }), amberCol = pal[0];
      // the stone: a smooth irregular lump; translucent so the insect shows through
      const stoneGeo = K.skin(ctx, 'amber-stone', [B(0, 0, 0, .52, 1.1, 1.02, .85), B(.12, .2, .04, .4, 1, .9, .9), B(-.2, -.12, .02, .36, 1, .95, .8), B(.04, .34, -.05, .28)], { cs: .045, noise: .02, noiseScale: 3 });
      const amber = F.make('glass', { color: amberCol, opacity: .5 }); amber.emissive = new THREE.Color(L.mix(amberCol, '#ff8a00', .4)); amber.emissiveIntensity = .22; amber.transparent = true; amber.depthWrite = false;
      const stone = new THREE.Mesh(stoneGeo, amber); stone.renderOrder = 3; gem.add(stone);
      const core = L.sprite('#ffb43a', 1.6, .3); gem.add(core);
      // insect: thorax, abdomen, head, two pairs of veined wings, six legs, two antennae — dark against the glow
      const ins = new THREE.Group(); ins.position.set(0, -.02, .0); ins.rotation.set(.35, .5, -.2); ins.scale.setScalar(1.3); gem.add(ins);
      const dark = F.body('#3a1f0c', { rough: .6, clearcoat: .3, plain: true }), wingM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#1c0e04'), transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }); own(ctx, wingM);
      [[0, .06, .0, .1, .9, .9], [0, -.03, -.22, .08, .8, 1.5], [0, .09, .17, .065, 1, 1]].forEach(([x, y, z, r, sy, sz]) => { const m = new THREE.Mesh(ctx.geo('amb-ball', () => new THREE.SphereGeometry(1, 14, 10)), dark); m.position.set(x, y, z); m.scale.set(r, r * sy, r * sz); ins.add(m); });
      const wingG = ctx.geo('amb-wing', () => new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(.28, .1), new THREE.Vector2(.52, .02), new THREE.Vector2(.46, -.1), new THREE.Vector2(.22, -.12)]), 8)), wings = [];
      [-1, 1].forEach(sd => [[.12, 0, .0, .25], [-.12, 0, -.1, .1]].forEach(([z, y, dz, a], k) => { const piv = new THREE.Group(); piv.position.set(sd * .03, .12, z); ins.add(piv); const w = new THREE.Mesh(wingG, wingM); w.scale.x = sd * (k ? .85 : 1); w.rotation.x = -Math.PI / 2 + .2; piv.add(w); wings.push({ piv, sd, k }); }));
      const legM = dark; for (let i = 0; i < 6; i++) { const sd = i % 2 ? 1 : -1, z = .12 - Math.floor(i / 2) * .1; ins.add(new THREE.Mesh(own(ctx, K.taper([[sd * .04, .02, z], [sd * .13, -.04, z + .02], [sd * .16, -.14, z - .02]], .008, .003, { radial: 4, seg: 6 })), legM)); }
      [-1, 1].forEach(sd => ins.add(new THREE.Mesh(own(ctx, K.taper([[sd * .02, .1, .24], [sd * .07, .16, .36], [sd * .13, .15, .44]], .006, .002, { radial: 4, seg: 6 })), legM)));
      // bubbles trapped in the resin
      const bub = K.basic(ctx, '#fff2c8', .35, true), bubs = []; for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(ctx.geo('amb-bub', () => new THREE.SphereGeometry(1, 8, 6)), bub); m.position.set((Math.sin(i * 2.1)) * .3, Math.cos(i * 1.3) * .28, .12 + Math.sin(i) * .2); m.scale.setScalar(.012 + (i % 3) * .008); m.userData.noSil = true; gem.add(m); bubs.push({ m, y: m.position.y, ph: i }); }
      // brass cup + four claws
      const cup = new THREE.Mesh(ctx.geo('amb-cup', () => L.lathe([[0, 0], [.4, 0], [.46, .03], [.5, .1], [.42, .22], [.2, .26], [0, .26]], 32)), brass); cup.position.y = 0; root.add(cup);
      const stem = new THREE.Mesh(ctx.geo('amb-stem', () => L.lathe([[0, 0], [.14, 0], [.1, .3], [.2, .5], [.34, .56], [0, .56]], 24)), brass); root.add(stem); cup.position.y = .4; cup.scale.set(1.0, .6, 1.0);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4, pts = [[Math.cos(a) * .42, .52, Math.sin(a) * .42], [Math.cos(a) * .58, .78, Math.sin(a) * .58], [Math.cos(a) * .6, 1.12, Math.sin(a) * .6], [Math.cos(a) * .44, 1.42, Math.sin(a) * .44]]; root.add(new THREE.Mesh(own(ctx, K.taper(pts, .035, .012, { radial: 6, seg: 14, ends: 'round' })), brass)); }
      const fx = K.stageFx(ctx, root, { r: .85, h: 2.0, color: pal[1], core: [0, 1.12, .2] });
      let ping = 0; const inst = { root, frame: { r: .85, h: 1.85 }, float: .02, rest: { yaw: -.5, pitch: 0 } };
      inst.react = k => { if (k === 'click') ping = 1; };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; ping = Math.max(0, ping - dt * .8);
        gem.position.y = 1.12 + (calm ? 0 : Math.sin(t * .8) * .02); gem.rotation.y = calm ? 0 : Math.sin(t * .35) * .1;
        wings.forEach(w => { w.piv.rotation.z = w.sd * (calm ? 0 : Math.sin(t * (9 + ping * 14) + w.k) * (.05 + ping * .35)); }); ins.rotation.z = -.2 + (calm ? 0 : Math.sin(t * 1.1) * .015);
        bubs.forEach(b => { b.m.position.y = b.y + (calm ? 0 : Math.sin(t * .5 + b.ph) * .03); }); core.material.opacity = .26 + (calm ? 0 : Math.sin(t * 1.2) * .06) + ping * .3; amber.emissiveIntensity = .2 + ping * .5;
        fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== ECLIPSE SCEPTER
  S.registerModel('eclipsescepter', {
    rest: { yaw: -.35, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), sc = new THREE.Group(); sc.rotation.z = -.1; root.add(sc);
      const wood = F.body('#2a1d36', { rough: .4, metal: .1, clearcoat: .5 }), gold = F.trim('#e6b94a', { rough: .28, metal: .95, env: 1.6 }), void_ = F.plain('#050308', { rough: 1, metal: 0 }), glow = F.make('glow', { color: pal[1], glow: 1.5 });
      // shaft: lathe with swelling knuckles and gold bands
      const prof = [[0, 0], [.07, 0], [.085, .08], [.05, .12]]; for (let i = 0; i < 6; i++) { const y = .3 + i * .33; prof.push([.04, y], [.06, y + .09], [.045, y + .17]); } prof.push([.04, 2.05], [.09, 2.12], [.05, 2.18], [0, 2.18]);
      sc.add(new THREE.Mesh(ctx.geo('esc-shaft', () => L.lathe(prof, 18)), wood));
      [.12, .62, 1.2, 1.72, 2.1].forEach((y, i) => { const b = new THREE.Mesh(ctx.geo('esc-band', () => new THREE.CylinderGeometry(.075, .075, .05, 16)), gold); b.position.y = y; b.scale.setScalar(i === 4 ? 1.25 : 1); sc.add(b); });
      const foot = new THREE.Mesh(ctx.geo('esc-foot', () => L.lathe([[0, -.1], [.04, -.06], [.09, 0], [.0, 0]], 12)), gold); sc.add(foot);
      // head: a cradle of five curved prongs holding the black disc
      const head = new THREE.Group(); head.position.y = 2.55; sc.add(head);
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; head.add(new THREE.Mesh(own(ctx, K.taper([[Math.cos(a) * .06, -.34, Math.sin(a) * .06], [Math.cos(a) * .3, -.24, Math.sin(a) * .3], [Math.cos(a) * .36, .08, Math.sin(a) * .36], [Math.cos(a) * .22, .3, Math.sin(a) * .22]], .035, .016, { radial: 6, seg: 14 })), gold)); }
      const disc = new THREE.Mesh(ctx.geo('esc-disc', () => new THREE.SphereGeometry(.27, 28, 20)), void_); disc.position.y = .02; head.add(disc);
      // corona: soft halo + thin rays, billboarded to the camera by living in the head group's plane (it faces +z; the stage rests the scepter facing the viewer)
      const corona = new THREE.Group(); corona.position.set(0, .02, -.06); head.add(corona); K.noSil(corona);
      const halo = L.sprite(pal[1], 1.5, .5); corona.add(halo); const halo2 = L.sprite('#fff3c8', .75, .5); corona.add(halo2);
      const rayM = K.basic(ctx, pal[1], .5, true, { map: L.shaftTex(), side: THREE.DoubleSide }), rays = [];
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, m = new THREE.Mesh(ctx.geo('esc-ray', () => new THREE.PlaneGeometry(.06, 1)), rayM); m.position.set(Math.cos(a) * .52, Math.sin(a) * .52, 0); m.rotation.z = a - Math.PI / 2; m.scale.y = .5 + (i % 3) * .25; corona.add(m); rays.push({ m, base: m.scale.y, ph: i }); }
      // shadow pool at the foot: a dark soft disc that breathes, with three drifting tendrils
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: L.shadowTex(), transparent: true, opacity: .8, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = .01; pool.scale.setScalar(1.9); pool.userData.noSil = true; pool.userData.noCast = true; root.add(pool); own(ctx, pool.material);
      const fx = K.stageFx(ctx, root, { r: .9, h: 3.0, color: pal[1], core: [0, 2.55, .2] });
      let flare = 0; const inst = { root, frame: { r: .95, h: 3.0 }, float: .0, rest: { yaw: -.35, pitch: 0 } };
      inst.react = k => { if (k === 'click') flare = 1; };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; flare = Math.max(0, flare - dt * .7);
        corona.rotation.z = calm ? 0 : t * .08; rays.forEach(r => { r.m.scale.y = r.base * (calm ? 1 : .85 + Math.sin(t * 1.6 + r.ph) * .18) * (1 + flare * .7); }); halo.material.opacity = .42 + flare * .35 + (calm ? 0 : Math.sin(t * 1.2) * .06); halo2.material.opacity = .4 + flare * .4;
        head.position.y = 2.55 + (calm ? 0 : Math.sin(t * .9) * .025); pool.scale.setScalar(1.9 + (calm ? 0 : Math.sin(t * .8) * .12) + flare * .6); pool.material.opacity = .78 + flare * .15; glow.emissiveIntensity = 1.5 + flare; fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== SUNKEN CROWN
  S.registerModel('sunkencrown', {
    rest: { yaw: -.4, pitch: .18 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), cr = new THREE.Group(); cr.position.y = 1.0; cr.rotation.x = -.22; root.add(cr);
      const gold = F.trim('#e0b84a', { rough: .26, metal: 1, env: 1.7 }), goldDk = F.trim('#9a7a2a', { rough: .4, metal: .9 }), pearl = F.body('#f4ecdc', { rough: .18, metal: 0, clearcoat: 1, ccRough: .05, plain: true }), teal = F.make('glow', { color: pal[1], glow: .9 }), coral = F.body('#e8806a', { rough: .75, metal: 0, clearcoat: 0, pat: .5 }), barn = F.body('#b8b4a4', { rough: .9, metal: 0, clearcoat: 0 }), kelp = F.body('#3f7a4a', { rough: .6, metal: 0, clearcoat: 0, side: THREE.DoubleSide });
      // band: open lathe, rim beads, seven peaks each tipped with a pearl, teal cabochons between
      cr.add(new THREE.Mesh(ctx.geo('sc-band', () => { const g = L.lathe([[.6, 0], [.64, .03], [.66, .15], [.64, .3], [.6, .33], [.58, .3], [.58, .03]], 56); return g; }), gold));
      const peakG = ctx.geo('sc-peak', () => { const g = new THREE.ConeGeometry(1, 1, 5); g.translate(0, .5, 0); return g; }), pearlG = ctx.geo('sc-pearl', () => new THREE.SphereGeometry(1, 14, 10)), gemG = ctx.geo('sc-gem', () => { const g = new THREE.OctahedronGeometry(1, 0); g.scale(.7, 1, .5); return g; });
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU, x = Math.cos(a) * .62, z = Math.sin(a) * .62, tall = i % 2 ? .3 : .42, pk = new THREE.Mesh(peakG, i % 2 ? goldDk : gold); pk.position.set(x, .3, z); pk.scale.set(.1, tall, .1); cr.add(pk);
        const p = new THREE.Mesh(pearlG, pearl); p.position.set(x, .3 + tall + .035, z); p.scale.setScalar(.06); cr.add(p);
        const g = new THREE.Mesh(gemG, teal); g.position.set(Math.cos(a + TAU / 14) * .665, .17, Math.sin(a + TAU / 14) * .665); g.lookAt(g.position.clone().multiplyScalar(2)); g.scale.setScalar(.055); cr.add(g);
        const bead = new THREE.Mesh(pearlG, pearl); bead.position.set(Math.cos(a + TAU / 14) * .6, .335, Math.sin(a + TAU / 14) * .6); bead.scale.setScalar(.032); cr.add(bead);
      }
      // growth: barnacle clusters, two coral branches, a few kelp tassels
      const rng = U.mulberry32(4242), bg = ctx.geo('sc-barn', () => { const g = new THREE.ConeGeometry(1, 1, 7); g.translate(0, .5, 0); return g; });
      for (let i = 0; i < 16; i++) { const a = .3 + rng() * 2.6, r = .66, m = new THREE.Mesh(bg, barn); m.position.set(Math.cos(a) * r, .04 + rng() * .24, Math.sin(a) * r); m.lookAt(m.position.clone().multiplyScalar(2)); m.rotateX(Math.PI / 2); m.scale.set(.03 + rng() * .02, .05 + rng() * .04, .03 + rng() * .02); cr.add(m); }
      [[-.4, .6, [[0, .2, 0], [-.05, .45, .04], [-.14, .7, .02]]], [-.46, .52, [[0, .15, 0], [.06, .35, -.02], [.0, .56, .04]]]].forEach(([x, z, pts], i) => { const g = new THREE.Group(); g.position.set(i ? -.62 : -.28, .22, i ? .12 : .56); cr.add(g); g.add(new THREE.Mesh(own(ctx, K.taper(pts, .045, .012, { radial: 7, seg: 10, ends: 'round' })), coral)); g.add(new THREE.Mesh(own(ctx, K.taper([pts[1], [pts[1][0] + .12, pts[1][1] + .16, pts[1][2]]], .03, .01, { radial: 6, seg: 5 })), coral)); });
      const tassels = []; for (let i = 0; i < 5; i++) { const a = Math.PI * (.9 + i * .22), g = new THREE.Group(); g.position.set(Math.cos(a) * .64, .06, Math.sin(a) * .64); cr.add(g); const m = new THREE.Mesh(own(ctx, K.taper([[0, 0, 0], [.02, -.18, .02], [-.02, -.38, .03], [.03, -.62, 0]], .035, .006, { radial: 4, seg: 12 })), kelp); m.scale.z = .3; g.add(m); tassels.push({ g, ph: i * 1.3 }); }
      const drip = K.sparks(ctx, cr, { n: 8, color: '#bfeeff', size: .05, rise: -.5, spread: 1.0, at: [0, .05, 0], life: 1.6, opacity: .8 });
      const fx = K.stageFx(ctx, root, { r: .9, h: 1.9, color: pal[1], core: [0, 1.0, .2] });
      let shake = 0; const inst = { root, frame: { r: 1.0, h: 1.95, cy: .02 }, float: .03, rest: { yaw: -.4, pitch: .18 } };
      inst.react = k => { if (k === 'click') shake = 1; };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; shake = Math.max(0, shake - dt * 1.3);
        cr.position.y = 1.0 + (calm ? 0 : Math.sin(t * .9) * .03); cr.rotation.y = calm ? 0 : Math.sin(t * .4) * .08 + Math.sin(shake * 20) * .04 * shake; cr.rotation.x = -.22 + (calm ? 0 : Math.sin(t * .7) * .015);
        tassels.forEach(o => { o.g.rotation.z = calm ? 0 : Math.sin(t * 1.3 + o.ph) * .18 + shake * .2; o.g.rotation.x = calm ? 0 : Math.cos(t * .9 + o.ph) * .08; });
        teal.emissiveIntensity = .9 + (calm ? 0 : Math.sin(t * 1.5) * .25) + shake; drip.update(dt, t, calm ? 0 : .35 + shake * 3); fx.update(dt, t, calm);
      };
      return inst;
    },
  });
})();
