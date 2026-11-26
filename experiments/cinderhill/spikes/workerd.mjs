// Spikes S1 and S2 in a Durable Object under workerd, through `wrangler dev` (local, nothing deployed).
// Usage: node workerd.mjs [--wrangler=<command>] [--ticks=12000] [--ants=2000] [--colony]
// --colony: S2 replays the colony game of s2.mjs --colony instead of the sandbox.
// The wrangler config goes in a temporary directory; it is a local harness, not a Worker of this repo.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { script, replay, firstDivergence } from '../sim/replay.js';

const args = process.argv.slice(2), opt = (k, d) => args.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const TICKS = Number(opt('ticks', 12000)), ANTS = Number(opt('ants', 2000)), PORT = 8799 + Math.floor(Math.random() * 100);
const wrangler = opt('wrangler', 'npx wrangler@4.168.0').split(' ');
const dir = mkdtempSync(join(tmpdir(), 'cinderhill-workerd-'));
const main = resolve(dirname(fileURLToPath(import.meta.url)), 'workerd/worker.js');
writeFileSync(join(dir, 'wrangler.jsonc'), JSON.stringify({
  name: 'cinderhill-spike', main, compatibility_date: '2026-11-01',
  durable_objects: { bindings: [{ name: 'ROOM', class_name: 'Room' }] },
  migrations: [{ tag: 'v1', new_sqlite_classes: ['Room'] }],
  observability: { enabled: true },
}));
const child = spawn(wrangler[0], [...wrangler.slice(1), 'dev', '--config', join(dir, 'wrangler.jsonc'), '--port', String(PORT), '--ip', '127.0.0.1'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } });
let log = '';
child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${PORT}`;
const post = async (path, body) => { const r = await fetch(base + path, { method: 'POST', body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`); return r.json(); };
try {
  for (let k = 0; ; k++) {
    try { await fetch(base + '/none'); break; } catch { if (k > 120) throw new Error(`wrangler dev did not start:\n${log}`); await new Promise(ok => setTimeout(ok, 500)); }
  }
  // S1: per-batch wall time from the client, 20 ticks a request (one second of game time).
  for (const ants of [2000, 5000]) {
    const cfg = { seed: 2026, ants }, commands = script(cfg, 3000);
    await post('/new', { cfg, commands });
    for (let k = 0; k < 30; k++) await post('/step', { ticks: 20 }); // warm up (600 ticks)
    const ms = [];
    for (let k = 0; k < 120; k++) { const t = performance.now(); await post('/step', { ticks: 20 }); ms.push((performance.now() - t) / 20); }
    const empty = []; for (let k = 0; k < 20; k++) { const t = performance.now(); await post('/step', { ticks: 0 }); empty.push(performance.now() - t); }
    const s = ms.slice().sort((a, b) => a - b), mean = ms.reduce((a, b) => a + b, 0) / ms.length, rt = empty.reduce((a, b) => a + b, 0) / empty.length;
    console.log(`S1 workerd ${ants} ants: per tick over 2,400 ticks in 20-tick requests: mean ${mean.toFixed(2)} ms, p95 of batches ${s[Math.floor(s.length * 0.95)].toFixed(2)} ms, max ${s.at(-1).toFixed(2)} ms (request round trip with no ticks ${rt.toFixed(2)} ms, included)`);
  }
  // S2: the same replay in the room and in Node.
  const cfg = args.includes('--colony') ? { seed: 2026, ants: 20, sugar: 40, larvae: 4, colony: 1, dayTicks: 1200 } : { seed: 2026, ants: ANTS }, commands = script(cfg, TICKS);
  const t = performance.now();
  const room = await post('/replay', { cfg, commands, ticks: TICKS, every: 20 });
  const wms = performance.now() - t;
  const local = replay({ cfg, commands, ticks: TICKS, every: 20 }).records;
  console.log(`S2 workerd ${TICKS} ticks, ${cfg.ants} ants${cfg.colony ? ' (colony)' : ''}: ${Math.round(wms)} ms; divergence from Node: ${JSON.stringify(firstDivergence(local, room))}; records ${room.length}`);
} finally {
  child.kill('SIGTERM');
  rmSync(dir, { recursive: true, force: true });
}
