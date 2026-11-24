import { createGame, RESCUE_POINTS, step } from './sim.js';
import { draw } from './art.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';

noZoom();
const el = id => document.getElementById(id);
const canvas = el('field');
const ctx = canvas.getContext('2d');
const query = new URLSearchParams(location.search);
const look = query.get('look') === 'heather' ? 'heather' : 'pine';
const key = 'night-flock:save';
const old = readJson(key);
const saved = {
  v: 1,
  unlocked: Number.isInteger(old?.unlocked) ? Math.min(10, Math.max(1, old.unlocked)) : 1,
  best: Number.isSafeInteger(old?.best) && old.best >= 0 ? old.best : 0,
  sound: old?.sound !== false,
  played: old?.played === true
};
let storageOK = true;
function store(soundChanged = false) {
  // Another open field can have a higher count or a later evening.
  const latest = readJson(key);
  if (Number.isSafeInteger(latest?.best)) saved.best = Math.max(saved.best, latest.best);
  if (Number.isInteger(latest?.unlocked)) saved.unlocked = Math.min(10, Math.max(saved.unlocked, latest.unlocked));
  if (latest?.played === true) saved.played = true;
  if (!soundChanged && typeof latest?.sound === 'boolean') saved.sound = latest.sound;
  storageOK = writeJson(key, saved);
}

const audio = sound({ on: () => saved.sound });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let mode = 'campaign', level = saved.unlocked, wave = 1, carried = 0, endlessSeed = 0;
let game, screen, lastFrame = null, owner = null, target = null, fromFields = 'paused';
let gestureStart = null, tutorialMoved = false;
let endWait = 0, message = '', messageUntil = 0, clock = 0;

function release() {
  const previous = owner;
  owner = null;
  target = null;
  gestureStart = null;
  if (previous !== null && canvas.hasPointerCapture(previous)) canvas.releasePointerCapture(previous);
}
const display = screens(['paused', 'evenings-screen', 'end'], id => {
  screen = id === 'evenings-screen' ? 'evenings' : id;
  document.querySelector('.folio').inert = screen !== 'play';
  if (screen !== 'play') el(id).querySelector('button:not([hidden]):not(:disabled)')?.focus({preventScroll: true});
  lastFrame = null;
});
function describe() {
  return mode === 'campaign' ? 'Evening ' + String(level).padStart(2, '0') + ' / 10' : 'Count them home · Flock ' + wave;
}
function fresh() {
  release();
  tutorialMoved = false;
  const seed = mode === 'campaign' ? level : (endlessSeed + Math.imul(wave, 2654435761)) >>> 0;
  game = createGame(mode === 'campaign' ? level : 10 + wave, seed);
  message = '';
  endWait = 0;
  el('chapter').textContent = describe();
  el('total').textContent = game.sheep.length;
  display('play');
  updateLedger();
}
function campaign(n) {
  mode = 'campaign';
  level = n;
  wave = 1;
  carried = 0;
  fresh();
}
function endless() {
  mode = 'endless';
  wave = 1;
  carried = 0;
  endlessSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  fresh();
}
function recordCount() {
  if (mode === 'endless' && carried + game.home > saved.best) {
    saved.best = carried + game.home;
    store();
  }
}
function say(line) {
  message = line;
  messageUntil = game.time + 3;
}
function setText(id, value) {
  const node = el(id);
  if (node.textContent !== String(value)) node.textContent = value;
}
function updateLedger() {
  setText('home', game.home);
  const seconds = Math.max(0, Math.ceil(game.limit - game.time));
  setText('time', Math.floor(seconds / 60) + '∶' + String(seconds % 60).padStart(2, '0'));
  el('light').style.transform = 'scaleX(' + Math.max(0, 1 - game.time / game.limit) + ')';
  setText('score', mode === 'campaign' ? game.score + ' points' : (carried + game.home) + ' counted · best ' + saved.best);
  setText('remark', !storageOK ? 'Saved for this session only' : message && game.time < messageUntil ? message : '');
}
function syncSound() {
  el('sound').textContent = saved.sound ? 'Sound on' : 'Sound off';
  el('sound').setAttribute('aria-pressed', String(saved.sound));
}
function finish() {
  release();
  const won = game.status === 'won';
  el('end-caption').textContent = describe();
  const missing = game.sheep.find(sheep => sheep.status === 'lost');
  el('end-title').textContent = won ? 'All safely in' : missing ? (missing.lostTo === 'woods' ? 'Lost in the woods' : 'Lost to the stream') : 'Night has fallen';
  el('end-line').textContent = game.home + ' of ' + game.sheep.length + ' in the fold' +
    (game.rescued ? ' · ' + game.rescued + (game.rescued === 1 ? ' stray brought back' : ' strays brought back') : '') + '.';
  el('end-score').textContent = (mode === 'endless' ? game.score + ' points this flock · ' + (carried + game.home) + ' counted · device best ' + saved.best : game.score + ' points') +
    (storageOK ? '' : ' · this session only');
  el('next').hidden = !won;
  el('next').textContent = mode === 'endless' ? 'Next flock' : level === 10 ? 'Count them home ∞' : 'Next evening';
  el('retry').textContent = mode === 'endless' ? 'New count' : 'Try again';
  display('end');
  if (won) audio.tone(784, .45, .045, 'sine', 24);
}
function pause() {
  if (screen !== 'play') return;
  if (game.status !== 'play') { finish(); return; }
  release();
  audio.hold();
  el('pause-chapter').textContent = describe();
  syncSound();
  display('paused');
}
function resume() {
  if (screen !== 'paused') return;
  display('play');
  audio.release();
}
function fields() {
  fromFields = screen;
  el('levels').replaceChildren();
  for (let n = 1; n <= 10; n++) {
    const b = document.createElement('button');
    b.textContent = String(n).padStart(2, '0');
    b.disabled = n > saved.unlocked;
    b.setAttribute('aria-label', 'Evening ' + n);
    if (mode === 'campaign' && level === n) b.setAttribute('aria-current', 'step');
    b.onclick = () => campaign(n);
    el('levels').append(b);
  }
  el('record').textContent = 'Endless · device best ' + saved.best + (storageOK ? '' : ' · this session only');
  display('evenings-screen');
}
el('pause').onclick = pause;
el('resume').onclick = resume;
el('evenings').onclick = fields;
el('end-evenings').onclick = fields;
el('back').onclick = () => display(fromFields);
el('endless').onclick = endless;
el('retry').onclick = () => mode === 'endless' ? endless() : campaign(level);
el('next').onclick = () => {
  if (mode === 'endless') {
    carried += game.home;
    wave++;
    fresh();
  } else if (level === 10) endless();
  else campaign(level + 1);
};
el('sound').onclick = () => {
  saved.sound = !saved.sound;
  store(true);
  syncSound();
  if (saved.sound) {
    audio.release();
    audio.unlock();
    audio.tone(523, .16, .03);
  } else audio.hold();
};
onLeave(pause);
matchMedia('(orientation: portrait)').addEventListener('change', () => {
  if (game.started || owner !== null) pause();
});
addEventListener('keydown', event => {
  if (!isPauseKey(event) || event.repeat) return;
  if (screen === 'play') pause();
  else if (screen === 'paused') resume();
  else if (screen === 'evenings') display(fromFields);
  event.preventDefault();
});

