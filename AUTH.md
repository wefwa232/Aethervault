# Optional sign-in (Distribution Subphase C)

Google sign-in through Supabase Auth. **Optional**: with no configuration the game is exactly as before and makes no network calls. Signing in only establishes an identity; cloud saves (Subphase D, opt-in per device) are described in CLOUD_SAVES.md.

## Status

- **Complete.** Verified against a mock server and, on 2026-10-23, with a real Google sign-in on production (https://aethervault-six.vercel.app): signed in and the account email was shown. Supabase project ref `amdcievyizsadmxhozwv`; its public URL and anon key are in `js/platform/config.js`.
- If `js/platform/config.js` is ever emptied, Settings → Account falls back to "sign-in is not set up in this build" and the game stays fully local.
- Follow-up for the owner: the Google client secret was pasted into a chat during setup; reset it in Google Cloud and re-enter it in Supabase.

## Files

| File | Role |
|---|---|
| `js/platform/config.js` | `AV.config = { supabaseUrl, supabaseAnonKey }`. Both public by design. **Never** a `service_role` key, DB password or Google client secret. |
| `js/platform/auth.js` | `AV.auth`: PKCE sign-in, refresh, sign-out, `token()`. No SDK, plain `fetch` to `/auth/v1/*`. |
| Settings → Account | Sign in with Google / signed-in email / Sign out. |
| `tools/mock-gotrue.mjs` | Dev-only stand-in for Supabase Auth (verifies PKCE S256). |

## Behaviour

- **Flow:** authorization code + PKCE (S256). Verifier is stored in `av.auth.pkce` for 10 minutes and removed on return. A `?code=` is only consumed if this app started a sign-in; unrelated query strings are untouched. The URL is cleaned after return.
- **Session:** `localStorage` key `av.auth` (separate from the save `aethervault.save.v1`; never exported, never inside a backup). Access token refreshed ~60 s before expiry and on load.
- **Offline / flaky network:** refresh failure keeps the session and retries in 5 min. Only a rejected refresh token (400/401/403) signs out, with a notice. Play is never blocked.
- **Sign out:** clears the session, revokes it server-side (best effort). The local save is never touched.
- **Redirect URL** sent to Supabase is `origin + pathname`, e.g. `https://aethervault-six.vercel.app/`.
- **Desktop app (Subphase E):** system-browser sign-in with a loopback redirect; see TAURI.md. Needs the Supabase redirect entry `http://127.0.0.1:*/**` (owner gate).
- **Dev override:** on localhost only, `localStorage['av.auth.cfg'] = '{"supabaseUrl":"…","supabaseAnonKey":"…"}'` replaces the config (ignored on hosted origins).

## Setup record (manual gate, done)

1. **Supabase:** create a project at supabase.com (free plan). Note the Project URL and the `anon` public key (Settings → API).
2. **Google Cloud Console:** APIs & Services → Credentials → Create OAuth client ID → *Web application*.
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Copy the Client ID and Client secret.
3. **Supabase → Authentication → Providers → Google:** enable, paste Client ID and secret (the secret lives only in Supabase).
4. **Supabase → Authentication → URL Configuration:**
   - Site URL: `https://aethervault-six.vercel.app`
   - Redirect URLs: `https://aethervault-six.vercel.app/`, `http://localhost:5173/`
5. Give me the Project URL and anon key (both safe to share) and I will put them in `js/platform/config.js`, re-stamp the service worker, deploy and run the real-account test.

## Tested (2026-10-23, Chromium built-in pane, localhost + mock server)

Unconfigured state; sign-in redirect and PKCE exchange; session stored outside the save; token refresh and rotation; offline refresh keeps session; revoked refresh token signs out with notice; denied consent shows error and clears the verifier; sign-out keeps the save; existing suites 99/45/22/30 pass; `pwa-stamp --check` OK.

## Limitations

- Real Google consent screen, real Supabase tokens and email/name claims are unverified until the gate is done.
- Tokens sit in `localStorage` (same as the Supabase SDK default); acceptable for a game with no payments, and mitigated by RLS in Subphase D.
- The service worker precaches `js/platform/*`; because `config.js` is part of the shell, changing it ships as a normal controlled update.
