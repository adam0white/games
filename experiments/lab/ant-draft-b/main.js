// Ant Draft (lab page): drawing, input, sound and cards. The rules are in sim.js.
import { create, step, choose, plan, W, H, DT, WAVES, NEST, LINE, FOES, CARDS } from './sim.js';
import { read, write, readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { noZoom } from '../../kit/zoom.js'; noZoom();

const $ = id => document.getElementById(id);
const timers = new Set();
function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
function clearTimers() { for (const id of timers) clearTimeout(id); timers.clear(); }
const cv = $('c'), g = cv.getContext('2d');
const Q = new URLSearchParams(location.search);
const SPEED = Math.max(1, Math.min(8, Number(Q.get('speed')) || 1)); // test hook: run the rules faster (check.mjs)
const KEY = 'ant-draft-b:save';
let save = readJson(KEY, null);
const played = save !== null;
save = { best: 0, bestWave: 0, sound: true, daily: null, ...(save || {}) };
const store = () => writeJson(KEY, save);

// ---------- sound
const snd = sound({ on: () => save.sound, floor: 0.001 });
const blip = (f, d = 0.08, type = 'sine', v = 0.1, slide = 0) => snd.tone(f, d, v, type, slide);
let lastBite = 0;
const sfx = {
  bite() { const n = performance.now(); if (n - lastBite < 90) return; lastBite = n; blip(700 + Math.random() * 300, 0.03, 'square', 0.025); },
  kill(kind) { snd.noise(kind === 'spider' ? 0.4 : 0.09, kind === 'beetle' || kind === 'spider' ? 0.18 : 0.1, kind === 'wasp' ? 3000 : 1400); blip(kind === 'spider' ? 160 : 520 + Math.random() * 120, 0.12, 'triangle', 0.08, kind === 'spider' ? -80 : 300); },
  die() { blip(300, 0.1, 'sine', 0.05, -150); },
  nest(h) { blip(110, 0.25, 'sawtooth', 0.09 + h * 0.02, -50); snd.noise(0.15, 0.12, 500); },
  hatch() { blip(660, 0.06, 'sine', 0.07, 400); later(() => blip(990, 0.06, 'sine', 0.05), 50); },
  pickup() { blip(1200, 0.03, 'triangle', 0.03); },
  deliver() { blip(880, 0.05, 'triangle', 0.04, 200); },
  split() { blip(500, 0.08, 'square', 0.04, 500); },
  wave() { blip(330, 0.18, 'triangle', 0.08); later(() => blip(440, 0.25, 'triangle', 0.08), 140); },
  cleared() { [523, 659, 784].forEach((f, i) => later(() => blip(f, 0.18, 'triangle', 0.09), i * 90)); },
  deal(i) { later(() => { snd.noise(0.06, 0.05, 4000); blip(400 + i * 120, 0.06, 'sine', 0.05, 200); }, i * 110); },
  pick() { [392, 523, 659, 1046].forEach((f, i) => later(() => blip(f, 0.3, 'triangle', 0.08), i * 60)); },
  won() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => later(() => blip(f, 0.25, 'triangle', 0.1), i * 120)); },
  lost() { [392, 330, 262, 196].forEach((f, i) => later(() => blip(f, 0.3, 'sawtooth', 0.06), i * 160)); },
  tap() { blip(880, 0.04, 'sine', 0.05); },
};
const buzz = ms => { try { if (save.sound) navigator.vibrate?.(ms); } catch {} };

// ---------- layout: the arena (360 x 600) fits the screen, centred, the bottom mound on the bottom edge
let vw = 0, vh = 0, dpr = 1, sc = 1, ox = 0, oy = 0, safeTop = 0, safeBot = 0;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); vw = innerWidth; vh = innerHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  const pr = getComputedStyle($('probe')); safeTop = parseFloat(pr.paddingTop) || 0; safeBot = parseFloat(pr.paddingBottom) || 0;
  const top = safeTop + 58, bot = safeBot + 4;
  sc = Math.min(vw / W, (vh - top - bot) / H);
  ox = (vw - W * sc) / 2; oy = top + (vh - top - bot - H * sc);
  ground = null;
}
addEventListener('resize', resize);

// ---------- palette and art
const COL = { grass: '#6fa558', grass2: '#64994e', soil: '#8a5a32', soil2: '#6e4526', ant: '#2b1d16', antHi: '#5a3a2a', worker: '#7a4a2a', guard: '#9a2a1c', gold: '#ffe08a', acid: '#7dff4a' };
const CARD_COL = { split: '#ff8a5a', haul: '#ffd23a', scout: '#5ad0ff', acid: '#7dff4a', guard: '#ff5a6a', jaws: '#ffb42a', shell: '#a8c8ff', brood: '#ffd9f0', swift: '#5affc8', honey: '#ffb42a' };
const FOE_COL = { termite: '#f2e2c0', beetle: '#2a6a7a', wasp: '#ffd23a', spider: '#3a2a44' };

