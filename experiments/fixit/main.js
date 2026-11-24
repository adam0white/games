// Fix-It Stall: the page. View, input, sound, save, cards. The rules are in sim.js.
import { create, step, input, guide, hint, multiplier, DT, KINDS, TUTOR, WORD, OBJECT, HIT, WORKS, LEAVE, LEVELS } from './sim.js';
import { plan, SKILLS } from './moves.js';
import { drawJob, drawGhost, person, looks, REGULAR, cat, heart, coin, sillyList, drawSilly, C, circle, rrect, star } from './art.js';
import { readJson, writeJson } from '../kit/save.js';
import { sound } from '../kit/audio.js';
import { onLeave, isPauseKey } from '../kit/pause.js';
import { screens } from '../kit/screens.js';
import { lab } from '../kit/lab.js';

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const ORDER = [...TUTOR, 'wheel', 'rub', 'clock', 'chain', 'glue', 'sharpen', 'sew', 'pump']; // the order new jobs unlock
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- the save: one JSON blob. Fields are listed in NOTES.md and only ever grow.
const KEY = 'fixit-save';
const save = { v: 1, bank: 0, best: 0, shifts: 0, unlocked: TUTOR.slice(), seen: {}, owned: ['teal'], awning: 'teal', sound: true, regular: 0, pending: null, bestStreak: 0, served: 0, days: {} };
{
  const old = readJson(KEY, null);
  if (old && typeof old === 'object') for (const k of Object.keys(save)) if (k in old && typeof old[k] === typeof save[k]) save[k] = old[k];
  if (old && typeof old.pending === 'string') save.pending = old.pending; // pending starts as null, so the type test above skips it
  for (const k of ['bank', 'best', 'shifts', 'regular', 'bestStreak', 'served']) if (!Number.isFinite(save[k]) || save[k] < 0) save[k] = 0;
  save.unlocked = ORDER.filter(k => Array.isArray(save.unlocked) && save.unlocked.includes(k));
  for (const k of TUTOR) if (!save.unlocked.includes(k)) save.unlocked.push(k);
  if (!Array.isArray(save.owned)) save.owned = ['teal'];
  if (!save.owned.includes('teal')) save.owned.push('teal');
  if (save.pending !== null && !KINDS.includes(save.pending)) save.pending = null;
  if (!save.seen || typeof save.seen !== 'object' || Array.isArray(save.seen)) save.seen = {};
  // days: the best daily-stall coins for each UTC date, newest 30 kept
  const days = save.days && typeof save.days === 'object' && !Array.isArray(save.days) ? save.days : {};
  save.days = Object.fromEntries(Object.entries(days).filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(v) && v >= 0).sort().slice(-30));
}
const store = () => writeJson(KEY, save);

// ---------- the shop
const AWNING = { teal: ['#2f8f8a', '#fff1d6'], copper: ['#c8743a', '#fbe6c2'], berry: ['#a8325a', '#f7c9d6'], stripes: ['#e0a43a', '#2f8f8a'] };
const ITEMS = [
  { id: 'teal', name: 'Teal awning', what: 'The one you started with', cost: 0, awning: true },
  { id: 'copper', name: 'Copper awning', what: 'Warm stripes', cost: 50, awning: true },
  { id: 'berry', name: 'Berry awning', what: 'Pink and plum', cost: 90, awning: true },
  { id: 'lights', name: 'String lights', what: 'Bulbs under the awning', cost: 140 },
  { id: 'radio', name: 'Radio', what: 'Plays a little tune', cost: 180 },
  { id: 'stripes', name: 'Sunny awning', what: 'Gold and teal', cost: 220, awning: true },
  { id: 'cat', name: 'Stall cat', what: 'Sits on the counter', cost: 280 },
  { id: 'charm', name: 'Lucky horseshoe', what: 'One more heart', cost: 400 },
];
const has = id => save.owned.includes(id);

