/* AETHERVAULT — Combat definitions: one entry per base item that has (or will have) a combat role. Pure data (no DOM, no state).
 *   ready   true only when the current build can actually field it; anything else shows "Not yet combat-ready" and cannot enter a deck.
 *   cost    Elixir cost, authored (never derived from rarity)
 *   Pets    hp / dmg / range / speed / interval are BASE values for a specimen whose relevant stats are all 50; translate.js scales them.
 *   Support defs (weapons, shields, machines, relics, oddities) are declared now so the roster is visible, but ready:false until Combat B.
 * Combat categories come from progress.ARCH[base].fam (a Rustblade is a weapon, an Oak Buckler a shield); cards never enter combat. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const P = (role, cost, hp, dmg, range, speed, interval, extra) => Object.assign({ cat: 'pet', role, cost, hp, dmg, range, speed, interval, aggro: Math.max(6, range + 3.5), radius: 0.5, ready: true, atk: range > 2.5 ? 'ranged' : 'melee' }, extra);
  const X = (cat, cost, lands, blurb) => Object.assign({ cat, role: cat, cost, ready: false, lands, blurb });
  const ROLES = {
    ranged: { name: 'Ranged', blurb: 'Strikes from distance and keeps its range.' },
    vanguard: { name: 'Vanguard', blurb: 'Holds the line and soaks damage.' },
    striker: { name: 'Striker', blurb: 'Fast, hard-hitting, close range.' },
    support: { name: 'Support', blurb: 'Keeps allies fighting.' },
    disruptor: { name: 'Disruptor', blurb: 'Breaks up the enemy plan.' },
    weapon: { name: 'Weapon', blurb: 'A deployed weapon effect.' }, shield: { name: 'Shield', blurb: 'A deployed barrier or ward.' },
    machine: { name: 'Machine', blurb: 'A deployed machine.' }, relic: { name: 'Relic', blurb: 'A field effect with a duration.' }, oddity: { name: 'Oddity', blurb: 'An anomaly that bends the rules.' },
  };
  const DEFS = {
    // ---- Pets: all 14 are fieldable in Combat A (move, target, basic attack). Abilities and branch profiles arrive in Combat B.
    nimbit:         P('ranged', 2, 180, 14, 4.0, 2.0, 1.00, { blurb: 'A pocket cloud that pelts from afar.', hit: 'static' }),
    nimbus:         P('ranged', 3, 260, 20, 4.5, 1.9, 1.00, { blurb: 'Storm-bearing cloud with a steady crackle.', hit: 'bolt' }),
    tempestral:     P('ranged', 4, 300, 30, 5.0, 1.8, 1.20, { blurb: 'Hard-hitting storm striker (damage branch).', hit: 'bolt' }),
    pluvia:         P('support', 4, 340, 12, 4.0, 1.8, 1.20, { blurb: 'Rain-bringer that mends allies (support branch).', hit: 'drop' }),
    stormsovereign: P('ranged', 7, 520, 42, 5.5, 1.6, 1.10, { blurb: 'Storm ruler; the strongest ranged unit.', hit: 'bolt', slice: true }),
    emberkit:       P('striker', 2, 200, 20, 1.2, 2.4, 0.80, { blurb: 'A quick ember-fox that bites and darts.', hit: 'claw' }),
    pyrodrake:      P('striker', 5, 480, 38, 1.6, 2.1, 1.00, { blurb: 'A winged flame drake, fast and brutal up close.', hit: 'flame', slice: true }),
    pebblor:        P('vanguard', 3, 420, 14, 1.2, 1.2, 1.30, { blurb: 'A stubborn stone that does not move.', hit: 'thud' }),
    mossback:       P('vanguard', 4, 600, 18, 1.3, 1.1, 1.40, { blurb: 'Meadow tortoise; slow, sturdy, patient.', hit: 'thud', slice: true }),
    grovewarden:    P('vanguard', 6, 800, 28, 1.5, 1.3, 1.40, { blurb: 'A grove that became a guardian.', hit: 'root', slice: true }),
    glimfin:        P('support', 3, 240, 10, 4.0, 2.0, 1.20, { blurb: 'Bright finned healer-skirmisher.', hit: 'drop', slice: true }),
    gloomwing:      P('disruptor', 4, 300, 22, 3.2, 2.2, 1.00, { blurb: 'Dark flier that harries the back line.', hit: 'shadow' }),
    voidling:       P('disruptor', 3, 260, 16, 3.0, 1.9, 1.10, { blurb: 'A small hole in the world that nips.', hit: 'shadow', slice: true }),
    sunmane:        P('striker', 5, 520, 34, 1.4, 1.9, 1.00, { blurb: 'Radiant lion; steady, proud, dangerous.', hit: 'claw' }),
    // ---- Support cards: declared for the roster, fielded in Combat B (B4)
    gravehammer:     X('weapon', 3, 'Combat B', 'Targeted slam on a chosen point.'),
    ionbow:          X('weapon', 4, 'Combat B', 'Lane emplacement that fires along a line.'),
    prismedge:       X('weapon', 4, 'Combat B', 'A floating blade that hunts a target.'),
    oakbuckler:      X('shield', 2, 'Combat B', 'Barrier wall placed on the field.'),
    aegis:           X('shield', 3, 'Combat B', 'Protects one Pet and reflects part of the damage.'),
    leviathan:       X('machine', 6, 'Combat B', 'Grapples an enemy and carries it along the lane.'),
    scraprover:      X('machine', 4, 'Combat B', 'A mobile body that rams the line.'),
    pocketdrone:     X('machine', 3, 'Combat B', 'Repair drone and decoy.'),
    moonstone:       X('relic', 3, 'Combat B', 'Slows (and briefly freezes) an area.'),
    heartofeternity: X('relic', 5, 'Combat B', 'Revives or refreshes a fallen Pet.'),
    backwardsclock:  X('oddity', 4, 'Combat B', 'Rewinds positions a short way.'),
    glitchedcursor:  X('oddity', 3, 'Combat B', 'Distorts enemy targeting.'),
  };
  Object.keys(DEFS).forEach(id => { DEFS[id].id = id; DEFS[id].roleName = ROLES[DEFS[id].role].name; });

  /** Combat category of a base item, from its stat family: pet · weapon · shield · machine · relic · oddity · card (cards stay outside combat). */
  function catOf(base) { const a = AV.progress && AV.progress.ARCH[base]; return a ? a.fam : null; }
  /**
   * Can this specimen enter a deck right now? Reads live save data and never throws.
   * code ∈ ok · missing (dismantled or lost) · card (cards stay outside combat) · nodef (no combat role) · notready (declared, not yet fielded)
   */
  function readiness(spec) {
    if (!spec) return { ok: false, code: 'missing', reason: 'Specimen not found (dismantled or lost).' };
    if (catOf(spec.base) === 'card') return { ok: false, code: 'card', reason: 'Cards stay outside combat.' };
    const d = DEFS[spec.base];
    if (!d) return { ok: false, code: 'nodef', reason: 'Not yet combat-ready: no combat role yet.' };
    if (!d.ready) return { ok: false, code: 'notready', reason: 'Not yet combat-ready: arrives in ' + (d.lands || 'a later update') + '.' };
    return { ok: true, code: 'ok', reason: '' };
  }
  AV.combat.defs = { DEFS, ROLES, catOf, readiness, get: id => DEFS[id] || null, ready: id => !!(DEFS[id] && DEFS[id].ready), list: () => Object.values(DEFS) };
})();
