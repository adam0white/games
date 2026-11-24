import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  CARRIER_LESSON, CASES, OUTLINE_LESSON, accuse, aids, claims, createCase, dailyCase, dailyWin, dossiers, floorOf,
  freshRun, observe, offsetDay, random,
} from './sim.js';

const started = performance.now();
const replay = c => Array.from({ length: c.beatCount }, (_, beat) => observe(c, beat));

function reconstruct(cards, snapshots) {
  const identities = new Map();
  const voices = new Map(cards.map(card => [card.sound, card.id]));
  const positions = new Map();
  const seats = new Map();
  let previous = new Map();
  for (const frame of snapshots) {
    const at = new Map();
    const now = new Map();
    positions.set(frame.beat, at);
    seats.set(frame.beat, now);
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
    // A floor case places each sound on a floor only.
    for (const { floor, sound } of frame.heard ?? []) {
      const id = voices.get(sound);
      assert.ok(!at.has(id), 'one sound per suspect per mark');
      at.set(id, { floor });
    }
    if (!frame.shutter && (frame.blackout || frame.actors.length)) {
      assert.equal(at.size, cards.length, 'every suspect has a visible identity or sound');
    }
    previous = now;
  }
  positions.seats = seats;
  return positions;
}

// A claim contradicts the replay when the suspect stood in another room, or,
// where only a floor was heard, on another floor.
function contradicts(claim, seen, roomCount) {
  assert.notEqual(seen, undefined, 'each claim can be checked from public evidence');
  return typeof seen === 'object' ? floorOf(roomCount, claim.room) !== seen.floor : seen !== claim.room;
}

