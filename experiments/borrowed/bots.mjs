// Proves the rules: node bots.mjs  (exits non-zero on any failure)
//  1. determinism: the same seed and the same inputs give the same run, event for event; ?lies=0 deals the same game;
//  2. the faces: in every chapter no single memory names anyone, and faces are as far apart as the chapter says;
//  3. the puzzles: exactly one picture of every puzzle lies about the answer; using only what a player knows, every
//     memory of every chapter can be decided in some order the island allows (a closure over all seeds and answers);
//     a puzzle made deliberately wrong is caught;
//  4. coverage: on many seeds, with every island order and every face forced as an answer, a careful bot names all
//     three selves with years to spare; again with a slow, hesitant "human" handicap; every ability is used on some
//     runs; every one of the 256 people and 16 roles turns up as an answer;
//  5. a bot that taps pictures at random, or always the first one, or pays every time, does clearly worse; a blind tap
//     when stuck does not beat paying;
//  6. a bot that opens every lock it meets dies or scores clearly worse than the careful bot;
//  7. a bot that names a face at once is right only at chance (1 in 6) in each chapter, whichever way it picks;
//  8. a bot that does nothing fades.
// It also reports spending and puzzle decisions a run, and run length in seconds.
// It drives the same newRun / walkTo / use / step / pickLie / showMe / later / guess / nextChapter the page ticks.
import {
  newRun, step, walkTo, use, ready, guess, nextChapter, consistent, tileOf, route, hamming, ABILITIES, COST, LOCK_ABILITY,
  LIFE, BURN, SPEED, FACES, WRONG, PICK, SHOW, CHAPTERS, roleId, score, solvePuzzle, liarFor, fits, pickLie, showMe, later, rng,
} from './sim.js';

const t0 = Date.now(), cpu0 = process.cpuUsage();
let failures = 0;
const fail = text => { failures++; console.log('FAIL ' + text); };
const check = (ok, text) => { if (!ok) fail(text); return ok; };
const MAX_TICKS = 60 * 60 * 15;
// Seconds a person is assumed to spend outside the island clock (it does not burn): each puzzle, and the face line-up.
// The "person" is the careful bot thinking 3 s before each choice; the slow bot walks at half speed and thinks 8 s.
const HUMAN = { person: { think: 3, puzzle: 8, lineup: 8 }, slow: { puzzle: 12, lineup: 10 } };

// ---------------------------------------------------------------- driving the sim
// opts.slow: walk at half speed (every other tick stands still); opts.think: seconds of standing still before each choice.
// opts.puzzle: how the bot answers a puzzle (see answer()). opts.want: the memory the bot set out for.
function ticks(s, n) { for (let i = 0; i < n && s.status === 'play' && !s.open; i++) step(s); }
function think(s, opts) {
  if (!opts.think) return;
  const path = s.path; s.path = [];
  ticks(s, Math.round(opts.think * 60));
  s.path = path;
}
function walk(s, x, y, opts, until = () => false) {
  for (let tries = 0; tries < 8 && s.status === 'play'; tries++) {
    walkTo(s, x, y);
    let guard = 0;
    while (s.status === 'play' && !s.open && (s.path.length || s.anim) && !until()) {
      if (opts.slow && guard % 2) { const p = s.path; s.path = []; step(s); s.path = p; } else step(s);
      if (++guard > MAX_TICKS) throw new Error('walk never ended');
    }
    if (!s.open) return;
    const done = s.open === opts.want;
    answer(s, opts);
    if (done || until()) return;
  }
}
// The bot's answer to the open puzzle.
//  careful  tap the lie when what it knows settles it; otherwise pay to be shown, but only for the memory it came for
//           (a memory passed on the way is left for later);
//  guess    like careful, but when stuck it taps one of the pictures that could lie, at random;
//  random   taps a picture at random until it finds the lie;  first  taps the first picture, then the next;
//  buyer    always pays to be shown;  spender  taps the lie when it can, else pays.
function answer(s, opts) {
  const p = s.open, z = p.puzzle, n = z.frags.length, policy = opts.puzzle || 'careful';
  const st = opts.stats;
  if (st) { st.opened++; if (p === opts.want && solvePuzzle(s.faces, s.known, z, s.exposed) < 0) st.stuck++; }
  const r = opts.r || (opts.r = rng(s.seed ^ 0x51ed));
  const tap = order => { for (const i of order) { if (s.open !== p || s.status !== 'play') return; if (!z.tried[i]) pickLie(s, i); } };
  if (policy === 'buyer') { showMe(s); return; }
  if (policy === 'random') { const o = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } tap(o); return; }
  if (policy === 'first') {
    tap(z.form === 'torn' ? [1, 0] : [0, 1]);
    return;
  }
  const l = solvePuzzle(s.faces, s.known, z, s.exposed);
  if (l >= 0) { pickLie(s, l); return; }
  if (policy === 'spender') { showMe(s); return; }
  if (p !== opts.want) { later(s); return; }
  if (policy === 'guess') {
    // the pictures some face still in the running says lie
    const could = [...new Set(consistent(s.faces, s.known).map(i => liarFor(s.faces[i], z.frags)).filter(i => i >= 0 && !z.tried[i]))];
    while (s.open === p && s.status === 'play') {
      const left = could.filter(i => !z.tried[i]);
      const i = left.length ? left[Math.floor(r() * left.length)] : z.frags.findIndex((_, k) => !z.tried[k]);
      pickLie(s, i);
    }
    return;
  }
  showMe(s);
}
// Fetch one memory: walk, use the ability its lock needs, walk on.
function fetch(s, spot, opts, greedy = false) {
  opts = { ...opts, want: spot };
  const lock = spot.lock;
  if (lock === 'push') {
    const b = boulderNear(s, spot);
    if (b) { walk(s, b.x, b.y, opts); if (s.status !== 'play') return; use(s, 'push'); }
  } else if (lock === 'leap' && !s.bridge) {
    const here = tileOf(s);
    if (!(here.x === s.landing.x && here.y === s.landing.y)) { walk(s, s.pad.x, s.pad.y, opts); if (s.status !== 'play') return; use(s, 'leap'); ticks(s, 40); }
  }
  if (s.status !== 'play') return;
  if (lock === 'rewind') { walk(s, spot.x, spot.y, opts, () => ready(s, 'rewind')); if (s.status === 'play' && !spot.taken) { use(s, 'rewind'); if (s.open) answer(s, opts); } }
  else if (lock === 'dark') { walk(s, spot.x, spot.y, opts); if (s.status === 'play' && !spot.open) use(s, 'glow'); ticks(s, 2); if (s.open) answer(s, opts); }
  else walk(s, spot.x, spot.y, opts, greedy ? () => greedyUse(s) : undefined);
  ticks(s, 1);
  if (s.open) answer(s, opts);
}
function boulderNear(s, spot) {
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const x = spot.x + dx, y = spot.y + dy;
    if (s.grid[y * s.w + x] === 'B') return { x, y };
  }
  return null;
}
// Uses every ability that opens something the moment it is ready (it does not leap back from the island).
const greedyUse = s => {
  for (const a of ABILITIES) {
    if (s.status !== 'play' || s.open) return false;
    if (a.id === 'leap' && s.spots.find(p => p.lock === 'leap').taken) continue;
    if (a.id === 'leap' && tileOf(s).x === s.landing.x && tileOf(s).y === s.landing.y) continue;
    if (ready(s, a.id)) use(s, a.id);
  }
  return !!s.open;
};

