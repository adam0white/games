// Fix-It Stall: the page. View, input, sound, save, cards. The rules are in sim.js.
import { create, step, input, guide, hint, multiplier, goalState, stars, selectLane, chooseTicket, lampAt, DAY, RAMP, DT, KINDS, TUTOR, OBJECT, HIT, zipStuck, WORKS, LEAVE, LEVELS } from './sim.js';
import { COUNT, ORDER, OPEN_ORDER, INTRO, BUSY_END, CHAPTERS, ASSIST_RATE, STAR_BONUS, canAssist, levelDef, goalLine, levelReward, resultSeconds } from './levels.js';
import { plan, SKILLS } from './moves.js';
import { drawJob, drawGhost, person, looks, REGULAR, cat, heart, coin, sillyList, drawSilly, goalIcon, symbol, starShape, C, circle, rrect, star } from './art.js';
import { readJson, writeJson } from '../kit/save.js';
import { sound } from '../kit/audio.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { hint as kitHint } from '../kit/hint.js';
import { noZoom } from '../kit/zoom.js';
import { lab } from '../kit/lab.js';
import { t as translate, lang, apply, setLang, num, seconds, starsLabel, dateLabel } from './words.js';

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
// ORDER (levels.js) is the order new jobs come: one per level on the map, and the open stall's unlock order.
noZoom();
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- the save: one JSON blob. Fields are listed in NOTES.md and only ever grow.
const KEY = 'fixit-save';
const save = { v: 1, bank: 0, best: 0, shifts: 0, unlocked: TUTOR.slice(), seen: {}, owned: ['teal'], awning: 'teal', sound: true, regular: 0, pending: null, bestStreak: 0, served: 0, days: {}, levels: {}, times: {}, attempts: {}, assists: {} };
let migrated = 0; // levels given to an old save this load (shown once on the menu)
{
  const old = readJson(KEY, null);
  if (old && typeof old === 'object') for (const k of Object.keys(save)) if (k in old && typeof old[k] === typeof save[k]) save[k] = old[k];
  if (old && typeof old.pending === 'string') save.pending = old.pending; // pending starts as null, so the type test above skips it
  for (const k of ['bank', 'best', 'shifts', 'regular', 'bestStreak', 'served']) if (!Number.isFinite(save[k]) || save[k] < 0) save[k] = 0;
  save.unlocked = OPEN_ORDER.filter(k => Array.isArray(save.unlocked) && save.unlocked.includes(k));
  for (const k of TUTOR) if (!save.unlocked.includes(k)) save.unlocked.push(k);
  if (!Array.isArray(save.owned)) save.owned = ['teal'];
  if (!save.owned.includes('teal')) save.owned.push('teal');
  if (save.pending !== null && !KINDS.includes(save.pending)) save.pending = null;
  if (!save.seen || typeof save.seen !== 'object' || Array.isArray(save.seen)) save.seen = {};
  // days: the best daily-stall coins for each UTC date, newest 30 kept
  const days = save.days && typeof save.days === 'object' && !Array.isArray(save.days) ? save.days : {};
  save.days = Object.fromEntries(Object.entries(days).filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(v) && v >= 0).sort().slice(-30));
  // levels: best stars (1..3) per cleared map level; times: best clear seconds per level. Anything else is dropped.
  const plain = o => o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  save.levels = Object.fromEntries(Object.entries(plain(save.levels)).filter(([n, v]) => levelDef(+n) && [1, 2, 3].includes(v)));
  save.times = Object.fromEntries(Object.entries(plain(save.times)).filter(([n, v]) => save.levels[n] && Number.isFinite(v) && v > 0));
  for (const key of ['attempts', 'assists']) {
    save[key] = Object.fromEntries(Object.entries(plain(save[key])).filter(([n, v]) => levelDef(+n) && Number.isSafeInteger(v) && v > 0));
  }
  // A save from before the map (it has no levels field) that shows play starts past the levels that only teach jobs it
  // already has: the longest run of levels from 1 whose new job is in its unlocked list, each with one star. Once.
  if (old && typeof old === 'object' && !('levels' in old) && (old.shifts > 0 || old.served > 0 || (Array.isArray(old.unlocked) && old.unlocked.length > TUTOR.length))) {
    for (let n = 1; n <= INTRO && save.unlocked.includes(ORDER[n - 1]); n++) { save.levels[n] = 1; migrated = n; }
    writeJson(KEY, save);
  }
  for (const n of Object.keys(save.levels)) {
    const kind = levelDef(+n).intro;
    if (kind && !save.unlocked.includes(kind)) save.unlocked.push(kind);
  }
}
const store = () => writeJson(KEY, save);

// ---------- the shop
const AWNING = { teal: ['#2f8f8a', '#fff1d6'], copper: ['#c8743a', '#fbe6c2'], berry: ['#a8325a', '#f7c9d6'], stripes: ['#e0a43a', '#2f8f8a'] };
const ITEMS = [
  { id: 'teal', cost: 0, awning: true },
  { id: 'copper', cost: 50, awning: true },
  { id: 'berry', cost: 90, awning: true },
  { id: 'lights', cost: 140 },
  { id: 'radio', cost: 180 },
  { id: 'stripes', cost: 220, awning: true },
  { id: 'cat', cost: 280 },
  { id: 'charm', cost: 400 },
];
const has = id => save.owned.includes(id);

// ---------- canvas and layout (CSS pixels)
const cv = $('c'), g = cv.getContext('2d');
let benchControls = false;
let W = 0, H = 0, dpr = 1, top = 0, bottomInset = 0, benchTop = 0, S = 300, boxX = 0, boxY = 0, unit = 3;
function layout() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const cs = getComputedStyle($('probe'));
  top = parseFloat(cs.paddingTop) || 0; bottomInset = parseFloat(cs.paddingBottom) || 0;
  benchTop = top + Math.min(200, Math.max(160, H * 0.3));
  const avail = H - benchTop - 36 - bottomInset, cueSpace = benchControls ? 88 : 40;
  $('tickets').style.top = `${benchTop + 4}px`;
  S = Math.max(200, Math.min(W - 20, avail - cueSpace, 560));
  boxX = (W - S) / 2; boxY = benchTop + cueSpace + Math.max(0, (avail - cueSpace - S) / 2); unit = S / 100;
  if (!$('startLevel').hidden) positionStart();
}
addEventListener('resize', layout); layout();

// ---------- sound: everything synthesized through the kit
const snd = sound({ on: () => save.sound });
const tone = (f, d, v, type = 'sine', slide = 0) => { if (snd.ctx) snd.tone(f, d, v, type, slide); };
const noise = (d, v, hz) => { if (snd.ctx) snd.noise(d, v, hz); };
const later = (ms, fn) => setTimeout(() => { if (!paused) fn(); }, ms);
const WORKS_SOUND = {
  bell: () => { tone(880, 1.1, 0.13); tone(880 * 2.76, 0.7, 0.05); tone(880 * 5.4, 0.35, 0.03); },
  'music box': () => [1047, 1319, 1568].forEach((f, i) => later(i * 150, () => { tone(f, 0.5, 0.1, 'triangle'); tone(f * 2, 0.2, 0.03); })),
  kettle: () => { tone(1700, 0.7, 0.05, 'sine', 500); noise(0.5, 0.05, 5000); },
  wheel: () => { noise(0.4, 0.12, 700); tone(300, 0.45, 0.06, 'triangle', 500); },
  lamp: () => { tone(110, 0.5, 0.05, 'sawtooth'); tone(1320, 0.4, 0.06); later(90, () => tone(1760, 0.4, 0.05)); },
  clock: () => [0, 1, 2, 3].forEach(i => later(i * 140, () => tone(i % 2 ? 1250 : 1650, 0.04, 0.1, 'square'))),
  bike: () => { tone(1760, 0.3, 0.08); later(160, () => tone(1760, 0.4, 0.08)); },
  vase: () => [784, 988, 1175].forEach((f, i) => later(i * 90, () => tone(f, 0.45, 0.08, 'triangle'))),
  knife: () => { noise(0.3, 0.12, 7000); tone(2600, 0.45, 0.05, 'sine', 800); },
  teddy: () => { tone(392, 0.5, 0.07, 'triangle', 200); later(140, () => tone(587, 0.4, 0.06, 'triangle')); },
  ball: () => [0, 1, 2].forEach(i => later(i * 170 * (1 - i * 0.2), () => { tone(180, 0.1, 0.12, 'sine', -80); noise(0.05, 0.08, 900); })),
  door: () => { tone(220, 0.5, 0.05, 'triangle', -40); later(380, () => { noise(0.08, 0.2, 500); tone(110, 0.15, 0.1, 'sine'); }); },
  jacket: () => { noise(0.25, 0.08, 3000); later(200, () => tone(988, 0.2, 0.06, 'triangle')); },
  'toy car': () => { tone(400, 0.6, 0.06, 'sawtooth', 900); noise(0.4, 0.05, 2500); },
  needle: () => [1319, 1760].forEach((f, i) => later(i * 120, () => tone(f, 0.3, 0.06, 'triangle'))),
};
const shimmer = () => [1568, 2093, 2637, 3136].forEach((f, i) => later(i * 60, () => tone(f, 0.3, 0.04, 'triangle')));
// A short buzz on phones that have one, tied to the sound setting.
const buzz = ms => { if (save.sound && navigator.vibrate) try { navigator.vibrate(ms); } catch {} };

