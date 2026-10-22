/* AETHERVAULT — 3D containers (3/3): Wanderer Pack and Oddity Capsule. Ritual API (same as egg/crate/vault): setProgress(p) · pulse() · open() · opened.
 *   Pack    — a foil card pack: pillow body with crimped, zig-zag-torn top; printed front/back; the tear strip hinges off the right end as
 *             progress rises (left side lifts first), light and card edges leak from the gap; open() peels it away and fans out three cards.
 *   Capsule — a gachapon capsule: tinted glass top over a glossy base, seam ring, seven tiny oddities bouncing inside a spherical
 *             shell; progress twists the top and rattles the contents; open() pops the top and releases them. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, clamp = U.clamp;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rgba = (hex, a) => { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };

  function packTex(th, front) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 768; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 512, 768);
    g.addColorStop(0, th[0]); g.addColorStop(.55, th[1]); g.addColorStop(1, rgba(th[0], 1)); x.fillStyle = g; x.fillRect(0, 0, 512, 768);
    x.globalAlpha = .12; x.fillStyle = '#fff'; for (let i = -6; i < 14; i++) { x.beginPath(); x.moveTo(i * 70, 768); x.lineTo(i * 70 + 26, 768); x.lineTo(i * 70 + 26 + 420, 0); x.lineTo(i * 70 + 420, 0); x.fill(); } x.globalAlpha = 1;
    const r = U.mulberry32(front ? 5 : 9); x.fillStyle = '#fff'; for (let i = 0; i < 46; i++) { const px = r() * 512, py = 70 + r() * 640, s = 1.5 + r() * 4; x.globalAlpha = .25 + r() * .6; x.fillRect(px - s, py - .5, s * 2, 1); x.fillRect(px - .5, py - s, 1, s * 2); } x.globalAlpha = 1;
    x.strokeStyle = '#e6c982'; x.lineWidth = 6; x.strokeRect(26, 70, 460, 640); x.lineWidth = 2; x.strokeRect(40, 84, 432, 612);
    x.fillStyle = 'rgba(8,6,4,.18)'; x.fillRect(46, 90, 420, 600);
    if (front) {
      x.save(); x.translate(256, 330); x.scale(3.6, 3.6); x.strokeStyle = '#f2d78c'; x.lineWidth = 2.2; x.fillStyle = 'rgba(242,215,140,.15)'; x.beginPath(); x.moveTo(0, -24); x.lineTo(8, -6); x.lineTo(24, 0); x.lineTo(8, 6); x.lineTo(0, 24); x.lineTo(-8, 6); x.lineTo(-24, 0); x.lineTo(-8, -6); x.closePath(); x.fill(); x.stroke(); x.restore();
      x.fillStyle = '#fff6dc'; x.textAlign = 'center'; x.font = '600 92px "Barlow Condensed", Impact, sans-serif'; x.letterSpacing = '10px'; x.fillText('WANDERER', 256, 560); x.font = '600 40px "Barlow Condensed", sans-serif'; x.letterSpacing = '22px'; x.fillText('PACK', 266, 614);
      x.font = '500 22px "IBM Plex Mono", monospace'; x.letterSpacing = '3px'; x.fillStyle = '#f0e2b8'; x.fillText('5 ARCHIVE CARDS', 256, 660); x.fillText('AETHERVAULT', 256, 124);
    } else {
      x.fillStyle = '#fff6dc'; x.textAlign = 'center'; x.font = '600 40px "Barlow Condensed", sans-serif'; x.letterSpacing = '8px'; x.fillText('WANDERER PACK', 256, 180); x.font = '400 20px "IBM Plex Mono", monospace'; x.letterSpacing = '1px';
      ['Five printed Archive cards:', 'creatures, places, relics,', 'records and phenomena.', 'Cards only. Contents vary.', 'Simulation only. No real value.'].forEach((s, i) => x.fillText(s, 256, 250 + i * 34));
      x.fillStyle = '#10100e'; for (let i = 0; i < 46; i++) x.fillRect(140 + i * 5.6 + (i % 3), 560, 2 + (i % 4), 80);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  // =================================================================== WANDERER PACK
  S.registerModel('container:pack', {
    rest: { yaw: -.35, pitch: 0 },
    build(ctx) {
      const th = ctx.theme && ctx.theme.length ? ctx.theme : ['#4aa8ff', '#7a5cff'], F = ctx.F, root = new THREE.Group(); F.crackColor = th[1];
      const W = 1.2, H = 1.84, D = .1, SPLIT = H / 2 - .26, pk = new THREE.Group(); root.add(pk); pk.position.y = 1.15; pk.rotation.x = -.06;
      const tri = x => Math.abs(((x * 30) % 2 + 2) % 2 - 1) - .5, jag = x => tri(x) * .028;
      /** one skin of the pack (front: sign +1, back: -1) between two heights; the split edge is torn zig-zag. */
      const panel = (sign, y0, y1, jagLo, jagHi) => { const g = L.paramSurface(110, 36, (u, v, p) => {
        const x = (u - .5) * W, ax = Math.abs(x) / (W / 2); let y = y0 + (y1 - y0) * v; if (jagLo && v < .5) y += jag(x) * (1 - v * 2); if (jagHi && v > .5) y += jag(x) * (v * 2 - 1);
        const fy = Math.abs(y) / (H / 2), body = Math.pow(1 - Math.pow(ax, 7), 1) * (1 - Math.pow(Math.max(0, fy - .84) / .16, 2) * .7) * (D / 2), crimp = (fy > .86 ? Math.sin(x * 78) * .011 * smooth(.86, .93, fy) : 0);
        p.set(x, y, sign * (Math.max(.006, body) + crimp)); }, false);
        const pos = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pos.count; i++) { uv.setXY(i, sign > 0 ? pos.getX(i) / W + .5 : .5 - pos.getX(i) / W, pos.getY(i) / H + .5); } return g; };
      const fT = packTex(th, true), bT = packTex(th, false); ctx.tex.push(fT, bT);
      const mk = t => { const m = ctx.q.physical ? new THREE.MeshPhysicalMaterial({ map: t, metalness: .82, roughness: .24, envMapIntensity: 1.7, clearcoat: .5, clearcoatRoughness: .2, iridescence: .6, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 600], side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ map: t, metalness: .8, roughness: .26, envMapIntensity: 1.6, side: THREE.DoubleSide }); ctx.disposables.push(m); return m; };
      const mF = mk(fT), mB = mk(bT), body = new THREE.Group(); pk.add(body);
      body.add(new THREE.Mesh(panel(1, -H / 2, SPLIT, false, true), mF), new THREE.Mesh(panel(-1, -H / 2, SPLIT, false, true), mB));
      // tear strip: pivots on the right end so the LEFT side lifts first as progress rises
      const hinge = new THREE.Group(); hinge.position.set(W / 2, SPLIT, 0); pk.add(hinge); const strip = new THREE.Group(); hinge.add(strip);
      [new THREE.Mesh(panel(1, SPLIT, H / 2, true, false), mF), new THREE.Mesh(panel(-1, SPLIT, H / 2, true, false), mB)].forEach(m => { m.position.set(-W / 2, -SPLIT, 0); strip.add(m); }); // meshes are authored in pack space; offsetting by the hinge makes them land in place
      // glow leaking from the gap + three cards that rise out of it
      const glowG = new THREE.Mesh(new THREE.PlaneGeometry(W * .96, .18), K.basic(ctx, th[1], 0, true, { map: L.shaftTex(), side: THREE.DoubleSide, depthWrite: false })); glowG.position.set(0, SPLIT + .02, 0); glowG.userData.noSil = true; pk.add(glowG);
      const cardTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 360; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 256, 360); g.addColorStop(0, '#2a2438'); g.addColorStop(1, '#14101c'); x.fillStyle = g; x.fillRect(0, 0, 256, 360); x.strokeStyle = '#d7b46e'; x.lineWidth = 6; x.strokeRect(10, 10, 236, 340); x.lineWidth = 2; x.strokeRect(20, 20, 216, 320); x.translate(128, 180); x.scale(2.2, 2.2); x.fillStyle = 'rgba(215,180,110,.2)'; x.beginPath(); x.moveTo(0, -24); x.lineTo(8, -6); x.lineTo(24, 0); x.lineTo(8, 6); x.lineTo(0, 24); x.lineTo(-8, 6); x.lineTo(-24, 0); x.lineTo(-8, -6); x.closePath(); x.fill(); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; ctx.tex.push(t); return t; })();
      const cardM = new THREE.MeshStandardMaterial({ map: cardTex, roughness: .4, metalness: .3, envMapIntensity: 1 }); ctx.disposables.push(cardM);
      const cards = [0, 1, 2, 3, 4].map(i => { const c = new THREE.Mesh(ctx.geo('pk-card', () => L.roundedBox(.5, .7, .012, .02, 2)), cardM); c.position.set((i - 2) * .015, -.02, (i - 2) * .015); c.visible = false; c.userData.noShadow = true; pk.add(c); return c; });
      const light = new THREE.PointLight(new THREE.Color(th[1]), 0, 4.5, 1.6); light.position.set(0, SPLIT, .5); pk.add(light);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.2), K.basic(ctx, th[1], 0, true, { map: L.shaftTex(), side: THREE.DoubleSide })); beam.position.set(0, SPLIT + 1.5, 0); beam.userData.noSil = true; pk.add(beam);
      const sparks = []; for (let i = 0; i < 16; i++) { const s = L.sprite(th[1], .09, 0); s.userData.v = new THREE.Vector3(); s.userData.life = 0; pk.add(s); sparks.push(s); }
      // display stand: weighted disc + two clips (keeps the pack standing on the plinth)
      const standM = F.trim('#b48d4c', { rough: .32, plain: true }); const disc = new THREE.Mesh(ctx.geo('pk-disc', () => L.lathe([[0, 0], [.46, 0], [.5, .03], [.44, .08], [0, .08]], 36)), standM); disc.position.y = .06; root.add(disc);
      [-1, 1].forEach(sd => root.add(new THREE.Mesh(K.taper([[sd * .46, .1, .0], [sd * .58, .2, .0], [sd * .62, .46, .0], [sd * .5, .62, .03]], .026, .018, { radial: 6, seg: 14 }), standM)));
      const inst = { root, frame: { r: .95, h: 2.35 }, float: .02, prog: 0, opened: false, openT: 0, kick: 0 };
      inst.setProgress = p => { inst.prog = p; }; inst.pulse = () => { inst.kick = 1; };
      inst.open = () => { if (inst.opened) return; inst.opened = true; inst.openT = 0; cards.forEach(c => (c.visible = true)); sparks.forEach(s => { s.userData.v.set((Math.random() - .5) * 2.2, 1.6 + Math.random() * 2.4, (Math.random() - .5) * 1.2); s.userData.life = 1.2 + Math.random() * .8; s.position.set((Math.random() - .5) * 1.0, SPLIT, 0); }); };
      inst.update = (dt, t) => {
        const p = inst.prog; inst.kick = Math.max(0, inst.kick - dt * 3);
        const shake = inst.opened ? 0 : p * .008; pk.position.x = ctx.reduced ? 0 : (Math.random() - .5) * shake + Math.sin(t * 40) * inst.kick * .01; pk.rotation.y = ctx.reduced ? 0 : Math.sin(t * .6) * .05;
        let ang = p * 1.15, lift = p * .06;
        if (inst.opened) { inst.openT += dt; const k = 1 - Math.exp(-inst.openT * 3.2); ang = 1.15 + k * 1.1; lift = .06 + k * .9; hinge.position.set(W / 2 + k * .55, SPLIT + lift, k * -.2); strip.visible = inst.openT < 1.1; hinge.rotation.z = -ang; hinge.rotation.x = k * .6; }
        else { hinge.position.set(W / 2, SPLIT + lift * .3, 0); hinge.rotation.z = -ang; hinge.rotation.x = 0; }
        glowG.material.opacity = clamp(p * .9 + (inst.opened ? .5 : 0), 0, 1) * (.75 + Math.sin(t * 7) * .1); light.intensity = p * 5 + (inst.opened ? Math.max(0, 1 - inst.openT * .5) * 22 : 0);
        cards.forEach((c, i) => { const peek = smooth(.55, 1, p) * .12; let y = -.02 + peek, rz = 0, x = (i - 2) * .015; if (inst.opened) { const k = smooth(.1, 1.1, inst.openT); y = SPLIT * .2 + k * (1.0 - Math.abs(i - 2) * .06) + Math.sin(t * 1.4 + i) * .03 * k; rz = (i - 2) * -.2 * k; x = (i - 2) * .27 * k; c.visible = true; } else c.visible = p > .5; c.position.set(x, y, (i - 2) * .015 + (inst.opened ? .05 * i : 0)); c.rotation.z = rz; });
        if (inst.opened) { beam.material.opacity = Math.min(1, inst.openT * 2) * (.5 + Math.sin(t * 3) * .1); sparks.forEach(s => { const u = s.userData; if (u.life > 0) { u.life -= dt; u.v.y -= 3.2 * dt; s.position.addScaledVector(u.v, dt); s.material.opacity = Math.min(1, u.life) * .9; } else s.material.opacity = 0; }); }
      };
      inst.react = k => { if (k === 'click') inst.pulse(); };
      return inst;
    },
  });

  // =================================================================== ODDITY CAPSULE
  S.registerModel('container:capsule', {
    rest: { yaw: -.4, pitch: 0 },
    build(ctx) {
      const th = ctx.theme && ctx.theme.length ? ctx.theme : ['#c9a2ff', '#4dffe0'], F = ctx.F, root = new THREE.Group(); F.crackColor = th[1];
      const R = .78, CY = 1.0, cap = new THREE.Group(); cap.position.y = CY; cap.rotation.z = .18; root.add(cap);
      const hemi = (up) => ctx.geo('cap-hemi' + (up ? 'u' : 'd'), () => new THREE.SphereGeometry(R, 48, 24, 0, TAU, up ? 0 : Math.PI / 2, Math.PI / 2));
      const baseCol = new THREE.Color(L.mix('#f4efe6', th[1], .4)), baseP = { color: baseCol, roughness: .18, metalness: 0, envMapIntensity: 1.4, transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide }; // translucent coloured plastic: the contents show through both halves
      const baseM = ctx.q.physical ? new THREE.MeshPhysicalMaterial(Object.assign({ clearcoat: 1, clearcoatRoughness: .06 }, baseP)) : new THREE.MeshStandardMaterial(baseP); ctx.disposables.push(baseM);
      const glassM = new THREE.MeshStandardMaterial({ color: new THREE.Color(L.mix('#ffffff', th[0], .22)), roughness: .04, metalness: 0, transparent: true, opacity: .26, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide }); ctx.disposables.push(glassM);
      const baseH = new THREE.Mesh(hemi(false), baseM); baseH.renderOrder = 3; baseH.userData.noCast = true; cap.add(baseH);
      const lid = new THREE.Group(); cap.add(lid); const top = new THREE.Mesh(hemi(true), glassM); top.renderOrder = 4; top.userData.noCast = true; lid.add(top);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(R - .03, 32, 16, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7, side: THREE.BackSide })); inner.visible = true; lid.add(inner); inner.visible = false; ctx.disposables.push(inner.material, inner.geometry);
      const seamM = F.trim('#f4efe6', { rough: .2, metal: .2, plain: true }); const seam = new THREE.Mesh(new THREE.TorusGeometry(R + .004, .03, 10, 64), seamM); seam.rotation.x = Math.PI / 2; cap.add(seam);
      const seamG = new THREE.Mesh(new THREE.TorusGeometry(R + .012, .012, 6, 64), F.make('glow', { color: th[1], glow: .1 })); seamG.rotation.x = Math.PI / 2; seamG.position.y = .001; cap.add(seamG);
      const tab = new THREE.Mesh(ctx.geo('cap-tab', () => L.roundedBox(.2, .06, .08, .02, 2)), seamM); tab.position.set(R + .02, 0, 0); cap.add(tab);
      // contents: seven little oddities bouncing inside a spherical shell
      const mats = [th[0], th[1], '#ffd36b', '#ff7ad1', '#7fe8ff', '#ffffff', '#b8ff8a'].map(c => { const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: .35, metalness: .2, emissive: new THREE.Color(c), emissiveIntensity: .25 }); ctx.disposables.push(m); return m; });
      const geos = [new THREE.OctahedronGeometry(.1, 0), new THREE.TorusGeometry(.085, .028, 8, 16), new THREE.BoxGeometry(.13, .13, .13), new THREE.IcosahedronGeometry(.1, 0), new THREE.SphereGeometry(.085, 14, 10), new THREE.ConeGeometry(.08, .17, 7), new THREE.TetrahedronGeometry(.12, 0)]; geos.forEach(g => ctx.disposables.push(g));
      const items = geos.map((g, i) => { const m = new THREE.Mesh(g, mats[i]); m.scale.setScalar(1.35); const a = i / 7 * TAU; m.position.set(Math.cos(a) * .3, -.1 + (i % 3) * .1, Math.sin(a) * .3); cap.add(m); return { m, v: new THREE.Vector3((Math.random() - .5) * 1.2, Math.random() * .8, (Math.random() - .5) * 1.2), w: new THREE.Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3), r: .14 }; });
      const core = L.sprite(th[1], 1.9, 0); core.position.y = 0; cap.add(core); const corePt = new THREE.PointLight(new THREE.Color(th[1]), 0, 3.5, 1.6); cap.add(corePt);
      // cradle: ring + three feet, like a gachapon rack
      const brass = F.trim('#b48d4c', { rough: .32, plain: true }); const ring = new THREE.Mesh(ctx.geo('cap-ring', () => L.lathe([[.42, 0], [.58, 0], [.62, .05], [.56, .1], [.44, .1]], 40)), brass); ring.position.y = .2; root.add(ring);
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .5; root.add(new THREE.Mesh(K.taper([[Math.cos(a) * .55, .22, Math.sin(a) * .55], [Math.cos(a) * .68, .1, Math.sin(a) * .68], [Math.cos(a) * .72, .02, Math.sin(a) * .72]], .04, .03, { radial: 6, seg: 8 }), brass)); }
      const sparks = []; for (let i = 0; i < 14; i++) { const s = L.sprite(th[1], .1, 0); s.userData.v = new THREE.Vector3(); s.userData.life = 0; root.add(s); sparks.push(s); }
      const inst = { root, frame: { r: 1.05, h: 2.0 }, float: .02, prog: 0, opened: false, openT: 0, kick: 0, twist: 0 };
      inst.setProgress = p => { inst.prog = p; }; inst.pulse = () => { inst.kick = 1; };
      inst.open = () => { if (inst.opened) return; inst.opened = true; inst.openT = 0; items.forEach(it => { it.v.set((Math.random() - .5) * 1.2, 1.4 + Math.random() * 1.2, (Math.random() - .5) * 1.2); }); sparks.forEach(s => { const a = Math.random() * TAU; s.userData.v.set(Math.cos(a) * 1.4, 1.6 + Math.random() * 2, Math.sin(a) * 1.4); s.userData.life = 1.1 + Math.random() * .8; s.position.set(0, CY + .2, 0); }); };
      inst.update = (dt, t) => {
        const p = inst.prog; inst.kick = Math.max(0, inst.kick - dt * 2.4); const energy = 1 + p * 3.5 + inst.kick * 5;
        inst.twist += (p * TAU * 1.0 - inst.twist) * (1 - Math.pow(.0008, dt)); lid.rotation.y = inst.opened ? lid.rotation.y : inst.twist;
        cap.rotation.z = .18 + (ctx.reduced || inst.opened ? 0 : Math.sin(t * 38) * .02 * inst.kick + Math.sin(t * 9) * .012 * p); cap.rotation.x = ctx.reduced ? 0 : Math.cos(t * 31) * .015 * inst.kick;
        items.forEach(it => { if (!ctx.reduced || inst.opened) { it.v.y -= (inst.opened ? 2.2 : 1.1) * dt; it.m.position.addScaledVector(it.v, dt * (inst.opened ? 1 : energy * .55)); it.m.rotation.x += it.w.x * dt * energy; it.m.rotation.y += it.w.y * dt * energy; if (!inst.opened) { const d = it.m.position.length(), lim = R - .05 - it.r; if (d > lim) { const n = it.m.position.clone().normalize(); it.m.position.copy(n.multiplyScalar(lim)); it.v.reflect(n).multiplyScalar(.92); if (it.m.position.y < -.05) it.v.y = Math.max(it.v.y, 1.2 * (.4 + energy * .2)); } if (it.m.position.y < -R + .15) { it.m.position.y = -R + .15; it.v.y = Math.abs(it.v.y) * .85 + .5 * energy * .3; } } else { it.m.scale.multiplyScalar(1 - dt * .6); } } });
        seamG.material.emissiveIntensity = .1 + p * 2.2; core.material.opacity = clamp(p * .5 + inst.kick * .2, 0, 1) * .8 + (inst.opened ? Math.max(0, 1 - inst.openT) * .9 : 0); corePt.intensity = p * 5 + (inst.opened ? Math.max(0, 1 - inst.openT * .8) * 26 : 0);
        if (inst.opened) { inst.openT += dt; const k = 1 - Math.exp(-inst.openT * 3.4); lid.position.y = k * 1.5; lid.position.x = k * .55; lid.rotation.z = -k * .9; lid.rotation.y += dt * 4 * (1 - k); glassM.opacity = .26 * (1 - clamp(inst.openT - .6, 0, 1)); sparks.forEach(s => { const u = s.userData; if (u.life > 0) { u.life -= dt; u.v.y -= 3 * dt; s.position.addScaledVector(u.v, dt); s.material.opacity = Math.min(1, u.life) * .9; } else s.material.opacity = 0; }); }
      };
      inst.react = k => { if (k === 'click') inst.pulse(); };
      return inst;
    },
  });
})();
