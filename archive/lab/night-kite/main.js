import { createFlight, step, windAt, flightConditions } from './sim.js';
import { draw } from './art.js';
import { sound } from '../../kit/audio.js';
import { hint } from '../../kit/hint.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { readJson, writeJson } from '../../kit/save.js';
import { screens } from '../../kit/screens.js';
import { stick } from '../../kit/stick.js';
import { noZoom } from '../../kit/zoom.js';

noZoom();
const el = id => document.getElementById(id);
const field = el('field');
const ctx = field.getContext('2d');
const key = 'night-kite:save';
const old = readJson(key, {});
const integer = (value, fallback, min, max) => Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
const unlocked = integer(old.unlocked, 1, 1, 10);
const saved = {
  v: 1, unlocked, level: integer(old.level, unlocked, 1, unlocked),
  best: integer(old.best, 0, 0, Number.MAX_SAFE_INTEGER),
  sound: old.sound !== false, look: old.look === 'copper' ? 'copper' : 'indigo'
};
const queryLook = new URLSearchParams(location.search).get('look');
if (['indigo', 'copper'].includes(queryLook)) saved.look = queryLook;
let canSave = true;
function store() {
  const latest = readJson(key, {});
  saved.best = Math.max(saved.best, integer(latest.best, 0, 0, Number.MAX_SAFE_INTEGER));
  saved.unlocked = Math.max(saved.unlocked, integer(latest.unlocked, 1, 1, 10));
  canSave = writeJson(key, saved);
}
const audio = sound({ on: () => saved.sound });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let flight, screen, chartFrom, started, steered, control, frameTime, debt = 0, artTime = 0;
let spoolOffset = 0, pressedButton = null, celebration = null, revealAt = 0, lastPaint = -Infinity;
const heldKeys = new Set();
const display = screens(['paused', 'chart', 'result'], name => {
  screen = name;
  pressedButton = null;
  const playing = name === 'play';
  el('print').inert = !playing;
  if (!playing) el(name).querySelector('button:not([hidden]):not(:disabled)')?.focus({ preventScroll: true });
  frameTime = null;
  lastPaint = -Infinity;
  debt = 0;
});

// A stationary touch can finish a flight while the finger is still on the
// field. Its eventual click must not activate a button that just appeared.
for (const card of document.querySelectorAll('.sheet')) {
  card.addEventListener('pointerdown', e => { pressedButton = e.target.closest('button'); }, true);
  card.addEventListener('pointercancel', () => { pressedButton = null; }, true);
  card.addEventListener('click', e => {
    if (e.detail && e.target.closest('button') !== pressedButton) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
    pressedButton = null;
  }, true);
}