// ---------- canvas and layout (CSS pixels)
const cv = $('c'), g = cv.getContext('2d');
let W = 0, H = 0, dpr = 1, top = 0, bottomInset = 0, benchTop = 0, S = 300, boxX = 0, boxY = 0, unit = 3;
function layout() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const cs = getComputedStyle($('probe'));
  top = parseFloat(cs.paddingTop) || 0; bottomInset = parseFloat(cs.paddingBottom) || 0;
  benchTop = top + Math.min(200, Math.max(160, H * 0.3));
  const avail = H - benchTop - 12 - bottomInset, word = 40;
  S = Math.max(200, Math.min(W - 20, avail - word, 560));
  boxX = (W - S) / 2; boxY = benchTop + word + Math.max(0, (avail - word - S) / 2); unit = S / 100;
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
};
const shimmer = () => [1568, 2093, 2637, 3136].forEach((f, i) => later(i * 60, () => tone(f, 0.3, 0.04, 'triangle')));
// A short buzz on phones that have one, tied to the sound setting.
const buzz = ms => { if (save.sound && navigator.vibrate) try { navigator.vibrate(ms); } catch {} };

// ---------- run state
let s = null, playing = false, paused = false, screen = 'menu', acc = 0, last = performance.now(), clock = 0;
let finger = null; // { id } of the pointer driving the bench
let ripples = [], bits = [], flying = [], confetti = [], multPop = 0, kb = null, prev = null, drawn = [], shownCoins = 0, word = null, banner = null, shake = 0, squash = 0, wobble = 0, pop = 1;
let seenBase = 0, jobKey = null, leaving = [], spots = new Map(), heartFlash = 0, catHappy = 0, recCount = 0, multWas = 1, radioT = 0, newJob = null, hintNow = 0, ended = 0;
let counterReset = () => { counter = null; };
const seed0 = Number(query.get('seed'));
const only = KINDS.includes(query.get('only')) ? query.get('only') : null;
const twoQ = query.has('two') ? Number(query.get('two')) : null;
const dayLen = Number(query.get('day')) > 0 ? Number(query.get('day')) : undefined;
const startLevel = Math.max(0, Math.min(LEVELS - 1, Number(query.get('level')) || 0));
let runN = 0;
const goldenQ = query.get('golden') === '1';
// The daily stall: one seed for everyone on the same UTC date (?date=YYYY-MM-DD to pick another day).
const today = /^\d{4}-\d{2}-\d{2}$/.test(query.get('date') ?? '') ? query.get('date') : new Date().toISOString().slice(0, 10);
const dateSeed = d => { let h = 2166136261; for (const ch of 'fixit-daily-' + d) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
let daily = false;

const show = screens(['menu', 'shop', 'paused', 'end'], name => {
  screen = name;
  $('pause').style.display = name === 'play' ? 'grid' : 'none';
  if (name === 'menu') menu();
  if (name === 'shop') shop();
  for (const id of ['sound1', 'sound2']) $(id).textContent = `Sound: ${save.sound ? 'on' : 'off'}`;
});
function menu() {
  $('bank').textContent = save.bank; $('best').textContent = save.best; $('jobs').textContent = save.unlocked.length; $('jobsAll').textContent = KINDS.length;
  $('daily').style.display = save.shifts >= 1 ? '' : 'none';
  $('dailyLine').textContent = save.shifts >= 1 ? (today in save.days ? `Today's stall: best ${save.days[today]}` : 'Same stall for everyone today. All jobs.') : '';
}

function shop() {
  $('bank2').textContent = save.bank;
  const box = $('items'); box.textContent = '';
  for (const it of ITEMS) {
    const row = document.createElement('div'); row.className = 'item';
    const pic = document.createElement('canvas'); pic.width = pic.height = 96; icon(pic.getContext('2d'), it.id);
    const txt = document.createElement('div'); txt.textContent = it.name; const sm = document.createElement('small'); sm.textContent = it.what; txt.append(sm);
    const b = document.createElement('button'); b.dataset.item = it.id;
    if (!has(it.id)) { b.textContent = `Buy ${it.cost}`; b.disabled = save.bank < it.cost; }
    else if (it.awning) { b.textContent = save.awning === it.id ? 'In use' : 'Use'; if (save.awning === it.id) b.classList.add('on'); }
    else { b.textContent = 'Owned'; b.classList.add('on'); b.disabled = true; }
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

// ---------- a shift
function begin(isDaily = false) {
  snd.unlock();
  daily = isDaily === true;
  const tutorial = save.shifts === 0 && !only && !daily;
  newJob = !only && !daily && save.pending && save.unlocked.includes(save.pending) ? save.pending : null;
  const hearts = daily ? 3 : 3 + (has('charm') ? 1 : 0);
  const seed = daily ? dateSeed(today) : Number.isFinite(seed0) && query.has('seed') ? seed0 + runN : (Math.random() * 2 ** 31) | 0;
  runN++;
  const gold = goldenQ ? { golden: 1, goldenFrom: 0 } : {};
  s = daily
    ? create({ seed, unlocked: KINDS, hearts, two: true, day: dayLen, startLevel, ...gold })
    : create({ seed, unlocked: save.unlocked, tutorial, hearts, newJob, only, regular: save.shifts >= 1 && !only ? save.regular : -1, two: twoQ !== null ? twoQ : only ? false : save.shifts >= 1, day: dayLen, startLevel, ...gold });
  if (newJob) { save.pending = null; store(); }
  playing = true; paused = false; acc = 0; last = performance.now(); clock = 0; ended = 0;
  ripples = []; bits = []; flying = []; confetti = []; shownCoins = 0; leaving = []; spots = new Map(); word = null; banner = null; recCount = 0; multWas = 1; multPop = 0; finger = null; kb = null; jobKey = null; prev = null; counterReset();
  show('play');
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); // so Space drives the bench, not the last button
  rec.start(daily ? { mode: 'daily', date: today } : { mode: 'day', unlocked: save.unlocked.length, shift: save.shifts + 1, tutorial, only });
  drain();
}
function finish() {
  playing = false; ended = performance.now();
  const why = s.over;
  save.shifts++; save.bank += s.coins; save.served += s.served;
  const newBest = !daily && s.coins > save.best; if (!daily) save.best = Math.max(save.best, s.coins); // the daily stall keeps its own best per day save.bestStreak = Math.max(save.bestStreak, s.bestStreak);
  let unlocked = null, dayBest = false;
  if (daily) { dayBest = !(today in save.days) || s.coins > save.days[today]; save.days[today] = Math.max(save.days[today] ?? 0, s.coins); save.days = Object.fromEntries(Object.entries(save.days).sort().slice(-30)); }
  if (!only && !daily && s.served >= 4) { unlocked = ORDER.find(k => !save.unlocked.includes(k)) ?? null; if (unlocked) { save.unlocked.push(unlocked); save.pending = unlocked; } }
  store();
  rec.end('closed', { coins: s.coins, served: s.served, lost: s.lost, bestStreak: s.bestStreak, why, ...(daily ? { daily: today } : {}) });
  $('endTitle').textContent = daily ? (why === 'hearts' ? 'Daily stall: out of hearts' : 'Daily stall closed!') : why === 'hearts' ? 'Out of hearts' : 'Closed!';
  $('earned').textContent = s.coins; $('served').textContent = s.served; $('streak').textContent = s.bestStreak; $('best2').textContent = daily ? save.days[today] ?? s.coins : save.best;
  $('endLine').textContent = newBest && s.coins > 0 ? 'New best!' : why === 'hearts' ? `${s.lost} customers walked off.` : `You have ${save.bank} coins.`;
  if (daily) $('endLine').textContent = dayBest && s.coins > 0 ? `Best today! ${s.coins} coins.` : `Today's best: ${save.days[today]}.`;
  $('again').textContent = daily ? 'Daily again' : 'Play again';
  $('newjob').textContent = daily ? `Daily stall ${today}. Come back tomorrow for a new one.` : unlocked ? `Next shift: a new job! (${OBJECT[unlocked]})` : save.unlocked.length < KINDS.length && s.served < 4 ? 'Fix 4 in a shift to get a new job.' : '';
  if (newBest && s.coins > 0) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.4, 0.09, 'triangle'), i * 120));
  else [523, 392].forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.08, 'triangle'), i * 160));
  setTimeout(() => { if (!playing && screen === 'play') show('end'); }, 700);
}
function quit() {
  if (!s || !playing) { show('menu'); return; }
  rec.end('left', { coins: s.coins, served: s.served, lost: s.lost, bestStreak: s.bestStreak, why: 'menu' });
  save.bank += s.coins; save.served += s.served; store(); // a shift left early keeps its coins (tester t1, note #150); it does not count as a shift, a best or an unlock
  playing = false; paused = false; snd.release(); show('menu');
}

