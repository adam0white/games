// Lantern Duet page: input, sound, cards and drawing. The rules live in sim.js.
import { create, step, centre, half, fall, progress, speed, DT, NIGHTS, BOAT } from './sim.js';
import { hull, wake, reeds } from '../../lantern/looks.js';
import { sound } from '../../kit/audio.js';
import { drag } from '../../kit/drag.js';
import { hint } from '../../kit/hint.js';
import { screens } from '../../kit/screens.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { readJson, writeJson } from '../../kit/save.js';

const SAVE_KEY = 'lantern-duet:v1';
const HINT_KEY = 'lantern-duet:hint';

// Framing. The camera follows the river and zooms so the river ahead always shows for SHOW_AHEAD seconds.
const BOAT_ROW = 0.8; // the boats' row, as a share of the screen height from the top
const HUD_PX = 60; // screen px at the top that the HUD covers
const VIEW_WIDTH = 0.8; // river units across the screen at the closest zoom
const SHOW_AHEAD = 1.35; // seconds of river shown above the boats, below the HUD
const MIN_AHEAD = 0.95; // river units always shown above the boats
const GAIN = 1.3; // river units a boat moves for one screen unit of finger travel
const KEY_STEP = 0.08; // river units ahead of a boat that a held key aims

// Look.
const BANK = '#0e1a12';
const WATER = '#173a63';
const EDGE = '#5c8468';
const DARK = 0.8; // darkness away from the lanterns, 0 to 1
const ROPE = '226,184,116';
const WARN = '255,138,74';
const HULL_COLOUR = ['#a0764e', '#8a6a4e'];
const FIRE = '255,190,110';

const $ = id => document.getElementById(id);
const canvas = $('c'), g = canvas.getContext('2d');
const shade = document.createElement('canvas'), sg = shade.getContext('2d');
const show = screens(['menu', 'card']);

const saved = readJson(SAVE_KEY, null);
const save = { best: { night: 0, pct: 0 }, unlocked: 1, sound: true, ...(saved || {}) };
const store = () => writeJson(SAVE_KEY, save);

let s = create(1);
let night = 1;
let playing = false, paused = false;
let target = [s.left, s.right];
let last = 0, acc = 0, sayUntil = 0, ended = 0, saidEmber = false;
let W = 0, H = 0, dpr = 1, unit = 400, camX = 0.5;
let hudText = '';
const keys = new Set();
const snd = sound({ on: () => save.sound });
noZoom();

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  shade.width = Math.ceil(W / 2);
  shade.height = Math.ceil(H / 2);
}
addEventListener('resize', resize);
resize();

// ---- Camera ----

const aheadPx = () => H * BOAT_ROW - HUD_PX;

// Speed without the waterfall's surge: nothing lies in or just after a waterfall, so the zoom stays calm there.
const cruise = () => speed(s) / (1 + 0.7 * fall(s, s.y));

function camera() {
  const need = Math.max(MIN_AHEAD, cruise() * SHOW_AHEAD);
  unit = Math.min(W / VIEW_WIDTH, aheadPx() / need);
  // Centre on the middle of both banks' extent over the visible stretch, so both banks stay on screen.
  const lo = s.y - (H - H * BOAT_ROW) / unit, hi = s.y + aheadPx() / unit;
  let a = Infinity, b = -Infinity;
  for (let y = lo; y <= hi + 0.05; y += 0.05) {
    const c = centre(s, y), h = half(s, y);
    a = Math.min(a, c - h);
    b = Math.max(b, c + h);
  }
  const room = W / 2 / unit - 0.03;
  camX = Math.max(s.right - room, Math.min(s.left + room, (a + b) / 2));
}

const sx = x => W / 2 + (x - camX) * unit;
const sy = y => H * BOAT_ROW - (y - s.y) * unit;

// ---- Words and sound ----

function say(text, ms = 2000) {
  $('say').textContent = text;
  sayUntil = performance.now() + ms;
}

const LINES = {
  warn: 'Rock between the boats! Both to one side.',
  narrow: 'Narrows ahead: bring the boats together.',
  snag: 'Snagged! Pull both boats past one side!',
  free: 'Rope freed.',
  snap: 'The snag cost a heart.',
  hurt: 'A shared heart lost.',
  hit: 'The boats cannot go on.',
  out: 'The flame went out.',
  dawn: 'Dawn. Both boats made it.',
};

