import { LEVELS, SHAPES, createPlate, tick, setHandle, dailySpec, freeSpec } from './sim.js';
import { drawPlate, picture } from './art.js';
import { t, lang, setLang, apply, langs } from './words.js';
import { sound } from '../../kit/audio.js';
import { hint } from '../../kit/hint.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { readJson, writeJson } from '../../kit/save.js';
import { screens } from '../../kit/screens.js';
import { noZoom } from '../../kit/zoom.js';
import { lab } from '../../kit/lab.js';
import { shareImage } from '../../kit/share.js';

noZoom();
const byId = id => document.getElementById(id);
const work = byId('work');
const tuner = byId('tuner');
const plate = byId('plate');
const ctx = plate.getContext('2d');
const instruction = document.querySelector('.instruction');
// Saves: the first version's key and format are kept as they were; new state has new keys.
const key = 'night-saltplate:save';
const DAILY_KEY = 'night-saltplate:daily';
const FREE_KEY = 'night-saltplate:free';
const prefs = readJson(key, {});
const clearCount = value => Number.isInteger(value) && value >= 0 && value <= LEVELS.length ? value : 0;
let cleared = clearCount(prefs.cleared);
const query = new URLSearchParams(location.search);
const queryLook = query.get('look');
let look = (queryLook ?? prefs.look) === 'oxide' ? 'oxide' : 'blue';
let audible = prefs.sound !== false;
const today = /^\d{4}-\d{2}-\d{2}$/.test(query.get('date') || '') ? query.get('date') : new Date().toISOString().slice(0, 10);
const shapes = Object.keys(SHAPES);
let freeShape = shapes.includes(readJson(FREE_KEY, {}).shape) ? readJson(FREE_KEY, {}).shape : 'square';
const freeSpecs = Object.fromEntries(shapes.map(shape => [shape, freeSpec(shape)]));
let daily = null;
let mode = 'plates';
let state, drive, active, screen, lastTime, debt = 0, needsPaint = true;
let introStart = 0, litStart = -1, lockRung = -10, pictures = 0;
const pitch = () => Math.round(110 + 330 * drive);

// ---------- sound ----------
// The tuned tone is a bowed voice (a fundamental and a few harmonics through a soft low-pass), so a
// phone speaker that cannot play 110 Hz still gives its pitch. A second voice holds the drone.
let voice, drone, master;
function makeVoice(ac, wave, out) {
  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  const lfo = ac.createOscillator();
  const depth = ac.createGain();
  osc.setPeriodicWave(wave);
  filter.type = 'lowpass';
  filter.Q.value = 0.6;
  gain.gain.value = 0;
  lfo.frequency.value = 5.1;
  depth.gain.value = 0;
  lfo.connect(depth).connect(osc.frequency);
  osc.connect(filter).connect(gain).connect(out);
  osc.start();
  lfo.start();
  return { osc, filter, gain, depth };
}
const audio = sound({ on: () => audible, setup(ac) {
  const harmonics = [0, 1, 0.5, 0.34, 0.22, 0.13, 0.08, 0.05, 0.03];
  const wave = ac.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));
  master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);
  voice = makeVoice(ac, wave, master);
  drone = makeVoice(ac, wave, master);
} });
function setVoice(v, hz, level) {
  const now = audio.ctx.currentTime;
  v.osc.frequency.setTargetAtTime(hz, now, 0.045);
  v.filter.frequency.setTargetAtTime(Math.min(3600, hz * 7), now, 0.05);
  v.depth.gain.setTargetAtTime(hz * 0.004, now, 0.2);
  v.gain.gain.setTargetAtTime(level, now, level ? 0.06 : 0.04);
}
function ring() {
  if (!audio.ctx || !voice) return;
  const on = active && audible && screen === 'play';
  setVoice(voice, pitch(), on ? 0.05 : 0);
  const spec = state.spec;
  setVoice(drone, 110 + 330 * (spec.droneDrive ?? 0), on && spec.drone !== undefined ? 0.03 : 0);
}
// The plate's own ring: inharmonic partials, as a struck plate has, when a figure locks in.
function plateRing(hz) {
  const partials = [[1, 0.05, 1.8], [1.594, 0.03, 1.4], [2.136, 0.022, 1.1], [2.653, 0.016, 0.9], [3.156, 0.01, 0.7]];
  for (const [ratio, vol, dur] of partials) audio.tone(hz * ratio, dur, vol);
}
// A major chord on the plate's pitch for the print, and the hiss of salt hopping.
function printChord(hz) {
  const base = hz < 180 ? hz * 2 : hz;
  [1, 1.25, 1.5, 2].forEach((ratio, i) => setTimeout(() => audio.tone(base * ratio, 1.5 - i * 0.15, 0.045, 'triangle'), i * 70));
  setTimeout(() => audio.noise(0.35, 0.05, 6500), 60);
}