// The careful bot's plan: the next memory to fetch, chosen to keep the expected years spent smallest, counting
// the ability's cost, the walk there and, for a puzzle it could not yet settle, the price of being shown. It knows only
// what a player sees: the faces, the clues won, the pictures of each puzzle it has seen and the kinds each memory shows.
// It names a face only when one face is left. opts.hasty: plans as if every puzzle could be settled.
function walkYears(s, spot) {
  const goal = spot.lock === 'leap' ? s.pad : spot;
  return (route(s, tileOf(s), goal).length + 2) / SPEED * BURN;
}
function plan(s, opts = {}) {
  const open = s.spots.filter(p => !p.taken && !(opts.noRewind && s.chapter === 2 && p.lock === 'rewind'));
  const costs = new Map(open.map(p => {
    const ability = LOCK_ABILITY[p.lock];
    const unlocked = p.lock === 'push' ? !boulderNear(s, p)
      : p.lock === 'leap' ? s.bridge : p.open;
    return [p, (ability && !unlocked ? COST[ability] : 0) + walkYears(s, p)];
  }));
  const memo = new Map();
  function expect(known, left, choices = left) {
    const C = consistent(s.faces, known);
    if (C.length <= 1) return { cost: 0, spot: null };
    const key = known.join(',') + '|' + left.map(p => p.lock).join(',');
    if (memo.has(key)) return memo.get(key);
    let best = { cost: Infinity, spot: null };
    for (const p of choices) {
      if (p.dims.every(d => known[d] !== null)) continue;
      const counts = new Map();
      for (const i of C) { const key = p.dims.map(d => s.faces[i][d]).join(); counts.set(key, (counts.get(key) || 0) + 1); }
      let cost = costs.get(p);
      if (p.puzzle && !opts.hasty && solvePuzzle(s.faces, known, p.puzzle, s.exposed) < 0) cost += SHOW;
      for (const [key, n] of counts) {
        const k = [...known], vals = key.split(',').map(Number);
        p.dims.forEach((d, j) => { k[d] = vals[j]; });
        cost += n / C.length * expect(k, left.filter(q => q !== p)).cost;
      }
      if (cost < best.cost) best = { cost, spot: p };
    }
    if (choices === left) memo.set(key, best);
    return best;
  }
  if (opts.hasty || !s.lies) return expect([...s.known], open).spot;
  const solved = open.filter(p => solvePuzzle(s.faces, s.known, p.puzzle, s.exposed) >= 0);
  // Prefer a deduction first, while planning against all remaining memories.
  return expect([...s.known], open, solved).spot ?? expect([...s.known], open).spot;
}
// Plays every chapter with the same rule, chapter after chapter.
function chapters(s, one) {
  for (;;) {
    one(s);
    if (s.status !== 'named') return s;
    nextChapter(s);
  }
}
function careful(seed, opts = {}) {
  opts = { ...opts, stats: { opened: 0, stuck: 0 } };
  const s = chapters(newRun(seed, opts), s => {
    let guard = 0;
    while (s.status === 'play') {
      think(s, opts);
      const spot = plan(s, opts);
      if (!spot) break;
      fetch(s, spot, opts);
      if (++guard > 20) throw new Error('careful bot looped');
    }
    if (s.status === 'play') { think(s, opts); const C = consistent(s.faces, s.known); guess(s, C[0]); }
  });
  s.bot = opts.stats;
  return s;
}
// Like the careful bot, but names a face as soon as two are left: a coin flip against the cost of one more memory.
function gambler(seed, opts = {}) {
  return chapters(newRun(seed, opts), s => {
    let guard = 0;
    while (s.status === 'play' && consistent(s.faces, s.known).length > 2) {
      const spot = plan(s, opts);
      if (!spot) break;
      fetch(s, spot, opts);
      if (++guard > 20) throw new Error('gambler looped');
    }
    if (s.status === 'play') guess(s, consistent(s.faces, s.known)[0]);
  });
}
// Opens every lock it meets: fetches every memory, nearest first, and uses any ability the moment it is ready.
function spender(seed, opts = {}) {
  opts = { ...opts, puzzle: 'spender' };
  return chapters(newRun(seed, opts), s => {
    let guard = 0;
    while (s.status === 'play') {
      const left = s.spots.filter(p => !p.taken);
      if (!left.length) break;
      left.sort((a, b) => walkYears(s, a) - walkYears(s, b));
      fetch(s, left[0], opts, true);
      if (s.open) answer(s, opts);
      greedyUse(s);
      if (s.open) answer(s, opts);
      if (++guard > 40) throw new Error('spender looped');
    }
    if (s.status === 'play') guess(s, consistent(s.faces, s.known)[0]);
  });
}
// Guesses at once, by one of three rules that look only at the faces.
const typical = (faces, i) => faces.reduce((n, f, j) => n + (j === i ? 0 : 4 - hamming(f, faces[i])), 0);
const QUICK = {
  'first face': () => 0,
  'most typical face': faces => faces.map((_, i) => i).sort((a, b) => typical(faces, b) - typical(faces, a) || a - b)[0],
  'least typical face': faces => faces.map((_, i) => i).sort((a, b) => typical(faces, a) - typical(faces, b) || a - b)[0],
};
function quick(seed, rule) {
  // The same-deal check covers building without puzzles, which this bot never opens.
  return chapters(newRun(seed, { lies: false }), s => {
    s.lies = true;
    guess(s, QUICK[rule](s.faces));
    s.lies = false;
  });
}
// Takes the free memory by the start (when the chapter has one), then guesses among the faces that fit.
function peek(seed) {
  return chapters(newRun(seed), s => {
    const free = s.spots.find(p => p.lock === 'free');
    if (free) fetch(s, free, {});
    if (s.status === 'play') guess(s, consistent(s.faces, s.known)[0]);
  });
}
function idle(seed) { const s = newRun(seed); let n = 0; while (s.status === 'play' && n++ < MAX_TICKS * 2) step(s); return s; }

