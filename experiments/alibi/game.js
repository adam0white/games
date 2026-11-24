import { sound } from '../kit/audio.js';
import * as save from '../kit/save.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { lab } from '../kit/lab.js';
import { hint } from '../kit/hint.js';
import { noZoom } from '../kit/zoom.js';
import {
  CASES, CHAPTER_TWO_END, CLOCK_START, CLOCK_STEP, createCase, dailyCase, dailyWin, dayKey, offsetDay, dossiers, freshRun, accuse, observe,
} from './sim.js';
import {
  W, H, INK, CREAM, GOLD, rect, text, star, clock, place, animal, costume, signature,
  sky, roomLayout, roomPoint, house, trace, eventIcon, heldItem, stamp, hand,
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
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDay = value => typeof value === 'string' && datePattern.test(value)
  && Number.isFinite(Date.parse(value)) && dayKey(new Date(value)) === value;
const HISTORY_LIMIT = 84;
const validTime = value => Number.isSafeInteger(value) && value >= 0;

function betterScore(a, b) {
  if (!a || b.stars > a.stars) return b;
  if (b.stars === a.stars && b.seconds !== null && (a.seconds === null || b.seconds < a.seconds)) return b;
  return a;
}

function extendStreak(summary) {
  if (!summary.last) return;
  while (summary.days[offsetDay(summary.last, -summary.streak)]) summary.streak++;
}

function readDaily(value) {
  const last = validDay(value?.last) ? value.last : '';
  const best = validStars(value?.best) ? value.best : 0;
  const streak = last && Number.isInteger(value?.streak) && value.streak > 0 && value.streak <= 36500 ? value.streak : 0;
  const days = {};
  for (const [date, score] of Object.entries(value?.days ?? {})) {
    if (validDay(date) && score && (score.stars === null || validStars(score.stars))) {
      days[date] = { stars: score.stars, seconds: validTime(score.seconds) ? score.seconds : null };
    }
  }
  for (let i = 0; i < Math.min(streak, HISTORY_LIMIT); i++) {
    days[offsetDay(last, -i)] ??= { stars: null, seconds: null };
  }
  if (last && best) days[last] = betterScore(days[last], { stars: best, seconds: null });
  const summary = { last, streak, best, days };
  extendStreak(summary);
  return summary;
}

function readProfile(value) {
  const { level, stars, sound, daily, hardDaily, campaignVersion } = value ?? {};
  const best = Object.fromEntries(Object.entries(stars ?? {}).filter(([key, stars]) => validLevel(Number(key)) && validStars(stars)));
  const nextLevel = campaignVersion == null && level === 21 && best[21] ? 22 : level;
  return { level: validLevel(nextLevel) ? nextLevel : 1, campaignVersion: 2, stars: best, sound: sound !== false,
    daily: readDaily(daily), hardDaily: readDaily(hardDaily) };
}
const profile = readProfile(loaded);
const rec = lab('alibi');
const snd = sound({ on: () => profile.sound });
const showCards = screens(['menu', 'cases', 'paused', 'done', 'sharing', 'calendar']);
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const replay = { x: 42, endX: 318, y: 561 };
const homeStamp = { x: 180, y: 605 };
const notebookButton = { x: 48, y: 605 };
const HOLD = .46;
const REVEAL_DURATION = 2.7;

let c = createCase({ seed, level: 1 });
let board = [];
let cast = [];
let rooms = [];
let screen = 'menu';
let daily = false;
let hard = false;
let day = '';
let run = freshRun();
let time = 0;
let selected = null;
let pointer = null;
let lastShot = null;
let notes = [];
let notebook = false;
let noteFlash = null;
let stampArmed = false;
let wrongNotice = false;
let activeSince = 0;
let playedMs = 0;
let solvedSeconds = 0;
let revealStart = 0;
let revealSound = false;
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
const dailyProfile = () => hard ? profile.hardDaily : profile.daily;
const hardUnlocked = () => profile.level > CHAPTER_TWO_END;
const activeStreak = (summary, today) => summary.last >= offsetDay(today, -1) ? summary.streak : 0;
const timeLabel = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const tickX = beat => replay.x + (replay.endX - replay.x) * beat / (c.beatCount - 1);
function syncProfile() {
  const latest = readProfile(save.readJson(KEY));
  profile.level = Math.max(profile.level, latest.level);
  for (const [level, stars] of Object.entries(latest.stars)) {
    profile.stars[level] = Math.max(profile.stars[level] ?? 0, stars);
  }
  for (const key of ['daily', 'hardDaily']) {
    const local = profile[key];
    const incoming = latest[key];
    for (const [date, score] of Object.entries(incoming.days)) {
      local.days[date] = betterScore(local.days[date], score);
    }
    if (incoming.last > local.last) Object.assign(local, { last: incoming.last, best: incoming.best, streak: incoming.streak });
    else if (incoming.last === local.last) {
      local.best = Math.max(local.best, incoming.best);
      local.streak = Math.max(local.streak, incoming.streak);
    }
    extendStreak(local);
  }
  profile.sound = latest.sound;
}
const persist = () => save.writeJson(KEY, profile);
const playing = () => screen === 'play';
const setScreen = next => {
  stampArmed = false;
  $('playGuide').hidden = next !== 'play';
  screen = next;
  showCards(next);
  $('pause').hidden = !playing();
  $('skipReveal').hidden = next !== 'reveal';
};

function updateMenu() {
  const current = validLevel(forceLevel) ? forceLevel : profile.level;
  $('progress').textContent = `${current} /${CASES.length}`;
  const today = dayKey();
  const streak = activeStreak(profile.daily, today);
  $('streak').textContent = streak ? `✦${streak}` : '';
  $('daily').setAttribute('aria-label', `Daily case, streak ${streak}`);
  $('hardDaily').disabled = !hardUnlocked();
  $('hardDaily').textContent = 'Hard Daily';
  if (!hardUnlocked()) {
    const unlock = document.createElement('small');
    unlock.textContent = `Solve case ${CHAPTER_TWO_END}`;
    $('hardDaily').append(unlock);
  }
  $('hardDaily').setAttribute('aria-label', hardUnlocked() ? 'Hard Daily' : `Hard Daily unlocks after case ${CHAPTER_TWO_END}`);
  $('menuSound').textContent = $('pauseSound').textContent = profile.sound ? 'Sound on' : 'Sound off';
  noticeLead.textContent = recording.checked ? recordingDisclosure : 'Recording is off. You can turn it on in the pause menu. ';
  for (const id of ['menuSound', 'pauseSound']) $(id).setAttribute('aria-pressed', profile.sound);
}

function openCases(chapter = CASES[profile.level - 1].chapter) {
  const tabs = [...new Set(CASES.map(spec => spec.chapter))].map(number => {
    const button = document.createElement('button');
    button.textContent = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'][number - 1];
    button.classList.toggle('primary', number === chapter);
    button.setAttribute('aria-label', `Chapter ${number}`);
    button.setAttribute('aria-pressed', number === chapter);
    button.onclick = () => openCases(number);
    return button;
  });
  $('chapterTabs').replaceChildren(...tabs);
  const choices = CASES.flatMap((spec, i) => {
    if (spec.chapter !== chapter) return [];
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

function openCalendar() {
  if (save.readJson(KEY) !== null) syncProfile();
  const today = dayKey();
  const dates = Array.from({ length: 28 }, (_, i) => offsetDay(today, i - 27));
  $('calendarHeading').textContent = `✦ Daily ${activeStreak(profile.daily, today)} · ◆ Hard Daily ${activeStreak(profile.hardDaily, today)}`;
  $('calendarDates').textContent = [dates[0], today].map(date => date.slice(5).replace('-', '·')).join(' – ');
  const cells = dates.map(date => {
    const cell = document.createElement('div');
    const standard = Boolean(profile.daily.days[date]);
    const advanced = Boolean(profile.hardDaily.days[date]);
    cell.classList.toggle('marked', standard || advanced);
    cell.dataset.day = date;
    if (date === today) cell.setAttribute('aria-current', 'date');
    cell.setAttribute('aria-label', `${date}: ${standard ? 'daily solved' : 'daily empty'}, ${advanced ? 'hard solved' : 'hard empty'}`);
    cell.textContent = date.slice(8);
    const marks = document.createElement('span');
    marks.textContent = (standard ? '✦' : '') + (advanced ? '◆' : '');
    cell.append(marks);
    return cell;
  });
  $('calendarGrid').replaceChildren(...cells);
  setScreen('calendar');
}

function loadBoard(next) {
  c = next;
  cast = dossiers(c);
  rooms = roomLayout(c.spec.rooms);
  board = Array.from({ length: c.beatCount }, (_, beat) => observe(c, beat));
}

function start(isDaily, level = profile.level, isHard = false, dailyDate = dayKey(), restoredCase = null) {
  if (isHard && !hardUnlocked()) return;
  if (!restoredCase) {
    snd.release();
    snd.unlock();
  }
  daily = isDaily;
  hard = isHard;
  day = daily ? dailyDate : '';
  loadBoard(restoredCase ?? (daily ? dailyCase(day, hard) : createCase({ seed, level })));
  time = 0;
  selected = null;
  pointer = null;
  lastShot = null;
  notes = [];
  notebook = false;
  noteFlash = null;
  wrongNotice = false;
  activeSince = performance.now();
  playedMs = 0;
  solvedSeconds = 0;
  seen = new Set();
  scrolled = new Set();
  run = freshRun();
  hintReady = phase;
  setScreen('play');
  rec.start({ level: daily ? `${hard ? 'hard-daily' : 'daily'}-${day}` : c.level });
  if (!restoredCase) snd.tone(494, .15, .09, 'triangle', 160);
}

function pause() {
  if (!playing()) return;
  pointer = null;
  playedMs += performance.now() - activeSince;
  snd.hold();
  setScreen('paused');
}

function resume() {
  if (screen !== 'paused') return;
  activeSince = performance.now();
  snd.release();
  snd.unlock();
  setScreen('play');
}

function endSummary() {
  return { level: daily ? `${hard ? 'hard-daily' : 'daily'}-${day}` : c.level, stars: run.stars, marks: scrolled.size,
    statements: seen.size, guesses: run.rejected.length + Number(run.outcome === 'solved') };
}

function menu() {
  if (screen === 'paused' || playing()) rec.end('left', endSummary());
  pointer = null;
  selected = null;
  notebook = false;
  daily = false;
  hard = false;
  day = '';
  notes = [];
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
$('hardDaily').onclick = () => start(true, profile.level, true);
$('openCalendar').onclick = openCalendar;
$('calendarMenu').onclick = menu;
$('pickCase').onclick = () => openCases();
$('skipReveal').onclick = finishReveal;
$('caseMenu').onclick = menu;
$('pause').onclick = pause;
$('resume').onclick = resume;
$('toMenu').onclick = menu;
$('endMenu').onclick = menu;
$('again').onclick = () => start(daily, c.level, hard, day);
$('next').onclick = () => start(false, Math.min(CASES.length, c.level + 1));
$('menuSound').onclick = toggleSound;
$('pauseSound').onclick = toggleSound;
$('share').onclick = openShare;
$('closeShare').onclick = () => setScreen('done');
$('sendShare').onclick = shareImage;
rec.notice($('menu').querySelector('.panel'));
rec.toggle($('paused').querySelector('.panel'));
const recording = $('paused').querySelector('.lab-toggle input');
const noticeLead = $('menu').querySelector('.lab-notice').firstChild;
const recordingDisclosure = noticeLead.textContent;
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

function walkPoint(start, end, amount, differentFloors) {
  const left = start.x + end.x < W;
  const rail = left ? 17 : 343;
  const route = differentFloors ? [start, { x: rail, y: start.y }, { x: rail, y: end.y }, end] : [start, end];
  const spans = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y));
  let remaining = amount * spans.reduce((sum, span) => sum + span, 0);
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (i !== spans.length - 1 && remaining > span) {
      remaining -= span;
      continue;
    }
    const a = route[i];
    const b = route[i + 1];
    const mix = span ? Math.min(1, remaining / span) : 0;
    return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix,
      walk: Number(span > 3), facing: b.x < a.x ? -1 : 1 };
  }
  return end;
}

function actorPositions() {
  const beat = beatNow();
  const frame = board[beat];
  if (frame.blackout || frame.shutter) return [];
  const a = Math.floor(time);
  const b = Math.ceil(time);
  const raw = time - a;
  const f = Math.max(0, Math.min(1, (raw - .08) / .84));
  const mix = f * f * (3 - 2 * f);
  const walk = a !== b && !board[a].blackout && !board[b].blackout && !board[a].shutter && !board[b].shutter;
  return frame.actors.map(actor => {
    const here = roomPoint(rooms[actor.room], actor.slot);
    if (!walk || actor.mask !== null && board[b].exchange) return { ...actor, ...here, walk: 0 };
    // Match only tags shown by the camera. Mask changes happen in place.
    const match = candidate => actor.mask === null ? candidate.portrait === actor.portrait : candidate.mask === actor.mask;
    const before = board[a].actors.find(match);
    const after = board[b].actors.find(match);
    if (!before || !after) return { ...actor, ...here, walk: 0 };
    const start = roomPoint(rooms[before.room], before.slot);
    const end = roomPoint(rooms[after.room], after.slot);
    return { ...actor, ...walkPoint(start, end, mix, rooms[before.room].y !== rooms[after.room].y),
      walk: Number(f > 0 && f < 1 && (start.x !== end.x || start.y !== end.y)) };
  });
}
function point(e) {
  const box = canvas.getBoundingClientRect();
  return { x: (e.clientX - box.left - originX) / scale, y: (e.clientY - box.top - originY) / scale };
}

function nearestId(p, drop = false) {
  const cards = portraitPoints();
  for (const [id, v] of cards.entries()) {
    if (Math.abs(p.x - v.x) <= 28 && Math.abs(p.y - v.y) <= 22) return id;
  }
  const actors = actorPositions()
    .filter(a => a.portrait !== null)
    .map(a => ({ id: a.portrait, d: Math.hypot((p.x - a.x) * 1.13, p.y - a.y + 3) }))
    .sort((a, b) => a.d - b.d);
  return actors[0]?.d <= (drop ? 26 : 24) ? actors[0].id : null;
}

function scrub(value, snap = false) {
  wrongNotice = false;
  const old = beatNow();
  time = Math.max(0, Math.min(c.beatCount - 1, snap ? Math.round(value) : value));
  const beat = beatNow();
  scrolled.add(beat);
  if (old === beat) return;
  hintReady = phase;
  snd.noise(.035, .085, beat % 2 ? 2000 : 1450);
  snd.tone(760 + beat * 23, .028, .036, 'triangle', -220);
  if (board[beat].blackout) snd.noise(.14, .065, 2350);
  if (board[beat].incident && !board[old].incident) snd.tone(535, .13, .045, 'sine', -180);
}

function scrubAt(x, snap = false) {
  scrub((x - replay.x) * (c.beatCount - 1) / (replay.endX - replay.x), snap);
}

function inspect(id) {
  wrongNotice = false;
  selected = selected === id ? null : id;
  if (!seen.has(id)) rec.event('inspect', { suspect: id });
  seen.add(id);
  snd.tone(512 + id * 20, .09, .065, 'triangle', 109);
  hintReady = phase;
}

function finishReveal() {
  if (screen !== 'reveal') return;
  showResult(true);
}

function showResult(solved) {
  $('result').textContent = solved ? 'Gotcha!' : 'Try again';
  $('next').hidden = daily || !solved || c.level >= CASES.length;
  $('share').hidden = !daily || !solved;
  $('next').classList.toggle('primary', !$('next').hidden);
  $('again').classList.toggle('primary', !solved);
  $('share').classList.toggle('primary', !$('share').hidden);
  $('endMenu').classList.toggle('primary', solved && $('next').hidden && $('share').hidden);
  $('resultDetail').hidden = solved;
  $('resultDetail').textContent = solved ? '' : 'Three wrong accusations. Compare a suspect’s alibi with the room at that time.';
  drawResult();
  setScreen('done');
}

function saveWin() {
  if (save.readJson(KEY) !== null) syncProfile();
  if (daily) {
    const summary = dailyProfile();
    const previous = summary.last;
    Object.assign(summary, dailyWin(previous, day, summary.streak));
    const score = betterScore(summary.days[day], { stars: run.stars, seconds: solvedSeconds });
    summary.days[day] = score;
    if (summary.last === day) summary.best = score.stars;
    extendStreak(summary);
    for (const date of Object.keys(summary.days).sort().slice(0, -HISTORY_LIMIT)) delete summary.days[date];
  } else {
    profile.stars[c.level] = Math.max(profile.stars[c.level] ?? 0, run.stars);
    if (c.level === profile.level) profile.level = Math.min(c.level + 1, CASES.length);
  }
  persist();
}

function accuseId(id) {
  const next = accuse(c, run, id);
  if (next === run) return;
  run = next;
  wrongNotice = !run.outcome;
  lastShot = { at: phase, id, solved: run.outcome === 'solved' };
  rec.event('accuse', { suspect: id, correct: lastShot.solved, stars: run.stars });
  snd.noise(.105, .16, 465);
  snd.tone(132, .18, .14, 'triangle', -73);
  if (lastShot.solved) {
    solvedSeconds = Math.floor((playedMs + performance.now() - activeSince) / 1000);
    saveWin();
    rec.end('solved', endSummary());
    revealStart = phase;
    revealSound = false;
    time = c.incident;
    selected = null;
    notebook = false;
    setScreen('reveal');
  } else if (run.outcome) {
    rec.end('wrong', endSummary());
    showResult(false);
  }
}

function markNote(id, actorRoom = null) {
  const frame = board[beatNow()];
  const person = cast[id];
  const visible = frame.actors.find(actor => actor.portrait === id)
    ?? frame.sounds.find(item => item.sound === person.sound);
  const room = actorRoom ?? visible?.room;
  const note = room === undefined || room === null
    ? { id, ...person.claim, claim: true }
    : { id, room, beat: frame.beat, claim: false };
  const same = entry => entry.id === note.id && entry.beat === note.beat
    && entry.room === note.room && entry.claim === note.claim;
  const duplicate = notes.some(same);
  const added = !duplicate && notes.length < 3;
  if (added) notes.push(note);
  notebook = true;
  noteFlash = { at: phase, full: !added && !duplicate, duplicate };
  snd.tone(added ? 614 : 240, .11, .07, 'triangle', 66);
}

const noteRowY = i => 157 + 45 * i;
function notebookInput(p) {
  if (Math.abs(p.x - notebookButton.x) < 29 && Math.abs(p.y - notebookButton.y) < 24) {
    notebook = !notebook;
    stampArmed = false;
    noteFlash = null;
    snd.tone(notebook ? 574 : 437, .08, .06, 'triangle');
    return true;
  }
  if (!notebook || p.x < 75 || p.x > 285 || p.y < 135 || p.y >= 270) return false;
  const index = Math.floor((p.y - 135) / 45);
  const entry = notes[index];
  if (entry) {
    noteFlash = null;
    if (p.x >= 232) notes.splice(index, 1);
    else {
      selected = null;
      notebook = false;
      scrub(entry.beat, true);
    }
    snd.tone(454, .075, .06, 'triangle');
  }
  return true;
}

function begin(e) {
  if (!playing() || pointer || e.button > 0) return;
  const p = point(e);
  if (notebookInput(p)) { e.preventDefault(); return; }
  if (Math.abs(p.y - homeStamp.y) <= 25 && Math.abs(p.x - homeStamp.x) < 61) {
    pointer = { ...p, id: e.pointerId, type: 'stamp', start: p, moved: false };
    snd.tone(375, .06, .065, 'triangle', 60);
  } else if (Math.abs(p.y - replay.y) <= 24 && p.x > 13 && p.x < 347) {
    stampArmed = false;
    pointer = { ...p, id: e.pointerId, type: 'clock' };
    scrubAt(p.x);
  } else {
    const id = nearestId(p);
    if (id !== null) {
      pointer = { ...p, id: e.pointerId, type: stampArmed ? 'accusation' : 'suspect', suspect: id, at: phase };
      snd.tone(442 + id * 15, .045, .04, 'triangle');
    } else if (!notebook && selected !== null && p.x >= 80 && p.x <= 280 && p.y >= 62 && p.y <= 115) {
      stampArmed = false;
      scrub(cast[selected].claim.beat, true);
      pointer = { ...p, id: e.pointerId, type: 'tap' };
    } else return;
  }
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
}

function move(e) {
  if (pointer?.id !== e.pointerId) return;
  const p = point(e);
  if (pointer.type === 'clock') scrubAt(p.x);
  if ((pointer.type === 'suspect' || pointer.type === 'accusation') && Math.hypot(p.x - pointer.x, p.y - pointer.y) > 13) pointer.type = 'tap';
  if (pointer.type === 'stamp') {
    const id = nearestId(p, true);
    if (id !== null && id !== pointer.target) snd.tone(645, .045, .035, 'sine', 110);
    pointer = { ...pointer, ...p, target: id, moved: pointer.moved || Math.hypot(p.x - pointer.start.x, p.y - pointer.start.y) > 10 };
  }
}

function release(e) {
  if (pointer?.id !== e.pointerId) return;
  const { type, suspect, moved, start } = pointer;
  pointer = null;
  if (e.type !== 'pointerup') return;
  const p = point(e);
  if (type === 'clock') scrubAt(p.x, true);
  if (type === 'suspect') { notebook = false; inspect(suspect); }
  if (type === 'accusation' && nearestId(p) === suspect) {
    stampArmed = false;
    accuseId(suspect);
  }
  if (type === 'stamp') {
    const id = nearestId(p, true);
    if (id !== null) { stampArmed = false; accuseId(id); }
    else if (!moved && Math.hypot(p.x - start.x, p.y - start.y) <= 10) {
      stampArmed = !stampArmed;
      notebook = false;
      wrongNotice = false;
    }
  }
}

// Touch has already been handled by pointerup. A compatibility click can hit
// a result button that appeared under the lifted finger.
canvas.addEventListener('touchend', e => e.preventDefault(), { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
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
  stampArmed = false;
  if (e.key.toLowerCase() === 'n') {
    if (selected !== null && e.shiftKey) markNote(selected);
    else notebook = !notebook;
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    scrub(beatNow() + (e.key === 'ArrowLeft' ? -1 : 1), true);
  } else if (/^[1-8]$/.test(e.key) && cast[Number(e.key) - 1]) {
    const id = Number(e.key) - 1;
    if (e.shiftKey) accuseId(id);
    else { notebook = false; inspect(id); }
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
  eventIcon(g, 88, 34, 33, c.crime, false);
  text(g, daily ? (hard ? '◆' : '◇') : ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'][c.spec.chapter - 1], 105, 28, 8, GOLD, 'system-ui', 'left');
  text(g, daily ? 'Daily' : String(c.level).padStart(2, '0'), 105, 44, daily ? 12 : 15, CREAM, 'Georgia', 'left');
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
  if (selected === null || notebook) return;
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
  place(g, 150, 85, 30, claim.room, c.spec.site);
  clock(g, 190, 85, 14, minute(claim.beat));
  text(g, formatTime(claim.beat), 228, 85, 18, INK, 'Georgia');
  if (frame.beat !== claim.beat) {
    line([[257, 81], [261, 85], [257, 89]], '#a67469', 1.7);
  }
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
    if (i === c.shutterBeat) {
      rect(g, x - 3.8, replay.y + 10, 7.6, 5.6, 1.2, null, '#dcb58d', 1.1);
      dot(x, replay.y + 12.8, 1.2, '#dcb58d');
    }
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

  rect(g, 119, 583, 122, 44, 10, stampArmed ? '#885153' : '#403047', stampArmed ? GOLD : '#987184');
  const held = pointer?.type === 'stamp';
  if (!held) stamp(g, 146, homeStamp.y - 1, .76);
  text(g, stampArmed ? 'Cancel' : 'Accuse', 201, 605, 15, CREAM);
  const { x, y } = notebookButton;
  rect(g, x - 25, y - 22, 50, 44, 10, notebook ? '#70505c' : '#403047', '#987184');
  bookIcon(x - 3, y, '#ffe1aa');
  if (notes.length) {
    dot(x + 14, y + 9, 6.5, '#e7a66c');
    text(g, notes.length, x + 14, y + 9, 8, INK);
  }

}

function bookIcon(x, y, color) {
  rect(g, x - 9, y - 10, 18, 20, 2, color, INK, 1.3);
  line([[x - 5, y - 9], [x - 5, y + 9]], '#a86369');
  for (const dy of [-4, 0, 4]) line([[x - 2, y + dy], [x + 5, y + dy]], '#9d6c68', .9);
}

function drawNotebook() {
  if (!notebook) return;
  const fresh = noteFlash && phase - noteFlash.at < .5;
  rect(g, 73, 113, 214, 161, 13, '#261c30a0');
  rect(g, 75, 109, 210, 161, 12, '#f9e4be', fresh && noteFlash.full ? '#dc796d' : '#a76d72', fresh ? 3 : 2);
  for (let j = 0; j < 4; j++) {
    const y = 125 + j * 43;
    line([[72, y], [81, y]], '#57364a', 2.6);
    line([[73, y - .5], [80, y - .5]], '#f7c789', .8);
  }
  bookIcon(93, 123, '#f7c787');
  text(g, 'Notebook', 149, 123, 15, INK);
  for (let i = 0; i < 3; i++) {
    const y = noteRowY(i);
    const entry = notes[i];
    rect(g, 86, y - 21.5, 189, 44, 6, entry ? '#f4cf9b' : '#efd9ae', '#ca9d85', .85);
    if (!entry) {
      dot(108, y, 4, '#c79d85');
      line([[123, y], [253, y]], '#cba58a', 1);
      continue;
    }
    animal(g, 108, y, 24, cast[entry.id].species, { head: true });
    place(g, 145, y, 22, entry.room, c.spec.site);
    clock(g, 178, y, 9, minute(entry.beat));
    text(g, formatTime(entry.beat), 209, y, 13, INK, 'Georgia');
    if (entry.claim) text(g, '“ ”', 131, y - 7, 10, '#87576b');
    rect(g, 232, y - 21.5, 44, 44, 6, '#e7b68d');
    text(g, '×', 256, y - .5, 20, '#784e60');
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
    rect(g, x - 24, y - 22, 48, 44, 10, wrong ? '#5c3d51' : chosen ? '#f7d49e' : '#ddac9c',
      target ? CREAM : chosen ? GOLD : '#9b6375', target || chosen ? 2.5 : 1.2);
    if (wrong) g.globalAlpha = .62;
    const hurt = lastShot?.id === id && !lastShot.solved && (phase - lastShot.at < .75 || run.outcome === 'wrong');
    animal(g, x, y - (c.spec.blackout ? 3 : 0), 39, person.species, { head: true, mood: hurt ? 'hurt' : null });
    if (pointer?.type === 'suspect' && pointer.suspect === id) {
      g.beginPath();
      g.arc(x, y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, (phase - pointer.at) / HOLD));
      g.strokeStyle = CREAM;
      g.lineWidth = 2.4;
      g.stroke();
    }
    if (notes.some(entry => entry.id === id)) dot(x - 18, y - 13, 3, '#ffe9b4', '#a16c63');
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
  house(g, rooms, frame, c.crime, !staticScene && claim?.beat === frame.beat ? claim.room : null, c.spec.site);
  if (frame.shutter) {
    drawShutter();
    return;
  }
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
    const hurt = actor.portrait !== null && lastShot?.id === actor.portrait && !lastShot.solved
      && phase - lastShot.at < .75;
    if (pointer?.type === 'suspect' && pointer.suspect === actor.portrait) {
      dot(actor.x, actor.y - 3, 21, '#fff0bb50', '#fff0ce', 2);
    }
    animal(g, actor.x, actor.y, staticScene ? 36 : 34, species, {
      phase: (calm.matches ? 0 : actor.walk ? time * 57 : phase * 3.2) + actor.x * .14,
      walk: calm.matches ? 0 : actor.walk, mask: actor.mask, facing: actor.facing,
      activity: actor.walk || actor.carry ? null : actor.room, mood: hurt ? 'hurt' : null,
    });
    if (actor.carry) {
      dot(actor.x + 12, actor.y - 12, 10, '#fff1d3', '#90586c');
      heldItem(g, actor.x + 12, actor.y - 12, 19, c.crime);
    }
  }
  if (!staticScene) drawExchange(frame, actors);
}

function updateGuide(frame) {
  const person = cast[selected];
  const message = guideText(frame, person);
  const guide = $('playGuide');
  if (guide.textContent !== message) guide.textContent = message;
  guide.classList.toggle('with-alibi', Boolean(person) && !notebook);
}

function guideText(frame, person) {
  if (stampArmed) return 'Tap a portrait to accuse.\nTap Cancel to put the stamp down.';
  if (notebook) {
    if (noteFlash?.duplicate && phase - noteFlash.at < 3) return 'Already pinned. Choose a different observation.';
    if (noteFlash?.full && phase - noteFlash.at < 3) return 'Notebook full. Tap × to remove a note.';
    return notes.length ? 'Tap a note to revisit its time. Tap × to erase.' : 'Hold a portrait to pin what you see.';
  }
  if (wrongNotice) return `The ${cast[lastShot.id].species} told the truth.\n${run.stars} ${run.stars === 1 ? 'star' : 'stars'} left. Check another alibi.`;
  if (frame.shutter) return 'The shutter closed during the crime.\nCheck the alibis at their stated times.';
  if (frame.blackout) return 'Lights out. Match a portrait’s sound symbol\nto the symbol in a room.';
  if (person) {
    if (frame.beat !== person.claim.beat) return `Tap the alibi to visit ${formatTime(person.claim.beat)}.`;
    return `Is the ${person.species} in the outlined room?\nIf the alibi is false, tap Accuse.`;
  }
  return 'Who lied about their room?\nTap a portrait to read an alibi.';
}

function drawTutorial() {
  const lesson = c.spec.tutorial;
  if (daily || !lesson || help.shown || pointer || stampArmed || run.rejected.length) return;
  const age = Math.max(0, phase - hintReady);
  if (age < .45) return;
  const wave = calm.matches ? .62 : .5 - .5 * Math.cos(age * 3.6);
  const tickHand = (from, to) => hand(g, tickX(from + (to - from) * wave), replay.y + 4, -.19);
  if (lesson === 'compare' && !seen.size) {
    const p = portraitPoints()[0];
    dot(p.x, p.y, 22 + wave * 2, '#fff1ce10', CREAM, 1.4);
    hand(g, p.x, p.y + 7);
  } else if ((lesson === 'compare' || lesson === 'basics') && selected !== null && beatNow() !== cast[selected].claim.beat) {
    hand(g, 232, 86 + wave * 7);
  } else if ((lesson === 'basics' || lesson === 'cast' || lesson === 'times') && !seen.size) {
    const p = portraitPoints()[lesson === 'cast' ? cast.length - 1 : 0];
    dot(p.x, p.y, 22 + wave * 3, '#fff1ce10', CREAM, 1.4);
    hand(g, p.x, p.y + 4 + wave * 5);
  } else if (lesson === 'times' && selected !== null && !scrolled.has(cast[selected].claim.beat)) {
    const tick = cast[selected].claim.beat;
    tickHand(tick, tick);
  } else if (lesson === 'masks' && !scrolled.has(c.exchangeBeat)) {
    if (scrolled.has(2) && scrolled.has(3)) tickHand(c.exchangeBeat - 1, c.exchangeBeat);
    else tickHand(2, 3);
  }
  else if (lesson === 'blackout' && !scrolled.has(c.blackoutBeat)) tickHand(c.blackoutBeat, c.blackoutBeat);
  else if (lesson === 'blackout' && !seen.size) {
    const p = portraitPoints()[0];
    hand(g, p.x, p.y + 13 + wave * 5);
  } else if (lesson === 'carrier' && !scrolled.has(c.carryBeat)) tickHand(c.carryBeat, c.carryBeat);
}

function drawShutter() {
  for (const { x, y, w, h } of rooms) {
    rect(g, x + 2, y + 5, w - 4, h - 9, 2, '#432c44', '#bd8c88', 1);
    for (let panel = 0; panel < 5; panel++) {
      const dx = x + 3 + panel * (w - 6) / 5;
      rect(g, dx, y + 6, (w - 6) / 5, h - 11, 3, panel % 2 ? '#493048' : '#52354e');
    }
  }
  const room = rooms[c.crimeRoom];
  const x = room.x + room.w / 2;
  const y = room.y + 55;
  dot(x, y, 27, '#251c32', '#dba97e', 1.7);
  pathShutter(x, y);
}

function pathShutter(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    line([[x + 18 * Math.cos(a), y + 18 * Math.sin(a)],
      [x + 7 * Math.cos(a + .9), y + 7 * Math.sin(a + .9)]], '#dfb188', 2);
  }
  dot(x, y, 5, '#f7c77e');
}

function drawReveal() {
  const elapsed = phase - revealStart;
  const after = elapsed >= 1.28;
  const room = rooms[c.crimeRoom];
  const x = room.x + room.w / 2 - 9;
  const y = room.y + 78;
  house(g, rooms, { incident: after, blackout: false }, c.crime, c.crimeRoom, c.spec.site);
  rect(g, 14, 123, 332, 295, 10, '#211729bd');
  const zoom = Math.min(2.05, 288 / room.w);
  const inset = { x: (W - room.w * zoom) / 2, y: 183, w: room.w * zoom, h: room.h * zoom };
  rect(g, inset.x - 5, inset.y - 5, inset.w + 10, inset.h + 10, 12, '#4d3347', '#e4b48d', 2.1);
  g.save();
  g.translate(inset.x, inset.y);
  g.scale(zoom, zoom);
  g.translate(-room.x, -room.y);
  g.beginPath();
  g.roundRect(room.x, room.y, room.w, room.h, 4);
  g.clip();
  house(g, rooms, { incident: after, blackout: false }, c.crime, c.crimeRoom, c.spec.site);

  const person = cast[c.culprit];
  const travel = calm.matches ? 1 : Math.min(1, elapsed / .95);
  const fall = Math.max(0, Math.min(1, (elapsed - 1.67) / .49));
  const jump = calm.matches ? Number(fall > 0) : fall;
  const startX = room.x + room.w - 17;
  const actorX = startX + (x - startX) * travel;
  const itemY = y - 9 + jump * jump * 25;
  if (after) {
    if (c.crime === 1 && jump < .08) {
      for (let i = 0; i < 3; i++) dot(x - 5 + i * 4, room.y + 55 - i * 3, 1.7, '#e977a6');
    }
    heldItem(g, actorX + 12 + jump * 15, itemY, 23, c.crime);
  } else if (c.crime === 1) {
    heldItem(g, actorX - 12, y - 5, 20, c.crime);
  }
  animal(g, actorX, y + (jump && jump < 1 && !calm.matches ? -4 : 0), 41, person.species, {
    walk: travel < 1 ? 1 : 0, phase: elapsed * 22, facing: -1, mood: jump > 0 ? 'caught' : null,
  });
  if (jump > 0) {
    const stampY = y - 50 - Math.sin(jump * Math.PI) * 9;
    stamp(g, actorX + 1, stampY, .65, true);
    if (jump > .72) star(g, actorX + 22, y - 22, 7, GOLD, INK);
  }
  g.restore();
  rect(g, 123, 67, 114, 52, 15, '#39283e', '#cc9b83', 1.5);
  clock(g, 148, 93, 13, minute(c.incident));
  text(g, '↶', 181, 92, 24, GOLD);
  eventIcon(g, 215, 92, 28, c.crime, after);
  for (let i = 0; i < 3; i++) star(g, 155 + i * 25, 497, 9, i < run.stars ? GOLD : '#584054', '#a87372');
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
  sky(g, c.spec.site, calm.matches ? 0 : phase);
  if (screen === 'reveal') { drawReveal(); return; }
  if (screen === 'menu' || screen === 'cases' || screen === 'calendar') { drawMenu(); return; }
  drawScene(frame);
  heading(frame);
  if (playing()) updateGuide(frame);
  drawClaim(frame);
  drawPortraits();
  drawReplay(frame);
  drawNotebook();
  if (!notebook) drawTutorial();
  else if (!notes.length && !pointer) {
    const { x, y } = portraitPoints()[0];
    const progress = calm.matches ? .8 : phase % 1.2 / 1.2;
    g.beginPath();
    g.arc(x, y, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    g.strokeStyle = CREAM;
    g.lineWidth = 2;
    g.stroke();
    hand(g, x + 6, y + 11);
  }
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
    place(context, 107, 47, 27, person.claim.room, c.spec.site);
    text(context, '≠', 132, 47, 19, CREAM);
    place(context, 157, 47, 27, c.frames[person.claim.beat][person.id].room, c.spec.site);
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
  text(context, hard ? 'Alibi · Hard Daily' : 'Alibi · Daily', 120, 31, 20, CREAM, 'Georgia');
  star(context, 51, 68, 6, GOLD);
  star(context, 189, 62, 4, GOLD);
  rect(context, 94, 47, 52, 44, 10, '#ead2b5', '#a6737a', 1.7);
  eventIcon(context, 120, 69, 42, c.crime, false);
  for (const i of [0, 1, 2]) star(context, 93 + i * 27, 108, 10, i < run.stars ? GOLD : '#6c4a63', '#e7ac89');
  text(context, `${day}   ·   ${timeLabel(solvedSeconds)}`, 120, 136, 16, CREAM, 'Georgia');
  card.setAttribute('aria-label', `Alibi ${hard ? 'hard ' : ''}daily ${day}. ${run.stars} stars. Time ${timeLabel(solvedSeconds)}.`);
  shareFile = null;
  $('shareStatus').textContent = '';
  $('sendShare').disabled = true;
  card.toBlob(blob => {
    if (blob) shareFile = new File([blob], 'alibi.png', { type: 'image/png' });
    $('sendShare').textContent = canShareImage() ? 'Share image' : 'Save image';
    $('sendShare').disabled = false;
  });
  setScreen('sharing');
}

function canShareImage() {
  return shareFile && navigator.share && navigator.canShare?.({ files: [shareFile] });
}

async function shareImage() {
  try {
    if (canShareImage()) {
      await navigator.share({ files: [shareFile] });
      $('shareStatus').textContent = 'Image shared.';
      return;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      $('shareStatus').textContent = 'Sharing canceled.';
      return;
    }
  }
  const link = document.createElement('a');
  link.href = $('shareArt').toDataURL('image/png');
  link.download = 'alibi.png';
  link.click();
  $('shareStatus').textContent = 'Download started.';
}

function cssPoint(p) {
  const box = canvas.getBoundingClientRect();
  return { x: box.left + originX + scale * p.x, y: box.top + originY + scale * p.y };
}

window.alibiState = () => ({
  screen, paused: screen === 'paused', level: c.level, daily, hard, day, time, frame: beatNow(), stars: run.stars,
  selected, outcome: run.outcome, streak: profile.daily.streak, hardStreak: profile.hardDaily.streak,
  site: c.spec.site, hardUnlocked: hardUnlocked(), notes: notes.map(entry => ({ ...entry })), notebook, solvedSeconds,
  revealStage: screen === 'reveal' ? Math.min(2, Math.floor((phase - revealStart) / .86)) : null,
  points: {
    clock: { ...cssPoint(replay), endX: cssPoint({ x: replay.endX, y: replay.y }).x,
      ticks: board.map((_, beat) => cssPoint({ x: tickX(beat), y: replay.y })) },
    stamp: cssPoint(homeStamp),
    notebook: cssPoint(notebookButton),
    notes: notes.map((_, index) => ({ ...cssPoint({ x: 170, y: noteRowY(index) }),
      remove: cssPoint({ x: 256, y: noteRowY(index) }) })),
    suspects: portraitPoints().map(cssPoint),
    actors: actorPositions().filter(a => a.portrait !== null).map(a => ({ id: a.portrait, ...cssPoint(a) })),
  },
});

let last = performance.now();
function animate(now) {
  const dt = Math.min(.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (!document.hidden && screen !== 'paused' && screen !== 'done' && screen !== 'sharing') phase += dt;
  if (playing() && pointer?.type === 'suspect' && phase - pointer.at >= HOLD) {
    markNote(pointer.suspect);
    pointer.type = 'pinned';
  }
  if (screen === 'reveal') {
    if (!revealSound && phase - revealStart >= 1.28) {
      revealSound = true;
      for (const frequency of [392, 523, 659]) snd.tone(frequency, .34, .052, 'triangle', 23);
    }
    if (phase - revealStart >= REVEAL_DURATION) finishReveal();
  }
  draw();
  requestAnimationFrame(animate);
}

// A reload can resume this tab. Durable progress stays in the original local save.
addEventListener('pagehide', () => {
  try {
    if (!playing() && screen !== 'paused') {
      sessionStorage.removeItem(KEY);
      return;
    }
    sessionStorage.setItem(KEY, JSON.stringify({
      version: 1,
      seed, level: c.level, daily, hard, day, frame: beatNow(), selected, rejected: run.rejected,
      notes, notebook, seen: [...seen], scrolled: [...scrolled],
      elapsed: playedMs + (playing() ? performance.now() - activeSince : 0),
    }));
  } catch { /* Storage can be unavailable in private browsing. */ }
});

function reopenInvestigation() {
  let saved;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    saved = JSON.parse(raw);
  } catch { return; }
  if (saved?.version !== 1 || performance.getEntriesByType('navigation')[0]?.type !== 'reload') return;
  if (saved.seed !== seed || !validLevel(saved.level) || (saved.daily && !validDay(saved.day))
    || (saved.hard && !hardUnlocked())) return;
  const next = saved.daily ? dailyCase(saved.day, saved.hard) : createCase({ seed, level: saved.level });
  const index = (value, limit) => Number.isInteger(value) && value >= 0 && value < limit;
  const suspect = id => index(id, next.cast.length);
  const mark = beat => index(beat, next.beatCount);
  if (!mark(saved.frame) || (saved.selected !== null && !suspect(saved.selected))
    || !Array.isArray(saved.rejected) || saved.rejected.length >= 3 || !saved.rejected.every(suspect)
    || !Array.isArray(saved.notes) || saved.notes.length > 3 || !saved.notes.every(note =>
      note && suspect(note.id) && mark(note.beat) && index(note.room, next.spec.rooms))
    || !Array.isArray(saved.seen) || !saved.seen.every(suspect)
    || !Array.isArray(saved.scrolled) || !saved.scrolled.every(mark)
    || !Number.isFinite(saved.elapsed) || saved.elapsed < 0) return;
  start(saved.daily, saved.level, saved.hard, saved.day, next);
  time = saved.frame;
  selected = saved.selected;
  notes = saved.notes;
  notebook = saved.notebook;
  seen = new Set(saved.seen);
  scrolled = new Set(saved.scrolled);
  run = { stars: 3 - saved.rejected.length, rejected: saved.rejected, outcome: null };
  playedMs = saved.elapsed;
  setScreen('paused');
}

menu();
reopenInvestigation();
requestAnimationFrame(animate);
