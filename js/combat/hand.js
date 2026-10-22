/* AETHERVAULT — Combat hand: a 10-card deck, a hand of up to 4, a recently-seen queue and a manual reshuffle. Pure and seeded: no DOM, no clock,
 * no Math.random — the same seed and the same plays give the same hands. All state is plain data owned by the simulation.
 *
 * Card states:  pool (drawable) · hand · field (a Pet that is deployed) · rec (a defeated Pet, recovering until a time, then back to the pool)
 * Rules:
 *   - every deployment refreshes the WHOLE hand; the cards that were not played are "recently seen" and are deprioritised for exactly one refresh
 *   - recently-seen cards are never locked out: when the rest of the pool is too small to fill the hand they are drawn too (small pools degrade gracefully)
 *   - a support card, once played, goes straight back to the pool (also deprioritised for that refresh); a Pet stays on the field until it is defeated
 *   - manual reshuffle: refresh without playing, usable again only after a short lockout; its Elixir cost belongs to the simulation */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const T = () => AV.combat.tuning;

  /** mulberry32 on a plain integer state, so the whole hand serialises. */
  function rand(h) { h.rng = (h.rng + 0x6D2B79F5) | 0; let t = Math.imul(h.rng ^ (h.rng >>> 15), 1 | h.rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  /** Seeded Fisher–Yates over a copy (input order is the tie-break, so it must be stable: callers pass deck order). */
  function shuffled(h, list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(h) * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  /** ids: the deck's specimen ids (unique, ≤ 10). seed: integer. */
  function init(ids, seed, size) {
    const h = { rng: (seed | 0) ^ 0x9e3779b9, size: size || T().hand.size, order: ids.slice(), st: {}, hand: [], recent: [], lockUntil: 0, refreshes: 0 };
    ids.forEach(id => { h.st[id] = { s: 'pool', until: 0 }; });
    draw(h); return h;
  }
  const inPool = h => h.order.filter(id => h.st[id].s === 'pool');

  /** Fill the hand from the pool: cards not recently seen first, then recently seen ones if still short. Does not touch `recent`. */
  function draw(h) {
    const want = h.size - h.hand.length; if (want <= 0) return [];
    const pool = inPool(h), fresh = shuffled(h, pool.filter(id => !h.recent.includes(id))), stale = shuffled(h, pool.filter(id => h.recent.includes(id)));
    const got = fresh.concat(stale).slice(0, want); got.forEach(id => { h.st[id].s = 'hand'; h.hand.push(id); }); return got;
  }
  /** Return the whole hand to the pool and draw a new one; `extra` (a card just played back to the pool) joins the recently-seen queue. */
  function refresh(h, extra) {
    const left = h.hand.slice(); h.hand.forEach(id => { h.st[id].s = 'pool'; }); h.hand = [];
    h.recent = left.concat(extra || []); h.refreshes++;
    return draw(h);
  }
  /** Play a card from the hand. kind 'pet' stays on the field; anything else returns to the pool. Refreshes the hand. */
  function play(h, id, kind) {
    if (!h.hand.includes(id)) return { ok: false, reason: 'not in hand' };
    h.hand = h.hand.filter(x => x !== id);
    if (kind === 'pet') { h.st[id].s = 'field'; refresh(h, []); } else { h.st[id].s = 'pool'; refresh(h, [id]); }
    return { ok: true };
  }
  /** A Pet was defeated: it recovers (not drawable) until `until`, then returns to the pool. */
  function defeat(h, id, until) { const c = h.st[id]; if (!c) return false; c.s = 'rec'; c.until = until; return true; }
  /** A Pet left the field without being defeated (e.g. the match ended); it returns to the pool at once. */
  function recall(h, id) { const c = h.st[id]; if (c && c.s === 'field') c.s = 'pool'; }
  /** Advance recovery. Cards whose time has come return to the pool, and any empty hand slots are topped up. Returns the ids that came back. */
  function tick(h, now) {
    const back = []; h.order.forEach(id => { const c = h.st[id]; if (c.s === 'rec' && now >= c.until) { c.s = 'pool'; c.until = 0; back.push(id); } });
    if (back.length || h.hand.length < h.size) { const before = h.hand.length; draw(h); if (h.hand.length > before) back.drawn = true; }
    return back;
  }
  /** Manual reshuffle. Returns { ok, wait? }; the caller charges the Elixir. */
  function reshuffle(h, now) {
    if (now < h.lockUntil) return { ok: false, reason: 'cooling down', wait: +(h.lockUntil - now).toFixed(2) };
    h.lockUntil = now + T().hand.reshuffleLockout; refresh(h, []); return { ok: true };
  }
  const canReshuffle = (h, now) => now >= h.lockUntil;

  AV.combat.hand = { init, draw, refresh, play, defeat, recall, tick, reshuffle, canReshuffle, inPool, rand };
})();
