// Finger paths for each repair, made from the repair's guide (sim.js `guide`). bots.mjs feeds them to the
// sim one step per tick; check.mjs turns them into real pointer events, one step per frame. The ghost finger
// on the page follows the same shapes. A step is { type: 'down' | 'move' | 'up', x, y } or null (the finger
// waits, or travels in the air). Speeds are in local units per second; 100 units are about 300 to 360 px.
import { DT } from './sim.js';

// Skill levels, capped at what a thumb can do: speed is a steady drag, flick a quick throw, react the pause
// before a new job starts, tapGap the shortest time between two taps.
export const SKILLS = {
  slow: { speed: 90, flick: 180, react: 1.6, tapGap: 0.5 },
  average: { speed: 210, flick: 400, react: 0.8, tapGap: 0.3 },
  competent: { speed: 320, flick: 600, react: 0.5, tapGap: 0.22 },
  expert: { speed: 420, flick: 800, react: 0.35, tapGap: 0.17 },
};
export const THUMB_MAX = 820; // no plan moves faster than this many units a second

const rad = d => d * Math.PI / 180;
const wait = sec => Array(Math.max(0, Math.round(sec / DT))).fill(null);
function line(a, b, speed) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / (Math.min(speed, THUMB_MAX) * DT))), out = [];
  for (let i = 1; i <= n; i++) out.push({ type: 'move', x: a[0] + (b[0] - a[0]) * i / n, y: a[1] + (b[1] - a[1]) * i / n });
  return out;
}
function arc(cx, cy, r, a0, a1, speed) {
  const len = Math.abs(rad(a1 - a0)) * r, n = Math.max(1, Math.ceil(len / (Math.min(speed, THUMB_MAX) * DT))), out = [];
  for (let i = 1; i <= n; i++) { const a = rad(a0 + (a1 - a0) * i / n); out.push({ type: 'move', x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return out;
}
const at = (type, p) => ({ type, x: p[0], y: p[1] });
const onArc = (cx, cy, r, a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];

// One attempt at the job, from the finger's resting place `from`. A runner plays it, then asks again if the job is not done.
// `lead` is how many seconds pass between reading the guide and starting the plan (a reaction pause), for timed jobs.
export function plan(g, skill, from = [50, 110], lead = 0) {
  const v = skill.speed, air = p => wait(Math.hypot(p[0] - from[0], p[1] - from[1]) / v);
  switch (g.type) {
    case 'circle': {
      const p0 = onArc(g.cx, g.cy, g.r, 0);
      return [...air(p0), at('down', p0), ...arc(g.cx, g.cy, g.r, 0, 3.25 * 360, v), at('up', p0)];
    }
    case 'drag': {
      const out = [...air(g.from), at('down', g.from), ...line(g.from, g.to, v)];
      if (g.hold) for (let i = 0; i < (typeof g.hold === 'number' ? g.hold : 1.4) / DT; i++) out.push(at('move', g.to));
      out.push(at('up', g.to));
      return out;
    }
    case 'tap': {
      const out = []; let p = from;
      for (const t of g.all) {
        const travel = Math.max(Math.hypot(t[0] - p[0], t[1] - p[1]) / v, skill.tapGap - DT);
        out.push(...wait(travel), at('down', t), at('up', t));
        p = t;
      }
      return out;
    }
    case 'flick': {
      const out = []; let a = 200;
      for (let i = 0; i < 5; i++) {
        const p0 = onArc(g.cx, g.cy, g.r, a);
        out.push(...(i ? wait(Math.hypot(p0[0] - from[0], p0[1] - from[1]) / v) : air(p0)), at('down', p0), ...arc(g.cx, g.cy, g.r, a, a + 150, skill.flick), at('up', onArc(g.cx, g.cy, g.r, a + 150)));
        from = onArc(g.cx, g.cy, g.r, a + 150);
      }
      return out;
    }
    case 'rub': {
      const l = [g.cx - g.w / 2, g.cy], r = [g.cx + g.w / 2, g.cy], out = [...air(l), at('down', l)];
      for (let i = 0; i < 40; i++) out.push(...line(i % 2 ? r : l, i % 2 ? l : r, v));
      out.push(at('up', l));
      return out;
    }
    case 'arc': {
      const p0 = onArc(g.cx, g.cy, g.r, g.from);
      return [...air(p0), at('down', p0), ...arc(g.cx, g.cy, g.r, g.from, g.to + 15, v), ...wait(0.6).map(() => at('move', onArc(g.cx, g.cy, g.r, g.to + 15))), at('up', onArc(g.cx, g.cy, g.r, g.to + 15))];
    }
    case 'path': { // follow a polyline, then keep the finger at its end while the part catches up
      const out = [...air(g.pts[0]), at('down', g.pts[0])];
      for (let i = 1; i < g.pts.length; i++) out.push(...line(g.pts[i - 1], g.pts[i], v));
      const end = g.pts.at(-1);
      for (let i = 0; i < (g.hold ?? 0) / DT; i++) out.push(at('move', end));
      out.push(at('up', end));
      return out;
    }
    case 'pump': { // push the handle to the bottom, wait for it, pull it back up; as many times as are left
      const top = [g.x, g.at[1]], low = [g.x, g.at[1] + (g.bottom - g.top)], out = [...air(top), at('down', top)];
      for (let i = 0; i < g.n + 1; i++) {
        const hold = Math.max(0.04, (g.bottom - g.top - 4) / g.rate - (g.bottom - g.top) / Math.min(v, THUMB_MAX) + 0.04); // wait at the bottom until the handle gets there
        out.push(...line(top, low, v), ...Array(Math.round(hold / DT)).fill(0).map(() => at('move', low)));
        out.push(...line(low, top, v), at('move', top), at('move', top));
      }
      out.push(at('up', top));
      return out;
    }
    case 'timing': { // one tap on the middle of the next open swing (a runner plans again for the next drop)
      let t = g.mid - lead;
      const travel = Math.hypot(g.at[0] - from[0], g.at[1] - from[1]) / v;
      while (t < travel) t += g.period;
      return [...wait(t), at('down', g.at), at('up', g.at)];
    }
    case 'zip': { // drag the tab up; at each snag, stop and wiggle side to side, then go on
      const up = Math.min(v, g.rate - 10), out = [...air(g.at), at('down', g.at)];
      let p = g.at;
      for (const y of [...g.snags, g.top]) {
        const q = [g.at[0], y];
        out.push(...line(p, q, up), ...wait(2 * DT).map(() => at('move', q)));
        p = q;
        if (y === g.top) break;
        for (const dx of [7, -7, 7, -7, 0]) { const w = [g.at[0] + dx, y]; out.push(...line(p, w, Math.min(v, 160))); p = w; }
      }
      out.push(at('up', p));
      return out;
    }
    case 'swipe': {
      const out = [...air(g.from), at('down', g.from)];
      for (let i = 0; i < 10; i++) out.push(...line(i % 2 ? g.to : g.from, i % 2 ? g.from : g.to, v));
      out.push(at('up', g.from));
      return out;
    }
  }
  return [];
}

// The ghost finger: where it is at time t (seconds) for a guide, and whether it is pressing. One loop is about 1.6 s.
export function ghost(g, t) {
  const loop = 1.8, k = (t % loop) / loop;
  const ease = x => x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
  switch (g.type) {
    case 'circle': { const a = k * 720; return { p: onArc(g.cx, g.cy, g.r, a), press: k < 0.92, trail: 'circle' }; }
    case 'drag': { const m = ease(Math.min(1, k / 0.65)); return { p: [g.from[0] + (g.to[0] - g.from[0]) * m, g.from[1] + (g.to[1] - g.from[1]) * m], press: k > 0.05 && k < 0.92 }; }
    case 'tap': { return { p: g.at, press: k % 0.5 < 0.18, tap: true }; }
    case 'flick': { const m = ease(Math.min(1, (k % 0.5) / 0.3)); return { p: onArc(g.cx, g.cy, g.r, 200 + 150 * m), press: (k % 0.5) < 0.3 }; }
    case 'rub': { const m = Math.sin(k * Math.PI * 6); return { p: [g.cx + m * g.w / 2, g.cy], press: k < 0.92 }; }
    case 'arc': { const m = ease(Math.min(1, k / 0.75)); return { p: onArc(g.cx, g.cy, g.r, g.from + (g.to - g.from) * m), press: k < 0.85 }; }
    case 'path': { // along the polyline at an even pace
      const L = []; let tot = 0; for (let i = 1; i < g.pts.length; i++) { L.push(Math.hypot(g.pts[i][0] - g.pts[i - 1][0], g.pts[i][1] - g.pts[i - 1][1])); tot += L.at(-1); }
      let d = Math.min(1, k / 0.8) * tot, i = 0; while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
      const a = g.pts[i], b = g.pts[Math.min(i + 1, g.pts.length - 1)], f = L[i] ? Math.min(1, d / L[i]) : 0;
      return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], press: k < 0.9 };
    }
    case 'pump': { const m = Math.sin(k * Math.PI * 4 - Math.PI / 2) * 0.5 + 0.5; return { p: [g.x, g.top + 6 + m * (g.bottom - g.top)], press: true }; }
    case 'timing': return { p: g.at, press: g.open >= 0.6, tap: true };
    case 'zip': { // up to the first snag, a wiggle there, then on up
      const y1 = g.snags.length ? g.snags[0] : g.top;
      if (g.stuck) return { p: [g.at[0] + 7 * Math.sin(k * Math.PI * 8), g.at[1]], press: k < 0.92 };
      const m = ease(Math.min(1, k / 0.7)); return { p: [g.at[0], g.at[1] + (y1 - g.at[1]) * m], press: k < 0.92 };
    }
    case 'swipe': { const m = ease((k * 2) % 1), back = Math.floor(k * 2) % 2; const x = back ? g.to[0] + (g.from[0] - g.to[0]) * m : g.from[0] + (g.to[0] - g.from[0]) * m; return { p: [x, g.from[1]], press: true }; }
  }
  return { p: [50, 50], press: false };
}
