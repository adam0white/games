// Lantern: Spark, the page. Rules: ../../lantern/sim.js, unchanged; the spark layer: ./sim.js. This file draws, plays sound and reads input.
import { start, tick, view, stars, murmur, rating, reach, glow, centre, half, boat, NIGHTS, REFILL, TIN_MAX, RING_MAX, GLOW, DT } from './sim.js';
import { readJson, writeJson, read, write } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { drag } from '../../kit/drag.js';
import { hint } from '../../kit/hint.js';

noZoom();
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const gain = Number(query.get('gain')) || 1.3; // Lantern's own steering gain
const fixedSeed = query.has('seed') ? Number(query.get('seed')) | 0 : null;
const fast = Math.max(1, Math.min(8, Number(query.get('fast')) || 1)); // test only: ticks run this many times faster

// Save: { v: 1, best: highest night open, stars: { night: 0..3 }, played: runs }. Keys are this page's own.
const KEY = 'lantern-spark:save', SPARKED = 'lantern-spark:spark';
const loaded = readJson(KEY);
const save = { v: 1, best: 1, stars: {}, played: 0, ...(loaded && typeof loaded === 'object' ? loaded : {}) };
save.best = Math.max(1, Math.min(NIGHTS, Math.floor(save.best) || 1));
if (!save.stars || typeof save.stars !== 'object') save.stars = {};
const store = () => writeJson(KEY, save);
let night = Math.max(1, Math.min(save.best, Math.floor(Number(query.get('night'))) || save.best));

const canvas = $('c'), g = canvas.getContext('2d');
let W = 0, H = 0, unit = 1, left = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = canvas.width = Math.round(innerWidth * dpr); H = canvas.height = Math.round(innerHeight * dpr);
  unit = Math.min(W, H * 0.62); left = (W - unit) / 2;
}
addEventListener('resize', resize); resize();

let e = start(1, night), playing = false, paused = false, screen = 'menu', target = 0.5, acc = 0, last = 0, ended = -1e9;
let shake = 0, flashRed = 0, sparks = [], motes = [], squash = 0, streak = 0, dawnAt = -1, crashAt = -1, crashX = 0, crashY = 0, sayTimer = 0, shown = '', passed = new Set(), lastMurmur = 0;
const sx = x => left + x * unit, sy = y => H * 0.74 - (y - e.s.y) * unit;
window.echoState = () => ({ c: centre(e.s, e.s.y), h: half(e.s, e.s.y), screen, playing, paused, night, best: save.best, tin: e.tin, used: e.used, hearts: e.s.hearts, x: e.s.x, y: e.s.y, t: e.s.t, over: e.s.over, reach: reach(e), target, rings: e.rings.length, lit: view(e).rocks.length, flies: e.flies.length, unit: unit / dpr, left: left / dpr, boatY: sy(e.s.y) / dpr, W: W / dpr, H: H / dpr, stars: save.stars, murmur: murmur(e), sparkHint: $('spark').classList.contains('pulse') });
window.echoGame = () => e; // the browser check reads the river through this to steer by real pointer input

const show = screens(['menu', 'paused', 'end'], name => {
  screen = name;
  const play = name === 'play';
  for (const id of ['hud', 'big']) $(id).style.display = play ? 'block' : 'none';
  $('pause').style.display = $('spark').style.display = play ? 'grid' : 'none';
  if (name === 'menu') menu();
});
function say(text, ms = 1800) { const el = $('say'); el.textContent = text; el.style.opacity = 1; clearTimeout(sayTimer); sayTimer = setTimeout(() => { el.style.opacity = 0; }, ms); }

// ---------------------------------------------------------------- sound
let murmurGain = null, pan = null, river = null;
const snd = sound({ setup: ac => {
  // Water on rocks: looping noise, band-passed, panned toward the nearest rock and louder as it nears.
  const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.9;
  murmurGain = ac.createGain(); murmurGain.gain.value = 0;
  pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
  src.connect(bp).connect(murmurGain); if (pan) murmurGain.connect(pan).connect(ac.destination); else murmurGain.connect(ac.destination);
  // The river itself, low and steady.
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  river = ac.createGain(); river.gain.value = 0; src.connect(lp).connect(river).connect(ac.destination);
  src.start();
} });
const tone = (f, dur, vol, type = 'sine', slide = 0) => snd.tone(f, dur, vol, type, slide);
const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

