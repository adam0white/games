// node bots.mjs            proves the rules and measures difficulty; exits non-zero on failure
// node bots.mjs --mutate   breaks one rule (the player's ripples and pebbles no longer bend the current); must exit non-zero
import { create, step, play, advise, rng, items, stars, score, chunk, LEVELS, DT, CH } from './sim.js';
const mutate = process.argv.includes('--mutate'), quick = process.argv.includes('--quick');
const mut = mutate ? 'touch' : null;
let failures = 0;
const check = (ok, text) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failures++; };
if (mutate) console.log('Mutation: flow() ignores ripples and pebbles. The policies are unchanged.');

// The clumsy player: looks only a short way ahead, reacts late, aims badly, sometimes pushes the wrong way,
// and fidgets when nothing is near. It never goes for passengers.
function clumsy(seed) {
  const r = rng(seed);
  return (s) => {
    const b = s.b;
    let h = null;
    for (const it of items(s, b.y, b.y + 1)) {
      if (it.k !== 'drain' && it.k !== 'leaf' && it.k !== 'paw') continue;
      const dy = it.y - b.y;
      if (dy < 0.05 || dy > 0.75 || Math.abs(it.x - b.x) > 0.24) continue;
      if (!h || it.y < h.y) h = it;
    }
    if (h) {
      let dir = b.x >= h.x ? 1 : -1;
      if (r() < 0.22) dir = -dir;
      return { k: 'ripple', x: b.x - dir * 0.1 + (r() - 0.5) * 0.24, y: b.y + (r() - 0.5) * 0.24, dx: dir, dy: (r() - 0.5) * 0.8, a: 0.4 + 0.6 * r() };
    }
    if (r() < 0.12) return { k: 'ripple', x: b.x + (r() - 0.5) * 0.3, y: b.y, dx: r() < 0.5 ? -1 : 1, dy: 0, a: 0.5 };
    return null;
  };
}
const runClumsy = (level, seed) => play(create({ level, seed, mut }), clumsy(seed * 31 + level), { every: 30, rest: 55 });

