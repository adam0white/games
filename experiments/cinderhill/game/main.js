// Cinderhill, the game page. It runs the same deterministic sim as the trail painter (../host.js, ../sim) and draws
// it as a lit, tilted hillside (gl.js) with the nest as a cutaway panel (nest.js). No game rule lives here: every
// number on screen is read from the sim or from its events, and every order goes through host.order().
import { Host, CMD, SURFACE, NEST, FIELD, SEED, G as GI } from '../host.js';
import { START } from '../sim/colony.js';
import { EVENT, line } from '../sim/sim.js';
import { makeGestures } from '../gestures.js';
import { LabRecord } from '../labrec.js';
import { GameRenderer, sky } from './gl.js';
import { drawCutaway } from './nest.js';
import { noZoom } from '../../kit/zoom.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { sound } from '../../kit/audio.js';
import { music } from '../../kit/music.js';
import { hint } from '../../kit/hint.js';
import { lab } from '../../kit/lab.js';
import { readJson, writeJson } from '../../kit/save.js';

noZoom();
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const SAVE = 'cinderhill:game', HINT = 'cinderhill:game:hint';

// ---- settings: every taste choice is a setting with a default, and each change is recorded ----
const DEFAULTS = { view: 'tilt', light: 'cycle', style: 'relief', size: '1', sound: 'all' };
const CHOICES = { view: ['tilt', 'top'], light: ['cycle', 'day', 'ember'], style: ['relief', 'ink'], size: ['1', '1.5'], sound: ['all', 'fx', 'off'] };
const saved0 = readJson(SAVE);
const set = { ...DEFAULTS, ...(saved0 && typeof saved0 === 'object' ? saved0 : {}) };
for (const k of Object.keys(CHOICES)) { const q = query.get(k); if (CHOICES[k].includes(q)) set[k] = q; if (!CHOICES[k].includes(set[k])) set[k] = DEFAULTS[k]; }
const persist = () => writeJson(SAVE, set);

// ---- the game ----
// ?free=<ants>: a hill with no queen and no brood, any size up to 5,000 (the frame-time check runs here).
const qFree = Math.floor(Number(query.get('free')));
const free = qFree >= 10 && qFree <= 5000 ? qFree : 0;
/** The page's host: the painter's, plus every tick's events kept until the page has shown them. */
class GameHost extends Host {
  step() { super.step(); (this.news ??= []).push(...this.lastEvents); }
}
const newHost = () => (free ? new GameHost(free) : new GameHost(START.ants, SEED, { colony: true }));
let host = newHost();
let screen = 'menu', tool = 'trail', nestOpen = false, nestAuto = 0;
const Gs = makeGestures();

// ---- sound: effects through the kit, and a generative score that follows the hour and the danger ----
let song = null;
const snd = sound({ on: () => set.sound !== 'off', setup: ac => { try { song = music(ac, { preset: 'bell' }); } catch { song = null; } } });
const tone = (...a) => { if (set.sound !== 'off') snd.tone(...a); };
function tuneSong() { try { song?.set?.({ on: set.sound === 'all' && screen === 'play', progress: Math.min(1, host.sim.g[GI.BORN] / 40), danger: host.sim.g[GI.ALARM_HOLD] > 1 ? 0.6 : 0, light: 1 - light.night }); } catch { /* the score is optional */ } }

// ---- recording (the kit's lab, under the painter's slug; `look` says which client and which settings) ----
const rec = lab('cinderhill', { lang: () => 'en' });
rec.notice($('menuCard')); rec.toggle($('pauseCard'));
const labrec = new LabRecord(rec);
const lookName = () => `game:${set.view}/${set.light}/${set.style}`;
let running = false;
function startRecord() {
  labrec.start(host, { mode: free ? 'sandbox' : 'colony', look: lookName(), viewport: [innerWidth, innerHeight, Math.round(devicePixelRatio * 100) / 100] });
  labrec.emit('client', { c: 'game', v: 1, set: { ...set }, changed: Object.keys(DEFAULTS).filter(k => set[k] !== DEFAULTS[k]) });
}
addEventListener('error', e => labrec.error(e.message ?? 'error'));
addEventListener('unhandledrejection', e => labrec.error(`rejection: ${e.reason?.message ?? e.reason}`));
document.addEventListener('visibilitychange', () => labrec.visible(document.visibilityState === 'visible'));

