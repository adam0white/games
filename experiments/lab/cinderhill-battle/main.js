import { AREAS, LENGTH, TPS, UNSEAL, areas, cell, command, create, snap, step, score } from './sim.js';
import { RIVALS } from './pacers.js';
import { W } from './words.js';
import { field } from './field.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { lab } from '../../kit/lab.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { noZoom } from '../../kit/zoom.js';

noZoom();

const $ = id => document.getElementById(id), { t } = W;
const params = new URLSearchParams(location.search);
const variant = params.get('v') === 'flag' ? 'flag' : 'hold';
const key = 'cinderhill-battle:save';
const rivals = Object.keys(RIVALS), old = readJson(key);
const save = {
  v: 1, foe: rivals.includes(old?.foe) ? old.foe : rivals[0],
  sound: typeof old?.sound === 'boolean' ? old.sound : true,
  played: Number.isSafeInteger(old?.played) && old.played >= 0 ? old.played : 0,
};
const store = () => writeJson(key, save);
const snd = sound({ on: () => save.sound });
const rec = lab('cinderhill-battle', { lang: W.lang });
rec.notice(document.querySelector('#menu .card'));
rec.toggle(document.querySelector('#paused .card'));

const board = $('board'), paint = field(board, t);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let screen = 'menu', tool = 'trail', foe = save.foe, acc = 0, last = performance.now();
let game = create(1), gesture = null, staged = -1, needsDraw = true;
const show = screens(['menu', 'paused', 'end'], name => {
  screen = name;
  needsDraw = true;
  $('battle').inert = name !== 'play';
});
const meters = AREAS.map(name => {
  const area = document.createElement('div');
  area.innerHTML = '<span data-i18n="' + name + '"></span><div class="meter" role="img"><span><i></i></span><span><i></i></span></div>';
  $('areas').append(area);
  return { meter: area.lastElementChild, bars: area.querySelectorAll('i') };
});

function texts() {
  W.apply();
  needsDraw = true;
  document.title = t('title');
  $('alarm').textContent = t(variant === 'flag' ? 'flag' : 'alarm');
  for (const id of ['sound1', 'sound']) $(id).textContent = t(save.sound ? 'soundOn' : 'soundOff');
  for (const id of ['lang1', 'lang2']) $(id).textContent = t('switchLanguage');
  $('foes').replaceChildren(...rivals.map(id => {
    const b = document.createElement('button'), name = document.createElement('strong'), detail = document.createElement('small');
    b.dataset.foe = id; b.setAttribute('aria-pressed', id === save.foe);
    name.textContent = t(id); detail.textContent = t(id + 'About');
    b.append(name, detail);
    b.addEventListener('click', () => {
      save.foe = id; store();
      for (const other of $('foes').children) other.setAttribute('aria-pressed', other === b);
    });
    return b;
  }));
  $('variants').replaceChildren(...['hold', 'flag'].map(id => {
    const a = document.createElement('a'), url = new URL(location.href);
    url.searchParams.set('v', id);
    a.href = url; a.textContent = t(id); a.setAttribute('aria-current', String(variant === id));
    return a;
  }));
  hud();
}
for (const id of ['lang1', 'lang2']) $(id).addEventListener('click', () => {
  W.setLang(W.lang() === 'en' ? 'tr' : 'en'); texts(); rec.retext();
});
for (const id of ['sound1', 'sound']) $(id).addEventListener('click', () => {
  save.sound = !save.sound; store(); texts();
  if (save.sound) snd.unlock();
});

function hud() {
  $('foe').textContent = t(foe);
  const seconds = Math.ceil((LENGTH - game.t) / TPS);
  $('clock').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  for (const [i, { lane, power }] of areas(game).entries()) {
    const { meter, bars } = meters[i];
    power.forEach((n, side) => { bars[side].style.width = Math.min(100, n) + '%'; });
    meter.setAttribute('aria-label', t('power', { area: t(lane), you: power[0], them: power[1] }));
  }
  const s = game.sides[0];
  const count = role => s.ants.filter(a => a.role === role).length;
  const rallying = count('guard'), marching = count('trail'), returning = count('recall') + count('limp');
  const guidance = tool === 'alarm'
    ? rallying ? t('rallying', { n: rallying }) : t(variant === 'flag' ? 'flagHint' : 'holdHint')
    : returning ? t('returning', { n: returning }) : s.trail.length ? t('marching', { n: marching }) : t('trailHint');
  $('status').textContent = guidance;
  $('phase').textContent = t(game.t < UNSEAL ? 'seals' : 'opened');
}

function start() {
  foe = save.foe;
  const asked = Number(params.get('seed'));
  const seed = Number.isInteger(asked) && asked > 0 && asked <= 0xffffffff ? asked : crypto.getRandomValues(new Uint32Array(1))[0];
  game = create(seed, { armies: [[48, 16], RIVALS[foe].army] });
  select('trail');
  staged = -1;
  acc = 0; last = performance.now();
  snd.unlock(); snd.release();
  rec.start({ seed, foe, variant, lang: W.lang() });
  hud(); show('play');
}

function summary() {
  return { t: game.t, dead: game.sides.map(s => s.dead), health: score(game), reason: game.over?.reason };
}

function finish() {
  const { winner, reason } = game.over;
  const outcome = winner === 0 ? 'won' : winner === 1 ? 'lost' : 'draw';
  const [you, them] = game.sides.map(s => s.dead);
  abandon();
  save.played++; store();
  rec.end(outcome, summary());
  $('result').textContent = t(outcome);
  $('reason').textContent = t(reason + 'End');
  $('losses').textContent = t('losses', { you, them });
  hud(); show('end');
  snd.tone(winner === 0 ? 440 : 220, .32, .07, 'triangle');
}

