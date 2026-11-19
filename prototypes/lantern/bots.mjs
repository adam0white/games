// Measured play: node prototypes/lantern/bots.mjs [runs]. Three policies of rising skill; prints how runs end.
import { create, step, centre, half, reach, GOAL } from './sim.js';
const runs = Number(process.argv[2] ?? 300);
const policies = {
  // Sees nothing but the banks.
  drift: s => centre(s, s.y + 0.15),
  // Dodges rocks inside the light; ignores embers.
  careful: s => steer(s, false),
  // Dodges rocks and goes for embers it can see.
  greedy: s => steer(s, true),
};
function steer(s, wantEmbers) {
  const see = reach(s.light), c = centre(s, s.y + 0.2), h = half(s.y + 0.2);
  let best = s.x, bestScore = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const x = c - h + 0.04 + (2 * h - 0.08) * i / 24;
    let score = -Math.abs(x - s.x) * 0.6 - Math.abs(x - c) * 0.3;
    for (const k of s.rocks) { const dy = k.y - s.y; if (dy > -0.03 && dy < see) { const gap = Math.abs(k.x - x) - k.rad - 0.03; if (gap < 0.03) score -= (0.03 - gap) * 60 / (0.15 + dy); } }
    if (wantEmbers) for (const e of s.embers) { const dy = e.y - s.y; if (!e.got && dy > 0 && dy < 1.2) score += Math.max(0, 0.12 - Math.abs(e.x - x)) * (4 + 6 * (1 - s.light)) / (0.3 + dy); }
    if (score > bestScore) { bestScore = score; best = x; }
  }
  return best;
}
for (const [name, policy] of Object.entries(policies)) {
  const ends = {}, dist = []; let grazes = 0, embers = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const s = create(seed);
    while (!s.over) step(s, policy(s));
    ends[s.over] = (ends[s.over] ?? 0) + 1; dist.push(s.y / GOAL); grazes += s.grazes; embers += s.taken;
  }
  dist.sort((a, b) => a - b);
  const q = p => (dist[Math.floor(p * (runs - 1))] * 100).toFixed(0) + '%';
  console.log(name.padEnd(8), JSON.stringify(ends), `distance p10 ${q(0.1)} median ${q(0.5)} p90 ${q(0.9)}`, `grazes/run ${(grazes / runs).toFixed(1)} embers/run ${(embers / runs).toFixed(1)}`);
}
