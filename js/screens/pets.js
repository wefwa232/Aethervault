/* AETHERVAULT — Pets: the Living Specimen Wing. A vivarium stage for the selected companion, an efficient roster,
 * and the Lineage — a physical branching rail of lit and unlit niches with live 3D evolution comparison. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio;
  const esc = U.esc;
  let selId = null, view = null;
  const NW = 150, NH = 176, CG = 132, RG = 18;

  function layout(rootId) {
    const nodes = [], edges = []; let row = 0, maxDepth = 0;
    (function place(id, depth) {
      maxDepth = Math.max(maxDepth, depth); const kids = D.ITEMS[id].evolves || [];
      if (!kids.length) { nodes.push({ id, depth, y: row++ }); return row - 1; }
      const ys = kids.map(k => { const y = place(k.to, depth + 1); edges.push({ from: id, to: k.to, req: k }); return y; });
      const y = (ys[0] + ys[ys.length - 1]) / 2; nodes.push({ id, depth, y }); return y;
    })(rootId, 0);
    return { nodes, edges, rows: row, depth: maxDepth };
  }
  const nx = n => n.depth * (NW + CG), ny = n => n.y * (NH + RG);

  function lineageHtml(line, owned, disc) {
    const L = layout(line.root), W = (L.depth + 1) * (NW + CG) - CG, H = L.rows * (NH + RG) - RG, by = {}; L.nodes.forEach(n => (by[n.id] = n));
    const rail = L.edges.map(e => {
      const a = by[e.from], b = by[e.to], x1 = nx(a) + NW, y1 = ny(a) + NH / 2, x2 = nx(b), y2 = ny(b) + NH / 2, mx = x1 + CG / 2;
      const known = disc[e.to];
      return `<path d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" class="rail ${known ? 'lit' : ''}"/><circle cx="${x1}" cy="${y1}" r="4" class="pin"/><circle cx="${x2}" cy="${y2}" r="4" class="pin ${known ? 'lit' : ''}"/>`;
    }).join('');
    const tags = L.edges.map(e => { const a = by[e.from], b = by[e.to], x = (nx(a) + NW + nx(b)) / 2, y = (ny(a) + ny(b)) / 2 + NH / 2; return `<span class="req s-label" style="left:${x}px;top:${y}px" title="Requirement"><b>${AV.progress.stageName(e.from, e.req.level)}</b><i class="mono">${A.icon('essence')}${e.req.essence}</i><em>${esc(e.req.label)}</em></span>`; }).join('');
    const niches = L.nodes.map(n => {
      const i = D.ITEMS[n.id], R = D.RARITY[i.rarity], d = disc[n.id];
      return `<button class="niche r-${R.id} ${d ? 'lit' : 'dark'}" style="left:${nx(n)}px;top:${ny(n)}px" ${d ? `data-cx="${n.id}"` : 'disabled'} aria-label="${d ? esc(i.name) : 'Undiscovered form'}">
        <i class="plate-bar"></i><span class="nc-art">${A.render(n.id, d ? {} : { silhouette: true })}</span><b>${d ? esc(i.name) : 'Undiscovered'}</b><small>${i.stage ? esc(i.stage) : R.name}</small>${owned[n.id] ? `<i class="own mono">×${owned[n.id]}</i>` : ''}</button>`;
    }).join('');
    return `<div class="line"><div class="line-h"><h4>${esc(line.name)}</h4><span class="muted">${esc(line.blurb)}</span></div>
      <div class="lin-scroll"><div class="lin-map" style="width:${W}px;height:${H}px"><svg class="lin-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${rail}</svg>${tags}${niches}</div></div></div>`;
  }

  function formModal(id, owned) {
    const i = D.ITEMS[id], R = D.RARITY[i.rarity], d = AV.state.get().discovered[id];
    const parent = D.ITEM_LIST.find(p => (p.evolves || []).some(e => e.to === id)), has3 = AV.stage && AV.stage.supported() && AV.stage.has(id), has3p = parent && AV.stage && AV.stage.supported() && AV.stage.has(parent.id);
    const m = ui.modal({
      title: esc(i.name), cls: 'codex-modal form-modal r-' + R.id, wide: true,
      html: `<div class="fm-views"><div class="fm-v" id="fmA"><span class="label fm-cap" id="fmACap">${esc(i.stage || '')}</span></div><div class="fm-v fm-b" id="fmB" hidden><span class="label fm-cap">${parent ? esc(parent.name) + ' · ' + esc(parent.stage || '') : ''}</span></div></div>
        <div class="cm-txt">${ui.rtag(R.id)}<p class="lore">“${esc(i.lore)}”</p><ul class="kv"><li><span>Form</span><b>${esc(i.stage || 'Species')}</b></li><li><span>Drawn / evolved</span><b class="mono">${d.count}</b></li><li><span>Best potential</span><b class="mono">${d.bestPotential}%</b></li><li><span>Owned now</span><b class="mono">${owned[id] || 0}</b></li></ul>
        ${parent && has3 && has3p ? `<button class="btn ghost" id="fmCmp">${A.icon('evolve')}Compare with previous form</button><p class="tiny dim">Both models share one rotation — drag either to turn them together.</p>` : ''}</div>`,
      buttons: [{ label: 'Close', kind: 'primary', value: 1 }],
      onOpen(api) {
        const mkSpec = base => ({ base, variant: 'none', pattern: 'plain', seed: 7, palette: 0, condition: 0, level: 0, potential: 70, serial: 0, size: 1, plateTitle: D.ITEMS[base].name, plateSub: D.ITEMS[base].stage || '' });
        let a = null, b = null;
        if (has3) { a = AV.stage.view(api.el.querySelector('#fmA'), { mode: 'display', interactive: true, layer: 1, margin: 1.1, plate: true, label: i.name }); if (a) a.setSpec(mkSpec(id)); }
        else api.el.querySelector('#fmA').insertAdjacentHTML('afterbegin', `<div class="hall-fallback">${A.render(id)}</div>`);
        const btn = api.el.querySelector('#fmCmp');
        if (btn) btn.addEventListener('click', () => {
          const fb = api.el.querySelector('#fmB'), on = fb.hidden; fb.hidden = !on; api.el.querySelector('.fm-views').classList.toggle('two', on); btn.lastChild.textContent = on ? 'Hide comparison' : 'Compare with previous form';
          if (on && !b) { b = AV.stage.view(fb, { mode: 'display', interactive: true, layer: 1, margin: 1.1, plate: true, label: parent.name }); if (b) { b.setSpec(mkSpec(parent.id)); const link = (x, y) => { y.rot.yaw = x.rot.yaw; y.rot.pitch = x.rot.pitch; y.rot.idle = 0; y.dirty = true; }; if (a) { a.opts.onRotate = () => link(a, b); b.opts.onRotate = () => link(b, a); } } }
              if (a) a.resize(); if (b) b.resize();
        });
        api.promise.then(() => { if (a) a.dispose(); if (b) b.dispose(); });
      },
    });
  }

  function render(root) {
    const s = AV.state.get();
    const draw = () => {
      if (view) { view.dispose(); view = null; }
      const pets = E.all().filter(x => SP.itemOf(x).cat === 'pet').sort((a, b) => (b.id === s.companion) - (a.id === s.companion) || SP.rarityTier(b) - SP.rarityTier(a) || SP.value(b) - SP.value(a));
      if (!selId || !E.get(selId) || SP.itemOf(E.get(selId)).cat !== 'pet') selId = s.companion && E.get(s.companion) ? s.companion : (pets[0] && pets[0].id);
      const cur = selId ? E.get(selId) : null;
      const owned = {}; E.all().forEach(x => (owned[x.base] = (owned[x.base] || 0) + 1));
      const R = cur && SP.rarityOf(cur), pers = cur && D.PERSONALITIES.find(p => p.id === cur.personality);
      root.innerHTML = `<div class="wing">
        <header class="wing-head"><div><span class="label">Archive · living specimen wing</span><h1>Living specimens</h1></div><p class="muted">${pets.length} pet${pets.length === 1 ? '' : 's'} · choose a companion, then study the lineages below</p></header>
        <div class="wing-main">
          <aside class="roster s-tray" aria-label="Your pets"><h3 class="sect">Roster</h3>${pets.length ? `<div class="mini-list tall">${pets.map(p => ui.mini(p, { selected: p.id === selId })).join('')}</div>` : '<p class="muted pad-s">Your pets will appear here.</p>'}</aside>
          <section class="vivarium s-stage ${cur ? 'r-' + R.id : ''}">
            <div class="viv-glass" aria-hidden="true"></div>
            <div class="viv-view" id="vivView">${cur ? '' : ui.empty('paw', 'No pets yet', 'Eggs hold your future companions. Hatch one to begin the Nimbus or Ember line.', `<button class="btn primary" data-go="open">${A.icon('open')}Go to the eggs</button>`)}</div>
            ${cur ? `<div class="care s-label"><div class="care-h"><span class="label">Care card</span><span class="mono">${ui.serial(cur.serial)}</span></div><h2>${esc(SP.displayName(cur))}</h2>
              <div class="care-tags">${ui.rtag(R.id)}${s.companion === cur.id ? `<span class="chip-s">Companion</span>` : ''}</div>
              <dl class="sheet"><div><dt>Form</dt><dd>${esc(SP.itemOf(cur).stage || '—')}</dd></div><div><dt>Nature</dt><dd>${pers.name}</dd></div><div><dt>Condition</dt><dd>${SP.conditionLabel(cur)}</dd></div><div><dt>Stage</dt><dd>${ui.pips(cur)} ${SP.stageName(cur)}</dd></div><div><dt>Potential</dt><dd class="mono">${cur.potential}%</dd></div><div class="wide"><dt>Quirk</dt><dd>${esc(cur.quirk)}</dd></div></dl>
              <div class="care-act"><button class="btn ${s.companion === cur.id ? 'ghost' : 'primary'}" data-act="comp" ${s.companion === cur.id ? 'disabled' : ''}>${A.icon('paw')}${s.companion === cur.id ? 'Active companion' : 'Make companion'}</button><button class="btn ghost" data-act="inspect">${A.icon('eye')}Inspect</button><button class="btn ghost" data-act="forge">${A.icon('evolve')}Upgrade / evolve</button></div></div>
            <p class="viv-hint tiny dim">Move the cursor — it watches. Click to nudge it. Drag to turn.</p>` : ''}
          </section>
        </div>
        <section class="lineage s-matte sq pad"><h3 class="sect">${A.icon('evolve')} Lineage</h3>
          <p class="muted tiny">A form is lit once you have discovered it. Rails show the stage and essence needed to evolve; select a lit niche to study it in 3D and compare it with the form before.</p>
          ${D.EVO_LINES.map(l => lineageHtml(l, owned, s.discovered)).join('')}</section>
      </div>`;
      if (cur) {
        const host = root.querySelector('#vivView');
        if (AV.stage && AV.stage.supported() && AV.stage.has(cur.base)) {
          view = AV.stage.view(host, { mode: 'display', interactive: true, trackWindow: true, layer: 0, margin: 1.05, label: `${SP.displayName(cur)} — drag to turn` });
          if (view) { view.setSpec(Object.assign({ plateTitle: SP.displayName(cur) }, cur)); view.playIntro('rise', .8); }
        }
        if (!view) host.innerHTML = `<div class="hall-fallback">${A.render(cur, { no3d: true })}<i class="fb-plinth"></i></div>`;
      }
    };
    draw();
    ui.onLeave(() => { if (view) { view.dispose(); view = null; } });
    root.addEventListener('click', e => {
      const go = e.target.closest('[data-go]'); if (go) { ui.go(go.dataset.go); return; }
      const m = e.target.closest('.mini'); if (m) { selId = m.dataset.id; draw(); return; }
      const cx = e.target.closest('[data-cx]'); if (cx) { const owned = {}; E.all().forEach(x => (owned[x.base] = (owned[x.base] || 0) + 1)); formModal(cx.dataset.cx, owned); return; }
      const a = e.target.closest('[data-act]'); if (!a || !selId) return;
      if (a.dataset.act === 'comp') { E.setCompanion(selId); au.play('confirm'); ui.toast(`${esc(SP.displayName(E.get(selId)))} is now your companion`, { kind: 'good', icon: 'paw' }); }
      else if (a.dataset.act === 'inspect') AV.inspect(selId, { ids: E.all().filter(x => SP.itemOf(x).cat === 'pet').map(x => x.id) });
      else if (a.dataset.act === 'forge') ui.go('forge', { select: selId });
    });
    ui.sub('specimens', draw); ui.sub('companion', draw);
  }
  ui.register('pets', { render });
})();
