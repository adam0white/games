// Cinderhill: The Crossing. The page for the war sim (./sim.js): two colonies on one hill. No game rule lives here:
// everything on screen is read from the sim or its events, and every order goes through host.order() under seat 0.
import { Host } from './host.js';
import { CMD, KIND, CG, EVENT, REASON, TASK, CASTE, STAGE, MAT, ROOM, TRAILS, PATH_MAX, MAX_PILES, C, LEVEL_SHARE, RAID_SHARE } from './sim.js';
import { makeGestures } from '../gestures.js';
import { GameRenderer, sky } from '../game/gl.js';
import { noZoom } from '../../kit/zoom.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { sound } from '../../kit/audio.js';
import { music } from '../../kit/music.js';
import { lab } from '../../kit/lab.js';
import { settings } from '../../kit/settings.js';

noZoom();
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const ME = 0, FOE = 1;

// ---- recording and settings: every taste choice is a setting with a default, and each change is recorded ----
const rec = lab('cinderhill', { lang: () => 'en' });
rec.notice($('menuLab')); rec.toggle($('menuLab')); rec.toggle($('pauseLab'));
const set = settings('cinderhill', {
  rival: { values: ['timid', 'steady', 'bold'], def: 'timid', key: 'cinderhill:war:rival' },
  view: { values: ['tilt', 'top', 'low'], def: 'tilt', key: 'cinderhill:war:view' },
  light: { values: ['cycle', 'day', 'ember'], def: 'cycle', key: 'cinderhill:war:light' },
  style: { values: ['relief', 'ink'], def: 'relief', key: 'cinderhill:war:style' },
  size: { values: ['1', '1.5'], def: '1.5', key: 'cinderhill:war:size' },
  sound: { values: ['all', 'fx', 'off'], def: 'all', key: 'cinderhill:war:sound' },
}, { rec });
const LABEL = { rival: 'Rival', view: 'View', light: 'Light', style: 'Style', size: 'Ants', sound: 'Sound' };
const NAME = { timid: 'Timid', steady: 'Steady', bold: 'Bold', tilt: 'Tilted', top: 'Top down', low: 'Low', cycle: 'Day to dusk', day: 'Day', ember: 'Ember', relief: 'Painted', ink: 'Ink', 1: 'True size', 1.5: 'Larger', all: 'Music & effects', fx: 'Effects', off: 'Off' };
const MOOD = { timid: 0, steady: 1, bold: 2 };
const redraw = set.panel($('settings'), { label: id => LABEL[id], name: (id, v) => NAME[v] ?? v, what: (id, v) => (id === 'rival' ? (v === 'timid' ? 'It never attacks your hill. Applies from the next start.' : v === 'bold' ? 'It raids early, even at even odds. Applies from the next start.' : 'It holds the fords, and raids when it has the numbers. Applies from the next start.') : null), onChange: (id, v) => { if (id === 'sound') { if (v === 'off') snd.hold(); else { snd.release(); startSong(); } } tone(660, 0.06, 0.03, 'triangle', 80); } });

// ---- the game ----
const qSeed = Math.floor(Number(query.get('seed')));
let seed = qSeed > 0 ? qSeed : 1 + Math.floor(Math.random() * 9999);
const newHost = () => new Host({ seed, ai: { [FOE]: MOOD[set.get('rival')] } });
let host = newHost(), sim = host.sim;
let screen = 'menu', tool = 'trail', nestOpen = false, running = false, speed = 1, lastT = 0;
const Gs = makeGestures();
const L0 = sim.L;
const doorXY = t => { const c = sim.door[t]; return { x: c % L0.sw + 0.5, y: Math.floor(c / L0.sw) + 0.5 }; };
const g = (t, k) => sim.cg[t * CG.SIZE + k];

let song = null, songOn = false;
const snd = sound({ on: () => set.get('sound') !== 'off', setup: ac => { try { song = music(ac, { preset: 'bell' }); } catch { song = null; } } });
const tone = (...a) => { if (set.get('sound') !== 'off') snd.tone(...a); };
function startSong() { if (songOn || set.get('sound') === 'off') return; snd.unlock(); try { song?.start?.(seed); songOn = !!song; } catch { /* the score is optional */ } }
let danger = 0;
function tuneSong() { try { song?.set?.({ on: set.get('sound') === 'all' && screen === 'play', progress: Math.min(1, sim.tick / sim.cfg.duskTick), danger, light: 1 - light.night }); } catch { /* optional */ } }

addEventListener('error', e => rec.event('error', { m: String(e.message ?? 'error').slice(0, 200) }));

// ---- canvases and the camera (the same arithmetic as gl.js CAM) ----
const glCanvas = $('gl'), ui = $('c'), ctx = ui.getContext('2d'), nestCanvas = $('nest'), nctx = nestCanvas.getContext('2d'), mini = $('miniC'), mctx = mini.getContext('2d');
let dprCap = 2, slow = { sum: 0, n: 0 };
let W = innerWidth, H = innerHeight, dpr = Math.min(dprCap, devicePixelRatio || 1), NW = 1, NH = 1;
let renderer = null, glFailed = '';
try { renderer = GameRenderer.create(glCanvas, { restored: () => { uploadTerrain(); trailSig = '?'; }, lost: () => pauseGame() }); } catch (e) { glFailed = String(e.message || e).slice(0, 300); renderer = null; }
if (!renderer) $('nogl').classList.add('on');
const cam = { x: doorXY(ME).x, y: doorXY(ME).y, z: 10 };
const nestCam = { x: doorXY(ME).x, y: 0, z: 12 };
const VIEW = { top: { pitch: 0, fk: 2.2 }, tilt: { pitch: 0.72, fk: 1.7 }, low: { pitch: 1.24, fk: 0.86 } };
const lens = { ...VIEW.low };
let nestLift = 0, eye = null, camGoal = null, shake = 0;
function pose(c = cam) { const f = lens.fk * H, D = f / c.z, s = Math.sin(lens.pitch), co = Math.cos(lens.pitch), y = c.y + nestLift / (c.z * Math.max(0.3, co)); return { ex: c.x, ey: y + D * s, ez: D * co, sin: s, cos: co, f, dist: D }; }
const zMin = () => Math.min(W / L0.sw, H / L0.sh) * 1.1;
function clampCam() { cam.z = Math.max(zMin(), Math.min(44, cam.z)); cam.x = Math.max(0, Math.min(L0.sw, cam.x)); cam.y = Math.max(0, Math.min(L0.sh, cam.y)); eye = pose(); }
function toWorld(sx, sy, h = 0) {
  const v = eye, qx = (sx - W / 2) / v.f;
  let qy = (sy - H / 2) / v.f;
  if (v.sin > 0.05) qy = Math.max(qy, (0.05 - v.cos) / v.sin);
  const dz = -qy * v.sin - v.cos, t = (h - v.ez) / dz;
  return { x: v.ex + qx * t, y: v.ey + (qy * v.cos - v.sin) * t };
}
function toScreen(wx, wy, h = 0) {
  const v = eye, dy = wy - v.ey, dh = h - v.ez, zc = -dy * v.sin - dh * v.cos;
  if (zc < 0.05) return { x: -1e5, y: -1e5, s: 0 };
  return { x: W / 2 + v.f * (wx - v.ex) / zc, y: H / 2 - v.f * (-dy * v.cos + dh * v.sin) / zc, s: v.f / zc };
}
function resize() {
  W = innerWidth; H = innerHeight; dpr = Math.min(dprCap, devicePixelRatio || 1);
  ui.width = Math.round(W * dpr); ui.height = Math.round(H * dpr);
  renderer?.resize(W, H, dpr);
  const r = nestCanvas.getBoundingClientRect(); NW = Math.max(1, r.width); NH = Math.max(1, r.height);
  nestCanvas.width = Math.round(NW * dpr); nestCanvas.height = Math.round(NH * dpr);
  nestCam.z = Math.max(10, Math.min(18, NW / 30));
  clampCam();
}
addEventListener('resize', resize);
const startZoom = () => Math.max(7, Math.min(13, Math.min(innerWidth, innerHeight) / 44));
resize();

