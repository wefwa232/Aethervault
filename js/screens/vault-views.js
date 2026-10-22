/* AETHERVAULT — Vault views (Phase Four): card binder, families/lines, duplicate groups, acquisition timeline, history ledger,
 * set completion, the comparison sheet and the advanced filter panel. Every picture here is a cached thumbnail (A.render) or SVG;
 * none of these views creates a live 3D view. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio, VQ = AV.vaultQ, CD = AV.cards, ST = AV.stats;
  const esc = U.esc;
  const V = () => AV.vaultState, S = () => AV.state.get();
  const best = list => list.slice().sort((a, b) => SP.value(b) - SP.value(a))[0];
  const owned = () => { const m = {}; E.all().forEach(s => (m[s.base] = m[s.base] || []).push(s)); return m; };

  // ================================================================ rail texts for the views without filters
  function rail(view) {
    const t = { binder: ['Card binder', 'Every set, page by page. Numbered slots fill as you collect; missing cards show as silhouettes. A page that fills completely earns a seal.'],
      history: ['History', 'Every recorded event across the collection: acquisitions, upgrades, transformations, fusions and renames, newest first.'],
      sets: ['Sets', 'Completion by card set, with what is still missing.'] }[view] || ['', ''];
    return `<h3 class="sect">${t[0]}</h3><p class="tiny muted">${t[1]}</p>${view === 'history' ? `<h3 class="sect">Show</h3><div class="seg small" role="group">${[['all', 'All'], ['created', 'Acquired'], ['upgrade', 'Upgrades'], ['evolve', 'Transformations'], ['fuse', 'Fusions'], ['rename', 'Renames']].map(([v, l]) => `<button class="${V().hist === v ? 'on' : ''}" data-hist="${v}">${l}</button>`).join('')}</div>` : ''}`;
  }

  // ================================================================ card binder
  function binder(body, ctx) {
    const v = V().binder, sets = CD.SETS, set = CD.SET[v.set] || sets[0]; v.set = set.id;
    const mine = owned(), cards = set.cards.map(c => D.ITEMS['c' + set.id + String(c.no).padStart(3, '0')]);
    const have = cards.filter(i => mine[i.id]).length, pct = Math.round(have / cards.length * 100), pages = Math.ceil(cards.length / 9);
    v.page = U.clamp(v.page, 0, pages - 1);
    ctx.sub.textContent = `${set.name} · ${have} of ${cards.length} cards (${pct}%)`;
    const tabs = sets.map(s => { const cs = s.cards.map(c => 'c' + s.id + String(c.no).padStart(3, '0')), h = cs.filter(id => mine[id]).length; return `<button class="btab ${s.id === set.id ? 'on' : ''}" data-bset="${s.id}" style="--sc:${s.color}"><b>${esc(s.code)}</b><span>${esc(s.name)}</span><small class="mono">${h}/${cs.length}</small><i style="width:${h / cs.length * 100}%"></i></button>`; }).join('');
    const slot = it => {
      const list = mine[it.id] || [], no = String(it.card.no).padStart(3, '0');
      if (!list.length) return `<div class="bslot missing" aria-label="Missing card ${no}"><span class="bs-no mono">${no}</span><span class="bs-sil">${A.render(it.id, { silhouette: true })}</span><small>${D.RARITY[it.rarity].name}</small></div>`;
      const alts = list.filter(s => s.card && s.card.alt), std = list.filter(s => !(s.card && s.card.alt)), showAlt = v.alt && v.alt[it.id] && alts.length, shown = best(showAlt ? alts : (std.length ? std : alts));
      const foil = list.some(s => s.card && s.card.foil !== 'none'), first = list.some(s => s.card && (s.card.edition === 'first' || s.card.edition === 'proof'));
      return `<div class="bslot r-${it.rarity}" data-bid="${shown.id}"><span class="bs-no mono">${no}</span><span class="bs-art">${A.render(shown)}</span>
        <span class="bs-flags">${list.length > 1 ? `<b class="mono">×${list.length}</b>` : ''}${foil ? '<i class="f-foil" title="A foil copy is owned">FOIL</i>' : ''}${first ? '<i class="f-ed" title="A first edition or proof is owned">1ST</i>' : ''}${alts.length && std.length ? `<button class="f-alt" data-balt="${it.id}" title="Show the ${showAlt ? 'standard' : 'alternate'} art">${showAlt ? 'STD' : 'ALT'}</button>` : alts.length ? '<i class="f-alt" title="Alternate art">ALT</i>' : ''}</span></div>`;
    };
    let pagesHTML;
    if (v.list) pagesHTML = `<div class="tscroll"><table class="blist"><thead><tr><th>No.</th><th>Card</th><th>Class</th><th>Rarity</th><th>Owned</th><th>Best copy</th></tr></thead><tbody>${cards.map(it => { const l = mine[it.id] || [], b = l.length ? best(l) : null; return `<tr class="${l.length ? '' : 'miss'}" ${b ? `data-bid="${b.id}"` : ''}><td class="mono">${CD.number(it)}</td><td>${l.length ? esc(it.name) : '<i>Not yet catalogued</i>'}</td><td>${esc(CD.CLASSES[it.card.cls].name)}</td><td>${ui.rtag(it.rarity)}</td><td class="mono">${l.length || '—'}</td><td>${b ? esc(CD.describe(b).finish + ' · ' + CD.describe(b).foil + (b.card.alt ? ' · Alt' : '')) : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
    else {
      const pg = cards.slice(v.page * 9, v.page * 9 + 9), full = pg.length === 9 && pg.every(i => mine[i.id]);
      pagesHTML = `<div class="bpage ${v.turn || ''} ${full ? 'sealed' : ''}" data-page="${v.page}"><div class="bgrid">${pg.map(slot).join('')}</div>${full ? `<span class="bseal" title="Every slot on this page is filled">${A.icon('seal')}<b>Page complete</b></span>` : ''}<span class="bfoot mono">${set.code} · page ${v.page + 1} of ${pages}</span></div>`;
      v.turn = '';
    }
    body.innerHTML = `<div class="binder"><div class="btabs" role="tablist">${tabs}</div>
      <div class="bbar"><div class="bpct"><b class="mono">${pct}%</b>${ui.bar(pct, 'gold')}</div><div class="seg small"><button class="${v.list ? '' : 'on'}" data-blist="0">${A.icon('binder')}Pages</button><button class="${v.list ? 'on' : ''}" data-blist="1">${A.icon('sort')}Fast list</button></div>
        ${v.list ? '' : `<div class="bnav"><button class="icon-btn" data-bpg="-1" ${v.page <= 0 ? 'disabled' : ''} aria-label="Previous page">${A.icon('back')}</button><span class="mono">${v.page + 1} / ${pages}</span><button class="icon-btn flip" data-bpg="1" ${v.page >= pages - 1 ? 'disabled' : ''} aria-label="Next page">${A.icon('back')}</button></div>`}</div>
      ${pagesHTML}</div>`;
  }

  // ================================================================ families / lines
  function lines(body, ctx) {
    const res = ctx.results(), by = {}; res.forEach(x => (by[x.s.base] = by[x.s.base] || []).push(x.s));
    ctx.sub.textContent = `${res.length} specimens in ${Object.keys(by).length} families`;
    const evo = D.EVO_LINES.map(L => {
      const chain = []; const walk = (id, depth) => { chain.push({ id, depth }); (D.ITEMS[id].evolves || []).forEach(e => walk(e.to, depth + 1)); }; walk(L.root, 0);
      const forms = chain.flatMap(c => AV.progress.formsFor(c.id).map(f => ({ f, c })));
      return `<section class="line"><header><h3>${esc(L.name)}</h3><p class="muted tiny">${esc(L.blurb)}</p></header><div class="line-chain">${chain.map(c => { const n = (by[c.id] || []).length, it = D.ITEMS[c.id]; return `<button class="lnode ${n ? '' : 'none'}" data-lbase="${c.id}" style="--d:${c.depth}"><span class="lart">${A.render(c.id, n ? {} : { silhouette: !S().discovered[c.id] })}</span><b>${esc(it.name)}</b><small class="mono">${n ? '×' + n : '—'}</small></button>`; }).join(`<i class="larrow">${A.icon('back')}</i>`)}</div>
        ${forms.length ? `<div class="line-forms">${forms.map(({ f, c }) => { const n = (by[c.id] || []).filter(s => s.form === f.id).length; return `<span class="lform ${n ? 'own' : ''}"><i style="background:${f.tint}"></i>${esc(f.name)} <small class="mono">${n || ''}</small></span>`; }).join('')}</div>` : ''}</section>`;
    }).join('');
    const fams = Object.keys(by).filter(b => !D.EVO_LINES.some(L => { let ok = false; const walk = id => { if (id === b) ok = true; (D.ITEMS[id].evolves || []).forEach(e => walk(e.to)); }; walk(L.root); return ok; })).sort((a, b) => D.RARITY[D.ITEMS[b].rarity].tier - D.RARITY[D.ITEMS[a].rarity].tier).slice(0, 60);
    const famHTML = fams.map(b => {
      const it = D.ITEMS[b], list = by[b], groups = {}; list.forEach(s => { const k = s.form ? AV.progress.form(s.form).name : (s.fusion ? 'Fused' : 'Untransformed'); (groups[k] = groups[k] || []).push(s); });
      return `<section class="fam"><header><span class="fam-art">${A.render(b)}</span><div><b>${esc(it.name)}</b><small>${esc(D.CATEGORY[it.cat].single)} · ${AV.progress.formsFor(b).map(f => esc(f.name)).join(' / ') || 'no transformation'}</small></div></header>
        <div class="fam-groups">${Object.keys(groups).map(k => `<div class="fam-g"><span class="label">${esc(k)}</span><div class="mini-row">${groups[k].slice(0, 8).map(s => `<button class="mrow" data-open="${s.id}" title="${esc(SP.displayName(s))} ${ui.serial(s.serial)}">${A.render(s)}</button>`).join('')}${groups[k].length > 8 ? `<span class="mono tiny">+${groups[k].length - 8}</span>` : ''}</div></div>`).join('')}</div></section>`;
    }).join('');
    body.innerHTML = `<div class="lines"><h2 class="sect">Evolution lines</h2>${evo}<h2 class="sect">Transformation families</h2><div class="fams">${famHTML || '<p class="muted">Nothing matches the current filters.</p>'}</div></div>`;
  }

  // ================================================================ duplicate groups
  function dupes(body, ctx) {
    const res = ctx.results(), by = {}; res.forEach(x => (by[x.s.base] = by[x.s.base] || []).push(x.s));
    const groups = Object.keys(by).map(b => ({ b, list: E.all().filter(s => s.base === b) })).filter(g => g.list.length > 1).sort((a, b) => b.list.length - a.list.length);
    ctx.sub.textContent = groups.length ? `${groups.length} collectibles with duplicates · ${groups.reduce((a, g) => a + g.list.length - 1, 0)} extra copies` : 'No duplicates';
    if (!groups.length) { body.innerHTML = ui.empty('copy', 'No duplicates', 'Every collectible here is unique — or the filters hide the copies.'); return; }
    const row = (s, b) => {
      const diff = k => (k(s) !== k(b) ? 'diff' : ''), it = SP.itemOf(s), card = it.cat === 'card';
      return `<tr class="${s.id === b.id ? 'bestrow' : ''}" data-open="${s.id}"><td><span class="dart">${A.render(s)}</span></td><td class="mono">${ui.serial(s.serial)}</td>
        <td class="${diff(x => x.variant)}">${SP.variantOf(s).name}</td><td class="${diff(x => x.condition)}">${SP.conditionLabel(s)}</td><td class="mono ${diff(x => x.potential)}">${s.potential}%</td>
        <td class="${diff(x => x.level)}">${esc(SP.stageName(s))}</td><td class="${diff(x => x.form || '')}">${s.form ? esc(AV.progress.form(s.form).name) : s.fusion ? 'Fused' : '—'}</td>
        ${card ? `<td class="${diff(x => CD.key(x.card))}">${esc(CD.describe(s).foil)}${s.card.alt ? ' · Alt' : ''}${s.card.edition !== 'unlimited' ? ' · ' + esc(CD.describe(s).edition) : ''}</td>` : '<td></td>'}
        <td class="mono">${U.fmt(SP.value(s))}</td><td>${s.locked ? A.icon('lock') : ''}${s.favorite ? A.icon('heart') : ''}</td></tr>`;
    };
    body.innerHTML = `<div class="dupes"><div class="dupes-bar"><button class="btn ghost" data-act="dupes">${A.icon('trash')}Dismantle every extra copy…</button><span class="tiny dim">The best copy of each collectible is always kept; favorites and locks are protected.</span></div>
      ${groups.slice(0, 60).map(g => {
        const it = D.ITEMS[g.b], b = best(g.list), extras = g.list.filter(s => s.id !== b.id), sub = {}; g.list.forEach(s => { const k = SP.variantOf(s).name + ' · ' + SP.conditionLabel(s) + (s.card ? ' · ' + CD.describe(s).foil : '') + (s.form ? ' · ' + AV.progress.form(s.form).name : ''); sub[k] = (sub[k] || 0) + 1; });
        const fusable = extras.filter(s => !s.locked && !s.favorite).slice(0, 2);
        return `<section class="dgroup"><header><span class="dg-art">${A.render(g.b)}</span><div><h3>${esc(it.name)} <span class="mono">×${g.list.length}</span></h3><p class="tiny muted">Best copy: <b>${ui.serial(b.serial)}</b> — highest value (${SP.conditionLabel(b)}, potential ${b.potential}%${b.variant !== 'none' ? ', ' + SP.variantOf(b).name : ''})</p>
          <div class="dg-sub">${Object.keys(sub).map(k => `<span class="chip-s">${esc(k)} ×${sub[k]}</span>`).join('')}</div></div>
          <div class="dg-acts"><button class="btn ghost small" data-dfuse="${b.id}" data-donors="${fusable.map(s => s.id).join(',')}" ${fusable.length && !(b.fusion && b.fusion.rank >= 3) ? '' : 'disabled'}>${A.icon('fuse')}Fuse into best</button><button class="btn ghost small" data-dlock="${b.id}">${A.icon('lock')}Lock best</button><button class="btn danger small" data-ddis="${extras.map(s => s.id).join(',')}">${A.icon('trash')}Dismantle extras…</button></div></header>
          <div class="tscroll"><table class="dtable"><thead><tr><th></th><th>Serial</th><th>Variant</th><th>Condition</th><th>Potential</th><th>Stage</th><th>Form</th><th>${it.cat === 'card' ? 'Print' : ''}</th><th>Value</th><th></th></tr></thead><tbody>${g.list.slice().sort((x, y) => SP.value(y) - SP.value(x)).map(s => row(s, b)).join('')}</tbody></table></div></section>`;
      }).join('')}</div>`;
  }

  // ================================================================ acquisition timeline
  function timeline(body, ctx) {
    const res = ctx.results().slice().sort((a, b) => b.at - a.at).slice(0, 400), days = {};
    res.forEach(x => { const k = new Date(x.at).toDateString(); (days[k] = days[k] || []).push(x.s); });
    ctx.sub.textContent = `${res.length} most recent acquisitions`;
    body.innerHTML = `<div class="tline">${Object.keys(days).map(k => `<section class="tday"><header><b>${esc(new Date(k).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }))}</b><span class="mono tiny">${days[k].length}</span></header>
      <div class="tday-g">${days[k].map(s => `<button class="tcell r-${SP.rarityOf(s).id}" data-open="${s.id}"><span class="tart">${A.render(s)}</span><b>${esc(SP.displayName(s))}</b><small>${esc(VQ.sourceName(s.origin && s.origin.fusion ? 'fusion' : (s.origin && s.origin.container) || 'creator'))} · ${new Date(s.origin.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></button>`).join('')}</div></section>`).join('') || ui.empty('calendar', 'Nothing yet', 'Acquisitions appear here by day.')}</div>`;
  }

  // ================================================================ history ledger
  function history(body, ctx) {
    const type = V().hist, ev = [];
    E.all().forEach(s => (s.history || []).forEach(h => { if (type === 'all' || h.type === type || (type === 'evolve' && h.type === 'form')) ev.push({ h, s }); }));
    (S().fusions || []).forEach(f => { if (type === 'all' || type === 'fuse') f.consumed.forEach(id => { if (!E.get(id)) { const p = f.parents.find(x => x.id === id); if (p) ev.push({ h: { t: f.at, type: 'fuse', text: `Consumed by fusion ${f.id}.` }, s: p, gone: true }); } }); });
    ev.sort((a, b) => b.h.t - a.h.t);
    ctx.sub.textContent = `${ev.length} recorded events`;
    body.innerHTML = `<ol class="hist">${ev.slice(0, 300).map(({ h, s, gone }) => `<li class="t-${h.type} ${gone ? 'gone' : ''}" ${gone ? '' : `data-open="${s.id}"`}><time class="mono">${new Date(h.t).toLocaleDateString()} ${new Date(h.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span class="hart">${A.render(s)}</span><span><b>${esc(SP.displayName(s))}</b> <small class="mono">${ui.serial(s.serial)}</small><br>${esc(h.text)}</span></li>`).join('')}</ol>${ev.length > 300 ? `<p class="tiny dim">Showing the newest 300 of ${ev.length}.</p>` : ''}`;
  }

  // ================================================================ set completion
  function sets(body, ctx) {
    const mine = owned();
    ctx.sub.textContent = `${CD.SETS.length} card sets`;
    body.innerHTML = `<div class="setsv">${CD.SETS.map(s => {
      const ids = s.cards.map(c => 'c' + s.id + String(c.no).padStart(3, '0')), have = ids.filter(id => mine[id]);
      const byR = D.RARITIES.map(r => { const all = ids.filter(id => D.ITEMS[id].rarity === r.id); return all.length ? `<span class="sr r-${r.id}">${A.rarityGlyph(r.id)}<b class="mono">${all.filter(id => mine[id]).length}/${all.length}</b></span>` : ''; }).join('');
      const miss = ids.filter(id => !mine[id]);
      return `<section class="setcard" style="--sc:${s.color}"><header><b class="mono">${esc(s.code)}</b><div><h3>${esc(s.name)}</h3><p class="tiny muted">${esc(s.year)} · ${esc(s.blurb)}</p></div><button class="btn ghost small" data-tobinder="${s.id}">${A.icon('binder')}Open binder</button></header>
        <div class="setbar"><b class="mono">${have.length}/${ids.length}</b>${ui.bar(have.length / ids.length * 100, 'gold')}</div><div class="setr">${byR}</div>
        ${miss.length ? `<p class="tiny dim">Missing: ${miss.map(id => `<span class="mono">${String(D.ITEMS[id].card.no).padStart(3, '0')}</span>`).join(' ')}</p>` : `<p class="good-txt tiny">${A.icon('seal')} Set complete.</p>`}</section>`;
    }).join('')}</div>`;
  }

  // ================================================================ comparison (2–4 specimens)
  function compare(ids) {
    const list = ids.map(E.get).filter(Boolean).slice(0, 4); if (list.length < 2) return;
    const fams = new Set(list.map(s => ST.famName(s.base))), same = fams.size === 1, allCards = list.every(s => SP.itemOf(s).cat === 'card');
    const row = (label, f, hiFn) => { const vals = list.map(f), hi = hiFn ? hiFn(vals) : -1; return `<tr><th>${label}</th>${vals.map((v, i) => `<td class="${i === hi ? 'hi' : ''}">${v}</td>`).join('')}</tr>`; };
    const maxI = vals => { const n = vals.map(v => parseFloat(String(v).replace(/[^\d.-]/g, ''))); const m = Math.max(...n); return n.filter(x => x === m).length === 1 ? n.indexOf(m) : -1; };
    const minI = vals => { const n = vals.map(v => parseFloat(String(v).replace(/[^\d.-]/g, ''))); const m = Math.min(...n); return n.filter(x => x === m).length === 1 ? n.indexOf(m) : -1; };
    const growth = s => { const now = ST.compute(s).list.filter(x => x.k !== 'growth').reduce((a, x) => a + x.value, 0), top = Object.entries(ST.ceiling(s)).filter(([k]) => k !== 'growth').reduce((a, [, v]) => a + v, 0); return `+${top - now} <small>to ${top}</small>`; };
    let stats = '';
    if (same) { const fam = ST.familyOf(list[0].base); stats = `<tbody class="cmp-stats"><tr class="cmp-h"><th colspan="${list.length + 1}">${esc(fam.name)} statistics</th></tr>${fam.stats.map(st => row(esc(st.label), s => ST.compute(s).map[st.k], maxI)).join('')}</tbody>`; }
    else stats = `<tbody class="cmp-stats"><tr class="cmp-h"><th colspan="${list.length + 1}">Statistics (different families — shown separately)</th></tr><tr><th></th>${list.map(s => { const c = ST.compute(s); return `<td><b class="tiny">${esc(c.family.name)}</b>${c.list.filter(x => x.k !== 'growth').map(x => `<div class="cmp-st"><span>${esc(x.label)}</span><b class="mono">${x.value}</b></div>`).join('')}</td>`; }).join('')}</tr></tbody>`;
    const cards = allCards ? `<tbody><tr class="cmp-h"><th colspan="${list.length + 1}">Card print</th></tr>${row('Set · number', s => esc(CD.number(SP.itemOf(s))))}${row('Material', s => esc(CD.describe(s).material.name))}${row('Finish', s => esc(CD.describe(s).finish))}${row('Foil', s => esc(CD.describe(s).foil))}${row('Edition', s => esc(CD.describe(s).edition))}${row('Artwork', s => (s.card.alt ? 'Alternate' : 'Standard'))}</tbody>` : '';
    ui.modal({ title: 'Compare specimens', wide: true, cls: 'compare-modal', html: `<div class="cmp-wrap"><table class="cmp"><thead><tr><th></th>${list.map(s => `<th><span class="cmp-art">${A.render(s)}</span><b>${esc(SP.displayName(s))}</b>${ui.rtag(SP.rarityOf(s).id)}</th>`).join('')}</tr></thead>
      <tbody>${row('Division', s => esc(SP.catOf(s).single))}${row('Serial', s => ui.serial(s.serial), minI)}${row('Value', s => U.fmt(SP.value(s)), maxI)}${row('Variant', s => esc(SP.variantOf(s).name))}${row('Condition', s => esc(SP.conditionLabel(s)))}${row('Potential', s => s.potential + '%', maxI)}${row('Upgrade stage', s => esc(SP.stageName(s)))}
        ${row('Transformation', s => (s.form ? esc(AV.progress.form(s.form).name) : '—'))}${row('Fusion', s => (s.fusion ? `${esc(s.fusion.id || 'Fused')}${s.fusion.rank ? ' · Rank ' + AV.fusion.ROMAN[s.fusion.rank] : ''}${s.fusion.mutation ? '<br><small>' + esc(s.fusion.mutation.name) + '</small>' : ''}<br><small>${(s.fusion.parents || []).map(p => esc(D.ITEMS[p.base].name) + ' ' + ui.serial(p.serial)).join(' + ')}</small>` : '—'))}
        ${row('Acquired from', s => esc(VQ.sourceName(s.origin && s.origin.fusion ? 'fusion' : (s.origin && s.origin.container) || 'creator')) + '<br><small>' + new Date(s.origin.at).toLocaleDateString() + '</small>')}${row('Estimated growth', growth)}</tbody>${cards}${stats}</table></div>`,
      buttons: [{ label: 'Close', kind: 'primary', value: 1 }],
      onOpen(api) { api.el.addEventListener('click', e => { const a = e.target.closest('.cmp-art'); if (a) { const i = [...api.el.querySelectorAll('.cmp-art')].indexOf(a); api.close(); AV.inspect(list[i].id); } }); } });
  }

  // ================================================================ advanced filter panel
  function advanced(o = {}) {
    const st = V(), f = st.f, idx = VQ.index(S()), fc = VQ.facets(idx);
    const chk = (k, opts) => `<div class="adv-opts">${opts.map(([v, l, n]) => `<label class="ck"><input type="checkbox" data-fk="${k}" data-fv="${esc(String(v))}" ${f[k].has(v) ? 'checked' : ''}><span>${l}</span>${n != null ? `<small class="mono">${n}</small>` : ''}</label>`).join('') || '<p class="tiny dim">Nothing in your collection yet.</p>'}</div>`;
    const one = (k, opts) => `<div class="seg small">${[['any', 'Any']].concat(opts).map(([v, l]) => `<button class="${f[k] === v ? 'on' : ''}" data-fone="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const rng = (k, label, type = 'number') => `<div class="adv-rng"><span>${label}</span><input type="${type}" data-rk="${k}" data-ri="0" value="${f[k][0] != null ? (type === 'date' ? new Date(f[k][0]).toISOString().slice(0, 10) : f[k][0]) : ''}" placeholder="min" aria-label="${label} minimum"><span>–</span><input type="${type}" data-rk="${k}" data-ri="1" value="${f[k][1] != null ? (type === 'date' ? new Date(f[k][1]).toISOString().slice(0, 10) : f[k][1]) : ''}" placeholder="max" aria-label="${label} maximum"></div>`;
    const cnt = (k, v) => (fc[k] && fc[k][v]) || 0;
    const subs = Object.keys(fc.sub || {}).sort(), bases = Object.keys(fc.base || {}).sort((a, b) => D.ITEMS[a].name.localeCompare(D.ITEMS[b].name));
    const sec = (title, inner, open) => `<details class="adv-sec" ${open ? 'open' : ''}><summary>${title}</summary>${inner}</details>`;
    const m = ui.modal({ title: 'Advanced filters', wide: true, cls: 'adv-modal', html: `<p class="tiny muted">Filters combine: every section must match; within a list, any checked value matches. Changes apply immediately.</p>
      ${sec('Identity', `<h5>Subcategory</h5>${chk('sub', subs.map(s => [s, esc(s), cnt('sub', s)]))}<h5>Collectible</h5><input type="search" class="adv-find" placeholder="Find a collectible…" aria-label="Find a collectible"><div class="adv-base">${chk('base', bases.map(b => [b, esc(D.ITEMS[b].name), cnt('base', b)]))}</div>`, true)}
      ${sec('Cards', `<h5>Set</h5>${chk('set', CD.SETS.map(s => [s.id, esc(s.name), cnt('set', s.id)]))}${rng('number', 'Card number')}<h5>Edition</h5>${chk('edition', CD.EDITIONS.map(e => [e.id, esc(e.name), cnt('edition', e.id)]))}<h5>Finish</h5>${chk('finish', CD.FINISHES.map(x => [x.id, esc(x.name), cnt('finish', x.id)]))}<h5>Foil</h5>${chk('foil', Object.keys(CD.FOILS).map(k => [k, esc(CD.FOILS[k].name), cnt('foil', k)]))}<h5>Artwork</h5>${one('alt', [['alt', 'Alternate'], ['standard', 'Standard']])}`)}
      ${sec('Traits', `<h5>Variant</h5>${chk('variant', D.VARIANTS.map(v => [v.id, esc(v.name), cnt('variant', v.id)]))}<h5>Condition</h5>${chk('cond', [0, 1, 2, 3, 4].map(i => [i, D.CONDITION_LABELS.default[i] + ' tier', cnt('cond', i)]))}`)}
      ${sec('Progress, transformation and fusion', `<h5>Upgrade stage</h5>${chk('stage', [0, 1, 2, 3, 4].map(i => [i, 'Stage ' + (i + 1), cnt('stage', i)]))}<h5>Transformation</h5>${one('form', [['transformed', 'Transformed'], ['untransformed', 'Not transformed']])}<h5>Branch</h5>${chk('branch', Object.keys(fc.branch || {}).map(b => [b, esc(AV.progress.form(b) ? AV.progress.form(b).name : b), cnt('branch', b)]))}<h5>Fusion</h5>${one('fusion', [['fused', 'Fused'], ['unfused', 'Not fused'], ['hybrid', 'Hybrids'], ['rank2', 'Rank II+']])}<h5>Mutation</h5>${chk('mutation', Object.keys(AV.fusion.MUT).map(k => [k, esc(AV.fusion.MUT[k].name), cnt('mutation', k)]))}`)}
      ${sec('Ranges', `${rng('statTotal', 'Stat total')}${rng('potential', 'Potential %')}${rng('serial', 'Serial')}`)}
      ${sec('Origin', `<h5>Container source</h5>${chk('source', Object.keys(fc.source || {}).map(k => [k, esc(VQ.sourceName(k)), cnt('source', k)]))}${rng('date', 'Date acquired', 'date')}${rng('order', 'Acquisition order (#)')}`)}
      ${sec('Marks and organisation', `<div class="adv-flags">${['fav', 'locked', 'dupes', 'recent', 'companion'].map(k => `<label class="ck"><input type="checkbox" data-flag="${k}" ${f[k] ? 'checked' : ''}><span>${VQ.FLAG_LABEL[k]}</span></label>`).join('')}</div><h5>Custom name</h5>${one('named', [['named', 'Named'], ['unnamed', 'Unnamed']])}<h5>Tags</h5>${chk('tag', Object.keys(fc.tag || {}).sort().map(t => [t, '#' + esc(t), cnt('tag', t)]))}`)}`,
      buttons: [{ label: 'Clear all filters', kind: 'ghost', value: 'clear' }, { label: 'Done', kind: 'primary', value: 'done' }],
      onOpen(api) {
        const el = api.el, changed = () => { if (o.onChange) o.onChange(); };
        el.addEventListener('change', e => {
          const t = e.target;
          if (t.dataset.fk) { const k = t.dataset.fk; let v = t.dataset.fv; if (k === 'cond' || k === 'stage') v = +v; t.checked ? f[k].add(v) : f[k].delete(v); changed(); }
          else if (t.dataset.flag) { f[t.dataset.flag] = t.checked; changed(); }
          else if (t.dataset.rk) { const k = t.dataset.rk, i = +t.dataset.ri, raw = t.value; f[k] = f[k].slice(); f[k][i] = raw === '' ? null : (t.type === 'date' ? +new Date(raw + 'T00:00:00') : +raw); changed(); }
        });
        el.addEventListener('click', e => { const b = e.target.closest('[data-fone]'); if (b) { f[b.dataset.fone] = b.dataset.v; b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); changed(); } });
        const find = el.querySelector('.adv-find'); if (find) find.addEventListener('input', () => { const q = find.value.toLowerCase(); el.querySelectorAll('.adv-base .ck').forEach(c => { c.hidden = q && !c.textContent.toLowerCase().includes(q); }); });
      } });
    m.promise.then(v => { if (v === 'clear') { st.f = VQ.blank(); if (o.onChange) o.onChange(); } });
  }

  // ================================================================ dispatcher + events for these views
  function draw(view, body, ctx) {
    ({ binder, lines, dupes, timeline, history, sets }[view] || (() => { }))(body, ctx);
    if (body.__wired) return; body.__wired = true;
    body.addEventListener('click', async e => {
      const st = V(), t = e.target, redraw = () => AV.vaultRedraw && AV.vaultRedraw();
      const bset = t.closest('[data-bset]'); if (bset) { st.binder.set = bset.dataset.bset; st.binder.page = 0; S().binder = { set: st.binder.set, page: 0 }; redraw(); return; }
      const bpg = t.closest('[data-bpg]'); if (bpg) { const d = +bpg.dataset.bpg; st.binder.page += d; st.binder.turn = S().settings.binderAnim !== false && !ui.reduced() ? (d > 0 ? 'turn-next' : 'turn-prev') : ''; au.play('flip'); redraw(); return; }
      const bl = t.closest('[data-blist]'); if (bl) { st.binder.list = bl.dataset.blist === '1'; redraw(); return; }
      const ba = t.closest('[data-balt]'); if (ba) { e.stopPropagation(); st.binder.alt = st.binder.alt || {}; st.binder.alt[ba.dataset.balt] = !st.binder.alt[ba.dataset.balt]; redraw(); return; }
      const bid = t.closest('[data-bid]'); if (bid) { AV.inspect(bid.dataset.bid); return; }
      const tob = t.closest('[data-tobinder]'); if (tob) { st.view = 'binder'; st.binder.set = tob.dataset.tobinder; st.binder.page = 0; redraw(); return; }
      const hs = t.closest('[data-hist]'); if (hs) { st.hist = hs.dataset.hist; redraw(); return; }
      const lb = t.closest('[data-lbase]'); if (lb) { st.view = 'grid'; st.f = VQ.blank(); st.f.base.add(lb.dataset.lbase); redraw(); return; }
      const df = t.closest('[data-dfuse]'); if (df) { ui.go('fusion', { primary: df.dataset.dfuse }); setTimeout(() => { const ids = df.dataset.donors.split(',').filter(Boolean); ids.forEach(id => { const r = document.querySelector(`.fz-row[data-fid="${id}"]`); if (r) r.click(); }); }, 60); return; }
      const dl = t.closest('[data-dlock]'); if (dl) { const s = E.get(dl.dataset.dlock); if (s && !s.locked) E.toggleLock(s.id); au.play('lockset'); return; }
      const dd = t.closest('[data-ddis]'); if (dd) { await AV.vaultDismantle(dd.dataset.ddis.split(',').filter(Boolean), 'Dismantle extra copies?', 'The best copy stays.'); return; }
      const op = t.closest('[data-open]'); if (op && E.get(op.dataset.open)) { AV.inspect(op.dataset.open); return; }
    });
  }
  // the history rail lives in the shared rail element
  document.addEventListener('click', e => { const hs = e.target.closest('#vRail [data-hist]'); if (hs && AV.vaultState) { AV.vaultState.hist = hs.dataset.hist; if (AV.vaultRedraw) AV.vaultRedraw(); } });

  AV.vaultViews = { draw, rail, compare, advanced };
})();
