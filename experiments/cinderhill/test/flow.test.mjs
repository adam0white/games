// Flow fields against a plain breadth-first search written here, separately, on tiny maps with walls,
// a diagonal corner and an entrance link. Also: following the field takes exactly the shortest number of
// steps, each to an open 4-neighbour or through the link; and a field updated after terrain changes equals
// one built from scratch.
import assert from 'node:assert/strict';
import test from 'node:test';
import { GOAL, MAT, NEST, SURFACE, SLOT, Sim } from '../sim/sim.js';
import { INF, nextCell, setGoal, distAt } from '../sim/flow.js';
import { cellAt } from '../sim/grid.js';

// Reference: its own grid walk from (layer, x, y) coordinates, its own queue, no shared tables.
function referenceBfs(s, goalCells) {
  const W = { [SURFACE]: s.cfg.sw, [NEST]: s.cfg.nw }, H = { [SURFACE]: s.cfg.sh, [NEST]: s.cfg.nh };
  const key = (l, x, y) => `${l},${x},${y}`, open = (l, x, y) => x >= 0 && y >= 0 && x < W[l] && y < H[l] && s.mat[cellAt(s.L, l, x, y)] === MAT.OPEN;
  const links = new Map();
  for (let c = 0; c < s.L.n; c++) if (s.link[c] >= 0) { const [l, x, y] = coord(s, c), [l2, x2, y2] = coord(s, s.link[c]); links.set(key(l, x, y), [l2, x2, y2]); }
  const dist = new Map(), todo = [];
  for (const c of goalCells) { const p = coord(s, c); if (open(...p)) { dist.set(key(...p), 0); todo.push(p); } }
  while (todo.length) {
    const [l, x, y] = todo.shift(), d = dist.get(key(l, x, y));
    const nbs = [[l, x, y - 1], [l, x + 1, y], [l, x, y + 1], [l, x - 1, y]];
    if (links.has(key(l, x, y))) nbs.push(links.get(key(l, x, y)));
    for (const p of nbs) if (open(...p) && !dist.has(key(...p))) { dist.set(key(...p), d + 1); todo.push(p); }
  }
  return (c) => dist.get(key(...coord(s, c))) ?? INF;
}
function coord(s, c) {
  if (c >= s.L.nestBase) { const i = c - s.L.nestBase; return [NEST, i % s.cfg.nw, Math.floor(i / s.cfg.nw)]; }
  return [SURFACE, c % s.cfg.sw, Math.floor(c / s.cfg.sw)];
}

function tinyMap(seed) {
  const s = new Sim({ seed, sw: 12, sh: 10, nw: 8, nh: 6, ants: 0, blank: true });
  let r = seed * 7919;
  const rand = n => { r = (r * 1103515245 + 12345) % 2147483648; return r % n; };
  for (let k = 0; k < 30; k++) s.mat[rand(s.L.nestBase)] = MAT.STONE;
  for (let k = 0; k < 20; k++) s.mat[s.L.nestBase + rand(s.L.n - s.L.nestBase)] = MAT.OPEN; // a few nest pockets
  // The diagonal corner: two stones touching at a corner; a path may not squeeze between them.
  s.mat[cellAt(s.L, SURFACE, 5, 5)] = MAT.STONE; s.mat[cellAt(s.L, SURFACE, 6, 6)] = MAT.STONE;
  s.mat[cellAt(s.L, SURFACE, 5, 6)] = MAT.OPEN; s.mat[cellAt(s.L, SURFACE, 6, 5)] = MAT.OPEN;
  // An entrance from surface (2, 2) to nest (3, 0), with a nest tunnel down from it.
  const a = cellAt(s.L, SURFACE, 2, 2), b = cellAt(s.L, NEST, 3, 0);
  s.mat[a] = MAT.OPEN; s.link[a] = b; s.link[b] = a;
  for (let y = 0; y < 6; y++) s.mat[cellAt(s.L, NEST, 3, y)] = MAT.OPEN;
  for (let x = 0; x < 8; x++) s.mat[cellAt(s.L, NEST, x, 4)] = MAT.OPEN;
  return s;
}

