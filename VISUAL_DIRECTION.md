# AETHERVAULT — Visual Direction (v0.2 redesign + 3D vertical slice)

Scope freeze: **no new gameplay systems.** This document governs how the existing game looks, moves and is presented.
Reference captures of the audited build are in `docs/screenshots/before/` (1920×1080).

---

## 1. Audit — what reads as AI-generated

Observed in the v0.1 captures (Home, Open, Vault, Pets, Forge, Store, Onboarding, rituals, reveals, inspection, Settings, modals):

| # | Observation | Where | Why it reads as generated |
|---|---|---|---|
| 1 | One violet→indigo gradient wash on *every* surface (`#1d1556 → #05040f`, panels `rgba(46,36,112)`) | everywhere | The default "fantasy dashboard" palette; nothing is a material, so nothing is *somewhere*. |
| 2 | Glass panels (`backdrop-filter`, 80 % alpha, inner violet glow) on all containers | all screens | Glassmorphism without anything behind it to refract. |
| 3 | One panel = 18 px radius + thin gold L-corners (`::before/::after`) | ~40 panels | Single template stamped everywhere; gold used as outline, not as meaning. |
| 4 | Same composition on Home/Open/Forge: `[left column][center hero][right column]` of equal-weight cards | Home, Open, Forge | Rearranged cards, not designed places. |
| 5 | Radial sun-rays, floating diamond "crystals", twinkle starfield, aurora blobs | background of all screens, reveal, inspect, evolution | Filler for empty space; no location identity. |
| 6 | Concentric dashed/dotted rings + glowing orbs behind every hero object | Home altar, Forge, Pets, inspect | "Generic glowing ring behind important item". |
| 7 | Flat SVG mascots/objects with identical thick outline + gradient (Nimbus, crown, vault, drone…) | all items | Polished placeholder look; no material, no depth, no light. |
| 8 | Rarity = outer glow + conic spin only | cards, reveals | Rarity communicated by glow rather than form/material/composition. |
| 9 | Everything shares one visual weight: pills, chips, cards, bars all at the same contrast | Vault toolbar, Home | No hierarchy; the eye has no entry point. |
| 10 | Wide-tracked ALL-CAPS Bahnschrift for headings, buttons, labels, nav, rarity | all text | One typographic voice; uppercase + `.2em` tracking used as decoration. |
| 11 | Pill-shaped chips, pill currency counters with green "+" discs, glossy gold "OPEN" orb | top bar, nav, filters | Generic mobile-game chrome. |
| 12 | Mixed icon dialects: outline icons (1.8 stroke), filled coloured currency icons, rarity glyphs, text `∞ × → +` | top bar, buttons | No single family. |
| 13 | Bottom tab bar + floating hero orb | all | Mobile-app navigation on a desktop archive. |
| 14 | Card art all on identical violet radial backdrop with spinning conic borders | vault grid | Visual noise competes with the collectible. |
| 15 | Reveal: huge rays + trading-card flip | reveals | Same device for every collectible category. |

## 2. What is already strong (preserved)

- The **game architecture**: data → engine → UI separation, bus events, deterministic specimen seeds. Untouched.
- **Specimen model** (variant/pattern/condition/potential/serial/upgrade) — richer than most; the 3D layer renders it rather than replacing it.
- **Reveal choreography structure**: tiered timelines (`Seq` with skip) and the dim → silhouette → reveal rhythm. Kept; re-staged.
- **Interactive rituals** (tap/crack, hold-to-charge, wheel turn) — good verbs, now driven by physical 3D objects.
- **Tactile button feel** (hover lift, hard press, short release). Kept, rebuilt in a physical metaphor.
- **Audio synthesis**, sound mapping, settings/accessibility (reduced motion, flashing, text size, speed).
- **Rarity colour set** — retained, but used *only locally* (rarity marks, reveal stages, frames of that specimen).
- Copy tone ("Simulation only. No real transaction.") — stays, becomes a stamped notice.

## 3. Interface design system

### 3.1 Identity
A **mysterious luxury archive**: dark archival architecture, matte charcoal, warm ivory text, aged brass used for *prestige and primary action only*, a trace of spectral cyan for "live/active", physical labels, seals, index marks. Colour comes from the specimens, not the chrome.

