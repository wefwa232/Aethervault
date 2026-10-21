// Frame-time spike probe: samples Home for N seconds right after the sequence ends, with and without the Tier-B idle warm-up.
import { launch, loadSeeded, booted, sleep, ensureServer } from './harness.mjs';
await ensureServer();
const { browser, page } = await launch({ width: 1600, height: 900 });
for (const noWarm of [true, false, true, false]) {
  await page.evaluateOnNewDocument(flag => { window.__AV_NO_PREWARM = flag; }, noWarm);
  await loadSeeded(page);
  await page.goto('http://127.0.0.1:5173/index.html?fastboot=1', { waitUntil: 'load' });
  const r = await page.evaluate(() => new Promise(async res => {
    await new Promise(r => { const c = () => (window.AV && AV.boot && AV.boot.done) ? r() : setTimeout(c, 20); c(); });
    const dts = [], long = []; let last = performance.now(), start = last;
    const f = now => { const d = now - last; dts.push(d); if (d > 25) long.push([Math.round(now - start), Math.round(d)]); last = now; if (now - start < 7000) requestAnimationFrame(f); else res({ n: dts.length, worst: Math.max(...dts.slice(1)).toFixed(1), over25: long.length, long: long.slice(0, 10), stats: AV.stage.stats().loop }); };
    requestAnimationFrame(f);
  }));
  console.log(noWarm ? 'NO warm-up ' : 'with warm-up', JSON.stringify(r));
}
await browser.close();
