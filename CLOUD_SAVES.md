# Cloud saves (Distribution Subphase D)

Local-first, optional, per device and account. **Status: complete.** Database applied and verified on the real Supabase project (52/52 in-database tests); client verified end to end against a mock server that mirrors the same contract (70/70 browser checks). The owner also completed a real-account walk on production (see *Owner acceptance*).

## Principles

1. The local save (`aethervault.save.v1`, schema v4) is always authoritative and written first. Sync runs afterwards and can fail without consequence.
2. Nothing is replaced silently. Turning sync on (once per account per device) and every genuine conflict need an explicit choice. **Superseded for linked devices:** a clean device applies a newer cloud save automatically (see *Linked-device automation* below); a safety copy is always kept first.
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
| no | yes | ~~cloud-newer~~ → **applied automatically** (safe moments only; see *Linked-device automation*) |
| yes | yes | **conflict**: explicit decision (identical checksums = no conflict) |
| cloud row missing but `base > 0` | | **cloud-deleted**: explicit decision |
| local is an empty archive, cloud has progress | | **reset**: explicit decision (so “Reset all progress” can never wipe the cloud copy) |

After an **import** or **reset**, `needsPreserve` makes the next push first back up the current cloud version. Rejections (`downgrade`, validation) never retry blindly and never touch local data.

**Triggers (original; current values are in *Automatic triggers* below — debounce 3 s, poll 60 s):** debounce 30 s after the last save (max wait 3 min); on tab hidden if dirty; on `online`; on becoming visible (≥ 60 s since last run); every 5 min while visible; on a service-worker Background Sync wake-up; manual **Sync now**. Offline/5xx/429 → status *offline* and exponential backoff 15 s → 15 min. Timings can be overridden on localhost only via `localStorage['av.cloud.timing']` (tests).

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

## Owner acceptance (2026-10-23)

The owner tested on production with a real Google account: the PC save uploaded, the same account downloaded it on a second device/browser, and a later change synced back. Cloud saves accepted. **The owner's cloud data must not be deleted**, and the schema must not change unless Subphase E exposes a genuine desktop compatibility requirement.

## Not verified / limitations

- The real-account walk was done by the owner (above); it was not scripted, so exact steps and timings are unrecorded.
- **The real service worker `sync` event was not exercised** (the SW is off on localhost by default); the page-side handler was tested by dispatching the message.
- Chrome is the only browser exercised. Safari/iOS and Firefox are untested.
- The payload is not client-side encrypted; it is protected by RLS and TLS.
- Settings (volumes, quality) are part of the save and therefore sync across devices.
- Two tabs of one browser share one save and one link; the lock prevents concurrent syncs but not two tabs editing at once (pre-existing behaviour of the local save).
- No per-user rate limit in SQL; worst-case storage per user ≈ 13 × 3 MB.
- `tauri://` windows are not supported (Subphase E).

---

# Linked-device automation (Cloud Sync UX polish)

## Audit: why a clean older device used to ask

`core()` classified "local unchanged, cloud changed" as `cloud-newer` and stopped at a toast plus a Settings button (*"never applied automatically: it would swap the state under a running session"*). That conservatism was correct for the first release but makes cross-device play manual: every handover needed Settings → Load cloud version. The first-link choice was also stored as one flat `av.cloud` record, so a second account on the same browser overwrote the first account's link. Pushes waited 30 s (max 3 min) and foreground checks ran at most once per minute.

Everything that was already right stays: compare-and-swap on `revision`, backups before any replacement, schema/checksum validation, RLS, account isolation.

## Link record (per account, per device)

`localStorage['av.cloud']` holds the *active* account's link; links of other accounts used on this browser are stashed in `av.cloud.links` (map by user id) and swapped in when that account signs in, so one account never inherits or overwrites another's link.

