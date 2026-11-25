import { sound } from '../kit/audio.js';
import * as save from '../kit/save.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { lab } from '../kit/lab.js';
import { hint } from '../kit/hint.js';
import { noZoom } from '../kit/zoom.js';
import { t, lang, setLang, apply } from './words.js';
import {
  CASES, CHAPTER_TWO_END, CLOCK_START, CLOCK_STEP, aids, caseVariant, claims, createCase, dailyCase, dailyWin, dayKey, offsetDay, dossiers,
  floorOf, freshRun, accuse, observe, practiceCase,
} from './sim.js';
import {
  W, H, INK, CREAM, GOLD, rect, text, star, clock, place, animal, costume, signature,
  sky, roomLayout, roomPoint, house, trace, eventIcon, heldItem, stamp, hand, SIGN,
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
  const { level, stars, sound, daily, hardDaily, campaignVersion, retries } = value ?? {};
  const best = Object.fromEntries(Object.entries(stars ?? {}).filter(([key, stars]) => validLevel(Number(key)) && validStars(stars)));
  // Losses per campaign case. Each loss shows the liar, so the next run of
  // that case deals a fresh variant (sim.js `caseVariant`).
  const lost = Object.fromEntries(Object.entries(retries ?? {}).filter(([key, n]) => validLevel(Number(key)) && validTime(n) && n > 0));
  const nextLevel = campaignVersion == null && level === 21 && best[21] ? 22 : level;
  return { level: validLevel(nextLevel) ? nextLevel : 1, campaignVersion: 2, stars: best, retries: lost, sound: sound !== false,
    daily: readDaily(daily), hardDaily: readDaily(hardDaily) };
}
const profile = readProfile(loaded);
const rec = lab('alibi');
const snd = sound({ on: () => profile.sound });
const showCards = screens(['menu', 'cases', 'paused', 'done', 'sharing', 'calendar']);
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const replay = { x: 42, endX: 318, y: 553 };
const homeStamp = { x: 180, y: 605 };
const notebookButton = { x: 48, y: 605 };
const HOLD = .46;
const REVEAL_DURATION = 2.7;
const chapters = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
const locales = Object.fromEntries(['en', 'tr'].map(code => {
  const integers = new Intl.NumberFormat(code);
  const padded = new Intl.NumberFormat(code, { minimumIntegerDigits: 2, useGrouping: false });
  const shortDate = new Intl.DateTimeFormat(code, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const longDate = new Intl.DateTimeFormat(code, { dateStyle: 'long', timeZone: 'UTC' });
  return [code, { integers, padded, shortDate, longDate }];
}));
const number = n => locales[lang()].integers.format(n);
const twoDigits = n => locales[lang()].padded.format(n);
const dateValue = day => new Date(`${day}T00:00:00Z`);
const dateLabel = (day, style = 'longDate') => locales[lang()][style].format(dateValue(day));

let c = createCase({ seed, level: 1 });
let board = [];
let cast = [];
let rooms = [];
let screen = 'menu';
let daily = false;
let hard = false;
// The guided practice case (note #245): the step the player is on, or null.
let step = null;
let day = '';
let run = freshRun();
let variant = 0;
let lossReveal = false;
let time = 0;
let selected = null;
let pointer = null;
let lastShot = null;
let notes = [];
let notebook = false;
let noteFlash = null;
let stampArmed = false;
let loupe = null;
let trailBack = false;
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
const clockLabel = value => `${number(Math.floor(value / 60))}:${twoDigits(value % 60)}`;
const formatTime = beat => clockLabel(minute(beat));
const dailyProfile = () => hard ? profile.hardDaily : profile.daily;
const hardUnlocked = () => profile.level > CHAPTER_TWO_END;
const activeStreak = (summary, today) => summary.last >= offsetDay(today, -1) ? summary.streak : 0;
// Training aids retire once their rule is taught (sim.js `aids`, which the
// bots read too). The scene circle and the claimed-room outline stay through
// chapter I and for a new player's Daily; case 7 shrinks the outline onto the
// room sign once and then leaves the comparison to the player. The mask tags
// stay for the mask lesson, the sound bracket for the two blackout lessons and
// the carrier trail for its lesson and a Hard Daily before it.
const guide = () => aids(c, { daily, hard, progress: profile.level });
const sceneGuide = () => guide().circle;
const maskGuide = () => guide().maskTags;
const soundGuide = () => guide().soundBracket;
// The outline lesson: the first comparison shows the outline, which shrinks
// onto the room sign. Later comparisons in that case show neither.
const OUTLINE_SHRINK = 1.3;
let outlineLesson = null;
function outlineState(frame) {
  const mode = guide().outline;
  const person = cast[selected];
  if (!mode || !person || notebook || !claims(person).some(claim => claim.beat === frame.beat)) return null;
  if (mode === 'full') return { shrink: 0 };
  outlineLesson ??= { id: selected, at: phase };
  if (outlineLesson.id !== selected) return null;
  return { shrink: calm.matches ? 1 : Math.min(1, (phase - outlineLesson.at) / OUTLINE_SHRINK) };
}
// The mark of the selected alibi that the replay shows now, if any.
const claimHere = (person, beat) => claims(person).find(claim => claim.beat === beat) ?? null;
const tickX = beat => replay.x + (replay.endX - replay.x) * beat / (c.beatCount - 1);
// Long timelines put marks closer than a thumb. A tap there opens a strip of
// five large marks around the tapped one, so a near miss is fixed with one tap.
const LOUPE = { y: 491, w: 58, h: 46, gap: 4, idle: 8 };
const needsLoupe = () => tickX(1) - tickX(0) < 32;
function loupeMarks() {
  if (!loupe) return [];
  const first = Math.max(0, Math.min(c.beatCount - 5, loupe.center - 2));
  return Array.from({ length: Math.min(5, c.beatCount) }, (_, k) => ({
    beat: first + k, x: 180 + (k - 2) * (LOUPE.w + LOUPE.gap), y: LOUPE.y,
  }));
}
const loupeHit = p => loupeMarks().find(mark => Math.abs(p.x - mark.x) <= (LOUPE.w + LOUPE.gap) / 2
  && Math.abs(p.y - mark.y) <= LOUPE.h / 2 + 2) ?? null;
function syncProfile() {
  const latest = readProfile(save.readJson(KEY));
  profile.level = Math.max(profile.level, latest.level);
  for (const [level, stars] of Object.entries(latest.stars)) {
    profile.stars[level] = Math.max(profile.stars[level] ?? 0, stars);
  }
  for (const [level, n] of Object.entries(latest.retries)) profile.retries[level] = Math.max(profile.retries[level] ?? 0, n);
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
  if (next !== 'play') {
    $('playGuide').textContent = '';
    delete $('playGuide').dataset.cue;
  }
  screen = next;
  showCards(next);
  $('pause').hidden = !playing();
  $('skipReveal').hidden = next !== 'reveal';
};

// The campaign's long goal: every star in every case.
const starTotal = () => t('starTotal', {
  n: number(CASES.reduce((sum, _, i) => sum + (profile.stars[i + 1] ?? 0), 0)),
  total: number(CASES.length * 3),
});

function updateMenu() {
  const current = validLevel(forceLevel) ? forceLevel : profile.level;
  $('progress').textContent = `${number(current)}/${number(CASES.length)}`;
  $('learn').classList.toggle('fresh', save.readJson(KEY) === null);
  $('caseStars').textContent = starTotal();
  if (screen === 'done') updateGoal();
  const today = dayKey();
  const streak = activeStreak(profile.daily, today);
  $('streak').textContent = streak ? `✦${number(streak)}` : '';
  $('daily').setAttribute('aria-label', t('dailyStreak', { n: number(streak) }));
  $('hardDaily').disabled = !hardUnlocked();
  $('hardDaily').textContent = t('hardDaily');
  if (!hardUnlocked()) {
    const unlock = document.createElement('small');
    unlock.textContent = t('unlockCase', { n: number(CHAPTER_TWO_END) });
    $('hardDaily').append(unlock);
  }
  $('menuSound').textContent = $('pauseSound').textContent = t(profile.sound ? 'soundOn' : 'soundOff');
  updateRecordingNotice();
  for (const id of ['menuSound', 'pauseSound']) $(id).setAttribute('aria-pressed', profile.sound);
}

function updateRecordingNotice() {
  if (noticeLead) noticeLead.textContent = t(recording?.checked ? 'recordingOn' : 'recordingOff', { days: number(180) });
}

function localizeNotesButton() {
  $('notes-button')?.setAttribute('aria-label', t('notes'));
}

function switchLanguage() {
  setLang(lang() === 'tr' ? 'en' : 'tr');
  // A manual choice supersedes a URL override, including on the next reload.
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang');
    history.replaceState(history.state, '', url);
  }
  apply();
  localizeNotesButton();
  updateMenu();
  draw();
}

