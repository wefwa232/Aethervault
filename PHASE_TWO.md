# AETHERVAULT — Phase Two

Scope: more 3D collectibles, a startup/loading sequence, consistent thumbnails, performance preserved or improved.
Out of scope (deliberately untouched): trading, market, quests, events, passes, fusion, multiplayer, Creator Mode.
Save compatibility: `aethervault.save.v1` / `version: 1` is unchanged. New settings are merged in by `migrate()` defaults.

## 1. Baseline (measured before any Phase Two change)

Probe scripts: `node tools/perf.mjs <label>` (startup, loops, frame pacing, memory, navigation, 20× inspect open/close) and
`node tools/perf-models.mjs <label>` (per-model build/compile/render cost). Raw output: `docs/perf-baseline.json`,
`docs/perf-models-baseline.json`.

**What was and was not measured.** Real Chromium (system Edge, ANGLE/D3D11, hardware GPU) driven by puppeteer-core, 1600×900,
DPR 1, headless, seeded 25-specimen save. The display ran at ~144 Hz, so "frames" below are at 144 Hz refresh. Not measured:
a low-end/integrated GPU, a mobile device, true GPU time (JS-side `renderer.render` submit time only — `performance.memory` is
JS heap only, not GPU memory), audio cost. Numbers compare runs on this machine; they are not a promise about yours.

| Metric (baseline) | Off | Low | Medium | High |
|---|---|---|---|---|
| Home interactive (reload → boot overlay gone + first 3D frame) | 474 ms | 570 ms | 567 ms | 576 ms |
| DOMContentLoaded | 63 ms | 161 ms | 162 ms | 164 ms |
| Home idle, 6 s: avg / p99 / worst frame | 6.95 / 7.1 / 7.1 ms | 7.06 / 7.1 / 41.7 | 7.3 / 20.8 / 55.6 | 7.1 / 13.9 / 41.7 |
| Frames > 33 ms while idle at Home | 0 | 1 | 5 | 1 |
| rAF callbacks / s (1 is my sampler) | 289 | 426 | 411 | 423 |
| Distinct rAF loops alive | 2 | 3 | 3 | 3 |
| WebGL contexts | 0 | 1 | 1 | 1 |
| JS heap after boot | 6.5 MB | 21.5 MB | 23.8 MB | 26 MB |
| Draw calls, Home companion | – | 34 | 56 | 56 |
| Triangles, Home companion | – | – | 71.7 k | 71.7 k |
| Programs / geometries / textures (Home) | 0/–/– | 9/63/12 | 12/62/14 | 12/66/14 |
| Open Inspect, sync main-thread cost (avg / max of 20) | 0.8 / 2.2 ms | 11 / 19 ms | 12.2 / 17.2 | 13 / 19.7 |
| Geometries / textures after 20 open-close cycles | – | 73 → 73 / 21 → 21 | 72 → 72 / 23 → 23 | 72 → 72 / 23 → 23 |
| Navigation sync cost (Vault / Pets / Forge) | 51 / 21 / 25 ms | 34 / 35 / 37 | 31 / 32 / 38 | 33 / 33 / 43 |

Per-model synchronous build (Medium; geometry cache already warm from prewarm, so this is a *floor*): 5–15 ms for every model.
Shader compile (`compileAsync`, off-thread, first model to use a program combo pays): 10–425 ms (Heart 426, Leviathan 268, Pluvia 249).
Render submit: 1.7–14.7 ms. Level-4 / prismatic / swirled builds: ≤ 43 ms (Nimbit, first-time geometry), otherwise ≤ 18 ms.

### What the baseline says
Already good: one shared renderer, one WebGL context, views render only on the highest UI layer, thumbnails are cached WebP blobs,
open/close does **not** leak (geometry, texture and program counts return to the same value), the cold start is under 0.6 s.