// ---------------------------------------------------------------- menu and runs
function menu() {
  const box = $('nights'); box.textContent = '';
  for (let n = 1; n <= NIGHTS; n++) {
    const b = document.createElement('button'), st = save.stars[n] | 0;
    b.innerHTML = `${n}<small>${'★'.repeat(st)}${'·'.repeat(3 - st)}</small>`;
    b.disabled = n > save.best; b.classList.toggle('on', n === night); b.setAttribute('aria-label', `Night ${n}`);
    b.addEventListener('click', () => { night = n; tone(660 + 60 * n, 0.12, 0.06, 'triangle'); menu(); });
    box.append(b);
  }
  $('play').textContent = `Play night ${night}`;
}
function begin() {
  snd.unlock();
  e = start(fixedSeed ?? (Math.random() * 2 ** 31) | 0, night);
  target = e.s.x; playing = true; paused = false; acc = 0; streak = 0; sparks = []; motes = []; dawnAt = -1; crashAt = -1; shown = ''; passed = new Set(); trails = new WeakMap();
  steer.reset(); touches.clear();
  show('play'); hud();
  say(`Night ${night}`, 1500);
  tone(196, 0.5, 0.08, 'triangle'); burst(e.s.x, e.s.y, 26, '255,226,160', 0.9); // the free spark that opens a night
}
function finish() {
  playing = false; ended = performance.now(); steer.drop();
  const won = e.s.over === 'dawn', st = rating(e);
  save.played++;
  if (won) { save.stars[night] = Math.max(save.stars[night] | 0, st); if (night < NIGHTS) save.best = Math.max(save.best, night + 1); }
  store();
  $('endTitle').textContent = won ? 'Dawn' : 'Wrecked';
  $('endStars').innerHTML = won ? '★'.repeat(st) + `<i>${'★'.repeat(3 - st)}</i>` : '';
  const why = { bank: 'You ran onto the bank.', ice: 'You struck the ice.', log: 'You struck a log.' }[e.s.over] ?? 'You struck a rock.';
  if (won && night >= NIGHTS) { $('endLine').textContent = `All ${NIGHTS} nights, in the dark.`; $('again').textContent = 'Again'; }
  else if (won) { $('endLine').textContent = `${e.used} sparks struck. Night ${night + 1} is darker.`; $('again').textContent = `Night ${night + 1}`; }
  else { $('endLine').textContent = `${why} ${Math.floor(reach(e) * 100)}% of the way.`; $('again').textContent = 'Again'; }
  setTimeout(() => { if (!playing && screen === 'play') show('end'); }, won ? 2600 : 1100);
}
$('play').addEventListener('click', begin);
$('again').addEventListener('click', () => { if (performance.now() - ended < 500) return; if (e.s.over === 'dawn' && night < NIGHTS) night++; begin(); });
$('toMenu').addEventListener('click', () => { if (e.s.over === 'dawn' && night < NIGHTS) night++; show('menu'); });
$('quit').addEventListener('click', () => { playing = false; paused = false; snd.release(); show('menu'); });
$('resume').addEventListener('click', () => resume());

function hud() {
  const now = `${e.s.hearts}|${e.tin}|${Math.floor(reach(e) * 100)}`;
  if (now === shown) return; shown = now;
  $('hearts').textContent = '♥'.repeat(Math.max(0, e.s.hearts)); $('tin').textContent = e.tin; $('tinBadge').textContent = e.tin;
  $('big').textContent = `${Math.floor(reach(e) * 100)}%`;
  $('spark').classList.toggle('empty', e.tin === 0);
}

