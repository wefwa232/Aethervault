/* AETHERVAULT — Phase Three presentation helpers for stats, the transformation tree and the appearance selector.
 * Pure HTML builders (no state, no engine calls); Inspect and the Forge both use them so the numbers read the same everywhere.
 *   statRows      compact bars with the value, a potential-ceiling tick, optional next-upgrade growth and optional comparison column
 *   treeBlock     the five category stages and the transformation(s): evolution, final form or branch cards with their stat leans
 *   looksBlock    the appearance selector (current, earlier stages, former branches, earlier species)
 *   ledger        the specimen's progression history with stat deltas */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, SP = AV.specimen, ST = AV.stats, PR = AV.progress, esc = U.esc;
  const SC = 120; // bar scale: 120 shows a soft-capped late-game stat still inside the bar
  const sign = n => (n > 0 ? '+' + n : String(n));

  function explain(x, spec) {
    const p = x.parts, bits = [];
    if (x.k === 'growth') return `<small>${esc(x.hint)} Set by this specimen’s Potential (${spec.potential}%).</small>`;
    bits.push(`Base ${Math.round(p.identity)}`);
    const tr = [];
    if (p.cond) tr.push(`condition ${sign(Math.round(p.cond))}`); if (p.variant) tr.push(`variant ${sign(p.variant)}`);
    const rest = Math.round(p.trait - p.cond - p.variant); if (rest) tr.push(`pattern, size and seed ${sign(rest)}`);
    if (tr.length) bits.push('Traits: ' + tr.join(', '));
    if (p.growth) bits.push(`Stage growth ${sign(Math.round(p.growth))}`);
    if (p.form) bits.push(`Transformation ${sign(p.form)}`);
    if (p.carry) bits.push(`Carried from earlier form ${sign(p.carry)}`);
    return `<small>${esc(x.hint)}</small><span>${bits.join(' · ')}</span>`;
  }

  /** o: { next: stat map of the next upgrade, compare: another specimen, only: ['k'..] } */
  function statRows(spec, o = {}) {
    const c = ST.compute(spec), ceil = ST.ceiling(spec), ar = PR.ARCH[spec.base], nxt = o.next || null, cm = o.compare ? ST.compute(o.compare).map : null;
    const rows = c.list.map(x => {
      const foc = ar.focus.includes(x.k), isG = x.k === 'growth', d = nxt && !isG ? nxt[x.k] - x.value : 0, cd = cm ? x.value - cm[x.k] : 0, hi = nxt && !isG ? Math.max(x.value, nxt[x.k]) : x.value;
      return `<div class="st-row ${foc ? 'focus' : ''} ${isG ? 'pot' : ''}" data-k="${x.k}" tabindex="0" role="button" aria-expanded="false" title="${esc(x.hint)}">
        <span class="st-k">${esc(x.label)}</span>
        <span class="st-bar"><s style="width:${Math.min(100, hi / SC * 100)}%"></s><i style="width:${Math.min(100, x.value / SC * 100)}%"></i>${isG ? '' : `<u style="left:${Math.min(99, ceil[x.k] / SC * 100)}%" title="Reaches ${ceil[x.k]} at this specimen’s highest stage"></u>`}</span>
        <b class="st-v mono">${x.value}</b>
        ${nxt ? `<em class="st-d ${d > 0 ? 'up' : ''}">${isG ? '' : d > 0 ? '▲ ' + sign(d) : '·'}</em>` : ''}
        ${cm ? `<em class="st-d ${cd > 0 ? 'up' : cd < 0 ? 'dn' : ''}">${cd ? (cd > 0 ? '▲ ' : '▼ ') + Math.abs(cd) : '='}</em><b class="st-v mono dim">${cm[x.k]}</b>` : ''}
        <span class="st-why">${explain(x, spec)}</span></div>`;
    }).join('');
    return `<div class="stats ${nxt ? 'has-next' : ''} ${cm ? 'has-cmp' : ''}" role="list">${rows}</div>`;
  }

  const leanChips = f => Object.keys(f.lean).map(k => `<span class="lean up">${esc(ST.familyOf(f.item).byKey[k].label)} ${sign(f.lean[k])}</span>`).join('') + Object.keys(f.trade || {}).map(k => `<span class="lean dn">${esc(ST.familyOf(f.item).byKey[k].label)} −${f.trade[k]}</span>`).join('');

  /** The five stages and the transformation path. */
  function treeBlock(spec, o = {}) {
    const names = PR.stageNames(spec.base), max = SP.maxLevel(spec), disc = AV.state.get().discovered;
    const stages = `<ol class="tr-stages" aria-label="Upgrade stages">${names.map((n, i) => `<li class="${i < spec.level ? 'done' : ''} ${i === spec.level ? 'now' : ''} ${i > max ? 'locked' : ''}" title="${esc(PR.stageUnlock(spec.base, i) || 'Starting form')}"><i>${i + 1}</i><span>${esc(n)}</span></li>`).join('')}</ol>`;
    const kind = PR.kindOf(spec.base); let tf = '';
    if (kind === 'evolution') {
      tf = SP.evolutions(spec).map(ev => { const to = D.ITEMS[ev.to], known = disc[to.id]; return `<div class="tr-card"><div class="tr-h"><b>${known ? esc(to.name) : 'Undiscovered form'}</b><small>${esc(ev.label)} · ${D.RARITY[to.rarity].name}</small></div><p class="muted tiny">Evolution at ${esc(PR.stageName(spec.base, ev.level))} · ${ev.essence} essence${SP.evolutions(spec).length > 1 ? ' · a branching choice' : ''}</p>${o.preview && AV.stage && AV.stage.has(to.id) ? `<button class="btn ghost small" data-prevevo="${to.id}">Preview</button>` : ''}</div>`; }).join('');
    } else if (kind === 'form') {
      const fs = PR.formsFor(spec.base); const cost = PR.transformCost(spec.base);
      tf = fs.map(f => { const cur = spec.form === f.id, was = (spec.looks || []).includes('form:' + f.id); return `<div class="tr-card ${cur ? 'cur' : ''}"><div class="tr-h"><b>${esc(f.name)}</b><small>${esc(f.kind)}${cur ? ' · current' : was ? ' · former' : fs.length > 1 && !spec.form ? ' · branch' : ''}</small></div><p class="tr-blurb">${esc(f.blurb)}</p><div class="leans">${leanChips(f)}</div><p class="muted tiny tr-beh">${esc(f.behave)}</p>${o.preview ? `<button class="btn ghost small" data-prevform="${f.id}">Preview</button>` : ''}</div>`; }).join('')
        + (!spec.form ? `<p class="muted tiny">Available at <b>${esc(PR.stageName(spec.base, PR.FORM_LEVEL))}</b> for ${cost.essence} essence and ${U.fmt(cost.credits)} credits${fs.length > 1 ? '. Choosing a branch is a commitment (it can be re-bound later for a fee), and the other branch stays previewable.' : '.'}</p>` : '');
    }
    return `<div class="tree">${stages}<div class="tr-forms ${PR.isBranching(spec.base) ? 'branching' : ''}">${tf}</div></div>`;
  }

  function looksBlock(spec) {
    const ls = PR.looksOf(spec); if (ls.length < 2) return '<p class="muted tiny">Only one appearance so far. Upgrading, transforming or evolving unlocks more.</p>';
    const cur = spec.look || 'auto';
    return `<div class="looks" role="radiogroup" aria-label="Appearance">${ls.map(l => `<button class="look ${cur === l.id ? 'on' : ''}" role="radio" aria-checked="${cur === l.id}" data-look="${esc(l.id)}"><b>${esc(l.name)}</b><small>${esc(l.note)}</small></button>`).join('')}</div>`;
  }

  function ledger(spec, n = 6) {
    const rows = (spec.prog || []).slice(-n).reverse(); if (!rows.length) return '<p class="muted tiny">No upgrades or transformations yet.</p>';
    return `<ol class="ledger">${rows.map(r => `<li class="lg-${r.type}"><time class="mono">${new Date(r.t).toLocaleDateString()}</time><span><b>${esc(r.from)} → ${esc(r.to)}</b>${Object.keys(r.delta || {}).length ? '<small>' + esc(ST.describeDelta(spec, r.delta)) + '</small>' : ''}${r.cost && (r.cost.essence || r.cost.credits) ? `<small class="dim">Spent ${r.cost.essence ? r.cost.essence + ' essence' : ''}${r.cost.essence && r.cost.credits ? ' · ' : ''}${r.cost.credits ? U.fmt(r.cost.credits) + ' credits' : ''}</small>` : ''}</span></li>`).join('')}</ol>`;
  }

  /** Delegated behaviour: a stat row expands to show what feeds the number. */
  function wire(root) { root.addEventListener('click', e => { const r = e.target.closest('.st-row'); if (r) { const on = r.classList.toggle('open'); r.setAttribute('aria-expanded', on); } }); root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('st-row')) { e.preventDefault(); e.target.click(); } }); }

  AV.statsUI = { statRows, treeBlock, looksBlock, ledger, leanChips, wire, sign };
})();
