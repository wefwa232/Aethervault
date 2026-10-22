# AETHERVAULT — Phase Four: acquire, combine, inspect, organize

Phase Four deepens what happens around a collectible: how it is **acquired** (container identity, card packs, a Forge reel, rebuilt rituals), how it is **combined** (Fusion), how it is **inspected** (physical cards and holograms) and how it is **organized** (a much larger Vault).

**Out of scope (not built):** quests, battle passes, seasons, simulated events, trading, marketplaces, multiplayer, cloud accounts, combat, Creator Mode, interchangeable skins/wraps, Phase Five. Custom names stay the only personalization; they never replace a specimen's permanent identity.

**Status: COMPLETE (v0.5.0), checkpointed as tag `phase-four-complete` on branch `phase-four`.** Progress log: section 9. Results and evidence: section 10.

---

## 1. Audit (start of Phase Four)

**Safe state.**
- Phase Three and 3.1 are complete: `node tests/logic.test.js` 45/45, `node tests/phase3.test.js` 22/22 at the start of this phase. 40 base collectibles with 3D models, 57 forms, 23 branching items, save schema v2.
- The folder was **not** a Git repository. A checkpoint was created: commit `23c8bb2` on `main`, tag `phase-three-complete`. Phase Four work happens on branch `phase-four`.
- Save: key `aethervault.save.v1`, `version: 2`. Loading a save below v2 copies the raw text to `aethervault.save.v1.backup-p3` once, migrates a copy (`migrateP3`), fingerprints every specimen and only then adopts it; failure loads the original untouched.
- Processes: no project server, Puppeteer or test browser was running. The two `node.exe` processes on the machine belong to Adobe Creative Cloud and a Codex runtime and were left alone.
- Targeted Chrome smoke test (`node tools/p4-smoke.mjs baseline`, `docs/p4-smoke-baseline.json`): boots cleanly, no console errors, every container except the Relic Chest has a 3D model, the Vault shows 25 plates with 25 cached 3D thumbnails and **0** live 3D views.

**Architecture in ten bullets**
1. No build step: classic scripts on one `AV` namespace, vendored Three.js r160, works from `file://`.
2. `data.js` holds registries (rarities, variants, conditions, 40 `ITEMS`, 7 `CONTAINERS`); `specimen.js` generates specimens (pure); `engine.js` is the only place state mutates; the UI re-renders on bus topics.
3. `engine.open()` rolls every reward (odds, slot minimums, pity) and saves **before** any animation; `opening.js` only presents the results (ritual → reveals → summary) through a skippable `Seq` timeline.
4. A specimen stores permanent traits (variant, pattern, seed, palette, condition, potential, serial, size, aura, quirk), `origin`, `history`, `invested`, and Phase Three progression (`level`, `form`, `look(s)`, `carry`, `prog`, stat snapshot). Rarity belongs to the base item.
5. `stats.js` derives category stats deterministically from stored traits; `progress.js` holds archetypes, stage names and the 57 forms.
6. One shared WebGL renderer (`stage3d/core.js`); each `View` copies its viewport into its own canvas; only the top UI layer renders; the loop sleeps; hidden views pause; quality Low/Medium/High/Off, FPS limit, reduced motion.
7. Models register `registerModel(key, {build(ctx)})`; item models load lazily via `manifest.js`; containers are eager. `forms.js` adds stage/form geometry to any model from its bounds.
8. Thumbnails: memory LRU → IndexedDB (key = `S.REV` + material tier + `encode(spec)`) → render; grids only ever show cached images (`data-t3` placeholders hydrated by a MutationObserver).
9. `art.js` SVG art is the fallback for every item and container (3D Off, WebGL failure, context loss).
10. Tests: Node suites over the pure modules (`tests/*.test.js`) and Puppeteer scripts in `tools/` that drive the installed Chrome.

**Relic Chest diagnosis.** `D.CONTAINER.reliquary.ritual` is `'chest'`, so the stage asks for `container:chest`. Only `container:egg`, `container:pack`, `container:capsule`, `container:crate` and `container:vault` are ever registered (`models-containers*.js`, `models-crate-vault.js`). `AV.stage.container3d('chest')` therefore returns `false` and the Open hall, ritual and thumbnails fall back to `art.js`'s SVG chest. There is no lazy-loading failure, wrong key, thrown error or bad fallback condition: **the 3D builder was never written** (Phase Two's TODO lists "Relic Chest … in 3D" as a candidate that was not done). Resolution: section 4.

---

## 2. Scope and acceptance criteria

