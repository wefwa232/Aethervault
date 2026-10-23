# Aethervault — Project Overview (for AI hand-off)

> Snapshot of the project as of 2026-10-22 (end of Phase Four). Written so another AI can pick up the work with full context.
> Read this first; the detailed docs are listed in section 12.

---

## 1. What it is

**Aethervault — The Infinite Archive** is a private, single-player collectible simulator that runs in a browser.

- **Simulation only.** No real money, no real transactions, no network access, no accounts, no multiplayer.
- Players open containers (eggs, packs, crates, capsules, chests, vaults) to receive **specimens** (collectible items), inspect them in 3D, upgrade and evolve them, fuse duplicates, and organise them in a large Vault.
- Current version: `AV.VERSION` = **0.6.1** ("Phase Five · Combat B (in progress)", build `P5B-20261022`), defined in `js/util.js`. Phase Four is complete and checkpointed (`phase-four-complete`); Combat A and B are committed on branch `phase-five` (tags `phase-five-combat-a`, `phase-five-combat-b`; see section 10).
- Tone: a whimsical "archive" fiction. Collectibles are described as things the Archive "agreed to keep."

### Explicitly NOT in the game (and not planned unprompted)
Quests, battle passes, seasons, simulated events, trading, marketplaces, multiplayer, cloud accounts, Creator Mode, interchangeable skins/wraps. The user rejected a live-service direction on 2026-10-21. Do not propose these unless the user asks. **Combat** was requested by the user on 2026-10-22 as the next phase (Phase Five, planned in `PHASE_FIVE.md`); it has deliberately not been started: the user said to finish Phase Four and not start Phase Five yet.

---

## 2. How to run

- **Windows:** double-click `Play-Aethervault.bat` (serves the folder locally and opens the browser).
- **Any platform:** `node serve.mjs 5173`, then open `http://127.0.0.1:5173`.
- `index.html` also works straight from disk (`file://`).
- **No build step, no install step for players.** Classic `<script>` tags attach everything to one global namespace, `window.AV`.
- Browser: current Chromium, Firefox or Safari. WebGL is used for 3D; without it (or with 3D set to *Off*) the game falls back to its 2D SVG artwork.
- Third-party code is vendored: `vendor/three.min.js` (Three.js r160, MIT) and bundled woff2 fonts (SIL OFL: Barlow, Barlow Semi-Condensed, Cormorant Garamond, IBM Plex Sans, IBM Plex Mono). Nothing is fetched at runtime.
- The user tests in **Chrome** (WebGL performs much better there than in Zen Browser).

---

## 3. Core game loop

1. **Start:** a boot sequence (six real stages: awaken → ledger → curator → renderer → index → gateway), then onboarding. A "First Egg" is given to new players.
2. **Acquire:** spend a currency to open a container. Rewards are rolled by `engine.open()` (odds, slot minimums, pity counters) **and saved before any animation plays**. The opening ritual only *presents* the result.
3. **Manage:** Vault (grid/list/binder/families/duplicates/timeline/history/sets/comparison), Inspect (stats, history, rename, organise), Pets (companion + lineage), Forge (upgrade/evolve/transform/awaken), Fusion Chamber, Store (exchange/bundles/daily offer), Codex (silhouettes + hints), Evolution Atlas.
4. **Progress:** XP and levels, daily reward and streak, stats counters, titles.

### Two game modes
- **Standard:** costs apply, dismantle/fusion consume items (with confirmation, protection and backup).
- **Unlimited:** costs are free, actions are non-destructive and reversible (e.g., re-binding a transformation branch costs nothing).

---

## 4. Currencies, economy, mock store

| Currency | id | Notes |
|---|---|---|
| Credits | `credits` | Main spend currency for containers; earned via exchanges/rewards |
| Gems | `gems` | Premium-style currency |
| Essence | `essence` | Used by upgrades, evolutions, transformations; **dismantling refunds 50% of invested essence**; dismantle returns Essence |
| Keys | `keys` | Pays for the Forge Crate |

