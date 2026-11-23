// Simulated clients against a running server, local or deployed. Each one is a real client: it opens the
// WebSocket, runs the same prediction code as the page 20 times a second, steers at random, pings, and checks
// what comes back. All of them join one room made for the test (lt-<name>), which nobody else is offered.
//   node loadtest/load.mjs --url wss://play.adamwhite.work --key <LOADTEST_KEY> --clients 60 --seconds 60 [--cap 60] [--room a1] [--burn 50]
// --burn N wastes N million square roots on every tick of that room, to overload it on purpose.
// Reported: joins, bytes per client, how regularly snapshots arrive, round trip time, how far prediction was
// corrected, and the room's own counters (ticks late, ticks skipped, kicks). This process's own timer lag is
// reported too, because a busy load generator looks like a slow server.
import * as C from '../public/crumbwar/shared/config.js';
import * as P from '../public/crumbwar/shared/proto.js';
import { Predictor } from '../public/crumbwar/shared/predict.js';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const url = arg('url', 'ws://localhost:8799'), key = arg('key', process.env.LOADTEST_KEY || ''), N = Number(arg('clients', 20)), seconds = Number(arg('seconds', 30));
const room = 'lt-' + arg('room', Math.random().toString(36).slice(2, 8)), cap = arg('cap', String(Math.min(240, N)));
const pct = (list, p) => list.length ? list.sort((a, b) => a - b)[Math.min(list.length - 1, list.length * p | 0)] : 0;
const clients = [], gaps = [], rtts = [], fixes = [], replays = [], lag = [], closes = {};
let joined = 0, refused = 0, bytes = 0, snaps = 0, skipped = 0, measuring = false;

function client(i) {
  const c = { ws: new WebSocket(`${url}/crumbwar/play?lt=${key}&room=${room}&cap=${cap}${arg('burn', '') ? '&burn=' + arg('burn') : ''}`), p: null, ants: new Map(), food: new Map(), lastAt: 0, lastTick: 0, angle: Math.random() * 256 | 0, move: true, sprint: false, until: 0, pings: new Map(), n: 0 };
  c.ws.binaryType = 'arraybuffer';
  c.ws.onerror = () => {};
  c.ws.onclose = e => { if (!c.p) refused++; closes[e.code] = (closes[e.code] || 0) + 1; c.p = null; };
  c.ws.onmessage = e => {
    const r = new P.Reader(e.data), type = r.u8(), now = performance.now();
    if (measuring) bytes += e.data.byteLength;
    if (type === P.WELCOME) { P.readWelcome(r); c.p = new Predictor(); joined++; }
    else if (type === P.SNAP && c.p) {
      const s = P.readSnap(r, c.ants, c.food, C.POS_Q, C.OWN_Q);
      c.p.onSnap(s);
      if (measuring) {
        snaps++; if (c.lastAt) gaps.push(now - c.lastAt);
        if (c.lastTick && s.tick - c.lastTick !== C.SNAP_EVERY) skipped++;
        if (s.alive) { fixes.push(c.p.corrected); replays.push(c.p.replayed); }
      }
      c.lastAt = now; c.lastTick = s.tick;
    } else if (type === P.PONG) { const n = r.u16(), at = c.pings.get(n); if (at && measuring) rtts.push(now - at); c.pings.delete(n); }
  };
  clients.push(c);
}
for (let i = 0; i < N; i++) setTimeout(() => client(i), i * 25); // 40 joins a second

let due = performance.now() + 50, ticks = 0;
const loop = setInterval(() => {
  const now = performance.now();
  if (measuring) lag.push(Math.max(0, now - due));
  while (due <= now) {
    due += 50; ticks++;
    for (const c of clients) {
      if (!c.p || c.ws.readyState !== 1) continue;
      if (ticks >= c.until) { c.angle = Math.random() * 256 | 0; c.sprint = Math.random() < 0.2; c.move = Math.random() < 0.95; c.until = ticks + 6 + Math.random() * 30; }
      const out = c.p.step(c.angle, c.move, c.sprint);
      if (out) c.ws.send(out);
      if (ticks % 40 === clients.indexOf(c) % 40) { c.n = c.n + 1 & 0xffff; c.pings.set(c.n, performance.now()); c.ws.send(P.writePing(c.n, c.lastTick)); }
    }
  }
}, 5);

const warm = N * 25 + 4000;
setTimeout(() => { measuring = true; }, warm);
setTimeout(async () => {
  clearInterval(loop); measuring = false;
  let stats = null;
  try { stats = await (await fetch(`${url.replace(/^ws/, 'http')}/crumbwar/api/status?lt=${key}&room=${room}`)).json(); } catch (e) { stats = { error: String(e) }; }
  const alive = clients.filter(c => c.p && c.ws.readyState === 1).length, f = v => Number(v.toFixed(1));
  console.log(JSON.stringify({
    target: url, room, asked: N, joined, refused, stillConnected: alive, seconds,
    bytesPerClientPerSecond: Math.round(bytes / Math.max(1, alive) / seconds), snapshotsPerClientPerSecond: f(snaps / Math.max(1, alive) / seconds),
    snapshotGapMs: { p50: f(pct(gaps, 0.5)), p99: f(pct(gaps, 0.99)), max: f(pct(gaps, 1)) }, snapshotsOutOfStep: skipped,
    roundTripMs: { p50: f(pct(rtts, 0.5)), p99: f(pct(rtts, 0.99)) },
    predictionCorrectionUnits: { p50: f(pct(fixes, 0.5)), p99: f(pct(fixes, 0.99)), max: f(pct(fixes, 1)) }, replayedTicks: { p50: pct(replays, 0.5), p99: pct(replays, 0.99) },
    loadGeneratorLagMs: { p99: f(pct(lag, 0.99)), max: f(pct(lag, 1)) }, closes, roomCounters: stats,
  }, null, 1));
  for (const c of clients) try { c.ws.close(); } catch {}
  setTimeout(() => process.exit(0), 500);
}, warm + seconds * 1000);
