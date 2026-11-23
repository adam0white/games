// Proves the rules: node bots.mjs  (exits non-zero on any failure)
//  1. determinism: the same seed and the same inputs give the same run, event for event;
//  2. the faces: in every chapter no single memory names anyone, and faces are as far apart as the chapter says;
//  3. coverage: on many seeds, with every island order and every face forced as an answer, a careful bot names all
//     three selves with years to spare; again with a slow, hesitant "human" handicap; every ability is used on some
//     runs; every one of the 256 people and 16 roles turns up as an answer;
//  4. a bot that opens every lock it meets dies or scores clearly worse than the careful bot;
//  5. a bot that names a face at once is right only at chance (1 in 6) in each chapter, whichever way it picks;
//  6. a bot that does nothing fades.
// It also reports run length in spending decisions (ability uses) and seconds.
// It drives the same newRun / walkTo / use / step / guess / nextChapter the page ticks.
import {
  newRun, step, walkTo, use, ready, guess, nextChapter, consistent, tileOf, route, hamming, ABILITIES, COST, LOCK_ABILITY,
  LIFE, BURN, SPEED, FACES, WRONG, CHAPTERS, roleId,
} from './sim.js';

const t0 = Date.now();
let failures = 0;
const fail = text => { failures++; console.log('FAIL ' + text); };
const check = (ok, text) => { if (!ok) fail(text); return ok; };
const MAX_TICKS = 60 * 60 * 15;

// ---------------------------------------------------------------- driving the sim
// opts.slow: walk at half speed (every other tick stands still); opts.think: seconds of standing still before each choice.
function ticks(s, n) { for (let i = 0; i < n && s.status === 'play'; i++) step(s); }
function think(s, opts) {
  if (!opts.think) return;
  const path = s.path; s.path = [];
  ticks(s, Math.round(opts.think * 60));
  s.path = path;
}
function walk(s, x, y, opts, until = () => false) {
  walkTo(s, x, y);
  let guard = 0;
  while (s.status === 'play' && (s.path.length || s.anim) && !until()) {
    if (opts.slow && guard % 2) { const p = s.path; s.path = []; step(s); s.path = p; } else step(s);
    if (++guard > MAX_TICKS) throw new Error('walk never ended');
  }
}
// Fetch one memory: walk, use the ability its lock needs, walk on.
function fetch(s, spot, opts, greedy = false) {
  const lock = spot.lock;
  if (lock === 'push') {
    const b = boulderNear(s, spot);
    if (b) { walk(s, b.x, b.y, opts); use(s, 'push'); }
  } else if (lock === 'leap' && !s.bridge) {
    const here = tileOf(s);
    if (!(here.x === s.landing.x && here.y === s.landing.y)) { walk(s, s.pad.x, s.pad.y, opts); use(s, 'leap'); ticks(s, 40); }
  }
  if (lock === 'rewind') { walk(s, spot.x, spot.y, opts, () => ready(s, 'rewind')); use(s, 'rewind'); }
  else if (lock === 'dark') { walk(s, spot.x, spot.y, opts); use(s, 'glow'); ticks(s, 2); }
  else walk(s, spot.x, spot.y, opts, greedy ? () => greedyUse(s) : undefined);
  ticks(s, 1);
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
    if (s.status !== 'play') return false;
    if (a.id === 'leap' && s.spots.find(p => p.lock === 'leap').taken) continue;
    if (a.id === 'leap' && tileOf(s).x === s.landing.x && tileOf(s).y === s.landing.y) continue;
    if (ready(s, a.id)) use(s, a.id);
  }
  return false;
};