- **Play Cash** is fictional money for a mock checkout only. Nothing real is charged.
- **Store:** gem packs bought with Play Cash, exchanges, bundles, a daily offer generator.
- Starting prices: Wanderer 120 credits, Hatchling 250 credits, Capsule 90 credits, Forge Crate 2 keys, Starlit 40 gems, Relic Chest 75 gems, Mythic Vault 200 gems.
- **Economy hooks** exist in the save (`economy.priceMult`, `economy.rewardMult`) for a future Custom Mode, but there is no UI for them.
- **Pity counters** per container guarantee rarity over time.

---

## 5. Rarity

Eight tiers, stored in `js/data.js` (`RARITIES`), low → high:

| Tier | Name | Colour |
|---|---|---|
| 0 | Common | `#9fb0cc` |
| 1 | Uncommon | `#4fe08e` |
| 2 | Rare | `#4aa8ff` |
| 3 | Epic | `#b862ff` |
| 4 | Mythic | `#ff4fa8` |
| 5 | Legendary | `#ffc247` |
| 6 | Transcendent | `#6cf2ff` |
| 7 | Anomaly | `#ff3b5c` |

- Rarity is a property of the **base item**, not of the specimen, so evolving an item can change its rarity.
- Rarity is shown on the **pedestal and light** of the 3D model (floating rings were removed in Phase Three), and always as text + index mark + colour (accessibility).
- Each reveal tier has its own choreography (all eight were run to completion without errors).

---

## 6. Variants (specimen finishes)

Stored in `VARIANTS`, each with a value multiplier and a visual effect:

| Variant | Multiplier | Weight |
|---|---|---|
| Standard | ×1 | 70 |
| Foil | ×1.4 | 12 |
| Holographic | ×1.8 | 7 |
| Golden | ×2.2 | 3.5 |
| Inverted | ×1.6 | 2.5 |
| Shadow | ×1.7 | 2.2 |
| Corrupted | ×2.0 | 1.2 |
| Celestial | ×2.8 | 0.8 |
| Glitched | ×3.0 | 0.5 |
| Prismatic | ×4.0 | 0.3 |

Variants are shown in 3D by a shared trait shader (foil sheen, holo film, gold, shadow, corruption leaks, celestial night sky, glitch stutter, prismatic colour, inverted colours).

### Other specimen traits
- **Patterns** (procedural marks): Plain, Tiger Stripe, Spotted, Swirled, Starry, Marbled, Checkered, Scaled.
- **Condition** (5 tiers): affects value and stat character (stable stats gain from good condition; volatile stats from wear). Shows as scratches, patina and cracks in 3D.
- **Potential** (1–100): affects growth and upgrade caps; shows as latent motes, a sleeping core and evolution runes.
- **Serial** (1–9999): engraved on the plinth plate.
- **Size, aura** (halo: Ember, Frost, Starlight, Verdant, Void Veil), **quirk**, and a **personality** (Curious, Sleepy, Bold, Gentle, Mischievous, Proud, Shy, Playful) that gives pets their speech lines.
- **Palette shift** and **seed** (32-bit) make each copy look slightly different.

---

## 7. The item catalogue (40 base collectibles, all with 3D models)

Format: `Name (rarity)`. Items marked † are **not obtainable from containers** (they are evolution/transformation results).

**Pets (14)**
- Nimbit (Common) → Nimbus (Rare†) → Tempestral (Epic†) / Pluvia (Epic†) → Storm Sovereign (Legendary†). The Nimbus line.
- Emberkit (Common) → Pyrodrake (Rare†). The Ember line.
- Pebblor (Uncommon), Mossback (Uncommon) → Grovewarden (Epic†). The Grove line.
- Glimfin (Rare), Gloomwing (Epic), Voidling (Mythic), Sunmane (Legendary).

**Gear (6)** — Rustblade (Common), Oak Buckler (Uncommon), Ionbow (Rare), Gravehammer (Epic), Prismedge (Mythic), Starforged Aegis (Legendary).

**Relics (7)** — Bone Charm (Common), Amber Fossil (Uncommon), Moonstone (Rare), Oracle Tablet (Epic), Eclipse Scepter (Mythic), Sunken Crown (Legendary), Heart of Eternity (Transcendent).

