// Lantern Duet bots: node bots.mjs. Exits non-zero on a failed assertion.
// Acceptance, fixed before the first run and never loosened:
//   adaptive reaches dawn on >= 50% of seeds on night 1;
//   adaptive median progress exceeds "together" and "wide" by >= 0.20 each;
//   adaptive takes more embers than together; wide snags more than adaptive.
import assert from 'node:assert/strict';
import { create, step, centre, half, baseHalf, fall, ropeMax, progress, speed, BOAT, NIGHTS, WARN_TIME } from './sim.js';

const SEEDS = 30;
const PAIR = 0.05; // the gap the bots keep when they gather
const CLEAR = 0.012; // extra room the bots leave round a rock
const LOOK = WARN_TIME; // seconds ahead the bots read; less than the page shows (1.2 s or more)

// The gathered pair's middle closest to `from` that clears every rock in `cluster` and both banks.
function threadGap(s, cluster, from) {
  const y = cluster[0].y, c = centre(s, y), h = half(s, y), reach = PAIR / 2 + BOAT + CLEAR;
  let best = null;
  for (let m = c - h + reach; m <= c + h - reach; m += 0.004) {
    if (!cluster.every(k => Math.abs(m - k.x) > k.rad + reach)) continue;
    if (best === null || Math.abs(m - from) < Math.abs(best - from)) best = m;
  }
  return best;
}

// The original rule for one rock: gather on the river's wider side of it.
function besideRock(s, k) {
  const rc = centre(s, k.y), h = half(s, k.y);
  const side = k.x <= rc ? 1 : -1, mid = k.x + side * (k.rad + 0.085);
  return Math.max(rc - h + 0.065, Math.min(rc + h - 0.065, mid));
}

const pair = m => [m - PAIR / 2, m + PAIR / 2];

export function policy(s, kind = 'adaptive') {
  const look = speed(s) * LOOK, here = (s.left + s.right) / 2;
  const c = centre(s, s.y + 0.1), gap = ropeMax(s) * 0.98;
  if (kind === 'wide') return [c - gap / 2, c + gap / 2];

  // A snag in progress, or rocks ahead: gather and pass them together.
  if (s.snag) return pair(besideRock(s, s.snag));
  const rocks = s.rocks.filter(k => !k.spent && k.y > s.y - 0.08 && k.y < s.y + look);
  if (rocks.length) {
    const cluster = rocks.filter(k => Math.abs(k.y - rocks[0].y) < 0.15);
    const m = kind === 'adaptive' ? threadGap(s, cluster, here) : null;
    return pair(m ?? besideRock(s, cluster[0]));
  }
  if (kind === 'together') return pair(c);

  // A narrow reach ahead: keep the rope short and follow the middle.
  for (let d = 0; d < look; d += 0.05) {
    if (half(s, s.y + d) < baseHalf(s, s.y + d) * 0.95) return pair(centre(s, s.y + Math.min(d + 0.1, look)));
  }
  // Embers ahead: spread just enough to sweep the next group, centred on it.
  const next = s.embers.filter(e => !e.got && e.y > s.y - 0.03 && e.y < s.y + look);
  if (next.length) {
    const first = Math.min(...next.map(e => e.y));
    const group = next.filter(e => e.y < first + 0.4);
    const lo = Math.min(...group.map(e => e.x)), hi = Math.max(...group.map(e => e.x));
    const g = Math.max(PAIR, Math.min(gap, hi - lo - 0.02));
    const room = half(s, s.y) - BOAT - 0.01, cc = centre(s, s.y);
    const m = Math.max(cc - room + g / 2, Math.min(cc + room - g / 2, (lo + hi) / 2));
    return [m - g / 2, m + g / 2];
  }
  return [c - gap / 2, c + gap / 2];
}

function run(seed, kind, night = 1) {
  const s = create(seed, night);
  for (let i = 0; i < 20000 && !s.over; i++) step(s, policy(s, kind));
  return { progress: progress(s), dawn: s.over === 'dawn', embers: s.taken, snags: s.snags, over: s.over };
}

