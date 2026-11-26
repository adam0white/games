// Cinderhill's trail painter (04-roadmap S3, 03-features "trail painter toy"): the deterministic sim at 20 ticks a
// second, drawn with WebGL2, and the touch rules of 02-spec section 6.4. No goals; draw trails and watch the ants.
import { Host, CMD, SURFACE, NEST, FIELD, COUNTS, TICK_MS, SEED, G as GI } from './host.js';
import { START, GOAL_KIND } from './sim/colony.js';
import { SPIDER } from './sim/spider.js';
import { cellXY } from './sim/grid.js';
import { makeGestures } from './gestures.js';
import { Renderer } from './render.js';
import { LOOKS, pickLook } from './looks.js';
import { WORDS } from './words.js';
import { line } from './sim/sim.js';
import { noZoom } from '../kit/zoom.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { sound } from '../kit/audio.js';
import { hint } from '../kit/hint.js';
import { lab } from '../kit/lab.js';
import { LabRecord } from './labrec.js';
import { findRooms, drawNest } from './nestview.js';
import { readJson, writeJson } from '../kit/save.js';

noZoom();
const { t, lang, setLang, apply } = WORDS;
const $ = id => document.getElementById(id);
const SAVE = 'cinderhill:save', HINT = 'cinderhill:hint';
const saved0 = readJson(SAVE);
const save = { v: 1, sound: true, ants: 2000, tapTrail: false, ...(saved0 && typeof saved0 === 'object' ? saved0 : {}) };
if (!COUNTS.includes(save.ants)) save.ants = 2000;
const persist = () => writeJson(SAVE, save);
const query = new URLSearchParams(location.search);
const qAnts = Number(query.get('ants'));

// ?colony=1: a colony game (queen, brood, sugar and protein; M1). Without it, the trail painter sandbox as in M0.
// The ant count buttons and the saved count do not apply to a colony game.
const colonyMode = query.get('colony') === '1';
let lookName = pickLook(query.get('look')), LOOK = LOOKS[lookName];
const paintTheme = () => { document.querySelector('meta[name=theme-color]')?.setAttribute('content', LOOK.theme); document.body.style.background = LOOK.theme; };
paintTheme();
// ?day=<ticks> shortens a colony game's day (tests and the phone check); the game's day is colony.js DAY_TICKS.
const qDay = Number(query.get('day'));
let host = colonyMode ? new Host(START.ants, SEED, { colony: true, dayTicks: qDay >= 100 && qDay <= 100000 ? Math.floor(qDay) : undefined }) : new Host(COUNTS.includes(qAnts) ? qAnts : save.ants);
if (colonyMode) for (const el of document.querySelectorAll('.counts')) el.hidden = true;
if (colonyMode) { $('modeLink').href = './'; $('modeLink').dataset.i18n = 'toPainter'; for (const [el, k] of [[document.querySelector('#menuCard .sub'), 'colonySub'], [document.querySelector('#menuCard [data-i18n="intro"]'), 'colonyIntro']]) if (el) el.dataset.i18n = k; }
let screen = 'menu', tool = 'trail', layer = SURFACE;
// The tactical hold: time stops but the game stays on screen and takes orders; they apply on the first tick
// after Go (an order is queued for the current tick, which has not run yet, so it is never late).
let held = false;
const G = makeGestures();
const snd = sound({ on: () => save.sound });
const rec = lab('cinderhill', { lang });
rec.notice($('menuCard')); rec.toggle($('pauseCard'));
// The full replay of each game and what only the page sees (labrec.js; spikes/replay-lab.mjs reads it back).
const labrec = new LabRecord(rec);
const startRecord = () => labrec.start(host, { mode: colonyMode ? 'colony' : 'sandbox', look: lookName, viewport: [innerWidth, innerHeight, Math.round(devicePixelRatio * 100) / 100] });
addEventListener('error', e => labrec.error(e.message ?? 'error'));
addEventListener('unhandledrejection', e => labrec.error(`rejection: ${e.reason?.message ?? e.reason}`));
document.addEventListener('visibilitychange', () => labrec.visible(document.visibilityState === 'visible')); // on document: before the kit's own flush on window
let running = false; // a lab run is open

// ---- canvases, camera ----
const glCanvas = $('gl'), ui = $('c'), ctx = ui.getContext('2d');
const DPR_CAP = 2;
let W = innerWidth, H = innerHeight, dpr = Math.min(DPR_CAP, devicePixelRatio || 1);
let renderer = null, glFailed = '';
try { renderer = Renderer.create(glCanvas, { lost: () => {}, restored: () => { uploadAll(); } }, LOOK.id); } catch (e) { glFailed = String(e.message || e).slice(0, 200); renderer = null; }
if (!renderer) $('nogl').classList.add('on');
const dims = l => (l === SURFACE ? { w: host.sim.L.sw, h: host.sim.L.sh, base: 0 } : { w: host.sim.L.nw, h: host.sim.L.nh, base: host.sim.L.nestBase });
const cams = [null, null];
function fitCams() {
  const L = host.sim.L, z0 = Math.max(3, Math.min(W, H) / 105);
  cams[SURFACE] = { x: L.sw / 2 + 0.5, y: L.sh / 2 + 0.5, z: z0 };
  cams[NEST] = { x: L.nw / 2, y: 30, z: Math.max(W / 70, 3) };
}
const zMin = () => { const d = dims(layer); return Math.min(W / d.w, H / d.h) * 0.8; };
function clampCam() {
  const c = cams[layer], d = dims(layer);
  c.z = Math.max(zMin(), Math.min(48, c.z));
  c.x = Math.max(0, Math.min(d.w, c.x)); c.y = Math.max(0, Math.min(d.h, c.y));
}
const toWorld = (sx, sy) => { const c = cams[layer]; return { x: c.x + (sx - W / 2) / c.z, y: c.y + (sy - H / 2) / c.z }; };
const toScreen = (wx, wy, l = layer) => { const c = cams[l]; return { x: (wx - c.x) * c.z + W / 2, y: (wy - c.y) * c.z + H / 2 }; };
function resize() {
  W = innerWidth; H = innerHeight; dpr = Math.min(DPR_CAP, devicePixelRatio || 1);
  ui.width = Math.round(W * dpr); ui.height = Math.round(H * dpr);
  renderer?.resize(W, H, dpr);
  if (cams[0]) clampCam();
}
addEventListener('resize', resize);
fitCams(); resize();

