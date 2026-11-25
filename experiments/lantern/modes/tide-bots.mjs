// Lantern Tide's claims: node experiments/lantern/bots.mjs tide [seeds, default 120] [--mutate]  (or run this file directly).
// Bots play each stage on many seeds through tide-sim.js and Lantern's unchanged sim.js. They steer as a thumb does: a new
// target every 6 ticks (10 a second). The "late" bots act on what they saw 300 ms ago, as a person reacting does.
//   reader  scores each route by the rocks, banks and embers it can see and by the water along it (fast water, lees)
//   plain   the same, blind to the water: it steers to embers and away from rocks, and keeps to the middle
//   idle    never steers (the first ten seconds with no hands)
// --mutate breaks the rules on purpose (the channel burns the flame instead of saving it) and the claims must fail.
import { registerHooks } from 'node:module';
const mutate = process.argv.includes('--mutate');
if (mutate) registerHooks({ load(url, context, next) { // the channel burns the flame instead of saving it
  const out = next(url, context); if (!url.includes('/modes/tide-sim.js')) return out;
  const src = String(out.source), from = 'cf.burn * (1 - 0.95 * flow.rush)'; if (!src.includes(from)) throw new Error('mutation point moved');
  return { ...out, source: src.replace(from, 'cf.burn * (0.1 + 1.9 * flow.rush)') };
} });
const { start, tick, current, jet, strength, reach, rating, config, centre, half, NIGHTS, NEW, CLEAR, GRACE, DT } = await import('./tide-sim.js');
import { speed, nightPace, BOAT } from '../sim.js?v=15';

const args = process.argv.slice(2).filter(a => !a.startsWith('--') && a !== 'tide');
const SEEDS = Number(args[0] ?? 120);
const HOLD = 6, SEE = 2.2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function steer(e, { water = true, lees = true, lag = 0, rockMargin = 0.034, bankMargin = 0.026 } = {}) {
  const s = e.s, base = speed(s), rate = e.flow.rate, v = base * rate;
  const rocks = s.rocks.filter(k => k.on && k.y > s.y - 0.1 && k.y < s.y + SEE);
  const embers = s.embers.filter(m => !m.got && m.kind === 'ember' && m.y > s.y && m.y < s.y + SEE);
  const reachX = 0.95 * nightPace(s.stage);
  let chosen = s.x, best = -Infinity;
  for (let i = -7; i <= 7; i++) {
    const goal = clamp(s.x + i * 0.04, 0, 1);
    let quality = -0.11 * Math.abs(goal - s.x), y = s.y, x = s.x, last = null;
    for (let n = 1; n <= 12; n++) {
      const at = n * 0.045, flow = water ? current(e, x, y, s.t + at - lag) : null; // lag: the water as it was that many seconds ago
      y += (flow ? base * flow.rate : v) * 0.045;
      x += clamp(goal - x, -reachX * 0.045, reachX * 0.045);
      const bank = half(s, y) - Math.abs(x - centre(s, y)) - BOAT, w = 1 - at * 0.85;
      if (bank < bankMargin) quality -= w * (bankMargin - bank) * (bank < 0 ? 55 : 10);
      for (const k of rocks) {
        const rx = k.a ? k.x0 + k.a * Math.sin((s.t + at) * k.w + k.ph) : k.x, ry = k.y + (k.vy || 0) * at * rate;
        const d = Math.hypot(x - rx, y - ry) - k.rad - BOAT;
        if (d < rockMargin) quality -= w * (rockMargin - d) * (d < 0 ? 65 : 12);
      }
      for (const m of embers) if (m !== last && Math.hypot(x - m.x, y - m.y) < 0.047) { quality += w * (0.09 + 0.17 * (1 - s.light)); last = m; }
      if (flow) quality += w * (0.065 * flow.rush + (lees ? 0.25 * flow.lee * (1 - s.light) : 0));
      quality -= Math.abs(x - centre(s, y)) * 0.08;
    }
    if (quality > best) { best = quality; chosen = goal; }
  }
  return chosen;
}

