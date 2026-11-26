// Trail shape: do ants walk a trail as it was drawn? A small open world with one entrance and one food pile
// at the far end of a bent stroke. Every tick, each forager travelling on the surface (outbound on the
// trail, or homeward with food) is measured: her deviation is the number of 4-connected steps from her
// cell to the nearest cell of the drawn stroke (its Bresenham cells, computed here, not by the sim). Also
// counted: round trips (food stored), and whether each loaded ant passed every corner of the stroke on her
// way, in order.
//
// Usage: node trail-shape.mjs [sim dir] (default ../sim; pass another copy of sim/ to compare versions).
// test/trail.test.mjs runs the same cases with pass lines.
import { fileURLToPath } from 'node:url';

const W = 96, ENTRANCE = [48, 48];
// Strokes start at the entrance (02-spec 6.4: a trail is drawn from the nest).
export const CASES = {
  // East 30, then north 33: the straight line to the end cuts the corner by about 22 cells.
  dogleg: { points: [49, 49, 80, 49, 80, 16], stones: [] },
  // North, east, then back south: the end is 22 cells from the start, the stroke 90 long.
  ushape: { points: [49, 49, 49, 15, 72, 15, 72, 45], stones: [] },
  // A tight U: arms three cells apart. A shortcut between the arms would show as skipped corners.
  tightU: { points: [49, 49, 49, 20, 52, 20, 52, 45], stones: [] },
  // A stroke that crosses itself: the loop is cut out of the path (sim.js trailPath), so ants skip it;
  // its corners are not checked (corners: 0).
  crossing: { points: [49, 49, 70, 49, 70, 35, 60, 35, 60, 70], stones: [], corners: 0 },
  // The dog-leg with a stone across its first leg: the path must go round it, close by.
  stone: { points: [49, 49, 80, 49, 80, 16], stones: [[64, 49, 3]] },
};

export async function trailShape(name, { simDir = '../sim/', ants = 200, ticks = 6000 } = {}) {
  const base = new URL(simDir.endsWith('/') ? simDir : simDir + '/', import.meta.url);
  const { Sim, CMD, JOB, MODE, MAT, NEST, SURFACE, SLOT, G, line } = await import(new URL('sim.js', base));
  const { cellAt } = await import(new URL('grid.js', base));
  const { rebuildDirty } = await import(new URL('flow.js', base));
  const { points, stones, corners: checkCorners = 99 } = CASES[name];
  const s = new Sim({ seed: 7, sw: W, sh: W, nw: 32, nh: 24, ants: 0, blank: true });
  const L = s.L, surf = (x, y) => cellAt(L, SURFACE, x, y), nest = (x, y) => cellAt(L, NEST, x, y);
  for (const [cx, cy, r] of stones) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) s.mat[surf(x, y)] = MAT.STONE;
  // Nest: a shaft from the top down to a home room; two entrance links, as world.js makes them.
  for (let y = 0; y < 10; y++) for (const x of [16, 17]) s.mat[nest(x, y)] = MAT.OPEN;
  for (let y = 10; y < 14; y++) for (let x = 8; x < 24; x++) s.mat[nest(x, y)] = MAT.OPEN;
  s.home = { x: 8, y: 10, w: 16, h: 4 };
  for (let k = 0; k < 2; k++) { const a = surf(ENTRANCE[0] + k, ENTRANCE[1]), b = nest(16 + k, 0); s.link[a] = b; s.link[b] = a; }
  const px = points[points.length - 2], py = points[points.length - 1];
  s.pileCell[0] = surf(px, py); s.pileAmount[0] = 1 << 20;
  s.startGoals();
  for (let i = 0; i < ants; i++) s.spawn(JOB.FORAGE);
  rebuildDirty(s);
  s.queueCommand({ tick: 1, seat: 0, id: 1, type: CMD.TRAIL, layer: SURFACE, points });

  // Deviation reference: steps from each surface cell to the nearest drawn stroke cell (open cells only).
  const n0 = L.nestBase, dev = new Int32Array(n0).fill(-1), q = [];
  for (let k = 0; k + 3 < points.length; k += 2) line(points[k], points[k + 1], points[k + 2], points[k + 3], (x, y) => { const c = surf(x, y); if (dev[c] < 0) { dev[c] = 0; q.push(c); } });
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const m = surf(x + dx, y + dy);
      if (m >= 0 && dev[m] < 0) { dev[m] = dev[c] + 1; q.push(m); }
    }
  }
  // Corners in stroke order (the inner points); a loaded ant must have passed within 3 cells of each, in order.
  const corners = [];
  for (let k = 2; k + 2 < points.length && corners.length < checkCorners; k += 2) corners.push([points[k], points[k + 1]]);
  const passed = new Int8Array(ants), wasCarry = new Uint8Array(ants), trips = new Int32Array(ants);
  let inOrder = 0, loaded = 0;
  const out = { n: 0, sum: 0, max: 0 }, home = { n: 0, sum: 0, max: 0 };
  const isTrail = g => g >= SLOT.TRAIL0 && g < SLOT.TRAIL0 + SLOT.TRAILS;
  for (let t = 0; t < ticks; t++) {
    s.step();
    for (let i = 0; i < s.n; i++) {
      if (s.layer[i] !== SURFACE) { if (!s.carry[i]) passed[i] = 0; } else {
        const c = s.cellOfAnt(i), x = s.x[i] >> 8, y = s.y[i] >> 8, d = dev[c];
        const outbound = s.mode[i] === MODE.SEEK && isTrail(s.goal[i]), homeward = s.mode[i] === MODE.RETURN && s.carry[i];
        if (outbound || homeward) { const m = homeward ? home : out; m.n++; m.sum += d; if (d > m.max) m.max = d; }
        if (s.mode[i] === MODE.SEEK && passed[i] < corners.length) {
          const [cx, cy] = corners[passed[i]];
          if (Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 3) passed[i]++;
        }
      }
      if (s.carry[i] && !wasCarry[i]) { loaded++; if (passed[i] === corners.length) inOrder++; passed[i] = 0; }
      if (!s.carry[i] && wasCarry[i]) trips[i]++;
      wasCarry[i] = s.carry[i];
    }
  }
  let two = 0;
  for (let i = 0; i < ants; i++) if (trips[i] >= 2) two++;
  const r = m => ({ samples: m.n, mean: m.n ? m.sum / m.n : 0, max: m.max });
  return { name, outbound: r(out), homeward: r(home), stores: s.g[G.STORES], antsWith2Trips: two, ants, loads: loaded, loadsPastCornersInOrder: inOrder, hash: s.hashes().total };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const simDir = process.argv[2] ?? '../sim/';
  for (const name of Object.keys(CASES)) {
    const t0 = performance.now(), r = await trailShape(name, { simDir });
    const f = m => `mean ${m.mean.toFixed(2)}, max ${m.max} (${m.samples} samples)`;
    console.log(`${name}: outbound ${f(r.outbound)}; homeward ${f(r.homeward)}; stores ${r.stores}; ants with 2+ round trips ${r.antsWith2Trips}/${r.ants}; loads past every corner in order ${r.loadsPastCornersInOrder}/${r.loads}; ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
}
