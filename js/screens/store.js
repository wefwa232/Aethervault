/* AETHERVAULT — The Exchange: a fictional counter inside the Archive. Everything here is simulation: Play Cash is a pretend number.
 * Three presentation types: gem contracts (ledger rows), a currency desk (rate board), and consignments (manifests) with a daily-offer poster. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, A = AV.art, ui = AV.ui, au = AV.audio, fx = AV.fx;
  const esc = U.esc;
  let tab = 'gems';
  const money = n => '$' + n.toFixed(2);
  const bag = o => Object.keys(o).map(k => `<span class="rw ci-${k}">${A.icon(D.CURRENCY[k].icon)}<b>${U.fmtFull(o[k])}</b><small>${D.CURRENCY[k].name}</small></span>`).join('');
  const gemArt = n => `<span class="gem-pile g${n}" aria-hidden="true">${Array.from({ length: n }, () => A.icon('gemcur')).join('')}</span>`;

  function checkout(b) {
    const s = AV.state.get(), after = s.playCash - b.price, ok = after >= -1e-9;
    const m = ui.modal({
      title: 'Simulated checkout', cls: 'checkout',
      html: `<div class="stamp-note"><span class="stamp">Simulation only</span><span><b>No real transaction.</b> No payment details are requested, stored or sent anywhere. This only moves fictional numbers inside the game.</span></div>
        <div class="co-item"><div class="co-art ci-gems">${gemArt(Math.min(5, +b.id.slice(1)))}</div><div><h3>${U.fmtFull(b.gems + b.bonus)} gems</h3><p class="muted tiny">${U.fmtFull(b.gems)} base${b.bonus ? ` + ${U.fmtFull(b.bonus)} bonus` : ''}</p></div><b class="co-price">${money(b.price)}</b></div>
        <ul class="kv"><li><span>Play Cash (fictional)</span><b class="mono">${money(s.playCash)}</b></li><li><span>After purchase</span><b class="mono ${ok ? '' : 'bad-txt'}">${money(Math.max(after, 0))}${ok ? '' : ' — not enough'}</b></li></ul>`,
      buttons: [{ label: 'Cancel', kind: 'ghost', value: false }, ok ? { label: `Confirm — ${money(b.price)} Play Cash`, kind: 'primary', value: true, icon: 'check' } : { label: 'Add $50 Play Cash', kind: 'primary', value: 'topup', icon: 'plus' }],
      dismissValue: false,
    });
    m.promise.then(v => {
      if (v === 'topup') { E.topUpPlayCash(); au.play('coin'); ui.toast('+$50.00 fictional Play Cash', { kind: 'good', icon: 'coin' }); return; }
      if (!v) return;
      const r = E.buyCash(b.id); if (!r.ok) { ui.toast(r.err, { kind: 'bad', icon: 'close' }); return; }
      au.play('coin'); [1, 2, 3].forEach(i => setTimeout(() => au.play('coin'), i * 90)); fx.flash('#7fd0d2', 300, .2);
      const gem = document.querySelector('#topbar .cur-gems'); if (gem) fx.burstAt(gem, { count: 24, colors: ['#7fd0d2', '#ece3cf'], speed: 5 });
      ui.toast(`Simulated purchase complete: +${U.fmtFull(r.gems)} gems`, { kind: 'good', icon: 'gemcur' });
    });
  }

  function render(root) {
    const draw = () => {
      const s = AV.state.get(), offerId = E.dailyOfferId(), offer = D.STORE.dailyOffers.find(o => o.id === offerId);
      let body = '';
      if (tab === 'gems') {
        const best = D.STORE.cash.reduce((a, b) => ((b.gems + b.bonus) / b.price > (a.gems + a.bonus) / a.price ? b : a));
        body = `<ol class="contracts s-tray">${D.STORE.cash.map((b, i) => `<li class="contract ${b.id === best.id ? 'best' : ''} c${i + 1}">
          <span class="c-no mono">C-${U.pad(i + 1, 2)}</span>${gemArt(i + 1)}
          <div class="c-amt"><b class="mono">${U.fmtFull(b.gems + b.bonus)}</b><span class="label">gems</span></div>
          <div class="c-note">${b.bonus ? `<span class="bonus mono">+${U.fmtFull(b.bonus)} bonus</span>` : '<span class="dim tiny">base amount</span>'}${b.tag ? `<span class="c-tag label">${b.tag}</span>` : ''}</div>
          <button class="btn ${b.id === best.id ? 'primary' : 'ghost'}" data-buy="${b.id}"><span class="mono">${money(b.price)}</span></button></li>`).join('')}</ol>`;
      } else if (tab === 'exchange') {
        body = `<div class="board s-tray"><div class="board-h label"><span>You give</span><span></span><span>You receive</span><span></span></div>${D.STORE.exchange.map(x => { const can = E.canAfford(x.pay); return `<div class="rate"><div class="r-side">${bag(x.pay)}</div><span class="x-arrow">${A.icon('chevron')}</span><div class="r-side get">${bag(x.get)}</div><button class="btn ${can ? 'primary' : 'ghost'} small" data-ex="${x.id}" ${can ? '' : 'disabled'}>${can ? 'Exchange' : 'Need ' + D.CURRENCY[Object.keys(x.pay)[0]].name.toLowerCase()}</button></div>`; }).join('')}</div>`;
      } else {
        const pay = {}; Object.keys(offer.pay).forEach(k => (pay[k] = Math.ceil(offer.pay[k] * .7))); const can = E.canAfford(pay);
        const man = b => { const can = E.canAfford(b.pay); return `<article class="manifest s-label" style="--bc:${b.color}"><div class="mf-h"><span class="label">Consignment</span><span class="mono tiny">${esc(b.id.toUpperCase())}</span></div><h3>${esc(b.name)}</h3><p class="muted tiny">${esc(b.desc)}</p><div class="mf-list">${bag(b.get)}</div><button class="btn ${can ? 'primary' : 'ghost'}" data-bun="${b.id}" data-daily="0" ${can ? '' : 'disabled'}>${ui.costOnly('gems', b.pay.gems, can)}<span>${can ? 'Buy' : 'Need gems'}</span></button></article>`; };
        body = `<div class="offers"><article class="poster s-frame"><div class="po-in"><span class="po-tag label">Daily offer · −30%</span><h3>${esc(offer.name)}</h3><p class="muted">${esc(offer.desc)}</p><div class="mf-list big">${bag(offer.get)}</div><div class="po-act"><s class="mono dim">${ui.costOnly('gems', offer.pay.gems, true)}</s><button class="btn ${can ? 'primary' : 'ghost'} major" data-bun="${offer.id}" data-daily="1" ${can ? '' : 'disabled'}>${ui.costOnly('gems', pay.gems, can)}<span>${can ? 'Take the offer' : 'Need gems'}</span></button></div></div></article>
          <div class="manifests">${D.STORE.bundles.map(man).join('')}</div></div>`;
      }
      root.innerHTML = `<div class="exchange">
        <header class="ex-head"><div><span class="label">Archive · the exchange</span><h1>The Exchange</h1><p class="muted">A pretend counter for a pretend economy.</p></div>
          <div class="passbook s-label"><span class="label">Play Cash <small>(fictional)</small></span><b class="mono">${money(s.playCash)}</b><button class="btn quiet small" data-act="topup">${A.icon('plus')}Add $50</button></div></header>
        <div class="sim-notice"><span class="stamp">Simulation only</span><span><b>No real transaction.</b> There are no payments, accounts or advertisements — buttons here only convert fictional numbers.${E.isUnlimited() ? ' <b class="hot">Unlimited Mode is on, so everything is already infinite.</b>' : ''}</span></div>
        <div class="seg view counters" role="tablist">${[['gems', 'Gem contracts', 'gemcur'], ['exchange', 'Currency desk', 'store'], ['bundles', 'Consignments & offers', 'gift']].map(([id, l, ic]) => `<button class="${tab === id ? 'on' : ''}" data-tab="${id}" role="tab">${A.icon(ic)}${l}</button>`).join('')}</div>
        ${body}</div>`;
    };
    draw();
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); return; }
      const buy = e.target.closest('[data-buy]'); if (buy) { checkout(D.STORE.cash.find(b => b.id === buy.dataset.buy)); return; }
      const ex = e.target.closest('[data-ex]');
      if (ex) { const r = E.exchange(ex.dataset.ex); if (r.ok) { au.play('coin'); fx.burstAt(ex, { count: 18, colors: ['#d7b46e', '#ece3cf'], speed: 4 }); ui.toast('Exchange complete', { kind: 'good', icon: 'check', silent: true }); } else ui.toast(r.err, { kind: 'bad', icon: 'close' }); return; }
      const bun = e.target.closest('[data-bun]');
      if (bun) { const r = E.buyBundle(bun.dataset.bun, bun.dataset.daily === '1'); if (r.ok) { au.play('coin'); setTimeout(() => au.play('coin'), 100); fx.burstAt(bun, { count: 28, colors: ['#d7b46e', '#ece3cf', '#7fd0d2'], speed: 6 }); ui.toast('Bundle claimed', { kind: 'good', icon: 'gift', silent: true }); } else ui.toast(r.err, { kind: 'bad', icon: 'close' }); return; }
      if (e.target.closest('[data-act="topup"]')) { E.topUpPlayCash(); au.play('coin'); ui.toast('+$50.00 fictional Play Cash', { kind: 'good', icon: 'coin', silent: true }); }
    });
    ui.sub('wallet', draw);
  }
  ui.register('store', { render });
})();
