import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  CASES, accuse, createCase, dailyCase, dailyWin, dossiers, freshRun, observe, offsetDay, random,
} from './sim.js';

const started = performance.now();
const replay = c => Array.from({ length: c.beatCount }, (_, beat) => observe(c, beat));

function reconstruct(cards, snapshots) {
  const identities = new Map();
  const voices = new Map(cards.map(card => [card.sound, card.id]));
  const positions = new Map();
  let previous = new Map();
  for (const frame of snapshots) {
    const at = new Map();
    const now = new Map();
    positions.set(frame.beat, at);
    if (frame.exchange) {
      const [left, right] = frame.exchange;
      assert.ok(identities.has(left) && identities.has(right), 'exchange must show known masks');
      const owner = identities.get(left);
      identities.set(left, identities.get(right));
      identities.set(right, owner);
    }
    const occupied = new Set();
    for (const actor of frame.blackout ? frame.sounds : frame.actors) {
      assert.ok(Number.isInteger(actor.slot) && actor.slot >= 0 && actor.slot < 4, 'each actor fits a drawn spot');
      const seat = `${actor.room}/${actor.slot}`;
      assert.ok(!occupied.has(seat), 'one actor per room slot');
      occupied.add(seat);
      if (actor.mask != null && !identities.has(actor.mask) && previous.has(seat)) {
        identities.set(actor.mask, previous.get(seat));
      }
      const id = frame.blackout ? voices.get(actor.sound) : actor.portrait ?? identities.get(actor.mask);
      if (id == null) continue;
      assert.ok(!at.has(id), 'one appearance per suspect per mark');
      at.set(id, actor.room);
      now.set(seat, id);
    }
    if (!frame.shutter && (frame.blackout || frame.actors.length)) {
      assert.equal(at.size, cards.length, 'every suspect has a visible identity or sound');
    }
    previous = now;
  }
  return positions;
}

function compare(cards, positions) {
  const lies = [];
  for (const { id, claim } of cards) {
    const room = positions.get(claim.beat).get(id);
    assert.notEqual(room, undefined, 'each claim can be checked from public evidence');
    if (room !== claim.room) lies.push(id);
  }
  assert.equal(lies.length, 1, 'exactly one contradiction');
  return lies[0];
}

// The only inputs are camera observations inside the crime room and the
// suspect lineup. This policy checks who was already there and who arrived
// with the incident, including sounds when the room is dark.
function crimeTape(c, snapshots) {
  return snapshots.map(({ beat, actors, sounds, incident, shutter, blackout, exchange, evidence }) => ({
    beat, incident, shutter, blackout,
    actors: actors.filter(a => a.room === c.crimeRoom),
    sounds: sounds.filter(a => a.room === c.crimeRoom),
    exchange: actors.some(a => a.room === c.crimeRoom && exchange?.includes(a.mask)) ? exchange : null,
    evidence: evidence.filter(item => item.room === c.crimeRoom),
  }));
}

function roomBot(lineup, tape, draw) {
  const before = tape.findIndex(frame => frame.incident);
  const scores = lineup.map(({ id, sound }) => {
    const sees = frame => frame && (frame.actors.some(a => a.portrait === id)
      || frame.sounds.some(a => a.sound === sound));
    return 4 * Number(Boolean(sees(tape[before]))) + Number(Boolean(sees(tape[before + 1])));
  });
  const best = Math.max(...scores);
  const tied = lineup.filter(({ id }) => scores[id] === best);
  return tied[Math.floor(draw() * tied.length)].id;
}

function prove(c) {
  const frames = replay(c);
  const cards = dossiers(c);
  const positions = reconstruct(cards, frames);
  const answer = compare(cards, positions);
  assert.equal(accuse(c, freshRun(), answer).outcome, 'solved');
  assert.equal(c.frames[c.incident][answer].room, c.crimeRoom, 'reveal agrees with the private incident');
  return { frames, cards, positions };
}

function checkAlternatives(seed, level) {
  const c = createCase({ seed, level });
  const { frames, cards } = prove(c);
  const tape = crimeTape(c, frames);
  const lineup = cards.map(({ claim, ...portrait }) => portrait);
  let wins = 0;
  for (const { id } of lineup) {
    const other = createCase({ seed, level, culpritOverride: id });
    const proof = prove(other);
    assert.deepEqual(proof.frames, frames, 'the full public replay is independent of the culprit');
    assert.deepEqual(crimeTape(other, proof.frames), tape, 'every culprit has the same crime-room tape');
    wins += Number(roomBot(lineup, tape, random(seed)) === id);

    // Flip only the two room draws necessary to retain exactly the same
    // dossiers with a different culprit. No dossier-only policy can tell.
    const flips = id === c.culprit ? [] : [id, c.culprit];
    const sameCards = createCase({ seed, level, culpritOverride: id, flipRooms: flips });
    assert.deepEqual(prove(sameCards).cards, cards, 'the same alibis admit every culprit');
  }
  assert.equal(wins, 1, 'crime-room bot is exactly at chance for this balanced lineup');
  return { wins, attempts: lineup.length };
}

