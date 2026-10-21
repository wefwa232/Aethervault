# AETHERVAULT — Phase Three: complete and deepen the collectible foundation

> The earlier live-service proposal (quests, seasons, battle pass, events, news, collector activity) was based on an outdated direction. **None of it is implemented and it is no longer planned.** It has been removed from this document.

Phase Three has four goals:

1. Convert the remaining collectible catalogue into genuine 3D.
2. Give every collectible deterministic, category-specific statistics and rebuild upgrading around them.
3. Give (nearly) every collectible a meaningful evolution / awakening / restoration / reconstruction / manifestation / final form, with branching paths for a substantial share.
4. Correct the obstructive rarity-ring presentation (**done — section 1**).

**Out of scope (deliberately not built):** Fusion, quests, seasons, battle passes, events, trading, marketplace, multiplayer, cloud accounts, Creator Mode, combat, full economy rebalance. Stats such as Power or Damage are collectible-identity values; nothing consumes them in a fight.

**Status: complete.** Results, evidence and limitations are in section 6.

---

## 1. Pre-pass — rarity rings removed ✅ (preserved; do not redo)

**Problem.** Floating rarity/upgrade rings (per-model gimbal, armillary and ripple rings; the Forge's five stage rings; floor halos) crossed in front of complicated models (Leviathan Engine L4, Heart of Eternity L2, Ionbow).

**Change** (`js/stage3d/core.js` plus one flag line in each model file):
- Floating rings are tagged `userData.stageRing` in the model builders and **detached once, at build time** by the shared `View.setSpec`. This covers every presentation (Home, Open Hall, reveals, Vault inspect, Pets, Forge, evolution preview, gallery, thumbnails) because they all go through that one path. `opts.stageRings: true` re-enables them, reserved for a short reveal flourish (not used yet).
- **Pedestal accent by rarity tier** (`PED_ACCENT`): the inner illuminated ring is always in the rarity colour; Uncommon+ get 4 → 8 → 12 → 24 rarity-coloured index marks on the existing tick ring; Uncommon+ get a soft additive light pool on the pedestal top. Stone, brass and plate stay neutral.
- **Lighting:** the rarity rim light is softer and sits behind and low; the Legendary+ spotlight is mixed 55 % towards white and ~40 % dimmer. Key and fill stay neutral.
- **Particles** (`MOTE_SHARE`): Common none … Mythic/Transcendent 100 % of the budget; only in the back half of the stage.
- **Animation** (`View.animatePedestal`, inside the existing frame loop): Low static; Medium/High breathing; Mythic+ travelling glow along the marks; Transcendent cycles hue; Anomaly flickers red/cyan. Reduced motion and the FPS limit are respected.
- **Forge:** the five rings became four pedestal lamps (one per upgrade stage).
- Left alone on purpose: vertical halo arcs *behind* models, Forge pylon coils, the Heart's infinity ribbon (the object's own design), click-triggered shock rings on gear.

**Evidence** (Chrome 155, ANGLE/D3D11, 1600×900; `node tools/ring-smoke.mjs`, `docs/ring-smoke.json`): `docs/screenshots/phase3/leviathan-before-after.png`; sheets in `docs/screenshots/phase2/models/` (`ring-before.png`, `ring-after.png`, `ring-validate.png` covering Common/Epic/Legendary/Anomaly, a weapon, pets, an Oddity, containers). Draw calls with the old rings vs without: Leviathan L4 306 → 302, Heart L2 64 → 44, Storm Sovereign L4 144 → 142, Whisper Jar L4 110 → 104. New pedestal ≤ 2 draw calls.
**Not verified:** other browsers (Chrome is the primary target), mobile hardware, Forge lamps in their lit state.

---

## 2. Audit (start of Phase Three)

**Safe state.** Phase Two baseline: `node tests/logic.test.js` → 45 passed, 0 failed. Save key `aethervault.save.v1`, `version: 1`. No project test processes were left running (the two `node.exe` processes on the machine belong to Adobe Creative Cloud and a Codex runtime and were not touched).

