// Pour: the page. Drawing, input (finger, keys, and the phone's own tilt), sound, save, cards. Rules are in sim.js.
import { create, step, band, levelY, toWorld, JUG, FLOOR, LEVELS, MAX_TILT, DT } from './sim.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { liquidSurface } from './liquid.js';
import { DAILY_KEY, dailyPour, validBest, dailyBest } from './daily.js';

noZoom();
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
const bestLabel = best => best ? `Best on this device: ${best.off} from the line · ${best.spilled} spilled` : 'Best on this device: —';
function dailyLabel() { const d = dailyPour(); $('dailyBest').textContent = `${d.day} UTC · ${bestLabel(validBest(readJson(DAILY_KEY), d.day))}`; }
const unlocked = () => { let n = 1; while (n < LEVELS && save.stars[n - 1] > 0) n++; return n; };

// ---------- sound
const snd = sound({ on: () => save.sound });
const tone = (f, d, v, type = 'sine', slide = 0) => { if (snd.ctx) snd.tone(f, d, v, type, slide); };
const noise = (d, v, hz) => { if (snd.ctx) snd.noise(d, v, hz); };
let lastGlug = 0, lastDrip = 0, lastSplat = 0;

// ---------- layout: the world is 100 x 160 units
const cv = $('c'), g = cv.getContext('2d'), liquid = liquidSurface();
let W = 0, H = 0, dpr = 1, top = 0, bot = 0, k = 3, ox = 0, oy = 0;
function layout() {
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const cs = getComputedStyle($('probe')); top = parseFloat(cs.paddingTop) || 0; bot = parseFloat(cs.paddingBottom) || 0;
  // Reserve the complete jug rotation envelope above world y=0, below the HUD.
  const availH = H - top - bot - 118;
  k = Math.min(W / 100, availH / 194); ox = (W - 100 * k) / 2; oy = top + 104 + 34 * k + (availH - 194 * k) / 2;
}
addEventListener('resize', layout); layout();

// ---------- game state
let mode = 'menu', paused = false, s = null, lvl = Math.min(unlocked(), Math.max(1, +query.get('level') || unlocked()));
let want = 0, finger = null, keyTilt = 0, keyDown = false, sensor = null, useSensor = false;
let shake = 0, fx = [], acc = 0, last = 0, endAt = 0, lineFlash = 0, everTouched = false;
const show = screens(['menu', 'paused', 'end'], name => {
  $('pause').style.display = name === 'play' ? 'grid' : 'none';
  $('tilt').style.display = name === 'play' && sensor !== null ? 'grid' : 'none';
});
const PALETTE = [['#ff8a3d', '#ffc078'], ['#e8436a', '#ff9db3'], ['#7cc242', '#c3ec8e'], ['#8a5cf0', '#c9b2ff'], ['#ffb400', '#ffe38a'], ['#e8436a', '#ff9db3'], ['#25a7d6', '#9be3ff'], ['#ff8a3d', '#ffc078']];

function start(n, challenge = null) {
  daily = challenge;
  lvl = n; save.tries++; store();
  const seed = daily ? daily.seed : query.has('seed') ? +query.get('seed') : save.tries * 101 + n;
  s = create(n, seed); finger = null; keyDown = false; keyTilt = 0; want = 0; fx = []; shake = 0; acc = 0; endAt = 0; lineFlash = 0;
  mode = 'play'; paused = false; show('play'); snd.release();
  tone(520, 0.12, 0.08, 'triangle', 200);
}
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

// ---------- finger: hold anywhere and slide right to tip the jug; let go and it stands up
cv.addEventListener('pointerdown', e => {
  if (mode !== 'play' || paused) return;
  e.preventDefault(); everTouched = true;
  try { cv.setPointerCapture(e.pointerId); } catch {}
  finger = { id: e.pointerId, x0: e.clientX, base: Math.min(0.9, s ? s.angle : 0), x: e.clientX };
  tone(300, 0.05, 0.05, 'triangle');
});
cv.addEventListener('pointermove', e => { if (finger && e.pointerId === finger.id) finger.x = e.clientX; });
const up = e => { if (finger && e.pointerId === finger.id) finger = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (mode === 'play') paused ? resume() : pause(); return; }
  if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown') { keyDown = true; everTouched = true; e.preventDefault(); }
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
  for (const p of fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; }
  fx = fx.filter(p => p.life > 0);
  shake *= Math.pow(0.02, dt); lineFlash = Math.max(0, lineFlash - dt);
  draw(now / 1000);
  if (measuring && elapsed > 0) { frameSamples.push(elapsed); workSamples.push(performance.now() - began); if (frameSamples.length > 3600) { frameSamples.shift(); workSamples.shift(); } }
}
requestAnimationFrame(frame);