function noise(event) {
  if (event === 'ember') snd.tone(660 + 60 * Math.random(), 0.12, 0.06, 'triangle');
  else if (event === 'warn') snd.tone(440, 0.22, 0.07, 'square', 440); // a short rising warning
  else if (event === 'narrow') snd.tone(330, 0.22, 0.06, 'square', 330);
  else if (event === 'snag') snd.tone(220, 0.45, 0.08, 'sawtooth');
  else if (event === 'free') snd.tone(880, 0.15, 0.07, 'triangle', 220);
  else if (event === 'snap' || event === 'hurt') snd.noise(0.2, 0.18, 900);
  else if (event === 'dawn') [523, 659, 784].forEach((f, i) => setTimeout(() => snd.tone(f, 0.6, 0.06, 'sine'), i * 140));
  else if (event === 'out' || event === 'hit') snd.tone(160, 0.6, 0.08, 'sine', -80);
}

function soundLabel() {
  const text = save.sound ? 'Sound on' : 'Sound off';
  $('sound').textContent = text;
  $('sound2').textContent = text;
}
function toggleSound() {
  save.sound = !save.sound;
  store();
  if (save.sound) {
    snd.unlock();
    if (!paused) snd.release();
  }
  soundLabel();
}
$('sound').onclick = toggleSound;
$('sound2').onclick = toggleSound;
soundLabel();

// ---- Runs, pause and cards ----

function begin(n = 1, seed = (Math.random() * 2 ** 32) >>> 0) {
  night = n;
  s = create(seed, night);
  target = [s.left, s.right];
  playing = true;
  paused = false;
  saidEmber = false;
  acc = 0;
  last = performance.now();
  steer.forEach(a => a.reset());
  show('play');
  snd.unlock();
  snd.release();
  say(night === 1 ? 'Spread for embers. Gather for rocks.' : `Night ${night}: the river runs faster.`, 3000);
}

function pause() {
  if (!playing || paused) return;
  paused = true;
  keys.clear();
  steer.forEach(a => a.drop());
  snd.hold();
  $('title').textContent = 'Paused';
  $('line').textContent = 'Two boats. One flame.';
  $('sub').textContent = '';
  $('go').textContent = 'Go on';
  show('card');
}

function resume() {
  paused = false;
  acc = 0;
  last = performance.now();
  target = [s.left, s.right];
  snd.release();
  show('play');
}

function bestText() {
  const b = save.best;
  return b.night ? `Best: night ${b.night}, ${b.pct}% to dawn` : '';
}

function menu() {
  playing = false;
  paused = false;
  $('best').textContent = bestText();
  const list = $('nights');
  list.textContent = '';
  for (let n = 2; n <= Math.min(NIGHTS, save.unlocked); n++) {
    const b = document.createElement('button');
    b.textContent = `Night ${n}`;
    b.onclick = () => begin(n);
    list.append(b);
  }
  show('menu');
}

function finish() {
  playing = false;
  ended = performance.now();
  steer.forEach(a => a.drop());
  const pct = Math.floor(progress(s) * 100);
  const b = save.best;
  if (night > b.night || (night === b.night && pct > b.pct)) save.best = { night, pct };
  if (s.over === 'dawn') save.unlocked = Math.max(save.unlocked, Math.min(NIGHTS, night + 1));
  store();
  const won = s.over === 'dawn';
  $('title').textContent = won ? `Dawn, night ${night}` : 'Night ended';
  $('line').textContent = `${pct}% to dawn · ${s.taken} embers · ${s.snags} snags`;
  $('sub').textContent = won && night === NIGHTS ? 'All three nights. Both boats made it home.' : bestText();
  $('go').textContent = won ? (night < NIGHTS ? `Night ${night + 1}` : 'Play again') : 'Try again';
  setTimeout(() => { if (!playing) show('card'); }, won ? 1200 : 500);
}

$('play').onclick = () => begin(1);
$('go').onclick = () => {
  if (paused) return resume();
  const next = s.over === 'dawn' && night < NIGHTS ? night + 1 : s.over === 'dawn' ? 1 : night;
  begin(next);
};
$('home').onclick = menu;
$('pause').onclick = pause;
onLeave(pause);

