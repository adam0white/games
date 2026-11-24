import { sound } from '../kit/audio.js';
import * as save from '../kit/save.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { lab } from '../kit/lab.js';
import { hint } from '../kit/hint.js';
import { noZoom } from '../kit/zoom.js';
import {
  CASES, CLOCK_START, CLOCK_STEP, createCase, dailyCase, dailyWin, dayKey, dossiers, freshRun, accuse, observe,
} from './sim.js';
import {
  W, H, INK, CREAM, GOLD, rect, text, star, clock, place, animal, costume, signature,
  sky, roomLayout, roomPoint, house, trace, eventIcon, stamp, hand,
} from './art.js';

const $ = id => document.getElementById(id);
const canvas = $('c');
const g = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const KEY = 'alibi-save';
const validLevel = n => Number.isInteger(n) && n >= 1 && n <= CASES.length;
const validStars = n => Number.isInteger(n) && n >= 1 && n <= 3;
const seed = params.has('seed') && Number.isFinite(Number(params.get('seed'))) ? Number(params.get('seed')) >>> 0 : 32342;
const forceLevel = Number(params.get('level'));
const loaded = save.readJson(KEY);
function readProfile(value) {
  const { level, stars, sound, daily } = value ?? {};
  const best = Object.fromEntries(Object.entries(stars ?? {}).filter(([key, stars]) => validLevel(Number(key)) && validStars(stars)));
  return {
    level: validLevel(level) ? level : 1,
    stars: best,
    sound: sound !== false,
    daily: {
      last: typeof daily?.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(daily.last) ? daily.last : '',
      streak: Number.isSafeInteger(daily?.streak) && daily.streak > 0 ? daily.streak : 0,
      best: validStars(daily?.best) ? daily.best : 0,
    },
  };
}
const profile = readProfile(loaded);
const rec = lab('alibi');
const snd = sound({ on: () => profile.sound });
const showCards = screens(['menu', 'cases', 'paused', 'done', 'sharing']);
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const replay = { x: 42, endX: 318, y: 561 };
const homeStamp = { x: 180, y: 605 };

let c = createCase({ seed, level: 1 });
let board = [];
let cast = [];
let rooms = [];
let screen = 'menu';
let daily = false;
let day = '';
let run = freshRun();
let time = 0;
let selected = null;
let pointer = null;
let lastShot = null;
let justScrubbed = false;
let seen = new Set();
let scrolled = new Set();
let phase = 0;
let hintReady = 0;
let scale = 1;
let originX = 0;
let originY = 0;

