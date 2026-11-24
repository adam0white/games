// Harvest Morning: the page. View, input, sound, save, cards. The rules are in sim.js.
import * as sim from './sim.js';
import { DT, LEVELS, HELP, HELPERS, RIVAL, LANE, SWEEP, STAND, LYING, GONE, NEST_BONUS } from './sim.js';
import { C, TAU, rrect, ell, grain, star, person, sheaf, cart, crow, stone, hare, whetstone, reason, job, cloud, sun, wheat } from './art.js';
import { readJson, writeJson } from '../kit/save.js';
import { sound } from '../kit/audio.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { lab } from '../kit/lab.js';
import { hint } from '../kit/hint.js';
import { noZoom } from '../kit/zoom.js'; noZoom();

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- the save: one JSON blob; fields only ever grow
const KEY = 'harvest-save';
const hadSave = readJson(KEY, null) !== null;
const save = { v: 1, sound: true, stars: Array(LEVELS.length).fill(0), best: Array(LEVELS.length).fill(0), runs: 0, daily: {}, board: [] };
{
  const old = readJson(KEY, null);
  if (old && typeof old === 'object') {
    if (typeof old.sound === 'boolean') save.sound = old.sound;
    if (Number.isFinite(old.runs)) save.runs = old.runs;
    for (const k of ['stars', 'best']) if (Array.isArray(old[k])) old[k].forEach((v, i) => { if (i < LEVELS.length && Number.isFinite(v) && v >= 0) save[k][i] = v; });
    if (old.daily && typeof old.daily === 'object' && !Array.isArray(old.daily)) save.daily = Object.fromEntries(Object.entries(old.daily).filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(v)).sort().slice(-30));
    if (Array.isArray(old.board)) save.board = old.board.filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.d) && Number.isFinite(e.k)).slice(0, 10);
  }
}
const store = () => writeJson(KEY, save);
const unlocked = () => { let n = 0; while (n < LEVELS.length && save.stars[n] > 0) n++; return Math.min(n, LEVELS.length - 1); };

// Today's field: one seed for everyone on the same UTC date (?date=YYYY-MM-DD for another day).
const today = /^\d{4}-\d{2}-\d{2}$/.test(query.get('date') ?? '') ? query.get('date') : new Date().toISOString().slice(0, 10);
const dateSeed = sim.dateSeed;

// ---------- sound: all synthesized through the kit
const snd = sound({ on: () => save.sound });
const tone = (f, d, v, type = 'sine', slide = 0) => { if (snd.ctx) snd.tone(f, d, v, type, slide); };
const noise = (d, v, hz) => { if (snd.ctx) snd.noise(d, v, hz); };
const later = (ms, fn) => setTimeout(() => { if (!paused) fn(); }, ms);
let lastCutSound = 0, lastPickSound = 0, stepClock = 0;
const SFX = {
  cut() { const n = performance.now(); if (n - lastCutSound < 70) return; lastCutSound = n; noise(0.07, 0.07, 3200 + Math.random() * 1500); tone(1100 + Math.random() * 300, 0.04, 0.015, 'triangle', -300); },
  pick(k) { const n = performance.now(); if (n - lastPickSound < 50) return; lastPickSound = n; tone(440 + 90 * k, 0.09, 0.06, 'triangle', 60); },
  drop(n) { [523, 659, 784, 1047].slice(0, 1 + Math.min(3, n)).forEach((f, i) => later(i * 55, () => tone(f, 0.18, 0.07, 'triangle'))); noise(0.12, 0.08, 500); },
  crow() { tone(430, 0.16, 0.05, 'sawtooth', -160); later(170, () => tone(400, 0.18, 0.05, 'sawtooth', -170)); },
  scare() { noise(0.25, 0.1, 2400); tone(700, 0.12, 0.035, 'square', 500); },
  eaten() { tone(330, 0.15, 0.04, 'triangle', -120); },
  stone() { tone(1900, 0.14, 0.08, 'square', -1100); noise(0.12, 0.25, 6500); },
  whet() { for (let k = 0; k < 3; k++) later(k * 260, () => { noise(0.18, 0.12, 5200 + k * 600); tone(2400, 0.12, 0.02, 'sine', 600); }); },
  sharp() { tone(1500, 0.35, 0.05, 'sine', 700); later(60, () => tone(2600, 0.3, 0.03)); },
  wind() { noise(0.9, 0.09, 420); later(250, () => noise(0.7, 0.06, 700)); },
  hare() { [880, 990, 1175].forEach((f, i) => later(i * 90, () => tone(f, 0.08, 0.05, 'triangle', 500))); },
  hire() { tone(523, 0.13, 0.08, 'triangle'); later(110, () => tone(784, 0.22, 0.08, 'triangle')); },
  refuse() { tone(210, 0.28, 0.07, 'square', -50); later(150, () => tone(180, 0.3, 0.06, 'square', -40)); },
  home() { tone(660, 0.12, 0.06, 'triangle'); later(110, () => tone(440, 0.2, 0.06, 'triangle')); },
  storm() { noise(1.4, 0.35, 140); tone(55, 1.2, 0.12, 'sawtooth', -15); later(300, () => noise(1.0, 0.2, 260)); },
  soak() { noise(0.25, 0.05, 3800); },
  trample() { noise(0.1, 0.07, 900); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 110, () => { tone(f, 0.35, 0.08, 'triangle'); tone(f / 2, 0.3, 0.04); })); },
  lose() { [392, 349, 311, 262].forEach((f, i) => later(i * 160, () => tone(f, 0.4, 0.07, 'triangle'))); },
  star(k) { tone(784 * 2 ** (k / 4), 0.3, 0.08, 'triangle'); tone(1568 * 2 ** (k / 4), 0.2, 0.03); },
  tap() { tone(520, 0.06, 0.04, 'triangle'); },
  step() { noise(0.035, 0.025, 900); },
};
const buzz = ms => { if (save.sound && navigator.vibrate) try { navigator.vibrate(ms); } catch {} };

// ---------- lab recording
const rec = lab('harvest');
rec.notice($('menu').firstElementChild);
rec.toggle($('paused').firstElementChild);