function compare(cards, positions, roomCount) {
  const lies = cards.filter(card => claims(card).some(claim =>
    contradicts(claim, positions.get(claim.beat).get(card.id), roomCount))).map(card => card.id);
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
  const answer = compare(cards, positions, c.spec.rooms);
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

// A new player sees the same default opening every time. Inspect the culprit
// the observer actually deduces, including the portrait shown at the reveal.
const opening = Array.from({ length: 8 }, (_, i) => {
  const c = createCase({ level: i + 1 });
  const cards = dossiers(c);
  const id = compare(cards, reconstruct(cards, replay(c)), c.spec.rooms);
  return cards[id].species;
});
assert.ok(opening.every((species, i) => i === 0 || species !== opening[i - 1]),
  `consecutive opening cases repeat a culprit portrait: ${opening.join(', ')}`);
assert.ok(new Set(opening).size >= 6, 'the first eight reveals show at least six different culprits');

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

// Masks must matter without becoming a shortcut. After the lesson a mask case
// hides its liar under a mask about half the time, so a player can skip
// neither the masked nor the unmasked suspects. This replaces the earlier rule
// "the liar is always masked", which let a player ignore unmasked suspects.
const maskTrials = [];
const maskLevels = CASES.flatMap((spec, i) => spec.masks && spec.tutorial !== 'masks' ? [i + 1] : []);
for (const level of maskLevels) {
  maskTrials.push(createCase({ level }));
  for (let i = 0; i < 64; i++) maskTrials.push(createCase({ seed: Math.imul(i + 1, 0x9e3779b1) >>> 0, level }));
}
const dailies = Array.from({ length: 366 }, (_, i) => dailyCase(offsetDay('2026-01-01', i)));
const wearsMask = (c, id) => c.frames.at(-1)[id].mask !== null;
// Compare alibis of one group only, then guess within that group.
function groupBot(c, masked) {
  const cards = dossiers(c);
  const positions = reconstruct(cards, replay(c));
  const group = cards.filter(card => wearsMask(c, card.id) === masked);
  const lies = group.filter(card => claims(card).some(claim =>
    contradicts(claim, positions.get(claim.beat).get(card.id), c.spec.rooms)));
  const draw = random(c.seed ^ c.level);
  return (lies[0] ?? group[Math.floor(draw() * group.length)])?.id;
}
const share = (list, test) => list.filter(test).length / list.length;
const stats = [];
for (const [label, list] of [['campaign mask cases', maskTrials], ['standard Dailies', dailies]]) {
  const masked = share(list, c => wearsMask(c, c.culprit));
  stats.push([`${label}: liar wears a mask`, masked * list.length, list.length]);
  assert.ok(masked >= .35 && masked <= .65, `${label}: masked liars ${(100 * masked).toFixed(1)}% must be near half`);
  for (const group of [true, false]) {
    const rate = share(list, c => groupBot(c, group) === c.culprit);
    stats.push([`${label}: check only ${group ? 'masked' : 'unmasked'} suspects`, rate * list.length, list.length]);
    assert.ok(rate <= .7, `${label}: checking only ${group ? 'masked' : 'unmasked'} suspects solves ${(100 * rate).toFixed(1)}%`);
  }
}
const defaults = maskLevels.map(level => createCase({ level }));
assert.ok(defaults.some(c => wearsMask(c, c.culprit)) && defaults.some(c => !wearsMask(c, c.culprit)),
  'the default campaign has both masked and unmasked liars after the mask lesson');
// A masked liar's false room holds another mask whenever the tape allows it.
const hidesLie = (c, id) => {
  const card = c.cast[id];
  const lie = claims(card).find(claim => c.frames[claim.beat][id].room !== claim.room);
  return lie.beat !== c.blackoutBeat && c.frames[lie.beat].some((actor, other) => other !== id && actor.room === lie.room && actor.mask !== null);
};
const exposed = [...maskTrials, ...dailies].filter(c => !c.spec.carrier && wearsMask(c, c.culprit) && !hidesLie(c, c.culprit)
  && c.frames.at(-1).some((actor, id) => actor.mask !== null
    && hidesLie(createCase({ seed: c.seed, level: c.level, culpritOverride: id }), id)));
assert.deepEqual(exposed.map(c => c.level), [], 'a masked liar’s false room holds another mask whenever the tape allows it');

// The claimed-room outline teaches the comparison in chapter I and retires in
// the outline lesson. An outline matcher reads only the drawn aids: the room
// outlined at the claimed mark and the portraits standing in it. Where no
// outline is drawn it has nothing to compare and guesses.
function outlineMatcher(c, view) {
  const shown = aids(c, view).outline;
  const draw = random(c.seed ^ Math.imul(c.level, 0x9e3779b1));
  const inspected = shown === 'lesson' ? c.cast.slice(0, 1) : shown ? c.cast : [];
  for (const person of inspected) {
    for (const claim of claims(person)) {
      const actor = observe(c, claim.beat).actors.find(a => a.portrait === person.id);
      if (actor && actor.room !== claim.room) return person.id;
    }
  }
  return c.cast[Math.floor(draw() * c.cast.length)].id;
}
const matcher = { early: [0, 0], late: [0, 0], chance: 0 };
for (const [i, spec] of CASES.entries()) {
  const level = i + 1;
  if (level < 3 || level === OUTLINE_LESSON) continue;
  for (let n = 0; n < 64; n++) {
    const c = createCase({ seed: Math.imul(n + 1, 0x9e3779b1) >>> 0, level });
    const row = level < OUTLINE_LESSON ? matcher.early : matcher.late;
    row[0] += Number(outlineMatcher(c, {}) === c.culprit);
    row[1]++;
    if (level > OUTLINE_LESSON) matcher.chance += 1 / spec.count;
    prove(c);
  }
}
for (const [i, c] of dailies.entries()) {
  const hard = dailyCase(offsetDay('2026-01-01', i), true);
  matcher.late[0] += Number(outlineMatcher(c, { daily: true, progress: 20 }) === c.culprit);
  matcher.late[0] += Number(outlineMatcher(hard, { daily: true, hard: true, progress: 20 }) === hard.culprit);
  matcher.late[1] += 2;
  matcher.chance += 1 / c.cast.length + 1 / hard.cast.length;
}
stats.push(['Outline matcher, cases 3–6', ...matcher.early], ['Outline matcher, cases 8–36 and Dailies', ...matcher.late],
  ['Chance for the same cases', matcher.chance, matcher.late[1]]);
assert.equal(matcher.early[0], matcher.early[1], 'with the outline, matching the suspect against it solves chapter I');
assert.ok(Math.abs(matcher.late[0] - matcher.chance) < 4 * Math.sqrt(matcher.chance),
  `after the outline lesson the outline matcher is at chance: ${matcher.late[0]} of ${matcher.late[1]}, chance ${matcher.chance.toFixed(1)}`);
assert.equal(aids(dailies[0], { daily: true, progress: 1 }).outline, 'full', 'a new player’s Daily keeps the outline');

// Chapter V: the carrier is handed the item by someone who stood with them one
// mark earlier, and the carrier is never the liar. The trail narrows the
// suspects to three, so the alibis still decide.
const carrierTrials = [];
for (const [i, spec] of CASES.entries()) {
  if (!spec.carrier) continue;
  carrierTrials.push(createCase({ level: i + 1 }));
  for (let n = 0; n < 64; n++) carrierTrials.push(createCase({ seed: Math.imul(n + 1, 0x9e3779b1) >>> 0, level: i + 1 }));
}
for (let i = 0; i < 366; i++) carrierTrials.push(dailyCase(offsetDay('2026-01-01', i), true));
function trailBot(c) {
  const frames = replay(c);
  const cards = dossiers(c);
  const positions = reconstruct(cards, frames);
  // Identify the carrier from the tape: a portrait, or the mask in its place.
  const holder = frames[c.carryBeat].actors.find(actor => actor.carry);
  const carrier = positions.seats.get(c.carryBeat).get(`${holder.room}/${holder.slot}`);
  const room = positions.get(c.carryBeat - 1).get(carrier);
  const givers = cards.filter(card => card.id !== carrier && positions.get(c.carryBeat - 1).get(card.id) === room);
  const lies = givers.filter(card => claims(card).some(claim =>
    contradicts(claim, positions.get(claim.beat).get(card.id), c.spec.rooms)));
  return { carrier, givers: givers.map(card => card.id), answer: lies.length === 1 ? lies[0].id : null };
}
const trail = { solved: 0, carrier: 0, guess: 0 };
for (const c of carrierTrials) {
  const { carrier, givers, answer } = trailBot(c);
  assert.equal(carrier, c.carrier, 'the tape shows who carries the item');
  assert.ok(givers.length >= 3, `case ${c.level}: the trail leaves at least three suspects`);
  assert.ok(givers.includes(c.culprit), `case ${c.level}: the liar stood with the carrier before the hand-off`);
  trail.solved += Number(answer === c.culprit);
  trail.carrier += Number(carrier === c.culprit);
  trail.guess += 1 / givers.length;
}
stats.push(['Carrier cases: compare the trail suspects only', trail.solved, carrierTrials.length],
  ['Carrier cases: accuse the carrier', trail.carrier, carrierTrials.length],
  ['Carrier cases: guess among the trail suspects (expected)', trail.guess, carrierTrials.length]);
assert.equal(trail.solved, carrierTrials.length, 'comparing only the trail suspects solves every carrier case');
assert.equal(trail.carrier, 0, 'accusing the carrier never solves a case');
assert.ok(trail.guess / carrierTrials.length <= .34, 'guessing among the trail suspects without alibis solves at most a third');
assert.ok(aids(dailyCase('2026-11-24', true), { daily: true, hard: true, progress: 20 }).trail
  && !aids(dailyCase('2026-11-24', true), { daily: true, hard: true, progress: CARRIER_LESSON + 1 }).trail,
'Hard Daily shows the trail lesson until the campaign teaches it');

// Mask tags: the lesson and a new player's Daily tag the mask-on mark and the
// exchange; every other mask case tags the mask-on mark only, where nobody
// moves. Cases without masks never tag.
for (const [label, c, view, want] of [
  ['case 15', createCase({ level: 15 }), {}, 'all'],
  ['case 16', createCase({ level: 16 }), {}, 'on'],
  ['case 34', createCase({ level: 34 }), {}, 'on'],
  ['case 8', createCase({ level: 8 }), {}, false],
  ['new player Daily', dailies[0], { daily: true, progress: 5 }, 'all'],
  ['returning Daily', dailies[0], { daily: true, progress: 20 }, 'on'],
  ['Hard Daily', dailyCase('2026-11-24', true), { daily: true, hard: true, progress: 20 }, 'on'],
]) assert.equal(aids(c, view).maskTags, want, `${label} mask tags`);
// The mask-on tags are honest only if nobody moves on that mark.
for (const c of [...CASES.map((_, i) => createCase({ level: i + 1 })), ...dailies.slice(0, 60), dailyCase('2026-11-24', true)]) {
  if (!c.spec.masks) continue;
  const on = c.frames.findIndex(frame => frame.some(actor => actor.mask !== null));
  assert.ok(on > 0 && c.frames[on].every((actor, id) => actor.room === c.frames[on - 1][id].room
    && actor.slot === c.frames[on - 1][id].slot), `case ${c.level}: nobody moves where masks go on`);
}

// Two-mark cases: every suspect names two marks and the lie can sit at either,
// so checking only the first mark misses some liars.
const twoMark = CASES.flatMap((spec, i) => spec.twoMarks ? [i + 1] : []);
assert.ok(twoMark.length >= 1, 'a case asks about two clock marks');
let secondLies = 0;
let twoTrials = 0;
for (const level of twoMark) {
  for (let n = 0; n < 64; n++) {
    const c = createCase({ seed: Math.imul(n + 1, 0x9e3779b1) >>> 0, level });
    const cards = dossiers(c);
    assert.ok(cards.every(card => card.claim2 && card.claim2.beat > card.claim.beat), 'two distinct marks per alibi');
    const firstOnly = cards.map(({ claim2, ...card }) => card);
    const positions = reconstruct(cards, replay(c));
    const caught = firstOnly.filter(card => contradicts(card.claim, positions.get(card.claim.beat).get(card.id), c.spec.rooms));
    secondLies += Number(caught.length === 0);
    twoTrials++;
  }
}
stats.push(['Two-mark cases: liar lies at the second mark', secondLies, twoTrials]);
assert.ok(secondLies / twoTrials > .3 && secondLies / twoTrials < .7, `liars lie at the second mark in ${secondLies} of ${twoTrials}`);

// Floor case: the blackout sound only says which floor. Each suspect's two
// possible rooms are on different floors, so a floor still exposes the lie,
// and the room-level sound symbols are absent.
const floorLevels = CASES.flatMap((spec, i) => spec.floors ? [i + 1] : []);
assert.ok(floorLevels.length >= 1, 'a case hears sounds by floor');
for (const level of floorLevels) {
  for (let n = 0; n < 64; n++) {
    const c = createCase({ seed: Math.imul(n + 1, 0x9e3779b1) >>> 0, level });
    const dark = observe(c, c.blackoutBeat);
    assert.equal(dark.sounds.length, 0, 'no room-level sounds in a floor case');
    assert.equal(dark.heard.length, c.cast.length);
    const liar = c.cast[c.culprit];
    const truth = c.frames[liar.claim.beat][liar.id].room;
    assert.notEqual(floorOf(c.spec.rooms, liar.claim.room), floorOf(c.spec.rooms, truth), 'the lie crosses floors');
  }
}

// check.mjs looks for the Daily mask tags on mark 4 whatever the date.
for (const c of dailies) {
  const masked = replay(c).map(frame => frame.actors.some(actor => actor.mask !== null));
  assert.equal(masked.indexOf(true), 3, 'every Daily puts its masks on at mark 4');
}

const control = createCase({ level: 3 });
const { cards, positions } = prove(control);
const innocent = (control.culprit + 1) % cards.length;
cards[innocent].claim.room = control.crimeRoom;
assert.throws(() => compare(cards, positions, control.spec.rooms), /exactly one contradiction/, 'a planted second lie must fail');

const dark = createCase({ level: 22 });
const darkFrames = replay(dark);
darkFrames[dark.blackoutBeat].sounds = [];
assert.throws(() => compare(dossiers(dark), reconstruct(dossiers(dark), darkFrames), dark.spec.rooms), /visible identity or sound/);

const masked = createCase({ level: 15 });
const noExchange = replay(masked).map(frame => ({ ...frame, exchange: null }));
assert.throws(() => {
  const cards = dossiers(masked);
  assert.equal(compare(cards, reconstruct(cards, noExchange), masked.spec.rooms), masked.culprit);
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
console.table(stats.map(([policy, wins, attempts]) => ({
  policy, wins: Number(wins.toFixed(2)), attempts, rate: rate(wins, attempts),
})));
console.log('Cases 3–36: all suspect assignments preserve the replay in 272 case/seed pairs.');
console.log('36 defaults, 6,912 seeded campaign cases, 732 dailies. Planted second lie, missing sounds and missing exchange caught.');
console.log(`Runtime: ${(performance.now() - started).toFixed(0)} ms`);
