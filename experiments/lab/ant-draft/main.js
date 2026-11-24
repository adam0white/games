// Ant Draft: the page. Rules are in sim.js; this file draws, plays sound and turns the thumb into the rally point.
import { create, step, setRally, pick, threat, score, nextWave, DT, W, H, QUEEN, CARDS, CARD, MAXLVL, LEASH } from './sim.js';
import { level, LEVELS, CHAPTERS, TUTORIAL, stars } from './levels.js';
import { readJson, writeJson, read, write } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';

const $ = id => document.getElementById(id);
const timers = new Set();
function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
function clearTimers() { for (const id of timers) clearTimeout(id); timers.clear(); }
const canvas = $('c'), ctx = canvas.getContext('2d');
const KEY = 'ant-draft:save';
const save = Object.assign({ best: 0, wins: 0, runs: 0, sound: true, daily: null }, readJson(KEY, {}));
const playedBefore = save.runs > 0;
// ant-draft:levels: { open: highest level open, stars: { level: 1..3 } }. ant-draft:tutorial: '1' once the tutorial was played or skipped.
const LV = 'ant-draft:levels', prog = Object.assign({ open: 1, stars: {} }, readJson(LV, {}));
prog.open = Math.max(1, Math.min(LEVELS, Math.floor(prog.open) || 1)); if (!prog.stars || typeof prog.stars !== 'object') prog.stars = {};
let cur = null; // what is being played: a level number, 0 for the tutorial, null for the 8-wave long run
let lastBoom = 0, floats = [], lost = null, booms = [], boomed = 0, hitsShown = 0, peak = 0, tipText = '', afterTutorial = null; // numbers that rise, the health the swarm just lost, explosions
const persist = () => writeJson(KEY, save);
const snd = sound({ on: () => save.sound });
const params = new URLSearchParams(location.search);
const LIFT = 44; // a touch puts the flag this many px above the finger, so the thumb does not cover the fight
noZoom();

let s = null, mode = 'menu', paused = false, daily = false, acc = 0, last = performance.now(), time = 0, shake = 0, redFlash = 0;
let parts = [], rings = [], banner = null, finger = null, pendingEnd = 0, pendingDraft = 0, draftOpenAt = 0, lastBite = 0;
let cw = 0, ch = 0, dpr = 1, scale = 1, ox = 0, oy = 0, ground = null;
const keys = new Set();
const show = screens(['menu', 'ask', 'levels', 'draft', 'paused', 'end'], name => { $('pause').style.display = name === 'play' ? 'grid' : 'none'; });