function ant(g, x, y, dir, size, body, ph, squash = 0) {
  g.save(); g.translate(x, y); g.rotate(dir); g.scale(1 + squash * 0.3, 1 - squash * 0.25);
  g.strokeStyle = body; g.lineWidth = Math.max(0.8, size * 0.22); g.lineCap = 'round';
  for (let i = -1; i <= 1; i++) for (const sd of [-1, 1]) {
    const w = Math.sin(ph + i * 2 + (sd > 0 ? 3.14 : 0)) * size * 0.35;
    g.beginPath(); g.moveTo(i * size * 0.4, 0); g.lineTo(i * size * 0.5 + w, sd * size * 1.1); g.stroke();
  }
  g.fillStyle = '#0003'; g.beginPath(); g.ellipse(0.5, size * 0.5, size * 1.6, size * 0.6, 0, 0, 7); g.fill();
  g.fillStyle = body;
  g.beginPath(); g.ellipse(-size * 0.95, 0, size * 0.75, size * 0.58, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(0, 0, size * 0.42, size * 0.33, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(size * 0.75, 0, size * 0.48, size * 0.45, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(size, -size * 0.2); g.lineTo(size * 1.6, -size * 0.6); g.moveTo(size, size * 0.2); g.lineTo(size * 1.6, size * 0.6); g.stroke();
  g.fillStyle = '#ffffff40'; g.beginPath(); g.ellipse(-size * 1.05, -size * 0.2, size * 0.3, size * 0.16, 0, 0, 7); g.fill();
  g.restore();
}
function foe(g, f, x, y, s = 1, t = 0) {
  const F = FOES[f.kind], r = F.r * s, dir = f.dir ?? Math.PI / 2, ph = f.ph ?? t * 8;
  g.save(); g.translate(x, y);
  g.fillStyle = '#0004'; g.beginPath(); g.ellipse(2, r * 0.6 + (F.fly ? 8 : 0), r * 1.1, r * 0.5, 0, 0, 7); g.fill();
  if (F.fly) g.translate(0, -4 + Math.sin(ph * 2) * 1.5);
  g.rotate(dir);
  const white = f.hurt > 0.06;
  const c = white ? '#fff' : FOE_COL[f.kind];
  g.lineCap = 'round';
  if (f.kind === 'termite') {
    g.strokeStyle = '#a88a60'; g.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(i * r * 0.5, 0); g.lineTo(i * r * 0.6 + Math.sin(ph + i) * 2, sd * r * 1.2); g.stroke(); }
    g.fillStyle = c; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-r * 0.9 + i * r * 0.7, 0, r * 0.55, r * 0.5, 0, 0, 7); g.fill(); }
    g.fillStyle = white ? '#fff' : '#c8702a'; g.beginPath(); g.ellipse(r * 1.1, 0, r * 0.5, r * 0.45, 0, 0, 7); g.fill();
  } else if (f.kind === 'beetle') {
    g.strokeStyle = '#122'; g.lineWidth = 1.8;
    for (let i = -1; i <= 1; i++) for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(i * r * 0.4, 0); g.lineTo(i * r * 0.55 + Math.sin(ph + i) * 2.5, sd * r * 1.25); g.stroke(); }
    g.fillStyle = '#1a2a2a'; g.beginPath(); g.ellipse(r * 0.9, 0, r * 0.4, r * 0.45, 0, 0, 7); g.fill();
    const gr = g.createRadialGradient(-r * 0.2, -r * 0.35, 1, 0, 0, r); gr.addColorStop(0, white ? '#fff' : '#6ad0c0'); gr.addColorStop(1, c);
    g.fillStyle = gr; g.beginPath(); g.ellipse(-r * 0.1, 0, r * 0.95, r * 0.8, 0, 0, 7); g.fill();
    g.strokeStyle = '#0005'; g.lineWidth = 1; g.beginPath(); g.moveTo(r * 0.8, 0); g.lineTo(-r, 0); g.stroke();
  } else if (f.kind === 'wasp') {
    g.fillStyle = '#ffffff88'; const fl = Math.sin(ph * 6) * 0.5 + 0.6;
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(-r * 0.1, sd * r * 0.9, r * 0.9, r * 0.4 * fl, sd * 0.4, 0, 7); g.fill(); }
    g.fillStyle = c; g.beginPath(); g.ellipse(-r * 0.6, 0, r * 0.85, r * 0.55, 0, 0, 7); g.fill();
    if (!white) { g.fillStyle = '#1a1408'; for (const k of [-0.9, -0.4]) g.fillRect(k * r, -r * 0.5, r * 0.22, r); }
    g.fillStyle = white ? '#fff' : '#1a1408'; g.beginPath(); g.ellipse(r * 0.5, 0, r * 0.45, r * 0.4, 0, 0, 7); g.fill();
  } else {
    g.strokeStyle = white ? '#fff' : '#2a1a30'; g.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
      const a = (i - 1.5) * 0.45, w = Math.sin(ph + i * 1.7) * 0.2;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + w) * r * 1.2, sd * r * 1.3, Math.cos(a + w) * r * 1.7, sd * r * 1.9); g.stroke();
    }
    g.fillStyle = c; g.beginPath(); g.ellipse(-r * 0.5, 0, r * 0.85, r * 0.75, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(r * 0.45, 0, r * 0.5, r * 0.45, 0, 0, 7); g.fill();
    g.fillStyle = '#ff3a5a'; for (const sd of [-1, 1]) { g.beginPath(); g.arc(r * 0.75, sd * r * 0.15, 1.8, 0, 7); g.fill(); }
    g.fillStyle = '#ffffff30'; g.beginPath(); g.ellipse(-r * 0.6, -r * 0.3, r * 0.4, r * 0.2, 0, 0, 7); g.fill();
  }
  g.restore();
}

