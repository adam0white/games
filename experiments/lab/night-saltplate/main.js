import { LEVELS, createPlate, tick } from './sim.js';
import { drawPlate } from './art.js';
import { sound } from '../../kit/audio.js';
import { hint } from '../../kit/hint.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { readJson, writeJson } from '../../kit/save.js';
import { screens } from '../../kit/screens.js';
import { noZoom } from '../../kit/zoom.js';

noZoom();
const byId = id => document.getElementById(id);
const work = byId('work');
const tuner = byId('tuner');
const plate = byId('plate');
const ctx = plate.getContext('2d');
const instruction = document.querySelector('.instruction');
const tuningInstruction = instruction.textContent;
const key = 'night-saltplate:save';
const prefs = readJson(key, {});
const clearCount = value => Number.isInteger(value) && value >= 0 && value <= LEVELS.length ? value : 0;
let cleared = clearCount(prefs.cleared);
const queryLook = new URLSearchParams(location.search).get('look');
let look = (queryLook ?? prefs.look) === 'oxide' ? 'oxide' : 'blue';
let audible = prefs.sound !== false;
let state, drive, active, screen, lastTime, debt = 0, needsPaint = true;
let oscillator, overtone, gain;
const pitch = () => Math.round(110 + 330 * drive);
const audio = sound({ on: () => audible, setup(ac) {
  // A bow rubbing a plate sustains the note while the grains settle.
  oscillator = ac.createOscillator();
  overtone = ac.createOscillator();
  const upperGain = ac.createGain();
  gain = ac.createGain();
  gain.gain.value = 0;
  upperGain.gain.value = .13;
  oscillator.type = 'sine';
  overtone.type = 'sine';
  oscillator.connect(gain);
  overtone.connect(upperGain).connect(gain);
  gain.connect(ac.destination);
  oscillator.start();
  overtone.start();
} });

function ring() {
  if (!audio.ctx || !gain) return;
  const now = audio.ctx.currentTime;
  oscillator.frequency.setTargetAtTime(pitch(), now, .045);
  overtone.frequency.setTargetAtTime(pitch() * 2.76, now, .055);
  gain.gain.setTargetAtTime(active && audible && screen === 'play' ? .043 : 0, now, .04);
}
function save() {
  cleared = Math.max(cleared, clearCount(readJson(key, {}).cleared));
  writeJson(key, { v: 1, cleared, look, sound: audible });
}
function settings() {
  document.body.dataset.look = look;
  byId('look').textContent = 'Finish · ' + (look === 'blue' ? 'Blue' : 'Oxide');
  byId('sound').textContent = audible ? 'Sound on' : 'Sound off';
  byId('sound').setAttribute('aria-pressed', String(audible));
  needsPaint = true;
}
const show = screens(['paused', 'result'], name => {
  screen = name;
  work.inert = name === 'paused';
  byId('controls').hidden = name === 'result';
  byId('pause').style.visibility = name === 'result' ? 'hidden' : '';
  if (name === 'paused') byId('resume').focus({ preventScroll: true });
  if (name === 'result') byId('next').focus({ preventScroll: true });
  lastTime = null;
  debt = 0;
  needsPaint = true;
  ring();
});
const two = number => String(number).padStart(2, '0');

