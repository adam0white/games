// Pour: bots that prove the rules and measure difficulty.
//   node bots.mjs            all checks; exits 1 on a failure
//   node bots.mjs --mutate   the same checks with a broken rule (the glass has no floor); must exit 1
//   node bots.mjs --sweep    held-out checks, 64 planner and 256 careless seeds per level
//   node bots.mjs --planner-only --from=100 --count=21   all levels on held-out seeds; same 5/6 win-rate check
//   node bots.mjs --level=6 --from=1 --count=12   one level, with each result and the same win-rate check
import { create, step, band, LEVELS, digest, rng, glassX, clone } from './sim.js';

const MUTATE = process.argv.includes('--mutate');
const AIM = 55; // where a gentle pour lands at glass height: about 4 units right of the spout plus 7 to 14, measured with the jug at x 40

// A policy sees the state (maybe late) and returns the tilt it asks for.
export function careful() {
  return s => {
    const g = s.glass, ahead = glassX(s, s.t + 0.7); // where the glass will be when the drops arrive
    const coming = s.inGlass + s.flying;
    if (coming >= s.L.target - 1) return 0;
    const need = 1.28 + (1 - s.inJug / s.L.drops) * 0.85; // the tilt where this much juice starts to run
    const under = Math.abs(ahead - AIM) < g.w * 0.45 && Math.abs(glassX(s, s.t + 1.1) - AIM) < g.w * 0.6;
    const close = s.L.target - coming < 6;
    return under ? need + (close ? 0.05 : 0.15) : need - 0.15;
  };
}
// The planner: every 0.3 s it tries four tilts on copies of the world (the rules are deterministic), holds each for
// 0.3 s, plays the copy to the end with careful(), and keeps the tilt whose outcome is best. It shows each level can be won.
export function planner() {
  let plan = 0, next = 0;
  const score = c => c.won ? 1000 + c.stars * 10 - c.spilled : c.over ? -1000 - Math.abs(c.inGlass - c.L.target) - c.spilled : -Math.abs(c.L.target - c.inGlass - c.flying) * 3 - c.spilled * 2;
  return s => {
    if (s.t < next) return plan;
    next = s.t + 0.3;
    const need = 1.28 + (1 - s.inJug / s.L.drops) * 0.85;
    let best = -Infinity;
    for (const tilt of [0, need - 0.12, need + 0.04, need + 0.16]) {
      const c = clone(s); c.events = [];
      for (let i = 0; i < 18 && !c.over; i++) step(c, tilt);
      const rest = careful(); // then play the rest of the level with the careful rule of thumb
      for (let i = 0; i < 480 && !c.over; i++) step(c, rest(c));
      const v = score(c);
      if (v > best) { best = v; plan = tilt; }
    }
    return plan;
  };
}

export function clumsy(seed) {
  const r = rng(seed * 31 + 5), lag = 14 + Math.floor(r() * 12), stopAt = r() * 2 - 1, wild = 0.35;
  const seen = [];
  let tilt = 0;
  return s => {
    seen.push({ x: s.glass.x, w: s.glass.w, n: s.inGlass + s.flying, target: s.L.target, band: s.L.band });
    const v = seen[Math.max(0, seen.length - 1 - lag)]; // reacts about a quarter to half a second late
    const under = Math.abs(v.x - AIM) < v.w * 0.8;
    const enough = v.n >= v.target + stopAt * v.band;
    const want = enough ? 0 : under ? 1.5 : 1.0;
    tilt += (want - tilt) * 0.2 + (r() - 0.5) * wild;
    return tilt;
  };
}

// Adjust tilt as the jug empties, but aim at the glass now instead of where the drops will land.
export function sloppyAim() {
  return s => {
    if (s.inGlass + s.flying >= s.L.target - 1) return 0;
    const need = 1.28 + (1 - s.inJug / s.L.drops) * 0.85;
    return Math.abs(s.glass.x - AIM) < s.glass.w * 0.6 ? need + 0.15 : need - 0.15;
  };
}

export function play(n, seed, policy, opts = {}) {
  const s = create(n, seed, { mutate: MUTATE, ...opts });
  for (let i = 0; i < 60 * 40 && !s.over; i++) step(s, policy(s));
  return s;
}

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fail++; };
const SEEDS = 16, PSEEDS = 6;
const integerArg = (name, fallback) => {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  const value = arg ? Number(arg.slice(name.length + 3)) : fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
};
const sweep = process.argv.includes('--sweep');
const firstSeed = integerArg('from', Number(process.env.FROM || (sweep ? 4201 : 1)));
const plannerSeeds = integerArg('count', sweep ? 64 : PSEEDS);
const carelessSeeds = sweep ? integerArg('count', 256) : SEEDS;