**Architecture in ten bullets**
1. No build step; classic scripts attach to one `AV` namespace; Three.js r160 is vendored.
2. `data.js` = registries (40 `ITEMS`, rarities, variants, patterns…); `specimen.js` = pure generation/value/cost formulas; `engine.js` = the only place state mutates; UI calls actions and re-renders on bus topics.
3. A specimen stores traits (variant, pattern, seed, palette, condition, potential, serial, level, size, aura, quirk), `invested`, `origin`, `history`. Rarity belongs to the base item. Evolution rewrites `base`, resets `level`.
4. Upgrade = 5 universal stages (Base…Signature), cost from rarity, potential < 25 caps at stage 4. It changes value and the model's L1–L4 additions; it changes no numbers a player can read.
5. Only pets evolve (13 pets, 3 lines); evolutions live in `ITEMS[x].evolves`.
6. One shared WebGL renderer; `View` renders into 2D canvases; models register with `registerModel(key, {build(ctx)})` and receive `ctx.level`, `ctx.potentialTier`, `ctx.F` (material factory). Rarity presentation is the integrated pedestal (section 1).
7. Models load lazily through `stage3d/manifest.js`; `kit.js` provides taper tubes, metaball skins, faces, wings, flames, sparks, gears, runes and `stageFx`.
8. Thumbnails: memory LRU → IndexedDB keyed by `S.REV` + spec string (`encode`/`decode` in `core.js`) → render, so any spec field that changes the picture must be part of the key.
9. SVG art in `art.js` is the fallback for every item; Low/Off/reduced-motion/FPS-limit behaviour lives in the stage core.
10. Tests: `tests/logic.test.js` (Node, pure modules) and Puppeteer scripts in `tools/` driving Chrome.

**Performance and save constraints (hard)**
- Save: version 1 → 2 in place under the same storage key; raw v1 JSON copied to `aethervault.save.v1.backup-p3` *before* migrating; migration runs once (`migratedP3` marker), is idempotent, validated, and failure keeps the backup and loads the unmigrated save. No specimen, serial, seed, pattern, condition, variant, potential, level, base, history or `invested` is altered.
- Stats are a pure function of stored data; the same input must give the same output after reload and after re-running migration on the same backup.
- Performance budgets (Chrome, Medium): a model builds in ≤ 40 ms warm (≤ 120 ms cold shader/texture), ≤ 220 draw calls at stage 4 + final form (Leviathan, the heaviest, is the existing ceiling at ~300), idle Home ≥ 55 fps at 60 Hz cap, no live 3D in grids, thumbnail first-render ≤ 150 ms each from idle queue, preview models disposed on leave, hidden views render nothing.
- Quality ladder preserved: Off (SVG), Low, Medium, High, reduced motion, FPS limit.

---

## 3. Inventory of existing collectibles (40 base items)

"Stats now" is the same for all: no readable stats existed — only the hidden `potential`, `condition`, `level` and the value formula. "Upgrade now" is the universal 5-stage track unless noted. 3D = ✅ has a model, ⬜ SVG only.

