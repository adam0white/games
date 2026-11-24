// Input shaping for Lantern Voice. Pure, no DOM: the page and bots.mjs both steer through this file.
// A pitch (hertz or null, one per analysis frame) becomes a place across the river:
//   1. hertz to semitones (log scale);
//   2. the median of the voiced frames among the last MEDIAN frames (fewer than VOICED voiced frames is silence);
//   3. a fraction u of the player's saved range, 0 at the low note and 1 at the high note;
//   4. a short low-pass on u with time constant TAU;
//   5. u to a place across the water at the boat's row: low is the left bank, high the right;
//   6. the aim assist: a place that points at, or just beside, a safe gap ahead is pulled softly toward that
//      gap's centre (see gaps() for what a safe gap is).
// Silence holds u, not the place on screen, so the boat keeps its line across the river as the river bends.
import { centre, half, boat, speed, sight, nightPace } from '../../lantern/sim.js';
import { semis } from './pitch.js';

export const MEDIAN = 5;       // frames in the median, about 80 ms at 60 frames a second
export const VOICED = 2;       // voiced frames needed among them; fewer is silence
export const TAU = 0.045;      // seconds: the low-pass after the median
export const MIN_RANGE = 4;    // semitones: a narrower saved range is refused at calibration
export const ASSIST = 0.8;     // aim assist strength: the share of the way to the gap's centre the target moves at full pull
export const REACH = 0.15;     // river widths (about a quarter of the water) outside a gap's edge within which the assist still pulls
export const INNER = 0.03;     // river widths inside a gap's edge: deeper than this, the assist leaves the aim alone
export const LOOK = 1.0;       // seconds of river ahead the assist checks a path for

export function createVoice(range) { return { lo: range.lo, hi: range.hi, frames: [], u: null, raw: null, held: false, note: null }; }

// One analysis frame. hz is a number or null; dt is seconds since the last frame. Returns the smoothed u, or null
// before the first note. v.note is the median semitone (for the pitch ladder), v.held is true during silence.
export function hear(v, hz, dt) {
  v.frames.push(hz ? semis(hz) : null);
  if (v.frames.length > MEDIAN) v.frames.shift();
  const voiced = v.frames.filter(m => m !== null).sort((a, b) => a - b);
  if (voiced.length < VOICED) { v.held = true; return v.u; }
  const k = voiced.length, m = k % 2 ? voiced[k >> 1] : 0.5 * (voiced[k / 2 - 1] + voiced[k / 2]);
  v.note = m; v.held = false;
  v.raw = Math.max(0, Math.min(1, (m - v.lo) / (v.hi - v.lo)));
  v.u = v.u === null ? v.raw : v.u + (v.raw - v.u) * (1 - Math.exp(-dt / TAU));
  return v.u;
}
// Set the held place, so a voice that has been quiet picks up from here (after a finger has steered).
export function seat(v, u) { v.u = Math.max(0, Math.min(1, u)); }

// u to a place across the water at the boat's row, kept a boat's width off each bank; and back.
const span = s => { const c = centre(s, s.y), h = half(s, s.y), m = boat(s) + 0.012; return [c - h + m, c + h - m]; };
export function toRiver(s, u) { const [a, b] = span(s); return a + Math.max(0, Math.min(1, u)) * (b - a); }
export function fromRiver(s, x) { const [a, b] = span(s); return Math.max(0, Math.min(1, (x - a) / (b - a))); }

// Assist tuning, one object so bots.mjs can sweep it; the page uses these values.
export const TUNE = { strength: ASSIST, reach: REACH, inner: INNER, look: LOOK, margin: 0.012, columns: 40 };

