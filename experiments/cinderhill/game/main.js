// Cinderhill, the game page. It runs the same deterministic sim as the trail painter (../host.js, ../sim) and draws
// it as a lit, tilted hillside (gl.js) with the nest as a cutaway panel (nest.js). No game rule lives here: every
// number on screen is read from the sim or from its events, and every order goes through host.order().
import { Host, CMD, SLOT, SURFACE, NEST, FIELD, SEED, G as GI } from '../host.js';
import { PATH_MAX } from '../sim/flow.js';
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
import { lab } from '../../kit/lab.js';
import { read, write, readJson, writeJson } from '../../kit/save.js';

noZoom();
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const SAVE = 'cinderhill:game', HINT = 'cinderhill:game:hint';

// ---- settings: every taste choice is a setting with a default, and each change is recorded ----
const DEFAULTS = { view: 'tilt', light: 'cycle', style: 'relief', size: '1', sound: 'all' };
const CHOICES = { view: ['tilt', 'top', 'low'], light: ['cycle', 'day', 'ember'], style: ['relief', 'ink'], size: ['1', '1.5'], sound: ['all', 'fx', 'off'] };
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
rec.notice($('menuLab')); rec.toggle($('menuLab')); rec.toggle($('pauseCard'));
const labrec = new LabRecord(rec);
const lookName = () => `game:${set.view}/${set.light}/${set.style}`;
let running = false;
function startRecord() {
  labrec.start(host, { ...set, mode: free ? 'sandbox' : 'colony', look: lookName(), viewport: [innerWidth, innerHeight, Math.round(devicePixelRatio * 100) / 100] });
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
try { renderer = GameRenderer.create(glCanvas, { restored: () => { uploadAll(); trailSig = ''; }, lost: () => { pauseGame(); toast('The picture was lost. It comes back by itself.', 4000); } }); } catch (e) { glFailed = String(e.message || e).slice(0, 300); renderer = null; }
if (!renderer) $('nogl').classList.add('on');
const L0 = host.sim.L;
const cam = { x: L0.sw / 2 + 0.5, y: L0.sh / 2 + 0.5, z: 8 };
const nestCam = { x: L0.nw / 2 + 0.5, y: 0, z: 10 };
// The camera: an eye above the point looked at (cam.x, cam.y), pitched from straight down, with cam.z CSS px to a cell
// at that point. `fk` is the focal length in screen heights (a long lens flattens, a short one shows the horizon).
// gl.js does the same arithmetic in CAM; change both together.
const VIEW = { top: { pitch: 0, fk: 2.2 }, tilt: { pitch: 0.72, fk: 1.7 }, low: { pitch: 1.24, fk: 0.86 } };
const lens = { ...VIEW.low };
function pose(c = cam) { const f = lens.fk * H, D = f / c.z, s = Math.sin(lens.pitch), co = Math.cos(lens.pitch); return { ex: c.x, ey: c.y + D * s, ez: D * co, sin: s, cos: co, f, dist: D }; }
let eye = null;   // this frame's pose, shared by the picture and by every pick
const zMin = () => Math.min(W / L0.sw, H / L0.sh) * 1.2;
function clampCam() { cam.z = Math.max(zMin(), Math.min(44, cam.z)); cam.x = Math.max(0, Math.min(L0.sw, cam.x)); cam.y = Math.max(0, Math.min(L0.sh, cam.y)); eye = pose(); }
function toWorld(sx, sy, h = 0) {
  const v = eye, qx = (sx - W / 2) / v.f, qy = (sy - H / 2) / v.f, dz = Math.min(-qy * v.sin - v.cos, -0.02), t = (h - v.ez) / dz;
  return { x: v.ex + qx * t, y: v.ey + (qy * v.cos - v.sin) * t };
}
function toScreen(wx, wy, h = 0) {
  const v = eye, dy = wy - v.ey, dh = h - v.ez, zc = -dy * v.sin - dh * v.cos;
  if (zc < 0.05) return { x: -1e5, y: -1e5, s: 0 };
  return { x: W / 2 + v.f * (wx - v.ex) / zc, y: H / 2 - v.f * (-dy * v.cos + dh * v.sin) / zc, s: v.f / zc };
}
// Where the camera is heading by itself (the opening, the first trail); any pan or zoom by the player ends it.
let camGoal = null;
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
const startZoom = () => Math.max(9, Math.min(16, Math.min(innerWidth, innerHeight) / 30));   // the first food (8 to 12 cells out) is on screen
cam.z = startZoom() * 0.8;
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
  const spanX = W / cam.z, spanY = H / (cam.z * Math.max(0.3, eye.cos)), n = light.night;
  if (Math.random() < dt * 14) puff(cam.x + rnd(spanX / 2), cam.y + rnd(spanY / 2), 1 + Math.random() * 3, { vx: 0.8 + Math.random(), vy: rnd(0.3), vh: rnd(0.2), size: 0.14 + Math.random() * 0.14, col: [0.75, 0.72, 0.7], a: 0.35 * (1 - n * 0.7), add: false, life: 4 + Math.random() * 3 });
  if (Math.random() < dt * (2 + 26 * n)) puff(cam.x + rnd(spanX / 2), cam.y + rnd(spanY / 2), 0.1, { vx: rnd(0.4), vy: rnd(0.2), vh: 0.7 + Math.random() * 1.2, size: 0.16 + Math.random() * 0.16, col: [1, 0.45 + Math.random() * 0.25, 0.1], a: 0.5 + 0.5 * n, life: 2 + Math.random() * 2.5 });
}
let floats = [], pulses = [], flyers = [], beacon = null, shake = 0;
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
let songOn = false;
function startSong() { if (songOn || set.sound === 'off') return; snd.unlock(); try { song?.start?.(SEED); songOn = !!song; } catch { /* optional */ } }
/** The opening: from close on the door, the view pulls back until the first food is in it. */
function opening() { const e = entrance(); cam.x = e.x; cam.y = e.y; cam.z = 26; clampCam(); camGoal = { x: e.x, y: e.y, z: startZoom(), rate: 0.9 }; }
function play() {
  snd.unlock(); startSong();
  if (saved0 === null && readJson(SAVE) === null) persist();
  if (!running) { startRecord(); running = true; opening(); }
  setScreen('play'); host.last = null; snd.release();
}
function dropTouches() { run(Gs.reset('pause')); nestDrag = null; digMarks = null; strokeW = []; }
function pauseGame() { if (screen !== 'play') return; dropTouches(); setScreen('paused'); snd.hold(); }
function resume() { if (renderer?.lost) return; setScreen('play'); host.last = null; snd.release(); startSong(); }
function restart() {
  dropTouches();
  host = newHost(); stats = host.stats(); crewSeq = -1; seen = null; floats = []; pulses = []; flyers = []; pending = []; beacon = null; alarmAt = null; parts.length = 0; setSpeed(1);
  pileTop.clear(); routeUntil = 0; trailSig = ''; firstTrail = false; clearTimeout(toastTimer); $('toast').classList.remove('on');
  if (tool !== 'trail') setTool('trail'); if (nestOpen) setNest(false, true);
  startRecord(); running = true; uploadAll(); opening(); resume();
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
  labrec.emit('setting', { name: k, to: v, from, id: k, value: v, def: DEFAULTS[k], k, v, at: host.tick });   // name/from/to is what the lab's Settings report counts
  if (k === 'sound') { if (v === 'off') snd.hold(); else { snd.release(); startSong(); } tuneSong(); }
  tone(660, 0.06, 0.03, 'triangle', 80);
});
paintSettings();
for (const c of document.querySelectorAll('.chip[data-say]')) c.addEventListener('click', () => toast(c.dataset.say, 2600));
if (free) for (const b of document.querySelectorAll('#levels [data-level]')) b.hidden = true;

