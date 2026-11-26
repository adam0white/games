// The hill room's wire format. Shared by the room, the Node clients and the tests; plain JS, no imports.
//
// Client to room: text JSON.
//   { t: 'cmd', id, tick, cmd: { type, ...payload } }   an order; `tick` is the tick the client wants it in
//   { t: 'hash', tick, h }                              the client's total sim hash when its sim reached `tick`
// Room to client:
//   text JSON { t: 'welcome', ... }, { t: 'ack', id, tick, dup }, { t: 'desync', tick }
//   binary SEALED frames (below): every tick up to `through` is sealed, with the commands of the ticks
//   the frame covers. A live frame covers one tick; a catch-up frame after a (re)connect covers many.
//
// Raise PROTO when a page and a room of different code could not play together.
export const PROTO = 1;
export const SEALED = 1;
export const HZ = 20;
export const TICK_MS = 1000 / HZ;
export const HASH_EVERY = 20; // ticks between client hashes (one a second)
export const SEATS = 4;

/** Commands are the sim's own Int32Array encoding: [tick, seat, id, type, ...payload]. */
export function encodeSealed(through, commands) {
  let size = 1 + 4 + 2;
  for (const c of commands) size += 2 + 4 * c.length;
  const out = new ArrayBuffer(size), dv = new DataView(out);
  dv.setUint8(0, SEALED); dv.setUint32(1, through, true); dv.setUint16(5, commands.length, true);
  let at = 7;
  for (const c of commands) {
    dv.setUint16(at, c.length, true); at += 2;
    for (let k = 0; k < c.length; k++, at += 4) dv.setInt32(at, c[k], true);
  }
  return out;
}

export function decodeSealed(buf) {
  const dv = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer, buf.byteOffset ?? 0, buf.byteLength);
  if (dv.getUint8(0) !== SEALED) throw new Error('not a sealed frame');
  const through = dv.getUint32(1, true), n = dv.getUint16(5, true), commands = [];
  let at = 7;
  for (let k = 0; k < n; k++) {
    const len = dv.getUint16(at, true); at += 2;
    const c = new Int32Array(len);
    for (let j = 0; j < len; j++, at += 4) c[j] = dv.getInt32(at, true);
    commands.push(c);
  }
  return { through, commands };
}