| # | Pillar | Accepted when |
|---|---|---|
| 1 | **Container identity** | Wanderer Pack awards Cards only; Hatchling ordinary pets; Starlit prestigious/high-potential pets; Capsule oddities; Forge gear + machines; Relic Chest relics; Mythic Vault a premium mixed non-card pool. Existing specimens, origins, serials, histories and pity counters are untouched; pool changes are documented. |
| 2 | **Literal Cards** | A Card category with its own sets, symbols, numbers, classes, printed artwork, card rarity/material/finish/foil/edition/alt-art, print condition, statistics, enhancement stages, premium transformations, archive text and history. Cards never grant the depicted specimen. Every card stays identifiable with bloom/particles off and in 2D. |
| 3 | **Card inspection + holograms** | Material hierarchy Common → Anomaly renders as specified; high-rarity cards project a subject hologram when untouched, retract it on drag, rise into an inspection pose, rotate fully, return after idle; manual Card/Hologram toggle; tap toggles; pinch zooms; grids use cached thumbnails; holograms load only on demand; 2D fallback. |
| 4 | **Wanderer Pack opening** | Physical tear, card stack, one-by-one reveal with anticipation, restrained rarity cues, premium reveals, Faster / Reveal all / Skip, results summary; single + multi-pack, fast, instant, reduced motion, Low quality. |
| 5 | **Forge Crate roulette** | Reward decided before the reel; reel lands exactly on it; deterministic momentum easing independent of frame rate; clicks synchronized to marker crossings (scheduled on the audio clock); near-misses only from honest reel composition; sequential / condensed / instant multi-open; skip and speed changes never reroll. |
| 6 | **Other rituals** | Hatchling (progressive cracking, rocking, light through fractures, shell separation), Starlit (constellation interaction, celestial shell, not a recolour), Oddity Capsule (unstable, authored, understandable), Relic Chest (seals, lock, dust, rising artifact), Mythic Vault (multi-lock, staged prizes, efficient batch). All skippable, all respect speed/reduced motion/quality. |
| 7 | **Relic Chest 3D** | Real 3D model with moving parts and integrated rarity accents; readable as a thumbnail; Low/Medium/High/Off/reduced motion; SVG fallback kept; within the geometry budget. |
| 8 | **Fusion** | Duplicate and compatible fusion with authored recipes + family rules, visible trait inheritance, controlled deterministic mutation that changes geometry/material/animation/stats/text/pedestal, persistent fused identity and history, exact preview = committed result, Standard (consume with confirmation, protection, backup, atomic restore) and Unlimited (free, non-destructive, reversible). |
| 9 | **Vault expansion** | Combinable filters (all listed facets), chips, advanced panel, saved searches, comparison, duplicate groups, all listed views incl. Card binder, folders/tags/notes, expanded indexed search, responsive with thousands of specimens, no live WebGL in grids. |
| 10 | **Save v3** | Versioned migration with raw backup, run once, validated, restored on failure, never resets; Node migration tests. |
| 11 | **Settings / a11y** | Roulette speed, click intensity, card holograms, auto-return, multi-open behaviour, fusion animation, binder animation; reduced motion simplifies every new sequence without losing information. |
| 12 | **Performance** | Phase Two/Three budgets preserved; before/after profile recorded (only observed numbers). |

---

## 3. Container reward pools (migration of the old Wanderer pool)

| Container | Before | After |
|---|---|---|
| Wanderer Pack | 3 items · gear, relics, machines, oddities | **5 Cards** (Cards only), 5th card Uncommon+, cards revealed lowest → highest |
| Hatchling Egg | any obtainable pet (Common → Legendary) | ordinary juveniles: Nimbit, Emberkit, Pebblor, Mossback, Glimfin (Common → Rare) |
| Starlit Egg | any obtainable pet, Rare+ | prestigious/celestial pets: Nimbus, Tempestral, Pluvia, Gloomwing, Voidling, Sunmane · Rare+ · potential ≥ 55 |
| Oddity Capsule | oddities | oddities (unchanged) |
| Forge Crate | gear + machines | gear + machines (unchanged) + roulette presentation |
| Relic Chest | relics + oddities | **relics only** |
| Mythic Vault | every non-card category | every non-card category (unchanged); Cards stay exclusive to the Wanderer Pack |

The old Wanderer contents are not lost: gear and machines are the Forge Crate's pool, relics the Relic Chest's, oddities the Capsule's. No item definition was deleted. Owned specimens keep `origin.container: 'wanderer'` and their histories. Pity counters keep their values; where a container's guarantee rarity changed (Hatchling: Legendary → Rare, because its pool now tops out at Rare) the counter carries over and simply meets the new threshold sooner.

---

## 4. Plan

Subphases if the work does not fit one session: **4A** cards, pools, Relic Chest, openings · **4B** Fusion · **4C** Vault and polish. Each subphase leaves the game runnable, with unfinished controls disabled and this file updated.

