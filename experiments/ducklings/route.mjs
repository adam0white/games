// Is there a way through? A check of the endless generator that does not use the bots' search.
// The pond is cut into "bands": stretches of y that some hazard can reach. Between bands the water is free.
// A band is passable if, from a free level below it, a mother with a bunched line of n ducklings can swim
// straight up some lane x, starting at some moment within `wait` seconds, and every body (her, and each
// duckling on her trail at its delay) stays clear until the last duckling is above the band.
// The forward pass also keeps a clock: the earliest moment each band is cleared, so a caller can compare
// it with the time the checkpoints give.
import { create, endlessAhead, hitAny, moveMom, DT, GAP, R_MOM, R_DUCK, SPEED, checkGain, duskRate, ENDLESS_TIME, DUSK_ONSET } from './sim.js';

const LANES = []; for (let x = 0.1; x <= 0.9001; x += 0.05) LANES.push(+x.toFixed(2));
const PAD = 0.04; // a hazard's reach beyond its bounds: the largest hit radius plus a body, beyond what bounds() already adds

function reach(h) {
  if (h.kind === 'gust') return [h.y0, h.y1];
  return [h.y0 - PAD, h.y1 + PAD];
}

// Bands of y that some hazard reaches, merged, between y0 and y1.
export function bands(s, y0, y1) {
  const spans = s.hazards.map(h => [...reach(h), h]).filter(([a, b]) => b > y0 && a < y1).sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const [a, b, h] of spans) {
    const last = out[out.length - 1];
    if (last && a <= last.b + 0.02) { last.b = Math.max(last.b, b); last.hz.push(h); }
    else out.push({ a, b, hz: [h] });
  }
  return out;
}

// Try one crossing: start bunched at (x, ya) at time t0, swim to yb, hold until the tail is over yb.
function cross(world, x, ya, yb, t0, delays) {
  const m = { x, y: ya, vx: 0, vy: 0 }, trail = [{ x, y: ya }];
  const tail = delays[delays.length - 1] ?? 0, limit = (yb - ya) / (SPEED * 0.4) + tail + 2;
  let t = t0, tick = 0, momOver = null;
  while (t - t0 < limit) {
    t += DT; tick++;
    moveMom(world, m, m.y < yb ? { x, y: yb + 0.3 } : { x: m.x, y: m.y }, t, DT, false);
    trail.push({ x: m.x, y: m.y });
    if (momOver === null && m.y >= yb) momOver = t;
    if (tick % 2) continue;
    if (hitAny(world, t, m.x, m.y, R_MOM)) return null;
    let allOver = momOver !== null;
    for (const D of delays) {
      const k = Math.max(0, tick - Math.round(D / DT)), p = trail[k];
      if (p.y < yb) allOver = false;
      if (hitAny(world, t, p.x, p.y, R_DUCK, true)) return null;
    }
    if (allOver) return { done: t, x: m.x };
  }
  return null;
}

// Walk the pond from the start to yEnd. Returns { ok, bands: [...], fails: [...], clock } where clock is the
// earliest time a careful player is past yEnd if they always take the first crossing that works.
export function routeCheck(seed, { yEnd = 60, n = 6, wait = 15, step = 0.1 } = {}) {
  const s = create({ endless: true, seed });
  // grow the pond as if she swam up with a line of 4 (the generator places waiting ducklings by room left)
  while (s.top < yEnd + 2) { s.mom.y = s.top - 3; endlessAhead(s); }
  const delays = []; for (let i = 1; i <= n; i++) delays.push(i * GAP);
  const list = bands(s, 0.4, yEnd);
  let clock = 0, x = 0.5, y = 0.35; const fails = [], times = [];
  for (const b of list) {
    const ya = b.a - 0.01, yb = b.b + 0.01;
    const world = { hazards: b.hz, rocks: s.rocks.filter(r => r.y > ya - 0.2 && r.y < yb + 0.2), reeds: s.reeds.filter(r => r.y > ya - 0.2 && r.y < yb + 0.2), gusts: b.hz.filter(h => h.kind === 'gust'), nest: null };
    // swim to the band in free water
    clock += Math.max(0, ya - y) / SPEED;
    let found = null;
    const lanes = [...LANES].sort((p, q) => Math.abs(p - x) - Math.abs(q - x));
    for (let dt = 0; dt <= wait && !found; dt += step) for (const lx of lanes) {
      const t0 = clock + Math.abs(lx - x) / SPEED + dt;
      const r = cross(world, lx, ya, yb, t0, delays);
      if (r) { found = { ...r, wait: dt, lane: lx }; break; }
    }
    if (!found) { fails.push({ a: +b.a.toFixed(2), b: +b.b.toFixed(2), kinds: b.hz.map(h => h.kind).join('+') }); clock += wait; y = yb; continue; }
    times.push({ y: yb, at: found.done, wait: found.wait });
    clock = found.done; x = found.x; y = yb;
  }
  // time budget: does the clock stay ahead of dusk at every checkpoint with a line of n?
  let time = ENDLESS_TIME, dusk = null; const gain = checkGain(n);
  const cps = s.checkpoints.filter(c => c.y < yEnd);
  for (const c of cps) {
    const at = times.find(q => q.y >= c.y)?.at ?? clock; // first band cleared past the checkpoint: an upper bound
    const reached = at - Math.max(0, (times.find(q => q.y >= c.y)?.y ?? c.y) - c.y) / SPEED;
    // Integral of duskRate: ordinary seconds, then accelerating sunset after the opening.
    const spent = reached + Math.max(0, reached - DUSK_ONSET) * (duskRate(reached) - 1) / 2;
    if (spent > time && dusk === null) dusk = c.y;
    time += gain;
  }
  return { ok: fails.length === 0, fails, bands: list.length, clock, dusk, checkpoints: cps.length };
}