function table(night) {
  const rows = {};
  for (const kind of ['adaptive', 'together', 'wide']) {
    const runs = Array.from({ length: SEEDS }, (_, i) => run(i + 1, kind, night));
    const mean = key => runs.reduce((n, r) => n + Number(r[key]), 0) / SEEDS;
    const ends = {};
    for (const r of runs) ends[r.over] = (ends[r.over] || 0) + 1;
    rows[kind] = {
      medianProgress: +runs.map(r => r.progress).sort((a, b) => a - b)[SEEDS / 2].toFixed(3),
      dawn: +mean('dawn').toFixed(3), embers: +mean('embers').toFixed(1), snags: +mean('snags').toFixed(2),
      ends: Object.entries(ends).map(([k, n]) => `${k}:${n}`).join(' '),
    };
    assert.deepEqual(run(11, kind, night), run(11, kind, night), 'deterministic replay');
  }
  return rows;
}

const rows = table(1);
console.log('Night 1, seeds 1-30');
console.table(rows);
assert(rows.adaptive.dawn >= 0.5, 'adaptive reaches dawn on at least half the seeds');
for (const kind of ['together', 'wide']) {
  assert(rows.adaptive.medianProgress >= rows[kind].medianProgress + 0.2, `adaptive clearly beats ${kind}`);
}
assert(rows.adaptive.embers > rows.together.embers, 'spreading takes more embers');
assert(rows.wide.snags > rows.adaptive.snags, 'staying wide snags more');
console.log('PASS: night 1 thresholds and deterministic replay');

// Nights 2 and 3 are reported, and the adaptive bot must still finish some of them.
for (let night = 2; night <= NIGHTS; night++) {
  const later = table(night);
  console.log(`Night ${night}, seeds 1-30`);
  console.table(later);
  assert(later.adaptive.dawn > 0, `night ${night} can be finished`);
}

// Every pattern kind appears on night 1, and the first 30 seconds stay the teaching sequence.
let kinds = { pairs: 0, sides: 0, narrows: 0, arcs: 0 };
for (let seed = 1; seed <= SEEDS; seed++) {
  const s = create(seed);
  const rowsAt = new Map();
  for (const e of s.embers) rowsAt.set(e.y, (rowsAt.get(e.y) || 0) + 1);
  kinds.arcs += new Set(s.embers.filter(e => e.y > 20 && rowsAt.get(e.y) === 1).map(e => Math.round(e.y))).size > 0;
  const ys = new Map();
  for (const k of s.rocks) ys.set(k.y, (ys.get(k.y) || 0) + 1);
  kinds.pairs += [...ys.values()].some(n => n === 2);
  kinds.sides += s.rocks.some(k => k.rad >= 0.05);
  kinds.narrows += s.narrows.length > 0;
  const first = s.embers.filter(e => e.y === 3), rock = s.rocks[0];
  assert.equal(first.length, 5, 'teaching: a five-ember line first');
  assert(first.at(-1).x - first[0].x > ropeMax(s) * 0.7, 'teaching: the first line needs a wide rope');
  assert(Math.abs(rock.y - 4.8) < 1e-9 && Math.abs(rock.x - centre(s, rock.y)) < 0.02, 'teaching: then a lone rock in the middle');
  assert(s.rocks.filter(k => k.y < 20).every(k => k.rad < 0.045), 'teaching: only lone rocks in the first 30 s');
  assert.equal(s.narrows.filter(n => n.y0 < 20).length, 0, 'teaching: no narrow reach in the first 30 s');
}
for (let seed = 1; seed <= SEEDS; seed++) {
  const s = create(seed, 3), near = y => [0, 0.5, 1, 1.5].some(d => fall(s, y - d) > 0);
  assert(s.rocks.every(k => !near(k.y)) && s.embers.every(e => !near(e.y)), 'night 3: nothing in or just after the waterfall');
  assert(s.narrows.every(n => !near(n.y0 - 0.6) && !near(n.y1 + 0.6)), 'night 3: no narrow reach in the waterfall');
}
console.log('Night 1 seeds with each pattern:', kinds);
for (const n of Object.values(kinds)) assert(n >= SEEDS * 0.8, 'each pattern appears on most nights');
console.log('PASS: teaching sequence and pattern variety');