// ---- uploads ----
const inst = new Float32Array(sim.cfg.maxAnts * 8);
let drawnAnts = 0;
const prevOf = new Int32Array(sim.cfg.maxAnts);   // each ant's index a tick ago, or -1 (the dead leave gaps)
function matchPrev() { let j = 0; for (let i = 0; i < sim.n; i++) { let k = j; while (k < host.pn && host.pid[k] !== sim.id[i]) k++; if (k < host.pn) { prevOf[i] = k; j = k + 1; } else prevOf[i] = -1; } }
function uploadAnts() {
  matchPrev();
  if (!renderer) return;
  let k = 0;
  for (let i = 0; i < sim.n; i++) {
    if (sim.layer[i] !== 0) continue;
    const p = prevOf[i], jump = p < 0 || host.pl[p] !== 0, x = sim.x[i] / 256, y = sim.y[i] / 256, major = sim.caste[i] === CASTE.MAJOR;
    inst[k] = jump ? x : host.px[p] / 256; inst[k + 1] = jump ? y : host.py[p] / 256; inst[k + 2] = x; inst[k + 3] = y;
    inst[k + 4] = sim.heading[i] * (Math.PI / 128); inst[k + 5] = (major ? 2 + 8 : 0) + (sim.team[i] ? 16 : 0); inst[k + 6] = sim.carry[i]; inst[k + 7] = (sim.id[i] * 0.618034) % 1;
    k += 8;
  }
  drawnAnts = k / 8; renderer.setAnts(inst, drawnAnts);
}
function uploadTerrain() { if (!renderer) return; renderer.setTerrain(L0.sw, L0.sh, sim.mat.subarray(0, L0.sw * L0.sh)); renderer.setScent(L0.sw, L0.sh, new Uint8Array(L0.sw * L0.sh * 4)); }
uploadTerrain(); uploadAnts();

// ---- particles ----
const MAXP = 800, parts = [], dots = new Float32Array(MAXP * 8);
function puff(x, y, h, o = {}) { if (parts.length >= MAXP) parts.shift(); parts.push({ x, y, h, vx: o.vx ?? 0, vy: o.vy ?? 0, vh: o.vh ?? 0, size: o.size ?? 0.5, grow: o.grow ?? 0, col: o.col ?? [1, 0.6, 0.2], a: o.a ?? 1, add: o.add ?? true, life: o.life ?? 1, age: 0, drag: o.drag ?? 0 }); }
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
function burst(x, y, col, n = 8, o = {}) { for (let k = 0; k < n; k++) puff(x + rnd(0.3), y + rnd(0.3), 0.3, { vx: rnd(2.2), vy: rnd(2.2), vh: 1.5 + Math.random() * 2.5, size: 0.35 + Math.random() * 0.3, col, life: 0.5 + Math.random() * 0.5, drag: 2, ...o }); }
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age >= p.life) { parts.splice(i, 1); continue; } const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.h = Math.max(0, p.h + p.vh * dt); p.size += p.grow * dt; }
  let k = 0;
  for (const p of parts) { const t = p.age / p.life, a = p.a * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85), o = k++ * 8; dots[o] = p.x; dots[o + 1] = p.y; dots[o + 2] = p.h; dots[o + 3] = p.size; dots[o + 4] = p.col[0] * a; dots[o + 5] = p.col[1] * a; dots[o + 6] = p.col[2] * a; dots[o + 7] = p.add ? 0 : a; }
  renderer?.setDots(dots, k);
}
function ambient(dt) {
  const spanX = W / cam.z, spanY = H / (cam.z * Math.max(0.3, eye.cos)), n = light.night;
  if (Math.random() < dt * 12) puff(cam.x + rnd(spanX / 2), cam.y + rnd(spanY / 2), 1 + Math.random() * 3, { vx: 0.8 + Math.random(), vy: rnd(0.3), vh: rnd(0.2), size: 0.14 + Math.random() * 0.14, col: [0.75, 0.72, 0.7], a: 0.35 * (1 - n * 0.7), add: false, life: 4 + Math.random() * 3 });
  if (Math.random() < dt * (2 + 26 * n)) puff(cam.x + rnd(spanX / 2), cam.y + rnd(spanY / 2), 0.1, { vx: rnd(0.4), vy: rnd(0.2), vh: 0.7 + Math.random() * 1.2, size: 0.16 + Math.random() * 0.16, col: [1, 0.45 + Math.random() * 0.25, 0.1], a: 0.5 + 0.5 * n, life: 2 + Math.random() * 2.5 });
}
let floats = [], pulses = [], beacon = null;
const KIND_COL = [[1, 0.85, 0.4], [1, 0.4, 0.25]];

let toastTimer = 0;
function toast(text, ms = 2400, bad = false) { const el = $('toast'); el.textContent = text; el.classList.toggle('bad', bad); el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms); }

// ---- screens ----
function setScreen(s) {
  screen = s;
  for (const id of ['menu', 'paused', 'over']) $(id).classList.toggle('on', s === id);
  document.body.classList.toggle('playing', s !== 'menu');
  tuneSong();
}
function opening() { const e = doorXY(ME); cam.x = e.x; cam.y = e.y; cam.z = 24; clampCam(); camGoal = { x: e.x + 4, y: e.y, z: startZoom(), rate: 0.8 }; }
function startRun() {
  rec.start({ ...set.snapshot(), mode: 'war', mission: 'crossing', look: `war:${set.get('view')}/${set.get('light')}/${set.get('style')}`, seed, v: 1 });
  running = true; opening();
}
function play() { snd.unlock(); startSong(); if (!running) startRun(); setScreen('play'); lastT = 0; snd.release(); }
function dropTouches() { run(Gs.reset('pause')); strokeW = []; nestDrag = null; }
function pauseGame() { if (screen !== 'play') return; dropTouches(); redraw(); setScreen('paused'); snd.hold(); }
function resume() { if (renderer?.lost) return; setScreen('play'); lastT = 0; snd.release(); startSong(); }
function restart(newSeed = true) {
  dropTouches();
  if (running) rec.end('restart', summary());
  if (newSeed && !(qSeed > 0)) seed = 1 + Math.floor(Math.random() * 9999);
  host = newHost(); sim = host.sim; sel = -1; floats = []; pulses = []; beacon = null; parts.length = 0; trailSig = '?'; told.clear(); firstTrail = false; danger = 0; setSpeed(1);
  if (tool !== 'trail') setTool('trail'); if (nestOpen) setNest(false);
  uploadTerrain(); uploadAnts(); startRun(); resume();
}
$('play').addEventListener('click', play);
$('pause').addEventListener('click', pauseGame);
$('resume').addEventListener('click', resume);
$('restart').addEventListener('click', () => restart());
$('again').addEventListener('click', () => restart());
$('harder').addEventListener('click', () => { const v = set.get('rival'); set.set('rival', won ? (v === 'timid' ? 'steady' : 'bold') : v === 'bold' ? 'steady' : 'timid'); restart(); });
onLeave(pauseGame);
addEventListener('keydown', e => { if (isPauseKey(e)) { if (screen === 'play') pauseGame(); else if (screen === 'paused') resume(); e.preventDefault(); } });
for (const c of document.querySelectorAll('.chip[data-say]')) c.addEventListener('click', () => toast(c.dataset.say, 2800));

