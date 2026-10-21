// usage: node tools/shot-screen.mjs <screen> <out.png> [width height] [params-json] [extra-js]
import { launch, loadSeeded, sleep, ensureServer, go } from './harness.mjs';
const [screen, out, w = '1920', h = '1080', params = '{}', js] = process.argv.slice(2);
await ensureServer();
const { browser, page, logs } = await launch({ width: +w, height: +h });
await loadSeeded(page, 5173);
await go(page, screen, JSON.parse(params));
await sleep(1800);
if (js) { await page.evaluate(js); await sleep(1500); }
await page.screenshot({ path: out });
console.log(JSON.stringify(await page.evaluate(() => AV.stage.stats())));
logs.filter(l => !/404/.test(l)).slice(0, 10).forEach(l => console.log(l));
await browser.close();
