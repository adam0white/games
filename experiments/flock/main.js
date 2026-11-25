import { command, createGame, LIMIT_LEVEL, RESCUE_POINTS, step } from './sim.js';
import { farm, valley } from './valley.js';
import { draw } from './art.js';
import { read, write, readJson, writeJson } from '../kit/save.js';
import { sound } from '../kit/audio.js';
import { music } from '../kit/music.js';
import { SONG, mood, look as counts, heard } from './song.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { noZoom } from '../kit/zoom.js';
import { screens } from '../kit/screens.js';
import { hint } from '../kit/hint.js';
import { lab } from '../kit/lab.js';
import { cue, steerable } from './teach.js';
import { t, lang, apply, setLang, num } from './words.js';

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

// Music (kit/music.js, 2026-11-24): the bell preset, played by the flock (song.js). Its own key, '0' when turned off.
const musicKey = 'night-flock-2:music';
let musicOn = read(musicKey) !== '0', song = null, songFor = null;
const audio = sound({ on: () => saved.sound, setup: ac => { song = music(ac, { preset: SONG.preset }); song.volume(SONG.volume); } });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let mode = 'campaign', level = saved.unlocked, wave = 1, carried = 0, endlessSeed = 0;
let game, screen, lastFrame = null, owner = null, target = null, fromFields = 'paused';
let gesture = null, tutorialMoved = false;
let dailyDate = '', dailySeed = 0;
const starNames = ['noneLost', 'calmKept', 'underPar'];
// Play recording for the game lab: one run for each evening the player touches.
const rec = lab('flock');
let running = false, tally = null, picture = null;
function summary() {
  const missing = game.sheep.find(sheep => sheep.status === 'lost');
  return { level: game.level, mode, home: game.home, sheep: game.sheep.length, lost: game.lost, rescued: game.rescued,
    t: Math.round(game.time * 10) / 10, calm: Math.round(game.minCalm * 100), stars: countStars(resultStars()),
    ...tally, ...(missing ? { lostTo: missing.lostTo } : {}) };
}
function began() {
  if (running || !game.started) return;
  running = true;
  tally = { holds: 0, flicks: 0, wrongFlicks: 0, gateAt: null, gatheredAt: null };
  rec.start({ level: game.level, mode, wave: mode === 'endless' ? wave : undefined, seed: game.seed, sheep: game.sheep.length, lang: lang() });
}
function ended(outcome) {
  if (!running) return;
  running = false;
  rec.end(outcome, summary());
}
const calmStar = .78;
let endWait = 0, message = '', messageUntil = 0, clock = 0;

