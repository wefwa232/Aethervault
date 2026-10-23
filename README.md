# Aethervault — The Infinite Archive (v0.6.1, Phase Five · Combat B complete)

A private, single-player collectible simulator. **Simulation only — no real money, no real transactions, no accounts.** The game runs entirely in your browser and uses no network connection.

## Status

- **Version:** 0.6.1 (Phase Five, build `P5B`). Tags: `phase-four-complete`, `phase-five-combat-a`, `phase-five-combat-b`.
- **Development status:** single-player, not yet released. Phases Two to Four are complete; Phase Five Combat A and Combat B are complete. **Combat C is not started.**
- **Main features:** a 3D collection vault with 40 collectibles, a Pets and Forge loop, Wanderer Pack and Relic Chest openings, Literal Cards, a Fusion Chamber, deck building and a Training Arena with commandable Pets and abilities.
- **Recommended browser:** Google Chrome. Other Chromium browsers, Firefox and Safari are supported but less tested.
- **Known limitations:** Combat is a Training Arena only (no opponent AI, ranking, rewards or tutorial yet). Mobile Phases A and B (phone navigation, Home, Open Hall, Vault and its views, Inspect/Organise, Forge, Fusion, the deck editor) are done on the web/PWA ([`MOBILE_PHASE.md`](MOBILE_PHASE.md)); **combat touch controls, Settings and performance presets are not yet adapted** (Mobile C), so mobile is not complete. A machine post-reveal cooldown was not built. Combat audio is not yet written.
- **Save-data warning:** your save lives in this browser's local storage for this address. Clearing site data, using a private window, or switching browsers or computers will lose it. Schema migrations keep raw backups under `…backup-p3`, `…backup-p4`, `…backup-p5` and `…backup-fusion` keys; do not delete them while testing.
- **Development documentation:** [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`TODO.md`](TODO.md), the phase logs ([`PHASE_TWO.md`](PHASE_TWO.md), [`PHASE_THREE.md`](PHASE_THREE.md), [`PHASE_FOUR.md`](PHASE_FOUR.md), [`PHASE_FIVE.md`](PHASE_FIVE.md)), and [`GITHUB_PUBLISHING.md`](GITHUB_PUBLISHING.md) for repository and publishing notes.
- **License:** none. All rights are reserved by default; the repository is public on GitHub and no license is granted.

## Launch

**Windows:** double-click `Play-Aethervault.bat` (serves the folder locally and opens your browser).

**Any platform:**

```bash
node serve.mjs 5173      # then open http://127.0.0.1:5173
```

`index.html` also works straight from disk (`file://`): the game uses classic scripts, bundled fonts and a vendored Three.js UMD build, so there is no build step and no install step.

Requirements: Google Chrome is recommended; a current Chromium, Firefox or Safari also works. WebGL is used for the 3D presentation; without it (or with 3D set to *Off*) the game falls back to its original 2D artwork.

## What's new in v0.6.1 (Phase Five, Combat B — complete) — details in [`PHASE_FIVE.md`](PHASE_FIVE.md)

Combat is being built in three steps; Combat A (foundations) and Combat B (control, abilities, support) are done. It is still a **Training Arena**, not the finished game: Combat C (opponent, ranking, rewards, tutorial) is not started.

