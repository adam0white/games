// node bots.mjs           rules, bot strength, daily determinism
// node bots.mjs --mutate  the same with jacks unable to capture: an assertion must fail
import assert from 'node:assert/strict';
import { deal, play, score, view, dailySeed, shuffled, rank, isJack, points, totalPlies, RULES } from './sim.js';
import { choose, LEVELS } from './brain.js';

const mutate = process.argv.includes('--mutate');
const rules = mutate ? { ...RULES, jackCaptures: false } : RULES;
if (mutate) console.log('MUTATION: jacks do not capture');

function runHand(seed, policy, dealer = 1) {
  let s = deal(seed, dealer, rules);
  const start = s;
  while (!s.done) s = play(s, policy[s.turn](s));
  return { start, end: s };
}
const bot = level => s => choose(view(s, s.turn), level);

// An independent referee: replays the move log with its own pile and checks every rule from the cards alone.
function referee({ start, end }) {
  let pile = start.pile.slice(), last = -1, firstCapture = null;
  const pisti = [0, 0], taken = [[], []];
  assert.equal(end.log.length, totalPlies, '48 cards are played');
  for (const e of end.log) {
    const top = pile[pile.length - 1];
    const shouldCapture = pile.length > 0 && (rank(e.card) === rank(top) || isJack(e.card));
    assert.equal(e.capture, shouldCapture, `ply ${e.ply}: a match or a jack on a pile captures, nothing else does`);
    const lone = pile.length === 1 && rank(e.card) === rank(top) && e.ply > 0 && e.ply < totalPlies - 1;
    assert.equal(e.kind === 'pisti' || e.kind === 'double', lone, `ply ${e.ply}: pişti exactly on a lone matched card`);
    if (lone) pisti[e.seat] += isJack(e.card) ? 20 : 10;
    if (shouldCapture) {
      if (firstCapture === null) { firstCapture = e.seat; for (const c of start.pile) assert.ok(pile.includes(c), 'centre cards are in the first captured pile'); }
      taken[e.seat].push(...pile, e.card); pile = []; last = e.seat;
    } else pile.push(e.card);
  }
  const to = last >= 0 ? last : start.dealer;
  taken[to].push(...pile);
  if (pile.length) assert.equal(end.leftover.seat, last, 'the last pile goes to the last capturer');
  for (const seat of [0, 1]) assert.deepEqual([...end.taken[seat]].sort((a, b) => a - b), [...taken[seat]].sort((a, b) => a - b), 'captured cards agree with the referee');
  assert.equal(new Set([...end.taken[0], ...end.taken[1]]).size, 52, '52 distinct cards at the end');
  assert.equal(end.taken[0].length + end.taken[1].length, 52, '52 cards conserved');
  assert.deepEqual(end.pisti, pisti, 'pişti points agree with the referee');
  const sc = score(end), cardPts = sc[0].total + sc[1].total - pisti[0] - pisti[1];
  const tie = end.taken[0].length === 26;
  assert.equal(cardPts, tie ? 13 : 16, 'card points total 16, or 13 when 26 each');
  assert.equal(taken.flat().reduce((s, c) => s + points(c), 0), 13, 'the pack holds 13 card points');
}

// 1. Rules over many seeded hands with mixed bots.
const HANDS = 5000;
let pistis = 0, doubles = 0, ties = 0;
for (let i = 0; i < HANDS; i++) {
  const levels = [LEVELS[i % 3], LEVELS[(i / 3 | 0) % 3]];
  const h = runHand(1000 + i, [bot(levels[0]), bot(levels[1])], i % 2);
  referee(h);
  pistis += h.end.piCount[0] + h.end.piCount[1]; doubles += h.end.doubles[0] + h.end.doubles[1];
  if (h.end.taken[0].length === 26) ties++;
}
console.log(`rules: ${HANDS} hands ok; ${(pistis / HANDS).toFixed(2)} pişti and ${(doubles / HANDS).toFixed(3)} double pişti a hand; ${ties} hands at 26 each`);

