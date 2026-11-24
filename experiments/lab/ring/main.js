import { create, step, dropThread, dailySeed, stars, mulberry, DT, W as FW, H as FH, LX, LY, JAR, NIGHT, MAXC, FLY, MOTH, GOLD, LEVELS, REKINDLE } from './sim.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { t, lang, apply, setLang, num, dateLabel } from './words.js';

noZoom();
const $ = id => document.getElementById(id);
const canvas = $('c'), g = canvas.getContext('2d');
const query = new URLSearchParams(location.search);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = 'ring:v1';
const stored = readJson(KEY, null), played = stored !== null;
const save = { v: 1, sound: true, nights: 0, dawns: 0, best: 0, bestRing: 0, endless: false, endlessBest: 0, daily: {}, ...(stored || {}) };
const persist = () => writeJson(KEY, save);
const today = /^\d{4}-\d{2}-\d{2}$/.test(query.get('date') || '') ? query.get('date') : new Date().toISOString().slice(0, 10);
const practiceLevel = Math.max(0, Math.min(NIGHT, Number(query.get('level')) | 0));
const snd = sound({ on: () => save.sound });

const COLOR = ['#ffa443', '#5fe3b0', '#ff7fc0', '#fff07a'];
const CORE = ['#fff1d6', '#eafff6', '#ffeaf6', '#ffffff'];

// Layout: a band at the top for jars, wicks and pause; the field below, scaled to fit.
let VW = 0, VH = 0, dpr = 1, sc = 1, ox = 0, oy = 0, safeTop = 0, safeBottom = 0, band = 64;
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;left:0;top:0;width:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';
document.body.append(probe);
let back = null, dawnTint = null;
const sprites = [], glowSprite = document.createElement('canvas');
function sprite(color, core, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), h = size / 2, gr = x.createRadialGradient(h, h, 0, h, h, h);
  gr.addColorStop(0, core); gr.addColorStop(0.12, core); gr.addColorStop(0.25, color); gr.addColorStop(0.55, color + '44'); gr.addColorStop(1, color + '00');
  x.fillStyle = gr; x.fillRect(0, 0, size, size);
  return c;
}
for (let k = 0; k < 4; k++) sprites.push(sprite(COLOR[k], CORE[k], 64));
const headSprite = sprite('#ffd9a0', '#ffffff', 64);
{
  glowSprite.width = glowSprite.height = 128;
  const x = glowSprite.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, '#ffd28aaa'); gr.addColorStop(0.3, '#ff9a3c44'); gr.addColorStop(1, '#ff9a3c00');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
}
function layout() {
  VW = innerWidth; VH = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(VW * dpr); canvas.height = Math.round(VH * dpr);
  const cs = getComputedStyle(probe); safeTop = parseFloat(cs.paddingTop) || 0; safeBottom = parseFloat(cs.paddingBottom) || 0;
  band = safeTop + 62;
  const room = VH - band - safeBottom - 6;
  sc = Math.min(VW / FW, room / FH); ox = (VW - FW * sc) / 2; oy = band + Math.max(0, (room - FH * sc) * 0.3);
  paintBack();
}
// The meadow behind everything is painted once per resize.
function paintBack() {
  back = document.createElement('canvas'); back.width = canvas.width; back.height = canvas.height;
  const b = back.getContext('2d'); b.scale(dpr, dpr);
  const sky = b.createLinearGradient(0, 0, 0, VH);
  sky.addColorStop(0, '#05070f'); sky.addColorStop(0.55, '#081320'); sky.addColorStop(1, '#0b1a17');
  b.fillStyle = sky; b.fillRect(0, 0, VW, VH);
  let r = 7;
  const rand = () => mulberry(r++);
  for (let i = 0; i < 90; i++) { b.fillStyle = `rgba(255,240,220,${0.15 + rand() * 0.5})`; const z = rand() < 0.12 ? 1.6 : 1; b.fillRect(rand() * VW, rand() * VH * 0.5, z, z); }
  b.fillStyle = '#060d10';
  b.beginPath(); b.moveTo(0, VH * 0.42);
  for (let x = 0; x <= VW + 20; x += 20) b.lineTo(x, VH * 0.4 - 14 * Math.sin(x * 0.013) - 10 * rand());
  b.lineTo(VW, VH); b.lineTo(0, VH); b.fill();
  const meadow = b.createLinearGradient(0, VH * 0.4, 0, VH);
  meadow.addColorStop(0, '#08141400'); meadow.addColorStop(1, '#0d2219');
  b.fillStyle = meadow; b.fillRect(0, VH * 0.4, VW, VH * 0.6);
  b.strokeStyle = '#0f2a1e'; b.lineWidth = 1.4; b.lineCap = 'round';
  for (let i = 0; i < VW / 3; i++) {
    const x = rand() * VW, y = VH - rand() * 26 - safeBottom * 0.3, h = 12 + rand() * 30;
    b.beginPath(); b.moveTo(x, VH); b.quadraticCurveTo(x + 2, y, x + (rand() - 0.5) * 14, y - h); b.stroke();
  }
  dawnTint = g.createLinearGradient(0, VH, 0, 0);
  dawnTint.addColorStop(0, '#ff9a6c'); dawnTint.addColorStop(0.5, '#c06a8a55'); dawnTint.addColorStop(1, '#3a3a7000');
}
addEventListener('resize', layout); layout();

