import { create, step, progress, DT, FIRST_SEED, SECOND_SEED } from './sim.js';
import { riverView } from './art.js';
import { drag } from '../../kit/drag.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { read, readNumber, write } from '../../kit/save.js';

noZoom();
const el = id => document.getElementById(id);
const canvas = el('river');
const ctx = canvas.getContext('2d', { alpha: false });
const query = new URLSearchParams(location.search);
const tide = query.get('tide') !== '0';
const look = query.get('look') === 'mauve' ? 'mauve' : 'ink';
const view = riverView(ctx, look);
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const keys = { night: 'lantern-tide:night', sound: 'lantern-tide:sound', hint: 'lantern-tide:hint' };
const LAST_NIGHT = 2;
const GAIN = 1.3;

let playingSound = read(keys.sound) !== '0';
const audio = sound({ on: () => playingSound });
const arrows = new Set();
let width = 0, height = 0, screen, game, target, previousFrame, accum = 0, clock = 0, ending = 0, turn = 0;
let unlocked = readNumber(keys.night, 1) === LAST_NIGHT;
let night = tide && unlocked ? LAST_NIGHT : 1;

const show = screens(['ready', 'paused', 'end'], name => {
  screen = name;
  el('hud').hidden = name !== 'play';
  if (name === 'paused') el('resume').focus({ preventScroll: true });
  if (name === 'end') el(game.river.over === 'dawn' && night < LAST_NIGHT ? 'next' : 'again').focus({ preventScroll: true });
});

function prepare() {
  steering.reset();
  arrows.clear();
  game = create(night === 1 ? FIRST_SEED : SECOND_SEED, night, tide);
  target = game.river.x;
  accum = ending = turn = 0;
  el('other-night').hidden = !tide || !unlocked;
  el('other-night').textContent = night === 1 ? 'Sail second night' : 'Sail first night';
  el('hull').replaceChildren(...Array.from({ length: game.river.hearts }, () => document.createElement('i')));
  updateHud();
}
function launch() {
  audio.release();
  audio.unlock();
  audio.tone(392, .38, .035, 'sine', 22);
  show('play');
}
function restart() {
  prepare();
  launch();
}
function updateHud() {
  const { light, hearts } = game.river;
  const crossing = progress(game);
  el('wick').style.transform = 'scaleX(' + Math.max(0, light) + ')';
  el('dawn').style.transform = 'scaleX(' + crossing + ')';
  el('flame').setAttribute('aria-valuenow', Math.round(light * 100));
  el('passage').setAttribute('aria-valuenow', Math.floor(crossing * 100));
  el('hull').setAttribute('aria-label', hearts + ' hull lives');
  [...el('hull').children].forEach((mark, index) => mark.classList.toggle('spent', index >= hearts));
}
function syncSound() {
  el('sound').textContent = playingSound ? 'Sound on' : 'Sound off';
  el('sound').setAttribute('aria-pressed', String(playingSound));
}
function pause() {
  if (screen !== 'play' || game.river.over) return;
  steering.reset();
  arrows.clear();
  target = game.river.x;
  accum = 0;
  audio.hold();
  syncSound();
  show('paused');
}
function resume() {
  if (screen !== 'paused') return;
  show('play');
  audio.release();
}
function finish() {
  const { over, t } = game.river;
  const win = over === 'dawn';
  const next = win && night < LAST_NIGHT;
  el('result').textContent = win ? 'Dawn' : over === 'dark' ? 'The flame went out' : 'Boat lost';
  el('reading').textContent = win ? Math.ceil(t) + ' s across the river' : Math.floor(progress(game) * 100) + '% to dawn';
  el('next').hidden = !next;
  el('again').textContent = win ? 'Sail again' : 'Try again';
  show('end');
}

el('start').onclick = launch;
el('pause').onclick = pause;
el('resume').onclick = resume;
el('restart').onclick = restart;
el('other-night').onclick = () => { night = night === 1 ? LAST_NIGHT : 1; restart(); };
el('again').onclick = restart;
el('next').onclick = () => { night++; restart(); };
el('sound').onclick = () => {
  playingSound = !playingSound;
  write(keys.sound, playingSound ? '1' : '0');
  syncSound();
};
onLeave(pause);