// The dog's destination is the absolute contact position on the pasture.
function point(event) {
  const r = canvas.getBoundingClientRect();
  return {
    x: 360 * Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)),
    y: 520 * Math.min(1, Math.max(0, (event.clientY - r.top) / r.height))
  };
}
canvas.addEventListener('pointerdown', event => {
  if (screen !== 'play' || game.status !== 'play' || owner !== null || !event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  owner = event.pointerId;
  target = point(event);
  gestureStart = target;
  try { canvas.setPointerCapture(owner); } catch { /* Dispatched pointers have no capture. */ }
  audio.release();
  audio.unlock();
  help.done();
  if (!saved.played) { saved.played = true; store(); }
  // A quick tap can end between two animation frames. Accept its first step here.
  if (!game.started) step(game, 1 / 60, target);
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== owner) return;
  target = point(event);
  if (!tutorialMoved && Math.hypot(target.x - gestureStart.x, target.y - gestureStart.y) >= 14) tutorialMoved = true;
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(event, e => { if (e.pointerId === owner) release(); });
}
const help = hint(canvas, {
  kind: 'hold-and-move', key: 'night-flock:hint', played: saved.played,
  // The first pasture already draws the uphill gesture on the dog itself.
  when: () => screen === 'play' && !game.started &&
    (reducedMotion.matches || ['ring', 'hand'].includes(query.get('hint')) || mode === 'endless' || level > 1),
  delay: 8500, reach: 27, label: 'Guide the dog behind the sheep',
  bottom: () => innerHeight - canvas.getBoundingClientRect().bottom + canvas.clientHeight * .2
});

function resize() {
  const scale = Math.min(2, devicePixelRatio || 1);
  const box = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(box.width * scale));
  canvas.height = Math.max(1, Math.round(box.height * scale));
}
function paint() {
  ctx.setTransform(canvas.width / 360, 0, 0, canvas.height / 520, 0, 0);
  const guide = mode === 'campaign' && level === 1 && !tutorialMoved && !target && game.status === 'play'
    && !help.shown && query.get('hint') !== '0';
  draw(ctx, game, { clock: reducedMotion.matches && (!game.started || guide) ? 1.7 : clock, look, pressed: target, guide });
}
function frame(now) {
  const dt = lastFrame === null ? 0 : Math.min(.12, (now - lastFrame) / 1000);
  lastFrame = now;
  if (screen === 'play') {
    clock += reducedMotion.matches && !game.started ? 0 : dt;
    if (game.status === 'play') {
      const home = game.home, rescued = game.rescued, lost = game.lost;
      step(game, dt, target);
      if (game.home > home) {
        recordCount();
        audio.tone([392, 494, 587, 659][(game.home - 1) % 4], .24, .035, 'sine');
      }
      if (game.rescued > rescued) say('Stray brought home +' + RESCUE_POINTS.toLocaleString());
      else if (game.lost > lost) say('Lost from the flock');
      if (game.status !== 'play') {
        if (game.status === 'won' && mode === 'campaign' && level < 10 && saved.unlocked <= level) {
          saved.unlocked = level + 1;
          store();
        }
        release();
        endWait = .65;
      }
      updateLedger();
    } else if ((endWait -= dt) <= 0) finish();
    paint();
  }
  requestAnimationFrame(frame);
}
fresh();
new ResizeObserver(() => { resize(); paint(); }).observe(canvas);
resize();
paint();
requestAnimationFrame(frame);

// Read-only snapshot for phone checks. It cannot steer the dog or advance time.
window.flockState = () => structuredClone({game, screen, mode, wave, saved, pressed: owner !== null});
