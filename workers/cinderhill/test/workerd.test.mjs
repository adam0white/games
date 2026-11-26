// The restart test in workerd: `wrangler dev` with a persisted SQLite directory, two players in an authority
// room, then the process is killed (SIGKILL, no clean shutdown) and started again on the same directory.
// The players reconnect with their seat token and next tick; the room must resume from SQLite, apply each
// command once and agree with both players' hashes. About 40 s.
// WRANGLER=<command> picks the wrangler (default: npx wrangler, the repository's pinned one in CI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Sim, SIM_VERSION } from '../../../experiments/cinderhill/sim/sim.js';
import { PROTO, decodeSealed } from '../src/protocol.mjs';

const cwd = new URL('..', import.meta.url).pathname, wrangler = (process.env.WRANGLER || 'npx wrangler').split(' ');
const persist = mkdtempSync(join(tmpdir(), 'hill-workerd-')), PORT = 8700 + Math.floor(Math.random() * 90), base = `127.0.0.1:${PORT}`;
const kill = child => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} };
const wait = ms => new Promise(ok => setTimeout(ok, ms));

async function up() {
  const child = spawn(wrangler[0], [...wrangler.slice(1), 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--var', 'DEBUG_ROLES:1', '--persist-to', persist], { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } });
  let log = ''; child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  for (let k = 0; ; k++) {
    try { if ((await fetch(`http://${base}/health`)).ok) return child; } catch {}
    if (k > 240 || child.exitCode !== null) throw new Error(`wrangler dev did not start:\n${log}`);
    await wait(250);
  }
}

function player(q) {
  const p = { sim: null, token: '', acks: new Map(), unacked: new Map(), welcomes: [], hashes: [], ws: null, nextId: 1 };
  p.connect = () => new Promise(ok => {
    const qs = new URLSearchParams({ proto: PROTO, sim: SIM_VERSION, have: p.sim ? p.sim.tick : 0, ...q, ...(p.token ? { token: p.token } : {}) });
    const ws = p.ws = new WebSocket(`ws://${base}/room/restart1/ws?${qs}`);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = ev => {
      if (typeof ev.data === 'string') {
        const m = JSON.parse(ev.data);
        if (m.t === 'welcome') { p.welcomes.push(m); p.token = m.token; p.sim ??= new Sim({ seed: m.seed, ants: m.ants }); for (const t of p.unacked.values()) ws.send(t); ok(); }
        if (m.t === 'ack') { p.unacked.delete(m.id); p.acks.set(m.id, m); }
        return;
      }
      const f = decodeSealed(ev.data);
      for (const c of f.commands) p.sim.queueCommand(c);
      while (p.sim.tick <= f.through) {
        p.sim.step();
        if (p.sim.tick % 20 === 0) { const h = p.sim.hashes().total; p.hashes.push([p.sim.tick, h]); ws.send(JSON.stringify({ t: 'hash', tick: p.sim.tick, h: h | 0 })); }
        p.sim.drainEvents();
      }
    };
  });
  p.order = (n, id = p.nextId++) => { const t = JSON.stringify({ t: 'cmd', id, tick: (p.sim?.tick ?? 0) + 4, cmd: { type: 1, layer: 0, points: [128, 128, 128 + n, 118] } }); p.unacked.set(id, t); if (p.ws.readyState === 1) p.ws.send(t); };
  return p;
}

test('workerd: kill and restart wrangler dev mid-match; the room resumes from SQLite', { timeout: 180_000 }, async () => {
  let dev = await up();
  try {
    const a = player({ role: 'authority', ants: 300 }), b = player({});
    await a.connect(); await b.connect();
    for (let k = 0; k < 16; k++) { a.order(k); b.order(-k); await wait(200); }
    await wait(1500);
    const before = await (await fetch(`http://${base}/room/restart1/stats`)).json();
    assert.equal(before.cfg.role, 'authority');
    assert.ok(before.compared > 0 && before.mismatches === 0, JSON.stringify(before));
    const tickAtKill = a.sim.tick;
    a.order(99); // may die unsealed: then it is resent after the restart
    kill(dev); // the whole process group: npx, wrangler and workerd
    await new Promise(ok => dev.once('exit', ok));
    await wait(500);
    dev = await up();
    await a.connect(); await b.connect();
    a.order(5, 5); // already stored: must be dropped
    for (let k = 0; k < 10; k++) { a.order(100 + k); b.order(100 + k); await wait(200); }
    await wait(2500);
    const after = await (await fetch(`http://${base}/room/restart1/stats`)).json();
    assert.equal(after.boots, 1, 'the room was restarted');
    assert.equal(after.mismatches, 0, JSON.stringify(after));
    assert.ok(after.compared > 0);
    assert.ok(after.replayed > 0, 'the authority sim was rebuilt from SQLite');
    assert.equal(a.welcomes.at(-1).seat, a.welcomes[0].seat);
    assert.ok(a.sim.tick > tickAtKill);
    assert.equal(a.unacked.size + b.unacked.size, 0);
    const log = await (await fetch(`http://${base}/room/restart1/log`)).json();
    const keys = log.commands.map(c => `${c[1]}:${c[2]}`);
    assert.equal(new Set(keys).size, keys.length, 'each command stored once');
    assert.equal(keys.length, a.nextId - 1 + b.nextId - 1);
    // Replay the stored log in Node: the same hash as each player at each player's last hashed tick.
    for (const p of [a, b]) {
      const [tick, h] = p.hashes.at(-1), ref = new Sim({ seed: log.cfg.seed, ants: log.cfg.ants });
      let at = 0;
      while (ref.tick < tick) { while (at < log.commands.length && log.commands[at][0] === ref.tick) ref.queueCommand(Int32Array.from(log.commands[at++])); ref.step(); ref.drainEvents(); }
      assert.equal(ref.hashes().total, h);
    }
    a.ws.close(); b.ws.close();
  } finally {
    kill(dev);
    rmSync(persist, { recursive: true, force: true });
  }
});
