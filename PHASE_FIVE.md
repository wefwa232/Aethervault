# AETHERVAULT — Phase Five: the Combat Phase

Turns Aethervault from a collection experience into a real-time tactical combat game: a rotating hand of deployable specimens, persistent commandable Pets, manually aimed ultimates, a tactical enemy, two-minute matches, simulated ranked progression.

**Status:** **Combat A is DONE** (branch `phase-five`, tag `phase-five-combat-a`, 2026-10-22): C0 spikes, combat data and stat translation, save v4, deck editor, the pure simulation, and a Training Arena with Pets. **Combat B and Combat C are NOT started.** The progress log, measurements, decisions and the exact handoff to Combat B are in section 9. The Phase Four gate (section 1) was cleared before this work began: Phase Four is committed as `89d7920`, tag `phase-four-complete`.
**Numbering:** Phase Four (`PHASE_FOUR.md`) is the last phase on record, so this is Phase Five. `PROJECT_OVERVIEW.md` and `README.md` listed combat as "not planned unprompted"; the user has now asked for it explicitly. Combat A has added a Phase Five section to both (marked in progress); the older per-version "Not in this version: … combat" lines are historical and stay. A full rewrite of both is due when the whole phase ships.

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
- ✅ C0 **Spikes (before anything else):** (1) battle-scene on the shared renderer with a stub ctx building 12 units; record tris/draw calls/fps on Chrome Medium; (2) merged/LOD battle build; pick the approach from measured numbers. Output: numbers in §9.
- ✅ A1 Combat data model: `js/combat/defs.js` (combat defs per base item), `tuning.js`, `translate.js` (stat → combat attributes with breakdowns).
- ✅ A2 Save v4 (`migrateP5`: `combat: { decks, activeDeck, rating, division, history, tutorial, settings, unlocks }`), raw backup `…backup-p5`, fault-injection test, never touches specimens.
- ✅ A3 Deck editor screen + validation + presets + starter.
- ✅ A4 Pure sim core (`js/combat/sim.js`): grid/nav graph, units, fixed step, Elixir, hand/deck (`hand.js`) with recently-seen queue, reshuffle.
- ✅ A5 Arena + battle renderer + camera + HUD shell; one Pet deployed with movement, targeting, basic attack.
- ✅ Node tests: deck, hand, elixir, sim determinism. Chrome: arena smoke + perf record.

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

### 9.1 Combat A — DONE (2026-10-22, branch `phase-five`, tag `phase-five-combat-a`)
Scope delivered exactly as asked: C0 spikes, then A1–A5. Combat B and C are **not started**. `AV.VERSION` is `0.6.0` / build `P5A-20261022` / "Phase Five · Combat A (in progress)".

| Step | What exists now | Evidence |
|---|---|---|
| C0 | `js/combat/lod.js` (battle LOD), `js/combat/render.js` (battle scene on the shared renderer), `tools/combat-spike.mjs`, `docs/p5-spike-medium.json`, `docs/p5-spike-low.json` | §9.2 |
| A1 | `js/combat/tuning.js` (frozen; every number the plan names), `defs.js` (26 defs: 14 Pets ready, 12 support declared `ready:false`), `translate.js` (stat → combat attributes, with a formula string per number) | `tests/combat.test.js` A1 (11 checks) |
| A2 | Save **v4** (`migrateP5`, `defaultCombat`, `normCombat`), raw backup `aethervault.save.v1.backup-p5` written once, fault-injection hook `AV.__faultP5`, import path; engine deck actions (`deckCreate/Update/Delete/SetActive/Duplicate`); `protectReason` returns "In a combat deck" | A2 (8 checks) + A2/A3 (4 checks) |
| A3 | `screens/combat.js` (hub), `screens/deck.js` (editor), `css/combat.css`, Combat in the rail; presets (Recommended Starter, Quick Swarm, Heavy Guard) computed from the collection by `combat/deck.js` | Chrome `deck` scenario, 11 checks |
| A4 | `combat/sim.js` (pure, fixed 1/30 s, seeded, nav grid + A*, Elixir in milli-points, melee/ranged basic attacks, projectiles, Cores, 2:00 clock, regen step 1:15, Final Surge 1:45, time-limit result), `combat/hand.js` (pure) | A4 (26 checks incl. determinism and "no Math.random / Date.now") |
| A5 | `screens/battle.js` (Training Arena), `css/battle.css`, `combat/input.js` | Chrome `arena` scenario, 16 checks |

