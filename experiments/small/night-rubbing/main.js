import { createPlate, createSheet, rub, stars as starsOf, pigmentByte, loadPigment, WIDTH, HEIGHT } from './sim.js';
import { PLATES, kindOf, dailySpec } from './plates.js';
import { rate } from './plan.js';
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

// Saves. night-rubbing:save keeps its old format and stays within plates 1 to 6, so a tab still open on the old
// page reads it as before. Plates 7 on, stars and the daily plate have their own keys (2026-11-25).
const saveKey = 'night-rubbing:save', moreKey = 'night-rubbing:more', starsKey = 'night-rubbing:stars', dailyKey = 'night-rubbing:daily';
const OLD = 6;
const proofKey = level => 'night-rubbing:proof:' + level;
const prefs = readJson(saveKey, {}), more = readJson(moreKey, {});
const plateNumber = n => Number.isInteger(n) && n >= 1 && n <= PLATES.length;
const oldNumber = n => Number.isInteger(n) && n >= 1 && n <= OLD;
let unlocked = oldNumber(prefs.unlocked) ? prefs.unlocked : 1;
if (plateNumber(more.unlocked)) unlocked = Math.max(unlocked, more.unlocked);
// The old page could not unlock past plate 6; a filed plate opens the next one.
while (unlocked < PLATES.length && read(proofKey(unlocked)) !== null) unlocked++;
const best = (() => { const b = readJson(starsKey, {})?.best; return b && typeof b === 'object' ? { ...b } : {}; })();
let soundOn = prefs.sound !== false, red = prefs.ink === 'red';
let s, mode, previous, keyboardPoint, dirty = false, frame = 0, soundAt = -Infinity;
let lastMode = 'play', proofDirty = false, displayRed = red, plateLevel = 1, daily = null, filedNow = 0, ticked = 0;
const sessionProofs = new Map();
const show = screens(['paused', 'result'], next => {
  mode = next;
  el('cabinet').inert = mode === 'paused';
});
let song = null;
const audio = sound({ on: () => soundOn, setup: ac => {
  try { song = music(ac, { preset: 'flute' }); song.volume(0.32); song.start(s?.seed ?? 1); } catch { song = null; }
} });
const { fx, bump, log: fxLog } = feedback({ canSound: () => soundOn });
// Play recording for the game lab (kit/lab.js): one run for each plate the player starts to rub, the daily plate too.
// Opened from the small games' home (?from=small): a way back on the pause card and under the title.
const rec = home(lab('night-rubbing'), { back: ['#paused .card', 'header .heading'], lang });
let runOpen = false;
const kind = () => daily ? daily.spec.kind : kindOf(PLATES[s.level - 1]);
const leftOfStick = () => Number.isFinite(s.lead) ? Math.max(0, 1 - (s.filedAt ?? s.distance) / s.lead) : 1;
const dayInfo = () => daily ? { day: daily.day } : {};
function runBegin() { if (runOpen || s.done) return; runOpen = true; rec.start({ level: s.level, red: displayRed, kind: kind(), ...dayInfo() }); }
function runEnd(outcome) {
  if (!runOpen) return;
  runOpen = false;
  rec.end(outcome, { level: s.level, coverage: Math.round(s.coverage / s.goal * 100), distance: Math.round(s.distance), unlocked,
    kind: kind(), stars: starsOf(s), stick: Math.round(leftOfStick() * 100), smudge: s.smudge, ...dayInfo() });
}
const pad = stick(field, { when: () => mode !== 'paused', reach: 32, leash: 60, dead: 0 });

