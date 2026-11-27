// Pass the Flame (lab/flame-b). The link is the flame: arrival, one leg of river, the handoff or the drop.
import { read, write } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { music } from '../../kit/music.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { words } from '../../kit/i18n.js';
import { lab } from '../../kit/lab.js';
import { settings } from '../../kit/settings.js';
import { drag } from '../../kit/drag.js';
import { hint } from '../../kit/hint.js';
import { shareLink } from '../../kit/room.js';
import { WORDS } from './words.js';
import { leg, step, DT, SPEED } from './sim.js';
import { readLink, hasLink, linkFor, passOn, cleanName } from './link.js';
import { createView } from './draw.js';

noZoom();
const $ = id => document.getElementById(id);
const { t, lang, setLang, apply } = words(WORDS);
const rec = lab('flame-b', { lang });
const set = settings('flame', {
  look: { values: ['paper', 'thermal', 'storm'], def: 'paper' },
  drop: { values: ['ends', 'dims'], def: 'dims' },
  sound: { values: ['on', 'off'], def: 'on' },
  haptics: { values: ['on', 'off'], def: 'on' },
}, { rec });
const NAME_KEY = 'flame:name', PLAYED_KEY = 'flame:played';
const soundOn = () => set.get('sound') === 'on';
const fmt = n => Math.round(n).toLocaleString(lang() === 'tr' ? 'tr-TR' : 'en-US');
const randSeed = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % (2 ** 31 - 2)) + 1; };

// ---- the flame that arrived
const linked = hasLink(location.href);
const read0 = readLink(location.href, { detail: true });   // null: no link, or a link refused whole
let prev = read0 ? read0.flame : null;        // an unsigned link's chain count is already clamped to what it can support
const badLink = linked && !prev;
let source = prev ? 'link' : 'new';           // 'link' (a boat hands it over), 'new' (a lamp post), 'coals' (try again)
let startFlame = prev ? prev.flame / 100 : 1;
let seed = prev ? prev.seed : randSeed();
let s = leg(seed, { flame: startFlame });

// ---- view and state
const canvas = $('c'), view = createView(canvas);
let screen = 'arrive', paused = false, taking = false, takeT = 0, introT = 0, endT = 0, T = 0, acc = 0, lastHow = null;
let target = null, vis = 0, made = null, madeUrl = '', settingsOpen = false, retries = 0, safeTop = 0;
const cam = { d: 0, x: 0, z: 1 };
const boat = { d: 0, x: 0, ang: 0, flame: 0, vo: 0 };
let sam = null, dock = null, chain = [], buoy = null, jump = null, dropLights = [], fade = 1;

