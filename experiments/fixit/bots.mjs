// Proves the rules of Fix-It Stall: node experiments/fixit/bots.mjs
// Bots play through the same input interface the page uses (down/move/up in object-local units), one step per tick,
// with finger speeds capped at what a thumb can do (moves.js SKILLS). Exits non-zero when a claim fails.
import assert from 'node:assert/strict';
import { create, step, input, guide, rand, DT, KINDS, TUTOR, PATIENCE, LEVELS, HIT, RAMP } from './sim.js';
import { plan, SKILLS, THUMB_MAX } from './moves.js';

let failed = 0;
function claim(ok, text) { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failed++; }

// A skilled bot: wait its reaction time on every new job, then play the plan from the job's guide; if the
// plan runs out before the job is done, pause briefly and plan again from the job's current state.
function skilled(skill) {
  return s => {
    const steps = [...Array(Math.round(skill.react / DT)).fill(null), ...plan(guide(s.rep), skill, [50, 110])];
    return { steps, again: () => [...Array(Math.round(0.15 / DT)).fill(null), ...plan(guide(s.rep), skill, [50, 50])] };
  };
}
// A bot that never touches anything.
const idle = () => ({ steps: [], again: () => Array(60).fill(null) });
// A bot that scribbles: random taps and short random drags over the bench box, from its own seed.
function scribbler(seed) {
  const box = { r: seed };
  const scribble = () => {
    const out = [...Array(Math.round(0.3 / DT)).fill(null)];
    let x = 10 + rand(box) * 80, y = 10 + rand(box) * 80;
    out.push({ type: 'down', x, y });
    const n = Math.floor(rand(box) * 25);
    const vx = (rand(box) - 0.5) * 6, vy = (rand(box) - 0.5) * 6;
    for (let i = 0; i < n; i++) { x += vx; y += vy; out.push({ type: 'move', x, y }); }
    out.push({ type: 'up', x, y });
    return out;
  };
  return () => ({ steps: scribble(), again: scribble });
}

// Plays one shift to its end. Returns the sim and what the bot did.
function play(opts, policy, maxSeconds = 400) {
  const s = create(opts);
  let rep = null, steps = [], i = 0, ctl = null, down = false, maxSpeed = 0, last = null;
  const times = {};
  let started = 0, firstLoss = null;
  while (!s.over && s.t < maxSeconds) {
    if (s.rep !== rep) {
      if (rep && rep.done) (times[rep.kind] ??= []).push(s.t - started);
      if (down) { input(s, { type: 'up', x: last.x, y: last.y }); down = false; }
      rep = s.rep; started = s.t; ctl = policy(s); steps = ctl.steps; i = 0; last = null;
    }
    if (s.phase === 'work') {
      if (i >= steps.length) { if (down) { input(s, { type: 'up', x: last.x, y: last.y }); down = false; } steps = ctl.again(); i = 0; }
      const st = steps[i++];
      if (st) {
        if (st.type === 'move' && last) maxSpeed = Math.max(maxSpeed, Math.hypot(st.x - last.x, st.y - last.y) / DT);
        input(s, st); last = st; down = st.type !== 'up';
      }
    }
    step(s);
    if (firstLoss === null && s.events.some(e => e.e === 'lost')) firstLoss = s.clock;
    s.events.length = 0;
  }
  if (rep && rep.done && !times[rep.kind]?.includes(s.t - started)) (times[rep.kind] ??= []).push(s.t - started);
  return { s, times, maxSpeed, firstLoss };
}
const ALL = { unlocked: KINDS };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };

const t0 = Date.now();
const TOP = (LEVELS - 1) * RAMP; // the shift clock where the hardest level begins

// 1. Determinism: the same seed and the same inputs give the same shift, for a skilled bot and a scribbler.
for (const [name, pol] of [['competent', skilled(SKILLS.competent)], ['scribbler', scribbler(9)]]) {
  const a = play({ seed: 1234, ...ALL }, pol).s, b = play({ seed: 1234, ...ALL }, name === 'scribbler' ? scribbler(9) : pol).s;
  claim(JSON.stringify([a.log, a.coins, a.t, a.r]) === JSON.stringify([b.log, b.coins, b.t, b.r]), `deterministic: ${name} plays seed 1234 the same twice (${a.served} served, ${a.coins} coins)`);
}
{ const a = create({ seed: 5, ...ALL }), b = create({ seed: 6, ...ALL }); claim(JSON.stringify(a.queue) !== JSON.stringify(b.queue), 'different seeds give different queues'); }

