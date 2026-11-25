// Rules and bot checks for Paper Pitch: node bots.mjs [--mutate | --mutate=ladder | --mutate=puzzles]
// The rules invariants use their own geometry (an oracle written from the rules text), not the helpers in sim.js.
// --mutate turns off "boundary points bounce" in the sim; the bounce invariant must then fail.
// --mutate=ladder makes rungs 1 to 5 play like Easy (the old cliff); the ladder claim must then fail.
// --mutate=puzzles wipes one puzzle's setup ink; the puzzle book claims must then fail.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { create, legal, apply, undo, xy, botTurn, mulberry32, daily, solve, clone, LEVELS, DY, MIX, RUNGS, rungTurn, fromMoves, solveAll } from './sim.js';
import { PUZZLES } from './puzzles.js';
import { IDEAS, checkIdea, clumsyRate } from './puzzles-rules.mjs';

const arg = process.argv.find(a => a.startsWith('--mutate'));
const MUTATE = arg ? (arg.split('=')[1] || 'bounce') : '';
const rules = { boundaryBounce: MUTATE !== 'bounce' };
const what = { bounce: 'boundary points do not bounce', ladder: 'rungs 1 to 5 play like Easy', puzzles: 'one puzzle lost its setup ink' }[MUTATE];
if (MUTATE && !what) throw new Error(`unknown mutation ${MUTATE}`);
if (MUTATE === 'ladder') MIX.fill(0, 1, 6);
const BOOK = MUTATE === 'puzzles' ? PUZZLES.map((p, i) => (i === 5 ? { ...p, moves: '' } : p)) : PUZZLES;
if (MUTATE) process.on('uncaughtException', e => {
  if (e.code !== 'ERR_ASSERTION') throw e;
  console.log(`mutation (${what}) detected by an assertion: ${e.message.split('\n')[0]}`);
  process.exit(0);
});

// Oracle: segments as "x,y|x,y" keys; points valid if on the pitch or behind a goal mouth.
function oracle(w, h) {
  const m = w / 2, key = (a, b) => [a, b].map(p => p.join(',')).sort().join('|'), lines = new Set();
  const onPitch = ([x, y]) => x >= 0 && x <= w && y >= 0 && y <= h;
  const inGoal = ([x, y]) => (y === -1 || y === h + 1) && x >= m - 1 && x <= m + 1;
  const add = (a, b) => lines.add(key(a, b));
  for (let y = 0; y < h; y++) { add([0, y], [0, y + 1]); add([w, y], [w, y + 1]); }
  for (let x = 0; x < w; x++) if (x < m - 1 || x >= m + 1) { add([x, 0], [x + 1, 0]); add([x, h], [x + 1, h]); }
  for (const [y0, y1] of [[0, -1], [h, h + 1]]) { add([m - 1, y0], [m - 1, y1]); add([m + 1, y0], [m + 1, y1]); add([m - 1, y1], [m, y1]); add([m, y1], [m + 1, y1]); }
  const touched = p => [...lines].some(k => k.split('|').includes(p.join(',')));
  const moves = p => {
    const out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const q = [p[0] + dx, p[1] + dy];
      const fromMouth = Math.abs(p[0] - m) <= 1 && (p[1] === 0 || p[1] === h);
      if ((dx || dy) && (onPitch(q) || (inGoal(q) && fromMouth)) && !lines.has(key(p, q))) out.push(q.join(','));
    }
    return out.sort();
  };
  return { key, lines, onPitch, inGoal, touched, moves };
}