// ---- uploads at tick rate ----
let inst = new Float32Array(5000 * 8), drawnAnts = 0, scentBuf = null, uploadedTerrain = -1;
function uploadAnts() {
  if (!renderer) return;
  const s = host.sim, n = s.n, need = n * 8;
  if (inst.length < need) inst = new Float32Array(need);
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (s.layer[i] !== layer) continue;
    const jump = i >= host.pn || host.pl[i] !== s.layer[i]; // a newborn has no last position
    const x = s.x[i] / 256, y = s.y[i] / 256;
    inst[k] = jump ? x : host.px[i] / 256; inst[k + 1] = jump ? y : host.py[i] / 256; inst[k + 2] = x; inst[k + 3] = y;
    inst[k + 4] = s.heading[i] * (Math.PI / 128); inst[k + 5] = s.job[i]; inst[k + 6] = s.carry[i]; inst[k + 7] = (i * 0.618034) % 1;
    k += 8;
  }
  drawnAnts = k / 8;
  renderer.setAnts(inst, drawnAnts);
}
// Scent to bytes: a log scale, 16 steps per doubling, from about 1,000 (faint) to the 24-bit cap.
const byteOf = v => { if (v < 1024) return 0; const e = 31 - Math.clz32(v), m = (v >>> (e - 4)) & 15, L = e * 16 + m - 160; return L > 255 ? 255 : L * 1.15 > 255 ? 255 : (L * 1.15) | 0; };
function uploadScent() {
  if (!renderer) return;
  const d = dims(layer), n = d.w * d.h, S = host.sim.scent.cur;
  if (!scentBuf || scentBuf.length !== n * 4) scentBuf = new Uint8Array(n * 4);
  const tr = S[FIELD.TRAIL], fo = S[FIELD.FOOD], al = S[FIELD.ALARM];
  for (let i = 0, c = d.base; i < n; i++, c++) { const o = i * 4; scentBuf[o] = byteOf(tr[c]); scentBuf[o + 1] = byteOf(fo[c]); scentBuf[o + 2] = byteOf(al[c]); }
  renderer.setScent(layer, d.w, d.h, scentBuf);
}
function uploadTerrain() {
  if (!renderer) return;
  for (const l of [SURFACE, NEST]) { const d = dims(l); renderer.setTerrain(l, d.w, d.h, host.sim.mat.subarray(d.base, d.base + d.w * d.h), host.sim.dig.subarray(d.base, d.base + d.w * d.h)); }
  uploadedTerrain = host.terrainVersion;
}
function uploadAll() { uploadTerrain(); uploadScent(); uploadAnts(); }
uploadAll();

// ---- words and controls ----
function retext() {
  apply();
  $('layer').textContent = layer === SURFACE ? t('nest') : t('surface');
  $('recall').textContent = host.sim.g[GI.RECALL] ? t('sendOut') : t('recall');
  $('recall').setAttribute('aria-pressed', String(!!host.sim.g[GI.RECALL]));
  $('hold').textContent = held ? t('go') : t('hold');
  $('hold').setAttribute('aria-pressed', String(held));
  $('sound').textContent = save.sound ? t('soundOn') : t('soundOff');
  $('tapTrail').textContent = save.tapTrail ? t('tapTrailOn') : t('tapTrailOff');
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  for (const b of document.querySelectorAll('[data-count]')) b.setAttribute('aria-pressed', String(Number(b.dataset.count) === host.ants));
}
retext();
let toastTimer = 0;
function toast(key, params) { const el = $('toast'); el.textContent = t(key, params); el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 1800); }

function setScreen(s) {
  screen = s;
  $('menu').classList.toggle('on', s === 'menu');
  $('paused').classList.toggle('on', s === 'paused');
  $('day').classList.toggle('on', s === 'day');
  document.body.classList.toggle('playing', s !== 'menu');
}
function play() {
  snd.unlock();
  if (saved0 === null && readJson(SAVE) === null) persist();
  if (!running) { startRecord(); running = true; }
  if (colonyMode && !dawnSeen && host.day()) { showDawn(); return; } // no days (sim 8): straight into play
  setScreen('play'); host.last = null; snd.release();
}

