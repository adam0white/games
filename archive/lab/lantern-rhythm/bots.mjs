// Lantern Rhythm fairness check: node experiments/lab/lantern-rhythm/bots.mjs
// Exits non-zero when an assertion fails. The pass marks below were set before the first run.
//   1. Determinism: the same seed and the same steering give the same run, twice (nights 1 and 5, 5 seeds).
//   2. Every laid pattern has a safe line the boat can steer: for nights 1 to 5 over 50 seeds, between any two beats the
//      sideways speed the line asks for (with the boat held in its lane while it passes each rock) is at most the sim's
//      own limit, side(s); and at every beat the line clears every rock and both banks.
//   3. A bot that follows the ember line on night 1 reaches dawn on at least 80% of 30 seeds and plays at least 85% of
//      the melody (mean over the seeds).
//   4. A bot that ignores embers and only dodges (the main game's 'careful' bot, copied) reaches dawn on night 1 on at
//      least 80% of 30 seeds; and on nights 1 to 5 over 100 seeds, its share of runs with no hit at all here is at least
//      the main game's dawn share for the same bot (with the main flame held at this game's floor, so the dark cannot end
//      a main run and both bots see as far), less 0.05 for sampling noise.
//   5. Beat alignment: at sampled ticks every rock's y is within 1% of a beat multiple, and every ember's within 1% of
//      an off-beat.
import * as R from './sim.js';
import * as M from '../../lantern/sim.js';

let failed = 0;
const check = (ok, text) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`); if (!ok) failed++; };
const pct = v => `${(v * 100).toFixed(1)}%`;

// The ember-line bot: aims at the safe line a moment ahead of the boat.
function follow(s) {
  const y = s.y + R.speed(s) * 0.08, L = s.line;
  for (let i = 0; i + 1 < L.length; i++) if (L[i + 1].y >= y) { const a = L[i], b = L[i + 1], k = Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y))); return a.x + (b.x - a.x) * k; }
  return L.length ? L[L.length - 1].x : s.x;
}
// The main game's 'careful' bot (experiments/lantern/bots.mjs): dodges rocks inside the light, ignores embers.
const careful = sim => s => {
  const see = sim.sight(s), c = sim.centre(s, s.y + 0.2), h = sim.half(s, s.y + 0.2);
  let best = s.x, bestScore = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const x = c - h + 0.04 + (2 * h - 0.08) * i / 24;
    let score = -Math.abs(x - s.x) * 0.6 - Math.abs(x - c) * 0.3;
    for (const k of s.rocks) { const dy = k.y - s.y; if (dy > -0.03 && dy < see) { const gap = Math.max(0, Math.abs(k.x - x) - k.len) - k.rad - 0.03; if (gap < 0.03) score -= (0.03 - gap) * 60 / (0.15 + dy); } }
    if (score > bestScore) { bestScore = score; best = x; }
  }
  return best;
};

function ride(seed, night, policy, watch) {
  const s = R.create(seed, night); let n = 0; const log = [];
  while (!s.over) { R.step(s, policy(s)); if (s.events.length) log.push(s.n + ':' + s.events.join(',')); if (watch && n++ % 37 === 0) watch(s); }
  return { s, log };
}

// 1. Determinism.
{
  let same = true;
  for (const night of [1, 5]) for (let seed = 1; seed <= 5; seed++) {
    const key = r => JSON.stringify([r.s.n, r.s.y, r.s.x, r.s.taken, r.s.missed, r.s.hits, r.s.over, r.s.bars, r.log]);
    for (const p of [follow, careful(R)]) if (key(ride(seed, night, p)) !== key(ride(seed, night, p))) same = false;
  }
  check(same, 'determinism: same seed and steering give the same run (nights 1 and 5, seeds 1 to 5, both bots)');
}

// 2. A safe line for every laid pattern. A ghost boat that cannot be hit rides the line so the whole night is laid.
{
  let worst = 0, worstAt = '', clash = 0, beats = 0, bars = 0;
  const tiers = Array(R.BOOK.length).fill(0);
  for (let night = 1; night <= R.NIGHTS; night++) for (let seed = 1; seed <= 50; seed++) {
    const s = R.create(seed, night), line = new Map(), rocks = new Map();
    while (!s.over) { s.safe = 1e9; R.step(s, follow(s)); for (const p of s.line) if (p.beat !== undefined) line.set(p.beat, p); for (const k of s.rocks) { if (!rocks.has(k.beat)) rocks.set(k.beat, new Set()); rocks.get(k.beat).add(k); } }
    for (const b of s.bars) tiers[b.tier]++; bars += s.bars.length;
    const v = R.speed(s), cap = R.side(s), win = j => Math.max(0, ...[...(rocks.get(j) ?? [])].map(k => k.rad + R.BOAT));
    for (let j = 0; line.has(j + 1); j++) {
      const a = line.get(j), b = line.get(j + 1), dt = (R.BEAT - win(j) - win(j + 1)) / v, need = Math.abs(b.x - a.x) / dt;
      if (need / cap > worst) { worst = need / cap; worstAt = `night ${night} seed ${seed} beat ${j}`; }
    }
    for (const [j, p] of line) {
      beats++;
      const c = R.centre(s, p.y), h = R.half(s, p.y);
      if (Math.abs(p.x - c) > h - R.BOAT - 0.01) clash++;
      for (const k of rocks.get(j) ?? []) if (Math.max(0, Math.abs(k.x - p.x) - k.len) < k.rad + R.BOAT + 0.01) clash++;
    }
  }
  console.log(`      ${bars} bars laid; by tier ${tiers.join(' / ')}; ${beats} beats checked`);
  check(worst <= 1, `safe line: the most sideways speed any beat asks for is ${pct(worst)} of the boat's limit (${worstAt})`);
  check(clash === 0, `safe line clears every rock and bank by 0.01 at every beat (${clash} clashes)`);
}

