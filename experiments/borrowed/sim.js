// Borrowed Time: the rules. Pure and seeded; no window, document, Math.random or Date, so bots.mjs runs it in Node.
//
// You have forgotten who you are. A run is one life told in three chapters: the child, the grown-up and the old one,
// each on its own island, all lit by one candle. In each chapter six faces could be you. Memories lie around the
// island. Most are locked, and each lock needs an ability. Every use of an ability burns years off the candle, and
// the years left carry into the next chapter. Name all three selves before the candle goes out.
//
// Each memory opens a pair of photographs. Exactly one lies. Compare the prints with a held fact,
// a candidate face or an exposed witness seal, or match two torn edges. A wrong tap costs PICK
// years, "Show me" costs SHOW years, and "Later" leaves the memory on the island.
// With opts.lies === false (the page's ?lies=0), a memory is yours as soon as you reach it.
//
//   const s = newRun(seed)                 a run; the same seed gives the same islands, faces, answers and puzzles
//   walkTo(s, x, y)                        walk to a tile (or as near as the island allows)
//   ready(s, id)                           true when ability id has something to act on here
//   use(s, id)                             spend its cost and act; with nothing to act on it does nothing and costs nothing
//   step(s)                                one tick of 1/60 s (nothing moves or burns while a puzzle is open)
//   pickLie(s, i)                          in an open puzzle, say picture i lies
//   showMe(s)                              in an open puzzle, pay SHOW years to be shown the lie
//   later(s)                               close the puzzle; the memory stays open on the island
//   guess(s, i)                            name face i; a wrong name costs wrongCost(s) years; ends the chapter (and after the
//                                          third, the run)
//   nextChapter(s)                         after a named chapter: build the next island
//   s.events                               what happened since the page last emptied it
//
// Tiles are 1 x 1; the player's position is in tile units, centre of tile (i, j) is (i + 0.5, j + 0.5).

export const DT = 1 / 60;
export const LIFE = 135; // years on the candle at the start of the run; 150 left a careful player 50 to 90 years, so no
// price felt real. At 135 a slow player who taps one true photo in every chapter still finishes, with about 22 years
// left at the median (bots.mjs, "a first-timer")
export const BURN = 0.15; // years a second while you walk and look; frozen on the puzzles, the picture choice, between chapters and on pause
export const WRONG = 30; // years a wrong name costs with puzzles
export const wrongCost = s => s.lies ? WRONG : 15;
export const PICK = 12; // years a wrong pick in a puzzle costs (you said a true picture lies)
export const SHOW = 5; // years "Show me" costs; below PICK / 2, so a blind tap never beats paying
export const SELF_POINTS = 100; // points for each self named right; each right name keeps one third of the 10-points-per-year bonus
export const SPEED = 3.2; // tiles a second
export const LEAP_TICKS = 32;
export const GLOW_R = 2.3; // the dark memory must be this close to light it
export const NEAR = 1.5; // push and rewind reach (tiles, centre to centre)

export const ABILITIES = [
  { id: 'glow', name: 'Light', cost: 10 },
  { id: 'push', name: 'Push', cost: 13 },
  { id: 'leap', name: 'Leap', cost: 16 },
  { id: 'rewind', name: 'Rewind', cost: 20 }, // the mirror holds the biggest memory
];
export const COST = Object.fromEntries(ABILITIES.map(a => [a.id, a.cost]));
// Which ability opens which lock.
export const LOCK_ABILITY = { free: null, push: 'push', leap: 'leap', dark: 'glow', rewind: 'rewind' };

// What a person is: one value in each of four kinds.
export const DIMS = ['hat', 'tool', 'pet', 'place'];
export const VALUES = [
  ['crown', 'straw', 'cone', 'beret'],
  ['brush', 'flute', 'key', 'flower'],
  ['cat', 'bird', 'frog', 'snail'],
  ['sea', 'forest', 'city', 'peaks'],
];
export const FACES = 6;
// Hat and held thing make the role; the gallery keeps the sixteen roles.
export const ROLES = [
  ['Royal Painter', 'Royal Piper', 'Royal Keykeeper', 'Royal Gardener'],
  ['Fence Painter', 'Field Piper', 'Farm Keeper', 'Flower Farmer'],
  ['Spell Painter', 'Wind Wizard', 'Door Wizard', 'Herb Wizard'],
  ['Street Artist', 'Busker', 'Locksmith', 'Florist'],
];
export const roleId = face => face[0] * 4 + face[1];
export const roleName = face => ROLES[face[0]][face[1]];
const PLACE_WORD = ['by the sea', 'in the forest', 'in the city', 'in the mountains'];
export const describe = face => `${roleName(face)}, ${PLACE_WORD[face[3]]}, with a ${VALUES[2][face[2]]}`;

