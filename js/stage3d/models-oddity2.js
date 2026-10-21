/* AETHERVAULT — Phase Two oddities. None of these is "an ordinary object with more glow": each breaks a rule of how 3D objects behave.
 *   Impossible Cube   — a real tesseract: 16 hypercube vertices rotated in 4D every frame and perspective-projected into the glass
 *                       cube that "contains" it (32 live edge beams coloured by their 4th-dimension depth). It turns inside out.
 *   Missing Texture   — an asset the Archive forgot to finish: magenta/black checker on one half, default grey on the other, missing
 *                       faces, an exposed wireframe bounding box, a debug axis gizmo, z-fighting planes, stepped vertex jitter.
 *   Backwards Clock   — a mantel clock whose numerals run counter-clockwise, hands unwind, ripples collapse INWARD, dust rises
 *                       and the pendulum's gears turn the wrong way round. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, clamp = U.clamp;
  const Y = new THREE.Vector3(0, 1, 0);

  // =================================================================== IMPOSSIBLE CUBE (tesseract)
  S.registerModel('impossiblecube', {
    rest: { yaw: -.35, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), g = new THREE.Group(); root.add(g); g.position.y = 1.35;
      const brass = F.trim('#b48d4c', { rough: .3, plain: true }), steel = F.trim('#aab4c8', { rough: .25, plain: true });
      const c1 = F.body(pal[0], { plain: true }).color.clone(), c2 = F.body(pal[1], { plain: true }).color.clone();
      // glass cube + brass corner brackets + frame edges (the "container")
      const cubeM = F.make('glass', { color: '#dfeaff', opacity: .05 }), cube = new THREE.Mesh(ctx.geo('ic-cube', () => L.roundedBox(1.7, 1.7, 1.7, .05, 3)), cubeM); cube.renderOrder = 6; cube.userData.noCast = true; g.add(cube);
      const corner = ctx.geo('ic-corner', () => L.extrude([[0, 0], [.2, 0], [.2, .05], [.05, .05], [.05, .2], [0, .2]], .05, .01, { bevelSeg: 1 }));
      for (let i = 0; i < 8; i++) { const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1; const c = new THREE.Mesh(corner, brass); c.position.set(sx * .85, sy * .85, sz * .85); c.scale.set(-sx, -sy, 1); c.rotation.y = sz > 0 ? 0 : Math.PI; g.add(c); }
      // tesseract: 16 vertices, 32 edges as instanced beams, 16 nodes
      const V4 = []; for (let i = 0; i < 16; i++) V4.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1, (i & 8) ? 1 : -1]);
      const E = []; for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (j > i) E.push([i, j]); }
      const beamG = ctx.geo('ic-beam', () => { const b = new THREE.BoxGeometry(1, 1, 1); b.translate(0, .5, 0); return b; }), beamM = K.basic(ctx, '#ffffff'), beams = new THREE.InstancedMesh(beamG, beamM, E.length); beams.frustumCulled = false; beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(beams);
      const nodeG = ctx.geo('ic-node', () => new THREE.SphereGeometry(1, 10, 8)), nodes = new THREE.InstancedMesh(nodeG, K.basic(ctx, '#ffffff'), 16); nodes.frustumCulled = false; nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(nodes);
      const P = V4.map(() => new THREE.Vector3()), W = new Array(16).fill(0), m = new THREE.Matrix4(), q = new THREE.Quaternion(), tmp = new THREE.Color(), a = new THREE.Vector3(), b = new THREE.Vector3(), sv = new THREE.Vector3(), dv = new THREE.Vector3();
      const rot = (v, i, j, ang) => { const c = Math.cos(ang), s = Math.sin(ang), x = v[i], y = v[j]; v[i] = x * c - y * s; v[j] = x * s + y * c; };
      const glowS = L.sprite(pal[1], 3.4, .3); g.add(glowS);
      const light = new THREE.PointLight(c2, 5, 4.5, 1.6); g.add(light);
      // base: cradle ring on three brass legs
      const cradle = new THREE.Mesh(ctx.geo('ic-cradle', () => L.lathe([[.5, 0], [.62, 0], [.66, .04], [.6, .1], [.5, .12]], 40)), brass); cradle.position.y = .22; root.add(cradle);
      for (let i = 0; i < 3; i++) { const an = i / 3 * TAU + .3; root.add(new THREE.Mesh(K.taper([[Math.cos(an) * .62, .22, Math.sin(an) * .62], [Math.cos(an) * .75, .1, Math.sin(an) * .75], [Math.cos(an) * .8, .02, Math.sin(an) * .8]], .035, .03, { radial: 6, seg: 8 }), brass)); }
      const fx = K.stageFx(ctx, root, { r: 1.2, h: 2.7, color: pal[1], core: [0, 1.35, .3] });
      let spin = 0, pulse = 0;
      const upd = (t, calm) => {
        const A = calm ? .5 : t * .45 + spin, Bx = calm ? .3 : t * .31, C = calm ? .4 : t * .23;
        for (let i = 0; i < 16; i++) { const v = V4[i].slice(); rot(v, 0, 3, A); rot(v, 1, 2, Bx); rot(v, 2, 3, C); const k = .9 / (2.6 - v[3] * .75); P[i].set(v[0] * k, v[1] * k, v[2] * k); W[i] = v[3]; const ns = .045 + (v[3] + 1) * .016; m.compose(P[i], q.identity(), sv.set(ns, ns, ns)); nodes.setMatrixAt(i, m); tmp.copy(c1).lerp(c2, (v[3] + 1) / 2).multiplyScalar(1.6); nodes.setColorAt(i, tmp); }
        E.forEach(([i, j], n) => { a.copy(P[i]); b.copy(P[j]); const d = dv.subVectors(b, a), len = d.length(), w = .017 + (W[i] + W[j] + 2) * .0055; q.setFromUnitVectors(Y, d.normalize()); m.compose(a, q, sv.set(w, len, w)); beams.setMatrixAt(n, m); tmp.copy(c1).lerp(c2, (W[i] + W[j] + 2) / 4).multiplyScalar(1.4); beams.setColorAt(n, tmp); });
        beams.instanceMatrix.needsUpdate = nodes.instanceMatrix.needsUpdate = true; if (beams.instanceColor) beams.instanceColor.needsUpdate = nodes.instanceColor.needsUpdate = true;
      };
      upd(0, true);
      const inst = { root, frame: { r: 1.2, h: 2.65 }, float: .05, rest: { yaw: -.35, pitch: 0 } };
      inst.react = k => { if (k === 'click') pulse = 1; };
      inst.update = (dt, t, st) => { const calm = st.reduced; pulse = Math.max(0, pulse - dt * .8); spin += dt * pulse * 2.4; upd(t, calm); g.rotation.y = calm ? 0 : t * .12; g.rotation.x = calm ? 0 : Math.sin(t * .3) * .1; light.intensity = 4 + pulse * 6 + (calm ? 0 : Math.sin(t * 2) * 1); glowS.material.opacity = .22 + pulse * .25; fx.update(dt, t, calm); };
      return inst;
    },
  });

  // =================================================================== MISSING TEXTURE
  const MT_V = `uniform float uTime; uniform float uJ; varying vec3 vO; varying vec3 vN; float h(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
void main(){ vO = position; vN = normalize(normalMatrix * normal); vec3 p = position; float st = floor(uTime * 6.0); float on = step(0.8, h(st * 1.7)) * uJ; p += (vec3(h(st + position.x * 9.0), h(st + 3.0 + position.y * 9.0), h(st + 7.0 + position.z * 9.0)) - 0.5) * 0.12 * on * step(0.5, h(floor(position.y * 5.0) + st)); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
  const MT_F = `uniform float uTime; uniform float uCell; uniform float uMode; varying vec3 vO; varying vec3 vN;
void main(){ vec3 c = floor(vO * uCell + 0.001); float ch = mod(c.x + c.y + c.z, 2.0); vec3 col = mix(vec3(0.0), vec3(1.0, 0.0, 1.0), ch); if (uMode > 0.5) col = mix(vec3(0.05), vec3(1.0, 0.0, 1.0), ch);
  float fl = step(0.97, fract(sin(floor(uTime * 8.0) * 17.3) * 9.1)); col = mix(col, vec3(1.0), fl * 0.5 * step(0.5, fract(vO.y * 3.0))); gl_FragColor = vec4(col, 1.0); }`;

  S.registerModel('missingtexture', {
    rest: { yaw: -.4, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), g = new THREE.Group(); root.add(g); g.position.y = 1.2;
      const chk = new THREE.ShaderMaterial({ uniforms: { uTime: L.timeUniform, uCell: { value: 4 }, uMode: { value: 0 }, uJ: { value: 1 } }, vertexShader: MT_V, fragmentShader: MT_F, side: THREE.DoubleSide }); ctx.disposables.push(chk);
      const def = new THREE.MeshStandardMaterial({ color: 0xb4b4b4, roughness: .9, metalness: 0, flatShading: true }); ctx.disposables.push(def);
      // the "model": five of six faces exist; some are untextured defaults
      const S0 = 1.15, face = (rx, ry, mat, pos, hole) => { const gm = new THREE.PlaneGeometry(S0, S0, 4, 4), m = new THREE.Mesh(gm, mat); m.position.set(...pos); m.rotation.set(rx, ry, 0); g.add(m); return m; };
      face(0, 0, chk, [0, 0, S0 / 2]); face(0, Math.PI / 2, chk, [S0 / 2, 0, 0]); face(-Math.PI / 2, 0, chk, [0, S0 / 2, 0]);
      const fL = face(0, -Math.PI / 2, def, [-S0 / 2, 0, 0]), fB = face(Math.PI / 2, 0, def, [0, -S0 / 2, 0]);
      // z-fighting twins (two coplanar quads with different texel sizes) on the back
      const zA = new THREE.Mesh(new THREE.PlaneGeometry(S0, S0), chk), chk2 = chk.clone(); chk2.uniforms = { uTime: L.timeUniform, uCell: { value: 7 }, uMode: { value: 1 }, uJ: { value: 0 } }; ctx.disposables.push(chk2);
      const zB = new THREE.Mesh(new THREE.PlaneGeometry(S0, S0), chk2); zA.position.set(0, 0, -S0 / 2); zB.position.set(0, 0, -S0 / 2 + .0004); zA.rotation.y = zB.rotation.y = Math.PI; g.add(zA, zB);
      // exposed internals: wireframe bounding box (cyan), debug axes, orphan vertices
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(S0 * 1.18, S0 * 1.18, S0 * 1.18)), new THREE.LineBasicMaterial({ color: 0x00e8ff, transparent: true, opacity: .75 })); edges.userData.noSil = true; g.add(edges); ctx.disposables.push(edges.geometry, edges.material);
      const axes = new THREE.Group(); [['#ff3a3a', [1, 0, 0]], ['#3aff5a', [0, 1, 0]], ['#3a7aff', [0, 0, 1]]].forEach(([c, d]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .9, 6), K.basic(ctx, c)); m.position.set(d[0] * .45, d[1] * .45, d[2] * .45); m.rotation.set(d[2] * Math.PI / 2, 0, -d[0] * Math.PI / 2); axes.add(m); const tip = new THREE.Mesh(new THREE.ConeGeometry(.04, .12, 8), K.basic(ctx, c)); tip.position.set(d[0] * .94, d[1] * .94, d[2] * .94); tip.rotation.copy(m.rotation); axes.add(tip); ctx.disposables.push(m.geometry, tip.geometry); }); axes.userData.noSil = true; g.add(axes);
      // label sprite
      const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128; const lx = lc.getContext('2d'); lx.fillStyle = 'rgba(0,0,0,.65)'; lx.fillRect(0, 0, 512, 128); lx.fillStyle = '#ff00ff'; lx.font = '600 40px "IBM Plex Mono", monospace'; lx.textAlign = 'center'; lx.fillText('MISSING_TEXTURE', 256, 56); lx.fillStyle = '#00e8ff'; lx.font = '400 28px "IBM Plex Mono", monospace'; lx.fillText('error: asset not found (null)', 256, 100);
      const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace; ctx.tex.push(lt); const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthTest: false })); label.scale.set(1.4, .35, 1); label.position.set(0, 1.15, 0); label.renderOrder = 8; label.userData.noSil = true; g.add(label); ctx.disposables.push(label.material);
      // orbiting unfinished fragments: untextured triangles + one checkered sphere
      const frags = []; for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.TetrahedronGeometry(.14 + (i % 3) * .05), i % 2 ? def : chk); g.add(t); frags.push({ t, a: i / 6 * TAU, r: 1.1 + (i % 3) * .15, y: -.4 + i * .2 }); ctx.disposables.push(t.geometry); }
      const cradle = new THREE.Mesh(ctx.geo('mt-cradle', () => L.lathe([[0, 0], [.55, 0], [.6, .05], [.5, .1], [.3, .13], [0, .13]], 24)), F.body('#3a3a40', { rough: .8, metal: .2, clearcoat: 0, plain: true })); cradle.position.y = .2; root.add(cradle);
      const fx = K.stageFx(ctx, root, { r: 1.15, h: 2.5, color: '#ff00ff', core: [0, 1.2, .3] });
      let glitch = 0;
      const inst = { root, frame: { r: 1.25, h: 2.6 }, float: .05, rest: { yaw: -.4, pitch: 0 } };
      inst.react = k => { if (k === 'click') glitch = 1.2; };
      inst.update = (dt, t, st) => {
        const calm = st.reduced; glitch = Math.max(0, glitch - dt); const step = Math.floor(t * 6), hh = n => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
        g.rotation.y = calm ? .6 : t * .35 + (hh(step) > .93 ? 1.4 : 0); g.rotation.x = calm ? .25 : Math.sin(t * .4) * .3 + (glitch > 0 ? Math.sin(t * 40) * .2 : 0);
        fB.visible = calm || hh(step + 5) > .15; fL.visible = calm || hh(step + 11) > .1; zB.visible = calm || hh(step * 3) > .45; label.visible = calm || hh(step + 2) > .06; edges.visible = calm || hh(step + 9) > .08;
        chk.uniforms.uJ.value = calm ? 0 : 1 + glitch * 4; frags.forEach(f => { const a = f.a + (calm ? 0 : t * .3); f.t.position.set(Math.cos(a) * f.r, f.y + (calm ? 0 : Math.sin(t + f.a) * .08), Math.sin(a) * f.r); f.t.rotation.set(t * .6 + f.a, t * .4, 0); f.t.visible = calm || hh(step + f.a * 10) > .1; });
        axes.rotation.y = calm ? 0 : -t * .2; fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== BACKWARDS CLOCK
  function faceTex(ctx, pal) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); const g = x.createRadialGradient(256, 256, 20, 256, 256, 250); g.addColorStop(0, '#fbf3da'); g.addColorStop(1, '#d8c690'); x.fillStyle = g; x.beginPath(); x.arc(256, 256, 250, 0, TAU); x.fill();
    x.strokeStyle = '#4a3510'; x.lineWidth = 6; x.beginPath(); x.arc(256, 256, 240, 0, TAU); x.stroke();
    for (let i = 0; i < 60; i++) { const a = -i / 60 * TAU - Math.PI / 2, r1 = i % 5 ? 222 : 208; x.lineWidth = i % 5 ? 2 : 5; x.beginPath(); x.moveTo(256 + Math.cos(a) * r1, 256 + Math.sin(a) * r1); x.lineTo(256 + Math.cos(a) * 236, 256 + Math.sin(a) * 236); x.stroke(); }
    x.fillStyle = '#3a2a10'; x.font = '600 52px "Cormorant Garamond", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let n = 1; n <= 12; n++) { const a = -n / 12 * TAU - Math.PI / 2, r = 172; x.save(); x.translate(256 + Math.cos(a) * r, 256 + Math.sin(a) * r); x.scale(-1, 1); x.fillText(String(n), 0, 2); x.restore(); } // counter-clockwise AND mirrored
    x.font = 'italic 600 24px "Cormorant Garamond", Georgia, serif'; x.fillStyle = '#7a3b2a'; x.fillText('tempus retro', 256, 340);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ctx.tex.push(t); return t;
  }
  S.registerModel('backwardsclock', {
    rest: { yaw: -.3, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), cl = new THREE.Group(); root.add(cl);
      const gold = F.trim(pal[0], { rough: .28, metal: 1, env: 1.3 }), wood = F.body('#4a3220', { rough: .5, metal: .1, clearcoat: .5, ccRough: .2, pat: .3 }), dark = F.trim('#201a12', { rough: .5, plain: true }), teal = F.make('glow', { color: pal[1], glow: 1.5 });
      // case: base block, arched body, cornice, bun feet
      const base = new THREE.Mesh(ctx.geo('bc-base', () => L.chamferBox(1.4, .2, .78, .05)), wood); base.position.y = .22; cl.add(base);
      const arch = []; arch.push([-.55, 0]); for (let i = 0; i <= 18; i++) { const a = Math.PI - i / 18 * Math.PI; arch.push([Math.cos(a) * .55, 1.5 + Math.sin(a) * .55]); } arch.push([.55, 0]);
      const bodyM = new THREE.Mesh(ctx.geo('bc-body', () => L.extrude(arch, .52, .05, { bevelSeg: 2, curveSeg: 6 })), wood); bodyM.position.y = .32; cl.add(bodyM);
      const trimA = []; for (let i = 0; i <= 28; i++) { const a = Math.PI - i / 28 * Math.PI; trimA.push([Math.cos(a) * .6, Math.sin(a) * .6]); } trimA.push([.6, -.04], [-.6, -.04]);
      const crown = new THREE.Mesh(ctx.geo('bc-crown', () => L.extrude(trimA, .6, .02, { bevelSeg: 1 })), gold); crown.position.y = 2.1; cl.add(crown);
      const fin = new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), gold); fin.position.y = 2.78; cl.add(fin); ctx.disposables.push(fin.geometry); cl.add(new THREE.Mesh(K.taper([[0, 2.68, 0], [0, 2.74, 0]], .04, .04, { radial: 8, seg: 2 }), gold));
      [[-.56, -.3], [.56, -.3], [-.56, .3], [.56, .3]].forEach(([x, z]) => { const f = new THREE.Mesh(ctx.geo('bc-foot', () => L.lathe([[0, 0], [.07, 0], [.1, .05], [.08, .1], [0, .12]], 12)), gold); f.position.set(x, .06, z); cl.add(f); });
      // dial: mirrored, counter-clockwise numerals; bezel; glass; hands that unwind
      const dial = new THREE.Group(); dial.position.set(0, 1.62, .27); cl.add(dial);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(.5, 48), new THREE.MeshStandardMaterial({ map: faceTex(ctx, pal), roughness: .55, metalness: 0 })); ctx.disposables.push(disc.material, disc.geometry); dial.add(disc);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(.51, .035, 10, 48), gold); dial.add(bezel);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(.5, 40), F.make('glass', { color: '#cfe8ff', opacity: .08 })); glass.position.z = .05; glass.renderOrder = 6; dial.add(glass); ctx.disposables.push(glass.geometry);
      const handShape = (len, w) => [[-w, -.06], [w, -.06], [w * .5, len * .55], [0, len], [-w * .5, len * .55]];
      const hourH = new THREE.Mesh(ctx.geo('bc-hh', () => L.extrude(handShape(.27, .028), .012, .003, { bevelSeg: 1 })), dark), minH = new THREE.Mesh(ctx.geo('bc-mh', () => L.extrude(handShape(.4, .02), .012, .003, { bevelSeg: 1 })), dark), secH = new THREE.Mesh(ctx.geo('bc-sh', () => L.extrude([[-.006, -.08], [.006, -.08], [.006, .44], [-.006, .44]], .008, .002, { bevelSeg: 1 })), F.trim('#a33a2a', { rough: .4, plain: true }));
      hourH.position.z = .02; minH.position.z = .035; secH.position.z = .05; dial.add(hourH, minH, secH); const hub = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 8), gold); hub.position.z = .055; dial.add(hub); ctx.disposables.push(hub.geometry);
      // pendulum window with swinging bob + two counter-turning gears
      const win = new THREE.Group(); win.position.set(0, .88, .27); cl.add(win);
      const wback = new THREE.Mesh(new THREE.PlaneGeometry(.5, .56), new THREE.MeshStandardMaterial({ color: 0x130d08, roughness: .8 })); ctx.disposables.push(wback.material, wback.geometry); win.add(wback);
      const wframe = new THREE.Mesh(ctx.geo('bc-wf', () => L.extrude([[-.3, -.33], [.3, -.33], [.3, .33], [-.3, .33]], .03, .01, { holes: [[[-.25, -.28], [-.25, .28], [.25, .28], [.25, -.28]]], bevelSeg: 1 })), gold); wframe.position.z = .01; win.add(wframe);
      const pend = new THREE.Group(); pend.position.set(0, .26, .03); win.add(pend); pend.add(new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .46, 6), gold)); pend.children[0].position.y = -.23; const bob = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .02, 22), gold); bob.rotation.x = Math.PI / 2; bob.position.y = -.44; pend.add(bob); ctx.disposables.push(pend.children[0].geometry, bob.geometry);
      const gA = K.gearMesh(ctx, 'bc-a', 14, .08, .1, .02, gold), gB = K.gearMesh(ctx, 'bc-b', 10, .055, .075, .02, gold); gA.position.set(-.14, .1, .03); gB.position.set(.04, .16, .03); win.add(gA, gB);
      // ripples that collapse inward, sand rising
      const ripples = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 6, 64), K.basic(ctx, pal[1], 0, true)); r.position.set(0, 1.62, .32); r.userData.noSil = true; r.userData.stageRing = true; r.userData.i = i; cl.add(r); return r; });
      const sand = K.sparks(ctx, cl, { n: 18, color: pal[1], size: .045, rise: .22, spread: 1.1, at: [0, .3, .1], life: 4, opacity: .75 });
      const fx = K.stageFx(ctx, root, { r: 1.05, h: 2.9, color: pal[1], core: [0, 1.62, .35] });
      let rev = 0;
      const inst = { root, frame: { r: 1.1, h: 2.95 }, float: .02, rest: { yaw: -.3, pitch: 0 } };
      inst.react = k => { if (k === 'click') rev = 1.5; };
      inst.update = (dt, t, st) => {
        const calm = st.reduced; rev = Math.max(0, rev - dt); const sp = calm ? 0 : 1 + rev * 9, tt = calm ? 0 : t * sp + 0;
        secH.rotation.z = calm ? .3 : Math.floor(t * 8 * (1 + rev * 4)) / 8 * (TAU / 8); minH.rotation.z = calm ? -.7 : t * (TAU / 24) * (1 + rev * 9); hourH.rotation.z = calm ? 1.9 : t * (TAU / 288) * (1 + rev * 9) + 1.9; // positive z-rotation = counter-clockwise from the viewer: time runs backwards
        pend.rotation.z = calm ? 0 : Math.sin(t * 2.1 - rev * 3) * .32; gA.rotation.z = calm ? 0 : t * .8 * (1 + rev * 5); gB.rotation.z = calm ? 0 : -t * 1.14 * (1 + rev * 5);
        ripples.forEach(r => { const k = calm ? .4 : (((t * .3 + r.userData.i / 3) % 1) + 1) % 1, s = 1.2 * (1 - k) + .15; r.scale.setScalar(s); r.material.opacity = Math.sin(k * Math.PI) * .45 * (calm ? .4 : 1); });
        teal.emissiveIntensity = 1.3 + (calm ? 0 : Math.sin(t * 1.2) * .3); sand.update(dt, t, calm ? 0 : .4 + rev); fx.update(dt, t, calm);
      };
      return inst;
    },
  });
})();
