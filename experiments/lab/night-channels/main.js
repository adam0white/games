import { create, dig, tick } from './sim.js';
import { render, geometry } from './render.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { isPauseKey, onLeave } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';

noZoom();
const get = id => document.getElementById(id);
const canvas = get('garden');
const terrain = get('terrain');
const key = 'night-channels:save';
const titles = ['First furrow', 'The bend', 'Between stones', 'Sandy banks', 'A fork in the hill',
  'Side by side', 'The long terrace', 'Three seedbeds', 'Across the slope', 'The lower garden'];
const query = new URLSearchParams(location.search);
const look = query.get('look') === 'clay' ? 'clay' : 'moon';
document.documentElement.dataset.look = look;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const number = n => String(n).padStart(2,'0');
function today() {
  const d = new Date();
  return [d.getFullYear(), number(d.getMonth()+1), number(d.getDate())].join('-');
}
function load() {
  const raw = readJson(key, null);
  return {
    unlocked: Number.isInteger(raw?.unlocked) ? Math.max(1, Math.min(10, raw.unlocked)) : 1,
    completed: raw?.completed === true,
    sound: raw?.sound !== false,
  };
}
let saved = load();
const dailyBests = new Map();
let saveFailed = false;
function bestOn(date) {
  if (!date) return null;
  const disk = readJson(key + ':best:' + date);
  const local = dailyBests.get(date) ?? Infinity;
  const cuts = Math.min(local, Number.isInteger(disk) && disk >= 0 ? disk : Infinity);
  return Number.isFinite(cuts) ? cuts : null;
}
function reportSave(ok) {
  saveFailed = !ok;
  get('saveStatus').textContent = ok ? '' : 'Progress stays in this session. Storage is unavailable.';
}
function store(soundChanged = false) {
  const disk = load();
  saved.unlocked = Math.max(saved.unlocked, disk.unlocked);
  saved.completed ||= disk.completed;
  if (!soundChanged && !saveFailed) saved.sound = disk.sound;
  reportSave(writeJson(key, saved));
}
const audio = sound({ on:() => saved.sound });
let level = saved.unlocked, day = null, state = create(level), screen = 'play';
let pointer = null, previous = null, lastSound = -Infinity;
let elapsed = 0, carry = 0, lastFrame = null, blooms = 0;
let touched = false;
const show = screens(['paused','selection'], name => {
  screen = name;
  const modal = name === 'paused' || name === 'selection';
  document.querySelector('main').inert = modal;
  get('pause').hidden = name === 'won';
  if (modal) get(name === 'paused' ? 'resume' : 'return').focus({preventScroll:true});
});
// Once all cuts are spent, a bed behind an intact bank cannot receive water.
// A connected bed can still take time to soak, especially downstream of sand.
function isolatedBed() {
  const open = new Set([state.source]);
  for (const i of open) {
    const x = i % state.cols;
    for (const n of [x ? i-1 : -1, x+1 < state.cols ? i+1 : -1, i-state.cols, i+state.cols]) {
      const c = state.cells[n];
      if (c && (c.dug || c.kind === 'spring' || c.kind === 'bed')) open.add(n);
    }
  }
  return state.beds.some(i => !open.has(i));
}
function update() {
  get('folio').textContent = day ? 'Daily garden · ' + day : 'Garden ' + number(level) + ' / 10';
  get('gardenName').textContent = day ? 'The daily garden' : titles[level - 1];
  get('cuts').textContent = state.remaining;
  get('bloom').textContent = blooms + ' / ' + state.beds.length;
  get('sound').textContent = saved.sound ? 'Sound on' : 'Sound off';
  get('sound').setAttribute('aria-pressed', String(saved.sound));
  get('next').hidden = !state.won;
  get('openList').hidden = state.won;
  get('next').textContent = !day && level < 10 ? 'Next garden →' : 'Gardens →';
  get('daily').hidden = Boolean(day);
  const result = get('result');
  if (state.won) result.textContent = day ? (state.budget - state.remaining) + ' cuts · Best ' + bestOn(day) : 'In full bloom';
  else if (state.remaining === 0) result.textContent = isolatedBed() ? 'Isolated bed · Replant ↺' : 'Wait or replant ↺';
  else if (day && bestOn(day) !== null) result.textContent = 'Best · ' + bestOn(day) + ' cuts';
  else result.textContent = '';
}
function lift() {
  const id = pointer;
  pointer = null;
  previous = null;
  if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
function start(n, date = null) {
  lift();
  level = n; day = date; state = create(n,date); touched = false; blooms = 0;
  elapsed = carry = 0; lastFrame = null;
  show('play'); audio.release(); audio.unlock();
  update();
  paint();
}
function win() {
  lift();
  if (day) {
    const cuts = Math.min(state.budget - state.remaining, bestOn(day) ?? Infinity);
    dailyBests.set(day, cuts);
    reportSave(writeJson(key + ':best:' + day, cuts));
  } else {
    saved.unlocked = Math.max(saved.unlocked, Math.min(10, level + 1));
    if (level === 10) saved.completed = true;
    store();
  }
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
  lift(); audio.hold();
  const list = get('levels');
  list.replaceChildren();
  for (let i=1; i<=10; i++) {
    const button = document.createElement('button');
    button.textContent = number(i); button.disabled = i > saved.unlocked;
    const finished = i < saved.unlocked || saved.completed;
    button.classList.toggle('completed', finished);
    button.setAttribute('aria-label', 'Garden ' + i + ', ' + titles[i-1] + (finished ? ', in bloom' : ''));
    button.setAttribute('aria-current', String(!day && i === level));
    button.onclick = () => start(i);
    list.append(button);
  }
  const record = bestOn(today());
  get('dailyBest').textContent = record !== null
    ? 'Today’s best on this device · ' + record + ' cuts' : 'Best kept on this device';
  show('selection');
}
get('daily').onclick = get('pickDaily').onclick = () => start(10,today());
get('pause').onclick = pause;
get('retry').onclick = () => start(level,day);
get('resume').onclick = get('return').onclick = back;
get('gardens').onclick = get('openList').onclick = choose;
get('next').onclick = () => !day && level < 10 ? start(level+1) : choose();
get('sound').onclick = () => {
  saved.sound = !saved.sound;
  store(true); update();
};
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
function cut(x,y) {
  if (!dig(state,y * state.cols + x)) return;
  touched = true; hintControl.done();
  const now = performance.now();
  if (now - lastSound > 65) {
    audio.noise(.065,.085,760 + y * 45);
    lastSound = now;
  }
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
  played:saved.unlocked > 1, delay:4000, label:'Drag from the spring to a seedbed',
});
function paint() {
  render(canvas,terrain,state,{
    time:elapsed, hint:screen === 'play' && !day && level === 1 && pointer === null && state.remaining > 0 &&
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
function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastFrame === null ? 0 : Math.min(.2, (now - lastFrame)/1000);
  lastFrame = now;
  if (screen !== 'play' && screen !== 'won') return;
  elapsed += dt;
  if (screen === 'play') {
    carry += dt;
    while (carry >= 1/30 && !state.won) {
      tick(state); carry -= 1/30;
    }
    const count = state.beds.filter(i => state.cells[i].growth >= 1).length;
    if (count > blooms) {
      blooms = count;
      // Ring two consonant notes together when a flower opens.
      if (touched) { audio.tone(523,.5,.050,'sine'); audio.tone(784,.62,.034,'sine'); }
      update();
    }
    if (state.won) win();
  }
  paint();
}
// A read-only snapshot lets browser checks inspect running water after a real drag.
window.channelView = () => ({screen, state:structuredClone(state), geometry:geometry(canvas,state),
  level, day, best:bestOn(day), unlocked:saved.unlocked, look});
update();
requestAnimationFrame(frame);