// ---- days (colony games): the dawn card with the day's goal, the dusk card with the result, a restart ----
let dawnSeen = false, dayCard = null;
const goalText = g => t('goal_' + g.kind, { target: g.target });
const goalHud = g => t('hudGoal_' + g.kind, g);
function showDawn() {
  const d = host.day();
  dayCard = { kind: 'dawn', day: d.day };
  $('dayHead').textContent = t('dawnTitle', { day: d.day });
  $('dayResult').textContent = ''; $('dayResult').className = '';
  $('dayGoal').textContent = goalText(d);
  $('dayTip').textContent = t('tip_' + d.kind);
  $('dayNote').textContent = d.eased ? t('eased') : '';
  $('dayGo').textContent = t('goDay');
  $('dayRestart').hidden = true;
  setScreen('day'); snd.hold();
}
function showDusk() {
  const k = host.dusk;
  dayCard = { kind: 'dusk', day: k.day };
  $('dayHead').textContent = t('dayTitle', { day: k.day });
  $('dayResult').textContent = t(k.won ? 'duskWon' : 'duskLost'); $('dayResult').className = k.won ? 'won' : 'lost';
  $('dayGoal').textContent = `${t('duskWas', { goal: goalText(k.goal) })} ${t('duskDone', { done: goalHud(k.goal) })}`;
  $('dayTip').textContent = t('duskSummary', { ants: k.ants, born: k.born, lost: k.lost });
  $('dayNote').textContent = `${t('nextGoal', { goal: goalText(k.next) })}${k.next.eased ? ' ' + t('eased') : ''}`;
  $('dayGo').textContent = t('startDay', { day: k.day + 1 });
  $('dayRestart').textContent = t('restartDay', { day: k.day }); $('dayRestart').hidden = false;
  labrec.event('dusk', { day: k.day, won: k.won ? 1 : 0, kind: k.goal.kind, done: k.goal.done, target: k.goal.target, ants: k.ants, sugar: k.sugar, protein: k.protein, born: k.born, lost: k.lost });
  run(G.reset('pause')); tapStart = null;
  setScreen('day'); snd.hold();
  if (k.won) snd.tone(523, 0.2, 0.06, 'triangle', 260); else snd.tone(330, 0.3, 0.05, 'triangle', -120);
}
function dayGo() {
  if (dayCard?.kind === 'dusk') { host.goOn(); labrec.goOn(); labrec.event('dawn', { day: host.day().day }); dayCard = null; showDawn(); return; }
  dawnSeen = true; dayCard = null;
  setScreen('play'); host.last = null; snd.release();
}
function dayRestart() {
  if (dayCard?.kind !== 'dusk') return;
  const day = dayCard.day;
  const before = host.tick;
  if (!host.restartDay(day)) return;
  crewSeq = -1;
  labrec.restart(day, before); labrec.event('restart', { day });
  selected = -1; $('antCard').classList.remove('on'); alarmAt = null; pulses = [];
  stats = host.stats(); uploadAll(); retext();
  dayCard = null; showDawn();
}
function pauseGame() {
  if (screen !== 'play') return;
  run(G.reset('pause'));
  setScreen('paused'); snd.hold();
}
function resume() { setScreen('play'); host.last = null; snd.release(); }
function toMenu() {
  if (running) { labrec.end('left'); running = false; }
  setScreen('menu'); snd.hold();
}
function setCount(n) {
  if (colonyMode || !COUNTS.includes(n) || n === host.ants) return;
  run(G.reset('count'));
  host = new Host(n); save.ants = n; persist(); crewSeq = -1; setSpeed(1);
  if (running) startRecord(); // a new game: its own replay
  selected = -1; tapStart = null; stats = host.stats();
  uploadAll(); retext();
}
function setLayer(l) {
  run(G.reset('layer'));
  layer = l; tapStart = null; selected = -1;
  clampCam(); uploadScent(); uploadAnts(); retext();
}
function setTool(next) { if (next === tool) return; run(G.reset('tool')); tool = next; tapStart = null; retext(); if (tool === 'alarm') toast('alarmHold'); }
$('play').addEventListener('click', play);
$('dayGo').addEventListener('click', dayGo);
$('dayRestart').addEventListener('click', dayRestart);
$('pause').addEventListener('click', pauseGame);
$('resume').addEventListener('click', resume);
$('toMenu').addEventListener('click', toMenu);
$('layer').addEventListener('click', () => setLayer(layer === SURFACE ? NEST : SURFACE));
$('zin').addEventListener('click', () => { cams[layer].z *= 1.4; clampCam(); });
$('zout').addEventListener('click', () => { cams[layer].z /= 1.4; clampCam(); });
function setHold(on) { if (on === held) return; held = on; labrec.hold(on, performance.now()); host.last = null; retext(); if (held) toast('held'); }
$('hold').addEventListener('click', () => setHold(!held));
// View speed (solo play): 1×, 2×, 4× ticks per second. Page-side, like Hold: the sim and its hashes do not change.
const SPEEDS = [1, 2, 4];
function setSpeed(x) { if (!SPEEDS.includes(x)) x = 1; host.speed = x; $('speed').textContent = `${x}×`; $('speed').setAttribute('aria-pressed', String(x > 1)); }
$('speed').addEventListener('click', () => { const x = SPEEDS[(SPEEDS.indexOf(host.speed ?? 1) + 1) % SPEEDS.length]; setSpeed(x); labrec.emit('speed', { at: host.tick, x }); snd.tone(500 + 150 * x, 0.06, 0.03, 'triangle'); });
$('recall').addEventListener('click', () => { const on = !host.sim.g[GI.RECALL]; order({ type: CMD.RECALL, on: on ? 1 : 0 }); setTimeout(retext, 80); });
$('sound').addEventListener('click', () => { save.sound = !save.sound; persist(); if (!save.sound) snd.hold(); retext(); });
$('tapTrail').addEventListener('click', () => { save.tapTrail = !save.tapTrail; persist(); retext(); });
for (const id of ['langMenu', 'langPause']) $(id).addEventListener('click', () => { setLang(lang() === 'en' ? 'tr' : 'en'); rec.retext?.(); retext(); });
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
for (const b of document.querySelectorAll('[data-count]')) b.addEventListener('click', () => setCount(Number(b.dataset.count)));
// A look is a different shader build, so changing it reloads the page with ?look= (the other parameters kept).
for (const b of document.querySelectorAll('[data-look]')) {
  b.setAttribute('aria-pressed', String(b.dataset.look === lookName));
  b.addEventListener('click', () => setLook(b.dataset.look));
}
/** Another look in place: the shaders are built again and the textures uploaded again; the game goes on. The URL
 *  keeps the look (replaceState), so a reload or a shared link shows the same one. */