const rows = [];
const totals = { correct: 0, random: 0, room: 0, chance: 0, attempts: 0, balancedWins: 0, balancedAttempts: 0 };
for (const [i, spec] of CASES.entries()) {
  const level = i + 1;
  assert.deepEqual(createCase({ level }), createCase({ level }));
  const row = { case: level, suspects: spec.count, deduced: 0, random: 0, room: 0, balanced: '—', trials: 192 };
  prove(createCase({ level }));
  let balancedWins = 0;
  let balancedAttempts = 0;
  for (let i = 0; i < row.trials; i++) {
    const seed = Math.imul(i + 1, 0x9e3779b1) >>> 0;
    const c = createCase({ seed, level });
    const { frames, cards } = prove(c);
    const draw = random(seed ^ 0x85ebca6b);
    row.deduced++;
    row.random += Number(cards[Math.floor(draw() * cards.length)].id === c.culprit);
    row.room += Number(roomBot(cards, crimeTape(c, frames), draw) === c.culprit);
    if (level >= 3 && i < 8) {
      const result = checkAlternatives(seed, level);
      balancedWins += result.wins;
      balancedAttempts += result.attempts;
    }
  }
  if (balancedAttempts) {
    row.balanced = `${balancedWins}/${balancedAttempts}`;
    totals.balancedWins += balancedWins;
    totals.balancedAttempts += balancedAttempts;
    totals.correct += row.deduced;
    totals.random += row.random;
    totals.room += row.room;
    totals.chance += row.trials / spec.count;
    totals.attempts += row.trials;
  }
  rows.push(row);
}
assert.ok(totals.random < totals.correct / 4);
assert.ok(Math.abs(totals.room - totals.chance) < 4 * Math.sqrt(totals.chance), 'sampled room policy stays within four standard errors of chance');

for (let i = 0; i < 366; i++) {
  const day = offsetDay('2026-01-01', i);
  for (const hard of [false, true]) {
    const c = dailyCase(day, hard);
    assert.deepEqual(c, dailyCase(day, hard), 'daily is deterministic');
    prove(c);
    if (hard) {
      assert.equal(c.beatCount, 12);
      assert.ok(c.spec.masks && c.spec.blackout && c.spec.carrier && c.spec.staggered);
    }
  }
}

const control = createCase({ level: 3 });
const { cards, positions } = prove(control);
const innocent = (control.culprit + 1) % cards.length;
cards[innocent].claim.room = control.crimeRoom;
assert.throws(() => compare(cards, positions), /exactly one contradiction/, 'a planted second lie must fail');

const dark = createCase({ level: 22 });
const darkFrames = replay(dark);
darkFrames[dark.blackoutBeat].sounds = [];
assert.throws(() => compare(dossiers(dark), reconstruct(dossiers(dark), darkFrames)), /visible identity or sound/);

const masked = createCase({ level: 15 });
const noExchange = replay(masked).map(frame => ({ ...frame, exchange: null }));
assert.throws(() => {
  const cards = dossiers(masked);
  assert.equal(compare(cards, reconstruct(cards, noExchange)), masked.culprit);
}, 'discarding the visible exchange must break this case');

let run = freshRun();
const wrong = control.cast.map(({ id }) => id).filter(id => id !== control.culprit);
run = accuse(control, run, wrong[0]);
assert.equal(run.stars, 2);
assert.strictEqual(accuse(control, run, wrong[0]), run);
assert.equal(accuse(control, run, control.culprit).stars, 2);
run = accuse(control, accuse(control, run, wrong[1]), wrong[2]);
assert.equal(run.outcome, 'wrong');
assert.strictEqual(accuse(control, run, control.culprit), run);
assert.deepEqual(dailyWin('2026-11-23', '2026-11-23', 2), { last: '2026-11-23', streak: 2 });
assert.deepEqual(dailyWin('2026-11-23', '2026-11-24', 2), { last: '2026-11-24', streak: 3 });
assert.deepEqual(dailyWin('2026-11-23', '2026-11-25', 2), { last: '2026-11-25', streak: 1 });

console.table(rows);
const rate = (wins, attempts) => `${(100 * wins / attempts).toFixed(2)}%`;
console.table([
  ['Compare alibi with replay', totals.correct, totals.attempts],
  ['Random', totals.random, totals.attempts],
  ['Crime room only (seeded)', totals.room, totals.attempts],
  ['Chance (weighted)', totals.chance, totals.attempts],
  ['Crime room only (balanced)', totals.balancedWins, totals.balancedAttempts],
].map(([policy, wins, attempts]) => ({
  policy, wins: Number(wins.toFixed(2)), attempts, rate: rate(wins, attempts),
})));
console.log('Cases 3–36: all suspect assignments preserve the replay in 272 case/seed pairs.');
console.log('36 defaults, 6,912 seeded campaign cases, 732 dailies. Planted second lie, missing sounds and missing exchange caught.');
console.log(`Runtime: ${(performance.now() - started).toFixed(0)} ms`);
