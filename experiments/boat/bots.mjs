// node bots.mjs            proves the rules and measures difficulty; exits non-zero on failure
// node bots.mjs --mutate   breaks one rule (the player's ripples and pebbles no longer bend the current); must exit non-zero
// node bots.mjs music [--mutate]   only the music claims (section 7); --mutate then breaks song.js, not the rules
import { readFile } from 'node:fs/promises';
import { create, step, play, advise, rng, items, stars, score, chunk, length, LEVELS, DT, CH, pebbleHint, grateParted } from './sim.js';
const musicOnly = process.argv.includes('music');
const mutate = process.argv.includes('--mutate') && !musicOnly, quick = process.argv.includes('--quick');
const mut = mutate ? 'touch' : null;
let failures = 0;
const check = (ok, text) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failures++; };
if (mutate) console.log('Mutation: flow() ignores ripples and pebbles. The policies are unchanged.');

// The clumsy player: looks only a short way ahead, reacts late, aims badly, sometimes pushes the wrong way,
// and fidgets when nothing is near. It never goes for passengers.
function clumsy(seed) {
  const r = rng(seed);
  let sawTap = false;
  return (s) => {
    const b = s.b, tap = pebbleHint(s);
    // This player copies the visible ghost tap once, with imprecise aim.
    if (tap && !sawTap) { sawTap = true; return { ...tap, x: tap.x + (r() - 0.5) * 0.06 }; }
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

// 7. Music (kit/music.js through song.js, 2026-11-24). The careful bot and the clumsy one play streets and today's stream
// on a stand-in audio clock that runs with the sim. Claims: each passenger taken and each drain or paw got past plays exactly
// one note of the run's tune (or waits when four already wait) and nothing else plays one; a drain that takes the boat plays
// none; a passenger gone past untaken is a missed note; a swat is a blow that thins the music for two bars; every note is on
// the score's grid, in its chord and in the tune's order (kit/check/music-claims.mjs); the heartbeat sounds in the 2.5 s before a drain (a heartbeat comes twice every four eighths, 1.6 s at 76 a minute)
// takes the boat; the chords turn major only near the pond; the high note sounds only once the paper is over 72% soaked; and
// the music never changes the rules (a twin run without it ends byte for byte the same).
// --mutate runs twice with song.js broken on purpose (a passenger left behind plays a note; notes on a clock) and must fail.
async function musicClaims(mutation) {
  const { bench } = await import('../kit/check/music-claims.mjs');
  let code = await readFile(new URL('./song.js', import.meta.url), 'utf8');
  const right = 'notes: s.riders.length - before.riders + safe.length,';
  if (!code.includes(right)) throw new Error('music mutation target is missing');
  if (mutation === 'left') code = code.replace(right, `notes: s.riders.length - before.riders + safe.length + past(s, before.y, y1, ['bug']).filter(it => !s.got[it.id]).length,`);
  if (mutation === 'clock') code = code.replace(right, 'notes: Math.floor(s.tick / 60) - Math.floor((s.tick - 1) / 60),');
  code = code.replace("from './sim.js'", `from '${new URL('./sim.js', import.meta.url).href}'`).replace("from '../kit/music.js'", `from '${new URL('../kit/music.js', import.meta.url).href}'`);
  const { SONG, mood, look, heard } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const fail = [], sum = { runs: 0, minutes: 0, notes: 0, waits: 0, misses: 0, blows: 0, pulses: 0, drains: 0, drainHeard: 0, highs: 0, worst: 0 };
  const crossed = (s, y0, y1, k) => items(s, y0 - 1, y1 + 1).filter(it => it.k === k && it.y + 0.15 > y0 && it.y + 0.15 <= y1);
  const runs = [];
  for (const l of LEVELS) { runs.push([l.n, 1, 'careful']); for (let seed = 1; seed <= (quick ? 2 : 6); seed++) runs.push([l.n, seed, 'clumsy']); }
  for (const seed of [20261124, 20261125]) { runs.push([0, seed, 'careful']); runs.push([0, seed, 'clumsy']); }
  for (const [level, seed, who] of runs) {
    const opts = level ? { level, seed } : { daily: true, seed }, s = create(opts), twin = create(opts), b = bench(SONG, seed);
    const policy = who === 'careful' ? q => advise(q) : clumsy(seed * 31 + level), twinPolicy = who === 'careful' ? q => advise(q) : clumsy(seed * 31 + level);
    const where = `${level ? 'street ' + level : 'daily'} seed ${seed} ${who}`;
    let wait = 0, twinWait = 0;
    const pick = (q, f, w) => { if (w > 0) return [[], w - 1]; const a = f(q); return a ? [[a], (who === 'careful' ? 26 : 55) - 1] : [[], (who === 'careful' ? 10 : 30) - 1]; };
    while (!s.over && s.tick < 60 * 400) {
      let acts, tacts; [acts, wait] = pick(s, policy, wait); [tacts, twinWait] = pick(twin, twinPolicy, twinWait);
      const before = look(s), y0 = s.b.y, riders = s.riders.length;
      step(s, acts); step(twin, tacts);
      const m = mood(s); b.mood({ on: !s.over, ...m });
      const h = heard(before, s), got = b.heard(h), y1 = s.b.y;
      const safe = s.over === 'drain' || s.over === 'soak' ? 0 : crossed(s, y0, y1, 'drain').length + crossed(s, y0, y1, 'paw').length;
      const left = crossed(s, y0, y1, 'bug').filter(it => !s.got[it.id]).length;
      if (h.notes !== s.riders.length - riders + safe) fail.push(`${where}: ${h.notes} notes for ${s.riders.length - riders} passengers and ${safe} hazards passed`);
      if (got.length && s.riders.length === riders && !safe) fail.push(`${where}: a note with nothing taken or passed`);
      if (h.misses !== left) fail.push(`${where}: a passenger left behind is not a missed note`);
      if (h.blows !== s.ev.filter(e => e.type === 'swat').length) fail.push(`${where}: a swat is not a blow`);
      if (s.over === 'drain') { sum.drains++; if (b.song.log.some(l => l.kind === 'pulse' && l.at > b.clock - 2.5)) sum.drainHeard++; else console.log('     no heartbeat before the drain:', where, s.tick, (b.song.log.filter(l => l.kind === 'pulse').at(-1)?.at ?? -1).toFixed(2), b.clock.toFixed(2)); }
      const log = b.song.log.length; b.advance(DT);
      for (const l of b.song.log.slice(log)) {
        if (l.kind === 'pad' && l.major && m.progress <= b.P.turn) fail.push(`${where}: the chords turned major before the pond was near`);
        if (l.kind === 'high' && m.light >= 0.28) fail.push(`${where}: the high note while the paper is still dry`);
      }
    }
    b.close();
    if (JSON.stringify(s) !== JSON.stringify(twin)) fail.push(`${where}: the music changed the run`);
    fail.push(...b.fail.map(f => `${where}: ${f}`));
    sum.runs++; sum.minutes += s.tick * DT / 60; sum.highs += b.song.log.filter(l => l.kind === 'high').length; sum.pulses += b.song.log.filter(l => l.kind === 'pulse').length;
    for (const k of ['notes', 'waits', 'misses', 'blows']) sum[k] += b.n[k]; sum.worst = Math.max(sum.worst, b.n.worst);
  }
  if (sum.drains && sum.drainHeard < sum.drains * 0.8) fail.push(`the heartbeat sounded before only ${sum.drainHeard} of ${sum.drains} drains`);
  console.log(`music${mutation ? ` (mutate ${mutation})` : ''}: ${sum.runs} runs, ${sum.minutes.toFixed(1)} minutes: ${sum.notes} tune notes (${(sum.notes / sum.minutes).toFixed(1)} a minute), ${sum.waits} with no note (four waiting), ${sum.misses} passengers left behind (missed notes), ${sum.blows} swats (blows), ${sum.pulses} heartbeat pulses, heartbeat in the 2.5 s before ${sum.drainHeard} of ${sum.drains} drains, ${sum.highs} high notes; latest note ${(sum.worst * 1000).toFixed(0)} ms after its moment; ${fail.length} failures${fail.length ? ': ' + [...new Set(fail)].slice(0, 4).join('; ') : ''}`);
  return fail.length;
}
if (musicOnly) {
  if (process.argv.includes('--mutate')) {
    const caught = [await musicClaims('left'), await musicClaims('clock')].map(Boolean);
    console.log(caught.every(Boolean) ? 'mutation caught: both broken versions of the music fail' : 'MUTATION MISSED');
    process.exit(caught.every(Boolean) ? 1 : 2);
  }
  process.exit(await musicClaims() ? 1 : 0);
}

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
// Rule-level references use identical states and controlled input, independent of policy scoring.
{
  const dry = create({ level: 1, seed: 5 }), splash = structuredClone(dry), far = structuredClone(dry);
  const stroke = { k: 'ripple', x: dry.b.x, y: dry.b.y, dx: 0, dy: 1, a: 1 };
  step(dry); step(splash, [stroke]); step(far, [{ ...stroke, x: 3 }]);
  check(Math.abs(splash.soak - dry.soak - 0.02) < 1e-9 && far.soak - dry.soak < 1e-9, 'a nearby full ripple costs exactly 2% soak; a distant ripple costs none');
  const snail = create({ level: 1, seed: 5 }), ladybird = structuredClone(snail);
  snail.riders = ['snail']; ladybird.riders = ['ladybird'];
  for (let i = 0; i < 60; i++) { step(snail); step(ladybird); }
  check(Math.abs(snail.soak * 2 - ladybird.soak) < 1e-9 && JSON.stringify(snail.b) === JSON.stringify(ladybird.b), `a carried snail halves passive soak without changing movement (${(snail.soak * 100).toFixed(3)}% vs ${(ladybird.soak * 100).toFixed(3)}% in 1s)`);
  const gate = LEVELS.find(l => l.teach === 'pebble');
  const untouched = play(create({ level: gate.n, seed: 5 }), () => null);
  const swipes = play(create({ level: gate.n, seed: 5 }), s => ({ k: 'ripple', x: s.b.x, y: s.b.y, dx: 1, dy: 0, a: 1 }));
  const tapped = play(create({ level: gate.n, seed: 5, mut }), s => pebbleHint(s));
  const grate = gate.items.find(it => it.grate);
  check(untouched.over === 'drain' && swipes.over === 'drain', 'the early broad grate catches both an untouched boat and a ripple-only escape');
  check(tapped.b.y > grate.y + 0.15, `copying the ghost tap alone passes the grate (${tapped.over}, y ${tapped.b.y.toFixed(2)})`);
  const expired = create({ level: gate.n, seed: 5 }); expired.stones = [{ x: grate.x - 0.08, y: grate.y - 0.22, age: 7 - DT }];
  check(grateParted(expired, grate), 'an upstream pebble parts the grate'); step(expired);
  check(!grateParted(expired, grate), 'the grate closes when its pebble expires');
}
// Same two-passenger route, different finishing strokes: faster can cost the third star.
{
  const route = create({ level: 1, seed: 1, mut });
  let wait = 0;
  while (!route.over && route.riders.length < 2) {
    let acts = [];
    if (wait <= 0) { const a = advise(route); if (a) { acts = [a]; wait = 26; } else wait = 10; }
    wait--; step(route, acts);
  }
  const finish = rest => {
    const s = structuredClone(route); let wait = 0;
    while (!s.over) { const acts = wait-- <= 0 ? [{ k: 'ripple', x: s.b.x, y: s.b.y - 0.08, dx: 0, dy: 1, a: 1 }] : []; if (acts.length) wait = rest - 1; step(s, acts); }
    return s;
  };
  const spare = finish(26), rush = finish(2), flood = finish(1);
  check(spare.riders.length === 2 && rush.riders.length === 2 && stars(spare) === 3 && stars(rush) === 2 && rush.tick < spare.tick,
    `same passengers: spare strokes ${(spare.tick * DT).toFixed(2)}s / ${(spare.soak * 100).toFixed(2)}% / ${stars(spare)} stars; rush ${(rush.tick * DT).toFixed(2)}s / ${(rush.soak * 100).toFixed(2)}% / ${stars(rush)} stars`);
  check(flood.over === 'soak', 'continuous downstream ripples sink the boat despite its speed');
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
  check(rates.every((rate, i) => i === 0 || rates[i - 1] > rate), `clumsy success strictly falls at every adjacent street: ${rates.map(r => (r * 100).toFixed(1)).join(' > ')}`);
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
if (!mutate) check(await musicClaims() === 0, 'the music claims hold (node bots.mjs music)');
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