// ---------------------------------------------------------------- input
// A second finger, the spark button, a mouse click or Space strikes a spark. One finger steers (kit drag.js).
let wantSpark = false;
function strike() {
  if (!playing || paused) return;
  wantSpark = true;
  const b = $('spark'); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
  if (read(SPARKED) !== '1') { write(SPARKED, '1'); b.classList.remove('pulse'); }
}
const touches = new Set();
// Registered before drag(), so a second finger is caught here and drag.js never sees it (it would take over the steering).
canvas.addEventListener('pointerdown', ev => {
  if (ev.pointerType === 'mouse') { if (playing && !paused) strike(); return; }
  if (touches.size && playing && !paused) { touches.add(ev.pointerId); ev.stopImmediatePropagation(); strike(); return; }
  touches.add(ev.pointerId);
}, true);
for (const type of ['pointerup', 'pointercancel']) addEventListener(type, ev => touches.delete(ev.pointerId), true);
function aim(x) { const c = centre(e.s, e.s.y), h = half(e.s, e.s.y) + 0.02; target = Math.max(c - h, Math.min(c + h, x)); }
const steer = drag(canvas, { playing: () => playing, paused: () => paused, resume: () => resume(), from: () => e.s.x, travel: dx => dx * dpr / unit * gain, aim, mouse: ev => aim((ev.clientX * dpr - left) / unit), settle: 12 });
hint(canvas, { kind: 'drag', key: 'lantern-spark:hint', delay: 1500, bottom: 170, when: () => playing && !paused && screen === 'play', played: save.played > 0 });
const sparkBtn = $('spark');
sparkBtn.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); if (paused) resume(); else strike(); });
sparkBtn.addEventListener('click', ev => ev.preventDefault());
if (read(SPARKED) !== '1') sparkBtn.classList.add('pulse');

function pause() {
  if (!playing || paused) return; paused = true; steer.drop(); keys.clear(); touches.clear();
  $('pausedLine').textContent = `Night ${night}, ${Math.floor(reach(e) * 100)}% of the way.`;
  show('paused'); snd.hold();
}
function resume() { if (!paused) return; paused = false; acc = 0; last = performance.now(); target = e.s.x; show('play'); snd.release(); }
$('pause').addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); pause(); });
onLeave(pause);
const keys = new Set();
addEventListener('keydown', ev => {
  if (isPauseKey(ev)) { paused ? resume() : pause(); return; }
  if (paused) { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); resume(); } return; }
  if (ev.key === ' ' && playing) { ev.preventDefault(); if (!ev.repeat) strike(); return; }
  if ((ev.key === 'Enter' || ev.key === ' ') && !playing && screen === 'menu') { ev.preventDefault(); begin(); return; }
  keys.add(ev.key);
});
addEventListener('keyup', ev => keys.delete(ev.key));

