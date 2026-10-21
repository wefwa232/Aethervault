import { launch, loadSeeded, sleep, ensureServer } from './harness.mjs';
await ensureServer(); const { browser, page } = await launch({ width: 1400, height: 900 });
page.on('response', r => { if (r.status() >= 400) console.log(r.status(), r.url()); });
await loadSeeded(page, 5173); await sleep(1500); await browser.close();
