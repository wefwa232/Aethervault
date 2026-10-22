/* AETHERVAULT — Combat support cards (Combat B4). Pure and deterministic like sim.js: no DOM, no Math.random, no clock.
 * A support card is deployed on the battlefield as its OWN object or effect — it never rewrites a Pet's abilities. Numbers are authored in defs.js and scaled
 * by translate().attrs (1.00 at stat 50). Eleven of the twelve are combat; one (Heart of Eternity) also returns Elixir, so the Elixir share is 1 of 12.
 *
 *   weapons   Gravehammer  slam on a chosen point, after a telegraph, stuns            · Ionbow  emplacement that fires down a lane
 *             Prismedge    a floating blade that hunts a chosen enemy
 *   shields   Oak Buckler  a barrier wall that blocks walking and shots, with HP       · Starforged Aegis  a ward on one Pet: absorbs and reflects
 *   machines  Leviathan Engine · Scrap Rover (rams the line) · Pocket Drone (repairs allies; a decoy that draws fire)
 *   relics    Moonstone (slows, briefly freezes, an area)                              · Heart of Eternity (revives a fallen Pet, heals, returns Elixir)
 *   oddities  Backwards Clock (rewinds positions)                                      · Glitched Cursor (enemies in it pick the wrong targets)
 * One copy of a card may be in play per side at a time. Support cards never carry a redeploy surcharge and never damage a Core except machines in contact.
 *
 * LEVIATHAN ENGINE (hard rules, all tested): spins up for 1.5 s, then follows one of three fixed lanes (left / centre / right → bridge → enemy half → Core),
 * turning toward the nearest enemy structure once across. Contact damage scales with Output. On contact it GRAPPLES one enemy Pet (never a Core, never something
 * already held, never the same unit twice within 10 s): the victim cannot act and is carried along for up to 3 s (scaled by durability). It is then EJECTED onto a
 * walkable, unoccupied cell near the Engine (the placement search always ends on open ground). A 4 s watchdog releases ANY hold, whatever the carrier is doing.
 * A carried unit is skipped by every area effect; single-target attacks still hit it. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const T = () => AV.combat.tuning, K = () => AV.combat.core, AIM = () => AV.combat.aim, AB = () => AV.combat.abil, H = () => AV.combat.hand, SIMF = () => AV.combat.sim;
  const r6 = x => +x.toFixed(6);

  // ------------------------------------------------------------------ numbers
  const attr = (c, key) => { const k = c.def.scale && c.def.scale[key]; return k && c.t.attrs && c.t.attrs[k] != null ? c.t.attrs[k] : 1; };
  /** An authored number scaled by the specimen's stat (an interval shortens as Tempo rises). */
  const val = (c, key, base) => (key === 'interval' ? base / attr(c, key) : base * attr(c, key));
  const cardOf = (s, side, id) => s.sides[side] && s.sides[side].cards[id];

  // ------------------------------------------------------------------ placement
  const ownHalf = (s, side, cz) => { const mid = Math.floor(s.h / 2); return side === 'a' ? cz > mid : cz < mid - 1; };
  /** Is a copy of this card already in play for the side? */
  function active(s, side, id) {
    return s.units.some(u => u.card === id && u.side === side && u.hp > 0) || s.zones.some(z => z.card === id && z.side === side && z.kind !== 'visual') || s.fx.some(f => f.card === id && f.side === side);
  }
  /** Preview/validation shape for a support card aimed at (x,z) / {tuid}. */
  function shapeFor(s, side, id, x, z, aim) {
    const c = cardOf(s, side, id), d = c.def, core = s.cores[side], fz = side === 'a' ? -1 : 1;
    if (d.aim === 'circle') return { model: 'circle', t: 'circle', x, z, r: val(c, 'radius', d.radius), ok: true, reason: '', at: { x, z } };
    if (d.aim === 'point') return { model: 'point', t: 'circle', x, z, r: d.radius + 0.2, ok: true, reason: '', at: { x, z } };
    if (d.aim === 'self') return { model: 'self', t: 'circle', x: core.x, z: core.z, r: 1.4, ok: true, reason: '', at: { x: core.x, z: core.z } };
    if (d.aim === 'chain') { const t = aim && aim.tuid != null ? K().unitOf(s, aim.tuid) : null; return { model: 'chain', t: 'circle', x: t ? t.x : x, z: t ? t.z : z, r: 1.1, ok: !!t, reason: t ? '' : 'Pick a unit.', at: { x: t ? t.x : x, z: t ? t.z : z } }; }
    if (d.kind === 'emplacement') return { model: 'line', t: 'line', x1: x, z1: z, x2: x, z2: z + fz * d.length, w: d.width, dx: 0, dz: fz, ok: true, reason: '', at: { x, z } };
    return AIM().resolve({ aim: 'line', length: d.length, width: d.width, range: 99 }, { x: core.x, z: core.z, fz }, { x, z });
  }
  function check(s, side, id, x, z, aim) {
    const c = cardOf(s, side, id), d = c.def; if (active(s, side, id)) return { ok: false, reason: 'Already in play.' };
    const A = T().arena, rows = side === 'a' ? A.deploy.playerRows : A.deploy.enemyRows;
    if (d.place === 'zone') {
      const cx = Math.floor(x), cz = Math.floor(z);
      if (cz < rows[0] || cz > rows[1] || cx < 0 || cx >= s.w) return { ok: false, reason: 'Outside your deployment zone.' };
      if (!K().cellOk(s, cx, cz)) return { ok: false, reason: 'That ground is blocked.' };
      const px = cx + .5, pz = cz + .5; if (K().unitAt(s, px, pz, 0.95)) return { ok: false, reason: 'Occupied.' };
      return { ok: true, reason: '', x: px, z: pz, shape: shapeFor(s, side, id, px, pz, aim) };
    }
    if (d.place === 'own') {
      const sh = shapeFor(s, side, id, x, z, aim); if (!ownHalf(s, side, Math.floor(sh.cz))) return { ok: false, reason: 'Place it on your half.', shape: sh };
      if (!AB().placeWall) return { ok: false, reason: 'Unavailable.' };
      const cells = AIM().wallCells(sh).filter(q => K().cellOk(s, q.cx, q.cz) && !s.units.some(w => w.hp > 0 && w.kind !== 'barrier' && K().dist(w.x, w.z, q.cx + .5, q.cz + .5) < 0.8) && ownHalf(s, side, q.cz));
      if (!cells.length) return { ok: false, reason: 'No room for a wall there.', shape: sh };
      return { ok: true, reason: '', x: sh.cx, z: sh.cz, shape: sh };
    }
    if (d.place === 'field') { if (x < 0 || z < 0 || x > s.w || z > s.h) return { ok: false, reason: 'Outside the arena.' }; return { ok: true, reason: '', x, z, shape: shapeFor(s, side, id, x, z, aim) }; }
    if (d.place === 'ally' || d.place === 'enemy') {
      const t = aim && aim.tuid != null ? K().unitOf(s, aim.tuid) : null; if (!t || t.hp <= 0 || t.spawn > 0) return { ok: false, reason: d.place === 'ally' ? 'Pick one of your Pets.' : 'Pick an enemy.' };
      if (d.place === 'ally' && (t.side !== side || t.kind !== 'pet')) return { ok: false, reason: 'Pick one of your Pets.' };
      if (d.place === 'enemy' && (t.side === side || t.kind === 'barrier')) return { ok: false, reason: 'Pick an enemy.' };
      return { ok: true, reason: '', x: t.x, z: t.z, tuid: t.uid, shape: shapeFor(s, side, id, t.x, t.z, aim) };
    }
    return { ok: true, reason: '', x: s.cores[side].x, z: s.cores[side].z, shape: shapeFor(s, side, id, 0, 0, aim) }; // place: none
  }

  // ------------------------------------------------------------------ deploying
  const visual = (s, side, id, x, z, r, secs, follow) => s.zones.push({ id: s.nextUid++, kind: 'visual', side, card: id, x, z, r, until: r6(s.t + secs), every: 99, next: 1e9, seen: {}, follow: follow || 0 });
  function mkObj(s, side, id, c, v) {
    const d = c.def, hp = Math.max(1, Math.round(val(c, 'hp', d.hp))), kind = d.kind, rover = kind === 'rover', face = side === 'a' ? -1 : 1;
    const u = { uid: s.nextUid++, side, kind: kind === 'rover' || kind === 'drone' || kind === 'leviathan' ? 'machine' : kind === 'blade' ? 'blade' : kind, ai: rover ? 'rover' : 'obj', obj: kind, card: id, base: c.base, role: d.role, hp, max: hp, radius: d.radius,
      x: v.x, z: v.z, px: v.x, pz: v.z, spawn: T().pet.deployDelay, cd: 0, target: null, path: null, rt: 0, face, st: {}, order: null, prio: null, until: r6(s.t + val(c, 'dur', d.dur || 30) + T().pet.deployDelay), static: false, abil: null };
    if (rover) Object.assign(u, { atk: 'melee', hit: 'thud', dmg: Math.round(val(c, 'dmg', d.dmg)), range: 1.1, speed: d.speed, interval: r6(val(c, 'interval', d.interval)), aggro: d.aggro, crit: 0, rammed: false });
    else if (kind === 'emplacement') Object.assign(u, { dmg: Math.round(val(c, 'dmg', d.dmg)), interval: val(c, 'interval', d.interval), lane: { x1: v.x, z1: v.z, x2: v.x, z2: v.z + face * d.length, w: d.width }, cd: 0.6 });
    else if (kind === 'blade') Object.assign(u, { dmg: Math.round(val(c, 'dmg', d.dmg)), interval: val(c, 'interval', d.interval), speed: val(c, 'speed', d.speed), reach: d.reach, tgt: v.tuid || 0, x: s.cores[side].x, z: s.cores[side].z + face * 1.9, px: s.cores[side].x, pz: s.cores[side].z + face * 1.9 });
    else if (kind === 'barrier') { const sh = v.shape; Object.assign(u, { x: sh.cx, z: sh.cz, px: sh.cx, pz: sh.cz, seg: { x1: sh.x1, z1: sh.z1, x2: sh.x2, z2: sh.z2, w: sh.w }, radius: d.length / 2 + 0.2, bait: -1.5, spawn: 0.3 }); }
    else if (kind === 'drone') Object.assign(u, { repair: val(c, 'repair', d.repair), speed: d.speed, reach: d.reach, bait: d.bait, acc: 0 });
    else if (kind === 'leviathan') {
      const lane = v.x < 4 ? 'L' : v.x >= 8 ? 'R' : 'C';
      Object.assign(u, { dmg: Math.round(val(c, 'dmg', d.dmg)), speed: d.speed, lane, route: SIMF().lanes(s, side)[lane], ri: 0, spin: d.spinUp, carry: null, grabCd: {}, hitT: 0.5, grappleSecs: Math.min(T().support.hold - 0.1, Math.min(T().support.grappleMax * 1.3, val(c, 'grapple', d.grapple))), face });
    }
    s.units.push(u); return u;
  }
  function deploy(s, side, id, v) {
    const sd = s.sides[side], c = sd.cards[id], d = c.def, K_ = K();
    switch (d.kind) {
      case 'slam': { const r = val(c, 'radius', d.radius); s.fx.push({ at: r6(s.t + d.windup), seq: s.nextUid++, kind: 'slam', side, card: id, x: v.x, z: v.z, r, dmg: Math.round(val(c, 'dmg', d.dmg)), stun: d.stun }); visual(s, side, id, v.x, v.z, r, d.windup + 0.9); K_.ev(s, { type: 'telegraph', side, card: id, x: v.x, z: v.z, r, windup: d.windup }); break; }
      case 'zone': s.zones.push({ id: s.nextUid++, kind: 'card', side, card: id, x: v.x, z: v.z, r: val(c, 'radius', d.radius), until: r6(s.t + val(c, 'dur', d.dur)), every: 99, next: 1e9, dmg: 0, heal: 0, slow: d.slow ? Math.min(0.85, val(c, 'slow', d.slow)) : 0, freeze: d.freeze || 0, distort: !!d.distort, seen: {} }); K_.ev(s, { type: 'zone', side, x: v.x, z: v.z, r: val(c, 'radius', d.radius), card: id }); break;
      case 'ward': { const t = K_.unitOf(s, v.tuid); AB().status(s, t, 'guard', { amt: val(c, 'guard', d.guard) * t.max, dur: val(c, 'dur', d.dur), reflect: Math.min(0.9, val(c, 'reflect', d.reflect)) }); visual(s, side, id, t.x, t.z, d.radius, val(c, 'dur', d.dur), t.uid); K_.ev(s, { type: 'ward', side, uid: t.uid }); break; }
      case 'revive': {
        const core = s.cores[side]; let best = null; sd.deck.forEach(cid => { const st = sd.hand.st[cid]; if (st.s === 'rec' && (!best || st.until > sd.hand.st[best].until + 1e-9)) best = cid; });
        if (best && H().revive(sd.hand, best)) { sd.elixirM = Math.min(T().elixir.max * SIMF().ELX, sd.elixirM + d.refund * SIMF().ELX); K_.ev(s, { type: 'revive', side, card: best }); }
        AB().friends(s, side).forEach(e => K_.heal(s, e, val(c, 'heal', d.heal) * e.max)); visual(s, side, id, core.x, core.z, 2.2, 1.6); break;
      }
      case 'rewind': {
        const want = s.t - d.rewind, e = s.hist.slice().reverse().find(h => h.t <= want + 1e-9) || s.hist[0]; let n = 0;
        if (e) s.units.forEach(u => { if (u.hp <= 0 || u.static || u.held || u.ai === 'obj' || !e.p[u.uid]) return; const p = e.p[u.uid]; if (!K_.walkable(s, p[0], p[1])) return; const route = K_.findPath(s, u.x, u.z, p[0], p[1]); if (!route || !route.length) return; route[route.length - 1] = { x: p[0], z: p[1] }; u.fm = { x: p[0], z: p[1], speed: 12, path: route }; u.path = null; if (u.order) K_.endOrder(s, u, 'rewound'); u.target = null; n++; });
        visual(s, side, id, s.w / 2, s.h / 2, 3, 1.2); K_.ev(s, { type: 'rewind', side, n }); break;
      }
      default: { const u = mkObj(s, side, id, c, v); K_.ev(s, { type: 'object', side, uid: u.uid, card: id, obj: d.kind }); if (d.kind === 'barrier') { const w = AB().placeWall(s, side, u.uid, v.shape, 1e9, id); if (w) { w.hold = true; u.wall = w.id; } } }
    }
  }
  function resolveFx(s, f) {
    if (f.kind !== 'slam') return; const K_ = K();
    AB().foes(s, f.side).forEach(e => { if (K_.dist(e.x, e.z, f.x, f.z) > f.r + e.radius) return; K_.damage(s, f.side, K_.mkT(e), f.dmg, false, 0); if (e.hp > 0 && f.stun) AB().status(s, e, 'stun', f.stun); });
    K_.ev(s, { type: 'slam', side: f.side, card: f.card, x: f.x, z: f.z, r: f.r });
  }

  // ------------------------------------------------------------------ per-step world work: expiry, rewind history, the carry watchdog
  function sample(s) {
    const K_ = K(), S = T().support;
    s.units.forEach(u => { if (u.hp > 0 && u.until != null && s.t >= u.until - 1e-9) { u.hp = 0; u.expired = true; } });
    if (!s.hist.length || s.t - s.hist[s.hist.length - 1].t >= S.historyEvery - 1e-9) {
      const p = {}; s.units.forEach(u => { if (u.hp > 0 && !u.static && u.ai !== 'obj' && !u.held) p[u.uid] = [r6(u.x), r6(u.z)]; });
      s.hist.push({ t: s.t, p }); if (s.hist.length > 10) s.hist.shift();
    }
    s.units.forEach(v => { // watchdog: nothing may be held longer than the hard limit, whatever its carrier is doing (or whether it still exists)
      if (!v.held || v.hp <= 0) return; const by = K_.unitOf(s, v.held.by);
      if (s.t - v.held.t0 >= S.hold - 1e-9 || !by || by.hp <= 0 || !by.carry || by.carry.uid !== v.uid) { if (by && by.carry && by.carry.uid === v.uid) eject(s, by, v, 'watchdog'); else release(s, v, 'watchdog'); }
    });
  }

  // ------------------------------------------------------------------ objects
  const nearestFoe = (s, u, maxD) => { let best = null, bd = maxD; AB().foes(s, u.side).forEach(e => { const d = K().dist(u.x, u.z, e.x, e.z); if (d < bd - 1e-9) { bd = d; best = e; } }); return best; };
  function flyToward(s, u, tx, tz, speed, dt) { const d = K().dist(u.x, u.z, tx, tz); if (d < 1e-6) return 0; const m = Math.min(d, speed * dt); u.x = Math.max(0.3, Math.min(s.w - 0.3, u.x + (tx - u.x) / d * m)); u.z = Math.max(0.3, Math.min(s.h - 0.3, u.z + (tz - u.z) / d * m)); u.face = tx >= u.x ? 1 : -1; return d - m; }
  function stepObject(s, u, dt) {
    const K_ = K();
    if (u.spawn > 0) { u.spawn = Math.max(0, u.spawn - dt); return; }
    switch (u.obj) {
      case 'emplacement': {
        u.cd -= dt; if (u.cd > 0) return;
        let best = null, bd = 1e9; AB().foes(s, u.side).forEach(e => { if (!AIM().hits({ t: 'line', x1: u.lane.x1, z1: u.lane.z1, x2: u.lane.x2, z2: u.lane.z2, w: u.lane.w }, e.x, e.z, e.radius)) return; const d = K_.dist(u.x, u.z, e.x, e.z); if (d < bd) { bd = d; best = e; } });
        if (!best) { u.cd = 0.15; return; } u.cd = u.interval; K_.damage(s, u.side, K_.mkT(best), u.dmg, false, u.uid); K_.ev(s, { type: 'beam', side: u.side, kind: 'bolt', pts: [{ x: u.x, z: u.z }, { x: best.x, z: best.z }] }); K_.ev(s, { type: 'attack', uid: u.uid, side: u.side }); return;
      }
      case 'blade': {
        let t = u.tgt ? K_.unitOf(s, u.tgt) : null; if (!t || !AB().isFoe(t, u.side)) { t = nearestFoe(s, u, 9); u.tgt = t ? t.uid : 0; }
        u.cd = Math.max(0, u.cd - dt); if (!t) return;
        const gap = flyToward(s, u, t.x, t.z, u.speed, dt) - t.radius; u.moving = gap > u.reach;
        if (gap <= u.reach && u.cd <= 0) { u.cd = u.interval; K_.damage(s, u.side, K_.mkT(t), u.dmg, false, u.uid); K_.ev(s, { type: 'attack', uid: u.uid, side: u.side }); } return;
      }
      case 'drone': {
        let t = null; AB().friends(s, u.side).forEach(e => { if (e.kind !== 'pet') return; const f = e.hp / e.max; if (!t || (f < 0.98 && f < t.hp / t.max - 1e-9) || (t.hp / t.max >= 0.98 && K_.dist(u.x, u.z, e.x, e.z) < K_.dist(u.x, u.z, t.x, t.z))) t = e; });
        if (!t) return; const gap = flyToward(s, u, t.x, t.z, u.speed, dt); u.moving = gap > u.reach * 0.7;
        if (gap <= u.reach && t.hp < t.max) { u.acc += u.repair * dt; if (u.acc >= 4) { K_.heal(s, t, u.acc, u.uid); u.acc = 0; } } return;
      }
      case 'leviathan': stepLeviathan(s, u, dt); return;
      default: return; // barrier: it just stands (its wall blocks the cells)
    }
  }
  function onRoverHit(s, u, tg) {
    if (u.rammed || u.obj !== 'rover' || tg.hp == null) return; u.rammed = true;
    const R = (AV.combat.defs.get(u.base) || {}).ram; if (!R) return; const v = AIM().vec(tg.x - u.x, tg.z - u.z, u.side === 'a' ? -1 : 1), p = K().reach(s, tg.x, tg.z, v.x, v.z, R.knock);
    tg.fm = { x: p.x, z: p.z, speed: 10 }; AB().status(s, tg, 'stun', R.stun); K().ev(s, { type: 'ram', uid: u.uid, to: tg.uid });
  }

  // ------------------------------------------------------------------ the Leviathan Engine
  function stepLeviathan(s, u, dt) {
    const K_ = K(), S = T().support;
    if (u.spin > 0) { u.spin = Math.max(0, u.spin - dt); u.moving = false; return; }
    if (u.carry) { // the victim rides on the Engine
      const v = K_.unitOf(s, u.carry.uid), held = v && v.hp > 0 && v.held && v.held.by === u.uid;
      if (!held) u.carry = null; else if (s.t >= u.carry.until - 1e-9 || s.t - u.carry.t0 >= S.hold - 1e-9) eject(s, u, v, 'done');
    }
    // where to go: the lane nodes in order, then the nearest enemy structure, then the Core
    let gx, gz;
    if (u.ri < u.route.length - 1) { const n = u.route[u.ri]; gx = n.x; gz = n.z; if (K_.dist(u.x, u.z, gx, gz) < 0.7) { u.ri++; u.path = null; } }
    else { let st = null, bd = 6; s.units.forEach(e => { if (e.side === u.side || e.hp <= 0 || e.spawn > 0 || !(e.kind === 'barrier' || e.kind === 'emplacement' || e.kind === 'machine')) return; const d = K_.dist(u.x, u.z, e.x, e.z); if (d < bd) { bd = d; st = e; } }); const n = u.route[u.route.length - 1]; gx = st ? st.x : n.x; gz = st ? st.z : n.z; }
    const os = K_.OTHER[u.side], core = s.cores[os], atCore = K_.dist(u.x, u.z, core.x, core.z) <= core.r + u.radius + 0.45;
    if (!atCore) {
      if (!u.path || !u.path.length) u.path = K_.findPath(s, u.x, u.z, gx, gz) || [];
      const before = u.x; K_.moveAlong(s, u, dt, K_.moveMult(s, u)); if (Math.abs(u.x - before) > 1e-4) u.face = u.x >= before ? 1 : -1;
    } else u.moving = false;
    if (u.carry) { const v = K_.unitOf(s, u.carry.uid); if (v && v.held) { v.x = u.x; v.z = u.z; v.px = u.px; v.pz = u.pz; } } // the rider follows, after the Engine has moved
    u.hitT -= dt; // contact damage: twice a second, to every enemy touching it (and the Core)
    if (u.hitT <= 0) {
      u.hitT += 0.5; const half = u.dmg * 0.5;
      s.units.forEach(e => { if (e.side === u.side || e.hp <= 0 || e.spawn > 0 || e.held || K_.dist(u.x, u.z, e.x, e.z) > u.radius + e.radius + 0.4) return; K_.damage(s, u.side, K_.mkT(e), half, false, u.uid); });
      if (atCore) K_.damage(s, u.side, { kind: 'core', side: os }, half, false, u.uid);
      if (!u.carry) { // grapple: the nearest eligible enemy Pet in contact
        let best = null, bd = 1e9; s.units.forEach(e => { if (e.side === u.side || e.hp <= 0 || e.spawn > 0 || e.held || (e.kind !== 'pet' && e.ai !== 'rover') || (u.grabCd[e.uid] || 0) > s.t) return; const d = K_.dist(u.x, u.z, e.x, e.z); if (d <= u.radius + e.radius + 0.4 && d < bd) { bd = d; best = e; } });
        if (best) grapple(s, u, best);
      }
    }
  }
  function grapple(s, u, v) {
    v.held = { by: u.uid, t0: s.t }; v.order = null; v.path = null; v.dash = null; v.cast = null; v.fm = null; v.target = null; v.moving = false;
    u.carry = { uid: v.uid, t0: s.t, until: r6(s.t + u.grappleSecs) }; v.x = u.x; v.z = u.z; K().ev(s, { type: 'grapple', uid: u.uid, to: v.uid });
  }
  /** A safe landing cell for something dropped near (x,z): open ground, nobody standing there, nearest first; always finds one. */
  function safeSpot(s, x, z, ignoreUid, route) {
    const K_ = K(), free = (cx, cz) => K_.cellOk(s, cx, cz) && !s.units.some(q => q.hp > 0 && q.uid !== ignoreUid && !q.held && K_.dist(q.x, q.z, cx + .5, cz + .5) < 0.9);
    const cells = []; for (let cz = 0; cz < s.h; cz++) for (let cx = 0; cx < s.w; cx++) if (K_.cellOk(s, cx, cz)) cells.push({ cx, cz, d: K_.dist(x, z, cx + .5, cz + .5), occ: !free(cx, cz) });
    cells.sort((a, b) => (a.occ - b.occ) || (a.d - b.d) || (a.cz - b.cz) || (a.cx - b.cx));
    const near = cells.filter(c => !c.occ && c.d >= 0.9 && c.d <= 4); // ahead along the lane when possible
    let pick = null;
    if (route) { for (const n of route) { const c = near.find(q => Math.floor(n.x) === q.cx && Math.floor(n.z) === q.cz); if (c) { pick = c; break; } } }
    pick = pick || near[0] || cells[0]; return { x: pick.cx + .5, z: pick.cz + .5 };
  }
  function eject(s, u, v, why) {
    const K_ = K(); if (!v) { u.carry = null; return; }
    const p = safeSpot(s, u.x, u.z, v.uid, u.route ? u.route.slice(u.ri) : null);
    v.x = p.x; v.z = p.z; v.px = p.x; v.pz = p.z; v.held = null; v.path = null; AB().status(s, v, 'stun', 0.5);
    u.grabCd[v.uid] = r6(s.t + T().support.grappleRegrab); u.carry = null; K_.ev(s, { type: 'eject', uid: u.uid, to: v.uid, x: p.x, z: p.z, why });
  }
  /** Release a held unit whose carrier is gone: it lands on the nearest safe open cell. */
  function release(s, v, why) { const p = safeSpot(s, v.x, v.z, v.uid, null); v.x = p.x; v.z = p.z; v.px = p.x; v.pz = p.z; v.held = null; v.path = null; K().ev(s, { type: 'eject', uid: 0, to: v.uid, x: p.x, z: p.z, why }); }
  function onRemove(s, u) {
    if (u.kind === 'barrier') AB().dropWallsOf(s, u.uid);
    if (u.obj === 'leviathan' && u.carry) { const v = K().unitOf(s, u.carry.uid); if (v && v.hp > 0) eject(s, u, v, 'carrier-gone'); u.carry = null; }
    if (u.held) { const by = K().unitOf(s, u.held.by); if (by && by.carry && by.carry.uid === u.uid) by.carry = null; }
  }

  AV.combat.support = { attr, val, check, shapeFor, active, deploy, resolveFx, sample, stepObject, onRoverHit, onRemove, safeSpot, grapple, eject, release, ownHalf };
})();
