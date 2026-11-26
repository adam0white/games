// The deeper sheet (2026-11-26). A plate is no longer over when the meter fills: the player rubs at a pace the paper
// likes (deep-sim.js: speed sets pressure, heavy strokes muddy and wear the paper through), and the page asks one more
// thing of each plate, by ?v=:
//   survey (default, also ?v=a)  three finds hidden in the matrix round the specimen; feel for them, bring them up,
//                                 lift the sheet when you are done. Stars: filed, every find, no tears.
//   name   (?v=b)                 the specimen is hidden and unnamed; rub as little as you need, then name it from
//                                 four. Stars for how little of the sheet you touched; a wrong name costs one.
//   craft  (?v=c)                 the print itself: lift when it is good. Stars: filed, crisp (dark ridges on clean
//                                 paper), complete and untorn.
// ?v=classic is the page before this change (main.js). Saves: the old keys keep their formats and are still written
// (unlocks, sound, ink, and a proof when the print would file on the classic page too); the deeper sheet adds
// night-rubbing:deep and night-rubbing:print:<n>.
import { WIDTH, HEIGHT, PROOFS, pigmentByte } from './sim.js';
import { createDeep, press, loadDeep, contrast, deepSpec, pressureAt } from './deep-sim.js';
import { PLATES, kindOf, dailySpec, dayHash } from './plates.js';
import { FINDS, findsFor } from './finds.js';
import { WORDS } from './words.js';
import { read, readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { music } from '../../kit/music.js';
import { feedback } from '../../kit/fx.js';
import { shareImage } from '../../kit/share.js';
import { words } from '../../kit/i18n.js';
import { hint } from '../../kit/hint.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { screens } from '../../kit/screens.js';
import { stick } from '../../kit/stick.js';
import { noZoom } from '../../kit/zoom.js';
import { lab } from '../../kit/lab.js';
import { home } from '../../kit/home.js';

noZoom();
const { t, lang, apply } = words(WORDS);
apply();
const el = id => document.getElementById(id);
const field = el('field'), paper = el('paper'), tool = el('tool');
const ctx = field.getContext('2d', { alpha: false });
const pixels = ctx.createImageData(WIDTH, HEIGHT);
const query = new URLSearchParams(location.search);
const V = { b: 'name', name: 'name', c: 'craft', craft: 'craft' }[query.get('v')] ?? 'survey';
document.body.dataset.v = V;

// ---- Saves ----
const saveKey = 'night-rubbing:save', moreKey = 'night-rubbing:more', deepKey = 'night-rubbing:deep';
const OLD = 6, proofKey = n => 'night-rubbing:proof:' + n, printKey = n => 'night-rubbing:print:' + n;
const prefs = readJson(saveKey, {}), more = readJson(moreKey, {});
const plateNumber = n => Number.isInteger(n) && n >= 1 && n <= PLATES.length;
const oldNumber = n => Number.isInteger(n) && n >= 1 && n <= OLD;
let unlocked = oldNumber(prefs.unlocked) ? prefs.unlocked : 1;
if (plateNumber(more.unlocked)) unlocked = Math.max(unlocked, more.unlocked);
while (unlocked < PLATES.length && read(proofKey(unlocked)) !== null) unlocked++;
function deepSave() {
  const d = readJson(deepKey, null);
  const ok = d && typeof d === 'object' && d.v === 1;
  const part = k => ok && d[k] && typeof d[k] === 'object' ? d[k] : {};
  return { v: 1, survey: part('survey'), name: part('name'), craft: part('craft'), finds: part('finds'), daily: ok && d.daily && typeof d.daily === 'object' ? d.daily : null };
}
let store = deepSave();
for (const way of ['survey', 'name', 'craft']) for (const n of Object.keys(store[way])) if (plateNumber(Number(n) + 1)) unlocked = Math.max(unlocked, Number(n) + 1);
let soundOn = prefs.sound !== false, red = prefs.ink === 'red';
const classicLevel = plateNumber(more.level) && more.level > OLD && more.level <= unlocked && prefs.level === OLD ? more.level
  : oldNumber(prefs.level) && prefs.level <= unlocked ? prefs.level : unlocked;
let plateLevel = classicLevel;

function saveCommon() {
  const other = readJson(saveKey, {}), otherMore = readJson(moreKey, {});
  if (oldNumber(other.unlocked)) unlocked = Math.max(unlocked, other.unlocked);
  if (plateNumber(otherMore.unlocked)) unlocked = Math.max(unlocked, otherMore.unlocked);
  writeJson(saveKey, { level: Math.min(plateLevel, OLD), unlocked: Math.min(unlocked, OLD), sound: soundOn, ink: red ? 'red' : 'black' });
  writeJson(moreKey, { v: 1, level: plateLevel, unlocked });
}
function saveDeep(change) {
  const fresh = deepSave();
  // Merge with what another tab may have written: best stars, every find ever made.
  for (const way of ['survey', 'name', 'craft']) for (const [n, r] of Object.entries(fresh[way])) {
    const mine = store[way][n];
    if (!mine || (Number(r.stars) || 0) > (Number(mine.stars) || 0)) store[way][n] = r;
  }
  store.finds = { ...fresh.finds, ...store.finds };
  if (fresh.daily && (!store.daily || fresh.daily.day > store.daily.day)) store.daily = fresh.daily;
  change?.(store);
  writeJson(deepKey, store);
}

// ---- State ----
let s, mode = 'play', lastMode = 'play', daily = null, lifted = false, wrong = 0, named = false, runOpen = false;
let previous = null, lastTime = 0, speed = 180, keyboardPoint = { x: 120, y: 140 }, skating = 0, firstStroke = true;
let frame = 0, soundAt = -Infinity, buzzAt = -Infinity, shade = null, toastTimer = 0, choices = [];
const show = screens(['paused', 'choose', 'shelf'], next => { el('cabinet').inert = ['paused', 'choose', 'shelf'].includes(next); });
let song = null;
const audio = sound({ on: () => soundOn, setup: ac => {
  try { song = music(ac, { preset: 'flute' }); song.volume(0.28); song.start(s?.seed ?? 1); } catch { song = null; }
} });
const { fx, bump, log: fxLog } = feedback({ canSound: () => soundOn });
const buzz = pattern => { try { if (soundOn && navigator.vibrate) navigator.vibrate(pattern); } catch {} };
const rec = home(lab('night-rubbing'), { back: ['#paused .card', 'header .heading'], lang });
const pad = stick(field, { when: () => mode === 'play', reach: 32, leash: 60, dead: 0 });

const plateSpec = level => ({ ...PLATES[level - 1], ...(PROOFS[level - 1] ?? {}) });
const plate = () => daily ? PLATES.find(p => p.id === daily.spec.plate) : PLATES[s.level - 1];
const kind = () => daily ? daily.spec.kind : kindOf(PLATES[s.level - 1]);
const record = () => daily ? null : store[V][s.level - 1];
const findName = f => t('find.' + f.id);
const today = /^\d{4}-\d{2}-\d{2}$/.test(query.get('date') || '') ? query.get('date') : new Date().toISOString().slice(0, 10);
const dayInfo = () => daily ? { day: daily.day } : {};
const touchedShare = () => s.touchedCount / (WIDTH * HEIGHT);

// Stars for the sheet as it is now: what each way of playing asks.
function starParts() {
  if (V === 'name') {
    if (!named) return [];
    const touched = touchedShare(), base = touched <= 0.12 ? 3 : touched <= 0.25 ? 2 : 1;
    return [{ key: 'named', got: true }, { key: 'light', got: base >= 2 && wrong < 2 }, { key: 'lighter', got: base >= 3 && wrong < 1 }];
  }
  const filed = s.done;
  if (V === 'craft') {
    const crisp = contrast(s) >= (s.glaze ? 0.84 : 0.9);
    return [{ key: 'filed', got: filed }, { key: 'crisp', got: filed && crisp }, { key: 'whole', got: filed && s.coverage >= s.goal + 0.06 && s.tears === 0 }];
  }
  const all = s.found.length > 0 && s.found.every(Boolean);
  return [{ key: 'filed', got: filed }, { key: 'finds', got: filed && all }, { key: 'clean', got: filed && s.tears === 0 && s.smudge <= 12 }];
}
const starsNow = () => starParts().filter(p => p.got).length;
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---- Drawer ----
function thumbnail(canvas, lines, scale = 1) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.save();
  if (scale === 1) { g.scale(canvas.width / 218, canvas.height / 210); g.translate(-11, -35); }
  else { g.translate(canvas.width / 2, canvas.height / 2); g.scale(scale, scale); }
  g.strokeStyle = '#fff'; g.lineJoin = 'round'; g.lineCap = 'round';
  for (const line of lines) {
    g.beginPath();
    line.points.forEach((point, i) => i ? g.lineTo(...point) : g.moveTo(...point));
    g.lineWidth = scale === 1 ? line.width + 0.9 : line.width * 0.55 + 0.35;
    g.stroke();
  }
  g.restore();
  return canvas;
}
const maskOf = canvas => 'url(' + canvas.toDataURL() + ') center/contain no-repeat';
function silhouette(lines, scale) {
  const span = document.createElement('span');
  span.className = 'silhouette';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const mask = maskOf(thumbnail(canvas, lines, scale));
  span.style.webkitMask = mask; span.style.mask = mask;
  return span;
}
const mystery = () => { const span = document.createElement('span'); span.className = 'mystery'; span.textContent = '?'; return span; };
for (const [index, p] of PLATES.entries()) {
  const button = document.createElement('button');
  button.dataset.kind = kindOf(p);
  button.onclick = () => { if (mode === 'play' && (daily || s.level !== index + 1)) open(index + 1); };
  el('collection').append(button);
}
function drawer() {
  for (const [i, button] of Array.from(el('collection').children).entries()) {
    const r = store[V][i], n = r ? Number(r.stars) || 0 : 0;
    // In name, a plate's shape is hidden in the drawer until it has been named.
    const hidden = V === 'name' && !r;
    if (button.dataset.face !== String(hidden)) { button.replaceChildren(hidden ? mystery() : silhouette(PLATES[i].lines)); button.dataset.face = String(hidden); }
    button.disabled = i + 1 > unlocked;
    button.setAttribute('aria-current', String(!daily && i + 1 === s.level));
    button.dataset.stars = n ? starText(n) : '';
    const name = hidden ? '?' : t('plate.' + PLATES[i].id);
    button.setAttribute('aria-label', n ? t('plateStars', { n: i + 1, name, stars: n }) : t('plateLabel', { n: i + 1, name }));
  }
  el('daily').setAttribute('aria-current', String(!!daily));
  el('daily').dataset.done = store.daily?.day === today && store.daily?.stars ? starText(store.daily.stars) : '';
}