// ---------------------------------------------------------------- 1. determinism
const snapshot = s => JSON.stringify({ ...s, dark: [...s.dark], lit: [...s.lit], bot: undefined });
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
{
  const a = careful(4242), b = careful(4242);
  check(snapshot(a) === snapshot(b), 'careful bot run is deterministic (state and event log)');
  const c = spender(77), d = spender(77);
  check(snapshot(c) === snapshot(d), 'spender bot run is deterministic');
  check(snapshot(newRun(9)) === snapshot(newRun(9)), 'newRun is deterministic');
  check(snapshot(newRun(9)) !== snapshot(newRun(10)), 'different seeds differ');
  // ?lies=0: the same islands, faces, answers and locks as with lies, only the memories have no puzzles.
  let same = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const x = newRun(seed), y = newRun(seed, { lies: false });
    for (let k = 0; k < 3; k++) {
      if (k) { x.status = y.status = 'named'; nextChapter(x); nextChapter(y); }
      if (JSON.stringify([x.faces, x.answer, x.island, x.flip, x.spots.map(p => [p.x, p.y, p.lock])]) === JSON.stringify([y.faces, y.answer, y.island, y.flip, y.spots.map(p => [p.x, p.y, p.lock])])
        && y.spots.every(p => !p.puzzle)) same++;
    }
  }
  check(same === 900, `with and without lies a seed deals the same faces, answer and island (${same}/900 chapters)`);
}

// ---------------------------------------------------------------- 2. the faces
{
  let bad = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const s = newRun(seed);
    for (let k = 0; k < CHAPTERS.length; k++) {
      if (k) { s.status = 'named'; nextChapter(s); }
      const { faces } = s;
      for (let a = 0; a < FACES; a++) {
        for (let d = 0; d < 4; d++) if (faces.filter(f => f[d] === faces[a][d]).length < 2) bad++;
        for (let b = a + 1; b < FACES; b++) if (hamming(faces[a], faces[b]) < CHAPTERS[k].apart) bad++;
      }
      // every kind can be found
      const dims = new Set(s.spots.flatMap(p => p.dims));
      if (dims.size !== 4) bad++;
    }
  }
  check(bad === 0, `face rules hold in every chapter on 1000 seeds (${bad} breaks)`);
}

// Regression: a wrong name still leaves a reason to save years.
{
  for (const [lies, cost] of [[true, WRONG], [false, 15]]) {
    const one = newRun(7, { lies });
    guess(one, (one.answer + 1) % FACES);
    check(one.life === LIFE - cost, `a wrong name costs ${cost} years with puzzles ${lies ? 'on' : 'off'}`);
  }
  const s = newRun(7);
  guess(s, s.answer); nextChapter(s);
  guess(s, (s.answer + 1) % FACES); nextChapter(s);
  guess(s, s.answer);
  check(s.status === 'mistaken' && s.score > 200, 'two right names keep a share of the years bonus');
  const before = s.score;
  s.life -= 1;
  check(score(s) < before, 'saving a year increases score after a wrong name');
}
// Regression: all four kinds have a route that does not require Rewind in the old chapter.
{
  let missing = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const s = newRun(seed); s.status = 'named'; nextChapter(s); s.status = 'named'; nextChapter(s);
    if (new Set(s.spots.filter(p => p.lock !== 'rewind').flatMap(p => p.dims)).size !== 4) missing++;
  }
  check(missing === 0, `old chapter covers all four kinds without Rewind (${missing} missing)`);
}