// ---- tools and orders ----
function setTool(next) {
  if (next === tool) return;
  run(Gs.reset('tool')); tool = next;
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  if (tool === 'raid') toast(g(ME, CG.MAJORS) ? 'Tap where the soldiers should go. Tap the rival door to break in.' : 'You have no soldiers yet. Open Nest and raise some.', 2600);
  else if (tool === 'rally') toast('Hold a finger down: guards and resting ants gather there', 3000);
  else if (tool === 'camera') toast('Drag to move the view. Pinch to zoom.');
  tone(520, 0.05, 0.03, 'triangle');
}
function setNest(on) { nestOpen = on; document.body.classList.toggle('nest', on); $('nestBtn').setAttribute('aria-pressed', String(on)); $('diet').classList.toggle('on', on); if (on) $('route').classList.remove('on'); if (running) rec.event('nest', { on: on ? 1 : 0, at: sim.tick }); requestAnimationFrame(resize); }
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
$('nestBtn').addEventListener('click', () => setNest(!nestOpen));
function order(o) { const id = host.order({ ...o, team: ME }); if (running) rec.event('order', { at: sim.tick, t: o.type, k: o.kind ?? null, l: o.level ?? o.share ?? o.on ?? null, n: o.points ? o.points.length / 2 : null }); return id; }
$('recall').addEventListener('click', () => { const on = !g(ME, CG.RECALL); order({ type: CMD.RECALL, on: on ? 1 : 0 }); toast(on ? 'Everyone comes home' : 'Out again'); tone(on ? 330 : 520, 0.2, 0.05, 'triangle', on ? -120 : 160); });
const SPEEDS = [1, 2, 4];
function setSpeed(x) { speed = x; $('speedText').textContent = `${x}×`; $('speed').setAttribute('aria-pressed', String(x > 1)); }
$('speed').addEventListener('click', () => { setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]); rec.event('speed', { at: sim.tick, x: speed }); tone(500 + 150 * speed, 0.06, 0.03, 'triangle'); });
for (const b of document.querySelectorAll('#diets [data-diet]')) b.addEventListener('click', () => { order({ type: CMD.DIET, share: Number(b.dataset.diet) }); tone(560 + 60 * Number(b.dataset.diet), 0.08, 0.04, 'triangle'); setTimeout(hud, 80); });
let sel = -1, routeUntil = 0, firstTrail = false;
const showRoute = (ms = 6000) => { routeUntil = performance.now() + ms; };
for (const b of document.querySelectorAll('#levels [data-level]')) b.addEventListener('click', () => { if (sel < 0) return; order({ type: CMD.CREW, trail: sel, level: Number(b.dataset.level) }); tone(500 + 90 * Number(b.dataset.level), 0.08, 0.04, 'triangle'); showRoute(); setTimeout(hud, 80); });
$('erase').addEventListener('click', () => { if (sel < 0) return; order({ type: CMD.ERASE, trail: sel }); sel = -1; routeUntil = 0; tone(260, 0.12, 0.05, 'triangle', -80); setTimeout(hud, 80); });