### Remaining largest costs (ordered)
1. **Two permanent rAF loops that never sleep** — the particle/ambient loop (`fx.js`) and the stage loop (`core.js`) fire on every
   display frame forever, even in *3D Off* mode and even when nothing moves. On a 144 Hz display that is ~290–430 callbacks/s of pure
   wake-ups, which keeps the compositor and CPU awake and costs battery.
2. **Idle prewarm hitches** — after boot, `S.prewarm()` builds and renders every registered model twice (thumb + display); this is
   where the 41–56 ms frames at Home come from. With 15 more models it would roughly double. It also warms models the player may
   never own.
3. **Burst thumbnail rendering** — each thumbnail creates a full `View` (scene, 7 lights, canvas). At most 3 are in flight, so it is
   bounded, but a first Vault visit with 30 new thumbnails is 30 scene builds with no persistence across sessions (cold every launch).
4. **Compile cost of unusual materials** (heart, scale, glass stacks) — off-thread, so it shows as late-appearing models rather
   than frame drops, but it delays first paint of those models by 0.2–0.4 s.
5. **No FPS limit control**; the per-quality cap applies only to *idle* animation (interaction is uncapped, i.e. 144 fps on this display).

## 2. Existing 3D gallery review (input to the conversion list)

Reviewed from `docs/screenshots/comparison-svg-vs-3d.png` and the Vault grid screenshot.

| Strongest | Why |
|---|---|
| Mythic Vault, Forge Crate, Hatchling Egg | readable silhouette, believable metal/enamel, real mechanisms |
| Whisper Jar, Heart of Eternity, Leviathan | material variety (glass + shader ribbons, crystal, brass linkage) |
| Prismedge | refraction ghosts; clearly a different object from Rustblade |

| Weakest | Why |
|---|---|
| Nimbit / Nimbus *thumbnails* | grey, low-contrast against the dark card; SVG original is brighter and friendlier; face too small at 160 px |
| Rustblade / Prismedge thumbnails | thin diagonal subject leaves ~60 % of the tile empty |
| Heart thumbnail | pale pink, flat; loses the faceted read at small size |
| All 3D thumbs vs SVG | 3D renders ~25 % smaller in the tile, darker, desaturated — a mixed grid looks inconsistent |

Most reusable systems today: `blobSkin` (soft creatures), `paramSurface`/`lathe`/`extrude`, the trait-aware `materialFactory`, the
potential/stage motif (rings, orbiters, rays, motes), the container ritual API. Not reusable today: faces/limbs/horns are inline in
`models-pets.js`; gears are duplicated between `lib.js` and `models-machine.js`; every model re-implements its own stage additions.
Categories lacking variety: pets are all clouds; gear is all sword; relics = one crystal; no wheeled/flying machine; oddities are
all "glass + glow". Containers: egg/crate/vault only; the pack, capsule and chest are SVG.

## 3. Prioritised conversion list

Ranked by (visibility in the loop) × (variety added) × (reuse of a new shared system) ÷ cost.

| # | Item | Category | Why now | New shared system |
|---|---|---|---|---|
| 1 | Wanderer Pack | container | the first thing most players open; currently flat SVG | foil-pack builder, ritual API |
| 2 | Emberkit → Pyrodrake | pet family A | data already exists, line has no 3D, 4-legged + winged | creature kit (quadruped, tail, wings, flame) |
| 3 | Mossback → Grovewarden *(new evolution)* | pet family B | shelled/biome creature, nothing like clouds | creature kit (shell, plants) |
| 4 | Ionbow | gear | bow silhouette, animated string/energy | limb/blade/energy-edge module |
| 5 | Gravehammer | gear | heavy-head silhouette, bone + stone | handle/guard modules |
| 6 | Oracle Tablet | relic (stone/aged) | wear shader showcase, shifting runes | stone material + engraved-plate |
| 7 | Moonstone | relic (crystal) | unusual refraction / adularescence | gem/glass material set |
| 8 | Pocket Drone | machine | real rotor, gimbal, folding arms | rotor/linkage module |
| 9 | Scrap Rover | machine | wheels, welded panels, arm | wheel/track module |
| 10 | Impossible Cube | oddity | geometry-defying: shader-built interior | non-Euclidean shader |
| 11 | Missing Texture | oddity (anomaly) | missing-material checker + broken mesh | "broken asset" shader |
| 12 | Backwards Clock | oddity | reverse mechanism, time ripples | clockwork module |
| 13 | Oddity Capsule | container | second most common container | capsule builder |