// ---------------------------------------------------------------- the game tick
function burst(x, y, n, rgb, speed = 0.6, life = 0.8) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = speed * (0.3 + Math.random() * 0.7); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, rgb }); } }
function step1() {
  if (keys.has('ArrowLeft') || keys.has('a')) target = e.s.x - 0.1;
  if (keys.has('ArrowRight') || keys.has('d')) target = e.s.x + 0.1;
  const spark = wantSpark; wantSpark = false;
  tick(e, target, spark);
  const s = e.s;
  for (const ev of e.events) {
    if (ev === 'spark') { tone(1900, 0.09, 0.07, 'square', 900); snd.noise(0.09, 0.22, 4200); setTimeout(() => tone(1318.5, 0.6, 0.05, 'triangle'), 30); burst(s.x, s.y, 22, '255,226,160', 0.9); squash = 1; }
    if (ev === 'empty') { tone(140, 0.12, 0.12, 'square'); say('The tin is empty', 1300); }
    if (ev === 'ember') { tone(scale[Math.min(streak++, scale.length - 1)], 0.45, 0.1, 'triangle'); setTimeout(() => tone(scale[Math.min(streak, scale.length - 1)] * 1.5, 0.3, 0.05, 'sine'), 70); burst(s.x, s.y, 14, '255,160,70', 0.5); say(e.tin >= TIN_MAX ? 'Tin full' : `+${REFILL} ${REFILL === 1 ? 'spark' : 'sparks'}`, 900); }
    if (ev === 'graze') tone(1600, 0.08, 0.04);
    if (ev === 'thunder') { snd.noise(1.6, 0.35, 140); tone(48, 1.8, 0.22, 'sawtooth', -10); shake = Math.max(shake, 0.5); }
    if (ev === 'hurt') { tone(150, 0.35, 0.25, 'square', -60); snd.noise(0.25, 0.3, 700); shake = 1; flashRed = 1; target = s.x; steer.rebase(); burst(s.x, s.y, 18, '255,90,100', 0.8); streak = 0; say(s.hearts === 1 ? 'One life left' : `${s.hearts} lives left`, 1300); }
    if (ev === 'hit') { tone(70, 0.6, 0.35, 'sawtooth', -30); snd.noise(0.5, 0.4, 500); shake = 1.4; flashRed = 1; crashAt = performance.now(); crashX = s.x; crashY = s.y; burst(s.x, s.y, 40, '255,200,150', 1.1, 1.2); }
    if (ev === 'dawn') { dawnAt = performance.now(); [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => tone(f, 1.6, 0.08, 'triangle'), i * 170)); for (let i = 0; i < 60; i++) motes.push({ x: Math.random(), y: Math.random() * 0.7, v: 0.04 + Math.random() * 0.1, ph: Math.random() * 6 }); }
  }
  // A soft chime as the boat passes over a firefly: it was safe water.
  for (const f of e.flies) if (!passed.has(f.id) && f.y < s.y && f.y > s.y - 0.3) { passed.add(f.id); if (Math.abs(f.x - s.x) < 0.05) tone(2349, 0.18, 0.025, 'sine'); }
  hud();
  if (s.over) finish();
}

