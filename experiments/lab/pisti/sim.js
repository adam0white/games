// Pişti, two players, rules from https://www.pagat.com/fishing/pishti.html (choices in NOTES.md).
// Pure and seeded: no window, document, Date or Math.random. Runs in Node for bots.mjs.
// A card is 0..51: suit = card / 13 (0 clubs, 1 diamonds, 2 hearts, 3 spades), rank = card % 13 + 1 (1 ace, 11 jack, 12 queen, 13 king).

export const JACK = 11;
export const rank = c => c % 13 + 1;
export const suit = c => (c / 13) | 0;
export const isJack = c => rank(c) === JACK;
export const TWO_CLUBS = 1;
export const TEN_DIAMONDS = 13 + 9;
export const SUITS = ['♣', '♦', '♥', '♠'];
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const name = c => RANKS[rank(c)] + SUITS[suit(c)];
export const RULES = { jackCaptures: true };

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a of the text, so "2026-11-24" gives the same seed everywhere.
export function seedOf(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// Today's deal: the same seed everywhere for one UTC date (YYYY-MM-DD).
export const dailySeed = date => seedOf(`pisti:${date}`);

export function shuffled(seed) {
  const r = mulberry32(seed), d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

// The point value of a captured card.
export const points = c => (isJack(c) || rank(c) === 1 ? 1 : 0) + (c === TWO_CLUBS ? 2 : 0) + (c === TEN_DIAMONDS ? 3 : 0);

// Deal a hand. deck[0] is the top. `dealer` is seat 0 or 1; the other seat leads.
export function deal(seed, dealer = 1, rules = RULES) {
  let deck = shuffled(seed), tries = 0;
  for (;;) {
    // The cut: the exposed bottom card is never a jack (pagat: the cutter skips jacks).
    const b = deck.slice().reverse().findIndex(c => !isJack(c));
    if (b > 0) { const i = 51 - b; const c = deck[i]; deck.splice(i, 1); deck.push(c); }
    const centre = deck.slice(0, 4);
    if (centre.some(c => !isJack(c))) break;
    // Four jacks in the centre: redeal from a derived seed.
    deck = shuffled((seed + 0x9e3779b9 * ++tries) >>> 0);
  }
  const centre = deck.slice(0, 4);
  // Turn centre cards up in order until a non-jack shows; turned jacks stay face up under it.
  const up = [], down = [];
  for (const c of centre) { if (up.length && !isJack(up[up.length - 1])) down.push(c); else up.push(c); }
  const s = {
    seed, dealer, rules,
    stock: deck.slice(4), bottom: deck[51],
    hands: [[], []], pile: [...down, ...up], hidden: down.length,
    taken: [[], []], piCount: [0, 0], doubles: [0, 0], pisti: [0, 0],
    last: -1, turn: 1 - dealer, ply: 0, dealNo: 0, log: [], done: false,
    shown: up.slice(),
  };
  dealRound(s);
  return s;
}

function dealRound(s) {
  const lead = 1 - s.dealer;
  for (const seat of [lead, s.dealer]) s.hands[seat] = s.stock.splice(0, 4);
  s.dealNo++;
}

export function clone(s) {
  return {
    ...s, stock: s.stock.slice(), hands: [s.hands[0].slice(), s.hands[1].slice()], pile: s.pile.slice(),
    taken: [s.taken[0].slice(), s.taken[1].slice()], piCount: s.piCount.slice(), doubles: s.doubles.slice(), pisti: s.pisti.slice(),
    log: s.log.slice(), shown: s.shown.slice(),
  };
}

export const totalPlies = 48;
export const capturesWith = (s, c) => s.pile.length > 0 && (rank(c) === rank(s.pile[s.pile.length - 1]) || (s.rules.jackCaptures && isJack(c)));

// Play one card for the seat whose turn it is. Returns a new state; the input is not changed.
export function play(prev, card) {
  if (prev.done) throw new Error('hand is over');
  const seat = prev.turn, i = prev.hands[seat].indexOf(card);
  if (i < 0) throw new Error(`card ${card} not in hand of seat ${seat}`);
  const s = clone(prev);
  s.hands[seat].splice(i, 1);
  const before = s.pile.length, top = before ? s.pile[before - 1] : null;
  const entry = { ply: s.ply, seat, card, before, top, capture: false, kind: null, size: 0 };
  if (capturesWith(s, card)) {
    entry.capture = true; entry.size = before + 1;
    // No pişti on the very first card of the hand or on the very last (pagat).
    const eligible = before === 1 && s.ply > 0 && s.ply < totalPlies - 1 && rank(card) === rank(top);
    if (eligible && isJack(card)) { entry.kind = 'double'; s.pisti[seat] += 20; s.doubles[seat]++; }
    else if (eligible) { entry.kind = 'pisti'; s.pisti[seat] += 10; s.piCount[seat]++; }
    else entry.kind = isJack(card) ? 'jack' : 'match';
    s.taken[seat].push(...s.pile, card);
    s.pile = []; s.hidden = 0; s.last = seat;
  } else s.pile.push(card);
  s.log.push(entry);
  s.ply++;
  s.turn = 1 - seat;
  if (!s.hands[0].length && !s.hands[1].length) {
    if (s.stock.length) { dealRound(s); s.turn = 1 - s.dealer; }
    else {
      // Cards left on the table go to the last capturer (to the dealer if nobody captured).
      const to = s.last >= 0 ? s.last : s.dealer;
      s.leftover = { seat: to, size: s.pile.length };
      s.taken[to].push(...s.pile); s.pile = []; s.hidden = 0;
      s.done = true; s.turn = -1;
    }
  }
  return s;
}

// Breakdown of a finished (or running) hand for both seats.
export function score(s) {
  const n = [s.taken[0].length, s.taken[1].length];
  return [0, 1].map(seat => {
    const t = s.taken[seat];
    const jacks = t.filter(isJack).length, aces = t.filter(c => rank(c) === 1).length;
    const two = t.includes(TWO_CLUBS) ? 2 : 0, ten = t.includes(TEN_DIAMONDS) ? 3 : 0;
    const most = n[seat] > n[1 - seat] ? 3 : 0;
    const pisti = s.pisti[seat];
    return { jacks, aces, two, ten, most, pisti, cards: n[seat], piCount: s.piCount[seat], doubles: s.doubles[seat], total: jacks + aces + two + ten + most + pisti };
  });
}

// What a seat may know: its own hand, the face-up cards, every card played, the exposed bottom card,
// the cards it captured itself (including hidden centre cards it took). Never the other hand or the stock order.
export function view(s, seat) {
  const visiblePile = s.pile.slice(s.hidden);
  const seen = new Set([s.bottom, ...s.shown]);
  for (const e of s.log) seen.add(e.card);
  for (const c of s.taken[seat]) seen.add(c);
  return {
    seat, hand: s.hands[seat].slice(), pile: visiblePile, pileSize: s.pile.length, hidden: s.hidden,
    seen: [...seen], oppCount: s.hands[1 - seat].length, stockLeft: s.stock.length, ply: s.ply,
    myCards: s.taken[seat].length, oppCards: s.taken[1 - seat].length, last: s.last, dealer: s.dealer,
    bottom: s.bottom, bottomDealt: s.stock.length === 0, bottomPlayed: s.log.some(e => e.card === s.bottom), seed: s.seed, rules: s.rules,
  };
}