// ---------- canvas and layout (CSS pixels)
const cv = $('c'), g = cv.getContext('2d');
let W = 0, H = 0, dpr = 1, st = 0, sb = 0, c = 30, ox = 0, oy = 0, hud = { x: 12, y: 8, w: 300, h: 34 }, vergeTop = 0, slots = [], tufts = [];
const VERGE = 100;
function layout() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const cs = getComputedStyle($('probe'));
  st = parseFloat(cs.paddingTop) || 0; sb = parseFloat(cs.paddingBottom) || 0;
  const wide = Math.min(W, 560), left = (W - wide) / 2;
  hud = { x: left + 12, y: st + 8, w: wide - 24 - 56, h: 36 };
  vergeTop = H - sb - VERGE;
  tufts = Array.from({ length: 90 }, (_, i) => ({ x: hash(i, 1) * W, y: hash(i, 2) * H, s: 3 + hash(i, 3) * 5 }));
  fit();
  if (s) draw(1); // Changing canvas dimensions clears it; repaint before waiting for an animation frame.
}
function fit() {
  if (!s) return;
  const top = st + 8 + 36 + 6 + 30 + 4, bottom = vergeTop - 6;
  // the cart may stand past the field's edge: leave room for it
  const padL = Math.max(0, 1.4 - s.cart.x), padR = Math.max(0, s.cart.x + 1.2 - s.cols);
  c = Math.max(14, Math.min(64, (Math.min(W, 560) - 16) / (s.cols + padL + padR), (bottom - top) / (s.rows + LANE)));
  ox = (W - (s.cols + padL + padR) * c) / 2 + padL * c; oy = top + Math.max(0, (bottom - top - (s.rows + LANE) * c) / 2);
  placeSlots();
}
addEventListener('resize', layout);
const hash = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177) >>> 0; h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sx = x => ox + x * c, sy = y => oy + y * c;

// ---------- run state
let s = null, prev = null, level = 0, daily = false, playing = false, paused = false, screen = 'menu', acc = 0, last = performance.now(), clock = 0;
let finger = null, keys = new Set(), parts = [], floats = [], shake = 0, flash = 0, banner = null, cartBounce = 0, endAt = 0, hireGuard = {}, lastTouched = 0, swing = 0, bob = 0, hares = [], gusts = [], ending = null, ripple = [], soakedWheat = [];
let ears = null; // per cell: ear offsets, so the field looks hand-made but stays the same
const seedQ = query.has('seed') ? Number(query.get('seed')) >>> 0 : null;
const levelQ = query.has('level') ? Math.max(1, Math.min(LEVELS.length, Number(query.get('level')) || 1)) - 1 : null;
const timeQ = Number(query.get('time')) > 0 ? Number(query.get('time')) : null; // a shorter morning, for checks
let runN = 0;

const show = screens(['menu', 'levels', 'paused', 'end'], name => {
  screen = name;
  $('pause').style.display = name === 'play' ? 'grid' : 'none';
  if (name === 'menu') menu();
  if (name === 'levels') levels();
  for (const id of ['sound1', 'sound2']) $(id).textContent = `Sound: ${save.sound ? 'on' : 'off'}`;
});

function menu() {
  const n = unlocked(), total = save.stars.reduce((a, b) => a + b, 0);
  $('play').textContent = save.stars[0] ? `Field ${n + 1}` : 'Play';
  $('daily').style.display = save.stars[0] ? '' : 'none';
  $('fields').style.display = save.stars[0] ? '' : 'none';
  $('menuLine').textContent = save.stars[0] ? `★ ${total} of ${LEVELS.length * 3}` + (today in save.daily ? `  ·  today's best ${save.daily[today]}` : '') : '';
  if (!s || playing) demo();
  drawHero();
}
function levels() {
  const box = $('grid'); box.textContent = '';
  const n = unlocked();
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    b.innerHTML = `${i + 1}<small>${'★'.repeat(save.stars[i])}${'☆'.repeat(3 - save.stars[i])}</small>`;
    b.disabled = i > n; if (save.stars[i]) b.classList.add('done');
    b.dataset.level = i + 1;
    b.addEventListener('click', () => { snd.unlock(); begin(i, false); });
    box.append(b);
  });
}
function demo() { s = sim.create({ level: 6, seed: 3 }); prev = null; prepare(); fit(); }

function prepare() {
  ears = [];
  for (let i = 0; i < s.cols * s.rows; i++) ears.push(Array.from({ length: 5 }, (_, k) => ({ x: 0.18 + 0.64 * hash(i, k * 3 + 1), y: 0.18 + 0.64 * hash(i, k * 3 + 2), a: (hash(i, k * 3 + 3) - 0.5) * 0.9, s: 0.85 + 0.3 * hash(i, k + 40) })));
  parts = []; floats = []; hares = []; gusts = []; ripple = []; soakedWheat = [];
}

// ---------- a morning
function begin(lv, isDaily) {
  daily = isDaily; level = lv; runN++;
  let L;
  if (daily) { L = sim.dailyLevel(dateSeed(today)); }
  else L = { ...LEVELS[lv] };
  if (timeQ) L = { ...L, time: timeQ };
  const seed = daily ? dateSeed(today) : seedQ ?? ((lv + 1) * 7919 + runN * 104729) >>> 0;
  s = sim.create({ level: lv, seed, L }); prev = null;
  prepare(); fit();
  playing = true; paused = false; acc = 0; last = performance.now(); finger = null; keys.clear(); endAt = 0; ending = null; hireGuard = {};
  banner = { t: 0, ...BANNER[L.learn] , title: daily ? "Today's field" : `Field ${lv + 1}` };
  rec.start({ level: daily ? 0 : lv + 1, daily: daily ? today : null, seed, cols: s.cols, rows: s.rows });
  show('play');
  draw(1);
  SFX.tap();
}
const BANNER = {
  cut: { word: 'Cut and carry' }, crows: { word: 'Crows!' }, strong: { word: 'Help for hire' }, stone: { word: 'A hidden stone' },
  child: { word: 'Crow chaser' }, wind: { word: 'Wind!' }, old: { word: 'Double bundles' }, nest: { word: "A hare's nest" },
  fast: { word: 'Cut, bundle and carry' }, pond: { word: 'The pond' }, far: { word: 'A far cart' }, all: { word: 'Last field' }, daily: { word: 'Same for everyone' },
};

function finish() {
  playing = false;
  const r = s.result;
  if (!daily) {
    save.best[level] = Math.max(save.best[level], r.kept);
    save.stars[level] = Math.max(save.stars[level], r.stars);
  } else {
    save.daily[today] = Math.max(save.daily[today] ?? 0, r.kept);
    save.daily = Object.fromEntries(Object.entries(save.daily).sort().slice(-30));
    save.board.push({ d: today, k: r.kept, n: runN });
    save.board.sort((a, b) => b.k - a.k); save.board = save.board.slice(0, 10);
  }
  save.runs++; store();
  rec.end(r.why, { level: daily ? 0 : level + 1, daily: daily ? today : null, kept: r.kept, cart: r.cart, pay: r.pay, bonus: r.bonus, stars: r.stars, seconds: Math.round(s.t), hired: HELPERS.filter(id => s.helpers[id].ever), stats: s.stats });
  endCard();
}