function begin(level) {
  state = createPlate(level, 0x5517 + level * 177);
  drive = 0;
  active = false;
  instruction.textContent = tuningInstruction;
  tuner.value = '0';
  byId('frequency').value = pitch();
  tuner.setAttribute('aria-valuetext', pitch() + ' Hz');
  const spec = LEVELS[level - 1];
  byId('level-name').textContent = spec.name;
  byId('number').textContent = 'Plate ' + two(level) + ' / ' + two(LEVELS.length);
  byId('pause-plate').textContent = 'Plate ' + two(level) + ' · ' + spec.name;
  byId('notch').hidden = level !== 1;
  byId('notch').style.left = (spec.target * 100) + '%';
  tuner.parentElement.style.setProperty('--hint-x',
    'calc(' + spec.target * 100 + '% + ' + (16 - 32 * spec.target) + 'px)');
  byId('match-bar').style.transform = 'scaleX(0)';
  show('play');
}
function finish() {
  cleared = Math.max(cleared, state.level);
  save();
  active = false;
  const final = state.level === LEVELS.length;
  instruction.textContent = pitch() + ' Hz · ' + state.grains.length + ' grains of salt.';
  byId('result-label').textContent = 'Impression ' + two(state.level) + ' / ' + two(LEVELS.length);
  byId('result-title').textContent = final ? 'Set complete.' : 'Print taken.';
  byId('next').textContent = final ? 'Play from plate 01 ↺' : 'Next plate →';
  show('result');
  audio.tone(440, .32, .045);
  audio.tone(660, .5, .025);
}
function pause() {
  if (screen !== 'play') return;
  show('paused');
  audio.hold();
}
function resume() {
  if (screen !== 'paused') return;
  show('play');
  audio.release();
  tuner.focus({ preventScroll: true });
}
function tune() {
  if (screen !== 'play') return;
  active = true;
  drive = tuner.valueAsNumber / 1000;
  byId('frequency').value = pitch();
  tuner.setAttribute('aria-valuetext', pitch() + ' Hz');
  audio.unlock();
  ring();
  needsPaint = true;
}

tuner.addEventListener('pointerdown', tune);
tuner.addEventListener('input', tune);
byId('pause').addEventListener('click', pause);
byId('resume').addEventListener('click', resume);
byId('restart').addEventListener('click', () => { begin(state.level); audio.release(); });
byId('look').addEventListener('click', () => { look = look === 'blue' ? 'oxide' : 'blue'; settings(); save(); });
byId('sound').addEventListener('click', () => { audible = !audible; settings(); save(); });
// A finger released after the print appears still belongs to the tuner.
const result = byId('result');
let resultPress = null;
result.addEventListener('pointerdown', event => { resultPress = event.target.closest('button'); });
result.addEventListener('pointercancel', () => { resultPress = null; });
result.addEventListener('click', event => {
  if (event.detail && event.target.closest('button') !== resultPress) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  resultPress = null;
}, true);
byId('next').addEventListener('click', () => begin(state.level % LEVELS.length + 1));
byId('replay').addEventListener('click', () => begin(state.level));
onLeave(pause);
addEventListener('keydown', event => {
  if (isPauseKey(event) && !event.repeat) {
    event.preventDefault();
    if (screen === 'paused') resume(); else pause();
  }
  if (screen === 'play' && event.target !== tuner && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    tuner.focus({ preventScroll: true });
    tuner.valueAsNumber += event.key === 'ArrowLeft' ? -10 : 10;
    tune();
    event.preventDefault();
  }
});
function resize() {
  const side = Math.max(1, Math.round(plate.getBoundingClientRect().width * Math.min(2, devicePixelRatio)));
  if (side !== plate.width) plate.width = plate.height = side;
  needsPaint = true;
}
new ResizeObserver(resize).observe(plate);
function frame(now) {
  const dt = lastTime === null ? 0 : Math.min(.12, (now - lastTime) / 1000);
  lastTime = now;
  if (screen === 'play' && active) {
    debt += dt;
    while (debt >= 1 / 60) {
      debt -= 1 / 60;
      tick(state, drive);
      if (state.won) { finish(); break; }
    }
    byId('match-bar').style.transform = 'scaleX(' + state.match + ')';
    needsPaint = true;
  }
  if (needsPaint) {
    drawPlate(ctx, state, { look, drive, active: active && screen === 'play', time: state.t });
    needsPaint = false;
  }
  requestAnimationFrame(frame);
}
settings();
begin(cleared % LEVELS.length + 1);
resize();
requestAnimationFrame(frame);
hint(tuner, { kind: 'tap', key: 'night-saltplate:hint', when: () => screen === 'play' && state.level === 1,
  played: cleared > 0, delay: 2300, reach: 38, label: 'Touch the copper mark',
  bottom: () => innerHeight - tuner.getBoundingClientRect().top - tuner.offsetHeight / 2 });
window.saltplateState = () => ({
  level: state.level, screen, drive, active: active && screen === 'play', t: state.t,
  match: state.match, progress: state.progress, won: state.won, look, sound: audible, cleared
});
