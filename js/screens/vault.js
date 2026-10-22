/* AETHERVAULT — The Vault: catalogue (browse · filter · organise · inspect), binder, lines, duplicates, timeline, history, sets and Codex.
 * Phase Four: every filter goes through AV.vaultQ (an index rebuilt only when the collection or organisation changes), filters combine
 * (AND across facets, OR within one), active filters show as removable chips, searches can be saved as archive tabs, and the grid only
 * ever shows cached thumbnails (no live 3D) with pagination. Secondary views live in vault-views.js. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio, fx = AV.fx, VQ = AV.vaultQ;
  const esc = U.esc;
  const PAGE = 48;
  const VIEWS = [['grid', 'Specimens', 'grid'], ['binder', 'Binder', 'binder'], ['lines', 'Families', 'evolve'], ['dupes', 'Duplicates', 'copy'], ['timeline', 'Timeline', 'calendar'], ['history', 'History', 'history'], ['sets', 'Sets', 'layers'], ['codex', 'Codex', 'book']];
  const V = { view: 'grid', q: '', f: VQ.blank(), sort: 'newest', size: 'md', select: false, selected: new Set(), page: 1, preset: null, codex: 'all', binder: { set: null, page: 0, list: false }, hist: 'all' };
  const catIcon = { pet: 'paw', gear: 'sword', relic: 'gem', machine: 'cog', oddity: 'eye', card: 'card' };
  // index cache: rebuilt only when specimens or organisation change
  let IDX = null, REV = -1, rev = 0;
  AV.bus.on('specimens', () => rev++); AV.bus.on('org', () => rev++); AV.bus.on('reset', () => rev++);
  const S = () => AV.state.get();
  const idx = () => { if (!IDX || REV !== rev) { IDX = VQ.index(S()); REV = rev; } return IDX; };
  const folderOf = id => (S().org.folders || []).find(f => f.id === id);
  const qctx = () => { const fo = V.f.folder !== 'any' ? folderOf(V.f.folder) : null; return { now: Date.now(), companion: S().companion, folderIds: fo ? new Set(fo.ids) : (V.f.folder !== 'any' ? new Set() : null) }; };
  const results = () => VQ.run(idx(), V.f, V.q, V.sort, qctx());
  AV.vaultState = V; // read by vault-views.js

  function render(root, params) {
    if (params && params.search != null) { V.q = params.search; V.view = 'grid'; }
    if (params && params.view && VIEWS.some(v => v[0] === params.view)) V.view = params.view;
    if (params && params.set) { V.binder.set = params.set; V.binder.page = 0; }
    root.innerHTML = `<div class="catalogue v4">
      <aside class="filters s-matte sq" aria-label="Archive controls"><div id="vRail"></div></aside>
      <section class="shelf">
        <header class="shelf-head"><div><span class="label">Archive · division catalogue</span><h1>The Vault</h1><p class="muted" id="vSub"></p></div>
          <div class="seg view vtabs" role="tablist" aria-label="Vault views">${VIEWS.map(([id, n, ic]) => `<button class="${V.view === id ? 'on' : ''}" data-view="${id}" role="tab" aria-selected="${V.view === id}">${A.icon(ic)}<span>${n}</span></button>`).join('')}</div></header>
        <div id="vPresets" class="presets" role="tablist" aria-label="Saved searches"></div>
        <div id="vChips" class="chips-row" aria-live="polite"></div>
        <div id="vBody"></div>
      </section></div>`;
    const body = root.querySelector('#vBody'), rail = root.querySelector('#vRail'), presetsEl = root.querySelector('#vPresets'), chipsEl = root.querySelector('#vChips'), sub = root.querySelector('#vSub');
    const usesFilters = () => ['grid', 'dupes', 'timeline', 'lines'].includes(V.view);

    // ---------------------------------------------------------------- rail
    function drawRail() {
      if (!usesFilters()) { rail.innerHTML = V.view === 'codex' ? `<h3 class="sect">Codex</h3><p class="tiny muted">Every collectible the Archive is known to hold, including all 64 cards. Undiscovered entries appear as silhouettes; select one for a hint.</p><div class="seg small" role="group" aria-label="Show">${[['all', 'All'], ['owned', 'Owned'], ['missing', 'Missing']].map(([v, l]) => `<button class="${V.codex === v ? 'on' : ''}" data-codex="${v}">${l}</button>`).join('')}</div>` : AV.vaultViews.rail(V.view); return; }
      const all = idx(), cnt = { all: all.length }; D.CATEGORIES.forEach(c => (cnt[c.id] = 0)); all.forEach(x => cnt[x.cat]++);
      const rc = {}; all.forEach(x => (rc[x.rar] = (rc[x.rar] || 0) + 1));
      const folders = S().org.folders || [], nAdv = VQ.activeCount(V.f) - V.f.cat.size - V.f.rar.size - ['fav', 'locked', 'dupes'].filter(k => V.f[k]).length - (V.f.folder !== 'any' ? 1 : 0);
      rail.innerHTML = `<h3 class="sect">Search</h3>
        <label class="search">${A.icon('search')}<input id="vq" type="search" placeholder="Search the Vault…" value="${esc(V.q)}" aria-label="Search the Vault"></label>
        <h3 class="sect">Division</h3>
        <div class="divs" role="group" aria-label="Category">${[['all', 'All divisions', 'layers']].concat(D.CATEGORIES.map(c => [c.id, c.name, catIcon[c.id] || 'grid'])).map(([id, n, ic]) => `<button class="div-row ${id === 'all' ? (!V.f.cat.size ? 'on' : '') : V.f.cat.has(id) ? 'on' : ''}" data-cat="${id}" aria-pressed="${id === 'all' ? !V.f.cat.size : V.f.cat.has(id)}">${A.icon(ic)}<span>${n}</span><b class="mono">${cnt[id] || 0}</b></button>`).join('')}</div>
        <h3 class="sect">Rarity</h3>
        <div class="rlad" role="group" aria-label="Rarity">${D.RARITIES.map(r => `<button class="rlad-row r-${r.id} ${V.f.rar.has(r.id) ? 'on' : ''}" data-rar="${r.id}" aria-pressed="${V.f.rar.has(r.id)}">${A.rarityGlyph(r.id)}<span>${r.name}</span><b class="mono">${rc[r.id] || 0}</b></button>`).join('')}</div>
        <div class="kswitch">${[['fav', 'Favorites', 'heart'], ['locked', 'Locked', 'lock'], ['dupes', 'Duplicates', 'copy']].map(([k, l, ic]) => `<button class="ks ${V.f[k] ? 'on' : ''}" data-tog="${k}" aria-pressed="${V.f[k]}">${A.icon(ic)}<span>${l}</span><i></i></button>`).join('')}</div>
        <button class="btn ghost adv-btn" data-act="adv">${A.icon('filter')}Advanced filters${nAdv > 0 ? ` <b class="mono">${nAdv}</b>` : ''}</button>
        <div class="selects"><select id="vsort" aria-label="Sort">${VQ.SORTS.map(([v, l]) => `<option value="${v}" ${V.sort === v ? 'selected' : ''}>Sort · ${l}</option>`).join('')}</select></div>
        <h3 class="sect">Collections</h3>
        <div class="folders" role="group" aria-label="Collections"><button class="fold-row ${V.f.folder === 'any' ? 'on' : ''}" data-folder="any">${A.icon('vault')}<span>Whole Vault</span></button>${folders.map(f => `<button class="fold-row ${V.f.folder === f.id ? 'on' : ''}" data-folder="${f.id}">${A.icon('folder')}<span>${esc(f.name)}</span><b class="mono">${f.ids.filter(id => E.get(id)).length}</b></button>`).join('')}
          <button class="btn quiet small" data-act="newfolder">${A.icon('plus')}New collection</button>${V.f.folder !== 'any' ? `<button class="btn quiet small" data-act="renfolder">Rename</button><button class="btn quiet small" data-act="delfolder">Delete collection</button>` : ''}</div>
        <div class="f-actions"><div class="seg small" role="group" aria-label="Plate size">${[['sm', 'Compact'], ['md', 'Standard'], ['lg', 'Large']].map(([v, l]) => `<button class="${V.size === v ? 'on' : ''}" data-size="${v}">${l}</button>`).join('')}</div>
          <button class="btn ${V.select ? 'primary' : 'ghost'} small" data-act="select">${A.icon('check')}${V.select ? 'Selecting' : 'Select'}</button>
          <button class="btn ghost small" data-act="dupes">${A.icon('trash')}Dismantle duplicates</button>
          <button class="btn quiet small" data-act="clear">Reset filters</button></div>`;
    }
    // ---------------------------------------------------------------- saved searches (archive tabs) + chips
    function drawPresets() {
      const list = (S().org.searches || []).slice().sort((a, b) => (b.fav - a.fav) || a.at - b.at);
      presetsEl.innerHTML = list.length ? list.map(p => `<span class="ptab ${V.preset === p.id ? 'on' : ''} ${p.fav ? 'fav' : ''}"><button class="ptab-b" data-preset="${p.id}" role="tab" aria-selected="${V.preset === p.id}">${p.fav ? A.icon('star') : ''}<span>${esc(p.name)}</span></button>${V.preset === p.id ? `<button class="ptab-x" data-pact="fav" title="${p.fav ? 'Unpin' : 'Pin to the front'}" aria-label="Favorite this search">${A.icon('star')}</button><button class="ptab-x" data-pact="update" title="Save the current filters into this search" aria-label="Update">${A.icon('check')}</button><button class="ptab-x" data-pact="rename" title="Rename" aria-label="Rename">${A.icon('edit')}</button><button class="ptab-x" data-pact="delete" title="Delete" aria-label="Delete">${A.icon('trash')}</button>` : ''}</span>`).join('') : '';
      presetsEl.hidden = !list.length || !usesFilters();
    }
    function drawChips() {
      if (!usesFilters()) { chipsEl.innerHTML = ''; return; }
      const fo = V.f.folder !== 'any' ? folderOf(V.f.folder) : null, c = VQ.chips(V.f, { folderName: fo ? fo.name : '' });
      const any = c.length || V.q.trim();
      chipsEl.innerHTML = any ? `${V.q.trim() ? `<button class="fchip" data-chipq>“${esc(V.q.trim())}” ${A.icon('close')}</button>` : ''}${c.map(x => `<button class="fchip" data-chip="${x.k}" data-v="${esc(String(x.v))}">${esc(x.label)} ${A.icon('close')}</button>`).join('')}<button class="btn quiet small" data-act="clear">Clear all</button><button class="btn ghost small" data-act="savesearch">${A.icon('star')}Save search</button>` : '';
    }
    // ---------------------------------------------------------------- grid
    function drawGrid() {
      const list = results(), total = idx().length, shown = list.slice(0, PAGE * V.page);
      sub.textContent = total ? `${list.length} of ${total} specimens shown` : 'The catalogue is empty';
      if (!total) { body.innerHTML = ui.empty('vault', 'The catalogue is empty', 'Containers hold your first discoveries.', `<button class="btn primary" data-go="open">${A.icon('open')}Open a container</button>`); drawSel(); return; }
      if (!list.length) { body.innerHTML = ui.empty('search', 'Nothing matches', 'Loosen a filter or search for something else.', `<button class="btn ghost" data-act="clear">Reset filters</button>`); drawSel(); return; }
      body.innerHTML = `<div id="vGrid" class="grid-tray s-tray"><div class="plategrid ${V.size}">${shown.map((x, i) => { const s = x.s; return `<div class="cell" style="--i:${Math.min(i, 18)}">${ui.card(s, { select: V.select, selected: V.selected.has(s.id) })}<div class="card-quick"><button data-q="fav" data-id="${s.id}" aria-label="Toggle favorite" class="${s.favorite ? 'on' : ''}">${A.icon('heart')}</button><button data-q="lock" data-id="${s.id}" aria-label="Toggle lock" class="${s.locked ? 'on' : ''}">${A.icon('lock')}</button></div>${x.fz ? `<span class="fz-badge" title="${esc(x.fz.name || 'Fused')}">${x.fz.rank ? AV.fusion.ROMAN[x.fz.rank] : '✶'}</span>` : ''}</div>`; }).join('')}</div>
        ${shown.length < list.length ? `<div class="more"><button class="btn ghost" data-act="more">Show ${Math.min(PAGE, list.length - shown.length)} more <span class="mono tiny">(${list.length - shown.length} hidden)</span></button></div>` : ''}</div><div id="vSel"></div>`;
      drawSel();
    }
    function drawSel() {
      let el = root.querySelector('#vSel'); if (!el) { body.insertAdjacentHTML('beforeend', '<div id="vSel"></div>'); el = root.querySelector('#vSel'); }
      V.selected.forEach(id => { if (!E.get(id)) V.selected.delete(id); });
      const n = V.selected.size;
      el.innerHTML = V.select ? `<div class="selbar s-matte"><b class="mono">${n}</b><span class="label">selected</span>
        <button class="btn ghost small" data-act="selall">Select all (${results().length})</button>
        <button class="btn ghost small" data-act="compare" ${n >= 2 && n <= 4 ? '' : 'disabled'} title="Compare two to four specimens">${A.icon('compare')}Compare</button>
        <button class="btn ghost small" data-act="selfolder" ${n ? '' : 'disabled'}>${A.icon('folder')}Add to collection</button>
        <button class="btn ghost small" data-act="seltag" ${n ? '' : 'disabled'}>${A.icon('tag')}Tag</button>
        <button class="btn ghost small" data-act="selfav" ${n ? '' : 'disabled'}>${A.icon('heart')}Favorite</button>
        <button class="btn ghost small" data-act="sellock" ${n ? '' : 'disabled'}>${A.icon('lock')}Lock</button>
        ${V.f.folder !== 'any' ? `<button class="btn ghost small" data-act="selunfolder" ${n ? '' : 'disabled'}>Remove from collection</button>` : ''}
        <button class="btn danger small" data-act="seldis" ${n ? '' : 'disabled'}>${A.icon('trash')}Dismantle</button>
        <button class="btn quiet small" data-act="selclear">Done</button></div>` : '';
    }
    // ---------------------------------------------------------------- Codex
    function drawCodex() {
      const s = S(), owned = {}; E.all().forEach(x => (owned[x.base] = (owned[x.base] || 0) + 1));
      body.innerHTML = `<div class="codex">` + D.CATEGORIES.map(cat => {
        const items = D.ITEM_LIST.filter(i => i.cat === cat.id && (V.codex === 'all' || (V.codex === 'owned' ? owned[i.id] : !owned[i.id]))), all = D.ITEM_LIST.filter(i => i.cat === cat.id), seen = all.filter(i => s.discovered[i.id]).length;
        if (!items.length) return '';
        return `<section class="codex-sec"><div class="cx-head"><h2>${cat.name}</h2><span class="mono muted">${seen}/${all.length}</span>${ui.bar(seen / all.length * 100, 'cat')}</div>
          <div class="codex-grid s-tray ${cat.id === 'card' ? 'cards' : ''}">${items.map(i => {
            const d = s.discovered[i.id], R = D.RARITY[i.rarity];
            return d ? `<button class="cx r-${R.id}" data-cx="${i.id}"><i class="plate-bar"></i><span class="cx-art">${A.render(i.id)}</span><b>${esc(i.name)}</b><small>${A.rarityGlyph(R.id)}${owned[i.id] ? `<span class="own mono">×${owned[i.id]}</span>` : '<span class="own mono gone">0</span>'}</small></button>`
              : `<button class="cx unknown r-${R.id}" data-cx="${i.id}"><span class="cx-art">${A.render(i.id, { silhouette: true })}</span><b>Undiscovered</b><small>${cat.single} · ${R.name}</small></button>`;
          }).join('')}</div></section>`;
      }).join('') + `</div>`;
      sub.textContent = `${Object.keys(s.discovered).length} of ${D.ITEM_LIST.length} collectibles discovered`;
    }
    function codexModal(id) {
      const i = D.ITEMS[id], s = S(), d = s.discovered[id], R = D.RARITY[i.rarity];
      const sources = D.CONTAINERS.filter(c => E.poolItems(c).some(x => x.id === id) && E.rarityTable(c).some(r => r.id === i.rarity)).map(c => esc(c.name));
      if (!d) {
        const parent = D.ITEM_LIST.find(p => (p.evolves || []).some(e => e.to === id));
        const hint = [parent ? `Revealed by <b>evolving</b> ${esc(parent.name)}.` : '', sources.length ? `Found in: ${sources.join(', ')}.` : (!parent ? 'Cannot be drawn directly.' : '')].filter(Boolean).join(' ');
        ui.modal({ title: 'Undiscovered', cls: 'codex-modal', html: `<div class="cm-art unknown">${A.render(id, { silhouette: true })}</div><p class="muted center">Silhouette only. A ${R.name} ${D.CATEGORY[i.cat].single.toLowerCase()}. ${hint}</p>`, buttons: [{ label: 'Close', kind: 'primary', value: 1 }] }); return;
      }
      const evo = (i.evolves || []).map(e => `<li>${esc(D.ITEMS[e.to].name)} — needs ${AV.progress.stageName(id, e.level)} stage, <span class="mono">${e.essence}</span> essence <small>(${esc(e.label)})</small></li>`).join('');
      const forms = AV.progress.formsFor(id).map(f => `<li><b>${esc(f.name)}</b> — ${esc(f.kind)} at ${esc(AV.progress.stageName(id, AV.progress.FORM_LEVEL))}, <span class="mono">${AV.progress.transformCost(id).essence}</span> essence</li>`).join('');
      const has3 = AV.stage && AV.stage.supported() && AV.stage.has(id), cardMeta = i.cat === 'card' ? AV.cards.describe({ base: id, card: { finish: 'satin', foil: 'none', edition: 'unlimited', alt: 0 } }) : null;
      const m = ui.modal({
        title: esc(i.name), cls: 'codex-modal r-' + R.id,
        html: `<div class="cm-art ${has3 ? 'cm-3d' : ''}">${has3 ? '' : A.render(id)}</div><div class="cm-txt">${ui.rtag(R.id)}<p class="lore">“${esc(i.lore)}”</p>
          <ul class="kv"><li><span>Division</span><b>${D.CATEGORY[i.cat].single}</b></li>${cardMeta ? `<li><span>Set</span><b>${esc(cardMeta.set.name)}</b></li><li><span>Number</span><b class="mono">${esc(cardMeta.number)}</b></li><li><span>Material</span><b>${esc(cardMeta.material.name)}</b></li>` : ''}<li><span>Drawn so far</span><b class="mono">${d.count}</b></li><li><span>Best potential</span><b class="mono">${d.bestPotential}%</b></li><li><span>Owned now</span><b class="mono">${E.all().filter(x => x.base === id).length}</b></li>${sources.length ? `<li><span>Found in</span><b>${sources.join(', ')}</b></li>` : ''}</ul>
          ${evo ? `<h4 class="sect">Evolves into</h4><ul class="plain">${evo}</ul>` : ''}
          ${forms ? `<h4 class="sect">${AV.progress.formsFor(id).length > 1 ? (i.cat === 'card' ? 'Premium presentations' : 'Transformation branches') : 'Final form'}</h4><ul class="plain">${forms}</ul>` : ''}
          <h4 class="sect">Stages</h4><p class="muted tiny">${AV.progress.stageNames(id).map(esc).join(' → ')}</p></div>`,
        buttons: [{ label: 'View specimens', kind: 'ghost', value: 'view', icon: 'vault' }, { label: 'Close', kind: 'primary', value: 'x' }],
        onOpen(api) {
          if (!has3) return; const host = api.el.querySelector('.cm-3d'); const v = AV.stage.view(host, { mode: 'display', interactive: true, layer: 1, margin: 1.08, plate: false, label: i.name + ' — drag to turn' });
          if (v) { v.setSpec({ base: id, variant: 'none', pattern: 'plain', seed: 1, palette: 0, condition: 0, level: 0, potential: 40, serial: 0, size: 1, plateTitle: i.name, plateSub: R.name, card: i.cat === 'card' ? { finish: 'satin', foil: 'none', edition: 'unlimited', alt: 0 } : undefined }); api.promise.then(() => v.dispose()); }
        },
      });
      m.promise.then(v => { if (v === 'view') { V.view = 'grid'; V.q = ''; V.f = VQ.blank(); V.f.base.add(id); ui.go('vault'); } });
    }

    function draw() {
      drawRail(); drawPresets(); drawChips();
      root.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('on', b.dataset.view === V.view); b.setAttribute('aria-selected', b.dataset.view === V.view); });
      if (V.view === 'grid') drawGrid();
      else if (V.view === 'codex') drawCodex();
      else { AV.vaultViews.draw(V.view, body, { results, idx, sub, refresh: draw }); }
    }
    const redraw = () => { V.page = 1; V.preset = V.preset && presetMatches() ? V.preset : null; draw(); };
    function presetMatches() { const p = (S().org.searches || []).find(x => x.id === V.preset); return p && JSON.stringify(p.f) === JSON.stringify(VQ.serialize(V.f)) && (p.q || '') === V.q && p.sort === V.sort; }
    AV.vaultRedraw = redraw;
    draw();

    // ---------------------------------------------------------------- events
    let qt = null;
    root.addEventListener('input', e => { if (e.target.id === 'vq') { clearTimeout(qt); qt = setTimeout(() => { V.q = e.target.value; V.page = 1; V.preset = null; drawChips(); drawPresets(); if (V.view === 'grid') drawGrid(); else draw(); }, 140); } });
    root.addEventListener('change', e => { if (e.target.id === 'vsort') { V.sort = e.target.value; redraw(); } });
    root.addEventListener('click', async e => {
      const t = e.target;
      const view = t.closest('[data-view]'); if (view) { V.view = view.dataset.view; V.select = false; V.selected.clear(); draw(); return; }
      const cx = t.closest('[data-cx]'); if (cx) { codexModal(cx.dataset.cx); return; }
      const cdx = t.closest('[data-codex]'); if (cdx) { V.codex = cdx.dataset.codex; draw(); return; }
      const go = t.closest('[data-go]'); if (go) { ui.go(go.dataset.go); return; }
      const cat = t.closest('[data-cat]'); if (cat) { const c = cat.dataset.cat; if (c === 'all') V.f.cat.clear(); else V.f.cat.has(c) ? V.f.cat.delete(c) : V.f.cat.add(c); redraw(); return; }
      const rar = t.closest('[data-rar]'); if (rar) { const r = rar.dataset.rar; V.f.rar.has(r) ? V.f.rar.delete(r) : V.f.rar.add(r); redraw(); return; }
      const tog = t.closest('[data-tog]'); if (tog) { V.f[tog.dataset.tog] = !V.f[tog.dataset.tog]; redraw(); return; }
      const fold = t.closest('[data-folder]'); if (fold) { V.f.folder = fold.dataset.folder; redraw(); return; }
      const size = t.closest('[data-size]'); if (size) { V.size = size.dataset.size; draw(); return; }
      const chip = t.closest('[data-chip]'); if (chip) { const k = chip.dataset.chip; let v = chip.dataset.v; if (k === 'cond' || k === 'stage') v = +v; VQ.removeChip(V.f, k, v); redraw(); return; }
      if (t.closest('[data-chipq]')) { V.q = ''; redraw(); return; }
      const pre = t.closest('[data-preset]'); if (pre) { const p = (S().org.searches || []).find(x => x.id === pre.dataset.preset); if (p) { V.f = VQ.deserialize(p.f); V.q = p.q || ''; V.sort = p.sort || 'newest'; V.view = p.view && VIEWS.some(v => v[0] === p.view) ? p.view : 'grid'; V.page = 1; V.preset = p.id; au.play('slide'); draw(); } return; }
      const pa = t.closest('[data-pact]'); if (pa && V.preset) { await presetAction(pa.dataset.pact, V.preset); return; }
      const qk = t.closest('[data-q]');
      if (qk) { e.stopPropagation(); const sid = qk.dataset.id; if (qk.dataset.q === 'fav') { const f = E.toggleFavorite(sid); au.play('fav'); if (f) fx.burstAt(qk, { count: 8, colors: ['#e68aa6', '#ece3cf'], speed: 3 }); } else { E.toggleLock(sid); au.play('lockset'); } return; }
      const card = t.closest('.plate');
      if (card && V.view === 'grid') {
        if (V.select) { const id = card.dataset.id; V.selected.has(id) ? V.selected.delete(id) : V.selected.add(id); card.classList.toggle('is-sel'); drawSel(); }
        else AV.inspect(card.dataset.id, { ids: results().map(x => x.id) });
        return;
      }
      const a = t.closest('[data-act]'); if (!a) return;
      switch (a.dataset.act) {
        case 'clear': V.f = VQ.blank(); V.q = ''; V.preset = null; redraw(); break;
        case 'more': V.page++; drawGrid(); break;
        case 'adv': AV.vaultViews.advanced({ onChange: () => { V.page = 1; V.preset = null; draw(); } }); break;
        case 'savesearch': { const name = await ui.prompt({ title: 'Save this search', label: 'Name the archive tab', value: defaultPresetName(), max: 32 }); if (name && name.trim()) { const p = E.searchSave({ name, f: VQ.serialize(V.f), q: V.q, sort: V.sort, view: V.view }); V.preset = p.id; au.play('confirm'); draw(); } break; }
        case 'newfolder': { const name = await ui.prompt({ title: 'New collection', label: 'A named collection or album. Specimens can belong to several.', value: '', max: 32, placeholder: 'e.g. Night Shelf' }); if (name && name.trim()) { const f = E.folderCreate(name); V.f.folder = f.id; redraw(); } break; }
        case 'renfolder': { const fo = folderOf(V.f.folder); if (!fo) break; const name = await ui.prompt({ title: 'Rename collection', label: 'Collection name', value: fo.name, max: 32 }); if (name && name.trim()) { E.folderRename(fo.id, name); draw(); } break; }
        case 'delfolder': { const fo = folderOf(V.f.folder); if (!fo) break; const ok = await ui.confirm({ title: 'Delete this collection?', message: `The collection <b>${esc(fo.name)}</b> is removed. Its specimens stay in your Vault.`, confirmText: 'Delete collection' }); if (ok) { E.folderDelete(fo.id); V.f.folder = 'any'; redraw(); } break; }
        case 'select': V.select = !V.select; if (!V.select) V.selected.clear(); drawRail(); drawGrid(); break;
        case 'selclear': V.select = false; V.selected.clear(); drawRail(); drawGrid(); break;
        case 'selall': results().forEach(x => V.selected.add(x.id)); drawGrid(); break;
        case 'compare': AV.vaultViews.compare([...V.selected]); break;
        case 'selfolder': await addToFolder([...V.selected]); break;
        case 'selunfolder': { E.folderRemove(V.f.folder, [...V.selected]); V.selected.clear(); ui.toast('Removed from the collection', { icon: 'folder', silent: true }); break; }
        case 'seltag': { const tg = await ui.prompt({ title: 'Tag selected', label: `Add a tag to ${V.selected.size} specimen(s)`, value: '', max: 24, placeholder: 'e.g. trade-shelf' }); if (tg && tg.trim()) { const n = E.addTag([...V.selected], tg); ui.toast(`Tagged ${n}`, { icon: 'tag', kind: 'good', silent: true }); } break; }
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
    root.addEventListener('keydown', e => { if (e.key === 'Escape' && V.select) { V.select = false; V.selected.clear(); drawRail(); drawGrid(); } });

    function defaultPresetName() { const c = VQ.chips(V.f).map(x => x.label); return (c.slice(0, 2).join(' · ') || (V.q ? '“' + V.q + '”' : 'All specimens')).slice(0, 32); }
    async function presetAction(act, pid) {
      const p = (S().org.searches || []).find(x => x.id === pid); if (!p) return;
      if (act === 'fav') E.searchUpdate(pid, { fav: !p.fav });
      else if (act === 'update') { E.searchUpdate(pid, { f: VQ.serialize(V.f), q: V.q, sort: V.sort, view: V.view }); ui.toast(`Updated “${esc(p.name)}”`, { icon: 'check', kind: 'good', silent: true }); }
      else if (act === 'rename') { const n = await ui.prompt({ title: 'Rename saved search', label: 'Name', value: p.name, max: 32 }); if (n && n.trim()) E.searchUpdate(pid, { name: n }); }
      else if (act === 'delete') { const ok = await ui.confirm({ title: 'Delete saved search?', message: `The archive tab <b>${esc(p.name)}</b> is removed. No specimen is affected.`, confirmText: 'Delete' }); if (ok) { E.searchDelete(pid); V.preset = null; } }
      draw();
    }
    async function addToFolder(ids) {
      const folders = S().org.folders || [];
      const m = ui.modal({ title: 'Add to collection', html: `<p class="muted">A specimen can belong to several collections. Nothing is moved or copied.</p><div class="fold-pick">${folders.map(f => `<button class="btn ghost" data-fp="${f.id}">${A.icon('folder')}${esc(f.name)} <span class="mono tiny">${f.ids.length}</span></button>`).join('')}</div><label class="field"><span>…or a new collection</span><input type="text" maxlength="32" placeholder="New collection name" data-fpnew></label>`,
        buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Create and add', kind: 'primary', value: 'new' }], dismissValue: null,
        onOpen(api) { api.el.addEventListener('click', ev => { const b = ev.target.closest('[data-fp]'); if (b) { const n = E.folderAdd(b.dataset.fp, ids); ui.toast(`Added ${n} to ${esc(folderOf(b.dataset.fp).name)}`, { icon: 'folder', kind: 'good', silent: true }); api.close('done'); } }); } });
      const v = await m.promise; if (v === 'new') { const name = m.el.querySelector('[data-fpnew]').value; if (name.trim()) { const f = E.folderCreate(name); E.folderAdd(f.id, ids); ui.toast(`Created “${esc(f.name)}”`, { icon: 'folder', kind: 'good', silent: true }); } }
    }
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
    AV.vaultDismantle = dismantleFlow;

    ui.sub('specimens', () => { if (V.view === 'grid') { if (root.querySelector('#vGrid') || root.querySelector('.empty')) { drawGrid(); drawRail(); } } else draw(); });
    ui.sub('org', () => { drawRail(); drawPresets(); drawChips(); if (V.view !== 'grid' && V.view !== 'codex') draw(); });
  }
  ui.register('vault', { render });
})();
