/* AETHERVAULT — Phase Two machines, both with genuine moving mechanisms (not turntable decoration).
 *   Pocket Drone — a rounded fuselage on four two-joint folding arms, each ending in a spinning rotor; an expressive gimbal eye
 *                  (aperture, blink, cursor tracking); LED ring that changes state. Click: it folds up, sulks, and unfolds.
 *   Scrap Rover  — welded from mismatched panels: four suspended wheels (spin follows the rover's "speed"), a swivelling sensor mast
 *                  with a dish, a three-joint claw arm that waves/scans, headlamps, a smoking exhaust. Click: it revs.
 * Parts come from the kit (K.taper tubes, K.gearMesh, K.rivets, K.sparks, K.stageFx). */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, clamp = U.clamp;
  const ease = t => t * t * (3 - 2 * t);

  // =================================================================== POCKET DRONE
  S.registerModel('pocketdrone', {
    rest: { yaw: -.45, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), d = new THREE.Group(); root.add(d); d.position.y = .8;
      const shellM = F.body(pal[0], { rough: .32, metal: .25, clearcoat: .7, ccRough: .15 }), accent = F.body(pal[1], { rough: .4, metal: .1, clearcoat: .4 }), dark = F.trim('#262c3b', { rough: .4, metal: .75, plain: true }), steel = F.trim('#9aa4b8', { rough: .28 });
      const led = F.make('glow', { color: '#6dff9a', glow: 1.6 }), lens = F.make('glass', { color: '#7fc8ff', opacity: .3 });
      // fuselage: rounded slab + dome + accent band + underbelly
      const body = new THREE.Mesh(ctx.geo('pd-body', () => L.roundedBox(.78, .26, .78, .12, 5)), shellM); d.add(body);
      const dome = new THREE.Mesh(ctx.geo('pd-dome', () => { const g = new THREE.SphereGeometry(1, 28, 16, 0, TAU, 0, Math.PI / 2); g.scale(.3, .16, .3); return g; }), shellM); dome.position.y = .12; d.add(dome);
      const band = new THREE.Mesh(ctx.geo('pd-band', () => L.roundedBox(.8, .045, .8, .02, 3)), accent); band.position.y = -.02; d.add(band);
      const belly = new THREE.Mesh(ctx.geo('pd-belly', () => L.roundedBox(.5, .1, .5, .04, 3)), dark); belly.position.y = -.17; d.add(belly);
      const ledRing = new THREE.Mesh(new THREE.TorusGeometry(.405, .012, 6, 4, TAU), led); ledRing.rotation.x = Math.PI / 2; ledRing.rotation.z = Math.PI / 4; ledRing.position.y = -.08; ledRing.scale.set(1, 1, 1); d.add(ledRing);
      // eye: gimbal ring + lens barrel + iris that opens/blinks
      const gim = new THREE.Group(); gim.position.set(0, -.03, .4); d.add(gim);
      const bez = new THREE.Mesh(new THREE.TorusGeometry(.15, .028, 10, 32), steel); gim.add(bez);
      const barrel = new THREE.Mesh(ctx.geo('pd-barrel', () => L.lathe([[0, 0], [.13, 0], [.14, -.04], [.14, -.14], [.1, -.17], [0, -.17]], 24)), dark); barrel.rotation.x = Math.PI / 2; barrel.position.z = -.02; gim.add(barrel);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(.1, 28), K.basic(ctx, '#0c1a2a')); iris.position.z = .015; gim.add(iris);
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(.055, 24), led); pupil.position.z = .02; gim.add(pupil); ctx.disposables.push(iris.geometry, pupil.geometry);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(.13, 20, 12, 0, TAU, 0, Math.PI / 2), lens); glass.rotation.x = Math.PI / 2; glass.position.z = .0; gim.add(glass); ctx.disposables.push(glass.geometry);
      const hl = new THREE.Mesh(new THREE.CircleGeometry(.022, 10), K.basic(ctx, '#ffffff')); hl.position.set(-.05, .05, .03); gim.add(hl); ctx.disposables.push(hl.geometry);
      // antenna with a blinking light + landing skids
      d.add(new THREE.Mesh(K.taper([[-.2, .2, -.1], [-.26, .42, -.14], [-.2, .62, -.12]], .014, .008, { radial: 5, seg: 10 }), steel));
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), F.make('glow', { color: pal[1], glow: 2 })); beacon.position.set(-.2, .64, -.12); d.add(beacon); ctx.disposables.push(beacon.geometry);
      [-1, 1].forEach(sd => d.add(new THREE.Mesh(K.taper([[sd * .2, -.15, .24], [sd * .24, -.32, .16], [sd * .24, -.36, -.2], [sd * .2, -.3, -.3]], .018, .018, { radial: 6, seg: 14 }), dark)));
      // four arms, each: shoulder hinge → segment A → elbow → segment B → motor pod → rotor
      const arms = [], bladeG = ctx.geo('pd-blade', () => { const s = new THREE.Shape([new THREE.Vector2(0, -.02), new THREE.Vector2(.4, -.012), new THREE.Vector2(.42, .012), new THREE.Vector2(0, .02)]); return new THREE.ExtrudeGeometry(s, { depth: .008, bevelEnabled: false }); });
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], i) => {
        const sh = new THREE.Group(); sh.position.set(sx * .33, .0, sz * .33); d.add(sh); // shoulder: yaw
        const a = new THREE.Mesh(ctx.geo('pd-armA', () => L.chamferBox(.46, .06, .075, .015)), accent); a.position.x = sx * .23; const aG = new THREE.Group(); aG.add(a); sh.add(aG);
        const el = new THREE.Group(); el.position.x = sx * .46; aG.add(el); const b = new THREE.Mesh(ctx.geo('pd-armB', () => L.chamferBox(.36, .05, .06, .012)), shellM); b.position.x = sx * .18; el.add(b);
        const pod = new THREE.Group(); pod.position.x = sx * .36; el.add(pod); pod.add(new THREE.Mesh(ctx.geo('pd-pod', () => L.lathe([[0, -.05], [.075, -.05], [.085, -.02], [.085, .05], [.05, .08], [0, .08]], 16)), dark));
        const rot = new THREE.Group(); rot.position.y = .1; pod.add(rot); [0, Math.PI].forEach(r => { const bl = new THREE.Mesh(bladeG, steel); bl.rotation.set(Math.PI / 2, r, 0); bl.scale.x = .8; rot.add(bl); });
        const disc = new THREE.Mesh(new THREE.CircleGeometry(.34, 28), K.basic(ctx, '#cfe6ff', .16, true, { side: THREE.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = .102; disc.userData.noSil = true; pod.add(disc); ctx.disposables.push(disc.geometry);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .035, 10), accent); hub.position.y = .1; pod.add(hub); ctx.disposables.push(hub.geometry);
        arms.push({ sh, aG, el, rot, disc, sx, sz, i });
      });
      const fx = K.stageFx(ctx, root, { r: 1.15, h: 1.9, color: pal[1], core: [0, 1.0, .35] });
      // state: unfolded 1 → folding → folded 0 (sulk) → unfolding
      const S0 = { fold: 1, st: 'up', t: 0 }; let tilt = new THREE.Vector2(), spin = 0, look = new THREE.Vector2(), blink = 0, nextBlink = 2;
      const inst = { root, frame: { r: 1.45, h: 1.45 }, float: 0, rest: { yaw: -.45, pitch: 0 } };
      inst.react = k => { if (k === 'click' && S0.st === 'up') { S0.st = 'folding'; S0.t = 0; } };
      inst.update = (dt, t, st) => {
        const calm = st.reduced; S0.t += dt;
        if (S0.st === 'folding') { S0.fold = 1 - ease(clamp(S0.t / .7, 0, 1)); if (S0.t > 2.4) { S0.st = 'unfolding'; S0.t = 0; } }
        else if (S0.st === 'unfolding') { S0.fold = ease(clamp(S0.t / .9, 0, 1)); if (S0.t > .9) { S0.st = 'up'; } }
        const f = calm ? 1 : S0.fold, hover = calm ? 0 : Math.sin(t * 1.7) * .035 * f + Math.sin(t * 2.9) * .01;
        arms.forEach(a => { a.sh.rotation.y = a.sx * a.sz * (1 - f) * -1.05 + a.sz * a.sx * .0; a.aG.rotation.z = a.sx > 0 ? -(1 - f) * 0 : 0; a.el.rotation.y = a.sx * a.sz * (1 - f) * 2.5; a.el.rotation.z = 0;
          a.rot.rotation.y = calm ? .5 * a.i : a.rot.rotation.y + dt * (34 + a.i * 2) * f; a.disc.material.opacity = (calm ? .08 : .16) * f; a.disc.visible = f > .1; });
        const tx = calm ? 0 : st.pointer.x * .5 * (st.hover ? 1 : .3), ty = calm ? 0 : -st.pointer.y * .35 * (st.hover ? 1 : .3); look.x += (tx - look.x) * .06; look.y += (ty - look.y) * .06;
        tilt.x += ((calm ? 0 : -st.pointer.y * .12 * f + Math.sin(t * .7) * .03) - tilt.x) * .05; tilt.y += ((calm ? 0 : st.pointer.x * .16 * f) - tilt.y) * .05;
        d.rotation.x = tilt.x + hover * .5; d.rotation.z = -tilt.y * .6; d.rotation.y = tilt.y * .8 + (calm ? 0 : Math.sin(t * .5) * .08); d.position.y = .8 + hover - (1 - f) * .02;
        gim.rotation.y = look.x * .6; gim.rotation.x = -look.y * .4;
        if (!calm) { nextBlink -= dt; if (nextBlink <= 0) { blink = .14; nextBlink = 2 + Math.random() * 4; } blink = Math.max(0, blink - dt); }
        const open = S0.st === 'folding' || (S0.st === 'unfolding' && S0.t < .4) ? .15 : (blink > 0 ? .1 : 1); iris.scale.setScalar(open); pupil.scale.setScalar(.45 + .55 * open * (.8 + (calm ? 0 : Math.sin(t * 1.4) * .2)));
        led.color.set(S0.st === 'up' ? '#6dff9a' : '#ff6a5a'); led.emissive.set(S0.st === 'up' ? '#6dff9a' : '#ff6a5a'); led.emissiveIntensity = 1.4 + (calm ? 0 : Math.sin(t * 2.4) * .3); beacon.material.emissiveIntensity = calm ? 1.5 : (Math.sin(t * 5) > .6 ? 3 : .3);
        fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== SCRAP ROVER
  S.registerModel('scraprover', {
    rest: { yaw: -.55, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), r = new THREE.Group(); root.add(r);
      const rust = F.body(pal[0], { rough: .62, metal: .55, clearcoat: .05, pat: .6 }), blue = F.body(pal[1], { rough: .5, metal: .4, clearcoat: .15 }), grey = F.body('#8a8f98', { rough: .55, metal: .6, clearcoat: 0 }), dark = F.trim('#20232a', { rough: .5, metal: .8, plain: true }), tire = F.body('#1d1c1a', { rough: .9, metal: 0, clearcoat: 0 }), steel = F.trim('#aeb4c0', { rough: .32 }), brass = F.trim('#b48d4c', { rough: .35, plain: true });
      const lamp = F.make('glow', { color: '#fff2c0', glow: 1.6 }), warn = F.make('glow', { color: '#ff8a3d', glow: 1.4 });
      // chassis: mismatched welded panels
      const base = new THREE.Mesh(ctx.geo('sr-base', () => L.chamferBox(1.5, .22, .86, .04)), dark); base.position.y = .48; r.add(base);
      const hull = new THREE.Mesh(ctx.geo('sr-hull', () => L.chamferBox(1.2, .46, .78, .05)), rust); hull.position.set(-.08, .76, 0); r.add(hull);
      const patch1 = new THREE.Mesh(ctx.geo('sr-p1', () => L.chamferBox(.56, .36, .08, .025)), blue); patch1.position.set(.22, .78, .4); r.add(patch1);
      const patch2 = new THREE.Mesh(ctx.geo('sr-p2', () => L.chamferBox(.4, .3, .08, .02)), grey); patch2.position.set(-.5, .84, .4); patch2.rotation.z = .04; r.add(patch2);
      const patch3 = new THREE.Mesh(ctx.geo('sr-p3', () => L.chamferBox(.5, .34, .08, .02)), grey); patch3.position.set(.0, .8, -.4); r.add(patch3);
      const cab = new THREE.Mesh(ctx.geo('sr-cab', () => L.chamferBox(.5, .34, .62, .05)), blue); cab.position.set(.42, 1.12, 0); r.add(cab);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(.3, .16), F.make('glass', { color: '#9fd8ff', opacity: .55 })); win.position.set(.68, 1.14, 0); win.rotation.y = Math.PI / 2; r.add(win); ctx.disposables.push(win.geometry);
      r.add(K.rivets(ctx, steel, [-.6, .96, .4], [.1, .96, .4], 9, .014), K.rivets(ctx, steel, [-.6, .6, .44], [.5, .6, .44], 10, .014), K.rivets(ctx, steel, [-.5, .96, -.4], [.4, .96, -.4], 9, .014));
      // hazard stripe
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(.7, .06), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d'); x.fillStyle = '#e0a82a'; x.fillRect(0, 0, 256, 32); x.fillStyle = '#1c1b18'; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 32, 32); x.lineTo(i * 32 + 16, 32); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 16, 0); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; ctx.tex.push(t); return t; })() })); stripe.position.set(-.3, .62, .432); r.add(stripe); ctx.disposables.push(stripe.material, stripe.geometry);
      // engine + exhaust (rear)
      const eng = new THREE.Mesh(ctx.geo('sr-eng', () => L.lathe([[0, -.28], [.2, -.28], [.22, -.2], [.22, .2], [.18, .26], [0, .28]], 22)), dark); eng.rotation.z = Math.PI / 2; eng.position.set(-.82, .86, 0); r.add(eng);
      [-1, 1].forEach(sd => r.add(new THREE.Mesh(K.taper([[-.7, .98, sd * .1], [-.9, 1.2, sd * .12], [-.95, 1.5, sd * .14]], .045, .06, { radial: 8, seg: 14 }), grey)));
      const smoke = K.sparks(ctx, r, { n: 12, color: '#cfcac0', smoke: true, size: .16, opacity: .3, rise: .4, spread: .08, at: [-.95, 1.55, .13], life: 2.4 });
      // headlamps + bull bar
      [-1, 1].forEach(sd => { const l = new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), lamp); l.position.set(.76, .66, sd * .28); l.scale.set(.6, 1, 1); r.add(l); ctx.disposables.push(l.geometry); const cone = new THREE.Mesh(new THREE.ConeGeometry(.2, .9, 14, 1, true), K.basic(ctx, '#fff2c0', .06, true, { side: THREE.DoubleSide })); cone.rotation.z = -Math.PI / 2; cone.scale.setScalar(.6); cone.position.set(1.0, .66, sd * .28); cone.userData.noSil = true; r.add(cone); ctx.disposables.push(cone.geometry); });
      r.add(new THREE.Mesh(K.taper([[.78, .42, -.3], [.88, .45, -.3], [.88, .45, .3], [.78, .42, .3]], .03, .03, { radial: 6, seg: 10 }), steel));
      // wheels: mismatched sizes, spoked hubs, suspension arms
      const wheels = []; const tireG = rad => ctx.geo('sr-tire' + rad, () => L.lathe([[rad * .62, -.12], [rad * .9, -.13], [rad, -.1], [rad, .1], [rad * .9, .13], [rad * .62, .12]], 28));
      [[.62, .36, .46, .36], [-.5, .38, .46, .38], [.62, .36, -.46, .36], [-.5, .4, -.46, .4]].forEach(([x, y, z, rad], i) => {
        const g = new THREE.Group(); g.position.set(x, rad, z * 1.02); r.add(g); const w = new THREE.Group(); g.add(w);
        const t = new THREE.Mesh(tireG(rad), tire); t.rotation.x = Math.PI / 2; w.add(t);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(rad * .6, rad * .6, .1, 16), i % 2 ? steel : brass); hub.rotation.x = Math.PI / 2; w.add(hub); ctx.disposables.push(hub.geometry);
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, bolt = new THREE.Mesh(ctx.geo('sr-bolt', () => new THREE.CylinderGeometry(.018, .018, .12, 6)), dark); bolt.rotation.x = Math.PI / 2; bolt.position.set(Math.cos(a) * rad * .38, Math.sin(a) * rad * .38, 0); w.add(bolt); }
        const mark = new THREE.Mesh(new THREE.BoxGeometry(rad * .5, .05, .13), dark); mark.position.set(rad * .22, 0, 0); w.add(mark); ctx.disposables.push(mark.geometry);
        const arm = new THREE.Mesh(K.taper([[x, y + rad * 1.2, z * .8], [x, y + rad * .9, z * .95], [x, rad, z]], .04, .035, { radial: 6, seg: 8 }), steel); r.add(arm);
        wheels.push({ g, w, rad, base: rad, ph: i * 1.3 });
      });
      // sensor mast with dish, and a three-joint claw arm
      const mast = new THREE.Group(); mast.position.set(-.25, 1.0, .0); r.add(mast); mast.add(new THREE.Mesh(K.taper([[0, 0, 0], [0, .35, 0], [0, .7, 0]], .035, .02, { radial: 6, seg: 8 }), steel));
      const dish = new THREE.Group(); dish.position.y = .72; mast.add(dish); const dm = new THREE.Mesh(ctx.geo('sr-dish', () => { const g = new THREE.SphereGeometry(1, 22, 12, 0, TAU, 0, Math.PI / 2.4); g.scale(.22, .1, .22); return g; }), grey); dm.rotation.x = Math.PI / 2 - .5; dm.material.side = THREE.DoubleSide; dish.add(dm);
      const feed = new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 6), warn); feed.position.set(0, .1, .1); dish.add(feed); ctx.disposables.push(feed.geometry);
      const arm0 = new THREE.Group(); arm0.position.set(.3, 1.28, .0); r.add(arm0); const sw = new THREE.Mesh(new THREE.CylinderGeometry(.09, .1, .08, 14), dark); arm0.add(sw); ctx.disposables.push(sw.geometry);
      const j1 = new THREE.Group(); j1.position.y = .05; arm0.add(j1); j1.add(new THREE.Mesh(ctx.geo('sr-u', () => L.chamferBox(.07, .5, .07, .015)), steel)); const u = j1.children[0]; u.position.y = .22;
      const j2 = new THREE.Group(); j2.position.y = .46; j1.add(j2); const lo = new THREE.Mesh(ctx.geo('sr-l', () => L.chamferBox(.06, .42, .06, .012)), steel); lo.position.y = .19; j2.add(lo);
      const j3 = new THREE.Group(); j3.position.y = .4; j2.add(j3); const claws = [-1, 1].map(sd => { const c = new THREE.Mesh(ctx.geo('sr-claw', () => L.extrude([[0, 0], [.04, .0], [.05, .14], [.0, .2], [-.01, .1]], .03, .006, { bevelSeg: 1 })), brass); c.position.x = sd * .035; c.scale.x = sd; j3.add(c); return c; });
      [j1, j2].forEach(j => { const k = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), brass); j.add(k); ctx.disposables.push(k.geometry); });
      const fx = K.stageFx(ctx, root, { r: 1.2, h: 1.9, color: pal[1], core: [0, .8, .4] });
      let rev = 0, speed = .6, spin = 0; const bump = [0, 0, 0, 0];
      const inst = { root, frame: { r: 1.45, h: 1.95 }, float: 0, rest: { yaw: -.55, pitch: 0 } };
      inst.react = k => { if (k === 'click') rev = 1; };
      inst.update = (dt, t, st) => {
        const calm = st.reduced; rev = Math.max(0, rev - dt * .6); speed = calm ? 0 : .8 + rev * 7; spin += dt * speed;
        wheels.forEach((w, i) => { w.w.rotation.z = -spin / w.rad * .35; w.g.position.y = w.rad + (calm ? 0 : Math.sin(t * 2.1 + w.ph) * .012 * (1 + rev * 3)); });
        r.position.y = (calm ? 0 : Math.sin(t * 2.3) * .008 * (1 + rev * 4)); r.rotation.z = calm ? 0 : Math.sin(t * 1.3) * .006 * (1 + rev * 3); r.rotation.x = calm ? 0 : Math.sin(t * 1.9 + 1) * .004;
        dish.rotation.y = calm ? .6 : t * .5; dish.rotation.x = calm ? 0 : Math.sin(t * .7) * .15; warn.emissiveIntensity = calm ? 1.2 : (Math.sin(t * 4) > 0 ? 2.2 : .3); lamp.emissiveIntensity = 1.5 + (calm ? 0 : Math.sin(t * 9) * .08);
        const sc = calm ? 0 : t;
        arm0.rotation.y = calm ? .4 : Math.sin(sc * .35) * .9; j1.rotation.z = calm ? -.5 : -.55 + Math.sin(sc * .5) * .25; j2.rotation.z = calm ? 1.1 : 1.05 + Math.sin(sc * .8 + 1) * .4 + Math.sin(sc * 7) * .02 * rev; j3.rotation.z = calm ? 0 : Math.sin(sc * .6) * .3;
        claws.forEach((c, i) => { c.rotation.z = (i ? -1 : 1) * (.12 + (calm ? 0 : (Math.sin(sc * 1.7) * .5 + .5) * .5)); });
        smoke.update(dt, t, calm ? 0 : .25 + rev * 2.4); fx.update(dt, t, calm);
      };
      return inst;
    },
  });
})();