// 1. A boat left alone: street 1 is safe, street 2 is not. The rules, not a policy.
{
  const a = play(create({ level: 1, seed: 3 }), () => null);
  check(a.over === 'win' && a.riders.length === 0, `street 1 untouched: reaches the pond with no passengers (${(a.tick * DT).toFixed(1)}s, soak ${(a.soak * 100).toFixed(0)}%)`);
  const b = play(create({ level: 2, seed: 3 }), () => null);
  check(b.over === 'drain', `street 2 untouched: lost down the drain (${b.over})`);
  const c = play(create({ daily: true, seed: 20261124 }), () => null);
  check(c.over && c.over !== 'win', `daily stream untouched: the run ends (${c.over} at ${score(c)} points)`);
}
// 2. One ripple moves the boat the way it points.
{
  const base = create({ level: 1, seed: 5 }), pushed = create({ level: 1, seed: 5, mut });
  step(pushed, [{ k: 'ripple', x: 0.4, y: 0.33, dx: 1, dy: 0, a: 1 }]);
  step(base);
  for (let i = 0; i < 90; i++) { step(base); step(pushed); }
  check(pushed.b.x - base.b.x > 0.15, `one full ripple moves the boat ${(pushed.b.x - base.b.x).toFixed(3)} widths sideways in 1.5 s (needs > 0.15)`);
  const stone = create({ level: 1, seed: 5, mut });
  step(stone, [{ k: 'pebble', x: 0.42, y: 0.5 }]);
  for (let i = 0; i < 90; i++) step(stone);
  check(stone.b.x - base.b.x > 0.05, `a pebble ahead-left turns the boat ${(stone.b.x - base.b.x).toFixed(3)} widths right (needs > 0.05)`);
}
// 3. Determinism.
{
  const one = play(create({ level: 6, seed: 11, mut }), clumsy(77), { every: 30, rest: 55 });
  const two = play(create({ level: 6, seed: 11, mut }), clumsy(77), { every: 30, rest: 55 });
  check(JSON.stringify(one) === JSON.stringify(two), 'same seed and inputs give the same state, byte for byte');
  const three = play(create({ level: 6, seed: 12, mut }), clumsy(77), { every: 30, rest: 55 });
  check(JSON.stringify(one) !== JSON.stringify(three), 'another seed gives another run');
  check(JSON.stringify(chunk(20261124, 9)) === JSON.stringify(chunk(20261124, 9)) && JSON.stringify(chunk(20261124, 9)) !== JSON.stringify(chunk(20261125, 9)), 'the daily stream is fixed by its date and differs between dates');
}
// 4. The careful bot finishes every street with every passenger.
{
  const seeds = quick ? [1] : [1, 2, 3];
  let wins = 0, total = 0, three = 0;
  for (const l of LEVELS) {
    const row = [];
    for (const seed of seeds) {
      const s = play(create({ level: l.n, seed, mut }), (q) => advise(q));
      total++; if (s.over === 'win') wins++; if (stars(s) === 3) three++;
      row.push(`${s.over} ${stars(s)}★ ${s.riders.length}/${l.bugs} ${(s.tick * DT).toFixed(0)}s soak ${(s.soak * 100).toFixed(0)}% ${s.acts} moves`);
    }
    console.log(`     careful street ${l.n} (${l.name}): ${row.join(' | ')}`);
  }
  check(wins === total, `careful bot finishes all 10 streets on every seed: ${wins}/${total}`);
  check(three >= total * 0.8, `careful bot gets 3 stars on at least 80%: ${three}/${total}`);
}
// 5. The clumsy bot: finishes street 1, and does worse street by street.
{
  const N = quick ? 40 : 200, rates = [];
  for (const l of LEVELS) {
    let w = 0;
    for (let seed = 1; seed <= N; seed++) if (runClumsy(l.n, seed).over === 'win') w++;
    rates.push(w / N);
  }
  console.log(`     clumsy success by street (${N} runs each): ${rates.map((r) => (r * 100).toFixed(0) + '%').join(' ')}`);
  check(rates[0] >= 0.95, `clumsy bot finishes street 1: ${(rates[0] * 100).toFixed(0)}%`);
  const early = (rates[0] + rates[1] + rates[2]) / 3, mid = (rates[3] + rates[4] + rates[5] + rates[6]) / 4, late = (rates[7] + rates[8] + rates[9]) / 3;
  check(early > mid && mid > late, `clumsy success falls: streets 1-3 ${(early * 100).toFixed(0)}%, 4-7 ${(mid * 100).toFixed(0)}%, 8-10 ${(late * 100).toFixed(0)}%`);
  check(rates[9] < 0.35 && rates[9] < rates[0] - 0.5, `street 10 is hard for the clumsy bot: ${(rates[9] * 100).toFixed(0)}%`);
}
// 6. The daily stream: the careful bot lasts far longer than the clumsy one, and both runs end.
{
  const seeds = quick ? [20261124] : [20261124, 20261125, 20261126];
  const care = [], clum = [];
  for (const seed of seeds) {
    const a = play(create({ daily: true, seed, mut }), (q) => advise(q), { limit: 60 * 900 });
    care.push(score(a));
    console.log(`     daily ${seed} careful: ${score(a)} points, ${a.riders.length} passengers, ${(a.tick * DT).toFixed(0)}s, ended by ${a.over || 'time limit'}`);
    let sum = 0;
    for (let k = 1; k <= 20; k++) sum += score(play(create({ daily: true, seed, mut }), clumsy(k), { every: 30, rest: 55 }));
    clum.push(sum / 20);
  }
  const mc = care.reduce((a, b) => a + b) / care.length, ml = clum.reduce((a, b) => a + b) / clum.length;
  console.log(`     daily mean score: careful ${mc.toFixed(0)}, clumsy ${ml.toFixed(0)}`);
  check(mc > ml * 2 && mc > 300, `careful bot scores more than twice the clumsy bot on the daily stream (${mc.toFixed(0)} against ${ml.toFixed(0)}) and passes 300`);
  for (let i = 1; i < 60; i++) {
    const ds = chunk(20261124, i).filter((it) => it.k === 'drain');
    for (const a of ds) for (const b of ds) if (a !== b && Math.abs(a.y - b.y) < 0.3 && Math.abs(a.x - b.x) < 0.4) failures++, console.log('FAIL daily piece ' + i + ' has drains too close to pass');
  }
  check(true, `daily pieces 1 to 59 (piece length ${CH}) checked for a passable gap between paired drains`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