// ---- Opening a plate ----
function begin(sheet) {
  runEnd('quit');
  s = sheet;
  lifted = false; named = false; wrong = 0; skating = 0; previous = null; firstStroke = true;
  keyboardPoint = { x: 120, y: 140 };
  shade = shading(s);
  tool.style.removeProperty('left'); tool.style.removeProperty('top');
  try { song?.start(s.seed); } catch { song = null; }
}
// Light on the paper: the specimen shows through as a faint emboss (not in name); finds never do.
function shading(sheet, reveal = V !== 'name') {
  const out = new Float32Array(WIDTH * HEIGHT);
  if (!reveal) return out;
  const m = sheet.main;
  for (let i = WIDTH + 1; i < out.length - WIDTH - 1; i++) {
    const sx = (m[i + 1] - m[i - 1]) / 2, sy = (m[i + WIDTH] - m[i - WIDTH]) / 2;
    out[i] = (sx * 0.85 + sy) * 45 - m[i] * 4;
  }
  return out;
}
function loadPrint(level) {
  for (const key of [printKey(level), proofKey(level)]) {
    const proof = readJson(key, null);
    if (!proof || typeof proof.marks !== 'string') continue;
    if (key === printKey(level) && proof.v !== V) continue;
    try {
      const bytes = atob(proof.marks);
      if (bytes.length !== s.pigment.length) continue;
      loadDeep(s, bytes);
      if (Number.isFinite(proof.distance)) s.distance = proof.distance;
      return { red: proof.red === true };
    } catch {}
  }
  return null;
}
function open(level, fresh = false) {
  daily = null;
  plateLevel = level;
  begin(createDeep(deepSpec(plateSpec(level)), 19023 + level * 583, level, V === 'survey' ? findsFor(level) : []));
  const r = store[V][level - 1];
  const print = fresh ? null : loadPrint(level);
  if (print && r && V !== 'name') lifted = true;
  displayRed = print ? print.red : red;
  setMode('play');
  saveCommon();
}
function openDaily() {
  const spec = dailySpec(today);
  daily = { day: today, spec };
  const hash = dayHash(today);
  begin(createDeep(deepSpec(spec), spec.seed, 0, V === 'survey' ? findsFor(hash % PLATES.length + 1) : []));
  displayRed = red;
  setMode('play');
  fx('daily', null, () => bump('#daily'));
}
let displayRed = red;