let preview = null, strokeW = [], pending = [], rallyAt = null;
function strokeTake(pts) { if (pts.length < strokeW.length) strokeW = []; for (let i = strokeW.length; i < pts.length; i++) { const w = toWorld(pts[i][0], pts[i][1]); strokeW.push([w.x, w.y]); } }
function trailPoints() {
  const pts = [];
  for (const [wx, wy] of strokeW) { const x = Math.floor(wx), y = Math.floor(wy), l = pts[pts.length - 1]; if (!l || l[0] !== x || l[1] !== y) pts.push([x, y]); }
  if (pts.length < 2) return null;
  return (pts.length <= 64 ? pts : Array.from({ length: 64 }, (_, k) => pts[Math.round(k * (pts.length - 1) / 63)])).flat();
}
const trailMid = new Map();
function pickTrailAt(sx, sy) {
  let best = -1, bd = 30 * 30;
  for (const [k, m] of trailMid) { if (k >= TRAILS) continue; const p = toScreen(m.x, m.y, 1.6), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < bd) { bd = d; best = k; } }
  if (best < 0) {
    // A tap is a short order: Raid sends the soldiers to that spot, Forage sends workers to a food pile under the finger.
    routeUntil = 0;
    const w = toWorld(sx, sy), x = Math.floor(w.x), y = Math.floor(w.y);
    const fd = doorXY(FOE), nearDoor = Math.abs(w.x - fd.x) <= 6 && Math.abs(w.y - fd.y) <= 6 || (() => { const b = toScreen(fd.x, fd.y, 3.2); return Math.abs(b.x - sx) < 34 && Math.abs(b.y - sy) < 20; })();
    if (tool === 'raid' && nearDoor) { const p2 = [Math.floor(fd.x), Math.floor(fd.y)]; pending.push({ id: order({ type: CMD.TRAIL, kind: KIND.RAID, level: 2, points: p2 }), points: p2, kind: KIND.RAID }); }
    else if (tool === 'raid') pending.push({ id: order({ type: CMD.TRAIL, kind: KIND.RAID, level: 2, points: [x, y] }), points: [x, y], kind: KIND.RAID });
    else if (tool === 'trail') for (let p = 0; p < MAX_PILES; p++) { if (sim.pileAmount[p] <= 0) continue; const c = sim.pileCell[p], px = c % L0.sw, py = Math.floor(c / L0.sw); if (Math.abs(px - x) <= 2 && Math.abs(py - y) <= 2) { pending.push({ id: order({ type: CMD.TRAIL, kind: KIND.FORAGE, level: 2, points: [px, py] }), points: [px, py], kind: KIND.FORAGE }); break; } }
    return;
  }
  sel = best; showRoute(); hud(); tone(600, 0.05, 0.03, 'triangle');
}
function act(a) {
  switch (a.type) {
    case 'preview': preview = a; strokeTake(a.points); break;
    case 'clear': preview = null; break;
    case 'pan': { const o = toWorld(W / 2, H / 2), w = toWorld(W / 2 + a.dx, H / 2 + a.dy); cam.x -= w.x - o.x; cam.y -= w.y - o.y; camGoal = null; clampCam(); break; }
    case 'zoom': { const b = toWorld(a.x, a.y); cam.z *= a.f; clampCam(); const c = toWorld(a.x, a.y); cam.x += b.x - c.x; cam.y += b.y - c.y; camGoal = null; clampCam(); break; }
    case 'order': {
      strokeTake(a.points);
      const points = trailPoints(); strokeW = []; if (!points) break;
      const kind = tool === 'raid' ? KIND.RAID : KIND.FORAGE;
      pending.push({ id: order({ type: CMD.TRAIL, kind, level: 2, points }), points, kind });
      tone(520, 0.05, 0.03, 'triangle');
      break;
    }
    case 'alarm': {
      if (a.phase === 'start') {
        const w = toWorld(a.x, a.y); rallyAt = { x: Math.floor(w.x) + 0.5, y: Math.floor(w.y) + 0.5, at: performance.now() };
        order({ type: CMD.RALLY, x: Math.floor(w.x), y: Math.floor(w.y), hold: 600 });
        tone(880, 0.25, 0.05, 'sawtooth', -300); shake = 0.2; navigator.vibrate?.(12); toast('They gather there for half a minute');
      }
      break;
    }
    case 'tap': pickTrailAt(a.x, a.y); break;
  }
}
function run(actions) { for (const a of actions) act(a); }
const P = e => ({ id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), kind: e.pointerType, button: e.button, primary: e.isPrimary });
const gestureTool = () => (tool === 'raid' ? 'trail' : tool === 'rally' ? 'alarm' : tool);
ui.addEventListener('pointerdown', e => { if (screen !== 'play') return; if (!Gs.state.stroke) strokeW = []; try { ui.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ } run(Gs.down(P(e), gestureTool())); });
ui.addEventListener('pointermove', e => { if (screen === 'play') run(Gs.move(P(e))); });
ui.addEventListener('pointerup', e => { if (screen === 'play') run(Gs.move(P(e))); run(Gs.up(P(e))); });
ui.addEventListener('pointercancel', e => run(Gs.cancel(e.pointerId, 'pointercancel')));
ui.addEventListener('lostpointercapture', e => run(Gs.cancel(e.pointerId, 'lostpointercapture')));
ui.addEventListener('contextmenu', e => e.preventDefault());
ui.addEventListener('wheel', e => { if (screen !== 'play') return; e.preventDefault(); act({ type: 'zoom', f: Math.exp(-e.deltaY * 0.0015), x: e.clientX, y: e.clientY }); }, { passive: false });
$('mini').addEventListener('pointerdown', e => { const r = $('mini').getBoundingClientRect(); camGoal = null; cam.x = (e.clientX - r.left) / r.width * L0.sw; cam.y = (e.clientY - r.top) / r.height * L0.sh; clampCam(); e.stopPropagation(); });
// The nest: with Look, a drag moves the view; with a room tool, a drag paints cells and lifting the finger sends the orders.
let nestDrag = null, nestTool = 'look', paint = null;
const ROOM_OF = { store: ROOM.STORE, nursery: ROOM.NURSERY, rest: ROOM.REST };
const ROOM_CSS = ['', '255, 196, 90', '240, 232, 214', '140, 214, 150'];
const nestCell = e => { const r = nestCanvas.getBoundingClientRect(); return [Math.floor((e.clientX - r.left - NW / 2) / nestCam.z + nestCam.x), Math.floor((e.clientY - r.top - 26) / nestCam.z + nestCam.y)]; };
const mine = x => Math.abs(x - doorXY(ME).x) <= Math.abs(x - doorXY(FOE).x);
function paintAt(e) {
  const [x, y] = nestCell(e), k = y * L0.nw + x;
  if (x < 1 || x >= L0.nw - 1 || y < 2 || y >= L0.nh - 1 || !mine(x) || paint.seen.has(k)) return;
  // A stroke two cells wide when it runs through clay, so a room is a couple of drags, not a dozen.
  paint.seen.add(k); paint.cells.push(x, y);
}
function setNestTool(t) { nestTool = t; for (const b of document.querySelectorAll('#rooms [data-room]')) b.setAttribute('aria-pressed', String(b.dataset.room === t)); if (t !== 'look') toast(t === 'clear' ? 'Drag over marks or rooms to clear them' : 'Drag in the earth: workers dig it out', 2400); }
for (const b of document.querySelectorAll('#rooms [data-room]')) b.addEventListener('click', () => { setNestTool(b.dataset.room); tone(500, 0.06, 0.03, 'triangle'); });
nestCanvas.addEventListener('pointerdown', e => {
  try { nestCanvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  nestDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  if (nestTool !== 'look' && running) { paint = { cells: [], seen: new Set() }; paintAt(e); }
});
nestCanvas.addEventListener('pointermove', e => {
  if (!nestDrag || e.pointerId !== nestDrag.id) return;
  if (paint) { const n = Math.max(1, Math.ceil(Math.hypot(e.clientX - nestDrag.x, e.clientY - nestDrag.y) / (nestCam.z * 0.5))); for (let j = 1; j <= n; j++) paintAt({ clientX: nestDrag.x + (e.clientX - nestDrag.x) * j / n, clientY: nestDrag.y + (e.clientY - nestDrag.y) * j / n }); }
  else { nestCam.x = Math.max(8, Math.min(L0.nw - 8, nestCam.x - (e.clientX - nestDrag.x) / nestCam.z)); nestCam.y = Math.max(0, Math.min(L0.nh - 10, nestCam.y - (e.clientY - nestDrag.y) / nestCam.z)); }
  nestDrag.x = e.clientX; nestDrag.y = e.clientY;
});
nestCanvas.addEventListener('pointerup', () => {
  if (paint && paint.cells.length) {
    const cells = paint.cells;
    if (nestTool === 'clear') { order({ type: CMD.DIG, cells, on: 0 }); order({ type: CMD.ROOM, cells, kind: ROOM.NONE }); }
    else { order({ type: CMD.DIG, cells }); order({ type: CMD.ROOM, cells, kind: ROOM_OF[nestTool] }); }
    rec.event('build', { tool: nestTool, cells: cells.length / 2, at: sim.tick }); tone(380, 0.1, 0.04, 'triangle', 90); navigator.vibrate?.(8);
  }
  paint = null; nestDrag = null;
});
for (const n of ['pointercancel', 'lostpointercapture']) nestCanvas.addEventListener(n, () => { nestDrag = null; paint = null; });
const once = (key, text, ms, bad) => { if (told.has(key)) return; told.add(key); toast(text, ms, bad); };
let won = false;
const summary = () => ({ tick: sim.tick, adults: g(ME, CG.ADULTS), majors: g(ME, CG.MAJORS), foe: g(FOE, CG.ADULTS), born: g(ME, CG.BORN), died: g(ME, CG.DIED), kills: g(ME, CG.KILLS), loads: g(ME, CG.LOADS_S) + g(ME, CG.LOADS_P), stolen: g(ME, CG.STOLEN), lost: g(ME, CG.LOST), queen: g(ME, CG.QUEEN_HP), foeQueen: g(FOE, CG.QUEEN_HP), orders: host.log.filter(o => o.team === ME).length });
function news() {
  const ev = host.drain(), now = performance.now(), sw = L0.sw;
  let deaths = 0;
  for (let k = 0; k < ev.length; k += 4) {
    const type = ev[k], a = ev[k + 1], b = ev[k + 2], c = ev[k + 3];
    if (type === EVENT.HOME && a === ME) {
      const e = doorXY(ME), f = floats.find(f => f.kind === b && now - f.at < 500);
      burst(e.x, e.y, KIND_COL[b], 4, { size: 0.3 });
      if (f) { f.n++; f.at = now; } else floats.push({ x: e.x + (b ? 1.6 : -1.6), y: e.y, at: now, t0: now, n: 1, kind: b, col: b ? '#ff9d7a' : '#ffe08a' });
      if (!(set.get('sound') === 'all' && song?.ember?.())) tone(1500 + Math.random() * 500, 0.04, 0.02, 'sine', 300);
    } else if (type === EVENT.BORN && a === ME) {
      const e = doorXY(ME); burst(e.x, e.y, b ? [1, 0.5, 0.35] : [1, 0.95, 0.7], b ? 14 : 6, { vh: 5, life: 1.1 });
      if (b) { once('major', 'A soldier is born. She guards the door until you draw a raid.', 3600); tone(440, 0.2, 0.05, 'sawtooth', 200); }
    } else if (type === EVENT.DIED) {
      if (b < L0.nestBase) { const x = b % sw + 0.5, y = Math.floor(b / sw) + 0.5; burst(x, y, a === ME ? [1, 0.45, 0.2] : [0.45, 0.6, 1], c ? 9 : 5, { vh: 3, size: 0.3 }); }
      if (a === ME) deaths++;
    } else if (type === EVENT.PILE_EMPTY) { /* its trail goes dry: see DRY */ }
    else if (type === EVENT.DRY && a === ME) { toast('That food is gone. The trail waits for more.'); tone(300, 0.2, 0.04, 'triangle', -90); }
    else if (type === EVENT.DUG && a === ME) { if (nestOpen) tone(210 + Math.random() * 60, 0.05, 0.03, 'square', -60); }
    else if (type === EVENT.FULL && a === ME) { if (now - (told.fullAt ?? 0) > 20000) { told.fullAt = now; toast(`No room for more ${b ? 'meat' : 'seeds'}. Dig a store in the Nest.`, 3600, true); } }
    else if (type === EVENT.REJECTED && a === ME) {
      const q = pending.find(q => q.id === b); if (q) { pulses.push({ pts: q.points, at: now, bad: true }); q.done = true; }
      tone(150, 0.22, 0.07, 'sawtooth', -40); toast(c === 1 ? 'Six trails is the most. Erase one first.' : 'No ant can walk that.', 2600, true);
    } else if (type === EVENT.TRAIL) {
      if (a === ME) {
        const q = pending.find(q => !q.done); if (q) { q.done = true; pulses.push({ pts: q.points, at: now, bad: false }); }
        sel = b; showRoute(7000); tone(620, 0.14, 0.06, 'triangle', -180); setTimeout(() => tone(930, 0.18, 0.05, 'triangle', 120), 110); navigator.vibrate?.(30);
        if (!firstTrail) { firstTrail = true; clearTimeout(toastTimer); $('toast').classList.remove('on'); }
      } else if (c === KIND.RAID) { toast('The rival is marching on your hill', 4200, true); tone(196, 0.5, 0.07, 'sawtooth', -30); setTimeout(() => tone(185, 0.6, 0.07, 'sawtooth', -30), 380); beacon = { ...doorXY(ME), at: now }; navigator.vibrate?.([20, 60, 20]); }
    } else if (type === EVENT.QUEEN_HIT) {
      if (a === ME) { shake = 0.3; danger = 1; if (!told.has('qhit') || now - (told.qAt ?? 0) > 6000) { told.add('qhit'); told.qAt = now; toast('Your queen is being bitten!', 3200, true); tone(120, 0.4, 0.08, 'sawtooth'); } }
      else once('fqhit', 'Your soldiers have reached the rival queen', 3200);
    } else if (type === EVENT.STOLEN) { if (a === ME) once('robbed', 'Raiders are carrying off your stores', 3200, true); else once('stole', 'Your raiders are bringing home their stores', 3200); }
    else if (type === EVENT.RESULT) finish(a === ME, b);
  }
  if (deaths >= 3) { shake = Math.max(shake, 0.12); tone(170, 0.12, 0.04, 'square', -40); }
  pending = pending.filter(q => !q.done);
  danger = Math.max(0, danger - 0.01);
}
function finish(w, reason) {
  won = w;
  const s = summary(), T = (t, k) => g(t, k);
  rec.end(w ? 'won' : 'lost', { ...s, reason });
  $('overKicker').textContent = reason === REASON.QUEEN ? (w ? 'The rival queen is dead' : 'Your queen is dead') : 'Dusk';
  $('overTitle').textContent = w ? 'The crossing is yours' : 'The hill is lost'; $('overTitle').classList.toggle('lost', !w);
  $('overWhy').textContent = reason === REASON.QUEEN ? (w ? 'Her colony scatters. Both fords are yours now.' : 'Without her the colony has no tomorrow.') : w ? `At dusk you stood ${s.adults} to ${s.foe}.` : `At dusk the rival stood ${s.foe} to your ${s.adults}.`;
  const rows = [['', 'You', 'Rival'], ['Ants at the end', T(ME, CG.ADULTS), T(FOE, CG.ADULTS)], ['Soldiers', T(ME, CG.MAJORS), T(FOE, CG.MAJORS)], ['Born', T(ME, CG.BORN), T(FOE, CG.BORN)], ['Fallen', T(ME, CG.DIED), T(FOE, CG.DIED)], ['Loads carried home', T(ME, CG.LOADS_S) + T(ME, CG.LOADS_P), T(FOE, CG.LOADS_S) + T(FOE, CG.LOADS_P)], ['Loads stolen', T(ME, CG.STOLEN), T(FOE, CG.STOLEN)]];
  $('tally').textContent = '';
  rows.forEach((r, i) => r.forEach((v, j) => { const el = document.createElement(j ? 'b' : 'span'); el.textContent = v; if (!i) el.className = 'h'; if (j === 2) el.classList.add('foe'); $('tally').append(el); }));
  const v = set.get('rival');
  $('harder').textContent = w ? (v === 'bold' ? 'Play the bold rival again' : `Play a ${v === 'timid' ? 'steady' : 'bold'} rival`) : v === 'timid' ? 'Play the timid rival again' : `Play a ${v === 'bold' ? 'steady' : 'timid'} rival`;
  running = false; dropTouches(); if (nestOpen) setNest(false);
  const mine = host;
  setTimeout(() => { if (host !== mine) return; setScreen('over'); (w ? [523, 659, 784, 1047] : [392, 330, 262, 196]).forEach((f, i) => setTimeout(() => tone(f, 0.5, 0.06, 'triangle'), i * 160)); }, 900);
}
function bump(id, value) { const el = $(id), span = el.querySelector('span'), text = String(value); if (span.textContent === text) return; const up = Number(text) > Number(span.textContent); span.textContent = text; if (up) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
function hud() {
  let brood = 0; for (let k = 0; k < sim.bn; k++) if (sim.bTeam[k] === ME) brood++;
  bump('chipAnts', g(ME, CG.ADULTS) - g(ME, CG.MAJORS)); bump('chipMajors', g(ME, CG.MAJORS)); bump('chipSugar', g(ME, CG.SUGAR)); bump('chipProtein', g(ME, CG.PROTEIN)); bump('chipBrood', brood);
  const us = g(ME, CG.ADULTS), them = g(FOE, CG.ADULTS);
  $('vsUs').textContent = `You ${us}`; $('vsThem').textContent = `${them} Rival`; $('bar2').firstElementChild.style.width = `${(100 * us / Math.max(1, us + them)).toFixed(1)}%`;
  const left = Math.max(0, sim.cfg.duskTick - sim.tick) / 20; $('dusk').textContent = `Dusk in ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  if (g(ME, CG.SUGAR) === 0 && sim.tick > 600) once('hungry', 'No seeds in store. The colony starves without them.', 3600, true);
  trailMesh();
  const s = sel >= 0 && sim.trLive[ME * TRAILS + sel] ? ME * TRAILS + sel : -1;
  if (s < 0) sel = -1;
  $('route').classList.toggle('on', s >= 0 && screen === 'play' && !nestOpen && performance.now() < routeUntil);
  if (s >= 0) {
    const raid = sim.trKind[s] === KIND.RAID, lv = sim.trLevel[s];
    $('routeDot').style.background = raid ? '#ff5a3c' : TRAIL_CSS[sel]; $('routeName').textContent = raid ? 'Raid' : 'Forage';
    $('routeInfo').textContent = sim.trDry[s] ? 'nothing left at its end' : `${sim.crew[s]} of ${sim.want[s]} ${raid ? 'soldiers' : 'workers'}`;
    const sh = raid ? RAID_SHARE : LEVEL_SHARE, words = raid ? ['1 in 4', 'half', 'all, and workers'] : ['1 in 10', '1 in 4', 'half'];
    for (const b of document.querySelectorAll('#levels [data-level]')) { const l = Number(b.dataset.level); b.setAttribute('aria-pressed', String(l === lv)); b.querySelector('small').textContent = words[l - 1]; void sh; }
  }
  const diet = g(ME, CG.DIET);
  for (const b of document.querySelectorAll('#diets [data-diet]')) b.setAttribute('aria-pressed', String(Number(b.dataset.diet) === diet));
  $('dietInfo').textContent = g(ME, CG.PROTEIN) === 0 ? 'no meat: bring red food' : `${g(ME, CG.PROTEIN)} meat in store · a soldier eats 3`;
  const capA = g(ME, CG.CAP_ADULTS), capB = g(ME, CG.CAP_BROOD), capF = g(ME, CG.CAP_FOOD), pop = g(ME, CG.ADULTS) + brood;
  const cap = (id, n, of) => { const el = $(id); el.textContent = `${n}/${of}`; el.parentElement.classList.toggle('tight', n >= of); };
  cap('capFood', Math.max(g(ME, CG.SUGAR), g(ME, CG.PROTEIN)), capF); cap('capBrood', brood, capB); cap('capAnts', pop, capA);
  if (pop >= capA && sim.tick > 200 && performance.now() - (told.popAt ?? 0) > 45000) { told.popAt = performance.now(); toast('The hill is full: the queen stops laying. Dig quarters in the Nest.', 4200, true); }
  $('recall').setAttribute('aria-pressed', String(!!g(ME, CG.RECALL)));
  drawMini(); tuneSong();
}

// ---- trails as ribbons: yours in six colours, raids red, the rival's a cold blue ----
const TRAIL_COL = [[1, 0.70, 0.22], [0.30, 0.82, 1], [1, 0.42, 0.72], [0.62, 0.95, 0.32], [0.80, 0.62, 1], [1, 0.92, 0.45]];
const TRAIL_CSS = ['#ffb338', '#4dd1ff', '#ff6bb8', '#9ef252', '#cc9eff', '#ffeb73'];
let trailSig = '', trailBuf = new Float32Array(0);
function trailMesh() {
  let sig = '';
  for (let s = 0; s < 2 * TRAILS; s++) if (sim.trLive[s]) sig += `${s}:${sim.trSeq[s]}:${sim.trLevel[s]}:${sim.trKind[s]}:${sim.trDry[s]};`;
  if (sig === trailSig) return; trailSig = sig; trailMid.clear();
  const out = [];
  for (let s = 0; s < 2 * TRAILS; s++) {
    if (!sim.trLive[s]) continue;
    const mine = s < TRAILS, raid = sim.trKind[s] === KIND.RAID, len = sim.trLen[s], HW = mine ? 0.42 : 0.3;
    let col = mine ? (raid ? [1, 0.25, 0.15] : TRAIL_COL[s % TRAILS]) : raid ? [0.75, 0.3, 1] : [0.35, 0.5, 0.95];
    if (sim.trDry[s] || !mine) col = col.map(v => v * (sim.trDry[s] ? 0.3 : 0.6));
    const speed = sim.trDry[s] ? 0 : 1.6 + 0.9 * sim.trLevel[s];
    let pts = []; const stepN = Math.max(2, Math.ceil(len / 300));
    for (let j = 0; j < len; j += stepN) { const c = sim.trPath[s * PATH_MAX + j]; pts.push([c % L0.sw + 0.5, Math.floor(c / L0.sw) + 0.5]); }
    const last = sim.trPath[s * PATH_MAX + len - 1]; pts.push([last % L0.sw + 0.5, Math.floor(last / L0.sw) + 0.5]);
    for (let pass = 0; pass < 2 && pts.length > 2; pass++) { const r = [pts[0]]; for (let j = 0; j < pts.length - 1; j++) { const a = pts[j], b = pts[j + 1]; r.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } r.push(pts[pts.length - 1]); pts = r; }
    const mid = pts[pts.length >> 1]; trailMid.set(s, { x: mid[0], y: mid[1] });
    let d = 0, pl = null, pr = null, ps = 0;
    for (let j = 0; j < pts.length; j++) {
      const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx = nx / nl * HW; ny = ny / nl * HW;
      if (j) d += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
      const l = [pts[j][0] + nx, pts[j][1] + ny], r = [pts[j][0] - nx, pts[j][1] - ny];
      if (pl) for (const [q, u, ss] of [[pl, -1, ps], [pr, 1, ps], [l, -1, d], [pr, 1, ps], [r, 1, d], [l, -1, d]]) out.push(q[0], q[1], u, ss, col[0], col[1], col[2], speed);
      pl = l; pr = r; ps = d;
    }
  }
  if (out.length > trailBuf.length) trailBuf = new Float32Array(out.length * 2);
  trailBuf.set(out); renderer?.setTrails(trailBuf, out.length / 8);
}

// ---- the small map: both hills, the creek, food, and where the ants are ----
let miniBase = null;
function drawMini() {
  const w = L0.sw, h = L0.sh;
  if (!miniBase || miniBase.sim !== sim) { const img = mctx.createImageData(w, h); for (let i = 0; i < w * h; i++) { const m = sim.mat[i], o = i * 4, c = m === MAT.WATER ? [40, 74, 110] : m === MAT.STONE ? [96, 92, 90] : [52, 44, 40]; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; } miniBase = { sim, img }; }
  mctx.putImageData(miniBase.img, 0, 0);
  for (let p = 0; p < MAX_PILES; p++) if (sim.pileAmount[p] > 0) { const c = sim.pileCell[p], r = sim.pileAmount[p] > 40 ? 2.4 : 1.4; mctx.fillStyle = sim.pileKind[p] ? '#e0603c' : '#f3d77a'; mctx.beginPath(); mctx.arc(c % w + 0.5, Math.floor(c / w) + 0.5, r, 0, 7); mctx.fill(); }
  for (let i = 0; i < sim.n; i++) if (sim.layer[i] === 0) { mctx.fillStyle = sim.team[i] ? '#8fb0ff' : '#ffb057'; mctx.fillRect(sim.x[i] >> 8, sim.y[i] >> 8, 1.4, 1.4); }
  for (const t of [ME, FOE]) { const d = doorXY(t); mctx.strokeStyle = t ? '#8fb0ff' : '#ffb057'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(d.x, d.y, 3.5, 0, 7); mctx.stroke(); }
  if (eye) { const a = toWorld(0, 0), b = toWorld(W, H), c = toWorld(W, 0), d = toWorld(0, H); mctx.strokeStyle = 'rgba(255,255,255,0.8)'; mctx.lineWidth = 1; mctx.beginPath(); mctx.moveTo(a.x, a.y); mctx.lineTo(c.x, c.y); mctx.lineTo(b.x, b.y); mctx.lineTo(d.x, d.y); mctx.closePath(); mctx.stroke(); }
}

// ---- the overlay ----
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
    const shown = performance.now() < routeUntil ? sel : -1;
    for (const [s, m] of trailMid) {
      if (s >= TRAILS || !sim.trLive[s]) continue;
      const p = toScreen(m.x, m.y, 1.6), q = toScreen(m.x, m.y, 0.05), raid = sim.trKind[s] === KIND.RAID, css = raid ? '#ff5a3c' : TRAIL_CSS[s];
      if (p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
      ctx.strokeStyle = css; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      const label = sim.trDry[s] ? 'dry' : sim.crew[s] >= sim.want[s] ? String(sim.crew[s]) : `${sim.crew[s]}/${sim.want[s]}`, w = 30 + label.length * 7.5;
      ctx.fillStyle = s === shown ? css : 'rgba(26, 18, 14, 0.92)'; ctx.strokeStyle = s === shown ? '#fff8ea' : css; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - 12, w, 22, 11); ctx.fill(); ctx.stroke();
      ctx.fillStyle = s === shown ? '#1b0f08' : '#f3e6d6';
      const ax = p.x - w / 2 + 12; for (const [dx, r] of raid ? [[-3.6, 2.8], [0, 2.1], [3.6, 3.2]] : [[-3.6, 2.6], [0, 1.9], [3.2, 2.2]]) { ctx.beginPath(); ctx.arc(ax + dx, p.y - 1, r, 0, 7); ctx.fill(); }
      ctx.font = '700 12px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, ax + 9, p.y - 0.5);
    }
    // The two doors: a banner over each, and the queen's strength when she has been hurt.
    for (const t of [ME, FOE]) {
      const d = doorXY(t), p = toScreen(d.x, d.y, 3.2); if (!p.s) continue;
      const hp = g(t, CG.QUEEN_HP) / C.QUEEN_HP, col = t ? '#8fb0ff' : '#ffb057';
      ctx.fillStyle = 'rgba(20, 14, 10, 0.85)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(p.x - 26, p.y - 9, 52, 18, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.font = '800 10.5px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t ? 'RIVAL' : 'HOME', p.x, p.y);
      if (hp < 1) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - 24, p.y + 12, 48, 5); ctx.fillStyle = hp > 0.4 ? '#9ef252' : '#ff5a3c'; ctx.fillRect(p.x - 24, p.y + 12, 48 * hp, 5); }
    }
    if (rallyAt && now - rallyAt.at < 30000 && g(ME, CG.RALLY_HOLD) > 0) { const p = toScreen(rallyAt.x, rallyAt.y, 0), k = (now / 900) % 1; ctx.strokeStyle = `rgba(255, 90, 60, ${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * (1 + 2.5 * k), p.s * (1 + 2.5 * k) * Math.max(0.3, eye.cos), 0, 0, 7); ctx.stroke(); }
    // Food off screen near home: an arrow at the edge until the first trail is laid.
    if (!firstTrail) drawGhost(now);
  }
  for (const f of floats) {
    const k = (now - f.at) / 1100; if (k > 1) continue;
    const p = toScreen(f.x, f.y, 1.6 + Math.min(1, (now - f.t0) / 900) * 1.6), text = `+${f.n}`;
    ctx.globalAlpha = 1 - k * k; ctx.fillStyle = f.col; ctx.font = `800 ${15 + Math.min(8, f.n)}px ui-rounded, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(20, 10, 6, 0.85)'; ctx.lineWidth = 3.5; ctx.strokeText(text, p.x, p.y); ctx.fillText(text, p.x, p.y);
  }
  ctx.globalAlpha = 1; floats = floats.filter(f => now - f.at < 1100);
  if (preview?.points.length && strokeW.length) {
    const raid = tool === 'raid'; ctx.shadowColor = raid ? '#ff3c2a' : '#ff9a3c'; ctx.shadowBlur = 14; ctx.strokeStyle = raid ? '#ffb0a0' : '#ffd9a0'; ctx.lineWidth = 5;
    ctx.beginPath(); strokeW.forEach(([x, y], i) => { const p = toScreen(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke(); ctx.shadowBlur = 0;
  }
}
/** Until the first trail: a ghost finger draws from the door to the nearest food. */
let ghostT0 = 0;
function drawGhost(now) {
  if (tool !== 'trail' || nestOpen || preview || camGoal) { ghostT0 = 0; return; }
  const e = doorXY(ME); let best = -1, bd = Infinity;
  for (let p = 0; p < MAX_PILES; p++) { if (sim.pileAmount[p] <= 0) continue; const c = sim.pileCell[p], d = (c % L0.sw - e.x) ** 2 + (Math.floor(c / L0.sw) - e.y) ** 2; if (d < bd) { bd = d; best = c; } }
  if (best < 0) return;
  if (!ghostT0) ghostT0 = now + 600; if (now < ghostT0) return;
  const t = ((now - ghostT0) % 2600) / 2600, bx = best % L0.sw + 0.5, by = Math.floor(best / L0.sw) + 0.5, dx = bx - e.x, dy = by - e.y, Ln = Math.hypot(dx, dy) || 1, cx = (e.x + bx) / 2 - dy / Ln * Ln * 0.22, cy = (e.y + by) / 2 + dx / Ln * Ln * 0.22;
  const at = u => toScreen((1 - u) * (1 - u) * e.x + 2 * u * (1 - u) * cx + u * u * bx, (1 - u) * (1 - u) * e.y + 2 * u * (1 - u) * cy + u * u * by);
  const k = Math.min(1, t / 0.62), u = k * k * (3 - 2 * k), fade = t < 0.08 ? t / 0.08 : t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.2) : 1;
  ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = '#ffe2b0'; ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 12; ctx.lineWidth = 5; ctx.setLineDash([2, 10]);
  ctx.beginPath(); for (let j = 0; j <= 24; j++) { const p = at(u * j / 24); j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
  const f = at(u); ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, 19, 0, 7); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
}

// ---- the nest, cut away: both colonies' rooms lie in one layer of earth ----
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function drawNest(now) {
  const c = nctx, w = L0.nw, h = L0.nh, base = L0.nestBase, z = nestCam.z;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, NW, NH);
  const sx = x => (x - nestCam.x) * z + NW / 2, sy = y => (y - nestCam.y) * z + 26;
  const x0 = Math.max(0, Math.floor(nestCam.x - NW / 2 / z) - 1), x1 = Math.min(w - 1, Math.ceil(nestCam.x + NW / 2 / z) + 1), y0 = Math.max(0, Math.floor(nestCam.y) - 1), y1 = Math.min(h - 1, Math.ceil(nestCam.y + (NH - 26) / z) + 1);
  const soil = c.createLinearGradient(0, 26, 0, NH); soil.addColorStop(0, '#6b4a30'); soil.addColorStop(0.5, '#70402a'); soil.addColorStop(1, '#3a2218');
  c.fillStyle = soil; c.fillRect(0, 26, NW, NH);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const r = hash(x + 91, y + 17); if (r > 0.82) { c.fillStyle = 'rgba(20, 14, 10, 0.3)'; c.beginPath(); c.ellipse(sx(x + r), sy(y + hash(x, y + 5)), z * 0.2, z * 0.13, r * 6, 0, 7); c.fill(); } else if (r < 0.12) { c.fillStyle = 'rgba(255, 226, 190, 0.09)'; c.beginPath(); c.ellipse(sx(x + r * 5), sy(y + hash(x + 3, y)), z * 0.12, z * 0.08, r * 40, 0, 7); c.fill(); } }
  const open = (x, y) => sim.mat[base + y * w + x] === MAT.OPEN;
  for (const [r, col] of [[0.78, '#120c09'], [0.62, '#2a1c14']]) { c.fillStyle = col; c.beginPath(); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (open(x, y)) { const px = sx(x + 0.5), py = sy(y + 0.5); c.moveTo(px + z * r, py); c.arc(px, py, z * r, 0, 7); } c.fill(); }
  // Rooms by tint, cells waiting to be dug as hatched squares, the stroke under the finger brighter.
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * w + x, r = sim.room[k], m = sim.mark[k];
    if (!r && !m) continue;
    const px = sx(x), py = sy(y);
    if (r && open(x, y)) { c.fillStyle = `rgba(${ROOM_CSS[r]}, 0.16)`; c.fillRect(px + 0.5, py + 0.5, z - 1, z - 1); }
    if (m) { c.fillStyle = `rgba(${ROOM_CSS[r] || '255, 255, 255'}, ${0.2 + 0.08 * Math.sin(now / 260 + x + y)})`; c.fillRect(px + 1, py + 1, z - 2, z - 2); c.strokeStyle = `rgba(${ROOM_CSS[r] || '255, 255, 255'}, 0.8)`; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 2, py + z - 2); c.lineTo(px + z - 2, py + 2); c.stroke(); const left = sim.digLeft[k] / C.DIG_TICKS; if (left < 1) { c.fillStyle = '#120c09'; c.fillRect(px + 1, py + 1, (z - 2) * (1 - left), z - 2); } }
  }
  if (paint) { c.fillStyle = nestTool === 'clear' ? 'rgba(255, 90, 60, 0.4)' : `rgba(${ROOM_CSS[ROOM_OF[nestTool]]}, 0.45)`; for (let j = 0; j < paint.cells.length; j += 2) c.fillRect(sx(paint.cells[j]) + 1, sy(paint.cells[j + 1]) + 1, z - 2, z - 2); }
  for (const t of [ME, FOE]) {
    const st = sim.store[t] - base, stx = st % w, sty = Math.floor(st / w), q = sim.queen[t] - base, qx = sx(q % w + 0.5), qy = sy(Math.floor(q / w) + 0.5), tint = t ? '120, 150, 255' : '255, 170, 80';
    const gl = c.createRadialGradient(qx, qy, 0, qx, qy, z * 7); gl.addColorStop(0, `rgba(${tint}, ${0.28 + 0.05 * Math.sin(now / 700)})`); gl.addColorStop(1, `rgba(${tint}, 0)`); c.fillStyle = gl; c.fillRect(qx - z * 7, qy - z * 7, z * 14, z * 14);
    for (const [amount, left, col] of [[g(t, CG.SUGAR), true, '#f3d77a'], [g(t, CG.PROTEIN), false, '#b0452f']]) { c.fillStyle = col; const n = Math.min(60, amount); for (let i = 0; i < n; i++) { const row = Math.floor(i / 6), off = (i % 6) * 0.36 + (row & 1) * 0.18; c.beginPath(); c.arc(sx(left ? stx - 1.9 + off : stx + 2.9 - off), sy(sty + 1.9 - row * 0.2), Math.max(1.2, z * 0.15), 0, 7); c.fill(); } }
    if (g(t, CG.QUEEN_HP) > 0) {
      const u = Math.max(8, z * 1.5), pulse = 1 + 0.06 * Math.sin(now / 300);
      c.fillStyle = t ? '#27345e' : '#6a2a16'; c.strokeStyle = t ? '#9fb8ff' : '#ffc070'; c.lineWidth = 1.5; c.shadowColor = t ? '#6a8cff' : '#ff9a3c'; c.shadowBlur = 14;
      for (const [dx, rx, ry] of [[-1.05, 0.9 * pulse, 0.55 * pulse], [0, 0.4, 0.3], [0.8, 0.32, 0.28]]) { c.beginPath(); c.ellipse(qx + dx * u, qy, rx * u, ry * u, 0, 0, 7); c.fill(); c.stroke(); }
      c.shadowBlur = 0;
      const hp = g(t, CG.QUEEN_HP) / C.QUEEN_HP; if (hp < 1) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(qx - 24, qy - u - 6, 48, 5); c.fillStyle = hp > 0.4 ? '#9ef252' : '#ff5a3c'; c.fillRect(qx - 24, qy - u - 6, 48 * hp, 5); }
    }
  }
  for (let k = 0; k < sim.bn; k++) {
    const cc = sim.bCell[k] - base, bx = sx((cc % w) + 0.2 + ((k * 0.618034) % 1) * 0.6), by = sy(Math.floor(cc / w) + 0.25 + ((k * 0.381966) % 1) * 0.5), s = sim.bStage[k];
    if (bx < -10 || bx > NW + 10) continue;
    c.beginPath();
    if (s === STAGE.EGG) { c.fillStyle = '#f4efe2'; c.ellipse(bx, by, Math.max(1.4, z * 0.15), Math.max(1.1, z * 0.11), 0.5, 0, 7); }
    else if (s === STAGE.LARVA) { const big = sim.bMajor[k] ? 1.35 : 1; c.fillStyle = sim.bFed[k] ? (sim.bFed[k] > 1 ? '#f0b48a' : '#f3e4b4') : '#cfc8ba'; const r = Math.max(1.3, z * 0.17) * big * (1 + 0.06 * Math.sin(now / 400 + k)); for (let j = 0; j < 4; j++) { const a = 0.9 + (k % 5) * 0.25 + j * 0.62, gx = bx + Math.cos(a) * r * 1.25, gy = by + Math.sin(a) * r * 1.25; c.moveTo(gx + r, gy); c.arc(gx, gy, r * (1 - j * 0.1), 0, 7); } }
    else { const big = sim.bFed[k] > 1 ? 1.4 : 1; c.fillStyle = sim.bFed[k] > 1 ? '#b8743e' : '#c59a62'; c.ellipse(bx, by, Math.max(2, z * 0.4) * big, Math.max(1.5, z * 0.25) * big, 0.6, 0, 7); }
    c.fill();
  }
  const a = host.alpha;
  for (let i = 0; i < sim.n; i++) {
    if (sim.layer[i] !== 1) continue;
    const p = prevOf[i], jump = p < 0 || host.pl[p] !== 1, ax = sx((jump ? sim.x[i] : host.px[p] + (sim.x[i] - host.px[p]) * a) / 256), ay = sy((jump ? sim.y[i] : host.py[p] + (sim.y[i] - host.py[p]) * a) / 256);
    if (ax < -8 || ax > NW + 8 || ay > NH + 8) continue;
    const th = sim.heading[i] * (Math.PI / 128), co = Math.cos(th), si = Math.sin(th), u = Math.max(2.2, z * 0.5) * (sim.caste[i] ? 1.5 : 1);
    c.fillStyle = sim.team[i] ? '#3a4f9a' : sim.caste[i] ? '#5a1410' : '#0d0705';
    c.beginPath(); c.ellipse(ax - co * u * 0.55, ay - si * u * 0.55, u * 0.5, u * 0.34, th, 0, 7); c.fill();
    c.beginPath(); c.arc(ax + co * u * 0.1, ay + si * u * 0.1, u * 0.24, 0, 7); c.fill();
    c.beginPath(); c.arc(ax + co * u * 0.55, ay + si * u * 0.55, u * (sim.caste[i] ? 0.36 : 0.27), 0, 7); c.fill();
    if (sim.carry[i]) { c.fillStyle = sim.carry[i] > 1 ? '#b0452f' : '#f3d77a'; c.beginPath(); c.arc(ax + co * u * 0.95, ay + si * u * 0.95, u * 0.26, 0, 7); c.fill(); }
  }
  const skyG = c.createLinearGradient(0, 0, 0, 26); skyG.addColorStop(0, light.night > 0.5 ? '#0b0d18' : '#6f7f8f'); skyG.addColorStop(1, light.night > 0.5 ? '#241a1c' : '#c9b59a');
  c.fillStyle = skyG; c.fillRect(0, 0, NW, 26); c.fillStyle = '#4a4340'; c.fillRect(0, 22, NW, 5);
  for (const t of [ME, FOE]) { const d = sx(doorXY(t).x); c.fillStyle = '#120c09'; c.fillRect(d - z * 0.8, 22, z * 1.6, 6); c.fillStyle = t ? '#8fb0ff' : '#ffb057'; c.font = '800 10px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(t ? 'RIVAL' : 'HOME', d, 14); }
}

// ---- the frame ----
let light = sky(0.2);
const lightNow = now => sky(set.get('light') === 'day' ? 0.2 : set.get('light') === 'ember' ? 0.85 : screen === 'menu' ? 0.5 + 0.07 * Math.sin(now / 9000) : 0.12 + 0.57 * Math.min(1, sim.tick / sim.cfg.duskTick));
let lastHud = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 0.016);
  run(Gs.tick(performance.now()));
  let stepped = 0;
  if (screen === 'play') stepped = host.advance(lastT ? Math.min(100, now - lastT) : 0, speed);
  if (stepped) { news(); uploadAnts(); }
  if (sim.result && running) finish(sim.result - 1 === ME, g(ME, CG.QUEEN_HP) <= 0 || g(FOE, CG.QUEEN_HP) <= 0 ? REASON.QUEEN : REASON.DUSK); // the result event was lost in a full buffer
  light = lightNow(now);
  const want = screen === 'menu' ? VIEW.low : VIEW[set.get('view')], e = Math.min(1, dt * 3.5); lens.pitch += (want.pitch - lens.pitch) * e; lens.fk += (want.fk - lens.fk) * e;
  if (screen === 'menu') { const en = doorXY(ME); cam.x = en.x + 6 + 5 * Math.sin(now / 7000); cam.y = en.y + 3; cam.z = startZoom(); }
  nestLift += ((nestOpen ? NH / 2 : 0) - nestLift) * Math.min(1, dt * 6);
  if (camGoal && screen === 'play') { const k = Math.min(1, dt * camGoal.rate); cam.x += (camGoal.x - cam.x) * k; cam.y += (camGoal.y - cam.y) * k; cam.z *= Math.exp(Math.log(camGoal.z / cam.z) * k); if (Math.abs(Math.log(camGoal.z / cam.z)) < 0.03 && Math.abs(camGoal.x - cam.x) < 0.05) camGoal = null; }
  clampCam();
  if (screen !== 'paused') { ambient(dt); stepParts(dt); }
  shake = Math.max(0, shake - dt);
  const view = shake ? pose({ x: cam.x + rnd(shake * 0.6), y: cam.y + rnd(shake * 0.6), z: cam.z }) : eye;
  const piles = [];
  for (let p = 0; p < MAX_PILES; p++) if (sim.pileAmount[p] > 0) { const c = sim.pileCell[p], x = c % L0.sw, y = Math.floor(c / L0.sw); piles.push({ x, y, amount: sim.pileAmount[p], kind: sim.pileKind[p] ? 1 : 0, d: (x - cam.x) ** 2 + (y - cam.y) ** 2 }); }
  piles.sort((a, b) => a.d - b.d);
  const b = beacon && now - beacon.at < 7000 ? { x: beacon.x, y: beacon.y, age: (now - beacon.at) / 1000 } : null;
  const rally = rallyAt && g(ME, CG.RALLY_HOLD) > 0 ? rallyAt : null;
  if (renderer && renderer.draw({ view, light, ink: set.get('style') === 'ink', alpha: screen === 'play' ? host.alpha : 1, running: screen === 'play', time: now / 1000, piles, entrances: [{ ...doorXY(ME), w: 3 }, { ...doorXY(FOE), w: 3 }], alarm: rally, beacon: b, big: Number(set.get('size')) })) frames++;
  drawOverlay(now);
  if (nestOpen) drawNest(now);
  if (now - lastHud > 250) { lastHud = now; if (screen !== 'menu') hud(); }
  if (lastT && screen === 'play') { slow.sum += now - lastT; if (++slow.n >= 120) { const mean = slow.sum / slow.n; slow = { sum: 0, n: 0 }; if (mean > 24 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); resize(); rec.event('dpr', { at: sim.tick, cap: dprCap, ms: Math.round(mean) }); } } }
  lastT = now;
}
requestAnimationFrame(frame);

// ---- hooks for checks ----
window.game = {
  state: () => ({ screen, tool, nest: nestOpen, t: sim.tick, ants: sim.n, drawn: drawnAnts, gl: !!renderer && !renderer.lost, glFailed, frames, result: sim.result, sel, set: set.snapshot(), ...summary() }),
  toScreen: (x, y, h) => toScreen(x, y, h), camera: () => ({ ...cam }), setCamera: c => { camGoal = null; Object.assign(cam, c); clampCam(); },
  door: t => doorXY(t), piles: () => { const o = []; for (let p = 0; p < MAX_PILES; p++) if (sim.pileAmount[p] > 0) o.push({ x: sim.pileCell[p] % L0.sw, y: Math.floor(sim.pileCell[p] / L0.sw), kind: sim.pileKind[p], amount: sim.pileAmount[p] }); return o; },
  setTool, setNest, setNestTool, nestXY: (x, y) => { const r = nestCanvas.getBoundingClientRect(); return [r.left + (x + 0.5 - nestCam.x) * nestCam.z + NW / 2, r.top + (y + 0.5 - nestCam.y) * nestCam.z + 26]; }, setSpeed, order, run: n => { host.run(n); news(); uploadAnts(); }, log: () => JSON.parse(JSON.stringify(host.log)), hash: () => sim.hash(),
};
void TASK;
