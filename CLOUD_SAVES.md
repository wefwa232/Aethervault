# Cloud saves (Distribution Subphase D)

Local-first, optional, per device and account. **Status: complete.** Database applied and verified on the real Supabase project (52/52 in-database tests); client verified end to end against a mock server that mirrors the same contract (70/70 browser checks). A signed-in, real-account walk on production is listed under *Not verified*.

## Principles

1. The local save (`aethervault.save.v1`, schema v4) is always authoritative and written first. Sync runs afterwards and can fail without consequence.
2. Nothing is replaced silently. Turning sync on, a newer cloud copy and every conflict need an explicit choice.
3. Before either side is replaced, the outgoing version is preserved (local safety copy and/or cloud backup). If neither could be written, nothing is replaced.
4. Signed-out, offline and local-only players lose nothing. Not signed in → zero network calls.

## Files

| File | Role |
|---|---|
| `supabase/cloud_saves.sql` | Tables, RLS, grants, RPCs (applied by the owner in the SQL Editor). |
| `supabase/cloud_saves.test.sql` | 52 in-database tests with two fake users; ends with an intentional error that rolls everything back. |
| `supabase/test/run-local.mjs`, `stub-supabase.sql` | Runs both SQL files in PGlite (`PGLITE_DIR=<dir with npm i @electric-sql/pglite>`). |
| `supabase/test/anon-probe.mjs` | Probes the live project with only the public anon key; every table and function must refuse. |
| `js/platform/cloud.js` | `AV.cloud`: engine (snapshot, checksum, validation, sync loop, conflict logic, backups, retry). |
| `js/platform/cloud-ui.js` | Settings → Account → Cloud saves panel and dialogs. |
| `js/state.js` | One line: emits `saved` on the bus after each successful local write. |
| `sw.js` | `sync` event handler: wakes an open page; holds no credentials. |
| `tools/mock-supabase.mjs`, `tools/cloud-test.mjs` | Mock server and browser test (puppeteer, two incognito contexts as devices A/B). |

## Database

| Object | Purpose |
|---|---|
| `cloud_saves` | One **head** row per user: `revision`, payload, SHA-256 `checksum`, `save_version`, `app_build`, last-writer `device_id`/`device_name`, small `summary`. |
| `save_backups` | Up to 12 older versions. Reasons `replaced`, `local-preserved`, `cloud-preserved`, `manual`. |
| `av_cloud_push` | Compare-and-swap on `revision` → `ok` / `conflict` / `rejected`. |
| `av_cloud_backup_put` | Store a version as a backup without touching the head; deduplicated by checksum. |
| `av_cloud_delete_all` | Delete the caller's head and backups. |

**Why it is safe:** RLS on with one `select`-own policy per table and no write policies; `anon` holds no privileges; `authenticated` has `SELECT` only; all writes go through `SECURITY DEFINER` functions with `search_path = ''` that act only on `auth.uid()` and take no user-id parameter; execute is revoked from `public`/`anon`. `FORCE ROW LEVEL SECURITY` is deliberately not used (the functions rely on the owner bypass).

Backups of the old head are taken when a *different device* replaces it, on a schema upgrade, or when it is over 6 h old, so routine same-device pushes don't flood history.

## Device identity

`localStorage['av.device']` = `{ id (uuid), name }`, e.g. “Chrome on Windows”. Sent with each write and shown in compare dialogs (always HTML-escaped). It identifies a browser profile, not a person.

## Link state (`localStorage['av.cloud']`, never exported, never inside the save)

`{ user, enabled, base: {revision, checksum}, lastSyncAt, lastError, needsPreserve }`. `base` is “what this device last synced”. A different account signing in on the same browser does **not** inherit the link (`user` must match), so one account’s save is never uploaded to another.

## Sync algorithm

Every run: snapshot local (canonical JSON → SHA-256), read the cloud head metadata, compare with `base`.

| Local changed | Cloud changed | Result |
|---|---|---|
| no | no | idle |
| yes | no | push with `p_base_revision = base.revision` |
| no | yes | **cloud-newer**: offer “Load cloud version…” (never applied automatically: it would swap the state under a running session) |
| yes | yes | **conflict**: explicit decision (identical checksums = no conflict) |
| cloud row missing but `base > 0` | | **cloud-deleted**: explicit decision |
| local is an empty archive, cloud has progress | | **reset**: explicit decision (so “Reset all progress” can never wipe the cloud copy) |

After an **import** or **reset**, `needsPreserve` makes the next push first back up the current cloud version. Rejections (`downgrade`, validation) never retry blindly and never touch local data.

