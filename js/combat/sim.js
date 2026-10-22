/* AETHERVAULT — Combat simulation core. Pure and deterministic: fixed 1/30 s step, seeded PRNG stream, no DOM, no Math.random, no clock reads.
 * Rendering interpolates between steps; nothing here knows about pixels. State is plain data (JSON-friendly) so tests, replays and AI fairness checks are easy.
 *
 *   const s = AV.combat.sim.create({ seed, specs: save.specimens, a: { deck: [ids] }, training: true })
 *   AV.combat.sim.command(s, { side: 'a', type: 'deploy', id, x, z })      queued, applied at the start of the next step
 *   AV.combat.sim.step(s)                                                 advance one fixed step; returns false once the match is over
 *
 * Sides: 'a' is the player (lower half, z large), 'b' the opponent (upper half, z small). Coordinates are arena cells; z grows toward the player.
 * Combat A scope: deployment with Elixir and the 4-card hand, movement on a nav grid (river with one bridge, a little cover), targeting and basic attacks
 * (melee instantly, ranged by projectile), Cores, the 2:00 timer with its regen step and Final Surge, a simple time-limit result. A training dummy stands in
 * for the opponent. Abilities, move orders, support cards, the AI and the full time-limit resolver arrive in Combat B and C. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const T = () => AV.combat.tuning, H = () => AV.combat.hand, DF = () => AV.combat.defs;
  const SIDES = ['a', 'b'], OTHER = { a: 'b', b: 'a' }, ELX = 1000; // Elixir is held as integer milli-points so regen never drifts

  function rand(s) { s.rng = (s.rng + 0x6D2B79F5) | 0; let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

  // ------------------------------------------------------------------ arena / nav
  /** Static map: river across the middle with one bridge, a little cover on each half, both Cores' footprints. Returns { w, h, blocked[], cores }. */
  function buildArena() {
    const A = T().arena, w = A.w, h = A.h, blocked = new Array(w * h).fill(0), set = (x, z) => { if (x >= 0 && x < w && z >= 0 && z < h) blocked[z * w + x] = 1; };
    const mid = Math.floor(h / 2); for (let x = 0; x < w; x++) if (x < A.bridge.x0 || x >= A.bridge.x1) { set(x, mid - 1); set(x, mid); }       // river: 2 rows
    [[3, 5], [8, 5], [3, 12], [8, 12]].forEach(([x, z]) => { set(x, z); set(x, z + 1); });                                     // cover blocks
    const cores = { a: { x: w / 2, z: h - A.core.offset, r: A.core.radius }, b: { x: w / 2, z: A.core.offset, r: A.core.radius } };
    SIDES.forEach(k => { const c = cores[k]; for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (dist(x + .5, z + .5, c.x, c.z) < c.r + 0.35) set(x, z); });
    return { w, h, blocked, cores };
  }
  const cellOk = (s, cx, cz) => cx >= 0 && cz >= 0 && cx < s.w && cz < s.h && !s.blocked[cz * s.w + cx];
  const walkable = (s, x, z) => cellOk(s, Math.floor(x), Math.floor(z));

  /** A* on the cell grid, 8-way with no corner cutting. Returns an array of {x,z} waypoints (cell centres; the last is the goal point) or null. */
  function findPath(s, fx, fz, tx, tz) {
    const w = s.w, h = s.h; let sx = Math.floor(fx), sz = Math.floor(fz), gx = Math.floor(tx), gz = Math.floor(tz);
    sx = Math.max(0, Math.min(w - 1, sx)); sz = Math.max(0, Math.min(h - 1, sz)); gx = Math.max(0, Math.min(w - 1, gx)); gz = Math.max(0, Math.min(h - 1, gz));
    if (!cellOk(s, gx, gz)) { // nearest open cell to the goal
      let best = null, bd = 1e9; for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (cellOk(s, x, z)) { const d = (x - gx) * (x - gx) + (z - gz) * (z - gz); if (d < bd) { bd = d; best = [x, z]; } }
      if (!best) return null; gx = best[0]; gz = best[1];
    }
    const N = w * h, g = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), open = [], idx = (x, z) => z * w + x;
    const hf = (x, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    g[idx(sx, sz)] = 0; open.push(idx(sx, sz));
    while (open.length) {
      let bi = 0, bf = Infinity; for (let i = 0; i < open.length; i++) { const n = open[i], f = g[n] + hf(n % w, (n / w) | 0); if (f < bf - 1e-9 || (Math.abs(f - bf) <= 1e-9 && n < open[bi])) { bf = f; bi = i; } }
      const cur = open.splice(bi, 1)[0]; if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % w, cz = (cur / w) | 0; if (cx === gx && cz === gz) break;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (!cellOk(s, nx, nz)) continue;
        if (dx && dz && (!cellOk(s, cx + dx, cz) || !cellOk(s, cx, cz + dz))) continue;
        const ni = idx(nx, nz), ng = g[cur] + (dx && dz ? Math.SQRT2 : 1); if (ng < g[ni] - 1e-9) { g[ni] = ng; from[ni] = cur; open.push(ni); }
      }
    }
    const gi = idx(gx, gz); if (from[gi] === -1 && !(sx === gx && sz === gz)) return null;
    const path = []; for (let n = gi; n !== -1 && n !== idx(sx, sz); n = from[n]) path.push({ x: n % w + .5, z: ((n / w) | 0) + .5 });
    return path.reverse();
  }

  // ------------------------------------------------------------------ creation
  function create(o) {
    const A = buildArena(), s = { v: 1, seed: o.seed | 0, rng: (o.seed | 0) ^ 0x5bd1e995, t: 0, tick: 0, dt: T().step, w: A.w, h: A.h, blocked: A.blocked, cores: {}, sides: {}, units: [], proj: [], nextUid: 1, events: [], cmds: [], over: null,
      stats: { a: { coreDmg: 0, unitDmg: 0, overkill: 0, dealt: 0 }, b: { coreDmg: 0, unitDmg: 0, overkill: 0, dealt: 0 } }, training: !!o.training, dummyAt: null };
    SIDES.forEach(k => { const c = A.cores[k], hp = T().arena.core.hp; s.cores[k] = { x: c.x, z: c.z, r: c.r, hp, max: hp }; });
    SIDES.forEach(k => {
      const side = o[k]; if (!side) { s.sides[k] = null; return; }
      const cards = {}, ids = [];
      (side.deck || []).forEach(id => { const spec = (o.specs || {})[id], v = DF().readiness(spec); if (!v.ok || cards[id]) return; const t = AV.combat.translate(spec); if (!t.ok) return; cards[id] = { id, base: spec.base, def: t.def, t }; ids.push(id); });
      s.sides[k] = { elixirM: (side.elixir != null ? side.elixir : T().elixir.start) * ELX, cards, deck: ids, hand: H().init(ids, (s.seed ^ (k === 'a' ? 0x1111 : 0x2222)) | 0), deployCount: {}, uid: {}, spent: 0 };
    });
    if (s.training) spawnDummy(s);
    return s;
  }
  function spawnDummy(s) {
    const u = { uid: s.nextUid++, side: 'b', kind: 'dummy', base: 'dummy', hp: 600, max: 600, x: s.w / 2 + 1, z: 5.5, px: s.w / 2 + 1, pz: 5.5, radius: 0.55, spawn: 0, cd: 0, target: null, path: null, rt: 0, static: true };
    s.units.push(u); s.dummyAt = null; return u;
  }

  // ------------------------------------------------------------------ queries
  const elixirOf = (s, side) => (s.sides[side] ? s.sides[side].elixirM / ELX : 0);
  function phase(s) { const M = T().match; return s.over ? 'over' : s.t >= M.surgeAt ? 'surge' : s.t >= M.regenStepAt ? 'step' : 'normal'; }
  const regenMult = s => { const M = T().match, E = T().elixir; return s.t >= M.surgeAt ? E.surgeMult : s.t >= M.regenStepAt ? E.regenStepMult : 1; };
  /** Elixir a card costs RIGHT NOW (base + redeploy surcharge, match-local). */
  function costOf(s, side, id) { const sd = s.sides[side], c = sd && sd.cards[id]; if (!c) return 0; return c.def.cost + Math.min(T().pet.redeployCap, sd.deployCount[id] || 0) * T().pet.redeploySurcharge; }
  const unitAt = (s, x, z, r) => s.units.find(u => u.hp > 0 && dist(u.x, u.z, x, z) < r);
  /** Deployment check: hand, Elixir, own half, open ground. Returns { ok, reason, cost, x, z } with x/z snapped to the cell centre. */
  function canDeploy(s, side, id, x, z) {
    const sd = s.sides[side]; if (s.over) return { ok: false, reason: 'The match is over.' };
    if (!sd || !sd.cards[id]) return { ok: false, reason: 'Not in this deck.' };
    if (!sd.hand.hand.includes(id)) return { ok: false, reason: 'Not in your hand.' };
    const cost = costOf(s, side, id); if (sd.elixirM < cost * ELX) return { ok: false, reason: 'Not enough Elixir.', cost };
    const rows = side === 'a' ? T().arena.deploy.playerRows : T().arena.deploy.enemyRows, cx = Math.floor(x), cz = Math.floor(z);
    if (cz < rows[0] || cz > rows[1] || cx < 0 || cx >= s.w) return { ok: false, reason: 'Outside your deployment zone.', cost };
    if (!cellOk(s, cx, cz)) return { ok: false, reason: 'That ground is blocked.', cost };
    const px = cx + .5, pz = cz + .5; if (unitAt(s, px, pz, 0.95)) return { ok: false, reason: 'Occupied.', cost };
    return { ok: true, reason: '', cost, x: px, z: pz };
  }
  const aliveUnits = (s, side) => s.units.filter(u => u.hp > 0 && (!side || u.side === side));

  // ------------------------------------------------------------------ commands
  function command(s, cmd) { s.cmds.push(cmd); }
  function apply(s, cmd) {
    const sd = s.sides[cmd.side]; if (!sd || s.over) return;
    if (cmd.type === 'deploy') {
      const v = canDeploy(s, cmd.side, cmd.id, cmd.x, cmd.z); if (!v.ok) { s.events.push({ t: s.t, type: 'denied', side: cmd.side, id: cmd.id, reason: v.reason }); return; }
      const c = sd.cards[cmd.id], t = c.t; sd.elixirM -= v.cost * ELX; sd.spent += v.cost; sd.deployCount[cmd.id] = (sd.deployCount[cmd.id] || 0) + 1;
      H().play(sd.hand, cmd.id, 'pet');
      const u = { uid: s.nextUid++, side: cmd.side, kind: 'pet', card: cmd.id, base: c.base, role: c.def.role, atk: c.def.atk, hit: c.def.hit, hp: t.hp, max: t.hp, dmg: t.dmg, range: t.range, speed: t.speed, interval: t.interval, aggro: t.aggro, crit: t.crit, radius: c.def.radius,
        x: v.x, z: v.z, px: v.x, pz: v.z, spawn: T().pet.deployDelay, cd: 0, target: null, path: null, rt: 0, face: cmd.side === 'a' ? -1 : 1 };
      s.units.push(u); sd.uid[cmd.id] = u.uid; s.events.push({ t: s.t, type: 'deploy', side: cmd.side, id: cmd.id, uid: u.uid, cost: v.cost });
    } else if (cmd.type === 'reshuffle') {
      const cost = T().hand.reshuffleCost; if (sd.elixirM < cost * ELX) { s.events.push({ t: s.t, type: 'denied', side: cmd.side, reason: 'Not enough Elixir.' }); return; }
      const r = H().reshuffle(sd.hand, s.t); if (!r.ok) { s.events.push({ t: s.t, type: 'denied', side: cmd.side, reason: 'Reshuffle cooling down.' }); return; }
      sd.elixirM -= cost * ELX; sd.spent += cost; s.events.push({ t: s.t, type: 'reshuffle', side: cmd.side });
    }
  }

  // ------------------------------------------------------------------ combat
  const targetPos = (s, tg) => (tg.kind === 'core' ? s.cores[tg.side] : s.units.find(u => u.uid === tg.uid));
  function damage(s, srcSide, tg, amount, crit, from) {
    const dmg = Math.max(1, Math.round(amount * (crit ? T().combat.critMult : 1))), st = s.stats[srcSide];
    if (tg.kind === 'core') { const c = s.cores[tg.side], real = Math.min(c.hp, dmg); c.hp -= real; st.coreDmg += real; st.overkill += dmg - real; st.dealt += real; s.events.push({ t: s.t, type: 'hit', side: srcSide, from, core: tg.side, amt: real, crit }); return; }
    const u = s.units.find(x => x.uid === tg.uid); if (!u || u.hp <= 0 || u.spawn > 0) return;
    const real = Math.min(u.hp, dmg); u.hp -= real; st.overkill += dmg - real; if (u.kind === 'pet') { st.unitDmg += real; st.dealt += real; }
    s.events.push({ t: s.t, type: 'hit', side: srcSide, from, to: u.uid, amt: real, crit });
  }
  function chooseTarget(s, u) {
    let best = null, bd = u.aggro;
    for (const e of s.units) { if (e.hp <= 0 || e.side === u.side || e.spawn > 0) continue; const d = dist(u.x, u.z, e.x, e.z); if (d < bd - 1e-9) { bd = d; best = e; } }
    return best ? { kind: 'unit', uid: best.uid, side: best.side } : { kind: 'core', side: OTHER[u.side] };
  }
  function stepUnit(s, u, dt) {
    if (u.static || u.kind !== 'pet') return;
    if (u.spawn > 0) { u.spawn = Math.max(0, u.spawn - dt); return; }
    u.cd = Math.max(0, u.cd - dt); u.rt -= dt;
    let tg = u.target && targetPos(s, u.target); const tgOk = tg && (u.target.kind === 'core' || (tg.hp > 0 && tg.spawn <= 0));
    if (!tgOk || u.rt <= 0) { const nt = chooseTarget(s, u); if (!u.target || nt.kind !== u.target.kind || nt.uid !== u.target.uid || nt.side !== u.target.side) { u.target = nt; u.path = null; } else if (nt.kind === 'unit') u.path = null; u.rt = T().combat.retarget; tg = targetPos(s, u.target); }
    const tr = u.target.kind === 'core' ? tg.r : tg.radius, d = dist(u.x, u.z, tg.x, tg.z) - tr;
    if (d <= u.range - 0.05) { // in range: face it, stand still, attack when ready
      u.face = tg.x >= u.x ? 1 : -1; u.moving = false;
      if (u.cd <= 0) {
        u.cd = u.interval; const crit = u.crit > 0 && rand(s) < u.crit;
        if (u.atk === 'ranged') s.proj.push({ uid: s.nextUid++, side: u.side, from: u.uid, x: u.x, z: u.z, px: u.x, pz: u.z, tg: { kind: u.target.kind, uid: u.target.uid, side: u.target.side }, speed: 12, dmg: u.dmg, crit, hit: u.hit });
        else damage(s, u.side, u.target, u.dmg, crit, u.uid);
        s.events.push({ t: s.t, type: 'attack', uid: u.uid, side: u.side });
      }
      return;
    }
    // approach: path to the target's cell, follow waypoints
    if (!u.path || !u.path.length) { u.path = findPath(s, u.x, u.z, tg.x, tg.z) || []; }
    let move = u.speed * dt; u.moving = true;
    while (move > 1e-6 && u.path.length) {
      const wp = u.path[0], wd = dist(u.x, u.z, wp.x, wp.z);
      if (wd <= move) { u.x = wp.x; u.z = wp.z; move -= wd; u.path.shift(); } else { u.x += (wp.x - u.x) / wd * move; u.z += (wp.z - u.z) / wd * move; move = 0; }
    }
    if (!u.path.length && d > u.range) u.path = null; // arrived at the goal cell but still out of range: re-plan next step
    if (tg.x !== u.x) u.face = tg.x >= u.x ? 1 : -1;
  }
  function stepProj(s, p, dt) {
    const tgt = p.tg.kind === 'core' ? s.cores[p.tg.side] : s.units.find(u => u.uid === p.tg.uid && u.hp > 0);
    if (!tgt) { p.dead = true; return; }
    const d = dist(p.x, p.z, tgt.x, tgt.z), stepD = p.speed * dt;
    if (d <= stepD + (tgt.radius || tgt.r) * 0.4) { damage(s, p.side, p.tg, p.dmg, p.crit, p.from); p.dead = true; } else { p.x += (tgt.x - p.x) / d * stepD; p.z += (tgt.z - p.z) / d * stepD; }
  }
  /** Soft separation so units do not stack; never pushes onto blocked ground. */
  function separate(s) {
    const us = s.units.filter(u => u.hp > 0 && u.spawn <= 0 && !u.static);
    for (let i = 0; i < us.length; i++) for (let j = 0; j < s.units.length; j++) {
      const a = us[i], b = s.units[j]; if (a === b || b.hp <= 0 || (b.kind === 'pet' && b.uid < a.uid)) continue;
      const d = dist(a.x, a.z, b.x, b.z), min = a.radius + b.radius; if (d >= min || d < 1e-6) continue;
      const push = (min - d) / 2 * (b.static ? 2 : 1), nx = (a.x - b.x) / d, nz = (a.z - b.z) / d;
      const ax = a.x + nx * push, az = a.z + nz * push; if (walkable(s, ax, az)) { a.x = ax; a.z = az; }
      if (!b.static) { const bx = b.x - nx * push, bz = b.z - nz * push; if (walkable(s, bx, bz)) { b.x = bx; b.z = bz; } }
    }
  }

  // ------------------------------------------------------------------ the step
  function step(s) {
    if (s.over) return false;
    const dt = s.dt, E = T().elixir, M = T().match;
    s.cmds.splice(0).forEach(c => apply(s, c));
    s.tick++; s.t = +(s.tick * dt).toFixed(6);
    SIDES.forEach(k => { const sd = s.sides[k]; if (!sd) return; const cap = E.max * ELX; if (sd.elixirM < cap) sd.elixirM = Math.min(cap, sd.elixirM + Math.round(E.regen * ELX * regenMult(s) * dt)); H().tick(sd.hand, s.t); });
    s.units.forEach(u => { u.px = u.x; u.pz = u.z; });
    s.units.forEach(u => { if (u.hp > 0) stepUnit(s, u, dt); });
    s.proj.forEach(p => { p.px = p.x; p.pz = p.z; stepProj(s, p, dt); }); s.proj = s.proj.filter(p => !p.dead);
    separate(s);
    const gone = s.units.filter(u => u.hp <= 0);
    gone.forEach(u => {
      s.events.push({ t: s.t, type: 'death', uid: u.uid, side: u.side, kind: u.kind, card: u.card });
      if (u.kind === 'pet') { const sd = s.sides[u.side], r = T().pet.recover; H().defeat(sd.hand, u.card, s.t + r[0] + rand(s) * (r[1] - r[0])); delete sd.uid[u.card]; }
      else if (u.kind === 'dummy') s.dummyAt = s.t + 6;
    });
    if (gone.length) s.units = s.units.filter(u => u.hp > 0);
    if (s.dummyAt != null && s.t >= s.dummyAt) spawnDummy(s);
    if (s.events.length > 240) s.events.splice(0, s.events.length - 240);
    // match end
    SIDES.forEach(k => { if (!s.over && s.cores[k].hp <= 0) s.over = { winner: OTHER[k], reason: 'breach', t: s.t }; });
    if (!s.over && s.t >= M.duration) {
      const pa = s.cores.b.hp / s.cores.b.max, pb = s.cores.a.hp / s.cores.a.max; // share of each Core still standing; the lower one lost more
      s.over = { winner: pa < pb ? 'a' : pb < pa ? 'b' : null, reason: pa === pb ? 'draw' : 'time', t: s.t, basic: true }; // full resolver and sudden death: Combat C
    }
    return !s.over;
  }
  /** Run n steps (stops early when the match ends). */
  function run(s, n) { for (let i = 0; i < n; i++) if (!step(s)) break; return s; }

  /** Stable fingerprint of everything that matters, for determinism tests. */
  function hash(s) {
    const parts = [s.tick, s.rng, s.cores.a.hp, s.cores.b.hp]; SIDES.forEach(k => { const sd = s.sides[k]; if (sd) parts.push(sd.elixirM, sd.hand.hand.join(','), sd.hand.recent.join(','), sd.hand.rng); });
    s.units.forEach(u => parts.push(u.uid, u.hp, Math.round(u.x * 1000), Math.round(u.z * 1000), Math.round(u.cd * 1000))); s.proj.forEach(p => parts.push('p', p.uid, Math.round(p.x * 1000), Math.round(p.z * 1000)));
    const str = parts.join('|'); let hh = 2166136261; for (let i = 0; i < str.length; i++) { hh ^= str.charCodeAt(i); hh = Math.imul(hh, 16777619); } return (hh >>> 0).toString(16);
  }
  /** What a renderer/HUD needs for one side, without exposing internals. */
  function view(s, side) {
    const sd = s.sides[side];
    return { t: s.t, left: Math.max(0, T().match.duration - s.t), phase: phase(s), over: s.over, elixir: sd ? sd.elixirM / ELX : 0, elixirMax: T().elixir.max,
      hand: sd ? sd.hand.hand.map(id => { const c = sd.cards[id]; return { id, base: c.base, role: c.def.role, cost: costOf(s, side, id), ok: sd.elixirM >= costOf(s, side, id) * ELX }; }) : [],
      reshuffle: sd ? { ok: H().canReshuffle(sd.hand, s.t) && sd.elixirM >= T().hand.reshuffleCost * ELX, wait: Math.max(0, sd.hand.lockUntil - s.t) } : null,
      deck: sd ? sd.deck.map(id => { const c = sd.hand.st[id]; return { id, base: sd.cards[id].base, state: c.s, wait: c.s === 'rec' ? Math.max(0, c.until - s.t) : 0 }; }) : [],
      cores: { a: { hp: s.cores.a.hp, max: s.cores.a.max }, b: { hp: s.cores.b.hp, max: s.cores.b.max } } };
  }

  AV.combat.sim = { create, step, run, command, canDeploy, costOf, elixirOf, phase, view, hash, findPath, walkable, aliveUnits, buildArena, rand, ELX };
})();
