# AETHERVAULT — Project Plan

> *The Infinite Archive. A private, single-player, 2D live-service collectible simulator.*
> Source of truth for the long-term vision: `collectible_live_service_simulator_project_bible.md`.
> **Simulation only. No real transaction. No payment services. No network access.**

## 1. Creative decisions (where the bible left things open)

| Question | Decision |
|---|---|
| Name | **AETHERVAULT** |
| World | *The Archive* — a mysterious platform that captures objects from many realities and lets the Collector (the player) draw them out of sealed containers. |
| Visual style | Midnight indigo + violet base, luminous aurora gradients, gold-trimmed chamfered "glass-and-metal" panels, strong saturated rarity colors. Brighter and more colorful than the bible's first sketch. |
| Rarity ladder | Common · Uncommon · Rare · Epic · Mythic · Legendary · Transcendent · Anomaly (each with its own color, glyph shape, reveal choreography and sound). |
| Currencies | **Credits** (earned), **Gems** (premium, from the mock store), **Essence** (from dismantling; upgrades/evolution), **Keys** (crates). Play Cash is a *fictional* wallet used only by the mock checkout. |
| Content balance | 5 categories (Pets, Gear, Relics, Machines, Oddities) with a deliberate emphasis on Pets (evolution) and Oddities (mystery). |
| Tech | Dependency-free static web app (HTML + CSS + classic JS, SVG art, Canvas particles, WebAudio synthesis). Runs from `index.html` directly or via `serve.mjs`. Persistence via `localStorage`. |

## 2. Version 0.1 — Core systems (implemented)

1. **Game client shell** — animated home, layered parallax backdrop, ambient particles, game-style top bar + bottom navigation, portal transitions, toasts, modals.
2. **Economy** — 4 fictional currencies, mock storefront (Play Cash → Gems, Gem exchange, bundles, daily offer, simulated checkout), Standard Simulation and Unlimited Mode.
3. **Collectibles** — 37 original procedurally drawn collectibles across 5 categories (+ 5 evolution-only forms).
4. **Containers** — 7 containers: Wanderer Pack, Hatchling Egg, Starlit Egg, Forge Crate, Oddity Capsule, Relic Chest, Mythic Vault. Each has its own interactive ritual (tear, tap-to-crack, hold-to-charge, twist, unlock locks…), odds page, pity meter, x1 / x5 / x10 openings, and instant-open.
5. **Reveals** — rarity-scaled choreography (slide → rays → silhouette → multi-stage traits → prismatic → glitch/malfunction), skippable, accelerable, reduced-motion aware.
6. **Unique specimens** — variant, pattern + seed, palette, condition, potential, serial number, quirk, aura, size, personality (pets), origin, history log, estimated value.
7. **Collection Vault** — search, category/rarity/variant/condition filters, 9 sort modes, favorites, locks, multi-select, batch actions, duplicate detection, Codex (silhouettes for undiscovered).
8. **Inspection** — tilt/light interaction, full trait sheet, history timeline, duplicate comparison, rename, favorite/lock, companion assign, dismantle with confirmation.
9. **Dismantle** — Essence yield; favorited/locked items are hard-protected; "dismantle duplicates" keeps the best copy; always confirmed.
10. **Upgrading** — 5 visible stages (Base → Signature) with visual changes per stage, Essence+Credits costs, potential-gated cap.
11. **Pet evolution** — Nimbit → Nimbus → (Tempestral ⟶ Stormsovereign | Pluvia) branching line, plus Emberkit → Pyrodrake; Evolution Atlas; active companion that reacts on the home screen.
12. **Persistence** — versioned localStorage save with migration hook, autosave, export/import JSON, reset.
13. **Settings** — master/music/UI/opening volume, animation speed (incl. instant), reduced motion, screen shake, flashing, text size, mode switch, skip rituals.

## 3. Later expansions (not in 0.1 — see TODO.md for honest status)

- **Milestone 2:** Quests, account-level rewards, showcases, folders, achievements, richer music.
- **Milestone 3:** Simulated collectors + trading, ownership history, marketplace values, events, battle pass, news/patch archive.
- **Later:** Creator Mode suite, Custom Mode economy tuning UI, custom containers, fusion & mutation, historical seasons, deeper profile customization, more categories (expressions, cosmetics).

The data model already reserves hooks for all of these (see ARCHITECTURE.md §6) so none require a save-format rewrite.

## 4. Quality bar

- Every visible control works; features that don't exist yet are **not shown**.
- No generic dashboard cards: chamfered layered panels, light, particles, tactile buttons.
- Destructive actions confirm; protected items cannot be dismantled by any code path.
- Everything original: procedural SVG art, synthesized sound, invented names.
- Claims in TODO.md are only made for flows actually exercised in testing.