// ---------- run state
let s = null, playing = false, paused = false, screen = 'menu', acc = 0, last = performance.now(), clock = 0;
let finger = null; // { id } of the pointer driving the bench
let ripples = [], bits = [], flying = [], confetti = [], multPop = 0, kb = null, prev = null, drawn = [], shownCoins = 0, feedback = null, banner = null, shake = 0, squash = 0, wobble = 0, pop = 1;
let seenBase = 0, jobKey = null, leaving = [], spots = new Map(), heartFlash = 0, catHappy = 0, recCount = 0, multWas = 1, radioT = 0, newJob = null, hintNow = 0, ended = 0;
let counterReset = () => { counter = null; };
const seed0 = Number(query.get('seed'));
const only = KINDS.includes(query.get('only')) ? query.get('only') : null;
const twoQ = query.has('two') ? Number(query.get('two')) : null;
const dayLen = Number(query.get('day')) > 0 ? Number(query.get('day')) : undefined;
const startLevel = Math.max(0, Math.min(LEVELS - 1, Number(query.get('ramp')) || 0)); // the open stall's starting pace
const qLevel = levelDef(Number(query.get('level'))) ? Number(query.get('level')) : null; // ?level=N: Play starts map level N
let runN = 0;
const goldenQ = query.get('golden') === '1';
// The daily stall: one seed for everyone on the same UTC date (?date=YYYY-MM-DD to pick another day).
const today = /^\d{4}-\d{2}-\d{2}$/.test(query.get('date') ?? '') ? query.get('date') : new Date().toISOString().slice(0, 10);
const dateSeed = d => { let h = 2166136261; for (const ch of 'fixit-daily-' + d) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
let daily = false;
// ---------- the map: levels.js holds the levels; the save holds the stars
let mode = 'level', lvN = 1, card = 0, cardFade = 0;
const OPEN_AT = 8, DAILY_AT = 3; // the open stall opens after level 8, the daily stall after level 3 (or any old shift)
const cleared = n => (save.levels[n] ?? 0) > 0;
const reachable = n => n === 1 || cleared(n) || cleared(n - 1);
const nextLevel = () => { for (let n = 1; n <= COUNT; n++) if (!cleared(n)) return n; for (let n = 1; n <= COUNT; n++) if (save.levels[n] < 3) return n; return COUNT; };
const starTotal = () => Object.values(save.levels).reduce((a, b) => a + b, 0);
const MILESTONES = [['shelf', 6], ['sign', 20], ['lights', 40], ['cat', 66]];
const stallGrowth = (total = starTotal()) => MILESTONES.filter(([, need]) => total >= need).map(([id]) => id);
const openStall = () => cleared(OPEN_AT) || save.shifts >= 1;
const dailyOpen = () => cleared(DAILY_AT) || save.shifts >= 1;

const count = (have, need) => `${num(have)}/${num(need)}`;
function metric(kind, value, label) {
  const span = document.createElement('span');
  span.className = 'metric';
  const pic = document.createElement('canvas');
  pic.width = pic.height = 46;
  pic.setAttribute('aria-hidden', 'true');
  objectiveIcon(kind, 23, 23, 17, 0, pic.getContext('2d'));
  if (label) { span.setAttribute('role', 'img'); span.setAttribute('aria-label', label); }
  const text = document.createElement('b');
  text.textContent = value;
  span.append(pic, text);
  return span;
}
function goalShape(def, deadline = def.goal.time) {
  const goal = def.goal;
  const parts = goalState({ lv: def, served: 0, goalCoins: 0 }).parts;
  const labels = parts.map(({ kind, need }) => translate(`${kind === 'coins' ? 'base' : kind}Goal`, { n: num(need) }));
  if (deadline) labels.push(translate('timeGoal', { n: num(deadline) }));
  if (goal.safe || goal.list) labels.push(translate('safeGoal'));
  return { parts, deadline, safe: !!(goal.safe || goal.list), label: labels.join(' ') };
}
const goalKind = { coins: 'basePay', list: 'fixed', fix: 'fixed', order: 'fixed', rush: 'fixed', blackout: 'fixed', boss: 'fixed' };
const startControl = () => {
  const visible = screen === 'play' && playing && !!card;
  $('startLevel').hidden = $('briefText').hidden = !visible;
  if (visible) {
    positionStart();
    const target = s.assisted ? 2 : 3;
    $('briefText').textContent = [
      translate('level', { n: num(lvN) }),
      s.assisted ? translate('assistLevel', { n: num(lvN) }) : '',
      s.lv.intro && !cleared(lvN) ? translate('newRepair', { object: translate(s.lv.intro) }) : '',
      goalShape(s.lv, s.deadline ? Math.ceil(s.deadline) : undefined).label,
      translate('starTarget', { stars: starsLabel(target), time: seconds(s.lv.stars[3 - target]) }),
    ].filter(Boolean).join(' ');
  }
};
const show = screens(['menu', 'shop', 'paused', 'end'], name => {
  screen = name;
  $('pause').style.display = name === 'play' ? 'grid' : 'none';
  if (name === 'menu') { mapChapter = null; menu(); }
  $('tickets').hidden = name !== 'play' || !benchControls || !!card;
  if (name === 'shop') shop();
  updateSound();
  startControl();
  updateBenchLabel();
});
function updateSound() {
  for (const id of ['sound1', 'sound2']) $(id).textContent = translate(save.sound ? 'soundOn' : 'soundOff');
}
let menuHelp = null, mapChapter = null;
function menu() {
  $('bank').textContent = num(save.bank); $('starsAll').textContent = num(starTotal()); $('starsMax').textContent = num(COUNT * 3);
  $('jobs').textContent = num(save.unlocked.length); $('jobsAll').textContent = num(KINDS.length);
  const next = MILESTONES.find(([, need]) => starTotal() < need);
  $('growth').hidden = !next;
  if (next) {
    const [id, need] = next;
    $('growth').replaceChildren(metric(id, num(need) + ' ★', translate('milestone', { item: translate(id), n: num(need) })));
  }
  const n = only ? null : qLevel ?? nextLevel();
  $('play').textContent = n ? translate('playLevel', { n: num(n) }) : translate('play');
  updateRecording();
  menuHelp = n && (canAssist(save.attempts[n]) ? n
    : Object.keys(save.attempts).map(Number).find(i => reachable(i) && canAssist(save.attempts[i])));
  $('menuAssist').hidden = !menuHelp;
  if (menuHelp) {
    const label = translate('assistLevel', { n: num(menuHelp) });
    $('menuAssist').setAttribute('aria-label', label);
    $('menuAssist').title = label;
    $('assistLevel').textContent = menuHelp === n ? '' : translate('level', { n: num(menuHelp) });
  }
  map(n);
  $('migrated').hidden = !migrated;
  $('migrated').textContent = migrated ? translate('migrated', { n: num(migrated) }) : '';
  const shiftSeconds = Math.max(0, (dayLen ?? DAY) - startLevel * RAMP);
  shiftMenu('open', openStall(), OPEN_AT, save.best, shiftSeconds);
  shiftMenu('daily', dailyOpen(), DAILY_AT, save.days[today], shiftSeconds);
}
function shiftMenu(id, unlocked, required, best, duration) {
  $(id).hidden = !unlocked;
  const line = $(id + 'Line'), modeName = translate(id), time = seconds(duration);
  if (!unlocked) {
    const lock = metric('lock', num(required) + ' ✓', translate('modeLocked', { mode: modeName, n: num(required) }));
    line.replaceChildren(modeName, ' ', lock);
    return;
  }
  const description = translate('shiftDetails', { mode: modeName, time });
  line.replaceChildren(metric('time', time, description), ' → ', metric('coins', '', translate('coins')));
  const summary = document.createElement('span');
  summary.className = 'mode-summary';
  if (best !== undefined) summary.textContent = translate('best') + ' ' + num(best);
  else if (id === 'daily') summary.textContent = translate('sameJobs');
  line.append(summary);
}
// The map opens to the next chapter and keeps the three chapters one tap away.
function map(next) {
  const box = $('map'), tabs = $('chapterTabs'), grids = [], buttons = [];
  box.replaceChildren(); tabs.replaceChildren();
  const showChapter = current => {
    grids.forEach((grid, i) => { grid.hidden = i !== current; });
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === current)));
    mapChapter = current;
    const [first, last, title] = CHAPTERS[current];
    const locked = !grids[current].querySelector('button:enabled');
    const line = $('playLine');
    line.replaceChildren();
    if (locked) line.textContent = translate('chapterLocked', { n: num(first - 1), chapter: translate(title) });
    else if (next >= first && next <= last) {
      const { parts, deadline, label } = goalShape(levelDef(next));
      const group = document.createElement('span');
      group.setAttribute('role', 'img');
      group.setAttribute('aria-label', label);
      for (const { kind, need } of parts) group.append(metric(kind, num(need)));
      if (deadline) group.append(metric('time', seconds(deadline)));
      line.append(group);
    }
  };
  for (const [i, [a, b, title]] of CHAPTERS.entries()) {
    const tab = document.createElement('button');
    tab.textContent = translate(title);
    tab.addEventListener('click', () => showChapter(i));
    tabs.append(tab);
    buttons.push(tab);
    const grid = document.createElement('div'); grid.className = 'grid' + (a > BUSY_END ? ' night' : a > 1 ? ' late' : '');
    for (let n = a; n <= b; n++) {
      const t = document.createElement('button'), st = save.levels[n] ?? 0, open = reachable(n);
      t.className = 'lv' + (n === next ? ' next' : '') + (st ? ' done' : '');
      t.dataset.level = n; t.disabled = !open;
      t.setAttribute('aria-label', translateTile(n, open, st));
      const number = document.createElement('span'); number.textContent = num(n);
      const ss = document.createElement('span'); ss.className = 'ss'; ss.textContent = '★'.repeat(st);
      t.append(number, ss);
      t.addEventListener('click', () => begin('level', n));
      grid.append(t);
    }
    box.append(grid);
    grids.push(grid);
  }
  showChapter(mapChapter ?? Math.max(0, CHAPTERS.findIndex(([a, b]) => next >= a && next <= b)));
}

function translateTile(n, open, st) {
  return translate(open ? 'levelRated' : 'levelLocked', { n: num(n), stars: starsLabel(st) });
}

function shop() {
  $('bank2').textContent = num(save.bank);
  const box = $('items'); box.textContent = '';
  for (const it of ITEMS) {
    const row = document.createElement('div'); row.className = 'item';
    const pic = document.createElement('canvas'); pic.width = pic.height = 96; icon(pic.getContext('2d'), it.id);
    const txt = document.createElement('div'); txt.textContent = translate(it.id);
    if (it.id === 'radio' || it.id === 'charm') {
      const sm = document.createElement('small');
      const label = translate(it.id === 'charm' ? 'extraHeart' : 'radioTune');
      sm.append(it.id === 'charm' ? metric('safe', '+ ' + num(1), label) : metric('music', '', label));
      txt.append(sm);
    }
    const b = document.createElement('button'); b.dataset.item = it.id;
    if (!has(it.id)) { b.textContent = translate('buy', { n: num(it.cost) }); b.disabled = save.bank < it.cost; }
    else if (it.awning) { b.textContent = translate(save.awning === it.id ? 'inUse' : 'use'); if (save.awning === it.id) b.classList.add('on'); }
    else { b.textContent = translate('owned'); b.classList.add('on'); b.disabled = true; }
    b.addEventListener('click', () => {
      snd.unlock();
      if (!has(it.id)) {
        if (save.bank < it.cost) return;
        save.bank -= it.cost; save.owned.push(it.id); if (it.awning) save.awning = it.id; store();
        rec.event('buy', { item: it.id });
        [784, 988, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.25, 0.08, 'triangle'), i * 90));
      } else if (it.awning) { save.awning = it.id; store(); tone(660, 0.12, 0.06, 'triangle'); }
      shop();
    });
    row.append(pic, txt, b); box.append(row);
  }
}
function icon(q, id) {
  q.scale(2, 2);
  if (AWNING[id]) { const [a, b] = AWNING[id]; for (let i = 0; i < 4; i++) { q.fillStyle = i % 2 ? b : a; q.fillRect(i * 12, 6, 12, 24); q.beginPath(); q.arc(i * 12 + 6, 30, 6, 0, Math.PI); q.fill(); } q.strokeStyle = C.ink; q.lineWidth = 2; q.strokeRect(0, 6, 48, 24); return; }
  if (id === 'lights') { q.strokeStyle = C.ink; q.lineWidth = 1.5; q.beginPath(); q.moveTo(2, 12); q.quadraticCurveTo(24, 26, 46, 12); q.stroke(); for (let i = 0; i < 4; i++) circle(q, 8 + i * 11, 16 + (i === 1 || i === 2 ? 4 : 0), 4, [C.amber, C.red, C.tealLt, C.glow][i], 1.4); return; }
  if (id === 'radio') { rrect(q, 6, 16, 36, 24, 5, C.copper, 2); circle(q, 18, 28, 7, C.cream, 1.6); rrect(q, 28, 22, 10, 4, 1, C.ink, 0); rrect(q, 28, 30, 10, 4, 1, C.ink, 0); q.strokeStyle = C.ink; q.lineWidth = 2; q.beginPath(); q.moveTo(12, 16); q.lineTo(30, 4); q.stroke(); return; }
  if (id === 'cat') { cat(q, 24, 40, 0.85, 1, false); return; }
  if (id === 'charm') { q.strokeStyle = C.ink; q.lineWidth = 9; q.lineCap = 'round'; q.beginPath(); q.arc(24, 22, 12, Math.PI * 0.85, Math.PI * 2.15, true); q.stroke(); q.strokeStyle = C.steel; q.lineWidth = 5.5; q.stroke(); return; }
}