// ---- Painting ----
const stockColor = [238, 227, 197], gritColor = [214, 207, 188], hole = [24, 52, 44];
function paint() {
  const { tooth, pigment, stone, wear, torn } = s;
  const ink = displayRed ? [148, 66, 39] : [42, 54, 57];
  const d = pixels.data;
  for (let i = 0, at = 0; i < pigment.length; i++, at += 4) {
    if (torn[i]) { d[at] = hole[0]; d[at + 1] = hole[1]; d[at + 2] = hole[2]; d[at + 3] = 255; continue; }
    const x = i % WIDTH, y = (i / WIDTH) | 0;
    const edge = Math.min(1, x / 9, (WIDTH - 1 - x) / 9, y / 9, (HEIGHT - 1 - y) / 9);
    // A lamp from the upper left: the paper's tooth, the emboss, and a sheen where the paper is wearing thin.
    const light = (tooth[i] - 0.5) * 8 + shade[i] + Math.min(1, wear[i]) ** 2 * 26;
    const density = Math.min(1, pigment[i] * 1.27);
    const base = stone && stone[i] && V !== 'name' ? gritColor : stockColor;
    for (let c = 0; c < 3; c++) d[at + c] = base[c] + edge * ((1 - density) * light + (ink[c] - base[c]) * density);
    d[at + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
}
function requestPaint() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; paint(); });
}

