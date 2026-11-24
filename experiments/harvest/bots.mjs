// Proves the rules of Harvest Morning and measures difficulty: node bots.mjs  (exits non-zero on any failure)
//   node bots.mjs --mutate   breaks one rule on purpose (wages are never taken from the cart); the checks must then fail.
// 1. Rules, one at a time: cutting, carrying, the carry limit, the old woman's double load, crows and scaring, the stone and
//    the whetstone, wind, the hare's nest bonus, the rival who refuses, pay for time worked, rain soaking what is left.
// 2. Determinism: the same seed and the same inputs give the same morning, tick for tick.
// 3. The clumsy bot uses a simple, affordable roster; its success falls gradually. Solo results stay visible.
// 4. The careful bot with the best hiring choice finishes every level; the same bot hiring nobody finishes the early levels
//    and not the late ones.
// 5. Hiring is a real decision: on the late levels the best choice of neighbours beats hiring everyone and hiring nobody.
import * as sim from './sim.js';
import { careful, clumsy, play } from './brain.js';

const MUTATE = process.argv.includes('--mutate');
if (MUTATE) { sim.mutate('free-help'); console.log('MUTATION: wages are never taken from the cart'); }
const t0 = Date.now();
let failures = 0;
const check = (ok, text) => { if (!ok) { failures++; console.log('FAIL ' + text); } return ok; };
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const run = (s, n, inp = null) => { for (let i = 0; i < n && !s.over; i++) sim.step(s, inp); };
const ticks = sec => Math.round(sec / sim.DT);
const { STAND, LYING, GONE } = sim;