function measureTop() { const p = document.createElement('div'); p.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden'; document.body.append(p); safeTop = p.getBoundingClientRect().height; p.remove(); }
measureTop();
addEventListener('resize', () => { view.resize(); measureTop(); });

// ---- sound: the kit's unlock, a drone that brightens with the flame, the river score for ember notes
let song = null, drone = null;
const snd = sound({ on: soundOn, setup: ac => {
  try {
    const g = ac.createGain(), f = ac.createBiquadFilter(); g.gain.value = 0; f.type = 'lowpass'; f.frequency.value = 200; f.Q.value = 2;
    f.connect(g).connect(ac.destination);
    const osc = [[73.42, 'sawtooth', 0.5], [73.42 * 1.0059, 'sawtooth', 0.5], [36.71, 'sine', 1.2], [110.0, 'triangle', 0.25]].map(([hz, type, v]) => { const o = ac.createOscillator(), og = ac.createGain(); o.type = type; o.frequency.value = hz; og.gain.value = v; o.connect(og).connect(f); o.start(); return o; });
    drone = { g, f, osc };
    song = music(ac, { preset: 'river' }); song.volume(0.3);
  } catch { /* sound never breaks the game */ }
} });
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
function chime(freqs, gap = 0.09, dur = 1.4, vol = 0.07, type = 'triangle') { freqs.forEach((f, i) => setTimeout(() => snd.tone(f, dur, vol, type), i * gap * 1000)); }
const midi = m => 440 * 2 ** ((m - 69) / 12);
const sfx = {
  ember(n) { if (!(soundOn() && song?.ember())) snd.tone(midi(62 + PENTA[Math.min(PENTA.length - 1, (n - 1) % 11)]), 0.5, 0.08, 'triangle'); },
  rock() { snd.noise(0.22, 0.28, 520); snd.tone(98, 0.35, 0.13, 'sine', -50); song?.hit(); },
  bank() { snd.noise(0.14, 0.14, 1300); },
  take() { snd.noise(0.5, 0.06, 2600); chime([midi(62), midi(69), midi(74), midi(78), midi(81)], 0.08, 1.8, 0.06); },
  hand() { snd.noise(0.6, 0.06, 3000); chime([midi(74), midi(78), midi(81), midi(86)], 0.11, 2.2, 0.065, 'sine'); },
  out(i) { const m = 81 - [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19][i % 12]; snd.tone(midi(m), 1.3, 0.075, 'sine', -midi(m) * 0.06); },
  gutter() { snd.noise(1.2, 0.12, 400); snd.tone(midi(50), 1.6, 0.09, 'sine', -40); },
};
const buzz = ms => { if (set.get('haptics') === 'on') try { navigator.vibrate?.(ms); } catch {} };
function soundFrame() {
  const ac = snd.ctx; if (!ac || !drone) return;
  const live = soundOn() && !paused && (screen === 'leg' || (screen === 'arrive' && taking));
  const now = ac.currentTime, f = Math.max(0, vis);
  drone.g.gain.setTargetAtTime(live ? 0.035 + 0.03 * f : 0, now, 0.4);
  drone.f.frequency.setTargetAtTime(140 + 1600 * f ** 1.4, now, 0.25);
  song?.set({ on: live && screen === 'leg' && !taking, progress: s.progress, danger: Math.max(0, Math.min(1, (0.3 - s.flame) / 0.3)), light: s.flame });
}

// ---- the scene for each screen
const land = () => view.size.W > view.size.H * 1.15;
// camera that puts metre dTop at screen height yTop and metre dBot at yBot (fractions of the height); never closer than z 1
function fit(dTop, yTop, dBot, yBot, zMax = 1) {
  const H = view.size.H, kk = Math.min(view.k * zMax, (yBot - yTop) * H / (dTop - dBot));
  return { d: dTop - (view.ay - yTop * H) / kk, z: kk / view.k };
}
// arrival: first the two boats and a stretch of river, then the camera pulls back down the line of lights
let homeCam = null, farCam = null;
function setupArrival() {
  const n = prev ? prev.carriers.length : 0;
  chain = []; sam = null; dock = null; buoy = { d: s.L + 19, x: s.river.center(s.L + 19) + 6, lit: 0 };   // the boat's glide (30 m/s easing out) ends beside it
  boat.d = 0; boat.x = 0; boat.ang = 0; boat.flame = source === 'coals' ? 0.02 : 0; boat.vo = 0; vis = boat.flame;
  if (source === 'link') {
    const last = prev.carriers[n - 1];
    sam = { d: -26, x: 11, ang: 0, flame: Math.max(0.2, startFlame), label: last.name || t('someone'), sub: `${fmt(last.dist)}\u00a0m`, labelA: 1 };
    for (let j = 0; j < n - 1; j++) { const c = prev.carriers[n - 2 - j], d = -48 - j * 22; chain.push({ d, x: Math.sin(j * 1.7) * 6, lit: 1, label: c.name || t('someone'), sub: `${fmt(c.dist)}\u00a0m` }); }
    for (let j = 0; j < Math.min(6, prev.chain - n); j++) chain.push({ d: -48 - (n - 1) * 22 - j * 11, x: Math.sin((n + j) * 1.7) * 6, lit: 0.45 - j * 0.06, small: true });
  } else if (source === 'new') dock = { d: -4, x: -(s.river.half(0) - 3.5), lit: 1 };
  const boatY = land() ? 0.6 : 0.44;
  // close enough to read the boats, far enough that both banks show across the width
  let hw = 0; for (let d = -60; d <= 30; d += 5) hw = Math.max(hw, s.river.half(d));
  const zFit = Math.min(0.92, view.size.W / (2 * (hw + 3)) / view.k);
  homeCam = fit(0, boatY, -60, boatY + 0.5, zFit);
  const far = chain.length ? chain[chain.length - 1].d - 10 : null;
  const yTop = land() ? 0.45 : 0.4;
  farCam = far === null ? homeCam : fit(0, yTop, far, land() ? 0.68 : 0.8, zFit);   // landscape keeps the last name above the lab notice
  // never so far out that two names (22 m apart) come closer than 30 px: on a short screen the tail runs off the bottom
  const kMin = 30 / 22;
  if (farCam.z * view.k < kMin) farCam = { d: 0 - (view.ay - yTop * view.size.H) / kMin, z: kMin / view.k };
  cam.d = homeCam.d; cam.z = homeCam.z; cam.x = 0;
  introT = 0; fade = 0.5; taking = false; jump = null;
  setupArrivalWords();
  $('arrive').classList.remove('gone'); $('arrive').classList.add('in'); $('touch').classList.remove('on');
  view.event('reset');
}
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);

