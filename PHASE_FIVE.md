# AETHERVAULT — Phase Five: the Combat Phase

Turns Aethervault from a collection experience into a real-time tactical combat game: a rotating hand of deployable specimens, persistent commandable Pets, manually aimed ultimates, a tactical enemy, two-minute matches, simulated ranked progression.

**Status:** PLAN ONLY. No combat code exists. The Phase Four gate (section 1) is CLEARED: Phase Four is committed as `89d7920`, tag `phase-four-complete`. By the user's explicit instruction (2026-10-22) Phase Five/Combat has NOT been started and no `phase-five` branch exists; wait for the user to say go.
**Numbering:** Phase Four (`PHASE_FOUR.md`) is the last phase on record, so this is Phase Five. `PROJECT_OVERVIEW.md` and `README.md` list combat as "not planned unprompted"; the user has now asked for it explicitly, so those lines must be updated when this phase ships (not before).

---

## 1. Audit result and the gate

Observed on 2026-10-22, branch `phase-four`, HEAD `23c8bb2` (Phase Three checkpoint), tag `phase-three-complete`.

| Check | Result |
|---|---|
| Last committed phase | Phase Three / 3.1 (`23c8bb2`) |
| Phase Four committed? | **No.** 24 modified + 21 untracked paths, ~640 lines changed in tracked files. Nothing is committed. |
| Phase Four complete? | **No**, by its own handoff (`PHASE_FOUR.md` §8): Vault UI (pillar 9) written but never run in Chrome; Inspect "Organise" UI missing; machine post-reveal cooldown unbuilt; perf before/after not recorded; final Chrome validation, docs, `AV.VERSION` 0.5.0 bump, LF normalisation and commit all outstanding. |
| Node suites right now | logic 45/45, phase3 22/22, phase4 30/30 |
| Combat code in repo | None (the only `combat` hits are deferral notes in README/TODO/PROJECT_OVERVIEW) |
| Save schema | v3 (`SAVE_VERSION = 3`, key `aethervault.save.v1`), backups `…backup-p3`, `…backup-p4`, `…backup-fusion` |

**Gate (must be true before Combat A starts):** Phase Four finished or explicitly frozen, then committed as a checkpoint on `phase-four` (tag proposed: `phase-four-complete`), with the working tree clean. Combat work then branches from it as `phase-five`. Starting combat on top of an uncommitted tree would mix two phases in one diff and make the save v3 → v4 migration impossible to audit.

**Resolved:** the user chose (a), finish Phase Four first. Done and checkpointed (see `PHASE_FOUR.md` §10). Note for Combat A: the Phase Four run found the old validate/phase2/phase3 scripts contained hard-coded Phase Three facts; combat should add its own suite rather than lean on them.

---

## 2. What combat can build on (and what it cannot)

**Reusable as is**
- `AV.state` save + migration pattern (raw backup → migrate a copy → fingerprint → adopt or restore). Combat adds save v4 the same way.
- `AV.engine` as the only mutator; combat results (rewards, rating) must be committed through one engine action, once, keyed by a battle id.
- `AV.stats.compute(spec)` is deterministic per specimen and already includes upgrade level, form (branch), variant, condition, fusion rank/mutation, and card prints. Combat reads these; it never writes them.
- `AV.progress.displaySpec` (current look/form) gives the visual form of a specimen.
- `AV.audio` WebAudio synth with `play(name)`, buses and ducking.
- `AV.ui.register(name, {render})` router; `AV.bus` topics.
- Settings: `quality3d`, `fpsLimit`, `reducedMotion`, `flashing`, `shake`, four volume buses.