function save() {
  const other = readJson(saveKey, {}), otherMore = readJson(moreKey, {});
  if (oldNumber(other.unlocked)) unlocked = Math.max(unlocked, other.unlocked);
  if (plateNumber(otherMore.unlocked)) unlocked = Math.max(unlocked, otherMore.unlocked);
  writeJson(saveKey, { level: Math.min(plateLevel, OLD), unlocked: Math.min(unlocked, OLD), sound: soundOn, ink: red ? 'red' : 'black' });
  writeJson(moreKey, { v: 1, level: plateLevel, unlocked });
}
function saveStars(level, got) {
  const stored = readJson(starsKey, {})?.best;
  if (stored && typeof stored === 'object') for (const [k, v] of Object.entries(stored)) best[k] = Math.max(best[k] || 0, Number(v) || 0);
  best[level] = Math.max(best[level] || 0, got);
  writeJson(starsKey, { v: 1, best });
}

// The daily plate: chosen by the date (UTC), or ?date=YYYY-MM-DD. Its best result is kept for the day; its
// pigment is not (one stored print a day would fill the phone's storage).
const query = new URLSearchParams(location.search);
const today = /^\d{4}-\d{2}-\d{2}$/.test(query.get('date') || '') ? query.get('date') : new Date().toISOString().slice(0, 10);
function dailyRecord() {
  const saved = readJson(dailyKey, null);
  return saved && saved.day === today ? saved : { v: 1, day: today, stars: 0, distance: null, tries: 0 };
}
let dailyPlate = null;
function dailyPlateSpec() {
  if (dailyPlate) return dailyPlate;
  const spec = dailySpec(today);
  const rating = rate(spec, spec.seed, createSheet) || { par: Infinity, lead: Infinity };
  return (dailyPlate = { ...spec, par: rating.par, lead: rating.lead });
}

// Keep the actual pigment of a finished sheet. Each proof has its own key so
// filing a later print cannot overwrite an earlier print in another tab.
function fileProof() {
  if (!proofDirty || daily) return;
  const bytes = Uint8Array.from(s.pigment, pigmentByte);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 4096) binary += String.fromCharCode(...bytes.subarray(i, i + 4096));
  const proof = { grain: s.seed, marks: btoa(binary), coverage: s.coverage, distance: s.distance, red: displayRed };
  sessionProofs.set(s.level, proof);
  writeJson(proofKey(s.level), proof);
  proofDirty = false;
}
function restore(proof) {
  if (!proof || !Number.isFinite(proof.distance) || !(proof.coverage >= s.goal && proof.coverage <= 1)) return false;
  try {
    const bytes = atob(proof.marks);
    if (bytes.length !== s.pigment.length) return false;
    loadPigment(s, bytes);
  } catch { return false; }
  s.distance = proof.distance;
  return s.done;
}

function thumbnail(canvas, plate) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.save();
  g.scale(canvas.width / 218, canvas.height / 210);
  g.translate(-11, -35);
  g.strokeStyle = '#fff';
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const line of plate.lines) {
    g.beginPath();
    for (const [i, point] of line.points.entries()) {
      if (i === 0) g.moveTo(...point);
      else g.lineTo(...point);
    }
    g.lineWidth = line.width + 0.9;
    g.stroke();
  }
  g.restore();
}
for (const [index, plate] of PLATES.entries()) {
  const button = document.createElement('button');
  const miniature = document.createElement('canvas');
  miniature.width = 96; miniature.height = 96;
  thumbnail(miniature, plate);
  // Turn the alpha engraving into an ink mask, coloured by the drawer button.
  const silhouette = document.createElement('span');
  silhouette.className = 'silhouette';
  const mask = 'url(' + miniature.toDataURL() + ') center/contain no-repeat';
  silhouette.style.webkitMask = mask;
  silhouette.style.mask = mask;
  button.append(silhouette);
  button.dataset.kind = kindOf(plate);
  button.onclick = () => { if (daily || s.level !== index + 1) open(index + 1); };
  el('collection').append(button);
}
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const plateName = () => t('plate.' + (daily ? daily.spec.plate : PLATES[s.level - 1].id));
const shownStars = () => s.done ? (starsOf(s) || (daily ? dailyRecord().stars : best[s.level]) || 0) : 0;