// ---------------------------------------------------------------- 1. rules
{
  // Walking through standing wheat cuts it; standing on sheaves bundles them up to the carry limit; the cart takes them.
  const s = sim.create({ level: 0, seed: 1 });
  const row = 0, target = { x: 4.5, y: row + 0.5 };
  s.me.x = 0.5; s.me.y = 0.5;
  run(s, ticks(3), target);
  const cutRow = [...Array(s.cols).keys()].map(x => s.st[row * s.cols + x]);
  check(cutRow.every(v => v !== STAND), `walking along a row cuts it (row states ${cutRow})`);
  check(s.me.carryN === sim.CARRY, `bundles up to the carry limit of ${sim.CARRY} (carries ${s.me.carryN})`);
  check(s.st.filter(v => v === LYING).length >= 1, 'sheaves beyond the limit stay lying');
  const before = s.cart.grain;
  run(s, ticks(6), { x: s.cart.x, y: s.cart.y });
  check(s.cart.grain - before >= sim.CARRY && s.me.carryN === 0, `the cart takes the load (${s.cart.grain})`);
}
{
  // The old woman: you carry double while she works.
  const s = sim.create({ level: 6, seed: 1 });
  check(sim.limit(s) === sim.CARRY, 'carry limit alone');
  check(sim.hire(s, 'old') === 'hired' && sim.limit(s) === 2 * sim.CARRY, 'the old woman doubles the load');
}
{
  // Crows land and eat; the player walking close scares them off.
  const s = sim.create({ level: 1, seed: 4 });
  s.me.x = s.cart.x; s.me.y = s.cart.y;
  run(s, ticks(16));
  const c = s.crows.find(c => c.eating);
  check(!!c, 'a crow lands and eats');
  const i = c?.target ?? 0, g0 = s.grain[i];
  run(s, ticks(1));
  check(s.grain[i] < g0, 'a crow eats the grain it sits on');
  run(s, ticks(3), { x: c.x, y: c.y });
  check(c.flee && s.stats.scared >= 1, 'walking at a crow scares it off');
}
{
  // The hidden stone blunts the scythe; cutting is slow until the whetstone; the whetstone takes a second.
  const s = sim.create({ level: 3, seed: 2 });
  const stone = s.stones[0], p = sim.center(s, stone);
  check(s.stones.length === 1, 'level 4 hides one stone');
  s.me.x = p.x; s.me.y = p.y;
  run(s, ticks(1));
  check(s.me.blunt && s.found.includes(stone), 'cutting the stone blunts the scythe');
  // a fresh patch: how long one cell takes, blunt and sharp
  const timeToCut = (blunt) => { const t = sim.create({ level: 3, seed: 2 }); t.stones.length = 0; t.me.blunt = blunt; const q = sim.center(t, t.cols * 4 + 4); t.me.x = q.x; t.me.y = q.y; let n = 0; while (t.st[t.cols * 4 + 4] === STAND && n < 600) { sim.step(t, null); n++; } return n * sim.DT; };
  const sharp = timeToCut(false), blunt = timeToCut(true);
  check(blunt > 2.5 * sharp, `a blunt scythe cuts slower (${blunt.toFixed(2)} s against ${sharp.toFixed(2)} s a cell)`);
  check(sim.whet(s) && s.me.whet > 0, 'the whetstone starts');
  const x0 = s.me.x; run(s, ticks(0.5), { x: 0, y: 0 });
  check(s.me.x === x0, 'the farmer stands still while sharpening');
  run(s, ticks(0.6));
  check(!s.me.blunt, 'sharp again after a second');
}
{
  // Wind flattens a patch, and flattened wheat is slower to cut.
  const s = sim.create({ level: 5, seed: 3 });
  s.me.x = s.cart.x; s.me.y = s.cart.y;
  run(s, ticks(31));
  const flat = s.flat.reduce((a, b) => a + b, 0);
  check(flat >= 5, `a gust flattens a patch (${flat} cells)`);
  check(sim.FLAT < 0.5, 'flattened wheat cuts at less than half speed');
}
{
  // The hare's nest: left standing it pays a bonus; cut into, the hare runs and the bonus is gone.
  const left = play(sim, { level: 7, seed: 5, brain: careful(), hires: ['strong'] });
  check(left.result.bonus === sim.NEST_BONUS && left.nestAlive, `the nest left standing pays ${sim.NEST_BONUS} (got ${left.result.bonus})`);
  const s = sim.create({ level: 7, seed: 5 }), p = sim.center(s, s.nest[0]);
  s.me.x = p.x; s.me.y = p.y; run(s, ticks(1));
  check(!s.nestAlive, 'cutting into the nest loses the hare');
}
{
  // The rival: the fast one will not work once the strong one has been hired. Sending someone home ends their work.
  const s = sim.create({ level: 8, seed: 1 });
  check(sim.hire(s, 'strong') === 'hired', 'hire the strong one');
  check(sim.hire(s, 'fast') === 'refused', 'the fast one refuses beside his rival');
  const t = sim.create({ level: 8, seed: 1 });
  check(sim.hire(t, 'fast') === 'hired' && sim.hire(t, 'strong') === 'hired', 'the strong one does not mind');
  // Pay for time worked: half a morning costs half the price.
  const u = sim.create({ level: 8, seed: 1 });
  sim.hire(u, 'child');
  run(u, ticks(u.L.time / 2));
  check(sim.hire(u, 'child') === 'home', 'tap again: sent home');
  sim.stop(u);
  const want = Math.ceil(sim.HELP.child.price / 2);
  check(u.result.each.child === want && u.result.pay === want, `half a morning costs half (${u.result.each.child} of ${sim.HELP.child.price})`);
  check(u.result.kept === Math.max(0, u.result.cart - want), 'pay comes out of the cart');
  check(sim.hire(u, 'child') === 'no', 'no hiring after the end');
}
{
  // The rain: standing and lying wheat is lost; only the cart counts. A morning left alone ends with the storm.
  const s = sim.create({ level: 0, seed: 1 });
  run(s, ticks(s.L.time + sim.SWEEP + 1));
  check(s.over && s.why === 'rain' && s.st.every(v => v === 0 || v === GONE), 'the rain soaks everything left standing');
  check(s.result.kept === 0 && !s.result.passed, 'nothing in the cart: nothing kept');
}

// The fast neighbour must put grain in the cart while the player stays still.
{
  const s = sim.create({ level: 6, seed: 7 });
  sim.hire(s, 'fast');
  let maxLoad = 0;
  for (let n = 0; n < ticks(25); n++) { sim.step(s); maxLoad = Math.max(maxLoad, s.helpers.fast.carryN); }
  check(s.cart.grain >= 6, `the fast neighbour cuts, bundles and delivers without the player (${s.cart.grain.toFixed(1)})`);
  check(maxLoad === sim.HELP.fast.carry, `the fast neighbour carries at most ${sim.HELP.fast.carry} sheaves (${maxLoad})`);
  check(s.ev.some(e => e.type === 'drop' && e.who === 'fast'), 'fast deliveries use the ordinary cart ledger');
}

