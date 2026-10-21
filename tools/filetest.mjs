// Loads index.html straight from disk (file://) to prove there is no server dependency.
import { launch, sleep, root } from './harness.mjs';
import path from 'node:path';
const { browser, page, logs } = await launch({ width: 1600, height: 900, args: ['--allow-file-access-from-files'] });
await page.goto('file:///' + path.join(root, 'index.html').split(path.sep).join('/'), { waitUntil: 'load' });
await sleep(2500);
const r = await page.evaluate(() => ({ title: document.title, onboarding: !!document.querySelector('.welcome'), stage: AV.stage.stats().quality, fonts: document.fonts.check('600 16px "Cormorant Garamond"'), three: typeof THREE }));
console.log(JSON.stringify(r)); logs.slice(0, 6).forEach(l => console.log(l));
await page.screenshot({ path: path.join(root, 'docs/screenshots/validation/file-protocol.png') });
await browser.close();
