# MOBILE PHASE — Mobile Experience and Responsive UI

Status: **Mobile A, B and C complete (checkpoints); the phase is closed pending the real-iPhone check.** Branch `phase-five`, base commit `704b499`, app version 0.6.3. Checkpoints: A `a80855b`, B `6f4b59a`, C is the commit after it.
Out of scope: Combat C, ranked AI/ELO, new content/systems, Supabase/auth/cloud/updater/release changes, 3D asset rebuilds.

## Budget rules (from the brief)
Device matrix: 375×667 (high-risk only), 390×844, 844×390, 768×1024, 1440×900. One browser harness at a time, max two attempts per automation strategy, representative states only, one final smoke, screenshots kept out of Git.

## Audit baseline (what exists today)
- **Breakpoints:** one real mobile breakpoint, `max-width: 860px` (about 14 rules across 9 CSS files), plus 1000/1100/1180 desktop steps and 480/520/640/700/760 one-offs. No orientation or `max-height` rules except boot (`520px`). No `pointer: coarse` rules; one `hover: none` rule (vault).
- **Shell (≤860px):** `pages.css:94` turns the left rail into a **62px bottom bar of all 8 destinations plus Settings (9 equal buttons at 390px ≈ 43px each, 0.6rem labels)**. Topbar collapses wordmark/mode badge; currencies shrink to 27px-tall chips.
- **Safe areas:** `pwa.css` defines `--sa-*` and applies them to `#app`, toasts, modals, boot footer, update banner, sync pill. `viewport-fit=cover` is set. The bottom bar sits inside `#app` inset, so it clears the Home indicator, but heights using `100vh` (`.filters`, `.bench .mini-list.tall`) are not `dvh`.
- **Input abstraction:** pointer events only (no touch handlers). `touch-action: none` exists in just two places (3D view canvas in `stage.css`, battle field in `battle.css`). Battle input (`js/combat/input.js`) maps **right-click = move order** and **keys = Q/E/R/Esc**; left-click only selects.
- **3D quality:** `settings.quality3d` off/low/medium/high and `fpsLimit` auto/30/60/max. First run auto-selects `low` only when a software/slow renderer is detected (`boot.js:70`); there is **no touch, viewport, or `deviceMemory` based default** and no Battery Saver/Balanced/Quality preset.
- **Visibility handling:** stage, fx, audio, battle and cloud already listen to `visibilitychange`.
- **Measured at 390×844 (all main screens):** no page-level or stage-level horizontal overflow. Interactive elements under 36px: Home 7, Open 14, Vault 38, Pets 4, Forge 12, Fusion 11, Combat 4, Deck 5, Store 8, **Settings 43**. Currency chips are 27px tall.

## Findings

### Blockers
| ID | Finding |
|---|---|
| B1 | **Combat has no touch move order.** Move is right-click only (`input.js` button 2); tap only selects. Q/E/R/Esc are keyboard only; no on-screen Cancel. Aimed ultimates have no touch path to confirm/cancel. Combat is not playable without a keyboard and mouse. |

### Severe
| ID | Finding |
|---|---|
| S1 | **Nav: 9 equal-weight 43px tabs** with 0.6rem labels; no More/Archive grouping, no clear primary set. |
| S2 | Wide count of sub-36px controls (Vault 38, Settings 43, Open 14, Forge 12, Fusion 11); no `pointer: coarse` sizing layer. |
| S3 | Vault filters become a static block above the grid at ≤860px (full filter panel stacked in the page); no drawer/bottom sheet, no visible removable active filters. `.cell .card-quick` is simply hidden on mobile. |
| S4 | Battle HUD: hand collapses to a 2-column grid under the field with `min-height: 560px`; combined with no touch controls the central arena has no tuned portrait/landscape composition. |
| S5 | 3D stages only get `touch-action: none` on the canvas; no pinch zoom, no reset-view control on mobile (`.cs-reset` is hidden at ≤860). Page scroll can fight drags at stage edges. |
| S6 | Settings is a single 3.5k-px column (stH 3484 at 390px) with no grouping. |