**Not reusable, must be built**
1. **A battle scene.** `AV.stage.View` is a one-specimen showcase (plinth, lighting rig per rarity, orbit controls, thumbnail copy). Combat needs one scene with a fixed 2.5D camera, a ground plane, many units, projectiles and effects, rendered by the *same* shared renderer (`S.renderer()`/`ensureGL`). Model builders take a `ctx` that `View.setSpec` assembles (`THREE, L, S, spec, F` materials, `q`, `rng, geo, disposables, tex, reduced…`); only `models-cards.js` and `forms.js` touch `ctx.view`, so pet/machine/gear/relic/oddity models can be built from a synthetic ctx.
2. **A cheap battle build of each model.** Measured in `docs/p3-perf-medium.json`: one Pet model is ~42–52k triangles and 56–226 draw calls (e.g. Emberkit L0 41.6k tris/56 calls; Pyrodrake L4+form 52k tris/226 calls). Ten units on the field plus support objects would be ~500k tris and thousands of draw calls, which cannot hold 60 fps. Combat therefore needs a **battle LOD**: build the full model once per specimen, then either merge static meshes by material (one draw call per material) and strip fine detail/pedestal/motes, or render a reduced variant. This is the single biggest technical risk and is spiked first (§6 step C0).
3. **A real-time simulation core** (fixed timestep, deterministic, pure, no DOM, so Node can test it). Nothing like it exists; all current logic is turn-less.
4. **Combat stat translation.** Stat families have no health/damage/range: Pet = power, agility, instinct, bond, resilience, mutation, growth; Weapon = power, speed, precision, stability, crit, energy; Shield = guard, resilience, reflect, stability, energy; Machine = output, efficiency, durability, precision, stability, overdrive; Relic = resonance, potency, stability, preservation, mystery; Oddity = coherence, containment, activity, distortion, stability. Cards have collecting stats only and stay out of combat.
5. **Input layer** (pointer events with a unified select/drag/aim/cancel abstraction), HUD, hand UI, deck editor, results screen, tutorial.

**Category mapping.** `data.js` has five categories: pet, gear, relic, machine, oddity. "Weapon" and "Shield" are *stat families* of gear items (ARCH `fam`): Rustblade, Ionbow, Gravehammer, Prismedge = weapon; Oak Buckler, Starforged Aegis = shield. Combat card categories therefore derive from `progress.ARCH[base].fam`, not from `item.cat`.

---

## 3. Design decisions (resolving ambiguity in the brief)

- **Deck entries** reference specimen ids (`{ id }`), never base ids. Validation reads live save data each time: missing / dismantled / locked-out / not-combat-ready specimens are flagged, never silently dropped. Dismantling a specimen that sits in a deck is warned in Standard mode and blocked unless the user confirms.
- **Cards (collectible) stay outside combat** in this phase, as the brief says. No combat role exists in the repo for them.
- **Fusion exists** (Phase Four), so fused specimens are legal deck entries and `AV.stats` already folds fusion in; fused-only rules (inherited abilities) are out of the vertical slice and documented as a limit.
- **Combat-ready is explicit data**: `combat.defs` has an entry per base item with `ready: true`. Anything else shows "Not yet combat-ready" in the deck builder and cannot be added.
- **Determinism**: simulation uses a seeded PRNG stream per battle (`mulberry32`, seed stored in the battle record), fixed step 1/30 s, no `Math.random`, no wall-clock reads inside `sim`. Rendering interpolates. This also makes tests, AI fairness checks and optional replays practical.
- **AI fairness**: AI gets a `view(sim, side)` function that exposes only what a human sees (no opponent hand, no future draws, no hidden cooldown numbers beyond what the HUD shows). Tests assert the AI module never receives the full sim object.
- **Data-driven balance**: one `combat/tuning.js` object holds every number named in the brief (elixir max/start/regen, surge timings and multipliers, 5 s move-command cooldown, redeploy surcharge, recovery times, tiebreak order, reshuffle cost and lockout, ELO K-factors).
- **Time-limit resolution** uses the brief's priority order exactly (Core % removed → remaining Core HP → meaningful damage → remaining Pet HP → sudden death). "Meaningful damage" excludes overkill, damage to decoys/summons below a value threshold, and self/ally damage.

---

## 4. Scope summary (from the brief, grouped)

