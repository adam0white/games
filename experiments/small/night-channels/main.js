import { create, dig, tick, GARDENS } from './sim.js';
import { render, geometry } from './render.js';
import { stroke } from './stroke.js';
import { par as findPar, wetNetwork, PARS } from './plan.js';
import { t, lang, apply, setLang } from './words.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { lab } from '../../kit/lab.js';
import { home } from '../../kit/home.js';

noZoom();
const get = id => document.getElementById(id);
const canvas = get('garden');
const terrain = get('terrain');
const key = 'night-channels:save';
// Per-garden fewest cuts, added with gardens 11-30. The old save key keeps its format.
const bestKey = 'night-channels:gardens';
const query = new URLSearchParams(location.search);
const look = query.get('look') === 'clay' ? 'clay' : 'moon';
document.documentElement.dataset.look = look;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const number = n => String(n).padStart(2,'0');
function today() {
  const d = new Date();
  return [d.getFullYear(), number(d.getMonth()+1), number(d.getDate())].join('-');
}
// `completed` meant "garden 10 flowered" before gardens 11-30 existed, so it opens garden 11.
function load() {
  const raw = readJson(key, null);
  const completed = raw?.completed === true;
  const unlocked = Number.isInteger(raw?.unlocked) ? Math.max(1, Math.min(GARDENS, raw.unlocked)) : 1;
  return { unlocked: completed ? Math.max(unlocked, 11) : unlocked, completed, sound: raw?.sound !== false };
}
let saved = load();
const dailyBests = new Map();
let gardenBests = readBests();
let saveFailed = false;
function readBests() {
  const raw = readJson(bestKey, {});
  const out = {};
  for (const [k, v] of Object.entries(raw && typeof raw === 'object' ? raw : {})) if (Number.isInteger(v) && v >= 0) out[k] = v;
  return out;
}
function bestOn(date) {
  if (!date) return null;
  const disk = readJson(key + ':best:' + date);
  const local = dailyBests.get(date) ?? Infinity;
  const cuts = Math.min(local, Number.isInteger(disk) && disk >= 0 ? disk : Infinity);
  return Number.isFinite(cuts) ? cuts : null;
}
function reportSave(ok) {
  saveFailed = !ok;
  get('saveStatus').textContent = ok ? '' : t('saveFailed');
}
function store(soundChanged = false) {
  const disk = load();
  saved.unlocked = Math.max(saved.unlocked, disk.unlocked);
  saved.completed ||= disk.completed;
  if (!soundChanged && !saveFailed) saved.sound = disk.sound;
  reportSave(writeJson(key, saved));
}
const audio = sound({ on:() => saved.sound });
// Par for each garden and date is worked out once: the fewest cuts of a planned route the rules confirm flowers.
// A daily's par is found once per date, in a worker so the tap that opens the daily does not stall.
// Until it answers the par reads "–". Without workers it is found here.
const pars = new Map();
let planner = null;
try {
  planner = new Worker(new URL('./par-worker.js', import.meta.url), { type: 'module' });
  planner.onmessage = ({ data }) => { pars.set(data.id, data.cuts); update(); };
  planner.onerror = () => { planner = null; for (const [id, v] of pars) if (v === undefined) pars.delete(id); update(); };
} catch { planner = null; }
function parOf(n, date) {
  if (!date) return PARS[n - 1] ?? null;
  const id = 'd' + n + ':' + date;
  if (!pars.has(id)) {
    if (planner) { pars.set(id, undefined); planner.postMessage({ id, level: n, date }); }
    else pars.set(id, findPar({ create, dig, tick }, n, date)?.cuts ?? null);
  }
  return pars.get(id) ?? null;
}
let level = saved.unlocked, day = null, state = create(level), screen = 'play';
let pointer = null, previous = null, lastSound = -Infinity, line = null;
let elapsed = 0, carry = 0, lastFrame = null, blooms = 0, clock = 0;
let touched = false, connected = false, lastCutTick = 0, lastCutAt = -Infinity, hurry = false;
let wet = new Set(), effects = [], shared = '', status = '', wonAt = null;
// A short buzz where the phone has one (Android); silent elsewhere.
const buzz = pattern => { try { if (!reduced.matches) navigator.vibrate?.(pattern); } catch {} };
const show = screens(['paused','selection'], name => {
  screen = name;
  const modal = name === 'paused' || name === 'selection';
  document.querySelector('main').inert = modal;
  get('pause').hidden = name === 'won';
  if (modal) get(name === 'paused' ? 'resume' : 'return').focus({preventScroll:true});
});

