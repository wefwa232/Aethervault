/* AETHERVAULT — Fusion Chamber (Phase Four). Choose a primary, add one compatible specimen (or up to two duplicates), read the exact
 * outcome, then commit. The 3D stage always shows the planned result itself (engine.fusePreview → AV.fusion.plan), so what you see is
 * what you get. Standard Mode consumes the inputs after a confirmation and a safety backup; Unlimited Mode keeps them and can reverse. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio, fx = AV.fx, ST = AV.stats, FU = () => AV.fusion;
  const esc = U.esc;
  const F = { primary: null, donors: [], q: '', cat: 'all', consume: false, last: null };
  const KIND = { duplicate: 'Duplicate fusion', recipe: 'Archive recipe', hybrid: 'Hybrid fusion', infusion: 'Element infusion', oddity: 'Oddity fusion', composite: 'Composite print', none: 'Incompatible' };
  let view = null;

  function render(root, params) {
    if (params && params.primary && E.get(params.primary)) { F.primary = params.primary; F.donors = []; }
    F.donors = F.donors.filter(id => E.get(id)); if (F.primary && !E.get(F.primary)) F.primary = null;
    root.innerHTML = `<div class="fz">
      <aside class="fz-pick s-matte sq" aria-label="Choose specimens"><h3 class="sect">${A.icon('fuse')} Specimens</h3>
        <label class="search">${A.icon('search')}<input id="fzq" type="search" placeholder="name, serial…" value="${esc(F.q)}" aria-label="Search specimens"></label>
        <div class="seg small fz-cats" role="group" aria-label="Division">${[['all', 'All']].concat(D.CATEGORIES.map(c => [c.id, c.name])).map(([id, n]) => `<button class="${F.cat === id ? 'on' : ''}" data-fcat="${id}">${n}</button>`).join('')}</div>
        <p class="tiny dim fz-step"></p><div class="fz-list" role="listbox" aria-label="Specimens"></div></aside>
      <section class="fz-chamber s-stage" aria-label="Fusion chamber">
        <header class="fz-head"><span class="label">Archive · fusion chamber</span><h1>Fusion</h1></header>
        <div class="fz-slots"></div>
        <div class="fz-core"><div class="fz-view"></div><div class="fz-flat"></div><div class="fz-anim" aria-hidden="true"></div></div>
      </section>
      <aside class="fz-plan s-matte sq" aria-label="Fusion preview" aria-live="polite"></aside></div>`;
    const list = root.querySelector('.fz-list'), slots = root.querySelector('.fz-slots'), plan = root.querySelector('.fz-plan'), step = root.querySelector('.fz-step');
    const core = root.querySelector('.fz-core'), host = root.querySelector('.fz-view'), flat = root.querySelector('.fz-flat');

    const primary = () => (F.primary ? E.get(F.primary) : null);
    function candidates() {
      const ql = F.q.trim().toLowerCase(), p = primary();
      let l = E.all().filter(s => (F.cat === 'all' || SP.itemOf(s).cat === F.cat) && (!ql || (SP.displayName(s) + ' ' + SP.itemOf(s).name + ' ' + s.serial).toLowerCase().includes(ql)));
      const k = s => (p && s.id !== p.id ? (FU().compat(p, s).ok ? 0 : 1) : 0);
      l.sort((a, b) => k(a) - k(b) || (p ? (b.base === p.base) - (a.base === p.base) : 0) || SP.rarityTier(b) - SP.rarityTier(a) || SP.value(b) - SP.value(a));
      return l;
    }
    function drawList() {
      const p = primary(), l = candidates(), shown = l.slice(0, 160);
      step.textContent = !p ? 'Step 1 · choose the primary: it keeps its base identity.' : F.donors.length ? 'Pick another duplicate (up to two) or review the preview.' : 'Step 2 · add a compatible specimen. Badges show how each one would fuse.';
      list.innerHTML = shown.map(s => {
        const c = p && s.id !== p.id ? FU().compat(p, s) : null, role = s.id === F.primary ? 'Primary' : F.donors.includes(s.id) ? 'Added' : '', R = SP.rarityOf(s);
        return `<button class="fz-row r-${R.id} ${role ? 'on' : ''} ${c && !c.ok ? 'no' : ''}" data-fid="${s.id}" role="option" aria-selected="${!!role}" title="${c ? esc(c.reason) : ''}">
          <span class="fz-art">${A.render(s)}</span><span class="fz-t"><b>${esc(SP.displayName(s))}</b><small>${R.name} · ${ui.serial(s.serial)}${s.fusion ? ' · ' + (s.fusion.rank ? 'Rank ' + FU().ROMAN[s.fusion.rank] : 'Fused') : ''}</small></span>
          ${role ? `<em class="fz-role">${role}</em>` : c ? `<em class="fz-k k-${c.kind}">${KIND[c.kind]}</em>` : ''}${s.locked ? `<i class="flag lk">${A.icon('lock')}</i>` : s.favorite ? `<i class="flag fav">${A.icon('heart')}</i>` : ''}</button>`;
      }).join('') + (l.length > shown.length ? `<p class="tiny dim">${l.length - shown.length} more — refine the search.</p>` : '') + (!l.length ? `<p class="muted">Nothing here yet.</p>` : '');
    }
    function slotHTML(s, label, idx) {
      if (!s) return `<div class="fz-slot empty"><span class="label">${label}</span><p>${idx === 0 ? 'Choose a primary' : 'Add a specimen'}</p></div>`;
      const R = SP.rarityOf(s); return `<div class="fz-slot r-${R.id}" data-slot="${idx}"><span class="label">${label}</span><span class="fz-sart">${A.render(s)}</span><b>${esc(SP.displayName(s))}</b><small class="mono">${ui.serial(s.serial)}</small><button class="icon-btn small" data-unslot="${s.id}" aria-label="Remove">${A.icon('close')}</button></div>`;
    }
    function drawSlots() {
      const p = primary(), ds = F.donors.map(E.get);
      slots.innerHTML = slotHTML(p, 'Primary base', 0) + `<span class="fz-plus" aria-hidden="true">${A.icon('plus')}</span>` + slotHTML(ds[0], ds[0] && p && ds[0].base === p.base ? 'Donor copy' : 'Secondary', 1) + (ds[0] && p && ds[0].base === p.base ? slotHTML(ds[1], 'Second donor (optional)', 2) : '');
    }
    function mountResult(pv) {
      const p0 = primary(), s = pv && pv.ok ? Object.assign({}, pv.result, { id: null, plateTitle: pv.name, plateSub: (pv.result.fusion.rank ? 'Fusion Rank ' + FU().ROMAN[pv.result.fusion.rank] : KIND[pv.kind]).toUpperCase() }) : p0 ? Object.assign({ plateTitle: SP.displayName(p0) }, p0) : null;
      if (!s) { if (view) { view.dispose(); view = null; } flat.innerHTML = `<p class="fz-empty">${A.icon('fuse')}<span>Two specimens enter. One leaves, more itself than before.</span></p>`; return; }
      flat.innerHTML = '';
      if (AV.stage && AV.stage.supported() && AV.stage.has(s.base)) {
        if (!view) view = AV.stage.view(host, { mode: 'display', interactive: true, zoom: true, layer: 0, margin: 1.1, restDelay: 2, label: 'Fusion result preview — drag to turn' });
        if (view) { view.setSpec(s); return; }
      }
      if (view) { view.dispose(); view = null; } flat.innerHTML = `<div class="hall-fallback">${A.render(s, { no3d: true })}<i class="fb-plinth"></i></div>`;
    }
    function drawPlan() {
      const p = primary();
      if (!p) { plan.innerHTML = `<h3 class="sect">Preview</h3><p class="muted">Fusion combines a primary with a compatible specimen, or with one or two copies of itself. The primary keeps its base identity; the result is a new specimen with its own fusion identifier and full lineage.</p>
        <ul class="plain tiny fz-rules"><li><b>Duplicate</b> — same collectible: Fusion Rank, best condition, more potential; a mutation slot at Rank II.</li><li><b>Hybrid / recipe</b> — same division and a shared family, or an authored Archive recipe.</li><li><b>Infusion</b> — different divisions sharing an element.</li><li><b>Oddity</b> — deliberate: the result contains what it absorbs.</li><li><b>Composite print</b> — two cards of one set.</li></ul>`; mountResult(null); return; }
      if (!F.donors.length) { plan.innerHTML = `<h3 class="sect">Preview</h3><p class="muted">Primary: <b>${esc(SP.displayName(p))}</b>. Now add a compatible specimen from the list.</p>`; mountResult(null); return; }
      const pv = E.fusePreview(F.primary, F.donors, { consume: F.consume }); F.last = pv;
      if (!pv.ok) { plan.innerHTML = `<h3 class="sect">Preview</h3><div class="note bad">${A.icon('close')}<span>${esc(pv.reason)}</span></div>`; mountResult(null); return; }
      const fam = ST.familyOf(p.base), r = pv.result, m = pv.mutation;
      const rows = fam.stats.map(st => { const a = pv.before[st.k], b = pv.after[st.k], d = b - a; return `<tr><td>${esc(st.label)}</td><td class="mono">${a}</td><td class="mono">${b}</td><td class="mono ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d > 0 ? '+' : ''}${d || '·'}</td></tr>`; }).join('');
      const costHTML = E.isUnlimited() ? '<b class="good-txt">Free (Unlimited Mode)</b>' : Object.keys(pv.cost).map(c => ui.cost(c, pv.cost[c], E.canAfford({ [c]: pv.cost[c] }))).join(' ');
      plan.innerHTML = `<h3 class="sect">Preview · exact result</h3>
        <div class="fz-verdict k-${pv.kind}"><em>${KIND[pv.kind]}</em><span>${esc(pv.compat.reason)}</span></div>
        <div class="fz-result"><h2>${esc(pv.name)}</h2><p class="mono tiny">${esc(r.fusion.classification)}${m ? ' · ' + esc(m.name) : ''}</p><p class="lore">“${esc(r.fusion.text)}”</p></div>
        <h4 class="sect">Primary keeps</h4><p class="tiny">Base identity (${esc(SP.itemOf(p).name)}), serial ${ui.serial(p.serial)}, pattern seed, upgrade stage${p.form ? ', ' + esc(AV.progress.form(p.form).name) : ''} and its ownership history.</p>
        ${pv.guaranteed.length ? `<h4 class="sect">Guaranteed</h4><ul class="plain fz-li">${pv.guaranteed.map(g => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
        ${pv.possible.length ? `<h4 class="sect">Traits that may pass</h4><ul class="plain fz-li">${pv.possible.map(x => `<li class="${pv.inherited.includes(x) ? 'win' : ''}">${esc(x)}${pv.inherited.includes(x) ? ' <b>← this pairing</b>' : ''}</li>`).join('')}</ul>` : ''}
        <h4 class="sect">Mutation</h4>${pv.mutationKept ? `<p class="tiny">Keeps its existing ${esc(m.name)}.</p>` : pv.mutationCandidates.length ? `<ul class="plain fz-li">${pv.mutationCandidates.map(c => `<li class="${c.chosen ? 'win' : ''}">${esc(c.name)}${c.chosen ? ' <b>← this pairing settles here</b>' : ''}</li>`).join('')}</ul><p class="tiny dim">Determined by both specimens' seeds — swap the primary to see a different settlement.</p>` : `<p class="tiny dim">${pv.kind === 'duplicate' ? 'None yet — a mutation slot opens at Fusion Rank II.' : 'None.'}</p>`}
        <h4 class="sect">${esc(fam.name)} statistics</h4><table class="fz-stats"><thead><tr><th></th><th>Now</th><th>After</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        <h4 class="sect">Cost</h4><p>${costHTML}</p>
        <h4 class="sect">Consequences</h4><ul class="plain fz-li ${pv.sim ? '' : 'warn'}">${pv.consequences.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        ${pv.blocked.length ? `<div class="note bad">${A.icon('lock')}<span>${pv.blocked.map(esc).join('<br>')}${pv.flagBlocked ? `<br><button class="btn ghost small" data-act="unprotect">Unlock / un-favorite these inputs…</button>` : ''}${pv.deckBlock && pv.deckBlock.blocked ? `<br><button class="btn ghost small" data-review-decks="${esc(pv.deckBlock.review)}">${A.icon('layers')}Review Decks</button>` : ''}</span></div>` : ''}
        ${E.isUnlimited() ? `<label class="toggle row"><input type="checkbox" data-act="consume" ${F.consume ? 'checked' : ''}><span></span><div>Consume inputs, as in Standard<small>Off: a simulated, reversible fusion that keeps every input</small></div></label><button class="btn ghost small" data-act="dupe">${A.icon('copy')}Duplicate the inputs first</button>` : ''}
        <button class="btn primary major fz-go" data-act="fuse" ${!pv.blocked.length && pv.affordable ? '' : 'disabled'}>${A.icon('fuse')}${pv.sim ? 'Fuse (simulated)' : 'Fuse'}</button>`;
      mountResult(pv);
    }
    const draw = () => { drawList(); drawSlots(); drawPlan(); };
    draw();

    async function commit() {
      const pv = F.last; if (!pv || !pv.ok) return;
      const inputs = [F.primary, ...F.donors].map(E.get);
      if (!pv.sim) {
        const ok = await ui.confirm({ title: 'Fuse permanently?', danger: true, confirmText: 'Fuse', icon: 'fuse', message: `<b>${inputs.length}</b> specimens will be consumed and become <b>${esc(pv.name)}</b>. A safety backup is written first, but Standard Mode cannot undo a fusion.`, extra: `<div class="mini-list">${inputs.map(s => ui.mini(s)).join('')}</div>` });
        if (!ok) return;
      }
      const anim = AV.state.get().settings.fusionAnim || 'full', red = ui.reduced(), dur = ms => (anim === 'off' ? 0 : ui.dur(red || anim === 'short' ? ms * .4 : ms));
      // inputs gather toward the centre while the result's silhouette forms
      const layer = core.querySelector('.fz-anim'), tint = (pv.result.fusion && pv.result.fusion.tint) || '#d7b46e';
      if (anim !== 'off') {
        layer.innerHTML = inputs.map((s, i) => `<span class="fz-orb" style="--i:${i};--n:${inputs.length}">${A.render(s)}</span>`).join(''); core.classList.add('fusing'); core.style.setProperty('--mt', tint);
        if (view) view.setSilhouette(true); au.play('evolve');
        await U.sleep(dur(900));
      }
      const r = E.fuse(F.primary, F.donors, { consume: F.consume });
      if (!r.ok) { core.classList.remove('fusing'); layer.innerHTML = ''; if (view) view.setSilhouette(false); ui.toast(esc(r.err), { kind: 'bad', icon: 'close', ms: 5200 }); if (r.deckBlock) draw(); return; }
      if (anim !== 'off') { fx.flash(tint, 300, .28); const b = core.getBoundingClientRect(); fx.burst(b.left + b.width / 2, b.top + b.height / 2, { count: red ? 8 : 26, colors: [tint, '#ece3cf'], speed: 4.5, life: 40 }); }
      core.classList.remove('fusing'); layer.innerHTML = '';
      F.primary = r.spec.id; F.donors = [];
      draw();
      if (view) { view.setSilhouette(false); view.playIntro('pop', anim === 'off' ? .01 : .7); }
      if (r.spec.fusion.mutation && anim !== 'off') { const m = document.createElement('div'); m.className = 'fz-cue'; m.style.setProperty('--mt', tint); m.textContent = r.spec.fusion.mutation.name; core.appendChild(m); setTimeout(() => m.remove(), dur(2400) || 10); }
      ui.levelToasts(r.levelUps);
      plan.insertAdjacentHTML('afterbegin', `<div class="note good fz-done">${A.icon('check')}<span><b>${esc(SP.displayName(r.spec))}</b> · ${esc(r.fx)}${r.sim ? ' (simulated)' : ''} created.<br><button class="btn ghost small" data-act="inspect" data-id="${r.spec.id}">${A.icon('eye')}Inspect</button>${r.sim || E.isUnlimited() ? ` <button class="btn ghost small" data-act="unfuse" data-id="${r.spec.id}">Reverse</button>` : ''}</span></div>`);
    }

    root.addEventListener('input', e => { if (e.target.id === 'fzq') { clearTimeout(root._t); root._t = setTimeout(() => { F.q = e.target.value; drawList(); }, 120); } });
    root.addEventListener('change', e => { if (e.target.dataset.act === 'consume') { F.consume = e.target.checked; drawPlan(); } });
    root.addEventListener('click', async e => {
      const c = e.target.closest('[data-fcat]'); if (c) { F.cat = c.dataset.fcat; root.querySelectorAll('[data-fcat]').forEach(b => b.classList.toggle('on', b === c)); drawList(); return; }
      const un = e.target.closest('[data-unslot]'); if (un) { const id = un.dataset.unslot; if (id === F.primary) { F.primary = null; F.donors = []; } else F.donors = F.donors.filter(x => x !== id); draw(); return; }
      const row = e.target.closest('[data-fid]');
      if (row) {
        const id = row.dataset.fid, p = primary();
        if (!p) F.primary = id;
        else if (id === F.primary) { F.primary = null; F.donors = []; }
        else if (F.donors.includes(id)) F.donors = F.donors.filter(x => x !== id);
        else { const s = E.get(id), dup = s.base === p.base && F.donors.every(d => E.get(d).base === p.base); if (dup && F.donors.length < 2) F.donors.push(id); else F.donors = [id]; }
        au.play('slide'); draw(); return;
      }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'fuse') commit();
      else if (a.dataset.act === 'inspect') AV.inspect(a.dataset.id);
      else if (a.dataset.act === 'unfuse') { const r = E.unfuse(a.dataset.id); if (r.ok) { ui.toast(`Fusion reversed${r.restored ? ` — ${r.restored} input(s) restored` : ''}`, { kind: 'good', icon: 'check' }); F.primary = null; F.donors = []; draw(); } else if (r.deckBlock) ui.modal({ title: 'In a combat deck', html: ui.deckBlockNote(r.deckBlock), buttons: [{ label: 'Close', kind: 'ghost', value: 0 }] }); else ui.toast(esc(r.err), { kind: 'bad' }); }
      else if (a.dataset.act === 'dupe') { const ids = [F.primary, ...F.donors].map(id => E.duplicateSpecimen(id)).filter(r => r.ok).map(r => r.spec.id); if (ids.length) { F.primary = ids[0]; F.donors = ids.slice(1); ui.toast('Fusing the duplicates — the originals stay untouched', { icon: 'copy' }); draw(); } }
      else if (a.dataset.act === 'unprotect') {
        const ids = [F.primary, ...F.donors]; const ok = await ui.confirm({ title: 'Remove protection?', confirmText: 'Unlock and un-favorite', message: 'These specimens will lose their lock and favorite marks so they can be used in this fusion. Nothing is fused yet.' });
        if (ok) { E.setFlags(ids, 'locked', false); E.setFlags(ids, 'favorite', false); draw(); }
      }
    });
    ui.sub('specimens', () => { if (!core.classList.contains('fusing')) { F.donors = F.donors.filter(id => E.get(id)); if (F.primary && !E.get(F.primary)) F.primary = null; drawList(); drawSlots(); } });
    ui.sub('mode', () => draw());
    ui.onLeave(() => { if (view) { view.dispose(); view = null; } });
  }
  ui.register('fusion', { render });
})();