// ---- Input: each half of the screen steers its own boat by relative drag ----

const clampToRiver = x => Math.max(centre(s, s.y) - half(s, s.y), Math.min(centre(s, s.y) + half(s, s.y), x));
const steer = ['left', 'right'].map((id, i) => drag($(id), {
  playing: () => playing,
  paused: () => paused,
  resume,
  from: () => (i ? s.right : s.left),
  travel: dx => dx / unit * GAIN,
  aim: x => { target[i] = clampToRiver(x); },
  mouse: e => { if (e.buttons) target[i] = clampToRiver(camX + (e.clientX - W / 2) / unit); },
  settle: 12,
}));

const help = hint($('left'), {
  kind: 'drag', key: HINT_KEY, delay: 2000, bottom: 70, played: !!(saved && saved.best && saved.best.night),
  when: () => playing && !paused, label: 'Drag each half with one thumb',
});
$('right').addEventListener('pointerdown', () => { if (playing && !paused) help.done(); });

addEventListener('keydown', e => {
  if (isPauseKey(e)) {
    if (paused) resume();
    else pause();
    return;
  }
  const key = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
    e.preventDefault();
    keys.add(key);
  }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

// ---- Fixed-step loop ----

function tick() {
  for (const [i, minus, plus] of [[0, 'a', 'd'], [1, 'arrowleft', 'arrowright']]) {
    const at = i ? s.right : s.left;
    if (keys.has(minus)) target[i] = at - KEY_STEP;
    if (keys.has(plus)) target[i] = at + KEY_STEP;
  }
  step(s, target);
  if (s.events.includes('hurt')) {
    target = [s.left, s.right];
    steer.forEach(a => a.rebase());
  }
  for (const event of s.events) {
    noise(event);
    if (event === 'ember' && !saidEmber) {
      saidEmber = true;
      say('The rope caught warmth.');
    } else if (LINES[event]) say(LINES[event]);
  }
  if (s.over) finish();
}

function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  if (playing && !paused) {
    while (acc >= DT && playing) {
      tick();
      acc -= DT;
    }
  } else acc = 0;
  draw(now);
  requestAnimationFrame(frame);
}

// ---- Drawing ----

function draw(now) {
  camera();
  const t = now / 1000;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lo = s.y - (H - H * BOAT_ROW) / unit - 0.1, hi = s.y + H * BOAT_ROW / unit + 0.1;
  const dawn = Math.max(0, (progress(s) - 0.9) / 0.1);

  g.fillStyle = BANK;
  g.fillRect(0, 0, W, H);
  riverShape(lo, hi);
  g.fillStyle = WATER;
  g.fill();
  reeds(g, (y, side) => sx(centre(s, y) + side * half(s, y)), sy, unit, lo, hi, t);
  streaks(lo, hi, t);
  waterfall(lo, hi, now);
  for (const k of s.rocks) if (k.y > lo && k.y < hi) rockBody(k);

  darkness(dawn);

  // Above the dark: the banks' edge, rock rims and embers stay readable all the way up the screen.
  riverShape(lo, hi);
  g.strokeStyle = EDGE;
  g.globalAlpha = 0.55;
  g.lineWidth = 2;
  g.stroke();
  g.globalAlpha = 1;
  if (s.tight) narrowWarning(s.tight, t);
  for (const k of s.rocks) if (k.y > lo && k.y < hi) rockRim(k, t);
  embers(lo, hi, t);
  rope(t);
  boats(t);
  hud();
  $('pause').hidden = !playing || paused;
  $('labels').hidden = !playing;
  if (now > sayUntil) $('say').textContent = '';
}

function riverShape(lo, hi) {
  g.beginPath();
  for (let y = lo; y <= hi; y += 0.04) g.lineTo(sx(centre(s, y) - half(s, y)), sy(y));
  for (let y = hi; y >= lo; y -= 0.04) g.lineTo(sx(centre(s, y) + half(s, y)), sy(y));
  g.closePath();
}