// ---- canvases and the camera ----
const glCanvas = $('gl'), ui = $('c'), ctx = ui.getContext('2d'), nestCanvas = $('nest'), nctx = nestCanvas.getContext('2d');
let dprCap = 2, slow = { sum: 0, n: 0 };   // a phone that cannot hold the frame rate draws fewer pixels, not fewer frames
let W = innerWidth, H = innerHeight, dpr = Math.min(dprCap, devicePixelRatio || 1), NW = 1, NH = 1;
let renderer = null, glFailed = '';
try { renderer = GameRenderer.create(glCanvas, { restored: () => uploadAll() }); } catch (e) { glFailed = String(e.message || e).slice(0, 300); renderer = null; }
if (!renderer) $('nogl').classList.add('on');
const L0 = host.sim.L;
const cam = { x: L0.sw / 2 + 0.5, y: L0.sh / 2 + 0.5, z: 8 };
const nestCam = { x: L0.nw / 2 + 0.5, y: 0, z: 10 };
// The tilt eases between the two views: k squeezes the ground, lift raises what stands on it.
const TILT = { tilt: { k: 0.64, lift: 0.77 }, top: { k: 1, lift: 0 } };
const tilt = { ...TILT[set.view] };
const zMin = () => Math.min(W / L0.sw, H / L0.sh) * 1.2;
function clampCam() { cam.z = Math.max(zMin(), Math.min(44, cam.z)); cam.x = Math.max(0, Math.min(L0.sw, cam.x)); cam.y = Math.max(0, Math.min(L0.sh, cam.y)); }
const toWorld = (sx, sy) => ({ x: cam.x + (sx - W / 2) / cam.z, y: cam.y + (sy - H / 2) / (cam.z * tilt.k) });
const toScreen = (wx, wy, h = 0) => ({ x: (wx - cam.x) * cam.z + W / 2, y: (wy - cam.y) * cam.z * tilt.k - h * tilt.lift * cam.z + H / 2 });
function resize() {
  W = innerWidth; H = innerHeight; dpr = Math.min(dprCap, devicePixelRatio || 1);
  ui.width = Math.round(W * dpr); ui.height = Math.round(H * dpr);
  renderer?.resize(W, H, dpr);
  const r = nestCanvas.getBoundingClientRect(); NW = Math.max(1, r.width); NH = Math.max(1, r.height);
  nestCanvas.width = Math.round(NW * dpr); nestCanvas.height = Math.round(NH * dpr);
  nestCam.z = Math.max(9, Math.min(16, NW / 34));
  clampCam();
}
addEventListener('resize', resize);
cam.z = Math.max(9, Math.min(16, Math.min(innerWidth, innerHeight) / 30));   // the first food (8 to 12 cells out) is on screen at the start
resize();

// ---- uploads at tick rate ----
let inst = new Float32Array(5000 * 8), drawnAnts = 0, scentBuf = null, uploadedTerrain = -1;
function uploadAnts() {
  if (!renderer) return;
  const s = host.sim, n = s.n;
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (s.layer[i] !== SURFACE) continue;
    const jump = i >= host.pn || host.pl[i] !== SURFACE;       // a newborn, or one just out of the door, has no last place here
    const x = s.x[i] / 256, y = s.y[i] / 256;
    inst[k] = jump ? x : host.px[i] / 256; inst[k + 1] = jump ? y : host.py[i] / 256; inst[k + 2] = x; inst[k + 3] = y;
    inst[k + 4] = s.heading[i] * (Math.PI / 128); inst[k + 5] = s.job[i] + (s.caste[i] ? 8 : 0); inst[k + 6] = s.carry[i]; inst[k + 7] = (i * 0.618034) % 1;
    k += 8;
  }
  drawnAnts = k / 8;
  renderer.setAnts(inst, drawnAnts);
}
const byteOf = v => { if (v < 1024) return 0; const e = 31 - Math.clz32(v), m = (v >>> (e - 4)) & 15, l = (e * 16 + m - 160) * 1.15; return l > 255 ? 255 : l | 0; };
function uploadScent() {
  if (!renderer) return;
  const n = L0.sw * L0.sh, S = host.sim.scent.cur, tr = S[FIELD.TRAIL], fo = S[FIELD.FOOD], al = S[FIELD.ALARM];
  if (!scentBuf) scentBuf = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const o = i * 4; scentBuf[o] = byteOf(tr[i]); scentBuf[o + 1] = byteOf(fo[i]); scentBuf[o + 2] = byteOf(al[i]); }
  renderer.setScent(L0.sw, L0.sh, scentBuf);
}
function uploadTerrain() { if (!renderer) return; renderer.setTerrain(L0.sw, L0.sh, host.sim.mat.subarray(0, L0.sw * L0.sh)); uploadedTerrain = host.terrainVersion; }
function uploadAll() { uploadTerrain(); uploadScent(); uploadAnts(); }
uploadAll();