// Islands. # rock or tree, ~ water, . grass, , dark grass, B cracked boulder, = water that turns to stones,
// S start, F free memory, P memory behind a boulder, L memory on an island, D memory in the dark, M broken mirror,
// > leap stone on the shore, j leap stone on the island. Every row is 7 wide.
export const ISLANDS = [
  [
    '#######',
    '#Lj~,D#',
    '#~=~,,#',
    '#.>...#',
    '#..#..#',
    '##...##',
    '#P#..M#',
    '#B#...#',
    '#.....#',
    '#.##..#',
    '#.....#',
    '##..#.#',
    '#..F..#',
    '#.....#',
    '#..S..#',
    '#######',
  ],
  [
    '#######',
    '#,D,#M#',
    '#,,,#.#',
    '#.....#',
    '##.#..#',
    '#..~~~#',
    '#.>=jL#',
    '#..~~~#',
    '#.....#',
    '#.#B#.#',
    '#.#P#.#',
    '#.###.#',
    '#.....#',
    '#.F...#',
    '#...S.#',
    '#######',
  ],
  [
    '#######',
    '#P#..M#',
    '#B#...#',
    '#.....#',
    '#.##.##',
    '#..,,,#',
    '#..,D,#',
    '#..,,,#',
    '#.....#',
    '#~~~..#',
    '#Lj=>.#',
    '#~~~..#',
    '##....#',
    '#..F..#',
    '#...S.#',
    '#######',
  ],
  [
    '#######',
    '#,,,#M#',
    '#,D,#.#',
    '#,,,..#',
    '#.#...#',
    '#....##',
    '#..#BP#',
    '#...###',
    '#..~~~#',
    '#..~jL#',
    '#..~=~#',
    '#...>.#',
    '##....#',
    '#.F...#',
    '#..S..#',
    '#######',
  ],
  [
    '#######',
    '#~~~.M#',
    '#Lj=>.#',
    '#~~~..#',
    '#.....#',
    '#.#.#.#',
    '#.....#',
    '###.#B#',
    '#,,,#P#',
    '#,D,###',
    '#,,,..#',
    '#.....#',
    '#..#..#',
    '#....F#',
    '#.S...#',
    '#######',
  ],
  [
    '#######',
    '#..,,,#',
    '#M.,D,#',
    '#..,,,#',
    '#.....#',
    '#.#.#.#',
    '#.....#',
    '#.###.#',
    '#.#P#.#',
    '#..B..#',
    '#.....#',
    '#..~~~#',
    '#.>=jL#',
    '#..~~~#',
    '#.S.F.#',
    '#######',
  ],
  [
    '#######',
    '#~~~#P#',
    '#Lj~.B#',
    '#~=~..#',
    '#.>...#',
    '#.....#',
    '##.#..#',
    '#...M.#',
    '#.#...#',
    '#.....#',
    '#.##,,#',
    '#..,D,#',
    '#..,,,#',
    '#.F...#',
    '#...S.#',
    '#######',
  ],
];
// The three chapters. Each later one is harder in a way you can see:
//  - the child: no mirror, and any two faces differ in at least two kinds, so one memory often settles it;
//  - the grown-up: every lock, and two faces may differ in a single kind;
//  - the old one: no free memory (every clue costs years) and the candle burns faster.
// With lies, each chapter also brings one new kind of puzzle (see makePuzzles).
// Each run deals three different islands of the seven to the three chapters, each maybe mirrored, so two lives in a row
// rarely look alike. bots.mjs proves every island: each lock opens only with its ability, and opens with it.
export const CHAPTERS = [
  { id: 'child', name: 'Child', apart: 2, drop: 'M', burn: 1 },
  { id: 'grown', name: 'Grown-up', apart: 1, drop: '', burn: 1 },
  { id: 'old', name: 'Old', apart: 1, drop: 'F', burn: 1.5 },
];
const LOCK_OF = { F: 'free', P: 'push', L: 'leap', D: 'dark', M: 'rewind' };

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, n) => Math.floor(r() * n);
function shuffle(r, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = pick(r, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
// The daily seed: the same for everyone on a calendar date. The page passes the date in.
export function dailySeed(y, m, d) {
  let h = (y * 10000 + m * 100 + d) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// The six faces. They are made without reference to the answer, by rules that treat every face the same:
//  - in each kind, every value that is used is shared by at least two faces, so no single memory names anyone;
//  - any two faces differ in at least `apart` kinds (2 for the child; 1 later, so sometimes only the last kind settles it).
// For each kind, one pattern is drawn from GROUPS (4+2 three times as often as 3+3; the child draws from CHILD_GROUPS), and its values are dealt to the
// faces in a random order.
// The answer is then picked uniformly, so a guess with no memories is right one time in six.
export const GROUPS = [[4, 2], [4, 2], [3, 3], [4, 2]];
// The child's faces must sit further apart, so its kinds split more evenly.
export const CHILD_GROUPS = [[4, 2], [3, 3], [2, 2, 2]];
export function makeFaces(r, apart = 1, groups = GROUPS) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const faces = Array.from({ length: FACES }, () => [0, 0, 0, 0]);
    for (let d = 0; d < 4; d++) {
      const sizes = groups[pick(r, groups.length)];
      const values = shuffle(r, [0, 1, 2, 3]);
      const deal = [];
      sizes.forEach((n, k) => { for (let i = 0; i < n; i++) deal.push(values[k]); });
      shuffle(r, deal);
      deal.forEach((v, i) => { faces[i][d] = v; });
    }
    let ok = true;
    for (let a = 0; a < FACES && ok; a++) {
      for (let b = a + 1; b < FACES && ok; b++) {
        if (hamming(faces[a], faces[b]) < apart) ok = false;
      }
    }
    if (ok) return faces;
  }
  throw new Error('no faces');
}
export const hamming = (a, b) => a.reduce((n, v, d) => n + (v !== b[d] ? 1 : 0), 0);

// Faces that agree with every memory found so far. known[d] is a value or null.
export function consistent(faces, known) {
  const out = [];
  faces.forEach((f, i) => { if (f.every((v, d) => known[d] === null || known[d] === v)) out.push(i); });
  return out;
}

// ---------------------------------------------------------------- the puzzles: which picture lies?
// A picture (fragment) is { dims, vals }: two kinds of you and a value for each. Exactly one picture of a puzzle lies:
// it does not fit the true you. Every other picture fits.
export const fits = (face, frag) => frag.dims.every((d, k) => face[d] === frag.vals[k]);
// The picture that would lie if this face were you: its index, or -1 when no picture or more than one would lie
// (then this face cannot be you).
export function liarFor(face, frags) {
  let liar = -1;
  for (let i = 0; i < frags.length; i++) {
    if (fits(face, frags[i])) continue;
    if (liar >= 0) return -1;
    liar = i;
  }
  return liar;
}
// What a careful player can work out from what they know: the faces still in the running (known clues), the pictures,
// and any picture already shown to be true (tried). Returns the lie's index when every face still possible points at
// the same picture, else -1 (not yet decidable). It never looks at the answer.
export function solveLie(faces, known, frags, tried = []) {
  let found = -1;
  for (const i of consistent(faces, known)) {
    const l = liarFor(faces[i], frags);
    if (l < 0 || tried[l]) continue;
    if (found >= 0 && found !== l) return -1;
    found = l;
  }
  return found;
}
// A matching tear identifies the good half. A signed photo can also be ruled out by a seal
// already exposed on a lie. The index returned is always the rejected photograph, for every form.
export function solvePuzzle(faces, known, puzzle, exposed = []) {
  if (puzzle.form === 'torn') return puzzle.frags.findIndex(f => f.edge !== puzzle.edge);
  const signed = puzzle.frags.findIndex(f => f.seal !== undefined && exposed.includes(f.seal));
  return signed >= 0 ? signed : solveLie(faces, known, puzzle.frags, puzzle.tried);
}

const KINDS = [0, 1, 2, 3];
const otherValue = (r, value) => shuffle(r, KINDS.filter(v => v !== value))[0];

// The entry shows two kinds. Each value of its lie is on some face, but no face has the two together, so it is settled
// by one small deduction from the portraits alone: find a face with both. The true photo leaves at least two faces.
// Which second kind the entry shows sets how much it tells: the child's tells the most and the old one's the least
// (counted as the pairs of values the faces show), so a guess after the first memory gets harder chapter by chapter.
// Each other kind comes from a paid memory. A rival agrees with the answer on both entry kinds; the dependent photo
// stays plausible for the rival until the parent tells the first kind they disagree on.
function entryOf(r, ch, faces, self) {
  const options = [];
  const used = d => KINDS.filter(v => faces.some(f => f[d] === v));
  for (const [a, x] of shuffle(r, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]])) {
    const pairs = new Set(faces.map(f => f[a] * 4 + f[x]));
    const left = faces.filter(f => f[a] === self[a] && f[x] === self[x]).length;
    if (left < 2) continue;
    const lies = [];
    for (const u of used(a)) for (const v of used(x)) {
      if (!pairs.has(u * 4 + v)) lies.push({ vals: [u, v], near: (u === self[a]) + (v === self[x]) });
    }
    if (!lies.length) continue;
    const near = Math.max(...lies.map(l => l.near));
    options.push({ anchor: a, x, left, lie: shuffle(r, lies.filter(l => l.near === near))[0].vals });
  }
  if (!options.length) return null;
  options.sort((p, q) => p.left - q.left);
  return ch.id === 'child' ? options[0] : ch.id === 'old' ? options.at(-1) : options[options.length >> 1];
}
function makePuzzles(r, ch, faces, answer, dimsOf) {
  const self = faces[answer];
  const entry = ch.id === 'old' ? 'push' : 'free';
  const two = entryOf(r, ch, faces, self);
  const anchor = two ? two.anchor : dimsOf[entry][0];
  // Rarely no second kind works; the entry then shows the one kind with a value no face has, as before.
  const x = two ? two.x : null;
  const rivals = shuffle(r, faces.filter((f, i) => i !== answer && f[anchor] === self[anchor] && (x === null || f[x] === self[x])));
  const rival = rivals.reduce((best, f) => hamming(f, self) > hamming(best, self) ? f : best);
  const unseen = shuffle(r, KINDS.filter(d => d !== anchor && d !== x));
  const [first, next, spare] = unseen.sort((a, b) => Number(rival[b] !== self[b]) - Number(rival[a] !== self[a]));
  const other = x ?? spare; // the kind the entry or a spare memory adds beside first and next
  const falseSeal = pick(r, 4);
  const [parentSeal, dependentSeal] = shuffle(r, KINDS.filter(v => v !== falseSeal));

  function pair(dims, falseValues, form = 'lie', trueSeal) {
    const liar = pick(r, 2);
    const good = { dims, vals: dims.map(d => self[d]) };
    const bad = { dims, vals: falseValues };
    const edge = pick(r, 4);
    if (form === 'torn') {
      good.edge = edge;
      bad.edge = otherValue(r, edge);
    } else if (form === 'signed') {
      good.seal = trueSeal;
      bad.seal = falseSeal;
    }
    const frags = [good];
    frags.splice(liar, 0, bad);
    return { form, frags, liar, dims, ...(form === 'torn' ? { edge } : {}) };
  }

  const out = {
    [entry]: two ? pair([anchor, x], two.lie)
      : pair([anchor], [shuffle(r, KINDS.filter(v => !faces.some(f => f[anchor] === v)))[0]]),
  };
  const mismatch = d => otherValue(r, self[d]);
  const witnessed = (a, d) => {
    const witness = faces.find(f => f[a] !== self[a] && f[d] !== self[d]);
    return pair([a, d].sort(), [a, d].sort().map(k => witness ? witness[k] : mismatch(k)));
  };
  if (ch.id === 'child') {
    out.push = witnessed(anchor, first);
    out.leap = witnessed(anchor, next);
    out.dark = witnessed(other, x === null ? spare : next);
  } else if (ch.id === 'grown') {
    out.push = pair([first], [rival[first]], 'torn');
    out.dark = pair([first, next], [rival[first], rival[next]]);
    out.leap = pair([other, next].sort(), [other, next].sort().map(d => mismatch(d)));
    if (x === null) out.leap = pair([anchor, spare], [mismatch(anchor), mismatch(spare)]);
    out.rewind = pair([first, other].sort(), [first, other].sort().map(d => d === first ? rival[first] : mismatch(d)), 'torn');
  } else {
    const witness = faces.find(f => f[anchor] !== self[anchor] && f[first] !== self[first]);
    const falseParent = witness ?? KINDS.map(d => d === anchor ? mismatch(anchor) : rival[d]);
    const parentDims = [anchor, first, other].sort();
    out.leap = pair(parentDims, parentDims.map(d => falseParent[d]), 'signed', parentSeal);
    out.dark = pair([first, next], [rival[first], rival[next]], 'signed', dependentSeal);
    // The old mirror shows the two kinds the entry does not: one Rewind can stand in for Leap and Light. When the mirror
    // repeated the entry's kind, Rewind added only what Leap adds and fell to about 1 run in 10.
    out.rewind = pair([first, next].sort(), [first, next].sort().map(d => d === first ? rival[first] : mismatch(d)), 'torn');
  }
  return out;
}

