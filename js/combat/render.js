/* AETHERVAULT — Combat: battle scene on the SHARED renderer (AV.stage.renderer()). One scene, fixed 2.5D camera, ground board,
 * many units, three lights, no shadow maps (a contact-shadow decal per unit). Like a stage View it draws into the shared WebGL
 * canvas and copies the viewport into its own 2D canvas, so it sits in the normal DOM stack.
 *   const sc = AV.combat.render.create(host, { arena: { w, h } })  →  sc.addUnit(unit, scale) · sc.start() · sc.dispose()
 * Positions are arena cells (x: 0..w, z: 0..h; z grows toward the player). Rendering reads state; it never owns game logic. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const THREE = window.THREE, S = AV.stage, U = AV.util;
  const R = (AV.combat.render = {});
  if (!THREE || !S || S.failed) { R.create = () => null; return; }

  const q = () => S.q();
  const settings = () => (AV.state && AV.state.get() ? AV.state.get().settings : {});

  class BattleScene {
    constructor(host, o = {}) {
      this.host = host; this.opts = Object.assign({ arena: { w: 12, h: 18 }, pitch: 0.92, fov: 30, margin: 1.06, uncapped: false, label: 'Battle arena' }, o);
      this.arena = this.opts.arena; this.disposed = false; this.units = new Set(); this.t = 0; this.hooks = []; this.fps = { frames: 0, ms: 0, worst: 0, js: 0 };
      this.canvas = document.createElement('canvas'); this.canvas.className = 'battle3d'; this.canvas.setAttribute('role', 'img'); this.canvas.setAttribute('aria-label', this.opts.label);
      host.appendChild(this.canvas); this.c2 = this.canvas.getContext('2d');
      this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(this.opts.fov, 1, 0.5, 120); this.owned = [];
      S.ensureGL(); this.renderer = S.renderer(); this.scene.environment = S.env ? S.env() : null;
      this.buildLights(); this.buildBoard();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    }
    own(o) { this.owned.push(o); return o; }
    buildLights() {
      const hemi = new THREE.HemisphereLight(0xcdd6ff, 0x1b1610, 0.5), key = new THREE.DirectionalLight(0xfff0dc, 2.4), rim = new THREE.DirectionalLight(0x8fe0e6, 1.0);
      const { w, h } = this.arena; key.position.set(w * 0.2 - 4, 14, h * 0.8); key.target.position.set(w / 2, 0, h / 2); rim.position.set(w + 6, 7, -4); this.scene.add(hemi, key, key.target, rim);
    }
    /** Ground: dark stone slab with a faint cell grid and the centre lane/bridge drawn by the arena module (opts.board(ctx2d,w,h,cell)). */
    buildBoard() {
      const { w, h } = this.arena, px = 48, cv = document.createElement('canvas'); cv.width = w * px; cv.height = h * px; const g = cv.getContext('2d');
      g.fillStyle = '#1b1915'; g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = 'rgba(215,180,110,.07)'; g.lineWidth = 1; for (let x = 0; x <= w; x++) { g.beginPath(); g.moveTo(x * px + .5, 0); g.lineTo(x * px + .5, cv.height); g.stroke(); } for (let z = 0; z <= h; z++) { g.beginPath(); g.moveTo(0, z * px + .5); g.lineTo(cv.width, z * px + .5); g.stroke(); }
      if (this.opts.board) this.opts.board(g, w, h, px);
      const tex = this.own(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const geo = this.own(new THREE.PlaneGeometry(w, h)), mat = this.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05, envMapIntensity: 0.5 }));
      const board = new THREE.Mesh(geo, mat); board.rotation.x = -Math.PI / 2; board.position.set(w / 2, 0, h / 2); this.scene.add(board); this.board = board;
      const rim = this.own(new THREE.MeshStandardMaterial({ color: 0x0f0e0c, roughness: 0.7, metalness: 0.2 })), slab = new THREE.Mesh(this.own(new THREE.BoxGeometry(w + 1.2, 0.5, h + 1.2)), rim); slab.position.set(w / 2, -0.26, h / 2); this.scene.add(slab);
    }
    resize() {
      if (this.disposed) return; const b = this.host.getBoundingClientRect(), w = Math.max(2, Math.round(b.width)), h = Math.max(2, Math.round(b.height)), Q = q();
      let px = Math.min(window.devicePixelRatio || 1, Q.dpr); px = Math.min(px, Math.sqrt(Q.maxPx / (w * h)));
      this.w = w; this.h = h; this.px = px; const cw = Math.max(2, Math.round(w * px)), ch = Math.max(2, Math.round(h * px));
      this.canvas.width = cw; this.canvas.height = ch; this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      if (this.renderer) { const gl = S.glCanvas(); if (cw > gl.width || ch > gl.height) this.renderer.setSize(Math.ceil(Math.max(cw, gl.width) / 64) * 64, Math.ceil(Math.max(ch, gl.height) / 64) * 64, false); }
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.frameCamera(); this.dirty = true;
    }
    /** Fixed camera on the player's side: the whole arena fits the viewport at any aspect. */
    frameCamera() {
      const { w, h } = this.arena, pitch = this.opts.pitch, t = Math.tan(this.camera.fov * Math.PI / 360), asp = this.camera.aspect;
      const halfW = w / 2 * this.opts.margin, halfD = (h / 2) * Math.sin(pitch) * this.opts.margin + 1.4 * Math.cos(pitch), tz = h / 2 - (this.opts.lookShift || 0);
      const d = Math.max(halfD / t, halfW / (t * asp)) + h / 2 * Math.cos(pitch) * 0.42;
      this.camDist = d; this.camera.position.set(w / 2, Math.sin(pitch) * d, tz + Math.cos(pitch) * d); this.camera.lookAt(w / 2, 0.4, tz); this.camera.updateMatrixWorld(true);
    }
    /** Add a built unit (see lod.build). scale = world units per model frame radius (default fits a 1-cell footprint). */
    addUnit(unit, o = {}) {
      const g = new THREE.Group(), sc = o.scale || (o.radius || 0.55) / Math.max(0.3, unit.frame.r); unit.root.scale.setScalar(sc); g.add(unit.root);
      const blob = new THREE.Mesh(this.sharedBlob(), this.shadowMat()); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01; blob.scale.setScalar(sc * unit.frame.r * 2.6); g.add(blob);
      g.position.set(o.x || 0, 0, o.z || 0); this.scene.add(g); const h = { unit, group: g, scale: sc, blob }; this.units.add(h); return h;
    }
    removeUnit(h) { this.scene.remove(h.group); this.units.delete(h); h.unit.dispose(); }
    sharedBlob() { return this._blobGeo || (this._blobGeo = this.own(new THREE.PlaneGeometry(1, 1))); }
    shadowMat() { return this._blobMat || (this._blobMat = this.own(new THREE.MeshBasicMaterial({ map: S.lib.shadowTex(), transparent: true, opacity: 0.6, depthWrite: false }))); }
    /** Project an arena point to canvas CSS pixels (HUD/aim helpers). */
    toScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(this.camera); return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h }; }
    /** Pointer → arena cell coordinates on the ground plane (null if the ray misses). */
    pick(clientX, clientY) {
      const b = this.canvas.getBoundingClientRect(), ndc = new THREE.Vector2((clientX - b.left) / b.width * 2 - 1, -((clientY - b.top) / b.height * 2 - 1)), rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, this.camera); const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(); return rc.ray.intersectPlane(pl, hit) ? { x: hit.x, z: hit.z } : null;
    }
    onFrame(fn) { this.hooks.push(fn); }
    // ---------- frame loop (own rAF; shares the renderer with the stage loop, which sleeps while no View is visible)
    start() { if (this.running || this.disposed) return; this.running = true; this.last = performance.now(); this.nextAt = 0; const loop = now => { if (!this.running || this.disposed) return; this.raf = requestAnimationFrame(loop); this.frame(now); }; this.raf = requestAnimationFrame(loop); }
    stop() { this.running = false; cancelAnimationFrame(this.raf); }
    frame(now) {
      const lim = this.opts.uncapped ? 0 : (S.fpsLimit() || q().fps), iv = lim ? 1000 / lim : 0;
      if (iv && now < this.nextAt - 1.5) return; this.nextAt = iv ? (now - this.nextAt > iv * 2 ? now + iv : this.nextAt + iv) : 0;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt; S.lib.timeUniform.value += dt;
      const t0 = performance.now(); this.hooks.forEach(fn => fn(dt, this.t));
      const calm = !!settings().reducedMotion; this.units.forEach(h => h.unit.update(dt, calm ? 0 : this.t));
      this.render(); const ms = performance.now() - t0, f = this.fps; f.frames++; f.js += ms; f.worst = Math.max(f.worst, ms);
      if (this.lastFrameAt) { const d = now - this.lastFrameAt; f.ms += d; f.dmax = Math.max(f.dmax || 0, d); (f.ds = f.ds || []).push(d); } this.lastFrameAt = now;
    }
    render() {
      const r = this.renderer, cw = this.canvas.width, ch = this.canvas.height; if (!r) return;
      r.info.reset(); r.setViewport(0, 0, cw, ch); r.setScissor(0, 0, cw, ch); r.setScissorTest(true); r.shadowMap.enabled = false; r.clear();
      r.render(this.scene, this.camera); const gl = S.glCanvas(); this.c2.clearRect(0, 0, cw, ch); this.c2.drawImage(gl, 0, gl.height - ch, cw, ch, 0, 0, cw, ch);
      this.info = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    }
    resetStats() { this.fps = { frames: 0, ms: 0, worst: 0, js: 0 }; this.lastFrameAt = 0; }
    summary() {
      const f = this.fps, ds = (f.ds || []).slice().sort((a, b) => a - b), n = ds.length, avg = n ? ds.reduce((a, b) => a + b, 0) / n : 0, pc = p => (n ? ds[Math.min(n - 1, Math.floor(n * p))] : 0);
      return { frames: f.frames, avgMs: +avg.toFixed(2), avgFps: avg ? +(1000 / avg).toFixed(1) : 0, p95Ms: +pc(0.95).toFixed(1), p99Ms: +pc(0.99).toFixed(1), worstMs: +(f.dmax || 0).toFixed(1), jsMs: f.frames ? +(f.js / f.frames).toFixed(2) : 0, over33: ds.filter(d => d > 33.4).length };
    }
    dispose() {
      if (this.disposed) return; this.disposed = true; this.stop(); if (this.ro) this.ro.disconnect(); Array.from(this.units).forEach(h => this.removeUnit(h));
      this.owned.forEach(o => o.dispose && o.dispose()); this.scene.clear(); this.canvas.remove();
    }
  }
  R.BattleScene = BattleScene;
  R.create = (host, o) => (S.supported() && S.ensureGL() ? new BattleScene(host, o) : null);
})();