### 9.2 C0 spike numbers (observed; headless Chrome 1600×900, DPR 1; this PC)
GPU: AMD Radeon RX 7800 XT through ANGLE/D3D11 — a strong card, so **absolute milliseconds are optimistic; compare rows, not machines**. Ranked by what was measured, not by what was expected.

Method note: with an uncapped rAF the headless browser sits at ~143.9 fps (6.95 ms) for *every* approach, so frame pacing cannot tell them apart. The spike therefore also times `render()` followed by a 1-pixel `readPixels` (this forces a GPU sync; `gl.finish()` did not block in this Chrome and was discarded after a first run showed sync time equal to submit time). "Sync ms" is render + readback + the copy into the 2D canvas.

| Medium, 12 units | draw calls | triangles | sync ms (avg / p95) | CPU submit ms | programs | build, 12 units |
|---|---|---|---|---|---|---|
| 12 Pets, full models (as the showcase builds them) | 690 | 263k | 2.87 / 3.3 | 2.18 | 41 | 317 ms (cold) |
| 12 Pets, merged per material | 130 | 282k* | 1.55 / 1.9 | 0.47 | 33 | 87 ms |
| 12 Pets, **merged + equal materials collapsed** | **127** | 282k* | **1.53 / 1.9** | **0.45** | 33 | 50 ms |
| 12 Pets, collapsed + coarser skins ×2 | 127 | 257k | 1.51 / 1.9 | 0.46 | 33 | 61 ms |
| 12 Pets, collapsed + coarser skins ×3 | 127 | 252k | 1.51 / 1.9 | 0.45 | 33 | 122 ms |
| Mixed 12 (4 Pets, 3 machines, 2 weapons, shield, relic, oddity), full | 835 | 229k | 2.95 / 3.4 | 2.16 | 40 | 159 ms |
| Mixed 12, **collapsed** | **125** | 174k* | **1.41 / 1.8** | **0.40** | 30 | 123 ms |

\* merged meshes are not frustum-culled, full models are; so the triangle column compares a culled and an unculled count.
Low quality gives the same shape (12 Pets: full 722 calls / 2.52 ms sync → collapsed 127 calls / 1.31 ms; programs 29 → 22). Per unit, draw calls fall 17 → 3 (Nimbit), 28 → 5 (Nimbus), 36 → 8 (Tempestral); triangles stay 25–36k per Pet because the cost is in the metaball skins and tapered tubes, not in the call count. The resulting scene never exceeded 3 ms sync time here.

**Spike 1 (battle scene with 12 units on the shared renderer):** works. A stub ctx is enough: only models-cards and a form motif read `ctx.view`, and both guard it. Lights, sprites, points and additive glow are stripped.
**Spike 2 (battle LOD), decision:** *merge static meshes per material and collapse equal materials* (calls ÷ 5.5, CPU submit ÷ 5, sync ÷ 2). Coarser marching-cube skins (`ctx.lod`, a three-line hook in `kit.js`; default off) save at most ~10% of triangles and were **not adopted**. Cost of the decision: a merged unit is a **frozen pose**; wings, flames, faces and every other animated part stop moving. The battle animates the whole unit (bob, turn, lunge, spawn scale). `merge()` has an unused `keep` predicate for leaving animated sub-groups out if Combat B wants them.
Not measured: integrated or low-end GPUs, other browsers, vsync-bound frame times on a 60 Hz panel.

### 9.3 Tests and checks at the end of Combat A
| Suite | Result |
|---|---|
| `node tests/combat.test.js` | **49/49** (new) |
| `node tests/logic.test.js` | 45/45 (two assertions updated: schema is v4; `m.version` follows `SAVE_VERSION`) |
| `node tests/phase3.test.js` | 22/22 |
| `node tests/phase4.test.js` | 30/30 (three assertions updated: a v2 save now climbs to v4) |
| `node tools/combat-smoke.mjs all` (Chrome; real clicks and keys) | **28/28**; `docs/p5-smoke-a-final.json`, screenshots in `docs/screenshots/phase5/` |
| `node tools/validate.mjs` groups (Chrome) | boot/modes/protect/upgrade/evolve 35/35, audio/save/motion 10/10, buttons 1/1, reveals/leaks 22/22, quality/responsive 9/9; 0 page errors |
| `node tools/phase3.mjs` (Chrome) | 39/39 |
| `node tools/phase2.mjs` (Chrome) | 40/40 on the second run. The first run was 39/40 (`fps: no page errors` — `ERR_CONNECTION_REFUSED`): two harnesses had been started back to back and the first one's server shut down while the next was using it. Not a code fault; it passed on rerun. |