function endCard() {
  const r = s.result, L = s.L;
  const won = daily ? r.kept > 0 : r.passed;
  $('endTitle').textContent = daily ? "Today's field" : won ? (r.why === 'cleared' ? 'All in! Safe and dry!' : 'Safe from the rain!') : r.why === 'stopped' ? 'Stopped early' : 'The rain won';
  const rows = [[grainIcon() + 'In the cart', r.cart, '']];
  for (const id of HELPERS) if (r.each[id]) rows.push([`${NAME[id]}`, `−${r.each[id]}`, 'minus']);
  if (r.bonus) rows.push(["Hare's nest", `+${r.bonus}`, 'plus']);
  rows.push(['Kept', r.kept, '']);
  $('ledger').innerHTML = rows.map(([a, b, k], i) => `<tr class="${i === rows.length - 1 ? 'total' : ''}"><td>${a}</td><td class="${k}">${b}</td></tr>`).join('');
  $('endLine').textContent = daily ? (r.kept >= (save.daily[today] ?? 0) ? 'Best today on this phone!' : `Today's best: ${save.daily[today]}`) : won ? (L.stars && r.stars < 3 ? `${L.stars[r.stars]} for ★${r.stars + 1}` : 'Every star!') : `Need ${L.stars[0]} kept`;
  const board = $('board');
  if (daily) board.innerHTML = save.board.map((e, i) => `<tr class="${e.d === today && e.k === r.kept && e.n === runN ? 'me' : ''}"><td>${i + 1}.</td><td>${e.d.slice(5)}</td><td>${e.k}</td></tr>`).join('');
  else board.innerHTML = '';
  const hasNext = !daily && won && level < LEVELS.length - 1;
  $('next').style.display = hasNext ? '' : 'none';
  $('again').classList.toggle('main', !hasNext);
  $('again').textContent = won ? 'Again' : 'Try again';
  starsAnim = { t: 0, n: daily ? 0 : r.stars, played: 0, show: !daily };
  show('end');
}
const NAME = { strong: 'Strong one', child: 'Child', old: 'Grandma', fast: 'Fast one' };
const grainIcon = () => '';

function pause() {
  if (screen !== 'play' || paused) return;
  paused = true; finger = null; keys.clear(); snd.hold(); show('paused');
}
function resume() {
  if (!paused) return;
  paused = false; acc = 0; last = performance.now(); snd.release(); show('play');
}
$('pause').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pause(); });
$('pause').addEventListener('click', e => { e.preventDefault(); pause(); });
$('resume').addEventListener('click', resume);
$('stopHere').addEventListener('click', () => { paused = false; snd.release(); sim.stop(s); drain(); show('play'); });
$('quit').addEventListener('click', () => {
  paused = false; snd.release();
  if (playing && s) rec.end('left', { level: daily ? 0 : level + 1, daily: daily ? today : null, cart: Math.floor(s.cart.grain), seconds: Math.round(s.t), hired: HELPERS.filter(id => s.helpers[id].ever) });
  playing = false; show('menu');
});
$('play').addEventListener('click', () => { snd.unlock(); begin(levelQ ?? unlocked(), false); });
$('daily').addEventListener('click', () => { snd.unlock(); begin(0, true); });
$('fields').addEventListener('click', () => { snd.unlock(); SFX.tap(); show('levels'); });
$('levelsBack').addEventListener('click', () => show('menu'));
$('next').addEventListener('click', () => { snd.unlock(); begin(level + 1, false); });
$('again').addEventListener('click', () => { snd.unlock(); begin(level, daily); });
$('toMenu').addEventListener('click', () => show('menu'));
for (const id of ['sound1', 'sound2']) $(id).addEventListener('click', () => { save.sound = !save.sound; store(); if (save.sound) { snd.unlock(); snd.release(); SFX.tap(); } show(screen); });
onLeave(pause);

// ---------- the verge: neighbours to hire, and the whetstone
function placeSlots() {
  slots = [];
  if (!s) return;
  const ids = s.L.help.slice(), whet = s.L.stone > 0;
  const n = ids.length + (whet ? 1 : 0); if (!n) return;
  const wide = Math.min(W, 560) - 16, w = Math.min(86, (wide - (n - 1) * 6) / n), h = Math.min(VERGE - 12, 86);
  let x = (W - (n * w + (n - 1) * 6)) / 2; const y = vergeTop + (VERGE - h) / 2 + 2;
  for (const id of ids) { slots.push({ id, x, y, w, h }); x += w + 6; }
  if (whet) slots.push({ id: 'whet', x, y, w, h });
}
function pressSlot(slot) {
  if (slot.id === 'whet') { if (sim.whet(s)) { rec.event('whet', { t: Math.round(s.t) }); } else { SFX.tap(); slot.nope = 0.3; } return; }
  const h = s.helpers[slot.id];
  if (h.hired && clock - (hireGuard[slot.id] ?? -9) < 1) return; // a quick second tap does not send them home
  const out = sim.hire(s, slot.id);
  if (out === 'hired') hireGuard[slot.id] = clock;
  rec.event('hire', { id: slot.id, out, t: Math.round(s.t) });
  slot.pop = 1;
}