const beatNow = () => Math.round(time);
const minute = beat => CLOCK_START + beat * CLOCK_STEP;
const formatTime = beat => {
  const m = minute(beat);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
const tickX = beat => replay.x + (replay.endX - replay.x) * beat / (c.beatCount - 1);
function syncProfile() {
  const latest = readProfile(save.readJson(KEY));
  profile.level = Math.max(profile.level, latest.level);
  for (const [level, stars] of Object.entries(latest.stars)) {
    profile.stars[level] = Math.max(profile.stars[level] ?? 0, stars);
  }
  if (latest.daily.last > profile.daily.last) profile.daily = latest.daily;
  else if (latest.daily.last === profile.daily.last) {
    profile.daily.best = Math.max(profile.daily.best, latest.daily.best);
    profile.daily.streak = Math.max(profile.daily.streak, latest.daily.streak);
  }
  profile.sound = latest.sound;
}
const persist = () => save.writeJson(KEY, profile);
const playing = () => screen === 'play';
const setScreen = next => {
  screen = next;
  showCards(next);
  $('pause').hidden = !playing();
};

function updateMenu() {
  const current = validLevel(forceLevel) ? forceLevel : profile.level;
  $('progress').textContent = `${current} /${CASES.length}`;
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const streak = profile.daily.last >= yesterday ? profile.daily.streak : 0;
  $('streak').textContent = streak ? `✦${streak}` : '◇';
  $('daily').setAttribute('aria-label', `Daily case, streak ${streak}`);
  $('menuSound').textContent = profile.sound ? '♪' : '♪̸';
  $('pauseSound').textContent = profile.sound ? 'Sound on' : 'Sound off';
  for (const id of ['menuSound', 'pauseSound']) $(id).setAttribute('aria-pressed', profile.sound);
}

function openCases() {
  const choices = CASES.map((spec, i) => {
    const button = document.createElement('button');
    const level = i + 1;
    button.disabled = level > profile.level;
    button.classList.toggle('primary', level === profile.level);
    button.textContent = level;
    const stars = document.createElement('span');
    stars.textContent = '★'.repeat(profile.stars[level] ?? 0);
    button.append(stars);
    button.setAttribute('aria-label', `Chapter ${spec.chapter}, case ${level}`);
    button.addEventListener('click', () => start(false, level));
    return button;
  });
  $('caseGrid').replaceChildren(...choices);
  setScreen('cases');
}

function loadBoard(next) {
  c = next;
  cast = dossiers(c);
  rooms = roomLayout(c.spec.rooms);
  board = Array.from({ length: c.beatCount }, (_, beat) => observe(c, beat));
}

function start(isDaily, level = profile.level) {
  snd.release();
  snd.unlock();
  daily = isDaily;
  day = daily ? dayKey() : '';
  loadBoard(daily ? dailyCase(day) : createCase({ seed, level }));
  time = 0;
  selected = null;
  pointer = null;
  lastShot = null;
  justScrubbed = false;
  seen = new Set();
  scrolled = new Set();
  run = freshRun();
  hintReady = phase;
  setScreen('play');
  rec.start({ level: daily ? `daily-${day}` : c.level });
  snd.tone(494, .15, .09, 'triangle', 160);
}

function pause() {
  if (!playing()) return;
  pointer = null;
  snd.hold();
  setScreen('paused');
}

function resume() {
  if (screen !== 'paused') return;
  snd.release();
  snd.unlock();
  setScreen('play');
}

function endSummary() {
  return { level: daily ? `daily-${day}` : c.level, stars: run.stars, marks: scrolled.size,
    statements: seen.size, guesses: run.rejected.length + Number(run.outcome === 'solved') };
}

function menu() {
  if (screen === 'paused' || playing()) rec.end('left', endSummary());
  pointer = null;
  loadBoard(createCase({ seed, level: 1 }));
  time = 0;
  if (save.readJson(KEY) !== null) syncProfile();
  updateMenu();
  setScreen('menu');
}

function toggleSound() {
  if (save.readJson(KEY) !== null) syncProfile();
  profile.sound = !profile.sound;
  if (profile.sound) snd.unlock();
  persist();
  updateMenu();
}

$('play').onclick = () => start(false, validLevel(forceLevel) ? forceLevel : profile.level);
$('daily').onclick = () => start(true);
$('pickCase').onclick = openCases;
$('caseMenu').onclick = menu;
$('pause').onclick = pause;
$('resume').onclick = resume;
$('toMenu').onclick = menu;
$('endMenu').onclick = menu;
$('again').onclick = () => start(daily, c.level);
$('next').onclick = () => start(false, Math.min(CASES.length, c.level + 1));
$('menuSound').onclick = toggleSound;
$('pauseSound').onclick = toggleSound;
$('share').onclick = openShare;
$('closeShare').onclick = () => setScreen('done');
$('sendShare').onclick = shareImage;
rec.notice($('menu').querySelector('.panel'));
rec.toggle($('paused').querySelector('.panel'));
onLeave(pause);
noZoom();

function layout() {
  const box = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  scale = Math.min(box.width / W, box.height / H) || 1;
  originX = (box.width - W * scale) / 2;
  originY = (box.height - H * scale) / 2;
  $('layout').style.setProperty('--scale', scale);
}
addEventListener('resize', layout);
layout();

const help = hint(canvas, {
  kind: 'drag', key: 'kit-hint:alibi', played: Boolean(loaded), when: playing,
  delay: 1700, reach: 64, label: '↔',
  bottom: () => {
    const box = canvas.getBoundingClientRect();
    return box.height - originY - replay.y * scale;
  },
});

function portraitPoints() {
  return cast.map((_, id) => ({
    x: 88.5 + (id % 4) * 61 + (id >= 4 && cast.length < 8 ? (8 - cast.length) * 30.5 : 0),
    y: id < 4 ? 448 : 493,
  }));
}

function actorPositions() {
  const beat = beatNow();
  const frame = board[beat];
  if (frame.blackout) return [];
  const a = Math.floor(time);
  const b = Math.ceil(time);
  const raw = time - a;
  const f = Math.max(0, Math.min(1, (raw - .14) / .72));
  const mix = f * f * (3 - 2 * f);
  const walk = a !== b && f > 0 && f < 1 && !board[a].blackout && !board[b].blackout;
  const publicActors = frame.actors;
  return publicActors.map(actor => {
    const here = roomPoint(rooms[actor.room], actor.slot);
    if (!walk || actor.mask !== null && board[b].exchange) return { ...actor, ...here, walk: 0 };
    // Match only the tags the camera shows. Interpolation uses the same
    // information as inspecting two neighboring stills.
    const match = candidate => actor.mask === null ? candidate.portrait === actor.portrait : candidate.mask === actor.mask;
    const before = board[a].actors.find(match);
    const after = board[b].actors.find(match);
    if (!before || !after) return { ...actor, ...here, walk: 0 };
    const start = roomPoint(rooms[before.room], before.slot);
    const end = roomPoint(rooms[after.room], after.slot);
    return {
      ...actor, x: start.x + (end.x - start.x) * mix, y: start.y + (end.y - start.y) * mix - 6 * Math.sin(Math.PI * mix),
      walk: Math.hypot(end.x - start.x, end.y - start.y) > 3 ? 1 : 0,
    };
  });
}

function point(e) {
  const box = canvas.getBoundingClientRect();
  return { x: (e.clientX - box.left - originX) / scale, y: (e.clientY - box.top - originY) / scale };
}

function nearestId(p, drop = false) {
  const cards = portraitPoints();
  for (const [id, v] of cards.entries()) {
    if (Math.abs(p.x - v.x) <= 28 && Math.abs(p.y - v.y) <= 21) return id;
  }
  const actors = actorPositions()
    .filter(a => a.portrait !== null)
    .map(a => ({ id: a.portrait, d: Math.hypot((p.x - a.x) * 1.13, p.y - a.y + 3) }))
    .sort((a, b) => a.d - b.d);
  return actors[0]?.d <= (drop ? 26 : 24) ? actors[0].id : null;
}

function scrub(value, snap = false) {
  const old = beatNow();
  time = Math.max(0, Math.min(c.beatCount - 1, snap ? Math.round(value) : value));
  const beat = beatNow();
  justScrubbed ||= time > .2;
  scrolled.add(beat);
  if (old === beat) return;
  hintReady = phase;
  snd.tone(285 + beat * 33, .055, .055, 'triangle');
  if (board[beat].blackout) snd.noise(.14, .065, 2350);
  if (board[beat].incident && !board[old].incident) snd.tone(535, .13, .045, 'sine', -180);
}

function scrubAt(x, snap = false) {
  scrub((x - replay.x) * (c.beatCount - 1) / (replay.endX - replay.x), snap);
}

function inspect(id) {
  selected = selected === id ? null : id;
  if (!seen.has(id)) rec.event('inspect', { suspect: id });
  seen.add(id);
  snd.tone(512 + id * 20, .09, .065, 'triangle', 109);
  hintReady = phase;
}

function accuseId(id) {
  const next = accuse(c, run, id);
  if (next === run) return;
  run = next;
  lastShot = { at: phase, id, solved: run.outcome === 'solved' };
  rec.event('accuse', { suspect: id, correct: lastShot.solved, stars: run.stars });
  if (lastShot.solved) {
    for (const frequency of [523, 659, 784]) snd.tone(frequency, .38, .048, 'triangle', 32);
    if (save.readJson(KEY) !== null) syncProfile();
    if (daily) {
      const previous = profile.daily.last;
      Object.assign(profile.daily, dailyWin(previous, day, profile.daily.streak));
      if (profile.daily.last === day) {
        profile.daily.best = Math.max(previous === day ? profile.daily.best : 0, run.stars);
      }
    } else {
      profile.stars[c.level] = Math.max(profile.stars[c.level] ?? 0, run.stars);
      if (c.level >= profile.level) profile.level = Math.min(c.level + 1, CASES.length);
    }
    persist();
  } else {
    snd.noise(.1, .085, 570);
    snd.tone(182, .17, .082, 'triangle', -66);
  }
  if (run.outcome) {
    rec.end(run.outcome, endSummary());
    $('result').textContent = lastShot.solved ? 'Gotcha!' : 'Try again';
    $('next').hidden = daily || !lastShot.solved || c.level >= CASES.length;
    $('share').hidden = !daily;
    drawResult();
    setScreen('done');
  }
}

function begin(e) {
  if (!playing() || pointer || e.button > 0) return;
  const p = point(e);
  if (Math.abs(p.y - homeStamp.y) <= 25 && Math.abs(p.x - homeStamp.x) < 61) {
    pointer = { ...p, id: e.pointerId, type: 'stamp' };
    snd.tone(375, .06, .065, 'triangle', 60);
  } else if (Math.abs(p.y - replay.y) <= 24 && p.x > 13 && p.x < 347) {
    pointer = { ...p, id: e.pointerId, type: 'clock' };
    const before = beatNow();
    scrubAt(p.x);
    if (before === beatNow()) snd.tone(280 + before * 33, .045, .05, 'triangle');
  } else {
    const id = nearestId(p);
    if (id !== null) inspect(id);
    else if (selected !== null && p.y >= 62 && p.y <= 123) scrub(cast[selected].claim.beat, true);
    else return;
    pointer = { ...p, id: e.pointerId, type: 'tap' };
  }
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
}

function move(e) {
  if (pointer?.id !== e.pointerId) return;
  const p = point(e);
  if (pointer.type === 'clock') scrubAt(p.x);
  if (pointer.type === 'stamp') {
    const id = nearestId(p, true);
    if (id !== null && id !== pointer.target) snd.tone(645, .045, .035, 'sine', 110);
    pointer = { ...pointer, ...p, target: id };
  }
}

function release(e) {
  if (pointer?.id !== e.pointerId) return;
  const type = pointer.type;
  pointer = null;
  if (e.type !== 'pointerup') return;
  const p = point(e);
  if (type === 'clock') scrubAt(p.x, true);
  if (type === 'stamp') {
    const id = nearestId(p, true);
    if (id !== null) accuseId(id);
  }
}

canvas.addEventListener('pointerdown', begin);
canvas.addEventListener('pointermove', move);
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, release);
addEventListener('keydown', e => {
  if (isPauseKey(e)) {
    if (playing()) pause();
    else if (screen === 'paused') resume();
    return;
  }
  if (!playing()) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    scrub(beatNow() + (e.key === 'ArrowLeft' ? -1 : 1), true);
  } else if (/^[1-8]$/.test(e.key) && cast[Number(e.key) - 1]) {
    const id = Number(e.key) - 1;
    if (e.shiftKey) accuseId(id);
    else inspect(id);
  } else if (e.key === 'Enter' && selected !== null) {
    e.preventDefault();
    accuseId(selected);
  }
});