for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
  canvas.addEventListener(type, event => {
    if (!event.isPrimary) event.stopImmediatePropagation();
  }, { capture: true });
}
canvas.addEventListener('pointerdown', event => {
  if (screen === 'ready') launch();
  if (screen === 'play') canvas.setPointerCapture(event.pointerId);
});
const steering = drag(canvas, {
  playing: () => screen === 'play' && !game.river.over,
  paused: () => screen === 'paused', resume,
  from: () => game.river.x,
  travel: dx => dx * GAIN / view.pixelsPerUnit(),
  aim: x => { target = x; help.done(); },
  mouse: event => {
    target = game.river.x + (event.clientX - view.boatPosition()[0]) / view.pixelsPerUnit();
    if (event.type === 'pointermove') help.done();
  },
  settle: 12,
});
// Steering dismisses the hint. A tap on the river only launches or places a finger.
const help = hint(el('ready'), {
  kind: 'drag',
  key: keys.hint,
  when: () => screen === 'play' && !game.river.over,
  played: unlocked,
  delay: 1500,
  bottom: 94,
  label: 'Drag sideways',
});

addEventListener('keydown', event => {
  if (event.repeat && isPauseKey(event)) return;
  if (isPauseKey(event)) {
    if (screen === 'play') pause();
    else if (screen === 'paused') resume();
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  if (screen === 'ready') launch();
  if (screen !== 'play') return;
  event.preventDefault();
  arrows.add(event.key);
});
addEventListener('keyup', event => {
  if (arrows.delete(event.key) && !arrows.size) target = game.river.x;
});

function tick() {
  const s = game.river;
  if (arrows.size) {
    const sign = Number(arrows.has('ArrowRight')) - Number(arrows.has('ArrowLeft'));
    target = s.x + sign * .12;
  }
  const x = s.x;
  step(game, target);
  turn += (Math.max(-1, Math.min(1, (s.x - x) / DT)) - turn) * .15;
  for (const event of s.events) {
    if (event === 'ember') audio.tone(620 + (s.taken % 4) * 60, .21, .041, 'sine', 35);
    if (event === 'hurt' || event === 'hit') {
      audio.noise(.24, .14, 430);
      if (event === 'hurt') { target = s.x; steering.rebase(); }
    }
    if (event === 'out') audio.tone(135, .45, .04, 'sine', -62);
    if (event === 'dawn') {
      if (tide && night < LAST_NIGHT) {
        unlocked = true;
        write(keys.night, LAST_NIGHT);
      }
      audio.tone(493.88, .70, .07);
      audio.tone(739.99, .85, .04);
    }
  }
  if (s.over) steering.reset();
}

function draw() {
  view.draw(game, width, height, calm.matches ? 0 : clock, turn, ending);
}
function resize() {
  const nextWidth = canvas.clientWidth;
  const nextHeight = canvas.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (screen === 'play' && width !== nextWidth) {
    steering.reset();
    target = game.river.x;
  }
  width = nextWidth;
  height = nextHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = previousFrame === undefined ? 0 : Math.min(.10, (now - previousFrame) / 1000);
  previousFrame = now;
  if (screen !== 'paused') clock += dt;
  if (screen === 'play') {
    if (game.river.over) {
      ending += dt;
      if (ending >= .65) finish();
    } else {
      accum += dt;
      while (accum >= DT && !game.river.over) { tick(); accum -= DT; }
      updateHud();
    }
  }
  if (screen !== 'paused') draw();
}
addEventListener('resize', resize);
prepare();
show('ready');
resize();
requestAnimationFrame(frame);

if (query.get('check') === '1') {
  // Read-only observation of the normal game loop for the input check.
  window.tideState = () => ({
    game, night, screen, target, look, scale: view.pixelsPerUnit(), point: view.boatPosition(),
  });
}
