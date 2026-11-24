import { sound } from '../kit/audio.js';
import * as save from '../kit/save.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { lab } from '../kit/lab.js';
import { hint } from '../kit/hint.js';
import { noZoom } from '../kit/zoom.js';
import { create, step, dailyKey, dailyNight, DEFAULT_SEED, LAST, WIDTH, HEIGHT, DT, LIFT, REST } from './sim.js';
import { renderer, cover, clock } from './art.js';

const $ = id => document.getElementById(id);
const KEY = 'nightshift-save';
const old = save.readJson(KEY);
const bounded = (value, low, high) => Math.min(high, Math.max(low, value));
const whole = (n, fallback) => Number.isSafeInteger(n) ? n : fallback;
const profile = {
  unlocked: bounded(whole(old?.unlocked, 1), 1, LAST),
  cleared: bounded(whole(old?.cleared, 0), 0, LAST),
  best: Math.max(0, whole(old?.best, 0)),
  sound: old?.sound !== false,
  played: old?.played === true,
  daily: {
    date: typeof old?.daily?.date === 'string' ? old.daily.date : '',
    streak: Math.max(0, whole(old?.daily?.streak, 0)),
  },
};
const persist = () => save.writeJson(KEY, profile);
const params = new URLSearchParams(location.search);
const parse = (key, max) => {
  const value = params.get(key);
  if (!/^\d+$/.test(value ?? '')) return null;
  const number = Number(value);
  return number <= max ? number : null;
};
const levelOverride = parse('level', LAST) || null;
const seedOverride = parse('seed', 0xffffffff);
const rec = lab('nightshift');
const canvas = $('floor');
const view = renderer(canvas);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const moveKeys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const keys = new Set();
let state = create();
let screen = 'menu';
let aim = { ...REST };
let pointer = null;
let effects = [];
let day = '';
let nextLevel = null;
let cardFile = null;
let accumulator = 0;
let previous = null;
let capturesLogged = 0;
let lastStepSound = -1;
let lastCaughtSound = -1;

let footsteps;
const snd = sound({
  on: () => profile.sound,
  setup(ctx) {
    footsteps = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .075), ctx.sampleRate);
    const samples = footsteps.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const envelope = (1 - i / samples.length) ** 2;
      samples[i] = (Math.random() * 2 - 1) * envelope;
    }
  },
});

function foot(x, kind) {
  const ctx = snd.ctx;
  if (!profile.sound || !ctx || !footsteps) return;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = footsteps;
  filter.type = 'lowpass';
  filter.frequency.value = kind === 'dino' ? 640 : kind === 'armor' ? 2350 : 1200;
  gain.gain.value = kind === 'dino' ? .09 : .07;
  source.connect(filter).connect(gain);
  if (ctx.createStereoPanner) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = bounded((x - WIDTH / 2) / 170, -.92, .92);
    gain.connect(pan).connect(ctx.destination);
  } else gain.connect(ctx.destination);
  source.start();
}

const switchScreen = screens(['menu', 'paused', 'result', 'shareCard'], name => {
  screen = name;
  $('hud').hidden = name !== 'play';
  if (name !== 'play') clearInput();
});

function resize() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  if (screen !== 'play') view.draw(state, 1, performance.now(), [], reduced.matches, false);
}

function clearInput() {
  const id = pointer;
  pointer = null;
  if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  keys.clear();
}

const format = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const yesterday = date => dailyKey(new Date(Date.parse(date + 'T00:00:00Z') - 86400000));

function visibleStreak(today) {
  return [today, yesterday(today)].includes(profile.daily.date) ? profile.daily.streak : 0;
}

function showMenu() {
  const level = levelOverride ?? profile.unlocked;
  $('nightNumber').textContent = `${String(level).padStart(2, '0')} / ${LAST}`;
  $('best').textContent = format(profile.best);
  $('streak').textContent = `✦ ${visibleStreak(dailyKey())}`;
  $('progress').replaceChildren(...Array.from({ length: LAST }, (_, i) => {
    const mark = document.createElement('i');
    if (i + 1 === level) mark.className = 'current';
    else if (i < profile.cleared) mark.className = 'cleared';
    return mark;
  }));
  $('play').setAttribute('aria-label', `Play night ${level} of ${LAST}`);
  cover($('poster'));
  switchScreen('menu');
}

function refreshAudio() {
  for (const button of document.querySelectorAll('.audio')) {
    button.textContent = profile.sound ? 'Sound on' : 'Sound off';
    button.setAttribute('aria-pressed', String(profile.sound));
  }
}

function toggleSound() {
  profile.sound = !profile.sound;
  persist();
  refreshAudio();
  if (!profile.sound) snd.hold();
  else if (screen !== 'paused') {
    snd.release();
    snd.unlock();
    snd.tone(440, .13, .08, 'triangle', 130);
  }
}

