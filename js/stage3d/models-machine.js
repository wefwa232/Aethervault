/* AETHERVAULT — Machine: Leviathan Engine. A brass boiler engine with a flywheel and meshing gear train, crank-driven pistons,
 * pressure gauge, glowing core and steam. Moving parts are real linkage (crosshead follows the crank pin).
 * L1 gauge + pipework · L2 second stack + gear train · L3 copper coil + orbiting gears · L4 gilded plating + armillary rings + second core. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util;
  const TAU = Math.PI * 2;

  function gear(teeth, rIn, rOut, holes) {
    const pts = [], step = TAU / teeth;
    for (let i = 0; i < teeth; i++) { const a = i * step; [[0, rIn], [.14, rIn], [.2, rOut], [.46, rOut], [.52, rIn]].forEach(([k, r]) => pts.push([Math.cos(a + k * step) * r, Math.sin(a + k * step) * r])); }
    const hs = []; if (holes) for (let i = 0; i < holes.n; i++) { const a = i / holes.n * TAU, cx = Math.cos(a) * holes.r, cy = Math.sin(a) * holes.r, h = []; for (let k = 0; k < 18; k++) { const b = -k / 18 * TAU; h.push([cx + Math.cos(b) * holes.s, cy + Math.sin(b) * holes.s]); } hs.push(h); }
    return { pts, holes: hs };
  }

  S.registerModel('leviathan', {
    rest: { yaw: -.55, pitch: 0 },
    build(ctx) {
      const F = ctx.F, pal = ctx.item.pal, lvl = ctx.level, root = new THREE.Group(), m = new THREE.Group(); root.add(m);
      const brass = F.trim(pal[0], { rough: .36, metal: 1, env: 1.3 }), iron = F.body('#2b2118', { rough: .55, metal: .75, clearcoat: 0 }), steel = F.trim('#8b8f96', { rough: .3 }), copper = F.trim('#b4662c', { rough: .3 });
      const gold = F.trim(lvl >= 4 ? '#e0b24a' : pal[0], { rough: .22 }), coreM = F.make('glow', { color: pal[1], glow: 2.0 });
      const gearBr = lvl >= 4 ? gold : brass;

      // base frame
      const baseG = ctx.geo('lev-base', () => L.chamferBox(3.4, .2, 1.7, .05)); const base = new THREE.Mesh(baseG, iron); base.position.y = .1; m.add(base);
      const trimG = ctx.geo('lev-trim', () => L.chamferBox(3.5, .06, 1.8, .02)); const trim = new THREE.Mesh(trimG, brass); trim.position.y = .21; m.add(trim);
      [[-1.55, .78], [1.55, .78], [-1.55, -.78], [1.55, -.78]].forEach(([x, z]) => { const f = new THREE.Mesh(L.lathe([[0, -.1], [.12, -.1], [.14, 0], [.1, .08], [0, .08]], 16), brass); f.position.set(x, 0, z); m.add(f); });
      // boiler: horizontal lathe barrel with bands and domed caps
      const barrel = new THREE.Mesh(L.lathe([[0, -1.0], [.34, -.98], [.5, -.84], [.52, -.7], [.52, .7], [.5, .84], [.34, .98], [0, 1.0]], 40), brass); barrel.rotation.z = Math.PI / 2; barrel.position.set(-.8, .85, 0); m.add(barrel);
      for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(.535, .028, 8, 48), steel); b.rotation.y = Math.PI / 2; b.position.set(-.8 + i * .34, .85, 0); m.add(b); }
      const rivG = new THREE.SphereGeometry(.014, 6, 5); ctx.disposables.push(rivG);
      for (let i = -2; i <= 2; i += 1) for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; const r = new THREE.Mesh(rivG, steel); r.position.set(-.8 + i * .34 + .045, .85 + Math.cos(a) * .53, Math.sin(a) * .53); m.add(r); }
      // porthole + core at the front end
      const ph = new THREE.Mesh(new THREE.TorusGeometry(.22, .04, 10, 32), steel); ph.position.set(-.8, .85, .52); m.add(ph);
      const core = new THREE.Mesh(new THREE.SphereGeometry(.18, 20, 14), coreM); core.position.set(-.8, .85, .46); m.add(core);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(.2, 28), F.make('glass', { color: '#cfe', opacity: .22 })); glass.position.set(-.8, .85, .545); m.add(glass);
      const coreLight = new THREE.PointLight(new THREE.Color(pal[1]), 2.5, 3.2, 1.8); coreLight.position.set(-.8, .85, .9); m.add(coreLight);
      // chimney
      const stack = new THREE.Mesh(L.lathe([[0, 0], [.17, 0], [.16, .5], [.14, .9], [.2, 1.0], [.25, 1.08], [.21, 1.1], [0, 1.1]], 28), brass); stack.position.set(-1.25, 1.3, 0); m.add(stack);
      const stackBand = new THREE.Mesh(new THREE.TorusGeometry(.17, .02, 8, 28), steel); stackBand.rotation.x = Math.PI / 2; stackBand.position.set(-1.25, 1.55, 0); m.add(stackBand);
      // flywheel (large gear with lightening holes) + crank pin
      const fx = 1.05, fy = 1.05, FW = new THREE.Group(); FW.position.set(fx, fy, .35); m.add(FW);
      const g1 = gear(24, .9, 1.02, { n: 6, r: .56, s: .2 }); const fgeo = ctx.geo('lev-fly', () => L.extrude(g1.pts, .12, .02, { holes: g1.holes, bevelSeg: 1, curveSeg: 6 }));
      FW.add(new THREE.Mesh(fgeo, gearBr)); const hub = new THREE.Mesh(L.lathe([[0, -.12], [.2, -.12], [.22, -.06], [.22, .1], [.14, .16], [0, .16]], 24), steel); hub.rotation.x = Math.PI / 2; FW.add(hub);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.7, .018, 8, 56), steel); rim.position.z = .07; FW.add(rim);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .2, 12), steel); pin.rotation.x = Math.PI / 2; pin.position.set(.62, 0, .12); FW.add(pin);
      // small meshing gears
      const g2 = gear(13, .38, .48, { n: 5, r: .22, s: .08 }); const sgeo = ctx.geo('lev-small', () => L.extrude(g2.pts, .12, .02, { holes: g2.holes, bevelSeg: 1, curveSeg: 6 }));
      const SG = new THREE.Group(); SG.position.set(fx - 1.2, fy + .65, .35); SG.add(new THREE.Mesh(sgeo, brass)); const shub = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .22, 16), steel); shub.rotation.x = Math.PI / 2; SG.add(shub); m.add(SG);
      // piston cylinder (horizontal, lower right) + crosshead + rods (animated)
      const cy0 = .52, cyl = new THREE.Mesh(L.lathe([[0, -.7], [.2, -.7], [.22, -.62], [.22, .55], [.19, .6], [0, .6]], 24), iron); cyl.rotation.z = Math.PI / 2; cyl.position.set(1.0, cy0 + .12, .6); m.add(cyl);
      const cylBand = new THREE.Mesh(new THREE.TorusGeometry(.225, .025, 8, 28), brass); cylBand.rotation.y = Math.PI / 2; cylBand.position.set(.5, cy0 + .12, .6); m.add(cylBand);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1, 10), steel); m.add(rod);
      const head = new THREE.Mesh(new THREE.BoxGeometry(.16, .13, .16), brass); head.position.z = .6; m.add(head);
      const conn = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, 1, 8), steel); m.add(conn);
      // pipework between boiler and cylinder
      const pipePts = [[-.3, .95, .45], [.1, 1.25, .62], [.45, .85, .66], [.5, .66, .62]]; m.add(new THREE.Mesh(L.tube(pipePts, .05, 24, 10), copper));
      [[-.3, .95, .45], [.5, .66, .62]].forEach(p => { const fl = new THREE.Mesh(new THREE.TorusGeometry(.07, .022, 8, 20), brass); fl.position.set(...p); m.add(fl); });
      // valve wheel on pipe
      const vw = new THREE.Group(); vw.position.set(.1, 1.34, .62); vw.add(new THREE.Mesh(new THREE.TorusGeometry(.1, .014, 6, 24), brass)); for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .2, 5), brass); sp.rotation.z = i * Math.PI / 4; vw.add(sp); } vw.add(new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .12, 8), steel)); m.add(vw);
      // stage additions
      let needle = null, gauge = null;
      if (lvl >= 1) {
        const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#e9dfc7'; x.beginPath(); x.arc(128, 128, 120, 0, TAU); x.fill(); x.strokeStyle = '#2b2118'; x.lineWidth = 6; x.stroke(); x.fillStyle = '#2b2118'; x.font = '600 26px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.8 + i / 8 * Math.PI * 1.4, r = 96; x.fillText(String(i), 128 + Math.cos(a) * r, 128 + Math.sin(a) * r); x.beginPath(); x.moveTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); x.lineTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); x.stroke(); } x.fillStyle = '#b33a2a'; x.fillRect(188, 168, 36, 8); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(); ctx.tex.push(tex);
        gauge = new THREE.Group(); gauge.position.set(-1.5, 1.62, .22); const gb = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .08, 28), brass); gb.rotation.x = Math.PI / 2; gauge.add(gb); const gf = new THREE.Mesh(new THREE.CircleGeometry(.17, 28), new THREE.MeshStandardMaterial({ map: tex, roughness: .5 })); gf.position.z = .042; gauge.add(gf); ctx.disposables.push(gf.material);
        needle = new THREE.Mesh(new THREE.BoxGeometry(.008, .15, .004), new THREE.MeshBasicMaterial({ color: 0xb33a2a })); needle.geometry.translate(0, .07, 0); needle.position.z = .048; gauge.add(needle); ctx.disposables.push(needle.material); m.add(gauge);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .35, 8), copper); stem.position.set(-1.5, 1.4, .1); m.add(stem);
        m.add(new THREE.Mesh(L.tube([[-1.3, .6, .55], [-1.45, .5, .8], [-1.0, .4, .8], [-.4, .3, .8]], .035, 24, 8), copper));
      }
      let stack2 = null, trainG = null;
      if (lvl >= 2) { stack2 = new THREE.Mesh(L.lathe([[0, 0], [.13, 0], [.12, .4], [.1, .7], [.15, .78], [.18, .85], [0, .85]], 24), brass); stack2.position.set(-.35, 1.32, -.1); m.add(stack2);
        trainG = new THREE.Group(); const g3 = gear(9, .24, .32, null), tg = ctx.geo('lev-tiny', () => L.extrude(g3.pts, .1, .015, { bevelSeg: 1, curveSeg: 6 })); [[-1.55, 1.9, .35, 1], [-1.9, 1.55, .35, -1]].forEach(([x, y, z, d]) => { const t = new THREE.Mesh(tg, gearBr); t.position.set(x, y, z); t.userData.d = d; trainG.add(t); }); m.add(trainG); }
      let coil = null, orbit = null;
      if (lvl >= 3) { const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * 18 * Math.PI; pts.push([Math.cos(a) * .16, t * .9, Math.sin(a) * .16]); } coil = new THREE.Mesh(L.tube(pts, .018, 200, 6), copper); coil.position.set(.2, .25, -.55); m.add(coil); const bulb = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 12), F.make('glow', { color: pal[1], glow: 2 })); bulb.position.set(.2, 1.22, -.55); m.add(bulb);
        orbit = new THREE.Group(); orbit.position.set(0, 1.2, 0); const g4 = gear(10, .2, .27, null), og = ctx.geo('lev-orb', () => L.extrude(g4.pts, .06, .01, { bevelSeg: 1, curveSeg: 6 })); for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(og, gold); t.userData.i = i; orbit.add(t); } m.add(orbit); }
      let rings = [], core2 = null, plateFx = null;
      if (lvl >= 4) { for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 - i * .3, .018, 8, 96), gold); r.position.y = 1.2; r.userData.stageRing = true; r.userData.ax = i ? [.2, 1, .3] : [1, .2, 0]; rings.push(r); m.add(r); } core2 = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), coreM); core2.position.set(1.05, 1.05, .6); m.add(core2); }
      // steam
      const steam = []; const steamN = Math.round(8 * ctx.q.particles); for (let i = 0; i < steamN; i++) { const s = L.sprite('#dfe7ef', .36, .22); s.userData.ph = i / steamN; steam.push(s); m.add(s); }
      // potential
      let embers = null; if (ctx.potentialTier >= 1) { const n = Math.round(12 * ctx.q.particles), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 3; pos[i * 3 + 1] = Math.random() * 2.2; pos[i * 3 + 2] = (Math.random() - .5) * 1.4; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const mm = new THREE.PointsMaterial({ map: L.dotTex(), color: new THREE.Color(pal[1]), size: .05, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }); embers = new THREE.Points(g, mm); embers.userData.noSil = true; embers.userData.base = pos.slice(); m.add(embers); ctx.disposables.push(mm); }
      m.position.set(-.1, .25, 0);
      const inst = { root, frame: { r: 2.2, h: 2.6 }, float: 0, rest: { yaw: -.6, pitch: 0 }, speed: 1, burst: 0 };
      inst.react = k => { if (k === 'click') inst.burst = 1; };
      let th = 0;
      inst.update = (dt, t, st) => {
        const calm = st.reduced; inst.burst = Math.max(0, inst.burst - dt * .8); const sp = (calm ? 0 : 1.1 + inst.burst * 3.2); th += dt * sp;
        FW.rotation.z = th; SG.rotation.z = -th * 24 / 13 + .13; const pr = .62, px = fx + Math.cos(th) * pr, py = fy + Math.sin(th) * pr, ch = cy0 + .12 + 0, Lr = 1.5, cx = px - Math.sqrt(Math.max(.1, Lr * Lr - (py - ch) * (py - ch)));
        head.position.set(cx, ch, .6); rod.scale.y = Math.abs(cx - .2 - .0) + .0; rod.rotation.z = Math.PI / 2; rod.position.set((cx + .2) / 2 - .0, ch, .6); rod.scale.y = Math.max(.1, cx - .2);
        const dx = px - cx, dy = py - ch, len = Math.hypot(dx, dy); conn.position.set((px + cx) / 2, (py + ch) / 2, .5); conn.scale.y = len; conn.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
        vw.rotation.z = th * .2; if (needle) needle.rotation.z = -1.2 + Math.sin(t * .9) * .15 + inst.burst * .6 + (calm ? 0 : Math.sin(t * 7) * .02);
        if (trainG) trainG.children.forEach(g => (g.rotation.z = th * 1.3 * g.userData.d)); if (orbit) orbit.children.forEach((g, i) => { const a = t * .4 + i / 3 * TAU; g.position.set(Math.cos(a) * 2.0, Math.sin(t + i) * .2, Math.sin(a) * 1.1); g.rotation.z = th * 2; g.rotation.x = Math.PI / 2; });
        rings.forEach((r, i) => { const ax = r.userData.ax; r.rotation.x = (calm ? 0 : t * .15 * ax[0]) + i * 1.2; r.rotation.y = (calm ? 0 : t * .12 * ax[1]); r.rotation.z = (calm ? 0 : t * .1 * ax[2]); });
        coreM.emissiveIntensity = 1.8 + (calm ? 0 : Math.sin(t * 3) * .3) + inst.burst * 2; coreLight.intensity = 2.5 + (calm ? 0 : Math.sin(t * 3)) * .6 + inst.burst * 4;
        steam.forEach(s => { const k = ((t * .22 + s.userData.ph) % 1); s.position.set((stack2 ? (s.userData.ph > .5 ? -.35 : -1.25) : -1.25) + Math.sin(k * 6 + s.userData.ph * 9) * .08 + k * .25, 2.45 + k * 1.1, (s.userData.ph - .5) * .08); s.scale.setScalar(.18 + k * .65); s.material.opacity = (calm ? .16 : (1 - k) * .28) * (k < .1 ? k * 10 : 1); });
        if (embers) { const p = embers.geometry.attributes.position, b = embers.userData.base; for (let i = 0; i < p.count; i++) { p.array[i * 3 + 1] = (b[i * 3 + 1] + t * .1 * (1 + (i % 3) * .3)) % 2.4; } p.needsUpdate = true; }
      };
      return inst;
    },
  });
})();
