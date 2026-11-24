import assert from 'node:assert/strict';
import { CASES, accuse, createCase, dailyCase, dailyWin, dossiers, observe } from './sim.js';

// Work in the same order as a player scrubbing the clock from left to right.
// A costume is matched at the moment it goes on. A visible exchange changes
// who the two costume shapes represent. In the dark only sound symbols count.
function reconstruct(cards, snapshots) {
  const identities = new Map();
  const voices = new Map(cards.map(card => [card.sound, card.id]));
  let previous = new Map();
  const positions = new Map();
  const carriers = new Set();
  const locate = (at, id, room) => {
    assert.ok(!at.has(id), `portrait ${id} appears twice at one clock mark`);
    at.set(id, room);
  };

  for (const frame of snapshots) {
    const at = new Map();
    positions.set(frame.beat, at);
    if (frame.blackout) {
      for (const { room, sound } of frame.sounds) {
        const id = voices.get(sound);
        assert.ok(id !== undefined, `sound ${sound} has no portrait in the lineup`);
        locate(at, id, room);
      }
      previous = new Map();
      continue;
    }
    if (frame.exchange) {
      const [left, right] = frame.exchange;
      const leftId = identities.get(left);
      const rightId = identities.get(right);
      assert.ok(leftId !== undefined && rightId !== undefined, 'an unknown costume was exchanged');
      identities.set(left, rightId);
      identities.set(right, leftId);
    }
    const now = new Map();
    for (const { room, slot, portrait, mask, carry } of frame.actors) {
      const seat = `${room}/${slot}`;
      if (mask != null && !identities.has(mask) && previous.has(seat)) {
        identities.set(mask, previous.get(seat));
      }
      const id = portrait ?? identities.get(mask);
      if (id == null) continue;
      assert.ok(!now.has(seat), `two portraits overlap at room/slot ${seat}`);
      now.set(seat, id);
      locate(at, id, room);
      if (carry != null && carry !== false) carriers.add(id);
    }
    previous = now;
  }
  return { positions, carriers };
}

function verdicts(cards, positions) {
  const result = { matched: [], contradicted: [], unknown: [] };
  for (const { id, claim } of cards) {
    const room = positions.get(claim.beat)?.get(id);
    const verdict = room == null ? 'unknown' : room === claim.room ? 'matched' : 'contradicted';
    result[verdict].push(id);
  }
  return result;
}

function prove(cards, snapshots) {
  const reconstruction = reconstruct(cards, snapshots);
  const evidence = verdicts(cards, reconstruction.positions);
  assert.equal(evidence.unknown.length, 0, 'each claim needs a visible fact');
  assert.equal(evidence.contradicted.length, 1, 'exactly one claim must be contradicted');
  return { accused: evidence.contradicted[0], ...reconstruction };
}

function visibleReplay(caseData) {
  return Array.from({ length: caseData.beatCount }, (_, beat) => observe(caseData, beat));
}

function scrubbingBot(caseData) {
  return prove(dossiers(caseData), visibleReplay(caseData)).accused;
}

function checkIncident(caseData, cards, frames, proof) {
  const label = `case ${caseData.level}`;
  const changed = frames.find(frame => frame.incident);
  assert.ok(changed, `${label}: the crime is visible during the replay`);
  const at = proof.positions.get(changed.beat);
  assert.equal(at.get(proof.accused), caseData.crimeRoom, `${label}: the culprit was present when the crime happened`);
  if (caseData.spec.staggered) {
    assert.ok(new Set(cards.map(card => card.claim.beat)).size > 1, `${label}: staggered statements use multiple times`);
    assert.ok(cards.some(card => card.id !== proof.accused && card.claim.beat !== changed.beat
      && at.get(card.id) === caseData.crimeRoom), `${label}: a truthful bystander was also present for the crime`);
  }
}

function sharedWalk(positions) {
  let previous = new Map();
  for (const at of positions.values()) {
    const paths = new Set();
    for (const [id, to] of at) {
      const from = previous.get(id);
      if (from == null || from === to) continue;
      const path = `${from}/${to}`;
      if (paths.has(path)) return true;
      paths.add(path);
    }
    previous = at;
  }
  return false;
}

function rng(seed) {
  let state = seed >>> 0;
  return max => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % max;
  };
}

function openingBot(cards, opening, pick) {
  const positions = reconstruct(cards, [opening]).positions;
  const evidence = verdicts(cards, positions);
  if (evidence.contradicted.length) return evidence.contradicted[0];

  // Among unresolved claims, prefer suspects claiming somewhere other than
  // their opening room, then prefer the earliest of those claimed times.
  const rooms = positions.get(opening.beat);
  const moved = cards.filter(card => evidence.unknown.includes(card.id));
  const elsewhere = moved.filter(card => rooms.get(card.id) !== card.claim.room);
  const candidates = elsewhere.length ? elsewhere : moved;
  const earliest = Math.min(...candidates.map(card => card.claim.beat));
  const plausible = candidates.filter(card => card.claim.beat === earliest);
  return plausible[pick(plausible.length)]?.id;
}

