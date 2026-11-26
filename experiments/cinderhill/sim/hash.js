// 32-bit state hashes. Typed arrays are read as 32-bit little-endian words where the length allows, bytes
// otherwise. Every target (x86 and ARM phones, desktops and Cloudflare) is little-endian, so the word view
// reads the same bytes everywhere.

export const SUBSYSTEMS = ['ants', 'scent', 'terrain', 'flow', 'rng', 'events', 'globals'];

const M = 0x5BD1E995;
const step = (h, w) => { h = Math.imul(h ^ w, M); return h ^ (h >>> 15); };

export function hashInt(h, v) { return step(h, v | 0); }

/** Mix the first `len` elements of a typed array into h. */
export function hashArray(h, ta, len = ta.length) {
  const bytes = len * ta.BYTES_PER_ELEMENT, off = ta.byteOffset;
  h = step(h, bytes);
  const words = bytes >> 2;
  if (off % 4 === 0) {
    const w = new Uint32Array(ta.buffer, off, words);
    for (let i = 0; i < words; i++) h = step(h, w[i]);
  } else {
    const b = new Uint8Array(ta.buffer, off, words * 4);
    for (let i = 0; i < words * 4; i += 4) h = step(h, b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24));
  }
  const b = new Uint8Array(ta.buffer, off + words * 4, bytes - words * 4);
  for (let i = 0; i < b.length; i++) h = step(h, b[i]);
  return h;
}

export const finish = h => (Math.imul(h ^ (h >>> 13), 0xC2B2AE35) ^ (h >>> 16)) >>> 0;