// Sound and motion for every player action. Motion is drawn on the canvas (render.js) or by CSS on buttons.
let lastRefuse = -Infinity;
const feel = {
  cut(i, y) {
    effects.push({ kind:'cut', i, at:clock });
    const now = performance.now();
    if (now - lastSound > 65) { audio.noise(.065,.085,760 + y * 45); lastSound = now; buzz(6); }
    pulse('cuts');
  },
  refuse(i, why) {
    effects.push({ kind:'refuse', i, at:clock });
    const now = performance.now();
    if (now - lastRefuse > 140) { audio.tone(why === 'spent' ? 196 : 130, .11, .05, 'triangle', -40); lastRefuse = now; }
    if (why === 'spent') pulse('cuts', 'shake');
    if (now - lastRefuse < 1) buzz([12, 40, 12]);
  },
  wet(i) { effects.push({ kind:'wet', i, at:clock }); audio.tone(988,.14,.03,'sine',180); buzz(10); },
  bloom(i) { effects.push({ kind:'bloom', i, at:clock }); audio.tone(523,.5,.050,'sine'); audio.tone(784,.62,.034,'sine'); pulse('bloom'); buzz([18, 50, 18]); },
  win() {
    effects.push({ kind:'win', i:state.source, at:clock });
    wonAt = clock;
    buzz([25, 60, 25, 60, 45]);
    [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => audio.tone(f, .7, .04, 'sine'), 110 * k));
    pulse('result');
  },
  button() { audio.tone(660,.05,.025,'sine',120); },
};
function pulse(id, kind = 'pop') {
  const el = get(id);
  if (!el || reduced.matches) return;
  el.classList.remove('pop', 'shake');
  void el.offsetWidth;
  el.classList.add(kind);
}