function openingProof(level, seed) {
  const original = createCase({ level, seed });
  const opening = observe(original, 0);
  const cards = dossiers(original);
  // Hold the public opening constant, then independently solve one possible
  // future for every suspect. No rule based on this opening can eliminate one.
  for (const { id } of cards) {
    const alternate = createCase({ seed, level, culpritOverride: id });
    assert.deepEqual(observe(alternate, 0), opening, `case ${level}: opening board gives away the culprit`);
    assert.deepEqual(dossiers(alternate), cards, `case ${level}: opening dossier gives away the culprit`);
    const frames = visibleReplay(alternate);
    const proof = prove(cards, frames);
    assert.equal(proof.accused, id, `case ${level}: counterfactual replay for suspect ${id}`);
    checkIncident(alternate, cards, frames, proof);
  }
}

const start = performance.now();
const played = { stars: 3, rejected: [], outcome: null };
const seeds = rng(0xe761357b);
const randomPick = rng(0x4733af57);
const openingPick = rng(0x72300d59);
const trials = 192;
const rows = [];
let randomWins = 0;
let openingWins = 0;
let observedWins = 0;
let expected = 0;
let variance = 0;
let openingProofs = 0;
let days = 0;
let darkEvidence = 0;
let swapEvidence = 0;
const pct = (hits, attempts) => `${(100 * hits / attempts).toFixed(1)}%`;

assert.ok(CASES.length >= 20, 'at least twenty ordered cases');
assert.equal(new Set(CASES.map(spec => spec.chapter)).size, 3, 'three chapters');

for (const [index, spec] of CASES.entries()) {
  const level = index + 1;
  const sample = createCase({ level, seed: 503 });
  assert.deepEqual(sample, createCase({ level, seed: 503 }), `case ${level}: seed is reproducible`);
  assert.notDeepEqual(dossiers(sample), dossiers(createCase({ level, seed: 504 })),
    `case ${level}: another seed changes the statements or roster`);
  const defaultCase = createCase({ level });
  const size = defaultCase.cast.length;
  assert.ok(size >= 6 && size <= 8, `case ${level}: six to eight suspects`);
  assert.equal(scrubbingBot(defaultCase), defaultCase.culprit, `case ${level}: default replay`);

  let bot = 0;
  let random = 0;
  let still = 0;
  let claimMarks = 0;
  for (let i = 0; i < trials; i++) {
    const seed = seeds(0x100000000);
    const caseData = createCase({ level, seed });
    const frames = visibleReplay(caseData);
    const cards = dossiers(caseData);
    assert.equal(new Set(cards.map(card => card.species)).size, size, `case ${level}: distinct silhouettes`);
    assert.equal(new Set(cards.map(card => card.sound)).size, size, `case ${level}: distinct sound symbols`);
    const proof = prove(cards, frames);
    assert.equal(proof.accused, caseData.culprit, `case ${level} seed ${seed}: observer's accusation`);
    checkIncident(caseData, cards, frames, proof);
    assert.equal(accuse(caseData, played, proof.accused).outcome, 'solved', 'evidence leads to a solved run');
    bot++;
    random += randomPick(size) === caseData.culprit;
    still += openingBot(cards, frames[0], openingPick) === caseData.culprit;
    claimMarks += new Set(cards.map(card => card.claim.beat)).size;
    if (i < 12) {
      openingProof(level, seed);
      openingProofs++;
    }

    if (spec.blackout) {
      const dark = frames.find(frame => frame.blackout);
      assert.ok(dark, `case ${level}: blackout occurs at a clock mark`);
      assert.deepEqual(dark.actors, [], `case ${level}: bodies stay hidden in the dark`);
      const muted = frames.map(frame => frame.blackout ? { ...frame, sounds: [] } : frame);
      const mutedEvidence = verdicts(cards, reconstruct(cards, muted).positions);
      if (!mutedEvidence.contradicted.includes(caseData.culprit)) darkEvidence++;
    }
    if (spec.masks) {
      assert.ok(frames.some(frame => frame.exchange), `case ${level}: costume swap is visible`);
      const skipped = frames.map(frame => ({ ...frame, exchange: null }));
      const skippedEvidence = verdicts(cards, reconstruct(cards, skipped).positions);
      if (skippedEvidence.contradicted.length !== 1 || skippedEvidence.contradicted[0] !== caseData.culprit) {
        swapEvidence++;
      }
    }
    if (spec.overlap) {
      assert.ok(sharedWalk(proof.positions), `case ${level}: two suspects visibly walk between the same rooms together`);
    }
    if (spec.accomplice) {
      assert.equal(proof.carriers.size, 1, `case ${level}: one suspect visibly carries the item`);
      assert.ok(!proof.carriers.has(proof.accused), `case ${level}: an honest suspect carries the item`);
    }
  }

  observedWins += bot;
  randomWins += random;
  openingWins += still;
  expected += trials / size;
  variance += trials * (1 / size) * (1 - 1 / size);
  const supported = [
    spec.overlap && 'shared path',
    spec.masks && 'swap',
    spec.blackout && 'dark',
    spec.accomplice && 'carrier',
  ].filter(Boolean);
  rows.push({
    case: level,
    chapter: spec.chapter,
    suspects: size,
    rooms: spec.rooms,
    marks: defaultCase.beatCount,
    'alibi marks (mean)': (claimMarks / trials).toFixed(1),
    features: supported.join(', ') || 'rooms and clock',
    observes: pct(bot, trials),
    random: pct(random, trials),
    'no scrub': pct(still, trials),
  });
}