1. **Arena** (one): compact 2.5D board, player half lower, enemy half upper, one central bridge plus side space, two Archive Cores, minimal cover, deployment masks, placement masks for machines/objects, Final Surge visual state.
2. **Deck / hand**: exactly 10 specimens, any mixture; presets and one recommended starter; hand of ≤4; every deployment refreshes the whole hand; unused cards go to a recently-seen queue (deprioritised for one refresh, never locked out; small pools degrade gracefully); manual reshuffle 1 Elixir with a short lockout; eligibility rules per card state; deterministic draws.
3. **Elixir**: max ~10, start ~4–5, regen with Final Surge multiplier, pauses at max; costs are data per combat def, not derived from rarity.
4. **Pets**: persistent, selectable, autonomous AI (pathing, range keeping, basic attacks, Q/E auto-use), manual move orders (walk, never teleport; 5 s per-Pet cooldown; interruptible), priority targets (soft order with defined interrupts), Q/E manual queue (max 1 per ability), R manual only with aiming.
5. **Aiming framework**: directional charge, AoE circle, cone, dash/charge, line/wall/barrier, self, chain target; every ability declares its aim model; every aim mode cancels safely (Esc, right-click, cancel button).
6. **Support cards** (deployed as their own battlefield effects, not Pet-ability rewrites): Gear/Weapons, Shields, Machines, Relics, Oddities. ≥80 % combat-focused, ≤20 % Elixir-oriented, each with an authored, physically-connected role.
7. **Defeat / recovery**: defeated Pet plays a recall, leaves, recovers 12–20 s (data), returns to the draw pool, redeploy surcharge +1 Elixir per redeploy up to a cap, match-local only. Never writes to the specimen.
8. **Enemy AI**: same rules, 6 personalities (aggressive swarm, defensive control, single-Pet carry, machine pressure, relic combo, balanced curator); first slice ships 3 archetype decks × 3 rating bands.
9. **Match**: 2:00, Core breach ends it; Final Surge 1:45–2:00 with an Elixir-regen step at 1:15; time-limit resolver; sudden death.
10. **Progression**: simulated ranked ladder (Initiate → Bronze → Silver → Gold → Mythic → Sovereign Archive, final names to be confirmed against `VISUAL_DIRECTION.md`), ELO with opponent-rating effect, smaller losses, Unlimited Mode explicit toggle, rewards (credits, essence, upgrade materials, containers, titles; no exclusive power), battle history (compact records, no full replays).
11. **UI/audio/tutorial/perf**: per §22–26 of the brief.

---

## 5. Vertical-slice roster (proposal, to be finalised in Combat B)

Chosen from existing items so every one has a 3D model, stats and forms today.

| Slot | Candidates (all exist) | Role notes |
|---|---|---|
| Pets (6, ≥1 each: ranged, Vanguard, Support, Disruptor) | Nimbus line incl. **Storm Sovereign** (Legendary†, ranged storm striker) with Tempestral / Pluvia as the **branching transformation** (damage vs. support); Grovewarden or Mossback (Vanguard); Pyrodrake (striker); Glimfin or Pluvia (Support); Gloomwing or Voidling (Disruptor) | Role is data on the combat def; branch (`spec.form`) switches the ability profile |
| Gear/Weapons (3) | Gravehammer (targeted slam), Ionbow (lane/zone emplacement), Prismedge (hunting floating blade) | |
| Shields (2) | Oak Buckler (barrier wall), Starforged Aegis (protect a Pet, reflect) | |
| Machines (3) | **Leviathan Engine** (§7), Scrap Rover or Sky Skiff (mobile body), Pocket Drone (repair/decoy) | One Elixir-interacting Machine (furnace-type) if a fitting item exists; else the Elixir minority is a Relic/Oddity |
| Relics (2) | Moonstone (slow/freeze area), Heart of Eternity or Oracle Tablet (revive/cooldown) | One may touch Elixir (stored Elixir) |
| Oddities (2) | Backwards Clock (rewind positions), Impossible Cube or Glitched Cursor (anomalous terrain / targeting distortion) | Deterministic and legible; one may disrupt Elixir |

Total 16 support+pet cards ≥ the brief's minimum (6 + 10). Note: Phase Three data has exactly 2 shields, so no spare.

**Leviathan Engine (initial authored behaviour):** deploys with a 1.5 s spin-up; follows a fixed lane graph along valid corridors toward the nearest enemy structure; contact damage scaled by `output`; on contact with one enemy that is not a Core or immune, *grapples* it for ≤3 s (scaled by `durability`), carries it along the route, then ejects it at a safe node. Carried target is untargetable by the enemy's AoE but can be shot by the carrier's owner. Cannot grapple twice on the same unit within 10 s. Hard rule: an ejected unit is always placed on a walkable cell, and a 4 s watchdog releases any hold. Both are tested.

---

## 6. Implementation plan (the brief's order, split into three subphases)

