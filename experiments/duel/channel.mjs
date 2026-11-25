// Test only (bots.mjs): two phones playing one duel by link through a pretend network, on a virtual clock.
// Each phone runs the page's own lockstep code (kit/lockstep.js through net.js `drive`), with a bot for a thumb.
// The network delays every frame by `latency` ms plus up to `jitter` ms (so frames overtake each other), drops a share
// of them, and can cut the line for a while; after a cut both phones resend from the friend's last confirmation, as the
// page does when its socket comes back. Nothing here is used by the page.
import { createMatch, step, useMath } from './sim.js';
import { makeBot } from './brain.js';
import { lockstep } from '../kit/lockstep.js';
import { sameMath } from '../kit/samemath.js';
import { drive, stateHash, MSG, hold as fillHold, adaptFor } from './net.js';

export function mulberry(seed) { let r = seed >>> 0 || 1; return () => { r = (r + 0x6D2B79F5) >>> 0; let t = Math.imul(r ^ (r >>> 15), r | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// opts: seed, only, intro, delay (ticks), latency, jitter, drop (0..1), cut ([from, to] ms or null), bots ([name, name]),
// hz ([a, b] frame rates), skew (test-only mutation: phone 1 files the friend's inputs this many ticks late), limit (ms),
// adapt (each phone moves its own delay as the page does; false keeps it fixed), hold (ms the host waits after its "go"
// before stepping, as the page does: half the round trip it measured; default the true half round trip)
export function linkMatch({ seed = 1, only = null, intro = 3, delay = 6, latency = 40, jitter = 0, drop = 0, cut = null, bots = ['medium', 'medium'],
  hz = [60, 60], skew = 0, kinds = null, limit = 600_000, sendMs = 50, net = 1, adapt = true, hold = latency + jitter / 2 } = {}) {
  useMath(sameMath);
  const rnd = mulberry(seed * 7919 + net);
  const start = [hold, latency + rnd() * jitter]; // the guest starts when the host's "go" arrives; the host waits `hold`
  const phones = [0, 1].map(me => {
    const p = { me, s: createMatch({ seed, only, intro, kinds }), ls: lockstep({ id: 1, delay, adapt: adapt ? adaptFor(delay) : null, fill: fillHold }), bot: makeBot(bots[me], seed * 2 + me),
      acc: 0, next: start[me], last: start[me], sentAt: -1e9, hashes: [], pairs: [], stalls: 0, stalledMs: 0, sampled: new Map(), felt: [], stepped: 0, playMs: 0, playTicks: 0 };
    p.onTick = (mine, theirs) => {
      p.s.events.length = 0; p.hashes.push(stateHash(p.s)); p.pairs.push(me === 0 ? [mine, theirs] : [theirs, mine]);
      const t = p.ls.tick - 1; if (p.sampled.has(t)) { p.felt.push(now - p.sampled.get(t)); p.sampled.delete(t); }
    };
    return p;
  });
  const wire = [];
  let now = 0, sent = 0, lost = 0, maxChars = 0, maxInts = 0, perSecond = 0;
  const window = [[], []];
  const send = (from, ints) => {
    const text = JSON.stringify({ t: 'r', d: ints }); maxChars = Math.max(maxChars, text.length); maxInts = Math.max(maxInts, ints.length);
    const w = window[from]; w.push(now); while (w[0] <= now - 1000) w.shift(); perSecond = Math.max(perSecond, w.length);
    sent++;
    if ((cut && now >= cut[0] && now < cut[1]) || rnd() < drop) { lost++; return; }
    wire.push({ at: now + latency + rnd() * jitter, to: 1 - from, ints });
  };
  while (now < limit && !(phones[0].s.over && phones[1].s.over)) {
    for (let i = wire.length - 1; i >= 0; i--) if (wire[i].at <= now) {
      const { to, ints } = wire.splice(i, 1)[0], p = phones[to];
      if (cut && now >= cut[0] && now < cut[1]) continue;           // in flight when the line went down
      if (ints[0] !== MSG.input) continue;
      const frame = ints.slice(1);
      if (skew && to === 1) frame[4] += skew;                         // MUTATION: the friend's inputs filed at the wrong tick
      p.ls.receive(frame, now);
    }
    if (cut && now === cut[1]) for (const p of phones) p.ls.resend();  // both sockets are back
    for (const p of phones) {
      if (now < p.next || p.s.over) continue;
      const dt = (now - p.last) / 1000; p.last = now; p.next = now + 1000 / hz[p.me];
      const before = p.ls.tick, playing = p.s.phase === 'play';
      const r = drive(p, Math.min(0.1, p.acc + dt), () => { p.sampled.set(p.ls.tick + p.ls.delay, now); return p.bot.act(p.s, p.me); });
      p.acc = r.acc;
      if (r.stalled) { p.stalledMs += dt * 1000; if (p.ls.waited(now, true) === 0) p.stalls++; } else p.ls.waited(now, false);
      if (playing) { p.playMs += dt * 1000; p.playTicks += p.ls.tick - before; }
      if (now - p.sentAt >= sendMs) { const f = p.ls.frame(now); if (f) { send(p.me, [MSG.input, ...f]); p.sentAt = now; } }
    }
    now += 1;
  }
  useMath(Math);
  const [a, b] = phones, n = Math.min(a.hashes.length, b.hashes.length);
  let firstDiff = -1; for (let i = 0; i < n; i++) if (a.hashes[i] !== b.hashes[i]) { firstDiff = i; break; }
  return {
    phones, now, sent, lost, maxChars, maxInts, perSecond, firstDiff, ticks: [a.hashes.length, b.hashes.length],
    same: firstDiff < 0 && a.hashes.length === b.hashes.length && JSON.stringify(a.s.duels) === JSON.stringify(b.s.duels) && a.s.winner === b.s.winner,
    over: a.s.over && b.s.over, mismatch: [a.ls.mismatch, b.ls.mismatch],
    speed: phones.map(p => p.playMs ? p.playTicks / (p.playMs / 1000) / 60 : 1),
    stalls: phones.map(p => p.stalls), delays: phones.map(p => p.ls.delay),
    felt: phones.map(p => { const f = [...p.felt].sort((x, y) => x - y); return f.length ? { med: f[f.length >> 1], p90: f[Math.floor(f.length * 0.9)] } : null; }),
  };
}

// Replays the inputs one phone applied, in a fresh sim with no network: the result must match what both phones saw.
export function replay({ seed, only, intro = 3, kinds = null }, pairs) {
  useMath(sameMath);
  const s = createMatch({ seed, only, intro, kinds });
  const hashes = [];
  for (const inp of pairs) { if (s.over) break; step(s, inp); s.events.length = 0; hashes.push(stateHash(s)); }
  useMath(Math);
  return { s, hashes };
}
