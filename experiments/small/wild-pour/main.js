// Pour: the page. Drawing, input (finger, keys, and the phone's own tilt), sound, save, cards. Rules are in sim.js.
import { create, step, band, forecast, levelY, toWorld, jugAngle, jugSurface, pourShare, JUG, FLOOR, LEVELS, MAX_TILT, DT, SPOUT, R } from './sim.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { lab } from '../../kit/lab.js';
import { home } from '../../kit/home.js';
import { liquidSurface } from './liquid.js';
import { DAILY_KEY, dailyPour, validBest, dailyBest } from './daily.js';
import { t, apply, lang } from './words.js';

noZoom();
apply();
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- save: stars per level (0 to 3) and the sound switch. Key wild-pour:save, format v1.
const KEY = 'wild-pour:save';
const save = { v: 1, stars: Array(LEVELS).fill(0), sound: true, tries: 0 };
{
  const old = readJson(KEY, null);
  if (old && Array.isArray(old.stars)) for (let i = 0; i < LEVELS; i++) save.stars[i] = Math.max(0, Math.min(3, old.stars[i] | 0));
  if (old && typeof old.sound === 'boolean') save.sound = old.sound;
  if (old && Number.isFinite(old.tries)) save.tries = old.tries;
}
const store = () => writeJson(KEY, save);
let daily = null;
const bestLabel = best => best ? t('best', { off: best.off, spilled: best.spilled }) : t('bestNone');
function dailyLabel() { const d = dailyPour(); $('dailyBest').textContent = `${d.day} UTC · ${bestLabel(validBest(readJson(DAILY_KEY), d.day))}`; }
const unlocked = () => { let n = 1; while (n < LEVELS && save.stars[n - 1] > 0) n++; return n; };

// ---------- sound. The pour is a loop of noise through a narrow filter whose pitch is the air left in the glass:
// it rises as the glass fills, the way people judge a pour by ear. Built once in the kit's setup hook.
let pourNodes = null;
const snd = sound({
  on: () => save.sound,
  setup: ctx => {
    try {
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), v = ctx.createGain();
      src.buffer = buf; src.loop = true;
      f.type = 'bandpass'; f.Q.value = 9; f.frequency.value = 600;
      f2.type = 'lowpass'; f2.frequency.value = 5200;
      v.gain.value = 0;
      src.connect(f).connect(f2).connect(v).connect(ctx.destination); src.start();
      pourNodes = { f, v };
    } catch { pourNodes = null; }
  },
});
const tone = (f, d, v, type = 'sine', slide = 0) => { if (snd.ctx) snd.tone(f, d, v, type, slide); };
const noise = (d, v, hz) => { if (snd.ctx) snd.noise(d, v, hz); };
let lastDrip = 0, lastSplat = 0;
function pourSound() {
  if (!pourNodes || !snd.ctx) return;
  let vol = 0, hz = 600;
  if (save.sound && mode === 'play' && !paused && s) {
    // A filling glass rings higher as the air above the liquid shortens. The real rise from empty to this line is only
    // about four semitones, so the pitch climbs 1.6 octaves from empty to the line instead, and keeps climbing past it.
    const g = s.glass;
    hz = Math.min(5200, 380 * Math.pow(2, 1.6 * g.n / s.L.target));
    const falling = Math.min(1, s.flying / 6), share = s.flow / (s.liq.flow * s.L.pace);
    vol = (s.over ? 0 : 1) * Math.min(0.5, 0.05 + 0.4 * share) * falling * (s.L.liquid === 'honey' ? 0.6 : 1);
  }
  const at = snd.ctx.currentTime;
  try { pourNodes.v.gain.setTargetAtTime(vol, at, 0.05); pourNodes.f.frequency.setTargetAtTime(hz, at, 0.08); } catch {}
}

// ---------- layout: the world is 100 x 160 units; the jug's whole turn needs 8 more above y=0
const cv = $('c'), g = cv.getContext('2d', { alpha: false }), liquid = liquidSurface();
const REACH = Math.hypot(42, 43.4) + 1.5, ABOVE = Math.max(0, Math.ceil(REACH - SPOUT.y)), SPAN = 160 + ABOVE;
let W = 0, H = 0, dpr = 1, top = 0, bot = 0, k = 3, ox = 0, oy = 0;
let wallGradient, verticalTiles, horizontalTiles;
function layout() {
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const cs = getComputedStyle($('probe')); top = parseFloat(cs.paddingTop) || 0; bot = parseFloat(cs.paddingBottom) || 0;
  // Reserve the complete jug rotation envelope below the HUD.
  const availH = H - top - bot - 118;
  k = Math.min(W / 100, availH / SPAN); ox = (W - 100 * k) / 2; oy = top + 104 + ABOVE * k + (availH - SPAN * k) / 2;
  wallGradient = g.createLinearGradient(0, 0, 0, H);
  wallGradient.addColorStop(0, '#ffe8c9');
  wallGradient.addColorStop(1, '#f4c99a');
  verticalTiles = new Path2D();
  horizontalTiles = new Path2D();
  const tile = 12 * k, counter = oy + FLOOR * k;
  for (let x = ox % tile; x < W && tile > 0; x += tile) { verticalTiles.moveTo(x, 0); verticalTiles.lineTo(x, counter); }
  for (let y = counter % tile; y < counter && tile > 0; y += tile) { horizontalTiles.moveTo(0, y); horizontalTiles.lineTo(W, y); }
}
addEventListener('resize', layout); layout();