// Runs
let s = create(1, { start: 0 }), mode = 'menu', kind = 'night', scored = false, acc = 0, last = performance.now(), endAt = 0;
const finger = { id: -1, down: false, lift: false, x: 0, y: 0 };
const show = screens(['menu', 'paused', 'end'], name => {
  $('pause').classList.toggle('on', name === 'play');
});
function begin(k) {
  kind = k; snd.unlock();
  const seed = k === 'daily' ? dailySeed(today) : (Math.random() * 4294967296) >>> 0;
  if (k === 'practice') s = create(seed, { start: practiceLevel - 1, single: true });
  else s = create(seed, { mode: k === 'endless' ? 'endless' : 'night' });
  scored = k === 'daily' && !save.daily[today];
  if (scored) { save.daily[today] = { score: 0, fills: [], stars: 0, ring: 0 }; trimDaily(); persist(); }
  acc = 0; last = performance.now(); finger.down = false; finger.lift = false; finger.id = -1;
  effects.length = 0; pops.length = 0; banner = 0; flare = 0; shake = 0;
  for (let i = 0; i < NP; i++) pl[i] = 0;
  handle();
  mode = 'play'; show('play');
}
function trimDaily() { const keys = Object.keys(save.daily).sort(); while (keys.length > 40) delete save.daily[keys.shift()]; }
function pauseGame() {
  if (mode !== 'play') return;
  mode = 'paused'; finger.down = false; finger.lift = false; dropThread(s); snd.hold();
  pauseText();
  show('paused');
}
function pauseText() {
  $('pauseLine').textContent = kind === 'endless' ? t('pauseEndless', { score: num(s.score) }) : kind === 'practice' ? t('pausePractice', { n: num(s.level + 1) }) : t('pauseNight', { n: num(s.level + 1), total: num(NIGHT), score: num(s.score) });
}
function resume() { if (mode !== 'paused') return; snd.release(); mode = 'play'; last = performance.now(); acc = 0; show('play'); }
function toMenu() { snd.release(); mode = 'menu'; menuText(); show('menu'); }
onLeave(pauseGame);
addEventListener('keydown', e => { if (!isPauseKey(e)) return; if (mode === 'play') pauseGame(); else if (mode === 'paused') resume(); });
$('pause').addEventListener('click', pauseGame);
$('resume').addEventListener('click', resume);
$('restart').addEventListener('click', () => { snd.release(); begin(kind === 'daily' ? 'night' : kind); });
$('toMenu').addEventListener('click', toMenu);
$('endMenu').addEventListener('click', toMenu);
$('again').addEventListener('click', () => begin(kind === 'daily' ? 'night' : kind));
$('play').addEventListener('click', () => begin(practiceLevel ? 'practice' : 'night'));
$('daily').addEventListener('click', () => begin('daily'));
$('endless').addEventListener('click', () => { if (save.endless) begin('endless'); });
for (const id of ['sound', 'sound2']) $(id).addEventListener('click', () => { save.sound = !save.sound; persist(); soundText(); if (save.sound) snd.unlock(); });
function soundText() { for (const id of ['sound', 'sound2']) $(id).textContent = t(save.sound ? 'soundOn' : 'soundOff'); }
// Switching language redraws every piece of text the page owns, including the card in view and the words on the canvas.
function allText() {
  apply();
  document.title = t('title');
  for (const id of ['lang', 'lang2']) { $(id).textContent = t('otherLang'); $(id).lang = lang() === 'en' ? 'tr' : 'en'; }
  const words = document.querySelector('.kit-hint .label');
  if (words) words.textContent = t('hintLabel');
  menuText();
  if (mode === 'paused') pauseText();
}
for (const id of ['lang', 'lang2']) $(id).addEventListener('click', () => { setLang(lang() === 'en' ? 'tr' : 'en'); lastScore = -1; allText(); });
function menuText() {
  soundText();
  const d = save.daily[today];
  $('dailyNote').textContent = d ? t('dailyDone', { n: num(d.score) }) : t('dailyNew');
  $('endless').disabled = !save.endless;
  $('endlessNote').textContent = save.endless ? (save.endlessBest ? t('endlessBest', { n: num(save.endlessBest) }) : t('endlessOpen')) : t('endlessLocked');
  $('best').textContent = save.best ? t('best', { n: num(save.best), ring: num(save.bestRing) }) : '';
  $('play').textContent = practiceLevel ? t('practise', { n: num(practiceLevel) }) : t('play');
}
allText();

// Input: one finger. The head is sampled once per sim step; a lift waits until a step has seen the last position.
const toFieldX = x => (x - ox) / sc, toFieldY = y => (y - oy) / sc;
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'play' || finger.down) return;
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  finger.id = e.pointerId; finger.down = true; finger.lift = false; finger.x = e.clientX; finger.y = e.clientY;
  snd.unlock();
});
canvas.addEventListener('pointermove', e => { if (e.pointerId === finger.id && finger.down && !finger.lift) { finger.x = e.clientX; finger.y = e.clientY; } });
const up = e => { if (e.pointerId === finger.id && finger.down) { finger.x = e.clientX; finger.y = e.clientY; finger.lift = true; } };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', e => { if (e.pointerId === finger.id) { finger.down = false; finger.lift = false; finger.id = -1; dropThread(s); } });