// The meadow and the mound, drawn once per size.
let ground = null;
function paintGround() {
  ground = document.createElement('canvas'); ground.width = cv.width; ground.height = cv.height;
  const q = ground.getContext('2d'); q.setTransform(dpr, 0, 0, dpr, 0, 0);
  q.fillStyle = '#24451f'; q.fillRect(0, 0, vw, vh);
  q.translate(ox, oy); q.scale(sc, sc);
  const gr = q.createLinearGradient(0, -200, 0, H); gr.addColorStop(0, '#5a9448'); gr.addColorStop(1, '#78ae5e');
  q.fillStyle = gr; q.fillRect(-ox / sc, -200, W + 2 * ox / sc, H + 200);
  let r = 12345; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) { q.fillStyle = rnd() < 0.5 ? '#ffffff0a' : '#0000000c'; q.beginPath(); q.ellipse(rnd() * W, rnd() * H, 20 + rnd() * 50, 12 + rnd() * 30, rnd() * 3, 0, 7); q.fill(); }
  for (let i = 0; i < 260; i++) {
    const x = rnd() * (W + 2 * ox / sc) - ox / sc, y = rnd() * (H - 40) - 60, b = rnd();
    if (b < 0.8) { q.strokeStyle = rnd() < 0.5 ? '#4f8a40' : '#86c06a'; q.lineWidth = 1.4; q.lineCap = 'round'; q.beginPath(); for (const k of [-3, 0, 3]) { q.moveTo(x + k, y); q.lineTo(x + k * 1.6, y - 5 - rnd() * 4); } q.stroke(); }
    else if (b < 0.9) { q.fillStyle = '#a8a89a'; q.beginPath(); q.ellipse(x, y, 3 + rnd() * 3, 2 + rnd() * 2, rnd() * 3, 0, 7); q.fill(); q.fillStyle = '#ffffff30'; q.beginPath(); q.ellipse(x - 1, y - 1, 1.5, 1, 0, 0, 7); q.fill(); }
    else { q.fillStyle = rnd() < 0.5 ? '#f2e23a' : '#f2a6c6'; for (let k = 0; k < 5; k++) { q.beginPath(); q.arc(x + Math.cos(k * 1.257) * 2.4, y + Math.sin(k * 1.257) * 2.4, 1.7, 0, 7); q.fill(); } q.fillStyle = '#fff8e6'; q.beginPath(); q.arc(x, y, 1.2, 0, 7); q.fill(); }
  }
  // the mound: a soil bank along the bottom with the entrance in the middle
  const L = -ox / sc - 10, R = W + ox / sc + 10;
  q.fillStyle = '#00000022'; q.beginPath(); q.moveTo(L, LINE - 2); for (let x = L; x <= R; x += 12) q.lineTo(x, LINE - 6 - Math.sin(x * 0.07) * 3 - Math.exp(-(((x - NEST.x) / 70) ** 2)) * 20); q.lineTo(R, H + 40); q.lineTo(L, H + 40); q.fill();
  const sg = q.createLinearGradient(0, LINE - 20, 0, H); sg.addColorStop(0, COL.soil); sg.addColorStop(1, COL.soil2);
  q.fillStyle = sg; q.beginPath(); q.moveTo(L, LINE); for (let x = L; x <= R; x += 12) q.lineTo(x, LINE - 2 - Math.sin(x * 0.07) * 3 - Math.exp(-(((x - NEST.x) / 70) ** 2)) * 18); q.lineTo(R, H + 40); q.lineTo(L, H + 40); q.fill();
  for (let i = 0; i < 90; i++) { q.fillStyle = rnd() < 0.5 ? '#a87448' : '#5a3a20'; q.beginPath(); q.arc(L + rnd() * (R - L), LINE + 4 + rnd() * 50, 0.8 + rnd() * 1.6, 0, 7); q.fill(); }
  q.fillStyle = '#2a170c'; q.beginPath(); q.ellipse(NEST.x, NEST.y - 6, 16, 9, 0, 0, 7); q.fill();
  q.fillStyle = '#0006'; q.beginPath(); q.ellipse(NEST.x, NEST.y - 4, 11, 5, 0, 0, 7); q.fill();
}

