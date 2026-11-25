// Pour: bots that prove the rules and measure difficulty.
//   node bots.mjs            all checks; exits 1 on a failure
//   node bots.mjs --mutate   the same checks with a broken rule (the glass has no floor); must exit 1
//   node bots.mjs --sweep    held-out checks: 64 planner seeds and 500 clumsy-thumb seeds per level, from seed 4201
//   node bots.mjs --planner-only --from=100 --count=21   all levels on held-out seeds; same 5/6 win-rate check
//   node bots.mjs --level=6 --from=1 --count=12   one level, with each result and the same win-rate check
// 2026-11-24: the flow now follows the thumb (sim.js), so careful() and the planner aim a pour rate instead of the old
// "tilt where the juice starts to run". The old clumsy bot and its "late levels at least 0.25 below early levels" check
// were replaced by the frozen thumb bot (thumb.mjs) and the owner's targets; NOTES.md says why.
import { create, step, band, LEVELS, digest, glassX, clone, POUR_FROM, POUR_FULL, MAX_TILT } from './sim.js';
import { thumb } from './thumb.mjs';

const MUTATE = process.argv.includes('--mutate');

// Where the stream meets the glass rim: the mean x of drops just above the glass, or a guess before any are there.
function landing(s) {
  let x = 0, n = 0;
  for (const q of s.p) if (q.air && q.y > s.glass.top - 10 && q.y < s.glass.top + 2) { x += q.x; n++; }
  return n ? x / n : s.liq.throw[0] > 6 ? 52 : 48;
}

// A policy sees the state and returns the tilt it asks for. careful() pours at a steady half rate (a faster one when the
// glass moves) while the glass will be under the stream when the drops arrive, waits just short of a pour while it is
// not, and lifts when what is in the glass, in the air and still to come from the jug reaches the line.
export function careful(rate = 0.55) {
  return s => {
    const g = s.glass, [lo] = band(s);
    const pourAt = POUR_FROM + (POUR_FULL - POUR_FROM) * (s.L.sway ? 0.85 : rate);
    const coming = s.inGlass + s.flying + s.flow * s.liq.lag + s.acc;
    if (coming >= s.L.target - 1) return 0;
    const under = Math.abs(glassX(s, s.t + s.liq.lag + 0.7) - landing(s)) < g.w * 0.75; // drops take about 0.7 s to fall
    const close = s.L.target - coming < 6 || s.inGlass >= lo - 2;
    return under ? (close ? POUR_FROM + (pourAt - POUR_FROM) * 0.6 : pourAt) : POUR_FROM - 0.1;
  };
}
// The planner: every 0.4 s it tries careful()'s tilt and four others on copies of the world (the rules are deterministic), holds each for
// 0.3 s, plays the copy on for 12 s with careful(), and keeps the tilt whose outcome is best. It shows each level can be won.
export function planner() {
  let plan = 0, next = 0;
  const score = c => c.won ? 1000 + c.stars * 10 - c.spilled : c.over ? -1000 - Math.abs(c.inGlass - c.L.target) - c.spilled : -Math.abs(c.L.target - c.inGlass - c.flying) * 3 - c.spilled * 2;
  const tilts = [0, POUR_FROM + 0.25, POUR_FROM + 0.6, POUR_FROM + 1.0], guide = careful();
  return s => {
    if (s.t < next) return plan;
    next = s.t + 0.4;
    let best = -Infinity;
    for (const tilt of [guide(s), ...tilts]) { // careful()'s own choice first, so it wins a tie
      const c = clone(s); c.events = [];
      for (let i = 0; i < 18 && !c.over; i++) step(c, tilt);
      const rest = careful(); // then play the rest of the level with the careful rule of thumb
      for (let i = 0; i < 60 * 12 && !c.over; i++) step(c, rest(c));
      const v = score(c);
      if (v > best) { best = v; plan = tilt; }
    }
    return plan;
  };
}

export function play(n, seed, policy, opts = {}) {
  const s = create(n, seed, { mutate: MUTATE, ...opts });
  for (let i = 0; i < 60 * 60 && !s.over; i++) step(s, policy(s));
  return s;
}

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fail++; };
const PSEEDS = 6;
const integerArg = (name, fallback) => {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  const value = arg ? Number(arg.slice(name.length + 3)) : fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
};
const sweep = process.argv.includes('--sweep');
const firstSeed = integerArg('from', Number(process.env.FROM || (sweep ? 4201 : 1)));
const plannerSeeds = integerArg('count', sweep ? 64 : PSEEDS);
const thumbSeeds = sweep ? integerArg('count', 500) : 200;