// 3 and 5. The ember-line bot on night 1, watching beat alignment as it goes.
{
  let dawn = 0, mel = 0, minMel = 1, off = 0, offE = 0, samples = 0; const ends = {};
  const watch = s => {
    samples++;
    for (const k of s.rocks) { const b = k.y / R.BEAT; if (Math.abs(b - Math.round(b)) > 0.01) off++; }
    for (const e of s.embers) { const b = e.y / R.BEAT - 0.5; if (Math.abs(b - Math.round(b)) > 0.01) offE++; }
  };
  for (let seed = 1; seed <= 30; seed++) {
    const { s } = ride(seed, 1, follow, watch);
    ends[s.over] = (ends[s.over] ?? 0) + 1; if (s.over === 'dawn') dawn++;
    const m = R.melody(s); mel += m; minMel = Math.min(minMel, m);
  }
  check(dawn / 30 >= 0.8, `ember-line bot, night 1: dawn on ${dawn}/30 ${JSON.stringify(ends)}`);
  check(mel / 30 >= 0.85, `ember-line bot, night 1: plays ${pct(mel / 30)} of the melody on average (lowest ${pct(minMel)})`);
  check(off === 0 && offE === 0, `beat alignment over ${samples} sampled ticks: ${off} rocks off a beat, ${offE} embers off an off-beat`);
  for (let night = 2; night <= R.NIGHTS; night++) { let d = 0, m = 0; for (let seed = 1; seed <= 30; seed++) { const { s } = ride(seed, night, follow); if (s.over === 'dawn') d++; m += R.melody(s); } console.log(`      ember-line bot, night ${night}: dawn ${d}/30, melody ${pct(m / 30)}`); }
}

// 4. The dodge-only bot, here and on the main sim.
{
  let dawn = 0; const ends = {};
  for (let seed = 1; seed <= 30; seed++) { const { s } = ride(seed, 1, careful(R)); ends[s.over] = (ends[s.over] ?? 0) + 1; if (s.over === 'dawn') dawn++; }
  check(dawn / 30 >= 0.8, `dodge-only bot, night 1: dawn on ${dawn}/30 ${JSON.stringify(ends)}`);
  for (let night = 1; night <= R.NIGHTS; night++) {
    let clean = 0, mainDawn = 0, mel = 0; const mainEnds = {}, hits = [];
    for (let seed = 1; seed <= 100; seed++) {
      const { s } = ride(seed, night, careful(R)); if (!s.hits) clean++; hits.push(s.hits); mel += R.melody(s);
      const m = M.create(seed, night, false, []), pol = careful(M);
      while (!m.over) { m.light = R.FLOOR; m.warm = 0; M.step(m, pol(m)); }
      mainEnds[m.over] = (mainEnds[m.over] ?? 0) + 1; if (m.over === 'dawn') mainDawn++;
    }
    const mean = hits.reduce((a, b) => a + b, 0) / hits.length;
    check(clean / 100 >= mainDawn / 100 - 0.05, `dodge-only bot, night ${night}: no-hit runs here ${clean}/100 (mean hits ${mean.toFixed(2)}, melody ${pct(mel / 100)} by chance); main sim dawn ${mainDawn}/100 ${JSON.stringify(mainEnds)}`);
  }
}

console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
