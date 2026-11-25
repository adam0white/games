import { W, H, create, step, press, move, release, grips } from './sim.js';
import { renderer } from './art.js';
import { t, lang, apply, setLang, langs } from './words.js';
import { drag } from '../../kit/drag.js';
import { sound } from '../../kit/audio.js';
import { hint } from '../../kit/hint.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { readJson, writeJson } from '../../kit/save.js';
import { screens } from '../../kit/screens.js';
import { noZoom } from '../../kit/zoom.js';
import { lab } from '../../kit/lab.js';

noZoom();
const el = id => document.getElementById(id);
const field = el('field');
const paint = renderer(field);
const key = 'night-sand:save';
const integer = (n, max, fallback) => Number.isSafeInteger(n) && n >= 0 && n <= max ? n : fallback;
const old = readJson(key) || {};
const unlocked = Math.max(1, integer(old.unlocked, 10, 1));
const save = {
  v: 1, unlocked, level: Math.max(1, integer(old.level, unlocked, unlocked)),
  completed: integer(old.completed, 10, 0), best: integer(old.best, 100, 0),
  sound: old.sound !== false, look: old.look === 'plum' ? 'plum' : 'basalt'
};
function store() {
  const latest = readJson(key) || {};
  save.best = Math.max(save.best, integer(latest.best, 100, 0));
  save.completed = Math.max(save.completed, integer(latest.completed, 10, 0));
  save.unlocked = Math.max(save.unlocked, integer(latest.unlocked, 10, 1));
  writeJson(key, save);
}
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