// Everything the sim reported: sound, words, sparks. Called after each input and each tick, so a touch is answered in the same frame.
function drain() {
  if (!s) return;
  for (const e of s.events) react(e);
  s.events.length = 0;
  while (recCount < s.log.length && recCount < 120) { const l = s.log[recCount++]; rec.event('repair', l); }
  const key = s.cust && `${s.cust.n}:${s.stepN}`;
  if (key !== jobKey) { // a new job on the bench: note how often this kind was seen before, for the hint
    jobKey = key;
    const k = s.rep.kind; seenBase = save.seen[k] ?? 0; save.seen[k] = seenBase + 1;
    word = { text: WORD[k], t: 0, kind: 'job' };
    pop = 0;
  }
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
    case 'fixed': tone(1047, 0.15, 0.08, 'triangle'); break;
    case 'step': word = { text: 'One more!', t: 0, kind: 'job', then: WORD[e.kind] }; break;
    case 'paid': {
      (WORKS_SOUND[OBJECT[e.kinds[0]]] ?? (() => {}))();
      const m = multiplier(s), st = e.streak;
      // the streak, felt: a rising run of notes, a word, and confetti that grows with it
      const streakWord = m > multWas ? `x${m}!` : st >= 6 ? 'On fire!' : st >= 4 ? 'Hot!' : st === 3 ? 'Great!' : st === 2 ? 'Nice!' : null;
      word = { text: e.golden ? 'Golden fix!' : streakWord ?? (e.quick ? 'Fixed! Quick!' : 'Fixed!'), t: 0, kind: e.golden ? 'gold' : 'good', streak: st };
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
      tone(220, 0.45, 0.14, 'sawtooth', -90); word = { text: 'Too slow!', t: 0, kind: 'bad' }; heartFlash = 1; if (!calm) shake = 1; multWas = 1; buzz(80);
      break;
    case 'next': {
      walkOff();
      if (e.golden) { banner = { text: 'Golden job!', t: 0, gold: true }; shimmer(); }
      else if (e.fresh) { banner = { text: 'New job!', t: 0 }; [523, 784, 1047].forEach((f, i) => later(i * 110, () => tone(f, 0.25, 0.08, 'triangle'))); }
      else if (e.regular) { banner = { text: 'Me again!', t: 0 }; tone(392, 0.15, 0.08, 'triangle'); later(130, () => tone(523, 0.2, 0.08, 'triangle')); save.regular++; }
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
  if (!playing || paused || finger || kb) return;
  e.preventDefault();
  finger = { id: e.pointerId };
  try { cv.setPointerCapture(e.pointerId); } catch {}
  input(s, { type: 'down', ...toLocal(e) }); drain();
});
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
rec.notice($('menu').firstElementChild);
rec.toggle($('paused').firstElementChild);
$('play').addEventListener('click', () => begin(false));
$('again').addEventListener('click', () => { if (performance.now() - ended > 500) begin(daily); });
$('daily').addEventListener('click', () => begin(true));
$('toShop').addEventListener('click', () => { snd.unlock(); show('shop'); });
for (const b of document.querySelectorAll('.back')) b.addEventListener('click', () => show('menu'));
$('toMenu').addEventListener('click', () => show('menu'));
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', quit);
for (const id of ['sound1', 'sound2']) $(id).addEventListener('click', () => {
  save.sound = !save.sound; store();
  if (save.sound) { snd.unlock(); tone(660, 0.1, 0.06, 'triangle'); }
  for (const b of ['sound1', 'sound2']) $(b).textContent = `Sound: ${save.sound ? 'on' : 'off'}`;
});
// The keyboard: holding Space does the job in front of you at an everyday pace (moves.js, the same finger paths the
// bots use), one step per sim tick. Letting go lifts the finger. Every repair can be done this way.
function kbStep() {
  const lift = () => { if (kb.down) { input(s, { type: 'up', x: kb.x, y: kb.y }); kb.down = false; } };
  if (s.phase !== 'work') { lift(); kb.plan = []; kb.i = 0; return; }
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
  if (!playing || paused) return;
  kbRelease(); // lift the keyboard's finger while the sim still takes input
  paused = true;
  if (finger) { input(s, { type: 'cancel', x: 0, y: 0 }); drain(); finger = null; } // the sim lets go of whatever was held
  snd.hold(); show('paused');
}
function resume() {
  if (!paused) return;
  paused = false; acc = 0; last = performance.now();
  show('play'); snd.release();
}
$('pause').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pause(); });
$('pause').addEventListener('click', e => { e.preventDefault(); pause(); });
onLeave(pause);
addEventListener('keydown', e => {
  if (isPauseKey(e)) { if (paused) resume(); else pause(); return; }
  if (isSpace(e) && playing && !paused) { e.preventDefault(); if (!kb && !finger && !e.repeat) kb = { plan: [], i: 0, key: null, x: 50, y: 110, down: false }; return; }
  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !playing && screen !== 'play') { const b = screen === 'menu' ? $('play') : screen === 'end' ? $('again') : null; if (b) { e.preventDefault(); b.click(); } }
});