// ---------- a level, or a shift of the open stall or the daily stall
const runMetadata = () => mode === 'level' ? { mode: 'level', level: lvN, goal: goalLine(s.lv.goal) } : daily ? { mode: 'daily', date: today } : { mode: 'day', unlocked: save.unlocked.length, shift: save.shifts + 1, only };
function begin(how = 'level', n = null, assisted = false) {
  snd.unlock();
  mode = only ? 'open' : how; daily = mode === 'daily';
  const hearts = daily ? 3 : 3 + (has('charm') ? 1 : 0);
  card = 0; cardFade = 0;
  if (mode === 'level') {
    lvN = n ?? nextLevel();
    s = create({ lv: levelDef(lvN), hearts, assisted: assisted && canAssist(save.attempts[lvN]) });
    card = 1;
    newJob = null;
  } else {
    newJob = !only && !daily && save.pending && save.unlocked.includes(save.pending) ? save.pending : null;
    const seed = daily ? dateSeed(today) : Number.isFinite(seed0) && query.has('seed') ? seed0 + runN : (Math.random() * 2 ** 31) | 0;
    runN++;
    const gold = goldenQ ? { golden: 1, goldenFrom: 0 } : {};
    s = daily
      ? create({ seed, unlocked: KINDS, hearts, two: true, day: dayLen, startLevel, ...gold })
      : create({ seed, unlocked: save.unlocked, tutorial: false, hearts, newJob, only, regular: !only ? save.regular : -1, two: twoQ !== null ? twoQ : !only, day: dayLen, startLevel, ...gold });
    if (newJob) { save.pending = null; store(); }
  }
  benchControls = ['order', 'rush', 'boss'].includes(s.lv?.rule);
  ticketKey = '';
  layout();
  playing = true; paused = false; acc = 0; last = performance.now(); clock = 0; ended = 0;
  ripples = []; bits = []; flying = []; confetti = []; shownCoins = 0; leaving = []; spots = new Map(); feedback = null; banner = null; recCount = 0; multWas = 1; multPop = 0; finger = null; kb = null; jobKey = null; prev = null; counterReset();
  show('play');
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); // so Space drives the bench, not the last button
  rec.start(runMetadata());
  if (s.assisted) {
    save.assists[lvN] = (save.assists[lvN] ?? 0) + 1;
    store();
    rec.event('assist', { level: lvN, kind: 'slowClock' });
  }
  drain();
}
// In the open stall, four fixed in a shift earns the next job, whether the shift ends or the player leaves it (note #150).
function earnJob() {
  if (mode !== 'open' || only || s.served < 4) return null;
  const job = OPEN_ORDER.find(k => !save.unlocked.includes(k)) ?? null;
  if (job) { save.unlocked.push(job); save.pending = job; }
  return job;
}
const summary = () => ({ coins: s.coins, served: s.served, lost: s.lost, bestStreak: s.bestStreak, ...(mode === 'level' ? { mode: 'level', level: lvN, cleared: s.cleared, stars: stars(s), secs: Math.round(s.clock * 10) / 10, assisted: s.assisted } : {}) });
function finish() {
  playing = false; ended = performance.now();
  if (mode === 'level') return finishLevel();
  const why = s.over;
  // Completed open-stall shifts also preserve access for players from before the map.
  if (!daily) save.shifts++;
  save.bank += s.coins; save.served += s.served;
  const newBest = !daily && s.coins > save.best; if (!daily) save.best = Math.max(save.best, s.coins); // the daily stall keeps its own best per day
  save.bestStreak = Math.max(save.bestStreak, s.bestStreak);
  let unlocked = null, dayBest = false;
  if (daily) { dayBest = !(today in save.days) || s.coins > save.days[today]; save.days[today] = Math.max(save.days[today] ?? 0, s.coins); save.days = Object.fromEntries(Object.entries(save.days).sort().slice(-30)); }
  unlocked = earnJob();
  store();
  rec.end('closed', { ...summary(), why, ...(daily ? { daily: today } : {}) });
  const title = daily ? (why === 'hearts' ? 'dailyHearts' : 'dailyClosed') : why === 'hearts' ? 'outOfHearts' : 'closed';
  const line = daily ? [translate('dailyBest') + ' ', metric('coins', num(save.days[today]))]
    : [metric('coins', num(save.bank), translate('coinCount', { n: num(save.bank) }))];
  const note = daily ? [] : unlocked ? [jobMetric(unlocked, translate('newJobNextShift', { object: translate(unlocked) }))]
    : save.unlocked.length < KINDS.length && s.served < 4 ? [metric('fix', count(s.served, 4), translate('unlockJob')), ' → ', metric('new', '', translate('jobsUnlocked'))] : [];
  endCard({ title: translate(title), stars: null, coins: daily ? 0 : s.coins,
    stats: daily ? [] : [['fixed', num(s.served)], ['bestStreak', num(s.bestStreak)], ['best', num(save.best)]],
    line, note: (daily ? dayBest : newBest) && s.coins > 0 ? [metric('trophy', '', translate('newBest')), ...note] : note,
    again: daily ? 'dailyAgain' : 'again', next: false });
  if (newBest && s.coins > 0) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.4, 0.09, 'triangle'), i * 120));
  else [523, 392].forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.08, 'triangle'), i * 160));
  if (daily) dailyCard();
  setTimeout(() => { if (!playing && screen === 'play') show('end'); }, 700);
}
// A level pays its repair coins on the first clear, plus a bonus for every new star.
function finishLevel() {
  const why = s.over, n = lvN, def = s.lv, st = stars(s), was = save.levels[n] ?? 0, secs = resultSeconds(s.clearT ?? s.clock);
  const bonus = Math.max(0, st - was) * STAR_BONUS, bestWas = save.times[n];
  const reward = levelReward(s.coins, st, was), beforeGrowth = stallGrowth();
  save.bank += reward; save.served += s.served; save.bestStreak = Math.max(save.bestStreak, s.bestStreak);
  const opened = st && !was && n === OPEN_AT, dailyNow = st && !was && n === DAILY_AT && save.shifts < 1;
  if (st) {
    delete save.attempts[n];
    save.levels[n] = Math.max(was, st);
    if (!s.assisted) save.times[n] = Math.min(bestWas ?? Infinity, secs);
    if (def.intro && !save.unlocked.includes(def.intro)) save.unlocked.push(def.intro); // the job a level taught is the open stall's too
  } else {
    save.attempts[n] = Math.min(2, (save.attempts[n] ?? 0) + 1);
  }
  store();
  rec.end('closed', { ...summary(), why, bonus, reward });
  const added = MILESTONES.filter(([id]) => !beforeGrowth.includes(id) && stallGrowth().includes(id));
  const upNext = levelDef(n + 1);
  if (st) {
    const line = [];
    if (bonus) line.push(metric('star', '→ +' + num(bonus), translate('starBonus', { coins: translate('coinCount', { n: num(bonus) }) })));
    if (s.assisted) line.push(starTarget(2, null, translate('starCap')));
    else if (st < 3) line.push(starTarget(3, def.stars[0]));
    const note = added.length ? added.map(([id]) => metric(id, '', translate('unlockedItem', { item: translate(id) })))
      : opened || dailyNow ? [translate('unlockedMode', { mode: translate(opened ? 'open' : 'daily') })]
      : upNext?.intro && !cleared(upNext.n) ? [jobMetric(upNext.intro, translate('newRepair', { object: translate(upNext.intro) }))]
      : !upNext ? [translate('allCleared')] : nextMilestone();
    endCard({ title: translate('cleared', { n: num(n) }), stars: st, coins: reward,
      stats: [['time', seconds(secs)], ...(save.times[n] ? [['best', seconds(resultSeconds(save.times[n]))]] : []), ['fixed', num(s.served)]],
      line, note, again: 'retry', next: !!upNext });
    [523, 659, 784, 1047].slice(0, 1 + st).forEach((f, i) => setTimeout(() => tone(f, 0.4, 0.09, 'triangle'), 300 + i * 160));
  } else {
    const gs = goalState(s);
    endCard({ title: translate(why === 'time' ? 'outOfTime' : why === 'hearts' ? 'outOfHearts' : 'walkOff'), stars: 0, coins: 0,
      stats: gs.parts.map(p => [goalKind[p.kind], count(Math.min(p.have, p.need), p.need)]).concat([['time', seconds(secs)]]),
      line: gs.safe ? [translate('safeGoal')] : [],
      note: [], again: 'retry', next: false, offer: canAssist(save.attempts[n]) });
    [523, 392].forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.08, 'triangle'), i * 160));
  }
  setTimeout(() => { if (!playing && screen === 'play') show('end'); }, 900);
}
// Between new repairs, the results card shows the next thing the stall is saving stars for.
function nextMilestone() {
  const total = starTotal(), next = MILESTONES.find(([, need]) => total < need);
  if (!next) return [];
  const [id, need] = next;
  return [metric(id, num(total) + '/' + num(need) + ' ★', translate('milestoneLeft', { item: translate(id), n: num(need - total) }))];
}
function starTarget(target, time, label = translate('starTarget', { stars: starsLabel(target), time: seconds(time) })) {
  const span = document.createElement('span');
  span.className = 'metric';
  span.setAttribute('role', 'img');
  span.setAttribute('aria-label', label);
  const rating = document.createElement('span');
  rating.className = 'st';
  rating.textContent = '★'.repeat(target);
  span.append(rating, time === null ? '☆' : ' ≤ ' + seconds(time));
  return span;
}
function jobMetric(kind, label) {
  const span = document.createElement('span');
  span.className = 'metric';
  span.setAttribute('role', 'img');
  span.setAttribute('aria-label', label);
  const pic = document.createElement('canvas'); pic.className = 'job-icon';
  pic.width = pic.height = 100;
  drawJob(pic.getContext('2d'), [previewRepair(kind)], 0, 0, 0);
  span.append(metric('new', ''), pic);
  return span;
}
const previews = new Map();
function previewRepair(kind) {
  if (!previews.has(kind)) previews.set(kind, create({ only: kind, seed: 1 }).rep);
  return previews.get(kind);
}
// The end card, for a level or a shift.
function endCard({ title, stars: st, coins, stats, line, note, again, next, offer = false }) {
  $('helpRow').hidden = !offer;
  $('dailyResult').hidden = true;
  $('shareStatus').textContent = '';
  $('earnedLine').hidden = coins === 0;
  $('endTitle').textContent = title;
  $('endStars').style.display = st === null ? 'none' : '';
  $('endStars').textContent = st === null ? '' : '★'.repeat(st) + '☆'.repeat(3 - st);
  $('endStars').setAttribute('aria-label', starsLabel(st ?? 0));
  $('endStars').className = 'stars' + (st ? '' : ' none');
  $('earned').textContent = num(coins);
  const box = $('endStats'); box.textContent = '';
  for (const [k, v] of stats) { const sp = document.createElement('span'); const b = document.createElement('b'); b.textContent = v; sp.append(translate(k), ' ', b); box.append(sp); }
  $('endLine').replaceChildren(...line); $('endLine').hidden = !line.length;
  $('newjob').replaceChildren(...note); $('newjob').hidden = !note.length;
  $('again').textContent = translate(again); $('next').style.display = next ? '' : 'none';
  $('again').className = next ? '' : 'main';
}
function quit() {
  if (!s || !playing) { show('menu'); return; }
  rec.end('left', { ...summary(), why: 'menu' });
  if (mode !== 'level') save.bank += s.coins;
  save.served += s.served; earnJob(); store();
  playing = false; paused = false; card = 0; snd.release(); show('menu');
}

// Teach the ticket rules by pointing: a picky customer's next ticket glows as soon as the choice opens, and in a rush
// the other customer's ticket glows once that customer will run out of patience first.
function promptTicket() {
  const box = $('tickets');
  if (!benchControls) return box.classList.remove('prompt');
  let on = s.choosing && s.phase === 'work';
  if (s.lv.rule === 'rush') {
    const other = s.lanes.findIndex((c, i) => i !== s.station && !c.done);
    on = s.phase === 'work' && other >= 0 && s.lanes[other].left < s.cust.left;
    for (const el of box.querySelectorAll('[data-lane]')) el.toggleAttribute('data-next', on && +el.dataset.lane === other);
  }
  box.classList.toggle('prompt', on);
}
function nudgeTicket() {
  $('tickets').querySelector('[data-next]')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 320 });
}

// Each ticket shows the object itself. Picky customers request numbered tickets; rush tickets show both deadlines.
let ticketKey = '';
function renderTickets() {
  if (!benchControls) return;
  const box = $('tickets'), rule = s.lv.rule;
  const key = `${s.lanes.map(c => c.n).join('/')}:${s.cust.n}:${s.stepN}:${s.phase}:${s.choosing}`;
  if (key === ticketKey) return;
  ticketKey = key;
  box.replaceChildren();
  const rush = rule === 'rush';
  const reps = rush ? s.lanes.map(c => c.reps[c.stepN]) : s.reps;
  // Show the stack out of order. The stamped numbers show which physically distinct ticket to pull first.
  const indices = reps.map((_, i) => i);
  if (rule === 'order' && indices.length > 1) indices.push(indices.shift());
  for (const i of indices) {
    const active = rush ? s.station === i : s.stepN === i;
    const done = rush ? s.lanes[i].done : i < s.stepN || s.cust.done;
    const el = document.createElement(rule === 'boss' ? 'span' : 'button');
    el.className = (rush ? 'lane' : 'ticket') + (active && !s.choosing ? ' current' : '') + (done ? ' done' : '');
    el.dataset[rush ? 'lane' : 'ticket'] = i;
    if (rule === 'order' && active) el.dataset.next = '';
    if (rule !== 'boss') {
      el.disabled = done || s.phase !== 'work' || (rush ? active : !s.choosing);
      el.setAttribute('aria-label', translate(rush ? 'customerTicket' : 'repairTicket', { n: num(i + 1), object: translate(reps[i].kind) }));
      el.addEventListener('click', () => {
        if (!playing || paused || card) return;
        if (rush) selectLane(s, i);
        else chooseTicket(s, i);
        drain();
      });
    }
    const label = document.createElement('b');
    label.textContent = done ? '✓' : num(i + 1);
    const pic = document.createElement('canvas');
    pic.width = pic.height = 100;
    drawJob(pic.getContext('2d'), [reps[i]], 0, 0, 0);
    el.append(label, pic);
    if (rush) el.append(document.createElement('i'));
    box.append(el);
  }
}