// ---------------------------------------------------------------- 3. the puzzles
// The closure: start from nothing known; settle every puzzle that what is known decides; learn its kinds; repeat. Every
// lock can be reached from the start with its ability, so any order is one the island allows. Knowledge only grows,
// so if the closure settles every memory, a careful player can settle each one in that order.
function closure(s) {
  const a = s.faces[s.answer], known = [null, null, null, null], left = new Set(s.spots);
  const exposed = [];
  let rounds = 0;
  while (left.size) {
    const now = [...left].filter(p => solvePuzzle(s.faces, known, p.puzzle, exposed) === p.puzzle.liar);
    if (!now.length) return { ok: false, rounds, left: [...left].map(p => p.lock) };
    rounds++;
    for (const p of now) {
      left.delete(p);
      for (const d of p.dims) known[d] = a[d];
      const seal = p.puzzle.frags[p.puzzle.liar].seal;
      if (seal !== undefined) exposed.push(seal);
    }
  }
  return { ok: consistent(s.faces, known).length === 1, rounds };
}
const FORM_NAMES = { lie: 'compare pictures', torn: 'match the tear', signed: 'compare seals' };
const puzzleRows = {}, chainRows = CHAPTERS.map(() => ({})), needsRows = CHAPTERS.map(() => ({ n: 0, some: 0 }));
{
  let liarBad = 0, stuck = 0, chapters = 0, wrongWay = 0, formBad = 0, repeatBad = 0;
  const chapterForms = [['lie'], ['lie', 'torn'], ['lie', 'torn', 'signed']];
  for (let seed = 1; seed <= 400; seed++) for (let ans = 0; ans < FACES; ans++) {
    const s = newRun(seed, { answers: [ans, (ans + 1) % FACES, (ans + 3) % FACES] });
    for (let k = 0; k < CHAPTERS.length; k++) {
      if (k) { s.status = 'named'; nextChapter(s); }
      chapters++;
      const a = s.faces[s.answer], none = [null, null, null, null];
      for (const p of s.spots) {
        const z = p.puzzle, lies = z.frags.map(f => !fits(a, f));
        if (lies.filter(Boolean).length !== 1 || !lies[z.liar]) liarBad++;
        // a settled puzzle is always settled the right way (solveLie never names a true picture)
        const l = solvePuzzle(s.faces, none, z);
        if (l >= 0 && l !== z.liar) wrongWay++;
        const row = puzzleRows[`${CHAPTERS[k].name} ${p.lock}`] ??= { form: z.form, pictures: z.frags.length, n: 0, cold: 0 };
        row.n++; if (l === z.liar) row.cold++;
      }
      const forms = new Set(s.spots.map(p => p.puzzle.form));
      if (forms.size !== chapterForms[k].length || !chapterForms[k].every(form => forms.has(form))) formBad++;

      const lock = id => s.spots.find(p => p.lock === id).puzzle;
      if (k > 0) {
        const entry = lock(k === 1 ? 'free' : 'push');
        const parent = lock(k === 1 ? 'push' : 'leap');
        const dependent = lock('dark');
        const from = (known, puzzle) => solvePuzzle(s.faces, known, puzzle);
        const k0 = none.map((v, d) => entry.dims.includes(d) ? a[d] : v);
        const k1 = k0.map((v, d) => parent.dims.includes(d) ? a[d] : v);
        needsRows[k].n++;
        if (from(none, entry) === entry.liar && from(k0, parent) === parent.liar
            && from(none, dependent) === -1 && from(k0, dependent) === -1
            && from(k1, dependent) === dependent.liar
            && dependent.dims.some(d => k1[d] === null)) needsRows[k].some++;
        if (k === 2) {
          const seal = parent.frags[parent.liar].seal;
          if (seal === undefined || dependent.frags[dependent.liar].seal !== seal
              || parent.frags[1 - parent.liar].seal === dependent.frags[1 - dependent.liar].seal
              || from(k0, dependent) !== -1 || solvePuzzle(s.faces, k0, dependent, [seal]) !== dependent.liar) repeatBad++;
        }
      }
      const c = closure(s);
      if (!c.ok) stuck++;
      chainRows[k][c.rounds] = (chainRows[k][c.rounds] || 0) + 1;
    }
  }
  check(liarBad === 0, `exactly one picture of every puzzle lies about the answer (${liarBad} breaks)`);
  check(wrongWay === 0, `a puzzle settled from the faces is settled the right way (${wrongWay} breaks)`);
  check(stuck === 0, `every memory of every chapter can be decided without paying, 400 seeds x 6 answers (${stuck}/${chapters} chapters stuck)`);
  check(formBad === 0, `one new form per chapter (${formBad} breaks)`);
  check(repeatBad === 0, `the same false seal decides the second signed puzzle (${repeatBad} breaks)`);
  check(needsRows.slice(1).every(row => row.n === 2400 && row.some === row.n), 'every later chapter has an entry → parent → dependent chain');
  // Mutation: make the lie of one puzzle fit a face still in the running alongside the answer's; the closure must notice.
  let caught = 0, tried = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = newRun(seed);
    const p = s.spots.find(q => q.lock === 'free');
    const z = p.puzzle, lie = z.frags[z.liar], other = s.faces.find((f, i) => i !== s.answer && !fits(f, lie) && f.some((v, d) => v !== s.faces[s.answer][d] && lie.dims.includes(d)));
    if (!other) continue;
    tried++;
    lie.vals = lie.dims.map(d => other[d]); // now the "lie" is a true picture of another face
    const c = closure(s);
    if (!c.ok || solvePuzzle(s.faces, [null, null, null, null], z) !== z.liar) caught++;
  }
  check(tried > 100 && caught === tried, `a free-memory lie that fits another face is caught (${caught}/${tried})`);
}

