/* AETHERVAULT — Phase Four opening presentations. Every reward was rolled and saved by engine.open() before any of this runs;
 * these sequences only present results, so skipping, speeding up or reloading can never change or re-roll them.
 *   cards      Wanderer Pack: a stack of face-down cards revealed one at a time (lowest → highest rarity, as dealt), restrained
 *              edge cues for Rare+, a stronger last-card ceremony, premium cards turning into their projection; Faster / Reveal all / Skip.
 *   condensed  any multi-open: a grid of face-down results flipping in a cascade (cached thumbnails only, no live 3D).
 *   roulette   Forge Crate: an original horizontal Archive selection reel per prize. Motion is a deterministic function of elapsed
 *              time (momentum + friction ease, then a short settle), so it is identical at 30, 60 or uncapped frame rates; clicks are
 *              scheduled on the audio clock at the exact times a tile edge crosses the marker. The reel is composed from the
 *              container's real odds; the winning tile is placed, never chosen by the animation. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, fx = AV.fx, au = AV.audio, esc = U.esc;
  const O = () => AV.opening._;
  const settings = () => AV.state.get().settings;
  const reduced = () => !!settings().reducedMotion;
  const tierOf = s => SP.rarityTier(s);
  const P4 = (AV.openingP4 = { lastReel: [] });

  /** A tap/Space/Enter waiter that skip and "reveal all" can release. */
  function gate() { let res = null, pending = false; const g = { wait: () => (pending ? (pending = false, Promise.resolve()) : new Promise(r => (res = r))), open: () => { if (res) { const r = res; res = null; r(); } else pending = true; }, clear: () => { pending = false; }, get waiting() { return !!res; } }; return g; }
  const chips = s => {
    const out = [], it = SP.itemOf(s);
    if (it.cat === 'card' && AV.cards) { const d = AV.cards.describe(s); out.push(d.material.name); if (s.card.foil !== 'none') out.push(d.foil); if (s.card.edition !== 'unlimited') out.push(d.edition); if (d.alt) out.push('Alternate art'); }
    else { if (s.variant !== 'none') out.push(SP.variantOf(s).name); out.push(SP.conditionLabel(s)); }
    return out.map(t => `<span class="chip-s">${esc(t)}</span>`).join('');
  };
  /** A face-down DOM card (2D path and condensed grids). Fronts use A.render, i.e. the cached thumbnail when 3D is on. */
  function flatCard(s, o = {}) {
    const R = SP.rarityOf(s), isCard = SP.itemOf(s).cat === 'card';
    const back = isCard && AV.cardArt ? `<svg viewBox="0 0 200 200" aria-hidden="true">${AV.cardArt.backSVG(s.card && s.card.edition)}</svg>` : `<span class="fc-tag">${A.icon('star')}<b>Archive</b></span>`;
    return `<button class="fcard r-${R.id} ${isCard ? 'is-card' : 'is-item'} ${o.cls || ''}" data-id="${s.id}" style="--rc:${R.color}" aria-label="Face-down ${isCard ? 'card' : 'prize'}"><span class="fc-in"><span class="fc-face fc-back">${back}</span><span class="fc-face fc-front">${A.render(s, o.no3d ? { no3d: true } : {})}${isCard ? '' : `<b class="fc-name">${esc(SP.displayName(s))}</b>`}</span></span></button>`;
  }

  // =================================================================== Wanderer Pack: the card stack
  async function cards(results, c, count) {
    const mode = settings().multiOpen || 'condensed';
    if (count > 1 && mode === 'condensed') return condensed(results, c, { noun: 'cards' });
    const packs = []; results.forEach(r => (packs[r.pack || 0] = packs[r.pack || 0] || []).push(r));
    for (let p = 0; p < packs.length; p++) { const r = await packStack(packs[p], c, packs.length > 1 ? `Pack ${p + 1} of ${packs.length}` : ''); if (r === 'skip') break; }
  }
  async function packStack(list, c, packLabel) {
    const { q, Seq } = O(), body = q('.op-body'), skipBtn = q('[data-skip]'), n = list.length;
    let fast = false, all = false, abort = false; const g = gate();
    const w = ms => new Seq().wait(ui.dur(all ? 0 : fast ? ms * .35 : ms));
    body.innerHTML = `<div class="cr" style="--theme1:${c.theme[1]}">
      <section class="cr-stage" aria-label="Card reveal"><div class="cr-view"></div><div class="cr-flat"></div><p class="cr-tap"><span>Tap the card to turn it over</span><small>Drag to tilt it first</small></p></section>
      <aside class="cr-side"><div class="cr-count"><span class="label">${esc(packLabel || c.name)}</span><b class="mono"></b></div><div class="cr-deck" aria-hidden="true">${list.map(() => '<i></i>').join('')}</div>
        <div class="cr-info" aria-live="polite"></div>
        <div class="cr-ctl"><button class="btn ghost small" data-cr="fast">${A.icon('skip')}Faster</button><button class="btn ghost small" data-cr="all">Reveal all</button></div></aside>
      <div class="cr-row" aria-label="Revealed cards"></div></div>`;
    const cr = q('.cr'), stage = q('.cr-stage'), flat = q('.cr-flat'), info = q('.cr-info'), row = q('.cr-row'), cnt = q('.cr-count b'), deck = [...cr.querySelectorAll('.cr-deck i')];
    skipBtn.querySelector('span').textContent = 'Skip to results'; skipBtn.onclick = () => { abort = true; all = true; g.open(); };
    cr.querySelector('[data-cr=fast]').onclick = e => { fast = !fast; e.currentTarget.classList.toggle('on', fast); g.open(); };
    cr.querySelector('[data-cr=all]').onclick = () => { all = true; g.open(); };
    stage.addEventListener('click', e => { if (e.target.closest('button')) return; g.open(); });
    const keyH = e => { if (ui.hasModal()) return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); g.open(); } };
    document.addEventListener('keydown', keyH);
    let view = null; const use3d = AV.stage && AV.stage.supported() && list.every(r => AV.stage.known(r.spec.base));
    if (use3d) { await AV.stage.ensure(list.map(r => r.spec.base)); view = AV.stage.view(q('.cr-view'), { mode: 'display', interactive: true, layer: 2, margin: 1.05, plate: false, restDelay: 2.6, motes: false, label: 'Card — tap to turn it over, drag to tilt' }); }
    for (let i = 0; i < n && !abort; i++) {
      const r = list[i], s = r.spec, R = SP.rarityOf(s), tier = R.tier, last = i === n - 1, it = SP.itemOf(s);
      cnt.textContent = `${U.pad(i + 1, 2)} / ${U.pad(n, 2)}`; deck.forEach((d, k) => d.classList.toggle('used', k < i)); deck.forEach((d, k) => d.classList.toggle('cur', k === i));
      info.innerHTML = `<p class="cr-wait">${last ? 'The last card in the pack.' : 'Face down.'}</p>`; cr.classList.remove('s-flipped', 's-dim'); cr.style.setProperty('--rc', R.color); g.clear(); // a tap while the card slides in counts as the turn
      let has3 = false;
      if (view) { has3 = view.setSpec(Object.assign({}, s, { plateTitle: '' })); if (has3) { view.inst.setFace('back', false); if (view.inst.setMode) view.inst.setMode('card'); view.playIntro('rise', .45); } }
      flat.innerHTML = has3 ? '' : flatCard(s, { no3d: true, cls: 'big' });
      au.play('slide');
      await w(380);
      // anticipation: a restrained coloured edge for Rare and above; the last card waits a little longer under dimmer light
      if (tier >= 2 && !all) {
        const str = tier >= 5 ? 1 : tier >= 4 ? .8 : tier >= 3 ? .55 : .3;
        if (has3) view.inst.cue(R.color, str); else { const fc = flat.querySelector('.fcard'); if (fc) fc.classList.add('cue'); }
        au.play('cardcue', tier); if (last && tier >= 3) cr.classList.add('s-dim');
        await w(last && tier >= 3 ? 700 : 260);
      }
      if (!all && !fast) await g.wait(); else await w(last ? 380 : 160);
      // the turn
      if (has3) { view.inst.setFace('front', true); view.inst.cue('#000', 0); } else { const fc = flat.querySelector('.fcard'); if (fc) fc.classList.add('flipped'); }
      au.play('flip'); cr.classList.add('s-flipped');
      if (tier >= 3 && !all) { au.sting(Math.min(tier, 6)); const ct = fx.centerOf(stage); fx.burst(ct.x, ct.y, { count: 10 + tier * 4, colors: [R.color, '#ece3cf'], speed: 4, life: 40 }); }
      else if (tier === 2 && !all) au.play('trait');
      info.innerHTML = `<div class="cr-card">${ui.rtag(R.id)}<h3>${esc(SP.displayName(s))}</h3><p class="mono tiny">${it.cat === 'card' ? esc(AV.cards.number(it)) + ' · ' + esc(AV.cards.CLASSES[it.card.cls].name) : esc(SP.catOf(s).single)}${r.isNew ? ' · <b class="newtxt">New</b>' : ''}</p><div class="cr-chips">${chips(s)}</div>
        <div class="cr-acts"><button class="btn ghost small" data-a="fav">${A.icon('heart')}Favorite</button><button class="btn ghost small" data-a="lock">${A.icon('lock')}Lock</button><button class="btn ghost small" data-a="inspect">${A.icon('eye')}Inspect</button></div></div>`;
      info.querySelector('[data-a=fav]').onclick = e => { const f = E.toggleFavorite(s.id); e.currentTarget.classList.toggle('on', f); au.play('fav'); };
      info.querySelector('[data-a=lock]').onclick = e => { const l = E.toggleLock(s.id); e.currentTarget.classList.toggle('on', l); au.play('lockset'); };
      info.querySelector('[data-a=inspect]').onclick = () => AV.inspect(s.id);
      if (has3 && tier >= 3 && view.inst.setMode && !all) setTimeout(() => { if (view && !view.disposed && view.inst && view.inst.setMode) view.inst.setMode('auto'); }, ui.dur(900));
      await w(tier >= 3 ? 900 : 420);
      if (!all && !fast) await g.wait(); else await w(last ? 500 : 220);
      row.insertAdjacentHTML('beforeend', `<button class="cr-mini r-${R.id}" data-id="${s.id}" style="--i:${i}" aria-label="${esc(SP.displayName(s))}">${A.render(s)}</button>`);
    }
    row.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) AV.inspect(b.dataset.id); });
    document.removeEventListener('keydown', keyH);
    if (view) view.dispose();
    return abort ? 'skip' : 'done';
  }

  // =================================================================== condensed multi-open grid (every container)
  async function condensed(results, c, o = {}) {
    const { q, Seq } = O(), body = q('.op-body'), skipBtn = q('[data-skip]'); let all = false; const g = gate();
    const sorted = results.slice();
    body.innerHTML = `<div class="cg" style="--theme1:${c.theme[1]}"><header class="cg-h"><span class="label">${esc(c.name)} · ${results.length} ${esc(o.noun || 'prizes')}</span><button class="btn ghost small" data-cg="all">Reveal all</button></header>
      <div class="cg-grid ${results.length > 24 ? 'dense' : ''}">${sorted.map(r => flatCard(r.spec)).join('')}</div><div class="cg-foot"><button class="btn primary" data-cg="done" disabled>See results</button></div></div>`;
    const grid = q('.cg-grid'), cardsEl = [...grid.querySelectorAll('.fcard')], done = q('[data-cg=done]');
    skipBtn.querySelector('span').textContent = 'Skip to results'; skipBtn.onclick = () => { all = true; g.open(); };
    q('[data-cg=all]').onclick = () => { all = true; };
    grid.addEventListener('click', e => { const b = e.target.closest('.fcard.flipped'); if (b) AV.inspect(b.dataset.id); });
    const w = ms => new Seq().wait(ui.dur(all ? 0 : ms));
    for (let i = 0; i < cardsEl.length; i++) {
      const s = sorted[i].spec, t = tierOf(s), el = cardsEl[i];
      if (t >= 2 && !all) { el.classList.add('cue'); await w(t >= 4 ? 420 : 200); }
      el.classList.add('flipped'); if (t >= 2) el.classList.add('hi'); if (!all) au.play(t >= 3 ? 'trait' : 'flip');
      if (t >= 4 && !all) { const b = el.getBoundingClientRect(); fx.burst(b.left + b.width / 2, b.top + b.height / 2, { count: 16, colors: [SP.rarityOf(s).color, '#ece3cf'], speed: 3.5, life: 34 }); }
      await w(t >= 3 ? 260 : 70);
    }
    done.disabled = false; done.focus({ preventScroll: true });
    done.onclick = () => g.open(); if (!all) await g.wait();
  }

  // =================================================================== Forge Crate roulette
  const EASE_N = 3.6; // x(u) = 1 − (1 − u)^n : starts fast, sheds speed like a heavy reel under friction
  const easeX = u => 1 - Math.pow(1 - u, EASE_N), easeInv = y => 1 - Math.pow(Math.max(0, 1 - y), 1 / EASE_N), speedAt = u => Math.pow(1 - u, EASE_N - 1);
  /** Reel composition: honest draws from the container's own odds (seeded), with the real prize placed at the landing index. */
  function composeReel(c, s, n, winIndex, seed) {
    const rng = U.mulberry32(seed >>> 0), rows = E.rarityTable(c), pool = E.poolItems(c), out = [];
    for (let i = 0; i < n; i++) {
      if (i === winIndex) { out.push({ item: SP.itemOf(s), spec: s, win: true }); continue; }
      const rid = U.pickWeighted(rows.map(r => [r.id, r.w]), rng), cand = pool.filter(it => it.rarity === rid);
      out.push({ item: cand[Math.floor(rng() * cand.length)] || pool[0] });
    }
    return out;
  }
  const tileHTML = (t, i) => { const R = D.RARITY[t.item.rarity]; return `<div class="rl-t r-${R.id} ${t.win ? 'is-win' : ''}" data-i="${i}" ${t.win ? `data-id="${t.spec.id}"` : ''} style="--rc:${R.color}"><i class="rl-bar"></i><span class="rl-art">${A.render(t.win ? t.spec : t.item.id)}</span><b>${esc(t.item.name)}</b><small>${esc(D.CATEGORY[t.item.cat].single)} · ${R.name}</small></div>`; };

  async function roulette(results, c, count) {
    const mode = settings().multiOpen || 'condensed';
    P4.lastReel = [];
    if (count > 1 && mode === 'condensed') { for (let i = 0; i < results.length; i += 10) { const r = await reels(results.slice(i, i + 10), c, true); if (r === 'skip') break; } return; }
    const per = c.count || 1;
    for (let i = 0; i < results.length; i += per) { const grp = results.slice(i, i + per); const r = await reels(grp, c, false); await O().reveals(grp, c); if (r === 'skip' && i + per < results.length && mode !== 'sequential') break; }
  }
  /** One reel per result, stacked; all start together and land one after another. Resolves 'done' or 'skip'. */
  function reels(list, c, compact) {
    const { q } = O(), body = q('.op-body'), skipBtn = q('[data-skip]'), multi = list.length > 1;
    const spd = Math.max(.5, +settings().rouletteSpeed || 1), red = reduced(), vol = settings().clickVolume == null ? .7 : +settings().clickVolume;
    body.innerHTML = `<div class="rl ${compact ? 'compact' : ''} ${multi ? 'multi' : ''}" style="--theme0:${c.theme[0]};--theme1:${c.theme[1]}">
      <header class="rl-h"><span class="label">Archive selection reel</span><span class="tiny dim">${list.length} prize${multi ? 's' : ''} · composed from this crate's odds</span></header>
      <div class="rl-rows">${list.map((r, i) => `<div class="rl-row" data-row="${i}"><div class="rl-strip"></div><i class="rl-shade l"></i><i class="rl-shade r"></i></div>`).join('')}<i class="rl-beam" aria-hidden="true"></i></div>
      <p class="rl-note tiny dim">The prize was decided when the crate was opened; the reel only shows where it landed.</p></div>`;
    const rowsEl = [...body.querySelectorAll('.rl-row')];
    const pitch = compact ? 96 : multi ? 132 : 168;
    const plan = list.map((r, i) => {
      const s = r.spec, rng = U.mulberry32(((s.seed >>> 0) ^ 0x9e37) + i), winIndex = (compact ? 26 : 38) + Math.floor(rng() * 4) + i * 2, n = winIndex + 7;
      const tiles = composeReel(c, s, n, winIndex, (s.seed >>> 0) ^ (i * 7919));
      const el = rowsEl[i], strip = el.querySelector('.rl-strip'); strip.style.setProperty('--pitch', pitch + 'px'); strip.innerHTML = tiles.map(tileHTML).join(''); strip.dataset.winner = winIndex;
      const W = el.clientWidth || 900, off = (rng() - .5) * pitch * .56, X = winIndex * pitch + pitch / 2 - W / 2 + off;
      const T = (red ? 900 + i * 90 : (compact ? 3000 : multi ? 4200 : 5200) + i * (compact ? 160 : 650)) / spd;
      // marker crossings: the marker sits at W/2 in row space; tile edge k passes it when x = k·pitch − W/2
      const times = []; for (let k = Math.ceil((W / 2) / pitch); k * pitch - W / 2 <= X; k++) { const xk = k * pitch - W / 2; if (xk > 0) times.push(T * easeInv(xk / X)); }
      return { r, s, el, strip, W, off, X, T, times, landed: false, winIndex, next: 0, pitch };
    });
    P4.lastPlan = plan.map(p => ({ id: p.s.id, X: p.X, T: p.T, W: p.W, pitch: p.pitch, off: p.off, times: p.times.slice(), winIndex: p.winIndex }));
    const lead = plan.reduce((a, p) => (p.T > a.T ? p : a), plan[0]); // only the last reel to land drives the clicks (no cacophony)
    const SETTLE = red ? 120 : 380;
    return new Promise(resolve => {
      let skipped = false, t0 = performance.now(), lastClick = -1;
      skipBtn.querySelector('span').textContent = 'Skip reel'; skipBtn.onclick = () => { skipped = true; };
      const place = (p, x) => { p.strip.style.transform = `translate3d(${(-x).toFixed(2)}px,0,0)`; p.x = x; };
      const land = p => { if (p.landed) return; p.landed = true; place(p, p.X - p.off); p.el.classList.add('landed'); const t = p.strip.children[p.winIndex]; if (t) t.classList.add('won'); const R = SP.rarityOf(p.s); if (!skipped) au.play('reelland', R.tier);
        const landedIndex = Math.floor((p.x + p.W / 2) / pitch); P4.lastReel.push({ id: p.s.id, winnerIndex: p.winIndex, landedIndex, tileId: t && t.dataset.id }); if (R.tier >= 3 && !skipped && !red) { const b = t.getBoundingClientRect(); fx.burst(b.left + b.width / 2, b.top + b.height / 2, { count: 14 + R.tier * 3, colors: [R.color, '#ece3cf'], speed: 4, life: 36 }); } };
      const frame = now => {
        const e = now - t0;
        if (skipped) { plan.forEach(land); return finish('skip'); }
        plan.forEach(p => {
          if (p.landed) return;
          if (e < p.T) place(p, p.X * easeX(e / p.T));
          else if (e < p.T + SETTLE) { const k = (e - p.T) / SETTLE, sm = k * k * (3 - 2 * k); place(p, p.X - p.off * sm); }
          else land(p);
        });
        // schedule the lead reel's clicks ~120 ms ahead on the audio clock: exact crossing times, independent of frame rate
        if (au.running() && vol > 0) { while (lead.next < lead.times.length && lead.times[lead.next] < e + 120) { const tk = lead.times[lead.next++]; if (tk < e - 10 || tk - lastClick < 16) continue; lastClick = tk; const u = tk / lead.T; au.play('reelclick', { delay: Math.max(0, (tk - e) / 1000), speed: speedAt(u), vol }); } }
        else lead.next = lead.times.findIndex(t => t > e + 120) === -1 ? lead.times.length : lead.times.findIndex(t => t > e + 120);
        if (plan.every(p => p.landed)) return finish('done');
        requestAnimationFrame(frame);
      };
      // the winning portrait steps forward before the full 3D reveal takes over
      const finish = how => { if (how !== 'skip' && !compact) setTimeout(() => body.querySelector('.rl').classList.add('zoom'), ui.dur(red ? 120 : 520)); setTimeout(() => resolve(how), how === 'skip' ? 60 : ui.dur(red ? 300 : 1000)); };
      requestAnimationFrame(frame);
    });
  }

  Object.assign(P4, { cards, condensed, roulette, composeReel, easeX, easeInv, flatCard });
})();
