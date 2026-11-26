// One scripted player for the hill room: runs the sim in lockstep, sends its share of the scripted orders and
// a hash every second, reconnects and resumes after a close. Writes a JSON summary when it ends.
// Usage: node client.mjs --url=wss://host --room=code [--role=relay|authority] [--ants=2000] [--seed=2026]
//          [--index=0] [--clients=4] [--seconds=600] [--out=file.json] [--dup=10]
// --dup=N sends every Nth order twice (the room must drop the copy). --every=T adds a short trail stroke near the
// entrance every T ticks (default 40, two seconds), so each player sends about one order every two seconds.
import { writeFileSync } from 'node:fs';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { Sim, SIM_VERSION } from '../../../experiments/cinderhill/sim/sim.js';
import { script } from '../../../experiments/cinderhill/sim/replay.js';
import { PROTO, HASH_EVERY, decodeSealed } from '../src/protocol.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=')]));
const URL_ = args.url, ROOM = args.room, INDEX = Number(args.index ?? 0), CLIENTS = Number(args.clients ?? 4);
const SECONDS = Number(args.seconds ?? 600), DUP = Number(args.dup ?? 10), EVERY = Number(args.every ?? 40);
let rs = 0x9E3779B9 ^ INDEX; const rnd = n => { rs = (Math.imul(rs ^ (rs >>> 15), 0x2C1B3C6D) + 0x6D2B79F5) >>> 0; return rs % n; };
let nextStroke = 0;
const want = { role: args.role ?? 'relay', ants: Number(args.ants ?? 2000), seed: Number(args.seed ?? 2026) };
const eld = monitorEventLoopDelay({ resolution: 5 }); eld.enable();

let sim = null, orders = [], next = 0, nextId = 1, token = '', ws = null, done = false;
const unacked = new Map(); // id -> message text
const out = { index: INDEX, room: ROOM, want, seat: null, welcome: [], hashes: [], desyncs: [], acks: 0, dupAcks: 0, sentOrders: 0, sentDups: 0,
  bytesIn: 0, bytesOut: 0, frames: 0, liveGaps: [], reconnects: [], versions: [], firstAt: 0, firstTick: 0, lastAt: 0, lastTick: 0, refused: null };
let lastLive = 0, prevThrough = -1, closedAt = 0;
const t0 = performance.now();
const send = text => { if (ws?.readyState === 1) { ws.send(text); out.bytesOut += Buffer.byteLength(text); } };