// The safe gaps ahead, as places to steer for. For each of `columns` places across the water at the boat's row, the
// boat is sent there at its top sideways speed and held for LOOK seconds; a place is safe when on that path the boat
// keeps `margin` clear of the banks and of every rock the lantern shows (rocks are moved as the rules move them). A gap
// is a run of neighbouring safe places. This is the player's own question, "if I sing here, do I get through?", so it
// accounts for the river's bends, for swinging rocks and for the boat's limited sideways speed.
export function gaps(s, tune = TUNE) {
  const b = boat(s), v = speed(s) * (s.slow ? 0.5 : 1), side = 0.95 * nightPace(s.stage) * s.hard;
  const ahead = s.y + sight(s) + 0.15, rocks = s.rocks.filter(k => k.on && k.y < ahead && k.y0 + k.rad + b + (k.b || 0) + 0.3 > s.y && k.kind !== 'pool');
  const c0 = centre(s, s.y), h0 = half(s, s.y) - b - tune.margin, n = tune.columns, safe = [];
  for (let i = 0; i <= n; i++) {
    const x = c0 - h0 + 2 * h0 * i / n;
    let ok = true;
    for (let t = 0.05; ok && t <= tune.look + 1e-9; t += 0.05) {
      const yb = s.y + v * t, xb = s.x + Math.max(-side * t, Math.min(side * t, x - s.x));
      if (Math.abs(xb - centre(s, yb)) > half(s, yb) - b - tune.margin) { ok = false; break; }
      for (const k of rocks) {
        const yr = k.y0 + (k.vy ? k.vy * t : 0) + (k.b ? k.b * Math.sin((s.t + t) * k.wy + k.ph + k.phy) : 0);
        if (Math.abs(yr - yb) > k.rad + b + 0.05) continue;
        const xr = k.a ? k.x0 + k.a * Math.sin((s.t + t) * k.w + k.ph) : k.x;
        if (Math.hypot(Math.max(0, Math.abs(xr - xb) - k.len), yr - yb) - k.rad - b < tune.margin) { ok = false; break; }
      }
    }
    safe.push(ok ? x : null);
  }
  // A gap's side that is the bank (the first or last place) is not an edge the assist pulls away from.
  const out = []; let run = null;
  safe.forEach((x, i) => { if (x === null) { if (run) out.push(run); run = null; } else if (run) { run.hi = x; run.bankHi = i === n; } else run = { lo: x, hi: x, bankLo: i === 0, bankHi: i === n }; });
  if (run) out.push(run);
  const all = out.length === 1 && safe.every(x => x !== null); // nothing in the way: no gap to show
  return { y: s.y + Math.min(sight(s), v * tune.look) * 0.8, gaps: all ? [] : out, all };
}

// The aim assist. x is the place the voice asks for. Returns { target, gap, pull, y }: gap is the gap pulled toward
// (or null), pull is 0 to 1 (how hard it pulled; the page draws the guide line this bright), y the row's place.
// Of the gaps whose edge x is within REACH of (or inside), the widest is chosen. Deep inside a gap the aim is left
// alone, so the player can still go for an ember beside a rock; near the edge the pull rises to full, and an aim just
// outside the gap is brought into it.
export function assist(s, x, strength = TUNE.strength, tune = TUNE) {
  const row = strength > 0 ? gaps(s, tune) : null;
  if (!row || !row.gaps.length) return { target: x, gap: null, pull: 0, y: row?.y ?? null };
  let gap = null;
  for (const g of row.gaps) if (x >= g.lo - tune.reach && x <= g.hi + tune.reach && (!gap || g.hi - g.lo > gap.hi - gap.lo)) gap = g;
  if (!gap) return { target: x, gap: null, pull: 0, y: row.y };
  const depth = Math.min(gap.bankLo ? Infinity : x - gap.lo, gap.bankHi ? Infinity : gap.hi - x); // negative outside the gap
  const w = depth >= tune.inner ? 0 : depth <= 0 ? 1 : 1 - depth / tune.inner;
  // Outside the gap the aim is first brought to the gap's nearer edge, then eased toward the centre like an aim on the edge.
  const mid = 0.5 * (gap.lo + gap.hi), from = Math.max(gap.lo, Math.min(gap.hi, x));
  return { target: from + strength * w * (mid - from), gap, pull: w, y: row.y };
}

// The whole chain from a heard u to the sim's target.
export function shape(s, u, strength = TUNE.strength, tune = TUNE) { return assist(s, toRiver(s, u), strength, tune); }