// ---------------------------------------------------------------- drawing
const hash = (a, b) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
let trails = new WeakMap(), shapes = new WeakMap(), shapeN = 0;
function shapeOf(k) { let sh = shapes.get(k); if (!sh) { const id = ++shapeN; sh = Array.from({ length: 9 }, (_, i) => 0.82 + 0.3 * hash(id, i)); shapes.set(k, sh); } return sh; }
function water(top, bot) {
  const s = e.s;
  g.beginPath();
  for (let y = bot; y <= top; y += 0.05) g.lineTo(sx(centre(s, y) - half(s, y)), sy(y));
  for (let y = top; y >= bot; y -= 0.05) g.lineTo(sx(centre(s, y) + half(s, y)), sy(y));
  g.closePath();
}
function draw(now) {
  const s = e.s, t = now / 1000;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#02040a'; g.fillRect(0, 0, W, H);
  const k = shake * shake * 10 * dpr; g.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  const top = s.y + 0.74 * H / unit + 0.1, bot = s.y - 0.26 * H / unit - 0.1;
  const day = dawnAt > 0 ? Math.min(1, (now - dawnAt) / 2500) : 0, near = Math.max(0, (reach(e) - 0.85) / 0.15);
  const v = view(e);
  if (day > 0) { for (const r of v.rocks) r.glow = Math.max(r.glow, day); for (const k2 of s.rocks) if (!v.rocks.some(r => r.k === k2)) v.rocks.push({ k: k2, x: k2.x, y: k2.y, rad: k2.rad, len: k2.len, glow: day }); }
  // Banks in starlight: faint, dark ground with a few pale stones.
  g.fillStyle = '#060912';
  for (let y = Math.floor(bot / 0.18); y < top / 0.18; y++) for (let i = 0; i < 10; i++) { const h1 = hash(y, i); if (h1 < 0.5) continue; const x = hash(i, y) ; g.globalAlpha = 0.5; g.fillRect(x * W, sy(y * 0.18 + hash(y + 3, i) * 0.18), 2 * dpr, 2 * dpr); }
  g.globalAlpha = 1;
  // The water: a deep blue that warms toward dawn.
  water(top, bot);
  const wg = g.createLinearGradient(0, 0, 0, H);
  wg.addColorStop(0, `rgb(${8 + 70 * day + 10 * near},${13 + 40 * day},${30 + 30 * day})`); wg.addColorStop(1, '#050913');
  g.fillStyle = wg; g.fill();
  g.strokeStyle = 'rgba(140,160,215,.16)'; g.lineWidth = 1.5 * dpr; g.stroke();
  g.save(); water(top, bot); g.clip();
  // Current lines drifting past.
  g.strokeStyle = 'rgba(150,170,230,.05)'; g.lineWidth = 1 * dpr;
  for (let i = Math.floor(bot / 0.23); i < top / 0.23; i++) { const y = i * 0.23 + 0.05 * Math.sin(i), c = centre(s, y), x = c + (hash(i, 9) * 2 - 1) * half(s, y) * 0.8; g.beginPath(); g.moveTo(sx(x), sy(y)); g.lineTo(sx(x + 0.01 * Math.sin(t + i)), sy(y + 0.12)); g.stroke(); }
  // The Milky Way's reflection: a faint haze across the water, still while the river moves under it.
  const mw = g.createLinearGradient(0, H * 0.15, W, H * 0.55);
  mw.addColorStop(0, 'rgba(120,140,220,0)'); mw.addColorStop(0.45, `rgba(130,150,230,${0.07 * (1 - day)})`); mw.addColorStop(0.55, `rgba(160,150,230,${0.09 * (1 - day)})`); mw.addColorStop(1, 'rgba(120,140,220,0)');
  g.fillStyle = mw; g.fillRect(0, 0, W, H);
  // Stars reflected in the water: still around the boat, put out wherever a rock passes; brighter where a spark's ring is passing.
  const rings = e.rings.map(r => ({ x: r.x, y: r.y, r: r.r }));
  g.globalCompositeOperation = 'lighter';
  for (const p of stars(e, bot, top)) {
    if (!p.on) continue;
    const h1 = hash(p.i + 5, p.j), tw = 0.6 + 0.4 * Math.sin(t * (1.1 + 2 * hash(p.i, p.j)) + 6.28 * hash(p.j, p.i));
    let lift = 0; for (const r of rings) { const d = Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.r); if (d < 0.08) lift = Math.max(lift, 1 - d / 0.08); }
    const X = sx(p.x + 0.0025 * Math.sin(t * 1.7 + p.j)), Y = sy(p.y), R = (1.1 + 1.5 * h1 * h1 + 1.6 * lift) * dpr;
    const a = Math.min(1, (0.4 + 0.5 * tw + lift * 0.5) * (1 - 0.8 * day)), col = lift > 0.2 ? '255,236,190' : h1 > 0.9 ? '255,214,170' : h1 < 0.15 ? '170,200,255' : '215,225,255';
    if (R > 2 * dpr) { const sg = g.createRadialGradient(X, Y, 0, X, Y, R * 3); sg.addColorStop(0, `rgba(${col},${0.35 * a})`); sg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = sg; g.fillRect(X - R * 3, Y - R * 3, R * 6, R * 6); }
    g.fillStyle = `rgba(${col},${a})`; g.beginPath(); g.arc(X, Y, R / 2, 0, 6.283); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // Spark rings, with ripples trailing them.
  g.globalCompositeOperation = 'lighter';
  for (const r of e.rings) {
    const X = sx(r.x), Y = sy(r.y), a = Math.max(0, 1 - r.r / RING_MAX);
    if (r.r < 0.25) { const fg = g.createRadialGradient(X, Y, 0, X, Y, 0.3 * unit); fg.addColorStop(0, `rgba(255,230,170,${0.5 * (1 - r.r / 0.25)})`); fg.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = fg; g.fillRect(X - 0.3 * unit, Y - 0.3 * unit, 0.6 * unit, 0.6 * unit); }
    for (let j = 0; j < 3; j++) { const rr = r.r - j * 0.07; if (rr <= 0) continue; g.strokeStyle = `rgba(255,${226 - 30 * j},${170 - 40 * j},${a * (j ? 0.18 / j : 0.9)})`; g.lineWidth = (j ? 1.5 : 3) * dpr; g.beginPath(); g.arc(X, Y, rr * unit, 0, 6.283); g.stroke(); }
    g.strokeStyle = `rgba(255,200,120,${a * 0.14})`; g.lineWidth = 16 * dpr; g.beginPath(); g.arc(X, Y, r.r * unit, 0, 6.283); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  g.restore();
  // Lit banks: an amber line along the water's edge, with reeds catching the light.
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (const b of v.banks) {
    if (b.y < bot || b.y > top) continue;
    const a = b.glow ** 1.4, ya = b.y - 0.026, yb = b.y + 0.026, xa = centre(s, ya) + b.side * half(s, ya), xb = centre(s, yb) + b.side * half(s, yb);
    g.strokeStyle = `rgba(255,170,90,${0.22 * a})`; g.lineWidth = 9 * dpr; g.beginPath(); g.moveTo(sx(xa), sy(ya)); g.lineTo(sx(xb), sy(yb)); g.stroke();
    g.strokeStyle = `rgba(255,200,130,${0.7 * a})`; g.lineWidth = 2.2 * dpr; g.stroke();
    if (hash(Math.round(b.y * 20), b.side) < 0.35) { const X = sx(b.x) + b.side * 4 * dpr, Y = sy(b.y), sway = Math.sin(t * 1.5 + b.y * 9) * 3 * dpr; g.strokeStyle = `rgba(255,214,150,${0.45 * a})`; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + b.side * 3 * dpr, Y - 0.03 * unit, X + b.side * 2 * dpr + sway, Y - 0.07 * unit); g.stroke(); }
  }
  g.globalCompositeOperation = 'source-over'; g.lineCap = 'butt';
  // Lit rocks: a trail of where the glow has been, then the rock with an amber rim.
  for (const r of v.rocks) {
    const kk = r.k; if (r.y < bot - 0.2 || r.y > top + 0.2) continue;
    let tr = trails.get(kk); if (!tr) trails.set(kk, tr = []);
    const last = tr[tr.length - 1]; if (!last || Math.hypot(last.x - r.x, last.y - r.y) > 0.006) { tr.push({ x: r.x, y: r.y }); if (tr.length > 14) tr.shift(); }
    for (let i = 0; i < tr.length - 1; i++) { g.fillStyle = `rgba(255,170,90,${0.12 * r.glow * i / tr.length})`; g.beginPath(); g.arc(sx(tr[i].x), sy(tr[i].y), r.rad * unit * 0.8, 0, 6.283); g.fill(); }
    const X = sx(r.x), Y = sy(r.y), R = r.rad * unit, a = r.glow, ice = kk.ice;
    const hal = g.createRadialGradient(X, Y, R * 0.5, X, Y, R * 2.6 + r.len * unit);
    hal.addColorStop(0, ice ? `rgba(160,220,255,${0.35 * a})` : `rgba(255,170,80,${0.35 * a})`); hal.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = hal; g.beginPath(); g.arc(X, Y, R * 2.6 + r.len * unit, 0, 6.283); g.fill();
    g.globalAlpha = Math.min(1, 0.25 + a);
    if (r.len) { g.fillStyle = '#2a1c12'; g.beginPath(); g.roundRect ? g.roundRect(X - (r.len + r.rad) * unit, Y - R, 2 * (r.len + r.rad) * unit, 2 * R, R) : g.rect(X - (r.len + r.rad) * unit, Y - R, 2 * (r.len + r.rad) * unit, 2 * R); g.fill(); g.strokeStyle = `rgba(255,190,110,${a})`; g.lineWidth = 2 * dpr; g.stroke(); }
    else {
      const sh = shapeOf(kk); g.beginPath();
      for (let i = 0; i < sh.length; i++) { const ang = i / sh.length * 6.283; g.lineTo(X + Math.cos(ang) * R * sh[i], Y + Math.sin(ang) * R * sh[i] * 0.9); }
      g.closePath();
      const body = g.createRadialGradient(X - R * 0.3, Y - R * 0.4, R * 0.1, X, Y, R * 1.2);
      body.addColorStop(0, ice ? '#3d5868' : '#3a2a20'); body.addColorStop(1, ice ? '#0e1820' : '#0d0907');
      g.fillStyle = body; g.fill();
      g.strokeStyle = ice ? `rgba(190,235,255,${a})` : `rgba(255,196,120,${a})`; g.lineWidth = 2.2 * dpr; g.stroke();
      g.fillStyle = `rgba(255,236,200,${0.5 * a})`; g.beginPath(); g.arc(X - R * 0.35, Y - R * 0.35, R * 0.18, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
  }
  // Embers: coals that glow when lit, or faintly when the boat is close.
  for (const p of v.embers) {
    const X = sx(p.x), Y = sy(p.y) + Math.sin(t * 3 + p.y * 9) * 1.5 * dpr, a = p.glow * (0.8 + 0.2 * Math.sin(t * 6 + p.x * 40)), col = p.kind === 'wisp' ? '150,235,110' : '255,150,60';
    const eg = g.createRadialGradient(X, Y, 0, X, Y, 0.05 * unit); eg.addColorStop(0, `rgba(255,240,200,${a})`); eg.addColorStop(0.3, `rgba(${col},${0.8 * a})`); eg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = eg; g.beginPath(); g.arc(X, Y, 0.05 * unit, 0, 6.283); g.fill();
  }
  // Fireflies over safe water, each blinking on its own beat, with a reflection below.
  for (const f of v.flies) {
    if (f.y < bot || f.y > top) continue;
    const ph = f.id * 1.7, X = sx(f.x + 0.012 * Math.sin(t * 1.3 + ph)), Y = sy(f.y + 0.01 * Math.sin(t * 2.1 + ph * 2)), blink = 0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2 + ph)) ** 2;
    const fg = g.createRadialGradient(X, Y, 0, X, Y, 0.035 * unit); fg.addColorStop(0, `rgba(230,255,150,${0.9 * blink})`); fg.addColorStop(1, 'rgba(200,255,120,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(X, Y, 0.035 * unit, 0, 6.283); g.fill();
    g.fillStyle = `rgba(250,255,210,${blink})`; g.beginPath(); g.arc(X, Y, 1.8 * dpr, 0, 6.283); g.fill();
    g.fillStyle = `rgba(200,255,140,${0.25 * blink})`; g.fillRect(X - 1 * dpr, Y + 0.02 * unit, 2 * dpr, 0.012 * unit);
  }
  // The boat, its dead lantern and its wake.
  const bx = sx(s.x), by = sy(s.y), crashed = crashAt > 0;
  if (!crashed || now - crashAt < 120) {
    g.strokeStyle = 'rgba(190,205,255,.14)'; g.lineWidth = 1.5 * dpr;
    for (let i = 1; i <= 3; i++) { const d = ((t * 0.9 + i / 3) % 1) * 0.12 * unit; g.globalAlpha = 1 - d / (0.12 * unit); g.beginPath(); g.moveTo(bx - 0.012 * unit - d * 0.5, by + 0.03 * unit + d); g.lineTo(bx, by + 0.02 * unit); g.lineTo(bx + 0.012 * unit + d * 0.5, by + 0.03 * unit + d); g.stroke(); }
    g.globalAlpha = 1;
    g.save(); g.translate(bx, by); const q = squash; g.scale(1 + 0.18 * q, 1 - 0.14 * q);
    g.shadowColor = '#000'; g.shadowBlur = 10 * dpr; g.shadowOffsetY = 3 * dpr;
    const bw = boat(s) * unit;
    g.fillStyle = '#20160f'; g.beginPath(); g.moveTo(0, -bw * 1.9); g.quadraticCurveTo(bw * 1.15, -bw * 0.4, bw * 0.8, bw * 1.5); g.lineTo(-bw * 0.8, bw * 1.5); g.quadraticCurveTo(-bw * 1.15, -bw * 0.4, 0, -bw * 1.9); g.fill();
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.strokeStyle = `rgba(170,190,255,${0.35 + 0.4 * day})`; g.lineWidth = 1.5 * dpr; g.stroke();
    g.fillStyle = '#3b2a1c'; g.fillRect(-bw * 0.55, -bw * 0.1, bw * 1.1, bw * 0.25);
    // The lantern: dark glass, a wick still faintly red.
    g.fillStyle = '#121620'; g.fillRect(-bw * 0.35, bw * 0.35, bw * 0.7, bw * 0.75); g.strokeStyle = '#59606e'; g.lineWidth = 1 * dpr; g.strokeRect(-bw * 0.35, bw * 0.35, bw * 0.7, bw * 0.75);
    const wick = 0.4 + 0.25 * Math.sin(t * 2.3) + 0.6 * squash;
    g.fillStyle = `rgba(255,90,40,${wick})`; g.beginPath(); g.arc(0, bw * 0.75, bw * 0.16, 0, 6.283); g.fill();
    g.restore();
  } else if (now - crashAt < 1500) {
    const k2 = (now - crashAt) / 1500; g.strokeStyle = `rgba(200,220,255,${0.5 * (1 - k2)})`; g.lineWidth = 2 * dpr;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(sx(crashX), sy(crashY), (0.03 + 0.12 * k2 + 0.03 * i) * unit, (0.02 + 0.08 * k2 + 0.02 * i) * unit, 0, 0, 6.283); g.stroke(); }
  }
  // Particles: spark bursts, embers taken, blows.
  for (const p of sparks) { const a = Math.max(0, p.life / p.max); g.fillStyle = `rgba(${p.rgb},${a})`; g.beginPath(); g.arc(sx(p.x), sy(p.y), (1 + 2 * a) * dpr, 0, 6.283); g.fill(); }
  // Thunder: the river flashes white for a blink.
  if (v.flash > 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(215,228,255,${0.55 * v.flash})`; g.fillRect(0, 0, W, H); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Dawn: warm light from the top of the screen, then motes rising.
  if (near > 0 || day > 0) {
    const dg = g.createLinearGradient(0, 0, 0, H * 0.8); dg.addColorStop(0, `rgba(255,170,110,${0.25 * near + 0.35 * day})`); dg.addColorStop(1, 'rgba(255,170,110,0)'); g.fillStyle = dg; g.fillRect(0, 0, W, H);
    const sun = g.createRadialGradient(W / 2, -H * 0.05, 0, W / 2, -H * 0.05, H * 0.55); sun.addColorStop(0, `rgba(255,236,190,${0.2 * near + 0.55 * day})`); sun.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = sun; g.fillRect(0, 0, W, H);
  }
  for (const m of motes) { g.fillStyle = `rgba(255,230,170,${0.7 * day})`; g.beginPath(); g.arc(m.x * W + Math.sin(t + m.ph) * 8 * dpr, (m.y * H) % H, 2.2 * dpr, 0, 6.283); g.fill(); }
  // A dark edge around everything, and a red flash on a blow.
  const vg = g.createRadialGradient(W / 2, H * 0.6, Math.min(W, H) * 0.3, W / 2, H * 0.6, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.65 * (1 - day)})`); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  if (flashRed > 0) { g.fillStyle = `rgba(200,30,40,${0.3 * flashRed})`; g.fillRect(0, 0, W, H); }
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  if (playing && !paused) { acc += dt * fast; while (acc >= DT && playing) { step1(); acc -= DT; } }
  shake = Math.max(0, shake - dt * 2.5); flashRed = Math.max(0, flashRed - dt * 2.5); squash = Math.max(0, squash - dt * 5);
  for (const p of sparks) { p.x += p.vx * dt * 0.25; p.y += p.vy * dt * 0.25; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; } sparks = sparks.filter(p => p.life > 0);
  for (const m of motes) m.y -= m.v * dt;
  if (snd.ctx && murmurGain) {
    const m = playing && !paused ? murmur(e) : { level: 0, pan: 0 }, ct = snd.ctx.currentTime;
    murmurGain.gain.setTargetAtTime(0.32 * m.level, ct, 0.05); if (pan) pan.pan.setTargetAtTime(m.pan, ct, 0.05);
    river.gain.setTargetAtTime(playing && !paused ? 0.05 : 0.015, ct, 0.3);
    if (m.level > 0.6 && now - lastMurmur > 700) { lastMurmur = now; tone(180 + 60 * m.level, 0.12, 0.03, 'sine', -40); } // a slap of water on stone
  }
  draw(now);
  requestAnimationFrame(frame);
}
show('menu');
requestAnimationFrame(frame);
