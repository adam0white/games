// The booth: Face Shift's ladder of sitters (2026-11-24). Pure rules: no clock, no page, no unseeded randomness.
// The classic four rounds stay in sim.js, unchanged.
//
// A face is seven numbers in [-1, 1]. Where the finger lands picks the part; the drag moves that part's number
// from where it was (relative travel, 85 px = 1). Parts open one rung at a time; a locked part's number stays 0.
//   w head width       head (anywhere that is not a part): horizontal travel
//   o open eyes, mouth head: vertical travel (down opens)
//   b brows            brow: up raises, down knits
//   m mouth corners    mouth: up smiles, down frowns
//   l eyelids          eyes: up opens wide, down closes
//   n nose             nose: down grows it, up shrinks it
//   e ears             ears: up pricks them tall, down makes them floppy
export const DT = 1 / 60;
export const PARAMS = Object.freeze(['w', 'o', 'b', 'm', 'l', 'n', 'e']);
export const PART_PARAM = Object.freeze({ brow: 'b', mouth: 'm', eyes: 'l', nose: 'n', ears: 'e' });
export const REACH = 85;
export const PHOTO_TIME = 0.65;
export const LEAVE_TIME = 0.8;
export const NEXT_TIME = 1.6;
export const MEMORY_TIME = 2.5;
export const LAUGH_TRAVEL = 7;
const EPSILON = 1e-9;

// Targets with a name. Numbers left out are 0.
export const FACES = Object.freeze({
  wide: { w: 0.75 }, long: { w: -0.7 },
  gasp: { o: 0.8 }, hush: { o: -0.75 },
  grin: { w: 0.6, o: 0.5 }, pinch: { w: -0.6, o: -0.6 }, yawn: { w: -0.45, o: 0.8 }, squash: { w: 0.8, o: -0.55 },
  surprised: { b: 0.85, o: 0.6 }, angry: { b: -0.85, w: 0.35, o: -0.3 },
  happy: { m: 0.85, o: 0.25 }, sour: { m: -0.8, w: -0.4, b: -0.4 },
  sleepy: { l: -0.85, o: -0.5, b: -0.25 }, startled: { l: 0.8, b: 0.75, o: 0.45 },
  clown: { n: 0.9, m: 0.8, w: 0.4 }, snooty: { n: -0.75, b: 0.55, l: -0.45, m: -0.3 },
  smug: { m: 0.55, l: -0.6, b: 0.4, w: 0.2 },
  cat: { e: 0.9, w: -0.3, n: -0.6, m: 0.35 }, dog: { e: -0.9, w: 0.4, o: 0.3, n: 0.5 },
  bunny: { e: 1, w: -0.5, l: 0.35, o: -0.3 }, pig: { n: 0.8, e: 0.4, w: 0.65, l: -0.3 },
  owl: { l: 0.9, b: 0.6, w: 0.3, n: -0.55, e: 0.45 }, mouse: { e: 0.3, w: -0.6, n: -0.4, o: 0.35 },
});

// One new thing per rung. `unlock` opens a part; `mod` changes what the eye or hand must do.
//   memory  the portrait shows for MEMORY_TIME, then turns face down
//   moving  the sitter's face drifts while you copy it
//   mirror  every drag moves the other way
//   spoon   the portrait is seen in a spoon: upside down and squashed
//   twins   two faces, two portraits; each drag works on the face it lands on
//   laugh   no portrait: pull faces until the sitter laughs
export const RUNGS = Object.freeze([
  { id: 'stretch', unlock: ['w'], pool: ['wide', 'long'] },
  { id: 'open', unlock: ['o'], pool: ['gasp', 'hush'] },
  { id: 'both', pool: ['grin', 'pinch', 'yawn', 'squash'] },
  { id: 'brow', unlock: ['b'], pool: ['surprised', 'angry'] },
  { id: 'mouth', unlock: ['m'], pool: ['happy', 'sour'] },
  { id: 'lids', unlock: ['l'], pool: ['sleepy', 'startled'] },
  { id: 'nose', unlock: ['n'], pool: ['clown', 'snooty'] },
  { id: 'ears', unlock: ['e'], pool: ['cat', 'dog', 'bunny'] },
  { id: 'memory', mod: 'memory', pool: 'all' },
  { id: 'moving', mod: 'moving', pool: 'all' },
  { id: 'mirror', mod: 'mirror', pool: 'all' },
  { id: 'spoon', mod: 'spoon', pool: 'all' },
  { id: 'twins', mod: 'twins', pool: 'simple' },
  { id: 'quick', count: 4, patience: 5.5, pool: 'simple' },
  { id: 'laugh', mod: 'laugh', count: 1, patience: 15, pool: [] },
].map((rung, i) => Object.freeze({
  count: 2, unlock: [], mod: null,
  tol: +(0.3 - i * 0.011).toFixed(3), hold: +(0.45 + i * 0.01).toFixed(2), patience: +(12 - i * 0.2).toFixed(2),
  ...rung,
})));
export const DAILY_MODS = Object.freeze([null, 'memory', 'moving', 'spoon', 'mirror']);