### Moderate
| ID | Finding |
|---|---|
| M1 | Home hall is a fixed 560px with overlays; first-run onboarding modal and hall content overlap during transition at 390px. |
| M2 | Several panels use `100vh` instead of `dvh` (keyboard/URL-bar shifts). |
| M3 | Sync pill is placed at `bottom: sa-b + 66px` hard-coded to the old 62px bar; breaks when the bar changes. |
| M4 | Deck editor relies on picker list + drag; needs tap-based add/replace flow check on touch. |
| M5 | Compare table / `.cmp` and Fusion info panels are not responsive tables. |
| M6 | Many `hover:` interactions (card quick actions, tooltips) without touch equivalents; not yet enumerated. |

### Cosmetic
- Currency chip icons 14px; bottom-bar label size.
- Toast width/position uses the desktop right-anchor at mobile widths.

## Not yet audited (honest gaps)
Open Hall rituals, Binder/Compare/Organise, Inspect, Forge chamber, Fusion chamber, Deck editor and Battle were measured for overflow/target size only, not inspected visually. Modal fit under the on-screen keyboard and auth/cloud/PWA states are untested. These get visual checks as each is implemented.

## Plan (checkpoints)
- **Mobile A:** shared tokens (`pointer: coarse`, dvh, target sizes), new app shell (5 primary tabs + More sheet, safe area, toast/sync-pill placement), Home and 3D stage controls (reset, pinch), Open Hall touch, Vault filter sheet / active chips / density / selection.
- **Mobile B:** Inspect, Forge, Fusion, Cards/Binder/Compare, Deck editor (tap add/replace, sticky Save).
- **Mobile C:** combat touch controls (tap select, tap-to-move, Q/E/R buttons, aim gestures per aim model, Cancel, landscape recommended), Settings grouping, auth/cloud/PWA states, performance presets (Battery Saver / Balanced / Quality), desktop shared-bug pass, final smoke, deploy, iPhone checklist.

## Mobile A — delivered (shell, Home, Open Hall, Vault)
- **`css/mobile.css`** (new, loaded last; precached): coarse-pointer sizing (44px buttons/selects/seg/chips, 16px inputs so iOS does not zoom, no text-selection/callout on stages and rituals), phone shell, bottom sheets, Home/Open/Vault compositions. Desktop (>860px, fine pointer) renders unchanged; verified at 1440×900 (9-button rail, no More, sidebar filters).
- **Navigation (≤860px):** bottom bar is now **Home · Open (hero) · Vault · Combat · More**. More opens a bottom sheet (`ui.moreSheet`, `modal({cls:'sheet'})`) with Pets, Forge, Fusion, Store, Settings; More lights up when one of those is the current screen. The top bar shows the current place name instead of the wordmark; toasts span the top; update banner and sync pill sit above the bar (pill hides while the banner, filter sheet or selection bar is up). Phone landscape (height ≤ 500) swaps the bottom bar for a 62px side rail.
- **Sheets:** generic `.modal-wrap.sheet` (grab handle, safe-area bottom padding, ≤86dvh, internal scroll). `.screen-enter` no longer leaves a transform on finished screens (it was the containing block that would have broken every fixed sheet/bar).
- **Home:** the companion stage fills the screen; the nameplate is a slim bar under it with the Living-wing action; facts hidden. Landscape: stage left, ledger column right.
- **3D stages:** one-finger rotate and (zoom views) pinch were already in `View.bindInput`; mobile now un-hides **Reset view** (`.cs-reset`) and suppresses the long-press context menu on stages/rituals. Non-zoom stages (Home, Open) use `touch-action: pan-y` so vertical drags still scroll the page and horizontal drags rotate; zoom stages (Forge, Fusion, Inspect, rituals) use `touch-action: none` only on the canvas, so scrolling resumes the moment a finger lands outside it.
- **Open Hall:** container index is a snap-scrolling carousel that keeps the selection centred; the stage plus a two-row control bar (quantity + total, full-width Open) fit one screen; rituals, reveals and summaries respect the notch/home indicator. Verified one opening per container type at 390×844 (pack drag-tear, card flip, Faster/Reveal all/Skip reachable; egg/starlit/chest/capsule/vault by tap; crate by touch-pointer hold; reel and summary fit).
- **Vault:** sticky toolbar (search, Filters button with active count, sort, plate density, Select); advanced/standard filters live in a bottom sheet with a live "Show N" button (all existing filters, Advanced filters modal, collections and saved searches kept); removable chips and saved-search tabs scroll horizontally; view tabs scroll; selection mode is a pinned single-row action bar (Dismantle last and still confirms). The grid still uses cached thumbnails only.