// Exercise the actual walks and abilities in dependency order on every island order. Each
// chapter starts with a full candle here, so visiting every lock is independent of run budget.
let reached = 0;
for (const [i, order] of PERMS.entries()) {
  const s = newRun(i + 1, { order });
  const orders = [
    ['free', 'push', 'leap', 'dark'],
    ['free', 'push', 'dark', 'leap', 'rewind'],
    ['push', 'leap', 'dark', 'rewind'],
  ];
  for (const [k, locks] of orders.entries()) {
    for (const lock of locks) {
      const p = s.spots.find(spot => spot.lock === lock);
      fetch(s, p, {});
      if (p.taken) reached++;
    }
    check(s.puzzles.shown === 0 && s.puzzles.wrong === 0, `order ${order}, chapter ${k}: every reached memory solved by deduction`);
    guess(s, consistent(s.faces, s.known)[0]);
    s.life = LIFE;
    if (k < 2) nextChapter(s);
  }
}
check(reached === 78, `actual ability routes reach all 78 memories across the six island orders (${reached})`);

// A life is three different people: a chapter's answer never has the role of an earlier chapter's answer while one of
// its faces has a new role. The answer stays a function of the seed alone, spread evenly over the six places.
let repeats = 0, couldDiffer = 0, keptByRole = 0, rolePicks = 0;
const place = [0, 0, 0, 0, 0, 0];
for (let seed = 1; seed <= 3000; seed++) {
  const s = newRun(seed), roles = [];
  for (let k = 0; k < CHAPTERS.length; k++) {
    const role = roleId(s.faces[s.answer]), fresh = s.faces.map((f, i) => i).filter(i => !roles.includes(roleId(s.faces[i])));
    if (fresh.length) { couldDiffer++; if (roles.includes(role)) repeats++; }
    if (k) { rolePicks++; if (fresh.length && fresh.length < FACES && fresh.includes(s.answer)) keptByRole += 1 / fresh.length; else keptByRole += 1 / FACES; }
    place[s.answer]++;
    roles.push(role);
    if (k < 2) { s.status = 'named'; nextChapter(s); }
  }
}
check(repeats === 0, `no chapter repeats an earlier answer's role when it can differ (${repeats} of ${couldDiffer})`);
check(place.every(n => Math.abs(n / 9000 - 1 / FACES) < 0.02), `answers spread over the six places (${place.join(', ')})`);
const roleGuess = keptByRole / rolePicks;
// The old chapter has no free memory, so its Leap and dark memories opened first can nearly never be settled: the page
// shows the missing-clue cue there (finding of the 2026-11-24 audit). Push, the entry lock, can always be settled.
let oldStuck = 0, oldOpened = 0, pushStuck = 0;
for (let seed = 1; seed <= 600; seed++) {
  const s = newRun(seed); for (let k = 0; k < 2; k++) { s.status = 'named'; nextChapter(s); }
  for (const lock of ['leap', 'dark']) { oldOpened++; if (solvePuzzle(s.faces, s.known, s.spots.find(p => p.lock === lock).puzzle, []) < 0) oldStuck++; }
  if (solvePuzzle(s.faces, s.known, s.spots.find(p => p.lock === 'push').puzzle, []) < 0) pushStuck++;
}
check(oldStuck > 0.9 * oldOpened && pushStuck === 0, `old chapter: Leap and dark opened first mostly cannot be settled (${oldStuck}/${oldOpened}), Push always can (${pushStuck} stuck)`);
console.log(`old chapter, opened before anything else: Leap or dark cannot be settled ${oldStuck}/${oldOpened}, Push ${pushStuck}/600`);

