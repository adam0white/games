// Proves the rules of Fix-It Stall: node experiments/fixit/bots.mjs
// Bots play through the same input interface the page uses (down/move/up in object-local units), one step per tick,
// with finger speeds capped at what a thumb can do (moves.js SKILLS). Exits non-zero when a claim fails.
import assert from 'node:assert/strict';
import { create, step, input, guide, rand, stars, DT, KINDS, TUTOR, PATIENCE, LEVELS, HIT, RAMP, TWO_PATIENCE } from './sim.js';
import { plan, SKILLS, THUMB_MAX } from './moves.js';
import { MAP, COUNT, INTRO, ORDER, levelDef, goalLine } from './levels.js';

let failed = 0;
function claim(ok, text) { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failed++; }

// A skilled bot: wait its reaction time on every new job, then play the plan from the job's guide; if the
// plan runs out before the job is done, pause briefly and plan again from the job's current state.
function skilled(skill) {
  return s => {
    const steps = [...Array(Math.round(skill.react / DT)).fill(null), ...plan(guide(s.rep), skill, [50, 110], Math.round(skill.react / DT) * DT)];
    return { steps, again: () => [...Array(Math.round(0.15 / DT)).fill(null), ...plan(guide(s.rep), skill, [50, 50], Math.round(0.15 / DT) * DT)] };
  };
}
// A skilled bot with a human wobble: each job its reaction time and finger speed vary (react x0.75..1.25, speed
// x0.9..1.1), drawn from its own seed, so a level can be played many slightly different ways.
function noisy(skill, seed) {
  const box = { r: seed * 7 + 3 };
  return s => {
    const k = { ...skill, react: skill.react * (0.75 + 0.5 * rand(box)), speed: skill.speed * (0.9 + 0.2 * rand(box)) };
    return skilled(k)(s);
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
  const paid = [];
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
    for (const e of s.events) if (e.e === 'paid') paid.push(e);
    s.events.length = 0;
  }
  if (rep && rep.done && !times[rep.kind]?.includes(s.t - started)) (times[rep.kind] ??= []).push(s.t - started);
  return { s, times, maxSpeed, firstLoss, paid };
}
const ALL = { unlocked: KINDS };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };

const t0 = Date.now();
if (process.argv.includes('--calibrate')) { calibrate(); process.exit(0); }
const TOP = (LEVELS - 1) * RAMP; // the shift clock where the hardest level begins

// 1. Determinism: the same seed and the same inputs give the same shift, for a skilled bot and a scribbler.
for (const [name, pol] of [['competent', skilled(SKILLS.competent)], ['scribbler', scribbler(9)]]) {
  const a = play({ seed: 1234, ...ALL }, pol).s, b = play({ seed: 1234, ...ALL }, name === 'scribbler' ? scribbler(9) : pol).s;
  claim(JSON.stringify([a.log, a.coins, a.t, a.r]) === JSON.stringify([b.log, b.coins, b.t, b.r]), `deterministic: ${name} plays seed 1234 the same twice (${a.served} served, ${a.coins} coins)`);
}
{ const a = create({ seed: 5, ...ALL }), b = create({ seed: 6, ...ALL }); claim(JSON.stringify(a.queue) !== JSON.stringify(b.queue), 'different seeds give different queues'); }
// The daily stall's promise: the same seed brings the same customers with the same jobs whoever plays it.
{
  const daily = { seed: 2026, ...ALL, two: true, hearts: 99 };
  // (whether a customer also brings a second repair still follows the level when they step up, which is time)
  const seen = pol => play(daily, pol).s.log.map(l => l.kind.split('+')[0]);
  const a = seen(skilled(SKILLS.expert)), b = seen(skilled(SKILLS.slow)), n = Math.min(a.length, b.length);
  claim(n >= 10 && a.slice(0, n).every((k, i) => k === b[i]), `same seed, any speed: an expert and a slow bot meet the same ${n} objects in the same order`);
}

