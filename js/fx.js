/* AETHERVAULT — particles, ambient motes, parallax, screen shake, flash. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util;
  let amb, ambCtx, fxc, fxCtx, W = 0, H = 0, dpr = 1, running = false;
  const motes = [], parts = [], rings = [];
  let shakeAmt = 0, shakeEnd = 0, mx = 0, my = 0;

  const st = () => (AV.state.get() ? AV.state.get().settings : {});
  const reduced = () => !!st().reducedMotion;
  const intensity = () => (reduced() ? 0.15 : 1);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    [amb, fxc].forEach(c => { if (!c) return; c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; });
    if (ambCtx) ambCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fxCtx) fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init() {
    amb = document.getElementById('ambient'); fxc = document.getElementById('fx');
    ambCtx = amb.getContext('2d'); fxCtx = fxc.getContext('2d');
    resize(); window.addEventListener('resize', resize);
    seedMotes();
    window.addEventListener('pointermove', e => {
      mx = (e.clientX / W - .5) * 2; my = (e.clientY / H - .5) * 2;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    start();
  }

  function seedMotes() {
    motes.length = 0;
    const n = Math.round(Math.min(22, W * H / 90000));
    for (let i = 0; i < n; i++) motes.push(newMote(true));
  }
  function newMote(anywhere) {
    const col = (getComputedStyle(document.body).getPropertyValue('--mote') || '236,227,207').trim();
    return { x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10, r: .5 + Math.random() * 1.3, vy: -(.05 + Math.random() * .16), vx: (Math.random() - .5) * .08, a: .08 + Math.random() * .22, c: col, p: Math.random() * 6.28 };
  }

  // Scheduling: the loop runs on rAF only while particles / rings / shake are alive. Otherwise the slow ambient motes are redrawn from a
  // ~15 fps timer (they drift a few px/s), and with reduced motion nothing is scheduled at all until an effect wakes it.
  let rafOn = false, tmr = 0;
  const ambientMs = () => ((AV.stage && AV.stage.quality && AV.stage.quality() === 'low') ? 100 : 66);
  const busy = () => parts.length > 0 || rings.length > 0 || fxDirty || shakeAmt > 0;
  function schedule() {
    if (!running) return;
    if (busy()) { if (tmr) { clearTimeout(tmr); tmr = 0; } if (!rafOn) { rafOn = true; requestAnimationFrame(loop); } }
    else if (!rafOn && !tmr && !reduced()) tmr = setTimeout(() => { tmr = 0; loop(performance.now()); }, ambientMs());
  }
  function start() { if (running) return; running = true; last = performance.now(); schedule(); }
  function stop() { running = false; if (tmr) { clearTimeout(tmr); tmr = 0; } }
  const kick = () => { if (running && !rafOn) schedule(); };
  AV.fxStats = () => ({ running, rafOn, timer: !!tmr, parts: parts.length, rings: rings.length });
  let last = 0, lastAmb = 0, lastAmbT = 0, ambDirty = false, fxDirty = false;

  function loop(now) {
    rafOn = false;
    if (!running) return;
    const dt = Math.min(48, now - last) / 16.67; last = now;
    const ambDt = Math.min(100, now - lastAmbT) / 16.67; if (now - lastAmb >= 30) lastAmbT = now;
    // ambient layer — slow drifting motes, drawn at ~30fps (motion is dt-scaled) to spare the compositor a full-screen redraw
    if (reduced()) { if (ambDirty) { ambCtx.clearRect(0, 0, W, H); ambDirty = false; } }
    else if (now - lastAmb >= 30) {
      lastAmb = now; ambDirty = true;
      ambCtx.clearRect(0, 0, W, H);
      ambCtx.globalCompositeOperation = 'source-over';
      for (const m of motes) {
        m.y += m.vy * ambDt; m.x += (m.vx + Math.sin(now / 2400 + m.p) * .1) * ambDt; m.p += .01 * ambDt;
        if (m.y < -10) Object.assign(m, newMote(false));
        const tw = .6 + .4 * Math.sin(now / 700 + m.p * 3);
        ambCtx.fillStyle = `rgba(${m.c},${(m.a * tw).toFixed(3)})`;
        ambCtx.beginPath(); ambCtx.arc(m.x + mx * m.r * 6, m.y + my * m.r * 6, m.r, 0, 6.283); ambCtx.fill();
      }
      ambCtx.globalCompositeOperation = 'source-over';
    }
    // fx layer
    if (parts.length || rings.length || fxDirty) { fxCtx.clearRect(0, 0, W, H); fxDirty = !!(parts.length || rings.length); }
    if (parts.length || rings.length) {
      fxCtx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
        if (p.target) { // converge toward target
          const dx = p.target.x - p.x, dy = p.target.y - p.y; p.vx += dx * p.pull * dt; p.vy += dy * p.pull * dt; p.vx *= .92; p.vy *= .92;
          if (dx * dx + dy * dy < 100) p.life = Math.min(p.life, 4);
        } else { p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const k = p.life / p.max, a = Math.min(1, k * 2) * p.alpha;
        fxCtx.fillStyle = p.color; fxCtx.globalAlpha = a;
        if (p.shape === 'star') { drawStar(fxCtx, p.x, p.y, p.size * (.5 + k * .5), p.rot); }
        else if (p.shape === 'rect') { fxCtx.save(); fxCtx.translate(p.x, p.y); fxCtx.rotate(p.rot); fxCtx.fillRect(-p.size, -p.size * .5, p.size * 2, p.size); fxCtx.restore(); }
        else { fxCtx.beginPath(); fxCtx.arc(p.x, p.y, Math.max(.3, p.size * (.4 + k * .6)), 0, 6.283); fxCtx.fill(); }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.life -= dt; if (r.life <= 0) { rings.splice(i, 1); continue; }
        const k = 1 - r.life / r.max; fxCtx.globalAlpha = (1 - k) * .8; fxCtx.strokeStyle = r.color; fxCtx.lineWidth = r.w * (1 - k * .6);
        fxCtx.beginPath(); fxCtx.arc(r.x, r.y, r.r * (1 - Math.pow(1 - k, 3)), 0, 6.283); fxCtx.stroke();
      }
      fxCtx.globalAlpha = 1; fxCtx.globalCompositeOperation = 'source-over';
    }
    // shake
    if (shakeAmt > 0) {
      const left = shakeEnd - now;
      const el = document.getElementById('shakeRoot');
      if (left <= 0) { shakeAmt = 0; if (el) el.style.transform = ''; }
      else if (el) { const a = shakeAmt * Math.min(1, left / 300); el.style.transform = `translate(${((Math.random() - .5) * 2 * a).toFixed(1)}px,${((Math.random() - .5) * 2 * a).toFixed(1)}px)`; }
    }
    schedule();
  }

  function drawStar(c, x, y, r, rot) {
    c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
    for (let i = 0; i < 8; i++) { const rad = i % 2 ? r * .25 : r; const a = i * Math.PI / 4; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    c.closePath(); c.fill(); c.restore();
  }

  // ---- public effects ----
  function burst(x, y, o = {}) {
    const n = Math.round((o.count || 24) * intensity()); const cols = o.colors || ['#ece3cf'];
    for (let i = 0; i < n; i++) {
      const a = (o.angle != null ? o.angle : Math.random() * 6.283) + (Math.random() - .5) * (o.spread != null ? o.spread : 6.283);
      const sp = (o.speed || 6) * (.3 + Math.random() * .9);
      const life = (o.life || 50) * (.6 + Math.random() * .6);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.gravity != null ? o.gravity : .12, drag: o.drag || .985, life, max: life,
        size: (o.size || 3) * (.5 + Math.random()), color: U.pick(cols), alpha: o.alpha || 1, shape: o.shape || (Math.random() < .3 ? 'star' : 'circle'), rot: Math.random() * 6, vr: (Math.random() - .5) * .3 });
    }
    if (parts.length > 900) parts.splice(0, parts.length - 900);
    kick();
  }
  function converge(x, y, o = {}) {
    const n = Math.round((o.count || 40) * intensity()), R = o.radius || 260;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, d = R * (.6 + Math.random() * .6), life = o.life || 70;
      parts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: 0, vy: 0, g: 0, drag: 1, life, max: life, size: (o.size || 3) * (.5 + Math.random()), color: U.pick(o.colors || ['#fff']), alpha: .9,
        shape: Math.random() < .4 ? 'star' : 'circle', rot: 0, vr: .1, target: { x, y }, pull: .004 + Math.random() * .004 });
    }
    kick();
  }
  function ring(x, y, color, r = 300, life = 40, w = 6) { if (reduced()) { r *= .6; w = 3; } rings.push({ x, y, color, r, life, max: life, w }); kick(); }
  function confetti(o = {}) {
    const n = Math.round((o.count || 80) * intensity());
    for (let i = 0; i < n; i++) {
      const life = 110 + Math.random() * 60;
      parts.push({ x: Math.random() * W, y: -20 - Math.random() * 100, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, g: .05, drag: .995, life, max: life,
        size: 3 + Math.random() * 4, color: U.pick(o.colors || ['#ffc247', '#ff4fa8', '#6cf2ff', '#b862ff']), alpha: 1, shape: 'rect', rot: Math.random() * 6, vr: (Math.random() - .5) * .4 });
    }
    kick();
  }
  function shake(amount = 10, ms = 400) {
    const s = st(); if (!s.shake || s.reducedMotion) return;
    shakeAmt = Math.max(shakeAmt, amount); shakeEnd = performance.now() + ms; kick();
  }
  function flash(color = '#fff', ms = 350, strength = .8) {
    const s = st(); if (!s.flashing || s.reducedMotion) return;
    const el = document.getElementById('flash'); if (!el) return;
    el.style.background = color; el.style.transition = 'none'; el.style.opacity = strength;
    requestAnimationFrame(() => { el.style.transition = `opacity ${ms}ms ease-out`; el.style.opacity = 0; });
  }
  /** centre of an element in viewport coords */
  function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function burstAt(el, o) { if (!el) return; const c = centerOf(el); burst(c.x, c.y, o); }

  AV.fx = { wake: () => { if (reduced()) { if (tmr) { clearTimeout(tmr); tmr = 0; } if (ambDirty && ambCtx) { ambCtx.clearRect(0, 0, W, H); ambDirty = false; } } else kick(); }, init, burst, converge, ring, confetti, shake, flash, centerOf, burstAt };
})();