// ---------- input: hold and move; the farmer follows the finger
const LIFT = 34; // a finger aims a little above itself so the farmer is not hidden under it
const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
cv.addEventListener('pointerdown', e => {
  if (screen !== 'play' || paused || !playing) return;
  snd.unlock(); lastTouched = clock;
  const p = { x: e.clientX, y: e.clientY };
  const slot = slots.find(r => inside(p, r));
  if (slot) { pressSlot(slot); return; }
  finger = { id: e.pointerId, x: p.x, y: p.y, lift: e.pointerType === 'mouse' ? 0 : LIFT };
  ripple.push({ x: p.x, y: p.y - finger.lift, t: 0 });
  try { cv.setPointerCapture(e.pointerId); } catch {}
});
cv.addEventListener('pointermove', e => { if (finger && e.pointerId === finger.id) { finger.x = e.clientX; finger.y = e.clientY; } });
const lift = e => { if (finger && e.pointerId === finger.id) finger = null; };
cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift); cv.addEventListener('lostpointercapture', lift);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (screen === 'play' && playing) { paused ? resume() : pause(); } else if (paused) resume(); return; }
  if (screen !== 'play' || paused || !playing) return;
  snd.unlock();
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); e.preventDefault(); }
  else if (k === ' ' || k === 'e') { e.preventDefault(); const w = slots.find(r => r.id === 'whet'); if (w) pressSlot(w); }
  else if ('1234'.includes(k)) { const sl = slots.filter(r => r.id !== 'whet')[Number(k) - 1]; if (sl) pressSlot(sl); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function target() {
  if (finger) return { x: (finger.x - ox) / c, y: (finger.y - finger.lift - oy) / c };
  if (keys.size) {
    let dx = 0, dy = 0;
    for (const k of keys) { if (k === 'arrowleft' || k === 'a') dx--; if (k === 'arrowright' || k === 'd') dx++; if (k === 'arrowup' || k === 'w') dy--; if (k === 'arrowdown' || k === 's') dy++; }
    if (dx || dy) return { x: s.me.x + dx * 2, y: s.me.y + dy * 2 };
  }
  return null;
}

// ---------- the loop
function snapshot() {
  const p = { me: { x: s.me.x, y: s.me.y }, h: {}, rainStanding: s.t + DT >= s.L.time ? s.st.map(v => v === STAND) : null };
  for (const id of HELPERS) p.h[id] = { x: s.helpers[id].x, y: s.helpers[id].y };
  for (const k of s.crows) { k.px = k.x; k.py = k.y; }
  return p;
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused) clock += dt;
  if (screen === 'play' && !paused && playing && s) {
    if (!s.over) {
      acc += dt;
      let n = 0;
      while (acc >= DT && n++ < 6 && !s.over) { prev = snapshot(); sim.step(s, target()); acc -= DT; drain(); }
      if (s.me.moving) { bob += dt * 3.2; stepClock += dt; if (stepClock > 0.28) { stepClock = 0; SFX.step(); } }
      if (s.me.cutting) swing += dt * 2.2; else swing *= 0.9;
    }
    if (s.over && !ending) { ending = { t: 0 }; s.result.passed && (daily || s.result.stars) ? (SFX.win(), confetti()) : SFX.lose(); buzz(40); }
    if (ending) { ending.t += dt; if (ending.t > 1.6) { ending = null; finish(); } }
  }
  if (!paused) tick(dt);
  draw(screen === 'play' && !s?.over ? Math.min(1, acc / DT) : 1);
  if (screen === 'end' && starsAnim) drawEndStars(dt);
  requestAnimationFrame(frame);
}

// Events from the rules become sound, particles and shake.
function drain() {
  for (const e of s.ev) {
    const X = sx(e.x ?? 0), Y = sy(e.y ?? 0);
    switch (e.type) {
      case 'cut': SFX.cut(); burst(X, Y, 5, ['#f0c24f', '#ffe08a', '#c9962e'], 70, 'chaff'); break;
      case 'pick': if (e.who === 'me') { SFX.pick(e.n); floats.push({ x: X, y: Y - c * 0.3, text: '+1', t: 0, col: '#fff4dc' }); } break;
      case 'drop': cartBounce = 1; if (e.who === 'me') { SFX.drop(e.n); buzz(12); } else tone(600, 0.08, 0.04, 'triangle'); floats.push({ x: sx(s.cart.x), y: sy(s.cart.y) - c, text: `+${Math.round(e.grain)}`, t: 0, col: '#ffe08a', big: true }); burst(sx(s.cart.x), sy(s.cart.y) - c * 0.3, 10, ['#ffd34d', '#fff4dc'], 120, 'spark'); break;
      case 'crow': SFX.crow(); break;
      case 'scare': SFX.scare(); burst(X, Y, 7, ['#232631', '#3c4352'], 120, 'feather'); break;
      case 'eaten': SFX.eaten(); break;
      case 'stone': SFX.stone(); shake = Math.max(shake, 9); buzz(60); burst(X, Y, 14, ['#ffe08a', '#ffffff', '#f2a93b'], 200, 'spark'); floats.push({ x: X, y: Y - c * 0.6, text: 'Blunt!', t: 0, col: '#ffb3a3', big: true }); break;
      case 'whet': SFX.whet(); break;
      case 'sharp': SFX.sharp(); burst(sx(s.me.x), sy(s.me.y) - c * 0.3, 10, ['#ffffff', '#dfe6ea'], 120, 'spark'); break;
      case 'wind': SFX.wind(); gusts.push({ x: X, y: Y, t: 0 }); shake = Math.max(shake, 3); break;
      case 'hare': SFX.hare(); hares.push({ x: e.x, y: e.y, t: 0, dir: e.x < s.cols / 2 ? -1 : 1 }); floats.push({ x: X, y: Y - c * 0.6, text: 'Oh no!', t: 0, col: '#ffb3a3' }); break;
      case 'hire': SFX.hire(); popSlot(e.id, '#7fd36a'); break;
      case 'refuse': SFX.refuse(); popSlot(e.id, '#d0523f'); shakeSlot(e.id); break;
      case 'home': SFX.home(); popSlot(e.id, '#fff4dc'); break;
      case 'storm': banner = { t: 0, title: 'Rain!', word: 'Uncut wheat is lost' }; SFX.storm(); flash = 1; shake = Math.max(shake, 12); buzz(80); break;
      case 'soak':
        SFX.soak();
        for (let row = 0; row < s.rows; row++) {
          const i = row * s.cols + e.col;
          if (prev?.rainStanding?.[i]) soakedWheat.push({ i, t: 0, flat: s.flat[i] });
        }
        break;
      case 'trample': SFX.trample(); burst(X, Y, 4, ['#94703d', '#c9962e'], 60, 'chaff'); break;
    }
  }
  s.ev.length = 0;
}
function popSlot(id, col) { const sl = slots.find(r => r.id === id); if (sl) { sl.pop = 1; burst(sl.x + sl.w / 2, sl.y + sl.h * 0.35, 10, [col, '#fff4dc'], 140, 'spark'); } }
function shakeSlot(id) { const sl = slots.find(r => r.id === id); if (sl) sl.no = 1; }
function burst(x, y, n, cols, speed, kind) {
  if (calm) n = Math.ceil(n / 3);
  for (let k = 0; k < n; k++) { const a = Math.random() * TAU, v = speed * (0.3 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, life: 0, max: 0.5 + Math.random() * 0.5, col: cols[k % cols.length], kind, rot: Math.random() * TAU, size: 2 + Math.random() * 3 }); }
}
function confetti() { for (let k = 0; k < (calm ? 20 : 80); k++) parts.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.6, y: H * 0.3, vx: (Math.random() - 0.5) * 360, vy: -200 - Math.random() * 300, life: 0, max: 1.8 + Math.random(), col: ['#f0c24f', '#d0523f', '#7fd36a', '#5aa7d6', '#fff4dc'][k % 5], kind: 'confetti', rot: Math.random() * TAU, size: 4 + Math.random() * 4 }); }
function tick(dt) {
  for (const p of parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'feather' ? 60 : p.kind === 'confetti' ? 380 : 300) * dt; p.vx *= p.kind === 'feather' ? 0.96 : 0.99; p.rot += dt * 6; }
  parts = parts.filter(p => p.life < p.max);
  for (const f of floats) f.t += dt; floats = floats.filter(f => f.t < 1);
  for (const r of ripple) r.t += dt; ripple = ripple.filter(r => r.t < 0.5);
  for (const h of hares) h.t += dt; hares = hares.filter(h => h.t < 2);
  for (const q of soakedWheat) q.t += dt;
  for (const q of gusts) q.t += dt; gusts = gusts.filter(q => q.t < 1.6);
  for (const sl of slots) { if (sl.pop) sl.pop = Math.max(0, sl.pop - dt * 3); if (sl.no) sl.no = Math.max(0, sl.no - dt * 2); if (sl.nope) sl.nope = Math.max(0, sl.nope - dt); }
  shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt * 2); cartBounce = Math.max(0, cartBounce - dt * 3);
  if (banner) { banner.t += dt; if (banner.t > 2.4) banner = null; }
}