// Independent constraint and known bad-case checks (kept from the first version).
const s = create(99);
for (let i = 0; i < 100; i++) {
  step(s, [0, 1]);
  assert(s.left < s.right);
  assert(s.right - s.left <= ropeMax(s) + 1e-9);
}
const bad = create(1);
bad.rocks = [{ x: bad.x, y: 0.02, rad: 0.03 }];
bad.left = bad.x - 0.1;
bad.right = bad.x + 0.1;
for (let i = 0; i < 35; i++) step(bad, [bad.left, bad.right]);
assert(bad.snags === 1);
assert(bad.hearts === 2);
console.log('PASS: rope limits, forced snag damage');

const freed = create(7);
freed.rocks = [{ x: freed.x, y: 0.02, rad: 0.03 }];
freed.left = freed.x - 0.1;
freed.right = freed.x + 0.1;
step(freed, [freed.left, freed.right]);
const rockX = freed.rocks[0].x;
let released = false;
for (let i = 0; i < 7; i++) step(freed, [freed.left, freed.right]);
for (let i = 0; i < 21; i++) {
  step(freed, [rockX + 0.065, rockX + 0.115]);
  released ||= freed.events.includes('free');
}
assert(released);
assert.equal(freed.hearts, 3);
const bank = create(5);
for (let i = 0; i < 100; i++) {
  step(bank, [0, 0]);
  assert(bank.right - bank.left >= BOAT * 2.2 - 1e-9);
}
console.log('PASS: snag recovery and paired bank projection');

// The warning comes before the snag: a rock between the boats sounds about a second ahead.
const lead = create(3);
lead.rocks = [{ x: lead.x, y: 0.62, rad: 0.035, snagged: false, spent: false, warned: false }];
lead.left = lead.x - 0.1;
lead.right = lead.x + 0.1;
let warnedAt = null, snaggedAt = null;
for (let i = 0; i < 90 && snaggedAt === null; i++) {
  step(lead, [lead.left, lead.right]);
  if (lead.events.includes('warn')) warnedAt = lead.t;
  if (lead.events.includes('snag')) snaggedAt = lead.t;
  if (warnedAt !== null && snaggedAt === null) assert.equal(lead.danger, lead.rocks[0]);
}
assert(warnedAt !== null && snaggedAt - warnedAt > 0.85, `warning ${warnedAt} leads snag ${snaggedAt} by about a second`);
console.log('PASS: snag warning leads by', (snaggedAt - warnedAt).toFixed(2), 's');

// A wide rope entering a narrow reach: a warning, one heart, and the pair squeezed inside the banks.
const tight = create(4);
tight.rocks = [];
tight.embers = [];
tight.narrows = [{ y0: 0.8, y1: 2, warned: false }];
let narrowWarned = false;
for (let i = 0; i < 200; i++) {
  // Steer wide until the bank is hit, then gather in the middle.
  const c = centre(tight, tight.y), g = tight.hearts === 3 ? ropeMax(tight) : PAIR;
  step(tight, [c - g / 2, c + g / 2]);
  narrowWarned ||= tight.events.includes('narrow');
  const edge = half(tight, tight.y) - BOAT, cc = centre(tight, tight.y);
  assert(tight.left >= cc - edge - 1e-9 && tight.right <= cc + edge + 1e-9, 'never outside the banks');
}
assert(narrowWarned);
assert.equal(tight.hearts, 2);
console.log('PASS: narrow reach warns, costs one heart and squeezes the pair inside the banks');