// A run: its three islands are drawn from the seed; each chapter is drawn from its own seed, so a chapter is the same
// whatever happened before it. opts.order forces the island order, opts.answers forces the answer of each chapter,
// opts.lies === false plays without the puzzles.
export function newRun(seed, opts = {}) {
  const r = rng(seed);
  const order = opts.order ?? shuffle(r, ISLANDS.map((_, i) => i)).slice(0, CHAPTERS.length);
  const s = {
    seed: seed >>> 0, order, opts: { answers: opts.answers ?? null }, lies: opts.lies !== false, chapter: 0, chapters: [],
    life: LIFE, t: 0, status: 'play', score: 0, right: 0,
    used: { glow: 0, push: 0, leap: 0, rewind: 0 }, spent: 0, found: 0, tiles: 0, events: [],
    puzzles: { found: 0, wrong: 0, shown: 0, later: 0, years: 0 }, open: null,
  };
  buildChapter(s, 0);
  return s;
}
export const chapterSeed = (seed, k) => (Math.imul((seed >>> 0) ^ 0x5bd1e995, 0x9e3779b1) + Math.imul(k + 1, 0x85ebca6b)) >>> 0;

// The answer of chapter k is a function of the seed alone. A life is three different people: when the drawn face has
// the role of an earlier chapter's answer and another face has a new role, the answer is redrawn evenly among the faces
// with new roles, from a stream of its own so the island and its memories stay as drawn.
function answerOf(seed, k, faces, drawn) {
  const earlier = [];
  for (let j = 0; j < k; j++) {
    const r = rng(chapterSeed(seed, j)); r();
    const fj = makeFaces(r, CHAPTERS[j].apart, CHAPTERS[j].apart > 1 ? CHILD_GROUPS : GROUPS);
    earlier.push(roleId(fj[answerOf(seed, j, fj, pick(r, FACES))]));
  }
  const fresh = faces.map((f, i) => i).filter(i => !earlier.includes(roleId(faces[i])));
  if (!fresh.length || fresh.includes(drawn)) return drawn;
  return fresh[pick(rng(chapterSeed(seed, k) ^ 0x6d2b79f5), fresh.length)];
}