let bed, screen, fromBook, pointer = null, keyboard = false, keyboardFocus = false, started, previousTime, debt = 0;
let elapsed, endAt, releasedAt, lastPaint, lastMeter, mouseStart, mouseGate, frameCost = 0, wonAt = null;
let inkFlow = 0, soundAt = 0, crunchAt = 0, lastLifted = 0, noiseGain, noiseFilter;
const audio = sound({ on: () => save.sound, setup(ctx) {
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i=0; i<samples.length; i++) samples[i] = 2 * Math.random() - 1;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.Q.value = .68;
  source.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
  source.start();
} });
function hush() {
  inkFlow = 0;
  if (noiseGain) {
    const now = audio.ctx.currentTime;
    noiseGain.gain.cancelScheduledValues(now);
    noiseGain.gain.setValueAtTime(0, now);
  }
}
// The hiss follows the grains in motion; a handful taken from the bed crunches.
function updateSound(now) {
  if (!audio.ctx || !save.sound) return;
  const taken = bed.lifted - lastLifted;
  lastLifted = bed.lifted;
  if (taken > 0 && now >= crunchAt) {
    crunchAt = now + 70;
    audio.noise(.07, Math.min(.16, .03 + taken / 500), 2600 + Math.random() * 900);
  }
  if (now < soundAt) return;
  soundAt = now + 55;
  const level = Math.min(1, Math.sqrt(inkFlow / 1200));
  const t0 = audio.ctx.currentTime;
  noiseGain.gain.setTargetAtTime(.19 * level, t0, .04);
  noiseFilter.frequency.setTargetAtTime(720 + 2750 * level, t0, .06);
}
const label = () => bed.level ? t('bed', { n: String(bed.level).padStart(2,'0') }) : t('garden');
const setText = (id, text) => { const node = el(id); if (node.textContent !== text) node.textContent = text; };
function words() {
  apply();
  setText('look', t('ink', { name: t(save.look) }));
  setText('sound', t(save.sound ? 'soundOn' : 'soundOff'));
  el('to-garden').setAttribute('aria-label', t('openGarden'));
  el('share').setAttribute('aria-label', t('share'));
  el('title').innerHTML = lang() === 'tr' ? 'Gece <i>Kumu</i>' : 'Night <i>Sand</i>';
  document.title = t('title');
  for (const button of el('langs').children) button.setAttribute('aria-pressed', String(button.value === lang()));
  for (const button of el('levels').children) button.setAttribute('aria-label', t('levelLabel', { n: button.value }));
  if (bed) describe();
}
function settings() {
  document.body.dataset.look = save.look;
  el('sound').setAttribute('aria-pressed', String(save.sound));
  words();
}
function describe() {
  setText('edition', label());
  setText('pause-level', label());
  setText('restart', t(bed.level ? 'restart' : 'smooth'));
  setText('objective', t('goal' + bed.level));
  field.setAttribute('aria-label', t('act' + bed.level) + ' ' + t('keys'));
  document.querySelector('.meter').setAttribute('aria-label', t(bed.level ? 'progress' : 'symmetry'));
  if (!bed.level) setText('garden-best', t('gardenBest', { n: save.best }));
}
function readout() {
  const percent = bed.level ? Math.round(100 * bed.progress) : bed.score;
  if (lastMeter === percent) return;
  lastMeter = percent;
  const meter = document.querySelector('.meter');
  meter.setAttribute('aria-valuenow', percent);
  meter.firstElementChild.style.width = percent + '%';
  setText('reading', t('percent', { n: percent }));
  if (!bed.level) setText('garden-best', t('gardenBest', { n: save.best }));
}
const sheets = screens(['paused','catalog','result']);
function show(name) {
  screen = name;
  document.body.dataset.screen = name;
  sheets(name === 'book' ? 'catalog' : name);
  el('table').inert = name !== 'play';
  previousTime = null;
  debt = 0;
  if (name !== 'play') document.querySelector('.sheet.on button:not([hidden]):not(:disabled)')?.focus({preventScroll:true});
}
function draw() {
  // The moving hint shows before the first touch, and again after a long idle spell without progress.
  const idle = !bed.hand.down && bed.progress < .1 && elapsed - releasedAt > (bed.level === 1 ? 1 : 8);
  paint(bed, { look:save.look, intro:(!started || idle) && !keyboardFocus && bed.level > 0,
    focused:keyboardFocus && document.activeElement === field, time:reduce.matches ? 0 : elapsed,
    glow: wonAt === null || reduce.matches ? 0 : Math.max(0, 1 - (elapsed - wonAt) / 1.1) });
  readout();
}
// Play recording for the game lab (kit/lab.js): one run for each bed the player starts to work.
const rec = lab('night-sand');
let runOpen = false;
function runBegin() { if (runOpen || !bed || bed.status !== 'play') return; runOpen = true; rec.start({ level: bed.level, kind: bed.kind, look: save.look }); }
function runEnd(outcome) {
  if (!runOpen) return;
  runOpen = false;
  rec.end(outcome, { level: bed.level, kind: bed.kind, progress: Math.round(bed.progress * 100), score: bed.score, completed: save.completed });
}
function masthead() {
  // The garden is one tap from the first screen once the first bed is done; in the garden that button shares.
  el('to-garden').hidden = !(bed.level && save.completed >= 1);
  el('share').hidden = !!bed.level;
}
function start(level) {
  runEnd('quit');
  drop();
  hush();
  bed = create(level, level ? 553 + level * 971 : crypto.getRandomValues(new Uint32Array(1))[0]);
  started = false;
  keyboardFocus = false;
  elapsed = 0;
  endAt = null;
  wonAt = null;
  releasedAt = 0;
  lastLifted = 0;
  lastPaint = -Infinity;
  lastMeter = null;
  el('garden-best').hidden = !!level;
  el('goal-icon').setAttribute('href', '#i-' + icon(bed));
  describe();
  masthead();
  Object.assign(bed.hand,{x:bed.hint.x,y:bed.hint.y});
  if (level && save.level !== level) { save.level = level; store(); }
  show('play');
  audio.release();
  draw();
}
const icon = s => ({ pile: 'pile', layers: 'layers' })[s.kind] || s.kind;
function rememberGarden() {
  if (bed?.kind === 'garden' && bed.score > save.best) {
    save.best = bed.score; store();
    setText('garden-best', t('gardenBest', { n: save.best }));
  }
}
function drop() {
  const id = pointer;
  pointer = null;
  keyboard = false;
  if (bed?.hand.down) { release(bed); releasedAt = elapsed; rememberGarden(); }
  gateDrag.reset();
  if (id !== null && field.hasPointerCapture(id)) field.releasePointerCapture(id);
}
function positionResult() {
  const table = el('table').getBoundingClientRect();
  el('result').style.setProperty('--result-width', table.width + 'px');
  el('result').style.setProperty('--result-bottom', Math.max(0,innerHeight - table.bottom - 14) + 'px');
}
window.addEventListener('resize', () => { if (screen === 'result') positionResult(); });
function finish() {
  drop();
  hush();
  const won = bed.status === 'won';
  if (won) {
    save.completed = Math.max(save.completed, bed.level);
    save.level = Math.min(10, bed.level + 1);
    save.unlocked = Math.max(save.unlocked, save.level);
    store();
  }
  if (won) rec.event('bed-cleared', { level: bed.level, kind: bed.kind });
  runEnd(won ? 'won' : 'lost');
  audio.hold();
  el('next').hidden = !won;
  setText('advance', t(bed.level === 10 ? 'enterGarden' : 'next'));
  positionResult();
  setText('result-title', won ? t('done' + bed.level) : t(bed.ending === 'overfill' ? 'lostOverfill' : 'lostEmpty'));
  el('result-icon').setAttribute('href', '#i-' + icon(bed));
  masthead();
  show('result');
}
function pause() {
  if (screen !== 'play') return;
  if (bed.status !== 'play') { finish(); return; }
  drop();
  hush();
  audio.hold();
  setText('pause-level', label());
  el('garden').hidden = !bed.level;
  setText('restart', t(bed.level ? 'restart' : 'smooth'));
  show('paused');
}
function resume() { audio.release(); show('play'); field.focus({preventScroll:true}); }
function openBook() {
  fromBook = screen;
  for (const button of el('levels').children) button.disabled = Number(button.value) > save.unlocked;
  setText('record', t('gardenRecord', { n: save.best }));
  show('book');
}
for (let n=1; n<=10; n++) {
  const button = document.createElement('button');
  button.id = 'level-' + n;
  button.value = String(n);
  button.textContent = String(n).padStart(2,'0');
  button.onclick = () => start(n);
  el('levels').append(button);
}
for (const code of langs) {
  const button = document.createElement('button');
  button.value = code;
  button.textContent = code.toUpperCase();
  button.onclick = () => { setLang(code); words(); };
  el('langs').append(button);
}
el('pause').onclick = pause;
el('resume').onclick = resume;
el('restart').onclick = el('retry').onclick = () => start(bed.level);
el('next').onclick = () => start(bed.level === 10 ? 0 : bed.level+1);
el('garden').onclick = el('book-garden').onclick = el('to-garden').onclick = () => start(0);
el('book').onclick = el('result-book').onclick = openBook;
el('back').onclick = () => show(fromBook);
el('share').onclick = () => shareGarden();
el('sound').onclick = () => {
  save.sound = !save.sound;
  hush();
  if (save.sound) audio.unlock();
  settings(); store();
};
el('look').onclick = () => {
  save.look = save.look === 'basalt' ? 'plum' : 'basalt';
  settings(); draw(); store();
};
onLeave(pause);