Stay 2D for now (low value or no new technique): Infinite Sock, Vending Fragment, Glitched Cursor, Bone Charm, Amber Fossil,
Eclipse Scepter, Sunken Crown, Starforged Aegis, Oak Buckler, Pebblor, Glimfin, Gloomwing, Voidling, Sunmane, Sky Skiff, Chrono Racer,
Starhopper, Relic Chest (candidate for a later phase), and all variants/conditions/stages (not separate models).

(Section 4 onward is appended as the work lands.)

## 4. Completion state (recorded at start of Phase Three)

- Final validation: `docs/validation-phase2.json` / `docs/phase2-run.log` — 40/40 checks passed, including the FPS-limit, sleeping-loop, reduced-motion and new-content flows. `node tests/logic.test.js` passes (45/45). Save schema is still `version: 1`.
- Phase Two is considered complete. A last `tools/perf.mjs final` run was stopped unfinished when Phase Three began; `docs/perf-after3.json` is the latest full perf record.
- Phase Three pre-pass (rarity rings replaced by pedestal accents) is documented in `PHASE_THREE.md` §0.

## 4. Performance work and results

Changes: (1) the stage loop sleeps when nothing needs a frame (`view.dirty` is an accessor that wakes it) and paces itself on a timer between frames when capped; (2) the particle/ambient loop uses rAF only while effects are alive, otherwise a ~15 fps timer, and nothing at all with reduced motion; (3) per-view frame limiter and the **FPS limit** setting (Auto = 30 on Low / 60 on Medium and High, 30, 60, Uncapped); (4) thumbnails persist in IndexedDB (key = revision + material tier + spec), are framed from projected mesh bounds, and revoke evicted blob URLs; (5) the idle prewarm is now a short list (featured container + 3 recent models) gated on a quiet player; (6) model files load after Home (`manifest.js`); (7) shader-compile polling made safe (the old `compileAsync` could throw when a view was closed mid-compile).

Before → after, same probe, same machine (`docs/perf-baseline.json` → `docs/perf-after3.json`, taken after the loop/limiter/cache work and before the new models were added; the 3D-Off, Vault and reduced-motion figures are re-confirmed by `tools/phase2.mjs`):

| | Off | Low | Medium | High |
|---|---|---|---|---|
| rAF callbacks/s at Home (incl. my 144/s sampler) | 288 → 144 | 426 → 196 | 411 → 239 | 423 → 230 |
| Frames > 33 ms in 6 s at Home | 0 → 0 | 1 → 1 | 5 → 3 | 1 → 4 |
| Worst frame at Home | 7 → 7 ms | 42 → 63 | 56 → 42 | 42 → 69 |
| JS heap after boot | 6.5 → 4.3 MB | 21.5 → 6.6 | 23.8 → 22.7 | 26 → 9.1 |
| Inspect open, sync cost | 0.8 → 0.8 | 11 → 10 | 12.2 → 11 | 13 → 10.9 |
| Real work before Home (cold, no presentation floor) | – | 1.4 s | 1.3 s | 1.3 s |
| Startup as presented, cold / warm | 5.0 / 2.9 s on every preset |

Honest reading: idle wake-ups roughly halved or better (and are zero when nothing animates); heap figures are noisy GC snapshots; the *worst-frame* numbers did **not** improve uniformly — the first-session warm-up still produces a few isolated 28–70 ms frames, which disappear once thumbnails are cached (`tools/spike.mjs`: with warm-up off, none; second run, none). Draw calls and triangles per model are unchanged by this phase; Low vs Medium differ in shadows, material tier and the 30/60 cap (see README table). Not measured: low-end/integrated GPU, mobile, real GPU time, memory outside the JS heap.