function setLook(name) {
  name = pickLook(name); if (name === lookName) return;
  const next = LOOKS[name];
  if (renderer) {
    try { renderer.setLook(next.id); } catch (e) { glFailed = String(e.message || e).slice(0, 200); uploadAll(); return; }
    uploadAll();
  }
  lookName = name; LOOK = next; paintTheme();
  for (const b of document.querySelectorAll('[data-look]')) b.setAttribute('aria-pressed', String(b.dataset.look === lookName));
  try { const u = new URL(location.href); u.searchParams.set('look', name); history.replaceState(history.state, '', u.href); } catch {}
  labrec.emit('look', { look: name, tick: host.tick });
}
$('antClose').addEventListener('click', () => { selected = -1; $('antCard').classList.remove('on'); });
onLeave(pauseGame);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (screen === 'play') pauseGame(); else if (screen === 'paused') resume(); e.preventDefault(); }
});
const help = hint(ui, { kind: 'path', key: HINT, when: () => screen === 'play' && tool === 'trail' && layer === SURFACE, played: saved0 !== null, bottom: 200 });

// ---- orders ----
let preview = null, tapStart = null, selected = -1, alarmAt = null, pulses = [], stats = host.stats();
function order(o) {
  const e = host.order(o);
  labrec.order(o, e);
  return e;
}

