// Lantern Spark, a mode of Lantern. The lantern is out: strike sparks to see the river. The rules are Lantern's (../sim.js,
// unchanged) under the spark layer (./spark-sim.js); this file draws the dark river, plays the spark sounds, reads the spark input
// and keeps Spark's own save. index.html owns the run: steering, hearts, embers and the bank, the boat's looks, crashes, victories,
// pause and the end card. How a mode plugs in is in ../NOTES.md ("How a mode plugs in").
import { start, tick, view, stars, murmur, rating, reach, centre, half, NIGHTS, TIN_MAX, RING_MAX } from './spark-sim.js?v=1';
import { read, write, readJson, writeJson } from '../../kit/save.js';
import { t } from '../words.js?v=2';
import { mark, TINT } from '../looks.js?v=4';

// Save. lantern-mode-spark:save is { v: 1, best: highest night open, stars: { night: 0..3 }, played: runs }.
// lantern-mode-spark:spark is '1' once the player has struck a spark (the button stops pulsing).
// lantern-mode-spark:tips holds the one-time tips already shown, a letter each ('f' fireflies, 'h' holes in the stars).
// The lab page's save (lantern-spark:save, same format) is read once to carry best and stars over, and never written.
const KEY = 'lantern-mode-spark:save', SPARKED = 'lantern-mode-spark:spark', TIPS = 'lantern-mode-spark:tips';
const OLD = 'lantern-spark:save', OLD_SPARKED = 'lantern-spark:spark';
function load() {
  let raw = readJson(KEY);
  if (raw === null) { const old = readJson(OLD); if (old && typeof old === 'object') { raw = { v: 1, best: old.best, stars: old.stars, played: 0 }; writeJson(KEY, clean(raw)); } }
  return clean(raw);
}
function clean(raw) {
  const v = raw && typeof raw === 'object' ? raw : {}, stars = {};
  if (v.stars && typeof v.stars === 'object') for (let n = 1; n <= NIGHTS; n++) { const k = Math.floor(v.stars[n]); if (k > 0) stars[n] = Math.min(3, k); }
  return { v: 1, best: Math.max(1, Math.min(NIGHTS, Math.floor(v.best) || 1)), stars, played: Math.max(0, Math.floor(v.played) || 0) };
}

const STYLE = `
#sparkBtn { position: fixed; right: calc(22px + env(safe-area-inset-right)); bottom: calc(24px + env(safe-area-inset-bottom)); width: 72px; height: 72px; min-width: 0; min-height: 0; margin: 0; padding: 0; border-radius: 50%; display: none; touch-action: none; z-index: 5;
  background: radial-gradient(circle at 50% 42%, #ffe9b8 0, rgb(var(--fire)) 34%, #3a1c08 78%, #1a0e04 100%); border: 2px solid #ffd9a0; box-shadow: 0 0 22px rgba(var(--fire),.55), inset 0 -6px 12px #0006; }
#sparkBtn svg { width: 34px; height: 34px; display: block; margin: 0 auto; filter: drop-shadow(0 0 4px #fff8); }
#sparkBtn b { position: absolute; right: -6px; top: -6px; min-width: 28px; height: 28px; border-radius: 14px; background: #0b1020; color: #ffe6bd; border: 1.5px solid #ffd9a0aa; font: bold 15px/25px system-ui, sans-serif; text-align: center; padding: 0 3px; box-sizing: border-box; }
#sparkBtn.hit { animation: sparkHit .25s ease-out; }
@keyframes sparkHit { 40% { transform: scale(.86); } 70% { transform: scale(1.08); } }
#sparkBtn.empty { filter: grayscale(.9) brightness(.55); }
#sparkBtn.pulse::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 3px solid #ffe9b8; animation: sparkRing 1.3s ease-out infinite; pointer-events: none; }
#sparkBtn.call { box-shadow: 0 0 40px 10px rgba(var(--fire),.9), inset 0 -6px 12px #0006; }
@keyframes sparkRing { from { transform: scale(1); opacity: .9; } to { transform: scale(1.4); opacity: 0; } } /* the ring's widest (40px × 1.4) stays inside the screen from the button's centre 58px in from the edge (Pixel 7 check, 2026-11-27) */
@media (prefers-reduced-motion: reduce) { #sparkBtn.pulse::after { animation: none; opacity: .8; transform: scale(1.25); } }
#modePanel .nights { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: .6em 0 .3em; }
#modePanel .nights button { min-width: 48px; width: 48px; height: 56px; padding: 0; margin: 0; border-radius: 14px; display: grid; place-items: center; line-height: 1; font-size: 18px; }
#modePanel .nights button small { display: block; font-size: 14px; color: #ffcf6e; letter-spacing: -1px; margin-top: 2px; }
#modePanel .nights button.on { border-color: #ffd9a0; background: #ffd9a022; box-shadow: 0 0 14px #ffb45a55; }
#modePanel .nights button:disabled { opacity: .3; }
`;
const STAR_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#fff6dc" d="M16 1 L18.6 12.2 L29 8 L20.4 15.6 L31 20 L19.6 19.4 L21 31 L15.4 21.4 L8 30 L11.4 19 L1 17.2 L11.6 13.4 L6 4 L14.4 11 Z"/></svg>';