// ---------- layout ----------
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3); cw = innerWidth; ch = innerHeight;
  const cs = getComputedStyle($('probe')), top = parseFloat(cs.paddingTop) || 0, bot = parseFloat(cs.paddingBottom) || 0;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  scale = Math.min(cw / W, (ch - top - bot) / H); ox = (cw - W * scale) / 2; oy = top; // the field hangs from the top of the screen; spare height on a tall phone is grass under the nest, where the thumb rests
  paintGround();
}
function paintGround() {
  ground = document.createElement('canvas'); ground.width = canvas.width; ground.height = canvas.height;
  const g = ground.getContext('2d'); g.scale(dpr, dpr);
  const grad = g.createLinearGradient(0, 0, 0, ch); grad.addColorStop(0, '#2c5a22'); grad.addColorStop(1, '#3d7a2c'); g.fillStyle = grad; g.fillRect(0, 0, cw, ch);
  let r = 12345; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '20,50,18' : '120,170,60'},${0.06 + rnd() * 0.08})`; g.beginPath(); g.ellipse(rnd() * cw, rnd() * ch, 20 + rnd() * 50, 12 + rnd() * 26, rnd() * 3, 0, 6.3); g.fill(); }
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) { const x = rnd() * cw, y = rnd() * ch, l = 4 + rnd() * 7; g.strokeStyle = rnd() < 0.5 ? '#24451f88' : '#8dc85a66'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 5, y - l); g.stroke(); }
  for (let i = 0; i < 26; i++) { const x = rnd() * cw, y = rnd() * ch * 0.8; g.fillStyle = ['#fff8e6', '#ffe23a', '#ff9db0'][i % 3]; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.257) * 2.6, y + Math.sin(k * 1.257) * 2.6, 1.8, 0, 6.3); g.fill(); } g.fillStyle = '#ffb42a'; g.beginPath(); g.arc(x, y, 1.5, 0, 6.3); g.fill(); }
  // The nest: a mound of soil with a dark door.
  const qx = ox + QUEEN.x * scale, qy = oy + QUEEN.y * scale, R = 56 * scale;
  g.fillStyle = '#0b140833'; g.beginPath(); g.ellipse(qx + 3, qy + 8, R * 1.08, R * 0.8, 0, 0, 6.3); g.fill();
  const m = g.createRadialGradient(qx - R * 0.2, qy - R * 0.3, R * 0.1, qx, qy, R); m.addColorStop(0, '#b98552'); m.addColorStop(1, '#6e4526'); g.fillStyle = m; g.beginPath(); g.ellipse(qx, qy, R, R * 0.74, 0, 0, 6.3); g.fill();
  for (let i = 0; i < 60; i++) { const a = rnd() * 6.3, d = Math.sqrt(rnd()) * R * 0.95; g.fillStyle = rnd() < 0.5 ? '#5a371d88' : '#d6a57288'; g.beginPath(); g.arc(qx + Math.cos(a) * d, qy + Math.sin(a) * d * 0.74, 1 + rnd() * 2, 0, 6.3); g.fill(); }
  g.fillStyle = '#2a170c'; g.beginPath(); g.ellipse(qx, qy + 2 * scale, R * 0.5, R * 0.36, 0, 0, 6.3); g.fill();
}
addEventListener('resize', resize); resize();
// WebKit (Playwright's iPhone 13, first page of a context) was seen to lose canvases painted while the module loads:
// the ground and the menu art came out blank. So both are painted again on early frames until a pixel reads back solid.
let groundChecks = 12;
function groundOk() { try { return ground.getContext('2d').getImageData(2, 2, 1, 1).data[3] > 0; } catch { return true; } }

// ---------- art ----------
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, 6.3); c.fill(); };
function ant(c, x, y, ang, sz, col, t = 0, opts = {}) {
  c.save(); c.translate(x, y);
  if (!opts.flat) { c.fillStyle = '#0b140840'; ell(c, 1.5, 2.5, sz * 1.1, sz * 0.5, ang); }
  c.rotate(ang);
  c.strokeStyle = '#1a0f0a'; c.lineWidth = Math.max(0.8, sz * 0.13); c.lineCap = 'round'; c.beginPath();
  for (const i of [-1, 0, 1]) for (const side of [-1, 1]) { const w = Math.sin(t * 22 + i * 2.1 + (side > 0 ? 0 : 3.14)) * 0.3; c.moveTo(i * sz * 0.3, side * sz * 0.15); c.lineTo(i * sz * 0.5 + w * sz, side * sz * 0.85); }
  c.moveTo(sz * 0.75, -sz * 0.12); c.lineTo(sz * 1.25, -sz * 0.45); c.moveTo(sz * 0.75, sz * 0.12); c.lineTo(sz * 1.25, sz * 0.45); c.stroke();
  c.fillStyle = col; ell(c, -sz * 0.72, 0, sz * 0.56, sz * 0.42); ell(c, -sz * 0.05, 0, sz * 0.32, sz * 0.26);
  c.fillStyle = opts.head || col; ell(c, sz * 0.52, 0, sz * 0.36, sz * 0.32);
  c.fillStyle = '#ffffff55'; ell(c, -sz * 0.8, -sz * 0.14, sz * 0.26, sz * 0.12);
  if (opts.crown) { c.fillStyle = '#ffe23a'; c.strokeStyle = '#3a2a22'; c.lineWidth = sz * 0.07; c.beginPath(); const k = sz * 0.3; c.moveTo(sz * 0.3, -k); c.lineTo(sz * 0.78, -k * 1.1); c.lineTo(sz * 0.55, -k * 0.45); c.lineTo(sz * 0.85, 0); c.lineTo(sz * 0.55, k * 0.45); c.lineTo(sz * 0.78, k * 1.1); c.lineTo(sz * 0.3, k); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
const ANT = { soldier: ['#d2321f', '#8a1f1a', 6.2], worker: ['#7a4a26', '#4f2e15', 5], guard: ['#ffb42a', '#c57a12', 7.6], mini: ['#ff7a3a', '#c0471f', 3.8] };
function foe(c, type, x, y, ang, r, t, flash = 0) {
  c.save(); c.translate(x, y);
  const fly = type === 'wasp';
  c.fillStyle = '#0b140840'; ell(c, fly ? 5 : 2, fly ? 9 : 3, r * 1.05, r * 0.7, ang);
  c.rotate(ang); c.lineCap = 'round';
  const legs = (n, len, col) => { c.strokeStyle = col; c.lineWidth = Math.max(1, r * 0.13); c.beginPath(); for (let i = 0; i < n; i++) for (const sd of [-1, 1]) { const px = (i - (n - 1) / 2) * r * 0.42, w = Math.sin(t * 12 + i * 1.7 + (sd > 0 ? 0 : 3.1)) * r * 0.2; c.moveTo(px, sd * r * 0.3); c.lineTo(px + w, sd * r * len); } c.stroke(); };
  if (type === 'aphid') { legs(3, 1.05, '#24451f'); c.fillStyle = '#8fe07a'; ell(c, 0, 0, r, r * 0.8); c.fillStyle = '#c9ffb8'; ell(c, -r * 0.25, -r * 0.25, r * 0.4, r * 0.22); c.fillStyle = '#1a0f0a'; ell(c, r * 0.6, -r * 0.3, r * 0.14, r * 0.14); ell(c, r * 0.6, r * 0.3, r * 0.14, r * 0.14); }
  else if (type === 'beetle') { legs(3, 1.15, '#101830'); c.fillStyle = '#1a2444'; ell(c, r * 0.75, 0, r * 0.45, r * 0.5); c.fillStyle = '#34509c'; ell(c, -r * 0.1, 0, r, r * 0.82); c.strokeStyle = '#101830'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-r * 1.1, 0); c.lineTo(r * 0.5, 0); c.stroke(); c.fillStyle = '#9bb6ff88'; ell(c, -r * 0.3, -r * 0.42, r * 0.5, r * 0.16); }
  else if (type === 'wasp') { const f = Math.sin(t * 60) * 0.35; c.fillStyle = '#ffffff88'; ell(c, -r * 0.1, -r * 0.9, r * 0.9, r * 0.36, -0.5 + f); ell(c, -r * 0.1, r * 0.9, r * 0.9, r * 0.36, 0.5 - f); c.fillStyle = '#ffd23a'; ell(c, -r * 0.35, 0, r * 1.0, r * 0.55); c.fillStyle = '#1a0f0a'; for (const k of [-0.9, -0.4, 0.1]) c.fillRect(r * k, -r * 0.5, r * 0.2, r); ell(c, r * 0.8, 0, r * 0.4, r * 0.42); c.beginPath(); c.moveTo(-r * 1.3, 0); c.lineTo(-r * 1.8, 0); c.strokeStyle = '#1a0f0a'; c.lineWidth = 2; c.stroke(); }
  else if (type === 'spider') { legs(4, 1.5, '#2b1638'); c.fillStyle = '#7a3fa0'; ell(c, -r * 0.3, 0, r * 0.9, r * 0.82); c.fillStyle = '#4c2466'; ell(c, r * 0.6, 0, r * 0.5, r * 0.46); c.fillStyle = '#ff3a2a'; ell(c, r * 0.85, -r * 0.18, r * 0.12, r * 0.12); ell(c, r * 0.85, r * 0.18, r * 0.12, r * 0.12); c.fillStyle = '#ffffff44'; ell(c, -r * 0.45, -r * 0.3, r * 0.4, r * 0.18); }
  else { legs(3, 1.1, '#24130a'); const j = Math.sin(t * 6) * 0.18; c.strokeStyle = '#24130a'; c.lineWidth = r * 0.22; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.8, sd * r * 0.25); c.quadraticCurveTo(r * 1.5, sd * r * (0.9 + j), r * 1.9, sd * r * (0.25 + j)); c.stroke(); } c.fillStyle = '#3a2012'; ell(c, r * 0.7, 0, r * 0.5, r * 0.55); c.fillStyle = '#7a4424'; ell(c, -r * 0.15, 0, r, r * 0.78); c.strokeStyle = '#3a2012'; c.lineWidth = 2; c.beginPath(); c.moveTo(-r * 1.1, 0); c.lineTo(r * 0.4, 0); c.stroke(); c.fillStyle = '#ffd9a888'; ell(c, -r * 0.3, -r * 0.4, r * 0.5, r * 0.15); }
  if (flash > 0) { c.globalAlpha = 0.6; c.fillStyle = '#fff'; ell(c, 0, 0, r * 1.05, r * 0.85); }
  c.restore();
}
const FOECOL = { aphid: '#8fe07a', beetle: '#34509c', wasp: '#ffd23a', spider: '#7a3fa0', stag: '#7a4424' };
// Card icons, drawn in an S by S box.
function icon(c, id, S) {
  c.save(); c.translate(S / 2, S / 2); const u = S / 64; c.scale(u, u); c.lineJoin = 'round'; c.lineCap = 'round';
  const out = (fill, w = 3) => { c.fillStyle = fill; c.fill(); c.strokeStyle = '#3a2a22'; c.lineWidth = w; c.stroke(); };
  if (id === 'split') { ant(c, 0, -14, -1.57, 11, '#d2321f', 0, { flat: 1, head: '#8a1f1a' }); c.strokeStyle = '#3a2a22'; c.lineWidth = 3; c.beginPath(); c.moveTo(-3, 2); c.lineTo(-12, 10); c.moveTo(3, 2); c.lineTo(12, 10); c.stroke(); ant(c, -15, 19, -2.2, 6.5, '#ff7a3a', 0, { flat: 1 }); ant(c, 15, 19, -0.9, 6.5, '#ff7a3a', 0, { flat: 1 }); }
  else if (id === 'carry') { ant(c, -2, 8, -0.5, 13, '#7a4a26', 0, { flat: 1, head: '#4f2e15' }); for (const [x, y] of [[8, -12], [-8, -17]]) { c.beginPath(); c.moveTo(x - 8, y + 4); c.lineTo(x - 3, y - 7); c.lineTo(x + 7, y - 5); c.lineTo(x + 8, y + 5); c.closePath(); out('#fff0c2', 2.5); } }
  else if (id === 'scout') { c.beginPath(); c.moveTo(-26, 2); c.quadraticCurveTo(0, -26, 26, 2); c.quadraticCurveTo(0, 28, -26, 2); out('#fff'); c.beginPath(); c.arc(0, 2, 10, 0, 6.3); out('#3fae5a', 2.5); c.fillStyle = '#1a0f0a'; ell(c, 0, 2, 4.5, 4.5); c.fillStyle = '#fff'; ell(c, 3, -1, 2, 2); c.strokeStyle = '#3a2a22'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -17); c.lineTo(-14, -27); c.moveTo(8, -17); c.lineTo(14, -27); c.stroke(); }
  else if (id === 'acid') { c.beginPath(); c.ellipse(0, 20, 24, 7, 0, 0, 6.3); out('#9cf04a', 2.5); for (const [x, y, k] of [[-10, -4, 1], [9, -14, 0.75], [4, 6, 0.55]]) { c.beginPath(); c.moveTo(x, y - 14 * k); c.bezierCurveTo(x + 12 * k, y, x + 8 * k, y + 10 * k, x, y + 10 * k); c.bezierCurveTo(x - 8 * k, y + 10 * k, x - 12 * k, y, x, y - 14 * k); out('#b8ff5a', 2.5); } }
  else if (id === 'guard') { c.beginPath(); c.moveTo(-13, 8); c.lineTo(-16, -9); c.lineTo(-7, -1); c.lineTo(0, -13); c.lineTo(7, -1); c.lineTo(16, -9); c.lineTo(13, 8); c.closePath(); out('#ffe23a'); for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.5; ant(c, Math.cos(a) * 23, Math.sin(a) * 23, a + 1.571, 6, '#ffb42a', 0, { flat: 1, head: '#c57a12' }); } }
  else if (id === 'jaws') { for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 6, 22); c.quadraticCurveTo(sd * 30, 8, sd * 16, -22); c.quadraticCurveTo(sd * 12, -2, sd * 2, -6); c.quadraticCurveTo(sd * 14, 6, sd * 6, 22); out('#d2321f'); } c.fillStyle = '#ffe23a'; for (const [x, y] of [[0, -20], [-5, -13], [5, -13]]) ell(c, x, y, 2.5, 2.5); }
  else if (id === 'legs') { c.strokeStyle = '#3a2a2288'; c.lineWidth = 4; c.beginPath(); for (const y of [-12, 0, 12]) { c.moveTo(-28, y); c.lineTo(-12 - Math.abs(y) * 0.3, y); } c.stroke(); ant(c, 8, 0, 0, 15, '#d2321f', 0.07, { flat: 1, head: '#8a1f1a' }); }
  else if (id === 'brood') { for (const [x, y, r] of [[-12, 8, 0.3], [11, 9, -0.3], [0, -10, 0]]) { c.beginPath(); c.ellipse(x, y, 10, 13, r, 0, 6.3); out('#fff8e6'); c.fillStyle = '#ffffffcc'; } ant(c, 0, -11, -1.57, 5.5, '#d2321f', 0, { flat: 1 }); }
  else if (id === 'shell') { c.beginPath(); c.moveTo(0, -24); c.lineTo(21, -15); c.quadraticCurveTo(22, 12, 0, 25); c.quadraticCurveTo(-22, 12, -21, -15); c.closePath(); out('#6fa8dc'); c.beginPath(); c.moveTo(0, -17); c.lineTo(0, 17); c.moveTo(-14, -4); c.lineTo(14, -4); c.strokeStyle = '#ffffffaa'; c.lineWidth = 3; c.stroke(); }
  else if (id === 'jelly') { c.beginPath(); c.moveTo(0, 22); c.bezierCurveTo(-34, -2, -18, -28, 0, -11); c.bezierCurveTo(18, -28, 34, -2, 0, 22); out('#ffb42a'); c.fillStyle = '#fff8e6cc'; ell(c, -9, -8, 5, 3.5, -0.6); c.fillStyle = '#3fae5a'; c.fillRect(-2.5, -4, 5, 15); c.fillRect(-7.5, 1, 15, 5); }
  else if (id === 'fire') { c.beginPath(); c.moveTo(0, -26); c.bezierCurveTo(6, -12, 22, -6, 17, 11); c.bezierCurveTo(14, 24, -14, 24, -17, 11); c.bezierCurveTo(-20, 0, -8, -4, -9, -14); c.bezierCurveTo(-3, -12, -2, -18, 0, -26); out('#ff5a1f'); c.beginPath(); c.moveTo(1, -4); c.bezierCurveTo(10, 4, 9, 17, 0, 17); c.bezierCurveTo(-9, 17, -8, 6, 1, -4); c.fillStyle = '#ffe23a'; c.fill(); }
  else if (id === 'frenzy') { c.beginPath(); c.moveTo(6, -26); c.lineTo(-14, 4); c.lineTo(-2, 4); c.lineTo(-8, 26); c.lineTo(15, -6); c.lineTo(3, -6); c.closePath(); out('#ffe23a'); }
  c.restore();
}
function iconCanvas(id, px) { const el = document.createElement('canvas'); el.width = el.height = px; icon(el.getContext('2d'), id, px); return el; }
const smallIcons = {}; const small = id => (smallIcons[id] ??= iconCanvas(id, 96));
const pips = n => `<div class="pips">${[1, 2, 3].slice(0, MAXLVL).map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;

// ---------- juice ----------
function burst(x, y, n, col, speed = 60, life = 0.5, size = 2.4) { for (let i = 0; i < n && parts.length < 500; i++) { const a = Math.random() * 6.283, v = speed * (0.3 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, col, size: size * (0.6 + Math.random() * 0.8) }); } }
const ring = (x, y, r, col, life = 0.4) => rings.push({ x, y, r, col, life, max: life });
function onEvent(e) {
  const now = performance.now();
  switch (e.type) {
    case 'hit': { // damage on one enemy adds up for a third of a second, then rises as one number
      const f = floats.find(q => q.id === e.id && q.age < 0.35);
      if (f) { f.n += e.n; f.x = e.x; f.y = e.y - 16; } else { floats.push({ id: e.id, n: e.n, x: e.x + (Math.random() - 0.5) * 8, y: e.y - 16, age: 0, col: '#ffe23a' }); hitsShown++; }
      break; }
    case 'bite': burst(e.x, e.y, 2, '#fff8e6', 50, 0.25, 1.6); if (now - lastBite > 55) { lastBite = now; snd.tone(520 + Math.random() * 240, 0.035, 0.035, 'square'); } break;
    case 'chomp': floats.push({ id: 0, n: e.n, x: e.x, y: e.y - 8, age: 0, col: '#ff8a7a' }); burst(e.x, e.y, 2, '#ff7a6a', 40, 0.3, 1.8); break;
    case 'kill': { const big = e.foe === 'stag' ? 3 : e.foe === 'beetle' || e.foe === 'spider' ? 1.6 : 1; burst(e.x, e.y, 10 * big, FOECOL[e.foe], 90 * big, 0.6, 3); burst(e.x, e.y, 4 * big, '#fff8e6', 60, 0.4, 2); ring(e.x, e.y, 16 * big, '#fff8e6'); shake = Math.max(shake, big > 2 ? 16 : big > 1 ? 5 : 2); snd.tone(300 / big + 180, 0.12, 0.09, 'triangle', -160); if (big > 1) snd.noise(0.12 * big, 0.14, 700); break; }
    case 'antdie': booms.push({ x: e.x, y: e.y, t: 0, r: 12, puff: 1 }); burst(e.x, e.y, 7, '#8a1f1a', 60, 0.5, 2.2); snd.tone(190, 0.06, 0.04, 'sawtooth', -60); break;
    case 'boom': boomed++; booms.push({ x: e.x, y: e.y, t: 0, r: e.r, spin: Math.random() * 6.28 }); if (booms.length > 60) booms.splice(0, booms.length - 60); ring(e.x, e.y, e.r, '#fff8e6', 0.35); burst(e.x, e.y, 18, '#ff7a1f', 240, 0.6, 4.2); burst(e.x, e.y, 10, '#ffe23a', 170, 0.45, 3.2); burst(e.x, e.y, 7, '#4a3a30', 110, 1, 5);
      if (e.hits) floats.push({ id: 0, n: e.n * e.hits, x: e.x, y: e.y - 22, age: 0, col: '#ff7a1f', big: 1 });
      shake = Math.max(shake, 9); if (now - lastBoom > 90) { lastBoom = now; snd.noise(0.42, 0.26, 300); snd.noise(0.1, 0.14, 2200); snd.tone(85, 0.42, 0.16, 'sine', -55); } break;
    case 'split': ring(e.x, e.y, 14, '#ff7a3a', 0.3); snd.tone(640, 0.07, 0.05, 'sine', 320); break;
    case 'spit': snd.tone(880, 0.08, 0.03, 'sine', -500); break;
    case 'queenhit': shake = Math.max(shake, 8); redFlash = 0.25; burst(e.x, e.y - 8, 8, '#ff3a2a', 90, 0.5, 3); snd.tone(110, 0.22, 0.16, 'sawtooth', -50); snd.noise(0.1, 0.12, 300); break;
    case 'hatch': ring(e.x, e.y, 12, '#ffe23a', 0.35); burst(e.x, e.y, 4, '#ffe23a', 40, 0.4, 2); snd.tone(520, 0.09, 0.05, 'triangle', 380); break;
    case 'crumb': snd.tone(900, 0.03, 0.025, 'sine'); break;
    case 'deliver': burst(e.x, e.y, 3, '#fff0c2', 40, 0.4, 2); snd.tone(780, 0.07, 0.05, 'sine', 240); break;
    case 'heal': ring(e.x, e.y, 44, '#8dff8a', 0.6); burst(e.x, e.y, 12, '#8dff8a', 60, 0.7, 2.5); snd.tone(440, 0.25, 0.06, 'sine', 440); break;
    case 'wave': peak = 0; banner = { text: cur === 0 ? `Step ${e.n}` : e.n === s.waves && (cur !== null || s.waves === 8) ? 'Final wave' : `Wave ${e.n}`, t: 0 }; snd.tone(392, 0.12, 0.08, 'triangle'); later(() => snd.tone(587, 0.2, 0.08, 'triangle'), 120); break;
    case 'draft': pendingDraft = 0.55; [523, 659, 784].forEach((f, i) => later(() => snd.tone(f, 0.16, 0.07, 'triangle'), i * 80)); break;
    case 'won': pendingEnd = 1.3; for (let i = 0; i < 6; i++) later(() => { burst(40 + Math.random() * 280, 120 + Math.random() * 300, 22, ['#ffe23a', '#ff7a6a', '#8dff8a', '#fff8e6'][i % 4], 150, 1, 3.4); snd.tone([523, 659, 784, 1047, 784, 1047][i], 0.22, 0.09, 'triangle'); }, i * 150); break;
    case 'lost': pendingEnd = 1.1; shake = 20; burst(e.x, e.y, 40, '#b98552', 160, 1, 4); burst(e.x, e.y, 20, '#ff3a2a', 120, 0.8, 3); [330, 262, 196, 131].forEach((f, i) => later(() => snd.tone(f, 0.28, 0.11, 'sawtooth', -40), i * 150)); snd.noise(0.5, 0.2, 200); break;
  }
}
const drain = () => { for (const e of s.events) onEvent(e); s.events.length = 0; };