// ---- The page around the sheet ----
function findSlots() {
  const box = el('finds');
  box.hidden = V !== 'survey';
  if (V !== 'survey') return;
  if (box.childElementCount !== s.finds.length) {
    box.replaceChildren(...s.finds.map(() => document.createElement('i')));
  }
  s.finds.forEach((f, k) => {
    const slot = box.children[k], got = s.found[k];
    if (slot.dataset.got === String(got)) return;
    slot.dataset.got = String(got);
    slot.replaceChildren(got ? silhouette(FINDS.find(x => x.id === f.id).lines, 3.2) : document.createTextNode('?'));
  });
  box.setAttribute('aria-label', t('findsLabel', { n: s.found.filter(Boolean).length, of: s.finds.length }));
}
function statusText() {
  const k = kind();
  if (lifted) {
    if (V === 'name') return plateNameText();
    const got = starsNow();
    return starText(got) + ' · ' + plateNameText();
  }
  if (V === 'name') return s.distance ? t('deep.probe') : t('deep.start.name');
  if (s.done) return V === 'survey' && !s.found.every(Boolean) ? t('deep.filed.survey') : t('deep.filed');
  if (!s.distance) return k === 'free' || k === 'lead' ? t('deep.start') : t('start.' + k);
  return t('going');
}
function plateNameText() { return t('plate.' + plate().id); }
function setMode(next) {
  const opening = next === 'paused' && mode !== 'paused';
  if (next !== 'play') { previous = null; pad.drop(); tool.classList.remove('drawing'); }
  mode = next;
  show(next);
  const p = plate(), k = kind();
  const hideName = V === 'name' && !lifted;
  el('figure').textContent = (daily ? t('dailyFigure') : t('figure', { n: String(s.level).padStart(2, '0') }))
    + (lifted && V !== 'name' ? '' : lifted ? ' · ' + starText(starsNow()) : '');
  el('kind').textContent = { free: '', lead: '', glaze: '✧', stone: '⁘', 'glaze-stone': '✧⁘' }[k];
  el('taxon').textContent = hideName ? '?' : p.taxon;
  el('medium').textContent = hideName ? '' : t('age.' + p.age);
  el('status').textContent = statusText();
  el('status').classList.toggle('long', !lifted);
  const percent = Math.min(100, Math.floor(s.coverage / s.goal * 100));
  el('percent').hidden = lifted || V === 'name';
  el('percent').textContent = t('percent', { n: percent });
  el('fill').style.width = (V === 'name' ? Math.min(100, touchedShare() * 100 / 0.25) : percent) + '%';
  el('fill').classList.toggle('touch', V === 'name');
  // The one button by the status: lift the sheet (survey, craft) once filed, name it (name), then the next plate.
  const action = lifted ? 'next' : V === 'name' ? (s.distance ? 'name' : null) : s.done ? 'lift' : null;
  el('result').classList.toggle('on', !!action);
  el('next').dataset.action = action ?? '';
  el('next').firstChild.textContent = (action === 'lift' ? t('deep.lift') : action === 'name' ? t('deep.name')
    : daily || s.level === PLATES.length ? t('again') : t('next')) + ' ';
  el('next').querySelector('b').textContent = action === 'lift' ? '↑' : action === 'name' ? '?' : daily || s.level === PLATES.length ? '↺' : '→';
  el('share').hidden = !lifted;
  el('lead').hidden = true; el('rule').hidden = V === 'survey';
  el('smudge').hidden = !s.stone || V === 'name';
  if (s.stone) el('smudge').style.setProperty('--smudge', Math.min(1, s.smudge / 12));
  paper.classList.toggle('glaze', s.glaze);
  paper.classList.remove('spoiled');
  paper.classList.toggle('unused', s.distance === 0 && next === 'play' && !lifted);
  tool.hidden = false;
  tool.querySelector('span').textContent = displayRed ? 'R' : '6B';
  el('sound').textContent = soundOn ? t('soundOn') : t('soundOff');
  el('ink').textContent = red ? t('red') : t('graphite');
  el('tip').textContent = t('deep.tip.' + V);
  el('tip').hidden = false;
  findSlots();
  drawer();
  mood();
  if (opening) el('resume').focus({ preventScroll: true });
  requestPaint();
}
function mood() {
  if (!song) return;
  try { song.set({ on: soundOn && mode === 'play' && !lifted, progress: Math.min(1, s.coverage / s.goal), light: 1, danger: Math.min(1, s.tears / 30) }); } catch { song = null; }
}
function toast(text, lines) {
  const box = el('found');
  box.replaceChildren();
  if (lines) box.append(silhouette(lines, 3.2));
  const words = document.createElement('span');
  words.textContent = text;
  box.append(words);
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('on'), 2600);
}