**Machines (6)** — Pocket Drone (Common), Scrap Rover (Uncommon), Sky Skiff (Rare), Chrono Racer (Epic), Leviathan Engine (Mythic), Starhopper (Legendary).

**Oddities (7)** — Infinite Sock (Common), Vending Fragment (Uncommon), Glitched Cursor (Rare), Whisper Jar (Epic), Impossible Cube (Mythic), Backwards Clock (Legendary), Missing Texture (Anomaly).

Each item has: id, name, category, rarity, palette, lore text, `obtainable` flag, and `evolves` (target, required level, essence cost, label).

### Evolution lines
Three lines are named in the registry: **The Nimbus Line** ("Weather that learned to love"), **The Ember Line** ("A spark that decided to stay"), **The Grove Line** ("A meadow that learned to walk").

### Transformations (Phase Three)
- Every item has an evolution, a final form, or a **branch choice**: 57 forms in total; **23 of 40 items offer a real branch choice**. Branches differ in geometry, motion, tint, stats and archive text.
- Earlier looks stay selectable (`looks`); re-binding a branch costs Essence (free in Unlimited).
- Stage names depend on category: Forged → Signature (weapons), Young → Apex Form (pets), Standard → Apex Configuration (machines), Dormant → True Form (relics), Contained → Breached (oddities).

---

## 8. Containers (openings) — 7 kinds

| Container | Ritual | Price (currency) | What it gives |
|---|---|---|---|
| **Wanderer Pack** | pack (tear, card stack) | 120 credits | **5 Cards only** (last card Uncommon+); revealed lowest → highest |
| **Hatchling Egg** | egg (cracking, rocking, light leaks) | 250 credits | Ordinary juvenile pets: Nimbit, Emberkit, Pebblor, Mossback, Glimfin (Common → Rare) |
| **Starlit Egg** | starlit (constellation interaction) | 40 gems | Prestigious/celestial pets: Nimbus, Tempestral, Pluvia, Gloomwing, Voidling, Sunmane · Rare+ · potential ≥ 55 |
| **Oddity Capsule** | capsule (jumps, label glitch) | 90 credits | Oddities |
| **Forge Crate** | crate (roulette reel, hold to charge) | 2 keys | 2 items: gear + machines; second guaranteed Rare or better |
| **Relic Chest** | chest (seals, lock, dust) | 75 gems | Relics only; two prizes, second Epic or better |
| **Mythic Vault** | vault (multi-lock, staged prizes) | 200 gems | Three prizes from every non-card category (pet, gear, relic, machine, oddity); rising in stature |

- Every ritual is skippable and respects speed, reduced-motion and quality settings.
- **Forge Crate roulette:** the reward is decided *before* the reel; the reel always lands on it; motion is time-derived (frame-rate independent); clicks are scheduled on the audio clock; near-misses come only from honest reel composition. Verified: landed index = winner index on every reel.
- **Pity** and **slot minimums** are applied in `engine.open()`.

---

## 9. Cards (Phase Four)

A **Card** is a physical-style collectible printed from the Archive's card sets. Cards **never grant the depicted specimen**.

- **3 sets** in `js/cards.js`: *First Light Archive* (FLA, founding printing), *Lower Stacks Curiosa* (LSX, oddities/phenomena), *Deep Vault Ledger* (DVL, sealed wing, legendary beings). **64 cards** total.
- **Card classes**: creature, legendary being, and others; each class has a palette and archetype.
- **Card attributes**: rarity, material (Common → Anomaly hierarchy), finish, foil, edition, alt-art, print condition, set symbol, number.
- **Card art** (`js/cardart.js`): 30 scenes + 5 beings, drawn as SVG (with a Canvas backend).
- **3D cards + holograms** (`js/stage3d/models-cards.js`): high-rarity cards project a subject hologram when untouched; dragging retracts it; it rises into an inspection pose, rotates fully and returns after idle. Manual Card/Hologram toggle. Holograms load only on demand. 2D fallback always works.
- Cards have their own statistic family, enhancement stages and premium forms.

---

## 10. Phase status

### Phase Four — "acquire, combine, inspect, organise"
Branch **`phase-four`**, tagged `phase-four-complete` (baseline tag `phase-three-complete`, Phase Three checkpoint `23c8bb2` on `main`). **Complete.**