function arrivalFrame(dt) {
  introT += dt;
  fade = Math.max(0, fade - dt * 2.5);
  if (!taking) {
    const u = ease((introT - 1.6) / 3.2);
    cam.d = homeCam.d + (farCam.d - homeCam.d) * u; cam.z = homeCam.z + (farCam.z - homeCam.z) * u;
  }
  if (sam) { const su = ease(introT / 1.2); if (!taking) sam.d = -26 + 24.5 * su; sam.ang = (1 - su) * -0.05; }
  if (introT > 0.4 && !taking) $('touch').classList.add('on');
  if (taking) {
    takeT += dt;
    cam.d += (6 - cam.d) * Math.min(1, dt * 6); cam.z += (1 - cam.z) * Math.min(1, dt * 6);
    if (sam) sam.d += (-1.5 - sam.d) * Math.min(1, dt * 7);
    const from = source === 'link' ? lanternAt(sam.d, sam.x, 3.2) : source === 'new' ? lanternAt(dock.d, dock.x, 3, false) : lanternAt(boat.d, boat.x, 2.75);
    const to = lanternAt(boat.d, boat.x, 2.75), u2 = Math.min(1, Math.max(0, (takeT - 0.1) / 0.65));
    jump = source === 'coals' ? null : { ax: from.x, ay: from.y, bx: to.x, by: to.y, u: u2, x: from.x + (to.x - from.x) * u2, y: from.y + (to.y - from.y) * u2 };
    if (u2 >= 1) {
      jump = null; boat.flame = startFlame; vis = startFlame;
      view.event('lit', { d: boat.d + 1, x: boat.x });
      if (sam) { sam.flame = Math.max(0.12, sam.flame * 0.35); }
      if (dock) dock.lit = 0.4;
      beginLeg();
    } else if (source === 'coals') { boat.flame = startFlame * u2; vis = boat.flame; }
  }
}
function lanternAt(d, x, h, boatish = true) { if (boatish) { const [lx, ly] = view.lantern(cam, d, x); return { x: lx, y: ly }; } const p = view.project(cam, d, x), k = view.k * cam.z; return { x: p.x + 0.34 * h * k, y: p.y - 0.62 * h * k }; }