// ---------- game state
let mode = 'menu', paused = false, s = null, lvl = Math.min(unlocked(), Math.max(1, +query.get('level') || unlocked()));
let want = 0, finger = null, keyTilt = 0, keyDown = false, sensor = null, useSensor = false;
let shake = 0, fx = [], acc = 0, last = 0, endAt = 0, lineFlash = 0, overAt = 0, endShownAt = 0, bannerUntil = 0;
let waves = [];
const show = screens(['menu', 'paused', 'end'], name => {
  $('pause').style.display = name === 'play' ? 'grid' : 'none';
  $('tilt').style.display = name === 'play' && sensor !== null ? 'grid' : 'none';
});
// The forecast line (2026-11-26): a faint line where the glass is heading, counting the drops in the air. Three ways to
// offer it, for a pick: ?v=a (default) on levels 1 to 3 and the daily pour, and on any level after a lost pour there,
// until it is won; ?v=b always; ?v=c never (the page as it was).
const V = ['a', 'b', 'c'].includes(query.get('v')) ? query.get('v') : 'a';
const lostOn = new Set();
const forecastOn = () => V === 'b' || (V === 'a' && (lvl <= 3 || !!daily || lostOn.has(lvl)));
const COLORS = { juice: ['#ff8a3d', '#ffc078', '#e8692a'], honey: ['#e39a12', '#ffd36b', '#b86f05'], soda: ['#7a3b1c', '#c98b5e', '#55260f'] };

// Play recording for the game lab (kit/lab.js): one run for each pour, started by Play, Daily pour, Next or Again.
// Opened from the small games' home (?from=small): a way back on the menu and end cards.
const rec = home(lab('wild-pour', { lang }), { back: ['#menu .card', '#end .card'], lang });
let runOpen = false;
function runEnd(outcome) {
  if (!runOpen || !s) return;
  runOpen = false;
  rec.end(outcome, { level: lvl, daily: !!daily, why: s.why || null, stars: s.won ? s.stars : 0, inGlass: s.inGlass, target: s.L.target, spilled: s.spilled, seconds: Math.round(s.t * 10) / 10 });
}
function start(n, challenge = null) {
  runEnd('quit');
  daily = challenge;
  lvl = n; save.tries++; store();
  const seed = daily ? daily.seed : query.has('seed') ? +query.get('seed') : save.tries * 101 + n;
  s = create(n, seed); finger = null; keyDown = false; keyTilt = 0; want = 0; fx = []; shake = 0; acc = 0; endAt = 0; lineFlash = 0; overAt = 0; endShownAt = 0;
  waves = s.glasses.map(gl => ({ h: new Float32Array(16), v: new Float32Array(16), x: [gl.x, gl.x] }));
  mode = 'play'; paused = false; show('play'); snd.release(); heading = 'low'; told = false;
  runOpen = true; rec.start({ level: n, daily: !!daily, v: V, forecast: forecastOn() });
  banner(n === 1 && !daily ? t('tagline') : t('idea-' + s.L.idea));
  tone(520, 0.12, 0.08, 'triangle', 200);
}
function banner(text, ms = 2600) { $('banner').textContent = text; $('banner').classList.add('on'); bannerUntil = performance.now() + ms; }
function pause() { if (mode !== 'play' || paused) return; paused = true; finger = null; snd.hold(); show('paused'); }
function resume() { paused = false; snd.release(); show('play'); last = performance.now(); }
onLeave(pause);

// ---------- the phone's tilt: asked for only inside the Play tap. Touch always works.
function askSensor() {
  const D = window.DeviceOrientationEvent;
  if (!D || sensor !== null) return;
  const listen = () => addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    if (sensor === null) { sensor = 0; useSensor = true; $('tilt').classList.add('on'); if (mode === 'play') $('tilt').style.display = 'grid'; }
    sensor = e.gamma;
  });
  try {
    if (typeof D.requestPermission === 'function') D.requestPermission().then(r => { if (r === 'granted') listen(); }).catch(() => {});
    else listen();
  } catch {}
}
$('tilt').addEventListener('click', () => { useSensor = !useSensor; $('tilt').classList.toggle('on', useSensor); tone(useSensor ? 700 : 400, 0.08, 0.06); });

// ---------- finger: hold anywhere and slide right to tip the jug; let go and it stands up.
// After a lost pour, one tap anywhere pours again.
cv.addEventListener('pointerdown', e => {
  if (mode === 'play' && !paused && s?.over && !s.won) { e.preventDefault(); again(); return; }
  if (mode !== 'play' || paused) return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch {}
  finger = { id: e.pointerId, x0: e.clientX, base: Math.min(0.9, s ? s.angle : 0), x: e.clientX };
  tone(300, 0.05, 0.05, 'triangle');
});
cv.addEventListener('pointermove', e => { if (finger && e.pointerId === finger.id) finger.x = e.clientX; });
const up = e => { if (finger && e.pointerId === finger.id) finger = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (mode === 'play') paused ? resume() : pause(); return; }
  if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown') { keyDown = true; e.preventDefault(); }
});
addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown') keyDown = false; });