| # | Step | Status |
|---|---|---|
| 1 | Audit, architecture, PHASE_FOUR.md, Git checkpoint, baseline smoke test | ✅ |
| 2 | Relic Chest 3D model + ritual; Starlit Egg model + constellation ritual | ✅ Chrome-checked |
| 3 | Container pools redefined (explicit item lists, `minPotential`) | ✅ Node |
| 4 | Card catalogue (`cards.js`: 3 sets, 64 cards), Card stat family, stages, premium forms | ✅ Node |
| 5 | Save v3 migration (`migrateP4`) with raw backup + fault-injection test | ✅ Node |
| 6 | Card art, 3D card + holograms, Inspect print record, Card/Hologram toggle | ✅ Chrome-checked |
| 7 | Wanderer Pack: card stack reveal, condensed multi-open, reload recovery notice | ✅ Chrome-checked |
| 8 | Forge Crate roulette (time-derived motion, audio-clock clicks) | ✅ Chrome-checked |
| 9 | Ritual polish: Hatchling kicks/light leaks, Capsule jumps/glitch, Vault named locks | ✅ Chrome-checked |
| 10 | Settings: multi-open, reel speed, click intensity, card holograms, auto-return, fusion/binder animation | ✅ |
| 11 | Fusion model (`fusion.js`): families/elements, 12 recipes, 6 compatibility kinds, 7 mutations, exact `plan()`; engine `fusePreview/fuse/unfuse` with backup + atomic rollback | ✅ Node |
| 12 | Fusion rendering (mutation motifs, rank details, pedestal tint, card seal) + Fusion Chamber screen | ✅ Chrome-checked |
| 13 | Vault query engine (`vaultq.js`), organisation actions (folders, tags, notes, saved searches) | ✅ Node (3000 specimens: index 12 ms, filter 0.4 ms/run) |
| 14 | Vault UI rewrite (`screens/vault.js`) + views (`screens/vault-views.js`: binder, families, duplicates, timeline, history, sets, comparison, advanced panel) + CSS | ✅ Chrome-checked (`tools/p4-shot.mjs vault`); two CSS class collisions and a clipped table found and fixed |
| 15 | Inspect → Organise (tags, note, collections) | ✅ Chrome-checked (`tools/p4-shot.mjs organise`) |
| 16 | Version 0.5.0, docs, performance record, final validation | ✅ see PHASE_FOUR.md §10 |

**Not built / dropped:** the machine "post-reveal cooldown" (no specification existed; not invented).

### Phase Five — "the Combat phase" (IN PROGRESS: Combat A and B done, C not started)
Branch **`phase-five`** (from tag `phase-four-complete`), tags `phase-five-combat-a` and `phase-five-combat-b`. Plan, measurements, decisions and the exact handoff to Combat C are in `PHASE_FIVE.md` §9 (9.9–9.14).
- **Combat A** (foundations): battle-LOD spike, combat data (`defs.js`, `tuning.js`), stat translation (`translate.js`), save **v4** with raw backup `…backup-p5`, deck editor, the pure simulation (`sim.js`, `hand.js`: fixed 30 Hz, seeded, Elixir, 4-card hand), Training Arena.
- **Combat B** (control, abilities, support): the deck-block explanation (B0: dismantle/fuse of a deck member names the decks, says remove/replace first, offers Review Decks, on every path); move orders (5 s cooldown per Pet, walk not teleport), priority targets (soft, with defined interrupts), selection; the ability framework (`abil.js`: Q/E automatic or one queued manual use, R manual only, charge from time and damage) and the aiming framework (`aim.js`: seven aim models sharing one geometry between preview and effect, three ways to cancel); full Q/E/R kits for the six-Pet roster and a **data-derived "Limited Combat Kit" label** for the other eight; defeat presentation (recall effect, countdown chips, redeploy surcharge); all twelve support cards (`support.js`) including the Leviathan Engine with its hard rules; pooled projectiles and effects (`fx.js`). Pure modules are still free of DOM, clock and `Math.random`.
- Not yet: the opponent AI, ranked/ELO, rewards, tutorial, audio set, 3D-Off board (Combat C). Combat never changes a specimen.

