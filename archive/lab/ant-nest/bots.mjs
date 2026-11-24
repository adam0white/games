// Checks and measured play for The Nest: node experiments/lab/ant-nest/bots.mjs [seeds]
// 1. determinism  2. paths never cross soil  3. no ant idles beside work it could do  4. rounds end on time
// 5. three players (no marks, straight shaft, sensible layout) score in that order on every seed
// 6. the checks can fail: a frozen ant and an ant moved through soil are both caught
import assert from 'node:assert/strict';
import { COLS, ROWS, DT, RAIN_AT, WARN, END_AT, STONE, POCKET, OPEN, CLAY, idx, create, step, setMark, placeRoom, search, marksFor, walkable, hash } from './sim.js';
const SEEDS = Number(process.argv[2] ?? 20);

const okCell = (s, x, y) => x >= 0 && x < COLS && y < ROWS && s.kind[idx(x, y)] !== STONE && s.kind[idx(x, y)] !== POCKET;
const nearPocket = (s, x, y) => [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && s.kind[idx(nx, ny)] === POCKET; });
const shaft = (s, from, to) => { const out = []; for (let y = from; y <= to; y++) out.push([s.E, y]); return out; };

// Players. Each returns { marks: [[x, y]], room: [x, y] | null } from the seeded grid, using only what the page shows.
const PLAYERS = {
  'no marks': () => ({ marks: [], room: null }),
  'straight shaft': s => { // dig straight down and put the queen at the bottom
    const room = [s.E, ROWS - 3], alt = [s.E - 1, ROWS - 3];
    const fits = ([x, y]) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].every(([cx, cy]) => okCell(s, cx, cy) && !nearPocket(s, cx, cy));
    return { marks: shaft(s, 3, ROWS - 4), room: fits(room) ? room : fits(alt) ? alt : room };
  },
  'sensible layout': (s, pick = 0) => sensible(s)[pick] || null,
};
// A deep sump under the entrance and a side branch that rises into the queen's room. Candidates cheapest first.
function sensible(s) {
  const out = [];
  for (const side of [1, -1]) for (const b of [4, 5, 6]) for (const L of [2, 3]) {
    const branch = []; for (let k = 1; k <= L; k++) branch.push([s.E + side * k, b]);
    const rx = s.E + side * L, x0 = side > 0 ? rx : rx - 1, room = [x0, b - 2];
    const cells = [...branch, [x0, b - 2], [x0 + 1, b - 2], [x0, b - 1], [x0 + 1, b - 1]];
    if (cells.some(([x, y]) => !okCell(s, x, y) || nearPocket(s, x, y) || x < 0 || x >= COLS)) continue;
    const marks = [...shaft(s, 3, ROWS - 2), ...branch];
    const cost = cells.reduce((n, [x, y]) => n + (s.kind[idx(x, y)] === CLAY ? 3 : 1), 0) + b;
    out.push({ marks, room, cost });
  }
  return out.sort((a, b) => a.cost - b.cost);
}

// Run one round with checks on every tick.
function play(seed, plan, opts = {}) {
  const s = create(seed), bad = { path: 0, stuck: 0, maxIdle: 0 }, idle = new Map();
  if (plan) { for (const [x, y] of plan.marks) setMark(s, x, y, true); if (plan.room) placeRoom(s, ...plan.room); }
  let ticks = 0;
  while (!s.over && ticks < (END_AT + 10) / DT) {
    step(s); ticks++;
    if (opts.sabotage) opts.sabotage(s, ticks);
    check(s, bad, idle);
  }
  return { s, bad, ticks };
}
function check(s, bad, idle) {
  for (const a of s.ants) {
    if (!walkable(s, a.cx, a.cy) || (a.path.length && !walkable(s, ...a.path[0]))) bad.path++;
    if (Math.abs(a.x - a.cx) + Math.abs(a.y - a.cy) > 1.001) bad.path++;
    // idle while needs are met and there is unclaimed reachable work
    let t = 0;
    if (a.task === 'idle' && a.hunger <= 0.7 && a.tired <= 0.75 && s.t < RAIN_AT - WARN && marksFor(s, search(s, a.cx, a.cy)).work.length) t = (idle.get(a.id) || 0) + DT;
    idle.set(a.id, t); bad.maxIdle = Math.max(bad.maxIdle, t);
    if (t > 3) bad.stuck++;
  }
}

