/* AETHERVAULT — utilities. Everything hangs off the global AV namespace. */
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const AV = root.AV = root.AV || {};
  AV.VERSION = { number: '0.6.3', build: 'P5B-20261022', name: 'Phase Five · Combat B (in progress)' };

  // Deterministic PRNG so a specimen's seed always yields the same pattern/quirks.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const newSeed = () => (Math.random() * 4294967296) >>> 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

  /** entries: [[value, weight], ...] */
  function pickWeighted(entries, r = Math.random) {
    let total = 0;
    for (const e of entries) total += e[1];
    let x = r() * total;
    for (const e of entries) { x -= e[1]; if (x < 0) return e[0]; }
    return entries[entries.length - 1][0];
  }

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    n = Math.round(n);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (Math.abs(n) >= 1e5) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toLocaleString('en-US');
  }
  const fmtFull = n => Math.round(n).toLocaleString('en-US');
  const pad = (n, w) => String(n).padStart(w, '0');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dateKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let _uid = 0;
  const uid = (p = 'u') => p + (++_uid).toString(36);
  const deepClone = o => JSON.parse(JSON.stringify(o));

  function timeAgo(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  // Tiny DOM helpers (no-ops under Node tests)
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  function h(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  AV.util = { mulberry32, newSeed, clamp, lerp, rand, randInt, pick, pickWeighted, fmt, fmtFull, pad, esc, dateKey, sleep, uid, deepClone, timeAgo, $, $$, h };
})();
