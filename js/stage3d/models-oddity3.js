/* AETHERVAULT — Phase Three oddities (batch E). Three things that are wrong in three different ways:
 *   Infinite Sock     — a striped knit sock whose cuff opens onto a smaller sock, and that onto a smaller one: three deep, always sliding out.
 *   Vending Fragment  — the torn front of a vending machine that was never installed: shelves, keypad, a scrolling display, a flap, loose wires.
 *   Glitched Cursor   — a giant arrow with RGB-split ghosts and a stepped pixel trail; it jitters, then turns to point behind the viewer.
 * Each has its own tell (nesting, a display that answers, a pointer that looks away). Reduced motion keeps the poses and stops the loops. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, clamp = U.clamp;
  const own = (ctx, o) => { ctx.disposables.push(o); return o; };

  // =================================================================== INFINITE SOCK
  S.registerModel('infinitesock', {
    rest: { yaw: -1.25, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), sock = new THREE.Group(); sock.position.y = .12; root.add(sock);
      const a = F.body(pal[0], { rough: .92, metal: 0, clearcoat: 0, soft: true, pat: .7 }), b = F.body(pal[1], { rough: .92, metal: 0, clearcoat: 0, soft: true, pat: .5 }), rib = F.body(L.shade(pal[0], .72), { rough: .95, metal: 0, clearcoat: 0, soft: true });
      // path of the sock: cuff at the top, down the leg, round the heel, out along the foot to the toe
      const path = new THREE.CatmullRomCurve3([[0, 2.0, 0], [0, 1.5, 0], [0, 1.0, -.02], [0, .62, -.12], [0, .38, .1], [0, .3, .5], [0, .3, .85], [0, .34, 1.02]].map(p => new THREE.Vector3(...p)));
      const SEG = 12, radii = [.3, .28, .27, .26, .27, .3, .27, .25, .24, .23, .2, .13], segs = [];
      for (let i = 0; i < SEG; i++) { const t0 = i / SEG, t1 = (i + 1) / SEG, pts = [0, .5, 1].map(k => { const p = path.getPointAt(t0 + (t1 - t0) * k + (k === 1 && i < SEG - 1 ? .004 : 0)); return [p.x, p.y, p.z]; }); segs.push(ctx.geo('sock-seg' + i, () => K.taper(pts, radii[i], radii[Math.min(SEG - 1, i + 1)], { radial: 14, seg: 5, ends: i === SEG - 1 ? 'round' : 'flat' }))); }
      const cuffRim = ctx.geo('sock-rim', () => new THREE.TorusGeometry(.3, .06, 8, 24).rotateX(Math.PI / 2));
      // each level is a whole sock; the next sits inside its cuff, smaller, leaning, sliding in and out
      const levels = [];
      function build(parent, depth) {
        const g = new THREE.Group(); parent.add(g);
        segs.forEach((geo, i) => { const m = new THREE.Mesh(geo, i < 2 ? rib : (Math.floor((i - 2) / 2) % 2 ? b : a)); g.add(m); });
        const rim = new THREE.Mesh(cuffRim, rib); rim.position.y = 2.0; g.add(rim);
        const heel = new THREE.Mesh(ctx.geo('sock-heel', () => new THREE.SphereGeometry(.2, 12, 10)), b); heel.position.set(0, .45, -.2); heel.scale.set(1, 1, .9); g.add(heel);
        const lv = { g, depth, ph: depth * 1.7 }; levels.push(lv);
        if (depth < 2) { const inner = new THREE.Group(); inner.position.set(0, 1.92, 0); inner.scale.setScalar(.62); inner.rotation.set(.22, depth * 1.4 + .6, -.18); g.add(inner); lv.inner = inner; build(inner, depth + 1); }
        return g;
      }
      build(sock, 0); sock.rotation.z = .3;
      const thread = L.sprite(pal[1], 1.8, .18); thread.position.set(0, 1.5, 0); sock.add(thread);
      const lint = K.sparks(ctx, root, { n: 10, color: '#fff0f8', size: .06, rise: .25, spread: 1.0, at: [0, .4, 0], life: 3, opacity: .55 });
      const fx = K.stageFx(ctx, root, { r: .95, h: 2.7, color: pal[0], core: [0, 1.2, .2] });
      let wob = 0; const inst = { root, frame: { r: 1.0, h: 2.7 }, float: .04, rest: { yaw: -1.25, pitch: 0 } };
      inst.react = k => { if (k === 'click') wob = 1; };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; wob = Math.max(0, wob - dt * .8);
        sock.position.y = .12 + (calm ? 0 : Math.sin(t * .9) * .05); sock.rotation.y = calm ? 0 : Math.sin(t * .4) * .08 + Math.sin(wob * 18) * .08 * wob;
        levels.forEach(l => { if (l.inner) { const s = calm ? .5 : .5 + .5 * Math.sin(t * .8 + l.ph); l.inner.position.y = 1.78 + s * .28; l.inner.rotation.z = -.18 + (calm ? 0 : Math.sin(t * .6 + l.ph) * .07); l.inner.scale.setScalar(.6 + s * .05 + wob * .04); } });
        thread.material.opacity = .15 + (calm ? 0 : Math.sin(t * 1.1) * .05); lint.update(dt, t, calm ? .05 : .3); fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== VENDING FRAGMENT
  S.registerModel('vendingfragment', {
    rest: { yaw: -.35, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), fr = new THREE.Group(); fr.position.y = .1; root.add(fr);
      const metal = F.trim(pal[0], { rough: .42, metal: .65 }), dk = F.trim(pal[2], { rough: .5, metal: .7, plain: true }), red = F.body(pal[1], { rough: .4, metal: .2, clearcoat: .5 }), glassM = F.make('glass', { color: '#a8d8ff', opacity: .22 }), led = F.make('glow', { color: pal[1], glow: 1.6 });
      // torn panel outline: straight left and bottom edges, a ragged top and right
      const W = 1.5, H = 2.2, outline = [[-W / 2, 0], [W / 2, 0], [W / 2, H * .62], [W / 2 - .12, H * .7], [W / 2 + .02, H * .82], [W / 2 - .2, H * .9], [W / 2 - .45, H * .86], [W / 2 - .6, H * .98], [-.05, H * .94], [-.3, H], [-W / 2, H * .96]];
      fr.add(new THREE.Mesh(ctx.geo('vend-panel', () => L.extrude(outline, .16, .02, { bevelSeg: 1 })), metal));
      const base = new THREE.Mesh(ctx.geo('vend-base', () => L.chamferBox(1.7, .12, .7, .03)), dk); base.position.set(0, .06, -.2); fr.add(base);
      // window: a dark recess with two shelves of snack-shaped boxes and a glass pane
      const win = new THREE.Mesh(ctx.geo('vend-win', () => L.chamferBox(.92, 1.15, .06, .02)), dk); win.position.set(-.22, 1.2, .085); fr.add(win);
      const cols = [pal[1], '#ffd24a', '#5ac8ff', '#9be86a', '#ff9ad1'], items = ctx.geo('vend-item', () => new THREE.BoxGeometry(1, 1, 1)), rng = U.mulberry32(2024), snacks = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const m = new THREE.Mesh(items, F.body(cols[(r + c * 2) % cols.length], { rough: .5, metal: 0, clearcoat: .2, plain: true })); m.position.set(-.55 + c * .22, 1.55 - r * .36, .12); m.scale.set(.16, .2 + rng() * .06, .06); m.rotation.z = (rng() - .5) * .08; fr.add(m); snacks.push(m); }
      [-.18, .18, .54].forEach(y => { const s = new THREE.Mesh(ctx.geo('vend-shelf', () => new THREE.BoxGeometry(.9, .02, .1)), metal); s.position.set(-.22, 1.2 + y - .1 - (y === .54 ? 0 : 0), .11); fr.add(s); });
      const pane = new THREE.Mesh(ctx.geo('vend-pane', () => new THREE.PlaneGeometry(.9, 1.12)), glassM); pane.position.set(-.22, 1.2, .16); fr.add(pane); const crack = new THREE.Mesh(own(ctx, L.tube([[-.5, 1.7, .165], [-.4, 1.5, .165], [-.46, 1.3, .165], [-.3, 1.05, .165]], .004, 8, 3)), K.basic(ctx, '#e8f4ff', .6)); fr.add(crack);
      // right column: scrolling display, keypad, coin slot, return
      const cvs = document.createElement('canvas'); cvs.width = 128; cvs.height = 32; const cx = cvs.getContext('2d'), tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace; ctx.tex.push(tex);
      const msgs = ['SOLD OUT', 'EXACT CHANGE', 'B4  ??', 'THANK YOU', 'NOT YET', 'INSERT SOON'], draw = (m, off) => { cx.fillStyle = '#06130c'; cx.fillRect(0, 0, 128, 32); cx.fillStyle = '#6dff9a'; cx.font = '700 20px monospace'; cx.textBaseline = 'middle'; cx.fillText(m, 128 - off, 17); tex.needsUpdate = true; }; draw(msgs[0], 40);
      const disp = new THREE.Mesh(ctx.geo('vend-disp', () => new THREE.PlaneGeometry(.42, .105)), new THREE.MeshBasicMaterial({ map: tex })); disp.position.set(.5, 1.82, .09); fr.add(disp); own(ctx, disp.material);
      const keyG = ctx.geo('vend-key', () => L.chamferBox(.1, .08, .03, .01)), keys = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const m = new THREE.Mesh(keyG, F.body('#d8d8e0', { rough: .4, metal: 0, clearcoat: .4, plain: true })); m.position.set(.4 + c * .13, 1.55 - r * .12, .095); fr.add(m); keys.push(m); }
      const slot = new THREE.Mesh(ctx.geo('vend-slot', () => L.chamferBox(.22, .05, .02, .008)), dk); slot.position.set(.5, 1.0, .09); fr.add(slot); const sl = new THREE.Mesh(ctx.geo('vend-slotled', () => new THREE.BoxGeometry(.18, .008, .01)), led); sl.position.set(.5, 1.0, .1); fr.add(sl);
      // dispense flap (hinged at the top) and tray
      const tray = new THREE.Mesh(ctx.geo('vend-tray', () => L.chamferBox(1.0, .38, .08, .02)), dk); tray.position.set(-.15, .42, .09); fr.add(tray); const flapP = new THREE.Group(); flapP.position.set(-.15, .6, .13); fr.add(flapP); const flap = new THREE.Mesh(ctx.geo('vend-flap', () => L.chamferBox(.86, .3, .02, .008)), metal); flap.position.y = -.15; flapP.add(flap);
      const drop = new THREE.Mesh(items, F.body(pal[1], { rough: .5, metal: 0, clearcoat: .2, plain: true })); drop.scale.set(.15, .19, .06); drop.position.set(-.15, .42, .12); drop.visible = false; fr.add(drop);
      fr.add(new THREE.Mesh(ctx.geo('vend-badge', () => L.chamferBox(.6, .08, .02, .008)), red)).position.set(-.22, 2.0, .09); fr.add(K.rivets(ctx, dk, [-.7, .14, .09], [.7, .14, .09], 8, .02));
      // loose wires from the torn edge, with the odd spark
      const wires = []; for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.set(.7 - i * .05, 1.6 + i * .12, .0); fr.add(g); g.add(new THREE.Mesh(own(ctx, L.tube([[0, 0, 0], [.12 + i * .03, -.1, .06], [.16, -.3 - i * .06, .02], [.1, -.55 - i * .05, .1]], .01, 14, 4)), F.body(['#ff4f6a', '#4a90ff', '#ffd24a', '#6dff9a'][i], { rough: .5, clearcoat: .3, plain: true }))); wires.push({ g, ph: i }); }
      const sparks = K.sparks(ctx, fr, { n: 8, color: '#ffe9a0', size: .05, rise: -.4, spread: .2, at: [.85, 1.45, .06], life: .9, opacity: .9 });
      const fx = K.stageFx(ctx, root, { r: 1.1, h: 2.5, color: pal[1], core: [0, 1.2, .3] });
      let press = 99, msg = 0, scroll = 0, dropT = 99; const inst = { root, frame: { r: 1.15, h: 2.45 }, float: 0, rest: { yaw: -.35, pitch: 0 } };
      inst.react = k => { if (k === 'click') { press = 0; dropT = 0; msg = (msg + 1) % msgs.length; scroll = 0; } };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; press += dt; dropT += dt; scroll += dt * 36;
        if (!calm) draw(msgs[msg], (scroll % 220) - 90 + 40 * 0); else draw(msgs[msg], 90);
        keys.forEach((k, i) => { const on = press < 1.2 && Math.floor(press * 10) % 12 === i; k.position.z = .095 - (on ? .015 : 0); k.material.emissive && (k.material.emissive.setScalar(on ? .6 : 0)); });
        flapP.rotation.x = dropT < .8 ? -Math.sin(clamp(dropT / .8, 0, 1) * Math.PI) * .9 : 0; drop.visible = dropT < .9; drop.position.y = .62 - clamp(dropT / .5, 0, 1) * .2;
        sl.material.emissiveIntensity = 1.4 + (calm ? 0 : Math.sin(t * 3) * .5); wires.forEach(w => { w.g.rotation.z = calm ? 0 : Math.sin(t * 1.5 + w.ph) * .12; w.g.rotation.x = calm ? 0 : Math.cos(t * 1.1 + w.ph) * .06; });
        fr.rotation.z = calm ? 0 : Math.sin(t * .7) * .006; sparks.update(dt, t, calm ? 0 : (Math.sin(t * 2.3) > .93 ? 4 : .1)); fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== GLITCHED CURSOR
  S.registerModel('glitchedcursor', {
    rest: { yaw: -.3, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, root = new THREE.Group(), cur = new THREE.Group(); cur.position.y = 1.35; root.add(cur);
      const arrow = (k) => [[0, 0], [0, 1.5], [.36, 1.2], [.6, 1.78], [.86, 1.66], [.62, 1.12], [1.0, 1.1]].map(p => [(p[0] - .35) * k, (.85 - p[1]) * k]).reverse();
      const fill = F.body('#f4f4ff', { rough: .35, metal: 0, clearcoat: .6, plain: true }), edge = F.body('#08080f', { rough: .5, metal: 0, clearcoat: 0, plain: true });
      const geo = ctx.geo('cur-fill', () => L.extrude(arrow(1), .12, .02, { bevelSeg: 1 })), geoE = ctx.geo('cur-edge', () => L.extrude(arrow(1.12), .1, .02, { bevelSeg: 1 }));
      const body = new THREE.Group(); cur.add(body); body.add(new THREE.Mesh(geo, fill)); const e = new THREE.Mesh(geoE, edge); e.position.z = -.02; body.add(e);
      // RGB-split ghosts (additive) and a stepped pixel trail
      const ghosts = [['#ff2b4a', .0], ['#00f0ff', .0], [pal[3], .0]].map(([c, z], i) => { const m = new THREE.Mesh(geo, K.basic(ctx, c, .38, true)); m.position.z = -.03 - i * .02; m.userData.noSil = true; m.userData.noCast = true; cur.add(m); return { m, i }; });
      const px = ctx.geo('cur-px', () => new THREE.BoxGeometry(1, 1, 1)), pxM = [K.basic(ctx, '#f4f4ff', .85), K.basic(ctx, pal[1], .7, true)], pixels = [];
      for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(px, pxM[i % 2]); const s = .13 - i * .008; m.scale.setScalar(s); m.userData.noSil = i > 2; m.userData.noCast = true; cur.add(m); pixels.push({ m, i, s }); }
      const slice = new THREE.Mesh(ctx.geo('cur-slice', () => new THREE.PlaneGeometry(1.8, .07)), K.basic(ctx, pal[1], .0, true)); slice.userData.noSil = true; slice.position.z = .1; cur.add(slice);
      const fx = K.stageFx(ctx, root, { r: .95, h: 2.5, color: pal[1], core: [0, 1.35, .2] });
      let snap = 0, next = 2.2, flip = 0, flipTo = 0, burst = 0; const inst = { root, frame: { r: 1.0, h: 2.4 }, float: .05, rest: { yaw: -.3, pitch: 0 } };
      inst.react = k => { if (k === 'click') { burst = 1; flipTo = flipTo ? 0 : Math.PI; } };
      inst.update = (dt, t, st) => {
        const calm = ctx.reduced || st.reduced; snap -= dt; next -= dt; burst = Math.max(0, burst - dt * 1.4);
        if (!calm && next <= 0) { next = 1.4 + Math.random() * 2.2; snap = .12; if (Math.random() < .4) flipTo = flipTo ? 0 : Math.PI; }
        flip += (flipTo - flip) * Math.min(1, dt * 6); cur.rotation.y = flip; cur.position.y = 1.35 + (calm ? 0 : Math.sin(t * 1.0) * .05);
        const j = snap > 0 ? 1 : 0; body.position.x = j * (Math.random() - .5) * .07; body.position.y = j * (Math.random() - .5) * .05;
        ghosts.forEach(g => { const a = (calm ? .02 : .025 + j * .09 + burst * .1) * (g.i === 0 ? -1 : g.i === 1 ? 1 : .5); g.m.position.x = a; g.m.position.y = g.i === 2 ? a * .5 : 0; g.m.material.opacity = .3 + j * .3 + burst * .2; });
        pixels.forEach(p => { const k = p.i + 1, st2 = calm ? 0 : Math.round(Math.sin(t * .7) * 1.5) * .03; p.m.position.set(.55 + k * .15 + st2, -1.0 - k * .1, -.06); p.m.visible = !(snap > 0 && p.i % 3 === 0); });
        slice.material.opacity = j ? .5 : 0; slice.position.y = (Math.random() - .5) * 1.6;
        fx.update(dt, t, calm);
      };
      return inst;
    },
  });
})();
