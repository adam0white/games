// Race rules only. Lantern owns every river, collision and pickup rule.
import { centre, half, sight, boat, speed, nightPace } from '../sim.js?v=17';
export const DISTANCE = 100000;
export const SEND_MS = 200;
export const NIGHTS = [1, 3, 6];
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const nightForSeed = seed => NIGHTS[(seed >>> 0) % NIGHTS.length];
export const distance = progress => Math.round(clamp(progress, 0, 1) * DISTANCE);
export const cleanName = name => Array.from(String(name ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim()).slice(0, 16).join('') || 'Lantern';
export const roomCode = value => value === 'open' ? 'open' : /^[A-Za-z]{4}$/.test(value ?? '') ? value.toUpperCase() : null;
export function random(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function makeCode(seed) { const r = random(seed); return Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(r() * 26))).join(''); }
export function dailySeed(isoDay) { let h = 2166136261; for (const c of isoDay) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export const countdown = (start, now) => clamp(start - now, 1000, 6000);
const integer = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const finite = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const id = v => integer(v, 1, 8);
const round = v => v && integer(v.seed, 0, 4294967295) && finite(v.start, 0, Number.MAX_SAFE_INTEGER);
const name = v => typeof v === 'string' && Array.from(v).length <= 16 && v === cleanName(v);
// UTF-8 bytes, not JS string length. All client frames and relays cap at 200.
// The welcome frame alone allows 2048 inbound bytes: eight 16-character names cannot
// fit the brief's 200-byte roster limit (334 bytes even with ASCII names).
export const bytes = message => new TextEncoder().encode(typeof message === 'string' ? message : JSON.stringify(message)).length;
export function validMessage(m, direction = 'server') {
  if (!m || typeof m !== 'object' || Array.isArray(m) || bytes(m) > (direction === 'server' && m.t === 'you' ? 2048 : 200)) return false;
  const fields = direction === 'client' ? { hi: ['t','n'], ready: ['t'], p: ['t','x','d','a'], done: ['t','s'] } : { you: ['t','id','peers','round'], join: ['t','id','n'], leave: ['t','id'], round: ['t','seed','start'], p: ['t','id','x','d','a'], done: ['t','id','s'] };
  if (!fields[m.t] || Object.keys(m).length !== fields[m.t].length || !fields[m.t].every(k => Object.hasOwn(m, k))) return false;
  if (direction === 'client') {
    if (m.t === 'hi') return name(m.n);
    if (m.t === 'ready') return true;
    if (m.t === 'p') return finite(m.x, -1, 1) && finite(m.d, 0, DISTANCE) && integer(m.a, 0, 1);
    return m.t === 'done' && integer(m.s, 0, 1000000);
  }
  switch (m.t) {
    case 'you': return id(m.id) && Array.isArray(m.peers) && m.peers.length <= 8 && m.peers.every(p => id(p.id) && name(p.n)) && new Set(m.peers.map(p => p.id)).size === m.peers.length && (m.round === null || round(m.round));
    case 'join': return id(m.id) && name(m.n);
    case 'leave': return id(m.id);
    case 'round': return round(m);
    case 'p': return id(m.id) && finite(m.x, -1, 1) && finite(m.d, 0, DISTANCE) && integer(m.a, 0, 1);
    case 'done': return id(m.id) && integer(m.s, 0, 1000000);
    default: return false;
  }
}
function parseFrame(text, direction, allowRoster) {
  try {
    if (typeof text !== 'string') return null;
    const size = bytes(text);
    if (size > 2048) return null;
    const frame = JSON.parse(text);
    if (size > 200 && !(direction === 'server' && frame?.t === 'you')) return null;
    if (!allowRoster || frame?.t !== 'roster') return validMessage(frame, direction) ? frame : null;
    if (Object.keys(frame).length !== 2 || !Array.isArray(frame.ids)) return null;
    const { ids } = frame;
    return ids.length > 0 && ids.length <= 8 && ids.every(id) && new Set(ids).size === ids.length ? frame : null;
  } catch { return null; }
}
// Keep the original wire decoder for callers that only handle the legacy frames.
export const decode = (text, direction = 'server') => parseFrame(text, direction, false);
export const decodeRoomFrame = text => parseFrame(text, 'server', true);
export function position(x, d, alive) { return { t: 'p', x: Math.round(clamp(x * 2 - 1, -1, 1) * 1000) / 1000, d: Math.round(clamp(d, 0, DISTANCE)), a: alive ? 1 : 0 }; }
// Every comparison has a total ordering, including ties and unfinished boats.
export function ranking(entries) {
  return entries.map(p => ({ ...p })).sort((a, b) => b.d - a.d || (a.s ?? Infinity) - (b.s ?? Infinity) || a.id - b.id);
}
export function ghostTrack(packet, at, old = null) {
  // Ignore regressive distances (a delayed packet must not pull a ghost upriver).
  if (old && packet.d < old.b.d) return old;
  return { a: old ? old.b : { ...packet, at }, b: { ...packet, at } };
}
export function interpolate(track, now) {
  // Play 200 ms behind arrivals. Hold the last sample after packet loss; never invent progress.
  const { a, b } = track;
  const f = b.at === a.at ? 1 : clamp((now - SEND_MS - a.at) / (b.at - a.at), 0, 1);
  return { x: a.x + (b.x - a.x) * f, d: a.d + (b.d - a.d) * f, a: b.a, at: now };
}
// Candidate steering. Hazards and pickups are the unchanged Lantern sim's visible state.
// Skill 0 hesitates and wanders; skill 1 reacts moderately; skill 2 sees the full lantern radius.
export function botTarget(s, skill = 2, identity = 0) {
  const c = centre(s, s.y + 0.15), h = half(s, s.y + 0.15), radius = boat(s);
  const see = 0.7, pace = nightPace(s.stage), velocity = speed(s);
  let best = c, high = -Infinity;
  for (let i = 0; i <= 28; i++) {
    const x = c - h + radius + 0.022 + (2 * h - 2 * radius - 0.044) * i / 28;
    let value = -Math.abs(x - s.x) * 0.4 - Math.abs(x - c) * 0.12;
    // Check the whole lateral approach, not just the candidate lane. A lane across
    // a rock beside the boat is unsafe even when the lane itself is clear.
    for (const k of s.rocks) if (k.on && k.y - s.y > -0.16 && k.y - s.y < see) {
      let margin = 9;
      const horizon = Math.min(1.4, Math.max(0.2, (k.y - s.y + 0.15) / Math.max(0.4, velocity)));
      for (let j = 0; j <= 14; j++) {
        const t = horizon * j / 14;
        const bx = s.x + clamp(x - s.x, -0.95 * pace * t, 0.95 * pace * t);
        const kx = k.a ? k.x0 + k.a * Math.sin((s.t + t) * k.w + k.ph) : k.x;
        const ky = k.y + (k.vy || 0) * t;
        const d = Math.hypot(Math.max(0, Math.abs(kx - bx) - k.len), ky - s.y - velocity * t) - k.rad - radius;
        margin = Math.min(margin, d);
      }
      if (margin < 0.027) value -= (0.027 - margin) * 400;
    }
    for (const e of s.embers) {
      const dy = e.y - s.y;
      if (!e.got && e.kind === 'ember' && dy > 0 && dy < 0.85) value += Math.max(0, 0.1 - Math.abs(e.x - x)) * (4 + 10 * (1 - s.light)) / (0.2 + dy);
    }
    if (skill === 0) value += Math.sin((Math.floor(s.t / 0.7) + identity * 17 + s.seed) * 2.13 + x * 7) * 0.025;
    else value += Math.sin(identity * 7 + x * 6) * 0.01;
    if (value > high) { high = value; best = x; }
  }
  return clamp(best, 0, 1);
}
export function botControl(s, policy) {
  if (s.t >= policy.next) { policy.target = botTarget(s, policy.skill, policy.id); policy.next = s.t + [0.4, 0.22, 0.065][policy.skill]; }
  return policy.target ?? s.x;
}