function take() {
  if (screen !== 'arrive' || taking) return;
  taking = true; takeT = 0;
  snd.unlock(); sfx.take(); buzz(18);
  $('touch').classList.remove('on'); $('arrive').classList.add('gone'); $('notice').classList.add('gone');
  screen = 'leg';                              // at once, so the same finger steers (drag.js reads playing() at touch-down)
}
function beginLeg() {
  taking = false; acc = 0; endT = 0;
  song?.start(seed);
  rec.start({ ...set.snapshot(), chain: (prev ? prev.chain : 0) + 1, byLink: source === 'link' || (linked && !!prev), flame: Math.round(startFlame * 100), retry: retries, seed });
}

function legFrame(dt) {
  if (taking) { arrivalFrame(dt); return; }
  if (paused) return;
  acc += dt;
  while (acc >= DT && !s.done) {
    acc -= DT;
    for (const e of step(s, target)) onEvent(e);
  }
  boat.d = s.d; boat.x = s.x; boat.vo = s.vo; boat.ang = Math.atan2(s.vo, SPEED) * 0.9;
  vis += (s.flame - vis) * Math.min(1, dt * 6); boat.flame = vis;
  // the camera follows the river's line ahead more than the boat, so both banks and the next bend stay in view
  cam.d = s.d + 6; cam.x += ((s.x * 0.3 + s.river.center(s.d + 45) * 0.7) - cam.x) * Math.min(1, dt * 2.5); cam.z += (1 - cam.z) * Math.min(1, dt * 2);
  if (sam) { sam.d += 4 * dt; sam.flame = Math.max(0, sam.flame - dt * 0.03); sam.labelA = Math.max(0, sam.labelA - dt * 0.4); if (s.d - sam.d > 160) sam = null; }
  if (dock && s.d > 160) dock = null;
  chain = chain.filter(c => s.d - c.d < 200);
}

function onEvent(e) {
  const at = { t: T, d: s.d, x: s.x };
  if (e.type === 'ember') { view.event('ember', { ...at, d: s.d + 3 }); sfx.ember(e.n); buzz(8); rec.event('ember', { n: e.n, flame: Math.round(s.flame * 100), d: Math.round(s.d) }); }
  if (e.type === 'hit') { view.event('hit', { ...at, what: e.what }); if (e.what === 'rock') { sfx.rock(); buzz(40); } else { sfx.bank(); buzz(15); } rec.event('hit', { what: e.what, flame: Math.round(s.flame * 100), d: Math.round(s.d) }); }
  if (e.type === 'handoff') endHandoff();
  if (e.type === 'drop') endDrop();
}

