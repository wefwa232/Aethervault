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
})();
