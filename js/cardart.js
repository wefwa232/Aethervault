/* AETHERVAULT — Phase Four card artwork. One layout (a list of drawing ops in card units, 250 × 350) rendered by two backends:
 *   SVG     inline markup for the 2D art (Vault plates, fallbacks, reveals without WebGL) — uses the page's bundled fonts
 *   Canvas  textures for the 3D card (face, back, foil/gloss mask, parallax art layers) — canvas text also uses the bundled fonts
 * Illustrations are original scenes (or the depicted item's own art) drawn as SVG in a 218 × 224 space with three depth layers
 * (bg · mid · fg) so the 3D card can separate them. Nothing here is copied from an existing card game: the frame is an Aethervault
 * archive plate (name plate, mat-cut window, class strip, ledger text box, imprint line). */
(function () {
  const AV = (window.AV = window.AV || {});
  const D = AV.data, U = AV.util, CD = AV.cards;
  const W = 250, H = 350, AW = 218, AH = 224;
  const FONTS = { serif: '"Cormorant Garamond", "Palatino Linotype", Georgia, serif', cond: '"Barlow Condensed", "Arial Narrow", sans-serif', mono: '"IBM Plex Mono", Consolas, monospace', sans: '"IBM Plex Sans", "Segoe UI", sans-serif' };
  const esc = U.esc, r1 = n => Math.round(n * 10) / 10;

  // ------------------------------------------------------------------ small SVG builder (defs accumulate per illustration)
  function mkB(prefix) {
    let n = 0; const defs = [];
    const id = () => prefix + (n++).toString(36);
    const stops = st => st.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] == null ? 1 : s[2]}"/>`).join('');
    return {
      defs,
      lin(st, x1 = 0, y1 = 0, x2 = 0, y2 = 1) { const i = id(); defs.push(`<linearGradient id="${i}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(st)}</linearGradient>`); return `url(#${i})`; },
      rad(st, cx = .5, cy = .5, r = .5) { const i = id(); defs.push(`<radialGradient id="${i}" cx="${cx}" cy="${cy}" r="${r}">${stops(st)}</radialGradient>`); return `url(#${i})`; },
      glow(x, y, r, c, a = .8) { return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${this.rad([[0, c, a], [.45, c, a * .35], [1, c, 0]])}"/>`; },
    };
  }
  const shade = (hex, k) => { const c = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [c >> 16 & 255, c >> 8 & 255, c & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join(''); };
  const mix = (a, b, t) => { const p = h => parseInt(h.slice(1), 16), A = p(a), B = p(b); const m = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t); return '#' + [16, 8, 0].map(s => m(s).toString(16).padStart(2, '0')).join(''); };
  const starPath = (cx, cy, R, r, n = 4, rot = -90) => { let d = ''; for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + r1(cx + Math.cos(a) * rr) + ' ' + r1(cy + Math.sin(a) * rr); } return d + 'Z'; };
  const dots = (rng, n, x0, y0, x1, y1, col, rmin = .5, rmax = 1.6, amin = .3) => { let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${r1(x0 + rng() * (x1 - x0))}" cy="${r1(y0 + rng() * (y1 - y0))}" r="${r1(rmin + rng() * (rmax - rmin))}" fill="${col}" opacity="${r1(amin + rng() * (1 - amin))}"/>`; return s; };
  const scribble = (rng, x, y, w, rows, gap, col, sw = 1) => { let s = ''; for (let j = 0; j < rows; j++) { let d = `M${x} ${y + j * gap}`; let cx = x; while (cx < x + w * (.7 + rng() * .3)) { const st = 3 + rng() * 6; d += ` q${r1(st / 2)} ${r1((rng() - .5) * 4)} ${r1(st)} 0`; cx += st; if (rng() < .18) { cx += 4; d += ` m4 0`; } } s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" opacity=".8"/>`; } return s; };

  // ------------------------------------------------------------------ backgrounds for depicted items, by card class
  const BACKDROP = {
    creature(b, p, rng) { return `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, mix(p[0], '#0c1a16', .35)], [1, mix(p[2], '#000000', .3)]])}"/>${b.glow(109, 112, 110, p[3], .32)}<path d="M0 182 Q60 168 109 176 T218 170 V224 H0Z" fill="${shade(p[2], .8)}"/>${[0, 1, 2, 3, 4, 5].map(i => { const x = i < 3 ? 6 + i * 12 : 212 - (i - 3) * 12, s = i < 3 ? 1 : -1; return `<path d="M${x} 224 q${s * 14} -40 ${s * 4} -${70 + rng() * 40}" fill="none" stroke="${shade(p[0], .55)}" stroke-width="${4 + rng() * 4}" stroke-linecap="round" opacity=".7"/>`; }).join('')}`; },
    being(b, p, rng) { return `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#06071a'], [.6, p[0]], [1, '#05050f']])}"/>${dots(rng, 70, 0, 0, AW, 150, '#fff', .3, 1.3)}${b.glow(109, 100, 120, p[1], .3)}`; },
    relic(b, p) { return `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, mix(p[0], '#000', .45)], [1, '#12060a']])}"/><path d="M44 224 V92 Q44 30 109 30 Q174 30 174 92 V224Z" fill="${b.lin([[0, mix(p[0], '#000', .2)], [1, mix(p[0], '#000', .6)]])}" stroke="${p[1]}" stroke-opacity=".45" stroke-width="2"/>${b.glow(109, 60, 90, p[1], .3)}<rect x="56" y="178" width="106" height="10" rx="2" fill="${shade(p[1], .55)}"/>`; },
    machine(b, p) { let g = ''; for (let i = 0; i <= 218; i += 14) g += `<path d="M${i} 0V${AH}" stroke="${p[3]}" stroke-opacity=".08"/>`; for (let j = 0; j <= 224; j += 14) g += `<path d="M0 ${j}H${AW}" stroke="${p[3]}" stroke-opacity=".08"/>`; return `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, mix(p[0], '#000', .3)], [1, mix(p[2], '#000', .2)]])}"/>${g}<circle cx="36" cy="42" r="26" fill="none" stroke="${p[3]}" stroke-opacity=".12" stroke-width="5" stroke-dasharray="6 5"/><circle cx="186" cy="196" r="36" fill="none" stroke="${p[3]}" stroke-opacity=".1" stroke-width="6" stroke-dasharray="7 6"/>${b.glow(109, 118, 100, p[1], .22)}`; },
    discovery(b, p, rng) { let c = ''; for (let i = 0; i < 9; i++) c += `<ellipse cx="${r1(60 + rng() * 100)}" cy="${r1(60 + rng() * 110)}" rx="${r1(30 + i * 8)}" ry="${r1(18 + i * 6)}" fill="none" stroke="${p[2]}" stroke-opacity=".14"/>`; return `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, mix(p[3], p[0], .25)], [1, mix(p[0], '#2a1c0c', .4)]])}"/>${c}${b.glow(109, 110, 100, '#fff6dc', .35)}`; },
    oddity(b, p, rng) { let s = ''; for (let j = 0; j < 224; j += 4) s += `<rect y="${j}" width="${AW}" height="1.4" fill="#000" opacity=".18"/>`; for (let i = 0; i < 26; i++) s += `<rect x="${r1(rng() * 210)}" y="${r1(rng() * 220)}" width="${r1(2 + rng() * 10)}" height="${r1(1 + rng() * 3)}" fill="${rng() < .5 ? p[1] : '#ff4fd8'}" opacity="${r1(.15 + rng() * .3)}"/>`; return `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, mix(p[0], '#000', .4)], [1, '#0b0716']])}"/>${b.glow(109, 116, 100, p[1], .25)}${s}`; },
    phenomenon(b, p) { return `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#081428'], [1, p[0]]])}"/>`; },
    location(b, p) { return `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, mix(p[0], '#1a0f05', .5)], [1, '#140c06']])}"/>`; },
    record(b, p) { return `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#5a4630'], [1, '#2e2216']])}"/>`; },
  };

  // ------------------------------------------------------------------ original scenes. Each returns { bg, mid, fg } in the 218 × 224 space.
  const SCENES = {
    location: {
      reading(b, p, rng) {
        let shelves = ''; [[0, 46], [172, 46]].forEach(([x, w]) => { shelves += `<rect x="${x}" y="20" width="${w}" height="190" fill="#2a170b"/>`; for (let y = 34; y < 200; y += 30) { let bx = x + 3; while (bx < x + w - 4) { const bw = 3 + rng() * 5, bh = 18 + rng() * 9; shelves += `<rect x="${r1(bx)}" y="${r1(y + 26 - bh)}" width="${r1(bw)}" height="${r1(bh)}" fill="${['#6a2a22', '#2f4a3a', '#7a5a2a', '#3a3a5a', '#8a6a3a'][Math.floor(rng() * 5)]}"/>`; bx += bw + .8; } shelves += `<rect x="${x}" y="${y + 26}" width="${w}" height="3" fill="#4a2c16"/>`; } });
        return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#3a2412'], [1, '#160c05']])}"/><path d="M80 120 V60 Q109 26 138 60 V120Z" fill="${b.lin([[0, '#f6d9a0'], [1, '#c48a3e']])}" opacity=".85"/><path d="M109 40V120M84 82H134" stroke="#2a170b" stroke-width="3"/>${shelves}`,
          mid: `<path d="M24 170 H194 L206 186 H12Z" fill="#5a3418"/><rect x="20" y="186" width="6" height="30" fill="#3a200c"/><rect x="192" y="186" width="6" height="30" fill="#3a200c"/>${[60, 109, 158].map(x => `<path d="M${x} 168 v-18 M${x - 9} 150 h18 l-5 -12 h-8z" stroke="#c9a25a" stroke-width="2" fill="#e8c27a"/>${b.glow(x, 148, 34, '#ffd27a', .7)}`).join('')}`,
          fg: `${dots(rng, 18, 30, 60, 190, 170, '#ffe6b0', .4, 1, .2)}` };
      },
      corridor(b, p, rng) {
        let arches = ''; for (let i = 6; i >= 0; i--) { const k = Math.pow(.72, i), w = 190 * k, h = 200 * k, x = 109 - w / 2, y = 112 - h * .55; arches += `<path d="M${r1(x)} ${r1(y + h)} V${r1(y + w * .5)} A${r1(w / 2)} ${r1(w / 2)} 0 0 1 ${r1(x + w)} ${r1(y + w * .5)} V${r1(y + h)}" fill="none" stroke="${mix('#3a2410', '#d9a85a', 1 - i / 7)}" stroke-width="${r1(10 * k + 1)}"/>`; }
        let lamps = ''; for (let i = 0; i < 6; i++) { const k = Math.pow(.72, i); [-1, 1].forEach(s => { const x = 109 + s * 82 * k, y = 112 - 30 * k; lamps += b.glow(x, y, 18 * k + 3, '#ffcf7a', .8) + `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(2.6 * k + .6)}" fill="#fff2c8"/>`; }); }
        return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#1a0f06'], [.5, '#4a2c12'], [1, '#120a04']])}"/>${b.glow(109, 112, 40, '#ffe2a8', .9)}`, mid: arches + `<path d="M0 224 L100 120 H118 L218 224Z" fill="${b.lin([[0, '#2a1a0c'], [1, '#5a3a1a']])}" opacity=".9"/>`, fg: lamps };
      },
      stair(b, p, rng) {
        let steps = ''; for (let i = 0; i < 16; i++) { const a = i * .78, y = 200 - i * 11, x = 109 + Math.cos(a) * 54, w = 34 + Math.sin(a) * 10; steps += `<path d="M109 ${y} L${r1(x)} ${r1(y - 6)} L${r1(x + Math.cos(a + .6) * 22)} ${r1(y - 10)}Z" fill="${mix('#6a4a2a', '#e0b070', i / 16)}" stroke="#2a1608" stroke-width="1"/>`; }
        return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#f0d29a'], [.25, '#7a5028'], [1, '#160c05']])}"/>${b.glow(109, 0, 90, '#fff2c0', .9)}`, mid: `<rect x="104" y="20" width="10" height="200" fill="#3a2410"/>${steps}`, fg: `<text x="160" y="40" font-family='${FONTS.cond}' font-size="20" fill="#fff2c0" opacity=".55">IX</text>${dots(rng, 12, 60, 10, 160, 90, '#fff8dc', .4, 1, .3)}` };
      },
      observatory(b, p, rng) {
        return { bg: `<rect width="${AW}" height="${AH}" fill="#0a0d22"/>${dots(rng, 60, 0, 0, AW, 120, '#fff', .3, 1.2)}<path d="M8 150 A101 101 0 0 1 210 150Z" fill="${b.lin([[0, '#6a5030'], [1, '#2a1c10']])}"/><path d="M94 52 L124 52 L132 150 H86Z" fill="#0d1230"/>${dots(rng, 14, 92, 56, 128, 146, '#cfe0ff', .4, 1.1)}${[20, 50, 168, 198].map(x => `<path d="M${x} 150 Q109 ${x < 109 ? 40 : 40} 109 49" fill="none" stroke="#c9a25a" stroke-width="2" opacity=".55"/>`).join('')}`,
          mid: `<g transform="rotate(-28 109 160)"><rect x="100" y="70" width="18" height="96" rx="3" fill="#b48d4c"/><rect x="96" y="66" width="26" height="12" rx="2" fill="#e6c27a"/></g><path d="M80 210 L109 160 L138 210" stroke="#7a5a2a" stroke-width="5" fill="none"/><rect x="0" y="206" width="${AW}" height="18" fill="#1c140a"/>`, fg: b.glow(118, 70, 30, '#cfe6ff', .4) };
      },
      gallery(b, p, rng) {
        const frames = [[22, 50, 44, 56], [80, 40, 58, 72], [152, 54, 44, 52]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${['#2a4a5a', '#5a3a2a', '#3a5a3a'][Math.floor(rng() * 3)]}" stroke="#c9a25a" stroke-width="3"/>`).join('');
        return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#1a2a30'], [1, '#0a1418']])}"/>${frames}`, mid: `<rect y="138" width="${AW}" height="86" fill="${b.lin([[0, '#2fd6c4', .45], [1, '#0a3a40', .9]])}"/><g opacity=".35" transform="translate(0 276) scale(1 -1)">${frames}</g>`, fg: `${[0, 1, 2, 3, 4].map(i => `<path d="M${10 + i * 44} ${150 + (i % 2) * 6} q12 -3 24 0" stroke="#bff" stroke-opacity=".5" fill="none"/>`).join('')}` };
      },
      garden(b, p, rng) {
        let glass = ''; for (let x = 0; x <= 218; x += 22) glass += `<path d="M${x} 224 V90 Q${x + 11} 60 ${x + 22} 90" fill="none" stroke="#cfe8d0" stroke-opacity=".35" stroke-width="1.5"/>`; for (let y = 100; y < 224; y += 22) glass += `<path d="M0 ${y}H${AW}" stroke="#cfe8d0" stroke-opacity=".2"/>`;
        let fronds = ''; for (let i = 0; i < 9; i++) { const x = 20 + rng() * 180, y = 120 + rng() * 60, a = (rng() - .5) * 120; fronds += `<path transform="rotate(${r1(a)} ${r1(x)} ${r1(y)})" d="M${r1(x)} ${r1(y)} q-8 -30 0 -60 q8 30 0 60z" fill="${mix('#2f6a3a', '#7fcf7a', rng())}"/>`; }
        return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#cfe8b0'], [1, '#2a4a2a']])}"/>${glass}`, mid: fronds + `<rect y="196" width="${AW}" height="28" fill="#2a3a1c"/>`, fg: dots(rng, 16, 0, 40, AW, 200, '#f6ffd0', .4, 1.1, .3) };
      },
      forge(b, p) {
        const py = x => `<rect x="${x - 8}" y="40" width="16" height="170" fill="#2b2f36"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${x - 12}" y="${60 + i * 22}" width="24" height="6" rx="3" fill="${i % 2 ? '#b48d4c' : '#ff8a3d'}" opacity="${i % 2 ? 1 : .8}"/>`).join('')}`;
        return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#1a1410'], [1, '#2a160a']])}"/><path d="M28 40 Q109 -10 190 40" stroke="#b48d4c" stroke-width="4" fill="none"/>${py(28)}${py(190)}`, mid: `${b.glow(109, 150, 70, '#ff8a3d', .6)}<path d="M74 170 H144 L136 182 H82Z M90 182 H128 V198 H90Z M80 198 H138 V206 H80Z" fill="#3a3f48"/>`, fg: `<rect y="206" width="${AW}" height="18" fill="#120c08"/>` };
      },
      vault(b, p, rng) {
        let rings = ''; for (let i = 0; i < 6; i++) rings += `<circle cx="109" cy="112" r="${86 - i * 13}" fill="none" stroke="${mix('#6cf2ff', '#f0c867', i / 6)}" stroke-opacity="${.5 - i * .05}" stroke-width="${3 - i * .3}"/>`;
        let bolts = ''; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; bolts += `<circle cx="${r1(109 + Math.cos(a) * 92)}" cy="${r1(112 + Math.sin(a) * 92)}" r="3.2" fill="#d8c27a"/>`; }
        return { bg: `<rect width="${AW}" height="${AH}" fill="#03040c"/>${dots(rng, 120, 0, 0, AW, AH, '#fff', .2, 1.2, .2)}${b.glow(109, 112, 110, '#3a2aff', .35)}`, mid: rings + bolts, fg: `${b.glow(109, 112, 40, '#e8fbff', .95)}<path d="${starPath(109, 112, 22, 6, 4)}" fill="#fff"/>` };
      },
    },
    phenomenon: {
      motes(b, p, rng) { return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#2a1c10'], [1, '#100a06']])}"/><path d="M150 0 H210 L120 224 H40Z" fill="${b.lin([[0, '#ffe6b0', .55], [1, '#ffe6b0', 0]], 0, 0, 0, 1)}"/>`, mid: dots(rng, 70, 50, 10, 200, 210, '#fff2d0', .4, 1.7, .25), fg: dots(rng, 10, 70, 40, 180, 190, '#fff', 1.4, 2.6, .5) }; },
      inkrain(b, p, rng) { let r = ''; for (let i = 0; i < 70; i++) { const x = rng() * 240 - 10, y = rng() * 200; r += `<path d="M${r1(x)} ${r1(y)} l-5 14" stroke="#9fc0ff" stroke-width="${r1(.6 + rng())}" opacity="${r1(.3 + rng() * .5)}"/>`; } return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#0a1430'], [1, '#1a2a50']])}"/>`, mid: r, fg: `<path d="M0 224 V170 h30 v-20 h26 v30 h40 v-40 h30 v26 h50 v-14 h42 V224Z" fill="#06080f"/>` }; },
      aurora(b, p, rng) { let a = ''; for (let i = 0; i < 4; i++) a += `<path d="M-10 ${80 + i * 14} C50 ${40 + i * 10} 120 ${120 - i * 8} 230 ${60 + i * 12}" fill="none" stroke="${['#7fffd0', '#9ff5ff', '#c9a2ff', '#7fffa0'][i]}" stroke-width="${18 - i * 3}" stroke-linecap="round" opacity="${.32 - i * .05}"/>`; return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#030614'], [1, '#0c1a30']])}"/>${dots(rng, 50, 0, 0, AW, 160, '#fff', .3, 1.1)}`, mid: a, fg: `<path d="M0 0 H${AW} V24 L170 40 L109 18 L48 40 L0 24Z" fill="#120c06"/><path d="M0 24 L48 40 L109 18 L170 40 L218 24" stroke="#6a4a22" stroke-width="3" fill="none"/>` }; },
      dawn(b, p, rng) { let rays = ''; for (let i = 0; i < 14; i++) { const a = Math.PI + i / 13 * Math.PI; rays += `<path d="M109 160 L${r1(109 + Math.cos(a) * 200)} ${r1(160 + Math.sin(a) * 200)}" stroke="#fff2c0" stroke-width="${r1(2 + rng() * 5)}" opacity=".18"/>`; } return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#2a3a7a'], [.55, '#f0a060'], [1, '#ffe6a0']])}"/>${rays}`, mid: `${b.glow(109, 160, 90, '#fff6d0', .95)}<circle cx="109" cy="160" r="30" fill="#fff8e0"/><rect y="160" width="${AW}" height="64" fill="${b.lin([[0, '#5a3a5a'], [1, '#1a1020']])}"/>`, fg: `<path d="M20 0 V224 M198 0 V224 M20 72 H198 M109 0 V160" stroke="#1a1208" stroke-width="7"/><rect x="0" y="0" width="${AW}" height="${AH}" fill="none" stroke="#1a1208" stroke-width="22"/>` }; },
      bell(b, p) { let w = ''; for (let i = 1; i < 6; i++) w += `<path d="M${109 - 30 - i * 16} ${150 - i * 4} A${30 + i * 16} ${30 + i * 16} 0 0 1 ${109 + 30 + i * 16} ${150 - i * 4}" fill="none" stroke="#bfe0ff" stroke-opacity="${.5 - i * .08}" stroke-width="2"/>`; return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#141a2a'], [1, '#05070d']])}"/>${w}`, mid: `<path d="M109 52 C88 52 82 72 80 104 C78 132 66 140 62 150 H156 C152 140 140 132 138 104 C136 72 130 52 109 52Z" fill="${b.lin([[0, '#e6c27a'], [1, '#7a5a2a']], 0, 0, 1, 1)}"/><circle cx="109" cy="158" r="8" fill="#b48d4c"/><rect x="104" y="40" width="10" height="14" rx="3" fill="#7a5a2a"/>`, fg: '' }; },
      vortex(b, p, rng) { let pg = ''; for (let i = 0; i < 34; i++) { const t = i / 34, a = t * 9, r = 8 + t * 100, x = 109 + Math.cos(a) * r, y = 112 + Math.sin(a) * r * .6; pg += `<rect transform="rotate(${r1(a * 57)} ${r1(x)} ${r1(y)})" x="${r1(x - 5)}" y="${r1(y - 7)}" width="10" height="14" fill="#f4ead2" opacity="${r1(.35 + t * .6)}"/>`; } return { bg: `<rect width="${AW}" height="${AH}" fill="${b.rad([[0, '#3a2a5a'], [1, '#08060f']])}"/>`, mid: pg, fg: b.glow(109, 112, 30, '#d9c9ff', .7) }; },
      tide(b, p, rng) { let l = ''; for (let i = 0; i < 14; i++) { const x = 10 + i * 15, y = 140 + Math.sin(i * .7) * 22; l += b.glow(x, y, 12, '#ffd27a', .7) + `<rect x="${x - 2.5}" y="${r1(y - 4)}" width="5" height="8" rx="1" fill="#fff0c0"/>`; } return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#0c1424'], [1, '#1c2a40']])}"/>${[30, 80, 140, 190].map(x => `<path d="M${x} 224 V60 Q${x} 40 ${x + 20} 40" stroke="#2a3a50" stroke-width="10" fill="none"/>`).join('')}`, mid: `<path d="M0 150 Q55 110 109 150 T218 150" stroke="#9ff5ff" stroke-opacity=".25" stroke-width="20" fill="none"/>`, fg: l }; },
    },
    record: {
      ledger(b, p, rng) { return { bg: `<rect width="${AW}" height="${AH}" fill="#3a2a1a"/>`, mid: `<path d="M14 60 Q60 50 106 62 V200 Q60 188 14 198Z" fill="#f4ead2"/><path d="M112 62 Q158 50 204 60 V198 Q158 188 112 200Z" fill="#efe2c4"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<path d="M22 ${80 + i * 13}H98 M120 ${80 + i * 13}H196" stroke="#b8a888" stroke-width=".8"/>`).join('')}${scribble(rng, 24, 78, 70, 8, 13, '#2a2a5a')}${scribble(rng, 122, 78, 70, 6, 13, '#2a2a5a')}`, fg: `<path d="M170 30 l-40 70" stroke="#e8e0d0" stroke-width="3"/><path d="M170 30 q16 -10 22 -26 q-20 8 -30 30z" fill="#f4ead2"/><ellipse cx="190" cy="210" rx="14" ry="6" fill="#120a04"/>` }; },
      note(b, p, rng) { return { bg: `<rect width="${AW}" height="${AH}" fill="#8a6a42"/>${dots(rng, 60, 0, 0, AW, AH, '#5a3a1a', .5, 1.6, .4)}`, mid: `<g transform="rotate(-4 109 120)"><rect x="40" y="40" width="138" height="150" fill="#fbf5e6"/><path d="M52 66 H166 M52 88 H140" stroke="#2a2420" stroke-width="7" stroke-linecap="round"/>${scribble(rng, 54, 112, 100, 4, 14, '#5a4a40', 1.2)}</g>`, fg: `<circle cx="109" cy="46" r="7" fill="#c03a2a"/><circle cx="107" cy="44" r="2" fill="#fff" opacity=".6"/>` }; },
      census(b, p, rng) { let e = ''; for (let i = 0; i < 9; i++) { const x = 20 + rng() * 178, y = 130 + rng() * 80; e += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="3.4" ry="2.2" fill="#ffe680"/><ellipse cx="${r1(x + 10)}" cy="${r1(y)}" rx="3.4" ry="2.2" fill="#ffe680"/>`; } return { bg: `<rect width="${AW}" height="${AH}" fill="#06050a"/><rect y="0" width="${AW}" height="104" fill="#3a2a40"/><rect y="98" width="${AW}" height="10" fill="#6a4a3a"/>`, mid: e, fg: `<g transform="rotate(6 160 60)"><rect x="120" y="14" width="80" height="80" fill="#f4ead2"/>${[0, 1, 2, 3, 4].map(i => `<path d="M130 ${30 + i * 13} h${20 + i * 8}" stroke="#2a2a2a" stroke-width="1.6"/><path d="M176 ${24 + i * 13} l4 8" stroke="#8a2a2a" stroke-width="1.6"/>`).join('')}</g>` }; },
      blueprint(b, p) { let g = ''; for (let i = 0; i <= 218; i += 12) g += `<path d="M${i} 0V${AH}M0 ${i}H${AW}" stroke="#bfe0ff" stroke-opacity=".12"/>`; return { bg: `<rect width="${AW}" height="${AH}" fill="#14366a"/>${g}`, mid: `<rect x="70" y="50" width="78" height="140" fill="none" stroke="#eaf6ff" stroke-width="2.5"/><path d="M78 58 H140 V182 H78Z" fill="none" stroke="#eaf6ff" stroke-width="1" stroke-dasharray="3 3"/><circle cx="132" cy="122" r="4" fill="none" stroke="#eaf6ff" stroke-width="2"/><path d="M70 204 H148 M70 199 v10 M148 199 v10 M160 50 V190 M155 50 h10 M155 190 h10" stroke="#eaf6ff" stroke-width="1.2"/>`, fg: `<text x="109" y="218" text-anchor="middle" font-family='${FONTS.mono}' font-size="8" fill="#eaf6ff" opacity=".7">DOOR · NO WALL REQ.</text>` }; },
      seal(b, p, rng) { return { bg: `<rect width="${AW}" height="${AH}" fill="#2a1c10"/>`, mid: `<path d="M36 36 H182 V196 Q172 206 162 196 Q152 186 142 196 Q132 206 122 196 Q112 186 102 196 Q92 206 82 196 Q72 186 62 196 Q52 206 36 196Z" fill="#efe2c0"/><path d="M60 62 H158" stroke="#3a2a1a" stroke-width="6"/>${scribble(rng, 56, 86, 104, 5, 14, '#4a3a2a', 1.1)}`, fg: `<path d="M118 158 l-10 50 l14 -10 l6 14 l4 -52z" fill="#7d1b22"/><circle cx="124" cy="160" r="20" fill="#9a2228"/><path d="${starPath(124, 160, 11, 4, 4)}" fill="#6a1016"/>` }; },
    },
    discovery: {
      orrery(b, p, rng) { const rings = [30, 52, 74, 94].map((r, i) => `<ellipse cx="109" cy="118" rx="${r}" ry="${r1(r * .36)}" fill="none" stroke="#c9a25a" stroke-width="2"/>`).join(''); const pl = [30, 52, 74, 94].map((r, i) => { const a = rng() * 6.28; return `<circle cx="${r1(109 + Math.cos(a) * r)}" cy="${r1(118 + Math.sin(a) * r * .36)}" r="${5 + i}" fill="${['#9fd6ff', '#e8a060', '#7fcf9a', '#c9a2ff'][i]}"/>`; }).join(''); return { bg: `<rect width="${AW}" height="${AH}" fill="${b.rad([[0, '#3a2a14'], [1, '#0c0804']])}"/>`, mid: rings + `${b.glow(109, 118, 30, '#ffd27a', .9)}<circle cx="109" cy="118" r="12" fill="#ffd27a"/><path d="M109 130 V206 M90 206 H128" stroke="#b48d4c" stroke-width="4"/>`, fg: pl }; },
      mask(b, p) { return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#2a2016'], [1, '#0c0804']])}"/>${b.glow(109, 100, 100, '#f4dca0', .25)}`, mid: `<path d="M109 34 C150 34 164 70 162 110 C160 160 136 196 109 200 C82 196 58 160 56 110 C54 70 68 34 109 34Z" fill="${b.lin([[0, '#e8d6b0'], [1, '#9a8060']], 0, 0, 1, 1)}"/><path d="M76 104 q14 -12 28 0 q-14 10 -28 0z M114 104 q14 -12 28 0 q-14 10 -28 0z" fill="#120a04"/><path d="M98 150 q11 8 22 0" stroke="#5a4020" stroke-width="3" fill="none"/><path d="M109 42 V86 M70 70 q39 -24 78 0" stroke="#b48d4c" stroke-width="3" fill="none"/>`, fg: `<path d="M56 112 q-18 0 -22 20 M162 112 q18 0 22 20" stroke="#b48d4c" stroke-width="3" fill="none"/>` }; },
      compass(b, p) { let t = ''; for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, r0 = i % 4 ? 70 : 62; t += `<path d="M${r1(109 + Math.cos(a) * r0)} ${r1(118 + Math.sin(a) * r0)} L${r1(109 + Math.cos(a) * 76)} ${r1(118 + Math.sin(a) * 76)}" stroke="#5a4020" stroke-width="1.5"/>`; } return { bg: `<rect width="${AW}" height="${AH}" fill="#2a1e12"/>`, mid: `<circle cx="109" cy="118" r="82" fill="${b.lin([[0, '#f0e2c0'], [1, '#c8b088']])}" stroke="#b48d4c" stroke-width="6"/>${t}<path d="${starPath(109, 118, 58, 14, 4)}" fill="#e8d6b0" stroke="#5a4020"/>`, fg: [0, 1, 2, 3].map(i => `<path transform="rotate(${i * 90 + 45} 109 118)" d="M109 52 L104 74 L114 74Z" fill="#8a2a2a"/>`).join('') + `<circle cx="109" cy="118" r="6" fill="#b48d4c"/>` }; },
      fossil(b, p) { let sp = 'M109 118'; for (let i = 1; i < 120; i++) { const a = i * .16, r = 2 + i * .62; sp += ` L${r1(109 + Math.cos(a) * r)} ${r1(118 + Math.sin(a) * r)}`; } let ch = ''; for (let i = 6; i < 120; i += 7) { const a = i * .16, r = 2 + i * .62; ch += `<path d="M${r1(109 + Math.cos(a) * r * .55)} ${r1(118 + Math.sin(a) * r * .55)} L${r1(109 + Math.cos(a) * r)} ${r1(118 + Math.sin(a) * r)}" stroke="#5a4a30" stroke-width="1.2"/>`; } return { bg: `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#8a7458'], [1, '#4a3a28']])}"/><rect y="40" width="${AW}" height="6" fill="#3a2a18" opacity=".5"/><rect y="190" width="${AW}" height="5" fill="#3a2a18" opacity=".5"/>`, mid: `<circle cx="109" cy="118" r="78" fill="#c8b48c" opacity=".55"/><path d="${sp}" fill="none" stroke="#3a2a18" stroke-width="3"/>${ch}`, fg: '' }; },
    },
  };
  // ------------------------------------------------------------------ legendary beings: silhouettes over the night backdrop
  const BEINGS = {
    stag(b, p, rng) { const st = [[60, 54], [64, 66], [78, 30], [96, 32], [114, 66], [106, 40], [124, 44]]; return `<path d="M60 112 L70 104 L80 100 L84 90 L88 102 L96 110 Q104 124 120 124 L160 122 Q172 122 176 132 L178 150 Q176 160 168 162 L166 196 L160 196 L158 166 L150 160 L146 196 L140 196 L138 160 L108 160 L104 196 L98 196 L96 160 L90 156 L88 196 L82 196 L80 152 Q76 140 78 128 L74 120 L64 118Z" fill="#05061a" stroke="#3a3a7a" stroke-width="1"/><path d="M82 98 Q74 70 86 44 M80 80 L64 66 M78 64 L60 54 M86 44 L78 30 M86 44 L96 32 M86 98 Q98 72 112 52 M100 72 L114 66 M108 58 L106 40 M112 52 L124 44" stroke="#f0c867" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".9"/>${st.map(s => b.glow(s[0], s[1], 8, '#fff6c8', .9) + `<circle cx="${s[0]}" cy="${s[1]}" r="1.8" fill="#fff"/>`).join('')}<path d="M40 196 H200" stroke="#2a2a5a" stroke-width="2"/>`; },
    moth(b, p, rng) { let keys = ''; for (let i = 0; i < 12; i++) { const s = i < 6 ? -1 : 1, x = 109 + s * (30 + (i % 6) * 10), y = 80 + (i % 3) * 24; keys += `<g transform="translate(${x} ${y}) rotate(${s * 30})"><circle r="3.4" fill="none" stroke="#f0c867" stroke-width="1.4"/><path d="M0 3.4 V11 M0 8 h3" stroke="#f0c867" stroke-width="1.4"/></g>`; } return `<path d="M109 70 C70 20 14 40 22 96 C28 130 76 128 104 108 C78 140 60 176 90 182 C104 184 108 150 109 130 C110 150 114 184 128 182 C158 176 140 140 114 108 C142 128 190 130 196 96 C204 40 148 20 109 70Z" fill="#14102a" stroke="#f0c867" stroke-opacity=".5"/><path d="M109 66 V170" stroke="#2a2040" stroke-width="10" stroke-linecap="round"/><path d="M106 66 q-10 -24 -24 -30 M112 66 q10 -24 24 -30" stroke="#f0c867" stroke-width="1.4" fill="none"/>${keys}`; },
    whale(b, p, rng) { let l = ''; [[62, 120], [92, 132], [124, 134], [154, 124]].forEach(([x, y]) => { l += `<path d="M${x} ${y} v${18 + rng() * 10}" stroke="#d8c27a" stroke-width="1"/>` + b.glow(x, y + 30, 12, '#ffd27a', .8) + `<rect x="${x - 3}" y="${y + 26}" width="6" height="9" rx="1.5" fill="#fff0c0"/>`; }); return `<path d="M20 96 C40 60 120 52 170 76 C186 84 196 70 206 56 C204 76 200 92 190 98 C200 110 206 118 204 128 C192 116 182 110 172 112 C130 132 60 132 30 116 C22 112 18 104 20 96Z" fill="#0a0c24" stroke="#7f8fff" stroke-opacity=".35"/><circle cx="48" cy="96" r="2.4" fill="#cfe0ff"/>${l}`; },
    serpent(b, p, rng) { let sc = ''; for (let i = 0; i < 26; i++) { const t = i / 25, x = 30 + t * 160, y = 112 + Math.sin(t * 9) * 46; sc += `<rect x="${r1(x - 4)}" y="${r1(y - 3)}" width="8" height="6" rx="1" fill="#f0c867" opacity="${r1(.4 + (i % 3) * .2)}"/>`; } return `<path d="M24 120 C50 40 80 40 96 110 C110 170 140 170 160 100 C172 60 196 60 200 90" fill="none" stroke="#0a0c24" stroke-width="22" stroke-linecap="round"/><path d="M24 120 C50 40 80 40 96 110 C110 170 140 170 160 100 C172 60 196 60 200 90" fill="none" stroke="#3a3a7a" stroke-width="2" stroke-dasharray="2 5"/>${sc}<circle cx="198" cy="88" r="2.6" fill="#fff6c8"/>`; },
    keeper(b, p, rng) { let cards = ''; for (let i = 0; i < 9; i++) { const a = -2.6 + i * .4; cards += `<rect transform="rotate(${r1(a * 57 + 90)} ${r1(109 + Math.cos(a) * 70)} ${r1(84 + Math.sin(a) * 60)})" x="${r1(109 + Math.cos(a) * 70 - 6)}" y="${r1(84 + Math.sin(a) * 60 - 8)}" width="12" height="16" fill="#f4ead2" opacity=".85"/>`; } return `${cards}<path d="M109 46 C96 46 92 58 92 66 C80 74 74 100 70 140 C66 172 62 196 58 206 H160 C156 196 152 172 148 140 C144 100 138 74 126 66 C126 58 122 46 109 46Z" fill="#0a0812"/><path d="M98 72 q11 10 22 0" stroke="#f0c867" stroke-width="1.4" fill="none" opacity=".7"/><path d="M146 120 l10 30" stroke="#b48d4c" stroke-width="2"/>${b.glow(158, 158, 18, '#ffd27a', .9)}<rect x="153" y="150" width="10" height="14" rx="2" fill="#fff0c0"/>`; },
  };

  // ------------------------------------------------------------------ illustration for a card spec → { defs, bg, mid, fg, style }
  function illustration(spec) {
    const it = D.ITEMS[spec.base], meta = it.card, p = it.pal, alt = spec.card && spec.card.alt, seed = (spec.seed >>> 0) || 1;
    const rng = U.mulberry32((meta.no * 2654435761 ^ (alt ? 0x9e3779b9 : 0)) >>> 0), b = mkB('k' + U.uid('').slice(1) + 'x');
    const subj = meta.subject || 'null'; let L = { bg: '', mid: '', fg: '' };
    if (subj.startsWith('item:')) {
      const iid = subj.slice(5), fn = AV.art && AV.art.ITEM_ART[iid], ip = D.ITEMS[iid].pal;
      L.bg = (BACKDROP[meta.cls] || BACKDROP.creature)(b, p, rng);
      const sz = alt ? 196 : 168, ox = 109 - sz / 2, oy = 118 - sz / 2;
      L.mid = fn ? `<svg x="${ox}" y="${oy}" width="${sz}" height="${sz}" viewBox="0 0 200 200" overflow="visible">${fn(ip, b.defs.length + 'q' + U.uid('i'))}</svg>` : '';
      L.fg = dots(rng, meta.cls === 'oddity' ? 0 : 10, 10, 20, 208, 200, mix(p[3], '#ffffff', .5), .4, 1.2, .2);
    } else if (subj.startsWith('scene:')) {
      const [, kind, v] = subj.split(':'), fn = SCENES[kind] && SCENES[kind][v];
      L = fn ? fn(b, p, rng) : L;
    } else if (subj.startsWith('being:')) {
      L.bg = BACKDROP.being(b, p, rng); L.mid = (BEINGS[subj.slice(6)] || BEINGS.keeper)(b, p, rng); L.fg = dots(rng, 14, 0, 0, AW, AH, '#fff6c8', .5, 1.4, .3);
    } else { // null stock: an illustration that is mostly not there
      let blocks = ''; for (let i = 0; i < 40; i++) blocks += `<rect x="${r1(rng() * 210)}" y="${r1(rng() * 220)}" width="${r1(6 + rng() * 40)}" height="${r1(2 + rng() * 10)}" fill="${['#ff00ff', '#00ffcc', '#000000', '#ffffff'][Math.floor(rng() * 4)]}" opacity="${r1(.4 + rng() * .6)}"/>`;
      let chk = ''; for (let y = 0; y < 224; y += 28) for (let x = 0; x < 218; x += 28) if (((x + y) / 28) % 2 === 0) chk += `<rect x="${x}" y="${y}" width="28" height="28" fill="#ff00ff"/>`;
      L = { bg: `<rect width="${AW}" height="${AH}" fill="#000"/>${chk}`, mid: `<text x="109" y="128" text-anchor="middle" font-family='${FONTS.mono}' font-size="34" font-weight="500" fill="#fff">404</text><text x="111" y="130" text-anchor="middle" font-family='${FONTS.mono}' font-size="34" font-weight="500" fill="#00ffcc" opacity=".5">404</text>`, fg: blocks };
    }
    if (alt && !subj.startsWith('item:')) { const flip = s => `<g transform="translate(${AW} 0) scale(-1 1)">${s}</g>`; L = { bg: flip(L.bg), mid: flip(L.mid), fg: flip(L.fg) }; }
    // specimen variants act on the illustration only, so the printed text stays legible
    const v = spec.variant || 'none', VF = { inverted: 'invert(1) hue-rotate(180deg)', shadow: 'brightness(.55) saturate(.7) hue-rotate(240deg)', golden: 'sepia(.85) saturate(1.6) hue-rotate(-8deg) brightness(1.08)', corrupted: 'saturate(1.8) hue-rotate(-30deg) contrast(1.2)', glitched: 'hue-rotate(150deg) saturate(1.6)', celestial: 'hue-rotate(200deg) saturate(1.2) brightness(.85)', prismatic: 'saturate(1.6)', holographic: 'saturate(1.25) brightness(1.06)' };
    let over = '';
    if (v === 'celestial') over = dots(U.mulberry32(seed), 40, 0, 0, AW, AH, '#fff', .3, 1.2, .3);
    if (v === 'glitched' || v === 'corrupted') { const rr = U.mulberry32(seed); for (let i = 0; i < 6; i++) over += `<rect x="0" y="${r1(rr() * 220)}" width="${AW}" height="${r1(2 + rr() * 5)}" fill="${v === 'glitched' ? '#00ffd0' : '#ff2a4a'}" opacity=".35"/>`; }
    if (v === 'holographic' || v === 'prismatic' || v === 'foil') over += `<rect width="${AW}" height="${AH}" fill="${b.lin([[0, '#ff7ad1', .0], [.3, '#ffd27a', .16], [.5, '#7affd7', .2], [.7, '#7ab6ff', .16], [1, '#c9a2ff', 0]], 0, 0, 1, 1)}"/>`;
    return { defs: b.defs.join(''), bg: L.bg, mid: L.mid, fg: L.fg + over, style: VF[v] || '' }; // printed cards ignore the specimen palette shift
  }
  /** Standalone SVG document for an illustration layer set (for <img>/canvas). layers: 'all' | 'bg' | 'mid' | 'fg'. view: [x, y, w, h] in the 218 × 224 space. */
  function illusDoc(il, layers = 'all', view = [0, 0, AW, AH], px = [AW * 2, AH * 2]) {
    const body = layers === 'all' ? il.bg + il.mid + il.fg : il[layers];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${px[0]}" height="${px[1]}" viewBox="${view.join(' ')}" preserveAspectRatio="xMidYMid slice"><defs>${il.defs}</defs><g style="filter:${il.style || 'none'}">${body}</g></svg>`;
  }

  // ------------------------------------------------------------------ layout (card units). Returns { ops, art: { x, y, w, h, r, view }, regions }
  const SYMBOLS = { // 24-unit glyphs, original
    star: 'M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8Z',
    key: 'M12 3a5 5 0 0 1 2.6 9.3L16 21H8l1.4-8.7A5 5 0 0 1 12 3z',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10zm2.6 0h4.8V7a2.4 2.4 0 0 0-4.8 0z',
  };
  function glyphD(rid) { const g = D.RARITY[rid].glyph; const m = /d="([^"]+)"/.exec(g); if (m) return { d: m[1], rule: /evenodd/.test(g) ? 'evenodd' : 'nonzero' }; const c = /cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/.exec(g); return { d: `M${+c[1] - +c[3]} ${c[2]}a${c[3]} ${c[3]} 0 1 0 ${2 * c[3]} 0a${c[3]} ${c[3]} 0 1 0 ${-2 * c[3]} 0`, rule: 'nonzero' }; }
  function wrap(text, n) { const out = []; let line = ''; text.split(' ').forEach(w => { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; }); if (line.trim()) out.push(line.trim()); return out; }
  const FRAME = [ // per material tier: frame fill, inner panel, plate, text box, ink
    { frame: { g: 'lin', x1: 0, y1: 0, x2: 1, y2: 1, stops: [[0, '#ddd3bf'], [1, '#c9bea6']] }, edge: '#b8ad96', plate: '#f3ead6', box: '#f6efe0', ink: '#2a241c' },
    { frame: { g: 'lin', x1: 0, y1: 0, x2: 1, y2: 1, stops: [[0, '#d2ccc0'], [.5, '#ece6da'], [1, '#bdb6a8']] }, edge: '#a9a294', plate: '#f6efe0', box: '#f7f1e4', ink: '#24201a' },
    { frame: { g: 'lin', x1: 0, y1: 0, x2: 1, y2: 1, stops: [[0, '#8a6630'], [.35, '#f2d98c'], [.6, '#b48d4c'], [1, '#6c5020']] }, edge: '#5a4018', plate: '#f8efd6', box: '#f7f0de', ink: '#2a2014' },
    { frame: { g: 'lin', x1: 0, y1: 0, x2: 1, y2: 1, stops: [[0, '#9fd6ff'], [.3, '#e3b6ff'], [.55, '#b6ffe4'], [.8, '#ffe6a6'], [1, '#9fb6ff']] }, edge: '#6a6aa0', plate: '#f4f2ff', box: '#f3f1fb', ink: '#1c1a2e' },
    { frame: { g: 'lin', x1: 0, y1: 0, x2: 1, y2: 1, stops: [[0, '#1c1530'], [.5, '#2c2050'], [1, '#120d22']] }, edge: '#ff7ad1', plate: '#efe8ff', pink: '#1c1530', box: '#1a1428', ink: '#efe8ff', dark: true },
    { frame: null, edge: '#e6c76a', plate: 'rgba(14,10,6,.55)', box: 'rgba(12,8,4,.62)', ink: '#fbf2da', dark: true, borderless: true },
    { frame: null, edge: '#bff6ff', plate: 'rgba(4,10,24,.55)', box: 'rgba(4,10,24,.62)', ink: '#eafcff', dark: true, borderless: true },
    { frame: { g: 'lin', x1: 0, y1: 0, x2: 1, y2: 0, stops: [[0, '#111'], [1, '#222']] }, edge: '#ff00ff', plate: '#0c0c0c', box: '#0c0c0c', ink: '#f0f0f0', dark: true, nul: true },
  ];
  function layout(spec) {
    const it = D.ITEMS[spec.base], meta = it.card, R = D.RARITY[it.rarity], tier = R.tier, set = CD.SET[meta.set], cls = CD.CLASSES[meta.cls], c = spec.card || {};
    const proof = spec.form && /_proof$/.test(spec.form), living = spec.form && /_living$/.test(spec.form);
    const F = Object.assign({}, FRAME[tier]); if (proof) Object.assign(F, FRAME[5], { edge: '#f2d98c' });
    const bl = !!F.borderless, ops = [], add = o => (ops.push(o), o), p = it.pal;
    // stock + frame
    if (bl) add({ k: 'rect', x: 0, y: 0, w: W, h: H, r: 12, fill: '#120c06' });
    else { add({ k: 'rect', x: 0, y: 0, w: W, h: H, r: 12, fill: F.frame }); add({ k: 'rect', x: 9, y: 9, w: W - 18, h: H - 18, r: 7, fill: F.dark ? '#140f1e' : p[2] }); }
    const altArt = !!c.alt && !bl;
    const art = bl ? { x: 0, y: 0, w: W, h: H, r: 12, view: [29, 0, 160, 224] } : altArt ? { x: 16, y: 16, w: 218, h: 216, r: 4, view: [0, 4, AW, 216] } : { x: 16, y: 52, w: 218, h: 160, r: 4, view: [0, 30, AW, 160] };
    add({ k: 'art', x: art.x, y: art.y, w: art.w, h: art.h, r: art.r });
    if (!bl) add({ k: 'rect', x: art.x, y: art.y, w: art.w, h: art.h, r: art.r, stroke: tier >= 2 ? '#f2d98c' : shade(p[1], .8), sw: 1.6, fill: 'none' });
    // name plate
    const nameFs = Math.min(16, 164 / (it.name.length * .52));
    add({ k: 'rect', x: 16, y: 16, w: 218, h: 30, r: 4, fill: altArt ? 'rgba(244,234,210,.86)' : F.plate, region: 'plate' });
    add({ k: 'text', x: 24, y: 36.5, t: it.name, font: 'serif', size: nameFs, weight: 600, fill: altArt ? '#24201a' : (F.pink || F.ink), region: 'plate' });
    const g = glyphD(R.id);
    const lightPlate = altArt || !(bl || F.nul);
    add({ k: 'path', d: g.d, rule: g.rule, x: 196, y: 21, s: .82, fill: R.color, stroke: lightPlate ? 'rgba(0,0,0,.35)' : 'none', sw: .8, region: 'plate' });
    add({ k: 'path', d: SYMBOLS[set.symbol], x: 214, y: 21, s: .78, fill: lightPlate ? shade(set.color, .7) : set.color, region: 'plate' });
    // class strip and number
    const sy = bl ? 228 : altArt ? 236 : 216;
    add({ k: 'rect', x: 16, y: sy, w: 218, h: 16, r: 2, fill: F.dark ? 'rgba(0,0,0,.55)' : shade(p[2], .9), region: 'strip' });
    add({ k: 'text', x: 22, y: sy + 11.6, t: cls.name.toUpperCase(), font: 'cond', size: 9.5, weight: 600, ls: 1.6, fill: F.dark ? '#f0e6cc' : mix(p[3], '#ffffff', .4) });
    add({ k: 'text', x: 228, y: sy + 11.4, t: CD.number(it), font: 'mono', size: 8.2, weight: 500, fill: F.dark ? '#f0e6cc' : mix(p[3], '#ffffff', .3), anchor: 'end' });
    // archive text box
    const by = sy + 20, bh = H - 16 - 22 - by;
    add({ k: 'rect', x: 16, y: by, w: 218, h: bh, r: 3, fill: F.box, region: 'box' });
    wrap(it.lore, 44).slice(0, Math.floor((bh - 8) / 12.4)).forEach((ln, i) => add({ k: 'text', x: 24, y: by + 15 + i * 12.4, t: ln, font: 'serif', size: 10.6, weight: 600, style: 'italic', fill: F.ink }));
    // imprint line, edition mark, serial
    const iy = H - 22;
    add({ k: 'text', x: 18, y: iy + 6, t: 'Illus. ' + meta.imprint + ' · ' + set.code, font: 'sans', size: 6.6, fill: F.dark || bl ? '#d9cfb8' : mix(p[3], '#ffffff', .2) });
    if (tier >= 2 || proof) add({ k: 'text', x: 232, y: iy + 6, t: 'No. ' + String(spec.serial || 0).padStart(4, '0'), font: 'mono', size: 6.8, fill: bl || F.dark ? '#f2d98c' : mix(p[3], '#ffffff', .3), anchor: 'end' });
    const ed = CD.EDITION[c.edition];
    if ((ed && ed.short) || proof) { const t = proof ? 'PROOF' : ed.short, ex = tier >= 2 ? 176 : 222; add({ k: 'rect', x: ex - 16, y: iy - 2.5, w: 30, h: 11, r: 5.5, fill: proof || c.edition === 'proof' ? '#8a2a2a' : '#1c1814', stroke: '#f2d98c', sw: .8 }); add({ k: 'text', x: ex - 1, y: iy + 5.6, t, font: 'cond', size: 7.2, weight: 600, ls: .8, fill: '#f2d98c', anchor: 'middle' }); }
    if (spec.fusion && spec.fusion.rank != null) { const fx = 58, fy = iy - 2.5; add({ k: 'rect', x: fx, y: fy, w: 52, h: 11, r: 5.5, fill: '#1c1814', stroke: spec.fusion.tint || '#f2d98c', sw: .9 }); add({ k: 'text', x: fx + 26, y: iy + 5.6, t: 'FUSED' + (spec.fusion.rank ? ' ' + '★'.repeat(spec.fusion.rank) : ''), font: 'cond', size: 7, weight: 600, ls: .8, fill: spec.fusion.tint || '#f2d98c', anchor: 'middle' }); }
    if (living) add({ k: 'text', x: 125, y: art.y + art.h - 6, t: 'LIVING PRINT', font: 'cond', size: 7.5, weight: 600, ls: 2.4, fill: '#bff6ff', anchor: 'middle', op: .85 });
    // gilt / dyed edge line
    if (bl || tier >= 4) add({ k: 'rect', x: 1.2, y: 1.2, w: W - 2.4, h: H - 2.4, r: 11, fill: 'none', stroke: F.edge, sw: 2.4 });
    if (F.nul) { const rr = U.mulberry32((spec.seed >>> 0) || 7); for (let i = 0; i < 7; i++) add({ k: 'rect', x: rr() * 220, y: rr() * 330, w: 10 + rr() * 40, h: 4 + rr() * 14, r: 0, fill: rr() < .5 ? '#ff00ff' : '#00ffcc', op: .85 }); }
    // print condition: corner whitening, scratches, crease
    const cond = spec.condition || 0;
    if (cond >= 2) { const a = [0, 0, .25, .55, .8][cond]; [[3, 3], [W - 3, 3], [3, H - 3], [W - 3, H - 3]].forEach(([x, y]) => add({ k: 'circle', cx: x, cy: y, r: 3 + cond, fill: '#fffaf0', op: a })); }
    if (cond >= 3) { const rr = U.mulberry32(((spec.seed >>> 0) || 3) ^ 77); for (let i = 0; i < cond * 3; i++) { const x = rr() * W, y = rr() * H; add({ k: 'path', d: `M${r1(x)} ${r1(y)} l${r1((rr() - .5) * 40)} ${r1((rr() - .5) * 12)}`, stroke: '#fffaf0', sw: .6, fill: 'none', op: .35 }); } }
    if (cond >= 4) add({ k: 'path', d: `M0 ${H * .62} L${W} ${H * .48}`, stroke: '#fffaf0', sw: 1.4, fill: 'none', op: .5 });
    return { ops, art, tier, borderless: bl, F, proof, living };
  }

  // ------------------------------------------------------------------ SVG backend
  function paintSVG(f, defs) { if (!f || typeof f === 'string') return f || 'none'; const id = 'cg' + U.uid('').slice(1) + defs.length; const st = f.stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join(''); defs.push(f.g === 'lin' ? `<linearGradient id="${id}" x1="${f.x1}" y1="${f.y1}" x2="${f.x2}" y2="${f.y2}">${st}</linearGradient>` : `<radialGradient id="${id}">${st}</radialGradient>`); return `url(#${id})`; }
  function opsSVG(ops, artSVG) {
    const defs = []; let out = '';
    ops.forEach(o => {
      const op = o.op != null ? ` opacity="${o.op}"` : '';
      if (o.k === 'rect') out += `<rect x="${r1(o.x)}" y="${r1(o.y)}" width="${r1(o.w)}" height="${r1(o.h)}" rx="${o.r || 0}" fill="${paintSVG(o.fill, defs)}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}${op}/>`;
      else if (o.k === 'circle') out += `<circle cx="${r1(o.cx)}" cy="${r1(o.cy)}" r="${r1(o.r)}" fill="${paintSVG(o.fill, defs)}"${op}/>`;
      else if (o.k === 'path') out += `<path d="${o.d}"${o.x != null ? ` transform="translate(${o.x} ${o.y}) scale(${o.s || 1})"` : ''} fill="${paintSVG(o.fill, defs)}"${o.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}${o.stroke && o.stroke !== 'none' ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}${op}/>`;
      else if (o.k === 'text') out += `<text x="${r1(o.x)}" y="${r1(o.y)}" font-family='${FONTS[o.font]}' font-size="${r1(o.size)}" font-weight="${o.weight || 400}"${o.style ? ` font-style="${o.style}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''} text-anchor="${o.anchor || 'start'}" fill="${o.fill}"${op}>${esc(o.t)}</text>`;
      else if (o.k === 'art') { const id = 'cc' + U.uid('').slice(1); defs.push(`<clipPath id="${id}"><rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.r}"/></clipPath>`); out += `<g clip-path="url(#${id})">${artSVG(o)}</g>`; }
    });
    return `<defs>${defs.join('')}</defs>${out}`;
  }
  /** Inline SVG (inner markup for a 0 0 200 200 viewBox) of a card's front. spec may be a base id (catalogue/codex). */
  function svg(specOrBase, o = {}) {
    const spec = typeof specOrBase === 'string' ? { base: specOrBase, seed: 1, serial: 0, condition: 1, card: { finish: 'satin', foil: 'none', edition: 'unlimited', alt: 0 } } : specOrBase;
    const L = layout(spec), il = illustration(spec), k = 186 / H;
    const inner = opsSVG(L.ops, a => `<svg x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" viewBox="${L.art.view.join(' ')}" preserveAspectRatio="xMidYMid slice"><defs>${il.defs}</defs><g style="filter:${il.style || 'none'}">${il.bg}${il.mid}${il.fg}</g></svg>`);
    return `<ellipse cx="100" cy="194" rx="62" ry="5" fill="#000" opacity=".28"/><g class="card-face" transform="translate(${r1((200 - W * k) / 2)} 4) scale(${r1(k * 1000) / 1000})">${inner}</g>`;
  }
  /** The shared card back (also used by 2D flips in pack openings). */
  function backOps(edition) {
    const ops = [{ k: 'rect', x: 0, y: 0, w: W, h: H, r: 12, fill: { g: 'lin', x1: 0, y1: 0, x2: 1, y2: 1, stops: [[0, '#1c1916'], [1, '#0f0d0b']] } }, { k: 'rect', x: 8, y: 8, w: W - 16, h: H - 16, r: 8, fill: 'none', stroke: '#b48d4c', sw: 2 }, { k: 'rect', x: 14, y: 14, w: W - 28, h: H - 28, r: 6, fill: 'none', stroke: '#6c5429', sw: 1 }];
    for (let i = 0; i < 20; i++) ops.push({ k: 'path', d: `M14 ${20 + i * 16} L${W - 14} ${4 + i * 16}`, stroke: '#2a2620', sw: 1, fill: 'none' });
    [70, 56].forEach((r, i) => ops.push({ k: 'circle', cx: 125, cy: 168, r, fill: i ? '#15120f' : '#1f1b16' }));
    ops.push({ k: 'path', d: SYMBOLS.star, x: 125 - 44 * 1.0, y: 168 - 44, s: 3.66, fill: 'rgba(215,180,110,.16)', stroke: '#d7b46e', sw: .6 });
    ops.push({ k: 'path', d: 'M12 8 L16 12 L12 16 L8 12Z', x: 125 - 24, y: 168 - 24, s: 2, fill: '#d7b46e' });
    ops.push({ k: 'text', x: 125, y: 48, t: 'AETHERVAULT', font: 'cond', size: 17, weight: 600, ls: 5, fill: '#d7b46e', anchor: 'middle' });
    ops.push({ k: 'text', x: 125, y: 300, t: 'ARCHIVE CARD', font: 'cond', size: 11, weight: 600, ls: 4.5, fill: '#8a7448', anchor: 'middle' });
    ops.push({ k: 'text', x: 125, y: 318, t: 'Simulation only · no real value', font: 'sans', size: 6.5, fill: '#5a5040', anchor: 'middle' });
    if (edition === 'first' || edition === 'proof') ops.push({ k: 'text', x: 125, y: 266, t: edition === 'proof' ? 'CURATOR PROOF' : 'FIRST ARCHIVE EDITION', font: 'cond', size: 8, weight: 600, ls: 2, fill: '#b48d4c', anchor: 'middle' });
    return ops;
  }
  function backSVG(edition) { const k = 186 / H; return `<g transform="translate(${r1((200 - W * k) / 2)} 4) scale(${r1(k * 1000) / 1000})">${opsSVG(backOps(edition), () => '')}</g>`; }

  // ------------------------------------------------------------------ Canvas backend (3D textures)
  function paintCanvas(x, f) { if (!f || typeof f === 'string') return f; const gr = f.g === 'lin' ? x.createLinearGradient(f.x1 * W, f.y1 * H, f.x2 * W, f.y2 * H) : x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); f.stops.forEach(s => gr.addColorStop(s[0], s[1])); return gr; }
  function rr(x, a, b, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, h, r || 0); else x.rect(a, b, w, h); }
  /** artImg === 'cut' clears the art window at its place in the stacking order (3D layers show through it). */
  function opsCanvas(x, ops, artImg) {
    ops.forEach(o => {
      x.save(); if (o.op != null) x.globalAlpha = o.op;
      if (o.k === 'rect') { rr(x, o.x, o.y, o.w, o.h, o.r); if (o.fill && o.fill !== 'none') { x.fillStyle = paintCanvas(x, o.fill); x.fill(); } if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = o.sw || 1; x.stroke(); } }
      else if (o.k === 'circle') { x.beginPath(); x.arc(o.cx, o.cy, o.r, 0, Math.PI * 2); x.fillStyle = paintCanvas(x, o.fill); x.fill(); }
      else if (o.k === 'path') { if (o.x != null) { x.translate(o.x, o.y); x.scale(o.s || 1, o.s || 1); } const p = new Path2D(o.d); if (o.fill && o.fill !== 'none') { x.fillStyle = paintCanvas(x, o.fill); x.fill(p, o.rule || 'nonzero'); } if (o.stroke && o.stroke !== 'none') { x.strokeStyle = o.stroke; x.lineWidth = (o.sw || 1) / (o.s || 1); x.stroke(p); } }
      else if (o.k === 'text') { x.font = `${o.style || ''} ${o.weight || 400} ${o.size}px ${FONTS[o.font]}`; x.textAlign = o.anchor === 'end' ? 'right' : o.anchor === 'middle' ? 'center' : 'left'; x.textBaseline = 'alphabetic'; if ('letterSpacing' in x) x.letterSpacing = (o.ls || 0) + 'px'; x.fillStyle = o.fill; x.fillText(o.t, o.x, o.y); }
      else if (o.k === 'art' && artImg === 'cut') { rr(x, o.x, o.y, o.w, o.h, o.r); x.globalCompositeOperation = 'destination-out'; x.fill(); }
      else if (o.k === 'art' && artImg) { rr(x, o.x, o.y, o.w, o.h, o.r); x.clip(); x.drawImage(artImg, o.x, o.y, o.w, o.h); }
      x.restore();
    });
  }
  const imgCache = new Map();
  /** Promise<HTMLImageElement> of an SVG document (cached; the cache is small and keyed by the document text hash). */
  function svgImage(doc) {
    let h = 0; for (let i = 0; i < doc.length; i += 7) h = (h * 31 + doc.charCodeAt(i)) | 0; const key = h + ':' + doc.length;
    if (imgCache.has(key)) return imgCache.get(key);
    const p = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(doc); });
    imgCache.set(key, p); if (imgCache.size > 80) imgCache.delete(imgCache.keys().next().value); return p;
  }
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  /** Front face. o.cut: leave the art window transparent (the 3D card puts depth-separated layers behind it). Resolves a canvas. */
  async function faceCanvas(spec, o = {}) {
    const S = o.px || 768, L = layout(spec), il = illustration(spec), c = mkCanvas(Math.round(S * W / H), S), x = c.getContext('2d'), k = c.height / H;
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* draw with fallbacks */ } }
    const a = L.art, img = o.cut ? null : await svgImage(illusDoc(il, 'all', a.view, [Math.round(a.w * k * 1.2), Math.round(a.h * k * 1.2)]));
    x.scale(k, k);
    opsCanvas(x, L.ops, o.cut ? 'cut' : img);
    return c;
  }
  /** Depth layers of the illustration (bg, mid, fg) as canvases, for parallax. */
  async function layerCanvases(spec, px = 512) {
    const L = layout(spec), il = illustration(spec), a = L.art, ratio = a.h / a.w, w = px, h = Math.round(px * ratio);
    const out = {}; for (const ly of ['bg', 'mid', 'fg']) { const im = await svgImage(illusDoc(il, ly, a.view, [w, h])); const c = mkCanvas(w, h); if (im) c.getContext('2d').drawImage(im, 0, 0, w, h); out[ly] = c; }
    return { layers: out, rect: a };
  }
  /** R = foil strength, G = gloss (low roughness), B = art window. */
  function maskCanvas(spec, px = 256) {
    const L = layout(spec), c = mkCanvas(Math.round(px * W / H), px), x = c.getContext('2d'), k = px / H, it = D.ITEMS[spec.base], foil = (spec.card && spec.card.foil) || 'none', a = L.art;
    x.scale(k, k); x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    const fill = (col, f) => { x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = col; f(); x.restore(); };
    const frame = () => { rr(x, 0, 0, W, H, 12); x.fill(); };
    const win = () => { rr(x, a.x, a.y, a.w, a.h, a.r); x.fill(); };
    if (foil === 'spot') fill('#003000', () => { L.ops.filter(o => o.region === 'plate').forEach(o => { if (o.k === 'rect') { rr(x, o.x, o.y, o.w, o.h, o.r); x.fill(); } }); });
    if (foil === 'border') fill('#d00000', () => { x.beginPath(); x.rect(0, 0, W, H); x.rect(9, 9, W - 18, H - 18); x.fill('evenodd'); });
    if (foil === 'artfoil') fill('#c00000', win);
    if (foil === 'reverse') fill('#a00000', () => { x.beginPath(); x.rect(0, 0, W, H); x.rect(a.x, a.y, a.w, a.h); x.fill('evenodd'); });
    if (['holo', 'prism', 'starfield', 'aurora', 'nullfoil'].includes(foil)) { if (L.borderless) fill('#600000', frame); else { fill('#700000', () => { x.beginPath(); x.rect(0, 0, W, H); x.rect(9, 9, W - 18, H - 18); x.fill('evenodd'); }); fill('#5a0000', win); } }
    if (L.proof || L.borderless) fill('#300000', () => { x.beginPath(); x.rect(0, 0, W, H); x.rect(5, 5, W - 10, H - 10); x.fill('evenodd'); });
    // the printed text never carries foil: clear the plate, the class strip, the text box and the imprint line
    L.ops.filter(o => o.k === 'rect' && (o.region === 'box' || o.region === 'plate' || o.region === 'strip')).forEach(o => { x.fillStyle = '#000'; rr(x, o.x - 1, o.y - 1, o.w + 2, o.h + 2, o.r); x.fill(); });
    x.fillStyle = '#000'; x.fillRect(12, H - 30, W - 24, 16);
    fill('#0000ff', win); if (D.RARITY[it.rarity].tier >= 1) fill('#002800', () => { L.ops.filter(o => o.region === 'plate').forEach(o => { if (o.k === 'rect') { rr(x, o.x, o.y, o.w, o.h, o.r); x.fill(); } }); });
    return c;
  }
  let backC = {};
  function backCanvas(edition, px = 768) { const k2 = (edition || 'x') + px; if (backC[k2]) return backC[k2]; const c = mkCanvas(Math.round(px * W / H), px), x = c.getContext('2d'); x.scale(px / H, px / H); opsCanvas(x, backOps(edition), null); return (backC[k2] = c); }

  AV.cardArt = { W, H, AW, AH, layout, illustration, illusDoc, svg, backSVG, faceCanvas, layerCanvases, maskCanvas, backCanvas, svgImage, SCENES, BEINGS, FONTS };
})();