| # | Item | Category | Rarity | 3D now | Evolution / transformation now | Phase Three work |
|---|---|---|---|---|---|---|
| 1 | Nimbit | Pet | Common | ✅ | Evolves → Nimbus | Pet stats; stage names; evolution is its major transformation |
| 2 | Nimbus | Pet | Rare | ✅ | Branch → Tempestral / Pluvia | Stats; evolution branch kept and shown in the tree |
| 3 | Tempestral | Pet | Epic | ✅ | Evolves → Storm Sovereign | Stats; evolution kept |
| 4 | Pluvia | Pet | Epic | ✅ | none | Stats; **branch**: Monsoon Choir / Stillwater Oracle |
| 5 | Storm Sovereign | Pet | Legendary | ✅ | none | Stats; final: Stormcrowned Eternal |
| 6 | Emberkit | Pet | Common | ✅ | Evolves → Pyrodrake | Stats; evolution kept |
| 7 | Pyrodrake | Pet | Rare | ✅ | none | Stats; **branch**: Cinderlord / Hearthwarden |
| 8 | Pebblor | Pet | Uncommon | ⬜ | none | **3D (A)**; stats; **branch**: Cairnkeeper / Geode Heart |
| 9 | Mossback | Pet | Uncommon | ✅ | Evolves → Grovewarden | Stats; evolution kept |
| 10 | Grovewarden | Pet | Epic | ✅ | none | Stats; final: Elder Canopy |
| 11 | Glimfin | Pet | Rare | ⬜ | none | **3D (A)**; stats; **branch**: Abyssal Lantern / Tide Strider |
| 12 | Gloomwing | Pet | Epic | ⬜ | none | **3D (A)**; stats; **branch**: Lampweaver / Nightbloom |
| 13 | Voidling | Pet | Mythic | ⬜ | none | **3D (A)**; stats; **branch**: Eventide Maw / Many-Eyed Sentinel |
| 14 | Sunmane | Pet | Legendary | ⬜ | none | **3D (A)**; stats; final: Daybreak Sovereign |
| 15 | Rustblade | Gear (weapon) | Common | ✅ | none | Stats; **branch**: Quickened Edge / Heavy Cleaver |
| 16 | Oak Buckler | Gear (shield) | Uncommon | ⬜ | none | **3D (B)**; shield stats; **branch**: Ringwood Bastion / Thornwall |
| 17 | Ionbow | Gear (weapon) | Rare | ✅ | none | Stats; **branch**: Stormstring / Railbow |
| 18 | Gravehammer | Gear (weapon) | Epic | ✅ | none | Stats; final: Sepulcher Maul |
| 19 | Prismedge | Gear (weapon) | Mythic | ✅ | none | Stats; **branch**: Seven Rumours / Refraction Blade |
| 20 | Starforged Aegis | Gear (shield) | Legendary | ⬜ | none | **3D (B)**; shield stats; final: Starfall Bulwark |
| 21 | Bone Charm | Relic | Common | ⬜ | none | **3D (C)**; stats; **branch**: Luck-Carved Totem (restored) / Hex Knuckle (corrupted) |
| 22 | Amber Fossil | Relic | Uncommon | ⬜ | none | **3D (C)**; stats; **branch**: Awakened Chrysalis / Gilded Reliquary |
| 23 | Moonstone | Relic | Rare | ✅ | none | Stats; **branch**: Full Moon / Eclipsed Moon |
| 24 | Oracle Tablet | Relic | Epic | ✅ | none | Stats; final: Unsealed Prophecy |
| 25 | Eclipse Scepter | Relic | Mythic | ⬜ | none | **3D (C)**; stats; **branch**: Dawn Scepter / Totality Scepter |
| 26 | Sunken Crown | Relic | Legendary | ⬜ | none | **3D (C)**; stats; final: Crown of the Drowned Court |
| 27 | Heart of Eternity | Relic | Transcendent | ✅ | none | Stats; final: Heart Unsealed |
| 28 | Pocket Drone | Machine | Common | ✅ | none | Stats; **branch**: Surveyor Prime / Overdrive Courier |
| 29 | Scrap Rover | Machine | Uncommon | ✅ | none | Stats; **branch**: Salvage Hauler / Rustwalker Prototype |
| 30 | Sky Skiff | Machine | Rare | ⬜ | none | **3D (D)**; stats; final: Cloud Galleon |
| 31 | Chrono Racer | Machine | Epic | ⬜ | none | **3D (D)**; stats; **branch**: Metronome Racer / Paradox Racer |
| 32 | Leviathan Engine | Machine | Mythic | ✅ | none | Stats; **branch**: Tidal Colossus / Unbound Colossus |
| 33 | Starhopper | Machine | Legendary | ⬜ | none | **3D (D)**; stats; final: Constellation Hopper |
| 34 | Infinite Sock | Oddity | Common | ⬜ | none | **3D (E)**; stats; final: Boundless Sock |
| 35 | Vending Fragment | Oddity | Uncommon | ⬜ | none | **3D (E)**; stats; **branch**: Remembered Dispenser (contained) / Breached Dispenser |
| 36 | Glitched Cursor | Oddity | Rare | ⬜ | none | **3D (E)**; stats; **branch**: Pointer Sovereign / Cursor Swarm |
| 37 | Whisper Jar | Oddity | Epic | ✅ | none | Stats; **branch**: Sealed Murmur (contained) / Unstoppered Choir (manifest) |
| 38 | Impossible Cube | Oddity | Mythic | ✅ | none | Stats; **branch**: Folded Hypercube / Unfolded Cube |
| 39 | Backwards Clock | Oddity | Legendary | ✅ | none | Stats; final: The Clock That Was |
| 40 | Missing Texture | Oddity | Anomaly | ✅ | none | Stats; final: Placeholder Reality |

**Counts at the start of Phase Three:** 40 base collectibles · 23 with 3D · 17 SVG-only (5 pets, 2 gear, 4 relics, 3 machines, 3 oddities) · 5 with an evolution · 0 with readable stats · no cosmetics category exists in the game (see 4.2).

---

## 4. Plan

### 4.1 Conversion inventory for the 17 SVG-only items

Complexity = rough mesh count / triangles at stage 0. Risk = frame-time and build-time concern. All reuse `kit.js`/`lib.js` parts (taper, skin/face/mood, wing, sparks, rune textures, lathe, extrude, chamferBox). Every model gets: SVG fallback (exists), a deliberate thumbnail camera via `frame`/`rest`, a reactive or moving detail, and reduced-motion handling (`calm`).