function setText(id, value) {
  const node = el(id);
  if (node.textContent !== value) node.textContent = value;
}
const flightLabel = () => flight.level ? 'Flight ' + String(flight.level).padStart(2, '0') + ' / 10' : 'Endless evening';
const showSpoolCue = () => flight.level === 1 && !steered && flight.status === 'play';
function instruments() {
  const { goal, level, done, total, score, storm, kite } = flight;
  setText('edition', flightLabel());
  const index = Math.min(total, done + 1);
  let counter = level ? 'Goal ' + index + ' / ' + total : score + ' pts';
  const conditions = flightConditions(flight);
  if (goal.kind === 'squall') counter += ' · ' + Math.floor(goal.progress * 100) + '%';
  if (conditions.remaining !== null) counter += ' · ' + Math.ceil(conditions.remaining) + ' s';
  if (conditions.exposure > .45) counter += ' · Seek shelter';
  setText('counter', showSpoolCue() ? 'Drag the spool' : counter);
  setText('objective', goal.kind === 'ring' ? 'Thread the birds' : goal.kind === 'squall' ? 'Hold in the squall' : goal.carrying ? 'Lift to the rooftop' : 'Catch the lantern');
  const w = windAt(flight, kite.x, kite.y);
  const labels = { steady: 'Breeze', gust: 'Gust', lull: 'Lull', thermal: 'Thermal', squall: 'Squall' };
  setText('weather', labels[conditions.wind]);
  el('needle').style.transform = 'rotate(' + Math.atan2(w.y, w.x) + 'rad)';
}
function settings() {
  document.body.dataset.look = saved.look;
  setText('look', saved.look === 'copper' ? 'Ink · Copper' : 'Ink · Indigo');
  setText('sound', saved.sound ? 'Sound on' : 'Sound off');
  el('sound').setAttribute('aria-pressed', String(saved.sound));
}
function begin(level) {
  const seed = level ? 171 + (level - 1) * 157 : crypto.getRandomValues(new Uint32Array(1))[0];
  flight = createFlight(level, seed);
  started = false;
  steered = false;
  control = { ...flight.control };
  pad.drop();
  heldKeys.clear();
  artTime = 0;
  celebration = null;
  revealAt = 0;
  if (level && saved.level !== level) { saved.level = level; store(); }
  audio.release();
  display('play');
  instruments();
  paint();
}
function pause() {
  if (screen !== 'play') return;
  if (flight.status !== 'play') { result(); return; }
  pad.drop();
  heldKeys.clear();
  audio.hold();
  el('finish').hidden = flight.level !== 0;
  setText('paused-flight', flightLabel());
  display('paused');
}
function resume() {
  audio.release();
  display('play');
  field.focus({ preventScroll: true });
}
function record() {
  if (flight.level || flight.score <= saved.best) return;
  saved.best = flight.score;
  store();
}
function result() {
  pad.drop();
  heldKeys.clear();
  const won = flight.status === 'won';
  const endless = flight.level === 0;
  if (won && flight.level < 10) {
    saved.unlocked = Math.max(saved.unlocked, flight.level + 1);
    saved.level = flight.level + 1;
    store();
  }
  record();
  const count = flight.done + (flight.done === 1 ? ' goal' : ' goals');
  setText('result-flight', flightLabel());
  setText('result-title', won ? (flight.level === 10 ? 'All ten flown' : 'Flight complete') : flight.status === 'landed' ? 'Kite landed' : 'Flight ended');
  setText('result-detail', endless ? flight.score + ' points · device best ' + saved.best + (canSave ? '' : ' (this session only)') : count + ' completed · ' + flight.t.toFixed(1) + ' s');
  el('next').hidden = !won;
  setText('next', flight.level === 10 ? 'Endless evening' : 'Next flight');
  display('result');
  if (started) audio.tone(won ? 740 : 247, .28, .048, 'sine', won ? 185 : -60);
}
function chart() {
  chartFrom = screen;
  el('levels').replaceChildren();
  for (let n = 1; n <= 10; n++) {
    const button = document.createElement('button');
    button.dataset.level = n;
    button.textContent = String(n).padStart(2, '0');
    button.setAttribute('aria-label', 'Flight ' + n);
    button.disabled = n > saved.unlocked;
    if (n === flight.level) button.setAttribute('aria-current', 'step');
    button.onclick = () => begin(n);
    el('levels').append(button);
  }
  setText('record', 'Device best · ' + saved.best + ' points' + (canSave ? '' : ' (this session only)'));
  display('chart');
}
el('pause').onclick = pause;
el('resume').onclick = resume;
el('chart-open').onclick = el('result-chart').onclick = chart;
el('chart-back').onclick = () => display(chartFrom);
el('endless').onclick = () => begin(0);
el('next').onclick = () => begin((flight.level + 1) % 11);
el('retry').onclick = () => begin(flight.level);
el('finish').onclick = () => { flight.status = 'landed'; result(); };
el('sound').onclick = () => {
  saved.sound = !saved.sound;
  settings();
  store();
  if (saved.sound) { audio.release(); audio.tone(523, .12, .035); }
  else audio.hold();
};
el('look').onclick = () => {
  saved.look = saved.look === 'indigo' ? 'copper' : 'indigo';
  settings();
  store();
  paint();
};
onLeave(pause);