function setMode(next, keepStroke = false) {
  const openingPause = next === 'paused' && mode !== 'paused';
  if (!keepStroke) {
    previous = null;
    pad.drop();
  }
  tool.classList.remove('drawing');
  show(next);
  const finished = s.done, spoiled = !!s.spoiled, plate = daily ? PLATES.find(p => p.id === daily.spec.plate) : PLATES[s.level - 1];
  const percent = Math.min(100, Math.floor(s.coverage / s.goal * 100)), k = kind(), got = shownStars();
  el('figure').textContent = (daily ? t('dailyFigure') : t('figure', { n: String(s.level).padStart(2, '0') }))
    + (finished ? ' · ' + (got ? starText(got) : t('filed')) : '');
  el('kind').textContent = { free: '', lead: '✎', glaze: '✎✧', stone: '✎⁘', 'glaze-stone': '✎✧⁘' }[k];
  el('taxon').textContent = plate.taxon;
  el('medium').textContent = t('age.' + plate.age);
  el('status').textContent = spoiled ? t('spoiled.' + s.spoiled) : finished ? plateName()
    : s.distance ? t('going') : k === 'free' ? t('start') : t('start.' + k);
  el('status').classList.toggle('long', !finished && !spoiled && !s.distance && k !== 'free');
  el('percent').hidden = finished || spoiled;
  el('percent').textContent = t('percent', { n: percent });
  el('fill').style.width = percent + '%';
  el('next').firstChild.textContent = (spoiled ? t('retry') : daily || s.level === PLATES.length ? t('again') : t('next')) + ' ';
  el('next').querySelector('b').textContent = spoiled || daily || s.level === PLATES.length ? '↺' : '→';
  el('share').hidden = !finished || spoiled;
  paper.classList.toggle('glaze', s.glaze);
  paper.classList.toggle('spoiled', spoiled);
  meters();
  for (const [i, button] of Array.from(el('collection').children).entries()) {
    const n = best[i + 1] || 0;
    button.disabled = i + 1 > unlocked;
    button.setAttribute('aria-current', String(!daily && i + 1 === s.level));
    button.dataset.stars = n ? starText(n) : '';
    button.setAttribute('aria-label', n ? t('plateStars', { n: i + 1, name: t('plate.' + PLATES[i].id), stars: n })
      : t('plateLabel', { n: i + 1, name: t('plate.' + PLATES[i].id) }));
  }
  const record = dailyRecord();
  el('daily').setAttribute('aria-current', String(!!daily));
  el('daily').dataset.done = record.stars ? starText(record.stars) : '';
  el('sound').textContent = soundOn ? t('soundOn') : t('soundOff');
  el('ink').textContent = red ? t('red') : t('graphite');
  el('tip').textContent = k === 'free' ? '' : t('tip.' + (k === 'glaze-stone' ? 'glaze' : k === 'stone' ? 'stone' : k === 'glaze' ? 'glaze' : 'lead'));
  el('tip').hidden = k === 'free';
  tool.querySelector('span').textContent = red ? 'R' : '6B';
  paper.classList.toggle('unused', s.distance === 0 && next === 'play');
  tool.hidden = finished || spoiled;
  mood();
  if (openingPause) el('resume').focus({ preventScroll: true });
  requestPaint();
}

// The stick's length (lead plates), the grit smudged (stone plates).
function meters() {
  const left = leftOfStick(), limited = Number.isFinite(s.lead);
  el('lead').hidden = !limited;
  el('rule').hidden = limited;
  el('lead').style.setProperty('--left', left);
  el('lead').setAttribute('aria-label', t('stick', { n: Math.round(left * 100) }));
  el('lead').classList.toggle('low', limited && left < 0.25 && !s.done);
  // Past par the stick turns from three stars to two, and later to one.
  el('lead').style.setProperty('--par', limited ? Math.max(0, 1 - s.par / s.lead) : 0);
  tool.style.setProperty('--stick', limited ? 0.3 + 0.7 * left : 1);
  const stone = Number.isFinite(s.smudgeLimit);
  el('smudge').hidden = !stone;
  if (stone) {
    el('smudge').style.setProperty('--smudge', Math.min(1, s.smudge / s.smudgeLimit));
    el('smudge').setAttribute('aria-label', t('smudges', { n: s.smudge, of: s.smudgeLimit }));
  }
}
function mood() {
  if (!song) return;
  try {
    song.set({ on: soundOn && mode === 'play' && !s.done && !s.spoiled, progress: Math.min(1, s.coverage / s.goal),
      light: Number.isFinite(s.lead) ? leftOfStick() * 1.6 : 1, danger: Number.isFinite(s.smudgeLimit) ? s.smudge / s.smudgeLimit : 0 });
  } catch { song = null; }
}

