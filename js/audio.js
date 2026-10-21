/* AETHERVAULT — synthesized audio. No samples; everything is generated with WebAudio. */
(function () {
  const AV = (window.AV = window.AV || {});
  let ctx = null, master, busSfx, busOpen, noiseBuf = null;
  let lastHover = 0;

  // Background music: the MP3s in music/background music/. Each screen has its own track.
  const TRACKS = [
    'music/background music/monume-retro-arcade-game-music-577980.mp3',            // 0
    'music/background music/alex-morgan-game-level-pixel-quest-loop-578505.mp3',   // 1
    'music/background music/leberch-fantasy-ambient-586801.mp3',                   // 2
    'music/background music/alex-morgan-fantasy-adventure-quest-537478.mp3',       // 3
  ].map(encodeURI);
  const SCREEN_TRACK = { home: 2, settings: 2, open: 3, store: 3, vault: 1, forge: 1, pets: 0 };
  let musicEl = null, musicIdx = 2, musicDuck = 1, duckTimer = null, fadeTimer = null;

  const S = () => (AV.state.get() ? AV.state.get().settings : { master: .8, music: .45, sfx: .8, opening: .9 });
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); busSfx = ctx.createGain(); busOpen = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    busSfx.connect(master); busOpen.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume();
      if (musicEl) { if (document.hidden) musicEl.pause(); else if (S().music > 0.001 && S().master > 0.001) musicEl.play().catch(() => {}); }
    });
    return ctx;
  }

  function applyVolumes() {
    if (!ctx) return; const s = S(), t = ctx.currentTime;
    master.gain.setTargetAtTime(s.master, t, .03);
    busSfx.gain.setTargetAtTime(s.sfx, t, .03);
    busOpen.gain.setTargetAtTime(s.opening, t, .03);
    if (s.music > 0.001 && s.master > 0.001) startMusic(); else stopMusic();
    setMusicVolume();
  }

  // ---- primitives ----
  function tone(freq, dur, o = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0), g = ctx.createGain(), osc = ctx.createOscillator();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const vol = (o.gain == null ? .2 : o.gain), a = o.attack || .005;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || busSfx);
    osc.start(t); osc.stop(t + dur + .05);
  }
  function noise(dur, o = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0), src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true; f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0 || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const vol = o.gain == null ? .2 : o.gain, a = o.attack || .005;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || busSfx);
    src.start(t, Math.random()); src.stop(t + dur + .05);
  }
  const chord = (notes, dur, o = {}) => notes.forEach((n, i) => tone(midi(n), dur, Object.assign({ delay: (o.stagger || 0) * i }, o)));

  // ---- UI sounds ----
  const SFX = {
    hover() { const n = performance.now(); if (n - lastHover < 40) return; lastHover = n; tone(1900, .04, { type: 'triangle', gain: .035 }); },
    click() { tone(520, .07, { type: 'triangle', gain: .14, slide: 1.5 }); tone(1040, .05, { type: 'sine', gain: .06, delay: .01 }); },
    soft() { tone(780, .05, { type: 'sine', gain: .08 }); },
    confirm() { chord([72, 76, 79], .22, { type: 'triangle', gain: .13, stagger: .06 }); },
    error() { tone(160, .18, { type: 'square', gain: .08, slide: .7, lp: 700 }); tone(130, .2, { type: 'square', gain: .07, delay: .1, slide: .7, lp: 600 }); },
    nav() { noise(.18, { f0: 600, f1: 3200, q: 2, gain: .06 }); tone(330, .12, { type: 'sine', gain: .06, slide: 1.4 }); },
    coin() { tone(1568, .12, { type: 'square', gain: .05 }); tone(2093, .22, { type: 'square', gain: .05, delay: .07 }); },
    toast() { tone(880, .08, { type: 'sine', gain: .08 }); tone(1320, .12, { type: 'sine', gain: .06, delay: .06 }); },
    open() { noise(.3, { f0: 300, f1: 2500, q: 1.5, gain: .12, bus: busOpen }); tone(120, .35, { type: 'sine', gain: .2, slide: .5, bus: busOpen }); },
    tear() { noise(.4, { f0: 1500, f1: 6000, q: .8, gain: .22, bus: busOpen }); for (let i = 0; i < 6; i++) noise(.03, { f0: 4000, q: 4, gain: .12, delay: i * .045, bus: busOpen }); },
    thump() { tone(90, .3, { type: 'sine', gain: .35, slide: .4, bus: busOpen }); noise(.08, { f0: 200, type: 'lowpass', gain: .15, bus: busOpen }); },
    crack(n = 1) { noise(.07, { f0: 2500 + n * 500, q: 3, gain: .26, bus: busOpen }); tone(160 + n * 40, .16, { type: 'triangle', gain: .22, slide: .5, bus: busOpen }); tone(1300 + n * 160, .06, { type: 'square', gain: .06, bus: busOpen }); },
    lock(n = 1) { tone(1250 + n * 120, .08, { type: 'triangle', gain: .22, bus: busOpen }); tone(840 + n * 80, .12, { type: 'triangle', gain: .18, delay: .05, bus: busOpen }); noise(.04, { f0: 6000, q: 5, gain: .12, bus: busOpen }); },
    twist() { noise(.22, { f0: 800, f1: 1800, q: 6, gain: .12, bus: busOpen }); tone(300, .2, { type: 'sawtooth', gain: .05, slide: 1.6, lp: 900, bus: busOpen }); },
    whoosh() { noise(.45, { f0: 400, f1: 4200, q: .9, gain: .16, bus: busOpen }); },
    slide() { noise(.2, { f0: 2400, f1: 900, q: 1, gain: .1, bus: busOpen }); },
    dismantle() { noise(.35, { f0: 3000, f1: 200, q: 1.2, gain: .2 }); tone(300, .4, { type: 'sawtooth', gain: .09, slide: .3, lp: 1200 }); tone(1500, .1, { type: 'sine', gain: .05, delay: .3 }); },
    upgrade() { chord([67, 71, 74, 79], .5, { type: 'triangle', gain: .12, stagger: .07 }); noise(.5, { f0: 800, f1: 7000, q: 2, gain: .08 }); tone(1568, .4, { type: 'sine', gain: .08, delay: .3 }); },
    evolve() { tone(98, 1.4, { type: 'sawtooth', gain: .1, slide: 3, lp: 900, attack: .5 }); chord([60, 64, 67, 72], 1.6, { type: 'triangle', gain: .12, attack: .6, delay: 0 }); setTimeout(() => { if (ctx) { chord([72, 76, 79, 84, 88], 1.4, { type: 'triangle', gain: .13, stagger: .05 }); noise(.9, { f0: 1000, f1: 9000, gain: .1 }); } }, 1200); },
    levelup() { chord([67, 72, 76, 79, 84], .5, { type: 'square', gain: .06, stagger: .09, lp: 2400 }); tone(1046, .6, { type: 'sine', gain: .1, delay: .45 }); },
    fav() { tone(988, .08, { type: 'sine', gain: .12 }); tone(1319, .18, { type: 'sine', gain: .1, delay: .06 }); },
    lockset() { tone(420, .06, { type: 'square', gain: .08, lp: 1200 }); tone(280, .1, { type: 'square', gain: .08, delay: .05, lp: 900 }); },
    glitch() { for (let i = 0; i < 9; i++) { const d = i * .07 + Math.random() * .03; tone(80 + Math.random() * 1800, .05 + Math.random() * .05, { type: 'square', gain: .09, delay: d, bus: busOpen }); noise(.05, { f0: 500 + Math.random() * 6000, q: 6, gain: .12, delay: d, bus: busOpen }); } },
    trait() { tone(1400 + Math.random() * 300, .07, { type: 'triangle', gain: .09, bus: busOpen }); },
    // startup sequence: a low waking hum, a rising soft tick per completed stage, a bright resolve when the gateway opens
    bootwake() { tone(55, 1.4, { type: 'sine', gain: .1, attack: .6 }); tone(110, 1.2, { type: 'sine', gain: .04, attack: .7 }); },
    bootstep(i = 0) { tone(midi(60 + i * 2), .24, { type: 'sine', gain: .07, attack: .02 }); tone(midi(72 + i * 2), .16, { type: 'triangle', gain: .03, delay: .04 }); },
    bootdone() { chord([60, 67, 72, 79], 1.5, { type: 'sine', gain: .07, attack: .25, stagger: .05 }); noise(.9, { f0: 300, f1: 4000, q: .8, gain: .05, attack: .4 }); },
  };

  // ---- Rarity stings (index == tier) ----
  const STING = [
    () => { tone(midi(72), .14, { type: 'triangle', gain: .18, bus: busOpen }); },
    () => { chord([74, 79], .3, { type: 'triangle', gain: .17, stagger: .08, bus: busOpen }); },
    () => { chord([72, 76, 79, 84], .4, { type: 'triangle', gain: .16, stagger: .07, bus: busOpen }); noise(.5, { f0: 4000, f1: 9000, gain: .06, bus: busOpen }); },
    () => { tone(70, .9, { type: 'sine', gain: .3, slide: .7, bus: busOpen }); chord([57, 64, 69, 76], 1.1, { type: 'sawtooth', gain: .06, lp: 1800, attack: .25, bus: busOpen }); noise(.8, { f0: 300, f1: 5000, gain: .12, bus: busOpen }); setTimeout(() => chord([81, 84, 88], .6, { type: 'triangle', gain: .12, stagger: .06, bus: busOpen }), 600); },
    () => { tone(55, 1.2, { type: 'sine', gain: .4, slide: .6, bus: busOpen }); chord([53, 60, 65, 69, 72], 1.6, { type: 'sawtooth', gain: .06, lp: 2200, attack: .3, bus: busOpen }); noise(1.1, { f0: 400, f1: 8000, gain: .14, bus: busOpen }); setTimeout(() => chord([77, 81, 84, 89], .9, { type: 'triangle', gain: .13, stagger: .07, bus: busOpen }), 800); },
    () => { tone(50, 1.8, { type: 'sine', gain: .5, slide: .6, bus: busOpen }); chord([48, 55, 60, 64, 67], 2.2, { type: 'sawtooth', gain: .07, lp: 2600, attack: .4, bus: busOpen });
      setTimeout(() => { chord([72, 76, 79, 84], 1.2, { type: 'square', gain: .06, lp: 3000, stagger: .08, bus: busOpen }); chord([84, 88, 91, 96], 1.6, { type: 'triangle', gain: .12, stagger: .1, bus: busOpen }); noise(1.4, { f0: 1000, f1: 10000, gain: .13, bus: busOpen }); }, 900); },
    () => { tone(45, 2.4, { type: 'sine', gain: .5, slide: .5, bus: busOpen });
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => { tone(midi(n), 2.6, { type: 'sine', gain: .08, attack: .6 + i * .05, detune: (i % 2 ? 6 : -6), bus: busOpen }); tone(midi(n + 12), 2.2, { type: 'sine', gain: .045, attack: .8, delay: .3, bus: busOpen }); });
      for (let i = 0; i < 10; i++) tone(midi(84 + Math.floor(Math.random() * 14)), .5, { type: 'sine', gain: .06, delay: .8 + i * .12, bus: busOpen }); noise(2, { f0: 600, f1: 12000, gain: .1, attack: .8, bus: busOpen }); },
    () => { SFX.glitch(); tone(110, 1.8, { type: 'sawtooth', gain: .12, slide: .25, lp: 600, bus: busOpen, delay: .3 }); setTimeout(() => { SFX.glitch(); tone(40, 1.2, { type: 'square', gain: .2, slide: .5, lp: 300, bus: busOpen }); }, 700); },
  ];

  function play(name, a) { if (!ctx) init(); if (!ctx || (S().master < .001)) return; const f = SFX[name]; if (f) { try { f(a); } catch (e) { console.warn(e); } } }
  /** Play only if the browser has already allowed audio (never creates or resumes the context: startup must not wait for, or fight, autoplay rules). */
  function cue(name, a) { if (!ctx || ctx.state !== 'running' || S().master < .001) return; const f = SFX[name]; if (f) { try { f(a); } catch (e) { /* ignore */ } } }
  /** Warm the music element without playing it; actual playback still starts from the first user gesture via applyVolumes(). */
  function prepare() { if (musicEl) return true; try { musicEl = new Audio(); musicEl.preload = 'metadata'; musicEl.loop = true; musicEl.src = TRACKS[musicIdx]; musicEl.addEventListener('error', () => console.warn('Music track failed to load:', musicEl.src)); setMusicVolume(); return true; } catch (e) { return false; } }
  function sting(tier) { if (!ctx) init(); if (!ctx) return; try { (STING[tier] || STING[0])(); } catch (e) { console.warn(e); } }

  /** Rising charge tone; call update(p 0..1) then stop(). */
  function charge() {
    if (!ctx) init(); if (!ctx) return { update() {}, stop() {} };
    const osc = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    osc.type = 'sawtooth'; osc.frequency.value = 80; f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0.0001;
    osc.connect(f); f.connect(g); g.connect(busOpen); osc.start();
    return {
      update(p) { const t = ctx.currentTime; osc.frequency.setTargetAtTime(70 + p * 260, t, .04); f.frequency.setTargetAtTime(300 + p * 2600, t, .04); g.gain.setTargetAtTime(p * .14, t, .05); },
      stop() { const t = ctx.currentTime; g.gain.setTargetAtTime(0.0001, t, .05); osc.stop(t + .3); },
    };
  }

  // ---- Background music (MP3 playlist) ----
  function musicLevel() { const s = S(); return Math.min(1, Math.max(0, s.master * s.music * musicDuck)); }
  function setMusicVolume() { if (musicEl) musicEl.volume = musicLevel(); }
  function startMusic() {
    if (musicEl) { if (musicEl.paused) musicEl.play().catch(() => {}); return; }
    musicEl = new Audio(TRACKS[musicIdx]);
    musicEl.preload = 'auto'; musicEl.loop = true;
    musicEl.addEventListener('error', () => console.warn('Music track failed to load:', musicEl.src));
    setMusicVolume();
    musicEl.play().catch(() => {});
  }
  function stopMusic() { if (musicEl) musicEl.pause(); }
  function fadeMusic(to, ms, done) {
    clearInterval(fadeTimer);
    const from = musicEl.volume, steps = Math.max(1, Math.round(ms / 40)); let i = 0;
    fadeTimer = setInterval(() => {
      i++; musicEl.volume = Math.min(1, Math.max(0, from + (to - from) * Math.min(1, i / steps)));
      if (i >= steps) { clearInterval(fadeTimer); fadeTimer = null; done && done(); }
    }, 40);
  }
  /** Crossfade to the screen's track. Called by the UI on every screen change. */
  function setScreen(name) {
    const idx = SCREEN_TRACK[name];
    if (idx === undefined || idx === musicIdx) return;
    musicIdx = idx;
    if (!musicEl) return;
    const playing = !musicEl.paused;
    fadeMusic(0, 700, () => {
      musicEl.src = TRACKS[idx];
      if (playing) musicEl.play().catch(() => {});
      fadeMusic(musicLevel(), 900);
    });
  }
  /** Quiet the music during big moments. */
  function duck(level = .25, ms = 2500) {
    if (!ctx) return;
    musicDuck = level; setMusicVolume();
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => { musicDuck = 1; setMusicVolume(); }, ms);
  }

  AV.audio = { init, applyVolumes, play, cue, prepare, sting, charge, duck, setScreen, isReady: () => !!ctx, running: () => !!ctx && ctx.state === 'running' };
})();
