# AETHERVAULT — Architecture

## 1. Principles
- **No build step.** Classic `<script>` files attach to one global namespace `AV`, so the game works from `file://` (no ES-module CORS issues) and under any static server. The only third-party code is a vendored Three.js r160 UMD build (`vendor/three.min.js`) and bundled fonts; nothing is fetched at runtime.
- **Data, logic and presentation are separated.** Content is data; the engine mutates state through named actions; the UI only renders state and calls actions.
- **Everything the UI shows is derived from the save**, so reload == resume.

## 2. Layout
```
index.html              shell: backdrop layers, left rail + top bar + stage, overlay roots, script order
css/aether.css          design system: tokens, six surface types, buttons, controls, plates, modals, toasts
css/places.css          per-screen backdrops (CSS only) + Home
css/open.css vault.css pages.css stage.css    per-screen layout; cinematic stages (rituals, reveals, inspect, evolution)
css/progress.css        Phase Three: stat rows, transformation tree, appearance selector, ledger, Forge console
css/p4.css              Phase Four: cards, fusion, Vault views, rituals, roulette, Organise
css/mobile.css          Mobile Phases A+B: coarse-pointer sizing, phone bottom nav + More sheet, bottom sheets, phone Home/Open/Vault, Inspect/Forge/Fusion/Vault views/Deck editor (loaded last; desktop untouched)
js/util.js              PRNG (mulberry32), weighted pick, formatting, DOM helpers, escape
js/data.js              CONTENT REGISTRIES: rarities, variants, conditions, patterns, items, evolutions, containers, store…
js/state.js             save schema, defaults (incl. settings.quality3d), load/save/migrate, event bus (AV.bus)
js/progress.js          Phase Three data: stat archetypes, category stage names, 57 transformation forms, looks (pure)
js/stats.js             Phase Three stat framework: families, deterministic compute/ceiling/delta/carry (pure); Phase Four adds the card family and fusion/print terms
js/cards.js             Phase Four: card catalogue (3 sets, 64 cards), classes, finishes, foils, editions, print bonuses (pure)
js/fusion.js            Phase Four: families/elements, 12 recipes, compatibility kinds, mutations, exact plan() (pure)
js/vaultq.js            Phase Four: Vault index, combinable filters, sorts, saved-search serialisation (pure)
js/specimen.js          specimen generation, value/essence/upgrade-cost formulas (pure functions)
js/engine.js            game actions: open, buy, exchange, dismantle, upgrade, evolve, daily, xp, mode
js/art.js               procedural SVG for every item + container (kept as the 2D fallback), ONE icon family, art.render()
                        which returns a 3D-thumbnail placeholder (data-t3) when a model exists
js/audio.js             WebAudio synth
js/fx.js                Canvas particle system (restricted dust, bursts), screen shake, flash
js/stage3d/lib.js       geometry builders (lathe, extrude, tube, surface-nets blob skins), procedural textures, the shared
                        TRAIT SHADER (pattern/wear/cracks/variants) and the material factory
js/stage3d/core.js      AV.stage: shared renderer, View (drag/zoom/spring-return/idle), rarity lighting rigs, plinth + serial plate,
                        forge chamber props, thumbnail service, quality levels, render loop, stats
js/stage3d/forms.js     Phase Three: stage details + transformation motifs applied to ANY model by one hook in View.setSpec
js/stage3d/models-*.js  containers, crate+vault, pets (Nimbus line), sword, relic, machine, oddity, and (Phase Three) pets2, gear3, relic3, machine3, oddity3
js/ui.js                router, top bar, rail nav, toasts, modals, catalogue plates, minis
js/opening.js           ritual (3D or SVG) → reveals (3D stage + specimen sheet) → summary
js/opening-p4.js        Phase Four: Wanderer card-pack reveal, condensed multi-open, Forge Crate roulette, reload-recovery notice
js/cardart.js           Phase Four: card artwork (30 scenes + 5 beings; SVG and Canvas backends)
js/screens/*.js         home, open, vault (+ codex), vault-views (binder, families, duplicates, timeline, history, sets, compare, advanced filters), inspect (+ Organise), pets (+ lineage), forge (chamber), fusion (chamber), store (exchange), settings, statsui (stat/tree/looks HTML builders)
js/main.js              boot: load → stage boot → onboarding → router
tests/logic.test.js     Node harness: game rules + presentation data contracts
tools/                  dev-only Puppeteer scripts (validation, screenshots)
dev/gallery.html        model gallery / SVG-vs-3D comparison
```