// ---- crews: plus and minus on one trail (CMD.CREW). A tap on a trail's number picks it; the newest is the default.
// A press moves one ant; holding 400 ms moves eight, and eight more each 400 ms after that. ----
let crewSeq = -1;
const crewTrail = () => stats.trails.find(tr => tr.seq === crewSeq) ?? stats.trails.find(tr => tr.newest) ?? null;
function crewStep(delta) {
  const tr = crewTrail(); if (!tr || screen !== 'play') return;
  order({ type: CMD.CREW, seq: tr.seq, delta });
  snd.tone(delta > 0 ? 700 : 500, 0.08, 0.04, 'triangle', delta > 0 ? 120 : -120);
  setTimeout(hud, 80);
}
// A click (pointer, keyboard or assistive tech) moves one; a hold moves eight and suppresses the click after it. The
// hold keeps the trail it started on and stops on pointer loss, blur, leaving play or that trail going.
const crewStops = [];
for (const [id, sign] of [['crewPlus', 1], ['crewMinus', -1]]) {
  const b = $(id); let timer = 0, long = false, seq = -1;
  const stop = () => { clearInterval(timer); clearTimeout(timer); timer = 0; };
  crewStops.push(stop);
  const step8 = () => { if (screen !== 'play' || crewTrail()?.seq !== seq) return stop(); crewStep(8 * sign); };
  b.addEventListener('pointerdown', e => {
    long = false; stop(); seq = crewTrail()?.seq ?? -1;
    try { b.setPointerCapture(e.pointerId); } catch { /* not every engine */ }
    timer = setTimeout(() => { long = true; step8(); if (timer) timer = setInterval(step8, 400); }, 400);
  });
  b.addEventListener('pointerup', stop);
  for (const ev of ['pointercancel', 'lostpointercapture', 'blur']) b.addEventListener(ev, stop);
  b.addEventListener('click', e => { e.preventDefault(); if (long) { long = false; return; } crewStep(sign); });
}
addEventListener('blur', () => crewStops.forEach(f => f()));
/** A tap near a trail's number picks that trail for plus and minus. */
function pickTrailAt(sx, sy) {
  if (layer !== SURFACE) return false;
  let best = null, bd = 22 * 22;
  for (const tr of stats.trails) { const p = toScreen(tr.x + 0.5, tr.y + 0.5), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < bd || (d === bd && best && tr.seq === crewSeq)) { bd = d; best = tr; } }
  if (!best) return false;
  // Trails whose numbers sit on top of each other: each tap picks the next of them.
  const tied = stats.trails.filter(tr => { const p = toScreen(tr.x + 0.5, tr.y + 0.5); return (p.x - sx) ** 2 + (p.y - sy) ** 2 <= bd + 4; });
  const at = tied.findIndex(tr => tr.seq === crewSeq);
  crewSeq = tied.length > 1 && at >= 0 ? tied[(at + 1) % tied.length].seq : best.seq;
  hud(); return true;
}
const cellOf = (sx, sy) => { const w = toWorld(sx, sy); return [Math.floor(w.x), Math.floor(w.y)]; };
function trailPoints(screenPts) {
  const pts = [];
  for (const [sx, sy] of screenPts) { const [x, y] = cellOf(sx, sy); const l = pts[pts.length - 1]; if (!l || l[0] !== x || l[1] !== y) pts.push([x, y]); }
  if (pts.length < 2) return null;
  const keep = pts.length <= 64 ? pts : Array.from({ length: 64 }, (_, k) => pts[Math.round(k * (pts.length - 1) / 63)]);
  return keep.flat();
}
function digCells(screenPts) {
  const seen = new Set(), out = [], d = dims(NEST);
  const add = (x, y) => { for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const cx = x + ox, cy = y + oy; if (cx < 0 || cy < 0 || cx >= d.w || cy >= d.h) continue; const k = cy * d.w + cx; if (!seen.has(k) && out.length < 512) { seen.add(k); out.push(cx, cy); } } };
  let prev = null;
  for (const [sx, sy] of screenPts) { const c = cellOf(sx, sy); if (prev) line(prev[0], prev[1], c[0], c[1], add); else add(c[0], c[1]); prev = c; }
  return out;
}
function act(a) {
  switch (a.type) {
    case 'preview': preview = a; break;
    case 'clear': preview = null; break;
    case 'pan': { const c = cams[layer]; c.x -= a.dx / c.z; c.y -= a.dy / c.z; clampCam(); break; }
    case 'zoom': {
      const c = cams[layer], before = toWorld(a.x, a.y);
      c.z *= a.f; clampCam();
      const after = toWorld(a.x, a.y); c.x += before.x - after.x; c.y += before.y - after.y; clampCam();
      break;
    }
    case 'order':
      if (a.tool === 'trail') {
        if (layer !== SURFACE) { toast('trailSurface'); break; }
        const points = trailPoints(a.points); if (!points) break;
        order({ type: CMD.TRAIL, layer: SURFACE, points });
        pulses.push({ pts: points, at: performance.now() }); snd.tone(620, 0.14, 0.06, 'triangle', -180);
      } else if (a.tool === 'dig') {
        if (layer !== NEST) { toast('digNest'); break; }
        const cells = digCells(a.points); if (!cells.length) break;
        for (let k = 0; k < cells.length; k += 512) order({ type: CMD.DIG, cells: cells.slice(k, k + 512) });
        snd.tone(180, 0.1, 0.06, 'square', -60);
      }
      break;
    case 'alarm': {
      const w = toWorld(a.x, a.y), x = Math.floor(w.x), y = Math.floor(w.y);
      order({ type: CMD.ALARM, layer, x, y, hold: a.phase === 'end' ? 1 : 400 });
      alarmAt = a.phase === 'end' ? null : { x: x + 0.5, y: y + 0.5, layer };
      if (a.phase === 'start') snd.tone(880, 0.25, 0.05, 'sawtooth', -300);
      break;
    }
    case 'tap': {
      if (tool === 'trail' && save.tapTrail && layer === SURFACE) {
        if (!tapStart && pickTrailAt(a.x, a.y)) break; // a trail's number first, unless a stroke is waiting for its end
        if (!tapStart) { tapStart = toWorld(a.x, a.y); toast('tapStart'); break; }
        const s = toScreen(tapStart.x, tapStart.y), points = trailPoints([[s.x, s.y], [a.x, a.y]]);
        tapStart = null;
        if (points) { order({ type: CMD.TRAIL, layer: SURFACE, points }); pulses.push({ pts: points, at: performance.now() }); snd.tone(620, 0.14, 0.06, 'triangle', -180); }
        break;
      }
      if (pickTrailAt(a.x, a.y)) break;
      inspectAt(a.x, a.y);
      break;
    }
  }
}
function run(actions) { for (const a of actions) act(a); }
function inspectAt(sx, sy) {
  const w = toWorld(sx, sy), s = host.sim, r = Math.max(1.5, 22 / cams[layer].z), r2 = r * r;
  let best = -1, bd = r2;
  for (let i = 0; i < s.n; i++) {
    if (s.layer[i] !== layer) continue;
    const dx = s.x[i] / 256 - w.x, dy = s.y[i] / 256 - w.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  selected = best;
  $('antCard').classList.toggle('on', best >= 0);
  showAnt();
}
function showAnt() {
  if (selected < 0) return;
  const a = host.inspect(selected); if (!a) return;
  $('antText').innerHTML = `<b>${t(a.job)} #${a.i + 1}</b>${t(a.carry ? 'load_food' : 'load_none')}<br>${t('to_' + a.to)}<br><i>${t('why_' + a.why)}</i>`;
}

// ---- pointers: thin glue over gestures.js ----
const P = e => ({ id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), kind: e.pointerType, button: e.button, primary: e.isPrimary });
ui.addEventListener('pointerdown', e => {
  if (screen !== 'play') return;
  try { ui.setPointerCapture(e.pointerId); } catch { /* synthetic pointers are not active pointers */ }
  run(G.down(P(e), tool));
});
ui.addEventListener('pointermove', e => { if (screen === 'play') run(G.move(P(e))); });
ui.addEventListener('pointerup', e => run(G.up(P(e))));
ui.addEventListener('pointercancel', e => run(G.cancel(e.pointerId, 'pointercancel')));
ui.addEventListener('lostpointercapture', e => run(G.cancel(e.pointerId, 'lostpointercapture')));
ui.addEventListener('contextmenu', e => e.preventDefault());
ui.addEventListener('wheel', e => { if (screen !== 'play') return; e.preventDefault(); act({ type: 'zoom', f: Math.exp(-e.deltaY * 0.0015), x: e.clientX, y: e.clientY }); }, { passive: false });