// Use the kit's captured first pointer. Its absolute contact sets the hand and
// spool, so a stationary finger still has a position while the kite settles.
const pad = stick(field, { when: () => screen === 'play', reach: 60, leash: 90 });
function grip() {
  if (started) return;
  started = true;
  audio.unlock();
  audio.tone(330, .12, .035, 'triangle', 46);
}
function readHand(initial = false) {
  const touch = pad.touch;
  if (!touch || screen !== 'play') return;
  const bounds = field.getBoundingClientRect();
  const y = 520 * (touch.y - bounds.top) / bounds.height;
  // In flight one, a beginner may put a finger on the pictured kite or birds.
  // Start a sky grip at the current payout. Further vertical travel winds or
  // unwinds the spool at the usual rate, with no force applied to the kite.
  if (initial) spoolOffset = flight.level === 1 && y < 335 ? flight.control.y - y : 0;
  if (Math.hypot(touch.x - touch.ox, touch.y - touch.oy) >= 8) steered = true;
  control = {
    x: 360 * (touch.x - bounds.left) / bounds.width,
    y: y + spoolOffset
  };
}
field.addEventListener('pointerdown', e => {
  if (pad.touch?.id === e.pointerId) { grip(); readHand(true); }
});
field.addEventListener('pointermove', () => readHand());
addEventListener('keydown', e => {
  if (isPauseKey(e)) {
    if (e.repeat) return;
    if (screen === 'play') pause();
    else if (screen === 'paused') resume();
    else if (screen === 'chart') display(chartFrom);
    e.preventDefault();
  } else if (screen === 'play' && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault();
    grip();
    steered = true;
    heldKeys.add(e.key);
  }
});
addEventListener('keyup', e => heldKeys.delete(e.key));
hint(field, {
  kind: 'hold-and-move', key: 'night-kite:hint', when: () => screen === 'play' && !started,
  played: old.unlocked > 1, delay: 6500, label: 'Move the spool',
  bottom: () => innerHeight - field.getBoundingClientRect().bottom + field.clientHeight * .17
});
function tick() {
  if (heldKeys.size) {
    control.x = Math.max(0, Math.min(360, control.x + 3 * (heldKeys.has('ArrowRight') - heldKeys.has('ArrowLeft'))));
    control.y = Math.max(0, Math.min(520, control.y + 3 * (heldKeys.has('ArrowDown') - heldKeys.has('ArrowUp'))));
  }
  if (flight.status !== 'play') return;
  const { done, goal } = flight;
  step(flight, control);
  if (flight.done !== done) {
    celebration = { ...goal, at: artTime };
    record();
    if (flight.status === 'play') audio.tone(660, .22, .045, 'triangle', 170);
  } else if (!goal.carrying && flight.goal.carrying) {
    audio.tone(494, .19, .04, 'sine', 85);
  }
  if (flight.status === 'won') {
    revealAt = artTime + (reducedMotion.matches ? .22 : .72);
    audio.tone(587, .26, .045, 'triangle', 95);
  } else if (flight.status === 'lost') { instruments(); paint(); result(); }
}
function paint() {
  const w = Math.max(1, Math.round(field.clientWidth * Math.min(devicePixelRatio || 1, 2)));
  const h = Math.max(1, Math.round(w * 520 / 360));
  if (field.width !== w || field.height !== h) { field.width = w; field.height = h; }
  ctx.setTransform(w / 360, 0, 0, h / 520, 0, 0);
  draw(ctx, flight, { look: saved.look, intro: showSpoolCue(), time: artTime, celebration });
}
function frame(now) {
  if (screen === 'play') {
    const dt = frameTime === null ? 0 : Math.min(.125, (now - frameTime) / 1000);
    frameTime = now;
    if (started || !reducedMotion.matches) artTime += dt;
    if (started) {
      debt += dt;
      while (debt >= 1 / 60 && screen === 'play') { debt -= 1 / 60; tick(); }
    }
    if (screen === 'play') {
      // The idle landscape moves slowly. Keep the physics and touch sampling
      // independent of how often it needs another painted frame.
      if (now - lastPaint >= (started ? 1000 / 60 - 1 : 1000 / 24 - 1)) {
        paint();
        instruments();
        lastPaint = now;
      }
      if (flight.status === 'won' && artTime >= revealAt) result();
    }
  }
  requestAnimationFrame(frame);
}
window.kiteState = () => ({
  screen, started, level: flight.level, t: flight.t, line: flight.line, tension: flight.tension,
  kite: { ...flight.kite }, hand: { ...flight.hand }, goal: { ...flight.goal }, done: flight.done,
  total: flight.total, score: flight.score, status: flight.status, storm: flight.storm,
  best: saved.best, unlocked: saved.unlocked, sound: saved.sound, look: saved.look
});
settings();
begin(saved.level);
requestAnimationFrame(frame);
