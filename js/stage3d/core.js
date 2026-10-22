/* AETHERVAULT — 3D stage core. One shared WebGL renderer; each View copies its viewport into its own 2D canvas so
 * 3D objects sit inside the normal DOM stack (modals, rituals, panels) and inherit z-order, scrolling and layout.
 * Public API: AV.stage  — supported(), quality(), has(base), view(host, opts), thumbFor(spec), art(spec), hydrate(root), stats(). */
(function () {
  const AV = (window.AV = window.AV || {});
  const THREE = window.THREE, L = AV.stageLib, U = AV.util, D = AV.data;
  const S = (AV.stage = { models: {}, ready: false, failed: !THREE || !L });
  if (S.failed) { S.supported = () => false; S.has = () => false; S.quality = () => 'off'; S.art = () => null; S.hydrate = () => { }; S.stats = () => ({ live: Array.from(views).filter(v => !v.disposed).length,}); S.view = () => null; S.container3d = () => false; S.encodeC = () => ''; S.boot = () => { }; S.registerModel = () => { }; S.encode = () => ''; return; }

  const QUALITY = {
    low:    { dpr: 1,    maxPx: 1.3e6, shadows: false, shadowSize: 0,    physical: false, fps: 30, particles: .4,  tex: 256 },
    medium: { dpr: 1.25, maxPx: 2.8e6, shadows: true,  shadowSize: 1024, physical: true,  fps: 60, particles: .75, tex: 384 },
    high:   { dpr: 2,    maxPx: 5.6e6, shadows: true,  shadowSize: 2048, physical: true,  fps: 60, particles: 1,   tex: 512 },
  };
  const settings = () => (AV.state && AV.state.get() ? AV.state.get().settings : {});
  const reduced = () => !!settings().reducedMotion;
  let glFailed = false, renderer = null, glCanvas = null, glW = 0, glH = 0, envTex = null;

  S.quality = () => { if (glFailed) return 'off'; const q = settings().quality3d || 'medium'; return QUALITY[q] ? q : (q === 'off' ? 'off' : 'medium'); };
  S.q = () => QUALITY[S.quality()] || QUALITY.medium;
  /** FPS limit setting: 0 = automatic (per quality preset), 30, 60, or Infinity (uncapped). */
  S.fpsLimit = () => { const v = settings().fpsLimit; return v === 30 || v === 60 ? v : (v === 'max' ? Infinity : 0); };
  const capOf = v => { const l = S.fpsLimit(); return l === 0 ? v.q.fps : l; };
  S.supported = () => S.quality() !== 'off' && !glFailed;
  // ---- lazy model files (Tier C): see manifest.js. A file is fetched when asked for, or one at a time after Home is up.
  S.lazy = {}; const fileP = {};
  const loadFile = f => fileP[f] || (fileP[f] = new Promise(res => { const s = document.createElement('script'); s.src = f; s.async = false; s.onload = () => { if (AV.bus) AV.bus.emit('models', f); res(true); }; s.onerror = () => { console.warn('[stage] model file failed to load', f); res(false); }; document.head.appendChild(s); }));
  S.known = key => !!S.models[key] || !!S.lazy[key];
  S.ensure = keys => Promise.all([...new Set([].concat(keys).map(k => (S.models[k] ? null : S.lazy[k])).filter(Boolean))].map(loadFile));
  S.ensureAll = async () => { for (const f of new Set(Object.values(S.lazy))) { await loadFile(f); await new Promise(r => setTimeout(r, 30)); } };
  S.loadedFiles = () => Object.keys(fileP);
  /** true only when the model is registered; asking for a not-yet-loaded model starts loading it (callers fall back to the 2D art meanwhile). */
  S.has = key => { if (S.models[key]) return true; if (S.lazy[key]) S.ensure([key]); return false; };
  S.container3d = kind => S.supported() && !!S.models['container:' + kind];
  S.registerModel = (key, def) => { S.models[key] = def; };

  // ------------------------------------------------------------------ renderer
  function ensureGL() {
    if (renderer || glFailed) return !!renderer;
    try {
      glCanvas = document.createElement('canvas');
      renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.info.autoReset = false;
      glCanvas.addEventListener('webglcontextlost', e => { e.preventDefault(); glFailed = true; S.disposeAll(); if (AV.ui && AV.ui.refresh) setTimeout(() => AV.ui.refresh(), 50); console.warn('[stage] WebGL context lost — falling back to 2D art'); });
      resizeGL(1024, 1024); // pre-size so the first big views don't reallocate the drawing buffer mid-interaction
      envTex = buildEnv();
      return true;
    } catch (e) { console.warn('[stage] WebGL unavailable', e); glFailed = true; renderer = null; return false; }
  }
  function resizeGL(w, h) { if (w <= glW && h <= glH) return; glW = Math.max(glW, Math.ceil(w / 64) * 64); glH = Math.max(glH, Math.ceil(h / 64) * 64); renderer.setSize(glW, glH, false); }

  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer), sc = new THREE.Scene();
    sc.add(new THREE.Mesh(new THREE.BoxGeometry(24, 14, 24), new THREE.MeshBasicMaterial({ color: 0x15120f, side: THREE.BackSide })));
    const panel = (w, h, col, k, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); sc.add(m); };
    panel(7, 4.5, 0xfff0dc, 11, [-6, 6.5, 5]);   // key softbox (warm)
    panel(2.2, 9, 0x9fe8ee, 6, [9, 2, -4]);      // spectral strip
    panel(14, 14, 0xffffff, 1.4, [0, 10.5, 0]);  // ceiling bounce
    panel(3.5, 2.2, 0xffc890, 4.5, [5, 3, 9]);   // warm fill
    panel(14, 1.4, 0x8b96aa, 1.1, [0, -0.5, -10]); // back horizon
    panel(2, 6, 0xffffff, 3, [-10, 1.5, -2]);    // left kicker
    const tex = pm.fromScene(sc, 0.025).texture; pm.dispose();
    sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return tex;
  }

  // ------------------------------------------------------------------ geometry cache
  const geoCache = new Map();
  S.geo = (key, fn) => { let g = geoCache.get(key); if (!g) { g = fn(); g.userData.shared = true; geoCache.set(key, g); if (geoCache.size > 90) { const k = geoCache.keys().next().value; const old = geoCache.get(k); geoCache.delete(k); old.userData.shared = false; old.dispose(); } } return g; };

  // ------------------------------------------------------------------ staging: plinth, rigs
  // pedestal accent by rarity tier: ring brightness, number of rarity-coloured index marks, strength of the light pool on the top
  const PED_ACCENT = [
    { ring: .3, marks: 0, pool: 0 }, { ring: .5, marks: 4, pool: .06 }, { ring: .75, marks: 8, pool: .1 }, { ring: .95, marks: 12, pool: .14 },
    { ring: 1.05, marks: 12, pool: .18 }, { ring: 1.15, marks: 24, pool: .24 }, { ring: 1.2, marks: 24, pool: .28 }, { ring: 1, marks: 12, pool: .22 }];
  // atmosphere behind the specimen by tier: share of the quality's particle budget (common: none)
  const MOTE_SHARE = [0, .15, .3, .55, .75, .9, 1, .9];
  function buildPlinth(R, lines, tier, rc, q) {
    const g = new THREE.Group(), h = R * .3, disp = [];
    const stone = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: .62, metalness: .1, envMapIntensity: .8 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xb48d4c, roughness: .34, metalness: 1, envMapIntensity: 1.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0f0e0c, roughness: .8, metalness: 0 });
    disp.push(stone, brass, dark);
    const prof = [[0, -h], [R * 1.12, -h], [R * 1.12, -h * .86], [R * 1.04, -h * .8], [R * 1.04, -h * .4], [R * .98, -h * .34], [R * .98, -h * .12], [R * 1.03, -h * .07], [R * 1.03, 0], [0, 0]];
    const body = new THREE.Mesh(L.lathe(prof, 64), stone); body.receiveShadow = true; g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * .9, R * .012, 8, 96), brass); ring.rotation.x = Math.PI / 2; ring.position.y = 0.004; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R * 1.045, R * .008, 8, 96), brass); ring2.rotation.x = Math.PI / 2; ring2.position.y = -h * .06; g.add(ring2);
    const band = new THREE.Mesh(L.lathe([[R * 1.045, -h * .72], [R * 1.05, -h * .72], [R * 1.05, -h * .5], [R * 1.045, -h * .5]], 64), brass); g.add(band);
    // tick marks around the top rim
    const tg = new THREE.BoxGeometry(R * .012, R * .004, R * .06); disp.push(tg);
    const ticks = new THREE.InstancedMesh(tg, brass, 72);
    const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, rr = R * .96; e.set(0, -a, 0); qn.setFromEuler(e); m.compose(new THREE.Vector3(Math.sin(a) * rr, 0.003, Math.cos(a) * rr), qn, new THREE.Vector3(1, 1, i % 6 === 0 ? 1.6 : 1)); ticks.setMatrixAt(i, m); }
    g.add(ticks);
    // rarity accent, integrated into the pedestal (never a floating ring): illuminated inner ring, rarity-coloured index marks, a soft pool of light on the top
    const PA = PED_ACCENT[tier] || PED_ACCENT[0], col = new THREE.Color(rc), fx = { tier, ring: PA.ring, pool: PA.pool, ringMat: null, poolMat: null, marks: null, markCol: col };
    fx.ringMat = new THREE.MeshBasicMaterial({ color: col.clone(), transparent: true, opacity: Math.min(1, PA.ring * .8), blending: THREE.AdditiveBlending, depthWrite: false }); disp.push(fx.ringMat);
    const gr = new THREE.Mesh(new THREE.TorusGeometry(R * .82, R * .008, 6, 96), fx.ringMat); gr.rotation.x = Math.PI / 2; gr.position.y = 0.006; g.add(gr);
    if (PA.marks) {
      const mg = new THREE.BoxGeometry(R * .018, R * .006, R * .075); disp.push(mg);
      const mm = new THREE.MeshBasicMaterial({ color: 0xffffff }); disp.push(mm);
      const marks = new THREE.InstancedMesh(mg, mm, PA.marks), c0 = col.clone().multiplyScalar(Math.min(1, .5 + PA.ring * .4));
      for (let i = 0; i < PA.marks; i++) { const a = Math.round(i * 72 / PA.marks) / 72 * Math.PI * 2, rr = R * .96; e.set(0, -a, 0); qn.setFromEuler(e); m.compose(new THREE.Vector3(Math.sin(a) * rr, 0.008, Math.cos(a) * rr), qn, new THREE.Vector3(1, 1, 1)); marks.setMatrixAt(i, m); marks.setColorAt(i, c0); }
      g.add(marks); fx.marks = marks; fx.c0 = c0;
    }
    if (PA.pool) {
      fx.poolMat = new THREE.MeshBasicMaterial({ map: L.glowTex(), color: col.clone(), transparent: true, opacity: PA.pool, blending: THREE.AdditiveBlending, depthWrite: false }); disp.push(fx.poolMat);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fx.poolMat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.005; pool.scale.set(R * 1.9, R * 1.9, 1); pool.userData.noSil = true; g.add(pool);
    }
    let plate = null;
    if (lines) {
      const tex = L.plateTexture(lines, 1024, 256); disp.push(tex);
      const pm = new THREE.MeshStandardMaterial({ map: tex, roughness: .42, metalness: .75, envMapIntensity: 1 }); disp.push(pm);
      const pg = L.roundedBox(R * 1.15, h * .62, R * .035, R * .012, 2); disp.push(pg);
      plate = new THREE.Mesh(pg, pm); plate.position.set(0, -h * .5, R * 1.1); plate.rotation.x = -.38; g.add(plate);
      const bolts = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    return { group: g, height: h, fx, dispose() { disp.forEach(d => d.dispose && d.dispose()); g.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); } };
  }

  // ------------------------------------------------------------------ View
  const views = new Set();
  let topLayer = 0;
  const hex = c => new THREE.Color(c);

  class View {
    constructor(host, o = {}) {
      this.opts = Object.assign({ mode: 'display', interactive: true, zoom: false, plinth: true, layer: 0, fov: 30, margin: 1.28, pitch: 0.16, bob: true, motes: true, live: true, cameraYOffset: 0, label: '' }, o);
      this.host = host; this.q = S.q(); this.disposed = false; this.dirty = true; this.visible = true; this.lastRender = 0; this.lastTick = 0; this.nextAt = 0;
      // detached views (thumbnails, warm-up) are driven by hand: not in the frame loop, no observers
      this.detached = this.opts.mode === 'thumb' || !!this.opts.detached;
      // thumbnails skip shadow maps: fewer shader variants and no extra depth pass (a contact-shadow decal is used instead)
      this.shadows = this.q.shadows && this.opts.mode !== 'thumb';
      this.ready = false; this.readyP = Promise.resolve(); this._tok = 0;
      this.canvas = document.createElement('canvas'); this.canvas.className = 'stage3d' + (this.opts.interactive ? ' is-interactive' : '');
      this.canvas.setAttribute('role', 'img'); this.canvas.setAttribute('aria-label', this.opts.label || '3D view');
      if (this.opts.interactive) { this.canvas.tabIndex = 0; this.canvas.style.touchAction = this.opts.zoom || this.opts.mode === 'ritual' ? 'none' : 'pan-y'; }
      host.appendChild(this.canvas); this.c2 = this.canvas.getContext('2d');
      this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(this.opts.fov, 1, .05, 80);
      this.pivot = new THREE.Group(); this.scene.add(this.pivot); this.stageGroup = new THREE.Group(); this.scene.add(this.stageGroup);
      this.rot = { yaw: 0, pitch: 0, vy: 0, vp: 0, dragging: false, idle: 99 }; this.zoom = 1; this.zoomT = 1;
      this.st = { pointer: { x: 0, y: 0 }, hover: false, t: 0, reduced: reduced(), idle: 0, lastInput: 0, tier: 0 };
      this.intro = null; this.models = []; this.inst = null; this.plinth = null; this.rig = null; this.layer = this.opts.layer;
      this.w = 0; this.h = 0; this.px = 1;
      this.t0 = performance.now(); this.silhouette = false;
      if (!this.detached) {
        this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
        this.io = new IntersectionObserver(es => { this.visible = es[es.length - 1].isIntersecting; if (this.visible) this.dirty = true; }); this.io.observe(host);
      }
      if (this.opts.interactive) this.bindInput();
      if (this.opts.trackWindow) {
        this._wm = e => { const b = this.canvas.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height * .4; this.st.pointer.x = U.clamp((e.clientX - cx) / (window.innerWidth * .5), -1, 1); this.st.pointer.y = U.clamp((e.clientY - cy) / (window.innerHeight * .5), -1, 1); this.st.hover = true; this.st.lastInput = performance.now(); this.dirty = true; };
        this._wk = () => { this.st.lastInput = performance.now(); };
        window.addEventListener('pointermove', this._wm, { passive: true }); window.addEventListener('keydown', this._wk);
      }
      if (!this.detached) views.add(this);
      this.resize();
    }
    // ---------- input
    bindInput() {
      const c = this.canvas, r = this.rot; let sx = 0, sy = 0, moved = 0, t0 = 0, pid = null; const pts = new Map(); let pinch0 = 0, z0 = 1;
      c.addEventListener('pointerdown', e => {
        pts.set(e.pointerId, [e.clientX, e.clientY]); c.setPointerCapture(e.pointerId); this.touch();
        if (pts.size === 1) { r.dragging = true; sx = e.clientX; sy = e.clientY; moved = 0; t0 = performance.now(); r.vy = 0; r.vp = 0; pid = e.pointerId; c.classList.add('is-drag'); }
        else if (pts.size === 2 && this.opts.zoom) { const a = [...pts.values()]; pinch0 = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); z0 = this.zoomT; }
      });
      c.addEventListener('pointermove', e => {
        const b = c.getBoundingClientRect(); this.st.pointer.x = (e.clientX - b.left) / b.width * 2 - 1; this.st.pointer.y = (e.clientY - b.top) / b.height * 2 - 1; this.st.hover = true; this.dirty = true;
        if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2 && this.opts.zoom) { const a = [...pts.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); this.zoomT = U.clamp(z0 * pinch0 / Math.max(10, d), .55, 1.5); return; }
        if (!r.dragging) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = e.clientX; sy = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
        r.yaw += dx * .0085; r.pitch = U.clamp(r.pitch + dy * .004, -.45, .5); r.vy = dx * .0085; r.vp = dy * .004; this.touch(); if (this.opts.onRotate) this.opts.onRotate(r);
      });
      const up = e => { pts.delete(e.pointerId); if (e.pointerId !== pid) return; this.dragDist = moved; r.dragging = false; c.classList.remove('is-drag'); if (moved < 6 && performance.now() - t0 < 450) this.click(e); };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('pointerleave', () => { if (this.opts.trackWindow) return; this.st.hover = false; this.st.pointer.x = 0; this.st.pointer.y = 0; });
      if (this.opts.zoom) c.addEventListener('wheel', e => { e.preventDefault(); this.zoomT = U.clamp(this.zoomT * (e.deltaY > 0 ? 1.08 : .92), .55, 1.5); this.touch(); }, { passive: false });
      c.addEventListener('keydown', e => {
        const k = e.key; let used = true;
        if (k === 'ArrowLeft') r.yaw -= .18; else if (k === 'ArrowRight') r.yaw += .18; else if (k === 'ArrowUp') r.pitch = U.clamp(r.pitch - .1, -.45, .5); else if (k === 'ArrowDown') r.pitch = U.clamp(r.pitch + .1, -.45, .5);
        else if (k === '+' || k === '=') this.zoomT = U.clamp(this.zoomT * .9, .55, 1.5); else if (k === '-') this.zoomT = U.clamp(this.zoomT * 1.1, .55, 1.5); else if (k === 'Enter' || k === ' ') this.click(e); else used = false;
        if (used) { e.preventDefault(); this.touch(); }
      });
    }
    touch() { this.rot.idle = 0; this.st.lastInput = performance.now(); this.dirty = true; }
    click(e) { if (this.inst && this.inst.react) this.inst.react('click', e); if (this.opts.onClick) this.opts.onClick(e); this.dirty = true; }
    react(kind, arg) { if (this.inst && this.inst.react) this.inst.react(kind, arg); this.dirty = true; }

    // ---------- sizing / framing
    resize() {
      if (this.disposed) return; const b = this.host.getBoundingClientRect(); const w = Math.max(2, Math.round(b.width)), h = Math.max(2, Math.round(b.height));
      this.q = S.q(); this.shadows = this.q.shadows && this.opts.mode !== 'thumb';
      let px = Math.min(window.devicePixelRatio || 1, this.q.dpr); px = Math.min(px, Math.sqrt(this.q.maxPx / (w * h)));
      if (this.opts.mode === 'thumb') px = 1;
      this.w = w; this.h = h; this.px = px; const cw = Math.max(2, Math.round(w * px)), ch = Math.max(2, Math.round(h * px));
      this.canvas.width = cw; this.canvas.height = ch; this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      ensureGL(); if (renderer) resizeGL(cw, ch);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.fit(); this.dirty = true;
    }
    fit() {
      if (!this.inst) return; const f = this.inst.frame || { r: 1, h: 1 }, o = this.opts;
      const pl = this.plinth ? this.plinth.height : 0, top = f.h, bot = -pl * (this.opts.plate === false ? 1 : 2.1), cy = (top + bot) / 2 + (f.cy || 0) + o.cameraYOffset * (top - bot);
      const half = (top - bot) / 2 * o.margin, hw = Math.max(f.r, this.plinth ? this.plinthR : 0) * o.margin * (o.mode === 'thumb' ? 1 : 1.04);
      const t = Math.tan(this.camera.fov * Math.PI / 360);
      this.fitD = Math.max(half / t, hw / (t * this.camera.aspect)) + f.r * .35; this.fitCY = cy;
    }
    // ---------- content
    setSpec(spec, o = {}) {
      if (this.disposed) return false; this.clearModel(); spec = disp(spec);
      const key = spec.container ? 'container:' + spec.container : spec.base, def = S.models[key];
      if (!def || !ensureGL()) return false;
      this.spec = spec; this.def = def;
      const item = D.ITEMS[spec.base] || null, R = item ? D.RARITY[item.rarity] : null, tier = R ? R.tier : (spec.tier || 0), rc = R ? R.color : (spec.color || '#d7b46e');
      this.st.tier = tier; this.rc = rc;
      const disposables = [], tex = [], q = this.q;
      const F = spec.container ? L.materialFactory(Object.assign({ variant: 'none', pattern: 'plain', seed: 1, palette: 0, condition: 0 }, spec.traits || {}), q, disposables, q.tex) : L.materialFactory(spec, q, disposables, q.tex);
      const ctx = { THREE, L, S, spec, item, rarity: R, tier, rc, F, q, quality: q, rng: U.mulberry32((spec.seed || 1) ^ 0x5bd1e995), geo: S.geo, disposables, tex, mode: this.opts.mode, view: this, reduced: reduced(),
        potentialTier: spec.potential >= 80 ? 2 : spec.potential >= 55 ? 1 : 0, level: spec.level || 0, theme: spec.theme || (item ? item.pal : []) };
      const inst = def.build(ctx); inst.disposables = disposables; inst.tex = tex; inst.ctx = ctx;
      // floating stage rings (upgrade/gimbal/armillary/ripple) crossed in front of the specimen; the rarity now lives on the pedestal. opts.stageRings re-enables them for a reveal.
      if (!this.opts.stageRings) { const rs = []; inst.root.traverse(o => { if (o.userData.stageRing) rs.push(o); }); rs.forEach(o => o.parent && o.parent.remove(o)); }
      if (S.forms && !spec.container) S.forms.apply(ctx, inst);
      const sh = this.shadows;
      inst.root.traverse(m => { if (m.isMesh && !m.userData.noShadow) { m.castShadow = sh && !m.userData.noCast; m.receiveShadow = sh; } });
      this.inst = inst; this.pivot.add(inst.root);
      const sz = (spec.size && !spec.container) ? U.clamp(spec.size, .86, 1.14) : 1; inst.root.scale.multiplyScalar(sz);
      const f = inst.frame; if (f && sz !== 1) { f.r *= sz; f.h *= sz; }
      // staging
      this.stageGroup.clear();
      if (this.opts.plinth && this.opts.mode !== 'thumb') {
        this.plinthR = U.clamp((f.r || 1) * .95, .5, 1.7);
        const lines = this.opts.plate === false ? null : [{ text: (spec.plateTitle || (item ? item.name : spec.name) || '').toUpperCase(), font: '600 74px "Barlow Condensed", sans-serif', spacing: '5px', y: 92 }, { text: spec.plateSub || (spec.serial ? '№ ' + U.pad(spec.serial, 4) + '  ·  ' + (R ? R.name.toUpperCase() : '') : ''), font: '500 52px "IBM Plex Mono", monospace', y: 172, color: '#b5ab92' }];
        const prc = spec.fusion && spec.fusion.tint ? L.mix(rc, spec.fusion.tint, .5) : rc; // a fused specimen's pedestal carries its mutation colour
        this.plinth = buildPlinth(this.plinthR, lines, tier, prc, q); this.stageGroup.add(this.plinth.group);
      } else this.plinth = null;
      // contact shadow
      if (!this.plinth || !this.shadows) { const sm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: L.shadowTex(), transparent: true, opacity: this.plinth ? .55 : .6, depthWrite: false })); sm.rotation.x = -Math.PI / 2; sm.position.y = 0.003; const rr = (f.r || 1) * 2.4; sm.scale.set(rr, rr, 1); sm.userData.noSil = true; this.stageGroup.add(sm); this.shadowMesh = sm; }
      this.buildRig(tier, rc);
      if (this.opts.forge) this.buildForge(rc, spec.level || 0, o.maxLevel != null ? o.maxLevel : 4);
      const rest = inst.rest || def.rest || { yaw: -.5, pitch: 0 }; this.rest = rest; this.rot.yaw = rest.yaw; this.rot.pitch = rest.pitch;
      if (this.opts.restYaw != null) { this.rest = Object.assign({}, rest, { yaw: this.opts.restYaw }); this.rot.yaw = this.opts.restYaw; }
      this.fit(); this.setSilhouette(!!o.silhouette); this.dirty = true;
      if (this.opts.motes && !reduced() && this.opts.mode !== 'thumb') this.buildMotes(tier, rc);
      this.prepare();
      return true;
    }
    /** Compile this view's shader programs off the main thread (KHR_parallel_shader_compile). The frame loop skips the view
     *  until they're ready, so a first-time material never freezes the page; readyP resolves when it's safe to render. */
    prepare() {
      const tok = ++this._tok; this.ready = false;
      const done = () => { if (this._tok === tok && !this.disposed) { this.ready = true; this.dirty = true; } };
      if (!renderer || !renderer.compile) { this.ready = true; this.readyP = Promise.resolve(); return; }
      let p;
      // renderer.compileAsync polls program.isReady() from a timer and throws (uncaught) if a view is disposed mid-compile; poll ourselves, safely.
      try {
        renderer.shadowMap.enabled = this.shadows; const mats = renderer.compile(this.scene, this.camera);
        p = new Promise(res => { const poll = () => { if (this._tok !== tok || this.disposed) return res(); mats.forEach(m => { try { const cp = renderer.properties.get(m).currentProgram; if (!cp || cp.isReady()) mats.delete(m); } catch (e) { mats.delete(m); } }); if (!mats.size) res(); else setTimeout(poll, 10); }; poll(); });
      } catch (e) { p = Promise.resolve(); }
      this.readyP = Promise.race([p, new Promise(r => setTimeout(r, 2500))]).catch(() => { }).then(done);
    }
    clearModel() {
      this._tok++; this.ready = false;
      if (this.inst) {
        this.pivot.remove(this.inst.root);
        try { this.inst.dispose && this.inst.dispose(); } catch (e) { console.warn(e); }
        this.inst.root.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
        this.inst.root.traverse(o => { const mm = o.material; if (mm) (Array.isArray(mm) ? mm : [mm]).forEach(x => x.dispose && x.dispose()); });
        (this.inst.disposables || []).forEach(m => m.dispose && m.dispose()); (this.inst.tex || []).forEach(t => t.dispose && t.dispose());
        this.inst = null;
      }
      if (this.plinth) { this.plinth.dispose(); this.plinth = null; }
      this.stageGroup.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); const mm = o.material; if (mm) (Array.isArray(mm) ? mm : [mm]).forEach(x => x.dispose && x.dispose()); });
      this.stageGroup.clear(); this.forge = null;
      if (this.rig) { this.rig.all.forEach(l => { this.scene.remove(l); if (l.target) this.scene.remove(l.target); if (l.shadow && l.shadow.map) l.shadow.map.dispose(); }); this.rig = null; }
      if (this.motes) { this.scene.remove(this.motes.points); this.motes.points.geometry.dispose(); this.motes.points.material.dispose(); this.motes = null; }
      if (this.shafts) { this.shafts.forEach(s => { this.scene.remove(s); s.geometry.dispose(); s.material.dispose(); }); this.shafts = null; }
      this.scene.overrideMaterial = null;
    }
    setSilhouette(on) {
      this.silhouette = on; if (!this.inst) return;
      this.scene.overrideMaterial = on ? (this.silMat || (this.silMat = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: .55, metalness: 0, envMapIntensity: 0 }))) : null;
      if (this.shafts) this.shafts.forEach(s => (s.visible = !on)); if (this.motes) this.motes.points.visible = !on;
      this.inst.root.traverse(o => { if (o.userData && o.userData.noSil) o.visible = !on; });
      this.stageGroup.traverse(o => { if (o !== this.stageGroup) o.visible = !on; }); this.dirty = true;
    }
    buildRig(tier, rc) {
      const q = this.q, sc = this.scene, all = [];
      sc.environment = envTex; const R = (this.inst.frame && this.inst.frame.r) || 1;
      const hemi = new THREE.HemisphereLight(0xcdd6ff, 0x1b1610, .38); all.push(hemi);
      const key = new THREE.DirectionalLight(0xfff0dc, 2.7); key.position.set(-3.4 * R, 5.2 * R + 1, 4.2 * R); key.target.position.set(0, 0, 0); all.push(key); sc.add(key.target);
      if (this.shadows) { key.castShadow = true; key.shadow.mapSize.set(q.shadowSize, q.shadowSize); const s = Math.max(R, this.plinthR || 0) * 2.1; Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: .5, far: 30 + R * 6 }); key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -.0005; key.shadow.normalBias = .03; key.shadow.radius = 5; }
      const rim = new THREE.DirectionalLight(0x8fe0e6, 1.5); rim.position.set(4.2 * R, 2.6 * R, -4.4 * R); all.push(rim);
      const fill = new THREE.DirectionalLight(0xffe2c4, .55); fill.position.set(4 * R, 1.2 * R, 5 * R); all.push(fill);
      let rim2 = null, spot = null;
      // rim2 always exists (dark below tier 2) so every view has the same light count and shares compiled shader programs
      // soft rarity rim from behind and low; the neutral key/fill still carry the model's own colours
      rim2 = new THREE.DirectionalLight(rc, tier >= 1 ? Math.min(1.5, .2 + tier * .2) : 0); rim2.position.set(-4.4 * R, 1.6 * R, -3.2 * R); all.push(rim2);
      if (tier >= 4 && this.opts.mode !== 'thumb') { spot = new THREE.SpotLight(new THREE.Color(rc).lerp(new THREE.Color(0xffffff), .55), 22 * R, 40, .42, .6, 1.4); spot.position.set(0, 7 * R, 2 * R); spot.target.position.set(0, R * .4, 0); all.push(spot); sc.add(spot.target); }
      all.forEach(l => sc.add(l)); this.rig = { all, hemi, key, rim, rim2, spot, fill, baseRim2: rim2 ? rim2.intensity : 0 };
      if (tier >= 4 && this.opts.mode !== 'thumb' && !reduced()) { // soft light shafts
        const m = new THREE.MeshBasicMaterial({ map: L.shaftTex(), color: new THREE.Color(rc), transparent: true, opacity: tier >= 6 ? .22 : .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        this.shafts = [0, 1].map(i => { const p = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.8, R * 5), m.clone()); p.position.set(0, R * 2.2, -R * .6); p.rotation.y = i * Math.PI / 2 + .3; p.userData.noSil = true; this.scene.add(p); return p; });
        m.dispose();
      }
    }
    buildMotes(tier, rc) {
      const n = Math.round((this.opts.moteCount || 26) * this.q.particles * (MOTE_SHARE[tier] || 0)); if (n < 4) return;
      const f = this.inst.frame, pos = new Float32Array(n * 3), seed = new Float32Array(n);
      // only in the back half of the stage so nothing drifts across the front of the specimen
      for (let i = 0; i < n; i++) { const a = Math.PI + .2 + Math.random() * (Math.PI - .4), r = (f.r * 1.1) * (.5 + Math.random() * .9); pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * f.h * 1.3; pos[i * 3 + 2] = Math.sin(a) * r; seed[i] = Math.random() * 10; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const tint = this.opts.moteColor || (tier >= 2 ? rc : '#e8d6a8');
      const m = new THREE.PointsMaterial({ map: L.dotTex(), color: new THREE.Color(tint), size: Math.max(.03, f.r * .045), transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
      const pts = new THREE.Points(g, m); pts.userData.noSil = true; this.scene.add(pts); this.motes = { points: pts, seed, base: pos.slice(), h: f.h };
    }
    /** Pedestal accent animation, driven by the existing frame loop. Low: static. Medium: gentle intensity breathing. High: wider breathing, and a travelling glow on the marks from Mythic up. */
    animatePedestal(fx, t) {
      const ql = S.quality(); if (ql === 'low') return;
      const hi = ql === 'high', a = (hi ? .16 : .08) * (fx.tier >= 2 ? 1 : .5), wave = Math.sin(t * 1.6);
      fx.ringMat.opacity = Math.min(1, fx.ring * .8 * (1 + wave * a));
      if (fx.poolMat) fx.poolMat.opacity = fx.pool * (1 + Math.sin(t * 1.6 - .7) * a);
      if (fx.tier === 6) fx.ringMat.color.setHSL((t * .08) % 1, .8, .62);
      else if (fx.tier === 7 && Math.random() < .05) fx.ringMat.color.set(Math.random() < .5 ? '#ff3b5c' : '#00ffd0');
      if (fx.marks && fx.tier >= 5) {
        const n = fx.marks.count, c = this._pc || (this._pc = new THREE.Color());
        for (let i = 0; i < n; i++) { c.copy(fx.c0).multiplyScalar(.45 + .55 * Math.max(0, Math.sin(t * 1.3 - i / n * Math.PI * 6)) * (hi ? 1 : .8)); fx.marks.setColorAt(i, c); }
        fx.marks.instanceColor.needsUpdate = true;
      }
    }
    /** Intro choreography: 'rise' lifts the model into place; 'pop' scales it. */
    playIntro(type = 'rise', dur = 1.1) { this.intro = { type, t: 0, dur }; this.dirty = true; }

    /** Transformation chamber props: two coil pylons, an arch, and one pedestal lamp per upgrade stage. */
    buildForge(rc, level, max) {
      const f = this.inst.frame, R = Math.max(f.r, this.plinthR || 1), g = new THREE.Group(), col = new THREE.Color(rc);
      const steel = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: .45, metalness: .85 }), brass = new THREE.MeshStandardMaterial({ color: 0xb48d4c, roughness: .3, metalness: 1 });
      const coilMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false });
      const H = Math.max(f.h * 1.25, R * 2.6);
      [-1, 1].forEach(sd => {
        const p = new THREE.Mesh(L.lathe([[0, 0], [.18 * R, 0], [.22 * R, .06 * R], [.13 * R, .12 * R], [.13 * R, H], [.19 * R, H + .05 * R], [.19 * R, H + .2 * R], [0, H + .22 * R]], 28), steel); p.position.set(sd * R * 1.95, -(this.plinth ? this.plinth.height : 0), -R * .35); g.add(p);
        for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.19 * R, .018 * R, 6, 28), i % 2 ? brass : coilMat); r.rotation.x = Math.PI / 2; r.position.set(sd * R * 1.95, H * (.14 + i * .12), -R * .35); g.add(r); }
      });
      const arch = new THREE.Mesh(L.tube([[-R * 1.95, H + .2 * R, -R * .35], [-R, H + .75 * R, -R * .35], [0, H + .95 * R, -R * .35], [R, H + .75 * R, -R * .35], [R * 1.95, H + .2 * R, -R * .35]], .035 * R, 40, 8), brass); g.add(arch);
      const lamp = L.sprite('#ffe6bd', R * 1.6, .55); lamp.position.set(0, H + .8 * R, -R * .2); g.add(lamp);
      // one lamp per upgrade stage, set into the pedestal's front arc (replaces the floating rings that crossed the specimen)
      const rings = [], PR = this.plinthR || R, lampG = new THREE.SphereGeometry(PR * .032, 14, 10), collarG = new THREE.CylinderGeometry(PR * .05, PR * .056, PR * .02, 18);
      for (let i = 0; i < 4; i++) {
        const a = (i - 1.5) * .34, x = Math.sin(a) * PR * .9, z = Math.cos(a) * PR * .9;
        const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .15, blending: THREE.AdditiveBlending, depthWrite: false });
        const collar = new THREE.Mesh(collarG, brass); collar.position.set(x, PR * .008, z); g.add(collar);
        const m = new THREE.Mesh(lampG, mat); m.scale.y = .7; m.position.set(x, PR * .024, z); m.userData.noSil = true; g.add(m); rings.push({ m, mat, i });
      }
      this.forge = { g, rings, coilMat, level, max, pulse: null, R }; this.stageGroup.add(g); this.setForgeLevel(level, max);
    }
    setForgeLevel(level, max) {
      const F = this.forge; if (!F) return; F.level = level; F.max = max;
      F.rings.forEach(r => { const lit = r.i < level, unlocked = r.i < max; r.mat.opacity = lit ? 1 : (unlocked ? .22 : .05); r.m.visible = true; });
      F.coilMat.opacity = .18 + level * .16; this.dirty = true;
    }
    igniteRing(i) { if (this.forge) { this.forge.pulse = { i, t: 0 }; this.dirty = true; } }
    resetView() { this.zoomT = 1; this.rot.idle = 9; this.rot.vy = this.rot.vp = 0; this.dirty = true; }

    // ---------- frame
    tick(dt, now) {
      if (this.disposed || !this.inst) return false;
      const st = this.st, r = this.rot; st.t += dt; st.reduced = reduced(); st.idle = (now - st.lastInput) / 1000;
      const animate = !st.reduced && this.opts.live;
      // rotation physics
      const fk = dt * 60; // motion is tuned per 60Hz frame; scale by real elapsed time so it's identical at any refresh rate / frame skip
      if (!r.dragging) { r.yaw += r.vy * fk; r.pitch = U.clamp(r.pitch + r.vp * fk, -.45, .5); r.vy *= Math.pow(.93, fk); r.vp *= Math.pow(.9, fk); if (Math.abs(r.vy) < 1e-5) r.vy = 0; if (Math.abs(r.vp) < 1e-5) r.vp = 0; r.idle += dt; }
      let sway = 0;
      if (!r.dragging && r.idle > (this.opts.restDelay || 1.1)) { const rest = this.rest, k = 1 - Math.pow(.0009, dt); let dy = ((rest.yaw - r.yaw) % (Math.PI * 2)); if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2; r.yaw += dy * (st.reduced ? 1 : k); r.pitch += (rest.pitch - r.pitch) * (st.reduced ? 1 : k); if (Math.abs(dy) > .002 || Math.abs(r.pitch - rest.pitch) > .002) this.dirty = true; if (animate && this.opts.bob) sway = Math.sin(st.t * .45) * .1; }
      this.zoom += (this.zoomT - this.zoom) * (1 - Math.pow(.002, dt));
      this.pivot.rotation.y = r.yaw + sway; this.pivot.rotation.x = r.pitch;
      let bobY = 0; if (animate && this.opts.bob && this.inst.float) bobY = Math.sin(st.t * 1.1) * this.inst.float;
      // intro
      let iy = 0, isc = 1;
      if (this.intro) { const it = this.intro; it.t += dt; const k = Math.min(1, it.t / it.dur), e = 1 - Math.pow(1 - k, 3); if (it.type === 'rise') { iy = (1 - e) * -(this.inst.frame.h * .5); isc = .82 + .18 * e; } else if (it.type === 'pop') { isc = .2 + .8 * (1 + 1.4 * Math.pow(k - 1, 3) + .4 * Math.pow(k - 1, 2) * 0 ); isc = k < 1 ? .25 + .75 * (1 - Math.pow(1 - k, 3)) * (1 + Math.sin(k * 3.14) * .12) : 1; } if (k >= 1) this.intro = null; this.dirty = true; }
      this.pivot.position.y = bobY + iy; this.pivot.scale.setScalar(isc);
      if (this.inst.update) this.inst.update(dt, st.t, st, this);
      // motes
      if (this.motes && animate) { const p = this.motes.points.geometry.attributes.position, b = this.motes.base, sd = this.motes.seed, h = this.motes.h; for (let i = 0; i < sd.length; i++) { const t = st.t * .12 + sd[i]; p.array[i * 3] = b[i * 3] + Math.sin(t * 2 + sd[i]) * .08; p.array[i * 3 + 1] = ((b[i * 3 + 1] + st.t * .06 * (1 + sd[i] * .05)) % (h * 1.3)); p.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(t * 1.7) * .08; } p.needsUpdate = true; this.motes.points.material.opacity = .45 + Math.sin(st.t * .7) * .1; }
      // rig animation
      const rg = this.rig;
      if (rg && animate) {
        if (st.tier === 6 && rg.rim2) rg.rim2.color.setHSL((st.t * .08) % 1, .8, .62);
        if (st.tier === 7 && rg.rim2) { const fl = Math.random() < .06 ? 0 : 1; rg.rim2.intensity = rg.baseRim2 * (.6 + Math.random() * .8) * fl; rg.rim2.color.set(Math.random() < .5 ? '#ff3b5c' : '#00ffd0'); }
        if (rg.spot) { rg.spot.position.x = Math.sin(st.t * .5) * this.inst.frame.r * 3; rg.spot.intensity = (18 + Math.sin(st.t * .8) * 5) * this.inst.frame.r; }
        if (this.shafts) this.shafts.forEach((s, i) => { s.material.opacity = (st.tier >= 6 ? .2 : .14) * (.7 + .3 * Math.sin(st.t * .6 + i)); });
      }
      if (this.plinth && this.plinth.fx && animate) this.animatePedestal(this.plinth.fx, st.t);
      if (this.forge && animate) { const F = this.forge; F.coilMat.opacity = (.18 + F.level * .16) * (.8 + .2 * Math.sin(st.t * 2.2)); if (F.pulse) { F.pulse.t += dt; const r = F.rings[F.pulse.i]; if (r) { r.mat.opacity = 1; r.m.scale.setScalar(1 + Math.max(0, 1 - F.pulse.t * 2) * .8); } if (F.pulse.t > 1) { if (F.rings[F.pulse.i]) F.rings[F.pulse.i].m.scale.setScalar(1); F.pulse = null; } } }
      // camera
      const d = (this.fitD || 4) * this.zoom, el = this.opts.pitch, cy = this.fitCY || 0;
      st.cam = st.cam || { x: 0, y: 0 }; const ck = 1 - Math.pow(.94, fk); st.cam.x += ((animate ? st.pointer.x : 0) * .1 - st.cam.x) * ck; st.cam.y += ((animate ? st.pointer.y : 0) * .05 - st.cam.y) * ck;
      this.camera.position.set(st.cam.x * d * .35, cy + Math.sin(el) * d + st.cam.y * d * .25, Math.cos(el) * d); this.camera.lookAt(0, cy, 0);
      return true;
    }
    render() {
      if (!renderer || this.disposed || !this.inst) return;
      const cw = this.canvas.width, ch = this.canvas.height;
      renderer.setViewport(0, 0, cw, ch); renderer.setScissor(0, 0, cw, ch); renderer.setScissorTest(true);
      renderer.shadowMap.enabled = this.shadows; renderer.clear();
      renderer.render(this.scene, this.camera);
      this.c2.clearRect(0, 0, cw, ch); this.c2.drawImage(glCanvas, 0, glCanvas.height - ch, cw, ch, 0, 0, cw, ch);
      this.dirty = false;
    }
    dispose() {
      if (this.disposed) return; this.disposed = true; views.delete(this); if (this.ro) this.ro.disconnect(); if (this.io) this.io.disconnect(); this.clearModel();
      if (this._wm) { window.removeEventListener('pointermove', this._wm); window.removeEventListener('keydown', this._wk); }
      if (this.silMat) this.silMat.dispose(); this.canvas.remove();
    }
    getPlinthHeight() { return this.plinth ? this.plinth.height : 0; }
  }
  // Setting dirty is how every code path says "draw me"; it also wakes the (sleeping) frame loop.
  Object.defineProperty(View.prototype, 'dirty', { get() { return this._d; }, set(v) { this._d = v; if (v) wake(); } });
  S.View = View;
  S.view = (host, o) => { if (!S.supported() || !ensureGL()) return null; return new View(host, o); };
  S.disposeAll = () => { Array.from(views).forEach(v => v.dispose()); };
  S.rebuildAll = () => { views.forEach(v => { if (v.spec) { const sp = v.spec, s = v.silhouette; v.resize(); v.setSpec(sp, { silhouette: s }); } }); };

  // ------------------------------------------------------------------ loop
  // One rAF loop for every live view. It SLEEPS (no rAF at all) when nothing needs a frame and is woken by anything that sets
  // view.dirty, queues a thumbnail, or by visibility returning. Per-view frame limiter = FPS limit setting / quality preset.
  let last = 0, running = false, loopEnabled = false, idle = 0;
  const perf = { frames: 0, ms: 0, worst: 0, avg: 0, wakes: 0, sleeps: 0 };
  const dyaw = v => { let d = (v.rest.yaw - v.rot.yaw) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  const atRest = v => !v.rest || (Math.abs(dyaw(v)) < .002 && Math.abs(v.rot.pitch - v.rest.pitch) < .002);
  let tmr = 0;
  function wake() { idle = 0; if (!running) { if (loopEnabled && renderer && !document.hidden) startLoop(); } else if (tmr) { clearTimeout(tmr); tmr = 0; requestAnimationFrame(loop); } }
  S.wake = wake;
  function loop(now) {
    if (document.hidden || !renderer) { running = false; perf.sleeps++; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now; L.timeUniform.value += dt;
    topLayer = 0; views.forEach(v => { if (!v.disposed && v.visible && v.host.isConnected) topLayer = Math.max(topLayer, v.layer); });
    const t0 = performance.now(); let n = 0, want = false, reset = false, urgent = false;
    views.forEach(v => {
      if (v.disposed || !v.visible || !v.inst || !v.ready || v.layer < topLayer || !v.host.isConnected) return;
      const rm = reduced(), animate = !rm && v.opts.live, moving = v.intro || v.rot.vy || v.rot.vp || v.rot.dragging;
      if (!animate && !v.dirty && !moving) {
        // reduced motion / still view: draw only on demand, but keep counting the idle delay so it can ease back to its rest pose
        if (v.st.reduced === rm && atRest(v)) return;
        v.rot.idle += dt; if (v.rot.idle > (v.opts.restDelay || 1.1)) v.dirty = true; else { want = true; urgent = true; return; }
      }
      want = true; if (v.dirty || moving || !animate) urgent = true;
      const cap = capOf(v), iv = cap === Infinity ? 0 : 1000 / cap;
      if (iv && now < v.nextAt - 1.5) return;
      v.nextAt = iv ? (now - v.nextAt > iv * 2 ? now + iv : v.nextAt + iv) : 0;
      const vdt = v.lastTick ? Math.min(.05, (now - v.lastTick) / 1000) : dt;
      v.lastRender = v.lastTick = now;
      if (v.tick(vdt, now) !== false) { if (!reset) { renderer.info.reset(); reset = true; } v.render(); n++; }
    });
    S.thumbPump();
    if (n) { const ms = performance.now() - t0; perf.frames++; perf.ms += ms; perf.worst = Math.max(perf.worst * .995, ms); perf.avg = perf.avg * .95 + ms * .05; }
    if (want || queue.length || thumbBusy) idle = 0; else idle++;
    if (idle > 10) { running = false; perf.sleeps++; return; }
    // Steady ambient animation below the display refresh rate: sleep on a timer until the next frame is due instead of waking on every vsync.
    if (want && !urgent && !queue.length && !thumbBusy) { let due = Infinity; views.forEach(v => { if (!v.disposed && v.visible && v.inst && v.ready && v.layer >= topLayer && v.host.isConnected) due = Math.min(due, v.nextAt); }); const wait = due - performance.now() - 5; if (isFinite(due) && wait > 4) { tmr = setTimeout(() => { tmr = 0; requestAnimationFrame(loop); }, wait); return; } }
    requestAnimationFrame(loop);
  }
  function startLoop() { if (running) return; running = true; perf.wakes++; idle = 0; last = performance.now(); requestAnimationFrame(loop); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  // ------------------------------------------------------------------ thumbnails
  // Three cache layers: memory (LRU of blob URLs) → IndexedDB (WebP blobs; survives reloads, keyed by model revision + material tier)
  // → render. Rendering is deferred to the frame loop (one new thumbnail per frame, three in flight) and never blocks navigation.
  S.REV = 'p3-1'; // bump whenever a model, light rig or thumbnail framing changes so persisted thumbnails regenerate
  const thumbs = new Map(), queue = []; let thumbBusy = 0; const THUMB_MAX = 260;
  const disp = s => (s && s.base && s.look && s.look !== 'auto' && AV.progress ? AV.progress.displaySpec(s) : s);
  // Phase Four appends a card's print key and a fused specimen's mutation key only when present, so every older key is unchanged
  const extra = s => { const c = s.card && AV.cards ? AV.cards.key(s.card) : '', f = s.fusion && AV.fusion ? AV.fusion.renderKey(s) : ''; return c || f ? '|' + c + (f ? '|' + f : '') : ''; };
  const encode0 = s => [s.base, s.variant || 'none', s.pattern || 'plain', (s.seed >>> 0), s.palette || 0, s.condition || 0, s.level || 0, Math.round((s.potential || 0) / 20), s.serial || 0, s.container || '', s.form || ''].join('|') + extra(s);
  const encode = s => encode0(disp(s));
  S.encodeC = (kind, theme) => 'C|' + kind + '|' + (theme || []).join(',');
  const decode = k => { const a = k.split('|'); if (a[0] === 'C') return { container: a[1], theme: (a[2] || '').split(','), seed: 7, name: a[1] }; const o = { base: a[0], variant: a[1], pattern: a[2], seed: +a[3], palette: +a[4], condition: +a[5], level: +a[6], potential: +a[7] * 20, serial: +a[8], container: a[9] || undefined, form: a[10] || null }; if (a[11] && AV.cards) o.card = AV.cards.unkey(a[11]); if (a[12] && AV.fusion) AV.fusion.applyRenderKey(o, a[12]); return o; };
  const ckey = k => S.REV + (S.q().physical ? 'P' : 'S') + '|' + k;

  const idb = (() => {
    let dbp = null, sets = 0;
    const open = () => dbp || (dbp = new Promise(res => { try { const rq = indexedDB.open('aethervault-thumbs', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('t'); rq.onsuccess = () => res(rq.result); rq.onerror = rq.onblocked = () => res(null); } catch (e) { res(null); } }));
    const run = async (mode, fn) => { const db = await open(); if (!db) return null; return new Promise(res => { try { const t = db.transaction('t', mode), r = fn(t.objectStore('t')); t.oncomplete = () => res(r && r.result !== undefined ? r.result : true); t.onerror = t.onabort = () => res(null); } catch (e) { res(null); } }); };
    const api = {
      get: k => run('readonly', st => st.get(k)),
      set: (k, v) => { if (++sets % 40 === 0) api.prune(); return run('readwrite', st => st.put(v, k)); },
      /** keep the store bounded: drop the oldest entries once it holds more than ~500 thumbnails */
      prune: async () => { const db = await open(); if (!db) return; try { const t = db.transaction('t', 'readwrite'), st = t.objectStore('t'), all = []; st.openCursor().onsuccess = e => { const c = e.target.result; if (c) { all.push([c.key, (c.value && c.value.t) || 0]); c.continue(); } else if (all.length > 500) { all.sort((a, b) => a[1] - b[1]).slice(0, all.length - 380).forEach(([k]) => st.delete(k)); } }; } catch (e) { /* best effort */ } },
      count: async () => { const r = await run('readonly', st => st.count()); return typeof r === 'number' ? r : 0; },
      clear: () => run('readwrite', st => st.clear()),
    };
    return api;
  })();
  S.thumbCache = idb;
  let thumbHit = 0, thumbDraw = 0;
  S.thumbStats = () => ({ hit: thumbHit, rendered: thumbDraw });

  /** NDC rectangle covered by the model's solid meshes (glows, light shafts and additive layers are ignored). */
  function projectedRect(v) {
    v.pivot.updateMatrixWorld(true); v.camera.updateMatrixWorld(true);
    const mn = [1e9, 1e9], mx = [-1e9, -1e9], p = new THREE.Vector3();
    const walk = o => { // a noSil flag on a group excludes its whole subtree (glow layers, butterflies, light shafts)
      if (o.userData.noSil || !o.visible) return;
      if (o.isMesh && o.geometry) {
        const m = o.material, g = o.geometry;
        if (!(m && !Array.isArray(m) && (m.blending === THREE.AdditiveBlending || m.isShaderMaterial && m.transparent))) { if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox;
          if (b && isFinite(b.min.x)) for (let i = 0; i < 8; i++) { p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld).project(v.camera); if (p.x < mn[0]) mn[0] = p.x; if (p.x > mx[0]) mx[0] = p.x; if (p.y < mn[1]) mn[1] = p.y; if (p.y > mx[1]) mx[1] = p.y; } }
      }
      o.children.forEach(walk);
    };
    walk(v.inst.root);
    return mn[0] > mx[0] ? null : { cx: (mn[0] + mx[0]) / 2, cy: (mn[1] + mx[1]) / 2, hx: (mx[0] - mn[0]) / 2, hy: (mx[1] - mn[1]) / 2 };
  }
  /** Tight, centred framing: every thumbnail fills the same share of its tile whatever the model's aspect (a diagonal sword and a round cloud both fill ~88%). */
  const THUMB_FILL = .9;
  function frameThumb(v, size) {
    const r = projectedRect(v); if (!r || r.hx < 1e-3 || r.hy < 1e-3) return;
    const z = U.clamp(Math.min(THUMB_FILL / r.hx, THUMB_FILL / r.hy), .7, 2.2);
    v.camera.zoom = z; v.camera.setViewOffset(size, size, r.cx * z * size / 2, -r.cy * z * size / 2, size, size); v.camera.updateProjectionMatrix();
  }

  /** Renders one thumbnail without blocking the page: IndexedDB first, otherwise shaders compile off-thread and the image is
   *  encoded asynchronously to a blob. */
  async function renderThumb(spec, size, key) {
    const hit = await idb.get(ckey(key + '#' + size));
    if (hit && hit.blob) { thumbHit++; return URL.createObjectURL(hit.blob); }
    if (!ensureGL()) return null;
    const mk = spec.container ? 'container:' + spec.container : spec.base; await S.ensure([mk]); const def = S.models[mk]; if (!def) return null;
    const host = document.createElement('div'); host.style.cssText = `position:fixed;left:-9999px;top:0;width:${size}px;height:${size}px;`; document.body.appendChild(host);
    let v;
    try {
      v = new View(host, { mode: 'thumb', interactive: false, plinth: false, live: false, motes: false, margin: 1.12, pitch: .12, fov: 28 });
      v.w = v.h = size; v.px = 1; v.canvas.width = v.canvas.height = size; v.camera.aspect = 1; v.camera.updateProjectionMatrix();
      if (!v.setSpec(spec)) return null;
      await v.readyP; if (v.inst && v.inst.loadP) { await v.inst.loadP; v.prepare(); await v.readyP; } if (v.disposed || !v.ready) return null;
      v.st.t = 4.2; v.tick(.016, performance.now()); v.tick(.016, performance.now()); frameThumb(v, size);
      const ex = renderer.toneMappingExposure; renderer.toneMappingExposure = 1.22; v.render(); renderer.toneMappingExposure = ex;
      const blob = await new Promise(res => v.canvas.toBlob(res, 'image/webp', .86)); if (!blob) return null; thumbDraw++;
      idb.set(ckey(key + '#' + size), { blob, t: Date.now() });
      return URL.createObjectURL(blob);
    } catch (e) { console.warn('[thumb]', e); return null; }
    finally { if (v) v.dispose(); host.remove(); }
  }
  /** Returns a Promise<string> blob URL (cached). */
  S.thumbFor = (spec, size = 224) => {
    const k = encode(spec) + '#' + size; let e = thumbs.get(k);
    if (e) { thumbs.delete(k); thumbs.set(k, e); return e.p; }
    e = {}; e.p = new Promise((res, rej) => { e.res = res; e.rej = rej; }); e.key = k; e.spec = spec; e.size = size; e.base = encode(spec); thumbs.set(k, e); queue.push(e);
    while (thumbs.size > THUMB_MAX) { const kk = thumbs.keys().next().value, old = thumbs.get(kk); thumbs.delete(kk); old.p.then(u => setTimeout(() => URL.revokeObjectURL(u), 30000), () => { }); }
    wake(); return e.p;
  };
  // At most one new thumbnail is started per frame (3 in flight) so the synchronous part of each never stacks up in one frame.
  S.thumbPump = () => {
    if (!queue.length || thumbBusy >= 3) return;
    const e = queue.shift(); thumbBusy++;
    renderThumb(e.spec, e.size, e.base).then(url => { if (url) e.res(url); else { e.rej(new Error('thumb')); thumbs.delete(e.key); } })
      .catch(err => { e.rej(err); thumbs.delete(e.key); }).finally(() => { thumbBusy--; wake(); });
  };
  /** Art markup for a specimen / base: a 3D thumbnail placeholder if a model exists, else null (caller falls back to SVG). */
  S.art = (specOrBase, svgInner, opts = {}) => {
    if (!S.supported()) return null;
    const spec = typeof specOrBase === 'string' ? { base: specOrBase, variant: 'none', pattern: 'plain', seed: 1, palette: 0, condition: 0, level: 0, potential: 40, serial: 0 } : specOrBase;
    if (!S.known(disp(spec).base)) return null; return { key: encode(spec), size: opts.size };
  };
  S.hydrate = root => {
    if (!S.supported()) return;
    root.querySelectorAll('[data-t3]:not([data-t3h])').forEach(el => {
      el.setAttribute('data-t3h', '1'); const key = el.getAttribute('data-t3'); const spec = decode(key);
      const sz = el.offsetWidth > 190 ? 384 : el.offsetWidth > 110 ? 256 : 160;
      const t = setTimeout(() => el.classList.remove('is-pending'), 2200);
      S.thumbFor(spec, sz).then(url => { clearTimeout(t); if (!el.isConnected) return; const img = new Image(); img.className = 't3img'; img.alt = ''; img.draggable = false; img.decoding = 'async'; img.onload = () => { el.classList.add('has-3d'); el.classList.remove('is-pending'); }; img.src = url; el.appendChild(img); })
        .catch(() => { clearTimeout(t); el.classList.remove('is-pending'); });
    });
  };

  // ------------------------------------------------------------------ stats / lifecycle
  S.stats = () => ({
    quality: S.quality(), fpsLimit: S.fpsLimit(), views: views.size, queue: queue.length, thumbs: thumbs.size, geoCache: geoCache.size,
    memory: renderer ? Object.assign({}, renderer.info.memory) : null, programs: renderer ? renderer.info.programs.length : 0,
    render: renderer ? { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } : null,
    frames: perf.frames, totalMs: +perf.ms.toFixed(1), frameMs: +perf.avg.toFixed(2), worstMs: +perf.worst.toFixed(2), caches: L.cacheStats(), canvas: [glW, glH],
    loop: { running, wakes: perf.wakes, sleeps: perf.sleeps },
  });
  let lastInputAt = 0;
  const idleGap = () => new Promise(res => {
    const t0 = performance.now();
    const chk = () => {
      if (document.hidden) return setTimeout(chk, 500);
      const quiet = performance.now() - lastInputAt > 700 && !thumbBusy && !queue.length;
      if (quiet || performance.now() - t0 > 4000) (window.requestIdleCallback ? window.requestIdleCallback(() => res(), { timeout: 800 }) : setTimeout(res, 50)); else setTimeout(chk, 250);
    };
    chk();
  });
  const specFor = key => key.startsWith('container:') ? { container: key.slice(10), theme: [], seed: 7, name: key } : { base: key, variant: 'none', pattern: 'plain', seed: 1, palette: 0, condition: 0, level: 0, potential: 40, serial: 1, size: 1 };
  /** Builds a model off-screen exactly as a live view would (same quality, same light rig) so its geometry is cached and its shader
   *  programs are compiled. Resolves { ok, ms }. The geometry/program caches are shared, so the first real view of the same model is instant. */
  S.warm = async spec => {
    if (!S.supported() || !ensureGL()) return { ok: false, ms: 0 };
    const t0 = performance.now(), host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:320px;'; document.body.appendChild(host);
    let v, ok = false;
    try { v = new View(host, { mode: 'display', detached: true, interactive: false, live: false, motes: false }); if (v.setSpec(spec)) { await v.readyP; if (v.ready && !v.disposed) { v.tick(.016, performance.now()); v.render(); ok = true; } } } // one real draw also warms the shadow-depth programs
    catch (e) { /* warm-up is best effort */ } finally { if (v) v.dispose(); host.remove(); }
    return { ok, ms: performance.now() - t0 };
  };
  /** Background warm-up for a SHORT list of likely-next models (Tier B). One model at a time, only while the player is idle. */
  S.prewarm = async keys => {
    if (window.__AV_NO_PREWARM) return;
    for (const key of keys || []) {
      if (!S.supported() || (typeof key === 'string' && !S.models[key])) continue;
      await idleGap(); if (!S.supported()) return;
      await S.warm(typeof key === 'string' ? specFor(key) : key);
      await new Promise(r => setTimeout(r, 120));
    }
  };
  S.specFor = specFor;
  /** Idle-time prefetch of cached thumbnails the player is likely to need next (e.g. the first Vault page). One at a time, only while quiet. */
  S.prefetchThumbs = async (specs, size = 256) => { for (const sp of specs || []) { await idleGap(); if (!S.supported()) return; try { await S.thumbFor(sp, size); } catch (e) { /* ignore */ } } };
  /** Permanently (this session) switch to the 2D artwork: used when WebGL is missing, fails, or the player picks Safe mode. */
  S.fallback2D = why => { glFailed = true; console.warn('[stage] 2D fallback:', why); S.disposeAll(); if (AV.boot && AV.boot.done && AV.ui && AV.ui.refresh) AV.ui.refresh(); };
  S.onSettings = () => { const q = S.quality(); if (q === 'off') { S.disposeAll(); return; } S.rebuildAll(); };
  /** Idempotent. Resolves when fonts are ready, the renderer exists and the frame loop is armed. */
  S.boot = () => {
    if (S.booted) return S.booted;
    S.ready = true;
    if (document.fonts && document.fonts.load) ['600 40px "Barlow Condensed"', '500 40px "IBM Plex Mono"', 'italic 600 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"'].forEach(f => document.fonts.load(f).catch(() => { }));
    const track = () => { lastInputAt = performance.now(); };
    window.addEventListener('pointermove', track, { passive: true }); window.addEventListener('keydown', track); window.addEventListener('pointerdown', track, { passive: true });
    const mo = new MutationObserver(ms => { let any = false; for (const m of ms) { for (const n of m.addedNodes) { if (n.nodeType === 1 && (n.hasAttribute('data-t3') || n.querySelector('[data-t3]'))) { any = true; break; } } if (any) break; } if (any) S.hydrate(document.body); });
    mo.observe(document.body, { childList: true, subtree: true });
    if (AV.bus) AV.bus.on('settings', e => { if (e && /quality3d|reducedMotion/.test(e.key)) { S.onSettings(); if (AV.ui && AV.ui.refresh && !(AV.opening && AV.opening.busy())) setTimeout(() => AV.ui.refresh(), 30); } else if (e && e.key === 'fpsLimit') wake(); });
    S.booted = (S.supported() ? (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()) : Promise.resolve()).then(() => { if (S.supported() && ensureGL()) { loopEnabled = true; startLoop(); } return S.supported(); });
    return S.booted;
  };
  S.lib = L; S.encode = encode; S.decode = decode; S.renderer = () => renderer; S.reducedMotion = reduced; S.env = () => envTex; S.glCanvas = () => glCanvas;
  S.glInfo = () => { if (!renderer) return null; const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), webgl2: renderer.capabilities.isWebGL2, maxTex: renderer.capabilities.maxTextureSize }; };
  S.ensureGL = ensureGL;
})();
