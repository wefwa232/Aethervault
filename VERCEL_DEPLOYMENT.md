# Vercel Deployment

Aethervault is deployed as a plain static site. No framework, no build step, no environment variables.

| Item | Value |
|---|---|
| Production URL | https://aethervault-six.vercel.app |
| Vercel project | `aethervault` (scope: personal Hobby account) |
| Source repo | `wefwa232/Aethervault` (**public** by the owner's choice; Subphase A's brief assumed private) |
| Framework / build | none / none (`vercel.json`: `framework: null`, `buildCommand: null`, `outputDirectory: "."`) |
| Root directory | repository root |
| Deployment protection | disabled (Vercel Authentication off) so the site is publicly reachable |
| Git integration | connected, `createDeployments: enabled` |
| Production branch | `phase-five` — see **Production branch status** below |

## What is deployed

`.vercelignore` limits uploads to the runtime tree: `index.html`, `css/`, `js/`, `vendor/` (Three.js and fonts), `music/`. Excluded: `docs/` (~229 MB of screenshots), `tests/`, `tools/`, `dev/`, `.claude/`, `*.md`, `*.bat`, `serve.mjs`. 3D models are procedural, so there are no model files. Excluded paths return 404 on the live site (checked: `/DISTRIBUTION_PHASE.md`, `/tests/x`).

## Headers (`vercel.json`)

- `/` and `/index.html`: `Cache-Control: public, max-age=0, must-revalidate` — a new deployment is picked up on the next load.
- `/vendor/fonts/*` and `/music/*`: `max-age=2592000` (30 days).
- Everything else keeps Vercel's default (`max-age=0, must-revalidate`, validated by ETag), which suits the unversioned script tags.
- `X-Content-Type-Options: nosniff` on all paths.

## Case-sensitivity fix

Vercel serves from a case-sensitive Linux filesystem. `js/audio.js` requests `music/background music/…` but the folder had been tracked as `MUSIC/`. It was renamed to `music/` (`git mv`). A scan of all `src`/`href`/`url()`/string paths found no other mismatches. Re-run before releases; this is invisible on Windows.

## Verification (2026-10-23)

Done in the Claude desktop app's built-in Chromium browser pane, because the Claude in Chrome extension was not connected. **A pass in desktop Google Chrome itself is still outstanding** (low risk: same engine, but it was not literally Chrome).

| Check | Result |
|---|---|
| Anonymous HTTPS access (no login) | 200 on `/`, JS, fonts, MP3 |
| Boot / Home | Loaded; 80+ requests all 200; no localhost or third-party origins |
| Open Hall | Opened Wanderer Pack, Hatchling Egg ×1 and ×5; 3D pets rendered |
| Vault, Pets, Forge, Fusion | Rendered with populated content, no errors |
| Cards / Binder | 5+ cards shown in Vault/Forge/Fusion lists; dedicated Binder screen not separately exercised |
| Combat Hub, Deck editor | Rendered; recommended-starter deck built (6/10, practice-usable) |
| Training Arena | Started; deployed a pet (Elixir 5→2, hand cycled) |
| Local save + reload | Save schema v4 in `localStorage`; 16 specimens and credits survived a full reload |
| 3D rendering | Three.js canvases render (eggs, pets, arena) |
| Audio requests | `music/background%20music/*.mp3` return 206 (range). `ERR_ABORTED` on these is the browser cancelling media streams, not a failure |
| Console | Only the pre-existing Three.js `build/three.min.js` deprecation warning; no errors, no unhandled rejections |
| Refresh | Fine |

Not tested: real audio output (silent pane), Ranked ladder, Fusion execution, Forge upgrades, deck of full 10 (6 was enough for practice).

## Operations

Redeploy manually: `vercel deploy --prod`. Pushes to the production branch deploy automatically; other branches get preview URLs.

### Production branch status

The Vercel project was created with Production Branch `main`; the API calls tried (project PATCH, link POST) refused to change it. **Set it once in the dashboard:** Project `aethervault` → Settings → Environments → Production → Branch Tracking → `phase-five`. Until then, pushes to `phase-five` produce *preview* deployments, and production is updated only by `vercel deploy --prod`.

## Limitations

- Preview URLs on a public repo are public (protection is off project-wide).
- Hobby plan: personal, non-commercial use.
- No custom domain yet.