// ---- the handoff
let nextSeed = 0;
function endHandoff() {
  screen = 'handoff'; endT = 0; steer.reset(); write(PLAYED_KEY, '1');
  boat.d = s.d; boat.x = s.x; cam.d = s.d + 6;
  nextSeed = randSeed();
  rec.event('handoff', { dist: Math.round(s.L), flame: Math.round(s.flame * 100) });
  rec.end('handoff', { dist: Math.round(s.L), flame: Math.round(s.flame * 100), embers: s.taken, hits: s.hits, bumps: s.bumps, chain: (prev ? prev.chain : 0) + 1 });
  $('name').value = read(NAME_KEY, '') || ''; $('name').placeholder = t('namePh');
  made = null; madeUrl = ''; lastHow = null; $('status').textContent = ''; $('linkOut').style.display = 'none'; $('pass').textContent = t('pass');
}
let handSpeed = SPEED;
function handoffFrame(dt) {
  endT += dt;
  handSpeed = Math.max(0, handSpeed - dt * 22);
  boat.d += handSpeed * dt; boat.x += ((buoy.x - 5.5) - boat.x) * Math.min(1, dt * 1.5); boat.ang *= 0.95;
  // once the card is coming, lift boat and buoy into the top fifth of the screen above the card (portrait), or to the
  // left half beside it (landscape)
  const kk = view.k * 0.85, side = land(), yAt = side ? 0.5 : endT > 1.2 ? 0.2 : 0.55;
  const goalD = buoy.d - (view.ay - yAt * view.size.H) / kk, goalX = (boat.x + buoy.x) / 2 + (side && endT > 1.2 ? 0.23 * view.size.W / kk : 0);
  cam.d += (goalD - cam.d) * Math.min(1, dt * 2); cam.x += (goalX - cam.x) * Math.min(1, dt * 2); cam.z += (0.85 - cam.z) * Math.min(1, dt * 1.5);
  const from = lanternAt(boat.d, boat.x, 2.75), to = lanternAt(buoy.d, buoy.x, 3.4, false), u = Math.min(1, Math.max(0, (endT - 0.7) / 0.6));
  if (endT > 0.7 && endT - dt <= 0.7) { sfx.hand(); buzz([20, 40, 20]); }
  jump = u > 0 && u < 1 ? { ax: from.x, ay: from.y, bx: to.x, by: to.y, u, x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u } : null;
  if (u >= 1) buoy.lit = Math.min(1, buoy.lit + dt * 2);
  if (endT > 1.7 && !$('hand').classList.contains('on')) showHand();
}
function preview() { return passOn(prev, { name: cleanName($('name').value), dist: s.L, flame: s.flame, seed: nextSeed }); }
function showHand() {
  const f = preview();
  $('handTitle').textContent = t('carried', { m: fmt(s.L) });
  $('handOn').textContent = t('handOn', { p: f.flame });
  $('handFlame').style.height = `${Math.round(8 + 28 * f.flame / 100)}px`;
  $('handTotal').textContent = f.chain === 1 ? t('totalOne', { m: fmt(f.total) }) : t('total', { m: fmt(f.total), n: fmt(f.chain) });
  drawNames($('names'), f);
  $('hand').classList.add('on');
}
function drawNames(ul, f, dark = false) {
  ul.textContent = '';
  f.carriers.forEach((c, i) => {
    const li = document.createElement('li'), me = i === f.carriers.length - 1 && screen === 'handoff';
    li.textContent = `${c.name || (me ? t('you') : t('someone'))} · ${fmt(c.dist)}\u00a0m`;
    if (me) li.className = 'me'; if (dark) li.className = 'dark';
    ul.append(li);
  });
}
$('name').addEventListener('input', () => { if (screen === 'handoff') drawNames($('names'), preview()); });
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') $('name').blur(); });
$('pass').addEventListener('click', () => {
  const name = cleanName($('name').value); $('name').value = name; write(NAME_KEY, name);
  made = preview(); madeUrl = linkFor(made, location.href);
  const text = made.chain === 1 ? t('shareTextOne', { m: fmt(made.total) }) : t('shareText', { n: fmt(made.chain) });
  const p = shareLink(madeUrl, text);   // no await before it: the share sheet needs the tap
  $('linkOut').value = madeUrl;
  p.then(how => {
    lastHow = how;
    $('status').textContent = t(how === 'shared' ? 'shared' : how === 'copied' ? 'copied' : 'shown');
    if (how !== 'shared') { $('linkOut').style.display = 'block'; if (how === 'shown') { $('linkOut').focus(); $('linkOut').select(); } }
    $('pass').textContent = t('passAgain');
    rec.event('pass_send', { how });
  });
});