Dev helpers added: `tools/combat-spike.mjs` (C0), `tools/combat-smoke.mjs` + `tools/combat-arena-scenario.mjs` (smoke), `tools/combat-leak.mjs` (enter/leave probe), `tools/combat-debug.mjs` (open the arena once, print console, screenshot).

The validation groups were run one at a time, as separate invocations. Their report files under `docs/` were regenerated by the runs and then **restored from Phase Four** so that its recorded evidence is not overwritten.

**Arena performance (Medium, 1600×900, one Pet fighting the sparring post, 5 s sample, `docs/p5-smoke-a-final.json`):** 300 frames, average 16.66 ms (60 fps = the Medium cap), p95/p99 20.9 ms, worst 21 ms (the 60 fps limiter quantised to a ~144 Hz display), **0 frames over 33 ms**; JS per frame 0.7 ms; 34 draw calls and ~14.2k triangles; 17 shader programs; JS heap ≈ 28 MB. Per-frame allocations (`view()`, overlay path arrays, a `Set` of live units) were not audited; the heap staying flat over the sample and over repeated entries is the only GC evidence.
**Leak check (enter and leave the arena 8 times):** geometries flat at 85, shader programs flat, textures plateau after the first two entries (the pattern/wear caches filling), heap flat around 29 MB. This check **found a real leak** on its first run: `lod.build().dispose()` never freed `ctx.tex`, where models park per-instance canvas textures (creature faces), so each entry kept one texture. Fixed in `lod.js`; the smoke now asserts flat counts (geometries ≤ +2, textures ≤ +3, programs ≤ +2 over four re-entries).

### 9.4 Defects found by running it, and fixed
1. `sim.js` and `hand.js` were missing from `index.html` (the arena failed to start with `C.sim` undefined). Found in Chrome; fixed.
2. `normCombat` read its fallbacks from an object `Object.assign` had already overwritten with the bad input (`rating: 'abc'` survived). Found by the Node test; fixed.
3. Per-entry texture leak (above).
4. Deck-slot text truncated its range; the rail did not light Combat while on the deck/battle screens; first camera framing cut the player Core and Pets were too small. All fixed and looked at in screenshots.

### 9.5 Decisions and deviations (read before Combat B)
1. **(Confirmed and refined by the user, §9.8.1.)** **All 14 Pets are `ready:true`**, not only the six in the §5 slice (those six carry `slice:true`). Reason: a deck needs 10 specimens and a new collection rarely holds six particular species. Each Pet has authored role, cost, HP, damage, range, speed, interval.
2. **Support defs exist but are `ready:false`** (12: 3 weapons, 2 shields, 3 machines, 2 relics, 2 oddities). §5 says "16 cards" but its own table lists 6 Pets + 12 support = 18; the table is what was implemented.
3. **"Locked-out" (§3)** was interpreted as *cards* (collectible Cards cannot enter combat). `specimen.locked` is the Vault's dismantle protection and is not a combat restriction.
4. **(Confirmed by the user, with extra requirements, §9.8.2.)** **Dismantle / fuse protection is a hard block, not warn-and-confirm.** `protectReason()` returns "In a combat deck", so dismantle, bulk dismantle and fusion skip such specimens (Standard **and** Unlimited) until they are taken out of the deck. Simpler and safer than touching three UI call sites; a confirm path can replace it later.
5. **Save v4 failure path:** if `migrateP5` is rejected the original save loads at its old version (retry next load) with no `combat` block; Combat screens then show "Combat data unavailable". Every other screen is unaffected.
6. **Defeat → recovery (12–20 s, seeded) → pool and the +1 Elixir redeploy surcharge (cap 3) are already in `hand.js` / `sim.js` and tested**, because hand eligibility needs them. B3 therefore shrinks to presentation (recall animation, HUD countdown on the card) and edge cases.
7. **Time limit in Combat A is only "which Core has more HP left"** (equal → draw). The full resolver and sudden death are C2. There is no opponent, so the Training Arena says "Practice complete" and awards nothing.
8. **The opponent side is a stationary sparring post** (600 HP, respawns after 6 s). `create({ b: … })` accepts a second side but nothing drives it yet.
9. **Combat needs 3D.** With 3D Off the hub disables the Training Arena and says why; the 2D board is C5.
10. **Sound:** the arena reuses existing synthesised sounds (toast, thump, crack, slide, whoosh, lockset, error, levelup). A combat set is C5. None of it has been listened to.
11. **Tuning values are first drafts** (e.g. Elixir regen 0.36/s, ×1.25 at 1:15, ×2 in the Surge, Core 2400 HP, board 12×18). They live in `tuning.js` and the on-screen "Numbers" panel and deck editor show the formulas.
12. `AV.combat.live` (the running battle: `sim`, `scene`, `api`) is a **test hook** for the Chrome harness; it is null outside the arena.
13. Edits outside `js/combat`: `core.js` (+`S.env`, `S.glCanvas`), `kit.js` (`ctx.lod` hook, off by default), `state.js`, `engine.js` (deck actions, `protectReason`, `fuseBlockers`), `ui.js` (nav entry, `NAV_OF`), `util.js` (version), `index.html`.

