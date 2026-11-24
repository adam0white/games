// Measured play: node experiments/lantern/bots.mjs [runs] [stages, comma-separated]. Three policies of rising skill; prints how runs end.
// Modes (exit non-zero on a failed check):
//   node experiments/lantern/bots.mjs parity [seeds] [--mutate]   with no mode chosen, sim.js plays exactly as on main (see parity below)
//   node experiments/lantern/bots.mjs spark [runs] [--mutate[=flies-anywhere]]   Spark's claims (modes/spark-bots.mjs)
import { create, step, centre, half, sight, score, progress, towerStage, GOAL, BOAT } from './sim.js';
const SUB = ['parity', 'spark'].includes(process.argv[2]) ? process.argv[2] : '';
if (SUB === 'spark') { // its own process: spark-bots.mjs reads its arguments and runs worker threads
  const { spawnSync } = await import('node:child_process');
  const out = spawnSync(process.execPath, [new URL('./modes/spark-bots.mjs', import.meta.url).pathname, ...process.argv.slice(3)], { stdio: 'inherit' });
  process.exit(out.status ?? 1);
}
// A stage of -100 - L is tower level L (with that level's things); -n above -100 is the old tower holding night n's things at level 1.
const make = (seed, stage, set, stats) => stage <= -100 ? create(seed, towerStage(-stage - 100), 'tower', set, stats, -stage - 100) : create(seed, Math.abs(stage) || 1, stage < 0 ? 'tower' : !stage, set, stats);
const label = stage => stage <= -100 ? `tower level ${-stage - 100}` : stage < 0 ? `tower ${-stage}` : stage ? `stage ${stage}` : 'endless';
const runs = Number(process.argv[2] ?? 300);
const policies = {
  // Sees nothing but the banks.
  drift: s => centre(s, s.y + 0.15),
  // Dodges rocks inside the light; ignores embers.
  careful: s => steer(s, false),
  // Dodges rocks and goes for embers it can see.
  greedy: s => steer(s, true),
};
function steer(s, wantEmbers) {
  const see = sight(s), c = centre(s, s.y + 0.2), h = half(s, s.y + 0.2);
  let best = s.x, bestScore = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const x = c - h + 0.04 + (2 * h - 0.08) * i / 24;
    let score = -Math.abs(x - s.x) * 0.6 - Math.abs(x - c) * 0.3;
    for (const k of s.rocks) { const dy = k.y - s.y; if (dy > -0.03 && dy < see) { const gap = Math.max(0, Math.abs(k.x - x) - k.len) - k.rad - 0.03; if (gap < 0.03) score -= (0.03 - gap) * 60 / (0.15 + dy); } }
    if (wantEmbers) for (const e of [...s.embers, ...s.powers]) { const dy = e.y - s.y; if (!e.got && dy > 0 && dy < 1.2) score += Math.max(0, 0.12 - Math.abs(e.x - x)) * (4 + 6 * (1 - s.light)) / (0.3 + dy); }
    if (score > bestScore) { bestScore = score; best = x; }
  }
  return best;
}
if (!SUB && process.argv[3] !== 'audit') for (const stage of (process.argv[3] ? process.argv[3].split(',').map(Number) : [1, 3, 5, 6, 8, 11, 12, 15, 17, 18, 20, 21, 30, 40, 50, 0, -3, -12, -101, -110, -125, -150, -151, -175, -200])) for (const [name, policy] of Object.entries(policies)) {
  const ends = {}, dist = []; let grazes = 0, embers = 0, gifts = 0, powers = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const s = make(seed, stage); // stage 0 is the endless river, -n the tower
    while (!s.over) { step(s, policy(s)); for (const e of s.events) if (e === 'heart' || e === 'shield') gifts++; else if (['boost', 'slow', 'small', 'big'].includes(e)) powers++; }
    ends[s.over] = (ends[s.over] ?? 0) + 1; dist.push(stage ? progress(s) : score(s) / 100); grazes += s.grazes; embers += s.taken;
  }
  dist.sort((a, b) => a - b);
  const q = p => (dist[Math.floor(p * (runs - 1))] * 100).toFixed(0) + '%';
  console.log(stage ? label(stage) : 'endless (score)', name.padEnd(8), JSON.stringify(ends), `distance p10 ${q(0.1)} median ${q(0.5)} p90 ${q(0.9)}`, `grazes/run ${(grazes / runs).toFixed(1)} embers/run ${(embers / runs).toFixed(1)} hearts+shields/run ${(gifts / runs).toFixed(2)} powers/run ${(powers / runs).toFixed(2)}`);
}