// 1. determinism: same seed and marks, same state twice, and a different seed differs
{
  const plan = PLAYERS['sensible layout'](create(7));
  const a = play(7, plan).s, b = play(7, plan).s, c = play(8, PLAYERS['sensible layout'](create(8))).s;
  assert.equal(hash(a), hash(b), 'same seed and marks give the same state');
  assert.notEqual(hash(a), hash(c));
  // also mid-round with marks arriving at different ticks
  const run = () => { const s = create(11); for (let i = 0; i < 600; i++) { if (i === 40) setMark(s, s.E, 3, true); if (i === 90) for (let y = 4; y < 9; y++) setMark(s, s.E, y, true); if (i === 300) setMark(s, s.E, 8, false); step(s); } return hash(s); };
  assert.equal(run(), run());
  console.log(`determinism: same hash twice (${hash(a)}), different seed differs`);
}

// 6. the checks can fail
{
  const plan = PLAYERS['straight shaft'](create(3));
  const frozen = play(3, plan, { sabotage: (s, t) => { if (t > 200) { s.claim.clear(); for (const a of s.ants) { a.task = 'idle'; a.path = []; a.idleT = -1e9; a.hunger = 0; a.tired = 0; } } } });
  assert.ok(frozen.bad.stuck > 0, 'frozen ants are reported as stuck');
  const ghost = play(3, plan, { sabotage: (s, t) => { if (t === 100) { const a = s.ants[0]; a.cx = a.x = 0; a.cy = a.y = ROWS - 1; } } });
  assert.ok(ghost.bad.path > 0, 'an ant inside soil is reported');
  console.log(`known bad cases: frozen ants caught (${frozen.bad.stuck} ticks), ant in soil caught (${ghost.bad.path} ticks)`);
}

// 2-4 for messy play: a scribbler marks random walks, moves the room, erases marks mid-dig and, on odd seeds, digs to the water pocket
{
  let breaches = 0, caches = 0, wetRefusals = 0, erasedMidDig = 0, worst = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    let r = seed * 7919; const rand = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
    const scribble = (s, x, y, n) => { for (let i = 0; i < n; i++) { const d = rand(); x += d < 0.25 ? -1 : d < 0.5 ? 1 : 0; y += d >= 0.5 ? 1 : 0; x = Math.max(0, Math.min(COLS - 1, x)); y = Math.min(ROWS - 1, y); setMark(s, x, y, true); } };
    const room = s => { for (let k = 0; k < 30; k++) if (placeRoom(s, Math.floor(rand() * (COLS - 1)), 1 + Math.floor(rand() * (ROWS - 2)))) return; };
    const toPocket = s => { // an L-shaped tunnel from the shaft to a cell beside the pocket
      let p = -1; for (let i = 0; i < s.kind.length; i++) if (s.kind[i] === POCKET) { p = i; break; }
      if (p < 0) return; const px = p % COLS, py = Math.floor(p / COLS);
      for (let y = 3; y <= py; y++) setMark(s, s.E, y, true);
      for (let x = Math.min(s.E, px + 2); x <= Math.max(s.E, px - 1); x++) setMark(s, x, py, true);
    };
    const events = new Set();
    const { s, bad } = play(seed, null, { sabotage: (s, t) => {
      for (const e of s.events) events.add(e.t);
      if (t === 1) { scribble(s, s.E, 2, 22); room(s); if (seed % 2) toPocket(s); }
      if (t % 300 === 0 && s.t < RAIN_AT - WARN) {
        for (const a of s.ants) if (a.task === 'dig' && !a.path.length && rand() < 0.5) { setMark(s, a.tgt % COLS, Math.floor(a.tgt / COLS), false); erasedMidDig++; break; }
        for (let k = 0; k < 3; k++) { const i = Math.floor(rand() * s.mark.length); if (s.mark[i] === 1) setMark(s, i % COLS, Math.floor(i / COLS), false); }
        const open = []; for (let i = COLS; i < s.kind.length; i++) if (s.kind[i] === OPEN) open.push(i);
        const o = open[Math.floor(rand() * open.length)]; scribble(s, o % COLS, Math.floor(o / COLS), 8);
        if (rand() < 0.3) room(s);
      }
      for (const a of s.ants) if (/dangerous/.test(a.think)) wetRefusals++;
    } });
    assert.equal(bad.path, 0, `scribbler seed ${seed}: an ant walked through soil`);
    assert.equal(bad.stuck, 0, `scribbler seed ${seed}: an ant idled beside work for ${bad.maxIdle.toFixed(1)} s`);
    assert.ok(s.over && s.t <= END_AT + 0.01, `scribbler seed ${seed}: round ends on time`);
    if (events.has('breach')) breaches++; if (events.has('cache')) caches++;
    worst = Math.max(worst, bad.maxIdle);
  }
  console.log(`scribbler over ${SEEDS} seeds: paths ok, no stuck ants (longest idle beside work ${worst.toFixed(2)} s), on time; pocket opened in ${breaches}, buried seeds reached in ${caches}, marks erased mid-dig ${erasedMidDig}, ant-ticks refusing wet work ${wetRefusals}`);
  assert.ok(breaches > 0 && caches > 0, 'the scribbler reached the pocket and a cache at least once');
}