hint(canvas, { kind: 'hold-and-move', key: 'ring:hint', when: () => mode === 'play' && s.phase === 'play', played, label: t('hintLabel') });
allText();

// Effects: rare objects for rings, a fixed pool for particles.
const effects = [], pops = [];
const NP = 260, px = new Float32Array(NP), py = new Float32Array(NP), pvx = new Float32Array(NP), pvy = new Float32Array(NP), pl = new Float32Array(NP), pm = new Float32Array(NP), pc = new Uint8Array(NP);
let pNext = 0, banner = 0, bannerTitle = null, bannerTip = null, flare = 0, shake = 0, lastScore = -1, scoreText = '0';
function burst(x, y, n, col, speed, life) {
  if (calm) n = Math.ceil(n / 3);
  for (let k = 0; k < n; k++) {
    const i = pNext; pNext = (pNext + 1) % NP;
    const a = Math.random() * 6.283, v = speed * (0.3 + Math.random() * 0.7);
    px[i] = x; py[i] = y; pvx[i] = Math.cos(a) * v; pvy[i] = Math.sin(a) * v; pl[i] = pm[i] = life * (0.6 + Math.random() * 0.4); pc[i] = col;
  }
}
const PENTA = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568, 1760];
function chime(n) {
  const top = Math.min(PENTA.length - 1, n + 1), from = Math.max(0, top - Math.min(5, n));
  for (let k = from; k <= top; k++) setTimeout(() => { snd.tone(PENTA[k], 0.5, 0.05, 'sine'); snd.tone(PENTA[k] * 2, 0.3, 0.012, 'triangle'); }, (k - from) * 65);
}
const threadCopy = new Float32Array(1024);
let threadCopyN = 0;
function handle() {
  for (const e of s.ev) {
    if (e.type === 'level') {
      banner = calm ? 1.6 : 2.2;
      bannerTitle = kind === 'endless' ? (e.round ? ['round', { n: e.round + 1 }] : ['endless']) : ['level', { n: e.level + 1 }];
      bannerTip = kind === 'endless' && e.round ? ['freshJars'] : ['tip' + e.level];
    } else if (e.type === 'ring') {
      effects.push({ type: 'ring', poly: e.poly, caught: e.caught, n: e.n, col: e.color, x: e.x, y: e.y, t: 0, dur: calm ? 0.55 : 0.95 });
      pops.push({ x: e.x, y: e.y, t: 0, text: `+${num(e.points)}` });
      chime(e.n);
      if (e.n > save.bestRing) { save.bestRing = e.n; persist(); }
      if (e.gold) { setTimeout(() => chime(9), 200); }
    } else if (e.type === 'mixed') {
      effects.push({ type: 'mixed', poly: e.poly, x: e.x, y: e.y, t: 0, dur: 0.75 });
      snd.tone(110, 0.28, 0.16, 'triangle', -50); snd.noise(0.18, 0.22, 260);
      if (!calm) shake = Math.max(shake, 5);
    } else if (e.type === 'moths') {
      effects.push({ type: 'moths', poly: e.poly, x: e.x, y: e.y, t: 0, dur: 0.6 });
      pops.push({ x: e.x, y: e.y, t: 0, text: `+${num(e.points)}` });
      snd.tone(330, 0.25, 0.05, 'sine', 80);
    } else if (e.type === 'empty') {
      effects.push({ type: 'empty', poly: e.poly, x: e.x, y: e.y, t: 0, dur: 0.4 });
      snd.tone(260, 0.12, 0.03, 'sine');
    } else if (e.type === 'snap') {
      for (let k = 0; k < threadCopyN; k += 6) burst(threadCopy[k], threadCopy[k + 1], 2, 4, 40, 0.6);
      burst(ox + e.x * sc, oy + e.y * sc, 14, 5, 90, 0.7);
      snd.noise(0.1, 0.25, 2600); snd.tone(420, 0.22, 0.08, 'sawtooth', -300);
      if (!calm) shake = 9;
      navigator.vibrate?.(60);
    } else if (e.type === 'eat') {
      burst(ox + e.x * sc, oy + e.y * sc, 10, e.color, 70, 0.5);
      snd.tone(180, 0.1, 0.06, 'square', -80);
    } else if (e.type === 'bat') { snd.tone(1900, 0.05, 0.025, 'sine'); setTimeout(() => snd.tone(2100, 0.05, 0.025, 'sine'), 120); }
    else if (e.type === 'gust') snd.noise(0.8, 0.05, 500);
    else if (e.type === 'golden') { snd.tone(1568, 0.4, 0.03, 'sine'); setTimeout(() => snd.tone(2093, 0.5, 0.03, 'sine'), 110); }
    else if (e.type === 'end' || e.type === 'full') {
      if (e.full !== false) { for (let k = 0; k < 3; k++) setTimeout(() => snd.tone(1318.5 + k * 260, 0.35, 0.04, 'triangle'), k * 90); }
      else snd.tone(196, 0.5, 0.06, 'sine', -40);
      if (e.bonus) pops.push({ x: LX, y: 70, t: -0.3, text: t('dawnBonus', { n: num(e.bonus) }) });
    } else if (e.type === 'over') { mode = 'ending'; endAt = performance.now() + 1400; show('ending'); }
  }
}
function tick() {
  const hx = finger.down ? toFieldX(finger.x) : NaN, hy = finger.down ? toFieldY(finger.y) : NaN;
  step(s, hx, hy);
  if (finger.lift) { finger.down = false; finger.lift = false; finger.id = -1; }
  handle();
}

