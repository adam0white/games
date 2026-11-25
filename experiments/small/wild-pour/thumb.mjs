// A clumsy thumb: a model of a new player, written before the 2026-11-24 retune and frozen, so it measures the game,
// not itself. It knows nothing of the physics. It sees only what is on screen, late: drops leaving the jug, drops in
// the glass, drops in the air, where the glass is and where the stream lands.
//   reacts 250 to 400 ms late; slides its thumb right until it sees juice run, overshooting while it waits to see;
//   the tilt wobbles; it backs off when the stream looks too fast; it stops late (a random point around the line,
//   plus a slow lift on some seeds); when the glass settles under the band it tops up with a small second pour.
//   node thumb.mjs [--sim=path/to/sim.js] [--from=1] [--count=500] [--level=N]   clear rate per level
// It drives the same finger mapping as the page: tilt = MAX_TILT * thumb travel, travel 0 to 1.
import { rng } from './sim.js';

export function thumb(seed, MAX = 2.4) {
  const r = rng(seed * 7 + 13);
  const gauss = () => (r() + r() + r() + r() - 2) * 0.866; // about unit variance
  const lag = 15 + Math.floor(r() * 10);        // 250 to 400 ms at 60 steps a second
  const slide = (0.6 + r() * 0.6) / 60;         // how fast the thumb slides: 0.6 to 1.2 rad of tilt a second
  const want = 6 + r() * 8;                     // the stream it is happy with: 6 to 14 drops a second
  const late = r() * 0.25 * 60;                 // extra frames before the stop decision turns into a lift (0 to 250 ms)
  const stopBias = gauss() * 0.35 - 0.1;        // where it stops, in bands around the line (a little early on average)
  const slowLift = r() < 0.3;                   // some thumbs slide back instead of lifting
  const wobble = 0.05 + r() * 0.05;
  const seen = [];
  let tilt = 0, noise = 0, mode = 'seek', onset = null, stopIn = -1, calmFor = 0, topups = 0, frame = 0, landX = null;
  return s => {
    frame++;
    // What is on screen now; it is used `lag` frames later.
    let out = 0; for (const e of s.events) if (e === 'out') out++;
    let lx = 0, ln = 0;
    for (const q of s.p) if (q.st === 1 && q.y > s.glass.top - 14 && q.y < s.glass.top) { lx += q.x; ln++; }
    seen.push({ out, inGlass: s.inGlass, flying: s.flying, gx: s.glass.x, gw: s.glass.w, target: s.L.target, band: s.L.band, land: ln ? lx / ln : null, inJug: s.inJug });
    const v = seen[Math.max(0, seen.length - 1 - lag)];
    if (v.land !== null) landX = landX === null ? v.land : landX * 0.9 + v.land * 0.1;
    let flow = 0; for (let i = Math.max(0, seen.length - 1 - lag - 15); i <= seen.length - 1 - lag; i++) flow += seen[i].out;
    flow *= 4; // drops a second, over the quarter second it can see
    const level = v.inGlass + v.flying * 0.5;
    const stopAt = v.target + stopBias * v.band;
    const aim = landX ?? 55;
    const under = Math.abs(v.gx - aim) < v.gw * 0.7;
    noise = noise * 0.85 + gauss() * wobble * 0.4;

    if (mode === 'seek' || mode === 'hold') {
      if (level >= stopAt) { mode = 'stop'; stopIn = late; }
      else if (!under && onset !== null) tilt += (onset - 0.15 - tilt) * 0.2; // waits for the glass, just short of a pour
      else if (mode === 'seek') {
        tilt += slide;
        if (flow > 0) { mode = 'hold'; onset ??= tilt; }
      } else {
        if (flow > want * 1.6) tilt -= slide * 0.5;
        else if (flow < want * 0.5) tilt += slide * 0.7;
      }
    }
    if (mode === 'stop') {
      if (stopIn > 0) stopIn--;
      else if (slowLift) tilt -= 4 / 60; else tilt = 0;
      if (tilt <= 0) { tilt = 0; mode = 'wait'; calmFor = 0; }
    }
    if (mode === 'wait') {
      calmFor = v.flying === 0 ? calmFor + 1 : 0;
      if (calmFor > 36 && v.inGlass < v.target - v.band && topups < 3 && v.inJug > 0) {
        topups++; mode = 'seek'; tilt = onset !== null ? onset - 0.25 : 0;
      }
    }
    tilt = Math.max(0, Math.min(MAX, tilt));
    return mode === 'wait' || tilt === 0 ? 0 : Math.max(0, Math.min(MAX, tilt + noise));
  };
}

export function clearRates(sim, { levels, from = 1, count = 500, policy = thumb, opts = {} } = {}) {
  const rows = [];
  for (const n of levels) {
    let wins = 0, stars = 0; const why = {};
    for (let seed = from; seed < from + count; seed++) {
      const s = sim.create(n, seed, opts), pol = policy(seed * 1000 + n);
      for (let i = 0; i < 60 * 40 && !s.over; i++) sim.step(s, pol(s));
      if (s.won) { wins++; stars += s.stars; }
      why[s.why] = (why[s.why] || 0) + 1;
    }
    rows.push({ level: n, wins, count, rate: wins / count, stars: wins ? stars / wins : 0, why });
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const sim = await import(arg('sim', './sim.js').startsWith('/') ? arg('sim') : new URL(arg('sim', './sim.js'), import.meta.url).href);
  const one = arg('level', null);
  const levels = one ? [+one] : Array.from({ length: sim.LEVELS }, (_, i) => i + 1);
  for (const row of clearRates(sim, { levels, from: +arg('from', 1), count: +arg('count', 500) }))
    console.log(`level ${row.level}: ${row.wins}/${row.count} = ${(row.rate * 100).toFixed(1)}% (stars ${row.stars.toFixed(2)}) ${JSON.stringify(row.why)}`);
}
