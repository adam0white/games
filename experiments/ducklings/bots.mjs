// Proof of the rules: node experiments/ducklings/bots.mjs
// Three bots play every stage and the endless pond. They differ in one thing only:
//   planner  looks ahead along its own trail: the mother AND every duckling at its delayed time
//   greedy   looks ahead for the mother only (the same moves, goals and rescue rule)
//   idle     never touches the screen
// If the copy-the-path rule matters, greedy loses clearly more ducklings than planner. Exits non-zero on a failed check.
import assert from 'node:assert/strict';
import { create, step, stars, STAGES, LAST_STAGE, DT, SPEED, GAP, R_MOM, R_DUCK, LINE_MAX, WARN_MIN, QUACK_TIME, QUACK_SQUEEZE, TRAITS,
  hitAny, moveMom, pathAt, stepDelay } from './sim.js';
import { bands, routeCheck } from './route.mjs';

const LOOK = 0.1, STEPS = 42; // look-ahead: 4.2 s in 0.1 s steps, long enough for the tail of a long line
const DIRS = 16;

// Where to go next: the nearest waiting duckling not far behind, else the nest (or onward, on the endless pond).
export function goalOf(s) { return stepping(s, wantOf(s)); }
// Cross one hazard band at a time: if a band lies between her and the goal, aim for the free water just past it,
// so she can stop there and let the line bunch before the next band (a person sees those calm strips too).
let bandCache = null;
function stepping(s, goal) {
  if (!bandCache || bandCache.s !== s || bandCache.n !== s.hazards.length) bandCache = { s, n: s.hazards.length, list: bands(s, -1, 1e9) };
  const m = s.mom;
  if (goal.y > m.y) { const b = bandCache.list.find(b => b.b > m.y + 0.02 && b.a < goal.y); if (b && b.b + 0.04 < goal.y) return { x: goal.x, y: b.b + 0.04 }; }
  else { const b = [...bandCache.list].reverse().find(b => b.a < m.y - 0.02 && b.b > goal.y); if (b && b.a - 0.04 > goal.y) return { x: goal.x, y: b.a - 0.04 }; }
  return goal;
}
function wantOf(s) {
  const m = s.mom; let best = null, bestD = Infinity;
  if (s.line.length < LINE_MAX) for (const l of s.lost) {
    if (l.y < m.y - 1.6) continue;
    const d = Math.hypot(l.x - m.x, (l.y - m.y) * (l.y < m.y ? 1.5 : 1));
    if (d < bestD) { bestD = d; best = { x: l.x, y: l.y }; }
  }
  if (best) return best;
  return s.nest ? { x: s.nest.x, y: s.nest.y } : { x: 0.5, y: m.y + 1.5 };
}

// Score one way of moving: go in `dir` (or wait) for a moment, then head for the goal.
export function score(s, dir, goal, quack, careful) {
  const m = { x: s.mom.x, y: s.mom.y, vx: s.mom.vx, vy: s.mom.vy }, trail = [{ x: m.x, y: m.y }];
  const first = dir === 'wait' ? { x: m.x, y: m.y } : null;
  let cost = 0, momHit = false;
  const ticks = Math.round(LOOK / DT);
  const delays = s.line.map(f => f.delay), hitF = s.line.map(() => false);
  let qT = quack ? QUACK_TIME : s.quackT;
  for (let j = 1; j <= STEPS; j++) {
    const phase1 = j * LOOK <= 0.9;
    for (let k = 0; k < ticks; k++) {
      const tt = s.t + ((j - 1) * ticks + k + 1) * DT;
      const target = phase1 ? (first ?? (dir === 'goal' ? goal : { x: m.x + Math.cos(dir) * 0.3, y: m.y + Math.sin(dir) * 0.3 })) : goal;
      moveMom(s, m, target, tt, DT, false);
    }
    trail.push({ x: m.x, y: m.y });
    cost += 1.2 * Math.hypot(goal.x - m.x, goal.y - m.y); // sooner is better
    const t = s.t + j * LOOK, fade = 1 / (1 + j * 0.03);
    if (!momHit && s.safe < j * LOOK && hitAny(s, t, m.x, m.y, R_MOM + 0.02)) { momHit = true; cost += 1000 * fade; }
    if (!careful) continue;
    // each duckling: where it will be at time t, on the old trail or on the new one
    qT = Math.max(0, qT - LOOK); let D = 0;
    for (let i = 0; i < delays.length; i++) {
      D += GAP * TRAITS[s.line[i].trait].gap * (qT > 0 ? QUACK_SQUEEZE : 1);
      delays[i] = stepDelay(delays[i], D, LOOK);
      if (hitF[i]) continue;
      const rel = j * LOOK - delays[i]; let p;
      if (rel <= 0) p = pathAt(s, -rel);
      else { const a = rel / LOOK, i0 = Math.floor(a), f = a - i0, A = trail[i0], B = trail[Math.min(i0 + 1, trail.length - 1)]; p = { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f }; }
      if (hitAny(s, t, p.x, p.y, R_DUCK + 0.015)) { hitF[i] = true; cost += 300 * fade; }
    }
  }
  cost += 6 * Math.hypot(goal.x - m.x, goal.y - m.y);
  if (quack) cost += 2; // a quack is spent only when it helps
  return cost;
}

