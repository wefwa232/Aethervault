/* AETHERVAULT — 3D containers (2/2): Forge Crate and Mythic Vault. Ritual API: setProgress(p) · pulse() · open() · opened */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util;
  const TAU = Math.PI * 2;

  const stripeTex = c0 => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#16130f'; x.fillRect(0, 0, 256, 64); x.fillStyle = c0; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 36, 64); x.lineTo(i * 36 + 20, 64); x.lineTo(i * 36 + 52, 0); x.lineTo(i * 36 + 32, 0); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; };

  // ===================================================================== CRATE
  S.registerModel('container:crate', {
    rest: { yaw: -.5, pitch: 0 },
    build(ctx) {
      const th = ctx.theme && ctx.theme.length ? ctx.theme : ['#ff8a3d', '#ffd36b'], F = ctx.F, root = new THREE.Group(); F.crackColor = th[1];
      const steel = F.body('#4a4f58', { rough: .5, metal: .85, clearcoat: 0 }), dkSteel = F.body('#2b2e34', { rough: .55, metal: .8, clearcoat: 0 }), brass = F.trim('#b48d4c', { rough: .32, plain: true }), hot = F.make('glow', { color: th[0], glow: 0 });
      const W = 1.7, H = .95, Dp = 1.12, y0 = .16;
      const body = new THREE.Mesh(ctx.geo('crate-body', () => L.chamferBox(W, H, Dp, .05)), steel); body.position.y = y0 + H / 2; root.add(body);
      const frameGeo = ctx.geo('crate-frame', () => L.extrude([[-.7, -.34], [.7, -.34], [.7, .34], [-.7, .34]], .03, .01, { holes: [[[-.62, -.26], [-.62, .26], [.62, .26], [.62, -.26]]], bevelSeg: 1 }));
      [1, -1].forEach(sd => { const f = new THREE.Mesh(frameGeo, dkSteel); f.position.set(0, y0 + H / 2, sd * (Dp / 2 + .005)); f.rotation.y = sd > 0 ? 0 : Math.PI; root.add(f); });
      const brk = ctx.geo('crate-bracket', () => L.extrude([[0, 0], [.26, 0], [.26, .06], [.06, .06], [.06, .26], [0, .26]], .04, .008, { bevelSeg: 1 }));
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => [0, 1].forEach(top => { const b = new THREE.Mesh(brk, brass); b.position.set(sx * (W / 2 - .01), y0 + (top ? H - .01 : .01), sz * (Dp / 2 + .005)); b.scale.set(-sx, top ? -1 : 1, 1); root.add(b); }));
      [-1, 1].forEach(sd => root.add(new THREE.Mesh(L.tube([[sd * (W / 2), y0 + .55, -.25], [sd * (W / 2 + .12), y0 + .55, -.2], [sd * (W / 2 + .12), y0 + .55, .2], [sd * (W / 2), y0 + .55, .25]], .028, 24, 8), brass)));
      const rg = new THREE.SphereGeometry(.018, 8, 6); ctx.disposables.push(rg); const riv = new THREE.InstancedMesh(rg, brass, 60); const mm = new THREE.Matrix4(); let n = 0;
      for (let i = 0; i < 12; i++) for (const [sy, z] of [[.1, 1], [.84, 1], [.1, -1], [.84, -1]]) { if (n >= 60) break; mm.makeTranslation(-.72 + i * .131, y0 + sy, z * (Dp / 2 + .03)); riv.setMatrixAt(n++, mm); } riv.count = n; root.add(riv);
      const hz = stripeTex('#' + new THREE.Color(th[0]).getHexString()); ctx.tex.push(hz); hz.repeat.set(5, 1); const hzm = new THREE.MeshStandardMaterial({ map: hz, roughness: .6, metalness: .2 }); ctx.disposables.push(hzm);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .09), hzm); strip.position.set(0, y0 + .15, Dp / 2 + .022); root.add(strip);
      const st = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); x.fillStyle = th[0]; x.font = '700 92px "Barlow Condensed", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '14px'; x.fillText('FORGE', 256, 70); x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 200; i++) { x.fillStyle = 'rgba(0,0,0,' + Math.random() * .6 + ')'; x.fillRect(Math.random() * 512, Math.random() * 128, 2 + Math.random() * 6, 1 + Math.random() * 2); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(); ctx.tex.push(st);
      const stm = new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false }); ctx.disposables.push(stm); const stencil = new THREE.Mesh(new THREE.PlaneGeometry(.98, .245), stm); stencil.position.set(0, y0 + .74, Dp / 2 + .024); stencil.userData.noSil = true; root.add(stencil);
      for (let i = 0; i < 5; i++) [-1, 1].forEach(sd => { const v = new THREE.Mesh(new THREE.BoxGeometry(.02, .05, .38), dkSteel); v.position.set(sd * (W / 2 + .004), y0 + .3 + i * .1, 0); root.add(v); });
      [[-.68, -.4], [.68, -.4], [-.68, .4], [.68, .4]].forEach(([x, z]) => { const f = new THREE.Mesh(ctx.geo('crate-foot', () => L.chamferBox(.2, .16, .2, .03)), dkSteel); f.position.set(x, .08, z); root.add(f); });
      // lock plate: gauge + lamp row
      const lockG = new THREE.Group(); lockG.position.set(0, y0 + H * .5 - .06, Dp / 2 + .03); root.add(lockG);
      const plate = new THREE.Mesh(L.lathe([[0, 0], [.26, 0], [.28, .02], [.26, .05], [0, .06]], 36), brass); plate.rotation.x = Math.PI / 2; lockG.add(plate);
      const dial = new THREE.Mesh(new THREE.CircleGeometry(.2, 32), new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: .4, metalness: .2 })); dial.position.z = .062; lockG.add(dial); ctx.disposables.push(dial.material);
      for (let i = 0; i <= 10; i++) { const a = -2.4 + i * .48, t = new THREE.Mesh(new THREE.BoxGeometry(.008, i % 5 === 0 ? .05 : .03, .004), new THREE.MeshBasicMaterial({ color: 0xd9c9a0 })); t.position.set(Math.sin(a) * .15, -Math.cos(a) * .15, .066); t.rotation.z = -a; lockG.add(t); ctx.disposables.push(t.material, t.geometry); }
      const needle = new THREE.Mesh(new THREE.BoxGeometry(.012, .17, .006), new THREE.MeshBasicMaterial({ color: new THREE.Color(th[0]) })); needle.geometry.translate(0, .08, 0); needle.position.z = .07; lockG.add(needle); ctx.disposables.push(needle.material);
      const lamps = []; for (let i = 0; i < 6; i++) { const m = F.make('glow', { color: th[0], glow: .05 }); const l = new THREE.Mesh(new THREE.SphereGeometry(.026, 10, 8), m); l.position.set((i - 2.5) * .1, -.38, .02); lockG.add(l); lamps.push(m); ctx.disposables.push(l.geometry); }
      // lid
      const lidPivot = new THREE.Group(); lidPivot.position.set(0, y0 + H, -Dp / 2); root.add(lidPivot);
      const lid = new THREE.Mesh(ctx.geo('crate-lid', () => L.chamferBox(W + .06, .2, Dp + .06, .05)), steel); lid.position.set(0, .1, Dp / 2); lidPivot.add(lid);
      const lidPlate = new THREE.Mesh(ctx.geo('crate-lidplate', () => L.chamferBox(1.2, .03, .62, .01)), dkSteel); lidPlate.position.set(0, .215, Dp / 2); lidPlate.userData.noCast = true; lidPivot.add(lidPlate);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(W + .02, .02, Dp + .02), hot); seam.position.set(0, y0 + H + .005, 0); seam.userData.noSil = true; root.add(seam);
      [-.6, .6].forEach(x => { const h = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .3, 14), brass); h.rotation.z = Math.PI / 2; h.position.set(x, y0 + H + .02, -Dp / 2 - .02); root.add(h); });
      const latchG = ctx.geo('crate-latch', () => L.extrude([[-.07, 0], [.07, 0], [.07, -.3], [0, -.36], [-.07, -.3]], .05, .01, { bevelSeg: 1 }));
      const latches = [-.5, .5].map(x => { const pv = new THREE.Group(); pv.position.set(x, y0 + H + .1, Dp / 2 + .06); pv.add(new THREE.Mesh(latchG, brass)); root.add(pv); return pv; });
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(W - .2, Dp - .2), new THREE.MeshBasicMaterial({ color: new THREE.Color(th[1]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); inner.rotation.x = -Math.PI / 2; inner.position.y = y0 + H - .02; inner.userData.noSil = true; root.add(inner); ctx.disposables.push(inner.material);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3), new THREE.MeshBasicMaterial({ map: L.shaftTex(), color: new THREE.Color(th[1]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = y0 + H + 1.4; beam.userData.noSil = true; root.add(beam); ctx.disposables.push(beam.material);
      const heat = new THREE.PointLight(new THREE.Color(th[0]), 0, 4, 1.6); heat.position.set(0, y0 + H + .3, 0); root.add(heat);
      const sparks = []; for (let i = 0; i < 18; i++) { const s = L.sprite(th[1], .1, 0); s.position.set(0, y0 + H, 0); s.userData.v = new THREE.Vector3(); s.userData.life = 0; root.add(s); sparks.push(s); }
      const inst = { root, frame: { r: 1.1, h: 1.5 }, float: 0, prog: 0, opened: false, openT: 0 };
      inst.setProgress = p => { inst.prog = p; };
      inst.pulse = () => { };
      inst.open = () => { if (inst.opened) return; inst.opened = true; inst.openT = 0; sparks.forEach(s => { s.userData.v.set((Math.random() - .5) * 1.6, 2 + Math.random() * 2.6, (Math.random() - .5) * 1.0); s.userData.life = 1.3 + Math.random() * .8; s.position.set((Math.random() - .5) * 1.2, y0 + H, (Math.random() - .5) * .7); }); };
      inst.update = (dt, t) => {
        const p = inst.prog, shake = inst.opened ? 0 : (p > .02 ? p * .012 : 0);
        root.position.x = ctx.reduced ? 0 : (Math.random() - .5) * shake; root.position.z = ctx.reduced ? 0 : (Math.random() - .5) * shake;
        const nLit = Math.floor(p * 6.01); lamps.forEach((m, i) => (m.emissiveIntensity = i < nLit ? 2.2 : .05)); needle.rotation.z = 2.4 - p * 4.8 + Math.sin(t * 20) * (p > .01 ? .02 : 0);
        hot.emissiveIntensity = (p * 2.6 + (inst.opened ? 3 : 0)) * (.85 + Math.sin(t * 9) * .15); heat.intensity = p * 8 + (inst.opened ? Math.max(0, 1 - inst.openT * .5) * 20 : 0);
        latches.forEach(l => (l.rotation.x = U.clamp((p - .75) * 6, 0, 1) * -.9 + (inst.opened ? -.4 : 0)));
        if (inst.opened) {
          inst.openT += dt; const k = 1 - Math.exp(-inst.openT * 4.2); lidPivot.rotation.x = -k * 1.85 - Math.sin(inst.openT * 14) * .03 * Math.exp(-inst.openT * 3);
          inner.material.opacity = Math.min(1, inst.openT * 3) * .8; beam.material.opacity = Math.min(1, inst.openT * 2) * (.55 + Math.sin(t * 3) * .1);
          sparks.forEach(s => { const u = s.userData; if (u.life > 0) { u.life -= dt; u.v.y -= 3.5 * dt; s.position.addScaledVector(u.v, dt); s.material.opacity = Math.min(1, u.life) * .9; } else s.material.opacity = 0; });
        } else lidPivot.rotation.x = -Math.min(.06, p * .08) * Math.abs(Math.sin(t * 25));
      };
      inst.react = () => { };
      return inst;
    },
  });

  // ===================================================================== VAULT
  S.registerModel('container:vault', {
    rest: { yaw: -.4, pitch: 0 },
    build(ctx) {
      const th = ctx.theme && ctx.theme.length ? ctx.theme : ['#ff4fa8', '#ffc247'], F = ctx.F, root = new THREE.Group(); F.crackColor = th[1];
      const steel = F.body('#565c68', { rough: .38, metal: .9, clearcoat: 0 }), dk = F.body('#23262d', { rough: .5, metal: .85, clearcoat: 0 }), brass = F.trim('#b48d4c', { rough: .3, plain: true });
      const S0 = 2.3, T = .62, y0 = .22, CY = y0 + S0 / 2;
      const ringG = ctx.geo('vault-ring', () => { const o = [[-S0 / 2, -S0 / 2], [S0 / 2, -S0 / 2], [S0 / 2, S0 / 2], [-S0 / 2, S0 / 2]], i = []; for (let k = 0; k < 40; k++) { const a = -k / 40 * TAU; i.push([Math.cos(a), Math.sin(a)]); } return L.extrude(o, T, .08, { holes: [i], bevelSeg: 2, curveSeg: 6 }); });
      const ring = new THREE.Mesh(ringG, steel); ring.position.set(0, CY, 0); root.add(ring);
      const back = new THREE.Mesh(ctx.geo('vault-back', () => L.chamferBox(S0 - .05, S0 - .05, .1, .03)), dk); back.position.set(0, CY, -T / 2 + .06); root.add(back);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(1.03, .045, 10, 72), brass); bezel.position.set(0, CY, T / 2 + .005); root.add(bezel);
      const rg = new THREE.SphereGeometry(.03, 8, 6); ctx.disposables.push(rg);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const pl = new THREE.Mesh(ctx.geo('vault-plate', () => L.chamferBox(.5, .5, .04, .02)), dk); pl.position.set(sx * (S0 / 2 - .3), CY + sy * (S0 / 2 - .3), T / 2 + .02); root.add(pl); [[-.14, -.14], [.14, -.14], [-.14, .14], [.14, .14]].forEach(([dx, dy]) => { const r = new THREE.Mesh(rg, brass); r.position.set(pl.position.x + dx, pl.position.y + dy, T / 2 + .06); root.add(r); }); });
      const innerM = new THREE.Mesh(new THREE.CircleGeometry(.98, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(th[1]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); innerM.position.set(0, CY, -.12); innerM.userData.noSil = true; root.add(innerM); ctx.disposables.push(innerM.material);
      const rays = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshBasicMaterial({ map: L.glowTex(), color: new THREE.Color(th[1]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); rays.position.set(0, CY, .3); rays.userData.noSil = true; root.add(rays); ctx.disposables.push(rays.material);
      const vLight = new THREE.PointLight(new THREE.Color(th[1]), 0, 6, 1.5); vLight.position.set(0, CY, .4); root.add(vLight);
      const pivot = new THREE.Group(); pivot.position.set(-1.12, CY, T / 2 - .02); root.add(pivot); const door = new THREE.Group(); door.position.x = 1.12; pivot.add(door);
      const disc = new THREE.Mesh(L.lathe([[0, 0], [.95, 0], [1.0, .03], [1.0, .16], [.94, .2], [.82, .2], [.78, .26], [.62, .26], [.6, .31], [0, .31]], 72), steel); disc.rotation.x = Math.PI / 2; door.add(disc);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.9, .025, 8, 72), brass); rim.position.z = .21; door.add(rim);
      const rib = ctx.geo('vault-rib', () => L.extrude([[.12, -.05], [.62, -.12], [.62, .12], [.12, .05]], .05, .01, { bevelSeg: 1 })); for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(rib, dk); r.rotation.z = i / 6 * TAU + .26; r.position.z = .28; door.add(r); }
      const bolts = []; const bg = ctx.geo('vault-bolt', () => { const l = L.lathe([[0, 0], [.05, 0], [.055, .1], [.07, .12], [.07, .16], [0, .17]], 6); l.rotateX(Math.PI / 2); return l; });
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, b = new THREE.Mesh(bg, brass); b.position.set(Math.cos(a) * .87, Math.sin(a) * .87, .18); door.add(b); bolts.push({ m: b, a }); }
      const dialR = new THREE.Mesh(L.lathe([[.42, 0], [.46, 0], [.48, .04], [.46, .08], [.42, .08]], 48), brass); dialR.rotation.x = Math.PI / 2; dialR.position.z = .31; door.add(dialR);
      const dialTick = new THREE.Group(); dialTick.position.z = .4; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, t = new THREE.Mesh(new THREE.BoxGeometry(.01, i % 5 ? .03 : .06, .008), new THREE.MeshBasicMaterial({ color: 0xe8d9ae })); t.position.set(Math.cos(a) * .44, Math.sin(a) * .44, 0); t.rotation.z = a - Math.PI / 2; dialTick.add(t); ctx.disposables.push(t.material, t.geometry); } door.add(dialTick);
      const hub = new THREE.Mesh(L.lathe([[0, 0], [.2, 0], [.22, .05], [.2, .1], [.12, .16], [0, .18]], 28), brass); hub.rotation.x = Math.PI / 2; hub.position.z = .31; door.add(hub);
      const wheel = new THREE.Group(); wheel.position.z = .5; door.add(wheel); const gm = F.trim(th[1], { rough: .25, plain: true });
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; wheel.add(new THREE.Mesh(L.tube([[0, 0, 0], [Math.cos(a) * .25, Math.sin(a) * .25, 0], [Math.cos(a) * .58, Math.sin(a) * .58, .01]], .035, 12, 8), gm)); const kn = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 10), gm); kn.position.set(Math.cos(a) * .6, Math.sin(a) * .6, .01); wheel.add(kn); ctx.disposables.push(kn.geometry); }
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(.43, .018, 8, 48), brass));
      const lamps = [0, 1, 2].map(i => { const m = F.make('glow', { color: th[0], glow: .05 }); const l = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 10), m); l.position.set((i - 1) * .2, .72, .3); door.add(l); ctx.disposables.push(l.geometry); const hb = new THREE.Mesh(new THREE.TorusGeometry(.06, .014, 6, 18), brass); hb.position.copy(l.position); door.add(hb); return m; });
      const plateTex = L.plateTexture([{ text: 'MYTHIC VAULT', font: '600 74px "Barlow Condensed", sans-serif', spacing: '8px', y: 128, color: '#e8c982' }], 1024, 256); ctx.tex.push(plateTex);
      const plm = new THREE.MeshStandardMaterial({ map: plateTex, metalness: .7, roughness: .45 }); ctx.disposables.push(plm); const pl = new THREE.Mesh(new THREE.PlaneGeometry(.62, .155), plm); pl.position.set(0, -.7, .31); door.add(pl);
      const hingeG = new THREE.CylinderGeometry(.075, .075, .3, 14); ctx.disposables.push(hingeG); [-.62, 0, .62].forEach(y => { const h = new THREE.Mesh(hingeG, brass); h.position.set(-1.12, CY + y, T / 2 + .06); root.add(h); });
      const inst = { root, frame: { r: 1.6, h: 2.7 }, float: 0, prog: 0, opened: false, openT: 0, turn: 0, kick: 0 };
      inst.setProgress = p => { inst.prog = p; };
      inst.pulse = () => { inst.kick = 1; };
      inst.open = () => { if (inst.opened) return; inst.opened = true; inst.openT = 0; };
      inst.update = (dt, t) => {
        const p = inst.prog; inst.kick = Math.max(0, inst.kick - dt * 3);
        inst.turn += (p * Math.PI * 4 - inst.turn) * (1 - Math.pow(.0008, dt)); wheel.rotation.z = inst.turn + inst.kick * .1; dialTick.rotation.z = -inst.turn * 1.6;
        lamps.forEach((m, i) => (m.emissiveIntensity = p >= (i + 1) / 3 - .01 ? 2.4 : .06));
        const retract = U.clamp((p - .55) / .4, 0, 1); bolts.forEach(b => { b.m.position.x = Math.cos(b.a) * (.87 - retract * .1); b.m.position.y = Math.sin(b.a) * (.87 - retract * .1); });
        const shake = inst.opened ? 0 : p * .006; root.position.x = ctx.reduced ? 0 : (Math.random() - .5) * shake; root.position.y = ctx.reduced ? 0 : (Math.random() - .5) * shake;
        if (inst.opened) { inst.openT += dt; const k = 1 - Math.pow(1 - Math.min(1, inst.openT / 1.5), 3); pivot.rotation.y = -k * 1.75; innerM.material.opacity = Math.min(1, inst.openT * 1.4) * .9; rays.material.opacity = Math.min(1, inst.openT * 1.2) * (.8 + Math.sin(t * 3) * .1); vLight.intensity = Math.min(1, inst.openT) * 30; }
      };
      inst.react = k => { if (k === 'click') inst.pulse(); };
      return inst;
    },
  });
})();