// 2. Every repair alone, at the hardest ramp level, done by a competent bot inside its patience; and a slow bot's times.
console.log('\nOne repair at the hardest level (patience ' + PATIENCE[LEVELS - 1] + ' s). Median seconds from the job appearing to fixed, 20 seeds:');
console.log('kind      competent  average  slow   slow fits');
for (const kind of KINDS) {
  const row = {};
  for (const sk of ['competent', 'average', 'slow']) {
    const all = [];
    let lost = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { s } = play({ seed, ...ALL, only: kind, two: false, startLevel: LEVELS - 1, day: TOP + 60, hearts: 99 }, skilled(SKILLS[sk]), 70);
      all.push(...s.log.filter(l => l.ok).map(l => l.ms / 1000)); lost += s.lost;
    }
    row[sk] = { med: median(all), max: Math.max(...all), lost };
  }
  console.log(`${kind.padEnd(9)} ${row.competent.med.toFixed(2).padStart(6)}     ${row.average.med.toFixed(2).padStart(5)}   ${row.slow.med.toFixed(2).padStart(5)}  ${row.slow.lost ? 'no' : 'yes'}`);
  claim(row.competent.lost === 0 && row.competent.max < PATIENCE[LEVELS - 1] * 0.6, `${kind}: competent bot always inside patience at the top level (worst ${row.competent.max.toFixed(2)} s)`);
  claim(row.competent.med >= 1.0 && row.competent.med <= 6, `${kind}: a practised repair takes 1 to 6 s (${row.competent.med.toFixed(2)} s)`);
}
// The two-repair jobs: the worst pair, at the top level, still fits for a competent bot.
{
  let worst = 0, worstKind = '', lost = 0;
  for (const kind of KINDS) for (let seed = 1; seed <= 6; seed++) {
    const { s } = play({ seed, ...ALL, only: kind, two: 1, startLevel: LEVELS - 1, day: TOP + 40, hearts: 99 }, skilled(SKILLS.competent), 50);
    lost += s.lost;
    for (const l of s.log) if (l.ok && l.kind.includes('+') && l.ms > worst) { worst = l.ms; worstKind = l.kind; }
  }
  claim(lost === 0, `two-repair jobs at the top level: competent bot loses none (worst ${worstKind} in ${(worst / 1000).toFixed(2)} s, patience ${(PATIENCE[LEVELS - 1] * 1.75).toFixed(1)} s)`);
}

// 3. Wrong gestures do nothing: taps on a job that wants a drag, and taps beside the dents.
{
  let moved = [];
  for (const kind of KINDS) {
    const s = create({ seed: 3, ...ALL, only: kind, two: false });
    const box = { r: 77 };
    for (let i = 0; i < 300; i++) {
      if (i % 15 === 0) {
        let x = 5 + rand(box) * 90, y = 5 + rand(box) * 90;
        if (kind === 'dent') { // keep clear of every dent
          if (s.rep.dents.some(d => Math.hypot(d.x - x, d.y - y) < HIT.dent + 1)) continue;
        }
        input(s, { type: 'down', x, y }); input(s, { type: 'up', x, y });
      }
      step(s); s.events.length = 0;
    }
    if (s.rep.best > 0) moved.push(kind);
  }
  claim(moved.length === 0, `taps that are not the job make no progress on any kind${moved.length ? ' (moved: ' + moved.join(', ') + ')' : ''}`);
}