// ---- particles and other effects (page only) ----
const MAXP = 700, parts = [], dots = new Float32Array(MAXP * 8);
/** One particle. `add` true: light (embers, sparks); false: matter (ash, dust). */
function puff(x, y, h, o = {}) {
  if (parts.length >= MAXP) parts.shift();
  parts.push({ x, y, h, vx: o.vx ?? 0, vy: o.vy ?? 0, vh: o.vh ?? 0, size: o.size ?? 0.5, grow: o.grow ?? 0, col: o.col ?? [1, 0.6, 0.2], a: o.a ?? 1, add: o.add ?? true, life: o.life ?? 1, age: 0, drag: o.drag ?? 0 });
}
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
function burst(x, y, col, n = 8, o = {}) { for (let k = 0; k < n; k++) puff(x + rnd(0.3), y + rnd(0.3), 0.3, { vx: rnd(2.2), vy: rnd(2.2), vh: 1.5 + Math.random() * 2.5, size: 0.35 + Math.random() * 0.3, col, life: 0.5 + Math.random() * 0.5, drag: 2, ...o }); }
function stepParts(dt) {
  let k = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.age += dt; if (p.age >= p.life) { parts.splice(i, 1); continue; }
    const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d;
    p.x += p.vx * dt; p.y += p.vy * dt; p.h = Math.max(0, p.h + p.vh * dt); p.size += p.grow * dt;
  }
  for (const p of parts) {
    const t = p.age / p.life, a = p.a * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85), o = k * 8;
    dots[o] = p.x; dots[o + 1] = p.y; dots[o + 2] = p.h; dots[o + 3] = p.size;
    dots[o + 4] = p.col[0] * a; dots[o + 5] = p.col[1] * a; dots[o + 6] = p.col[2] * a; dots[o + 7] = p.add ? 0 : a;
    k++;
  }
  renderer?.setDots(dots, k);
}
/** Ash on the wind by day, embers rising by night, over the part of the hill in view. */
function ambient(dt) {
  const spanX = W / cam.z, spanY = H / (cam.z * tilt.k), n = light.night;
  if (Math.random() < dt * 14) puff(cam.x + rnd(spanX / 2), cam.y + rnd(spanY / 2), 1 + Math.random() * 3, { vx: 0.8 + Math.random(), vy: rnd(0.3), vh: rnd(0.2), size: 0.14 + Math.random() * 0.14, col: [0.75, 0.72, 0.7], a: 0.35 * (1 - n * 0.7), add: false, life: 4 + Math.random() * 3 });
  if (Math.random() < dt * (2 + 26 * n)) puff(cam.x + rnd(spanX / 2), cam.y + rnd(spanY / 2), 0.1, { vx: rnd(0.4), vy: rnd(0.2), vh: 0.7 + Math.random() * 1.2, size: 0.16 + Math.random() * 0.16, col: [1, 0.45 + Math.random() * 0.25, 0.1], a: 0.5 + 0.5 * n, life: 2 + Math.random() * 2.5 });
}
let floats = [], pulses = [], beacon = null, shake = 0;
const pilePlace = new Map();   // where each pile was, for the puff when it runs out
const entrance = () => ({ x: L0.sw / 2 + 0.5, y: L0.sh / 2 + 0.5 });
const KIND_COL = [[1, 0.85, 0.4], [1, 0.4, 0.25]];

// ---- words (few) ----
let toastTimer = 0;
function toast(text, ms = 2200) { const el = $('toast'); el.textContent = text; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms); }

// ---- screens ----
function setScreen(s) {
  screen = s;
  $('menu').classList.toggle('on', s === 'menu'); $('paused').classList.toggle('on', s === 'paused');
  document.body.classList.toggle('playing', s !== 'menu');
  tuneSong();
}
function play() {
  snd.unlock(); try { song?.start?.(SEED); } catch { /* optional */ }
  if (saved0 === null && readJson(SAVE) === null) persist();
  if (!running) { startRecord(); running = true; }
  setScreen('play'); host.last = null; snd.release();
}
function pauseGame() { if (screen !== 'play') return; run(Gs.reset('pause')); setScreen('paused'); snd.hold(); }
function resume() { setScreen('play'); host.last = null; snd.release(); }
function restart() {
  host = newHost(); stats = host.stats(); crewSeq = -1; seen = null; floats = []; pulses = []; beacon = null; parts.length = 0; setSpeed(1);
  startRecord(); running = true; uploadAll(); resume();
}
$('play').addEventListener('click', play);
$('pause').addEventListener('click', pauseGame);
$('resume').addEventListener('click', resume);
$('restart').addEventListener('click', restart);
onLeave(pauseGame);
addEventListener('keydown', e => { if (isPauseKey(e)) { if (screen === 'play') pauseGame(); else if (screen === 'paused') resume(); e.preventDefault(); } });