// ---- tools ----
function setTool(next) {
  if (next === tool) { if (next === 'dig') setNest(!nestOpen); return; }
  run(Gs.reset('tool')); tool = next;
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  if (tool === 'dig') { setNest(true); toast('Drag in the nest to mark where to dig'); } else if (tool === 'alarm') toast('Hold a finger down to call the guards there');
  tone(520, 0.05, 0.03, 'triangle');
}
function setNest(on, auto = false) {
  nestOpen = on; nestAuto = on && auto ? performance.now() + 4200 : 0;
  document.body.classList.toggle('nest', on); $('nestBtn').setAttribute('aria-pressed', String(on));
  if (running && !auto) labrec.emit('nest', { on: on ? 1 : 0, at: host.tick });
  requestAnimationFrame(resize);
}
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
$('nestBtn').addEventListener('click', () => setNest(!nestOpen));
$('recall').addEventListener('click', () => { const on = !host.sim.g[GI.RECALL]; order({ type: CMD.RECALL, on: on ? 1 : 0 }); toast(on ? 'Everyone comes home' : 'Out again'); tone(on ? 330 : 520, 0.2, 0.05, 'triangle', on ? -120 : 160); });
const SPEEDS = [1, 2, 4];
function setSpeed(x) { host.speed = x; $('speedText').textContent = `${x}×`; $('speed').setAttribute('aria-pressed', String(x > 1)); }
$('speed').addEventListener('click', () => { const x = SPEEDS[(SPEEDS.indexOf(host.speed ?? 1) + 1) % SPEEDS.length]; setSpeed(x); labrec.emit('speed', { at: host.tick, x }); tone(500 + 150 * x, 0.06, 0.03, 'triangle'); });

