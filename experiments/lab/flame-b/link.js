// The flame lives in the link. Pure: no window, no document, so check.mjs runs it in Node.
//
//   ?flame=1.<chain>.<flame>.<total>.<seed>.<carriers>
//   1          format version
//   chain      carriers so far, 1 to 99999
//   flame      the level handed on, whole percent 1 to 100
//   total      metres the flame has travelled, 0 to 99,999,999 (at least the sum of the listed legs)
//   seed       the next leg's river, base 36, 1 to 2^31 - 1
//   carriers   the last eight carriers, oldest first: name*metres*name*metres... (a name may be empty)
//
// A name is at most 16 letters, digits, spaces, _ . - (any script, NFKC). Everything is checked strictly; a link
// that is not exactly well formed is refused whole (read() gives null) and the page treats the player as carrier 1.
// Link text only ever reaches the page through textContent or canvas fillText.

export const VERSION = 1, KEEP = 8, NAME_MAX = 16;
export const TOP = { chain: 99999, flame: 100, total: 99999999, seed: 2 ** 31, leg: 9999 };
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
  return [VERSION, f.chain, f.flame, f.total, f.seed.toString(36), tail].join('.');
}

const SHAPE = /^1\.([1-9]\d{0,4})\.([1-9]\d{0,2})\.(0|[1-9]\d{0,7})\.([0-9a-z]{1,7})\.(.{1,240})$/su;
export function decode(text) {
  if (typeof text !== 'string' || text.length > 320) return null;
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
export function readLink(href) {
  let v = null; try { v = new URL(href).searchParams.get('flame'); } catch { return null; }
  return v === null ? null : decode(v);
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
