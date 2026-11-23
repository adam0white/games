// How much CPU does one room tick cost, and how many bytes does one client get? Runs the same code the Durable
// Object runs (bots, step, a snapshot for every client), in Node, with no network. A deployed Durable Object
// cannot time its own code (its clock stands still while code runs), so this is where tick cost is measured.
//   node loadtest/bench.mjs [people ...]     default: 12 60 120 240
import * as C from '../public/crumbwar/shared/config.js';
import { createWorld, step, addAnt } from '../src/sim.mjs';
import { think, balance, pickColony } from '../src/bots.mjs';
import * as net from '../src/net.mjs';

const sizes = process.argv.slice(2).map(Number).filter(Boolean);
console.log('people  ants  tick ms: mean   p99    max   budget used   bytes/client/s   snapshot bytes: mean  max');
for (const people of sizes.length ? sizes : [12, 60, 120, 240]) {
  const w = createWorld(42), clients = [];
  // "People" here are ants driven by the bot brain but counted as people, so bots only fill what is left.
  for (let i = 0; i < people; i++) { const a = addAnt(w, pickColony(w), false, 0, 0); clients.push({ a, view: net.newView() }); balance(w); }
  balance(w);
  const TICKS = 3000, cost = new Float64Array(TICKS); let bytes = 0, snaps = 0, big = 0;
  for (let t = 0; t < TICKS + 200; t++) {
    const t0 = performance.now();
    for (const a of w.ants) if (a) think(w, a);
    step(w);
    for (const c of clients) if ((w.tick + c.a.id) % C.SNAP_EVERY === 0) { const m = net.snapshot(w, c.a, c.view, 0); if (t >= 200) { bytes += m.length; snaps++; big = Math.max(big, m.length); } }
    if (w.tick % C.TICK_HZ === 0) { const ranked = w.ants.filter(Boolean).sort((p, q) => q.score - p.score); for (const c of clients) bytes += net.scores(w, ranked, c.a, people).length; }
    if (t >= 200) cost[t - 200] = performance.now() - t0; // the first 200 ticks warm the JIT
  }
  const sorted = [...cost].sort((x, y) => x - y), mean = cost.reduce((s, v) => s + v) / TICKS, f = (v, n = 3) => v.toFixed(n).padStart(6);
  console.log(`${String(people).padStart(6)} ${String(w.count).padStart(5)}        ${f(mean)} ${f(sorted[TICKS * 0.99 | 0])} ${f(sorted[TICKS - 1])}      ${(mean / 50 * 100).toFixed(1).padStart(5)}%        ${String(Math.round(bytes / people / (TICKS / C.TICK_HZ))).padStart(6)}            ${String(Math.round(bytes / snaps)).padStart(6)} ${String(big).padStart(5)}`);
}
