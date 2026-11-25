// The meadow evolves (lab page ant-evolve, folded in, owner's lab cleanup 2026-11-24: "it can make things interesting for long time players").
// Rules and numbers only, no drawing and no page code, so the page and the bots share it.
//
// Each species carries six traits. Neutral is 0, which is the animal as it was. The traits change only between runs, from what this
// player did in the run, and they are kept on this device under their own key (the save `ant-promotion:v1` is not touched).
//   As a hunter (stronger than you):
//     grass  you got away by creeping in tall grass  -> it looks into grass: it sees a creeper from further off; it sees a little less far
//     stay   you outran it till it tired, or dashed   -> it chases longer, then rests longer          (up to +1)
//            you broke its sight behind rocks         -> it gives up sooner, and comes back sooner     (down to -1)
//     lead   you run away the same way each time      -> it runs at where you will be, not where you are (a sharp turn makes it overshoot)
//   Any role:
//     shake  your skills stun it                     -> it shakes off a stun sooner; it is a little slower
//   As prey (weaker than you):
//     wary   you eat a lot of it                      -> it sees you from further off, but it grows fat: bigger and slower
//     bold   you meet it and leave it alone          -> it lets you come closer before it runs
// Each trait moves at most STEP a run, towards a target set by that run, so a habit kept for dozens of runs builds up and a dropped one
// fades. Every trait is clamped to its bounds. Speed only ever falls, and never by enough to change which of you is faster (see SPEED_FLOOR).
// The rival, the old animals and the hunter that teaches the first rock never carry traits.
//
// Nothing changes the game until GRACE runs have counted: before that, makeMeadow() returns null and the world is made exactly as before.
// A run is one life (or a stretch of one: a death, the win, the menu or leaving the page ends it, and a long life is cut every RUN_CUT s),
// and it counts only with at least MIN_RUN seconds of play.
import { FORMS } from './sim.js';
import { rockBetween } from './cover.js';

export const MEADOW_KEY = 'ant-promotion:meadow';
export const GRACE = 6, MIN_RUN = 30, RUN_CUT = 240;
export const TRAITS = [
  { k: 'grass', role: 'hunt', lo: 0, hi: 1, colour: '#5fae2e' },
  { k: 'stay', role: 'hunt', lo: -1, hi: 1, colour: '#c0392b' },
  { k: 'lead', role: 'hunt', lo: 0, hi: 1, colour: '#3a78d6' },
  { k: 'shake', role: 'any', lo: 0, hi: 1, colour: '#e0b21c' },
  { k: 'wary', role: 'prey', lo: 0, hi: 1, colour: '#f4ecd8' },
  { k: 'bold', role: 'prey', lo: 0, hi: 1, colour: '#ef7d2c' },
];
const I = Object.fromEntries(TRAITS.map((T, i) => [T.k, i]));
// What a trait at 1 (or -1 for stay) does. The page's words and the field guide are written from these numbers.
export const EFFECT = {
  grass: { near: 1.6, sight: 0.12 }, // grass-hiding fails within (1 + 1.6 v) x the usual distance; sight x (1 - 0.12 v)
  stay: { longer: 0.5, rest: 0.8, sooner: 0.6, back: 0.4 }, // v > 0: tires 1 / (1 + 0.5 v) as fast, rests (1 + 0.8 v) as long; v < 0: tires (1 + 0.6 |v|) as fast, rests (1 - 0.4 |v|)
  lead: { secs: 0.55, close: 45 }, // aims where you will be in 0.55 v s; not within 45 of you
  shake: { faster: 0.9, slow: 0.03 }, // a stun wears off (1 + 0.9 v) as fast; speed x (1 - 0.03 v)
  wary: { sight: 0.4, slow: 0.06, big: 0.12 }, // sight x (1 + 0.4 v), speed x (1 - 0.06 v), body x (1 + 0.12 v)
  bold: { sight: 0.25 }, // sight x (1 - 0.25 v)
};
// The slowest an evolved animal gets, as a share of its speed. The three speeds are 104, 124 and 150, and a hunter that runs with a fast
// player's boost runs PACE_UP (1.06) faster than it: 0.912 keeps every animal faster than the next speed down (124 x 0.912 = 113 > 104,
// 150 x 0.912 = 137 > 124, 1.06 x 0.97 > 1), so the » mark, and who can eat whom, never change (evolve-bots.mjs checks every pair).
export const SPEED_FLOOR = (1 - EFFECT.wary.slow) * (1 - EFFECT.shake.slow);
export const STEP = 0.15, RATE = 0.25, POOL = 3, WAY = 0.2; // POOL: chases this species needs before its own record outweighs the run's