// The raked garden as a picture: the bed itself, with its score and the game's name under it.
// The kit has a share helper for links only (room.js shareLink), so the image share lives here.
async function gardenImage() {
  const scale = 6, foot = 96;
  const out = document.createElement('canvas');
  out.width = W * scale; out.height = H * scale + foot;
  const c = out.getContext('2d');
  c.fillStyle = getComputedStyle(document.body).getPropertyValue('--paper') || '#ede5cf';
  c.fillRect(0, 0, out.width, out.height);
  c.imageSmoothingEnabled = false;
  c.drawImage(field, 0, 0, W * scale, H * scale);
  c.fillStyle = getComputedStyle(document.body).getPropertyValue('--ink') || '#162e2b';
  c.font = '500 46px ui-serif, Baskerville, serif';
  c.fillText(t('title'), 26, H * scale + 62);
  c.font = '600 30px ui-monospace, monospace';
  c.textAlign = 'right';
  c.fillText(t('percent', { n: bed.score }), W * scale - 26, H * scale + 60);
  return new Promise(resolve => out.toBlob(resolve, 'image/png'));
}
async function shareGarden() {
  const blob = await gardenImage();
  if (!blob) return;
  const file = new File([blob], 'night-sand-garden.png', { type: 'image/png' });
  const text = t('shareCaption', { n: bed.score });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      rec.event('garden-shared', { score: bed.score });
      return;
    }
  } catch (e) { if (e?.name === 'AbortError') return; }
  // No file sharing here (most desktop browsers): save the picture instead.
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  rec.event('garden-saved', { score: bed.score });
}