// ---- orders ----
let preview = null, alarmAt = null, stats = host.stats(), crewSeq = -1, routeUntil = 0, pending = [], strokeW = [], firstTrail = false;
const showRoute = (ms = 5000) => { routeUntil = performance.now() + ms; };
function order(o) { const e = host.order(o); labrec.order(o, e); return e; }
const crewTrail = () => stats.trails.find(tr => tr.seq === crewSeq) ?? stats.trails.find(tr => tr.newest) ?? null;
function crewStep(delta, level) {
  const tr = crewTrail(); if (!tr || screen !== 'play') return;
  order(level ? { type: CMD.CREW, seq: tr.seq, delta: 0, level } : { type: CMD.CREW, seq: tr.seq, delta });
  tone(level ? 500 + 90 * level : delta > 0 ? 700 : 500, 0.08, 0.04, 'triangle', delta < 0 ? -120 : 120);
  showRoute(); setTimeout(hud, 80);
}
$('crewPlus').addEventListener('click', () => crewStep(1)); $('crewMinus').addEventListener('click', () => crewStep(-1));
for (const b of document.querySelectorAll('#levels [data-level]')) b.addEventListener('click', () => crewStep(0, Number(b.dataset.level)));
function pickTrailAt(sx, sy) {
  let best = null, bd = 26 * 26;
  for (const tr of stats.trails) { const m = trailMid.get(tr.slot); if (!m) continue; const p = toScreen(m.x, m.y, 1.6), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < bd) { bd = d; best = tr; } }
  if (!best) return false;
  crewSeq = best.seq; showRoute(); hud(); tone(600, 0.05, 0.03, 'triangle'); return true;
}
// The stroke, kept as ground points: each sample is placed with the camera as it was when the finger was there.
function strokeTake(screenPts) {
  if (screenPts.length < strokeW.length) strokeW = [];
  for (let i = strokeW.length; i < screenPts.length; i++) { const w = toWorld(screenPts[i][0], screenPts[i][1]); strokeW.push([w.x, w.y]); }
}
function trailPoints() {
  const pts = [];
  for (const [wx, wy] of strokeW) { const x = Math.floor(wx), y = Math.floor(wy), l = pts[pts.length - 1]; if (!l || l[0] !== x || l[1] !== y) pts.push([x, y]); }
  if (pts.length < 2) return null;
  return (pts.length <= 64 ? pts : Array.from({ length: 64 }, (_, k) => pts[Math.round(k * (pts.length - 1) / 63)])).flat();
}
const alarmOrder = hold => order({ type: CMD.ALARM, layer: SURFACE, x: alarmAt.cx, y: alarmAt.cy, hold });
function act(a) {
  switch (a.type) {
    case 'preview': preview = a; strokeTake(a.points); break;
    case 'clear': preview = null; break;
    case 'pan': { const w = toWorld(W / 2 + a.dx, H / 2 + a.dy); cam.x -= w.x - cam.x; cam.y -= w.y - cam.y; camGoal = null; clampCam(); break; }
    case 'zoom': { const b = toWorld(a.x, a.y); cam.z *= a.f; clampCam(); const c = toWorld(a.x, a.y); cam.x += b.x - c.x; cam.y += b.y - c.y; camGoal = null; clampCam(); break; }
    case 'order': {
      if (a.tool !== 'trail') break;
      strokeTake(a.points);
      const points = trailPoints(); strokeW = []; if (!points) break;
      pending.push({ e: order({ type: CMD.TRAIL, layer: SURFACE, points }), points });   // the sim answers on its next tick: see settle()
      tone(520, 0.05, 0.03, 'triangle');
      break;
    }
    case 'alarm': {
      if (a.phase === 'start') {
        const w = toWorld(a.x, a.y), cx = Math.floor(w.x), cy = Math.floor(w.y);
        alarmAt = { x: cx + 0.5, y: cy + 0.5, cx, cy, tick: host.tick }; alarmOrder(400);
        tone(880, 0.25, 0.05, 'sawtooth', -300); shake = 0.25; navigator.vibrate?.(12);
      } else if (a.phase === 'end' && alarmAt) { alarmOrder(1); alarmAt = null; }   // the cell called at the start, wherever the view is now
      break;
    }
    case 'tap': pickTrailAt(a.x, a.y); break;
  }
}
/** What the sim said to the trails drawn since the last tick: only a trail it took is shown as laid. */
function settle() {
  for (const q of pending) {
    if (q.e.state === 'queued') continue;
    const pts = q.points, ok = q.e.state === 'applied';
    pulses.push({ pts, at: performance.now(), bad: !ok });
    if (ok) {
      for (let i = 0; i < pts.length; i += 2) puff(pts[i] + 0.5, pts[i + 1] + 0.5, 0.2, { vx: rnd(0.5), vy: rnd(0.5), vh: 0.8, size: 0.5, grow: 0.5, col: [1, 0.7, 0.3], a: 0.7, life: 0.7 });
      tone(620, 0.14, 0.06, 'triangle', -180); navigator.vibrate?.(8); ghostDone(); showRoute(6000);
      if (!firstTrail) { firstTrail = true; frameTrail(pts); }
    } else {
      for (let i = 0; i < pts.length; i += 2) puff(pts[i] + 0.5, pts[i + 1] + 0.5, 0.2, { vx: rnd(0.3), vy: rnd(0.3), vh: 0.3, size: 0.45, grow: 0.3, col: [0.5, 0.45, 0.42], a: 0.6, add: false, life: 0.8 });
      tone(150, 0.22, 0.07, 'sawtooth', -40); toast('No ant can walk that. Start on open ground.');
    }
  }
  pending = pending.filter(q => q.e.state === 'queued');
}
/** After the first trail: the view eases out until the whole of it, door to food, is in the picture. */
function frameTrail(pts) {
  const e = entrance(); let x0 = e.x, x1 = e.x, y0 = e.y, y1 = e.y;
  const take = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); };
  for (let i = 0; i < pts.length; i += 2) take(pts[i], pts[i + 1]);
  for (const p of stats.piles) if (p.amount > 0 && Math.hypot(p.x - e.x, p.y - e.y) < 16) take(p.x, p.y);   // and the other food near the door
  const z = Math.min(cam.z, (W - 60) / (x1 - x0 + 6), (H - 260) * eye.cos / (y1 - y0 + 6));
  camGoal = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: Math.max(zMin(), z), rate: 1.6 };
}
function run(actions) { for (const a of actions) act(a); }
const P = e => ({ id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), kind: e.pointerType, button: e.button, primary: e.isPrimary });
ui.addEventListener('pointerdown', e => { if (screen !== 'play') return; if (!Gs.state.stroke) strokeW = []; try { ui.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ } run(Gs.down(P(e), tool === 'dig' ? 'camera' : tool)); });
ui.addEventListener('pointermove', e => { if (screen === 'play') run(Gs.move(P(e))); });
ui.addEventListener('pointerup', e => { if (screen === 'play') run(Gs.move(P(e))); run(Gs.up(P(e))); });   // the last stretch of the stroke counts
ui.addEventListener('pointercancel', e => run(Gs.cancel(e.pointerId, 'pointercancel')));
ui.addEventListener('lostpointercapture', e => run(Gs.cancel(e.pointerId, 'lostpointercapture')));
ui.addEventListener('contextmenu', e => e.preventDefault());
ui.addEventListener('wheel', e => { if (screen !== 'play') return; e.preventDefault(); act({ type: 'zoom', f: Math.exp(-e.deltaY * 0.0015), x: e.clientX, y: e.clientY }); }, { passive: false });
// The first drag, shown and not told: a ghost finger draws from the door to the nearest food until the player has
// laid a trail. Kept in the kit hint's own key and format, so a player who has done it never sees it again.
const ghost = { off: query.get('hint') === '0' || (read(HINT) === '1' && !query.get('hint')), t0: 0 };
function ghostDone() { if (!ghost.off) { ghost.off = true; write(HINT, '1'); } }
const ghostOn = () => !ghost.off && screen === 'play' && tool === 'trail' && !nestOpen && !preview && !free;

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
  if (nestDrag) { nestDrag = null; digMarks = null; return; }   // a second finger ends the first one's stroke and marks nothing
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
  if (nestDrag.dig && ok && screen === 'play' && digMarks?.cells.length) { const c = digMarks.cells; for (let k = 0; k < c.length; k += 512) order({ type: CMD.DIG, cells: c.slice(k, k + 512) }); tone(180, 0.1, 0.06, 'square', -60); }
  nestDrag = null; digMarks = null;
}
nestCanvas.addEventListener('pointerup', e => nestUp(e, true));
nestCanvas.addEventListener('pointercancel', e => nestUp(e, false));
nestCanvas.addEventListener('lostpointercapture', e => nestUp(e, false));