// The state the browser check reads.
window.fixitState = () => ({
  screen, playing, paused, t: s?.t ?? 0, clock: s?.clock ?? 0, day: s?.day ?? 0, over: s?.over ?? null,
  coins: s?.coins ?? 0, hearts: s?.hearts ?? 0, served: s?.served ?? 0, lost: s?.lost ?? 0, streak: s?.streak ?? 0, phase: s?.phase ?? null,
  kind: s?.rep?.kind ?? null, step: s?.stepN ?? 0, steps: s?.reps?.length ?? 0, p: s?.rep?.p ?? 0, job: s?.cust?.n ?? -1,
  guide: s?.rep && s.phase === 'work' ? guide(s.rep) : null, hint: hintNow,
  box: { x: boxX, y: boxY, unit }, minTouchPx: Math.min(...Object.values(HIT)) * 2 * unit,
  bank: save.bank, best: save.best, shifts: save.shifts, unlocked: [...save.unlocked], owned: [...save.owned], awning: save.awning, sound: save.sound, pending: save.pending,
  customer: s?.cust ? { n: s.cust.n, kinds: s.cust.kinds, regular: s.cust.regular, golden: s.cust.golden, left: s.cust.left, patience: s.cust.patience } : null,
  word: word?.text ?? null, confetti: confetti.length, golden: !!s?.cust?.golden, queue: s ? s.queue.map(c => c.kinds[0]) : [], daily, today, days: { ...save.days }, keyboard: !!kb, alpha: Math.min(1, acc / DT),
  people: drawn.map(p => ({ x: Math.round(p.x * 10) / 10, R: Math.round(p.R * 10) / 10, who: p.who })),
});

