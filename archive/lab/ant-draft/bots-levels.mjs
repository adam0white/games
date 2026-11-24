// Proves the levels: node bots-levels.mjs [runs]. Exits non-zero when a check fails. A careful thumb must be able to clear every level.
import { create, step, setRally, pick, threat, DT, QUEEN, CARDS } from './sim.js';
import { level, LEVELS, TUTORIAL } from './levels.js';
const RUNS = Number(process.argv[2]) || 8, ORDER = ['brood', 'jaws', 'shell', 'guard', 'split', 'fire', 'frenzy', 'carry', 'acid', 'legs', 'jelly', 'scout'];
function rng(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function run(L, bot, seed, opts = {}) {
  const s = create(seed, { level: L, ...opts }), r = rng(seed * 31 + 7); let next = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && s.t < 400) {
    if (s.phase === 'draft') { pick(s, bot === 'clumsy' ? Math.floor(r() * s.offers.length) : s.offers.reduce((b, id, i) => ORDER.indexOf(id) < ORDER.indexOf(s.offers[b]) ? i : b, 0)); continue; }
    if (s.t >= next && bot !== 'idle') {
      const f = bot === 'careful' ? threat(s) : s.foes[Math.floor(r() * s.foes.length)], wob = bot === 'clumsy' ? 100 : 0; next = s.t + (bot === 'careful' ? 0.4 : 1.4);
      if (f) setRally(s, f.x + (r() - 0.5) * wob, Math.min(f.y + 6, QUEEN.y - 30) + (r() - 0.5) * wob); else setRally(s, QUEEN.x, QUEEN.y - 90);
    }
    step(s);
  }
  return { won: s.phase === 'won', hp: s.queen.hp, t: s.t };
}
let failed = 0; const check = (name, ok, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`); if (!ok) failed++; };
const rate = rs => rs.filter(x => x.won).length / rs.length, rows = [];
for (let n = 1; n <= LEVELS; n++) {
  const L = level(n), seeds = Array.from({ length: RUNS }, (_, i) => 500 + n * 100 + i), c = seeds.map(x => run(L, 'careful', x)), m = seeds.map(x => run(L, 'clumsy', x)), idle = seeds.map(x => run(L, 'idle', x));
  rows.push({ n, c: rate(c), m: rate(m), idle: rate(idle), t: c.reduce((a, x) => a + x.t, 0) / RUNS, waves: L.waves.length });
  const z = rows.at(-1); console.log(`level ${String(n).padStart(2)} ${L.name.padEnd(13)} waves ${z.waves} careful ${(z.c * 100).toFixed(0)}% clumsy ${(z.m * 100).toFixed(0)}% idle ${(z.idle * 100).toFixed(0)}% ${z.t.toFixed(0)} s, queen ${(c.reduce((a, x) => a + x.hp, 0) / RUNS).toFixed(0)}`);
}
const mean = (k, a, b) => rows.slice(a, b).reduce((x, y) => x + y[k], 0) / (b - a);
check('fifty levels, all different', new Set(Array.from({ length: LEVELS }, (_, i) => JSON.stringify(level(i + 1).waves))).size === LEVELS, `${LEVELS}`);
check('every level can be cleared: careful wins at least half', rows.every(x => x.c >= 0.5), rows.filter(x => x.c < 0.5).map(x => x.n).join(',') || 'all');
check('the first five are gentle: clumsy wins', mean('m', 0, 5) >= 0.8, mean('m', 0, 5).toFixed(2));
check('the levels get harder for a clumsy thumb', mean('m', 40, 50) <= mean('m', 0, 10) - 0.2, `${mean('m', 0, 10).toFixed(2)} to ${mean('m', 40, 50).toFixed(2)}`);
check('steering matters: an idle flag loses late levels', mean('idle', 25, 50) <= 0.3, mean('idle', 25, 50).toFixed(2));
const T = Array.from({ length: 10 }, (_, i) => run(TUTORIAL, 'clumsy', i + 1, { safe: 1 })); check('the tutorial always ends in a win', rate(T) === 1, `${rate(T)}`);
check('same seed, same run', JSON.stringify(run(level(23), 'careful', 9)) === JSON.stringify(run(level(23), 'careful', 9)), 'level 23');
console.log(failed ? `${failed} FAILED` : 'all checks passed'); process.exit(failed ? 1 : 0);