// ---- the overlay (Canvas 2D): stroke preview, crews at trail ends, the selected ant, order pulses ----
function drawOverlay(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (layer === SURFACE) {
    for (const tr of stats.trails) {
      const p = toScreen(tr.x + 0.5, tr.y + 0.5);
      if (p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
      const label = tr.want === null ? String(tr.on) : `${tr.on}/${tr.want}`, r = label.length > 3 ? 18 : 13;
      ctx.fillStyle = tr.newest ? LOOK.bubble : LOOK.bubbleOld; ctx.strokeStyle = LOOK.bubbleRim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); ctx.stroke();
      if (tr === crewTrail()) { ctx.strokeStyle = LOOK.select; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, 7); ctx.stroke(); }
      ctx.fillStyle = LOOK.bubbleText; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, p.x, p.y + 0.5);
    }
    for (const pu of pulses) {
      const k = (now - pu.at) / 900; if (k > 1) continue;
      ctx.strokeStyle = `rgba(${LOOK.pulse}, ${1 - k})`; ctx.lineWidth = 3 + 6 * k;
      ctx.beginPath(); for (let i = 0; i < pu.pts.length; i += 2) { const p = toScreen(pu.pts[i] + 0.5, pu.pts[i + 1] + 0.5); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke();
    }
    pulses = pulses.filter(pu => now - pu.at < 900);
    drawSpider(now);
  }
  if (layer === NEST && colonyMode) drawBrood();
  if (held) { ctx.strokeStyle = '#2f5b8acc'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6); } // time is held
  if (preview && preview.points.length) {
    ctx.strokeStyle = preview.tool === 'dig' ? '#f2d25a' : LOOK.stroke; ctx.lineWidth = preview.tool === 'dig' ? Math.max(6, 3 * cams[layer].z) : 4;
    ctx.setLineDash(preview.tool === 'dig' ? [] : [2, 8]);
    ctx.beginPath(); preview.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.setLineDash([]);
  }
  const st = G.state.stroke;
  if (st && st.tool === 'alarm' && !st.alarm && !G.state.dead) {
    const k = Math.min(1, (now - st.t0) / 300);
    ctx.strokeStyle = '#b8432f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(st.x0, st.y0, 26, -Math.PI / 2, -Math.PI / 2 + k * 2 * Math.PI); ctx.stroke();
  }
  if (tapStart) { const p = toScreen(tapStart.x, tapStart.y); ctx.fillStyle = LOOK.stroke; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill(); }
  if (selected >= 0 && host.sim.layer[selected] === layer) {
    const s = host.sim, a = host.alpha, j = host.pl[selected] !== s.layer[selected];
    const x = j ? s.x[selected] / 256 : (host.px[selected] + (s.x[selected] - host.px[selected]) * a) / 256;
    const y = j ? s.y[selected] / 256 : (host.py[selected] + (s.y[selected] - host.py[selected]) * a) / 256;
    const p = toScreen(x, y);
    ctx.strokeStyle = LOOK.select; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(10, cams[layer].z * 1.2), 0, 7); ctx.stroke();
  }
}

