import { create, grab, pull, release, tick, cancel, TICK, plates, MAX_PULL } from './sim.js';
import { draw } from './art.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { hint } from '../../kit/hint.js';
import { screens } from '../../kit/screens.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { lab } from '../../kit/lab.js';
import { noZoom } from '../../kit/zoom.js';

noZoom();
const $ = id => document.getElementById(id);
const board = $('board'), ctx = board.getContext('2d');
const key = 'night-podwire:progress';
function readSave() {
  const stored = readJson(key);
  return stored?.v === 1 && Number.isInteger(stored.next) && stored.next >= 1 && stored.next <= plates.length
    ? stored : null;
}
const stored = readSave();
const save = stored ? { v: 1, next: stored.next, complete: stored.complete === true, sound: stored.sound !== false }
  : { v: 1, next: 1, complete: false, sound: true };
const audio = sound({ on: () => save.sound });
const look = new URLSearchParams(location.search).get('look') === 'blueprint' ? 'blueprint' : 'herbarium';
document.documentElement.dataset.look = look;
document.querySelector('meta[name="theme-color"]').content = look === 'blueprint' ? '#15374b' : '#f5efde';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI'];
let state, screen, pointer = null, last = 0, carry = 0, knownOpened = 0, winTime = null;
let lastPluck = -Infinity;
const show = screens(['paused', 'won'], name => {
  screen = name;
  $('pause').disabled = name !== 'play';
  $('folio').inert = name === 'paused';
});
function store(toggleSound = false) {
  const latest = readSave();
  if (latest) {
    save.next = Math.max(save.next, latest.next);
    save.complete ||= latest.complete === true;
    if (typeof latest.sound === 'boolean') save.sound = latest.sound;
  }
  if (toggleSound) save.sound = !save.sound;
  $('status').textContent = writeJson(key, save) ? '' : 'Progress saved for this visit only.';
}
function updateFooter() {
  const n = state.pods.length;
  $('count').textContent = screen === 'won' && state.level === plates.length ? 'Six plates collected'
    : knownOpened + ' / ' + n + (n === 1 ? ' pod open' : ' pods open');
  [...$('marks').children].forEach((mark, i) => {
    mark.className = i === state.level - 1 ? 'current' : i < save.next - 1 || save.complete ? 'done' : '';
  });
}
// Play recording for the game lab: one run is one plate, from the first pull of the wire to all pods open,
// a restart, or leaving it for another plate.
const rec = lab('night-podwire');
let running = false;
function recEnd(outcome) {
  if (!running) return;
  running = false;
  rec.end(outcome, { plate: state.level, plucks: state.plucks, opened: knownOpened, pods: state.pods.length, secs: Math.round(state.time * 10) / 10 });
}
function start(level) {
  recEnd('quit');
  state = create(level, level * 417);
  pointer = null; last = 0; carry = 0; knownOpened = 0; winTime = null;
  lastPluck = -Infinity;
  const plate = plates[level - 1];
  $('number').textContent = 'Plate ' + numerals[level - 1] + ' of VI';
  $('species').textContent = plate.name;
  $('latin').textContent = plate.latin;
  $('next').textContent = level === plates.length ? 'Play again ↻' : 'Next plate →';
  audio.release(); show('play'); updateFooter();
}
function abandonGrip() {
  const previous = pointer;
  if (previous === null) return;
  pointer = null;
  cancel(state);
  if (board.hasPointerCapture(previous)) board.releasePointerCapture(previous);
}
function pause() {
  if (screen !== 'play') return;
  abandonGrip(); audio.hold(); show('paused');
  $('sound').textContent = save.sound ? 'Sound on' : 'Sound off';
  $('resume').focus({ preventScroll: true });
}
function resume() {
  last = 0; audio.release(); show('play');
}
$('pause').onclick = pause;
$('resume').onclick = resume;
$('retry').onclick = () => start(state.level);
$('next').onclick = () => { nextHint.done(); start(state.level % plates.length + 1); };
$('sound').onclick = () => {
  store(true);
  $('sound').textContent = save.sound ? 'Sound on' : 'Sound off';
  updateFooter();
};
onLeave(pause);
new ResizeObserver(abandonGrip).observe(board);
addEventListener('keydown', e => {
  if (isPauseKey(e) && !e.repeat) {
    if (screen === 'paused') resume(); else pause();
  }
});
function world(e) {
  const r = board.getBoundingClientRect();
  return { x: (e.clientX - r.left) * 360 / r.width, y: (e.clientY - r.top) * 380 / r.height };
}
board.addEventListener('pointerdown', e => {
  if (screen !== 'play' || pointer !== null || e.button !== 0) return;
  const { x, y } = world(e);
  if (!grab(state, x, y)) return;
  pointer = e.pointerId; board.setPointerCapture(pointer); audio.unlock();
});
board.addEventListener('pointermove', e => {
  if (e.pointerId === pointer) pull(state, world(e).y);
});
board.addEventListener('pointerup', e => {
  if (e.pointerId !== pointer) return;
  pull(state, world(e).y);
  const depth = state.grip.depth;
  const index = state.grip.i;
  pointer = null;
  if (release(state)) {
    lastPluck = state.time;
    const pitch = 132 + 1.8 * index;
    audio.tone(pitch, .54, .02 + depth / MAX_PULL * .12, 'triangle', -9);
    audio.tone(pitch * 2, .19, .035, 'sine');
  }
});
for (const event of ['lostpointercapture', 'pointercancel']) {
  board.addEventListener(event, e => { if (e.pointerId === pointer) abandonGrip(); });
}
start(save.next);
// The gesture must be shown on the playable length of wire. On the result,
// the kit's tap hint can point directly to the next-plate button.
const nextHint = hint($('next'), {
  kind: 'tap', key: 'night-podwire:next-hint', when: () => screen === 'won' && state.level === 1,
  played: save.next > 1, delay: 5500, label: 'Next plate',
  bottom: () => innerHeight - $('next').getBoundingClientRect().top - $('next').offsetHeight / 2,
});
const hintBox = $('won').querySelector('.kit-hint');
function inWorldCue() {
  return screen === 'play' && !state.won && !state.grip &&
    (state.plucks === 0 || (!knownOpened && state.time - lastPluck > 2.8));
}
function frame(now) {
  if (screen !== 'paused') {
    carry += last ? Math.min(.1, (now - last) / 1000) : 0;
    while (carry >= TICK) { tick(state); carry -= TICK; }
    const opened = state.pods.filter(pod => pod.open).length;
    if (opened > knownOpened) {
      knownOpened = opened;
      audio.noise(.075, .09, 3100);
      audio.tone(440 * 2 ** (opened / 5), .35, .065);
      updateFooter();
    }
    if (!running && winTime === null && state.plucks > 0 && screen === 'play') { running = true; rec.start({ plate: state.level, pods: state.pods.length }); }
    if (state.won && winTime === null) {
      winTime = state.time;
      rec.event('plate-complete', { plate: state.level, plucks: state.plucks });
      recEnd('won');
      save.next = Math.max(save.next, Math.min(plates.length, state.level + 1));
      save.complete ||= state.level === plates.length;
      store();
    }
    if (state.won && screen === 'play' && state.time - winTime >= .65) {
      show('won'); updateFooter();
      if (hintBox) {
        const rect = $('next').getBoundingClientRect();
        hintBox.style.left = (rect.left + rect.width / 2) + 'px';
      }
    }
  }
  last = now;
  const resolution = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(board.clientWidth * resolution));
  const h = Math.max(1, Math.round(board.clientHeight * resolution));
  if (board.width !== w || board.height !== h) { board.width = w; board.height = h; }
  ctx.setTransform(w / 360, 0, 0, h / 380, 0, 0);
  draw(ctx, state, { look, cue: inWorldCue(), reduced: reduced.matches });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.podwireView = () => ({
  level: state.level, screen, grip: state.grip?.i ?? null, opened: knownOpened, total: state.pods.length,
  plucks: state.plucks, time: state.time, cue: inWorldCue(), sound: save.sound, wire: state.u.slice(),
  pods: state.pods.map(({x,height,open}) => ({x,height,open})), zones: state.zones.map(z => [...z]),
});

// The notice is under the plate from the first moment (this page has no start card); the switch is on the pause card.
rec.notice(document.querySelector('footer'));
rec.toggle(document.querySelector('#paused .sheet'));
