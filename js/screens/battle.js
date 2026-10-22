/* AETHERVAULT — Combat A: the Training Arena. Drives the pure simulation (js/combat/sim.js) at a fixed 30 Hz and draws it on the shared renderer
 * (js/combat/render.js) with merged battle-LOD models (js/combat/lod.js). This file owns presentation only: HUD, hand, placement, floating numbers.
 * Every rule lives in the simulation; the screen asks it (canDeploy) and sends commands. Nothing here writes to the save. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio, C = AV.combat, S = AV.stage;
  const esc = U.esc, T = () => C.tuning;
  const ELX = 'hsl(180 45% 60%)';
  const fmtTime = t => { const s = Math.max(0, Math.ceil(t)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const HIT_COL = { bolt: '#ffe066', static: '#cfe6ff', drop: '#7fd0ff', shadow: '#b79bff', flame: '#ff9a3c', claw: '#ffe9c8', thud: '#cdb892', root: '#9be08a' };

  /** Board texture: stone, deployment rows, the river with its one bridge, cover. Drawn once from the simulation's own arena data. */
  function drawBoard(g, w, h, px) {
    const Tn = T(), A_ = Tn.arena, mid = Math.floor(h / 2);
    const zone = (rows, col) => { g.fillStyle = col; g.fillRect(0, rows[0] * px, w * px, (rows[1] - rows[0] + 1) * px); };
    zone(A_.deploy.playerRows, 'rgba(127,208,210,.055)'); zone(A_.deploy.enemyRows, 'rgba(191,90,69,.05)');
    // river (two rows) with a darker bed and faint ripples
    const y0 = (mid - 1) * px, rh = 2 * px, gr = g.createLinearGradient(0, y0, 0, y0 + rh); gr.addColorStop(0, '#0c1518'); gr.addColorStop(.5, '#12262b'); gr.addColorStop(1, '#0c1518');
    g.fillStyle = gr; g.fillRect(0, y0, w * px, rh); g.strokeStyle = 'rgba(127,208,210,.14)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const x = (i * 37 % (w * px)), y = y0 + 10 + (i * 53 % (rh - 20)); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 12, y - 4, x + 24, y); g.stroke(); }
    // bridge planks
    const bx = A_.bridge.x0 * px, bw = (A_.bridge.x1 - A_.bridge.x0) * px; g.fillStyle = '#2a241b'; g.fillRect(bx, y0 - 3, bw, rh + 6); g.strokeStyle = '#6c5429'; g.lineWidth = 2; g.strokeRect(bx + 1, y0 - 2, bw - 2, rh + 4);
    g.strokeStyle = 'rgba(180,141,76,.25)'; g.lineWidth = 1; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(bx, y0 + i * rh / 6); g.lineTo(bx + bw, y0 + i * rh / 6); g.stroke(); }
    // centre line and edge brass
    g.strokeStyle = 'rgba(180,141,76,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, w * px - 2, h * px - 2);
  }

  /** A tiny "unit-like" wrapper so props (cover, dummy, cores) go through the same scene API as models. */
  const prop = (root, r, h) => ({ root, frame: { r, h }, update() { }, dispose() { root.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); }, cost: { tris: 0, calls: 0 } });

  function render(root) {
    const s0 = AV.state.get(), c0 = s0.combat, deck = c0 && c0.decks.find(k => k.id === c0.activeDeck), V = deck && C.deck.validate(s0, deck.entries);
    if (!S || !S.supported() || !V || !V.practice) { root.innerHTML = `<div class="panel pad"><h2>Training arena unavailable</h2><p class="muted">${!S || !S.supported() ? 'Combat needs the 3D renderer.' : 'Your active deck has no combat-ready specimens.'}</p><button class="btn primary" data-back>Back to Combat</button></div>`; root.querySelector('[data-back]').onclick = () => ui.go('combat'); return; }
    const THREE = window.THREE, reduced = () => !!AV.state.get().settings.reducedMotion;
    root.innerHTML = `<div class="battle" id="btRoot">
      <div class="bt-field" id="btField"><canvas class="bt-over" id="btOver"></canvas>
        <div class="bt-top"><button class="btn small ghost" id="btExit">${A.icon('back')}Leave</button>
          <div class="bt-core b"><span class="label">Enemy Core</span><div class="bt-hp"><i id="btHpB"></i></div></div>
          <div class="bt-clock"><b id="btTime">2:00</b><small id="btPhase">Practice</small></div>
          <div class="bt-core a"><span class="label">Your Core</span><div class="bt-hp"><i id="btHpA"></i></div></div>
          <button class="btn small ghost" id="btPause" aria-label="Pause">${A.icon('timer')}Pause</button></div>
        <div class="bt-msg" id="btMsg" role="status" aria-live="polite"></div>
        <aside class="bt-info" id="btInfo" hidden></aside>
        <div class="bt-banner" id="btBanner" hidden></div>
        <div class="bt-load" id="btLoad"><i></i><b>Preparing the field…</b><small id="btLoadSub">Building battle models</small></div>
        <div class="bt-pause" id="btPaused" hidden><div class="s-matte pad"><h2>Paused</h2><div class="hub-actions"><button class="btn primary" id="btResume">${A.icon('play')}Resume</button><button class="btn ghost" id="btQuit">Leave training</button></div></div></div>
        <div class="bt-end" id="btEnd" hidden></div></div>
      <div class="bt-hud" id="btHud">
        <div class="bt-elixir" aria-label="Elixir"><span class="cb-cost big" id="btElxN">5</span><div class="bt-ebar"><i id="btElxF"></i><span class="ticks"></span></div></div>
        <div class="bt-hand" id="btHand" role="group" aria-label="Your hand"></div>
        <div class="bt-side2"><button class="btn small ghost" id="btShuffle" title="Reshuffle (R)">${A.icon('sort')}<span>Reshuffle</span><span class="cb-cost sm">${T().hand.reshuffleCost}</span></button><div class="bt-deck" id="btDeck" aria-label="Deck status"></div></div>
      </div></div>`;
    const $ = id => root.querySelector('#' + id), field = $('btField'), over = $('btOver'), oc = over.getContext('2d');
    let disposed = false, scene = null, sim = null, input = null, handKey = '', selCard = null, hover = null, acc = 0, paused = false, ended = false, lastPhase = 'normal', msgT = 0, infoOn = false, elxShown = -1;
    const cache = {}, floats = [], rings = [], cleanups = [];
    const state = { steps: 0 };
    const specs = () => AV.state.get().specimens;

    function say(text, kind) { const m = $('btMsg'); m.textContent = text; m.className = 'bt-msg show ' + (kind || ''); clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('show'), 1800); }

    // ------------------------------------------------------------------ setup
    async function boot() {
      const seed = ((Date.now() ^ (Math.random() * 4294967296)) >>> 0);
      sim = C.sim.create({ seed, specs: specs(), a: { deck: deck.entries.map(e => e.id) }, training: true });
      const cardIds = sim.sides.a.deck, shown = id => (specs()[id].look && AV.progress ? AV.progress.displaySpec(specs()[id]) : specs()[id]);
      await S.ensure([...new Set(cardIds.map(id => shown(id).base))]);
      if (disposed) return;
      scene = C.render.create($('btField'), { arena: { w: sim.w, h: sim.h }, pitch: 1.0, fov: 28, margin: 1.0, lookShift: .25, board: drawBoard, label: 'Training arena' });
      if (!scene) { say('The 3D renderer is unavailable.', 'bad'); return; }
      field.insertBefore(scene.canvas, over); over.style.zIndex = 2;
      scene.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      // static props: cover blocks
      const stone = new THREE.MeshStandardMaterial({ color: 0x4a4c50, roughness: .85, metalness: .05, envMapIntensity: .25 }), trim = new THREE.MeshStandardMaterial({ color: 0xb48d4c, roughness: .4, metalness: .9, envMapIntensity: .8 });
      scene.own(stone); scene.own(trim);
      for (let z = 0; z < sim.h; z++) for (let x = 0; x < sim.w; x++) if (sim.blocked[z * sim.w + x] && !coreCell(x, z) && !riverCell(x, z)) { const b = new THREE.Mesh(scene.own(new THREE.BoxGeometry(.96, .7, .96)), stone), t = new THREE.Mesh(scene.own(new THREE.BoxGeometry(1, .05, 1)), trim); b.position.set(x + .5, .35, z + .5); t.position.set(x + .5, .72, z + .5); scene.scene.add(b, t); }
      // Cores
      ['a', 'b'].forEach(k => { const core = sim.cores[k], col = k === 'a' ? 0x7fd0d2 : 0xbf5a45, g = new THREE.Group();
        const base = new THREE.Mesh(scene.own(new THREE.CylinderGeometry(core.r * .95, core.r * 1.1, .3, 28)), trim), em = scene.own(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.1, roughness: .35, metalness: .2, envMapIntensity: .8 }));
        const crystal = new THREE.Mesh(scene.own(new THREE.OctahedronGeometry(core.r * .62, 0)), em); crystal.position.y = core.r * 1.05; crystal.scale.y = 1.5; g.add(base, crystal); g.position.set(core.x, .15, core.z); scene.scene.add(g); cache['core' + k] = { g, crystal, em }; });
      // dummy
      { const g = new THREE.Group(), wood = scene.own(new THREE.MeshStandardMaterial({ color: 0x6d5434, roughness: .8, metalness: 0 })), ring = scene.own(new THREE.MeshStandardMaterial({ color: 0xbf5a45, roughness: .5, metalness: .2, emissive: 0x3a120c })); const post = new THREE.Mesh(scene.own(new THREE.CylinderGeometry(.22, .3, 1.1, 14)), wood); post.position.y = .55; const t1 = new THREE.Mesh(scene.own(new THREE.TorusGeometry(.34, .06, 8, 20)), ring); t1.rotation.x = Math.PI / 2; t1.position.y = .75; const head = new THREE.Mesh(scene.own(new THREE.SphereGeometry(.26, 14, 10)), wood); head.position.y = 1.25; g.add(post, t1, head);
        const u = prop(g, .4, 1.5); cache.dummy = scene.addUnit(u, { scale: 1, x: -50, z: -50 }); }
      // projectile pool
      const pg = scene.own(new THREE.SphereGeometry(.13, 10, 8)); cache.pool = []; for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(pg, scene.own(new THREE.MeshBasicMaterial({ color: 0xffffff }))); m.visible = false; scene.scene.add(m); cache.pool.push(m); }
      // one battle model per deck card (a card is on the field at most once), built merged and warmed while hidden
      let n = 0; for (const id of cardIds) {
        const sp = specs()[id], u = C.lod.build(sp, { mode: 'dedupe', reduced: reduced() }); $('btLoadSub').textContent = `Building battle models ${++n}/${cardIds.length}`; await new Promise(r => setTimeout(r, 0)); if (disposed) { u && u.dispose(); return; }
        if (!u) continue; const tier = SP.rarityOf(sp).tier, tr = .66 + .06 * tier, th = 1.5 + .13 * tier, sc = Math.min(tr / u.frame.r, th / u.frame.h);
        const h = scene.addUnit(u, { scale: sc, x: -50, z: -50 }); h.group.visible = true; cache[id] = { h, heading: Math.PI, lunge: 0, dying: 0, appear: 0, unit: u, top: u.frame.h * sc };
      }
      scene.renderer.compile(scene.scene, scene.camera); scene.render();
      Object.values(cache).forEach(v => { if (v && v.h) v.h.group.visible = false; }); cache.dummy.group.visible = false;
      input = new C.input.BattleInput({ canvas: scene.canvas, pick: (x, y) => scene.pick(x, y), callbacks: { hover: c => { hover = c; }, confirm: c => tryDeploy(c), cancel: () => cancelSel(), key: k => onKey(k) } });
      scene.onFrame(frame); scene.start(); $('btLoad').hidden = true; buildHand(true);
      AV.combat.live = { sim, scene, api: { select: i => selectSlot(i), deployAt: (x, z) => tryDeploy({ x, z }), screenOf: (x, z) => scene.toScreen(x, 0.4, z), reshuffle: () => doReshuffle(), pause: v => setPause(v), summary: () => scene.summary(), resetStats: () => scene.resetStats(), cache, state } };
    }
    const coreCell = (x, z) => ['a', 'b'].some(k => Math.hypot(x + .5 - sim.cores[k].x, z + .5 - sim.cores[k].z) < sim.cores[k].r + .35);
    const riverCell = (x, z) => { const mid = Math.floor(sim.h / 2); return z === mid - 1 || z === mid; };

    // ------------------------------------------------------------------ HUD
    function buildHand(force) {
      const v = C.sim.view(sim, 'a'), key = v.hand.map(h => h.id).join(',');
      if (!force && key === handKey) return; handKey = key; const el = $('btHand');
      el.innerHTML = v.hand.map((h, i) => { const sp = specs()[h.id], R = SP.rarityOf(sp), d = C.defs.get(sp.base);
        return `<button class="bt-card r-${R.id}" data-slot="${i}" data-id="${h.id}" aria-label="${esc(SP.displayName(sp))}, ${esc(d.roleName)}, costs ${h.cost} Elixir" style="--i:${i}"><i class="plate-bar"></i><span class="bc-art">${A.render(sp)}</span><span class="bc-txt"><b>${esc(SP.displayName(sp))}</b><small>${esc(d.roleName)}</small></span><span class="cb-cost">${h.cost}</span><kbd>${i + 1}</kbd></button>`; }).join('') + Array.from({ length: Math.max(0, T().hand.size - v.hand.length) }, () => '<div class="bt-card empty"><small>Recovering…</small></div>').join('');
      if (selCard && !v.hand.some(h => h.id === selCard)) setSel(null);
      el.querySelectorAll('.bt-card[data-id]').forEach(b => b.classList.toggle('sel', b.dataset.id === selCard));
    }
    function buildDeck() {
      const v = C.sim.view(sim, 'a'); $('btDeck').innerHTML = v.deck.map(d => `<span class="dk ${d.state}" title="${esc(SP.displayName(specs()[d.id]))} — ${d.state === 'rec' ? 'recovering ' + Math.ceil(d.wait) + 's' : d.state === 'field' ? 'on the field' : d.state === 'hand' ? 'in your hand' : 'in the deck'}">${d.state === 'rec' ? `<b>${Math.ceil(d.wait)}</b>` : ''}</span>`).join('');
    }
    let deckKey = '';
    function updateHud() {
      const v = C.sim.view(sim, 'a'), e = v.elixir; const f = $('btElxF'); f.style.width = (e / v.elixirMax * 100) + '%'; const en = Math.floor(e + 1e-6); if (en !== elxShown) { elxShown = en; $('btElxN').textContent = en; }
      $('btTime').textContent = fmtTime(v.left); $('btHpA').style.width = (v.cores.a.hp / v.cores.a.max * 100) + '%'; $('btHpB').style.width = (v.cores.b.hp / v.cores.b.max * 100) + '%';
      $('btPhase').textContent = v.phase === 'surge' ? 'FINAL SURGE · Elixir ×' + T().elixir.surgeMult : v.phase === 'step' ? 'Elixir ×' + T().elixir.regenStepMult : 'Practice';
      root.querySelector('#btRoot').classList.toggle('surge', v.phase === 'surge');
      root.querySelectorAll('.bt-card[data-id]').forEach((b, i) => { const h = v.hand[i]; if (!h) return; b.classList.toggle('poor', !h.ok); b.querySelector('.cb-cost').textContent = h.cost; b.querySelector('.cb-cost').classList.toggle('up', h.cost > C.defs.get(specs()[h.id].base).cost); });
      const sh = $('btShuffle'); sh.disabled = !v.reshuffle.ok || ended; sh.querySelector('span').textContent = v.reshuffle.wait > 0 ? 'Reshuffle ' + Math.ceil(v.reshuffle.wait) + 's' : 'Reshuffle';
      const dk = v.deck.map(d => d.state + (d.state === 'rec' ? Math.ceil(d.wait) : '')).join(','); if (dk !== deckKey) { deckKey = dk; buildDeck(); }
      if (v.phase !== lastPhase) { lastPhase = v.phase; if (v.phase === 'surge' || v.phase === 'step') banner(v.phase === 'surge' ? 'FINAL SURGE' : 'Elixir ×' + T().elixir.regenStepMult, v.phase === 'surge' ? 'Elixir ×' + T().elixir.surgeMult + ' — end it now' : 'Regeneration steps up'); if (v.phase === 'surge') au.play('levelup'); }
      if (infoOn) updateInfo();
    }
    function banner(t, sub) { const b = $('btBanner'); b.innerHTML = `<b>${esc(t)}</b><small>${esc(sub || '')}</small>`; b.hidden = false; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); setTimeout(() => { b.hidden = true; }, 2200); }
    function updateInfo() {
      const el = $('btInfo'); if (!selCard) { el.innerHTML = `<h4>Combat numbers</h4><p class="muted tiny">Select a card to see what its stats translate to.</p>`; return; }
      const sp = specs()[selCard], t = C.translate(sp); if (!t.ok) return; const key = selCard + ':' + t.hp; if (el.dataset.k === key) return; el.dataset.k = key;
      el.innerHTML = `<h4>${esc(SP.displayName(sp))}</h4><small class="muted">${esc(t.def.roleName)} · ${esc(t.def.blurb)}</small><ul class="cb-rows">${t.rows.map(w => `<li><b>${esc(w.label)}</b><span class="mono">${w.value}${w.unit ? ' ' + esc(w.unit) : ''}</span></li>`).join('')}</ul>`;
    }

    // ------------------------------------------------------------------ input
    function setSel(id) { selCard = id; input && input.setActive(!!id); root.querySelectorAll('.bt-card[data-id]').forEach(b => b.classList.toggle('sel', b.dataset.id === id)); if (!id) hover = null; if (infoOn) { $('btInfo').dataset.k = ''; updateInfo(); } }
    function selectSlot(i) { if (ended || paused) return; const v = C.sim.view(sim, 'a'), h = v.hand[i]; if (!h) return; au.play('toast'); setSel(selCard === h.id ? null : h.id); }
    function cancelSel() { if (selCard) { setSel(null); return true; } return false; }
    function tryDeploy(cell) {
      if (!selCard || !cell || ended || paused) return; const r = C.sim.canDeploy(sim, 'a', selCard, cell.x, cell.z);
      if (!r.ok) { say(r.reason, 'bad'); au.play('error'); return; }
      C.sim.command(sim, { side: 'a', type: 'deploy', id: selCard, x: cell.x, z: cell.z }); setSel(null); au.play('thump');
    }
    function doReshuffle() { if (ended || paused) return; C.sim.command(sim, { side: 'a', type: 'reshuffle' }); }
    function setPause(v) { if (ended) return; paused = v == null ? !paused : !!v; $('btPaused').hidden = !paused; if (paused) setSel(null); }
    function onKey(k) { if (k.startsWith('slot')) selectSlot(+k.slice(4) - 1); else if (k === 'reshuffle') doReshuffle(); else if (k === 'pause') setPause(); }

    // ------------------------------------------------------------------ frame
    function processEvents() {
      const ev = sim.events.splice(0);
      for (const e of ev) {
        if (e.type === 'deploy') { const c = cache[e.id]; if (c) { c.uid = e.uid; c.appear = 0; c.dying = 0; c.h.group.visible = true; c.heading = Math.PI; } rings.push({ x: sim.units.find(u => u.uid === e.uid).x, z: sim.units.find(u => u.uid === e.uid).z, t: 0 }); }
        else if (e.type === 'attack') { const c = unitVis(e.uid); if (c) c.lunge = .2; }
        else if (e.type === 'hit') { const p = e.core ? sim.cores[e.core] : sim.units.find(u => u.uid === e.to) || lastPos.get(e.to); if (p) floats.push({ x: p.x, z: p.z, amt: e.amt, crit: e.crit, side: e.side, t: 0 }); if (e.core) au.play('crack'); }
        else if (e.type === 'death') { if (e.kind === 'pet') { const c = cache[e.card]; if (c) { c.dying = .35; au.play('slide'); } } else { cache.dummy.group.visible = false; au.play('whoosh'); } }
        else if (e.type === 'denied') say(e.reason, 'bad');
        else if (e.type === 'reshuffle') { au.play('lockset'); }
      }
    }
    const lastPos = new Map();
    function unitVis(uid) { const u = sim.units.find(x => x.uid === uid); if (!u) return null; return u.kind === 'dummy' ? cache.dummy : cache[u.card]; }
    function frame(dt, tt) {
      if (disposed) return; const tick = T().step;
      if (!paused && !ended) { acc = Math.min(acc + dt, .25); let n = 0; while (acc >= tick && n < 5) { C.sim.step(sim); acc -= tick; n++; state.steps++; processEvents(); if (sim.over) break; } if (n === 5) acc = 0; }
      else acc = 0;
      const alpha = paused ? 1 : Math.min(1, acc / tick), calm = reduced();
      // units
      const live = new Set();
      sim.units.forEach(u => {
        live.add(u.uid); lastPos.set(u.uid, { x: u.x, z: u.z });
        const c = u.kind === 'dummy' ? cache.dummy : cache[u.card]; if (!c) return; const g = (c.h ? c.h : c).group; g.visible = true;
        const x = u.px + (u.x - u.px) * alpha, z = u.pz + (u.z - u.pz) * alpha, moved = Math.hypot(u.x - u.px, u.z - u.pz) > 1e-4;
        if (u.kind === 'dummy') { g.position.set(x, 0, z); return; }
        if (moved) c.heading = angLerp(c.heading, Math.atan2(u.x - u.px, u.z - u.pz), .25); else if (u.target) { const tp = u.target.kind === 'core' ? sim.cores[u.target.side] : sim.units.find(q => q.uid === u.target.uid); if (tp && Math.hypot(tp.x - u.x, tp.z - u.z) > .01) c.heading = angLerp(c.heading, Math.atan2(tp.x - u.x, tp.z - u.z), .2); }
        c.appear = Math.min(1, c.appear + dt / T().pet.deployDelay); if (c.lunge > 0) c.lunge = Math.max(0, c.lunge - dt);
        const lunge = calm ? 0 : Math.sin(Math.PI * (1 - c.lunge / .2)) * (c.lunge > 0 ? .28 : 0), bob = calm || !moved ? 0 : Math.abs(Math.sin(tt * u.speed * 5)) * .08;
        g.position.set(x + Math.sin(c.heading) * lunge, bob, z + Math.cos(c.heading) * lunge); g.rotation.y = c.heading;
        g.scale.setScalar(u.spawn > 0 ? .25 + .75 * c.appear : 1);
      });
      Object.keys(cache).forEach(k => { const c = cache[k]; if (!c || !c.h || c.uid == null) return; if (!live.has(c.uid)) { if (c.dying > 0) { c.dying -= dt; c.h.group.scale.setScalar(Math.max(.01, c.dying / .35)); if (c.dying <= 0) { c.h.group.visible = false; c.uid = null; } } else { c.h.group.visible = false; c.uid = null; } } });
      // Cores
      ['a', 'b'].forEach(k => { const cc = cache['core' + k], core = sim.cores[k], f = core.hp / core.max; cc.crystal.rotation.y = calm ? 0 : tt * .5; cc.em.emissiveIntensity = .25 + .9 * f; cc.crystal.visible = core.hp > 0; });
      // projectiles
      const pool = cache.pool; pool.forEach(m => { m.visible = false; });
      sim.proj.forEach((p, i) => { const m = pool[i]; if (!m) return; m.visible = true; m.position.set(p.px + (p.x - p.px) * alpha, .75, p.pz + (p.z - p.pz) * alpha); m.material.color.set(HIT_COL[p.hit] || '#ffffff'); });
      buildHandMaybe(); updateHud(); drawOverlay(dt);
      if (sim.over && !ended) finish();
    }
    function buildHandMaybe() { const v = C.sim.view(sim, 'a'); const key = v.hand.map(h => h.id).join(','); if (key !== handKey) buildHand(); }
    const angLerp = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };

    // ------------------------------------------------------------------ overlay (HP bars, placement, floating numbers)
    function sizeOver() { const r = field.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (over.width !== w || over.height !== h) { over.width = w; over.height = h; over.style.width = r.width + 'px'; over.style.height = r.height + 'px'; } return dpr; }
    function cellPoly(x0, z0, x1, z1, y) { return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => scene.toScreen(x, y || 0.02, z)); }
    function drawOverlay(dt) {
      if (!scene) return; const dpr = sizeOver(); oc.setTransform(dpr, 0, 0, dpr, 0, 0); oc.clearRect(0, 0, over.width, over.height);
      // placement
      if (selCard && !ended) {
        const rows = T().arena.deploy.playerRows, zone = cellPoly(0, rows[0], sim.w, rows[1] + 1); oc.beginPath(); zone.forEach((p, i) => (i ? oc.lineTo(p.x, p.y) : oc.moveTo(p.x, p.y))); oc.closePath(); oc.fillStyle = 'rgba(127,208,210,.10)'; oc.fill(); oc.strokeStyle = 'rgba(127,208,210,.55)'; oc.lineWidth = 1.5; oc.setLineDash([6, 5]); oc.stroke(); oc.setLineDash([]);
        if (hover) { const r = C.sim.canDeploy(sim, 'a', selCard, hover.x, hover.z), cx = Math.floor(hover.x), cz = Math.floor(hover.z), p = cellPoly(cx, cz, cx + 1, cz + 1); oc.beginPath(); p.forEach((q, i) => (i ? oc.lineTo(q.x, q.y) : oc.moveTo(q.x, q.y))); oc.closePath(); oc.fillStyle = r.ok ? 'rgba(134,176,124,.4)' : 'rgba(191,90,69,.38)'; oc.fill(); oc.strokeStyle = r.ok ? '#86b07c' : '#bf5a45'; oc.lineWidth = 2; oc.stroke();
          const t = C.translate(specs()[selCard]), ring = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; ring.push(scene.toScreen(cx + .5 + Math.cos(a) * t.range, .03, cz + .5 + Math.sin(a) * t.range)); } oc.beginPath(); ring.forEach((q, i) => (i ? oc.lineTo(q.x, q.y) : oc.moveTo(q.x, q.y))); oc.strokeStyle = r.ok ? 'rgba(236,227,207,.55)' : 'rgba(191,90,69,.4)'; oc.lineWidth = 1; oc.stroke(); }
      }
      // spawn rings
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; if (r.t > .8) { rings.splice(i, 1); continue; } const k = r.t / .8, pts = []; for (let j = 0; j <= 28; j++) { const a = j / 28 * Math.PI * 2; pts.push(scene.toScreen(r.x + Math.cos(a) * (.4 + k * 1.1), .03, r.z + Math.sin(a) * (.4 + k * 1.1))); } oc.beginPath(); pts.forEach((q, j) => (j ? oc.lineTo(q.x, q.y) : oc.moveTo(q.x, q.y))); oc.strokeStyle = `rgba(127,208,210,${.8 * (1 - k)})`; oc.lineWidth = 2; oc.stroke(); }
      // HP bars
      const bar = (x, y, w, f, col) => { oc.fillStyle = 'rgba(11,10,9,.8)'; oc.fillRect(x - w / 2 - 1, y - 1, w + 2, 6); oc.fillStyle = col; oc.fillRect(x - w / 2, y, w * Math.max(0, f), 4); };
      sim.units.forEach(u => { if (u.hp <= 0) return; const p = scene.toScreen(u.px + (u.x - u.px) * .5, u.kind === 'dummy' ? 1.7 : ((cache[u.card] && cache[u.card].top) || 1.2) + .3, u.pz + (u.z - u.pz) * .5); if (u.kind === 'pet' && u.spawn > 0) return; bar(p.x, p.y, u.kind === 'dummy' ? 34 : 38, u.hp / u.max, u.side === 'a' ? '#86b07c' : '#bf5a45'); });
      ['a', 'b'].forEach(k => { const core = sim.cores[k], p = scene.toScreen(core.x, 2.6, core.z); bar(p.x, p.y, 70, core.hp / core.max, k === 'a' ? '#7fd0d2' : '#bf5a45'); oc.fillStyle = '#ece3cf'; oc.font = '600 11px "IBM Plex Mono", monospace'; oc.textAlign = 'center'; oc.fillText(Math.ceil(core.hp), p.x, p.y - 5); });
      // floating numbers
      for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; if (f.t > .9) { floats.splice(i, 1); continue; } const k = f.t / .9, p = scene.toScreen(f.x, 1.2 + (reduced() ? 0 : k * .9), f.z); oc.globalAlpha = 1 - k * k; oc.fillStyle = f.crit ? '#ffc247' : f.side === 'a' ? '#ece3cf' : '#ff9a85'; oc.font = `${f.crit ? 700 : 600} ${f.crit ? 17 : 13}px "IBM Plex Mono", monospace`; oc.textAlign = 'center'; oc.fillText((f.crit ? '' : '') + f.amt, p.x, p.y); oc.globalAlpha = 1; }
    }

    // ------------------------------------------------------------------ end of match
    function finish() {
      ended = true; setSel(null); const o = sim.over, st = sim.stats.a, el = $('btEnd'), title = o.reason === 'breach' ? (o.winner === 'a' ? 'Core breached' : 'Your Core fell') : o.reason === 'draw' ? 'Time — nothing decided' : (o.winner === 'a' ? 'Time — you led' : 'Time');
      el.innerHTML = `<div class="s-matte hi pad"><span class="label">Practice complete</span><h2>${esc(title)}</h2><ul class="end-rows"><li><span>Time</span><b class="mono">${fmtTime(o.t)}</b></li><li><span>Damage to the enemy Core</span><b class="mono">${Math.round(st.coreDmg)}</b></li><li><span>Elixir spent</span><b class="mono">${sim.sides.a.spent}</b></li><li><span>Deployments</span><b class="mono">${Object.values(sim.sides.a.deployCount).reduce((a, b) => a + b, 0)}</b></li></ul>
        <p class="tiny dim">Training changes nothing: no rewards, no rating, no change to any specimen.</p><div class="hub-actions"><button class="btn primary" id="btAgain">${A.icon('play')}Train again</button><button class="btn ghost" id="btBack">Back to Combat</button></div></div>`;
      el.hidden = false; $('btAgain').onclick = () => ui.go('battle'); $('btBack').onclick = () => ui.go('combat');
    }

    // ------------------------------------------------------------------ wiring
    root.addEventListener('pointerdown', e => { const b = e.target.closest('.bt-card[data-slot]'); if (!b || e.button !== 0) return; selectSlotKeep(+b.dataset.slot); input && input.beginDrag(e); });
    function selectSlotKeep(i) { const v = C.sim.view(sim, 'a'), h = v.hand[i]; if (!h || ended || paused) return; if (selCard !== h.id) { au.play('toast'); setSel(h.id); } }
    root.addEventListener('click', e => {
      const b = e.target.closest('.bt-card[data-slot]'); if (b && e.detail === 0) { selectSlot(+b.dataset.slot); return; } // keyboard activation
      const w = e.target.closest('button'); if (!w) return;
      if (w.id === 'btShuffle') doReshuffle(); else if (w.id === 'btPause') setPause(); else if (w.id === 'btResume') setPause(false);
      else if (w.id === 'btExit' || w.id === 'btQuit') { if (ended) ui.go('combat'); else { const was = paused; setPause(true); ui.confirm({ title: 'Leave training?', message: 'Nothing is saved or lost in training.', confirmText: 'Leave' }).then(ok => { if (ok) ui.go('combat'); else if (!was) setPause(false); }); } }
    });
    const vis2 = () => { if (document.hidden && C && AV.state.get().combat.settings.autoPause && sim && !ended) setPause(true); };
    document.addEventListener('visibilitychange', vis2); cleanups.push(() => document.removeEventListener('visibilitychange', vis2));
    const infoBtn = document.createElement('button'); infoBtn.className = 'btn small ghost bt-infobtn'; infoBtn.innerHTML = A.icon('info') + 'Numbers'; infoBtn.onclick = () => { infoOn = !infoOn; $('btInfo').hidden = !infoOn; if (infoOn) { $('btInfo').dataset.k = ''; updateInfo(); } }; field.appendChild(infoBtn);
    boot().catch(err => { console.error('[battle] failed to start', err); $('btLoad').innerHTML = `<b>The arena could not start.</b><small>${esc(err && err.message || err)}</small>`; });
    return () => {
      disposed = true; cleanups.forEach(f => f()); if (input) input.dispose(); if (scene) scene.dispose(); AV.combat.live = null; clearTimeout(msgT);
    };
  }
  ui.register('battle', { render });
})();
