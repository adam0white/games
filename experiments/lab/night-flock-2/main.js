import { command, createGame, LIMIT_LEVEL, RESCUE_POINTS, step } from './sim.js';
import { farm, valley } from './valley.js';
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
const key = 'night-flock-2:save';
const old = readJson(key);
const saved = {
  v: 1,
  unlocked: Number.isInteger(old?.unlocked) ? Math.min(LIMIT_LEVEL, Math.max(1, old.unlocked)) : 1,
  best: Number.isSafeInteger(old?.best) && old.best >= 0 ? old.best : 0,
  sound: old?.sound !== false,
  played: old?.played === true
};
const starsKey = 'night-flock-2:stars';
const dailyKey = 'night-flock-2:daily';
const stars = {};
let dailyRecord = readJson(dailyKey);
function readStars() {
  const previous = readJson(starsKey);
  for (let n = 1; n <= LIMIT_LEVEL; n++) {
    if (Number.isInteger(previous?.[n])) stars[n] = (stars[n] || 0) | (previous[n] & 7);
  }
}
readStars();
let storageOK = true;
function store(soundChanged = false) {
  // Another open field can have a higher count or a later evening.
  const latest = readJson(key);
  if (Number.isSafeInteger(latest?.best)) saved.best = Math.max(saved.best, latest.best);
  if (Number.isInteger(latest?.unlocked)) saved.unlocked = Math.min(LIMIT_LEVEL, Math.max(saved.unlocked, latest.unlocked));
  if (latest?.played === true) saved.played = true;
  if (!soundChanged && typeof latest?.sound === 'boolean') saved.sound = latest.sound;
  storageOK = writeJson(key, saved);
}

const audio = sound({ on: () => saved.sound });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let mode = 'campaign', level = saved.unlocked, wave = 1, carried = 0, endlessSeed = 0;
let game, screen, lastFrame = null, owner = null, target = null, fromFields = 'paused';
let gesture = null, tutorialMoved = false;
let dailyDate = '', dailySeed = 0;
const starNames = ['None lost', 'Calm kept', 'Under par'];
const calmStar = .78;
let endWait = 0, message = '', messageUntil = 0, clock = 0;