| Item | Cat | Art now | 3D builder | Proposed model concept | Reusable parts | Complexity | Thumbnail | Upgrade changes | Final / branches | Risk |
|---|---|---|---|---|---|---|---|---|---|---|
| Pebblor | Pet | SVG | none | Three-quarter view of a stack of four river stones forming body, head and two arm-stones; moss tufts and a sprouting leaf, two bright dot eyes; stones shift and settle | `K.skin` (stones), `K.face`, `K.mood`, `K.taper` (leaf) | 8 meshes, ~12k tris | Front-left, whole stack | Moss spreads, glowing mineral veins, floating pebbles | Cairnkeeper (tall guardian stack) / Geode Heart (crystal chest) | Low |
| Glimfin | Pet | SVG | none | Airborne lantern-fish: teardrop body, lace tail and dorsal fins, lantern bulb on a stalk, trailing bubbles; slow swim loop | `K.skin`, `K.wing` (fins), `K.face`, `K.sparks` | 10 meshes, ~16k tris | Side three-quarter, bulb visible | Longer fins, extra lanterns, ring of bubbles | Abyssal Lantern / Tide Strider | Low |
| Gloomwing | Pet | SVG | none | Plump moth: furred body, four patterned wings, feathered antennae, lamp-dust motes; wings flap slowly, eyes reflect lamp light | `K.skin`, `K.wing`×2, `K.taper`, `K.face`, `K.sparks` | 12 meshes, ~18k tris | Front, wings spread | Wing eye-spots, dream-dust trail | Lampweaver / Nightbloom | Medium (transparent wings) |
| Voidling | Pet | SVG | none | A pet-shaped hole: matte black skin, violet rim light, many eyes of different sizes that blink out of sync, small tendrils | `K.skin`, eye clusters (spheres), `K.taper`, `K.sparks` | 14 meshes, ~20k tris | Front, eyes forward | More eyes, orbiting dark motes | Eventide Maw / Many-Eyed Sentinel | Medium (unlit dark shader) |
| Sunmane | Pet | SVG | none | Lion-cub body, a mane of tapered sun-rays and flame tips, ember tail; mane breathes | `K.skin`, `K.taper` ray array, `K.face`, `K.flame`, `K.mood` | 22 meshes, ~26k tris | Front three-quarter, mane fanned | Longer mane, warm halo plate (no ring) | Daybreak Sovereign | Medium (ray count) |
| Oak Buckler | Gear | SVG | none | Round ringwood shield: plank disc, iron rim, studded boss, strap hardware, dents; tilted toward camera; click rings it | `L.lathe`, torus rim, `K.rivets`, `K.runeTex` | 9 meshes, ~9k tris | Face-on, 20° tilt | Iron bands, engraved boss, spike boss | Ringwood Bastion / Thornwall | Low |
| Starforged Aegis | Gear | SVG | none | Heater shield of star-metal with an inlaid constellation, gold border, glowing core; star shards slowly reassemble | `L.extrude`, `K.runeTex`, `K.stageFx`, shard geometry | 14 meshes, ~14k tris | Face-on, slight yaw | Constellation lines light, shard orbit | Starfall Bulwark | Low |
| Bone Charm | Relic | SVG | none | Knucklebone on a leather cord with two beads, swings like a pendulum, tiny carved notches | `L.lathe`, `L.tube` | 5 meshes, ~4k tris | Hanging, 3/4 | Carved runes, bead ring | Luck-Carved Totem / Hex Knuckle | Low |
| Amber Fossil | Relic | SVG | none | Honey-amber chunk with a winged insect suspended inside, bubbles, brass claws; light drifts through | skin/blob, `K.wing` (inside), physical material | 8 meshes, ~12k tris | 3/4, insect visible | Insect lights, claw cage | Awakened Chrysalis / Gilded Reliquary | Medium (transmission → faked with fresnel) |
| Eclipse Scepter | Relic | SVG | none | Banded staff topped with a black disc and corona in a prong cradle; shadows pool on the pedestal | `L.lathe`, `K.taper`, sprite corona | 12 meshes, ~11k tris | Tilted 25°, head forward | Corona rays, orbiting umbra | Dawn Scepter / Totality Scepter | Low |
| Sunken Crown | Relic | SVG | none | Gold crown with seven peaks, pearls, coral and barnacle growth, teal gems; water drips | `L.extrude`, `L.lathe`, spheres, `K.sparks` | 20 meshes, ~22k tris | 3/4 from above | Pearl row, kelp tassels | Crown of the Drowned Court | Medium |
| Sky Skiff | Machine | SVG | none | Wooden river skiff with a gas-bag, small ducted fan and fins; bobbing in air with cloud wisps | `L.extrude` hull, `L.lathe`, `K.gearMesh` (fan) | 14 meshes, ~15k tris | Side 3/4 | Sails, second fan, lanterns | Cloud Galleon | Low |
| Chrono Racer | Machine | SVG | none | Retro racer with clock-face dash, fins and time-echo afterimages that lag behind | `L.extrude`, lathe wheels, cloned ghost meshes (additive) | 18 meshes, ~20k tris | Front-left 3/4 | More echoes, engraved dial | Metronome Racer / Paradox Racer | Medium (ghosts) |
| Starhopper | Machine | SVG | none | White hopper ship with legs, canopy, nozzle; hops between small stars on its path | lathe hull, `K.flame`, fins | 14 meshes, ~13k tris | Low 3/4 | Extra boosters, star-stones | Constellation Hopper | Low |
| Infinite Sock | Oddity | SVG | none | Striped knit sock whose cuff opens onto a smaller sock, and so on, three deep | `K.taper` bent tubes, stripe vertex colour | 6 meshes, ~7k tris | 3/4 | Deeper nesting, thread glow | Boundless Sock | Low |
| Vending Fragment | Oddity | SVG | none | Torn front panel of a vending machine: button grid, coin slot, scrolling LED text, dangling wires | `L.chamferBox`, canvas text texture, `K.rivets` | 10 meshes, ~8k tris | Front, slight yaw | Lit rows, cracked glass | Remembered Dispenser / Breached Dispenser | Low |
| Glitched Cursor | Oddity | SVG | none | Giant arrow cursor with RGB-split ghosts, stepped pixel trail and a jitter; turns to point behind the viewer | `L.extrude` arrow, additive copies | 7 meshes, ~3k tris | Front 3/4 | More ghosts, pixel storm | Pointer Sovereign / Cursor Swarm | Low |