// ---- the drop
// The lights of the chain line up behind the boat and go dark one by one, newest first, back to the first, each with a
// falling note. A flame you lit yourself has one light behind it: the dock lamp it came from.
let dropCam = null;
function endDrop() {
  screen = 'drop'; endT = 0; steer.reset(); write(PLAYED_KEY, '1');
  boat.d = s.d; boat.x = s.x;
  sfx.gutter(); buzz([30, 60, 30]);
  view.event('drop', { d: s.d, x: s.x });
  rec.event('drop', { dist: Math.round(s.d) });
  rec.end('drop', { dist: Math.round(s.d), embers: s.taken, hits: s.hits, bumps: s.bumps, chain: (prev ? prev.chain : 0) + 1, rule: set.get('drop') });
  const cs = prev ? prev.carriers : [], at = d => s.river.center(d);
  // spacing in screen px, so names never sit on each other: 34 px a named light, 14 px an unnamed one (less in landscape)
  const small = Math.min(6, (prev ? prev.chain : 0) - cs.length), need = 34 * cs.length + 14 * small + 40;
  const squeeze = Math.min(1, (land() ? 0.8 : 0.5) * view.size.H / need), kk = view.k * (land() ? 0.6 : 0.55);
  const gapN = 34 * Math.max(squeeze, 0.7) / kk, gapS = 14 * squeeze / kk;
  dropLights = [];
  let d = s.d - 30 / kk;
  for (let j = 0; j < cs.length; j++, d -= gapN) { const c = cs[cs.length - 1 - j]; dropLights.push({ d, x: at(d) + Math.sin(j * 1.7) * 5, lit: 0, label: c.name || t('someone'), sub: `${fmt(c.dist)}\u00a0m` }); }
  for (let j = 0; j < small; j++, d -= gapS) dropLights.push({ d, x: at(d) + Math.sin((cs.length + j) * 1.7) * 5, lit: 0, small: true });
  if (!prev) dropLights.push({ d, x: at(d) - (s.river.half(d) - 4), lit: 0 });
  chain = dropLights; sam = null; dock = null; outIndex = -1;
  dropCam = { d: boat.d + 8 - (view.ay - (land() ? 0.1 : 0.12) * view.size.H) / kk, z: kk / view.k };
}
let dropSpeed = SPEED, outIndex = -1;
const DROP = { start: 0.7, gap: n => Math.min(0.42, 3.2 / Math.max(1, n)) };
function dropFrame(dt) {
  endT += dt;
  dropSpeed = Math.max(0, dropSpeed - dt * 40); boat.d += dropSpeed * dt;
  vis = Math.max(0, vis - dt * 2); boat.flame = vis;
  const n = dropLights.length, GAP = DROP.gap(n);
  for (let j = 0; j < n; j++) if (j > outIndex) dropLights[j].lit = Math.min(1, endT * 2.5);
  const i = Math.floor((endT - DROP.start) / GAP);
  if (endT >= DROP.start && i > outIndex && i < n) { outIndex = i; sfx.out(i); view.event('out', { d: dropLights[i].d, x: dropLights[i].x }); }
  for (let j = 0; j <= outIndex && j < n; j++) dropLights[j].lit = Math.max(0, dropLights[j].lit - dt * 2.6);
  cam.d += (dropCam.d - cam.d) * Math.min(1, dt * 4); cam.z += (dropCam.z - cam.z) * Math.min(1, dt * 4);
  const kk = view.k * cam.z, goalX = s.river.center(cam.d) + (land() ? 0.23 * view.size.W / kk : 0);
  cam.x += (goalX - cam.x) * Math.min(1, dt * 3);
  if (endT > DROP.start + GAP * n + 0.6 && !$('drop').classList.contains('on')) showDrop();
}
function showDrop() {
  for (const c of dropLights) c.label = null;   // the card lists the names; canvas labels would show through it
  $('dropTitle').textContent = t('out', { m: fmt(s.d) });
  const cs = prev ? prev.carriers : [], last = cs[cs.length - 1];
  $('dropLine').textContent = !prev ? t('outSelf')
    : prev.chain === 1 ? t('outOne', { name: last.name || t('Someone'), m: fmt(last.dist) })
    : t('outMany', { n: fmt(prev.chain), total: fmt(prev.total), name: last.name || t('Someone') });
  if (prev) drawNames($('dropNames'), prev, true); else $('dropNames').textContent = '';
  const dims = set.get('drop') === 'dims';
  $('dropRule').textContent = t(dims ? 'outDims' : 'outEnds');
  $('again').style.display = dims ? '' : 'none';
  $('fresh').className = dims ? 'quiet' : 'big';
  $('drop').classList.add('on');
}
$('again').addEventListener('click', () => {               // dims: relight from the coals, same river, a weaker flame
  retries++; snd.unlock();
  startFlame = Math.max(0.12, Math.min(0.25, startFlame)); source = 'coals';
  restart(seed);
});
$('fresh').addEventListener('click', () => {               // a chain of one, your name first
  retries = 0; snd.unlock(); prev = null; source = 'new'; startFlame = 1;
  try { const u = new URL(location.href); u.searchParams.delete('flame'); history.replaceState(null, '', u.href); } catch {}
  restart(randSeed());
});
function restart(newSeed) {
  seed = newSeed; s = leg(seed, { flame: startFlame }); target = null; outIndex = -1; dropSpeed = SPEED; handSpeed = SPEED; dropLights = [];
  $('drop').classList.remove('on'); $('hand').classList.remove('on');
  screen = 'arrive'; setupArrival();
}

