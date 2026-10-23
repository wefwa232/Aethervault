# Distribution Phase

One shared Aethervault codebase delivered as a Vercel website, an installable PWA, and a Tauri 2 Windows EXE, with optional Google sign-in and local-first cloud saves. No gameplay changes; Combat C is not part of this phase.

## Audit (2026-10-23, start of Subphase A)

| Item | Finding |
|---|---|
| Repo root | `G:/User/Documents/CLAUDE/havingfun` |
| Branch / HEAD | `phase-five` @ `50605cd` (one local commit was ahead of origin; pushed during audit) |
| Working tree | clean before this phase's edits |
| Remote | `https://github.com/wefwa232/Aethervault.git` |
| **Visibility** | **PUBLIC** (the phase brief said Private; GitHub reports `PUBLIC` and `GITHUB_PUBLISHING.md` records the owner's change on purpose). Default branch is `phase-five`. The brief's "keep private" requirement is therefore **not currently true**; decision needed from the owner before relying on it. |
| Tags | `phase-three-complete`, `phase-four-complete`, `phase-five-combat-a`, `phase-five-combat-b` |
| GitHub auth | `gh` logged in as `wefwa232` (scopes: repo, workflow, read:org, gist) |
| Vercel CLI | not installed at start; `vercel` 65.2.0 installed globally. **Not authenticated** (stored token invalid) |
| Rust | rustc/cargo 1.95.0 present. Tauri prerequisites (WebView2, MSVC build tools, tauri-cli) not yet verified |
| Supabase | no project, no configuration in repo |
| Vercel project | none linked (`.vercel/` absent) |
| PWA files | none (no manifest, no service worker, no icons beyond inline SVG favicon) |
| Package files | only `tools/package.json` (dev-only puppeteer-core). Game has no build step |
| Save schema | v4 (localStorage); migration backups under `…backup-p3/p4/p5/fusion` keys |
| Runtime tree | `index.html`, `css/`, `js/` (85 files, plain script tags), `vendor/` (three.min.js, woff2 fonts), `music/` (4 MP3, ~28 MB). 3D models are procedural; no glb/images at runtime |
| Non-runtime | `docs/` (~229 MB screenshots), `tests/`, `tools/`, `dev/`, `*.md`, `serve.mjs`, `.bat` |

### Defect found and fixed in Subphase A
`js/audio.js` requests `music/background music/*.mp3` but the folder was tracked as `MUSIC/`. This works on Windows (case-insensitive) and would 404 on Vercel (Linux). The directory was renamed to `music/` with `git mv`. A case-sensitivity scan of every `src`/`href`/`url()`/string path under `index.html`, `css/`, `js/` found no other mismatches.

## Architecture

```
            ┌──────────────── shared frontend (index.html, css/, js/, vendor/, music/) ────────────────┐
 Vercel static site (HTTPS) ── PWA (manifest + service worker) ── Tauri 2 WebView2 shell (Windows)
            │                                   │                              │
            └──────── optional Supabase Auth (Google) + RLS tables: profiles, cloud_saves, save_backups
Local save (schema v4, localStorage) stays authoritative; cloud sync is queued, versioned, never blocking.
```

Platform-specific code stays isolated (`src-tauri/`, `js/platform/`), browser/PWA operation preserved, `serve.mjs` retained for local dev.

## Subphases and checkpoints

| Subphase | Scope | Checkpoint tag |
|---|---|---|
| A | Vercel static deployment | `distribution-a-vercel` |
| B | Installable PWA, controlled updates | `distribution-b-pwa` |
| C | Supabase Auth (Google), optional | `distribution-c-auth` |
| D | Local-first cloud saves, RLS, conflicts, backups | `distribution-d-cloud-saves` |
| E | Tauri 2 Windows NSIS EXE | `distribution-e-tauri` |
| F | Signed Tauri auto-updates | `distribution-f-updater` |
| G | Unified release pipeline (tags / manual dispatch only) | `distribution-g-release` |

Canonical app version, save schema separate from app version, and unsafe-downgrade write rejection are handled starting in B and enforced in D–G.

## Manual gates

- Vercel login / GitHub app authorization / account (Subphase A) — **active**
- Supabase project creation, Google OAuth client, redirect URLs (C)
- GitHub repository secrets, Tauri updater key backup (F, G)
- Windows installer approval, SmartScreen (E, F)
- Any paid service or certificate; any destructive cloud-data operation

## Acceptance criteria

Per the phase brief: each subphase committed, pushed, documented, app runnable, tests and limitations recorded, exact next-session opener provided. Subphase A specifically: public HTTPS production URL serving the app, Git pushes to `phase-five` auto-deploy, no localhost or case-related 404s, all listed screens verified in Chrome, `VERCEL_DEPLOYMENT.md` written.

## Progress log

- 2026-10-23 — Audit done. Pushed `50605cd` to origin. Fixed `MUSIC/`→`music/` case defect. Added `vercel.json`, `.vercelignore`, `.gitignore` entries. Installed Vercel CLI. **Blocked on Vercel login (manual gate).**

- 2026-10-23 — Vercel login done. Project `aethervault` created and linked to `wefwa232/Aethervault`; SSO protection disabled; Git deployments enabled. Production deployed: https://aethervault-six.vercel.app. Verified in the built-in Chromium pane (Chrome extension was offline); details in `VERCEL_DEPLOYMENT.md`. Production Branch could not be set via API; the owner set it to `phase-five` in the dashboard and it was confirmed via API. A push to `phase-five` now deploys to Production.

- 2026-10-23 — Subphase B built: manifest, icons, hash-versioned service worker (`sw.js` stamped by `tools/pwa-stamp.mjs`), controlled updates, offline relaunch, safe-area insets, Settings → Install & updates. Locally verified; see `PWA.md`.

- 2026-10-23 — Subphase C complete: real Google sign-in verified on production, tagged `distribution-c-auth`. Code built: optional Supabase Auth (Google, PKCE, no SDK), Settings → Account, mock server for tests. Verified against the mock; **blocked on the manual gate** (Supabase project + Google OAuth client). See `AUTH.md`.

- 2026-10-23 — Subphase D complete: cloud-save schema/RLS/RPCs designed, reviewed and applied by the owner (52/52 in-database tests); client built (`js/platform/cloud.js`, `cloud-ui.js`) and verified 70/70 in Chrome against a mock Supabase; live anon-denial probe passes. See `CLOUD_SAVES.md`.

## Subphase A status

Deployed and verified, with one open item: repeat the screen walk in desktop Chrome.

## Subphase B status

Built and verified locally; production verification and device install checks recorded in `PWA.md`.

## Subphase C status

Complete and tagged `distribution-c-auth`. Verified against the mock and with a real Google sign-in on production. Details in `AUTH.md`.

## Subphase D status

Complete and tagged `distribution-d-cloud-saves`. Opt-in, local-first, conflict-safe cloud saves. Details, test record and limitations (no real signed-in cloud walk yet; real SW sync event untested) in `CLOUD_SAVES.md`.

## Next-session opener

> Continue Aethervault Distribution Phase from DISTRIBUTION_PHASE.md. Subphases A, B, C (AUTH.md) and D (CLOUD_SAVES.md) are complete; tag distribution-d-cloud-saves. Begin Subphase E only: the Tauri 2 Windows NSIS EXE. Reuse the shared frontend unchanged; keep desktop code in src-tauri/ and js/platform/. Resolve first the tauri:// sign-in flow noted in AUTH.md (AV.auth.supported is false there, and cloud saves depend on it). Do not begin auto-updates (F), release automation (G), Combat C, or gameplay changes.

## Known risks

- Repo is public, contrary to the brief; any "private repo" assumption (e.g. Vercel Hobby plan restrictions on private/team repos) must be re-checked once the owner decides.
- `music/` is ~28 MB and loaded on demand; first-visit bandwidth matters for the later PWA precache plan (do not precache it).
- Script-tag architecture with unversioned file names relies on revalidation (`ETag`) rather than hashed names; the PWA service worker must not cache JS/CSS cache-first without versioning.
- Lowercase/uppercase path mismatches are invisible on Windows; re-run the case scan before each release.
