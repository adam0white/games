// A binary range coder with adaptive bit probabilities (the LZMA design), for snapshots.
//
// Integers only: `range` is a 32-bit unsigned value, probabilities are 15-bit, and `low` is a Number below
// 2^33 whose 33rd bit is the carry. Every product stays below 2^32, so it is exact on every engine and the
// coded bytes are the same everywhere.
//
// One interface for both directions: each call takes the value to write and returns the value read, so a
// single walk over the state encodes (the encoder returns what it was given) and decodes (the decoder
// ignores the argument). That keeps the two directions from drifting apart.

const TOP = 16777216; // 2^24
// 15-bit probabilities (LZMA uses 11): the most likely symbol then costs at least 0.0014 bits, not 0.022,
// which matters for the tens of thousands of zero scent cells.
const BITS = 15, ONE = 1 << BITS, MOVE = 5;
const TWO32 = 4294967296;

/** Probabilities for `n` binary decisions, all starting at one half. */
export const probs = n => new Uint16Array(n).fill(ONE >> 1);

/** An adaptive model for unsigned integers below 2^32, with `contexts` independent contexts. The bit
 *  length (0..32) is coded with a 6-level bit tree, the two bits under the leading one adaptively, and the
 *  rest as plain bits. */
export function intModel(contexts) {
  return { len: probs(contexts * 64), man: probs(contexts * 33 * 4), sign: probs(contexts) };
}

export class Encoder {
  constructor() {
    this.low = 0; this.range = 0xFFFFFFFF; this.cache = 0; this.cacheSize = 1;
    this.buf = new Uint8Array(1 << 16); this.at = 0;
    this.decoding = false;
  }

  put(b) {
    if (this.at === this.buf.length) { const nb = new Uint8Array(this.buf.length * 2); nb.set(this.buf); this.buf = nb; }
    this.buf[this.at++] = b;
  }

  shiftLow() {
    const lo = this.low >>> 0, carry = this.low >= TWO32 ? 1 : 0;
    if (lo < 0xFF000000 || carry) {
      let t = this.cache;
      do { this.put((t + carry) & 255); t = 0xFF; } while (--this.cacheSize !== 0);
      this.cache = lo >>> 24;
    }
    this.cacheSize++;
    this.low = (lo & 0x00FFFFFF) * 256;
  }

  bit(p, i, b) {
    const bound = (this.range >>> BITS) * p[i];
    if (b) { this.low += bound; this.range -= bound; p[i] -= p[i] >> MOVE; }
    else { this.range = bound; p[i] += (ONE - p[i]) >> MOVE; }
    while (this.range < TOP) { this.range *= 256; this.shiftLow(); }
    return b ? 1 : 0;
  }

  /** `n` plain bits (n at most 32), high bit first. */
  bits(v, n) {
    for (let j = n - 1; j >= 0; j--) {
      this.range = this.range >>> 1;
      if ((v >>> j) & 1) this.low += this.range;
      while (this.range < TOP) { this.range *= 256; this.shiftLow(); }
    }
    return n === 32 ? v >>> 0 : v & ((1 << n) - 1);
  }

  finish() {
    for (let k = 0; k < 5; k++) this.shiftLow();
    return this.buf.slice(0, this.at);
  }
}

export class Decoder {
  constructor(bytes) {
    this.bytes = bytes; this.at = 0; this.range = 0xFFFFFFFF; this.code = 0;
    this.decoding = true;
    if (this.next() !== 0) throw new Error('snapshot payload is corrupt');
    for (let k = 0; k < 4; k++) this.code = this.code * 256 + this.next();
  }

  next() {
    if (this.at >= this.bytes.length) throw new Error('snapshot payload is truncated');
    return this.bytes[this.at++];
  }

  bit(p, i) {
    const bound = (this.range >>> BITS) * p[i];
    let b;
    if (this.code < bound) { this.range = bound; p[i] += (ONE - p[i]) >> MOVE; b = 0; }
    else { this.code -= bound; this.range -= bound; p[i] -= p[i] >> MOVE; b = 1; }
    while (this.range < TOP) { this.range *= 256; this.code = this.code * 256 + this.next(); }
    return b;
  }

  bits(_, n) {
    let v = 0;
    for (let j = 0; j < n; j++) {
      this.range = this.range >>> 1;
      let b = 0;
      if (this.code >= this.range) { this.code -= this.range; b = 1; }
      v = v * 2 + b;
      while (this.range < TOP) { this.range *= 256; this.code = this.code * 256 + this.next(); }
    }
    return v;
  }

  /** The encoder flushes exactly what the decoder reads; anything left over is a corrupt snapshot. */
  finish() {
    if (this.at !== this.bytes.length) throw new Error('snapshot payload has trailing bytes');
  }
}

/** A symbol of `n` bits through a bit tree at `p[base .. base + 2^n)`. */
export function tree(io, p, base, n, v) {
  let m = 1;
  for (let j = n - 1; j >= 0; j--) m = (m << 1) | io.bit(p, base + m, (v >>> j) & 1);
  return m - (1 << n);
}

/** An unsigned integer below 2^32 in context `ctx` of an intModel. */
export function uint(io, M, ctx, v) {
  const k = io.decoding ? 0 : 32 - Math.clz32(v);
  const len = tree(io, M.len, ctx * 64, 6, k);
  if (len === 0) return 0;
  if (len > 32) throw new Error('snapshot payload is corrupt');
  if (len === 1) return 1;
  // len - 1 bits under the leading one: up to two adaptively, the rest plain.
  const rest = len - 1, top = rest < 2 ? rest : 2, low = rest - top, mb = (ctx * 33 + len) * 4;
  const hi = tree(io, M.man, mb, top, io.decoding ? 0 : (v >>> low) & ((1 << top) - 1));
  const lo = low ? io.bits(io.decoding ? 0 : v, low) : 0;
  // (1 << rest) overflows at rest 31; build the value with multiplication instead.
  let x = 1;
  for (let j = 0; j < top; j++) x *= 2;
  x += hi;
  for (let j = 0; j < low; j++) x *= 2;
  return x + lo;
}

/** A signed 32-bit integer: magnitude, then a sign bit for non-zero values. */
export function sint(io, M, ctx, v) {
  const mag = uint(io, M, ctx, io.decoding ? 0 : v < 0 ? -v : v);
  if (mag === 0) return 0;
  const neg = io.bit(M.sign, ctx, v < 0 ? 1 : 0);
  return neg ? -mag : mag;
}