// The clumsy thumb's clear rate per level, against the owner's targets (2026-11-24): level 1 about 90% or more,
// levels 2 and 3 above 75%, a gentle slope, no level under 35%, and no level harder than the one after it.
// `slack` allows for sampling noise between neighbouring levels (one standard error at these rates is about 2 to 3 points).
function thumbRates(from, count) {
  const rates = [];
  for (let n = 1; n <= LEVELS; n++) {
    let wins = 0, stars = 0; const why = {};
    for (let seed = from; seed < from + count; seed++) {
      const s = play(n, seed, thumb(seed * 1000 + n));
      if (s.won) { wins++; stars += s.stars; }
      why[s.why] = (why[s.why] || 0) + 1;
    }
    rates.push(wins / count);
    console.log(`level ${n}: clumsy thumb ${wins}/${count} (${(wins / count * 100).toFixed(1)}%, stars ${(wins ? stars / wins : 0).toFixed(2)}), seeds ${from}-${from + count - 1}; ${JSON.stringify(why)}`);
  }
  return rates;
}
function thumbChecks(rates, slack) {
  const pct = x => (x * 100).toFixed(1) + '%';
  ok(rates[0] >= 0.88, `clumsy thumb clears level 1 at least 88% of the time (${pct(rates[0])})`);
  ok(rates[1] > 0.75 && rates[2] > 0.75, `clumsy thumb clears levels 2 and 3 above 75% (${pct(rates[1])}, ${pct(rates[2])})`);
  ok(Math.min(...rates) >= 0.35, `no level under 35% for the clumsy thumb (lowest ${pct(Math.min(...rates))})`);
  const rises = [];
  for (let i = 1; i < LEVELS; i++) if (rates[i] > rates[i - 1] + slack) rises.push(`${i}->${i + 1}`);
  ok(rises.length === 0, `no level is harder than the one after it, within ${pct(slack)} (${rises.join(', ') || 'none'})`);
  let cliff = 0; for (let i = 1; i < LEVELS; i++) cliff = Math.max(cliff, rates[i - 1] - rates[i]);
  ok(cliff <= 0.2, `a gentle slope: no step down of more than 20 points (largest ${pct(cliff)})`);
}

const only = process.argv.find(a => a.startsWith('--level='));
if (sweep || only || process.argv.includes('--planner-only')) {
  const levels = only ? [integerArg('level', 1)] : Array.from({ length: LEVELS }, (_, i) => i + 1);
  if (levels.some(n => n > LEVELS)) throw new Error(`--level must be at most ${LEVELS}`);
  for (const n of levels) {
    let wins = 0;
    for (let seed = firstSeed; seed < firstSeed + plannerSeeds; seed++) {
      const a = play(n, seed, planner());
      if (a.won) wins++;
      if (!sweep) console.log(n, seed, a.won, a.why, a.inGlass, a.spilled, a.t.toFixed(1));
    }
    const need = sweep ? 0.9 : 5 / 6;
    ok(wins / plannerSeeds >= need - 1e-9, `level ${n}: planner ${wins}/${plannerSeeds}, seeds ${firstSeed}-${firstSeed + plannerSeeds - 1}; minimum win rate ${sweep ? '0.9' : '5/6'}`);
  }
  if (sweep) thumbChecks(thumbRates(firstSeed, thumbSeeds), 0.03);
  process.exit(fail ? 1 : 0);
}

// 1. the planner finishes every level
const careRate = [];
for (let n = 1; n <= LEVELS; n++) {
  let c = 0, st = 0;
  for (let seed = 1; seed <= PSEEDS; seed++) { const a = play(n, seed, planner()); if (a.won) { c++; st += a.stars; } }
  careRate.push(c / PSEEDS);
  console.log(`level ${n}: planner ${c}/${PSEEDS} (stars ${(c ? st / c : 0).toFixed(2)})`);
}
ok(careRate.every(x => x >= 5 / 6 - 1e-9), `planner wins at least 5 of 6 on every level (lowest ${Math.min(...careRate).toFixed(2)})`);
// 2. the clumsy thumb: the difficulty curve
thumbChecks(thumbRates(1, thumbSeeds), 0.04);

// 3. determinism: same seed and inputs give the same result
{
  const a = play(4, 9, thumb(77)), b = play(4, 9, thumb(77));
  ok(digest(a) === digest(b), `same seed and inputs, same end state (${digest(a)})`);
  const c = play(4, 10, thumb(77));
  ok(digest(a) !== digest(c), 'a different seed gives a different run');
}
// 4. doing nothing never wins; tipping everything out never wins after level 1
{
  const idle = play(1, 1, () => 0);
  ok(!idle.won && idle.inJug === idle.L.drops, `doing nothing: the jug stays full and the level is not won (${idle.why})`);
  let dumpWins = 0; for (let n = 2; n <= LEVELS; n++) for (let seed = 1; seed <= 10; seed++) if (play(n, seed, () => MAX_TILT).won) dumpWins++;
  ok(dumpWins <= 3, `tipping the whole jug at once wins at most 3 of 70 runs on levels 2 to 8 (${dumpWins})`);
}
// 5. conservation: every drop is in the jug, a glass, the air or spilled
{
  for (const n of [3, 7]) {
    const s = create(n, 4, { mutate: MUTATE }); const pol = careful(); let bad = 0;
    for (let i = 0; i < 2400 && !s.over; i++) {
      step(s, pol(s));
      const inGlasses = s.glasses.reduce((a, g) => a + g.n, 0), others = inGlasses - s.inGlass;
      if (s.inJug + s.inGlass + others + s.flying + s.spilled !== s.L.drops) bad++;
    }
    ok(bad === 0, `level ${n}: every drop is counted in exactly one place on every step`);
  }
}
// 6. a near miss counts: a pour that ends anywhere in the band wins, and the stars rise as it gets closer
{
  const s = create(1, 1); const [lo, hi] = band(s); const L = s.L;
  const starsAt = n => { const c = clone(s); c.glasses[0].n = n; c.inGlass = n; return n >= lo && n <= hi ? (Math.abs(n - L.target) <= Math.ceil(L.band * 0.25) ? 3 : Math.abs(n - L.target) <= Math.ceil(L.band * 0.6) ? 2 : 1) : 0; };
  ok(starsAt(L.target) === 3 && starsAt(lo) === 1 && starsAt(hi) === 1, `level 1 band ${lo} to ${hi}: the line gives 3 stars, the band's edges give 1`);
}

console.log(MUTATE ? `mutation run: ${fail} check(s) failed (expected some)` : `${fail} failed`);
process.exit(fail ? 1 : 0);
