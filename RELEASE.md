# Release pipeline (Distribution Subphase G)

Workflow: `.github/workflows/release.yml`. It publishes the signed Windows installer and the updater manifest to a GitHub Release. The website is **not** part of it: Vercel keeps deploying `phase-five` to production on every push, as before.

## Triggers (and only these)

- push of a tag matching `vX.Y.Z` (the tag commit must be on `phase-five`), or
- manual run of *Desktop release* from the Actions tab, on `phase-five`.

Ordinary branch pushes and PRs never run it. The build job also waits for an **approval** (environment `desktop-release`), so even a stray tag cannot sign anything without you.

## One canonical version

`AV.VERSION.number` in `js/util.js` is the source. `node tools/version.mjs check [--tag vX.Y.Z]` fails unless `src-tauri/tauri.conf.json`, `Cargo.toml`, `Cargo.lock` and the tag all equal it; the release job runs it, and `latest.json` and the GitHub Release (`vX.Y.Z`) take the version from the same files. Bump with `node tools/version.mjs set X.Y.Z` (also restamps `sw.js`). A release must be strictly newer than the latest published one and must not already exist.

## Cutting a release

```bash
node tools/version.mjs set 0.6.2
git commit -am "release: 0.6.2" && git push origin phase-five
git tag v0.6.2 && git push origin v0.6.2
```

then approve the run in GitHub (Actions → the run → *Review deployments*). Published assets: `Aethervault_<v>_x64-setup.exe`, its `.sig`, and `latest.json`.

## Secrets

Environment `desktop-release` secrets: `TAURI_SIGNING_PRIVATE_KEY` (required) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (optional; the current key has no password, so the secret is absent and the workflow unsets the variable). The workflow never prints them (they are masked by GitHub and only given to the build step, whose output is shown only on failure via `tail`). Setup steps are given in chat; the key is never handled by Claude.

## Status

Subphase G complete. v0.6.2 was the first release cut by this pipeline (tag-triggered, approved in the `desktop-release` environment). The owner then updated a real installed 0.6.1 to 0.6.2 in-app with saves, sign-in and cloud sync intact; see UPDATER.md. Tamper test: 8/8. Ordinary pushes do not start the workflow (confirmed). Vercel production deployment from `phase-five` is unchanged.

Standing rules: never delete or move a published `v*` tag (the ruleset blocks it); never regenerate the updater key; keep identifier `app.aethervault.desktop` and `useHttpsScheme: true`.