// The end card and its picture.
let picture = null;
function drawJar(c, x, y, w, h, f, lit) {
  const neck = h * 0.16, r = w * 0.24;
  c.beginPath();
  c.moveTo(x + w * 0.2, y + neck); c.lineTo(x + w * 0.8, y + neck);
  c.quadraticCurveTo(x + w, y + neck, x + w, y + neck + r); c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + neck + r);
  c.quadraticCurveTo(x, y + neck, x + w * 0.2, y + neck); c.closePath();
  c.fillStyle = '#ffffff0d'; c.fill();
  if (f > 0) {
    c.save(); c.clip();
    const top = y + h - (h - neck) * Math.min(1, f);
    c.globalAlpha = 0.55 + 0.45 * lit; c.fillStyle = '#ffbf55'; c.fillRect(x, top, w, y + h - top);
    c.globalAlpha = 0.9; c.fillStyle = '#fff3c4';
    for (let k = 0; k < 4; k++) { const dy = top + (y + h - top) * ((k * 0.37 + 0.2) % 1); c.fillRect(x + w * ((k * 0.29 + 0.18) % 0.8) + 2, dy, 2, 2); }
    c.restore();
  }
  c.globalAlpha = 1; c.strokeStyle = f >= 1 ? '#ffe7b0' : '#ffe2b088'; c.lineWidth = Math.max(1.2, w / 20); c.stroke();
  c.fillStyle = '#8a6a3c'; c.fillRect(x + w * 0.16, y, w * 0.68, neck * 0.8);
}
function jarRow(c, x, y, width, fills, count) {
  const gap = width / count, w = Math.min(gap * 0.64, 52), h = w * 1.3;
  for (let k = 0; k < count; k++) drawJar(c, x + gap * k + (gap - w) / 2, y, w, h, fills[k] || 0, fills[k] >= 1 ? 1 : 0.3);
}
function finish() {
  mode = 'end';
  const st = stars(s), fills = Array.from(s.results), lines = [], wicks = s.reason === 'wicks';
  let top = t('endDawn'), title = wicks ? t('endWicksTitle') : t(['titleFirst', 'titleFirst', 'titleFine', 'titlePerfect'][st]);
  if (wicks) top = t('endWicksTop');
  if (kind === 'endless') {
    top = t('endless'); title = s.round ? t(s.round === 1 ? 'rounds1' : 'roundsN', { n: num(s.round) }) : t('dawnCame');
    const better = s.score > save.endlessBest; if (better) save.endlessBest = s.score;
    lines.push(better ? t('newBestDevice') : t('bestDevice', { n: num(save.endlessBest) }));
  } else if (kind === 'practice') {
    top = t('pausePractice', { n: num(s.level + 1) }); title = t(s.cleared ? 'jarsFull' : 'dawnFirst');
    lines.push(t('practiceNote'));
  } else {
    lines.push(t('levelsFull', { n: num(s.cleared), total: num(NIGHT) }));
    save.nights++;
    if (!wicks) { save.dawns++; if (!save.endless) { save.endless = true; lines.push(t('endlessOpened')); } }
    if (kind === 'daily') {
      top = t('dailyTop', { date: dateLabel(today) });
      if (scored) { save.daily[today] = { score: s.score, fills: fills.map(f => Math.round(f * 100) / 100), stars: st, ring: s.bestRing }; lines.push(t('scoredRun')); }
      else lines.push(t('practiceDaily', { n: num(save.daily[today]?.score ?? 0) }));
    } else if (s.score > save.best) { save.best = s.score; lines.push(t('newBestNight')); }
  }
  if (s.bestRing > save.bestRing) save.bestRing = s.bestRing;
  persist();
  $('endTop').textContent = top; $('endTitle').textContent = title; $('endLine').textContent = lines.join(' ');
  $('total').textContent = num(s.score); $('bestRing').textContent = num(s.bestRing);
  const showJars = kind !== 'endless';
  $('jarRow').style.display = showJars ? 'block' : 'none'; $('stars').style.display = kind === 'night' || kind === 'daily' ? 'block' : 'none';
  $('stars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
  const jr = $('jarRow'), jc = jr.getContext('2d');
  jc.clearRect(0, 0, jr.width, jr.height);
  if (kind === 'practice') jarRow(jc, jr.width / 2 - 40, 14, 80, [fills[s.level]], 1);
  else jarRow(jc, 0, 14, jr.width, fills, NIGHT);
  $('saveNote').textContent = '';
  makePicture(top, title, fills, st);
  show('end');
}
function makePicture(top, title, fills, st) {
  picture = null;
  const c = document.createElement('canvas'); c.width = 720; c.height = 420;
  const x = c.getContext('2d'), bg = x.createLinearGradient(0, 0, 0, 420);
  bg.addColorStop(0, '#05070f'); bg.addColorStop(1, '#0d2219'); x.fillStyle = bg; x.fillRect(0, 0, 720, 420);
  x.drawImage(glowSprite, 260, -40, 200, 200);
  x.textAlign = 'center'; x.fillStyle = '#ffd9a0'; x.font = '44px Georgia, serif'; x.fillText(t('title'), 360, 70);
  x.fillStyle = '#f3e6cfbb'; x.font = '22px Georgia, serif'; x.fillText(top, 360, 108);
  if (kind === 'endless') { x.font = '30px Georgia, serif'; x.fillStyle = '#f3e6cf'; x.fillText(title, 360, 210); }
  else jarRow(x, 40, 140, 640, kind === 'practice' ? fills.slice(s.level, s.level + 1) : fills, kind === 'practice' ? 1 : NIGHT);
  x.fillStyle = '#ffd27a'; x.font = '40px Georgia, serif';
  if (kind === 'night' || kind === 'daily') x.fillText('★'.repeat(st) + '☆'.repeat(3 - st), 360, 300);
  x.fillStyle = '#f3e6cf'; x.font = '26px Georgia, serif'; x.fillText(t('picScore', { score: num(s.score), ring: num(s.bestRing) }), 360, 360);
  try { c.toBlob(b => { picture = b; }, 'image/png'); } catch {}
}
$('savePic').addEventListener('click', async () => {
  if (!picture) { $('saveNote').textContent = t('picNotReady'); return; }
  const name = t('imageName', { name: kind === 'daily' ? today : 'night' });
  try {
    const file = new File([picture], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: t('title') }); $('saveNote').textContent = t('shared'); return; }
  } catch (err) { if (err?.name === 'AbortError') return; }
  const url = URL.createObjectURL(picture), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  $('saveNote').textContent = t('saved');
});