function target() {
  if (finger) { const span = Math.max(120, Math.min(W, 520) * 0.55); return Math.max(0, Math.min(MAX_TILT, finger.base + (finger.x - finger.x0) / span * MAX_TILT)); }
  if (keyDown) { keyTilt = Math.min(MAX_TILT, Math.max(keyTilt, 0.9) + 0.6 * DT); return keyTilt; }
  keyTilt = 0;
  if (useSensor && sensor !== null) return Math.max(0, Math.min(MAX_TILT, (sensor - 6) / 75 * MAX_TILT));
  return 0;
}

// ---------- loop
const frameSamples = [], workSamples = [];
function frame(now) {
  const began = performance.now(), measuring = query.has('perf') && mode === 'play' && !paused && !s?.over;
  requestAnimationFrame(frame);
  const elapsed = now - (last || now);
  const dt = Math.min(0.1, elapsed / 1000); last = now;
  if (mode === 'play' && !paused && s && !s.over) {
    want = target(); acc += dt;
    while (acc >= DT && !s.over) { step(s, want); acc -= DT; react(); }
    if (s.over) finish();
  } else if (mode === 'play' && !paused && s && s.over && endAt && now > endAt) { endAt = 0; showEnd(); }
  if (mode === 'play' && !paused && s) surfaces(dt);
  for (const p of fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; }
  fx = fx.filter(p => p.life > 0);
  shake *= Math.pow(0.02, dt); lineFlash = Math.max(0, lineFlash - dt);
  if (bannerUntil && now > bannerUntil) { bannerUntil = 0; $('banner').classList.remove('on'); }
  pourSound();
  draw(now / 1000);
  if (measuring && elapsed > 0) { frameSamples.push(elapsed); workSamples.push(performance.now() - began); if (frameSamples.length > 3600) { frameSamples.shift(); workSamples.shift(); } }
}
requestAnimationFrame(frame);

// Haptics where the phone has them (Android browsers; iOS Safari ignores it).
const buzz = pattern => { if (!calm && save.sound) try { navigator.vibrate?.(pattern); } catch {} };
let heading = 'low', told = false;
const SEEN_KEY = 'wild-pour:forecast-seen';
function react() {
  const now = performance.now();
  // The forecast's verdict changes: a soft tick when the pour is heading into the band, a double buzz when it is
  // heading over it (lift now). Only while the forecast line is shown.
  if (forecastOn() && !s.over) {
    const f = forecast(s), [lo, hi] = band(s), h = f > hi + 0.5 ? 'over' : f >= lo ? 'band' : 'low';
    // The first time the line shows on this device, and the first time it comes back after a lost pour, say what it is.
    if (!told && f > s.glass.n + 2) {
      told = true;
      const seen = readJson(SEEN_KEY, null) === 1;
      if (!seen || (lostOn.has(lvl) && lvl > 3)) { banner(t(seen ? 'forecastBack' : 'forecastHint'), 4500); writeJson(SEEN_KEY, 1); }
    }
    if (h !== heading) {
      if (h === 'band' && heading === 'low') buzz(12);
      if (h === 'over') { buzz([25, 50, 25]); tone(220, 0.12, 0.05, 'square', -40); }
      heading = h;
    }
  }
  for (const e of s.events) {
    if (e === 'drip' && now - lastDrip > 110) { lastDrip = now; ripple(); const f = 600 + s.inGlass / s.L.target * 700; tone(f, 0.05, 0.025, 'sine', 120); }
    if (e === 'line') { lineFlash = 1; buzz(20); [784, 988, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.25, 0.07, 'triangle'), i * 70)); }
    if (e === 'belt') tone(392, 0.2, 0.06, 'triangle', 200);
    if (e === 'spill' && now - lastSplat > 60) {
      lastSplat = now; noise(0.1, 0.12, 900); buzz(8); shake = Math.min(6, shake + 1.5);
      const q = s.p.find(q => q.st === 2 && !q.fx); if (q) { q.fx = 1; splash(q.x, FLOOR, COLORS[s.L.liquid][0], 6); }
    }
  }
}
// Where the stream meets the liquid in the glass, a few droplets jump: the landing point is the lowest drop in the air.
function ripple() {
  if (calm) return;
  let q = null; for (const p of s.p) if (p.air && p.st === 1 && (!q || p.y > q.y)) q = p;
  const gl = s.glass; if (!q || q.x < gl.x - gl.w || q.x > gl.x + gl.w) return;
  const y = levelY(s, gl.n, gl), c = COLORS[s.L.liquid];
  for (let i = 0; i < 2; i++) fx.push({ x: q.x + (Math.random() - 0.5) * 2, y, vx: (Math.random() - 0.5) * 30, vy: -25 - Math.random() * 30, life: 0.25 + Math.random() * 0.15, color: c[1], r: 0.5 + Math.random() * 0.4 });
}
function splash(x, y, color, n) { if (calm) return; for (let i = 0; i < n; i++) fx.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, life: 0.5 + Math.random() * 0.3, color, r: 0.8 + Math.random() }); }

