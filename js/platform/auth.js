/* AETHERVAULT — optional Google sign-in through Supabase Auth (GoTrue), PKCE flow, no SDK.
   The game never requires it: the local save stays authoritative and nothing here blocks play. Signing in only
   establishes an identity; cloud saves arrive in Subphase D. The session is kept under its own localStorage key
   (never inside the save, never exported). Offline or a failed refresh keeps the session; only a rejected
   refresh token signs the player out. Exposes AV.auth. */
(function () {
  const AV = (window.AV = window.AV || {});
  const KEY = 'av.auth', VER = 'av.auth.pkce', CFG = 'av.auth.cfg';
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const store = fn => { try { return fn(localStorage); } catch (e) { return null; } };
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

  // Dev-only override so a local mock server can stand in for Supabase (ignored on hosted origins).
  function cfg() {
    const c = Object.assign({}, AV.config);
    if (local) { const o = store(s => JSON.parse(s.getItem(CFG) || 'null')); if (o && o.supabaseUrl) Object.assign(c, o); }
    c.supabaseUrl = String(c.supabaseUrl || '').replace(/\/+$/, '');
    return c;
  }
  const C = cfg();

  const A = (AV.auth = {
    configured: !!(C.supabaseUrl && C.supabaseAnonKey),
    desktop: !!(AV.desktop && AV.desktop.isDesktop),   // Tauri shell: system-browser sign-in with a loopback redirect
    supported: /^https?:$/.test(location.protocol) || !!(AV.desktop && AV.desktop.isDesktop),
    session: null, busy: false, error: '', notice: '',
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    user() { const s = A.session; return s && s.user ? { id: s.user.id, email: s.user.email || '', name: (s.user.user_metadata && (s.user.user_metadata.full_name || s.user.user_metadata.name)) || '' } : null; },
    signedIn() { return !!A.session; },
    cfg: C,   // resolved Supabase URL + public anon key, read by js/platform/cloud.js
  });

  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
  const redirectTo = () => location.origin + location.pathname;
  const api = (path, body, token) => fetch(C.supabaseUrl + '/auth/v1/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: Object.assign({ apikey: C.supabaseAnonKey, 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let timer = null;
  function schedule() {
    clearTimeout(timer); if (!A.session) return;
    const ms = Math.max(5000, (A.session.expires_at - 60) * 1000 - Date.now());
    timer = setTimeout(() => A.refresh(), Math.min(ms, 2 ** 31 - 1));
  }
  function setSession(r) {
    const exp = r.expires_at || (Math.floor(Date.now() / 1000) + (r.expires_in || 3600));
    A.session = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp, user: r.user || (A.session && A.session.user) || null };
    store(s => s.setItem(KEY, JSON.stringify(A.session)));
    schedule(); emit();
  }
  function clearSession() { A.session = null; store(s => s.removeItem(KEY)); clearTimeout(timer); emit(); }

  // Resolves true if the session is usable afterwards. A network error keeps the session (we may simply be offline).
  A.refresh = async function () {
    if (!A.configured || !A.session) return false;
    try {
      const r = await api('token?grant_type=refresh_token', { refresh_token: A.session.refresh_token });
      if (r.ok) { setSession(await r.json()); return true; }
      if (r.status === 400 || r.status === 401 || r.status === 403) { A.notice = 'Your sign-in expired. Play continues; sign in again to reconnect.'; clearSession(); return false; }
    } catch (e) { /* offline */ }
    clearTimeout(timer); timer = setTimeout(() => A.refresh(), 5 * 60 * 1000);
    return true;
  };

  // Fresh access token for API calls (Subphase D), or null when signed out / offline with an expired token.
  A.token = async function () {
    if (!A.session) return null;
    if (A.session.expires_at - 30 > Date.now() / 1000) return A.session.access_token;
    await A.refresh();
    return A.session && A.session.expires_at > Date.now() / 1000 ? A.session.access_token : null;
  };

  A.signIn = async function () {
    if (!A.configured || !A.supported || A.busy) return;
    A.error = ''; A.notice = '';
    const verifier = rand(48);
    const challenge = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    // Desktop: Google refuses OAuth inside embedded webviews, so the system browser does the sign-in and a one-shot
    // listener on 127.0.0.1 (random port) receives the redirect. Pressing the button again restarts the attempt.
    let redirect = redirectTo();
    if (A.desktop) {
      try { redirect = 'http://127.0.0.1:' + (await AV.desktop.invoke('auth_listen')) + '/'; }
      catch (e) { A.error = 'Could not start sign-in: ' + e; emit(); return; }
    }
    store(s => s.setItem(VER, JSON.stringify({ v: verifier, t: Date.now() })));
    const u = new URL(C.supabaseUrl + '/auth/v1/authorize');
    u.search = new URLSearchParams({ provider: 'google', redirect_to: redirect, code_challenge: challenge, code_challenge_method: 's256' });
    if (!A.desktop) { location.assign(u.toString()); return; }
    try { await AV.desktop.invoke('open_external', { url: u.toString() }); A.notice = 'Finish signing in in your browser, then return here.'; }
    catch (e) { A.error = 'Could not open your browser: ' + e; AV.desktop.invoke('auth_cancel').catch(() => {}); }
    emit();
  };

  A.signOut = async function () {
    const tok = A.session && A.session.access_token;
    clearSession(); A.notice = 'Signed out. Your local save is untouched.';
    if (tok && A.configured) { try { await api('logout?scope=local', {}, tok); } catch (e) { /* best effort */ } }
    emit();
  };

  async function finishRedirect() {
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const code = q.get('code'), err = q.get('error_description') || q.get('error') || h.get('error_description');
    if (!code && !err) return;
    const saved = store(s => JSON.parse(s.getItem(VER) || 'null'));
    // Only consume the redirect when we started a sign-in ourselves; an unrelated query string is left alone.
    if (!(saved && saved.v)) return;
    const clean = new URL(location.href); ['code', 'error', 'error_code', 'error_description'].forEach(k => clean.searchParams.delete(k));
    history.replaceState(null, '', clean.pathname + clean.search);
    return complete(code, err, saved);
  }

  async function complete(code, err, saved) {
    A.notice = ''; store(s => s.removeItem(VER));
    if (err) { A.error = 'Sign-in was cancelled or failed: ' + err; emit(); return; }
    if (Date.now() - saved.t > 10 * 60 * 1000) { A.error = 'That sign-in attempt timed out. Please try again.'; emit(); return; }
    A.busy = true; emit();
    try {
      const r = await api('token?grant_type=pkce', { auth_code: code, code_verifier: saved.v });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error_description || 'HTTP ' + r.status);
      setSession(await r.json()); A.notice = 'Signed in.';
      if (AV.ui && AV.ui.toast) AV.ui.toast('Signed in', { kind: 'good', icon: 'check', silent: true });
    } catch (e) { A.error = 'Could not complete sign-in: ' + e.message; }
    A.busy = false; emit();
  }

  const stored = store(s => JSON.parse(s.getItem(KEY) || 'null'));
  if (stored && stored.refresh_token && A.configured) {
    A.session = stored; schedule();
    if (stored.expires_at - 30 <= Date.now() / 1000) A.refresh();
  } else if (stored) store(s => s.removeItem(KEY));
  if (A.configured && A.supported) {
    finishRedirect();
    if (A.desktop) AV.desktop.listen('av-auth-callback', query => {
      const q = new URLSearchParams(query), saved = store(s => JSON.parse(s.getItem(VER) || 'null'));
      if (!(saved && saved.v)) return;   // not a sign-in we started
      complete(q.get('code'), q.get('error_description') || q.get('error'), saved);
    });
  }
})();
