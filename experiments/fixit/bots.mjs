// Proves the rules of Fix-It Stall: node experiments/fixit/bots.mjs
// Bots play through the same input interface the page uses (down/move/up in object-local units), one step per tick,
// with finger speeds capped at what a thumb can do (moves.js SKILLS). Exits non-zero when a claim fails.
import { create, step, input, guide, rand, stars, chooseTicket, selectLane, goalState, DT, KINDS, TUTOR, PATIENCE, LEVELS, HIT, RAMP, TWO_PATIENCE, THREAD_UP, THREAD_EYE, COIN } from './sim.js';
import { ghost, plan, SKILLS, THUMB_MAX } from './moves.js';
import { drawGhost } from './art.js';
import { MAP, COUNT, INTRO, BUSY_END, OPEN_ORDER, levelDef, goalLine, canAssist, levelReward } from './levels.js';

let failed = 0;
function claim(ok, text) { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failed++; }

// A skilled bot: wait its reaction time on every new job, then play the plan from the job's guide; if the
// plan runs out before the job is done, pause briefly and plan again from the job's current state.
function skilled(skill) {
  const playJob = s => {
    const steps = [...Array(Math.round(skill.react / DT)).fill(null), ...plan(guide(s.rep), skill, [50, 110], Math.round(skill.react / DT) * DT)];
    return { steps, again: () => [...Array(Math.round(0.15 / DT)).fill(null), ...plan(guide(s.rep), skill, [50, 50], Math.round(0.15 / DT) * DT)] };
  };
  playJob.usesTickets = true;
  return playJob;
}
// A skilled bot with a human wobble: each job its reaction time and finger speed vary (react x0.75..1.25, speed
// x0.9..1.1), drawn from its own seed, so a level can be played many slightly different ways.
function noisy(skill, seed) {
  const box = { r: seed * 7 + 3 };
  const playJob = s => {
    const k = { ...skill, react: skill.react * (0.75 + 0.5 * rand(box)), speed: skill.speed * (0.9 + 0.2 * rand(box)) };
    return skilled(k)(s);
  };
  playJob.usesTickets = true;
  return playJob;
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
    if (s.choosing && policy.usesTickets && i === Math.round(0.35 / DT)) {
      chooseTicket(s, s.stepN);
      ctl = policy(s); steps = ctl.steps; i = 0;
    }
    if (s.choosing && policy.usesTickets) {
      i++;
    } else if (s.phase === 'work') {
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

// The opening teaches one motion, then mixes it with the next two jobs.
const opening = MAP.slice(0, 3);
claim(opening[0].goal.fix === 3 && !goalState(create({ lv: opening[0] })).safe,
  'three bells finish the first lesson and a single walk-off allows another try');
claim(opening[1].goal.fix === 6 && opening[2].goal.list?.length === 6,
  'the next two lessons mix new and familiar jobs over six customers');
claim(goalLine(opening[2].goal).includes('One walk-off ends the level'),
  'the set-list briefing names the consequence of losing a customer');

// Phone gestures observed before reading the move plans.
{
  const pin = create({ only: 'pin' });
  input(pin, { type: 'down', x: 50, y: 45 });
  input(pin, { type: 'move', x: 50, y: -3 });
  input(pin, { type: 'up', x: 50, y: -3 });
  claim(pin.served === 1, 'a full upward swipe extracts the pin even if lifted before the next tick');
  const partial = create({ only: 'pin' });
  input(partial, { type: 'down', x: 50, y: 45 });
  input(partial, { type: 'move', x: 50, y: 25 });
  for (let i = 0; i < 20; i++) step(partial);
  input(partial, { type: 'up', x: 50, y: 25 });
  for (let i = 0; i < 90; i++) step(partial);
  claim(partial.rep.p === 0 && partial.served === 0, 'the progress ring empties when a partly lifted pin slides back');
  const canceled = create({ only: 'pin' });
  input(canceled, { type: 'down', x: 50, y: 45 });
  input(canceled, { type: 'move', x: 50, y: -3 });
  input(canceled, { type: 'cancel', x: 50, y: -3 });
  claim(canceled.served === 0, 'a canceled fast pull earns no repair');

  const door = create({ only: 'oil' });
  for (let i = 0; i < 60 && guide(door.rep).open < 0.7; i++) step(door);
  const oilGuide = guide(door.rep);
  input(door, { type: 'down', x: 72, y: 80 });
  const afterDrop = guide(door.rep);
  claim(ghost(oilGuide, 0).press && !ghost(afterDrop, 0).press,
    'the oil-can cue turns off as soon as its drop lands, including while the door remains wide open');
  claim(oilGuide.ready && oilGuide.at[0] === door.rep.cx && oilGuide.at[1] === door.rep.cy, 'the timing demonstration lands on the ready oil can');

  const jacket = create({ only: 'zip' });
  input(jacket, { type: 'down', x: 50, y: 95 });
  input(jacket, { type: 'move', x: 50, y: 35 });
  for (let i = 0; i < 30; i++) step(jacket);
  const snag = guide(jacket.rep);
  const lines = [];
  const pen = new Proxy({ lineTo: (x, y) => lines.push([x, y]) }, { get: (obj, key) => obj[key] ?? (() => {}) });
  drawGhost(pen, snag, 0.5, 1);
  const left = ghost(snag, 0.3375).p, right = ghost(snag, 0.1125).p;
  claim(snag.stuck && left[1] === right[1] && right[0] - left[0] >= 10, 'a blocked zipper shows a lateral wiggle');
  claim(!lines.some(([, y]) => y === snag.top), 'a blocked zipper no longer draws the upward trail to the collar');

  // Middle and late game audit: the toy car and the needle only work if the finger stays down, but the demonstration
  // showed a plain drag, so touch players let go early. The demonstration now shows the hold clock at the end of the drag.
  for (const kind of ['spring', 'thread']) {
    const arcs = [], gd = guide(create({ only: kind }).rep);
    const meter = new Proxy({ arc: (x, y, r) => arcs.push(r) }, { get: (obj, key) => obj[key] ?? (() => {}) });
    drawGhost(meter, gd, 1.8 * 0.8, 1);
    claim(arcs.includes(4.6), `the ${kind} demonstration shows that the finger must stay down at the end`);
  }

  // Open items 2026-11-24: touch players pressed the drawn thread tip (or the tile pen's nozzle) and dragged it onto the
  // target, which missed: only the knob or pen body took hold, and the thread's tip stood 26 units right of the thumb.
  // Now a press anywhere on the thread or pen takes hold, and the tip stands straight above the thumb.
  {
    const needle = create({ only: 'thread' }), r = needle.rep;
    input(needle, { type: 'down', x: r.tx, y: r.ty });
    claim(r.grab, 'a press on the drawn thread tip takes hold of the thread');
    input(needle, { type: 'up', x: r.tx, y: r.ty });
    const below = create({ only: 'thread' }), b = below.rep;
    input(below, { type: 'down', x: b.tx, y: b.ty + THREAD_UP });
    for (let i = 0; i < 40; i++) { input(below, { type: 'move', x: 64, y: b.ey + THREAD_UP }); step(below); }
    for (let i = 0; i < 120 && !below.served; i++) { input(below, { type: 'move', x: 64, y: b.ey + THREAD_UP }); step(below); }
    claim(below.served === 1, 'holding the thumb straight below the needle eye threads it');
    const wide = create({ only: 'thread' }), w = wide.rep;
    input(wide, { type: 'down', x: w.tx, y: w.ty + THREAD_UP });
    for (let i = 0; i < 160 && !wide.served; i++) { input(wide, { type: 'move', x: 57, y: w.ey + THREAD_UP }); step(wide); }
    claim(wide.served === 1, 'a tip held 7 units beside the swaying eye still goes through');
    const g = guide(create({ only: 'thread' }).rep);
    claim(g.to[0] === g.eye[0] && g.to[1] - g.eye[1] - THREAD_EYE >= 16, `the thumb holds ${g.to[1] - g.eye[1] - THREAD_EYE} units below the eye's catch ring, not on it`);
    const tile = create({ only: 'trace' }), t = tile.rep, [nx, ny] = t.samples[0];
    input(tile, { type: 'down', x: nx, y: ny });
    claim(t.grab, 'a press on the tile pen nozzle takes hold of the pen');
  }

  // Open items 2026-11-24: on two-repair jobs the first circle round the screw was sometimes ignored. Reproduced: when the
  // first repair ends with the finger still down (rubbing, sewing, sliding, holding), the sim blocked that finger until it
  // lifted, so a circle that went straight on did nothing. A fresh circle after lifting worked in every case tried.
  {
    const twoStep = kind => {
      const s = create({ seed: 1, unlocked: KINDS, only: kind, two: 1, golden: 0 });
      let steps = plan(guide(s.rep), { ...SKILLS.average, react: 0 }), i = 0, last = null;
      for (let n = 0; n < 1800 && s.stepN === 0; n++) {
        if (i >= steps.length) { steps = plan(guide(s.rep), { ...SKILLS.average, react: 0 }, [50, 50]); i = 0; }
        const st = steps[i++];
        if (st) { input(s, st); last = st; }
        step(s);
      }
      return { s, last };
    };
    let carried = 0, tried = 0;
    for (const kind of ['rub', 'sew', 'balance', 'sharpen', 'glue', 'zip']) {
      const { s, last } = twoStep(kind);
      if (s.stepN !== 1 || !s.finger.down) continue;
      tried++;
      const { cx, cy } = s.rep;
      for (let i = 1; i <= 10; i++) { input(s, { type: 'move', x: last.x + (cx + 20 - last.x) * i / 10, y: last.y + (cy - last.y) * i / 10 }); step(s); }
      for (let i = 1; i <= 36; i++) { input(s, { type: 'move', x: cx + 20 * Math.cos(i * Math.PI / 12), y: cy + 20 * Math.sin(i * Math.PI / 12) }); step(s); }
      if (s.rep.p >= 0.25) carried++;
    }
    claim(tried >= 4 && carried === tried, `a circle that goes straight on from the first repair turns the screw (${carried} of ${tried})`);
    // ...but a finger left down from the last customer still does nothing to the next customer's job until it lifts.
    const s = create({ seed: 2, unlocked: KINDS, only: 'sharpen', two: 0, golden: 0 });
    const g = guide(s.rep);
    input(s, { type: 'down', x: g.from[0], y: g.from[1] });
    for (let i = 0; i < 600 && s.served === 0; i++) { input(s, { type: 'move', x: i % 20 < 10 ? g.from[0] : g.to[0], y: g.from[1] }); step(s); }
    for (let i = 0; i < 60; i++) step(s);
    for (let i = 0; i < 60; i++) { input(s, { type: 'move', x: i % 20 < 10 ? g.from[0] : g.to[0], y: g.from[1] }); step(s); }
    claim(s.served === 1 && s.rep.best === 0, 'a finger still down from the last customer does nothing to the next job until it lifts');
  }

  // Middle and late game audit: in both browsers the clock hand stopped just short of the star after the finger was lifted
  // on it, and needed a second push. A release within 20 degrees of the star now finishes the turn.
  {
    const clock = create({ only: 'clock' }), r = clock.rep, at = a => [r.cx + 30 * Math.cos(a * Math.PI / 180), r.cy + 30 * Math.sin(a * Math.PI / 180)];
    let a = r.hand;
    input(clock, { type: 'down', x: at(a)[0], y: at(a)[1] });
    while (a < r.target - 18) { a = Math.min(r.target - 18, a + 4); input(clock, { type: 'move', x: at(a)[0], y: at(a)[1] }); step(clock); }
    input(clock, { type: 'up', x: at(a)[0], y: at(a)[1] });
    for (let i = 0; i < 90; i++) step(clock);
    claim(clock.served === 1, 'lifting the finger just short of the clock star still sets the clock');
    const early = create({ only: 'clock' }), e = early.rep;
    let b = e.hand;
    const on = d => [e.cx + 30 * Math.cos(d * Math.PI / 180), e.cy + 30 * Math.sin(d * Math.PI / 180)];
    input(early, { type: 'down', x: on(b)[0], y: on(b)[1] });
    while (b < e.target - 60) { b = Math.min(e.target - 60, b + 4); input(early, { type: 'move', x: on(b)[0], y: on(b)[1] }); step(early); }
    input(early, { type: 'up', x: on(b)[0], y: on(b)[1] });
    for (let i = 0; i < 90; i++) step(early);
    claim(early.served === 0, 'lifting the finger well before the clock star does not set it');
  }

  const scale = create({ only: 'balance' }), g = guide(scale.rep);
  const approach = ghost(g, 0.25), holding = ghost(g, 1.2), stillHolding = ghost(g, 1.5);
  input(scale, { type: 'down', x: g.from[0], y: g.from[1] });
  input(scale, { type: 'move', x: g.targets[0], y: g.from[1] });
  for (let i = 0; i < 22; i++) step(scale);
  claim(approach.p[0] !== holding.p[0] && holding.p[0] === g.targets[0] && holding.press && stillHolding.press &&
    holding.p[0] === stillHolding.p[0] && scale.rep.grab && scale.rep.dwell > 0, 'the scale shows sliding and then staying pressed on the mark');
  const bell = create({ only: 'screw' }).rep, circle = guide(bell);
  const sweep = [0, 0.225, 0.45, 0.675].map(t => ghost(circle, t).p);
  claim(circle.type === 'circle' && sweep.every(([x, y]) => Math.abs(Math.hypot(x - bell.cx, y - bell.cy) - circle.r) < 1e-8) &&
    sweep[0][0] > bell.cx && sweep[2][0] < bell.cx && sweep[1][1] > bell.cy && sweep[3][1] < bell.cy,
  'the bell demonstrates a circle centered on the screw');
}

const setList = create({ lv: opening[2], hearts: 4 });
claim(setList.maxHearts === 1 && setList.hearts === 1,
  'the hearts on a set-list job show the one walk-off allowed before failure');

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
  let lost = 0, golden = 0, paidOk = true, worst = 0, wageOk = true;
  for (let seed = 1; seed <= 10; seed++) {
    const { s, paid } = play({ seed, ...ALL, golden: 1, startLevel: LEVELS - 1, day: TOP + 60, hearts: 99 }, skilled(SKILLS.competent), 90);
    for (const l of s.log.filter(l => l.golden)) { golden++; if (!l.ok) lost++; else worst = Math.max(worst, l.ms); }
    for (const e of paid) if (e.golden && e.coins < 4 * e.kinds.length * 2) paidOk = false;
    // the page shows the goal's share of each pay apart from the wallet's: the event must say what that share is
    for (const e of paid) if (e.wage !== e.kinds.reduce((a, k) => a + COIN[k], 0) || (e.golden && !(e.wage < e.coins))) wageOk = false;
    if (paid.reduce((a, e) => a + e.wage, 0) !== s.goalCoins) wageOk = false;
  }
  claim(wageOk, 'each pay names its goal share (the repairs\' prices), the shares add up to the goal count, and a golden pay is more than its share');
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

// A gesture that would pass an older repair must not skip the distinguishing steps here.
{
  const gesture = (s, type, [x, y]) => input(s, { type, x, y });
  const wind = create({ only: 'wind' });
  const crank = guide(wind.rep);
  gesture(wind, 'down', [crank.cx + crank.r * Math.cos(crank.from * Math.PI / 180),
    crank.cy + crank.r * Math.sin(crank.from * Math.PI / 180)]);
  for (let a = crank.from + 2; a < crank.from + 360 * 4; a += 2) {
    gesture(wind, 'move', [crank.cx + crank.r * Math.cos(a * Math.PI / 180),
      crank.cy + crank.r * Math.sin(a * Math.PI / 180)]);
  }
  claim(wind.served === 0, 'going around the winding drum in one direction does not finish');

  const scale = create({ only: 'balance' }), g = guide(scale.rep);
  gesture(scale, 'down', g.from);
  gesture(scale, 'move', [g.targets[0], g.from[1]]);
  for (let i = 0; i < 90; i++) step(scale);
  claim(scale.rep.stage === 1 && scale.served === 0, 'parking the scale at the first balance does not finish');

  const tile = create({ only: 'trace' }), path = guide(tile.rep).pts;
  gesture(tile, 'down', path[0]);
  gesture(tile, 'move', path.at(-1));
  claim(tile.served === 0 && tile.rep.p < 0.5, 'a straight shortcut does not seal the crack');
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
claim(table.slow.someLoss > 0 && table.slow.someLoss < 40, `slow bot loses a heart in ${table.slow.someLoss} of 40 shifts once the ramp is up`);
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
function level(def, policy, assisted = false) {
  const { s } = play({ lv: def, assisted }, policy, 400);
  return { cleared: s.over === 'clear', why: s.over, stars: stars(s), secs: s.clearT, len: s.t, coins: s.coins, served: s.served, lost: s.lost, s };
}
// Measures the time limits, coin targets and star times for every level and prints them as TUNE for levels.js.
// A level's goal is played without a time limit by the slow, average, competent and expert bots (no wobble). Coin
// targets are 94% of the fixed wages a competent bot has credited when it has fixed the shape's number of customers. A time limit runs
// from 1.15 x the slow bot's time (level 2) to 1.25 x the competent bot's time (the last level), so early levels wait
// for a slow player and late ones need a quick one. Three stars need the expert's time plus 10%; two stars the
// average bot's time plus 5%, capped at the competent bot's time plus 30%. The slow time counts at most 1.6 x average.
function calibrate() {
  const out = {};
  for (let n = 1; n <= COUNT; n++) {
    const base = levelDef(n), shape = base.shape, free = { ...base, goal: { ...base.goal } };
    delete free.goal.time;
    if (shape.coinJobs) {
      const probe = { ...free, goal: { fix: shape.coinJobs } };
      free.goal.coins = Math.round(level(probe, skilled(SKILLS.competent)).s.goalCoins * 0.94);
    }
    const [sl, av, c, e] = ['slow', 'average', 'competent', 'expert'].map(k => level(free, skilled(SKILLS[k])));
    if (!c.cleared || !e.cleared || !av.cleared) { console.log(`level ${n}: average ${av.why}, competent ${c.why}, expert ${e.why}`); continue; }
    const k = Math.max(0, n - 2) / (COUNT - 2), slowT = Math.min(sl.cleared ? sl.secs : Infinity, av.secs * 1.6);
    const t = { stars: [Math.ceil(e.secs * 1.1), Math.max(Math.ceil(e.secs * 1.1) + 2, Math.min(Math.ceil(av.secs * 1.05), Math.ceil(c.secs * 1.3)))] };
    if (shape.time) t.time = Math.max(t.stars[1] + 4, Math.ceil(((1 - k) * slowT * 1.15 + k * c.secs * 1.25) / 5) * 5);
    if (shape.coinJobs) t.coins = free.goal.coins;
    out[n] = t;
    console.log(`level ${String(n).padStart(2)}: slow ${sl.cleared ? sl.secs.toFixed(1) : sl.why}, average ${av.secs.toFixed(1)}, competent ${c.secs.toFixed(1)}, expert ${e.secs.toFixed(1)} s -> ${JSON.stringify(t)}`);
  }
  console.log('export const TUNE = {\n' + Object.entries(out).map(([n, t]) => `  ${n}: ${JSON.stringify(t).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ')},`).join('\n') + '\n};');
}

function withRetries(def, makePolicy) {
  let failures = 0;
  do {
    const used = canAssist(failures);
    const run = level(def, makePolicy(), used);
    if (run.cleared || used) return { ...run, failures, used };
    failures++;
  } while (true);
}

function levels() {
  const wobble = 6, rows = [];
  console.log(`\nMap levels, ${COUNT} of them. The slow bot replays after two closed failures, then chooses the slower clock.`);
  console.log('lvl rule/intro  comp★   exp★   comp s  exp s   avg★   slow normal  slow with retries  assisted');
  let competentClear = 0, expertThree = 0, skilledUnchanged = true;
  for (const def of MAP) {
    const c = level(def, skilled(SKILLS.competent)), e = level(def, skilled(SKILLS.expert));
    const row = { n: def.n, c, e, slow: 0, clears: 0, assists: 0, stars: 0, len: 0, assistFailures: [] };
    for (let k = 0; k <= wobble; k++) {
      const policy = skill => k ? noisy(SKILLS[skill], k) : skilled(SKILLS[skill]);
      for (const skill of ['competent', 'expert']) {
        const before = level(def, policy(skill)), after = withRetries(def, () => policy(skill));
        if (skill === 'competent') competentClear += Number(before.cleared);
        else expertThree += Number(before.stars === 3);
        skilledUnchanged &&= !after.used && before.why === after.why && before.stars === after.stars
          && before.coins === after.coins && before.secs === after.secs;
      }
      const run = withRetries(def, () => policy('slow'));
      if (!run.used) row.slow++;
      if (run.cleared) row.clears++;
      if (run.used) {
        row.assists++;
        if (!run.cleared || run.stars > 2 || run.failures !== 2) row.assistFailures.push(k);
      }
      const avg = level(def, policy('average'));
      row.stars += avg.stars; row.len += avg.len;
    }
    rows.push(row);
    const attempts = wobble + 1;
    const label = def.rule ?? def.intro ?? (def.goal.coins ? 'coins' : 'mixed');
    console.log(`${String(def.n).padStart(3)} ${label.padEnd(10)} ${c.stars}       ${e.stars}    ${c.secs.toFixed(1).padStart(6)} ${e.secs.toFixed(1).padStart(6)}    ${(row.stars / attempts).toFixed(1)}     ${row.slow}/${attempts}          ${row.clears}/${attempts}               ${row.assists}`);
  }
  const total = COUNT * (wobble + 1);
  claim(competentClear === total, `competent clears ${competentClear}/${total}`);
  claim(rows.every(r => r.c.stars >= 2), 'the plain competent bot earns at least two stars on each level');
  claim(rows.every(r => r.e.stars === 3) && expertThree >= total * 0.8, `the plain expert three-stars every level and expert three-stars ${expertThree}/${total} across all runs`);
  claim(skilledUnchanged, 'the retry policy changes no competent or expert clear, coins, stars or clear time');
  // Middle and late game audit: two touch players lost level 42 on every first try; the slow bot needed the assist on 38 and 42.
  const rushRows = rows.filter(r => MAP[r.n - 1].rule === 'rush');
  claim(rushRows.every(r => r.slow >= 5), `a slow player can clear every rush level without the assist (${rushRows.map(r => `${r.n}: ${r.slow}/${wobble + 1}`).join(', ')})`);
  const stuck = rows.flatMap(r => r.assistFailures.map(k => `${r.n}/${k}`));
  claim(!stuck.length && rows.some(r => r.assists > 0), `the slow bot clears every level on each input profile with up to two failures and the assist when needed${stuck.length ? ' (stuck on ' + stuck.join(', ') + ')' : ''}`);
  const capped = level(MAP[0], skilled(SKILLS.expert), true);
  claim(capped.secs <= MAP[0].stars[0] && capped.stars === 2, 'an assisted three-star time earns only two stars');
  const allUnskilled = MAP.every(d => !level(d, idle).cleared && !level(d, scribbler(d.n)).cleared && !level(d, idle, true).cleared);
  claim(allUnskilled, 'idle and random pointer bots clear no level, and help alone does not clear one');

  console.log('band        slow unaided  slow with retries  average stars  average length (s)');
  const attempts = wobble + 1;
  for (const [start, end] of [[1, 15], [16, BUSY_END], [BUSY_END + 1, COUNT]]) {
    const range = rows.slice(start - 1, end), count = range.length * attempts;
    const sum = key => range.reduce((total, row) => total + row[key], 0);
    console.log(`${start}-${end}        ${sum('slow')}/${count}       ${sum('clears')}/${count}             ${(sum('stars') / count).toFixed(2)}        ${(sum('len') / count).toFixed(0)}`);
  }
  const coinRows = rows.filter(r => MAP[r.n - 1].goal.coins);
  const coinPlain = coinRows.reduce((total, r) => total + r.slow, 0);
  const coinClear = coinRows.reduce((total, r) => total + r.clears, 0);
  console.log(`Coin goals: ${coinPlain}/${coinRows.length * attempts} slow unaided, ${coinClear}/${coinRows.length * attempts} with retries`);
  const lessons = MAP.filter(d => d.intro);
  claim(lessons.length === KINDS.length && lessons.every((d, i) => create({ lv: d }).cust.kinds[0] === OPEN_ORDER[i]), 'every repair is the first job in its lesson');
  claim(new Set(MAP.slice(BUSY_END).map(d => d.rule)).size === 4 && COUNT - BUSY_END === 12, 'night market has 12 levels across four rules');

  const timed = MAP.filter(d => d.goal.time);
  claim(timed.every(d => !level({ ...d, goal: { ...d.goal, time: rows[d.n - 1].c.secs * 0.8 } }, skilled(SKILLS.competent)).cleared), 'an ordinary timed level fails if its deadline is shortened to 80% of the competent time');
  const same = () => level(MAP[20], noisy(SKILLS.average, 3));
  const a = same(), b = same();
  claim(a.secs === b.secs && a.coins === b.coins && a.stars === b.stars, 'a seeded level is deterministic with the same input profile');
  claim(levelReward(27, 2, 0) === 37 && levelReward(90, 2, 2) === 0
    && levelReward(90, 3, 2) === 5 && levelReward(90, 0, 0) === 0, 'only the first clear pays repair coins; new stars pay once');

  const rush = create({ lv: MAP[41] });
  const waitBefore = rush.lanes[1].left;
  step(rush);
  const first = rush.rep;
  const switchedBack = selectLane(rush, 1) && selectLane(rush, 0);
  claim(switchedBack && rush.lanes[1].left < waitBefore && rush.rep === first, 'both rush clocks tick and switching preserves the repair');
  for (let i = 0; i < 2000 && !rush.over; i++) step(rush);
  claim(rush.over === 'lost' && rush.station === 1 && rush.lost === 1, 'ignoring the more urgent rush customer loses the level');
  const order = create({ lv: MAP[32] });
  const initial = order.cust.left;
  claim(!chooseTicket(order, 1) && order.choosing && order.cust.left < initial
    && chooseTicket(order, 0) && !order.choosing, 'a wrong ticket costs patience and the right ticket opens the repair');
  const baseWage = create({ lv: MAP[3] });
  Object.assign(baseWage, { coins: 1000, goalCoins: 2 });
  claim(goalState(baseWage).parts[0].have === 2 && !goalState(baseWage).met, 'coin goals ignore quick and combo bonuses');
}
