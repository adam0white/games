// The wire format, both directions. All messages are binary and little-endian. The first byte is the type.
// Client to server: INPUT (5 bytes), PING (7 bytes). Nothing else is accepted.
// Server to client: WELCOME, SNAP, EVENT, SCORES, PONG. The layout of each is in the function that reads it.
export const INPUT = 1, PING = 2;
export const WELCOME = 1, SNAP = 2, EVENT = 3, SCORES = 4, PONG = 5;
export const M_ABS = 1, M_DELTA = 2, M_HEAD = 4, M_STATE = 8, M_META = 16, M_NAMES = 32;

export class Writer {
  constructor(size = 4096) { this.b = new Uint8Array(size); this.v = new DataView(this.b.buffer); this.n = 0; }
  need(k) { if (this.n + k > this.b.length) { const b = new Uint8Array(Math.max(this.b.length * 2, this.n + k)); b.set(this.b); this.b = b; this.v = new DataView(b.buffer); } }
  u8(x) { this.need(1); this.b[this.n++] = x; return this; }
  i8(x) { this.need(1); this.v.setInt8(this.n++, x); return this; }
  u16(x) { this.need(2); this.v.setUint16(this.n, x, true); this.n += 2; return this; }
  u32(x) { this.need(4); this.v.setUint32(this.n, x, true); this.n += 4; return this; }
  done() { const out = this.b.slice(0, this.n); this.n = 0; return out; }
}
export class Reader {
  constructor(data) { const b = data instanceof Uint8Array ? data : new Uint8Array(data); this.v = new DataView(b.buffer, b.byteOffset, b.byteLength); this.n = 0; }
  u8() { return this.v.getUint8(this.n++); }
  i8() { return this.v.getInt8(this.n++); }
  u16() { const x = this.v.getUint16(this.n, true); this.n += 2; return x; }
  u32() { const x = this.v.getUint32(this.n, true); this.n += 4; return x; }
}

export function writeInput(seq, angle, move, sprint) { return new Uint8Array([INPUT, seq & 255, seq >> 8 & 255, angle & 255, (move ? 1 : 0) | (sprint ? 2 : 0)]); }
export function writePing(nonce, lastTick) { const w = new Writer(8); return w.u8(PING).u16(nonce).u32(lastTick).done(); }

export function readWelcome(r) {
  const m = { proto: r.u8(), id: r.u8(), colony: r.u8(), nameA: r.u8(), nameB: r.u8(), tick: r.u32(), token: r.u32().toString(16).padStart(8, '0') + r.u32().toString(16).padStart(8, '0'), room: '' };
  for (let n = r.u8(); n > 0; n--) m.room += String.fromCharCode(r.u8());
  return m;
}

// SNAP: tick u32, ackSeq u16, applied u16, then the reader's own ant, then what changed in its view.
// `ants` is the reader's table of other ants (Map id -> record); this function applies the changes to it and
// returns the header. `food` is a Map id -> {x, y, kind}.
export function readSnap(r, ants, food, POS_Q, OWN_Q) {
  const s = { tick: r.u32(), ackSeq: r.u16(), applied: r.u16(), x: r.u16() / OWN_Q, y: r.u16() / OWN_Q, heading: r.u8(), hp: r.u8(), stamina: r.u8() / 2 };
  const f = r.u8();
  s.alive = !!(f & 1); s.carry = f >> 1 & 3; s.tier = f >> 3 & 3; s.prot = !!(f & 32);
  s.score = r.u16(); s.respawn = r.u8();
  for (let n = r.u8(); n > 0; n--) ants.delete(r.u8());
  for (let n = r.u8(); n > 0; n--) {
    const id = r.u8(), mask = r.u8();
    let a = ants.get(id);
    if (mask & M_NAMES || !a) { a = { id, qx: 0, qy: 0, heading: 0, hp: 0, carry: 0, tier: 0, colony: 0, bot: false, prot: false, sprint: false, nameA: 0, nameB: 0, fresh: true }; ants.set(id, a); }
    if (mask & M_ABS) { a.qx = r.u16(); a.qy = r.u16(); }
    if (mask & M_DELTA) { a.qx += r.i8(); a.qy += r.i8(); }
    if (mask & M_HEAD) a.heading = r.u8();
    if (mask & M_STATE) { const b = r.u8(); a.hp = b & 15; a.carry = b >> 4 & 3; a.tier = b >> 6 & 3; }
    if (mask & M_META) { const b = r.u8(); a.colony = b & 3; a.bot = !!(b & 4); a.prot = !!(b & 8); a.sprint = !!(b & 16); }
    if (mask & M_NAMES) { a.nameA = r.u8(); a.nameB = r.u8(); }
    a.x = a.qx / POS_Q; a.y = a.qy / POS_Q; a.tick = s.tick;
  }
  for (let n = r.u16(); n > 0; n--) { const id = r.u16(); food.set(id, { x: r.u16() / POS_Q, y: r.u16() / POS_Q, kind: r.u8() }); }
  for (let n = r.u16(); n > 0; n--) food.delete(r.u16());
  return s;
}
export function readScores(r) {
  const s = { colony: [r.u16(), r.u16(), r.u16(), r.u16()], left: 0, inBreak: false, people: 0, ants: 0, top: [], rank: 0 };
  const t = r.u16(); s.left = t & 0x7fff; s.inBreak = !!(t & 0x8000); s.people = r.u8(); s.ants = r.u8();
  for (let n = r.u8(); n > 0; n--) { const nameA = r.u8(), nameB = r.u8(), f = r.u8(); s.top.push({ nameA, nameB, colony: f & 3, bot: !!(f & 4), you: !!(f & 8), score: r.u16() }); }
  s.rank = r.u8();
  return s;
}