const t0 = performance.now();
let games = 0, segs = 0, bounceCount = 0, goals = 0, stucks = 0;
for (let g = 0; g < 2000; g++) {
  const [w, h] = g % 4 === 3 ? [6, 8] : [8, 10];
  const rng = mulberry32(1000 + g), s = create(w, h, g & 1, rules), o = oracle(w, h);
  let ball = [w / 2, h / 2], turn = s.turn, plies = 0;
  const maxEdges = 4 * (w + 1) * (h + 3);
  while (s.winner < 0) {
    assert.ok(plies++ < maxEdges, 'every game ends');
    const ds = legal(s), mine = o.moves(ball);
    assert.deepEqual(ds.map(d => { const p = xy(s, s.g.next[s.ball * 8 + d]); return `${p.x},${p.y}`; }).sort(), mine, 'legal moves match the oracle');
    const d = ds[Math.floor(rng() * ds.length)], q = xy(s, s.g.next[s.ball * 8 + d]), to = [q.x, q.y];
    const k = o.key(ball, to), bounce = o.touched(to), mover = s.turn;
    assert.ok(!o.lines.has(k), 'no segment drawn twice');
    apply(s, d); o.lines.add(k); segs++;
    assert.ok(o.onPitch(to) || o.inGoal(to), 'ball never leaves the pitch');
    assert.ok(Math.max(Math.abs(to[0] - ball[0]), Math.abs(to[1] - ball[1])) === 1, 'one step to an adjacent point');
    // The line itself stays on the paper: its midpoint is inside the pitch rectangle or a goal box.
    const mx = (to[0] + ball[0]) / 2, my = (to[1] + ball[1]) / 2;
    assert.ok((mx >= 0 && mx <= w && my >= 0 && my <= h) || (mx >= w / 2 - 1 && mx <= w / 2 + 1 && my >= -1 && my <= h + 1), `segment ${ball} to ${to} stays on the pitch`);
    if (o.inGoal(to)) assert.ok(Math.abs(ball[0] - w / 2) <= 1, 'the ball enters a goal through its mouth');
    if (o.inGoal(to)) {
      goals++;
      assert.equal(s.winner, to[1] < 0 ? 0 : 1, 'a goal wins for that goal\'s attacker');
    } else if (s.winner < 0) {
      assert.equal(s.turn, bounce ? mover : 1 - mover, `bounce iff the point already had a line (at ${to})`);
    } else {
      stucks++;
      assert.equal(o.moves(to).length, 0, 'stuck only when no move is left');
      assert.equal(s.winner, 1 - s.turn, 'the stuck player loses');
    }
    if (bounce) bounceCount++;
    ball = to; turn = s.turn;
  }
  games++;
}
console.log(`rules: ${games} random games, ${segs} segments, ${bounceCount} bounces, ${goals} goals, ${stucks} stuck endings, all invariants hold (${((performance.now() - t0) / 1000).toFixed(1)} s)`);

// Parity: with the new content unused, the rules, the three bots and the daily give exactly the games they gave on main
// (digests computed from main's sim.js at a00b4d9e with this same code).
{
  const h1 = createHash('sha256'), h2 = createHash('sha256'), h3 = createHash('sha256');
  for (let g = 0; g < 500; g++) {
    const [w, h] = g % 4 === 3 ? [6, 8] : [8, 10];
    const rng = mulberry32(77000 + g), s = create(w, h, g & 1, rules);
    while (s.winner < 0) { const ds = legal(s); apply(s, ds[Math.floor(rng() * ds.length)]); }
    h1.update(JSON.stringify([s.log, s.winner, s.how]));
  }
  for (let g = 0; g < 60; g++) {
    const rng = mulberry32(88000 + g), s = create(8, 10, g & 1, rules);
    let plies = 0;
    while (s.winner < 0 && plies++ < 400) {
      const chain = botTurn(s, plies % 3, rng);
      h2.update(chain.join(','));
      for (const d of chain) apply(s, d);
    }
  }
  for (let i = 0; i < 60; i++) {
    const date = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10), p = daily(date);
    h3.update(JSON.stringify([date, p.state.ball, Array.from(p.state.mask), p.state.log, p.solution]));
  }
  const got = { rules: h1.digest('hex').slice(0, 16), bots: h2.digest('hex').slice(0, 16), daily: h3.digest('hex').slice(0, 16) };
  assert.deepEqual(got, { rules: 'edaef259b23cc341', bots: 'f5823916392f4de2', daily: '6a91f6731cd9d407' }, 'rules, bots and daily match main');
  console.log(`parity: 500 random games, 60 bot games (Easy, Medium, Hard) and 60 dailies match main's digests`);
}