// ---------- card icons: drawn in code on a 96 x 96 canvas
function icon(id, size = 96) {
  const c = document.createElement('canvas'); c.width = c.height = size * 2;
  const q = c.getContext('2d'); q.scale(size / 48, size / 48); q.translate(48, 48);
  const col = CARD_COL[id];
  const glow = q.createRadialGradient(0, 0, 4, 0, 0, 46); glow.addColorStop(0, col + '55'); glow.addColorStop(1, col + '00');
  q.fillStyle = glow; q.fillRect(-48, -48, 96, 96);
  q.lineCap = 'round'; q.lineJoin = 'round';
  const A = (x, y, d, s, b = COL.ant) => ant(q, x, y, d, s, b, 1);
  const crumb = (x, y, r = 5) => { q.fillStyle = '#f2c25a'; q.beginPath(); q.ellipse(x, y, r, r * 0.8, 0.4, 0, 7); q.fill(); q.fillStyle = '#fff4c0'; q.beginPath(); q.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, 7); q.fill(); };
  if (id === 'split') { A(-6, -10, -0.3, 9, '#3a2a22'); q.strokeStyle = col; q.lineWidth = 4; q.beginPath(); q.moveTo(-14, -22); q.lineTo(-6, -10); q.lineTo(-12, 2); q.stroke(); A(-18, 22, -2.4, 6); A(20, 18, -0.8, 6); }
  else if (id === 'haul') { A(0, 10, -Math.PI / 2, 10, COL.worker); crumb(-8, -22, 9); crumb(10, -24, 9); q.fillStyle = col; q.font = 'bold 22px system-ui'; q.textAlign = 'center'; q.fillText('×2', 26, 34); }
  else if (id === 'scout') { q.fillStyle = '#fff8e6'; q.beginPath(); q.ellipse(0, 0, 32, 18, 0, 0, 7); q.fill(); q.fillStyle = col; q.beginPath(); q.arc(0, 0, 13, 0, 7); q.fill(); q.fillStyle = '#10202a'; q.beginPath(); q.arc(0, 0, 6, 0, 7); q.fill(); q.fillStyle = '#fff'; q.beginPath(); q.arc(-4, -4, 3, 0, 7); q.fill(); q.strokeStyle = COL.ant; q.lineWidth = 3; q.beginPath(); q.moveTo(-10, -18); q.lineTo(-18, -34); q.moveTo(10, -18); q.lineTo(18, -34); q.stroke(); }
  else if (id === 'acid') { for (const [x, y, r] of [[-12, 8, 13], [12, -6, 10], [4, 22, 7]]) { q.fillStyle = col; q.beginPath(); q.moveTo(x, y - r * 1.8); q.quadraticCurveTo(x + r, y - r * 0.3, x + r, y + r * 0.2); q.arc(x, y + r * 0.2, r, 0, Math.PI); q.quadraticCurveTo(x - r, y - r * 0.3, x, y - r * 1.8); q.fill(); q.fillStyle = '#ffffff88'; q.beginPath(); q.arc(x - r * 0.35, y - r * 0.1, r * 0.25, 0, 7); q.fill(); } }
  else if (id === 'guard') { q.fillStyle = col; q.beginPath(); q.moveTo(-24, -16); q.lineTo(24, -16); q.lineTo(20, 10); q.quadraticCurveTo(0, 34, 0, 34); q.quadraticCurveTo(0, 34, -20, 10); q.closePath(); q.fill(); q.fillStyle = COL.gold; q.beginPath(); q.moveTo(-16, -22); q.lineTo(-16, -34); q.lineTo(-8, -26); q.lineTo(0, -38); q.lineTo(8, -26); q.lineTo(16, -34); q.lineTo(16, -22); q.closePath(); q.fill(); A(0, 4, -Math.PI / 2, 8, '#5a1410'); }
  else if (id === 'jaws') { q.fillStyle = COL.ant; q.beginPath(); q.ellipse(0, 18, 18, 14, 0, 0, 7); q.fill(); q.fillStyle = col; for (const sd of [-1, 1]) { q.beginPath(); q.moveTo(sd * 8, 8); q.quadraticCurveTo(sd * 30, -10, sd * 6, -30); q.quadraticCurveTo(sd * 16, -10, sd * 2, 6); q.fill(); } q.fillStyle = '#fff'; q.beginPath(); q.arc(-6, 14, 3, 0, 7); q.arc(6, 14, 3, 0, 7); q.fill(); }
  else if (id === 'shell') { A(0, 4, -Math.PI / 2, 10); q.strokeStyle = col; q.lineWidth = 5; q.beginPath(); q.arc(0, 4, 28, Math.PI * 1.1, Math.PI * 1.9); q.stroke(); q.lineWidth = 3; q.globalAlpha = 0.6; q.beginPath(); q.arc(0, 4, 36, Math.PI * 1.15, Math.PI * 1.85); q.stroke(); q.globalAlpha = 1; }
  else if (id === 'brood') { for (const [x, y] of [[-14, 10], [0, 16], [14, 10], [-7, -4], [7, -4], [0, -18]]) { q.fillStyle = col; q.beginPath(); q.ellipse(x, y, 7, 9, 0, 0, 7); q.fill(); q.fillStyle = '#fff'; q.beginPath(); q.ellipse(x - 2, y - 3, 2, 3, 0, 0, 7); q.fill(); } q.fillStyle = COL.gold; q.font = 'bold 20px system-ui'; q.textAlign = 'center'; q.fillText('+4', 26, -24); }
  else if (id === 'swift') { q.strokeStyle = col; q.lineWidth = 4; for (const y of [-10, 0, 10]) { q.beginPath(); q.moveTo(-34, y); q.lineTo(-14 + Math.abs(y), y); q.stroke(); } A(10, 0, 0, 11); }
  else if (id === 'honey') { q.fillStyle = COL.soil; q.beginPath(); q.ellipse(0, 26, 34, 14, 0, Math.PI, 0); q.fill(); q.fillStyle = col; q.beginPath(); q.moveTo(0, -34); q.quadraticCurveTo(18, -8, 16, 2); q.arc(0, 2, 16, 0, Math.PI); q.quadraticCurveTo(-18, -8, 0, -34); q.fill(); q.fillStyle = '#fff6'; q.beginPath(); q.ellipse(-6, -2, 4, 7, 0.3, 0, 7); q.fill(); }
  c.style.width = c.style.height = `${size}px`;
  return c;
}
function foeIcon(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 80; const q = c.getContext('2d');
  q.translate(40, 40); q.scale(kind === 'spider' ? 1.1 : 2.4, kind === 'spider' ? 1.1 : 2.4);
  foe(q, { kind, dir: Math.PI / 2, ph: 1, hurt: 0 }, 0, 0, 1);
  return c;
}

