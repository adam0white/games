import { createPlate, rub, pigmentByte, loadPigment, WIDTH, HEIGHT } from './sim.js';
import { PLATES } from './plates.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { hint } from '../../kit/hint.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { screens } from '../../kit/screens.js';
import { stick } from '../../kit/stick.js';
import { noZoom } from '../../kit/zoom.js';

noZoom();
const el = id => document.getElementById(id);
const field = el('field'), paper = el('paper'), tool = el('tool');
const ctx = field.getContext('2d', { alpha: false });
const pixels = ctx.createImageData(WIDTH, HEIGHT);
const saveKey = 'night-rubbing:save';
const prefs = readJson(saveKey, {});
const plateNumber = n => Number.isInteger(n) && n >= 1 && n <= PLATES.length;
let unlocked = plateNumber(prefs.unlocked) ? prefs.unlocked : 1;
let soundOn = prefs.sound !== false, red = prefs.ink === 'red';
let s, mode, previous, keyboardPoint, dirty = false, frame = 0, soundAt = -Infinity;
let lastMode = 'play', proofDirty = false;
const sessionProofs = new Map();
const show = screens(['paused', 'result'], next => {
  mode = next;
  el('cabinet').inert = mode === 'paused';
});
const audio = sound({ on: () => soundOn });
const pad = stick(field, { when: () => mode !== 'paused', reach: 32, leash: 60, dead: 0 });

function save() {
  const other = readJson(saveKey, {});
  if (plateNumber(other.unlocked)) unlocked = Math.max(unlocked, other.unlocked);
  writeJson(saveKey, { level: s.level, unlocked, sound: soundOn, ink: red ? 'red' : 'black' });
}

// Keep the actual pigment of a finished sheet. Each proof has its own key so
// filing a later print cannot overwrite an earlier print in another tab.
const proofKey = level => 'night-rubbing:proof:' + level;
function fileProof() {
  if (!proofDirty) return;
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
  silhouette.style.cssText = 'width:38px;height:38px;display:block;background:currentColor';
  const mask = 'url(' + miniature.toDataURL() + ') center/contain no-repeat';
  silhouette.style.webkitMask = mask;
  silhouette.style.mask = mask;
  button.append(silhouette);
  button.setAttribute('aria-label', 'Plate ' + (index + 1) + ', ' + plate.name);
  button.onclick = () => { if (s.level !== index + 1) open(index + 1); };
  el('collection').append(button);
}

function setMode(next, keepStroke = false) {
  const openingPause = next === 'paused' && mode !== 'paused';
  if (!keepStroke) {
    previous = null;
    pad.drop();
  }
  tool.classList.remove('drawing');
  show(next);
  const finished = s.done, plate = PLATES[s.level - 1];
  const percent = Math.min(100, Math.floor(s.coverage / s.goal * 100));
  el('figure').textContent = 'Fig. ' + String(s.level).padStart(2, '0') + (finished ? ' · Filed' : '');
  el('taxon').textContent = plate.taxon;
  el('medium').textContent = plate.age;
  el('status').textContent = finished ? plate.name : s.distance ? 'Taking an impression' : 'Rub across the fossil';
  el('percent').hidden = finished;
  el('percent').textContent = percent + '%';
  el('fill').style.width = percent + '%';
  el('next').firstChild.textContent = s.level === PLATES.length ? 'Rub again ' : 'Next plate ';
  for (const [i, button] of Array.from(el('collection').children).entries()) {
    button.disabled = i + 1 > unlocked;
    button.setAttribute('aria-current', String(i + 1 === s.level));
  }
  el('sound').textContent = soundOn ? 'Sound on' : 'Sound off';
  el('ink').textContent = red ? 'Red chalk' : 'Graphite';
  tool.querySelector('span').textContent = red ? 'R' : '6B';
  paper.classList.toggle('unused', s.distance === 0 && next === 'play');
  tool.hidden = finished;
  if (openingPause) el('resume').focus({ preventScroll: true });
  requestPaint();
}

function open(level, fresh = false) {
  fileProof();
  const proof = fresh ? null : (sessionProofs.get(level) || readJson(proofKey(level)));
  s = createPlate(level, Number.isInteger(proof?.grain) ? proof.grain : 19023 + level * 583);
  keyboardPoint = { x: 120, y: 140 };
  const filed = restore(proof);
  displayRed = filed ? proof.red === true : red;
  tool.style.removeProperty('left'); tool.style.removeProperty('top');
  setMode(filed ? 'result' : 'play');
  save();
}
let displayRed = red;

const stockColor = [238, 227, 197];
function paint() {
  const { relief, tooth, pigment, slopeX, slopeY } = s;
  const ink = displayRed ? [148, 66, 39] : [42, 54, 57];
  for (let i = 0, at = 0; i < relief.length; i++, at += 4) {
    const x = i % WIDTH, y = Math.floor(i / WIDTH);
    const edge = Math.min(1, x / 9, (WIDTH - 1 - x) / 9, y / 9, (HEIGHT - 1 - y) / 9);
    const light = (tooth[i] - 0.5) * 8 + (slopeX[i] * 0.85 + slopeY[i]) * 45 - relief[i] * 4;
    const density = Math.min(1, pigment[i] * 1.27);
    for (let c = 0; c < 3; c++) {
      const base = stockColor[c];
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

function stroke(a, b) {
  const before = s.distance, filed = s.done;
  rub(s, a.x, a.y, b.x, b.y);
  if (s.distance === before) return;
  paper.classList.remove('unused');
  moveTool(b);
  if (performance.now() - soundAt > 85) {
    audio.noise(0.085, 0.03, 850 + 450 * Math.min(1, Math.hypot(b.x - a.x, b.y - a.y) / 12));
    soundAt = performance.now();
  }
  if (s.done) proofDirty = true;
  if (s.done && !filed) {
    unlocked = Math.max(unlocked, Math.min(PLATES.length, s.level + 1));
    fileProof();
    save();
    audio.tone(392, 0.24, 0.075, 'sine', 132);
    setMode('result', true);
  } else if (filed) {
    tool.hidden = false;
    requestPaint();
  } else {
    if (before === 0) el('status').textContent = 'Taking an impression';
    const percent = Math.min(99, Math.floor(s.coverage / s.goal * 100));
    el('percent').textContent = percent + '%';
    el('fill').style.width = percent + '%';
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
  tool.hidden = s.done;
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
el('pause').onclick = pause;
el('resume').onclick = resume;
el('restart').onclick = () => { audio.release(); open(s.level, true); };
el('sound').onclick = () => { soundOn = !soundOn; save(); setMode('paused'); };
el('ink').onclick = () => { red = !red; if (!s.done) displayRed = red; save(); setMode('paused'); };
el('next').onclick = () => s.level === PLATES.length ? open(s.level, true) : open(s.level + 1);
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
  played: unlocked > 1, delay: 2200, reach: 38, label: 'Rub back and forth' });
window.rubbingState = () => ({ screen: mode, level: s.level, unlocked, sound: soundOn, coverage: s.coverage, goal: s.goal, distance: s.distance });
open(plateNumber(prefs.level) && prefs.level <= unlocked ? prefs.level : unlocked);
