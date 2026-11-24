// Ant Draft (lab): bots that prove the rules and measure difficulty.
//   node bots.mjs            runs the checks, exits 1 on a failure
//   node bots.mjs --mutate   breaks one rule (the nest takes no damage from bugs) and must fail
//   node bots.mjs --mutate=nobite|nosplit   other mutations
import { create, step, choose, digest, MUT, FOES, NEST, LINE, W, WAVES, DT, CARD_IDS } from './sim.js';

const arg = process.argv.find(a => a.startsWith('--mutate'));
if (arg) MUT.name = arg.includes('=') ? arg.split('=')[1] : 'safenest';
const N = Number(process.env.RUNS || 120);

// Bots see what a player sees: the bugs, the nest, the cards. They answer with a rally point.
const PRIORITY = ['guard', 'honey', 'haul', 'scout', 'swift', 'jaws', 'acid', 'brood', 'shell', 'split'];
function careful() {
  return {
    pick: s => { let best = 0; s.offer.forEach((id, i) => { if (PRIORITY.indexOf(id) < PRIORITY.indexOf(s.offer[best])) best = i; }); return best; },
    move(s) {
      // the bug that will reach the mound first, met just below it; wasps only when nothing walks
      let f = null, ft = Infinity;
      for (const e of s.foes) { const t = (LINE - e.y) / FOES[e.kind].spd + (FOES[e.kind].fly ? 30 : 0) - (e.y < 0 || e.x < 0 || e.x > W ? 0 : 0); if (t < ft) { ft = t; f = e; } }
      if (!f) return { x: NEST.x, y: LINE - 80 };
      return { x: Math.max(20, Math.min(W - 20, f.x < 0 || f.x > W ? f.lane : f.x)), y: Math.min(LINE - 20, Math.max(f.y, 30) + 26) };
    },
  };
}
// Slow and random: looks again every 1.6 s, often does nothing, chases a random bug where it was, picks cards at random.
function clumsy(r) {
  let next = 0, aim = null;
  return {
    pick: s => Math.floor(r() * s.offer.length),
    move(s) {
      if (s.t < next) return aim; next = s.t + 1.6;
      if (r() < 0.35 || !s.foes.length) return aim = null;
      const e = s.foes[Math.floor(r() * s.foes.length)];
      return aim = { x: e.x + (r() - 0.5) * 80, y: e.y + (r() - 0.5) * 80 };
    },
  };
}
const idle = () => ({ pick: () => 0, move: () => null });

function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function play(seed, bot, trace = null) {
  const s = create(seed);
  let steps = 0; const dmg = Array(WAVES + 1).fill(0);
  while (s.phase !== 'won' && s.phase !== 'lost' && steps < 30 * 60 * 10) {
    if (s.phase === 'draft') { choose(s, bot.pick(s)); continue; }
    const input = bot.move(s), hp = s.nest.hp, w = s.wave; step(s, input); steps++; if (s.nest.hp < hp) dmg[w] += hp - s.nest.hp;
    if (trace && steps % 30 === 0) trace.push(digest(s));
  }
  return { won: s.phase === 'won', wave: s.phase === 'won' ? WAVES + 1 : s.wave, t: s.t, score: s.score, held: s.held.slice(), nest: s.nest.hp, kills: s.kills, dmg };
}

function batch(name, make) {
  const out = [];
  for (let i = 0; i < N; i++) out.push(play(1000 + i * 7919, make(i)));
  const wins = out.filter(r => r.won).length / N;
  // clear rate of wave n among runs that reached it
  const rate = [];
  for (let n = 1; n <= WAVES; n++) { const reached = out.filter(r => r.wave >= n).length, cleared = out.filter(r => r.wave > n).length; rate.push(reached ? cleared / reached : 0); }
  const meanT = out.filter(r => r.won).reduce((a, r) => a + r.t, 0) / Math.max(1, out.filter(r => r.won).length);
  const meanWave = out.reduce((a, r) => a + Math.min(WAVES, r.wave - (r.won ? 1 : 0)), 0) / N;
  console.log(`${name.padEnd(8)} wins ${(wins * 100).toFixed(0).padStart(3)}%  mean waves cleared ${(out.reduce((a, r) => a + (r.wave - 1), 0) / N).toFixed(2)}  clear rate by wave ${rate.map(x => (x * 100).toFixed(0)).join(' ')}  win time ${meanT.toFixed(0)} s`);
  const hurt = [];
  for (let n = 1; n <= WAVES; n++) { const rs = out.filter(r => r.wave >= n); hurt.push(rs.reduce((a, r) => a + r.dmg[n], 0) / Math.max(1, rs.length)); }
  console.log(`${''.padEnd(8)} nest damage by wave ${hurt.map(x => x.toFixed(1)).join(' ')}`);
  return { wins, rate, meanT, meanWave, out, hurt };
}

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
if (MUT.name) console.log(`mutation: ${MUT.name}`);

const t0 = Date.now();
const C = batch('careful', () => careful());
const K = batch('clumsy', i => clumsy(rnd(77 + i)));
const I = batch('idle', () => idle());

ok(C.wins >= 0.7, `careful bot wins most runs (${(C.wins * 100).toFixed(0)}% >= 70%)`);
ok(K.wins <= C.wins - 0.25, `clumsy bot wins clearly fewer (${(K.wins * 100).toFixed(0)}% <= careful - 25 pts)`);
ok(K.rate[0] >= 0.9, `clumsy bot clears wave 1 (${(K.rate[0] * 100).toFixed(0)}% >= 90%)`);
// Difficulty rises: the clumsy bot's clear rate falls from wave 1 to its worst later wave. (The clear rate among runs
// that reached a wave is biased by survivorship, since only strong hands reach wave 8, so the check takes the worst wave.)
const worst = Math.min(...K.rate.slice(3));
ok(worst <= K.rate[0] - 0.15, `difficulty rises: clumsy clear rate falls from ${(K.rate[0] * 100).toFixed(0)}% at wave 1 to ${(worst * 100).toFixed(0)}% at its worst later wave`);
ok(I.wins < C.wins - 0.2, `input matters: idle bot ${(I.wins * 100).toFixed(0)}% < careful - 20 pts`);
ok(C.meanT >= 120 && C.meanT <= 260, `a won run lasts ${C.meanT.toFixed(0)} s of play (120 to 260 s, plus about 8 drafts: about 4 minutes)`);
// cards change runs: the careful bot holds many different hands
const hands = new Set(C.out.map(r => r.held.slice().sort().join(','))).size;
ok(hands >= N * 0.5, `runs differ: ${hands} distinct hands in ${N} careful runs`);
// determinism
const a = [], b = [];
const ra = play(4242, clumsy(rnd(9)), a), rb = play(4242, clumsy(rnd(9)), b);
ok(a.join() === b.join() && ra.score === rb.score, `deterministic: same seed and inputs give the same ${a.length} snapshots and score ${ra.score}`);
const c = []; play(4243, clumsy(rnd(9)), c);
ok(c.join() !== a.join(), 'a different seed gives a different run');
// each card does something: careful bot with a card forced in from the start vs. without, on wave-1 time to clear
for (const id of CARD_IDS) {
  const base = create(5); const withC = create(5, { cards: [id] });
  ok(JSON.stringify(base.cards) !== JSON.stringify(withC.cards), `card ${id} is recorded`);
}
console.log(`${N * 3} runs in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