function updateHud() {
  const lives = $('lives');
  lives.setAttribute('aria-label', `${3-state.escapes} escapes left`);
  [...lives.children].forEach((icon, i) => icon.classList.toggle('lost', i < state.escapes));
  $('longClock').hidden = state.mode !== 'long';
  if (state.mode === 'long') $('longClock').textContent = format(Math.floor(state.time));
  clock($('clock'), state);
}

function start(mode = 'story', level = levelOverride ?? profile.unlocked) {
  clearInput();
  day = mode === 'daily' ? dailyKey() : '';
  const options = mode === 'daily' ? dailyNight(day) : { level: mode === 'long' ? LAST : level, seed: seedOverride ?? DEFAULT_SEED };
  state = create({ ...options, mode });
  aim = { ...REST };
  effects = [];
  accumulator = 0;
  previous = null;
  capturesLogged = 0;
  lastStepSound = lastCaughtSound = -1;
  snd.release();
  snd.unlock();
  snd.tone(426, .18, .11, 'triangle', 170);
  rec.start({ mode, night: state.level, seed: state.seed, ...(day ? { day } : {}) });
  updateHud();
  switchScreen('play');
}

function pause() {
  if (screen !== 'play') return;
  snd.hold();
  view.draw(state, 1, performance.now(), [], reduced.matches, false);
  switchScreen('paused');
}

function resume() {
  if (screen !== 'paused') return;
  accumulator = 0;
  previous = null;
  snd.release();
  snd.unlock();
  switchScreen('play');
}

function summary() {
  return {
    mode: state.mode, night: state.level, seconds: Math.floor(state.time),
    returned: state.returned, escapes: state.escapes, ...(day ? { day } : {}),
  };
}

function finish() {
  const won = state.outcome === 'dawn';
  nextLevel = won && state.mode === 'story' && state.level < LAST ? state.level + 1 : null;
  if (won && state.mode === 'story' && state.level === profile.unlocked) {
    profile.cleared = Math.max(profile.cleared, state.level);
    profile.unlocked = Math.max(profile.unlocked, nextLevel ?? LAST);
  }
  if (won && state.mode === 'daily' && profile.daily.date < day) {
    profile.daily.streak = profile.daily.date === yesterday(day) ? profile.daily.streak + 1 : 1;
    profile.daily.date = day;
  }
  if (state.mode === 'long') profile.best = Math.max(profile.best, Math.floor(state.time));
  profile.played = true;
  persist();
  rec.end(state.outcome, summary());
  $('outcome').textContent = won ? 'Dawn' : 'Escaped';
  $('medals').textContent = state.mode === 'long' ? `${format(Math.floor(state.time))}  ·  ★ ${format(profile.best)}`
    : state.mode === 'daily' && won ? `✦ ${visibleStreak(day)}`
    : '★'.repeat(3 - state.escapes) + '☆'.repeat(state.escapes);
  $('again').textContent = nextLevel ? 'Next' : 'Again';
  $('share').hidden = state.mode !== 'daily';
  cover($('resultPoster'), state.outcome);
  switchScreen('result');
  snd.tone(won ? 523 : 195, .22, .15, 'triangle', won ? 261 : -75);
}

function leave() {
  if (screen === 'paused') {
    if (state.mode === 'long') {
      profile.best = Math.max(profile.best, Math.floor(state.time));
      persist();
    }
    rec.end('left', summary());
  }
  snd.release();
  showMenu();
}

function openShare() {
  const target = $('dailyPoster');
  cover(target, state.outcome === 'dawn' ? 'share' : 'share-loss', visibleStreak(day), day, state.escapes);
  cardFile = null;
  $('saveCard').disabled = true;
  target.toBlob(blob => {
    if (!blob) return;
    cardFile = new File([blob], `nightshift-${day}.png`, { type: 'image/png' });
    const native = navigator.canShare?.({ files: [cardFile] });
    $('saveCard').textContent = native ? 'Share' : 'Save';
    $('saveCard').disabled = false;
  }, 'image/png');
  switchScreen('shareCard');
}

