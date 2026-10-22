/* AETHERVAULT — Combat aiming geometry. Pure and shared: the SAME functions draw the aim preview and decide who an ability hits, so what the player
 * sees while aiming is exactly what happens. No DOM, no clock, no Math.random.
 *
 * Seven aim models for abilities (every ability declares exactly one):
 *   dir    directional charge — a bolt or blast fired along a direction (thin lane, optionally piercing)
 *   circle area — a circle on the ground, centred where you point (clamped to the ability's range)
 *   cone   cone — a fan from the caster toward the pointer
 *   dash   dash / charge — the caster itself travels along a line, hitting what it crosses
 *   line   line / wall / barrier — a segment placed across the pointer, facing the caster
 *   self   self — centred on the caster, no aiming needed (confirm only)
 *   chain  chain target — pick one unit; the effect then jumps between nearby units
 * Support cards additionally use 'point' (placement at the pointer, with an optional footprint circle).
 *
 * resolve(ab, from, to) → a plain shape: { model, t:'circle'|'cone'|'line'|'chain', ok, reason, … }  (t is the geometry, model the player-facing kind). */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const MODELS = ['dir', 'circle', 'cone', 'dash', 'line', 'self', 'chain'];
  const NAMES = { dir: 'Directional charge', circle: 'Area', cone: 'Cone', dash: 'Dash', line: 'Wall / line', self: 'Self', chain: 'Chain target', point: 'Placement' };
  const HELP = { dir: 'Aim a direction, click to fire', circle: 'Aim a spot, click to cast', cone: 'Aim a direction, click to cast', dash: 'Aim a direction, click to dash', line: 'Aim where the wall goes, click to place',
    self: 'Click to cast on yourself', chain: 'Click a unit to start the chain', point: 'Click a spot to place it' };
  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const vec = (dx, dz, fz) => { const l = Math.hypot(dx, dz); return l < 1e-6 ? { x: 0, z: fz || -1, l: 0 } : { x: dx / l, z: dz / l, l }; };

  /** Shape of an ability for a caster at `from` ({x,z,fz?}) aimed at `to` ({x,z}). `to` may be null for self-aimed abilities. */
  function resolve(ab, from, to) {
    const m = ab.aim, fz = from.fz || -1, tx = to ? to.x : from.x, tz = to ? to.z : from.z + fz, v = vec(tx - from.x, tz - from.z, fz), range = ab.range || 0;
    if (m === 'self') return { model: m, t: 'circle', x: from.x, z: from.z, r: ab.radius || 0, ok: true, reason: '', at: { x: from.x, z: from.z } };
    if (m === 'circle' || m === 'point') {
      const d = Math.min(v.l, range || 99), x = from.x + v.x * d, z = from.z + v.z * d;
      return { model: m, t: 'circle', x: m === 'point' && !range ? tx : x, z: m === 'point' && !range ? tz : z, r: ab.radius || 0.5, ok: true, reason: '', clamped: v.l > (range || 99) + 1e-6, at: { x: m === 'point' && !range ? tx : x, z: m === 'point' && !range ? tz : z } };
    }
    if (m === 'cone') return { model: m, t: 'cone', x: from.x, z: from.z, dx: v.x, dz: v.z, len: ab.length, half: (ab.angle || 60) * Math.PI / 360, ok: true, reason: '', at: { x: from.x + v.x * ab.length * 0.5, z: from.z + v.z * ab.length * 0.5 } };
    if (m === 'dir') return { model: m, t: 'line', x1: from.x, z1: from.z, x2: from.x + v.x * ab.length, z2: from.z + v.z * ab.length, w: ab.width || 1, dx: v.x, dz: v.z, ok: true, reason: '', at: { x: from.x + v.x * ab.length, z: from.z + v.z * ab.length } };
    if (m === 'dash') {
      const d = Math.max(Math.min(v.l, ab.length), Math.min(1.5, ab.length)), ex = from.x + v.x * d, ez = from.z + v.z * d;
      return { model: m, t: 'line', x1: from.x, z1: from.z, x2: ex, z2: ez, w: ab.width || 1, dx: v.x, dz: v.z, dest: { x: ex, z: ez }, ok: true, reason: '', at: { x: ex, z: ez } };
    }
    if (m === 'line') { // a segment centred on the (clamped) pointer, square to the caster
      const d = Math.min(v.l, range || 99), cx = from.x + v.x * d, cz = from.z + v.z * d, px = -v.z, pz = v.x, h = (ab.length || 3) / 2;
      return { model: m, t: 'line', x1: cx - px * h, z1: cz - pz * h, x2: cx + px * h, z2: cz + pz * h, w: ab.width || 1, cx, cz, dx: v.x, dz: v.z, wall: true, ok: true, reason: '', at: { x: cx, z: cz } };
    }
    if (m === 'chain') {
      const ok = !!to && dist(from.x, from.z, tx, tz) <= range + 1e-6;
      return { model: m, t: 'chain', x: from.x, z: from.z, tx, tz, r: ab.hopRange || 3, ok, reason: ok ? '' : to ? 'Out of range.' : 'Pick a unit.', at: { x: tx, z: tz } };
    }
    return { model: m, t: 'circle', x: from.x, z: from.z, r: 0, ok: false, reason: 'Unknown aim model.', at: { x: from.x, z: from.z } };
  }
  /** Distance from a point to a segment. */
  function segDist(px, pz, x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz; let t = l2 < 1e-9 ? 0 : ((px - x1) * dx + (pz - z1) * dz) / l2; t = Math.max(0, Math.min(1, t)); return dist(px, pz, x1 + dx * t, z1 + dz * t);
  }
  /** Does a body of radius r at (x,z) touch the shape? (chain shapes only test the first link; the simulation walks the jumps.) */
  function hits(sh, x, z, r) {
    r = r || 0;
    if (sh.t === 'circle') return dist(x, z, sh.x, sh.z) <= sh.r + r;
    if (sh.t === 'line') return segDist(x, z, sh.x1, sh.z1, sh.x2, sh.z2) <= sh.w / 2 + r;
    if (sh.t === 'cone') {
      const vx = x - sh.x, vz = z - sh.z, d = Math.hypot(vx, vz); if (d > sh.len + r) return false; if (d < 1e-6) return true;
      const cos = (vx * sh.dx + vz * sh.dz) / d, ang = Math.acos(Math.max(-1, Math.min(1, cos))); return ang <= sh.half + Math.atan(r / Math.max(d, 1e-6));
    }
    if (sh.t === 'chain') return dist(x, z, sh.tx, sh.tz) <= r + 0.01;
    return false;
  }
  /** Grid cells (cx,cz) along a wall segment, spaced one cell apart; used to place physical barriers. */
  function wallCells(sh, n) {
    const out = [], len = Math.hypot(sh.x2 - sh.x1, sh.z2 - sh.z1), steps = Math.max(1, n || Math.round(len)); const seen = {};
    for (let i = 0; i < steps; i++) { const f = steps === 1 ? .5 : i / (steps - 1), cx = Math.floor(sh.x1 + (sh.x2 - sh.x1) * f), cz = Math.floor(sh.z1 + (sh.z2 - sh.z1) * f), k = cx + ',' + cz; if (!seen[k]) { seen[k] = 1; out.push({ cx, cz }); } }
    return out;
  }
  AV.combat.aim = { MODELS, NAMES, HELP, resolve, hits, segDist, wallCells, vec, dist };
})();
