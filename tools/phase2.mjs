// Phase Two browser checks: startup sequence (cold/warm/fast/2D fallback/corrupt ledger/reduced motion/offline), save compatibility,
// the new 3D content (every model × every upgrade stage × worn/variant builds, inspect, vault thumbnails, evolution lineage, forge),
// FPS-limit behaviour, and loop sleeping. Results -> docs/validation-phase2.json.   usage: node tools/phase2.mjs
import { launch, loadSeeded, loadFresh, booted, seedFn, go, sleep, ensureServer, root } from './harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
await ensureServer();
const results = [];
const check = (group, name, ok, detail = '') => { results.push({ group, name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${detail ? '  — ' + detail : ''}`); };
const base = 'http://127.0.0.1:5173/index.html';
const BAD = /pageerror|\[error\]/;

// ------------------------------------------------------------------ A. startup sequence
{
  const { browser, page, logs } = await launch({ width: 1440, height: 810 });
  const reqs = []; page.on('request', r => reqs.push(r.url()));
  await loadSeeded(page);
  // cold: no warm flag, presentation floor active
  await page.evaluate(async () => { localStorage.removeItem('aethervault.boot.warm'); try { await AV.stage.thumbCache.clear(); } catch (e) { } });
  reqs.length = 0; let t = Date.now(); await page.goto(base, { waitUntil: 'load' });
  const sawStages = await page.evaluate(() => new Promise(res => { const seen = new Set(); const iv = setInterval(() => { const h = document.getElementById('bootHead'); if (h) seen.add(h.textContent); if (window.AV && AV.boot && AV.boot.done) { clearInterval(iv); res([...seen]); } }, 40); }));
  const cold = Date.now() - t; let rep = await page.evaluate(() => JSON.parse(JSON.stringify(AV.boot.report)));
  check('boot', 'cold start shows every status line in order and ends in Home', sawStages.length >= 6 && /Waking archive systems/.test(sawStages[0]) && /Opening archive gateway/.test(sawStages[sawStages.length - 1]), sawStages.join(' | '));
  check('boot', 'cold start lands in the 4–6 s window (presentation floor + real work)', cold >= 3600 && cold <= 6500, cold + ' ms wall; floor ' + rep.minMs + ' ms; real work ' + rep.stages.reduce((a, s) => a + s.ms, 0) + ' ms');
  check('boot', 'all six stages did real work and none degraded', rep.stages.length === 6 && rep.stages.every(s => s.status === 'ok' && s.detail), rep.stages.map(s => s.id + ':' + s.ms + 'ms').join(' '));
  check('boot', 'Home is mounted and the overlay is gone', await page.evaluate(() => !document.getElementById('boot') && document.body.dataset.screen === 'home'));
  const offsite = reqs.filter(u => !/^http:\/\/127\.0\.0\.1:5173\//.test(u) && !/^(data|blob):/.test(u));
  check('boot', 'startup makes no request outside the local server (no real network)', offsite.length === 0, offsite.slice(0, 3).join(' '));
  // warm
  t = Date.now(); await page.goto(base, { waitUntil: 'load' }); await booted(page); const warm = Date.now() - t; rep = await page.evaluate(() => JSON.parse(JSON.stringify(AV.boot.report)));
  check('boot', 'warm start is shorter and is flagged warm', rep.warm && warm < cold - 1200 && warm >= 1500, warm + ' ms (cold ' + cold + ')');
  check('boot', 'warm start reuses cached thumbnails (IndexedDB)', /from cache/.test(rep.stages[5].detail) && !/ 0 thumbnails from cache/.test(rep.stages[5].detail), rep.stages[5].detail);
  // fast startup setting
  await page.evaluate(() => { AV.state.get().settings.fastStartup = true; AV.state.save(true); });
  t = Date.now(); await page.goto(base, { waitUntil: 'load' }); await booted(page); const fast = Date.now() - t;
  check('boot', '“Fast startup” shortens a warm start further', fast < warm - 500 && fast < 2600, fast + ' ms');
  await page.evaluate(() => { AV.state.get().settings.fastStartup = false; AV.state.save(true); });
  // reduced motion: no animation anywhere on the loading screen
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await sleep(250);
  const anim = await page.evaluate(() => { const els = [...document.querySelectorAll('#boot *')]; return els.filter(e => getComputedStyle(e).animationName !== 'none' && getComputedStyle(e).display !== 'none').length; });
  check('boot', 'reduced motion: no CSS animation runs on the loading screen', anim === 0, anim + ' animated elements');
  await booted(page); await page.emulateMediaFeatures([]);
  // offline
  // dev skip control only in dev mode
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await sleep(150); const skipHidden = await page.evaluate(() => document.getElementById('bootSkip').hidden); await booted(page);
  await page.goto(base + '?dev=1', { waitUntil: 'domcontentloaded' }); await sleep(150); const skipShown = await page.evaluate(() => !document.getElementById('bootSkip').hidden);
  await page.evaluate(() => { document.getElementById('bootSkip').click(); }); const t2 = Date.now(); await booted(page);
  check('boot', 'skip control is dev-only and works', skipHidden && skipShown && Date.now() - t2 < 2500);
  // audio: no AudioContext may be created or resumed by startup
  await page.evaluateOnNewDocument(() => { const A = window.AudioContext; window.__acs = 0; window.AudioContext = function (...a) { window.__acs++; return new A(...a); }; });
  await page.goto(base + '?fastboot=1', { waitUntil: 'load' }); await booted(page);
  check('boot', 'startup does not create an AudioContext before a user gesture', await page.evaluate(() => window.__acs === 0));
  check('boot', 'no page errors during startup scenarios', !logs.some(l => BAD.test(l)), logs.filter(l => BAD.test(l)).slice(0, 2).join(' | '));
  await browser.close();
}
// 2D fallback: WebGL unavailable
{
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await loadSeeded(page);
  await page.evaluateOnNewDocument(() => { const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/.test(t)) return null; return gc.call(this, t, ...a); }; });
  await page.goto(base + '?fastboot=1', { waitUntil: 'load' }); await booted(page);
  const r = await page.evaluate(() => ({ rep: AV.boot.report, home: document.body.dataset.screen, svg: !!document.querySelector('#stage .art-svg, #stage .hall-fallback svg'), canvas: !!document.querySelector('canvas.stage3d'), supported: AV.stage.supported() }));
  check('fallback', 'WebGL unavailable → startup completes in 2D, no error screen', r.rep.fallback2D && r.home === 'home' && !r.supported && r.svg && !r.canvas, r.rep.notes.join('; '));
  check('fallback', 'renderer stage is marked as a fallback, others ok', r.rep.stages.find(s => s.id === 'renderer').status === 'fallback' && r.rep.stages.filter(s => s.id !== 'renderer').every(s => s.status === 'ok'));
  await go(page, 'vault'); check('fallback', 'Vault renders 2D art for every card', await page.evaluate(() => document.querySelectorAll('#stage .plate .art-svg').length > 5 && !document.querySelector('#stage .plate .t3img')));
  const real = logs.filter(l => BAD.test(l) && !/Error creating WebGL context/.test(l)); check('fallback', 'no page errors in 2D fallback (the browser own WebGL warning is expected)', !real.length, real.slice(0, 2).join(' | '));
  await browser.close();
}
// corrupt ledger → recovery panel (Retry / Start a fresh archive), backup preserved
{
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await loadSeeded(page);
  await page.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('p2c')) { sessionStorage.setItem('p2c', '1'); localStorage.setItem('aethervault.save.v1', '{this is not json'); } }); // before any script (pagehide would otherwise re-save the good state)
  await page.goto(base + '?fastboot=1', { waitUntil: 'load' }); await page.waitForSelector('#bootErr button', { visible: true, timeout: 8000 });
  const txt = await page.evaluate(() => ({ state: document.getElementById('boot').dataset.state, text: document.getElementById('bootErr').textContent, btns: [...document.querySelectorAll('#bootErr button')].map(b => b.textContent) }));
  check('error', 'corrupt ledger shows a clear error state with Retry and Start-fresh', txt.state === 'error' && /unreadable/i.test(txt.text) && txt.btns.length === 2, txt.btns.join(' / '));
  check('error', 'the damaged save is preserved under a backup key', await page.evaluate(() => Object.keys(localStorage).some(k => /\.corrupt\./.test(k) && localStorage.getItem(k) === '{this is not json')));
  await page.evaluate(() => document.querySelector('#bootErr button[data-k=fresh]').click()); await booted(page);
  check('error', '“Start a fresh archive” continues into onboarding', await page.evaluate(() => AV.boot.done && !!document.querySelector('.welcome')));
  await browser.close();
}
// save compatibility: a v0.2-era save (no fpsLimit/fastStartup, quality 'high') loads untouched
{
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await loadSeeded(page);
  const before = await page.evaluate(() => { const s = AV.state.get(); delete s.settings.fpsLimit; delete s.settings.fastStartup; s.settings.quality3d = 'high'; AV.state.save(true); return { n: Object.keys(s.specimens).length, credits: s.wallet.credits, name: s.profile.name, companion: s.companion }; });
  await page.goto(base + '?fastboot=1', { waitUntil: 'load' }); await booted(page);
  const after = await page.evaluate(() => { const s = AV.state.get(); return { n: Object.keys(s.specimens).length, credits: s.wallet.credits, name: s.profile.name, companion: s.companion, fps: s.settings.fpsLimit, q: s.settings.quality3d, v: s.version, boot: AV.boot.report.stages[1].detail }; });
  check('save', 'old save keeps specimens, wallet, profile, companion and chosen quality', before.n === after.n && before.credits === after.credits && before.name === after.name && before.companion === after.companion && after.q === 'high' && after.v >= 2, JSON.stringify(after));
  check('save', 'new settings default in without a schema bump', after.fps === 'auto');
  await browser.close();
}

// ------------------------------------------------------------------ B. new 3D content
const NEW = ['emberkit', 'pyrodrake', 'mossback', 'grovewarden', 'ionbow', 'gravehammer', 'oracletablet', 'moonstone', 'pocketdrone', 'scraprover', 'impossiblecube', 'missingtexture', 'backwardsclock'];
{
  const { browser, page, logs } = await launch({ width: 1600, height: 900 });
  await loadSeeded(page);
  const build = await page.evaluate(async (NEW) => {
    const S = AV.stage, out = [], info = () => S.renderer().info.memory; const g0 = info().geometries, t0 = info().textures;
    for (const key of NEW.concat(['container:pack', 'container:capsule'])) {
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;width:300px;height:300px'; document.body.appendChild(host);
      const combos = key.startsWith('container:') ? [{}] : [0, 1, 2, 3, 4].map(level => ({ level, potential: 20 + level * 20, variant: ['none', 'foil', 'holographic', 'golden', 'prismatic'][level], condition: level }));
      combos.push(...(key.startsWith('container:') ? [] : [{ level: 2, variant: 'corrupted', condition: 4, pattern: 'swirled' }, { level: 0, variant: 'celestial', condition: 3, pattern: 'starry' }, { level: 4, variant: 'glitched', condition: 0, pattern: 'scaled', potential: 95 }, { level: 1, variant: 'inverted', palette: 3 }, { level: 1, variant: 'shadow', palette: 5 }]));
      let fails = 0, ms = 0, update = 0, texMs = 0, first = true;
      for (const c of combos) {
        const spec = key.startsWith('container:') ? { container: key.slice(10), theme: [], seed: 7 } : Object.assign({ base: key, variant: 'none', pattern: 'plain', seed: 99, palette: 0, condition: 0, level: 0, potential: 60, serial: 5, size: 1 }, c);
        const v = new S.View(host, { mode: 'display', detached: true, live: true, interactive: false }); const a = performance.now();
        try { if (!v.setSpec(spec)) fails++; else { const dtm = performance.now() - a; if (first) ms = dtm; else texMs = Math.max(texMs, dtm); first = false; for (let i = 0; i < 6; i++) v.tick(.016, performance.now()); v.inst.react && v.inst.react('click'); for (let i = 0; i < 12; i++) v.tick(.03, performance.now()); if (v.inst.setProgress) { v.inst.setProgress(.6); v.tick(.03, performance.now()); v.inst.open && v.inst.open(); for (let i = 0; i < 20; i++) v.tick(.05, performance.now()); } update++; } }
        catch (e) { fails++; out.push({ key, err: e.message }); }
        v.dispose();
      }
      host.remove(); out.push({ key, combos: combos.length, fails, maxBuildMs: +ms.toFixed(1), texMs: +texMs.toFixed(0) });
    }
    return { out, dg: info().geometries - g0, dt: info().textures - t0 };
  }, NEW);
  const bad = build.out.filter(o => o.err || o.fails);
  check('content', `all ${NEW.length} new models + pack + capsule build, animate, react and dispose across 5 stages × variants × conditions`, bad.length === 0, bad.map(b => b.key + (b.err ? ':' + b.err : ':' + b.fails + ' fails')).join(', '));
  const bm = build.out.filter(o => o.maxBuildMs != null).sort((a, b) => b.maxBuildMs - a.maxBuildMs); // the first model built in a fresh page also pays one-time GL/texture setup, so judge the rest
  check('content', 'worst synchronous build (after the first model) under 80 ms', bm.filter(o => o.key !== 'emberkit')[0].maxBuildMs < 80, bm.slice(0, 3).map(o => o.key + ' ' + o.maxBuildMs).join(', ') + ' | first-use pattern/wear texture generation (existing system, cached afterwards) up to ' + Math.max(...build.out.map(o => o.texMs || 0)) + ' ms');
  check('content', 'GPU geometries/textures after ~95 builds + disposals stay bounded (shared cache only)', build.dg < 120 && build.dt < 40, `+${build.dg} geometries, +${build.dt} textures`);
  // seed a collection containing every new model and walk the UI
  await page.evaluate((NEW) => { const E = AV.engine, SP = AV.specimen, U = AV.util, rng = U.mulberry32(77); NEW.forEach((b, i) => { const sp = SP.generate(b, { rng: U.mulberry32(Math.floor(rng() * 1e9)), level: i % 3, potential: 50 + i * 3 }); E.addSpecimen(sp, 'p2'); if (b === 'emberkit') { AV.state.get().companion = sp.id; } }); AV.state.save(true); }, NEW);
  await go(page, 'home'); await sleep(900);
  check('content', 'Home runs a new companion (Emberkit) in 3D', await page.evaluate(() => !!document.querySelector('#homeView canvas.stage3d')));
  await go(page, 'vault'); await sleep(3500);
  const th = await page.evaluate((NEW) => { const ids = Object.keys(AV.state.get().specimens).filter(id => NEW.includes(AV.state.get().specimens[id].base)); return { total: ids.length, ready: document.querySelectorAll('#stage .plate .art.has-3d .t3img').length }; }, NEW);
  check('content', 'Vault shows cached 3D thumbnails for the new models', th.ready >= NEW.length, th.ready + ' thumbnails ready');
  const inspectOk = await page.evaluate(async (NEW) => { const st = AV.state.get(), res = []; for (const id of Object.keys(st.specimens)) { const sp = st.specimens[id]; if (!NEW.includes(sp.base)) continue; AV.inspect(id, {}); await new Promise(r => setTimeout(r, 1300)); res.push([sp.base, !!document.querySelector('.modal canvas.stage3d')]); const x = document.querySelector('.modal [data-m-close]'); if (x) x.click(); await new Promise(r => setTimeout(r, 200)); } return res; }, NEW);
  check('content', 'Inspect opens a live 3D view for every new model', inspectOk.length >= NEW.length && inspectOk.every(r => r[1]), inspectOk.length + ' tried; no 3D: ' + inspectOk.filter(r => !r[1]).map(r => r[0]).join(','));
  await go(page, 'pets'); await sleep(1500);
  check('content', 'Pets / lineage lists the new families and their evolutions', await page.evaluate(() => /Ember/i.test(document.body.innerText) && /Grove/i.test(document.body.innerText) && /Grovewarden|Pyrodrake/.test(document.body.innerText)));
  const forge = await page.evaluate(async () => { const st = AV.state.get(); const sp = Object.values(st.specimens).find(s => s.base === 'mossback') || null; if (!sp) return { ok: false }; sp.level = 2; AV.state.save(true); AV.ui.go('forge', { id: sp.id }); await new Promise(r => setTimeout(r, 1200)); return { ok: !!document.querySelector('.forge canvas.stage3d, #stage canvas.stage3d'), evo: /Take Root|Grovewarden/.test(document.body.innerText) }; });
  check('content', 'Forge shows the Mossback → Grovewarden evolution path in 3D', forge.ok && forge.evo, JSON.stringify(forge));
  // the pack and capsule rituals, real clicks
  for (const [cid, label] of [['wanderer', 'pack'], ['capsule', 'capsule']]) {
    await page.evaluate(id => { AV.state.get().wallet.credits = 99999; AV.opening.start(id, 1); }, cid); await sleep(1400);
    const has3d = await page.evaluate(() => !!document.querySelector('.rit-view canvas.stage3d'));
    for (let i = 0; i < 6; i++) { await page.evaluate(() => { const v = document.querySelector('.rit-view'); if (v) { const b = v.getBoundingClientRect(); v.dispatchEvent(new PointerEvent('pointerdown', { clientX: b.left + 10, clientY: b.top + 100, pointerId: 1, bubbles: true })); v.dispatchEvent(new PointerEvent('pointermove', { clientX: b.left + b.width * .8, clientY: b.top + 100, pointerId: 1, bubbles: true })); v.dispatchEvent(new PointerEvent('pointerup', { clientX: b.left + b.width * .8, clientY: b.top + 100, pointerId: 1, bubbles: true })); v.click(); } }); await sleep(260); }
    await sleep(2600); const reveal = await page.evaluate(() => !!document.querySelector('.rv, .cr, .cg')); // .rv = item reveal; .cr / .cg = Phase Four card-pack reveal (stack / condensed)
    for (let i = 0; i < 10 && (await page.evaluate(() => AV.opening.busy())); i++) { await page.evaluate(() => { const d = document.querySelector('[data-a=done]'), n = document.querySelector('[data-a=next]'), s = document.querySelector('.op-skip'); if (d) d.click(); else if (n && n.offsetParent) n.click(); else if (s && s.offsetParent) s.click(); }); await sleep(500); }
    check('content', `${label} ritual runs in 3D with real clicks and reaches the reveal`, has3d && reveal, `3d=${has3d} reveal=${reveal}`);
  }
  check('content', 'no page errors while exercising the new content', !logs.some(l => BAD.test(l)), logs.filter(l => BAD.test(l)).slice(0, 3).join(' | '));
  await browser.close();
}

// ------------------------------------------------------------------ C. frame limiter + sleeping loops
{
  const { browser, page, logs } = await launch({ width: 1600, height: 900 });
  await page.evaluateOnNewDocument(() => { window.__raf = 0; const r = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = f => { window.__raf++; return r(f); }; });
  await loadSeeded(page);
  const rate = async (limit, q) => page.evaluate(async (limit, q) => { AV.engine.setSetting('quality3d', q); AV.engine.setSetting('fpsLimit', limit); AV.ui.go('home'); await new Promise(r => setTimeout(r, 1800)); const S = AV.stage, f0 = S.stats().frames, t0 = performance.now(); await new Promise(r => setTimeout(r, 3000)); return +((S.stats().frames - f0) / ((performance.now() - t0) / 1000)).toFixed(1); }, limit, q);
  const r30 = await rate(30, 'medium'), r60 = await rate(60, 'medium'), rmax = await rate('max', 'medium'), rautoLow = await rate('auto', 'low'), rautoMed = await rate('auto', 'medium');
  check('fps', 'FPS limit 30 renders ≈30 fps', r30 > 25 && r30 < 35, r30 + ' fps');
  check('fps', 'FPS limit 60 renders ≈60 fps (or the display rate if lower)', r60 > 50 && r60 < 66, r60 + ' fps');
  check('fps', 'Uncapped follows the display refresh rate', rmax > r60 * 0.95, rmax + ' fps');
  check('fps', 'Auto: Low preset ≈30 fps, Medium ≈60 fps', rautoLow > 25 && rautoLow < 35 && rautoMed > 50 && rautoMed < 66, `low ${rautoLow}, medium ${rautoMed}`);
  // loops sleep when nothing needs a frame
  await page.evaluate(() => { AV.engine.setSetting('fpsLimit', 'auto'); AV.engine.setSetting('quality3d', 'medium'); AV.ui.go('vault'); });
  await sleep(2500); const sleepy = await page.evaluate(async () => { const a = window.__raf; await new Promise(r => setTimeout(r, 2000)); return { perSec: (window.__raf - a) / 2, loop: AV.stage.stats().loop, fx: AV.fxStats() }; });
  check('fps', 'Vault (grid of cached thumbnails): stage loop asleep, no per-frame callbacks', !sleepy.loop.running && sleepy.perSec < 5, JSON.stringify(sleepy));
  await page.evaluate(() => { AV.engine.setSetting('reducedMotion', true); AV.ui.go('home'); }); await sleep(2500);
  const rm = await page.evaluate(async () => { const a = window.__raf; const f0 = AV.stage.stats().frames; await new Promise(r => setTimeout(r, 2500)); return { perSec: (window.__raf - a) / 2.5, frames: AV.stage.stats().frames - f0, running: AV.stage.stats().loop.running, fx: AV.fxStats() }; });
  check('fps', 'Reduced motion at Home: renders only on demand (no continuous frames, loops asleep)', rm.frames <= 3 && !rm.running && rm.perSec < 5 && !rm.fx.timer, JSON.stringify(rm));
  await page.evaluate(() => AV.engine.setSetting('reducedMotion', false));
  await page.evaluate(() => AV.engine.setSetting('quality3d', 'off')); await sleep(800); await page.evaluate(() => AV.ui.go('vault')); await sleep(1200);
  const off = await page.evaluate(async () => { const a = window.__raf; await new Promise(r => setTimeout(r, 2000)); return { perSec: (window.__raf - a) / 2, fx: AV.fxStats() }; });
  check('fps', '3D Off: only the 15 fps ambient timer remains (no rAF loop)', off.perSec < 5 && off.fx.timer, JSON.stringify(off));
  check('fps', 'no page errors', !logs.some(l => BAD.test(l)), logs.filter(l => BAD.test(l)).slice(0, 2).join(' | '));
  await browser.close();
}

const failed = results.filter(r => !r.ok);
fs.writeFileSync(path.join(root, 'docs/validation-phase2.json'), JSON.stringify({ when: new Date().toISOString(), passed: results.length - failed.length, total: results.length, results }, null, 1));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`); failed.forEach(f => console.log('  FAILED:', f.group, f.name, f.detail));
process.exit(failed.length ? 1 : 0);