// ---------- flow ----------
function play(n) { // the first time, ask about the tutorial (tester note #207); a later Play goes straight in
  if (read('ant-draft:tutorial') === null && !playedBefore && save.runs === 0) { afterTutorial = n; mode = 'ask'; show('ask'); return; }
  cur = n; start(false);
}
function start(isDaily = daily) {
  clearTimers(); choosing = false; pauseAfterPick = false; daily = isDaily; snd.unlock();
  const d = new Date(), seed = params.has('seed') ? Number(params.get('seed')) : daily ? d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() : (Math.random() * 2 ** 31) | 0;
  const waves = Number(params.get('waves')), hp = Number(params.get('hp'));
  const L = cur === null ? null : cur === 0 ? TUTORIAL : level(cur);
  floats = []; booms = []; peak = 0; lost = null;
  s = create(seed, { level: L, safe: cur === 0, waves: Number.isFinite(waves) && waves >= 1 ? Math.min(8, Math.floor(waves)) : 8, hp: Number.isFinite(hp) && hp > 0 ? Math.min(QUEEN.hp, hp) : QUEEN.hp });
  for (const id of (params.get('give') || '').split(',')) if (CARD[id]) s.cards[id] = 3; // for looking at a card's effect
  parts = []; rings = []; finger = null; keys.clear(); shake = redFlash = 0; banner = null; acc = 0; paused = false; pendingEnd = pendingDraft = 0; mode = 'play'; show('play'); drain();
}
function openDraft() {
  mode = 'draft'; draftOpenAt = performance.now(); finger = null; keys.clear();
  const box = $('offers'); box.textContent = '';
  s.offers.forEach((id, i) => {
    const b = document.createElement('button'), have = s.cards[id] | 0; b.className = 'offer' + (have ? ' held' : ''); b.dataset.card = id;
    b.append(iconCanvas(id, 168)); b.insertAdjacentHTML('beforeend', `<b>${CARD[id].name}</b><span>${CARD[id].words}</span>${pips(have + 1)}`);
    b.setAttribute('aria-label', `${CARD[id].name}: ${CARD[id].words}`);
    b.addEventListener('click', () => choose(i, b)); box.append(b);
  });
  // A scout shows what the next wave brings.
  const row = $('scoutRow'), on = (s.cards.scout | 0) > 0; row.classList.toggle('on', on);
  if (on) { const c = $('scoutArt'), g = c.getContext('2d'), list = Object.entries(nextWave(s)); c.width = list.length * 104; g.clearRect(0, 0, c.width, c.height); g.font = 'bold 30px ui-rounded, system-ui, sans-serif'; g.textBaseline = 'middle'; list.forEach(([type, n], k) => { foe(g, type, k * 104 + 30, 44, -1.57, type === 'stag' ? 24 : 18, 0); g.fillStyle = '#fff8e6'; g.fillText(n, k * 104 + 58, 46); }); }
  $('draftTitle').textContent = `Wave ${s.wave + 1} cleared`;
  show('draft');
}
let choosing = false, pauseAfterPick = false;
function choose(i, b) {
  if (mode !== 'draft' || choosing || performance.now() - draftOpenAt < 350) return;
  choosing = true; snd.unlock(); snd.tone(660, 0.1, 0.09, 'triangle'); later(() => snd.tone(990, 0.22, 0.09, 'triangle'), 90);
  for (const el of $('offers').children) el.classList.add(el === b ? 'chosen' : 'passed');
  later(() => { choosing = false; pick(s, i); mode = 'play'; show('play'); drain(); last = performance.now(); if (pauseAfterPick) { pauseAfterPick = false; pause(); } }, 300);
}
function endLevel(won) {
  if (params.has('give')) won = false; // a look at an effect opens no levels
  const next = won && cur > 0 && cur < LEVELS; save.runs++; persist(); // the long run's best and wins stay its own
  const n = stars(s.queen.hp);
  if (won && cur > 0) { prog.stars[cur] = Math.max(prog.stars[cur] | 0, n); prog.open = Math.max(prog.open, Math.min(LEVELS, cur + 1)); writeJson(LV, prog); }
  if (cur === 0) write('ant-draft:tutorial', '1');
  $('endTitle').textContent = cur === 0 ? 'You are ready!' : won ? `Level ${cur} cleared` : 'The nest fell';
  $('endScore').textContent = cur === 0 ? '' : won ? '★'.repeat(n) + '☆'.repeat(3 - n) : `Level ${cur}`;
  $('endLine').textContent = cur === 0 ? 'Guard the queen with what you learned.' : won ? (cur === LEVELS ? 'All fifty levels cleared!' : `Queen's health ${Math.round(s.queen.hp)}. 80 or more gives three stars.`) : 'Meet the enemies before they reach her.';
  $('again').textContent = cur === 0 ? 'Play' : next ? 'Next level' : 'Again'; $('again').dataset.next = cur === 0 ? (afterTutorial ?? prog.open) : next ? cur + 1 : '';
  $('replay').style.display = next ? '' : 'none';
}
function endRun() {
  if (cur !== null) { mode = 'end'; endLevel(s.phase === 'won'); $('endStats').style.display = 'none'; heldRow(); show('end'); menuNumbers(); return; }
  $('endStats').style.display = ''; $('again').textContent = 'Again'; $('again').dataset.next = ''; $('replay').style.display = 'none';
  const won = s.phase === 'won', sc = score(s); save.runs++; if (won) save.wins++;
  const isBest = sc > save.best; if (isBest) save.best = sc;
  if (daily) { const day = new Date().toDateString(); if (!save.daily || save.daily.day !== day || sc > save.daily.score) save.daily = { day, score: sc }; }
  persist(); mode = 'end';
  $('endTitle').textContent = won ? 'The queen is safe!' : 'The nest fell';
  $('endScore').textContent = sc; $('endWave').textContent = Math.min(s.waves, s.wave + 1); $('endWaves').textContent = s.waves; $('best2').textContent = save.best;
  heldRow();
  $('endLine').textContent = isBest ? 'New best!' : daily ? 'Daily run' : '';
  show('end'); menuNumbers();
}
function heldRow() {
  const held = $('held'); held.textContent = '';
  for (const c of CARDS) { const n = s.cards[c.id] | 0; if (!n) continue; const chip = document.createElement('div'); chip.className = 'chip'; chip.title = c.words; chip.dataset.card = c.id; chip.append(iconCanvas(c.id, 92)); chip.insertAdjacentHTML('beforeend', pips(n)); held.append(chip); }
}
function menuNumbers() {
  $('best').textContent = save.best; $('wins').textContent = save.wins;
  for (const id of ['sound1', 'sound2']) $(id).textContent = `Sound: ${save.sound ? 'on' : 'off'}`;
  $('play').textContent = prog.open === 1 && !prog.stars[1] ? 'Play' : `Level ${prog.open}`;
  $('dailyLine').textContent = save.daily && save.daily.day === new Date().toDateString() ? `Today: ${save.daily.score}` : '';
}
function pause() { keys.clear(); if (mode !== 'play' || paused) return; paused = true; finger = null; snd.hold(); show('paused'); }
function resume() { paused = false; snd.release(); last = performance.now(); show('play'); }
// The phone checks open the long run with ?waves=; everyone else gets the next level.
$('play').onclick = () => { if (params.has('waves')) { cur = null; start(false); } else play(prog.open); };
$('long').onclick = () => { cur = null; start(false); }; $('daily').onclick = () => { cur = null; start(true); };
$('again').onclick = () => { if ($('again').dataset.next) cur = Number($('again').dataset.next); start(daily); };
$('replay').onclick = () => start(false);
$('learn').onclick = $('askYes').onclick = () => { if (mode === 'menu') afterTutorial = null; cur = 0; start(false); };
$('askNo').onclick = () => { write('ant-draft:tutorial', '1'); cur = afterTutorial ?? prog.open; start(false); };
$('toLevels').onclick = openLevels; $('levelsBack').onclick = () => { mode = 'menu'; show('menu'); };
function openLevels() {
  mode = 'levels'; const box = $('levelGrid'); box.textContent = '';
  CHAPTERS.forEach((c, i) => {
    const h = document.createElement('h3'); h.textContent = c.name; box.append(h);
    const row = document.createElement('div'); row.className = 'five'; box.append(row);
    for (let n = i * 5 + 1; n <= i * 5 + 5; n++) { const b = document.createElement('button'), st = prog.stars[n] | 0; b.className = 'lv' + (n === prog.open ? ' now' : ''); b.disabled = n > prog.open; b.dataset.level = n; b.innerHTML = `${n}<small>${'★'.repeat(st) || (n > prog.open ? '🔒' : '&nbsp;')}</small>`; b.setAttribute('aria-label', `Level ${n}`); b.onclick = () => play(n); row.append(b); }
  });
  show('levels'); box.querySelector('.now')?.scrollIntoView({ block: 'center' });
}
$('toMenu').onclick = $('quit').onclick = () => { paused = false; snd.release(); clearTimers(); finger = null; keys.clear(); mode = 'menu'; show('menu'); menuNumbers(); };
$('pause').onclick = pause; $('resume').onclick = resume;
$('sound1').onclick = $('sound2').onclick = () => { save.sound = !save.sound; persist(); menuNumbers(); if (save.sound) snd.tone(660, 0.1, 0.08, 'triangle'); };
onLeave(() => { if (choosing) { keys.clear(); pauseAfterPick = true; } else pause(); });