// ---------- state
let s = null, mode = 'menu', paused = false, daily = false, runSeed = 1, acc = 0, last = 0, now = 0;
let finger = null, shake = 0, flash = 0, banner = null, parts = [], floats = [], antSquash = new Map();
let pendingDraft = 0, pendingEnd = 0, pauseAfterPick = false;
const show = screens(['menu', 'draft', 'paused', 'end'], name => { $('pause').style.display = name === 'play' ? 'grid' : 'none'; });
function go(name) { if (name !== 'play') finger = null; mode = name; show(name); }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const hash = t => { let h = 2166136261; for (const ch of t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

function menu() {
  clearTimers(); finger = null; pendingDraft = pendingEnd = 0;
  $('best').textContent = save.best;
  $('dailyLine').innerHTML = save.daily && save.daily.day === today() ? `Today <b>${save.daily.score}</b>` : '';
  for (const id of ['sound1', 'sound2']) $(id).textContent = save.sound ? 'Sound: on' : 'Sound: off';
  go('menu');
}
function start(isDaily) {
  clearTimers(); pauseAfterPick = false;
  snd.unlock(); sfx.tap();
  daily = isDaily; runSeed = isDaily ? hash('ant-draft-b' + today()) : (Q.get('seed') ? Number(Q.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  if (!isDaily && Q.get('seed')) runSeed = Number(Q.get('seed')) + (start.n = (start.n || 0) + 1) - 1;
  s = create(runSeed); parts = []; floats = []; finger = null; acc = 0; paused = false; shake = flash = 0; banner = null; pendingDraft = pendingEnd = 0;
  handle(s.fx); go('play');
}

// ---------- input: the rally point is a little above the finger, so the finger does not hide the swarm
const LIFT = 46;
function toArena(e) { return { x: (e.clientX - ox) / sc, y: (e.clientY - LIFT - oy) / sc }; }
cv.addEventListener('pointerdown', e => { if (mode !== 'play' || paused || finger) return; finger = { ...toArena(e), cx: e.clientX, cy: e.clientY, id: e.pointerId }; try { cv.setPointerCapture(e.pointerId); } catch {} });
cv.addEventListener('pointermove', e => { if (!finger || finger.id !== e.pointerId) return; Object.assign(finger, toArena(e), { cx: e.clientX, cy: e.clientY }); });
for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) cv.addEventListener(t, e => { if (finger && finger.id === e.pointerId) finger = null; });
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (mode === 'play') pause(); else if (mode === 'paused') resume(); return; }
  if (mode === 'draft' && ['1', '2', '3'].includes(e.key)) pick(Number(e.key) - 1);
});
hint(cv, { kind: 'hold-and-move', key: 'ant-draft-b:hint', when: () => mode === 'play' && !paused, played, bottom: 170 });

function pause() { if (mode !== 'play') return; paused = true; finger = null; snd.hold(); fillHand($('pauseHand')); go('paused'); }
function resume() { paused = false; snd.release(); last = performance.now(); go('play'); }
$('pause').onclick = pause; $('resume').onclick = resume; $('quit').onclick = () => { paused = false; snd.release(); menu(); };
onLeave(() => { if (mode === 'picking') pauseAfterPick = true; else if (mode === 'play') pause(); });
$('play').onclick = () => start(false); $('daily').onclick = () => start(true);
$('again').onclick = () => start(daily); $('toMenu').onclick = () => { sfx.tap(); menu(); };
for (const id of ['sound1', 'sound2']) $(id).onclick = () => { save.sound = !save.sound; store(); snd.unlock(); sfx.tap(); for (const b of ['sound1', 'sound2']) $(b).textContent = save.sound ? 'Sound: on' : 'Sound: off'; };

function fillHand(el) {
  el.innerHTML = '';
  if (!s) return;
  for (const id of s.held) { const c = icon(id, 44); c.title = CARDS[id].word; el.append(c); }
}

