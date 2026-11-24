import { W, H, create, step, press, move, release } from './sim.js';
import { renderer } from './art.js';
import { drag } from '../../kit/drag.js';
import { sound } from '../../kit/audio.js';
import { hint } from '../../kit/hint.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { readJson, writeJson } from '../../kit/save.js';
import { screens } from '../../kit/screens.js';
import { noZoom } from '../../kit/zoom.js';

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
const titles = { lamp: 'Uncover the lamp', glass: 'Fill to the line', sieve: 'Sift the blue sand', seed: 'Cover the seed', garden: 'Rake a mirror image' };
const finishes = { lamp: 'Lamp uncovered', glass: 'Bulb filled', sieve: 'Sand sorted', seed: 'Seed planted' };
const actions = { lamp:'Lift sand off the lamp. Drop it to the side.', glass:'Slide the board to pour sand into the lower bulb.', sieve:'Scoop the mixed sand onto the mesh.', seed:'Carry sand to the seed and cover it to the mark.', garden:'Drag the rake through the sand. Match your marks on the other side.' };

let bed, screen, fromBook, pointer = null, keyboard = false, keyboardFocus = false, started, previousTime, debt = 0;
let elapsed, endAt, releasedAt, lastPaint, lastMeter, mouseStart, mouseGate, frameCost = 0;
let inkFlow = 0, soundAt = 0, noiseGain, noiseFilter;
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
function updateSound(now) {
  if (!audio.ctx || !save.sound || now < soundAt) return;
  soundAt = now + 55;
  const level = Math.min(1, Math.sqrt(inkFlow / 1200));
  const t = audio.ctx.currentTime;
  noiseGain.gain.setTargetAtTime(.19 * level, t, .04);
  noiseFilter.frequency.setTargetAtTime(720 + 2750 * level, t, .06);
}
const label = () => bed.level ? 'Bed ' + String(bed.level).padStart(2,'0') + ' / 10' : 'Endless garden';
const setText = (id, text) => { const node = el(id); if (node.textContent !== text) node.textContent = text; };
function settings() {
  document.body.dataset.look = save.look;
  setText('look', 'Ink · ' + (save.look === 'plum' ? 'Plum' : 'Basalt'));
  setText('sound', save.sound ? 'Sound on' : 'Sound off');
  el('sound').setAttribute('aria-pressed', String(save.sound));
}
function readout() {
  const percent = bed.level ? Math.round(100 * bed.progress) : bed.score;
  if (lastMeter === percent) return;
  lastMeter = percent;
  const meter = document.querySelector('.meter');
  meter.setAttribute('aria-valuenow', percent);
  meter.firstElementChild.style.width = percent + '%';
  setText('reading', percent + '%');
  if (!bed.level) setText('garden-best','Best ' + save.best + '%');
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
  const retryCue = bed.level === 1 && !bed.hand.down && bed.progress < .1 && elapsed - releasedAt > 1;
  paint(bed, { look:save.look, intro:(!started || retryCue) && !keyboardFocus,
    focused:keyboardFocus && document.activeElement === field, time:reduce.matches ? 0 : elapsed });
  readout();
}
function start(level) {
  drop();
  hush();
  bed = create(level, level ? 553 + level * 971 : crypto.getRandomValues(new Uint32Array(1))[0]);
  started = false;
  keyboardFocus = false;
  elapsed = 0;
  endAt = null;
  releasedAt = 0;
  lastPaint = -Infinity;
  lastMeter = null;
  el('garden-best').hidden = !!level;
  setText('edition', label());
  setText('objective', titles[bed.kind]);
  el('goal-icon').setAttribute('href', '#i-' + bed.kind);
  field.setAttribute('aria-label', actions[bed.kind] + ' Arrow keys position the tool. Space picks up or releases.');
  Object.assign(bed.hand,{x:bed.hint.x,y:bed.hint.y});
  document.querySelector('.meter').setAttribute('aria-label', level ? 'Goal progress' : 'Rake symmetry');
  if (level && save.level !== level) { save.level = level; store(); }
  show('play');
  audio.release();
  draw();
}
function rememberGarden() {
  if (bed?.kind === 'garden' && bed.score > save.best) {
    save.best = bed.score; store();
    setText('garden-best','Best ' + save.best + '%');
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
  audio.hold();
  el('next').hidden = !won;
  setText('advance', bed.level === 10 ? 'Enter the garden' : 'Next bed');
  positionResult();
  setText('result-title', won ? finishes[bed.kind] : 'Upper bulb empty');
  el('result-icon').setAttribute('href', '#i-' + bed.kind);
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
  setText('restart',bed.level ? 'Start over' : 'Smooth the bed');
  show('paused');
}
function resume() { audio.release(); show('play'); field.focus({preventScroll:true}); }
function openBook() {
  fromBook = screen;
  for (const button of el('levels').children) button.disabled = Number(button.value) > save.unlocked;
  setText('record', 'Garden best · ' + save.best + '%');
  show('book');
}
for (let n=1; n<=10; n++) {
  const button = document.createElement('button');
  button.id = 'level-' + n;
  button.value = String(n);
  button.textContent = String(n).padStart(2,'0');
  button.setAttribute('aria-label', 'Bed ' + n);
  button.onclick = () => start(n);
  el('levels').append(button);
}
el('pause').onclick = pause;
el('resume').onclick = resume;
el('restart').onclick = el('retry').onclick = () => start(bed.level);
el('next').onclick = () => start(bed.level === 10 ? 0 : bed.level+1);
el('garden').onclick = el('book-garden').onclick = () => start(0);
el('book').onclick = el('result-book').onclick = openBook;
el('back').onclick = () => show(fromBook);
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
  audio.unlock();
  if (bed.kind === 'glass') {
    mouseStart = x; mouseGate = bed.gate.x;
    press(bed, mouseGate, bed.gate.y);
  } else press(bed,x,y);
});
field.addEventListener('pointermove', e => {
  if (pointer !== e.pointerId || !canTouch()) { e.stopImmediatePropagation(); return; }
  if (bed.kind !== 'glass') { const {x,y} = locationInBed(e); move(bed,x,y); }
});
const gateDrag = drag(field, {
  playing: () => canTouch() && bed.kind === 'glass' && pointer !== null,
  paused: () => false, resume, from: () => bed.gate.x,
  travel: dx => dx * W / field.getBoundingClientRect().width,
  aim: x => move(bed,x,bed.gate.y),
  mouse: e => move(bed,mouseGate + locationInBed(e).x - mouseStart,bed.gate.y), settle:0
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  field.addEventListener(type, e => {
    if (pointer !== e.pointerId) return;
    if (type === 'pointerup' && canTouch() && bed.kind !== 'glass') {
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
      if (save.sound && bed.status === 'won') audio.tone(523,.38,.055,'sine',140);
    }
    if (started || now-lastPaint >= 1000/24-1) { draw(); lastPaint = now; }
    frameCost = performance.now() - frameStart;
    if (endAt !== null && elapsed >= endAt) finish();
  }
  requestAnimationFrame(frame);
}
window.sandState = () => ({
  screen, level:bed.level, kind:bed.kind, status:bed.status, tick:bed.ticks,
  best:save.best, score:bed.score, progress:bed.progress, flow:bed.flow,
  unlocked:save.unlocked, completed:save.completed, sound:save.sound, look:save.look,
  hint:{...bed.hint}, pressed:bed.hand.down, load:bed.hand.load, total:bed.total,
  frameCost
});
settings();
start(save.level);
hint(field, { kind:'hold-and-move', key:'night-sand:hint', played:save.completed>0,
  when:() => canTouch() && !started && bed.level === 1, label:'Lift the sand away',
  delay:3800, reach:26, bottom:() => {
    const r = field.getBoundingClientRect();
    return window.innerHeight - r.top - r.height * bed.hint.y/H;
  } });
requestAnimationFrame(frame);
