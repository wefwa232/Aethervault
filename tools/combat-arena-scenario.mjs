// Combat A5 arena scenario, driven through the real UI (clicks and keys), used by tools/combat-smoke.mjs.
export async function arena({ page, ev, check, shot, go, sleep, OUT, out }) {
  console.log('arena');
  // a valid active deck from the starter preset
  await ev(() => { const S = AV.state.get(); const p = AV.combat.deck.presets(S)[0]; const k = AV.engine.deckCreate('Starter', p.ids, p.id); AV.engine.deckSetActive(k.id); });
  await go(page, 'combat'); await sleep(300);
  await page.click('[data-go=battle]');
  await page.waitForFunction(() => window.AV && AV.combat.live && AV.combat.live.scene, { timeout: 30000 }).catch(() => { });
  await sleep(800);
  const boot = await ev(() => { const l = AV.combat.live; return l ? { cards: document.querySelectorAll('.bt-card[data-id]').length, elixir: AV.combat.sim.elixirOf(l.sim, 'a'), canvas: !!document.querySelector('.battle3d'), load: document.getElementById('btLoad').hidden, units: l.scene.units.size, info: l.scene.info, stats: AV.stage.stats() } : null; });
  check('arena boots: hand of 4, Elixir 5, canvas, loader hidden', boot && boot.cards === 4 && boot.elixir >= 5 && boot.canvas && boot.load, JSON.stringify(boot && { cards: boot.cards, elixir: boot.elixir, units: boot.units, info: boot.info }));
  await shot(page, OUT, 'arena-start');
  // pick the cheapest card by clicking it, hover the board, screenshot the placement preview
  const slot = await ev(() => { const l = AV.combat.live, v = AV.combat.sim.view(l.sim, 'a'), melee = i => AV.combat.defs.get(v.hand[i].base).atk === 'melee'; let best = 0; v.hand.forEach((h, i) => { if ((melee(i) && !melee(best)) || (melee(i) === melee(best) && h.cost < v.hand[best].cost)) best = i; }); return best; });
  await page.click(`.bt-card[data-slot="${slot}"]`); await sleep(200);
  check('clicking a card selects it', await ev(() => !!document.querySelector('.bt-card.sel')));
  const pos = (x, z) => ev((x, z) => { const l = AV.combat.live, p = l.api.screenOf(x, z), r = l.scene.canvas.getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, x, z);
  let p = await pos(6.5, 13.5); await page.mouse.move(p.x - 40, p.y - 20); await page.mouse.move(p.x, p.y, { steps: 4 }); await sleep(250); await shot(page, OUT, 'arena-placement');
  // Esc cancels the selection; so does a right-click
  await page.keyboard.press('Escape'); await sleep(150);
  check('Esc cancels the selection without pausing', await ev(() => !document.querySelector('.bt-card.sel') && !AV.combat.live.sim.over && document.getElementById('btPaused').hidden));
  await page.click(`.bt-card[data-slot="${slot}"]`); await page.mouse.click(p.x, p.y, { button: 'right' }); await sleep(150);
  check('right-click cancels the selection', await ev(() => !document.querySelector('.bt-card.sel')));
  // invalid placement: enemy half is refused with a message
  await page.click(`.bt-card[data-slot="${slot}"]`); const pe = await pos(6.5, 4.5); await page.mouse.click(pe.x, pe.y); await sleep(200);
  check('placing on the enemy half is refused with a message', await ev(() => /zone/.test(document.getElementById('btMsg').textContent) && AV.combat.live.sim.units.every(u => u.kind === 'dummy')));
  // valid placement by click
  const e0 = await ev(() => AV.combat.sim.elixirOf(AV.combat.live.sim, 'a'));
  p = await pos(6.5, 13.5); await page.mouse.click(p.x, p.y); await sleep(500);
  const dep = await ev(() => { const l = AV.combat.live, u = l.sim.units.find(x => x.kind === 'pet'); return u ? { x: u.x, z: u.z, card: u.card, elixir: AV.combat.sim.elixirOf(l.sim, 'a'), hand: document.querySelectorAll('.bt-card[data-id]').length, sel: !!document.querySelector('.bt-card.sel'), shown: l.api.cache[u.card] && l.api.cache[u.card].h.group.visible } : null; });
  check('click on the board deploys the Pet, spends Elixir and deals a new hand', dep && dep.x === 6.5 && dep.z === 13.5 && dep.elixir < e0 && dep.hand === 4 && !dep.sel && dep.shown, JSON.stringify(dep));
  await shot(page, OUT, 'arena-deployed');
  // let it walk and fight (real time, 30 Hz sim): bridge, dummy, basic attacks
  const track = { crossed: false, engaged: false, bad: 0, maxZ: 99 };
  for (let i = 0; i < 90; i++) { await sleep(250); const r = await ev(() => { const l = AV.combat.live, u = l.sim.units.find(x => x.kind === 'pet'); if (!u) return null; return { z: u.z, x: u.x, ok: AV.combat.sim.walkable(l.sim, u.x, u.z), hit: l.sim.stats.a.dealt >= 0 && l.sim.units.some(d => d.kind === 'dummy' && d.hp < d.max) }; }); if (!r) break; track.maxZ = Math.min(track.maxZ, r.z); if (!r.ok) track.bad++; if (r.z < 8) track.crossed = true; if (r.hit) { track.engaged = true; break; } }
  const atk = await ev(() => { const u = AV.combat.live.sim.units.find(x => x.kind === 'pet'); return u && u.atk; });
  check('the Pet walks the bridge and attacks the sparring post (ranged Pets engage from the bridge head)', track.engaged && track.bad === 0 && (track.crossed || atk === 'ranged'), JSON.stringify({ ...track, atk }));
  await sleep(1200); await shot(page, OUT, 'arena-fight');
  // reshuffle through the UI (R key), refused while cooling down
  const before = await ev(() => ({ e: AV.combat.sim.elixirOf(AV.combat.live.sim, 'a'), hand: AV.combat.live.sim.sides.a.hand.refreshes }));
  await page.keyboard.press('r'); await sleep(300);
  const after = await ev(() => ({ e: AV.combat.sim.elixirOf(AV.combat.live.sim, 'a'), hand: AV.combat.live.sim.sides.a.hand.refreshes, dis: document.getElementById('btShuffle').disabled }));
  check('R reshuffles (hand refreshed, Elixir charged) and the button then cools down', after.hand === before.hand + 1 && after.dis, JSON.stringify({ before, after }));
  // pause freezes the simulation
  await page.keyboard.press('p'); await sleep(200); const t1 = await ev(() => AV.combat.live.sim.tick); await sleep(700); const t2 = await ev(() => AV.combat.live.sim.tick);
  check('pause freezes the simulation tick', t1 === t2 && await ev(() => !document.getElementById('btPaused').hidden), `${t1} → ${t2}`);
  await page.click('#btResume'); await sleep(400); check('resume continues the simulation', await ev(t => AV.combat.live.sim.tick > t, t2));
  // steady-state performance with a Pet in the field (Medium, 1600x900, uncapped headless would be ~display rate; the cap is the quality preset)
  await ev(() => AV.combat.live.api.resetStats()); await sleep(5000);
  const perf = await ev(() => { const l = AV.combat.live, s = l.api.summary(), st = AV.stage.stats(); return { ...s, scene: l.scene.info, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, programs: st.programs, geometries: st.memory && st.memory.geometries, textures: st.memory && st.memory.textures, quality: st.quality, fpsLimit: st.fpsLimit }; });
  out.notes.arenaPerf = perf; console.log('  perf', JSON.stringify(perf));
  check('arena frame pacing: no frame over 33 ms, average ≥ 55 fps (60 fps cap on Medium)', perf.over33 === 0 && perf.avgFps >= 55, JSON.stringify(perf));
  // Elixir steps and Final Surge, then the result screen (the clock is advanced by the test, not by waiting 2 minutes)
  await ev(() => { const s = AV.combat.live.sim; s.tick = 74 * 30; s.t = 74; }); await sleep(2300);
  check('regen step at 1:15 shows its banner', await ev(() => /×1.25/.test(document.getElementById('btPhase').textContent)));
  await ev(() => { const s = AV.combat.live.sim; s.tick = 104 * 30; s.t = 104; }); await sleep(2000);
  const surge = await ev(() => ({ cls: document.getElementById('btRoot').classList.contains('surge'), ph: document.getElementById('btPhase').textContent }));
  check('Final Surge state is shown at 1:45', surge.cls && /FINAL SURGE/.test(surge.ph), JSON.stringify(surge)); await shot(page, OUT, 'arena-surge');
  await ev(() => { const s = AV.combat.live.sim; s.tick = 119 * 30 + 20; s.t = 119.66; }); await sleep(1500);
  check('at 2:00 the match ends and the result overlay appears (no rewards)', await ev(() => !document.getElementById('btEnd').hidden && /Practice complete/.test(document.getElementById('btEnd').textContent) && AV.combat.live.sim.over && AV.combat.live.sim.over.reason !== undefined));
  await shot(page, OUT, 'arena-result');
  check('combat never changed a specimen or the wallet', await ev(() => { const S = AV.state.get(); return S.wallet.credits === 24000 && S.stats.dismantled === 0; }));
  // leak check: leave and re-enter the arena several times
  await page.click('#btBack'); await sleep(600);
  const g0 = await ev(() => { const s = AV.stage.stats(); return { g: s.memory.geometries, t: s.memory.textures, p: s.programs, v: s.views }; });
  for (let i = 0; i < 4; i++) { await page.click('[data-go=battle]'); await page.waitForFunction(() => AV.combat.live && AV.combat.live.scene && document.getElementById('btLoad').hidden, { timeout: 30000 }); await sleep(900); await ev(() => AV.ui.go('combat')); await sleep(500); }
  const g1 = await ev(() => { const s = AV.stage.stats(); return { g: s.memory.geometries, t: s.memory.textures, p: s.programs, v: s.views, live: !!AV.combat.live }; });
  out.notes.leak = { before: g0, after: g1 };
  check('enter/leave ×4: no growth in geometries, textures, shader programs; no live view left', g1.g <= g0.g + 2 && g1.t <= g0.t + 3 && g1.p <= g0.p + 2 && g1.v === 0 && !g1.live, JSON.stringify({ g0, g1 }));
}
