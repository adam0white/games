import { sound } from '../../kit/audio.js';
import { drag } from '../../kit/drag.js';
import { hint } from '../../kit/hint.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { read, readNumber, write } from '../../kit/save.js';
import { screens } from '../../kit/screens.js';
import { noZoom } from '../../kit/zoom.js';
import { draw } from './art.js';
import { distanceAngle, expose, makePlate, optics, PLATES, turn } from './sim.js';

const el = id => document.getElementById(id);
const canvas = el('field'), ctx = canvas.getContext('2d'), slider = el('angle');
const key = 'night-splitlight:';
const look = new URLSearchParams(location.search).get('look') === 'oxide' ? 'oxide' : 'nocturne';
document.documentElement.dataset.look = look;
noZoom();
const lastPlate = () => Math.min(PLATES.length, Math.max(1, Math.trunc(readNumber(key + 'plate', 1))));
let high = lastPlate(), audible = read(key + 'sound') !== 'off';
const audio = sound({ on: () => audible });
let state, field, screen, reveal = 0, previous = performance.now(), redraw = true;
let nextTickSound = 0;
const pitches = [261.63, 293.66, 329.63, 392, 440, 523.25];
const litCount = () => state.targets.filter(target => target.lit).length;
const show = screens(['paused', 'result'], name => {
  const returningToPlay = name === 'play' && (screen === 'paused' || screen === 'result');
  screen = name;
  document.querySelector('.instrument').inert = name === 'paused';
  el('pause').disabled = name === 'result';
  slider.disabled = name === 'result';
  document.body.classList.toggle('finished', name === 'result');
  previous = performance.now();
  if (returningToPlay) slider.focus({ preventScroll: true });
  else if (name !== 'play') el(name === 'paused' ? 'resume' : 'next').focus({ preventScroll: true });
});
function startPlate(level) {
  steering.reset();
  state = makePlate(level, 0x51e17 + level * 97);
  field = optics(state);
  reveal = 0;
  redraw = true;
  slider.value = Math.round(state.position * 1000);
  slider.setAttribute('aria-valuetext', Math.round(state.angle * 180 / Math.PI) + ' degrees');
  document.body.classList.toggle('guide', level === 1);
  el('plate').textContent = 'Plate ' + String(level).padStart(2, '0') + ' / 06';
  el('plate-name').textContent = PLATES[level - 1].name;
  el('captured').textContent = '0 / ' + state.targets.length;
  audio.release();
  show('play');
}
function aim(pos) {
  if (screen !== 'play' || state.won) return;
  advance(performance.now());
  if (state.won) return;
  turn(state, pos);
  const next = optics(state);
  // A glint sounds once as a wavelength crosses into its receiver.
  if (performance.now() >= nextTickSound) {
    const crossing = next.rays.find(ray => state.targets.some(target =>
      !target.lit && (target.band < 0 || target.band === ray.band)
      && ray.angle !== null && distanceAngle(ray.angle, target.angle) <= target.width
      && (field.rays[ray.band].angle === null || distanceAngle(field.rays[ray.band].angle, target.angle) > target.width)));
    if (crossing) {
      audio.tone(pitches[crossing.band], .12, .045, 'sine');
      nextTickSound = performance.now() + 70;
    }
  }
  field = next;
  redraw = true;
  slider.value = Math.round(state.position * 1000);
  slider.setAttribute('aria-valuetext', Math.round(state.angle * 180 / Math.PI) + ' degrees');
  document.body.classList.toggle('guide', state.level === 1 && state.position < .3);
  help.done();
}
function pause() {
  if (screen !== 'play') return;
  advance(performance.now());
  if (screen !== 'play') return;
  steering.reset();
  audio.hold();
  show('paused');
}
function resume() {
  if (screen !== 'paused') return;
  audio.release();
  show('play');
}
el('pause').onclick = pause;
el('resume').onclick = resume;
onLeave(pause);
addEventListener('keydown', event => {
  if (!isPauseKey(event) || event.repeat || screen === 'result') return;
  event.preventDefault();
  if (screen === 'paused') resume(); else pause();
});
function restart(level) { startPlate(level); audio.unlock(); }
el('restart').onclick = el('again').onclick = () => restart(state.level);
el('next').onclick = () => restart(state.level === PLATES.length ? 1 : state.level + 1);
el('first').onclick = () => restart(1);
function soundLabel() {
  el('sound').textContent = audible ? 'Sound on' : 'Sound off';
  el('sound').setAttribute('aria-pressed', String(audible));
}
el('sound').onclick = () => {
  audible = !audible;
  write(key + 'sound', audible ? 'on' : 'off');
  soundLabel();
};
soundLabel();