Order: Relic Chest → pools → card data + catalogue → save v3 + tests → card rendering/inspection → holograms → Wanderer cards-only → pack opening → Forge roulette → other rituals → Fusion model → Fusion UI → Vault → creative details → targeted checks per pillar → one final Chrome validation → docs → Git checkpoint.

---

## 8. Handoff (superseded)

The earlier mid-phase handoff (session stopped at the usage limit) listed six remaining items. All were completed or resolved in the closing session; see section 10. Nothing from Phase Four remains open except what section 11 lists as known limits.

## 9. Progress log

| # | Step | Status |
|---|---|---|
| 1 | Audit, architecture, this document, Git checkpoint, baseline smoke test | ✅ |
| 2 | Relic Chest 3D model + ritual (`models-containers3.js`), Starlit Egg model + constellation ritual | ✅ Chrome-checked (`relic-chest-*.png`, `starlit-*.png`) |
| 3 | Container pools redefined (`data.js`, `engine.poolItems` explicit item lists, `minPotential`, ascending pack order) | ✅ Node: 400-pack and per-container category checks |
| 4 | Card catalogue (`cards.js`: 3 sets, 64 cards), Card stat family, card stages and premium forms | ✅ Node |
| 5 | Save v3 migration (`state.js migrateP4`) + backup + fault-injection test | ✅ Node (`tests/phase4.test.js`) |
| 6 | Card art (`cardart.js`, SVG + Canvas backends, 30 scenes + 5 beings), 3D card + holograms (`models-cards.js`), Inspect print record + Card/Hologram toggle | ✅ Chrome-checked (`cards-2d-*.png`, `card3d-*.png`) |
| 7 | Wanderer Pack: card stack reveal, condensed multi-open, reload recovery notice (`opening-p4.js`) | ✅ Chrome-checked (`pack-*.png`) |
| 8 | Forge Crate roulette (time-derived motion, audio-clock clicks) | ✅ Chrome: landed index = winner index on every reel |
| 9 | Ritual polish: Hatchling kicks + light leaks, Capsule jumps + label glitch, Vault named locks | ✅ Chrome-checked |
| 10 | Settings: multi-open, reel speed, click intensity, card holograms, auto-return, fusion animation, binder animation | ✅ |
| 11 | Fusion model (`fusion.js`): families/elements, 12 recipes, 6 compatibility kinds, 7 mutations, exact `plan()`; engine `fusePreview/fuse/unfuse` with backup + atomic rollback | ✅ Node: 9 fusion tests |
| 13 | Vault query engine (`vaultq.js`), organisation actions (folders, tags, notes, saved searches) | ✅ Node: 4 vault tests (3000 specimens: index 12 ms, filter 0.4 ms/run in Node) |
| 14 | Vault UI rewrite (`screens/vault.js`) + views (`screens/vault-views.js`: binder, families, duplicates, timeline, history, sets, comparison, advanced panel) + CSS | ✅ Chrome-checked in the closing session (found and fixed 6 defects plus one hardening, §10.1) |
| 12 | Fusion rendering (mutation motifs + rank details + parent echo via `forms.js`, pedestal tint, card seal) and the Fusion Chamber screen | ✅ Chrome-checked (`fusion-*.png`) |
| 15 | Inspect → Organise (tags, note, collection membership) | ✅ Chrome-checked (`organise` scenario) |
| 16 | Performance before/after, final validation, docs, version 0.5.0, LF normalisation, checkpoint | ✅ §10 |

---

## 10. Results and evidence (closing session, 2026-10-22; Chrome 1600×900 headless, this PC, Medium unless stated)

### 10.1 Defects found by running the Vault in Chrome, and fixed
| # | Defect | Cause | Fix |
|---|---|---|---|
| 1 | Vault rarity ladder rows ~224 px tall | Roulette CSS `.rl-row` (p4.css, 224 px) collided with the Vault's own `.rl-row` | Vault class renamed `rlad-row` (`vault.js`, `vault.css`) |
| 2 | Top-bar wallet pills stacked vertically and clipped | Phase Three's `.ledger { display:grid }` (progress.css) overrode the top bar's `.ledger` (flex); present since Phase Three | Scoped the rule to `ol.ledger` |
| 3 | Binder slots blank (no card art) | `.bs-art` block collapsed to 0×0 inside a centring grid | Absolute-fill `.bs-art` / `.bs-sil`, art 100 % |
| 4 | Compare sheet thumbnails overlapped names | `.cmp-art` had no box of its own | Fixed 110 px box, name as a block |
| 5 | Duplicates tables (and Binder fast list) cut off at 375 px | Wide tables clipped by an ancestor, not scrollable | `.tscroll` horizontal scroller around both tables |
| 6 | Search placeholder clipped | Text too long for the rail | "Search the Vault…" |