### 3.2 Palette (one neutral set)
```
--ink-0 #0b0a09  page      --ink-1 #12110f  panels     --ink-2 #1a1815  raised
--ink-3 #24211c  controls  --ink-4 #302c25  hover       --hair  #3b362d  hairlines
--ivory #ece3cf  text      --ivory-2 #b5ab92 secondary  --ivory-3 #7c7461 tertiary
--brass #b48d4c  --brass-hi #d7b46e  --brass-lo #6c5429    (prestige / primary action)
--spectral #7fd0d2                                     (live state, focus)
--rust #bf5a45 (destructive)   --moss #86b07c (success)
paper #d8cdb1 / ink-on-paper #2b251a                    (label surfaces)
```
Rarity colours (`D.RARITY[*].color`) never appear in chrome; only on that item’s mark, frame edge, stage light.

### 3.3 Typography (bundled, SIL OFL; no network)
| Role | Face | Use |
|---|---|---|
| Display | Cormorant Garamond 600/italic | screen titles, specimen names, reveal title. Sentence/Title case, tracking 0 to +0.01em |
| Heading | Barlow Semi Condensed 600 | panel headings, buttons. Sentence case, no tracking |
| Label | Barlow Condensed 600 | short archival labels only (≤ 18 chars), uppercase, +0.1em |
| Numeric | IBM Plex Mono 500, tabular | currency, serials, odds, costs, counts |
| Body | IBM Plex Sans 400/500 | descriptions, lore (italic), settings text; measure ≤ 62ch |
Wide tracking is reserved for labels and the rarity moment in reveals.

### 3.4 Surface types (no universal panel)
1. **Matte panel** `.s-matte` — opaque `ink-1`, 1 px hairline, 2–3 px grain, **chamfered TL+BR corner** (`--cut`). Ordinary information.
2. **Specimen frame** `.s-frame` — brass bezel (gradient edge), dark mat, four screws, clipped corners. Collectible presentation only.
3. **Recessed tray** `.s-tray` — `ink-0`, inset shadow top/left, lip highlight bottom; square. Inventories, lists, grids.
4. **Label / paper** `.s-label` — paper tone, ink text, notched corner, mono metadata, ±0.4° tilt. Item data.
5. **Luminous containment** `.s-lumen` — thin rarity-coloured double rule with corner light-leaks, *rare+ only*.
6. **Cinematic stage** `.s-stage` — full-bleed, vignette, no border; openings, evolutions, inspection, home & pets stage.
Corner vocabulary (only three): **chamfer** (default panels), **tab** (a notch tab carrying the label), **square** (trays). Rounded shapes are reserved for physical round things (dials, knobs, lamps). Brass edges are *only* on frames and the primary button.

### 3.5 Icons
One custom family, 24-grid, 1.5 stroke, square caps, miter joins, no fills except a single 'accent' fill on currencies. Emoji/text symbols (`∞ × → +`) removed from chrome; `∞` stays only as a numeric value.

### 3.6 Buttons
`primary` brass plate (bevel, hard shadow, press travel 3 px); `major` = primary at larger scale with flanking pips (OPEN, Upgrade, Evolve); `secondary` charcoal key with hairline; `quiet` text + underline; `danger` matte rust plate; `disabled` flat hatch. Corners are chamfered, never pill.

### 3.7 Layout principles
- Each screen is a **place** (section 3.8), with one dominant object occupying ≥ 55 % of the viewport and supporting data hugging it.
- Left **rail** navigation (desktop) replaces the bottom tab bar; ≤ 860 px it becomes a bottom bar.
- Purposeful asymmetry: columns are 1 : 2.4 or 3 : 1, never 1 : 1 : 1.

### 3.8 Screens
| Screen | Place | Composition |
|---|---|---|
| Home | Archive chamber | One cinematic stage (arched niche, fluted wall) with the live 3D companion on a plinth; name plate as a paper label; right column is a narrow "ledger": featured exhibit (frame + guarantee gauge), recent accessions (tray), daily ledger (one row). |
| Open | Containment hall | Index rail (typographic list) • full-bleed stage with live 3D container, per-container lighting, haze and floor • slim control strip under the container • quiet odds ledger at the edge. |
| Vault | Specimen catalogue | Filter rail with archive controls (tabs, key toggles, rarity ladder) • tray of art-first plates • selection opens the inspection composition (large stage + specimen sheet). |
| Pets | Living-specimen wing | Roster tray • tall vivarium stage with live companion • care card (label) • **Lineage** rail: physical branching rail with lit/unlit niches. |
| Forge | Transformation chamber | Centre chamber with two pylons and stacked rings (one per stage); specimen on a lift plinth; console below with next-stage plan; evolution as branch levers. |
| Store | Archive exchange | Counter tabs • ledger of gem contracts (best value largest) • poster for daily offer • consignment manifests for bundles • board for exchanges • stamped simulation notice. |