// ---- Runs ----
function runBegin() {
  if (runOpen || lifted) return;
  runOpen = true;
  rec.start({ level: s.level, v: V, red: displayRed, kind: kind(), ...dayInfo() });
}
function runEnd(outcome) {
  if (!runOpen) return;
  runOpen = false;
  rec.end(outcome, { level: s.level, v: V, coverage: Math.min(100, Math.floor(s.coverage / s.goal * 100)), ink: Math.round(s.coverage * 100),
    distance: Math.round(s.distance), seconds: Math.round(s.time * 10) / 10, unlocked, kind: kind(), stars: starsNow(),
    finds: s.found.filter(Boolean).length, tears: s.tears, smudge: s.smudge, touched: Math.round(touchedShare() * 100), wrong, ...dayInfo() });
}

// ---- Rubbing ----
function stroke(a, b, pace) {
  if (mode !== 'play') return;
  if (lifted && V === 'name') return;
  const before = s.distance, wasDone = s.done;
  const out = press(s, a.x, a.y, b.x, b.y, pace);
  if (s.distance === before) return;
  if (before === 0 && !lifted) { runBegin(); paper.classList.remove('unused'); }
  moveTool(b, pace);
  const now = performance.now(), P = pressureAt(pace);
  if (now - soundAt > 85) {
    // The rub: a soft hiss, brighter and louder when the crayon presses, thin when it skates.
    audio.noise(0.085, 0.012 + 0.028 * Math.min(1, P), 500 + 900 * Math.min(1, P) + 400 * Math.min(1, Math.hypot(b.x - a.x, b.y - a.y) / 12));
    soundAt = now;
  }
  if (out.bumps && now - buzzAt > 45) {
    // Feel the relief: a tick under the finger where the crayon rides up onto a ridge.
    buzz(P > 0.5 ? 6 : 3);
    if (soundOn && out.bumps) audio.tone(1500 + 400 * Math.random(), 0.012, 0.012 * Math.min(1, P + 0.2), 'square');
    buzzAt = now;
  }
  // Scribbling skates: say so once the crayon has skated a sheet's width, then not again until it has pressed.
  if (P < 0.25) {
    skating += Math.hypot(b.x - a.x, b.y - a.y);
    if (skating > 200 && skating < 1e6) { el('status').textContent = t('deep.skate'); skating = 1e6; fx('skate', null, () => bump('#status')); }
  } else if (P > 0.6 && skating) { skating = 0; if (!lifted) el('status').textContent = statusText(); }
  if (out.tore) {
    fx('tear', () => audio.noise(0.16, 0.06, 2600), () => bump('#paper'));
    buzz([12, 30, 12]);
    if (s.tears === out.tore) { el('status').textContent = t('deep.tore'); rec.event('tear', { level: s.level, ...dayInfo() }); }
  }
  for (const f of out.found) {
    const find = FINDS.find(x => x.id === s.finds[f].id);
    fx('find', () => { audio.tone(784, 0.18, 0.06, 'triangle'); setTimeout(() => audio.tone(1175, 0.22, 0.05, 'triangle'), 120); }, () => bump('#finds'));
    buzz([18, 40, 24]);
    toast(t('deep.found', { name: findName(find) }) + ' · ' + find.taxon, find.lines);
    rec.event('find', { level: s.level, find: find.id, ...dayInfo() });
    if (!store.finds[find.id]) saveDeep(d => { d.finds[find.id] = { plate: daily ? 0 : s.level, day: today }; });
    findSlots();
  }
  if (!wasDone && s.done && !lifted && V !== 'name') {
    fx('filed', () => { audio.tone(392, 0.24, 0.07, 'sine', 132); setTimeout(() => audio.tone(587, 0.2, 0.05, 'triangle'), 160); }, () => bump('#next'));
    buzz(20);
    rec.event('plate-filed', { level: s.level, v: V, ...dayInfo() });
    setMode('play');
    return;
  }
  if (!lifted) {
    if ((before === 0 || out.found.length) && !out.tore && !skating) el('status').textContent = statusText();
    const percent = Math.min(99, Math.floor(s.coverage / s.goal * 100));
    if (V !== 'name') { el('percent').textContent = t('percent', { n: s.done ? 100 : percent }); el('fill').style.width = (s.done ? 100 : percent) + '%'; }
    else { el('fill').style.width = Math.min(100, touchedShare() * 100 / 0.25) + '%'; if (before === 0) setMode('play'); }
    if (V === 'survey' && el('smudge') && s.stone) el('smudge').style.setProperty('--smudge', Math.min(1, s.smudge / 12));
    mood();
  }
  requestPaint();
}
function moveTool(p, pace) {
  tool.classList.add('drawing');
  tool.classList.toggle('skate', pressureAt(pace) < 0.3);
  tool.classList.toggle('firm', pressureAt(pace) > 0.95);
  tool.style.left = ((p.x / WIDTH) * 100 + 3) + '%';
  tool.style.top = (8 + p.y / 326 * 100) + '%';
}
function point(e) {
  const rect = field.getBoundingClientRect();
  return { x: Math.max(0, Math.min(WIDTH, (e.clientX - rect.left) * WIDTH / rect.width)),
    y: Math.max(0, Math.min(HEIGHT, (e.clientY - rect.top) * HEIGHT / rect.height)) };
}
field.addEventListener('pointerdown', e => {
  if (mode !== 'play' || pad.touch?.id !== e.pointerId) return;
  previous = point(e);
  lastTime = e.timeStamp;
  speed = 180;
  keyboardPoint = previous;
  audio.unlock();
});
function pointerStroke(e) {
  if (!previous || mode !== 'play' || pad.touch?.id !== e.pointerId) return;
  const p = point(e), dist = Math.hypot(p.x - previous.x, p.y - previous.y);
  if (!dist) return;
  // Speed in sheet units a second, smoothed over about 70 ms (a frame of touch events can arrive bunched).
  const dt = Math.max(1 / 240, (e.timeStamp - lastTime) / 1000);
  lastTime = e.timeStamp;
  const k = 1 - Math.exp(-dt / 0.07);
  speed += (dist / dt - speed) * k;
  stroke(previous, p, speed);
  previous = p;
  keyboardPoint = p;
}
field.addEventListener('pointermove', pointerStroke);
field.addEventListener('pointerup', pointerStroke, true);
function liftTool() {
  previous = null;
  savePrint();
  tool.classList.remove('drawing', 'skate', 'firm');
  tool.style.removeProperty('left'); tool.style.removeProperty('top');
}
function release(e) { if (pad.touch && pad.touch.id !== e.pointerId) return; liftTool(); }
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) field.addEventListener(type, release);
addEventListener('resize', () => { if (!previous) return; pad.drop(); liftTool(); });

