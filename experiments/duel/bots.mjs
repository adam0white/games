// Proves the rules of Thumb Duel: node experiments/duel/bots.mjs [--mutate | --mutate=late] [--quick] [--friend]
// Bots play through the same input a finger gives each tick, with reaction times and
// tap rates capped at what a thumb can do (brain.js THUMB). Exits non-zero when a claim fails.
//
// Levels: the solo mode's three bot strengths are the levels (easy, medium, hard). "A clumsy bot finishes level 1" means
// a clumsy player wins most matches against the easy bot; "difficulty rises" means that share falls from easy to medium
// to hard; "a careful bot finishes every level" means a careful player beats all three most of the time.
//
// --mutate breaks one rule on purpose: in tug of war a tap from the top player pulls the rope toward the BOTTOM (as if
// the top side's direction had been copied from the bottom's). The seat-fairness and careful-beats-idle claims must fail.
// --mutate=late breaks playing a friend by link: one phone files the friend's inputs at the wrong tick (link-bots.mjs);
// the claims that both phones stay identical must fail. --friend runs only the link claims (section 8).
import { createMatch, step, blank, mutate, KINDS, WIN, DUELS, CONTROL, LAUNCH, SWIPE } from './sim.js';
import { makeBot, SKILLS, THUMB, STRENGTHS } from './brain.js';

import { linkClaims } from './link-bots.mjs';

const MUTATE = process.argv.includes('--mutate'), QUICK = process.argv.includes('--quick');
const LATE = process.argv.includes('--mutate=late'), FRIEND = process.argv.includes('--friend') || LATE;
if (MUTATE) { mutate('tug'); console.log('MUTATION: a tap from the top side pulls the rope toward the bottom\n'); }
let failed = 0;
function claim(ok, text) { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failed++; }
const pct = (a, n) => `${Math.round(100 * a / n)}%`;
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const idle = { act: () => blank() };
const bot = (name, seed) => name === 'idle' ? idle : makeBot(name, seed);

// Plays a match (or, with oneDuel, only its first duel). Counts each side's taps per second to check the thumb cap.
function play(opts, a, b, oneDuel = false) {
  const s = createMatch(opts), bots = [a, b], taps = [[], []];
  while (!s.over && s.t < 900) {
    const inp = [bots[0].act(s, 0), bots[1].act(s, 1)];
    for (const i of [0, 1]) if (inp[i].taps.length) taps[i].push(s.t);
    step(s, inp);
    s.events.length = 0;
    if (oneDuel && s.duels.length) break;
  }
  let fastest = 0; // most taps by one side inside any 1 s window
  for (const list of taps) for (let i = 0, j = 0; i < list.length; i++) { while (list[i] - list[j] > 1) j++; fastest = Math.max(fastest, i - j + 1); }
  return { s, fastest };
}
const duel = (kind, seed, a, b) => play({ seed, only: kind, intro: 0.2, result: 0.05 }, a, b, true);