function openCases(chapter = CASES[profile.level - 1].chapter) {
  const tabs = [...new Set(CASES.map(spec => spec.chapter))].map(index => {
    const button = document.createElement('button');
    button.textContent = chapters[index - 1];
    button.classList.toggle('primary', index === chapter);
    button.setAttribute('aria-label', t('chapter', { n: number(index) }));
    button.setAttribute('aria-pressed', index === chapter);
    button.onclick = () => openCases(index);
    return button;
  });
  $('chapterTabs').replaceChildren(...tabs);
  $('caseStars').textContent = starTotal();
  const choices = CASES.flatMap((spec, i) => {
    if (spec.chapter !== chapter) return [];
    const button = document.createElement('button');
    const level = i + 1;
    button.disabled = level > profile.level;
    button.classList.toggle('primary', level === profile.level);
    button.textContent = number(level);
    const stars = document.createElement('span');
    stars.textContent = '★'.repeat(profile.stars[level] ?? 0);
    button.append(stars);
    button.setAttribute('aria-label', t('chapterCase', { chapter: number(spec.chapter), caseNumber: number(level) }));
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
  const count = (mode, summary) => t('streakCount', { mode: t(mode), n: number(activeStreak(summary, today)) });
  $('calendarHeading').textContent = `✦ ${count('daily', profile.daily)} · ◆ ${count('hardDaily', profile.hardDaily)}`;
  $('calendarDates').textContent = [dates[0], today].map(date => dateLabel(date, 'shortDate')).join(' – ');
  const cells = dates.map(date => {
    const cell = document.createElement('div');
    const standard = Boolean(profile.daily.days[date]);
    const advanced = Boolean(profile.hardDaily.days[date]);
    cell.classList.toggle('marked', standard || advanced);
    cell.dataset.day = date;
    if (date === today) cell.setAttribute('aria-current', 'date');
    cell.setAttribute('role', 'img');
    cell.setAttribute('aria-label', t('calendarDay', {
      date: dateLabel(date), daily: t(standard ? 'dailySolved' : 'dailyEmpty'), hard: t(advanced ? 'hardSolved' : 'hardEmpty'),
    }));
    cell.textContent = number(dateValue(date).getUTCDate());
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
  variant = daily ? 0 : restoredCase?.variant ?? profile.retries[level] ?? 0;
  loadBoard(restoredCase?.case ?? (daily ? dailyCase(day, hard) : caseVariant(level, variant, seed)));
  time = 0;
  selected = null;
  pointer = null;
  lastShot = null;
  notes = [];
  notebook = false;
  noteFlash = null;
  wrongNotice = false;
  lossReveal = false;
  outlineLesson = null;
  loupe = null;
  trailBack = false;
  activeSince = performance.now();
  playedMs = 0;
  solvedSeconds = 0;
  seen = new Set();
  scrolled = new Set();
  run = freshRun();
  hintReady = phase;
  setScreen('play');
  step = null;
  rec.start({ level: c.practice ? 'practice' : daily ? `${hard ? 'hard-daily' : 'daily'}-${day}` : c.level });
  if (!restoredCase) snd.tone(494, .15, .09, 'triangle', 160);
}

// The practice case teaches one move per step, in words. A step ends when the
// player has done it. Nothing here is saved or scored, and nobody can lose.
const STEPS = [
  { say: 'learnStory', tap: true },
  { say: 'learnDrag', done: () => time >= c.beatCount - 1.02 && !pointer },
  { say: 'learnAsk', who: 0, done: () => selected === 0 },
  { say: 'learnJump', who: 0, done: () => beatNow() === c.incident && !pointer },
  { say: 'learnTrue', who: 0, tap: true },
  { say: 'learnOther', who: 1, done: () => selected === 1 && beatNow() === c.incident },
  { say: 'learnLie', who: 1, tap: true },
  { say: 'learnStamp' },
];
const canAccuse = () => step === null || step === STEPS.length - 1;
let stepAt = 0;
function learn() {
  start(false, 1, false, '', { case: practiceCase(), variant: 0 });
  snd.release();
  snd.unlock();
  step = 0;
  stepAt = phase;
  snd.tone(494, .15, .09, 'triangle', 160);
}
function nextStep() {
  step++;
  stepAt = phase;
  stampArmed = false;
  snd.tone(660, .16, .07, 'triangle', 180);
}
function updateCoach() {
  const show = playing() && step !== null;
  $('coach').hidden = !show;
  if (!show) return;
  const now = STEPS[step];
  if (now.done?.()) { nextStep(); updateCoach(); return; }
  // A step names its suspect: choosing another one keeps the step waiting.
  const vars = { time: formatTime(c.incident), end: formatTime(c.beatCount - 1) };
  const message = wrongNotice ? t('learnWrong', vars) : t(now.say, vars);
  if ($('coachText').textContent !== message) $('coachText').textContent = message;
  $('coachOk').hidden = !now.tap;
  $('coachCount').textContent = `${number(step + 1)}/${number(STEPS.length)}`;
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
  return { level: c.practice ? 'practice' : daily ? `${hard ? 'hard-daily' : 'daily'}-${day}` : c.level, stars: run.stars, marks: scrolled.size,
    statements: seen.size, guesses: run.rejected.length + Number(run.outcome === 'solved') };
}

function menu() {
  if (screen === 'paused' || playing()) rec.end('left', endSummary());
  pointer = null;
  selected = null;
  notebook = false;
  step = null;
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
$('learn').onclick = learn;
$('coachOk').onclick = () => { if (playing() && STEPS[step]?.tap) nextStep(); };
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
$('again').onclick = () => c.practice ? learn() : start(daily, c.level, hard, day);
$('next').onclick = () => start(false, c.practice ? profile.level : Math.min(CASES.length, c.level + 1));
$('menuSound').onclick = toggleSound;
$('pauseSound').onclick = toggleSound;
$('menuLanguage').onclick = switchLanguage;
$('pauseLanguage').onclick = switchLanguage;
$('share').onclick = openShare;
$('closeShare').onclick = () => setScreen('done');
$('sendShare').onclick = shareImage;
const notice = rec.notice($('menu').querySelector('.panel'));
const noticeLead = notice?.firstChild;
const recordingToggle = rec.toggle($('paused').querySelector('.panel'));
const recording = recordingToggle?.querySelector('input');
if (notice) notice.querySelector('a').dataset.i18n = 'privacy';
if (recordingToggle) {
  const label = document.createElement('span');
  label.dataset.i18n = 'recordPlay';
  recordingToggle.lastChild.replaceWith(label);
  recording.addEventListener('change', updateRecordingNotice);
  addEventListener('storage', updateRecordingNotice);
}
apply();
localizeNotesButton();
addEventListener('DOMContentLoaded', localizeNotesButton);
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
  kind: 'drag', key: 'kit-hint:alibi', played: Boolean(loaded), when: () => playing() && step === null,
  delay: 1700, reach: 64, label: t('dragHint'),
  bottom: () => {
    const box = canvas.getBoundingClientRect();
    return box.height - originY - replay.y * scale;
  },
});

function portraitPoints() {
  return cast.map((_, id) => ({
    x: 88.5 + (id % 4) * 61 + (cast.length < 4 ? (4 - cast.length) * 30.5 : id >= 4 && cast.length < 8 ? (8 - cast.length) * 30.5 : 0),
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
  if (c.trail && beat === c.trail.beat && scrolled.has(c.carryBeat)) trailBack = true;
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

// A solved campaign case names what it completed and the star total.
function updateGoal() {
  const goal = $('goal');
  if (c.practice && run.outcome === 'solved') {
    goal.hidden = false;
    const head = document.createElement('span');
    head.textContent = t('learnDone');
    goal.replaceChildren(head, t('learnRule'));
    return;
  }
  goal.hidden = daily || run.outcome !== 'solved';
  if (goal.hidden) return;
  const last = c.level === CASES.length;
  const chapterEnd = last || CASES[c.level].chapter !== c.spec.chapter;
  const done = last ? t('allSolved', { n: number(CASES.length) })
    : chapterEnd ? [t('chapterSolved', { n: number(c.spec.chapter) }), c.level === CHAPTER_TWO_END ? t('hardOpen') : ''].join(' ').trim()
      : '';
  const head = document.createElement('span');
  head.textContent = done;
  goal.replaceChildren(...(done ? [head] : []), starTotal());
}

function showResult(solved) {
  $('result').textContent = t(solved ? 'caught' : 'retry');
  updateGoal();
  $('next').hidden = daily || !solved || (!c.practice && c.level >= CASES.length);
  $('next').textContent = t(c.practice ? 'play' : 'next');
  $('share').hidden = !daily || !solved;
  $('next').classList.toggle('primary', !$('next').hidden);
  $('again').classList.toggle('primary', !solved);
  $('share').classList.toggle('primary', !$('share').hidden);
  $('endMenu').classList.toggle('primary', solved && $('next').hidden && $('share').hidden);
  $('resultArt').setAttribute('aria-label', solved ? t('result') : [t('wrongResult', { n: number(run.rejected.length) }),
    lossReveal ? t('liarShown') : ''].join(' ').trim());
  resultStart = performance.now();
  drawResult();
  setScreen('done');
}

function saveWin() {
  if (c.practice) return;
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
  if (!canAccuse()) return;
  const next = accuse(c, run, id);
  if (next === run) return;
  if (c.practice && next.outcome !== 'solved') {
    // Practice costs nothing: say that this alibi was true and keep going.
    wrongNotice = true;
    lastShot = { at: phase, id, solved: false };
    snd.noise(.105, .16, 465);
    rec.event('accuse', { suspect: id, correct: false, stars: run.stars });
    return;
  }
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
    // A lost campaign case shows its liar, and the next run of the case deals
    // a fresh variant. A lost Daily can be retried for full credit, so it
    // keeps the old card and does not show the liar.
    lossReveal = !daily;
    if (lossReveal) {
      if (save.readJson(KEY) !== null) syncProfile();
      profile.retries[c.level] = Math.max(profile.retries[c.level] ?? 0, variant) + 1;
      persist();
    }
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
    ? { id, ...(claimHere(person, frame.beat) ?? person.claim), claim: true }
    : { id, room, beat: frame.beat, claim: false };
  const same = entry => entry.id === note.id && entry.beat === note.beat
    && entry.room === note.room && entry.claim === note.claim;
  const duplicate = notes.findIndex(same);
  const added = duplicate === -1 && notes.length < 3;
  if (added) notes.push(note);
  notebook = true;
  noteFlash = { at: phase, full: !added && duplicate === -1, duplicate };
  snd.tone(added ? 614 : 240, .11, .07, 'triangle', 66);
}

const noteRowY = i => 157 + 45 * i;
function notebookInput(p) {
  if (c.practice) return false;
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
  if (loupe) {
    const mark = loupeHit(p);
    if (mark) {
      stampArmed = false;
      scrub(mark.beat, true);
      loupe.at = phase;
      e.preventDefault();
      return;
    }
    loupe = null;
  }
  if (notebookInput(p)) { e.preventDefault(); return; }
  if (Math.abs(p.y - homeStamp.y) <= 25 && Math.abs(p.x - homeStamp.x) < 61) {
    pointer = { ...p, id: e.pointerId, type: 'stamp', start: p, moved: false };
    if (!canAccuse()) { pointer = null; return; }
    snd.tone(375, .06, .065, 'triangle', 60);
  } else if (Math.abs(p.y - replay.y) <= 24 && p.x > 13 && p.x < 347) {
    stampArmed = false;
    pointer = { ...p, id: e.pointerId, type: 'clock', start: p, moved: false };
    scrubAt(p.x);
  } else {
    const id = nearestId(p);
    if (id !== null) {
      pointer = { ...p, id: e.pointerId, type: stampArmed ? 'accusation' : 'suspect', suspect: id, at: phase };
      snd.tone(442 + id * 15, .045, .04, 'triangle');
    } else if (!notebook && selected !== null && p.x >= 80 && p.x <= 280 && p.y >= 62 && p.y <= 115) {
      stampArmed = false;
      const person = cast[selected];
      scrub((person.claim2 && p.x >= 196 ? person.claim2 : person.claim).beat, true);
      pointer = { ...p, id: e.pointerId, type: 'tap' };
    } else return;
  }
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
}

function move(e) {
  if (pointer?.id !== e.pointerId) return;
  const p = point(e);
  if (pointer.type === 'clock') {
    if (Math.abs(p.x - pointer.start.x) > 8) pointer.moved = true;
    scrubAt(p.x);
  }
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
  if (type === 'clock') {
    scrubAt(p.x, true);
    if (!moved && needsLoupe()) loupe = { center: beatNow(), at: phase };
  }
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
    if (c.practice) return;
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
  if (c.practice) text(g, '?', 117, 35, 22, GOLD);
  else if (daily) text(g, hard ? '◆' : '✦', 119, 35, 22, GOLD);
  else {
    text(g, chapters[c.spec.chapter - 1], 105, 28, 8, GOLD, 'system-ui', 'left');
    text(g, twoDigits(c.level), 105, 44, 15, CREAM, 'Georgia', 'left');
  }
  if (!c.practice) for (let i = 0; i < 3; i++) star(g, 146 + i * 16, 37, 6.3, i < run.stars ? GOLD : '#594054', '#cf936d', 1);
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
  const person = cast[selected];
  if (!person.claim2) {
    place(g, 150, 85, 34, claim.room, c.spec.site);
    clock(g, 190, 85, 14, minute(claim.beat));
    text(g, formatTime(claim.beat), 224, 85, 18, INK, 'Georgia');
    if (frame.beat !== claim.beat) line([[262, 81], [266, 85], [262, 89]], '#a67469', 1.7);
    return;
  }
  // Two marks: a room and a time for each, side by side.
  line([[196, 68], [196, 104]], '#c9a08c', 1);
  for (const [index, mark] of claims(person).entries()) {
    const { icon, clockX, chevron } = claimSlots[index];
    place(g, icon, 80, 28, mark.room, c.spec.site);
    clock(g, clockX, 80, 10, minute(mark.beat));
    text(g, formatTime(mark.beat), (icon + clockX) / 2, 100, 12, INK, 'Georgia');
    if (frame.beat !== mark.beat) line([[chevron - 2, 76], [chevron + 2, 80], [chevron - 2, 84]], '#a67469', 1.7);
  }
}
// Where each mark of a two-mark alibi sits on the claim card.
const claimSlots = [{ icon: 141, clockX: 170, chevron: 188 }, { icon: 216, clockX: 245, chevron: 263 }];
const claimPoint = (person, mark) => person.claim2
  ? { x: claimSlots[claims(person).indexOf(mark)].chevron + 3, y: 87 } : { x: 266, y: 87 };
// The mark an alibi tap or the jump hint goes to: an unvisited one first.
function jumpMark(person, beat) {
  const away = claims(person).filter(mark => mark.beat !== beat);
  return away.find(mark => !scrolled.has(mark.beat)) ?? away[0] ?? person.claim;
}

function drawReplay(frame) {
  rect(g, 14, 521, 332, 109, 16, '#2c2337', '#82586d');
  rect(g, 22, 535, 316, 48, 10, '#34283e');
  line([[replay.x, replay.y], [replay.endX, replay.y]], '#95687b', 3);
  line([[replay.x, replay.y], [tickX(time), replay.y]], '#edbd80', 3);
  const claimBeats = selected === null ? [] : claims(cast[selected]).map(mark => mark.beat);
  for (let i = 0; i < c.beatCount; i++) {
    const x = tickX(i);
    line([[x, replay.y - 11], [x, replay.y + 11]], '#896678', 1);
    dot(x, replay.y, seen.size && scrolled.has(i) ? 3.3 : 2.7, i <= time ? '#f6cf97' : '#987384');
    // The time of each mark, under the line (note #245).
    const here = i === frame.beat;
    text(g, formatTime(i), x, replay.y + 24.5, c.beatCount > 10 ? 9 : here ? 12 : 11, here ? '#ffdf9f' : '#d9b6ab', 'Georgia');
    if (i === c.shutterBeat) {
      rect(g, x - 3.8, replay.y + 10, 7.6, 5.6, 1.2, null, '#dcb58d', 1.1);
      dot(x, replay.y + 12.8, 1.2, '#dcb58d');
    }
    if (claimBeats.includes(i)) {
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

  if (!canAccuse()) return;
  rect(g, 119, 583, 122, 44, 10, stampArmed ? '#885153' : '#403047', stampArmed ? GOLD : '#987184');
  const held = pointer?.type === 'stamp';
  if (stampArmed) text(g, '×', 146, 604, 23, CREAM);
  else if (!held) stamp(g, 146, homeStamp.y - 1, .76);
  text(g, t(stampArmed ? 'cancel' : 'accuse'), 201, 605, 15, CREAM);
  if (c.practice) return;
  const { x, y } = notebookButton;
  rect(g, x - 25, y - 22, 50, 44, 10, notebook ? '#70505c' : '#403047', '#987184');
  bookIcon(x - 3, y, '#ffe1aa');
  if (notes.length) {
    dot(x + 14, y + 9, 6.5, '#e7a66c');
    text(g, number(notes.length), x + 14, y + 9, 8, INK);
  }

}

function bookIcon(x, y, color) {
  rect(g, x - 9, y - 10, 18, 20, 2, color, INK, 1.3);
  line([[x - 5, y - 9], [x - 5, y + 9]], '#a86369');
  for (const dy of [-4, 0, 4]) line([[x - 2, y + dy], [x + 5, y + dy]], '#9d6c68', .9);
}

function drawNotebook(cue) {
  if (!notebook) return;
  const fresh = noteFlash && phase - noteFlash.at < .5;
  rect(g, 73, 113, 214, 161, 13, '#261c30a0');
  rect(g, 75, 109, 210, 161, 12, '#f9e4be', cue === 'full' ? '#dc796d' : '#a76d72', fresh || cue === 'full' ? 3 : 2);
  for (let j = 0; j < 4; j++) {
    const y = 125 + j * 43;
    line([[72, y], [81, y]], '#57364a', 2.6);
    line([[73, y - .5], [80, y - .5]], '#f7c789', .8);
  }
  bookIcon(93, 123, '#f7c787');
  if (cue === 'duplicate') text(g, '=', 180, 123, 17, '#604255');
  text(g, `${number(notes.length)} / ${number(3)}`, 250, 123, 13, INK);
  for (let i = 0; i < 3; i++) {
    const y = noteRowY(i);
    const entry = notes[i];
    const same = cue === 'duplicate' && noteFlash.duplicate === i;
    rect(g, 86, y - 21.5, 189, 44, 6, same ? '#fff2ce' : entry ? '#f4cf9b' : '#efd9ae', same ? '#6d4b5e' : '#ca9d85', same ? 2.2 : .85);
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
    rect(g, 232, y - 21.5, 44, 44, 6, cue === 'full' ? '#dc9384' : '#e7b68d');
    text(g, '×', 256, y - .5, 20, '#784e60');
  }
}

function drawPortraits() {
  const pts = portraitPoints();
  rect(g, 47, 423, 266, cast.length <= 4 ? 50 : 95, 19, '#412f45', '#a774817d');
  for (const [id, { x, y }] of pts.entries()) {
    const person = cast[id];
    const target = pointer?.type === 'stamp' && pointer.target === id;
    const wrong = run.rejected.includes(id);
    const chosen = selected === id;
    const armed = stampArmed && !wrong;
    rect(g, x - 24, y - 22, 48, 44, 10, wrong ? '#5c3d51' : chosen ? '#f7d49e' : '#ddac9c',
      target || armed ? CREAM : chosen ? GOLD : '#9b6375', target || armed || chosen ? 2.5 : 1.2);
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
    if (armed) {
      line([[x - 19, y - 9], [x - 19, y - 16], [x - 12, y - 16]], INK, 1.8);
      line([[x + 19, y + 9], [x + 19, y + 16], [x + 12, y + 16]], INK, 1.8);
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
  const outline = staticScene ? null : outlineState(frame);
  const claim = outline && claimHere(cast[selected], frame.beat);
  house(g, rooms, frame, c.crime, outline?.shrink === 0 ? claim.room : null, c.spec.site);
  if (outline?.shrink > 0) drawShrinkingOutline(rooms[claim.room], outline.shrink);
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
    drawFloorSounds(frame);
    return;
  }
  for (const item of frame.evidence) trace(g, rooms[item.room], item.kind);
  const actors = staticScene ? frame.actors.map(actor => ({ ...actor, ...roomPoint(rooms[actor.room], actor.slot), walk: 0 })) : actorPositions();
  for (const actor of [...actors].sort((a, b) => a.y - b.y)) {
    if (!staticScene && actor.portrait !== null && ((sceneGuide() && actor.portrait === selected) || actor.portrait === pointer?.target)) {
      dot(actor.x, actor.y - 2, 19, '#fff0bb50', '#fff0ce', 1.5);
    }
    const species = actor.portrait === null ? null : cast[actor.portrait].species;
    const hurt = actor.portrait !== null && lastShot?.id === actor.portrait && !lastShot.solved
      && phase - lastShot.at < .75;
    if (sceneGuide() && pointer?.type === 'suspect' && pointer.suspect === actor.portrait) {
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
  if (!staticScene) {
    // Tags go on top: on the exchange mark they matter more than the bubble.
    drawExchange(frame, actors);
    drawMaskTags(frame, actors);
    drawTrail(frame, actors);
  }
}

// The outline lesson: the claimed-room outline closes onto the room sign,
// then the sign alone stays marked for this first comparison.
function drawShrinkingOutline(room, shrink) {
  const ease = shrink * shrink * (3 - 2 * shrink);
  const sign = { x: room.x + SIGN.x - SIGN.size / 2 - 3, y: room.y + SIGN.y - SIGN.size / 2 - 3, w: SIGN.size + 6, h: SIGN.size + 6 };
  const from = { x: room.x + 3.5, y: room.y + 4, w: room.w - 7, h: room.h - 8 };
  const mix = key => from[key] + (sign[key] - from[key]) * ease;
  rect(g, mix('x'), mix('y'), mix('w'), mix('h'), 4 + 6 * ease, null, '#fff5cb', 3.1);
}

// A floor case hears each suspect only on a floor. The symbols sit on a band
// across the whole floor, ordered by symbol, so their place names no room.
function floorBands() {
  const rows = [...new Set(rooms.map(room => room.y))];
  return rows.map(y => ({ x: 26, y: y + 64, w: 308, h: 34 }));
}
function drawFloorSounds(frame) {
  if (!frame.heard.length) return;
  for (const [floor, band] of floorBands().entries()) {
    const heard = frame.heard.filter(item => item.floor === floor);
    rect(g, band.x, band.y, band.w, band.h, 12, '#3d2f4dd8', '#c39fb0', 1.6);
    line([[band.x + 10, band.y - 6], [band.x + 2, band.y + band.h / 2], [band.x + 10, band.y + band.h + 6]], '#c39fb0', 1.6);
    line([[band.x + band.w - 10, band.y - 6], [band.x + band.w - 2, band.y + band.h / 2], [band.x + band.w - 10, band.y + band.h + 6]], '#c39fb0', 1.6);
    const step = Math.min(34, (band.w - 30) / Math.max(1, heard.length));
    heard.forEach((item, i) => {
      const x = band.x + band.w / 2 + (i - (heard.length - 1) / 2) * step;
      rect(g, x - 13, band.y + 6, 26, 22, 7, '#4f3c58', '#b193a5');
      signature(g, x, band.y + 17, 24, item.sound);
    });
  }
}
// Where a floor sound symbol is drawn, for the lesson bracket.
function floorSoundPoint(frame, sound) {
  const band = floorBands();
  const item = frame.heard.find(entry => entry.sound === sound);
  if (!item) return null;
  const heard = frame.heard.filter(entry => entry.floor === item.floor);
  const b = band[item.floor];
  const step = Math.min(34, (b.w - 30) / Math.max(1, heard.length));
  return { x: b.x + b.w / 2 + (heard.indexOf(item) - (heard.length - 1) / 2) * step, y: b.y + 17 };
}

const TAG = '#fff4e0';
function drawMaskTags(frame, actors) {
  const firstMasks = frame.beat > 0 && frame.actors.some(actor => actor.mask !== null)
    && !board[frame.beat - 1].actors.some(actor => actor.mask !== null);
  const tags = maskGuide();
  if (!tags || !(firstMasks || (tags === 'all' && frame.exchange))) return;
  const wearers = c.frames[frame.beat];
  for (const actor of actors) {
    if (actor.mask === null) continue;
    const id = wearers.findIndex(entry => entry.mask === actor.mask);
    if (id < 0) continue;
    const x = actor.x;
    const y = actor.y - 33;
    g.beginPath();
    g.moveTo(x - 4, y + 9);
    g.lineTo(x, y + 14);
    g.lineTo(x + 4, y + 9);
    g.fillStyle = TAG;
    g.fill();
    dot(x, y, 11, TAG, '#945b6f', 1.4);
    animal(g, x, y, 19, cast[id].species, { head: true });
  }
}

function teachingCue(frame) {
  if (stampArmed) return 'armed';
  if (notebook) {
    if (noteFlash && phase - noteFlash.at < 3) {
      if (noteFlash.duplicate >= 0) return 'duplicate';
      if (noteFlash.full) return 'full';
    }
    return notes.length ? 'note' : 'pin';
  }
  if (wrongNotice) return 'wrong';
  if (frame.shutter) return 'shutter';
  if (frame.blackout) {
    if (selected !== null && !claimHere(cast[selected], frame.beat)) return 'blackoutJump';
    return c.spec.floors ? 'floors' : 'blackout';
  }
  if (selected === null) return guide().trail && c.trail && !trailBack && scrolled.has(c.carryBeat) ? 'trail' : 'inspect';
  const person = cast[selected];
  if (!claimHere(person, frame.beat)) return 'jump';
  if (person.claim2 && claims(person).some(mark => !scrolled.has(mark.beat))) return 'secondMark';
  return outlineState(frame) ? 'compare' : 'compareSign';
}

function updateGuide(cue) {
  const key = cue === 'wrong' ? (run.stars === 1 ? 'wrongOneCue' : 'wrongManyCue') : `${cue}Cue`;
  const vars = cue === 'jump' ? { time: formatTime(jumpMark(cast[selected], beatNow()).beat) } : { n: number(run.stars) };
  const message = t(key, vars);
  const guide = $('playGuide');
  if (guide.textContent !== message) guide.textContent = message;
  guide.dataset.cue = cue;
}

function ghostTap(x, y, pulse) {
  dot(x, y, 9 + pulse * 7, '#fff1ce18', '#fff1ce', 1.6);
  hand(g, x + 5, y + pulse * 7);
}

function corners(x, y, w, h, color = CREAM) {
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
    line([[x + dx * (w - 5), y + dy * h], [x + dx * w, y + dy * h], [x + dx * w, y + dy * (h - 5)]], color, 2.1);
  }
}

function markTick(beat) {
  const x = tickX(beat);
  line([[x - 5, replay.y - 24], [x, replay.y - 19], [x + 5, replay.y - 24]], CREAM, 2.1);
}

function drawNotebookHint(cue, pulse) {
  if (cue === 'pin') {
    const { x, y } = portraitPoints()[0];
    const travel = calm.matches ? 1 : Math.min(1, Math.max(0, (phase % 2.5 - 1.05) / .65));
    const progress = calm.matches ? .85 : Math.min(1, phase % 2.5 / .9);
    g.beginPath();
    g.arc(x, y, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    g.strokeStyle = CREAM;
    g.lineWidth = 2;
    g.stroke();
    hand(g, x + 6, y + 11);
    if (travel > 0) {
      g.save();
      g.globalAlpha = .8;
      const toX = x + (108 - x) * travel;
      const toY = y + (noteRowY(0) - y) * travel;
      dot(toX, toY, 14, '#ffe6b9', '#87576b');
      animal(g, toX, toY, 24, cast[0].species, { head: true });
      g.restore();
    }
    return;
  }
  if (cue === 'duplicate') return;
  if (cue === 'note') {
    markTick(notes[0].beat);
    corners(178, noteRowY(0), 12, 12, '#7b4d56');
    if (pulse > .6 || calm.matches) hand(g, 182, noteRowY(0) + 5);
  }
  if (cue === 'full' || pulse > .6 || calm.matches) corners(254, noteRowY(0), 15, 15, '#7b4d56');
}

// The mark that decides an alibi: the false one for the liar, else the first.
const decidingMark = id => claims(cast[id]).find(mark => c.frames[mark.beat][id].room !== mark.room) ?? cast[id].claim;

function drawEvidencePair(context, x, y, id) {
  const claim = decidingMark(id);
  animal(context, x - 63, y, 23, cast[id].species, { head: true });
  rect(context, x - 47, y - 13, 25, 26, 5, '#fff0d2', '#ac7680');
  place(context, x - 34, y, 22, claim.room, c.spec.site);
  text(context, '=', x - 13, y, 15, CREAM);
  rect(context, x - 4, y - 13, 25, 26, 5, '#654b60', '#f9d8aa');
  place(context, x + 9, y, 22, c.frames[claim.beat][id].room, c.spec.site);
  clock(context, x + 34, y, 9, minute(claim.beat));
  text(context, formatTime(claim.beat), x + 65, y, 13, CREAM, 'Georgia');
}

function drawWrongCue() {
  rect(g, 68, 116, 224, 42, 12, '#3d2d46', '#e9b18e', 1.4);
  drawEvidencePair(g, 151, 137, lastShot.id);
  line([[237, 124], [237, 150]], '#ae7b83', 1);
  text(g, number(run.stars), 252, 137, 15, CREAM);
  star(g, 271, 137, 8, GOLD, '#80566d');
  if (!calm.matches) {
    const fall = (phase - lastShot.at) / .65;
    if (fall < 1) {
      g.save();
      g.globalAlpha = 1 - fall;
      star(g, 146 + run.stars * 16, 37 + 42 * fall, 8, GOLD, '#80566d');
      g.restore();
    }
  }
}

// The practice case points at exactly one thing: what the step asks for.
function drawCoaching() {
  if (wrongNotice) return;
  const pulse = calm.matches ? .55 : .5 - .5 * Math.cos(phase * 5);
  const now = STEPS[step];
  if (now.say === 'learnDrag') {
    const wave = calm.matches ? .62 : .5 - .5 * Math.cos((phase - stepAt) * 2.2);
    hand(g, tickX(Math.max(time, wave * (c.beatCount - 1))), replay.y + 4, -.19);
  } else if (now.say === 'learnStamp') {
    if (!stampArmed) ghostTap(homeStamp.x, homeStamp.y, pulse);
  } else if (now.who !== undefined && selected !== now.who) {
    const p = portraitPoints()[now.who];
    ghostTap(p.x, p.y, pulse);
  } else if (selected !== null && beatNow() !== c.incident) {
    const p = claimPoint(cast[selected], cast[selected].claim);
    ghostTap(p.x, p.y, pulse);
    markTick(c.incident);
  } else if (now.say === 'learnTrue' || now.say === 'learnLie') {
    // The alibi's picture, the same picture in the house, and where they are.
    const actor = board[beatNow()].actors.find(entry => entry.portrait === selected);
    const room = rooms[cast[selected].claim.room];
    corners(150, 85, 20, 20, '#8e5562');
    corners(room.x + SIGN.x, room.y + SIGN.y, SIGN.size / 2 + 2 + pulse * 2, SIGN.size / 2 + 2 + pulse * 2);
    const at = roomPoint(rooms[actor.room], actor.slot);
    corners(at.x, at.y - 4, 21 + pulse * 2, 23 + pulse * 2, GOLD);
  }
}

function drawTeaching(frame, cue) {
  if (!cue || pointer) return;
  if (step !== null) { drawCoaching(); return; }
  const pulse = calm.matches ? .55 : .5 - .5 * Math.cos(phase * 5);
  if (notebook) { drawNotebookHint(cue, pulse); return; }
  if (cue === 'wrong') {
    drawWrongCue();
    if (phase - lastShot.at > .65 || calm.matches) {
      // Point only at a suspect not yet inspected. Once every face has been
      // seen, a hand on a portrait reads as "stamp this one", so none is drawn.
      const next = cast.find(person => !run.rejected.includes(person.id) && !seen.has(person.id));
      if (next) {
        const p = portraitPoints()[next.id];
        ghostTap(p.x, p.y, pulse);
      }
    }
    return;
  }
  if (cue === 'armed') {
    stamp(g, 180, 411, .67, true);
    return;
  }
  if (cue === 'inspect') {
    rect(g, 89, 63, 182, 35, 12, '#3b2c43', '#c39480');
    text(g, t('objective'), 180, 81, 17, CREAM, 'Georgia');
  }
  if (selected === null) {
    if (help.shown || drawTimelineLesson()) return;
    const id = c.spec.tutorial === 'cast' && !seen.size ? cast.length - 1 : cast.findIndex(person => !seen.has(person.id) && !run.rejected.includes(person.id));
    if (id < 0) return;
    const p = portraitPoints()[id];
    if (cue === 'blackout' || cue === 'floors') {
      // Ring the portrait's sound symbol and point at it from the left, so the
      // finger does not cover the symbol it teaches.
      dot(p.x, p.y + 14.5, 9 + pulse * 5, '#fff1ce18', '#fff1ce', 1.6);
      hand(g, p.x - 16 - pulse * 4, p.y + 15.5, Math.PI / 2);
    } else ghostTap(p.x, p.y, pulse);
    return;
  }
  const person = cast[selected];
  const target = jumpMark(person, frame.beat);
  if (cue === 'jump' || cue === 'shutter') {
    const point = claimPoint(person, target);
    ghostTap(point.x, point.y, pulse);
    markTick(target.beat);
    if (cue === 'jump' && !help.shown) drawTimelineLesson();
    return;
  }
  if (frame.blackout) {
    const p = portraitPoints()[selected];
    corners(p.x, p.y + 14, 15, 8);
    corners(110, 102, 14, 7, '#8e5562');
    const match = soundGuide() && frame.sounds.find(item => item.sound === person.sound);
    const heard = soundGuide() && floorSoundPoint(frame, person.sound);
    if (match) {
      const { x, y } = roomPoint(rooms[match.room], match.slot);
      corners(x, y, 16 + pulse * 2, 13 + pulse * 2);
    } else if (heard) corners(heard.x, heard.y, 16 + pulse * 2, 13 + pulse * 2);
    if (cue === 'blackoutJump') {
      const point = claimPoint(person, target);
      ghostTap(point.x, point.y, pulse);
      markTick(target.beat);
      return;
    }
  } else {
    const here = claimHere(person, frame.beat);
    const slot = person.claim2 ? claimSlots[claims(person).indexOf(here)] : null;
    if (slot) corners(slot.icon, 80, 16, 16, '#8e5562');
    else corners(150, 85, 20, 20, '#8e5562');
    // The room sign is marked only while the outline is taught.
    const outline = outlineState(frame);
    if (outline && (outline.shrink === 0 || outline.shrink >= 1)) {
      const room = rooms[here.room];
      corners(room.x + SIGN.x, room.y + SIGN.y, SIGN.size / 2 + 1 + pulse * 2, SIGN.size / 2 + 1 + pulse * 2);
    }
    if (cue === 'secondMark') {
      const other = claims(person).find(mark => mark !== here);
      const point = claimPoint(person, other);
      ghostTap(point.x, point.y, pulse);
      markTick(other.beat);
    }
    if (!help.shown) drawTimelineLesson();
  }
  // A general rule beside the comparison. It does not mark any suspect as guilty.
  rect(g, 119, 117, 122, 33, 10, '#3d2d46', '#bf8b84');
  dot(136, 133, 5, '#f1c288');
  text(g, '≠', 154, 133, 15, CREAM);
  rect(g, 168, 128, 10, 10, 1, '#f1c288');
  text(g, '→', 191, 133, 18, CREAM);
  stamp(g, 219, 132, .54);
}

function drawLoupe() {
  if (!loupe) return;
  if (!playing() || notebook || phase - loupe.at > LOUPE.idle) { loupe = null; return; }
  const marks = loupeMarks();
  const left = marks[0].x - LOUPE.w / 2 - 6;
  const right = marks.at(-1).x + LOUPE.w / 2 + 6;
  rect(g, left, LOUPE.y - LOUPE.h / 2 - 6, right - left, LOUPE.h + 12, 12, '#2c2337', '#c69496', 1.5);
  for (const mark of marks) {
    const now = mark.beat === beatNow();
    rect(g, mark.x - LOUPE.w / 2, mark.y - LOUPE.h / 2, LOUPE.w, LOUPE.h, 9, now ? '#6d4a58' : '#403047', now ? GOLD : '#987184', now ? 2 : 1.2);
    clock(g, mark.x, mark.y - 7, 11, minute(mark.beat));
    text(g, formatTime(mark.beat), mark.x, mark.y + 14, 11, CREAM, 'Georgia');
    if (mark.beat === c.shutterBeat || board[mark.beat].blackout) dot(mark.x + 20, mark.y - 15, 3, '#dcb58d');
  }
  // A thin line ties the strip to the tapped mark on the timeline.
  const at = marks.find(mark => mark.beat === beatNow()) ?? marks[2];
  line([[at.x, LOUPE.y + LOUPE.h / 2 + 6], [tickX(beatNow()), replay.y - 18]], '#c69496', 1.2);
}

// The carrier lesson: ring the carrier on the hand-off mark, then point one
// mark back, where the item's last room is framed and everyone who stood with
// the carrier gets an item badge. The badge marks who could have handed it.
function drawTrail(frame, actors) {
  if (!guide().trail || !c.trail || run.rejected.length) return;
  const pulse = calm.matches ? .55 : .5 - .5 * Math.cos(phase * 5);
  if (frame.beat === c.carryBeat) {
    const carrier = actors.find(actor => actor.carry);
    if (carrier) corners(carrier.x, carrier.y - 4, 21 + pulse * 2, 23 + pulse * 2, GOLD);
  } else if (frame.beat === c.trail.beat && scrolled.has(c.carryBeat)) {
    const room = rooms[c.trail.room];
    corners(room.x + room.w / 2, room.y + room.h / 2 + 2, room.w / 2 - 3, room.h / 2 - 4, GOLD);
    const seat = c.frames[c.trail.beat][c.carrier];
    for (const actor of actors) {
      if (actor.room !== c.trail.room || actor.slot === seat.slot) continue;
      dot(actor.x + 13, actor.y - 27, 9, '#fff1d3', '#90586c');
      heldItem(g, actor.x + 13, actor.y - 27, 14, c.crime);
    }
  }
}

function drawTimelineLesson() {
  const lesson = c.spec.tutorial;
  if (run.rejected.length) return false;
  const age = Math.max(0, phase - hintReady);
  if (age < .45) return false;
  const wave = calm.matches ? .62 : .5 - .5 * Math.cos(age * 3.6);
  const tickHand = (from, to) => hand(g, tickX(from + (to - from) * wave), replay.y + 4, -.19);
  if (guide().trail && c.trail && !trailBack) {
    if (scrolled.has(c.carryBeat)) tickHand(c.carryBeat, c.trail.beat);
    else tickHand(c.carryBeat, c.carryBeat);
    return true;
  }
  if (daily) return false;
  if (lesson === 'masks' && !scrolled.has(c.exchangeBeat)) {
    if (scrolled.has(2) && scrolled.has(3)) tickHand(c.exchangeBeat - 1, c.exchangeBeat);
    else tickHand(2, 3);
  } else if (lesson === 'blackout' && !scrolled.has(c.blackoutBeat)) {
    tickHand(c.blackoutBeat, c.blackoutBeat);
  } else return false;
  return true;
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
  rect(g, x - 29, y - 24, 58, 48, 8, '#251c32', '#dba97e', 1.7);
  rect(g, x - 16, y - 29, 18, 6, 2, '#dba97e');
  pathShutter(x, y);
  line([[x - 22, y + 16], [x + 22, y - 16]], '#251c32', 7);
  line([[x - 22, y + 16], [x + 22, y - 16]], '#f7c77e', 3);
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
  const cue = playing() ? teachingCue(frame) : null;
  sky(g, c.spec.site, calm.matches ? 0 : phase);
  if (screen === 'reveal') { drawReveal(); return; }
  if (screen === 'menu' || screen === 'cases' || screen === 'calendar') { drawMenu(); return; }
  drawScene(frame);
  heading(frame);
  if (cue && step === null) updateGuide(cue);
  drawClaim(frame);
  drawPortraits();
  drawReplay(frame);
  drawNotebook(cue);
  drawTeaching(frame, cue);
  drawLoupe();
  drawShot();
  if (pointer?.type === 'stamp') {
    g.save();
    g.globalAlpha = .8;
    stamp(g, pointer.x, Math.max(23, pointer.y - 31), .95, pointer.target !== null && pointer.target !== undefined);
    g.restore();
    dot(pointer.x, pointer.y, 5.5, '#fff1ce40', CREAM, 1.1);
  }
}

// The loss card replays the liar's contradiction once: the liar's head sits in
// the claimed room, then crosses to where they really were at that mark.
const REVEAL_MOVE = 1.4;
let resultStart = 0;
function drawLossReveal(context, progress) {
  const person = cast[c.culprit];
  const lie = decidingMark(person.id);
  const ease = k => k * k * (3 - 2 * k);
  const move = ease(Math.min(1, Math.max(0, (progress - .25) / .55)));
  for (const [i, id] of run.rejected.entries()) {
    const x = 106 + i * 34;
    rect(context, x - 13, 13, 26, 25, 6, '#734d61', '#bd8790');
    animal(context, x - 1, 25, 21, cast[id].species, { head: true });
    rect(context, x + 4, 25, 11, 11, 6, '#603549', '#eaa69a');
    text(context, '×', x + 9.5, 30.5, 10, CREAM);
  }
  rect(context, 14, 17, 62, 68, 12, '#e6b59f', '#f6c17b', 2.4);
  animal(context, 45, 50, 52, person.species, { head: true, mood: 'caught' });
  rect(context, 89, 47, 34, 34, 7, '#fff0d2', '#ac7680');
  place(context, 106, 64, 26, lie.room, c.spec.site);
  rect(context, 157, 47, 34, 34, 7, '#654b60', '#f9d8aa');
  place(context, 174, 64, 26, c.frames[lie.beat][person.id].room, c.spec.site);
  context.save();
  context.globalAlpha = Math.min(1, Math.max(0, (progress - .7) / .3));
  text(context, '≠', 140, 64, 19, CREAM);
  clock(context, 213, 64, 12, minute(lie.beat));
  context.restore();
  animal(context, 112 + 56 * move, 72 - 14 * Math.sin(Math.PI * move), 19, person.species, { head: true });
}

function drawResult() {
  const progress = calm.matches ? 1 : Math.min(1, (performance.now() - resultStart) / 1000 / REVEAL_MOVE);
  if (lossReveal && progress < 1) requestAnimationFrame(() => { if (lossReveal) drawResult(); });
  const context = $('resultArt').getContext('2d');
  context.setTransform(2, 0, 0, 2, 0, 0);
  context.clearRect(0, 0, 240, 107);
  const person = cast[c.culprit];
  rect(context, 1, 9, 238, 93, 15, '#48354c', '#936678');
  if (run.outcome === 'solved') {
    rect(context, 17, 22, 62, 65, 12, '#e6b59f', '#aa7181', 2);
    animal(context, 48, 54, 56, person.species, { head: true });
    star(context, 74, 24, 8, GOLD, '#aa7181');
    const lie = decidingMark(person.id);
    place(context, 107, 47, 27, lie.room, c.spec.site);
    text(context, '≠', 132, 47, 19, CREAM);
    place(context, 157, 47, 27, c.frames[lie.beat][person.id].room, c.spec.site);
    clock(context, 201, 47, 13, minute(lie.beat));
  } else if (lossReveal) {
    drawLossReveal(context, progress);
  } else {
    for (const [i, id] of run.rejected.entries()) {
      const x = 82 + i * 38;
      rect(context, x - 15, 16, 30, 29, 7, '#734d61', '#bd8790');
      animal(context, x - 1, 30, 25, cast[id].species, { head: true });
      rect(context, x + 5, 31, 13, 13, 7, '#603549', '#eaa69a');
      text(context, '×', x + 11.5, 37, 12, CREAM);
    }
    drawEvidencePair(context, 120, 62, run.rejected.at(-1));
  }
  const solved = run.outcome === 'solved';
  if (lossReveal) return;
  for (let i = 0; i < 3; i++) star(context, (solved ? 132 : 96) + i * 24, solved ? 76 : 87, 8, i < run.stars ? GOLD : '#6e4b64', '#dc9d81');
}

let shareFile = null;
const shareFilename = () => `${t('title').toLocaleLowerCase(lang())}.png`;

function showShareStatus(key, icon) {
  const status = $('shareStatus');
  status.querySelector('span').textContent = key ? t(key) : '';
  status.querySelector('path').setAttribute('d', icon || '');
  status.querySelector('svg').toggleAttribute('hidden', !icon);
}

function openShare() {
  const card = $('shareArt');
  const context = card.getContext('2d');
  context.setTransform(3, 0, 0, 3, 0, 0);
  rect(context, 0, 0, 240, 168, 0, '#36263e');
  rect(context, 6, 6, 228, 156, 14, '#51364d', '#e2ab83', 2);
  rect(context, 13, 13, 214, 142, 10, null, '#ae7985');
  const title = `${t('title')} · ${t(hard ? 'hardDaily' : 'daily')}`;
  text(context, title, 120, 31, 20, CREAM, 'Georgia');
  star(context, 51, 68, 6, GOLD);
  star(context, 189, 62, 4, GOLD);
  rect(context, 94, 47, 52, 44, 10, '#ead2b5', '#a6737a', 1.7);
  eventIcon(context, 120, 69, 42, c.crime, false);
  for (const i of [0, 1, 2]) star(context, 93 + i * 27, 108, 10, i < run.stars ? GOLD : '#6c4a63', '#e7ac89');
  const date = dateLabel(day);
  const time = clockLabel(solvedSeconds);
  text(context, date, 120, 132, 14, CREAM, 'Georgia');
  text(context, time, 120, 146, 12, CREAM, 'Georgia');
  card.setAttribute('aria-label', t('shareCardLabel', {
    title, date, time, stars: t(run.stars === 1 ? 'oneStar' : 'manyStars', { n: number(run.stars) }),
  }));
  shareFile = null;
  showShareStatus();
  $('sendShare').disabled = true;
  card.toBlob(blob => {
    if (blob) shareFile = new File([blob], shareFilename(), { type: 'image/png' });
    $('sendShare').textContent = t(canShareImage() ? 'shareImage' : 'saveImage');
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
      showShareStatus('imageShared', 'm4 12 5 5 11-11');
      return;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      showShareStatus('shareCanceled', 'm7 7 10 10m0-10L7 17');
      return;
    }
  }
  const link = document.createElement('a');
  link.href = $('shareArt').toDataURL('image/png');
  link.download = shareFilename();
  link.click();
  showShareStatus('downloadStarted', 'M12 4v10m-4-4 4 4 4-4M5 15v5h14v-5');
}

function cssPoint(p) {
  const box = canvas.getBoundingClientRect();
  return { x: box.left + originX + scale * p.x, y: box.top + originY + scale * p.y };
}

window.alibiState = () => ({
  screen, paused: screen === 'paused', level: c.level, daily, hard, day, time, frame: beatNow(), stars: run.stars,
  selected, outcome: run.outcome, variant, lossReveal: screen === 'done' && lossReveal ? c.culprit : null, streak: profile.daily.streak, hardStreak: profile.hardDaily.streak,
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
    loupe: loupe ? loupeMarks().map(mark => ({ beat: mark.beat, ...cssPoint(mark), w: LOUPE.w * scale, h: LOUPE.h * scale })) : null,
    claim: selected === null ? [] : claims(cast[selected]).map(mark => ({ beat: mark.beat, room: mark.room, ...cssPoint(claimPoint(cast[selected], mark)) })),
    signs: rooms.map(room => ({ ...cssPoint({ x: room.x + SIGN.x, y: room.y + SIGN.y }), size: SIGN.size * scale })),
  },
  loupeOpen: Boolean(loupe), trailBack, step,
});

let last = performance.now();
function animate(now) {
  const dt = Math.min(.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (!document.hidden && screen !== 'paused' && screen !== 'done' && screen !== 'sharing') phase += dt;
  if (playing() && pointer?.type === 'suspect' && !c.practice && phase - pointer.at >= HOLD) {
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
  updateCoach();
  draw();
  requestAnimationFrame(animate);
}

// A reload can resume this tab. Durable progress stays in the original local save.
addEventListener('pagehide', () => {
  try {
    if (c.practice || !playing() && screen !== 'paused') {
      sessionStorage.removeItem(KEY);
      return;
    }
    sessionStorage.setItem(KEY, JSON.stringify({
      version: 1,
      seed, level: c.level, variant, daily, hard, day, frame: beatNow(), selected, rejected: run.rejected,
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
  // Checkpoints from before retry variants have none: the case itself.
  const savedVariant = saved.daily ? 0 : saved.variant ?? 0;
  if (!validTime(savedVariant)) return;
  const next = saved.daily ? dailyCase(saved.day, saved.hard) : caseVariant(saved.level, savedVariant, seed);
  const index = (value, limit) => Number.isInteger(value) && value >= 0 && value < limit;
  const suspect = id => index(id, next.cast.length);
  const mark = beat => index(beat, next.beatCount);
  if (!mark(saved.frame) || (saved.selected !== null && !suspect(saved.selected))
    // A checkpoint from an older build may have rejected the current liar.
    || !Array.isArray(saved.rejected) || saved.rejected.length >= 3 || !saved.rejected.every(suspect)
    || saved.rejected.includes(next.culprit)
    || !Array.isArray(saved.notes) || saved.notes.length > 3 || !saved.notes.every(note =>
      note && suspect(note.id) && mark(note.beat) && index(note.room, next.spec.rooms))
    || !Array.isArray(saved.seen) || !saved.seen.every(suspect)
    || !Array.isArray(saved.scrolled) || !saved.scrolled.every(mark)
    || !Number.isFinite(saved.elapsed) || saved.elapsed < 0) return;
  start(saved.daily, saved.level, saved.hard, saved.day, { case: next, variant: savedVariant });
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