async function saveCard() {
  if (!cardFile) return;
  if (navigator.canShare?.({ files: [cardFile] })) {
    try { await navigator.share({ files: [cardFile] }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(cardFile);
  const link = document.createElement('a');
  link.href = url;
  link.download = cardFile.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pointerAim(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * WIDTH / rect.width;
  const y = (event.clientY - rect.top) * HEIGHT / rect.height;
  aim = { x, y: y - LIFT };
  return { x, y };
}

function begin(event) {
  if (screen !== 'play' || pointer !== null || event.button !== 0) return;
  pointer = event.pointerId;
  if (event.isTrusted) canvas.setPointerCapture(pointer);
  const point = pointerAim(event);
  effects.push({ ...point, type: 'touch', at: performance.now(), life: 330 });
  snd.tone(353, .055, .048, 'sine', 104);
  if (!profile.played) {
    profile.played = true;
    persist();
  }
}

canvas.addEventListener('pointerdown', begin);
canvas.addEventListener('pointermove', e => {
  if (screen === 'play' && (pointer === e.pointerId || pointer === null && e.pointerType === 'mouse')) pointerAim(e);
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(event, e => { if (pointer === e.pointerId) clearInput(); });
}

addEventListener('keydown', e => {
  if (isPauseKey(e) && (screen === 'play' || screen === 'paused')) {
    e.preventDefault();
    if (!e.repeat) screen === 'paused' ? resume() : pause();
  }
  if (screen === 'play' && moveKeys[e.key]) {
    e.preventDefault();
    if (!keys.size) aim = { ...state.light };
    keys.add(e.key);
  }
});
addEventListener('keyup', e => keys.delete(e.key));
onLeave(pause);
noZoom();

$('play').onclick = () => start();
$('long').onclick = () => start('long');
$('daily').onclick = () => start('daily');
$('pause').onclick = pause;
$('resume').onclick = resume;
$('toMenu').onclick = leave;
$('resultMenu').onclick = leave;
$('again').onclick = () => start(state.mode, nextLevel ?? state.level);
$('share').onclick = openShare;
$('closeShare').onclick = () => switchScreen('result');
$('saveCard').onclick = saveCard;
for (const button of document.querySelectorAll('.audio')) button.onclick = toggleSound;
rec.notice($('menu').firstElementChild);
rec.toggle($('paused').firstElementChild);
const idleHint = hint(canvas, {
  kind: 'hold-and-move', key: 'nightshift:hint', when: () => screen === 'play',
  played: profile.played, delay: 3100, bottom: 78, reach: 40, label: 'Drag',
});

function react(event, now) {
  const { type, actor } = event;
  if (type === 'foot') {
    if (!reduced.matches) effects.push({ type, x: actor.x, y: actor.y, at: now, life: 510 });
    if (state.time - lastStepSound > .045) {
      foot(actor.x, actor.kind);
      lastStepSound = state.time;
    }
  }
  if (type === 'catch' && actor.lit && state.time - lastCaughtSound > .1) {
    snd.tone(460 + actor.id * 33, .14, .079, 'triangle', 215);
    lastCaughtSound = state.time;
  }
  if (type === 'return' || type === 'escape' || type === 'fuse') {
    effects.push({ type, x: actor?.x ?? event.x, y: actor?.y ?? 480, at: now, life: 570 });
  }
  if (type === 'return') {
    snd.tone(579 + state.returned % 5 * 45, .09, .061, 'sine', 155);
    if (capturesLogged++ < 75) rec.event('return', { exhibit: actor.kind });
  }
  if (type === 'escape') {
    snd.tone(211, .19, .11, 'triangle', -76);
    rec.event('escape', { exhibit: actor.kind });
  }
  if (type === 'cat') snd.tone(655, .19, .061, 'sine', -210);
  if (type === 'fuse') {
    snd.tone(475, .26, .09, 'sine', 243);
    rec.event('fuse', {});
  }
}

function frame(now) {
  if (screen === 'play') {
    accumulator += previous === null ? 0 : Math.min(.10, (now - previous) / 1000);
    while (accumulator >= DT && !state.outcome) {
      for (const key of keys) {
        const [x, y] = moveKeys[key];
        aim.x = bounded(aim.x + x * 5.8, 22, WIDTH - 22);
        aim.y = bounded(aim.y + y * 5.8, 84, HEIGHT - 35);
      }
      step(state, aim);
      for (const event of state.events) react(event, now);
      accumulator -= DT;
    }
    effects = effects.filter(effect => now - effect.at < effect.life);
    view.draw(state, state.outcome ? 1 : accumulator / DT, now, effects, reduced.matches, !idleHint.shown);
    updateHud();
    if (state.outcome) finish();
  }
  previous = now;
  requestAnimationFrame(frame);
}

window.nightshiftState = () => ({
  screen, paused: screen === 'paused', mode: state.mode, level: state.level, seed: state.seed,
  day, tick: state.tick, time: state.time, outcome: state.outcome, escapes: state.escapes, returned: state.returned,
  light: { ...state.light }, aim: { ...aim }, bounce: state.bounce && { ...state.bounce },
  blackout: state.blackout, fused: state.fused,
  actors: state.actors.map(({ id, kind, state, x, y, progress, hold, lit, mirrored }) =>
    ({ id, kind, state, x, y, progress, hold, lit, mirrored })),
});

refreshAudio();
showMenu();
resize();
new ResizeObserver(resize).observe(canvas);
requestAnimationFrame(frame);
