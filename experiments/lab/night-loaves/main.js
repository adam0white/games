import { createGame, down, move, up, cancel, step, GOLD, BURNT, GUEST_ARRIVAL } from './sim.js';
import { draw } from './art.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { screens } from '../../kit/screens.js';
import { noZoom } from '../../kit/zoom.js';
import { hint } from '../../kit/hint.js';

noZoom();
const $ = id => document.getElementById(id);
const canvas = $('bakery'), ctx = canvas.getContext('2d');
const look = new URLSearchParams(location.search).get('look') === 'mulberry' ? 'mulberry' : 'indigo';
document.body.classList.toggle('mulberry', look === 'mulberry');
const key = 'night-loaves:save', stored = readJson(key);
const levelFrom = n => Number.isInteger(n) ? Math.max(1, Math.min(n, 8)) : 1;
const bestFrom = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
const save = { unlocked: levelFrom(stored?.unlocked), best: bestFrom(stored?.best), sound: stored?.sound !== false };
const audio = sound({on: () => save.sound});
const stages = ['knead','rise','shape','bake','serve'];
let morning = save.unlocked, endless = false, batch = 1, carried = 0, mode, owner = null;
let handoffTime = 0;
let g, prev = 0, accumulator = 0, lastCue = '', storedOK = true;
function persist(soundChanged = false) {
  const prior = readJson(key);
  save.unlocked = Math.max(save.unlocked, levelFrom(prior?.unlocked));
  save.best = Math.max(save.best, bestFrom(prior?.best));
  if (!soundChanged && typeof prior?.sound === 'boolean') save.sound = prior.sound;
  storedOK = writeJson(key, save);
}
function label() {
  return endless ? 'Endless morning · Batch ' + batch : 'Morning ' + String(morning).padStart(2, '0') + ' / 08';
}
function dropPointer() {
  if (owner === null) return;
  const id = owner;
  owner = null;
  if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
const show = screens(['paused','result'], name => {
  mode = name;
  $('page').inert = mode !== 'play';
  accumulator = 0; prev = 0;
});
function fresh() {
  dropPointer();
  const n = endless ? 8 + batch : morning;
  const seed = endless ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.imul(n, 2654435761) >>> 0;
  g = createGame(n, seed);
  $('chapter').textContent = label();
  $('flour').textContent = g.recipe;
  lastCue = ''; handoffTime = 0;
  audio.release();
  show('play'); update();
}
function pause() {
  if (mode !== 'play') return;
  if (g.stage === 'done' || g.stage === 'burnt') { finish(); return; }
  cancel(g); dropPointer(); audio.hold();
  $('pause-chapter').textContent = label();
  $('mornings').replaceChildren(new Option('Mornings…', ''));
  for (let i = 1; i <= 8; i++) {
    const option = new Option('Morning ' + i, i);
    option.disabled = i > save.unlocked;
    $('mornings').add(option);
  }
  $('sound').textContent = save.sound ? 'Sound on' : 'Sound off';
  $('record').textContent = 'Best on this device · ' + save.best + (storedOK ? '' : ' · session only');
  update(); show('paused');
}
function resume() { audio.release(); show('play'); }
function finish() {
  if (mode !== 'play') return;
  dropPointer();
  const won = g.stage === 'done';
  if (won && !endless) save.unlocked = Math.max(save.unlocked, Math.min(8, morning + 1));
  persist();
  $('result-chapter').textContent = label();
  $('ending').textContent = !won ? 'A burnt batch' : g.gifts ? 'Bread for everyone' : 'Sold by sunrise';
  $('receipt').textContent = won
    ? g.served + ' loaves handed over' + (g.gifts ? ' · Last loaf shared' : '') : 'Draw the next batch out while the crust is gold.';
  $('result-score').textContent = (carried + g.score) + ' points' + (endless ? ' · Device best ' + save.best : '') + (storedOK ? '' : ' · session only');
  $('next').hidden = !won;
  $('next').textContent = endless ? 'Next batch →' : morning === 8 ? 'Endless morning ∞' : 'Next morning →';
  $('retry').textContent = endless ? 'New endless morning' : 'Bake again';
  show('result');
  audio.tone(won ? 495 : 110, .32, .045, 'triangle', won ? 165 : -35);
}
function newEndless() { endless = true; batch = 1; carried = 0; fresh(); }
$('pause').onclick = pause; $('resume').onclick = resume;
$('sound').onclick = () => {
  save.sound = !save.sound;
  persist(true);
  $('sound').textContent = save.sound ? 'Sound on' : 'Sound off';
};
$('mornings').onchange = e => {
  const n = Number(e.target.value);
  if (n < 1 || n > save.unlocked) return;
  endless = false; morning = n; carried = 0; fresh();
};
$('endless').onclick = newEndless;
$('next').onclick = () => {
  if (!endless && morning === 8) return newEndless();
  if (endless) { carried += g.score; batch++; } else morning++;
  fresh();
};
$('retry').onclick = () => endless ? newEndless() : fresh();
onLeave(pause);
addEventListener('keydown', e => {
  if (isPauseKey(e) && !e.repeat) {
    if (mode === 'paused') resume(); else if (mode === 'play') pause();
  }
});
function point(e) {
  const b = canvas.getBoundingClientRect();
  return [(e.clientX - b.left) * 360 / b.width, (e.clientY - b.top) * 490 / b.height];
}
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'play' || owner !== null || e.button !== 0 || !down(g, ...point(e))) return;
  e.preventDefault();
  owner = e.pointerId;
  canvas.setPointerCapture(owner);
  audio.unlock();
  if (g.grip.local) audio.noise(.07, .043, 370);
  update();
});
canvas.addEventListener('pointermove', e => {
  if (owner !== e.pointerId) return;
  move(g, ...point(e));
  update();
});
canvas.addEventListener('pointerup', e => {
  if (owner !== e.pointerId) return;
  move(g, ...point(e));
  const before = g.score;
  up(g); dropPointer();
  if (g.score > before) {
    audio.tone(g.last === 'gift' ? 660 : 440, .28, .055, 'sine', 110);
    if (endless && carried + g.score > save.best) { save.best = carried + g.score; persist(); }
  }
  update();
});
for (const type of ['lostpointercapture','pointercancel']) canvas.addEventListener(type, e => {
  if (owner === e.pointerId) { cancel(g); dropPointer(); update(); }
});