// 1. careful bot finishes every level; 2. clumsy bot finishes level 1 often and less as levels rise
const careRate = [], clumRate = [], stars = [];
const only = process.argv.find(a => a.startsWith('--level='));
if (sweep || only || process.argv.includes('--planner-only')) {
  const levels = only ? [integerArg('level', 1)] : Array.from({ length: LEVELS }, (_, i) => i + 1);
  if (levels.some(n => n > LEVELS)) throw new Error(`--level must be at most ${LEVELS}`);
  for (const n of levels) {
    if (sweep) {
      const policies = [
        ['planner', planner, plannerSeeds],
        ['clumsy', seed => clumsy(seed * 100 + n), carelessSeeds],
        ['sloppy aim', sloppyAim, carelessSeeds],
      ];
      for (const [name, makePolicy, count] of policies) {
        let wins = 0, deadlines = 0;
        const losses = { spill: 0, over: 0, under: 0 };
        for (let seed = firstSeed; seed < firstSeed + count; seed++) {
          const s = play(n, seed, makePolicy(seed));
          if (s.won) wins++;
          else {
            losses[s.why]++;
            if (s.t > s.L.time) deadlines++;
          }
        }
        const result = `level ${n}: ${name} ${wins}/${count}, seeds ${firstSeed}–${firstSeed + count - 1}; losses ${JSON.stringify(losses)}, ${deadlines} at deadline`;
        if (name === 'planner') ok(wins / count >= 0.9, result);
        else if (n >= 5) ok(wins / count < 0.5, result);
        else console.log(result);
      }
      continue;
    }
    let wins = 0;
    for (let seed = firstSeed; seed < firstSeed + plannerSeeds; seed++) {
      const a = play(n, seed, planner());
      if (a.won) wins++;
      console.log(n, seed, a.won, a.why, a.inGlass, a.spilled, a.t.toFixed(1));
    }
    ok(wins / plannerSeeds >= 5 / 6 - 1e-9, `level ${n}: planner ${wins}/${plannerSeeds}, seeds ${firstSeed}-${firstSeed + plannerSeeds - 1}; minimum win rate 5/6`);
  }
  process.exit(fail ? 1 : 0);
}
if (process.argv.includes('--why')) {
  for (let n = 1; n <= LEVELS; n++) {
    const tally = (pol) => { const t = {}; for (let seed = 1; seed <= SEEDS; seed++) { const s = play(n, seed, pol(seed)); const k = s.why + (s.won ? '' : `(${s.inGlass}/${s.spilled})`); t[s.why] = (t[s.why] || 0) + 1; if (seed <= 4) t['e' + seed] = `${s.inGlass}g ${s.spilled}s ${s.inJug}j ${s.t.toFixed(1)}t`; } return JSON.stringify(t); };
    console.log(n, 'careful', tally(() => careful()), '\n  clumsy', tally(seed => clumsy(seed * 100 + n)));
  }
  process.exit(0);
}
for (let n = 1; n <= LEVELS; n++) {
  let c = 0, k = 0, st = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const a = seed <= PSEEDS ? play(n, seed, planner()) : null; if (a?.won) { c++; st += a.stars; }
    const b = play(n, seed, clumsy(seed * 100 + n)); if (b.won) k++;
  }
  careRate.push(c / PSEEDS); clumRate.push(k / SEEDS); stars.push(c ? st / c : 0);
  console.log(`level ${n}: planner ${c}/${PSEEDS} (stars ${(c ? st / c : 0).toFixed(2)}), clumsy ${k}/${SEEDS}`);
}
ok(careRate.every(x => x >= 5 / 6 - 1e-9), `planner wins at least 5 of 6 on every level (lowest ${Math.min(...careRate).toFixed(2)})`);
ok(clumRate[0] >= 0.5, `clumsy bot finishes level 1 at least half the time (${clumRate[0].toFixed(2)})`);
const firstHalf = (clumRate[0] + clumRate[1] + clumRate[2]) / 3, lastHalf = (clumRate[5] + clumRate[6] + clumRate[7]) / 3;
ok(lastHalf < firstHalf - 0.25, `clumsy success falls with level (levels 1-3 ${firstHalf.toFixed(2)}, levels 6-8 ${lastHalf.toFixed(2)})`);
let drops = 0; for (let i = 1; i < LEVELS; i++) if (clumRate[i] > clumRate[i - 1] + 0.2) drops++;
ok(drops <= 1, `clumsy success never rises by more than 0.2 (3 of 16 runs) between levels, at most once (${drops})`);

// 3. determinism: same seed and inputs give the same result
{
  const a = play(4, 9, clumsy(77)), b = play(4, 9, clumsy(77));
  ok(digest(a) === digest(b), `same seed and inputs, same end state (${digest(a)})`);
  const c = play(4, 10, clumsy(77));
  ok(digest(a) !== digest(c), 'a different seed gives a different run');
}
// 4. doing nothing never wins; tipping everything out never wins after level 1
{
  const idle = play(1, 1, () => 0);
  ok(!idle.won && idle.inJug === idle.L.drops, `doing nothing: the jug stays full and the level is not won (${idle.why})`);
  let dumpWins = 0; for (let n = 2; n <= LEVELS; n++) for (let seed = 1; seed <= 10; seed++) if (play(n, seed, () => 2.4).won) dumpWins++;
  ok(dumpWins <= 3, `tipping the whole jug at once wins at most 3 of 70 runs on levels 2 to 8 (${dumpWins})`);
}
// 5. conservation: every drop is in the jug, the glass, the air or spilled
{
  const s = create(3, 4, { mutate: MUTATE }); const pol = careful(); let bad = 0;
  for (let i = 0; i < 1200 && !s.over; i++) { step(s, pol(s)); if (s.inJug + s.inGlass + s.flying + s.spilled !== s.L.drops) bad++; }
  ok(bad === 0, 'every drop is counted in exactly one place on every step');
}

console.log(MUTATE ? `mutation run: ${fail} check(s) failed (expected some)` : `${fail} failed`);
process.exit(fail ? 1 : 0);