// ---- what the sim reports, shown ----
let seen = null;   // the counts last shown, to notice what changed
function news() {
  const g = host.sim.g, ent = entrance();
  for (const [type, a, b] of (host.news ?? []).splice(0)) {
    if (type === EVENT.HOME) {
      const col = KIND_COL[b ? 1 : 0];
      burst(ent.x, ent.y, col, 5, { size: 0.3 });
      const now = performance.now(), kind = b ? 1 : 0, f = floats.find(f => f.kind === kind && now - f.at < 500);
      if (f) { f.n++; f.at = now; } else floats.push({ x: ent.x + (kind ? 1.6 : -1.6), y: ent.y, at: now, t0: now, n: 1, kind, col: b ? '#ff9d7a' : '#ffe08a' });
      if (flyers.length < 14) flyers.push({ at: now, kind, col: a >= SLOT.TRAIL0 ? TRAIL_CSS[(a - SLOT.TRAIL0) % 4] : b ? '#ff9d7a' : '#ffe08a', bend: rnd(60) });
      const n = set.sound === 'all' ? song?.ember?.() : null;
      if (!n) tone(1500 + Math.random() * 500, 0.04, 0.02, 'sine', 300);
    } else if (type === EVENT.PILE_NEW) {
      const c = host.sim.pileCell[a]; if (c >= 0) { beacon = { x: c % L0.sw, y: Math.floor(c / L0.sw), at: performance.now() }; burst(beacon.x + 0.5, beacon.y + 0.5, KIND_COL[b ? 1 : 0], 16, { vh: 4 }); }
      toast(b ? 'Something fell on the hill' : 'Seeds have dropped nearby'); tone(b ? 520 : 780, 0.2, 0.05, 'triangle', 220); navigator.vibrate?.(8);
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
  trailMesh();
  const tr = crewTrail();
  $('route').classList.toggle('on', !!tr && screen === 'play' && !nestOpen && performance.now() < routeUntil);
  if (tr) {
    $('routeDot').style.background = TRAIL_CSS[(tr.slot - SLOT.TRAIL0) % 4];
    $('routeName').textContent = tr.level === 3 ? 'Surge' : tr.level === 2 ? 'Steady' : tr.level === 1 ? 'Light' : 'Trail';
    const why = tr.why === 'jammed' ? 'door jammed' : tr.why === 'noFree' ? 'no free ants' : tr.why === 'older' ? 'ants prefer the newest' : tr.why === 'noSeekers' ? 'nobody is looking' : tr.why === 'outTooLong' ? 'they have been out too long' : '';
    $('routeInfo').textContent = `${tr.on}${tr.want === null ? '' : ' of ' + tr.want} ants · ${tr.loads} home a minute${why ? ' · ' + why : ''}`;
    for (const b of document.querySelectorAll('#levels [data-level]')) b.setAttribute('aria-pressed', String(Number(b.dataset.level) === tr.level));
  }
  const rc = !!host.sim.g[GI.RECALL];
  $('recall').setAttribute('aria-pressed', String(rc));
  tuneSong();
}

// ---- the trails as ribbons on the ground (gl.js draws them under the ants), one colour a trail ----
const TRAIL_COL = [[1, 0.70, 0.22], [0.30, 0.82, 1], [1, 0.42, 0.72], [0.62, 0.95, 0.32]];
const TRAIL_CSS = ['#ffb338', '#4dd1ff', '#ff6bb8', '#9ef252'];
const trailMid = new Map();   // trail slot: where its badge stands (the middle of the path)
let trailSig = '', trailBuf = new Float32Array(0);
function trailMesh() {
  const F = host.sim.flow; let sig = '';
  for (const tr of stats.trails) sig += `${tr.slot}:${tr.seq}:${F.pathLen[tr.slot - SLOT.TRAIL0]}:${tr.level};`;
  if (sig === trailSig) return; trailSig = sig; trailMid.clear();
  const out = [], HW = 0.42;
  for (const tr of stats.trails) {
    const k = tr.slot - SLOT.TRAIL0, len = Math.min(F.pathLen[k], PATH_MAX), col = TRAIL_COL[k % 4], speed = 1.6 + 0.9 * (tr.level || 1);
    if (len < 2) { trailMid.set(tr.slot, { x: tr.x + 0.5, y: tr.y + 0.5 }); continue; }
    // The path's cells, thinned, then rounded off once (corner cutting), so the ribbon bends and does not step.
    let pts = []; const stepN = Math.max(2, Math.ceil(len / 300));
    for (let j = 0; j < len; j += stepN) { const c = F.path[k * PATH_MAX + j]; pts.push([c % L0.sw + 0.5, Math.floor(c / L0.sw) + 0.5]); }
    const last = F.path[k * PATH_MAX + len - 1]; pts.push([last % L0.sw + 0.5, Math.floor(last / L0.sw) + 0.5]);
    for (let pass = 0; pass < 2 && pts.length > 2; pass++) {
      const r = [pts[0]];
      for (let j = 0; j < pts.length - 1; j++) { const a = pts[j], b = pts[j + 1]; r.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
      r.push(pts[pts.length - 1]); pts = r;
    }
    const mid = pts[pts.length >> 1]; trailMid.set(tr.slot, { x: mid[0], y: mid[1] });
    let s = 0, pl = null, pr = null, ps = 0;
    for (let j = 0; j < pts.length; j++) {
      const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx = nx / nl * HW; ny = ny / nl * HW;
      if (j) s += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
      const l = [pts[j][0] + nx, pts[j][1] + ny], r = [pts[j][0] - nx, pts[j][1] - ny];
      if (pl) for (const [q, u, ss] of [[pl, -1, ps], [pr, 1, ps], [l, -1, s], [pr, 1, ps], [r, 1, s], [l, -1, s]]) out.push(q[0], q[1], u, ss, col[0], col[1], col[2], speed);
      pl = l; pr = r; ps = s;
    }
  }
  if (out.length > trailBuf.length) trailBuf = new Float32Array(out.length * 2);
  trailBuf.set(out); renderer?.setTrails(trailBuf, out.length / 8);
}

// ---- the overlay: the stroke being drawn, trail badges, loads coming home, where the food is ----
let chipAt = [null, null];
const pileTop = new Map();   // the most each pile has held, to know when it is nearly gone
function chipPlaces() { chipAt = ['chipSugar', 'chipProtein'].map(id => { const r = $(id).getBoundingClientRect(); return r.width ? { x: r.left + 14, y: r.top + r.height / 2 } : null; }); }
function drawOverlay(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pu of pulses) {
    const k = (now - pu.at) / 900; if (k > 1) continue;
    ctx.strokeStyle = pu.bad ? `rgba(255, 70, 50, ${1 - k})` : `rgba(255, 210, 120, ${1 - k})`; ctx.lineWidth = pu.bad ? 4 : 3 + 8 * k;
    if (pu.bad) ctx.setLineDash([6, 8]);
    ctx.beginPath(); for (let i = 0; i < pu.pts.length; i += 2) { const p = toScreen(pu.pts[i] + 0.5, pu.pts[i + 1] + 0.5); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]);
  }
  pulses = pulses.filter(pu => now - pu.at < 900);
  if (screen === 'play') {
    const sel = performance.now() < routeUntil ? crewTrail() : null;
    for (const tr of stats.trails) {
      const m = trailMid.get(tr.slot); if (!m) continue;
      const p = toScreen(m.x, m.y, 1.6), q = toScreen(m.x, m.y, 0.05), css = TRAIL_CSS[(tr.slot - SLOT.TRAIL0) % 4];
      if (p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
      ctx.strokeStyle = css; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();   // a flag pole
      const label = tr.want === null || tr.on >= tr.want ? String(tr.on) : `${tr.on}/${tr.want}`, w = 30 + label.length * 7.5;
      ctx.fillStyle = tr === sel ? css : 'rgba(26, 18, 14, 0.92)'; ctx.strokeStyle = tr === sel ? '#fff8ea' : css; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - 12, w, 22, 11); ctx.fill(); ctx.stroke();
      const ink = tr === sel ? '#1b0f08' : '#f3e6d6'; ctx.fillStyle = ink;
      const ax = p.x - w / 2 + 12; for (const [dx, r] of [[-3.6, 2.6], [0, 1.9], [3.2, 2.2]]) { ctx.beginPath(); ctx.arc(ax + dx, p.y - 1, r, 0, 7); ctx.fill(); }   // a small ant: this many walk the trail
      ctx.font = '700 12px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, ax + 8, p.y - 0.5);
    }
    // Food off screen: a small arrow at the edge, in the food's colour.
    for (const p of stats.piles) {
      if (p.amount <= 0) continue;
      const s = toScreen(p.x + 0.5, p.y + 0.5); if (s.s && s.x > 12 && s.y > 60 && s.x < W - 12 && s.y < H - 90) continue;
      const cx = W / 2, cy = H / 2, a = s.s ? Math.atan2(s.y - cy, s.x - cx) : Math.PI / 2, m = 30;
      const k = Math.min(Math.abs(Math.cos(a)) > 1e-6 ? (W / 2 - m) / Math.abs(Math.cos(a)) : Infinity, Math.abs(Math.sin(a)) > 1e-6 ? (H / 2 - m - 50) / Math.abs(Math.sin(a)) : Infinity);
      const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k, kind = host.sim.pileKind?.[p.p] ? 1 : 0, beat = 1 + 0.15 * Math.sin(now / 240);
      ctx.fillStyle = kind ? '#e0603c' : '#f3d77a'; ctx.strokeStyle = 'rgba(20, 12, 8, 0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 13 * beat, y + Math.sin(a) * 13 * beat); ctx.lineTo(x + Math.cos(a + 2.5) * 11, y + Math.sin(a + 2.5) * 11); ctx.lineTo(x + Math.cos(a - 2.5) * 11, y + Math.sin(a - 2.5) * 11); ctx.closePath(); ctx.stroke(); ctx.fill();
    }
    // Food nearly gone: a thin ring that empties, so the next trail can be planned before the toast.
    for (const p of stats.piles) {
      const top = Math.max(pileTop.get(p.p) ?? 0, p.amount); pileTop.set(p.p, top);
      if (p.amount <= 0 || p.amount > top * 0.25) continue;
      const s = toScreen(p.x + 0.5, p.y + 0.5, 0.4); if (!s.s) continue;
      ctx.strokeStyle = `rgba(255, 120, 80, ${0.55 + 0.35 * Math.sin(now / 180)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(10, s.s * 1.6), -Math.PI / 2, -Math.PI / 2 + (p.amount / (top * 0.25)) * 2 * Math.PI); ctx.stroke();
    }
  }
  // Loads home: one count a kind by the door (loads close together add up), and a grain that flies to its counter.
  const door = toScreen(entrance().x, entrance().y, 0.6);
  for (const f of floats) {
    const k = (now - f.at) / 1100; if (k > 1) continue;
    const p = toScreen(f.x, f.y, 1.6 + Math.min(1, (now - f.t0) / 900) * 1.6), text = `+${f.n}`;
    ctx.globalAlpha = 1 - k * k; ctx.fillStyle = f.col; ctx.font = `800 ${15 + Math.min(8, f.n)}px ui-rounded, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(20, 10, 6, 0.85)'; ctx.lineWidth = 3.5; ctx.strokeText(text, p.x, p.y); ctx.fillText(text, p.x, p.y);
  }
  ctx.globalAlpha = 1; floats = floats.filter(f => now - f.at < 1100);
  for (const f of flyers) {
    const to = chipAt[f.kind], k = (now - f.at) / 650; if (!to || k > 1 || !door.s) continue;
    const e = k * k * (3 - 2 * k), mx = (door.x + to.x) / 2 + f.bend, my = Math.min(door.y, to.y) - 40;
    const x = (1 - e) * (1 - e) * door.x + 2 * e * (1 - e) * mx + e * e * to.x, y = (1 - e) * (1 - e) * door.y + 2 * e * (1 - e) * my + e * e * to.y;
    ctx.fillStyle = f.col; ctx.shadowColor = f.col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y, 4.5 - 1.5 * e, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }
  flyers = flyers.filter(f => now - f.at < 650);
  if (preview?.points.length && preview.tool === 'trail' && strokeW.length) {
    ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 14; ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 5;
    ctx.beginPath(); strokeW.forEach(([x, y], i) => { const p = toScreen(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke(); ctx.shadowBlur = 0;
  }
  if (ghostOn()) drawGhost(now); else ghost.t0 = 0;
  const st = Gs.state.stroke;
  if (st && st.tool === 'alarm' && !st.alarm && !Gs.state.dead) { const k = Math.min(1, (now - st.t0) / 300); ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(st.x0, st.y0, 28, -Math.PI / 2, -Math.PI / 2 + k * 2 * Math.PI); ctx.stroke(); }
}
/** The ghost finger: from the door, round a bend, to the nearest food; it draws, lifts, and starts again. */
function drawGhost(now) {
  const e = entrance(); let best = null, bd = Infinity;
  for (const p of stats.piles) { if (p.amount <= 0) continue; const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2; if (d < bd) { bd = d; best = p; } }
  if (!best) return;
  if (!ghost.t0) ghost.t0 = now + 900;                     // a breath after the view settles
  const t = ((now - ghost.t0) % 2600) / 2600; if (now < ghost.t0) return;
  const bx = best.x + 0.5, by = best.y + 0.5, dx = bx - e.x, dy = by - e.y, L = Math.hypot(dx, dy) || 1, cx = (e.x + bx) / 2 - dy / L * L * 0.22, cy = (e.y + by) / 2 + dx / L * L * 0.22;
  const at = u => { const x = (1 - u) * (1 - u) * e.x + 2 * u * (1 - u) * cx + u * u * bx, y = (1 - u) * (1 - u) * e.y + 2 * u * (1 - u) * cy + u * u * by; return toScreen(x, y); };
  const k = Math.min(1, t / 0.62), u = k * k * (3 - 2 * k), fade = t < 0.08 ? t / 0.08 : t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.2) : 1;
  ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = '#ffe2b0'; ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 12; ctx.lineWidth = 5; ctx.setLineDash([2, 10]);
  ctx.beginPath(); for (let j = 0; j <= 24; j++) { const p = at(u * j / 24); j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
  const f = at(u), press = t > 0.62 ? 1 + (t - 0.62) * 2 : 1;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(f.x, f.y, 19 * press, 0, 7); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
  if (!beacon || now - beacon.at > 2400) beacon = { x: best.x, y: best.y, at: now };   // the food it points at glints
}
function drawNestPanel(now) {
  nctx.setTransform(dpr, 0, 0, dpr, 0, 0); nctx.clearRect(0, 0, NW, NH);
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
  if (stepped) settle();
  if (alarmAt && host.tick - alarmAt.tick >= 200) { alarmOrder(400); alarmAt.tick = host.tick; }   // a held alarm, renewed in game time (the sim holds it 400 ticks)
  news();
  if (stepped) { uploadAnts(); if (host.tick % 2 === 0 || stepped > 1) uploadScent(); if (host.terrainVersion !== uploadedTerrain) uploadTerrain(); }
  light = lightNow(now);
  const want = screen === 'menu' ? VIEW.low : VIEW[set.view], e = Math.min(1, dt * 3.5); lens.pitch += (want.pitch - lens.pitch) * e; lens.fk += (want.fk - lens.fk) * e;
  if (screen === 'menu') { const en = entrance(); cam.x = en.x + 5 * Math.sin(now / 7000); cam.y = en.y + 3; cam.z = startZoom() * 0.8; }
  else if (camGoal && screen === 'play') { const g = Math.min(1, dt * camGoal.rate); cam.x += (camGoal.x - cam.x) * g; cam.y += (camGoal.y - cam.y) * g; cam.z *= Math.exp(Math.log(camGoal.z / cam.z) * g); if (Math.abs(Math.log(camGoal.z / cam.z)) < 0.03 && Math.abs(camGoal.x - cam.x) < 0.05) camGoal = null; }
  clampCam();
  if (screen !== 'paused') { ambient(dt); stepParts(dt); }
  if (nestAuto && now > nestAuto) { nestAuto = 0; if (tool !== 'dig') setNest(false, true); }
  shake = Math.max(0, shake - dt);
  const view = shake ? pose({ x: cam.x + rnd(shake * 0.6), y: cam.y + rnd(shake * 0.6), z: cam.z }) : eye;
  const piles = stats.piles.map(p => ({ x: p.x, y: p.y, amount: p.amount, kind: host.sim.pileKind?.[p.p] ? 1 : 0 }));
  const b = beacon && now - beacon.at < 7000 ? { x: beacon.x, y: beacon.y, age: (now - beacon.at) / 1000 } : null;
  if (renderer && renderer.draw({ view, light, ink: set.style === 'ink', alpha: screen === 'play' ? host.alpha : 1, running: screen === 'play', time: now / 1000, piles, entrance: { ...entrance(), w: 3 }, alarm: stats.alarm ? alarmAt : null, beacon: b, big: Number(set.size) })) frames.drawn++;
  drawOverlay(now);
  if (nestOpen) drawNestPanel(now);
  if (now - lastHud > 250) { lastHud = now; if (screen !== 'menu') { hud(); chipPlaces(); } }
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
  state: () => ({ screen, tool, nest: nestOpen, t: host.tick, ants: host.sim.n, drawn: drawnAnts, orders: host.log.length, gl: !!renderer && !renderer.lost, glFailed, frames: frames.drawn, set: { ...set }, lens: { ...lens }, night: light.night, dots: parts.length, help: ghostOn(), pending: pending.length, alarm: alarmAt ? [alarmAt.cx, alarmAt.cy] : null, route: $('route').classList.contains('on') }),
  stats: () => host.stats(), log: () => JSON.parse(JSON.stringify(host.log)), hashes: () => host.sim.hashes(),
  toScreen: (x, y, h) => toScreen(x, y, h), toWorld: (x, y) => toWorld(x, y), camera: () => ({ ...cam }), setCamera: c => { camGoal = null; Object.assign(cam, c); clampCam(); },
  mat: (x, y) => host.sim.mat[y * L0.sw + x], size: () => [L0.sw, L0.sh], door: () => entrance(),
  setTool, setNest, lab: () => ({ open: labrec.open, part: labrec.part }),
  frames: { start() { frames.on = true; frames.dt = []; frames.work = []; host.tickMs = []; }, stop() { frames.on = false; return { frame: summary(frames.dt), work: summary(frames.work), tick: host.tickStats(), ants: host.ants, drawn: drawnAnts, dpr, view: [W, H], gpu: renderer?.gpu ?? null }; } },
};