// ---- Finishing a plate ----
function savePrint() {
  if (daily || !lifted || V === 'name') return;
  const bytes = Uint8Array.from(s.pigment, pigmentByte);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 4096) binary += String.fromCharCode(...bytes.subarray(i, i + 4096));
  const proof = { grain: s.seed, marks: btoa(binary), coverage: s.coverage, distance: s.distance, red: displayRed };
  writeJson(printKey(s.level), { ...proof, v: V });
  // The classic page (and the small games' home) read the old proof: write one when it would file there too.
  if (read(proofKey(s.level)) === null && s.coverage >= plateSpec(s.level).goal) writeJson(proofKey(s.level), proof);
}
function finish() {
  lifted = true;
  const got = starsNow(), parts = starParts();
  if (daily) saveDeep(d => {
    const was = d.daily?.day === today ? d.daily : { day: today, stars: 0, tries: 0 };
    d.daily = { day: today, v: V, stars: Math.max(was.stars || 0, got), tries: (was.tries || 0) + 1 };
  });
  else {
    unlocked = Math.max(unlocked, Math.min(PLATES.length, s.level + 1));
    saveDeep(d => {
      const was = d[V][s.level - 1];
      if (!was || got >= (Number(was.stars) || 0)) d[V][s.level - 1] = { stars: got, finds: s.finds.filter((_, k) => s.found[k]).map(f => f.id), tears: s.tears };
    });
    savePrint();
    saveCommon();
  }
  fx('lifted', () => {
    audio.tone(392, 0.24, 0.075, 'sine', 132);
    for (let n = 0; n < got; n++) setTimeout(() => audio.tone(523 * 1.26 ** n, 0.16, 0.05, 'triangle'), 180 + 150 * n);
  }, () => bump('#figure'));
  buzz([20, 50, 20, 50, 40]);
  toast(parts.map(p => (p.got ? '★ ' : '☆ ') + t('star.' + p.key)).join('  '));
  runEnd('won');
  setMode('play');
}