### Phase Four acceptance pillars (PHASE_FOUR.md section 2)
1 Container identity · 2 Literal Cards · 3 Card inspection + holograms · 4 Wanderer Pack opening · 5 Forge Crate roulette · 6 Other rituals · 7 Relic Chest 3D · 8 Fusion · 9 Vault expansion · 10 Save v3 · 11 Settings/accessibility · 12 Performance.

### Phase Three (done) — 3D catalogue, stats, transformations
40/40 collectibles in 3D; deterministic category stats (6 families); category stage names; 57 forms; 23/40 items with branch choices; rarity on pedestal; save v2 migration. Validation: logic 45/45, phase3 Node 22/22, phase3 Chrome 39/39, phase2 Chrome 40/40.

### Phase Two (done) — startup, performance, 13 new models
Startup sequence (cold ~3.8 s, warm ~1.7 s, Fast startup ~0.7 s, `?fastboot=1` none); loop sleeping; FPS limit (Auto/30/60/Max); thumbnail cache (memory LRU → IndexedDB → render); lazy model loading; 13 new 3D models plus Wanderer Pack and Oddity Capsule 3D.

### Phase One / v0.1 (done)
Registries, save/load/migrate with corrupt-save backup, specimen generation (unit-tested), economy, procedural SVG art for all items, rituals, reveals, Vault, Inspect, Codex, Evolution Atlas, mock store, daily reward, XP/levels, settings (mode, volumes, animation speed, reduced motion, shake, flashing, text size, export/import/reset).

### Known open items / honest notes
- Not verified: mobile/touch layouts of the newer UI, other browsers, low-end GPUs.
- Audio: all sounds are synthesised (WebAudio), but audibility and mix balance have not been listened to.
- Reveal polish (timings, particle density) for legendary/transcendent/anomaly deserves human review.
- Pattern overlays can look busy on already-detailed art (Checkered especially).
- No automated test suite runs in a browser by default; Puppeteer scripts in `tools/` drive the installed Chrome.
- Candidate ideas noted in older docs: per-form pedestal accents; a cosmetics category (the stat family is defined); companion location/accessory customisation.

---

## 11. Save data

- **Storage key:** `aethervault.save.v1` in `localStorage`. Current schema: **`version: 4`** (v1→v2 `migrateP3`, v2→v3 `migrateP4`, v3→v4 `migrateP5`; raw backups `…backup-p3`, `…backup-p4`, `…backup-p5`).
- Migration rule: loading an older save copies the raw text to a backup key first (`aethervault.save.v1.backup-p3` for v1→v2), migrates a copy, fingerprints every specimen, and adopts it only if valid. Failure loads the original untouched. The game never silently resets a save.
- Corrupt saves: boot shows a recovery panel with **Retry** or **Start fresh** (the backup key is kept).
- **Export / Import / Reset** exist in Settings.

### Save shape (summary)
```
save = {
  version, profile{name, level, xp, title, createdAt}, mode: 'standard'|'unlimited',
  economy{priceMult, rewardMult}, wallet{credits, gems, essence, keys}, playCash,
  specimens{[id]: Specimen}, nextId, discovered, variantsSeen, pity, stats{...},
  companion, daily{last, streak}, recent[], settings{master, music, sfx, opening, animSpeed,
  reducedMotion, shake, flashing, textSize, skipRituals, quality3d, ...}, flags{onboarded, seenTips},
  ext{},  // namespaced storage for future modules
  combat{ v, decks[{id,name,entries:[{id}],preset,created,updated}], activeDeck, rating, division, games, wins, history[], tutorial{done,step}, settings{unlimited,autoPause}, unlocks{} }  // Phase Five (v4)
}
Specimen = {
  id, base, variant, pattern, seed, palette, condition(0..4), potential(1..100), serial(1..9999),
  level(0..4), size, aura, quirk, personality?, favorite, locked, nickname,
  invested{essence, credits}, origin{container, at, event, season}, owner, history[],
  sv, stats{}, form, look, looks[], carry, prog[]   // Phase Three/Four progression + ledger
  // Phase Four adds: card data, fusion lineage/mutations, tags, notes, folders (via engine actions)
}
```