slider.addEventListener('pointerdown', () => audio.unlock());
slider.addEventListener('input', () => { audio.unlock(); aim(Number(slider.value) / 1000); });
canvas.style.touchAction = 'none';
let mouseX = null;
canvas.addEventListener('pointerdown', event => {
  if (screen !== 'play' || !event.isPrimary || event.button !== 0) { event.stopImmediatePropagation(); return; }
  canvas.setPointerCapture(event.pointerId);
  mouseX = event.clientX;
  audio.unlock();
});
canvas.addEventListener('lostpointercapture', event => { if (event.isPrimary) steering.drop(); });
const steering = drag(canvas, {
  playing: () => screen === 'play' && !state.won, paused: () => false, resume,
  from: () => state.position, travel: dx => dx / (canvas.clientWidth * .7),
  aim: position => {
    aim(position);
    if (position < 0 || position > 1) steering.rebase();
  },
  settle: 0,
  mouse: event => {
    if ((event.buttons & 1) && mouseX !== null) {
      aim(state.position + (event.clientX - mouseX) / (canvas.clientWidth * .7));
      mouseX = event.clientX;
    }
  },
});
const help = hint(document.querySelector('.cue'), {
  kind: 'drag', key: key + 'hint', played: high > 1, delay: 2200, reach: 37,
  when: () => screen === 'play' && state.level === 1 && !state.started,
  label: 'Slide right to turn the prism',
});

new ResizeObserver(() => { redraw = true; }).observe(canvas);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function paint(time) {
  const scale = Math.min(devicePixelRatio || 1, 2) * canvas.clientWidth / 360;
  const w = Math.round(360 * scale), h = Math.round(400 * scale);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(w / 360, 0, 0, h / 400, 0, 0);
  draw(ctx, state, field, time, look);
  redraw = false;
}
function finishPlate() {
  high = Math.max(high, lastPlate(), Math.min(PLATES.length, state.level + 1));
  const saved = write(key + 'plate', high);
  el('result-line').textContent = saved ? '' : 'Progress lasts for this session.';
  audio.tone(784, .62, .045, 'sine');
  const finale = state.level === PLATES.length;
  el('result-title').textContent = finale ? 'Spectrum complete' : 'Plate exposed';
  el('next').textContent = finale ? 'Play from the start' : 'Next plate';
  slider.disabled = true;
  document.body.classList.remove('guide');
}
// Integrate dwell at the previous angle before a gesture changes the optics.
// With constant rays the exposure rate is constant, even between display frames.
function advance(now) {
  const dt = Math.max(0, (now - previous) / 1000);
  previous = Math.max(previous, now);
  if (screen !== 'play') return;
  if (state.won) {
    reveal += dt;
    if (reveal > (reducedMotion.matches ? .45 : 1.05)) show('result');
    return;
  }
  if (!state.started) return;
  const charge = state.targets.reduce((sum, t) => sum + t.charge, 0);
  const before = litCount();
  expose(state, field, dt);
  const count = litCount();
  if (charge !== state.targets.reduce((sum, t) => sum + t.charge, 0)) redraw = true;
  if (count === before) return;
  el('captured').textContent = count + ' / ' + state.targets.length;
  audio.tone(330 * 2 ** (count / 6), .35, .09, 'sine');
  if (state.won) finishPlate();
}
function frame(now) {
  advance(now);
  if (redraw) paint(now / 1000);
  requestAnimationFrame(frame);
}
startPlate(high);
paint(0);
window.splitlightState = () => ({
  level: state.level, position: state.position, elapsed: state.elapsed, started: state.started,
  won: state.won, screen, sound: audible, targets: state.targets.map(target => ({ ...target })),
});
requestAnimationFrame(frame);
