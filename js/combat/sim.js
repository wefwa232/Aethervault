/* AETHERVAULT — Combat simulation core. Pure and deterministic: fixed 1/30 s step, seeded PRNG stream, no DOM, no Math.random, no clock reads.
 * Rendering interpolates between steps; nothing here knows about pixels. State is plain data (JSON-friendly) so tests, replays and AI fairness checks are easy.
 *
 *   const s = AV.combat.sim.create({ seed, specs: save.specimens, a: { deck: [ids] }, training: true })
 *   AV.combat.sim.command(s, { side: 'a', type: 'deploy', id, x, z })      queued, applied at the start of the next step
 *   AV.combat.sim.step(s)                                                 advance one fixed step; returns false once the match is over
 *
 * Sides: 'a' is the player (lower half, z large), 'b' the opponent (upper half, z small). Coordinates are arena cells; z grows toward the player.
 * Commands (all validated here, so a UI can only ask):  deploy · move · stop · target · ability · cancelq · reshuffle
 *   move     walk to a cell (never a teleport). 5 s cooldown per Pet, set when the order is accepted. Ends on arrival, `stop`, a block, being carried, or death.
 *   target   a SOFT priority target. Interrupts (each emits `prioend`): the target is defeated or not targetable, farther than the leash, the hold time ran out,
 *            or a taunt overrides it (it resumes afterwards). A priority target never overrides a move order; the Pet walks first, then engages.
 *   ability  Q/E: cast now, or queue one manual use (max one per ability) that fires when the cooldown ends. R: manual only, needs a full charge.
 * Module split: this file = rules for units, orders, targeting, damage, projectiles, deaths, the clock. abil.js = statuses, abilities, zones, walls.
 * support.js = the twelve support cards (objects, effects, the Leviathan Engine). Both register themselves on AV.combat and are optional at load time. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const T = () => AV.combat.tuning, H = () => AV.combat.hand, DF = () => AV.combat.defs, AB = () => AV.combat.abil, SU = () => AV.combat.support, AIM = () => AV.combat.aim;
  const SIDES = ['a', 'b'], OTHER = { a: 'b', b: 'a' }, ELX = 1000; // Elixir is held as integer milli-points so regen never drifts
  const NO = {};

  function rand(s) { s.rng = (s.rng + 0x6D2B79F5) | 0; let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const unitOf = (s, uid) => { for (let i = 0; i < s.units.length; i++) if (s.units[i].uid === uid) return s.units[i]; return null; };
  const ev = (s, o) => { o.t = s.t; s.events.push(o); return o; };

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
  /** Open ground: inside the board, not static terrain, not a live barrier cell. */
  const cellOk = (s, cx, cz) => cx >= 0 && cz >= 0 && cx < s.w && cz < s.h && !s.blocked[cz * s.w + cx] && !s.dyn[cz * s.w + cx];
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
  /** The three fixed lanes (left, centre, right) for a side: own entry node → bridge → enemy-half exit node → the Core. Used by lane-following machines. */
  function lanes(s, side) {
    const A = T().arena, mid = Math.floor(s.h / 2), fz = side === 'a' ? -1 : 1, front = side === 'a' ? A.deploy.playerRows[0] + .5 : A.deploy.enemyRows[1] + .5, back = side === 'a' ? A.deploy.enemyRows[1] - .5 : A.deploy.playerRows[0] + 1.5;
    const bx = (A.bridge.x0 + A.bridge.x1) / 2, south = side === 'a' ? mid + 1.5 : mid - 2.5, north = side === 'a' ? mid - 2.5 : mid + 1.5, core = s.cores[OTHER[side]], out = {};
    [['L', 1.5], ['C', bx], ['R', s.w - 1.5]].forEach(([k, x]) => { out[k] = [{ x, z: front }, { x: bx, z: south }, { x: bx, z: north }, { x: k === 'C' ? bx : x, z: back }, { x: core.x, z: core.z + (fz > 0 ? -core.r - .6 : core.r + .6) }]; });
    return out;
  }

  // ------------------------------------------------------------------ creation
  function create(o) {
    const A = buildArena(), s = { v: 2, seed: o.seed | 0, rng: (o.seed | 0) ^ 0x5bd1e995, t: 0, tick: 0, dt: T().step, w: A.w, h: A.h, blocked: A.blocked, dyn: new Array(A.w * A.h).fill(0), cores: {}, sides: {}, units: [], proj: [], nextUid: 1, events: [], cmds: [], over: null,
      fx: [], zones: [], walls: [], hist: [], hostile: !!o.hostile, spots: [],
      stats: { a: { coreDmg: 0, unitDmg: 0, overkill: 0, dealt: 0 }, b: { coreDmg: 0, unitDmg: 0, overkill: 0, dealt: 0 } }, training: !!o.training };
    SIDES.forEach(k => { const c = A.cores[k], hp = T().arena.core.hp; s.cores[k] = { x: c.x, z: c.z, r: c.r, hp, max: hp }; });
    SIDES.forEach(k => {
      const side = o[k]; if (!side) { s.sides[k] = null; return; }
      const cards = {}, ids = [];
      (side.deck || []).forEach(id => { const spec = (o.specs || {})[id], v = DF().readiness(spec); if (!v.ok || cards[id]) return; const t = AV.combat.translate(spec); if (!t.ok) return; cards[id] = { id, base: spec.base, def: t.def, t }; ids.push(id); });
      s.sides[k] = { elixirM: (side.elixir != null ? side.elixir : T().elixir.start) * ELX, cards, deck: ids, hand: H().init(ids, (s.seed ^ (k === 'a' ? 0x1111 : 0x2222)) | 0), deployCount: {}, uid: {}, spent: 0, moveCd: {} };
    });
    if (s.training) { const n = Math.max(1, Math.min(3, o.dummies | 0 || 1)); [[s.w / 2 + 1, 5.5], [s.w / 2 - 2.5, 4.5], [s.w / 2 + 3.5, 3.5]].slice(0, n).forEach((p, i) => { s.spots.push({ x: p[0], z: p[1], at: null, uid: 0 }); spawnDummy(s, i); }); }
    return s;
  }
  function spawnDummy(s, i) {
    const sp = s.spots[i], u = { uid: s.nextUid++, side: 'b', kind: 'dummy', ai: 'dummy', base: 'dummy', hp: 600, max: 600, x: sp.x, z: sp.z, px: sp.x, pz: sp.z, radius: 0.55, spawn: 0, cd: 0, target: null, path: null, rt: 0, static: true, spot: i, st: {}, strike: 0 };
    s.units.push(u); sp.at = null; sp.uid = u.uid; return u;
  }

  // ------------------------------------------------------------------ queries
  const elixirOf = (s, side) => (s.sides[side] ? s.sides[side].elixirM / ELX : 0);
  function phase(s) { const M = T().match; return s.over ? 'over' : s.t >= M.surgeAt ? 'surge' : s.t >= M.regenStepAt ? 'step' : 'normal'; }
  const regenMult = s => { const M = T().match, E = T().elixir; return s.t >= M.surgeAt ? E.surgeMult : s.t >= M.regenStepAt ? E.regenStepMult : 1; };
  /** Elixir a card costs RIGHT NOW (base + redeploy surcharge, match-local; support cards never carry a surcharge). */
  function costOf(s, side, id) { const sd = s.sides[side], c = sd && sd.cards[id]; if (!c) return 0; if (c.def.cat !== 'pet') return c.def.cost; return c.def.cost + Math.min(T().pet.redeployCap, sd.deployCount[id] || 0) * T().pet.redeploySurcharge; }
  const unitAt = (s, x, z, r) => { for (let i = 0; i < s.units.length; i++) { const u = s.units[i]; if (u.hp > 0 && dist(u.x, u.z, x, z) < r) return u; } return null; };
  /** Deployment check: hand, Elixir, then the card's own placement rule. Returns { ok, reason, cost, x, z, shape? } with x/z snapped for units. aim: { tuid } for cards that pick a unit. */
  function canDeploy(s, side, id, x, z, aim) {
    const sd = s.sides[side]; if (s.over) return { ok: false, reason: 'The match is over.' };
    if (!sd || !sd.cards[id]) return { ok: false, reason: 'Not in this deck.' };
    if (!sd.hand.hand.includes(id)) return { ok: false, reason: 'Not in your hand.' };
    const cost = costOf(s, side, id); if (sd.elixirM < cost * ELX) return { ok: false, reason: 'Not enough Elixir.', cost };
    const c = sd.cards[id];
    if (c.def.cat !== 'pet') { const r = SU() ? SU().check(s, side, id, x, z, aim) : { ok: false, reason: 'Support cards are not available.' }; r.cost = cost; return r; }
    const rows = side === 'a' ? T().arena.deploy.playerRows : T().arena.deploy.enemyRows, cx = Math.floor(x), cz = Math.floor(z);
    if (cz < rows[0] || cz > rows[1] || cx < 0 || cx >= s.w) return { ok: false, reason: 'Outside your deployment zone.', cost };
    if (!cellOk(s, cx, cz)) return { ok: false, reason: 'That ground is blocked.', cost };
    const px = cx + .5, pz = cz + .5; if (unitAt(s, px, pz, 0.95)) return { ok: false, reason: 'Occupied.', cost };
    return { ok: true, reason: '', cost, x: px, z: pz };
  }
  const aliveUnits = (s, side) => s.units.filter(u => u.hp > 0 && (!side || u.side === side));
  /** Can a side's unit currently be targeted/affected? (alive, finished arriving) */
  const live = e => e.hp > 0 && e.spawn <= 0;
  const active = (u, key, now) => { const v = u.st && u.st[key]; return !!v && (typeof v === 'number' ? v : v.until) > now; };
  /** Movement multiplier from statuses: 0 when rooted or stunned, else the strongest slow (never below the floor). */
  function moveMult(s, u) { if (active(u, 'root', s.t) || active(u, 'stun', s.t)) return 0; const sl = u.st && u.st.slow; return sl && sl.until > s.t ? Math.max(T().ability.slowFloor, sl.m) : 1; }
  const dullMult = (s, u) => { const d = u.st && u.st.dull; return d && d.until > s.t ? d.m : 1; };

  // ------------------------------------------------------------------ commands
  function command(s, cmd) { s.cmds.push(cmd); }
  const petOf = (s, side, uid) => { const u = unitOf(s, uid); return u && u.side === side && u.kind === 'pet' && u.hp > 0 ? u : null; };
  /** Can this Pet be told to walk to (x,z) right now? Returns { ok, reason, wait?, x, z, path }. Read-only: a UI asks this before it shows an order marker. */
  function canMove(s, side, uid, x, z) {
    const sd = s.sides[side], u = petOf(s, side, uid); if (s.over) return { ok: false, reason: 'The match is over.' };
    if (!u) return { ok: false, reason: 'Select one of your Pets.' };
    if (u.spawn > 0) return { ok: false, reason: 'Still arriving.' };
    if (u.held) return { ok: false, reason: 'Being carried.' };
    const wait = (sd.moveCd[u.card] || 0) - s.t; if (wait > 1e-6) return { ok: false, reason: `Move order cooling down (${Math.ceil(wait)} s).`, wait };
    const cx = Math.floor(x), cz = Math.floor(z); if (!cellOk(s, cx, cz)) return { ok: false, reason: 'That ground is blocked.' };
    const px = cx + .5, pz = cz + .5; if (dist(u.x, u.z, px, pz) < T().pet.orderArrive) return { ok: false, reason: 'Already there.' };
    const path = findPath(s, u.x, u.z, px, pz); if (!path || !path.length) return { ok: false, reason: 'No route there.' };
    return { ok: true, reason: '', x: px, z: pz, path };
  }
  /** Can this Pet be told to prioritise the given target (an enemy unit uid, or 'core')? */
  function canTarget(s, side, uid, tuid) {
    const u = petOf(s, side, uid); if (!u) return { ok: false, reason: 'Select one of your Pets.' }; if (s.over) return { ok: false, reason: 'The match is over.' };
    if (tuid === 'core') return { ok: true, reason: '', kind: 'core' };
    const e = unitOf(s, tuid); if (!e || e.side === side || e.hp <= 0) return { ok: false, reason: 'Not a valid target.' }; if (e.spawn > 0) return { ok: false, reason: 'It cannot be targeted yet.' };
    return { ok: true, reason: '', kind: 'unit' };
  }
  function endOrder(s, u, why) { if (!u.order) return; u.order = null; u.path = null; u.target = null; ev(s, { type: 'orderend', uid: u.uid, side: u.side, why }); }
  function endPrio(s, u, why) { if (!u.prio) return; u.prio = null; u.target = null; ev(s, { type: 'prioend', uid: u.uid, side: u.side, why }); }
  function denied(s, cmd, reason) { ev(s, { type: 'denied', side: cmd.side, id: cmd.id, uid: cmd.uid, reason }); }
  function apply(s, cmd) {
    const sd = s.sides[cmd.side]; if (!sd || s.over) return;
    if (cmd.type === 'deploy') {
      const v = canDeploy(s, cmd.side, cmd.id, cmd.x, cmd.z, cmd.aim); if (!v.ok) { denied(s, cmd, v.reason); return; }
      const c = sd.cards[cmd.id], t = c.t; sd.elixirM -= v.cost * ELX; sd.spent += v.cost; sd.deployCount[cmd.id] = (sd.deployCount[cmd.id] || 0) + 1;
      if (c.def.cat !== 'pet') { H().play(sd.hand, cmd.id, 'support'); SU().deploy(s, cmd.side, cmd.id, v); ev(s, { type: 'deploy', side: cmd.side, id: cmd.id, support: true, cost: v.cost, x: v.x, z: v.z }); return; }
      H().play(sd.hand, cmd.id, 'pet');
      const ab = c.def.abilities, ps = c.def.passive;
      const u = { uid: s.nextUid++, side: cmd.side, kind: 'pet', ai: 'pet', card: cmd.id, base: c.base, role: c.def.role, atk: c.def.atk, hit: c.def.hit, hp: t.hp, max: t.hp, dmg: t.dmg, dmg0: c.def.dmg, range: t.range, speed: t.speed, interval: t.interval, aggro: t.aggro, crit: t.crit, radius: c.def.radius,
        x: v.x, z: v.z, px: v.x, pz: v.z, spawn: T().pet.deployDelay, cd: 0, target: null, path: null, rt: 0, face: cmd.side === 'a' ? -1 : 1,
        st: {}, cdr: t.cdr, charge: 0, cdq: { q: 0, e: 0, r: 0 }, queue: {}, order: null, prio: null, armor: ps && ps.armor || 0, abil: ab || null, aura: ps && ps.aura || null, auraT: 0 };
      s.units.push(u); sd.uid[cmd.id] = u.uid; delete sd.moveCd[cmd.id]; ev(s, { type: 'deploy', side: cmd.side, id: cmd.id, uid: u.uid, cost: v.cost });
    } else if (cmd.type === 'reshuffle') {
      const cost = T().hand.reshuffleCost; if (sd.elixirM < cost * ELX) { denied(s, cmd, 'Not enough Elixir.'); return; }
      const r = H().reshuffle(sd.hand, s.t); if (!r.ok) { denied(s, cmd, 'Reshuffle cooling down.'); return; }
      sd.elixirM -= cost * ELX; sd.spent += cost; ev(s, { type: 'reshuffle', side: cmd.side });
    } else if (cmd.type === 'move') {
      const v = canMove(s, cmd.side, cmd.uid, cmd.x, cmd.z); if (!v.ok) { denied(s, cmd, v.reason); return; }
      const u = petOf(s, cmd.side, cmd.uid); u.order = { x: v.x, z: v.z, t: s.t }; u.path = v.path; u.target = null; u.rt = 0; sd.moveCd[u.card] = +(s.t + T().pet.moveCooldown).toFixed(6);
      ev(s, { type: 'order', uid: u.uid, side: u.side, x: v.x, z: v.z });
    } else if (cmd.type === 'stop') {
      const u = petOf(s, cmd.side, cmd.uid); if (u) endOrder(s, u, 'stopped');
    } else if (cmd.type === 'target') {
      const u = petOf(s, cmd.side, cmd.uid); if (!u) { denied(s, cmd, 'Select one of your Pets.'); return; }
      if (cmd.tuid == null) { endPrio(s, u, 'cleared'); return; }
      const v = canTarget(s, cmd.side, cmd.uid, cmd.tuid); if (!v.ok) { denied(s, cmd, v.reason); return; }
      const until = +(s.t + T().pet.priorityHold).toFixed(6);
      u.prio = v.kind === 'core' ? { kind: 'core', side: OTHER[u.side], until } : { kind: 'unit', uid: cmd.tuid, side: OTHER[u.side], until }; u.target = null; u.rt = 0;
      ev(s, { type: 'prio', uid: u.uid, side: u.side, tuid: cmd.tuid });
    } else if (cmd.type === 'ability' || cmd.type === 'cancelq') {
      if (AB()) AB().command(s, cmd); else denied(s, cmd, 'Abilities are not available.');
    }
  }

  // ------------------------------------------------------------------ combat
  const targetPos = (s, tg) => (tg.kind === 'core' ? s.cores[tg.side] : unitOf(s, tg.uid));
  /** Deal damage. Returns the HP actually removed. `from` is the attacker's uid (for charge and reflection); o.noReflect stops reflection chains. */
  function damage(s, srcSide, tg, amount, crit, from, o) {
    o = o || NO;
    let dmg = Math.max(1, Math.round(amount * (crit ? T().combat.critMult : 1))), st = s.stats[srcSide], src = from ? unitOf(s, from) : null;
    if (tg.kind === 'core') { const c = s.cores[tg.side], real = Math.min(c.hp, dmg); c.hp -= real; st.coreDmg += real; st.overkill += dmg - real; st.dealt += real; ev(s, { type: 'hit', side: srcSide, from, core: tg.side, amt: real, crit }); if (src && AB()) AB().onDealt(s, src, real); return real; }
    const u = unitOf(s, tg.uid); if (!u || u.hp <= 0 || u.spawn > 0) return 0;
    if (u.armor) dmg = Math.max(1, Math.round(dmg * (1 - u.armor)));
    let absorbed = 0; const g = u.st && u.st.guard;
    if (g && g.until > s.t && g.amt > 0) {
      absorbed = Math.min(g.amt, dmg); g.amt -= absorbed; dmg -= absorbed;
      if (g.reflect && src && !o.noReflect && src.hp > 0 && src.side !== u.side && absorbed > 0) damage(s, u.side, { kind: 'unit', uid: src.uid, side: src.side }, Math.max(1, Math.round(absorbed * g.reflect)), false, u.uid, { noReflect: true });
    }
    const real = Math.min(u.hp, dmg); u.hp -= real; st.overkill += dmg - real; if (u.kind === 'pet') { st.unitDmg += real; st.dealt += real; }
    ev(s, { type: 'hit', side: srcSide, from, to: u.uid, amt: real, crit, abs: absorbed });
    if (src && AB()) AB().onDealt(s, src, real);
    return real;
  }
  function heal(s, u, amount, from) { if (!u || u.hp <= 0) return 0; const real = Math.min(u.max - u.hp, Math.max(0, amount)); if (real <= 0) return 0; u.hp += real; ev(s, { type: 'heal', to: u.uid, amt: Math.round(real), from }); return real; }
  const mkT = e => ({ kind: 'unit', uid: e.uid, side: e.side });
  /** Why a priority target no longer holds (null = still fine). */
  function prioBroken(s, u) {
    const p = u.prio; if (s.t > p.until) return 'expired';
    if (p.kind === 'core') return null;
    const e = unitOf(s, p.uid); if (!e || e.hp <= 0) return 'defeated'; if (e.spawn > 0) return 'hidden'; if (dist(u.x, u.z, e.x, e.z) > T().pet.priorityLeash) return 'too far';
    return null;
  }
  function chooseTarget(s, u) {
    const tz = u.st.taunt; if (tz && tz.until > s.t) { const e = unitOf(s, tz.by); if (e && live(e) && e.side !== u.side) return mkT(e); }
    if (u.prio) { const why = prioBroken(s, u); if (!why) return u.prio.kind === 'core' ? { kind: 'core', side: u.prio.side } : { kind: 'unit', uid: u.prio.uid, side: u.prio.side }; endPrio(s, u, why); }
    const far = active(u, 'distort', s.t); let best = null, bd = far ? -1 : u.aggro;
    for (const e of s.units) {
      if (!live(e) || e.side === u.side) continue; const d = dist(u.x, u.z, e.x, e.z) - (e.bait || 0);
      if (far ? (d <= u.aggro && d > bd + 1e-9) : d < bd - 1e-9) { bd = d; best = e; }
    }
    return best ? mkT(best) : { kind: 'core', side: OTHER[u.side] };
  }
  /** Walk along u.path at the given speed multiplier; re-plan if the next waypoint became blocked. */
  function moveAlong(s, u, dt, mult) {
    let move = u.speed * dt * mult; u.moving = move > 0;
    while (move > 1e-6 && u.path && u.path.length) {
      const wp = u.path[0]; if (!walkable(s, wp.x, wp.z)) { u.path = null; return; }
      const wd = dist(u.x, u.z, wp.x, wp.z);
      if (wd <= move) { u.x = wp.x; u.z = wp.z; move -= wd; u.path.shift(); } else { u.x += (wp.x - u.x) / wd * move; u.z += (wp.z - u.z) / wd * move; move = 0; }
    }
  }
  function stepFm(s, u, dt) { // forced movement (pull, knock, rewind): glides along a straight line or a planned path, never through a wall
    const f = u.fm; let mv = f.speed * dt; u.moving = true;
    while (mv > 1e-9 && u.fm) {
      const tx = f.path && f.path.length ? f.path[0].x : f.x, tz = f.path && f.path.length ? f.path[0].z : f.z, d = dist(u.x, u.z, tx, tz);
      if (d <= mv + 1e-6) { if (walkable(s, tx, tz)) { u.x = tx; u.z = tz; mv -= d; } else { u.fm = null; break; } if (f.path && f.path.length) { f.path.shift(); if (!f.path.length) u.fm = null; } else u.fm = null; }
      else { const nx = u.x + (tx - u.x) / d * mv, nz = u.z + (tz - u.z) / d * mv; if (walkable(s, nx, nz)) { u.x = nx; u.z = nz; } else u.fm = null; mv = 0; }
    }
    u.path = null;
  }
  /** The farthest point along (dx,dz) up to `cells` from (x,z) that is still open ground. */
  function reach(s, x, z, dx, dz, cells) { let rx = x, rz = z; for (let d = 0.2; d <= cells + 1e-6; d += 0.2) { const nx = x + dx * d, nz = z + dz * d; if (!walkable(s, nx, nz)) break; rx = nx; rz = nz; } return { x: rx, z: rz }; }
  function stepDummy(s, u, dt) {
    if (!s.hostile) return; const K = T().support.dummyStrike; u.strike = Math.max(0, u.strike - dt); if (u.strike > 0) return;
    let best = null, bd = K.range; for (const e of s.units) { if (e.side === 'a' && live(e) && e.kind !== 'dummy') { const d = dist(u.x, u.z, e.x, e.z) - e.radius; if (d < bd) { bd = d; best = e; } } }
    if (best) { u.strike = K.interval; damage(s, 'b', mkT(best), K.dmg, false, u.uid); ev(s, { type: 'attack', uid: u.uid, side: 'b' }); }
  }
  function stepUnit(s, u, dt) {
    if (u.static) { if (u.kind === 'dummy') stepDummy(s, u, dt); return; }
    if (u.ai === 'obj') { if (SU()) SU().stepObject(s, u, dt); return; }
    if (u.spawn > 0) { u.spawn = Math.max(0, u.spawn - dt); return; }
    u.cd = Math.max(0, u.cd - dt); u.rt -= dt;
    if (u.held) { u.moving = false; return; }
    if (u.fm) { stepFm(s, u, dt); return; } // a pull, knock or rewind carries even a stunned unit
    if (active(u, 'stun', s.t)) { u.moving = false; return; }
    if (AB() && AB().tick(s, u, dt)) return; // ability windup, dash, queued and automatic casts
    if (u.order) { // a walking order: no attacks, no auto-targeting, until it ends
      const o = u.order; if (dist(u.x, u.z, o.x, o.z) <= T().pet.orderArrive) { endOrder(s, u, 'arrived'); return; }
      if (!u.path || !u.path.length) { u.path = findPath(s, u.x, u.z, o.x, o.z); if (!u.path || !u.path.length) { endOrder(s, u, 'blocked'); return; } }
      const mm = moveMult(s, u); moveAlong(s, u, dt, mm); const nx = o.x - u.x, nz = o.z - u.z; if (Math.abs(nx) > 1e-3) u.face = nx >= 0 ? 1 : -1; return;
    }
    let tg = u.target && targetPos(s, u.target); const tgOk = tg && (u.target.kind === 'core' || live(tg));
    if (!tgOk || u.rt <= 0) { const nt = chooseTarget(s, u); if (!u.target || nt.kind !== u.target.kind || nt.uid !== u.target.uid || nt.side !== u.target.side) { u.target = nt; u.path = null; } else if (nt.kind === 'unit') u.path = null; u.rt = T().combat.retarget; tg = targetPos(s, u.target); }
    const tr = u.target.kind === 'core' ? tg.r : tg.radius, d = dist(u.x, u.z, tg.x, tg.z) - tr;
    if (d <= u.range - 0.05) { // in range: face it, stand still, attack when ready
      u.face = tg.x >= u.x ? 1 : -1; u.moving = false;
      if (u.cd <= 0) {
        u.cd = u.interval * dullMult(s, u); const crit = u.crit > 0 && rand(s) < u.crit;
        if (u.atk === 'ranged') s.proj.push({ uid: s.nextUid++, side: u.side, from: u.uid, x: u.x, z: u.z, px: u.x, pz: u.z, tg: { kind: u.target.kind, uid: u.target.uid, side: u.target.side }, speed: 12, dmg: u.dmg, crit, hit: u.hit });
        else damage(s, u.side, u.target, u.dmg, crit, u.uid);
        ev(s, { type: 'attack', uid: u.uid, side: u.side });
        if (SU() && u.ai === 'rover') SU().onRoverHit(s, u, tg);
      }
      return;
    }
    // approach: path to the target's cell, follow waypoints
    if (!u.path || !u.path.length) { u.path = findPath(s, u.x, u.z, tg.x, tg.z) || []; }
    moveAlong(s, u, dt, moveMult(s, u));
    if (u.path && !u.path.length && d > u.range) u.path = null; // arrived at the goal cell but still out of range: re-plan next step
    if (!u.path) u.moving = false;
    if (tg.x !== u.x) u.face = tg.x >= u.x ? 1 : -1;
  }
  /** Barrier segments of the other side intercept shots that cross them. */
  function intercepted(s, p) {
    for (const b of s.units) { if (b.kind !== 'barrier' || b.hp <= 0 || b.side === p.side || b.spawn > 0) continue; if (AIM().segDist(p.x, p.z, b.seg.x1, b.seg.z1, b.seg.x2, b.seg.z2) <= b.seg.w / 2 + 0.15) return b; }
    return null;
  }
  function stepProj(s, p, dt) {
    const tgt = p.tg.kind === 'core' ? s.cores[p.tg.side] : s.units.find(u => u.uid === p.tg.uid && u.hp > 0);
    if (!tgt) { p.dead = true; return; }
    const d = dist(p.x, p.z, tgt.x, tgt.z), stepD = p.speed * dt;
    if (d <= stepD + (tgt.radius || tgt.r) * 0.4) { damage(s, p.side, p.tg, p.dmg, p.crit, p.from); p.dead = true; } else { p.x += (tgt.x - p.x) / d * stepD; p.z += (tgt.z - p.z) / d * stepD; }
    if (!p.dead) { const b = intercepted(s, p); if (b) { damage(s, p.side, mkT(b), p.dmg, false, p.from); p.dead = true; ev(s, { type: 'blocked', uid: b.uid, x: p.x, z: p.z }); } }
  }
  /** Soft separation so units do not stack; never pushes onto blocked ground. Barriers, emplacements and dummies do not move. */
  function separate(s) {
    const us = s.units.filter(u => u.hp > 0 && u.spawn <= 0 && !u.static && u.ai !== 'obj' && !u.held && !u.dash);
    for (let i = 0; i < us.length; i++) for (let j = 0; j < s.units.length; j++) {
      const a = us[i], b = s.units[j]; if (a === b || b.hp <= 0 || b.held || b.dash || b.obj === 'blade' || b.obj === 'drone' || (b.ai === 'pet' && b.uid < a.uid)) continue;
      const fixed = b.static || b.kind === 'barrier' || b.kind === 'emplacement';
      const rb = b.kind === 'barrier' ? 0 : b.radius, d = dist(a.x, a.z, b.x, b.z), min = a.radius + rb; if (b.kind === 'barrier' || d >= min || d < 1e-6) continue;
      const push = (min - d) / 2 * (fixed ? 2 : 1), nx = (a.x - b.x) / d, nz = (a.z - b.z) / d;
      const ax = a.x + nx * push, az = a.z + nz * push; if (walkable(s, ax, az)) { a.x = ax; a.z = az; }
      if (!fixed) { const bx = b.x - nx * push, bz = b.z - nz * push; if (walkable(s, bx, bz)) { b.x = bx; b.z = bz; } }
    }
  }

  // ------------------------------------------------------------------ the step
  function step(s) {
    if (s.over) return false;
    const dt = s.dt, E = T().elixir, M = T().match;
    s.cmds.splice(0).forEach(c => apply(s, c));
    s.tick++; s.t = +(s.tick * dt).toFixed(6);
    SIDES.forEach(k => { const sd = s.sides[k]; if (!sd) return; const cap = E.max * ELX; if (sd.elixirM < cap) sd.elixirM = Math.min(cap, sd.elixirM + Math.round(E.regen * ELX * regenMult(s) * dt)); H().tick(sd.hand, s.t); });
    if (SU()) SU().sample(s);
    s.units.forEach(u => { u.px = u.x; u.pz = u.z; });
    if (AB()) AB().world(s, dt);
    s.units.forEach(u => { if (u.hp > 0) stepUnit(s, u, dt); });
    s.proj.forEach(p => { p.px = p.x; p.pz = p.z; stepProj(s, p, dt); }); s.proj = s.proj.filter(p => !p.dead);
    separate(s);
    const gone = s.units.filter(u => u.hp <= 0);
    gone.forEach(u => {
      ev(s, { type: 'death', uid: u.uid, side: u.side, kind: u.kind, card: u.card, obj: u.obj, x: u.x, z: u.z });
      if (u.kind === 'pet') { const sd = s.sides[u.side], r = T().pet.recover; H().defeat(sd.hand, u.card, s.t + r[0] + rand(s) * (r[1] - r[0])); delete sd.uid[u.card]; delete sd.moveCd[u.card]; }
      else if (u.kind === 'dummy') s.spots[u.spot].at = s.t + 6;
      if (SU()) SU().onRemove(s, u);
    });
    if (gone.length) { s.units = s.units.filter(u => u.hp > 0); s.units.forEach(u => { if (u.prio && u.prio.kind === 'unit' && gone.some(g => g.uid === u.prio.uid)) endPrio(s, u, 'defeated'); if (u.target && u.target.kind === 'unit' && gone.some(g => g.uid === u.target.uid)) { u.target = null; u.path = null; } }); }
    s.spots.forEach((sp, i) => { if (sp.at != null && s.t >= sp.at) spawnDummy(s, i); });
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
    const parts = [s.tick, s.rng, s.cores.a.hp, s.cores.b.hp]; SIDES.forEach(k => { const sd = s.sides[k]; if (sd) parts.push(sd.elixirM, sd.hand.hand.join(','), sd.hand.recent.join(','), sd.hand.rng, JSON.stringify(sd.moveCd)); });
    s.units.forEach(u => parts.push(u.uid, u.hp, Math.round(u.x * 1000), Math.round(u.z * 1000), Math.round(u.cd * 1000), u.order ? Math.round(u.order.x * 10) + ':' + Math.round(u.order.z * 10) : '-', u.prio ? (u.prio.uid || 'c') : '-', Math.round((u.charge || 0) * 1000), u.cdq ? u.cdq.q + '/' + u.cdq.e + '/' + u.cdq.r : '', JSON.stringify(u.st || 0), u.held ? u.held.by : '', Object.keys(u.queue || NO).join('')));
    s.proj.forEach(p => parts.push('p', p.uid, Math.round(p.x * 1000), Math.round(p.z * 1000)));
    s.zones.forEach(z => parts.push('z', z.id, z.until)); s.walls.forEach(w => parts.push('w', w.id, w.until)); parts.push('f' + s.fx.length, 'd' + s.dyn.reduce((a, b) => a + b, 0));
    const str = parts.join('|'); let hh = 2166136261; for (let i = 0; i < str.length; i++) { hh ^= str.charCodeAt(i); hh = Math.imul(hh, 16777619); } return (hh >>> 0).toString(16);
  }
  /** What a renderer/HUD needs for one side, without exposing internals. */
  function view(s, side) {
    const sd = s.sides[side];
    return { t: s.t, left: Math.max(0, T().match.duration - s.t), phase: phase(s), over: s.over, elixir: sd ? sd.elixirM / ELX : 0, elixirMax: T().elixir.max,
      hand: sd ? sd.hand.hand.map(id => { const c = sd.cards[id], cost = costOf(s, side, id), busy = SU() && c.def.cat !== 'pet' ? SU().active(s, side, id) : false; return { id, base: c.base, role: c.def.role, cat: c.def.cat, cost, ok: sd.elixirM >= cost * ELX && !busy, busy, limited: !!c.def.limited }; }) : [],
      reshuffle: sd ? { ok: H().canReshuffle(sd.hand, s.t) && sd.elixirM >= T().hand.reshuffleCost * ELX, wait: Math.max(0, sd.hand.lockUntil - s.t) } : null,
      deck: sd ? sd.deck.map(id => { const c = sd.hand.st[id]; return { id, base: sd.cards[id].base, state: c.s, wait: c.s === 'rec' ? Math.max(0, c.until - s.t) : 0, surcharge: Math.min(T().pet.redeployCap, sd.deployCount[id] || 0) * T().pet.redeploySurcharge }; }) : [],
      pets: sd ? s.units.filter(u => u.side === side && u.kind === 'pet' && u.hp > 0).map(u => ({ uid: u.uid, card: u.card, base: u.base, hp: u.hp, max: u.max, spawn: u.spawn, charge: u.charge, order: u.order ? { x: u.order.x, z: u.order.z } : null, prio: u.prio ? { kind: u.prio.kind, uid: u.prio.uid || 0 } : null,
        moveWait: Math.max(0, (sd.moveCd[u.card] || 0) - s.t), held: !!u.held, limited: !!sd.cards[u.card].def.limited, abilities: AB() ? AB().petView(s, u) : [] })) : [],
      cores: { a: { hp: s.cores.a.hp, max: s.cores.a.max }, b: { hp: s.cores.b.hp, max: s.cores.b.max } } };
  }

  AV.combat.sim = { create, step, run, command, canDeploy, canMove, canTarget, costOf, elixirOf, phase, view, hash, findPath, walkable, aliveUnits, buildArena, rand, lanes, unitOf, ELX };
  /** Internals shared with abil.js and support.js (same IIFE-free pure rules; not part of the public surface). */
  AV.combat.core = { SIDES, OTHER, ELX, NO, rand, dist, unitOf, ev, cellOk, walkable, findPath, damage, heal, live, active, moveMult, dullMult, mkT, reach, endOrder, endPrio, unitAt, targetPos, moveAlong };
})();