// 2. Every repair alone, at the hardest ramp level, done by a competent bot inside its patience; and a slow bot's times.
console.log('\nOne repair at the hardest level (patience ' + PATIENCE[LEVELS - 1] + ' s). Median seconds from the job appearing to fixed, 20 seeds:');
console.log('kind      competent  average  slow   slow fits');
for (const kind of KINDS) {
  const row = {};
  for (const sk of ['competent', 'average', 'slow']) {
    const all = [];
    let lost = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { s } = play({ seed, ...ALL, only: kind, two: false, golden: 0, startLevel: LEVELS - 1, day: TOP + 60, hearts: 99 }, skilled(SKILLS[sk]), 70);
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
    const { s } = play({ seed, ...ALL, only: kind, two: 1, golden: 0, startLevel: LEVELS - 1, day: TOP + 40, hearts: 99 }, skilled(SKILLS.competent), 50);
    lost += s.lost;
    for (const l of s.log) if (l.ok && l.kind.includes('+') && l.ms > worst) { worst = l.ms; worstKind = l.kind; }
  }
  claim(lost === 0, `two-repair jobs at the top level: competent bot loses none (worst ${worstKind} in ${(worst / 1000).toFixed(2)} s, patience ${(PATIENCE[LEVELS - 1] * TWO_PATIENCE).toFixed(1)} s)`);
}

// Golden customers: with every eligible customer golden, a competent bot at the top level loses none of them,
// and they pay four times over. In ordinary shifts they are rare: about one shift in three or four meets one.
{
  let lost = 0, golden = 0, paidOk = true, worst = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const { s, paid } = play({ seed, ...ALL, golden: 1, startLevel: LEVELS - 1, day: TOP + 60, hearts: 99 }, skilled(SKILLS.competent), 90);
    for (const l of s.log.filter(l => l.golden)) { golden++; if (!l.ok) lost++; else worst = Math.max(worst, l.ms); }
    for (const e of paid) if (e.golden && e.coins < 4 * e.kinds.length * 2) paidOk = false;
  }
  claim(golden >= 20 && lost === 0, `golden jobs at the top level: competent bot fixes all ${golden} (worst ${(worst / 1000).toFixed(2)} s)`);
  claim(paidOk, 'a golden job pays four times over (at least 8 coins a repair)');
  let met = 0;
  for (let seed = 1; seed <= 40; seed++) { const { s } = play({ seed, ...ALL }, skilled(SKILLS.average)); if (s.log.some(l => l.golden)) met++; }
  claim(met >= 4 && met <= 20, `golden customers are rare: an average bot meets one in ${met} of 40 shifts`);
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
        // a tap on the oil can or on the thread's end is the job itself, so keep clear of those too
        const g = guide(s.rep), spot = kind === 'oil' ? g.at : kind === 'thread' ? g.from : null;
        if (spot && Math.hypot(spot[0] - x, spot[1] - y) < HIT[kind] + 1) continue;
        input(s, { type: 'down', x, y }); input(s, { type: 'up', x, y });
      }
      step(s); s.events.length = 0;
    }
    if (s.rep.best > 0) moved.push(kind);
  }
  claim(moved.length === 0, `taps that are not the job make no progress on any kind${moved.length ? ' (moved: ' + moved.join(', ') + ')' : ''}`);
}

// 4. Whole shifts by skill: idle fails early, slow fails late, skilled bots finish the day.
console.log(`\nWhole shifts, all ${KINDS.length} jobs unlocked, 40 seeds each:`);
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

levels();