// ---------- drawing
const lerp = (a, b, t) => a + (b - a) * t;
function draw(alpha) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // the verge
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#93b95f'); bg.addColorStop(1, '#6f9845');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = C.grassDark; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); for (const t of tufts) { g.moveTo(t.x - t.s * 0.6, t.y); g.lineTo(t.x - t.s, t.y - t.s); g.moveTo(t.x, t.y); g.lineTo(t.x, t.y - t.s * 1.3); g.moveTo(t.x + t.s * 0.6, t.y); g.lineTo(t.x + t.s, t.y - t.s); } g.stroke();
  if (!s) return;
  g.save();
  if (shake && !calm) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawField(alpha);
  g.restore();
  drawHud();
  drawVerge();
  // storm darkening, flash, banner
  const left = s.L.time - s.t;
  if (left < 25 || s.t >= s.L.time) { g.fillStyle = `rgba(40,46,64,${Math.min(0.32, (25 - Math.max(0, left)) / 25 * 0.25 + (s.t >= s.L.time ? 0.07 : 0))})`; g.fillRect(0, 0, W, H); }
  if (flash) { g.fillStyle = `rgba(255,255,255,${flash * 0.6})`; g.fillRect(0, 0, W, H); }
  for (const f of floats) { g.globalAlpha = 1 - f.t; text(f.text, f.x, f.y - f.t * 40, f.big ? 20 : 16, f.col); g.globalAlpha = 1; }
  for (const r of ripple) { g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - r.t / 0.5)})`; g.lineWidth = 3; ell(g, r.x, r.y, 10 + r.t * 50, 10 + r.t * 50); g.stroke(); }
  if (banner && screen === 'play') drawBanner();
  for (const p of parts) drawPart(p);
}
function text(t, x, y, size, col = '#fff4dc', align = 'center') {
  g.font = `bold ${size}px ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = Math.max(3, size * 0.22); g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y);
}
function drawPart(p) {
  const k = 1 - p.life / p.max; g.globalAlpha = Math.min(1, k * 2); g.fillStyle = p.col;
  if (p.kind === 'chaff' || p.kind === 'confetti') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7); g.restore(); }
  else if (p.kind === 'feather') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot * 0.3); ell(g, 0, 0, p.size * 1.6, p.size * 0.6); g.fill(); g.restore(); }
  else { ell(g, p.x, p.y, p.size * k, p.size * k); g.fill(); }
  g.globalAlpha = 1;
}

