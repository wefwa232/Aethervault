/* AETHERVAULT — Home: the Archive Chamber. The companion stands on a lit plinth in a niche (live 3D);
 * a narrow ledger carries the featured exhibit, daily seal and catalogue progress. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, fx = AV.fx, au = AV.audio;
  const esc = U.esc;
  let view = null;

  function recommended() {
    const order = ['vault', 'reliquary', 'starlit', 'forge', 'hatchling', 'wanderer', 'capsule'];
    for (const id of order) { const c = D.CONTAINER[id], p = E.price(c); if (E.canAfford({ [p.cur]: p.amt })) return c; }
    return D.CONTAINER.wanderer;
  }
  AV.recommendedContainer = recommended;
  const dailyText = r => Object.keys(r).map(k => `${U.fmtFull(r[k])} ${D.CURRENCY[k].name.toLowerCase()}`).join(' · ');
  const gauge = (cur, after) => `<div class="gauge" style="--p:${U.clamp(cur / after * 100, 0, 100)}" role="meter" aria-valuenow="${cur}" aria-valuemin="0" aria-valuemax="${after}"><i></i></div>`;

  function render(root) {
    const s = AV.state.get(), t = E.totals(), comp = s.companion ? E.get(s.companion) : null;
    const rec = recommended(), rp = E.price(rec), daily = E.dailyStatus();
    const recent = s.recent.map(id => E.get(id)).filter(Boolean).slice(0, 7);
    const dayIdx = daily.canClaim ? daily.nextIndex : (daily.streak - 1 + 7) % 7;
    const news = D.NEWS, pers = comp && comp.personality ? D.PERSONALITIES.find(p => p.id === comp.personality) : null;
    const R = comp && SP.rarityOf(comp), it = comp && SP.itemOf(comp);
    const pc = rec.pity ? (s.pity[rec.id] || 0) : 0;
    const nextRw = D.DAILY_REWARDS[daily.canClaim ? daily.nextIndex : (daily.nextIndex % 7)];

    root.innerHTML = `<div class="home">
      <section class="hall s-stage ${comp ? 'r-' + R.id : ''}" id="hall">
        <div class="hall-wall" aria-hidden="true"><i class="hall-arch"></i></div>
        <div class="hall-view" id="homeView" data-act="pet" aria-label="${comp ? 'Your companion — click to interact, drag to turn' : 'An egg awaits'}"></div>
        <div class="bubble s-label" id="bubble" role="status"></div>
        <div class="hall-plate s-label">
          <span class="label">${comp ? 'Active companion' : 'The Archive awaits'}</span>
          <h1>${comp ? esc(SP.displayName(comp)) : 'No companion yet'}</h1>
          ${comp ? `<div class="hp-row">${ui.rtag(R.id)}<span class="mono">${ui.serial(comp.serial)}</span></div>
          <ul class="hp-facts"><li><span>Form</span><b>${esc(it.stage || SP.catOf(comp).single)}</b></li><li><span>Stage</span><b>${esc(SP.stageName(comp))}</b></li><li><span>Nature</span><b>${esc(pers.name)}</b></li><li><span>Condition</span><b>${esc(SP.conditionLabel(comp))}</b></li></ul>`
          : '<p class="muted">Hatch a pet and it will wait here for you.</p>'}
          <div class="hp-act">${comp ? `<button class="btn quiet" data-go="pets">${A.icon('paw')}Living wing</button>` : `<button class="btn primary" data-go="open">${A.icon('open')}Find an egg</button>`}</div>
        </div>
        <div class="hall-strip">
          <span class="label">Recent accessions</span>
          <div class="acc-row s-tray" role="list">${recent.length ? recent.map(sp => { const r = SP.rarityOf(sp); return `<button class="acc r-${r.id}" data-id="${sp.id}" role="listitem" aria-label="${esc(SP.displayName(sp))}, ${r.name}" title="${esc(SP.displayName(sp))} · ${r.name}">${A.render(sp)}<i></i></button>`; }).join('') : '<span class="dim tiny acc-empty">Nothing catalogued yet — open a container.</span>'}</div>
        </div>
        <div class="hall-news" aria-label="Archive bulletin"><span class="label">Bulletin</span><span class="news-line" id="newsLine">${esc(news[0])}</span></div>
      </section>

      <aside class="ledger-col">
        <section class="exhibit s-frame r-x" style="--t0:${rec.theme[0]};--t1:${rec.theme[1]}">
          <div class="ex-in">
            <div class="ex-img">${A.container3(rec.ritual, rec.theme)}</div>
            <div class="ex-txt"><span class="label">Featured exhibit</span><h2>${esc(rec.name)}</h2><p class="muted">${esc(rec.desc)}</p></div>
            ${rec.pity ? `<div class="ex-gauge"><div class="ex-gh"><span class="label">Guarantee</span><span class="mono tiny">${pc}/${rec.pity.after}</span></div>${gauge(pc, rec.pity.after)}<span class="tiny dim">${D.RARITY[rec.pity.rarity].name} or better is certain after ${rec.pity.after} pulls without one.</span></div>` : ''}
            <div class="ex-act"><button class="btn primary major" data-act="feat">Open now</button>${ui.cost(rp.cur, rp.amt, true)}</div>
            <div class="ex-more"><button class="btn quiet small" data-go="open">All containers</button><details class="pity-all"><summary class="btn quiet small">Meters</summary><div class="pity-list">${D.CONTAINERS.filter(c => c.pity).map(c => { const cur = s.pity[c.id] || 0; return `<div class="pity"><span>${esc(c.name)}</span><small class="mono">${cur}/${c.pity.after}</small>${gauge(cur, c.pity.after)}</div>`; }).join('')}</div></details></div>
          </div>
        </section>

        <section class="seal s-matte pad-s tab-l">
          <div class="seal-h"><span class="label">Daily seal</span><span class="mono tiny dim">${daily.streak}-day streak</span></div>
          <div class="days" role="list">${D.DAILY_REWARDS.map((r, i) => { const claimed = daily.canClaim ? i < daily.nextIndex : i <= dayIdx, today = daily.canClaim && i === daily.nextIndex; return `<span class="day ${claimed ? 'claimed' : ''} ${today ? 'today' : ''} ${i === 6 ? 'big' : ''}" role="listitem" title="Day ${i + 1}: ${dailyText(r)}">${claimed ? A.icon('check') : i + 1}</span>`; }).join('')}</div>
          <div class="seal-act"><span class="tiny muted">${daily.canClaim ? `Day ${daily.nextIndex + 1}: ${dailyText(nextRw)}` : 'Claimed. Return tomorrow.'}</span><button class="btn ${daily.canClaim ? 'primary' : 'ghost'} small" data-act="claim" ${daily.canClaim ? '' : 'disabled'}>${daily.canClaim ? 'Claim' : 'Done'}</button></div>
        </section>

        <section class="cata s-matte pad-s">
          <div class="seal-h"><span class="label">Catalogued</span><span class="mono">${t.discovered}<span class="dim">/${t.codexTotal}</span></span></div>
          <div class="ticks" style="--n:${t.discovered};--t:${t.codexTotal}"></div>
          <ul class="cata-kv"><li><span>Specimens</span><b class="mono">${U.fmtFull(t.count)}</b></li><li><span>Vault value</span><b class="mono">${U.fmt(t.value)}</b></li><li><span>Favorites</span><b class="mono">${t.favorites}</b></li></ul>
        </section>
      </aside>
    </div>`;

    // ---- 3D companion (falls back to SVG on a pedestal)
    const host = root.querySelector('#homeView'); let bt = null, lastInput = Date.now();
    const bubble = root.querySelector('#bubble');
    const say = (txt, ms = 3400) => { bubble.textContent = txt; bubble.classList.add('show'); clearTimeout(bt); bt = setTimeout(() => bubble.classList.remove('show'), ms); };
    const spec = comp || null;
    function mountView() {
      if (view) { view.dispose(); view = null; }
      if (AV.stage && AV.stage.supported()) {
        if (comp && AV.stage.has(comp.base)) view = AV.stage.view(host, { mode: 'display', interactive: true, trackWindow: true, layer: 0, margin: 1.08, label: `${SP.displayName(comp)}, your companion. Drag to turn it.` });
        else if (!comp) view = AV.stage.view(host, { mode: 'display', interactive: true, layer: 0, margin: 1.12, label: 'A dormant egg' });
        if (view) {
          if (comp) view.setSpec(Object.assign({ plateTitle: SP.displayName(comp) }, comp)); else view.setSpec({ container: 'egg', theme: ['#d7b46e', '#ff9ad1'], name: 'First Egg', plateTitle: 'Dormant egg', plateSub: '—' });
          view.playIntro('rise', .9);
          if (AV._delight) { AV._delight = false; setTimeout(() => view && view.react('delight'), 700); }
        }
      }
      if (!view) host.innerHTML = `<div class="hall-fallback">${comp ? A.render(comp, { no3d: true }) : A.container('egg', ['#d7b46e', '#ff9ad1'])}<i class="fb-plinth"></i></div>`;
    }
    mountView(); AV.homeView = () => view;
    ui.onLeave(() => { if (view) { view.dispose(); view = null; } clearTimeout(bt); clearInterval(rot); });
    // bulletin rotation (one line at a time)
    let ni = 0; const nl = root.querySelector('#newsLine'); const rot = setInterval(() => { ni = (ni + 1) % news.length; nl.classList.add('out'); setTimeout(() => { nl.textContent = news[ni]; nl.classList.remove('out'); }, 350); }, 9000);

    root.addEventListener('pointerdown', () => { lastInput = Date.now(); });
    root.addEventListener('click', e => {
      const go = e.target.closest('[data-go]'); if (go) { ui.go(go.dataset.go); return; }
      const m = e.target.closest('.mini, .acc'); if (m) { AV.inspect(m.dataset.id, { ids: recent.map(x => x.id) }); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'feat') AV.opening.start(rec.id, 1);
      else if (a.dataset.act === 'claim') {
        const r = E.claimDaily(); if (!r.ok) return;
        au.play('coin'); setTimeout(() => au.play('coin'), 90); fx.burstAt(a, { count: 24, colors: ['#d7b46e', '#ece3cf'], speed: 5 });
        ui.toast(`Day ${r.streak > 7 ? ((r.streak - 1) % 7) + 1 : r.streak} seal claimed`, { kind: 'good', icon: 'seal' }); ui.levelToasts(r.levelUps); ui.refresh();
      } else if (a.dataset.act === 'pet') {
        if (!comp) { return; }
        say(U.pick(pers.lines)); au.play('fav');
        if (!view) fx.burstAt(host, { count: 12, colors: ['#d7b46e', '#ece3cf'], speed: 4, gravity: -.04, life: 40 });
      }
    });
    if (comp) {
      const greet = ['Welcome back, ' + s.profile.name + '.', 'The Archive hums today.', 'Shall we open something?'];
      setTimeout(() => say(U.pick(greet), 3800), 900);
      const idle = setInterval(() => { if (Date.now() - lastInput > 25000 && !bubble.classList.contains('show')) say(comp.personality === 'sleepy' ? 'Zzz…' : 'Psst… containers are waiting.', 5000); }, 8000);
      ui.onLeave(() => clearInterval(idle));
    }
    ui.sub('specimens', () => { if (!AV.opening.busy()) ui.refresh(); });
    ui.sub('companion', () => ui.refresh());
    ui.sub('openingDone', () => ui.refresh());
  }
  ui.register('home', { render });
})();
