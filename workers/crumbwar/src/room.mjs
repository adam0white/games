// One room: one world, one tick loop, up to HUMAN_CAP people. The Durable Object is the only writer of the
// world, so there is no locking and no cheating by racing. Nothing is stored: a room's state lives in memory
// and is thrown away when the last person leaves or the code is redeployed. See DECISIONS.md.
import { DurableObject } from 'cloudflare:workers';
import { getMode, snapshotEvery } from '../public/crumbwar/shared/modes.js';
import * as C from '../public/crumbwar/shared/config.js';
import * as P from '../public/crumbwar/shared/proto.js';
import { createWorld, step, addAnt, removeAnt, setInput } from './sim.mjs';
import { think, balance, pickColony } from './bots.mjs';
import * as net from './net.mjs';
import { STALE_ROOM_STATUS } from '../public/crumbwar/shared/version.js';
import { ROOM_COUNTS, delta } from './metrics.mjs';

const TICK_MS = 1000 / C.TICK_HZ;
const PER_IP = 4, MSG_RATE = 1.5, MSG_BURST = 60; // messages: 30 a second sustained, per connection
const MARK_TICKS = 60 * C.TICK_HZ, WINDOW_MS = 2000, SLOW_MS = 200, SLOW_EVERY_MS = 60_000;
const IDLE_TICKS = 90 * C.TICK_HZ, LAG_TICKS = 8 * C.TICK_HZ, GHOST_TICKS = 30 * C.TICK_HZ, EMPTY_TICKS = 5 * C.TICK_HZ;

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.world = null; this.clients = new Map(); this.ghosts = new Map(); this.timer = null; this.name = ''; this.mode = null; this.cap = 0; this.burn = 0;
    this.stat = { wakes: 0, late10: 0, late50: 0, maxLate: 0, dropped: 0, bytesOut: 0, msgsOut: 0, msgsIn: 0, kicks: 0, quietMax: 0, stallMax: 0, slowWindows: 0 };
    for (const k of ROOM_COUNTS) this.stat[k] = 0; // joins, kicks by reason, refusals by reason: see metrics.mjs
    this.sent = {}; // the counts as last reported to the directory
    // A running room leaves a mark in storage and removes it when it stops by itself. A mark found here means the
    // memory was lost while the room ran: Cloudflare reset it for using too much CPU, moved it, or new code was
    // deployed. The mark names the code version, so a deploy is told apart from a reset. See DECISIONS.md, "Alerts".
    this.version = env.VERSION?.id || 'dev';
    try {
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS mark (k TEXT PRIMARY KEY, v TEXT)');
      const row = ctx.storage.sql.exec("SELECT v FROM mark WHERE k = 'run'").toArray()[0];
      if (row) {
        ctx.storage.sql.exec('DELETE FROM mark');
        const m = JSON.parse(row.v), deploy = m.version !== this.version;
        this.alert(deploy ? 'room_redeployed' : 'room_lost', m.name, { people: m.people, ticksPerSecond: m.rate, markAgeSeconds: Math.round((Date.now() - m.at) / 1000) }, m.mode || 'classic');
      }
    } catch {}
    // A socket that outlived the memory it belonged to has no ant. Close it; the page joins again.
    for (const ws of ctx.getWebSockets()) try { ws.close(4002, 'restart'); } catch {}
  }

  people() { return this.clients.size; }

  // One line in Workers Logs, one point in Analytics Engine and, for the kinds a person should hear about, one row
  // in the alerts list that the watch job reads. Nothing here names a player or an address.
  alert(kind, room, detail, mode = this.mode || 'classic') {
    detail = { ...detail, mode };
    const test = String(room || '').startsWith('lt-');
    try { console[kind === 'room_redeployed' ? 'log' : 'error'](JSON.stringify({ event: kind, room, test, ...detail })); } catch {}
    try { this.env.METRICS?.writeDataPoint({ indexes: [kind], blobs: [kind, room || '', this.version, mode], doubles: [detail.people || 0, detail.ticksPerSecond || 0] }); } catch {}
    if (kind !== 'room_redeployed') this.ctx.waitUntil(this.env.DIRECTORY.getByName('alerts').alert(kind, room || '', test, JSON.stringify(detail)).catch(() => {}));
  }
  mark() {
    const w = this.world;
    try {
      if (w) this.ctx.storage.sql.exec("INSERT OR REPLACE INTO mark VALUES ('run', ?)", JSON.stringify({ name: this.name, mode: this.mode, version: this.version, at: Date.now(), people: this.people(), rate: this.rate ?? C.TICK_HZ }));
      else this.ctx.storage.sql.exec('DELETE FROM mark');
    } catch {}
  }

  async fetch(request) {
    const q = new URL(request.url).searchParams, trusted = q.get('trusted') === '1', ip = q.get('ip') || '?';
    const mode = q.has('mode') ? q.get('mode') : 'classic';
    if (!getMode(mode) || getMode(mode).enabled === false) return new Response('unknown mode', { status: 400 });
    if (this.mode && this.mode !== mode) return new Response('mode', { status: STALE_ROOM_STATUS });
    this.mode ||= mode;
    this.name ||= q.get('name');
    if (!this.cap || trusted && q.get('cap')) this.cap = Math.min(240, Number(trusted && q.get('cap') || this.env.HUMAN_CAP || 60));
    // A load test may ask for wasted work on every tick, to show what an overloaded room looks like in the counters.
    if (trusted && q.get('burn')) this.burn = Math.min(500, Number(q.get('burn')) || 0) * 1e6;
    // The Worker sends its protocol. A room still running other code after a deploy takes no new people; the
    // report tells the directory to stop offering it. People already here play on. See DECISIONS.md, "Version check".
    if (q.get('v') && Number(q.get('v')) !== C.PROTO) { this.stat.refusedProtocol++; this.report(); return new Response('protocol', { status: STALE_ROOM_STATUS }); }
    if (this.people() >= this.cap) { this.stat.refusedFull++; return new Response('full', { status: 409 }); }
    if (!trusted) { let n = 0; for (const c of this.clients.values()) if (c.ip === ip) n++; if (n >= PER_IP) { this.stat.refusedIp++; return new Response('too many from one address', { status: 429 }); } }
    const saved = this.ghosts.get(q.get('resume') || '');
    const ghost = saved && saved.round === this.world?.round ? saved : null;
    if (q.get('resume') && !ghost && q.get('explicit') === '1') { this.stat.refusedGone++; return new Response('gone', { status: 410 }); }
    const w = this.world ??= this.fresh();
    this.minuteTick ??= w.tick;
    const a = addAnt(w, ghost ? ghost.colony : pickColony(w), false, Math.random() * C.NAMES_A.length | 0, Math.random() * C.NAMES_B.length | 0);
    if (!a) return new Response('full', { status: 409 });
    if (ghost) { this.ghosts.delete(q.get('resume')); Object.assign(a, ghost.keep); a.hp = C.TIER_HP[a.tier]; }
    balance(w);
    const pair = new WebSocketPair(), ws = pair[1], t = crypto.getRandomValues(new Uint32Array(2));
    this.ctx.acceptWebSocket(ws);
    const client = { ws, ant: a, view: net.newView(), ackSeq: 0, tokens: MSG_BURST, tokenTick: w.tick, changed: w.tick, seen: w.tick, pinged: w.tick, joined: w.tick, ip, token: t[0].toString(16).padStart(8, '0') + t[1].toString(16).padStart(8, '0') };
    a.client = client; this.clients.set(ws, client); this.stat.joins++;
    this.send(client, net.welcome(a, w.tick, t[0], t[1], this.name, this.mode));
    this.start(); this.report();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  fresh() {
    const w = createWorld(crypto.getRandomValues(new Uint32Array(1))[0], this.mode);
    balance(w);
    for (let i = 0; i < 200; i++) { for (const a of w.ants) if (a) think(w, a); step(w); } // ten seconds, so nobody joins a world at rest
    return w;
  }

  send(client, bytes) {
    try { client.ws.send(bytes); this.stat.bytesOut += bytes.length; this.stat.msgsOut++; } catch { if (this.clients.has(client.ws)) this.stat.sendFailed++; this.drop(client.ws, 0); }
  }
  // `reason` is one of the kick counters in metrics.mjs (kickIdle, kickNoPing, ...); the close code alone is shared by several.
  kick(client, code, why, reason) { this.stat.kicks++; this.stat[reason]++; try { client.ws.close(code, why); } catch {} this.drop(client.ws, 0); }

  drop(ws, ghostFor = GHOST_TICKS) {
    const client = this.clients.get(ws);
    if (!client) return;
    this.clients.delete(ws);
    const w = this.world, a = client.ant;
    if (!w) return;
    if (ghostFor) {
      const keep = {};
      for (const key of ['score', 'delivered', 'kills', 'deaths', 'tier', 'nameA', 'nameB', 'mass', 'rank', 'bestRank', 'roundDelivered', 'deliveries', 'goal', 'goalProgress', 'goalIndex', 'goalSince', 'hillTicks', 'golden']) {
        if (a[key] !== undefined) keep[key] = structuredClone(a[key]);
      }
      this.ghosts.set(client.token, { colony: a.colony, round: w.round, until: w.tick + ghostFor, keep });
    }
    removeAnt(w, a); balance(w); this.report();
    if (!this.people()) this.emptyAt = w.tick;
  }

  webSocketMessage(ws, data) {
    const client = this.clients.get(ws), w = this.world;
    if (!client || !w) return;
    this.stat.msgsIn++;
    // An incoming message carries a fresh clock, which a timer on Cloudflare does not. Two measures come from it:
    // the longest silence between messages, and how far the ticks fell behind real time in a two second window. Two slow windows in a row raise an alert; one
    // alone does not, because a room's first second is always slow.
    const now = Date.now(), s = this.stat;
    if (this.heardAt && now - this.heardAt > s.quietMax) s.quietMax = now - this.heardAt;
    this.heardAt = now;
    if (!this.winAt) { this.winAt = now; this.winTick = w.tick; }
    else if (now - this.winAt >= WINDOW_MS) {
      const behind = now - this.winAt - (w.tick - this.winTick) * TICK_MS;
      this.rate = Math.round((w.tick - this.winTick) / (now - this.winAt) * 10000) / 10;
      if (behind > s.stallMax) s.stallMax = Math.round(behind);
      const slow = behind > SLOW_MS, again = slow && this.wasSlow;
      this.wasSlow = slow;
      if (slow) {
        s.slowWindows++;
        if (again && now - (this.slowAt || 0) > SLOW_EVERY_MS) { this.slowAt = now; this.alert('room_slow', this.name, { people: this.people(), ticksPerSecond: this.rate, behindMs: Math.round(behind) }); }
      }
      this.winAt = now; this.winTick = w.tick;
    }
    client.tokens = Math.min(MSG_BURST, client.tokens + (w.tick - client.tokenTick) * MSG_RATE) - 1; client.tokenTick = w.tick;
    if (typeof data === 'string') return this.kick(client, 1008, 'bad message', 'kickText');
    if (data.byteLength > 8) return this.kick(client, 1008, 'bad message', 'kickSize');
    if (client.tokens < 0) return this.kick(client, 1008, 'bad message', 'kickRate');
    const b = new Uint8Array(data);
    if (b[0] === P.INPUT && b.length === 5) {
      const a = client.ant, angle = b[3], move = !!(b[4] & 1), sprint = !!(b[4] & 2);
      if (angle !== a.angle || move !== a.move || sprint !== a.sprint) client.changed = w.tick;
      // Every input restarts the count of ticks it has applied to, which is what the page replays from.
      setInput(w, a, angle, move, sprint); client.ackSeq = b[1] | b[2] << 8;
    } else if (b[0] === P.PING && b.length === 7) {
      client.seen = (b[3] | b[4] << 8 | b[5] << 16 | b[6] << 24) >>> 0; client.pinged = w.tick;
      this.send(client, net.pong(b[1] | b[2] << 8));
    } else this.kick(client, 1008, 'bad message', 'kickType');
  }
  webSocketClose(ws) { if (this.clients.has(ws)) this.stat.closedByClient++; this.drop(ws); }
  webSocketError(ws) { if (this.clients.has(ws)) this.stat.socketErrors++; this.drop(ws); }

  start() {
    if (this.timer !== null) return;
    this.next = Date.now() + TICK_MS;
    this.t0 = Date.now(); this.tick0 = this.world.tick; // start() runs inside a join, where the clock is real
    this.winAt = 0; this.heardAt = 0; this.wasSlow = false;
    const wake = () => {
      const now = Date.now(), late = now - this.next, s = this.stat;
      s.wakes++; if (late > 10) s.late10++; if (late > 50) s.late50++; if (late > s.maxLate) s.maxLate = late;
      let steps = 0;
      while (this.next <= now && steps < 3) { this.tick(); this.next += TICK_MS; steps++; }
      if (this.next <= now) { s.dropped += Math.ceil((now - this.next) / TICK_MS); this.next = now + TICK_MS; } // too far behind: skip, do not spiral
      this.timer = this.world ? setTimeout(wake, Math.max(0, this.next - Date.now())) : null;
    };
    this.timer = setTimeout(wake, TICK_MS);
  }

  tick() {
    const w = this.world;
    if (!w) return;
    for (const a of w.ants) if (a && a.bot) think(w, a);
    step(w);
    if (this.burn) { let x = 0; for (let i = 0; i < this.burn; i++) x += Math.sqrt(i); this.burned = x; }
    const tick = w.tick;
    for (const [type, x, y] of w.events) {
      if (type === 1) {
        const killer = x === 255 ? null : w.ants[x], victim = w.ants[y];
        if (killer?.client && victim) this.send(killer.client, net.event(1, victim.nameA, victim.nameB, victim.colony));
        if (victim?.client) this.send(victim.client, killer ? net.event(4, killer.nameA, killer.nameB, killer.colony) : net.event(4, 255, 255, 255));
      } else for (const c of this.clients.values()) this.send(c, net.event(type, x, 0, 0));
    }
    for (const c of this.clients.values()) if ((tick + c.ant.id) % snapshotEvery(w.rules, w.count) === 0) this.send(c, net.snapshot(w, c.ant, c.view, c.ackSeq));
    if (tick % C.TICK_HZ === 0) {
      const ranked = w.ants.filter(Boolean).sort((p, q) => q.score - p.score), people = this.people();
      for (const c of [...this.clients.values()]) {
        if (tick - c.changed > IDLE_TICKS) this.kick(c, 4003, 'idle', 'kickIdle');
        // It is not reading what it is sent: either its pings stopped, or they arrive and name a tick 8 s old.
        else if (tick - c.joined > LAG_TICKS && tick - c.seen > LAG_TICKS) this.kick(c, 4004, 'lagging', tick - c.pinged > LAG_TICKS ? 'kickNoPing' : 'kickBehind');
        else this.send(c, net.scores(w, ranked, c.ant, people));
      }
      for (const [token, g] of this.ghosts) if (tick > g.until) this.ghosts.delete(token);
      if (tick % MARK_TICKS === 0) {
        const s = this.stat, last = this.sampled || {}, d = k => (s[k] || 0) - (last[k] || 0);
        // Doubles 1-7 are unchanged from before; 8-14 were added for kick reasons. Each is a change over the minute
        // except people, ants, the tick rate, stallMax and quietMax. Analytics Engine takes up to 20 doubles.
        try { this.env.METRICS?.writeDataPoint({ indexes: ['room'], blobs: ['room', this.name, this.version, this.mode], doubles: [people, w.count, this.rate ?? C.TICK_HZ, d('bytesOut'), d('msgsIn'), s.stallMax, s.quietMax,
          d('kickIdle'), d('kickNoPing'), d('kickBehind'), d('kickText') + d('kickSize') + d('kickRate') + d('kickType'), d('sendFailed'), d('closedByClient') + d('socketErrors'), d('joins')] }); } catch {}
        this.sampled = { ...s };
        this.report({ roomMinutes: this.minutes(), ...delta(s, this.sent) });
      } else if (tick % (15 * C.TICK_HZ) === 0) this.report();
      if (!this.people() && tick - this.emptyAt > EMPTY_TICKS) { this.report({ roomMinutes: this.minutes(), ...delta(this.stat, this.sent) }); this.world = null; this.minuteTick = null; this.ghosts.clear(); this.mark(); } // the loop ends; the room costs nothing
    }
  }

  // Minutes this room ran since the last report of them, to two decimals.
  minutes() { const t = this.world.tick, m = Math.round((t - this.minuteTick) / MARK_TICKS * 100) / 100; this.minuteTick = t; return m; }

  // On every join and leave and every 15 seconds: the head count and protocol, for the directory and the mark (so an
  // alert about a lost room says how many people it held). Once a minute and when the room stops, also the counts
  // since the last time (`counts`), which the directory adds to its hourly totals. A load test room sends only
  // counts, to `dir:lt`, which never offers rooms.
  report(counts) {
    this.mark();
    if (!this.name) return;
    const lt = this.name.startsWith('lt-');
    if (lt && !counts) return;
    const region = lt ? 'lt' : this.name.split('-')[0];
    const dir = this.env.DIRECTORY.getByName(this.mode === 'classic' ? `dir:${region}` : `dir:${this.mode}:${region}`);
    this.ctx.waitUntil(dir.report(this.name, this.people(), C.PROTO, counts && Object.keys(counts).length ? counts : null).catch(() => {}));
  }

  stats() {
    const w = this.world;
    const s = this.stat, kicksByReason = {};
    for (const k of ROOM_COUNTS) if (k.startsWith('kick') || k === 'sendFailed') kicksByReason[k] = s[k];
    return { room: this.name, mode: this.mode || 'classic', version: this.version, protocol: C.PROTO, running: !!w, kicksByReason, windowTicksPerSecond: this.rate ?? null, tick: w?.tick ?? 0, people: this.people(), ants: w?.count ?? 0, food: w?.foodCount ?? 0, cap: this.cap, ...this.stat,
      // The clock inside a timer does not show lateness on Cloudflare (the late counters stay 0 there), so the honest
      // measure of an overloaded room is ticks per real second, taken at this call, which carries a fresh clock.
      ticksPerSecond: w && this.t0 ? Math.round((w.tick - this.tick0) / Math.max(1, Date.now() - this.t0) * 10000) / 10 : 0 };
  }
}