// ---------- the draft
function draft() {
  go('draft');
  $('draftHead').textContent = `Wave ${s.wave} cleared`;
  const box = $('picks'); box.innerHTML = '';
  s.offer.forEach((id, i) => {
    const b = document.createElement('button'); b.className = 'pick'; b.style.setProperty('--c', CARD_COL[id]);
    b.append(icon(id, 84));
    const w = document.createElement('span'); w.textContent = CARDS[id].word; b.append(w);
    const have = s.cards[id];
    if (have) { const n = document.createElement('span'); n.className = 'n'; n.textContent = '+'.repeat(have + 1); b.append(n); }
    b.onclick = () => pick(i);
    box.append(b);
    later(() => b.classList.add('in'), 60 + i * 110); sfx.deal(i);
  });
  // the scout shows the bugs of the next wave
  const nx = $('next'); nx.innerHTML = '';
  if (s.cards.scout) {
    const count = {}; for (const q of plan(s.seed, s.wave + 1)) count[q.kind] = (count[q.kind] || 0) + 1;
    const eye = icon('scout', 40); nx.append(eye);
    for (const [k, n] of Object.entries(count)) { nx.append(foeIcon(k)); const t = document.createElement('b'); t.textContent = `×${n}`; nx.append(t); }
  }
  draft.at = performance.now();
}
function pick(i) {
  if (mode !== 'draft' || performance.now() - draft.at < 350) return; // a tap meant for the arena must not take a card
  const cards = [...$('picks').children];
  cards.forEach((c, j) => c.classList.add(j === i ? 'go' : 'out'));
  sfx.pick(); buzz([15, 30, 40]);
  const id = s.offer[i];
  mode = 'picking';
  later(() => { choose(s, i); burst(W / 2, LINE - 40, [CARD_COL[id], COL.gold, '#fff'], 30, 140, 3); handle(s.fx); go('play'); if (pauseAfterPick) { pauseAfterPick = false; pause(); } }, 280);
}

// ---------- effects
function burst(x, y, cols, n, sp, size) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.3 + Math.random() * 0.7); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.2, r: size * (0.5 + Math.random() * 0.8), c: cols[i % cols.length], age: 0, life: 0.4 + Math.random() * 0.5 }); }
}
function float(x, y, text, c) { floats.push({ x, y, text, c, age: 0 }); }
function handle(fx) {
  for (const e of fx) {
    if (e.type === 'kill') { const big = e.kind === 'beetle' || e.kind === 'spider'; burst(e.x, e.y, [FOE_COL[e.kind], '#fff', '#f2c25a'], big ? 26 : 10, big ? 120 : 80, big ? 3 : 2); sfx.kill(e.kind); if (big) shake = Math.max(shake, e.kind === 'spider' ? 14 : 4); if (e.kind === 'spider') flash = 0.6; }
    else if (e.type === 'die') { burst(e.x, e.y, ['#2b1d16', '#7a4a2a'], 6, 50, 1.6); sfx.die(); }
    else if (e.type === 'nest') { shake = Math.max(shake, 5 + e.hit * 2.5); flash = Math.max(flash, 0.25); burst(e.x, LINE, ['#ff5a3a', COL.soil, '#ffd23a'], 14, 110, 2.5); float(e.x, LINE - 10, `-${e.hit}`, '#ff6a4a'); sfx.nest(e.hit); buzz(30); }
    else if (e.type === 'hatch') { burst(e.x, e.y, ['#fff4c0', COL.gold], 8, 60, 1.6); float(e.x, e.y - 8, '+1', COL.gold); sfx.hatch(); }
    else if (e.type === 'pickup') sfx.pickup();
    else if (e.type === 'deliver') { burst(e.x, e.y, ['#f2c25a'], 4, 40, 1.4); sfx.deliver(); }
    else if (e.type === 'split') { burst(e.x, e.y, [CARD_COL.split, '#fff'], 10, 70, 1.8); sfx.split(); }
    else if (e.type === 'wave') { banner = { text: e.n === WAVES ? 'Last wave!' : `Wave ${e.n}`, age: 0 }; sfx.wave(); }
    else if (e.type === 'cleared') { sfx.cleared(); burst(W / 2, 200, [COL.gold, '#fff', '#8dff8a'], 40, 180, 3); pendingDraft = 0.65; }
    else if (e.type === 'won') { sfx.won(); burst(W / 2, 200, [COL.gold, '#ff8a5a', '#5ad0ff', '#fff'], 200, 200, 3); pendingEnd = 1.3; }
    else if (e.type === 'lost') { sfx.lost(); shake = 18; flash = 0.5; buzz([60, 40, 120]); pendingEnd = 1.1; }
  }
  fx.length = 0;
}
function end(won) {
  const better = s.score > save.best; if (better) save.best = s.score;
  save.bestWave = Math.max(save.bestWave, won ? WAVES + 1 : s.wave);
  if (daily) save.daily = { day: today(), score: Math.max(s.score, save.daily && save.daily.day === today() ? save.daily.score : 0) };
  store();
  $('endTitle').textContent = won ? 'Colony crowned!' : 'Nest fell';
  $('endWave').textContent = won ? 'All 8 waves' : `Wave ${s.wave} of ${WAVES}`;
  $('score').textContent = s.score; $('best2').textContent = save.best + (better ? ' ★' : ''); $('kills').textContent = s.kills;
  fillHand($('endHand'));
  const q = $('endArt').getContext('2d'); q.clearRect(0, 0, 240, 96);
  for (let i = 0; i < WAVES; i++) { const x = 30 + i * 26, ok = won || i < s.wave - 1; q.fillStyle = ok ? COL.gold : i === s.wave - 1 ? '#ff6a4a' : '#ffffff30'; q.beginPath(); q.arc(x, 70, 9, 0, 7); q.fill(); }
  if (won) { q.fillStyle = COL.gold; q.beginPath(); q.moveTo(84, 48); q.lineTo(84, 14); q.lineTo(102, 30); q.lineTo(120, 6); q.lineTo(138, 30); q.lineTo(156, 14); q.lineTo(156, 48); q.closePath(); q.fill(); }
  else { const f = { kind: s.foes[0]?.kind || 'beetle', dir: Math.PI / 2, ph: 1, hurt: 0 }; q.save(); q.translate(120, 28); q.scale(2, 2); foe(q, f, 0, 0); q.restore(); }
  go('end');
}

