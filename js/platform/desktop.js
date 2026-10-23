/* AETHERVAULT — desktop bridge. Present only inside the Tauri shell (src-tauri/); in a browser or PWA this does
   nothing and AV.desktop.isDesktop is false. Everything else in the game is the same shared frontend. Exposes AV.desktop. */
(function () {
  const AV = (window.AV = window.AV || {});
  const T = window.__TAURI__;
  const ok = !!(T && T.core && T.event);
  AV.desktop = {
    isDesktop: ok,
    invoke: (cmd, args) => (ok ? T.core.invoke(cmd, args) : Promise.reject(new Error('not the desktop app'))),
    // fn receives the event payload; resolves to an unlisten function.
    listen: (name, fn) => (ok ? T.event.listen(name, e => fn(e.payload)) : Promise.resolve(() => {})),
  };

  // Signed desktop updates (Subphase F). The Rust side verifies the signature; the page only asks and shows state.
  // status: idle | checking | none | available | installing | error. Nothing is installed without the player's click.
  const U = (AV.desktop.updates = { status: 'idle', version: null, notes: null, done: 0, total: 0, error: null, checkedAt: 0 });
  const subs = new Set();
  U.onChange = fn => { subs.add(fn); return () => subs.delete(fn); };
  const emit = () => subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  const set = patch => { Object.assign(U, patch); emit(); };
  U.check = async function () {
    if (!ok || U.status === 'checking' || U.status === 'installing') return U.status;
    set({ status: 'checking', error: null });
    try {
      const r = await AV.desktop.invoke('update_check');
      set(r ? { status: 'available', version: r.version, notes: r.notes || null, checkedAt: Date.now() } : { status: 'none', version: null, notes: null, checkedAt: Date.now() });
    } catch (e) { set({ status: 'error', error: String(e) }); }
    return U.status;
  };
  // Returns false (and does nothing) during a battle; the installer restarts the app, which would end it.
  U.install = async function () {
    if (!ok || U.status !== 'available') return false;
    if (document.body.dataset.screen === 'battle') return false;
    try { if (AV.state && AV.state.save) AV.state.save(true); } catch (e) { /* the save is already on disk; a failed flush must not block */ }
    set({ status: 'installing', done: 0, total: 0, error: null });
    try { await AV.desktop.invoke('update_install'); }
    catch (e) { set({ status: 'error', error: String(e) }); return false; }
    return true;
  };
  if (ok) AV.desktop.listen('av-update-progress', p => set({ done: p.done || 0, total: p.total || 0 }));
})();
