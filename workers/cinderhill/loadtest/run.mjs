// A measured run: N scripted clients in one room, then the room's counters, an offline check of the
// command log against every client's hashes, and (optionally later) the room's CPU from Cloudflare analytics.
// Usage: node run.mjs --url=wss://host --room=code [--role=relay|authority] [--ants=2000] [--clients=4]
//          [--seconds=600] [--name=label]
// Writes results/<name>.json (summary, no hash lists) and prints it. cpu.mjs reads the CPU afterwards.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Sim, encodeCommand } from '../../../experiments/cinderhill/sim/sim.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=')]));
const CLIENTS = Number(args.clients ?? 4), name = args.name ?? `${args.role ?? 'relay'}-${args.ants ?? 2000}`;
const http = args.url.replace(/^ws/, 'http');
const dir = join(tmpdir(), `hill-${process.pid}`); mkdirSync(dir, { recursive: true });
const startedAt = new Date().toISOString();
const procs = [];
for (let k = 0; k < CLIENTS; k++) {
  const p = spawn(process.execPath, [new URL('client.mjs', import.meta.url).pathname, ...process.argv.slice(2).filter(a => !a.startsWith('--name')), `--index=${k}`, `--clients=${CLIENTS}`, `--out=${join(dir, `c${k}.json`)}`], { stdio: ['ignore', 'pipe', 'inherit'] });
  procs.push(new Promise(ok => { let s = ''; p.stdout.on('data', d => { s += d; }); p.on('exit', () => ok(s)); }));
  await new Promise(ok => setTimeout(ok, 150));
}
await Promise.all(procs);
const endedAt = new Date().toISOString();
const clients = [...Array(CLIENTS).keys()].map(k => JSON.parse(readFileSync(join(dir, `c${k}.json`), 'utf8')));
const stats = await (await fetch(`${http}/room/${args.room}/stats`)).json();

// Offline check: replay the room's command log in Node and compare with every hash each client sent.
let offline = null;
const logRes = await fetch(`${http}/room/${args.room}/log`);
if (logRes.ok) {
  const log = await logRes.json();
  const keys = new Set(log.commands.map(c => `${c[1]}:${c[2]}`));
  const sim = new Sim({ seed: log.cfg.seed, ants: log.cfg.ants });
  // Queue each tick's commands just before that tick, and drain events after each step, as the clients do:
  // the pending queue and the events are part of the hash.
  let at = 0;
  const want = new Map(); for (const c of clients) for (const [t, h] of c.hashes) { if (!want.has(t)) want.set(t, []); want.get(t).push(h); }
  const last = Math.max(...clients.map(c => c.hashes.at(-1)?.[0] ?? 0));
  let compared = 0, differ = 0, firstDiffer = null;
  while (sim.tick < last) {
    while (at < log.commands.length && log.commands[at][0] === sim.tick) sim.queueCommand(Int32Array.from(log.commands[at++]));
    sim.step();
    const w = want.get(sim.tick);
    if (w) { const h = sim.hashes().total; for (const x of w) { compared++; if (x !== h) { differ++; firstDiffer ??= sim.tick; } } }
    sim.drainEvents();
  }
  offline = { commands: log.commands.length, uniqueSeatIds: keys.size, sealed: log.sealed, replayedTo: sim.tick, compared, differ, firstDiffer };
}
const sum = clients.map(c => c.summary);
const result = {
  name, role: args.role ?? 'relay', ants: Number(args.ants ?? 2000), clients: CLIENTS, seconds: Number(args.seconds ?? 600), startedAt, endedAt,
  object: stats.object, version: stats.version,
  ticksPerSecond: sum.map(s => +s.ticksPerSecond.toFixed(3)),
  gapSdMs: sum.map(s => +s.gapSdMs.toFixed(2)), gapP99Ms: sum.map(s => +s.gapP99.toFixed(1)), gapMaxMs: sum.map(s => +s.gapMax.toFixed(1)), gapsOver100: sum.map(s => s.gapsOver100),
  bytesInPerSec: sum.map(s => +s.bytesInPerSec.toFixed(1)), bytesOutPerSec: sum.map(s => +s.bytesOutPerSec.toFixed(1)),
  clientLoopDelayP99Ms: sum.map(s => +s.clientLoopDelayP99Ms.toFixed(1)),
  orders: clients.map(c => c.sentOrders), dupsSent: clients.map(c => c.sentDups), acks: clients.map(c => c.acks), unacked: sum.map(s => s.unacked),
  desyncNotices: clients.map(c => c.desyncs.length), reconnects: clients.map(c => c.reconnects), versions: [...new Set(clients.flatMap(c => c.versions))],
  room: stats, offline,
};
mkdirSync(new URL('results/', import.meta.url), { recursive: true });
writeFileSync(new URL(`results/${name}.json`, import.meta.url), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result, null, 1));