// The spider (sim/spider.js): while it is coming, a red ring where it will appear; while it hunts, a dark body
// with eight legs that step, and the cell it reaches into. Colours from the look (looks.js).
function drawSpider(now) {
  const g = host.sim.g, st = g[GI.SP];
  if (st !== SPIDER.WARN && st !== SPIDER.HUNT) return;
  const z = cams[SURFACE].z, p = toScreen(g[GI.SP_X] + 0.5, g[GI.SP_Y] + 0.5), u = Math.max(7, z * 1.4);
  if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) { drawSpiderArrow(p); return; }
  if (st === SPIDER.WARN) {
    const k = (now % 1000) / 1000;
    ctx.strokeStyle = `rgba(${LOOK.danger}, ${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, u * (1 + 2 * k), 0, 7); ctx.stroke();
    return;
  }
  ctx.strokeStyle = `rgba(${LOOK.danger}, 0.35)`; ctx.lineWidth = 2; ctx.strokeRect(p.x - 1.5 * z, p.y - 1.5 * z, 3 * z, 3 * z); // its reach: one cell around
  ctx.strokeStyle = LOOK.spider; ctx.lineWidth = Math.max(1.5, u * 0.16); ctx.lineCap = 'round';
  const step = Math.sin(now / 90);
  for (let side = -1; side <= 1; side += 2) for (let l = 0; l < 4; l++) {
    const a = (l - 1.5) * 0.5 + (l & 1 ? step : -step) * 0.18, dx = side * Math.cos(a), dy = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dx * u * 1.1, p.y + dy * u * 1.1 - u * 0.4); ctx.lineTo(p.x + dx * u * 1.9, p.y + dy * u * 1.9 + u * 0.3); ctx.stroke();
  }
  ctx.fillStyle = LOOK.spider; ctx.beginPath(); ctx.ellipse(p.x, p.y + u * 0.45, u * 0.7, u * 0.8, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(p.x, p.y - u * 0.45, u * 0.42, 0, 7); ctx.fill();
  ctx.fillStyle = LOOK.spiderMark; ctx.beginPath(); ctx.arc(p.x, p.y + u * 0.45, u * 0.22, 0, 7); ctx.fill(); // the red mark
}
/** The spider is off screen: an arrow at the edge, pointing to it. */
function drawSpiderArrow(p) {
  const cx = W / 2, cy = H / 2, a = Math.atan2(p.y - cy, p.x - cx), m = 28; // where the ray to it meets the edge, inset
  const k = Math.min(Math.abs(Math.cos(a)) > 1e-6 ? (W / 2 - m) / Math.abs(Math.cos(a)) : Infinity, Math.abs(Math.sin(a)) > 1e-6 ? (H / 2 - m) / Math.abs(Math.sin(a)) : Infinity);
  const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
  ctx.fillStyle = `rgb(${LOOK.danger})`; ctx.beginPath();
  ctx.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.lineTo(x + Math.cos(a + 2.5) * 12, y + Math.sin(a + 2.5) * 12); ctx.lineTo(x + Math.cos(a - 2.5) * 12, y + Math.sin(a - 2.5) * 12);
  ctx.fill();
}

// The nest view (nestview.js): chambers, stores, brood by growth, the queen. Rooms are found again when the terrain changes.
let rooms = [], roomsAt = -1;
function nestRooms() { if (roomsAt !== host.terrainVersion || rooms.host !== host) { rooms = findRooms(host.sim); rooms.host = host; roomsAt = host.terrainVersion; } return rooms; }
function drawBrood() { drawNest({ ctx, sim: host.sim, g: GI, toScreen: (x, y) => toScreen(x, y, NEST), z: cams[NEST].z, W, H, now: performance.now(), rooms: nestRooms(), t, look: LOOK }); }

// ---- the HUD (a few times a second) ----
function hud() {
  stats = host.stats();
  const num = v => v.toLocaleString(lang()), c = stats.colony;
  $('stats').textContent = c
    ? t('hudColony', { ants: num(stats.ants), sugar: num(c.sugar), protein: num(c.protein), eggs: num(c.eggs), larvae: num(c.larvae), pupae: num(c.pupae) })
    : t('hud', { out: num(stats.surface), carrying: num(stats.carrying), home: num(stats.stores) });
  const lines = [];
  const newest = stats.trails.find(tr => tr.newest);
  stats.trails.slice().sort((a, b) => b.seq - a.seq).forEach((tr, k) => {
    if (k > 1) return;
    const why = tr.why ? t('why_' + tr.why) : '';
    lines.push(`${t('trailCrew', { n: stats.trails.length - k, crew: tr.on })}${why ? ` <small>· ${why}</small>` : ''}`);
  });
  const food = stats.piles.reduce((a, p) => a + p.crew, 0);
  if (food) lines.push(t('foodCrew', { crew: food }));
  if (stats.dig.marked) lines.push(`${t('digCrew', stats.dig)}${stats.dig.crew >= stats.dig.cap ? ` <small>· ${t('digFull')}</small>` : ''}`);
  if (stats.alarm) lines.push(t('alarmCrew', stats.alarm));
  const sp = host.sim.g[GI.SP];
  if (sp === SPIDER.WARN || sp === SPIDER.HUNT) lines.unshift(`<b class="spider">${t('spiderHud', { what: t(sp === SPIDER.WARN ? 'spiderComing' : 'spiderHunting'), kills: host.sim.g[GI.SP_KILLS] })}</b>`);
  if (lines.length && newest) lines.push(`<small>${t('noWanted')}</small>`);
  $('crew').innerHTML = lines.join('<br>');
  const ct = layer === SURFACE ? crewTrail() : null;
  $('crewCtl').classList.toggle('on', !!ct);
  if (ct) { const n = stats.trails.slice().sort((a, b) => a.seq - b.seq).indexOf(ct) + 1; $('crewWho').innerHTML = t(ct.want === null ? 'crewWho' : 'crewWhoWant', { n, on: ct.on, want: ct.want }); }
  const d = host.day();
  $('goal').hidden = !d;
  if (d) { const s = Math.ceil(d.left / 20), time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; $('goal').textContent = t('hudDay', { day: d.day, goal: goalHud(d), time }); $('goal').classList.toggle('done', d.won); }
  showAnt();
  if ($('recall').getAttribute('aria-pressed') !== String(stats.recall)) retext();
}

// The spider's events: a toast and a sound each, and a lab event (the replay has them too; these say what the page showed).
function spiderNews(e) {
  labrec.event('spider', { at: e.tick, s: e.state, a: e.arg, recall: host.sim.g[GI.RECALL] });
  if (e.state === SPIDER.WARN) { toast(e.arg < 0 ? 'spiderEdge' : host.sim.g[GI.RECALL] ? 'spiderHold' : 'spiderWarn'); if (save.sound) { snd.tone(220, 0.25, 0.05, 'sawtooth'); setTimeout(() => snd.tone(196, 0.3, 0.05, 'sawtooth'), 260); } }
  else if (e.state === SPIDER.HUNT) { if (e.arg >= 0) toast(host.sim.g[GI.RECALL] ? 'spiderHold' : 'spiderHunt'); if (save.sound) snd.tone(147, 0.4, 0.06, 'sawtooth'); }
  else if (e.state === SPIDER.LEFT) { toast(e.arg ? 'spiderLeft' : host.sim.g[GI.RECALL] ? 'spiderLeftNone' : 'spiderGone', { kills: e.arg }); if (save.sound) snd.tone(660, 0.12, 0.03, 'triangle'); }
}

// Colony moments the page names once each (no sim state): the first birth, and larvae with no protein in store.
let newsBorn = 0, newsHungry = false, newsSim = null;
function colonyNews() {
  if (!host.colony) return;
  const g = host.sim.g, born = g[GI.BORN];
  if (newsSim !== host.sim) { newsSim = host.sim; newsBorn = born; newsHungry = false; } // a new game or a restarted day
  if (born > newsBorn) { if (newsBorn === 0 || born % 10 === 0) toast(born === 1 ? 'bornFirst' : 'bornMore', { n: born }); if (save.sound) snd.tone(990, 0.08, 0.03, 'sine', 300); }
  newsBorn = born;
  const larvae = host.sim.brood.n > 0 && Array.prototype.some.call(host.sim.brood.stage.subarray(0, host.sim.brood.n), s => s === 1); // STAGE.LARVA
  const hungry = larvae && g[GI.PROTEIN] === 0;
  if (hungry && !newsHungry) { toast('larvaeHungry'); labrec.event('hungry', { at: host.tick }); }
  newsHungry = hungry;
}

// ---- frame loop, with a frame-time sampler (S3) ----
const frames = { on: false, dt: [], work: [], last: 0, drawn: 0 };
const fpsOn = query.get('fps') === '1';
if (fpsOn) $('fps').classList.add('on');
let lastHud = 0, lastStores = 0, lastClick = 0, lastFps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  run(G.tick(t0));
  const stepped = host.advance(now, screen !== 'play' || held);
  if (screen === 'play') { labrec.tick(); labrec.camera(layer, cams[layer], now); if (frames.last) labrec.frame(now - frames.last); }
  for (const e of host.spiderNews.splice(0)) spiderNews(e);
  for (const e of host.pileNews.splice(0)) { toast(e.kind ? 'pileNewProtein' : 'pileNewSugar'); labrec.event('pile', { at: e.tick, p: e.pile, k: e.kind }); if (save.sound) snd.tone(e.kind ? 520 : 780, 0.18, 0.05, 'triangle', 200); }
  colonyNews();
  if (host.dusk && screen === 'play') showDusk(); // the day is over: time stops on the dusk card
  if (host.shifted) { host.shifted = false; selected = -1; $('antCard').classList.remove('on'); } // a death renumbered the ants
  if (stepped) {
    uploadAnts(); uploadScent();
    if (host.terrainVersion !== uploadedTerrain) uploadTerrain();
    if (host.delivered > lastStores && save.sound && now - lastClick > 140) { snd.tone(1700 + 300 * Math.random(), 0.03, 0.015, 'square'); lastClick = now; }
    lastStores = host.delivered;
  }
  const L = host.sim.L, ent = { x: L.sw / 2 + 1, y: L.sh / 2 + 0.5 };
  const alarmLive = stats.alarm && alarmAt && alarmAt.layer === layer ? alarmAt : null;
  if (renderer && renderer.draw({ layer, cam: cams[layer], alpha: screen === 'play' ? host.alpha : 1, running: screen === 'play', time: now / 1000, piles: layer === SURFACE ? stats.piles : [], entrance: layer === SURFACE ? ent : null, alarm: alarmLive })) frames.drawn++;
  drawOverlay(now);
  if (now - lastHud > 250) { lastHud = now; if (screen !== 'menu') hud(); }
  const work = performance.now() - t0;
  if (frames.last) { const dt = now - frames.last; if (frames.on || fpsOn) { frames.dt.push(dt); frames.work.push(work); if (!frames.on && frames.dt.length > 240) { frames.dt.splice(0, 120); frames.work.splice(0, 120); } } }
  frames.last = now;
  if (fpsOn && now - lastFps > 1000) { lastFps = now; const f = summary(frames.dt), w = summary(frames.work), s = host.tickStats(); $('fps').textContent = `frame ${f.mean.toFixed(1)} ms (p95 ${f.p95.toFixed(1)})  ${(1000 / f.mean).toFixed(0)} fps\nwork ${w.mean.toFixed(1)} ms (p95 ${w.p95.toFixed(1)})\nsim tick ${s ? s.mean.toFixed(2) : '-'} ms (p95 ${s ? s.p95.toFixed(2) : '-'})\nants ${host.ants}, drawn ${drawnAnts}, dpr ${dpr}\n${renderer?.gpu ?? 'no WebGL2'}`; }
}
function summary(a) {
  if (!a.length) return { n: 0, mean: 0, p95: 0, max: 0 };
  const s = a.slice().sort((p, q) => p - q);
  return { n: s.length, mean: s.reduce((p, q) => p + q, 0) / s.length, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] };
}
requestAnimationFrame(frame);

// ---- hooks for the phone check and the S3 script ----
window.painter = {
  rooms: () => nestRooms().map(r => ({ size: r.size, queen: r.queen })),
  day: () => host.day(), dusk: () => host.dusk, dawns: () => [...host.dawns.keys()], hashes: () => host.sim.hashes(),
  state: () => ({ screen: screen === 'paused' ? 'paused' : screen, look: lookName, speed: host.speed ?? 1, dayCard: dayCard?.kind ?? null, spider: host.sim.g[GI.SP], spiderVisits: host.sim.g[GI.SP_VISITS], held, t: host.tick, paused: screen === 'paused', ants: host.ants, sound: save.sound, tapTrail: save.tapTrail, tool, layer, preview: preview ? preview.points.length : 0, orders: host.log.length, gl: !!renderer && !renderer.lost, glLosses: renderer?.losses ?? 0, glRestored: renderer?.restored ?? 0, glFailed, drawn: frames.drawn, selected, help: help.shown }),
  log: () => JSON.parse(JSON.stringify(host.log)),
  stats: () => host.stats(),
  lab: () => ({ open: labrec.open, part: labrec.part, chain: labrec.chain, pending: labrec.buf?.length ?? 0, orders: { ...labrec.byType } }),
  brood: () => Array.from({ length: host.sim.brood.n }, (_, k) => [...cellXY(host.sim.L, host.sim.brood.cell[k]).slice(1), host.sim.brood.stage[k]]),
  inspect: i => host.inspect(i),
  toScreen: (x, y, l) => toScreen(x, y, l),
  camera: () => ({ ...cams[layer] }),
  setCamera: c => { Object.assign(cams[layer], c); clampCam(); },
  setAnts: n => setCount(n),
  setTool, setLayer, setLook,
  frames: {
    start() { frames.on = true; frames.dt = []; frames.work = []; host.tickMs = []; },
    stop() { frames.on = false; return { frame: summary(frames.dt), work: summary(frames.work), tick: host.tickStats(), ants: host.ants, drawn: drawnAnts, dpr, view: [W, H], gpu: renderer?.gpu ?? null }; },
  },
  loseContext: () => { const e = renderer?.loseForTest(); window.__lose = e; return !!e; },
  restoreContext: () => { window.__lose?.restoreContext(); },
  TICK_MS,
};
