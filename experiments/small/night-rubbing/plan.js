// A careful rubber, for the bots and for the daily plate's par. It reads only what the page shows a player: the
// embossed ridges and grit on the clean sheet (relief, stone) and whether the plate is glazed. It never reads pigment
// it has not laid. Pure: runs in Node and in the page.
import { rub } from './sim.js';

// Distance (in cells) from every cell to the nearest grit cell, two-pass chamfer.
function gritDistance(s) {
  const { width: W, height: H } = s, far = 1e6, d = new Float32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = s.stone[i] ? 0 : far;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
    if (y > 0) { d[i] = Math.min(d[i], d[i - W] + 1); if (x > 0) d[i] = Math.min(d[i], d[i - W - 1] + 1.4142); if (x < W - 1) d[i] = Math.min(d[i], d[i - W + 1] + 1.4142); }
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (x < W - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
    if (y < H - 1) { d[i] = Math.min(d[i], d[i + W] + 1); if (x < W - 1) d[i] = Math.min(d[i], d[i + W + 1] + 1.4142); if (x > 0) d[i] = Math.min(d[i], d[i + W - 1] + 1.4142); }
  }
  return d;
}

// Strokes that cover the specimen: rows (and, on a glazed plate, columns) spaced under the stick's width,
// each cut to where ridges are within reach, and broken wherever the stick would touch grit.
// options: glaze (cross-hatch both ways), avoid (keep clear of grit), trim (only where ridges are).
export function plan(s, { glaze = s.glaze, avoid = !!s.stone, trim = true, offset = 0 } = {}) {
  const { width: W, height: H, radius: r } = s;
  const near = avoid && s.stone ? gritDistance(s) : null;
  const clear = (x, y) => !near || near[Math.round(y) * W + Math.round(x)] > r + 1;
  const ridge = i => s.relief[i] >= 0.34 && !(s.stone && s.stone[i]);
  const box = s.box, spacing = r * 0.9, reach = r * 0.6;
  const strokes = [];
  const lines = (along, across) => {
    const [lo, hi] = along === 'x' ? [box.yMin, box.yMax] : [box.xMin, box.xMax];
    const [from, to] = along === 'x' ? [box.xMin, box.xMax] : [box.yMin, box.yMax];
    let flip = false;
    for (let c = lo + spacing * (0.35 + offset); c <= hi + spacing * 0.3; c += spacing) {
      // Where along this line are there ridges within reach?
      let first = Infinity, last = -Infinity;
      for (let t = 0; t < (along === 'x' ? W : H); t++) {
        for (let o = -reach; o <= reach; o += 2) {
          const x = along === 'x' ? t : Math.round(c + o), y = along === 'x' ? Math.round(c + o) : t;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (ridge(y * W + x)) { first = Math.min(first, t); last = Math.max(last, t); break; }
        }
      }
      if (!trim) { first = from; last = to; }
      if (first > last) continue;
      const a = Math.max(2, first - r * 0.4), b = Math.min((along === 'x' ? W : H) - 2, last + r * 0.4);
      // Break the line where the stick would touch grit.
      const runs = [];
      let start = null;
      for (let t = a; t <= b + 0.01; t += 2) {
        const ok = along === 'x' ? clear(t, c) : clear(c, t);
        if (ok && start === null) start = t;
        if ((!ok || t + 2 > b + 0.01) && start !== null) { const end = ok ? t : t - 2; if (end > start + 3) runs.push([start, end]); start = null; }
      }
      for (const [p, q] of runs) {
        const point = t => along === 'x' ? [t, c] : [c, t];
        if (across) { strokes.push([...point(p), ...point(q)], [...point(q), ...point(p)]); }
        else { strokes.push(flip ? [...point(q), ...point(p)] : [...point(p), ...point(q)]); flip = !flip; }
      }
    }
  };
  lines('x', glaze);
  if (glaze) lines('y', true);
  return strokes;
}

// Play strokes as a finger would: each one in short moves, lifting between strokes. Stops at filing or spoiling.
export function play(s, strokes, part = 10) {
  let count = 0;
  for (const [x0, y0, x1, y1] of strokes) {
    if (s.done || s.spoiled) break;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / part));
    let px = x0, py = y0;
    for (let k = 1; k <= n && !s.done && !s.spoiled; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      rub(s, px, py, x, y);
      px = x; py = y;
    }
    count++;
  }
  return count;
}

// The careful rubber: plan, and if the print is not filed yet, plan again between the first lines, up to three times.
export function careful(s, options = {}) {
  let strokes = 0;
  for (const offset of [0, 0.5, 0.25]) {
    if (s.done || s.spoiled) break;
    strokes += play(s, plan(s, { ...options, offset }));
  }
  return strokes;
}

// Par and stick length for a plate, from the careful rubber on that plate's own paper: par is a quarter more than
// the careful rubber needed, the stick twice as long. Both in sheet units, rounded up to tens.
const tens = n => Math.ceil(n / 10) * 10;
export function rate(spec, seed, make) {
  const s = make({ ...spec, lead: undefined, par: undefined, smudge: spec.smudge }, seed);
  careful(s);
  if (!s.done) return null;
  return { par: tens(s.filedAt * 1.25), lead: tens(s.filedAt * 2), careful: s.filedAt };
}
