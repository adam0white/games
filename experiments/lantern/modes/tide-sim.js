// Lantern: Tide. The tide layer over Lantern's unchanged rules (../sim.js). Pure: no DOM, no Date.now, no Math.random.
// A current runs down the river in a bright channel that winds from bank to bank. In the channel the boat goes faster and the
// flame hardly burns; in slack water the flame burns down. Rocks squeeze the water round their shoulders into fast water, and
// behind a rock lies quiet water (its lee) where the wick relights. From the lab page lantern-tide (archive/lab/lantern-tide/),
// rebuilt as five stages with one new idea each (../NOTES.md, "Tide is a mode inside Lantern").
//
// The writes into Lantern's state, each tick: `s.calm` is scaled by the water's rate for the step and put back after it;
// `s.st.wick` is set to 12.5 for the step (that zeroes Lantern's own fade) and put back, and `s.light` is set by the tide's burn
// and relight before the step. After the step the layer clears rocks the stage does not have (and any in the first stretch),
// thins Lantern's embers to the stage's share, and lays the ember path along the channel. It never draws from Lantern's random
// streams (s.r, s.q), so a seed lays the same river as in Lantern before the layer thins it.
import { create, step, centre, half, boat, progress, GOAL, DT } from '../sim.js?v=15';
export { centre, half, boat, progress, GOAL, DT };

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };

// One new idea a stage. river: Lantern's story night whose rocks lie in the water. length: river units to dawn.
// rocks: the share of Lantern's rocks left in the water (0: none). path: river units of the ember path laid along the channel from the start.
// keep: the share of Lantern's own embers left in the water. burn: flame lost a second in slack water (the channel saves
// 95% of it). relight: flame regained a second in a full lee (0: the lee is not there yet). turn: how far the channel slides
// across the river with time, in half-widths. gain: how much faster the channel's water runs than slack water.
// hearts: Lantern's 'hearts' stat (spare hulls).
// slack: from stage 3 the channel goes slack in stretches (SLACK), where the lees and the embers are the only light.
export const STAGES = [null,
  { river: 1, length: 26, rocks: 0, path: 9, keep: 0.25, burn: 0.12, relight: 0, slack: false, turn: 0, gain: 0.55, hearts: 2 },    // 1 the bright water keeps the flame
  { river: 1, length: 40, rocks: 0.45, path: 6, keep: 0.5, burn: 0.12, relight: 0, slack: false, turn: 0, gain: 0.55, hearts: 2 },      // 2 rocks squeeze fast water round their shoulders
  { river: 1, length: 50, rocks: 0.55, path: 6, keep: 0.3, burn: 0.12, relight: 0.45, slack: true, turn: 0, gain: 0.55, hearts: 2 },    // 3 where the tide goes slack, the quiet water behind a rock relights the wick
  { river: 1, length: 50, rocks: 0.55, path: 6, keep: 0.3, burn: 0.12, relight: 0.45, slack: true, turn: 0.2, gain: 0.55, hearts: 2 }, // 4 the tide turns: the channel slides across
  { river: 2, length: 60, rocks: 0.55, path: 6, keep: 0.3, burn: 0.12, relight: 0.45, slack: true, turn: 0.2, gain: 0.55, hearts: 2 }, // 5 ice rides the flood
];
export const GRACE = 6; // seconds at the start of every stage when the bank holds the boat in instead of costing a hull
export const SLACK = { every: 13, from: 7, len: 4, ease: 1 }; // a slack stretch of 4 river units every 13, the first at 7
export const NIGHTS = STAGES.length - 1;
export const CLEAR = 6.5; // no rock lies in the first stretch of any stage, past the ember path: about six seconds of open water to find the channel
export const NEW = ['', 'bright', 'shoulder', 'lee', 'turn', 'ice']; // each stage's one new idea, for the card and the checks

export function config(n) { n = Math.max(1, Math.min(NIGHTS, Math.floor(n) || 1)); return { n, ...STAGES[n] }; }

export function start(seed, n) {
  const cf = config(n), s = create(seed, cf.river, false, [], { hearts: cf.hearts });
  s.bonus = GOAL - cf.length; // Lantern credits distance toward dawn apart from y; a shorter stage starts nearer dawn
  s.light = 1;
  const e = { s, cf, seed, flow: { rush: 0, lee: 0, rate: 1 }, rested: 0, ridden: 0, laid: 0.8, blows: 0, events: [] };
  tidy(e);
  return e;
}

export const reach = e => clamp((e.s.y + e.s.bonus - (GOAL - e.cf.length)) / e.cf.length);

// Where the channel runs, as a share of the half-width from the centre (-1 one bank, 1 the other). It winds with the river's
// distance; from stage 4 it also slides with time, so the water under a boat that holds still changes.
export function jet(e, y, t = e.s.t) {
  const s = e.s;
  return 0.46 * Math.sin(y * 0.72 + s.p1) + (0.08 + e.cf.turn) * Math.sin(t * 0.46 + y * 0.31 + s.p2);
}
// How strongly the channel runs at y: 1, or down to 0.2 inside a slack stretch (stage 3 on).
export function strength(e, y) {
  if (!e.cf.slack || y < SLACK.from - SLACK.ease) return 1;
  const d = (y - SLACK.from) % SLACK.every, inside = Math.min(d + SLACK.ease, SLACK.len + SLACK.ease - d, SLACK.ease) / SLACK.ease;
  return 1 - 0.8 * smooth(inside);
}