function locationInBed(e) {
  const r = field.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W/r.width, y: (e.clientY - r.top) * H/r.height };
}
function canTouch() { return screen === 'play' && bed.status === 'play'; }
field.addEventListener('pointerdown', e => {
  if (!canTouch() || keyboard || pointer !== null || e.button !== 0) { e.stopImmediatePropagation(); return; }
  e.preventDefault();
  pointer = e.pointerId;
  keyboardFocus = false;
  if (field.setPointerCapture && e.isTrusted) field.setPointerCapture(pointer);
  const {x,y} = locationInBed(e);
  started = true;
  runBegin();
  audio.unlock();
  if (grips(bed, x, y)) {
    mouseStart = x; mouseGate = bed.gate.x;
    press(bed, mouseGate, bed.gate.y);
  } else press(bed,x,y);
});
field.addEventListener('pointermove', e => {
  if (pointer !== e.pointerId || !canTouch()) { e.stopImmediatePropagation(); return; }
  if (!bed.hand.board) { const {x,y} = locationInBed(e); move(bed,x,y); }
});
const gateDrag = drag(field, {
  playing: () => canTouch() && bed.hand.board && pointer !== null,
  paused: () => false, resume, from: () => bed.gate.x,
  travel: dx => dx * W / field.getBoundingClientRect().width,
  aim: x => move(bed,x,bed.gate.y),
  mouse: e => move(bed,mouseGate + locationInBed(e).x - mouseStart,bed.gate.y), settle:0
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  field.addEventListener(type, e => {
    if (pointer !== e.pointerId) return;
    if (type === 'pointerup' && canTouch() && !bed.hand.board) {
      const {x,y} = locationInBed(e);
      move(bed,x,y);
    }
    drop();
  });
}
window.addEventListener('keydown', e => {
  if (isPauseKey(e)) {
    if (screen === 'play') pause(); else if (screen === 'paused') resume(); else if (screen === 'book') show(fromBook);
    e.preventDefault(); return;
  }
  if (!canTouch() || pointer !== null || document.activeElement !== field) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (e.repeat) return;
    if (keyboard) drop();
    else {
      const {x,y} = bed.hand;
      started = keyboard = true;
      runBegin();
      audio.unlock();
      press(bed,x,y);
    }
  } else if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    keyboardFocus = true;
    const delta = e.shiftKey ? 1 : 4;
    const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
    const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;
    const x = Math.min(W-1,Math.max(0,bed.hand.x+dx)), y = Math.min(H-1,Math.max(0,bed.hand.y+dy));
    if (keyboard) move(bed,x,y);
    else { bed.hand.x=x; bed.hand.y=y; }
  }
});

function frame(now) {
  if (screen === 'play') {
    const dt = previousTime === null ? 0 : Math.min((now - previousTime)/1000, .10);
    previousTime = now;
    elapsed += dt;
    const frameStart = performance.now();
    if (started && bed.status === 'play') {
      debt += dt;
      while (debt >= 1/60 && bed.status === 'play') {
        step(bed); debt -= 1/60;
        inkFlow += .15 * (bed.flow - inkFlow);
      }
      if (!bed.hand.down) rememberGarden();
      updateSound(now);
    }
    if (bed.status !== 'play' && endAt === null) {
      endAt = elapsed + (reduce.matches ? .4 : 1.15);
      hush();
      if (bed.status === 'won') {
        wonAt = elapsed;
        if (save.sound) { audio.tone(523,.38,.055,'sine',140); setTimeout(() => audio.tone(784,.5,.045,'sine',60), 140); }
      }
    }
    if (started || now-lastPaint >= 1000/24-1) { draw(); lastPaint = now; }
    frameCost = performance.now() - frameStart;
    if (endAt !== null && elapsed >= endAt) finish();
  }
  requestAnimationFrame(frame);
}
// The recording notice is on the page from the first look; its switch is on the pause card.
rec.notice(el('table'));
rec.toggle(document.querySelector('#paused .card'));
window.sandState = () => ({
  screen, level:bed.level, kind:bed.kind, status:bed.status, tick:bed.ticks,
  best:save.best, score:bed.score, progress:bed.progress, flow:bed.flow,
  unlocked:save.unlocked, completed:save.completed, sound:save.sound, look:save.look,
  hint:{...bed.hint}, pressed:bed.hand.down, load:bed.hand.load, total:bed.total,
  lifted:bed.lifted, board:bed.hand.board, ending:bed.ending || null, lang:lang(),
  frameCost
});
settings();
start(save.level);
hint(field, { kind:'hold-and-move', key:'night-sand:hint', played:save.completed>0,
  when:() => canTouch() && !started && bed.level === 1, label:t('hintLabel'),
  delay:3800, reach:26, bottom:() => {
    const r = field.getBoundingClientRect();
    return window.innerHeight - r.top - r.height * bed.hint.y/H;
  } });
requestAnimationFrame(frame);
