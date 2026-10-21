/* AETHERVAULT — Oddity: Whisper Jar. A thick-walled glass jar corked with wax and twine, holding shader-driven spectral ribbons,
 * drifting ghost faces and a hanging paper tag. Unstable specimens distort; fractured ones crack with light.
 * L1 runed glass + third wisp · L2 brass collar + faces · L3 orbiting rune tablets · L4 spectral crown + continuous whisper rings. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util;
  const TAU = Math.PI * 2;

  const WISP_V = `uniform float uTime,uSeed,uR,uH,uSpd,uWidth; varying float vT; varying float vY;
vec3 f(float t){ float a=t*9.0+uTime*uSpd+uSeed; float r=uR*(0.3+0.7*sin(t*3.14159))*(0.82+0.18*sin(uTime*0.7+uSeed*3.0)); return vec3(cos(a)*r, uH*(t-0.5)*1.7+sin(a*1.3+uSeed)*0.07, sin(a)*r); }
void main(){ vec3 p0=f(uv.x); vec3 p1=f(uv.x+0.012); vec3 tg=normalize(p1-p0); vec3 side=normalize(cross(tg, vec3(p0.x,0.0,p0.z)+vec3(0.001))); float wv=uWidth*(0.25+sin(uv.x*3.14159))*(uv.y-0.5)*2.0; vec3 pos=p0+side*wv; vT=uv.x; vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0); }`;
  const WISP_F = `uniform vec3 uC1; uniform vec3 uC2; uniform float uOp; varying float vT; varying float vY;
void main(){ float a=pow(sin(vT*3.14159),1.4)*(1.0-abs(vY-0.5)*1.7)*uOp; vec3 c=mix(uC1,uC2,vT); gl_FragColor=vec4(c*a*1.6,a); }`;

  function faceTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 60, 4, 64, 64, 60); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(210,235,255,.5)'); g.addColorStop(1, 'rgba(180,210,255,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(64, 66, 40, 52, 0, 0, TAU); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,.9)'; x.beginPath(); x.ellipse(48, 56, 8, 12, .15, 0, TAU); x.fill(); x.beginPath(); x.ellipse(80, 56, 8, 12, -.15, 0, TAU); x.fill(); x.beginPath(); x.ellipse(64, 90, 9, 16, 0, 0, TAU); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  S.registerModel('whisperjar', {
    rest: { yaw: -.35, pitch: 0 },
    build(ctx) {
      const F = ctx.F, pal = ctx.item.pal, lvl = ctx.level, wear = F.wear, root = new THREE.Group(), j = new THREE.Group(); root.add(j);
      const prof = [[0, .0], [.5, .0], [.56, .04], [.62, .14], [.66, .42], [.64, .78], [.55, 1.08], [.36, 1.28], [.27, 1.42], [.27, 1.6], [.31, 1.64], [.31, 1.7]];
      const outer = L.lathe(prof, 56), innerProf = prof.map(([r, y], i) => [Math.max(0, r - .045), y + (i === 0 ? .05 : 0)]).slice(1, -1); innerProf[0][0] = 0; const inner = L.lathe(innerProf.concat([[.2, 1.64], [0, 1.64]].slice(0, 0)), 56);
      const gOut = F.make('glass', { color: '#cfe6ee', opacity: .2 }), gIn = F.make('glass', { color: '#cfe6ee', opacity: .12, side: THREE.BackSide });
      const jarOuter = new THREE.Mesh(outer, gOut), jarInner = new THREE.Mesh(inner, gIn); jarOuter.renderOrder = 6; jarInner.renderOrder = 2; jarOuter.userData.noCast = jarInner.userData.noCast = true; j.add(jarInner, jarOuter);
      // glass base (thick)
      const baseM = new THREE.Mesh(L.lathe([[0, 0], [.5, 0], [.56, .04], [.58, .12], [0, .12]], 56), F.make('glass', { color: '#b9d7e0', opacity: .5 })); baseM.renderOrder = 3; j.add(baseM);
      // cork + twine + wax seal
      const corkMat = F.body('#b58a55', { rough: .92, metal: 0, clearcoat: 0, pat: 1 }); const cork = new THREE.Mesh(L.lathe([[0, 1.5], [.22, 1.5], [.255, 1.62], [.27, 1.9], [.255, 1.98], [0, 1.99]], 28), corkMat); j.add(cork);
      for (let i = 0; i < 4; i++) { const g = new THREE.Mesh(new THREE.TorusGeometry(.262, .007, 5, 28), F.dark('#6b4a28')); g.rotation.x = Math.PI / 2; g.position.y = 1.7 + i * .07; j.add(g); }
      const cord = F.body('#cdb98a', { rough: .85, metal: 0, clearcoat: 0 }), tw = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * 8 * TAU, y = 1.46 + t * .16; tw.push([Math.cos(a) * (.32 - t * .01), y, Math.sin(a) * (.32 - t * .01)]); } j.add(new THREE.Mesh(L.tube(tw, .012, 200, 5), cord));
      const wax = F.body('#9c2f2f', { rough: .35, metal: 0, clearcoat: .8 }); const seal = new THREE.Mesh(L.lathe([[0, 0], [.1, 0], [.115, .02], [.1, .05], [0, .06]], 18), wax); seal.rotation.x = Math.PI / 2; seal.position.set(0, 1.55, .335); j.add(seal);
      const stamp = new THREE.Mesh(new THREE.OctahedronGeometry(.045, 0), F.dark('#5c1717')); stamp.scale.set(1, 1, .3); stamp.position.set(0, 1.55, .395); j.add(stamp); ctx.disposables.push(stamp.geometry);
      // paper tag hung on the twine
      const tagTex = L.paperTexture([{ text: 'Whisper Jar', font: 'italic 600 40px "Cormorant Garamond", Georgia, serif', y: 96 }, { text: '№ ' + U.pad(ctx.spec.serial || 0, 4), font: '500 30px "IBM Plex Mono", monospace', y: 160 }, { text: 'do not listen', font: 'italic 400 26px "Cormorant Garamond", Georgia, serif', y: 230, color: '#7a3b2a' }, { text: 'after dark', font: 'italic 400 26px "Cormorant Garamond", Georgia, serif', y: 262, color: '#7a3b2a' }], 256, 384); ctx.tex.push(tagTex);
      const tagM = new THREE.MeshStandardMaterial({ map: tagTex, roughness: .9, side: THREE.DoubleSide }); ctx.disposables.push(tagM);
      const tag = new THREE.Group(); tag.position.set(.28, 1.5, .27); const tm = new THREE.Mesh(L.extrude([[-.13, -.2], [.13, -.2], [.13, .12], [.08, .2], [-.08, .2], [-.13, .12]], .008, .002, { bevelSeg: 1 }), tagM); tm.geometry.computeBoundingBox(); const bb = tm.geometry.boundingBox;
      { const pos = tm.geometry.attributes.position, uv = new Float32Array(pos.count * 2); for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x); uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y); } tm.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
      tm.position.set(0, -.22, 0); tag.add(tm); tag.add(new THREE.Mesh(L.tube([[0, .02, 0], [-.02, 0, 0], [0, -.03, 0]], .004, 6, 4), cord)); j.add(tag); tag.rotation.z = -.12;
      // brass claw collar at the foot
      const brass = F.trim('#b48d4c', { rough: .3, plain: true }), claw = [];
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .03, 8, 48), brass); ring.rotation.x = Math.PI / 2; ring.position.y = .1; j.add(ring);
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .5, pts = [[Math.cos(a) * .72, 0, Math.sin(a) * .72], [Math.cos(a) * .72, .1, Math.sin(a) * .72], [Math.cos(a) * .67, .28, Math.sin(a) * .67], [Math.cos(a) * .64, .42, Math.sin(a) * .64]]; j.add(new THREE.Mesh(L.tube(pts, .03, 20, 6), brass)); const foot = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), brass); foot.position.set(Math.cos(a) * .72, .02, Math.sin(a) * .72); j.add(foot); ctx.disposables.push(foot.geometry); }

      // spectral wisps (shader ribbons) + motes
      const wc1 = new THREE.Color(pal[0]).lerp(new THREE.Color('#ffffff'), .1), wc2 = new THREE.Color(pal[1]), nW = lvl >= 1 ? 3 : 2, wisps = [];
      for (let i = 0; i < nW; i++) {
        const mat = new THREE.ShaderMaterial({ uniforms: { uTime: L.timeUniform, uSeed: { value: i * 2.1 }, uR: { value: .5 - i * .06 }, uH: { value: .7 }, uSpd: { value: .55 + i * .2 }, uWidth: { value: .1 + i * .02 }, uC1: { value: wc1 }, uC2: { value: wc2 }, uOp: { value: .8 } }, vertexShader: WISP_V, fragmentShader: WISP_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 80, 1), mat); m.position.y = .72; m.renderOrder = 4; m.userData.noSil = true; m.frustumCulled = false; j.add(m); wisps.push(m); ctx.disposables.push(mat);
      }
      const nM = Math.round(26 * ctx.q.particles), mp = new Float32Array(nM * 3); for (let i = 0; i < nM; i++) { mp[i * 3] = (Math.random() - .5) * .8; mp[i * 3 + 1] = .2 + Math.random() * 1; mp[i * 3 + 2] = (Math.random() - .5) * .8; }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); const mm = new THREE.PointsMaterial({ map: L.dotTex(), color: new THREE.Color(wc2), size: .05, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }); const motes = new THREE.Points(mg, mm); motes.renderOrder = 5; motes.userData.noSil = true; motes.userData.base = mp.slice(); j.add(motes); ctx.disposables.push(mm);
      const glow = L.sprite(pal[1], 1.8, .28); glow.position.y = .75; glow.renderOrder = 1; j.add(glow);
      // ghost faces
      const faces = []; let ft = null;
      if (lvl >= 2 || ctx.potentialTier >= 2) { ft = faceTex(); ctx.tex.push(ft); const n = lvl >= 4 ? 4 : 3; for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, color: new THREE.Color(i % 2 ? pal[0] : '#ffffff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(.34, .4, 1); s.renderOrder = 5; s.userData.noSil = true; s.userData.i = i; j.add(s); faces.push(s); ctx.disposables.push(s.material); } }
      // stage additions
      let runes = null, tablets = null, crown = null, rings = [];
      if (lvl >= 1) { const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d'); x.clearRect(0, 0, 1024, 256); x.strokeStyle = 'rgba(220,245,255,.9)'; x.lineWidth = 5; x.lineCap = 'round'; const r = U.mulberry32(77); for (let i = 0; i < 14; i++) { const cx = 40 + i * 70, cy = 128; x.beginPath(); for (let k = 0; k < 4; k++) { const px = cx + (r() - .5) * 38, py = cy + (r() - .5) * 120; if (k) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; ctx.tex.push(t);
        runes = new THREE.Mesh(L.lathe([[.665, .36], [.67, .46], [.66, .66], [.6, .86]].map(p => [p[0] + .003, p[1]]), 56), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide })); runes.renderOrder = 7; runes.userData.noSil = true; j.add(runes); ctx.disposables.push(runes.material); }
      if (lvl >= 2) { const col = new THREE.Mesh(L.lathe([[.28, 1.3], [.34, 1.3], [.36, 1.36], [.34, 1.42], [.28, 1.42]], 32), brass); j.add(col); const col2 = new THREE.Mesh(L.lathe([[.62, .78], [.66, .78], [.68, .84], [.66, .9], [.6, .9]], 56), brass); j.add(col2); }
      if (lvl >= 3) { tablets = new THREE.Group(); const tg = L.extrude([[-.1, -.15], [.1, -.15], [.1, .1], [0, .18], [-.1, .1]], .04, .01, { bevelSeg: 1 }); ctx.disposables.push(tg); for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(tg, brass), gl = new THREE.Mesh(new THREE.BoxGeometry(.05, .008, .01), F.make('glow', { color: pal[1], glow: 1.6 })); gl.position.z = .027; t.add(gl); t.userData.i = i; tablets.add(t); ctx.disposables.push(gl.geometry); } j.add(tablets); }
      if (lvl >= 4) { crown = new THREE.Group(); crown.position.y = 2.0; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, m = new THREE.Mesh(new THREE.PlaneGeometry(.07, .6 + (i % 3) * .16), new THREE.MeshBasicMaterial({ map: L.shaftTex(), color: new THREE.Color(pal[1]), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.set(Math.cos(a) * .22, .35, Math.sin(a) * .22); m.rotation.y = -a; m.rotation.z = Math.cos(a) * .35; m.userData.noSil = true; crown.add(m); ctx.disposables.push(m.material); } j.add(crown); }
      const nRing = lvl >= 4 ? 3 : 2; for (let i = 0; i < nRing; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(pal[1]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); r.rotation.x = Math.PI / 2; r.position.y = .75; r.userData.k = 99; r.userData.noSil = true; r.userData.stageRing = true; j.add(r); rings.push(r); ctx.disposables.push(r.material); }
      j.position.y = .05;
      const inst = { root, frame: { r: 1.05, h: 2.1 }, float: .03, rest: { yaw: -.35, pitch: 0 }, whisper: 0 };
      let nextWhisper = 4, tt = 0;
      inst.react = k => { if (k === 'click') inst.whisper = 0.0001; };
      inst.update = (dt, t, st) => {
        const calm = st.reduced; tt += dt; const fl = wear.flicker, un = wear.unstable;
        const flick = calm || !fl ? 1 : (Math.random() < .03 * fl * 4 ? .25 : 1);
        wisps.forEach((w, i) => { w.material.uniforms.uOp.value = (.75 + (calm ? 0 : Math.sin(t * 1.3 + i) * .15)) * flick; if (un) w.material.uniforms.uR.value = (.5 - i * .06) * (1 + Math.sin(t * 5 + i) * .08 * un); });
        glow.material.opacity = (.22 + Math.sin(t * .8) * .06) * flick;
        const p = motes.geometry.attributes.position, b = motes.userData.base; for (let i = 0; i < p.count; i++) { const a = t * .5 + i; p.array[i * 3] = b[i * 3] + Math.sin(a) * .1; p.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * .4 + i * 1.7) * .12; p.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(a) * .1; } p.needsUpdate = true;
        faces.forEach((s, i) => { const k = ((t * .12 + i * .33) % 1), fade = Math.sin(k * Math.PI), a = i / faces.length * TAU + t * .25; s.position.set(Math.cos(a) * .3, .35 + k * .8, Math.sin(a) * .3); s.material.opacity = (calm ? .25 : Math.pow(fade, 1.5) * .6) * flick; s.scale.set(.3 + k * .12, .36 + k * .14, 1); });
        tag.rotation.z = -.12 + (calm ? 0 : Math.sin(t * 1.1) * .05); if (tablets) tablets.children.forEach((m, i) => { const a = t * .4 + i / 3 * TAU; m.position.set(Math.cos(a) * 1.05, .9 + Math.sin(t + i) * .08, Math.sin(a) * 1.05); m.rotation.y = -a + Math.PI / 2; }); if (crown) crown.children.forEach((m, i) => (m.material.opacity = .45 + Math.sin(t * 1.1 + i) * .15));
        if (!calm) { nextWhisper -= dt; if (nextWhisper <= 0 || (lvl >= 4 && rings.every(r => r.userData.k > 2.4))) { inst.whisper = .0001; nextWhisper = 8 + Math.random() * 6; } }
        if (inst.whisper > 0) { inst.whisper += dt; if (inst.whisper > 2.6) inst.whisper = 0; }
        rings.forEach((r, i) => { const k = inst.whisper > 0 ? inst.whisper - i * .45 : -1; if (k > 0 && k < 1.8) { r.userData.k = k; r.scale.setScalar(.7 + k * .9); r.material.opacity = (1 - k / 1.8) * .55; } else { r.userData.k = 99; r.material.opacity = 0; } });
        if (un > 0) j.rotation.z = Math.sin(t * 6) * .006 * un;
      };
      return inst;
    },
  });
})();
