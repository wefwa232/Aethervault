/* AETHERVAULT — 3D library: geometry builders, surface-nets blob skins, procedural textures and the shared trait shader.
 * Everything specimen-specific (pattern, condition, variant) goes through ONE shader patch so every model reacts identically. */
(function () {
  const AV = (window.AV = window.AV || {});
  if (!window.THREE) { AV.stageLib = null; return; }
  const THREE = window.THREE, U = AV.util, D = AV.data;
  const L = {};
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ noise
  const hash = (x, y, z, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(s | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  function vnoise(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(hash(xi, yi, zi, s), hash(xi + 1, yi, zi, s), xf), l(hash(xi, yi + 1, zi, s), hash(xi + 1, yi + 1, zi, s), xf), yf),
      l(l(hash(xi, yi, zi + 1, s), hash(xi + 1, yi, zi + 1, s), xf), l(hash(xi, yi + 1, zi + 1, s), hash(xi + 1, yi + 1, zi + 1, s), xf), yf), zf);
  }
  const fbm3 = (x, y, z, s, o = 3) => { let a = 0, f = 1, w = .5, n = 0; for (let i = 0; i < o; i++) { a += vnoise(x * f, y * f, z * f, s + i * 17) * w; n += w; f *= 2; w *= .5; } return a / n; };
  /** periodic value noise on a P×P lattice (tileable) */
  function pnoise(x, y, P, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const h = (a, b) => hash(((a % P) + P) % P, ((b % P) + P) % P, 0, s);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(h(xi, yi), h(xi + 1, yi), xf), l(h(xi, yi + 1), h(xi + 1, yi + 1), xf), yf);
  }

  // ------------------------------------------------------------------ geometry
  /** Parametric surface; u wraps if closeU. fn(u,v,out) with u,v in [0,1]. */
  L.paramSurface = function (nu, nv, fn, closeU) {
    const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2), idx = [];
    const p = new THREE.Vector3();
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      fn(i / nu, j / nv, p); const k = j * (nu + 1) + i;
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; uv[k * 2] = i / nu; uv[k * 2 + 1] = j / nv;
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    if (closeU) {
      const n = g.attributes.normal;
      for (let j = 0; j <= nv; j++) {
        const a = j * (nu + 1), b = a + nu;
        const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
        n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
      }
    }
    return g;
  };

  L.lathe = (pts, seg = 48, phiStart = 0, phiLen = TAU) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg, phiStart, phiLen);

  /** Rounded box (smooth normals). */
  L.roundedBox = function (w, h, d, r, seg = 4) {
    const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, n = g.attributes.normal;
    const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); c.set(U.clamp(v.x, -hx, hx), U.clamp(v.y, -hy, hy), U.clamp(v.z, -hz, hz));
      const dir = v.sub(c); if (dir.lengthSq() < 1e-9) continue; dir.normalize();
      p.setXYZ(i, c.x + dir.x * r, c.y + dir.y * r, c.z + dir.z * r); n.setXYZ(i, dir.x, dir.y, dir.z);
    }
    return g;
  };

  /** Beveled extrusion of a 2D outline (array of [x,y]); centred on z. holes: array of outlines. */
  L.extrude = function (pts, depth, bevel = 0.02, opts = {}) {
    const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    (opts.holes || []).forEach(h => sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1])))));
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.0001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: opts.bevelSeg || 2, curveSegments: opts.curveSeg || 10 });
    g.translate(0, 0, -(depth - bevel * 2) / 2);
    return g;
  };
  /** Chamfered box = extruded rectangle. */
  L.chamferBox = (w, h, d, c) => L.extrude([[-w / 2 + c, -h / 2 + c], [w / 2 - c, -h / 2 + c], [w / 2 - c, h / 2 - c], [-w / 2 + c, h / 2 - c]], d, c, { bevelSeg: 1 });

  L.tube = (pts, r, seg = 40, radial = 8, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), closed), seg, r, radial, closed);

  /** Jagged lightning bolt outline pointing down; returns outline pts. */
  L.boltOutline = function (len = 1, width = 0.3, kinks = 3, seed = 1) {
    const r = U.mulberry32(seed), l = [], rgt = [];
    let x = 0; const n = kinks + 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n, y = len / 2 - t * len, w = width * (1 - t * .85) * (0.65 + r() * .5);
      if (i > 0 && i < n) x += (r() - .5) * width * 1.5;
      l.push([x - w / 2, y]); rgt.push([x + w / 2, y]);
    }
    return l.concat(rgt.reverse());
  };

  /** Gear outline. */
  L.gearOutline = function (teeth, rIn, rOut, tooth = .55, rake = .18) {
    const pts = [], step = TAU / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * step, k = [0, rake, tooth - rake, tooth].map(t => a + t * step * .5 * 2 * .5);
      const w = step * tooth * .5;
      pts.push([Math.cos(a) * rIn, Math.sin(a) * rIn]);
      pts.push([Math.cos(a + step * .08) * rOut * .98, Math.sin(a + step * .08) * rOut * .98]);
      pts.push([Math.cos(a + step * .08 + w * .5) * rOut, Math.sin(a + step * .08 + w * .5) * rOut]);
      pts.push([Math.cos(a + step * .08 + w) * rOut * .98, Math.sin(a + step * .08 + w) * rOut * .98]);
      pts.push([Math.cos(a + step * .08 + w + step * .12) * rIn, Math.sin(a + step * .08 + w + step * .12) * rIn]);
    }
    return pts;
  };
  L.circlePts = (r, n = 48, rot = 0) => { const p = []; for (let i = 0; i < n; i++) p.push([Math.cos(i / n * TAU + rot) * r, Math.sin(i / n * TAU + rot) * r]); return p; };

  // ------------------------------------------------------------------ blob skin (metaballs → surface nets)
  /** balls: {x,y,z,r,w?,sx?,sy?,sz?}. Returns BufferGeometry with vertex colors (colorFn(p,n,f) → [r,g,b]). */
  L.blobSkin = function (balls, bounds, cells, o = {}) {
    const iso = o.iso != null ? o.iso : 0.35, amp = o.noise || 0, nsc = o.noiseScale || 3, seed = o.seed || 1;
    const bs = balls.map(b => ({ x: b.x, y: b.y, z: b.z, r2: b.r * b.r, w: b.w == null ? 1 : b.w, isx: 1 / (b.sx || 1), isy: 1 / (b.sy || 1), isz: 1 / (b.sz || 1) }));
    const field = (x, y, z) => {
      let f = 0;
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i], dx = (x - b.x) * b.isx, dy = (y - b.y) * b.isy, dz = (z - b.z) * b.isz, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < b.r2) { const t = 1 - d2 / b.r2; f += b.w * t * t * t; }
      }
      if (amp) f += (fbm3(x * nsc, y * nsc, z * nsc, seed, 3) - .5) * amp;
      return f;
    };
    const [nx, ny, nz] = cells, mn = bounds.min, mx = bounds.max;
    const sx = (mx[0] - mn[0]) / nx, sy = (mx[1] - mn[1]) / ny, sz = (mx[2] - mn[2]) / nz;
    const px = nx + 1, py = ny + 1, pz = nz + 1, vals = new Float32Array(px * py * pz);
    const gi = (x, y, z) => x + px * (y + py * z);
    for (let z = 0; z < pz; z++) for (let y = 0; y < py; y++) for (let x = 0; x < px; x++) vals[gi(x, y, z)] = field(mn[0] + x * sx, mn[1] + y * sy, mn[2] + z * sz) - iso;
    const cv = new Int32Array(nx * ny * nz).fill(-1), P = [];
    const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cval = new Float32Array(8);
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      let mask = 0;
      for (let c = 0; c < 8; c++) { const v = vals[gi(x + (c & 1), y + ((c >> 1) & 1), z + ((c >> 2) & 1))]; cval[c] = v; if (v > 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let ax = 0, ay = 0, az = 0, n = 0;
      for (let e = 0; e < 12; e++) {
        const a = EDGES[e][0], b = EDGES[e][1];
        if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
        const t = cval[a] / (cval[a] - cval[b]);
        ax += (a & 1) + ((b & 1) - (a & 1)) * t; ay += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; az += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t; n++;
      }
      cv[x + nx * (y + ny * z)] = P.length / 3;
      P.push(mn[0] + (x + ax / n) * sx, mn[1] + (y + ay / n) * sy, mn[2] + (z + az / n) * sz);
    }
    const idx = [], ci = (x, y, z) => cv[x + nx * (y + ny * z)];
    const pos = [0, 0, 0];
    for (let z = 1; z < nz; z++) for (let y = 1; y < ny; y++) for (let x = 1; x < nx; x++) {
      const a = vals[gi(x, y, z)] > 0;
      for (let ax = 0; ax < 3; ax++) {
        const bx = x + (ax === 0), by = y + (ax === 1), bz = z + (ax === 2);
        if (bx > nx || by > ny || bz > nz) continue;
        if ((vals[gi(bx, by, bz)] > 0) === a) continue;
        const u = (ax + 1) % 3, v = (ax + 2) % 3, cu = [0, 0, 0], cvv = [0, 0, 0]; cu[u] = 1; cvv[v] = 1;
        const c0 = ci(x - cu[0] - cvv[0], y - cu[1] - cvv[1], z - cu[2] - cvv[2]), c1 = ci(x - cvv[0], y - cvv[1], z - cvv[2]), c2 = ci(x, y, z), c3 = ci(x - cu[0], y - cu[1], z - cu[2]);
        if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) continue;
        if (a) idx.push(c0, c1, c2, c0, c2, c3); else idx.push(c0, c2, c1, c0, c3, c2);
      }
    }
    const nv = P.length / 3, normals = new Float32Array(nv * 3), colors = new Float32Array(nv * 3), e = Math.min(sx, sy, sz) * .8;
    for (let i = 0; i < nv; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      let gx = field(x - e, y, z) - field(x + e, y, z), gy = field(x, y - e, z) - field(x, y + e, z), gz = field(x, y, z - e) - field(x, y, z + e);
      const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
      normals[i * 3] = gx; normals[i * 3 + 1] = gy; normals[i * 3 + 2] = gz;
      const c = o.colorFn ? o.colorFn(x, y, z, gx, gy, gz, field(x, y, z) - iso, field) : [1, 1, 1];
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(normals, 3)); g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.userData.field = field;
    return g;
  };

  // ------------------------------------------------------------------ textures
  const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const lru = (max) => { const m = new Map(); return { get(k) { if (!m.has(k)) return null; const v = m.get(k); m.delete(k); m.set(k, v); return v; }, set(k, v, dispose) { m.set(k, v); while (m.size > max) { const [kk, vv] = m.entries().next().value; m.delete(kk); try { dispose && dispose(vv); } catch (e) { } } }, clear(dispose) { m.forEach(v => { try { dispose && dispose(v); } catch (e) { } }); m.clear(); }, size: () => m.size }; };
  const patCache = lru(12), wearCache = lru(10), miscTex = {};
  const dataTex = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
  const blank = (() => { const c = cvs(4, 4); const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 4, 4); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  L.blankTex = blank;

  /** Tileable RGB data texture: R = dark marks, G = light marks, B = glints. */
  L.patternTexture = function (pattern, seed, stars, size) {
    const key = pattern + '|' + (seed >>> 0) + '|' + (stars ? 1 : 0) + '|' + size, hit = patCache.get(key); if (hit) return hit;
    const S = size, r = U.mulberry32(seed || 1);
    const dark = new Float32Array(S * S), light = new Float32Array(S * S), glint = new Float32Array(S * S);
    const wrapAdd = (arr, cx, cy, rad, fn) => { // splat radial function with wrapping
      const R = Math.ceil(rad);
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const d = Math.hypot(x, y); if (d > rad) continue; const px = ((Math.floor(cx) + x) % S + S) % S, py = ((Math.floor(cy) + y) % S + S) % S, v = fn(d / rad); const i = py * S + px; if (v > arr[i]) arr[i] = v; }
    };
    switch (pattern) {
      case 'striped': { const a = 1 + Math.floor(r() * 3), b = Math.floor(r() * 3) - 1, n = 4 + Math.floor(r() * 3), ph = r() * 6.28; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const t = Math.sin(TAU * n * (a * x + b * y) / S + ph + Math.sin(TAU * 2 * y / S) * .6); dark[y * S + x] = t > .35 ? 1 : 0; light[y * S + x] = t > .1 && t <= .35 ? .8 : 0; } break; }
      case 'spotted': { const n = 22; for (let i = 0; i < n; i++) { const rad = S * (.025 + r() * .06), cx = r() * S, cy = r() * S, dk = r() < .6; wrapAdd(dk ? dark : light, cx, cy, rad, t => (t < .8 ? 1 : (1 - t) * 5)); if (dk && r() < .5) wrapAdd(light, cx - rad * .25, cy - rad * .25, rad * .3, t => (t < .7 ? .9 : 0)); } break; }
      case 'swirled': { for (let k = 0; k < 3; k++) { const cx = r() * S, cy = r() * S, dir = r() < .5 ? 1 : -1, w = S * (.014 + r() * .01); for (let a = 0; a < 26; a += .06) { const rad = a * S * .011; wrapAdd(a % 3 < 1.9 ? dark : light, cx + Math.cos(a * dir) * rad, cy + Math.sin(a * dir) * rad, w, t => (t < .7 ? 1 : (1 - t) * 3.3)); } } break; }
      case 'starry': { for (let i = 0; i < 46; i++) { const rad = S * (.006 + r() * .014), cx = r() * S, cy = r() * S; wrapAdd(light, cx, cy, rad, t => 1 - t); wrapAdd(glint, cx, cy, rad * .6, t => 1 - t); if (r() < .3) for (let k = -3; k <= 3; k++) { wrapAdd(light, cx + k * rad * .9, cy, 1.4, () => .8); wrapAdd(light, cx, cy + k * rad * .9, 1.4, () => .8); } } break; }
      case 'marbled': { const P = 4, s2 = Math.floor(r() * 999); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let q = 0, f = 1, w = .5; for (let o = 0; o < 4; o++) { q += pnoise(x / S * P * f + 7.3, y / S * P * f, P * f, s2 + o) * w; f *= 2; w *= .5; } const v = Math.abs(Math.sin((x / S * 2 + q * 7) * Math.PI * 2 / 2 * 2)); dark[y * S + x] = v < .08 ? 1 : 0; light[y * S + x] = v > .08 && v < .2 ? .6 : 0; } break; }
      case 'checkered': { const n = 5 + Math.floor(r() * 3), c = S / n; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { dark[y * S + x] = ((Math.floor(x / c) + Math.floor(y / c)) & 1) ? 1 : 0; const ex = x % c, ey = y % c; light[y * S + x] = (ex < 2 || ey < 2) && !(((Math.floor(x / c) + Math.floor(y / c)) & 1)) ? .6 : 0; } break; }
      case 'scaled': { const n = 7, c = S / n; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const row = Math.floor(y / (c * .5)), ox = (row & 1) ? c / 2 : 0, lx = ((x + ox) % c) - c / 2, ly = (y % (c * .5)) ; const d = Math.hypot(lx, ly - c * .5 * .0) / (c * .5); const edge = Math.abs(d - 0.96); dark[y * S + x] = edge < .06 ? 1 : 0; light[y * S + x] = edge >= .06 && edge < .14 && ly < c * .25 ? .5 : 0; } break; }
      default: break;
    }
    if (stars) for (let i = 0; i < 70; i++) { const rad = S * (.004 + r() * .01); wrapAdd(glint, r() * S, r() * S, rad, t => 1 - t * t); }
    const c = cvs(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
    for (let i = 0; i < S * S; i++) { d[i * 4] = dark[i] * 255; d[i * 4 + 1] = light[i] * 255; d[i * 4 + 2] = glint[i] * 255; d[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0);
    const t = dataTex(c); patCache.set(key, t, tt => tt.dispose()); return t;
  };

  /** Tileable wear data: R scratches, G grime/blotches, B cracks. */
  L.wearTexture = function (bucket, size) {
    const key = bucket + '|' + size, hit = wearCache.get(key); if (hit) return hit;
    const S = size, r = U.mulberry32(bucket * 7919 + 13);
    const sc = new Float32Array(S * S), gr = new Float32Array(S * S), cr = new Float32Array(S * S);
    const plot = (arr, x, y, v) => { const px = ((Math.round(x) % S) + S) % S, py = ((Math.round(y) % S) + S) % S; if (v > arr[py * S + px]) arr[py * S + px] = v; };
    const line = (arr, x0, y0, x1, y1, v, w) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; for (let k = 0; k < w; k++) plot(arr, x + k, y, v); } };
    const dirBase = r() * TAU;
    for (let i = 0; i < 90; i++) { const x = r() * S, y = r() * S, a = dirBase + (r() - .5) * 1.2 + (r() < .25 ? 1.57 : 0), l = S * (.04 + r() * .22); line(sc, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, .45 + r() * .55, 1 + (r() < .2)); }
    for (let i = 0; i < 160; i++) plot(sc, r() * S, r() * S, .8);
    const P = 6, s2 = bucket * 31;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let q = 0, f = 1, w = .5, n = 0; for (let o = 0; o < 4; o++) { q += pnoise(x / S * P * f, y / S * P * f, P * f, s2 + o) * w; n += w; f *= 2; w *= .5; } q /= n; const grain = pnoise(x / S * 64, y / S * 64, 64, s2 + 9); gr[y * S + x] = Math.max(0, Math.min(1, (q - .42) * 3.2)) * (.72 + grain * .5); }
    for (let k = 0; k < 4; k++) { // branching cracks
      let x = r() * S, y = r() * S, a = r() * TAU; const trunk = [];
      for (let i = 0; i < 40; i++) { const nx = x + Math.cos(a) * S * .028, ny = y + Math.sin(a) * S * .028; line(cr, x, y, nx, ny, 1, 2); trunk.push([nx, ny, a]); x = nx; y = ny; a += (r() - .5) * .9;
        if (r() < .22) { let bx = x, by = y, ba = a + (r() < .5 ? 1 : -1) * (.6 + r() * .6); for (let j = 0; j < 8; j++) { const bx2 = bx + Math.cos(ba) * S * .02, by2 = by + Math.sin(ba) * S * .02; line(cr, bx, by, bx2, by2, .85, 1); bx = bx2; by = by2; ba += (r() - .5) * .8; } } }
    }
    const c = cvs(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
    for (let i = 0; i < S * S; i++) { d[i * 4] = sc[i] * 255; d[i * 4 + 1] = gr[i] * 255; d[i * 4 + 2] = cr[i] * 255; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    const t = dataTex(c); wearCache.set(key, t, tt => tt.dispose()); return t;
  };

  const spriteTex = (name, draw, size = 128) => { if (miscTex[name]) return miscTex[name]; const c = cvs(size, size), x = c.getContext('2d'); draw(x, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; miscTex[name] = t; return t; };
  L.glowTex = () => spriteTex('glow', (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.45)'); g.addColorStop(.6, 'rgba(255,255,255,.1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
  L.dotTex = () => spriteTex('dot', (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, 64);
  L.shadowTex = () => spriteTex('shadow', (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(.5, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, 128);
  L.shaftTex = () => spriteTex('shaft', (x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); const h = x.createLinearGradient(0, 0, s, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, s, s); }, 128);

  /** Engraved brass plate with text lines → texture (not cached; caller disposes). */
  L.plateTexture = function (lines, w = 1024, h = 256, o = {}) {
    const c = cvs(w, h), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, o.top || '#2a251d'); g.addColorStop(1, o.bot || '#15130f'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = o.edge || '#a8834a'; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20); x.lineWidth = 2; x.strokeRect(22, 22, w - 44, h - 44);
    x.fillStyle = o.ink || '#d9b873'; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((ln, i) => { x.font = ln.font; const y = ln.y != null ? ln.y : h * (i + 1) / (lines.length + 1); x.fillStyle = ln.color || o.ink || '#d9b873'; if (ln.spacing) x.letterSpacing = ln.spacing; else x.letterSpacing = '0px'; x.fillText(ln.text, w / 2, y); });
    // grain
    const img = x.getImageData(0, 0, w, h), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 12; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  /** Paper tag texture. */
  L.paperTexture = function (lines, w = 256, h = 384, o = {}) {
    const c = cvs(w, h), x = c.getContext('2d'); x.fillStyle = o.paper || '#d8cdb1'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(90,70,40,${Math.random() * .06})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random()); }
    x.strokeStyle = 'rgba(60,45,25,.35)'; x.lineWidth = 3; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = o.ink || '#2b251a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach(ln => { x.font = ln.font; x.letterSpacing = ln.spacing || '0px'; x.fillStyle = ln.color || o.ink || '#2b251a'; x.fillText(ln.text, w / 2, ln.y); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };

  // ------------------------------------------------------------------ colour helpers
  const _c = new THREE.Color();
  L.hueShift = (hex, deg) => { if (!deg) return hex; const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); if (hsl.s < .12) return hex; c.setHSL((hsl.h + deg / 360) % 1, hsl.s, hsl.l); return '#' + c.getHexString(); };
  L.mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  L.shade = (a, k) => '#' + new THREE.Color(a).multiplyScalar(k).getHexString();
  L.invert = hex => { const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); c.setHSL((hsl.h + .5) % 1, hsl.s, 1 - hsl.l * .9 - .02); return '#' + c.getHexString(); };

  // ------------------------------------------------------------------ condition profile
  /** Maps category + condition tier (0 best … 4 worst) to a rendering profile. */
  L.wearProfile = function (cat, tier) {
    const w = { scratch: 0, patina: 0, crack: 0, unstable: 0, flicker: 0, dim: 0, rust: 0, tint: '#6f6350', label: 'pristine' };
    const t = tier;
    if (cat === 'relic') { w.tint = '#58806c'; w.scratch = [0, .1, .25, .45, .55][t]; w.patina = [0, .1, .45, .75, .6][t]; w.crack = t === 4 ? 1.7 : 0; w.label = ['pristine', 'preserved', 'ancient', 'ancient', 'fractured'][t]; }
    else if (cat === 'machine') { w.tint = '#8a4a20'; w.scratch = [0, .15, .4, .6, .75][t]; w.patina = [0, 0, .25, .75, .85][t]; w.crack = t === 4 ? 1.1 : 0; w.label = ['pristine', 'tuned', 'worn', 'weathered', 'fractured'][t]; }
    else if (cat === 'oddity') { w.tint = '#3b2f5a'; w.unstable = [0, 0, .5, 1, 1.8][t]; w.flicker = [0, .5, .6, .8, 1][t]; w.crack = t === 4 ? 1.3 : 0; w.scratch = t >= 3 ? .2 : 0; w.label = ['pristine', 'flicker', 'unstable', 'unstable', 'fractured'][t]; }
    else if (cat === 'pet') { w.tint = '#aeb8cf'; w.patina = [0, 0, 0, .25, .35][t]; w.dim = [0, 0, .08, .25, .38][t]; w.crack = t === 4 ? 1.0 : 0; w.flicker = t === 4 ? .6 : 0; w.label = ['radiant', 'thriving', 'content', 'weary', 'fragile'][t]; }
    else { w.scratch = [0, .12, .35, .6, .7][t]; w.patina = [0, 0, .12, .55, .7][t]; w.crack = t === 4 ? 1.6 : 0; w.label = ['pristine', 'fine', 'worn', 'weathered', 'fractured'][t]; }
    return w;
  };

  // ------------------------------------------------------------------ shared trait shader
  const SHARED_TIME = { value: 0 }; L.timeUniform = SHARED_TIME;
  const VID = { none: 0, foil: 1, holographic: 2, golden: 3, inverted: 4, shadow: 5, corrupted: 6, celestial: 7, glitched: 8, prismatic: 9 };

  function patch(mat, tr, key) {
    mat.userData.tr = tr;
    mat.customProgramCacheKey = () => 'avtr' + key;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = SHARED_TIME;
      sh.uniforms.uPat = { value: tr.pat || blank }; sh.uniforms.uWear = { value: tr.wear || blank };
      sh.uniforms.uTr1 = tr.u1; sh.uniforms.uTr2 = tr.u2; sh.uniforms.uTint = tr.uTint; sh.uniforms.uCrackCol = tr.uCrack; sh.uniforms.uRim = tr.uRim;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
varying vec3 vOP; varying vec3 vON; uniform float uTime; uniform vec4 uTr2;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vOP = position; vON = normal;
if (uTr2.y > 0.001) { float w1 = sin(position.y*9.0+uTime*3.1)+sin(position.x*13.0-uTime*4.3)+sin(position.z*11.0+uTime*2.7); transformed += normal * w1 * 0.007 * uTr2.y; }
if (uTr2.x > 7.5 && uTr2.x < 8.5) { float band = floor(position.y*14.0); float h = fract(sin(band*12.9898 + floor(uTime*9.0)*78.233)*43758.5453); float on = step(0.84, fract(uTime*0.33+0.2)); transformed.x += (h-0.5) * 0.11 * on * step(0.5, h); }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vOP; varying vec3 vON; uniform float uTime; uniform sampler2D uPat; uniform sampler2D uWear; uniform vec4 uTr1; uniform vec4 uTr2; uniform vec3 uTint; uniform vec3 uCrackCol; uniform vec3 uRim;
vec4 triS(sampler2D t, vec3 p, vec3 n, float sc){ vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x+w.y+w.z+1e-5); return texture2D(t,p.zy*sc)*w.x + texture2D(t,p.xz*sc)*w.y + texture2D(t,p.xy*sc)*w.z; }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
vec3 avN = normalize(vON);
vec4 avP = vec4(0.0); vec4 avW = vec4(0.0);
if (uTr1.x > 0.001 || (uTr2.x > 6.5 && uTr2.x < 7.5)) avP = triS(uPat, vOP, avN, uTr2.z);
if (uTr1.y + uTr1.z + uTr1.w > 0.001 || (uTr2.x > 5.5 && uTr2.x < 6.5)) avW = triS(uWear, vOP, avN, uTr2.w);
float avPS = uTr1.x;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.30,0.28,0.34), avP.r*avPS);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(1.0), 0.6), avP.g*avPS);
diffuseColor.rgb = mix(diffuseColor.rgb, uTint, clamp(avW.g*uTr1.z*1.5-0.12, 0.0, 1.0));
diffuseColor.rgb += vec3(avW.r*uTr1.y*0.2);
diffuseColor.rgb *= 1.0 - uTr1.z*0.18*avW.g;
float avV = uTr2.x;
if (avV > 8.5) { vec3 rb = 0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+vOP.y*0.9+vOP.x*0.4+uTime*0.07)); diffuseColor.rgb = mix(diffuseColor.rgb, rb, 0.55); }
else if (avV > 1.5 && avV < 2.5) { vec3 rb = 0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+vOP.y*0.5+uTime*0.05)); diffuseColor.rgb = mix(diffuseColor.rgb, rb, 0.22); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + avW.g*uTr1.z*0.35 + avW.r*uTr1.y*0.4, 0.03, 1.0);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float avCk = avW.b * uTr1.w;
totalEmissiveRadiance += uCrackCol * avCk * (0.65+0.35*sin(uTime*2.3+vOP.y*5.0)) * 1.3;
float avRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
totalEmissiveRadiance += uRim * avRim;
if (avV > 6.5 && avV < 7.5) { float tw = 0.6+0.4*sin(uTime*2.0+vOP.x*40.0+vOP.y*30.0); totalEmissiveRadiance += vec3(0.8,0.9,1.0)*avP.b*tw*1.7; }
if (avV > 5.5 && avV < 6.5) { totalEmissiveRadiance += vec3(1.0,0.1,0.2)*smoothstep(0.15,0.9,avW.b)*(0.6+0.4*sin(uTime*3.0+vOP.y*8.0))*1.0; }`);
    };
  }

  /**
   * Material factory bound to one specimen. ctx = { spec, cat, quality, wear, variant, disposables, physical }
   * Roles: body, trim, glow, dark, glass, paper. Returns THREE materials with traits patched in.
   */
  L.materialFactory = function (spec, quality, disposables, texSize) {
    const item = D.ITEMS[spec.base] || {}, cat = item.cat || 'container', tier = spec.condition || 0;
    const wear = L.wearProfile(cat, tier), vid = VID[spec.variant || 'none'] || 0, vname = spec.variant || 'none';
    const pal = D.PALETTES[spec.palette || 0] || { hue: 0 };
    const physical = quality.physical;
    const pat = (spec.pattern && spec.pattern !== 'plain') || vname === 'celestial' ? L.patternTexture(spec.pattern || 'plain', spec.seed || 1, vname === 'celestial' || spec.pattern === 'starry', texSize) : blank;
    const hasWear = wear.scratch > 0 || wear.patina > 0 || wear.crack > 0 || vid === 6 || !!spec.forceWear;
    const wearTx = hasWear ? L.wearTexture((spec.seed >>> 0) % 24, texSize) : blank;
    const hs = c => L.hueShift(c, pal.hue);
    const patStr = (spec.pattern && spec.pattern !== 'plain') ? .8 : 0;
    const F = { wear, variant: vname, vid, cat, pat, wearTx, hs };

    function recolor(role, hex) {
      let c = hs(hex);
      if (role === 'dark') return c;
      switch (vname) {
        case 'golden': return role === 'body' ? L.mix(c, '#f0c04a', .88) : role === 'trim' ? '#f2c75a' : role === 'glow' ? '#ffd36b' : c;
        case 'inverted': return L.invert(c);
        case 'shadow': return role === 'glow' ? '#9b6cff' : L.mix(L.shade(c, .38), '#2a1f4a', .35);
        case 'corrupted': return role === 'glow' ? '#ff2a4a' : L.mix(L.shade(c, .42), '#2a0d14', .45);
        case 'celestial': return role === 'glow' ? '#bfe6ff' : role === 'trim' ? '#aab8e8' : L.mix(L.shade(c, .45), '#171d52', .62);
        case 'glitched': return role === 'glow' ? '#ff2bd6' : c;
        case 'prismatic': return role === 'body' ? L.mix(c, '#d9d9ff', .35) : c;
        case 'holographic': return role === 'body' ? L.mix(c, '#e8e8ff', .25) : c;
        case 'foil': return role === 'trim' ? L.mix(c, '#e8ecf4', .55) : role === 'body' ? L.mix(c, '#eef2fa', .3) : c;
        default: return c;
      }
    }
    function make(role, o = {}) {
      const col = recolor(role, o.color || '#888888');
      let metal = o.metal != null ? o.metal : (role === 'trim' ? .9 : 0), rough = o.rough != null ? o.rough : (role === 'trim' ? .32 : .6);
      const P = { color: new THREE.Color(col), metalness: metal, roughness: rough, envMapIntensity: o.env != null ? o.env : 1 };
      if (role === 'glow') { P.emissive = new THREE.Color(col); P.emissiveIntensity = o.glow != null ? o.glow : 1.6; P.color = new THREE.Color(L.shade(col, .35)); P.roughness = .5; }
      if (o.emissive) { P.emissive = new THREE.Color(recolor('glow', o.emissive)); P.emissiveIntensity = o.emissiveIntensity != null ? o.emissiveIntensity : 1; }
      if (role === 'glass') { P.transparent = true; P.opacity = o.opacity != null ? o.opacity : .28; P.depthWrite = false; P.roughness = .06; P.metalness = 0; P.envMapIntensity = 1.6; }
      if (vname === 'golden') P.envMapIntensity = Math.max(P.envMapIntensity, 1.7);
      const soft = !!o.soft; // soft bodies (clouds, shells) take variant colour/iridescence but never go chrome
      if (vname === 'golden' && (role === 'body' || role === 'trim')) { P.metalness = soft ? .18 : .95; P.roughness = Math.min(P.roughness, soft ? .5 : .26); }
      if (vname === 'foil' && role === 'body') { P.metalness = soft ? metal : Math.max(metal, .85); P.roughness = soft ? Math.min(rough, .6) : Math.min(rough, .22); P.envMapIntensity = Math.max(P.envMapIntensity, 1.6); }
      if (vname === 'celestial' && role === 'body') { P.metalness = soft ? metal : Math.max(metal, .35); P.roughness = soft ? .7 : .38; }
      if (vname === 'shadow' && role === 'body') P.roughness = Math.max(rough, .55);
      if ((vname === 'holographic' || vname === 'prismatic') && (role === 'body' || role === 'trim')) { P.metalness = soft ? metal : Math.max(metal, .3); P.roughness = soft ? Math.min(rough, .6) : Math.min(rough, .38); }
      if (wear.rust && role === 'trim') P.roughness = Math.min(1, P.roughness + wear.rust);
      if (o.vertexColors) P.vertexColors = true;
      if (o.side) P.side = o.side;
      if (o.flatShading) P.flatShading = true;
      let m;
      if (physical && role !== 'glow') {
        m = new THREE.MeshPhysicalMaterial(P);
        const cc = o.clearcoat != null ? o.clearcoat : (role === 'body' ? .25 : 0);
        m.clearcoat = cc; m.clearcoatRoughness = o.ccRough != null ? o.ccRough : .25;
        if (vname === 'holographic' || vname === 'prismatic' || vname === 'foil') { m.iridescence = vname === 'foil' ? .55 : 1; m.iridescenceIOR = 1.7; m.iridescenceThicknessRange = [180, 620]; m.clearcoat = Math.max(m.clearcoat, .6); }
        if (role === 'glass') { m.clearcoat = 1; m.clearcoatRoughness = .05; }
      } else m = new THREE.MeshStandardMaterial(P);
      const apply = !(role === 'glass') && !o.plain;
      const tr = {
        pat: apply ? pat : blank, wear: (apply || role === 'glass') ? wearTx : blank,
        u1: { value: new THREE.Vector4(apply ? patStr * (o.pat != null ? o.pat : 1) : 0, apply ? wear.scratch : 0, apply ? wear.patina : 0, (apply || role === 'glass') ? wear.crack : 0) },
        u2: { value: new THREE.Vector4(vid, (apply || role === 'glass') ? wear.unstable : 0, o.patScale || 1.1, o.wearScale || 1.0) },
        uTint: { value: new THREE.Color(wear.tint) }, uCrack: { value: new THREE.Color(role === 'glow' ? '#ffffff' : (F.crackColor || '#ffd9a0')) },
        uRim: { value: new THREE.Color(vname === 'shadow' ? '#6a3cff' : vname === 'celestial' ? '#3a5aff' : vname === 'foil' ? '#222a36' : '#000000').multiplyScalar(vname === 'shadow' ? .9 : .5) },
      };
      if (vname === 'glitched' || vname === 'corrupted') { /* vertex effects live in the shared shader */ }
      patch(m, tr, (physical && role !== 'glow' ? 'P' : 'S'));
      m.userData.role = role; m.userData.base = { emissiveIntensity: m.emissiveIntensity };
      disposables.push(m);
      return m;
    }
    F.make = make;
    F.body = (c, o) => make('body', Object.assign({ color: c }, o));
    F.trim = (c, o) => make('trim', Object.assign({ color: c }, o));
    F.glow = (c, o) => make('glow', Object.assign({ color: c }, o));
    F.dark = (c, o) => make('dark', Object.assign({ color: c, rough: .7 }, o));
    F.glass = (c, o) => make('glass', Object.assign({ color: c }, o));
    F.plain = (c, o) => { const m = make('dark', Object.assign({ color: c, plain: true }, o)); return m; };
    return F;
  };

  /** Additive glow sprite (hidden in silhouette mode). */
  L.sprite = (color, size, opacity = 1, tex) => { const m = new THREE.SpriteMaterial({ map: tex || L.glowTex(), color: new THREE.Color(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }); const sp = new THREE.Sprite(m); sp.scale.set(size, size, 1); sp.userData.noSil = true; sp.userData.noCast = true; return sp; };
  L.cacheStats = () => ({ patterns: patCache.size(), wear: wearCache.size() });
  L.clearCaches = () => { patCache.clear(t => t.dispose()); wearCache.clear(t => t.dispose()); };
  L.vnoise = vnoise; L.fbm3 = fbm3; L.TAU = TAU;
  AV.stageLib = L;
})();