// ---- settings card ----
function paintSettings() { for (const seg of document.querySelectorAll('.seg')) for (const b of seg.children) b.setAttribute('aria-pressed', String(set[seg.dataset.set] === b.dataset.v)); }
for (const seg of document.querySelectorAll('.seg')) for (const b of seg.children) b.addEventListener('click', () => {
  const k = seg.dataset.set, v = b.dataset.v; if (set[k] === v) return;
  const from = set[k]; set[k] = v; persist(); paintSettings();
  labrec.emit('setting', { k, v, from, at: host.tick });
  if (k === 'sound') { if (v === 'off') snd.hold(); tuneSong(); }
  tone(660, 0.06, 0.03, 'triangle', 80);
});
paintSettings();

// ---- tools ----
function setTool(next) {
  if (next === tool) { if (next === 'dig') setNest(!nestOpen); return; }
  run(Gs.reset('tool')); tool = next;
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  if (tool === 'dig') { setNest(true); toast('Drag in the nest to mark where to dig'); } else if (tool === 'alarm') toast('Hold a finger down to call the guards there');
  tone(520, 0.05, 0.03, 'triangle');
}
function setNest(on, auto = false) {
  nestOpen = on; nestAuto = auto ? performance.now() + 4200 : 0;
  document.body.classList.toggle('nest', on); $('nestBtn').setAttribute('aria-pressed', String(on));
  if (running && !auto) labrec.emit('nest', { on: on ? 1 : 0, at: host.tick });
  requestAnimationFrame(resize);
}
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
$('nestBtn').addEventListener('click', () => setNest(!nestOpen));
$('recall').addEventListener('click', () => { const on = !host.sim.g[GI.RECALL]; order({ type: CMD.RECALL, on: on ? 1 : 0 }); toast(on ? 'Everyone home' : 'Out again'); tone(on ? 330 : 520, 0.2, 0.05, 'triangle', on ? -120 : 160); });
const SPEEDS = [1, 2, 4];
function setSpeed(x) { host.speed = x; $('speedText').textContent = `${x}×`; $('speed').setAttribute('aria-pressed', String(x > 1)); }
$('speed').addEventListener('click', () => { const x = SPEEDS[(SPEEDS.indexOf(host.speed ?? 1) + 1) % SPEEDS.length]; setSpeed(x); labrec.emit('speed', { at: host.tick, x }); tone(500 + 150 * x, 0.06, 0.03, 'triangle'); });