// ---------------------------------------------------------------- 2. determinism
{
  const trace = (seed, brainFn, hires) => { const d = []; const s = play(sim, { level: 9, seed, brain: brainFn(), hires, onTick: (s) => { if (Math.round(s.t / sim.DT) % 30 === 0) d.push(sim.digest(s)); } }); return { d: d.join(','), r: JSON.stringify(s.result) }; };
  const a = trace(7, careful, ['strong', 'child']), b = trace(7, careful, ['strong', 'child']), c = trace(8, careful, ['strong', 'child']);
  check(a.d === b.d && a.r === b.r, 'same seed and inputs: the same morning');
  check(a.d !== c.d, 'another seed: another morning');
  const d1 = trace(3, () => clumsy(3), []), d2 = trace(3, () => clumsy(3), []);
  check(d1.d === d2.d, 'the clumsy bot is reproducible too');
  const g = sim.dailyLevel(20261123), h = sim.dailyLevel(20261123);
  check(JSON.stringify(g) === JSON.stringify(h) && JSON.stringify(g) !== JSON.stringify(sim.dailyLevel(20261124)), "today's field is the same for everyone and changes daily");
}

// ---------------------------------------------------------------- 3 to 5. bots over many seeds
const SEEDS = Array.from({ length: 12 }, (_, i) => 100 + i);
const CLUMSY_SEEDS = Array.from({ length: 30 }, (_, i) => 500 + i);
const subsets = help => { const out = []; for (let m = 0; m < 1 << help.length; m++) out.push(help.filter((_, i) => (m >> i) & 1).sort((a, b) => (a === 'fast' ? -1 : b === 'fast' ? 1 : 0))); return out; };
const name = h => h.join('+') || 'nobody';
const rows = [];
for (let lv = 0; lv < sim.LEVELS.length; lv++) {
  const L = sim.LEVELS[lv];
  const pol = subsets(L.help).map(h => {
    const rs = SEEDS.map(seed => play(sim, { level: lv, seed, brain: careful(), hires: h }).result);
    return { h, mean: avg(rs.map(r => r.kept)), pass: rs.filter(r => r.passed).length / rs.length, secs: avg(rs.map(r => r.t)) };
  }).sort((a, b) => b.mean - a.mean);
  const best = pol[0], none = pol.find(p => !p.h.length), all = pol.find(p => p.h.length === L.help.length);
  const cl = CLUMSY_SEEDS.map(seed => play(sim, { level: lv, seed, brain: clumsy(seed) }).result);
  const clumsyHires = lv >= 6 ? ['fast'] : lv === 2 ? ['strong'] : (lv === 4 || lv === 5) ? ['child'] : []; // fixed before measuring; both brains remain unchanged
  const clh = CLUMSY_SEEDS.map(seed => play(sim, { level: lv, seed, brain: clumsy(seed), hires: clumsyHires, hireAt: 4 }).result);
  rows.push({ lv: lv + 1, need: L.stars[0], best, none, all, clumsyHires, clumsyHired: { pass: clh.filter(r => r.passed).length / clh.length, ratio: avg(clh.map(r => r.kept)) / L.stars[0] }, clumsyPass: cl.filter(r => r.passed).length / cl.length, clumsyRatio: avg(cl.map(r => r.kept)) / L.stars[0], clumsySecs: avg(cl.map(r => r.t)) });
}
const pct = v => `${Math.round(v * 100)}%`.padStart(4);
console.log('level need | careful, best hires        kept pass  secs | careful, nobody kept pass | hire everyone kept | clumsy pass kept/need | clumsy + simple hires pass kept/need');
for (const r of rows) console.log(`${String(r.lv).padStart(5)} ${String(r.need).padStart(4)} | ${name(r.best.h).padEnd(24)} ${r.best.mean.toFixed(1).padStart(5)} ${pct(r.best.pass)} ${r.best.secs.toFixed(0).padStart(5)} | ${r.none.mean.toFixed(1).padStart(19)} ${pct(r.none.pass)} | ${r.all.mean.toFixed(1).padStart(18)} | ${pct(r.clumsyPass).padStart(11)} ${r.clumsyRatio.toFixed(2).padStart(9)} | ${pct(r.clumsyHired.pass).padStart(23)} ${r.clumsyHired.ratio.toFixed(2).padStart(9)}`);