function drawField(alpha) {
  const L = s.L, cols = s.cols, rows = s.rows, t = clock;
  const storm = Math.max(0, 1 - (L.time - s.t) / 25);
  // soil and cut ground
  g.fillStyle = '#00000022'; rrect(g, sx(0) - 4, sy(0) + 5, cols * c + 8, rows * c + 6, c * 0.4); g.fill();
  for (let i = 0; i < cols * rows; i++) {
    const v = s.st[i]; if (v === 0) continue;
    const x = sx(i % cols), y = sy(Math.floor(i / cols));
    g.fillStyle = v === STAND ? C.soil : C.stubble; g.fillRect(x - 0.5, y - 0.5, c + 1, c + 1);
  }
  // pond (ring field): water where the mask has a hole in the middle
  if (L.shape === 'ring') { const r = Math.min(cols, rows) * 0.2 * c; g.fillStyle = '#5aa7d6'; ell(g, sx(cols / 2), sy(rows * 0.45), r * 0.95, r * 0.9); g.fill(); g.strokeStyle = '#3d7fae'; g.lineWidth = 3; g.stroke(); g.strokeStyle = '#ffffff88'; g.lineWidth = 2; g.beginPath(); g.arc(sx(cols / 2) - r * 0.2, sy(rows * 0.45) - r * 0.2, r * 0.4, 3.6, 4.6); g.stroke(); }
  // stubble dots
  g.fillStyle = C.stubbleDot;
  g.beginPath();
  for (let i = 0; i < cols * rows; i++) { const v = s.st[i]; if (v !== LYING && v !== GONE) continue; const x = sx(i % cols), y = sy(Math.floor(i / cols)); for (let k = 0; k < 4; k++) { const e = ears[i][k]; g.moveTo(x + e.x * c + 1.5, y + e.y * c); g.arc(x + e.x * c, y + e.y * c, 1.5, 0, TAU); } }
  g.fill();
  // soaked columns: dark wet ground
  if (s.front > 0) { g.fillStyle = '#4a5a6a55'; g.fillRect(sx(0), sy(0), Math.min(s.front, cols) * c, rows * c); }
  // lying sheaves, all in rows
  for (let i = 0; i < cols * rows; i++) if (s.st[i] === LYING) { const x = sx(i % cols + 0.5), y = sy(Math.floor(i / cols) + 0.5); sheaf(g, x, y, c * 0.8 * (0.6 + 0.4 * s.grain[i]), 0.55); }
  // stones found
  for (const i of s.found) stone(g, sx(i % cols + 0.5), sy(Math.floor(i / cols) + 0.6), c * 0.5);
  // the hare's nest (ears showing)
  if (s.nestAlive && s.nest.length) { const i = s.nest[0]; hare(g, sx(i % cols + 0.5), sy(Math.floor(i / cols) + 0.62), c * 0.75, 0.9 + 0.1 * Math.sin(t * 2), t); }
  // Standing wheat: long stalks, pointed spikelets and awns, never a solid oval.
  const amp = (0.05 + storm * 0.12) * c;
  for (let i = 0; i < cols * rows; i++) {
    if (s.st[i] !== STAND) continue;
    const cx0 = sx(i % cols), cy0 = sy(Math.floor(i / cols)), col = i % cols, row = Math.floor(i / cols), flat = s.flat[i];
    let gust = 0; for (const q of gusts) { const d = Math.hypot(cx0 - q.x, cy0 - q.y) / c; gust += Math.max(0, 1 - Math.abs(d - q.t * 6)) * (1 - q.t / 1.6); }
    const sw = Math.sin(t * 1.7 + col * 0.55 + row * 0.35) * amp + Math.sin(t * 3.1 + col) * amp * 0.3 + gust * c * 0.2;
    for (const e of ears[i]) wheat(g, cx0 + e.x * c, cy0 + (e.y + 0.16) * c, c * 0.68 * e.s, flat ? 1.1 + sw / c * 0.2 : e.a * 0.45 + sw / c - s.prog[i] * 0.6, { storm: storm > 0.6 });
  }
  // Rain hits standing wheat: blue splashes, then bent grey stalks remain on the wet soil.
  for (const q of soakedWheat) {
    const col = q.i % cols, row = Math.floor(q.i / cols), k = calm ? 1 : Math.min(1, q.t / 0.65);
    for (const e of ears[q.i]) wheat(g, sx(col + e.x), sy(row + e.y + 0.16), c * 0.68 * e.s * (1 - k * 0.45), (q.flat ? 1.1 : e.a * 0.45) + k * 0.95, { wet: true });
    if (q.t < 0.65) {
      g.strokeStyle = `rgba(211,242,255,${1 - q.t / 0.65})`; g.lineWidth = 2;
      ell(g, sx(col + 0.5), sy(row + 0.6), c * (0.15 + q.t * 0.6), c * (0.08 + q.t * 0.2)); g.stroke();
    }
  }
  // hares running off
  for (const h of hares) hare(g, sx(h.x + h.dir * h.t * 5), sy(h.y) - Math.abs(Math.sin(h.t * 12)) * c * 0.4, c * 0.75, 1, h.t);
  // the lane and the cart
  const laneY = sy(rows);
  g.fillStyle = '#c8a46a'; rrect(g, sx(0) - 6, laneY + 3, cols * c + 12, LANE * c - 6, c * 0.4); g.fill();
  g.strokeStyle = '#a5834c'; g.lineWidth = 2; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(sx(0), laneY + LANE * c * 0.5); g.lineTo(sx(cols), laneY + LANE * c * 0.5); g.stroke(); g.setLineDash([]);
  const full = s.me.carryN >= sim.limit(s);
  if (full) { const p = 0.5 + 0.5 * Math.sin(clock * 8); g.strokeStyle = `rgba(255,244,220,${0.5 + 0.5 * p})`; g.lineWidth = 4; ell(g, sx(s.cart.x), sy(s.cart.y), c * (1.25 + 0.15 * p), c * (0.9 + 0.1 * p)); g.stroke(); }
  cart(g, sx(s.cart.x), sy(s.cart.y), c, s.cart.grain / Math.max(1, s.total * 0.8), cartBounce);
  // a guide arrow on the first field, and whenever the back is full
  const me = s.me, mx = sx(prev ? lerp(prev.me.x, me.x, alpha) : me.x), my = sy(prev ? lerp(prev.me.y, me.y, alpha) : me.y);
  if (screen === 'play' && (full || (!daily && level === 0 && s.t < 6 && me.carryN === 0 && !finger))) {
    let tx = sx(s.cart.x), ty = sy(s.cart.y) - c * 0.6;
    if (!full) { let best = null, bd = 1e9; for (let i = 0; i < s.st.length; i++) if (s.st[i] === STAND) { const p = sim.center(s, i), d = Math.hypot(p.x - me.x, p.y - me.y); if (d < bd) { bd = d; best = p; } } if (best) { tx = sx(best.x); ty = sy(best.y); } }
    arrow(mx, my, tx, ty);
  }
  // helpers
  for (const id of HELPERS) {
    const h = s.helpers[id]; if (!h.hired) continue;
    const hx = sx(prev ? lerp(prev.h[id].x, h.x, alpha) : h.x), hy = sy(prev ? lerp(prev.h[id].y, h.y, alpha) : h.y);
    const moving = prev && Math.hypot(prev.h[id].x - h.x, prev.h[id].y - h.y) > 1e-3;
    person(g, hx, hy, c * 0.42, id, { bob: moving ? clock * 3 + id.length : 0, face: h.face, scythe: id === 'fast', swing: h.cutting ? clock * 2.6 : 0, sheaves: Math.min(9, h.carryN) });
    if (id === 'old') { const p = (clock * 0.8) % 1; sheaf(g, hx + c * 0.5, hy + c * 0.1, c * 0.6, 0.3 + Math.sin(p * TAU) * 0.2); }
  }
  // the farmer
  const blunt = me.blunt;
  person(g, mx, my, c * 0.42, 'me', { bob: me.moving ? bob : 0, face: me.face, scythe: true, swing, sheaves: me.carryN, tint: null });
  if (me.whet > 0) { const k = 1 - me.whet / sim.WHET_T; whetstone(g, mx + c * 0.6, my - c * 0.5, c * 0.6, true); g.strokeStyle = '#fff4dc'; g.lineWidth = 4; g.beginPath(); g.arc(mx, my - c * 0.9, c * 0.3, -Math.PI / 2, -Math.PI / 2 + k * TAU); g.stroke(); }
  else if (blunt) { const p = 0.5 + 0.5 * Math.sin(clock * 9); text('!', mx + c * 0.45, my - c * 0.95, 20 + p * 4, '#ffb3a3'); }
  // carry pips over the farmer
  const lim = sim.limit(s);
  if (me.carryN) for (let k = 0; k < lim; k++) { g.fillStyle = k < me.carryN ? '#ffd34d' : '#00000040'; g.strokeStyle = C.ink; g.lineWidth = 1.5; ell(g, mx + (k - (lim - 1) / 2) * 9, my - c * 0.95 - 6, 3.6, 3.6); g.fill(); g.stroke(); }
  // where the finger points
  if (finger) { const fx = finger.x, fy = finger.y - finger.lift; g.strokeStyle = '#fff4dccc'; g.lineWidth = 2.5; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(mx, my); g.lineTo(fx, fy); g.stroke(); g.setLineDash([]); ell(g, fx, fy, 9, 9); g.stroke(); }
  // crows
  for (const k of s.crows) { const x = sx(k.px !== undefined ? lerp(k.px, k.x, alpha) : k.x), y = sy(k.py !== undefined ? lerp(k.py, k.y, alpha) : k.y); crow(g, x, y - (k.eating ? 0 : c * 0.4), c * 0.32, clock * 14 + k.flap, k.eating); }
  // rain over soaked columns
  if (s.t >= L.time) {
    const fr = Math.min(cols, (s.t - L.time) / SWEEP * cols);
    g.strokeStyle = '#cfe4f5aa'; g.lineWidth = 1.5; g.beginPath();
    for (let k = 0; k < 120; k++) { const x = sx(hash(k, 9) * fr), y = ((hash(k, 7) * (rows + LANE) * c + clock * 600 * (0.8 + hash(k, 5) * 0.4)) % ((rows + LANE) * c)) + sy(0); g.moveTo(x, y); g.lineTo(x - 3, y + 12); }
    g.stroke();
    // the front
    const fx = sx(fr); g.fillStyle = '#3c435233'; g.fillRect(sx(0), sy(0), fx - sx(0), (rows + LANE) * c);
    // The pale blue edge marks the moving boundary even with reduced motion.
    g.fillStyle = '#b7e9ff77'; g.fillRect(fx - 4, sy(0), 8, rows * c);
    g.strokeStyle = '#e4f7ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, sy(0)); g.lineTo(fx, sy(rows)); g.stroke();
  }
}
function arrow(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0); if (d < c * 1.2) return;
  const a = Math.atan2(y1 - y0, x1 - x0), p = (clock * 1.4) % 1, from = c * 0.8, to = d - c * 0.5;
  g.save(); g.translate(x0, y0); g.rotate(a); g.globalAlpha = 0.85;
  g.strokeStyle = '#fff4dc'; g.lineWidth = 4; g.lineCap = 'round'; g.setLineDash([2, 10]); g.lineDashOffset = -p * 12; g.beginPath(); g.moveTo(from, 0); g.lineTo(to - 8, 0); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#fff4dc'; g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(to + 6, 0); g.lineTo(to - 10, -9); g.lineTo(to - 10, 9); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function drawHud() {
  const L = s.L, { x, y, w, h } = hud;
  // the sky: the morning sun at the right, the storm crossing from the left
  g.save();
  rrect(g, x, y, w, h, h / 2); g.clip();
  const sky = g.createLinearGradient(x, 0, x + w, 0); sky.addColorStop(0, '#bfe3f5'); sky.addColorStop(1, '#ffe6a6');
  g.fillStyle = sky; g.fillRect(x, y, w, h);
  const p = Math.min(1, s.t / L.time), cxs = x + 18 + p * (w - 36);
  g.fillStyle = '#5b6476'; g.fillRect(x, y, cxs - x, h);
  g.strokeStyle = '#cfe4f5'; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k < 14; k++) { const rx = x + ((k * 37 + clock * 50) % Math.max(1, cxs - x)), ry = y + ((k * 13 + clock * 90) % h); g.moveTo(rx, ry); g.lineTo(rx - 2, ry + 6); } g.stroke();
  sun(g, x + w - 18, y + h / 2, 8, clock);
  g.restore();
  g.strokeStyle = C.ink; g.lineWidth = 2.5; rrect(g, x, y, w, h, h / 2); g.stroke();
  cloud(g, cxs, y + h / 2, 18, s.t >= L.time - 10);
  if (s.t >= L.time - 10 && s.t < L.time && Math.sin(clock * 20) > 0.6) { g.strokeStyle = '#ffe36b'; g.lineWidth = 3; g.beginPath(); g.moveTo(cxs, y + h / 2); g.lineTo(cxs - 5, y + h); g.lineTo(cxs + 2, y + h); g.lineTo(cxs - 3, y + h + 10); g.stroke(); }
  // second row: grain in the cart against the need, stars
  const ry = y + h + 6 + 14, cartN = Math.floor(s.cart.grain);
  g.fillStyle = '#fff4dccc'; rrect(g, x, ry - 14, Math.min(w + 56, 230), 28, 14); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
  grain(g, x + 16, ry, 16);
  const need = L.stars ? L.stars[0] : null;
  text(need ? `${cartN} / ${need}` : `${cartN}`, x + 32, ry + 1, 17, cartN >= (need ?? 1e9) ? '#ffe08a' : '#fff4dc', 'left');
  if (L.stars) for (let k = 0; k < 3; k++) star(g, x + 128 + k * 22, ry, 8, cartN >= L.stars[k]);
  const pay = paySoFar(); if (pay) text(`−${pay}`, x + Math.min(w + 56, 230) - 10, ry + 1, 15, '#ffb3a3', 'right');
  if (banner === null && !daily && level === 0 && s.t < 1 && !hadSave) {}
}
function paySoFar() { let p = 0; for (const id of HELPERS) { const h = s.helpers[id]; if (h.worked > 0) p += Math.ceil(HELP[id].price * Math.min(1, h.worked / s.L.time) - 1e-9); } return p; }
function drawVerge() {
  if (!slots.length) return;
  for (const sl of slots) {
    const pop = sl.pop ?? 0, no = sl.no ?? 0;
    g.save(); g.translate(sl.x + sl.w / 2 + Math.sin(no * 30) * no * 6, sl.y + sl.h / 2); g.scale(1 + pop * 0.08, 1 - pop * 0.05);
    const x = -sl.w / 2, y = -sl.h / 2, w = sl.w, h = sl.h;
    if (sl.id === 'whet') {
      const hot = s.me.blunt && !s.me.whet;
      g.fillStyle = '#00000025'; rrect(g, x, y + 4, w, h, 16); g.fill();
      g.fillStyle = hot ? '#fff4dc' : '#e8dcc0'; rrect(g, x, y, w, h, 16); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2.5; g.stroke();
      if (hot) { const p = 0.5 + 0.5 * Math.sin(clock * 9); g.strokeStyle = `rgba(208,82,63,${0.5 + 0.5 * p})`; g.lineWidth = 4; rrect(g, x - 3, y - 3, w + 6, h + 6, 18); g.stroke(); }
      whetstone(g, 0, -h * 0.08, Math.min(w, h) * 0.62, hot);
      if (s.me.whet > 0) { g.strokeStyle = '#3f7d2c'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, Math.min(w, h) * 0.42, -Math.PI / 2, -Math.PI / 2 + (1 - s.me.whet / sim.WHET_T) * TAU); g.stroke(); }
      g.globalAlpha = hot ? 1 : 0.5; text('Sharpen', 0, h * 0.34, 14, '#fff4dc'); g.globalAlpha = 1;
      g.restore(); continue;
    }
    const hlp = s.helpers[sl.id], working = hlp.hired, gone = hlp.gone, refused = RIVAL[sl.id] && s.helpers[RIVAL[sl.id]].ever && !hlp.ever;
    g.globalAlpha = gone || refused ? 0.6 : 1;
    g.fillStyle = '#00000025'; rrect(g, x, y + 4, w, h, 16); g.fill();
    g.fillStyle = working ? '#d8f0c4' : '#fff4dc'; rrect(g, x, y, w, h, 16); g.fill(); g.strokeStyle = working ? '#3f7d2c' : C.ink; g.lineWidth = working ? 3.5 : 2.5; g.stroke();
    if (working) {
      // at work in the field: show what they do, and the pay so far
      job(g, sl.id, 0, -h * 0.12, Math.min(w, h) * 0.5);
      const paid = Math.ceil(HELP[sl.id].price * Math.min(1, hlp.worked / s.L.time) - 1e-9);
      grain(g, -w * 0.18, h * 0.3, 14); text(`−${paid}`, w * 0.08, h * 0.31, 15, '#ffb3a3');
    } else {
      person(g, -w * 0.13, h * 0.14, Math.min(w, h) * 0.2, sl.id, { bob: gone ? 0 : clock * 0.6 + sl.x, face: Math.PI / 2 });
      if (!gone) {
        // the price bubble: grain icons and the number, with their reason beside it
        const bw = w * 0.86, bh = 24, by = y + 4;
        g.fillStyle = refused ? '#f6c3b8' : '#ffffff'; rrect(g, -bw / 2, by, bw, bh, 12); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke();
        g.beginPath(); g.moveTo(-5, by + bh - 1); g.lineTo(0, by + bh + 6); g.lineTo(5, by + bh - 1); g.fillStyle = refused ? '#f6c3b8' : '#ffffff'; g.fill();
        if (refused) { person(g, -bw * 0.15, by + bh / 2 + 3, 8, RIVAL[sl.id], { face: Math.PI / 2 }); g.strokeStyle = C.red; g.lineWidth = 3; g.beginPath(); g.moveTo(-bw * 0.15 - 9, by + 3); g.lineTo(-bw * 0.15 + 9, by + bh - 3); g.moveTo(-bw * 0.15 + 9, by + 3); g.lineTo(-bw * 0.15 - 9, by + bh - 3); g.stroke(); }
        else { grain(g, -9, by + bh / 2, 15); text(`${HELP[sl.id].price}`, 1, by + bh / 2 + 1, 15, '#ffe08a', 'left'); }
        // their reason, by picture only, beside them
        reason(g, sl.id, w * 0.3, h * 0.2, Math.min(22, w * 0.28));
      } else { text('home', 0, -h * 0.25, 14, '#fff4dc'); }
    }
    g.globalAlpha = 1;
    g.restore();
  }
}
function drawBanner() {
  const b = banner, k = Math.min(1, b.t * 4) * Math.min(1, (2.4 - b.t) * 3), y = H * 0.4;
  g.save(); g.globalAlpha = Math.max(0, k); g.translate(W / 2, y); g.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
  g.fillStyle = '#3b2a1acc'; rrect(g, -150, -42, 300, 84, 22); g.fill();
  text(b.title, 0, -14, 26, '#f0c24f'); text(b.word, 0, 18, 18, '#fff4dc');
  g.restore();
}

