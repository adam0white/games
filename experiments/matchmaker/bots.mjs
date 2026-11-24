// Good Match: independent outcome checks, visible-information solver, and difficulty bots.
// node experiments/matchmaker/bots.mjs
// node experiments/matchmaker/bots.mjs --mutate  (MUST fail)
// Mutation: remove one clock segment from every nontrivial street, breaking the rule
// that u unknown specialists receive u−1 observations. The exact same solver checks
// then fail; no assertions are disabled or inverted in mutation mode.
import { create, tryout, canTryout, place, finish, inspectionPolicy, consistentAssignments,
  solve, permutations, dailySeed, rand, LEVELS } from './sim.js';

const mutation = process.argv.includes('--mutate');
let failures = 0, reported = 0;
function check(ok, message) {
  if (!ok) { failures++; if (reported++ < 12) console.error('FAIL ' + message); }
}
function make(options) {
  const s = create(options);
  if (mutation && s.budget > 0) s.budget = s.remaining = s.budget - 1;
  return s;
}
const ids = s => s.helpers.map((_, i) => i);
// Reference scorer enumerates every possible assignment using hidden truth ONLY to
// assess the answer after play. The careful bot below never calls this scorer.
function reference(s) {
  const scores = permutations(ids(s)).map(assignment => ({ assignment,
    score: assignment.reduce((v, h, d) => v + Number(s.helpers[h].truth[s.doors[d].skill]), 0) }));
  const best = Math.max(...scores.map(x => x.score));
  return { best, winners: scores.filter(x => x.score === best) };
}
// Strip all hidden state, including seed. Accidental truth/tryoutSkill access throws.
function visible(s) {
  return { phase: s.phase, remaining: s.remaining, doors: s.doors,
    helpers: s.helpers.map(h => {
      const v = { id: h.id, temperament: h.temperament, reputation: h.reputation, clues: h.clues };
      for (const key of ['truth', 'tryoutSkill']) Object.defineProperty(v, key,
        { get() { throw new Error('Solver read hidden ' + key); } });
      return v;
    }) };
}
function careful(s) {
  let p = inspectionPolicy(visible(s)), taps = 0;
  while (!p.unique && p.helper !== null && taps <= s.helpers.length) {
    if (!tryout(s, p.helper)) break;
    taps++; p = inspectionPolicy(visible(s));
  }
  if (!p.unique) return { ok: false, taps, s, candidates: p.candidates };
  p.assignment.forEach((h, d) => place(s, h, d));
  return { ok: finish(s)?.perfect === true, taps, s, candidates: p.candidates };
}
// A clumsy beginner uses all sources but trusts hearsay without checking temperament.
// On 1/4 of streets it slowly tries one random unobserved helper. It then maximises
// visible badge agreement. Its policy does not read level, seed, budget or truth.
// There is no reaction-time penalty in this turn-based game: slow reactions are safe.
function heuristic(s, rng, saysOnly = false) {
  if (!saysOnly && rand(rng) < 0.25) {
    const open = ids(s).filter(h => canTryout(s, h));
    if (open.length) tryout(s, open[Math.floor(rand(rng) * open.length)]);
  }
  let best = -Infinity, choices = [];
  for (const assignment of permutations(ids(s))) {
    let value = 0;
    assignment.forEach((h, d) => s.helpers[h].clues.forEach(c => {
      if (saysOnly && c.source !== 'said') return;
      const agree = (s.doors[d].skill === c.skill) === c.value;
      value += (agree ? 1 : -1) * (c.source === 'seen' ? 1000 : c.source === 'heard' ? 30 : 1);
    }));
    if (value > best) { best = value; choices = [assignment]; }
    else if (value === best) choices.push(assignment);
  }
  const a = choices[Math.floor(rand(rng) * choices.length)];
  a.forEach((h, d) => place(s, h, d));
  return finish(s);
}
const N = 500, rows = [];
// Each seed is one persistent beginner, carrying only reputation actually earned.
const clumsyReputations = Array.from({ length: N }, () => []);
let maxTaps = 0, carefulWins = 0, oracleUnique = 0, initialAmbiguous = 0;
for (let level = 1; level <= LEVELS; level++) {
  let carefulCount = 0, clumsy = 0, said = 0, taps = 0, corrupted = 0;
  for (let seed = 1; seed <= N; seed++) {
    const initial = make({ level, seed }), ref = reference(initial);
    check(ref.best === initial.helpers.length && ref.winners.length === 1,
      `unique perfect assignment level ${level} seed ${seed}`);
    if (ref.winners.length === 1) oracleUnique++;
    if (consistentAssignments(initial).length > 1) initialAmbiguous++;
    if (initial.helpers.some(h => h.clues.some(c => c.source === 'heard' && !h.truth[c.skill]))) corrupted++;
    const c = careful(initial);
    check(c.ok, `visible careful policy completes level ${level}, seed ${seed}; ${c.candidates} candidate assignments left`);
    if (c.ok) carefulCount++;
    maxTaps = Math.max(maxTaps, c.taps); taps += c.taps;
    const beginner = make({ level, seed, reputation: clumsyReputations[seed - 1] });
    const beginnerResult = heuristic(beginner, { r: seed ^ 0x1f10a });
    clumsy += Number(beginnerResult.perfect);
    clumsyReputations[seed - 1] = [...new Set([...clumsyReputations[seed - 1], ...beginnerResult.reputation])];
    said += Number(heuristic(make({ level, seed }), { r: seed ^ 0x1f10a }, true).perfect);
  }
  carefulWins += carefulCount;
  rows.push({ level, helpers: create({ level }).helpers.length,
    careful: carefulCount, clumsy, saysOnly: said, misleading: corrupted, meanTaps: (taps / N).toFixed(2) });
}
check(rows[0].clumsy === N, `clumsy beginner always finishes the teaching street (${rows[0].clumsy}/${N})`);
for (let i = 1; i < rows.length; i++) check(rows[i].clumsy < rows[i - 1].clumsy,
  `clumsy success falls level ${i}→${i + 1}: ${rows[i - 1].clumsy}→${rows[i].clumsy}/${N}`);