// The careful bot's plan: the next memory to fetch, chosen to keep the expected years spent smallest, counting
// the ability's cost and the walk there. It knows only what a player sees: the faces, the found memories, and the
// kind of memory each lock guards (its frame). It names a face only when one face is left.
function walkYears(s, spot) {
  const goal = spot.lock === 'leap' ? s.pad : spot;
  return (route(s, tileOf(s), goal).length + 2) / SPEED * BURN;
}
function plan(s) {
  const open = s.spots.filter(p => !p.taken);
  const costOf = p => (LOCK_ABILITY[p.lock] ? COST[LOCK_ABILITY[p.lock]] : 0) + walkYears(s, p);
  const memo = new Map();
  function expect(known, left) {
    const C = consistent(s.faces, known);
    if (C.length <= 1) return { cost: 0, spot: null };
    const key = known.join(',') + '|' + left.map(p => p.lock).join(',');
    if (memo.has(key)) return memo.get(key);
    let best = { cost: Infinity, spot: null };
    for (const p of left) {
      if (p.dims.every(d => known[d] !== null)) continue;
      const counts = new Map();
      for (const i of C) { const key = p.dims.map(d => s.faces[i][d]).join(); counts.set(key, (counts.get(key) || 0) + 1); }
      let cost = costOf(p);
      for (const [key, n] of counts) {
        const k = [...known], vals = key.split(',').map(Number);
        p.dims.forEach((d, j) => { k[d] = vals[j]; });
        cost += n / C.length * expect(k, left.filter(q => q !== p)).cost;
      }
      if (cost < best.cost) best = { cost, spot: p };
    }
    memo.set(key, best);
    return best;
  }
  return expect([...s.known], open).spot;
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
  return chapters(newRun(seed, opts), s => {
    let guard = 0;
    while (s.status === 'play') {
      think(s, opts);
      const spot = plan(s);
      if (!spot) break;
      fetch(s, spot, opts);
      if (++guard > 20) throw new Error('careful bot looped');
    }
    if (s.status === 'play') { think(s, opts); const C = consistent(s.faces, s.known); guess(s, C[0]); }
  });
}
// Like the careful bot, but names a face as soon as two are left: a coin flip against the cost of one more memory.
function gambler(seed, opts = {}) {
  return chapters(newRun(seed, opts), s => {
    let guard = 0;
    while (s.status === 'play' && consistent(s.faces, s.known).length > 2) {
      const spot = plan(s);
      if (!spot) break;
      fetch(s, spot, opts);
      if (++guard > 20) throw new Error('gambler looped');
    }
    if (s.status === 'play') guess(s, consistent(s.faces, s.known)[0]);
  });
}
// Opens every lock it meets: fetches every memory, nearest first, and uses any ability the moment it is ready.
function spender(seed, opts = {}) {
  return chapters(newRun(seed, opts), s => {
    while (s.status === 'play') {
      const left = s.spots.filter(p => !p.taken);
      if (!left.length) break;
      left.sort((a, b) => walkYears(s, a) - walkYears(s, b));
      fetch(s, left[0], opts, true);
      greedyUse(s);
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
function quick(seed, rule) { return chapters(newRun(seed), s => guess(s, QUICK[rule](s.faces))); }
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
const snapshot = s => JSON.stringify({ ...s, dark: [...s.dark], lit: [...s.lit] });
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
{
  const a = careful(4242), b = careful(4242);
  check(snapshot(a) === snapshot(b), 'careful bot run is deterministic (state and event log)');
  const c = spender(77), d = spender(77);
  check(snapshot(c) === snapshot(d), 'spender bot run is deterministic');
  check(snapshot(newRun(9)) === snapshot(newRun(9)), 'newRun is deterministic');
  check(snapshot(newRun(9)) !== snapshot(newRun(10)), 'different seeds differ');
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

// ---------------------------------------------------------------- 3. coverage: every face as an answer, every order
const SEEDS = 240;
const stats = (list, f) => { const v = list.map(f); return { min: Math.min(...v), mean: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v) }; };
const runs = [], slow = [], spend = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const order = PERMS[seed % 6];
  for (let a = 0; a < FACES; a++) {
    const answers = [a, (a + 2) % FACES, (a + 4) % FACES];
    runs.push(careful(seed, { order, answers }));
    if (a % 2 === 0) slow.push(careful(seed, { order, answers, slow: true, think: 8 }));
  }
  spend.push(spender(seed, { order }));
}
const won = runs.filter(s => s.status === 'remembered').length, slowWon = slow.filter(s => s.status === 'remembered').length;
check(won === runs.length, `careful bot names all three selves on every run (${won}/${runs.length})`);
check(slowWon === slow.length, `slow, hesitant careful bot names all three selves on every run (${slowWon}/${slow.length})`);
const rows = CHAPTERS.map((ch, k) => {
  const c = runs.map(s => s.chapters[k]), w = slow.map(s => s.chapters[k]), sp = spend.map(s => s.chapters[k]).filter(Boolean);
  const y = stats(c, x => x.yearsSpent);
  return {
    chapter: ch.name,
    'careful: years spent min/mean/max': `${y.min.toFixed(0)} / ${y.mean.toFixed(0)} / ${y.max.toFixed(0)}`,
    'careful: ability uses': stats(c, x => x.uses).mean.toFixed(2),
    'careful: memories': stats(c, x => x.found).mean.toFixed(2),
    'slow: seconds': stats(w, x => x.seconds).mean.toFixed(0),
    'spender: reached': `${(100 * sp.length / spend.length).toFixed(0)}%`,
    'spender: years spent': sp.length ? stats(sp, x => x.yearsSpent).mean.toFixed(0) : '-',
  };
});
const carefulMin = Math.min(...runs.map(s => s.life)), slowMin = Math.min(...slow.map(s => s.life));
check(carefulMin > 10, `careful bot always ends with more than 10 years (min ${carefulMin.toFixed(1)})`);
check(slowMin > 0, `slow careful bot always ends with some years (min ${slowMin.toFixed(1)})`);
// Run length in spending decisions.
const uses = s => s.chapters.reduce((n, c) => n + c.uses, 0);
const hist = {};
for (const s of runs) hist[uses(s)] = (hist[uses(s)] || 0) + 1;
const usesMean = stats(runs, uses).mean;
check(usesMean >= 4 && usesMean <= 6, `careful bot makes 4 to 6 spending decisions a run on average (${usesMean.toFixed(2)})`);
const slowSeconds = stats(slow, s => s.t / 60);
check(slowSeconds.mean >= 90 && slowSeconds.mean <= 180, `slow careful run lasts 90 to 180 s of play on average (${slowSeconds.mean.toFixed(0)})`);
// Every ability is needed somewhere.
const usage = Object.fromEntries(ABILITIES.map(a => [a.id, runs.filter(s => s.used[a.id] > 0).length / runs.length]));
for (const a of ABILITIES) check(usage[a.id] > 0.05, `careful bot uses ${a.name} on more than 5% of runs (${(100 * usage[a.id]).toFixed(0)}%)`);
// Every person and role turns up as an answer in every chapter on unforced seeds.
for (let k = 0; k < CHAPTERS.length; k++) {
  const people = new Set(), roles = new Set();
  for (let seed = 1; seed <= 6000; seed++) {
    const s = newRun(seed);
    for (let j = 1; j <= k; j++) { s.status = 'named'; nextChapter(s); }
    const f = s.faces[s.answer]; people.add(f.join('')); roles.add(roleId(f));
  }
  check(people.size === 256 && roles.size === 16, `${CHAPTERS[k].name}: all 256 people and 16 roles are answers on seeds 1 to 6000 (${people.size}, ${roles.size})`);
}

// ---------------------------------------------------------------- 4. the spender
const carefulScore = stats(runs, s => s.score).mean, spendScore = stats(spend, s => s.score).mean;
const spendFaded = spend.filter(s => s.status === 'faded').length / spend.length;
check(spendFaded > 0.5 || spendScore < carefulScore * 0.6, `the spender dies or scores clearly worse (faded ${(100 * spendFaded).toFixed(0)}%, score ${spendScore.toFixed(0)} against ${carefulScore.toFixed(0)})`);

// A wrong name costs years and the chapter; guessing between the last two must not beat paying for one more memory.
const gamble = [];
for (let seed = 1; seed <= SEEDS; seed++) for (let a = 0; a < FACES; a++) gamble.push(gambler(seed, { order: PERMS[seed % 6], answers: [a, (a + 2) % FACES, (a + 4) % FACES] }));
const gambleScore = stats(gamble, s => s.score).mean;
check(gambleScore < carefulScore * 0.8, `guessing between the last two scores clearly worse than paying (${gambleScore.toFixed(0)} against ${carefulScore.toFixed(0)})`);

// ---------------------------------------------------------------- 5. guessing at once
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

// ---------------------------------------------------------------- 6. doing nothing
const still = idle(5);
check(still.status === 'faded', 'a bot that does nothing fades');

// ---------------------------------------------------------------- report
console.table(rows);
console.log(`abilities: Light ${COST.glow}, Push ${COST.push}, Leap ${COST.leap}, Rewind ${COST.rewind} years; a wrong name ${WRONG}; candle ${LIFE} years, burning ${BURN} a second while you look (x${CHAPTERS[2].burn} when old), walk ${SPEED} tiles a second`);
console.log(`careful bot: ${runs.length} runs (every island order, every face forced), all three named on every run, years left min ${carefulMin.toFixed(1)}, mean ${stats(runs, s => s.life).mean.toFixed(1)}, score ${carefulScore.toFixed(0)}`);
console.log(`careful bot spending decisions a run: mean ${usesMean.toFixed(2)}; ${Object.entries(hist).map(([k, v]) => `${k}: ${(100 * v / runs.length).toFixed(0)}%`).join(', ')}`);
console.log(`slow careful bot (half speed, 8 s still before every choice): ${slow.length} runs, all named, years left min ${slowMin.toFixed(1)}, mean ${stats(slow, s => s.life).mean.toFixed(1)}; ${slowSeconds.mean.toFixed(0)} s of play a run (min ${slowSeconds.min.toFixed(0)}, max ${slowSeconds.max.toFixed(0)}), not counting picture and chapter screens`);
console.log(`careful bot uses: ${ABILITIES.map(a => `${a.name} ${(100 * usage[a.id]).toFixed(0)}%`).join(', ')} of runs`);
console.log(`spender (opens every lock): ${spend.length} runs, faded ${(100 * spendFaded).toFixed(0)}%, score ${spendScore.toFixed(0)} (careful ${carefulScore.toFixed(0)})`);
console.log(`gambler (names a face when two are left): score ${gambleScore.toFixed(0)}, ${(100 * gamble.filter(s => s.status === 'remembered').length / gamble.length).toFixed(0)}% name all three, faded ${(100 * gamble.filter(s => s.status === 'faded').length / gamble.length).toFixed(0)}%`);
console.log(`guess at once: ${Object.entries(quickRows).map(([k, v]) => `${k} ${(100 * v).toFixed(1)}% right, score ${quickScore[k].toFixed(0)}, ${JSON.stringify(quickOutcome[k])}`).join('; ')} (chance ${(100 / FACES).toFixed(1)}%)`);
console.log(`free memory (if any), then guess among the faces that fit: right ${(100 * peekRight / peekNamed).toFixed(1)}% of names, score ${(peekScore / 2000).toFixed(0)}`);
console.log(`do-nothing bot: ${still.status} after ${(still.t / 60).toFixed(0)} s`);
check(Date.now() - t0 < 60000, 'bots finish in under 60 seconds');
console.log(`${failures ? 'FAILED' : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failures ? 1 : 0);