export function planner(careful) {
  let next = 0, choice = null, quackNow = false;
  return s => {
    if (s.t >= next) {
      next = s.t + 0.2;
      const goal = goalOf(s);
      const options = ['goal', 'wait'];
      for (let i = 0; i < DIRS; i++) options.push(i / DIRS * Math.PI * 2);
      let best = Infinity; quackNow = false;
      for (const dir of options) for (const q of (careful && s.quackCool <= 0 && s.line.length > 1 ? [false, true] : [false])) {
        const c = score(s, dir, goal, q, careful);
        if (c < best) { best = c; choice = dir; quackNow = q; }
      }
      // keep the chosen heading as a point ahead, as a finger would
      choice = { dir: choice, goal };
    } else quackNow = false;
    const m = s.mom, d = choice.dir;
    const target = d === 'wait' ? { x: m.x, y: m.y } : d === 'goal' ? choice.goal : { x: m.x + Math.cos(d) * 0.3, y: m.y + Math.sin(d) * 0.3 };
    return { target, quack: quackNow };
  };
}
const idle = () => () => ({ target: null, quack: false });
const BOTS = { planner: () => planner(true), greedy: () => planner(false), idle };

function play(opts, bot, limit = 200) {
  const s = create(opts), act = bot();
  let trace = 0;
  while (!s.over && s.t < limit) {
    const { target, quack } = act(s);
    step(s, target, quack);
    trace = (trace * 31 + Math.round(s.mom.x * 1e4) + Math.round(s.mom.y * 1e4)) % 1e9;
  }
  return { s, trace };
}
const row = (cells, w) => cells.map((c, i) => String(c).padEnd(w[i])).join(' ');

const direct = process.argv[1]?.endsWith('bots.mjs');
if (direct) {
// node bots.mjs stage 3 planner   one run, printed second by second
if (process.argv[2] === 'stage') {
  const s = create({ stage: Number(process.argv[3]) }), act = BOTS[process.argv[4] ?? 'planner']();
  let last = -1;
  while (!s.over && s.t < 200) {
    const { target, quack } = act(s); step(s, target, quack);
    for (const e of s.events) if (e.type !== 'warn') console.log(s.t.toFixed(2), e.type, e.by ?? '', e.n ?? '');
    if (Math.floor(s.t) !== last) { last = Math.floor(s.t); console.log(s.t.toFixed(0), 'mom', s.mom.x.toFixed(2), s.mom.y.toFixed(2), 'target', target && target.x.toFixed(2), target && target.y.toFixed(2), 'line', s.line.length, 'lost', s.lost.length); }
  }
  console.log(s.over, s.why, 'arrived', s.arrived.length, 'of', s.total, 'score', s.score, 't', s.t.toFixed(1));
  process.exit(0);
} else main();
}

