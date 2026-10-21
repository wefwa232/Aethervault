/* AETHERVAULT — procedural SVG art. Original drawings only. 200x200 viewBox. pal = [main, accent, dark, light] */
(function () {
  const AV = (window.AV = window.AV || {});
  const D = AV.data, U = AV.util;

  // ---------- helpers ----------
  const lg = (id, c1, c2, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
  const rg = (id, c1, c2, cx = .5, cy = .4, r = .7) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
  const shadow = (rx = 52) => `<ellipse cx="100" cy="182" rx="${rx}" ry="8" fill="#000" opacity=".3"/>`;
  const eye = (x, y, r = 5, c = '#1b1030') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x + r * .32}" cy="${y - r * .34}" r="${r * .38}" fill="#fff"/>`;
  const star = (cx, cy, R, r, n = 5, rot = -90) => {
    let p = '';
    for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, rad = i % 2 ? r : R; p += (i ? 'L' : 'M') + (cx + Math.cos(a) * rad).toFixed(1) + ' ' + (cy + Math.sin(a) * rad).toFixed(1); }
    return p + 'Z';
  };
  const sparkle = (x, y, s, c = '#fff') => (x = +x, y = +y, s = +s, `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="${c}"/>`);

  // ---------- ITEM ART ----------
  const ART = {};

  ART.nimbit = (P, u) => `<defs>${rg(u + 'c', P[3], P[0], .4, .3, .85)}</defs>${shadow(44)}
    <g fill="url(#${u}c)" stroke="${P[1]}" stroke-width="2.5"><circle cx="66" cy="120" r="27"/><circle cx="134" cy="120" r="27"/><circle cx="100" cy="96" r="38"/><ellipse cx="100" cy="132" rx="46" ry="26"/></g>
    <path d="M101 50l-9 18h9l-6 16 17-22h-10l7-12z" fill="#ffe066" stroke="#e0a800" stroke-width="1.5" stroke-linejoin="round"/>
    ${eye(84, 116, 6)}${eye(116, 116, 6)}<path d="M93 128q7 7 14 0" fill="none" stroke="${P[2]}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="72" cy="128" r="5" fill="#ff9ac0" opacity=".65"/><circle cx="128" cy="128" r="5" fill="#ff9ac0" opacity=".65"/>`;

  ART.nimbus = (P, u) => `<defs>${rg(u + 'c', P[3], P[0], .4, .25, .9)}${lg(u + 'b', P[1], P[2])}</defs>${shadow(56)}
    <g fill="url(#${u}c)" stroke="${P[1]}" stroke-width="2.5"><circle cx="52" cy="118" r="22"/><circle cx="148" cy="118" r="22"/><circle cx="76" cy="88" r="30"/><circle cx="126" cy="86" r="32"/><circle cx="100" cy="76" r="30"/><ellipse cx="100" cy="124" rx="56" ry="34"/></g>
    <ellipse cx="100" cy="144" rx="44" ry="14" fill="url(#${u}b)" opacity=".45"/>
    <path d="M104 100l-14 24h12l-8 22 24-30h-14l10-16z" fill="#ffe066" stroke="#e0a800" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M70 104q8-8 16 0M114 104q8-8 16 0" fill="none" stroke="${P[2]}" stroke-width="3" stroke-linecap="round"/>${eye(78, 114, 5.5)}${eye(122, 114, 5.5)}
    ${sparkle(44, 70, 7, '#ffe066')}${sparkle(160, 62, 6, '#fff')}`;

  ART.tempestral = (P, u) => `<defs>${rg(u + 'c', '#8f7fe8', P[2], .4, .3, .9)}${lg(u + 'y', '#fff7a8', '#ffb800')}</defs>${shadow(58)}
    <path d="M62 66 40 24l32 22zM138 66l22-42-32 22z" fill="url(#${u}y)" stroke="#c98a00" stroke-width="2" stroke-linejoin="round"/>
    <g fill="url(#${u}c)" stroke="${P[3]}" stroke-width="2" stroke-opacity=".5"><circle cx="48" cy="112" r="24"/><circle cx="152" cy="112" r="24"/><circle cx="100" cy="102" r="52"/><circle cx="62" cy="144" r="22"/><circle cx="138" cy="144" r="22"/><ellipse cx="100" cy="140" rx="46" ry="26"/></g>
    <path d="M70 94l24 8-24 8zM130 94l-24 8 24 8z" fill="${P[1]}"/><circle cx="80" cy="102" r="3" fill="#fff"/><circle cx="120" cy="102" r="3" fill="#fff"/>
    <path d="M78 130l8 10 7-10 7 10 7-10 7 10 8-10" fill="none" stroke="${P[3]}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M100 150l-14 24h12l-8 18 22-28h-12z" transform="translate(30 -10)" fill="url(#${u}y)" stroke="#c98a00" stroke-width="1.5"/>`;

  ART.pluvia = (P, u) => `<defs>${lg(u + 'c', P[3], P[0], .3, 0, .7, 1)}${lg(u + 'd', '#d9fbff', P[1])}</defs>${shadow(40)}
    <path d="M100 26C100 26 44 86 44 126a56 56 0 0 0 112 0C156 86 100 26 100 26z" fill="url(#${u}c)" stroke="${P[1]}" stroke-width="3"/>
    <path d="M72 96q-8 20-4 36" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>
    <path d="M76 118q8 8 16 0M108 118q8 8 16 0" fill="none" stroke="${P[2]}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M92 134q8 6 16 0" fill="none" stroke="${P[2]}" stroke-width="3" stroke-linecap="round"/><circle cx="76" cy="130" r="6" fill="#ff9ac0" opacity=".5"/><circle cx="124" cy="130" r="6" fill="#ff9ac0" opacity=".5"/>
    ${[[30, 70, 8], [168, 90, 7], [24, 130, 6], [172, 142, 8], [150, 40, 6]].map(d => `<path d="M${d[0]} ${d[1] - d[2] * 1.5}q${d[2]} ${d[2] * 1.6} 0 ${d[2] * 2.2}q${-d[2]}-${d[2] * .6} 0-${d[2] * 2.2}z" fill="url(#${u}d)" stroke="${P[1]}" stroke-width="1.2"/>`).join('')}
    <path d="M88 34q12-12 24 0" fill="none" stroke="${P[3]}" stroke-width="3"/>`;

  ART.stormsovereign = (P, u) => `<defs>${rg(u + 'c', '#6a58d8', P[2], .4, .3, .9)}${lg(u + 'y', '#fffbc0', '#ffb800')}${rg(u + 'g', '#8a7bff55', '#8a7bff00', .5, .5, .5)}</defs>
    <circle cx="100" cy="100" r="96" fill="url(#${u}g)"/>${shadow(50)}
    <path d="M30 150 4 90l34 20-8-52 28 36L72 40l22 40" fill="none" stroke="url(#${u}y)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M170 150l26-60-34 20 8-52-28 36 18-54-22 40" fill="none" stroke="url(#${u}y)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M44 176q56-44 112 0l-14-90H58z" fill="${P[2]}" opacity=".9"/>
    <g fill="url(#${u}c)" stroke="${P[3]}" stroke-opacity=".5" stroke-width="2"><circle cx="100" cy="106" r="46"/><circle cx="62" cy="128" r="22"/><circle cx="138" cy="128" r="22"/></g>
    <path d="M58 62 64 26l18 24 18-34 18 34 18-24 6 36z" fill="url(#${u}y)" stroke="#c98a00" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M72 102l22 8-22 8zM128 102l-22 8 22 8z" fill="#fff6a0"/><circle cx="82" cy="110" r="3" fill="${P[2]}"/><circle cx="118" cy="110" r="3" fill="${P[2]}"/>
    <path d="M86 136q14 10 28 0" fill="none" stroke="${P[3]}" stroke-width="3.5" stroke-linecap="round"/>${sparkle(30, 40, 8, '#fff6a0')}${sparkle(172, 36, 8, '#fff6a0')}`;

  ART.emberkit = (P, u) => `<defs>${lg(u + 'c', P[0], '#e0601c')}${lg(u + 'f', '#ffe38a', '#ff7a1a')}</defs>${shadow(46)}
    <path d="M134 150q50-10 36-62-4 20-24 30-6-30-30-30z" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="2"/>
    <path d="M168 78q8-26-10-42-2 16-12 24 10 6 22 18z" fill="url(#${u}f)"/>
    <ellipse cx="96" cy="140" rx="40" ry="32" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="2"/><ellipse cx="96" cy="150" rx="22" ry="18" fill="${P[3]}" opacity=".9"/>
    <path d="M52 76 46 36l32 18zM140 76l6-40-32 18z" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="2" stroke-linejoin="round"/><path d="M56 70l-2-22 16 10zM136 70l2-22-16 10z" fill="${P[1]}"/>
    <circle cx="96" cy="88" r="42" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="2"/><ellipse cx="96" cy="102" rx="26" ry="20" fill="${P[3]}"/>
    ${eye(78, 86, 6)}${eye(114, 86, 6)}<path d="M90 98h12l-6 7z" fill="#2a1410"/><path d="M96 105q-6 6-12 2M96 105q6 6 12 2" fill="none" stroke="#2a1410" stroke-width="2" stroke-linecap="round"/>`;

  ART.grovewarden = (P, u) => `<defs>${lg(u + 'c', '#7cc67a', P[2])}${lg(u + 'b', '#c9b98e', '#6b5a38')}${rg(u + 'l', '#fff6c0', P[1], .5, .5, .6)}</defs>${shadow(64)}
    <path d="M22 132q-6-22 10-30 16-4 24 10v22z" fill="url(#${u}b)" stroke="#4a3a20" stroke-width="2.5" stroke-linejoin="round"/>${eye(38, 114, 4.5)}<path d="M28 126q7 5 14 0" fill="none" stroke="#4a3a20" stroke-width="2"/>
    <rect x="58" y="148" width="26" height="28" rx="9" fill="url(#${u}b)" stroke="#4a3a20" stroke-width="2.5"/><rect x="128" y="148" width="26" height="28" rx="9" fill="url(#${u}b)" stroke="#4a3a20" stroke-width="2.5"/>
    <path d="M44 152q-6-84 62-88t64 88z" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3"/>
    <path d="M58 150q2-42 32-60M108 70q36 10 48 80M82 150q0-42 26-64" fill="none" stroke="${P[2]}" stroke-width="2.5" opacity=".5"/>
    <path d="M104 72q-2-22 6-40M106 52q-14-4-22-16M108 44q14-6 20-18" fill="none" stroke="#6b4a2a" stroke-width="5" stroke-linecap="round"/>
    <g fill="#5fae5c" stroke="${P[2]}" stroke-width="2"><circle cx="84" cy="30" r="13"/><circle cx="130" cy="20" r="14"/><circle cx="110" cy="20" r="13"/></g>
    ${[[122, 44], [90, 48], [140, 34]].map(f => `<circle cx="${f[0]}" cy="${f[1]}" r="7" fill="url(#${u}l)" stroke="#c98a00" stroke-width="1.5"/>`).join('')}`;

  ART.pyrodrake = (P, u) => `<defs>${lg(u + 'c', P[0], P[2])}${lg(u + 'w', '#ff8a3a', '#7a1a08')}${lg(u + 'f', '#fff0a8', '#ff6a00', 0, .5, 1, .5)}</defs>${shadow(50)}
    <path d="M70 100 20 36q-4 40 14 62l-16 4q14 14 34 4z" fill="url(#${u}w)" stroke="${P[2]}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 160q-30-10-28-34 14 14 36 8z" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="2.5"/>
    <path d="M44 150q-26 2-32-14" fill="none" stroke="${P[1]}" stroke-width="3" stroke-linecap="round"/>
    <path d="M52 150q-6-52 36-62l36-28 22 10-4 26-24 14q4 54-30 60z" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="94" cy="140" rx="22" ry="30" fill="${P[3]}" opacity=".5"/><path d="M118 62l-4-30 14 20zM136 56l6-26 8 28z" fill="${P[1]}" stroke="${P[2]}" stroke-width="2" stroke-linejoin="round"/>
    ${eye(142, 74, 5, '#2a0f08')}<path d="M152 88q36 2 44-14-16 0-28-6-6 8-16 8z" fill="url(#${u}f)"/>`;

  ART.pebblor = (P, u) => `<defs>${lg(u + 'c', P[3], P[0])}</defs>${shadow(56)}
    <ellipse cx="100" cy="144" rx="56" ry="34" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3"/>
    <ellipse cx="100" cy="100" rx="42" ry="30" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3"/>
    <ellipse cx="100" cy="62" rx="28" ry="22" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3"/>
    <path d="M72 128q20-10 36 2M60 150q10 10 28 8" fill="none" stroke="${P[2]}" stroke-width="2" opacity=".5"/>
    <circle cx="88" cy="62" r="5" fill="${P[1]}"/><circle cx="112" cy="62" r="5" fill="${P[1]}"/><circle cx="88" cy="62" r="9" fill="${P[1]}" opacity=".25"/><circle cx="112" cy="62" r="9" fill="${P[1]}" opacity=".25"/>
    <path d="M92 74q8 5 16 0" fill="none" stroke="${P[2]}" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 106q8-14 20-6-4 10-20 6zM128 132q12-8 22 2-10 10-22-2z" fill="#4fbf6a"/><circle cx="148" cy="116" r="4" fill="#ffd0e8"/><circle cx="56" cy="88" r="3" fill="#ffd0e8"/>`;

  ART.mossback = (P, u) => `<defs>${lg(u + 'c', '#8fd48a', P[2])}${lg(u + 'b', '#d9c9a0', '#8a7448')}</defs>${shadow(60)}
    <path d="M24 130q-4-18 8-26 14-4 22 8v22z" fill="url(#${u}b)" stroke="#5a4a28" stroke-width="2.5" stroke-linejoin="round"/>${eye(38, 114, 4)}<path d="M30 126q6 4 12 0" fill="none" stroke="#5a4a28" stroke-width="2"/>
    <rect x="62" y="148" width="22" height="26" rx="8" fill="url(#${u}b)" stroke="#5a4a28" stroke-width="2.5"/><rect x="128" y="148" width="22" height="26" rx="8" fill="url(#${u}b)" stroke="#5a4a28" stroke-width="2.5"/>
    <path d="M168 146q16-2 20 8-14 2-20-8z" fill="url(#${u}b)" stroke="#5a4a28" stroke-width="2"/>
    <path d="M48 150q-4-80 56-84t62 84z" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3"/>
    <path d="M60 148q2-40 30-56M104 70q34 10 46 78M80 148q0-40 24-62" fill="none" stroke="${P[2]}" stroke-width="2" opacity=".45"/>
    <path d="M70 84 66 66M96 70 94 52M130 76l6-16M114 70l-2-14" stroke="#3d8a46" stroke-width="3" stroke-linecap="round"/>
    ${[[66, 62, '#ff9ac0'], [94, 48, '#fff2a0'], [138, 58, '#ff9ac0'], [112, 52, '#c9a6ff']].map(f => `<circle cx="${f[0]}" cy="${f[1]}" r="6" fill="${f[2]}"/><circle cx="${f[0]}" cy="${f[1]}" r="2.4" fill="#ff7a2a"/>`).join('')}`;

  ART.glimfin = (P, u) => `<defs>${lg(u + 'c', P[3], P[0], 0, 0, 1, 1)}${lg(u + 'f', P[1], '#ff8a7a', 0, .5, 1, .5)}</defs>${shadow(40)}
    <path d="M150 100q40-34 40-52-30 4-44 26 8 12 4 26 4 14-4 26 14 22 44 26 0-20-40-52z" fill="url(#${u}f)" stroke="${P[2]}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M70 62q22-28 56-14-8 14-20 16z" fill="url(#${u}f)" stroke="${P[2]}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M70 136q-4 28 24 38 2-24-8-40z" fill="url(#${u}f)" stroke="${P[2]}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="92" cy="100" rx="64" ry="42" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3"/>
    <path d="M70 76q20 8 20 26t-20 26M96 62q22 14 22 38t-22 38M122 70q16 10 16 30t-16 30" fill="none" stroke="${P[2]}" stroke-width="2" opacity=".35"/>
    <path d="M42 112q18 16 40 8" fill="none" stroke="${P[2]}" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>
    ${eye(54, 92, 7)}<path d="M36 108q4 4 10 2" fill="none" stroke="${P[2]}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="86" cy="104" r="5" fill="${P[1]}" opacity=".9"/><circle cx="104" cy="92" r="4" fill="${P[1]}" opacity=".9"/>
    ${[[22, 66, 7], [30, 40, 4], [168, 160, 6], [18, 150, 5]].map(b => `<circle cx="${b[0]}" cy="${b[1]}" r="${b[2]}" fill="#e8fffd" opacity=".55" stroke="#fff" stroke-width="1.5"/>`).join('')}`;

  ART.gloomwing = (P, u) => `<defs>${lg(u + 'c', '#a07cf0', P[2], 0, 0, 1, 1)}${rg(u + 'e', '#fff', P[1], .5, .5, .6)}</defs>${shadow(48)}
    <path d="M100 100Q40 20 12 56q-4 36 40 52zM100 100Q160 20 188 56q4 36-40 52z" fill="url(#${u}c)" stroke="${P[3]}" stroke-opacity=".6" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M100 108Q50 112 36 150q22 26 62-10zM100 108q50 4 64 42-22 26-62-10z" fill="url(#${u}c)" stroke="${P[3]}" stroke-opacity=".6" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="52" cy="66" r="16" fill="${P[2]}" opacity=".5"/><circle cx="52" cy="66" r="11" fill="url(#${u}e)"/><circle cx="52" cy="66" r="4.5" fill="${P[2]}"/>
    <circle cx="148" cy="66" r="16" fill="${P[2]}" opacity=".5"/><circle cx="148" cy="66" r="11" fill="url(#${u}e)"/><circle cx="148" cy="66" r="4.5" fill="${P[2]}"/>
    <ellipse cx="100" cy="104" rx="14" ry="38" fill="${P[3]}" stroke="${P[2]}" stroke-width="2.5"/><circle cx="100" cy="64" r="15" fill="${P[3]}" stroke="${P[2]}" stroke-width="2.5"/>
    ${eye(94, 62, 4.5)}${eye(107, 62, 4.5)}
    <path d="M94 52q-14-20-28-18M106 52q14-20 28-18" fill="none" stroke="${P[3]}" stroke-width="3" stroke-linecap="round"/><path d="M66 34q-6 6-4 12M134 34q6 6 4 12" fill="none" stroke="${P[1]}" stroke-width="3" stroke-linecap="round"/>
    ${sparkle(24, 100, 6, P[1])}${sparkle(178, 104, 5, P[1])}`;

  ART.voidling = (P, u) => `<defs>${rg(u + 'c', '#3a2870', P[2], .4, .35, .75)}${lg(u + 'r', P[1], '#6a3cff', 0, 0, 1, 0)}</defs>${shadow(44)}
    <circle cx="100" cy="100" r="86" fill="${P[1]}" opacity=".12"/>
    <path d="M64 146q-14 24 4 32M86 150q-8 28 6 32M114 150q8 28-6 32M136 146q14 24-4 32" fill="none" stroke="#3a2870" stroke-width="7" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="54" fill="url(#${u}c)" stroke="${P[1]}" stroke-width="2.5"/>
    <ellipse cx="100" cy="104" rx="84" ry="18" fill="none" stroke="url(#${u}r)" stroke-width="4" transform="rotate(-18 100 100)" opacity=".85"/>
    ${[[100, 66, 12], [74, 92, 9], [126, 90, 10], [90, 118, 8], [116, 122, 9], [62, 118, 6], [140, 116, 6]].map(e => `<circle cx="${e[0]}" cy="${e[1]}" r="${e[2]}" fill="#f4eaff"/><circle cx="${e[0]}" cy="${e[1] + 1}" r="${e[2] * .55}" fill="${P[1]}"/><circle cx="${e[0]}" cy="${e[1] + 1}" r="${e[2] * .26}" fill="#07040f"/>`).join('')}
    ${sparkle(30, 40, 6, P[1])}${sparkle(172, 60, 5, '#fff')}`;

  ART.sunmane = (P, u) => `<defs>${rg(u + 'm', '#ffe27a', '#ff8a00', .5, .5, .6)}${rg(u + 'f', P[3], '#ffd064', .5, .4, .7)}</defs>${shadow(52)}
    <path d="${star(100, 100, 92, 66, 16, -90)}" fill="url(#${u}m)" stroke="#c46a00" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${star(100, 100, 70, 54, 16, -79)}" fill="#ffb02e" opacity=".55"/>
    <path d="M66 70 58 44l26 14zM134 70l8-26-26 14z" fill="#ffd064" stroke="#c46a00" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="100" cy="104" r="42" fill="url(#${u}f)" stroke="#c46a00" stroke-width="2.5"/>
    ${eye(84, 98, 6.5, '#3a1a05')}${eye(116, 98, 6.5, '#3a1a05')}<path d="M92 112h16l-8 9z" fill="#c4521a"/>
    <path d="M100 121q-8 8-16 4M100 121q8 8 16 4" fill="none" stroke="#6a2a0a" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M70 114l-22 4M70 120l-20 10M130 114l22 4M130 120l20 10" stroke="#c46a00" stroke-width="2" stroke-linecap="round" opacity=".6"/>
    <circle cx="100" cy="68" r="6" fill="#fff6c0"/>`;

  ART.rustblade = (P, u) => `<defs>${lg(u + 'b', '#d4d8e0', '#7c8696', 0, 0, 1, 0)}</defs>${shadow(32)}
    <g transform="rotate(35 100 100)"><path d="M100 14l12 16v94H88V30z" fill="url(#${u}b)" stroke="#4a5262" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M100 18v104" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
    <path d="M90 60h8l-2 6h6l-4 10h-8zM100 96h9l-3 8h-6z" fill="${P[0]}" opacity=".85"/><circle cx="106" cy="46" r="3.5" fill="${P[0]}"/><circle cx="93" cy="108" r="3" fill="${P[2]}" opacity=".7"/>
    <rect x="68" y="124" width="64" height="12" rx="5" fill="${P[2]}" stroke="#2a1c10" stroke-width="2"/><rect x="94" y="136" width="12" height="30" fill="${P[0]}" stroke="#2a1c10" stroke-width="2"/>
    <path d="M94 142h12M94 150h12M94 158h12" stroke="${P[2]}" stroke-width="2"/><circle cx="100" cy="172" r="8" fill="${P[1]}" stroke="#2a1c10" stroke-width="2"/></g>`;

  ART.oakbuckler = (P, u) => `<defs>${rg(u + 'w', P[3], P[0], .4, .3, .9)}${rg(u + 'm', '#fff', '#8a92a8', .35, .3, .8)}</defs>${shadow(56)}
    <circle cx="100" cy="98" r="72" fill="url(#${u}w)" stroke="#2a1608" stroke-width="3"/>
    <g stroke="${P[2]}" stroke-width="2" opacity=".55"><path d="M60 52v92M80 36v124M100 28v140M120 36v124M140 52v92"/></g>
    <circle cx="100" cy="98" r="66" fill="none" stroke="${P[1]}" stroke-width="7" stroke-dasharray="1 0"/><circle cx="100" cy="98" r="72" fill="none" stroke="#6a7188" stroke-width="3"/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<circle cx="${100 + Math.cos(a * Math.PI / 180) * 66}" cy="${98 + Math.sin(a * Math.PI / 180) * 66}" r="3.2" fill="#e8ecf6" stroke="#4a5062"/>`).join('')}
    <circle cx="100" cy="98" r="22" fill="url(#${u}m)" stroke="#4a5062" stroke-width="3"/><circle cx="94" cy="92" r="6" fill="#fff" opacity=".7"/>`;

  ART.ionbow = (P, u) => `<defs>${lg(u + 'b', '#4a6aa8', P[2], 0, 0, 1, 1)}${rg(u + 'g', '#4df0ff', '#4df0ff00', .5, .5, .5)}</defs>${shadow(30)}
    <circle cx="104" cy="100" r="72" fill="url(#${u}g)" opacity=".5"/>
    <path d="M70 20Q168 100 70 180" fill="none" stroke="${P[2]}" stroke-width="14" stroke-linecap="round"/>
    <path d="M70 20Q168 100 70 180" fill="none" stroke="url(#${u}b)" stroke-width="9" stroke-linecap="round"/>
    <path d="M70 20Q168 100 70 180" fill="none" stroke="${P[1]}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="14 8"/>
    <path d="M70 20L70 180" stroke="${P[1]}" stroke-width="3" opacity=".9"/><path d="M70 100H168" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M170 100l-18-9v18z" fill="${P[1]}" stroke="#fff" stroke-width="2"/>
    <path d="M70 100H116" stroke="${P[1]}" stroke-width="9" opacity=".35" stroke-linecap="round"/>
    <path d="M116 88l-6 12 6 12M130 92l-4 8 4 8" fill="none" stroke="${P[1]}" stroke-width="2.5" opacity=".8"/>${sparkle(54, 56, 6, '#bffaff')}${sparkle(60, 150, 5, '#bffaff')}`;

  ART.gravehammer = (P, u) => `<defs>${lg(u + 'h', '#8d7ba8', P[2], 0, 0, 1, 1)}${rg(u + 'g', '#b077ff88', '#b077ff00', .5, .5, .5)}</defs>${shadow(30)}
    <circle cx="100" cy="64" r="64" fill="url(#${u}g)"/>
    <g transform="rotate(18 100 100)"><rect x="92" y="60" width="16" height="118" rx="6" fill="#e9dcc4" stroke="#6a5a42" stroke-width="2.5"/>
    <circle cx="90" cy="176" r="8" fill="#e9dcc4" stroke="#6a5a42" stroke-width="2.5"/><circle cx="110" cy="176" r="8" fill="#e9dcc4" stroke="#6a5a42" stroke-width="2.5"/>
    <path d="M92 110h16M92 130h16" stroke="#6a5a42" stroke-width="2.5"/>
    <rect x="46" y="22" width="108" height="56" rx="10" fill="url(#${u}h)" stroke="${P[2]}" stroke-width="3"/>
    <path d="M46 36 28 50l18 14zM154 36l18 14-18 14z" fill="#9b8ab8" stroke="${P[2]}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M60 34h80" stroke="#fff" stroke-opacity=".35" stroke-width="3"/><circle cx="100" cy="50" r="13" fill="${P[1]}" opacity=".9"/><path d="M95 46l10 8M105 46l-10 8" stroke="${P[2]}" stroke-width="3" stroke-linecap="round"/></g>`;

  ART.prismedge = (P, u) => `<defs><linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1">${['#ff6b6b', '#ffb347', '#fff36b', '#6bff9e', '#6bd0ff', '#a06bff', '#ff6bd8'].map((c, i) => `<stop offset="${i / 6}" stop-color="${c}"/>`).join('')}</linearGradient>${rg(u + 'g', '#ffffff99', '#ffffff00', .5, .5, .5)}</defs>
    <circle cx="100" cy="90" r="80" fill="url(#${u}g)" opacity=".5"/>${shadow(28)}
    <g transform="rotate(-30 100 100)"><path d="M100 6l14 22v98H86V28z" fill="url(#${u}b)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M100 10v114" stroke="#fff" stroke-width="3" opacity=".7"/>
    <path d="M62 128l38-10 38 10-10 14H72z" fill="${P[1]}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M100 118l-14 18h28z" fill="#fff" opacity=".6"/>
    <rect x="94" y="142" width="12" height="28" fill="${P[2]}" stroke="#fff" stroke-width="2"/><path d="M100 168l9 11-9 11-9-11z" fill="${P[1]}" stroke="#fff" stroke-width="2"/></g>
    ${sparkle(40, 50, 8, '#fff')}${sparkle(168, 36, 6, '#fff')}${sparkle(160, 150, 7, '#ffd0f4')}`;

  ART.aegis = (P, u) => `<defs>${lg(u + 's', P[0], P[2], 0, 0, 1, 1)}${lg(u + 'g', '#fff0a8', '#d9922a')}${rg(u + 'h', '#7ab0ff88', '#7ab0ff00', .5, .5, .5)}</defs>
    <circle cx="100" cy="96" r="94" fill="url(#${u}h)"/>${shadow(40)}
    <path d="M100 12 20 36q-4 70 24 104 28 34 56 44 28-10 56-44 28-34 24-104z" fill="url(#${u}g)" stroke="#8a5a10" stroke-width="3" stroke-linejoin="round"/>
    <path d="M100 26 34 46q-2 58 20 90 22 28 46 38 24-10 46-38 22-32 20-90z" fill="url(#${u}s)" stroke="#8a5a10" stroke-width="2"/>
    <path d="M100 26v148M34 80h132" stroke="#ffffff" stroke-opacity=".12" stroke-width="3"/>
    <path d="${star(100, 98, 40, 17, 5)}" fill="url(#${u}g)" stroke="#8a5a10" stroke-width="2.5" stroke-linejoin="round"/><path d="${star(100, 98, 20, 9, 5)}" fill="#fffbe0"/>
    ${[[56, 60], [144, 60], [64, 138], [136, 138]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="url(#${u}g)" stroke="#8a5a10"/>`).join('')}`;

  ART.bonecharm = (P, u) => `${shadow(40)}
    <path d="M74 56q-24 20-4 56M126 56q24 20 4 56" fill="none" stroke="#6a4a2a" stroke-width="4" stroke-linecap="round"/><path d="M74 56Q100 24 126 56" fill="none" stroke="#6a4a2a" stroke-width="4"/><circle cx="100" cy="36" r="5" fill="#8b6b4a"/>
    <g transform="rotate(-30 100 120)"><path d="M52 112q-16-12-4-24 8-4 14 2 4-8 14-6 10 2 8 14h52q-2-12 8-14 10-2 14 6 6-6 14-2 12 12-4 24 16 12 4 24-8 4-14-2-4 8-14 6-10-2-8-14H80q2 12-8 14-10 2-14-6-6 6-14 2-12-12 4-24z" fill="${P[0]}" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round" transform="translate(0 4) scale(1 .95)"/>
    <path d="M70 108h60" stroke="${P[2]}" stroke-width="2" opacity=".35"/><path d="M90 118l8-10 6 12 8-8" fill="none" stroke="#c0392b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`;

  ART.amberfossil = (P, u) => `<defs>${rg(u + 'a', '#ffe28a', P[0], .35, .3, .9)}</defs>${shadow(50)}
    <path d="M100 22q64-4 72 52 8 60-52 96-64 8-88-44-12-58 40-96z" fill="url(#${u}a)" stroke="${P[1]}" stroke-width="3"/>
    <path d="M62 52q18-18 40-18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".6"/>
    <g fill="#2a1604" opacity=".85"><ellipse cx="100" cy="104" rx="10" ry="26" transform="rotate(20 100 104)"/><ellipse cx="96" cy="76" rx="9" ry="9"/>
    <path d="M104 96q36-24 44-4-24 14-44 8zM98 96Q62 72 56 92q22 14 42 8z" fill="#5a3a10" opacity=".7"/>
    <path d="M92 108l-22 10M94 114l-20 22M108 112l22 10M106 118l18 20" stroke="#2a1604" stroke-width="2.5" stroke-linecap="round" fill="none"/></g>
    <circle cx="140" cy="50" r="3" fill="#fff" opacity=".7"/>${sparkle(150, 140, 6, '#fff3c0')}`;

  ART.moonstone = (P, u) => `<defs>${rg(u + 'm', '#ffffff', P[1], .35, .3, .85)}${rg(u + 'g', '#a8c0ff77', '#a8c0ff00', .5, .5, .5)}</defs>
    <circle cx="100" cy="100" r="90" fill="url(#${u}g)"/>${shadow(44)}
    <path d="M52 112q-8 40 24 58M148 112q8 40-24 58M50 104q-6-12 8-14M150 104q6-12-8-14" fill="none" stroke="#c9d0e6" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="100" cy="100" rx="56" ry="68" fill="url(#${u}m)" stroke="#9fb0e8" stroke-width="3"/>
    <path d="M70 70q-8 30 4 56" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".75"/>
    <path d="M126 70a40 40 0 1 0 0 60 30 30 0 1 1 0-60z" fill="#fff" opacity=".25"/>
    ${sparkle(130, 56, 8)}${sparkle(76, 138, 5, '#e0e8ff')}${sparkle(150, 120, 4)}`;

  ART.oracletablet = (P, u) => `<defs>${lg(u + 's', '#9aa6c0', P[2])}${rg(u + 'g', '#5af0c866', '#5af0c800', .5, .5, .5)}</defs>
    <circle cx="100" cy="100" r="88" fill="url(#${u}g)"/>${shadow(42)}
    <path d="M52 176V58q0-32 48-34t48 34v118z" fill="url(#${u}s)" stroke="${P[2]}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M64 170V62q0-20 36-22t36 22v108z" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>
    <g fill="none" stroke="${P[1]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px ${P[1]})"><circle cx="100" cy="68" r="9"/><path d="M100 77v14M86 100l14 10 14-10M84 124h32M92 124l-6 24M108 124l6 24M82 150h36"/></g>
    <path d="M62 52l16 16 4 20M140 120l-12 14 4 22" fill="none" stroke="#161c2e" stroke-width="2.5" stroke-linecap="round"/>`;

  ART.eclipsescepter = (P, u) => `<defs>${lg(u + 'g', '#fff0a8', '#c98a1a', 0, 0, 1, 0)}${rg(u + 'c', '#000', '#000', .5, .5, .5)}${rg(u + 'h', '#ffbf3b', '#ffbf3b00', .5, .5, .5)}</defs>
    <circle cx="100" cy="52" r="52" fill="url(#${u}h)" opacity=".6"/>${shadow(26)}
    <rect x="94" y="84" width="12" height="96" rx="4" fill="url(#${u}g)" stroke="#6a4a0a" stroke-width="2.5"/><path d="M94 110h12M94 128h12M94 146h12" stroke="#6a4a0a" stroke-width="2.5"/><path d="M88 176h24l-4 8H92z" fill="url(#${u}g)" stroke="#6a4a0a" stroke-width="2"/>
    <path d="M74 80q-18-10-12-40 6 16 22 20zM126 80q18-10 12-40-6 16-22 20z" fill="url(#${u}g)" stroke="#6a4a0a" stroke-width="2.5" stroke-linejoin="round"/>
    ${[...Array(12)].map((_, i) => { const a = i * 30 * Math.PI / 180; return `<path d="M${100 + Math.cos(a) * 30} ${52 + Math.sin(a) * 30}L${100 + Math.cos(a) * (i % 2 ? 42 : 48)} ${52 + Math.sin(a) * (i % 2 ? 42 : 48)}" stroke="#ffbf3b" stroke-width="3" stroke-linecap="round"/>`; }).join('')}
    <circle cx="100" cy="52" r="30" fill="#ffd36b" opacity=".9"/><circle cx="100" cy="52" r="26" fill="#0a0414" stroke="#ffe9a8" stroke-width="2"/><circle cx="108" cy="48" r="26" fill="#0e0720" opacity=".0"/>`;

  ART.sunkencrown = (P, u) => `<defs>${lg(u + 'g', '#ffe9a0', '#b8862a')}</defs>${shadow(56)}
    <path d="M50 160q-6 12 2 22M78 160q-4 16 2 24M122 160q4 16-2 24M150 160q6 12-2 22" fill="none" stroke="#2f9a6a" stroke-width="5" stroke-linecap="round"/>
    <path d="M34 150 24 54l44 36 32-60 32 60 44-36-10 96z" fill="url(#${u}g)" stroke="#6a4a0a" stroke-width="3" stroke-linejoin="round"/>
    <rect x="32" y="130" width="136" height="30" rx="6" fill="url(#${u}g)" stroke="#6a4a0a" stroke-width="3"/>
    ${[[24, 54], [100, 30], [176, 54]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="9" fill="#f5fbff" stroke="#9fb0c0" stroke-width="2"/><circle cx="${p[0] - 3}" cy="${p[1] - 3}" r="3" fill="#fff"/>`).join('')}
    ${[60, 100, 140].map((x, i) => `<path d="M${x} 136l9 9-9 9-9-9z" fill="${i === 1 ? '#ff5a8a' : P[1]}" stroke="#064a3a" stroke-width="2"/>`).join('')}
    <circle cx="64" cy="100" r="5" fill="#c9d0c0" opacity=".8"/><circle cx="140" cy="108" r="4" fill="#c9d0c0" opacity=".8"/><path d="M40 166q8-8 16 0M150 166q8-8 16 0" fill="none" stroke="#2f9a6a" stroke-width="3"/>`;

  ART.heartofeternity = (P, u) => `<defs><linearGradient id="${u}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7de8ff"/><stop offset=".5" stop-color="#b78bff"/><stop offset="1" stop-color="#ff8af0"/></linearGradient>${rg(u + 'g', '#8ff4ff88', '#8ff4ff00', .5, .5, .5)}</defs>
    <circle cx="100" cy="100" r="96" fill="url(#${u}g)"/>
    <ellipse cx="100" cy="100" rx="90" ry="26" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2" transform="rotate(-20 100 100)"/><ellipse cx="100" cy="100" rx="78" ry="20" fill="none" stroke="#7de8ff" stroke-opacity=".6" stroke-width="2" transform="rotate(30 100 100)"/>
    <path d="M100 172C28 120 22 66 56 48c20-10 38 0 44 16 6-16 24-26 44-16 34 18 28 72-44 124z" fill="url(#${u}h)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <g stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linejoin="round"><path d="M56 48l44 24 44-24M100 64v108M36 96l64-24 64 24M54 134l46-38 46 38M100 96 76 122M100 96l24 26"/></g>
    <path d="M64 62q-14 14-12 34" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".7"/>${sparkle(30, 40, 9)}${sparkle(172, 54, 8)}${sparkle(160, 160, 7, '#ffd8fb')}${sparkle(40, 156, 6, '#c8f8ff')}`;

  ART.pocketdrone = (P, u) => `<defs>${lg(u + 'b', P[3], P[0])}</defs>${shadow(50)}
    <path d="M100 104 44 66M100 104l56-38M100 104 44 142M100 104l56 38" stroke="${P[2]}" stroke-width="7" stroke-linecap="round"/>
    ${[[40, 62], [160, 62], [40, 146], [160, 146]].map(r => `<ellipse cx="${r[0]}" cy="${r[1]}" rx="26" ry="7" fill="#fff" opacity=".4" stroke="${P[2]}" stroke-width="1.5"/><circle cx="${r[0]}" cy="${r[1]}" r="5" fill="${P[2]}"/>`).join('')}
    <rect x="68" y="76" width="64" height="52" rx="22" fill="url(#${u}b)" stroke="${P[2]}" stroke-width="3"/><circle cx="100" cy="102" r="16" fill="#1a2030" stroke="${P[2]}" stroke-width="2.5"/><circle cx="100" cy="102" r="8" fill="#4df0ff"/><circle cx="96" cy="98" r="3" fill="#fff"/>
    <circle cx="120" cy="84" r="3.5" fill="${P[1]}"/><path d="M84 132v10M116 132v10" stroke="${P[2]}" stroke-width="4" stroke-linecap="round"/>`;

  ART.scraprover = (P, u) => `<defs>${lg(u + 'c', P[0], P[2])}</defs>${shadow(70)}
    <path d="M30 120q0-30 30-30h20l16-26h46q18 0 26 26h6q16 0 16 16v18z" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M92 70h40q8 0 12 20H88z" fill="${P[1]}" stroke="${P[2]}" stroke-width="2.5" opacity=".9"/><path d="M92 78l6-6" stroke="#fff" stroke-width="3" opacity=".6"/>
    <rect x="36" y="100" width="40" height="22" fill="#6e7b8c" stroke="${P[2]}" stroke-width="2"/><rect x="118" y="104" width="44" height="18" fill="#a85a3a" stroke="${P[2]}" stroke-width="2"/>
    <path d="M46 100l6 22M60 100l6 22" stroke="${P[2]}" stroke-width="2"/><path d="M52 86V60l10-6M46 60h14" stroke="#555e70" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="48" cy="58" r="3" fill="#ff5a5a"/>
    <path d="M170 110h14l8-6" stroke="#ffe08a" stroke-width="4" stroke-linecap="round"/>
    ${[62, 150].map(x => `<circle cx="${x}" cy="148" r="28" fill="#1e222c" stroke="#0b0d12" stroke-width="3"/><circle cx="${x}" cy="148" r="14" fill="#8a94a8" stroke="${P[2]}" stroke-width="2.5"/><path d="M${x} 134v28M${x - 14} 148h28M${x - 10} 138l20 20M${x + 10} 138l-20 20" stroke="${P[2]}" stroke-width="2"/>`).join('')}`;

  ART.skyskiff = (P, u) => `<defs><linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="0">${['#e9564a', '#f6e3b8', '#e9564a', '#f6e3b8', '#e9564a'].map((c, i) => `<stop offset="${i / 4}" stop-color="${c}"/>`).join('')}</linearGradient>${lg(u + 'h', P[0], P[2])}</defs>${shadow(46)}
    <ellipse cx="100" cy="64" rx="66" ry="52" fill="url(#${u}b)" stroke="${P[2]}" stroke-width="3"/><path d="M60 36q-12 28 0 56M100 12v104M140 36q12 28 0 56" fill="none" stroke="${P[2]}" stroke-width="2" opacity=".4"/>
    <path d="M70 108 84 140M130 108 116 140M100 114v26" stroke="#6a4a2a" stroke-width="3"/>
    <path d="M52 140h96l-12 28q-36 14-72 0z" fill="url(#${u}h)" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round"/><path d="M58 150h84" stroke="${P[3]}" stroke-width="3" opacity=".6"/>
    <circle cx="78" cy="156" r="4" fill="${P[3]}"/><circle cx="100" cy="158" r="4" fill="${P[3]}"/><circle cx="122" cy="156" r="4" fill="${P[3]}"/>
    <path d="M148 150h20" stroke="#555" stroke-width="4"/><path d="M168 138v24M160 142l16 16M176 142l-16 16" stroke="#8a94a8" stroke-width="3" stroke-linecap="round"/>
    <path d="M100 138V108" stroke="#6a4a2a" stroke-width="3"/><path d="M100 108l22 7-22 7z" fill="${P[1]}" transform="translate(0 -4)"/>`;

  ART.chronoracer = (P, u) => `<defs>${lg(u + 'c', '#ff6a8a', P[2])}${rg(u + 'w', '#c9f6ff', '#4a8ab0', .3, .3, .9)}</defs>${shadow(76)}
    <path d="M8 130h26M2 142h30M12 154h24" stroke="${P[1]}" stroke-width="4" stroke-linecap="round" opacity=".5"/>
    <path d="M30 138q-6-26 20-34l34-8q22-30 56-30 28 2 42 36 16 4 14 36z" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M92 94q18-24 46-22 14 6 22 22z" fill="url(#${u}w)" stroke="${P[2]}" stroke-width="2.5"/><path d="M104 88l22-14" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/>
    <path d="M36 122h160" stroke="${P[1]}" stroke-width="4" opacity=".9"/>
    <circle cx="116" cy="120" r="15" fill="#10162a" stroke="${P[1]}" stroke-width="2.5"/><path d="M116 120V110M116 120l8 4" stroke="${P[1]}" stroke-width="2.5" stroke-linecap="round"/>
    ${[56, 156].map(x => `<circle cx="${x}" cy="142" r="22" fill="#14161e" stroke="#000" stroke-width="3"/><circle cx="${x}" cy="142" r="12" fill="#c9d0e0" stroke="${P[1]}" stroke-width="3"/><circle cx="${x}" cy="142" r="4" fill="${P[2]}"/>`).join('')}`;

  const gear = (cx, cy, R, r, n, rot = 0) => { let p = ''; for (let i = 0; i < n * 4; i++) { const a = (rot + i * 90 / n) * Math.PI / 180, rad = (i % 4 === 0 || i % 4 === 1) ? R : r; p += (i ? 'L' : 'M') + (cx + Math.cos(a) * rad).toFixed(1) + ' ' + (cy + Math.sin(a) * rad).toFixed(1); } return p + 'Z'; };
  ART.leviathan = (P, u) => `<defs>${lg(u + 'c', '#e0a050', P[2], 0, 0, 1, 1)}${rg(u + 'g', '#4dffb8', '#4dffb800', .5, .5, .5)}</defs>${shadow(70)}
    <rect x="132" y="22" width="22" height="64" rx="4" fill="#8a94a8" stroke="${P[2]}" stroke-width="3"/><rect x="164" y="40" width="20" height="60" rx="4" fill="#7a8498" stroke="${P[2]}" stroke-width="3"/><rect x="128" y="18" width="30" height="10" rx="3" fill="#aab4c8" stroke="${P[2]}" stroke-width="2.5"/>
    <path d="M154 130h30v-20" fill="none" stroke="#6a4a2a" stroke-width="8" stroke-linecap="round"/>
    <path d="${gear(78, 106, 66, 56, 12)}" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="78" cy="106" r="40" fill="${P[2]}" opacity=".5"/><circle cx="78" cy="106" r="34" fill="url(#${u}g)"/><circle cx="78" cy="106" r="22" fill="#103a30" stroke="${P[1]}" stroke-width="3"/><circle cx="78" cy="106" r="11" fill="${P[1]}"/>
    <path d="${gear(156, 140, 30, 24, 8, 10)}" fill="#c98a45" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round"/><circle cx="156" cy="140" r="10" fill="${P[2]}"/><circle cx="156" cy="140" r="4" fill="${P[1]}"/>
    <path d="M78 66v-14M78 160v14M38 106H24M118 106h14" stroke="${P[2]}" stroke-width="4"/><circle cx="68" cy="94" r="4" fill="#fff" opacity=".6"/>`;

  ART.starhopper = (P, u) => `<defs>${lg(u + 'b', '#ffffff', '#aab4cc', 0, 0, 1, 0)}${lg(u + 'f', '#fff0a8', '#ff4a1a')}</defs>${shadow(26)}
    <path d="M100 160q-16 20 0 38 16-18 0-38z" fill="url(#${u}f)" transform="translate(0 -12) scale(1 .9)"/><path d="M100 164q-8 14 0 24 8-10 0-24z" fill="#fff6c0" transform="translate(0 -10)"/>
    <path d="M64 120 34 160l34-6zM136 120l30 40-34-6z" fill="${P[1]}" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M100 8q42 32 40 110l-12 30H72l-12-30q-2-78 40-110z" fill="url(#${u}b)" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M100 8q-18 14-28 40h56q-10-26-28-40z" fill="${P[1]}" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="100" cy="86" r="20" fill="#2a3a6a" stroke="${P[2]}" stroke-width="4"/><circle cx="100" cy="86" r="14" fill="#6ab4ff"/><path d="M92 80q6-6 12-2" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M70 122h60M72 134h56" stroke="${P[2]}" stroke-width="2.5" opacity=".4"/><rect x="88" y="148" width="24" height="10" fill="${P[2]}"/>`;

  ART.infinitesock = (P, u) => `<defs>${lg(u + 'c', P[0], '#c43c96')}</defs>${shadow(48)}
    <path d="M66 22h54v78l46 22q18 14 4 40-14 14-34 6l-76-34q-14-8-14-26z" fill="url(#${u}c)" stroke="${P[2]}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="62" y="16" width="62" height="26" rx="5" fill="${P[1]}" stroke="${P[2]}" stroke-width="3"/><path d="M72 18v22M84 18v22M96 18v22M108 18v22" stroke="#ffc0e6" stroke-width="2.5"/>
    <path d="M72 52h46M72 62h46" stroke="#fff" stroke-width="5" opacity=".6"/>
    <path d="M148 150q-4 16-24 6" fill="none" stroke="#fff" stroke-width="5" opacity=".5"/><path d="M52 120q-14 20 4 28" fill="none" stroke="${P[2]}" stroke-width="2" opacity=".4"/>
    <path d="M78 94c-12-14 4-26 16-12l8 10c12 14 28 2 16-12-12-14-28-2-16 12l-8-10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" transform="translate(-2 -2) scale(1)"/>`;

  ART.vendingfragment = (P, u) => `<defs>${lg(u + 'c', '#aab8cc', P[2])}</defs>${shadow(48)}
    <path d="M44 26h98l16 20v130H44z" fill="url(#${u}c)" stroke="#161c28" stroke-width="3" stroke-linejoin="round"/><path d="M142 26v20h16" fill="#6a7890" stroke="#161c28" stroke-width="2"/>
    <rect x="56" y="38" width="76" height="62" rx="4" fill="#0e1424" stroke="#161c28" stroke-width="2.5"/><path d="M62 50h28v12H62zM96 50h30v12H96zM62 72h20v22H62zM90 76h36v16H90z" fill="#2a3a58" opacity=".9"/><path d="M100 44l22 50" stroke="#fff" stroke-width="2" opacity=".25"/>
    ${[0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${60 + c * 16}" y="${112 + r * 14}" width="12" height="9" rx="2" fill="${(r + c) % 2 ? P[1] : '#e9edf5'}" stroke="#161c28"/>`).join('')).join('')}
    <rect x="114" y="112" width="30" height="38" rx="3" fill="#161c28"/><text x="129" y="138" font-family="Georgia,serif" font-size="22" font-weight="bold" fill="${P[1]}" text-anchor="middle">??</text>
    <rect x="58" y="158" width="64" height="12" rx="3" fill="#0b0f18"/><circle cx="148" cy="108" r="4" fill="#ff4f6a"/>`;

  ART.glitchedcursor = (P, u) => {
    const cur = 'M60 20v128l32-28 24 52 24-12-24-50h44z';
    return `${shadow(30)}<g opacity=".9"><path d="${cur}" fill="#00f0ff" transform="translate(-9 3)"/><path d="${cur}" fill="#ff2bd6" transform="translate(9 -3)"/></g>
    <path d="${cur}" fill="#f4f6ff" stroke="#14142a" stroke-width="6" stroke-linejoin="round"/><path d="${cur}" fill="#f4f6ff"/>
    <rect x="30" y="64" width="86" height="10" fill="#00f0ff" opacity=".8" transform="translate(14 0)"/><rect x="50" y="108" width="100" height="7" fill="#ff2bd6" opacity=".8" transform="translate(-12 0)"/><rect x="70" y="140" width="60" height="5" fill="#14142a" opacity=".7"/>
    ${[[150, 40], [160, 52], [142, 54], [34, 150], [24, 140], [172, 120]].map(p => `<rect x="${p[0]}" y="${p[1]}" width="8" height="8" fill="${(p[0] + p[1]) % 20 < 10 ? '#00f0ff' : '#ff2bd6'}"/>`).join('')}`;
  };

  ART.whisperjar = (P, u) => `<defs>${lg(u + 'g', '#d6f4f8aa', '#6aa8b866', 0, 0, 1, 1)}</defs>${shadow(44)}
    <rect x="76" y="14" width="48" height="22" rx="6" fill="#b88a58" stroke="#5a3a18" stroke-width="3"/><path d="M84 18v14M96 18v14M108 18v14" stroke="#5a3a18" stroke-width="2" opacity=".5"/>
    <path d="M80 36h40v14q40 10 40 50 0 56-30 76H70Q40 156 40 100q0-40 40-50z" fill="url(#${u}g)" stroke="${P[2]}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M60 80q-8 30 0 60" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".6"/>
    <g fill="${P[1]}" opacity=".85"><path d="M100 150q-34-4-30-34 4-22 24-16-18 12-4 28 10 10 24 6-4 14-14 16z"/><path d="M110 108q24-14 30 8 2 18-16 22 8-12-2-22-6-6-12-8z" opacity=".7"/></g>
    <g fill="#fff">${eye(88, 118, 4, '#2a1450')}${eye(104, 118, 4, '#2a1450')}</g><ellipse cx="96" cy="130" rx="4" ry="5" fill="#2a1450"/>
    <path d="M120 70q10-12 0-24M132 80q12-10 4-26" fill="none" stroke="${P[1]}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;

  ART.impossiblecube = (P, u) => `<defs>${lg(u + 'a', '#9bc4ff', P[0])}${lg(u + 'b', P[1], '#a03a86')}${lg(u + 'c', '#4a6ad0', P[2])}</defs>${shadow(50)}
    <path d="M100 18 168 56v76l-68 38-68-38V56z" fill="${P[2]}" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
    <path d="M100 18 168 56 100 94 32 56z" fill="url(#${u}a)" stroke="#e0f0ff" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 56 100 94v76L32 132z" fill="url(#${u}b)" stroke="#e0f0ff" stroke-width="2.5" stroke-linejoin="round"/><path d="M168 56 100 94v76l68-38z" fill="url(#${u}c)" stroke="#e0f0ff" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M100 52 134 72 100 92 66 72z" fill="#0b1230" stroke="#fff" stroke-width="2"/><path d="M100 58 126 72 100 86 74 72z" fill="url(#${u}b)" opacity=".9"/>
    <path d="M32 56 66 72M168 56 134 72M100 18v34" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M54 100l30 17v38M146 100l-30 17v38" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 4" opacity=".6"/>
    ${sparkle(176, 30, 7)}${sparkle(24, 150, 6, '#ffd0f4')}`;

  ART.backwardsclock = (P, u) => `<defs>${rg(u + 'f', '#fff8dc', P[0], .4, .3, .9)}${rg(u + 'g', '#7affd788', '#7affd700', .5, .5, .5)}</defs>
    <circle cx="100" cy="100" r="96" fill="url(#${u}g)"/>${shadow(48)}
    <circle cx="100" cy="100" r="74" fill="url(#${u}f)" stroke="${P[2]}" stroke-width="6"/><circle cx="100" cy="100" r="66" fill="none" stroke="${P[2]}" stroke-width="1.5" opacity=".5"/>
    <path d="M32 100A68 68 0 0 1 100 32" fill="none" stroke="${P[1]}" stroke-width="4" stroke-linecap="round"/><path d="M100 32l-10-8M100 32l-10 8" stroke="${P[1]}" stroke-width="4" stroke-linecap="round" fill="none" transform="rotate(0)"/>
    ${[...Array(12)].map((_, i) => { const a = (i * 30 - 90) * Math.PI / 180; return `<path d="M${100 + Math.cos(a) * 58} ${100 + Math.sin(a) * 58}L${100 + Math.cos(a) * 64} ${100 + Math.sin(a) * 64}" stroke="${P[2]}" stroke-width="${i % 3 ? 2 : 4}"/>`; }).join('')}
    ${[['12', 100, 56], ['3', 144, 106], ['6', 100, 156], ['9', 56, 106]].map(n => `<text x="${n[1]}" y="${n[2]}" font-family="Georgia,serif" font-size="22" font-weight="bold" fill="${P[2]}" text-anchor="middle" transform="translate(${n[1] * 2} 0) scale(-1 1)">${n[0]}</text>`).join('')}
    <path d="M100 100 78 66" stroke="${P[2]}" stroke-width="6" stroke-linecap="round"/><path d="M100 100l36 18" stroke="${P[2]}" stroke-width="4.5" stroke-linecap="round"/><path d="M100 100 90 140" stroke="${P[1]}" stroke-width="2" stroke-linecap="round"/><circle cx="100" cy="100" r="6" fill="${P[1]}" stroke="${P[2]}" stroke-width="2"/>`;

  ART.missingtexture = (P, u) => `${shadow(46)}
    <g transform="rotate(-6 100 100)"><rect x="34" y="34" width="132" height="132" fill="#000"/>
    ${[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => ((r + c) % 2 === 0) ? `<rect x="${34 + c * 33}" y="${34 + r * 33}" width="33" height="33" fill="#ff00ff"/>` : '').join('')).join('')}
    <rect x="34" y="34" width="132" height="132" fill="none" stroke="#fff" stroke-width="3"/></g>
    <rect x="20" y="80" width="70" height="8" fill="#00ffcc" opacity=".8"/><rect x="110" y="118" width="74" height="6" fill="#fff" opacity=".8"/><rect x="60" y="150" width="40" height="5" fill="#ff0044"/>
    ${[[168, 40], [176, 52], [26, 150], [14, 138]].map(p => `<rect x="${p[0]}" y="${p[1]}" width="8" height="8" fill="#ff00ff"/>`).join('')}`;

  // ---------- CONTAINER ART ----------
  const CART = {};
  CART.pack = (c, u) => `<defs>${lg(u + 'p', c[0], c[1], 0, 0, 1, 1)}${lg(u + 's', '#ffffff66', '#ffffff00', 0, 0, 1, 1)}</defs>${shadow(46)}
    <g class="pk-bottom"><path d="M54 40h92v130l-8 6h-76l-8-6z" fill="url(#${u}p)" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M54 40h92v130l-8 6h-76l-8-6z" fill="url(#${u}s)"/><path d="M54 40V30l5-6M146 40V30l-5-6" stroke="none"/>
    <path d="${star(100, 108, 30, 14, 4)}" fill="#fff" opacity=".9"/><path d="${star(100, 108, 17, 8, 4, -45)}" fill="${c[0]}"/>
    <path d="M64 160h72M64 150h72" stroke="#fff" stroke-opacity=".4" stroke-width="2"/><path d="M62 52h76" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-dasharray="4 4"/></g>
    <g class="pk-top"><path d="M54 40l5-14 6 10 6-12 6 12 6-12 6 12 6-12 6 12 6-12 6 12 6-12 6 12 5-10 5 14z" fill="url(#${u}p)" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" stroke-linejoin="round"/></g>`;
  CART.egg = (c, u) => `<defs>${lg(u + 'e', '#fffdf4', c[0], .2, 0, .8, 1)}${rg(u + 'g', c[1] + 'aa', c[1] + '00', .5, .5, .5)}</defs>
    <circle class="egg-glow" cx="100" cy="104" r="92" fill="url(#${u}g)"/>${shadow(44)}
    <g class="egg-body"><path d="M100 14C60 14 34 70 34 112c0 38 30 66 66 66s66-28 66-66c0-42-26-98-66-98z" fill="url(#${u}e)" stroke="${c[1]}" stroke-width="3"/>
    ${[[70, 70, 7], [128, 90, 9], [84, 128, 8], [120, 146, 6], [100, 52, 5], [58, 112, 5]].map(s => `<ellipse cx="${s[0]}" cy="${s[1]}" rx="${s[2]}" ry="${s[2] * .8}" fill="${c[1]}" opacity=".45"/>`).join('')}
    <path d="M62 56q-14 28-8 56" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".6"/>
    <g class="cracks" fill="none" stroke="#2a1a3a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="k1" d="M100 24l-8 22 12 14-10 18"/><path class="k2" d="M132 62l-16 14 10 16-14 12"/><path class="k3" d="M62 96l16 8-6 18 16 6"/><path class="k4" d="M138 130l-14-6-8 16 12 10M96 150l-8 12 12 10"/></g></g>`;
  CART.crate = (c, u) => `<defs>${lg(u + 'w', '#6b7488', '#2a3042')}${lg(u + 'm', c[1], c[0])}${rg(u + 'g', c[1] + '99', c[1] + '00', .5, .5, .5)}</defs>
    <circle class="crate-glow" cx="100" cy="104" r="88" fill="url(#${u}g)"/>${shadow(62)}
    <rect x="24" y="52" width="152" height="118" rx="8" fill="url(#${u}w)" stroke="#161c28" stroke-width="3.5"/>
    <path d="M24 96h152M24 130h152" stroke="#161c28" stroke-width="2.5" opacity=".6"/>
    <rect x="24" y="52" width="26" height="118" fill="url(#${u}m)" stroke="#161c28" stroke-width="3"/><rect x="150" y="52" width="26" height="118" fill="url(#${u}m)" stroke="#161c28" stroke-width="3"/>
    <path d="M24 52 40 38h120l16 14" fill="#4a5268" stroke="#161c28" stroke-width="3" stroke-linejoin="round"/>
    ${[[37, 64], [37, 158], [163, 64], [163, 158]].map(r => `<circle cx="${r[0]}" cy="${r[1]}" r="4.5" fill="#e8ecf6" stroke="#161c28" stroke-width="2"/>`).join('')}
    <g class="lockplate"><rect x="80" y="86" width="40" height="46" rx="8" fill="url(#${u}m)" stroke="#161c28" stroke-width="3.5"/><circle cx="100" cy="104" r="7" fill="#161c28"/><path d="M96 108h8l2 14h-12z" fill="#161c28"/><path class="seam" d="M30 100h140" stroke="${c[1]}" stroke-width="2" opacity="0"/></g>`;
  CART.capsule = (c, u) => `<defs>${rg(u + 't', c[0], '#1c1236', .35, .3, .9)}${rg(u + 'b', '#ffffff', c[1], .35, .3, .95)}${rg(u + 'g', c[1] + '99', c[1] + '00', .5, .5, .5)}</defs>
    <circle class="cap-glow" cx="100" cy="104" r="90" fill="url(#${u}g)"/>${shadow(48)}
    <g class="cap-bot"><path d="M28 104a72 72 0 0 0 144 0z" fill="url(#${u}b)" stroke="#fff" stroke-opacity=".6" stroke-width="3"/></g>
    <g class="cap-top"><path d="M28 104a72 72 0 0 1 144 0z" fill="url(#${u}t)" stroke="#fff" stroke-opacity=".6" stroke-width="3"/><path d="M52 80a54 54 0 0 1 36-34" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".65"/></g>
    <rect x="26" y="98" width="148" height="12" rx="4" fill="#161c28" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><circle cx="100" cy="104" r="9" fill="${c[1]}" stroke="#161c28" stroke-width="2.5"/>`;
  CART.chest = (c, u) => `<defs>${lg(u + 'w', '#7a4a24', '#3a2010')}${lg(u + 'g', '#fff0a8', c[0])}${rg(u + 'h', c[1] + 'aa', c[1] + '00', .5, .5, .5)}</defs>
    <circle class="chest-glow" cx="100" cy="100" r="92" fill="url(#${u}h)"/>${shadow(66)}
    <g class="chest-base"><rect x="26" y="96" width="148" height="76" rx="8" fill="url(#${u}w)" stroke="#1c0e06" stroke-width="3.5"/>
    <rect x="26" y="96" width="20" height="76" fill="url(#${u}g)" stroke="#1c0e06" stroke-width="3"/><rect x="154" y="96" width="20" height="76" fill="url(#${u}g)" stroke="#1c0e06" stroke-width="3"/><path d="M26 130h148" stroke="#1c0e06" stroke-opacity=".5" stroke-width="2.5"/>
    <rect x="26" y="96" width="148" height="10" fill="url(#${u}g)" stroke="#1c0e06" stroke-width="2.5"/></g>
    <g class="chest-lid"><path d="M26 98V74q0-42 74-42t74 42v24z" fill="url(#${u}w)" stroke="#1c0e06" stroke-width="3.5"/><path d="M26 98V74q0-42 74-42t74 42v24z" fill="none"/>
    <rect x="26" y="70" width="20" height="30" fill="url(#${u}g)" stroke="#1c0e06" stroke-width="3"/><rect x="154" y="70" width="20" height="30" fill="url(#${u}g)" stroke="#1c0e06" stroke-width="3"/><path d="M50 56q50-24 100 0" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="5" stroke-linecap="round"/></g>
    <g class="lockplate"><rect x="84" y="86" width="32" height="36" rx="7" fill="url(#${u}g)" stroke="#1c0e06" stroke-width="3.5"/><circle cx="100" cy="100" r="5.5" fill="#1c0e06"/><path d="M97 103h6l1.5 10h-9z" fill="#1c0e06"/></g>`;
  CART.vault = (c, u) => `<defs>${lg(u + 'm', '#b8c0d4', '#4a5268', 0, 0, 1, 1)}${lg(u + 'a', c[1], c[0])}${rg(u + 'g', c[0] + 'aa', c[0] + '00', .5, .5, .5)}</defs>
    <circle class="vault-glow" cx="100" cy="100" r="96" fill="url(#${u}g)"/>${shadow(60)}
    <rect x="14" y="14" width="172" height="164" rx="22" fill="#1c2236" stroke="#8a94ac" stroke-width="3.5"/>
    <g class="door"><circle cx="100" cy="96" r="70" fill="url(#${u}m)" stroke="#161c28" stroke-width="4"/><circle cx="100" cy="96" r="58" fill="none" stroke="#161c28" stroke-width="3" opacity=".6"/>
    ${[...Array(8)].map((_, i) => { const a = i * 45 * Math.PI / 180; return `<circle cx="${100 + Math.cos(a) * 64}" cy="${96 + Math.sin(a) * 64}" r="4.5" fill="#e8ecf6" stroke="#161c28" stroke-width="2"/>`; }).join('')}
    <circle cx="100" cy="96" r="32" fill="#2a3248" stroke="#161c28" stroke-width="3.5"/>
    <g class="wheel">${[0, 60, 120].map(a => `<rect x="94" y="52" width="12" height="88" rx="6" fill="url(#${u}a)" stroke="#161c28" stroke-width="2.5" transform="rotate(${a} 100 96)"/>`).join('')}<circle cx="100" cy="96" r="12" fill="url(#${u}a)" stroke="#161c28" stroke-width="3"/></g></g>
    ${[0, 1, 2].map(i => `<circle class="vlock vl${i}" cx="${70 + i * 30}" cy="176" r="5" fill="${c[1]}" stroke="#161c28" stroke-width="2"/>`).join('')}`;

  // ---------- ICONS: one family — 24 grid, 1.5 stroke, square caps, mitred joins ----------
  const ICONS = {
    home: '<path d="M3 21V10l9-6.5 9 6.5v11M3 21h18M9.5 21v-6.5h5V21"/>',
    open: '<path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5zM4 8.5l8 4.5 8-4.5M12 13v9"/>',
    vault: '<path d="M3.5 4.5h17v15h-17zM6 19.5V22M18 19.5V22"/><circle cx="12" cy="12" r="4"/><path d="M12 8v8M8 12h8"/>',
    paw: '<path d="M7.5 18.5h9.2a4 4 0 0 0 .7-7.9 5.2 5.2 0 0 0-9.9-1A4.5 4.5 0 0 0 7.5 18.5zM12.4 11.2l-2.2 3.3h3l-2.2 3.4"/>',
    upgrade: '<path d="M3 6.5h15.5l2.5 2.5-3 3H13v2.5h3.5V18H7.5v-3.5H10V12H8.4C5.3 12 3 9.7 3 6.5z"/>',
    store: '<path d="M4 8.5h14M14.5 5 18 8.5l-3.5 3.5M20 15.5H6M9.5 12 6 15.5 9.5 19"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5"/>',
    heart: '<path d="M12 20.5S3.5 15.4 3.5 9.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 8.5 1.8c0 6.2-8.5 11.3-8.5 11.3z"/>',
    lock: '<path d="M5 11h14v10H5zM8 11V7.5a4 4 0 0 1 8 0V11M12 15v2.5"/>',
    unlock: '<path d="M5 11h14v10H5zM8 11V7.5a4 4 0 0 1 7.6-1.7M12 15v2.5"/>',
    search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l6 6"/>',
    close: '<path d="M5 5l14 14M19 5 5 19"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    star: '<path d="M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    sword: '<path d="M12 2.5l2.5 2.5v10h-5V5zM6.5 15.5h11M12 15.5v6"/>',
    gem: '<path d="M6.5 4h11l3.5 5-9 12L3 9zM3 9h18M9.5 4 8 9l4 12 4-12-1.5-5"/>',
    cog: '<circle cx="12" cy="12" r="3.2"/><path d="M10.5 3h3l.6 2.6 2 1.1 2.5-.9 2.1 2.1-.9 2.5 1.1 2 2.6.6v3l-2.6.6-1.1 2 .9 2.5-2.1 2.1-2.5-.9-2 1.1-.6 2.6h-3l-.6-2.6-2-1.1-2.5.9-2.1-2.1.9-2.5-1.1-2L3 13.5v-3l2.6-.6 1.1-2-.9-2.5L7.9 3.3l2.5.9 2-1.1z" transform="translate(-0.5 0) scale(.96) translate(.5 .4)"/>',
    back: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    skip: '<path d="M4 5v14l9-7zM13 5v14l9-7z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.3v.7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    sparkle: '<path d="M12 2.5c.6 5.5 3.5 8.6 9.5 9.5-6 1-8.900 4-9.500 9.500-.6-5.500-3.500-8.500-9.500-9.500 6-.9 8.900-4 9.500-9.500z"/>',
    sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    book: '<path d="M4 4.5h6.5a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4zM20 4.5h-7.500M20 4.500V18h-7.500"/>',
    copy: '<path d="M8 8h12v12H8zM16 8V4H4v12h4"/>',
    edit: '<path d="M4 20h4L19.500 8.500l-4-4L4 16zM13.500 6.500l4 4"/>',
    download: '<path d="M12 3v12M7 10.500l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 16V4M7 8.500l5-5 5 5M4 20h16"/>',
    evolve: '<path d="M12 21v-8M12 13c0-5-5-5-5-9.500M12 13c0-5 5-5 5-9.500"/>',
    timer: '<circle cx="12" cy="13.500" r="7.500"/><path d="M12 9v4.500l3 1.500M9.500 2.500h5"/>',
    gift: '<path d="M4 7h16v4H4zM5 11v10h14V11M12 7v14M12 7C9.500 7 7.500 5.500 8.500 4.200S11.500 4.500 12 7c.5-2.500 2.200-3.800 3.500-2.800S14.500 7 12 7z"/>',
    calendar: '<path d="M4 6h16v14H4zM4 10.500h16M8 3.500v5M16 3.500v5"/>',
    flame: '<path d="M12 3c.8 4 6 6.200 6 11.500a6 6 0 0 1-12 0c0-3 1.800-4.500 3-7 .8 1 1.200 2 1.800 3 1-2 1.200-4.500 1.200-7.500z"/>',
    bolt: '<path d="M13 2.500 5 13.500h6l-1 8 8-11h-6z"/>',
    layers: '<path d="M12 3.500 21 8l-9 4.500L3 8zM3 12.500l9 4.500 9-4.500M3 16.500l9 4.500 9-4.500"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    pin: '<path d="M12 21v-7M8 3.500h8l-1 6 3 3.500H6l3-3.500z"/>',
    seal: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.500"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.500"/><path d="M12 9v6"/>',
    gemcur: '<path d="M6.500 4h11l3.500 5-9 12L3 9zM3 9h18M9.500 4 8 9l4 12 4-12-1.500-5"/>',
    essence: '<path d="M12 2.500c3.500 4.500 7 8 7 12.500a7 7 0 0 1-14 0c0-4.500 3.500-8 7-12.500zM9 15.500a3.500 3.500 0 0 0 3 3.500"/>',
    key: '<circle cx="8" cy="12" r="4.500"/><circle cx="8" cy="12" r="1.200"/><path d="M12.500 12H22M18 12v4M21 12v3"/>',
    drag: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
    cube: '<path d="M4 8.500 12 4l8 4.500v9L12 22l-8-4.500z"/>',
  };
  function icon(name, cls) {
    return `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }
  /** Rarity as an index of eight ticks (local colour only). */
  const rarityGlyph = (rid, cls) => `<i class="rk ${cls || ''}" style="--n:${D.RARITY[rid].tier + 1}" aria-hidden="true"></i>`;

  // ---------- PATTERN OVERLAYS ----------
  function patternShapes(id, seed) {
    const r = U.mulberry32(seed || 1);
    const dark = 'rgba(8,4,24,.55)', light = 'rgba(255,255,255,.65)';
    let s = '';
    switch (id) {
      case 'striped': {
        const ang = Math.floor(r() * 180), w = 7 + r() * 5, gap = 16 + r() * 8;
        s += `<g transform="rotate(${ang} 100 100)">`;
        for (let y = -60; y < 260; y += gap) s += `<rect x="-60" y="${y.toFixed(1)}" width="320" height="${w.toFixed(1)}" fill="${dark}"/>`;
        s += '</g>'; break;
      }
      case 'spotted':
        for (let i = 0; i < 22; i++) s += `<circle cx="${(r() * 200).toFixed(1)}" cy="${(r() * 200).toFixed(1)}" r="${(3 + r() * 8).toFixed(1)}" fill="${r() < .55 ? dark : light}"/>`;
        break;
      case 'swirled': {
        const cx = 60 + r() * 80, cy = 60 + r() * 80; let d = `M${cx} ${cy}`;
        for (let a = 0; a < 18; a += .3) { const rad = 3 + a * 5; d += `L${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`; }
        s += `<path d="${d}" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${light}" stroke-width="2" transform="translate(4 3)"/>`; break;
      }
      case 'starry':
        for (let i = 0; i < 20; i++) s += sparkle((r() * 200).toFixed(0), (r() * 200).toFixed(0), (3 + r() * 6).toFixed(1), r() < .7 ? 'rgba(255,255,255,.9)' : 'rgba(255,240,160,.9)');
        break;
      case 'marbled':
        for (let i = 0; i < 4; i++) { const y = 20 + r() * 160; s += `<path d="M-10 ${y.toFixed(0)}C${(40 + r() * 40).toFixed(0)} ${(y - 50 + r() * 100).toFixed(0)} ${(110 + r() * 40).toFixed(0)} ${(y - 50 + r() * 100).toFixed(0)} 210 ${(y + r() * 40 - 20).toFixed(0)}" fill="none" stroke="${i % 2 ? light : dark}" stroke-width="${(5 + r() * 9).toFixed(1)}" stroke-linecap="round"/>`; }
        break;
      case 'checkered': {
        const sz = 14 + Math.floor(r() * 10), off = r() * sz;
        for (let y = -sz; y < 220; y += sz) for (let x = -sz; x < 220; x += sz) if (((x / sz + y / sz) | 0) % 2 === 0) s += `<rect x="${(x + off).toFixed(1)}" y="${(y + off).toFixed(1)}" width="${sz}" height="${sz}" fill="${dark}"/>`;
        break;
      }
      case 'scaled': {
        const sz = 16 + Math.floor(r() * 6);
        for (let y = 0, row = 0; y < 220; y += sz * .55, row++) for (let x = (row % 2) * sz / 2 - sz; x < 220; x += sz) s += `<path d="M${x} ${y}a${sz / 2} ${sz / 2} 0 0 0 ${sz} 0" fill="none" stroke="${dark}" stroke-width="2.2"/>`;
        break;
      }
    }
    return s;
  }

  function crackShapes(seed) {
    const r = U.mulberry32(seed ^ 0x9e37);
    let d = '';
    for (let n = 0; n < 3; n++) { let x = 40 + r() * 120, y = 20 + r() * 40; d += `M${x.toFixed(0)} ${y.toFixed(0)}`; for (let i = 0; i < 6; i++) { x += (r() - .5) * 40; y += 18 + r() * 14; d += `L${x.toFixed(0)} ${y.toFixed(0)}`; } }
    return `<path d="${d}" fill="none" stroke="rgba(10,6,20,.9)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1" transform="translate(1.5 1)"/>`;
  }
  function dustShapes(seed) {
    const r = U.mulberry32(seed ^ 0x51ed);
    let s = '';
    for (let i = 0; i < 26; i++) s += `<circle cx="${(r() * 200).toFixed(0)}" cy="${(r() * 200).toFixed(0)}" r="${(1 + r() * 3.2).toFixed(1)}" fill="rgba(40,26,10,.55)"/>`;
    return s;
  }
  function celestialStars(seed) {
    const r = U.mulberry32(seed ^ 0xabc);
    let s = '<rect width="200" height="200" fill="#0a1450" opacity=".55"/>';
    for (let i = 0; i < 26; i++) s += `<circle class="twk" style="animation-delay:${(r() * 3).toFixed(2)}s" cx="${(r() * 200).toFixed(0)}" cy="${(r() * 200).toFixed(0)}" r="${(.8 + r() * 1.8).toFixed(1)}" fill="#fff"/>`;
    return s;
  }

  // ---------- Compose a specimen / base into HTML ----------
  function paletteFilter(spec) { const p = D.PALETTES[spec.palette || 0]; return p && p.hue ? `hue-rotate(${p.hue}deg)` : ''; }
  const VARIANT_FILTER = {
    golden: 'sepia(1) saturate(2.8) hue-rotate(-12deg) brightness(1.08)',
    inverted: 'invert(1) hue-rotate(180deg)',
    shadow: 'brightness(.55) saturate(1.5) hue-rotate(255deg) contrast(1.1)',
    corrupted: 'hue-rotate(-55deg) saturate(1.9) contrast(1.25)',
    celestial: 'saturate(.55) brightness(1.15) hue-rotate(200deg)',
    prismatic: 'saturate(1.5) brightness(1.08)',
  };
  const COND_FILTER = ['', '', '', 'saturate(.82) brightness(.96)', 'saturate(.7) contrast(.95) brightness(.94)'];

  /**
   * Render the art for a specimen (or bare base item).
   * opts: {silhouette, plain (no specimen overlays), cls}
   */
  function render(specOrBase, opts = {}) {
    const spec = typeof specOrBase === 'string' ? null : specOrBase;
    const base = spec ? spec.base : specOrBase;
    const item = D.ITEMS[base];
    const u = U.uid('a');
    const fn = ART[base];
    const body = fn ? fn(item.pal, u) : `<circle cx="100" cy="100" r="60" fill="${item.pal[0]}"/>`;
    const plain = opts.plain || !spec;
    const variant = plain ? 'none' : spec.variant;
    const patt = plain ? 'plain' : spec.pattern;
    const cond = plain ? 2 : spec.condition;
    const seed = plain ? 1 : spec.seed;
    const lvl = plain ? 0 : spec.level;
    const aura = plain ? 'none' : spec.aura;

    const maskId = u + 'mk', bodyId = u + 'bd';
    let fx = '';
    if (patt !== 'plain') fx += `<g mask="url(#${maskId})" class="fx-pattern">${patternShapes(patt, seed)}</g>`;
    if (cond === 4) fx += `<g mask="url(#${maskId})">${crackShapes(seed)}</g>`;
    if (cond === 3) fx += `<g mask="url(#${maskId})">${dustShapes(seed)}</g>`;
    if (variant === 'foil' || variant === 'golden') fx += `<g mask="url(#${maskId})"><rect class="sheen" x="-120" y="-20" width="70" height="240" fill="url(#${u}sh)" transform="skewX(-20)"/></g>`;
    if (variant === 'holographic' || variant === 'prismatic') fx += `<g mask="url(#${maskId})"><rect class="holo" x="-10" y="-10" width="220" height="220" fill="url(#${u}rb)" opacity="${variant === 'prismatic' ? .55 : .4}" style="mix-blend-mode:color-dodge"/></g>`;
    if (variant === 'celestial') fx += `<g mask="url(#${maskId})">${celestialStars(seed)}</g>`;
    let ghosts = '';
    if (variant === 'corrupted' || variant === 'glitched') ghosts = `<use href="#${bodyId}" class="ghost g1" filter="url(#${u}fr)" style="mix-blend-mode:screen"/><use href="#${bodyId}" class="ghost g2" filter="url(#${u}fc)" style="mix-blend-mode:screen"/>`;
    const defs = `<defs><g id="${bodyId}">${body}</g><mask id="${maskId}" style="mask-type:alpha"><use href="#${bodyId}"/></mask>
      <linearGradient id="${u}sh" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${u}rb" x1="0" y1="0" x2="1" y2="1">${['#ff5b5b', '#ffd84a', '#5bff9a', '#4ad0ff', '#a06bff', '#ff5bd8'].map((c, i) => `<stop offset="${i / 5}" stop-color="${c}"/>`).join('')}</linearGradient>
      <filter id="${u}fr"><feColorMatrix values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 0"/></filter><filter id="${u}fc"><feColorMatrix values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .9 0"/></filter></defs>`;

    const filters = [paletteFilter(spec || {}), VARIANT_FILTER[variant] || '', COND_FILTER[cond] || ''].filter(Boolean).join(' ');
    const sz = plain || !spec ? 1 : spec.size;
    const t3 = !opts.silhouette && !opts.no3d && AV.stage && AV.stage.supported() ? AV.stage.art(spec || base) : null;
    const cls = ['art', 'var-' + variant, 'lvl-' + lvl, 'cond-' + cond, aura !== 'none' ? 'has-aura' : '', opts.silhouette ? 'sil' : '', t3 ? 'art-t3 is-pending' : '', opts.cls || ''].join(' ');
    const auraColor = aura !== 'none' ? (D.AURAS.find(a => a.id === aura) || {}).color : '';
    return `<div class="${cls}" ${t3 ? `data-t3="${t3.key}"` : ''} style="${auraColor ? `--aura:${auraColor};` : ''}--sz:${sz}"><svg class="art-svg" viewBox="0 0 200 200" style="${filters ? `filter:${filters}` : ''}" role="img" aria-label="${U.esc(item.name)}">${defs}<use href="#${bodyId}"/>${ghosts}${fx}</svg></div>`;
  }

  /** 3D thumbnail placeholder for a container (falls back to the SVG art inside). */
  function container3(ritualKind, theme, extraCls) {
    const svg = container(ritualKind, theme, extraCls);
    if (!(AV.stage && AV.stage.container3d && AV.stage.container3d(ritualKind))) return svg;
    return `<div class="art art-t3 is-pending" data-t3="${AV.stage.encodeC(ritualKind, theme)}">${svg}</div>`;
  }
  function container(ritualKind, theme, extraCls) {
    const u = U.uid('c');
    const fn = CART[ritualKind] || CART.pack;
    return `<svg class="cart cart-${ritualKind} ${extraCls || ''}" viewBox="0 0 200 200" aria-hidden="true">${fn(theme || ['#4aa8ff', '#7a5cff'], u)}</svg>`;
  }

  AV.art = { render, container, container3, icon, rarityGlyph, ITEM_ART: ART, CONTAINER_ART: CART, sparkle };
})();