**Triggers:** debounce 30 s after the last save (max wait 3 min); on tab hidden if dirty; on `online`; on becoming visible (≥ 60 s since last run); every 5 min while visible; on a service-worker Background Sync wake-up; manual **Sync now**. Offline/5xx/429 → status *offline* and exponential backoff 15 s → 15 min. Timings can be overridden on localhost only via `localStorage['av.cloud.timing']` (tests).

**Concurrency:** one run at a time per tab; `navigator.locks` (`av-cloud`) across tabs.

## Decisions the player sees

- **Turn on cloud saves…** — cloud empty: confirm upload. Local empty + cloud has data: confirm download. Both identical: link silently (nothing differs). Both differ: Compare dialog → *Keep this device* / *Keep cloud version* / *Not now*.
- **Resolve…** (conflict, reset, cloud-deleted), **Load cloud version…** (cloud-newer).
- **Compare…** side-by-side: collector, specimens, level, credits, gems/essence, combat, device and time of the cloud save.
- **Cloud backups…** list (reason, device, time, specimens, level) → **Restore…** (preserves the current local and cloud versions first, applies, then pushes as a new revision).
- **Turn off on this device**, **Delete cloud data…** (type `DELETE`; local save untouched), **Sign out** (local save untouched).

Whichever version loses is preserved first: a rolling set of up to 3 local safety copies (`aethervault.save.v1.backup-sync.<ms>.<local|cloud>`; recoverable from the console or by Import after copying out) plus a cloud backup.

## Validation and schema compatibility

Client (`validate`): object with `wallet` (finite numbers) and `specimens` (objects with a string `base`), integer `version` ≤ `SAVE_VERSION`, survives `AV.state.migrate`; downloaded payload's checksum must equal the stored checksum (tamper/corruption → refused, local untouched). Server repeats shape/size (≤ 3 MB)/version/checksum-format checks and rejects pushes that lower `save_version`.
- Cloud save from a **newer** app → status *blocked*, “update the app”; nothing overwritten either way.
- Older cloud save → migrated by the normal chain when loaded; the migrated version then syncs as the next revision.
- Sync is blocked (not the game) when this device's own save failed to load or migrate, so a damaged save is never uploaded.

## PWA background synchronization

When a push fails for connectivity, the page registers Background Sync tag `av-cloud-sync` (Chromium only; feature-detected). On the `sync` event the service worker only `postMessage`s an open window, which runs its normal sync. The worker never holds tokens, and with no open window nothing happens; the next launch syncs. Safari/Firefox rely on `online`/visibility triggers.

## Tested

- **Database (real project):** `cloud_saves.test.sql` 52/52; also 52/52 and 12 expected failures under a deliberately weakened policy in PGlite. `anon-probe.mjs`: all six probes denied (HTTP 401, `42501 permission denied`).
- **Browser (`node tools/cloud-test.mjs`, mock server, synthetic saves, 70/70):** local-only user makes no request off the local server; explicit upload (nothing sent until confirm, local byte-identical after); dirty status and 5 rapid saves → 1 push; download on a second profile with safety copy; offline queue and reconnect; Background Sync message; cloud-newer (not auto-applied); conflict → Keep cloud (both-sides preserved, safety copy holds the overwritten values); conflict → Keep this device; reset guard; import preserves the cloud version; restore backup; tampered, shape-corrupt and newer-schema copies refused; 503 outage and recovery; sign-out keeps the save and sends nothing; other account sees nothing and receives nothing; sign back in resumes; wrong delete confirmation deletes nothing, correct one deletes head and backups; no page errors.
- Existing suites unchanged: 45 / 22 / 30 / 99 pass; `pwa-stamp --check` OK.

## Not verified / limitations

- **No real signed-in cloud walk yet.** RLS and RPC behaviour are proven in-database, and the client against a contract-equivalent mock, but a real Google session pushing to the real project from production has not been exercised (it would use the owner's real account). Suggested check: sign in on production, *Turn on cloud saves*, then *Delete cloud data…* if only testing.
- **The real service worker `sync` event was not exercised** (the SW is off on localhost by default); the page-side handler was tested by dispatching the message.
- Chrome is the only browser exercised. Safari/iOS and Firefox are untested.
- The payload is not client-side encrypted; it is protected by RLS and TLS.
- Settings (volumes, quality) are part of the save and therefore sync across devices.
- Two tabs of one browser share one save and one link; the lock prevents concurrent syncs but not two tabs editing at once (pre-existing behaviour of the local save).
- No per-user rate limit in SQL; worst-case storage per user ≈ 13 × 3 MB.
- `tauri://` windows are not supported (Subphase E).
