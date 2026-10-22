/* AETHERVAULT — boot and first-run onboarding. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, A = AV.art, ui = AV.ui, au = AV.audio;

  /** First-run: name, economy mode, then the free First Egg ritual. */
  function onboarding() {
    ui.renderTopbar(); ui.applySettings(); if (ui.currentScreen() !== 'home') ui.go('home', {}, { silent: true });
    let mode = 'standard';
    ui.modal({
      title: '', cls: 'welcome', noClose: true, dismiss: false, wide: true,
      html: `<div class="wl">
        <div class="wl-head"><span class="label">Archive intake · Form 0001</span><h1>Aethervault</h1><p class="wl-sub">The Infinite Archive</p></div>
        <p class="wl-pitch">Open impossible containers. Catalogue pets, arms, relics, machines and oddities — each one a unique specimen. Upgrade, evolve and collect.</p>
        <div class="wl-form">
          <label class="field"><span>Collector name</span><input id="wlName" type="text" maxlength="20" value="Collector" autocomplete="off"></label>
          <div class="field-h">Economy</div>
          <div class="mode-cards" id="wlModes">
            <button class="modec on" data-mode="standard"><b>Standard Simulation</b><span>Earn and spend fictional credits, gems and essence. Guarantee meters and prices apply.</span></button>
            <button class="modec" data-mode="unlimited"><b>Unlimited Mode</b><span>Infinite everything. Free openings, upgrades and duplication. Pure sandbox.</span></button>
          </div>
        </div>
        <div class="stamp-note"><span class="stamp">Simulation only</span><span>No real transaction. Currencies, store and market are fictional; nothing connects to any payment service. You can switch modes at any time in Settings.</span></div>
        <button class="btn primary major" id="wlGo">Hatch my first egg</button></div>`,
      onOpen(api) {
        api.el.querySelector('#wlModes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode; api.el.querySelectorAll('.modec').forEach(x => x.classList.toggle('on', x === b)); });
        api.el.querySelector('#wlGo').addEventListener('click', () => {
          const name = api.el.querySelector('#wlName').value.trim().slice(0, 20) || 'Collector';
          const s = AV.state.get(); s.profile.name = name; s.mode = mode; s.flags.onboarded = true; AV.state.save(true);
          au.init(); au.applyVolumes(); ui.renderTopbar(); api.close(true);
          setTimeout(() => AV.opening.start(null, 1, { starter: true }), 250);
        });
        setTimeout(() => api.el.querySelector('#wlName').select(), 50);
      },
    });
  }
  AV.onboarding = onboarding;

  /** The startup sequence (js/boot.js) does the real initialisation — save load, settings, renderer, first route. This only
   *  continues from there: first-run onboarding, then idle-time warm-up of what the player is likely to open next. */
  async function boot() {
    window.AVDebug = AV; // handy for development / testing
    try { await AV.boot.run(); }
    catch (e) { // last resort: never leave the player staring at the loading screen
      console.error('[boot] fatal', e);
      try { if (!AV.state.get()) AV.state.load(); if (!AV.ui.currentScreen()) { AV.fx.init(); ui.boot(); ui.go('home', {}, { silent: true }); } } catch (e2) { console.error(e2); }
      const el = document.getElementById('boot'); if (el) el.remove();
    }
    const s = AV.state.get();
    if (s && !s.flags.onboarded) onboarding();
    else if (s && s.lastOpening && !s.lastOpening.seen) {
      const lo = s.lastOpening, c = AV.data.CONTAINER[lo.container], n = lo.ids.filter(id => s.specimens[id]).length;
      lo.seen = true; AV.state.save();
      setTimeout(() => ui.toast(`Your last ${c ? c.name : 'opening'} was interrupted. All ${n} of its prizes were saved to the Vault before the animation began.`, { icon: 'check', kind: 'good', ms: 6500 }), 1200);
    }
    AV.boot.afterHome();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