function connect() {
  const q = new URLSearchParams({ proto: PROTO, sim: SIM_VERSION, have: sim ? sim.tick : 0, ...(token ? { token } : {}), role: want.role, ants: want.ants, seed: want.seed });
  ws = new WebSocket(`${URL_}/room/${ROOM}/ws?${q}`);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = ev => {
    const at = performance.now();
    if (typeof ev.data === 'string') {
      out.bytesIn += Buffer.byteLength(ev.data);
      const m = JSON.parse(ev.data);
      if (m.t === 'welcome') {
        out.welcome.push({ at: at - t0, seat: m.seat, sealed: m.sealed, boots: m.boots, version: m.version, role: m.role, ants: m.ants, object: m.object });
        if (!out.versions.includes(m.version)) out.versions.push(m.version);
        if (closedAt) out.reconnects.at(-1).welcomeAfter = at - closedAt;
        out.seat = m.seat; token = m.token;
        if (!sim) {
          sim = new Sim({ seed: m.seed, ants: m.ants });
          orders = script({ seed: m.seed, ants: m.ants }, SECONDS * 20 + 400).filter((_, k) => k % CLIENTS === INDEX);
        }
        for (const text of unacked.values()) send(text); // resend: the room drops what it already has
      } else if (m.t === 'ack') { if (unacked.delete(m.id)) out.acks++; if (m.dup) out.dupAcks++; }
      else if (m.t === 'desync') out.desyncs.push(m.tick);
      else if (m.t === 'reload') out.refused = m;
      return;
    }
    out.bytesIn += ev.data.byteLength; out.frames++;
    const { through, commands } = decodeSealed(ev.data);
    if (through === prevThrough + 1 && lastLive) out.liveGaps.push(at - lastLive);
    if (closedAt && out.reconnects.at(-1).firstFrameAfter === undefined) out.reconnects.at(-1).firstFrameAfter = at - closedAt;
    lastLive = at; prevThrough = through;
    if (!out.firstAt) { out.firstAt = at; out.firstTick = through; }
    out.lastAt = at; out.lastTick = through;
    for (const c of commands) sim.queueCommand(c);
    while (sim.tick <= through) {
      sim.step();
      if (sim.tick % HASH_EVERY === 0) { const h = sim.hashes().total; out.hashes.push([sim.tick, h]); send(JSON.stringify({ t: 'hash', tick: sim.tick, h: h | 0 })); }
      sim.drainEvents(); // every host drains after each step (and after hashing): events are part of the hash
    }
    // Orders: each goes out half a second before its scripted tick; plus a stroke every EVERY ticks.
    if (EVERY && sim.tick >= nextStroke) {
      nextStroke = sim.tick - (sim.tick % EVERY) + EVERY + INDEX * 7;
      const ex = sim.L.sw >> 1, ey = sim.L.sh >> 1;
      orders.splice(next, 0, { tick: sim.tick + 10, type: 1, layer: 0, points: [ex, ey, ex + rnd(61) - 30, ey + rnd(61) - 30, ex + rnd(81) - 40, ey + rnd(81) - 40] });
    }
    while (next < orders.length && orders[next].tick <= sim.tick + 10) {
      const { seat, id, tick, ...cmd } = orders[next++], myId = nextId++;
      const text = JSON.stringify({ t: 'cmd', id: myId, tick, cmd });
      unacked.set(myId, text); send(text); out.sentOrders++;
      if (DUP && myId % DUP === 0) { send(text); out.sentDups++; }
    }
  };
  ws.onclose = ev => {
    if (done) return;
    closedAt = performance.now(); lastLive = 0;
    out.reconnects.push({ at: closedAt - t0, code: ev.code, reason: ev.reason, tick: sim?.tick ?? 0 });
    if (ev.code === 4005 || ev.code === 4001) { console.error(`refused ${ev.code} ${ev.reason}`); finish(); return; }
    setTimeout(connect, 200 + Math.random() * 300);
  };
  ws.onerror = () => {};
}

function finish() {
  if (done) return;
  done = true;
  try { ws?.close(1000, 'done'); } catch {}
  const g = out.liveGaps.slice().sort((a, b) => a - b), mean = g.reduce((a, b) => a + b, 0) / (g.length || 1);
  const sd = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / (g.length || 1));
  const secs = (out.lastAt - out.firstAt) / 1000;
  out.summary = {
    ticksPerSecond: secs > 0 ? (out.lastTick - out.firstTick) / secs : 0, seconds: secs,
    gapMeanMs: mean, gapSdMs: sd, gapP50: g[Math.floor(g.length * 0.5)], gapP99: g[Math.floor(g.length * 0.99)], gapMax: g.at(-1), gapsOver100: g.filter(x => x > 100).length,
    bytesInPerSec: out.bytesIn / ((performance.now() - t0) / 1000), bytesOutPerSec: out.bytesOut / ((performance.now() - t0) / 1000),
    clientLoopDelayP99Ms: eld.percentile(99) / 1e6, clientLoopDelayMaxMs: eld.max / 1e6, unacked: unacked.size, simTick: sim?.tick ?? 0,
  };
  delete out.liveGaps;
  if (args.out) writeFileSync(args.out, JSON.stringify(out));
  console.log(JSON.stringify({ index: INDEX, seat: out.seat, ...out.summary, reconnects: out.reconnects, desyncs: out.desyncs.length, versions: out.versions }));
  setTimeout(() => process.exit(0), 100);
}

connect();
setTimeout(finish, SECONDS * 1000);
process.on('SIGTERM', finish);