function match(a, b, n, seed) {
  // Games alternate seats and who kicks off. Returns wins for level a, and the slowest bot turn in ms.
  let wins = 0, slowest = 0, totalTurns = 0, totalMs = 0;
  for (let g = 0; g < n; g++) {
    const rng = mulberry32(seed + g), s = create(8, 10, (g >> 1) & 1, rules), aSeat = g & 1;
    while (s.winner < 0) {
      // CPU time, not wall time: other jobs on a shared machine stretch wall time.
      const level = s.turn === aSeat ? a : b, t = process.cpuUsage();
      const chain = botTurn(s, level, rng), used = process.cpuUsage(t), ms = (used.user + used.system) / 1000;
      if (level === 2) { slowest = Math.max(slowest, ms); totalMs += ms; totalTurns++; }
      assert.ok(chain && chain.length, 'a bot always has a turn');
      for (const d of chain) { assert.ok(legal(s).includes(d), 'bot plays legal segments'); apply(s, d); }
    }
    if (s.winner === aSeat) wins++;
  }
  return { wins, slowest, avg: totalTurns ? totalMs / totalTurns : 0 };
}
for (const [a, b, seed] of [[1, 0, 50000], [2, 1, 60000]]) {
  const r = match(a, b, 200, seed), rate = r.wins / 200;
  const timing = a === 2 ? `; Hard turn CPU time in Node: mean ${r.avg.toFixed(2)} ms, max ${r.slowest.toFixed(1)} ms` : '';
  console.log(`bots: ${LEVELS[a]} beat ${LEVELS[b]} in ${r.wins}/200 games (${(rate * 100).toFixed(1)}%), seats and kick-off alternated${timing}`);
  assert.ok(rate >= 0.6, `${LEVELS[a]} must beat ${LEVELS[b]} in at least 60% of games`);
  if (a === 2) assert.ok(r.slowest < 40, 'Hard stays under 40 ms CPU per turn in Node (150 ms budget on a phone)');
}

const t1 = performance.now(), seen = new Set(), lengths = [];
let slowestDay = 0;
for (let i = 0; i < 60; i++) {
  const date = new Date(Date.UTC(2026, 10, 24 + i)).toISOString().slice(0, 10), t = performance.now();
  const p = daily(date);
  slowestDay = Math.max(slowestDay, performance.now() - t);
  assert.ok(p, `daily ${date} exists`);
  assert.equal(p.state.turn, 0, 'blue is to move');
  const sol = solve(p.state, 7);
  assert.ok(sol && sol.length >= 3 && sol.length <= 7, `daily ${date} has a shortest scoring chain of 3 to 7 segments`);
  const s = clone(p.state);
  for (const d of p.solution) { assert.equal(s.turn, 0, 'the chain stays in one turn'); apply(s, d); }
  assert.equal(s.winner, 0, 'the chain scores for blue'); assert.equal(s.how, 'goal');
  const key = p.state.ball + ':' + p.state.mask.join('');
  assert.ok(!seen.has(key), `daily ${date} differs from the days before`); seen.add(key);
  lengths.push(sol.length);
}
const hist = lengths.reduce((m, n) => (m[n] = (m[n] || 0) + 1, m), {});
console.log(`daily: 60 days from 2026-11-24 verified and distinct; shortest chains ${JSON.stringify(hist)}; ${((performance.now() - t1) / 60).toFixed(1)} ms mean, ${slowestDay.toFixed(1)} ms max per day`);
// The ladder. A naive player heads for goal, takes a goal when it sees one, avoids an own goal, and plays a random
// segment a quarter of the time. On main the levels went Easy 98% to Medium 0% for this player: a cliff.
function naive(s, rng, noise = 0.25) {
  const p = s.turn;
  while (s.winner < 0 && s.turn === p) {
    const ds = legal(s), test = d => { const u = apply(s, d); const w = s.winner; undo(s, u); return w; };
    const safe = ds.filter(d => { const w = test(d); return !(w >= 0 && w !== p); }), pool = safe.length ? safe : ds;
    const win = pool.find(d => test(d) === p);
    let d;
    if (win !== undefined) d = win;
    else if (rng() < noise) d = pool[Math.floor(rng() * pool.length)];
    else { const sgn = p === 0 ? 1 : -1, best = Math.min(...pool.map(d => sgn * DY[d])), c = pool.filter(d => sgn * DY[d] === best); d = c[Math.floor(rng() * c.length)]; }
    apply(s, d);
  }
}
{
  const N = 200, rates = [];
  for (let r = 0; r < RUNGS; r++) {
    let wins = 0;
    for (let g = 0; g < N; g++) {
      const rng = mulberry32(9000 + g), s = create(8, 10, g & 1, rules);
      while (s.winner < 0) {
        if (s.turn === 0) naive(s, rng);
        else { const chain = rungTurn(s, r, rng); assert.ok(chain && chain.length, 'a rung always has a turn'); for (const d of chain) { assert.ok(legal(s).includes(d)); apply(s, d); } }
      }
      if (s.winner === 0) wins++;
    }
    rates.push(Math.round(100 * wins / N));
  }
  const drops = rates.slice(1).map((v, i) => rates[i] - v);
  console.log(`ladder: naive player's win % against rungs 1 to ${RUNGS}: ${rates.join(' ')}; largest step down ${Math.max(...drops)} points (main: Easy ${'>'}= 98, Medium 0)`);
  assert.ok(rates[0] >= 90, 'the first rung is beatable by a naive player');
  assert.ok(rates[RUNGS - 1] <= 5, 'the top rung beats a naive player');
  drops.forEach((d, i) => assert.ok(d >= -8, `rung ${i + 2} is not much easier than rung ${i + 1}`));
  assert.ok(Math.max(...drops) <= 25, `no cliff: each rung costs a naive player at most 25 points (got ${drops.join(',')})`);
}