function dot(x, y, r, fill, stroke, weight = 1) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (stroke) { g.lineWidth = weight; g.strokeStyle = stroke; g.stroke(); }
}

function line(points, color, width = 1.5) {
  g.beginPath();
  g.moveTo(...points[0]);
  for (const end of points.slice(1)) g.lineTo(...end);
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
}

function heading(frame) {
  rect(g, 67, 13, 125, 44, 14, '#412f46', '#b4808180');
  eventIcon(g, 88, 34, 33, c.crime, frame.incident);
  text(g, daily ? '◇' : '◆'.repeat(c.spec.chapter), 105, 28, 8, GOLD, 'system-ui', 'left');
  text(g, daily ? 'Daily' : String(c.level).padStart(2, '0'), 105, 44, 15, CREAM, 'Georgia', 'left');
  for (let i = 0; i < 3; i++) star(g, 146 + i * 16, 37, 6.3, i < run.stars ? GOLD : '#594054', '#cf936d', 1);
  rect(g, 208, 13, 140, 44, 14, '#412f46', '#b4808180');
  clock(g, 232, 35, 13, minute(frame.beat));
  text(g, formatTime(frame.beat), 278, 35, 22, CREAM, 'Georgia');
  if (frame.blackout) {
    dot(328, 35, 8.5, '#6c5368', '#ad7889');
    line([[324, 39], [332, 31]], '#efd2ac', 2.1);
  }
}