// ---------- interpolation: the sim runs at 60 Hz; the screen may run faster or out of step. Before each tick the
// moving parts are noted, and drawing blends from that note to the current state by how far into the next tick we are.
const LERP = ['p', 'u', 'h', 'ang', 'seat', 'w', 'hand', 'pull', 'ox', 'oy', 'set', 'lx', 'ly', 'slot', 'strokes'];
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
  street(t);
  people(t, dt);
  awning(t);
  bench(t);
  if (s && (playing || screen === 'end' || screen === 'paused')) job(t, dt); else idleJob(t);
  for (const b of bits) { const [x, y] = local(b.x, b.y); g.globalAlpha = Math.max(0, 1 - b.t / b.life); star(g, x, y, 4, b.col); g.globalAlpha = 1; }
  hud(t, dt);
  if (has('cat')) cat(g, 38, benchTop + 8, 1.05, t, catHappy > 0);
}
function street(t) {
  const sky = g.createLinearGradient(0, 0, 0, benchTop);
  sky.addColorStop(0, '#f7cf93'); sky.addColorStop(1, '#ee9f6a');
  g.fillStyle = sky; g.fillRect(-20, -20, W + 40, benchTop + 40);
  const sun = g.createRadialGradient(W * 0.82, top + 70, 4, W * 0.82, top + 70, 120); sun.addColorStop(0, 'rgba(255,248,200,.9)'); sun.addColorStop(1, 'rgba(255,248,200,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, benchTop);
  // the street behind: rooftops and windows, a little darker
  const base = benchTop - 20;
  for (let i = 0, x = -10; x < W + 20; i++) {
    const w = 60 + ((i * 37) % 40), h = 70 + ((i * 53) % 60);
    g.fillStyle = i % 2 ? '#d98a5c' : '#cf7d52'; g.fillRect(x, base - h, w, h + 30);
    g.fillStyle = 'rgba(255,240,200,.45)'; for (let wy = base - h + 14; wy < base - 18; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 22) g.fillRect(wx, wy, 10, 14);
    g.fillStyle = '#b7643f'; g.fillRect(x - 3, base - h - 6, w + 6, 8);
    x += w + 6;
  }
  g.fillStyle = '#c98a62'; g.fillRect(0, base, W, benchTop - base + 2);
}
const QUEUE_GAP = () => Math.min(92, W * 0.22);
function custTarget(i) { return { x: W / 2 - QUEUE_GAP() * (i + 0.95) - 10, R: Math.max(13, 23 - i * 3), base: benchTop - 26 - i * 3 }; }
function people(t, dt) {
  if (!s || !(playing || screen === 'end' || screen === 'paused')) { // menu: a customer waves at the empty stall
    person(g, W / 2, benchTop + 6, 32, looks(12345), 'happy', t, { cheer: 0.5 + 0.5 * Math.sin(t * 3), bob: Math.sin(t * 2) * 2 });
    return;
  }
  const R = Math.min(34, (benchTop - top - 70) / 3.4);
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
  const L = c.regular ? REGULAR : looks(c.look);
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
    // a notch at the half-way mark: fixed before the ring runs down to it counts as quick
    g.strokeStyle = C.ink; g.lineWidth = 2.5; g.beginPath(); g.moveTo(hx, hy + rr * pulse - 6); g.lineTo(hx, hy + rr * pulse + 6); g.stroke();
  }
  counter = { n: c.n, x: sp.x, base: sp.base, R: sp.R, L, happy: s.phase === 'works' || (counter?.n === c.n && counter.happy) };
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
function awning(t) {
  const [a, b] = AWNING[save.awning] ?? AWNING.teal, y0 = top + 50, h = 26, w = 30;
  g.fillStyle = '#6a3a1f'; g.fillRect(0, y0 - 6, W, 6);
  for (let i = 0, x = 0; x < W; i++, x += w) {
    g.fillStyle = i % 2 ? b : a; g.fillRect(x, y0, w, h);
    g.beginPath(); g.arc(x + w / 2, y0 + h, w / 2, 0, Math.PI); g.fill();
  }
  g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y0); g.lineTo(W, y0); g.stroke();
  if (has('lights')) for (let x = 15, i = 0; x < W; x += 30, i++) { const on = Math.sin(t * 3 + i) > -0.3; g.fillStyle = on ? ['#fff3a8', '#ffb46a', '#9ff0e0'][i % 3] : '#9a8a70'; if (on) { g.shadowColor = '#ffe08a'; g.shadowBlur = 10; } g.beginPath(); g.arc(x, y0 + h + 18, 5, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; }
  if (has('charm')) { g.strokeStyle = C.ink; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W - 34, y0 + h + 10); g.lineTo(W - 34, y0 + h + 22); g.stroke(); g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.arc(W - 34, y0 + h + 34, 10, Math.PI * 0.85, Math.PI * 2.15, true); g.stroke(); g.strokeStyle = C.steelLt; g.lineWidth = 4.5; g.stroke(); }
  if (has('radio')) { rrect(g, W - 64, benchTop - 22, 40, 26, 5, C.copper, 2); circle(g, W - 52, benchTop - 9, 7, C.cream, 1.6); g.fillStyle = C.ink; g.fillRect(W - 40, benchTop - 16, 10, 3); g.fillRect(W - 40, benchTop - 9, 10, 3); }
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
  drawJob(g, V.reps, s.stepN, t, works);
  if (s.cust.regular) drawSilly(g, sillyList(save.regular), t);
  // the hint: a ghost finger doing the gesture on the thing
  hintNow = playing && !paused ? hint(s, seenBase) : 0;
  if (hintNow && s.phase === 'work') drawGhost(g, guide(r), t, hintNow * (0.75 + 0.25 * Math.sin(t * 5)));
  if (kb && s.phase === 'work') { // the keyboard's finger: a fingertip that presses while Space is held
    g.fillStyle = kb.down ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(kb.x, kb.y, kb.down ? 7 : 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke();
  }
  for (const p of ripples) { g.strokeStyle = p.col; g.globalAlpha = Math.max(0, 1 - p.t * 3); g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 6 + p.t * 60, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  g.globalAlpha = 1;
  // the word: what to do, or how it went. Above the object, never under the finger.
  if (word) {
    const a = word.t < 0.15 ? word.t / 0.15 : 1, big = word.kind === 'job' ? 30 : 34;
    g.save(); g.translate(W / 2, boxY - 18); g.scale(0.8 + 0.2 * a, 0.8 + 0.2 * a);
    g.font = `bold ${big}px ui-rounded, 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.strokeText(word.text, 0, 0);
    g.fillStyle = word.kind === 'good' ? '#9ff0b0' : word.kind === 'gold' ? '#ffd860' : word.kind === 'bad' ? '#ffb0a0' : '#fff6e4';
    if (word.streak >= 2 && !calm) g.rotate(Math.sin(word.t * 30) * 0.06 * Math.max(0, 1 - word.t * 2));
    g.fillText(word.text, 0, 0);
    g.restore();
    if (s.reps.length > 1 && s.phase === 'work') for (let i = 0; i < s.reps.length; i++) circle(g, W / 2 - 10 + i * 20, boxY + 6, 6, i < s.stepN ? '#7fe0a0' : i === s.stepN ? C.cream : 'rgba(255,255,255,.3)', 2);
  }
  if (banner) {
    const a = Math.min(1, banner.t * 6) * Math.min(1, (1.6 - banner.t) * 4);
    if (a > 0) { g.save(); g.globalAlpha = a; g.translate(W / 2, benchTop - 8); g.rotate(-0.04); rrect(g, -78, -20, 156, 40, 14, banner.gold ? '#ffd860' : C.amber, 3); g.font = 'bold 22px ui-rounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.ink; g.fillText(banner.text, 0, 1); g.restore(); }
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
  if (!s || !(playing || screen === 'end' || screen === 'paused')) return;
  const y = top + 8;
  for (let i = 0; i < s.maxHearts; i++) heart(g, 22 + i * 28, y + 2 + (heartFlash > 0 && i === s.hearts ? Math.sin(t * 40) * 3 : 0), 24, i < s.hearts);
  // coins: the number counts up as the flying coins land
  coin(g, W / 2 - 34, y + 15, 13);
  g.font = 'bold 26px ui-rounded, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = C.ink; g.lineJoin = 'round';
  g.strokeText(String(shownCoins), W / 2 - 16, y + 16); g.fillStyle = '#fff6e4'; g.fillText(String(shownCoins), W / 2 - 16, y + 16);
  const m = multiplier(s);
  if (m > 1) { // the multiplier badge pops when it goes up
    const bx = W / 2 - 16 + g.measureText(String(shownCoins)).width + 10, k = 1 + 0.5 * multPop * (calm ? 0.3 : 1);
    g.save(); g.translate(bx + 17, y + 16); g.scale(k, k); rrect(g, -17, -12, 34, 24, 10, multPop > 0.01 ? C.amber : C.teal, 2); g.fillStyle = '#fff6e4'; g.font = 'bold 16px ui-rounded, sans-serif'; g.textAlign = 'center'; g.fillText(`x${m}`, 0, 1); g.restore();
  }
  // the day: a sun travelling along a line from open to close
  const x0 = 14, x1 = W - 66, ly = top + 44, f = s.cust?.tutor ? 0 : Math.min(1, (V?.clock ?? s.clock) / s.day);
  g.strokeStyle = 'rgba(58,34,22,.35)'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, ly); g.lineTo(x1, ly); g.stroke();
  g.strokeStyle = '#fff6e4'; g.beginPath(); g.moveTo(x0, ly); g.lineTo(x0 + (x1 - x0) * f, ly); g.stroke();
  circle(g, x0 + (x1 - x0) * f, ly, 6, '#ffd860', 1.6);
  // coins in flight towards the counter
  for (const c of flying) {
    if (c.t < 0) continue;
    const tx = W / 2 - 34, ty = y + 15, k = Math.min(1, c.t / 0.7), e = k * k;
    const x = (c.x + c.vx * c.t) * (1 - e) + tx * e, yy = (c.y + c.vy * c.t + 300 * c.t * c.t) * (1 - e) + ty * e;
    coin(g, x, yy, 9);
  }
  for (const p of confetti) { g.save(); g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.col; g.fillRect(-4, -2.5, 8, 5); g.restore(); }
}

// ---------- the loop: a fixed 60 Hz sim; a hidden tab or a pause never makes a catch-up burst
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  if (playing && !paused) {
    acc += dt; let n = 0;
    while (acc >= DT && playing && n < 6) { snap(); if (kb) kbStep(); step(s); drain(); acc -= DT; n++; }
    if (n >= 6) acc = 0;
    // the radio, when owned: a soft tune in time with the shift
    if (has('radio') && save.sound) { radioT += dt; const beat = 0.3; while (radioT >= beat) { radioT -= beat; radio(); } }
  }
  const live = !paused;
  if (live) {
    for (const p of ripples) p.t += dt; ripples = ripples.filter(p => p.t < 0.35);
    for (const b of bits) { b.t += dt; b.x += b.vx * dt * 0.3; b.y += b.vy * dt * 0.3; b.vy += 120 * dt; } bits = bits.filter(b => b.t < b.life);
    for (const c of flying) { c.t += dt; if (c.t >= 0.7 && !c.landed) { c.landed = true; shownCoins += c.value; tone(1800 + Math.random() * 300, 0.05, 0.04, 'square'); } }
    flying = flying.filter(c => !c.landed);
    for (const p of confetti) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= 1 - dt; p.r += p.vr * dt; } confetti = confetti.filter(p => p.t < p.life);
    multPop = Math.max(0, multPop - dt * 2.5);
    if (s && !flying.length) shownCoins = s.coins;
    if (word) { word.t += dt; if (word.then && word.t > 0.7) word = { text: word.then, t: 0, kind: 'job' }; else if (word.kind !== 'job' && word.t > 0.9) word = null; }
    if (banner) { banner.t += dt; if (banner.t > 1.6) banner = null; }
    if (s && s.phase === 'work' && word === null) word = { text: WORD[s.rep.kind], t: 0.2, kind: 'job' };
    shake = Math.max(0, shake - dt * 4); squash = Math.max(0, squash - dt * 8); wobble = Math.max(0, wobble - dt * 4); heartFlash = Math.max(0, heartFlash - dt * 1.5); catHappy = Math.max(0, catHappy - dt);
  }
  draw(now, live ? dt : 0);
  requestAnimationFrame(frame);
}
const TUNE = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 0];
let radioN = 0;
function radio() { const f = TUNE[radioN % TUNE.length]; if (f) tone(f, 0.22, 0.025, 'triangle'); if (radioN % 4 === 0) tone([131, 175, 196, 131][(radioN >> 2) % 4], 0.5, 0.03, 'sine'); radioN++; }

show('menu');
requestAnimationFrame(frame);