**Seventh finding (test artefact + hardening).** The old reveal test forces `engine.open` to return items such as a Rustblade from the Wanderer Pack, which now holds only Cards; the card-pack reveal threw ("opening error") and left a 3D view behind, so the leak checks failed too (29 live views, 68 shader programs). Real play cannot produce that, but `opening.js` now uses the card reveal only when every result is a card, otherwise the ordinary reveal. Rerun: 22/22; live views return to 1 after 28 openings, shader programs 13 (bound < 40). The Wanderer card pack, condensed multi-open and roulette were re-checked in Chrome afterwards.

### 10.2 Vault scenario (`node tools/p4-shot.mjs vault`, 41 specimens incl. cards, duplicates, a collection, tags)
Grid 41 plates, **0 live 3D views** in every view (grid, binder, families, duplicates, timeline, history, sets, codex); chips (Pets + Common → 4 of 41), saved-search tab created and persisted, advanced panel, 3-way comparison, collection filter (4 of 41), binder page turn / fast list / alt toggle, plate sizes. Desktop horizontal overflow: 0. At 375 px: grid 0, binder 0 (pages mode), dupes scrolls inside `.tscroll`, sets 0. Console errors: none. Screenshots: `docs/screenshots/phase4/vault-*.png`.

### 10.3 Inspect → Organise (`node tools/p4-shot.mjs organise`)
Two tags typed (one normalised to `trade-shelf`), note saved on blur, collection toggled; scroll position kept across redraws; removing a tag works; searching `trade-shelf` in the Vault finds the specimen. No console errors.

### 10.4 Test results
| Suite | Result |
|---|---|
| `tests/logic.test.js` | 45/45 |
| `tests/phase3.test.js` | 22/22 |
| `tests/phase4.test.js` | 30/30 |
| `tools/phase3.mjs` (Chrome) | 39/39 — two assertions updated because they encoded Phase Three facts that Phase Four legitimately changed (schema now v3; catalogue is 104 items incl. cards, all with 3D models) |
| `tools/phase2.mjs` (Chrome) | 40/40 — two assertions updated (schema ≥ 2; the Wanderer Pack now reveals through the card stack `.cr`/`.cg`, not `.rv`) |
| `tools/validate.mjs` (Chrome), run as separate groups | **77/77**: boot/modes/protect/upgrade/evolve 35, audio/save/motion 10, buttons 1 (sweeps every visible control on 7 screens, incl. the new Vault), reveals/leaks 22, quality/responsive 9; 0 page errors. Log: `docs/validation-phase4.log` (written before the fix below, so it still shows the first `reveals,leaks` run at 11/22). |
| `reveals,leaks` first run | 11/22, then 22/22 after the fix below |

### 10.5 Performance (observed; `node tools/perf.mjs phase4 medium,low`; `docs/perf-phase4.json`, repeat `perf-phase4b.json`; Phase Three reference `docs/perf-after3.json`, same tool)
| Metric (Medium) | End of Phase Three | Phase Four |
|---|---|---|
| Startup work only, cold | 1254 ms | 1400 ms / 1428 ms (repeat) |
| Startup work only, warm | 299 ms | 370 ms / 367 ms |
| Slowest stage (`gateway`) | 195 ms | 326 ms / 344 ms |
| Home idle, avg frame | 141.1 fps (uncapped headless) | 140.7 fps / 140.9 fps |
| Home interact, p99 frame | – | 7.1 ms, 0 frames > 33 ms |
| Inspect open, avg / max frame | – | 17.4 / 30.5 ms (Medium); 14.6 / 19.4 ms (Low) |
| Inspect open/close leak check | – | geometries 106 → 107, textures 29 → 30, heap 17.1 → 14.6 MB |

Reading: startup work grew about 150 ms cold and 70 ms warm, almost entirely in the `gateway` stage (new modules and Vault index). It stays below the presentation floors (3.8 s cold, 1.7 s warm), so a player cannot see it. Not investigated further. Steady-state frame cost is unchanged. The second perf run did not record the Inspect block; only the first run's numbers are quoted. Figures are headless Chrome without vsync, so compare runs, not machines.

## 11. Known limits and honest notes
- **Machine post-reveal cooldown:** never built; the brief gave no specification and it is not one of the 12 pillars. Dropped rather than invented.
- Not verified: real touch input and phone layouts (only a 375 px overflow check), other browsers, low-end GPUs.
- Not listened to: the new sounds (all synthesised) were not auditioned; mix balance is unknown.
- Reveal timings and particle density for the highest tiers still deserve a human pass.
- Combat is out of scope here; its plan lives in `PHASE_FIVE.md` (not started).
