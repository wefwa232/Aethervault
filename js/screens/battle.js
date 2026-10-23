/* AETHERVAULT — the Training Arena (Combat A, extended in Combat B). Drives the pure simulation (js/combat/sim.js) at a fixed 30 Hz and draws it on the shared
 * renderer (js/combat/render.js) with merged battle-LOD models (js/combat/lod.js) and pooled effects (js/combat/fx.js). This file owns presentation only:
 * HUD, hand, selection, orders, aiming previews, floating numbers. Every rule lives in the simulation; the screen asks it (canDeploy / canMove / abil.check)
 * and sends commands. Nothing here writes to the save.
 *
 * Modes (one at a time; each cancels with Esc, right-click and a visible Cancel button):
 *   card    a hand card is picked: click the board to place/play it
 *   aim     a Pet ability is being aimed (Q/E/R): the preview shows exactly the shape the simulation will use
 *   move    click the ground to send the selected Pet there     target   click an enemy (or the Core) to set a priority target
 * With no mode: left-click a Pet selects it (drag it to the ground to order it); right-click orders the selected Pet (ground = walk, enemy = priority).
 * Keys: 1–4 cards · Q E R abilities · M move · T target · S stop · Tab next Pet · X reshuffle · P pause · Esc cancel / deselect / pause. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, SP = AV.specimen, A = AV.art, ui = AV.ui, au = AV.audio, C = AV.combat, S = AV.stage;
  const esc = U.esc, T = () => C.tuning;
  const fmtTime = t => { const s = Math.max(0, Math.ceil(t)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const TEAL = 0x7fd0d2, RED = 0xbf5a45, MOSS = 0x86b07c, GOLD = 0xe0a24a, IVORY = 0xece3cf, VIOLET = 0xb79bff;
  const HIT_COL = { bolt: 0xffe066, static: 0xcfe6ff, drop: 0x7fd0ff, shadow: 0xb79bff, flame: 0xff9a3c, claw: 0xffe9c8, thud: 0xcdb892, root: 0x9be08a };
  const touchUi = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches), tw = t => touchUi() ? t.replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap') : t;
  const fat = e => (e && e.pointerType && e.pointerType !== 'mouse') ? 14 : 0; // touch picks get a wider radius around a unit
  const AIM_NAME = k => C.aim.NAMES[k] || k, AIM_HELP = k => C.aim.HELP[k] || '';

  /** Board texture: stone, deployment rows, the river with its one bridge, cover. Drawn once from the simulation's own arena data. */
  function drawBoard(g, w, h, px) {
    const Tn = T(), A_ = Tn.arena, mid = Math.floor(h / 2);
    const zone = (rows, col) => { g.fillStyle = col; g.fillRect(0, rows[0] * px, w * px, (rows[1] - rows[0] + 1) * px); };
    zone(A_.deploy.playerRows, 'rgba(127,208,210,.055)'); zone(A_.deploy.enemyRows, 'rgba(191,90,69,.05)');
    const y0 = (mid - 1) * px, rh = 2 * px, gr = g.createLinearGradient(0, y0, 0, y0 + rh); gr.addColorStop(0, '#0c1518'); gr.addColorStop(.5, '#12262b'); gr.addColorStop(1, '#0c1518');
    g.fillStyle = gr; g.fillRect(0, y0, w * px, rh); g.strokeStyle = 'rgba(127,208,210,.14)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const x = (i * 37 % (w * px)), y = y0 + 10 + (i * 53 % (rh - 20)); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 12, y - 4, x + 24, y); g.stroke(); }
    const bx = A_.bridge.x0 * px, bw = (A_.bridge.x1 - A_.bridge.x0) * px; g.fillStyle = '#2a241b'; g.fillRect(bx, y0 - 3, bw, rh + 6); g.strokeStyle = '#6c5429'; g.lineWidth = 2; g.strokeRect(bx + 1, y0 - 2, bw - 2, rh + 4);
    g.strokeStyle = 'rgba(180,141,76,.25)'; g.lineWidth = 1; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(bx, y0 + i * rh / 6); g.lineTo(bx + bw, y0 + i * rh / 6); g.stroke(); }
    g.strokeStyle = 'rgba(180,141,76,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, w * px - 2, h * px - 2);
  }
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
          <div class="bt-tools"><button class="btn small ghost" id="btHostile" title="Make the sparring dummies fight back">Dummies: passive</button><button class="btn small ghost" id="btPause" aria-label="Pause">${A.icon('timer')}Pause</button></div></div>
        <div class="bt-msg" id="btMsg" role="status" aria-live="polite"></div>
        <div class="bt-rot" id="btRot" hidden><span>Landscape gives the arena more room.</span><button class="btn small ghost" id="btRotX" aria-label="Dismiss tip">Got it</button></div>
        <div class="bt-aim" id="btAim" hidden><span id="btAimTxt"></span><button class="btn small ghost" id="btAimCancel">Cancel<span class="k-esc"> · Esc</span></button></div>
        <aside class="bt-info" id="btInfo" hidden></aside>
        <aside class="bt-sel" id="btSel" hidden aria-label="Selected Pet"></aside>
        <div class="bt-banner" id="btBanner" hidden></div>
        <div class="bt-load" id="btLoad"><i></i><b>Preparing the field…</b><small id="btLoadSub">Building battle models</small></div>
        <div class="bt-pause" id="btPaused" hidden><div class="s-matte pad"><h2>Paused</h2><div class="hub-actions"><button class="btn primary" id="btResume">${A.icon('play')}Resume</button><button class="btn ghost" id="btQuit">Leave training</button></div></div></div>
        <div class="bt-end" id="btEnd" hidden></div></div>
      <div class="bt-hud" id="btHud">
        <div class="bt-elixir" aria-label="Elixir"><span class="cb-cost big" id="btElxN">5</span><div class="bt-ebar"><i id="btElxF"></i><span class="ticks"></span></div></div>
        <div class="bt-hand" id="btHand" role="group" aria-label="Your hand"></div>
        <div class="bt-side2"><button class="btn small ghost" id="btShuffle" title="Reshuffle (X)">${A.icon('sort')}<span>Reshuffle</span><span class="cb-cost sm">${T().hand.reshuffleCost}</span></button><div class="bt-deck" id="btDeck" aria-label="Deck status"></div></div>
      </div></div>`;
    const $ = id => root.querySelector('#' + id), field = $('btField'), over = $('btOver'), oc = over.getContext('2d');
    let fatPtr = 0, disposed = false, scene = null, sim = null, input = null, fx = null, handKey = '', selCard = null, mode = null, selUid = 0, hover = null, acc = 0, paused = false, ended = false, lastPhase = 'normal', msgT = 0, infoOn = false, elxShown = -1, frameNo = 0, selKey = '', deckKey = '', dragCell = null;
    const cache = {}, cards = [], cleanups = [], ptr = { x: 0, y: 0 }, P = { x: 0, y: 0 }, P2 = { x: 0, y: 0 }, lastPos = new Map(), state = { steps: 0 };
    const floats = Array.from({ length: 48 }, () => ({ on: false, x: 0, z: 0, amt: 0, crit: false, kind: 0, t: 0 })), rings = Array.from({ length: 10 }, () => ({ on: false, x: 0, z: 0, t: 0, hex: TEAL }));
    const specs = () => AV.state.get().specimens, defOf = id => C.defs.get(specs()[id].base);

    function say(text, kind) { const m = $('btMsg'); m.textContent = text; m.className = 'bt-msg show ' + (kind || ''); clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('show'), 2000); }
    const petUnit = uid => sim.units.find(u => u.uid === uid && u.hp > 0 && u.kind === 'pet' && u.side === 'a');
    const topOf = u => (cache[u.card] && cache[u.card].top) || (u.kind === 'dummy' ? 1.5 : 1.0);

    // ------------------------------------------------------------------ setup
    async function boot() {
      const seed = ((Date.now() ^ (Math.random() * 4294967296)) >>> 0);
      sim = C.sim.create({ seed, specs: specs(), a: { deck: deck.entries.map(e => e.id) }, training: true, dummies: 3 });
      const cardIds = sim.sides.a.deck, shown = id => (specs()[id].look && AV.progress ? AV.progress.displaySpec(specs()[id]) : specs()[id]);
      await S.ensure([...new Set(cardIds.map(id => shown(id).base))]);
      if (disposed) return;
      scene = C.render.create($('btField'), { arena: { w: sim.w, h: sim.h }, pitch: 1.0, fov: 28, margin: 1.0, lookShift: .25, topInset: () => ($('btField').clientHeight < 640 ? ($('btField').querySelector('.bt-top') || {}).offsetHeight || 0 : 0), board: drawBoard, label: 'Training arena' });
      if (!scene) { say('The 3D renderer is unavailable.', 'bad'); return; }
      field.insertBefore(scene.canvas, over); over.style.zIndex = 2;
      scene.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      const stone = new THREE.MeshStandardMaterial({ color: 0x4a4c50, roughness: .85, metalness: .05, envMapIntensity: .25 }), trim = new THREE.MeshStandardMaterial({ color: 0xb48d4c, roughness: .4, metalness: .9, envMapIntensity: .8 });
      scene.own(stone); scene.own(trim);
      for (let z = 0; z < sim.h; z++) for (let x = 0; x < sim.w; x++) if (sim.blocked[z * sim.w + x] && !coreCell(x, z) && !riverCell(x, z)) { const b = new THREE.Mesh(scene.own(new THREE.BoxGeometry(.96, .7, .96)), stone), t = new THREE.Mesh(scene.own(new THREE.BoxGeometry(1, .05, 1)), trim); b.position.set(x + .5, .35, z + .5); t.position.set(x + .5, .72, z + .5); scene.scene.add(b, t); }
      ['a', 'b'].forEach(k => { const core = sim.cores[k], col = k === 'a' ? 0x7fd0d2 : 0xbf5a45, g = new THREE.Group();
        const base = new THREE.Mesh(scene.own(new THREE.CylinderGeometry(core.r * .95, core.r * 1.1, .3, 28)), trim), em = scene.own(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.1, roughness: .35, metalness: .2, envMapIntensity: .8 }));
        const crystal = new THREE.Mesh(scene.own(new THREE.OctahedronGeometry(core.r * .62, 0)), em); crystal.position.y = core.r * 1.05; crystal.scale.y = 1.5; g.add(base, crystal); g.position.set(core.x, .15, core.z); scene.scene.add(g); cache['core' + k] = { g, crystal, em }; });
      { const g = new THREE.Group(), wood = scene.own(new THREE.MeshStandardMaterial({ color: 0x6d5434, roughness: .8, metalness: 0 })), ring = scene.own(new THREE.MeshStandardMaterial({ color: 0xbf5a45, roughness: .5, metalness: .2, emissive: 0x3a120c })); const post = new THREE.Mesh(scene.own(new THREE.CylinderGeometry(.22, .3, 1.1, 14)), wood); post.position.y = .55; const t1 = new THREE.Mesh(scene.own(new THREE.TorusGeometry(.34, .06, 8, 20)), ring); t1.rotation.x = Math.PI / 2; t1.position.y = .75; const head = new THREE.Mesh(scene.own(new THREE.SphereGeometry(.26, 14, 10)), wood); head.position.y = 1.25; g.add(post, t1, head);
        const u = prop(g, .4, 1.5); cache.dummies = []; for (let i = 0; i < 3; i++) { const inst = i ? prop(g.clone(), .4, 1.5) : u; const h = scene.addUnit(inst, { scale: 1, x: -50, z: -50 }); h.group.visible = false; cache.dummies.push({ h, group: h.group }); } }
      fx = C.fx.create(scene);
      let n = 0; for (const id of cardIds) {
        const sp = specs()[id], u = C.lod.build(sp, { mode: 'dedupe', reduced: reduced() }); $('btLoadSub').textContent = `Building battle models ${++n}/${cardIds.length}`; await new Promise(r => setTimeout(r, 0)); if (disposed) { u && u.dispose(); return; }
        if (!u) continue; const tier = SP.rarityOf(sp).tier, tr = .66 + .06 * tier, th = 1.5 + .13 * tier, sc = Math.min(tr / u.frame.r, th / u.frame.h);
        const h = scene.addUnit(u, { scale: sc, x: -50, z: -50 }); h.group.visible = true; cache[id] = { h, heading: Math.PI, lunge: 0, dying: 0, appear: 0, unit: u, top: u.frame.h * sc, seen: 0, dx: 0, dz: 0, kind: defOf(id).cat, spin: 0 }; cards.push(cache[id]);
      }
      scene.renderer.compile(scene.scene, scene.camera); scene.render();
      cards.forEach(v => { v.h.group.visible = false; }); cache.dummies.forEach(d => { d.group.visible = false; });
      input = new C.input.BattleInput({ canvas: scene.canvas, pick: (x, y) => scene.pick(x, y), callbacks: { hover: c => { hover = c; }, point: (x, y) => { ptr.x = x; ptr.y = y; fatPtr = 14; }, confirm: (c, e) => onConfirm(c, e), cancel: () => cancelMode(), key: k => onKey(k), select: (e, c) => onSelect(e, c), order: (e, c) => onOrder(e, c), dragOrder: (e, c) => onDragOrder(e, c), dragMove: (e, c) => { dragCell = c; } } });
      scene.canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { ptr.x = e.clientX; ptr.y = e.clientY; fatPtr = 0; } });
      scene.onFrame(frame); scene.start(); $('btLoad').hidden = true; buildHand(true);
      AV.combat.live = { sim, scene, fx, api: { select: i => selectSlot(i), deployAt: (x, z) => onConfirm({ x, z }), screenOf: (x, z) => scene.toScreen(x, 0.4, z), screenOfUnit: uid => { const u = sim.units.find(q => q.uid === uid); return u ? scene.toScreen(u.x, topOf(u) * .5, u.z) : null; }, reshuffle: () => doReshuffle(), pause: v => setPause(v),
        summary: () => scene.summary(), resetStats: () => scene.resetStats(), cache, state, selectPet: uid => selectPet(uid), key: k => onKey(k), mode: () => mode && mode.kind, selUid: () => selUid, fxStats: () => fx.stats(), setHostile: v => setHostile(v), cancel: () => cancelMode() } };
    }
    const coreCell = (x, z) => ['a', 'b'].some(k => Math.hypot(x + .5 - sim.cores[k].x, z + .5 - sim.cores[k].z) < sim.cores[k].r + .35);
    const riverCell = (x, z) => { const mid = Math.floor(sim.h / 2); return z === mid - 1 || z === mid; };

    // ------------------------------------------------------------------ HUD
    function buildHand(force) {
      const v = C.sim.view(sim, 'a'), key = v.hand.map(h => h.id).join(',');
      if (!force && key === handKey) return; handKey = key; const el = $('btHand');
      el.innerHTML = v.hand.map((h, i) => { const sp = specs()[h.id], R = SP.rarityOf(sp), d = C.defs.get(sp.base), tag = h.limited ? 'Limited Combat Kit' : d.roleName;
        return `<button class="bt-card r-${R.id} ${d.cat !== 'pet' ? 'support' : ''}" data-slot="${i}" data-id="${h.id}" aria-label="${esc(SP.displayName(sp))}, ${esc(d.roleName)}${h.limited ? ', Limited Combat Kit' : ''}, costs ${h.cost} Elixir" style="--i:${i}"><i class="plate-bar"></i><span class="bc-art">${A.render(sp)}</span><span class="bc-txt"><b>${esc(SP.displayName(sp))}</b><small class="${h.limited ? 'lim' : ''}">${esc(tag)}</small></span><span class="cb-cost">${h.cost}</span><kbd>${i + 1}</kbd></button>`; }).join('') + Array.from({ length: Math.max(0, T().hand.size - v.hand.length) }, () => '<div class="bt-card empty"><small>Recovering…</small></div>').join('');
      if (selCard && !v.hand.some(h => h.id === selCard)) setMode(null);
      el.querySelectorAll('.bt-card[data-id]').forEach(b => b.classList.toggle('sel', b.dataset.id === selCard));
    }
    function buildDeck(v) {
      $('btDeck').innerHTML = v.deck.map(d => { const sp = specs()[d.id], nm = SP.displayName(sp);
        return `<span class="dk ${d.state}" title="${esc(nm)} — ${d.state === 'rec' ? 'recovering, back in ' + Math.ceil(d.wait) + ' s' : d.state === 'field' ? 'on the field' : d.state === 'hand' ? 'in your hand' : 'in the deck'}${d.surcharge ? ' · redeploy +' + d.surcharge + ' Elixir' : ''}"><i class="dk-art">${A.render(sp)}</i>${d.state === 'rec' ? `<b>${Math.ceil(d.wait)}</b>` : ''}${d.surcharge ? `<em>+${d.surcharge}</em>` : ''}</span>`; }).join('');
    }
    function updateHud() {
      const v = C.sim.view(sim, 'a'), e = v.elixir; const f = $('btElxF'); f.style.width = (e / v.elixirMax * 100) + '%'; const en = Math.floor(e + 1e-6); if (en !== elxShown) { elxShown = en; $('btElxN').textContent = en; }
      $('btTime').textContent = fmtTime(v.left); $('btHpA').style.width = (v.cores.a.hp / v.cores.a.max * 100) + '%'; $('btHpB').style.width = (v.cores.b.hp / v.cores.b.max * 100) + '%';
      $('btPhase').textContent = v.phase === 'surge' ? 'FINAL SURGE · Elixir ×' + T().elixir.surgeMult : v.phase === 'step' ? 'Elixir ×' + T().elixir.regenStepMult : 'Practice';
      root.querySelector('#btRoot').classList.toggle('surge', v.phase === 'surge');
      root.querySelectorAll('.bt-card[data-id]').forEach((b, i) => { const h = v.hand[i]; if (!h) return; b.classList.toggle('poor', !h.ok); b.classList.toggle('busy', !!h.busy); b.querySelector('.cb-cost').textContent = h.cost; b.querySelector('.cb-cost').classList.toggle('up', h.cost > C.defs.get(specs()[h.id].base).cost); });
      const sh = $('btShuffle'); sh.disabled = !v.reshuffle.ok || ended; sh.querySelector('span').textContent = v.reshuffle.wait > 0 ? 'Reshuffle ' + Math.ceil(v.reshuffle.wait) + 's' : 'Reshuffle';
      const dk = v.deck.map(d => d.state + (d.state === 'rec' ? Math.ceil(d.wait) : '') + d.surcharge).join(','); if (dk !== deckKey) { deckKey = dk; buildDeck(v); }
      if (v.phase !== lastPhase) { lastPhase = v.phase; if (v.phase === 'surge' || v.phase === 'step') banner(v.phase === 'surge' ? 'FINAL SURGE' : 'Elixir ×' + T().elixir.regenStepMult, v.phase === 'surge' ? 'Elixir ×' + T().elixir.surgeMult + ' — end it now' : 'Regeneration steps up'); if (v.phase === 'surge') au.play('levelup'); }
      updateSel(v); if (infoOn) updateInfo();
    }
    function banner(t, sub) { const b = $('btBanner'); b.innerHTML = `<b>${esc(t)}</b><small>${esc(sub || '')}</small>`; b.hidden = false; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); setTimeout(() => { b.hidden = true; }, 2200); }
    function updateInfo() {
      const el = $('btInfo'), id = selCard || (selUid && petUnit(selUid) && petUnit(selUid).card); if (!id) { el.innerHTML = `<h4>Combat numbers</h4><p class="muted tiny">Pick a card or select a Pet to see what its stats translate to.</p>`; el.dataset.k = ''; return; }
      const sp = specs()[id], t = C.translate(sp); if (!t.ok) return; const key = id + ':' + (t.hp || ''); if (el.dataset.k === key) return; el.dataset.k = key; const kit = C.defs.kitLabel(sp.base);
      el.innerHTML = `<h4>${esc(SP.displayName(sp))}</h4><small class="muted">${esc(t.def.roleName)} · ${esc(t.def.blurb)}</small>${kit ? `<span class="kit">${kit}</span>` : ''}<ul class="cb-rows">${t.rows.map(w => `<li><b>${esc(w.label)}</b><span class="mono">${w.value}${w.unit ? ' ' + esc(w.unit) : ''}</span></li>`).join('')}</ul>`;
    }

    // ------------------------------------------------------------------ selected Pet panel
    function selectPet(uid) {
      if (mode && mode.kind !== 'card') setMode(null); selUid = uid || 0; selKey = ''; const el = $('btSel');
      if (!selUid) { el.hidden = true; el.innerHTML = ''; return; }
      const u = petUnit(selUid); if (!u) { selUid = 0; el.hidden = true; return; } const d = C.defs.get(u.base), sp = specs()[u.card], kit = C.defs.kitLabel(u.base);
      el.hidden = false;
      el.innerHTML = `<div class="bs-head"><b>${esc(SP.displayName(sp))}</b><small>${esc(d.roleName)}</small><button class="bs-x" data-desel aria-label="Deselect Pet">${A.icon('close')}</button>${kit ? `<span class="kit" title="Only its basic attack, orders and targeting are available; Q/E/R are not authored for this Pet yet.">${kit}</span>` : ''}</div>
        <div class="bs-hp"><i id="bsHp"></i><span id="bsHpN"></span></div>
        <div class="bs-abil">${d.abilities ? ['q', 'e', 'r'].map(k => { const a = d.abilities[k]; return `<button class="ab" data-slot="${k}" title="${esc(a.text)} — ${esc(AIM_NAME(a.aim))}${a.auto === 'none' ? ' · manual only' : k === 'r' ? ' · manual only' : ' · automatic when its rule fires'}"><kbd>${k.toUpperCase()}</kbd><b>${esc(a.name)}</b><small>${esc(AIM_NAME(a.aim))}${k === 'r' ? ' · manual' : a.auto === 'none' ? ' · manual' : ' · auto'}</small><i class="cdf"></i><em class="tg"></em></button>`; }).join('') :
          `<p class="kit-note"><b>${kit || 'No abilities'}</b> — automatic basic attack, orders and targeting only.${d.passive ? ` Passive <b>${esc(d.passive.name)}</b>: ${esc(d.passive.text)}` : ''}</p>`}</div>
        <div class="bs-ord"><button class="btn small ghost" data-ord="move" title="Walk to a spot (M) — 5 s cooldown per Pet"><kbd>M</kbd>Move</button><button class="btn small ghost" data-ord="target" title="Prioritise a target (T)"><kbd>T</kbd>Target</button><button class="btn small ghost" data-ord="stop" title="Stop walking (S)"><kbd>S</kbd>Stop</button></div>
        <small class="bs-note" id="bsNote"></small>`;
      if (infoOn) updateInfo();
    }
    function updateSel(v) {
      if (!selUid) return; const p = v.pets.find(q => q.uid === selUid); if (!p) { const wasDead = !petUnit(selUid); selectPet(0); if (wasDead) say('That Pet was recalled.', ''); return; }
      const el = $('btSel'), hp = el.querySelector('#bsHp'); if (!hp) return; hp.style.width = (p.hp / p.max * 100) + '%'; el.querySelector('#bsHpN').textContent = Math.ceil(p.hp) + ' / ' + p.max;
      p.abilities.forEach(a => { const b = el.querySelector(`.ab[data-slot="${a.slot}"]`); if (!b) return; const fill = a.slot === 'r' ? a.charge : (a.cd > 0 ? 1 - a.wait / a.cd : 1); b.querySelector('.cdf').style.transform = `scaleX(${Math.max(0, Math.min(1, fill))})`; b.classList.toggle('ready', a.ready); b.classList.toggle('aim', !!mode && mode.kind === 'aim' && mode.slot === a.slot);
        b.querySelector('.tg').textContent = a.queued ? 'queued' : a.slot === 'r' ? (a.ready ? 'ready' : Math.floor(a.charge * 100) + '%') : a.wait > 0 ? Math.ceil(a.wait) + 's' : ''; });
      const mv = el.querySelector('[data-ord="move"]'); if (mv) { mv.classList.toggle('on', !!mode && mode.kind === 'move'); mv.lastChild.textContent = p.moveWait > 0 ? 'Move ' + Math.ceil(p.moveWait) + 's' : 'Move'; }
      const tg = el.querySelector('[data-ord="target"]'); if (tg) tg.classList.toggle('on', !!mode && mode.kind === 'target');
      const note = el.querySelector('#bsNote'), nk = (p.prio ? 'p' : '') + (p.order ? 'o' : ''); if (note && nk !== selKey) { selKey = nk; note.textContent = touchUi() ? (p.prio ? 'Priority target set — tap another enemy to change it.' : p.order ? 'Walking to the marked spot.' : 'Tap the ground to walk, an enemy to prioritise it.') : p.prio ? 'Priority target set — right-click it again or press T to change it.' : p.order ? 'Walking to the marked spot.' : 'Right-click: walk (ground) or priority (enemy).'; }
    }

    // ------------------------------------------------------------------ modes
    const modeText = () => tw(modeText0());
    const modeText0 = () => {
      if (!mode) return ''; if (mode.kind === 'card') { const sp = specs()[mode.id], d = defOf(mode.id); return `Placing ${SP.displayName(sp)} — ${d.cat === 'pet' ? 'click your deployment zone' : AIM_HELP(d.aim)}`; }
      if (mode.kind === 'aim') { const u = petUnit(mode.uid), a = u && u.abil[mode.slot]; return a ? `${a.name} (${mode.slot.toUpperCase()}) — ${AIM_NAME(a.aim)}: ${AIM_HELP(a.aim)}${u.cdq[mode.slot] > sim.t + 1e-6 && mode.slot !== 'r' ? ' · will be queued until ready' : ''}` : ''; }
      if (mode.kind === 'move') return 'Move — click where the Pet should walk'; return 'Priority target — click an enemy (or its Core)';
    };
    function setMode(m) {
      mode = m; selCard = m && m.kind === 'card' ? m.id : null; hover = null; input && input.setActive(!!m);
      root.querySelectorAll('.bt-card[data-id]').forEach(b => b.classList.toggle('sel', b.dataset.id === selCard));
      const b = $('btAim'); b.hidden = !m; if (m) $('btAimTxt').textContent = modeText();
      if (infoOn) { $('btInfo').dataset.k = ''; updateInfo(); }
    }
    function cancelMode() { if (mode) { setMode(null); return true; } return false; }
    function selectSlot(i) { if (ended || paused) return; const v = C.sim.view(sim, 'a'), h = v.hand[i]; if (!h) return; au.play('toast'); if (mode && mode.kind === 'card' && mode.id === h.id) setMode(null); else setMode({ kind: 'card', id: h.id }); }
    function selectSlotKeep(i) { const v = C.sim.view(sim, 'a'), h = v.hand[i]; if (!h || ended || paused) return; if (selCard !== h.id) { au.play('toast'); setMode({ kind: 'card', id: h.id }); } }
    function startAim(slot) {
      const u = petUnit(selUid); if (!u || ended || paused) return; if (!u.abil || !u.abil[slot]) { say('This Pet has no ' + slot.toUpperCase() + ' ability (Limited Combat Kit).', 'bad'); return; }
      if (mode && mode.kind === 'aim' && mode.slot === slot) { setMode(null); return; }
      if (slot === 'r' && u.charge < 1 - 1e-9) { say(`Ultimate charging (${Math.floor(u.charge * 100)}%).`, 'bad'); au.play('error'); return; }
      setMode({ kind: 'aim', uid: u.uid, slot });
    }
    function startOrder(kind) { const u = petUnit(selUid); if (!u || ended || paused) return; if (mode && mode.kind === kind) { setMode(null); return; } setMode({ kind, uid: u.uid }); }
    function stopSel() { if (selUid) { C.sim.command(sim, { side: 'a', type: 'stop', uid: selUid }); au.play('slide'); } }
    function cycle(dir) { const v = C.sim.view(sim, 'a'); if (!v.pets.length) return; let i = v.pets.findIndex(p => p.uid === selUid); i = (i + dir + v.pets.length) % v.pets.length; if (i < 0) i = 0; selectPet(v.pets[i].uid); }

    // ------------------------------------------------------------------ picking
    function pickUnit(cx, cy, pred, extra) {
      const r = scene.canvas.getBoundingClientRect(); let best = null, bd = 1e9;
      for (let i = 0; i < sim.units.length; i++) { const u = sim.units[i]; if (u.hp <= 0 || u.spawn > 0 || !pred(u)) continue; scene.project(u.x, topOf(u) * .5, u.z, P); const d = Math.hypot(r.left + P.x - cx, r.top + P.y - cy), lim = 22 + (extra == null ? fatPtr : extra) + (u.radius || .5) * 34; if (d < lim && d < bd) { bd = d; best = u; } }
      return best;
    }
    const coreAt = c => { if (!c) return null; for (const k of ['a', 'b']) { const co = sim.cores[k]; if (Math.hypot(c.x - co.x, c.z - co.z) < co.r + 0.5) return k; } return null; };
    const enemyAt = e => pickUnit(e.clientX, e.clientY, u => u.side === 'b', fat(e));
    const myPetAt = e => pickUnit(e.clientX, e.clientY, u => u.side === 'a' && u.kind === 'pet', fat(e));

    // ------------------------------------------------------------------ intents
    /** The aim for a pending Pet ability / support card from the pointer: a unit for chain/ally/enemy picks, else the ground point. */
    function aimFrom(cell, ptrEvt) {
      if (!mode) return null;
      if (mode.kind === 'aim') { const u = petUnit(mode.uid), a = u && u.abil[mode.slot]; if (!a) return null; if (a.aim === 'chain') { const t = pickUnit(ptrEvt.x, ptrEvt.y, q => (a.ally ? q.side === 'a' : q.side === 'b') && q.hp > 0); return t ? { tuid: t.uid } : null; } if (a.aim === 'self') return {}; return cell ? { x: cell.x, z: cell.z } : null; }
      if (mode.kind === 'card') { const d = defOf(mode.id); if (d.place === 'ally' || d.place === 'enemy') { const t = pickUnit(ptrEvt.x, ptrEvt.y, q => (d.place === 'ally' ? q.side === 'a' && q.kind === 'pet' : q.side === 'b')); return t ? { tuid: t.uid } : null; } return cell ? { x: cell.x, z: cell.z } : {}; }
      return null;
    }
    function onConfirm(cell, e) {
      if (!mode || ended || paused) return; const pe = e ? { x: e.clientX, y: e.clientY } : ptr;
      if (mode.kind === 'card') {
        const d = defOf(mode.id), aim = aimFrom(cell, pe); if (d.place !== 'none' && !cell && !(aim && aim.tuid)) return; const x = cell ? cell.x : 0, z = cell ? cell.z : 0;
        const r = C.sim.canDeploy(sim, 'a', mode.id, x, z, aim || undefined); if (!r.ok) { say(r.reason, 'bad'); au.play('error'); return; }
        C.sim.command(sim, { side: 'a', type: 'deploy', id: mode.id, x, z, aim: aim || undefined }); setMode(null); au.play('thump'); return;
      }
      if (mode.kind === 'aim') {
        const u = petUnit(mode.uid); if (!u) { setMode(null); return; } const aim = aimFrom(cell, pe), a = u.abil[mode.slot]; if (!aim && a.aim !== 'self') { say(a.aim === 'chain' ? (a.ally ? 'Pick an ally.' : 'Pick an enemy.') : 'Aim somewhere on the board.', 'bad'); return; }
        const r = C.abil.check(sim, u, mode.slot, aim); if (!r.ok) { say(r.reason, 'bad'); au.play('error'); return; }
        C.sim.command(sim, { side: 'a', type: 'ability', uid: u.uid, slot: mode.slot, aim }); const slot = mode.slot; setMode(null); au.play(slot === 'r' ? 'levelup' : 'whoosh'); return;
      }
      if (mode.kind === 'move') { const u = petUnit(mode.uid); if (!u || !cell) return; const r = C.sim.canMove(sim, 'a', u.uid, cell.x, cell.z); if (!r.ok) { say(r.reason, 'bad'); au.play('error'); return; } C.sim.command(sim, { side: 'a', type: 'move', uid: u.uid, x: cell.x, z: cell.z }); setMode(null); au.play('slide'); return; }
      if (mode.kind === 'target') { const u = petUnit(mode.uid); if (!u) return; issueTarget(u, e ? enemyAt(e) : null, cell, true); }
    }
    function issueTarget(u, en, cell, keepMode) {
      const ck = coreAt(cell); let tuid = en ? en.uid : (ck === 'b' ? 'core' : null);
      if (tuid == null) { say('Click an enemy or the enemy Core.', 'bad'); return false; }
      const r = C.sim.canTarget(sim, 'a', u.uid, tuid); if (!r.ok) { say(r.reason, 'bad'); au.play('error'); return false; }
      C.sim.command(sim, { side: 'a', type: 'target', uid: u.uid, tuid }); if (keepMode) setMode(null); au.play('lockset'); return true;
    }
    function onSelect(e, cell) {
      if (ended || paused) return null; const p = myPetAt(e);
      if (p) { if (selUid !== p.uid) { selectPet(p.uid); au.play('toast'); } return 'pet'; }
      if (selUid && fat(e)) { orderAt(e, cell); return null; } // touch: with a Pet selected, a tap on the ground walks it, a tap on an enemy prioritises it; deselect with the × in its panel
      if (selUid) selectPet(0); return null;
    }
    function orderAt(e, cell) {
      const u = petUnit(selUid); if (!u || ended || paused) return; const en = enemyAt(e), ck = coreAt(cell);
      if (en || ck === 'b') { issueTarget(u, en, cell, false); return; }
      if (!cell) return; const r = C.sim.canMove(sim, 'a', u.uid, cell.x, cell.z); if (!r.ok) { say(r.reason, 'bad'); au.play('error'); return; } C.sim.command(sim, { side: 'a', type: 'move', uid: u.uid, x: cell.x, z: cell.z }); au.play('slide');
    }
    const onOrder = (e, cell) => orderAt(e, cell), onDragOrder = (e, cell) => orderAt(e, cell);
    function doReshuffle() { if (ended || paused) return; C.sim.command(sim, { side: 'a', type: 'reshuffle' }); }
    function setPause(v) { if (ended) return; paused = v == null ? !paused : !!v; $('btPaused').hidden = !paused; if (paused) { setMode(null); } }
    function setHostile(v) { sim.hostile = !!v; const b = $('btHostile'); b.textContent = 'Dummies: ' + (sim.hostile ? 'fighting back' : 'passive'); b.classList.toggle('on', sim.hostile); }
    function onKey(k) {
      if (k.startsWith('slot')) selectSlot(+k.slice(4) - 1); else if (k === 'reshuffle') doReshuffle(); else if (k === 'pause') setPause();
      else if (k === 'escape') { if (selUid) selectPet(0); else setPause(); }
      else if (k === 'q' || k === 'e' || k === 'r') startAim(k); else if (k === 'move' || k === 'target') startOrder(k); else if (k === 'stop') stopSel();
      else if (k === 'next') cycle(1); else if (k === 'prev') cycle(-1);
      else if (k === 'confirm') { if (mode && ((mode.kind === 'aim' && petUnit(mode.uid) && petUnit(mode.uid).abil[mode.slot].aim === 'self') || (mode.kind === 'card' && defOf(mode.id).place === 'none'))) onConfirm(hover, null); }
    }

    // ------------------------------------------------------------------ frame
    const addFloat = (x, z, amt, crit, kind) => { for (let i = 0; i < floats.length; i++) { const f = floats[i]; if (!f.on) { f.on = true; f.x = x; f.z = z; f.amt = amt; f.crit = crit; f.kind = kind; f.t = 0; return; } } };
    const addRing = (x, z, hex) => { for (let i = 0; i < rings.length; i++) { const r = rings[i]; if (!r.on) { r.on = true; r.x = x; r.z = z; r.t = 0; r.hex = hex; return; } } };
    function processEvents() {
      const ev = sim.events;
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i];
        if (e.type === 'deploy') { const c = cache[e.id]; if (e.uid) { const u = sim.units.find(q => q.uid === e.uid); if (c && u) { c.appear = 0; c.dying = 0; c.h.group.visible = true; c.heading = Math.PI; addRing(u.x, u.z, TEAL); } } else if (e.x != null) addRing(e.x, e.z, GOLD); }
        else if (e.type === 'object') { const u = sim.units.find(q => q.uid === e.uid), c = cache[e.card]; if (c && u) { c.appear = 0; c.dying = 0; c.h.group.visible = true; addRing(u.x, u.z, GOLD); } }
        else if (e.type === 'attack') { const c = unitVis(e.uid); if (c) c.lunge = .2; }
        else if (e.type === 'hit') { const p = e.core ? sim.cores[e.core] : lastPos.get(e.to); if (p) { addFloat(p.x, p.z, e.amt, e.crit, e.side === 'a' ? 0 : 1); fx.flash(p.x, 0.9, p.z, e.crit ? GOLD : HIT_COL[(sim.units.find(q => q.uid === e.from) || {}).hit] || IVORY, e.crit ? 0.6 : 0.4); } if (e.core) au.play('crack'); }
        else if (e.type === 'heal') { const p = lastPos.get(e.to); if (p) { addFloat(p.x, p.z, e.amt, false, 2); fx.flash(p.x, 0.9, p.z, MOSS, 0.5); } }
        else if (e.type === 'death') {
          if (e.kind === 'pet') { const c = cache[e.card]; if (c) { c.dying = T().pet.recallTime; c.dyingMax = c.dying; c.dx = e.x; c.dz = e.z; c.spin = 0; fx.column(e.x, e.z, e.side === 'a' ? TEAL : RED, T().pet.recallTime); addRing(e.x, e.z, e.side === 'a' ? TEAL : RED); au.play('slide'); } }
          else if (e.kind === 'dummy') { const d = dummyVis(e.uid); if (d) d.group.visible = false; au.play('whoosh'); fx.flash(e.x, 0.8, e.z, IVORY, 0.7); }
          else { const c = cache[e.card]; if (c) { c.dying = 0.3; c.dyingMax = 0.3; c.dx = e.x; c.dz = e.z; fx.flash(e.x, 0.6, e.z, GOLD, 0.6); } }
        }
        else if (e.type === 'denied') { if (e.side === 'a') say(e.reason, 'bad'); }
        else if (e.type === 'reshuffle') au.play('lockset');
        else if (e.type === 'cast') { fx.telegraph(e.shape, e.side === 'a' ? (e.slot === 'r' ? GOLD : TEAL) : RED, Math.max(0.2, e.windup)); au.play(e.slot === 'r' ? 'levelup' : 'whoosh'); }
        else if (e.type === 'telegraph') { fx.telegraph({ t: 'circle', x: e.x, z: e.z, r: e.r }, e.side === 'a' ? GOLD : RED, Math.max(0.2, e.windup)); }
        else if (e.type === 'burst') { fx.flash(e.shape.x != null ? e.shape.x : 0, 0.6, e.shape.z != null ? e.shape.z : 0, e.slot === 'r' ? GOLD : IVORY, e.shape.r ? Math.min(2.4, e.shape.r) : 0.8); }
        else if (e.type === 'slam') { fx.flash(e.x, 0.5, e.z, GOLD, e.r); au.play('crack'); }
        else if (e.type === 'beam') fx.beam(e.pts, e.kind === 'chain' ? 0xffe066 : 0x9fd6ff);
        else if (e.type === 'queued') { say('Queued — it fires when the cooldown ends.', ''); au.play('lockset'); }
        else if (e.type === 'interrupted') say('Cast interrupted.', 'bad');
        else if (e.type === 'grapple') { say('Grappled!', ''); au.play('thump'); }
        else if (e.type === 'eject') fx.flash(e.x, 0.6, e.z, IVORY, 0.6);
        else if (e.type === 'revive') { say('A fallen Pet returns to the deck.', ''); au.play('confirm'); }
        else if (e.type === 'rewind') { say('Time slips backwards.', ''); au.play('slide'); }
        else if (e.type === 'orderend' && e.side === 'a' && e.uid === selUid) selKey = '';
        else if (e.type === 'prioend' && e.side === 'a' && e.uid === selUid) { selKey = ''; say(`Priority target ended (${e.why}).`, ''); }
      }
      ev.length = 0;
    }
    function unitVis(uid) { const u = sim.units.find(x => x.uid === uid); if (!u) return null; return u.kind === 'dummy' ? dummyVis(uid) : cache[u.card]; }
    function dummyVis(uid) { const u = sim.units.find(x => x.uid === uid); const i = u ? u.spot : -1; if (i < 0) { for (let k = 0; k < cache.dummies.length; k++) if (cache.dummies[k].uid === uid) return cache.dummies[k]; return null; } return cache.dummies[i]; }
    const angLerp = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
    function frame(dt, tt) {
      if (disposed) return; const tick = T().step; frameNo++;
      if (!paused && !ended) { acc = Math.min(acc + dt, .25); let n = 0; while (acc >= tick && n < 5) { C.sim.step(sim); acc -= tick; n++; state.steps++; refreshPos(); processEvents(); if (sim.over) break; } if (n === 5) acc = 0; }
      else acc = 0;
      const alpha = paused ? 1 : Math.min(1, acc / tick), calm = reduced();
      // units and objects
      for (let i = 0; i < sim.units.length; i++) {
        const u = sim.units[i]; let p = lastPos.get(u.uid); if (!p) { p = { x: 0, z: 0 }; lastPos.set(u.uid, p); } p.x = u.x; p.z = u.z;
        if (u.kind === 'dummy') { const d = cache.dummies[u.spot]; d.uid = u.uid; d.group.visible = true; d.group.position.set(u.x, 0, u.z); continue; }
        const c = cache[u.card]; if (!c) continue; c.seen = frameNo; const g = c.h.group; g.visible = true;
        const x = u.px + (u.x - u.px) * alpha, z = u.pz + (u.z - u.pz) * alpha, moved = Math.hypot(u.x - u.px, u.z - u.pz) > 1e-4, fly = u.obj === 'blade' || u.obj === 'drone';
        if (u.kind === 'pet' || u.ai === 'rover') {
          if (moved) c.heading = angLerp(c.heading, Math.atan2(u.x - u.px, u.z - u.pz), .25); else if (u.target) { const tp = u.target.kind === 'core' ? sim.cores[u.target.side] : sim.units.find(q => q.uid === u.target.uid); if (tp && Math.hypot(tp.x - u.x, tp.z - u.z) > .01) c.heading = angLerp(c.heading, Math.atan2(tp.x - u.x, tp.z - u.z), .2); }
        } else if (moved) c.heading = angLerp(c.heading, Math.atan2(u.x - u.px, u.z - u.pz), .2); else if (u.kind === 'barrier') c.heading = Math.PI;
        c.appear = Math.min(1, c.appear + dt / T().pet.deployDelay); if (c.lunge > 0) c.lunge = Math.max(0, c.lunge - dt);
        const lunge = calm ? 0 : Math.sin(Math.PI * (1 - c.lunge / .2)) * (c.lunge > 0 ? .28 : 0), bob = calm || !moved ? 0 : Math.abs(Math.sin(tt * (u.speed || 2) * 5)) * .08, hover_ = fly ? 0.9 + (calm ? 0 : Math.sin(tt * 3 + u.uid) * .08) : (u.held ? 0.9 : 0);
        g.position.set(x + Math.sin(c.heading) * lunge, bob + hover_, z + Math.cos(c.heading) * lunge); g.rotation.y = c.heading;
        g.scale.setScalar(u.spawn > 0 ? .25 + .75 * c.appear : 1);
      }
      // zone models (relics, oddities, a slam, a ward) stand where their effect is
      for (let i = 0; i < sim.zones.length; i++) { const z = sim.zones[i]; if (!z.card) continue; const c = cache[z.card]; if (!c) continue; c.seen = frameNo; const g = c.h.group; g.visible = true; g.position.set(z.x, 0, z.z); g.rotation.y = calm ? 0 : tt * .6; g.scale.setScalar(Math.min(1, .3 + (z.until - sim.t) * 2) * (z.kind === 'visual' && z.follow ? .55 : 1)); if (z.follow) g.position.y = 1.5; }
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i]; if (c.seen === frameNo) continue; const g = c.h.group;
        if (c.dying > 0) { // the recall: lifted, spun and drawn up into light
          c.dying -= dt; const k = 1 - Math.max(0, c.dying) / (c.dyingMax || .7);
          if (c.kind === 'pet' && !calm) { g.position.set(c.dx, k * 1.6, c.dz); g.rotation.y += dt * 9; g.scale.setScalar(Math.max(.02, 1 - k * .9)); } else g.scale.setScalar(Math.max(.02, 1 - k));
          if (c.dying <= 0) g.visible = false;
        } else g.visible = false;
      }
      ['a', 'b'].forEach(k => { const cc = cache['core' + k], core = sim.cores[k], f = core.hp / core.max; cc.crystal.rotation.y = calm ? 0 : tt * .5; cc.em.emissiveIntensity = .25 + .9 * f; cc.crystal.visible = core.hp > 0; });
      let np = 0; for (let i = 0; i < sim.proj.length; i++) { const p = sim.proj[i]; fx.proj(i, p.px + (p.x - p.px) * alpha, .75, p.pz + (p.z - p.pz) * alpha, HIT_COL[p.hit] || IVORY); np++; } fx.endProj(np);
      drawDecals(dt, tt); fx.update(dt);
      buildHandMaybe(); updateHud(); drawOverlay(dt);
      if (sim.over && !ended) finish();
    }
    function refreshPos() { /* positions are read each frame; kept for tests that hook the step */ }
    function buildHandMaybe() { const v = C.sim.view(sim, 'a'); const key = v.hand.map(h => h.id).join(','); if (key !== handKey) buildHand(); }

    // ------------------------------------------------------------------ ground decals (all through the pooled effects)
    function drawShape(sh, ok, strong) {
      const hex = ok ? TEAL : RED, a = strong ? .3 : .2;
      if (sh.t === 'circle') { fx.disc(sh.x, sh.z, sh.r, hex, a); fx.ring(sh.x, sh.z, sh.r, hex, .85); }
      else if (sh.t === 'line') { fx.rect(sh.x1, sh.z1, sh.x2, sh.z2, sh.w, hex, a + .04); }
      else if (sh.t === 'cone') fx.sector(sh.x, sh.z, sh.dx, sh.dz, sh.len, sh.half, hex, a + .04);
      else if (sh.t === 'chain') { fx.ring(sh.tx, sh.tz, .8, hex, .9); fx.rect(sh.x, sh.z, sh.tx, sh.tz, .07, hex, .7); fx.ring(sh.tx, sh.tz, sh.r, hex, .25); }
    }
    function drawDecals(dt, tt) {
      fx.begin();
      // zones and walls that exist
      for (let i = 0; i < sim.zones.length; i++) { const z = sim.zones[i]; if (z.kind === 'visual') { if (!z.follow) fx.ring(z.x, z.z, z.r, GOLD, .35); continue; } const own = z.side === 'a'; fx.disc(z.x, z.z, z.r, z.distort ? VIOLET : z.heal ? MOSS : own ? TEAL : RED, .1); fx.ring(z.x, z.z, z.r, z.distort ? VIOLET : z.heal ? MOSS : own ? TEAL : RED, .55); }
      for (let i = 0; i < sim.walls.length; i++) { const w = sim.walls[i]; for (let k = 0; k < w.cells.length; k++) fx.slab(w.cells[k] % sim.w, (w.cells[k] / sim.w) | 0); }
      for (let i = 0; i < rings.length; i++) { const r = rings[i]; if (!r.on) continue; r.t += dt; if (r.t > .8) { r.on = false; continue; } const k = r.t / .8; fx.ring(r.x, r.z, .4 + k * 1.1, r.hex, .85 * (1 - k)); }
      fx.drawTelegraphs();
      const sel = selUid && petUnit(selUid);
      if (sel) { // selection ring, order line and priority marker
        const pulse = reduced() ? 1 : 1 + Math.sin(tt * 5) * .06; fx.ring(sel.x, sel.z, (sel.radius + .35) * pulse, GOLD, .95); fx.ring(sel.x, sel.z, (sel.radius + .28) * pulse, GOLD, .5);
        if (sel.order) { fx.rect(sel.x, sel.z, sel.order.x, sel.order.z, .08, GOLD, .7); fx.ring(sel.order.x, sel.order.z, .42, GOLD, .9); }
        if (sel.prio) { const tp = sel.prio.kind === 'core' ? sim.cores[sel.prio.side] : sim.units.find(q => q.uid === sel.prio.uid); if (tp) { fx.rect(sel.x, sel.z, tp.x, tp.z, .06, RED, .45); fx.ring(tp.x, tp.z, (tp.radius || tp.r) + .5, RED, .95); } }
        if (dragCell && !mode) { fx.rect(sel.x, sel.z, dragCell.x, dragCell.z, .08, IVORY, .6); fx.ring(dragCell.x, dragCell.z, .4, IVORY, .8); }
      }
      if (mode && !ended) previewMode(sel);
      fx.end();
    }
    function previewMode(sel) {
      if (mode.kind === 'card') {
        const rows = T().arena.deploy.playerRows, d = defOf(mode.id), isPet = d.cat === 'pet';
        if (isPet || d.place === 'zone') fx.rect(0, rows[0] + (rows[1] - rows[0] + 1) / 2, sim.w, rows[0] + (rows[1] - rows[0] + 1) / 2, rows[1] - rows[0] + 1, TEAL, .08);
        const aim = aimFrom(hover, ptr); if (!hover && !(aim && aim.tuid) && d.place !== 'none') return;
        const r = C.sim.canDeploy(sim, 'a', mode.id, hover ? hover.x : 0, hover ? hover.z : 0, aim || undefined);
        if (isPet) { if (!hover) return; const cx = Math.floor(hover.x), cz = Math.floor(hover.z), t = C.translate(specs()[mode.id]); fx.rect(cx, cz + .5, cx + 1, cz + .5, 1, r.ok ? MOSS : RED, .4); fx.ring(cx + .5, cz + .5, t.range, r.ok ? IVORY : RED, .5); }
        else if (r.shape) drawShape(r.shape, r.ok, true);
      } else if (mode.kind === 'aim') {
        const u = petUnit(mode.uid); if (!u) return; const a = u.abil[mode.slot]; if (a.range) fx.ring(u.x, u.z, a.range, IVORY, .3);
        const aim = aimFrom(hover, ptr); const r = aim || a.aim === 'self' ? C.abil.check(sim, u, mode.slot, aim) : null; if (r && r.shape) drawShape(r.shape, r.ok, true);
        else if (a.aim === 'chain') { const t = pickUnit(ptr.x, ptr.y, q => (a.ally ? q.side === 'a' : q.side === 'b')); if (t) fx.ring(t.x, t.z, .8, RED, .7); }
      } else if (mode.kind === 'move' && sel && hover) { const r = C.sim.canMove(sim, 'a', sel.uid, hover.x, hover.z), cx = Math.floor(hover.x) + .5, cz = Math.floor(hover.z) + .5; fx.rect(sel.x, sel.z, cx, cz, .08, r.ok ? GOLD : RED, .6); fx.ring(cx, cz, .42, r.ok ? GOLD : RED, .9); }
      else if (mode.kind === 'target') { const t = pickUnit(ptr.x, ptr.y, q => q.side === 'b') || null, ck = hover ? coreAt(hover) : null; if (t) fx.ring(t.x, t.z, (t.radius || .5) + .5, RED, .95); else if (ck === 'b') fx.ring(sim.cores.b.x, sim.cores.b.z, sim.cores.b.r + .5, RED, .95); }
    }

    // ------------------------------------------------------------------ overlay (HP bars, floating numbers) — 2D, no allocation in the loop
    function sizeOver() { const r = field.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (over.width !== w || over.height !== h) { over.width = w; over.height = h; over.style.width = r.width + 'px'; over.style.height = r.height + 'px'; } return dpr; }
    function bar(x, y, w, f, col, back) { oc.fillStyle = 'rgba(11,10,9,.8)'; oc.fillRect(x - w / 2 - 1, y - 1, w + 2, 6); oc.fillStyle = col; oc.fillRect(x - w / 2, y, w * Math.max(0, f), 4); void back; }
    function drawOverlay(dt) {
      if (!scene) return; const dpr = sizeOver(); oc.setTransform(dpr, 0, 0, dpr, 0, 0); oc.clearRect(0, 0, over.width, over.height);
      for (let i = 0; i < sim.units.length; i++) {
        const u = sim.units[i]; if (u.hp <= 0 || u.spawn > 0) continue;
        scene.project(u.px + (u.x - u.px) * .5, u.kind === 'dummy' ? 1.7 : topOf(u) + .3 + (u.held ? .9 : 0) + (u.obj === 'blade' || u.obj === 'drone' ? .9 : 0), u.pz + (u.z - u.pz) * .5, P);
        bar(P.x, P.y, u.kind === 'dummy' ? 34 : u.kind === 'pet' ? 38 : 30, u.hp / u.max, u.side === 'a' ? '#86b07c' : '#bf5a45');
        if (u.kind === 'pet' && u.st && u.st.guard && u.st.guard.until > sim.t) { oc.fillStyle = '#9fd6ff'; oc.fillRect(P.x - 19, P.y - 4, 38 * Math.min(1, u.st.guard.amt / u.max), 2); }
        if (u.kind === 'pet' && u.st) { const flags = (u.st.stun > sim.t ? 'Z' : '') + (u.st.root > sim.t ? 'R' : '') + (u.st.slow && u.st.slow.until > sim.t ? 'S' : '') + (u.held ? 'H' : '') + (u.st.taunt && u.st.taunt.until > sim.t ? '!' : ''); if (flags) { oc.fillStyle = '#e0a24a'; oc.font = '600 10px "IBM Plex Mono", monospace'; oc.textAlign = 'center'; oc.fillText(flags, P.x, P.y - 7); } }
      }
      for (let k = 0; k < 2; k++) { const kk = k ? 'b' : 'a', core = sim.cores[kk]; scene.project(core.x, 2.6, core.z, P); bar(P.x, P.y, 70, core.hp / core.max, kk === 'a' ? '#7fd0d2' : '#bf5a45'); oc.fillStyle = '#ece3cf'; oc.font = '600 11px "IBM Plex Mono", monospace'; oc.textAlign = 'center'; oc.fillText(Math.ceil(core.hp), P.x, P.y - 5); }
      for (let i = 0; i < floats.length; i++) {
        const f = floats[i]; if (!f.on) continue; f.t += dt; if (f.t > .9) { f.on = false; continue; } const k = f.t / .9; scene.project(f.x, 1.2 + (reduced() ? 0 : k * .9), f.z, P2);
        oc.globalAlpha = 1 - k * k; oc.fillStyle = f.kind === 2 ? '#9be08a' : f.crit ? '#ffc247' : f.kind === 0 ? '#ece3cf' : '#ff9a85'; oc.font = `${f.crit ? 700 : 600} ${f.crit ? 17 : 13}px "IBM Plex Mono", monospace`; oc.textAlign = 'center'; oc.fillText(f.kind === 2 ? '+' + f.amt : f.amt, P2.x, P2.y); oc.globalAlpha = 1;
      }
    }

    // ------------------------------------------------------------------ end of match
    function finish() {
      ended = true; setMode(null); selectPet(0); const o = sim.over, st = sim.stats.a, el = $('btEnd'), title = o.reason === 'breach' ? (o.winner === 'a' ? 'Core breached' : 'Your Core fell') : o.reason === 'draw' ? 'Time — nothing decided' : (o.winner === 'a' ? 'Time — you led' : 'Time');
      el.innerHTML = `<div class="s-matte hi pad"><span class="label">Practice complete</span><h2>${esc(title)}</h2><ul class="end-rows"><li><span>Time</span><b class="mono">${fmtTime(o.t)}</b></li><li><span>Damage to the enemy Core</span><b class="mono">${Math.round(st.coreDmg)}</b></li><li><span>Elixir spent</span><b class="mono">${sim.sides.a.spent}</b></li><li><span>Deployments</span><b class="mono">${Object.values(sim.sides.a.deployCount).reduce((a, b) => a + b, 0)}</b></li></ul>
        <p class="tiny dim">Training changes nothing: no rewards, no rating, no change to any specimen.</p><div class="hub-actions"><button class="btn primary" id="btAgain">${A.icon('play')}Train again</button><button class="btn ghost" id="btBack">Back to Combat</button></div></div>`;
      el.hidden = false; $('btAgain').onclick = () => ui.go('battle'); $('btBack').onclick = () => ui.go('combat');
    }

    // ------------------------------------------------------------------ wiring
    root.addEventListener('pointerdown', e => { const b = e.target.closest('.bt-card[data-slot]'); if (!b || e.button !== 0) return; selectSlotKeep(+b.dataset.slot); input && input.beginDrag(e); });
    root.addEventListener('click', e => {
      const b = e.target.closest('.bt-card[data-slot]'); if (b && e.detail === 0) { selectSlot(+b.dataset.slot); return; } // keyboard activation
      if (e.target.closest('[data-desel]')) { selectPet(0); return; }
      if (e.target.closest('#btRotX')) { try { sessionStorage.setItem('av.rotTip', '1'); } catch (_) { } $('btRot').hidden = true; return; }
      const ab = e.target.closest('.ab[data-slot]'); if (ab) { startAim(ab.dataset.slot); return; }
      const od = e.target.closest('[data-ord]'); if (od) { if (od.dataset.ord === 'stop') stopSel(); else startOrder(od.dataset.ord); return; }
      const w = e.target.closest('button'); if (!w) return;
      if (w.id === 'btShuffle') doReshuffle(); else if (w.id === 'btPause') setPause(); else if (w.id === 'btResume') setPause(false); else if (w.id === 'btAimCancel') cancelMode(); else if (w.id === 'btHostile') setHostile(!sim.hostile);
      else if (w.id === 'btExit' || w.id === 'btQuit') { if (ended) ui.go('combat'); else { const was = paused; setPause(true); ui.confirm({ title: 'Leave training?', message: 'Nothing is saved or lost in training.', confirmText: 'Leave' }).then(ok => { if (ok) ui.go('combat'); else if (!was) setPause(false); }); } }
    });
    const vis2 = () => { if (document.hidden && C && AV.state.get().combat.settings.autoPause && sim && !ended) setPause(true); };
    document.addEventListener('visibilitychange', vis2); cleanups.push(() => document.removeEventListener('visibilitychange', vis2));
    const infoBtn = document.createElement('button'); infoBtn.className = 'btn small ghost bt-infobtn'; infoBtn.innerHTML = A.icon('info') + 'Numbers'; infoBtn.onclick = () => { infoOn = !infoOn; $('btInfo').hidden = !infoOn; if (infoOn) { $('btInfo').dataset.k = ''; updateInfo(); } }; field.appendChild(infoBtn);
    { let seen = false; try { seen = sessionStorage.getItem('av.rotTip') === '1'; } catch (_) { } $('btRot').hidden = seen; const tt = setTimeout(() => { const r = $('btRot'); if (r) r.hidden = true; }, 9000); cleanups.push(() => clearTimeout(tt)); }
    boot().catch(err => { console.error('[battle] failed to start', err); $('btLoad').innerHTML = `<b>The arena could not start.</b><small>${esc(err && err.message || err)}</small>`; });
    return () => {
      disposed = true; cleanups.forEach(f => f()); if (input) input.dispose(); if (scene) scene.dispose(); AV.combat.live = null; clearTimeout(msgT);
    };
  }
  ui.register('battle', { render });
})();