check(rows.slice(10).every(r => r.saysOnly < N * 0.15), 'speech-only bot fails at least 85% of later streets');

// Every possible hidden world consistent with initial visible evidence is solvable,
// not only the world the generator selected. This independently checks policy reachability.
let worlds = 0, worldWins = 0;
for (const level of [2, 7, 8, 13, 14, 20]) for (let seed = 1; seed <= 10; seed++) {
  const original = make({ level, seed });
  for (const world of consistentAssignments(original)) {
    const s = JSON.parse(JSON.stringify(original));
    world.forEach((h, d) => {
      const skill = s.doors[d].skill;
      s.helpers[h].tryoutSkill = skill;
      s.helpers[h].truth = s.helpers[h].truth.map((_, k) => k === skill);
    });
    const won = careful(s).ok;
    check(won, `all consistent worlds reachable level ${level}, seed ${seed}`); worlds++; worldWins += Number(won);
  }
}
// Reputations are earned by correct placements, are reliable, and save inspections.
let saved = 0;
for (let seed = 1; seed <= 100; seed++) {
  const fresh = make({ level: 20, seed }), reputations = fresh.helpers.map(h => h.id);
  const returning = make({ level: 20, seed, reputation: reputations });
  check(returning.helpers.every(h => h.reputation && h.clues.some(c => c.source === 'heard' && h.truth[c.skill])), 'starred hearsay is exact');
  check(consistentAssignments(returning).length === 1, 'returning specialists resolve from reputation');
  saved += solve(fresh).tryouts.length - solve(returning).tryouts.length;
}
check(saved > 0, `reputation saves actual tryouts (${saved} across 100 streets)`);
// Play the actual 20-street campaign with accumulated earned reputation. A single
// returning specialist replaces the eye anchor; new faces preserve later uncertainty.
let campaignReputation = [], campaignWins = 0, campaignReturns = 0, campaignLate = 0;
for (let level = 1; level <= LEVELS; level++) {
  const s = make({ level, seed: 10241 + level * 701, reputation: campaignReputation });
  const returning = s.helpers.filter(h => h.reputation);
  check(returning.length <= 1, `campaign street ${level} has at most one returning specialist`);
  campaignReturns += returning.length;
  if (returning.length) check(returning[0].clues.every(c => c.source !== 'seen'),
    `reputation substitutes for the eye anchor at street ${level}`);
  if (level >= 8) {
    check(s.budget === s.helpers.length - 2 && consistentAssignments(s).length > 1,
      `earned reputation preserves late-street uncertainty at level ${level}`);
    campaignLate++;
  }
  const c = careful(s);
  check(c.ok, `sequential campaign completes level ${level}`);
  if (c.ok) { campaignWins++; campaignReputation = [...new Set([...campaignReputation, ...s.result.reputation])]; }
}
check(campaignReturns > 0, 'earned specialists actually return during the campaign');
// Same seed + same action log gives byte-identical state, including events.
for (const level of [1, 7, 14, 20]) {
  const a = make({ level, seed: 7781 }), b = make({ level, seed: 7781 });
  const plan = solve(a);
  for (const h of plan.tryouts) { tryout(a, h); tryout(b, h); }
  if (plan.assignment) plan.assignment.forEach((h, d) => { place(a, h, d); place(b, h, d); });
  finish(a); finish(b);
  check(JSON.stringify(a) === JSON.stringify(b), `deterministic full action replay at level ${level}`);
}
check(dailySeed('2026-11-23') === dailySeed('2026-11-23') && dailySeed('2026-11-23') !== dailySeed('2026-11-24'), 'daily seed is shared and changes by date');
// Input rejection, swap, no duplicate helpers, and terminal idempotence.
{
  const s = make({ level: 14, seed: 12 });
  check(place(s, -1, 0) === false && place(s, 0, 99) === false, 'invalid placements rejected');
  place(s, 0, 0); place(s, 1, 1); place(s, 0, 1);
  check(s.placements[0] === 1 && s.placements[1] === 0, 'occupied-door swap preserves both helpers');
  place(s, 2, 1);
  check(s.placements.filter(v => v === 0).length === 0 && s.placements[1] === 2, 'unplaced helper bumps previous occupant');
  const test = make({ level: 20, seed: 22 });
  const known = test.helpers.findIndex(h => h.clues.some(c => c.source === 'seen'));
  const before = test.remaining;
  check(tryout(test, known) === null && tryout(test, -1) === null && test.remaining === before,
    'known or invalid tryout costs nothing');
  const first = ids(test).find(h => canTryout(test, h));
  tryout(test, first);
  const after = test.remaining;
  check(tryout(test, first) === null && test.remaining === after, 'duplicate tryout costs nothing');
  for (const h of ids(test)) if (canTryout(test, h)) tryout(test, h);
  check(test.remaining === 0 && ids(test).every(h => tryout(test, h) === null), 'exhausted clock refuses further observations');
  const partial = create({ level: 14, seed: 22 });
  const answer = solve(partial).assignment;
  [answer[0], answer[1]] = [answer[1], answer[0]];
  answer.forEach((h, d) => place(partial, h, d));
  check(finish(partial).stars === 2 && partial.result.correct === 3, 'three of five matches earns two stars');
  const c = careful(make({ level: 1, seed: 12 }));
  const snapshot = JSON.stringify(c.s);
  check(tryout(c.s, 0) === null && !place(c.s, 0, 0), 'ended street rejects actions');
  finish(c.s); check(snapshot === JSON.stringify(c.s), 'finish is idempotent');
}
console.log('Clumsy column: 500 persistent campaigns, carrying reputation earned on earlier streets.');
console.table(rows);
console.log(`Careful ${carefulWins}/${N * LEVELS}; unique true optimum ${oracleUnique}/${N * LEVELS}; initially ambiguous ${initialAmbiguous}; max tryouts ${maxTaps}.`);
console.log(`Every compatible truth world: ${worldWins}/${worlds} solved; reputation saved ${saved} tryouts on 100 streets.`);
console.log(`Sequential campaign: ${campaignWins}/20 perfect, ${campaignReturns} returning appearances; all ${campaignLate} late streets retain uncertainty.`);
console.log(`Slow reactions have no penalty; 2-second tryout animation belongs to the page, not these rules.`);
console.log(`${failures ? 'FAILED' : 'PASS'}: ${failures} failures${mutation ? ' (clock-budget mutation active)' : ''}.`);
process.exitCode = failures ? 1 : 0;
