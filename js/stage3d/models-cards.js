/* AETHERVAULT — Phase Four: the physical card (one builder for every card id) and its hologram.
 * Card       a rounded card body with real thickness (edge colour by stock), a printed face and the shared Aethervault back.
 *            Material by tier: matte fibre stock (bump) · coated + spot gloss · foilboard (metal mask) · holographic laminate
 *            (view-angle foil shader) + depth-separated art (parallax shader) · prism film + animated parallax + dyed edge ·
 *            borderless leaf print + reactive layered foil + gilt edge · Lumen Glass (art window far deeper than the card) ·
 *            Null Stock (pieces of the print missing). Enhancement stages add a sleeve, a grading label, a sealed slab and a gilt frame.
 * Hologram   Epic and above (and any Living Print): while untouched the card lies back on a brass rest and projects its subject.
 *            Dragging dissolves the projection and lifts the card upright for inspection; after the auto-return delay it settles
 *            back and the projection re-forms. Item subjects reuse their own 3D model under one hologram shader (loaded on demand);
 *            scenes and beings project their illustration as stacked depth slices. Each subject class behaves differently.
 * API (beyond the usual root/frame/update/react): setFace('front'|'back', animate) · cue(colour, strength) · setMode('auto'|'card'|'holo')
 *            · mode() · loadP (resolves when the printed textures are drawn; thumbnails wait for it). */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed || !AV.stage.kit || !AV.cardArt || !AV.cards) return;
  const S = AV.stage, THREE = window.THREE, L = S.lib, U = AV.util, K = S.kit, CA = AV.cardArt, CD = AV.cards, D = AV.data, clamp = U.clamp;
  const CW = 1.0, CH = 1.4, T = .014, CR = .05;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const settings = () => (AV.state && AV.state.get() ? AV.state.get().settings : {});

  // ------------------------------------------------------------------ shared geometry
  function roundedShape(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
  const faceGeo = flip => S.geo('card-face' + (flip ? 'B' : 'F'), () => { const g = new THREE.ShapeGeometry(roundedShape(CW, CH, CR), 6), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + CW / 2) / CW, v = (p.getY(i) + CH / 2) / CH; uv.setXY(i, u, v); } if (flip) g.rotateY(Math.PI); return g; }); // the back is turned, not mirrored
  const bodyGeo = () => S.geo('card-body', () => { const g = new THREE.ExtrudeGeometry(roundedShape(CW, CH, CR), { depth: T, bevelEnabled: false, curveSegments: 6 }); g.translate(0, 0, -T / 2); return g; });
  const winGeo = (a) => { const g = new THREE.PlaneGeometry(a.w / CA.W * CW, a.h / CA.H * CH); return g; };

  // ------------------------------------------------------------------ shaders
  // Foil: view-angle + pointer driven interference colours, masked by the print's foil mask (R). Additive over the face.
  const FOIL_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const FOIL_FS = `uniform sampler2D uMask; uniform float uTime, uStr, uType; uniform vec2 uTilt; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    vec3 hsv(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    void main(){ float m = texture2D(uMask, vUv).r; if (m < .01) discard;
      float ndv = clamp(dot(normalize(vN), normalize(vV)), 0., 1.), ang = (1. - ndv);
      float ph = dot(vUv, vec2(.45, .7)) * 1.5 + ang * 1.9 + uTilt.x * .8 + uTilt.y * .45;
      vec3 c = mix(hsv(fract(ph)), vec3(1.), .18); float k = .06 + .94 * smoothstep(.04, .5, ang + abs(uTilt.x) * .22 + abs(uTilt.y) * .12);
      if (uType > 4.5) { float band = smoothstep(.25, 0., abs(fract(ph * .5) - .5) - .12); c = vec3(1., .82, .48) * (.35 + band); }
      if (uType > .5 && uType < 1.5) { c = mix(c, hsv(fract(ph * 2.7 + .3)), .5) * (.7 + .3 * step(.5, fract((vUv.x + vUv.y) * 14. + ang * 3.))); }
      else if (uType > 1.5 && uType < 2.5) { vec2 g = floor(vUv * vec2(60., 84.)); float s = step(.965, hash(g)); float tw = .5 + .5 * sin(uTime * 3. + hash(g + 3.) * 30. + ang * 20.); c = mix(c * .35, vec3(1.), s * tw); }
      else if (uType > 2.5 && uType < 3.5) { float w = sin(vUv.x * 9. + uTime * .6 + ang * 4.) * .5 + .5; c = mix(vec3(.3,1.,.8), vec3(.75,.55,1.), w) * (.6 + .4 * sin(vUv.y * 20. + uTime)); }
      else if (uType > 3.5 && uType < 4.5) { float b = step(.82, hash(floor(vec2(vUv.y * 40., floor(uTime * 6.))))); c = mix(c, vec3(1.,0.,1.), b) ; }
      gl_FragColor = vec4(c * m * uStr * k, 1.);
      #include <colorspace_fragment>
    }`;
  // Parallax art: three illustration layers sampled at depth-dependent offsets along the view direction (card space).
  const PAR_VS = `varying vec2 vUv; varying vec3 vVt; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.); vec3 v = cameraPosition - wp.xyz; mat3 m = mat3(modelMatrix); vec3 t = normalize(m[0]), b = normalize(m[1]), n = normalize(m[2]); vVt = vec3(dot(v,t), dot(v,b), dot(v,n)); gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const PAR_FS = `uniform sampler2D uBg, uMid, uFg; uniform float uD0, uD1, uD2, uTime, uAnim, uGlitch; uniform vec2 uAsp; varying vec2 vUv; varying vec3 vVt;
    float hash(float n){ return fract(sin(n)*43758.5453); }
    vec2 off(float d){ vec3 v = normalize(vVt); return -v.xy / max(.25, v.z) * d * uAsp; }
    vec4 tap(sampler2D t, vec2 uv, float s){ uv = (uv - .5) * s + .5; return texture2D(t, clamp(uv, .002, .998)); }
    void main(){ vec2 uv = vUv;
      if (uGlitch > .5) { float row = floor(uv.y * 26.); float g = step(.86, hash(row + floor(uTime * 5.))); uv.x += g * (hash(row * 3.1) - .5) * .12; }
      vec2 drift = uAnim * vec2(sin(uTime * .5) * .006, cos(uTime * .4) * .004);
      vec4 b = tap(uBg, uv + off(uD0) - drift * .5, .88), m = tap(uMid, uv + off(uD1) + drift, .94), f = tap(uFg, uv + off(uD2) + drift * 2.2, .98);
      vec3 c = b.rgb; c = mix(c, m.rgb, m.a); c = mix(c, f.rgb, f.a);
      gl_FragColor = vec4(c, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  // Hologram: fresnel rim, horizontal scanlines in world space, a slow upward sweep and flicker; optional alpha map for depth slices.
  const HOLO_VS = `varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const HOLO_FS = `uniform vec3 uColor; uniform float uTime, uOp, uMapOn, uY0, uY1; uniform sampler2D uMap; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec2 vUv;
    void main(){ float a = 1.; if (uMapOn > .5) { vec4 t = texture2D(uMap, vUv); a = t.a * (.35 + .65 * max(t.r, max(t.g, t.b))); if (a < .02) discard; }
      float f = 1. - abs(dot(normalize(vN), normalize(vV))); f = uMapOn > .5 ? .42 : pow(f, 1.8) * .85 + .06;
      float sl = .55 + .45 * step(.5, fract(vW.y * 60. - uTime * 1.5));
      float h = clamp((vW.y - uY0) / max(.01, uY1 - uY0), 0., 1.), sweep = smoothstep(.06, 0., abs(h - fract(uTime * .22))) * .9;
      float fl = .92 + .08 * sin(uTime * 37.) * sin(uTime * 13.);
      gl_FragColor = vec4(uColor * (f * sl + sweep) * fl * uOp * a, 1.);
      #include <colorspace_fragment>
    }`;

  function foilType(foil) { return ({ prism: 1, starfield: 2, aurora: 3, nullfoil: 4 })[foil] || 0; }
  function paperBump(ctx) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = U.mulberry32(17); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { const a = r() * Math.PI, l = 3 + r() * 14, px = r() * 256, py = r() * 256; x.strokeStyle = r() < .5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.16)'; x.lineWidth = .6 + r() * .8; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 4); ctx.tex.push(t); return t; }
  const canvasTex = (ctx, w, h, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ctx.tex.push(t); return { c, t }; };

  // ------------------------------------------------------------------ hologram builders
  function holoMaterial(ctx, color, map) {
    const m = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOp: { value: 0 }, uMapOn: { value: map ? 1 : 0 }, uMap: { value: map || null }, uY0: { value: .8 }, uY1: { value: 1.8 } }, vertexShader: HOLO_VS, fragmentShader: HOLO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    ctx.disposables.push(m); return m;
  }
  /** The depicted item's own model under the hologram shader. Resolves { group, inst, h } or null. */
  async function itemHologram(ctx, iid, mat) {
    await S.ensure([iid]); const def = S.models[iid]; if (!def) return null;
    const item = D.ITEMS[iid], R = D.RARITY[item.rarity], spec = { base: iid, variant: 'none', pattern: 'plain', seed: (ctx.spec.seed >>> 0) || 1, palette: 0, condition: 0, level: 0, potential: 50, serial: 0, size: 1 };
    const sub = Object.assign({}, ctx, { spec, item, rarity: R, tier: R.tier, rc: R.color, F: L.materialFactory(spec, ctx.q, ctx.disposables, ctx.q.tex), rng: U.mulberry32(spec.seed ^ 0x5bd1e995), theme: item.pal, level: 0, potentialTier: 0, mode: 'holo' });
    let inst; try { inst = def.build(sub); } catch (e) { console.warn('[card holo]', e); return null; }
    const drop = []; inst.root.traverse(o => { if (o.userData.stageRing || o.isLight || o.isSprite || o.isPoints) drop.push(o); else if (o.isMesh) { o.material = mat; o.castShadow = o.receiveShadow = false; o.userData.noSil = true; } });
    drop.forEach(o => o.parent && o.parent.remove(o));
    const box = new THREE.Box3().setFromObject(inst.root), sz = box.getSize(new THREE.Vector3()), k = Math.min(.82 / Math.max(.05, sz.y), .7 / Math.max(.05, sz.x, sz.z));
    const g = new THREE.Group(); g.add(inst.root); inst.root.scale.multiplyScalar(k); inst.root.position.y = -box.min.y * k; inst.root.position.x = -(box.min.x + box.max.x) / 2 * k; inst.root.position.z = -(box.min.z + box.max.z) / 2 * k;
    return { group: g, inst, h: sz.y * k };
  }
  /** Scenes, beings and the null misprint: the illustration's middle layer as five stacked depth slices. */
  async function sliceHologram(ctx, spec, color) {
    const il = CA.illustration(spec), im = await CA.svgImage(CA.illusDoc(il, 'mid', [9, 20, 200, 200], [384, 384])); if (!im) return null;
    const c = document.createElement('canvas'); c.width = c.height = 384; c.getContext('2d').drawImage(im, 0, 0); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; ctx.tex.push(tx);
    const g = new THREE.Group(), geo = new THREE.PlaneGeometry(.9, .9); ctx.disposables.push(geo); const mats = [];
    for (let i = 0; i < 5; i++) { const m = holoMaterial(ctx, color, tx); const p = new THREE.Mesh(geo, m); p.position.set(0, .45, (i - 2) * .05); p.scale.setScalar(1 - Math.abs(i - 2) * .05); p.userData.slice = i; g.add(p); mats.push(m); }
    return { group: g, inst: null, h: .9, mats, slices: g.children };
  }

  // ------------------------------------------------------------------ the card
  function buildCard(ctx) {
    const spec = ctx.spec, item = ctx.item, meta = item.card, tier = ctx.tier, q = ctx.q, thumb = ctx.mode === 'thumb', c = spec.card || {};
    const root = new THREE.Group(), form = spec.form || '', proof = /_proof$/.test(form), living = /_living$/.test(form);
    const L0 = CA.layout(spec), parallax = (tier >= 3 || (c.alt && tier >= 2) || L0.borderless), px = thumb ? 512 : (q.tex >= 512 ? 1024 : q.tex >= 384 ? 768 : 512);
    const st = settings(), low = S.quality() === 'low';
    const eligible = !thumb && st.cardHolo !== false && !low && (tier >= 3 || living);
    // --- pose group (the whole physical card, including its enhancement hardware) → flip group → card
    const pose = new THREE.Group(); root.add(pose); const flipG = new THREE.Group(); pose.add(flipG); const card = new THREE.Group(); flipG.add(card);
    // body + edge colour by stock
    const edgeCol = proof || tier === 5 ? '#e6c76a' : tier === 6 ? '#cff6ff' : tier === 7 ? '#ff00ff' : tier === 4 ? item.pal[1] : tier === 3 ? '#d6dcff' : '#efe8da';
    const edgeM = new THREE.MeshStandardMaterial({ color: new THREE.Color(edgeCol), roughness: tier >= 5 || proof ? .3 : .85, metalness: tier >= 5 || proof ? .9 : 0, emissive: new THREE.Color(0), envMapIntensity: 1.2 }); ctx.disposables.push(edgeM);
    const body = new THREE.Mesh(bodyGeo(), edgeM); card.add(body);
    // printed face: texture drawn asynchronously into a canvas that exists from the start (so the shader program never changes)
    const fH = px, fW = Math.round(px * CA.W / CA.H), face = canvasTex(ctx, fW, fH); face.c.getContext('2d').fillStyle = '#d8cfbb'; face.c.getContext('2d').fillRect(0, 0, fW, fH);
    const mask = CA.maskCanvas(spec, 256), orm = document.createElement('canvas'); orm.width = mask.width; orm.height = mask.height;
    { const mx = mask.getContext('2d').getImageData(0, 0, mask.width, mask.height), ox = orm.getContext('2d'), od = ox.createImageData(orm.width, orm.height), fin = c.finish || 'satin', baseR = ({ matte: .86, satin: .6, gloss: .32, linen: .78, etched: .48 })[fin] || .6;
      for (let i = 0; i < mx.data.length; i += 4) { const foil = mx.data[i] / 255, gloss = mx.data[i + 1] / 255, metalOn = tier === 2 && foil > .1 ? .5 : (tier >= 5 || proof) && foil > .1 ? .45 : 0; od.data[i] = 255; od.data[i + 1] = Math.round(255 * clamp(baseR - gloss * .55 - metalOn * .35, .08, 1)); od.data[i + 2] = Math.round(255 * metalOn); od.data[i + 3] = 255; }
      ox.putImageData(od, 0, 0); }
    const ormT = new THREE.CanvasTexture(orm); ctx.tex.push(ormT); const maskT = new THREE.CanvasTexture(mask); ctx.tex.push(maskT);
    const FP = { map: face.t, roughness: 1, metalness: 1, roughnessMap: ormT, metalnessMap: ormT, envMapIntensity: tier >= 2 ? 1.25 : .8, transparent: parallax, alphaTest: parallax ? .02 : 0 };
    if (tier === 0 && !proof) { FP.bumpMap = paperBump(ctx); FP.bumpScale = .6; }
    const faceM = q.physical ? new THREE.MeshPhysicalMaterial(Object.assign(FP, { clearcoat: (c.finish === 'gloss' || tier >= 3) ? .6 : tier >= 1 ? .25 : 0, clearcoatRoughness: .25 })) : new THREE.MeshStandardMaterial(FP); ctx.disposables.push(faceM);
    const front = new THREE.Mesh(faceGeo(false), faceM); front.position.z = T / 2 + .0006; card.add(front);
    const back = canvasTex(ctx, fW, fH); const backM = new THREE.MeshStandardMaterial({ map: back.t, roughness: .62, metalness: .15, envMapIntensity: .9 }); ctx.disposables.push(backM);
    back.c.getContext('2d').drawImage(CA.backCanvas(c.edition, fH), 0, 0, fW, fH); back.t.needsUpdate = true;
    const backMesh = new THREE.Mesh(faceGeo(true), backM); backMesh.position.z = -T / 2 - .0006; card.add(backMesh);
    // parallax illustration window (behind the cut-out face, just above the stock)
    let par = null;
    if (parallax) {
      const a = L0.art, lw = Math.round(px * .7), lh = Math.round(lw * a.h / a.w), lay = { bg: canvasTex(ctx, lw, lh), mid: canvasTex(ctx, lw, lh), fg: canvasTex(ctx, lw, lh) };
      const deep = tier === 6 ? 1 : 0, uni = { uBg: { value: lay.bg.t }, uMid: { value: lay.mid.t }, uFg: { value: lay.fg.t }, uD0: { value: deep ? .5 : .07 }, uD1: { value: deep ? .16 : .03 }, uD2: { value: -.012 }, uTime: L.timeUniform, uAnim: { value: tier >= 4 || living ? 1 : 0 }, uGlitch: { value: tier === 7 ? 1 : 0 }, uAsp: { value: new THREE.Vector2(CA.W / a.w, CA.H / a.h) } };
      const pm = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: PAR_VS, fragmentShader: PAR_FS }); ctx.disposables.push(pm);
      const pg = winGeo(a); ctx.disposables.push(pg); const pl = new THREE.Mesh(pg, pm);
      pl.position.set((a.x + a.w / 2) / CA.W * CW - CW / 2, CH / 2 - (a.y + a.h / 2) / CA.H * CH, T / 2 + .0002); card.add(pl); par = { pl, lay, uni };
    }
    // foil overlay (Epic and above, and any card whose foil is holographic)
    let foil = null;
    if (['border', 'artfoil', 'holo', 'reverse', 'prism', 'starfield', 'aurora', 'nullfoil'].includes(c.foil) || tier >= 2 || proof) {
      const gold = ['border', 'artfoil'].includes(c.foil) || (tier === 2 && !['holo', 'reverse'].includes(c.foil));
      const fm = new THREE.ShaderMaterial({ uniforms: { uMask: { value: maskT }, uTime: L.timeUniform, uStr: { value: gold ? .34 : tier >= 5 ? .34 : .28 }, uType: { value: gold ? 5 : foilType(c.foil) }, uTilt: { value: new THREE.Vector2() } }, vertexShader: FOIL_VS, fragmentShader: FOIL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      ctx.disposables.push(fm); const fo = new THREE.Mesh(faceGeo(false), fm); fo.position.z = T / 2 + .0012; fo.userData.noSil = true; card.add(fo); foil = fm;
    }
    // enhancement stages: sleeve · grading label · sealed slab · gilt master frame
    const lvl = ctx.level || 0, glass = (o) => { const m = new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xffffff, roughness: .08, metalness: 0, transparent: true, opacity: .16, depthWrite: false, envMapIntensity: 1.6 }, q.physical ? { clearcoat: 1, clearcoatRoughness: .05 } : {}, o || {})); ctx.disposables.push(m); return m; };
    if (lvl >= 1 && lvl < 3) { const sl = new THREE.Mesh(S.geo('card-sleeve', () => L.roundedBox(CW + .05, CH + .06, T + .012, .03, 2)), glass()); sl.position.y = .015; card.add(sl); }
    if (lvl >= 2) { const grade = [10, 9, 8, 6, 4][spec.condition || 0] - (spec.condition >= 2 && spec.potential < 40 ? .5 : 0) + (spec.potential >= 90 && !spec.condition ? 0 : 0); const tx = L.plateTexture([{ text: 'ARCHIVE GRADE', font: '600 64px "Barlow Condensed", sans-serif', spacing: '6px', y: 92, color: '#2a241c' }, { text: (grade % 1 ? grade.toFixed(1) : grade + '') + ' · ' + CD.CONDITIONS[spec.condition || 0].toUpperCase(), font: '600 70px "IBM Plex Mono", monospace', y: 190, color: '#8a2a2a' }], 1024, 256, { top: '#f6eedb', bot: '#e8dcc0', edge: '#8a2a2a' }); ctx.tex.push(tx); const lm = new THREE.MeshStandardMaterial({ map: tx, roughness: .6 }); ctx.disposables.push(lm); const lab = new THREE.Mesh(new THREE.PlaneGeometry(CW * .78, CW * .19), lm); lab.position.set(0, CH / 2 + .14, T / 2 + .02); card.add(lab); ctx.disposables.push(lab.geometry);
      const labB = new THREE.Mesh(S.geo('card-labback', () => L.roundedBox(CW * .94, CW * .26, .02, .01, 2)), new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: .5 })); labB.position.set(0, CH / 2 + .14, T / 2 + .006); card.add(labB); ctx.disposables.push(labB.material); }
    if (lvl >= 3) { const slab = new THREE.Mesh(S.geo('card-slab', () => L.roundedBox(CW + .14, CH + .5, .09, .04, 3)), glass({ opacity: .2 })); slab.position.y = .1; slab.userData.noCast = true; card.add(slab); }
    if (lvl >= 4) { const gm = new THREE.MeshStandardMaterial({ color: 0xe6c76a, roughness: .28, metalness: 1, envMapIntensity: 1.4 }); ctx.disposables.push(gm); const fr = new THREE.Mesh(S.geo('card-frame', () => { const o = [[-.62, -.98], [.62, -.98], [.62, 1.08], [-.62, 1.08]], h = [[-.56, -.92], [-.56, 1.02], [.56, 1.02], [.56, -.92]]; return L.extrude(o, .1, .012, { holes: [h], bevelSeg: 1 }); }), gm); fr.position.z = 0; card.add(fr); }
    // stand: a brass rest that holds the card lying back (hologram) or upright (display)
    const brass = new THREE.MeshStandardMaterial({ color: 0xb48d4c, roughness: .34, metalness: 1, envMapIntensity: 1.2 }); ctx.disposables.push(brass); const stand = new THREE.Group(); if (!thumb) root.add(stand);
    if (!thumb) {
      K.mesh(S.geo('card-standbase', () => L.lathe([[0, 0], [.36, 0], [.38, .025], [.3, .05], [0, .05]], 40)), brass, stand);
      const lipG = S.geo('card-standlip', () => L.chamferBox(.74, .05, .07, .015)), legG = S.geo('card-standleg', () => L.chamferBox(.05, .54, .04, .012));
      if (eligible) { K.mesh(lipG, brass, stand, [0, .035, .58]); K.mesh(legG, brass, stand, [0, .3, -.03]); } // a rest for the card lying back
      else { K.mesh(lipG, brass, stand, [0, .085, .13]); const leg = K.mesh(legG, brass, stand, [0, .28, -.1]); leg.rotation.x = .59; } // an easel for the upright card
    }
    // hologram rig: emitter glow + beam on the card, and the projection itself (built on demand)
    const holoCol = L.shade(living ? '#7fe8ff' : L.mix(ctx.rc, '#8fe6ff', .4), .55), H = { k: eligible ? 0 : 1, want: eligible ? 0 : 1, op: 0, built: null, group: new THREE.Group(), building: false, manual: 'auto', mats: [] };
    root.add(H.group); H.group.position.set(0, 1.0, -.1);
    const beamM = K.basic(ctx, holoCol, 0, true, { map: L.shaftTex(), side: THREE.DoubleSide }); const beam = new THREE.Mesh(new THREE.CylinderGeometry(.42, .16, .62, 24, 1, true), beamM); beam.position.set(0, .66, -.04); beam.userData.noSil = true; ctx.disposables.push(beam.geometry); if (eligible) root.add(beam);
    const cls = meta.cls, iid = CD.depicted(item) || (meta.subject === 'null' ? 'missingtexture' : null);
    function ensureHolo() {
      if (H.built || H.building || !eligible) return; H.building = true;
      const mat = holoMaterial(ctx, holoCol); H.mats.push(mat);
      const p = iid ? itemHologram(ctx, iid, mat) : sliceHologram(ctx, spec, holoCol);
      p.then(hb => { if (!hb || inst.disposed) return; H.built = hb; if (hb.mats) H.mats.push(...hb.mats); H.group.add(hb.group); hb.group.position.y = iid ? 0 : -.05; if (ctx.view) ctx.view.dirty = true; }).catch(e => console.warn('[card holo]', e));
    }
    // poses: 0 = resting (lying back on the rest, projecting) · 1 = raised upright for inspection. Non-holographic cards rest upright.
    const P0 = eligible ? { y: .5, z: .08, rx: -.8 } : { y: .82, z: .02, rx: -.14 }, P1 = { y: .86, z: .06, rx: 0 };
    const applyPose = k => { const e = k * k * (3 - 2 * k); pose.position.set(0, P0.y + (P1.y - P0.y) * e, P0.z + (P1.z - P0.z) * e); pose.rotation.x = P0.rx + (P1.rx - P0.rx) * e; };
    if (thumb) { pose.position.set(0, .72, 0); pose.rotation.set(-.06, 0, 0); } else applyPose(H.k);
    // async texture drawing
    const flipState = { face: 0, target: 0 };
    const loadP = (async () => {
      try {
        const fc = await CA.faceCanvas(spec, { px: fH, cut: !!par }); const x = face.c.getContext('2d'); x.clearRect(0, 0, fW, fH); x.drawImage(fc, 0, 0, fW, fH); face.t.needsUpdate = true;
        if (par) { const lc = await CA.layerCanvases(spec, par.lay.bg.c.width); ['bg', 'mid', 'fg'].forEach(k => { const cx = par.lay[k].c.getContext('2d'); cx.clearRect(0, 0, par.lay[k].c.width, par.lay[k].c.height); cx.drawImage(lc.layers[k], 0, 0, par.lay[k].c.width, par.lay[k].c.height); par.lay[k].t.needsUpdate = true; }); }
      } catch (e) { console.warn('[card textures]', e); }
      if (ctx.view) ctx.view.dirty = true;
    })();
    const inst = { root, frame: thumb ? { r: .62, h: 1.46 + (lvl >= 2 ? .3 : 0) } : { r: .82, h: eligible ? 1.9 : 1.62 + (lvl >= 2 ? .34 : 0) }, float: 0, loadP, disposed: false, cueT: 0, cueCol: new THREE.Color(0), cueStr: 0,
      rest: { yaw: thumb ? -.32 : -.18, pitch: 0 } };
    inst.mode = () => (H.k > .5 ? 'card' : 'holo');
    inst.setMode = m => { H.manual = m; if (ctx.view) ctx.view.dirty = true; };
    inst.setFace = (f, animate) => { flipState.target = f === 'back' ? 1 : 0; if (!animate) flipState.face = flipState.target; if (ctx.view) ctx.view.dirty = true; };
    inst.cue = (col, str) => { inst.cueCol.set(col || '#000000'); inst.cueStr = str || 0; if (ctx.view) ctx.view.dirty = true; };
    inst.dispose = () => { inst.disposed = true; if (H.built && H.built.group) H.built.group.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); };
    inst.update = (dt, t, stt, view) => {
      const calm = ctx.reduced, vw = view || ctx.view;
      // flip (pack reveals)
      if (flipState.face !== flipState.target) { flipState.face += Math.sign(flipState.target - flipState.face) * Math.min(Math.abs(flipState.target - flipState.face), dt * (calm ? 99 : 2.6)); if (vw) vw.dirty = true; }
      const fe = flipState.face, fk = fe * fe * (3 - 2 * fe); flipG.rotation.y = fk * Math.PI; flipG.position.y = Math.sin(fk * Math.PI) * .12;
      // anticipation cue: a coloured glint along the edge (restrained; the strength comes from the opening sequence)
      edgeM.emissive.copy(inst.cueCol).multiplyScalar(inst.cueStr * (calm ? 1 : .75 + .25 * Math.sin(t * 6)));
      if (foil && vw) { const p = vw.st.pointer; foil.uniforms.uTilt.value.set(p.x, p.y); }
      if (thumb || !eligible) { if (living && par) par.uni.uAnim.value = 1; return; }
      // hologram state: dragging → card; idle past the auto-return delay → projection (unless the player chose a mode)
      const ret = st.holoReturn == null ? 4 : st.holoReturn, dragging = vw && vw.rot.dragging, idle = stt ? stt.idle : 99;
      let want = H.manual === 'card' ? 1 : H.manual === 'holo' ? 0 : (dragging || (ret === 0 ? H.want === 1 : idle < ret)) ? 1 : 0;
      if (fe > .01) want = 1; // a card shown by its back is a physical card
      H.want = want; const sp = calm ? 99 : (want ? 3.2 : 1.6);
      if (Math.abs(H.k - want) > .001) { H.k += Math.sign(want - H.k) * Math.min(Math.abs(want - H.k), dt * sp); applyPose(H.k); if (vw) vw.dirty = true; }
      if (H.k < .99) ensureHolo();
      const op = clamp(1 - H.k * 2.2, 0, 1); H.op = op; beamM.opacity = op * .22;
      H.group.visible = op > .01; H.mats.forEach(m => { m.uniforms.uOp.value = op; m.uniforms.uTime.value = t; m.uniforms.uY0.value = H.group.position.y + root.position.y; m.uniforms.uY1.value = H.group.position.y + 1; });
      if (H.built && H.group.visible) {
        const b = H.built, g = b.group, p = vw ? vw.st.pointer : { x: 0, y: 0 }, a = calm ? 0 : 1;
        g.scale.y = (iid ? 1 : 1) * (.25 + .75 * op);
        // each subject class projects differently
        if (cls === 'creature') { g.rotation.y += ((p.x * .9) - g.rotation.y) * Math.min(1, dt * 3) * a; g.position.y = Math.sin(t * 1.4) * .02 * a; }
        else if (cls === 'being') { g.rotation.y = t * .25 * a + p.x * .3; }
        else if (cls === 'machine') { g.rotation.y = t * .6 * a; }
        else if (cls === 'relic') { g.rotation.y = t * .35 * a; g.position.y = Math.sin(t * .9) * .03 * a; }
        else if (cls === 'oddity') { const burst = a && Math.sin(t * 2.3) > .93; g.position.x = burst ? (Math.random() - .5) * .04 : 0; H.mats.forEach(m => (m.uniforms.uOp.value = op * (burst ? .4 + Math.random() * .6 : 1))); g.rotation.y = t * .4 * a; }
        else { g.rotation.y = Math.sin(t * .3) * .5 * a + p.x * .2; }
        if (b.slices) b.slices.forEach(s => { s.position.z = (s.userData.slice - 2) * (.05 + (1 - op) * .2 + (a ? Math.sin(t * .8) * .012 : 0)); });
        if (b.inst && b.inst.update) { try { b.inst.update(dt, t, stt, vw); } catch (e) { /* hologram copies of models must never break the card */ } }
        if (vw) vw.dirty = true;
      }
    };
    inst.react = k => { if (k === 'click' && eligible) { H.manual = H.manual === 'card' || (H.manual === 'auto' && H.k > .5) ? 'holo' : 'card'; if (ctx.view) ctx.view.dirty = true; } };
    if (thumb) inst.rest = { yaw: -.32, pitch: 0 };
    return inst;
  }

  // every card id shares the builder; manifest.js points every card id at this file
  CD.LIST.forEach(it => S.registerModel(it.id, { rest: { yaw: -.18, pitch: 0 }, build: buildCard }));
})();