function buildChapter(s, k) {
  const ch = CHAPTERS[k], r = rng(chapterSeed(s.seed, k));
  const tpl = s.order[k];
  const flip = r() < 0.5;
  const faces = makeFaces(r, ch.apart, ch.apart > 1 ? CHILD_GROUPS : GROUPS);
  let answer = answerOf(s.seed, k, faces, pick(r, FACES));
  // Without puzzles (?lies=0), which kinds of memory sit where. The free memory by the start shows one kind at random. With a mirror: push, leap
  // and dark each guard one kind, and the mirror shows two, one of them the kind no other lock has. Without a mirror
  // (the child) push, leap and dark guard the three kinds the free memory does not show. Every kind can be found.
  const freeDim = pick(r, 4);
  const lockDims = shuffle(r, [0, 1, 2, 3]);
  const second = shuffle(r, [lockDims[0], lockDims[1], lockDims[2]])[0];
  const rest = lockDims.filter(d => d !== freeDim);
  const dimsOf = ch.drop === 'M'
    ? { free: [freeDim], push: [rest[0]], leap: [rest[1]], dark: [rest[2]] }
    : { free: [freeDim], push: [lockDims[0]], leap: [lockDims[1]], dark: [lockDims[2]], rewind: [lockDims[3], second].sort() };
  // In the old chapter Push also holds the kind otherwise exclusive to the mirror, so Light, Push and Leap cover every
  // kind. With puzzles (the default) each memory's kinds come from its puzzle instead (makePuzzles).
  if (ch.id === 'old') dimsOf.push = [lockDims[0], lockDims[3]].sort();
  if (s.opts.answers) answer = s.opts.answers[k];
  // The puzzles come after the answer is fixed and use their own random stream.
  const puzzles = s.lies ? makePuzzles(rng(chapterSeed(s.seed, k) ^ 0x2f6b1d37), ch, faces, answer, dimsOf) : null;

  const rows = ISLANDS[tpl].map(row => (flip ? [...row].reverse().join('') : row).replaceAll(ch.drop || '@', '.'));
  const h = rows.length, w = rows[0].length;
  const grid = [], dark = new Uint8Array(w * h), lit = new Uint8Array(w * h);
  const spots = [];
  let start = null, pad = null, landing = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = rows[y][x];
      if (c === 'S') { start = { x, y }; c = '.'; }
      if (c === '>') { pad = { x, y }; c = '.'; }
      if (c === 'j') { landing = { x, y }; c = '.'; }
      if (c === ',') { dark[y * w + x] = 1; c = '.'; }
      if (LOCK_OF[c]) {
        const lock = LOCK_OF[c];
        const spot = { x, y, lock, dims: dimsOf[lock], taken: false, open: lock !== 'dark' && lock !== 'rewind' };
        if (puzzles) {
          const z = puzzles[lock];
          spot.dims = z.dims;
          spot.puzzle = { ...z, tried: z.frags.map(() => false), seen: false, solved: false, how: null };
          spot.snooze = false;
        }
        spots.push(spot);
        if (lock === 'dark') dark[y * w + x] = 1;
        c = '.';
      }
      grid.push(c);
    }
  }
  Object.assign(s, {
    chapter: k, island: tpl, flip, w, h, grid, dark, lit, spots, pad, landing, burn: BURN * ch.burn,
    faces, answer, known: [null, null, null, null], exposed: [], guessed: -1, status: 'play', open: null,
    px: start.x + 0.5, py: start.y + 0.5, path: [], target: null, face: 1, anim: null, bridge: false,
    chapterStart: { life: s.life, t: s.t, spent: s.spent, found: s.found, uses: usesOf(s), puzzles: { ...s.puzzles } },
  });
}
const usesOf = s => s.used.glow + s.used.push + s.used.leap + s.used.rewind;
export function nextChapter(s) {
  if (s.status !== 'named') return false;
  buildChapter(s, s.chapter + 1);
  s.events.push({ type: 'chapter', chapter: s.chapter });
  return true;
}