**Combat B adds:**
- **Commands.** Click a Pet to select it. Right-click the ground to walk it (5 s between orders per Pet) or an enemy to make it a *priority target*; drag a Pet to the ground, or use the Move / Target / Stop buttons (M, T, S). Tab cycles Pets.
- **Abilities (Q, E, R).** Six Pets have full kits (Storm Sovereign, Pyrodrake, Mossback, Grovewarden, Glimfin, Voidling). Q and E fire by themselves when their rule says so, or you cast them (one manual use can be queued); R is always manual and charges with time and damage. Every ability shows a live preview of exactly the area it will hit and cancels three ways: Esc, right-click, or the Cancel button. Reshuffle moved to **X**.
- **Limited Combat Kit.** The other eight Pets keep their stats, basic attack, orders and targeting (two have a simple passive) and are labelled so in the deck editor, hand, numbers panel and hub. They are fully usable in training.
- **Support cards** — weapons, shields, machines, relics and oddities — are now playable from the hand: Gravehammer, Ionbow, Prismedge, Oak Buckler, Starforged Aegis, Leviathan Engine, Scrap Rover, Pocket Drone, Moonstone, Heart of Eternity, Backwards Clock, Glitched Cursor.
- **Defeat.** A fallen Pet is recalled in a column of light, shows a 12–20 s countdown chip, and costs +1 Elixir more per redeploy (max +3).
- **Safer dismantling.** A specimen held by a combat deck cannot be dismantled or fused; the message now names the deck(s), says to remove or replace it first, and offers **Review Decks**.

**Combat A (still true):**

- **Combat** in the left rail: your active deck, how a battle works, and the modes that are still to come (shown but disabled).
- **Deck editor:** exactly 10 specimens, any mixture; several decks; a recommended starter and two other presets built from your collection; the combat numbers of every specimen with the formula behind each (Resilience → HP, Power → damage, Agility → speed, Instinct → attack tempo, Bond → cooldowns, Mutation → critical chance). Specimens that are missing or not combat-ready are flagged, never silently dropped. A specimen in a deck cannot be dismantled or fused until it is taken out.
- **Training Arena:** a compact 3D board (river, one bridge, cover, two Archive Cores) on the same renderer as the rest of the game. A hand of 4 from your deck; every deployment deals a whole new hand; Elixir (start 5, max 10, faster from 1:15 and in the Final Surge); pick a card (click, keys 1–4, or drag it) and place it on your half; Esc or right-click cancels; Reshuffle costs 1 Elixir. Your Pet walks the bridge, picks a target and attacks a sparring post or the enemy Core. A defeated Pet recovers 12–20 s and costs +1 Elixir more each redeploy.
- All 14 pets and all 12 support cards can fight. The opponent AI, ranked play, rewards, the tutorial and the audio set come in Combat C.
- Combat never changes a specimen. Saves from v0.1–v0.5 migrate in place to **schema v4** (raw backup `…backup-p5`; a failed migration loads your original save and retries next time).
- Combat needs the 3D renderer (Low, Medium or High). A 2D board is planned for Combat C.

## What's new in v0.5 (Phase Four) — details in [`PHASE_FOUR.md`](PHASE_FOUR.md)

- **Container identity:** the Wanderer Pack now holds 5 **Cards** only; Hatchling Eggs hatch ordinary juvenile pets, Starlit Eggs prestigious ones, the Forge Crate gear and machines, the Relic Chest relics only (now a real 3D chest), the Mythic Vault every non-card category. Nothing you own changed.
- **Literal Cards:** 3 sets, 64 printed cards with materials Common → Anomaly, finish, foil, edition, alternate art and print condition. Cards never grant the specimen they depict. High-rarity cards project a hologram you can toggle, rotate and zoom.
- **Openings:** a tearable Wanderer Pack with a one-by-one card reveal, a Forge Crate roulette (the reward is decided first; the reel lands exactly on it), and reworked Hatchling, Starlit, Capsule, Relic Chest and Vault rituals. All skippable; multi-open can be condensed.
- **Fusion Chamber:** combine duplicates or compatible specimens with authored recipes, visible inheritance and a controlled mutation. The preview is exactly the result. Standard mode consumes the parents after confirmation (with a backup and automatic rollback); Unlimited is free and reversible.
- **A much larger Vault:** combinable filters with removable chips, advanced panel, saved searches as archive tabs, comparison (2–4 specimens), collections, tags and notes (also editable from Inspect → Organise), plus Binder, Families, Duplicates, Timeline, History, Sets and Codex views. Grids only ever show cached thumbnails.
- **Settings:** reel speed, click intensity, multi-open style, card holograms and auto-return, fusion and binder animation.
- Saves from v0.1–v0.4 migrate in place to schema v3 (raw backups `…backup-p3`, `…backup-p4`; a fusion backup is written before each Standard-mode fusion).
- Not in this version: quests, seasons, battle passes, events, trading, marketplace, multiplayer, accounts, Creator Mode, combat.

