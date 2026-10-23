# Aethervault desktop app (Distribution Subphase E)

A Tauri 2 shell that hosts the **same shared frontend** as the website and PWA, delivered as a Windows NSIS installer. No gameplay changes. Auto-updates (F) and release automation (G) are not part of this subphase.

## Layout

| Path | Role |
|---|---|
| `src-tauri/tauri.conf.json` | App config. Identifier `app.aethervault.desktop`, NSIS only, per-user install (no admin prompt). |
| `src-tauri/src/lib.rs` | The whole Rust side: single-instance guard, system-browser sign-in loopback, `open_external`. |
| `src-tauri/capabilities/default.json` | `core:default` only. The page gets no filesystem, shell or HTTP plugin access. |
| `src-tauri/icons/` | Generated from `icons/icon-512.png` (`npx --prefix tools tauri icon icons/icon-512.png -o src-tauri/icons`). |
| `tools/tauri-stage.mjs` | `beforeBuildCommand`: copies exactly `index.html`, `manifest.webmanifest`, `css/ js/ vendor/ icons/ music/` into `src-tauri/dist` (git-ignored). `sw.js` is left out. |
| `js/platform/desktop.js` | `AV.desktop` bridge (`isDesktop`, `invoke`, `listen`). Inert in a browser. |
| `tools/tauri-verify.mjs` | Drives the built EXE over WebView2's debug port with a throw-away profile. |

The shared frontend changed only where the desktop genuinely differs: one script tag (`desktop.js`), `js/pwa.js` (service worker off in desktop), `js/platform/auth.js` (desktop sign-in), and the Settings wording for "Install & updates". Web behaviour is unchanged.

## Build

Prerequisites (verified on this machine): Rust (MSVC toolchain), Visual Studio Build Tools with the Windows SDK, WebView2 runtime, Node. The Tauri CLI is a dev dependency of `tools/` (`cd tools && npm install`); Tauri downloads NSIS itself on first build.

```bash
npx --prefix tools tauri build
```

Output: `src-tauri/target/release/aethervault.exe` and `src-tauri/target/release/bundle/nsis/Aethervault_<version>_x64-setup.exe`. Run it from the repo root (the CLI finds `src-tauri/` below the working directory).

Before building, keep the version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` equal to `AV.VERSION.number` in `js/util.js`.

## Why sign-in needed its own flow

AUTH.md noted `AV.auth.supported` was false in the Tauri window. On Windows the shell origin is actually `https://tauri.localhost` (not `tauri://`), so the web flow would have *looked* supported, but it cannot work: Google blocks OAuth inside embedded webviews, and the redirect URL would have to be the app origin.

**Flow (RFC 8252, system browser + loopback):**

1. Settings → Account → *Sign in with Google* calls the Rust command `auth_listen`, which binds `127.0.0.1` on a random port and waits (max 10 min, one connection that carries `code` or `error`).
2. The page builds the same PKCE authorize URL as the web flow, with `redirect_to=http://127.0.0.1:<port>/`, and asks Rust to open it in the default browser (`open_external`, https only).
3. After Google and Supabase, the browser lands on the loopback listener, which answers a static "You can return to Aethervault" page (the code is never echoed) and emits the `av-auth-callback` event with the query string.
4. `auth.js` verifies it started a sign-in (the PKCE verifier is stored), exchanges the code at Supabase, and stores the session exactly as on the web. Cloud saves (CLOUD_SAVES.md) then work unchanged.

The listener checks method, path (`/`), `Host` header (anti DNS-rebinding), and presence of `code`/`error`; anything else gets a 404 and the wait continues. Pressing the button again restarts the attempt and cancels the previous listener. Security rests on PKCE: a code injected by another party cannot be exchanged without our verifier.

### MANUAL GATE (owner): Supabase redirect allow-list

Add this entry in **Supabase → Authentication → URL Configuration → Redirect URLs**:

```
http://127.0.0.1:*/**
```

Until then, desktop sign-in will complete in the browser but Supabase falls back to the Site URL (the website), and the desktop app times out waiting; nothing breaks and no data is exposed. The existing website entries stay as they are. No Google Cloud change is needed (Google redirects to Supabase, not to the app).

## Decisions that must not change casually

- **`identifier` = `app.aethervault.desktop`** and **`useHttpsScheme: true`** fix the WebView2 profile folder (`%LOCALAPPDATA%\app.aethervault.desktop`) and the origin `https://tauri.localhost`. The save lives in that origin's `localStorage`; changing either orphans every player's save. Future updates (Subphase F) keep both.
- **Single instance:** two copies would share one profile and could overwrite the save, so a second launch just focuses the first window.
- **Service worker off in desktop:** the files are inside the EXE; the PWA update banner would be wrong here. Subphase F will provide desktop updates.
- **CSP** in `tauri.conf.json` allows only the app itself plus `https://*.supabase.co` for connections (`'unsafe-inline'`/`'unsafe-eval'` remain because the game uses inline handlers and Three.js).
- **Music** (28 MB) is embedded in the EXE, so the desktop app plays music offline.

## Music and HTTP Range

Tauri serves embedded assets without `Range` support, so `<audio>` could play but not seek or loop (the music uses `loop = true`). `serve_ranges` in `lib.rs` (attached with `on_web_resource_request`; the window is therefore built in code from the config, `"create": false`) answers range requests for audio/video from the in-memory body. Verified: play, seek and loop work.

## Test record (2026-10-23)

- `cargo test` in `src-tauri`: 2 passed (loopback request parsing).
- `node tools/tauri-verify.mjs` against the release EXE (throw-away WebView2 profile): **19 passed, 0 failed**. Covers: origin `https://tauri.localhost`, secure context, game reaches Home, service worker inert, auth configured/supported/desktop, music play/seek/loop, loopback listener (404 for noise, accepts callback, done page does not echo the code, one-shot), `open_external` rejects non-https, a started sign-in reaches the Supabase token exchange and fails cleanly with a fake code, an unsolicited callback is ignored, Settings wording, second launch exits (single instance), save survives restart, no page errors.
- Web regressions: logic 45, phase3 22, phase4 30, combat 99, `cloud-test` 70 (Chrome, mock Supabase), `pwa-stamp --check` OK.
- Installer built: `src-tauri/target/release/bundle/nsis/Aethervault_0.6.1_x64-setup.exe` (~30 MB). **Not installed or run** (manual gate). Do not run the verify script while a build is bundling: the bundler holds the EXE.

## Owner acceptance (2026-10-23)

The owner added the Supabase redirect `http://127.0.0.1:*/**`, installed `Aethervault_0.6.1_x64-setup.exe` and tested the installed app: Google sign-in opened in the system browser and returned to the EXE, the account email is shown, cloud saves work, local saves persist across restarts, and the 3D and combat flows work. **Subphase E accepted.** The manual gates above are closed.

## Limitations

- Unsigned installer: Windows SmartScreen will warn on first run (manual gate, expected until a certificate exists).
- Windows only. The installer is unsigned (SmartScreen warning expected).
