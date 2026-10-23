# Mobile UI handoff — smoke test checklist

Date: 2026-10-23. Branch `phase-five`, app v0.6.3. Companion to `MOBILE_PHASE.md` (which holds the phase A–C delivery notes and the iPhone checklist). This file records the full-app smoke test across phone, tablet and desktop sizes.

## How it was tested
- Built-in browser pane, dev server `node serve.mjs 5173`.
- The pane is only ~1025x768, so each size was loaded in a correctly sized `<iframe>` (so media queries and `dvh` match the target size) scaled to fit the pane. Screenshots are of that scaled frame.
- The pane cannot emulate `pointer: coarse`, which the wide-landscape phone rules (874x402) and the 44px touch layer depend on. For 402x874, 874x402 and 820x1180 the page's stylesheets were rewritten at runtime so every `(hover: none)` / `(pointer: coarse)` media query matched, which is what a real touch device gets. Desktop (1440x900) was loaded fresh with no override.
- Every size ran an in-page audit over all screens: horizontal overflow, elements outside the viewport (outside scroll containers), tap targets under 32px, clipped text. Screens were then inspected by screenshot.
- Node suites: logic 45, phase3 22, phase4 30, combat 99 pass. `pwa-stamp` re-run, `--check` OK (96 files).

## Status key
**P** passes · **F** fixed in this pass · **B** still broken · **n/v** not verified

## Checklist
Sizes: **Pp** 402x874 phone portrait · **Pl** 874x402 phone landscape · **T** 820x1180 iPad portrait · **D** 1440x900 desktop

| Screen / state | Pp | Pl | T | D | Notes |
|---|---|---|---|---|---|
| Home | P | P | P | P | Pity gauges flagged at Pl are inside a closed `<details>` (false positive) |
| Open Hall (container carousel, controls) | P | P | P | P (audit only) | Rituals/reveals not re-run (covered in Mobile A) |
| Vault — Specimens grid | P | P | P | P | |
| Vault — Filters sheet | P | n/v | n/v | n/a | Sheet fix applies to all sheets, see Fixed #2 |
| Vault — Binder/Families/Duplicates/Timeline/History/Sets/Codex | n/v | n/v | n/v | n/v | Tabs reachable; per-view layouts verified in Mobile B, not re-shot here |
| Inspect / Organise modal | P | P | P | n/v | Floating Close, dock, prev/next all fit |
| Combat landing | P | P | P | audit only | |
| Deck editor | P | P | P | audit only | |
| Deck — Add sheet | P | n/v | n/v | n/a | |
| Battle (training arena) | **F** | **F** | P | P | See Fixed #1 |
| Pets | P | P | P | audit only | |
| Forge | P | P | P | audit only | |
| Fusion | P | P | P | audit only | |
| Store | P | P | n/v (audit clean) | audit only | |
| Settings (Display / Comfort / Account groups) | P | P | P | P | |
| More sheet | P | **F** | P | n/a | See Fixed #2 |
| Bottom bar / side rail / top bar | P | P | P | P | No black bands, no misaligned items, balance chips fit |

"audit only" = no horizontal overflow or clipping found by the in-page audit; not inspected by screenshot at that size.

## Fixed
1. **Battle: enemy Core label hidden under the top HUD** (portrait and landscape phones). The renderer sized the arena to the whole field, but the 77px top bar (clock, buttons, Core bars) is an overlay on it, so the enemy Core's HP label slid under the bar (in landscape it overlapped the clock). `js/combat/render.js` gains an optional `topInset` render option; `resize()` reserves that many pixels at the top with `camera.setViewOffset` (the arena is fitted to the remaining height, tapping still uses the same projection through the raycaster). `js/screens/battle.js` passes the top bar's height when the field is shorter than 640px, which covers phone portrait/landscape. Desktop (field 717px tall at 1440x900) and the iPad (field taller than 640px) are untouched.
2. **Bottom sheets did not fill their width** (visible in phone landscape More sheet, tiles bunched into the left half). `stage.css` styles the specimen-sheet class `.sheet` (2-column grid, `.sheet > div` flex row with `align-items: baseline`), and the bottom-sheet wrapper `.modal-wrap.sheet` and its `.modal` carry the same class, so they inherited it. `css/mobile.css` now resets the grid, alignment, gap, padding and border for `.modal-wrap.sheet` and its `.modal`. Affects every bottom sheet (More, Vault filters, Deck Add/Swap, Forge/Fusion pickers).
3. `sw.js` re-stamped (precached CSS/JS changed).

## Still open / could not verify
- **Real touch device.** Coarse-pointer sizing and 44px targets were checked with the forced media queries, not on a touch screen. Synthetic pointer events only; no finger lift, multi-touch or rubber-banding. See the iPhone checklist in `MOBILE_PHASE.md`.
- **Sync pill ("Saved locally")** floats bottom-right and covers a little content on short screens (landscape Settings, Store price buttons, Home ledger). By design and scrolls away with content; left alone. Its own tap target is 98x22px.
- **Inspect on "Missing Texture"**: the artwork draws its own "MISSING_TEXTURE / error" label inside the 3D scene at the top of the stage, which overlaps the "01 / 26" position counter. It is part of the model, not DOM; not changed.
- Not re-shot at every size: Vault sub-views (Binder, Families, Duplicates, Timeline, History, Sets, Codex, Compare), Open Hall rituals and reveals, Battle with a Pet selected / aiming, battle result screen, signed-in cloud panel, first-run onboarding. These were covered in Mobile A/B/C.
- Pet/Forge/Fusion/Store/Deck/Combat at 1440x900 were audited mechanically (no overflow) but not screenshotted; Home, Vault, Battle and Settings were.
- Only 402x874, 874x402, 820x1180 and 1440x900 were run (as asked); 375x667 and 360px-wide phones were not.