// ---------- save ----------
function save() {
  cleared = Math.max(cleared, clearCount(readJson(key, {}).cleared));
  writeJson(key, { v: 1, cleared, look, sound: audible });
}
function dailyRecord() {
  const saved = readJson(DAILY_KEY, {});
  return saved && saved.day === today ? saved : { v: 1, day: today, best: null, tries: 0 };
}

// ---------- words ----------
function settings() {
  document.body.dataset.look = look;
  byId('look').textContent = look === 'blue' ? t('finishBlue') : t('finishOxide');
  byId('sound').textContent = audible ? t('soundOn') : t('soundOff');
  byId('sound').setAttribute('aria-pressed', String(audible));
  byId('lang').textContent = t('language');
  byId('lang').hidden = langs.length < 2;
  needsPaint = true;
}
function texts() {
  apply();
  document.title = t('title');
  byId('title-a').textContent = t('titleA');
  byId('title-b').textContent = t('titleB');
  tuner.setAttribute('aria-label', t('tunerLabel'));
  plate.setAttribute('aria-label', t('plateLabel'));
  settings();
  if (state) caption();
}
const two = number => String(number).padStart(2, '0');
function specName(spec) {
  if (spec.level) return t('name-' + spec.level);
  const shape = SHAPES[spec.shape];
  return t('figure', { shape: t(spec.shape), n: shape.modes.findIndex(item => item.id === spec.mode) + 1 });
}
function caption() {
  const spec = state.spec;
  if (mode === 'free') {
    byId('number').textContent = t('freeCaption');
    byId('level-name').textContent = t(freeShape);
    instruction.textContent = t('freeLine');
    byId('shape').textContent = t('shapeButton', { shape: t(freeShape) });
  } else if (mode === 'daily') {
    byId('number').textContent = t('dailyCaption', { day: today });
    byId('level-name').textContent = specName(spec);
    instruction.textContent = t('dailyLine');
  } else {
    byId('number').textContent = t('plateNumber', { n: two(spec.level), total: two(LEVELS.length) });
    byId('level-name').textContent = specName(spec);
    if (screen !== 'result') instruction.textContent = t('idea-' + spec.level);
  }
  byId('pause-plate').textContent = byId('number').textContent + ' · ' + byId('level-name').textContent;
}

// ---------- screens ----------
const show = screens(['paused', 'result', 'chooser'], name => {
  screen = name;
  work.inert = name === 'paused' || name === 'chooser';
  work.dataset.screen = name;
  byId('controls').style.visibility = name === 'result' ? 'hidden' : '';
  byId('pause').style.visibility = name === 'result' ? 'hidden' : '';
  if (name === 'paused') byId('resume').focus({ preventScroll: true });
  if (name === 'result') byId('next').focus({ preventScroll: true });
  lastTime = null;
  debt = 0;
  needsPaint = true;
  ring();
});
function tools() {
  const open = cleared > 0;
  byId('daily').hidden = !open || mode !== 'plates';
  byId('free').hidden = !open || mode === 'free';
  byId('home').hidden = mode === 'plates';
  byId('resalt').hidden = mode !== 'free';
  work.dataset.mode = mode;
  // Two gauges or the instrument's buttons share the row with the pitch: its label goes.
  work.classList.toggle('busy', mode !== 'plates' || !!state.spec.shake);
}