// page: what index.html lends a mode. See ../NOTES.md for each name.
export function mode(page) {
  const save = load();
  let night = save.best, e = null, want = false, squash = 0, shake = 0, red = 0, bits = [], passed = new Set(), trails = new WeakMap(), shapes = new WeakMap(), shapeN = 0;
  let told = false, lastSlap = 0, murmurGain = null, pan = null, W = 1, H = 1, unit = 1, left = 0, dpr = 1;
  const sparked = () => read(SPARKED) === '1' || read(OLD_SPARKED) === '1';
  const tipped = k => (read(TIPS, '') || '').includes(k), tip = k => write(TIPS, (read(TIPS, '') || '') + k);

  // The spark button, shown only while a run is on the screen. A second finger, a mouse click or Space strikes a spark too.
  const css = document.createElement('style'); css.textContent = STYLE; document.head.append(css);
  const btn = document.createElement('button'); btn.id = 'sparkBtn'; btn.style.setProperty('--fire', '255,180,90'); btn.innerHTML = STAR_SVG + '<b>8</b>'; document.body.append(btn);
  const badge = btn.querySelector('b');
  function strike() {
    if (!page.live()) return;
    want = true; btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit');
    if (!sparked()) write(SPARKED, '1');
    btn.classList.remove('pulse', 'call');
  }
  btn.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); if (page.paused()) page.resume(); else strike(); });
  btn.addEventListener('click', ev => ev.preventDefault());
  // Window capture runs before the page's steering on the canvas, so a second finger never reaches it (it would take the steering over).
  const touches = new Set();
  addEventListener('pointerdown', ev => {
    if (!on() || ev.target !== page.canvas) return;
    if (ev.pointerType === 'mouse') { strike(); return; }
    if (touches.size && page.live()) { touches.add(ev.pointerId); ev.stopImmediatePropagation(); strike(); return; }
    touches.add(ev.pointerId);
  }, true);
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, ev => touches.delete(ev.pointerId), true);
  addEventListener('keydown', ev => { if (on() && ev.key === ' ' && page.live()) { ev.preventDefault(); ev.stopImmediatePropagation(); if (!ev.repeat) strike(); } }, true);
  let chosen = false; const on = () => chosen && e !== null;

  function size() { ({ W, H, unit, left, dpr } = page.size()); }
  const sx = x => left + x * unit, sy = y => H * 0.74 - (y - e.s.y) * unit;
  const fire = () => page.skin('flame')[2];
  const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

  // ------------------------------------------------------------ the mode's card: nights, stars, play
  function card(box) {
    box.textContent = '';
    const h = document.createElement('h2'); h.textContent = t('modeSpark');
    const what = document.createElement('p'); what.textContent = t('modeSparkWhat');
    const row = document.createElement('div'); row.className = 'nights';
    for (let n = 1; n <= NIGHTS; n++) {
      const b = document.createElement('button'), st = save.stars[n] | 0;
      b.innerHTML = `${n}<small>${'★'.repeat(st)}${'·'.repeat(3 - st)}</small>`; b.dataset.night = n;
      b.disabled = n > save.best; b.classList.toggle('on', n === night); b.setAttribute('aria-label', t('sparkNightAria', { n, k: st }));
      b.addEventListener('click', () => { night = n; page.tone(660 + 60 * n, 0.12, 0.06, 'triangle'); card(box); });
      row.append(b);
    }
    const rule = document.createElement('p'); rule.className = 'hint'; rule.textContent = t('sparkStars');
    const go = document.createElement('button'); go.className = 'main'; go.id = 'modePlay'; go.textContent = t('playNight', { n: night }); go.addEventListener('click', () => page.play());
    const p = document.createElement('p'); p.append(go);
    box.append(h, what, row, p, rule);
    if (read('lantern-view', '2d') !== '2d') { const flat = document.createElement('p'); flat.className = 'hint'; flat.textContent = t('sparkFlat'); box.append(flat); }
  }

  // ------------------------------------------------------------ the run
  function begin(powers) {
    e = start((Math.random() * 2 ** 31) | 0, night, powers);
    want = false; squash = 0; shake = 0; red = 0; bits = []; passed = new Set(); trails = new WeakMap(); told = false; touches.clear();
    btn.classList.toggle('pulse', !sparked()); btn.classList.remove('call', 'empty');
    btn.style.setProperty('--fire', fire()); // the button burns in the player's flame colour
    page.tone(196, 0.5, 0.08, 'triangle'); page.noise(0.35, 0.12, 900); // the lantern blows out; then the free spark that opens a night
    burst(e.s.x, e.s.y, 26, fire(), 0.9);
    return e.s;
  }
  function step(target) {
    const spark = want; want = false;
    tick(e, target, spark);
    const s = e.s;
    for (const f of e.flies) if (!passed.has(f.id) && f.y < s.y && f.y > s.y - 0.3) { passed.add(f.id); if (Math.abs(f.x - s.x) < 0.05) page.tone(2349, 0.18, 0.025, 'sine'); }
    // The first ten seconds: once the free spark has faded, a player who has never struck one is told how, once a run.
    if (!told && s.t > 2.6 && !sparked() && e.used === 0) { told = true; page.say(t('sparkStrike'), 2600); }
    if (s.t > 9 && night === 1 && !tipped('f') && e.flies.some(f => f.y - s.y > 0.2 && f.y - s.y < 1.1)) { tip('f'); page.say(t('sparkFlies'), 2400); }
    else if (s.t > 22 && !tipped('h') && tipped('f')) { tip('h'); page.say(t('sparkHoles'), 2400); }
    badge.textContent = e.tin; btn.classList.toggle('empty', e.tin === 0);
    return e.events;
  }
  function react(ev) { // the page has already played its own sound for the event; these are Spark's
    const s = e.s;
    if (ev === 'spark') { page.tone(1900, 0.09, 0.07, 'square', 900); page.noise(0.09, 0.22, 4200); setTimeout(() => page.tone(1318.5, 0.6, 0.05, 'triangle'), 30); burst(s.x, s.y, 22, fire(), 0.9); squash = 1; }
    if (ev === 'empty') { page.tone(140, 0.12, 0.12, 'square'); page.say(t('sparkEmpty'), 1300); }
    if (ev === 'ember') { burst(s.x, s.y, 14, '255,160,70', 0.5); page.say(e.tin >= TIN_MAX ? t('sparkFull') : t('sparkPlus'), 900); }
    if (ev === 'thunder') { page.noise(1.6, 0.35, 140); page.tone(48, 1.8, 0.22, 'sawtooth', -10); shake = Math.max(shake, 0.5); }
    if (ev === 'hurt') { shake = 1; red = 1; burst(s.x, s.y, 18, '255,90,100', 0.8); }
    if (ev === 'hit') { shake = 1.4; red = 1; }
  }
  // The end of a run: Spark's own save, then the card's words. Nothing here touches Lantern's nights, bests or board.
  function end() {
    const won = e.s.over === 'dawn', st = rating(e), n = night;
    save.played++;
    if (won) { save.stars[n] = Math.max(save.stars[n] | 0, st); if (n < NIGHTS) save.best = Math.max(save.best, n + 1); }
    writeJson(KEY, save);
    const mark3 = ' ' + '★'.repeat(st) + '☆'.repeat(3 - st), why = t(['dark', 'bank', 'ice', 'log', 'pool', 'geyser', 'isle'].includes(e.s.over) ? `why_${e.s.over}` : 'why_rock');
    if (won && n >= NIGHTS) return { title: t('dawn') + mark3, line: t('sparkAll', { n: NIGHTS }), go: t('playNight', { n }) };
    if (won) { night = n + 1; return { title: t('dawn') + mark3, line: t('sparkWon', { used: e.used, next: n + 1 }), go: t('playNight', { n: night }) }; }
    return { title: t('dawnResult', { n: Math.floor(reach(e) * 100) }), line: why, go: t('playAgain') };
  }

  // ------------------------------------------------------------ sound and time between frames
  function frame(dt, now, playing) {
    squash = Math.max(0, squash - dt * 5); shake = Math.max(0, shake - dt * 2.5); red = Math.max(0, red - dt * 2.5);
    for (const p of bits) { p.x += p.vx * dt * 0.25; p.y += p.vy * dt * 0.25; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; } bits = bits.filter(p => p.life > 0);
    const ac = page.ctx(); if (!ac || !e) return;
    if (!murmurGain) { // water on rocks: looping noise, band-passed, panned toward the nearest rock and louder as it nears
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.9;
      murmurGain = ac.createGain(); murmurGain.gain.value = 0; pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
      src.connect(bp).connect(murmurGain); if (pan) murmurGain.connect(pan).connect(ac.destination); else murmurGain.connect(ac.destination);
      src.start();
    }
    const m = playing ? murmur(e) : { level: 0, pan: 0 }, ct = ac.currentTime;
    murmurGain.gain.setTargetAtTime(0.32 * m.level, ct, 0.05); if (pan) pan.pan.setTargetAtTime(m.pan, ct, 0.05);
    if (playing && m.level > 0.6 && now - lastSlap > 700) { lastSlap = now; page.tone(180 + 60 * m.level, 0.12, 0.03, 'sine', -40); } // a slap of water on stone
    btn.classList.toggle('call', playing && !sparked() && m.level > 0.5); // a rock is near and the player has never struck: the button calls
  }
  function quiet() { if (murmurGain && page.ctx()) murmurGain.gain.setTargetAtTime(0, page.ctx().currentTime, 0.05); }

  // ------------------------------------------------------------ drawing (2D only: index.html shows Spark flat)
  function burst(x, y, n, rgb, speed = 0.6, life = 0.8) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = speed * (0.3 + Math.random() * 0.7); bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, rgb }); } }
  const hash = (a, b) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  function shapeOf(k) { let sh = shapes.get(k); if (!sh) { const id = ++shapeN; sh = Array.from({ length: 9 }, (_, i) => 0.82 + 0.3 * hash(id, i)); shapes.set(k, sh); } return sh; }
  function water(g, top, bot) {
    const s = e.s; g.beginPath();
    for (let y = bot; y <= top; y += 0.05) g.lineTo(sx(centre(s, y) - half(s, y)), sy(y));
    for (let y = top; y >= bot; y -= 0.05) g.lineTo(sx(centre(s, y) + half(s, y)), sy(y));
    g.closePath();
  }
  function draw(now, day) {
    size();
    if (!e) { const g = page.g(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#02040a'; g.fillRect(0, 0, W, H); return; } // the mode's card, before its first run
    const g = page.g(), s = e.s, tt = now / 1000, fr = fire(), [wr, wg, wb] = rgbOf(page.skin('water')[2]);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#02040a'; g.fillRect(0, 0, W, H);
    const k0 = shake * shake * 10 * dpr; g.translate((Math.random() - 0.5) * k0, (Math.random() - 0.5) * k0);
    const top = s.y + 0.74 * H / unit + 0.1, bot = s.y - 0.26 * H / unit - 0.1, near = Math.max(0, (reach(e) - 0.85) / 0.15);
    const v = view(e);
    if (day > 0) { for (const r of v.rocks) r.glow = Math.max(r.glow, day); for (const k of s.rocks) if (!v.rocks.some(r => r.k === k)) v.rocks.push({ k, x: k.x, y: k.y, rad: k.rad, len: k.len, glow: day }); }
    // Banks in starlight.
    g.fillStyle = '#060912'; g.globalAlpha = 0.5;
    for (let y = Math.floor(bot / 0.18); y < top / 0.18; y++) for (let i = 0; i < 10; i++) { if (hash(y, i) < 0.5) continue; g.fillRect(hash(i, y) * W, sy(y * 0.18 + hash(y + 3, i) * 0.18), 2 * dpr, 2 * dpr); }
    g.globalAlpha = 1;
    // The water, in the player's water colour, very dark, warming toward dawn.
    water(g, top, bot);
    const grad = g.createLinearGradient(0, 0, 0, H), dim = 0.28;
    grad.addColorStop(0, `rgb(${Math.round(wr * dim + 70 * day + 10 * near)},${Math.round(wg * dim + 40 * day)},${Math.round(wb * dim + 30 * day)})`); grad.addColorStop(1, `rgb(${Math.round(wr * 0.1)},${Math.round(wg * 0.1)},${Math.round(wb * 0.1)})`);
    g.fillStyle = grad; g.fill(); g.strokeStyle = 'rgba(140,160,215,.16)'; g.lineWidth = 1.5 * dpr; g.stroke();
    g.save(); water(g, top, bot); g.clip();
    g.strokeStyle = 'rgba(150,170,230,.05)'; g.lineWidth = 1 * dpr;
    for (let i = Math.floor(bot / 0.23); i < top / 0.23; i++) { const y = i * 0.23 + 0.05 * Math.sin(i), x = centre(s, y) + (hash(i, 9) * 2 - 1) * half(s, y) * 0.8; g.beginPath(); g.moveTo(sx(x), sy(y)); g.lineTo(sx(x + 0.01 * Math.sin(tt + i)), sy(y + 0.12)); g.stroke(); }
    const mw = g.createLinearGradient(0, H * 0.15, W, H * 0.55);
    mw.addColorStop(0, 'rgba(120,140,220,0)'); mw.addColorStop(0.45, `rgba(130,150,230,${0.07 * (1 - day)})`); mw.addColorStop(0.55, `rgba(160,150,230,${0.09 * (1 - day)})`); mw.addColorStop(1, 'rgba(120,140,220,0)');
    g.fillStyle = mw; g.fillRect(0, 0, W, H);
    // Stars reflected in the water: still around the boat, put out wherever a rock passes; brighter where a ring is passing.
    g.globalCompositeOperation = 'lighter';
    for (const p of stars(e, bot, top)) {
      if (!p.on) continue;
      const h1 = hash(p.i + 5, p.j), tw = 0.6 + 0.4 * Math.sin(tt * (1.1 + 2 * hash(p.i, p.j)) + 6.28 * hash(p.j, p.i));
      let lift = 0; for (const r of e.rings) { const d = Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.r); if (d < 0.08) lift = Math.max(lift, 1 - d / 0.08); }
      const X = sx(p.x + 0.0025 * Math.sin(tt * 1.7 + p.j)), Y = sy(p.y), R = (1.1 + 1.5 * h1 * h1 + 1.6 * lift) * dpr;
      const a = Math.min(1, (0.4 + 0.5 * tw + lift * 0.5) * (1 - 0.8 * day)), col = lift > 0.2 ? fr : h1 > 0.9 ? '255,214,170' : h1 < 0.15 ? '170,200,255' : '215,225,255';
      if (R > 2 * dpr) { const sg = g.createRadialGradient(X, Y, 0, X, Y, R * 3); sg.addColorStop(0, `rgba(${col},${0.35 * a})`); sg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = sg; g.fillRect(X - R * 3, Y - R * 3, R * 6, R * 6); }
      g.fillStyle = `rgba(${col},${a})`; g.beginPath(); g.arc(X, Y, R / 2, 0, 6.283); g.fill();
    }
    // Spark rings in the flame's colour, with ripples trailing them.
    for (const r of e.rings) {
      const X = sx(r.x), Y = sy(r.y), a = Math.max(0, 1 - r.r / RING_MAX);
      if (r.r < 0.25) { const fg = g.createRadialGradient(X, Y, 0, X, Y, 0.3 * unit); fg.addColorStop(0, `rgba(255,240,210,${0.5 * (1 - r.r / 0.25)})`); fg.addColorStop(1, `rgba(${fr},0)`); g.fillStyle = fg; g.fillRect(X - 0.3 * unit, Y - 0.3 * unit, 0.6 * unit, 0.6 * unit); }
      for (let j = 0; j < 3; j++) { const rr = r.r - j * 0.07; if (rr <= 0) continue; g.strokeStyle = j ? `rgba(${fr},${a * 0.18 / j})` : `rgba(255,236,200,${a * 0.9})`; g.lineWidth = (j ? 1.5 : 3) * dpr; g.beginPath(); g.arc(X, Y, rr * unit, 0, 6.283); g.stroke(); }
      g.strokeStyle = `rgba(${fr},${a * 0.16})`; g.lineWidth = 16 * dpr; g.beginPath(); g.arc(X, Y, r.r * unit, 0, 6.283); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.restore();
    // Lit banks: a line in the flame's colour along the water's edge, with reeds catching the light.
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (const b of v.banks) {
      if (b.y < bot || b.y > top) continue;
      const a = b.glow ** 1.4, ya = b.y - 0.026, yb = b.y + 0.026, xa = centre(s, ya) + b.side * half(s, ya), xb = centre(s, yb) + b.side * half(s, yb);
      g.strokeStyle = `rgba(${fr},${0.22 * a})`; g.lineWidth = 9 * dpr; g.beginPath(); g.moveTo(sx(xa), sy(ya)); g.lineTo(sx(xb), sy(yb)); g.stroke();
      g.strokeStyle = `rgba(255,220,170,${0.7 * a})`; g.lineWidth = 2.2 * dpr; g.stroke();
      if (hash(Math.round(b.y * 20), b.side) < 0.35) { const X = sx(b.x) + b.side * 4 * dpr, Y = sy(b.y), sway = Math.sin(tt * 1.5 + b.y * 9) * 3 * dpr; g.strokeStyle = `rgba(${fr},${0.45 * a})`; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + b.side * 3 * dpr, Y - 0.03 * unit, X + b.side * 2 * dpr + sway, Y - 0.07 * unit); g.stroke(); }
    }
    g.globalCompositeOperation = 'source-over'; g.lineCap = 'butt';
    // Lit rocks: a trail of where the glow has been, then the rock with a rim in the flame's colour.
    for (const r of v.rocks) {
      const kk = r.k; if (r.y < bot - 0.2 || r.y > top + 0.2) continue;
      let tr = trails.get(kk); if (!tr) trails.set(kk, tr = []);
      const last = tr[tr.length - 1]; if (!last || Math.hypot(last.x - r.x, last.y - r.y) > 0.006) { tr.push({ x: r.x, y: r.y }); if (tr.length > 14) tr.shift(); }
      for (let i = 0; i < tr.length - 1; i++) { g.fillStyle = `rgba(${fr},${0.12 * r.glow * i / tr.length})`; g.beginPath(); g.arc(sx(tr[i].x), sy(tr[i].y), r.rad * unit * 0.8, 0, 6.283); g.fill(); }
      const X = sx(r.x), Y = sy(r.y), R = r.rad * unit, a = r.glow, ice = kk.ice;
      const hal = g.createRadialGradient(X, Y, R * 0.5, X, Y, R * 2.6 + r.len * unit);
      hal.addColorStop(0, ice ? `rgba(160,220,255,${0.35 * a})` : `rgba(${fr},${0.35 * a})`); hal.addColorStop(1, `rgba(${fr},0)`);
      g.fillStyle = hal; g.beginPath(); g.arc(X, Y, R * 2.6 + r.len * unit, 0, 6.283); g.fill();
      g.globalAlpha = Math.min(1, 0.25 + a);
      if (r.len) { g.fillStyle = '#2a1c12'; g.beginPath(); g.roundRect ? g.roundRect(X - (r.len + r.rad) * unit, Y - R, 2 * (r.len + r.rad) * unit, 2 * R, R) : g.rect(X - (r.len + r.rad) * unit, Y - R, 2 * (r.len + r.rad) * unit, 2 * R); g.fill(); g.strokeStyle = `rgba(${fr},${a})`; g.lineWidth = 2 * dpr; g.stroke(); }
      else {
        const sh = shapeOf(kk); g.beginPath();
        for (let i = 0; i < sh.length; i++) { const ang = i / sh.length * 6.283; g.lineTo(X + Math.cos(ang) * R * sh[i], Y + Math.sin(ang) * R * sh[i] * 0.9); }
        g.closePath();
        const body = g.createRadialGradient(X - R * 0.3, Y - R * 0.4, R * 0.1, X, Y, R * 1.2);
        body.addColorStop(0, ice ? '#3d5868' : '#3a2a20'); body.addColorStop(1, ice ? '#0e1820' : '#0d0907');
        g.fillStyle = body; g.fill();
        g.strokeStyle = ice ? `rgba(190,235,255,${a})` : `rgba(${fr},${a})`; g.lineWidth = 2.2 * dpr; g.stroke();
        g.fillStyle = `rgba(255,236,200,${0.5 * a})`; g.beginPath(); g.arc(X - R * 0.35, Y - R * 0.35, R * 0.18, 0, 6.283); g.fill();
      }
      g.globalAlpha = 1;
    }
    // Embers and gifts: coals that glow when lit, or faintly when the boat is close. Abilities show their own mark.
    for (const p of v.embers) {
      const X = sx(p.x), Y = sy(p.y) + Math.sin(tt * 3 + p.y * 9) * 1.5 * dpr, a = p.glow * (0.8 + 0.2 * Math.sin(tt * 6 + p.x * 40));
      const col = p.kind === 'wisp' ? '150,235,110' : p.kind === 'heart' ? '255,60,80' : p.kind === 'shield' ? '90,170,255' : '255,150,60';
      const eg = g.createRadialGradient(X, Y, 0, X, Y, 0.05 * unit); eg.addColorStop(0, `rgba(255,240,200,${a})`); eg.addColorStop(0.3, `rgba(${col},${0.8 * a})`); eg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = eg; g.beginPath(); g.arc(X, Y, 0.05 * unit, 0, 6.283); g.fill();
      if (p.kind === 'heart') { g.globalAlpha = a; g.fillStyle = '#ff4d5e'; g.font = `${0.05 * unit}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', X, Y); g.globalAlpha = 1; }
    }
    for (const p of v.powers) {
      const X = sx(p.x), Y = sy(p.y) + Math.sin(tt * 3 + p.y * 9) * 1.5 * dpr, col = TINT[p.kind];
      const eg = g.createRadialGradient(X, Y, 0, X, Y, 0.06 * unit); eg.addColorStop(0, `rgba(${col},${0.75 * p.glow})`); eg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = eg; g.fillRect(X - 0.06 * unit, Y - 0.06 * unit, 0.12 * unit, 0.12 * unit);
      g.globalAlpha = p.glow; mark(g, p.kind, X, Y, 0.014 * unit, 2 * dpr, tt); g.globalAlpha = 1;
    }
    // Fireflies over safe water, each blinking on its own beat, with a reflection below.
    for (const f of v.flies) {
      if (f.y < bot || f.y > top) continue;
      const ph = f.id * 1.7, X = sx(f.x + 0.012 * Math.sin(tt * 1.3 + ph)), Y = sy(f.y + 0.01 * Math.sin(tt * 2.1 + ph * 2)), blink = 0.45 + 0.55 * Math.max(0, Math.sin(tt * 2.2 + ph)) ** 2;
      const fg = g.createRadialGradient(X, Y, 0, X, Y, 0.035 * unit); fg.addColorStop(0, `rgba(230,255,150,${0.9 * blink})`); fg.addColorStop(1, 'rgba(200,255,120,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(X, Y, 0.035 * unit, 0, 6.283); g.fill();
      g.fillStyle = `rgba(250,255,210,${blink})`; g.beginPath(); g.arc(X, Y, 1.8 * dpr, 0, 6.283); g.fill();
      g.fillStyle = `rgba(200,255,140,${0.25 * blink})`; g.fillRect(X - 1 * dpr, Y + 0.02 * unit, 2 * dpr, 0.012 * unit);
    }
    // The boat in the player's looks (or its crash), then its lantern: out, a wick still glowing in the flame's colour.
    const bx = sx(s.x), by = sy(s.y);
    page.boat(now);
    if (!page.crashed()) {
      g.globalCompositeOperation = 'lighter';
      const wick = Math.min(1, 0.35 + 0.2 * Math.sin(tt * 2.3) + 0.6 * squash), wr2 = (0.012 + 0.01 * squash) * unit, wg2 = g.createRadialGradient(bx, by, 0, bx, by, wr2);
      wg2.addColorStop(0, `rgba(255,235,200,${wick})`); wg2.addColorStop(0.5, `rgba(${fr},${0.7 * wick})`); wg2.addColorStop(1, `rgba(${fr},0)`);
      g.fillStyle = wg2; g.fillRect(bx - wr2, by - wr2, 2 * wr2, 2 * wr2);
      g.globalCompositeOperation = 'source-over';
    }
    // The first second of a night: the lantern's light shrinks to nothing as it goes out.
    if (s.t < 1.2 && s.t > 0) {
      const k = 1 - s.t / 1.2, R = (0.08 + 0.5 * k * k) * unit, lg = g.createRadialGradient(bx, by, 0, bx, by, R);
      g.globalCompositeOperation = 'lighter'; lg.addColorStop(0, `rgba(${fr},${0.45 * k})`); lg.addColorStop(1, `rgba(${fr},0)`); g.fillStyle = lg; g.fillRect(bx - R, by - R, 2 * R, 2 * R); g.globalCompositeOperation = 'source-over';
    }
    // Particles: spark bursts, embers taken, blows.
    for (const p of bits) { const a = Math.max(0, p.life / p.max); g.fillStyle = `rgba(${p.rgb},${a})`; g.beginPath(); g.arc(sx(p.x), sy(p.y), (1 + 2 * a) * dpr, 0, 6.283); g.fill(); }
    if (v.flash > 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(215,228,255,${0.55 * v.flash})`; g.fillRect(0, 0, W, H); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (near > 0 || day > 0) {
      const dg = g.createLinearGradient(0, 0, 0, H * 0.8); dg.addColorStop(0, `rgba(255,170,110,${0.25 * near + 0.35 * day})`); dg.addColorStop(1, 'rgba(255,170,110,0)'); g.fillStyle = dg; g.fillRect(0, 0, W, H);
      const sun = g.createRadialGradient(W / 2, -H * 0.05, 0, W / 2, -H * 0.05, H * 0.55); sun.addColorStop(0, `rgba(255,236,190,${0.2 * near + 0.55 * day})`); sun.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = sun; g.fillRect(0, 0, W, H);
    }
    const vg = g.createRadialGradient(W / 2, H * 0.6, Math.min(W, H) * 0.3, W / 2, H * 0.6, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.65 * (1 - day)})`); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (red > 0) { g.fillStyle = `rgba(200,30,40,${0.3 * red})`; g.fillRect(0, 0, W, H); }
    page.win(now);
    g.fillStyle = 'rgba(255,217,160,.5)'; g.fillRect(0, 0, W * reach(e), 3 * dpr); // how far to dawn, as on a story night
  }

  return {
    id: 'spark',
    card, // fill the mode's screen (#modePanel)
    start: powers => { chosen = true; return begin(powers); }, // a new run; returns Lantern's state for the run
    step, // one tick; returns the tick's events
    react, // Spark's own sound and look for an event, after the page's
    reach: () => e ? reach(e) : 0, // 0 to 1, how far to dawn tonight
    night: () => night, // the night being played or chosen
    hello: () => t('sparkSay', { n: night }), // said as a run starts
    pauseLine: () => t('sparkPause', { n: night, pct: Math.floor(reach(e) * 100) }),
    end,
    draw, frame,
    screen(name, box) { // the page changed screens
      btn.style.display = name === 'play' && e ? 'block' : 'none';
      btn.setAttribute('aria-label', t('sparkAria'));
      if (name !== 'play') quiet();
      if (name === 'mode') card(box);
      if (name === 'menu') { chosen = false; e = null; }
    },
    state: () => ({ night, best: save.best, stars: save.stars, played: save.played, tin: e?.tin, used: e?.used, reach: e ? reach(e) : 0, rings: e?.rings.length, lit: e ? view(e).rocks.length : 0, flies: e?.flies.length, pulse: btn.classList.contains('pulse'), murmur: e ? murmur(e) : null }),
    game: () => e, // the browser check reads the river through this
  };
}