// Once all cuts are spent, a bed behind an intact bank cannot receive water.
// A connected bed can still take time to soak, especially downstream of sand.
function isolatedBed() {
  const open = wetNetwork(state);
  return state.beds.some(i => !open.has(i));
}
const parNow = () => parOf(level, day);
function folio() {
  return day ? t('folioDaily', { date: day }) : t('folio', { n: number(level), total: GARDENS });
}
function update() {
  get('folio').textContent = folio();
  get('gardenName').textContent = day ? t('dailyName') : t('t' + level);
  get('cuts').textContent = state.remaining;
  get('bloom').textContent = blooms + ' / ' + state.beds.length;
  get('sound').textContent = saved.sound ? t('soundOn') : t('soundOff');
  get('sound').setAttribute('aria-pressed', String(saved.sound));
  get('next').hidden = !state.won;
  get('openList').hidden = state.won;
  get('nextText').textContent = !day && level < GARDENS ? t('nextNamed', { name: t('t' + (level + 1)) }) : t('gardens');
  get('daily').hidden = Boolean(day);
  get('share').hidden = !(day && state.won);
  get('shareText').textContent = shared || t('share');
  const result = get('result');
  const spent = state.budget - state.remaining, p = parNow();
  result.classList.toggle('won', state.won);
  if (state.won) result.textContent = p === null ? t('wonPar', { n: spent, par: '–' })
    : spent < p ? t('underPar', { n: spent, d: p - spent }) : t('wonPar', { n: spent, par: p });
  else if (state.remaining === 0 && isolatedBed()) result.textContent = t('isolated');
  else if (said && performance.now() < saidUntil) result.textContent = t(said);
  else if (thirsty()) result.textContent = t('thirsty');
  else if (state.remaining === 0 && !hurry) result.textContent = t('waitOrReplant');
  else if (hurry) result.textContent = t('running');
  else if (!touched && day && bestOn(day) !== null) result.textContent = t('bestCuts', { n: bestOn(day), par: p ?? '–' });
  else if (!touched && p !== null) result.textContent = t('parOnly', { par: p });
  else result.textContent = '';
}
// A short word after a refused cut, for 1.6 seconds.
let said = null, saidUntil = 0;
function say(word) {
  if (said === word && performance.now() < saidUntil) return;
  said = word; saidUntil = performance.now() + 1600;
  update();
  setTimeout(() => { if (performance.now() >= saidUntil) update(); }, 1650);
}
// Every bed is joined to a spring and 25 seconds of game time passed after the last cut, yet a bed never started.
function thirsty() {
  return connected && !state.won && state.ticks - lastCutTick > 30 * 25 && state.beds.some(i => state.cells[i].growth === 0);
}
function words() {
  apply();
  document.title = t('title');
  get('title').innerHTML = t('titleHtml');
  update();
}
function lift() {
  const id = pointer;
  pointer = null;
  previous = null;
  line = null;
  if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
// Play recording for the game lab: one run is one garden, from the first cut to bloom, replant or leaving it.
const rec = home(lab('night-channels', { lang }), { back: ['#paused .card', '#selection .card'], lang });
let running = false;
function recEnd(outcome) {
  if (!running) return;
  running = false;
  rec.end(outcome, { garden: level, daily: Boolean(day), cuts: state.budget - state.remaining, budget: state.budget, par: parNow(), bloomed: blooms, beds: state.beds.length, secs: Math.round(elapsed * 10) / 10 });
}
function start(n, date = null) {
  recEnd(state.won ? 'won' : state.remaining === 0 ? 'lost' : 'quit');
  lift();
  level = n; day = date; state = create(n,date); touched = false; blooms = 0;
  elapsed = carry = 0; lastFrame = null; connected = false; lastCutTick = 0; lastCutAt = -Infinity; hurry = false;
  wet = new Set(); effects = []; shared = ''; wonAt = null;
  connected = state.beds.every(i => wetNetwork(state).has(i));
  show('play'); audio.release(); audio.unlock();
  if (!reduced.matches) { canvas.classList.remove('fresh'); void canvas.offsetWidth; canvas.classList.add('fresh'); }
  update();
  paint();
}
function win() {
  lift();
  const spent = state.budget - state.remaining;
  if (day) {
    const cuts = Math.min(spent, bestOn(day) ?? Infinity);
    dailyBests.set(day, cuts);
    reportSave(writeJson(key + ':best:' + day, cuts));
  } else {
    saved.unlocked = Math.max(saved.unlocked, Math.min(GARDENS, level + 1));
    if (level === 10) saved.completed = true;
    store();
    gardenBests = { ...readBests(), ...gardenBests };
    gardenBests[level] = Math.min(spent, gardenBests[level] ?? Infinity);
    reportSave(writeJson(bestKey, gardenBests));
  }
  rec.event('garden-complete', { garden: level, daily: Boolean(day), cuts: spent, budget: state.budget, par: parNow() });
  if (day) rec.event('daily-finished', { cuts: spent, par: parNow() });
  recEnd('won');
  feel.win();
  show('won');
  update();
}
function pause() {
  if (screen !== 'play') return;
  lift(); audio.hold(); show('paused'); update();
}
function back() {
  if (screen !== 'selection' && screen !== 'paused') return;
  lastFrame = null;
  show(state.won ? 'won' : 'play'); audio.release(); audio.unlock(); update();
  get(state.won ? 'next' : 'pause').focus({preventScroll:true});
}
function choose() {
  recEnd(state.won ? 'won' : state.remaining === 0 ? 'lost' : 'quit');
  lift(); audio.hold();
  gardenBests = { ...readBests(), ...gardenBests };
  const list = get('levels');
  list.replaceChildren();
  for (let i=1; i<=GARDENS; i++) {
    const button = document.createElement('button');
    button.textContent = number(i); button.disabled = i > saved.unlocked;
    const finished = i < saved.unlocked || (saved.completed && i <= 10) || gardenBests[i] !== undefined;
    const atPar = gardenBests[i] !== undefined && parOf(i) !== null && gardenBests[i] <= parOf(i);
    button.classList.toggle('completed', finished);
    button.classList.toggle('par', atPar);
    button.setAttribute('aria-label', t('gardenLabel', { n: i, name: t('t' + i) }) + (finished ? t('gardenDone') : '') + (atPar ? t('gardenPar') : ''));
    button.setAttribute('aria-current', String(!day && i === level));
    button.onclick = () => { feel.button(); start(i); };
    list.append(button);
  }
  const record = bestOn(today());
  get('dailyBest').textContent = record !== null ? t('bestToday', { n: record }) : t('bestDevice');
  show('selection');
  list.querySelector('[aria-current=true]')?.scrollIntoView?.({ block:'nearest' });
}
// The daily result as one line of text: no picture, so the route stays the reader's own puzzle.
function shareText() {
  const spent = state.budget - state.remaining, p = parNow();
  const flowers = '✿'.repeat(state.beds.length);
  const body = p !== null && spent < p ? t('shareUnder', { blooms: flowers, n: spent, d: p - spent })
    : t('shareCuts', { blooms: flowers, n: spent, par: p ?? '–' });
  return t('shareLine', { date: day }) + '\n' + body + '\n' + location.origin + location.pathname;
}
async function share() {
  const text = shareText();
  window.lastShare = text;
  try {
    if (navigator.share) {
      await navigator.share({ text });
      rec.event('daily-shared', { cuts: state.budget - state.remaining });
      return;
    }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); } catch { /* The line is still in window.lastShare for the check. */ }
  shared = t('copied');
  update();
  rec.event('daily-shared', { cuts: state.budget - state.remaining, copied: true });
}
const tap = fn => () => { feel.button(); fn(); };
get('daily').onclick = get('pickDaily').onclick = tap(() => start(10,today()));
get('pause').onclick = tap(pause);
get('retry').onclick = tap(() => start(level,day));
get('resume').onclick = get('return').onclick = tap(back);
get('gardens').onclick = get('openList').onclick = tap(choose);
get('next').onclick = tap(() => !day && level < GARDENS ? start(level+1) : choose());
get('share').onclick = tap(share);
get('sound').onclick = () => {
  saved.sound = !saved.sound;
  store(true); update(); feel.button();
};
get('lang').onclick = () => { setLang(lang() === 'tr' ? 'en' : 'tr'); words(); feel.button(); };
onLeave(pause);
addEventListener('keydown', e => {
  if (!isPauseKey(e) || e.repeat) return;
  e.preventDefault();
  if (screen === 'play') pause();
  else back();
});