// Passability audit: node experiments/lantern/bots.mjs 200 audit. A ghost boat rides the centre line and cannot die;
// each tick we measure the widest free gap across the river at the boat's row. A river is unfair if that gap closes.
// Also prints where the hazards sit, by tenth of the river, to show the ramp.
if (!SUB && process.argv[3] === 'audit') for (const stage of (process.argv[4] ? process.argv[4].split(',').map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 30, 35, 40, 45, 50, 0, -3, -12, -101, -110, -125, -150, -151, -160, -175, -200])) { // a list after audit picks the stages // 0 is the endless river; -n is the tower with night n's things
  let worst = Infinity, worstBig = Infinity, tight = 0, buried = 0, pickups = 0; const swing = Array(10).fill(0), all = Array(10).fill(0), seen = new Set();
  for (let seed = 1; seed <= (stage ? runs : Math.ceil(runs / 10)); seed++) { // the endless river is ridden far past its last step harder, on fewer seeds
    for (const [set, stats] of [[[]], [['boost']], [['slow']], [undefined], [undefined, { calm: 3 }]]) { // powers and calm water shift when the boat meets each moving rock, so every river is ridden five ways
    const s = make(seed, stage, set, stats); let min = Infinity; seen.clear(); const checked = new Set();
    while (!s.over && s.y < 30 * GOAL) {
      s.safe = 1e9; s.light = 1; step(s, centre(s, s.y));
      // A pickup is buried if a boat sitting on it at the moment it comes level would touch a rock.
      for (const p of [...s.embers, ...s.powers]) if (!checked.has(p) && !p.pulled && p.y <= s.y) { checked.add(p); pickups++; if (s.rocks.some(k => Math.hypot(Math.max(0, Math.abs(k.x - p.x) - k.len), k.y - p.y) < k.rad + BOAT)) buried++; }
      for (const k of s.rocks) if (!seen.has(k)) { seen.add(k); const d = Math.min(9, Math.floor(k.y / GOAL * 10)); all[d]++; if (k.a || k.b || k.ice) swing[d]++; }
      const free = B => { // the widest gap a boat of radius B can sit in at this row
        const c = centre(s, s.y), e = half(s, s.y) - B, cuts = [];
        for (const k of s.rocks) { const dy = Math.abs(k.y - s.y), r = k.rad + B; if (dy < r) { const w = Math.sqrt(r * r - dy * dy) + k.len; cuts.push([k.x - w, k.x + w]); } }
        cuts.sort((a, b) => a[0] - b[0]);
        let x = c - e, gap = 0;
        for (const [a, b] of cuts) { gap = Math.max(gap, Math.min(a, c + e) - x); x = Math.max(x, b); }
        return Math.max(gap, c + e - x);
      };
      min = Math.min(min, free(BOAT)); worstBig = Math.min(worstBig, free(BOAT * 1.4));
    }
    worst = Math.min(worst, min); if (min < 0.03) tight++;
    }
  }
  console.log(`${label(stage)} narrowest gap ${worst.toFixed(3)} (big boat ${worstBig.toFixed(3)}) rides with a gap under 0.03: ${tight}; buried pickups ${buried}/${pickups};`, 'moving share by tenth', swing.map((n, i) => (all[i] ? Math.round(100 * n / all[i]) : 0)).join(' '));
}