// The surface in each glass: a 16-column wave that drops knock down and the glass's own movement sloshes; it settles
// level. Drawing only: the rules count drops, and the surface's mean height is exactly the count's.
function surfaces(dt) {
  if (!dt) return;
  const honey = s.L.liquid === 'honey', c2 = honey ? 0.08 : 0.3, damp = honey ? 0.16 : 0.035;
  s.glasses.forEach((gl, gi) => {
    const w = waves[gi]; if (!w) return;
    const N = w.h.length, ax = (gl.x - 2 * w.x[0] + w.x[1]) / (dt * dt); w.x[1] = w.x[0]; w.x[0] = gl.x;
    const surf = levelY(s, gl.n, gl);
    for (const q of s.p) {
      if (q.st !== 1 || q.hit || q.x <= gl.x - gl.w || q.x >= gl.x + gl.w || q.y < surf - 2.5 || q.y > surf + 3) continue;
      q.hit = 1;
      const i = Math.max(0, Math.min(N - 1, Math.floor((q.x - gl.x + gl.w) / (2 * gl.w) * N)));
      w.v[i] += Math.min(1.2, (q.y - q.py) * 0.6) * (honey ? 0.3 : 1);
    }
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < N; i++) {
        const l = w.h[i ? i - 1 : 0], r = w.h[i < N - 1 ? i + 1 : N - 1];
        w.v[i] = (w.v[i] + c2 * (l + r - 2 * w.h[i]) - (Number.isFinite(ax) ? ax : 0) * 0.00003 * (i - (N - 1) / 2) * (honey ? 0.3 : 1)) * (1 - damp);
      }
      let mean = 0;
      for (let i = 0; i < N; i++) { w.h[i] = Math.max(-3, Math.min(3, w.h[i] + w.v[i])); mean += w.h[i]; }
      mean /= N; for (let i = 0; i < N; i++) w.h[i] -= mean; // the wave moves liquid about; it never adds any
    }
  });
}

function finish() {
  if (daily) { const best = dailyBest(readJson(DAILY_KEY), daily.day, s); if (best) writeJson(DAILY_KEY, best); }
  finger = null; overAt = performance.now(); endAt = overAt + (s.won ? 900 : 350);
  rec.event(daily ? 'daily-finished' : 'level-finished', { level: lvl, won: s.won, stars: s.won ? s.stars : 0 });
  runEnd(s.won ? 'won' : 'lost');
  if (!daily) { if (s.won) lostOn.delete(lvl); else lostOn.add(lvl); }
  if (s.won) {
    if (!daily && s.stars > save.stars[lvl - 1]) save.stars[lvl - 1] = s.stars; store();
    buzz(s.stars === 3 ? [30, 40, 30, 40, 60] : 30);
    [523, 659, 784, 1047, 1319].slice(0, 2 + s.stars).forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.08, 'triangle'), i * 90));
    for (const g2 of s.glasses) for (let i = 0; i < 18; i++) fx.push({ x: g2.x + (Math.random() - 0.5) * g2.w * 2, y: g2.top, vx: (Math.random() - 0.5) * 90, vy: -80 - Math.random() * 90, life: 1.2, color: ['#ffd23f', '#ff8a3d', '#fff'][i % 3], r: 1.2, star: true });
  } else { tone(330, 0.25, 0.08, 'sawtooth', -150); shake = 6; buzz([60, 40, 60]); }
}
function offText(st) {
  const worst = st.glasses.reduce((a, gl) => Math.abs(gl.n - st.L.target) > Math.abs(a - st.L.target) ? gl.n : a, st.glasses[0].n);
  const off = worst - st.L.target;
  return off === 0 ? t('onLine') : off > 0 ? t('offOver', { n: off }) : t('offUnder', { n: -off });
}
function showEnd() {
  mode = 'end'; show('end'); endShownAt = performance.now();
  const title = s.won ? t('win' + s.stars) : t(s.why === 'over' ? 'over' : s.why === 'spill' ? 'spill' : 'under');
  $('endTitle').textContent = title;
  $('endStars').innerHTML = [1, 2, 3].map(i => `<span class="${s.won && s.stars >= i ? '' : 'off'}">★</span>`).join('');
  $('endLine').textContent = s.glasses.map(gl => `${gl.n} / ${s.L.target}`).join(' · ') + (daily ? ` · ${daily.day} UTC · ${bestLabel(validBest(readJson(DAILY_KEY), daily.day))}` : '');
  $('endSub').textContent = s.why === 'spill' ? t('spilled', { n: s.spilled }) : offText(s) + (s.won ? '' : ` · ${t('againTap')}`);
  $('next').style.display = !daily && s.won && lvl < LEVELS ? '' : 'none';
  $('retry').classList.toggle('main', !s.won || lvl === LEVELS);
}
function again() { start(lvl, daily); }

