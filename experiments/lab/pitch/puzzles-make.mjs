// Makes puzzles.js: node puzzles-make.mjs > puzzles.js. Run once; the output is committed and checked by bots.mjs.
// Each puzzle is one idea from the rules (see IDEAS in puzzles.js and the NOTES). Positions come from seeded
// self-play, as for today's pitch; a candidate is kept when its idea holds for every shortest scoring chain, and
// among candidates the one whose clumsy-bot clear rate is nearest the target for its place in the book is chosen,
// so the book gets harder gently.
import { create, legal, apply, clone, xy, solve, solveAll, mulberry32, DY, DX } from './sim.js';
import { IDEAS, clumsyRate, checkIdea } from './puzzles-rules.mjs';

const out = [];
const seen = new Set();
for (let i = 0; i < IDEAS.length; i++) {
  const idea = IDEAS[i], [w, h] = idea.size || [8, 10], target = 0.97 - i * (0.5 / (IDEAS.length - 1));
  let best = null, tried = 0, cands = 0;
  for (let attempt = 0; attempt < 20000 && cands < 40; attempt++) {
    const rng = mulberry32(31337 + i * 100003 + attempt * 7919), first = attempt & 1, s = create(w, h, first), moves = [];
    const lean = 0.3 + rng() * 0.4, minPly = Math.floor(6 + rng() * (idea.ink || 30));
    for (let ply = 0; ply < 200 && s.winner < 0; ply++) {
      if (s.turn === 0 && moves.length >= minPly && xy(s, s.ball).y <= Math.ceil(h * 0.5)) {
        tried++;
        const sol = solve(s, 7);
        if (sol && sol.length >= idea.min && sol.length <= idea.max) {
          const key = `${w}x${h}:` + s.ball + ':' + s.mask.join('');
          if (!seen.has(key) && checkIdea(idea, s, solveAll(s, 7, 200))) {
            cands++;
            const rate = clumsyRate(s, 120, 5000 + i);
            if (rate > 0 && (!best || Math.abs(rate - target) < Math.abs(best.rate - target))) best = { w, h, first, moves: moves.join(''), rate, len: sol.length, key };
            break;
          }
        }
      }
      const ds = legal(s).filter(d => { const t = clone(s); apply(t, d); return t.winner < 0; });
      if (!ds.length) break;
      const up = ds.filter(d => DY[d] < 0 && (!idea.edge || DX[d] !== 0)), pool = up.length && rng() < lean ? up : ds;
      const d = pool[Math.floor(rng() * pool.length)];
      apply(s, d); moves.push(d);
    }
  }
  if (!best) { console.error(`no puzzle for ${idea.id} (${tried} positions tried)`); process.exit(1); }
  seen.add(best.key);
  console.error(`${i + 1}. ${idea.id}: ${best.w}x${best.h}, chain ${best.len}, clumsy ${(best.rate * 100).toFixed(0)}% (target ${(target * 100).toFixed(0)}%), ${cands} candidates`);
  out.push({ id: idea.id, w: best.w, h: best.h, first: best.first, moves: best.moves, rate: best.rate });
}
// Book order: easiest first by the clumsy bot's clear rate, so no step in the book is a cliff. The first stays first.
const [head, ...rest] = out;
rest.sort((a, b) => b.rate - a.rate);
for (const p of [head, ...rest]) delete p.rate;
out.splice(0, out.length, head, ...rest);
console.log(`// Paper Pitch puzzles, made by puzzles-make.mjs (seeded; do not edit by hand). Checked by bots.mjs.
export const PUZZLES = [
${out.map(p => `  ${JSON.stringify(p)},`).join('\n')}
];`);