## 3. Layers and data flow
```
UI event ──► AV.engine.action() ──► mutates AV.state ──► AV.state.save() ──► AV.bus.emit(topic)
                                                                              │
                          screens subscribe to topics and re-render ◄─────────┘
```
Topics: `wallet`, `specimens`, `settings`, `profile`, `mode`, `companion`, `org` (Phase Four). Future systems (quests, pass, events)
subscribe to the same bus; e.g. a quest module listens to `opened`, `dismantled`, `upgraded` without touching the
engine.

## 4. Data model (save v3; same storage key as v1)
```
save = {
  version: 3,
  profile:  { name, level, xp, title, createdAt },
  mode:     'standard' | 'unlimited',
  economy:  { priceMult, rewardMult },              // Custom Mode hook
  wallet:   { credits, gems, essence, keys },
  playCash: number,                                 // fictional cash for the mock checkout only
  specimens:{ [id]: Specimen },
  nextId:   number,
  discovered:{ [baseId]: { count, first, bestPotential } },
  variantsSeen:{ [variantId]: true },
  pity:     { [containerId]: number },
  stats:    { opened, pulls, dismantled, upgrades, evolutions, spentCredits, byRarity:{} },
  companion: specimenId | null,
  daily:    { last: 'YYYY-MM-DD', streak },
  recent:   [specimenId],                           // newest first, capped
  settings: { master, music, sfx, opening, animSpeed, reducedMotion, shake, flashing, textSize, skipRituals },
  flags:    { onboarded, seenTips },
  ext:      { },                                    // namespaced storage for future modules
  // Phase Four (v3)
  org:      { searches[], folders[{id,name,ids[]}], tags:{id:[..]}, notes:{id:text}, touched:{id:t} },
  fusions:  [ { id, kind, recipe, parents[], consumed[], result, at } ], fusionSeq: n,
  lastOpening: { container, count, ids[], at, seen } | null,
  binder:   { set, page }
}
Specimen = {
  id, base,                       // base = item id (evolution changes this; id/serial stay)
  variant, pattern, seed, palette, // pattern id, 32-bit seed, palette shift index
  condition (0..4), potential (1..100), serial (1..9999),
  level (0..4), size, aura, quirk, personality?,
  favorite, locked, nickname,
  invested: { essence, credits },  // refunded 50% on dismantle
  origin: { container, at, event:null, season:1 },
  owner: 'player',                 // trading hook
  history: [ { t, type, text } ],  // ownership/upgrade/evolve timeline
  // Phase Three (added by migration; stats are always recomputed from the traits, the snapshot is for history deltas)
  sv: 1, stats: { [key]: n },      // stat snapshot + framework version
  form: formId | null,             // major transformation (progress.js FORMS)
  look: 'auto' | 'plain' | 'form:<id>' | 'base:<id>' | 'lv:<n>',  // which unlocked appearance to display
  looks: ['form:<id>', 'base:<id>'],  // former branches / earlier species (always selectable)
  carry: { [key]: n } | null,      // growth an evolution keeps
  prog: [ { t, type: 'upgrade' | 'form' | 'evolve', from, to, cost, delta } ]  // progression ledger
}
```
Rarity is a property of the **base item**, not stored on the specimen, so evolution naturally changes it.

## 5. Content registries (data.js)
- `RARITIES[]` — id, name, color, glyph, weight rank, essence base, value base, reveal tier.
- `VARIANTS[]` — id, name, value multiplier, css filter / overlay class, base roll weight.
- `CONDITIONS` — five tiers × per-category labels, value multiplier.
- `ITEMS{}` — id, name, cat, rarity, palette, lore, `obtainable`, `evolves:[{to, level, essence, label}]`, stage metadata.
- `CONTAINERS[]` — id, name, ritual, price {cur, amt}, cat pool, `odds` (rarity weights), `slots[{min?}]`, `pity`, `variantBoost`, theme colors, `event:null`, `window:null`.
- `STORE` — cash bundles, exchanges, bundles, daily offer generator.
Adding an item = one entry in `ITEMS` + one function in `art.js`; adding a container = one entry in `CONTAINERS`.

