/* AETHERVAULT — UI core: router, top bar, nav, toasts, modals, card renderers, global interaction feel. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art;
  const $ = U.$, esc = U.esc;
  const screens = {};
  let current = null, currentParams = {}, cleanups = [], stage, overlay;

  const NAV = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'open', label: 'Open', icon: 'open', hero: true },
    { id: 'vault', label: 'Vault', icon: 'vault' },
    { id: 'pets', label: 'Pets', icon: 'paw' },
    { id: 'forge', label: 'Forge', icon: 'upgrade' },
    { id: 'fusion', label: 'Fusion', icon: 'fuse' },
    { id: 'store', label: 'Store', icon: 'store' },
  ];
  const WHERE = { home: 'Archive Chamber', open: 'Containment Hall', vault: 'Specimen Catalogue', pets: 'Living Specimen Wing', forge: 'Transformation Chamber', fusion: 'Fusion Chamber', store: 'The Exchange', settings: 'Archive Controls' };

  const settings = () => AV.state.get().settings;
  const reduced = () => !!settings().reducedMotion;
  const speed = () => settings().animSpeed;               // 0 = instant
  /** Scale a duration in ms by the animation-speed setting. */
  const dur = ms => { const s = speed(); return s === 0 ? 0 : ms / s; };

  function register(name, def) { screens[name] = def; }
  /** Subscribe to the bus for the lifetime of the current screen. */
  function sub(topic, fn) { cleanups.push(AV.bus.on(topic, fn)); }
  function onLeave(fn) { cleanups.push(fn); }

  function go(name, params = {}, opts = {}) {
    if (!screens[name]) { console.warn('no screen', name); return; }
    cleanups.splice(0).forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    current = name; currentParams = params;
    AV.audio.setScreen(name);
    document.body.dataset.screen = name;
    const prevScroll = opts.keepScroll ? stage.scrollTop : 0;
    stage.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'screen screen-' + name + (opts.keepScroll ? '' : ' screen-enter');
    stage.appendChild(root);
    try { const r = screens[name].render(root, params); if (typeof r === 'function') cleanups.push(r); }
    catch (e) { console.error(e); root.innerHTML = `<div class="panel pad"><h2>Something went wrong</h2><pre>${esc(e.stack || e)}</pre></div>`; }
    stage.scrollTop = prevScroll;
    renderNav();
    if (!opts.silent) sweep();
  }
  const refresh = () => go(current, currentParams, { keepScroll: true, silent: true });
  const currentScreen = () => current;

  function sweep() {
    const s = $('#sweep'); if (!s || reduced()) return;
    s.classList.remove('run'); void s.offsetWidth; s.classList.add('run');
  }

  // ---------- Top bar ----------
  function renderTopbar() {
    const p = AV.state.get().profile, need = E.xpNeeded(p.level), pct = Math.min(100, (p.xp / need) * 100);
    const unl = E.isUnlimited(), w = AV.state.get().wallet;
    $('#topbar').innerHTML = `
      <div class="tb-left">
        <div class="wordmark" aria-label="Aethervault"><b>Aethervault</b><span>The Infinite Archive</span></div>
        <span class="where" id="where">${WHERE[current] || ''}</span>
      </div>
      <div class="tb-right">
        <div class="ledger" role="group" aria-label="Balances">${D.CURRENCIES.map(c => `<button class="cur cur-${c.id} ci-${c.id}" data-act="cur" data-cur="${c.id}" title="${c.name} — open the Exchange" aria-label="${c.name}">${A.icon(c.icon)}<span class="cv" data-val="${unl ? 0 : w[c.id]}">${unl ? '∞' : U.fmt(w[c.id])}</span><i class="plus">+</i></button>`).join('')}</div>
        <button class="mode-badge ${unl ? 'unl' : ''}" data-act="settings" title="Economy mode — open Settings to change">${unl ? 'Unlimited' : 'Standard'}</button>
        <button class="profile" data-act="profile" aria-label="Collector profile"><span class="lvl" style="--p:${pct}"><b>${p.level}</b></span><span class="pf-txt"><span class="pf-name">${esc(p.name)}</span><span class="pf-title">${esc(p.title)} · ${U.fmtFull(p.xp)}/${need} xp</span></span></button>
      </div>`;
  }
  const lastVals = {};
  function updateWallet(animate = true) {
    const w = AV.state.get().wallet, unl = E.isUnlimited();
    D.CURRENCIES.forEach(c => {
      const el = $(`#topbar .cur-${c.id} .cv`); if (!el) return;
      if (unl) { el.textContent = '∞'; lastVals[c.id] = w[c.id]; return; }
      const from = lastVals[c.id] == null ? w[c.id] : lastVals[c.id], to = w[c.id]; lastVals[c.id] = to;
      if (from === to || !animate || reduced() || speed() === 0) { el.textContent = U.fmt(to); return; }
      const pill = el.closest('.cur'); pill.classList.remove('pop-up', 'pop-dn'); void pill.offsetWidth; pill.classList.add(to > from ? 'pop-up' : 'pop-dn');
      const t0 = performance.now(), D_ = 500;
      (function step(now) { const k = Math.min(1, (now - t0) / D_), e = 1 - Math.pow(1 - k, 3); el.textContent = U.fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); })(t0);
    });
  }
  function renderNav() {
    const nav = $('#nav');
    nav.innerHTML = `<div class="rail-mark" aria-hidden="true">${A.icon('star')}</div>` + NAV.map(n => `<button class="nav-btn ${n.hero ? 'hero' : ''} ${current === n.id ? 'active' : ''}" data-nav="${n.id}" aria-label="${n.label}" ${current === n.id ? 'aria-current="page"' : ''}>
      <span class="nav-ico">${A.icon(n.icon)}</span><span class="nav-lb">${n.label}</span></button>`).join('') +
      `<span class="nav-spacer"></span><button class="nav-btn ${current === 'settings' ? 'active' : ''}" data-nav="settings" aria-label="Settings"><span class="nav-ico">${A.icon('settings')}</span><span class="nav-lb">Settings</span></button>`;
    const w = $('#where'); if (w) w.textContent = WHERE[current] || '';
  }

  // ---------- Toasts ----------
  function toast(msg, o = {}) {
    const box = $('#toasts'); const el = document.createElement('div');
    el.className = 'toast ' + (o.kind || 'info'); el.setAttribute('role', 'status');
    el.innerHTML = `${o.icon ? A.icon(o.icon) : ''}<span>${msg}</span>`;
    box.appendChild(el);
    if (!o.silent) AV.audio.play(o.kind === 'bad' ? 'error' : 'toast');
    const ms = o.ms || 3200;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
    while (box.children.length > 4) box.firstChild.remove();
  }

  // ---------- Modals ----------
  const modalStack = [];
  function modal(o) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap ' + (o.cls || '');
    wrap.innerHTML = `<div class="modal-back"></div><div class="modal panel ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title || 'Dialog')}">
      ${o.title ? `<div class="modal-head"><h2>${o.title}</h2>${o.noClose ? '' : `<button class="icon-btn m-x" data-m-close aria-label="Close">${A.icon('close')}</button>`}</div>` : ''}
      <div class="modal-body">${o.html || ''}</div>
      ${o.buttons ? `<div class="modal-foot">${o.buttons.map((b, i) => `<button class="btn ${b.kind || 'ghost'}" data-m-btn="${i}" ${b.disabled ? 'disabled' : ''}>${b.icon ? A.icon(b.icon) : ''}${b.label}</button>`).join('')}</div>` : ''}
    </div>`;
    overlay.appendChild(wrap);
    let done, closed = false;
    const promise = new Promise(r => (done = r));
    const api = { el: wrap, noClose: !!o.noClose, body: wrap.querySelector('.modal-body'), promise, close(v) { if (closed) return; closed = true; const i = modalStack.indexOf(api); if (i >= 0) modalStack.splice(i, 1); wrap.classList.add('closing'); setTimeout(() => wrap.remove(), reduced() ? 0 : 220); if (o.onClose) o.onClose(v); done(v); } };
    wrap.addEventListener('click', e => {
      if (e.target.matches('.modal-back') && o.dismiss !== false && !o.noClose) api.close(o.dismissValue);
      else if (e.target.closest('[data-m-close]')) api.close(o.dismissValue);
      else { const b = e.target.closest('[data-m-btn]'); if (b) { const def = o.buttons[+b.dataset.mBtn]; if (def.onClick) { const r = def.onClick(api); if (r === false) return; } api.close(def.value); } }
    });
    modalStack.push(api);
    const first = wrap.querySelector('[data-m-btn].primary, [data-m-btn].danger, input, [data-m-btn]'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
    if (o.onOpen) o.onOpen(api);
    return api;
  }
  function confirm(o) {
    const m = modal({
      title: o.title || 'Are you sure?', cls: 'confirm ' + (o.danger ? 'danger' : ''),
      html: `<p class="confirm-msg">${o.message || ''}</p>${o.extra || ''}`,
      buttons: [{ label: o.cancelText || 'Cancel', kind: 'ghost', value: false }, { label: o.confirmText || 'Confirm', kind: o.danger ? 'danger' : 'primary', value: true, icon: o.icon }],
      dismissValue: false,
    });
    return m.promise;
  }
  function prompt(o) {
    const m = modal({
      title: o.title, cls: 'prompt',
      html: `<label class="field"><span>${o.label || ''}</span><input type="text" maxlength="${o.max || 24}" value="${esc(o.value || '')}" placeholder="${esc(o.placeholder || '')}" data-prompt-in></label>`,
      buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: o.okText || 'Save', kind: 'primary', value: '__ok', icon: 'check' }],
      dismissValue: null,
      onOpen(api) { const inp = api.el.querySelector('input'); inp.focus(); inp.select(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') api.el.querySelector('[data-m-btn].primary').click(); }); },
    });
    return m.promise.then(v => (v === '__ok' ? m.el.querySelector('input').value : null));
  }
  function closeTop() { const m = modalStack[modalStack.length - 1]; if (m && !m.noClose) { m.close(); return true; } return !!m; }
  const hasModal = () => modalStack.length > 0;

  // ---------- Renderers ----------
  const rtag = rid => `<span class="rtag r-${rid}">${A.rarityGlyph(rid)}<b>${D.RARITY[rid].name}</b></span>`;
  const cost = (cur, amt, afford = true) => `<span class="cost ci-${cur} ${afford ? '' : 'bad'}" title="${D.CURRENCY[cur].name}">${A.icon(D.CURRENCY[cur].icon)}<b>${E.isUnlimited() && cur !== 'cash' ? '∞' : U.fmt(amt)}</b></span>`;
  const costOnly = (cur, amt, afford = true) => `<span class="cost ci-${cur} ${afford ? '' : 'bad'}">${A.icon(D.CURRENCY[cur].icon)}<b>${U.fmt(amt)}</b></span>`;
  const serial = n => '#' + U.pad(n, 4);
  const pips = s => { let h = ''; for (let i = 0; i < 4; i++) h += `<i class="pip ${i < s.level ? 'on' : ''}"></i>`; return `<span class="pips" title="${SP.stageName(s)} stage">${h}</span>`; };

  /** Catalogue plate: art first, minimal metadata (name, rarity index, serial). */
  function card(s, o = {}) {
    const it = SP.itemOf(s), R = SP.rarityOf(s), v = SP.variantOf(s);
    const flags = (s.favorite ? `<span class="flag fav" title="Favorite">${A.icon('heart')}</span>` : '') + (s.locked ? `<span class="flag lk" title="Locked">${A.icon('lock')}</span>` : '') + (E.get(s.id) && AV.state.get().companion === s.id ? `<span class="flag cmp" title="Active companion">${A.icon('paw')}</span>` : '');
    return `<div class="plate r-${R.id} ${o.cls || ''} ${s.favorite ? 'is-fav' : ''} ${s.locked ? 'is-locked' : ''} ${o.selected ? 'is-sel' : ''} ${o.isNew ? 'is-new' : ''}" data-id="${s.id}" tabindex="0" role="button" aria-label="${esc(SP.displayName(s))}, ${R.name}, ${SP.conditionLabel(s)}">
      <i class="plate-bar"></i>
      <div class="plate-art"><div class="plate-tags">${v.id !== 'none' ? `<span class="vtag var-${v.id}">${v.name}</span>` : ''}${s.level ? pips(s) : ''}</div><div class="plate-flags">${flags}</div>${A.render(s)}</div>
      <div class="plate-meta"><span class="plate-name">${esc(SP.displayName(s))}</span><span class="plate-sub"><span class="sr-n">${A.rarityGlyph(R.id)}<span>${serial(s.serial)}</span></span><span class="val">${A.icon('coin')}${U.fmt(SP.value(s))}</span></span></div>
      ${o.select ? `<span class="sel-box">${A.icon('check')}</span>` : ''}${o.isNew ? '<span class="new-badge">NEW</span>' : ''}
    </div>`;
  }
  /** Compact row used in lists (recent pulls, upgrade picker, confirmations). */
  function mini(s, o = {}) {
    const R = SP.rarityOf(s);
    return `<button class="mini r-${R.id} ${o.selected ? 'is-sel' : ''} ${o.cls || ''}" data-id="${s.id}" aria-label="${esc(SP.displayName(s))}, ${R.name}">
      <span class="mini-art">${A.render(s)}</span>
      <span class="mini-txt"><b>${esc(SP.displayName(s))}</b><small>${R.name}${s.level ? ' · ' + SP.stageName(s) : ''} · ${serial(s.serial)}</small></span>
      ${s.favorite ? `<span class="flag fav">${A.icon('heart')}</span>` : ''}${s.locked ? `<span class="flag lk">${A.icon('lock')}</span>` : ''}
    </button>`;
  }
  const bar = (p, cls = '') => `<div class="bar ${cls}"><i style="width:${U.clamp(p, 0, 100)}%"></i></div>`;
  const empty = (icon, title, text, btn) => `<div class="empty">${A.icon(icon)}<h3>${title}</h3><p>${text}</p>${btn || ''}</div>`;

  // ---------- Settings → DOM ----------
  function applySettings() {
    const s = settings(), b = document.body, r = document.documentElement.style;
    b.classList.toggle('reduce-motion', !!s.reducedMotion);
    b.classList.toggle('no-flash', !s.flashing);
    r.setProperty('--ts', s.textSize);
    r.setProperty('--spd', s.animSpeed === 0 ? '0.01' : String(1 / s.animSpeed));
    AV.audio.applyVolumes();
    if (AV.fx && AV.fx.wake) AV.fx.wake();
  }

  // ---------- Global interaction feel ----------
  let hoverEl = null;
  function initFeel() {
    document.addEventListener('pointerover', e => {
      const el = e.target.closest ? e.target.closest('.btn, .nav-btn, .plate, .cur, .chip, .tile, .mini, .icon-btn, .profile, [data-snd]') : null;
      if (el && el !== hoverEl && !el.disabled) AV.audio.play('hover'); hoverEl = el;
    });
    document.addEventListener('pointerdown', () => AV.audio.init(), { once: false, capture: true });
    document.addEventListener('click', e => {
      const el = e.target.closest ? e.target.closest('button, [data-act], .plate, .tile, .chip') : null;
      if (el && !el.disabled && !el.hasAttribute('data-nosound')) AV.audio.play(el.matches('.btn.primary, .btn.danger') ? 'soft' : 'click');
    }, true);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && closeTop()) { e.preventDefault(); }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.plate[role=button], .tile[tabindex]')) { e.preventDefault(); e.target.click(); }
    });
    // Top bar + nav delegation
    document.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]'); if (nav) { AV.audio.play('nav'); if (AV.opening && AV.opening.busy()) return; go(nav.dataset.nav); return; }
      const act = e.target.closest('#topbar [data-act]'); if (!act) return;
      if (act.dataset.act === 'settings') go('settings');
      else if (act.dataset.act === 'cur') go('store');
      else if (act.dataset.act === 'profile') AV.profileModal();
    });
  }

  function profileModal() {
    const s = AV.state.get(), t = E.totals(), p = s.profile;
    const rows = D.RARITIES.map(r => `<li class="r-${r.id}"><span class="rtag">${A.rarityGlyph(r.id)}<b>${r.name}</b></span><b>${U.fmtFull(s.stats.byRarity[r.id] || 0)}</b></li>`).join('');
    const m = modal({
      title: 'Collector Profile', cls: 'profile-modal',
      html: `<div class="pm-head"><span class="lvl big" style="--p:${Math.min(100, p.xp / E.xpNeeded(p.level) * 100)}"><b>${p.level}</b></span><div><h3>${esc(p.name)}</h3><p>${esc(p.title)} · Level ${p.level}</p><p class="muted">Since ${new Date(p.createdAt).toLocaleDateString()}</p></div></div>
        <div class="stat-grid"><div><b>${U.fmtFull(t.count)}</b><span>Specimens</span></div><div><b>${U.fmt(t.value)}</b><span>Vault value</span></div><div><b>${t.discovered}/${t.codexTotal}</b><span>Codex</span></div><div><b>${U.fmtFull(s.stats.opened)}</b><span>Containers opened</span></div><div><b>${U.fmtFull(s.stats.upgrades)}</b><span>Upgrades</span></div><div><b>${U.fmtFull(s.stats.evolutions)}</b><span>Evolutions</span></div></div>
        <h4 class="sect">Pulls by rarity</h4><ul class="rar-list">${rows}</ul>`,
      buttons: [{ label: 'Rename Collector', kind: 'ghost', icon: 'edit', value: 'rename' }, { label: 'Close', kind: 'primary', value: 'close' }],
    });
    m.promise.then(async v => {
      if (v !== 'rename') return;
      const name = await prompt({ title: 'Rename Collector', label: 'Collector name', value: p.name, max: 20 });
      if (name && name.trim()) { p.name = name.trim().slice(0, 20); AV.state.save(); renderTopbar(); toast('Welcome, ' + esc(p.name) + '.', { kind: 'good', icon: 'check' }); }
    });
  }
  AV.profileModal = profileModal;

  function boot() {
    stage = $('#stage'); overlay = $('#overlay');
    renderTopbar(); renderNav(); initFeel(); applySettings();
    AV.bus.on('wallet', () => updateWallet(true));
    AV.bus.on('mode', () => { renderTopbar(); if (current) refresh(); });
    AV.bus.on('profile', () => {
      const p = AV.state.get().profile, need = E.xpNeeded(p.level), pct = Math.min(100, p.xp / need * 100);
      const ring = $('#topbar .lvl'); if (ring) { ring.style.setProperty('--p', pct); ring.firstElementChild.textContent = p.level; }
      const t = $('#topbar .pf-title'); if (t) t.textContent = `${p.title} · ${U.fmtFull(p.xp)}/${need} xp`;
    });
    AV.bus.on('settings', () => applySettings());
    AV.bus.on('reset', () => { Object.keys(lastVals).forEach(k => delete lastVals[k]); renderTopbar(); applySettings(); });
  }

  /** Announce level-ups gained by an action. */
  function levelToasts(ups) { (ups || []).forEach((lv, i) => setTimeout(() => { AV.audio.play('levelup'); toast(`Level ${lv} reached — +10 gems, +200 credits`, { kind: 'rare', icon: 'star', ms: 4200, silent: true }); AV.fx.burst(window.innerWidth / 2, 60, { count: 22, colors: ['#d7b46e', '#ece3cf'], speed: 5 }); }, i * 700)); }

  AV.ui = { register, go, refresh, currentScreen, sub, onLeave, renderTopbar, updateWallet, toast, modal, confirm, prompt, closeTop, hasModal,
    rtag, cost, costOnly, serial, pips, card, mini, bar, empty, applySettings, boot, dur, speed, reduced, levelToasts, sweep };
})();
