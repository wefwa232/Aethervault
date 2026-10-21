/* AETHERVAULT — startup sequence. A fictional "waking the archive" presentation wrapped around REAL local initialisation.
 * Nothing here touches the network: no requests, no accounts, no downloads. Every stage does the work its text claims, and the
 * progress bar is the weighted completion of those stages, never a timer.
 *
 *   awaken → ledger → curator → renderer → index → gateway      (see STAGES)
 *
 * Presentation floor (so the sequence reads as intentional, never a flash): cold/first launch ≈ 3.8 s, warm start ≈ 1.7 s,
 * "Fast startup" setting ≈ 0.7 s, ?fastboot=1 (tests) = no floor. A slow stage simply holds its status longer; nothing waits
 * for a fixed delay once the work AND the floor are done. Every stage has a timeout; failures offer Retry or a safe 2D fallback. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data;
  const WARM_KEY = 'aethervault.boot.warm';
  const Q = new URLSearchParams(location.search);
  let devMode = false; try { devMode = Q.has('dev') || localStorage.getItem('aethervault.dev') === '1'; } catch (e) { /* storage blocked */ }
  const FAST = Q.get('fastboot') === '1';
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /** Let the browser paint the latest status before the next chunk of (possibly heavy) work starts. */
  const paint = () => new Promise(r => { let done = false; const f = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(f, 0)); setTimeout(f, 80); });
  const withTimeout = (p, ms, label) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error(label + ' did not finish in ' + (ms / 1000) + 's'), { timeout: true })), ms); })]).finally(() => clearTimeout(t)); };
  const LORE = [
    'The Archive keeps what the world forgot to keep.',
    'Every specimen carries a serial. None carries a past it will admit to.',
    'The Vault has never been emptied. It has only been opened.',
    'Containers are not found. They arrive.',
    'A Collector’s first duty is to be surprised.',
    'The Missing Texture has been missing for a very long time.',
    'Nothing in the Archive is real money. Everything in it is real wonder.',
  ];

  const state = { done: false, running: false, safeMode: false, report: null, warm: false };
  AV.boot = state;

  // ------------------------------------------------------------------ stages
  const STAGES = [
    { id: 'awaken', w: 8, head: 'Waking archive systems…', sub: 'Initializing Archive Network', timeout: 9000,
      async run(c) {
        // Tier A: type, storage, essential UI assets
        const faces = ['600 40px "Cormorant Garamond"', '600 20px "Barlow Condensed"', '600 18px "Barlow Semi Condensed"', '500 14px "IBM Plex Mono"', '400 14px "IBM Plex Sans"']; let n = 0;
        if (document.fonts && document.fonts.load) await Promise.all(faces.map(f => document.fonts.load(f).catch(() => { }).then(() => c.progress(++n / faces.length)))); else c.progress(1);
        let store = true; try { localStorage.setItem('aethervault.probe', '1'); localStorage.removeItem('aethervault.probe'); } catch (e) { store = false; }
        c.detail(`${n} typefaces · local storage ${store ? 'ready' : 'unavailable'}`);
      } },
    { id: 'ledger', w: 14, head: 'Verifying local specimen ledger…', sub: 'Synchronizing Local Archive', timeout: 9000,
      async run(c) {
        AV.state.load(); const L = AV.state.lastLoad; c.progress(.6);
        if (L.corrupt) throw Object.assign(new Error('The saved ledger could not be parsed.'), { kind: 'ledger', backup: L.backupKey });
        if (!L.storage) c.degrade('storage');
        c.detail(L.fresh ? 'no ledger yet — preparing a new archive' : `${L.specimens} specimen${L.specimens === 1 ? '' : 's'} · schema v${L.fromVersion}${L.fromVersion !== AV.state.SAVE_VERSION ? ' → v' + AV.state.SAVE_VERSION : ''}${L.dropped ? ` · ${L.dropped} unknown record${L.dropped === 1 ? '' : 's'} set aside` : ''}`);
      } },
    { id: 'curator', w: 12, head: 'Restoring curator profile…', sub: 'Restoring Local Curator Profile', timeout: 9000,
      async run(c) {
        if (!state._chrome) { AV.fx.init(); AV.ui.boot(); state._chrome = true; }
        const s = AV.state.get(); AV.ui.applySettings(); c.progress(.5);
        document.body.classList.toggle('reduce-motion', !!s.settings.reducedMotion);
        const ex = AV.engine.dailyStatus(); // exchange ledger: the daily seal and offers are derived locally
        c.progress(.8); AV.audio.prepare && AV.audio.prepare();
        c.detail(`${s.profile.name} · level ${s.profile.level} · ${s.mode === 'unlimited' ? 'unlimited' : 'standard'} ledger${ex && ex.canClaim ? ' · daily seal ready' : ''}`);
      } },
    { id: 'renderer', w: 30, head: 'Calibrating containment renderer…', sub: 'Calibrating Containment Chamber', timeout: 10000,
      async run(c) {
        const S = AV.stage, s = AV.state.get();
        if (!S || S.failed) { c.fallback('3D library unavailable'); return; }
        if (s.settings.quality3d === 'off') { await S.boot(); c.detail('3D set to Off — 2D archive art'); return; }
        const ok = await withTimeout(S.boot(), 6000, 'renderer'); c.progress(.3);
        if (!ok || !S.ensureGL()) { c.fallback('WebGL unavailable'); return; }
        const gl = S.glInfo() || {}, soft = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(gl.renderer || '');
        // First run of a brand-new profile only: choose a preset from what the browser exposes. An explicit player choice is never overridden.
        if (!s.flags.onboarded && !s.flags.autoQuality) { s.flags.autoQuality = true; if (soft) { s.settings.quality3d = 'low'; c.note('software renderer detected — Low preset applied'); } }
        c.progress(.45);
        // compile the shaders Home needs (same quality, same light rig as the live view) off the critical thread
        const comp = s.companion ? AV.engine.get(s.companion) : null;
        if (comp) await withTimeout(S.ensure([comp.base]), 4000, 'model file').catch(() => { }); // Tier A: the companion's model file, nothing else
        const spec = comp && S.has(comp.base) ? Object.assign({ plateTitle: comp.base }, comp) : { container: 'egg', theme: ['#d7b46e', '#ff9ad1'], name: 'First Egg', plateTitle: 'Dormant egg', plateSub: '—' };
        let warmMs = 0; if (spec.container ? S.has('container:egg') : true) { const r = await withTimeout(S.warm(spec), 6000, 'shader compile').catch(() => null); warmMs = r ? r.ms : 0; }
        c.progress(1);
        const raw = String(gl.renderer || 'WebGL'), m = /ANGLE \([^,]*,\s*([^()]*?)\s*(?:\(0x|Direct3D|,|\)|$)/.exec(raw), gpu = (m ? m[1] : raw.replace(/\s+/g, ' ')).slice(0, 34);
        c.detail(`${gpu} · ${S.quality()} preset · shader warm-up ${Math.round(warmMs)} ms`);
      } },
    { id: 'index', w: 16, head: 'Indexing active specimens…', sub: 'Indexing Specimen Records', timeout: 9000,
      async run(c) {
        const E = AV.engine, t = E.totals(), S = AV.stage; c.progress(.3);
        // the active companion's model (Tier A) — geometry lands in the shared cache so Home mounts instantly
        const comp = AV.state.get().companion ? E.get(AV.state.get().companion) : null;
        if (comp && S && S.supported() && S.has(comp.base)) await withTimeout(S.warm(Object.assign({ plateTitle: comp.base }, comp)), 5000, 'companion').catch(() => { });
        c.progress(.8);
        // fallback artwork must always be available: prove the SVG path renders for a sample of every category
        const sample = ['nimbit', 'rustblade', 'moonstone', 'pocketdrone', 'whisperjar'].map(id => AV.art.render(id, { no3d: true })), okArt = sample.every(h => h && h.length > 200);
        if (!okArt) throw new Error('fallback artwork failed to render');
        c.detail(`${t.count} specimen${t.count === 1 ? '' : 's'} · ${t.discovered}/${t.codexTotal} catalogued · fallback art verified${comp ? ' · companion ready' : ''}`);
      } },
    { id: 'gateway', w: 20, head: 'Opening archive gateway…', sub: 'Opening Vault Interface', timeout: 12000,
      async run(c) {
        const S = AV.stage, f0 = S && S.stats ? S.stats().frames : 0;
        AV.ui.renderTopbar(); if (AV.ui.currentScreen() !== 'home') AV.ui.go('home', {}, { silent: true }); c.progress(.35);
        // Tier A first route: wait (bounded) for its first-screen thumbnails and the first live 3D frame
        const t0 = performance.now(), pend = () => document.querySelectorAll('#stage .art-t3.is-pending').length;
        while (performance.now() - t0 < 3200 && pend() > 0) { c.progress(.35 + .4 * Math.min(1, (performance.now() - t0) / 1800)); await sleep(40); }
        if (S && S.supported()) while (performance.now() - t0 < 4200 && S.stats().frames <= f0) await sleep(30);
        c.progress(.9); AV.audio.prepare && AV.audio.prepare();
        const th = S && S.thumbStats ? S.thumbStats() : { hit: 0, rendered: 0 };
        c.detail(`Home chamber ready${S && S.supported() ? ` · ${th.hit} thumbnail${th.hit === 1 ? '' : 's'} from cache, ${th.rendered} drawn` : ' · 2D mode'}`);
      } },
  ];
  state.stages = STAGES.map(s => s.id);

  // ------------------------------------------------------------------ presentation
  const ui = {
    el: null, i: -1, base: 0, lastPct: -1, loreT: 0,
    init() {
      this.el = $('boot'); if (!this.el) return false;
      $('bootVer').textContent = `Aethervault v${AV.VERSION.number} · build ${AV.VERSION.build}`;
      $('bootSteps').innerHTML = STAGES.map(() => '<li></li>').join('');
      if (devMode) { const b = $('bootSkip'); b.hidden = false; b.addEventListener('click', () => { state.skip = true; }); document.addEventListener('keydown', e => { if (e.key === 'Escape') state.skip = true; }); }
      let li = 0; const lore = $('bootLore'); const next = () => { lore.classList.add('out'); setTimeout(() => { lore.textContent = LORE[li++ % LORE.length]; lore.classList.remove('out'); }, 420); };
      lore.textContent = LORE[Math.floor(Math.random() * LORE.length)]; this.loreT = setInterval(next, 2700);
      return true;
    },
    text(id, v) { const e = $(id); if (!e || e.textContent === v) return; e.textContent = v; e.classList.remove('swap'); void e.offsetWidth; e.classList.add('swap'); },
    progress(p) { p = Math.max(0, Math.min(1, p)); const pct = Math.round(p * 100); if (pct === this.lastPct) return; this.lastPct = pct; $('bootFill').style.transform = `scaleX(${p})`; $('bootArc').style.strokeDashoffset = String(477.5 * (1 - p)); $('bootPct').textContent = pct + '%'; $('bootBar').setAttribute('aria-valuenow', String(pct)); },
    stage(i) { this.i = i; this.text('bootHead', STAGES[i].head); this.text('bootSub', STAGES[i].sub); [...$('bootSteps').children].forEach((li, k) => { li.className = k < i ? 'on' : k === i ? 'cur' : ''; }); },
    mark(i, warn) { const li = $('bootSteps').children[i]; if (li) li.className = warn ? 'warn' : 'on'; },
    error(o) {
      this.el.dataset.state = 'error'; const box = $('bootErr'); box.hidden = false;
      box.innerHTML = `<h2>${U.esc(o.title)}</h2><p>${U.esc(o.text)}</p>${o.code ? `<code>${U.esc(o.code)}</code>` : ''}<div class="acts">${o.actions.map((a, k) => `<button type="button" class="${k === 0 ? 'primary' : ''}" data-k="${a.k}">${U.esc(a.label)}</button>`).join('')}</div>`;
      return new Promise(res => { box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { box.hidden = true; box.innerHTML = ''; this.el.dataset.state = 'loading'; res(b.dataset.k); } }, { once: true }); setTimeout(() => { const b = box.querySelector('button'); if (b) b.focus(); }, 30); });
    },
    leave() {
      clearInterval(this.loreT); this.el.dataset.state = 'leaving';
      return new Promise(res => { setTimeout(() => { this.el.remove(); res(); }, document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches ? 260 : 860); });
    },
  };

  // ------------------------------------------------------------------ runner
  /** Tier B, after Home is interactive: warm the likely-next models and prefetch the first Vault page, one small job at a time while idle. */
  function afterHome() {
    const S = AV.stage; if (!S || !S.supported() || window.__AV_NO_PREWARM) return;
    (window.requestIdleCallback || (f => setTimeout(f, 700)))(() => {
      // Tier C model files (small scripts that only register builders) arrive one at a time; nothing is built or compiled by this.
      S.ensureAll().then(() => {
        const st = AV.state.get(), keys = [], owned = Object.values(st.specimens).sort((a, b) => b.id - a.id);
        const rec = AV.recommendedContainer && AV.recommendedContainer(); if (rec && S.has('container:' + rec.ritual)) keys.push('container:' + rec.ritual);
        owned.forEach(sp => { if (S.has(sp.base) && !keys.includes(sp.base) && keys.length < 4) keys.push(sp.base); });
        return S.prewarm(keys).then(() => S.prefetchThumbs(owned.filter(sp => S.has(sp.base)).slice(0, 12), 256));
      }).catch(() => { });
    }, { timeout: 2500 });
  }
  state.afterHome = afterHome;

  async function run() {
    if (state.running || state.done) return state.report;
    state.running = true;
    let warm = false; try { warm = localStorage.getItem(WARM_KEY) === AV.VERSION.build; } catch (e) { /* ignore */ }
    const rep = state.report = { warm, startedAt: performance.now(), stages: [], degraded: [], notes: [], fallback2D: false, minMs: 0, totalMs: 0 };
    state.warm = warm;
    const haveUI = ui.init();
    // sound: browsers only allow audio after a gesture. Never wait for one — the first click/key during startup simply turns it on.
    const unlock = () => { AV.audio.init(); AV.audio.applyVolumes(); const h = $('bootHint'); if (h) h.classList.add('gone'); document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true); };
    document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
    state.unlockAudio = unlock;

    // the floor depends on what the player's own state says, read cheaply before the ledger stage
    let fastSetting = false; try { const raw = JSON.parse(localStorage.getItem(AV.state.SAVE_KEY) || 'null'); fastSetting = !!(raw && raw.settings && raw.settings.fastStartup); } catch (e) { /* ignore */ }
    const minMs = FAST ? 0 : warm ? (fastSetting ? 700 : 1700) : 3800, dwell = minMs / STAGES.length; rep.minMs = minMs;
    let doneW = 0; const totalW = STAGES.reduce((a, s) => a + s.w, 0);

    for (let i = 0; i < STAGES.length; i++) {
      const st = STAGES[i], t0 = performance.now(); let status = 'ok', detail = '', attempt = 0;
      if (haveUI) { ui.stage(i); await paint(); }
      const ctx = {
        progress: f => haveUI && ui.progress((doneW + st.w * Math.max(0, Math.min(1, f))) / totalW),
        detail: d => { detail = d; if (haveUI) ui.text('bootSub', `${st.sub} · ${d}`); },
        note: n => rep.notes.push(n),
        degrade: why => { status = 'degraded'; rep.degraded.push(st.id + ':' + why); },
        fallback: why => { status = 'fallback'; rep.fallback2D = true; rep.notes.push(why + ' — continuing in 2D'); if (AV.stage && AV.stage.fallback2D) AV.stage.fallback2D(why); detail = why + ' — 2D archive mode'; if (haveUI) ui.text('bootSub', `${st.sub} · ${detail}`); },
      };
      for (;;) {
        try { attempt++; status = 'ok'; await withTimeout(st.run(ctx), st.timeout, st.id); break; }
        catch (err) {
          console.warn('[boot]', st.id, err);
          if (st.id === 'renderer') { ctx.fallback(err.timeout ? 'renderer timed out' : 'renderer failed'); break; } // never block on 3D: the 2D archive is the safe fallback
          if (!haveUI) { status = 'error'; break; }
          const ledger = err.kind === 'ledger';
          const choice = await ui.error(ledger ? { title: 'Local ledger unreadable', text: 'The saved specimen ledger could not be read. A copy was preserved in this browser, so nothing is lost. You can try reading it again, or start a fresh archive.', code: err.backup ? 'preserved as ' + err.backup : '', actions: [{ k: 'retry', label: 'Retry' }, { k: 'fresh', label: 'Start a fresh archive' }] }
            : { title: 'Startup problem', text: `“${st.head.replace('…', '')}” did not complete. You can retry it, or continue with the plain 2D archive.`, code: String(err.message || err).slice(0, 160), actions: [{ k: 'retry', label: 'Retry' }, { k: 'safe', label: 'Continue in 2D' }] });
          if (choice === 'retry') { continue; }
          if (choice === 'safe') { state.safeMode = true; rep.fallback2D = true; if (AV.stage && AV.stage.fallback2D) AV.stage.fallback2D('safe mode'); }
          status = ledger ? 'fresh-ledger' : 'skipped'; rep.degraded.push(st.id + ':' + status); break;
        }
      }
      const ms = performance.now() - t0; rep.stages.push({ id: st.id, ms: Math.round(ms), status, detail, attempts: attempt });
      doneW += st.w; if (haveUI) { ui.progress(doneW / totalW); ui.mark(i, status !== 'ok'); }
      AV.audio.cue('bootstep', i);
      // presentation floor for this stage (skipped in dev-skip / fastboot); never exceeds the share of the total floor
      if (haveUI && !state.skip && dwell > ms) { const end = performance.now() + (dwell - ms); while (performance.now() < end && !state.skip) await sleep(40); }
    }

    if (haveUI) {
      ui.progress(1); AV.audio.cue('bootdone');
      await sleep(state.skip || FAST ? 0 : 160);
      if (AV.stage && AV.stage.supported() && AV.homeView) { const hv = AV.homeView(); if (hv && hv.playIntro) hv.playIntro('rise', .9); }
      await ui.leave();
    }
    rep.totalMs = Math.round(performance.now() - rep.startedAt);
    try { if (!rep.degraded.length) localStorage.setItem(WARM_KEY, AV.VERSION.build); } catch (e) { /* ignore */ }
    state.done = true; state.running = false;
    if (AV.bus) AV.bus.emit('booted', rep);
    return rep;
  }
  state.run = run;
})();