### 3.9 Backgrounds
Per-location CSS/SVG layers (no rays, no floating crystals): Home fluted wall + arch; Open steel grid floor + hanging light bars; Pets glass arches + soft green; Forge blueprint grid + heat gradient; Store ruled-ledger columns; Vault cabinet grid. ≤ 24 dust motes, tinted per place.

## 4. 3D art direction

**Intent:** museum-photography of impossible objects. Low-poly *stylised* but crafted: bevelled edges, layered construction, material separation, believable reflections. Never a cluster of default primitives.

- **Camera:** 28–34° FOV, three-quarter presentation yaw (−25°…−35°), slight top-down (8–12°). Subject fills ~70 % of frame; never cropped.
- **Light:** warm key (upper-left, soft shadow), cool spectral rim (right-back), low neutral fill; synthetic studio environment map (softboxes) for reflections. **Rarity-sensitive rig:** commons neutral; rare/epic add coloured rim; mythic+ add a second sweeping spot and haze; transcendent cycles prismatic rim; anomaly flickers red/cyan.
- **Grounding:** brass-inlaid stone plinth with a physical serial plate (`№ 0421 · NIMBUS`); contact shadow always; real shadow map on Medium/High.
- **Materials:** PBR with 1–3 roles per object (body, trim, glow/detail). Traits are applied by one shared shader patch (triplanar pattern, wear, patina, cracks, variant effects) so every model reacts identically to specimen data.
- **Traits:** pattern → markings/engraving; condition → scratches, fade, patina, rust, cracks with inner light, instability; variant → material/behaviour (foil, holo, golden, shadow, corrupted, celestial, glitched, prismatic, inverted) without changing silhouette; potential → latent motes (≥55), sleeping core + evolution runes (≥80); upgrade stage → **geometry added per stage**; serial → engraved on plate and on the object where suitable.
- **Pets:** one metaball→surface-net cloud body per form (single smooth skin), shared face language (eye shape family, cheek marks, bolt tuft). Evolution = silhouette growth (mane, horns, mantle, crown) not scale. Behaviours: blink, cursor look, breathing, electrical surge, posture shifts, click reaction, delight after rare openings, settle after 20 s idle.
- **Vertical slice (all five categories):** containers Hatchling Egg / Forge Crate / Mythic Vault; Nimbus line (Nimbit, Nimbus, Tempestral, Pluvia, Storm Sovereign); Rustblade + Prismedge (one sword rig); Heart of Eternity; Leviathan Engine; Whisper Jar. All other items keep their SVGs.

## 5. Transition & motion hierarchy
1. **Ambient** (≤ 15 % attention): dust motes, slow light drift, pet breathing/blink, plinth glow.
2. **Interactive** (direct response, 80–200 ms): button depression, drag rotation + spring return, hover lift, currency count tick, panel slide 220 ms.
3. **Celebratory** (reserved): rare+ reveals, evolution, Signature upgrade. Only here: screen shake, flashes, bursts, haze, camera push.
Ordinary UI never uses glow pulses, spin loops or bursts. Reduced-motion: no ambient movement; 3D renders on demand (drag/interaction only), reveals cut instead of animate.

## 6. Implementation plan
1. Vendor Three.js r160 UMD (`vendor/`), fonts (`vendor/fonts/`). Classic scripts, still no build step, works from `file://`.
2. `js/stage3d/` — `core.js` (renderer, views, loop, quality, thumbnails), `lib.js` (geometry, surface nets, textures, trait shader), `staging.js` (plinths, lighting rigs), `models-*.js`.
3. Dev gallery (`dev/gallery.html`) to compare each model against its SVG.
4. New CSS system (`css/aether.css` replaces `style.css`/`screens.css`), new shell (left rail), new icon set.
5. Rewrite screen markup (home, open, vault, pets, forge, store, settings, inspect, modals, onboarding); opening/reveal/evolution staging on 3D.
6. Settings: 3D quality Off/Low/Medium/High; fallback path.
7. Validation harness (`tools/`), logic tests unchanged, new smoke + leak tests.