// Play recording for the game lab (kit/lab.js): one run for each plate the player starts to tune,
// one for the daily figure, one for each visit to the instrument.
const rec = lab('night-saltplate');
let runOpen = false;
// The mode and shape the open run was started in: begin*() change them before start() ends the old run.
let runMode = 'plates';
let runShape = freeShape;
function runEnd(outcome) {
  if (!runOpen) return;
  runOpen = false;
  if (runMode === 'free') rec.end(outcome, { mode: runMode, shape: runShape, pictures });
  else rec.end(outcome, { level: state.level, match: Math.round(state.match * 100), grains: state.grains.length, cleared, mode: runMode, ...(runMode === 'daily' ? { day: today } : {}) });
}
function runStart() {
  if (runOpen) return;
  runOpen = true;
  runMode = mode;
  runShape = freeShape;
  if (mode === 'free') rec.start({ mode, shape: freeShape, look });
  else rec.start({ level: state.level, look, mode, ...(mode === 'daily' ? { day: today, figure: state.spec.shape + ':' + state.spec.mode } : {}) });
}

function start(spec, seed) {
  if (state) runEnd('quit');
  state = createPlate(spec, seed);
  drive = 0;
  active = false;
  pictures = 0;
  litStart = -1;
  lockRung = -10;
  introStart = performance.now();
  tuner.value = '0';
  byId('frequency').value = pitch();
  tuner.setAttribute('aria-valuetext', pitch() + ' Hz');
  const level = spec.level;
  byId('notch').hidden = !(mode === 'plates' && level === 1);
  byId('notch').style.left = (spec.target * 100) + '%';
  byId('drone-mark').hidden = spec.drone === undefined;
  if (spec.drone !== undefined) byId('drone-mark').style.left = (spec.droneDrive * 100) + '%';
  tuner.parentElement.style.setProperty('--hint-x',
    'calc(' + spec.target * 100 + '% + ' + (16 - 32 * spec.target) + 'px)');
  byId('match-bar').style.transform = 'scaleX(0)';
  byId('salt-gauge').hidden = !spec.shake;
  byId('salt-bar').style.transform = 'scaleX(1)';
  byId('salt-gauge').classList.remove('warn');
  byId('clock').hidden = mode !== 'daily';
  byId('clock-value').textContent = '0.0';
  tools();
  show('play');
  caption();
}
function begin(level) {
  mode = 'plates';
  start(LEVELS[level - 1], 0x5517 + level * 177);
}
function beginDaily() {
  mode = 'daily';
  daily ??= dailySpec(today);
  const record = dailyRecord();
  start(daily, daily.seed + record.tries);
}
function beginFree(shape = freeShape) {
  mode = 'free';
  freeShape = shape;
  writeJson(FREE_KEY, { v: 1, shape });
  const keep = state && state.spec.free ? drive : 0;
  start(freeSpecs[shape], 0x5a17 + shapes.indexOf(shape));
  if (keep) setDrive(keep);
}