function release() {
  const previous = owner;
  owner = null;
  target = null;
  gesture = null;
  if (previous !== null && canvas.hasPointerCapture(previous)) canvas.releasePointerCapture(previous);
}
const display = screens(['paused', 'evenings-screen', 'end'], id => {
  screen = id === 'evenings-screen' ? 'evenings' : id;
  document.querySelector('.folio').inert = screen !== 'play';
  if (screen !== 'play') el(id).querySelector('button:not([hidden]):not(:disabled)')?.focus({preventScroll: true});
  lastFrame = null;
});
function describe() {
  if (mode === 'endless') return 'Count them home · Flock ' + wave;
  if (mode === 'daily') return 'Daily · ' + dailyDate.slice(5);
  return 'Evening ' + String(level).padStart(2, '0') + ' / ' + LIMIT_LEVEL;
}
function fresh() {
  release();
  tutorialMoved = false;
  let seed = level;
  if (mode === 'endless') seed = (endlessSeed + Math.imul(wave, 2654435761)) >>> 0;
  if (mode === 'daily') seed = dailySeed;
  game = createGame(mode === 'endless' ? LIMIT_LEVEL + wave : level, seed);
  el('farm').textContent = mode === 'endless' ? 'Common pasture' : farm(level) + ' farm';
  el('hint-outrun').classList.toggle('left', (game.terrain.outrun?.x ?? 180) < 180);
  const { mist, wind } = game.weather;
  el('weather').textContent = [mist ? 'Valley mist' : '', wind ? 'Wind ' + (wind < 0 ? '←' : '→') : ''].filter(Boolean).join(' · ') || 'Still evening';
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
function daily() {
  dailyDate = new Date().toISOString().slice(0, 10);
  dailySeed = Number(dailyDate.replaceAll('-', ''));
  const day = Math.floor(Date.parse(dailyDate) / 86400000);
  level = 2 + day % (LIMIT_LEVEL - 1);
  mode = 'daily';
  wave = 1;
  carried = 0;
  fresh();
}
function resultStars() {
  if (game.status !== 'won') return 0;
  return (game.lost === 0 ? 1 : 0) | (game.minCalm >= calmStar ? 2 : 0) | (game.time <= game.par ? 4 : 0);
}
function award() {
  if (game.status !== 'won' || mode === 'endless') return;
  const earned = resultStars();
  if (mode === 'daily') {
    const recent = readJson(dailyKey);
    if (recent?.date > dailyDate) return;
    const prior = dailyRecord?.date === dailyDate ? dailyRecord.stars : 0;
    dailyRecord = {date: dailyDate, stars: earned | prior | (recent?.date === dailyDate ? recent.stars : 0)};
    storageOK = writeJson(dailyKey, dailyRecord);
  } else {
    saved.unlocked = Math.max(saved.unlocked, Math.min(LIMIT_LEVEL, level + 1));
    store();
    readStars();
    stars[level] = (stars[level] || 0) | earned;
    storageOK = writeJson(starsKey, stars) && storageOK;
  }
}
function lesson() {
  if (game.terrain.outrun && !game.terrain.outrun.gathered) return 'outrun';
  if (game.terrain.gate && !game.terrain.gate.open) return 'hold';
  return game.lesson === 'drag' || mode === 'endless' && !saved.played ? 'drag' : null;
}
function guidance() {
  const { gate, bridge, lane, bog, outrun } = game.terrain;
  if (outrun && !outrun.gathered) return 'Flick ' + (outrun.x < 180 ? 'left' : 'right') + ' to gather the bellwether.';
  if (gate && !gate.open) {
    if (gate.progress > 0) return 'Hold the flock · gate opening ' + Math.round(100 * gate.progress) + '%';
    return 'Drive to the cross-gate, then hold still.';
  }
  if (game.dog.mode === 'hold') return 'Dog lying down · drag to run again.';
  if (game.level === 1 && !tutorialMoved) return 'Drag uphill behind the flock.';
  if (bridge) return 'Bring the flock across the timber bridge.';
  if (lane) return 'Guide the flock between the stone walls.';
  if (bog) return 'Skirt the soft ground beside the reeds.';
  if (game.weather.mist) return 'Mist shortens sight. Keep the flock close.';
  return 'Bring every sheep to the lanterns.';
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
  const calm = Math.round(game.calm * 100);
  if (el('calm').value !== calm) el('calm').value = calm;
  setText('calm-value', calm + '%');
  setText('instruction', guidance());
  setText('score', mode !== 'endless' ? game.score + ' points' : (carried + game.home) + ' counted · best ' + saved.best);
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
  const earned = resultStars();
  el('stars').hidden = mode === 'endless';
  el('stars').replaceChildren(...starNames.map((name, index) => {
    const wonStar = Boolean(earned & (1 << index));
    const item = document.createElement('div');
    item.className = wonStar ? 'star earned' : 'star';
    const mark = document.createElement('span');
    mark.textContent = wonStar ? '★' : '☆';
    mark.setAttribute('aria-label', wonStar ? 'Earned' : 'Missed');
    item.append(mark, name);
    return item;
  }));
  if (mode !== 'endless') {
    el('end-score').textContent += ' · ' + game.time.toFixed(1) + 's / ' + game.par + 's par · low calm ' + Math.round(game.minCalm * 100) + '%';
  }
  el('next').hidden = !won;
  el('next').textContent = mode === 'endless' ? 'Next flock' : mode === 'daily' ? 'Back to campaign' : level === LIMIT_LEVEL ? 'Count them home ∞' : 'Next evening';
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
  const weatherNote = (game.weather.mist ? ' Mist shortens the flock’s sight.' : '') +
    (game.weather.wind ? ' The whistle carries farther downwind.' : '');
  el('pause-goal').textContent = guidance() + weatherNote + (mode === 'endless' ? '' : ' For three stars, keep every sheep, hold calm at 78% or higher and finish within ' + game.par + ' seconds.');
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
  readStars();
  valley(el('valley'), el('levels'), saved.unlocked, mode === 'campaign' ? level : null, stars, campaign);
  const starCount = Object.values(stars).reduce((n, bits) => n + countStars(bits), 0);
  el('total-stars').textContent = '★ ' + starCount + ' / ' + LIMIT_LEVEL * 3;
  const today = new Date().toISOString().slice(0,10);
  const lastDaily = readJson(dailyKey) || dailyRecord;
  el('record').textContent = (lastDaily?.date === today ? 'Daily ' + countStars(lastDaily.stars) + '/3 stars · ' : '') +
    'Endless · device best ' + saved.best + (storageOK ? '' : ' · this session only');
  display('evenings-screen');
}
function countStars(bits) {
  return (bits & 1) + (bits >> 1 & 1) + (bits >> 2 & 1);
}
el('field-map').onclick = () => {
  pause();
  const interrupted = screen === 'paused';
  fields();
  if (interrupted) fromFields = 'play';
};
el('daily').onclick = daily;
el('pause').onclick = pause;
el('resume').onclick = resume;
el('evenings').onclick = fields;
el('end-evenings').onclick = fields;
function closeMap() {
  display(fromFields);
  if (fromFields === 'play') audio.release();
}
el('back').onclick = closeMap;
el('endless').onclick = endless;
el('retry').onclick = () => mode === 'endless' ? endless() : fresh();
el('next').onclick = () => {
  if (mode === 'endless') {
    carried += game.home;
    wave++;
    fresh();
  } else if (mode === 'daily') campaign(saved.unlocked);
  else if (level === LIMIT_LEVEL) endless();
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
  else if (screen === 'evenings') closeMap();
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
  gesture = {start: target, anchor: target, previous: target, arc: 0, began: event.timeStamp, stillFor: 0, held: false};
  try { canvas.setPointerCapture(owner); } catch { /* Dispatched pointers have no capture. */ }
  audio.release();
  audio.unlock();
  if (!saved.played) { saved.played = true; store(); }
  // A quick tap can end between two animation frames. Accept its first step here.
  if (!game.started) step(game, 1 / 60, target);
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== owner) return;
  const next = point(event);
  const travel = Math.hypot(next.x - gesture.start.x, next.y - gesture.start.y);
  gesture.arc += Math.hypot(next.x - gesture.previous.x, next.y - gesture.previous.y);
  gesture.previous = next;
  const drift = Math.hypot(next.x - gesture.anchor.x, next.y - gesture.anchor.y);
  // Accept a slow, deliberate drag, even before it exceeds the tremor radius.
  const directed = !gesture.held && drift >= 2.5 && drift >= .82 * gesture.arc;
  if (!gesture.held && drift >= 1.2 && drift >= .82 * gesture.arc) gesture.stillFor = 0;
  if (drift > 8 || directed) {
    gesture.anchor = next;
    gesture.arc = 0;
    gesture.stillFor = 0;
    gesture.held = false;
  }
  if (!gesture.held) target = next;
  if (travel >= 14) {
    tutorialMoved = true;
    if (lesson() === 'drag') hints.drag.done();
  }
});
function whistle(kind, direction) {
  if (lesson() === kind) hints[kind].done();
  command(game, kind, direction);
  const high = kind === 'outrun';
  audio.tone(high ? 1100 : 660, high ? .21 : .13, .025, 'sine', high ? 360 : -120);
}
canvas.addEventListener('pointerup', event => {
  if (event.pointerId !== owner) return;
  const end = point(event);
  const dx = end.x - gesture.start.x, dy = end.y - gesture.start.y;
  const duration = Math.max(1, event.timeStamp - gesture.began);
  if (!gesture.held && duration <= 300 && Math.abs(dx) >= 28 && Math.abs(dx) >= Math.abs(dy) * .72 &&
      Math.abs(dx) / duration >= .18) whistle('outrun', Math.sign(dx));
  release();
});
for (const name of ['pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(name, event => { if (event.pointerId === owner) release(); });
}
function holdIfStill(dt) {
  if (!gesture || gesture.held) return;
  // A blocked display can also delay pointer events. Missing frames cannot certify a hold.
  gesture.stillFor += Math.min(dt, .05);
  if (gesture.stillFor < .43) return;
  // A distant press also lets the dog catch up to the point before it lies down.
  if (target && Math.hypot(target.x - game.dog.x, target.y - game.dog.y) > 14 &&
      Math.hypot(target.x - gesture.start.x, target.y - gesture.start.y) >= 14) return;
  gesture.held = true;
  target = null;
  whistle('hold');
}
const hints = {};
const gestures = {
  drag: ['hold-and-move', 'Drag behind the flock.'],
  hold: ['tap', 'Hold still to lie down at the cross-gate.'],
  outrun: ['drag', 'Flick toward the bellwether to send the dog wide.']
};
for (const [name, [kind, label]] of Object.entries(gestures)) {
  // An inert anchor lets an unrelated gesture leave this lesson available.
  hints[name] = hint(el('hint-' + name), {
    kind, label, key: 'night-flock-2:hint-' + name,
    when: () => screen === 'play' && game?.status === 'play' && owner === null && lesson() === name,
    delay: name === 'drag' ? 6500 : 2200, reach: 27,
    bottom: () => innerHeight - canvas.getBoundingClientRect().bottom + canvas.clientHeight * .2
  });
}

function resize() {
  const scale = Math.min(2, devicePixelRatio || 1);
  const box = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(box.width * scale));
  canvas.height = Math.max(1, Math.round(box.height * scale));
}
function paint() {
  ctx.setTransform(canvas.width / 360, 0, 0, canvas.height / 520, 0, 0);
  const guide = mode === 'campaign' && level === 1 && !tutorialMoved && !target && game.status === 'play'
    && !hints.drag.shown && query.get('hint') !== '0';
  draw(ctx, game, { clock: reducedMotion.matches && (!game.started || guide) ? 1.7 : clock, look, pressed: target, guide });
}
function frame(now) {
  const dt = lastFrame === null ? 0 : Math.min(.12, (now - lastFrame) / 1000);
  lastFrame = now;
  if (screen === 'play') {
    clock += reducedMotion.matches && !game.started ? 0 : dt;
    if (game.status === 'play') {
      const home = game.home, rescued = game.rescued, lost = game.lost;
      holdIfStill(dt);
      step(game, dt, target);
      if (game.home > home) {
        recordCount();
        audio.tone([392, 494, 587, 659][(game.home - 1) % 4], .24, .035, 'sine');
      }
      if (game.rescued > rescued) say('Stray brought home +' + RESCUE_POINTS.toLocaleString());
      else if (game.lost > lost) say('Lost from the flock');
      if (game.status !== 'play') {
        award();
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
window.flockState = () => structuredClone({game, screen, mode, wave, saved, stars, dailyDate, pressed: owner !== null});