const t0 = Date.now();
if (FRIEND) { // only section 8
  linkClaims({ claim, quick: QUICK, late: LATE });
  console.log(`\n${failed ? failed + ' claim(s) FAILED' : 'all claims hold'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed ? 1 : 0);
}
const N = QUICK ? 30 : 100;

// 1. Determinism: the same seed and the same bots give the same match, duel by duel.
{
  const a = play({ seed: 4242 }, makeBot('medium', 1), makeBot('clumsy', 2)).s, b = play({ seed: 4242 }, makeBot('medium', 1), makeBot('clumsy', 2)).s;
  claim(JSON.stringify(a.duels) === JSON.stringify(b.duels) && a.t === b.t, `deterministic: seed 4242 plays the same twice (${a.duels.map(d => `${d.kind}:${d.winner}`).join(' ')})`);
  const c = play({ seed: 4243 }, makeBot('medium', 1), makeBot('clumsy', 2)).s;
  claim(JSON.stringify(a.duels) !== JSON.stringify(c.duels), 'another seed gives another match');
  for (const kind of KINDS) {
    const x = duel(kind, 77, makeBot('hard', 5), makeBot('easy', 6)).s, y = duel(kind, 77, makeBot('hard', 5), makeBot('easy', 6)).s;
    if (JSON.stringify([x.d, x.duels]) !== JSON.stringify([y.d, y.duels])) claim(false, `deterministic ${kind}`);
  }
}

// 2. The deck: at least 9 kinds; a match draws without repeats; a first-ever match opens with tug.
{
  claim(KINDS.length >= 9 && KINDS.every(k => DUELS[k] && CONTROL[k]), `${KINDS.length} duel kinds, each with a control: ${KINDS.map(k => `${k} (${CONTROL[k]})`).join(', ')}`);
  let repeats = 0, firstTug = 0, seenKinds = new Set(), lengths = [];
  for (let seed = 1; seed <= 200; seed++) {
    const s = play({ seed, first: seed % 2 ? 'tug' : null }, makeBot('medium', seed), makeBot('medium', seed + 999)).s;
    const ks = s.duels.map(d => d.kind).slice(0, KINDS.length);
    if (new Set(ks).size !== ks.length) repeats++;
    if (seed % 2 && s.duels[0].kind === 'tug') firstTug++;
    s.duels.forEach(d => seenKinds.add(d.kind)); lengths.push(s.duels.length);
    if (!(s.score[0] === WIN || s.score[1] === WIN)) repeats += 1000; // every match ends with a side on 3
  }
  claim(repeats === 0, 'no duel repeats inside a match, and every match ends with one side on 3 wins');
  claim(firstTug === 100, 'a first-ever match opens with tug of war (100 of 100)');
  claim(seenKinds.size === KINDS.length, `every kind turns up (${seenKinds.size})`);
  console.log(`     duels per match: median ${median(lengths)}, longest ${Math.max(...lengths)}`);
}

// 3. Tie rules, scripted: both sides tapping on the same tick.
{
  const tick = (s, a, b) => { step(s, [a, b]); s.events.length = 0; };
  const tap = (side) => ({ held: true, taps: [{ x: 0.5, y: side === 0 ? 0.5 : -0.5 }], px: null, py: null });
  const s = createMatch({ seed: 3, only: 'draw', intro: 0 }); tick(s, blank(), blank());
  while (s.d.st !== 'lit') tick(s, blank(), blank());
  tick(s, tap(0), tap(1));
  claim(s.d.last?.why === 'tie' && s.d.wins[0] === 0 && s.d.wins[1] === 0, 'quick draw: both on time on the same tick makes the flash void');
  const e = createMatch({ seed: 3, only: 'draw', intro: 0 }); tick(e, blank(), blank());
  tick(e, tap(0), tap(1));
  claim(e.d.last?.why === 'early-both' && e.d.wins.join() === '0,0', 'quick draw: both early on the same tick makes the flash void');
  const one = createMatch({ seed: 3, only: 'draw', intro: 0 }); tick(one, blank(), blank());
  tick(one, blank(), tap(1));
  claim(one.d.last?.why === 'early' && one.d.wins.join() === '1,0', 'quick draw: an early tap gives the flash to the other side');
  const c = createMatch({ seed: 5, only: 'catch', intro: 0 }); tick(c, blank(), blank());
  while (c.d.mode !== 'dwell') tick(c, blank(), blank());
  const on = c.d.y > 0 ? 0 : 1;
  tick(c, tap(0), tap(1));
  claim(c.d.caught[on] === 1 && c.d.caught[1 - on] === 0 && c.d.stun[1 - on] > 0, 'catch: both tap on the same tick: the side the firefly is on catches it, the other is dazed');
  const m = createMatch({ seed: 9, only: 'memory', intro: 0 }); tick(m, blank(), blank());
  while (m.d.st !== 'answer') tick(m, blank(), blank());
  const pads = side => m.d.seq.map(p => { const P = [[0.29, 0.36], [0.71, 0.36], [0.29, 0.72], [0.71, 0.72]][p]; return side === 0 ? { x: P[0], y: P[1] } : { x: 1 - P[0], y: -P[1] }; });
  const all = [pads(0), pads(1)];
  tick(m, { ...blank(), taps: all[0] }, { ...blank(), taps: all[1] });
  claim(m.d.last === -1 && m.d.wins.join() === '0,0', 'memory: both finishing on the same tick makes the round void');

  const race = createMatch({ seed: 9, only: 'swipe', intro: 0 }); tick(race, blank(), blank());
  const released = gesture => ({ ...blank(), releases: [gesture] });
  const up = { x0: 0.5, y0: 0.75, x: 0.5, y: 0.35, seconds: 0.2 };
  const down = { ...up, y0: -up.y0, y: -up.y };
  tick(race, released({ ...up, x: 0.8 }), released({ ...down, seconds: 0.6 }));
  tick(race, released({ ...up, y: up.y0 }), released({ ...down, y: -0.95 }));
  claim(race.d.strokes.join() === '0,0', 'swipe: stationary, sideways, backward and slow releases do not score');
  for (let n = 0; n < SWIPE.need; n++) {
    tick(race, released(up), released(down));
    for (let i = 0; i < 12 && race.phase === 'play'; i++) tick(race, blank(), blank());
  }
  claim(race.duels[0]?.winner === -1 && race.d.strokes.every(n => n === SWIPE.need), 'swipe: both reaching the finish on the same tick draws');

  const l = createMatch({ seed: 9, only: 'launch', intro: 0 }); tick(l, blank(), blank());
  const shot = seconds => released({ seconds });
  tick(l, shot(0.05), { ...blank(), held: true, heldFor: 1 });
  claim(l.d.shots.join() === '0,0' && l.d.charge[1] === 1, 'launch: a tap cannot fire, and holding only builds charge');
  for (const target of l.d.targets) tick(l, shot(target + 0.6), shot(target));
  claim(l.duels[0]?.winner === 1 && l.d.scores.join() === `0,${100 * LAUNCH.shots}`, 'launch: a release at the mark beats an overcharge');
}

// 4. Every duel kind: careful beats idle from either seat; careful beats clumsy from either seat; the same bot on both
//    seats wins about half from each (the top seat is mirrored, so a mirroring mistake shows here).
console.log(`\nEach duel alone, ${N} seeds per row. Seat share: how often the bottom seat wins when the same bot plays both seats.`);
console.log('kind     careful>idle  careful>clumsy(bottom/top)  seat share(medium)  median s (medium v medium)  median s (clumsy v careful)');
const durations = {};
for (const kind of KINDS) {
  let idleWins = 0;
  for (let seed = 1; seed <= 20; seed++) {
    if (duel(kind, seed, makeBot('careful', seed), idle).s.duels[0].winner === 0) idleWins++;
    if (duel(kind, seed, idle, makeBot('careful', seed)).s.duels[0].winner === 1) idleWins++;
  }
  let cb = 0, ct = 0, bottom = 0, decided = 0;
  const tMed = [], tMix = [];
  for (let seed = 1; seed <= N; seed++) {
    const r1 = duel(kind, seed, makeBot('careful', seed), makeBot('clumsy', seed + 50)).s; if (r1.duels[0].winner === 0) cb++; tMix.push(r1.duels[0].t);
    const r2 = duel(kind, seed, makeBot('clumsy', seed + 50), makeBot('careful', seed)).s; if (r2.duels[0].winner === 1) ct++;
  }
  for (let seed = 1; seed <= 2 * N; seed++) { // the bots' own seeds swap seats every other duel
    const [p, q] = seed % 2 ? [seed, seed + 7] : [seed + 7, seed];
    const r3 = duel(kind, seed + 500, makeBot('medium', p), makeBot('medium', q)).s;
    tMed.push(r3.duels[0].t);
    if (r3.duels[0].winner >= 0) { decided++; if (r3.duels[0].winner === 0) bottom++; }
  }
  const sorted = [...tMed].sort((x, y) => x - y);
  durations[kind] = { med: median(tMed), mix: median(tMix), p90: sorted[Math.floor(0.9 * sorted.length)], max: sorted[sorted.length - 1] };
  console.log(`${kind.padEnd(8)} ${String(idleWins).padStart(5)}/40      ${pct(cb, N).padStart(5)} / ${pct(ct, N).padEnd(5)}             ${pct(bottom, decided).padStart(4)} of ${decided}          ${median(tMed).toFixed(2).padStart(5)}                       ${median(tMix).toFixed(2).padStart(5)}`);
  claim(idleWins === 40, `${kind}: a careful bot beats a player who does nothing, from either seat (${idleWins}/40)`);
  claim(cb >= 0.7 * N && ct >= 0.7 * N, `${kind}: careful beats clumsy from either seat (${pct(cb, N)} bottom, ${pct(ct, N)} top)`);
  claim(decided >= N && bottom / decided >= 0.4 && bottom / decided <= 0.6, `${kind}: no seat advantage, the bottom seat wins ${pct(bottom, decided)} of ${decided} decided duels between equal bots`);
  if (kind === 'hockey') {
    const draws = 2 * N - decided, med = durations[kind].med;
    claim(med >= 10 && med <= 14, `hockey: median ${med.toFixed(2)} s is in 10–14 s`);
    claim(draws / (2 * N) < 0.05, `hockey: ${draws}/${2 * N} undecided (${(100 * draws / (2 * N)).toFixed(1)}%, target <5%)`);
  }
}
{
  console.log(`     medium v medium p90 / longest s: ${KINDS.map(k => `${k} ${durations[k].p90.toFixed(2)}/${durations[k].max.toFixed(2)}`).join(', ')}`);
  const all = Object.values(durations).map(d => d.med);
  claim(all.every(t => t >= 8 && t <= 20), `every duel lasts 8 to 20 s at the median between equal bots (${KINDS.map(k => `${k} ${durations[k].med.toFixed(1)}`).join(', ')})`);
  claim(KINDS.every(k => DUELS[k].limit <= 20) && KINDS.every(k => durations[k].max <= 20 + 1e-9), `every duel has a hard limit of at most 20 s, and none ran longer (longest ${Math.max(...KINDS.map(k => durations[k].max)).toFixed(1)} s)`);
}

// 5. The levels: clumsy against each bot strength, careful against each. Full best-of-5 matches.
console.log(`\nFull matches, ${N} seeds each (first to ${WIN}):`);
const ladder = {};
for (const who of ['clumsy', 'careful']) {
  ladder[who] = {};
  for (const lvl of STRENGTHS) {
    let won = 0; const secs = [];
    for (let seed = 1; seed <= N; seed++) {
      const { s } = play({ seed: seed * 31 }, makeBot(who, seed), makeBot(lvl, seed + 1000));
      if (s.winner === 0) won++;
      secs.push(s.t);
    }
    ladder[who][lvl] = won / N;
    console.log(`  ${who.padEnd(8)} vs ${lvl.padEnd(7)} wins ${pct(won, N).padStart(4)}   match ${median(secs).toFixed(2)} s (median, with the 3 s intros)`);
  }
}
claim(ladder.clumsy.easy >= 0.65, `a clumsy player finishes level 1: beats the easy bot in ${pct(ladder.clumsy.easy * N, N)} of matches`);
claim(ladder.clumsy.easy > ladder.clumsy.medium && ladder.clumsy.medium > ladder.clumsy.hard, `difficulty rises: the clumsy player's wins fall ${STRENGTHS.map(l => pct(ladder.clumsy[l] * N, N)).join(' > ')}`);
claim(ladder.clumsy.hard <= 0.3, `the hard bot beats a clumsy player most of the time (clumsy wins ${pct(ladder.clumsy.hard * N, N)})`);
claim(STRENGTHS.every(l => ladder.careful[l] >= 0.6), `a careful player finishes every level: ${STRENGTHS.map(l => `${l} ${pct(ladder.careful[l] * N, N)}`).join(', ')}`);

// 6. Human-paced play head to head and in the first solo level, from countdown to the final result.
for (const other of ['slow-human', 'easy']) {
  const secs = [];
  for (let seed = 1; seed <= N; seed++) {
    const { s } = play({ seed: seed * 31 }, bot('slow-human', seed), bot(other, seed + 1000));
    secs.push(s.t);
  }
  const med = median(secs);
  const within = secs.filter(t => t >= 60 && t <= 180).length;
  claim(SKILLS['slow-human'].react === 0.35 && med >= 60 && med <= 180,
    `slow-human (0.35 s reaction) vs ${other}: median ${med.toFixed(2)} s, range ${Math.min(...secs).toFixed(2)}–${Math.max(...secs).toFixed(2)} s, ${within}/${N} in 60–180 s`);
}

// 7. Thumb limits: no bot taps faster than a thumb, across a spread of matches.
{
  let fastest = 0;
  for (let seed = 1; seed <= 20; seed++) fastest = Math.max(fastest, play({ seed, only: 'tug' }, makeBot('careful', seed), makeBot('hard', seed)).fastest);
  claim(fastest <= Math.ceil(THUMB.rate) + 1, `no bot taps faster than a thumb: at most ${fastest} taps in any second (cap ${THUMB.rate}/s)`);
  claim(Object.values(SKILLS).every(k => k.react >= THUMB.react), `no bot reacts faster than ${THUMB.react} s`);
}

// 8. Playing a friend by link: two phones, one duel, a bad network in between (link-bots.mjs).
console.log('\nPlaying a friend by link:');
linkClaims({ claim, quick: QUICK });

console.log(`\n${failed ? failed + ' claim(s) FAILED' : 'all claims hold'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
