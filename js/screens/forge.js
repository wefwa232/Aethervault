/* AETHERVAULT — Forge: the Transformation Chamber. The specimen stands in a lit chamber between two coil pylons;
 * one pedestal lamp per upgrade stage ignites as it advances.
 * Phase Three: category stage names, per-stat upgrade previews with a cached before/after pair, a live 3D preview of the next stage,
 * evolution levers (pets), and major transformations — a single final form or a branch choice — with confirmation, fee-based re-binding
 * and a short progression ledger. The chamber stays focused on the specimen: all data lives in the console below it. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio, fx = AV.fx, ST = AV.stats, PR = AV.progress, SU = AV.statsUI;
  const esc = U.esc;
  let selId = null, cat = 'all', q = '', view = null, preview = null;

  function candidates() {
    const ql = q.trim().toLowerCase();
    return E.all().filter(s => (cat === 'all' || SP.itemOf(s).cat === cat) && (!ql || (SP.displayName(s) + ' ' + SP.itemOf(s).name).toLowerCase().includes(ql)))
      .sort((a, b) => SP.rarityTier(b) - SP.rarityTier(a) || SP.value(b) - SP.value(a));
  }

  /** Cinematic transformation sequence (evolution or major form). Resolves when dismissed.
   *  from/to: { id, name, rarity }; spec: the specimen after the change; opts.fromSpec: how it looked before; opts.label: headline word. */
  function evolveCinematic(from, to, spec, opts = {}) {
    return new Promise(resolve => {
      const el = document.createElement('div'); el.className = 'evo-cine'; const R = D.RARITY[to.rarity];
      el.style.setProperty('--rc', R.color);
      const fromSpec = Object.assign({}, opts.fromSpec || spec, { base: from.id, look: 'auto' }), toSpec = Object.assign({}, spec, { look: 'auto' });
      const has3 = AV.stage && AV.stage.supported() && AV.stage.has(to.id) && AV.stage.has(from.id);
      el.innerHTML = `<div class="evo-bg"></div>
        <div class="evo-stage ${has3 ? '' : 'evo-flat'}">${has3 ? '<div class="evo-view"></div>' : `<div class="evo-old">${A.render(fromSpec, { no3d: true })}</div><div class="evo-new">${A.render(toSpec, { no3d: true })}</div>`}</div>
        <div class="evo-text"><span class="label">${esc(opts.label || 'Evolution')}</span><h2>${esc(from.name)} <span>→</span> ${esc(to.name)}</h2><div>${ui.rtag(R.id)}</div><button class="btn primary major" data-done>Continue</button></div>
        <button class="btn quiet evo-skip" data-skip>${A.icon('skip')}Skip</button>`;
      document.body.appendChild(el);
      const seq = new AV.opening.Seq(); const w = ms => seq.wait(ui.dur(ms));
      let ev = null;
      if (has3) {
        ev = AV.stage.view(el.querySelector('.evo-view'), { mode: 'display', interactive: true, layer: 3, margin: 1.05, label: opts.label || 'Evolution', motes: true, moteColor: R.color });
        if (ev && ev.setSpec(Object.assign({ plateTitle: from.name }, fromSpec))) { /* old form first */ } else { if (ev) ev.dispose(); ev = null; }
      }
      const done = () => { el.classList.add('out'); setTimeout(() => { if (ev) ev.dispose(); el.remove(); }, ui.reduced() ? 0 : 300); resolve(); };
      el.querySelector('[data-done]').onclick = done;
      el.querySelector('[data-skip]').onclick = () => seq.skip();
      el.addEventListener('click', e => { if (!e.target.closest('button') && !e.target.closest('.evo-view')) seq.skip(); });
      (async () => {
        const c = { x: innerWidth / 2, y: innerHeight * .42 };
        el.classList.add('p1'); au.play('evolve'); au.duck(.15, 6000);
        fx.converge(c.x, c.y, { count: 60, colors: ['#ece3cf', R.color, '#d7b46e'], radius: 380, life: 90 });
        if (ev) ev.react('surge');
        await w(1700); el.classList.add('p2'); fx.flash('#fff', 600, .8); fx.shake(12, 560);
        if (ev) { ev.setSpec(Object.assign({ plateTitle: to.name }, toSpec), { silhouette: true }); }
        await w(350); el.classList.add('p3');
        if (ev) { ev.setSilhouette(false); ev.playIntro('pop', .9); ev.react('delight'); }
        fx.ring(c.x, c.y, R.color, 420, 44, 8); fx.ring(c.x, c.y, '#ece3cf', 300, 36, 5); fx.burst(c.x, c.y, { count: 80, colors: ['#ece3cf', R.color, '#d7b46e'], speed: 10, life: 60 });
        if (to.rarity === 'legendary') fx.confetti({ count: 50, colors: ['#d7b46e', '#ece3cf'] });
        await w(500); el.classList.add('p4');
      })();
    });
  }

  /** Console column 1: the next upgrade — stages, before/after, per-stat changes, what is unlocked, cost. */
  function upgradeCard(s, pv, unl) {
    if (!pv.cost) {
      const top = s.level >= 4;
      return `<div class="con-h"><span class="label">Upgrade</span></div><h3 class="con-next">${top ? esc(PR.stageName(s.base, 4)) + ' reached' : 'At its limit'}</h3><p class="muted tiny">${top ? 'This specimen has reached its final upgrade stage.' : 'Potential below 25% cannot go beyond the ' + esc(PR.stageName(s.base, 3)) + ' stage.'}</p>`;
    }
    const fam = ST.familyOf(s.base), afford = pv.affordable, rows = pv.current.list.filter(x => x.k !== 'growth').map(x => { const n = pv.next.map[x.k]; return `<div class="up-row"><span class="k">${esc(x.label)}</span><span class="v mono">${x.value}</span><span class="arr">→</span><span class="v mono">${n}</span><span class="d mono">▲ +${n - x.value}</span></div>`; }).join('');
    const nextSpec = Object.assign({}, s, { level: s.level + 1, look: 'auto' }), nowSpec = Object.assign({}, s, { look: 'auto' });
    return `<div class="con-h"><span class="label">Upgrade · ${esc(fam.name)}</span></div>
      <h3 class="con-next">${esc(pv.stage)} <span class="dim">→</span> ${esc(pv.nextStage)}</h3>
      <div class="ba"><figure>${A.render(nowSpec)}<figcaption>Now</figcaption></figure><span class="ar">→</span><figure>${A.render(nextSpec)}<figcaption>${esc(pv.nextStage)}</figcaption></figure></div>
      <div class="up-rows" aria-label="Statistic changes">${rows}</div>
      ${pv.unlock ? `<p class="unlock-note"><b>Newly unlocked:</b> ${esc(pv.unlock)}.</p>` : ''}
      ${pv.gate !== 'none' ? `<p class="gate-note">At ${esc(pv.nextStage)} ${pv.gate === 'evolution' ? 'its evolution' : 'its major transformation'} becomes available.</p>` : ''}
      <div class="costs">${ui.cost('essence', pv.cost.essence, E.canAfford({ essence: pv.cost.essence }))}${ui.cost('credits', pv.cost.credits, E.canAfford({ credits: pv.cost.credits }))}</div>
      <div class="con-btns"><button class="btn primary major" data-act="up" ${afford ? '' : 'disabled'}>${afford ? 'Upgrade' : 'Not enough resources'}</button><button class="btn ghost ${preview && preview.kind === 'stage' ? 'on' : ''}" data-act="prevstage">${A.icon('eye')}Preview in 3D</button></div>
      ${afford ? '' : `<button class="btn quiet small" data-go="store">Get essence at the Exchange</button>`}`;
  }

  /** Console column 2: evolution levers (pets) and the major transformation (forms / branches). */
  function transformCard(s, unl) {
    const it = SP.itemOf(s), opts = E.evolveOptions(s), to = E.transformOptions(s), can3 = AV.stage && AV.stage.supported() && AV.stage.has(s.base);
    let html = `<div class="con-h"><span class="label">${to.kind === 'evolution' ? 'Evolution' : 'Transformation'}</span></div>`;
    if (opts.length) {
      html += opts.map(o => {
        const t = D.ITEMS[o.ev.to], known = AV.state.get().discovered[t.id], ok = o.ready && o.affordable;
        return `<div class="lever ${o.ready ? 'ready' : ''} ${preview && preview.to === t.id ? 'prev' : ''}"><span class="lv-art">${A.render(t.id, known ? {} : { silhouette: true })}</span><div class="lv-t"><b>${known ? esc(t.name) : 'Undiscovered form'}</b><small>${esc(o.ev.label)} · ${D.RARITY[t.rarity].name}</small><div class="evo-req">${o.ready ? `<span class="good-txt">${A.icon('check')}${esc(PR.stageName(s.base, o.ev.level))} reached</span>` : `<span class="bad-txt">Needs ${esc(PR.stageName(s.base, o.ev.level))}</span>`} ${ui.cost('essence', o.ev.essence, o.affordable)}</div></div>
          <div class="lv-btns">${AV.stage && AV.stage.supported() && AV.stage.has(t.id) && can3 ? `<button class="btn ghost small" data-prevevo="${t.id}">${A.icon('eye')}Preview</button>` : ''}<button class="btn ${ok ? 'primary' : 'ghost'} small" data-evo="${t.id}" ${ok ? '' : 'disabled'}>Evolve</button></div></div>`;
      }).join('') + `<p class="muted tiny">Evolution keeps the serial, pattern, potential and history and most of the growth earned so far; its stage restarts so the new form can be developed. The earlier species stays selectable as an appearance.</p>`;
      return html;
    }
    if (to.kind !== 'form') return html + '<p class="muted tiny">No transformation is known for this specimen.</p>';
    const stageN = PR.stageName(s.base, to.levelNeeded), cost = to.cost;
    if (!s.form) html += `<p class="muted tiny">${to.stageReady ? `<b class="good-txt">${esc(stageN)} reached.</b>` : `Unlocks at <b>${esc(stageN)}</b> (now ${esc(PR.stageName(s.base, s.level))}).`} ${to.branching ? 'Compare the branches, then commit to one.' : 'Its final form.'} Cost ${ui.cost('essence', cost.essence, E.canAfford({ essence: cost.essence }))} ${ui.cost('credits', cost.credits, E.canAfford({ credits: cost.credits }))}</p>`;
    html += to.forms.map(f => {
      const fm = f.form, base = ST.compute(s).map, lean = SU.leanChips(fm), isPrev = preview && preview.form === fm.id;
      const choose = !s.form ? `<button class="btn ${f.ready && f.affordable ? 'primary' : 'ghost'} small" data-form="${fm.id}" ${f.ready && f.affordable ? '' : 'disabled'} title="${f.ready ? '' : 'Reach ' + esc(stageN) + ' first'}">${to.branching ? 'Choose this path' : 'Transform'}</button>`
        : (f.current ? '<span class="good-txt">' + A.icon('check') + ' Current form</span>' : `<button class="btn ghost small" data-reform="${fm.id}" ${E.canAfford(to.reformCost) ? '' : 'disabled'}>Re-bind${E.isUnlimited() ? ' (free)' : ' · ' + to.reformCost.essence + ' essence'}</button>`);
      return `<div class="branch ${f.ready ? 'ready' : ''} ${f.current ? 'cur' : ''} ${isPrev ? 'prev' : ''}"><div class="br-h"><b>${esc(fm.name)}</b><small>${esc(fm.kind)}${to.branching ? ' · branch' : ''}</small></div><p class="tr-blurb">${esc(fm.blurb)}</p><div class="leans">${lean}</div><p class="muted tiny">${esc(fm.behave)} Appearance: ${fm.motifs.map(m => esc(m.replace('elem:', ''))).join(', ')}.</p><div class="br-btns">${can3 ? `<button class="btn ghost small ${isPrev ? 'on' : ''}" data-prevform="${fm.id}">${A.icon('eye')}Preview</button>` : ''}${choose}</div></div>`;
    }).join('');
    if (s.form && to.branching) html += `<p class="muted tiny">Re-binding keeps your progress; the previous branch stays available as an appearance in Inspect.</p>`;
    return html;
  }

  function render(root, params) {
    if (params && params.select && E.get(params.select)) { selId = params.select; preview = null; }
    const draw = () => {
      if (view) { view.dispose(); view = null; }
      const list = candidates();
      if (!selId || !E.get(selId)) { const has3 = x => AV.stage && AV.stage.supported() && AV.stage.has(x.base); selId = ((list.find(has3) || list[0]) || {}).id || null; }
      const s = selId ? E.get(selId) : null;
      const unl = E.isUnlimited(), shown = list.slice(0, 120);
      let console_ = '', head = '';
      if (s) {
        const it = SP.itemOf(s), R = SP.rarityOf(s), max = SP.maxLevel(s), pv = E.upgradePreview(s.id), names = PR.stageNames(s.base);
        const pvName = !preview ? '' : preview.kind === 'stage' ? 'Next stage: ' + PR.stageName(s.base, s.level + 1) : preview.kind === 'form' ? 'Branch: ' + PR.form(preview.form).name : 'Evolved form: ' + D.ITEMS[preview.to].name;
        head = `<div class="ch-title"><span class="label">${SP.catOf(s).single}${it.stage ? ' · ' + esc(it.stage) : ''}${s.form ? ' · ' + esc(PR.form(s.form).name) : ''}</span><h2>${esc(SP.displayName(s))}</h2><div>${ui.rtag(R.id)} <span class="mono tiny dim">${ui.serial(s.serial)}</span></div></div>
          <ol class="lamps" aria-label="Upgrade stages">${names.map((n, i) => `<li class="lamp ${i < s.level ? 'done' : ''} ${i === s.level ? 'now' : ''} ${i > max ? 'locked' : ''}"><i>${i > max ? A.icon('lock') : (i < s.level ? A.icon('check') : i + 1)}</i><span>${esc(n)}</span></li>`).join('')}</ol>
          ${preview ? `<div class="ch-preview s-label"><span class="label">Preview</span><b>${esc(pvName)}</b><button class="btn quiet small" data-act="unpreview">Close preview</button></div>` : ''}`;
        const prot = s.favorite || s.locked ? `<p class="muted tiny con-note">${s.locked ? 'Locked' : 'Favorited'}: upgrades and transformations never consume other specimens, but they do change this one — you will be asked to confirm.</p>` : '';
        console_ = `<div class="console s-matte"><div class="con-up con-scroll">${upgradeCard(s, pv, unl)}
            <p class="muted tiny con-note">Upgrades are permanent and refund 50% of invested essence if the specimen is later dismantled.${unl ? ' <b class="hot">Unlimited Mode: upgrades and transformations are free.</b>' : ''}</p>${prot}</div>
          <div class="con-evo con-scroll">${transformCard(s, unl)}<div class="con-h" style="margin-top:.8rem"><span class="label">Recent progression</span></div>${SU.ledger(s, 3)}</div></div>`;
      }
      root.innerHTML = `<div class="chamber">
        <aside class="bench s-matte sq"><h3 class="sect">Specimens</h3>
          <label class="search small">${A.icon('search')}<input id="fq" type="search" placeholder="Search…" value="${esc(q)}" aria-label="Search specimens"></label>
          <div class="chips tight">${[['all', 'All']].concat(D.CATEGORIES.map(c => [c.id, c.name])).map(([id, n]) => `<button class="chipk ${cat === id ? 'on' : ''}" data-cat="${id}">${n}</button>`).join('')}</div>
          <div class="mini-list tall" id="fList">${shown.length ? shown.map(x => ui.mini(x, { selected: x.id === selId })).join('') : '<p class="muted">No specimens match.</p>'}</div>
          ${list.length > shown.length ? `<p class="muted tiny">Showing ${shown.length} of ${list.length} — search to narrow.</p>` : ''}</aside>
        <section class="lab">
          ${s ? `<div class="chamber-stage s-stage r-${SP.rarityOf(s).id}"><div class="cs-view" id="csView"></div>${head}<button class="btn quiet small cs-reset" data-act="reset">${A.icon('drag')}Reset view</button></div>${console_}`
            : `<div class="chamber-stage s-stage">${ui.empty('upgrade', 'Nothing to forge', 'Open some containers and bring a specimen here to enhance it.', `<button class="btn primary" data-go="open">${A.icon('open')}Open a container</button>`)}</div>`}
        </section></div>`;
      if (s) {
        const host = root.querySelector('#csView');
        const spec0 = Object.assign({ plateTitle: SP.displayName(s) }, s);
        let spec = spec0;
        if (preview && preview.kind === 'stage') spec = Object.assign({}, spec0, { level: Math.min(4, s.level + 1), look: 'auto' });
        else if (preview && preview.kind === 'form') spec = Object.assign({}, spec0, { form: preview.form, look: 'auto', plateTitle: PR.form(preview.form).name });
        else if (preview && preview.kind === 'evo') spec = Object.assign({}, spec0, { base: preview.to, level: 0, form: null, look: 'auto', plateTitle: D.ITEMS[preview.to].name });
        if (AV.stage && AV.stage.supported() && AV.stage.has(spec.base)) {
          view = AV.stage.view(host, { mode: 'display', interactive: true, zoom: true, forge: true, layer: 0, margin: 1.12, label: `${SP.displayName(s)} in the transformation chamber. Drag to turn.` });
          if (view) { view.setSpec(spec, { maxLevel: SP.maxLevel(s) }); view.playIntro('rise', .6); }
        }
        if (!view) host.innerHTML = `<div class="hall-fallback">${A.render(spec, { no3d: true })}<i class="fb-plinth"></i></div>`;
      }
    };
    draw();
    ui.onLeave(() => { if (view) { view.dispose(); view = null; } });
    let qt;
    root.addEventListener('input', e => { if (e.target.id === 'fq') { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value; const sel = root.querySelector('#fList'); const list = candidates().slice(0, 120); sel.innerHTML = list.length ? list.map(x => ui.mini(x, { selected: x.id === selId })).join('') : '<p class="muted">No specimens match.</p>'; }, 120); } });
    root.addEventListener('click', async e => {
      const go = e.target.closest('[data-go]'); if (go) { ui.go(go.dataset.go); return; }
      const c = e.target.closest('[data-cat]'); if (c) { cat = c.dataset.cat; draw(); return; }
      const m = e.target.closest('.mini'); if (m) { selId = m.dataset.id; preview = null; draw(); return; }
      const pe = e.target.closest('[data-prevevo]'); if (pe) { preview = preview && preview.to === pe.dataset.prevevo ? null : { kind: 'evo', to: pe.dataset.prevevo }; draw(); return; }
      const pf = e.target.closest('[data-prevform]'); if (pf) { preview = preview && preview.form === pf.dataset.prevform ? null : { kind: 'form', form: pf.dataset.prevform }; draw(); return; }
      const evo = e.target.closest('[data-evo]');
      if (evo) {
        const s = E.get(selId), toId = evo.dataset.evo, from = SP.itemOf(s), to = D.ITEMS[toId];
        const ev = from.evolves.find(x => x.to === toId), guard = s.locked || s.favorite;
        const ok = await ui.confirm({ title: `Evolve ${esc(SP.displayName(s))}?`, confirmText: 'Evolve', icon: 'evolve', message: `<b>${esc(from.name)}</b> will evolve into <b>${esc(to.name)}</b> for <b class="mono">${ev.essence} essence</b>. Its serial, pattern, potential and history are kept, along with most of the growth earned; its upgrade stage resets to ${esc(PR.stageName(toId, 0))} so the new form can be developed. ${from.evolves.length > 1 ? '<br><b>This path is a choice</b> — you cannot take the other branch with this specimen.' : ''}${guard ? '<br>This specimen is ' + (s.locked ? 'locked' : 'favorited') + '; its species will change.' : ''}` });
        if (!ok) return;
        const fromSpec = Object.assign({}, s); preview = null;
        const r = E.evolve(selId, toId); if (!r.ok) { ui.toast(r.err, { kind: 'bad', icon: 'close' }); return; }
        preview = null;
        await evolveCinematic({ id: from.id, name: from.name, rarity: from.rarity }, { id: to.id, name: to.name, rarity: to.rarity }, E.get(selId), { fromSpec }); ui.levelToasts(r.levelUps); draw();
        return;
      }
      const fm = e.target.closest('[data-form],[data-reform]');
      if (fm) {
        const s = E.get(selId), re = !!fm.dataset.reform, f = PR.form(re ? fm.dataset.reform : fm.dataset.form), opt = E.transformOptions(s), cost = re ? opt.reformCost : opt.cost;
        const now = ST.compute(s).map, after = ST.compute(s, { form: f.id }).map, d = ST.delta(now, after), guard = s.locked || s.favorite, oldF = s.form ? PR.form(s.form) : null;
        const ok = await ui.confirm({ title: `${re ? 'Re-bind to' : opt.branching ? 'Choose' : 'Transform into'} ${esc(f.name)}?`, confirmText: re ? 'Re-bind' : opt.branching ? 'Commit to this path' : 'Transform', icon: 'evolve',
          message: `<b>${esc(SP.displayName(s))}</b> — ${esc(f.kind)}: <b>${esc(f.name)}</b>.<br><span class="muted">${esc(f.blurb)}</span><div class="leans" style="margin:.5rem 0">${SU.leanChips(f)}</div>Statistic change: <b class="mono">${esc(ST.describeDelta(s, re && oldF ? ST.delta(ST.compute(s).map, after) : d)) || 'none'}</b><br>Cost: ${U.cost ? '' : ''}<b class="mono">${cost.essence ? cost.essence + ' essence' : ''}${cost.credits ? ' · ' + U.fmt(cost.credits) + ' credits' : ''}${!cost.essence && !cost.credits ? 'free (Unlimited Mode)' : ''}</b><br>${opt.branching && !re ? '<b>This is a branch choice.</b> You can re-bind to the other path later for a fee (free in Unlimited Mode), and the other look can be previewed first. ' : ''}Your earlier appearance stays selectable in Inspect.${guard ? '<br>This specimen is ' + (s.locked ? 'locked' : 'favorited') + '; its form will change.' : ''}` });
        if (!ok) return;
        preview = null; const fromSpec = Object.assign({}, s), r = re ? E.reform(selId, f.id) : E.transform(selId, f.id); if (!r.ok) { ui.toast(r.err, { kind: 'bad', icon: 'close' }); return; }
        const it = SP.itemOf(s), nm = oldF ? oldF.name : PR.stageName(s.base, s.level);
        await evolveCinematic({ id: s.base, name: nm, rarity: it.rarity }, { id: s.base, name: f.name, rarity: it.rarity }, E.get(selId), { fromSpec, label: f.kind }); if (r.levelUps) ui.levelToasts(r.levelUps); draw();
        return;
      }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'reset') { if (view) view.resetView(); }
      else if (a.dataset.act === 'unpreview') { preview = null; draw(); }
      else if (a.dataset.act === 'prevstage') { preview = preview && preview.kind === 'stage' ? null : { kind: 'stage' }; draw(); }
      else if (a.dataset.act === 'up') {
        const s0 = E.get(selId), guard = s0.locked || s0.favorite;
        if (guard) { const pv = E.upgradePreview(selId); const ok = await ui.confirm({ title: `Upgrade this ${s0.locked ? 'locked' : 'favorited'} specimen?`, confirmText: 'Upgrade', icon: 'upgrade', message: `<b>${esc(SP.displayName(s0))}</b> will move from ${esc(pv.stage)} to <b>${esc(pv.nextStage)}</b>. Nothing else is consumed.` }); if (!ok) return; }
        preview = null; const r = E.upgrade(selId); if (!r.ok) { ui.toast(r.err, { kind: 'bad', icon: 'close' }); return; }
        au.play('upgrade'); fx.flash('#fff', 360, .35); fx.shake(5, 260);
        const c0 = fx.centerOf(root.querySelector('#csView') || root); fx.ring(c0.x, c0.y, SP.rarityOf(r.spec).tier >= 2 ? SP.rarityOf(r.spec).color : '#d7b46e', 280, 34, 6);
        fx.burst(c0.x, c0.y, { count: 40, colors: ['#ece3cf', '#d7b46e', SP.rarityOf(r.spec).color], speed: 8, life: 48 });
        ui.toast(`${esc(SP.displayName(r.spec))} reached <b>${esc(SP.stageName(r.spec))}</b> · ${esc(ST.describeDelta(r.spec, r.delta))}`, { kind: 'rare', icon: 'upgrade', silent: true }); ui.levelToasts(r.levelUps);
        setTimeout(() => { if (view) view.igniteRing(r.spec.level - 1); }, 80);
      }
    });
    ui.sub('specimens', () => { if (!document.querySelector('.evo-cine')) draw(); });
    ui.sub('wallet', () => { if (!document.querySelector('.evo-cine')) refreshConsoleOnly(); });
    function refreshConsoleOnly() { /* wallet changes re-render the whole chamber except during an upgrade burst */ if (!document.querySelector('.evo-cine')) draw(); }
  }
  ui.register('forge', { render });
})();
