# AETHERVAULT — TODO / Status (v0.5)

## Phase Four (done, see PHASE_FOUR.md)
- [x] Container identity (explicit pools), Relic Chest + Starlit Egg 3D, Wanderer card pack, Forge Crate roulette, reworked rituals
- [x] Literal Cards (3 sets, 64 cards), 3D cards + holograms, Fusion Chamber, Vault expansion (9 views, filters, saved searches, collections), Inspect → Organise
- [x] Save v3 migration with raw backup + fault injection; settings for the new systems
- [x] Validation: logic 45/45, phase3 Node 22/22, phase4 Node 30/30, phase3 Chrome 39/39, phase2 Chrome 40/40, Vault + Organise Chrome scenarios (see PHASE_FOUR.md §10)
- [ ] Not built: a machine "post-reveal cooldown" (the original brief had no specification; dropped rather than invented)
- [ ] Not verified: mobile/touch behaviour of the new screens beyond a 375 px overflow check, other browsers, low-end GPUs, audio mix of the new sounds (cannot listen)
- [ ] Deferred on purpose: quests, seasons, battle pass, events, trading, marketplace, multiplayer, accounts, Creator Mode, interchangeable skins


## Phase Three (done, see PHASE_THREE.md)
- [x] Rarity rings removed; rarity on pedestal and light
- [x] 40/40 collectibles in 3D; stat framework (6 families + cosmetic data); save v2 migration with backup
- [x] Category stage names + structural stage details; Forge/Inspect redesign; 57 forms, 23/40 items with a branch choice
- [x] Validation: logic 45/45, phase3 Node 22/22, phase3 Chrome 39/39, phase2 Chrome 40/40
- [ ] Not verified: mobile/touch layouts of the new UI, other browsers, low-end GPUs
- [ ] Candidates next: per-form pedestal accents, a cosmetics category using the defined stat family, fusion (after stats and transformations have settled)
- [ ] Deferred on purpose: quests, seasons, battle pass, events, trading, marketplace, multiplayer, accounts, Creator Mode

## Phase Five (Combat) — see PHASE_FIVE.md
- [x] Combat A: C0 spikes, combat data + stat translation, save v4 + backup, deck editor, pure simulation (hand, Elixir), Training Arena with Pets
- [ ] Combat B: move orders, abilities + aiming, defeat presentation, support cards (weapon, shield, machine, relic, oddity), pooled effects
- [ ] Combat C: opponent AI, match flow + resolver, ELO/ladder/rewards, tutorial, audio/VFX/2D fallback, final validation


## Phase Two (done, see PHASE_TWO.md)
- [x] Startup sequence · loop sleeping · FPS limit · thumbnail cache/framing · 13 new 3D models + pack and capsule
- [ ] Not verified: low-end GPU / mobile performance, audio mix of the startup cues (cannot listen)
- [ ] Candidates next: Relic Chest, Oak Buckler, Starforged Aegis, Sky Skiff in 3D; slice first-use pattern/wear texture generation (up to ~400 ms)


Legend: `[x]` built **and tested** · `[~]` built, only partly tested · `[ ]` not done · `(deferred)` consciously out of 0.1

## How to run
- Double-click `Play-Aethervault.bat` (serves locally and opens the browser), **or** `node serve.mjs` then open http://127.0.0.1:5173
- Rule tests: `node tests/logic.test.js` (32 checks, all passing)

## Version 0.1 — systems
- [x] Planning docs (PROJECT_PLAN.md, ARCHITECTURE.md, this file)
- [x] Data registries: 8 rarities, 10 variants, 8 patterns, 6 palettes, 5 auras, 39 collectibles (34 drawable from containers + 5 evolution forms), 7 containers, store
- [x] Save/load/migrate (corrupt-save backup, import validation); survives reload (verified: wallet, specimens, nickname, settings)
- [x] Specimen generation (variant, pattern+seed, palette, condition, potential, serial, size, aura, quirk, nature) — rules unit-tested
- [x] Economy: 4 currencies, Standard + Unlimited, price gating, pity meters, slot guarantees (unit-tested over hundreds of rolls)
- [x] Procedural art for all 39 items + 6 container types (visually reviewed in a gallery)
- [x] Opening rituals: egg (tap/crack), pack (drag/tap tear), crate (hold-to-charge), capsule, chest, vault — egg ritual exercised by real clicks; others exercised via the skip path and code review only
- [x] Reveals for all 8 rarity tiers run to completion without errors (driven with forced pulls); skip/advance works
- [~] Reveal *visual quality* per tier reviewed only at small/low-resolution screenshots; legendary/transcendent/anomaly choreography not eyeballed frame by frame
- [x] Vault: search, category/rarity/variant/condition filters, 9 sorts, favorites, locks, multi-select, duplicate filter — counts verified against engine
- [x] Protected items (favorite/lock/companion) survive select-all dismantle with confirmation (UI-verified)
- [x] Inspect: traits, history, copy comparison, rename, prev/next, dismantle-protection messaging
- [x] Dismantle → Essence; dismantle-duplicates keeps best copy
- [x] Upgrade (5 stages, potential-gated cap) and pet evolution incl. branching + cinematic (UI-verified Nimbit → Nimbus)
- [x] Codex with silhouettes + hints; Evolution Atlas
- [x] Mock store: checkout simulation, exchange, bundles, daily offer, Play Cash (all UI-verified)
- [x] Daily reward, XP/levels
- [x] Settings: mode switch, volumes, animation speed incl. Instant, reduced motion, screen shake, flashing, text size, export/import/reset
- [~] Audio: all sounds are synthesised and wired, but I cannot *listen* — audibility/mix balance is unverified
- [~] Responsive: verified no horizontal overflow on every screen at ~340px and 768px emulation, and Open hall/Home at desktop width; other screens at full desktop width reviewed mostly by layout rules, not pixel-checked
- [~] `index.html` opened directly from disk (file://): code uses only classic scripts + localStorage so it should work, but I could not test it in this environment

## Bugs found and fixed during testing
- Event-bus infinite loop (re-render during `Set.forEach` re-subscribed forever) — now iterates a snapshot
- Mobile grids overflowing (`1fr` → `minmax(0,1fr)`)
- Starry pattern produced giant white shapes (string concatenation in `sparkle()`)
- Vault cards collapsing to zero width (self-referential CSS variable)
- Sticky vault toolbar covered short screens

## Known rough edges / honest notes
- Pattern overlays can look busy on already-detailed art (Checkered especially)
- Most reveal polish (timings, particle density) deserves a human eye on a real desktop
- No automated browser test suite yet; UI flows were driven by scripts in the in-app browser

## Deferred (none of these appear in the UI)
- (deferred) Quests & achievements
- (deferred) Showcases, custom folders, binder/shelf views, ownership history beyond the local timeline
- (deferred) Simulated collectors, trading, marketplace
- (deferred) Events, seasons, battle pass, news/patch archive
- (deferred) Creator Mode suite & Custom Mode tuning UI (the `economy` multipliers exist in the save)
- (deferred) Fusion & mutation
- (deferred) Expressions / cosmetics categories
- (deferred) Real music themes (v0.1 has a generative ambient pad)
- (deferred) Companion location/accessory customisation