export function ride(seed, n, policy, delay = 0, limit = 150) {
  const e = start(seed, n), s = e.s, queue = []; let target = s.x, firstBlow = null;
  for (let i = 0; !s.over && i < limit / DT; i++) {
    if (i % HOLD === 0) { queue.push(policy === 'idle' ? s.x0 ?? target : steer(e, policy)); if (queue.length > delay) target = queue.shift(); }
    tick(e, target);
    if (firstBlow === null && s.events.some(v => v === 'hurt' || v === 'hit')) firstBlow = s.t;
  }
  return { over: s.over, t: s.t, reach: reach(e), taken: s.taken, blows: e.blows, ridden: e.ridden, rested: e.rested, stars: rating(e), firstBlow };
}


const seeds = Array.from({ length: SEEDS }, (_, i) => (Math.imul(i + 1, 0x9e3779b9) >>> 0));
const LATE = { rockMargin: 0.06, bankMargin: 0.045 }; // a person reacting 300 ms late leaves more room
const POL = { reader: {}, plain: { water: false }, late: LATE, latePlain: { ...LATE, water: false }, noLee: { ...LATE, lees: false }, still: { ...LATE, lag: 2 } };
const table = {}, fails = [];
const claim = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };
const pct = runs => Math.round(100 * runs.filter(r => r.over === 'dawn').length / runs.length);
for (let n = 1; n <= NIGHTS; n++) {
  table[n] = {};
  for (const [name, pol, delay] of [['reader', POL.reader, 0], ['late reader', POL.late, 3], ['plain', POL.plain, 0], ['late plain', POL.latePlain, 3], ['late noLee', POL.noLee, 3], ['late still', POL.still, 3]]) {
    if ((name === 'late noLee' && n < 3) || (name === 'late still' && n < 4)) continue;
    const runs = seeds.map(seed => ride(seed, n, pol, delay)), ends = {};
    for (const r of runs) ends[r.over ?? 'none'] = (ends[r.over ?? 'none'] ?? 0) + 1;
    table[n][name] = runs;
    const mean = k => runs.reduce((a, r) => a + r[k], 0) / runs.length;
    console.log(`stage ${n} (${NEW[n]}) ${name.padEnd(11)} dawn ${String(pct(runs)).padStart(3)}%  ${JSON.stringify(ends)}  time ${mean('t').toFixed(1)} s  fast ${mean('ridden').toFixed(1)} s  relit ${mean('rested').toFixed(2)}  embers ${mean('taken').toFixed(1)}  stars ${mean('stars').toFixed(2)}`);
  }
  const idle = seeds.map(seed => ride(seed, n, 'idle', 0, 40));
  table[n].idle = idle;
  const first = idle.map(r => r.firstBlow ?? r.t).sort((a, b) => a - b);
  table[n].firstBlow = first[0];
  console.log(`stage ${n} idle: no blow for ${first[Math.floor(first.length * 0.1)].toFixed(1)} s (p10), ${first[Math.floor(first.length / 2)].toFixed(1)} s (median); lost at ${(idle.map(r => r.t).sort((a, b) => a - b)[Math.floor(idle.length / 2)]).toFixed(1)} s (median)`);
}

// Claims. A dawn rate is the share of seeds that reach dawn. "late" is the careful bot acting 300 ms late (LATE margins).
const rate = (n, k) => pct(table[n][k]);
const mean = (n, k, f) => table[n][k].reduce((a, r) => a + r[f], 0) / table[n][k].length;
const late = Array.from({ length: NIGHTS }, (_, i) => rate(i + 1, 'late reader'));
claim(Array.from({ length: NIGHTS }, (_, i) => rate(i + 1, 'reader')).every(v => v >= 95), `the reader reaches dawn on >= 95% of seeds on every stage`);
claim(late[0] >= 85 && late[NIGHTS - 1] >= 30, `late reader: stage 1 ${late[0]}% (>= 85), stage ${NIGHTS} ${late[NIGHTS - 1]}% (>= 30)`);
claim(late.every((v, i) => i === 0 || (v <= late[i - 1] + 5 && late[i - 1] - v <= 20)), `no cliff: late reader by stage ${late.join(' > ')}%, each step down at most 20 points and never up more than 5`);
claim(rate(1, 'reader') - rate(1, 'plain') >= 20 && table[1].plain.filter(r => r.over === 'dark').length > table[1].plain.length * 0.15,
  `stage 1, the bright water keeps the flame: reader ${rate(1, 'reader')}% vs blind to the water ${rate(1, 'plain')}% (plain goes dark on ${table[1].plain.filter(r => r.over === 'dark').length} seeds)`);
