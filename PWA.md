# Aethervault PWA (Distribution Subphase B)

Installable, offline-capable, with updates that only happen when the player asks.

## Files

| File | Role |
|---|---|
| `manifest.webmanifest` | Name, `standalone` display, colours, icons. Relative `start_url`/`scope` (`./`) so it works under any root. |
| `icons/` | `icon-192`, `icon-512` (any), `icon-maskable-512`, `apple-touch-icon`, `icon.svg`. Regenerate with `node tools/make-icons.mjs` (no dependencies). |
| `sw.js` | Service worker. The `PWA:BEGIN…END` block is generated; never edit it by hand. |
| `js/pwa.js` | Registration, update banner, install prompt capture. Exposes `AV.pwa`. |
| `css/pwa.css` | Update banner + safe-area insets. |
| `tools/pwa-stamp.mjs` | Regenerates the precache list and content hash in `sw.js`; `--check` fails if stale. |
| Settings → Install & updates | Install button, status, "Check for updates", "Update now". |

## How versioning works

- `node tools/pwa-stamp.mjs` lists every shell file (everything `index.html` references, all fonts, icons, manifest) and hashes their contents (CRLF-normalised). Cache name = `av-shell-<AV.VERSION.build>-<hash12>`.
- Any change to any shell file therefore changes `sw.js` bytes, so browsers see a new worker. **Run the stamp before every commit that touches shell files** (`--check` exits non-zero if you forgot; wire it into the Subphase G release gate).
- The shell is cached **cache-first from its own versioned cache**, so unversioned `<script>`/`<link>` files can never mix versions.
- Music (`music/`, ~28 MB) is deliberately **not** precached and not intercepted: it streams from the network (range requests), so music needs a connection. Fonts and Three.js are precached.

## Controlled updates

1. New worker installs in the background (all-or-nothing `addAll`; a failure leaves the current version untouched). It does **not** `skipWaiting`.
2. The page shows an "Update ready" banner (and Settings shows an Update now button). The running session keeps its version.
3. "Update now" posts `SKIP_WAITING`; on `controllerchange` the page reloads once. Old caches are deleted on activate. Saves live in `localStorage`, which is untouched by updates.
4. "Update now" is disabled while `body[data-screen=battle]`, so a battle is never cut short.
5. The page checks for updates on load, when it becomes visible again, and hourly.

## Offline relaunch

After the first online visit, the app launches with no network (verified by stopping the server and reloading). Navigations are answered with the cached `index.html`.

## Safe areas

`viewport-fit=cover` was already set. `css/pwa.css` defines `--sa-t/r/b/l/y` from `env(safe-area-inset-*)`; `#app`, toasts, modals, boot footer, the update banner and the viewport-height-based layouts (`.fz`, `.filters`, `.bench`, `.deck-pick`, full-screen modals) respect them; the backdrop stays full-bleed.

## Development

- On `localhost` the worker is **off by default** (the dev server sends `no-store`; a cache-first worker would hide edits). `?sw=1` opts in (remembered in `localStorage` key `av.sw`); `?sw=0` unregisters and deletes the caches.
- Only `http(s)` origins register a worker; the future Tauri shell (`tauri://`) will not (Subphase E).

## Tested (2026-10-23)

Chromium (built-in pane), localhost with `?sw=1`: registers, 90 files precached, controls page; offline relaunch with server stopped; update flow (new worker waits, old version keeps serving, "Update now" swaps and reloads, old cache removed); `?sw=0` cleanup; simulated 44/34/47/47 px insets move `#app` accordingly; 4 existing test suites pass (99/45/22/30).

## Not verified / limitations

- Real install prompt, installed-window launch, maskable-icon rendering on a device, iOS "Add to Home Screen": need a real device/Chrome (open item for the owner).
- Safe areas are checked by forcing the CSS variables; no physical notched device.
- No offline music; first visit must be online.