**Batches** (each followed by: gallery render → thumbnail + inspection silhouette check → build time → draw calls/memory → category variety → fix weak models → one targeted Chrome smoke test): A pets (5), B gear (2), C relics (4), D machines (3), E oddities (3).

### 4.2 Universal stat framework

New pure module `js/stats.js` (loads after `specimen.js`; Node-testable). Stat sets are chosen **per item archetype**, so nothing nonsensical appears:

| Family | Stats (key · label) |
|---|---|
| Weapon (sword, bow, hammer) | power · Power, speed · Speed, precision · Precision, stability · Stability, crit · Critical Power, energy · Energy Capacity, growth · Upgrade Potential |
| Shield (Oak Buckler, Aegis) | guard · Guard, resilience · Resilience, reflect · Deflection, stability · Stability, energy · Energy Capacity, growth · Upgrade Potential |
| Pet / Being | power · Power, agility · Agility, instinct · Instinct, bond · Bond, resilience · Resilience, mutation · Mutation Affinity, growth · Evolution Potential |
| Machine | output · Output, efficiency · Efficiency, durability · Durability, precision · Precision, stability · Stability, overdrive · Overdrive, growth · Upgrade Potential |
| Relic | resonance · Resonance, potency · Potency, stability · Stability, preservation · Preservation, mystery · Mystery, growth · Awakening Potential |
| Oddity | coherence · Coherence, containment · Containment, activity · Activity, distortion · Distortion, stability · Stability, growth · Unknown Potential |
| Cosmetic / Expression (defined, no items yet) | finish · Finish, animation · Animation, reactivity · Reactivity, prestige · Prestige, integrity · Rarity Integrity, growth · Enhancement Potential |

The game has no cosmetics category today; the family is defined as data so that a later phase can add cosmetic items without touching the framework. Variants (Foil, Holographic…) serve as the cosmetic layer for now and each nudges two stats.