function release() {
  const previous = owner;
  owner = null;
  target = null;
  gesture = null;
  if (previous !== null && canvas.hasPointerCapture(previous)) canvas.releasePointerCapture(previous);
}
const display = screens(['start', 'paused', 'evenings-screen', 'end'], id => {
  screen = id === 'evenings-screen' ? 'evenings' : id;
  document.querySelector('.folio').inert = screen !== 'play';
  if (screen !== 'play') (el(id).querySelector('button.primary:not([hidden])') ?? el(id).querySelector('button:not([hidden]):not(:disabled)'))?.focus({preventScroll: true});
  lastFrame = null;
});
const farmName = n => t(farm(n));
function describe() {
  if (mode === 'endless') return t('endlessRun', { n: wave });
  if (mode === 'daily') return t('dailyRun', { date: dailyDate.slice(5) });
  return t('evening', { n: String(level).padStart(2, '0'), total: LIMIT_LEVEL });
}
// Every label that names the evening in play.
function relabel() {
  el('farm').textContent = mode === 'endless' ? t('common') : t('farmLine', { farm: farmName(level) });
  const { mist, wind } = game.weather;
  el('weather').textContent = [mist ? t('mist') : '', wind ? t('wind', { arrow: wind < 0 ? '←' : '→' }) : ''].filter(Boolean).join(' · ') || t('still');
  for (const id of ['chapter', 'start-chapter', 'pause-chapter']) el(id).textContent = describe();
  el('play').textContent = mode === 'campaign' ? t('playEvening', { n: level }) : t('play');
}
function fresh() {
  if (game?.status === 'play') ended('left');
  running = false;
  release();
  tutorialMoved = false;
  let seed = level;
  if (mode === 'endless') seed = (endlessSeed + Math.imul(wave, 2654435761)) >>> 0;
  if (mode === 'daily') seed = dailySeed;
  game = createGame(mode === 'endless' ? LIMIT_LEVEL + wave : level, seed);
  el('hint-outrun').classList.toggle('left', (game.terrain.outrun?.x ?? 180) < 180);
  message = null;
  endWait = 0;
  picture = cue(game);
  relabel();
  el('total').textContent = game.sheep.length;
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
// Which moving-hand lesson is due: the page pictures the same thing on the field (teach.js).
function lesson() {
  if (picture?.kind === 'outrun') return 'outrun';
  if (picture?.kind === 'hold') return game.dog.mode === 'hold' ? null : 'hold';
  if (picture && picture.kind !== 'drag' && picture.kind !== 'bring') return null;
  return game.lesson === 'drag' || mode === 'endless' && !saved.played ? 'drag' : null;
}
function recordCount() {
  if (mode === 'endless' && carried + game.home > saved.best) {
    saved.best = carried + game.home;
    store();
  }
}
function say(key, vars) {
  message = [key, vars];
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
  setText('score', mode !== 'endless' ? t('points', { n: num(game.score) }) : t('counted', { n: carried + game.home, best: saved.best }));
  setText('remark', !storageOK ? t('sessionOnly') : message && game.time < messageUntil ? t(...message) : '');
}
function syncSound() {
  el('sound').textContent = t(saved.sound ? 'soundOn' : 'soundOff');
  el('sound').setAttribute('aria-pressed', String(saved.sound));
  el('music').textContent = t(musicOn ? 'musicOn' : 'musicOff');
  el('music').setAttribute('aria-pressed', String(musicOn));
}
function starRow(holder, names, earned) {
  holder.replaceChildren(...names.map((name, index) => {
    const wonStar = Boolean(earned & (1 << index));
    const item = document.createElement('div');
    item.className = wonStar ? 'star earned' : 'star';
    item.style.setProperty('--order', index);
    const mark = document.createElement('span');
    mark.textContent = wonStar ? '★' : '☆';
    mark.setAttribute('aria-label', t(wonStar ? 'earned' : 'missed'));
    item.append(mark, name);
    return item;
  }));
}
function renderEnd() {
  const won = game.status === 'won';
  const last = won && mode === 'campaign' && level === LIMIT_LEVEL;
  el('end').classList.toggle('finale', last);
  el('end-caption').textContent = describe();
  const missing = game.sheep.find(sheep => sheep.status === 'lost');
  el('end-title').textContent = t(last ? 'finale' : won ? 'won' : missing ? (missing.lostTo === 'woods' ? 'woods' : 'stream') : 'night');
  el('end-line').textContent = last ? t('finaleLine') : t('inFold', { home: game.home, total: game.sheep.length }) +
    (game.rescued ? ' · ' + t(game.rescued === 1 ? 'stray' : 'strays', { n: game.rescued }) : '') + '.';
  el('end-score').textContent = (mode === 'endless'
    ? t('endlessScore', { points: num(game.score), count: carried + game.home, best: saved.best }) : t('points', { n: num(game.score) })) +
    (storageOK ? '' : ' · ' + t('sessionShort'));
  el('stars').hidden = mode === 'endless';
  starRow(el('stars'), starNames.map(name => t(name)), resultStars());
  if (mode !== 'endless') {
    el('end-score').textContent += ' · ' + t('result', { time: game.time.toFixed(1), par: game.par, calm: Math.round(game.minCalm * 100) });
  }
  if (last) {
    const all = Object.values(stars).reduce((n, bits) => n + countStars(bits), 0);
    el('end-score').textContent += ' · ★ ' + all + ' / ' + LIMIT_LEVEL * 3;
  }
  el('next').hidden = !won;
  el('retry').classList.toggle('primary', !won);
  el('next').textContent = t(mode === 'endless' ? 'nextFlock' : mode === 'daily' ? 'toCampaign' : level === LIMIT_LEVEL ? 'endless' : 'next');
  el('retry').textContent = t(mode === 'endless' ? 'newCount' : 'again');
}
function chime(notes, gap = 110) {
  notes.forEach((note, index) => setTimeout(() => { if (screen === 'end') audio.tone(note, .3, .04, 'sine', 12); }, index * gap));
}
function finish() {
  release();
  renderEnd();
  display('end');
  const won = game.status === 'won';
  if (won && mode === 'campaign' && level === LIMIT_LEVEL) chime([392, 494, 587, 784, 587, 784, 988], 150);
  else if (won) chime([523, 659, 784]);
  else audio.tone(196, .5, .04, 'sine', -40);
}
function renderPause() {
  el('pause-stars').hidden = mode === 'endless';
  starRow(el('pause-stars'), [t('noneLost'), t('calmGoal', { n: Math.round(calmStar * 100) }), t('parGoal', { n: game.par })],
    mode === 'campaign' ? stars[level] || 0 : 0);
  syncSound();
}
function pause() {
  if (screen !== 'play') return;
  if (game.status !== 'play') { finish(); return; }
  release();
  audio.hold();
  renderPause();
  display('paused');
}
function resume() {
  if (screen !== 'paused') return;
  display('play');
  audio.release();
}
function fields() {
  if (screen !== 'evenings') fromFields = screen;
  readStars();
  valley(el('valley'), el('levels'), saved.unlocked, mode === 'campaign' ? level : null, stars, n => { campaign(n); display('play'); }, t);
  const starCount = Object.values(stars).reduce((n, bits) => n + countStars(bits), 0);
  el('total-stars').textContent = '★ ' + starCount + ' / ' + LIMIT_LEVEL * 3;
  const today = new Date().toISOString().slice(0,10);
  const lastDaily = readJson(dailyKey) || dailyRecord;
  el('record').textContent = (lastDaily?.date === today ? t('dailyRecord', { n: countStars(lastDaily.stars) }) : '') +
    t('endlessRecord', { n: saved.best }) + (storageOK ? '' : ' · ' + t('sessionShort'));
  if (screen !== 'evenings') display('evenings-screen');
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
el('daily').onclick = () => { daily(); display('play'); };
el('play').onclick = () => {
  if (screen !== 'start') return;
  display('play');
  audio.release();
  audio.unlock();
  audio.tone(523, .14, .03);
};
el('pause').onclick = pause;
el('resume').onclick = resume;
el('evenings').onclick = fields;
el('end-evenings').onclick = fields;
function closeMap() {
  display(fromFields);
  if (fromFields === 'play') audio.release();
}
el('back').onclick = closeMap;
el('endless').onclick = () => { endless(); display('play'); };
el('retry').onclick = () => { if (mode === 'endless') endless(); else fresh(); display('play'); };
el('next').onclick = () => {
  if (mode === 'endless') {
    carried += game.home;
    wave++;
    fresh();
  } else if (mode === 'daily') campaign(saved.unlocked);
  else if (level === LIMIT_LEVEL) endless();
  else campaign(level + 1);
  display('play');
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
el('music').onclick = () => {
  musicOn = !musicOn;
  write(musicKey, musicOn ? '1' : '0');
  syncSound();
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
  began();
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== owner) return;
  const next = point(event);
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
  const uphill = gesture.start.y - next.y;
  if (uphill >= 14 && uphill >= Math.abs(next.x - gesture.start.x)) {
    tutorialMoved = true;
    if (lesson() === 'drag') hints.drag.done();
  }
});
function whistle(kind, direction) {
  if (kind === 'hold' && lesson() === 'hold') hints.hold.done();
  began();
  if (kind === 'hold') {
    if (tally.holds++ < 12) rec.event('hold', { t: Math.round(game.time * 10) / 10, asked: picture?.kind === 'hold' });
  } else {
    const asked = picture?.kind === 'outrun' ? picture.dir : 0;
    if (asked && asked !== direction) tally.wrongFlicks++;
    if (tally.flicks++ < 12) rec.event('flick', { t: Math.round(game.time * 10) / 10, dir: direction, asked });
  }
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
  // The dog finishes its circle round the bellwether before it takes another order.
  if (!steerable(game)) { gesture.stillFor = 0; return; }
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
  drag: ['hold-and-move', 'hintDrag', 6500],
  hold: ['tap', 'hintHold', 1200],
  outrun: ['drag', 'hintOutrun', 2200]
};
for (const [name, [kind, label, delay]] of Object.entries(gestures)) {
  // An inert anchor lets an unrelated gesture leave this lesson available.
  hints[name] = hint(el('hint-' + name), {
    kind, label: t(label), key: 'night-flock-2:hint-' + name,
    when: () => screen === 'play' && game?.status === 'play' && owner === null &&
      game.dog.mode !== 'outrun' && lesson() === name,
    delay, reach: 27
  });
}
function hintLabels() {
  for (const [name, [, label]] of Object.entries(gestures)) {
    const words = document.querySelector('#hint-' + name + ' + .kit-hint .label');
    if (words) words.textContent = t(label);
  }
}

function resize() {
  const scale = Math.min(2, devicePixelRatio || 1);
  const box = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(box.width * scale));
  canvas.height = Math.max(1, Math.round(box.height * scale));
}
const plate = document.querySelector('.plate');
function paint() {
  ctx.setTransform(canvas.width / 360, 0, 0, canvas.height / 520, 0, 0);
  const guide = mode === 'campaign' && level === 1 && !tutorialMoved && !target && game.status === 'play'
    && query.get('hint') !== '0';
  const shown = game.status === 'play' && picture?.kind !== 'drag' && query.get('hint') !== '0' ? picture : null;
  plate.classList.toggle('cue-hold', shown?.kind === 'hold');
  if (shown?.kind === 'hold') {
    // The moving hand of the lie-down lesson sits where the field asks for the press.
    plate.style.setProperty('--cue-x', shown.x / 3.6 + '%');
    plate.style.setProperty('--cue-y', shown.y / 5.2 + '%');
  }
  draw(ctx, game, { clock: reducedMotion.matches && (!game.started || guide) ? 1.7 : clock, look, pressed: target, guide,
    picture: shown, hand: !hints.hold.shown && !hints.outrun.shown });
}
function frame(now) {
  const dt = lastFrame === null ? 0 : Math.min(.12, (now - lastFrame) / 1000);
  lastFrame = now;
  if (song && songFor !== game) { songFor = game; song.start(game.seed); } // each evening its own tune, from its seed
  song?.set({ on: musicOn && saved.sound && screen === 'play' && game.status === 'play' && game.started, ...mood(game) });
  if (screen === 'play') {
    clock += reducedMotion.matches && !game.started ? 0 : dt;
    if (game.status === 'play') {
      const home = game.home, rescued = game.rescued, lost = game.lost;
      const flank = game.terrain.outrun;
      const gathering = flank && !flank.gathered;
      const closed = game.terrain.gate && !game.terrain.gate.open;
      holdIfStill(dt);
      const before = counts(game);
      step(game, dt, steerable(game) ? target : null);
      const heardNow = heard(before, game);
      began();
      picture = cue(game);
      if (gathering && flank.gathered) {
        hints.outrun.done();
        if (running) { tally.gatheredAt = Math.round(game.time * 10) / 10; rec.event('gathered', { t: tally.gatheredAt }); }
      }
      if (closed && game.terrain.gate.open && running) {
        tally.gateAt = Math.round(game.time * 10) / 10;
        rec.event('gate', { t: tally.gateAt });
      }
      // With the music on, each sheep into the fold plays the next note of the evening's tune; a stray is a note not
      // played; a lost sheep thins the music. With it off (or the tune's queue full), the fold's own note as before.
      let sung = false;
      if (musicOn && song) for (let i = 0; i < heardNow.notes; i++) sung = !!song.ember() || sung;
      for (let i = 0; i < heardNow.misses; i++) song?.miss();
      for (let i = 0; i < heardNow.blows; i++) song?.hit();
      if (game.home > home) {
        recordCount();
        if (!sung) audio.tone(musicOn && song ? song.chime(game.home - 1) : [392, 494, 587, 659][(game.home - 1) % 4], .24, .035, 'sine');
      }
      if (game.rescued > rescued) say('rescued', { n: num(RESCUE_POINTS) });
      else if (game.lost > lost) say('lostOne');
      if (game.status !== 'play') {
        ended(game.status === 'won' ? 'won' : game.lost ? 'lost' : 'dark');
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
// The recording notice is on the first card; its switch is on the pause card, where the notice says it is.
const notice = rec.notice(el('start').firstElementChild);
const recordingToggle = rec.toggle(el('paused').firstElementChild);
const recordingChoice = recordingToggle?.querySelector('input');
if (notice) notice.querySelector('a').dataset.i18n = 'privacy';
function updateRecording() {
  if (notice) notice.firstChild.data = t(recordingChoice?.checked ? 'recordingOn' : 'recordingOff') + ' ';
  if (recordingToggle) recordingToggle.lastChild.data = ' ' + t('recordingToggle');
}
recordingChoice?.addEventListener('change', updateRecording);
addEventListener('storage', updateRecording);
function syncNotes() {
  document.getElementById('notes-button')?.setAttribute('aria-label', t('notes'));
}
document.addEventListener('DOMContentLoaded', syncNotes, { once: true });
function translatePage() {
  document.title = t('title');
  apply();
  relabel();
  updateLedger();
  updateRecording();
  syncNotes();
  hintLabels();
  for (const button of document.querySelectorAll('.language')) {
    button.lastElementChild.textContent = t(lang() === 'en' ? 'enCode' : 'trCode');
    button.setAttribute('aria-label', t('switchLanguage'));
  }
  if (screen === 'paused') renderPause();
  if (screen === 'end') renderEnd();
  if (screen === 'evenings') fields();
  syncSound();
}
for (const id of ['lang-start', 'lang-pause']) {
  const button = el(id);
  button.append(el('language-icon').content.cloneNode(true));
  button.onclick = () => {
    setLang(lang() === 'en' ? 'tr' : 'en');
    // Keep an explicit link consistent with the new choice after refresh.
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.set('lang', lang());
      history.replaceState(history.state, '', url);
    }
    translatePage();
  };
}
fresh();
translatePage();
display('start');
new ResizeObserver(() => { resize(); paint(); }).observe(canvas);
resize();
paint();
requestAnimationFrame(frame);

// Read-only snapshot for phone checks. It cannot steer the dog or advance time.
window.flockState = () => structuredClone({game, screen, mode, wave, saved, stars, dailyDate, pressed: owner !== null,
  lang: lang(), picture: picture?.kind ?? null, recording: rec.on, sent: rec.sent, music: musicOn});
window.flockMusic = () => song && { ...song.melody, on: song.state.on, step: song.step, notes: song.log.length, kinds: song.log.map(l => l.kind) }; // read by the phone check