// ---------- input: the rally point follows the thumb ----------
const fighting = () => mode === 'play' && !paused && s && s.phase === 'fight';
function aim(e) { const lift = e.pointerType === 'mouse' ? 0 : LIFT; setRally(s, (e.clientX - ox) / scale, (e.clientY - lift - oy) / scale); }
canvas.addEventListener('pointerdown', e => { if (!fighting() || finger !== null) return; e.preventDefault(); finger = e.pointerId; snd.unlock(); aim(e); try { canvas.setPointerCapture(e.pointerId); } catch {} });
canvas.addEventListener('pointermove', e => { if (!fighting()) return; if (finger === e.pointerId || (finger === null && e.pointerType === 'mouse')) aim(e); });
for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(t, e => { if (finger === e.pointerId) finger = null; });
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (paused) resume(); else pause(); return; }
  if (mode === 'draft' && ['1', '2', '3'].includes(e.key)) { const b = $('offers').children[Number(e.key) - 1]; if (b) choose(Number(e.key) - 1, b); return; }
  keys.add(e.key.toLowerCase());
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
function applyKeys() {
  const dx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0), dy = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
  if (dx || dy) setRally(s, s.rally.x + dx * 240 * DT, s.rally.y + dy * 240 * DT);
}
const tip = hint(canvas, { kind: 'hold-and-move', key: 'ant-draft:hint', when: fighting, played: playedBefore, bottom: 230 });