### 9.6 Not verified
Touch input (pointer events are used, only a mouse was driven), phone layouts of the arena (the deck editor was checked at 700 px, the arena was not), other browsers, low-end GPUs, audio (never listened to), reduced-motion and 3D-Off behaviour of the arena (code paths exist; not driven), the visual polish of unit scale and lighting on every one of the 14 Pets (looked at three or four in screenshots).

### 9.7 HANDOFF — start of Combat B
**State:** branch `phase-five`, tag `phase-five-combat-a` on the Combat A commit, working tree clean. `git log --oneline` from `phase-four-complete` shows: plan, C0, A1–A4, A3 UI, Combat A completion. The app runs: `node serve.mjs 5173`, then Combat → Active deck → Training arena (needs an active deck with ≥ 1 ready specimen and 3D on). To get a deck in a test save run `AV.engine.deckCreate('Starter', AV.combat.deck.presets(AV.state.get())[0].ids)` or use the editor's "Build the recommended starter".
**Verify before touching anything:** `node tests/combat.test.js` (49), the three older Node suites, then `node tools/combat-smoke.mjs all` (28). One browser harness at a time; wait for the previous one to exit before starting the next.

**B1 — move orders, priority target, selection** (start here)
- `sim.js`: add command types `move` and `target` in `apply()`. Unit fields: `order {x,z}` (walk via `findPath`, never teleport; interruptible), `prio` (soft target). Per-Pet 5 s cooldown lives in `sides[k].moveCd[cardId]` (`tuning.pet.moveCooldown` already exists). Orders must be cancelled when the Pet dies and must not break `hash()` determinism: extend the determinism test with the new commands.
- `input.js` already emits hover/confirm/cancel/key; add *select unit* (use `scene.pick` + nearest sim unit within its radius) and a drag-order gesture. `battle.js` overlay: selection ring and order line (use `scene.toScreen`).
- Tests: new "B1" section in `tests/combat.test.js` (cooldown, interruption by retarget rules, walk not teleport, order onto blocked ground refused).
**B2 — ability framework and aiming**: put `abilities: { basic, q, e, r }` with an `aim` model on each Pet def in `defs.js` (the six `slice:true` Pets first); `sim.js` gets an `ability` command, cooldowns (`translate().cdr` is the Bond multiplier), ultimate charge, Q/E auto + one queued manual use, R manual only. The aiming framework (directional charge, AoE circle, cone, dash/charge, line/wall/barrier, self, chain target) is a new module (e.g. `combat/aim.js`, pure geometry + a preview drawer in the battle overlay); every mode must cancel with Esc, right-click and a visible cancel button (Esc already cancels a selection first and pauses only if nothing was cancelled).
**B3 — defeat presentation**: state machine and surcharge exist (§9.5.6). Add the recall animation (the model currently shrinks away in 0.35 s), a countdown on the hand/deck strip card (the deck strip already shows seconds), and tests for edge cases (defeat during spawn, simultaneous defeats, redeploy at the cap).
**B4 — support cards**: flip `ready` in `defs.js` as each lands. `hand.play(h, id, 'support')` already returns the card to the pool; `sim.apply` only handles Pets, so add a `deploySupport` branch per category; effects use `translate().attrs` (multipliers, 1.00 at stat 50). Non-Pet models go through `lod.build` unchanged (verified for machines, weapons, a shield, a relic and an oddity in the spike). Leviathan Engine behaviour is specified in §5 and its hard rules (always eject onto a walkable cell, 4 s watchdog) need their own tests. Update the deck editor copy ("arrives in Combat B") and `tests/combat.test.js` expectation "12 support defs not ready" when cards become ready.
**B5 — pooled projectiles and effects**: the arena currently reuses a pool of 24 plain spheres (`battle.js`, `cache.pool`). Replace with an effects module that also covers hit flashes and ability telegraphs; keep it allocation-free per frame.

