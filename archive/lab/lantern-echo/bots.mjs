// Lantern Echo fairness check: node experiments/lab/lantern-echo/bots.mjs [seeds] [night]
// Two bots ride the same rivers with the same steering rule. Only what they know differs:
//   sight: knows every rock, ember and ability within 2.4 units ahead (all the river there is).
//   echo:  knows only what echo.js has lit right now (a ping's ring, or the flash of a taken ember). This is the player
//          with sound off: no proximity tick. It forgets a thing as soon as its glow ends.
//   Both echo bots act on a lit thing only 0.25 s after it first lights, for a person's reaction time.
//   echo+memory: as echo, and it also keeps each thing where it last saw it for MEMORY seconds after its glow ends,
//          as still, for a person who remembers where a rock was. Not the pass mark; it shows how much memory buys.
//   echo+tap: as echo, and also pings by hand every time the cooldown allows (an attentive player tapping).
// Both know the banks, which the page always draws.
// Pass mark, set before tuning: on night 1 the echo bot reaches dawn on at least half the seeds, and at least
// 70% as often as the sight bot.
import { create, step, centre, half, speed, boat, nightPace, progress } from '../../lantern/sim.js';
import { createEcho, update, ping, TUNE } from './echo.js';

const seeds = Number(process.argv[2] ?? 20), night = Number(process.argv[3] ?? 1);

// The steering rule. For each target across the river: the boat slides there at its top sideways speed and holds.
// Score each line by the known rocks it passes close to (worse the sooner), the bank, the known embers and abilities it
// takes (worth more as the flame runs low), known false embers it takes, and how far it moves.
function steer(s, known) {
  const v = speed(s) * (s.slow ? 0.5 : 1), side = 0.95 * nightPace(s.stage) * s.hard, b = boat(s), H = 1.6;
  const c0 = centre(s, s.y), h0 = half(s, s.y);
  let best = s.x, bestScore = -Infinity;
  for (let i = 0; i <= 30; i++) {
    const x = c0 - h0 + (2 * h0) * i / 30;
    let score = -Math.abs(x - s.x) * 0.4;
    for (let t = 0.05; t <= H; t += 0.05) {
      const yb = s.y + v * t, xb = s.x + Math.max(-side * t, Math.min(side * t, x - s.x));
      const edge = half(s, yb) - b - Math.abs(xb - centre(s, yb));
      if (edge < 0.02) score -= (0.02 - edge) * 400 / (t + 0.2);
      for (const k of known.rocks) {
        const yr = k.y + (k.vy ? k.vy * t : 0) + (k.b ? k.b * (Math.sin((s.t + t) * k.wy + k.ph + k.phy) - Math.sin(s.t * k.wy + k.ph + k.phy)) : 0);
        if (Math.abs(yr - yb) > 0.2) continue;
        const xr = k.a ? k.x0 + k.a * Math.sin((s.t + t) * k.w + k.ph) : k.x;
        const d = Math.hypot(Math.max(0, Math.abs(xr - xb) - k.len), yr - yb) - k.rad - b;
        if (d < 0.025) score -= (0.025 - d) * 2000 / (t + 0.2);
      }
    }
    for (const e of known.pickups) {
      const t = (e.y - s.y) / v; if (t < 0 || t > H) continue;
      const xb = s.x + Math.max(-side * t, Math.min(side * t, x - s.x));
      if (Math.abs(xb - e.x) < 0.04) score += e.kind === 'wisp' ? -3 : e.kind === 'ember' ? 1 + 4 * (1 - s.light) : 1.5;
    }
    if (score > bestScore) { bestScore = score; best = x; }
  }
  return best;
}

const sees = s => ({ rocks: s.rocks.filter(k => k.y < s.y + 2.4), pickups: [...s.embers, ...s.powers].filter(o => !o.got && o.y < s.y + 2.4) });
// A person needs a moment to notice a thing that has just lit: the echo bots act on it only after REACT seconds.
const REACT = 0.25;
const hears = e => { const rocks = [], pickups = []; for (const [o, l] of e.lit) if (e.t - l.from >= REACT) (l.kind === 'rock' ? rocks : pickups).push(o); return { rocks, pickups }; };

const MEMORY = 1.0;
function remembers(e, s, mem) {
  const now = hears(e);
  for (const o of [...now.rocks, ...now.pickups]) mem.set(o, { at: e.t, ghost: { ...o, a: 0, b: 0, vy: 0 } });
  for (const [o, m] of mem) {
    if (e.t - m.at > e.tune.glow + MEMORY || o.got) { mem.delete(o); continue; }
    if (now.rocks.includes(o) || now.pickups.includes(o)) continue;
    ('rad' in o ? now.rocks : now.pickups).push(m.ghost); // where it was when last lit, and still
  }
  return now;
}

function ride(seed, mode, tune) {
  const s = create(seed, night), e = createEcho(tune), mem = new Map();
  let target = s.x, n = 0;
  while (!s.over) {
    if (n++ % 3 === 0) target = steer(s, mode === 'sight' ? sees(s) : mode === 'memory' ? remembers(e, s, mem) : hears(e)); // a new plan every 50 ms, a quick person's pace
    if (mode === 'tap') ping(e, s, true);
    step(s, target); update(e, s);
  }
  return { over: s.over, p: progress(s), pings: e.count };
}

function row(name, mode, tune) {
  const res = []; for (let seed = 1; seed <= seeds; seed++) res.push(ride(seed, mode, tune));
  const ps = res.map(r => r.p).sort((a, b) => a - b), ends = {};
  for (const r of res) ends[r.over] = (ends[r.over] ?? 0) + 1;
  const med = (ps[(seeds - 1) >> 1] + ps[seeds >> 1]) / 2, dawn = (ends.dawn ?? 0) / seeds;
  console.log(`${name.padEnd(44)} median ${(med * 100).toFixed(0).padStart(3)}%  dawn ${(dawn * 100).toFixed(0).padStart(3)}%  ${JSON.stringify(ends)}`);
}

const first = { period: 1.6, ring: 2.5, range: 2.0, glow: 0.9 }; // the first tuning tried: the period and glow the idea started with
console.log(`night ${night}, seeds 1 to ${seeds}`);
row('sight (sees everything ahead)', 'sight');
row(`echo, first tuning ${JSON.stringify(first)}`, 'echo', first);
row(`echo+memory ${MEMORY} s, first tuning`, 'memory', first);
row(`echo, page tuning ${JSON.stringify({ period: TUNE.period, ring: TUNE.ring, range: TUNE.range, glow: TUNE.glow })}`, 'echo', {});
row('echo+tap, page tuning (pings at every cooldown)', 'tap', {});

// node bots.mjs [seeds] [night] sweep: the echo bot over a grid of tunings, to see which knob matters.
if (process.argv[4] === 'sweep') for (const period of [1.0, 1.3, 1.6]) for (const glow of [0.9, 1.2, 1.5]) for (const ring of [2.5, 4]) row(`  sweep period ${period} glow ${glow} ring ${ring}`, 'echo', { period, glow, ring, range: 2.6 });