### Tests run (Mobile A)
- Node: logic 45, phase3 22, phase4 30, combat 99, all passing. `pwa-stamp --check` OK.
- Browser (built-in pane, one harness): 390×844 Home/Open/Vault/filter sheet/selection/7 openings; 844×390 Home and Open; 768×1024 Home/Open/Vault/More sheet → Forge; 1440×900 desktop regression. No page-level horizontal overflow, no console errors, stage view count returns to the expected 0–1 after each screen. No historical Chrome suites re-run. Screenshots kept outside Git.

### Known limitations / not done
- Phones wider than 860px in landscape (for example 932×430) still get the desktop layout; a coarse-pointer/short-height phone breakpoint is left for Mobile C together with combat orientation.
- The pane was throttled while testing, so CSS transitions/animations were checked by computed state, not visually in motion; check on a real phone.
- Binder, Families, Duplicates, Timeline, History, Sets and Compare views inside the Vault only inherit the toolbar/tabs; their own phone layouts are Mobile B.
- Forge, Fusion, Inspect, Pets, Store, Settings, Deck editor, Combat controls (blocker B1) and performance presets are untouched.
- Hover-only card quick actions remain hidden on phones (favorite/lock available in Inspect and via Select).
- Desktop release: the shared frontend changed, so a patch release would be needed to ship it in the EXE; not proposed yet (see completion report at the end of the phase).