`{ user, enabled, base: {revision, checksum}, label, linkedAt, lastSyncAt, lastError, needsPreserve }`
- `base` = last synchronized cloud revision **and** content hash. At the moment of a sync local == cloud, so `base.checksum` is also the last-synchronized local hash.
- `label` = device label at link time (display only; the live label is `av.device`).
- Dirty is **derived**, never trusted: local is dirty iff `sha256(canonical(local)) != base.checksum`.
- Sign-out: `ready()` becomes false (no network calls); the link is kept. Same account again → resumes. Different account → no link.

## Sync state machine

Run (`core`) evaluates `(head, local, base)`; same inputs always give the same result.

| # | Condition | Action | Status |
|---|---|---|---|
| 1 | no head, `base.revision>0` | **cloud-deleted**: local safety copy, never delete local; offer Upload / Continue locally / Keep cloud off | conflict |
| 2 | no head, local pristine | link at revision 0 | idle |
| 3 | no head, local has progress | push base 0 | synced |
| 4 | head.save_version > client | block, local untouched, "update the app" | blocked |
| 5 | head.checksum == local | adopt revision/hash silently | idle |
| 6 | local clean, cloud same revision | nothing | idle |
| 7 | **local clean, cloud newer** | if unsafe (battle, container opening, fusion commit, modal busy) → defer 4 s and retry; else download, validate schema + checksum, re-check local is still clean, local safety copy, apply, adopt | *updated* (about 4 s) → idle |
| 7b | …download is corrupt / checksum mismatch | reject, local untouched, remember the bad revision (no retry loop), actionable error: Cloud backups… / Sync now to retry | error |
| 7c | …newer schema | reject, local untouched | blocked |
| 8 | local dirty, cloud unchanged (same revision) | push with `p_base_revision = base.revision` after debounce, or immediately on a lifecycle trigger | syncing → synced |
| 9 | **local dirty and cloud newer from the same base** | genuine conflict: nothing overwritten, resolver | conflict |
| 10 | local empty, base>0 (reset) | explicit decision, never wipes cloud | conflict |
| 11 | push answers `conflict` (raced) | do **not** push again; re-evaluate once from the fresh head (rows 7/9) | — |
| 12 | network/5xx/429 | keep dirty, status offline / sync pending, bounded backoff 15 s → 15 min, retry on `online` | offline |

Cloud-deleted and conflicts are the only states that stop automatic sync; everything else resolves itself.

## First link (once per account per device)

Only local → *Upload this device* / *Continue locally*. Only cloud → *Use cloud save* / *Continue locally*. Both, identical → link silently. Both, different → Compare with *Use this device* / *Use cloud save* / *Preserve both as backups* / *Continue locally*; explicit choice required. After the choice the link is stored and everything above is automatic.

## Automatic triggers

| Direction | Trigger |
|---|---|
| Push | `saved` bus event → 3 s debounce (max wait 15 s, coalesced, one upload); tab hidden / `pagehide` while dirty (flush local save first, bounded 4 s); PWA "Update now" and desktop update install (flush, bounded 3 s, then proceed whatever happens); `online`; SW Background Sync wake |
| Pull | startup (1.5 s after load), sign-in, `online`, tab visible (≥ 5 s after the last run), 60 s poll while visible, SW wake, 4 s retry while a pull is deferred as unsafe |

Never synced: animation frames, pointer/camera, temporary UI state, combat ticks, previews, note keystrokes — only the committed-save `saved` event reaches sync.

## Realtime decision

Not used. The client is SDK-less (plain `fetch`), Realtime would need a hand-written websocket client, adding `cloud_saves` to the Realtime publication is a database change (out of scope), and an event is only a hint — the head must still be fetched and validated. A 60 s visible-tab poll plus foreground/online/startup checks gives near-immediate handover with no extra attack surface and no duplicate-subscription failure modes. It can be added later as a pure wake-up without changing correctness.

## Status indicator

Small pill in the top bar: *Saved locally · Syncing · Synced · Updated from cloud · Offline (sync pending) · Sync pending · Conflict · Sign in to sync · Cloud saves off · Sync error*. No toast per save. Clicking opens Settings → Account (a conflict opens the resolver). Settings keeps Sync now, Compare, Backups, Restore, Delete, Turn off here, Last sync and Device label.

