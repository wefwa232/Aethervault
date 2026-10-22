/* AETHERVAULT — Combat hub: your active deck, the Training Arena, and what is still to come. Unfinished modes are shown but disabled. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, SP = AV.specimen, A = AV.art, ui = AV.ui, C = AV.combat;
  const esc = U.esc;

  const limited = V => V.rows.filter(r => r.ok && r.def && r.def.cat === 'pet' && r.def.limited).length;
  function render(root) {
    const s = AV.state.get(), c = s.combat;
    if (!c) { root.innerHTML = `<div class="panel pad"><h2>Combat data unavailable</h2><p class="muted">The save could not be upgraded for combat. Your collection is untouched; restart to retry (raw backup: <code>${AV.state.BACKUP_KEY_P5}</code>).</p></div>`; return; }
    const draw = () => {
      const deck = c.decks.find(k => k.id === c.activeDeck), V = deck ? C.deck.validate(s, deck.entries) : null, T = C.tuning, gl = AV.stage && AV.stage.supported && AV.stage.supported();
      const div = (T.ladder.find(d => d.id === c.division) || T.ladder[0]).name;
      const can = !!(V && V.practice) && gl;
      const why = !gl ? 'Combat needs the 3D renderer (Settings → 3D presentation → Low, Medium or High). The 2D board arrives later.' : !deck ? 'Create a deck first.' : !V.practice ? 'Your active deck has no combat-ready specimens.' : '';
      const strip = V ? V.rows.map(r => r.spec ? `<span class="hs r-${SP.rarityOf(r.spec).id} ${r.ok ? '' : 'bad'}" title="${esc(SP.displayName(r.spec))}${r.ok ? '' : ' — ' + esc(r.reason)}">${A.render(r.spec)}</span>` : `<span class="hs bad" title="Missing specimen"></span>`).join('') : '';
      root.innerHTML = `<div class="cbhub">
        <header class="page-head"><div><span class="label">Archive trials</span><h1>Combat</h1><p class="muted">Real-time tactics: a hand of four specimens, Elixir, and a Core to defend. Your specimens fight as they are; nothing in a battle changes them.</p></div></header>
        <div class="hub-grid">
          <section class="s-matte hi pad hub-deck"><h3 class="sect">${A.icon('layers')}Active deck</h3>
            ${deck ? `<div class="hd-top"><b class="hd-name">${esc(deck.name)}</b><span class="mono ${V.valid ? 'ok' : ''}">${V.usable}/${T.hand.deck}</span><span class="muted">${V.valid ? 'ready for battle' : V.practice ? 'practice only until it holds 10' : 'no usable specimens'}</span></div>
              <div class="hd-strip">${strip}</div>${V.usable ? `<p class="tiny dim">Average cost ${V.avgCost} Elixir · ${Object.keys(V.roles).map(r => esc(C.defs.ROLES[r].name) + ' ' + V.roles[r]).join(' · ')}</p>` : ''}${limited(V) ? `<p class="tiny"><span class="kit">Limited Combat Kit</span> ${limited(V)} of these Pets have no Q/E/R yet — they fight with their basic attack, orders and targeting.</p>` : ''}${V.issues.length ? `<ul class="issues">${V.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`
              : ui.empty('layers', 'No deck yet', 'Build a deck of ten specimens to take into battle.')}
            <div class="hub-actions"><button class="btn ${deck ? 'ghost' : 'primary'}" data-go="deck">${A.icon('edit')}${deck ? 'Edit decks' : 'Build a deck'}</button>
              <button class="btn primary major" data-go="battle" ${can ? '' : 'disabled'} title="${esc(why)}">${A.icon('play')}Training arena</button></div>
            ${why ? `<p class="tiny ${gl ? 'dim' : 'bad-txt'}">${esc(why)}</p>` : '<p class="tiny dim">Practice against a sparring post and an empty Core. No rewards and no rating — it is for learning the hand and the Elixir.</p>'}</section>
          <section class="s-matte pad hub-how"><h3 class="sect">${A.icon('info')}How a battle works</h3>
            <ul class="how"><li><b>Hand.</b> Four of your ten specimens at a time. Every deployment draws a whole new hand; cards you passed over are held back for one draw.</li>
              <li><b>Elixir.</b> Starts at ${T.elixir.start}, refills over time, pauses at ${T.elixir.max}. Each specimen has its own cost. It speeds up at 1:15 and again in the Final Surge (last 15 s).</li>
              <li><b>Placing.</b> Pick a card (click, or keys 1–4), then click your half of the board. Esc, right-click or the Cancel button backs out.</li>
              <li><b>Commanding.</b> Click a Pet to select it. Right-click the ground to walk it (5 s between orders), or an enemy to make it a priority target. <b>Q</b>, <b>E</b> and <b>R</b> are its abilities: each is aimed with a live preview and cancels the same way.</li>
              <li><b>Support cards</b> — weapons, shields, machines, relics and oddities — are played from the hand onto the field as their own objects and effects.</li>
              <li><b>Pets</b> stay on the field and fight on their own: they walk the bridge, pick a target and attack. A defeated Pet recovers for 12–20 s, and costs +1 Elixir more each time you redeploy it.</li>
              <li><b>Reshuffle</b> costs ${T.hand.reshuffleCost} Elixir and then needs a short rest.</li></ul></section>
          <section class="s-matte pad hub-soon"><h3 class="sect">${A.icon('timer')}Coming next</h3>
            <div class="soon"><button class="btn ghost" disabled>${A.icon('sword')}Ranked ladder</button><small>${esc(div)} · rating ${Math.round(c.rating)} — simulated opponents arrive in Combat C</small></div>
            <div class="soon"><button class="btn ghost" disabled>${A.icon('history')}Battle history</button><small>Compact records after each ranked match (Combat C)</small></div>
            <div class="soon"><button class="btn ghost" disabled>${A.icon('book')}Tutorial</button><small>A twelve-step walkthrough (Combat C)</small></div>
            </section>
        </div></div>`;
    };
    draw();
    root.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && !g.disabled) ui.go(g.dataset.go); });
    ui.sub('combat', draw); ui.sub('specimens', draw);
  }
  ui.register('combat', { render });
})();