console.log(`\n${failed ? failed + ' claim(s) FAILED' : 'all claims hold'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);

// ---------- the map levels (levels.js)
// Plays one level to its end; returns what a player would see: cleared, stars, the seconds the goal took, the whole length.
function level(def, policy, hearts = 3) {
  const { s } = play({ lv: def, hearts }, policy, 400);
  return { cleared: s.over === 'clear', why: s.over, stars: stars(s), secs: s.clearT, len: s.t, coins: s.coins, served: s.served, lost: s.lost, s };
}
// Measures the time limits, coin targets and star times for every level and prints them as TUNE for levels.js.
// A level's goal is played without a time limit by the slow, average, competent and expert bots (no wobble). Coin
// targets are 90% of what the competent bot holds when it has fixed the shape's number of customers. A time limit runs
// from 1.15 x the slow bot's time (level 2) to 1.25 x the competent bot's time (the last level), so early levels wait
// for a slow player and late ones need a quick one. Three stars need the expert's time plus 10%; two stars the
// average bot's time plus 5%, capped at the competent bot's time plus 30%. The slow time counts at most 1.6 x average.
function calibrate() {
  const out = {};
  for (let n = 1; n <= COUNT; n++) {
    const base = levelDef(n), shape = base.shape, free = { ...base, goal: { ...base.goal } };
    delete free.goal.time;
    if (shape.coins) {
      const probe = { ...free, goal: { fix: shape.coins } };
      free.goal.coins = Math.round(level(probe, skilled(SKILLS.competent)).coins * 0.9);
    }
    const [sl, av, c, e] = ['slow', 'average', 'competent', 'expert'].map(k => level(free, skilled(SKILLS[k])));
    if (!c.cleared || !e.cleared || !av.cleared) { console.log(`level ${n}: average ${av.why}, competent ${c.why}, expert ${e.why}`); continue; }
    const k = Math.max(0, n - 2) / (COUNT - 2), slowT = Math.min(sl.cleared ? sl.secs : Infinity, av.secs * 1.6);
    const t = { stars: [Math.ceil(e.secs * 1.1), Math.max(Math.ceil(e.secs * 1.1) + 2, Math.min(Math.ceil(av.secs * 1.05), Math.ceil(c.secs * 1.3)))] };
    if (shape.time) t.time = Math.max(t.stars[1] + 4, Math.ceil(((1 - k) * slowT * 1.15 + k * c.secs * 1.25) / 5) * 5);
    if (shape.coins) t.coins = free.goal.coins;
    out[n] = t;
    console.log(`level ${String(n).padStart(2)}: slow ${sl.cleared ? sl.secs.toFixed(1) : sl.why}, average ${av.secs.toFixed(1)}, competent ${c.secs.toFixed(1)}, expert ${e.secs.toFixed(1)} s -> ${JSON.stringify(t)}`);
  }
  console.log('export const TUNE = {\n' + Object.entries(out).map(([n, t]) => `  ${n}: ${JSON.stringify(t).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ')},`).join('\n') + '\n};');
}