// ---- orders ----
let preview = null, alarmAt = null, stats = host.stats(), crewSeq = -1;
function order(o) { const e = host.order(o); labrec.order(o, e); return e; }
const crewTrail = () => stats.trails.find(tr => tr.seq === crewSeq) ?? stats.trails.find(tr => tr.newest) ?? null;
function crewStep(delta, level) {
  const tr = crewTrail(); if (!tr || screen !== 'play') return;
  order(level ? { type: CMD.CREW, seq: tr.seq, delta: 0, level } : { type: CMD.CREW, seq: tr.seq, delta });
  tone(level ? 500 + 90 * level : delta > 0 ? 700 : 500, 0.08, 0.04, 'triangle', delta < 0 ? -120 : 120);
  setTimeout(hud, 80);
}
$('crewPlus').addEventListener('click', () => crewStep(1)); $('crewMinus').addEventListener('click', () => crewStep(-1));
for (const b of document.querySelectorAll('#levels [data-level]')) b.addEventListener('click', () => crewStep(0, Number(b.dataset.level)));
function pickTrailAt(sx, sy) {
  let best = null, bd = 26 * 26;
  for (const tr of stats.trails) { const p = toScreen(tr.x + 0.5, tr.y + 0.5, 3.4), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < bd) { bd = d; best = tr; } }
  if (!best) return false;
  crewSeq = best.seq; hud(); tone(600, 0.05, 0.03, 'triangle'); return true;
}
function trailPoints(screenPts) {
  const pts = [];
  for (const [sx, sy] of screenPts) { const w = toWorld(sx, sy), x = Math.floor(w.x), y = Math.floor(w.y), l = pts[pts.length - 1]; if (!l || l[0] !== x || l[1] !== y) pts.push([x, y]); }
  if (pts.length < 2) return null;
  return (pts.length <= 64 ? pts : Array.from({ length: 64 }, (_, k) => pts[Math.round(k * (pts.length - 1) / 63)])).flat();
}
function act(a) {
  switch (a.type) {
    case 'preview': preview = a; break;
    case 'clear': preview = null; break;
    case 'pan': cam.x -= a.dx / cam.z; cam.y -= a.dy / (cam.z * tilt.k); clampCam(); break;
    case 'zoom': { const b = toWorld(a.x, a.y); cam.z *= a.f; clampCam(); const c = toWorld(a.x, a.y); cam.x += b.x - c.x; cam.y += b.y - c.y; clampCam(); break; }
    case 'order': {
      if (a.tool !== 'trail') break;
      const points = trailPoints(a.points); if (!points) break;
      order({ type: CMD.TRAIL, layer: SURFACE, points });
      pulses.push({ pts: points, at: performance.now() }); help.done?.();
      for (let i = 0; i < points.length; i += 2) puff(points[i] + 0.5, points[i + 1] + 0.5, 0.2, { vx: rnd(0.5), vy: rnd(0.5), vh: 0.8, size: 0.5, grow: 0.5, col: [1, 0.7, 0.3], a: 0.7, life: 0.7 });
      tone(620, 0.14, 0.06, 'triangle', -180); setTimeout(hud, 120);
      break;
    }
    case 'alarm': {
      const w = toWorld(a.x, a.y), x = Math.floor(w.x), y = Math.floor(w.y);
      order({ type: CMD.ALARM, layer: SURFACE, x, y, hold: a.phase === 'end' ? 1 : 400 });
      alarmAt = a.phase === 'end' ? null : { x: x + 0.5, y: y + 0.5 };
      if (a.phase === 'start') { tone(880, 0.25, 0.05, 'sawtooth', -300); shake = 0.25; }
      break;
    }
    case 'tap': pickTrailAt(a.x, a.y); break;
  }
}
function run(actions) { for (const a of actions) act(a); }
const P = e => ({ id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), kind: e.pointerType, button: e.button, primary: e.isPrimary });
ui.addEventListener('pointerdown', e => { if (screen !== 'play') return; try { ui.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ } run(Gs.down(P(e), tool === 'dig' ? 'camera' : tool)); });
ui.addEventListener('pointermove', e => { if (screen === 'play') run(Gs.move(P(e))); });
ui.addEventListener('pointerup', e => run(Gs.up(P(e))));
ui.addEventListener('pointercancel', e => run(Gs.cancel(e.pointerId, 'pointercancel')));
ui.addEventListener('lostpointercapture', e => run(Gs.cancel(e.pointerId, 'lostpointercapture')));
ui.addEventListener('contextmenu', e => e.preventDefault());
ui.addEventListener('wheel', e => { if (screen !== 'play') return; e.preventDefault(); act({ type: 'zoom', f: Math.exp(-e.deltaY * 0.0015), x: e.clientX, y: e.clientY }); }, { passive: false });
const help = hint(ui, { kind: 'path', key: HINT, when: () => screen === 'play' && tool === 'trail' && !nestOpen, played: false, bottom: 190 });

// The nest panel: with Dig, a drag marks cells (a brush three cells wide); with any other tool it moves the view.
let nestDrag = null, digMarks = null;
const nestCell = (e) => { const r = nestCanvas.getBoundingClientRect(); return [Math.floor((e.clientX - r.left - NW / 2) / nestCam.z + nestCam.x), Math.floor((e.clientY - r.top - 26) / nestCam.z + nestCam.y)]; };
function mark(x, y) {
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = x + ox, cy = y + oy; if (cx < 0 || cy < 1 || cx >= L0.nw || cy >= L0.nh) continue;
    const k = cy * L0.nw + cx; if (!digMarks.seen.has(k) && digMarks.cells.length < 2048) { digMarks.seen.add(k); digMarks.cells.push(cx, cy); }
  }
}
nestCanvas.addEventListener('pointerdown', e => {
  if (screen !== 'play') return;
  try { nestCanvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ }
  nestDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, dig: tool === 'dig' }; nestAuto = 0;
  if (nestDrag.dig) { digMarks = { seen: new Set(), cells: [], last: nestCell(e) }; mark(...digMarks.last); }
});
nestCanvas.addEventListener('pointermove', e => {
  if (!nestDrag || e.pointerId !== nestDrag.id) return;
  if (nestDrag.dig) { const c = nestCell(e); line(digMarks.last[0], digMarks.last[1], c[0], c[1], mark); digMarks.last = c; }
  else { nestCam.x -= (e.clientX - nestDrag.x) / nestCam.z; nestCam.y -= (e.clientY - nestDrag.y) / nestCam.z; nestDrag.x = e.clientX; nestDrag.y = e.clientY; nestCam.x = Math.max(8, Math.min(L0.nw - 8, nestCam.x)); nestCam.y = Math.max(0, Math.min(L0.nh - 10, nestCam.y)); }
});
function nestUp(e, ok) {
  if (!nestDrag || e.pointerId !== nestDrag.id) return;
  if (nestDrag.dig && ok && digMarks?.cells.length) { const c = digMarks.cells; for (let k = 0; k < c.length; k += 512) order({ type: CMD.DIG, cells: c.slice(k, k + 512) }); tone(180, 0.1, 0.06, 'square', -60); }
  nestDrag = null; digMarks = null;
}
nestCanvas.addEventListener('pointerup', e => nestUp(e, true));
nestCanvas.addEventListener('pointercancel', e => nestUp(e, false));

