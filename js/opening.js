/* AETHERVAULT — opening flow: payment → interactive ritual → rarity-scaled reveals → summary.
 * Eggs, crates and vaults are performed on live 3D containers; packs, capsules and chests keep their SVG art as a fallback.
 * Reveals stage the specimen on a lit plinth (3D) or in a frame (SVG) beside a specimen sheet. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, D = AV.data, E = AV.engine, SP = AV.specimen, A = AV.art, ui = AV.ui, fx = AV.fx, au = AV.audio;
  const esc = U.esc;
  let busy = false;
  const STAGE_TIER = { egg: 2, crate: 3, vault: 5, pack: 2, capsule: 3 };

  /** A cancellable timeline: every wait resolves instantly once skipped, so animations fast-forward to their end state. */
  class Seq {
    constructor() { this.skipped = false; this.waiters = new Set(); this.hooks = []; }
    wait(ms) {
      if (this.skipped || ms <= 0) return Promise.resolve();
      return new Promise(res => { const w = { res }; w.t = setTimeout(() => { this.waiters.delete(w); res(); }, ms); this.waiters.add(w); });
    }
    onSkip(fn) { this.hooks.push(fn); }
    skip() { if (this.skipped) return; this.skipped = true; this.waiters.forEach(w => { clearTimeout(w.t); w.res(); }); this.waiters.clear(); this.hooks.forEach(f => f()); }
  }

  const host = () => document.getElementById('opening');
  const q = (sel, el) => (el || host()).querySelector(sel);

  // ---------------------------------------------------------------- entry
  async function start(containerId, count = 1, opts = {}) {
    if (busy) return;
    const c = opts.starter ? D.STARTER_EGG : D.CONTAINER[containerId];
    let res;
    if (opts.starter) {
      const r = E.giveStarter();
      res = { ok: true, results: [{ spec: r.spec, isNew: r.isNew, newVariant: r.newVariant }], levelUps: r.levelUps };
    } else res = E.open(containerId, count);
    if (!res.ok) { ui.toast(res.err, { kind: 'bad', icon: 'close' }); return { ok: false }; }
    busy = true;
    const results = res.results;
    const best = results.reduce((a, r) => (SP.rarityOf(r.spec).tier > SP.rarityOf(a.spec).tier ? r : a), results[0]);
    const bestR = SP.rarityOf(best.spec);
    const h = host();
    h.className = 'op active';
    h.style.setProperty('--hint', bestR.tier >= 2 ? bestR.color : c.theme[1]);
    h.style.setProperty('--theme0', c.theme[0]); h.style.setProperty('--theme1', c.theme[1]);
    h.innerHTML = `<div class="op-bg"></div><div class="op-body"></div>
      <div class="op-top"><span class="op-title"><span class="label">${esc(c.kind)}</span><b>${esc(c.name)}</b>${results.length > 1 && !opts.starter ? ` <em class="mono">×${count}</em>` : ''}</span><button class="btn quiet op-skip" data-skip>${A.icon('skip')}<span>Skip</span></button></div>`;
    document.body.classList.add('opening-on');
    au.duck(.4, 4000);
    let again = null;
    try {
      const instant = ui.speed() === 0;
      if (!instant && !(AV.state.get().settings.skipRituals && !opts.starter)) await ritual(c, count, results, bestR);
      if (!instant) await reveals(results, c);
      again = await summary(c, count, results, opts);
    } catch (e) { console.error('opening error', e); }
    document.body.classList.remove('opening-on', 'glitching');
    h.className = 'op'; h.innerHTML = ''; busy = false;
    if (bestR.tier >= 3) AV._delight = true;
    ui.levelToasts(res.levelUps);
    AV.bus.emit('openingDone', { container: c, results });
    if (again === 'again') return start(containerId, count, opts);
    return { ok: true, results };
  }

  // ---------------------------------------------------------------- ritual
  const PROMPTS = { pack: ['Swipe across the top to tear the wrapper', 'Tap to tear'], egg: ['Tap the egg — something is moving', ''], capsule: ['Tap to twist the capsule', ''], chest: ['Tap to break the seals', ''], vault: ['Tap to turn the wheel', ''], crate: ['Press and hold to charge the lock', ''] };

  async function ritual(c, count, results, bestR) {
    const kind = c.ritual, body = q('.op-body'), seq = new Seq();
    const quick = count > 1, use3d = AV.stage && AV.stage.container3d(kind);
    body.innerHTML = `<div class="rit rit-${kind} ${use3d ? 'is-3d' : ''}" style="--prog:0">
      <div class="rit-aura"></div>
      ${use3d ? `<div class="rit-view" tabindex="0" role="button" aria-label="Open the ${esc(c.name)}"></div>` : `<div class="rit-art" tabindex="0" role="button" aria-label="Open the ${esc(c.name)}">${A.container(kind, c.theme)}</div>`}
      <div class="rit-prompt">${PROMPTS[kind][0]}${quick ? '<small>Quick mode: fewer taps for multi-opens</small>' : ''}</div>
      <div class="rit-prog"><i></i></div></div>`;
    const rit = q('.rit'), art = q(use3d ? '.rit-view' : '.rit-art'), svg = use3d ? null : art.querySelector('svg'), prog = q('.rit-prog i'), prompt = q('.rit-prompt');
    let view = null, inst = null;
    if (use3d) {
      view = AV.stage.view(art, { mode: 'ritual', interactive: true, layer: 2, margin: 1.06, pitch: .2, label: 'Interactive container', plate: false, moteColor: bestR.tier >= 2 ? bestR.color : c.theme[1] });
      if (view && view.setSpec({ container: kind, theme: c.theme, name: c.name, tier: STAGE_TIER[kind] || 2, color: bestR.tier >= 2 ? bestR.color : c.theme[1], plateTitle: c.name })) { inst = view.inst; view.playIntro('pop', .6); }
      else { if (view) view.dispose(); view = null; }
    }
    const skipBtn = q('[data-skip]'); skipBtn.querySelector('span').textContent = 'Skip ritual';
    skipBtn.onclick = () => seq.skip();
    const setP = p => { rit.style.setProperty('--prog', p.toFixed(3)); prog.style.width = (p * 100) + '%'; if (inst && inst.setProgress) inst.setProgress(p); };
    const center = () => fx.centerOf(art);
    const tapOk = () => !view || (view.dragDist || 0) < 6;
    let finish; const done = new Promise(r => (finish = r));
    seq.onSkip(() => finish());

    if (kind === 'egg' && inst) {
      const need = quick ? 2 : 5; let n = 0;
      art.addEventListener('click', () => {
        if (n >= need || !tapOk()) return; n++; setP(n / need); inst.pulse();
        au.play('crack', n); fx.burstAt(art, { count: 8 + n * 3, colors: [c.theme[1], '#ece3cf'], speed: 4, life: 30 }); fx.shake(2 + n, 200);
        if (n >= need) finish();
      });
    } else if (kind === 'egg') {
      const need = quick ? 2 : 5; let n = 0; const cr = svg.querySelector('.cracks');
      art.onclick = () => {
        if (n >= need) return; n++; setP(n / need);
        au.play('crack', n); art.classList.remove('wob'); void art.offsetWidth; art.classList.add('wob');
        cr.setAttribute('class', 'cracks s' + Math.ceil(n / need * 4));
        fx.burstAt(art, { count: 8 + n * 3, colors: [c.theme[1], '#ece3cf'], speed: 4, life: 30 }); fx.shake(3 + n, 220);
        if (n >= need) finish();
      };
    } else if (kind === 'capsule') {
      const need = quick ? 1 : 3; let n = 0;
      art.onclick = () => {
        if (n >= need || !tapOk()) return; n++; setP(n / need); au.play('twist');
        if (inst) inst.pulse(); else { svg.style.setProperty('--twist', (n * 120) + 'deg'); art.classList.remove('wob'); void art.offsetWidth; art.classList.add('wob'); }
        fx.burstAt(art, { count: 10, colors: [c.theme[0], '#ece3cf'], speed: 4, life: 28 });
        if (n >= need) finish();
      };
    } else if (kind === 'chest' || kind === 'vault') {
      const need = quick ? 1 : 3; let n = 0;
      const tap = () => {
        if (n >= need || !tapOk()) return; n++; setP(n / need); au.play('lock', n);
        if (inst) inst.pulse(); else { svg.style.setProperty('--open', String(n / need)); svg.style.setProperty('--turn', (n * 120) + 'deg'); for (let i = 0; i < Math.ceil(n / need * 3); i++) { const l = svg.querySelector('.vl' + i); if (l) l.classList.add('on'); } art.classList.remove('wob'); void art.offsetWidth; art.classList.add('wob'); }
        fx.burstAt(art, { count: 10 + n * 4, colors: [c.theme[1], '#ece3cf'], speed: 5, life: 32 }); fx.shake(3, 200);
        if (n >= need) finish();
      };
      art.addEventListener('click', tap);
    } else if (kind === 'pack') {
      let p = 0, sx = null, moved = false, lastTick = 0;
      const top = svg ? svg.querySelector('.pk-top') : null; // 3D pack: the model itself tears (inst.setProgress)
      const apply = v => { p = U.clamp(v, 0, 1); setP(p); if (top) top.style.transform = `translate(${p * 74}px,${-p * 48}px) rotate(${-p * 26}deg)`; if (p - lastTick >= .2) { lastTick = p; au.play('slide'); } if (p >= 1) { au.play('tear'); fx.burstAt(art, { count: 30, colors: ['#ece3cf', c.theme[0], c.theme[1]], speed: 6, life: 36 }); finish(); } };
      art.addEventListener('pointerdown', e => { if (p >= 1) return; sx = e.clientX; moved = false; art.setPointerCapture(e.pointerId); });
      art.addEventListener('pointermove', e => { if (sx == null || p >= 1) return; const dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true; apply(Math.max(p, dx / (art.getBoundingClientRect().width * .55))); });
      art.addEventListener('pointerup', () => { if (sx == null) return; if (!moved && p < 1) { apply(p + (quick ? .6 : .34)); au.play('tear'); } sx = null; });
      if (!U.$('.rit-prompt small', rit)) prompt.insertAdjacentHTML('beforeend', '<small>…or just tap the pack</small>');
    } else if (kind === 'crate') {
      const total = quick ? 600 : 1500; let p = 0, holding = false, ch = null, last = performance.now(), live = true;
      const startHold = () => { if (!live) return; holding = true; if (!ch) ch = au.charge(); art.classList.add('holding'); };
      const endHold = () => { holding = false; art.classList.remove('holding'); };
      art.addEventListener('pointerdown', e => { startHold(); if (!view) art.setPointerCapture(e.pointerId); });
      art.addEventListener('pointerup', endHold); art.addEventListener('pointercancel', endHold); art.addEventListener('pointerleave', endHold);
      art.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } });
      art.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') endHold(); });
      (function loop(now) {
        if (!live) return; const dt = now - last; last = now;
        p = U.clamp(p + (holding ? dt / total : -dt / (total * 1.6)), 0, 1); setP(p); if (ch) ch.update(p);
        art.style.setProperty('--shk', (p * 5).toFixed(2) + 'px');
        if (holding && p > .05 && Math.random() < .25) fx.burstAt(art, { count: 2, colors: [c.theme[1]], speed: 2.5, life: 22, gravity: -.02 });
        if (p >= 1) { live = false; if (ch) ch.stop(); fx.shake(8, 380); finish(); return; }
        requestAnimationFrame(loop);
      })(performance.now());
      seq.onSkip(() => { live = false; if (ch) ch.stop(); });
      prompt.insertAdjacentHTML('beforeend', '<small>Keyboard: hold Space</small>');
    }
    await done;
    // finalize visuals (also the skip path)
    setP(1); art.onclick = null; art.style.pointerEvents = 'none';
    if (inst) { inst.open(); } else { svg.classList.add('opened'); svg.style.setProperty('--open', '1'); const cr = svg.querySelector('.cracks'); if (cr) cr.setAttribute('class', 'cracks s4'); const top = svg.querySelector('.pk-top'); if (top) top.style.transform = 'translate(74px,-48px) rotate(-26deg)'; const lidtop = svg.querySelector('.cap-top'); if (lidtop) svg.style.setProperty('--twist', '360deg'); }
    prompt.style.opacity = 0;
    const ct = center();
    au.play('thump'); au.sting(Math.min(bestR.tier, 2) === 2 && bestR.tier >= 3 ? 1 : 0);
    fx.flash(bestR.tier >= 3 ? bestR.color : '#fff', 420, bestR.tier >= 3 ? .55 : .3);
    fx.ring(ct.x, ct.y, bestR.tier >= 3 ? bestR.color : c.theme[1], 300, 34, 6);
    fx.burst(ct.x, ct.y, { count: 40, colors: ['#ece3cf', c.theme[0], c.theme[1], bestR.color], speed: 7, life: 44 });
    fx.shake(6 + bestR.tier, 320);
    rit.classList.add('bursting');
    const s2 = new Seq(); skipBtn.onclick = () => s2.skip();
    await s2.wait(ui.dur(use3d ? 1250 : 550));
    if (view) view.dispose();
  }

  // ---------------------------------------------------------------- reveals
  function traitList(s) {
    const it = SP.itemOf(s), t = [];
    const v = SP.variantOf(s); if (v.id !== 'none') t.push({ k: 'Variant', v: v.name, cls: 'var-' + v.id });
    const pt = D.PATTERNS.find(p => p.id === s.pattern); if (pt.id !== 'plain') t.push({ k: 'Pattern', v: pt.name });
    const pal = D.PALETTES[s.palette]; if (pal.id !== 0) t.push({ k: 'Palette', v: pal.name });
    t.push({ k: 'Condition', v: SP.conditionLabel(s), cls: 'cond-' + s.condition });
    t.push({ k: 'Potential', v: s.potential + '%', cls: s.potential >= 80 ? 'hot' : '' });
    const au_ = D.AURAS.find(a => a.id === s.aura); if (au_.id !== 'none') t.push({ k: 'Aura', v: au_.name });
    t.push({ k: 'Size', v: SP.sizeLabel(s.size) });
    const si = SP.serialInfo(s.serial); t.push({ k: 'Serial', v: U.pad(s.serial, 4) + (si.label ? ' · ' + si.label : ''), cls: si.label ? 'hot' : '' });
    if (s.personality) t.push({ k: 'Nature', v: D.PERSONALITIES.find(p => p.id === s.personality).name });
    return t;
  }

  async function reveals(results, c) {
    const body = q('.op-body'), skipBtn = q('[data-skip]');
    let abortAll = false;
    skipBtn.querySelector('span').textContent = results.length > 1 ? 'Skip to summary' : 'Skip';
    skipBtn.onclick = () => { abortAll = true; if (cur) cur.skip(); if (nextResolve) nextResolve(); };
    let cur = null, nextResolve = null, phase = 'anim';
    const keyH = e => {
      if (ui.hasModal()) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
      else if (e.key === 'Escape') { skipBtn.click(); }
    };
    const advance = () => { if (phase === 'anim') { if (cur) cur.skip(); } else if (nextResolve) nextResolve(); };
    document.addEventListener('keydown', keyH);

    for (let i = 0; i < results.length && !abortAll; i++) {
      const r = results[i], s = r.spec, R = SP.rarityOf(s), tier = R.tier;
      const seq = cur = new Seq(); phase = 'anim';
      const fast = results.length > 1 && tier <= 1;
      const w = ms => seq.wait(ui.dur(ms * (fast ? .55 : 1)));
      const has3 = AV.stage && AV.stage.supported() && AV.stage.has(s.base);
      body.innerHTML = `<div class="rv t${tier} r-${R.id}" style="--rc:${R.color}">
        <div class="rv-dim"></div><div class="rv-pool"></div><div class="rv-glitch"><span>SIGNAL LOST</span></div>
        <div class="rv-count mono">${U.pad(i + 1, 2)} / ${U.pad(results.length, 2)}</div>
        <div class="rv-stage ${tier >= 3 ? 's-lumen' : ''}"><div class="rv-view"></div>${has3 ? '' : `<div class="rv-flat"><div class="rv-sil">${A.render(s.base, { silhouette: true })}</div><div class="rv-art">${A.render(s, { no3d: true })}</div><i class="fb-plinth"></i></div>`}</div>
        <div class="rv-sheet">
          <div class="rv-title"><div class="rv-rar">${ui.rtag(R.id)}</div><h2>${esc(SP.displayName(s))}</h2><p class="rv-sub">${r.isNew ? '<b class="newtxt">New discovery. </b>' : ''}${r.newVariant ? '<b class="newtxt">New variant type. </b>' : ''}${SP.itemOf(s).stage ? esc(SP.itemOf(s).stage) + ' · ' : ''}${SP.catOf(s).single}</p></div>
          <div class="rv-traits s-label"><div class="rt-h"><span class="label">Specimen sheet</span><span class="mono">${ui.serial(s.serial)}</span></div><div class="rt-g"></div></div>
          <div class="rv-actions">
            <button class="btn ghost" data-a="fav">${A.icon('heart')}<span>${s.favorite ? 'Favorited' : 'Favorite'}</span></button>
            <button class="btn ghost" data-a="lock">${A.icon('lock')}<span>${s.locked ? 'Locked' : 'Lock'}</span></button>
            <button class="btn ghost" data-a="inspect">${A.icon('eye')}<span>Inspect</span></button>
            <button class="btn primary" data-a="next">${i === results.length - 1 ? 'See results' : 'Next'}${A.icon('play')}</button>
          </div></div></div>`;
      const rv = q('.rv'), stage = q('.rv-stage'), traitsEl = q('.rt-g');
      const add = (...cl) => rv.classList.add(...cl);
      const ct = () => fx.centerOf(stage);
      let view = null;
      if (has3) {
        view = AV.stage.view(q('.rv-view'), { mode: 'display', interactive: true, layer: 2, margin: 1.12, label: `${SP.displayName(s)} — drag to turn`, moteColor: tier >= 2 ? R.color : undefined });
        if (view && view.setSpec(Object.assign({ plateTitle: SP.displayName(s) }, s), { silhouette: tier >= 3 })) { if (tier < 3) view.playIntro('rise', .9); } else { if (view) view.dispose(); view = null; }
        if (!view) { q('.rv-stage').insertAdjacentHTML('beforeend', `<div class="rv-flat"><div class="rv-sil">${A.render(s.base, { silhouette: true })}</div><div class="rv-art">${A.render(s, { no3d: true })}</div><i class="fb-plinth"></i></div>`); }
      }
      // click on empty space advances / skips
      rv.addEventListener('click', e => { if (e.target.closest('button') || e.target.closest('.rv-view') && phase === 'ready' || e.target.closest('.rv-traits')) return; advance(); });
      rv.querySelector('.rv-actions').addEventListener('click', e => {
        const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
        if (a === 'fav') { const f = E.toggleFavorite(s.id); au.play('fav'); b.querySelector('span').textContent = f ? 'Favorited' : 'Favorite'; b.classList.toggle('on', f); if (f) fx.burstAt(b, { count: 8, colors: ['#e68aa6', '#ece3cf'], speed: 3 }); }
        else if (a === 'lock') { const l = E.toggleLock(s.id); au.play('lockset'); b.querySelector('span').textContent = l ? 'Locked' : 'Lock'; b.classList.toggle('on', l); }
        else if (a === 'inspect') AV.inspect(s.id);
        else if (a === 'next') advance();
      });
      const showTraits = async sequential => {
        const list = traitList(s);
        traitsEl.innerHTML = list.map((t, k) => `<div class="trait ${t.cls || ''}" style="--i:${k}"><span>${t.k}</span><b>${esc(t.v)}</b></div>`).join('');
        const els = traitsEl.querySelectorAll('.trait');
        if (!sequential) { els.forEach(e => e.classList.add('in')); return; }
        for (const e of els) { e.style.setProperty('--i', 0); e.classList.add('in'); au.play('trait'); await w(260); }
      };
      const C = ct();
      const pc = [R.color, '#ece3cf', R.color];
      const unveil = () => { if (view) { view.setSilhouette(false); view.playIntro('rise', 1.0); } };

      if (tier === 0) { add('s-in'); au.sting(0); await w(380); }
      else if (tier === 1) { add('s-in'); au.sting(1); fx.burst(C.x, C.y, { count: 14, colors: pc, speed: 4 }); await w(520); }
      else if (tier === 2) { fx.flash(R.color, 260, .2); add('s-in', 's-pool'); au.sting(2); fx.burst(C.x, C.y, { count: 24, colors: pc, speed: 6 }); fx.ring(C.x, C.y, R.color, 240, 30); await w(800); }
      else if (tier === 3 || tier === 4) {
        add('s-dim', 's-in'); au.sting(tier); await w(250); add('s-sil'); fx.converge(C.x, C.y, { count: 36, colors: pc, radius: 280, life: 70 });
        await w(tier === 4 ? 1150 : 900);
        fx.flash(R.color, 380, .45); fx.shake(tier === 4 ? 12 : 7, 420); add('s-flip', 's-pool'); unveil(); fx.ring(C.x, C.y, R.color, 340, 38, 7); fx.burst(C.x, C.y, { count: 50, colors: pc, speed: 9, life: 52 });
        if (tier === 4) { await w(250); fx.ring(C.x, C.y, '#ece3cf', 280, 34, 4); fx.burst(C.x, C.y, { count: 28, colors: pc, speed: 7 }); }
        await w(650);
      } else if (tier === 5 || tier === 6) {
        add('s-dim', 's-in', tier === 6 ? 's-prism' : 's-gold'); au.duck(.15, 6000); au.sting(tier);
        await w(300); add('s-sil'); fx.converge(C.x, C.y, { count: 60, colors: tier === 6 ? ['#6cf2ff', '#ff8af0', '#ece3cf'] : pc, radius: 340, life: 90 });
        await w(1500);
        fx.flash('#fff', 560, .75); fx.shake(14, 650); add('s-flip', 's-pool'); unveil(); [0, 1, 2].forEach(k => setTimeout(() => fx.ring(C.x, C.y, k === 1 ? '#ece3cf' : R.color, 380 + k * 100, 42, 8), k * 150));
        fx.burst(C.x, C.y, { count: 80, colors: tier === 6 ? ['#6cf2ff', '#ff8af0', '#ece3cf'] : pc, speed: 11, life: 60 }); fx.confetti({ count: 50, colors: tier === 6 ? ['#6cf2ff', '#ff8af0', '#ece3cf'] : ['#d7b46e', '#ece3cf', '#b48d4c'] });
        await w(900);
      } else { // anomaly
        document.body.classList.add('glitching'); add('s-dim', 's-in', 's-glitch'); au.sting(7); fx.shake(10, 900); fx.flash('#ff3b5c', 200, .45);
        await w(1100); add('s-sil'); fx.flash('#fff', 100, .5); await w(900);
        document.body.classList.remove('glitching'); add('s-flip', 's-pool'); unveil(); fx.flash('#ff3b5c', 480, .7); fx.shake(14, 500); fx.burst(C.x, C.y, { count: 60, colors: ['#ff3b5c', '#ece3cf', '#00ffcc', '#ff00ff'], speed: 10, shape: 'rect' });
        await w(700);
      }
      // final state (idempotent; covers the skip path)
      document.body.classList.remove('glitching');
      add('s-in', 's-flip', 's-ready'); if (tier >= 2) add('s-pool'); if (tier >= 3) add('s-dim');
      if (view) view.setSilhouette(false);
      rv.classList.remove('s-sil'); rv.classList.add('s-sil-done');
      await showTraits(tier >= 5 && !seq.skipped);
      phase = 'ready';
      if (view && tier >= 3 && s.base && SP.itemOf(s).cat === 'pet') view.react('delight');
      // wait for next
      await new Promise(res => { nextResolve = res; });
      nextResolve = null;
      rv.classList.add('s-out'); await new Seq().wait(ui.reduced() ? 0 : 200);
      if (view) view.dispose();
    }
    document.removeEventListener('keydown', keyH);
    document.body.classList.remove('glitching');
  }

  // ---------------------------------------------------------------- summary
  function summary(c, count, results, opts) {
    return new Promise(resolve => {
      const body = q('.op-body'), skipBtn = q('[data-skip]');
      skipBtn.style.display = 'none';
      const sorted = results.slice().sort((a, b) => SP.rarityOf(b.spec).tier - SP.rarityOf(a.spec).tier);
      const bestR = SP.rarityOf(sorted[0].spec);
      const total = results.reduce((a, r) => a + SP.value(r.spec), 0);
      const cont = D.CONTAINER[c.id];
      const render = () => {
        const alive = sorted.filter(r => E.get(r.spec.id));
        const ids = new Set(alive.map(r => r.spec.id));
        const plan = E.duplicatePlan().filter(id => ids.has(id));
        const ess = E.essencePreview(plan);
        const p = cont ? E.price(cont) : null;
        const canAgain = !opts.starter && cont && E.canAfford({ [p.cur]: p.amt * count });
        body.innerHTML = `<div class="sum">
          <div class="sum-head"><span class="label">${esc(c.name)} · accession record</span><h2>${opts.starter ? 'Welcome to the Archive' : 'Results'}</h2>
            <p>${alive.length} of ${results.length} specimen${results.length > 1 ? 's' : ''} in your vault · combined value <b class="mono">${A.icon('coin')}${U.fmt(total)}</b>${results.some(r => r.isNew) ? ` · <b class="newtxt">${results.filter(r => r.isNew).length} new</b>` : ''}</p></div>
          <div class="sum-grid s-tray">${alive.map((r, i) => `<div class="sum-cell" style="--i:${Math.min(i, 14)}">${ui.card(E.get(r.spec.id), { isNew: r.isNew })}</div>`).join('')}</div>
          <div class="sum-actions">
            ${opts.starter ? '' : `<button class="btn ghost" data-a="dup" ${plan.length ? '' : 'disabled'}>${A.icon('trash')}<span>${plan.length ? `Dismantle ${plan.length} duplicate${plan.length > 1 ? 's' : ''} (+${U.fmt(ess)})` : 'No duplicates to dismantle'}</span></button>`}
            ${!opts.starter && cont ? `<button class="btn ghost" data-a="again" ${canAgain ? '' : 'disabled'}>${A.icon('open')}<span>Open again</span>${ui.cost(p.cur, p.amt * count, canAgain)}</button>` : ''}
            <button class="btn primary major" data-a="done">${opts.starter ? 'Enter the Archive' : 'Done'}</button>
          </div></div>`;
      };
      render();
      fx.flash(bestR.tier >= 3 ? bestR.color : '#fff', 260, .14);
      body.addEventListener('click', async e => {
        const cardEl = e.target.closest('.plate'); if (cardEl) { AV.inspect(cardEl.dataset.id); return; }
        const b = e.target.closest('[data-a]'); if (!b) return;
        if (b.dataset.a === 'done') resolve('done');
        else if (b.dataset.a === 'again') resolve('again');
        else if (b.dataset.a === 'dup') {
          const ids = new Set(results.map(r => r.spec.id)), plan = E.duplicatePlan().filter(id => ids.has(id));
          if (!plan.length) return;
          const ok = await ui.confirm({ title: 'Dismantle duplicates?', danger: true, confirmText: 'Dismantle', icon: 'trash',
            message: `Turn <b>${plan.length}</b> duplicate${plan.length > 1 ? 's' : ''} into <b class="mono">${U.fmt(E.essencePreview(plan))} essence</b>? The best copy of each item is kept. Favorited and locked items are never touched.`,
            extra: `<div class="mini-list">${plan.slice(0, 6).map(id => ui.mini(E.get(id))).join('')}${plan.length > 6 ? `<p class="muted">…and ${plan.length - 6} more</p>` : ''}</div>` });
          if (!ok) return;
          const r = E.dismantle(plan); au.play('dismantle'); fx.flash('#a99ac8', 260, .16);
          ui.toast(`Dismantled ${r.count} → +${U.fmt(r.essence)} essence`, { kind: 'good', icon: 'essence' }); render();
        }
      });
      const keyH = e => { if (!ui.hasModal() && (e.key === 'Escape')) resolve('done'); };
      document.addEventListener('keydown', keyH);
      const orig = resolve; resolve = v => { document.removeEventListener('keydown', keyH); orig(v); };
    });
  }

  AV.opening = { start, busy: () => busy, Seq };
})();