function levels() {
  console.log(`\nMap levels, ${COUNT} of them. Each level is played by bots on its own fixed seed; the wobbly bots play it 6 ways.`);
  console.log('lvl new      goal                                          patience  competent  expert  t3/t2/limit   avg stars  avg len  slow clears');
  const NOISE = 6, rows = [];
  let compFails = 0, expertMiss = 0, expertNoisy = 0, expertNoisyAll = 0, idleClears = 0, scribClears = 0;
  for (const def of MAP) {
    const c = level(def, skilled(SKILLS.competent)), e = level(def, skilled(SKILLS.expert)), a = level(def, skilled(SKILLS.average));
    let cNoisy = 0, eNoisy = 0, avgStars = 0, slowClears = 0, avgLen = 0;
    for (let k = 1; k <= NOISE; k++) {
      if (level(def, noisy(SKILLS.competent, k)).cleared) cNoisy++;
      if (level(def, noisy(SKILLS.expert, k)).stars === 3) eNoisy++;
      const av = level(def, noisy(SKILLS.average, k)); avgStars += av.stars; avgLen += av.len;
      if (level(def, noisy(SKILLS.slow, k)).cleared) slowClears++;
    }
    if (level(def, idle).cleared) idleClears++;
    if (level(def, scribbler(def.n)).cleared) scribClears++;
    if (!c.cleared || cNoisy < NOISE) compFails++;
    if (e.stars !== 3) expertMiss++;
    expertNoisy += eNoisy; expertNoisyAll += NOISE;
    const row = { n: def.n, c, e, a, cNoisy, eNoisy, avgStars: avgStars / NOISE, avgLen: avgLen / NOISE, slowClears, def };
    rows.push(row);
    const goal = goalLine(def.goal).slice(0, 44).padEnd(45);
    console.log(`${String(def.n).padStart(3)} ${(def.intro ?? '-').padEnd(8)} ${goal} ${String(def.patience).padStart(6)}   ${c.cleared ? c.secs.toFixed(1).padStart(6) : ' fail '}   ${e.cleared ? e.secs.toFixed(1).padStart(5) : 'fail '}   ${`${def.stars[0]}/${def.stars[1]}/${def.goal.time ?? '-'}`.padEnd(12)}  ${row.avgStars.toFixed(1).padStart(5)}      ${row.avgLen.toFixed(0).padStart(4)}     ${slowClears}/${NOISE}`);
  }
  claim(compFails === 0, `a competent bot clears every level, plain and all ${NOISE} wobbly ways (${compFails} levels missed)`);
  claim(expertMiss === 0, `an expert bot gets three stars on every level (${expertMiss} missed)`);
  claim(expertNoisy >= expertNoisyAll * 0.8, `a wobbly expert still three-stars ${expertNoisy} of ${expertNoisyAll} level plays`);
  const lateComp3 = rows.filter(r => r.n > INTRO && r.c.stars === 3).length, late = rows.filter(r => r.n > INTRO).length;
  claim(lateComp3 <= late / 3, `three stars take more than competence: a competent bot three-stars ${lateComp3} of the ${late} mixed levels`);
  const comp2 = rows.filter(r => r.c.stars >= 2).length;
  claim(comp2 === COUNT, `a competent bot gets at least two stars on every level (${comp2} of ${COUNT})`);
  claim(idleClears === 0 && scribClears === 0, `a bot that does nothing or scribbles clears no level (${idleClears}, ${scribClears})`);
  // The ramp, measured: the slow bot clears fewer levels and the average bot earns fewer stars band by band.
  const bands = [[1, 10], [11, 20], [21, COUNT]].map(([a, b]) => {
    const r = rows.filter(x => x.n >= a && x.n <= b);
    return { a, b, slow: r.reduce((t, x) => t + x.slowClears, 0) / (r.length * NOISE), stars: r.reduce((t, x) => t + x.avgStars, 0) / r.length, len: r.reduce((t, x) => t + x.avgLen, 0) / r.length };
  });
  console.log('band      slow bot clears   average bot stars   average bot length (s)');
  for (const b of bands) console.log(`${String(b.a).padStart(2)}-${String(b.b).padEnd(5)}  ${(b.slow * 100).toFixed(0).padStart(5)}%            ${b.stars.toFixed(2)}                ${b.len.toFixed(0)}`);
  claim(bands[0].slow > bands[1].slow && bands[1].slow > bands[2].slow, `the ramp: a slow bot clears ${bands.map(b => (b.slow * 100).toFixed(0) + '%').join(', ')} of levels band by band`);
  claim(bands[0].stars >= bands[1].stars && bands[1].stars >= bands[2].stars, `the ramp: an average bot's stars fall band by band (${bands.map(b => b.stars.toFixed(2)).join(', ')})`);
  // The request: levels 1 to about 13 last 45 to 90 s. Level 1 is the first minute of the game and stays short on purpose.
  const long = rows.filter(r => r.n >= 2 && (r.avgLen < 45 || r.avgLen > (r.n <= INTRO ? 90 : 100))).map(r => `${r.n}: ${r.avgLen.toFixed(0)} s`);
  claim(long.length === 0, `an average bot spends 45 to 90 s in levels 2 to 15 and 45 to 100 s in later ones${long.length ? ' (outside: ' + long.join(', ') + ')' : ''}`);
  // Levels 1 to 15 each bring one new job, first, and in order.
  claim(MAP.slice(0, INTRO).every((d, i) => d.intro === ORDER[i] && create({ lv: d }).cust.kinds[0] === ORDER[i]) && new Set(ORDER).size === KINDS.length, 'levels 1 to 15 each start with a new job, every job once');
  // A known bad case fails: halve a mixed level's limit and the competent bot cannot clear it. Early levels wait for a
  // slow player, so for every timed level, a limit at 80% of the competent bot's own clear time must also fail.
  const timed = MAP.filter(d => d.goal.time), cut = (d, t) => level({ ...d, goal: { ...d.goal, time: t } }, skilled(SKILLS.competent)).cleared;
  const broken = timed.filter(d => d.n > INTRO && cut(d, d.goal.time / 2)).length;
  const tight = timed.filter(d => cut(d, rows[d.n - 1].c.secs * 0.8)).length;
  claim(broken === 0 && tight === 0, `time limits bite: half time on mixed levels and 80% of the competent time on any timed level are not cleared (${broken}, ${tight} still cleared of ${timed.length})`);
  // Determinism: a level played twice the same way gives the same result.
  const d1 = level(MAP[20], noisy(SKILLS.average, 3)), d2 = level(MAP[20], noisy(SKILLS.average, 3));
  claim(d1.secs === d2.secs && d1.coins === d2.coins && d1.stars === d2.stars, 'a level is deterministic: same bot, same wobble, same result');
}
