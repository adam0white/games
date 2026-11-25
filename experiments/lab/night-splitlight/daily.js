// Today's bench: the same for everyone on a UTC day (?day=YYYY-MM-DD for checks). Built from the same parts as the
// plates, with two controls, receivers placed from a hidden answer (so it is solvable), and rejected when the start
// already feeds every receiver, when one control alone can solve it (par is 2), when receivers overlap, or when the
// answer is a knife edge (a nudge of 1% of travel on either control loses it).
import { controlsOf, distanceAngle, makeBench, trace } from './bench.js';
import { miss, search } from './solver.js';

let asked = null;
try { asked = new URLSearchParams(location.search).get('day'); } catch { /* not a page */ }
export const today = /^\d{4}-\d{2}-\d{2}$/.test(asked || '') ? asked : new Date().toISOString().slice(0, 10);

export function random(text) { // FNV-1a into mulberry32, as the small games' home does
  let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h |= 0; h = (h + 0x6D2B79F5) | 0; let x = Math.imul(h ^ (h >>> 15), 1 | h); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const C = [180, 196];
const CUTS = [[0, 120, 240], [-5, 92, 224], [8, 132, 240], [0, 26, 120, 240], [-11, 105, 228]];
const FAMILIES = [
  // a turning mirror feeds a turning prism
  r => ({ family: 'mirror', sources: [{ at: [13, 156 + Math.round(r() * 10)] }], parts: [
    { kind: 'mirror', at: [96, 156], len: 34, turn: [2, 34] },
    { kind: 'prism', cut: pick(r, CUTS), at: C, turn: [-57, 71] }] }),
  // a prism that slides as well as turns
  r => ({ family: 'slide', sources: [{ at: [13, 186 + Math.round(r() * 20)] }], parts: [
    { kind: 'prism', cut: pick(r, CUTS), at: [180, 150], slide: [180, 242], turn: [-57, 71] }] }),
  // two lamps: the upper one folds off a turning mirror, the lower one runs straight; both meet a turning prism
  r => ({ family: 'lamps', sources: [{ at: [13, 156] }, { at: [13, 206 + Math.round(r() * 16)] }], parts: [
    { kind: 'mirror', at: [96, 156], len: 34, turn: [2, 34] },
    { kind: 'prism', cut: pick(r, CUTS.slice(0, 3)), at: C, turn: [-57, 71] }] }),
  // a turning mirror and a turning grating
  r => ({ family: 'grating', sources: [{ at: [13, 156] }], parts: [
    { kind: 'mirror', at: [96, 156], len: 34, turn: [2, 34] },
    { kind: 'grating', at: [190, 206], len: 80, pitch: 1500 + Math.round(r() * 400), turn: [60, 140] }] }),
];
const pick = (r, list) => list[Math.floor(r() * list.length)];

export function dailyLevel(day = today) {
  const r = random('splitlight ' + day);
  const family = Math.floor(r() * FAMILIES.length);
  for (let attempt = 0; attempt < 160; attempt++) {
    const level = FAMILIES[(family + Math.floor(attempt / 40)) % FAMILIES.length](r); // the day's family first
    level.id = 'daily'; level.key = 'dailyName'; level.idea = 'daily-' + level.family; level.day = day;
    level.width = .07 + r() * .02;
    level.answer = [.15 + r() * .7, .15 + r() * .7];
    level.start = level.answer.map(a => (a + .3 + r() * .4) % 1);
    level.receivers = choose(r, level, 2 + Math.floor(r() * 2));
    if (!level.receivers) { if (dailyLevel.log) dailyLevel.log(level, 'few rays'); continue; }
    if (valid(level)) { level.attempts = attempt + 1; return level; }
    if (dailyLevel.log) dailyLevel.log(level, valid.why);
  }
  throw new Error('no daily bench for ' + day);
}
// Receivers come from the rays at the answer: shuffled, then kept only when well clear of those already kept.
function choose(r, level, count) {
  const { rays } = trace(level, level.answer);
  const grating = level.family === 'grating', lamps = level.sources.length > 1;
  const options = [];
  for (const ray of rays) {
    if (ray.angle === null || ray.band % 1) continue;
    if (grating && ray.order === 0) continue;
    options.push({ angle: ray.angle, receiver: [ray.band, grating ? { order: ray.order } : lamps ? { src: ray.src } : {}] });
  }
  if (grating && r() < .5) {
    const zero = rays.filter(ray => ray.order === 0 && ray.angle !== null);
    if (zero.length === 6) options.unshift({ angle: zero[0].angle, receiver: [-1, { order: 0 }], first: true });
  }
  const list = [...options.filter(o => o.first), ...shuffle(r, options.filter(o => !o.first))];
  const kept = [];
  for (const o of list) {
    if (kept.some(k => distanceAngle(k.angle, o.angle) < level.width * 2.6 + .05)) continue;
    if (kept.some(k => k.receiver[0] === o.receiver[0] && JSON.stringify(k.receiver[1]) === JSON.stringify(o.receiver[1]))) continue;
    kept.push(o);
    if (kept.length === count) break;
  }
  return kept.length >= 2 ? kept.map(k => k.receiver) : null;
}
function shuffle(r, list) { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; }

export function valid(level) {
  const no = why => { valid.why = why; return false; };
  let state;
  try { state = makeBench(level); } catch { return no('no ray'); }
  const t = state.targets;
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (distanceAngle(t[i].angle, t[j].angle) < (t[i].width + t[j].width) * 1.3) return no('overlap');
  if (controlsOf(level).length !== 2) return no('controls');
  if (miss(level, t, level.answer) !== 0) return no('answer');
  for (const [dx, dy] of [[.01, 0], [-.01, 0], [0, .01], [0, -.01]]) {
    if (miss(level, t, [level.answer[0] + dx, level.answer[1] + dy]) !== 0) return no('knife edge');
  }
  if (miss(level, t, level.start) === 0) return no('start solved');
  if (search(level, t, level.start, [0]) || search(level, t, level.start, [1])) return no('one control');
  valid.why = '';
  return true;
}