## 6. Extension hooks (why later features won't need a rewrite)
| Future feature | Hook already present |
|---|---|
| Trading / collectors | `specimen.owner`, `history[]`, stable `id` + `serial`, `engine` actions are atomic |
| Market simulation | `Specimen.value()` is a pure function of traits; `ext.market` namespace reserved |
| Events / seasons | `container.event`, `container.window`, `origin.event/season`, `ext.events` |
| Quests / battle pass | event bus topics; `profile.xp`; `ext.quests`, `ext.pass` |
| Creator Mode | every state change goes through `AV.engine.*`; `specimen.gen(base, opts)` accepts forced traits; `economy` multipliers |
| Custom Mode | `economy.priceMult/rewardMult`, container `odds` read at open time |
| Fusion / mutation | specimen `variant`, `history`, `invested`; evolve already rewrites `base` |
| Showcases / folders | `ext.showcases`, specimen ids are stable references |

## 7. Presentation systems
- **Surfaces:** matte panel, brass specimen frame, recessed tray, paper label, luminous containment (rare+), cinematic stage. Rarity colour is used only on the item it describes (an 8-tick index mark, a plate edge, the reveal stage).
- **Backdrops:** one CSS-only layer set per screen (`body[data-screen]` sets variables): chamber wall, containment grid, catalogue drawers, vivarium glass, blueprint grid, ledger rules.
- **3D stage (`AV.stage`):** one WebGL renderer on an off-DOM canvas. Each `View` renders into a sub-rectangle and copies it into its own 2D canvas, so 3D objects live inside modals, rituals and panels with normal z-order. Only views on the highest UI layer render; hidden views pause. Models register with `registerModel(base | 'container:kind', { build(ctx) })` and return `{ root, frame, update, react, rest }`.
- **Specimen traits in 3D:** every material comes from `materialFactory(spec)`; a single `onBeforeCompile` patch adds triplanar pattern marks, scratches/patina/cracks (condition by category), variant effects (foil, holo, golden, shadow, corrupted, celestial, glitched, prismatic, inverted), instability jitter. Potential adds latent motes / a sleeping core / evolution runes; upgrade stage adds geometry per model; serial is engraved on the plinth plate and on objects where suitable.
- **Thumbnails:** `A.render()` emits `<div class="art art-t3 is-pending" data-t3="…">` containing the SVG; `AV.stage.hydrate` (MutationObserver) queues renders (≤ 7 ms/frame) and swaps in a cached WebP. If 3D is off or fails the SVG simply stays.
- **Quality & fallback:** `settings.quality3d` off/low/medium/high; WebGL context loss disables 3D and re-renders the screen with SVG art.
- **Opening:** `opening.js` runs async *sequences* (`Seq`) so every animation can be fast-forwarded without desync; rituals drive container model state (`setProgress/pulse/open`).
- **Audio:** pure synthesis; four volume buses.
- **Accessibility:** reduced-motion stops ambient animation and makes 3D render on demand; rarity is always text + index + colour; focusable 3D views support keyboard rotate/zoom.

## 7b. Phase Two systems
- **Startup (`js/boot.js`, `css/boot.css`):** six stages (awaken → ledger → curator → renderer → index → gateway), each doing the real work its text names; progress is the weighted completion of stages. Presentation floor: cold 3.8 s, warm 1.7 s, Fast startup 0.7 s, `?fastboot=1` none. Per-stage timeouts; renderer failure → 2D fallback; unreadable save → Retry / Start fresh (backup key kept). `AV.boot.report` records per-stage timings. `?dev=1` shows a Skip control.
- **Frame loops:** the stage loop and the particle/ambient loop sleep when nothing needs a frame. `view.dirty` is an accessor that wakes the loop; ambient motes run from a ~15 fps timer; frame limiter per view (`settings.fpsLimit`: auto/30/60/max).
- **Thumbnails:** memory LRU → IndexedDB (key = `S.REV` + material tier + spec; bump `S.REV` when a model changes) → render. Tight projected-bounds framing so every tile fills ~90%.
- **Lazy models:** `js/stage3d/manifest.js` maps model keys to files; `S.ensure/ensureAll` load them after Home. Containers stay eager.
- **Kit (`js/stage3d/kit.js`):** taper tubes, metaball skins, face/mood for creatures, wings, flames, sparks, gears, rune textures, `stageFx` (L1–L4 + potential).

