/* AETHERVAULT — specimen inspection: a large lit stage (drag · zoom) beside a specimen sheet. AV.inspect(id, {ids}) */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio, fx = AV.fx, ST = AV.stats, PR = AV.progress, SU = AV.statsUI;
  const esc = U.esc;
  let openModal = null;

  function inspect(id, opts = {}) {
    if (!E.get(id)) return;
    if (openModal) { openModal.close(); openModal = null; }
    let cur = id; const ids = opts.ids && opts.ids.includes(id) ? opts.ids : null;
    let view = null;
    const m = ui.modal({ title: '', wide: true, cls: 'inspect', html: '<div class="insp"><section class="insp-stage s-stage"><div class="is-view"></div><div class="is-over"></div></section><aside class="insp-sheet"></aside></div>', dismissValue: null,
      onClose: () => { openModal = null; if (view) { view.dispose(); view = null; } } });
    openModal = m; const box = m.el.querySelector('.insp'), stageEl = box.querySelector('.insp-stage'), host = box.querySelector('.is-view'), over = box.querySelector('.is-over'), sheet = box.querySelector('.insp-sheet');
    let refocusTag = false, lastKey = null, cmpId = null, showNext = false, prev = null, holoMode = 'auto'; // prev: a not-applied preview { form } or { base }
    const showOf = s => (prev ? (prev.form ? Object.assign({}, s, { form: prev.form, look: 'auto' }) : Object.assign({}, s, { base: prev.base, level: 0, form: null, look: 'auto' })) : s);
    const prevName = () => (prev ? (prev.form ? PR.form(prev.form).name : D.ITEMS[prev.base].name) : '');

    function mountStage(s0) {
      const s = showOf(s0), has3 = AV.stage && AV.stage.supported() && AV.stage.has(s.base);
      if (has3) {
        if (!view) { host.innerHTML = ''; view = AV.stage.view(host, { mode: 'inspect', interactive: true, zoom: true, layer: (AV.opening && AV.opening.busy()) ? 3 : 1, margin: 1.12, restDelay: SP.itemOf(s).cat === 'card' ? 2.6 : 1.1, label: `${SP.displayName(s)}, 3D inspection. Drag to rotate, scroll to zoom.${SP.itemOf(s).cat === 'card' ? ' Tap to switch between the card and its projection.' : ''}` }); }
        if (view) { view.setSpec(Object.assign({ plateTitle: prev ? prevName() : SP.displayName(s) }, s)); view.playIntro('pop', .55); view.zoomT = 1; return; }
      }
      if (view) { view.dispose(); view = null; }
      host.innerHTML = `<div class="hall-fallback">${A.render(s, { no3d: true })}<i class="fb-plinth"></i></div>`;
    }

    function draw() {
      const s = E.get(cur);
      if (!s) { m.close(); return; }
      const keepY = sheet.scrollTop;
      const it = SP.itemOf(s), R = SP.rarityOf(s), v = SP.variantOf(s), pat = D.PATTERNS.find(p => p.id === s.pattern), pal = D.PALETTES[s.palette], aura = D.AURAS.find(a => a.id === s.aura);
      const si = SP.serialInfo(s.serial), prot = E.protectReason(s), cost = SP.upgradeCost(s), isComp = AV.state.get().companion === s.id;
      const others = E.all().filter(x => x.base === s.base && x.id !== s.id).sort((a, b) => SP.value(b) - SP.value(a));
      const evo = SP.evolutions(s), evoReady = evo.some(e => s.level >= e.level);
      const contName = s.origin.container ? (D.CONTAINER[s.origin.container] ? D.CONTAINER[s.origin.container].name : 'First Egg') : 'Creator';
      const idx = ids ? ids.indexOf(cur) : -1, rare = R.tier >= 3;
      box.className = 'insp r-' + R.id; box.style.setProperty('--rc', R.color);
      stageEl.classList.toggle('s-lumen', rare);
      over.innerHTML = `
        <button class="icon-btn io-close" data-m-close aria-label="Close">${A.icon('close')}</button>
        <div class="io-badges">${s.favorite ? `<span class="flag fav">${A.icon('heart')}</span>` : ''}${s.locked ? `<span class="flag lk">${A.icon('lock')}</span>` : ''}${isComp ? `<span class="flag cmp">${A.icon('paw')}</span>` : ''}</div>
        ${ids ? `<button class="nav-arrow l" data-nav="-1" ${idx <= 0 ? 'disabled' : ''} aria-label="Previous">${A.icon('back')}</button><button class="nav-arrow r" data-nav="1" ${idx >= ids.length - 1 ? 'disabled' : ''} aria-label="Next">${A.icon('back')}</button><span class="io-pos mono">${U.pad(idx + 1, 2)} / ${U.pad(ids.length, 2)}</span>` : ''}
        ${prev ? `<div class="io-preview s-label"><span class="label">Preview</span><b>${esc(prevName())}</b><span class="muted">not applied</span><button class="btn quiet small" data-act="unprev">Stop</button></div>` : ''}
        ${it.cat === 'card' && AV.cards && cardProjects(s) ? `<div class="io-holo seg small" role="group" aria-label="Card or hologram"><button data-holo="auto" class="${holoMode === 'auto' ? 'on' : ''}">Auto</button><button data-holo="card" class="${holoMode === 'card' ? 'on' : ''}">Card</button><button data-holo="holo" class="${holoMode === 'holo' ? 'on' : ''}">Hologram</button></div>` : ''}
        <div class="io-hint"><span>${A.icon('drag')}${it.cat === 'card' ? 'Drag to turn the card · tap to switch · scroll or pinch to zoom' : 'Drag to turn · scroll to zoom'}</span><button class="btn quiet small" data-act="reset">Reset view</button></div>`;
      const key = [s.id, s.base, s.level, s.form, s.look, prev && (prev.form || prev.base)].join('|'); if (lastKey !== key) { mountStage(s); lastKey = key; }
      sheet.innerHTML = `
        <div class="sh-top"><div>${ui.rtag(R.id)}<span class="chip-s">${D.CATEGORY[it.cat].single}</span>${it.stage ? `<span class="chip-s">${esc(it.stage)}</span>` : ''}</div><button class="icon-btn" data-m-close aria-label="Close">${A.icon('close')}</button></div>
        <h2 class="sh-name">${esc(SP.displayName(s))} <button class="icon-btn small" data-act="rename" aria-label="Rename">${A.icon('edit')}</button></h2>
        ${s.nickname ? `<p class="muted tiny">${esc(it.name)}</p>` : ''}
        <p class="lore">“${esc(it.lore)}”</p>
        <div class="sh-value"><span class="label">Estimated value</span><b class="mono">${A.icon('coin')}${U.fmtFull(SP.value(s))}</b></div>
        ${it.cat === 'card' ? cardSheet(s) : ''}<div class="sh-card s-label" ${it.cat === 'card' ? 'hidden' : ''}>
          <div class="sh-card-h"><span class="label">Specimen sheet</span><span class="mono">${ui.serial(s.serial)}</span></div>
          <dl class="sheet">
            <div class="${v.id !== 'none' ? 'sp' : ''}"><dt>Variant</dt><dd>${v.id !== 'none' ? `<span class="vtag var-${v.id}">${v.name}</span>` : 'Standard'}</dd></div>
            <div><dt>Pattern</dt><dd>${pat.name}</dd></div>
            <div><dt>Palette</dt><dd>${pal.name}</dd></div>
            <div class="cond-${s.condition}"><dt>Condition</dt><dd>${SP.conditionLabel(s)}</dd></div>
            <div><dt>Aura</dt><dd>${aura.id === 'none' ? '—' : `<i class="auradot" style="background:${aura.color}"></i>${aura.name}`}</dd></div>
            <div><dt>Size</dt><dd>${SP.sizeLabel(s.size)} <small class="mono">${s.size.toFixed(2)}×</small></dd></div>
            <div class="${si.label ? 'sp' : ''}"><dt>Serial</dt><dd class="mono">${U.pad(s.serial, 4)}${si.label ? ` <small>${si.label}</small>` : ''}</dd></div>
            <div><dt>Stage</dt><dd>${ui.pips(s)} ${SP.stageName(s)}</dd></div>
            ${s.form ? `<div class="sp"><dt>Form</dt><dd>${esc(PR.form(s.form).name)}</dd></div>` : ''}
            ${s.personality ? `<div><dt>Nature</dt><dd>${D.PERSONALITIES.find(p => p.id === s.personality).name}</dd></div>` : ''}
            <div class="wide"><dt>Quirk</dt><dd>${esc(s.quirk)}</dd></div>
          </dl>
          <div class="pot"><div class="pot-h"><span class="label">Potential</span><b class="mono">${s.potential}%</b></div>${ui.bar(s.potential, s.potential >= 80 ? 'gold' : 'violet')}<small class="muted">${SP.maxLevel(s) < 4 ? 'Low potential: cannot reach the Signature stage.' : 'High enough to reach the Signature stage.'}</small></div>
          <p class="sh-origin">From <b>${esc(contName)}</b> · ${new Date(s.origin.at).toLocaleDateString()} · invested <span class="mono">${U.fmt(s.invested.essence)}</span> essence</p>
        </div>
        <div class="sh-actions">
          <button class="btn ghost ${s.favorite ? 'on' : ''}" data-act="fav">${A.icon('heart')}${s.favorite ? 'Favorited' : 'Favorite'}</button>
          <button class="btn ghost ${s.locked ? 'on' : ''}" data-act="lock">${A.icon(s.locked ? 'lock' : 'unlock')}${s.locked ? 'Locked' : 'Lock'}</button>
          ${it.cat === 'pet' ? `<button class="btn ghost ${isComp ? 'on' : ''}" data-act="comp" ${isComp ? 'disabled' : ''}>${A.icon('paw')}${isComp ? 'Companion' : 'Make companion'}</button>` : ''}
          <button class="btn primary" data-act="forge">${A.icon(evoReady ? 'evolve' : 'upgrade')}${evoReady ? 'Upgrade / evolve' : cost ? 'Upgrade' : 'Forge'}</button>
          <button class="btn ghost" data-act="fuse">${A.icon('fuse')}Fuse</button>
          ${E.isUnlimited() ? `<button class="btn ghost" data-act="dup">${A.icon('copy')}Duplicate</button>` : ''}
          <button class="btn ${prot ? 'ghost disabled' : 'danger'}" data-act="dis" aria-disabled="${!!prot}" title="${prot ? prot + ' — protected from dismantling' + (prot === 'In a combat deck' ? ' (remove or replace it in the deck first)' : '') : 'Dismantle into essence'}">${A.icon(prot ? 'lock' : 'trash')}${prot ? 'Protected · ' + prot : 'Dismantle · +' + U.fmt(SP.essenceYield(s))}</button>
        </div>
        ${orgHTML(s)}
        ${progressHTML(s)}
        ${others.length ? `<h4 class="sect">Other copies (${others.length})</h4><div class="compare">${others.slice(0, 4).map(o => {
          const dv = SP.value(o) - SP.value(s), dp = o.potential - s.potential;
          return `<button class="cmp-row r-${SP.rarityOf(o).id}" data-open="${o.id}"><span class="cmp-art">${A.render(o)}</span><span class="cmp-t"><b class="mono">${ui.serial(o.serial)}</b><small>${SP.variantOf(o).id !== 'none' ? SP.variantOf(o).name + ' · ' : ''}${SP.conditionLabel(o)}</small></span><span class="cmp-d mono ${dp > 0 ? 'up' : dp < 0 ? 'dn' : ''}">${dp > 0 ? '+' : ''}${dp}% pot</span><span class="cmp-d mono ${dv > 0 ? 'up' : dv < 0 ? 'dn' : ''}">${dv > 0 ? '+' : ''}${U.fmt(dv)}</span></button>`;
        }).join('')}</div>` : ''}
        <h4 class="sect">History</h4>
        <ol class="timeline">${s.history.slice().reverse().slice(0, 8).map(h => `<li class="t-${h.type}"><time class="mono">${new Date(h.t).toLocaleDateString()} ${new Date(h.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span>${esc(h.text)}</span></li>`).join('')}</ol>`;
      sheet.scrollTop = keepY;
      if (refocusTag) { refocusTag = false; const ti = sheet.querySelector('.org-tagin'); if (ti) ti.focus(); }
    }
    /** Phase Four: tags, a private note and collection membership. None of it changes the specimen. */
    function orgHTML(s) {
      const O = AV.state.get().org, tags = O.tags[s.id] || [], note = O.notes[s.id] || '', folders = O.folders || [];
      return `<h4 class="sect">Organise</h4><div class="org s-label">
        <div class="org-row"><span class="label">Tags</span><div class="org-tags">${tags.map(t => `<button class="fchip" data-tagx="${esc(t)}" aria-label="Remove tag ${esc(t)}">#${esc(t)} ${A.icon('close')}</button>`).join('')}<input type="text" class="org-tagin" maxlength="24" placeholder="${tags.length >= 12 ? 'Tag limit reached' : 'Add a tag, press Enter'}" ${tags.length >= 12 ? 'disabled' : ''} aria-label="Add a tag"></div></div>
        <div class="org-row"><label class="label" for="orgNote">Note</label><textarea id="orgNote" maxlength="600" rows="3" placeholder="A private note about this specimen">${esc(note)}</textarea><small class="tiny dim">Saved when you leave the box · ${note.length}/600</small></div>
        <div class="org-row"><span class="label">Collections</span><div class="org-folders">${folders.map(f => `<button class="fchip ${f.ids.includes(s.id) ? 'on' : ''}" data-fold="${f.id}" aria-pressed="${f.ids.includes(s.id)}">${A.icon('folder')}${esc(f.name)}</button>`).join('')}<button class="btn quiet small" data-act="newfold">${A.icon('plus')}New collection</button></div></div></div>`;
    }
    /** Phase Four: the card's print record (replaces the specimen sheet for cards). */
    function cardSheet(s) {
      const d = AV.cards.describe(s), it = SP.itemOf(s), si = SP.serialInfo(s.serial), dep = AV.cards.depicted(it);
      const contName = s.origin.container ? (D.CONTAINER[s.origin.container] ? D.CONTAINER[s.origin.container].name : 'First Egg') : 'Creator';
      return `<div class="sh-card s-label card-sheet"><div class="sh-card-h"><span class="label">Print record · ${esc(d.set.name)}</span><span class="mono">${esc(d.number)}</span></div>
        <dl class="sheet">
          <div><dt>Class</dt><dd>${esc(d.cls.name)}</dd></div>
          <div><dt>Set</dt><dd>${esc(d.set.code)} · ${esc(d.set.year)}</dd></div>
          <div class="wide"><dt>Material</dt><dd>${esc(d.material.name)}</dd></div>
          <div><dt>Finish</dt><dd>${esc(d.finish)}</dd></div>
          <div class="${s.card && s.card.foil !== 'none' ? 'sp' : ''}"><dt>Foil</dt><dd>${esc(d.foil)}</dd></div>
          <div class="${s.card && s.card.edition !== 'unlimited' ? 'sp' : ''}"><dt>Edition</dt><dd>${esc(d.edition)}</dd></div>
          <div class="${d.alt ? 'sp' : ''}"><dt>Artwork</dt><dd>${d.alt ? 'Alternate art' : 'Standard art'}</dd></div>
          <div class="cond-${s.condition}"><dt>Print condition</dt><dd>${SP.conditionLabel(s)}</dd></div>
          <div class="${v_(s) ? 'sp' : ''}"><dt>Print variant</dt><dd>${v_(s) ? `<span class="vtag var-${s.variant}">${SP.variantOf(s).name}</span>` : 'Standard'}</dd></div>
          <div class="${si.label ? 'sp' : ''}"><dt>Serial</dt><dd class="mono">No. ${U.pad(s.serial, 4)}${si.label ? ` <small>${si.label}</small>` : ''}</dd></div>
          <div><dt>Stage</dt><dd>${ui.pips(s)} ${SP.stageName(s)}</dd></div>
          ${s.form ? `<div class="sp"><dt>Presentation</dt><dd>${esc(PR.form(s.form).name)}</dd></div>` : ''}
          <div class="wide"><dt>Illustration</dt><dd>${esc(d.imprint)}${dep ? ` · depicts <b>${esc(D.ITEMS[dep].name)}</b> <small>(the card does not include the specimen)</small>` : ''}</dd></div>
          <div class="wide"><dt>Quirk</dt><dd>${esc(s.quirk)}</dd></div>
        </dl>
        <div class="pot"><div class="pot-h"><span class="label">Enhancement potential</span><b class="mono">${s.potential}%</b></div>${ui.bar(s.potential, s.potential >= 80 ? 'gold' : 'violet')}</div>
        <p class="sh-origin">From <b>${esc(contName)}</b> · ${new Date(s.origin.at).toLocaleDateString()} · invested <span class="mono">${U.fmt(s.invested.essence)}</span> essence</p></div>`;
    }
    const v_ = s => s.variant && s.variant !== 'none';
    /** Whether a card copy projects a hologram (mirrors the card model's rule). */
    function cardProjects(s) { const st = AV.state.get().settings; return st.cardHolo !== false && AV.stage && AV.stage.supported() && AV.stage.quality() !== 'low' && (SP.rarityTier(s) >= 3 || /_living$/.test(s.form || '')); }
    /** Category statistics, comparison, growth preview, transformation tree, appearance selector and ledger. */
    function progressHTML(s) {
      const fam = ST.familyOf(s.base), pv = E.upgradePreview(s.id), can3 = AV.stage && AV.stage.supported() && AV.stage.has(s.base);
      const cands = E.all().filter(x => x.id !== s.id && ST.familyOf(x.base) === fam).sort((a, b) => (b.base === s.base) - (a.base === s.base) || SP.value(b) - SP.value(a)).slice(0, 30);
      const cmp = cmpId && cands.some(c => c.id === cmpId) ? E.get(cmpId) : null;
      const opts = cands.map(c => `<option value="${c.id}" ${cmp && cmp.id === c.id ? 'selected' : ''}>${esc(SP.displayName(c))} · ${ui.serial(c.serial)} · ${esc(SP.stageName(c))}</option>`).join('');
      return `<h4 class="sect">${esc(fam.name)} statistics</h4>
        <div class="st-tools">${cands.length ? `<label>Compare with <select id="cmpSel" aria-label="Compare statistics with another specimen"><option value="">—</option>${opts}</select></label>` : ''}${pv && pv.next ? `<label><input type="checkbox" id="showNext" ${showNext ? 'checked' : ''}> Show next upgrade (${esc(pv.nextStage)})</label>` : ''}</div>
        ${SU.statRows(s, { compare: cmp, next: showNext && pv && pv.next ? pv.next.map : null })}
        <p class="st-legend"><span><b></b>current</span>${showNext ? '<span><b class="pre"></b>after next upgrade</span>' : ''}<span><b class="tick"></b>reaches at highest stage</span><span>Click a row to see what feeds it.</span></p>
        <h4 class="sect">Progression</h4>${SU.treeBlock(s, { preview: can3 })}
        <h4 class="sect">Appearance</h4>${SU.looksBlock(s)}
        <h4 class="sect">Progress ledger</h4>${SU.ledger(s)}`;
    }
    draw(); SU.wire(m.el);
    const off = AV.bus.on('specimens', () => { if (openModal === m) draw(); }), offOrg = AV.bus.on('org', () => { if (openModal === m) draw(); });
    m.promise.then(() => { off(); offOrg(); });
    m.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('org-tagin')) { e.preventDefault(); const v = e.target.value; if (v.trim()) { refocusTag = true; if (!E.addTag([cur], v)) { refocusTag = false; ui.toast('That tag is already there, or the limit of 12 is reached.', { icon: 'tag', silent: true }); } } } });

    m.el.addEventListener('change', e => { if (e.target.id === 'orgNote') { E.setNote(cur, e.target.value); return; } if (e.target.id === 'cmpSel') { cmpId = e.target.value || null; draw(); } else if (e.target.id === 'showNext') { showNext = e.target.checked; draw(); } });
    m.el.addEventListener('click', async e => {
      const nav = e.target.closest('[data-nav]');
      if (nav && ids) { const i = ids.indexOf(cur) + +nav.dataset.nav; if (ids[i] && E.get(ids[i])) { cur = ids[i]; au.play('slide'); prev = null; cmpId = null; draw(); } return; }
      const op = e.target.closest('[data-open]'); if (op) { cur = op.dataset.open; prev = null; cmpId = null; draw(); return; }
      const hb = e.target.closest('[data-holo]'); if (hb) { holoMode = hb.dataset.holo; if (view && view.inst && view.inst.setMode) view.inst.setMode(holoMode); m.el.querySelectorAll('[data-holo]').forEach(b => b.classList.toggle('on', b === hb)); return; }
      const pf = e.target.closest('[data-prevform]'); if (pf) { prev = prev && prev.form === pf.dataset.prevform ? null : { form: pf.dataset.prevform }; draw(); return; }
      const pe = e.target.closest('[data-prevevo]'); if (pe) { prev = prev && prev.base === pe.dataset.prevevo ? null : { base: pe.dataset.prevevo }; draw(); return; }
      const tx = e.target.closest('[data-tagx]'); if (tx) { E.removeTag([cur], tx.dataset.tagx); return; }
      const fd = e.target.closest('[data-fold]'); if (fd) { const f = (AV.state.get().org.folders || []).find(x => x.id === fd.dataset.fold); if (f) { f.ids.includes(cur) ? E.folderRemove(f.id, [cur]) : E.folderAdd(f.id, [cur]); au.play('slide'); } return; }
      const lk = e.target.closest('[data-look]'); if (lk) { if (E.setLook(cur, lk.dataset.look)) au.play('slide'); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      const s = E.get(cur);
      switch (a.dataset.act) {
        case 'unprev': prev = null; draw(); break;
        case 'newfold': { const name = await ui.prompt({ title: 'New collection', label: 'A named collection or album. Specimens can belong to several.', value: '', max: 32, placeholder: 'e.g. Night Shelf' }); if (name && name.trim()) { const f = E.folderCreate(name); E.folderAdd(f.id, [cur]); ui.toast(`Created “${esc(f.name)}”`, { icon: 'folder', kind: 'good', silent: true }); } break; }
        case 'reset': if (view) { view.zoomT = 1; view.rot.idle = 9; view.rot.vy = view.rot.vp = 0; view.dirty = true; } break;
        case 'fav': { const f = E.toggleFavorite(cur); au.play('fav'); if (f) fx.burstAt(a, { count: 8, colors: ['#e68aa6', '#ece3cf'], speed: 3 }); break; }
        case 'lock': E.toggleLock(cur); au.play('lockset'); break;
        case 'comp': E.setCompanion(cur); ui.toast(`${esc(SP.displayName(s))} is now your companion`, { kind: 'good', icon: 'paw' }); au.play('confirm'); break;
        case 'rename': { const n = await ui.prompt({ title: 'Rename specimen', label: `Nickname for ${SP.itemOf(s).name} (leave empty to clear)`, value: s.nickname, max: 24 }); if (n != null) E.rename(cur, n); break; }
        case 'forge': m.close(); ui.go('forge', { select: cur }); break;
        case 'fuse': m.close(); ui.go('fusion', { primary: cur }); break;
        case 'dup': { const r = E.duplicateSpecimen(cur); if (r.ok) { au.play('confirm'); ui.toast('Duplicated (Unlimited Mode)', { kind: 'good', icon: 'copy' }); } break; }
        case 'dis': {
          const prot = E.protectReason(s);
          if (prot === 'In a combat deck') { ui.modal({ title: 'In a combat deck', html: `<p class="muted">${esc(SP.displayName(s))} cannot be dismantled while a deck holds it.</p>${ui.deckBlockNote(E.deckBlock([cur], 'dismantle'))}`, buttons: [{ label: 'Close', kind: 'ghost', value: 0 }] }); return; }
          if (prot) { ui.toast(`${prot} specimens cannot be dismantled. ${prot === 'Active companion' ? 'Choose another companion first.' : 'Remove the ' + prot.toLowerCase().replace('ed', '') + ' flag first.'}`, { kind: 'bad', icon: 'lock' }); return; }
          const ok = await ui.confirm({ title: 'Dismantle this specimen?', danger: true, confirmText: 'Dismantle', icon: 'trash', message: `<b>${esc(SP.displayName(s))}</b> (${SP.rarityOf(s).name}, <span class="mono">${ui.serial(s.serial)}</span>) will be destroyed for <b class="mono">${U.fmt(SP.essenceYield(s))} essence</b>. This cannot be undone.`, extra: `<div class="mini-list">${ui.mini(s)}</div>` });
          if (!ok) return;
          const r = E.dismantle([cur]); if (r.count) { au.play('dismantle'); fx.flash('#a99ac8', 260, .16); ui.toast(`Dismantled → +${U.fmt(r.essence)} essence`, { kind: 'good', icon: 'essence' }); if (ids) { const i = ids.indexOf(cur); ids.splice(i, 1); } m.close(); }
          break;
        }
      }
    });
  }
  AV.inspect = inspect;
})();
