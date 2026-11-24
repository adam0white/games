// Lantern Echo: what the player can perceive when the lantern is out. Pure, no DOM, clocked by the sim's own time s.t,
// so the page and the bots (bots.mjs) see exactly the same things at the same moments.
// A ping is a ring that starts at the boat and grows at a fixed speed across the water. The ring stays where it started
// while the boat moves on. When the ring reaches a rock, an ember or an ability, that thing is lit for GLOW seconds
// and drawn (and heard) where it is at each moment while lit. Taking an ember also lights everything close to the boat.
import { speed, boat } from '../../lantern/sim.js';

// The tuning. bots.mjs measured these. The first tuning (a ping every 1.6 s) left things dark for too long between
// pings: the bot that stands for a player with sound off reached dawn on 6 of 100 night-1 rivers. A ping every second does.
export const TUNE = {
  period: 1.0,    // seconds between automatic pings
  cooldown: 0.6,  // seconds before a manual ping (space, a second finger) can go again
  ring: 2.5,      // how fast the ring grows, river units a second (the river is one unit wide)
  range: 2.6,     // how far the ring goes before it fades; rows of rocks are laid 2.4 ahead of the boat
  glow: 0.9,      // seconds a thing stays lit after the ring passes it
  flash: 0.3,     // radius lit around the boat when it takes an ember
};

// A fresh echo state. Pass overrides to try other tuning, as the bots do.
export function createEcho(over = {}) {
  const tune = { ...TUNE, ...over };
  return { tune, pings: [], lit: new Map(), heard: [], next: tune.period * 0.5, last: -1e9, count: 0, t: 0 };
}

// What a thing is, for its colour and its sound: 'rock', 'ember', 'wisp', or the ability's own name.
export function what(o) { return 'rad' in o ? 'rock' : o.kind; }

// Distance from a point to the edge of a thing, in river units. Rocks have a radius; a log also has a length.
function gap(o, x, y) {
  if ('rad' in o) return Math.hypot(Math.max(0, Math.abs(o.x - x) - o.len), o.y - y) - o.rad;
  return Math.hypot(o.x - x, o.y - y);
}

// Send a ping now. A manual ping waits for the cooldown; it returns false if it could not go.
// The cooldown counts from the last manual ping only, so a tap just after an automatic ping is never refused.
export function ping(e, s, manual = true) {
  if (manual && s.t - e.last < e.tune.cooldown) return false;
  e.pings.push({ x: s.x, y: s.y, t0: s.t, hit: new Set() });
  if (manual) e.last = s.t;
  e.next = s.t + e.tune.period; e.count++;
  return true;
}

function light(e, s, o) {
  const was = e.lit.get(o); // from: when it first lit in this unbroken glow, so a bot can model a person's reaction time
  e.lit.set(o, { until: s.t + e.tune.glow, kind: what(o), from: was ? was.from : s.t });
  return !was;
}

// Call once after every sim step. Fills e.heard with the things the rings reached this tick:
// { kind, dx (across the river from the boat), dist (from the boat) }, for the page to play as sounds.
export function update(e, s) {
  e.t = s.t; e.heard.length = 0;
  if (!s.over && s.t >= e.next) ping(e, s, false);
  const things = [...s.rocks, ...s.embers.filter(o => !o.got), ...s.powers.filter(o => !o.got)];
  for (const p of e.pings) {
    const r = (s.t - p.t0) * e.tune.ring;
    for (const o of things) {
      if (p.hit.has(o) || gap(o, p.x, p.y) > r) continue;
      p.hit.add(o); light(e, s, o);
      e.heard.push({ kind: what(o), dx: o.x - s.x, dist: Math.hypot(o.x - s.x, o.y - s.y) });
    }
  }
  e.pings = e.pings.filter(p => (s.t - p.t0) * e.tune.ring < e.tune.range);
  // An ember taken lights the water close by for a moment.
  if (s.events.includes('ember')) for (const o of things) if (gap(o, s.x, s.y) < e.tune.flash) light(e, s, o);
  for (const [o, l] of e.lit) if (l.until <= s.t || o.got) e.lit.delete(o);
}

// How brightly a lit thing shows, from 1 just after the ring to 0 when its glow is gone.
export function shine(e, o) { const l = e.lit.get(o); return l ? Math.max(0, (l.until - e.t) / e.tune.glow) : 0; }

// The rings to draw: where each started and how big it is now (river units), and how far through its range (0 to 1).
export function rings(e) { return e.pings.map(p => { const r = (e.t - p.t0) * e.tune.ring; return { x: p.x, y: p.y, r, k: r / e.tune.range }; }); }

// The proximity warning: the nearest rock the boat will meet within `horizon` seconds if it holds its line.
// Returns { time, dx } (seconds until it is level, and its offset across the river), or null. Moving rocks are
// taken where they are now. This is heard, not seen, so the bots that stand for a player with sound off do not use it.
export function threat(s, horizon = 1.2) {
  const v = speed(s) * (s.slow ? 0.5 : 1), b = boat(s);
  let best = null;
  for (const k of s.rocks) {
    const dy = k.y - s.y; if (dy <= 0 || !k.on) continue;
    const time = dy / v; if (time > horizon) continue;
    const side = Math.max(0, Math.abs(k.x - s.x) - k.len) - k.rad - b;
    if (side < 0.012 && (!best || time < best.time)) best = { time, dx: k.x - s.x };
  }
  return best;
}