function begin(sheet) {
  runEnd('quit');
  s = sheet;
  filedNow = 0; ticked = Math.floor(Math.min(1, s.coverage / s.goal) * 10);
  keyboardPoint = { x: 120, y: 140 };
  tool.style.removeProperty('left'); tool.style.removeProperty('top');
  try { song?.start(s.seed); } catch { song = null; }
}
function open(level, fresh = false) {
  fileProof();
  daily = null;
  plateLevel = level;
  const proof = fresh ? null : (sessionProofs.get(level) || readJson(proofKey(level)));
  begin(createPlate(level, Number.isInteger(proof?.grain) ? proof.grain : 19023 + level * 583));
  const filed = restore(proof);
  displayRed = filed ? proof.red === true : red;
  setMode(filed ? 'result' : 'play');
  save();
}
function openDaily() {
  fileProof();
  const spec = dailyPlateSpec();
  daily = { day: today, spec };
  begin(createSheet(spec, spec.seed, 0));
  displayRed = red;
  setMode('play');
  fx('daily', null, () => bump('#daily'));
}

const stockColor = [238, 227, 197], gritColor = [214, 207, 188];
function paint() {
  const { relief, tooth, pigment, slopeX, slopeY, stone } = s;
  const ink = displayRed ? [148, 66, 39] : [42, 54, 57];
  for (let i = 0, at = 0; i < relief.length; i++, at += 4) {
    const x = i % WIDTH, y = Math.floor(i / WIDTH);
    const edge = Math.min(1, x / 9, (WIDTH - 1 - x) / 9, y / 9, (HEIGHT - 1 - y) / 9);
    const light = (tooth[i] - 0.5) * 8 + (slopeX[i] * 0.85 + slopeY[i]) * 45 - relief[i] * 4;
    const density = Math.min(1, pigment[i] * 1.27);
    const paperColor = stone && stone[i] ? gritColor : stockColor;
    for (let c = 0; c < 3; c++) {
      const base = paperColor[c];
      pixels.data[at + c] = base + edge * ((1 - density) * light + (ink[c] - base) * density);
    }
    pixels.data[at + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
}

function requestPaint() {
  dirty = true;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (dirty) paint();
    dirty = false;
  });
}

function moveTool(p) {
  tool.classList.add('drawing');
  tool.style.left = ((p.x / WIDTH) * 100 + 3) + '%';
  tool.style.top = (8 + p.y / 326 * 100) + '%';
}

function file() {
  const got = starsOf(s);
  filedNow = got;
  if (daily) {
    const record = dailyRecord();
    record.tries++;
    if (got > record.stars || (got === record.stars && (record.distance === null || s.filedAt < record.distance))) {
      record.stars = got; record.distance = Math.round(s.filedAt);
    }
    writeJson(dailyKey, record);
  } else {
    unlocked = Math.max(unlocked, Math.min(PLATES.length, s.level + 1));
    fileProof();
    if (got) saveStars(s.level, got);
    save();
  }
  fx('filed', () => {
    audio.tone(392, 0.24, 0.075, 'sine', 132);
    for (let n = 0; n < got; n++) setTimeout(() => audio.tone(523 * 1.26 ** n, 0.16, 0.05, 'triangle'), 180 + 150 * n);
  }, () => bump('#figure'));
  rec.event('plate-filed', { level: s.level, ink: displayRed ? 'red' : 'graphite', stars: got, ...dayInfo() });
  runEnd('won');
  setMode('result', true);
}
function spoil() {
  if (daily) { const record = dailyRecord(); record.tries++; writeJson(dailyKey, record); }
  fx('spoiled-' + s.spoiled, () => audio.tone(146, 0.4, 0.07, 'sawtooth', 98), () => bump('#paper'));
  rec.event('plate-spoiled', { level: s.level, why: s.spoiled, ...dayInfo() });
  runEnd('lost');
  setMode('result', true);
}