function check(s, slot, goalCells) {
  const ref = referenceBfs(s, goalCells);
  let reached = 0;
  for (let c = 0; c < s.L.n; c++) {
    const want = ref(c), got = distAt(s, slot, c);
    assert.equal(got, want, `cell ${coord(s, c)}: field ${got}, reference ${want}`);
    if (want === INF || want === 0) continue;
    reached++;
    // Walk the field: every step goes to an open 4-neighbour or through the link, and the walk is shortest.
    let at = c, steps = 0;
    while (distAt(s, slot, at) > 0) {
      const to = nextCell(s, slot, at), [l1, x1, y1] = coord(s, at), [l2, x2, y2] = coord(s, to);
      assert.ok(to >= 0, 'a reachable cell has a next step');
      assert.equal(s.mat[to], MAT.OPEN);
      assert.ok(s.link[at] === to || (l1 === l2 && Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1), `step ${[l1, x1, y1]} to ${[l2, x2, y2]}`);
      at = to; steps++;
    }
    assert.equal(steps, want, `walk from ${coord(s, c)}`);
  }
  return reached;
}

for (const seed of [1, 2, 3, 4, 5, 6]) {
  test(`tiny map ${seed}: field equals the reference, walks are shortest`, () => {
    const s = tinyMap(seed);
    const goal = cellAt(s.L, NEST, 7, 4); // in the nest: paths from the surface go through the link
    setGoal(s, SLOT.ALARM, GOAL.ALARM, goal);
    s.rebuildFields();
    const reached = check(s, SLOT.ALARM, [goal]);
    assert.ok(reached > 20, `reached ${reached} cells`);
    assert.equal(distAt(s, SLOT.ALARM, cellAt(s.L, SURFACE, 2, 2)), distAt(s, SLOT.ALARM, cellAt(s.L, NEST, 3, 0)) + 1, 'the link costs one step');
  });
}

test('after terrain changes, the updated fields equal fresh searches', () => {
  const s = tinyMap(9);
  const goals = [[SLOT.ALARM, cellAt(s.L, NEST, 7, 4)], [SLOT.FOOD0, cellAt(s.L, SURFACE, 11, 9)], [SLOT.FOOD0 + 1, cellAt(s.L, SURFACE, 0, 0)]];
  for (const [slot, c] of goals) { s.mat[c] = MAT.OPEN; setGoal(s, slot, GOAL.FOOD, c); }
  s.rebuildFields();
  let r = 99, rebuilt = 0;
  for (let k = 0; k < 200; k++) {
    r = (r * 48271) % 2147483647;
    const c = r % s.L.n;
    if (goals.some(([, g]) => g === c) || s.link[c] >= 0) continue;
    s.setCell(c, s.mat[c] === MAT.OPEN ? MAT.STONE : MAT.OPEN);
    const before = s.flow.rebuilds;
    s.rebuildFields();
    rebuilt += s.flow.rebuilds - before;
    for (const [slot, g] of goals) check(s, slot, [g]);
  }
  assert.ok(rebuilt < 3 * 200, `only touched fields rebuild (${rebuilt} rebuilds for 200 changes)`);
  assert.ok(s.flow.repairs > 20, `openings were repaired in place, not rebuilt (${s.flow.repairs} repairs)`);
});

test('a change far from a field does not rebuild it', () => {
  const s = new Sim({ seed: 1, sw: 40, sh: 10, nw: 8, nh: 6, ants: 0, blank: true });
  for (let y = 0; y < 10; y++) s.mat[cellAt(s.L, SURFACE, 20, y)] = MAT.STONE; // two closed halves
  setGoal(s, SLOT.ALARM, GOAL.ALARM, cellAt(s.L, SURFACE, 2, 2));
  s.rebuildFields();
  const before = s.flow.rebuilds;
  s.setCell(cellAt(s.L, SURFACE, 35, 5), MAT.STONE);
  s.rebuildFields();
  assert.equal(s.flow.rebuilds, before, 'the far half is not in the field');
  s.setCell(cellAt(s.L, SURFACE, 5, 5), MAT.STONE);
  s.rebuildFields();
  assert.equal(s.flow.rebuilds, before + 1);
});