function react() {
  const t = performance.now();
  for (const e of s.events) {
    if (e === 'out' && t - lastGlug > 70) { lastGlug = t; tone(170 + Math.random() * 90, 0.09, 0.07, 'triangle', -60); }
    if (e === 'drip' && t - lastDrip > 55) { lastDrip = t; const f = 600 + s.inGlass / s.L.target * 700; tone(f, 0.06, 0.05, 'sine', 120); }
    if (e === 'line') { lineFlash = 1; [784, 988, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.25, 0.07, 'triangle'), i * 70)); }
    if (e === 'spill' && t - lastSplat > 60) {
      lastSplat = t; noise(0.1, 0.12, 900); shake = Math.min(6, shake + 1.5);
      const q = s.p.find(q => q.st === 2 && !q.fx); if (q) { q.fx = 1; splash(q.x, FLOOR, PALETTE[lvl - 1][0], 6); }
    }
  }
}
function splash(x, y, color, n) { if (calm) return; for (let i = 0; i < n; i++) fx.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, life: 0.5 + Math.random() * 0.3, color, r: 0.8 + Math.random() }); }

function finish() {
  if (daily) { const best = dailyBest(readJson(DAILY_KEY), daily.day, s); if (best) writeJson(DAILY_KEY, best); }
  finger = null; endAt = performance.now() + (s.won ? 900 : 1100);
  if (s.won) {
    if (!daily && s.stars > save.stars[lvl - 1]) save.stars[lvl - 1] = s.stars; store();
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.08, 'triangle'), i * 90));
    const g2 = s.glass; for (let i = 0; i < 26; i++) fx.push({ x: g2.x + (Math.random() - 0.5) * g2.w * 2, y: g2.top, vx: (Math.random() - 0.5) * 90, vy: -80 - Math.random() * 90, life: 1.2, color: ['#ffd23f', '#ff8a3d', '#fff'][i % 3], r: 1.2, star: true });
  } else { tone(330, 0.3, 0.09, 'sawtooth', -150); setTimeout(() => tone(220, 0.4, 0.08, 'sawtooth', -100), 180); shake = 8; }
}
function showEnd() {
  mode = 'end'; show('end');
  const title = s.won ? ['Okay!', 'Nice!', 'Just right!'][s.stars - 1] : s.why === 'over' ? 'Too much!' : s.why === 'spill' ? 'Splash!' : 'Too little!';
  $('endTitle').textContent = title;
  $('endStars').innerHTML = [1, 2, 3].map(i => `<span class="${s.won && s.stars >= i ? '' : 'off'}">★</span>`).join('');
  $('endLine').textContent = `${s.inGlass} / ${s.L.target}` + (daily ? ` · ${daily.day} UTC · ${bestLabel(validBest(readJson(DAILY_KEY), daily.day))}` : '');
  $('next').style.display = !daily && s.won && lvl < LEVELS ? '' : 'none';
  $('retry').classList.toggle('main', !s.won || lvl === LEVELS);
}

