/* AETHERVAULT — The Vault: a specimen catalogue (browse · filter · inspect) and the Codex. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio, fx = AV.fx;
  const esc = U.esc;
  const PAGE = 48;

  const V = { view: 'specimens', q: '', cat: 'all', rars: new Set(), variant: 'all', cond: 'all', sort: 'newest', fav: false, locked: false, dupes: false, select: false, selected: new Set(), page: 1, size: 'md' };
  const SORTS = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['rarity', 'Rarity'], ['value', 'Value'], ['potential', 'Potential'], ['serial', 'Lowest serial'], ['level', 'Upgrade stage'], ['cond', 'Best condition'], ['name', 'Name A–Z']];
  const idNum = s => +s.id.slice(1);
  const catIcon = { pet: 'paw', gear: 'sword', relic: 'gem', machine: 'cog', oddity: 'eye' };

  function filtered() {
    const all = E.all(), counts = {}; all.forEach(s => (counts[s.base] = (counts[s.base] || 0) + 1));
    const q = V.q.trim().toLowerCase();
    let l = all.filter(s => {
      const it = SP.itemOf(s);
      if (V.cat !== 'all' && it.cat !== V.cat) return false;
      if (V.rars.size && !V.rars.has(it.rarity)) return false;
      if (V.variant !== 'all' && s.variant !== V.variant) return false;
      if (V.cond !== 'all' && s.condition !== +V.cond) return false;
      if (V.fav && !s.favorite) return false;
      if (V.locked && !s.locked) return false;
      if (V.dupes && counts[s.base] < 2) return false;
      if (q) { const hay = (SP.displayName(s) + ' ' + it.name + ' ' + SP.variantOf(s).name + ' ' + SP.conditionLabel(s) + ' ' + it.cat + ' ' + D.PATTERNS.find(p => p.id === s.pattern).name + ' ' + s.serial).toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    const cmp = {
      newest: (a, b) => idNum(b) - idNum(a), oldest: (a, b) => idNum(a) - idNum(b),
      rarity: (a, b) => SP.rarityTier(b) - SP.rarityTier(a) || SP.value(b) - SP.value(a),
      value: (a, b) => SP.value(b) - SP.value(a), potential: (a, b) => b.potential - a.potential,
      serial: (a, b) => a.serial - b.serial, level: (a, b) => b.level - a.level || SP.value(b) - SP.value(a),
      cond: (a, b) => a.condition - b.condition || SP.value(b) - SP.value(a), name: (a, b) => SP.displayName(a).localeCompare(SP.displayName(b)),
    }[V.sort];
    return l.sort(cmp);
  }

  function render(root, params) {
    if (params && params.search != null) { V.q = params.search; V.view = 'specimens'; }
    root.innerHTML = `<div class="catalogue">
      <aside class="filters s-matte sq" aria-label="Archive controls"><div id="vFilters"></div></aside>
      <section class="shelf">
        <header class="shelf-head"><div><span class="label">Archive · division catalogue</span><h1>The Vault</h1><p class="muted" id="vSub"></p></div>
          <div class="seg view" role="tablist"><button class="${V.view === 'specimens' ? 'on' : ''}" data-view="specimens" role="tab">${A.icon('grid')}Specimens</button><button class="${V.view === 'codex' ? 'on' : ''}" data-view="codex" role="tab">${A.icon('book')}Codex</button></div></header>
        <div id="vBody"></div>
      </section></div>`;
    const body = root.querySelector('#vBody'), fil = root.querySelector('#vFilters');

    // ---------- Filter rail ----------
    function drawFilters() {
      const all = E.all(), cnt = { all: all.length }; D.CATEGORIES.forEach(c => (cnt[c.id] = 0)); all.forEach(s => cnt[SP.itemOf(s).cat]++);
      const rc = {}; all.forEach(s => (rc[SP.itemOf(s).rarity] = (rc[SP.itemOf(s).rarity] || 0) + 1));
      fil.innerHTML = V.view === 'codex' ? `<h3 class="sect">Codex</h3><p class="tiny muted">Every collectible the Archive is known to hold. Undiscovered entries appear as silhouettes; select one for a hint.</p>` : `
        <h3 class="sect">Search</h3>
        <label class="search">${A.icon('search')}<input id="vq" type="search" placeholder="name, variant, serial…" value="${esc(V.q)}" aria-label="Search"></label>
        <h3 class="sect">Division</h3>
        <div class="divs" role="group" aria-label="Category">${[['all', 'All divisions', 'layers']].concat(D.CATEGORIES.map(c => [c.id, c.name, catIcon[c.id]])).map(([id, n, ic]) => `<button class="div-row ${V.cat === id ? 'on' : ''}" data-cat="${id}">${A.icon(ic)}<span>${n}</span><b class="mono">${cnt[id]}</b></button>`).join('')}</div>
        <h3 class="sect">Rarity</h3>
        <div class="rlad" role="group" aria-label="Rarity">${D.RARITIES.map(r => `<button class="rl-row r-${r.id} ${V.rars.has(r.id) ? 'on' : ''}" data-rar="${r.id}" aria-pressed="${V.rars.has(r.id)}">${A.rarityGlyph(r.id)}<span>${r.name}</span><b class="mono">${rc[r.id] || 0}</b></button>`).join('')}</div>
        <h3 class="sect">Attributes</h3>
        <div class="selects"><select id="vvar" aria-label="Variant"><option value="all">Any variant</option>${D.VARIANTS.map(v => `<option value="${v.id}" ${V.variant === v.id ? 'selected' : ''}>${v.name}</option>`).join('')}</select>
          <select id="vcond" aria-label="Condition"><option value="all">Any condition</option>${[0, 1, 2, 3, 4].map(i => `<option value="${i}" ${V.cond == i && V.cond !== 'all' ? 'selected' : ''}>${D.CONDITION_LABELS.default[i]} tier</option>`).join('')}</select>
          <select id="vsort" aria-label="Sort">${SORTS.map(([v, l]) => `<option value="${v}" ${V.sort === v ? 'selected' : ''}>Sort · ${l}</option>`).join('')}</select></div>
        <div class="kswitch">${[['fav', 'Favorites', 'heart'], ['locked', 'Locked', 'lock'], ['dupes', 'Duplicates', 'copy']].map(([k, l, ic]) => `<button class="ks ${V[k] ? 'on' : ''}" data-tog="${k}" aria-pressed="${V[k]}">${A.icon(ic)}<span>${l}</span><i></i></button>`).join('')}</div>
        <div class="f-actions"><div class="seg small" role="group" aria-label="Plate size"><button class="${V.size === 'sm' ? 'on' : ''}" data-size="sm">Compact</button><button class="${V.size === 'md' ? 'on' : ''}" data-size="md">Large</button></div>
          <button class="btn ${V.select ? 'primary' : 'ghost'} small" data-act="select">${A.icon('check')}${V.select ? 'Selecting' : 'Select'}</button>
          <button class="btn ghost small" data-act="dupes">${A.icon('trash')}Dismantle duplicates</button>
          <button class="btn quiet small" data-act="clear">Reset filters</button></div>`;
    }

    // ---------- Specimens ----------
    function drawSpecimens() { drawFilters(); body.innerHTML = `<div id="vGrid" class="grid-tray s-tray"></div><div id="vSel"></div>`; drawGrid(); }
    function drawGrid() {
      const list = filtered(), total = E.all().length, shown = list.slice(0, PAGE * V.page);
      root.querySelector('#vSub').textContent = total ? `${list.length} of ${total} specimens shown` : 'The catalogue is empty';
      const g = root.querySelector('#vGrid');
      if (!total) { g.innerHTML = ui.empty('vault', 'The catalogue is empty', 'Containers hold your first discoveries.', `<button class="btn primary" data-go="open">${A.icon('open')}Open a container</button>`); drawSel(); return; }
      if (!list.length) { g.innerHTML = ui.empty('search', 'Nothing matches', 'Loosen a filter or search for something else.', `<button class="btn ghost" data-act="clear">Reset filters</button>`); drawSel(); return; }
      g.innerHTML = `<div class="plategrid ${V.size}">${shown.map((s, i) => `<div class="cell" style="--i:${Math.min(i, 18)}">${ui.card(s, { select: V.select, selected: V.selected.has(s.id) })}<div class="card-quick"><button data-q="fav" data-id="${s.id}" aria-label="Toggle favorite" class="${s.favorite ? 'on' : ''}">${A.icon('heart')}</button><button data-q="lock" data-id="${s.id}" aria-label="Toggle lock" class="${s.locked ? 'on' : ''}">${A.icon('lock')}</button></div></div>`).join('')}</div>
        ${shown.length < list.length ? `<div class="more"><button class="btn ghost" data-act="more">Show ${Math.min(PAGE, list.length - shown.length)} more <span class="mono tiny">(${list.length - shown.length} hidden)</span></button></div>` : ''}`;
      drawSel();
    }
    function drawSel() {
      const el = root.querySelector('#vSel'); if (!el) return;
      V.selected.forEach(id => { if (!E.get(id)) V.selected.delete(id); });
      const n = V.selected.size;
      el.innerHTML = V.select ? `<div class="selbar s-matte"><b class="mono">${n}</b><span class="label">selected</span>
        <button class="btn ghost small" data-act="selall">Select all (${filtered().length})</button>
        <button class="btn ghost small" data-act="selfav" ${n ? '' : 'disabled'}>${A.icon('heart')}Favorite</button>
        <button class="btn ghost small" data-act="sellock" ${n ? '' : 'disabled'}>${A.icon('lock')}Lock</button>
        <button class="btn danger small" data-act="seldis" ${n ? '' : 'disabled'}>${A.icon('trash')}Dismantle</button>
        <button class="btn quiet small" data-act="selclear">Done</button></div>` : '';
    }

    // ---------- Codex ----------
    function drawCodex() {
      drawFilters();
      const s = AV.state.get(), owned = {}; E.all().forEach(x => (owned[x.base] = (owned[x.base] || 0) + 1));
      body.innerHTML = `<div class="codex">` + D.CATEGORIES.map(cat => {
        const items = D.ITEM_LIST.filter(i => i.cat === cat.id), seen = items.filter(i => s.discovered[i.id]).length;
        return `<section class="codex-sec"><div class="cx-head"><h2>${cat.name}</h2><span class="mono muted">${seen}/${items.length}</span>${ui.bar(seen / items.length * 100, 'cat')}</div>
          <div class="codex-grid s-tray">${items.map(i => {
            const d = s.discovered[i.id], R = D.RARITY[i.rarity];
            return d ? `<button class="cx r-${R.id}" data-cx="${i.id}"><i class="plate-bar"></i><span class="cx-art">${A.render(i.id)}</span><b>${esc(i.name)}</b><small>${A.rarityGlyph(R.id)}${owned[i.id] ? `<span class="own mono">×${owned[i.id]}</span>` : '<span class="own mono gone">0</span>'}</small></button>`
              : `<button class="cx unknown r-${R.id}" data-cx="${i.id}"><span class="cx-art">${A.render(i.id, { silhouette: true })}</span><b>Undiscovered</b><small>${cat.single} · ${R.name}</small></button>`;
          }).join('')}</div></section>`;
      }).join('') + `</div>`;
      root.querySelector('#vSub').textContent = `${Object.keys(s.discovered).length} of ${D.ITEM_LIST.length} collectibles discovered`;
    }
    function codexModal(id) {
      const i = D.ITEMS[id], s = AV.state.get(), d = s.discovered[id], R = D.RARITY[i.rarity];
      if (!d) {
        let hint;
        if (!i.obtainable) { const parent = D.ITEM_LIST.find(p => (p.evolves || []).some(e => e.to === id)); hint = parent ? `This form cannot be drawn from a container. It is revealed by <b>evolving</b> ${esc(parent.name)}.` : 'Cannot be drawn directly.'; }
        else hint = `Silhouette only. A ${R.name} ${D.CATEGORY[i.cat].single.toLowerCase()}. Try: ${D.CONTAINERS.filter(c => c.cats.includes(i.cat) && E.rarityTable(c).some(r => r.id === i.rarity)).map(c => esc(c.name)).join(', ') || '—'}.`;
        ui.modal({ title: 'Undiscovered', cls: 'codex-modal', html: `<div class="cm-art unknown">${A.render(id, { silhouette: true })}</div><p class="muted center">${hint}</p>`, buttons: [{ label: 'Close', kind: 'primary', value: 1 }] }); return;
      }
      const evo = (i.evolves || []).map(e => `<li>${esc(D.ITEMS[e.to].name)} — needs ${AV.progress.stageName(id, e.level)} stage, <span class="mono">${e.essence}</span> essence <small>(${esc(e.label)})</small></li>`).join('');
      const forms = AV.progress.formsFor(id).map(f => `<li><b>${esc(f.name)}</b> — ${esc(f.kind)} at ${esc(AV.progress.stageName(id, AV.progress.FORM_LEVEL))}, <span class="mono">${AV.progress.transformCost(id).essence}</span> essence <small>(${esc(AV.statsUI.leanChips(f).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())})</small></li>`).join('');
      const has3 = AV.stage && AV.stage.supported() && AV.stage.has(id);
      const m = ui.modal({
        title: esc(i.name), cls: 'codex-modal r-' + R.id,
        html: `<div class="cm-art ${has3 ? 'cm-3d' : ''}">${has3 ? '' : A.render(id)}</div><div class="cm-txt">${ui.rtag(R.id)}<p class="lore">“${esc(i.lore)}”</p>
          <ul class="kv"><li><span>Division</span><b>${D.CATEGORY[i.cat].single}</b></li><li><span>Drawn so far</span><b class="mono">${d.count}</b></li><li><span>Best potential</span><b class="mono">${d.bestPotential}%</b></li><li><span>Owned now</span><b class="mono">${E.all().filter(x => x.base === id).length}</b></li>${i.stage ? `<li><span>Stage</span><b>${esc(i.stage)}</b></li>` : ''}</ul>
          ${evo ? `<h4 class="sect">Evolves into</h4><ul class="plain">${evo}</ul>` : ''}
          ${forms ? `<h4 class="sect">${AV.progress.formsFor(id).length > 1 ? 'Transformation branches' : 'Final form'}</h4><ul class="plain">${forms}</ul>` : ''}
          <h4 class="sect">Stages</h4><p class="muted tiny">${AV.progress.stageNames(id).map(esc).join(' → ')}</p></div>`,
        buttons: [{ label: 'View specimens', kind: 'ghost', value: 'view', icon: 'vault' }, { label: 'Close', kind: 'primary', value: 'x' }],
        onOpen(api) {
          if (!has3) return; const host = api.el.querySelector('.cm-3d'); const v = AV.stage.view(host, { mode: 'display', interactive: true, layer: 1, margin: 1.08, plate: false, label: i.name + ' — drag to turn' });
          if (v) { v.setSpec({ base: id, variant: 'none', pattern: 'plain', seed: 1, palette: 0, condition: 0, level: 0, potential: 40, serial: 0, size: 1, plateTitle: i.name, plateSub: R.name }); api.promise.then(() => v.dispose()); }
        },
      });
      m.promise.then(v => { if (v === 'view') { V.view = 'specimens'; V.q = i.name; V.cat = 'all'; ui.go('vault'); } });
    }

    const draw = () => (V.view === 'codex' ? drawCodex() : drawSpecimens());
    draw();

    // ---------- events ----------
    let qt = null;
    root.addEventListener('input', e => { if (e.target.id === 'vq') { clearTimeout(qt); qt = setTimeout(() => { V.q = e.target.value; V.page = 1; drawGrid(); }, 120); } });
    root.addEventListener('change', e => {
      const id = e.target.id; if (!id) return;
      if (id === 'vsort') V.sort = e.target.value; else if (id === 'vvar') V.variant = e.target.value; else if (id === 'vcond') V.cond = e.target.value; else return;
      V.page = 1; drawSpecimens();
    });
    root.addEventListener('click', async e => {
      const t = e.target;
      const view = t.closest('[data-view]'); if (view) { V.view = view.dataset.view; root.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b === view)); draw(); return; }
      const cx = t.closest('[data-cx]'); if (cx) { codexModal(cx.dataset.cx); return; }
      const go = t.closest('[data-go]'); if (go) { ui.go(go.dataset.go); return; }
      const cat = t.closest('[data-cat]'); if (cat) { V.cat = cat.dataset.cat; V.page = 1; drawSpecimens(); return; }
      const rar = t.closest('[data-rar]'); if (rar) { const r = rar.dataset.rar; V.rars.has(r) ? V.rars.delete(r) : V.rars.add(r); V.page = 1; drawSpecimens(); return; }
      const tog = t.closest('[data-tog]'); if (tog) { V[tog.dataset.tog] = !V[tog.dataset.tog]; V.page = 1; drawSpecimens(); return; }
      const size = t.closest('[data-size]'); if (size) { V.size = size.dataset.size; drawSpecimens(); return; }
      const qk = t.closest('[data-q]');
      if (qk) { e.stopPropagation(); const sid = qk.dataset.id; if (qk.dataset.q === 'fav') { const f = E.toggleFavorite(sid); au.play('fav'); if (f) fx.burstAt(qk, { count: 8, colors: ['#e68aa6', '#ece3cf'], speed: 3 }); } else { E.toggleLock(sid); au.play('lockset'); } return; }
      const card = t.closest('.plate');
      if (card && V.view === 'specimens') {
        if (V.select) { const id = card.dataset.id; V.selected.has(id) ? V.selected.delete(id) : V.selected.add(id); card.classList.toggle('is-sel'); drawSel(); }
        else AV.inspect(card.dataset.id, { ids: filtered().map(s => s.id) });
        return;
      }
      const a = t.closest('[data-act]'); if (!a) return;
      switch (a.dataset.act) {
        case 'clear': Object.assign(V, { q: '', cat: 'all', variant: 'all', cond: 'all', fav: false, locked: false, dupes: false, page: 1 }); V.rars.clear(); drawSpecimens(); break;
        case 'more': V.page++; drawGrid(); break;
        case 'select': V.select = !V.select; if (!V.select) V.selected.clear(); drawSpecimens(); break;
        case 'selclear': V.select = false; V.selected.clear(); drawSpecimens(); break;
        case 'selall': filtered().forEach(s => V.selected.add(s.id)); drawGrid(); break;
        case 'selfav': { const ids = [...V.selected], all = ids.every(id => E.get(id).favorite); E.setFlags(ids, 'favorite', !all); au.play('fav'); ui.toast(all ? 'Removed from favorites' : `Favorited ${ids.length}`, { kind: 'good', icon: 'heart', silent: true }); break; }
        case 'sellock': { const ids = [...V.selected], all = ids.every(id => E.get(id).locked); E.setFlags(ids, 'locked', !all); au.play('lockset'); ui.toast(all ? 'Unlocked' : `Locked ${ids.length}`, { kind: 'good', icon: 'lock', silent: true }); break; }
        case 'seldis': await dismantleFlow([...V.selected], 'Dismantle selected?'); break;
        case 'dupes': {
          const plan = E.duplicatePlan();
          if (!plan.length) { ui.toast('No duplicates to dismantle — your best copies are always kept, and favorites/locks are protected.', { icon: 'info' }); break; }
          await dismantleFlow(plan, 'Dismantle duplicates?', 'The best copy of each item is kept.'); break;
        }
      }
    });
    root.addEventListener('keydown', e => { if (e.key === 'Escape' && V.select) { V.select = false; V.selected.clear(); drawSpecimens(); } });

    async function dismantleFlow(ids, title, extraNote) {
      const live = ids.filter(id => E.get(id)), prot = live.filter(id => E.protectReason(E.get(id))), go = live.filter(id => !E.protectReason(E.get(id)));
      if (!go.length) { ui.toast(prot.length ? `All ${prot.length} selected item(s) are protected (favorited, locked or your companion).` : 'Nothing to dismantle', { kind: 'bad', icon: 'lock' }); return; }
      const ok = await ui.confirm({ title, danger: true, confirmText: `Dismantle ${go.length}`, icon: 'trash',
        message: `Dismantle <b>${go.length}</b> specimen${go.length > 1 ? 's' : ''} into <b class="mono">${U.fmt(E.essencePreview(go))} essence</b>? This cannot be undone.${extraNote ? ' ' + extraNote : ''}${prot.length ? `<br><span class="good-txt">${prot.length} protected item${prot.length > 1 ? 's' : ''} will be skipped.</span>` : ''}`,
        extra: `<div class="mini-list">${go.slice(0, 5).map(id => ui.mini(E.get(id))).join('')}${go.length > 5 ? `<p class="muted">…and ${go.length - 5} more</p>` : ''}</div>` });
      if (!ok) return;
      const r = E.dismantle(go); au.play('dismantle'); fx.flash('#a99ac8', 260, .18);
      go.forEach(id => V.selected.delete(id));
      ui.toast(`Dismantled ${r.count} → +${U.fmt(r.essence)} essence`, { kind: 'good', icon: 'essence' });
    }

    ui.sub('specimens', () => { if (V.view === 'specimens') { if (root.querySelector('#vGrid')) { drawGrid(); drawFilters(); } } else drawCodex(); });
  }
  ui.register('vault', { render });
})();
