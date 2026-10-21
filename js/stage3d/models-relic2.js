/* AETHERVAULT — Phase Two relics, deliberately opposite materials.
 *   Oracle Tablet — AGED STONE: chipped monolith with grime/scratch wear always present, glyph columns that re-arrange (three runic
 *                   sheets cross-fading), an eye-sigil that follows the cursor, floating fragments and rubble.
 *   Moonstone     — CRYSTAL / REFRACTION: a glass cabochon around a shader-built interior (adularescent sheen band, view-dependent
 *                   iridescent fresnel, a slowly waxing/waning moon-phase disc with craters) held in a brass claw setting. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, TAU = Math.PI * 2, clamp = U.clamp;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function stoneMat(ctx, hex, bucket, o = {}) {
    const m = ctx.F.body(hex, Object.assign({ rough: .93, metal: 0, clearcoat: 0, pat: .45 }, o)), tr = m.userData.tr;
    tr.wear = L.wearTexture(bucket, ctx.q.tex); tr.u1.value.y = Math.max(tr.u1.value.y, .35); tr.u1.value.z = Math.max(tr.u1.value.z, .55); tr.u2.value.w = .8; return m;
  }

  // =================================================================== ORACLE TABLET
  S.registerModel('oracletablet', {
    rest: { yaw: -.3, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), tb = new THREE.Group(); root.add(tb);
      const stone = stoneMat(ctx, pal[0], 11), stoneDk = stoneMat(ctx, L.shade(pal[0], .62), 5, { rough: .95 }), glow = F.make('glow', { color: pal[1], glow: 1.5 });
      // slab: chipped outline, beveled, standing in a stepped base
      const out = [[-.56, 0], [.56, 0], [.6, 1.62], [.46, 1.78], [.4, 1.94], [.12, 2.0], [-.08, 2.12], [-.34, 2.0], [-.56, 1.9], [-.6, 1.7]];
      const slab = new THREE.Mesh(ctx.geo('ot-slab', () => L.extrude(out, .24, .045, { bevelSeg: 2 })), stone); slab.position.y = .16; tb.add(slab);
      const base = new THREE.Mesh(ctx.geo('ot-base', () => L.chamferBox(1.5, .16, .72, .04)), stoneDk); base.position.y = .08; tb.add(base);
      const base2 = new THREE.Mesh(ctx.geo('ot-base2', () => L.chamferBox(1.26, .1, .56, .03)), stoneDk); base2.position.y = .2; tb.add(base2); slab.position.y = .24;
      // buttress stones leaning on the slab + rubble
      [[-.78, .18, .1, .42, .3], [.82, .14, -.05, .34, -.2]].forEach(([x, y, z, s, r]) => { const m = new THREE.Mesh(ctx.geo('ot-rock', () => { const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + .22 * Math.sin(p.getX(i) * 7) * Math.cos(p.getY(i) * 5 + p.getZ(i) * 3); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .8, p.getZ(i) * k); } g.computeVertexNormals(); return g; }), stoneDk); m.position.set(x, y + .1, z); m.scale.set(s, s * .9, s * .8); m.rotation.y = r; tb.add(m); });
      // glyph columns: three rune sheets cross-fading (they "rearrange when you aren't reading")
      const sheets = [3, 8, 21].map((seed, i) => { const t = K.runeTex(ctx, seed * 17 + 5, 4, 8, 512, pal[1], { w: 400, h: 800, line: 8, gap: .18 }), m = new THREE.Mesh(new THREE.PlaneGeometry(.78, 1.35), K.basic(ctx, '#ffffff', 0, true, { map: t, depthWrite: false })); m.position.set(0, 1.0, .125 + i * .0006); m.userData.noSil = true; tb.add(m); return m; });
      const back = sheets.map(s => { const m = s.clone(); m.material = s.material.clone(); ctx.disposables.push(m.material); m.position.z = -.125 + .0006 * 0; m.rotation.y = Math.PI; tb.add(m); return m; });
      // the eye sigil: ring + pupil that tracks the cursor
      const eye = new THREE.Group(); eye.position.set(0, 1.78, .13); tb.add(eye);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.17, .014, 8, 40), glow), ring2 = new THREE.Mesh(new THREE.TorusGeometry(.115, .008, 6, 32), glow), pupil = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 8), glow); pupil.scale.z = .5; eye.add(ring, ring2, pupil); ctx.disposables.push(pupil.geometry);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, t = new THREE.Mesh(ctx.geo('ot-tick', () => new THREE.BoxGeometry(.012, .05, .01)), glow); t.position.set(Math.cos(a) * .22, Math.sin(a) * .22, 0); t.rotation.z = a - Math.PI / 2; eye.add(t); }
      // fragments orbiting slowly
      const frags = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(ctx.geo('ot-frag', () => { const g = new THREE.IcosahedronGeometry(1, 0); g.scale(.7, 1.2, .5); return g; }), stone); m.scale.setScalar(.06 + (i % 3) * .035); tb.add(m); frags.push({ m, a: i / 5 * TAU, r: .95 + (i % 2) * .22, y: .8 + i * .28, sp: .12 + i * .03 }); }
      const dust = K.sparks(ctx, tb, { n: 10, color: '#cdbf9a', size: .05, rise: .06, spread: 1.4, at: [0, .3, 0], life: 5, opacity: .35, smoke: true });
      const fx = K.stageFx(ctx, root, { r: 1.1, h: 2.4, color: pal[1], core: [0, 1.2, .15] });
      let ph = 0, look = new THREE.Vector2();
      const inst = { root, frame: { r: 1.15, h: 2.4 }, float: .03, rest: { yaw: -.3, pitch: 0 } };
      inst.react = k => { if (k === 'click') ph += 1; };
      inst.update = (dt, t, st) => {
        const calm = st.reduced; if (!calm) ph += dt / 6.5; const f = ph % 3;
        [...sheets, ...back].forEach((m, i) => { const k = i % 3, d = Math.min(Math.abs(f - k), 3 - Math.abs(f - k)); m.material.opacity = clamp(1 - d * 1.5, 0, 1) * (.8 + (calm ? 0 : Math.sin(t * 1.2 + k) * .08)); });
        look.x += ((calm ? 0 : st.pointer.x) - look.x) * .08; look.y += ((calm ? 0 : -st.pointer.y) - look.y) * .08; pupil.position.set(look.x * .05, look.y * .04, 0);
        ring.rotation.z = t * .15; ring2.rotation.z = -t * .22; glow.emissiveIntensity = 1.4 + (calm ? 0 : Math.sin(t * 1.3) * .3);
        frags.forEach(fr => { const a = fr.a + t * fr.sp; fr.m.position.set(Math.cos(a) * fr.r, fr.y + Math.sin(t * .8 + fr.a) * .06, Math.sin(a) * fr.r * .6); fr.m.rotation.set(t * .3 + fr.a, a, t * .2); });
        dust.update(dt, t, calm ? 0 : .3); fx.update(dt, t, calm);
      };
      return inst;
    },
  });

  // =================================================================== MOONSTONE
  const MOON_V = `varying vec3 vN; varying vec3 vV; varying vec3 vO; void main(){ vO = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const MOON_F = `uniform float uTime; uniform float uPhase; uniform vec3 uMilk; uniform vec3 uBlue; uniform vec3 uLit; varying vec3 vN; varying vec3 vV; varying vec3 vO;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec3 n = normalize(vN), v = normalize(vV); float nv = clamp(dot(n, v), 0.0, 1.0), fr = pow(1.0 - nv, 2.2);
  // adularescence: a soft blue band that slides across the stone as the view angle and time change
  float band = sin((n.x * 2.6 + n.y * 1.4 - uTime * 0.22) * 3.1416 + vO.y * 2.0); float sheen = smoothstep(0.35, 1.0, band) * (0.5 + 0.5 * fr * 2.0);
  vec3 col = mix(uMilk, uBlue, sheen * 0.85);
  // iridescent edge: thin-film style hue shift with view angle
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + nv * 1.1 + uTime * 0.03)); col += irid * fr * 0.55;
  // the moon: a disc inside the stone with a terminator that sweeps with uPhase (-1 new … 0 full … 1 new)
  vec2 p = vO.xy / 0.5; float d = length(p); float disc = smoothstep(1.0, 0.92, d);
  float tx = cos(uPhase * 3.1416) * sqrt(max(0.0, 1.0 - p.y * p.y)); float lit = smoothstep(tx - 0.06, tx + 0.06, p.x) * disc;
  float cr = vn(p * 6.0 + 3.0) * 0.6 + vn(p * 13.0) * 0.4; vec3 moon = mix(uBlue * 0.35, uLit * (0.72 + 0.28 * cr), lit); col = mix(col, moon, disc * (0.55 + 0.35 * (1.0 - fr)));
  col += uLit * pow(max(0.0, 1.0 - d), 3.0) * 0.12 * lit;
  gl_FragColor = vec4(col, 1.0); }`;

  S.registerModel('moonstone', {
    rest: { yaw: -.3, pitch: 0 },
    build(ctx) {
      const pal = ctx.item.pal, F = ctx.F, lvl = ctx.level, root = new THREE.Group(), g = new THREE.Group(); root.add(g); g.position.y = 1.05;
      const brass = F.trim('#b48d4c', { rough: .3, plain: true }), silver = F.trim('#c9d2e6', { rough: .22, plain: true });
      const tint = F.body(pal[1], { plain: true }).color.clone(), milk = new THREE.Color(pal[0]).lerp(new THREE.Color('#ffffff'), .55), lit = new THREE.Color(pal[3]);
      // interior (opaque shader) + glass shells (transparent, wear/cracks come from the shared shader)
      const inner = new THREE.Mesh(ctx.geo('ms-ell', () => { const s = new THREE.SphereGeometry(1, 48, 32); s.scale(.62, .82, .4); return s; }), new THREE.ShaderMaterial({ uniforms: { uTime: L.timeUniform, uPhase: { value: .35 }, uMilk: { value: milk }, uBlue: { value: tint.clone().lerp(new THREE.Color('#7fb0ff'), .55) }, uLit: { value: lit } }, vertexShader: MOON_V, fragmentShader: MOON_F })); ctx.disposables.push(inner.material); inner.scale.setScalar(.97); g.add(inner);
      const shellM = F.make('glass', { color: '#e6efff', opacity: .16 }), shell = new THREE.Mesh(inner.geometry, shellM); shell.renderOrder = 6; shell.userData.noCast = true; g.add(shell);
      const glowS = L.sprite(pal[1], 2.6, .32); glowS.position.z = -.2; glowS.renderOrder = 0; g.add(glowS);
      // brass claw setting: cup, four prongs, bail + ring
      const cup = new THREE.Mesh(ctx.geo('ms-cup', () => L.lathe([[0, -.1], [.2, -.1], [.3, -.02], [.42, .08], [.46, .14], [.4, .16], [.3, .1], [.18, .02], [0, .02]], 32)), brass); cup.position.y = -.86; g.add(cup);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4, x = Math.cos(a), z = Math.sin(a); g.add(new THREE.Mesh(K.taper([[x * .44, -.76, z * .26], [x * .56, -.35, z * .32], [x * .58, .2, z * .3], [x * .36, .72, z * .19], [x * .12, .88, z * .06]], .032, .014, { radial: 7, seg: 22, ends: 'round' }), brass)); }
      const bail = new THREE.Mesh(new THREE.TorusGeometry(.12, .02, 8, 28), silver); bail.position.y = 1.0; g.add(bail); const cap = new THREE.Mesh(ctx.geo('ms-cap', () => L.lathe([[0, .85], [.07, .85], [.1, .9], [.06, .96], [0, .98]], 16)), brass); g.add(cap);
      // foot: three short brass feet + ring so it stands
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; const f = new THREE.Mesh(K.taper([[Math.cos(a) * .22, -.9, Math.sin(a) * .22], [Math.cos(a) * .36, -1.0, Math.sin(a) * .36], [Math.cos(a) * .46, -1.05, Math.sin(a) * .46]], .045, .03, { radial: 6, seg: 8 }), brass); g.add(f); }
      // glints inside + orbiting motes
      const n = Math.round(14 * ctx.q.particles), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * .8; pos[i * 3 + 1] = (Math.random() - .5) * 1.2; pos[i * 3 + 2] = (Math.random() - .5) * .3; }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pm = new THREE.PointsMaterial({ map: L.dotTex(), color: new THREE.Color('#e8f4ff'), size: .05, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }); ctx.disposables.push(pm); const motes = new THREE.Points(pg, pm); motes.userData.noSil = true; motes.userData.base = pos.slice(); motes.frustumCulled = false; g.add(motes);
      const fx = K.stageFx(ctx, root, { r: .95, h: 2.1, color: pal[1], y0: 0, core: [0, 1.05, .2] });
      let ph = .35, pulse = 0;
      const inst = { root, frame: { r: .95, h: 2.2 }, float: .05, rest: { yaw: -.3, pitch: 0 } };
      inst.react = k => { if (k === 'click') pulse = 1; };
      inst.update = (dt, t, st) => {
        const calm = st.reduced; if (!calm) ph += dt * (.035 + pulse * .6); pulse = Math.max(0, pulse - dt * .9); const p = ((ph % 2) + 2) % 2 - 1; inner.material.uniforms.uPhase.value = p;
        glowS.material.opacity = .26 + (calm ? 0 : Math.sin(t * .7) * .05) + pulse * .3; g.position.y = 1.05 + (calm ? 0 : Math.sin(t * .9) * .015);
        const q = motes.geometry.attributes.position, b = motes.userData.base; for (let i = 0; i < q.count; i++) { q.array[i * 3] = b[i * 3] + Math.sin(t * .4 + i) * .06; q.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * .5 + i * 1.7) * .08; } q.needsUpdate = true; fx.update(dt, t, calm);
      };
      return inst;
    },
  });
})();