## 7c. Phase Three systems
- **Stats (`stats.js`):** `value = soft(identity + trait + growth + form + carry)`. Identity = rarity bonus + archetype focus/weak + stable per-item noise; traits = condition character (stable stats gain from good condition, volatile stats from wear), variant (+5 to two tags), pattern, size, seed noise; growth = stage x (2.2 + potential/30) x weight; soft cap above 100, hard cap 140. Pure and deterministic.
- **Progression (`progress.js`, engine actions):** `upgradePreview`, `upgrade`, `evolve` (keeps earlier species in `looks`, carries growth), `transformOptions` / `transform` / `reform` (re-bind), `setLook`. Every change goes through `recordProg` (snapshot, delta, ledger, history).
- **Rendering forms (`forms.js`):** `View.setSpec` applies the displayed spec (`look` via `AV.progress.displaySpec`) then calls `S.forms.apply(ctx, inst)`, which measures the model's solid bounds and adds geometry: stage details by category and the form's motifs. Thumbnail cache keys include `form`; `S.REV` was bumped.
- **Migration (`state.js`):** v1 to v2 backs up the raw save to `aethervault.save.v1.backup-p3`, migrates a copy, fingerprint-checks every specimen, adopts it only if valid; on failure the original loads untouched.

## 7d. Phase Four systems
- **Save v3 (`state.js migrateP4`):** adds `org` (saved searches, folders/albums, tags, notes, touched), `fusions` (ledger) + `fusionSeq`, `lastOpening` (reload recovery), `binder`. Same rule as v2: raw copy to `aethervault.save.v1.backup-p4` once, migrate a draft, fingerprint every specimen (identity, stats and form must be unchanged), adopt only if valid, else the original loads untouched. A rolling `…backup-fusion` copy is written before each Standard-mode fusion commit.
- **Containers:** each container owns an explicit item pool (`engine.poolItems`, `minPotential`): Wanderer Pack = 5 Cards (ascending reveal), Hatchling = ordinary juveniles, Starlit = prestigious pets (potential ≥ 55), Capsule = oddities, Forge Crate = gear + machines (roulette), Relic Chest = relics only (3D model, `models-containers3.js`), Mythic Vault = every non-card category.
- **Cards (`cards.js`, `cardart.js`, `models-cards.js`):** a Card is its own category (`card` stat family), never grants the depicted specimen. Material hierarchy Common → Anomaly, finish/foil/edition/alt art, print condition; high-rarity cards project a hologram that retracts on drag, rises into an inspection pose and returns after idle (`settings.holoReturn`). Thumbnails are cached images; 2D fallback always available.
- **Fusion (`fusion.js`, `engine.fusePreview/fuse/unfuse`):** `plan()` is the single source for preview and result, so the preview is exactly what commits. Standard consumes parents (confirmation, protection, backup, atomic rollback via `state.replace`); Unlimited is free and reversible. Result carries `spec.fusion` ({id, rank, parents, mutation, tint}); stats fold it in through `fusion.statBonus`; `forms.js` renders mutation motifs and rank details.
- **Vault (`vaultq.js`, `screens/vault.js`, `screens/vault-views.js`):** the index is rebuilt only when `specimens`/`org` topics fire; filters AND across facets and OR within one; every view uses cached thumbnails or SVG (0 live 3D views in the Vault, verified). Wide tables sit in `.tscroll` scrollers so nothing is clipped at ~375 px.
- **Inspect → Organise:** tags (max 12, normalised), a 600-character note saved on blur, collection membership. All through `engine.setTags/addTag/removeTag/setNote/folder*`; none of it changes specimen identity. The sheet keeps its scroll position across redraws.
- **CSS naming rule learned the hard way:** global class names are shared by every screen. Two collisions shipped in Phase Four and were fixed (`.rl-row` roulette vs Vault rarity ladder → `.rlad-row`; Phase Three's `.ledger` list vs the top-bar wallet → `ol.ledger`). Prefix new classes by screen.

## 7e. Phase Five systems (Combat A)
- **Rule: every rule lives in the pure simulation; the screen only presents.** `js/combat/{tuning,defs,translate,deck,hand,sim}.js` have no DOM, no `Math.random`, no clock (a Node test makes `Math.random` and `Date.now` throw while a match runs, and greps the sources). `js/combat/{lod,render,input}.js` and `js/screens/{combat,deck,battle}.js` are the browser half.
- **Determinism:** fixed step 1/30 s, one seeded mulberry32 stream per match (plus one per hand), Elixir held as integer milli-points, commands queued and applied at the start of the next step. `sim.hash()` fingerprints the state for tests and future replays.
- **Stat translation:** `translate(spec)` reads `AV.stats.compute` (which already folds in level, form, variant, condition, fusion) and returns concrete attributes plus a formula string per number. Every formula is `base × (lo + (hi − lo) × stat/100)`, so a stat of 50 gives the def's base value. Combat never writes a specimen (asserted by a byte-identical test).
- **Save v4:** one new top-level `combat` block; `migrateP5` follows the Phase Three/Four pattern (raw backup, migrate a copy, specimen fingerprint including stats/form/fusion, adopt or load the original and retry). Decks hold specimen ids only; `engine.deck*` are the only writers; a specimen in a deck is protected from dismantle and fusion.
- **Battle rendering:** `lod.build` builds any model through a synthetic ctx (the same builders and materials as the showcase), strips lights/sprites/points/additive glow, then merges static meshes per material (equal-parameter materials collapsed first). `render.js` draws one scene on the shared renderer (fixed 2.5D camera, board texture, merged units, contact-shadow decals) and copies the viewport into its own 2D canvas like a stage View. Measured in `PHASE_FIVE.md` §9.2: draw calls ÷ 5.5, CPU submit ÷ 5, GPU+copy ÷ 2 for 12 units. Cost: a merged unit is a frozen pose, animated by whole-unit transforms only.
- **Disposal gotcha:** models park per-instance canvas textures (creature faces) in `ctx.tex`; any code that builds a model without a View must dispose that list (`lod.build().dispose()` does).

## 8. Testing
- `node tools/phase3.mjs` — 39 browser checks for Phase Three (migration of a real v1 save, 40/40 models, Inspect/Forge flows, transformations, quality modes) → `docs/validation-phase3.json`.
- `node tests/phase3.test.js` — 22 Node checks (stats, progression, transformations, migration).
- `node tools/p3-sheet.mjs` / `node tools/p3-perf.mjs` — gallery contact sheets and per-model build time / draw calls.
- `node tools/phase2.mjs` — 40 browser checks for Phase Two (results in `docs/validation-phase2.json`).
- `node tests/logic.test.js` — rule tests (generation bounds, protected dismantle, economy, evolution, save migration) and presentation data contracts (45 checks).
- `node tests/combat.test.js` — 49 Node checks for Combat A (data, translation, save v4 + fault injection, decks, hand, Elixir, simulation, determinism). `node tools/combat-smoke.mjs all` — 28 Chrome checks driven through the real UI; `node tools/combat-spike.mjs` — the C0 battle-LOD spike; `node tools/combat-leak.mjs` — enter/leave leak probe.
- `node tests/phase4.test.js` — 30 Node checks: card catalogue, container pools (400-pack and per-container category checks), save v3 migration + fault injection, fusion (9), Vault queries (3000 specimens).
- `node tools/p4-shot.mjs <scenario|all>` — Phase Four Chrome scenarios + screenshots (`vault`, `organise`, `fusion`, `pack`, `roulette`, `rituals`, `cards3d`, `cards2d`, `chest`, `starlit`); `node tools/p4-smoke.mjs <label>` — container/Vault smoke test.
- `node tools/validate.mjs all` — real-browser suite: boot/onboarding, every visible control, Standard/Unlimited, favorite/lock protection, dismantle, upgrade, both evolution branches, all container rituals and eight rarity reveals, leak checks, quality levels, reduced motion, responsive layouts, save/reload, audio settings. Results are written to `docs/validation-*.json`.
