/* AETHERVAULT — Open: the Containment Hall. Containers are physical exhibits under their own light;
 * the controls are a slim strip beneath the exhibit, the odds a quiet ledger at the edge. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui;
  const esc = U.esc;
  let sel = 'wanderer', qty = 1, view = null;
  // lighting tier / colour per container for the 3D rig (rarity-sensitive staging)
  const STAGE = { hatchling: { tier: 2, color: '#ff9ad1' }, starlit: { tier: 3, color: '#6cf2ff' }, forge: { tier: 3, color: '#ff8a3d' }, vault: { tier: 5, color: '#ffc247' }, wanderer: { tier: 2, color: '#4aa8ff' }, capsule: { tier: 2, color: '#c9a2ff' }, reliquary: { tier: 3, color: '#ffc247' } };
  const hexRgb = h => { const c = parseInt(h.slice(1), 16); return `${c >> 16 & 255}, ${c >> 8 & 255}, ${c & 255}`; };

  function oddsModal(id) {
    const rep = E.oddsReport(id), c = rep.container;
    const rows = rep.items.map(g => {
      const R = D.RARITY[g.rarity];
      return `<div class="odds-row r-${R.id}"><div class="odds-h">${ui.rtag(R.id)}<b class="mono">${(g.p * 100).toFixed(g.p < .01 ? 2 : 1)}%</b></div>${ui.bar(g.p * 100, 'rar')}<div class="odds-items">${g.list.map(i => `<span class="oi">${esc(D.ITEMS[i.id].name)} <em class="mono">${(i.p * 100).toFixed(i.p < .01 ? 2 : 1)}%</em></span>`).join('')}</div></div>`;
    }).join('');
    const guar = c.slots.map((sl, i) => sl.min ? `Prize ${i + 1}: ${D.RARITY[sl.min].name} or better` : null).filter(Boolean);
    ui.modal({
      title: `${esc(c.name)} — odds`, wide: true, cls: 'odds',
      html: `<p class="muted">Each prize is rolled independently. Rarities with no matching items in this container's pool are excluded and the rest renormalised. Variants, patterns and conditions are rolled separately for every specimen (variant chance ×${c.variantBoost}).</p>
        ${guar.length ? `<div class="note good">${A.icon('check')}<span><b>Guarantees:</b> ${guar.join(' · ')}</span></div>` : ''}
        ${rep.pity ? `<div class="note gold">${A.icon('timer')}<span><b>Guarantee meter:</b> after ${rep.pity.after} pulls without a ${D.RARITY[rep.pity.rarity].name} or better, the next pull is certain to be one. You are at <b class="mono">${rep.pity.current}/${rep.pity.after}</b>.</span></div>` : ''}
        <div class="odds-list">${rows}</div>
        <h4 class="sect">Variant chances at standard rarity</h4>
        <div class="var-odds">${D.VARIANTS.filter(v => v.id !== 'none').map(v => { const tot = D.VARIANTS.reduce((a, x) => a + (x.id === 'none' ? x.weight : x.weight * c.variantBoost), 0); return `<span class="vtag var-${v.id}">${v.name} <span class="mono">${(v.weight * c.variantBoost / tot * 100).toFixed(1)}%</span></span>`; }).join('')}</div>`,
      buttons: [{ label: 'Close', kind: 'primary', value: true }],
    });
  }

  function render(root, params) {
    if (params && params.select && D.CONTAINER[params.select]) sel = params.select;
    let first = true;
    const mount = () => {
      const c = D.CONTAINER[sel], host = root.querySelector('#ohView'); if (!host) return;
      if (view) { view.dispose(); view = null; }
      const st = STAGE[sel] || { tier: 2, color: c.theme[1] };
      if (AV.stage && AV.stage.container3d(c.ritual)) {
        view = AV.stage.view(host, { mode: 'display', interactive: true, layer: 0, margin: 1.1, label: `${c.name}. Drag to turn it.`, moteColor: st.color });
        if (view) { view.setSpec({ container: c.ritual, theme: c.theme, name: c.name, tier: st.tier, color: st.color, plateTitle: c.name, plateSub: c.kind + ' · ' + c.count + (c.count > 1 ? ' prizes' : ' prize') }); view.playIntro('pop', .7); }
      }
      if (!view) host.innerHTML = `<div class="hall-fallback">${A.container(c.ritual, c.theme)}<i class="fb-plinth"></i></div>`;
      document.body.style.setProperty('--mote', hexRgb(st.color));
    };
    const draw = () => {
      const c = D.CONTAINER[sel], p = E.price(c), s = AV.state.get(), total = p.amt * qty, afford = E.canAfford({ [p.cur]: total });
      const pool = E.poolItems(c), seen = pool.filter(i => s.discovered[i.id]).length;
      const rep = E.oddsReport(c.id), top = rep.rarities.slice().sort((a, b) => D.RARITY[b.id].tier - D.RARITY[a.id].tier);
      const st = s.settings, guaranteed = c.slots.filter(x => x.min).sort((a, b) => D.RARITY[b.min].tier - D.RARITY[a.min].tier)[0];
      root.innerHTML = `<div class="hallway" style="--t0:${c.theme[0]};--t1:${c.theme[1]}">
        <nav class="ix s-matte sq" aria-label="Containers"><h3 class="sect">Index of containers</h3>
          <ol class="ix-list">${D.CONTAINERS.map((x, i) => { const px = E.price(x); const a = E.canAfford({ [px.cur]: px.amt }); return `<li><button class="ix-row ${x.id === sel ? 'active' : ''}" data-sel="${x.id}" aria-pressed="${x.id === sel}" style="--t1:${x.theme[1]}"><span class="ix-n mono">${U.pad(i + 1, 2)}</span><span class="ix-t"><b>${esc(x.name)}</b><small>${x.kind} · ${x.count} prize${x.count > 1 ? 's' : ''}</small></span>${ui.cost(px.cur, px.amt, a)}</button></li>`; }).join('')}</ol>
        </nav>

        <section class="plinth-stage s-stage" aria-label="${esc(c.name)}">
          <div class="ps-light" aria-hidden="true"></div>
          <div class="ps-view" id="ohView"></div>
          <header class="ps-title"><span class="label">${c.kind} · exhibit ${U.pad(D.CONTAINERS.indexOf(c) + 1, 2)}</span><h2>${esc(c.name)}</h2><p class="muted">${esc(c.desc)}</p>
            <div class="ps-facts"><span class="chip-s">${c.count} prize${c.count > 1 ? 's' : ''} per opening</span><span class="chip-s">${seen}/${pool.length} types catalogued</span>${guaranteed ? `<span class="chip-s good">Guaranteed ${D.RARITY[guaranteed.min].name}+</span>` : ''}</div></header>
          <div class="ps-controls s-matte sq">
            <div class="seg" role="group" aria-label="Quantity">${[1, 5, 10].map(n => `<button class="${qty === n ? 'on' : ''}" data-qty="${n}">×${n}</button>`).join('')}</div>
            <div class="ps-total"><span class="label">Total</span>${ui.cost(p.cur, total, afford)}</div>
            <button class="btn primary major" data-act="open" ${afford ? '' : 'disabled'}>${afford ? 'Open' : 'Not enough ' + D.CURRENCY[p.cur].name.toLowerCase()}</button>
            ${afford ? '' : `<button class="btn quiet small" data-go="store">Visit the Exchange</button>`}
          </div>
        </section>

        <aside class="odds-rail s-matte sq" aria-label="Odds and guarantees"><h3 class="sect">Disclosure</h3>
          <div class="odds-ladder">${top.map(r => `<div class="orow r-${r.id}">${ui.rtag(r.id)}<b class="mono">${(r.p * 100).toFixed(r.p < .01 ? 2 : 1)}%</b></div>`).join('')}</div>
          ${rep.pity ? `<div class="pity wide"><span class="label">Guarantee meter</span><small class="mono">${rep.pity.current}/${rep.pity.after}</small><div class="gauge" style="--p:${U.clamp(rep.pity.current / rep.pity.after * 100, 0, 100)}"><i></i></div><span class="tiny dim">${D.RARITY[rep.pity.rarity].name}+ certain at ${rep.pity.after}.</span></div>` : ''}
          <button class="btn ghost small" data-act="odds">${A.icon('info')}Full odds</button>
          <details class="prefs"><summary class="label">Opening preferences</summary>
            <label class="toggle"><input type="checkbox" data-opt="skipRituals" ${st.skipRituals ? 'checked' : ''}><span></span>Skip rituals</label>
            <div class="seg small" role="group" aria-label="Animation speed">${[[.75, '.75×'], [1, '1×'], [1.5, '1.5×'], [2.5, '2.5×'], [0, 'Instant']].map(([v, l]) => `<button class="${st.animSpeed === v ? 'on' : ''}" data-spd="${v}">${l}</button>`).join('')}</div>
          </details>
        </aside></div>`;
      mount();
    };
    draw();
    ui.onLeave(() => { if (view) { view.dispose(); view = null; } document.body.style.removeProperty('--mote'); });
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-sel]'); if (t) { if (sel === t.dataset.sel) return; sel = t.dataset.sel; draw(); return; }
      const qn = e.target.closest('[data-qty]'); if (qn) { qty = +qn.dataset.qty; refreshControls(); return; }
      const sp = e.target.closest('[data-spd]'); if (sp) { E.setSetting('animSpeed', +sp.dataset.spd); root.querySelectorAll('[data-spd]').forEach(b => b.classList.toggle('on', b === sp)); return; }
      const go = e.target.closest('[data-go]'); if (go) { ui.go(go.dataset.go); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'odds') oddsModal(sel);
      else if (a.dataset.act === 'open') AV.opening.start(sel, qty);
    });
    /** Quantity/affordability changes must not rebuild the 3D view. */
    function refreshControls() {
      const c = D.CONTAINER[sel], p = E.price(c), total = p.amt * qty, afford = E.canAfford({ [p.cur]: total });
      root.querySelectorAll('[data-qty]').forEach(b => b.classList.toggle('on', +b.dataset.qty === qty));
      const ctl = root.querySelector('.ps-controls'); if (!ctl) return;
      ctl.querySelector('.ps-total').innerHTML = `<span class="label">Total</span>${ui.cost(p.cur, total, afford)}`;
      const ob = ctl.querySelector('[data-act=open]'); ob.disabled = !afford; ob.textContent = afford ? 'Open' : 'Not enough ' + D.CURRENCY[p.cur].name.toLowerCase();
    }
    root.addEventListener('change', e => { const o = e.target.closest('[data-opt]'); if (o) E.setSetting(o.dataset.opt, o.checked); });
    ui.sub('wallet', () => { if (!AV.opening.busy()) refreshControls(); });
    ui.sub('openingDone', () => { draw(); });
  }
  ui.register('open', { render });
})();