let MUT = null; // a deliberately broken rule for `node evolve-bots.mjs --mutate=meadow`; never set by the page
export const mutate = name => { MUT = name || null; };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const NAMES = new Set(FORMS.filter(f => f.level >= 1).map(f => f.name));
const zero = () => TRAITS.map(() => 0);
export const newMeadow = () => ({ v: 1, runs: 0, way: [0, 0], sp: {}, shown: {} }); // way: which way you run from hunters, averaged over runs
// A meadow read from storage: anything malformed is dropped and every trait is clamped, so a bad or old value can never run away.
export function cleanMeadow(raw) {
  const out = newMeadow(); if (!raw || typeof raw !== 'object' || raw.v !== 1) return out;
  out.runs = Number.isInteger(raw.runs) && raw.runs > 0 ? Math.min(raw.runs, 1e6) : 0;
  if (Array.isArray(raw.way) && raw.way.length === 2 && raw.way.every(Number.isFinite)) { const l = Math.hypot(...raw.way); out.way = l > 1 ? raw.way.map(v => v / l) : raw.way.slice(); }
  for (const [name, list] of Object.entries(raw.sp || {})) {
    if (!NAMES.has(name) || !Array.isArray(list) || list.length !== TRAITS.length || !list.every(Number.isFinite)) continue;
    out.sp[name] = list.map((v, i) => clamp(v, TRAITS[i].lo, TRAITS[i].hi));
    const sh = raw.shown?.[name]; out.shown[name] = Array.isArray(sh) && sh.length === TRAITS.length ? sh.map(b => (Number.isInteger(b) ? clamp(b, -4, 4) : 0)) : zero();
  }
  return out;
}
export const traitsOf = (M, name) => M.sp[name] || zero();
export const changed = M => Object.keys(M.sp).filter(n => M.sp[n].some(v => Math.abs(v) >= 0.05));

// ---------- applying the traits in the world
function mix(a, b, k) { // two #rrggbb colours
  const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
// The animal as this meadow made it, for its role against the player now. Returns F itself when nothing applies.
export function shape(F, v, role) {
  const on = i => (TRAITS[i].role === role || TRAITS[i].role === 'any') && Math.abs(v[i]) >= 0.01;
  if (!TRAITS.some((_, i) => on(i))) return F;
  const M = { ...F, ev: { role, v: v.slice() } }; let tint = '#000000', w = 0;
  const g = on(I.grass) ? v[I.grass] : 0, st = on(I.stay) ? v[I.stay] : 0, ld = on(I.lead) ? v[I.lead] : 0, sh = on(I.shake) ? v[I.shake] : 0, wa = on(I.wary) ? v[I.wary] : 0, bo = on(I.bold) ? v[I.bold] : 0;
  if (g) { M.look = 1 + EFFECT.grass.near * g; M.range *= 1 - EFFECT.grass.sight * g; }
  if (st > 0) { M.tire = 1 / (1 + EFFECT.stay.longer * st); M.rest = 1 + EFFECT.stay.rest * st; }
  if (st < 0) { M.tire = 1 - EFFECT.stay.sooner * st; M.rest = 1 + EFFECT.stay.back * st; }
  if (ld) M.lead = EFFECT.lead.secs * ld;
  if (sh) { M.shake = 1 + EFFECT.shake.faster * sh; M.speed *= 1 - EFFECT.shake.slow * sh; }
  if (wa) { M.range *= 1 + EFFECT.wary.sight * wa; M.speed *= 1 - EFFECT.wary.slow * wa; M.r *= 1 + EFFECT.wary.big * wa; }
  if (bo) M.range *= 1 - EFFECT.bold.sight * bo;
  // what the player sees: the body takes on the colour of its strongest traits (at most 55%), and a fat one is bigger (above)
  for (const [i, k] of [[I.grass, g], [I.stay, Math.abs(st)], [I.lead, ld], [I.shake, sh], [I.wary, wa], [I.bold, bo]]) if (k > 0) { tint = w ? mix(tint, TRAITS[i].colour, k / (w + k)) : TRAITS[i].colour; w += k; }
  if (w) { const k = 0.55 * Math.min(1, w); M.c = mix(F.c, tint, k); M.d = mix(F.d, tint, k * 0.6); }
  return M;
}
// The object sim.js uses (opts.meadow on create, or s.meadow): form() for each animal, aim() for a hunter that leads.
// null until GRACE runs have counted, or when no trait is set: the world is then made exactly as without evolution.
export function makeMeadow(M) {
  if (!M || M.runs < GRACE || !changed(M).length) return null;
  const cache = new Map(), at = { tick: -1, x: 0, y: 0, vx: 0, vy: 0 };
  return {
    form(F, strong, weak) {
      const role = strong ? 'hunt' : weak ? 'prey' : null; if (!role) return F;
      const key = F.id * 2 + (strong ? 1 : 0); let out = cache.get(key);
      if (!out) { out = M.sp[F.name] ? shape(F, M.sp[F.name], role) : F; cache.set(key, out); }
      return out;
    },
    aim(s, m, M2, to) { // where a leading hunter runs: at where the player will be in M2.lead seconds
      const p = s.player;
      if (at.tick !== s.tick) { if (at.tick === s.tick - 1) { at.vx = (p.x - at.x) * 60; at.vy = (p.y - at.y) * 60; } else at.vx = at.vy = 0; at.tick = s.tick; at.x = p.x; at.y = p.y; }
      const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < EFFECT.lead.close) return to;
      const t = Math.min(M2.lead, d / 300); return Math.atan2(p.y + at.vy * t - m.y, p.x + at.vx * t - m.x);
    },
  };
}
// Put a meadow on a world that exists (after the death card, so the animals of the next life are the new ones).
export const useMeadow = (s, mw) => { if (mw) s.meadow = mw; else delete s.meadow; };

