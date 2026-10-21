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
js/util.js              PRNG (mulberry32), weighted pick, formatting, DOM helpers, escape
js/data.js              CONTENT REGISTRIES: rarities, variants, conditions, patterns, items, evolutions, containers, store…
js/state.js             save schema, defaults (incl. settings.quality3d), load/save/migrate, event bus (AV.bus)
js/progress.js          Phase Three data: stat archetypes, category stage names, 57 transformation forms, looks (pure)
js/stats.js             Phase Three stat framework: families, deterministic compute/ceiling/delta/carry (pure)
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
js/screens/*.js         home, open, vault (+ codex), inspect, pets (+ lineage), forge (chamber), store (exchange), settings, statsui (stat/tree/looks HTML builders)
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
Topics: `wallet`, `specimens`, `settings`, `profile`, `mode`, `companion`. Future systems (quests, pass, events)
subscribe to the same bus; e.g. a quest module listens to `opened`, `dismantled`, `upgraded` without touching the
engine.

## 4. Data model (save v2; same storage key as v1)
```
save = {
  version: 2,
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
  ext:      { }                                     // namespaced storage for future modules
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

## 8. Testing
- `node tools/phase3.mjs` — 39 browser checks for Phase Three (migration of a real v1 save, 40/40 models, Inspect/Forge flows, transformations, quality modes) → `docs/validation-phase3.json`.
- `node tests/phase3.test.js` — 22 Node checks (stats, progression, transformations, migration).
- `node tools/p3-sheet.mjs` / `node tools/p3-perf.mjs` — gallery contact sheets and per-model build time / draw calls.
- `node tools/phase2.mjs` — 40 browser checks for Phase Two (results in `docs/validation-phase2.json`).
- `node tests/logic.test.js` — rule tests (generation bounds, protected dismantle, economy, evolution, save migration) and presentation data contracts (37 checks).
- `node tools/validate.mjs all` — real-browser suite: boot/onboarding, every visible control, Standard/Unlimited, favorite/lock protection, dismantle, upgrade, both evolution branches, all container rituals and eight rarity reveals, leak checks, quality levels, reduced motion, responsive layouts, save/reload, audio settings. Results are written to `docs/validation-*.json`.