// ---------------------------------------------------------------- 4. coverage: every face as an answer, every order
const SEEDS = 180;
const stats = (list, f) => { const v = list.map(f); return { min: Math.min(...v), mean: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v) }; };
const runs = [], slow = [], spend = [], noRewind = [], person = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const order = PERMS[seed % 6];
  for (let a = 0; a < FACES; a++) {
    const answers = [a, (a + 2) % FACES, (a + 4) % FACES];
    runs.push(careful(seed, { order, answers }));
    if (a % 2 === 0) noRewind.push(careful(seed, { order, answers, noRewind: true }));
    if (a % 2 === 1) slow.push(careful(seed, { order, answers, slow: true, think: 8 }));
    if (a === 3) person.push(careful(seed, { order, answers, think: HUMAN.person.think }));
  }
  spend.push(spender(seed, { order }));
}
check(noRewind.every(s => s.status === 'remembered'), `bot without old-chapter Rewind names all three selves (${noRewind.filter(s => s.status === 'remembered').length}/${noRewind.length})`);
const won = runs.filter(s => s.status === 'remembered').length, slowWon = slow.filter(s => s.status === 'remembered').length;
check(won === runs.length, `careful bot names all three selves on every run (${won}/${runs.length})`);
check(slowWon === slow.length, `slow, hesitant careful bot names all three selves on every run (${slowWon}/${slow.length})`);
const lieOf = (c, key) => (c.lies ? c.lies[key] : 0);
const rows = CHAPTERS.map((ch, k) => {
  const c = runs.map(s => s.chapters[k]), w = slow.map(s => s.chapters[k]), sp = spend.map(s => s.chapters[k]).filter(Boolean);
  const y = stats(c, x => x.yearsSpent);
  return {
    chapter: ch.name,
    'careful: years spent min/mean/max': `${y.min.toFixed(0)} / ${y.mean.toFixed(0)} / ${y.max.toFixed(0)}`,
    'careful: ability uses': stats(c, x => x.uses).mean.toFixed(2),
    'careful: puzzles won': stats(c, x => x.found).mean.toFixed(2),
    'careful: paid to be shown': stats(c, x => lieOf(x, 'shown')).mean.toFixed(2),
    'slow: seconds': stats(w, x => x.seconds).mean.toFixed(0),
    'spender: reached': `${(100 * sp.length / spend.length).toFixed(0)}%`,
    'spender: years spent': sp.length ? stats(sp, x => x.yearsSpent).mean.toFixed(0) : '-',
  };
});
const carefulMin = Math.min(...runs.map(s => s.life)), slowMin = Math.min(...slow.map(s => s.life));
check(carefulMin > 10, `careful bot always ends with more than 10 years (min ${carefulMin.toFixed(1)})`);
check(slowMin > 0, `slow careful bot always ends with some years (min ${slowMin.toFixed(1)})`);
// Run length in decisions: abilities used (spending), puzzles answered.
const uses = s => s.chapters.reduce((n, c) => n + c.uses, 0);
const puzzlesOf = s => s.puzzles.found + s.puzzles.shown;
const hist = {}, phist = {};
for (const s of runs) { hist[uses(s)] = (hist[uses(s)] || 0) + 1; phist[puzzlesOf(s)] = (phist[puzzlesOf(s)] || 0) + 1; }
const usesMean = stats(runs, uses).mean, puzzlesMean = stats(runs, puzzlesOf).mean;
check(usesMean >= 4 && usesMean <= 6, `careful bot makes 4 to 6 spending decisions a run on average (${usesMean.toFixed(2)})`);
check(puzzlesMean >= 5, `careful bot answers at least 5 puzzles a run on average (${puzzlesMean.toFixed(2)})`);
const shownShare = stats(runs, s => s.puzzles.shown).mean;
check(shownShare < 0.5, `careful bot pays to be shown less than once in two runs (${shownShare.toFixed(2)} a run)`);
check(runs.every(s => s.puzzles.wrong === 0), 'careful bot never taps a true picture');
// Seconds: the island clock, plus the assumed seconds a person spends on puzzles and line-ups (the clock stops there).
const human = (s, h) => s.t / 60 + puzzlesOf(s) * h.puzzle + s.chapters.length * h.lineup;
const slowSeconds = stats(slow, s => s.t / 60), slowHuman = stats(slow, s => human(s, HUMAN.slow)), carefulHuman = stats(person, s => human(s, HUMAN.person));
check(person.every(s => s.status === 'remembered'), `the careful "person" (3 s of thought before each choice) names all three on every run`);
// Target 2 to 4 minutes. The person estimate rests on assumed seconds, so the check brackets it: the careful person at
// about 2 minutes or more, the slow hesitant bot at 4 minutes or less.
check(carefulHuman.mean >= 100 && slowHuman.mean <= 240, `a careful person's run is about 2 to 4 minutes, slow bot ${slowHuman.mean.toFixed(0)} s (bot clock with ${HUMAN.person.think} s of thought a choice, + ${HUMAN.person.puzzle} s a puzzle + ${HUMAN.person.lineup} s a line-up: ${carefulHuman.mean.toFixed(0)} s)`);
check(slowSeconds.mean >= 90 && slowSeconds.mean <= 240, `slow careful run lasts 90 to 240 s of island clock on average (${slowSeconds.mean.toFixed(0)})`);
// Every ability is needed somewhere.
const usage = Object.fromEntries(ABILITIES.map(a => [a.id, runs.filter(s => s.used[a.id] > 0).length / runs.length]));
for (const a of ABILITIES) check(usage[a.id] > 0.05, `careful bot uses ${a.name} on more than 5% of runs (${(100 * usage[a.id]).toFixed(0)}%)`);
// How often the careful bot came to a memory it could not settle yet (it then pays, or leaves one it passed for later).
const stuckRate = stats(runs, s => s.bot.stuck).mean;
// Every person and role turns up as an answer in every chapter on unforced seeds.
for (let k = 0; k < CHAPTERS.length; k++) {
  const people = new Set(), roles = new Set();
  for (let seed = 1; seed <= 6000; seed++) {
    const s = newRun(seed, { lies: false });
    for (let j = 1; j <= k; j++) { s.status = 'named'; nextChapter(s); }
    const f = s.faces[s.answer]; people.add(f.join('')); roles.add(roleId(f));
  }
  check(people.size === 256 && roles.size === 16, `${CHAPTERS[k].name}: all 256 people and 16 roles are answers on seeds 1 to 6000 (${people.size}, ${roles.size})`);
}

