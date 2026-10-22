/* AETHERVAULT — 3D containers: Hatchling/Starlit/First Egg, Forge Crate, Mythic Vault.
 * Each exposes the ritual API: setProgress(p) · pulse() · open() · opened  */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util;
  const TAU = Math.PI * 2;
  const smooth = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ===================================================================== EGG
  S.registerModel('container:egg', {
    rest: { yaw: -.5, pitch: 0 },
    build(ctx) {
      const th = ctx.theme && ctx.theme.length ? ctx.theme : ['#ff9ad1', '#ffd36b'];
      const F = ctx.F, root = new THREE.Group(); F.crackColor = th[1];
      const A = .5, B = .74, LIFT = .2, EY = B + LIFT;
      const rad = phi => A * Math.sin(phi) * (1 + .14 * Math.cos(phi)), yy = phi => EY - B * Math.cos(phi);
      const PHI0 = 2.02, jag = u => .1 * (Math.abs(((u * 11) % 1) * 2 - 1) - .5) + .035 * Math.sin(u * TAU * 3);
      const shellCol = L.mix('#efe6d2', th[0], .3);
      const shellMat = F.body(shellCol, { rough: .38, clearcoat: .5, ccRough: .3, forceWear: true, soft: true });
      shellMat.userData.tr.pat = L.patternTexture('spotted', 913, false, ctx.q.tex); shellMat.userData.tr.u1.value.x = .55; shellMat.userData.tr.u2.value.z = 1.6;
      shellMat.userData.tr.wear = L.wearTexture(5, ctx.q.tex); shellMat.userData.tr.u1.value.w = 0; shellMat.userData.tr.u2.value.w = .9;
      const innerMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(L.mix('#fff3d8', th[1], .35)), emissive: new THREE.Color(th[1]), emissiveIntensity: .5, roughness: .8, side: THREE.BackSide }); ctx.disposables.push(innerMat);
      const brass = F.trim('#b48d4c', { rough: .3, plain: true }), brassDk = F.trim('#6c5429', { rough: .45, plain: true });

      const part = top => L.paramSurface(72, 22, (u, v, p) => {
        const th_ = u * TAU, c = PHI0 + jag(u), phi = top ? c + (Math.PI - c) * v : c * v, r = rad(phi);
        p.set(Math.cos(th_) * r, yy(phi), Math.sin(th_) * r);
      }, true);
      const inner = top => L.paramSurface(72, 22, (u, v, p) => {
        const th_ = u * TAU, c = PHI0 + jag(u), phi = top ? c + (Math.PI - c) * v : c * v, r = rad(phi) * .93;
        p.set(Math.cos(th_) * r, EY + (yy(phi) - EY) * .94, Math.sin(th_) * r);
      }, true);
      const rim = L.paramSurface(72, 1, (u, v, p) => {
        const th_ = u * TAU, c = PHI0 + jag(u), r = rad(c) * (1 - .07 * v);
        p.set(Math.cos(th_) * r, EY + (yy(c) - EY) * (1 - .06 * v), Math.sin(th_) * r);
      }, true);
      const bottom = new THREE.Group(), cap = new THREE.Group();
      bottom.add(new THREE.Mesh(part(false), shellMat), new THREE.Mesh(inner(false), innerMat), new THREE.Mesh(rim, shellMat));
      cap.add(new THREE.Mesh(part(true), shellMat), new THREE.Mesh(inner(true), innerMat), new THREE.Mesh(rim, shellMat));
      const eggG = new THREE.Group(); eggG.add(bottom, cap); root.add(eggG);

      // decorative brass bands following the shell
      const band = (p0, p1, off, mat) => { const pts = []; for (let i = 0; i <= 12; i++) { const phi = p0 + (p1 - p0) * i / 12; pts.push([rad(phi) + off, yy(phi)]); } return new THREE.Mesh(L.lathe(pts, 72), mat); };
      const b1 = band(1.3, 1.34, .012, brass), b2 = band(1.52, 1.55, .014, brass), b3 = band(1.72, 1.74, .01, brass);
      const rune = band(1.4, 1.46, .008, brassDk); bottom.add(b1, b2, b3, rune);
      // fine rune studs between bands
      const studG = new THREE.SphereGeometry(.014, 8, 6); ctx.disposables.push(studG);
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, phi = 1.43, r = rad(phi) + .012, s = new THREE.Mesh(studG, brass); s.position.set(Math.cos(a) * r, yy(phi), Math.sin(a) * r); bottom.add(s); }

      // core light
      const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(th[1]), transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
      const core = new THREE.Mesh(new THREE.SphereGeometry(.36, 24, 18), coreMat); core.position.y = EY - .05; core.userData.noSil = true; root.add(core); ctx.disposables.push(coreMat);
      const corePt = new THREE.PointLight(new THREE.Color(th[1]), 0, 4, 1.6); corePt.position.set(0, EY, 0); root.add(corePt);
      const halo = L.sprite(th[1], 2.6, .0); halo.position.set(0, EY, 0); root.add(halo);

      // cradle: ornate ring base + three sweeping prongs ending in leaf tips
      const baseProf = [[0, 0], [.74, 0], [.76, .03], [.7, .06], [.7, .1], [.6, .12], [.58, .17], [.46, .19], [.42, .23], [.3, .26], [0, .26]];
      const baseM = new THREE.Mesh(L.lathe(baseProf, 64), F.trim('#3a352c', { rough: .5, metal: .7, plain: true })); root.add(baseM);
      const ringM = new THREE.Mesh(new THREE.TorusGeometry(.62, .02, 8, 72), brass); ringM.rotation.x = Math.PI / 2; ringM.position.y = .125; root.add(ringM);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(.44, .016, 8, 64), brass); ring2.rotation.x = Math.PI / 2; ring2.position.y = .235; root.add(ring2);
      const prongs = [];
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * TAU + .4, pts = [], N = 10;
        for (let i = 0; i <= N; i++) { const t = i / N, phi = .55 + t * 1.15, r = rad(phi) + .06 + Math.sin(t * Math.PI) * .045; pts.push([Math.cos(a) * (t < .02 ? .56 : r), yy(phi) * 1 - .0, Math.sin(a) * (t < .02 ? .56 : r)]); }
        pts[0] = [Math.cos(a) * .58, .13, Math.sin(a) * .58];
        const tube = new THREE.Mesh(L.tube(pts, .028, 36, 8), brass); root.add(tube);
        const leaf = L.extrude([[0, 0], [.07, .07], [.075, .2], [0, .32], [-.075, .2], [-.07, .07]], .03, .008, { bevelSeg: 1 });
        const lm = new THREE.Mesh(leaf, brass); const e = pts[N], e2 = pts[N - 1];
        lm.position.set(e[0], e[1] - .04, e[2]); lm.lookAt(e[0] * 3, e[1] + 1.2, e[2] * 3); lm.rotateX(Math.PI / 2 * 0); lm.rotation.set(0, -a + Math.PI / 2, -.35); lm.rotateY(0);
        lm.position.set(e[0], e[1] - .02, e[2]); lm.rotation.set(0, Math.PI / 2 - a, 0); lm.rotateZ(0); lm.rotateX(-.45); root.add(lm);
        prongs.push(tube);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 8), brass); knob.position.set(Math.cos(a) * .58, .15, Math.sin(a) * .58); root.add(knob);
      }
      // debris shards (hidden until open)
      const shards = []; const shardG = L.extrude([[0, 0], [.2, .04], [.14, .2], [.02, .16]], .018, .004, { bevelSeg: 1 }); ctx.disposables.push(shardG);
      for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(shardG, shellMat); m.visible = false; m.scale.setScalar(.7 + (i % 3) * .3); m.userData.noShadow = true; root.add(m); shards.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3() }); }

      // light leaking through the cracks: three points on the shell that brighten as the fractures widen
      const leaks = [[.35, 1.25], [.62, 1.62], [.86, 1.05]].map(([u, phi]) => { const a = u * TAU, r = rad(phi) + .012, s = L.sprite(th[1], .34, 0); s.position.set(Math.cos(a) * r, yy(phi), Math.sin(a) * r); s.userData.th = u; root.add(s); return s; });
      const inst = { root, frame: { r: .8, h: 1.74 }, float: 0, prog: 0, opened: false, openT: -1, wob: 0, wobT: 99, pulseT: 99, kickAt: 1.4 };
      inst.setProgress = p => { inst.prog = p; shellMat.userData.tr.u1.value.w = Math.min(1.4, p * 1.5); };
      inst.pulse = () => { inst.wobT = 0; inst.wob = .05 + inst.prog * .06; };
      inst.open = () => {
        if (inst.opened) return; inst.opened = true; inst.openT = 0; shellMat.userData.tr.u1.value.w = 1.6;
        shards.forEach((s, i) => { const a = i / shards.length * TAU + Math.random() * .6; s.m.visible = true; s.m.position.set(Math.cos(a) * .3, EY + .1 + Math.random() * .3, Math.sin(a) * .3); s.v.set(Math.cos(a) * (1.4 + Math.random() * 1.2), 1.8 + Math.random() * 1.6, Math.sin(a) * (1.4 + Math.random() * 1.2)); s.w.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4); });
      };
      inst.update = (dt, t, st) => {
        const p = inst.prog; inst.wobT += dt;
        if (!inst.opened && !ctx.reduced && t > inst.kickAt) { inst.kickAt = t + 1.6 + ((t * 7.3) % 1.7); if (inst.wobT > .6) { inst.wobT = 0; inst.wob = .018 + p * .03; } } // something inside shifts
        leaks.forEach((s, i) => { s.material.opacity = inst.opened ? Math.max(0, .9 - inst.openT * 1.5) : smooth(.15 + i * .25, .45 + i * .25, p) * (.55 + .25 * Math.sin(t * (3 + i) + i)); });
        const w = inst.wob * Math.exp(-4 * inst.wobT) * Math.sin(inst.wobT * 34), idleRock = ctx.reduced ? 0 : Math.sin(t * (1.1 + p * 5)) * (.012 + p * .05);
        eggG.rotation.z = (w + idleRock) * (inst.opened ? 0 : 1); eggG.rotation.x = Math.cos(t * 1.3) * (.006 + p * .02) * (inst.opened ? 0 : 1);
        const beat = .5 + .5 * Math.sin(t * (2.2 + p * 7)), potential = ctx.potentialTier;
        coreMat.opacity = (.18 + p * .75 + beat * .12 * (.4 + p)) * (inst.opened ? 0 : 1) + (inst.opened ? Math.max(0, 1 - inst.openT * 1.1) * 1.2 : 0);
        corePt.intensity = (.5 + p * 14 + beat * 2 * p + (inst.opened ? Math.max(0, 1 - inst.openT) * 40 : 0)); halo.material.opacity = (p * .55 + (inst.opened ? Math.max(0, 1 - inst.openT) : 0)) * .9;
        innerMat.emissiveIntensity = .35 + p * 1.6 + beat * .2;
        if (inst.opened) {
          inst.openT += dt; const k = Math.min(inst.openT, 1.2);
          cap.position.y = 1.35 * (1 - Math.exp(-k * 3.2)); cap.rotation.z = .55 * (1 - Math.exp(-k * 3)); cap.rotation.x = -.25 * (1 - Math.exp(-k * 3)); cap.position.x = .35 * (1 - Math.exp(-k * 3));
          bottom.rotation.z = -.04 * Math.exp(-k * 2) * Math.sin(k * 14);
          shards.forEach(s => { s.v.y -= 6.5 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt; if (s.m.position.y < .12) { s.m.position.y = .12; s.v.multiplyScalar(0); s.w.multiplyScalar(0); } });
        }
      };
      inst.react = k => { if (k === 'click') inst.pulse(); };
      return inst;
    },
  });
})();