// ---------------------------------------------------------------- the island
const at = (s, x, y) => (x < 0 || y < 0 || x >= s.w || y >= s.h ? '#' : s.grid[y * s.w + x]);
export const passable = (s, x, y) => { const c = at(s, x, y); return c === '.' || c === '_'; };
export const tileOf = s => ({ x: Math.floor(s.px), y: Math.floor(s.py) });

// Breadth-first search over passable tiles. Returns the tile list from start (excluded) to the reachable tile
// nearest the goal, so a tap on water or a boulder walks to the shore beside it.
export function route(s, from, goal) {
  const n = s.w * s.h, prev = new Int32Array(n).fill(-2), dist = new Int32Array(n).fill(-1);
  const q = [from.y * s.w + from.x];
  prev[q[0]] = -1; dist[q[0]] = 0;
  let best = q[0], bestScore = Infinity;
  for (let k = 0; k < q.length; k++) {
    const c = q[k], x = c % s.w, y = (c - x) / s.w;
    const score = Math.hypot(x - goal.x, y - goal.y) * 1000 + dist[c];
    if (score < bestScore) { bestScore = score; best = c; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, nc = ny * s.w + nx;
      if (!passable(s, nx, ny) || prev[nc] !== -2) continue;
      prev[nc] = c; dist[nc] = dist[c] + 1; q.push(nc);
    }
  }
  const out = [];
  for (let c = best; prev[c] !== -1; c = prev[c]) out.push({ x: c % s.w, y: Math.floor(c / s.w) });
  return out.reverse();
}

