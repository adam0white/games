// The war build over a wire: an order as a short list of integers, and a host that steps the sim only on ticks the
// friends' room has sealed (workers/cinderhill: one clock, one order of commands for every player).
// No game rule lives here. An order made on one phone is applied on every phone from the sealed frame, its own included.

import { Host, TICK_MS } from './host.js';
import { act, THINK_EVERY } from './ai.js';
import { MISSIONS } from './tables.js';

export const WIRE = 2; // raise when two pages of different code could not share a room
export const START = 0, HELLO = -1; // wire-only types: the match begins on the next room tick; a seat says which colony it plays
const SCALARS = ['team', 'trail', 'level', 'kind', 'on', 'mode', 'x', 'y', 'special', 'hold', 'craft', 'caste', 'share', 'dig', 'branch'];
const LISTS = ['points', 'cells', 'under'];

/** An order to integers: [type, mask of the fields present, their values, then each list as its length and items]. */
export function encodeOrder(o) {
  const out = [o.type | 0, 0];
  SCALARS.forEach((k, i) => { const v = o[k]; if (v === undefined || v === null) return; out[1] |= 1 << i; out.push(v === true ? 1 : v === false ? 0 : v | 0); });
  for (const k of LISTS) { const a = o[k]; if (!a) { out.push(-1); continue; } out.push(a.length); for (let j = 0; j < a.length; j++) out.push(a[j] | 0); }
  return out;
}
export function decodeOrder(ints, at = 0) {
  const o = { type: ints[at] }, mask = ints[at + 1]; let j = at + 2;
  SCALARS.forEach((k, i) => { if (mask & (1 << i)) o[k] = ints[j++]; });
  for (const k of LISTS) { const n = ints[j++]; if (n < 0) continue; o[k] = Array.from(ints.slice(j, j + n)); j += n; }
  return o;
}

const DELAY = 2; // ticks ahead an order asks for; the room moves a late one to its next open tick
const HASH_EVERY = 20; // the room's (workers/cinderhill/src/protocol.mjs)
const BOT_IDS = 1 << 28; // orders the machine makes inside the sim loop take ids no seat uses

/**
 * A Host for a room. `send(text)` posts to the room; feed `welcome(m)`, `sealed({ through, commands })`, `ack(m)` from it.
 * options: the sim's, with ai: { [team]: mind } for colonies every phone lets the machine play.
 * `bot`: { team, mind } makes this seat a machine player whose orders travel the wire like a person's.
 */
export class NetHost {
  constructor(options, { send, team = 0, bot = null, onStart = () => {}, onSeats = () => {} } = {}) {
    this.inner = new Host(options); this.inner.nextOrder = BOT_IDS;
    this.send = send; this.team = team; this.bot = bot; this.onStart = onStart; this.onSeats = onSeats;
    this.seat = 0; this.nextId = 1; this.unacked = new Map();
    this.through = -1; this.startAt = -1; this.byTick = new Map(); this.seats = new Map(); // seat -> team
    this.acc = 0; this.behind = 0; this.desync = null; this.saidHello = false;
  }
  get sim() { return this.inner.sim; } get ai() { return this.inner.ai; } get alpha() { return this.inner.alpha; }
  get px() { return this.inner.px; } get py() { return this.inner.py; } get pid() { return this.inner.pid; } get pl() { return this.inner.pl; } get pn() { return this.inner.pn; }
  get log() { return this.inner.log; } get hashes() { return this.inner.hashes; }
  get started() { return this.startAt >= 0; }
  /** The room tick the sim's next step belongs to. */
  get roomTick() { return this.startAt + 1 + this.sim.tick; }
  /** The next room tick this page needs, for the join's `have`. */
  get have() { return this.through + 1; }

  welcome(m) { this.seat = m.seat; for (const text of this.unacked.values()) this.send(text); if (!this.saidHello) { this.saidHello = true; this.post([HELLO, this.team, this.bot ? 1 : 0]); } }
  ack(m) { this.unacked.delete(m.id); }
  post(ints) { const id = this.nextId++, text = JSON.stringify({ t: 'cmd', id, tick: this.through + 1 + DELAY, cmd: { ints } }); this.unacked.set(id, text); this.send(text); return id; }
  begin() { if (!this.started) this.post([START]); }
  /** An order from this seat. The id is the one its REJECTED event will carry. */
  order(o) { const id = this.post(encodeOrder({ ...o, team: this.team })); return id * 4 + this.seat; }

  sealed(f) {
    let seats = false, began = false; // the page hears of these after the frame is filed, so a fault there loses no order
    for (const c of f.commands) {
      const tick = c[0], seat = c[1], id = c[2], type = c[3];
      if (tick <= this.through) continue; // sent again after a reconnect
      if (type === HELLO) { this.seats.set(seat, { team: c[4], bot: c[5] === 1 }); seats = true; continue; }
      if (type === START) { if (this.startAt < 0) { this.startAt = tick; began = true; } continue; }
      if (this.startAt < 0 || tick <= this.startAt) continue; // an order before the match began
      const o = decodeOrder(c, 3); o.id = id * 4 + seat;
      let q = this.byTick.get(tick); if (!q) this.byTick.set(tick, q = []); q.push(o);
    }
    if (f.through > this.through) this.through = f.through;
    if (seats) this.onSeats(this.seats);
    if (began) this.onStart();
  }