Browser-verified (`tools/phase2.mjs`, 40/40): 30 → 30.3 fps, 60 → 60.3, Uncapped → 143.9, Auto Low 29.8 / Medium 60.3; Vault with cached thumbnails has no loop running and 0 callbacks/s; reduced motion at Home draws 0 frames in 2.5 s; 3D Off leaves only the ambient timer.

## 5. Startup sequence

Six stages, each doing the work it names: *awaken* (typefaces, storage probe) · *ledger* (load, migrate, validate; reports schema and set-aside records) · *curator* (profile, settings, daily seal, top bar) · *renderer* (WebGL detect, preset, companion model file, shader warm-up; software renderer → Low on a brand-new profile only) · *index* (totals, companion model, verifies SVG fallback art for every category) · *gateway* (mounts Home under the overlay, waits for its thumbnails and first 3D frame). Progress = weighted stage completion. Floors: cold 3.8 s, warm 1.7 s, Fast startup 0.7 s; no fixed delay beyond that. Measured: cold 5.0 s wall, warm 3.2 s, fast 2.2 s (floor + 0.9 s fade). Failure handling: renderer problems → 2D automatically; unreadable save → Retry / Start fresh with the raw text kept under a backup key; any other stage → Retry / Continue in 2D. Audio is never created before a gesture (verified). Lore line, build number, "offline · no network used" badge, reduced-motion variant and a dev-only skip (`?dev=1`) are in. The sound cues (hum, rising ticks, resolve chord) are synthesised but **I cannot listen** — mix is unverified.

## 6. Asset tiers as implemented
A (before Home): styles, fonts, save, settings, shared renderer, Home view, companion model file, containers. B (after Home, idle): remaining model files, featured container + recent models warmed, first Vault page thumbnails prefetched. C (on demand): everything built per model when first viewed; unowned models are never built.

## 7. New 3D content (13 collectibles + 2 containers)
Pets: Emberkit, Pyrodrake (Ember family), Mossback, Grovewarden (new evolution, Take Root at stage 2). Gear: Ionbow (self-drawing energy arrow), Gravehammer (vertebra haft, runed stone). Relics: Oracle Tablet (aged stone, re-arranging glyph sheets), Moonstone (shader interior, moon phase, adularescence). Machines: Pocket Drone (folding arms, rotors, gimbal eye), Scrap Rover (suspended wheels, claw arm, exhaust). Oddities: Impossible Cube (live 4D tesseract), Missing Texture (checker/untextured/missing faces, gizmo, z-fighting), Backwards Clock. Containers: Wanderer Pack (foil, torn strip, cards), Oddity Capsule (bouncing contents, twisting lid). Every one has L1–L4 stage geometry, potential motes, condition/variant response where its materials use the shared shader (the Moonstone interior, Missing Texture and tesseract beams are custom unlit shaders and take the variant colour only), and an SVG fallback. Per-model cost (Medium): sync build 10–40 ms, 30–200 draw calls (Grovewarden 201, Mossback 157 are the heaviest and could merge their shell seams later). Contact sheets: `docs/screenshots/phase2/models/`.

## 8. Known issues / not done
- First-use pattern/wear texture generation (existing system) can take up to ~400 ms on a cold model/variant combination.
- Thumbnail look: Moonstone's moon disc and the Impossible Cube's glass are subtle at 160 px.
- No trading, quests, events, fusion, multiplayer or Creator Mode were added.
- Stay 2D for now: Infinite Sock, Vending Fragment, Glitched Cursor, Bone Charm, Amber Fossil, Eclipse Scepter, Sunken Crown, Starforged Aegis, Oak Buckler, Pebblor, Glimfin, Gloomwing, Voidling, Sunmane, Sky Skiff, Chrono Racer, Starhopper, Relic Chest.
