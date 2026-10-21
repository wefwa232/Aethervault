/* AETHERVAULT — Phase Three machines (batch D). Three vehicles with three different ideas of "moving":
 *   Sky Skiff     — a wooden river skiff carried by a gas-bag on rope rigging, a ducted fan at the stern, side fins, a bow lantern, a pennant.
 *   Chrono Racer  — a teardrop retro racer with a clock-face on the bonnet; two time-echoes trail behind it and catch up when it surges.
 *   Starhopper    — a white-and-red hopper on three legs; it hops in place, squashing on landing, between three star-stones.
 * Built from lathe/extrude/taper parts and kit helpers; each has a real moving mechanism (fan, hands and echoes, hop cycle). */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, clamp = U.clamp;
  const own = (ctx, o) => { ctx.disposables.push(o); return o; };
  const ease = t => t * t * (3 - 2 * t);

  // =================================================================== SKY SKIFF
  S.registerModel('skyskiff', {
    rest: { yaw: -.65, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), boat = new THREE.Group(); boat.position.y = .95; root.add(boat);
      const wood = F.body(pal[0], { rough: .6, metal: 0, clearcoat: .15, pat: .6 }), woodDk = F.body(L.shade(pal[0], .6), { rough: .7, metal: 0, clearcoat: 0 }), brass = F.trim('#c9a24f', { rough: .35, metal: .85 }), cloth = F.body('#f1e6cf', { rough: .85, metal: 0, clearcoat: 0, soft: true, pat: .5 }), red = F.body(pal[1], { rough: .7, metal: 0, clearcoat: 0, side: THREE.DoubleSide, soft: true }), glow = F.make('glow', { color: '#ffd27a', glow: 1.5 });
      const plan = (k, w = 1) => [[0, 1.25], [.3, .8], [.42, .1], [.36, -.8], [.0, -1.02], [-.36, -.8], [-.42, .1], [-.3, .8]].map(p => [p[0] * k * w, p[1] * k]);
      const hullG = ctx.geo('skiff-hull', () => { const g = L.extrude(plan(1), .34, .02, { holes: [plan(.84).reverse()], bevelSeg: 1 }); g.rotateX(-Math.PI / 2); return g; }), keelG = ctx.geo('skiff-keel', () => { const g = L.extrude(plan(.8, .7), .14, .02, { bevelSeg: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, -.15, 0); return g; });
      const hull = new THREE.Mesh(hullG, wood); hull.position.y = .02; boat.add(hull); boat.add(new THREE.Mesh(keelG, woodDk));
      const floor = new THREE.Mesh(ctx.geo('skiff-floor', () => { const g = L.extrude(plan(.86), .04, .005, { bevelSeg: 1 }); g.rotateX(-Math.PI / 2); return g; }), woodDk); floor.position.y = .1; boat.add(floor);
      [[-.3, .2], [.3, .2], [-.25, -.45], [.25, -.45]].forEach(([x, z]) => { const th = new THREE.Mesh(ctx.geo('skiff-thwart', () => new THREE.BoxGeometry(.7, .05, .09)), woodDk); th.position.set(0, .26, z); th.scale.x = 1 - Math.abs(z) * .3; boat.add(th); });
      boat.add(K.rivets(ctx, brass, [-.38, .36, .3], [-.38, .36, -.6], 6, .015), K.rivets(ctx, brass, [.38, .36, .3], [.38, .36, -.6], 6, .015));
      // bow: lantern on a short post; stern: pennant mast
      const post = new THREE.Mesh(own(ctx, K.taper([[0, .3, 1.0], [0, .6, 1.06], [0, .72, 1.12]], .02, .016, { radial: 6, seg: 6 })), brass); boat.add(post);
      const lamp = new THREE.Mesh(ctx.geo('skiff-lamp', () => new THREE.SphereGeometry(.07, 12, 10)), glow); lamp.position.set(0, .8, 1.12); boat.add(lamp); const lg = L.sprite('#ffd27a', .7, .35); lg.position.copy(lamp.position); boat.add(lg);
      const mast = new THREE.Mesh(own(ctx, K.taper([[0, .3, -.8], [0, 1.1, -.84]], .02, .012, { radial: 6, seg: 4 })), woodDk); boat.add(mast);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(.34, .16, 6, 1), red); flag.position.set(.17, 1.0, -.84); boat.add(flag); own(ctx, flag.geometry); const fp = flag.geometry.attributes.position, fp0 = fp.array.slice();
      // gas-bag with rigging
      const bag = new THREE.Mesh(ctx.geo('skiff-bag', () => { const g = new THREE.SphereGeometry(1, 36, 24); g.scale(.62, .48, 1.0); return g; }), cloth); bag.position.set(0, 1.85, -.1); boat.add(bag);
      const stripe = new THREE.Mesh(ctx.geo('skiff-stripe', () => { const g = new THREE.SphereGeometry(1.005, 36, 24, 0, TAU, 1.0, .35); g.scale(.62, .48, 1.0); return g; }), red); stripe.position.copy(bag.position); boat.add(stripe);
      const rig = []; for (let i = 0; i < 8; i++) { const sd = i % 2 ? 1 : -1, z = .55 - Math.floor(i / 2) * .42; boat.add(new THREE.Mesh(own(ctx, L.tube([[sd * .38, .34, z * .9], [sd * .46, 1.0, z * .7], [sd * .4, 1.62, z * .55 - .1]], .008, 8, 4)), brass)); }
      const crown = new THREE.Mesh(ctx.geo('skiff-valve', () => L.lathe([[0, 0], [.07, 0], [.06, .1], [.02, .13], [0, .13]], 10)), brass); crown.position.set(0, 2.3, -.1); boat.add(crown);
      // stern fan in a ducted frame
      const fanG = new THREE.Group(); fanG.position.set(0, .62, -1.12); boat.add(fanG);
      fanG.add(new THREE.Mesh(ctx.geo('skiff-duct', () => new THREE.TorusGeometry(.3, .035, 10, 32)), brass)); fanG.add(new THREE.Mesh(ctx.geo('skiff-hubA', () => new THREE.CylinderGeometry(.055, .055, .08, 12).rotateX(Math.PI / 2)), brass));
      const rotor = new THREE.Group(); fanG.add(rotor); for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(ctx.geo('skiff-blade', () => L.extrude([[0, -.03], [.26, -.05], [.27, .03], [0, .04]], .01, .003, { bevelSeg: 1 })), woodDk); b.rotation.z = i / 4 * TAU; rotor.add(b); }
      const blur = new THREE.Mesh(ctx.geo('skiff-blur', () => new THREE.CircleGeometry(.27, 24)), K.basic(ctx, '#e6dcc4', .12, true, { side: THREE.DoubleSide, depthWrite: false })); blur.userData.noSil = true; fanG.add(blur);
      [-1, 1].forEach(sd => fanG.add(new THREE.Mesh(own(ctx, K.taper([[sd * .3, 0, 0], [sd * .3, -.3, .35]], .018, .018, { radial: 6, seg: 4 })), brass)));
      // fins: two short side wings and a rudder
      [-1, 1].forEach(sd => { const f = new THREE.Mesh(ctx.geo('skiff-fin', () => L.extrude([[0, 0], [.5, .06], [.46, -.06], [.04, -.2]], .03, .006, { bevelSeg: 1 })), wood); f.position.set(sd * .4, .36, -.25); f.rotation.set(0, sd > 0 ? 0 : Math.PI, sd * .12); boat.add(f); });
      const rud = new THREE.Mesh(ctx.geo('skiff-rudder', () => L.extrude([[0, 0], [.04, .4], [-.3, .3], [-.3, 0]], .03, .006, { bevelSeg: 1 })), woodDk); rud.rotation.y = -Math.PI / 2; rud.position.set(0, .18, -.95); boat.add(rud);
      const puffs = K.sparks(ctx, root, { n: 10, color: '#ffffff', size: .22, rise: .12, spread: 1.7, at: [0, .55, 0], life: 4, opacity: .22, smoke: true });
      const fx = K.stageFx(ctx, root, { r: 1.2, h: 2.6, color: pal[1], core: [0, 1.4, .3] });
      let rev = 0; const inst = { root, frame: { r: 1.45, h: 2.5 }, float: .03, rest: { yaw: -.65, pitch: 0 } };
      inst.react = k => { if (k === 'click') rev = 1; };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; rev = Math.max(0, rev - dt * .6);
        boat.position.y = .95 + (calm ? 0 : Math.sin(t * .9) * .06); boat.rotation.z = calm ? 0 : Math.sin(t * .7) * .03; boat.rotation.x = calm ? 0 : Math.sin(t * .55) * .02;
        rotor.rotation.z += calm ? 0 : dt * (9 + rev * 30); blur.material.opacity = (calm ? .08 : .1) + rev * .12; bag.scale.set(1 + rev * .04, 1 + rev * .04, 1 + rev * .03); stripe.scale.copy(bag.scale);
        for (let i = 0; i < fp.count; i++) { const x = fp0[i * 3]; fp.setZ(i, calm ? 0 : Math.sin(t * 5 - x * 14) * .035 * (x + .17) * 3); } fp.needsUpdate = true; lg.material.opacity = .3 + (calm ? 0 : Math.sin(t * 2.2) * .06);
        puffs.update(dt, t, calm ? .05 : .4); fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== CHRONO RACER
  function clockTexture(ctx, col) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#f6efe0'; x.beginPath(); x.arc(128, 128, 124, 0, TAU); x.fill(); x.strokeStyle = '#2a1a1e'; x.lineWidth = 8; x.stroke();
    x.strokeStyle = '#2a1a1e'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.lineWidth = i % 3 ? 4 : 9; x.beginPath(); x.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); x.lineTo(128 + Math.cos(a) * 116, 128 + Math.sin(a) * 116); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ctx.tex.push(t); return t;
  }
  S.registerModel('chronoracer', {
    rest: { yaw: -.7, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), car = new THREE.Group(); car.position.y = .42; root.add(car);
      const paint = F.body(pal[0], { rough: .22, metal: .35, clearcoat: 1, ccRough: .08 }), cream = F.body('#f4e8d0', { rough: .4, metal: .1, clearcoat: .6 }), chrome = F.trim('#d8dde6', { rough: .14, metal: 1, env: 1.6 }), dark = F.trim('#1d1a20', { rough: .5, metal: .6, plain: true }), cyan = F.make('glow', { color: pal[1], glow: 1.6 }), glass = F.make('glass', { color: '#9be8ff', opacity: .3 });
      // teardrop body: a lathe along y, laid on its side so it points +z, flattened
      const bodyG = ctx.geo('chr-body', () => { const g = L.lathe([[0, -1.15], [.2, -1.05], [.38, -.7], [.46, -.1], [.4, .5], [.22, .95], [.08, 1.2], [0, 1.28]], 36); g.rotateX(Math.PI / 2); g.scale(1, .62, 1); return g; });
      car.add(new THREE.Mesh(bodyG, paint));
      const stripe = new THREE.Mesh(ctx.geo('chr-stripe', () => { const g = L.lathe([[.47, -.02], [.47, .12], [.44, .12], [.44, -.02]], 36); g.rotateX(Math.PI / 2); g.scale(1, .62, 1); g.translate(0, 0, -.35); return g; }), cream); car.add(stripe);
      const canopy = new THREE.Mesh(ctx.geo('chr-canopy', () => { const g = new THREE.SphereGeometry(1, 24, 14, 0, TAU, 0, Math.PI / 2); g.scale(.28, .22, .5); return g; }), glass); canopy.position.set(0, .22, -.2); car.add(canopy);
      // tail fins and a nose splitter
      [-1, 1].forEach(sd => { const f = new THREE.Mesh(ctx.geo('chr-fin', () => L.extrude([[0, 0], [.04, .46], [.04, .5], [-.5, .12], [-.5, 0]], .035, .008, { bevelSeg: 1 })), paint); f.rotation.y = -Math.PI / 2; f.position.set(sd * .3, .12, -.95); f.rotation.z = sd * .2; f.rotation.order = 'YXZ'; car.add(f); });
      const split = new THREE.Mesh(ctx.geo('chr-split', () => L.chamferBox(.9, .03, .35, .01)), chrome); split.position.set(0, -.2, 1.1); car.add(split);
      // wheels: tyre torus + rim disc with a lit spoke ring; spin with speed
      const wheels = []; [[-1, .74], [1, .74], [-1, -.72], [1, -.72]].forEach(([sd, z], i) => { const g = new THREE.Group(), r = z > 0 ? .3 : .36; g.position.set(sd * .54, -.08 + (r - .3), z); car.add(g); const t = new THREE.Mesh(ctx.geo('chr-tyre' + (z > 0 ? 'f' : 'r'), () => new THREE.TorusGeometry(r * .8, r * .22, 12, 28).rotateY(Math.PI / 2)), dark); g.add(t);
        const rim = new THREE.Mesh(ctx.geo('chr-rim' + (z > 0 ? 'f' : 'r'), () => new THREE.CylinderGeometry(r * .78, r * .78, .06, 24).rotateZ(Math.PI / 2)), chrome); g.add(rim); const rg = new THREE.Mesh(ctx.geo('chr-rimglow' + (z > 0 ? 'f' : 'r'), () => new THREE.CylinderGeometry(r * .5, r * .5, .07, 24).rotateZ(Math.PI / 2)), cyan); g.add(rg); wheels.push(g); g.userData.spokes = rim; });
      // clock-face on the bonnet: a dial that faces up with a second hand that really ticks
      const dial = new THREE.Group(); dial.position.set(0, .22, .72); dial.rotation.x = -1.05; car.add(dial);
      dial.add(new THREE.Mesh(ctx.geo('chr-dial', () => new THREE.CircleGeometry(.2, 32)), new THREE.MeshBasicMaterial({ map: clockTexture(ctx, pal[1]) })));
      dial.add(new THREE.Mesh(ctx.geo('chr-bezel', () => new THREE.TorusGeometry(.205, .02, 8, 32)), chrome));
      const hHand = new THREE.Mesh(ctx.geo('chr-hand', () => { const g = new THREE.BoxGeometry(.016, .13, .008); g.translate(0, .065, 0); return g; }), dark), mHand = new THREE.Mesh(ctx.geo('chr-hand2', () => { const g = new THREE.BoxGeometry(.01, .17, .008); g.translate(0, .085, 0); return g; }), dark), sHand = new THREE.Mesh(ctx.geo('chr-hand3', () => { const g = new THREE.BoxGeometry(.005, .18, .006); g.translate(0, .09, 0); return g; }), cyan); [hHand, mHand, sHand].forEach((h, i) => { h.position.z = .01 + i * .004; dial.add(h); });
      // exhaust: twin pipes glowing cyan
      [-1, 1].forEach(sd => { const p = new THREE.Mesh(ctx.geo('chr-pipe', () => new THREE.CylinderGeometry(.07, .09, .3, 12).rotateX(Math.PI / 2)), chrome); p.position.set(sd * .17, .0, -1.18); car.add(p); const e = new THREE.Mesh(ctx.geo('chr-pipeglow', () => new THREE.CircleGeometry(.055, 14)), cyan); e.position.set(sd * .17, 0, -1.34); e.rotation.y = Math.PI; car.add(e); });
      // time-echoes: translucent copies that lag behind and catch up; skipped on Low where doubling the car costs too much
      const echoes = []; if (ctx.q.particles >= .5) for (let i = 1; i <= 2; i++) { const gm = own(ctx, new THREE.MeshBasicMaterial({ color: new THREE.Color(pal[1]), transparent: true, opacity: .2 / i, blending: THREE.AdditiveBlending, depthWrite: false })), g = car.clone(true); g.traverse(o => { if (o.isMesh) { o.material = gm; o.castShadow = false; } o.userData.noSil = true; }); root.add(g); echoes.push({ g, gm, i, base: .22 / i }); }
      const trail = K.sparks(ctx, car, { n: 10, color: pal[1], size: .06, rise: -.0, spread: .5, at: [0, 0, -1.4], life: 1.2, opacity: .7 });
      const fx = K.stageFx(ctx, root, { r: 1.2, h: 1.7, color: pal[1], core: [0, .5, .3] });
      let surge = 0; const inst = { root, frame: { r: 1.5, h: 1.55 }, float: .02, rest: { yaw: -.7, pitch: 0 }, echoNative: true };
      inst.react = k => { if (k === 'click') surge = 1; };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; surge = Math.max(0, surge - dt * .8); const sg = Math.sin(clamp(1 - surge, 0, 1) * Math.PI) * (surge > 0 ? 1 : 0);
        car.position.y = .42 + (calm ? 0 : Math.sin(t * 1.3) * .03); car.position.z = surge > 0 ? Math.sin((1 - surge) * Math.PI) * .22 : 0; car.rotation.x = calm ? 0 : Math.sin(t * 1.3) * .012 - sg * .03;
        wheels.forEach(w => { w.rotation.x += calm ? 0 : dt * (3 + surge * 18); });
        const tm = calm ? 0 : t; sHand.rotation.z = -Math.floor(tm * 2) * (TAU / 60) * 6 - (surge > 0 ? surge * 8 : 0); mHand.rotation.z = -tm * .08 + 1; hHand.rotation.z = -tm * .01 + 4.2;
        echoes.forEach(e => { const lag = e.i * (.22 + surge * .0), w = calm ? 0 : Math.sin(t * 1.3 - e.i * .6); e.g.position.set(.0, car.position.y - .42 + .42 + (calm ? 0 : Math.sin(t * 1.3 - e.i * .6) * .03), -lag * 1.1 + car.position.z * (1 - e.i * .35) - .0); e.g.position.x = -e.i * .14; e.g.rotation.y = -e.i * .03; e.gm.opacity = e.base * (calm ? 1 : .7 + .3 * Math.sin(t * 2 + e.i)) * (1 + surge * .8); });
        trail.update(dt, t, calm ? 0 : .4 + surge * 3); fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== STARHOPPER
  S.registerModel('starhopper', {
    rest: { yaw: -.55, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), ship = new THREE.Group(); root.add(ship);
      const white = F.body(pal[0], { rough: .3, metal: .25, clearcoat: .8, ccRough: .12 }), red = F.body(pal[1], { rough: .35, metal: .2, clearcoat: .6 }), steel = F.trim('#8892a6', { rough: .35, metal: .85 }), dark = F.trim('#2a303c', { rough: .5, metal: .7, plain: true }), glass = F.make('glass', { color: '#8fd8ff', opacity: .35 }), starM = F.make('glow', { color: '#ffd27a', glow: 1.3 });
      const hullG = ctx.geo('hop-hull', () => L.lathe([[0, .0], [.22, .0], [.44, .14], [.52, .55], [.5, 1.15], [.38, 1.6], [.16, 1.92], [0, 2.02]], 40));
      ship.add(new THREE.Mesh(hullG, white));
      ship.add(new THREE.Mesh(ctx.geo('hop-band', () => L.lathe([[.503, .78], [.515, .86], [.515, 1.02], [.503, 1.1], [.49, 1.02], [.49, .86]], 40)), red));
      ship.add(new THREE.Mesh(ctx.geo('hop-nose', () => L.lathe([[0, 1.72], [.14, 1.78], [.1, 2.0], [0, 2.06]], 20)), red));
      // porthole + nozzle
      const port = new THREE.Group(); port.position.set(0, 1.28, .47); port.rotation.x = -.06; ship.add(port); port.add(new THREE.Mesh(ctx.geo('hop-ring', () => new THREE.TorusGeometry(.14, .03, 10, 24)), steel)); const wg = new THREE.Mesh(ctx.geo('hop-win', () => new THREE.CircleGeometry(.13, 24)), glass); wg.position.z = .0; port.add(wg);
      const pilot = new THREE.Mesh(ctx.geo('hop-pilot', () => new THREE.SphereGeometry(.07, 12, 10)), F.body('#ffdca8', { rough: .6, clearcoat: 0, plain: true })); pilot.position.set(0, -.02, -.04); port.add(pilot);
      const noz = new THREE.Mesh(ctx.geo('hop-noz', () => L.lathe([[.0, .02], [.2, .0], [.3, -.2], [.1, -.06]], 20)), dark); ship.add(noz);
      const flame = K.flame(ctx, ship, { r: .17, h: .6, c1: '#ff9a3a', c2: '#fff2c0' }); flame.group.position.y = -.1; flame.group.scale.y = -1;
      // fins + legs
      const legs = [], finG = ctx.geo('hop-fin', () => L.extrude([[0, 0], [.55, -.12], [.5, .08], [.14, .72], [0, .72]], .05, .01, { bevelSeg: 1 }));
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 6, g = new THREE.Group(); g.rotation.y = -a; ship.add(g); const f = new THREE.Mesh(finG, red); f.position.set(.48, .25, 0); f.rotation.y = Math.PI / 2; f.position.z = 0; g.add(f);
        const leg = new THREE.Group(); leg.rotation.y = -a + TAU / 6; ship.add(leg); leg.add(new THREE.Mesh(own(ctx, K.taper([[.3, .5, 0], [.62, .22, 0], [.78, -.05, 0]], .035, .025, { radial: 6, seg: 8 })), steel)); const pad = new THREE.Mesh(ctx.geo('hop-pad', () => new THREE.CylinderGeometry(.1, .12, .035, 14)), dark); pad.position.set(.78, -.07, 0); leg.add(pad); legs.push({ leg, a: i }); }
      // star-stones on the pedestal: lit in sequence as the hopper lands
      const stars = [0, 1, 2].map(i => { const a = i / 3 * TAU + .5, m = new THREE.Mesh(ctx.geo('hop-star', () => { const g = new THREE.OctahedronGeometry(.11, 0); g.scale(1, .5, 1); return g; }), starM), base = new THREE.Mesh(ctx.geo('hop-stone', () => new THREE.CylinderGeometry(.14, .17, .06, 8)), dark); m.position.set(Math.cos(a) * 1.15, .1, Math.sin(a) * 1.15); base.position.set(m.position.x, .03, m.position.z); root.add(m, base); return { m, ph: i }; });
      const smoke = K.sparks(ctx, root, { n: 10, color: '#d8d4cc', size: .2, rise: .22, spread: .5, at: [0, .08, 0], life: 1.5, opacity: .3, smoke: true });
      const fx = K.stageFx(ctx, root, { r: 1.1, h: 2.3, color: pal[1], core: [0, 1.0, .4] });
      let big = 0; const CYC = 4.2, inst = { root, frame: { r: 1.4, h: 2.55 }, float: 0, rest: { yaw: -.55, pitch: 0 } };
      inst.react = k => { if (k === 'click') big = 1; };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; big = Math.max(0, big - dt * .55); const c = calm ? 0 : (t % CYC) / CYC, air = c < .55 ? Math.sin(c / .55 * Math.PI) : 0, hop = air * (.38 + big * .5), land = c > .55 && c < .66 ? 1 - (c - .55) / .11 : 0;
        ship.position.y = .38 + hop; const sq = 1 - land * .05; ship.scale.set(1 + land * .04, sq, 1 + land * .04); legs.forEach(l => { l.leg.scale.x = 1 - air * .25; l.leg.position.y = air * .06; });
        ship.rotation.z = calm ? 0 : Math.sin(t * 1.1) * .01 + Math.sin(c * TAU) * .02; flame.group.visible = true; flame.update(t, .6 + air * 1.4 + big, 3); flame.group.scale.set(1, -(.5 + air * 1.2 + big * .8), 1);
        stars.forEach(s => { const ph = (c * 3 + s.ph) % 3, lit = calm ? .5 : Math.max(0, 1 - Math.abs(ph - .2) * 1.6); s.m.rotation.y = calm ? 0 : t * (.6 + lit) ; s.m.position.y = .1 + lit * .06; s.m.scale.setScalar(.85 + lit * .4); });
        starM.emissiveIntensity = 1.2 + (calm ? 0 : Math.sin(t * 2) * .2); smoke.update(dt, t, calm ? 0 : (land > 0 ? 3 : .05)); fx.update(dt, t, calm);
      };
      return inst;
    },
  });
})();
