/* AETHERVAULT — Phase Two gear: two silhouettes that share nothing with the swords.
 *   Ionbow       — recurve bow (tapered limbs, riser with ion core, glowing string). Idle: an energy arrow is drawn, loosed and re-forms.
 *   Gravehammer  — vertebra-hafted maul, cracked stone head, bone spikes, runed faces, swaying charms. Click: a shock ring.
 * Built from kit parts (K.taper, K.runeTex, K.sparks, K.stageFx). Stage additions are the kit's L1–L4 + potential motes. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, clamp = U.clamp;
  const Y = new THREE.Vector3(0, 1, 0);
  /** Cylinder segment between two points (unit cylinder along y, scaled/oriented each call — used for the bow string). */
  function seg(mesh, a, b) { const d = new THREE.Vector3().subVectors(b, a), len = d.length(); mesh.position.copy(a).addScaledVector(d, .5); mesh.scale.set(1, len, 1); mesh.quaternion.setFromUnitVectors(Y, d.normalize()); }
  /** Stone that always carries grime + a few scratches regardless of condition (aged material). */
  function stoneMat(ctx, hex, bucket, o = {}) {
    const m = ctx.F.body(hex, Object.assign({ rough: .92, metal: 0, clearcoat: 0, pat: .5 }, o)), tr = m.userData.tr;
    tr.wear = L.wearTexture(bucket, ctx.q.tex); tr.u1.value.y = Math.max(tr.u1.value.y, .3); tr.u1.value.z = Math.max(tr.u1.value.z, .5); tr.u2.value.w = .9; return m;
  }

  // =================================================================== IONBOW
  S.registerModel('ionbow', {
    rest: { yaw: -.3, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), bow = new THREE.Group(); root.add(bow); bow.position.y = 1.5; bow.rotation.z = .04;
      const wood = F.body(L.mix(pal[0], '#5a7aa8', .35), { rough: .34, metal: .3, clearcoat: .8, ccRough: .1 }), steel = F.trim('#aeb9cc', { rough: .26 }), darkM = F.trim('#1b2538', { rough: .35, metal: .8 });
      const ion = F.make('glow', { color: pal[1], glow: 1.7 }), cordM = F.make('glow', { color: pal[3], glow: 2.2 });
      // limbs: recurve, flattened
      const up = [[0, .22, 0], [-.13, .52, 0], [-.21, .86, 0], [-.08, 1.14, 0], [.28, 1.34, 0]], lo = up.map(p => [p[0], -p[1], p[2]]);
      const limbGeo = (pts, k) => ctx.geo('ionbow-limb' + k, () => { const g = K.taper(pts, .088, .032, { radial: 10, seg: 28, ends: 'round' }); g.scale(1, 1, .62); return g; });
      bow.add(new THREE.Mesh(limbGeo(up, 'u'), wood), new THREE.Mesh(limbGeo(lo, 'l'), wood));
      [up, lo].forEach(pts => { const inl = pts.map(p => [p[0] + .004, p[1], .042]); bow.add(new THREE.Mesh(K.taper(inl, .011, .006, { radial: 5, seg: 24, ends: 'point' }), ion));
        const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), fin = ctx.geo('ionbow-fin', () => L.extrude([[0, 0], [.07, .02], [0, .16], [-.015, .06]], .018, .004, { bevelSeg: 1 }));
        [.3, .52, .74].forEach((t, i) => { const p = curve.getPoint(t), tn = curve.getTangent(t), m = new THREE.Mesh(fin, steel); m.position.set(p.x - .05, p.y, 0); m.rotation.z = Math.atan2(tn.y, tn.x) - Math.PI / 2 + (pts === lo ? Math.PI : 0) * 0; m.scale.set(-1, pts === lo ? -1 : 1, 1); bow.add(m); }); });
      // riser: lathe grip, steel cheek plates, leather wrap, ion core, coil rings
      bow.add(new THREE.Mesh(ctx.geo('ionbow-riser', () => L.lathe([[0, -.34], [.06, -.34], [.088, -.24], [.078, -.1], [.078, .1], [.088, .24], [.06, .34], [0, .34]], 20)), wood));
      [-1, 1].forEach(sd => { const pl = new THREE.Mesh(ctx.geo('ionbow-plate', () => L.extrude([[-.045, -.3], [.045, -.24], [.05, .24], [-.045, .3]], .026, .008, { bevelSeg: 1 })), steel); pl.position.set(-.012, 0, sd * .082); bow.add(pl); });
      const wrap = []; for (let i = 0; i <= 90; i++) { const t = i / 90, a = t * 11 * TAU; wrap.push([Math.cos(a) * .088, -.13 + t * .26, Math.sin(a) * .088]); } bow.add(new THREE.Mesh(L.tube(wrap, .0085, 120, 5), F.body('#2a1f2a', { rough: .8, metal: 0, clearcoat: 0 })));
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(.07, 0), ion); core.scale.set(.8, 1.4, .8); core.position.set(.02, .0, .1); bow.add(core); ctx.disposables.push(core.geometry);
      [-.24, .24, -.3, .3].forEach((y, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(.09 - (i > 1 ? .01 : 0), .01, 6, 24), i > 1 ? steel : ion); r.rotation.x = Math.PI / 2; r.position.y = y; bow.add(r); });
      const tipU = new THREE.Vector3(.28, 1.34, 0), tipL = new THREE.Vector3(.28, -1.34, 0);
      [tipU, tipL].forEach(p => { const cap = new THREE.Mesh(L.lathe([[0, 0], [.035, 0], [.045, .04], [.03, .09], [0, .1]], 12), steel); cap.position.copy(p); cap.rotation.z = p.y > 0 ? -.4 : Math.PI + .4; bow.add(cap); const g = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), ion); g.position.copy(p); bow.add(g); ctx.disposables.push(g.geometry); });
      // string (two live segments) + energy arrow
      const strGeo = new THREE.CylinderGeometry(.0065, .0065, 1, 5, 1, true); ctx.disposables.push(strGeo);
      const s1 = new THREE.Mesh(strGeo, cordM), s2 = new THREE.Mesh(strGeo, cordM); bow.add(s1, s2); K.noSil(s1); K.noSil(s2);
      const arrow = new THREE.Group(); bow.add(arrow);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, 1.1, 6), cordM); shaft.rotation.z = Math.PI / 2; shaft.position.x = -.55; arrow.add(shaft);
      const head = new THREE.Mesh(new THREE.ConeGeometry(.04, .17, 8), ion); head.rotation.z = Math.PI / 2; head.position.x = -1.17; arrow.add(head);
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(ctx.geo('ionbow-fletch', () => new THREE.PlaneGeometry(.16, .06)), K.basic(ctx, pal[1], .8, true, { side: THREE.DoubleSide })); f.position.x = -.1; f.rotation.x = i / 3 * Math.PI; arrow.add(f); }
      const trail = L.sprite(pal[1], .8, .5); trail.position.x = -.6; arrow.add(trail); K.noSil(arrow);
      // levels: runed riser strip (L1) + second pair of coil fins (L2) handled by the kit rings/orbit/halo
      if (lvl >= 1) { const t = K.runeTex(ctx, 41, 1, 7, 128, pal[1], { w: 64, h: 256 }), m = new THREE.Mesh(new THREE.PlaneGeometry(.07, .3), K.basic(ctx, '#ffffff', 1, true, { map: t, depthWrite: false })); m.position.set(-.02, 0, .115); m.userData.noSil = true; bow.add(m); }
      const base = new THREE.Mesh(new THREE.TorusGeometry(.7, .014, 6, 64), K.basic(ctx, pal[1], .35, true)); base.rotation.x = Math.PI / 2; base.position.y = .05; base.userData.noSil = true; base.userData.stageRing = true; root.add(base);
      const fx = K.stageFx(ctx, root, { r: 1.05, h: 2.8, color: pal[1], core: [0, 1.5, .12] });
      // behaviour: draw → hold → loose → re-form (idle every ~9 s, or on click)
      const SH = { st: 'idle', t: 0, next: 4 + Math.random() * 3, draw: 0, vib: 0, vibT: 0, fly: 0, flyX: 0, form: 1 };
      const inst = { root, frame: { r: 1.15, h: 3.0 }, float: .06, rest: { yaw: -.3, pitch: 0 } };
      inst.react = k => { if (k === 'click' && SH.st === 'idle') { SH.st = 'draw'; SH.t = 0; } };
      const setString = nx => { const n = new THREE.Vector3(nx, 0, 0); seg(s1, tipU, n); seg(s2, n, tipL); arrow.position.set(nx, 0, 0); };
      inst.update = (dt, t, st) => {
        const calm = st.reduced; SH.t += dt;
        if (!calm) {
          if (SH.st === 'idle') { SH.next -= dt; if (SH.next <= 0) { SH.st = 'draw'; SH.t = 0; } }
          else if (SH.st === 'draw') { SH.draw = Math.min(1, SH.t / .9); if (SH.t > 1.25) { SH.st = 'loose'; SH.t = 0; SH.fly = 1; SH.flyX = 0; SH.vib = 1; SH.vibT = 0; } }
          else if (SH.st === 'loose') { SH.draw = Math.max(0, SH.draw - dt * 9); SH.flyX -= dt * 6.5; if (SH.t > .9) { SH.st = 'form'; SH.t = 0; SH.fly = 0; SH.form = 0; } }
          else if (SH.st === 'form') { SH.form = Math.min(1, SH.t / .8); SH.draw = 0; if (SH.t > .8) { SH.st = 'idle'; SH.next = 8 + Math.random() * 5; } }
        } else { SH.draw = 0; SH.form = 1; SH.fly = 0; }
        SH.vibT += dt; const vib = SH.vib * Math.exp(-SH.vibT * 5) * Math.sin(SH.vibT * 60) * .02; if (SH.vibT > 1.2) SH.vib = 0;
        const nx = .28 + SH.draw * SH.draw * .52 + vib; setString(nx);
        const flying = SH.st === 'loose'; arrow.visible = SH.st !== 'form' || SH.form > .05;
        if (flying) arrow.position.set(nx + SH.flyX, 0, 0); arrow.scale.setScalar(SH.st === 'form' ? .3 + SH.form * .7 : 1); trail.material.opacity = flying ? .8 : .35 + SH.draw * .3;
        ion.emissiveIntensity = 1.6 + (calm ? 0 : Math.sin(t * 2.1) * .3) + SH.draw * 1.6; cordM.emissiveIntensity = 2 + SH.draw * 1.5;
        core.rotation.y = t * .8; base.material.opacity = .28 + (calm ? 0 : Math.sin(t * 1.6) * .08) + SH.draw * .3;
        bow.position.y = 1.5 + (calm ? 0 : Math.sin(t * 1.1) * .02); fx.update(dt, t, calm);
      };
      setString(.28);
      return inst;
    },
  });

  // =================================================================== GRAVEHAMMER
  S.registerModel('gravehammer', {
    rest: { yaw: -.3, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), hm = new THREE.Group(); root.add(hm); hm.rotation.z = -.04;
      const bone = F.body('#e6d9bd', { rough: .62, metal: 0, clearcoat: .12, pat: .4 }), boneDk = F.body('#b9a984', { rough: .7, metal: 0, clearcoat: 0 }), stone = stoneMat(ctx, L.mix(pal[0], '#4a4252', .4), 7), iron = F.trim('#2b2830', { rough: .45, metal: .85 }), glow = F.make('glow', { color: pal[1], glow: 1.5 });
      // haft: stacked vertebrae
      const haft = ctx.geo('gh-haft', () => { const p = []; for (let s = 0; s < 18; s++) { const y = .08 + s * .105; p.push([.05, y], [.074, y + .02], [.078, y + .05], [.062, y + .086], [.05, y + .104]); } p.unshift([0, .08]); p.push([0, 1.98]); return L.lathe(p, 14); });
      hm.add(new THREE.Mesh(haft, bone));
      const cord = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * 14 * TAU; cord.push([Math.cos(a) * .067, .25 + t * .62, Math.sin(a) * .067]); } hm.add(new THREE.Mesh(L.tube(cord, .009, 160, 5), F.body('#3a2a26', { rough: .85, metal: 0, clearcoat: 0 })));
      // skull pommel
      const sk = new THREE.Group(); sk.position.set(0, .02, 0); hm.add(sk);
      const cr = new THREE.Mesh(ctx.geo('gh-skull', () => { const g = new THREE.SphereGeometry(1, 22, 16); g.scale(.17, .15, .17); return g; }), bone); cr.position.y = .1; sk.add(cr);
      const jaw = new THREE.Mesh(ctx.geo('gh-jaw', () => L.chamferBox(.17, .06, .13, .02)), boneDk); jaw.position.set(0, -.02, .04); sk.add(jaw);
      [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(.036, 10, 8), glow); e.position.set(sd * .062, .115, .158); e.scale.set(1.1, 1.3, .4); sk.add(e); ctx.disposables.push(e.geometry); for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(ctx.geo('gh-tooth', () => new THREE.BoxGeometry(.014, .03, .014)), bone); t.position.set(sd * .03 * (k + .3) - sd * .02, .0, .155); sk.add(t); } });
      // head: cracked stone block, iron bands, rune faces, bone spikes
      const hd = new THREE.Group(); hd.position.y = 2.12; hm.add(hd);
      const block = new THREE.Mesh(ctx.geo('gh-block', () => L.chamferBox(1.18, .6, .62, .07)), stone); hd.add(block);
      [-.36, .36].forEach(x => { const b = new THREE.Mesh(ctx.geo('gh-band', () => L.chamferBox(.09, .66, .68, .02)), iron); b.position.x = x; hd.add(b); hd.add(K.rivets(ctx, iron, [x - .03, .27, .35], [x + .03, .27, .35], 2, .018), K.rivets(ctx, iron, [x - .03, -.27, .35], [x + .03, -.27, .35], 2, .018)); });
      const runeT = K.runeTex(ctx, 913, 5, 2, 256, pal[1], { w: 512, h: 200, line: 7, gap: .2 });
      [-1, 1].forEach(sd => { const m = new THREE.Mesh(new THREE.PlaneGeometry(.58, .26), K.basic(ctx, '#ffffff', 1, true, { map: runeT, depthWrite: false })); m.position.set(0, 0, sd * .318); if (sd < 0) m.rotation.y = Math.PI; m.userData.noSil = true; hd.add(m); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.05, 0), glow); gem.scale.set(.8, 1.3, .5); gem.position.set(0, .0, sd * .34); hd.add(gem); ctx.disposables.push(gem.geometry); });
      [-1, 1].forEach(sd => { hd.add(new THREE.Mesh(K.taper([[sd * .58, 0, 0], [sd * .78, .02, 0], [sd * .98, .2, 0]], .13, .01, { radial: 9, seg: 12, ends: 'point' }), bone)); const r = new THREE.Mesh(new THREE.TorusGeometry(.11, .018, 6, 18), boneDk); r.rotation.y = Math.PI / 2; r.position.x = sd * .6; hd.add(r); });
      hd.add(new THREE.Mesh(K.taper([[0, .3, 0], [0, .42, -.02], [.02, .62, -.06]], .07, .008, { radial: 8, seg: 8, ends: 'point' }), bone));
      // hanging bone charms (pendulums)
      const charms = []; [.12, -.12].forEach((x, i) => { const g = new THREE.Group(); g.position.set(x, 1.9, .1); let y = 0; for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(ctx.geo('gh-charm', () => { const c = new THREE.CylinderGeometry(.012, .012, .09, 6); return c; }), bone); b.position.y = y - .045; g.add(b); const kn = new THREE.Mesh(ctx.geo('gh-knob', () => new THREE.SphereGeometry(.02, 8, 6)), boneDk); kn.position.y = y - .09; g.add(kn); y -= .1; } hm.add(g); charms.push({ g, ph: i * 1.7 }); });
      const dust = K.sparks(ctx, hd, { n: 14, color: pal[1], size: .045, rise: -.28, spread: 1.1, at: [0, .2, 0], life: 2.8, opacity: .8 });
      const shock = new THREE.Mesh(new THREE.TorusGeometry(.5, .018, 6, 64), K.basic(ctx, pal[1], 0, true)); shock.rotation.x = Math.PI / 2; shock.position.y = .04; shock.userData.noSil = true; root.add(shock);
      const fx = K.stageFx(ctx, root, { r: 1.05, h: 2.7, color: pal[1], core: [0, 2.12, .35] });
      let sh = 99, rung = 0;
      const inst = { root, frame: { r: 1.15, h: 2.75 }, float: .03, rest: { yaw: -.3, pitch: 0 } };
      inst.react = k => { if (k === 'click') { sh = 0; rung = 1; } };
      inst.update = (dt, t, st) => {
        const calm = st.reduced; sh += dt; rung = Math.max(0, rung - dt * 1.4);
        glow.emissiveIntensity = 1.4 + (calm ? 0 : Math.sin(t * 1.5) * .35) + rung * 2.2;
        charms.forEach(c => { c.g.rotation.z = calm ? 0 : Math.sin(t * 1.4 + c.ph) * .1 + Math.sin(sh * 14) * .12 * Math.exp(-sh * 3); c.g.rotation.x = calm ? 0 : Math.cos(t * 1.1 + c.ph) * .06; });
        if (sh < 1.4) { const k = sh / 1.4; shock.scale.setScalar(1 + k * 2.2); shock.material.opacity = (1 - k) * .7; hm.position.y = Math.max(0, Math.sin(Math.min(1, sh / .25) * Math.PI)) * .06; } else { shock.material.opacity = 0; hm.position.y = 0; }
        hd.rotation.z = calm ? 0 : Math.sin(t * .6) * .006; dust.update(dt, t, calm ? .1 : .5); fx.update(dt, t, calm);
      };
      return inst;
    },
  });
})();