// 4. Whole shifts by skill: idle fails early, slow fails late, skilled bots finish the day.
console.log('\nWhole shifts, all nine jobs unlocked, 40 seeds each:');
console.log('bot         coins  served  lost  ended by hearts  first heart lost at (s)');
const table = {};
const policies = { idle: () => idle, scribbler: seed => scribbler(seed), slow: () => skilled(SKILLS.slow), average: () => skilled(SKILLS.average), competent: () => skilled(SKILLS.competent), expert: () => skilled(SKILLS.expert) };
for (const [name, make] of Object.entries(policies)) {
  const coins = [], served = [], lost = [], firstLoss = [], endClock = [];
  let byHearts = 0, fastest = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { s: done, maxSpeed, firstLoss: fl } = play({ seed, ...ALL }, make(seed));
    if (fl !== null) firstLoss.push(fl);
    fastest = Math.max(fastest, maxSpeed);
    coins.push(done.coins); served.push(done.served); lost.push(done.lost); endClock.push(done.clock);
    if (done.over === 'hearts') byHearts++;
  }
  table[name] = { someLoss: lost.filter(n => n > 0).length, coins: mean(coins), served: mean(served), lost: mean(lost), byHearts, firstLoss: median(firstLoss), endClock: mean(endClock), fastest };
  console.log(`${name.padEnd(10)} ${mean(coins).toFixed(0).padStart(6)}  ${mean(served).toFixed(1).padStart(6)}  ${mean(lost).toFixed(1).padStart(4)}  ${String(byHearts).padStart(8)}/40       ${firstLoss.length ? median(firstLoss).toFixed(0) : '-'}`);
}
claim(table.idle.byHearts === 40 && table.idle.endClock < 45, `idle bot fails early: all 40 shifts end by hearts, mean at ${table.idle.endClock.toFixed(0)} s of 90`);
claim(table.slow.firstLoss >= 30, `slow bot fails late: median first heart lost at ${table.slow.firstLoss.toFixed(0)} s`);
claim(table.slow.someLoss >= 12, `slow bot loses a heart in ${table.slow.someLoss} of 40 shifts once the ramp is up`);
claim(table.competent.byHearts === 0 && table.competent.lost <= 0.3, `competent bot finishes the day (lost ${table.competent.lost.toFixed(2)} hearts a shift)`);
claim(table.scribbler.coins < table.average.coins / 3, `a scribbler does clearly worse than an average bot (${table.scribbler.coins.toFixed(0)} vs ${table.average.coins.toFixed(0)} coins)`);
claim(table.slow.coins < table.average.coins && table.average.coins < table.competent.coins && table.competent.coins <= table.expert.coins, 'coins rise with skill');
const fastest = Math.max(...Object.values(table).map(t => t.fastest));
claim(fastest <= THUMB_MAX + 1, `no bot finger moved faster than ${THUMB_MAX} units/s (fastest ${fastest.toFixed(0)})`);

// 5. The economy: an average player's first two shifts (the first with the tutorial and three jobs) buy the cheapest shop item.
{
  const CHEAPEST = 50, two = [], slowTwo = [];
  for (let seed = 1; seed <= 20; seed++) {
    const a = play({ seed, unlocked: TUTOR, tutorial: true }, skilled(SKILLS.average)).s.coins;
    const b = play({ seed: seed + 100, unlocked: [...TUTOR, 'wheel'], newJob: 'wheel' }, skilled(SKILLS.average)).s.coins;
    two.push(a + b);
    slowTwo.push(play({ seed, unlocked: TUTOR, tutorial: true }, skilled(SKILLS.slow)).s.coins + play({ seed: seed + 100, unlocked: [...TUTOR, 'wheel'], newJob: 'wheel' }, skilled(SKILLS.slow)).s.coins);
  }
  claim(median(slowTwo) >= CHEAPEST, `a slow player's first two shifts earn a median ${median(slowTwo)} coins (cheapest item ${CHEAPEST})`);
  claim(Math.min(...two) >= CHEAPEST, `first two shifts of an average player earn ${Math.min(...two)} to ${Math.max(...two)} coins; the cheapest item is ${CHEAPEST}`);
  const slowFirst = play({ seed: 1, unlocked: TUTOR, tutorial: true }, skilled(SKILLS.slow)).s;
  claim(slowFirst.lost === 0 || slowFirst.served >= 3, `the tutorial customers wait for a slow player (slow bot served ${slowFirst.served} on its first shift)`);
}

console.log(`\n${failed ? failed + ' claim(s) FAILED' : 'all claims hold'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