// ---------- watching a run (the page and the bots call observe() after every step)
export const newTally = () => ({ tick: -1, time: 0, hunt: {}, prey: {}, stun: {}, hx: 0, hy: 0, runs: 0, dash: 0, trail: [] });
const H = (T, n) => (T.hunt[n] ??= { chase: 0, grass: 0, rock: 0, tired: 0, dash: 0 });
const P = (T, n) => (T.prey[n] ??= { met: 0, eaten: 0 });
const DASH = new Set(['leap', 'dive', 'sprint']);
export function observe(s, T) {
  if (s.tick === T.tick) return; T.tick = s.tick; T.time += 1 / 60;
  const p = s.player, mine = FORMS[p.stack[p.stack.length - 1]].power, byId = id => s.mobs.find(m => m.id === id), plain = m => m && !m.nem && !m.old && !m.teach;
  const name = m => FORMS[m.f].name;
  for (const e of s.events) {
    if (e.t === 'notice') { const m = byId(e.id); if (!plain(m)) continue; if (e.strong) H(T, name(m)).chase++; else P(T, name(m)).met++; }
    else if (e.t === 'coverLost' && e.strong) { const m = byId(e.id); if (plain(m) && s.cover) H(T, name(m))[rockBetween(s.cover.rocks, m.x, m.y, p.x, p.y) ? 'rock' : 'grass']++; }
    else if (e.t === 'tired') { const m = byId(e.id); if (plain(m)) H(T, name(m)).tired++; }
    else if (e.t === 'power' && DASH.has(e.kind)) { T.dash++; for (const m of s.mobs) if (plain(m) && m.alert && FORMS[m.f].power > mine && Math.hypot(m.x - p.x, m.y - p.y) < 400) H(T, name(m)).dash++; }
    else if (e.t === 'stun') { let best = null, bd = 30; for (const m of s.mobs) { const d = Math.hypot(m.x - e.x, m.y - e.y); if (d < bd) { bd = d; best = m; } } if (plain(best)) T.stun[name(best)] = (T.stun[name(best)] || 0) + 1; }
    else if (e.t === 'eat' && !e.nem && !s.events.some(o => o.t === 'oldEaten') && NAMES.has(e.name)) { const r = P(T, e.name); r.eaten++; r.met = Math.max(r.met, r.eaten); } // the rival and an old animal are not their species
  }
  // which way you run while something stronger is after you: the direction of each half second of running, sampled every 10 ticks.
  // A player who always runs the same way (always left, always to the same corner) adds up to a long arrow; one who runs any way, short.
  if (s.tick % 10 === 0) {
    T.trail.push([p.x, p.y]); if (T.trail.length > 4) T.trail.shift();
    const chased = s.mobs.some(m => m.alert && FORMS[m.f].power + (m.bonus || 0) > mine && Math.abs(m.x - p.x) < 600 && Math.abs(m.y - p.y) < 600);
    if (chased && T.trail.length === 4) { const [a, , , d] = T.trail, l = Math.hypot(d[0] - a[0], d[1] - a[1]); if (l > 20) { T.hx += (d[0] - a[0]) / l; T.hy += (d[1] - a[1]) / l; T.runs++; } }
  }
}