function send(type, data = {}) {
  if (screen !== 'play' || !command(game, 0, { type, ...data })) return false;
  rec.event(type, { t: game.t, ...data });
  hud();
  return true;
}

function select(name) {
  tool = name;
  for (const id of ['trail', 'alarm']) $(id).setAttribute('aria-pressed', id === name);
  hud();
}

function abandon() {
  if (!gesture) return;
  clearTimeout(gesture.timer);
  if (gesture.on) send('quiet');
  gesture = null;
}

function pause() {
  if (screen !== 'play') return;
  abandon(); staged = -1;
  snd.hold(); show('paused');
}
function resume() {
  snd.unlock(); snd.release(); last = performance.now(); show('play');
}
onLeave(pause);
addEventListener('resize', () => { needsDraw = true; });
addEventListener('keydown', e => {
  if (!e.repeat && isPauseKey(e)) {
    if (screen === 'play') pause();
    else if (screen === 'paused') resume();
  }
});

$('play').onclick = $('again').onclick = start;
$('pause').onclick = pause;
$('resume').onclick = resume;
$('toMenu').onclick = () => show('menu');
$('quit').onclick = () => { rec.end('quit', summary()); show('menu'); };
$('trail').onclick = () => { abandon(); staged = -1; select('trail'); };
$('alarm').onclick = () => {
  abandon(); staged = -1;
  if (variant === 'flag' && game.sides[0].alarm >= 0) send('quiet');
  select('alarm');
};
$('recall').onclick = () => {
  abandon(); staged = -1; select('trail');
  if (send('recall')) snd.tone(196, .13, .05, 'triangle');
};

// A trail previews while the pointer moves. A second touch or cancellation discards it.
function addPoint(points, p) {
  if (points.at(-1) === p) return;
  if (points.length === 32) points.splice(1, 1);
  points.push(p);
}
board.addEventListener('pointerdown', e => {
  if (screen !== 'play' || e.button !== 0) return;
  if (!e.isPrimary || gesture) { abandon(); staged = -1; return; }
  const p = snap(game.map, paint.hit(e.clientX, e.clientY));
  if (p < 0) return;
  snd.unlock();
  board.setPointerCapture(e.pointerId);
  const stroke = gesture = { id: e.pointerId, points: [p], on: false, timer: null };
  if (tool === 'alarm' && variant === 'hold') stroke.timer = setTimeout(() => {
    if (gesture === stroke) stroke.on = send('alarm', { spot: stroke.points.at(-1) });
  }, 220);
});
board.addEventListener('pointermove', e => {
  if (gesture?.id !== e.pointerId || tool !== 'trail') return;
  const p = snap(game.map, paint.hit(e.clientX, e.clientY));
  if (p >= 0) addPoint(gesture.points, p);
});
board.addEventListener('pointerup', e => {
  if (gesture?.id !== e.pointerId) return;
  const { points } = gesture;
  const hit = snap(game.map, paint.hit(e.clientX, e.clientY));
  const p = tool === 'trail' && points.length > 1 && hit < 0 ? points.at(-1) : hit;
  abandon();
  if (p < 0) return;
  if (tool === 'trail') {
    addPoint(points, p);
    if (points.length === 1 && staged < 0) { staged = p; return; }
    if (points.length === 1) points.unshift(staged);
    staged = -1;
    if (send('trail', { points })) snd.tone(392, .12, .06, 'triangle');
  } else if (variant === 'flag') send('alarm', { spot: p });
});
for (const type of ['pointercancel', 'lostpointercapture']) board.addEventListener(type, e => {
  if (gesture?.id === e.pointerId) { abandon(); staged = -1; }
});

hint(board, { kind: 'path', key: 'cinderhill-battle:hint', when: () => screen === 'play' && tool === 'trail',
  played: save.played > 0, label: t('trailHint'), bottom: 160 });
const hintLabel = document.querySelector('#battle .kit-hint .label');
if (hintLabel) hintLabel.dataset.i18n = 'trailHint';

function frame(now) {
  if (screen === 'play') {
    acc += Math.min(250, now - last);
    while (acc >= 1000 / TPS && !game.over) {
      acc -= 1000 / TPS;
      if (game.t % TPS === 0) {
        const next = RIVALS[foe].mind(game, 1);
        if (next) command(game, 1, next);
      }
      if (step(game)) finish();
      else hud();
    }
  }
  last = now;
  if (screen === 'play' || needsDraw) {
    const preview = tool === 'trail' ? gesture?.points ?? (staged >= 0 ? [staged] : null) : null;
    paint.draw(game, preview, game.t + (reduce ? 1 : acc * TPS / 1000), variant === 'flag');
    needsDraw = false;
  }
  requestAnimationFrame(frame);
}

window.battleState = () => ({
  screen, t: game.t, paused: screen === 'paused', foe: save.foe, played: save.played, sound: save.sound,
  trail: [...game.sides[0].trail], alarm: game.sides[0].alarm, marching: game.sides[0].ants.filter(a => a.role === 'trail').length,
  returning: game.sides[0].ants.filter(a => a.role === 'recall').length, variant,
  point: (x, y) => paint.point(cell(x, y)),
});
texts(); show('menu'); requestAnimationFrame(frame);