// Traverse each crossed cell, including the intervening bank at a diagonal corner.
// This keeps a quick stroke edge-connected even on phones with infrequent pointer events.
function position(event) {
  const rect = canvas.getBoundingClientRect();
  const g = geometry(canvas,state);
  const x = (event.clientX - rect.left - g.x) / g.size;
  const y = (event.clientY - rect.top - g.y) / g.size;
  return {x,y};
}
function inside(p) {
  return p.x >= 0 && p.y >= 0 && p.x < state.cols && p.y < state.rows;
}
// Clip captured motion at the garden edge. A quick swipe can end past the last row.
function clippedStroke(a,b) {
  if (inside(a) && inside(b)) return [a,b];
  const dx = b.x-a.x, dy = b.y-a.y;
  let enter = 0, exit = 1;
  for (const [v,delta,limit] of [[a.x,dx,state.cols],[a.y,dy,state.rows]]) {
    if (!delta) {
      if (v < 0 || v >= limit) return null;
      continue;
    }
    const t0 = -v / delta, t1 = (limit-v) / delta;
    enter = Math.max(enter, Math.min(t0,t1));
    exit = Math.min(exit, Math.max(t0,t1));
  }
  if (enter >= exit) return null;
  const point = t => ({
    x:Math.max(0, Math.min(state.cols-1e-9, a.x+t*dx)),
    y:Math.max(0, Math.min(state.rows-1e-9, a.y+t*dy)),
  });
  return [point(enter),point(exit)];
}
let lastCell = -1;
function cut(x,y) {
  const i = y * state.cols + x;
  if (i === lastCell) return;
  lastCell = i;
  const what = line.enter(i);
  const c = state.cells[i];
  if (what === 'rock' || what === 'spent' || (what === 'broken' && (c.kind === 'soil' || c.kind === 'sand') && !c.dug)) {
    feel.refuse(i, what);
    say(what === 'spent' ? 'noCuts' : 'stoneStops');
    return;
  }
  if (what !== 'cut') return;
  if (!touched && !running) { running = true; rec.start({ garden: level, daily: Boolean(day), budget: state.budget, par: parNow() }); }
  touched = true; hintControl.done();
  lastCutTick = state.ticks; lastCutAt = performance.now(); hurry = false;
  connected = state.beds.every(b => wetNetwork(state).has(b));
  feel.cut(i, y);
  update();
}
function trace(event) {
  const point = position(event);
  const segment = clippedStroke(previous || point, point);
  previous = point;
  if (!segment) return;
  const [from,to] = segment;
  let x = Math.floor(from.x), y = Math.floor(from.y);
  const endX = Math.floor(to.x), endY = Math.floor(to.y);
  const dx = to.x - from.x, dy = to.y - from.y;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  cut(x,y);
  while (x !== endX || y !== endY) {
    const crossX = x === endX ? Infinity : (x + (sx > 0 ? 1 : 0) - from.x) / dx;
    const crossY = y === endY ? Infinity : (y + (sy > 0 ? 1 : 0) - from.y) / dy;
    if (crossX < crossY) x += sx;
    else y += sy;
    cut(x,y);
  }
}
canvas.addEventListener('pointerdown', e => {
  if (screen !== 'play' || pointer !== null || e.button !== 0 || !inside(position(e))) return;
  e.preventDefault(); pointer = e.pointerId; audio.unlock();
  line = stroke(state, dig); lastCell = -1;
  try { canvas.setPointerCapture(pointer); } catch { /* An emulated pointer has no native capture. */ }
  trace(e);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== pointer) return;
  const samples = e.getCoalescedEvents?.() || [];
  for (const sample of samples) trace(sample);
  trace(e);
});
canvas.addEventListener('pointerup', e => {
  if (e.pointerId !== pointer) return;
  trace(e); lift();
});
for (const type of ['pointercancel','lostpointercapture']) {
  canvas.addEventListener(type, e => { if (e.pointerId === pointer) lift(); });
}
const hintControl = hint(canvas, {
  key:'night-channels:hint', kind:'path', look:'hand', reach:22,
  when:() => screen === 'play' && !touched && (level !== 1 || Boolean(day)),
  played:saved.unlocked > 1, delay:4000, label:t('hint'),
});
function paint() {
  render(canvas,terrain,state,{
    time:elapsed, clock, effects, hurry, wonAt,
    hint:screen === 'play' && !day && level === 1 && pointer === null && state.remaining > 0 &&
      query.get('hint') !== '0' && !hintControl.shown,
    look, reduced:reduced.matches,
  });
}
// The old pointer coordinates belong to the pre-resize board. End that
// stroke before accepting a new one, including when the page is paused.
new ResizeObserver(() => {
  lift();
  paint();
}).observe(canvas);
// Once every bed is joined to a spring and the finger has been off the soil for a moment, the water runs four times
// faster: the outcome is settled and only the waiting is left. The rules and their tick are unchanged.
const HURRY = 4;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastFrame === null ? 0 : Math.min(.2, (now - lastFrame)/1000);
  lastFrame = now;
  if (screen !== 'play' && screen !== 'won') return;
  elapsed += dt; clock += dt;
  if (effects.length && clock - effects[0].at > 1.6) effects = effects.filter(f => clock - f.at <= 1.6);
  if (screen === 'play') {
    hurry = connected && touched && pointer === null && !state.won && now - lastCutAt > 800;
    carry += dt;
    while (carry >= 1/30 && !state.won) {
      for (let k = 0; k < (hurry ? HURRY : 1) && !state.won; k++) tick(state);
      carry -= 1/30;
    }
    for (const i of state.beds) {
      if (!wet.has(i) && state.cells[i].moisture >= .065) { wet.add(i); if (touched) feel.wet(i); }
    }
    const open = state.beds.filter(i => state.cells[i].growth >= 1);
    if (open.length > blooms) {
      blooms = open.length;
      if (touched) feel.bloom(open.at(-1));
      update();
    } else {
      const next = hurry + '|' + thirsty();
      if (next !== status) update();
    }
    status = hurry + '|' + thirsty();
    if (state.won) { hurry = false; win(); }
  }
  paint();
}
// A read-only snapshot lets browser checks inspect running water after a real drag.
window.channelView = () => ({screen, state:structuredClone(state), geometry:geometry(canvas,state),
  level, day, best:bestOn(day), unlocked:saved.unlocked, look, gardens:GARDENS, par:parNow(), hurry,
  gardenBest:gardenBests[level] ?? null, lang:lang()});
words();
requestAnimationFrame(frame);

// The notice is under the garden from the first moment (this page has no start card); the switch is on the pause card.
rec.notice(document.querySelector('footer'));
rec.toggle(get('paused').firstElementChild);