// ---- input
const GAIN = 0.16;   // metres of steering per CSS px of finger travel, the same in portrait and landscape
let mouseX = null, mouseRun = 0, help = null;
// The steering hint goes for good on the first deliberate steer: a finger that has slid 10 px, a mouse that has moved
// 10 px over the river in play, or a steering key. The touch that takes the flame happens before play, and a thumb held
// down from it never sends another pointerdown, so the hint's own pointerdown listener cannot be what ends it.
function steered() { help?.done(); }
const steer = drag(canvas, {
  playing: () => screen === 'leg' && !paused && !settingsOpen,
  paused: () => paused,
  resume,
  from: () => target ?? s.o,
  travel: dx => { if (Math.abs(dx) > 10) steered(); return dx * GAIN; },
  aim: v => { const hw = s.river.half(s.d) - 1.5; target = Math.max(-hw, Math.min(hw, v)); },
  mouse: e => {
    if (screen !== 'leg') return;
    if (mouseX !== null && (mouseRun += Math.abs(e.clientX - mouseX)) > 10) steered();
    mouseX = e.clientX;
    const c = view.project(cam, s.d, s.river.center(s.d)); const hw = s.river.half(s.d) - 1.5; target = Math.max(-hw, Math.min(hw, (e.clientX - c.x) / (view.k * cam.z)));
  },
  settle: 12,
});
// registered after drag.js, and take() sets the screen at once; a second listener in capture order would race, so
// take() runs from a capture listener that fires before drag.js sees the touch
canvas.addEventListener('pointerdown', e => { if (screen === 'arrive' && !settingsOpen) take(); }, { capture: true });
const keys = new Set();
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if (isPauseKey(e)) { if (screen === 'leg') paused ? resume() : pause(); return; }
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'Enter'].includes(e.code)) {
    if (screen === 'arrive') { take(); e.preventDefault(); }
    if (paused) resume();
    keys.add(e.code);
  }
});
addEventListener('keyup', e => keys.delete(e.code));
function keySteer(dt) {
  if (screen !== 'leg' || paused || taking) return;
  const dir = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  if (!dir) return;
  steered();
  const hw = s.river.half(s.d) - 1.5; target = Math.max(-hw, Math.min(hw, (target ?? s.o) + dir * 32 * dt));
}

// ---- pause
function pause() {
  if (screen !== 'leg' || paused) return;
  paused = true; steer.drop(); snd.hold(); $('paused').classList.add('on');
}
function resume() {
  if (!paused || settingsOpen) return;
  paused = false; snd.release(); $('paused').classList.remove('on');
}
onLeave(pause);