// ---------- the title picture and the end stars
let starsAnim = null;
function drawHero() {
  const el = $('hero'), w = el.clientWidth || 300, h = el.clientHeight || 110, r = Math.min(2, devicePixelRatio || 1);
  el.width = w * r; el.height = h * r; const q = el.getContext('2d'); q.setTransform(r, 0, 0, r, 0, 0);
  const sky = q.createLinearGradient(0, 0, w, 0); sky.addColorStop(0, '#6d7688'); sky.addColorStop(0.35, '#bfe3f5'); sky.addColorStop(1, '#ffe6a6');
  q.fillStyle = sky; rrect(q, 0, 0, w, h, 18); q.fill();
  cloud(q, w * 0.18, h * 0.3, 26, true); sun(q, w * 0.86, h * 0.28, 12, 0);
  q.fillStyle = C.wheat; rrect(q, 0, h * 0.55, w, h * 0.45, 0); q.fill();
  for (let k = 0; k < 30; k++) wheat(q, (k + 0.5) * w / 30, h * 0.88 + (k % 3) * 4, 33 + (k % 4) * 3, (k % 3 - 1) * 0.12);
  cart(q, w * 0.22, h * 0.78, 20, 0.7); person(q, w * 0.55, h * 0.72, 16, 'me', { scythe: true, face: 0.3, swing: 0.2, sheaves: 2 }); person(q, w * 0.75, h * 0.78, 13, 'child', { face: 2.6 });
  crow(q, w * 0.4, h * 0.25, 9, 1, false);
}
function drawEndStars(dt) {
  const el = $('endStars'), a = starsAnim; if (!a.show) { el.style.display = 'none'; return; } el.style.display = '';
  a.t += dt;
  const w = 210, h = 66, r = Math.min(2, devicePixelRatio || 1);
  if (el.width !== w * r) { el.width = w * r; el.height = h * r; }
  const q = el.getContext('2d'); q.setTransform(r, 0, 0, r, 0, 0); q.clearRect(0, 0, w, h);
  for (let k = 0; k < 3; k++) {
    const on = k < a.n && a.t > 0.3 + k * 0.35, since = a.t - 0.3 - k * 0.35;
    if (on && a.played <= k) { a.played = k + 1; SFX.star(k); }
    const sc = on ? 1 + Math.max(0, 0.5 - since) * 1.2 : 1;
    q.save(); q.translate(w / 2 + (k - 1) * 66, h / 2 + (k === 1 ? -4 : 4)); q.scale(sc, sc); star(q, 0, 0, 24, on); q.restore();
  }
}