## Acceptance criteria

1. Local-only → upload and link; cloud-only → download and link. 2. Change → one coalesced upload ≤ ~3 s later. 3. Hidden while dirty → bounded upload. 4. Offline change → pending, uploads on reconnect. 5. Clean device with newer cloud → applied with no dialog (open or opening). 6. Match → nothing. 7. Dirty + unchanged cloud → auto upload. 8. Both diverged → conflict dialog; neither side overwritten; loser backed up first. 9. Cloud deletion keeps local. 10. Corrupt / newer-schema cloud rejected, local untouched. 11. Sign-out stops sync and keeps local; same account resumes; another account inherits nothing and does not overwrite the first link. 12. Resume/visibility never makes duplicate jobs. 13. Pull never applies during battle, container opening or other unsafe states. 14. Manual Sync now still works. 15. Existing 52 SQL tests unchanged.

## Result of the polish pass (2026-10-23)

- **Status:** implemented and verified against the mock server; production two-profile validation is a checklist for the owner (below).
- **Rules, intervals, triggers, conflict rule, Realtime decision:** the tables above are the final state machine.
- **Debounce:** 3 s after the last committed save, max wait 15 s, coalesced into one upload. Lifecycle triggers (hidden, pagehide, PWA update, desktop update install) upload immediately, waiting at most 4 s / 3 s.
- **Code:** `js/platform/cloud.js` (`pull`, `switchLink`, `flush`, `hold`, `preserveBoth`), `cloud-ui.js` (status pill, dialogs), `js/pwa.js` (flush before update, banner warning), `js/platform/desktop.js` (flush before installing a desktop update), `js/screens/fusion.js` (hold during commit), `css/pwa.css`. **No SQL, schema, auth or Rust changes.**
- **Mock suite (`node tools/cloud-test.mjs`): 96/96** (was 70). New: automatic pull on startup / manual trigger / poll, no dialog, "Updated from cloud", unsafe-moment deferral (hold, battle), no duplicate foreground jobs, hidden-while-dirty flush, restart resume, remote deletion keeps local, corrupt / shape-corrupt / newer-schema refusals without a retry loop, Preserve both, two accounts keep separate links. Existing suites 99 / 45 / 22 / 30 pass; `pwa-stamp --check` OK; SQL files untouched (the 52 in-database tests are therefore unchanged).
- **Known limitations:** Chrome only exercised. Page-lifecycle uploads (`hidden`/`pagehide`) are best effort: the browser may suspend the page before the request finishes (the change stays queued and uploads at next open). **Desktop:** no Rust close-hook was added (it needs a capability change and a release); closing the window relies on the page-side `pagehide` attempt, and the update-install path flushes first. A dialog left open defers an automatic pull until it is closed. Two tabs of one browser still share one save.
- **Desktop release:** shared frontend files changed (`desktop.js`, `cloud*.js`, `pwa.js`), so the EXE only gets this behaviour in a new versioned desktop release. None was published; that needs the owner's explicit approval. PWA/web users get it on deploy plus "Update now".

### Production validation checklist (owner; needs two real browser profiles and the test account)

1. Deploy `phase-five`; open the site in profiles A and B, both signed in to the **test** account (not the main save). Export a backup from each first.
2. A: make a harmless change (e.g. claim the Daily Seal). Within ~5 s the pill reads Synced and Settings shows a new revision.
3. B: bring the tab to the foreground (or reopen). It should show *Updated from cloud* with no dialog and match A.
4. B: another harmless change; A foregrounds and receives it.
5. Conflict: take B offline (DevTools → Offline), change both A and B, bring B online → B shows Conflict; Resolve… offers four choices. Resolve with *Preserve both as backups* then *Keep cloud version*.
6. iPhone/PWA and the desktop EXE (old build still has the manual flow until a new release).