function drawClaim(frame) {
  if (selected === null) return;
  const { species, sound: sign, claim } = cast[selected];
  g.beginPath();
  g.moveTo(122, 111);
  g.lineTo(116, 121);
  g.lineTo(143, 111);
  g.fillStyle = '#fff0d2';
  g.fill();
  rect(g, 83, 63, 194, 49, 15, '#2b1f36a0');
  rect(g, 83, 61, 194, 49, 15, '#fff0d2', '#985c71', 2);
  dot(110, 85, 17, '#f0cfb6', '#c58a86');
  animal(g, 110, 85, 30, species, { head: true });
  if (c.spec.blackout) {
    rect(g, 99, 97, 22, 9, 4, '#5a4256');
    signature(g, 110, 101.5, 18, sign);
  }
  place(g, 150, 85, 30, claim.room);
  clock(g, 190, 85, 14, minute(claim.beat));
  text(g, formatTime(claim.beat), 234, 85, 18, INK, 'Georgia');
  if (frame.beat === claim.beat) {
    rect(g, 85, 63, 190, 45, 13, null, '#c18468', 1);
  }
}

function drawReplay(frame) {
  rect(g, 14, 521, 332, 109, 16, '#2c2337', '#82586d');
  rect(g, 22, 535, 316, 48, 10, '#34283e');
  line([[replay.x, replay.y], [replay.endX, replay.y]], '#95687b', 3);
  line([[replay.x, replay.y], [tickX(time), replay.y]], '#edbd80', 3);
  const claim = cast[selected]?.claim;
  for (let i = 0; i < c.beatCount; i++) {
    const x = tickX(i);
    line([[x, replay.y - 11], [x, replay.y + 11]], '#896678', 1);
    dot(x, replay.y, seen.size && scrolled.has(i) ? 3.3 : 2.7, i <= time ? '#f6cf97' : '#987384');
    if (claim?.beat === i) {
      g.beginPath();
      g.moveTo(x - 5, replay.y - 17);
      g.lineTo(x + 5, replay.y - 17);
      g.lineTo(x, replay.y - 11);
      g.fillStyle = '#ffe2a3';
      g.fill();
    }
  }
  text(g, '‹', 27, replay.y - 1, 20, '#c69496');
  text(g, '›', 333, replay.y - 1, 20, '#c69496');
  dot(tickX(time), replay.y + 2.2, 16, '#251c32');
  clock(g, tickX(time), replay.y, 15, minute(frame.beat));

  rect(g, 119, 587, 122, 36, 10, '#403047', '#745167');
  const held = pointer?.type === 'stamp';
  dot(180, 605, 15, '#734653', '#9d6977');
  star(g, 180, 605, 9, '#b16d78');
  if (!held) stamp(g, homeStamp.x + 13, homeStamp.y - 1, .90);
  for (const x of [137, 224]) {
    line([[x - 4, 605], [x, 601], [x + 4, 605]], '#d3a097', 1.5);
    line([[x - 4, 610], [x, 606], [x + 4, 610]], '#a47184', 1.5);
  }
}

