// Measured play: node prototypes/lantern/bots.mjs [runs]. Three policies of rising skill; prints how runs end.
import { create, step, centre, half, sight, score, progress, GOAL, BOAT } from './sim.js';
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
  const see = sight(s), c = centre(s, s.y + 0.2), h = half(s, s.y + 0.2);
  let best = s.x, bestScore = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const x = c - h + 0.04 + (2 * h - 0.08) * i / 24;
    let score = -Math.abs(x - s.x) * 0.6 - Math.abs(x - c) * 0.3;
    for (const k of s.rocks) { const dy = k.y - s.y; if (dy > -0.03 && dy < see) { const gap = Math.max(0, Math.abs(k.x - x) - k.len) - k.rad - 0.03; if (gap < 0.03) score -= (0.03 - gap) * 60 / (0.15 + dy); } }
    if (wantEmbers) for (const e of [...s.embers, ...s.powers]) { const dy = e.y - s.y; if (!e.got && dy > 0 && dy < 1.2) score += Math.max(0, 0.12 - Math.abs(e.x - x)) * (4 + 6 * (1 - s.light)) / (0.3 + dy); }
    if (score > bestScore) { bestScore = score; best = x; }
  }
  return best;
}
if (process.argv[3] !== 'audit') for (const stage of [1, 3, 5, 6, 8, 11, 12, 15, 17, 18, 20, 0]) for (const [name, policy] of Object.entries(policies)) {
  const ends = {}, dist = []; let grazes = 0, embers = 0, gifts = 0, powers = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const s = create(seed, stage || 1, !stage); // stage 0 is the endless river
    while (!s.over) { step(s, policy(s)); for (const e of s.events) if (e === 'heart' || e === 'shield') gifts++; else if (['boost', 'slow', 'small', 'big'].includes(e)) powers++; }
    ends[s.over] = (ends[s.over] ?? 0) + 1; dist.push(stage ? progress(s) : score(s) / 100); grazes += s.grazes; embers += s.taken;
  }
  dist.sort((a, b) => a - b);
  const q = p => (dist[Math.floor(p * (runs - 1))] * 100).toFixed(0) + '%';
  console.log(stage ? `stage ${stage}` : 'endless (score)', name.padEnd(8), JSON.stringify(ends), `distance p10 ${q(0.1)} median ${q(0.5)} p90 ${q(0.9)}`, `grazes/run ${(grazes / runs).toFixed(1)} embers/run ${(embers / runs).toFixed(1)} hearts+shields/run ${(gifts / runs).toFixed(2)} powers/run ${(powers / runs).toFixed(2)}`);
}

// Passability audit: node prototypes/lantern/bots.mjs 200 audit. A ghost boat rides the centre line and cannot die;
// each tick we measure the widest free gap across the river at the boat's row. A river is unfair if that gap closes.
// Also prints where the hazards sit, by tenth of the river, to show the ramp.
if (process.argv[3] === 'audit') for (const stage of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 0]) {
  let worst = Infinity, worstBig = Infinity, tight = 0, buried = 0, pickups = 0; const swing = Array(10).fill(0), all = Array(10).fill(0), seen = new Set();
  for (let seed = 1; seed <= (stage ? runs : Math.ceil(runs / 10)); seed++) { // the endless river is ridden far past its last step harder, on fewer seeds
    const s = create(seed, stage || 1, !stage); let min = Infinity; seen.clear(); const checked = new Set();
    while (!s.over && s.y < 30 * GOAL) {
      s.safe = 1e9; s.light = 1; step(s, centre(s, s.y));
      // A pickup is buried if a boat sitting on it at the moment it comes level would touch a rock.
      for (const p of [...s.embers, ...s.powers]) if (!checked.has(p) && p.y <= s.y) { checked.add(p); pickups++; if (s.rocks.some(k => Math.hypot(Math.max(0, Math.abs(k.x - p.x) - k.len), k.y - p.y) < k.rad + BOAT)) buried++; }
      for (const k of s.rocks) if (!seen.has(k)) { seen.add(k); const d = Math.min(9, Math.floor(k.y / GOAL * 10)); all[d]++; if (k.a || k.b || k.ice) swing[d]++; }
      const free = B => { // the widest gap a boat of radius B can sit in at this row
        const c = centre(s, s.y), e = half(s, s.y) - B, cuts = [];
        for (const k of s.rocks) { const dy = Math.abs(k.y - s.y), r = k.rad + B; if (dy < r) { const w = Math.sqrt(r * r - dy * dy) + k.len; cuts.push([k.x - w, k.x + w]); } }
        cuts.sort((a, b) => a[0] - b[0]);
        let x = c - e, gap = 0;
        for (const [a, b] of cuts) { gap = Math.max(gap, Math.min(a, c + e) - x); x = Math.max(x, b); }
        return Math.max(gap, c + e - x);
      };
      min = Math.min(min, free(BOAT)); worstBig = Math.min(worstBig, free(BOAT * 1.4));
    }
    worst = Math.min(worst, min); if (min < 0.03) tight++;
  }
  console.log(`${stage ? 'stage ' + stage : 'endless'} narrowest gap ${worst.toFixed(3)} (big boat ${worstBig.toFixed(3)}) rivers with a gap under 0.03: ${tight}/${runs}; buried pickups ${buried}/${pickups};`, 'moving share by tenth', swing.map((n, i) => (all[i] ? Math.round(100 * n / all[i]) : 0)).join(' '));
}