// ---- Naming (name) ----
function openChoices() {
  const right = plate();
  let n = (s.seed ^ 0x2545f491 ^ wrong) >>> 0;
  const random = () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
  if (!choices.length || choices.correct !== right.id) {
    const others = PLATES.filter(p => p.id !== right.id).sort(() => random() - 0.5).slice(0, 3);
    choices = [right, ...others].sort(() => random() - 0.5);
    choices.correct = right.id;
    choices.out = new Set();
  }
  el('choose-title').textContent = t('deep.chooseTitle');
  el('choose-text').textContent = t('deep.chooseText', { n: Math.round(touchedShare() * 100) });
  el('choose-back').textContent = t('deep.keepRubbing');
  el('choices').replaceChildren(...choices.map(p => {
    const b = document.createElement('button');
    b.append(silhouette(p.lines));
    const label = document.createElement('span');
    label.textContent = t('plate.' + p.id);
    b.append(label);
    b.disabled = choices.out.has(p.id);
    b.onclick = () => pick(p);
    return b;
  }));
  setMode('choose');
  el('choices').firstElementChild?.focus({ preventScroll: true });
}
function pick(p) {
  if (p.id === choices.correct) {
    named = true;
    rec.event('named', { level: s.level, right: true, wrong, touched: Math.round(touchedShare() * 100), ...dayInfo() });
    choices = [];
    shade = shading(s, true);
    finish();
    return;
  }
  wrong++;
  choices.out.add(p.id);
  rec.event('named', { level: s.level, right: false, wrong, ...dayInfo() });
  fx('wrong', () => audio.tone(150, 0.3, 0.06, 'sawtooth', 110), () => bump('#choices'));
  buzz(60);
  openChoices();
}

// ---- The cabinet of finds ----
function openShelf() {
  const got = Object.keys(store.finds).filter(id => FINDS.some(f => f.id === id));
  el('shelf-title').textContent = t('deep.shelfTitle');
  el('shelf-text').textContent = t('deep.shelfText', { n: got.length, of: FINDS.length });
  el('shelf-close').textContent = t('resume');
  el('shelf-grid').replaceChildren(...FINDS.map(f => {
    const cell = document.createElement('div');
    const have = !!store.finds[f.id];
    cell.className = have ? 'have' : '';
    cell.append(have ? silhouette(f.lines, 3.2) : mystery());
    const label = document.createElement('span');
    label.textContent = have ? findName(f) : '—';
    cell.append(label);
    if (have) cell.title = f.taxon;
    return cell;
  }));
  lastMode = mode;
  setMode('shelf');
  el('shelf-close').focus({ preventScroll: true });
}

