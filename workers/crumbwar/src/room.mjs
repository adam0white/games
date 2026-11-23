// One room: one world, one tick loop, up to HUMAN_CAP people. The Durable Object is the only writer of the
// world, so there is no locking and no cheating by racing. Nothing is stored: a room's state lives in memory
// and is thrown away when the last person leaves or the code is redeployed. See DECISIONS.md.
import { DurableObject } from 'cloudflare:workers';
import * as C from '../public/crumbwar/shared/config.js';
import * as P from '../public/crumbwar/shared/proto.js';
import { createWorld, step, addAnt, removeAnt, setInput } from './sim.mjs';
import { think, balance, pickColony } from './bots.mjs';
import * as net from './net.mjs';

const TICK_MS = 1000 / C.TICK_HZ;
const PER_IP = 4, MSG_RATE = 1.5, MSG_BURST = 60; // messages: 30 a second sustained, per connection
const IDLE_TICKS = 90 * C.TICK_HZ, LAG_TICKS = 8 * C.TICK_HZ, GHOST_TICKS = 30 * C.TICK_HZ, EMPTY_TICKS = 5 * C.TICK_HZ;

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.world = null; this.clients = new Map(); this.ghosts = new Map(); this.timer = null; this.name = ''; this.cap = 0;
    this.stat = { wakes: 0, late10: 0, late50: 0, maxLate: 0, dropped: 0, bytesOut: 0, msgsOut: 0, msgsIn: 0, kicks: 0, joins: 0 };
    // A socket that outlived the memory it belonged to has no ant. Close it; the page joins again.
    for (const ws of ctx.getWebSockets()) try { ws.close(4002, 'restart'); } catch {}
  }

  people() { return this.clients.size; }

  async fetch(request) {
    const q = new URL(request.url).searchParams, trusted = q.get('trusted') === '1', ip = q.get('ip') || '?';
    this.name ||= q.get('name');
    if (!this.cap || trusted && q.get('cap')) this.cap = Math.min(240, Number(trusted && q.get('cap') || this.env.HUMAN_CAP || 60));
    if (this.people() >= this.cap) return new Response('full', { status: 409 });
    if (!trusted) { let n = 0; for (const c of this.clients.values()) if (c.ip === ip) n++; if (n >= PER_IP) return new Response('too many from one address', { status: 429 }); }
    const w = this.world ??= this.fresh();
    const ghost = this.ghosts.get(q.get('resume') || '');
    if (q.get('resume') && !ghost && q.get('explicit') === '1') return new Response('gone', { status: 410 });
    const a = addAnt(w, ghost ? ghost.colony : pickColony(w), false, Math.random() * C.NAMES_A.length | 0, Math.random() * C.NAMES_B.length | 0);
    if (!a) return new Response('full', { status: 409 });
    if (ghost) { this.ghosts.delete(q.get('resume')); Object.assign(a, ghost.keep); a.hp = C.TIER_HP[a.tier]; }
    balance(w);
    const pair = new WebSocketPair(), ws = pair[1], t = crypto.getRandomValues(new Uint32Array(2));
    this.ctx.acceptWebSocket(ws);
    const client = { ws, ant: a, view: net.newView(), ackSeq: 0, tokens: MSG_BURST, tokenTick: w.tick, changed: w.tick, seen: w.tick, joined: w.tick, ip, token: t[0].toString(16).padStart(8, '0') + t[1].toString(16).padStart(8, '0') };
    a.client = client; this.clients.set(ws, client); this.stat.joins++;
    this.send(client, net.welcome(a, w.tick, t[0], t[1], this.name));
    this.start(); this.report();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  fresh() {
    const w = createWorld(crypto.getRandomValues(new Uint32Array(1))[0]);
    balance(w);
    for (let i = 0; i < 200; i++) { for (const a of w.ants) if (a) think(w, a); step(w); } // ten seconds, so nobody joins a world at rest
    return w;
  }

  send(client, bytes) {
    try { client.ws.send(bytes); this.stat.bytesOut += bytes.length; this.stat.msgsOut++; } catch { this.drop(client.ws, 0); }
  }
  kick(client, code, why) { this.stat.kicks++; try { client.ws.close(code, why); } catch {} this.drop(client.ws, 0); }

  drop(ws, ghostFor = GHOST_TICKS) {
    const client = this.clients.get(ws);
    if (!client) return;
    this.clients.delete(ws);
    const w = this.world, a = client.ant;
    if (!w) return;
    if (ghostFor) this.ghosts.set(client.token, { colony: a.colony, until: w.tick + ghostFor, keep: { score: a.score, delivered: a.delivered, kills: a.kills, deaths: a.deaths, tier: a.tier, nameA: a.nameA, nameB: a.nameB } });
    removeAnt(w, a); balance(w); this.report();
    if (!this.people()) this.emptyAt = w.tick;
  }

  webSocketMessage(ws, data) {
    const client = this.clients.get(ws), w = this.world;
    if (!client || !w) return;
    this.stat.msgsIn++;
    client.tokens = Math.min(MSG_BURST, client.tokens + (w.tick - client.tokenTick) * MSG_RATE) - 1; client.tokenTick = w.tick;
    if (typeof data === 'string' || data.byteLength > 8 || client.tokens < 0) return this.kick(client, 1008, 'bad message');
    const b = new Uint8Array(data);
    if (b[0] === P.INPUT && b.length === 5) {
      const a = client.ant, angle = b[3], move = !!(b[4] & 1), sprint = !!(b[4] & 2);
      if (angle !== a.angle || move !== a.move || sprint !== a.sprint) client.changed = w.tick;
      // Every input restarts the count of ticks it has applied to, which is what the page replays from.
      setInput(w, a, angle, move, sprint); client.ackSeq = b[1] | b[2] << 8;
    } else if (b[0] === P.PING && b.length === 7) {
      client.seen = (b[3] | b[4] << 8 | b[5] << 16 | b[6] << 24) >>> 0;
      this.send(client, net.pong(b[1] | b[2] << 8));
    } else this.kick(client, 1008, 'bad message');
  }
  webSocketClose(ws) { this.drop(ws); }
  webSocketError(ws) { this.drop(ws); }

  start() {
    if (this.timer !== null) return;
    this.next = Date.now() + TICK_MS;
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
    const tick = w.tick;
    for (const [type, x, y] of w.events) {
      if (type === 1) {
        const killer = x === 255 ? null : w.ants[x], victim = w.ants[y];
        if (killer?.client && victim) this.send(killer.client, net.event(1, victim.nameA, victim.nameB, victim.colony));
        if (victim?.client) this.send(victim.client, killer ? net.event(4, killer.nameA, killer.nameB, killer.colony) : net.event(4, 255, 255, 255));
      } else for (const c of this.clients.values()) this.send(c, net.event(type, x, 0, 0));
    }
    for (const c of this.clients.values()) if ((tick + c.ant.id) % C.SNAP_EVERY === 0) this.send(c, net.snapshot(w, c.ant, c.view, c.ackSeq));
    if (tick % C.TICK_HZ === 0) {
      const ranked = w.ants.filter(Boolean).sort((p, q) => q.score - p.score), people = this.people();
      for (const c of [...this.clients.values()]) {
        if (tick - c.changed > IDLE_TICKS) this.kick(c, 4003, 'idle');
        else if (tick - c.joined > LAG_TICKS && tick - c.seen > LAG_TICKS) this.kick(c, 4004, 'lagging'); // it is not reading what it is sent
        else this.send(c, net.scores(w, ranked, c.ant, people));
      }
      for (const [token, g] of this.ghosts) if (tick > g.until) this.ghosts.delete(token);
      if (tick % (15 * C.TICK_HZ) === 0) this.report();
      if (!this.people() && tick - this.emptyAt > EMPTY_TICKS) { this.world = null; this.ghosts.clear(); } // the loop ends; the room costs nothing
    }
  }

  report() {
    if (!this.name || this.name.startsWith('lt-')) return;
    const dir = this.env.DIRECTORY.getByName('dir:' + this.name.split('-')[0]);
    this.ctx.waitUntil(dir.report(this.name, this.people()).catch(() => {}));
  }

  stats() {
    const w = this.world;
    return { room: this.name, running: !!w, tick: w?.tick ?? 0, people: this.people(), ants: w?.count ?? 0, food: w?.foodCount ?? 0, cap: this.cap, ...this.stat };
  }
}
