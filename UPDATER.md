# Signed desktop updates (Distribution Subphase F)

The Windows app can update itself from a signed installer published as a GitHub Release. No gameplay changes; the web site and PWA are untouched (they keep their own update path, see PWA.md).

## How it works

- **Plugin:** `tauri-plugin-updater`, called only from Rust (`update_check`, `update_install` in `src-tauri/src/lib.rs`). The page gets no updater permission; `capabilities/default.json` is unchanged (`core:default`).
- **Endpoint:** `https://github.com/wefwa232/Aethervault/releases/latest/download/latest.json` (`plugins.updater.endpoints`). The repo is public, so no token is needed.
- **Signature:** every update installer must carry a minisign signature that verifies against the public key in `tauri.conf.json` (`plugins.updater.pubkey`). A tampered or unsigned installer is rejected before it runs. Updates are accepted only when the manifest version is strictly newer than the running app, so the updater cannot downgrade.
- **Player flow:** Settings → Install & updates → *Check for updates*. If a newer version exists the card says so and offers *Install & restart*. Nothing downloads or installs without that click. The button is refused during a battle. Before installing, the game flushes its save (`AV.state.save(true)`). Install mode is `passive` (progress bar, no prompts); the per-user NSIS installer needs no admin rights.
- **Saves survive updates:** the identifier `app.aethervault.desktop` and `useHttpsScheme: true` are unchanged, so the WebView2 profile and `https://tauri.localhost` origin (where the save lives) stay the same.

Page-side code: `AV.desktop.updates` in `js/platform/desktop.js` (state machine: idle, checking, none, available, installing, error) and the card in `js/screens/settings.js`.

## Signing key (MANUAL GATE, owner)

A dedicated key pair was generated on this machine (the unrelated `dreamy-updater` key in the same folder was not touched or reused):

| File | Role |
|---|---|
| `C:\Users\User\.tauri\aethervault-updater.key` | **Private key. Secret. Never commit or paste it.** Created with an empty password. |
| `C:\Users\User\.tauri\aethervault-updater.key.pub` | Public key, already embedded in `tauri.conf.json`. |

**Back the private key up somewhere safe (password manager).** If it is lost, installed apps can never accept another update; the only recovery is for players to reinstall by hand with a new key. Optional hardening: regenerate with a password (`npx --prefix tools tauri signer generate -w <path>`), replace `pubkey` before the first public release, and keep the password in the same place as the key. Changing the key after players have installed a build orphans their updates.

For Subphase G the CI needs two GitHub repository secrets: `TAURI_SIGNING_PRIVATE_KEY` (the key file contents) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (empty or the password).

## Building a signed release (manual, until G automates it)

```bash
export TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/aethervault-updater.key" TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npx --prefix tools tauri build
node tools/updater-manifest.mjs --notes "What changed"
```

`TAURI_SIGNING_PRIVATE_KEY` may be the key text or a path to it (the `_PATH` variant is ignored by `build`). The build writes `Aethervault_<v>_x64-setup.exe` and `.exe.sig`; `tools/updater-manifest.mjs` writes `latest.json` beside them (it refuses to run if `tauri.conf.json` and `js/util.js` versions differ). Publish a GitHub Release tagged `v<version>` with the installer and `latest.json` as assets; `releases/latest` then points the apps at it. Bump the version in `js/util.js`, `tauri.conf.json` and `Cargo.toml` together first, otherwise the updater sees nothing newer.

## Test record (2026-10-23)

- `node tools/tauri-verify.mjs` against the release EXE: **23 passed, 0 failed** (19 from E plus: updates start idle, install without a prior check is refused by the page and by the shell, a check against the real endpoint with no release ends in a clean `error` without throwing, the Settings card renders with its button).
- `cargo test`: 2 passed. `pwa-stamp --check` OK. Signed build produced `Aethervault_0.6.1_x64-setup.exe` and a `.sig`; a sample `latest.json` generated.

## Limits (historical note: the first two items were closed by the acceptance above)

- **No real update has been downloaded, verified and installed.** That needs a published release newer than the installed app, and running the installer would replace the owner's real installation. The first end-to-end check is: publish v0.6.2 as a release, open the installed 0.6.1, press *Check for updates* → *Install & restart*. Until then only the check path (404 handled cleanly) and the signing/manifest tooling are proven.
- The signature path is exercised by the plugin itself (library code), not by an Aethervault-specific test.
- Windows installers are still unsigned (SmartScreen warning); the updater signature is separate from Authenticode.
- The first update needs a build that already contains this updater: the owner's currently installed 0.6.1 does **not**, so it must be reinstalled once from the new 0.6.1+ installer (the profile and save are kept) before it can update itself.

## Tamper test (Subphase G, 2026-10-23)

`tools/updater-tamper-test.mjs` runs a **test-only** EXE (built with `--no-bundle --config` overriding the endpoint to `http://127.0.0.1:9444/latest.json` and `dangerousInsecureTransportProtocol`; it keeps the real public key) against a local server that serves the real v0.6.2 installer in doctored forms. Result: **8 passed, 0 failed**.

| Case | Outcome |
|---|---|
| Correctly signed, newer package | offered (control) |
| Real signature, bytes appended | rejected: "The signature verification failed" |
| Real signature, one byte flipped | rejected: "The signature verification failed" |
| Garbage signature | rejected: "Invalid encoding in minisign data" |
| Valid signature from a different key | rejected: "created with a different key" |
| Same version / older version | not offered (no downgrade) |
| After all rejections | app still running; no installer was launched |

The production binary has no insecure-transport override; only the throw-away test build did.

## First real release

v0.6.2 was built, signed and published by the pipeline (run approved by the owner). Assets: installer, `.sig`, `latest.json`; the key was masked (`***`) in the logs.

## Owner acceptance: real update (2026-10-23)

The owner updated the installed app from **0.6.1 to 0.6.2** through Settings → Install & updates (check, install, restart) using the release published by the pipeline. Confirmed afterwards: Settings shows v0.6.2; local save and collection intact; currencies unchanged; Google sign-in still active; cloud sync works without a conflict; combat opens; install location, shortcut and storage unchanged (same identity); a single app instance. **The real updater path is verified end to end.** The earlier "not yet verified" limits (no real download/install exercised; first update needing a reinstall) are closed.

## 0.6.2 → 0.6.3 (accepted 2026-10-23)

The owner updated the installed app from **0.6.2 to 0.6.3** through Settings → Install & updates (check, install, restart) against the published release. Settings showed v0.6.3; save, specimens and currencies intact; Google sign-in and cloud saves still on; a change went Saved locally → Syncing → Synced; the web/PWA client received it automatically with no conflict dialog; app identity and single-instance unchanged. The tamper test (`tools/updater-tamper-test.mjs`, hard-coded to 0.6.2 file names) was not re-run for 0.6.3; the updater's Rust code was unchanged, and the 0.6.3 installer's signature was checked directly against the public key. Details in `RELEASE.md`.