// 2. Strength: paired deals, seats swapped. margin = A minus B, per hand.
function versus(a, b, n = 1000) {
  const margins = [];
  let wins = 0, losses = 0;
  for (let i = 0; i < n; i++) {
    for (const seatA of [0, 1]) {
      const pol = seatA === 0 ? [bot(a), bot(b)] : [bot(b), bot(a)];
      const { end } = runHand(500000 + i, pol, 1);
      const sc = score(end), m = sc[seatA].total - sc[1 - seatA].total;
      margins.push(m); if (m > 0) wins++; else if (m < 0) losses++;
    }
  }
  const mean = margins.reduce((s, x) => s + x, 0) / margins.length;
  const sd = Math.sqrt(margins.reduce((s, x) => s + (x - mean) ** 2, 0) / (margins.length - 1));
  const se = sd / Math.sqrt(margins.length);
  console.log(`${a} vs ${b}: ${margins.length} hands, mean margin ${mean.toFixed(2)} (se ${se.toFixed(2)}), wins ${(100 * wins / margins.length).toFixed(1)}%, losses ${(100 * losses / margins.length).toFixed(1)}%`);
  return { mean, se };
}
const em = versus('medium', 'easy'), hm = versus('hard', 'medium');
versus('hard', 'easy');
assert.ok(em.mean > 3 * em.se && em.mean > 1, 'medium beats easy on average margin');
assert.ok(hm.mean > 3 * hm.se && hm.mean > 0.5, 'hard beats medium on average margin');

// 3. Today's deal: same date, same deal, same replies to the same plays; the bot never peeks.
const day = '2026-11-24', ds = dailySeed(day);
assert.deepEqual(deal(ds, 1, rules), deal(ds, 1, rules), 'same date seed gives the same deal');
for (const level of LEVELS) {
  const human = s => s.hands[s.turn][(s.ply * 7) % s.hands[s.turn].length];
  const a = runHand(ds, [human, bot(level)]), b = runHand(ds, [human, bot(level)]);
  assert.deepEqual(a.end.log, b.end.log, `${level}: same plays get the same replies`);
}
let peeks = 0;
for (let i = 0; i < 300; i++) {
  let s = deal(9000 + i, 1, rules);
  const stop = (i * 5) % 40;
  while (s.ply < stop) s = play(s, bot('hard')(s));
  // Swap the other hand, the stock (bottom card kept) and the hidden centre cards among themselves.
  const seat = s.turn, other = 1 - seat;
  if (s.hands[other].includes(s.bottom)) continue;
  const hiddenCards = s.pile.slice(0, s.hidden), stockBody = s.stock.slice(0, -1);
  const unknown = [...s.hands[other], ...stockBody, ...hiddenCards];
  const order = shuffled(77 + i).filter(k => k < unknown.length).map(k => unknown[k]);
  const t = { ...s, hands: s.hands.slice(), stock: [...order.slice(s.hands[other].length, s.hands[other].length + stockBody.length), ...s.stock.slice(-1)] };
  t.hands[other] = order.slice(0, s.hands[other].length);
  t.pile = [...order.slice(s.hands[other].length + stockBody.length), ...s.pile.slice(s.hidden)];
  if (!s.stock.length) t.stock = [];
  for (const level of LEVELS) if (choose(view(s, seat), level) !== choose(view(t, seat), level)) peeks++;
}
assert.equal(peeks, 0, 'the bot chooses the same whatever the unseen cards are');
console.log('daily: same deal and same replies for each level; bot choice unchanged by unseen cards in 900 positions');

const seen = new Set();
for (let d = 0; d < 60; d++) {
  const date = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
  const s = deal(dailySeed(date));
  seen.add(JSON.stringify(s.stock.concat(s.pile)));
}
assert.equal(seen.size, 60, '60 consecutive dates give distinct deals');
console.log('dates: 60 consecutive dates give 60 distinct deals');
console.log('ALL PASS');