function main() {

let failed = 0;
const check = (ok, what) => { if (!ok) { failed++; console.log('FAIL', what); } };
const started = Date.now();

// 1. every hazard warns for at least WARN_MIN seconds; pikes are always in sight
for (let n = 1; n <= LAST_STAGE; n++) for (const h of create({ stage: n }).hazards) {
  if (h.kind === 'pike') continue;
  const warn = h.kind === 'bike' ? Math.min(...h.riders.map(r => r.warn)) : h.warn;
  check(warn >= WARN_MIN, `stage ${n} ${h.kind} warns ${warn}s`);
}

// 2. determinism
{
  const a = play({ stage: 4 }, BOTS.planner), b = play({ stage: 4 }, BOTS.planner);
  check(a.trace === b.trace && a.s.score === b.s.score && a.s.arrived.length === b.s.arrived.length, 'same seed and inputs give the same run');
  const e1 = play({ endless: true, seed: 9 }, BOTS.planner, 90), e2 = play({ endless: true, seed: 9 }, BOTS.planner, 90);
  check(e1.trace === e2.trace && e1.s.score === e2.s.score, 'endless is deterministic');
}

// 3. each stage, each bot
const W = [6, 8, 6, 9, 8, 8, 6, 6, 6, 7];
console.log(row(['stage', 'bot', 'end', 'arrived', 'of', 'stars', 'hits', 'scared', 'quacks', 'time'], W));
let sumP = 0, sumG = 0;
for (let n = 1; n <= LAST_STAGE; n++) {
  const spec = STAGES[n], res = {};
  for (const name of Object.keys(BOTS)) {
    const { s } = play({ stage: n }, BOTS[name]);
    res[name] = s;
    console.log(row([n, name, s.over === 'nest' ? 'nest' : s.why, s.arrived.length, s.total, '*'.repeat(stars(s)) || '-', s.hits, s.scatters, s.gone.length, s.quacks, s.t.toFixed(1)], W));
  }
  const p = res.planner, g = res.greedy, i = res.idle;
  sumP += p.arrived.length; sumG += g.arrived.length;
  check(p.over === 'nest', `stage ${n}: planner reaches the nest`);
  check(stars(p) === 3, `stage ${n}: planner reaches the 3-star par (${spec.par[2]})`);
  check(p.arrived.length >= Math.ceil(p.total * 0.75), `stage ${n}: planner brings most ducklings home`);
  check(i.over !== 'nest' || i.arrived.length === 0, `stage ${n}: idle fails`);
  check(p.t >= (n === 1 ? 15 : 30) && p.t <= spec.time * 0.75, `stage ${n}: planner time ${p.t.toFixed(0)}s leaves a person room (limit ${spec.time}s)`);
}
console.log(`total arrived: planner ${sumP}, greedy ${sumG}`);
check(sumG <= sumP * 0.8, 'greedy (mother only) brings home clearly fewer than planner (whole line)');

// 4. the same rules on other layouts: is the generator fair beyond the fixed stages?
{
  const W2 = [6, 8, 12, 14];
  console.log('\nother seeds, 6 each: nest runs and mean arrived / total');
  console.log(row(['stage', 'bot', 'nest', 'arrived'], W2));
  let worst = 1;
  for (const n of [3, 5, 8]) for (const name of ['planner', 'greedy']) {
    let nest = 0, got = 0, tot = 0;
    for (let k = 1; k <= 6; k++) { const { s } = play({ stage: n, seed: 1000 + k * 17 + n }, BOTS[name]); nest += s.over === 'nest'; got += s.arrived.length; tot += s.total; }
    console.log(row([n, name, `${nest}/6`, `${(got / 6).toFixed(1)} / ${(tot / 6).toFixed(1)}`], W2));
    if (name === 'planner') worst = Math.min(worst, nest / 6);
  }
  check(worst >= 0.8, 'planner reaches the nest on most other layouts');
}

// 5. endless: a way through exists (checked without the bots), and planning beats carelessness
{
  // route.mjs: every hazard band in the first 60 m can be crossed by a line of 6 waiting at most 15 s, and the
  // first-crossing clock stays ahead of dusk at every checkpoint. 30 seeds.
  let sealed = 0, late = 0;
  for (let k = 1; k <= 30; k++) { const r = routeCheck(k * 101, { yEnd: 60, n: 6 }); if (!r.ok) { sealed++; console.log('sealed', k * 101, JSON.stringify(r.fails)); } if (r.dusk !== null) { late++; console.log('dusk before 60 m', k * 101, r.dusk); } }
  console.log(`\nendless route check, 30 seeds to 60 m: ${30 - sealed} passable, ${30 - late} on time`);
  check(sealed === 0 && late === 0, 'endless: the first 60 m always has a passable route in time');
  // planner against greedy, 20 seeds, score at 90 s or at the end
  console.log('endless, 20 seeds, up to 90 s: score (end, distance, line)');
  let wins = 0; const W3 = [6, 26, 26, 6];
  console.log(row(['seed', 'planner', 'greedy', 'idle'], W3));
  for (let k = 1; k <= 20; k++) {
    const seed = k * 101, out = {};
    for (const name of ['planner', 'greedy', 'idle']) { const { s } = play({ endless: true, seed }, BOTS[name], 90); out[name] = s; }
    const f = s => `${s.score} (${s.why ?? 'alive'}, ${s.best.toFixed(0)}m, ${s.line.length})`;
    wins += out.planner.score > out.greedy.score;
    console.log(row([seed, f(out.planner), f(out.greedy), out.idle.score], W3));
  }
  console.log(`planner beats greedy on ${wins} of 20`);
  check(wins >= 16, 'endless: planner beats greedy on at least 80% of 20 seeds');
}

console.log(`\n${failed ? failed + ' FAILED' : 'all checks passed'} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
}
