// usage: node snap.mjs "<url>" out.png [waitMs] [width] [height] [jsToEvalBeforeShot]
import { launch, sleep, ensureServer } from './harness.mjs';
const [url, out, wait = '1500', w = '1400', h = '900', js] = process.argv.slice(2);
await ensureServer();
const { browser, page, logs } = await launch({ width: +w, height: +h });
await page.goto(url, { waitUntil: 'load' });
await sleep(+wait);
if (js) { await page.evaluate(js); await sleep(900); }
await page.screenshot({ path: out });
const info = await page.evaluate(() => window.AV && AV.stage ? JSON.stringify(AV.stage.stats()) : '');
console.log(info); logs.slice(0, 12).forEach(l => console.log(l));
await browser.close();