// ---------------------------------------------------------------- 5. puzzle tappers
const carefulScore = stats(runs, s => s.score).mean;
const tapperRows = {};
const tappers = { random: 'taps at random', first: 'always taps the first picture', buyer: 'always pays to be shown' };
for (const [policy, label] of Object.entries(tappers)) {
  const list = [];
  for (let seed = 1; seed <= SEEDS; seed += 2) for (let a = 0; a < FACES; a += 2) list.push(careful(seed, { order: PERMS[seed % 6], answers: [a, (a + 2) % FACES, (a + 4) % FACES], puzzle: policy }));
  const sc = stats(list, s => s.score).mean;
  tapperRows[label] = {
    score: sc.toFixed(0), 'careful score': carefulScore.toFixed(0),
    'remembered': `${(100 * list.filter(s => s.status === 'remembered').length / list.length).toFixed(0)}%`,
    'faded': `${(100 * list.filter(s => s.status === 'faded').length / list.length).toFixed(0)}%`,
    'wrong taps a run': stats(list, s => s.puzzles.wrong).mean.toFixed(2),
    'years on puzzles a run': stats(list, s => s.puzzles.years).mean.toFixed(0),
    'taps that hit the lie': policy === 'buyer' ? '-' : `${(100 * stats(list, s => s.puzzles.found / Math.max(1, s.puzzles.found + s.puzzles.wrong)).mean).toFixed(0)}%`,
  };
  check(sc < carefulScore * 0.8, `a bot that ${label} scores clearly worse (${sc.toFixed(0)} against ${carefulScore.toFixed(0)})`);
}
// Stuck at a memory it cannot settle yet: tap one of the pictures that could lie, or pay. A hasty bot (plans as if every
// puzzle could be settled) meets this often; paying must do at least as well as a blind tap.
const hasty = { buy: [], guess: [] };
for (let seed = 1; seed <= SEEDS; seed++) for (let a = 0; a < FACES; a += 2) {
  const o = { order: PERMS[seed % 6], answers: [a, (a + 2) % FACES, (a + 4) % FACES], hasty: true };
  hasty.buy.push(careful(seed, { ...o, puzzle: 'careful' }));
  hasty.guess.push(careful(seed, { ...o, puzzle: 'guess' }));
}
const hb = stats(hasty.buy, s => s.life).mean, hg = stats(hasty.guess, s => s.life).mean;
const hbs = stats(hasty.buy, s => s.score).mean, hgs = stats(hasty.guess, s => s.score).mean;
check(hb >= hg, `when stuck, paying ${SHOW} leaves at least as many years as a blind tap (pay ${hb.toFixed(1)}, tap ${hg.toFixed(1)} years left)`);

// ---------------------------------------------------------------- 6. the spender
const spendScore = stats(spend, s => s.score).mean;
const spendFaded = spend.filter(s => s.status === 'faded').length / spend.length;
check(spendFaded > 0.5 || spendScore < carefulScore * 0.6, `the spender dies or scores clearly worse (faded ${(100 * spendFaded).toFixed(0)}%, score ${spendScore.toFixed(0)} against ${carefulScore.toFixed(0)})`);

// A wrong name costs years and the chapter; guessing between the last two must not beat paying for one more memory.
const gamble = [];
for (let seed = 1; seed <= SEEDS; seed++) for (let a = 0; a < FACES; a++) gamble.push(gambler(seed, { order: PERMS[seed % 6], answers: [a, (a + 2) % FACES, (a + 4) % FACES] }));
const gambleScore = stats(gamble, s => s.score).mean;
const gambleAll = gamble.filter(s => s.status === 'remembered').length / gamble.length;
check(gambleScore < carefulScore * 0.8 && gambleAll < 0.5, `guessing between the last two scores worse than paying and names all three less than half the time (${gambleScore.toFixed(0)} against ${carefulScore.toFixed(0)}, ${(100 * gambleAll).toFixed(0)}%)`);

// ---------------------------------------------------------------- 7. guessing at once
const N = 4000, quickRows = {}, quickScore = {}, quickOutcome = {};
for (const rule of Object.keys(QUICK)) {
  let right = 0, named = 0, sc = 0;
  const out = {};
  for (let seed = 1; seed <= N; seed++) {
    const s = quick(seed, rule);
    for (const c of s.chapters) { named++; if (c.right) right++; }
    sc += s.score; out[s.status] = (out[s.status] || 0) + 1;
  }
  const p = right / named, se = Math.sqrt((1 / FACES) * (1 - 1 / FACES) / named);
  quickRows[rule] = p; quickScore[rule] = sc / N; quickOutcome[rule] = out;
  check(Math.abs(p - 1 / FACES) < 3 * se, `guess at once by "${rule}": ${(100 * p).toFixed(1)}% of names right, within 3 standard errors of ${(100 / FACES).toFixed(1)}%`);
}
let peekRight = 0, peekNamed = 0, peekScore = 0;
for (let seed = 1; seed <= 2000; seed++) { const s = peek(seed); peekScore += s.score; for (const c of s.chapters) { peekNamed++; if (c.right) peekRight++; } }

// ---------------------------------------------------------------- 8. doing nothing
const still = idle(5);
check(still.status === 'faded', 'a bot that does nothing fades');