// The water at (x, y): rush 0 to 1 (the channel and a rock's shoulders), lee 0 to 1 (behind a rock, from stage 3), and rate,
// how fast it carries the boat against Lantern's own pace.
export function current(e, x, y, t) {
  const s = e.s, cf = e.cf, width = half(s, y), u = (x - centre(s, y)) / width;
  let rush = strength(e, y) * smooth(1 - Math.abs(u - jet(e, y, t)) / 0.5), lee = 0;
  const hull = boat(s);
  let blocked = (1 - Math.abs(u)) * width < hull + 0.012; // against the bank there is no rest
  for (const k of s.rocks) {
    if (!k.on) continue;
    const down = y - k.y; if (down < -0.46 || down > 0.66) continue;
    const across = x - k.x, room = k.rad + hull + 0.012;
    if (Math.abs(down) < room && Math.abs(across) < room) blocked ||= across * across + down * down < room * room;
    const shoulder = smooth(1 - Math.abs(Math.abs(across) - k.rad - 0.042) / 0.11);
    rush = Math.max(rush, 0.88 * shoulder * smooth(1 - Math.abs(down + 0.12) / 0.34));
    if (cf.relight > 0) { // by the time the water can relight the wick, the hull has cleared the rock
      const wide = k.rad + 0.045;
      lee = Math.max(lee, smooth(1 - Math.abs(across) / wide) * smooth((down - k.rad - 0.03) / 0.1) * smooth((0.66 - down) / 0.2));
    }
  }
  if (blocked) lee = 0;
  rush *= 1 - lee;
  return { rush, lee, rate: 1 + cf.gain * rush - 0.3 * lee };
}

// One tick. Returns Lantern's events for the tick, plus 'fast' and 'slack' when the boat enters or leaves fast water and 'lee'
// when it enters a lee.
export function tick(e, target) {
  const s = e.s, cf = e.cf;
  e.events = [];
  if (s.over) { step(s, target); return e; }
  const flow = current(e, s.x, s.y), was = e.flow, calm = s.calm, wick = s.st.wick, before = s.light;
  const burn = cf.burn * (1 - 0.95 * flow.rush) * (s.warm > DT ? 0.72 : 1), relight = cf.relight * flow.lee;
  s.calm = calm * flow.rate; s.st.wick = 12.5; // 1 - 0.08 * 12.5 = 0: Lantern's own fade stops; the tide's burn is the fade
  s.light = clamp(before + (relight - burn) * DT, -1, 1); // at 0 Lantern's step ends the night 'dark'
  if (s.t < GRACE) { const y = s.y + 0.02, c = centre(s, y), edge = half(s, y) - boat(s) - 0.012; s.x = clamp(s.x, c - edge, c + edge); target = clamp(target, c - edge, c + edge); } // the bank holds the boat in
  try { step(s, target); } finally { s.calm = calm; s.st.wick = wick; }
  e.rested += Math.max(0, relight - burn) * DT * (s.light < 1 ? 1 : 0);
  if (flow.rush > 0.5) e.ridden += DT;
  e.flow = flow;
  if (flow.rush > 0.5 && was.rush <= 0.5) e.events.push('fast');
  if (flow.rush < 0.3 && was.rush >= 0.3) e.events.push('slack');
  if (flow.lee > 0.4 && was.lee <= 0.4) e.events.push('lee');
  for (const v of s.events) if (v === 'hurt' || v === 'hit' || v === 'break') e.blows++;
  if (!s.over) tidy(e);
  return e;
}

// What the stage lays on Lantern's river: no rocks on stage 1 or in the first stretch, a share of Lantern's embers, and an
// ember path along the channel at the start (the first ten seconds teach by it: follow the embers, find the bright water).
const KEEP = new WeakMap();
function tidy(e) {
  const s = e.s, cf = e.cf;
  s.rocks = s.rocks.filter(k => {
    if (!cf.rocks || k.y0 <= CLEAR) return false;
    let keep = KEEP.get(k); if (keep === undefined) { keep = frac(k.x0 * 7919 + k.y0 * 3571) < cf.rocks; KEEP.set(k, keep); }
    return keep;
  });
  s.embers = s.embers.filter(m => {
    if (m.got || m.kind !== 'ember' || m.path) return true;
    let k = KEEP.get(m); if (k === undefined) { k = frac(m.x * 9301 + m.y * 4973) < cf.keep; KEEP.set(m, k); }
    return k;
  });
  for (; e.laid < Math.min(cf.path, s.y + 2.4); e.laid += 0.42) {
    const y = e.laid, x = centre(s, y) + half(s, y) * jet(e, y, s.t + (y - s.y) / 1.5); // where the channel will be when the boat comes (in fast water the boat runs about 1.5 river units a second)
    s.embers.push({ x, y, got: false, kind: 'ember', path: true });
  }
  s.embers.sort((a, b) => a.y - b.y); // Lantern drops passed embers from the front
}
const frac = v => { const f = Math.sin(v) * 43758.5453; return f - Math.floor(f); };

// The stars a stage gives at dawn: dawn; no blow taken; and the tide ridden (at least half the night's time in fast water).
export function rating(e) {
  if (e.s.over !== 'dawn') return 0;
  return 1 + (e.blows === 0 ? 1 : 0) + (e.ridden >= 0.5 * e.s.t ? 1 : 0);
}
