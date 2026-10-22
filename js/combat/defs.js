/* AETHERVAULT — Combat definitions: one entry per base item that has (or will have) a combat role. Pure data (no DOM, no state).
 *   ready   true only when the current build can actually field it; anything else shows "Not yet combat-ready" and cannot enter a deck.
 *   cost    Elixir cost, authored (never derived from rarity)
 *   Pets    hp / dmg / range / speed / interval are BASE values for a specimen whose relevant stats are all 50; translate.js scales them.
 *   Pets   abilities { q, e, r } (each declares one aim model, see aim.js) exist ONLY for the six-Pet representative roster (flag slice:true). Every other Pet is a
 *          "Limited Combat Kit": its translated stats, battle model, automatic basic attack, orders and targeting, plus at most one simple passive. The label is
 *          DERIVED (kit === 'limited' when q/e/r are not all authored), never hand-kept, so a new Pet cannot silently ship looking complete.
 *   Support defs (weapons, shields, machines, relics, oddities) are fielded in Combat B; their numbers are base values scaled by translate().attrs (1.00 at stat 50).
 * Combat categories come from progress.ARCH[base].fam (a Rustblade is a weapon, an Oak Buckler a shield); cards never enter combat. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const P = (role, cost, hp, dmg, range, speed, interval, extra) => Object.assign({ cat: 'pet', role, cost, hp, dmg, range, speed, interval, aggro: Math.max(6, range + 3.5), radius: 0.5, ready: true, atk: range > 2.5 ? 'ranged' : 'melee' }, extra);
  /** One ability. cd seconds · range = cast distance from the caster · windup seconds before the effect lands · auto = when the Pet may cast it by itself (R is never automatic). */
  const Ab = (name, aim, o) => Object.assign({ name, aim, cd: 8, range: 0, windup: 0.3, auto: 'enemy' }, o);
  /** A support card. place: zone (own deployment rows) · own (own half) · field (anywhere) · ally / enemy (click a unit) · none. */
  const X = (cat, cost, blurb, o) => Object.assign({ cat, role: cat, cost, ready: true, blurb, windup: 0.3 }, o);
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
    pluvia:         P('support', 4, 340, 12, 4.0, 1.8, 1.20, { blurb: 'Rain-bringer that mends allies (support branch).', hit: 'drop', passive: { name: 'Soft Rain', text: 'Allies within 3 cells regain 1.5% of their HP each second.', aura: { heal: 0.015, radius: 3 } } }),
    stormsovereign: P('ranged', 7, 520, 42, 5.5, 1.6, 1.10, { blurb: 'Storm ruler; the strongest ranged unit.', hit: 'bolt', slice: true, abilities: {
      q: Ab('Stormbolt', 'dir', { cd: 6, length: 7.5, width: 0.9, dmg: 1.5, windup: 0.3, text: 'A piercing bolt along a line.' }),
      e: Ab('Static Chain', 'chain', { cd: 9, range: 6, hops: 3, hopRange: 3.2, falloff: 0.8, dmg: 1.1, text: 'Lightning that jumps to up to three more enemies.' }),
      r: Ab('Tempest', 'circle', { range: 8, radius: 2.6, windup: 0.9, dmg: 3.2, slow: [0.5, 2.5], text: 'A storm cell crashes down: heavy damage and a slow.' })
    } }),
    emberkit:       P('striker', 2, 200, 20, 1.2, 2.4, 0.80, { blurb: 'A quick ember-fox that bites and darts.', hit: 'claw' }),
    pyrodrake:      P('striker', 5, 480, 38, 1.6, 2.1, 1.00, { blurb: 'A winged flame drake, fast and brutal up close.', hit: 'flame', slice: true, abilities: {
      q: Ab('Wing Dash', 'dash', { cd: 6, length: 5, width: 1.1, dash: 16, dmg: 1.1, auto: 'gap', windup: 0.1, text: 'Dashes in a line, burning what it crosses.' }),
      e: Ab('Flame Breath', 'cone', { cd: 7, length: 3.6, angle: 70, dmg: 1.7, text: 'A cone of flame.' }),
      r: Ab('Inferno', 'self', { radius: 2.9, windup: 0.5, dmg: 2.8, knock: 1.2, text: 'A burst of fire around itself that shoves enemies back.' })
    } }),
    pebblor:        P('vanguard', 3, 420, 14, 1.2, 1.2, 1.30, { blurb: 'A stubborn stone that does not move.', hit: 'thud', passive: { name: 'Stone Skin', text: 'Takes 15% less damage.', armor: 0.15 } }),
    mossback:       P('vanguard', 4, 600, 18, 1.3, 1.1, 1.40, { blurb: 'Meadow tortoise; slow, sturdy, patient.', hit: 'thud', slice: true, abilities: {
      q: Ab('Shell Guard', 'self', { cd: 10, shield: { pct: 0.3, dur: 4 }, auto: 'threat', trigger: 3, windup: 0.2, text: 'Draws into its shell: absorbs damage for 4 s.' }),
      e: Ab('Shell Bash', 'cone', { cd: 8, length: 2.2, angle: 100, dmg: 1.4, stun: 0.9, text: 'A short, wide bash that stuns.' }),
      r: Ab('Bastion', 'self', { radius: 3.6, windup: 0.4, taunt: 3, shield: { pct: 0.25, dur: 5 }, ally: true, text: 'Enemies nearby must attack it; it and its allies gain a shield.' })
    } }),
    grovewarden:    P('vanguard', 6, 800, 28, 1.5, 1.3, 1.40, { blurb: 'A grove that became a guardian.', hit: 'root', slice: true, abilities: {
      q: Ab('Root Snare', 'circle', { cd: 9, range: 5, radius: 1.7, root: 2.2, dmg: 0.7, text: 'Roots erupt and hold enemies in place.' }),
      e: Ab('Thorn Wall', 'line', { cd: 14, range: 4, length: 3.4, width: 1, wall: { dur: 6 }, auto: 'none', text: 'Raises a wall of thorns that blocks movement (manual only).' }),
      r: Ab('Overgrowth', 'circle', { range: 6, radius: 3.2, windup: 0.8, root: 1, zone: { dur: 6, tick: 1, dmg: 0.45, slow: 0.55 }, text: 'A thicket that roots, then slows and wounds everything inside.' })
    } }),
    glimfin:        P('support', 3, 240, 10, 4.0, 2.0, 1.20, { blurb: 'Bright finned healer-skirmisher.', hit: 'drop', slice: true, abilities: {
      q: Ab('Bright Link', 'chain', { cd: 7, range: 5, hops: 2, hopRange: 3, falloff: 0.8, heal: 0.22, ally: true, auto: 'hurt', text: 'Heals an ally, then jumps to up to two more.' }),
      e: Ab('Bubble Ward', 'circle', { cd: 12, range: 5, radius: 2, zone: { dur: 5, tick: 1, heal: 0.07 }, ally: true, auto: 'hurt', text: 'A ward that mends allies standing in it.' }),
      r: Ab('Tidal Surge', 'self', { radius: 5, windup: 0.5, heal: 0.35, ally: true, cleanse: true, text: 'A wave that heals nearby allies and washes away slows and stuns.' })
    } }),
    gloomwing:      P('disruptor', 4, 300, 22, 3.2, 2.2, 1.00, { blurb: 'Dark flier that harries the back line.', hit: 'shadow' }),
    voidling:       P('disruptor', 3, 260, 16, 3.0, 1.9, 1.10, { blurb: 'A small hole in the world that nips.', hit: 'shadow', slice: true, abilities: {
      q: Ab('Rift Pull', 'circle', { cd: 8, range: 5, radius: 2, pull: 1.6, dmg: 0.6, auto: 'group', text: 'Drags enemies toward a point.' }),
      e: Ab('Dread Wave', 'cone', { cd: 9, length: 3.6, angle: 90, dull: [1.7, 3.5], dmg: 0.5, text: 'Slows how fast enemies can attack.' }),
      r: Ab('Event Horizon', 'circle', { range: 6, radius: 3, windup: 0.8, pull: 2.2, stun: 1.2, dmg: 2.2, text: 'A collapse that pulls enemies in, stuns and wounds them.' })
    } }),
    sunmane:        P('striker', 5, 520, 34, 1.4, 1.9, 1.00, { blurb: 'Radiant lion; steady, proud, dangerous.', hit: 'claw' }),
    // ---- Support cards (Combat B4). Base numbers; translate().attrs scale them (damage, hp, duration, radius, accuracy… 1.00 at stat 50).
    gravehammer:     X('weapon', 3, 'Targeted slam on a chosen point.', { aim: 'circle', place: 'field', radius: 1.7, windup: 0.8, dmg: 150, stun: 0.8, kind: 'slam', scale: { dmg: 'damage', radius: 'accuracy' } }),
    ionbow:          X('weapon', 4, 'Lane emplacement that fires along a line.', { aim: 'line', place: 'zone', kind: 'emplacement', hp: 260, dur: 10, interval: 1.2, dmg: 30, length: 9, width: 1.3, radius: 0.6, scale: { dmg: 'damage', interval: 'tempo', hp: 'reliability' } }),
    prismedge:       X('weapon', 4, 'A floating blade that hunts a target.', { aim: 'chain', place: 'enemy', kind: 'blade', hp: 90, dur: 7, speed: 5.5, interval: 0.7, dmg: 14, reach: 0.9, radius: 0.35, scale: { dmg: 'damage', interval: 'tempo', speed: 'accuracy' } }),
    oakbuckler:      X('shield', 2, 'Barrier wall placed on the field.', { aim: 'line', place: 'own', kind: 'barrier', hp: 320, dur: 8, length: 3, width: 1, scale: { hp: 'hp', dur: 'duration' } }),
    aegis:           X('shield', 3, 'Protects one Pet and reflects part of the damage.', { aim: 'chain', place: 'ally', kind: 'ward', guard: 0.4, reflect: 0.25, dur: 6, radius: 1.2, scale: { guard: 'absorb', reflect: 'reflect', dur: 'duration' } }),
    leviathan:       X('machine', 6, 'Grapples an enemy and carries it along the lane.', { aim: 'point', place: 'zone', kind: 'leviathan', hp: 700, dur: 30, speed: 1.6, dmg: 40, spinUp: 1.5, grapple: 3, radius: 0.9, contact: 1.5, scale: { dmg: 'damage', hp: 'hp', grapple: 'hp' } }),
    scraprover:      X('machine', 4, 'A mobile body that rams the line.', { aim: 'point', place: 'zone', kind: 'rover', hp: 340, dur: 20, speed: 3, dmg: 34, interval: 0.9, aggro: 5, ram: { knock: 1.5, stun: 0.5 }, radius: 0.6, scale: { dmg: 'damage', hp: 'hp' } }),
    pocketdrone:     X('machine', 3, 'Repair drone and decoy.', { aim: 'point', place: 'zone', kind: 'drone', hp: 110, dur: 10, speed: 3, repair: 16, reach: 3, bait: 2, radius: 0.4, scale: { repair: 'damage', hp: 'hp' } }),
    moonstone:       X('relic', 3, 'Slows (and briefly freezes) an area.', { aim: 'circle', place: 'field', kind: 'zone', radius: 2.6, dur: 6, slow: 0.45, freeze: 0.6, scale: { radius: 'radius', dur: 'duration', slow: 'strength' } }),
    heartofeternity: X('relic', 5, 'Revives or refreshes a fallen Pet.', { aim: 'self', place: 'none', kind: 'revive', heal: 0.15, refund: 2, elixir: true, scale: { heal: 'strength' } }),
    backwardsclock:  X('oddity', 4, 'Rewinds positions a short way.', { aim: 'self', place: 'none', kind: 'rewind', rewind: 2.5, scale: { rewind: 'control' } }),
    glitchedcursor:  X('oddity', 3, 'Distorts enemy targeting.', { aim: 'circle', place: 'field', kind: 'zone', radius: 2.4, dur: 5, distort: true, scale: { radius: 'radius', dur: 'duration' } }),
  };
  Object.keys(DEFS).forEach(id => {
    const d = DEFS[id]; d.id = id; d.roleName = ROLES[d.role].name;
    if (d.cat === 'pet') { const a = d.abilities; d.kit = a && a.q && a.e && a.r ? 'full' : 'limited'; d.limited = d.kit === 'limited'; ['q', 'e', 'r'].forEach(k => { if (a && a[k]) { a[k].slot = k; a[k].id = id + '.' + k; } }); }
  });

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
  /** UI label, derived from the data: 'Limited Combat Kit' for a Pet without authored Q/E/R, else null. */
  const kitLabel = id => { const d = DEFS[id]; return d && d.cat === 'pet' && d.limited ? 'Limited Combat Kit' : null; };
  AV.combat.defs = { DEFS, ROLES, catOf, readiness, kitLabel, get: id => DEFS[id] || null, ready: id => !!(DEFS[id] && DEFS[id].ready), list: () => Object.values(DEFS) };
})();