export function walkTo(s, x, y) {
  if (s.status !== 'play' || s.anim || s.open) return;
  const goal = { x: Math.max(0, Math.min(s.w - 1, Math.floor(x))), y: Math.max(0, Math.min(s.h - 1, Math.floor(y))) };
  // A tap on the tile you stand on reopens a memory you left for later.
  const here = tileOf(s);
  if (!s.path.length && goal.x === here.x && goal.y === here.y) {
    const p = s.spots.find(q => q.snooze && q.x === here.x && q.y === here.y);
    if (p) p.snooze = false;
  }
  // Start from the tile we are stepping onto, so a new target never makes us turn back mid-step.
  const from = s.path.length ? s.path[0] : here;
  const rest = route(s, from, goal);
  s.path = s.path.length ? [s.path[0], ...rest] : rest;
  s.target = goal;
}
export function stop(s) {
  s.path = s.path.length ? [s.path[0]] : [];
}

// ---------------------------------------------------------------- abilities
const dist = (s, x, y) => Math.hypot(s.px - (x + 0.5), s.py - (y + 0.5));
const spotOf = (s, lock) => s.spots.find(p => p.lock === lock);
export function ready(s, id) {
  if (s.status !== 'play' || s.anim || s.open) return false;
  if (id === 'glow') {
    const p = spotOf(s, 'dark');
    return !!p && !p.open && dist(s, p.x, p.y) <= GLOW_R;
  }
  if (id === 'push') return boulders(s).length > 0;
  if (id === 'leap') return !!leapTo(s);
  if (id === 'rewind') {
    const p = spotOf(s, 'rewind');
    return !!p && !p.open && dist(s, p.x, p.y) <= NEAR;
  }
  return false;
}
function boulders(s) {
  const out = [];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (at(s, x, y) === 'B' && dist(s, x, y) <= NEAR) out.push({ x, y });
  return out;
}
// Leap from the shore stone to the island stone, or back, while the stepping stones are still under water.
function leapTo(s) {
  if (!s.pad || s.bridge) return null;
  const t = tileOf(s);
  if (dist(s, t.x, t.y) > 0.45) return null; // standing on the stone, not passing its corner
  if (t.x === s.pad.x && t.y === s.pad.y) return s.landing;
  if (t.x === s.landing.x && t.y === s.landing.y) return s.pad;
  return null;
}
export function use(s, id) {
  if (!ready(s, id)) { s.events.push({ type: 'nope', id }); return false; }
  const cost = COST[id];
  s.life -= cost; s.spent += cost; s.used[id]++;
  s.events.push({ type: 'use', id, cost, x: s.px, y: s.py });
  if (id === 'glow') {
    const p = spotOf(s, 'dark');
    light(s, p.x, p.y);
    p.open = true;
  } else if (id === 'push') {
    for (const b of boulders(s)) { s.grid[b.y * s.w + b.x] = '.'; s.events.push({ type: 'break', x: b.x, y: b.y }); }
  } else if (id === 'leap') {
    const to = leapTo(s);
    s.path = []; s.target = null;
    s.anim = { type: 'leap', fx: s.px, fy: s.py, tx: to.x + 0.5, ty: to.y + 0.5, k: 0 };
    s.face = to.x + 0.5 >= s.px ? 1 : -1;
  } else if (id === 'rewind') {
    const p = spotOf(s, 'rewind');
    p.open = true;
    s.path = []; s.target = null;
    if (s.life > 0) reach(s, p); // the memory shows in the mended mirror
  }
  if (s.life <= 0) fade(s);
  return true;
}
// Light the dark patch round a memory: every dark tile joined to it.
function light(s, x, y) {
  const q = [[x, y]];
  s.lit[y * s.w + x] = 1;
  for (let k = 0; k < q.length; k++) {
    const [cx, cy] = q[k];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = cx + dx, ny = cy + dy, i = ny * s.w + nx;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h || !s.dark[i] || s.lit[i]) continue;
      s.lit[i] = 1; q.push([nx, ny]);
    }
  }
}