function drawPortraits() {
  const pts = portraitPoints();
  rect(g, 47, 423, 266, 95, 19, '#412f45', '#a774817d');
  for (const [id, { x, y }] of pts.entries()) {
    const person = cast[id];
    const target = pointer?.type === 'stamp' && pointer.target === id;
    const wrong = run.rejected.includes(id);
    const chosen = selected === id;
    rect(g, x - 24, y - 20, 48, 41, 10, wrong ? '#5c3d51' : chosen ? '#f7d49e' : '#ddac9c',
      target ? CREAM : chosen ? GOLD : '#9b6375', target || chosen ? 2.5 : 1.2);
    if (wrong) g.globalAlpha = .62;
    animal(g, x, y - (c.spec.blackout ? 3 : 0), 39, person.species, { head: true });
    g.globalAlpha = 1;
    if (c.spec.blackout) {
      rect(g, x - 11, y + 10, 22, 9, 5, '#53405b');
      signature(g, x, y + 14.5, 19, person.sound);
    }
    if (wrong) {
      dot(x + 18, y - 13, 7, '#603549', '#eaa69a');
      line([[x + 15.5, y - 15.5], [x + 20.5, y - 10.5]], CREAM, 1.4);
      line([[x + 20.5, y - 15.5], [x + 15.5, y - 10.5]], CREAM, 1.4);
    }
  }
}