// ---- what the sim reports, shown ----
let seen = null;   // the counts last shown, to notice what changed
function news() {
  const g = host.sim.g, ent = entrance();
  for (const [type, a, b] of (host.news ?? []).splice(0)) {
    if (type === EVENT.HOME) {
      const col = KIND_COL[b ? 1 : 0];
      burst(ent.x, ent.y, col, 5, { size: 0.3 });
      floats.push({ x: ent.x + rnd(1), y: ent.y, at: performance.now(), col: b ? '#ff9d7a' : '#ffe08a' });
      if (floats.length > 24) floats.shift();
      const n = set.sound === 'all' ? song?.ember?.() : null;
      if (!n) tone(1500 + Math.random() * 500, 0.04, 0.02, 'sine', 300);
    } else if (type === EVENT.PILE_NEW) {
      const c = host.sim.pileCell[a]; if (c >= 0) { beacon = { x: c % L0.sw, y: Math.floor(c / L0.sw), at: performance.now() }; burst(beacon.x + 0.5, beacon.y + 0.5, KIND_COL[b ? 1 : 0], 16, { vh: 4 }); }
      toast(b ? 'Something fell on the hill' : 'Seeds have dropped nearby'); tone(b ? 520 : 780, 0.2, 0.05, 'triangle', 220);
      labrec.emit('pile', { at: host.tick, p: a, k: b });
    } else if (type === EVENT.PILE_EMPTY) {
      const p = pilePlace.get(a); if (p) for (let k = 0; k < 12; k++) puff(p.x + 0.5 + rnd(0.6), p.y + 0.5 + rnd(0.6), 0.2, { vx: rnd(1.2), vy: rnd(1.2), vh: 1, size: 0.6, grow: 1, col: [0.7, 0.66, 0.6], a: 0.5, add: false, life: 0.9 });
      toast('That food is gone'); tone(300, 0.2, 0.04, 'triangle', -90);
    } else if (type === EVENT.JAM) { if (a) { toast('The door is jammed'); tone(160, 0.3, 0.05, 'sawtooth'); } }
    else if (type === EVENT.DUG) tone(140 + Math.random() * 60, 0.04, 0.025, 'square');
  }
  if (!host.colony) return;
  const born = g[GI.BORN];
  if (seen && born > seen.born) {
    burst(ent.x, ent.y, [1, 0.95, 0.7], 14, { vh: 5, life: 1.1 }); tone(990, 0.12, 0.04, 'sine', 400); setTimeout(() => tone(1320, 0.16, 0.035, 'sine', 300), 90);
    if (seen.born === 0) { toast('A new worker is born', 3200); if (!nestOpen) setNest(true, true); labrec.emit('firstBirth', { at: host.tick }); }
  }
  seen = { born };
}
function bump(id, value) { const el = $(id), span = el.querySelector('span'), text = String(value); if (span.textContent === text) return; const up = Number(text) > Number(span.textContent); span.textContent = text; if (up) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
function hud() {
  stats = host.stats();
  for (const p of stats.piles) pilePlace.set(p.p, { x: p.x, y: p.y });
  const c = stats.colony;
  bump('chipAnts', stats.ants);
  bump('chipSugar', c ? c.sugar : stats.stores);
  $('chipProtein').hidden = !c; $('chipBrood').hidden = !c;
  if (c) { bump('chipProtein', c.protein); bump('chipBrood', c.eggs + c.larvae + c.pupae); }
  const tr = crewTrail();
  $('route').classList.toggle('on', !!tr && screen === 'play');
  if (tr) {
    const n = stats.trails.slice().sort((a, b) => a.seq - b.seq).indexOf(tr) + 1;
    $('routeName').textContent = `Trail ${n}`;
    const why = tr.why === 'jammed' ? 'door jammed' : tr.why === 'noFree' ? 'no free ants' : tr.why === 'older' ? 'ants prefer the newest' : tr.why === 'noSeekers' ? 'nobody is looking' : tr.why === 'outTooLong' ? 'they have been out too long' : '';
    $('routeInfo').textContent = `${tr.on}${tr.want === null ? '' : ' of ' + tr.want} ants · ${tr.loads} home a minute${why ? ' · ' + why : ''}`;
    for (const b of document.querySelectorAll('#levels [data-level]')) b.setAttribute('aria-pressed', String(Number(b.dataset.level) === tr.level));
  }
  const rc = !!host.sim.g[GI.RECALL];
  $('recall').setAttribute('aria-pressed', String(rc)); $('recallText').textContent = rc ? 'Out' : 'Home';
  tuneSong();
}

// ---- the overlay: the stroke being drawn, trail badges, loads coming home, where the food is ----
function drawOverlay(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pu of pulses) {
    const k = (now - pu.at) / 900; if (k > 1) continue;
    ctx.strokeStyle = `rgba(255, 190, 90, ${1 - k})`; ctx.lineWidth = 3 + 8 * k;
    ctx.beginPath(); for (let i = 0; i < pu.pts.length; i += 2) { const p = toScreen(pu.pts[i] + 0.5, pu.pts[i + 1] + 0.5); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke();
  }
  pulses = pulses.filter(pu => now - pu.at < 900);
  if (screen === 'play') {
    const sel = crewTrail();
    for (const tr of stats.trails) {
      const p = toScreen(tr.x + 0.5, tr.y + 0.5, 3.4), q = toScreen(tr.x + 0.5, tr.y + 0.5, 0.8);
      if (p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
      ctx.strokeStyle = 'rgba(255, 200, 120, 0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();   // a flag pole
      const label = tr.want === null ? String(tr.on) : `${tr.on}/${tr.want}`, w = Math.max(30, 14 + label.length * 7.5);
      ctx.fillStyle = tr === sel ? '#ffb057' : 'rgba(26, 18, 14, 0.9)'; ctx.strokeStyle = tr === sel ? '#fff1d6' : 'rgba(255, 190, 120, 0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - 12, w, 22, 11); ctx.fill(); ctx.stroke();
      ctx.fillStyle = tr === sel ? '#1b0f08' : '#f3e6d6'; ctx.font = '700 12px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, p.x, p.y - 0.5);
    }
    // Food off screen: a small arrow at the edge, in the food's colour.
    for (const p of stats.piles) {
      if (p.amount <= 0) continue;
      const s = toScreen(p.x + 0.5, p.y + 0.5); if (s.x > 12 && s.y > 60 && s.x < W - 12 && s.y < H - 90) continue;
      const cx = W / 2, cy = H / 2, a = Math.atan2(s.y - cy, s.x - cx), m = 30;
      const k = Math.min(Math.abs(Math.cos(a)) > 1e-6 ? (W / 2 - m) / Math.abs(Math.cos(a)) : Infinity, Math.abs(Math.sin(a)) > 1e-6 ? (H / 2 - m - 50) / Math.abs(Math.sin(a)) : Infinity);
      const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k, kind = host.sim.pileKind?.[p.p] ? 1 : 0;
      ctx.fillStyle = kind ? '#e0603c' : '#f3d77a'; ctx.strokeStyle = 'rgba(20, 12, 8, 0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); ctx.lineTo(x + Math.cos(a + 2.5) * 11, y + Math.sin(a + 2.5) * 11); ctx.lineTo(x + Math.cos(a - 2.5) * 11, y + Math.sin(a - 2.5) * 11); ctx.closePath(); ctx.stroke(); ctx.fill();
    }
  }
  for (const f of floats) {
    const k = (now - f.at) / 1100; if (k > 1) continue;
    const p = toScreen(f.x, f.y, 1 + k * 3);
    ctx.globalAlpha = 1 - k * k; ctx.fillStyle = f.col; ctx.font = '800 15px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(20, 10, 6, 0.8)'; ctx.lineWidth = 3; ctx.strokeText('+1', p.x, p.y); ctx.fillText('+1', p.x, p.y);
  }
  ctx.globalAlpha = 1; floats = floats.filter(f => now - f.at < 1100);
  if (preview?.points.length && preview.tool === 'trail') {
    ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 14; ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 5;
    ctx.beginPath(); preview.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.shadowBlur = 0;
  }
  const st = Gs.state.stroke;
  if (st && st.tool === 'alarm' && !st.alarm && !Gs.state.dead) { const k = Math.min(1, (now - st.t0) / 300); ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(st.x0, st.y0, 28, -Math.PI / 2, -Math.PI / 2 + k * 2 * Math.PI); ctx.stroke(); }
}
function drawNestPanel(now) {
  nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCutaway({ ctx: nctx, host, W: NW, H: NH, cam: nestCam, now, night: light.night, dig: digMarks?.cells });
}

// ---- the frame ----
let light = sky(0.1);
function lightNow(now) {
  const phase = set.light === 'day' ? 0.2 : set.light === 'ember' ? 0.85 : screen === 'menu' ? 0.5 + 0.07 * Math.sin(now / 9000) : 0.06 + host.tick / 14400;   // a day is twelve minutes of game time
  return sky(phase);
}
const frames = { on: false, dt: [], work: [], last: 0, drawn: 0 };
const fpsOn = query.get('fps') === '1'; if (fpsOn) $('fps').classList.add('on');
let lastHud = 0, lastFps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const t0 = performance.now(), dt = Math.min(0.1, frames.last ? (now - frames.last) / 1000 : 0.016);
  run(Gs.tick(t0));
  const stepped = host.advance(now, screen !== 'play');
  if (screen === 'play') { labrec.tick(); labrec.camera(SURFACE, cam, now); if (frames.last) labrec.frame(now - frames.last); }
  news();
  if (stepped) { uploadAnts(); if (host.tick % 2 === 0 || stepped > 1) uploadScent(); if (host.terrainVersion !== uploadedTerrain) uploadTerrain(); }
  light = lightNow(now);
  const want = TILT[set.view], e = Math.min(1, dt * 6); tilt.k += (want.k - tilt.k) * e; tilt.lift += (want.lift - tilt.lift) * e;
  if (screen !== 'paused') { ambient(dt); stepParts(dt); }
  if (nestAuto && now > nestAuto) { nestAuto = 0; if (tool !== 'dig') setNest(false, true); }
  shake = Math.max(0, shake - dt);
  const view = shake ? { x: cam.x + rnd(shake * 0.6), y: cam.y + rnd(shake * 0.6), z: cam.z } : cam;
  const piles = stats.piles.map(p => ({ x: p.x, y: p.y, amount: p.amount, kind: host.sim.pileKind?.[p.p] ? 1 : 0 }));
  const b = beacon && now - beacon.at < 7000 ? { x: beacon.x, y: beacon.y, age: (now - beacon.at) / 1000 } : null;
  if (renderer && renderer.draw({ cam: view, tilt, light, ink: set.style === 'ink', alpha: screen === 'play' ? host.alpha : 1, running: screen === 'play', time: now / 1000, piles, entrance: { ...entrance(), w: 3 }, alarm: stats.alarm ? alarmAt : null, beacon: b, big: Number(set.size) })) frames.drawn++;
  drawOverlay(now);
  if (nestOpen) drawNestPanel(now);
  if (now - lastHud > 250) { lastHud = now; if (screen !== 'menu') hud(); }
  const work = performance.now() - t0;
  if (frames.last && (frames.on || fpsOn)) { frames.dt.push(now - frames.last); frames.work.push(work); if (!frames.on && frames.dt.length > 240) { frames.dt.splice(0, 120); frames.work.splice(0, 120); } }
  if (frames.last && screen === 'play') { slow.sum += now - frames.last; if (++slow.n >= 120) { const mean = slow.sum / slow.n; slow = { sum: 0, n: 0 }; if (mean > 24 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); resize(); labrec.emit('dpr', { at: host.tick, cap: dprCap, ms: Math.round(mean) }); } } }
  frames.last = now;
  if (fpsOn && now - lastFps > 1000) { lastFps = now; const f = summary(frames.dt), w = summary(frames.work); $('fps').textContent = `frame ${f.mean.toFixed(1)} ms (p95 ${f.p95.toFixed(1)})\nwork ${w.mean.toFixed(1)} ms\nants ${host.ants}, drawn ${drawnAnts}, dots ${parts.length}\n${renderer?.gpu ?? 'no WebGL2'}`; }
}
function summary(a) { if (!a.length) return { n: 0, mean: 0, p95: 0, max: 0 }; const s = a.slice().sort((p, q) => p - q); return { n: s.length, mean: s.reduce((p, q) => p + q, 0) / s.length, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; }
requestAnimationFrame(frame);

// ---- hooks for checks ----
window.game = {
  ready: performance.now(),   // ms from navigation start to a page that takes input
  state: () => ({ screen, tool, nest: nestOpen, t: host.tick, ants: host.sim.n, drawn: drawnAnts, orders: host.log.length, gl: !!renderer && !renderer.lost, glFailed, frames: frames.drawn, set: { ...set }, tilt: { ...tilt }, night: light.night, dots: parts.length, help: help.shown }),
  stats: () => host.stats(), log: () => JSON.parse(JSON.stringify(host.log)), hashes: () => host.sim.hashes(),
  toScreen: (x, y) => toScreen(x, y), camera: () => ({ ...cam }), setCamera: c => { Object.assign(cam, c); clampCam(); },
  setTool, setNest, lab: () => ({ open: labrec.open, part: labrec.part }),
  frames: { start() { frames.on = true; frames.dt = []; frames.work = []; host.tickMs = []; }, stop() { frames.on = false; return { frame: summary(frames.dt), work: summary(frames.work), tick: host.tickStats(), ants: host.ants, drawn: drawnAnts, dpr, view: [W, H], gpu: renderer?.gpu ?? null }; } },
};
