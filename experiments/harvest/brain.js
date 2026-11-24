// Where a player's finger goes. Used by bots.mjs (to prove the rules) and check.mjs (to play with real pointer events).
// A brain is called every tick and returns { x, y } (finger down there), null (finger up) or { whet: true }.
import { STAND, LYING, SPEED, SWEEP, SCARE, limit, center } from './sim.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// When the rain front reaches column x (seconds into the morning).
const soakAt = (s, x) => s.L.time + Math.floor(x) / s.cols * SWEEP;

// The careful player: cuts near the cart first, gathers what lies close, goes to the cart when full or when time is short,
// scares crows off the sheaves, sharpens at once, leaves the hare's nest standing.
export function careful() {
  let next = 0, goal = null, via = null;
  return s => {
    const me = s.me;
    if (me.blunt) return me.whet ? null : { whet: true };
    if (s.t < next && goal) return goal;
    next = s.t + 0.2;
    goal = carefulGoal(s);
    if (via && (dist(me, via) < 0.35 || !s.nestAlive)) via = null;
    if (goal && s.nestAlive) { if (via) return (goal = via); const g = around(s, goal); if (g !== goal) { via = g; goal = g; } } // keep to a corner once chosen
    return goal;
  };
}
// Walk round the hare's nest: if the straight line to the goal crosses a nest cell, go by the corners of its bounding box.
function around(s, goal) {
  const xs = s.nest.map(i => i % s.cols), ys = s.nest.map(i => Math.floor(i / s.cols));
  const box = { x0: Math.min(...xs), x1: Math.max(...xs) + 1, y0: Math.min(...ys), y1: Math.max(...ys) + 1 };
  const me = s.me;
  if (!crosses(s, me, goal)) return goal;
  const m = 0.5, cl = (v, hi) => Math.max(0.3, Math.min(hi - 0.3, v));
  const corners = [[box.x0 - m, box.y0 - m], [box.x1 + m, box.y0 - m], [box.x0 - m, box.y1 + m], [box.x1 + m, box.y1 + m]].map(([x, y]) => ({ x: cl(x, s.cols), y: cl(y, s.rows + 1.7) }));
  const rest = c => crosses(s, c, goal) ? Math.min(...corners.filter(d => d !== c && !crosses(s, c, d) && !crosses(s, d, goal)).map(d => dist(c, d) + dist(d, goal)), 99) : dist(c, goal);
  let best = null, bd = Infinity;
  for (const c of corners) if (dist(me, c) > 0.3 && !crosses(s, me, c)) { const d = dist(me, c) + rest(c); if (d < bd) { bd = d; best = c; } }
  return best ?? goal;
}
function crosses(s, a, b) { // does the segment a-b pass within reach of a nest cell? (sampled every 0.1 cell)
  const n = Math.max(2, Math.ceil(dist(a, b) / 0.1));
  for (let k = 0; k <= n; k++) {
    const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n;
    for (const i of s.nest) { const cx = i % s.cols, cy = Math.floor(i / s.cols); if (x > cx - 0.12 && x < cx + 1.12 && y > cy - 0.12 && y < cy + 1.12) return true; }
  }
  return false;
}
function carefulGoal(s) {
  const me = s.me, cart = s.cart, lim = limit(s);
  const toCart = dist(me, cart) / SPEED + 0.8;
  const end = s.L.time + SWEEP;
  const nest = new Set(s.nestAlive ? s.nest : []);
  // With the strong one carrying, the player keeps cutting when full and leaves the sheaves to him.
  const standLeft = s.st.some((v, i) => v === STAND && !nest.has(i));
  const cutter = s.helpers.strong.hired && standLeft;
  if ((me.carryN >= lim && !cutter) || (me.carryN > 0 && end - s.t < toCart + 0.5)) return { x: cart.x, y: cart.y };
  // a crow on a sheaf close by: chase it off
  for (const c of s.crows) if (!c.flee && c.eating && dist(c, me) < 3.2 && s.st[c.target] === LYING) return { x: c.x, y: c.y };
  const reach = (i, extra = 0) => { const p = center(s, i); return s.t + dist(me, p) / SPEED + extra < soakAt(s, p.x); };
  let best = -1, bs = Infinity;
  if (me.carryN < lim) for (let i = 0; i < s.st.length; i++) if (s.st[i] === LYING && reach(i)) { const p = center(s, i), sc = dist(me, p); if (sc < bs) { bs = sc; best = i; } }
  // With the strong one carrying, the player cuts and leaves the sheaves to him, unless they lie close.
  if (best >= 0 && cutter && bs > 1.2) best = -1;
  else {
    if (best >= 0 && !(me.carryN > 0 && bs > dist(me, cart) + 1.5)) { const p = center(s, best); return p; }
    if (me.carryN > 0 && best >= 0) return { x: cart.x, y: cart.y };
  }
  best = -1; bs = Infinity;
  for (let i = 0; i < s.st.length; i++) if (s.st[i] === STAND && !nest.has(i) && reach(i, 2 + dist(center(s, i), cart) / SPEED)) {
    const p = center(s, i), sc = dist(me, p) + 0.45 * dist(p, cart);
    if (sc < bs) { bs = sc; best = i; }
  }
  if (best >= 0) return center(s, best);
  if (me.carryN > 0) return { x: cart.x, y: cart.y };
  return null;
}

// The clumsy player: slow to react (a new aim every 1 to 2 s), aims roughly, often wanders to a random patch, goes to the cart
// only when full, sharpens late, ignores crows and the nest, and now and then lifts the finger to look.
export function clumsy(seed = 1) {
  let a = (seed * 2654435761) >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let next = 0, goal = null, bluntSince = -1;
  return s => {
    const me = s.me;
    if (me.blunt) { if (bluntSince < 0) bluntSince = s.t; if (s.t - bluntSince > 4 && !me.whet) { bluntSince = -1; return { whet: true }; } } else bluntSince = -1;
    if (s.t < next) return goal;
    next = s.t + 1 + r();
    if (r() < 0.12) return (goal = null); // looks around
    const cart = s.cart;
    if (me.carryN >= limit(s)) return (goal = jitter({ x: cart.x, y: cart.y }, 0.3));
    const cells = []; for (let i = 0; i < s.st.length; i++) if (s.st[i] === STAND || s.st[i] === LYING) cells.push(i);
    if (!cells.length) return (goal = me.carryN ? { x: cart.x, y: cart.y } : null);
    let pick;
    if (r() < 0.3) pick = cells[Math.floor(r() * cells.length)];
    else { let bd = Infinity; for (const i of cells) { const d = dist(me, center(s, i)) + (s.st[i] === LYING ? -0.5 : 0); if (d < bd) { bd = d; pick = i; } } }
    return (goal = jitter(center(s, pick), 0.7));
  };
  function jitter(p, k) { return { x: p.x + (r() - 0.5) * 2 * k, y: p.y + (r() - 0.5) * 2 * k }; }
}

// Play a whole morning with a brain and a hiring list (hired at 1 s, in this order). Returns the state at the end.
export function play(sim, { level, seed, L, brain, hires = [], hireAt = 1, onTick }) {
  const s = sim.create({ level, seed, L });
  let hired = false;
  for (let n = 0; !s.over && n < 30 * 400; n++) {
    if (!hired && s.t >= hireAt) { hired = true; for (const id of hires) sim.hire(s, id); }
    let out = brain(s);
    if (out && out.whet) { sim.whet(s); out = null; }
    onTick?.(s, out);
    sim.step(s, out);
  }
  return s;
}