function drawExchange(frame, actors) {
  if (!frame.exchange) return;
  const duo = frame.exchange.map(mask => actors.find(actor => actor.mask === mask));
  if (duo.some(actor => !actor)) return;
  const room = rooms[duo[0].room];
  const x = room.x + room.w / 2 + 9;
  const y = room.y + 40;
  rect(g, x - 35, y - 13, 71, 27, 8, '#fff1d9', '#945b6f', 1.6);
  costume(g, x - 20, y, 21, frame.exchange[0]);
  costume(g, x + 20, y, 21, frame.exchange[1]);
  text(g, '⇄', x, y, 14, INK);
}

function drawScene(frame, staticScene = false) {
  const claim = cast[selected]?.claim;
  house(g, rooms, frame, c.crime, !staticScene && claim?.beat === frame.beat ? claim.room : null);
  if (frame.blackout) {
    for (const item of frame.sounds) {
      const { x, y } = roomPoint(rooms[item.room], item.slot);
      rect(g, x - 13, y - 11, 26, 22, 7, '#4f3c58', '#b193a5');
      signature(g, x, y, 24, item.sound);
    }
    return;
  }
  for (const item of frame.evidence) trace(g, rooms[item.room], item.kind);
  const actors = staticScene ? frame.actors.map(actor => ({ ...actor, ...roomPoint(rooms[actor.room], actor.slot), walk: 0 })) : actorPositions();
  for (const actor of [...actors].sort((a, b) => a.y - b.y)) {
    if (!staticScene && actor.portrait !== null && (actor.portrait === selected || actor.portrait === pointer?.target)) {
      dot(actor.x, actor.y - 2, 19, '#fff0bb50', '#fff0ce', 1.5);
    }
    const species = actor.portrait === null ? null : cast[actor.portrait].species;
    animal(g, actor.x, actor.y, staticScene ? 39 : 36, species, {
      phase: (calm.matches ? 0 : actor.walk ? time * 39 : phase * 2.7) + actor.x * .14,
      walk: calm.matches ? 0 : actor.walk, mask: actor.mask,
    });
    if (actor.carry) {
      dot(actor.x + 13, actor.y - 12, 10, '#fff1d3', '#90586c');
      if (c.crime === 0) eventIcon(g, actor.x + 13, actor.y - 14, 20, 0, false);
      else if (c.crime === 1) {
        rect(g, actor.x + 10, actor.y - 15, 6, 9, 2, '#dc709d', INK, 1.1);
        rect(g, actor.x + 11, actor.y - 17, 4, 2, 1, GOLD, INK, .7);
      } else {
        rect(g, actor.x + 9, actor.y - 17, 8, 8, 2, '#bd566a', INK, 1.2);
        line([[actor.x + 6, actor.y - 9], [actor.x + 20, actor.y - 9]], INK, 1.7);
      }
    }
  }
  if (!staticScene) drawExchange(frame, actors);
}

