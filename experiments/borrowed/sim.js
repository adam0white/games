// Borrowed Time: the rules. Pure and seeded; no window, document, Math.random or Date, so bots.mjs runs it in Node.
//
// You have forgotten who you are. A run is one life told in three chapters: the child, the grown-up and the old one,
// each on its own island, all lit by one candle. In each chapter six faces could be you. Memories lie around the
// island; each one shows one thing about you (your hat, what you held, your pet, where you lived); the broken mirror
// shows two. Most are locked, and each lock needs an ability. Every use of an ability burns years off the candle, and
// the years left carry into the next chapter. Name all three selves before the candle goes out.
//
//   const s = newRun(seed)                 a run; the same seed gives the same islands, faces and answers
//   walkTo(s, x, y)                        walk to a tile (or as near as the island allows)
//   ready(s, id)                           true when ability id has something to act on here
//   use(s, id)                             spend its cost and act; with nothing to act on it does nothing and costs nothing
//   step(s)                                one tick of 1/60 s
//   guess(s, i)                            name face i; a wrong name costs WRONG years; ends the chapter (and after the
//                                          third, the run)
//   nextChapter(s)                         after a named chapter: build the next island
//   s.events                               what happened since the page last emptied it
//
// Tiles are 1 x 1; the player's position is in tile units, centre of tile (i, j) is (i + 0.5, j + 0.5).

export const DT = 1 / 60;
export const LIFE = 150; // years on the candle at the start of the run
export const BURN = 0.15; // years a second while you walk and look; frozen on the picture-choice screen, between chapters and on pause
export const WRONG = 15; // years a wrong name costs
export const SELF_POINTS = 100; // points for each self named right; each right name keeps one third of the 10-points-per-year bonus
export const SPEED = 3.2; // tiles a second
export const LEAP_TICKS = 32;
export const GLOW_R = 2.3; // the dark memory must be this close to light it
export const NEAR = 1.5; // push and rewind reach (tiles, centre to centre)

export const ABILITIES = [
  { id: 'glow', name: 'Light', cost: 10 },
  { id: 'push', name: 'Push', cost: 13 },
  { id: 'leap', name: 'Leap', cost: 16 },
  { id: 'rewind', name: 'Rewind', cost: 20 }, // the mirror shows two kinds of memory
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
];
// The three chapters. Each later one is harder in a way you can see:
//  - the child: no mirror, and any two faces differ in at least two kinds, so one memory often settles it;
//  - the grown-up: every lock, and two faces may differ in a single kind;
//  - the old one: no free memory (every clue costs years) and the candle burns faster.
// Each run deals the three islands to the three chapters in a random order, so the island shapes vary too.
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

// A run: the islands' order is drawn from the seed; each chapter is drawn from its own seed, so a chapter is the same
// whatever happened before it. opts.order forces the island order, opts.answers forces the answer of each chapter.
export function newRun(seed, opts = {}) {
  const r = rng(seed);
  const order = opts.order ?? shuffle(r, [0, 1, 2]);
  const s = {
    seed: seed >>> 0, order, opts: { answers: opts.answers ?? null }, chapter: 0, chapters: [],
    life: LIFE, t: 0, status: 'play', score: 0, right: 0,
    used: { glow: 0, push: 0, leap: 0, rewind: 0 }, spent: 0, found: 0, tiles: 0, events: [],
  };
  buildChapter(s, 0);
  return s;
}
export const chapterSeed = (seed, k) => (Math.imul((seed >>> 0) ^ 0x5bd1e995, 0x9e3779b1) + Math.imul(k + 1, 0x85ebca6b)) >>> 0;