const clamp1 = n => Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0));
export const neutral = () => ({ w: 0, o: 0, b: 0, m: 0, l: 0, n: 0, e: 0 });
const full = p => ({ ...neutral(), ...p });

export function randomGenerator(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let n = Math.imul(value ^ (value >>> 15), value | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

// The UTC day as a seed: the same five sitters for everyone that day.
export function daySeed(day) {
  let seed = 2166136261;
  for (const c of String(day)) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  return seed >>> 0;
}

export function unlockedAt(rungs, ri) {
  const open = new Set();
  for (let i = 0; i <= ri && i < rungs.length; i++) for (const p of rungs[i].unlock) open.add(p);
  return open;
}

function poolFor(rung, open) {
  if (Array.isArray(rung.pool)) return rung.pool;
  const fits = Object.keys(FACES).filter(name => Object.keys(FACES[name]).every(k => open.has(k)));
  return rung.pool === 'simple' ? fits.filter(name => Object.keys(FACES[name]).length <= 2) : fits;
}

function makeTarget(name, random, open) {
  const p = neutral();
  for (const [k, v] of Object.entries(FACES[name])) if (open.has(k)) p[k] = clamp1(Math.max(-0.95, Math.min(0.95, v + (random() - 0.5) * 0.2)));
  return p;
}

function targetsFor(rung, open, random) {
  const pool = poolFor(rung, open);
  const out = [];
  let last = null;
  for (let i = 0; i < rung.count; i++) {
    if (rung.mod === 'laugh') { out.push({ name: 'laugh', mod: 'laugh', p: neutral() }); continue; }
    let name = pool[Math.floor(random() * pool.length)];
    if (pool.length > 1 && name === last) name = pool[(pool.indexOf(name) + 1) % pool.length];
    last = name;
    const target = { name, mod: rung.mod, p: makeTarget(name, random, open), phase: random() * Math.PI * 2 };
    if (rung.mod === 'twins') {
      let other = pool[Math.floor(random() * pool.length)];
      if (other === name && pool.length > 1) other = pool[(pool.indexOf(other) + 1) % pool.length];
      target.name2 = other; target.p2 = makeTarget(other, random, open);
    }
    out.push(target);
  }
  return out;
}

export function dailyRungs(day) {
  const random = randomGenerator(daySeed(day) ^ 0x51f15e);
  const names = Object.keys(FACES).filter(n => Object.keys(FACES[n]).length >= 2);
  const order = DAILY_MODS.map(() => names[Math.floor(random() * names.length)]);
  return [Object.freeze({ id: 'daily', unlock: [...PARAMS], mod: null, pool: order, count: DAILY_MODS.length,
    tol: 0.22, hold: 0.55, patience: 12, mods: DAILY_MODS })];
}

function enterRung(state) {
  const rung = state.rungs[state.ri];
  const open = unlockedAt(state.rungs, state.ri);
  const random = randomGenerator((state.seed + Math.imul(state.ri + 1, 0x9e3779b1)) >>> 0);
  let targets;
  if (rung.id === 'daily') {
    targets = rung.pool.map((name, i) => ({ name, mod: rung.mods[i], p: makeTarget(name, random, open), phase: random() * Math.PI * 2 }));
  } else targets = targetsFor(rung, open, random);
  return { ...state, rung, open: [...open], targets, index: 0, faces: rung.mod === 'twins' ? [neutral(), neutral()] : [neutral()],
    grab: null, phase: 'play', age: 0, held: 0, qsum: 0, phaseTime: 0, laugh: 0, rungScore: 0, rungPhotos: 0 };
}

// mode 'booth' climbs RUNGS from `from`; mode 'daily' plays the day's five sitters.
// wait: the first sitter waits for the first touch (the page's cold open): no clock, no patience until then.
export function createBooth({ seed = 1, mode = 'booth', day = '2026-01-01', from = 0, mutate = null, wait = false } = {}) {
  const rungs = mode === 'daily' ? dailyRungs(day) : RUNGS;
  const base = {
    mode, day: mode === 'daily' ? day : null, seed: (mode === 'daily' ? daySeed(day) : Number(seed)) >>> 0, rungs, ri: Math.max(0, Math.min(rungs.length - 1, from | 0)),
    score: 0, streak: 0, bestStreak: 0, shots: [], missed: 0, results: [], elapsed: 0,
    ...(mutate ? { mutate } : {}), ...(wait ? { wait: true } : {}),
  };
  return enterRung(base);
}

// The target the sitter is showing now (a drifting face moves with the pose's age).
export function targetNow(state, which = 0) {
  const t = state.targets[Math.min(state.index, state.targets.length - 1)];
  const p = which === 1 ? t.p2 : t.p;
  if (t.mod !== 'moving') return p;
  const out = { ...p };
  const keys = PARAMS.filter(k => p[k] !== 0).slice(0, 2);
  keys.forEach((k, i) => { out[k] = clamp1(p[k] + 0.22 * Math.sin(state.age * Math.PI * 2 / 5 + t.phase + i * 2.1)); });
  return out;
}

export function portraitVisible(state) {
  const t = state.targets[Math.min(state.index, state.targets.length - 1)];
  return t.mod !== 'memory' || state.age < MEMORY_TIME;
}

export function errorOf(state) {
  const t = state.targets[Math.min(state.index, state.targets.length - 1)];
  let err = 0;
  state.faces.forEach((face, i) => { const goal = targetNow(state, i); for (const k of PARAMS) err = Math.max(err, Math.abs(face[k] - goal[k])); });
  return t.mod === 'laugh' ? 1 : err;
}

export function tolOf(state) {
  const t = state.targets[Math.min(state.index, state.targets.length - 1)];
  return state.rung.tol + (t.mod === 'moving' ? 0.03 : 0);
}

// 1 at a perfect copy, 2/3 at the edge of a match, 0 far off. The page draws this as the likeness meter.
export function likeness(state) {
  if (state.targets[state.index]?.mod === 'laugh') return Math.min(1, state.laugh);
  return Math.max(0, Math.min(1, 1 - errorOf(state) / (3 * tolOf(state))));
}

// Which part a finger lands on. x and y are in the face's own frame: the unstretched head is about 100 across
// from the centre to the cheek, nose at (0, 11), eyes at (+-32, -19), mouth at (0, 43). Locked parts are head.
// Where the game points when a number is furthest off: [x, y, drag axis] in face units. Head numbers point at the
// cheek, because the centre and the chin belong to the nose and the mouth once those open.
export const CUE_SPOT = { w: [-66, 18, 'x'], o: [66, 18, 'y'], b: [0, -52, '-y'], m: [0, 46, '-y'], l: [-32, -19, '-y'], n: [0, 11, 'y'], e: [-78, -92, '-y'] };

export function partAt(x, y, open) {
  const has = p => open.includes ? open.includes(p) : open.has(p);
  const ax = Math.abs(x);
  let part = 'head';
  if (y < -58 && ax > 52 && ax < 125 && y > -150) part = 'ears';
  else if (y >= -66 && y < -37 && ax <= 58) part = 'brow';
  else if (y >= -37 && y < -3 && ax >= 12 && ax <= 56) part = 'eyes';
  else if (ax < 16 && y >= -3 && y < 25) part = 'nose';
  else if (y >= 25 && y < 72 && ax < 48) part = 'mouth';
  if (part !== 'head' && !has(PART_PARAM[part])) part = 'head';
  return part;
}

function applyGrab(from, part, dx, dy) {
  const p = { ...from };
  if (part === 'head') { p.w = from.w + dx; p.o = from.o + dy; }
  else if (part === 'nose') p.n = from.n + dy;
  else p[PART_PARAM[part]] = from[PART_PARAM[part]] - dy;
  return p;
}

function lockAndClamp(p, open) {
  const out = {};
  for (const k of PARAMS) out[k] = open.includes(k) ? clamp1(p[k]) : 0;
  return out;
}

function nextSitter(state) {
  const next = { ...state, held: 0, qsum: 0, age: 0, phaseTime: 0, laugh: 0, faces: state.faces.map(neutral) };
  // A finger still down keeps working from the fresh face.
  if (next.grab) next.grab = { ...next.grab, rebase: true };
  if (state.index + 1 < state.targets.length) return { ...next, index: state.index + 1, phase: 'play' };
  const result = { rung: state.rung.id, photos: state.rungPhotos, of: state.targets.length, score: state.rungScore };
  return { ...next, phase: 'next', results: [...state.results, result] };
}

// input: { active, part, face, dx, dy }. dx and dy are finger travel since touch-down, in units of REACH.
export function stepBooth(state, input = {}, dt = DT) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and nonnegative');
  if (state.phase === 'done') return state;
  let next = { ...state };
  const dx = clamp3(input.dx), dy = clamp3(input.dy);
  if (state.phase === 'photo' || state.phase === 'leave') {
    next.phaseTime += dt;
    if (!input.active) next.grab = null;
    if (next.phaseTime + EPSILON >= (state.phase === 'photo' ? PHOTO_TIME : LEAVE_TIME)) next = nextSitter(next);
    return next;
  }
  if (state.phase === 'next') {
    next.phaseTime += dt;
    if (!input.active) next.grab = null;
    if (next.phaseTime + EPSILON >= NEXT_TIME) {
      if (state.ri + 1 >= state.rungs.length) return { ...next, phase: 'done' };
      next = enterRung({ ...next, ri: state.ri + 1 });
      if (input.active && state.grab) next.grab = { ...state.grab, rebase: true };
    }
    return next;
  }

  // Play: move the grabbed part. A waiting booth stands still until the first touch, then never waits again.
  if (state.wait) { if (!input.active) return state; next.wait = false; }
  const mirror = state.targets[state.index].mod === 'mirror' ? -1 : 1;
  if (input.active) {
    let grab = state.grab;
    const faceIndex = Math.max(0, Math.min(state.faces.length - 1, input.face | 0));
    if (!grab) {
      const part = state.mutate === 'part' || !(part0 => part0 === 'head' || state.open.includes(PART_PARAM[part0]))(input.part) ? 'head' : input.part;
      // Travel counts from touch-down, so a quick first flick is not lost between ticks.
      grab = { part, face: faceIndex, from: { ...state.faces[faceIndex] }, dx: 0, dy: 0 };
    } else if (grab.rebase) {
      const face = Math.min(grab.face, state.faces.length - 1);
      grab = { ...grab, face, rebase: false, from: { ...state.faces[face] }, dx, dy };
    }
    next.grab = grab;
    const moved = lockAndClamp(applyGrab(grab.from, grab.part, (dx - grab.dx) * mirror, (dy - grab.dy) * mirror), state.open);
    const before = state.faces[grab.face];
    let travel = 0;
    for (const k of PARAMS) travel += Math.abs(moved[k] - before[k]);
    next.laugh = state.laugh + Math.min(travel, 0.12) / LAUGH_TRAVEL;
    next.faces = state.faces.map((f, i) => i === grab.face ? moved : f);
  } else next.grab = null;

  next.age += dt;
  next.elapsed += dt;
  const target = state.targets[state.index];
  if (target.mod === 'laugh') {
    if (next.laugh >= 1) return snap(next, 1);
  } else {
    const err = errorOf(next), tol = tolOf(next);
    if (err <= tol + EPSILON) { next.held += dt; next.qsum += (1 - err / tol) * dt; } else { next.held = 0; next.qsum = 0; }
    if (next.held + EPSILON >= state.rung.hold) return snap(next, next.held > 0 ? next.qsum / next.held : 0);
  }
  if (next.age + EPSILON >= state.rung.patience) {
    return { ...next, phase: 'leave', phaseTime: 0, held: 0, streak: 0, missed: state.missed + 1,
      shots: [...state.shots, { rung: state.rung.id, index: state.index, missed: true, faces: next.faces.map(f => ({ ...f })) }] };
  }
  return next;
}

const clamp3 = n => Math.max(-3, Math.min(3, Number.isFinite(n) ? n : 0));

// Points: likeness while holding (up to 40), speed against the sitter's patience (up to 20), 40 for the photo,
// all times the streak (x1, x1.25 ... x2 from four quick photos in a row).
export function pointsFor(quality, age, patience, streak) {
  const speed = Math.max(0, Math.min(1, 1 - age / patience));
  return Math.round((40 + 40 * Math.max(0, Math.min(1, quality)) + 20 * speed) * (1 + 0.25 * Math.min(streak, 4)));
}

function snap(state, quality) {
  const points = pointsFor(quality, state.age, state.rung.patience, state.streak);
  const quick = state.age < state.rung.patience * 0.6;
  const streak = quick ? state.streak + 1 : 0;
  const t = state.targets[state.index];
  const shot = { rung: state.rung.id, index: state.index, name: t.name, mod: t.mod, points, quality: +quality.toFixed(3), age: +state.age.toFixed(3),
    faces: state.faces.map(f => ({ ...f })), target: { ...t.p }, ...(t.p2 ? { target2: { ...t.p2 } } : {}) };
  return { ...state, phase: 'photo', phaseTime: 0, score: state.score + points, rungScore: state.rungScore + points, rungPhotos: state.rungPhotos + 1,
    streak, bestStreak: Math.max(state.bestStreak, streak), shots: [...state.shots, shot] };
}