// ---------- frame
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (t - (last || t)) / 1000)); last = t; now = t / 1000;
  if (mode === 'play' && !paused && s && s.phase === 'fight') {
    acc += dt * SPEED;
    while (acc >= DT) { acc -= DT; step(s, finger ? { x: finger.x, y: finger.y } : null); handle(s.fx); if (s.phase !== 'fight') { acc = 0; break; } }
  }
  if (mode === 'play' && !paused) {
    if (pendingDraft > 0 && (pendingDraft -= dt) <= 0) draft();
    if (pendingEnd > 0 && (pendingEnd -= dt) <= 0) end(s.phase === 'won');
  }
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + 120 * dt; }
  parts = parts.filter(p => p.age < p.life);
  for (const f of floats) f.age += dt; floats = floats.filter(f => f.age < 0.9);
  shake = Math.max(0, shake - dt * 40); flash = Math.max(0, flash - dt * 1.5);
  if (banner) { banner.age += dt; if (banner.age > 1.6) banner = null; }
  draw(dt);
}

function draw() {
  if (!ground) paintGround();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sx = (Math.random() - 0.5) * shake * dpr, sy = (Math.random() - 0.5) * shake * dpr;
  g.drawImage(ground, sx, sy);
  g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox + sx, dpr * oy + sy);
  if (s) {
    for (const p of s.acid) { const a = Math.min(1, p.life / 1.2); g.fillStyle = `rgba(125,255,74,${0.28 * a})`; g.beginPath(); g.arc(p.x, p.y, 10, 0, 7); g.fill(); g.fillStyle = `rgba(200,255,160,${0.5 * a})`; g.beginPath(); g.arc(p.x - 2, p.y - 2, 2.5, 0, 7); g.fill(); }
    for (const c of s.crumbs) { g.fillStyle = '#0003'; g.beginPath(); g.ellipse(c.x + 1, c.y + 2, 3, 1.5, 0, 0, 7); g.fill(); g.fillStyle = '#f2c25a'; g.beginPath(); g.ellipse(c.x, c.y + Math.sin(now * 5 + c.x) * 0.6, 2.8, 2.2, 0.4, 0, 7); g.fill(); }
    // the rally ring
    const R = s.rally;
    g.strokeStyle = finger ? '#ffe08add' : '#ffe08a55'; g.lineWidth = 2; g.setLineDash([5, 5]); g.lineDashOffset = -now * 20;
    g.beginPath(); g.ellipse(R.x, R.y, 30, 22, 0, 0, 7); g.stroke(); g.setLineDash([]);
    if (finger) { g.fillStyle = '#ffe08a22'; g.beginPath(); g.ellipse(R.x, R.y, 30 + Math.sin(now * 8) * 2, 22, 0, 0, 7); g.fill(); g.strokeStyle = '#ffe08a66'; g.beginPath(); g.moveTo(R.x, R.y + 22); g.lineTo(R.x, R.y + LIFT / sc - 8); g.stroke(); }
    for (const a of s.ants) {
      const kind = a.kind, size = kind === 'guard' ? 6.2 : kind === 'small' ? 3.4 : kind === 'worker' ? 3.8 : 4.6;
      const body = a.hurt > 0.08 ? '#ff8a6a' : kind === 'guard' ? COL.guard : kind === 'worker' ? COL.worker : kind === 'small' ? '#4a2a1a' : COL.ant;
      ant(g, a.x, a.y, a.dir ?? -Math.PI / 2, size, body, a.ph, a.bit > 0 ? 1 : 0);
      if (kind === 'guard') { g.fillStyle = COL.gold; g.beginPath(); g.moveTo(a.x - 4, a.y - 7); g.lineTo(a.x - 4, a.y - 11); g.lineTo(a.x - 1.5, a.y - 9); g.lineTo(a.x, a.y - 12); g.lineTo(a.x + 1.5, a.y - 9); g.lineTo(a.x + 4, a.y - 11); g.lineTo(a.x + 4, a.y - 7); g.fill(); }
      if (a.carry) { g.fillStyle = '#f2c25a'; g.beginPath(); g.arc(a.x + Math.cos(a.dir ?? 0) * 5, a.y + Math.sin(a.dir ?? 0) * 5, 2.6, 0, 7); g.fill(); }
      if (a.hp < a.max && kind !== 'worker') { g.fillStyle = '#0006'; g.fillRect(a.x - 5, a.y - 9, 10, 2); g.fillStyle = '#8dff8a'; g.fillRect(a.x - 5, a.y - 9, 10 * Math.max(0, a.hp / a.max), 2); }
    }
    for (const f of s.foes) {
      foe(g, f, f.x, f.y);
      if (f.hp < f.max) { const w = FOES[f.kind].r * 2.2; g.fillStyle = '#0007'; g.fillRect(f.x - w / 2, f.y - FOES[f.kind].r - 7, w, 3); g.fillStyle = '#ff6a4a'; g.fillRect(f.x - w / 2, f.y - FOES[f.kind].r - 7, w * Math.max(0, f.hp / f.max), 3); }
    }
    // bugs still to come peek in at the top edge
    if (s.queue.length && s.queue[0].at - s.wt < 1.5) { const q = s.queue[0]; g.fillStyle = `rgba(255,90,60,${0.4 + 0.3 * Math.sin(now * 10)})`; const x = Math.max(8, Math.min(W - 8, q.x)), y = Math.max(6, Math.min(H - 8, q.y)); g.beginPath(); g.arc(x, y + 8, 6, 0, 7); g.fill(); }
  }
  for (const p of parts) { g.globalAlpha = 1 - p.age / p.life; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (const f of floats) { g.globalAlpha = 1 - f.age / 0.9; g.font = `bold ${Math.max(14 / sc, 12)}px system-ui`; g.lineWidth = 3; g.strokeStyle = '#0b1408'; g.strokeText(f.text, f.x, f.y - f.age * 24); g.fillStyle = f.c; g.fillText(f.text, f.x, f.y - f.age * 24); }
  g.globalAlpha = 1;
  if (banner) {
    const a = banner.age, k = a < 0.25 ? a / 0.25 : a > 1.3 ? 1 - (a - 1.3) / 0.3 : 1, sq = a < 0.25 ? 1.4 - 0.4 * (a / 0.25) : 1;
    g.save(); g.globalAlpha = Math.max(0, k); g.translate(W / 2, 220); g.scale(sq, 2 - sq);
    g.font = 'bold 44px ui-rounded, system-ui'; g.lineWidth = 8; g.strokeStyle = '#5a3a0c'; g.strokeText(banner.text, 0, 0); g.fillStyle = COL.gold; g.fillText(banner.text, 0, 0); g.restore();
  }
  // HUD in screen space
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (flash > 0) { g.fillStyle = `rgba(255,80,60,${flash * 0.35})`; g.fillRect(0, 0, vw, vh); }
  if (s && (mode === 'play' || mode === 'draft' || mode === 'picking' || mode === 'paused')) hud();
}
function hud() {
  const y = safeTop + 14, x0 = Math.max(12, ox + 4);
  // wave pips
  for (let i = 0; i < WAVES; i++) {
    const x = x0 + 8 + i * 19, done = i < s.wave - 1 || s.phase === 'won', cur = i === s.wave - 1;
    g.fillStyle = done ? COL.gold : cur ? '#fff8e6' : '#ffffff30';
    g.beginPath(); g.arc(x, y + 6, cur ? 7 + Math.sin(now * 6) * 1 : 6, 0, 7); g.fill();
    if (i === WAVES - 1) { g.strokeStyle = '#ff6a4a'; g.lineWidth = 2; g.stroke(); }
  }
  // nest health: a bar with a mound
  const bw = Math.min(130, vw - x0 - 230), bx = x0, by = y + 20;
  g.fillStyle = '#0006'; g.beginPath(); g.roundRect(bx, by, bw + 4, 14, 7); g.fill();
  const k = Math.max(0, s.nest.hp / s.nest.max);
  g.fillStyle = k > 0.5 ? '#8dff8a' : k > 0.25 ? '#ffd23a' : '#ff5a3a'; g.beginPath(); g.roundRect(bx + 2, by + 2, bw * k, 10, 5); g.fill();
  g.font = 'bold 15px ui-rounded, system-ui'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff8e6';
  g.fillText(`${Math.ceil(s.nest.hp)}`, bx + bw + 10, by + 7);
  // ants and score
  const n = s.ants.filter(a => a.kind !== 'worker').length;
  g.textAlign = 'right'; g.fillText(`${n} ants · ${s.score}`, vw - Math.max(64, ox + 60), y + 8);
  // the cards held, as small icons under the score
  const right = vw - Math.max(64, ox + 60);
  s.held.forEach((id, i) => { const c = iconCache[id] ||= icon(id, 24); g.drawImage(c, right - 20 - i * 18, by - 3, 20, 20); });
}
const iconCache = {};

// test hook for check.mjs (read only)
window.antDraftState = () => ({ mode, paused, phase: s?.phase, wave: s?.wave, nest: s?.nest.hp, ants: s?.ants.length, foes: s?.foes.map(f => ({ x: f.x, y: f.y, kind: f.kind, lane: f.lane })) ?? [], held: s?.held ?? [], offer: s?.offer ?? [], score: s?.score, t: s?.t, rally: s?.rally, map: { ox, oy, sc, lift: LIFT }, hint: !!document.querySelector('.kit-hint.on') });

resize(); menu();
// the logo: an ant holding a card
{ const q = $('logo').getContext('2d'); q.scale(2, 2); ant(q, 50, 34, -0.2, 14, COL.ant, 1); q.save(); q.translate(84, 24); q.rotate(0.15); q.fillStyle = '#ffe08a'; q.beginPath(); q.roundRect(-14, -18, 28, 36, 5); q.fill(); q.drawImage(icon('jaws', 24), -12, -12, 24, 24); q.restore(); }
requestAnimationFrame(frame);