// ---------- drawing
const X = x => ox + x * k, Y = y => oy + y * k;
let preview, paintedState, paintedTime;
const loose = [];
function draw(time) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = wallGradient; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e9b98455'; g.lineWidth = 1;
  g.stroke(verticalTiles);
  g.stroke(horizontalTiles);
  const sx = shake && !calm ? (Math.random() - 0.5) * shake : 0, sy = shake && !calm ? (Math.random() - 0.5) * shake : 0;
  g.translate(sx, sy);
  // counter
  g.fillStyle = '#b8794a'; g.fillRect(-10, Y(FLOOR), W + 20, H);
  g.fillStyle = '#d6955f'; g.fillRect(-10, Y(FLOOR), W + 20, 5 * k);
  g.fillStyle = '#00000018'; g.fillRect(-10, Y(FLOOR) + 5 * k, W + 20, 2 * k);
  if (!s && preview?.L.n !== lvl) preview = create(lvl, 1);
  const st = s || preview, col = COLORS[st.L.liquid];
  if (st.glasses.length > 1) drawBelt(st);
  st.glasses.forEach((gl, i) => drawGlassBack(st, gl, time));
  st.glasses.forEach((gl, i) => drawLiquidIn(st, gl, waves[i], col, time));
  drawDrops(st, col);
  drawStream(st, col);
  st.glasses.forEach(gl => drawGlassFront(st, gl, time));
  drawJug(st, col);
  for (const p of fx) { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.color; g.beginPath(); g.arc(X(p.x), Y(p.y), p.r * k, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if (mode === 'play' || mode === 'end') hud(st);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function drawBelt(st) {
  const y = Y(FLOOR) - 0.2 * k, x0 = X(st.glasses[0].x0 - st.glasses[0].w - 6), x1 = X(st.glasses.at(-1).x0 + st.glasses[0].w + 6);
  g.fillStyle = '#3b2a3f'; g.fillRect(x0, y - 2 * k, x1 - x0, 2.4 * k);
  g.strokeStyle = '#8c7a8f'; g.lineWidth = Math.max(1, 0.4 * k);
  g.beginPath();
  for (let x = x0 - ((st.belt * k) % (4 * k)) + 4 * k; x < x1; x += 4 * k) { g.moveTo(x, y - 1.8 * k); g.lineTo(x - 1.2 * k, y); }
  g.stroke();
}
function edges(gl) { return { l: X(gl.x - gl.w - 1.2), r: X(gl.x + gl.w + 1.2), il: X(gl.x - gl.w), ir: X(gl.x + gl.w), tp: Y(gl.top), bt: Y(gl.bottom + 1.2) }; }
function drawGlassBack(st, gl) {
  const { l, r, tp, bt } = edges(gl);
  g.fillStyle = '#00000022'; g.beginPath(); g.ellipse((l + r) / 2, Y(FLOOR) + 1.5 * k, (r - l) / 2 + 3 * k, 2 * k, 0, 0, 7); g.fill();
  g.fillStyle = '#ffffff40'; g.fillRect(l, tp, r - l, bt - tp);
  // the band: a soft wash behind the liquid
  const [lo, hi] = band(st), yl = Y(levelY(st, lo, gl)), yh = Y(levelY(st, hi, gl));
  const inBand = gl.n >= lo && gl.n <= hi;
  g.fillStyle = inBand ? '#7cc24255' : '#ffffff66'; g.fillRect(l, yh, r - l, yl - yh);
}
// The liquid in a glass: a body up to the counted level, its wave on top, a meniscus that climbs each wall, foam for soda.
function drawLiquidIn(st, gl, w, col, time) {
  if (gl.n <= 0 && !gl.foam) return;
  const { il, ir } = edges(gl), base = levelY(st, gl.n, gl), N = w ? w.h.length : 16;
  const men = st.L.liquid === 'honey' ? 0.5 : 1.2, reach = 2.4;
  const pts = [];
  const surfaceAt = (x, i) => {
    const dWall = Math.min(x - (gl.x - gl.w), gl.x + gl.w - x), m = dWall < reach ? men * (1 - dWall / reach) ** 2 : 0;
    return base + (w ? w.h[i] : 0) - m;
  };
  pts.push([gl.x - gl.w, surfaceAt(gl.x - gl.w, 0)]);
  for (let i = 0; i < N; i++) { const x = gl.x - gl.w + (i + 0.5) / N * 2 * gl.w; pts.push([x, surfaceAt(x, i)]); }
  pts.push([gl.x + gl.w, surfaceAt(gl.x + gl.w, N - 1)]);
  if (gl.n > 0) {
    const grad = g.createLinearGradient(0, Y(base), 0, Y(gl.bottom));
    grad.addColorStop(0, col[0]); grad.addColorStop(1, col[2]);
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(il, Y(gl.bottom));
    for (const [x, y] of pts) g.lineTo(X(x), Y(Math.min(gl.bottom, y)));
    g.lineTo(ir, Y(gl.bottom)); g.closePath(); g.fill();
    g.strokeStyle = col[1]; g.lineWidth = Math.max(1.5, 0.7 * k); g.lineJoin = 'round';
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(Math.min(gl.bottom, y))) : g.moveTo(X(x), Y(Math.min(gl.bottom, y)))); g.stroke();
    if (st.L.liquid === 'soda' && !calm) { // bubbles rising through the soda
      g.fillStyle = '#ffffff66';
      for (let i = 0; i < 9; i++) {
        const fx2 = (i * 0.618) % 1, rise = (time * (0.4 + fx2 * 0.5) + i * 0.37) % 1, y = gl.bottom - rise * (gl.bottom - base);
        g.beginPath(); g.arc(X(gl.x - gl.w + 1.5 + fx2 * (2 * gl.w - 3)), Y(y), 0.45 * k, 0, 7); g.fill();
      }
    }
  }
  if (gl.foam > 0.05) {
    const f = gl.foam;
    g.fillStyle = '#fff3dcee';
    g.beginPath(); g.moveTo(il, Y(base + 0.3));
    for (let i = 0; i <= 12; i++) { const x = gl.x - gl.w + i / 12 * 2 * gl.w, bump = (i % 2 ? 0.5 : 0) * Math.min(1, f / 3); g.lineTo(X(x), Y(base - f - bump)); }
    g.lineTo(ir, Y(base + 0.3)); g.closePath(); g.fill();
    g.fillStyle = '#ffffffcc';
    for (let i = 0; i < 10; i++) { const x = gl.x - gl.w + 1 + ((i * 0.381) % 1) * (2 * gl.w - 2), y = base - f * ((i * 0.618) % 1); g.beginPath(); g.arc(X(x), Y(y), 0.5 * k, 0, 7); g.fill(); }
  }
}
// Drops that are not part of a body of liquid (splashes, drops on the counter) go through the merging field.
function drawDrops(st, col) {
  if (paintedState !== st || paintedTime !== st.t) {
    loose.length = 0;
    for (const q of st.p) {
      if (q.air) continue;
      let hidden = false;
      for (const gl of st.glasses) if (q.st === 1 && q.x > gl.x - gl.w && q.x < gl.x + gl.w && q.y > levelY(st, gl.n, gl) - 2.2) { hidden = true; break; }
      if (!hidden) loose.push(q);
    }
    liquid.draw(loose, col[0], col[1]);
    paintedState = st; paintedTime = st.t;
  }
  const { canvas, x0, y0, scale, bounds: { x, y, w, h } } = liquid;
  if (loose.length && w && h) g.drawImage(canvas, x, y, w, h, X(x0 + x / scale), Y(y0 + y / scale), w * k / scale, h * k / scale);
}
// The stream: one ribbon from the spout through every drop still falling, joining drops that left within 0.3 s of each
// other (they are on the same arc). A trickle is thin, a full pour thick, and the ribbon thins as it falls.
function drawStream(st, col) {
  const share = Math.min(1, st.flow / (st.liq.flow * st.L.pace)), thick = st.L.liquid === 'honey' ? 1.4 : 1;
  let prev = st.flow > 0.3 && st.inJug > 0 ? { x: SPOUT.x + 0.8, y: SPOUT.y + 0.6, e: st.t } : null;
  // drops that left the spout close together in time are one stream; a slow pour (honey) stays a thin thread
  const join = st.flow > 0 ? Math.min(thick > 1 ? 1.4 : 0.6, Math.max(0.3, 2.2 / st.flow)) : 0.3;
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col[0]; g.fillStyle = col[0];
  for (let i = st.p.length - 1; i >= 0; i--) {
    const q = st.p[i]; if (!q.air) continue;
    const fall = Math.max(0, Math.min(1, (q.y - SPOUT.y) / 70)), width = Math.max(2.5, 2 * R * k * thick * (0.3 + 0.5 * share) * (1 - 0.3 * fall));
    if (prev && prev.e - q.e < join) {
      g.lineWidth = width;
      g.beginPath(); g.moveTo(X(prev.x), Y(prev.y)); g.lineTo(X(q.x), Y(q.y)); g.stroke();
    } else { g.beginPath(); g.arc(X(q.x), Y(q.y), Math.max(width / 2, R * k * 0.6), 0, 7); g.fill(); }
    prev = q;
  }
}
function drawGlassFront(st, gl, time) {
  const { l, r, tp, bt } = edges(gl);
  const [lo, hi] = band(st), ym = Y(levelY(st, st.L.target, gl));
  const inBand = gl.n >= lo && gl.n <= hi, near = Math.max(0, 1 - Math.abs(gl.n - st.L.target) / (st.L.band * 1.5));
  if (s && mode === 'play' && forecastOn()) drawForecast(st, gl, lo, hi);
  g.strokeStyle = inBand ? '#3e8f1c' : '#3b2a3f'; g.lineWidth = Math.max(3, 1.1 * k) * (1 + 0.4 * near); g.lineCap = 'round';
  g.beginPath(); g.moveTo(l - 3 * k, ym); g.lineTo(r + 3 * k, ym); g.stroke();
  const bob = calm ? 0 : Math.sin(time * 5) * 0.8 * k;
  g.fillStyle = g.strokeStyle;
  // arrows only on the glass being filled
  if (gl === st.glass) for (const [x, dir] of [[l - 4 * k, 1], [r + 4 * k, -1]]) { g.beginPath(); g.moveTo(x - dir * bob, ym); g.lineTo(x - dir * (3.5 * k + bob), ym - 2.4 * k); g.lineTo(x - dir * (3.5 * k + bob), ym + 2.4 * k); g.fill(); }
  if (lineFlash > 0) { g.fillStyle = `rgba(255,255,255,${lineFlash * 0.5})`; g.fillRect(l, ym - 3 * k, r - l, 6 * k); }
  g.strokeStyle = '#3b2a3f'; g.lineWidth = Math.max(2.5, 1.1 * k); g.lineJoin = 'round';
  g.beginPath(); g.moveTo(l, tp); g.lineTo(l, bt); g.lineTo(r, bt); g.lineTo(r, tp); g.stroke();
  g.strokeStyle = '#ffffffb0'; g.lineWidth = Math.max(1.5, 0.7 * k);
  g.beginPath(); g.moveTo(l + 2 * k, tp + 4 * k); g.lineTo(l + 2 * k, bt - 6 * k); g.stroke();
}
// Where the glass is heading: a dashed line over the liquid, green while it would settle in the band, red once it
// would settle over it. Hidden when nothing more is coming.
function drawForecast(st, gl, lo, hi) {
  const f = forecast(st, gl);
  if (f < gl.n + 0.6) return;
  const { il, ir } = edges(gl), y = Y(Math.max(gl.top + 1, levelY(st, f, gl))), y0 = Y(levelY(st, gl.n, gl));
  const c = f > hi + 0.5 ? '#c8452f' : f >= lo ? '#3e8f1c' : '#3b2a3f';
  g.fillStyle = c + '22'; g.fillRect(il, y, ir - il, Math.max(0, y0 - y));
  g.strokeStyle = c; g.globalAlpha = 0.85; g.lineWidth = Math.max(2, 0.7 * k); g.setLineDash([2.2 * k, 1.6 * k]);
  g.beginPath(); g.moveTo(il, y); g.lineTo(ir, y); g.stroke();
  g.setLineDash([]); g.globalAlpha = 1;
}
function drawJug(st, col) {
  const a = jugAngle(st), p = toWorld(st, JUG.w, 0, a);
  // what is left in the jug, level whatever the tilt
  if (st.inJug > 0) {
    const ys = jugSurface(st, a), corners = [[-JUG.w, 0], [JUG.w, 0], [JUG.w, JUG.d], [-JUG.w, JUG.d]].map(([x, y]) => toWorld(st, x, y, a));
    const poly = [];
    for (let i = 0; i < 4; i++) {
      const u = corners[i], v = corners[(i + 1) % 4], uin = u.y >= ys, vin = v.y >= ys;
      if (uin) poly.push(u);
      if (uin !== vin) { const f = (ys - u.y) / (v.y - u.y); poly.push({ x: u.x + (v.x - u.x) * f, y: ys }); }
    }
    if (poly.length > 2) {
      g.fillStyle = col[0]; g.beginPath(); poly.forEach((q, i) => i ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y))); g.closePath(); g.fill();
      const flat = poly.filter(q => Math.abs(q.y - ys) < 1e-6);
      if (flat.length === 2) { g.strokeStyle = col[1]; g.lineWidth = Math.max(1.5, 0.6 * k); g.beginPath(); g.moveTo(X(flat[0].x), Y(ys)); g.lineTo(X(flat[1].x), Y(ys)); g.stroke(); }
    }
  }
  g.save(); g.translate(X(p.x), Y(p.y)); g.rotate(a); g.scale(k, k);
  const w = JUG.w, d = JUG.d, th = 1.4;
  g.lineWidth = 2.6; g.strokeStyle = '#3b2a3f'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-2 * w - th, 6); g.bezierCurveTo(-2 * w - 12, 6, -2 * w - 12, d - 10, -2 * w - th, d - 8); g.stroke();
  g.lineWidth = 1.4; g.strokeStyle = '#2aa59a';
  g.beginPath(); g.moveTo(-2 * w - th, 6); g.bezierCurveTo(-2 * w - 12, 6, -2 * w - 12, d - 10, -2 * w - th, d - 8); g.stroke();
  g.fillStyle = '#ffffff40'; g.strokeStyle = '#3b2a3f'; g.lineWidth = 1.2; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-2 * w - th, -0.5); g.lineTo(-2 * w - th, d + th); g.lineTo(th, d + th); g.lineTo(th, 0); g.lineTo(2.8, -2.2); g.lineTo(0, -0.6); g.lineTo(0, d); g.lineTo(-2 * w, d); g.lineTo(-2 * w, -0.5); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#2aa59a'; g.fillRect(-2 * w - th, -1.6, 2 * w + th + 0.2, 2.4);
  g.strokeRect(-2 * w - th, -1.6, 2 * w + th + 0.2, 2.4);
  g.strokeStyle = '#ffffffb0'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-2 * w + 2, 4); g.lineTo(-2 * w + 2, d - 4); g.stroke();
  g.restore();
}
function hud(st) {
  const y = top + 26, gap = 22, x0 = W / 2 - (LEVELS - 1) * gap / 2;
  for (let i = 0; i < LEVELS; i++) {
    g.beginPath(); g.arc(x0 + i * gap, y, i === st.L.n - 1 ? 8 : 5, 0, 7);
    g.fillStyle = i < st.L.n - 1 || save.stars[i] ? '#ff8a3d' : i === st.L.n - 1 ? '#fff6ea' : '#e6d0b5'; g.fill();
    g.lineWidth = 2; g.strokeStyle = '#3b2a3f'; g.stroke();
  }
  // A draining clock ring and seconds: the deadline, without words.
  const remaining = Math.max(0, st.L.time - st.t), cx = W / 2, cyClock = top + 74;
  g.lineWidth = 4; g.strokeStyle = '#e6d0b5';
  g.beginPath(); g.arc(cx, cyClock, 20, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = remaining <= 5 ? '#c43745' : '#3b2a3f';
  g.beginPath(); g.arc(cx, cyClock, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining / st.L.time); g.stroke();
  g.fillStyle = '#3b2a3f'; g.font = 'bold 17px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(Math.ceil(remaining)), cx, cyClock);
  // spill allowance: drops left before a splash ends it, along the counter
  const left = Math.max(0, st.L.spill - st.spilled);
  const cy = Y(FLOOR) + Math.max(9, Math.min(14 * k, (H - Y(FLOOR)) * 0.5));
  const n = st.L.spill, gap2 = Math.min(16, (W - 40) / n), sx = W / 2 - (n - 1) * gap2 / 2;
  for (const [from, to, color] of [[0, left, '#fff6ea'], [left, n, '#7a4a2a']]) {
    if (from === to) continue;
    g.fillStyle = color;
    g.beginPath();
    for (let i = from; i < to; i++) {
      const x = sx + i * gap2;
      g.moveTo(x, cy - 7);
      g.quadraticCurveTo(x + 5, cy, x, cy + 4);
      g.quadraticCurveTo(x - 5, cy, x, cy - 7);
    }
    g.fill();
  }
}

// ---------- cards
function levelsCard() {
  dailyLabel();
  const u = unlocked(), box = $('levels'); box.innerHTML = '';
  for (let i = 1; i <= LEVELS; i++) {
    const b = document.createElement('button'); b.className = 'small' + (i === lvl ? ' cur' : '');
    b.innerHTML = `${i}<small>${'★'.repeat(save.stars[i - 1])}</small>`; b.disabled = i > u;
    b.setAttribute('aria-label', t('level', { n: i }));
    b.addEventListener('click', () => { lvl = i; levelsCard(); tone(500 + i * 40, 0.06, 0.06); });
    box.appendChild(b);
  }
}
function soundLabel() { for (const id of ['sound1', 'sound2']) $(id).textContent = save.sound ? t('soundOn') : t('soundOff'); }
for (const id of ['sound1', 'sound2']) $(id).addEventListener('click', () => { save.sound = !save.sound; store(); soundLabel(); if (save.sound) { snd.unlock(); tone(660, 0.1, 0.07); } });
$('play').addEventListener('click', () => { snd.unlock(); askSensor(); start(lvl); });
$('daily').addEventListener('click', () => { snd.unlock(); askSensor(); const d = dailyPour(); start(d.level, d); });
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', () => { runEnd('quit'); paused = false; snd.release(); mode = 'menu'; s = null; levelsCard(); show('menu'); });
$('next').addEventListener('click', () => start(Math.min(LEVELS, lvl + 1)));
$('retry').addEventListener('click', again);
// A tap on the dimmed screen around a lost pour's card pours again.
$('end').addEventListener('click', e => { if (e.target === $('end') && s && !s.won) again(); });
$('toMenu').addEventListener('click', () => { mode = 'menu'; s = null; levelsCard(); show('menu'); });
// The recording notice is on the menu card, which the player sees before Play; its switch is on the pause card.
rec.notice($('menu').firstElementChild);
rec.toggle($('paused').firstElementChild);
levelsCard(); soundLabel();
// Refresh a menu left open across UTC midnight; an in-progress run keeps its date.
setInterval(() => { if (mode === 'menu') dailyLabel(); }, 60000);

hint(cv, { kind: 'drag', key: 'wild-pour:hint', when: () => mode === 'play' && !paused && !!s && !s.over, played: save.tries > 0, bottom: () => Math.max(120, H - Y(100)) }); // in the gap between the jug and the glass, clear of the line

// ---------- for the phone check
window.pourState = (details = true) => {
  const view = {
    screen: mode === 'play' && paused ? 'paused' : mode, level: lvl, playing: mode === 'play' && !paused, paused,
    over: !!s?.over, won: !!s?.won, why: s?.why ?? '', stars: s?.stars ?? 0, inGlass: s?.inGlass ?? 0, spilled: s?.spilled ?? 0,
    inJug: s?.inJug ?? 0, flying: s?.flying ?? 0, angle: s?.angle ?? 0, t: s?.t ?? 0, target: s?.L.target ?? 0, saved: save.stars.slice(),
    sensor: sensor !== null, seed: s?.seed, liquid: s?.L.liquid, idea: s?.L.idea, flow: s?.flow ?? 0, glasses: s ? s.glasses.map(gl => gl.n) : [],
    foam: s ? Math.max(...s.glasses.map(gl => gl.foam)) : 0, band: s?.L.band ?? 0, v: V, forecast: s && forecastOn() ? forecast(s) : null,
    remaining: s ? Math.max(0, s.L.time - s.t) : 30, overAt, endShownAt,
    jugClearance: Y(SPOUT.y - REACH) - (top + 96),
    jug: s ? { x: X(s.pivot.x), y: Y(s.pivot.y) } : null, W, H,
  };
  // The synthetic thumb reads this each frame. Layout and storage reads are only for assertions.
  if (details) {
    const buttons = [...document.querySelectorAll('button')].filter(button => button.offsetParent !== null);
    view.minTouchPx = Math.min(...buttons.map(button => {
      const { width, height } = button.getBoundingClientRect();
      return Math.min(width, height);
    }));
    view.daily = daily ? { ...daily, best: validBest(readJson(DAILY_KEY), daily.day) } : null;
  }
  return view;
};
window.pourPerf = () => ({ intervals: frameSamples.slice(), work: workSamples.slice() });
