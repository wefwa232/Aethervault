/* AETHERVAULT — Settings (archive controls): economy mode, audio, 3D quality, motion & comfort, data. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, E = AV.engine, A = AV.art, ui = AV.ui, au = AV.audio;
  const QUALITY = [['off', 'Off · 2D art', 'Pure 2D. No WebGL is used.'], ['low', 'Low', 'Lighter materials, no shadow maps, 30 fps, small render scale.'], ['medium', 'Medium', 'Shadows, clearcoat materials, 60 fps target. Recommended.'], ['high', 'High', 'Full-resolution render, 2K shadows, 60 fps.']];

  const FPS = [['auto', 'Auto', 'Per preset: 30 on Low, 60 on Medium/High'], [30, '30', 'Smoothest on battery'], [60, '60', 'Normal target'], ['max', 'Uncapped', 'Display refresh rate']];
  const P = () => AV.pwa || {};
  function pwaText() {
    const p = P(); if (AV.desktop && AV.desktop.isDesktop) return 'You are running the Aethervault desktop app. It plays offline from its own files; browser install and web update controls do not apply here.';
    if (!p.supported) return 'Install and offline play are available when Aethervault is opened from a web address (https).';
    if (!p.enabled) return 'Offline caching is off on this local development server (add ?sw=1 to the address to test it).';
    const mode = p.standalone() ? 'Running as an installed app. ' : (p.ios() ? 'To install: Share → Add to Home Screen. ' : '');
    return mode + (p.updateReady ? 'A new version is ready — your progress is saved.' : (p.ready ? 'Offline-ready. You are on the latest version.' : 'Preparing offline copy…'));
  }
  function accountHtml() {
    const au = AV.auth, e = U.esc;
    if (!au || !au.configured) return '<p class="muted">Sign-in is optional and is not set up in this build. Your progress is saved on this device and the game works fully without an account.</p>';
    if (!au.supported) return '<p class="muted">Sign-in is not available in this app window yet. Your progress is saved on this device.</p>';
    const u = au.user(), msg = au.error ? `<p class="bad-txt tiny" role="alert">${e(au.error)}</p>` : (au.notice ? `<p class="dim tiny" role="status">${e(au.notice)}</p>` : '');
    if (au.busy) return '<p class="muted" role="status">Completing sign-in…</p>';
    if (au.signedIn()) return `<p class="muted">Signed in as <b>${e((u && (u.email || u.name)) || 'your Google account')}</b>.</p>${msg}<div class="btn-row"><button class="btn ghost" data-act="auth-out">Sign out</button></div>${(AV.cloudUi && AV.cloudUi.panelHtml()) || ''}`;
    return `<p class="muted">Optional. Sign in with Google to link this archive to an account. You can play without one, and signing out never touches your local save.</p>${msg}<div class="btn-row"><button class="btn" data-act="auth-in">Sign in with Google</button></div>`;
  }
  function render(root) {
    const redraw = () => { if (!root.isConnected) { off && off(); off2 && off2(); return; } const el = root.querySelector('#acct'); if (el) el.innerHTML = accountHtml(); };
    const off = AV.auth && AV.auth.onChange(redraw), off2 = AV.cloud && AV.cloud.onChange(redraw);
    const draw = () => {
      const P = AV.pwa || {};
      const s = AV.state.get(), st = s.settings, unl = s.mode === 'unlimited';
      const glOk = AV.stage && !AV.stage.failed && !(AV.stage.stats().quality === 'off' && st.quality3d !== 'off');
      const q = st.quality3d || 'medium';
      const slider = (key, label, hint) => `<label class="slider"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><input type="range" min="0" max="1" step="0.01" value="${st[key]}" data-vol="${key}" aria-label="${label}"><output>${Math.round(st[key] * 100)}%</output></label>`;
      const tog = (key, label, hint) => `<label class="toggle row"><input type="checkbox" data-tog="${key}" ${st[key] ? 'checked' : ''}><span></span><div>${label}${hint ? `<small>${hint}</small>` : ''}</div></label>`;
      root.innerHTML = `<div class="settings">
        <header class="page-head"><div><span class="label">Archive controls</span><h1>Settings</h1><p class="muted">Aethervault v${AV.VERSION.number} · ${AV.state.storageOk() ? 'Progress saves automatically to this device' : '<b class="bad-txt">Browser storage is unavailable — progress will not persist</b>'}</p></div></header>
        <div class="set-grid">
          <section class="s-matte pad"><h3 class="sect">${A.icon('coin')} Economy mode</h3>
            <div class="mode-cards">
              <button class="modec ${!unl ? 'on' : ''}" data-mode="standard"><b>Standard Simulation</b><span>Designed prices and earned resources. Spend, save and decide.</span></button>
              <button class="modec ${unl ? 'on' : ''}" data-mode="unlimited"><b>Unlimited Mode</b><span>Infinite balances, free containers, free upgrades and item duplication.</span></button>
            </div>
            <p class="muted tiny">Switching is instant and keeps your collection and stored balances. Everything is fictional either way.</p></section>
          <section class="s-matte pad"><h3 class="sect">${A.icon('cube')} 3D presentation</h3>
            <div class="qlist" role="radiogroup" aria-label="3D quality">${QUALITY.map(([id, n, d]) => `<button class="qrow ${q === id ? 'on' : ''}" role="radio" aria-checked="${q === id}" data-q3="${id}"><i></i><b>${n}</b><span>${d}</span></button>`).join('')}</div>
            <div class="field-h">Frame rate limit</div><div class="seg" role="group" aria-label="Frame rate limit">${FPS.map(([v, l, d]) => `<button class="${(st.fpsLimit || 'auto') === v ? 'on' : ''}" data-fps="${v}" title="${d}">${l}</button>`).join('')}</div>
            <p class="tiny ${glOk ? 'dim' : 'bad-txt'}">${q === 'off' ? '2D fallback is active.' : (glOk ? 'WebGL renderer ready. Only the active centerpiece renders in real time; collection grids use cached thumbnails.' : 'WebGL is unavailable or was lost — the 2D fallback is being used.')}</p></section>
          <section class="s-matte pad"><h3 class="sect">${A.icon('play')} Audio</h3>
            ${slider('master', 'Master')}${slider('music', 'Ambient music')}${slider('sfx', 'Interface sounds')}${slider('opening', 'Openings & reveals', 'Rituals, stingers, impacts')}
            <button class="btn ghost" data-act="test">${A.icon('play')}Test reveal sound</button></section>
          <section class="s-matte pad"><h3 class="sect">${A.icon('sparkle')} Motion &amp; comfort</h3>
            <div class="field-h">Animation speed</div>
            <div class="seg" role="group" aria-label="Animation speed">${[[.75, '0.75×'], [1, '1×'], [1.5, '1.5×'], [2.5, '2.5×'], [0, 'Instant']].map(([v, l]) => `<button class="${st.animSpeed === v ? 'on' : ''}" data-spd="${v}">${l}</button>`).join('')}</div>
            <p class="muted tiny">Instant skips ritual and reveal animations and goes straight to the results.</p>
            ${tog('reducedMotion', 'Reduced motion', 'Removes ambient movement and idle animation; 3D renders only when you interact')}
            ${tog('shake', 'Screen shake', 'Impact shake during big reveals')}
            ${tog('flashing', 'Flashing effects', 'Bright full-screen flashes')}
            ${tog('skipRituals', 'Skip opening rituals', 'Go straight to the reveal')}
            ${tog('fastStartup', 'Fast startup', 'Shortens the startup sequence on launches after the first')}
            <div class="field-h">Text size</div>
            <div class="seg" role="group" aria-label="Text size">${[[.9, 'Small'], [1, 'Normal'], [1.15, 'Large'], [1.3, 'Largest']].map(([v, l]) => `<button class="${st.textSize === v ? 'on' : ''}" data-ts="${v}">${l}</button>`).join('')}</div></section>
          <section class="s-matte pad"><h3 class="sect">${A.icon('open')} Openings, cards &amp; fusion</h3>
            <div class="field-h">Multi-open behaviour <small class="tiny dim">for ×5 and ×10</small></div>
            <div class="seg" role="group" aria-label="Multi-open behaviour">${[['condensed', 'Condensed grid'], ['sequential', 'One by one'], ['instant', 'Straight to results']].map(([v, l]) => `<button class="${(st.multiOpen || 'condensed') === v ? 'on' : ''}" data-opt4="multiOpen" data-v="${v}">${l}</button>`).join('')}</div>
            <div class="field-h">Forge reel speed</div>
            <div class="seg" role="group" aria-label="Forge reel speed">${[[.75, 'Slow'], [1, 'Normal'], [1.5, 'Brisk'], [2.5, 'Fast']].map(([v, l]) => `<button class="${(+st.rouletteSpeed || 1) === v ? 'on' : ''}" data-opt4="rouletteSpeed" data-v="${v}" data-num="1">${l}</button>`).join('')}</div>
            ${slider('clickVolume', 'Reel click intensity', 'The ratchet of the Forge reel')}
            ${tog('cardHolo', 'Card holograms', 'Epic and rarer cards project their subject while untouched (not on Low quality)')}
            <div class="field-h">Return to hologram after</div>
            <div class="seg" role="group" aria-label="Auto-return to hologram">${[[0, 'Never'], [3, '3 s'], [4, '4 s'], [8, '8 s']].map(([v, l]) => `<button class="${(st.holoReturn == null ? 4 : +st.holoReturn) === v ? 'on' : ''}" data-opt4="holoReturn" data-v="${v}" data-num="1">${l}</button>`).join('')}</div>
            <div class="field-h">Fusion animation</div>
            <div class="seg" role="group" aria-label="Fusion animation">${[['full', 'Full'], ['short', 'Short'], ['off', 'Off']].map(([v, l]) => `<button class="${(st.fusionAnim || 'full') === v ? 'on' : ''}" data-opt4="fusionAnim" data-v="${v}">${l}</button>`).join('')}</div>
            ${tog('binderAnim', 'Binder page turns', 'Animate pages in the card binder')}
            <p class="muted tiny">Reduced motion shortens the reel, replaces the pack tear with a simple reveal, and simplifies holograms and fusion — nothing is hidden.</p></section>
          <section class="s-matte pad"><h3 class="sect">${A.icon('download')} Install &amp; updates</h3>
            <p class="muted" id="pwaState">${pwaText()}</p>
            <div class="btn-row">${P.installEvent ? `<button class="btn" data-act="pwa-install">${A.icon('download')}Install app</button>` : ''}${P.enabled ? `<button class="btn ghost" data-act="pwa-check">Check for updates</button>${P.updateReady ? '<button class="btn" data-act="pwa-apply">Update now</button>' : ''}` : ''}</div></section>
          <section class="s-matte pad"><h3 class="sect">${A.icon('lock')} Account</h3><div id="acct">${accountHtml()}</div></section>
          <section class="s-matte pad"><h3 class="sect">${A.icon('download')} Your data</h3>
            <p class="muted">Your save lives in this browser's local storage. Export a backup file any time.</p>
            <div class="btn-row"><button class="btn ghost" data-act="export">${A.icon('download')}Export save</button><button class="btn ghost" data-act="import">${A.icon('upload')}Import save</button><input type="file" id="impFile" accept=".json,application/json" hidden></div>
            <hr><p class="muted">Start over with a brand-new Archive. This permanently deletes your collection and progress.</p>
            <button class="btn danger" data-act="reset">${A.icon('trash')}Reset all progress…</button></section>
          <section class="s-matte pad about"><h3 class="sect">${A.icon('info')} About</h3>
            <p><b>Aethervault</b> is a private, single-player collectible simulator. <b>Simulation only — no real transactions or payment services. The game needs no network; optional Google sign-in and cloud saves are the only online features.</b> The 3D specimens are modelled and lit procedurally in your browser; remaining artwork is drawn procedurally; all sound is synthesised. Names and creatures are invented. Three.js (MIT) and the bundled typefaces (SIL OFL) are included under <code>vendor/</code>.</p></section>
        </div></div>`;
    };
    draw();
    let tt;
    root.addEventListener('input', e => {
      const v = e.target.dataset.vol; if (!v) return;
      E.setSetting(v, +e.target.value); e.target.nextElementSibling.textContent = Math.round(e.target.value * 100) + '%';
      clearTimeout(tt); tt = setTimeout(() => au.play(v === 'opening' ? 'thump' : 'click'), 120);
    });
    root.addEventListener('change', e => { const k = e.target.dataset.tog; if (k) { E.setSetting(k, e.target.checked); if (k === 'reducedMotion') ui.toast(e.target.checked ? 'Reduced motion on' : 'Motion restored', { icon: 'check', silent: true }); } });
    root.addEventListener('click', async e => {
      const m = e.target.closest('[data-mode]');
      if (m) { E.setMode(m.dataset.mode); au.play('confirm'); ui.toast(m.dataset.mode === 'unlimited' ? 'Unlimited Mode enabled — ∞ everything' : 'Standard Simulation restored', { kind: 'good', icon: 'check' }); draw(); return; }
      const q3 = e.target.closest('[data-q3]'); if (q3) { E.setSetting('quality3d', q3.dataset.q3); au.play('confirm'); ui.toast(`3D quality: ${q3.dataset.q3}`, { icon: 'cube', silent: true }); return; }
      const fp = e.target.closest('[data-fps]'); if (fp) { const v = fp.dataset.fps; E.setSetting('fpsLimit', v === 'auto' || v === 'max' ? v : +v); draw(); return; }
      const sp = e.target.closest('[data-spd]'); if (sp) { E.setSetting('animSpeed', +sp.dataset.spd); draw(); return; }
      const o4 = e.target.closest('[data-opt4]'); if (o4) { E.setSetting(o4.dataset.opt4, o4.dataset.num ? +o4.dataset.v : o4.dataset.v); draw(); return; }
      const ts = e.target.closest('[data-ts]'); if (ts) { E.setSetting('textSize', +ts.dataset.ts); draw(); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act.startsWith('cloud-')) { await AV.cloudUi.act(a.dataset.act); redraw(); return; }
      if (a.dataset.act === 'test') au.sting(5);
      else if (a.dataset.act === 'pwa-install') await AV.pwa.install();
      else if (a.dataset.act === 'pwa-check') { const ok = await AV.pwa.check(); ui.toast(ok ? (AV.pwa.updateReady ? 'A new version is ready' : 'Checked — you are up to date') : 'Could not check for updates (offline?)', { icon: 'info', silent: true }); draw(); }
      else if (a.dataset.act === 'auth-in') AV.auth.signIn();
      else if (a.dataset.act === 'auth-out') { await AV.auth.signOut(); ui.toast('Signed out — your local save is untouched', { icon: 'info', silent: true }); }
      else if (a.dataset.act === 'pwa-apply') { if (!AV.pwa.applyUpdate()) ui.toast('Finish your battle first', { kind: 'bad', icon: 'info' }); }
      else if (a.dataset.act === 'export') {
        const blob = new Blob([AV.state.exportJSON()], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = `aethervault-save-${U.dateKey()}.json`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
        ui.toast('Save exported', { kind: 'good', icon: 'download' });
      } else if (a.dataset.act === 'import') root.querySelector('#impFile').click();
      else if (a.dataset.act === 'reset') {
        const ok = await ui.confirm({ title: 'Reset all progress?', danger: true, confirmText: 'Continue', icon: 'trash', message: 'This permanently deletes every specimen, balance, setting and achievement on this device. Consider exporting a backup first.' });
        if (!ok) return;
        const t = await ui.prompt({ title: 'Final confirmation', label: 'Type RESET to confirm', value: '', max: 10, okText: 'Delete everything' });
        if (t !== 'RESET') { if (t != null) ui.toast('Reset cancelled — text did not match', { icon: 'info' }); return; }
        AV.state.reset(); AV.onboarding();
      }
    });
    root.querySelector('#impFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const text = await f.text(); const parsed = JSON.parse(text);
        const ok = await ui.confirm({ title: 'Import this save?', danger: true, confirmText: 'Replace my progress', message: `This replaces your current progress with the file's contents (${Object.keys(parsed.specimens || {}).length} specimens).` });
        if (!ok) return;
        AV.state.importJSON(text); ui.applySettings(); ui.renderTopbar(); ui.toast('Save imported', { kind: 'good', icon: 'upload' }); ui.go('home');
      } catch (err) { ui.toast('That file is not a valid Aethervault save.', { kind: 'bad', icon: 'close' }); }
      e.target.value = '';
    });
  }
  ui.register('settings', { render });
})();