**Generation** — `value_k = soft( identity_k + trait_k + growth_k + form_k )`
- **identity_k (≈ 60–70 %)** — `34 + 2.4·rarityTier + archetype bias` where each item lists `focus` (primary +16, secondary +9) and `weak` (−10) stats, plus ±6 deterministic noise from `hash(itemId, statKey)`. A Common with a strong focus can out-score an Epic in that stat.
- **trait_k (≈ 15–25 %)** — *condition* shifts stats by character, not just penalty (a Weathered blade: −Stability, +Critical Power; an Unstable oddity: −Coherence, +Activity); *variant* adds +6 to two fitting stats; *pattern* ±2; *size* bends power-like stats; *seed noise* ±4 from `mulberry32(spec.seed ^ hash(stat))`. *Potential* sets the growth ceiling and the `growth` stat itself.
- **growth_k** — each upgrade stage adds `(2.2 + potential/30) · w_k` where `w_k` is 1.4 for focus stats, 1.0 otherwise, 0.6 for the weak one. Predictable and always visible.
- **form_k** — a major transformation adds a controlled jump (+8…+14 to its lean stats, −3 to one trade-off stat on some branches).
- **Soft cap** — above 100 the value continues at half slope, capped at 140, so late growth is never wasted but no stat explodes.
- Displayed as whole numbers; bars are 0–100 with a marker for the potential ceiling (the value this specimen reaches at max stage).

Stats are always **computed** from stored data (`AV.stats.compute(spec)`), and a snapshot is stored on the specimen (`spec.stats`, `spec.sv = 1`) so history can show deltas. Nothing is random at load time.

### 4.3 Upgrade framework

Five stages per category (names replace the generic list in all UI):

| Category | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Weapon / shield | Forged | Tempered | Awakened | Exalted | Signature |
| Pet | Young | Mature | Ascended | Mythic | Apex Form |
| Machine | Standard | Tuned | Overclocked | Prototype | Apex Configuration |
| Relic | Dormant | Restored | Resonant | Awakened | True Form |
| Oddity | Contained | Active | Unstable | Manifested | Breached |

Each upgrade: raises stats by the curve above, adds category-specific **structural** detail to the model (not just glow; see 4.5), is logged in `spec.history` with stat deltas, and previews before confirming (current → next stage, per-stat deltas, cost, 3D preview, newly unlocked detail, transformation requirement). Costs keep the existing rarity-based formula. Favourite/locked/companion protection is unchanged (upgrades never consume other specimens; transformations never consume other specimens either).

### 4.4 Transformation framework

Data-driven in `js/progression.js`. Per item: either an existing **evolution** (pets), or `forms`: one final form, or two **branches**. A form has `id, name, kind (e.g. Awakening/Reconstruction/Restoration/Manifestation…), lean stats, tradeoff, motif, tint, blurb, behaviour, pedestal tint`. Requirements: stage ≥ Exalted/Mythic-equivalent (level 3) and an Essence + Credits cost scaled by rarity. Choosing a branch needs confirmation, compares both side by side beforehand, and **never deletes the original look**: the specimen keeps a `looks` list (base appearance, each earlier evolution base, each unlocked stage/form) and a `look` preference chosen in Inspect. Unlimited Mode may re-choose a branch or duplicate to try the other; Standard Mode may re-choose for an Essence fee (clearly explained).

Branch rule: a branch must differ in motif/geometry, material tint, animation, stats lean, archive text and pedestal accent — never only a recolour.

