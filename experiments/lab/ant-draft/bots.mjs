// Bots for Ant Draft: node bots.mjs [runs] [--mutate]
// Proves the rules and measures difficulty. Exits non-zero when a check fails.
// --mutate breaks one rule (the queen takes no damage, sim.js hurtQueen) and the checks must then fail.
import { create, step, setRally, pick, threat, score, DT, CARDS, QUEEN, WAVES } from './sim.js';

const args = process.argv.slice(2), mutate = args.includes('--mutate'), RUNS = Number(args.find(a => /^\d+$/.test(a))) || 120;
const CAP = Math.round(120 / DT); // a wave that lasts two minutes counts as a loss (and keeps a broken rule from hanging the run)
const DRAFT = 5; // seconds a person takes to choose a card, for the run-length figure

function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ORDER = ['brood', 'jaws', 'shell', 'guard', 'split', 'fire', 'frenzy', 'carry', 'acid', 'legs', 'jelly', 'scout'];

// careful: every 0.2 s puts the flag on the most dangerous enemy; takes cards in a fixed order of preference.
// clumsy: looks every 1.6 s, picks any enemy, misses by up to 60 units, and takes cards at random.
// idle: never moves the flag (card picks as careful). park: holds the flag on the queen (card picks as careful).
const BOTS = {
  careful: { every: 0.2, aim: (s) => { const f = threat(s); return f ? [f.x, Math.min(f.y + 6, QUEEN.y - 30)] : [QUEEN.x, QUEEN.y - 90]; }, card: s => s.offers.reduce((b, id, i) => ORDER.indexOf(id) < ORDER.indexOf(s.offers[b]) ? i : b, 0) },
  clumsy: { every: 1.6, aim: (s, r) => { const f = s.foes[Math.floor(r() * s.foes.length)]; return f ? [f.x + (r() - 0.5) * 120, f.y + (r() - 0.5) * 120] : null; }, card: (s, r) => Math.floor(r() * s.offers.length) },
  idle: { every: 1e9, aim: () => null, card: null },
  park: { every: 1, aim: () => [QUEEN.x, QUEEN.y - 40], card: null },
};
BOTS.idle.card = BOTS.park.card = BOTS.careful.card;

function run(bot, seed, opts = {}) {
  const s = create(seed, { mutate, ...opts }), r = rng(seed * 7919 + 13), B = BOTS[bot];
  let next = 0, waveTicks = 0, timeout = false, log = '';
  while (s.phase !== 'won' && s.phase !== 'lost') {
    if (s.phase === 'draft') { pick(s, B.card(s, r)); waveTicks = 0; continue; }
    if (s.t >= next) { next = s.t + B.every; const p = B.aim(s, r); if (p) setRally(s, p[0], p[1]); }
    step(s);
    if (s.tick % 60 === 0) log += `${s.foes.length},${s.ants.length},${Math.round(s.queen.hp)};`;
    if (++waveTicks > CAP) { timeout = true; break; }
  }
  return { won: s.phase === 'won', wave: s.wave, cleared: s.wave + (s.phase === 'won' ? 1 : 0), time: s.t + DRAFT * s.picks.length, hp: s.queen.hp, score: score(s), timeout, log, picks: s.picks.join(',') };
}
const many = (bot, opts) => Array.from({ length: RUNS }, (_, i) => run(bot, 1000 + i, opts));
const rate = rs => rs.filter(r => r.won).length / rs.length;
const pct = x => `${(100 * x).toFixed(1)}%`;
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

let failed = 0;
function check(name, ok, detail) { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`); if (!ok) failed++; }

const t0 = Date.now();
const careful = many('careful'), clumsy = many('clumsy'), idle = many('idle'), park = many('park'), bare = many('careful', { noCards: true });
console.log(`${RUNS} runs per bot, seeds 1000..${999 + RUNS}${mutate ? ', MUTATED (queen takes no damage)' : ''}`);
for (const [n, rs] of Object.entries({ careful, clumsy, idle, park, 'careful, cards do nothing': bare }))
  console.log(`  ${n.padEnd(26)} wins ${pct(rate(rs)).padStart(6)}  mean waves cleared ${(rs.reduce((a, r) => a + r.cleared, 0) / RUNS).toFixed(2)}  median run ${median(rs.map(r => r.time)).toFixed(0)} s  timeouts ${rs.filter(r => r.timeout).length}`);

// Per wave: of the runs that reached wave k, the share that cleared it.
const perWave = rs => Array.from({ length: WAVES }, (_, k) => { const reached = rs.filter(r => r.cleared >= k), ok = reached.filter(r => r.cleared > k); return reached.length ? ok.length / reached.length : NaN; });
const pw = perWave(clumsy), pc = perWave(careful);
console.log(`  clumsy clear rate by wave (of runs that reached it): ${pw.map(x => Number.isNaN(x) ? '-' : pct(x)).join(' ')}`);
console.log(`  careful clear rate by wave:                          ${pc.map(x => Number.isNaN(x) ? '-' : pct(x)).join(' ')}`);

// Thresholds were fixed before tuning.
check('careful bot wins most runs', rate(careful) >= 0.7, pct(rate(careful)) + ' (need 70%)');
check('clumsy bot wins clearly fewer', rate(careful) - rate(clumsy) >= 0.3, `${pct(rate(clumsy))} against ${pct(rate(careful))} (need 30 points lower)`);
check('clumsy bot clears wave 1', pw[0] >= 0.9, pct(pw[0]) + ' (need 90%)');
const early = (pw[0] + pw[1] + pw[2]) / 3, late = [5, 6, 7].map(k => pw[k]).filter(x => !Number.isNaN(x)); const lateMean = late.reduce((a, b) => a + b, 0) / (late.length || 1);
check('difficulty rises for the clumsy bot', late.length > 0 && lateMean <= early - 0.1, `waves 1-3 ${pct(early)}, waves 6-8 ${pct(lateMean)} (need 10 points lower)`);
check('the thumb matters: an idle flag mostly loses', rate(idle) <= 0.3, pct(rate(idle)) + ' (need 30% or less)');
check('parking on the queen is worse than steering', rate(careful) - rate(park) >= 0.15, `${pct(rate(park))} against ${pct(rate(careful))} (need 15 points lower)`);
check('cards matter', rate(careful) - rate(bare) >= 0.3, `${pct(rate(bare))} without card effects (need 30 points lower)`);
const med = median(careful.filter(r => r.won).map(r => r.time));
check('a won run takes 3 to 5 minutes', med >= 180 && med <= 300, `${med?.toFixed(0)} s median, with ${DRAFT} s per card choice`);
const a = run('careful', 4242), b = run('careful', 4242), c = run('careful', 4243);
check('determinism', a.log === b.log && a.score === b.score && a.picks === b.picks && a.log !== c.log, `seed 4242 twice: score ${a.score} and ${b.score}; seed 4243 differs: ${a.log !== c.log}`);
const words = CARDS.map(c => c.words.split(/\s+/).length);
check('cards have at most five words', Math.max(...words) <= 5 && CARDS.every(c => c.words.length), `longest ${Math.max(...words)} words over ${CARDS.length} cards`);
check('runs differ', new Set(careful.map(r => r.picks)).size >= RUNS * 0.5, `${new Set(careful.map(r => r.picks)).size} different card sets in ${RUNS} careful runs`);
check('no run timed out', [...careful, ...clumsy].every(r => !r.timeout), `${[...careful, ...clumsy].filter(r => r.timeout).length} timeouts`);
console.log(`${failed ? failed + ' check(s) FAILED' : 'all checks passed'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