**Things Combat B must not break:** determinism (same seed + commands → same `hash`), the "no `Math.random` / `Date.now` / DOM in the pure modules" test, "combat never writes a specimen" (byte-identical test), save v4 and its backup/fault-injection tests, the leak check in `combat-arena-scenario.mjs`, and the rule that every rule lives in `sim.js` while `battle.js` only presents.
**Known limits to plan around:** a merged unit is a frozen pose (see §9.2); the AI side does not exist (`sides.b` is unused); only Pets can be fielded; the training dummy is `kind:'dummy'`, static, and ignores everything except damage.
**Questions for the user:** both were answered on 2026-10-22; see §9.8. They change the order of work below: item 2 of §9.8 (the deck-block message) is **B0, the first task of Combat B**, and item 1 (the Limited Combat Kit label) is part of B2.

### 9.8 Design decisions from the user (2026-10-22, after Combat A) — binding for Combat B and C
**1. All 14 Pets stay fieldable in decks; only six need full Q/E/R kits.**
- Full authored Q/E/R kits are required only for the six-Pet representative roster of §5. In the data those are the Pets flagged `slice:true`: Storm Sovereign, Pyrodrake, Mossback, Grovewarden, Glimfin, Voidling. §5 phrases several slots as "A or B" (Tempestral / Pluvia as the branching transformation of the Nimbus line, Grovewarden or Mossback, Glimfin or Pluvia, Gloomwing or Voidling), so **confirm the final six at the start of B2** rather than assuming the flags are final.
- The other eight (Nimbit, Nimbus, Tempestral, Pluvia, Emberkit, Pebblor, Gloomwing, Sunmane) get only: their translated combat stats, the battle LOD, the automatic basic attack, move orders, priority targeting, and **at most one simple role-appropriate passive, and only if the simulation already supports it cleanly**. **No shallow generic Q/E/R abilities** invented to make all 14 look complete.
- Those Pets are labelled **"Limited Combat Kit"**. This is a data flag on the def (derived from "has no authored Q/E/R", not a hand-kept list that can drift) and is shown in the deck editor, on the hand card, in the Numbers panel and on the hub. **Not implemented yet.**
- Training: limited-kit Pets stay fully usable. Ranked (C3): they must not drive consequential progression until their full kits exist. Either (a) a ranked deck may not contain them, or (b) the match is shown as **Experimental — no rating change** before it starts. Choose at C3; whichever is chosen, a match with a limited-kit Pet in the deck never changes the rating, and the rule is visible in the deck editor and before the match.
- Tests to add: B2 asserts every `ready` Pet either has a full kit or carries the limited label (so a new Pet cannot silently ship in between); C3 asserts the rating-change exclusion.

**2. The hard block on dismantling or fusing deck members stays, with a proper explanation.** Today `protectReason()` only says "In a combat deck" (Combat A). Required:
- The blocked action names **which deck or decks** hold the specimen.
- It says the specimen **must be removed or replaced first**.
- It offers a shortcut to **Review Decks** (open the deck editor on the first affected deck, e.g. `ui.go('deck', { id })`).
- **No generic confirmation dialog may destroy a specimen and leave broken deck references.** Applies to every destructive path: Inspect dismantle, Vault bulk dismantle, the duplicate-cleanup plan in the opening summary, and Fusion blockers (and any later action that consumes a specimen).
- Suggested engine support: `engine.decksContaining(id) → [{ id, name }]` (read-only), used by `protectReason` consumers so the three UI call sites and Fusion render the same message.
- A future **"Remove from all decks and continue"** workflow is allowed only if it previews every affected deck and requires explicit confirmation. Not part of Combat B.
- Tests: the message names the decks and the shortcut target; dismantle and fuse still refuse; removing the specimen from the deck lifts the block; a deck never ends up with a dangling id through any UI path (Chrome check).
- **This is B0: do it before B1.** It is a gap in Combat A against this decision, not new scope.

## 10. Known risks
1. ~~Battle LOD (§2.2) may need to degrade models noticeably~~ — retired by the C0 spike (§9.2): merged battle models cost 5× fewer draw calls with unchanged looks, at the price of a frozen pose. Remaining risk: low-end GPUs were not measured.
2. Combat balance across 8 rarity tiers will need iteration; formulas are breakdown-able on screen from day one so tuning is visible.
3. Phase Four's unverified Vault could hide regressions that surface later in the deck picker (shared `vaultq`). Hence the gate.
4. Touch/mobile layouts of existing UI are unverified; combat input is abstracted but the combat layout is desktop-first.