// Parity: with no mode chosen, Lantern's rules are main's. A copy of sim.js from origin/main (git show) and this checkout's sim.js
// play the same seeds side by side, given the same steering every tick, and the whole state must match at every tick.
// Then Spark's abilities: owned abilities lie in Spark's river, and the river (its rocks and embers) must not change with them.
// --mutate nudges one boat by 1e-12 of a river width in one run; the check must catch it and fail.
if (SUB === 'parity') {
  const { execFileSync } = await import('node:child_process'), { writeFileSync, mkdtempSync } = await import('node:fs'), { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const here = new URL('.', import.meta.url).pathname;
  const file = join(mkdtempSync(join(tmpdir(), 'lantern-parity-')), 'sim-main.mjs');
  writeFileSync(file, execFileSync('git', ['show', 'origin/main:experiments/lantern/sim.js'], { cwd: here }));
  const main = await import(file), now = await import('./sim.js?v=15');
  const seeds = Number(process.argv.find((a, i) => i > 2 && /^\d+$/.test(a)) ?? 40), mutated = process.argv.includes('--mutate');
  const cases = [[1], [2], [3], [4], [5], [6], [12], [20], [30], [50], [0], [-101], [-151], [3, ['boost', 'slow', 'heart']], [8, ['size', 'magnet', 'flare', 'shield']], [5, undefined, { hearts: 2, calm: 3, pull: 2 }]];
  const build = (sim, seed, [stage, set, stats]) => stage <= -100 ? sim.create(seed, sim.towerStage(-stage - 100), 'tower', set, stats, -stage - 100) : sim.create(seed, stage || 1, !stage, set, stats);
  let ticks = 0, bad = 0;
  for (const c of cases) for (let seed = 1; seed <= seeds; seed++) {
    const a = build(now, seed, c), b = build(main, seed, c);
    for (let i = 0; !a.over && i < 30000; i++) {
      const target = i % 600 < 300 ? steer(a, true) : centre(a, a.y + 0.15); // the greedy bot, with stretches of drifting
      now.step(a, target); main.step(b, target); ticks++;
      if (mutated && seed === 1 && c === cases[0] && i === 300) a.x += 1e-12;
      if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; console.log(`     differs: stage ${c[0]} seed ${seed} tick ${i}`); break; }
    }
  }
  const ok1 = bad === 0;
  console.log(`${ok1 ? 'ok ' : 'FAIL'}  P1. this sim.js plays as origin/main's on ${cases.length} cases x ${seeds} seeds, ${ticks} ticks compared state by state: ${bad} differ`);
  const { start, tick } = await import('./modes/spark-sim.js');
  let same = 0, runs = 0;
  for (let n = 1; n <= 6; n++) for (let seed = 1; seed <= seeds; seed++) {
    const lay = powers => { // each rock and ember as it is laid down, run to dawn; a rock by its x and kind (ice drifts in y)
      const e = start(seed, n, powers), s = e.s, seen = new WeakSet(), out = []; s.hearts = 1e9;
      for (let i = 0; i < 90000 && !e.s.over; i++) { s.safe = 1e9; tick(e, centre(s, s.y), i % 180 === 0); for (const k of [...s.rocks, ...s.embers]) if (!seen.has(k) && k.kind !== 'heart' && k.kind !== 'shield') { seen.add(k); out.push({ y: k.y0 ?? k.y, key: k.x0 !== undefined ? `${k.kind},${k.x0}` : `${k.kind},${k.x},${k.y}` }); } }
      return { out, end: s.y };
    };
    const a = lay([]), b = lay(['boost', 'slow', 'heart']), upTo = Math.min(a.end, b.end) - 1.5; // slow water brings dawn sooner, so compare the river both runs passed
    const keys = r => r.out.filter(o => o.y < upTo).map(o => o.key).sort().join(';');
    runs++; if (keys(a) === keys(b)) same++;
  }
  const ok2 = same === runs;
  console.log(`${ok2 ? 'ok ' : 'FAIL'}  P2. Spark's river is the same with abilities on: ${same} of ${runs} rivers lay the same rocks and embers`);
  process.exit(ok1 && ok2 ? 0 : 1);
}