function streaks(lo, hi, t) {
  g.strokeStyle = '#5a95cc';
  g.lineWidth = 1.5;
  g.globalAlpha = 0.35;
  g.beginPath();
  for (let i = Math.floor(lo * 4); i < hi * 4; i++) {
    const y = i / 4, k = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1), c = centre(s, y), h = half(s, y);
    const x = c + (k * 2 - 1) * (h - 0.03);
    g.moveTo(sx(x), sy(y));
    g.lineTo(sx(x + centre(s, y + 0.12) - c), sy(y + 0.12));
  }
  g.stroke();
  g.globalAlpha = 1;
}

function waterfall(lo, hi, now) {
  g.strokeStyle = '#eaf6ff';
  g.lineWidth = 3;
  for (let i = Math.floor(lo * 14); i < hi * 14; i++) {
    const y = i / 14 - (now / 260 % 1) / 14, f = fall(s, y);
    if (f <= 0) continue;
    const c = centre(s, y), h = half(s, y) - 0.01;
    g.globalAlpha = 0.15 + 0.5 * f;
    g.beginPath();
    g.moveTo(sx(c - h), sy(y));
    for (let j = 1; j <= 8; j++) g.lineTo(sx(c - h + 2 * h * j / 8), sy(y + 0.012 * Math.sin(j * 2.1 + i)));
    g.stroke();
  }
  g.globalAlpha = 1;
}

function rockBody(k) {
  const x = sx(k.x), y = sy(k.y), r = k.rad * unit;
  g.fillStyle = '#2b3a44';
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  g.fill();
  g.fillStyle = '#4a5c68';
  g.beginPath();
  g.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, 7);
  g.fill();
}