// ---------- drawing ----------
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sx = shake > 0.2 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
  ctx.drawImage(ground, Math.round(sx * dpr), Math.round(sy * dpr));
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, (ox + sx) * dpr, (oy + sy) * dpr);
  if (!s) { ant(ctx, QUEEN.x, QUEEN.y, -1.57 + Math.sin(time * 1.5) * 0.08, 17, '#a3261c', time * 0.1, { head: '#7a1a14', crown: 1 }); return; }
  const t = time;
  for (const b of booms) if (!b.puff) { ctx.globalAlpha = 0.35 * Math.min(1, b.t * 8) * Math.max(0, 1 - b.t / 1.4); ctx.fillStyle = '#1a0f0a'; ell(ctx, b.x, b.y, b.r * 0.6, b.r * 0.48); } ctx.globalAlpha = 1; // the burnt ground
  for (const p of s.acid) { const a = Math.min(1, p.life / 0.8); ctx.fillStyle = `rgba(170,245,70,${0.32 * a})`; ell(ctx, p.x, p.y, 17, 13); ctx.fillStyle = `rgba(225,255,150,${0.5 * a})`; ell(ctx, p.x + Math.sin(p.id + t * 3) * 6, p.y + Math.cos(p.id * 2 + t * 2) * 4, 2.2, 2.2); }
  for (const k of s.crumbs) { ctx.fillStyle = '#0b140840'; ell(ctx, k.x + 1, k.y + 2, 4, 2.6); ctx.fillStyle = '#fff0c2'; ctx.beginPath(); ctx.moveTo(k.x - 3.5, k.y + 2); ctx.lineTo(k.x - 1, k.y - 3.4); ctx.lineTo(k.x + 3.4, k.y - 2); ctx.lineTo(k.x + 3, k.y + 2.6); ctx.closePath(); ctx.fill(); }
  // The flag: where the swarm gathers.
  if (s.phase === 'fight') {
    const r = s.rally, pulse = 1 + Math.sin(t * 6) * 0.06;
    ctx.strokeStyle = '#fff8e6aa'; ctx.lineWidth = 2; ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t * 18; ctx.beginPath(); ctx.arc(r.x, r.y, 30 * pulse, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#fff8e622'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, LEASH, 0, 6.3); ctx.stroke();
    ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(r.x, r.y + 3); ctx.lineTo(r.x, r.y - 20); ctx.stroke();
    ctx.fillStyle = '#ffe23a'; ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r.x, r.y - 20); ctx.lineTo(r.x + 13 + Math.sin(t * 9) * 1.5, r.y - 15.5); ctx.lineTo(r.x, r.y - 11); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // The queen, on her mound.
  const q = s.queen, beat = 1 + Math.sin(t * 3) * 0.03 + (q.hurt > 0 ? 0.12 : 0);
  ant(ctx, QUEEN.x, QUEEN.y + 2, -1.57 + Math.sin(t * 1.3) * 0.07, 17 * beat, q.hurt > 0 ? '#ff5a4a' : '#a3261c', t * 0.08, { head: '#7a1a14', crown: 1 });
  for (const a of s.ants) { const [col, head, sz] = ANT[a.kind], pop = Math.min(1, (s.t - a.born) * 5 + 0.3); ant(ctx, a.x, a.y, a.ang, sz * pop, col, t + a.id, { head }); if (a.carry) { ctx.fillStyle = '#fff0c2'; ell(ctx, a.x + Math.cos(a.ang) * 6, a.y + Math.sin(a.ang) * 6, 3.2, 2.6); if (a.carry > 1) ell(ctx, a.x + Math.cos(a.ang) * 2, a.y + Math.sin(a.ang) * 2 - 3, 2.8, 2.3); } }
  for (const f of s.foes) {
    foe(ctx, f.type, f.x, f.y, f.ang, f.r, t + f.id, f.flash);
    if (f.slow > 0) { ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 4, t * 4, t * 4 + 4); ctx.stroke(); }
    if (f.hp < f.max || f.type === 'stag') { const w = f.r * 2.2; ctx.fillStyle = '#0b1408aa'; ctx.fillRect(f.x - w / 2 - 1, f.y - f.r - 9, w + 2, 5); ctx.fillStyle = '#ff5a4a'; ctx.fillRect(f.x - w / 2, f.y - f.r - 8, w * Math.max(0, f.hp / f.max), 3); }
  }
  labels();
  for (const p of s.spits) { ctx.fillStyle = '#e9d8ff'; ell(ctx, p.x, p.y, 3.4, 3.4); ctx.fillStyle = '#e9d8ff55'; ell(ctx, p.x, p.y, 6, 6); }
  // A scout marks where the next enemies come in.
  if (s.cards.scout && s.phase === 'fight') for (const p of s.pending) { const dt = p.at - s.waveT; if (dt > 3) break; const a = 0.5 + 0.5 * Math.sin(t * 10); ctx.fillStyle = FOECOL[p.type]; ctx.globalAlpha = 0.5 + 0.5 * a; ctx.beginPath(); ctx.moveTo(p.x - 8, 4); ctx.lineTo(p.x + 8, 4); ctx.lineTo(p.x, 16 + a * 3); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
  for (const r of rings) { const k = 1 - r.life / r.max; ctx.strokeStyle = r.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3 * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.3 + k), 0, 6.3); ctx.stroke(); }
  for (const p of parts) { ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6); ctx.fillStyle = p.col; ell(ctx, p.x, p.y, p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const b of booms) boomDraw(b);
  for (const f of floats) { const k = Math.min(1, f.age / 0.9), sz = f.big ? 19 : f.col === '#ffe23a' ? 14 : 11; ctx.globalAlpha = 1 - k * k; text(`-${f.n < 1 ? f.n.toFixed(1) : Math.round(f.n)}`, Math.max(16, Math.min(W - 16, f.x)), Math.max(62, f.y - k * 22), sz, f.col); } ctx.globalAlpha = 1;
  swarmBar();
  if (cur === 0 && s.phase === 'fight') tutorialTip();
  // Queen's health, over the mound.
  const bw = 78, bx = QUEEN.x - bw / 2, by = QUEEN.y + 31, k = q.hp / q.max;
  ctx.fillStyle = '#3a2a22'; rr(bx - 2, by - 2, bw + 4, 11, 5); ctx.fill(); ctx.fillStyle = '#5a1a14'; rr(bx, by, bw, 7, 3.5); ctx.fill();
  if (k > 0) { ctx.fillStyle = k > 0.5 ? '#8dff8a' : k > 0.25 ? '#ffe23a' : '#ff5a4a'; rr(bx, by, Math.max(6, bw * k), 7, 3.5); ctx.fill(); }
  // Wave pips, the ant count and the held cards.
  const n = s.waves, gap = 17, px0 = W / 2 - (n - 1) * gap / 2;
  for (let i = 0; i < n; i++) { const cur = i === s.wave, done = i < s.wave || s.phase === 'won'; ctx.fillStyle = '#3a2a22'; ell(ctx, px0 + i * gap, 20, 6.5, 6.5); ctx.fillStyle = done ? '#ffe23a' : cur ? '#ff7a3a' : '#fff8e655'; const pr = cur ? 4.6 + Math.sin(t * 6) * 0.9 : 4.4; ell(ctx, px0 + i * gap, 20, pr, pr); }
  ctx.font = 'bold 15px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ant(ctx, 20, 21, -0.5, 7, '#d2321f', 0, { head: '#8a1f1a' }); ctx.lineWidth = 3.5; ctx.strokeStyle = '#3a2a22'; ctx.fillStyle = '#fff8e6';
  const count = String(s.ants.filter(a => a.kind !== 'worker').length); ctx.strokeText(count, 33, 22); ctx.fillText(count, 33, 22);
  let hi = 0; for (const c of CARDS) { const lv = s.cards[c.id] | 0; if (!lv) continue; const x = 8 + (hi % 2) * 29, y = 40 + Math.floor(hi / 2) * 31; hi++; ctx.fillStyle = '#fff8e6dd'; ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 1.5; rr(x, y, 26, 26, 7); ctx.fill(); ctx.stroke(); ctx.drawImage(small(c.id), x + 2, y + 2, 22, 22); for (let i = 0; i < lv; i++) { ctx.fillStyle = '#ffb42a'; ell(ctx, x + 6 + i * 7, y + 26, 2.6, 2.6); ctx.stroke(); } }
  if (banner) { const a = banner.t < 0.25 ? banner.t / 0.25 : Math.max(0, 1 - (banner.t - 1.1) / 0.5), sc = 1 + (1 - Math.min(1, banner.t / 0.25)) * 0.6; ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 200); ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.font = 'bold 44px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = '#3a2a22'; ctx.fillStyle = '#ffe23a'; ctx.strokeText(banner.text, 0, 0); ctx.fillText(banner.text, 0, 0); ctx.restore(); }
  if (redFlash > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,58,42,${redFlash * 0.9})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}