Coverage target: **40/40** collectibles have a major transformation (5 pets via their existing evolutions, 35 via forms); **23/40** have a meaningful choice (22 form branches + Nimbus's existing branch).

### 4.5 Rendering transformations and stages

A shared `js/stage3d/forms.js` (lazy) is applied by one hook in `View.setSpec` after a model builds: it reads the built root's bounds and adds **real geometry** from a library of motifs (crown, wings, plates, spines, orbiting fragments, vents, cage, rift/ghosts, blades, roots, crystals, tendrils, elemental particles, eyes, gear halo, time echoes), coloured by the form tint, with its own animation and low-quality/reduced-motion behaviour. Stage detail uses the same hook with category-specific structural trims (bands, fins, plates, fixtures). `encode`/`decode` and `S.REV` include `form`, so thumbnails of forms are cached separately. Models do not each need to be re-authored; the honest limitation is that form motifs are generic attachments placed by bounds — not hand-sculpted per item.

### 4.6 Save migration

`state.js`: `SAVE_VERSION = 2`, same storage key. On load, if the stored version < 2: copy the raw string to `aethervault.save.v1.backup-p3` (once, never overwritten), run `migrateP3`, validate, save. `migrateP3` is pure: for each specimen without `sv`, set `sv = 1`, `stats = compute(...)`, `form = null`, `look = 'auto'`, `looks = []`, `prog = []`; `history`, `invested`, `level`, `base`, `serial`, `seed`, `pattern`, `condition`, `variant`, `potential` are untouched. Specimens already evolved get their earlier bases added to `looks` from history text if recoverable (otherwise left empty). On any exception: backup stays, the unmigrated save loads, a recovery flag is set, nothing is overwritten.

---

## 5. Order of work and progress log — all steps done

| # | Step | Status |
|---|---|---|
| 1 | Audit, restate architecture, constraints, this document | ✅ |
| 2 | Remove persistent rarity rings | ✅ (section 1; re-checked on the final Leviathan, `leviathan-final.png`) |
| 3 | Stat framework (`js/stats.js`, `js/progress.js` archetypes) + tests | ✅ |
| 4 | Save v2 migration + backup | ✅ (Node + real Chrome v1 save) |
| 5 | Progression data (stage names, 57 forms, branches) + engine actions (`upgradePreview`, `transform`, `reform`, `setLook`, evolve carry) | ✅ |
| 6 | Forms/stage rendering hook (`js/stage3d/forms.js`) + thumbnails keyed by form and look | ✅ |
| 7–11 | 3D batches A–E (17 models) | ✅ gallery sheet + build time + draw calls per batch; one Chrome smoke test per batch |
| 12 | Forge + Inspection redesign (`forge.js`, `inspect.js`, `statsui.js`, `progress.css`) | ✅ |
| 13 | Final Chrome validation, screenshots, docs | ✅ |

## 6. Results

### Totals
- **Base collectibles: 40. With a real 3D model: 40.** SVG-only: **0** (the 17 converted this phase were Pebblor, Glimfin, Gloomwing, Voidling, Sunmane, Oak Buckler, Starforged Aegis, Bone Charm, Amber Fossil, Eclipse Scepter, Sunken Crown, Sky Skiff, Chrono Racer, Starhopper, Infinite Sock, Vending Fragment, Glitched Cursor). Every item keeps its SVG fallback, used for 3D Off, Low-end failure and context loss.
- **Stat families:** weapon (7 stats), shield (6), pet/being (7), machine (7), relic (6), oddity (6), and a defined-but-unused cosmetic family (6) for a later phase. Each item has an archetype (two focus stats, one weak stat) in `progress.js`.
- **Upgrade framework:** five stages per category with category names (Forged→Signature; Young→Apex Form; Standard→Apex Configuration; Dormant→True Form; Contained→Breached). Every stage adds ~+2–7 to every non-potential stat, adds structural geometry (brackets, a standing piece that suits the category, drifting fragments, a signature mantle) on top of each model's own details, is previewed with per-stat deltas, a cached before/after pair and a live 3D preview, and is logged with the stat changes.
- **Transformation coverage: 40/40.** 5 pets use their existing evolutions as the major transformation; 35 items have a final form or branch (57 forms: 13 single final forms, 44 in 22 branch pairs).
- **Branching: 23/40 (57 %)** — 22 form branches plus Nimbus's evolution branch (pets 7, gear 4, relics 4, machines 4, oddities 4). Every branch pair differs in motifs/geometry, tint, stat lean (and trade-off), archive text and behaviour line; a test enforces it.
- **Fusion, quests, seasons, battle pass, events, trading, marketplace, multiplayer, accounts, Creator Mode, combat: not built.**

### Save migration
- `SAVE_VERSION` 1 → 2, same storage key `aethervault.save.v1`. On load of a save below v2, the raw text is copied to `aethervault.save.v1.backup-p3` (once, never overwritten), a *copy* of the save is migrated, every specimen's identity fields/history/investment are fingerprinted before and after, stats are validated, and only then is the copy adopted and saved. On any failure the original save loads untouched (`lastLoad.p3.failed`), the backup stays, nothing is reset. Runs once (specimens carry `sv`). Imported files get the same pass.
- Added per specimen: `sv`, `stats` (snapshot), `form`, `look`, `looks`, `carry`, `prog`. Earlier species are recovered into `looks` from history text where possible.
- Verified with a real seeded v1 save in Chrome: 25 → 25 specimens, all identity fields equal, backup size equals the original, stats equal a fresh computation, second reload does not migrate again.

### Rarity pedestal
Unchanged from section 1 and re-verified with the final Leviathan Engine (an Unbound Colossus at Prototype). No floating ring crosses the model; Phase Three parts sit behind, above, beside or on the pedestal (the only vertical ring-like things are the halo motif *behind* the specimen and a crown band *above* it).

### Performance (Chrome 155, ANGLE/D3D11; `node tools/p3-perf.mjs`)
| | Medium | Low |
|---|---|---|
| 17 new models, stage 0: build (warm) | 8–15 ms (Starhopper/Gloomwing outliers ≤ 34 ms on a first-use) | 7–13 ms |
| 17 new models, stage 0: draw calls (incl. shadow pass) | 28–173 | 21–82 |
| whole catalogue, stage 4 + first form: build | 7–26 ms (Impossible Cube 52 ms) | — |
| whole catalogue, stage 4 + form: draw calls | 119–338 (Leviathan 338, Grovewarden 296, Missing Texture 252) | 107–190 for the 17 new |
- Form accessories never cast shadows (halves their calls); Chrono Racer's two time-echoes are skipped on Low; the generic `echo` form only clones models under 28 meshes (streaks otherwise).
- Forge Medium/High/Low all held the display rate (≈144 fps on this display) in the Forge with a transformed Leviathan; Vault shows **0** live 3D views (cached thumbnails only); leaving the Forge disposes its view (0 live views).
- Model files stay lazy (`manifest.js`); `forms.js` (≈ 24 KB) is the only new eager script. Nothing preloads transformations; forms are built only for a spec that has one.

### Tests performed
- `node tests/logic.test.js`: 45/45 (Phase Two contracts; one expectation updated for schema v2).
- `node tests/phase3.test.js`: 22/22 — determinism, ranges, per-stage growth, rarity overlap, conditions, identity share, coverage of transformations, upgrade/transform/re-bind/evolve rules and costs, migration (preservation, backup once, repeatability, failure path, import).
- `node tools/phase3.mjs` (Chrome): **39/39** — v1 migration, 40/40 3D models and thumbnails, Vault thumbnails, Inspect stats/compare/next/explain/branch preview, Forge upgrade cost + stats + history, pet/machine/relic/oddity transformations, confirmation, re-binding, final form, looks, locked-specimen confirmation and dismantle refusal, Low/Medium/High/Off, reduced motion, hidden-view disposal, console clean.
- `node tools/phase2.mjs` (Chrome): 40/40 (one assertion updated: schema v2).
- Per batch: gallery contact sheets (`docs/screenshots/phase3/batchA1…E1`), `p3-perf` read-out, one targeted Chrome pass.

### Screenshots (`docs/screenshots/phase3/`)
Leviathan without rings `leviathan-final.png` (+ `leviathan-before-after.png`) · weapon stats `inspect-weapon-stats.png` and upgrade `forge-weapon-upgrade-preview.png` · pet evolution branch `forge-pet-evolution-branch.png`, apex branch `forge-pet-apex-branch-preview.png` · machine `forge-machine-branch-preview.png`, `forge-machine-transformed.png`, `inspect-machine-transformed.png` · relic `forge-relic-awakening-preview.png`, `forge-relic-awakened.png` · oddity `forge-oddity-manifestation-preview.png`, `forge-oddity-manifested.png` · branch confirmation `forge-branch-confirm.png` · Forge `forge-updated.png` · Inspect `inspect-updated.png` · Vault `vault-final.png` · fallbacks `forge-3d-off.png`, `forge-low.png`.

### Known limitations (honest)
- **Form visuals are generic attachments**, placed from each model's bounds (crown, wings, plates, spines, orbit, halo, vents, cage, rift, blades, roots, crystals, tendrils, elemental effects, eyes, gears, echoes). Branches differ clearly in silhouette, geometry, tint and motion, but they are not hand-sculpted per item. Some read better than others: several forms are subtle at thumbnail size.
- The SVG fallback shows only the current species' flat art, not forms, looks or stage details.
- Thumbnails are generated on first view (the first Vault visit of ~35 specimens renders them over a second or two); later visits come from IndexedDB.
- No cosmetic items exist, so the cosmetic stat family is data only. Variants are the only cosmetic layer.
- Stats are not used by anything (no combat, no market, no score). Standard-mode economy was not rebalanced; transformation costs are `5 × rarity upgrade cost` essence + 4× that in credits; re-binding is 60 % of the essence.
- New UI layouts (stat rows, tree, Forge console) have responsive CSS for ≤ 860 px but were not pixel-checked on small viewports or touch hardware. Other browsers (Zen, Firefox, Safari) were not tested by instruction. Audio for transformations reuses the existing evolve cue.
- `tools/validate.mjs all` (the Phase One browser suite) was not re-run; the Phase Two and Phase Three browser suites and both Node suites were.
- The gallery page logs one harmless 404 for a missing resource; the game page's own console check ignores "Failed to load resource" lines as the earlier suites did.

## 7. Launch

```bash
node serve.mjs 5173      # then open http://127.0.0.1:5173 in Chrome
```
Or double-click `Play-Aethervault.bat`. Model gallery with forms: `http://127.0.0.1:5173/dev/gallery.html` (`?sheet=base:variant:cond:level:pattern:pot:form,…&size=300`).