Each subphase leaves the game runnable, disables unfinished controls, updates this file, and ends with a handoff section.

### Combat A — foundations (arena, deck, hand, Elixir, one Pet)
- C0 **Spikes (before anything else):** (1) battle-scene on the shared renderer with a stub ctx building 12 units; record tris/draw calls/fps on Chrome Medium; (2) merged/LOD battle build; pick the approach from measured numbers. Output: numbers in §9.
- A1 Combat data model: `js/combat/defs.js` (combat defs per base item), `tuning.js`, `translate.js` (stat → combat attributes with breakdowns).
- A2 Save v4 (`migrateP5`: `combat: { decks, activeDeck, rating, division, history, tutorial, settings, unlocks }`), raw backup `…backup-p5`, fault-injection test, never touches specimens.
- A3 Deck editor screen + validation + presets + starter.
- A4 Pure sim core (`js/combat/sim.js`): grid/nav graph, units, fixed step, Elixir, hand/deck (`hand.js`) with recently-seen queue, reshuffle.
- A5 Arena + battle renderer + camera + HUD shell; one Pet deployed with movement, targeting, basic attack.
- Node tests: deck, hand, elixir, sim determinism. Chrome: arena smoke + perf record.

### Combat B — control, abilities, support
- B1 Move orders + 5 s cooldown + interrupts; priority target; selection feedback.
- B2 Ability framework (cooldowns, Q/E auto + manual queue, ultimate charge, R manual only) and the aiming framework with all seven aim models + cancel paths.
- B3 Pet defeat / recovery / redeploy surcharge.
- B4 One support card per category, then the full roster; Leviathan Engine.
- B5 Pooled projectiles/effects.

### Combat C — opponent, meta, polish
- C1 AI (view-limited), personalities, 3 decks × 3 bands.
- C2 Match flow: 2:00, Final Surge, resolver, sudden death, results; reward commit-once via battle id.
- C3 ELO, divisions, rewards, history; Unlimited Mode toggle.
- C4 Tutorial (12 steps, skippable, replayable).
- C5 Audio set, VFX polish, reduced motion, 3D Off 2D fallback board.
- C6 Profiling, targeted checks per §10, one final Chrome smoke test, docs, checkpoint.

---

## 7. Architecture sketch

```
js/combat/tuning.js    every balance number
js/combat/defs.js      per-item combat defs: role, cost, abilities {basic,q,e,r}, aim models, support effect, ready flag
js/combat/translate.js specimen -> combat attributes (+ breakdown strings); pure
js/combat/hand.js      10-card deck, 4-card hand, recently-seen queue, reshuffle; pure, seeded
js/combat/sim.js       fixed-step simulation; pure; no DOM, no Math.random, no clock
js/combat/ai.js        opponent; receives sim.view(side) only
js/combat/elo.js       rating math + divisions + rewards table
js/combat/input.js     pointer abstraction: select / order / aim / cancel (mouse now, touch later)
js/combat/render.js    battle scene on the shared renderer (one scene, pooled fx, LOD)
js/screens/combat.js   hub (play, deck, ladder, history), battle screen, results
js/screens/deck.js     deck editor
tests/combat.test.js   Node
tools/combat-smoke.mjs Chrome smoke (Puppeteer, one harness at a time)
```
Engine gains `combatCommit(battleRecord)` (single mutation point, idempotent on battle id). Everything else in combat is read-only against collection data.

---

## 8. Acceptance (condensed from the brief §29)
Deck · Hand · Elixir · Pets · Support · Match · AI · ELO · Performance · Regression exactly as listed in the brief; each becomes a named Node test or a recorded Chrome check, with results written to §9. Performance claims are recorded only as observed numbers (Chrome, this PC); no Zen Browser tuning.

## 9. Progress log and measurements
_Empty — not started (user asked to hold)._

## 10. Known risks
1. Battle LOD (§2.2) may need to degrade models noticeably; mitigated by spiking first.
2. Combat balance across 8 rarity tiers will need iteration; formulas are breakdown-able on screen from day one so tuning is visible.
3. Phase Four's unverified Vault could hide regressions that surface later in the deck picker (shared `vaultq`). Hence the gate.
4. Touch/mobile layouts of existing UI are unverified; combat input is abstracted but the combat layout is desktop-first.
