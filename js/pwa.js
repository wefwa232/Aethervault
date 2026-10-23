/* AETHERVAULT — PWA glue: service-worker registration, controlled updates, install prompt.
   The shell is cached per version (sw.js). A new version waits until the player taps Update; it is never
   swapped in mid-session, so scripts and styles can't mix versions and a battle is never cut short. */
(function () {
  const AV = (window.AV = window.AV || {});
  const KEY = 'av.sw';
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const q = new URLSearchParams(location.search);
  const store = (fn) => { try { return fn(localStorage); } catch (e) { return null; } };
  const listeners = new Set();
  const P = (AV.pwa = {
    supported: 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !(AV.desktop && AV.desktop.isDesktop),   // the desktop app ships its files inside the EXE
    enabled: false, ready: false, updateReady: false, installEvent: null, reg: null,
    standalone: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    ios: () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !P.standalone(),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  });
  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  let applying = false, banner = null;

  // Dev servers send no-store and are edited constantly, so a cache-first worker would only get in the way:
  // on localhost it is opt-in (?sw=1) and ?sw=0 removes it. Hosted origins always register.
  if (q.get('sw') === '1') store(s => s.setItem(KEY, '1'));
  if (q.get('sw') === '0') store(s => s.removeItem(KEY));
  P.enabled = P.supported && (!local || store(s => s.getItem(KEY)) === '1');

  function inBattle() { return document.body.dataset.screen === 'battle'; }

  function showBanner() {
    if (banner) { sync(); return; }
    banner = document.createElement('div');
    banner.id = 'pwaUpdate'; banner.setAttribute('role', 'status');
    banner.innerHTML = '<div><b>Update ready</b><span id="pwaUpdMsg"></span></div><button class="btn" data-a="go" type="button">Update now</button><button class="btn ghost" data-a="later" type="button" aria-label="Dismiss">Later</button>';
    banner.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'go') P.applyUpdate(); else { banner.remove(); banner = null; } });
    document.body.appendChild(banner); sync();
  }
  function sync() {
    if (!banner) return;
    const b = inBattle();
    banner.querySelector('#pwaUpdMsg').textContent = b ? 'Finish your battle first — updating reloads the game.' : 'A newer Aethervault is installed. Your progress is saved.';
    banner.querySelector('[data-a=go]').disabled = b;
  }
  setInterval(sync, 1000);

  P.applyUpdate = function () {
    const w = P.reg && P.reg.waiting; if (!w || inBattle()) return false;
    applying = true; w.postMessage({ type: 'SKIP_WAITING' }); return true;
  };
  P.check = async function () { if (!P.reg) return false; try { await P.reg.update(); } catch (e) { return false; } return true; };
  P.install = async function () {
    const ev = P.installEvent; if (!ev) return 'unavailable';
    P.installEvent = null; ev.prompt(); const r = await ev.userChoice; emit(); return r.outcome;
  };

  function watch(reg) {
    const flag = () => { if (reg.waiting && navigator.serviceWorker.controller) { P.updateReady = true; showBanner(); emit(); } };
    flag();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed') {
          if (navigator.serviceWorker.controller) flag();
          else { P.ready = true; emit(); if (AV.ui && AV.ui.toast) AV.ui.toast('Aethervault is ready to play offline', { kind: 'good', icon: 'info', silent: true }); }
        }
      });
    });
  }

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); P.installEvent = e; emit(); });
  window.addEventListener('appinstalled', () => { P.installEvent = null; emit(); });

  if (!P.supported) return;
  if (!P.enabled) {
    if (q.get('sw') === '0') (async () => {
      for (const k of await caches.keys()) if (k.startsWith('av-shell-')) await caches.delete(k);
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    })().catch(() => {});
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload(); });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      P.reg = reg; if (reg.active && navigator.serviceWorker.controller) P.ready = true;
      watch(reg); emit();
      const poll = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', poll); setInterval(poll, 60 * 60 * 1000);
    }).catch(e => console.warn('Service worker registration failed:', e));
  });
})();