// ---- settings
const drawPanel = set.panel($('opts'), {
  label: id => t(id), name: (id, v) => t(v),
  what: (id, v) => id === 'drop' ? t(v === 'ends' ? 'dropEnds' : 'dropDims') : null,
  onChange: (id, v) => { if (id === 'look') document.body.dataset.look = v; if (id === 'sound' && v === 'on') snd.unlock(); if (id === 'sound' && v === 'off') song?.set({ on: false }); },
});
document.body.dataset.look = set.get('look');
rec.notice($('notice'));
rec.toggle($('rec'));
$('gear').addEventListener('click', () => { settingsOpen = true; pause(); $('settings').classList.add('on'); });
$('close').addEventListener('click', () => { settingsOpen = false; $('settings').classList.remove('on'); });
function langButton() { $('lang').textContent = t('language'); }
$('lang').addEventListener('click', () => {
  setLang(lang() === 'en' ? 'tr' : 'en'); apply(); drawPanel(); langButton(); rec.retext?.();
  if (screen === 'arrive') setupArrivalWords();
  if ($('hand').classList.contains('on')) { showHand(); if (lastHow) { $('status').textContent = t(lastHow === 'shared' ? 'shared' : lastHow === 'copied' ? 'copied' : 'shown'); $('pass').textContent = t('passAgain'); } }
  if ($('drop').classList.contains('on')) showDrop();
});
function setupArrivalWords() {
  const n = prev ? prev.carriers.length : 0;
  $('line1').textContent = source === 'coals' ? t('arriveRetry', { n: fmt(prev ? prev.chain : 1) }) : prev ? t('arrive', { n: fmt(prev.chain), name: prev.carriers[n - 1].name || t('someone'), m: fmt(prev.carriers[n - 1].dist) }) : badLink && !made ? t('arriveBad') : t('arriveNew');
  $('line2').textContent = t('carrier', { n: fmt((prev ? prev.chain : 0) + 1) });
  $('touch').textContent = t(source === 'link' ? 'touch' : source === 'coals' ? 'touchRetry' : 'touchNew');
}
apply(); langButton();
help = hint(canvas, { kind: 'drag', key: 'flame:hint', manual: true, when: () => screen === 'leg' && !taking && !paused && !settingsOpen, played: read(PLAYED_KEY) === '1' });

// ---- test hooks
window.flameState = () => ({ screen, playing: screen === 'leg' && !taking && !paused, flame: Math.round(s.flame * 1000) / 1000, progress: Math.round(s.progress * 1000) / 1000, chain: (prev ? prev.chain : 0) + (screen === 'handoff' ? 1 : 0), carrier: (prev ? prev.chain : 0) + 1, paused, taking, source, link: madeUrl, look: set.get('look'), target });
window.flameSim = () => s;
// for checks: run the leg on without waiting, steering as the last aim says
window.flameWarp = (sec, policy) => { if (screen !== 'leg' || taking || paused) return false; for (let i = 0; i < sec / DT && !s.done; i++) { if (policy) target = policy(s); for (const e of step(s, target)) onEvent(e); } return true; };
window.flameAim = v => { target = v === null ? null : Number(v); };   // for checks: steer as a finger would

// ---- frame
let last = performance.now();
setupArrival();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; T += dt;
  if (screen === 'arrive') arrivalFrame(dt);
  else if (screen === 'leg') { keySteer(dt); legFrame(dt); }
  else if (screen === 'handoff') handoffFrame(dt);
  else if (screen === 'drop') dropFrame(dt);
  soundFrame();
  view.draw({
    look: set.get('look'), t: T, dt: paused ? 0 : dt, sim: s, cam, boat, sam, dock, chain, buoy, jump, top: safeTop,
    wake: screen === 'leg' && !taking, threats: screen === 'leg', ambient: screen === 'arrive' || taking ? 0.55 : screen === 'drop' ? 0.2 : screen === 'handoff' ? 0.3 : 0,
    cue: screen === 'arrive' && !taking && introT > 0.4 ? 1 : 0,
    progress: screen === 'leg' && !taking ? s.progress : null, flameNow: vis, fade,
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