// ---------------------------------------------------------------- memories
// Reaching an open memory: without lies it is yours at once; with lies its puzzle opens (unless left for later).
function reach(s, p) {
  if (p.taken) return;
  if (!p.puzzle) { collect(s, p); return; }
  if (p.snooze) return;
  if (p.lock === 'leap') raise(s); // the stepping stones rise as you reach it, so leaving it for later does not strand you
  s.open = p; p.puzzle.seen = true;
  s.path = []; s.target = null;
  s.events.push({ type: 'puzzle', lock: p.lock, form: p.puzzle.form, n: p.puzzle.frags.length, x: p.x, y: p.y });
}
function collect(s, p) {
  if (p.taken) return;
  p.taken = true; s.found++;
  const values = p.dims.map(d => s.faces[s.answer][d]);
  const fresh = p.dims.some(d => s.known[d] === null);
  p.dims.forEach((d, k) => { s.known[d] = values[k]; });
  s.events.push({ type: 'memory', dims: p.dims, values, lock: p.lock, fresh, x: p.x, y: p.y });
  if (p.lock === 'leap') raise(s);
}
function raise(s) {
  if (s.bridge) return;
  s.bridge = true;
  for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === '=') s.grid[i] = '_';
  s.events.push({ type: 'bridge' });
}
function solved(s, p, how) {
  const z = p.puzzle;
  z.solved = true; z.how = how; s.open = null;
  const seal = z.frags[z.liar].seal;
  if (seal !== undefined && !s.exposed.includes(seal)) s.exposed.push(seal);
  if (how === 'found') s.puzzles.found++; else s.puzzles.shown++;
  s.events.push({ type: 'solved', how, liar: z.liar, form: z.form, lock: p.lock });
  collect(s, p);
}
// Say picture i lies. Right: the memory is yours. Wrong: PICK years, and that picture is shown to be true.
export function pickLie(s, i) {
  const p = s.open;
  if (!p || s.status !== 'play') return null;
  const z = p.puzzle;
  if (!(i >= 0 && i < z.frags.length) || z.tried[i]) return null;
  if (i === z.liar) { solved(s, p, 'found'); return true; }
  z.tried[i] = true;
  s.life -= PICK; s.puzzles.wrong++; s.puzzles.years += PICK;
  s.events.push({ type: 'wrong', i, cost: PICK, lock: p.lock });
  if (s.life <= 0) fade(s);
  return false;
}
// Pay SHOW years to be shown the lie.
export function showMe(s) {
  const p = s.open;
  if (!p || s.status !== 'play') return false;
  s.life -= SHOW; s.puzzles.years += SHOW;
  s.events.push({ type: 'shown', cost: SHOW, liar: p.puzzle.liar, lock: p.lock });
  if (s.life <= 0) { fade(s); return true; }
  solved(s, p, 'shown');
  return true;
}
// Close the puzzle; the memory waits on the island until you step on it again (or tap the tile you stand on).
export function later(s) {
  const p = s.open;
  if (!p) return false;
  p.snooze = true; s.open = null; s.puzzles.later++;
  s.events.push({ type: 'later', lock: p.lock });
  return true;
}

