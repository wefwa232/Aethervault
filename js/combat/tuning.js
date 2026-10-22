/* AETHERVAULT — Combat tuning: every balance number in one place. Pure data (no DOM, no state), frozen.
 * Units: time in seconds, distance in arena cells (1 cell = 1 unit), Elixir in whole points. Values are first drafts to be tuned in play. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};
  const freeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(o); };
  AV.combat.tuning = freeze({
    version: 1,
    step: 1 / 30,                                            // fixed simulation step (30 Hz); rendering interpolates
    match: { duration: 120, surgeAt: 105, regenStepAt: 75, suddenDeath: 30 }, // 2:00; Final Surge 1:45–2:00; regen step at 1:15 (elapsed seconds)
    elixir: { max: 10, start: 5, regen: 0.36, regenStepMult: 1.25, surgeMult: 2 }, // regen = Elixir per second at base; the multipliers apply from the times above
    hand: { deck: 10, size: 4, recentRefreshes: 1, reshuffleCost: 1, reshuffleLockout: 3 }, // recently-seen cards are deprioritised for one refresh, never locked out
    pet: { moveCooldown: 5, recover: [12, 20], redeploySurcharge: 1, redeployCap: 3, deployDelay: 0.8 },
    arena: {
      w: 12, h: 18, cell: 1,
      core: { hp: 2400, radius: 1.1, offset: 1.6 },           // each side has one Archive Core near its back edge
      bridge: { x0: 5, x1: 7 },                               // central bridge columns; side space remains walkable
      deploy: { playerRows: [11, 16], enemyRows: [2, 7] },    // z ranges (cells) where each side may deploy
    },
    tiebreak: ['corePctRemoved', 'coreHpRemaining', 'meaningfulDamage', 'petHpRemaining', 'suddenDeath'], // time-limit resolution priority, in order
    meaningful: { decoyHpBelow: 60, excludeOverkill: true, excludeSelfAlly: true },
    combat: { critMult: 1.5, critMax: 0.35, retarget: 0.4, arrive: 0.25 },
    elo: { start: 1000, kNew: 40, kNormal: 24, kHigh: 16, newGames: 10, highRating: 1800, lossFactor: 0.8, floor: 100 },
    ladder: [ // names to be confirmed against VISUAL_DIRECTION.md before they ship (Combat C)
      { id: 'initiate', name: 'Initiate', from: 0 }, { id: 'bronze', name: 'Bronze', from: 900 }, { id: 'silver', name: 'Silver', from: 1100 },
      { id: 'gold', name: 'Gold', from: 1300 }, { id: 'mythic', name: 'Mythic', from: 1550 }, { id: 'sovereign', name: 'Sovereign Archive', from: 1800 }],
  });
})();