// ---------- between runs
// Targets for one run. Hunter traits mix this species' own record with the whole run's (by POOL chases), so a habit shows even on
// species met only once or twice. Prey traits are each species' own.
export function targets(T, way = [0, 0]) {
  const all = { chase: 0, grass: 0, rock: 0, tired: 0, dash: 0 };
  for (const r of Object.values(T.hunt)) for (const k in all) all[k] += r[k];
  const out = {}, same = T.runs >= 6 ? Math.hypot(...way) : null; // 1: always the same way, run after run; near 0: any way
  const at = n => (out[n] ??= TRAITS.map(() => null));
  for (const [n, r] of Object.entries(T.hunt)) {
    if (!r.chase) continue;
    const rate = k => (r[k] + (all.chase ? all[k] / all.chase : 0) * POOL) / (r.chase + POOL), o = at(n);
    o[I.grass] = clamp(6 * rate('grass'), 0, 1);
    o[I.stay] = clamp(2.5 * (rate('tired') + 0.5 * rate('dash')) - 3 * rate('rock'), -1, 1);
    if (same !== null) o[I.lead] = clamp(2 * (same - 0.3), 0, 1);
    o[I.shake] = clamp(4 * (T.stun[n] || 0) / r.chase, 0, 1);
  }
  for (const [n, r] of Object.entries(T.prey)) {
    if (r.met < 2) continue;
    const share = r.eaten / r.met, o = at(n);
    o[I.wary] = clamp(1.6 * share, 0, 1); o[I.bold] = clamp(0.5 - 2 * share, 0, 1);
    if (o[I.shake] === null && T.stun[n]) o[I.shake] = clamp(3 * T.stun[n] / r.met, 0, 1);
  }
  return out;
}
const band = v => Math.sign(v) * Math.floor(Math.abs(v) / 0.25 + 1e-9);
// One run ends. Returns { meadow, counted, changes }: the new meadow (a new object; the old one is not changed) and, once GRACE runs have
// counted, the traits that crossed a quarter of their range since the player was last told, strongest first.
export function advance(M0, T) {
  if (!(T.time >= MIN_RUN)) return { meadow: M0, counted: false, changes: [] };
  const M = { v: 1, runs: M0.runs + 1, way: (M0.way || [0, 0]).slice(), sp: {}, shown: {} };
  if (T.runs >= 6) { const l = Math.hypot(T.hx, T.hy) || 1; M.way = M.way.map((w, i) => w + (([T.hx, T.hy][i] / l) - w) * WAY); } // each run's way, as a unit arrow, into the average
  for (const n in M0.sp) { M.sp[n] = M0.sp[n].slice(); M.shown[n] = (M0.shown[n] || zero()).slice(); }
  for (const [n, goal] of Object.entries(targets(T, M.way))) {
    if (!NAMES.has(n)) continue;
    const v = M.sp[n] ??= zero(); M.shown[n] ??= zero();
    goal.forEach((g, i) => {
      if (g === null) return;
      const d = MUT === 'meadow' ? 3 * (g - v[i]) + 0.2 : clamp(RATE * (g - v[i]), -STEP, STEP); // the mutation: no step cap, no clamp, a push
      v[i] = MUT === 'meadow' ? v[i] + d : clamp(v[i] + d, TRAITS[i].lo, TRAITS[i].hi);
    });
  }
  const changes = [];
  if (M.runs >= GRACE) for (const n in M.sp) M.sp[n].forEach((v, i) => {
    const b = band(v), was = M.shown[n][i]; if (b === was) return;
    changes.push({ name: n, trait: TRAITS[i].k, i, v, up: Math.abs(b) > Math.abs(was), sign: Math.sign(b || was) }); M.shown[n][i] = b;
  });
  changes.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  return { meadow: M, counted: true, changes };
}
// For the lab record: numbers only. gen, species changed, and for each trait the mean and the largest size over the changed species.
export function summary(M) {
  const list = changed(M), r = x => Math.round(x * 100) / 100;
  return { gen: M.runs, species: list.length, mean: TRAITS.map((_, i) => r(list.reduce((a, n) => a + M.sp[n][i], 0) / (list.length || 1))), most: TRAITS.map((_, i) => r(list.reduce((a, n) => Math.max(a, Math.abs(M.sp[n][i])), 0))) };
}