function drawTutorial() {
  const lesson = c.spec.tutorial;
  if (daily || !lesson || help.shown || pointer || run.rejected.length) return;
  const age = Math.max(0, phase - hintReady);
  if (age < .45) return;
  const wave = calm.matches ? .62 : .5 - .5 * Math.cos(age * 3.6);
  const tickHand = (from, to) => hand(g, tickX(from + (to - from) * wave), replay.y + 4, -.19);
  if (lesson === 'basics' && !justScrubbed) tickHand(0, Math.min(2.5, c.beatCount - 1));
  else if ((lesson === 'basics' || lesson === 'cast' || lesson === 'times') && !seen.size) {
    const p = portraitPoints()[lesson === 'cast' ? cast.length - 1 : 0];
    dot(p.x, p.y, 22 + wave * 3, '#fff1ce10', CREAM, 1.4);
    hand(g, p.x, p.y + 4 + wave * 5);
  } else if (lesson === 'basics' && seen.size) {
    const target = portraitPoints()[selected ?? 0];
    const x = homeStamp.x + (target.x - homeStamp.x) * wave;
    const y = homeStamp.y + (target.y - homeStamp.y) * wave;
    if (wave > .22) stamp(g, x + 4, y - 25, .57, true);
    hand(g, x, y, -.15);
  } else if (lesson === 'times' && selected !== null && !scrolled.has(cast[selected].claim.beat)) {
    const tick = cast[selected].claim.beat;
    tickHand(tick, tick);
  } else if (lesson === 'rooms' && !seen.size) {
    const p = portraitPoints()[0];
    hand(g, p.x, p.y + wave * 7);
    const { x, y } = rooms[rooms.length - 1];
    dot(x + 17, y + 17, 14 + wave * 3, '#fff1ce08', CREAM, 1.4);
  } else if (lesson === 'masks' && !scrolled.has(4)) {
    if (scrolled.has(1) && scrolled.has(2)) tickHand(3, 4);
    else tickHand(1, 2);
  } else if (lesson === 'overlap' && !scrolled.has(4)) tickHand(3, 4);
  else if (lesson === 'blackout' && !scrolled.has(c.blackoutBeat)) tickHand(c.blackoutBeat, c.blackoutBeat);
  else if (lesson === 'blackout' && !seen.size) {
    const p = portraitPoints()[0];
    hand(g, p.x, p.y + 13 + wave * 5);
  } else if (lesson === 'accomplice' && !scrolled.has(c.carryBeat)) tickHand(c.carryBeat, c.carryBeat);
}

function drawShot() {
  if (!lastShot || lastShot.solved || phase - lastShot.at > .65 || calm.matches) return;
  const { x, y } = portraitPoints()[lastShot.id];
  const t = (phase - lastShot.at) / .65;
  g.save();
  g.globalAlpha = 1 - t;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * i / 3;
    star(g, x + Math.cos(a) * (23 + t * 15), y + Math.sin(a) * (19 + t * 11), 3.4, '#e88b89');
  }
  g.restore();
}

function drawMenu() {
  g.save();
  g.translate(-4, 25);
  g.scale(1.02, 1.02);
  drawScene(board[0], true);
  g.restore();
  // Three miniature case emblems on the menu's title plate.
  rect(g, 111, 112, 138, 32, 12, '#3f3045', '#b5818580');
  for (const crime of [0, 1, 2]) {
    const x = 137 + crime * 43;
    dot(x, 128, 12, ['#624052', '#5d555e', '#684456'][crime], '#ba8386');
    eventIcon(g, x, 128, 21, crime, crime !== 0);
  }
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#272036';
  g.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  g.translate(originX, originY);
  g.scale(scale, scale);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const frame = board[beatNow()];
  sky(g, c.spec.chapter, calm.matches ? 0 : phase);
  if (screen === 'menu' || screen === 'cases') { drawMenu(); return; }
  drawScene(frame);
  heading(frame);
  drawClaim(frame);
  drawPortraits();
  drawReplay(frame);
  drawTutorial();
  drawShot();
  if (pointer?.type === 'stamp') {
    g.save();
    g.globalAlpha = .8;
    stamp(g, pointer.x, Math.max(23, pointer.y - 31), .95, pointer.target !== null && pointer.target !== undefined);
    g.restore();
    dot(pointer.x, pointer.y, 5.5, '#fff1ce40', CREAM, 1.1);
  }
}

