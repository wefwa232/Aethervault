/* AETHERVAULT — Combat deck editor. Ten specimens, any mixture. Entries are checked against the live save each time and flagged, never silently dropped.
 * Shows the combat numbers each specimen translates to (with the formula behind every one), presets computed from the collection, and the recommended starter. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio, C = AV.combat;
  const esc = U.esc;
  let selId = null, text = '', role = 'all', more = { ok: 40, no: 12 };

  const S = () => AV.state.get(), cb = () => S().combat;
  const roleName = r => (C.defs.ROLES[r] || {}).name || r;
  const ROLE_ORDER = ['ranged', 'vanguard', 'striker', 'support', 'disruptor'];

  function numbersModal(spec) {
    const t = C.translate(spec), d = C.defs.get(spec.base); if (!t.ok) return;
    ui.modal({
      title: esc(SP.displayName(spec)) + ' · combat numbers', cls: 'cb-num-modal',
      html: `<p class="muted">${esc(d.blurb || '')} <b>${esc(roleName(d.role))}</b> · costs <b class="cb-elx">${d.cost}</b> Elixir (authored, not from rarity).</p>
        <ul class="cb-rows">${t.rows.map(w => `<li><b>${esc(w.label)}</b><span class="mono">${w.value}${w.unit ? ' ' + esc(w.unit) : ''}</span><small>${esc(w.text.replace(w.label + ' ' + w.value + (w.unit ? ' ' + w.unit : '') + ' = ', ''))}</small></li>`).join('')}</ul>
        <p class="tiny dim">Every number is read from this specimen’s stats (upgrade level, form, variant, condition and fusion included). Combat never changes the specimen.</p>`,
      buttons: [{ label: 'Close', kind: 'primary', value: 1 }],
    });
  }

  function render(root, params) {
    const c = cb();
    if (!c) { root.innerHTML = `<div class="panel pad"><h2>Combat data unavailable</h2><p class="muted">The save could not be upgraded for combat. Your collection is untouched; restart to retry. A raw backup is kept under <code>${AV.state.BACKUP_KEY_P5}</code>.</p></div>`; return; }
    if (params && params.id && c.decks.some(k => k.id === params.id)) selId = params.id;
    if (!c.decks.some(k => k.id === selId)) selId = c.activeDeck || (c.decks[0] && c.decks[0].id) || null;

    const draw = () => {
      const s = S(), deck = c.decks.find(k => k.id === selId), V = deck ? C.deck.validate(s, deck.entries) : null, want = C.tuning.hand.deck;
      const inDeck = new Set(deck ? deck.entries.map(e => e.id) : []);
      const tabs = c.decks.map(k => { const v = C.deck.validate(s, k.entries); return `<button class="dtab ${k.id === selId ? 'on' : ''}" data-tab="${k.id}">${esc(k.name)}<small class="${v.valid ? 'ok' : ''}">${v.usable}/${want}</small>${c.activeDeck === k.id ? `<i title="Active deck">${A.icon('star')}</i>` : ''}</button>`; }).join('');
      const slot = i => {
        const r = V && V.rows[i];
        if (!r) return `<div class="dslot empty"><span>Slot ${i + 1}</span><small>Add a specimen from the collection</small></div>`;
        if (!r.spec) return `<div class="dslot bad"><b>Missing specimen</b><small>${esc(r.reason)}</small><button class="btn small ghost" data-rm="${r.id}">${A.icon('close')}Remove</button></div>`;
        const R = SP.rarityOf(r.spec), f = r.facts;
        return `<div class="dslot r-${R.id} ${r.ok ? '' : 'bad'}" data-num="${r.id}" tabindex="0" role="button" aria-label="${esc(SP.displayName(r.spec))}, show combat numbers">
          <i class="plate-bar"></i><div class="ds-art">${A.render(r.spec)}</div>
          <div class="ds-txt"><b>${esc(SP.displayName(r.spec))}</b><small>${r.def ? esc(roleName(r.def.role)) : esc(SP.itemOf(r.spec).cat)}${r.spec.level ? ' · ' + esc(SP.stageName(r.spec)) : ''}</small>
          ${r.ok ? `<small class="mono" title="range ${f.range} · speed ${f.speed}">${f.hp} HP · ${f.dps} DPS</small>` : `<small class="why">${esc(r.reason)}</small>`}</div>
          ${r.def ? `<span class="cb-cost" title="Elixir cost">${r.cost}</span>` : ''}
          <button class="icon-btn ds-x" data-rm="${r.id}" aria-label="Remove from deck">${A.icon('close')}</button></div>`;
      };
      const slots = Array.from({ length: want }, (_, i) => slot(i)).join('');
      const roles = V ? ROLE_ORDER.filter(r => V.roles[r]).map(r => `<span class="rolepip role-${r}">${esc(roleName(r))} <b>${V.roles[r]}</b></span>`).join('') : '';
      const presets = C.deck.presets(s);
      // collection picker
      const q = text.trim().toLowerCase(), all = Object.values(s.specimens).map(sp => ({ sp, v: C.defs.readiness(sp), d: C.defs.get(sp.base) }));
      const match = x => { const it = SP.itemOf(x.sp); return (!q || SP.displayName(x.sp).toLowerCase().includes(q) || it.name.toLowerCase().includes(q)) && (role === 'all' || (x.d && x.d.role === role)); };
      const elig = all.filter(x => x.v.ok && match(x)).map(x => ({ x, t: C.translate(x.sp) })).sort((a, b) => b.t.hp * b.t.dps - a.t.hp * a.t.dps || (a.x.sp.id < b.x.sp.id ? -1 : 1));
      const notReady = all.filter(x => !x.v.ok && x.v.code !== 'card' && match(x) && role === 'all').sort((a, b) => (a.sp.base < b.sp.base ? -1 : 1));
      const cards = all.filter(x => x.v.code === 'card').length;
      const row = ({ x, t }) => { const R = SP.rarityOf(x.sp), used = inDeck.has(x.sp.id), full = !!deck && deck.entries.length >= want;
        return `<div class="prow r-${R.id}" data-num="${x.sp.id}"><span class="pr-art">${A.render(x.sp)}</span><span class="pr-txt"><b>${esc(SP.displayName(x.sp))}</b><small>${esc(roleName(x.d.role))}${x.sp.level ? ' · ' + esc(SP.stageName(x.sp)) : ''} · <span class="mono">${t.hp} HP · ${t.dps} DPS</span></small></span>
          <span class="cb-cost" title="Elixir cost">${x.d.cost}</span><button class="btn small ${used ? 'ghost' : 'primary'}" data-add="${x.sp.id}" ${!deck || used || full ? 'disabled' : ''}>${used ? 'In deck' : full ? 'Deck full' : 'Add'}</button></div>`; };
      const nrow = x => { const R = SP.rarityOf(x.sp); return `<div class="prow dim r-${R.id}"><span class="pr-art">${A.render(x.sp)}</span><span class="pr-txt"><b>${esc(SP.displayName(x.sp))}</b><small>${esc(x.v.reason)}</small></span><button class="btn small ghost" disabled>Not ready</button></div>`; };
      root.innerHTML = `<div class="deck">
        <header class="page-head"><div><span class="label">Combat</span><h1>Deck editor</h1><p class="muted">Exactly ${want} specimens, any mixture. Only combat-ready specimens can be added; the rest are listed so you can see what is coming.</p></div>
          <div class="head-actions"><button class="btn ghost" data-act="back">${A.icon('back')}Combat</button></div></header>
        <div class="deck-tabs" role="tablist" aria-label="Decks">${tabs}${c.decks.length < 20 ? `<button class="dtab add" data-act="new">${A.icon('plus')}New deck</button>` : ''}</div>
        ${deck ? `<div class="deck-grid">
          <section class="s-matte pad deck-main">
            <div class="deck-bar"><input class="deck-name" id="dkName" value="${esc(deck.name)}" maxlength="28" aria-label="Deck name">
              <button class="btn small ${c.activeDeck === deck.id ? 'on' : 'ghost'}" data-act="active" ${c.activeDeck === deck.id ? 'disabled' : ''}>${A.icon('star')}${c.activeDeck === deck.id ? 'Active' : 'Make active'}</button>
              <button class="btn small ghost" data-act="dup">${A.icon('copy')}Duplicate</button><button class="btn small ghost" data-act="clear" ${deck.entries.length ? '' : 'disabled'}>Clear</button><button class="btn small danger" data-act="del">${A.icon('trash')}Delete</button></div>
            <div class="deck-slots">${slots}</div>
            <div class="deck-sum"><div class="ds-line"><b class="${V.valid ? 'ok' : ''}">${V.usable}/${want}</b><span>${V.valid ? 'Ready for battle' : V.practice ? 'Usable for practice; ranked needs a full deck' : 'Add specimens to begin'}</span>${V.usable ? `<span class="mono">avg cost ${V.avgCost}</span>` : ''}</div>
              <div class="rolepips">${roles}</div>${V.issues.length ? `<ul class="issues">${V.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}</div>
            <div class="deck-presets"><span class="label">Presets <small>built from your collection</small></span>${presets.length ? presets.map(p => `<button class="preset" data-preset="${p.id}" title="${esc(p.blurb)}"><b>${esc(p.name)}</b><small>${p.ids.length}/${want} · ${esc(p.blurb)}</small></button>`).join('') : '<p class="muted tiny">You have no combat-ready specimens yet. Pets such as Nimbit or Emberkit can be found in the Hatchling Egg.</p>'}</div>
          </section>
          <section class="s-matte pad deck-pick"><div class="pick-bar"><input class="deck-search" id="dkSearch" type="search" placeholder="Search your collection…" value="${esc(text)}" aria-label="Search collection">
            <div class="seg" role="group" aria-label="Role">${['all'].concat(ROLE_ORDER).map(r => `<button class="${role === r ? 'on' : ''}" data-role="${r}">${r === 'all' ? 'All' : esc(roleName(r))}</button>`).join('')}</div></div>
            <div class="plist">${elig.length ? elig.slice(0, more.ok).map(row).join('') + (elig.length > more.ok ? `<button class="btn small ghost" data-more="ok">Show ${Math.min(40, elig.length - more.ok)} more (${elig.length - more.ok} left)</button>` : '') : `<p class="muted pad-s">${all.some(x => x.v.ok) ? 'Nothing matches.' : 'No combat-ready specimens in your collection.'}</p>`}</div>
            ${notReady.length ? `<details class="nr"><summary>Not yet combat-ready <b>${notReady.length}</b></summary><div class="plist">${notReady.slice(0, more.no).map(nrow).join('')}${notReady.length > more.no ? `<button class="btn small ghost" data-more="no">Show more (${notReady.length - more.no} left)</button>` : ''}</div></details>` : ''}
            ${cards ? `<p class="tiny dim">${cards} collectible card${cards === 1 ? '' : 's'} stay outside combat.</p>` : ''}</section></div>`
          : `<div class="panel pad deck-none">${ui.empty('sword', 'No decks yet', 'Create a deck to choose which specimens you take into battle.', `<button class="btn primary" data-act="new">${A.icon('plus')}New deck</button>${presets.length ? `<button class="btn ghost" data-act="starter">${A.icon('sparkle')}Build the recommended starter</button>` : ''}`)}</div>`}
      </div>`;
    };

    const rerender = () => { const y = root.querySelector('.deck-pick .plist') ? root.querySelector('.deck-pick .plist').scrollTop : 0; draw(); const l = root.querySelector('.deck-pick .plist'); if (l) l.scrollTop = y; };
    draw();
    root.addEventListener('click', e => {
      const t = e.target, deck = c.decks.find(k => k.id === selId);
      const tab = t.closest('[data-tab]'); if (tab) { selId = tab.dataset.tab; more = { ok: 40, no: 12 }; draw(); return; }
      const rm = t.closest('[data-rm]'); if (rm && deck) { E.deckUpdate(deck.id, { ids: deck.entries.filter(x => x.id !== rm.dataset.rm).map(x => x.id) }); au.play('lockset'); rerender(); return; }
      const add = t.closest('[data-add]'); if (add && deck) { if (deck.entries.length < C.tuning.hand.deck && !deck.entries.some(x => x.id === add.dataset.add)) { E.deckUpdate(deck.id, { ids: deck.entries.map(x => x.id).concat(add.dataset.add) }); au.play('fav'); rerender(); } return; }
      const rl = t.closest('[data-role]'); if (rl) { role = rl.dataset.role; more.ok = 40; draw(); return; }
      const mo = t.closest('[data-more]'); if (mo) { more[mo.dataset.more] += 40; rerender(); return; }
      const pr = t.closest('[data-preset]'); if (pr && deck) { const p = C.deck.presets(S()).find(x => x.id === pr.dataset.preset); if (p) { E.deckUpdate(deck.id, { ids: p.ids, preset: p.id }); au.play('seal'); ui.toast(`${p.name} applied (${p.ids.length} specimens)`, { kind: 'good', icon: 'check' }); rerender(); } return; }
      const num = t.closest('[data-num]'); if (num && !t.closest('button')) { const sp = S().specimens[num.dataset.num]; if (sp) numbersModal(sp); return; }
      const a = t.closest('[data-act]'); if (!a) return;
      switch (a.dataset.act) {
        case 'back': ui.go('combat'); break;
        case 'new': { const k = E.deckCreate(null, []); if (k) { selId = k.id; au.play('lockset'); draw(); } break; }
        case 'starter': { const p = C.deck.presets(S())[0]; const k = E.deckCreate('Starter', p ? p.ids : [], p ? p.id : null); if (k) { selId = k.id; au.play('seal'); draw(); } break; }
        case 'active': if (deck && E.deckSetActive(deck.id)) { au.play('fav'); ui.toast(`“${deck.name}” is your active deck`, { kind: 'good', icon: 'star' }); draw(); } break;
        case 'dup': if (deck) { const k = E.deckDuplicate(deck.id); if (k) { selId = k.id; draw(); } } break;
        case 'clear': if (deck) { E.deckUpdate(deck.id, { ids: [] }); draw(); } break;
        case 'del': if (deck) ui.confirm({ title: 'Delete deck', message: `Delete “${esc(deck.name)}”? Its specimens are not affected.`, confirmText: 'Delete', danger: true }).then(ok => { if (ok) { E.deckDelete(deck.id); selId = c.activeDeck; draw(); } }); break;
      }
    });
    root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.dslot[data-num]')) { e.preventDefault(); const sp = S().specimens[e.target.dataset.num]; if (sp) numbersModal(sp); } });
    root.addEventListener('input', e => {
      if (e.target.id === 'dkSearch') { text = e.target.value; more.ok = 40; const pos = e.target.selectionStart; draw(); const el = root.querySelector('#dkSearch'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }
    });
    root.addEventListener('change', e => { if (e.target.id === 'dkName' && selId) { E.deckUpdate(selId, { name: e.target.value }); draw(); } });
  }
  ui.register('deck', { render });
})();