  /** Steps the sim one tick if the room has sealed it. */
  step() {
    const s = this.sim, r = this.roomTick;
    if (this.startAt < 0 || r > this.through || s.result) return false;
    const q = this.byTick.get(r);
    if (q) { for (const o of q) s.order({ ...o, tick: s.tick }); this.byTick.delete(r); }
    if (this.bot && s.tick % THINK_EVERY === 0) for (const o of act(s, this.bot.team, this.bot.mind)) this.order(o);
    this.inner.tick();
    if (r % HASH_EVERY === 0) this.send(JSON.stringify({ t: 'hash', tick: r, h: s.hash() | 0 }));
    return true;
  }

  /** Advance by real time. The room sets the pace: a page that is behind runs up to `max` ticks a call to catch up. */
  advance(ms, _speed = 1, max = 8) {
    if (this.sim.result) { this.inner.alpha = 1; return 0; }
    this.behind = this.startAt < 0 ? 0 : this.through - this.roomTick + 1;
    this.acc += ms; let ran = 0;
    const far = this.behind > 40, cap = far ? Math.max(max, 400) : max;
    /* a page more than two ticks behind the room runs extra ticks, so an order is never seen late for long */
    while ((far || this.acc >= TICK_MS || this.through - this.roomTick + 1 > 2) && ran < cap && this.step()) { if (!far && this.acc >= TICK_MS) this.acc -= TICK_MS; ran++; }
    if (far || this.acc > TICK_MS) this.acc = Math.min(this.acc, TICK_MS);
    this.inner.alpha = this.behind > 0 ? Math.min(1, this.acc / TICK_MS) : 1;
    return ran;
  }
  run(n) { for (let k = 0; k < n; k++) if (!this.step()) break; return this; }
  drain() { return this.inner.drain(); }
}

/** The room's sealed frame (workers/cinderhill/src/protocol.mjs, PROTO 1): every tick up to `through`, with the commands of the ticks it covers. */
/** Everything that shapes a room's sim comes from its link, so a page and a script build the same world. */
export const roomSeed = code => 1 + [...String(code).toUpperCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);
/** One number for the code version and the link's rules: the room sends away a page whose number differs,
 *  so two links that would build different worlds can never share a room. */
export const roomSim = ({ mission, bot = null, botSide = 1 }) => WIRE * 100000 + [...`${mission}|${bot}|${bot === null ? '' : botSide === 0 ? 0 : 1}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 99991, 7);
export function roomOptions({ code, mission, bot = null, botSide = 1 }) {
  return { seed: roomSeed(code), mission, ...(MISSIONS[mission]?.long ? { duskTick: 24000, truce: 9600 } : {}), ai: bot === null ? {} : { [botSide === 0 ? 0 : 1]: { mood: bot, natural: true } } }; // a room's machine rival always has a person's manners
}

export const PROTO = 1;
export function decodeSealed(buf) {
  const dv = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer, buf.byteOffset ?? 0, buf.byteLength);
  if (dv.getUint8(0) !== 1) throw new Error('not a sealed frame');
  const through = dv.getUint32(1, true), n = dv.getUint16(5, true), commands = [];
  let at = 7;
  for (let k = 0; k < n; k++) { const len = dv.getUint16(at, true); at += 2; const c = new Int32Array(len); for (let j = 0; j < len; j++, at += 4) c[j] = dv.getInt32(at, true); commands.push(c); }
  return { through, commands };
}

/** Keeps a page joined to its room: connects, hands the room's messages to the host, and comes back after a drop. */
export function roomLink({ url, code, seed, host, sim = WIRE, store = null, Socket = globalThis.WebSocket, timers = globalThis, onStatus = () => {} }) {
  const key = `cinderhill:war:room:${code}`; let ws = null, tries = 0, timer = null, wanted = true, status = 'connecting';
  const say = s => { if (s !== status) { status = s; onStatus(s); } };
  let token = ''; try { token = store?.getItem(key) || ''; } catch { /* no storage */ }
  const net = host();
  function connect() {
    if (!wanted) return;
    const q = new URLSearchParams({ proto: PROTO, game: 'war', sim, seed, have: host().have, ...(token ? { token } : {}) });
    let mine; try { mine = ws = new Socket(`${url}/room/${code.toLowerCase()}/ws?${q}`); } catch { return retry(); }
    ws.binaryType = 'arraybuffer';
    ws.onmessage = ev => {
      if (mine !== ws) return;
      if (typeof ev.data !== 'string') { host().sealed(decodeSealed(ev.data)); return; }
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'welcome') { tries = 0; token = m.token; try { store?.setItem(key, token); } catch { /* no storage */ } host().welcome(m); say('live'); }
      else if (m.t === 'ack') host().ack(m);
      else if (m.t === 'desync') { host().desync = m.tick; say('drift'); }
      else if (m.t === 'reload') { wanted = false; say('version'); }
    };
    ws.onclose = ev => { if (mine !== ws) return; if (ev.code === 4001) { wanted = false; say('full'); } else if (ev.code === 4005) { wanted = false; say('version'); } else retry(); };
    ws.onerror = () => { /* onclose follows */ };
  }
  function retry() { if (!wanted) return; say('waiting'); timers.clearTimeout(timer); timer = timers.setTimeout(connect, Math.min(8000, 500 * 2 ** Math.min(tries++, 4))); }
  net.send = text => { try { if (ws && ws.readyState === 1) ws.send(text); } catch { /* sent again after the next welcome */ } };
  connect();
  return { get status() { return status; }, leave() { wanted = false; timers.clearTimeout(timer); try { ws?.close(); } catch { /* closed */ } } };
}