function drawResult() {
  const context = $('resultArt').getContext('2d');
  context.setTransform(2, 0, 0, 2, 0, 0);
  context.clearRect(0, 0, 240, 107);
  const person = cast[c.culprit];
  rect(context, 1, 9, 238, 93, 15, '#48354c', '#936678');
  if (run.outcome === 'solved') {
    rect(context, 17, 22, 62, 65, 12, '#e6b59f', '#aa7181', 2);
    animal(context, 48, 54, 56, person.species, { head: true });
    star(context, 74, 24, 8, GOLD, '#aa7181');
    place(context, 107, 47, 27, person.claim.room);
    text(context, '≠', 132, 47, 19, CREAM);
    place(context, 157, 47, 27, c.crimeRoom);
    clock(context, 201, 47, 13, minute(person.claim.beat));
  } else {
    eventIcon(context, 120, 45, 47, c.crime);
  }
  for (let i = 0; i < 3; i++) star(context, (run.outcome === 'solved' ? 132 : 96) + i * 24, 76, 8, i < run.stars ? GOLD : '#6e4b64', '#dc9d81');
}

let shareFile = null;
function openShare() {
  const card = $('shareArt');
  const context = card.getContext('2d');
  context.setTransform(3, 0, 0, 3, 0, 0);
  rect(context, 0, 0, 240, 168, 0, '#36263e');
  rect(context, 6, 6, 228, 156, 14, '#51364d', '#e2ab83', 2);
  rect(context, 13, 13, 214, 142, 10, null, '#ae7985');
  star(context, 51, 53, 6, GOLD);
  star(context, 189, 45, 4, GOLD);
  rect(context, 88, 23, 64, 56, 12, '#ead2b5', '#a6737a', 1.7);
  eventIcon(context, 120, 49, 49, c.crime);
  for (const i of [0, 1, 2]) star(context, 93 + i * 27, 101, 11, i < run.stars ? GOLD : '#6c4a63', '#e7ac89');
  text(context, `${day.slice(5).replace('-', '·')}    ✦ ${profile.daily.streak}`, 120, 135, 17, CREAM, 'Georgia');
  shareFile = null;
  card.toBlob(blob => {
    if (blob) shareFile = new File([blob], 'alibi.png', { type: 'image/png' });
  });
  setScreen('sharing');
}

async function shareImage() {
  if (shareFile && navigator.canShare?.({ files: [shareFile] })) {
    try { await navigator.share({ files: [shareFile] }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  const link = document.createElement('a');
  link.href = $('shareArt').toDataURL('image/png');
  link.download = 'alibi.png';
  link.click();
}

function cssPoint(p) {
  const box = canvas.getBoundingClientRect();
  return { x: box.left + originX + scale * p.x, y: box.top + originY + scale * p.y };
}

window.alibiState = () => ({
  screen, paused: screen === 'paused', level: c.level, daily, day, time, frame: beatNow(), stars: run.stars,
  selected, outcome: run.outcome, streak: profile.daily.streak,
  points: {
    clock: { ...cssPoint(replay), endX: cssPoint({ x: replay.endX, y: replay.y }).x,
      ticks: board.map((_, beat) => cssPoint({ x: tickX(beat), y: replay.y })) },
    stamp: cssPoint(homeStamp),
    suspects: portraitPoints().map(cssPoint),
    actors: actorPositions().filter(a => a.portrait !== null).map(a => ({ id: a.portrait, ...cssPoint(a) })),
  },
});

let last = performance.now();
function animate(now) {
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (screen !== 'paused' && screen !== 'done' && screen !== 'sharing') phase += dt;
  draw();
  requestAnimationFrame(animate);
}

menu();
requestAnimationFrame(animate);