## Mobile B — delivered (Inspect, Organise, Forge, Fusion, Vault views, Deck editor)
All phone rules live in `css/mobile.css` (Phase B block), with small markup hooks in four screens. Desktop is unchanged (verified at 1440x900: bench/picker/rail stay inline, none of the phone-only buttons or docks render).
- **Inspect + Organise:** the modal is full-bleed (it was 16px too wide at 390 because the wrap padding was kept); the stage is `clamp(280px, 44dvh, 460px)` with a **floating Close** over the stage (`.io-close`, new in `inspect.js`; the sheet's own close scrolled away), prev/next arrows, position, Reset view and the card/hologram switch kept. **Forge, Fuse, Favorite, Lock, Companion, Duplicate and Dismantle are one docked, horizontally scrolling row** pinned to the bottom (Forge and Fuse first, Dismantle last and still confirming; the protected state still reads). Tags, note (16px so iOS does not zoom) and collections are 44px controls; stat rows, Compare-with, "Show next upgrade", looks and ledger are touch-sized. Phone landscape: stage left, scrolling sheet right.
- **Forge:** chamber first (stage `clamp(300px, 46dvh, 480px)`, title, stage lamps, Reset view). The **specimen picker is a bottom sheet** opened by a **Change** button (new `bench-open` state in `forge.js`; picking closes it, search and division chips live inside it). The Upgrade button is **sticky** above the bottom bar while the upgrade card scrolls; evolution levers, branches and previews keep their existing flows, buttons go full-width.
- **Fusion:** header with **Choose specimens**, slots become a 3-up wrap (primary, secondary, optional second donor; the plus glyph is hidden), the picker is a bottom sheet that also opens by tapping an empty slot (`pick-open` in `fusion.js`; roles and compatibility reasons untouched), the preview/result panel stacks beneath the chamber and **Fuse is sticky**.
- **Vault views:** Binder set tabs scroll sideways in one row, the page grid stays 3-up with tighter gutters, Fast list drops Class/Best-copy columns. **Duplicates keeps art, serial, variant, condition, potential and value** (stage/form/print columns hidden on phones, group actions full-width). Families, Timeline, History and Sets get tighter cards and 44px rows. **Compare is full-screen with sideways-scrolling specimen columns under a pinned label column.**
- **Deck editor:** deck tabs scroll sideways; the 10 slots are compact rows (art, name, role, Elixir cost, **Swap**, remove; DPS/kit detail stays one tap away in the numbers modal). **Add** opens the collection as a bottom sheet (search, role chips, Add buttons, "not combat-ready" list). **Swap** opens the same sheet titled "Replace <name>" and the next Add replaces that slot in place, so a full 10/10 deck can be changed without removing first (new `swapId`/`pickOpen` state in `deck.js`; desktop rows and Add behaviour unchanged). A **docked bar** shows `n/10`, "Ready · saved", Add and Done. There is no explicit Save: every edit was always written immediately (`E.deckUpdate`), so the dock says so instead of adding a button.
- Also: a stray `}` was removed from the Home block of Mobile A's CSS, and `body:has(.deck-dock)` hides the sync pill so it does not cover Done.

### Tests run (Mobile B)
- Node: logic 45, phase3 22, phase4 30, combat 99, all passing. `pwa-stamp` re-run and `--check` OK (96 precached files).
- Browser (built-in pane, one harness, no historical suites): 390x844 Inspect (Organise tag/note/favorite/prev-next via the dock), Forge (picker sheet, evolution levers, sticky Upgrade), Fusion (slots, picker, duplicate fuse preview), every Vault view plus Compare, Deck (slots, Add sheet, Swap replace-in-place at index 2 with the other nine entries unchanged). One matrix pass of Forge/Fusion/Deck/Duplicates/Binder/Inspect at 375x667, 844x390, 768x1024 and 1440x900: no page-level horizontal overflow, no console errors from the app. Final smoke: Inspect, favorite/tag/note/next, Forge, picker, Fusion slot, Home at 390x844. Screenshots kept outside Git.

### Known limitations / not done (Mobile B)
- The built-in pane does not emulate `pointer: coarse`, so the 44px coarse layer was verified by CSS reading and the phone layouts, not by measuring on a touch device. Some small buttons (Reset view, Change, Choose specimens) measure 30-39px in the pane and become 40-44px with a real touch pointer. Needs the iPhone check.
- Hover-only tooltips remain (the stat "why" is tap-to-expand already; card quick actions are still only on Select/Inspect).
- Deck rows hide DPS/kit chips on phones; the numbers modal is the way to see them. Cards have no stand-alone view (they appear in Specimens, Binder, Codex and Inspect), so nothing extra was built for them.
- Compare with four specimens scrolls sideways by design; 360px-wide phones were not measured.
- The top bar balance chips at 390 can clip the last chip (keys) beside the level ring; that is Mobile A's shell, left for Mobile C's shell/settings pass.
- Phones wider than 860px in landscape, combat touch controls (B1), Settings, auth/cloud/PWA states and performance presets are still Mobile C. No desktop release proposed.

## Mobile C — delivered (combat touch, battle HUD, wide landscape phones, Settings, performance presets)
No gameplay, Supabase/auth/cloud/updater or release change. Desktop (>860px, fine pointer) verified unchanged at 1440x900 (3-column HUD, 9 settings cards, no tabs, mouse select/deploy/deselect as before).
- **B1 closed — combat is playable by touch** (`js/combat/input.js`, `js/screens/battle.js`; still one pointer abstraction, touch is `pointerType` touch/pen):
  - *Select:* tap one of your Pets (hit radius +14px for touch). *Deselect:* the **x** in the Pet panel (a ground tap no longer deselects on touch because it is now an order).
  - *Tap-to-move / target:* with a Pet selected and no mode active, a tap on the ground walks it, a tap on an enemy or the enemy Core sets its priority target (same `canMove`/`canTarget` checks and messages). Dragging from the Pet still draws and issues the drag order. Move/Target/Stop buttons stay for the explicit modes.
  - *Q / E / R:* the Pet panel has three equal one-tap ability buttons with cooldown/charge text; tapping the active one again cancels it.
  - *Aim gestures (every aim model, and support-card placement):* with an aim or card mode active, **press shows the preview, drag moves it, release over the board commits, release off the board cancels**; a plain tap commits at the tapped spot. Once the finger has moved, the aim point is lifted 44px above it so the preview is not hidden under the finger; chain/target picks follow the lifted point with the wider touch radius. Hand cards are dragged the same way (`touch-action: none` on cards).
  - *Cancel:* a full-width bar with **Cancel** (no "· Esc") at the bottom of the arena whenever a mode is active; mode wording says "tap" on coarse pointers. Mouse and keyboard paths are unchanged.
- **Battle HUD, portrait:** two-row top bar (Leave / clock / Dummies+Pause, then both Core bars, which were hidden under 700px); the arena takes the rest; the Pet panel is a bottom overlay (name, HP, Q/E/R, Move/Target/Stop); the bottom HUD is Elixir + Reshuffle, then the 4-card hand as compact vertical cards. The Numbers panel and deck strip are hidden on phones. A dismissible "Landscape gives the arena more room" tip shows on portrait phones (remembered for the session, auto-hides after 9 s); portrait stays fully playable.
- **Battle HUD, landscape (height <= 500):** arena left, a 188-236px column right with Elixir, a 2x2 hand and Reshuffle; the side rail nav stays.
- **Wide landscape phones (932x430 etc.):** every `max-width: 860px` rule now also matches `(hover: none) and (pointer: coarse) and (max-height: 500px)` (the compound landscape rules got the same alternative). An iPhone Pro Max in landscape gets the phone shell, side rail, Home, Open, Vault, Inspect, Forge, Deck and the battle layout. Landscape tablets (height > 500) and short desktop windows (fine pointer) are unchanged.
- **Settings:** a sticky group strip on phones (Display · Comfort · Account · Data) shows one group of cards at a time (Display: Economy, 3D; Comfort: Audio, Motion, Openings; Account: Install & updates, Account; Data: Your data, About). Desktop still shows all nine cards. Account/cloud/PWA buttons are full-width with wrapping text.
- **Performance presets** (`AV.util.perf`, Display > 3D presentation): **Battery Saver** (Low, 30 fps), **Balanced** (Medium, auto; the long-standing default) and **Quality** (High, 60 fps), with a "Custom" note when quality and frame limit were set separately. **First-run default** (new profiles only, never overriding a choice): software renderer -> Battery Saver; touch phone (coarse pointer, short screen side < 600px) -> Battery Saver unless the device reports 8 GB or more; everything else stays Balanced. iOS does not report `deviceMemory`, so iPhones start on Battery Saver; the player can raise it in Settings.
- **Top-bar balance clip fixed:** four chips plus the level ring fit 390px and 375px (ledger scroll width equals client width); the place name truncates instead.
- **Desktop shared-bug pass:** `100vh` -> `100dvh` (under `@supports`) for the sticky Vault filter column and the Forge bench list; the Settings preset/quality buttons redraw so the "on" state is always right; the battle top bar no longer overlaps at 375px. No other desktop defects were found in the screens exercised.

### Tests run (Mobile C)
- Node: logic 45, phase3 22, phase4 30, combat 99, all passing. `pwa-stamp` re-run, `--check` OK (96 precached files, no new files).
- Browser (built-in pane, one harness, no historical suites): 390x844 battle (deploy by touch drag, tap-select, tap-to-move, Q aim press-drag-release commits, Move/Target/Stop panel, Q/E/R readouts), Settings groups and all three presets plus Custom, Account/Install tab; 375x667 battle and top bar; 844x390 battle landscape; 932x430 (coarse condition forced on in the page, because the pane only emulates touch under 768px) Home/Open/Vault/Settings/battle; 768x1024 and 1440x900 overflow and desktop regression (mouse select/deploy/deselect). No page-level horizontal overflow and no console errors from the app. Touch was driven with synthetic touch pointer events. Screenshots kept outside Git.

### Known limitations / not done (Mobile C)
- Touch gestures were verified with synthetic pointer events in the pane, not on a real touch screen (finger lift, multi-touch, palm rejection, iOS rubber-banding, real 44px target measurements).
- The signed-in cloud panel and the PWA install/update states were reviewed as CSS (full-width buttons, wrapping text) but not exercised signed-in; the dev server has the service worker off.
- Landscape battle: the Pet panel covers a good part of the small arena; close it with the x to see the field.
- The first-run Battery Saver default lowers 3D quality for new touch-phone profiles; existing profiles are not touched.
- Desktop release: the shared frontend changed across three phases, so the desktop EXE needs a patch release to include it. Not proposed or built here (out of scope).

### iPhone checklist (real device, Safari and the installed Home Screen app)
1. Home Screen install: icon, splash, no browser chrome, safe areas at the notch and Home indicator, top bar shows all four balances, bottom bar not clipped.
2. Portrait: Home, Open (each container), Vault filter sheet and selection bar, Inspect dock, Forge/Fusion pickers, Deck Add/Swap, Settings group strip and presets, More sheet.
3. Combat portrait: deploy a Pet by dragging a card (preview lifted above the finger), tap-select it, tap ground to walk, tap an enemy to prioritise, Q/E/R aim by press-drag-release, Cancel, drag off the board to cancel, x to deselect, reshuffle; confirm no page scroll or pinch zoom fights the arena.
4. Combat landscape (Pro Max 932x430 and a smaller iPhone): phone shell with the side rail, battle column on the right, panel readable, notch and rail insets.
5. Settings > Display: pick Battery Saver / Balanced / Quality; check frame rate and heat in a 2-minute battle; confirm a brand-new profile starts on Battery Saver.
6. Rotate during a battle and during a ritual; background and return (auto-pause); keyboard open in Vault search, Deck search and the Organise note (no zoom, sheet stays visible).
7. Account: sign-in and the signed-in cloud panel at 390 and 932 widths; offline start from the installed app.
8. 3D stage gestures: one-finger rotate, pinch on zoom stages, Reset view; vertical scroll still works on the Home and Open stages.

## Progress log
- 2026-10-23 — Full-app smoke test at 402x874, 874x402, 820x1180 and 1440x900 (see `docs/mobile-ui-handoff.md`): battle HUD no longer hides the enemy Core label (renderer `topInset`), bottom sheets fill their width (scoped reset of the specimen-sheet `.sheet` rules). PWA re-stamped. Remaining items accepted as real-device or later-polish checks.
- 2026-10-23 — Mobile C done: combat touch controls (B1 closed), battle HUD portrait/landscape, wide-landscape phone breakpoint, Settings groups, performance presets with a touch default, balance clip, dvh pass, iPhone checklist. Checkpoint committed to `phase-five`; phase closed pending the real-device check.
- 2026-10-23 — Mobile B done: Inspect/Organise, Forge, Fusion, Vault views/Compare, Deck editor (tap Add/Swap). Checkpoint committed to `phase-five`.
- 2026-10-23 — Mobile A done: shell/nav, tokens, Home, Open Hall, Vault. Checkpoint committed to `phase-five`.
- 2026-10-23 — Audit done (docs, CSS, nav, input, quality settings read; 390×844 overflow and target-size probe across 10 screens). No code changed.