claim(table[1].reader.every(r => r.blows === 0) && !seeds.some(seed => start(seed, 1).s.rocks.length), `stage 1 has no rocks and the reader takes no blow`);
claim(mean(2, 'late reader', 'ridden') >= 1.5 * mean(2, 'late plain', 'ridden'), `stage 2, shoulders: fast water ridden ${mean(2, 'late reader', 'ridden').toFixed(1)} s reading vs ${mean(2, 'late plain', 'ridden').toFixed(1)} s blind (>= 1.5x)`);
claim(rate(3, 'late reader') - rate(3, 'late noLee') >= 25 && mean(3, 'late reader', 'rested') > 3 * mean(3, 'late noLee', 'rested'), `stage 3, lees: ${rate(3, 'late reader')}% resting in lees vs ${rate(3, 'late noLee')}% passing them by (>= 25 points)`);
claim(table[2].reader.every(r => r.rested === 0), `stage 2 has no lee yet (nothing relit)`);
{ const moved = n => { let most = 0; for (const seed of seeds.slice(0, 20)) { const e = start(seed, n); for (let t = 0; t < 30; t += 0.5) most = Math.max(most, Math.abs(jet(e, 20, t + 3) - jet(e, 20, t))); } return most; };
  const m3 = moved(3), m4 = moved(4);
  claim(m4 >= 0.3 && m3 <= 0.5 * m4, `stage 4, the tide turns: the channel at one spot slides ${m4.toFixed(2)} half-widths in 3 s (stage 3: ${m3.toFixed(2)})`);
  claim(mean(4, 'late reader', 'ridden') >= mean(4, 'late still', 'ridden') + 2, `stage 4: reading the water as it is now rides ${mean(4, 'late reader', 'ridden').toFixed(1)} s of fast water vs ${mean(4, 'late still', 'ridden').toFixed(1)} s reading it as it was 2 s ago`); }
{ const iced = n => seeds.slice(0, 20).some(seed => { const e = start(seed, n); for (let i = 0; i < 60 / DT && !e.s.over; i++) { tick(e, steer(e)); if (e.s.rocks.some(k => k.ice)) return true; } return false; });
  claim(iced(5) && ![1, 2, 3, 4].some(iced), `stage 5 brings ice and no stage before it does`); }
claim(Array.from({ length: NIGHTS }, (_, i) => table[i + 1].firstBlow).every(t => t >= 3.5), `hands off, no blow in the first 3.5 s on any seed or stage (earliest ${Math.min(...Array.from({ length: NIGHTS }, (_, i) => table[i + 1].firstBlow)).toFixed(1)} s)`);
claim(Array.from({ length: NIGHTS }, (_, i) => table[i + 1].idle).every(runs => runs.map(r => r.t).sort((a, b) => a - b)[runs.length >> 1] >= 10), `hands off, the boat lasts at least 10 s (median) on every stage`);
claim(seeds.every(seed => { for (let n = 1; n <= NIGHTS; n++) if (start(seed, n).s.rocks.some(k => k.y0 <= CLEAR)) return false; return true; }), `no rock in the first ${CLEAR} river units of any stage`);
if (fails.length) { console.log(`\n${fails.length} claim(s) failed${mutate ? ' (as they must under --mutate)' : ''}`); process.exitCode = 1; }
else console.log(`\nall tide claims hold${mutate ? ' -- but --mutate should have broken them' : ''}`);