## What's new in v0.4 (Phase Three) — details in [`PHASE_THREE.md`](PHASE_THREE.md)

- **All 40 collectibles are real 3D models** (17 new: Pebblor, Glimfin, Gloomwing, Voidling, Sunmane, Oak Buckler, Starforged Aegis, Bone Charm, Amber Fossil, Eclipse Scepter, Sunken Crown, Sky Skiff, Chrono Racer, Starhopper, Infinite Sock, Vending Fragment, Glitched Cursor). SVG art remains as the fallback.
- **Category-specific statistics** for every specimen (weapon, shield, pet, machine, relic, oddity families), derived deterministically from its traits: identity, condition, variant, potential, upgrade stage and transformation. Inspect shows them with comparison, a next-upgrade preview, a potential-ceiling tick and an explanation of what feeds each number.
- **Upgrading redesigned:** category stage names (Forged → Signature, Young → Apex Form, Standard → Apex Configuration, Dormant → True Form, Contained → Breached), per-stat previews, a before/after pair and a live 3D preview, structural model additions per stage, and a ledger of every change.
- **Transformations for the whole catalogue:** every item has an evolution, a final form or a branch choice (57 forms; 23 of 40 items offer a real choice). Branches differ in geometry, motion, tint, stats and archive text. Earlier looks stay selectable; re-binding a branch costs Essence (free in Unlimited Mode).
- **Rarity** is shown by the pedestal and light (no floating rings) — unchanged from the Phase Three pre-pass.
- Saves from v0.1–v0.3 migrate in place (a backup of the raw save is written first).
- Not in this version: fusion, quests, seasons, battle passes, events, trading, marketplace, multiplayer, accounts, Creator Mode, combat.

## What's new in v0.3 (Phase Two) — details in [`PHASE_TWO.md`](PHASE_TWO.md)

- A local-only startup sequence (six real initialisation stages, ~5 s cold / ~3 s warm, optional *Fast startup*, reduced-motion and 2D fallbacks, recovery panel for an unreadable save). No network is used.
- 13 new 3D collectibles (Emberkit, Pyrodrake, Mossback, Grovewarden, Ionbow, Gravehammer, Oracle Tablet, Moonstone, Pocket Drone, Scrap Rover, Impossible Cube, Missing Texture, Backwards Clock) plus 3D Wanderer Pack and Oddity Capsule.
- Performance: loops that sleep when nothing moves, an FPS limit (Auto / 30 / 60 / Uncapped), persistent thumbnail cache, consistent thumbnail framing, model files loaded after Home.
- Saves from v0.1/v0.2 load unchanged.

## What's in v0.2

- A new interface identity (matte archive surfaces, brass used for prestige only, bundled type roles, one icon family, location-specific backdrops, left rail navigation). See [`VISUAL_DIRECTION.md`](VISUAL_DIRECTION.md).
- A reusable 3D stage inside the existing 2D menus (one shared renderer, drag/zoom/spring-return, rarity-sensitive lighting, trait shader, thumbnails, quality levels, graceful fallback).
- A 3D vertical slice: **Hatchling Egg, Forge Crate, Mythic Vault; the Nimbus line (Nimbit, Nimbus, Tempestral, Pluvia, Storm Sovereign); Rustblade + Prismedge; Heart of Eternity; Leviathan Engine; Whisper Jar.** Every other collectible keeps its SVG art.

## 3D quality (Settings → 3D presentation)