// ---- Controls ----
function pause() {
  if (mode === 'paused') return;
  lastMode = mode === 'play' ? 'play' : lastMode;
  savePrint();
  audio.hold();
  setMode('paused');
}
function resume() { audio.release(); setMode('play'); field.focus({ preventScroll: true }); }
const again = () => daily ? openDaily() : open(s.level, true);
el('pause').onclick = pause;
el('resume').onclick = resume;
el('restart').onclick = () => { audio.release(); again(); };
el('sound').onclick = () => { soundOn = !soundOn; saveCommon(); setMode('paused'); };
el('ink').onclick = () => { red = !red; if (!lifted) displayRed = red; saveCommon(); setMode('paused'); };
el('next').onclick = () => {
  const action = el('next').dataset.action;
  fx('next-' + action, null, () => bump('#next'));
  if (action === 'lift') finish();
  else if (action === 'name') openChoices();
  else if (action === 'next') { if (daily || s.level === PLATES.length) again(); else open(s.level + 1); }
};
el('choose-back').onclick = () => { setMode('play'); field.focus({ preventScroll: true }); };
el('shelf-open').hidden = false;
el('shelf-open').onclick = () => { if (mode === 'play') openShelf(); };
el('shelf-close').onclick = () => { setMode('play'); field.focus({ preventScroll: true }); };
el('daily').onclick = () => { if (mode === 'play') openDaily(); };
el('daily').querySelector('span').textContent = String(Number(today.slice(8)));
el('daily').setAttribute('aria-label', t('dailyLabel', { day: today }));

function sharePicture() {
  const scale = 2, margin = 28, width = WIDTH * scale + margin * 2, height = HEIGHT * scale + margin * 2 + 86;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = '#eee3c5'; g.fillRect(0, 0, width, height);
  g.drawImage(field, margin, margin, WIDTH * scale, HEIGHT * scale);
  g.fillStyle = '#2a3639'; g.font = '600 30px Baskerville, Georgia, serif';
  g.fillText(plateNameText(), margin, HEIGHT * scale + margin + 42);
  g.font = '26px Georgia, serif'; g.fillStyle = '#924b30';
  g.fillText(starText(starsNow()) + '  Carbon Cabinet' + (daily ? ' · ' + daily.day : ''), margin, HEIGHT * scale + margin + 78);
  return canvas;
}
el('share').onclick = async () => {
  const name = plateNameText(), stars = starText(starsNow());
  const text = V === 'survey' ? t('deep.share.survey', { name, stars, n: s.found.filter(Boolean).length, of: s.finds.length })
    : V === 'name' ? t('deep.share.name', { name, stars, n: Math.round(touchedShare() * 100) }) : t('shareFree', { name, stars });
  fx('share', null, () => bump('#share'));
  const how = await shareImage(sharePicture(), { name: 'carbon-cabinet.png', text: daily ? text + ' · ' + daily.day : text });
  rec.event('shared', { level: s.level, how, ...dayInfo() });
};
onLeave(pause);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { e.preventDefault(); if (mode === 'paused') resume(); else if (mode === 'play') pause(); else setMode('play'); return; }
  const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
  if (!delta || mode !== 'play' || ![field, document.body].includes(document.activeElement)) return;
  e.preventDefault();
  const p = { x: Math.max(0, Math.min(WIDTH, keyboardPoint.x + delta[0])), y: Math.max(0, Math.min(HEIGHT, keyboardPoint.y + delta[1])) };
  stroke(keyboardPoint, p, 200);
  keyboardPoint = p;
});
addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) savePrint(); });

hint(field, { kind: 'drag', key: 'night-rubbing:hint', when: () => mode === 'play', played: unlocked > 1, delay: 2200, reach: 38, label: t('deep.hint') });
rec.notice(el('cabinet'));
rec.toggle(el('paused').firstElementChild);
window.rubbingState = () => ({ screen: mode, v: V, level: s.level, unlocked, sound: soundOn, coverage: s.coverage, goal: s.goal,
  distance: s.distance, time: s.time, kind: kind(), lifted, named, wrong, tears: s.tears, smudge: s.smudge, stars: starsNow(),
  finds: s.finds.map((f, k) => ({ id: f.id, x: f.x, y: f.y, found: s.found[k] })), touched: touchedShare(),
  daily: daily ? daily.day : null, store: JSON.parse(JSON.stringify(store)), fx: fxLog(), lang: lang() });
open(plateLevel);