// ---------- for browser checks: a picture of the state
window.harvestState = () => ({
  screen, paused, playing, level: level + 1, daily, today, t: s ? s.t : 0, time: s ? s.L.time : 0, over: s ? s.over : false, result: s?.result ?? null,
  me: s ? { x: s.me.x, y: s.me.y, carryN: s.me.carryN, blunt: s.me.blunt, whet: s.me.whet } : null,
  cart: s ? Math.floor(s.cart.grain) : 0, need: s?.L.stars ? s.L.stars[0] : null, cols: s?.cols, rows: s?.rows,
  view: { ox, oy, c, lift: LIFT, W, H, vergeTop, st, sb },
  slots: slots.map(r => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h })),
  helpers: s ? Object.fromEntries(HELPERS.map(id => [id, { hired: s.helpers[id].hired, ever: s.helpers[id].ever, gone: s.helpers[id].gone }])) : {},
  minTouch: slots.length ? Math.min(...slots.map(r => Math.min(r.w, r.h))) : null,
  stars: save.stars.slice(), best: save.best.slice(), board: save.board.slice(), dailyBest: save.daily[today] ?? null, sound: save.sound, runs: save.runs,
  hint: !!document.querySelector('.kit-hint.on'), finger: !!finger, parts: parts.length, rainWheat: soakedWheat.length,
});
window.harvestSim = () => s;

// First-time help: after 3 s of play with no touch, a see-through finger presses, holds and moves (kit/hint.js).
hint(cv, {
  kind: 'hold-and-move',
  key: 'harvest:hint',
  label: 'Hold your finger down and move: the farmer follows',
  bottom: () => VERGE + 70,
  when: () => screen === 'play' && playing && !paused && !!s && !s.over,
  played: hadSave,
});

layout(); demo(); menu();
requestAnimationFrame(frame);