---

## 12. Code map

```
index.html                 shell: backdrop layers, left rail + top bar + stage, overlay roots, script order
serve.mjs                  tiny static server (node serve.mjs 5173)
Play-Aethervault.bat       Windows launcher

css/aether.css             design system: tokens, six surface types, buttons, controls, modals, toasts
css/places.css             per-screen backdrops (CSS-only) + Home
css/open.css  vault.css  pages.css  stage.css   per-screen layout; cinematic stages
css/progress.css           Phase Three: stat rows, transformation tree, looks, ledger, Forge console
css/boot.css               startup sequence
css/p4.css                 Phase Four styles (cards, fusion, vault views, rituals)

js/util.js                 AV namespace, VERSION, PRNG (mulberry32), weighted pick, formatting, DOM helpers
js/data.js                 CONTENT REGISTRIES: rarities, variants, conditions, patterns, 40 ITEMS, 7 CONTAINERS, currencies, store, titles, news
js/state.js                save schema, defaults, load/save/migrate (migrateP3, migrateP4), event bus (AV.bus)
js/specimen.js             specimen generation + value/essence/upgrade-cost formulas (pure)
js/progress.js             stat archetypes, category stage names, 57 transformation forms, looks (pure)
js/stats.js                stat framework: families, deterministic compute/ceiling/delta/carry (pure)
js/cards.js                Phase Four card catalogue: 3 sets, 64 cards, classes, finishes, foils, editions
js/cardart.js              card artwork: 30 scenes + 5 beings (SVG + Canvas)
js/fusion.js               Phase Four fusion model: families/elements, 12 recipes, 6 compatibility kinds, 7 mutations
js/vaultq.js               Phase Four vault query engine: filters, sorts, indexes, saved searches
js/engine.js               THE ONLY place state mutates: open, buy, exchange, dismantle, upgrade, evolve, transform,
                           reform, setLook, daily, xp, mode, fusePreview/fuse/unfuse, setTags/setNote/folderAdd
js/art.js                  procedural SVG art for every item + container (2D fallback), art.render()
js/audio.js                WebAudio synth, four volume buses
js/fx.js                   canvas particle system, shake, flash
js/boot.js                 startup stages, timings, recovery panel
js/ui.js                   router, top bar, rail nav, toasts, modals, catalogue plates
js/opening.js              rituals → reveals → summary, skippable Seq timeline
js/opening-p4.js           Phase Four openings: Wanderer card-stack pack, condensed multi-open, roulette presentation
js/main.js                 boot: load → stage boot → onboarding → router
js/screens/home.js         Home (companion, daily, quick actions)
js/screens/open.js         Open hall (container choice)
js/screens/vault.js        Vault shell (search, chips, grid, selection)
js/screens/vault-views.js  Phase Four Vault views: binder, families, duplicates, timeline, history, sets, comparison, advanced panel
js/screens/inspect.js      Inspect: traits, stats, history, card print record, Card/Hologram toggle, rename, prev/next
js/screens/pets.js         Pets stage + lineage
js/screens/forge.js        Forge chamber: upgrade, evolve, transform, awaken
js/screens/fusion.js       Phase Four Fusion Chamber
js/screens/combat.js       Phase Five: Combat hub (active deck, how it works, upcoming modes)
js/screens/deck.js         Phase Five: deck editor (10 specimens, presets, validation, combat numbers)
js/screens/battle.js       Phase Five: Training Arena (HUD, hand, selection panel, orders, aim previews; drives sim.js)
js/screens/store.js        mock store: checkout simulation, exchange, bundles, daily offer
js/screens/settings.js     settings: mode, volumes, animation, quality, FPS, reduced motion, export/import/reset
js/screens/statsui.js      stat/tree/looks HTML builders (Phase Three)
js/screens/codex (in vault.js) silhouettes + hints, Evolution Atlas

js/stage3d/lib.js          geometry builders, procedural textures, shared TRAIT SHADER, material factory
js/stage3d/core.js         AV.stage: one shared WebGL renderer, View (drag/zoom/spring-return), lighting rigs,
                           plinths + serial plates, thumbnail service, quality levels, render loop
js/stage3d/kit.js          taper tubes, metaball skins, creature faces, wings, flames, sparks, gears, rune textures, stageFx
js/stage3d/forms.js        stage details + transformation motifs applied to ANY model by one hook in View.setSpec
js/stage3d/manifest.js     maps model keys → files; lazy loading after Home
js/combat/tuning.js        every balance number (frozen) · defs.js: per-item combat defs (14 Pets; 6 with full Q/E/R kits, 8 derived "Limited Combat Kit"; 12 support cards, all fielded)
js/combat/translate.js     specimen -> combat attributes with a formula breakdown (pure)
js/combat/deck.js          deck validation, eligibility, presets (pure) · hand.js: 4-card hand, recently-seen queue, reshuffle, recovery (pure, seeded)
js/combat/sim.js           fixed-step deterministic simulation (pure; no DOM, no Math.random, no clock): units, orders, priority, damage, projectiles, deaths, clock
js/combat/aim.js           aiming geometry shared by previews and effects: seven aim models + placement point (pure)
js/combat/abil.js          statuses, abilities (Q/E auto + queue, R manual), zones, walls, passives (pure; extends sim)
js/combat/support.js       the twelve support cards, objects, Leviathan Engine, carry watchdog, rewind history (pure; extends sim)
js/combat/lod.js           battle LOD: any model via a synthetic ctx, lights/glow stripped, static meshes merged per material
js/combat/render.js        battle scene on the shared renderer (fixed 2.5D camera, board, units, picking) · input.js: pointer/keyboard abstraction (select, order, drag-order, aim, cancel)
js/combat/fx.js            pooled projectiles, ground decals, flashes, beams, recall columns, wall slabs (render only; no per-frame allocation)
css/combat.css  battle.css hub + deck editor; Training Arena
js/stage3d/models-*.js     models: containers, crate/vault, pets (+pets2), gear (gear2/gear3), relic (relic/2/3),
                           machine (1/2/3), oddity (1/2/3), sword, creatures, and Phase Four containers3 (Relic Chest, Starlit Egg),
                           models-cards.js (3D card + holograms)

vendor/                    three.min.js (r160, MIT), bundled fonts + licences
dev/gallery.html           model gallery and SVG-vs-3D comparison (?compare=1, ?sheet=…)
tests/logic.test.js        Node: game rules, generation bounds, economy, evolution, migration (45 checks)
tests/phase3.test.js       Node: stats, progression, transformations, migration (22 checks)
tests/phase4.test.js       Node: cards, pools, migration + fault injection, fusion, vault queries (30 checks)
tests/combat.test.js       Node: combat data, translation, save v4 + fault injection, decks, hand, Elixir, simulation, B0 deck-block, orders, abilities, defeat, support cards, Leviathan (99 checks)
tools/                     dev-only Puppeteer scripts (validation, screenshots, perf, smoke) — not needed to play
docs/                      screenshots (before/after/phase2/phase3/phase4), JSON validation + perf reports, legacy v0.1 CSS
music/background music/    4 royalty-free MP3 ambient tracks (currently not wired to a real music theme)
```