function text(str, x, y, size, col, align = 'center') { ctx.font = `bold ${size}px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, size / 4.5); ctx.strokeStyle = '#2a1a12'; ctx.fillStyle = col; ctx.strokeText(str, x, y); ctx.fillText(str, x, y); }
// Each enemy's name and health over it (tester note #207). In a crowd the one nearest the queen keeps its label and the ones under it drop the name.
const NAME = { aphid: 'Aphid', beetle: 'Beetle', wasp: 'Wasp', spider: 'Spider', stag: 'Stag beetle' };
function labels() {
  const put = [];
  for (const f of [...s.foes].sort((a, b) => b.y - a.y)) {
    if (f.hp <= 0 || f.y < -4) continue;
    const y = f.y < 72 ? f.y + f.r + 10 : f.y - f.r - 15, x = Math.max(30, Math.min(W - 30, f.x)), hp = Math.max(1, Math.ceil(f.hp));
    if (put.every(p => Math.abs(p.x - x) > 52 || Math.abs(p.y - y) > 13)) { text(`${NAME[f.type]} ${hp}`, x, y, 11, '#fff8e6'); put.push({ x, y }); }
    else if (put.every(p => Math.abs(p.x - x) > 18 || Math.abs(p.y - y) > 11)) { text(hp, x, y, 10, '#fff8e6'); put.push({ x, y }); }
  }
}
// The whole swarm's health in one bar. The full mark is the most health the swarm has had this wave, so a dead ant makes it drop.
function swarmHealth() { let hp = 0; for (const a of s.ants) if (a.kind !== 'worker') hp += Math.max(0, a.hp); return hp; }
function swarmBar() {
  const hp = swarmHealth(); peak = Math.max(peak, hp); lost = lost === null || lost < hp ? hp : lost + (hp - lost) * 0.06;
  const w = 190, x = W / 2 - w / 2, y = 34, k = peak ? hp / peak : 0, k2 = peak ? lost / peak : 0;
  ctx.fillStyle = '#3a2a22'; rr(x - 2, y - 2, w + 4, 15, 7); ctx.fill(); ctx.fillStyle = '#5a1a14'; rr(x, y, w, 11, 5); ctx.fill();
  if (k2 > 0.02) { ctx.fillStyle = '#fff0c2'; rr(x, y, Math.max(10, w * k2), 11, 5); ctx.fill(); }
  if (k > 0.02) { ctx.fillStyle = k > 0.5 ? '#ff7a3a' : k > 0.25 ? '#ffb42a' : '#ff3a2a'; rr(x, y, Math.max(10, w * k), 11, 5); ctx.fill(); }
  text(`Ants ${Math.ceil(hp)} / ${Math.ceil(peak)}`, W / 2, y + 6, 11, '#fff8e6');
}
function boomDraw(b) {
  const k = Math.min(1, b.t / (b.puff ? 0.35 : 0.5));
  if (b.puff) { ctx.strokeStyle = `rgba(255,120,100,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.3 + k), 0, 6.3); ctx.stroke(); return; }
  // A flash, a lumpy fireball that fills the reach of the blast, its edge running outward, then smoke that rises and thins.
  const f = Math.min(1, b.t / 0.5), n = 6;
  if (b.t > 0.12) for (let i = 0; i < n; i++) { const q = Math.min(1, (b.t - 0.12) / 1.28), a = b.spin + i / n * 6.28, d = b.r * (0.25 + 0.4 * q); ctx.fillStyle = `rgba(58,46,40,${0.42 * (1 - q)})`; ell(ctx, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d * 0.7 - b.r * 0.55 * q, b.r * (0.2 + 0.2 * q), b.r * (0.18 + 0.18 * q)); }
  if (f >= 1) return;
  const R = b.r * (0.55 + 0.5 * Math.sqrt(f)), fade = 1 - f * f;
  for (let i = 0; i <= n; i++) { // the last lump is the middle
    const mid = i === n, a = b.spin + i / n * 6.28, d = mid ? 0 : R * 0.48, r = mid ? R * 0.8 : R * 0.5, x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d, g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,${mid ? 250 : 190},${mid ? 210 : 60},${fade})`); g.addColorStop(0.5, `rgba(255,150,30,${0.9 * fade})`); g.addColorStop(1, 'rgba(200,40,10,0)'); ctx.fillStyle = g; ell(ctx, x, y, r, r);
  }
  if (b.t < 0.09) { ctx.fillStyle = `rgba(255,255,240,${0.9 - b.t * 8})`; ell(ctx, b.x, b.y, b.r * 0.9, b.r * 0.9); }
  ctx.strokeStyle = `rgba(255,240,200,${1 - f})`; ctx.lineWidth = 5 * (1 - f) + 0.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.4 + 0.7 * f), 0, 6.3); ctx.stroke();
}
// The tutorial shows one line at a time, for what is on the field now.
function tutorialTip() {
  const has = t => s.foes.some(f => f.type === t);
  tipText = s.wave === 0 ? (s.waveT < 4.5 ? 'Drag anywhere: your ants follow the flag' : s.foes.length ? 'Put the flag on the aphid. Your ants bite it' : s.crumbs.length ? 'Workers carry the food home. 3 food = a new ant' : 'More aphids are coming')
    : s.wave === 1 ? (has('beetle') ? 'Its name and health are above it. The top bar is your ants' : s.foes.length ? 'Each bite shows its damage' : 'Cards stack up: you pick one after every wave')
    : has('spider') ? 'Spiders spit from far away. Go and get them' : has('wasp') ? 'Wasps hunt your workers. Guard them' : 'In a real level, keep the queen alive';
  ctx.font = 'bold 15px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';
  const words = tipText.split(' '), lines = ['']; for (const w of words) { const t = lines.at(-1) ? `${lines.at(-1)} ${w}` : w; if (ctx.measureText(t).width > 250) lines.push(w); else lines[lines.length - 1] = t; }
  const y0 = 76; ctx.fillStyle = '#fff8e6f0'; ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 2; rr(W / 2 - 138, y0, 276, 16 + lines.length * 20, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2a22'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + 18 + i * 20));
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; time += dt;
  if (mode === 'play' && !paused && s) {
    if (s.phase === 'fight') { acc += dt; while (acc >= DT && s.phase === 'fight') { acc -= DT; applyKeys(); step(s); drain(); } }
    if (pendingDraft > 0 && (pendingDraft -= dt) <= 0) openDraft();
    if (pendingEnd > 0 && (pendingEnd -= dt) <= 0) endRun();
  }
  if (!paused) {
    for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    for (const f of floats) f.age += dt; for (const b of booms) b.t += dt; floats = floats.filter(f => f.age < 0.9); booms = booms.filter(b => b.t < (b.puff ? 0.35 : 1.4));
    for (const r of rings) r.life -= dt;
    parts = parts.filter(p => p.life > 0); rings = rings.filter(r => r.life > 0);
    if (banner && (banner.t += dt) > 1.6) banner = null;
    shake *= Math.pow(0.002, dt); if (redFlash > 0) redFlash -= dt;
  }
  if (groundChecks > 0 && Math.round(time * 60) % 10 === 0) { groundChecks--; if (!groundOk()) paintGround(); if (!menuArtOk()) menuArt(); }
  draw(); requestAnimationFrame(frame);
}
// Menu art: the queen and two soldiers.
function menuArtOk() { try { return $('menuArt').getContext('2d').getImageData(150, 150, 1, 1).data[3] > 0; } catch { return true; } }
function menuArt() { const g = $('menuArt').getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 150, 110); ant(g, 75, 62, -1.57, 30, '#a3261c', 0, { head: '#7a1a14', crown: 1, flat: 1 }); ant(g, 28, 70, -1.1, 12, '#d2321f', 0.05, { head: '#8a1f1a', flat: 1 }); ant(g, 122, 70, -2.0, 12, '#ffb42a', 0.1, { head: '#c57a12', flat: 1 }); }
menuArt(); menuNumbers(); requestAnimationFrame(frame);

// For check.mjs: what is on screen, in page pixels.
window.antDraftState = () => {
  const f = s && threat(s), px = p => p && { x: ox + p.x * scale, y: oy + p.y * scale };
  return { mode, paused, phase: s?.phase, wave: s?.wave, waves: s?.waves, hp: s?.queen.hp, ants: s?.ants.length, foes: s?.foes.length, kills: s?.kills, offers: s ? [...s.offers] : [], picks: s ? [...s.picks] : [], cards: s ? { ...s.cards } : {},
    rally: s && px(s.rally), aim: px(f && { x: f.x, y: Math.min(f.y + 6, QUEEN.y - 30) }), lift: LIFT, hint: tip.shown, cur, open: prog.open, swarm: s && swarmHealth(), peak, boomed, hitsShown, floats: floats.length, tip: cur === 0 ? tipText : '', best: save.best, runs: save.runs, seed: s?.seed, t: s?.t };
};
