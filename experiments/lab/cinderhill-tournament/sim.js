// Cinderhill tournament toy: the rules. Pure, integer and seeded: no DOM, no Math.random, no float in the state.
// Two colonies settle a border by display (02-spec 6.7). Each side walks ants to a ring; at most CAP of a side stand in
// it at once. Displaying ants tire. A fresh ant stands taller on its legs (stilt-walks), a tired one sags. Each tick the
// side that looks bigger pulls the tug toward itself; a tug that reaches BREAK makes the other side break and run,
// and only then can ants die. Otherwise the contest ends after LENGTH ticks and the tug's side wins the ground.
//
//   create(seed, { a: { ants }, b: { ants } })   a contest; side a is the player in the page
//   command(game, side, verb)                    verb: 'send' | 'hold' | 'rotate'; returns false when it did nothing
//   step(game)                                   one tick (TPS a second); returns game.over (null while it runs)
//   look(game, side)                             what a side shows now: { n, count, fresh, total }
//   seen(game, side)                             what a pacer on that side may read (own ants, both rings)
//   hash(game)                                   32-bit FNV-1a of the whole state, for determinism checks
//
// All tuning numbers are below, with what they mean in seconds. NOTES.md has the arithmetic behind them.

export const TPS = 10;              // ticks a second
export const LENGTH = 90 * TPS;     // a contest lasts 90 s (the spec says 60 s; the toy brief asked for about 90 s)
export const CAP = 30;              // most ants of one side in the ring at once
export const WAVE = 10;             // ants in one wave (Send wave, Rotate)
export const FULL = 1000;           // stamina of a fully fed, rested ant
export const DRAIN = 4;             // stamina a displaying ant spends a tick: full to empty in 25 s
export const WAIT_EVERY = 4;        // a waiting ant (at the ring edge, in the sun) spends 1 stamina every WAIT_EVERY ticks
export const WALK_DRAIN = 1;        // walking to or from the ring
export const REST = 5;              // stamina a lean colony's resting ant regains a tick (fed +1, well fed +2): 20 s to 14 s from empty to full
export const WALK = 25;             // ticks to walk between nest and ring (2.5 s)
export const GATE = 2;              // ants of one side that can step into the ring a tick
export const SAG = 250;             // below this an ant stops stilting and crouches
export const STILT = 30;            // ticks a newly arrived ant stands extra tall (3 s)
export const BREAK = 150000;        // tug that makes the weaker side break
export const DRAW = 8000;           // a tug closer to the middle than this at the end is a draw
export const BIG_LO = 88, BIG_HI = 112; // a colony's mean worker size, drawn per contest
export const LEAK = 300;            // the tug forgets: each tick it loses 1/LEAK of itself, so the last ~30 s weigh most
export const BASE = 70;             // posture (height, %) the count bar assumes; freshness is the rest

// Where an ant is.
export const NEST = 0, OUT = 1, EDGE = 2, RING = 3, HOME = 4, DEAD = 5;

let MUT = null; // a deliberately broken rule for `node bots.mjs --mutate=...`; the page never sets it
export const mutate = name => { MUT = name || null; };
const cap = () => (MUT === 'cap' ? 1000 : CAP);

// mulberry32: integer only, so every engine gives the same numbers.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

function makeSide(r, ants) {
  // Each colony has its own day, shown to the player before the contest: how well fed it is (0 lean, 1 fed,
  // 2 well fed: rest REST, REST+1 or REST+2 a tick, and fuller ants at the start) and how big its workers run (BIG_LO..BIG_HI).
  const fed = r() % 3, big = BIG_LO + (r() % (BIG_HI - BIG_LO + 1));
  const s = { ants, fed, big, rest: REST + fed, size: new Int32Array(ants), stam: new Int32Array(ants), where: new Int8Array(ants), timer: new Int32Array(ants),
    age: new Int32Array(ants), relieve: new Int8Array(ants), order: new Int32Array(ants), tug: 0, dead: 0, sent: 0, rotations: 0, holds: 0 };
  for (let i = 0; i < ants; i++) {
    s.size[i] = big - 15 + (r() % 31);           // body size: the colony's mean, give or take 15
    s.stam[i] = Math.min(FULL, 600 + 100 * fed + (r() % 301)); // each ant's stamina at the start
  }
  return s;
}

export function create(seed, { a = { ants: 60 }, b = { ants: 60 } } = {}) {
  const r = rng(seed);
  const game = { seed: seed >>> 0, t: 0, tug: 0, over: null, arrivals: 0, rand: 0, sides: [makeSide(r, a.ants), makeSide(r, b.ants)], log: [] };
  game.rand = r() >>> 0;
  return game;
}