---

## 13. Repository state (at snapshot)

- Git repo, branch **`phase-five`** (main branch **`main`**), branched from `phase-four-complete`. Combat A is committed on it (see `PHASE_FIVE.md` §9 for hashes and the tag). `phase-four` is untouched.
- Line endings are normalised to LF (a `.gitattributes` enforces it).
- Background-music files exist under `music/` but the game still uses its generative ambient pad (the real-music theme is deferred).

---

## 14. Testing

```bash
node tests/logic.test.js          # 45 rule/contract checks (Node, no deps)
node tests/phase3.test.js         # 22 checks: stats, progression, transformations, migration
node tests/phase4.test.js         # 30 checks: cards, pools, save v3 migration, fusion, vault queries
node tests/combat.test.js         # 99 checks: Phase Five Combat A + B (data, translation, save v4, decks, hand, Elixir, simulation, deck-block, orders, abilities, support, Leviathan)
cd tools && npm install && cd ..  # one-time, dev only (puppeteer-core, uses installed Chrome/Edge)
node tools/phase2.mjs             # Phase Two browser checks (40)
node tools/phase3.mjs             # Phase Three browser checks (39), migration of a real v1 save
node tools/validate.mjs all       # full browser suite: boot, buttons, modes, protection, upgrade, evolve, reveals, leaks, quality, motion, responsive, save, audio
node tools/p4-smoke.mjs baseline  # Phase Four targeted Chrome smoke test
node tools/combat-smoke.mjs all   # Phase Five Chrome smoke via the real UI: deck editor, Training Arena, B0 deck-block paths, Combat B battle (scenarios: deck, arena, b0, b)
node tools/combat-spike.mjs medium # C0 battle-LOD spike (12 units; calls/tris/frame cost per approach) -> docs/p5-spike-*.json
node tools/p4-shot.mjs all        # Phase Four scenarios + screenshots (vault, organise, fusion, pack, roulette, rituals, cards3d, cards2d, chest, starlit)
node tools/shoot-after.mjs        # regenerate docs/screenshots/after
```