const copy = {
  knead:'Fold the dough', rise:'Let it rise', shape:'Tuck the edge in',
  bake:'Watch the crust', serve:'Pass the bread', done:'Morning served', burnt:'The crust has burnt'
};
function put(el, text) { if (el.textContent !== text) el.textContent = text; }
function update() {
  const golden = g.brown >= GOLD;
  const lastLoaf = g.stage === 'serve' && g.remaining === 1;
  const action = g.stage === 'bake' && golden ? 'Pull it out' :
    g.stage === 'shape' && g.shaped ? (g.last === 'pale' ? 'A little longer in the oven' : 'Slide it into the oven') :
    lastLoaf ? (g.age < GUEST_ARRIVAL ? 'Wait to share' : 'Sell or share') : copy[g.stage];
  put($('instruction'), action);
  put($('loaves'), g.remaining + (g.remaining === 1 ? ' loaf' : ' loaves'));
  put($('points'), (carried + g.score) + ' points');
  const stageIndex = stages.indexOf(g.stage);
  const progress = [g.work, g.proof, Number(g.shaped), g.brown / BURNT, g.served / g.batchSize];
  for (const [i, bar] of [...$('track').children].entries()) {
    const fill = String(Math.min(1,progress[i]).toFixed(2));
    if (bar.style.getPropertyValue('--fill') !== fill) bar.style.setProperty('--fill',fill);
    bar.classList.toggle('active', i === stageIndex);
    bar.classList.toggle('oven', i === 3 && i === stageIndex);
  }
  if (g.stage !== lastCue) {
    if (lastCue && g.stage === 'rise') audio.noise(.16, .04, 640);
    if (g.stage === 'bake') audio.noise(.19, .06, 1050);
    if (lastCue && g.stage === 'shape') audio.tone(294, .18, .035);
    lastCue = g.stage;
  }
  const status = { stage:g.stage, shaped:g.shaped, x:g.x.toFixed(2), y:g.y.toFixed(2),
    brown:g.brown.toFixed(3), time:g.time.toFixed(3), proof:g.proof.toFixed(3),
    work:g.work.toFixed(3), remaining:g.remaining, score:g.score };
  for (const [k,v] of Object.entries(status)) if (canvas.dataset[k] !== String(v)) canvas.dataset[k] = v;
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let viewWidth = 0;
function frame(now) {
  const elapsed = prev ? Math.min(.16,(now-prev)/1000) : 0;
  prev = now;
  if (mode === 'play') {
    accumulator += elapsed;
    while (accumulator >= 1/60) { step(g); accumulator -= 1/60; }
    // Keep the final loaf in the recipient's hands before covering the counter.
    if (g.stage === 'done') {
      handoffTime += elapsed;
      g.age = handoffTime;
      if (handoffTime >= .85) finish();
    } else if (g.stage === 'burnt') finish();
    update();
    const target = Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2));
    if (viewWidth !== target && target > 0) {
      viewWidth = target;
      canvas.width = target;
      canvas.height = Math.round(target * 490 / 360);
    }
    ctx.setTransform(canvas.width / 360,0,0,canvas.height / 490,0,0);
    draw(ctx, g, reduced.matches ? 1.4 : now/1000, look);
  }
  requestAnimationFrame(frame);
}
fresh();
hint(canvas,{kind:'drag', key:'night-loaves:hint', when:() => mode === 'play' && g.stage === 'knead',
  played:stored?.unlocked > 1, delay:3800, reach:32, label:'Fold the dough inward',
  bottom:() => innerHeight - canvas.getBoundingClientRect().top - canvas.clientHeight * .73});
requestAnimationFrame(frame);