function stroke(a, b) {
  const before = s.distance, filed = s.done, smudged = s.smudge;
  const parBefore = before <= s.par, lowBefore = leftOfStick() >= 0.25;
  rub(s, a.x, a.y, b.x, b.y);
  if (s.distance === before) return;
  if (before === 0) runBegin();
  paper.classList.remove('unused');
  moveTool(b);
  if (performance.now() - soundAt > 85) {
    audio.noise(0.085, 0.03, 850 + 450 * Math.min(1, Math.hypot(b.x - a.x, b.y - a.y) / 12));
    soundAt = performance.now();
  }
  if (s.smudge > smudged && !filed) fx('smudge', () => audio.tone(180, 0.09, 0.03, 'square'), () => bump('#smudge'));
  if (!filed && parBefore && s.distance > s.par && !s.done) fx('past-par', () => audio.tone(660, 0.07, 0.03, 'sine'), () => bump('#lead'));
  if (!filed && lowBefore && leftOfStick() < 0.25 && !s.done) fx('stick-low', () => audio.tone(880, 0.12, 0.04, 'sine'), () => bump('#lead'));
  if (s.done) proofDirty = !daily;
  const tenth = Math.floor(Math.min(1, s.coverage / s.goal) * 10);
  if (!filed && tenth > ticked) { ticked = tenth; fx('tenth', () => { if (!song?.ember()) audio.tone(330 + 30 * tenth, 0.08, 0.03); }); }
  if (s.spoiled && !filed) spoil();
  else if (s.done && !filed) file();
  else if (filed) {
    tool.hidden = false;
    requestPaint();
  } else {
    if (before === 0) { el('status').textContent = t('going'); el('status').classList.remove('long'); }
    const percent = Math.min(99, Math.floor(s.coverage / s.goal * 100));
    el('percent').textContent = t('percent', { n: percent });
    el('fill').style.width = percent + '%';
    meters();
    mood();
    requestPaint();
  }
}

function point(e) {
  const rect = field.getBoundingClientRect();
  return { x: Math.max(0, Math.min(WIDTH, (e.clientX - rect.left) * WIDTH / rect.width)),
    y: Math.max(0, Math.min(HEIGHT, (e.clientY - rect.top) * HEIGHT / rect.height)) };
}
field.addEventListener('pointerdown', e => {
  if (mode === 'paused' || pad.touch?.id !== e.pointerId) return;
  previous = point(e);
  keyboardPoint = previous;
  audio.unlock();
});
function pointerStroke(e) {
  if (!previous || mode === 'paused' || pad.touch?.id !== e.pointerId) return;
  const p = point(e);
  stroke(previous, p);
  previous = p;
  keyboardPoint = p;
}
field.addEventListener('pointermove', pointerStroke);
// Consume the last displacement before the shared input releases the pointer.
field.addEventListener('pointerup', pointerStroke, true);
function liftTool() {
  previous = null;
  fileProof();
  tool.hidden = s.done || !!s.spoiled;
  tool.classList.remove('drawing');
  tool.style.removeProperty('left'); tool.style.removeProperty('top');
}
function release(e) {
  if (pad.touch && pad.touch.id !== e.pointerId) return;
  liftTool();
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) field.addEventListener(type, release);
addEventListener('resize', () => {
  if (!previous) return;
  pad.drop();
  liftTool();
});