| Level | Render scale | Shadows | Materials | Frame cap |
|---|---|---|---|---|
| Off | — | — | pure 2D artwork | — |
| Low | ≤ 1× | none (contact shadow only) | standard | 30 fps |
| Medium (default) | ≤ 1.25× | 1024 PCF | clearcoat / iridescence | 60 fps |
| High | ≤ 2× | 2048 PCF | clearcoat / iridescence | 60 fps |

Only the active centerpiece (Home companion, Open-hall container, Pets stage, Forge chamber, inspection, ritual/reveal) renders in real time. Vault, Codex, lists and the atlas use cached thumbnails rendered by the same renderer. *Reduced motion* stops all ambient animation: 3D draws only while you interact.

## Controls

Drag a 3D object to turn it (it springs back to its presentation angle); scroll or pinch to zoom in inspection and the Forge; arrow keys and `+`/`−` work when a 3D view has focus. Pets look at the cursor; click one to nudge it.

## Project layout

```
index.html              shell
css/aether.css          design system: tokens, six surface types, buttons, controls, plates, modals
css/places.css          backdrops per screen, Home
css/open.css  vault.css  pages.css  stage.css     per-screen layout; cinematic stages (rituals, reveals, inspection, evolution)
js/stage3d/lib.js       geometry builders, surface-nets cloud skins, procedural textures, shared trait shader
js/stage3d/core.js      renderer, views, rigs/plinths, thumbnails, quality, loop
js/stage3d/models-*.js  the vertical-slice models
js/screens/*.js         home, open, vault, pets, forge, store, settings, inspect, combat (hub), deck (editor), battle (Training Arena)
js/combat/*.js          Phase Five: tuning, defs, translate, deck, hand, aim, sim, abil, support (pure, Node-tested) · lod, render, fx, input (browser)
js/opening.js           rituals → reveals → summary
vendor/                 three.min.js (r160, MIT) and fonts (SIL OFL)
dev/gallery.html        model gallery and SVG-vs-3D comparison (?compare=1, ?sheet=…)
tools/                  dev-only Puppeteer scripts (screenshots, validation) — not needed to play
tests/logic.test.js     game-rule tests (Node, no browser)
docs/                   screenshots (before/after/validation), validation reports, legacy v0.1 CSS
```

## Tests

```bash
node tests/logic.test.js                      # 45 rule/contract checks, no dependencies
node tests/phase3.test.js                     # 22 checks: stats, progression, transformations, migration
node tests/phase4.test.js                     # 30 checks: cards, pools, save v3 migration, fusion, Vault queries
node tests/combat.test.js                     # 99 checks: combat data, translation, save v4 + fault injection, decks, hand, Elixir, sim, deck-block, orders, abilities, support cards, Leviathan Engine
cd tools && npm install && cd ..              # one-time, dev only (puppeteer-core; uses your installed Edge/Chrome)
node tools/phase3.mjs                         # Phase Three browser checks (39)
node tools/combat-smoke.mjs all               # Phase Five browser smoke through the real UI: deck editor, Training Arena, deck-block paths, Combat B battle
node tools/combat-spike.mjs medium            # battle-LOD spike: 12 units, per-approach draw calls / triangles / frame cost
node tools/p4-shot.mjs all                    # Phase Four browser scenarios + screenshots (vault, organise, fusion, pack, roulette, rituals, cards…)
node tools/phase2.mjs                         # Phase Two: startup, fallback, save compat, new models, FPS limit, loop sleeping
node tools/perf.mjs <label>                   # performance probe (see PHASE_TWO.md)
node tools/validate.mjs all                   # browser suite: boot, buttons, modes, protection, upgrade, evolve, reveals, leaks, quality, motion, responsive, save, audio
node tools/shoot-after.mjs                    # regenerate docs/screenshots/after
```

Open `http://127.0.0.1:5173/dev/gallery.html?compare=1` to see every slice model next to its original SVG.
