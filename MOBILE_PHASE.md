# MOBILE PHASE — Mobile Experience and Responsive UI

Status: **Mobile A complete (checkpoint); Mobile B and C not started.** Branch `phase-five`, base commit `704b499`, app version 0.6.3, working tree clean at start.
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

## Progress log
- 2026-10-23 — Mobile A done: shell/nav, tokens, Home, Open Hall, Vault. Checkpoint committed to `phase-five`.
- 2026-10-23 — Audit done (docs, CSS, nav, input, quality settings read; 390×844 overflow and target-size probe across 10 screens). No code changed.