// ---------------------------------------------------------------- the tick
function fade(s, right = null) {
  s.life = 0; s.status = 'faded'; s.path = []; s.anim = null; s.open = null;
  record(s, right);
  s.score = s.right * SELF_POINTS;
  s.events.push({ type: 'faded', chapter: s.chapter });
}
// Only facts and photographs that were recovered go into the local album.
export function keepsake(s, right) {
  return {
    portrait: right ? [...s.faces[s.answer]] : null,
    photos: s.spots.filter(p => p.taken).flatMap(p => p.puzzle
      ? p.puzzle.frags.filter((_, i) => i !== p.puzzle.liar).map(({ dims, vals }) => ({ dims, vals }))
      : [{ dims: p.dims, vals: p.dims.map(d => s.known[d]) }]),
  };
}
// What one chapter came to; the page and the lab read s.chapters.
function record(s, right) {
  const c = s.chapterStart, z = s.puzzles, z0 = c.puzzles;
  s.chapters.push({
    chapter: s.chapter, id: CHAPTERS[s.chapter].id, island: s.island, face: [...s.faces[s.answer]],
    guessed: s.guessed, named: s.guessed >= 0 ? [...s.faces[s.guessed]] : null, right,
    yearsSpent: Math.round((c.life - Math.max(0, s.life)) * 10) / 10, uses: usesOf(s) - c.uses,
    ...keepsake(s, right),
    found: s.found - c.found, seconds: Math.round((s.t - c.t) / 6) / 10,
    ...(s.lies ? { lies: { found: z.found - z0.found, wrong: z.wrong - z0.wrong, shown: z.shown - z0.shown, later: z.later - z0.later, years: z.years - z0.years } } : {}),
  });
}
export function step(s) {
  if (s.status !== 'play' || s.open) return; // a puzzle is open: time stands still
  s.t++;
  s.life -= s.burn * DT;
  if (s.life <= 0) { fade(s); return; }
  if (s.anim) {
    const a = s.anim;
    a.k++;
    const k = Math.min(1, a.k / LEAP_TICKS);
    s.px = a.fx + (a.tx - a.fx) * k; s.py = a.fy + (a.ty - a.fy) * k;
    if (k >= 1) { s.anim = null; s.events.push({ type: 'land' }); }
    return;
  }
  if (s.path.length) {
    const next = s.path[0], tx = next.x + 0.5, ty = next.y + 0.5;
    const dx = tx - s.px, dy = ty - s.py, d = Math.hypot(dx, dy), v = SPEED * DT;
    if (Math.abs(dx) > 0.01) s.face = dx > 0 ? 1 : -1;
    if (d <= v) {
      s.px = tx; s.py = ty; s.path.shift(); s.tiles++;
      s.events.push({ type: 'step' });
      if (!s.path.length) s.target = null;
    } else { s.px += dx / d * v; s.py += dy / d * v; }
  }
  const t = tileOf(s);
  if (s.lies) for (const q of s.spots) if (q.snooze && (q.x !== t.x || q.y !== t.y)) q.snooze = false; // stepped off: it can open again
  if (dist(s, t.x, t.y) < 0.3) {
    const p = s.spots.find(q => q.x === t.x && q.y === t.y && !q.taken && q.open);
    if (p) reach(s, p);
  }
}

export function guess(s, i) {
  if (s.status !== 'play') return false;
  s.guessed = i; s.open = null;
  const right = i === s.answer;
  s.path = []; s.anim = null;
  if (right) s.right++;
  else s.life -= wrongCost(s);
  s.events.push({ type: 'guess', i, right, chapter: s.chapter, cost: right ? 0 : wrongCost(s) });
  if (s.life <= 0) { fade(s, right); return right; }
  record(s, right);
  if (s.chapter < CHAPTERS.length - 1) s.status = 'named';
  else {
    s.status = s.right === CHAPTERS.length ? 'remembered' : 'mistaken';
    s.score = score(s);
  }
  return right;
}
export const score = s => s.right * SELF_POINTS + Math.floor(Math.ceil(Math.max(0, s.life)) * 10 * s.right / CHAPTERS.length);
export const years = s => Math.max(0, Math.ceil(s.life));