function nextRand(game) {
  // The contest's own stream, kept as one integer in the state so a copied game goes on identically.
  let t = (game.rand = (game.rand + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

// Posture: how tall an ant stands, in percent. Fresh ants stilt high; tired ones sag; a new arrival stands extra tall.
export function posture(stam, age) {
  if (MUT === 'fresh') return BASE;
  if (stam < SAG) return 40;
  return 40 + (60 * stam / FULL | 0) + (age < STILT ? 15 : 0);
}

// What one side shows now. `count` is what its ants would show at the base posture (numbers and size);
// `fresh` is what their posture adds or takes away (freshness and timing). total = count + fresh.
export function look(game, side) {
  const s = game.sides[side];
  let n = 0, count = 0, total = 0;
  for (let i = 0; i < s.ants; i++) {
    if (s.where[i] !== RING) continue;
    n++; count += s.size[i] * BASE; total += s.size[i] * posture(s.stam[i], s.age[i]);
  }
  count = count / 100 | 0; total = total / 100 | 0;
  return { n, count, fresh: total - count, total };
}

const inRing = s => { let n = 0; for (let i = 0; i < s.ants; i++) if (s.where[i] === RING) n++; return n; };
// Freshest first; ties go to the lower index so the choice never depends on the sort's stability.
const freshest = (s, where) => { const out = []; for (let i = 0; i < s.ants; i++) if (s.where[i] === where) out.push(i); return out.sort((x, y) => s.stam[y] - s.stam[x] || x - y); };
const tiredest = (s, where) => { const out = []; for (let i = 0; i < s.ants; i++) if (s.where[i] === where && !s.relieve[i]) out.push(i); return out.sort((x, y) => s.stam[x] - s.stam[y] || x - y); };

export function command(game, side, verb) {
  if (game.over) return false;
  const s = game.sides[side];
  game.log.push([game.t, side, verb]);
  if (verb === 'send' || verb === 'rotate') {
    const ready = freshest(s, NEST).filter(i => s.stam[i] > 0).slice(0, WAVE);
    for (const i of ready) { s.where[i] = OUT; s.timer[i] = WALK; s.order[i] = game.arrivals++; }
    s.sent += ready.length;
    if (verb === 'send') return ready.length > 0;
    // Rotate: mark the most tired ring ants. Each steps out when a fresh one steps in, so the ring never empties;
    // marked ants beyond the number sent step out at once (no one is coming for them).
    const tired = tiredest(s, RING).slice(0, WAVE);
    tired.forEach((i, k) => { if (k < ready.length) s.relieve[i] = 1; else { s.where[i] = HOME; s.timer[i] = WALK; } });
    if (tired.length) s.rotations++;
    return tired.length > 0 || ready.length > 0;
  }
  if (verb === 'hold') {
    // Hold back: ants on the way out or waiting at the edge turn home to rest. The ring itself stands.
    let n = 0;
    for (let i = 0; i < s.ants; i++) {
      if (s.where[i] === OUT) { s.where[i] = HOME; s.timer[i] = WALK - s.timer[i]; n++; }
      else if (s.where[i] === EDGE) { s.where[i] = HOME; s.timer[i] = WALK; n++; }
      s.relieve[i] = 0;
    }
    if (n) s.holds++;
    return n > 0;
  }
  return false;
}

function stepSide(game, s) {
  // Walking, resting and waiting.
  for (let i = 0; i < s.ants; i++) {
    const w = s.where[i];
    if (w === NEST) s.stam[i] = Math.min(FULL, s.stam[i] + s.rest);
    else if (w === OUT || w === HOME) {
      s.stam[i] = Math.max(0, s.stam[i] - WALK_DRAIN);
      if (--s.timer[i] <= 0) { s.where[i] = w === OUT ? EDGE : NEST; s.timer[i] = 0; }
    } else if (w === EDGE) {
      if ((game.t + i) % WAIT_EVERY === 0) s.stam[i] = Math.max(0, s.stam[i] - 1);
      if (s.stam[i] === 0) { s.where[i] = HOME; s.timer[i] = WALK; }
    } else if (w === RING) {
      s.stam[i] = Math.max(0, s.stam[i] - DRAIN); s.age[i]++;
      if (s.stam[i] === 0) { s.where[i] = HOME; s.timer[i] = WALK; s.relieve[i] = 0; } // spent: walks home on its own
    }
  }
  // The gate: waiting ants step in, in the order they were sent. A relieved ant steps out for each one that comes in.
  const waiting = []; for (let i = 0; i < s.ants; i++) if (s.where[i] === EDGE) waiting.push(i);
  waiting.sort((x, y) => s.order[x] - s.order[y] || x - y);
  let room = cap() - inRing(s), through = 0;
  for (const i of waiting) {
    if (through >= GATE) break;
    let out = -1;
    for (let j = 0; j < s.ants; j++) if (s.where[j] === RING && s.relieve[j]) { out = j; break; }
    if (out >= 0) { s.where[out] = HOME; s.timer[out] = WALK; s.relieve[out] = 0; room++; }
    if (room <= 0) break;
    s.where[i] = RING; s.age[i] = 0; room--; through++;
  }
}

export function step(game) {
  if (game.over) return game.over;
  for (const s of game.sides) stepSide(game, s);
  const a = look(game, 0), b = look(game, 1);
  // Sizing each other up is noisy: each side's show reads up to 3% high or low each tick.
  const ja = a.total * ((nextRand(game) % 61) - 30) / 1000 | 0, jb = b.total * ((nextRand(game) % 61) - 30) / 1000 | 0;
  const pull = (a.total + ja) - (b.total + jb);
  game.tug += pull - Math.trunc(game.tug / LEAK);
  game.sides[0].tug += Math.max(0, pull); game.sides[1].tug += Math.max(0, -pull);
  game.t++;
  if (game.tug >= BREAK || game.tug <= -BREAK) return finish(game, game.tug > 0 ? 0 : 1, true);
  if (game.t >= LENGTH) return finish(game, game.tug >= DRAW ? 0 : game.tug <= -DRAW ? 1 : -1, false);
  return null;
}

function finish(game, winner, broke) {
  let deaths = 0;
  if (broke) {
    // The loser breaks and runs. Spent ants (below 300) cannot outrun the chase; at most 6 are caught.
    const s = game.sides[1 - winner];
    const slow = tiredest(s, RING).concat(tiredest(s, EDGE)).filter(i => s.stam[i] < 300).slice(0, 6);
    for (const i of slow) { s.where[i] = DEAD; s.dead++; deaths++; }
    for (let i = 0; i < s.ants; i++) if (s.where[i] === RING || s.where[i] === EDGE || s.where[i] === OUT) { s.where[i] = HOME; s.timer[i] = WALK; }
  }
  game.over = { winner, broke, deaths, t: game.t, tug: game.tug, margin: Math.min(100, Math.abs(game.tug) * 100 / BREAK | 0) };
  return game.over;
}

// What a side can see, for a pacer (a bot or the neighbour): its own ants in full, and both rings as they look.
export function seen(game, side) {
  const s = game.sides[side], mine = look(game, side), theirs = look(game, 1 - side);
  const at = { nest: [], out: 0, edge: 0, ring: [], home: 0 };
  for (let i = 0; i < s.ants; i++) {
    const w = s.where[i];
    if (w === NEST) at.nest.push(s.stam[i]); else if (w === RING) at.ring.push(s.stam[i]);
    else if (w === OUT) at.out++; else if (w === EDGE) at.edge++; else if (w === HOME) at.home++;
  }
  at.nest.sort((x, y) => y - x); at.ring.sort((x, y) => x - y);
  return { t: game.t, left: LENGTH - game.t, tug: side === 0 ? game.tug : -game.tug, mine, theirs, ...at };
}

// What the page draws and reports: counts by place and the mean stamina of each group.
export function tally(game, side) {
  const s = game.sides[side], n = [0, 0, 0, 0, 0, 0], st = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < s.ants; i++) { n[s.where[i]]++; st[s.where[i]] += s.stam[i]; }
  const mean = k => (n[k] ? st[k] / n[k] | 0 : 0);
  return { nest: n[NEST], out: n[OUT], edge: n[EDGE], ring: n[RING], home: n[HOME], dead: n[DEAD],
    nestFresh: mean(NEST), ringFresh: mean(RING), ready: freshest(s, NEST).filter(i => s.stam[i] >= 600).length };
}

export function hash(game) {
  let h = 0x811c9dc5;
  const mix = v => { h ^= v & 0xff; h = Math.imul(h, 0x01000193); h ^= (v >>> 8) & 0xff; h = Math.imul(h, 0x01000193); h ^= (v >>> 16) & 0xff; h = Math.imul(h, 0x01000193); h ^= (v >>> 24) & 0xff; h = Math.imul(h, 0x01000193); };
  mix(game.t); mix(game.tug | 0); mix((game.tug / 4294967296) | 0); mix(game.rand);
  for (const s of game.sides) for (let i = 0; i < s.ants; i++) { mix(s.stam[i]); mix(s.where[i]); mix(s.timer[i]); mix(s.age[i]); mix(s.relieve[i]); mix(s.order[i]); }
  return h >>> 0;
}

// Run a whole contest with two pacers (functions of seen() that return a verb or null). Pacers decide every
// `every` ticks, as a person would; they never read the other side's stamina.
export function play(seed, pa, pb, { a = 60, b = 60, every = 5 } = {}) {
  const game = create(seed, { a: { ants: a }, b: { ants: b } });
  const minds = [pa(), pb()];
  while (!game.over) {
    if (game.t % every === 0) for (const side of [0, 1]) { const v = minds[side](seen(game, side)); if (v) command(game, side, v); }
    step(game);
  }
  return game;
}
