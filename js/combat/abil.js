/* AETHERVAULT — Combat abilities, statuses, zones and walls. Pure and deterministic like sim.js: no DOM, no Math.random, no clock. It extends the simulation
 * (it is called from sim.js) and shares its geometry with aim.js, so the shape a player sees while aiming is the shape that is hit.
 *
 * Pets with an authored kit (defs.js, flag slice:true) have three abilities:
 *   Q, E   cooldown abilities. The Pet casts them by itself when its rule fires (`auto`), or the player casts or QUEUES one manual use per ability
 *          (max one queued; it fires when the cooldown ends; a newer order replaces it; `cancelq` clears it).
 *   R      ultimate. Never automatic. Charges with time and with damage dealt (both scaled by the Bond cooldown factor), then needs an aimed manual cast.
 * Casting: the caster stands still for the ability's windup (a telegraph is shown), then the effect lands. Death, stun or being carried during the windup
 * cancels the effect (the cooldown is spent — that is the cost of being interrupted). Abilities never damage a Core; only attacks and machines do.
 * Area effects skip units that are being carried (support.js), and units still arriving. Statuses live in unit.st: slow {m,until} · stun · root · distort (until)
 * · dull {m,until} (slower attacks) · taunt {by,until} · guard {amt,until,reflect} (an absorb shield). */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const T = () => AV.combat.tuning, K = () => AV.combat.core, AIM = () => AV.combat.aim;
  const r6 = x => +x.toFixed(6), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SLOTS = ['q', 'e', 'r'];

  // ------------------------------------------------------------------ statuses
  /** Apply a status. Stronger or longer wins; nothing stacks. */
  function status(s, u, key, a, b) {
    const st = u.st, now = s.t;
    if (key === 'slow' || key === 'dull') { const cur = st[key], until = r6(now + b); if (!cur || cur.until <= now || a < cur.m - 1e-9 || (Math.abs(a - cur.m) < 1e-9 && until > cur.until)) st[key] = { m: a, until }; }
    else if (key === 'stun' || key === 'root' || key === 'distort') { const until = r6(now + a); if (!(st[key] > until)) st[key] = until; if (key === 'stun') { u.dash = null; } }
    else if (key === 'taunt') st.taunt = { by: a, until: r6(now + b) };
    else if (key === 'guard') st.guard = { amt: a.amt, until: r6(now + a.dur), reflect: a.reflect || 0 };
  }
  function cleanse(u) { ['slow', 'dull', 'stun', 'root', 'distort', 'taunt'].forEach(k => delete u.st[k]); }
  const isFoe = (e, side) => e.hp > 0 && e.spawn <= 0 && e.side !== side && !e.held;
  const isFriend = (e, side) => e.hp > 0 && e.spawn <= 0 && e.side === side && !e.held;
  const foes = (s, side) => s.units.filter(e => isFoe(e, side));
  const friends = (s, side) => s.units.filter(e => isFriend(e, side));
  const powerOf = u => clamp(u.dmg0 ? u.dmg / u.dmg0 : 1, 0.6, 1.4); // how much stronger than average this specimen is

  // ------------------------------------------------------------------ aiming and validity
  const from = u => ({ x: u.x, z: u.z, fz: u.side === 'a' ? -1 : 1 });
  /** Resolve an ability's shape for this caster and aim ({x,z} or {tuid}). Never mutates. */
  function shapeFor(s, u, ab, aim) {
    aim = aim || {};
    if (ab.aim === 'chain') {
      const t = aim.tuid != null ? K().unitOf(s, aim.tuid) : null;
      if (!t || t.hp <= 0 || t.spawn > 0) return { model: 'chain', t: 'chain', ok: false, reason: 'Pick a unit.', at: { x: u.x, z: u.z } };
      if (ab.ally ? t.side !== u.side : t.side === u.side) return { model: 'chain', t: 'chain', ok: false, reason: ab.ally ? 'Pick an ally.' : 'Pick an enemy.', at: { x: t.x, z: t.z } };
      if (t.held) return { model: 'chain', t: 'chain', ok: false, reason: 'It is being carried.', at: { x: t.x, z: t.z } };
      return AIM().resolve(ab, from(u), { x: t.x, z: t.z });
    }
    const sh = AIM().resolve(ab, from(u), aim.x != null ? { x: aim.x, z: aim.z } : null);
    if (sh.ok && ab.wall && !wallCells(s, sh).length) return Object.assign(sh, { ok: false, reason: 'No room for a wall there.' });
    return sh;
  }
  /** Can the unit cast `slot` at `aim`? ok = the ability and aim are valid; ready = it could start right now. */
  function check(s, u, slot, aim) {
    const ab = u.abil && u.abil[slot]; if (!ab) return { ok: false, ready: false, reason: 'No such ability.' };
    if (s.over) return { ok: false, ready: false, reason: 'The match is over.' };
    if (u.spawn > 0) return { ok: false, ready: false, reason: 'Still arriving.' };
    if (u.held) return { ok: false, ready: false, reason: 'Being carried.' };
    const sh = shapeFor(s, u, ab, aim); if (!sh.ok) return { ok: false, ready: false, reason: sh.reason, shape: sh };
    const wait = Math.max(0, u.cdq[slot] - s.t);
    if (slot === 'r' && u.charge < 1 - 1e-9) return { ok: false, ready: false, reason: `Ultimate charging (${Math.floor(u.charge * 100)}%).`, shape: sh };
    const busy = K().active(u, 'stun', s.t) || u.cast || u.dash || u.fm;
    return { ok: true, ready: wait <= 1e-9 && !busy, wait, busy: !!busy, reason: '', shape: sh, ab };
  }
  function cast(s, u, slot, aim) {
    const c = check(s, u, slot, aim); if (!c.ok || !c.ready) return c;
    const ab = c.ab, sh = c.shape;
    u.cdq[slot] = r6(s.t + ab.cd * u.cdr); if (slot === 'r') { u.charge = 0; u.cdq.r = r6(s.t + 1); }
    u.cast = { slot, until: r6(s.t + ab.windup) }; u.cd = Math.max(u.cd, ab.windup + 0.2); u.path = null; u.moving = false;
    const dx = sh.at.x - u.x; if (Math.abs(dx) > 1e-3) u.face = dx >= 0 ? 1 : -1;
    s.fx.push({ at: r6(s.t + ab.windup), seq: s.nextUid++, kind: 'ability', uid: u.uid, side: u.side, slot, shape: sh, tuid: aim && aim.tuid != null ? aim.tuid : null });
    K().ev(s, { type: 'cast', uid: u.uid, side: u.side, slot, name: ab.name, aim: ab.aim, shape: sh, windup: ab.windup });
    return c;
  }
  function command(s, cmd) {
    const K_ = K(), u = K_.unitOf(s, cmd.uid), slot = cmd.slot, deny = reason => K_.ev(s, { type: 'denied', side: cmd.side, uid: cmd.uid, reason });
    if (!u || u.side !== cmd.side || u.kind !== 'pet' || u.hp <= 0) return deny('Select one of your Pets.');
    if (!SLOTS.includes(slot)) return deny('No such ability.');
    if (cmd.type === 'cancelq') { if (u.queue[slot]) { delete u.queue[slot]; K_.ev(s, { type: 'queuecancel', uid: u.uid, slot }); } return; }
    const c = check(s, u, slot, cmd.aim); if (!c.ok) return deny(c.reason);
    if (c.ready) { cast(s, u, slot, cmd.aim); return; }
    if (slot === 'r') return deny('Not ready.');
    u.queue[slot] = cmd.aim || {}; K_.ev(s, { type: 'queued', uid: u.uid, slot, wait: c.wait }); // one per ability: a newer order replaces the older
  }

  // ------------------------------------------------------------------ automatic use
  /** The aim a Pet would use by itself for this ability right now, or null (not worth casting). */
  function autoAim(s, u, ab) {
    const K_ = K(), fs = foes(s, u.side), d = (e) => K_.dist(u.x, u.z, e.x, e.z);
    const scan = ab.aim === 'circle' || ab.aim === 'chain' ? ab.range : ab.aim === 'self' ? ab.radius : (ab.length || 0) + 0.3;
    if (ab.auto === 'enemy') {
      const cur = u.target && u.target.kind === 'unit' ? K_.unitOf(s, u.target.uid) : null; let t = cur && isFoe(cur, u.side) && d(cur) <= scan ? cur : null;
      if (!t) fs.forEach(e => { if (d(e) <= scan && (!t || d(e) < d(t) - 1e-9)) t = e; });
      if (!t) return null; return ab.aim === 'chain' ? { tuid: t.uid } : { x: t.x, z: t.z };
    }
    if (ab.auto === 'gap') {
      const t = u.target && u.target.kind === 'unit' ? K_.unitOf(s, u.target.uid) : null; if (!t || !isFoe(t, u.side)) return null;
      const dd = d(t); return dd > u.range + 0.8 && dd <= ab.length + u.range ? { x: t.x, z: t.z } : null;
    }
    if (ab.auto === 'group') {
      let best = null, bn = 1; fs.forEach(e => { if (d(e) > ab.range) return; const n = fs.filter(o => K_.dist(e.x, e.z, o.x, o.z) <= ab.radius).length; if (n > bn) { bn = n; best = e; } });
      return best ? { x: best.x, z: best.z } : null;
    }
    if (ab.auto === 'hurt') {
      let best = null; friends(s, u.side).forEach(e => { if (e.hp / e.max <= 0.65 && d(e) <= scan && (!best || e.hp / e.max < best.hp / best.max - 1e-9)) best = e; });
      if (!best) return null; return ab.aim === 'chain' ? { tuid: best.uid } : ab.aim === 'self' ? {} : { x: best.x, z: best.z };
    }
    if (ab.auto === 'threat') return u.hp < u.max * 0.95 && fs.some(e => d(e) <= (ab.trigger || 3)) ? {} : null;
    return null;
  }
  /** Per-unit step: charge, dash, windup, queued and automatic casts. Returns true when the Pet is busy this step (it should not move or attack). */
  function tick(s, u, dt) {
    if (u.abil && u.abil.r && u.charge < 1) u.charge = Math.min(1, u.charge + dt / (T().ability.chargeTime * u.cdr));
    if (u.dash) { stepDash(s, u, dt); return true; }
    if (u.cast) { if (s.t < u.cast.until - 1e-9) { u.moving = false; return true; } u.cast = null; }
    if (!u.abil) return false;
    for (const slot of ['q', 'e']) { // a queued manual use goes first
      if (u.queue[slot] && u.cdq[slot] <= s.t + 1e-9) {
        const aim = u.queue[slot]; delete u.queue[slot]; const c = cast(s, u, slot, aim);
        if (c.ready && c.ok) return true; K().ev(s, { type: 'denied', side: u.side, uid: u.uid, reason: c.reason || 'The queued ability could not be cast.' });
      }
    }
    if (!u.order) for (const slot of ['q', 'e']) {
      const ab = u.abil[slot]; if (!ab || ab.auto === 'none' || u.cdq[slot] > s.t + 1e-9 || u.queue[slot]) continue;
      const aim = autoAim(s, u, ab); if (aim && cast(s, u, slot, aim).ready) return true;
    }
    return false;
  }
  function onDealt(s, src, real) { if (src.abil && src.abil.r && real > 0 && src.charge < 1) src.charge = Math.min(1, src.charge + real / (T().ability.chargeDamage * src.cdr)); }

  // ------------------------------------------------------------------ resolving an ability
  function chainList(s, u, ab, first) {
    const K_ = K(), list = [first], pool = ab.ally ? friends(s, u.side) : foes(s, u.side);
    for (let i = 0; i < (ab.hops || 0); i++) {
      const last = list[list.length - 1]; let best = null;
      pool.forEach(e => { if (list.includes(e)) return; const d = K_.dist(last.x, last.z, e.x, e.z); if (d <= ab.hopRange && (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && e.uid < best.e.uid))) best = { e, d }; });
      if (!best) break; list.push(best.e);
    }
    return list;
  }
  function wallCells(s, sh) { const K_ = K(); return AIM().wallCells(sh).filter(c => K_.cellOk(s, c.cx, c.cz) && !s.units.some(q => q.hp > 0 && q.kind !== 'barrier' && K_.dist(q.x, q.z, c.cx + .5, c.cz + .5) < 0.8)); }
  /** Place a barrier on open cells along a wall shape; units already standing there are never trapped (those cells are skipped). Returns the wall, or null. */
  function placeWall(s, side, owner, sh, dur, card) {
    const cells = wallCells(s, sh); if (!cells.length) return null;
    const idx = cells.map(c => c.cz * s.w + c.cx); idx.forEach(i => { s.dyn[i]++; });
    const w = { id: s.nextUid++, side, owner, card: card || null, cells: idx, shape: { x1: sh.x1, z1: sh.z1, x2: sh.x2, z2: sh.z2, w: sh.w }, until: r6(s.t + dur) };
    s.walls.push(w); s.units.forEach(q => { q.path = null; }); K().ev(s, { type: 'wall', id: w.id, side, cells: cells.length }); return w;
  }
  function dropWall(s, w) { w.cells.forEach(i => { if (s.dyn[i] > 0) s.dyn[i]--; }); s.walls = s.walls.filter(x => x !== w); s.units.forEach(q => { q.path = null; }); K().ev(s, { type: 'wallend', id: w.id }); }
  const dropWallsOf = (s, owner) => s.walls.filter(w => w.owner === owner).forEach(w => dropWall(s, w));

  function resolveAbility(s, f) {
    const K_ = K(), u = K_.unitOf(s, f.uid); if (!u || u.hp <= 0) return;
    if (K_.active(u, 'stun', s.t) || u.held) { K_.ev(s, { type: 'interrupted', uid: u.uid, slot: f.slot }); return; }
    const ab = u.abil[f.slot], sh = f.shape, pf = powerOf(u), side = u.side, dmgBase = ab.dmg ? ab.dmg * u.dmg : 0;
    if (ab.aim === 'dash') { u.dash = { x2: sh.dest.x, z2: sh.dest.z, dx: sh.dx, dz: sh.dz, speed: ab.dash || 14, w: sh.w, hit: [], slot: f.slot }; u.cast = null; K_.ev(s, { type: 'dash', uid: u.uid }); return; }
    let enemies, allies = [];
    if (sh.t === 'chain') {
      const first = K_.unitOf(s, f.tuid); if (!first || first.hp <= 0) return; const list = chainList(s, u, ab, first);
      K_.ev(s, { type: 'beam', side, kind: 'chain', pts: [{ x: u.x, z: u.z }].concat(list.map(e => ({ x: e.x, z: e.z }))) });
      if (ab.ally) { enemies = []; allies = list; } else enemies = list;
      enemies.forEach((e, i) => { if (dmgBase) K_.damage(s, side, K_.mkT(e), dmgBase * Math.pow(ab.falloff || 1, i), false, u.uid); });
      allies.forEach((e, i) => { if (ab.heal) K_.heal(s, e, ab.heal * e.max * pf * Math.pow(ab.falloff || 1, i), u.uid); });
      return;
    }
    enemies = foes(s, side).filter(e => AIM().hits(sh, e.x, e.z, e.radius));
    if (ab.ally || ab.shield || ab.heal) allies = friends(s, side).filter(e => AIM().hits(sh, e.x, e.z, e.radius)); if (!ab.ally && ab.shield) allies = [u];
    if (!ab.ally && !ab.shield && !ab.heal) allies = [];
    K_.ev(s, { type: 'burst', uid: u.uid, side, slot: f.slot, shape: sh });
    enemies.forEach(e => {
      if (dmgBase) K_.damage(s, side, K_.mkT(e), dmgBase, false, u.uid);
      if (e.hp <= 0) return;
      if (ab.slow) status(s, e, 'slow', ab.slow[0], ab.slow[1]); if (ab.stun) status(s, e, 'stun', ab.stun); if (ab.root) status(s, e, 'root', ab.root);
      if (ab.dull) status(s, e, 'dull', ab.dull[0], ab.dull[1]); if (ab.taunt) status(s, e, 'taunt', u.uid, ab.taunt);
      if (ab.pull) { const v = AIM().vec(sh.x - e.x, sh.z - e.z, 0), c = Math.min(ab.pull, v.l); if (c > 0.05) { const p = K_.reach(s, e.x, e.z, v.x, v.z, c); e.fm = { x: p.x, z: p.z, speed: 9 }; } }
      if (ab.knock) { const v = AIM().vec(e.x - u.x, e.z - u.z, u.side === 'a' ? -1 : 1), p = K_.reach(s, e.x, e.z, v.x, v.z, ab.knock); e.fm = { x: p.x, z: p.z, speed: 10 }; }
    });
    allies.forEach(e => {
      if (ab.heal) K_.heal(s, e, ab.heal * e.max * pf, u.uid);
      if (ab.shield) status(s, e, 'guard', { amt: ab.shield.pct * e.max * pf, dur: ab.shield.dur, reflect: 0 });
      if (ab.cleanse) cleanse(e);
    });
    if (ab.zone) { const z = ab.zone; s.zones.push({ id: s.nextUid++, kind: 'ability', side, owner: u.uid, card: null, x: sh.x, z: sh.z, r: sh.r, until: r6(s.t + z.dur), every: z.tick || 1, next: r6(s.t + (z.tick || 1)), dmg: z.dmg ? z.dmg * u.dmg : 0, heal: z.heal || 0, slow: z.slow || 0, ally: !!ab.ally, name: ab.name, pf }); K_.ev(s, { type: 'zone', side, x: sh.x, z: sh.z, r: sh.r }); }
    if (ab.wall) placeWall(s, side, u.uid, sh, ab.wall.dur, null);
  }
  function stepDash(s, u, dt) {
    const K_ = K(), d = u.dash, left = K_.dist(u.x, u.z, d.x2, d.z2), mv = Math.min(left, d.speed * dt); let nx = u.x + d.dx * mv, nz = u.z + d.dz * mv;
    if (!K_.walkable(s, nx, nz)) { u.dash = null; u.cast = null; return; }
    u.x = nx; u.z = nz; u.moving = true; u.face = d.dx >= 0 ? 1 : -1;
    const ab = u.abil[d.slot];
    foes(s, u.side).forEach(e => { if (d.hit.includes(e.uid) || K_.dist(u.x, u.z, e.x, e.z) > d.w / 2 + e.radius + u.radius * 0.5) return; d.hit.push(e.uid); if (ab.dmg) K_.damage(s, u.side, K_.mkT(e), ab.dmg * u.dmg, false, u.uid); });
    if (left - mv <= 1e-6) { u.dash = null; u.cast = null; u.path = null; }
  }

  // ------------------------------------------------------------------ the world step: pending effects, zones, walls, auras
  function world(s, dt) {
    const K_ = K();
    if (s.fx.length) {
      const due = s.fx.filter(f => f.at <= s.t + 1e-9).sort((a, b) => a.at - b.at || a.seq - b.seq); if (due.length) {
        s.fx = s.fx.filter(f => f.at > s.t + 1e-9);
        due.forEach(f => { if (f.kind === 'ability') resolveAbility(s, f); else if (AV.combat.support) AV.combat.support.resolveFx(s, f); });
      }
    }
    for (const z of s.zones.slice()) {
      if (s.t >= z.until - 1e-9) { s.zones = s.zones.filter(q => q !== z); K_.ev(s, { type: 'zoneend', id: z.id, card: z.card }); continue; }
      if (z.follow) { const f = K_.unitOf(s, z.follow); if (f && f.hp > 0) { z.x = f.x; z.z = f.z; } }
      const inside = list => list.filter(e => K_.dist(e.x, e.z, z.x, z.z) <= z.r + e.radius);
      if (z.slow || z.distort) inside(foes(s, z.side)).forEach(e => { if (z.slow) status(s, e, 'slow', 1 - z.slow, 0.25); if (z.distort) status(s, e, 'distort', 0.25);
        if (z.freeze && !z.seen[e.uid]) { z.seen[e.uid] = 1; status(s, e, 'stun', z.freeze); } });
      if (s.t >= z.next - 1e-9) {
        z.next = r6(z.next + z.every);
        if (z.dmg) inside(foes(s, z.side)).forEach(e => K_.damage(s, z.side, K_.mkT(e), z.dmg, false, z.owner));
        if (z.heal) inside(friends(s, z.side)).forEach(e => K_.heal(s, e, z.heal * e.max * (z.pf || 1), z.owner));
      }
    }
    for (const w of s.walls.slice()) if (s.t >= w.until - 1e-9 && !w.hold) dropWall(s, w);
    for (const u of s.units) if (u.aura && u.hp > 0 && u.spawn <= 0) {
      u.auraT += dt; if (u.auraT >= 1 - 1e-9) { u.auraT -= 1; friends(s, u.side).forEach(e => { if (K_.dist(u.x, u.z, e.x, e.z) <= u.aura.radius) K_.heal(s, e, u.aura.heal * e.max, u.uid); }); }
    }
  }

  /** HUD rows for one Pet's abilities. */
  function petView(s, u) {
    if (!u.abil) return [];
    return SLOTS.filter(k => u.abil[k]).map(k => { const ab = u.abil[k], wait = Math.max(0, u.cdq[k] - s.t);
      return { slot: k, name: ab.name, aim: ab.aim, text: ab.text, auto: ab.auto, cd: ab.cd * u.cdr, wait, queued: !!u.queue[k], charge: k === 'r' ? u.charge : 1, ready: k === 'r' ? u.charge >= 1 - 1e-9 && wait <= 1e-9 : wait <= 1e-9, range: ab.range || 0, radius: ab.radius || 0, length: ab.length || 0 }; });
  }
  AV.combat.abil = { status, cleanse, check, cast, command, tick, world, onDealt, petView, shapeFor, autoAim, placeWall, dropWall, dropWallsOf, foes, friends, isFoe, isFriend, powerOf, SLOTS, r6 };
})();