const testCase = createCase({ level: 1, seed: 100 });
const frames = visibleReplay(testCase);
const cards = dossiers(testCase);
const truth = cards.find(card => card.id !== testCase.culprit);
const patched = cards.map(card => card.id === truth.id
  ? { ...card, claim: { ...card.claim, room: (card.claim.room + 1) % testCase.spec.rooms } }
  : card);
assert.throws(() => prove(patched, frames), /exactly one claim/, 'planted second lie is caught');
const wrong = cards.filter(card => card.id !== testCase.culprit).map(card => card.id);
const twoStars = accuse(testCase, played, wrong[0]);
assert.equal(twoStars.stars, 2);
assert.equal(twoStars.outcome, null);
assert.deepEqual(accuse(testCase, twoStars, wrong[0]), twoStars, 'repeat cannot charge a star');
assert.deepEqual(accuse(testCase, twoStars, String(wrong[0])), twoStars, 'invalid suspect cannot charge a star');
assert.equal(accuse(testCase, twoStars, testCase.culprit).stars, 2, 'a correct accusation keeps earned stars');
const oneStar = accuse(testCase, twoStars, wrong[1]);
assert.equal(oneStar.stars, 1);
const ended = accuse(testCase, oneStar, wrong[2]);
assert.equal(ended.stars, 0);
assert.equal(ended.outcome, 'wrong');
assert.deepEqual(accuse(testCase, ended, testCase.culprit), ended, 'a finished case cannot change outcome');
assert.deepEqual(played, { stars: 3, rejected: [], outcome: null }, 'accusations leave their input run intact');

for (let i = 0; i < 366; i++) {
  const day = new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10);
  const data = dailyCase(day);
  assert.deepEqual(data, dailyCase(day), `daily ${day}: deterministic`);
  const cards = dossiers(data);
  const frames = visibleReplay(data);
  const proof = prove(cards, frames);
  assert.equal(proof.accused, data.culprit, `daily ${day}: observer's accusation`);
  checkIncident(data, cards, frames, proof);
  days++;
}
assert.deepEqual(dailyWin(null, '2024-02-28', 0), { last: '2024-02-28', streak: 1 });
assert.deepEqual(dailyWin('2024-02-28', '2024-02-29', 1), { last: '2024-02-29', streak: 2 });
assert.deepEqual(dailyWin('2024-02-29', '2024-02-29', 2), { last: '2024-02-29', streak: 2 });
assert.deepEqual(dailyWin('2024-02-29', '2024-02-28', 2), { last: '2024-02-29', streak: 2 });
assert.deepEqual(dailyWin('2024-02-29', '2024-03-02', 2), { last: '2024-03-02', streak: 1 });

const total = trials * CASES.length;
const tolerance = 4.5 * Math.sqrt(variance);
assert.ok(Math.abs(randomWins - expected) <= tolerance, 'random accusations within chance tolerance');
assert.ok(openingWins - expected <= tolerance, 'opening-only accusation does no better than chance');
assert.ok(darkEvidence > 0, 'sound symbols are needed for some solutions');
assert.ok(swapEvidence > 0, 'visible exchanges are needed for some solutions');
assert.ok(performance.now() - start < 30_000, 'bot checks run within the requested limit');

console.table(rows);
console.table([
  { bot: 'Observing', correct: observedWins, attempts: total, rate: pct(observedWins, total) },
  { bot: 'Random', correct: randomWins, attempts: total, rate: pct(randomWins, total) },
  { bot: 'No scrub', correct: openingWins, attempts: total, rate: pct(openingWins, total) },
  { bot: 'Chance (mean 1/N)', correct: expected.toFixed(1), attempts: total, rate: pct(expected, total) },
]);
console.log(`Unique visible contradiction across ${CASES.length} default cases, ${total} seeded cases and ${days} dailies.`);
console.log(`Opening invariance checked for every suspect in ${openingProofs} case/seed pairs.`);
console.log(`Culprit's contradiction needs the sound symbols in ${darkEvidence} trials. Ignoring exchanges breaks the verdict in ${swapEvidence} trials.`);
console.log('Planted second lie caught. Truthful bystanders, shared paths, honest carriers, star loss, repeated accusations and streak transitions verified.');