## 7. Performance strategy
- **One** WebGL renderer/canvas; each view copies its viewport to its own 2D canvas (correct z-order in modals, trivial hit-testing).
- Real-time 3D only for: active Home companion, Open-hall container, Forge specimen, Pets stage, inspection, reveal/ritual. Only views on the highest UI layer render; hidden/off-screen views are paused (`IntersectionObserver`, `visibilitychange`).
- Vault/Codex/lists/atlas: **pre-rendered thumbnails** (queued ≤ 6 ms per frame, LRU 160, blob URLs revoked on evict). SVG shown until ready or when 3D is off.
- Geometry cache (keyed), pattern/wear textures LRU at 256/384/512 px by quality; PMREM environment built once; models disposed on view change; `renderer.info` exposed for leak tests.
- Quality: **Low** (DPR ≤ 1, no shadow map, no physical clearcoat, 30 fps cap, fewer particles) · **Medium** (DPR ≤ 1.25, 1024 shadow, 45 fps) · **High** (DPR ≤ 2, 2048 shadow, 60 fps). **Off** = pure 2D.
- Auto-fallback to 2D if WebGL is unavailable or the context is lost.

## 8. Acceptance criteria
- [ ] No panel uses `backdrop-filter`; ≥ 4 distinct surface types visible on Home alone; no purple gradient on chrome.
- [ ] Display/heading/label/numeric/body roles all present; uppercase+tracking only on ≤ 18-char labels.
- [ ] Zero emoji/text-symbol icons in chrome; one icon family.
- [ ] Each of Home/Open/Vault/Pets/Forge/Store has a different composition and background.
- [ ] 8 slice assets have a recognisable silhouette at 96 px and extra detail at inspection; side-by-side comparison with SVG judged better.
- [ ] All five conditions, ≥ 7 variants, patterns, potential tiers and 5 upgrade stages are visibly different on at least one model of each category.
- [ ] Drag rotate, spring return, wheel zoom (inspect), reduced-motion, 4 quality levels, 2D fallback work.
- [ ] `node tests/logic.test.js` still passes; save/reload, Standard/Unlimited, favorite/lock protection, dismantle, upgrade, both evolutions, all eight reveals, onboarding verified in a real browser.
- [ ] Repeated openings/inspections: `renderer.info.memory` geometry/texture counts return to baseline (±2); frame time ≤ 16 ms (High) on the dev GPU with one centerpiece.
- [ ] Desktop 1920×1080, tablet 820, phone 390 layouts have no horizontal overflow.

---

## 9. Outcome (v0.2)

**Delivered:** full redesign of every screen, the shared 3D stage, and the vertical slice (13 builders: 3 containers, 5 Nimbus forms, Rustblade + Prismedge, Heart of Eternity, Leviathan Engine, Whisper Jar). No gameplay systems were added.

**Verified (real browser, `tools/validate.mjs`):** boot/onboarding, 161 controls clicked without error, Standard/Unlimited, favorite/lock protection, dismantle, upgrade to Signature, both evolution branches, all 7 container rituals, all 8 rarity reveals, save/reload, reduced motion, 4 quality levels, desktop/laptop/tablet/phone layouts, memory stable over 28 openings and 24 inspections (geometries 55→54, textures 28→30). Logic tests: 37 pass. Evidence: `docs/screenshots/{before,after,validation}`, `docs/screenshots/traits-*.png`, `docs/screenshots/comparison-svg-vs-3d.png`.

**Known limitations:** only the slice has 3D models (all other items stay SVG, so mixed grids are visibly inconsistent); the Nimbus line is cute but less iconic at thumbnail size than the old SVGs; potential tiers are subtle (latent motes, sleeping glow, evolution runes); fractured/unstable looks were tuned late and only spot-checked; GPU time was not profiled, only CPU frame cost and rAF rate on one machine; audio is untested by ear; the validation suite was not re-run after the last cosmetic tweaks (variant brightness, crack strength, pet stage-1 ring).