function result(kind) {
  const actions = byId('result');
  actions.dataset.kind = kind;
  show('result');
}
function finish() {
  active = false;
  litStart = performance.now();
  const spec = state.spec;
  if (mode === 'daily') {
    const record = dailyRecord();
    const seconds = Math.round(state.t * 10) / 10;
    record.best = record.best === null ? seconds : Math.min(record.best, seconds);
    record.tries++;
    writeJson(DAILY_KEY, record);
    rec.event('daily-printed', { day: today, seconds });
    runEnd('won');
    byId('result-label').textContent = t('dailyBest', { s: record.best.toFixed(1) });
    byId('result-title').textContent = t('dailyDone', { s: seconds.toFixed(1) });
    byId('next').textContent = t('back');
    byId('replay').textContent = t('reprint');
  } else {
    cleared = Math.max(cleared, state.level);
    save();
    rec.event('plate-printed', { level: state.level });
    runEnd('won');
    const final = state.level === LEVELS.length;
    byId('result-label').textContent = t('impressionOf', { n: two(state.level), total: two(LEVELS.length) });
    byId('result-title').textContent = final ? t('setComplete') : t('printTaken');
    byId('next').textContent = final ? t('again') : t('next');
    byId('replay').textContent = t('reprint');
  }
  instruction.textContent = t('grainsLine', { hz: pitch(), grains: state.grains.filter(grain => !grain.gone).length });
  result('print');
  tools();
  printChord(pitch());
  void spec;
}
function shookOff() {
  active = false;
  rec.event('salt-shaken-off', { level: state.level });
  runEnd('lost');
  byId('result-label').textContent = t('salt') + ' · ' + Math.round(state.salt * 100) + '%';
  byId('result-title').textContent = t('shookOff');
  byId('next').textContent = t('saltAgain');
  byId('replay').textContent = t('plates');
  instruction.textContent = t('shookLine');
  result('failed');
  audio.noise(0.5, 0.06, 2500);
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
function setDrive(value) {
  drive = Math.max(0, Math.min(1, value));
  tuner.value = String(Math.round(drive * 1000));
  byId('frequency').value = pitch();
  tuner.setAttribute('aria-valuetext', pitch() + ' Hz');
}
function wake() {
  runStart();
  active = true;
  audio.unlock();
  ring();
  needsPaint = true;
}
function tune() {
  if (screen !== 'play') return;
  setDrive(tuner.valueAsNumber / 1000);
  wake();
}

// ---------- the plate: drag the bow or the finger ----------
let handlePointer = null;
function platePoint(event) {
  const box = plate.getBoundingClientRect();
  // The plate's square is the canvas less its frame (29 of 400 units on each side).
  const x = ((event.clientX - box.left) / box.width * 400 - 29) / 342;
  const y = ((event.clientY - box.top) / box.height * 400 - 29) / 342;
  return [x, y];
}
function canHandle() {
  return screen === 'play' && (state.spec.handle || state.spec.free);
}
plate.addEventListener('pointerdown', event => {
  if (!canHandle() || handlePointer !== null) return;
  event.preventDefault();
  handlePointer = event.pointerId;
  try { plate.setPointerCapture(event.pointerId); } catch {}
  setHandle(state, ...platePoint(event));
  // In the instrument a touch on the plate also starts it ringing.
  if (state.spec.free || active) wake();
  needsPaint = true;
});
plate.addEventListener('pointermove', event => {
  if (event.pointerId !== handlePointer || !canHandle()) return;
  setHandle(state, ...platePoint(event));
  needsPaint = true;
});
for (const type of ['pointerup', 'pointercancel']) {
  plate.addEventListener(type, event => { if (event.pointerId === handlePointer) handlePointer = null; });
}

tuner.addEventListener('pointerdown', tune);
tuner.addEventListener('input', tune);
byId('pause').addEventListener('click', pause);
byId('resume').addEventListener('click', resume);
byId('restart').addEventListener('click', () => { restartCurrent(); audio.release(); });
byId('look').addEventListener('click', () => { look = look === 'blue' ? 'oxide' : 'blue'; settings(); save(); });
byId('sound').addEventListener('click', () => { audible = !audible; settings(); save(); });
byId('lang').addEventListener('click', () => { setLang(lang() === 'tr' ? 'en' : 'tr'); texts(); });
function restartCurrent() {
  if (mode === 'daily') beginDaily();
  else if (mode === 'free') beginFree();
  else begin(state.level);
}
// A finger released after the print appears still belongs to the tuner.
const resultCard = byId('result');
let resultPress = null;
resultCard.addEventListener('pointerdown', event => { resultPress = event.target.closest('button'); });
resultCard.addEventListener('pointercancel', () => { resultPress = null; });
resultCard.addEventListener('click', event => {
  if (event.detail && event.target.closest('button') !== resultPress) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  resultPress = null;
}, true);
byId('next').addEventListener('click', () => {
  if (resultCard.dataset.kind === 'failed') return restartCurrent();
  if (mode === 'daily') return begin(cleared % LEVELS.length + 1);
  begin(state.level % LEVELS.length + 1);
});
byId('replay').addEventListener('click', () => {
  if (resultCard.dataset.kind === 'failed') return openChooser();
  restartCurrent();
});
byId('share').addEventListener('click', () => sharePicture());
byId('daily').addEventListener('click', () => beginDaily());
byId('free').addEventListener('click', () => beginFree());
byId('home').addEventListener('click', () => begin(cleared % LEVELS.length + 1));
byId('shape').addEventListener('click', () => beginFree(shapes[(shapes.indexOf(freeShape) + 1) % shapes.length]));
byId('resalt').addEventListener('click', () => beginFree());
byId('picture').addEventListener('click', () => sharePicture());
byId('number').addEventListener('click', () => { if (mode === 'plates') openChooser(); });
byId('to-plates').addEventListener('click', () => openChooser());
byId('chooser-close').addEventListener('click', () => { show(state.won ? 'result' : 'play'); audio.release(); });

function openChooser() {
  const list = byId('plate-list');
  list.replaceChildren();
  LEVELS.forEach((spec, index) => {
    const button = document.createElement('button');
    button.className = 'pick' + (index < cleared ? ' done' : '');
    button.disabled = index > cleared;
    button.innerHTML = '<span class="mono"></span><span class="nm"></span>';
    button.firstChild.textContent = two(index + 1);
    button.lastChild.textContent = t('name-' + (index + 1));
    button.addEventListener('click', () => { audio.release(); begin(index + 1); });
    list.append(button);
  });
  audio.hold();
  show('chooser');
  list.querySelector('button:not([disabled]):last-of-type')?.focus({ preventScroll: true });
}

async function sharePicture() {
  const spec = state.spec;
  const name = mode === 'free' ? t(freeShape) : specName(spec);
  const image = picture(plate, name, pitch() + ' Hz', look);
  const text = mode === 'daily' && state.won
    ? t('shareDaily', { day: today, name, s: state.t.toFixed(1) })
    : t('shareText', { name, hz: pitch() });
  const how = await shareImage(image, { name: 'saltplate-' + (spec.id || 'plate') + '.png', text });
  if (how === 'shared' || how === 'saved') {
    pictures++;
    rec.event('picture', { mode, how, hz: pitch(), ...(mode === 'free' ? { shape: freeShape } : { level: state.level }) });
    const note = byId('shared-note');
    note.textContent = how === 'shared' ? t('shared') : t('saved');
    note.classList.add('on');
    setTimeout(() => note.classList.remove('on'), 1800);
  }
}

onLeave(pause);
addEventListener('keydown', event => {
  if (isPauseKey(event) && !event.repeat) {
    event.preventDefault();
    if (screen === 'paused') resume(); else if (screen === 'chooser') byId('chooser-close').click(); else pause();
    return;
  }
  if (screen !== 'play' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  if (event.shiftKey && (state.spec.handle || state.spec.free)) {
    // Shift and the arrows move the bow or the finger.
    const [x, y] = state.handle ?? [0.5, 0.5];
    const step = 0.02;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    setHandle(state, x + dx, y + dy);
    needsPaint = true;
  } else {
    if (event.target !== tuner) tuner.focus({ preventScroll: true });
    const up = event.key === 'ArrowRight' || event.key === 'ArrowUp';
    setDrive(drive + (up ? 0.01 : -0.01));
    wake();
  }
  event.preventDefault();
});

function resize() {
  const side = Math.max(1, Math.round(plate.getBoundingClientRect().width * Math.min(2, devicePixelRatio)));
  if (side !== plate.width) plate.width = plate.height = side;
  needsPaint = true;
}
new ResizeObserver(resize).observe(plate);

// Page work per frame (simulation and drawing), for the frame-time check.
const perf = { samples: [], last: 0 };
function frame(now) {
  const dt = lastTime === null ? 0 : Math.min(0.12, (now - lastTime) / 1000);
  lastTime = now;
  const begun = performance.now();
  let worked = false;
  if (screen === 'play' && active) {
    debt += dt;
    while (debt >= 1 / 60) {
      debt -= 1 / 60;
      const was = state.progress;
      tick(state, drive);
      if (was === 0 && state.progress > 0 && state.t - lockRung > 1.5) {
        lockRung = state.t;
        plateRing(pitch());
      }
      if (state.won) { finish(); break; }
      if (state.failed) { shookOff(); break; }
    }
    byId('match-bar').style.transform = 'scaleX(' + state.match + ')';
    if (state.spec.shake) {
      byId('salt-bar').style.transform = 'scaleX(' + state.salt + ')';
      // The first grains leaving: the gauge turns red and the plate hisses once.
      if (state.lost > 0 && !byId('salt-gauge').classList.contains('warn')) {
        byId('salt-gauge').classList.add('warn');
        audio.noise(0.3, 0.05, 5000);
      }
    }
    if (mode === 'daily') byId('clock-value').textContent = state.t.toFixed(1);
    needsPaint = true;
    worked = true;
  }
  const intro = Math.min(1, (now - introStart) / 750);
  const lit = litStart < 0 ? -1 : (now - litStart) / 1000;
  if (intro < 1 || (lit >= 0 && lit < 1.6) || (state.spec.handle === 'damp' && !state.handle)) needsPaint = true;
  if (needsPaint) {
    drawPlate(ctx, state, {
      look, drive, active: active && screen === 'play', time: now / 1000,
      progress: state.won ? 1 : state.progress, lit: state.won ? Math.max(0, lit) : -1, intro,
    });
    needsPaint = false;
    worked = true;
  }
  if (worked) {
    const spent = performance.now() - begun;
    perf.samples.push(spent);
    if (perf.samples.length > 600) perf.samples.shift();
  }
  requestAnimationFrame(frame);
}
// The recording notice is on the page from the first look; its switch is on the pause card.
rec.notice(document.querySelector('header'));
rec.toggle(document.querySelector('#paused .card'));
texts();
if (query.get('mode') === 'daily' && cleared > 0) beginDaily();
else begin(cleared % LEVELS.length + 1);
resize();
requestAnimationFrame(frame);
hint(tuner, { kind: 'tap', key: 'night-saltplate:hint', when: () => screen === 'play' && mode === 'plates' && state.level === 1,
  played: cleared > 0, delay: 1600, reach: 38, label: t('hintTouch'),
  bottom: () => innerHeight - tuner.getBoundingClientRect().top - tuner.offsetHeight / 2 });
// The bow and the finger: once the tuner has been touched on a plate that has one, show a finger
// moving on the plate if the player has not touched it.
hint(plate, { kind: 'drag', key: 'night-saltplate:hint-handle', when: () => screen === 'play' && active && !!state.spec.handle,
  played: false, delay: 3500, reach: 40,
  bottom: () => { const box = plate.getBoundingClientRect(); return innerHeight - box.top - box.height * 0.62; } });
window.saltplateState = () => ({
  level: state.level, screen, drive, active: active && screen === 'play', t: state.t,
  match: state.match, progress: state.progress, won: state.won, look, sound: audible, cleared,
  mode, handle: state.handle ? [...state.handle] : null, failed: !!state.failed, salt: state.salt ?? 1, lang: lang(),
});
window.saltplatePerf = () => {
  const sorted = [...perf.samples].sort((a, b) => a - b);
  const at = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return { frames: sorted.length, mean: sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length), p50: at(0.5), p95: at(0.95), max: at(1), grains: state.grains.length };
};
window.saltplatePerfReset = () => { perf.samples.length = 0; };