// ---------- drawing
const X = x => ox + x * k, Y = y => oy + y * k;
function draw(t) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // kitchen wall and tiles
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#ffe8c9'); bg.addColorStop(1, '#f4c99a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e9b98455'; g.lineWidth = 1;
  const tile = 12 * k; for (let x = ox % tile; x < W; x += tile) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Y(FLOOR)); g.stroke(); }
  for (let y = Y(FLOOR) % tile; y < Y(FLOOR); y += tile) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const sx = shake && !calm ? (Math.random() - 0.5) * shake : 0, sy = shake && !calm ? (Math.random() - 0.5) * shake : 0;
  g.translate(sx, sy);
  // counter
  g.fillStyle = '#b8794a'; g.fillRect(-10, Y(FLOOR), W + 20, H);
  g.fillStyle = '#d6955f'; g.fillRect(-10, Y(FLOOR), W + 20, 5 * k);
  g.fillStyle = '#00000018'; g.fillRect(-10, Y(FLOOR) + 5 * k, W + 20, 2 * k);
  const st = s || create(lvl, 1);
  const [juice, light] = PALETTE[st.L.n - 1];
  drawGlass(st, juice, light, t);
  drawJuice(st, juice, light);
  drawJug(st, t);
  for (const p of fx) { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.color; g.beginPath(); g.arc(X(p.x), Y(p.y), p.r * k, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if (mode === 'play' || mode === 'end') hud(st, juice);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function drawJuice(st, juice, light) {
  liquid.draw(st.p, juice, light);
  g.drawImage(liquid.canvas, X(liquid.x0), Y(liquid.y0), liquid.width * k, liquid.height * k);
}
function drawGlass(st, juice, light, t) {
  const gl = st.glass, l = X(gl.x - gl.w - 1.2), r = X(gl.x + gl.w + 1.2), tp = Y(gl.top), bt = Y(gl.bottom + 1.2);
  // shadow
  g.fillStyle = '#00000022'; g.beginPath(); g.ellipse((l + r) / 2, Y(FLOOR) + 1.5 * k, (r - l) / 2 + 3 * k, 2 * k, 0, 0, 7); g.fill();
  // band and line
  const [lo, hi] = band(st), yl = Y(levelY(st, lo)), yh = Y(levelY(st, hi)), ym = Y(levelY(st, st.L.target));
  const inBand = st.inGlass >= lo && st.inGlass <= hi;
  g.fillStyle = inBand ? '#7cc24266' : '#ffffff88'; g.fillRect(l, yh, r - l, yl - yh);
  g.strokeStyle = inBand ? '#3e8f1c' : '#3b2a3f'; g.lineWidth = Math.max(3, 1.1 * k); g.lineCap = 'round';
  g.beginPath(); g.moveTo(l - 3 * k, ym); g.lineTo(r + 3 * k, ym); g.stroke();
  // little arrows pointing at the line from both sides, bobbing
  const bob = calm ? 0 : Math.sin(t * 5) * 0.8 * k;
  g.fillStyle = g.strokeStyle;
  for (const [x, dir] of [[l - 4 * k, 1], [r + 4 * k, -1]]) { g.beginPath(); g.moveTo(x - dir * bob, ym); g.lineTo(x - dir * (3.5 * k + bob), ym - 2.4 * k); g.lineTo(x - dir * (3.5 * k + bob), ym + 2.4 * k); g.fill(); }
  if (lineFlash > 0) { g.fillStyle = `rgba(255,255,255,${lineFlash * 0.6})`; g.fillRect(l, yh - 2 * k, r - l, yl - yh + 4 * k); }
  // glass body
  g.strokeStyle = '#3b2a3f'; g.lineWidth = Math.max(2.5, 1.1 * k); g.lineJoin = 'round';
  g.fillStyle = '#ffffff40';
  g.beginPath(); g.moveTo(l, tp); g.lineTo(l, bt); g.lineTo(r, bt); g.lineTo(r, tp); g.fill(); g.stroke();
  g.strokeStyle = '#ffffffb0'; g.lineWidth = Math.max(1.5, 0.7 * k);
  g.beginPath(); g.moveTo(l + 2 * k, tp + 4 * k); g.lineTo(l + 2 * k, bt - 6 * k); g.stroke();
}
function drawJug(st, t) {
  const c = Math.cos(st.angle), n = Math.sin(st.angle), p = toWorld(st, JUG.w, 0);
  g.save(); g.translate(X(p.x), Y(p.y)); g.rotate(st.angle); g.scale(k, k);
  const w = JUG.w, d = JUG.d, th = 1.4;
  // handle
  g.lineWidth = 2.6; g.strokeStyle = '#3b2a3f'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-2 * w - th, 6); g.bezierCurveTo(-2 * w - 12, 6, -2 * w - 12, d - 10, -2 * w - th, d - 8); g.stroke();
  g.lineWidth = 1.4; g.strokeStyle = '#2aa59a';
  g.beginPath(); g.moveTo(-2 * w - th, 6); g.bezierCurveTo(-2 * w - 12, 6, -2 * w - 12, d - 10, -2 * w - th, d - 8); g.stroke();
  // body: a clear jug with a coloured rim
  g.fillStyle = '#ffffff55'; g.strokeStyle = '#3b2a3f'; g.lineWidth = 1.2; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-2 * w - th, -0.5); g.lineTo(-2 * w - th, d + th); g.lineTo(th, d + th); g.lineTo(th, 0); g.lineTo(2.8, -2.2); g.lineTo(0, -0.6); g.lineTo(0, d); g.lineTo(-2 * w, d); g.lineTo(-2 * w, -0.5); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#2aa59a'; g.fillRect(-2 * w - th, -1.6, 2 * w + th + 0.2, 2.4);
  g.strokeRect(-2 * w - th, -1.6, 2 * w + th + 0.2, 2.4);
  g.strokeStyle = '#ffffffb0'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-2 * w + 2, 4); g.lineTo(-2 * w + 2, d - 4); g.stroke();
  g.restore();
}
function hud(st, juice) {
  // level dots across the top
  const y = top + 26, gap = 22, x0 = W / 2 - (LEVELS - 1) * gap / 2;
  for (let i = 0; i < LEVELS; i++) {
    g.beginPath(); g.arc(x0 + i * gap, y, i === st.L.n - 1 ? 8 : 5, 0, 7);
    g.fillStyle = i < st.L.n - 1 || save.stars[i] ? '#ff8a3d' : i === st.L.n - 1 ? '#fff6ea' : '#e6d0b5'; g.fill();
    g.lineWidth = 2; g.strokeStyle = '#3b2a3f'; g.stroke();
  }
  // A draining clock ring and seconds: the 30-second deadline, without words.
  const remaining = Math.max(0, st.L.time - st.t), cx = W / 2, cyClock = top + 74;
  g.lineWidth = 4; g.strokeStyle = '#e6d0b5';
  g.beginPath(); g.arc(cx, cyClock, 20, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = remaining <= 5 ? '#c43745' : '#3b2a3f';
  g.beginPath(); g.arc(cx, cyClock, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining / st.L.time); g.stroke();
  g.fillStyle = '#3b2a3f'; g.font = 'bold 17px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(Math.ceil(remaining)), cx, cyClock);
  // spill allowance: drops left before a splash ends it, along the counter
  const left = Math.max(0, st.L.spill - st.spilled);
  const cy = Y(FLOOR) + Math.max(9, Math.min(14 * k, (H - Y(FLOOR)) * 0.5)); // on the counter's front, drawn even in the home-bar area
  {
    const n = st.L.spill, gap2 = Math.min(16, (W - 40) / n), sx = W / 2 - (n - 1) * gap2 / 2;
    for (let i = 0; i < n; i++) {
      const x = sx + i * gap2;
      g.fillStyle = i < left ? '#fff6ea' : '#7a4a2a'; g.beginPath(); g.moveTo(x, cy - 7); g.quadraticCurveTo(x + 5, cy, x, cy + 4); g.quadraticCurveTo(x - 5, cy, x, cy - 7); g.fill();
    }
  }
}

// ---------- cards
function levelsCard() {
  dailyLabel();
  const u = unlocked(), box = $('levels'); box.innerHTML = '';
  for (let i = 1; i <= LEVELS; i++) {
    const b = document.createElement('button'); b.className = 'small' + (i === lvl ? ' cur' : '');
    b.innerHTML = `${i}<small>${'★'.repeat(save.stars[i - 1])}</small>`; b.disabled = i > u;
    b.setAttribute('aria-label', `Level ${i}`);
    b.addEventListener('click', () => { lvl = i; levelsCard(); tone(500 + i * 40, 0.06, 0.06); });
    box.appendChild(b);
  }
}
function soundLabel() { for (const id of ['sound1', 'sound2']) $(id).textContent = `Sound: ${save.sound ? 'on' : 'off'}`; }
for (const id of ['sound1', 'sound2']) $(id).addEventListener('click', () => { save.sound = !save.sound; store(); soundLabel(); if (save.sound) { snd.unlock(); tone(660, 0.1, 0.07); } });
$('play').addEventListener('click', () => { snd.unlock(); askSensor(); start(lvl); });
$('daily').addEventListener('click', () => { snd.unlock(); askSensor(); const d = dailyPour(); start(d.level, d); });
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', () => { paused = false; snd.release(); mode = 'menu'; s = null; levelsCard(); show('menu'); });
$('next').addEventListener('click', () => start(Math.min(LEVELS, lvl + 1)));
$('retry').addEventListener('click', () => start(lvl, daily));
$('toMenu').addEventListener('click', () => { mode = 'menu'; s = null; levelsCard(); show('menu'); });
levelsCard(); soundLabel();
// Refresh a menu left open across UTC midnight; an in-progress run keeps its date.
setInterval(() => { if (mode === 'menu') dailyLabel(); }, 60000);

hint(cv, { kind: 'drag', key: 'wild-pour:hint', when: () => mode === 'play' && !paused && !!s && !s.over, played: save.tries > 0, bottom: () => Math.max(120, H - Y(90)) }); // in the gap between the jug and the glass, clear of the line

// ---------- for the phone check
window.pourState = () => {
  const btns = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null);
  return {
    screen: mode === 'play' && paused ? 'paused' : mode, level: lvl, playing: mode === 'play' && !paused, paused,
    over: !!s?.over, won: !!s?.won, why: s?.why ?? '', stars: s?.stars ?? 0, inGlass: s?.inGlass ?? 0, spilled: s?.spilled ?? 0,
    inJug: s?.inJug ?? 0, flying: s?.flying ?? 0, angle: s?.angle ?? 0, t: s?.t ?? 0, target: s?.L.target ?? 0, saved: save.stars.slice(),
    sensor: sensor !== null, minTouchPx: Math.min(...btns.map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))),
    daily: daily ? { ...daily, best: validBest(readJson(DAILY_KEY), daily.day) } : null, seed: s?.seed,
    remaining: s ? Math.max(0, s.L.time - s.t) : 30,
    jugClearance: Y(30 - Math.hypot(42, 43.4) - 1.5) - (top + 96),
    jug: s ? { x: X(s.pivot.x), y: Y(s.pivot.y) } : null, W, H,
  };
};

window.pourPerf = () => ({ intervals: frameSamples.slice(), work: workSamples.slice() });