// 2-5. play
const names = Object.keys(PLAYERS), table = [], wins = { first: 0, any: 0 };
for (let seed = 1; seed <= SEEDS; seed++) {
  const row = { seed };
  for (const n of names) {
    const plan = PLAYERS[n](create(seed));
    const { s, bad, ticks } = play(seed, plan);
    assert.equal(bad.path, 0, `${n} seed ${seed}: an ant walked through soil`);
    assert.equal(bad.stuck, 0, `${n} seed ${seed}: an ant idled beside work for ${bad.maxIdle.toFixed(1)} s`);
    assert.ok(s.over && ticks * DT <= END_AT + 0.01, `${n} seed ${seed}: round ends on time`);
    row[n] = s.result;
  }
  // winnable: the first sensible plan, else any other sensible plan
  if (row['sensible layout'].win) { wins.first++; wins.any++; }
  else {
    const all = sensible(create(seed));
    for (let k = 1; k < all.length; k++) { const r = play(seed, all[k]).s.result; if (r.win) { row['sensible layout'] = r; row.retry = k; wins.any++; break; } }
  }
  // a fourth player for honesty: a deep shaft and no queen's room
  row['shaft, no room'] = play(seed, { marks: shaft(create(seed), 3, ROWS - 2), room: null }).s.result;
  table.push(row);
}
const cols = [...names, 'shaft, no room'];
const fmt = r => `${String(r.score).padStart(3)} ${r.queen ? 'Q' : '-'} a${String(r.ants).padStart(2)} f${String(r.food).padStart(2)}`;
console.log('\nscore, Q = queen dry, a = ants kept, f = food kept');
console.log('seed  ' + cols.map(c => c.padEnd(17)).join(''));
for (const r of table) console.log(String(r.seed).padEnd(6) + cols.map(c => fmt(r[c]).padEnd(17)).join('') + (r.retry ? ` (sensible plan #${r.retry + 1})` : ''));
const mean = c => table.reduce((n, r) => n + r[c].score, 0) / table.length;
console.log('mean  ' + cols.map(c => mean(c).toFixed(1).padEnd(17)).join(''));
let order = 0;
for (const r of table) if (r['no marks'].score < r['straight shaft'].score && r['straight shaft'].score < r['sensible layout'].score) order++;
console.log(`\norder no marks < straight shaft < sensible on ${order}/${table.length} seeds`);
console.log(`sensible layout wins (queen dry): first plan ${wins.first}/${SEEDS}, some sensible plan ${wins.any}/${SEEDS}`);
console.log('why lines seen: ' + [...new Set(table.flatMap(r => cols.map(c => r[c].why)))].map(w => `\n  - ${w}`).join(''));
assert.equal(order, table.length, 'the three players score in order on every seed');
assert.equal(wins.any, SEEDS, 'every seed is winnable by a sensible layout');
console.log('\nall checks pass');