// The puzzle book: 18 puzzles, each with one new idea, all solvable, getting harder gently for a clumsy player.
{
  const t = performance.now();
  assert.equal(BOOK.length, IDEAS.length, 'one puzzle per idea');
  assert.deepEqual(new Set(BOOK.map(p => p.id)), new Set(IDEAS.map(i => i.id)), 'every idea has its puzzle');
  const r75 = [], r60 = [], lens = [];
  for (const p of BOOK) {
    const idea = IDEAS.find(i => i.id === p.id), s = fromMoves(p.w, p.h, p.first, p.moves);
    assert.ok(s && s.winner < 0 && s.turn === 0, `puzzle ${p.id} starts with blue to move`);
    if (idea.size) assert.deepEqual([p.w, p.h], idea.size, `puzzle ${p.id} is on its own pitch`);
    const sol = solve(s, 7);
    assert.ok(sol, `the solver clears puzzle ${p.id}`);
    assert.ok(sol.length >= idea.min && sol.length <= idea.max, `puzzle ${p.id}: shortest chain ${sol.length} in ${idea.min}..${idea.max}`);
    const u = clone(s); for (const d of sol) { assert.equal(u.turn, 0, 'one turn'); apply(u, d); }
    assert.ok(u.winner === 0 && u.how === 'goal', `puzzle ${p.id}: the chain scores`);
    assert.ok(checkIdea(idea, s, solveAll(s, sol.length)), `puzzle ${p.id} shows its idea`);
    lens.push(sol.length);
    r75.push(Math.round(100 * clumsyRate(s, 300, 42, 0.75)));
    r60.push(Math.round(100 * clumsyRate(s, 300, 42, 0.6)));
  }
  const drop = r => Math.max(...r.slice(1).map((v, i) => r[i] - v));
  console.log(`puzzles: solver clears ${BOOK.length}/${BOOK.length}, every idea holds; shortest chains ${lens.join(' ')}`);
  console.log(`puzzles: clumsy player (75% right segments) clears % ${r75.join(' ')}; largest step down ${drop(r75)}`);
  console.log(`puzzles: clumsy player (60% right segments) clears % ${r60.join(' ')}; largest step down ${drop(r60)} (${((performance.now() - t) / 1000).toFixed(1)} s)`);
  assert.ok(r75[0] >= 90, 'the first puzzle is cleared by a clumsy player');
  assert.ok(drop(r75) <= 15, 'no cliff in the puzzle book: each page costs the 75% player at most 15 points');
  assert.ok(drop(r60) <= 20, 'no cliff in the puzzle book: each page costs the 60% player at most 20 points');
  assert.ok(Math.min(...r60) >= 20, 'every puzzle stays within reach of a clumsy player');
  assert.ok(r60[r60.length - 1] < r60[0] - 30, 'the book does get harder');
}

console.log(MUTATE ? 'MUTATION NOT DETECTED' : 'all checks passed');
process.exitCode = MUTATE ? 1 : 0;