// 3. Progression uses the simple roster above, hired at 4 s. Solo results are reported above.
// The late solo gate below still requires hires for the careful bot to earn its first star.
const progression = rows.map(r => r.clumsyHired.pass);
check(progression[0] >= 0.9, `the clumsy bot finishes level 1 (${pct(progression[0])})`);
const third = k => avg(progression.slice(k * 4, k * 4 + 4));
check(third(0) > third(1) && third(1) > third(2) && third(0) - third(2) > 0.5, `clumsy success with hires falls: levels 1-4 ${pct(third(0))}, 5-8 ${pct(third(1))}, 9-12 ${pct(third(2))}`);
for (let i = 0; i < progression.length; i++) {
  check(progression[i] > 0, `level ${i + 1}: clumsy progression stays above zero (${pct(progression[i])})`);
  if (i) {
    check(progression[i - 1] - progression[i] <= 0.25 + 1e-9, `level ${i + 1}: clumsy success drops by at most 25 percentage points`);
    check(progression[i] - progression[i - 1] <= 0.1 + 1e-9, `level ${i + 1}: clumsy success rises by at most 10 percentage points`);
    check(rows[i].need - rows[i - 1].need <= 15, `level ${i + 1}: quota rises by at most 15 grain`);
  }
}
check(progression.at(-1) >= 0.1 && progression.at(-1) <= 0.25, `clumsy progression ends at 10–25% (${pct(progression.at(-1))})`);
// 4. careful
for (const r of rows) check(r.best.pass >= 0.9, `level ${r.lv}: the careful bot with ${name(r.best.h)} finishes (${pct(r.best.pass)})`);
for (const r of rows.slice(0, 6)) check(r.none.pass >= 0.9, `level ${r.lv}: the careful bot alone finishes an early level (${pct(r.none.pass)})`);
for (const r of rows.slice(6)) check(r.none.pass <= 0.2, `level ${r.lv}: the careful bot alone does not finish a late level (${pct(r.none.pass)})`);
// 5. hiring is a decision
for (const r of rows.slice(6)) {
  check(r.best.h.length > 0 && r.best.h.length < r.all.h.length, `level ${r.lv}: the best choice (${name(r.best.h)}) is neither nobody nor everyone`);
  check(r.best.mean >= r.all.mean + 4, `level ${r.lv}: the best choice beats hiring everyone (${r.best.mean.toFixed(1)} against ${r.all.mean.toFixed(1)})`);
  check(r.best.mean >= r.none.mean + 4, `level ${r.lv}: the best choice beats hiring nobody (${r.best.mean.toFixed(1)} against ${r.none.mean.toFixed(1)})`);
}
// The fast neighbour must be an economic winner, not merely present in a failing set.
for (const [lv, id] of [[3, 'strong'], [5, 'child'], [7, 'fast']]) check(rows[lv - 1].best.h.includes(id), `level ${lv}: the new neighbour (${id}) is in the best choice (${name(rows[lv - 1].best.h)})`);
const fastWins = rows.filter(r => r.best.h.includes('fast'));
check(fastWins.length >= 2, `the fast neighbour is in the best choice on at least two fields (${fastWins.map(r => r.lv).join(', ')})`);
const picks = new Set(rows.slice(6).map(r => name(r.best.h)));
check(picks.size >= 2, `the best choice differs between late levels (${[...picks].join(', ')})`);
// run length
const secs = rows.map(r => r.best.secs), cs = rows.map(r => r.clumsySecs);
console.log(`morning length, careful bot: ${Math.min(...secs).toFixed(0)} to ${Math.max(...secs).toFixed(0)} s; clumsy bot: ${Math.min(...cs).toFixed(0)} to ${Math.max(...cs).toFixed(0)} s`);
check(Math.max(...secs, ...cs) <= 240, 'no morning is longer than 4 minutes');
// today's field: the careful bot with its best choice can do well
{
  const seed = sim.dateSeed('2026-11-23'), L = sim.dailyLevel(seed); // the field the page plays on that date
  const pol = subsets(L.help).map(h => ({ h, k: avg([1, 2, 3].map(n => play(sim, { L, seed, brain: careful(), hires: h }).result.kept)) })).sort((a, b) => b.k - a.k);
  console.log(`today's field (2026-11-23, ${L.shape}, ${L.rows} rows): best ${name(pol[0].h)} keeps ${pol[0].k.toFixed(0)}, nobody ${pol.find(p => !p.h.length).k.toFixed(0)}`);
}

console.log(`${failures ? 'FAILED' : 'ok'}: ${failures} failure(s) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failures ? 1 : 0);