// ---------------------------------------------------------------- report
console.table(rows);
console.log('puzzles (400 seeds x 6 answers): the form of each memory, and how often it is settled without a prior clue');
console.table(Object.fromEntries(Object.entries(puzzleRows).map(([k, r]) => [k, { form: `${r.form} (${FORM_NAMES[r.form]})`, pictures: r.pictures, 'settled without prior clues': `${(100 * r.cold / r.n).toFixed(0)}%` }])));
console.log(`chapters with a clue that needs another clue first (not only the entry memory): ${CHAPTERS.slice(1).map((c, i) => `${c.name} ${needsRows[i + 1].some}/${needsRows[i + 1].n}`).join(', ')}`);
console.log(`rounds of the closure (memories settled in waves; more rounds = longer chains): ${CHAPTERS.map((c, k) => `${c.name} ${Object.entries(chainRows[k]).map(([r, n]) => `${r}: ${n}`).join(', ')}`).join('; ')}`);
console.table(tapperRows);
console.log(`hasty bot stuck at a memory: pays ${SHOW} -> ${hb.toFixed(1)} years left, score ${hbs.toFixed(0)}; taps a picture that could lie -> ${hg.toFixed(1)} years left, score ${hgs.toFixed(0)}`);
console.log(`bot without old-chapter Rewind: ${noRewind.filter(s => s.status === 'remembered').length}/${noRewind.length} remembered, minimum ${Math.min(...noRewind.map(s => s.life)).toFixed(1)} years left`);
console.log(`abilities: Light ${COST.glow}, Push ${COST.push}, Leap ${COST.leap}, Rewind ${COST.rewind} years; a wrong tap ${PICK}; Show me ${SHOW}; a wrong name ${WRONG}; candle ${LIFE} years, burning ${BURN} a second while you look (x${CHAPTERS[2].burn} when old), walk ${SPEED} tiles a second`);
console.log(`careful bot: ${runs.length} runs (every island order, every face forced), all three named on every run, years left min ${carefulMin.toFixed(1)}, mean ${stats(runs, s => s.life).mean.toFixed(1)}, score ${carefulScore.toFixed(0)}`);
console.log(`careful bot spending decisions a run: mean ${usesMean.toFixed(2)}; ${Object.entries(hist).map(([k, v]) => `${k}: ${(100 * v / runs.length).toFixed(0)}%`).join(', ')}`);
console.log(`careful bot puzzles a run: mean ${puzzlesMean.toFixed(2)}; ${Object.entries(phist).map(([k, v]) => `${k}: ${(100 * v / runs.length).toFixed(0)}%`).join(', ')}; came to a memory it could not settle yet ${stuckRate.toFixed(2)} times a run, paid to be shown ${shownShare.toFixed(2)} times a run, never tapped wrong`);
console.log(`careful bot: ${stats(runs, s => s.t / 60).mean.toFixed(0)} s of island clock (it never stops to think). Careful person (the bot thinking ${HUMAN.person.think} s before each choice): ${stats(person, s => s.t / 60).mean.toFixed(0)} s of island clock, years left min ${Math.min(...person.map(s => s.life)).toFixed(1)}; with ${HUMAN.person.puzzle} s a puzzle and ${HUMAN.person.lineup} s a line-up, a run is about ${carefulHuman.mean.toFixed(0)} s (min ${carefulHuman.min.toFixed(0)}, max ${carefulHuman.max.toFixed(0)})`);
console.log(`slow careful bot (half speed, 8 s still before every choice): ${slow.length} runs, all named, years left min ${slowMin.toFixed(1)}, mean ${stats(slow, s => s.life).mean.toFixed(1)}; ${slowSeconds.mean.toFixed(0)} s of island clock a run (min ${slowSeconds.min.toFixed(0)}, max ${slowSeconds.max.toFixed(0)}); with ${HUMAN.slow.puzzle} s a puzzle and ${HUMAN.slow.lineup} s a line-up, ${slowHuman.mean.toFixed(0)} s (max ${slowHuman.max.toFixed(0)})`);
console.log(`careful bot uses: ${ABILITIES.map(a => `${a.name} ${(100 * usage[a.id]).toFixed(0)}%`).join(', ')} of runs`);
console.log(`spender (opens every lock, taps the lie when it can, else pays): ${spend.length} runs, faded ${(100 * spendFaded).toFixed(0)}%, score ${spendScore.toFixed(0)} (careful ${carefulScore.toFixed(0)}), paid to be shown ${stats(spend, s => s.puzzles.shown).mean.toFixed(2)} times a run`);
console.log(`gambler (names a face when two are left): score ${gambleScore.toFixed(0)}, ${(100 * gamble.filter(s => s.status === 'remembered').length / gamble.length).toFixed(0)}% name all three, faded ${(100 * gamble.filter(s => s.status === 'faded').length / gamble.length).toFixed(0)}%`);
console.log(`guess at once: ${Object.entries(quickRows).map(([k, v]) => `${k} ${(100 * v).toFixed(1)}% right, score ${quickScore[k].toFixed(0)}, ${JSON.stringify(quickOutcome[k])}`).join('; ')} (chance ${(100 / FACES).toFixed(1)}%)`);
console.log(`free memory (if any), then guess among the faces that fit: right ${(100 * peekRight / peekNamed).toFixed(1)}% of names, score ${(peekScore / 2000).toFixed(0)}`);
console.log(`a guess at once that skips the faces of earlier roles (chapters 2 and 3): right ${(100 * roleGuess).toFixed(1)}% (chance ${(100 / FACES).toFixed(1)}%)`);
console.log(`do-nothing bot: ${still.status} after ${(still.t / 60).toFixed(0)} s`);
const cpu = process.cpuUsage(cpu0);
const cpuSeconds = (cpu.user + cpu.system) / 1e6;
check(cpuSeconds < 30, 'bots use less than 30 seconds of CPU time');
console.log(`${failures ? 'FAILED' : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s wall, ${cpuSeconds.toFixed(1)} s CPU`);
process.exit(failures ? 1 : 0);
