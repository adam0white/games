// Extra repair rules. Each exposes the same pointer and guide interface as the bench's other repairs.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
const distance = (x, y, a, b) => Math.hypot(x - a, y - b);
const radians = a => a * Math.PI / 180;

export const REPAIR_META = {
  wind: { word: 'Wind!', object: 'winding drum', coin: 3, hit: 23 },
  balance: { word: 'Balance!', object: 'scale', coin: 3, hit: 24 },
  trace: { word: 'Seal it!', object: 'tile', coin: 3, hit: 22 },
};

const WIND_FIRST = 28;
const WIND_LAST = 152;
const WIND_LEGS = 4;
export const WIND_STOPS = [WIND_FIRST, WIND_LAST];
const windTarget = leg => leg % 2 === 0 ? WIND_LAST : WIND_FIRST;
export const crankPoint = (r, a = r.a) => [r.cx + r.radius * Math.cos(radians(a)), r.cy + r.radius * Math.sin(radians(a))];
const bearing = (r, x, y) => Math.atan2(y - r.cy, x - r.cx) * 180 / Math.PI;

export const SCALE_HOLD = 0.45;
export const SCALE_BAND = 6;
export const TRACE_OFFSET = 23;
const TRACE_RADIUS = 5;
const CRACKS = [
  [[13, 37], [25, 48], [39, 30], [53, 49], [66, 36], [78, 50], [86, 37]],
  [[13, 46], [25, 33], [37, 50], [50, 38], [62, 52], [74, 32], [86, 43]],
];

function samplePath(points) {
  const samples = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1], [a, b] = points[i];
    const n = Math.ceil(distance(x, y, a, b) / 4);
    for (let j = 1; j <= n; j++) samples.push([x + (a - x) * j / n, y + (b - y) * j / n]);
  }
  return samples;
}

const CRACK_SAMPLES = CRACKS.map(samplePath);

export const REPAIRS = {
  // Crank the drum's ratchet back and forth. Each sweep locks only at the far stop.
  wind: {
    make: () => ({ cx: 50, cy: 47, radius: 31, a: WIND_FIRST, leg: 0, last: null }),
    down(r, x, y) {
      if (distance(x, y, ...crankPoint(r)) > REPAIR_META.wind.hit) return false;
      r.grab = true;
      r.last = bearing(r, x, y);
      return true;
    },
    move(r, x, y, s) {
      if (!r.grab) return;
      const d = distance(x, y, r.cx, r.cy);
      if (d < 12 || d > 55) { r.last = null; return; }
      const a = bearing(r, x, y);
      if (r.last === null) { r.last = a; return; }
      const delta = ((a - r.last + 540) % 360) - 180;
      r.last = a;
      r.a = clamp(r.a + clamp(delta, -42, 42), WIND_FIRST, WIND_LAST);
      if (Math.abs(r.a - windTarget(r.leg)) <= 5) {
        r.a = windTarget(r.leg++);
        s.events.push({ e: 'wind', n: r.leg });
      }
      const start = windTarget(r.leg + 1);
      r.p = Math.min(1, (r.leg + Math.abs(r.a - start) / (WIND_LAST - WIND_FIRST)) / WIND_LEGS);
    },
    up(r) { r.grab = false; },
    tick() {},
    guide: r => ({
      type: 'wind', cx: r.cx, cy: r.cy, r: r.radius, from: r.a,
      targets: Array.from({ length: WIND_LEGS - r.leg }, (_, j) => windTarget(r.leg + j)),
    }),
  },

  // Load three weights and balance the beam after each one. The thumb moves a slider under the beam.
  balance: {
    make: s => {
      const loads = (s.r >>> 3) % 2 ? [24, 78, 33] : [76, 22, 67];
      return { loads, stage: 0, handle: 50, want: 50, offset: 0, tilt: Math.atan((50 - loads[0]) / 48), dwell: 0, y: 78 };
    },
    down(r, x, y) {
      if (distance(x, y, r.handle, r.y) > REPAIR_META.balance.hit) return false;
      r.grab = true;
      r.offset = x - r.handle;
      r.want = r.handle;
      return true;
    },
    move(r, x) { if (r.grab) r.want = clamp(x - r.offset, 12, 88); },
    up(r) { r.grab = false; },
    tick(r, dt, s) {
      const want = r.grab ? r.want : r.handle;
      r.handle += clamp(want - r.handle, -140 * dt, 140 * dt);
      const error = r.handle - r.loads[r.stage];
      const tilt = Math.atan(error / 48);
      r.tilt += (tilt - r.tilt) * (1 - Math.exp(-20 * dt));
      const centered = Math.abs(error) <= SCALE_BAND && Math.abs(r.tilt) <= 0.13;
      r.dwell = centered && r.grab ? r.dwell + dt : Math.max(0, r.dwell - 2 * dt);
      if (r.dwell >= SCALE_HOLD) {
        r.stage++;
        r.dwell = 0;
        s.events.push({ e: 'tick', n: r.stage });
      }
      r.p = (r.stage + r.dwell / SCALE_HOLD) / r.loads.length;
    },
    guide: r => ({ type: 'balance', from: [r.handle, r.y], targets: r.loads.slice(r.stage), hold: SCALE_HOLD, rate: 140 }),
  },

  // Lay a bead along the crack. Each next sample must be crossed in sequence, with the tip above the thumb.
  trace: {
    make: s => {
      const k = (s.r >>> 4) % CRACKS.length;
      const pts = CRACKS[k], samples = CRACK_SAMPLES[k], [tx, ty] = pts[0];
      return { pts, samples, next: 1, tx, ty };
    },
    down(r, x, y) {
      const [a, b] = r.samples[r.next - 1];
      if (distance(x, y, a, b + TRACE_OFFSET) > REPAIR_META.trace.hit) return false;
      r.grab = true;
      r.tx = x;
      r.ty = y - TRACE_OFFSET;
      return true;
    },
    move(r, x, y, s) {
      if (!r.grab) return;
      y -= TRACE_OFFSET;
      const dx = x - r.tx, dy = y - r.ty, d2 = dx * dx + dy * dy;
      let t0 = 0;
      // Follow the swept pointer segment, so touch event batching cannot drop a well-aimed bead.
      while (d2 && r.next < r.samples.length) {
        const [a, b] = r.samples[r.next];
        const t = clamp(((a - r.tx) * dx + (b - r.ty) * dy) / d2, t0, 1);
        if (distance(a, b, r.tx + t * dx, r.ty + t * dy) > TRACE_RADIUS) break;
        t0 = t;
        r.next++;
        if (r.next % 4 === 0) s.events.push({ e: 'stitch', n: r.next / 4 });
      }
      r.tx = x;
      r.ty = y;
      r.p = (r.next - 1) / (r.samples.length - 1);
    },
    up(r) {
      r.grab = false;
      [r.tx, r.ty] = r.samples[r.next - 1];
    },
    tick() {},
    guide: r => ({ type: 'path', pts: r.samples.slice(r.next - 1).map(([x, y]) => [x, y + TRACE_OFFSET]), trace: true }),
  },
};
