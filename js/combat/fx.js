/* AETHERVAULT — Combat effects (Combat B5): pooled projectiles, ground decals, hit flashes, beams, recall columns and wall slabs, on the battle scene.
 * Everything is a fixed-size pool created up front (lazily, once, up to a cap); a frame only moves, scales and recolours existing meshes — no `new`, no array
 * building, no string colours in the per-frame path. `stats()` reports how many objects each pool ever made so a test can prove the count stops growing.
 *
 *   const fx = AV.combat.fx.create(scene)         scene = a BattleScene (js/combat/render.js)
 *   fx.begin(); fx.disc(x,z,r,hex,a); fx.ring(...); fx.rect(x1,z1,x2,z2,w,hex,a); fx.sector(x,z,dx,dz,len,half,hex,a); fx.end()   immediate-mode ground decals
 *   fx.proj(i,x,y,z,hex) · fx.endProj(n)          projectile pool (hidden beyond n)
 *   fx.flash(x,y,z,hex,size) · fx.column(x,z,hex) · fx.beam(pts,hex) · fx.telegraph(shape,hex,dur)    short-lived effects
 *   fx.update(dt)                                 advance the short-lived effects (call once per frame)
 * Rendering only: it never reads or writes simulation state. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const THREE = window.THREE; if (!THREE) { AV.combat.fx = { create: () => null }; return; }

  const CAP = { disc: 40, ring: 40, rect: 28, sector: 16, proj: 40, flash: 40, beam: 24, column: 8, slab: 40, tele: 12 };

  class Effects {
    constructor(scene) {
      this.sc = scene; this.root = new THREE.Group(); scene.scene.add(this.root); this.made = {}; this.cur = {}; this.pool = {}; this.sectorGeo = new Map(); this.tmp = new THREE.Color();
      const own = o => scene.own(o), flat = g => { g.rotateX(-Math.PI / 2); return own(g); };
      this.geo = { disc: flat(new THREE.CircleGeometry(1, 40)), ring: flat(new THREE.RingGeometry(0.9, 1, 48)), rect: flat(new THREE.PlaneGeometry(1, 1)), proj: own(new THREE.SphereGeometry(0.13, 10, 8)), flash: own(new THREE.SphereGeometry(1, 12, 8)),
        beam: own(new THREE.BoxGeometry(1, 0.07, 0.07)), column: own(new THREE.CylinderGeometry(0.28, 0.28, 3.4, 14, 1, true)), slab: own(new THREE.BoxGeometry(1, 1, 1)) };
      ['disc', 'ring', 'rect', 'sector', 'proj', 'flash', 'beam', 'column', 'slab'].forEach(k => { this.pool[k] = []; this.cur[k] = 0; this.made[k] = 0; });
      this.slabMat = own(new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.8, metalness: 0.1, envMapIntensity: 0.3 }));
      // short-lived effects live in preallocated slots
      this.fl = Array.from({ length: CAP.flash }, () => ({ on: false, t: 0, life: 0, x: 0, y: 0, z: 0, size: 1, hex: 0xffffff, m: null }));
      this.bm = Array.from({ length: CAP.beam }, () => ({ on: false, t: 0, life: 0, x1: 0, z1: 0, x2: 0, z2: 0, hex: 0xffffff, m: null }));
      this.co = Array.from({ length: CAP.column }, () => ({ on: false, t: 0, life: 0, x: 0, z: 0, hex: 0xffffff, m: null, ring: null }));
      this.te = Array.from({ length: CAP.tele }, () => ({ on: false, t: 0, dur: 0, kind: 0, x: 0, z: 0, r: 0, x2: 0, z2: 0, w: 0, dx: 0, dz: 0, len: 0, half: 0, hex: 0xffffff }));
    }
    /** A pooled mesh of a kind, created on first need (up to the cap). Returns null when the cap is reached. */
    take(kind, make) {
      const p = this.pool[kind], i = this.cur[kind]++; if (i < p.length) return p[i]; if (p.length >= CAP[kind]) return null;
      const m = make(); m.visible = false; this.root.add(m); p.push(m); this.made[kind]++; return m;
    }
    decalMesh(geo) { return () => new THREE.Mesh(geo, this.sc.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }))); }
    // ---------------------------------------------------------------- immediate-mode ground decals
    begin() { for (const k in this.cur) this.cur[k] = 0; }
    place(m, x, z, a, hex) { m.visible = true; m.position.set(x, 0.035, z); m.material.color.setHex(hex); m.material.opacity = a; m.renderOrder = 2; return m; }
    disc(x, z, r, hex, a) { const m = this.take('disc', this.decalMesh(this.geo.disc)); if (!m) return; this.place(m, x, z, a, hex); m.rotation.y = 0; m.scale.set(r, 1, r); }
    ring(x, z, r, hex, a) { const m = this.take('ring', this.decalMesh(this.geo.ring)); if (!m) return; this.place(m, x, z, a, hex); m.rotation.y = 0; m.scale.set(r, 1, r); }
    /** A rectangle from (x1,z1) to (x2,z2) with width w. */
    rect(x1, z1, x2, z2, w, hex, a) { const m = this.take('rect', this.decalMesh(this.geo.rect)); if (!m) return; const dx = x2 - x1, dz = z2 - z1; this.place(m, (x1 + x2) / 2, (z1 + z2) / 2, a, hex); m.rotation.y = -Math.atan2(dz, dx); m.scale.set(Math.hypot(dx, dz) || 0.01, 1, w); }
    /** A fan from (x,z) along (dx,dz), `len` long, ±half radians. */
    sector(x, z, dx, dz, len, half, hex, a) {
      const key = Math.round(half * 1000), m = this.take('sector', () => new THREE.Mesh(this.sc.own(new THREE.CircleGeometry(1, 2)), this.sc.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })))); if (!m) return;
      let g = this.sectorGeo.get(key); if (!g) { g = new THREE.CircleGeometry(1, 28, -half, half * 2); g.rotateX(-Math.PI / 2); this.sc.own(g); this.sectorGeo.set(key, g); }
      if (m.geometry !== g) m.geometry = g; this.place(m, x, z, a, hex); m.rotation.y = -Math.atan2(dz, dx); m.scale.set(len, 1, len);
    }
    end() { for (const k of ['disc', 'ring', 'rect', 'sector']) { const p = this.pool[k]; for (let i = this.cur[k]; i < p.length; i++) p[i].visible = false; } this.slabsEnd(); }
    // ---------------------------------------------------------------- wall slabs (barrier cells)
    slab(cx, cz, hex) { const m = this.take('slab', () => new THREE.Mesh(this.geo.slab, this.slabMat)); if (!m) return; m.visible = true; m.position.set(cx + 0.5, 0.4, cz + 0.5); m.scale.set(0.92, 0.8, 0.92); m.rotation.y = 0; void hex; }
    slabsEnd() { const p = this.pool.slab; for (let i = this.cur.slab; i < p.length; i++) p[i].visible = false; }
    // ---------------------------------------------------------------- projectiles
    proj(i, x, y, z, hex) { const m = this.pool.proj[i] || this.take2('proj', i, () => new THREE.Mesh(this.geo.proj, this.sc.own(new THREE.MeshBasicMaterial({ color: 0xffffff })))); if (!m) return; m.visible = true; m.position.set(x, y, z); m.material.color.setHex(hex); }
    take2(kind, i, make) { const p = this.pool[kind]; while (p.length <= i && p.length < CAP[kind]) { const m = make(); m.visible = false; this.root.add(m); p.push(m); this.made[kind]++; } return p[i] || null; }
    endProj(n) { const p = this.pool.proj; for (let i = n; i < p.length; i++) p[i].visible = false; }
    // ---------------------------------------------------------------- short-lived effects
    flash(x, y, z, hex, size) {
      let s = null; for (let i = 0; i < this.fl.length; i++) if (!this.fl[i].on) { s = this.fl[i]; break; } if (!s) return;
      if (!s.m) { s.m = new THREE.Mesh(this.geo.flash, this.sc.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }))); s.m.visible = false; this.root.add(s.m); this.made.flash++; }
      s.on = true; s.t = 0; s.life = 0.28; s.x = x; s.y = y; s.z = z; s.size = size || 0.4; s.hex = hex; s.m.visible = true; s.m.material.color.setHex(hex);
    }
    beam(pts, hex) { // pts: [{x,z}, …] — one slot per segment
      for (let i = 0; i + 1 < pts.length; i++) {
        let s = null; for (let k = 0; k < this.bm.length; k++) if (!this.bm[k].on) { s = this.bm[k]; break; } if (!s) return;
        if (!s.m) { s.m = new THREE.Mesh(this.geo.beam, this.sc.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }))); s.m.visible = false; this.root.add(s.m); this.made.beam++; }
        s.on = true; s.t = 0; s.life = 0.35; s.x1 = pts[i].x; s.z1 = pts[i].z; s.x2 = pts[i + 1].x; s.z2 = pts[i + 1].z; s.hex = hex; s.m.visible = true; s.m.material.color.setHex(hex);
      }
    }
    /** The recall column: a Pet that fell is drawn up into light. */
    column(x, z, hex, life) {
      let s = null; for (let i = 0; i < this.co.length; i++) if (!this.co[i].on) { s = this.co[i]; break; } if (!s) return;
      if (!s.m) { s.m = new THREE.Mesh(this.geo.column, this.sc.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))); s.m.visible = false; this.root.add(s.m); this.made.column++; }
      s.on = true; s.t = 0; s.life = life || 0.7; s.x = x; s.z = z; s.hex = hex; s.m.visible = true; s.m.material.color.setHex(hex);
    }
    /** Remember an ability's shape for a few frames (a cast telegraph). kind: 0 circle · 1 line · 2 cone. */
    telegraph(sh, hex, dur) {
      let s = null; for (let i = 0; i < this.te.length; i++) if (!this.te[i].on) { s = this.te[i]; break; } if (!s) return;
      s.on = true; s.t = 0; s.dur = dur; s.hex = hex;
      if (sh.t === 'circle') { s.kind = 0; s.x = sh.x; s.z = sh.z; s.r = sh.r; } else if (sh.t === 'line') { s.kind = 1; s.x = sh.x1; s.z = sh.z1; s.x2 = sh.x2; s.z2 = sh.z2; s.w = sh.w; } else if (sh.t === 'cone') { s.kind = 2; s.x = sh.x; s.z = sh.z; s.dx = sh.dx; s.dz = sh.dz; s.len = sh.len; s.half = sh.half; } else if (sh.t === 'chain') { s.kind = 0; s.x = sh.tx; s.z = sh.tz; s.r = sh.r || 1; } else s.on = false;
    }
    /** Draw the running telegraphs (call between begin() and end()). */
    drawTelegraphs() {
      for (let i = 0; i < this.te.length; i++) {
        const s = this.te[i]; if (!s.on) continue; const k = s.t / s.dur, a = 0.16 + 0.34 * k;
        if (s.kind === 0) { this.disc(s.x, s.z, s.r, s.hex, a * 0.7); this.ring(s.x, s.z, s.r * (0.4 + 0.6 * k), s.hex, 0.7); this.ring(s.x, s.z, s.r, s.hex, 0.85); }
        else if (s.kind === 1) this.rect(s.x, s.z, s.x2, s.z2, s.w, s.hex, a);
        else this.sector(s.x, s.z, s.dx, s.dz, s.len, s.half, s.hex, a);
      }
    }
    update(dt) {
      for (let i = 0; i < this.fl.length; i++) { const s = this.fl[i]; if (!s.on) continue; s.t += dt; const k = s.t / s.life; if (k >= 1) { s.on = false; s.m.visible = false; continue; } s.m.position.set(s.x, s.y, s.z); s.m.scale.setScalar(s.size * (0.4 + k * 1.1)); s.m.material.opacity = 0.85 * (1 - k); }
      for (let i = 0; i < this.bm.length; i++) {
        const s = this.bm[i]; if (!s.on) continue; s.t += dt; const k = s.t / s.life; if (k >= 1) { s.on = false; s.m.visible = false; continue; }
        const dx = s.x2 - s.x1, dz = s.z2 - s.z1; s.m.position.set((s.x1 + s.x2) / 2, 0.9, (s.z1 + s.z2) / 2); s.m.scale.set(Math.hypot(dx, dz) || 0.01, 1, 1 + (1 - k) * 2); s.m.rotation.y = -Math.atan2(dz, dx); s.m.material.opacity = 0.9 * (1 - k);
      }
      for (let i = 0; i < this.co.length; i++) { const s = this.co[i]; if (!s.on) continue; s.t += dt; const k = s.t / s.life; if (k >= 1) { s.on = false; s.m.visible = false; continue; } s.m.position.set(s.x, 1.7 + k * 1.2, s.z); s.m.scale.set(1 - k * 0.7, 1, 1 - k * 0.7); s.m.material.opacity = 0.55 * (1 - k * k); }
      for (let i = 0; i < this.te.length; i++) { const s = this.te[i]; if (!s.on) continue; s.t += dt; if (s.t >= s.dur) s.on = false; }
    }
    stats() { const o = {}; for (const k in this.made) o[k] = this.made[k]; return o; }
    dispose() { this.root.removeFromParent(); }
  }
  AV.combat.fx = { create: scene => new Effects(scene), CAP };
})();
