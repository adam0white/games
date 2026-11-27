// The flame lives in the link. Pure: no window, no document, so check.mjs runs it in Node.
//
//   ?flame=1.<chain>.<flame>.<total>.<seed>.<carriers>
//   1          format version
//   chain      carriers so far, 1 to 99999
//   flame      the level handed on, whole percent 1 to 100
//   total      metres the flame has travelled, 0 to 99,999,999 (at least the sum of the listed legs)
//   seed       the next leg's river, base 36, 1 to 2^31 - 1
//   carriers   the last eight carriers, oldest first: name*metres*name*metres... (a name may be empty)
//   ~sum       a short keyed checksum over everything before it (8 base-36 characters). The key is a constant in this
//              file, so it only stops casual editing of a link, not anyone who reads the code.
//
// A link with a good checksum is read as above. A link whose checksum is wrong is refused. A link with no checksum (made
// before 2026-11-27) is read only if it also passes the stricter checks a real leg always meets: every listed leg 1,700 to
// 1,960 m, total no more than 1,960 m a carrier, and the chain count clamped to what the names and distances support.
//
// A name is at most 16 letters, digits, spaces, _ . - (any script, NFKC). Everything is checked strictly; a link
// that is not exactly well formed is refused whole (read() gives null) and the page treats the player as carrier 1.
// Link text only ever reaches the page through textContent or canvas fillText.

export const VERSION = 1, KEEP = 8, NAME_MAX = 16;
export const TOP = { chain: 99999, flame: 100, total: 99999999, seed: 2 ** 31, leg: 9999 };
// A finished leg is always 1,700 to 1,960 m long (sim.js leg()); an unsigned link must keep to that.
export const LEG = { min: 1700, max: 1960 };
const KEY = 'pass-the-flame/b/2026-11-27';
// cyrb53 over the key and the text: 53 bits, written as 8 base-36 characters.
export function checksum(text) {
  const str = KEY + '|' + text;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36).padStart(8, '0').slice(-8);
}
export const cleanName = v => String(v ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
const NAME = /^[\p{L}\p{N} _.-]{0,16}$/u;
const whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// A flame as the page holds it: { chain, flame (1..100), total, seed, carriers: [{ name, dist }] }
export function valid(f) {
  if (!f || typeof f !== 'object') return false;
  if (!whole(f.chain, 1, TOP.chain) || !whole(f.flame, 1, TOP.flame) || !whole(f.total, 0, TOP.total) || !whole(f.seed, 1, TOP.seed - 1)) return false;
  if (!Array.isArray(f.carriers) || f.carriers.length < 1 || f.carriers.length > KEEP || f.carriers.length > f.chain) return false;
  let sum = 0;
  for (const c of f.carriers) {
    if (!c || typeof c.name !== 'string' || !NAME.test(c.name) || c.name !== cleanName(c.name) || !whole(c.dist, 0, TOP.leg)) return false;
    sum += c.dist;
  }
  return sum <= f.total;
}

export function encode(f) {
  if (!valid(f)) return '';
  const tail = f.carriers.map(c => `${c.name}*${c.dist}`).join('*');
  const body = [VERSION, f.chain, f.flame, f.total, f.seed.toString(36), tail].join('.');
  return `${body}~${checksum(body)}`;
}

const SHAPE = /^1\.([1-9]\d{0,4})\.([1-9]\d{0,2})\.(0|[1-9]\d{0,7})\.([0-9a-z]{1,7})\.(.{1,240})$/su;
// decode(text) gives the flame, or null. With { detail: true } it gives { flame, signed, clamped } instead.
export function decode(text, { detail = false } = {}) {
  if (typeof text !== 'string' || text.length > 330) return null;
  let body = text, signed = false;
  const tilde = text.lastIndexOf('~');
  if (tilde >= 0) {
    body = text.slice(0, tilde);
    if (!/^[0-9a-z]{8}$/.test(text.slice(tilde + 1)) || checksum(body) !== text.slice(tilde + 1)) return null;
    signed = true;
  }
  const f = parse(body);
  if (!f) return null;
  if (signed) return detail ? { flame: f, signed, clamped: false } : f;
  // No checksum: only what a real chain of legs could have made.
  let sum = 0;
  for (const c of f.carriers) { if (c.dist < LEG.min || c.dist > LEG.max) return null; sum += c.dist; }
  const n = f.carriers.length;
  // fewer than eight names: every carrier is listed; eight: each unlisted carrier rowed at least a full leg
  const chain = Math.min(f.chain, n < KEEP ? n : n + Math.floor((f.total - sum) / LEG.min));
  if (f.total > chain * LEG.max) return null;                       // more metres than the carriers could have rowed
  const out = { ...f, chain };
  return detail ? { flame: out, signed, clamped: chain !== f.chain } : out;
}
function parse(text) {
  if (text.length > 320) return null;
  const m = SHAPE.exec(text);
  if (!m) return null;
  const parts = m[5].split('*');
  if (parts.length % 2 !== 0 || parts.length > KEEP * 2) return null;
  const carriers = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (!/^(0|[1-9]\d{0,3})$/.test(parts[i + 1])) return null;
    carriers.push({ name: parts[i], dist: Number(parts[i + 1]) });
  }
  const seedText = m[4];
  if (seedText !== String(seedText).replace(/^0+(?=.)/, '')) return null; // no leading zeros: one spelling per seed
  const f = { chain: Number(m[1]), flame: Number(m[2]), total: Number(m[3]), seed: parseInt(seedText, 36), carriers };
  return valid(f) ? f : null;
}

// The link for a flame: origin and path of this page only, so ?lang= or ?labRunSource= never travel with it.
export function linkFor(f, href) {
  const text = encode(f); if (!text) return '';
  const u = new URL(href); return `${u.origin}${u.pathname}?flame=${encodeURIComponent(text)}`;
}
export function readLink(href, opts) {
  let v = null; try { v = new URL(href).searchParams.get('flame'); } catch { return null; }
  return v === null ? null : decode(v, opts);
}
// Was there a flame parameter at all (so a refused link can say so)?
export function hasLink(href) { try { return new URL(href).searchParams.has('flame'); } catch { return false; } }

// The flame after this leg: your name and distance added, the oldest dropped past eight.
export function passOn(prev, { name, dist, flame, seed }) {
  const carriers = [...(prev ? prev.carriers : []), { name: cleanName(name), dist: Math.max(0, Math.min(TOP.leg, Math.round(dist))) }].slice(-KEEP);
  return {
    chain: Math.min(TOP.chain, (prev ? prev.chain : 0) + 1),
    flame: Math.max(1, Math.min(100, Math.round(flame * 100))),
    total: Math.min(TOP.total, (prev ? prev.total : 0) + Math.round(dist)),
    seed: (seed >>> 0) % (TOP.seed - 1) + 1,
    carriers,
  };
}
