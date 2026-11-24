// Local full-room workload: bot decisions, authoritative sim, interest deltas,
// scoreboards and event fanout. No network, timers, server, or browser.
// node loadtest/bench.mjs [12 60 240] [--modes classic,feast,rush]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as C from '../public/crumbwar/shared/config.js';
import { snapshotEvery } from '../public/crumbwar/shared/modes.js';
import { createWorld, step, addAnt } from '../src/sim.mjs';
import { think, balance, pickColony } from '../src/bots.mjs';
import * as net from '../src/net.mjs';

export function benchmark(mode, people, ticks = 3000) {
  const w = createWorld(42, mode), clients = [];
  // People use the bot brain, but count as people for room filling.
  for (let i = 0; i < people; i++) {
    const a = addAnt(w, pickColony(w), false, 0, 0);
    clients.push({ a, view: net.newView() }); balance(w);
  }
  balance(w);
  const cost = new Float64Array(ticks), peopleIds = new Set(clients.map(c => c.a.id)); let cpuStart; let decisionMs = 0, simulationMs = 0, networkMs = 0, bytes = 0, snapshotBytes = 0, snaps = 0, largestSnapshot = 0;
  for (let t = 0; t < ticks + 200; t++) {
    if (t === 200) cpuStart = process.cpuUsage();
    const measured = t >= 200, start = performance.now();
    for (const a of w.ants) if (a) think(w, a);
    const afterDecisions = performance.now();
    step(w);
    const afterSimulation = performance.now();
    for (const c of clients) if ((w.tick + c.a.id) % snapshotEvery(w.rules, w.count) === 0) {
      const m = net.snapshot(w, c.a, c.view, 0);
      if (measured) { bytes += m.length; snapshotBytes += m.length; snaps++; largestSnapshot = Math.max(largestSnapshot, m.length); }
    }
    if (w.tick % C.TICK_HZ === 0) {
      const ranked = w.ants.filter(Boolean).sort((a, b) => b.score - a.score);
      for (const c of clients) { const m = net.scores(w, ranked, c.a, people); if (measured) bytes += m.length; }
    }
    for (const [type, a, b] of w.events) {
      const m = net.event(type, a, b, 0);
      // Room kill/death notices go only to the killer and victim. Round events fan out.
      const recipients = type === 1 ? Number(peopleIds.has(a)) + Number(peopleIds.has(b)) : clients.length;
      if (measured) bytes += m.length * recipients;
    }
    if (measured) {
      const end = performance.now();
      decisionMs += afterDecisions - start; simulationMs += afterSimulation - afterDecisions; networkMs += end - afterSimulation;
      cost[t - 200] = end - start;
    }
  }
  const cpu = process.cpuUsage(cpuStart), meanProcessCpuMs = (cpu.user + cpu.system) / 1000 / ticks;
  const sorted = [...cost].sort((a, b) => a - b), mean = cost.reduce((sum, value) => sum + value, 0) / ticks;
  const bytesPerClientSecond = bytes / people / (ticks / C.TICK_HZ);
  return { mode, people, ants: w.count, seconds: ticks / C.TICK_HZ, snapshotsPerSecond: C.TICK_HZ / snapshotEvery(w.rules, w.count),
    meanTickMs: mean, meanProcessCpuMs, meanDecisionMs: decisionMs / ticks, meanSimulationMs: simulationMs / ticks, meanNetworkMs: networkMs / ticks, p99TickMs: sorted[ticks * .99 | 0], maxTickMs: sorted[ticks - 1],
    bytesPerClientSecond, meanSnapshotBytes: snapshotBytes / snaps, largestSnapshot,
    byteTarget: people === 12 ? 1200 : people === 60 ? 1800 : null,
    bytePass: people === 12 ? bytesPerClientSecond < 1200 : people === 60 ? bytesPerClientSecond < 1800 : null,
    tickPass: people === 240 ? mean < 1 : null };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), index = args.indexOf('--modes');
  const modes = index < 0 ? ['classic', 'feast', 'rush'] : args[index + 1].split(',');
  const sizes = args.filter((value, i) => index < 0 || (i !== index && i !== index + 1)).map(Number).filter(value => Number.isInteger(value) && value > 0);
  for (const mode of modes) for (const people of sizes.length ? sizes : [12, 60, 240]) console.log(JSON.stringify(benchmark(mode, people)));
}