Last runs (end of Combat B): Node logic 45/45, phase3 22/22, phase4 30/30, combat 99/99; Chrome combat-smoke 68/68; validate groups 35+10+1+22+9 (all pass), phase3 39/39, phase2 40/40 (details: PHASE_FIVE.md §9). Phase Four's own record is in PHASE_FOUR.md §10.

### Conventions for working on this code
- Everything that changes state goes through `AV.engine.*`; the UI only renders state and calls actions.
- Pure modules (`specimen`, `progress`, `stats`, `cards`, `fusion`, `vaultq`) should stay free of DOM access so Node tests can cover them.
- Adding an item = one entry in `ITEMS` + one SVG function in `art.js` + a 3D model registered via `registerModel` and listed in `manifest.js`.
- Adding a container = one entry in `CONTAINERS` (+ a ritual if new).
- Bump `S.REV` in `state.js` when a model changes (thumbnail cache key).
- Save changes need a versioned migration with a raw-text backup, validation, and restore-on-failure. Never reset a save.
- Test in Chrome, one browser harness at a time, and stop it afterwards.
- Design: matte archive surfaces, brass only for prestige, one icon family, rarity colour only on the item it describes. See `VISUAL_DIRECTION.md`.

---

## 15. Documentation map

| File | Purpose |
|---|---|
| `README.md` | Player-facing summary, launch, quality table, controls, project layout, tests |
| `ARCHITECTURE.md` | Principles, layout, data model, registries, extension hooks, presentation systems, Phase Two/Three systems |
| `PROJECT_PLAN.md` | Original plan |
| `PHASE_TWO.md` | Phase Two: startup, loop sleeping, thumbnails, lazy models, new models |
| `PHASE_THREE.md` | Phase Three: 3D catalogue, stats, transformations, validation |
| `PHASE_FOUR.md` | Phase Four: scope, audit, acceptance pillars, pools, progress log, handoff plan |
| `VISUAL_DIRECTION.md` | Visual identity rules |
| `PHASE_FIVE.md` | Combat Phase: plan, Combat A progress log with measurements, decisions, and the exact handoff to Combat B |
| `TODO.md` | Status checklist and deferred items |
| **`PROJECT_OVERVIEW.md`** | **This file: single-document snapshot of the whole project** |
</content>

## Mobile Phase (in progress)
Mobile A is done: `css/mobile.css` adds a coarse-pointer sizing layer, a phone bottom bar (Home · Open · Vault · Combat · More) with a More bottom sheet, phone Home/Open Hall compositions and a Vault toolbar with a filter bottom sheet. Mobile B (done) adds phone layouts for Inspect + Organise (full-bleed sheet, floating close, docked Forge/Fuse/Favorite/Lock actions), Forge and Fusion (chamber first, specimen picker as a bottom sheet), the Binder/Families/Duplicates/Timeline/History/Sets/Compare views and the Deck editor (compact slots, Add/Swap picker sheet, status dock). Mobile C (combat touch, settings, performance presets) remains; see `MOBILE_PHASE.md`.