let dailyImage = '';
const dailyDetails = () => translate('shareDetails', {
  date: dateLabel(today), coins: translate('coinCount', { n: num(s.coins) }), fixed: translate('fixedCount', { n: num(s.served) }),
});
function dailyCard() {
  const canvas = $('dailyShare'), ctx = canvas.getContext('2d');
  $('dailyResult').hidden = false;
  canvas.setAttribute('aria-label', translate('dailyResult') + ' · ' + dailyDetails());
  ctx.clearRect(0, 0, 600, 340);
  rrect(ctx, 0, 0, 600, 340, 0, '#123f3d', 0);
  ctx.fillStyle = '#fbc583';
  ctx.fillRect(0, 0, 600, 16);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#ffa86b' : '#fbc583';
    ctx.fillRect(i * 50, 0, 50, 22);
    circle(ctx, 25 + i * 50, 22, 25, ctx.fillStyle, 0);
  }
  const type = (text, x, y, size, color = '#fff1d6') => {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${size}px ui-rounded, system-ui, sans-serif`;
    ctx.fillStyle = color; ctx.fillText(text, x, y, 566 - x);
  };
  type(translate('title'), 34, 86, 44);
  type(translate('daily') + '  /  ' + dateLabel(today), 36, 137, 22, '#c2e9d7');
  coin(ctx, 63, 211, 25);
  type(num(s.coins), 103, 213, 62, '#ffd98d');
  type(translate('coins'), 105, 260, 19, '#c2e9d7');
  type(translate('fixedCount', { n: num(s.served) }), 38, 304, 23);
  type(translate('bestCombo', { n: num(s.bestStreak) }), 204, 304, 23);
  cat(ctx, 501, 306, 3.4, 0, true);
  dailyImage = canvas.toDataURL('image/png');
}
function downloadDaily(message = 'downloaded') {
  if (!dailyImage) return;
  const a = document.createElement('a');
  a.download = translate('imageName', { date: today }); a.href = dailyImage; a.click();
  $('shareStatus').textContent = translate(message);
}
$('downloadDaily').addEventListener('click', () => downloadDaily());
$('shareDaily').addEventListener('click', async () => {
  if (!dailyImage) return;
  const bytes = Uint8Array.from(atob(dailyImage.split(',')[1]), c => c.charCodeAt(0));
  const file = new File([bytes], translate('imageName', { date: today }), { type: 'image/png' });
  const data = { files: [file], title: translate('dailyResult'), text: dailyDetails() };
  try {
    if (navigator.share && navigator.canShare?.(data)) {
      await navigator.share(data);
      $('shareStatus').textContent = translate('shared');
      return;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      $('shareStatus').textContent = translate('canceled');
      return;
    }
  }
  downloadDaily('downloadFallback');
});

// Everything the sim reported: sound, symbols, sparks. Called after each input and each tick, so a touch is answered in the same frame.
function drain() {
  if (!s) return;
  for (const e of s.events) react(e);
  s.events.length = 0;
  while (recCount < s.log.length && recCount < 120) { const l = s.log[recCount++]; rec.event('repair', l); }
  renderTickets();
  const key = s.cust && `${s.cust.n}:${s.stepN}`;
  if (key !== jobKey) { // a new job on the bench: note how often this kind was seen before, for the hint
    jobKey = key;
    const k = s.rep.kind; seenBase = save.seen[k] ?? 0; save.seen[k] = seenBase + 1;
    pop = 0;
  }
  updateBenchLabel();
}
const local = (x, y) => [boxX + x * unit, boxY + y * unit];
function react(e) {
  switch (e.e) {
    case 'grab': tone(360, 0.04, 0.06, 'triangle'); ripple(e.x, e.y, C.tealLt); squash = 1; buzz(8); break;
    case 'miss': tone(140, 0.1, 0.14); ripple(e.x, e.y, '#ffb0a0'); wobble = 1; break;
    case 'click': tone(760 + e.n * 22, 0.035, 0.13, 'square'); noise(0.025, 0.12, 3500); squash = 1; sparks(s.rep.cx, s.rep.cy, 3, C.steelLt); break;
    case 'creak': tone(150 + e.n * 45, 0.09, 0.07, 'sawtooth'); break;
    case 'ping': tone(880 * 1.12 ** e.n, 0.25, 0.12, 'triangle'); tone(1760 * 1.12 ** e.n, 0.12, 0.04); sparks(e.x, e.y, 8, C.glow); break;
    case 'whirr': tone(170 + Math.min(e.w, 1500) / 3, 0.05, 0.05, 'triangle'); break;
    case 'shine': noise(0.04, 0.08, 5000); tone(1200 + e.n * 90, 0.06, 0.04); sparks(s.rep.cx + (Math.random() - 0.5) * 30, s.rep.cy - 2, 4, C.glow); break;
    case 'ratchet': noise(0.03, 0.08, 1800); wobble = 0.5; break;
    case 'tick': tone(e.n % 2 ? 1250 : 1600, 0.03, 0.09, 'square'); break;
    case 'clank': noise(0.12, 0.3, 900); tone(300, 0.12, 0.1, 'square', -60); squash = 1; break;
    case 'snap': tone(520, 0.09, 0.15, 'square', 380); squash = 1; sparks(50, 50, 6, C.brassLt); break;
    case 'shing': noise(0.14, 0.12, 6500); tone(2200 + e.n * 120, 0.18, 0.04, 'sine', 500); for (let i = 0; i < 5; i++) sparks(34 + Math.random() * 56, 56, 1, C.glow); break;
    case 'stitch': tone(1100 + e.n * 40, 0.04, 0.07, 'triangle'); noise(0.02, 0.05, 4000); squash = 0.5; break;
    case 'puff': noise(0.18, 0.14, 1200); tone(240 + e.n * 40, 0.14, 0.07, 'sine', 120); squash = 1; sparks(34, 70, 3, '#fff'); buzz(10); break;
    case 'drip': tone(900 + e.n * 120, 0.08, 0.1, 'sine', -500); sparks(30, 26, 4, '#e8c860'); squash = 0.6; buzz(10); break;
    case 'splat': tone(170, 0.08, 0.1, 'triangle', -60); noise(0.05, 0.08, 1200); ripple(s.rep.cx, s.rep.cy, '#ffb0a0'); wobble = 0.6; break;
    case 'squeak': tone(1500 - e.n * 300, 0.18, 0.05, 'sawtooth', 600); break;
    case 'wiggle': noise(0.04, 0.08, 2600); tone(600 + e.n * 60, 0.04, 0.05, 'square'); wobble = 0.4; break;
    case 'unsnag': tone(880, 0.12, 0.1, 'triangle', 300); sparks(50, s.rep.y - 4, 5, C.glow); buzz(12); break;
    case 'wind': tone(500 + e.n * 160, 0.05, 0.09, 'square'); noise(0.03, 0.06, 2000); break;
    case 'ready': tone(1320, 0.2, 0.1, 'triangle'); tone(1760, 0.25, 0.06); buzz(15); break;
    case 'zoom': tone(300, 0.5, 0.1, 'sawtooth', 1200); squash = 1; break;
    case 'unwind': tone(400, 0.3, 0.07, 'triangle', -250); feedback = { kind: 'rewind', t: 0 }; break;
    case 'eye': tone(1250, 0.06, 0.06, 'triangle'); break;
    case 'through': tone(700 + e.n * 140, 0.07, 0.07, 'triangle'); break;
    case 'goal': $('pause').style.display = 'none'; banner = { kind: 'goal', t: 0 }; [784, 988, 1175, 1568].forEach((f, i) => later(250 + i * 90, () => tone(f, 0.3, 0.07, 'triangle'))); party(24, true); break;
    case 'wrongTicket': {
      tone(160, 0.16, 0.10, 'triangle', -90);
      const ticket = $('tickets').querySelector(`[data-ticket="${e.ticket}"]`);
      ticket?.animate([{ backgroundColor: '#f0927c' }, { backgroundColor: '#fff1d6' }], { duration: 350 });
      break;
    }
    case 'switch':
    case 'ticket': tone(530, 0.07, 0.06, 'triangle'); break;
    case 'fixed': tone(1047, 0.15, 0.08, 'triangle'); break;
    case 'step': feedback = { kind: 'step', t: 0 }; break;
    case 'paid': {
      (WORKS_SOUND[OBJECT[e.kinds[0]]] ?? (() => {}))();
      const m = multiplier(s), st = e.streak;
      feedback = { kind: e.golden ? 'gold' : e.quick ? 'quick' : 'fixed', t: 0 };
      if (st >= 2) { const base = 523 * 2 ** (Math.min(st, 12) / 12); [1, 1.25, 1.5, 2, 2.5].slice(0, Math.min(st, 5)).forEach((k, i) => later(120 + i * 65, () => tone(base * k, 0.16, 0.05, 'triangle'))); }
      party(e.golden ? 30 : st >= 2 ? 6 + st * 4 : 0, e.golden);
      buzz(e.golden ? [30, 40, 30, 40, 60] : [20, 30, 20]);
      const n = Math.min(14, e.coins);
      for (let i = 0; i < n; i++) flying.push({ x: boxX + S / 2 + (Math.random() - 0.5) * 40, y: boxY + S * 0.4, vx: (Math.random() - 0.5) * 220, vy: -260 - Math.random() * 160, t: -i * 0.04, value: i === n - 1 ? e.coins - (n - 1) : 1 });
      if (m > multWas) multPop = 1;
      if (m > multWas) later(250, () => { tone(660, 0.12, 0.08, 'square'); tone(990, 0.2, 0.08, 'square'); });
      multWas = m;
      tone(660 * 2 ** (Math.min(12, s.streak) / 12), 0.2, 0.06, 'triangle');
      catHappy = 1.2;
      break;
    }
    case 'lost':
      tone(220, 0.45, 0.14, 'sawtooth', -90); feedback = { kind: 'lost', t: 0 }; heartFlash = 1; if (!calm) shake = 1; multWas = 1; buzz(80);
      break;
    case 'next': {
      walkOff();
      if (e.golden) { banner = { kind: 'gold', t: 0 }; shimmer(); }
      else if (e.fresh && (!s.lv || !cleared(s.lv.n))) { banner = { kind: 'new', t: 0 }; [523, 784, 1047].forEach((f, i) => later(i * 110, () => tone(f, 0.25, 0.08, 'triangle'))); }
      else if (e.regular) { banner = { kind: 'regular', t: 0 }; tone(392, 0.15, 0.08, 'triangle'); later(130, () => tone(523, 0.2, 0.08, 'triangle')); save.regular++; }
      else tone(300, 0.05, 0.05, 'triangle');
      break;
    }
    case 'over': finish(); break;
  }
}
function ripple(x, y, col) { ripples.push({ x, y, t: 0, col }); }
// Confetti over the bench, in CSS pixels; fewer and slower pieces when motion is reduced.
function party(n, gold) {
  n = Math.min(40, calm ? Math.ceil(n / 4) : n);
  const cols = gold ? ['#ffd860', '#fff3a8', '#f0a830', '#fff'] : ['#62c6b8', '#f0a830', '#d9493b', '#fff3a8', '#7fe0a0'];
  for (let i = 0; i < n; i++) confetti.push({ x: boxX + S * (0.2 + Math.random() * 0.6), y: boxY + S * 0.15, vx: (Math.random() - 0.5) * 260, vy: -160 - Math.random() * 240, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, t: 0, life: 1 + Math.random() * 0.5, col: cols[i % cols.length] });
}
function sparks(x, y, n, col) { for (let i = 0; i < n; i++) bits.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 60, t: 0, life: 0.5 + Math.random() * 0.3, col }); }

// ---------- input: one finger (or the mouse) on the bench, in object-local units
const toLocal = e => ({ x: (e.clientX - boxX) / unit, y: (e.clientY - boxY) / unit });
cv.addEventListener('pointerdown', e => {
  if (playing && !paused && card > 0) { e.preventDefault(); startNow(); return; } // a tap on the goal card starts the level
  if (!playing || paused || finger || kb) return;
  e.preventDefault();
  finger = { id: e.pointerId };
  try { cv.setPointerCapture(e.pointerId); } catch {}
  if (s.choosing) {
    const { x, y } = toLocal(e);
    ripple(x, y, C.amber); tone(280, 0.06, 0.05, 'triangle'); nudgeTicket();
  }
  input(s, { type: 'down', ...toLocal(e) }); drain();
});
function startNow() {
  if (!playing || paused || !card) return;
  $('tickets').hidden = !benchControls;
  card = 0; cardFade = 0.3; last = performance.now(); acc = 0;
  startControl();
  updateBenchLabel();
}
$('startLevel').addEventListener('click', startNow);
cv.addEventListener('pointermove', e => {
  if (!playing || paused || !finger || e.pointerId !== finger.id) return;
  input(s, { type: 'move', ...toLocal(e) }); drain();
});
for (const type of ['pointerup', 'pointercancel']) cv.addEventListener(type, e => {
  if (!finger || e.pointerId !== finger.id) return;
  finger = null;
  if (playing && !paused) { input(s, { type: type === 'pointerup' ? 'up' : 'cancel', ...toLocal(e) }); drain(); }
});

// ---------- buttons, pause, keys
const rec = lab('fixit');
const notice = rec.notice($('menu').firstElementChild);
const recordingToggle = rec.toggle($('paused').firstElementChild);
const recordingChoice = recordingToggle.querySelector('input');
const noticeText = notice.firstChild;
const recordingLabel = recordingToggle.lastChild;
notice.querySelector('a').dataset.i18n = 'privacy';
recordingChoice.addEventListener('change', updateRecording);
addEventListener('storage', updateRecording);
function updateRecording() {
  noticeText.data = translate(recordingChoice.checked ? 'recordingOn' : 'recordingOff') + ' ';
  recordingLabel.data = ' ' + translate('recordingToggle');
}
function syncNotes() {
  document.getElementById('notes-button')?.setAttribute('aria-label', translate('notes'));
}
document.addEventListener('DOMContentLoaded', syncNotes, { once: true });
function translatePage() {
  document.title = translate('title');
  apply();
  updateSound();
  updateRecording();
  syncNotes();
  for (const button of document.querySelectorAll('.language')) {
    button.lastElementChild.textContent = translate(lang() === 'en' ? 'enCode' : 'trCode');
  }
  const hintLabel = document.querySelector('.kit-hint .label');
  if (hintLabel) hintLabel.textContent = translate('screwMove');
  if (screen === 'menu') menu();
  ticketKey = '';
  benchLabelKey = '';
  if (s) renderTickets();
  startControl();
  updateBenchLabel();
}
for (const id of ['langMenu', 'langPause']) {
  const button = $(id);
  button.append($('languageIcon').content.cloneNode(true));
  button.addEventListener('click', () => {
    setLang(lang() === 'en' ? 'tr' : 'en');
    // Keep an explicit link consistent with the new choice after refresh.
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.set('lang', lang());
      history.replaceState(history.state, '', url);
    }
    translatePage();
  });
}
$('play').addEventListener('click', () => begin(only ? 'open' : 'level', qLevel ?? nextLevel()));
for (const id of ['menuAssist', 'assist']) $(id).append($('helpIcon').content.cloneNode(true));
const assistLevel = document.createElement('span');
assistLevel.id = 'assistLevel';
$('menuAssist').prepend(assistLevel);
$('menuAssist').addEventListener('click', () => { if (screen === 'menu' && menuHelp) begin('level', menuHelp, true); });
$('assist').addEventListener('click', () => { if (screen === 'end' && mode === 'level' && !s.cleared && canAssist(save.attempts[lvN])) begin('level', lvN, true); });
$('again').addEventListener('click', () => { if (performance.now() - ended > 500) begin(mode, lvN); });
$('next').addEventListener('click', () => { if (performance.now() - ended > 500) begin('level', Math.min(COUNT, lvN + 1)); });
$('open').addEventListener('click', () => begin('open'));
$('daily').addEventListener('click', () => begin('daily'));
$('toShop').addEventListener('click', () => { snd.unlock(); show('shop'); });
for (const b of document.querySelectorAll('.back')) b.addEventListener('click', () => show('menu'));
$('toMenu').addEventListener('click', () => show('menu'));
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', quit);
for (const id of ['sound1', 'sound2']) $(id).addEventListener('click', () => {
  save.sound = !save.sound; store();
  if (save.sound) { snd.unlock(); tone(660, 0.1, 0.06, 'triangle'); }
  updateSound();
});
// The keyboard: holding Space does the job in front of you at an everyday pace (moves.js, the same finger paths the
// bots use), one step per sim tick. Letting go lifts the finger. Every repair can be done this way.
function kbStep() {
  const lift = () => { if (kb.down) { input(s, { type: 'up', x: kb.x, y: kb.y }); kb.down = false; } };
  if (s.phase !== 'work') { lift(); kb.plan = []; kb.i = 0; return; }
  if (s.choosing) { lift(); chooseTicket(s, s.stepN); return; }
  const key = `${s.cust.n}:${s.stepN}`;
  if (key !== kb.key || kb.i >= kb.plan.length) {
    lift();
    kb.plan = [...(key === kb.key ? Array(9).fill(null) : []), ...plan(guide(s.rep), SKILLS.average, [kb.x, kb.y])];
    kb.i = 0; kb.key = key;
  }
  const st = kb.plan[kb.i++];
  if (st) { input(s, st); kb.x = st.x; kb.y = st.y; kb.down = st.type !== 'up'; }
}
function kbRelease() { if (!kb) return; if (kb.down && playing && !paused) { input(s, { type: 'up', x: kb.x, y: kb.y }); drain(); } kb = null; }
const isSpace = e => e.key === ' ' || e.code === 'Space';
addEventListener('keyup', e => { if (isSpace(e)) kbRelease(); });
addEventListener('blur', kbRelease);
function pause() {
  if (!playing || paused || s.cleared) return;
  kbRelease(); // lift the keyboard's finger while the sim still takes input
  paused = true;
  if (finger) { input(s, { type: 'cancel', x: 0, y: 0 }); drain(); finger = null; } // the sim lets go of whatever was held
  snd.hold(); show('paused');
}
function resume() {
  if (!paused) return;
  paused = false; acc = 0; last = performance.now();
  show('play'); snd.unlock(); snd.release();
}
$('pause').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pause(); });
$('pause').addEventListener('click', e => { e.preventDefault(); pause(); });
onLeave(pause);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (paused) resume(); else pause(); return; }
  if (isSpace(e) && playing && !paused && card > 0) { e.preventDefault(); if (!e.repeat) startNow(); return; }
  if (isSpace(e) && playing && !paused && !e.target.closest?.('button')) { e.preventDefault(); if (!kb && !finger && !e.repeat) kb = { plan: [], i: 0, key: null, x: 50, y: 110, down: false }; return; }
  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !playing && screen !== 'play' && !e.target.closest?.('button, a, input')) { const b = screen === 'menu' ? $('play') : screen === 'end' ? ($('next').style.display !== 'none' ? $('next') : $('again')) : null; if (b) { e.preventDefault(); b.click(); } }
});

function repairCue(r) {
  if (r.kind === 'zip' && zipStuck(r)) return 'zipStuck';
  if (r.kind === 'balance' && r.grab && r.dwell > 0) return 'balanceHold';
  return r.kind + 'Move';
}
let benchLabelKey = '';
function updateBenchLabel() {
  const visible = screen === 'play' && !card;
  if (cv.getAttribute('aria-hidden') !== String(!visible)) cv.setAttribute('aria-hidden', String(!visible));
  if (!visible || !s?.rep) return;
  const move = repairCue(s.rep), key = `${lang()}:${jobKey}:${move}:${s.choosing}`;
  if (benchLabelKey === key) return;
  benchLabelKey = key;
  const step = num(s.stepN + 1);
  cv.setAttribute('aria-label', s.choosing ? translate('chooseTicket', { n: step }) : translate('benchProgress', {
    object: translate(s.rep.kind), move: translate(move), step, total: num(s.reps.length),
  }));
}

// The state the browser check reads.
window.fixitState = () => ({
  screen, playing, paused, t: s?.t ?? 0, clock: s?.clock ?? 0, day: s?.day ?? 0, over: s?.over ?? null,
  coins: s?.coins ?? 0, hearts: s?.hearts ?? 0, served: s?.served ?? 0, lost: s?.lost ?? 0, streak: s?.streak ?? 0, phase: s?.phase ?? null,
  kind: s?.rep?.kind ?? null, step: s?.stepN ?? 0, steps: s?.reps?.length ?? 0, p: s?.rep?.p ?? 0, job: s?.cust?.n ?? -1,
  guide: s?.rep && s.phase === 'work' && !s.choosing ? guide(s.rep) : null, hint: hintNow,
  box: { x: boxX, y: boxY, unit }, minTouchPx: Math.min(...Object.values(HIT)) * 2 * unit,
  bank: save.bank, best: save.best, shifts: save.shifts, unlocked: [...save.unlocked], owned: [...save.owned], awning: save.awning, sound: save.sound, pending: save.pending,
  customer: s?.cust ? { n: s.cust.n, kinds: s.cust.kinds, regular: s.cust.regular, golden: s.cust.golden, left: s.cust.left, patience: s.cust.patience } : null,
  cue: s?.rep && s.phase === 'work' && !s.choosing ? (['zipStuck', 'balanceHold'].includes(repairCue(s.rep)) ? repairCue(s.rep) : guide(s.rep).type) : null,
  introCue: !!(card && s?.lv?.intro && !cleared(s.lv.n) || banner?.kind === 'new'), confetti: confetti.length, golden: !!s?.cust?.golden, queue: s ? s.queue.map(c => c.kinds[0]) : [], daily, today, days: { ...save.days }, keyboard: !!kb, alpha: Math.min(1, acc / DT),
  people: drawn.map(p => ({ x: Math.round(p.x * 10) / 10, R: Math.round(p.R * 10) / 10, who: p.who })),
  mode, level: mode === 'level' ? lvN : null, card, goal: s ? goalState(s) : null, cleared: !!s?.cleared, stars: s ? stars(s) : 0, clearT: s?.clearT ?? null,
  assisted: !!s?.assisted, attempts: { ...save.attempts }, assists: { ...save.assists }, growth: stallGrowth(),
  rule: s?.lv?.rule ?? null, order: s?.lv?.tickets ? s.cust.kinds : [], choosing: !!s?.choosing,
  station: s?.station ?? null, lanes: s?.lanes.map(c => ({ id: c.n, kind: c.kinds[c.stepN], left: c.left, done: c.done, p: c.reps[c.stepN].p })) ?? [],
  lamp: s?.lv?.rule === 'blackout' ? calm ? 50 : lampAt(s) : null,
  levels: { ...save.levels }, times: { ...save.times }, next: nextLevel(), migrated, openStall: openStall(), dailyOpen: dailyOpen(),
});

// ---------- interpolation: the sim runs at 60 Hz; the screen may run faster or out of step. Before each tick the
// moving parts are noted, and drawing blends from that note to the current state by how far into the next tick we are.
const LERP = ['p', 'u', 'h', 'ang', 'seat', 'w', 'hand', 'pull', 'ox', 'oy', 'set', 'lx', 'ly', 'slot', 'strokes', 'x', 'y', 'ph', 'tx', 'ty', 'ex', 'inEye'];
const keyOf = () => `${s.cust.n}:${s.stepN}:${s.phase}`;
function snap() { prev = { key: keyOf(), reps: s.reps.map(r => Object.fromEntries(LERP.filter(k => typeof r[k] === 'number').map(k => [k, r[k]]))), left: s.cust.left, clock: s.clock, phaseT: s.phaseT }; }
function view() {
  const a = Math.min(1, acc / DT);
  if (!prev || !playing || paused || prev.key !== keyOf()) return { reps: s.reps, left: s.cust.left, clock: s.clock, phaseT: s.phaseT };
  const mix = (x0, x1) => Math.abs(x1 - x0) > 400 ? x1 : x0 + (x1 - x0) * a;
  const reps = s.reps.map((r, i) => { const o = { ...r }; for (const [k, v] of Object.entries(prev.reps[i] ?? {})) if (typeof r[k] === 'number') o[k] = mix(v, r[k]); return o; });
  return { reps, left: mix(prev.left, s.cust.left), clock: mix(prev.clock, s.clock), phaseT: mix(prev.phaseT, s.phaseT) };
}
let V = null;

// ---------- drawing
function draw(now, dt) {
  V = s ? view() : null;
  drawn = [];
  const t = now / 1000;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = shake * (Math.random() - 0.5) * 10, sy = shake * (Math.random() - 0.5) * 10;
  g.translate(sx, sy);
  const growth = stallGrowth();
  street(t);
  furnishings(growth);
  if (s?.lv?.rule === 'blackout' && (screen === 'play' || screen === 'end' || paused)) lampHanger();
  people(t, dt);
  awning(t, growth);
  bench(t);
  if (s && (screen === 'play' || screen === 'end' || screen === 'paused')) job(t, dt);
  else idleJob(t);
  for (const b of bits) { const [x, y] = local(b.x, b.y); g.globalAlpha = Math.max(0, 1 - b.t / b.life); star(g, x, y, 4, b.col); g.globalAlpha = 1; }
  hud(t, dt);
  if (has('cat') || growth.includes('cat')) cat(g, 38, benchTop + 8, 0.88, t, catHappy > 0);
  if (s?.lv && (playing || screen === 'paused')) goalCard(t);
}
function street(t) {
  // the sky moves on through the day as the map goes on: afternoon for the first chapter, sunset, then dusk
  const sky = g.createLinearGradient(0, 0, 0, benchTop), late = s?.lv && mode === 'level' && (playing || screen !== 'menu') ? (lvN > BUSY_END ? 3 : lvN > 24 ? 2 : lvN > INTRO ? 1 : 0) : 0;
  const SKY = [['#f7cf93', '#ee9f6a'], ['#f2a37a', '#d9705a'], ['#8a6aa0', '#e08a6a'], ['#233048', '#655577']][late];
  sky.addColorStop(0, SKY[0]); sky.addColorStop(1, SKY[1]);
  g.fillStyle = sky; g.fillRect(-20, -20, W + 40, benchTop + 40);
  if (late === 3) {
    for (let i = 0; i < 14; i++) circle(g, (37 + i * 71) % W, top + 64 + (i * 31) % 60, 1.1 + i % 2, '#f8e5b3', 0);
  }
  const sun = g.createRadialGradient(W * 0.82, top + 70, 4, W * 0.82, top + 70, 120); sun.addColorStop(0, late === 3 ? 'rgba(235,221,250,.20)' : 'rgba(255,248,200,.9)'); sun.addColorStop(1, 'rgba(255,248,200,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, benchTop);
  // the street behind: rooftops and windows, a little darker
  const base = benchTop - 20;
  for (let i = 0, x = -10; x < W + 20; i++) {
    const w = 60 + ((i * 37) % 40), h = 70 + ((i * 53) % 60);
    g.fillStyle = late === 3 ? (i % 2 ? '#534364' : '#473b5a') : (i % 2 ? '#d98a5c' : '#cf7d52'); g.fillRect(x, base - h, w, h + 30);
    g.fillStyle = 'rgba(255,240,200,.45)'; for (let wy = base - h + 14; wy < base - 18; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 22) g.fillRect(wx, wy, 10, 14);
    g.fillStyle = late === 3 ? '#372e4b' : '#b7643f'; g.fillRect(x - 3, base - h - 6, w + 6, 8);
    x += w + 6;
  }
  g.fillStyle = late === 3 ? '#45354d' : '#c98a62'; g.fillRect(0, base, W, benchTop - base + 2);
}
function furnishings(growth) {
  if (growth.includes('shelf')) {
    const x = W - 96, y = benchTop - 24;
    rrect(g, x, y, 83, 9, 2, '#75432b', 2);
    rrect(g, x + 7, y - 17, 17, 17, 3, '#cc935f', 2);
    rrect(g, x + 29, y - 20, 12, 20, 2, '#9dc6b2', 2);
    rrect(g, x + 49, y - 13, 24, 13, 2, '#d8ac64', 2);
    g.fillStyle = '#fff1d6';
    g.fillRect(x + 32, y - 14, 6, 3);
  }
  if (growth.includes('sign')) {
    rrect(g, 12, benchTop - 88, 67, 35, 7, '#184b49', 2);
    goalIcon(g, 'fix', 45, benchTop - 70, 12);
  }
}
const QUEUE_GAP = () => Math.min(92, W * 0.22);
function custTarget(i) { return { x: W / 2 - QUEUE_GAP() * (i + 0.95) - 10, R: Math.max(13, 23 - i * 3), base: benchTop - 26 - i * 3 }; }
function people(t, dt) {
  if (!s || !(screen === 'play' || screen === 'end' || screen === 'paused')) { // menu: a customer waves at the empty stall
    person(g, W / 2, benchTop + 6, 32, looks(12345), 'happy', t, { cheer: 0.5 + 0.5 * Math.sin(t * 3), bob: Math.sin(t * 2) * 2 });
    return;
  }
  if (s.lv?.rule === 'rush') {
    rushPeople(t);
    return;
  }
  const boss = s.lv?.rule === 'boss' && s.reps.length === 3;
  const R = Math.min(boss ? 37 : 34, (benchTop - top - 70) / 3.4);
  const ease = k => 1 - Math.exp(-dt * k);
  // where everybody wants to be this frame: the customer at the counter, then the queue
  const c = s.cust, csp = spots.get(c.n) ?? { x: custTarget(0).x, R: custTarget(0).R, base: custTarget(0).base };
  csp.x += (W / 2 - csp.x) * ease(9); csp.R += (R - csp.R) * ease(9); csp.base += (benchTop + 4 - csp.base) * ease(9);
  spots.set(c.n, csp);
  for (const l of leaving) { l.t += dt; l.x += 280 * dt; }
  leaving = leaving.filter(l => l.x < W + 80);
  const order = [];
  for (let i = Math.min(2, s.queue.length - 1); i >= 0; i--) {
    const c = s.queue[i], tg = custTarget(i), sp = spots.get(c.n) ?? { x: -60, R: tg.R, base: tg.base };
    sp.x += (tg.x - sp.x) * ease(6); sp.R += (tg.R - sp.R) * ease(6); sp.base += (tg.base - sp.base) * ease(6);
    spots.set(c.n, sp);
    order[i] = sp;
  }
  // nobody stands inside anybody: each person keeps a body's width from the one ahead (bodies are 1.5 R each side)
  const apart = (a, b) => 1.5 * (a.R + b.R) + 2;
  const front = Math.min(Infinity, ...leaving.map(l => l.x - apart(l, csp)));
  csp.x = Math.min(csp.x, front);
  for (let i = 0; i < order.length; i++) if (order[i]) order[i].x = Math.min(order[i].x, (i ? order[i - 1] : csp).x - apart(order[i], i ? order[i - 1] : csp));
  for (let i = order.length - 1; i >= 0; i--) {
    const c = s.queue[i], sp = order[i];
    if (!sp) continue;
    if (c.golden) aura(sp.x, sp.base - sp.R * 1.3, sp.R * 2.2, t);
    person(g, sp.x, sp.base, sp.R, c.regular ? REGULAR : looks(c.look), 'ok', t, { blinkSeed: c.n, bob: Math.abs(Math.sin(t * 4 + c.n)) * 2 });
    drawn.push({ x: sp.x, R: sp.R, who: 'queue' });
    if (c.regular) { g.fillStyle = C.ink; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText('!', sp.x + sp.R * 1.2, sp.base - sp.R * 3); }
  }
  // people walking off, all at one pace so they never catch each other up
  for (const l of leaving) {
    person(g, l.x, l.base, l.R, l.L, l.happy ? 'happy' : 'cross', t, { cheer: l.happy ? Math.max(0, 1 - l.t * 2) : 0, bob: Math.abs(Math.sin(l.t * 12)) * 3 });
    drawn.push({ x: l.x, R: l.R, who: 'leaving' });
  }
  // the customer at the counter
  const sp = csp;
  if (spots.size > 12) for (const k of [...spots.keys()]) if (k < c.n - 2) spots.delete(k);
  const frac = V.left / c.patience, mood = s.phase === 'works' ? 'happy' : s.phase === 'leave' ? 'cross' : frac > 0.5 ? 'ok' : frac > 0.25 ? 'wait' : 'cross';
  const L = boss ? { ...looks(c.look), shirt: '#684a88', hat: 9, glasses: true }
    : c.regular ? REGULAR : looks(c.look);
  const cheer = s.phase === 'works' ? Math.sin((1 - V.phaseT / WORKS) * Math.PI) : 0;
  if (c.golden) aura(sp.x, sp.base - sp.R * 1.3, sp.R * 2.4, t);
  drawn.push({ x: sp.x, R: sp.R, who: 'counter' });
  const { hx, hy } = person(g, sp.x, sp.base, sp.R, L, mood, t, { cheer, blinkSeed: c.n, bob: mood === 'cross' ? Math.abs(Math.sin(t * 14)) * 2 : Math.sin(t * 3) * 1.5 + cheer * 10 });
  // the patience ring round the head: full when they arrive, empty when they walk off
  if (s.phase === 'work' && !c.tutor) {
    const rr = sp.R * 1.42, col = frac > 0.5 ? '#3f9e6a' : frac > 0.25 ? C.amber : C.red, pulse = frac < 0.25 ? 1 + 0.08 * Math.sin(t * 18) : 1;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(58,34,22,.25)'; g.lineWidth = 7; g.beginPath(); g.arc(hx, hy, rr * pulse, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.arc(hx, hy, rr * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); g.stroke();
    // The quick-pay notch marks the same elapsed time even when the ring drains slower.
    const notch = -Math.PI / 2 + 2 * Math.PI * (1 - 0.5 * (s.assisted ? ASSIST_RATE : 1));
    const nx = Math.cos(notch), ny = Math.sin(notch);
    g.strokeStyle = C.ink; g.lineWidth = 2.5; g.beginPath();
    g.moveTo(hx + nx * (rr * pulse - 6), hy + ny * (rr * pulse - 6));
    g.lineTo(hx + nx * (rr * pulse + 6), hy + ny * (rr * pulse + 6)); g.stroke();
  }
  if (s.phase === 'works') reactionMark(hx + sp.R * 1.56, hy - sp.R * 0.67, cheer, true);
  else if (s.phase === 'leave' || frac < 0.2) reactionMark(hx + sp.R * 1.54, hy - sp.R * 0.67, 0.8, false);
  counter = { n: c.n, x: sp.x, base: sp.base, R: sp.R, L, happy: s.phase === 'works' || (counter?.n === c.n && counter.happy) };
}
function rushPeople(t) {
  const R = Math.min(27, (benchTop - top - 90) / 3.35);
  const meters = $('tickets').querySelectorAll('.lane i');
  s.lanes.forEach((c, i) => {
    const x = W / 2 + (i - 0.5) * Math.min(W * 0.44, 180);
    const frac = c.left / c.patience;
    const cheer = c.done ? 0.9 : 0;
    const { hx, hy } = person(g, x, benchTop + 2, R, looks(c.look),
      c.done ? 'happy' : frac < 0.25 ? 'cross' : frac < 0.5 ? 'wait' : 'ok', t,
      { cheer, blinkSeed: c.n, bob: calm ? 0 : Math.sin(t * 3 + i) * 2 });
    circle(g, hx, hy, R * 1.38, 'transparent', 2);
    if (!c.done) {
      g.strokeStyle = frac < 0.3 ? '#ea8c7a' : '#9ee1c0';
      g.lineWidth = i === s.station ? 5 : 3;
      g.beginPath(); g.arc(hx, hy, R * 1.38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); g.stroke();
    }
    if (c.done || frac < 0.2) reactionMark(hx + R * 1.6, hy - R * 0.7, 0.9, c.done);
    if (meters[i]) {
      meters[i].style.transform = `scaleX(${c.done ? 1 : frac})`;
      meters[i].style.backgroundColor = frac < 0.3 && !c.done ? '#a0342f' : '#247963';
    }
    drawn.push({ x, R, who: 'counter' });
  });
}
function reactionMark(x, y, strength, happy) {
  circle(g, x, y, 10 + strength * 2, happy ? '#f8d481' : '#f5aa93', 1.7);
  if (happy) starShape(g, x, y, 6, '#fff3bf');
  else ink('!', x, y + 1, 13, '#fff1d6', 'center');
}

// A golden customer glows and sparkles, in the queue and at the counter.
function aura(x, y, r, t) {
  const gl = g.createRadialGradient(x, y, r * 0.2, x, y, r);
  gl.addColorStop(0, 'rgba(255,220,90,.65)'); gl.addColorStop(1, 'rgba(255,220,90,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 4; i++) { const a = t * (calm ? 0.5 : 2) + i * Math.PI / 2; star(g, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.6, 5 + 2 * Math.sin(t * 6 + i), '#fff3a8'); }
}
let counter = null; // the customer last drawn at the counter; they walk off when the next one steps up
function walkOff() { if (counter && s.cust && counter.n !== s.cust.n && !leaving.some(l => l.n === counter.n)) leaving.push({ ...counter, t: 0 }); }
function awning(t, growth) {
  const [a, b] = AWNING[save.awning] ?? AWNING.teal, y0 = top + 50, h = 26, w = 30;
  g.fillStyle = '#6a3a1f'; g.fillRect(0, y0 - 6, W, 6);
  for (let i = 0, x = 0; x < W; i++, x += w) {
    g.fillStyle = i % 2 ? b : a; g.fillRect(x, y0, w, h);
    g.beginPath(); g.arc(x + w / 2, y0 + h, w / 2, 0, Math.PI); g.fill();
  }
  g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y0); g.lineTo(W, y0); g.stroke();
  if (has('lights') || growth.includes('lights')) for (let x = 15, i = 0; x < W; x += 30, i++) { const on = Math.sin(t * 3 + i) > -0.3; g.fillStyle = on ? ['#fff3a8', '#ffb46a', '#9ff0e0'][i % 3] : '#9a8a70'; if (on) { g.shadowColor = '#ffe08a'; g.shadowBlur = 10; } g.beginPath(); g.arc(x, y0 + h + 18, 5, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; }
  if (has('charm')) { g.strokeStyle = C.ink; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W - 34, y0 + h + 10); g.lineTo(W - 34, y0 + h + 22); g.stroke(); g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.arc(W - 34, y0 + h + 34, 10, Math.PI * 0.85, Math.PI * 2.15, true); g.stroke(); g.strokeStyle = C.steelLt; g.lineWidth = 4.5; g.stroke(); }
  if (has('radio')) {
    const x = W - 64, y = benchTop - (growth.includes('shelf') ? 48 : 22);
    rrect(g, x, y, 40, 26, 5, C.copper, 2);
    circle(g, x + 12, y + 13, 7, C.cream, 1.6);
    rrect(g, x + 22, y + 3, 15, 16, 2, C.ink, 0);
    const note = TUNE[(radioN - 1) % TUNE.length];
    if (playing && !card && note) {
      const noteY = y + 16 - 5 * Math.log2(note / 523);
      circle(g, x + 27, noteY, 2.4, C.glow, 0);
      g.fillStyle = C.glow; g.fillRect(x + 28, noteY - 7, 2, 7); g.fillRect(x + 30, noteY - 7, 3, 2);
    }
  }
}
function bench(t) {
  const wood = g.createLinearGradient(0, benchTop, 0, H);
  wood.addColorStop(0, '#a8663b'); wood.addColorStop(1, '#7a4426');
  g.fillStyle = wood; g.fillRect(-20, benchTop, W + 40, H - benchTop + 20);
  g.strokeStyle = 'rgba(58,34,22,.25)'; g.lineWidth = 2;
  for (let y = benchTop + 40; y < H; y += 44) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = '#c98250'; g.fillRect(-20, benchTop - 2, W + 40, 12); g.fillStyle = C.ink; g.fillRect(-20, benchTop + 10, W + 40, 2.5);
  // afternoon light falling on the work spot
  const cx = boxX + S / 2, cy = boxY + S / 2, glow = g.createRadialGradient(cx, cy, S * 0.1, cx, cy, S * 0.62);
  glow.addColorStop(0, 'rgba(255,230,180,.55)'); glow.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = glow; g.fillRect(cx - S, cy - S, 2 * S, 2 * S);
}
const beamX = () => boxX + S * (calm ? 0.5 : lampAt(s) / 100);
const shadeX = () => W / 2 + (beamX() - W / 2) * 0.55;
function lampHanger() {
  g.strokeStyle = '#262238'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(W / 2, top + 84); g.lineTo(shadeX(), benchTop + 13); g.stroke();
}
function blackout() {
  const x = beamX(), y = boxY + S * 0.42;
  const glow = g.createRadialGradient(x, y, S * 0.1, x, y, S * (calm ? 0.72 : 0.58));
  glow.addColorStop(0, 'rgba(23,24,45,0)');
  glow.addColorStop(0.52, 'rgba(23,24,45,0.09)');
  glow.addColorStop(1, 'rgba(16,18,41,0.76)');
  g.fillStyle = glow; g.fillRect(-12, benchTop + 12, W + 24, H - benchTop);
  const lampY = benchTop + 13, lampX = shadeX();
  rrect(g, lampX - 14, lampY - 7, 28, 14, 7, '#d38749', 2);
  rrect(g, lampX - 10, lampY + 3, 20, 6, 3, '#fff1ba', 0);
}
function job(t, dt) {
  const r = s.rep, cx = boxX + S / 2, cy = boxY + S / 2;
  // the progress ring, around the object, never under the finger
  const prog = s.phase === 'works' ? 1 : V.reps.reduce((a, rp) => a + rp.p, 0) / V.reps.length;
  g.lineCap = 'round';
  g.strokeStyle = s.cust.golden ? 'rgba(255,216,96,.75)' : 'rgba(58,34,22,.22)'; g.lineWidth = s.cust.golden ? 14 : 10; g.beginPath(); g.arc(cx, cy, S * 0.5, 0, Math.PI * 2); g.stroke();
  if (s.cust.golden) for (let i = 0; i < 6; i++) { const a = t * (calm ? 0.3 : 1.2) + i * Math.PI / 3; star(g, cx + Math.cos(a) * S * 0.5, cy + Math.sin(a) * S * 0.5, 6, '#fff3a8'); }
  if (prog > 0) { g.strokeStyle = s.phase === 'works' ? '#7fe0a0' : C.tealLt; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, S * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); g.stroke(); }
  // the object
  const works = s.phase === 'works' ? 1 - V.phaseT / WORKS : 0, gone = s.phase === 'leave' ? 1 - V.phaseT / LEAVE : 0;
  pop = Math.min(1, pop + dt * 6);
  const k = (0.7 + 0.3 * easeBack(pop)) * (1 - 0.035 * squash) * (1 + (works ? 0.05 * Math.sin(works * Math.PI) : 0));
  g.save();
  g.translate(cx + Math.sin(t * 50) * wobble * 4, cy + gone * S * 0.4);
  g.scale(k * (1 + 0.02 * squash), k);
  g.globalAlpha = 1 - gone;
  g.translate(-S / 2, -S / 2); g.scale(unit, unit);
  if (s.lv?.rule === 'boss' && s.reps.length === 3) {
    rrect(g, 3, 8, 94, 86, 13, '#5d5664', 1.3);
    rrect(g, 7, 12, 86, 78, 10, '#c9b49a', 1.1);
    for (const x of [11, 89]) for (const y of [16, 86]) circle(g, x, y, 2, '#f0cf9f', 0.8);
  }
  if (s.choosing) {
    rrect(g, 19, 24, 62, 51, 7, '#c38e5c', 1.4);
    rrect(g, 24, 29, 52, 41, 5, '#d6a374', 1.1);
    goalIcon(g, 'list', 50, 50, 12);
  } else if (s.lv?.tickets) drawJob(g, [V.reps[s.stepN]], 0, t, works);
  else drawJob(g, V.reps, s.stepN, t, works);
  promptTicket();
  if (s.cust.regular) drawSilly(g, sillyList(save.regular), t);
  // the hint: a ghost finger doing the gesture on the thing
  const urgentCue = (r.kind === 'oil' || r.kind === 'zip' && zipStuck(r) && r.idle > 0.2) && !s.choosing;
  hintNow = playing && !paused && !card ? Math.max(hint(s, seenBase), urgentCue ? 0.9 : 0) : 0;
  if (hintNow && s.phase === 'work') drawGhost(g, guide(r), t, hintNow * (calm ? 1 : 0.82 + 0.18 * Math.sin(t * 5)), calm);
  if (kb && s.phase === 'work') { // the keyboard's finger: a fingertip that presses while Space is held
    g.fillStyle = kb.down ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(kb.x, kb.y, kb.down ? 7 : 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke();
  }
  for (const p of ripples) { g.strokeStyle = p.col; g.globalAlpha = Math.max(0, 1 - p.t * 3); g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 6 + p.t * 60, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  g.globalAlpha = 1;
  if (s.lv?.rule === 'blackout') blackout();
  const y = boxY - 16;
  if (s.choosing) {
    const sequence = s.reps.map((_, i) => i < s.stepN ? '✓' : num(i + 1));
    ink(sequence.join(' → '), W / 2, y, 24, '#fff6e4', 'center');
  } else if (feedback) {
    g.save();
    g.globalAlpha = Math.min(1, (0.9 - feedback.t) * 5);
    const x = W / 2;
    circle(g, x, y, 14, feedback.kind === 'lost' ? '#ffb0a0' : '#fff1d6', 2);
    symbol(g, feedback.kind, x, y, 11);
    g.restore();
  }
  if (s.reps.length > 1 && s.phase === 'work' && !benchControls) {
    for (let i = 0; i < s.reps.length; i++) {
      const x = W / 2 + (i - (s.reps.length - 1) / 2) * 21;
      if (i < s.stepN) symbol(g, 'fixed', x, boxY + 6, 7);
      else circle(g, x, boxY + 6, 5, i === s.stepN ? C.cream : 'rgba(255,255,255,.3)', 2);
    }
  }
  if (banner && !benchControls && s.lv?.rule !== 'blackout') {
    const a = Math.min(1, banner.t * 6) * Math.min(1, (1.6 - banner.t) * 4);
    if (a > 0) {
      g.save();
      g.globalAlpha = a;
      const x = W / 2, y = benchTop - 8;
      circle(g, x, y, 18, '#fff1d6', 2);
      symbol(g, banner.kind, x, y, 13);
      g.restore();
    }
  }
}
function idleJob(t) {
  g.save(); g.translate(boxX, boxY); g.scale(unit, unit);
  const demo = { kind: 'dent', dents: [{ x: 28, y: 54, out: true }, { x: 50, y: 42, out: false }, { x: 72, y: 54, out: false }], p: 0 };
  drawJob(g, [demo], 0, t, 0);
  g.restore();
}
function easeBack(x) { const c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; }
function hud(t, dt) {
  if (!s || !(screen === 'play' || screen === 'end' || screen === 'paused')) return;
  const y = top + 8;
  for (let i = 0; i < s.maxHearts; i++) heart(g, 22 + i * 28, y + 2 + (heartFlash > 0 && i === s.hearts ? Math.sin(t * 40) * 3 : 0), 24, i < s.hearts);
  // coins: the number counts up as the flying coins land
  coin(g, W / 2 - 34, y + 15, 13);
  g.font = 'bold 26px ui-rounded, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = C.ink; g.lineJoin = 'round';
  const score = num(shownCoins);
  g.strokeText(score, W / 2 - 16, y + 16); g.fillStyle = '#fff6e4'; g.fillText(score, W / 2 - 16, y + 16);
  const m = multiplier(s);
  if (m > 1) { // the multiplier badge pops when it goes up
    const bx = W / 2 - 16 + g.measureText(score).width + 10, k = 1 + 0.5 * multPop * (calm ? 0.3 : 1);
    g.save(); g.translate(bx + 17, y + 16); g.scale(k, k); rrect(g, -17, -12, 34, 24, 10, multPop > 0.01 ? C.amber : C.teal, 2); g.fillStyle = '#fff6e4'; g.font = 'bold 16px ui-rounded, sans-serif'; g.textAlign = 'center'; g.fillText('×' + num(m), 0, 1); g.restore();
  }
  // Eight clean fixes build the pay multiplier. The bar resets when a fix is late.
  const label = translate('streak'), bx = W - 106, by = Math.max(benchTop + 16, boxY + S + 8);
  g.font = 'bold 13px ui-rounded, sans-serif';
  const labelWidth = g.measureText(label).width;
  rrect(g, bx - labelWidth - 2, by - 9, labelWidth + 100, 28, 11, 'rgba(45,27,21,.86)', 1.5);
  ink(label, bx - labelWidth + 6, by + 5, 13, '#f9ddae');
  for (let i = 0; i < 8; i++) {
    rrect(g, bx + 13 + i * 10, by, 7, 10, 2, i < s.streak ? (i < 4 ? '#93ddba' : '#ffd27d') : '#765943', 0);
  }
  if (s.lv) goalBar(t);
  else { // the day: a sun travelling along a line from open to close
    const ly = top + 46;
    const secondsLeft = Math.max(0, Math.ceil(s.day - s.clock));
    const labelWidth = ink(translate(daily ? 'daily' : 'open') + ' · ' + seconds(secondsLeft), 10, ly, 15);
    const x0 = 22 + labelWidth, x1 = W - 66, f = s.cust?.tutor ? 0 : Math.min(1, (V?.clock ?? s.clock) / s.day);
    g.strokeStyle = 'rgba(58,34,22,.35)'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, ly); g.lineTo(x1, ly); g.stroke();
    g.strokeStyle = '#fff6e4'; g.beginPath(); g.moveTo(x0, ly); g.lineTo(x0 + (x1 - x0) * f, ly); g.stroke();
    circle(g, x0 + (x1 - x0) * f, ly, 6, '#ffd860', 1.6);
  }
  // coins in flight towards the counter
  for (const c of flying) {
    if (c.t < 0) continue;
    const tx = W / 2 - 34, ty = y + 15, k = Math.min(1, c.t / 0.7), e = k * k;
    const x = (c.x + c.vx * c.t) * (1 - e) + tx * e, yy = (c.y + c.vy * c.t + 300 * c.t * c.t) * (1 - e) + ty * e;
    coin(g, x, yy, 9);
  }
  for (const p of confetti) { g.save(); g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.col; g.fillRect(-4, -2.5, 8, 5); g.restore(); }
}

// The goal, live: a pill with each part's icon and count, then the level clock as a bar with the star times marked on
// it. A timed level's bar runs out at the limit; an untimed one shows how long the stars stay in reach.
const ink = (text, x, y, size, col = '#fff6e4', align = 'left') => { g.font = `bold ${size}px ui-rounded, 'Arial Rounded MT Bold', sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.lineWidth = Math.max(3, size / 5); g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeText(text, x, y); g.fillStyle = col; g.fillText(text, x, y); return g.measureText(text).width; };
function objectiveIcon(kind, x, y, r, t, ctx = g) {
  if (kind === 'rush') {
    for (const side of [-1, 1]) {
      const dx = x + side * r * 0.6;
      circle(ctx, dx, y - r * 0.38, r * 0.33, '#ffdb9e', 1.5);
      rrect(ctx, dx - r * 0.35, y + r * 0.06, r * 0.7, r * 0.57, r * 0.22, '#7fc8ac', 1.4);
    }
  } else if (kind === 'blackout') {
    ctx.save();
    ctx.translate(x, y - r * 0.6);
    ctx.rotate(calm ? 0 : Math.sin(t * 3) * 0.35);
    rrect(ctx, -r * 0.6, 0, r * 1.2, r * 0.63, 4, '#d38749', 1.6);
    ctx.fillStyle = '#ffe3a9';
    ctx.beginPath(); ctx.moveTo(-r * 0.26, r * 0.58); ctx.lineTo(r * 0.26, r * 0.58);
    ctx.lineTo(r * 0.76, r * 1.65); ctx.lineTo(-r * 0.76, r * 1.65); ctx.fill();
    ctx.restore();
  } else if (kind === 'boss' || kind === 'order') {
    const steps = kind === 'boss' ? 3 : 2;
    for (let i = 0; i < steps; i++) {
      const dx = x + (i - (steps - 1) / 2) * r * 0.76;
      rrect(ctx, dx - r * 0.32, y - r * 0.55, r * 0.64, r * 1.1, 2, i === Math.floor(t * 2) % steps ? '#9fe1c3' : '#fff1d6', 1.3);
      ctx.font = `bold ${r * 0.65}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink;
      ctx.fillText(num(i + 1), dx, y + 1);
    }
  } else if (['coins', 'time', 'list', 'fix', 'safe'].includes(kind)) goalIcon(ctx, kind, x, y, r, t);
  else symbol(ctx, kind, x, y, r);
}
function goalBar(t) {
  const gs = goalState(s), ly = top + 47, lv = s.lv;
  let x = 10;
  const parts = gs.parts.map(p => ({ ...p, text: count(Math.min(p.have, p.need), p.need) }));
  g.font = `bold 17px ui-rounded, sans-serif`;
  const w = parts.reduce((a, p) => a + 26 + g.measureText(p.text).width + 8, 6) + (gs.safe ? 22 : 0);
  rrect(g, x, ly - 15, w, 30, 15, gs.met ? '#3f9e6a' : 'rgba(58,34,22,.72)', 2);
  x += 8;
  for (const p of parts) {
    objectiveIcon(p.kind, x + 10, ly, 10, t);
    x += 24 + ink(p.text, x + 24, ly + 1, 17, p.have >= p.need ? '#9ff0b0' : '#fff6e4') + 8;
  }
  if (gs.safe) { heart(g, x + 8, ly - 10, 18, s.lost === 0); x += 22; }
  // the clock bar
  const x0 = 10 + w + 14, x1 = W - 66, span = gs.time ?? Math.ceil(lv.stars[1] * 1.3), now = V?.clock ?? s.clock, f = Math.min(1, now / span);
  if (x1 - x0 < 50) return;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(58,34,22,.4)'; g.lineWidth = 8; g.beginPath(); g.moveTo(x0, ly); g.lineTo(x1, ly); g.stroke();
  const late = gs.time && gs.time - now < 10 && !s.cleared;
  g.strokeStyle = late ? (Math.sin(t * 12) > 0 ? C.red : '#ffb0a0') : '#fff6e4'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, ly); g.lineTo(x0 + (x1 - x0) * f, ly); g.stroke();
  for (const [i, k] of (s.assisted ? [[1, 2]] : [[0, 3], [1, 2]])) { // star marks under the bar: bright while still in reach
    const tx = x0 + (x1 - x0) * Math.min(1, lv.stars[i] / span), gone = (s.cleared ? s.clearT : now) > lv.stars[i];
    g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ly - 6); g.lineTo(tx, ly + 6); g.stroke();
    starShape(g, tx, ly + 14, k === 3 ? 7 : 5.5, gone ? 'rgba(255,255,255,.3)' : k === 3 ? '#ffd860' : '#f3ead8'); // gold: three stars; pale: two
  }
  if (gs.time) { const left = Math.max(0, Math.ceil(gs.time - now)); ink(seconds(left), x1, ly - 13, 14, late ? '#ffb0a0' : '#fff6e4', 'right'); }
  circle(g, x0 + (x1 - x0) * f, ly, 6, '#ffd860', 1.6);
}
// The goal card uses the same symbols as the live counter. The run waits for a tap or Space.
function briefLayout() {
  const cw = Math.min(W - 32, 340), intro = cleared(lvN) ? null : s.lv.intro;
  const ch = (intro ? 211 : 147) + (s.lv.goal.safe || s.lv.goal.list ? 21 : 0) + (s.lv.goal.coins ? 21 : 0);
  const y = Math.max(top + 65, Math.min(H - bottomInset - ch - 12, boxY + S / 2 - ch / 2 - 20));
  return { x: (W - cw) / 2, y, cw, ch, intro };
}
function positionStart() {
  const { y, ch } = briefLayout();
  $('startLevel').style.top = `${y + ch - 60}px`;
}
function goalCard(t) {
  const a = card > 0 ? 1 : cardFade / 0.3;
  if (a <= 0 || !s?.lv) return;
  const lv = s.lv, gs = goalState(s), { x, y, cw, ch, intro } = briefLayout();
  g.save();
  g.globalAlpha = a;
  g.fillStyle = 'rgba(58,34,22,.35)'; g.fillRect(-20, -20, W + 40, H + 40);
  g.translate(0, card > 0 ? 0 : (1 - a) * -20);
  rrect(g, x, y, cw, ch, 22, '#fff1d6', 3);
  const cx = W / 2;
  ink(translate('level', { n: num(lvN) }), cx, y + 22, 24, '#ffd29e', 'center');
  if (s.assisted) symbol(g, 'slower', x + 28, y + 23, 14);
  let yy = y + 47;
  if (intro) {
    g.save(); g.translate(cx - 33, yy - 10); g.scale(0.66, 0.66);
    drawJob(g, [previewRepair(intro)], 0, t, 0);
    g.restore();
    symbol(g, 'new', cx + 36, yy + 3, 13);
    yy += 64;
  }
  const items = gs.parts.map(({ kind, need }) => [kind, num(need)]);
  if (gs.time) items.push(['time', seconds(Math.ceil(gs.time))]);
  const spacing = Math.min(100, (cw - 29) / items.length);
  items.forEach(([kind, value], i) => {
    const xx = cx + (i - (items.length - 1) / 2) * spacing;
    objectiveIcon(kind, xx - 15, yy, 13, t);
    if (kind === 'rush') {
      for (const [j, dx] of [-23, -7].entries()) {
        const fill = calm ? 0.65 : 1 - ((t * (j ? 0.7 : 0.45)) % 1) * 0.85;
        rrect(g, xx + dx - 5, yy + 11, 10, 3, 1, '#a37d5d', 0);
        rrect(g, xx + dx - 5, yy + 11, 10 * fill, 3, 1, '#2f8f8a', 0);
      }
    }
    cardText(value, xx + 2, yy, 18, spacing - 29, 'left');
  });
  yy += 22;
  if (gs.safe) {
    symbol(g, 'lost', x + 23, yy, 9);
    cardText(translate('safeGoal'), x + 38, yy, 14, cw - 51, 'left');
    yy += 21;
  }
  if (lv.goal.coins) {
    coin(g, x + 23, yy, 8);
    cardText(translate('baseRule'), x + 38, yy, 14, cw - 51, 'left');
    yy += 21;
  }
  const target = s.assisted ? 2 : 3;
  for (let i = 0; i < 3; i++) starShape(g, cx - 45 + 16 * i, yy + 1, 7, i < target ? '#ffd860' : '#e3cfae');
  cardText('≤ ' + seconds(lv.stars[3 - target]), cx + 3, yy + 1, 15, cw / 2 - 12, 'left');
  g.restore();
}
function cardText(value, x, y, size, maxWidth, align) {
  g.font = `bold ${size}px ui-rounded, sans-serif`;
  g.fillStyle = C.ink; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(value, x, y, maxWidth);
}

// ---------- the loop: a fixed 60 Hz sim; a hidden tab or a pause never makes a catch-up burst
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  if (playing && !paused && !card) {
    acc += dt; let n = 0;
    while (acc >= DT && playing && n < 6) { snap(); if (kb) kbStep(); step(s); drain(); acc -= DT; n++; }
    if (n >= 6) acc = 0;
    // the radio, when owned: a soft tune in time with the shift
    if (has('radio')) { radioT += dt; const beat = 0.3; while (radioT >= beat) { radioT -= beat; radio(); } }
  }
  const live = !paused;
  if (live) {
    for (const p of ripples) p.t += dt; ripples = ripples.filter(p => p.t < 0.35);
    for (const b of bits) { b.t += dt; b.x += b.vx * dt * 0.3; b.y += b.vy * dt * 0.3; b.vy += 120 * dt; } bits = bits.filter(b => b.t < b.life);
    for (const c of flying) { c.t += dt; if (c.t >= 0.7 && !c.landed) { c.landed = true; shownCoins += c.value; tone(1800 + Math.random() * 300, 0.05, 0.04, 'square'); } }
    flying = flying.filter(c => !c.landed);
    for (const p of confetti) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= 1 - dt; p.r += p.vr * dt; } confetti = confetti.filter(p => p.t < p.life);
    multPop = Math.max(0, multPop - dt * 2.5); cardFade = Math.max(0, cardFade - dt);
    if (s && !flying.length) shownCoins = s.coins;
    if (feedback) { feedback.t += dt; if (feedback.t > 0.9) feedback = null; }
    if (banner) { banner.t += dt; if (banner.t > 1.6) banner = null; }
    shake = Math.max(0, shake - dt * 4); squash = Math.max(0, squash - dt * 8); wobble = Math.max(0, wobble - dt * 4); heartFlash = Math.max(0, heartFlash - dt * 1.5); catHappy = Math.max(0, catHappy - dt);
  }
  draw(now, live ? dt : 0);
  requestAnimationFrame(frame);
}
const TUNE = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 0];
let radioN = 0;
function radio() {
  if (save.sound) {
    const f = TUNE[radioN % TUNE.length];
    if (f) tone(f, 0.22, 0.025, 'triangle');
    if (radioN % 4 === 0) tone([131, 175, 196, 131][(radioN >> 2) % 4], 0.5, 0.03, 'sine');
  }
  radioN++;
}

kitHint(cv, {
  kind: 'hold-and-move', key: 'fixit:hint', played: save.served > 0,
  when: () => playing && !paused && !card && s.lv?.n === 1 && s.cust.n === 0,
  delay: 3500, reach: 30, bottom: 64, label: translate('screwMove'),
});
// A reload can resume only this tab's game. The permanent wallet is written at settlement.
const RELOAD_KEY = 'fixit:reload';
addEventListener('pagehide', event => {
  if (!playing || event.persisted) return;
  pause();
  const state = { ...s, cust: s.lanes.length ? undefined : s.cust, reps: undefined, rep: undefined };
  const checkpoint = { version: 1, url: location.href, mode, lvN, today, card, state, seenBase, jobKey };
  try { sessionStorage.setItem(RELOAD_KEY, JSON.stringify(checkpoint)); }
  catch { /* The campaign save remains available when tab storage is disabled. */ }
});

function restoreAfterReload() {
  let checkpoint;
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    sessionStorage.removeItem(RELOAD_KEY);
    checkpoint = JSON.parse(raw);
  } catch { return false; }
  const navigation = performance.getEntriesByType('navigation')[0]?.type;
  if (checkpoint?.version !== 1 || checkpoint.url !== location.href || (navigation && navigation !== 'reload')) return false;
  if (checkpoint.mode === 'daily' && checkpoint.today !== today) return false;
  const state = checkpoint.state;
  if (!Array.isArray(state?.lanes) || !Array.isArray(state.log) || !Array.isArray(state.queue)) return false;
  // Reconnect the active repair and lane to the objects the simulation updates.
  state.cust = state.lanes.length ? state.lanes[state.station] : state.cust;
  state.reps = state.cust?.reps;
  state.rep = state.reps?.[state.stepN];
  if (!KINDS.includes(state.rep?.kind)) return false;
  if (state.lv) state.day = Infinity;
  ({ mode, lvN, card, seenBase, jobKey } = checkpoint);
  s = state;
  daily = mode === 'daily';
  playing = true;
  paused = !s.cleared;
  benchControls = ['order', 'rush', 'boss'].includes(s.lv?.rule);
  layout();
  recCount = s.log.length;
  shownCoins = s.coins;
  rec.start({ ...runMetadata(), resumed: true });
  renderTickets();
  show(paused ? 'paused' : 'play');
  return true;
}
if (!restoreAfterReload()) show('menu');
translatePage();
requestAnimationFrame(frame);
