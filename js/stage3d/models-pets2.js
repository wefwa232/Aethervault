/* AETHERVAULT — Phase Three pets (batch A). Five new bodies that share nothing with the cloud/fox/tortoise families:
 *   Pebblor   — a stack of four river-stones (two floating arm-stones), moss tufts, a sprouting leaf. Stones hop one after another.
 *   Glimfin   — an airborne lantern-fish: S-curve swim, lace fins, a glowing lure on a stalk, bubbles.
 *   Gloomwing — a plump moth: fur, patterned wings with eye-spots, feathered antennae, drifting lamp-dust.
 *   Voidling  — a pet-shaped hole: near-black skin, violet rim, nine eyes that blink out of sync and follow the cursor, curled tendrils.
 *   Sunmane   — a lion cub whose mane is a dawn: two rows of rays that breathe, an ember-sun tail.
 * Kit parts only (K.skin/taper/face/mood/wing/flame/sparks/stageFx). Creatures face +z. Click: hop / flare. Reduced motion: breathing pose only. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, B = K.ball, clamp = U.clamp;
  const col3 = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const fur = (ctx, hex, o = {}) => { const m = ctx.F.body(hex, Object.assign({ rough: .8, clearcoat: 0, pat: .75, soft: true, vertexColors: !!o.vc }, o.mat || {})); if (m.isMeshPhysicalMaterial) { m.sheen = .35; m.sheenRoughness = .6; m.sheenColor = new THREE.Color(L.mix(ctx.item.pal[0], ctx.item.pal[3], .35)); } return m; };
  const dispG = (ctx, g) => { ctx.disposables.push(g); return g; };

  // =================================================================== PEBBLOR
  S.registerModel('pebblor', {
    rest: { yaw: -.4, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), rng = U.mulberry32(8123);
      const rock = ctx.F.body(pal[0], { rough: .9, clearcoat: 0, pat: .9, vertexColors: true }), dark = K.shade({ top: 1.05, bot: .62, blue: .05 }), mossM = fur(ctx, '#5fae5a', { mat: { rough: .95 } }), vein = F.make('glow', { color: pal[1], glow: 1.5 });
      const stones = [], mk = (key, y, r, sx, sy, sz, ph, noise = .07) => { const g = new THREE.Group(); g.position.y = y; root.add(g); const geo = K.skin(ctx, 'pebblor-' + key, [B(0, 0, 0, r, sx, sy, sz)], { cs: .045, noise, noiseScale: 4, colorFn: dark }); g.add(new THREE.Mesh(geo, rock)); stones.push({ g, y, ph, i: stones.length }); return { g, geo }; };
      const base = mk('base', .44, .44, 1.2, .78, 1.05, 0), mid = mk('mid', 1.0, .31, 1.05, .8, .98, 1), head = mk('head', 1.5, .27, 1.12, .9, 1, 2, .045);
      // moss: flattened green tufts on the tops and shoulders of the stones
      const tuft = ctx.geo('peb-tuft', () => { const g = new THREE.SphereGeometry(1, 10, 7); g.scale(1, .45, 1); return g; });
      [[base.g, [-.2, .31, .1, .13], [.18, .33, -.15, .1], [.02, .34, .26, .08]], [mid.g, [.1, .24, .05, .1], [-.12, .22, -.1, .08]], [head.g, [.12, .22, -.06, .09], [-.1, .23, -.08, .07]]].forEach(([g, ...ts]) => ts.forEach(([x, y, z, s]) => { const m = new THREE.Mesh(tuft, mossM); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set((rng() - .5) * .4, rng() * TAU, 0); g.add(m); }));
      // sprout: a stem and two leaves on the head stone
      const leafM = F.body('#7fd06a', { rough: .6, clearcoat: 0, side: THREE.DoubleSide, soft: true }), stem = new THREE.Group(); stem.position.set(0, .26, -.02); head.g.add(stem);
      stem.add(new THREE.Mesh(dispG(ctx, K.taper([[0, 0, 0], [.01, .08, 0], [.03, .17, 0]], .014, .008, { radial: 6, seg: 8 })), leafM));
      const leaf = ctx.geo('peb-leaf', () => L.extrude([[0, 0], [.07, .05], [.1, .13], [0, .22], [-.1, .13], [-.07, .05]], .012, .004, { bevelSeg: 1 }));
      [-1, 1].forEach(sd => { const l = new THREE.Mesh(leaf, leafM); l.position.set(.03, .15, 0); l.rotation.set(0, 0, -sd * 1.0); l.scale.setScalar(.9); stem.add(l); });
      // mineral veins: glowing crack lines on the base and mid stones
      [[base.g, [[-.3, .12, .3], [-.18, .26, .34], [-.1, .34, .28]], [[.28, .06, .32], [.34, .2, .26]]], [mid.g, [[.14, .02, .28], [.06, .14, .3], [.12, .24, .22]]]].forEach(([g, ...ls]) => ls.forEach(pts => g.add(new THREE.Mesh(dispG(ctx, L.tube(pts, .008, 10, 4)), vein))));
      // arm-stones float beside the body
      const arms = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(sd * .66, .98, .08); root.add(g); g.add(new THREE.Mesh(K.skin(ctx, 'pebblor-arm', [B(0, 0, 0, .15, 1, 1.1, .95)], { cs: .04, noise: .06, colorFn: dark }), rock)); const m = new THREE.Mesh(tuft, mossM); m.position.set(0, .13, 0); m.scale.setScalar(.07); g.add(m); return { g, sd }; });
      const face = K.face(ctx, head.geo.userData.field, { eye: { y: .04, dx: .115, s: .052, tilt: .05, shape: 'round' }, mouth: { y: -.1, w: .05, kind: 'tiny' }, cheek: { y: -.045, dx: .19 }, iso: .5 }, head.g);
      const fx = K.stageFx(ctx, root, { r: .75, h: 2.05, color: pal[1], core: [0, 1.0, .2] });
      const A = K.mood(), dust = K.sparks(ctx, root, { n: 6, color: '#c9d4c0', size: .05, rise: .25, spread: .9, at: [0, .1, .2], life: 2.2, opacity: .5 });
      const inst = { root, frame: { r: .95, h: 2.05 }, float: .0, rest: { yaw: -.4, pitch: 0 } };
      inst.react = k => A.react(k);
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; A.step(dt, st, calm);
        stones.forEach(o => { const hp = A.hop - o.i * .11, hop = hp > 0 && hp < .7 ? Math.sin(hp / .7 * Math.PI) * .17 : 0; o.g.position.y = o.y + hop + (calm ? 0 : Math.sin(t * 1.2 + o.ph) * .008) - A.settle * .02; o.g.rotation.y = calm ? 0 : Math.sin(t * .5 + o.ph) * .03; });
        head.g.rotation.y = A.look.x * .6; head.g.rotation.x = -A.look.y * .4 + A.settle * .25;
        arms.forEach((a, i) => { a.g.position.y = .98 + (calm ? 0 : Math.sin(t * 1.1 + i * 2) * .035) + Math.max(0, A.hopY) * .8 + (A.delight > 0 ? .08 : 0); a.g.position.x = a.sd * (.66 + (calm ? 0 : Math.sin(t * .8 + i) * .02)); a.g.rotation.z = calm ? 0 : Math.sin(t * 1.1 + i) * .1; });
        stem.rotation.z = calm ? 0 : Math.sin(t * 1.4) * .12 + A.look.x * .1; vein.emissiveIntensity = 1.4 + (calm ? 0 : Math.sin(t * 1.6) * .3) + (A.hop < .7 ? 1 : 0);
        face.update(A); dust.update(dt, t, calm ? 0 : .3); fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== GLIMFIN
  S.registerModel('glimfin', {
    rest: { yaw: -.65, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), swim = new THREE.Group(); swim.position.y = 1.05; root.add(swim);
      const col = K.shade({ top: 1.05, bot: .72, blue: .05 }, { c: col3('#e8fffb'), amt: .8, k: .05 }), skin = fur(ctx, pal[0], { vc: true, mat: { rough: .45, clearcoat: .3, soft: true } });
      const bodyGeo = K.skin(ctx, 'glimfin-body', [B(0, 0, .52, .38, .92, .95, 1.1), B(0, 0, .0, .45, .9, 1, 1.15), B(0, 0, -.5, .33, .72, .8, 1.15), B(0, .0, -.88, .2, .5, .55, 1.1)], { cs: .05, noise: .03, colorFn: col });
      swim.add(new THREE.Mesh(bodyGeo, skin));
      const face = K.face(ctx, bodyGeo.userData.field, { eye: { y: .08, dx: .21, s: .075, tilt: 0, shape: 'round' }, mouth: { y: -.12, w: .075, kind: 'smile' }, cheek: { y: -.04, dx: .29 }, iso: .5 }, swim);
      // lace fins: thin extruded shapes, translucent. Tail + dorsal live in the YZ plane (u = backwards, v = up); pectorals lie flat.
      const finM = F.make('glow', { color: L.mix(pal[0], pal[3], .35), glow: .55, side: THREE.DoubleSide }); finM.transparent = true; finM.opacity = .8; finM.depthWrite = false;
      const tailG = ctx.geo('glim-tail', () => L.extrude([[0, .05], [.25, .2], [.62, .6], [.52, .14], [.76, 0], [.52, -.14], [.62, -.6], [.25, -.2], [0, -.05]], .014, .003, { bevelSeg: 1 }));
      const dorsG = ctx.geo('glim-dors', () => L.extrude([[0, 0], [.12, .34], [.42, .52], [.68, .28], [.82, 0]], .012, .003, { bevelSeg: 1 }));
      const pecG = ctx.geo('glim-pec', () => L.extrude([[0, 0], [.3, -.02], [.55, -.2], [.62, -.46], [.3, -.34], [.05, -.16]], .012, .003, { bevelSeg: 1 }));
      const tail = new THREE.Group(); tail.position.set(0, 0, -.9); swim.add(tail); const tf = new THREE.Mesh(tailG, finM); tf.rotation.y = Math.PI / 2; tail.add(tf);
      const dorsal = new THREE.Mesh(dorsG, finM); dorsal.position.set(0, .4, .0); dorsal.rotation.y = Math.PI / 2; dorsal.scale.set(1.05, 1, 1); swim.add(dorsal);
      const pecs = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(sd * .38, -.1, .3); const f = new THREE.Mesh(pecG, finM); f.rotation.x = Math.PI / 2; f.scale.x = sd; g.add(f); g.rotation.z = sd * .25; swim.add(g); return { g, sd }; });
      // lantern lure on a curved stalk
      const stalkPts = [[0, .38, .35], [0, .78, .5], [0, .98, .86], [0, .86, 1.15]], lantern = new THREE.Group(); lantern.position.set(0, .86, 1.15); swim.add(lantern);
      swim.add(new THREE.Mesh(dispG(ctx, K.taper(stalkPts, .026, .014, { radial: 6, seg: 14 })), F.trim(L.mix(pal[3], '#b9a477', .45), { rough: .4, metal: .3 })));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.085, 16, 12), F.make('glow', { color: pal[1], glow: 1.15 })); lantern.add(bulb); ctx.disposables.push(bulb.geometry);
      const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(.13, 0), K.basic(ctx, pal[1], .14, true)); cage.userData.noSil = true; lantern.add(cage); ctx.disposables.push(cage.geometry);
      const halo = L.sprite(pal[1], .8, .4); lantern.add(halo);
      const bubbles = K.sparks(ctx, swim, { n: 12, color: '#d9fbff', size: .07, rise: .35, spread: .7, at: [0, .2, 0], life: 2.6, opacity: .6 });
      const fx = K.stageFx(ctx, root, { r: 1.0, h: 2.2, color: pal[1], core: [0, 1.05, .3] });
      const A = K.mood(), inst = { root, frame: { r: 1.2, h: 2.1 }, float: .02, rest: { yaw: -.65, pitch: 0 } };
      inst.react = k => A.react(k);
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; A.step(dt, st, calm); const w = calm ? 0 : t * 1.6;
        swim.position.y = 1.05 + (calm ? 0 : Math.sin(t * .9) * .07) + A.hopY * .6; swim.rotation.y = calm ? 0 : Math.sin(t * .6) * .1 + A.look.x * .25; swim.rotation.z = calm ? 0 : Math.sin(t * .75) * .035; swim.rotation.x = calm ? 0 : Math.sin(t * .9) * .03 - A.look.y * .1;
        tail.rotation.y = calm ? 0 : Math.sin(w) * .35; dorsal.rotation.z = calm ? 0 : Math.sin(w + 1) * .06;
        pecs.forEach(p => { p.g.rotation.z = p.sd * (.25 + (calm ? 0 : Math.sin(w * 1.2) * .22)); });
        lantern.position.y = .86 + (calm ? 0 : Math.sin(w * .8 + 1) * .03); lantern.rotation.z = calm ? 0 : Math.sin(w * .8) * .1; bulb.material.emissiveIntensity = 1.1 + (calm ? 0 : Math.sin(t * 2.4) * .25) + (A.hop < .8 ? .9 : 0); halo.material.opacity = .3 + (calm ? 0 : Math.sin(t * 2.4) * .06);
        face.update(A); bubbles.update(dt, t, calm ? 0 : .5 + (A.hop < .8 ? 2 : 0)); fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== GLOOMWING
  function wingTexture(ctx, pal, flip) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = U.mulberry32(77);
    const g = x.createRadialGradient(20, 230, 10, 80, 160, 300); g.addColorStop(0, pal[0]); g.addColorStop(.55, L.mix(pal[0], '#1c0f35', .45)); g.addColorStop(1, '#14082a'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(255,170,255,.28)'; x.lineWidth = 2; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(8, 244); x.quadraticCurveTo(80 + i * 18, 150 - i * 6, 240, 20 + i * 24); x.stroke(); }
    [[170, 90, 34], [120, 150, 20], [205, 175, 16]].forEach(([cx, cy, rr], i) => { const e = x.createRadialGradient(cx, cy, 0, cx, cy, rr); e.addColorStop(0, '#fff3c8'); e.addColorStop(.35, pal[1]); e.addColorStop(.7, '#2a1450'); e.addColorStop(1, 'rgba(42,20,80,0)'); x.fillStyle = e; x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.fill(); });
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,230,255,' + (.15 + r() * .3) + ')'; x.beginPath(); x.arc(r() * 256, r() * 256, 1 + r() * 2, 0, TAU); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ctx.tex.push(t); return t;
  }
  S.registerModel('gloomwing', {
    rest: { yaw: -.3, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), body = new THREE.Group(); body.position.y = 1.0; root.add(body);
      const col = K.shade({ top: 1.05, bot: .7, blue: .08 }, { c: col3('#f2dcff'), amt: .55, k: .1 }), furM = fur(ctx, L.mix(pal[0], '#3a2160', .25), { vc: true, mat: { rough: .9 } });
      const bodyGeo = K.skin(ctx, 'gloom-body', [B(0, .08, .0, .3, .95, 1.05, 1), B(0, -.12, -.42, .27, .88, .95, 1.25), B(0, -.26, -.8, .17, .75, .8, 1.1)], { cs: .045, noise: .06, noiseScale: 9, colorFn: col }); body.add(new THREE.Mesh(bodyGeo, furM));
      const head = new THREE.Group(); head.position.set(0, .3, .3); body.add(head);
      const headGeo = K.skin(ctx, 'gloom-head', [B(0, 0, 0, .23, 1.08, .95, .95), B(-.17, -.04, .03, .1), B(.17, -.04, .03, .1)], { cs: .04, noise: .04, noiseScale: 9, colorFn: col }); head.add(new THREE.Mesh(headGeo, furM));
      const face = K.face(ctx, headGeo.userData.field, { eye: { y: .03, dx: .1, s: .06, tilt: .1, shape: 'round' }, mouth: { y: -.09, w: .04, kind: 'tiny' }, brow: 'soft', iso: .5 }, head);
      // feathered antennae
      const antM = F.body(L.shade(pal[0], .6), { rough: .8, clearcoat: 0 }), combM = F.body(pal[1], { rough: .6, clearcoat: 0, side: THREE.DoubleSide }), ants = [];
      const comb = ctx.geo('gloom-comb', () => L.extrude([[0, 0], [.05, .015], [.12, .005], [.05, -.015]], .006, .002, { bevelSeg: 1 }));
      [-1, 1].forEach(sd => { const pts = [[0, 0, 0], [sd * .06, .22, .06], [sd * .2, .42, .1], [sd * .34, .52, .04]], g = new THREE.Group(); g.position.set(sd * .08, .2, .05); head.add(g); g.add(new THREE.Mesh(dispG(ctx, K.taper(pts, .012, .004, { radial: 5, seg: 10, ends: 'point' })), antM));
        for (let k = 1; k <= 6; k++) { const p = new THREE.Vector3(...pts[Math.min(3, Math.floor(k / 2))]).lerp(new THREE.Vector3(...pts[Math.min(3, Math.floor(k / 2) + 1)]), (k % 2) / 2); [-1, 1].forEach(s2 => { const m = new THREE.Mesh(comb, combM); m.position.copy(p); m.scale.setScalar(1.3 - k * .1); m.rotation.set(0, 0, s2 * 1.3 + sd * .2); g.add(m); }); } ants.push({ g, sd }); });
      // legs
      const legM = F.body(L.shade(pal[0], .5), { rough: .8, clearcoat: 0 });
      [[-1, .12, .12], [1, .12, .12], [-1, .08, -.05], [1, .08, -.05], [-1, .0, -.22], [1, .0, -.22]].forEach(([sd, y, z], i) => body.add(new THREE.Mesh(dispG(ctx, K.taper([[sd * .1, y - .16, z], [sd * .22, y - .3, z + .08], [sd * .26, y - .55, z + .12]], .02, .008, { radial: 5, seg: 6 })), legM)));
      // wings: broad shapes with a painted eye-spot texture; hinged at the shoulder
      const tex = wingTexture(ctx, [pal[0], pal[1]]), wingM = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: .18, roughness: .85, side: THREE.DoubleSide, transparent: true, alphaTest: .05 }); ctx.disposables.push(wingM);
      const fore = ctx.geo('gloom-fore', () => { const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(.55, .3), new THREE.Vector2(1, .62), new THREE.Vector2(.98, .95), new THREE.Vector2(.5, 1), new THREE.Vector2(.1, .5)]); return new THREE.ShapeGeometry(s, 8); });
      const hind = ctx.geo('gloom-hind', () => { const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(.5, -.1), new THREE.Vector2(.9, .05), new THREE.Vector2(.85, .5), new THREE.Vector2(.4, .55), new THREE.Vector2(.08, .3)]); return new THREE.ShapeGeometry(s, 8); });
      const wings = []; [-1, 1].forEach(sd => [[fore, 1.35, 1.15, .12, .35, .5], [hind, 1.05, .8, -.1, .05, .85]].forEach(([geo, w, h, z, lift, sweep], k) => { const piv = new THREE.Group(); piv.position.set(sd * .1, .08, z); body.add(piv); const m = new THREE.Mesh(geo, wingM); m.scale.set(w * sd, h, 1); piv.add(m); wings.push({ piv, sd, k, lift, sweep }); }));
      const dust = K.sparks(ctx, body, { n: 14, color: pal[1], size: .06, rise: -.18, spread: 1.5, at: [0, .45, -.2], life: 3, opacity: .7 });
      const fx = K.stageFx(ctx, root, { r: 1.1, h: 2.2, color: pal[1], core: [0, 1.0, .1] });
      const A = K.mood(), inst = { root, frame: { r: 1.55, h: 2.0 }, float: .03, rest: { yaw: -.3, pitch: 0 } };
      inst.react = k => A.react(k);
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; A.step(dt, st, calm);
        body.position.y = 1.0 + (calm ? 0 : Math.sin(t * 1.1) * .06) + A.hopY * .7; body.rotation.x = calm ? 0 : Math.sin(t * 1.1) * .03; head.rotation.y = A.look.x * .6; head.rotation.x = -A.look.y * .35 + A.settle * .2;
        const fl = calm ? 0 : Math.sin(t * (1.9 + A.delight * 4) + .0) * (.38 + A.hopY * 1.4); // slow, heavy flap
        wings.forEach(w => { w.piv.rotation.set(0, w.sd * w.sweep, w.sd * (w.lift + fl * (w.k ? .8 : 1))); });
        ants.forEach(a => { a.g.rotation.z = calm ? 0 : Math.sin(t * 1.6 + a.sd) * .1; a.g.rotation.x = A.wide > 0 ? -.25 : (calm ? 0 : Math.sin(t * 1.1 + a.sd * 2) * .05); });
        face.update(A); dust.update(dt, t, calm ? 0 : .5 + A.hopY * 3); fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== VOIDLING
  S.registerModel('voidling', {
    rest: { yaw: -.3, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), body = new THREE.Group(); root.add(body); const rng = U.mulberry32(6661);
      const shade = K.shade({ top: .9, bot: .45, blue: .25 });
      const geo = K.skin(ctx, 'void-body', [B(0, .72, 0, .52, 1, 1.08, .98), B(0, .38, .02, .46, 1.1, .8, 1.05), B(0, 1.02, -.04, .34, 1, .9, .95)], { cs: .05, noise: .045, noiseScale: 5, colorFn: shade });
      const skinM = F.body('#0e0a1c', { rough: .32, clearcoat: .9, ccRough: .12, pat: .35, vertexColors: true, soft: true, env: 1.4 }); body.add(new THREE.Mesh(geo, skinM));
      const rim = new THREE.Mesh(geo, K.basic(ctx, '#a05cff', .5, true, { side: THREE.BackSide })); rim.scale.setScalar(1.045); rim.position.y = -.03; rim.userData.noSil = true; rim.userData.noCast = true; body.add(rim);
      // nine eyes of different sizes spread over the front; each blinks on its own clock and follows the cursor
      const field = geo.userData.field, eyeW = K.basic(ctx, '#f6e8ff'), pupM = K.basic(ctx, '#12051f'), irisM = K.basic(ctx, pal[1]), unit = K.unitSphere(ctx), eyes = [];
      [[0, .98, .46, .1], [-.2, .84, .44, .075], [.22, .8, .43, .085], [-.35, .66, .4, .06], [.36, .62, .38, .065], [0, .66, .5, .13], [-.17, .46, .45, .05], [.14, .44, .46, .055], [0, .3, .42, .04]].forEach(([x, y, z0, s], i) => {
        const zf = K.frontPoint(field, x, y, .5, 1.2, -.2); if (zf == null) return; const n = K.surfaceNormal(field, x, y, zf), g = new THREE.Group(); g.position.set(x, y, zf - .01); g.lookAt(g.position.clone().add(n)); body.add(g);
        const inner = new THREE.Group(); g.add(inner); const w = new THREE.Mesh(unit, eyeW); w.scale.set(s, s * 1.1, s * .5); inner.add(w);
        const iris = new THREE.Mesh(unit, irisM); iris.scale.set(s * .62, s * .68, s * .3); iris.position.z = s * .32; inner.add(iris); const pup = new THREE.Mesh(unit, pupM); pup.scale.set(s * .2, s * .5, s * .2); pup.position.z = s * .52; inner.add(pup);
        eyes.push({ g, inner, iris, pup, s, ph: rng() * 6, nb: 2 + rng() * 4, blink: 0, wy: w.scale.y });
      });
      // curled tendrils at the base
      const tendM = F.body('#0e0a1c', { rough: .35, clearcoat: .8, soft: true }), tends = [];
      for (let i = 0; i < 4; i++) { const a = (i / 4 - .5) * 2.2, pts = [[Math.sin(a) * .3, .12, Math.cos(a) * .2], [Math.sin(a) * .55, .08, Math.cos(a) * .35], [Math.sin(a) * .75, .22, Math.cos(a) * .4 + .1], [Math.sin(a) * .78, .44, Math.cos(a) * .35 + .1]]; const g = new THREE.Group(); body.add(g); g.add(new THREE.Mesh(dispG(ctx, K.taper(pts, .06, .012, { radial: 8, seg: 16, ends: 'point' })), tendM)); tends.push({ g, ph: i * 1.7 }); }
      const motes = K.sparks(ctx, body, { n: 16, color: pal[1], size: .06, rise: .22, spread: 2.1, at: [0, .3, 0], life: 2.8, opacity: .8 });
      const fx = K.stageFx(ctx, root, { r: .95, h: 1.9, color: pal[1], core: [0, .8, .2] });
      const A = K.mood(), inst = { root, frame: { r: 1.0, h: 1.85 }, float: .04, rest: { yaw: -.3, pitch: 0 } };
      inst.react = k => { A.react(k); if (k === 'click') eyes.forEach(e => (e.blink = .2 + Math.random() * .2)); };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; A.step(dt, st, calm); const br = calm ? 0 : Math.sin(t * 1.2) * .018;
        body.scale.set(1 - br * .5 + (1 - A.sq) * .5, 1 + br + (A.sq - 1) * .8, 1 - br * .5 + (1 - A.sq) * .5); body.position.y = A.hopY; body.rotation.y = A.look.x * .25; rim.material.opacity = .42 + (calm ? 0 : Math.sin(t * 1.6) * .1);
        eyes.forEach((e, i) => { e.blink = Math.max(0, e.blink - dt); if (!calm && e.blink <= 0 && Math.sin(t / e.nb + e.ph) > .985) e.blink = .14; const open = e.blink > 0 ? .08 : 1; e.inner.scale.y = open; const lx = A.look.x * .5, ly = -A.look.y * .4; e.iris.position.x = lx * e.s * .35; e.iris.position.y = ly * e.s * .35; e.pup.position.x = lx * e.s * .5; e.pup.position.y = ly * e.s * .5; });
        tends.forEach(o => { o.g.rotation.y = calm ? 0 : Math.sin(t * .9 + o.ph) * .22; o.g.rotation.z = calm ? 0 : Math.cos(t * .7 + o.ph) * .06; });
        motes.update(dt, t, calm ? .1 : .6); fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== SUNMANE
  S.registerModel('sunmane', {
    rest: { yaw: -.45, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      const cream = col3(L.mix(pal[3], '#ffe9c8', .4)), shadeB = K.shade({ top: 1.04, bot: .68, blue: .04 }, { c: [1, 1.25, 1.6], amt: .7, k: .1 });
      const bodyGeo = K.skin(ctx, 'sun-body', [B(0, .62, .18, .4, 1, .95, 1.12), B(0, .6, -.28, .44, 1, .95, 1.2), B(0, .52, -.62, .3, .95, .9, 1), B(0, .9, .5, .25, 1, 1, 1)], { cs: .055, noise: .04, colorFn: shadeB });
      const mat = fur(ctx, pal[0], { vc: true }); body.add(new THREE.Mesh(bodyGeo, mat));
      const head = new THREE.Group(), HY = 1.12, HZ = .75; head.position.set(0, HY, HZ); body.add(head);
      const headGeo = K.skin(ctx, 'sun-head', [B(0, 0, 0, .33, 1.1, .95, .98), B(0, -.1, .26, .17, 1, .75, 1.2), B(-.24, -.08, .02, .14), B(.24, -.08, .02, .14)], { cs: .04, noise: .03, colorFn: K.shade({ top: 1.05, bot: .82, blue: .03 }, { c: [1, 1.2, 1.45], amt: .5, k: -.25 }) }); head.add(new THREE.Mesh(headGeo, mat));
      const face = K.face(ctx, headGeo.userData.field, { eye: { y: .06, dx: .14, s: .07, tilt: .12, shape: 'round' }, mouth: { y: -.17, w: .07, kind: 'smile' }, nose: { y: -.1, s: .03 }, cheek: { y: -.07, dx: .26 }, brow: 'soft', iso: .5 }, head);
      const earM = fur(ctx, pal[0]);
      [-1, 1].forEach(sd => { const e = new THREE.Mesh(ctx.geo('sun-ear', () => { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(1, 1, .55); return g; }), earM); e.position.set(sd * .27, .27, -.05); e.scale.setScalar(.12); head.add(e); });
      // mane: two rows of rays around the head; each ray is a tapered cone, warm gold shading to pale at the tips
      const rayM = F.make('glow', { color: '#ff9a2e', glow: .95 }), rayM2 = F.make('glow', { color: '#ffd24a', glow: .8 }), cone = ctx.geo('sun-ray', () => { const g = new THREE.ConeGeometry(1, 1, 8, 1); g.translate(0, .5, 0); return g; });
      const mane = new THREE.Group(); mane.position.set(0, 0, -.08); head.add(mane); const rays = [];
      for (let row = 0; row < 2; row++) { const n = row ? 20 : 16; for (let i = 0; i < n; i++) { const a = i / n * TAU + (row ? .15 : 0), m = new THREE.Mesh(cone, row ? rayM : rayM2), len = row ? .5 + (i % 3) * .07 : .36 + (i % 2) * .05; m.scale.set(row ? .13 : .15, len, row ? .13 : .15); m.position.set(Math.cos(a) * (row ? .3 : .26), Math.sin(a) * (row ? .3 : .26) * 1.02, -.04 - row * .05); m.rotation.z = a - Math.PI / 2; m.rotation.x = -.22; mane.add(m); rays.push({ m, a, row, len, ph: i * .7 }); } }
      // legs + paws, tail with a small sun at the tip
      const pawM = fur(ctx, L.shade(pal[0], .82)), paw = ctx.geo('sun-paw', () => { const g = new THREE.SphereGeometry(1, 14, 10); g.scale(1, .8, 1.15); return g; }), legs = [];
      [[-.3, .42], [.3, .42], [-.34, -.5], [.34, -.5]].forEach(([x, z], i) => { const g = new THREE.Group(); g.position.set(x, 0, z); const p = new THREE.Mesh(paw, pawM); p.scale.set(.15, .1, .2); p.position.y = .05; g.add(p); body.add(g); legs.push(g); body.add(new THREE.Mesh(dispG(ctx, K.taper([[x * .9, .62, z * .8], [x, .3, z], [x, .08, z]], .13, .08, { radial: 8, seg: 8 })), pawM)); });
      const tailPts = [[0, .5, -.8], [0, .42, -1.15], [.2, .5, -1.4], [.34, .74, -1.5]], tailG = K.taper(tailPts, .09, .045, { radial: 8, seg: 20 }), tail = new THREE.Mesh(tailG, mat); body.add(tail);
      const tip = tailPts[3], tailSun = new THREE.Group(); tailSun.position.set(tip[0], tip[1] + .06, tip[2]); body.add(tailSun); const sunC = new THREE.Mesh(new THREE.SphereGeometry(.1, 14, 10), F.make('glow', { color: pal[1], glow: 1.8 })); tailSun.add(sunC); ctx.disposables.push(sunC.geometry);
      const tFl = K.flame(ctx, tailSun, { r: .09, h: .3, c1: '#ffb42e', c2: '#fff6c0' }); tFl.group.position.y = .06;
      const glowDisc = L.sprite('#ffe9a0', 1.6, .2); glowDisc.position.set(0, 0, -.15); head.add(glowDisc);
      const embers = K.sparks(ctx, body, { n: 10, color: '#ffd266', size: .05, rise: .35, spread: .5, at: [tip[0], tip[1] + .1, tip[2]], life: 1.8 });
      const fx = K.stageFx(ctx, root, { r: 1.05, h: 2.15, color: pal[1], core: [0, .8, .2] });
      const A = K.mood(), inst = { root, frame: { r: 1.35, h: 2.1 }, float: .03, rest: { yaw: -.45, pitch: 0 } }; let flare = 0;
      inst.react = k => { A.react(k); if (k === 'click') flare = 1; };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; A.step(dt, st, calm); flare = Math.max(0, flare - dt * 1.2); const br = calm ? 0 : Math.sin(t * (1.4 - A.settle * .4)) * .014;
        body.scale.set(1 - br * .5 + (1 - A.sq) * .6, 1 + br + (A.sq - 1) * .8, 1 - br * .5 + (1 - A.sq) * .6); body.position.y = A.hopY - A.settle * .04;
        head.rotation.y = A.look.x * .7; head.rotation.x = -A.look.y * .5 + A.settle * .22; head.rotation.z = calm ? 0 : Math.sin(t * .7) * .03;
        const mb = calm ? 1 : 1 + Math.sin(t * 1.3) * .045 + flare * .25 + A.delight * .1; rays.forEach(r => { r.m.scale.y = r.len * mb * (calm ? 1 : 1 + Math.sin(t * 2 + r.ph) * .05); }); mane.rotation.z = calm ? 0 : Math.sin(t * .35) * .02;
        const sway = calm ? 0 : Math.sin(t * 1.5) * .07; tail.rotation.y = sway; const cs = Math.cos(sway), sn = Math.sin(sway), r0 = tailPts[0], dx = tip[0] - r0[0], dz = tip[2] - r0[2]; tailSun.position.set(r0[0] + dx * cs + dz * sn, tip[1] + .06, r0[2] - dx * sn + dz * cs);
        tFl.update(t, 1 + flare * .5, 2); sunC.material.emissiveIntensity = 1.7 + (calm ? 0 : Math.sin(t * 3) * .3) + flare * 1.5; glowDisc.material.opacity = .18 + (calm ? 0 : Math.sin(t * 1.3) * .04) + flare * .15;
        legs.forEach((l, i) => { l.position.y = A.hopY * .5 + (calm ? 0 : Math.sin(t * 1.4 + i) * .004); });
        face.update(A); embers.update(dt, t, calm ? .2 : .7 + flare * 3); fx.update(dt, t, calm);
      };
      return inst;
    },
  });
})();