// Drawing.
const X = x => ox + x * sc, Y = y => oy + y * sc;
function brightness(k, col, p) {
  if (k === GOLD) return 0.85 + 0.15 * Math.sin(p * 37.7);
  if (col === 0) return 0.5 + 0.5 * Math.sin(p * 6.283);
  if (col === 1) { const a = (p - 0.1) / 0.05, b = (p - 0.3) / 0.05; return 0.3 + 0.7 * Math.max(Math.exp(-a * a), Math.exp(-b * b)); }
  return p < 0.78 ? 0.95 : 0.3;
}
function polyPath(poly, k, cx, cy) {
  g.beginPath();
  for (let i = 0; i < poly.length; i += 2) {
    const x = X(poly[i] + (cx - poly[i]) * k), y = Y(poly[i + 1] + (cy - poly[i + 1]) * k);
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}
const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
function drawLantern(t) {
  const x = X(LX), y = Y(LY), u = sc, glow = 1 + 0.06 * Math.sin(t * 2.1) + flare * 0.6;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.55; const R = 90 * u * glow; g.drawImage(glowSprite, x - R, y - R, 2 * R, 2 * R);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#1a120b'; g.fillRect(x - 1.5 * u, y + 12 * u, 3 * u, 26 * u);
  g.fillStyle = '#3b2a18'; g.fillRect(x - 9 * u, y + 9 * u, 18 * u, 4 * u);
  g.fillStyle = '#ffcf7a'; g.globalAlpha = 0.85 + 0.15 * flare; g.fillRect(x - 7 * u, y - 8 * u, 14 * u, 17 * u); g.globalAlpha = 1;
  g.fillStyle = '#fff3d0'; g.fillRect(x - 2.5 * u, y - 3 * u, 5 * u, 8 * u);
  g.strokeStyle = '#3b2a18'; g.lineWidth = 1.6 * u; g.strokeRect(x - 7 * u, y - 8 * u, 14 * u, 17 * u);
  g.fillStyle = '#3b2a18'; g.beginPath(); g.moveTo(x - 10 * u, y - 8 * u); g.lineTo(x + 10 * u, y - 8 * u); g.lineTo(x + 4 * u, y - 15 * u); g.lineTo(x - 4 * u, y - 15 * u); g.fill();
  g.strokeStyle = '#3b2a18'; g.lineWidth = 1.4 * u; g.beginPath(); g.arc(x, y - 17 * u, 3.5 * u, Math.PI, 0); g.stroke();
}
function drawThread(t) {
  const a = s.t0, b = s.t1, n = b - a;
  threadCopyN = 0;
  if (n < 1 && !finger.down) return;
  for (let k = a; k < b && threadCopyN < 1020; k++) { threadCopy[threadCopyN++] = X(s.tx[k]); threadCopy[threadCopyN++] = Y(s.ty[k]); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const chunks = 4, per = Math.max(1, Math.ceil(n / chunks));
  for (let c = 0; c < chunks; c++) {
    const from = a + c * per, to = Math.min(b - 1, from + per);
    if (from >= b) break;
    const alpha = (c + 1) / chunks;
    g.beginPath(); g.moveTo(X(s.tx[from]), Y(s.ty[from]));
    for (let k = from + 1; k <= to; k++) g.lineTo(X(s.tx[k]), Y(s.ty[k]));
    if (c === chunks - 1 || to === b - 1) { if (finger.down) g.lineTo(finger.x, finger.y); }
    g.globalAlpha = 0.12 * alpha; g.strokeStyle = '#ffb45a'; g.lineWidth = 12; g.stroke();
    g.globalAlpha = 0.3 * alpha; g.lineWidth = 5; g.stroke();
    g.globalAlpha = 0.95 * alpha; g.strokeStyle = '#fff0cf'; g.lineWidth = 1.8; g.stroke();
    if (to === b - 1) break;
  }
  g.globalAlpha = 1;
  if (finger.down && s.phase === 'play') {
    const dim = s.rekindle > 0 ? 0.35 + 0.3 * (1 - s.rekindle / REKINDLE) : 1, R = 15 + 2 * Math.sin(t * 12);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = dim;
    g.drawImage(headSprite, finger.x - R, finger.y - R, 2 * R, 2 * R);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (n > 3) {
      const sx = X(s.tx[a]), sy = Y(s.ty[a]), d = Math.hypot(finger.x - sx, finger.y - sy);
      if (d < 120 && s.tlen > 90) { g.strokeStyle = '#ffe6bd'; g.globalAlpha = 0.25 + 0.4 * (1 - d / 120); g.lineWidth = 1.5; g.beginPath(); g.arc(sx, sy, 34 * sc * 0.5 + 4, 0, 6.283); g.stroke(); g.globalAlpha = 1; }
    }
  }
}
function drawCreatures(t) {
  const near = finger.down && s.phase === 'play';
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < MAXC; i++) {
    const k = s.kind[i];
    if (k !== FLY && k !== GOLD) continue;
    const x = X(s.x[i]), y = Y(s.y[i]), b = brightness(k, s.col[i], s.blink[i]), fade = Math.min(1, s.age[i] / 40);
    const R = (k === GOLD ? 20 : 12) * (0.75 + 0.35 * b) * Math.max(0.8, sc);
    g.globalAlpha = (0.35 + 0.65 * b) * fade;
    g.drawImage(sprites[k === GOLD ? 3 : s.col[i]], x - R, y - R, 2 * R, 2 * R);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < MAXC; i++) {
    const k = s.kind[i];
    if (k === GOLD) {
      const x = X(s.x[i]), y = Y(s.y[i]), r = 15 * Math.max(0.8, sc);
      g.strokeStyle = '#fff4b0'; g.globalAlpha = 0.6; g.lineWidth = 1.4;
      for (let q = 0; q < 4; q++) { const a = t * 1.5 + q * 1.5708; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6); g.lineTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2); g.stroke(); }
      g.globalAlpha = 1;
    } else if (k === MOTH) {
      const x = X(s.x[i]), y = Y(s.y[i]), u = Math.max(0.8, sc), flap = 0.45 + 0.55 * Math.abs(Math.sin(t * 16 + i)), ang = Math.atan2(s.vy[i], s.vx[i]);
      g.save(); g.translate(x, y); g.rotate(ang);
      g.fillStyle = '#a99f92'; g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(-1 * u, -5 * u * flap, 5 * u, 7 * u * flap, -0.4, 0, 6.283); g.fill();
      g.beginPath(); g.ellipse(-1 * u, 5 * u * flap, 5 * u, 7 * u * flap, 0.4, 0, 6.283); g.fill();
      g.fillStyle = '#6f675d'; g.beginPath(); g.ellipse(0, 0, 6 * u, 2.2 * u, 0, 0, 6.283); g.fill();
      g.restore(); g.globalAlpha = 1;
    }
    if (near && k !== 0) {
      const x = X(s.x[i]), y = Y(s.y[i]), d = Math.hypot(x - finger.x, y - finger.y);
      if (d < 40) { g.strokeStyle = k === MOTH ? '#d8cfc4' : COLOR[k === GOLD ? 3 : s.col[i]]; g.globalAlpha = 0.45 * (1 - d / 40) + 0.15; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 24, 0, 6.283); g.stroke(); g.globalAlpha = 1; }
    }
  }
}
function drawBat(t) {
  if (!s.def?.bat || s.batPhase === 0) return;
  if (s.batPhase === 1) {
    const left = s.batX < 0, x = left ? Math.max(ox, 0) + 14 : Math.min(ox + FW * sc, VW) - 14, y = Y(s.batY), p = 0.5 + 0.5 * Math.sin(t * 14);
    g.fillStyle = '#ff6a5a'; g.globalAlpha = 0.35 + 0.5 * p;
    g.beginPath(); g.arc(x - 4, y, 2.5, 0, 6.283); g.arc(x + 4, y, 2.5, 0, 6.283); g.fill();
    g.strokeStyle = '#ff6a5a'; g.lineWidth = 2; g.beginPath();
    const d = left ? 1 : -1; g.moveTo(x + d * 10, y - 9); g.lineTo(x + d * 18, y); g.lineTo(x + d * 10, y + 9); g.stroke();
    g.globalAlpha = 1; return;
  }
  const x = X(s.batX), y = Y(s.batY), u = Math.max(0.9, sc) * 1.25, flap = Math.sin(t * 18), ang = Math.atan2(s.batVY, s.batVX);
  g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2);
  g.fillStyle = '#0a0812'; g.strokeStyle = '#4a3f6a'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, -8 * u);
  g.quadraticCurveTo(10 * u, -6 * u, 22 * u, (-4 + 8 * flap) * u); g.lineTo(16 * u, 2 * u); g.lineTo(11 * u, 0); g.lineTo(6 * u, 5 * u); g.lineTo(0, 6 * u);
  g.lineTo(-6 * u, 5 * u); g.lineTo(-11 * u, 0); g.lineTo(-16 * u, 2 * u); g.lineTo(-22 * u, (-4 + 8 * flap) * u);
  g.quadraticCurveTo(-10 * u, -6 * u, 0, -8 * u); g.fill(); g.stroke();
  g.fillStyle = '#ff6a5a'; g.fillRect(-2.5 * u, -6 * u, 1.6 * u, 1.6 * u); g.fillRect(1 * u, -6 * u, 1.6 * u, 1.6 * u);
  g.restore();
}
const windX = new Float32Array(16), windY = new Float32Array(16);
for (let i = 0; i < 16; i++) { windX[i] = Math.random(); windY[i] = Math.random(); }
function drawWind(dt) {
  if (!(s.gust > 0)) return;
  const k = Math.sin(Math.PI * s.gust / 90);
  g.strokeStyle = '#cfe2ff'; g.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    windX[i] += s.gustDir * dt * (0.5 + (i % 4) * 0.15) * k;
    if (windX[i] > 1.1) windX[i] -= 1.2; if (windX[i] < -0.1) windX[i] += 1.2;
    const x = ox + windX[i] * FW * sc, y = oy + windY[i] * FH * sc;
    g.globalAlpha = 0.18 * k; g.beginPath(); g.moveTo(x, y); g.lineTo(x - s.gustDir * 40 * k, y + 2); g.stroke();
  }
  g.globalAlpha = 1;
}
function drawEffects(dt) {
  const lx = LX, ly = LY;
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]; e.t += dt;
    const a = e.t / e.dur;
    if (a >= 1) { if (e.type === 'ring') { flare = 1; burst(X(LX), Y(LY), 8, e.col, 60, 0.6); } effects.splice(i, 1); continue; }
    g.lineJoin = 'round';
    if (e.type === 'ring') {
      const flash = calm ? 1 - a : Math.max(0, 1 - a / 0.2), k = calm ? 0 : ease((a - 0.18) / 0.82);
      polyPath(e.poly, k, lx, ly);
      g.globalAlpha = 0.3 * flash; g.fillStyle = COLOR[e.col]; g.fill();
      g.globalAlpha = (1 - k * 0.7) * (calm ? 1 - a : 1); g.strokeStyle = '#fff4d6'; g.lineWidth = 2.5 + 3 * flash; g.stroke();
      g.globalCompositeOperation = 'lighter';
      for (let q = 0; q < e.caught.length; q += 3) {
        const cx = e.caught[q] + (lx - e.caught[q]) * k, cy = e.caught[q + 1] + (ly - e.caught[q + 1]) * k, R = 14 * Math.max(0.8, sc) * (1 - 0.5 * k);
        g.globalAlpha = calm ? 1 - a : 1; g.drawImage(sprites[e.caught[q + 2]], X(cx) - R, Y(cy) - R, 2 * R, 2 * R);
      }
      g.globalCompositeOperation = 'source-over';
    } else if (e.type === 'mixed') {
      const k = calm ? 0 : ease(a) * 22;
      g.strokeStyle = '#a08a8a'; g.lineWidth = 2.5; g.globalAlpha = 1 - a;
      for (let q = 0; q < e.poly.length; q += 4) {
        const x1 = e.poly[q], y1 = e.poly[q + 1], j = (q + 2) % e.poly.length, x2 = e.poly[j], y2 = e.poly[j + 1];
        const mx = (x1 + x2) / 2 - e.x, my = (y1 + y2) / 2 - e.y, d = Math.hypot(mx, my) + 0.01, dx = mx / d * k, dy = my / d * k + (calm ? 0 : a * a * 30);
        g.beginPath(); g.moveTo(X(x1 + dx), Y(y1 + dy)); g.lineTo(X(x2 + dx), Y(y2 + dy)); g.stroke();
      }
    } else {
      const k = calm ? 0 : -0.25 * ease(a);
      polyPath(e.poly, k, e.x, e.y);
      g.globalAlpha = (1 - a) * (e.type === 'moths' ? 0.7 : 0.4); g.strokeStyle = '#d8cfc4'; g.lineWidth = 2; g.stroke();
    }
    g.globalAlpha = 1;
  }
  g.textAlign = 'center'; g.font = '18px Georgia, serif';
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    if (p.t > 1.2) { pops.splice(i, 1); continue; }
    g.globalAlpha = Math.max(0, Math.min(1, 1 - p.t / 1.2)); g.fillStyle = '#ffe6bd';
    g.fillText(p.text, X(p.x), Y(p.y) - (calm ? 0 : p.t * 30));
  }
  g.globalAlpha = 1;
}
const PCOL = [COLOR[0], COLOR[1], COLOR[2], COLOR[3], '#fff0cf', '#cfc6b8'];
function drawParticles(dt) {
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < NP; i++) {
    if (pl[i] <= 0) continue;
    pl[i] -= dt; px[i] += pvx[i] * dt; py[i] += pvy[i] * dt; pvy[i] += 40 * dt; pvx[i] *= 0.98;
    g.globalAlpha = Math.max(0, pl[i] / pm[i]); g.fillStyle = PCOL[pc[i]];
    g.fillRect(px[i] - 1.5, py[i] - 1.5, 3, 3);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function drawHud(t) {
  if (s.score !== lastScore) { lastScore = s.score; scoreText = num(s.score); }
  const cy = safeTop + 10;
  for (let k = 0; k < 3; k++) {
    const x = 16 + k * 16, y = cy + 4, lit = k < s.wicks;
    g.fillStyle = '#d9c9a8'; g.fillRect(x - 3, y + 10, 6, 14);
    g.fillStyle = '#2a2018'; g.fillRect(x - 0.6, y + 6, 1.2, 4);
    if (lit) {
      const f = 1 + 0.12 * Math.sin(t * 9 + k * 2);
      g.fillStyle = '#ffb45a'; g.beginPath(); g.ellipse(x, y + 3, 3.2, 6 * f, 0, 0, 6.283); g.fill();
      g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(x, y + 5, 1.4, 2.8, 0, 0, 6.283); g.fill();
    }
  }
  g.fillStyle = '#f3e6cfcc'; g.font = '14px Georgia, serif'; g.textAlign = 'left';
  g.fillText(scoreText, 9, cy + 44);
  const jars = Math.round(s.target / JAR), left = 64, right = VW - 60, span = right - left;
  const gap = Math.min(40, span / jars), w = Math.min(26, gap * 0.7), h = w * 1.3, x0 = (VW - gap * jars) / 2;
  for (let k = 0; k < jars; k++) {
    const f = Math.max(0, Math.min(1, (s.light - k * JAR) / JAR));
    drawJar(g, x0 + gap * k + (gap - w) / 2, cy, w, h, f, f >= 1 ? 1 : 0.4 + 0.2 * Math.sin(t * 3));
  }
  const by = cy + h + 7, bw = Math.max(gap * jars, 150), bx = (VW - bw) / 2, frac = Math.max(0, s.dawn / s.dawnMax);
  g.fillStyle = '#ffffff16'; g.fillRect(bx, by, bw, 4);
  g.fillStyle = frac < 0.25 ? '#ff9a6c' : '#8fb2ff'; g.fillRect(bx, by, bw * frac, 4);
  g.fillStyle = '#ffd9a0'; g.beginPath(); g.arc(bx + bw * frac, by + 2, 3, 0, 6.283); g.fill();
}
function drawBanner(dt) {
  if (banner <= 0) return;
  banner -= dt;
  const a = Math.min(1, banner / 0.5, (2.2 - banner) / 0.3 + (calm ? 1 : 0));
  g.globalAlpha = Math.max(0, a); g.textAlign = 'center';
  g.fillStyle = '#ffd9a0'; g.font = '34px Georgia, serif'; g.fillText(t(...bannerTitle), VW / 2, Y(150));
  g.fillStyle = '#f3e6cf'; g.font = '18px Georgia, serif'; g.fillText(t(...bannerTip), VW / 2, Y(150) + 32);
  g.globalAlpha = 1;
}
function render(t, dt) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.drawImage(back, 0, 0, VW, VH);
  if (mode === 'menu') { menuDrift(t); return; }
  const dawn = s.dawnMax ? 1 - s.dawn / s.dawnMax : 0;
  if (dawn > 0.5) { g.globalAlpha = (dawn - 0.5) * 0.5; g.fillStyle = dawnTint; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1; }
  let sx = 0, sy = 0;
  if (shake > 0) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 40); }
  g.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
  flare = Math.max(0, flare - dt * 2);
  drawLantern(t);
  drawWind(dt);
  drawCreatures(t);
  drawEffects(dt);
  drawThread(t);
  drawBat(t);
  drawParticles(dt);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawHud(t);
  drawBanner(dt);
  if (mode === 'ending' && performance.now() >= endAt) finish();
}
// The menu shows a few fireflies drifting over the meadow.
function menuDrift(t) {
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const x = VW * (0.5 + 0.42 * Math.sin(t * 0.13 * (1 + i % 3) + i * 1.7)), y = VH * (0.55 + 0.38 * Math.sin(t * 0.11 * (1 + i % 4) + i * 2.3));
    const b = brightness(FLY, i % 3, (t * 0.4 + i * 0.37) % 1), R = 11 * (0.75 + 0.35 * b);
    g.globalAlpha = 0.3 + 0.6 * b; g.drawImage(sprites[i % 3], x - R, y - R, 2 * R, 2 * R);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
  if (mode === 'play' || mode === 'ending') {
    acc += dt;
    while (acc >= DT) { acc -= DT; tick(); }
  }
  render(now / 1000, mode === 'paused' ? 0 : dt);
}
requestAnimationFrame(frame);

const KINDS = ['', 'firefly', 'moth', 'golden'];
window.__ring = Object.freeze({
  ready: true,
  get mode() { return mode; },
  get kind() { return kind; },
  get phase() { return s.phase; },
  get level() { return s.level; },
  get round() { return s.round; },
  get score() { return s.score; },
  get wicks() { return s.wicks; },
  get light() { return s.light; },
  get target() { return s.target; },
  get cleared() { return s.cleared; },
  get results() { return Array.from(s.results); },
  get rekindle() { return s.rekindle; },
  get fingerDown() { return finger.down; },
  get dawnLeft() { return s.dawnMax ? s.dawn / s.dawnMax : 0; },
  get threadPoints() { return s.t1 - s.t0; },
  get effects() { return effects.length; },
  get bestRing() { return s.bestRing; },
  get counts() { return { ...s.counts }; },
  map() { return { ox, oy, sc, width: FW, height: FH }; },
  creatures() {
    const out = [];
    for (let i = 0; i < MAXC; i++) if (s.kind[i]) out.push({ i, kind: KINDS[s.kind[i]], col: s.col[i], x: X(s.x[i]), y: Y(s.y[i]), scared: s.scare[i] > 0 });
    return out;
  },
  save() { return readJson(KEY, null); },
});