function pause() {
  if (mode === 'paused') return;
  lastMode = mode;
  fileProof();
  audio.hold();
  setMode('paused');
}
function resume() { audio.release(); setMode(lastMode); field.focus({ preventScroll: true }); }
const again = () => daily ? openDaily() : open(s.level, true);
el('pause').onclick = pause;
el('resume').onclick = resume;
el('restart').onclick = () => { audio.release(); again(); };
el('sound').onclick = () => { soundOn = !soundOn; save(); setMode('paused'); };
el('ink').onclick = () => { red = !red; if (!s.done) displayRed = red; save(); setMode('paused'); };
el('next').onclick = () => {
  fx('next', null, () => bump('#next'));
  if (s.spoiled || daily || s.level === PLATES.length) again();
  else open(s.level + 1);
};
el('daily').onclick = () => { if (mode !== 'paused') openDaily(); };
el('daily').querySelector('span').textContent = String(Number(today.slice(8)));
el('daily').setAttribute('aria-label', t('dailyLabel', { day: today }));

// A picture of the print with its name, stars and day, through the phone's share sheet (kit/share.js).
function sharePicture() {
  const scale = 2, pad = 28, width = WIDTH * scale + pad * 2, height = HEIGHT * scale + pad * 2 + 86;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = '#eee3c5'; g.fillRect(0, 0, width, height);
  g.imageSmoothingEnabled = true;
  g.drawImage(field, pad, pad, WIDTH * scale, HEIGHT * scale);
  g.fillStyle = '#2a3639';
  g.font = '600 30px Baskerville, Georgia, serif';
  g.fillText(plateName(), pad, HEIGHT * scale + pad + 42);
  g.font = '26px Georgia, serif';
  g.fillStyle = '#924b30';
  const got = shownStars();
  g.fillText((got ? starText(got) : '') + '  Carbon Cabinet' + (daily ? ' · ' + daily.day : ''), pad, HEIGHT * scale + pad + 78);
  return canvas;
}
el('share').onclick = async () => {
  const got = shownStars(), left = Math.round(leftOfStick() * 100), name = plateName();
  const text = daily ? t('shareDaily', { day: daily.day, name, stars: starText(got), left })
    : Number.isFinite(s.lead) ? t('shareText', { name, stars: starText(got), left }) : t('shareFree', { name, stars: starText(got) });
  fx('share', null, () => bump('#share'));
  const how = await shareImage(sharePicture(), { name: 'carbon-cabinet.png', text });
  rec.event('shared', { level: s.level, how, ...dayInfo() });
};
onLeave(pause);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { e.preventDefault(); if (mode === 'paused') resume(); else pause(); return; }
  const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
  if (!delta || mode === 'paused' || ![field, document.body].includes(document.activeElement)) return;
  e.preventDefault();
  const p = { x: Math.max(0, Math.min(WIDTH, keyboardPoint.x + delta[0])),
    y: Math.max(0, Math.min(HEIGHT, keyboardPoint.y + delta[1])) };
  stroke(keyboardPoint, p);
  keyboardPoint = p;
});

addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) fileProof(); });

hint(field, { kind: 'drag', key: 'night-rubbing:hint', when: () => mode === 'play',
  played: unlocked > 1, delay: 2200, reach: 38, label: t('hint') });
// The recording notice sits on the page under the drawer, so it is on screen from the first look; its switch is on the pause card.
rec.notice(el('cabinet'));
rec.toggle(el('paused').firstElementChild);
window.rubbingState = () => ({ screen: mode, level: s.level, unlocked, sound: soundOn, coverage: s.coverage, goal: s.goal, distance: s.distance,
  kind: kind(), lead: s.lead, par: s.par, smudge: s.smudge, smudgeLimit: s.smudgeLimit, spoiled: s.spoiled, stars: shownStars(),
  filedNow, best: { ...best }, daily: daily ? daily.day : null, dailyRecord: dailyRecord(), fx: fxLog(), lang: lang() });
const startLevel = plateNumber(more.level) && more.level <= unlocked ? more.level : oldNumber(prefs.level) && prefs.level <= unlocked ? prefs.level : unlocked;
open(startLevel);