// The dark, drawn at half resolution, with a hole of light round each lantern.
function darkness(dawn) {
  const k = shade.width / W, dark = DARK * (1 - 0.7 * dawn);
  sg.globalCompositeOperation = 'source-over';
  sg.clearRect(0, 0, shade.width, shade.height);
  sg.fillStyle = `rgba(3,5,10,${dark})`;
  sg.fillRect(0, 0, shade.width, shade.height);
  sg.globalCompositeOperation = 'destination-out';
  const r = (0.16 + 0.2 * s.light) * unit * k;
  for (const x of [s.left, s.right]) {
    const bx = sx(x) * k, by = sy(s.y) * k - r * 0.25;
    const m = sg.createRadialGradient(bx, by, r * 0.15, bx, by, r);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(0.6, 'rgba(0,0,0,.55)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = m;
    sg.fillRect(bx - r, by - r, 2 * r, 2 * r);
  }
  g.drawImage(shade, 0, 0, W, H);
}

// A rock's outline. A rock the rope is about to catch is outlined in the warning colour; a snagged one flashes.
function rockRim(k, t) {
  const x = sx(k.x), y = sy(k.y), r = k.rad * unit;
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  if (k === s.snag) {
    g.strokeStyle = Math.sin(t * 30) > 0 ? '#ff5a4a' : '#ffe2b5';
    g.lineWidth = 4;
  } else if (k === s.danger) {
    g.strokeStyle = `rgba(${WARN},${0.75 + 0.25 * Math.sin(t * 14)})`;
    g.lineWidth = 3.5;
    g.stroke();
    g.beginPath();
    g.arc(x, y, r + 6 + 2 * Math.sin(t * 14), 0, 7);
    g.lineWidth = 1.5;
  } else {
    g.strokeStyle = k.spent ? 'rgba(159,180,194,.25)' : 'rgba(170,192,206,.7)';
    g.lineWidth = 1.5;
  }
  g.stroke();
}

function narrowWarning(n, t) {
  g.strokeStyle = `rgba(${WARN},${0.55 + 0.3 * Math.sin(t * 12)})`;
  g.lineWidth = 3;
  for (const side of [-1, 1]) {
    g.beginPath();
    for (let y = n.y0 - 0.6; y <= n.y1 + 0.6; y += 0.04) g.lineTo(sx(centre(s, y) + side * half(s, y)), sy(y));
    g.stroke();
  }
}

function embers(lo, hi, t) {
  g.globalCompositeOperation = 'lighter';
  for (const e of s.embers) {
    if (e.got || e.y < lo || e.y > hi) continue;
    const x = sx(e.x), y = sy(e.y) + Math.sin(t * 3 + e.y * 9) * 1.5, r = 0.035 * unit;
    const m = g.createRadialGradient(x, y, 0, x, y, r);
    m.addColorStop(0, 'rgba(255,210,140,.9)');
    m.addColorStop(0.3, 'rgba(255,150,60,.45)');
    m.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = m;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#fff1d0';
  for (const e of s.embers) {
    if (e.got || e.y < lo || e.y > hi) continue;
    g.beginPath();
    g.arc(sx(e.x), sy(e.y) + Math.sin(t * 3 + e.y * 9) * 1.5, Math.max(2, 0.007 * unit), 0, 7);
    g.fill();
  }
}

// The rope of light: amber when slack, the warning colour when a rock ahead lies between the boats
// or a narrow reach is too tight for it, and flashing while snagged.
function rope(t) {
  const y = sy(s.y) - 0.007 * unit;
  const path = () => {
    g.beginPath();
    g.moveTo(sx(s.left), y);
    if (s.snag) g.lineTo(sx(s.snag.x), sy(s.snag.y));
    g.lineTo(sx(s.right), y);
  };
  let colour = `rgba(${ROPE},.85)`, width = 2;
  if (s.snag) {
    colour = Math.sin(t * 35) > 0 ? '#ff5a4a' : '#ffe2b5';
    width = 3.5;
  } else if (s.danger || s.tight) {
    colour = `rgba(${WARN},${0.8 + 0.2 * Math.sin(t * 14)})`;
    width = 3;
  }
  path();
  g.strokeStyle = s.snag || s.danger || s.tight ? `rgba(${WARN},.25)` : `rgba(${ROPE},.18)`;
  g.lineWidth = width + 6;
  g.stroke();
  path();
  g.strokeStyle = colour;
  g.lineWidth = width;
  g.stroke();
}

function boats(t) {
  for (const [i, x] of [s.left, s.right].entries()) {
    const bx = sx(x), by = sy(s.y);
    g.save();
    g.translate(bx, by);
    const lean = Math.max(-0.25, Math.min(0.25, (target[i] - x) * 3));
    g.rotate(lean);
    if (playing) wake(g, unit, t + i * 0.37);
    const flash = s.safe && Math.sin(s.t * 30) > 0;
    hull(g, 'oak', unit, flash ? '#ddc6a4' : HULL_COLOUR[i], t);
    g.restore();
    // The lantern and its warm wash.
    g.globalCompositeOperation = 'lighter';
    const r = (0.05 + 0.05 * s.light) * unit, m = g.createRadialGradient(bx, by, 0, bx, by, r);
    m.addColorStop(0, `rgba(${FIRE},${0.35 + 0.3 * s.light})`);
    m.addColorStop(1, `rgba(${FIRE},0)`);
    g.fillStyle = m;
    g.fillRect(bx - r, by - r, 2 * r, 2 * r);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#fff0c8';
    g.beginPath();
    g.arc(bx, by, Math.max(2.5, 0.006 * unit), 0, 7);
    g.fill();
  }
}

function hud() {
  const pct = Math.floor(progress(s) * 100);
  const text = `${'♥'.repeat(s.hearts)}${'♡'.repeat(3 - s.hearts)}  Night ${night} · ${pct}% · ${s.taken} embers`;
  if (text !== hudText) {
    $('status').textContent = text;
    hudText = text;
  }
  $('fill').style.width = `${Math.round(s.light * 100)}%`;
}

requestAnimationFrame(frame);
menu();

// ---- Test hooks ----

window.lanternState = () => ({
  x: s.x, y: s.y, t: s.t, over: s.over, playing, paused, night, hearts: s.hearts, light: s.light,
  taken: s.taken, snags: s.snags, left: s.left, right: s.right, target: [...target],
  danger: !!s.danger, tight: !!s.tight, snag: !!s.snag, sound: save.sound,
  unit, camX, W, H, secondsAhead: aheadPx() / unit / cruise(),
});
window.lanternSim = () => s;
window.lanternStart = (n, seed) => begin(n, seed);
window.lanternAim = (left, right) => { target = [left, right]; };
window.lanternProject = (x, y) => [sx(x), sy(y)];
window.lanternBoat = BOAT;