function buildChapter(s, k) {
  const ch = CHAPTERS[k], r = rng(chapterSeed(s.seed, k));
  const tpl = s.order[k];
  const flip = r() < 0.5;
  const faces = makeFaces(r, ch.apart, ch.apart > 1 ? CHILD_GROUPS : GROUPS);
  let answer = pick(r, FACES);
  // Which kinds of memory sit where. The free memory by the start shows one kind at random. With a mirror: push, leap
  // and dark each guard one kind, and the mirror shows two, one of them the kind no other lock has. Without a mirror
  // (the child) push, leap and dark guard the three kinds the free memory does not show. Every kind can be found.
  const freeDim = pick(r, 4);
  const lockDims = shuffle(r, [0, 1, 2, 3]);
  const second = shuffle(r, [lockDims[0], lockDims[1], lockDims[2]])[0];
  const rest = lockDims.filter(d => d !== freeDim);
  const dimsOf = ch.drop === 'M'
    ? { free: [freeDim], push: [rest[0]], leap: [rest[1]], dark: [rest[2]] }
    : { free: [freeDim], push: [lockDims[0]], leap: [lockDims[1]], dark: [lockDims[2]], rewind: [lockDims[3], second].sort() };
  // In the old chapter Push also holds the kind otherwise exclusive to the mirror.
  // Light, Push and Leap now cover every kind, while Rewind remains a two-kind shortcut.
  if (ch.id === 'old') dimsOf.push = [lockDims[0], lockDims[3]].sort();
  if (s.opts.answers) answer = s.opts.answers[k];

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
        spots.push({ x, y, lock, dims: dimsOf[lock], taken: false, open: lock !== 'dark' && lock !== 'rewind' });
        if (lock === 'dark') dark[y * w + x] = 1;
        c = '.';
      }
      grid.push(c);
    }
  }
  Object.assign(s, {
    chapter: k, island: tpl, flip, w, h, grid, dark, lit, spots, pad, landing, burn: BURN * ch.burn,
    faces, answer, known: [null, null, null, null], guessed: -1, status: 'play',
    px: start.x + 0.5, py: start.y + 0.5, path: [], target: null, face: 1, anim: null, bridge: false,
    chapterStart: { life: s.life, t: s.t, spent: s.spent, found: s.found, uses: usesOf(s) },
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
  if (s.status !== 'play' || s.anim) return;
  const goal = { x: Math.max(0, Math.min(s.w - 1, Math.floor(x))), y: Math.max(0, Math.min(s.h - 1, Math.floor(y))) };
  // Start from the tile we are stepping onto, so a new target never makes us turn back mid-step.
  const from = s.path.length ? s.path[0] : tileOf(s);
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
  if (s.status !== 'play' || s.anim) return false;
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
    collect(s, p); // the memory shows in the mended mirror
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
function collect(s, p) {
  if (p.taken) return;
  p.taken = true; s.found++;
  const values = p.dims.map(d => s.faces[s.answer][d]);
  const fresh = p.dims.some(d => s.known[d] === null);
  p.dims.forEach((d, k) => { s.known[d] = values[k]; });
  s.events.push({ type: 'memory', dims: p.dims, values, lock: p.lock, fresh, x: p.x, y: p.y });
  if (p.lock === 'leap' && !s.bridge) {
    s.bridge = true;
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === '=') s.grid[i] = '_';
    s.events.push({ type: 'bridge' });
  }
}

// ---------------------------------------------------------------- the tick
function fade(s, right = null) {
  s.life = 0; s.status = 'faded'; s.path = []; s.anim = null;
  record(s, right);
  s.score = s.right * SELF_POINTS;
  s.events.push({ type: 'faded', chapter: s.chapter });
}
// What one chapter came to; the page and the lab read s.chapters.
function record(s, right) {
  const c = s.chapterStart;
  s.chapters.push({
    chapter: s.chapter, id: CHAPTERS[s.chapter].id, island: s.island, face: [...s.faces[s.answer]],
    guessed: s.guessed, named: s.guessed >= 0 ? [...s.faces[s.guessed]] : null, right,
    yearsSpent: Math.round((c.life - Math.max(0, s.life)) * 10) / 10, uses: usesOf(s) - c.uses,
    found: s.found - c.found, seconds: Math.round((s.t - c.t) / 6) / 10,
  });
}
export function step(s) {
  if (s.status !== 'play') return;
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
  if (dist(s, t.x, t.y) < 0.3) {
    const p = s.spots.find(q => q.x === t.x && q.y === t.y && !q.taken && q.open);
    if (p) collect(s, p);
  }
}

export function guess(s, i) {
  if (s.status !== 'play') return false;
  s.guessed = i;
  const right = i === s.answer;
  s.path = []; s.anim = null;
  if (right) s.right++;
  else s.life -= WRONG;
  s.events.push({ type: 'guess', i, right, chapter: s.chapter, cost: right ? 0 : WRONG });
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
