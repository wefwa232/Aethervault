// Renders the Aethervault PWA icons (PNG) from the same star-and-core mark as the favicon.
// Dependency-free: supersampled rasteriser + zlib. Usage: node tools/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const BG = [0x12, 0x11, 0x0f], GOLD = [0xd7, 0xb4, 0x6e];
const STAR = [[32, 8], [40, 26], [56, 32], [40, 38], [32, 56], [24, 38], [8, 32], [24, 26]];
const CORE = [[32, 25], [37, 32], [32, 39], [27, 32]];

const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const inPoly = (px, py, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > py) !== (P[j][1] > py) && px < (P[j][0] - P[i][0]) * (py - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
const onStar = (x, y, w) => STAR.some((p, i) => segDist(x, y, p, STAR[(i + 1) % STAR.length]) <= w / 2) || inPoly(x, y, CORE);

function png(size, scale) {
  const SS = 3, raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        // pixel -> 64-unit design space, scaled about the centre
        const u = ((x + (sx + .5) / SS) / size * 64 - 32) / scale + 32, v = ((y + (sy + .5) / SS) / size * 64 - 32) / scale + 32;
        if (onStar(u, v, 3.4)) hit++;
      }
      const a = hit / (SS * SS), o = y * (size * 4 + 1) + 1 + x * 4;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(BG[k] + (GOLD[k] - BG[k]) * a);
      raw[o + 3] = 255;
    }
  }
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8); b.writeUInt32BE(zlib.crc32(b.subarray(4, 8 + data.length)) >>> 0, 8 + data.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

fs.mkdirSync(out, { recursive: true });
// "any" icons fill the frame; maskable keeps the mark inside the 80% safe circle; apple-touch is opaque and un-masked.
for (const [name, size, scale] of [['icon-192.png', 192, 1.15], ['icon-512.png', 512, 1.15], ['icon-maskable-512.png', 512, 0.95], ['apple-touch-icon.png', 180, 1.1]]) {
  fs.writeFileSync(path.join(out, name), png(size, scale)); console.log('wrote icons/' + name);
}
fs.writeFileSync(path.join(out, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#12110f"/><path d="M32 8l8 18 16 6-16 6-8 18-8-18-16-6 16-6z" fill="none" stroke="#d7b46e" stroke-width="3.4" stroke-linejoin="miter"/><path d="M32 25l5 7-5 7-5-7z" fill="#d7b46e"/></svg>\n`);
console.log('wrote icons/icon.svg');
