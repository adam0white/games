// Grapevine rules. Pure and deterministic: no window, no document, runs in Node for the bots.
//
// A message has a shape, a colour and a count. The teller hands it to a neighbour; each villager on the
// route changes it in their own fixed way as they pass it on; the listener wants one exact message.
// A route is a list of villager indexes from the teller to the listener along paths.
//
// Route rules (the page, the solver and the bots all use these):
//   - each step goes along a path to a neighbour;
//   - no straight U-turn (a, b, a): dragging back onto the villager before is how the player undoes;
//   - the route never re-enters the teller, and it ends when it reaches the listener;
//   - a villager may be visited again through a loop, except a sleepy one, who goes home after speaking;
//   - the timid villager will not take news that is red;
//   - at most MAX_HOPS hops.

export const SHAPES = ['circle', 'square', 'triangle', 'star'];
export const COLOURS = ['red', 'yellow', 'blue', 'green'];
export const MAX_COUNT = 3;
export const MAX_HOPS = 14;
export const RED = 0;

// What a villager does to the message as they pass it on. A change is a small integer:
//   0 nothing; 1..4 paint it colour 0..3; 5 one more; 6 one fewer; 7 swap circle and square;
//   8 swap triangle and star; 9..12 make it shape 0..3; 13 the opposite colour.
export const KINDS = ['teller', 'listener', 'honest', 'paint', 'more', 'less', 'swap', 'carve', 'flip', 'timid', 'parrot'];
export function changeOf(node) {
  switch (node.kind) {
    case 'paint': return 1 + node.arg;
    case 'more': return 5;
    case 'less': return 6;
    case 'swap': return 7 + node.arg;
    case 'carve': return 9 + node.arg;
    case 'flip': return 13;
    default: return 0; // teller, listener, honest, timid; a parrot is decided by the route
  }
}
// Opposite colours: red and green, yellow and blue.
export const opposite = c => 3 - c;

export function apply(change, m) {
  if (change === 0) return m;
  if (change <= 4) return { s: m.s, c: change - 1, n: m.n };
  if (change === 5) return { s: m.s, c: m.c, n: Math.min(MAX_COUNT, m.n + 1) };
  if (change === 6) return { s: m.s, c: m.c, n: Math.max(1, m.n - 1) };
  if (change === 7) return { s: m.s === 0 ? 1 : m.s === 1 ? 0 : m.s, c: m.c, n: m.n };
  if (change === 8) return { s: m.s === 2 ? 3 : m.s === 3 ? 2 : m.s, c: m.c, n: m.n };
  if (change <= 12) return { s: change - 9, c: m.c, n: m.n };
  if (change === 13) return { s: m.s, c: opposite(m.c), n: m.n };
  return m;
}
export const msgKey = m => m.s * 16 + m.c * 4 + (m.n - 1);
export const fromKey = k => ({ s: k >> 4, c: (k >> 2) & 3, n: (k & 3) + 1 });
export const same = (a, b) => a.s === b.s && a.c === b.c && a.n === b.n;

// Neighbour lists from the edge list, sorted so every search is deterministic.
export function adjacency(level) {
  if (level._adj) return level._adj;
  const adj = level.nodes.map(() => []);
  for (const [a, b] of level.edges) { adj[a].push(b); adj[b].push(a); }
  for (const list of adj) list.sort((x, y) => x - y);
  Object.defineProperty(level, '_adj', { value: adj, enumerable: false });
  return adj;
}
export const linked = (level, a, b) => adjacency(level)[a].includes(b);

// Can the route step to `next`? Returns null if it can, or the reason it cannot:
// 'far' (no path), 'back' (a U-turn), 'teller', 'done' (the route already reached the listener),
// 'red' (the timid villager refuses red news), 'asleep' (a sleepy villager already spoke), 'long'.
export function refuse(level, route, msgs, next) {
  const end = route[route.length - 1];
  if (end === level.to) return 'done';
  if (route.length - 1 >= MAX_HOPS) return 'long';
  if (next === level.from) return 'teller';
  if (!linked(level, end, next)) return 'far';
  if (route.length >= 2 && route[route.length - 2] === next) return 'back';
  const node = level.nodes[next];
  if (node.kind === 'timid' && msgs[msgs.length - 1].c === RED) return 'red';
  if (node.once && route.includes(next)) return 'asleep';
  return null;
}

// Walk a route. msgs[i] is the message as villager route[i] passes it on (for the listener: as heard).
// changes[i] is the change villager route[i] made (a parrot's copied change included).
export function walk(level, route) {
  const out = { valid: true, reason: null, at: -1, msgs: [], changes: [], arrived: false, correct: false };
  if (!route.length || route[0] !== level.from) return { ...out, valid: false, reason: 'start', at: 0 };
  out.msgs.push(level.start); out.changes.push(0);
  for (let i = 1; i < route.length; i++) {
    const why = refuse(level, route.slice(0, i), out.msgs, route[i]);
    if (why) return { ...out, valid: false, reason: why, at: i };
    const node = level.nodes[route[i]];
    const prev = out.msgs[i - 1];
    if (route[i] === level.to) { out.msgs.push(prev); out.changes.push(0); continue; }
    const change = node.kind === 'parrot' ? out.changes[i - 1] : changeOf(node);
    out.msgs.push(apply(change, prev)); out.changes.push(change);
  }
  out.arrived = route[route.length - 1] === level.to;
  out.correct = out.arrived && same(out.msgs[out.msgs.length - 1], level.want);
  return out;
}

export function stars(hops, min) { return hops <= min ? 3 : hops <= min + 2 ? 2 : 1; }

// The solver: breadth-first over (villager, came from, message, last change, sleepy villagers used).
// Counts every distinct route by length, so it reports the shortest length, how many shortest routes
// there are, and how many routes up to `extra` hops longer.
//   options.ban: villager indexes the route may not enter
//   options.relax: treat timid villagers as honest and sleepy ones as always awake
//   options.simple: never visit a villager twice
//   options.want: a message to look for instead of level.want; options.any: report every message the
//     listener can hear and the fewest hops for each, instead of solving
export function solve(level, options = {}) {
  const { ban = [], relax = false, simple = false, extra = 2, any = false, maxHops = MAX_HOPS } = options;
  const want = options.want ?? level.want;
  const adj = adjacency(level), nodes = level.nodes, N = nodes.length;
  const sleepyBit = new Map(); let bits = 0;
  if (!relax) nodes.forEach((n, i) => { if (n.once) sleepyBit.set(i, bits++); });
  const banned = new Set(ban);
  // A state is packed into an integer; its route count and one route (for hints) ride along.
  const pack = (node, prev, m, last, mask) => ((((node * (N + 1) + prev + 1) * 64 + m) * 14 + last) * 2 ** (simple ? N : bits) + mask);
  let layer = new Map();
  layer.set(pack(level.from, -1, msgKey(level.start), 0, 0), { node: level.from, prev: -1, m: msgKey(level.start), last: 0, mask: 0, count: 1, route: [level.from] });
  const hear = new Map(); // message key -> fewest hops (any mode)
  const byLength = []; let min = Infinity, best = null;
  for (let hops = 1; hops <= maxHops && layer.size; hops++) {
    if (!any && hops > min + extra) break;
    const next = new Map();
    let found = 0;
    for (const st of layer.values()) {
      for (const v of adj[st.node]) {
        if (v === st.prev || v === level.from || banned.has(v)) continue;
        const node = nodes[v], msg = fromKey(st.m);
        if (!relax && node.kind === 'timid' && msg.c === RED) continue;
        if (simple && (st.mask >> v) & 1) continue;
        if (!simple && sleepyBit.has(v) && (st.mask >> sleepyBit.get(v)) & 1) continue;
        if (v === level.to) {
          if (any) { if (!hear.has(st.m)) hear.set(st.m, hops); continue; }
          if (same(msg, want)) { found += st.count; if (!best) best = [...st.route, v]; }
          continue;
        }
        const change = node.kind === 'parrot' ? st.last : changeOf(node);
        const m = msgKey(apply(change, msg));
        let mask = st.mask;
        if (simple) mask |= 1 << v; else if (sleepyBit.has(v)) mask |= 1 << sleepyBit.get(v);
        if (simple && st.node === level.from) mask |= 1 << level.from;
        const k = pack(v, st.node, m, change, mask);
        const old = next.get(k);
        if (old) old.count += st.count;
        else next.set(k, { node: v, prev: st.node, m, last: change, mask, count: st.count, route: [...st.route, v] });
      }
    }
    byLength[hops] = found;
    if (found && min === Infinity) min = hops;
    layer = next;
  }
  if (any) return hear;
  if (min === Infinity) return { solvable: false, min: Infinity, best: null, countMin: 0, countUpTo: 0, byLength };
  let countUpTo = 0;
  for (let h = min; h <= min + extra && h < byLength.length; h++) countUpTo += byLength[h] || 0;
  return { solvable: true, min, best, countMin: byLength[min], countUpTo, byLength };
}

// Every shortest path by distance alone, ignoring what villagers do: the routes a player tries first.
export function straightPaths(level) {
  const adj = adjacency(level), dist = level.nodes.map(() => Infinity);
  dist[level.to] = 0; const queue = [level.to];
  while (queue.length) { const a = queue.shift(); for (const b of adj[a]) if (dist[b] === Infinity) { dist[b] = dist[a] + 1; queue.push(b); } }
  const out = [];
  const go = route => {
    const end = route[route.length - 1];
    if (end === level.to) { out.push(route); return; }
    for (const b of adj[end]) if (dist[b] === dist[end] - 1) go([...route, b]);
  };
  go([level.from]);
  return out;
}

// A hint: the first `k` hops of the solver's best route.
export function hint(level, k) {
  const { best } = solve(level, { extra: 0 });
  return best ? best.slice(0, Math.min(best.length, k + 1)) : [level.from];
}

// A player with no plan: wanders along open paths until the listener, up to `sends` tries.
// Its win rate over many tries is the difficulty measure used to order levels and by the bots.
export function wander(level, r, sends = 3) {
  const adj = adjacency(level);
  for (let s = 0; s < sends; s++) {
    const route = [level.from];
    let w = walk(level, route);
    while (!w.arrived && route.length - 1 < MAX_HOPS) {
      const options = adj[route[route.length - 1]].filter(v => !refuse(level, route, w.msgs, v));
      if (!options.length) break;
      route.push(options[Math.floor(r() * options.length)]);
      w = walk(level, route);
    }
    if (w.correct) return { won: true, sends: s + 1, hops: route.length - 1 };
  }
  return { won: false, sends };
}
export function wanderRate(level, seed = 1, trials = 300) {
  const r = rng(seed);
  let wins = 0;
  for (let t = 0; t < trials; t++) if (wander(level, r).won) wins++;
  return wins / trials;
}

// ---------------------------------------------------------------- the generator

// A small integer random source (mulberry32): the same seed gives the same numbers everywhere.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = list => list[Math.floor(next() * list.length)];
  next.shuffle = list => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  return next;
}

// A kind with its argument, drawn for a generated villager.
function draw(r, kind) {
  if (kind === 'paint') return { kind, arg: r.int(0, 3) };
  if (kind === 'swap') return { kind, arg: r.int(0, 1) };
  if (kind === 'carve') return { kind, arg: r.int(0, 3) };
  return { kind };
}

// Does the newest idea in the level matter? A changer matters if no shortest route avoids every
// changer of that kind; a timid or sleepy villager matters if the level would be shorter without the rule.
export function essential(level, kind) {
  const base = solve(level, { extra: 0 });
  if (!base.solvable) return false;
  if (kind === 'timid' || kind === 'once') {
    const loose = solve(level, { relax: true, extra: 0 });
    return loose.min < base.min;
  }
  const ban = level.nodes.map((n, i) => (n.kind === kind ? i : -1)).filter(i => i >= 0);
  if (!ban.length) return false;
  const without = solve(level, { ban, extra: 0, maxHops: base.min });
  return !without.solvable;
}

// Build one village from a seed and a spec. Returns null when this seed does not meet the spec.
//   spec = { rows: [lo, hi], villagers: [lo, hi] (teller and listener included), kinds: [[kind, weight]...],
//            must: kind or 'timid' or 'once', hops: [lo, hi], straight: true to reject levels that a
//            shortest-by-distance path solves, revisit: true to need a villager twice, sleepy: [lo, hi],
//            maxMin: most shortest routes allowed }
export function build(seed, spec) {
  const r = rng(seed);
  const R = r.int(spec.rows[0], spec.rows[1]), C = 3;
  const total = r.int(spec.villagers[0], spec.villagers[1]);
  const cells = [];
  for (let row = 0; row < R; row++) for (let col = 0; col < C; col++) cells.push([col, row]);
  const listenerCell = [r.int(0, 2), 0], tellerCell = [r.int(0, 2), R - 1];
  const free = r.shuffle(cells.filter(([c, w]) => !(c === listenerCell[0] && w === 0) && !(c === tellerCell[0] && w === R - 1)));
  // Middle rows first, so the village fills the space between teller and listener.
  free.sort((a, b) => (a[1] === 0 || a[1] === R - 1 ? 1 : 0) - (b[1] === 0 || b[1] === R - 1 ? 1 : 0));
  const placed = [tellerCell, listenerCell, ...free.slice(0, Math.min(free.length, total - 2))];
  const at = new Map(placed.map((p, i) => [p.join(','), i]));
  // Paths: neighbours across, down and on the diagonal; a 2x2 square keeps at most one diagonal.
  // A long path over an empty cell is allowed once per empty cell, so two long paths never cross.
  let edges = [];
  const over = new Set();
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const dc = Math.abs(placed[i][0] - placed[j][0]), dr = Math.abs(placed[i][1] - placed[j][1]);
    const mid = [(placed[i][0] + placed[j][0]) / 2, (placed[i][1] + placed[j][1]) / 2].join(',');
    if (dc <= 1 && dr <= 1) edges.push([i, j]);
    else if (((dc === 2 && dr === 0) || (dr === 2 && dc === 0)) && !at.has(mid) && !over.has(mid)) { over.add(mid); edges.push([i, j]); }
  }
  const diag = e => Math.abs(placed[e[0]][0] - placed[e[1]][0]) === 1 && Math.abs(placed[e[0]][1] - placed[e[1]][1]) === 1;
  const box = e => [Math.min(placed[e[0]][0], placed[e[1]][0]), Math.min(placed[e[0]][1], placed[e[1]][1])].join(',');
  const seen = new Map();
  edges = r.shuffle(edges).filter(e => { if (!diag(e)) return true; const b = box(e); if (seen.has(b)) return false; seen.set(b, true); return true; });
  const connected = list => {
    const adj = placed.map(() => []); for (const [a, b] of list) { adj[a].push(b); adj[b].push(a); }
    const got = new Set([0]), q = [0];
    while (q.length) for (const b of adj[q.shift()]) if (!got.has(b)) { got.add(b); q.push(b); }
    return got.size === placed.length;
  };
  // Thin the paths so routes have to be chosen, keeping the village in one piece.
  const drop = spec.drop ?? 0.35;
  for (const e of r.shuffle([...edges])) {
    if (r() > drop) continue;
    const rest = edges.filter(x => x !== e);
    if (connected(rest)) edges = rest;
  }
  if (!connected(edges)) return null;
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const nodes = placed.map(([col, row], i) => {
    const jx = i < 2 ? 0 : (r() - 0.5) * 0.12, jy = i < 2 ? 0 : (r() - 0.5) * 0.18;
    return { x: +((col + 0.5) / C + jx).toFixed(3), y: +(row / (R - 1) + jy * (1 / (R - 1))).toFixed(3), kind: i === 0 ? 'teller' : i === 1 ? 'listener' : 'honest' };
  });
  const bag = []; for (const [k, w] of spec.kinds) for (let i = 0; i < w; i++) bag.push(k);
  for (let i = 2; i < nodes.length; i++) Object.assign(nodes[i], draw(r, r.pick(bag)));
  const sleepy = spec.sleepy ? r.int(spec.sleepy[0], spec.sleepy[1]) : 0;
  for (const i of r.shuffle(nodes.map((_, i) => i).slice(2)).slice(0, sleepy)) nodes[i].once = true;
  const start = { s: r.int(0, 3), c: r.int(0, 3), n: r.int(1, 2) };
  const level = { nodes, edges, from: 0, to: 1, start, want: start };
  // Every message the listener can hear, and the fewest hops for it; pick one in the hop range.
  const hear = solve(level, { any: true, maxHops: spec.hops[1] });
  const options = r.shuffle([...hear.entries()].filter(([k, h]) => h >= spec.hops[0] && h <= spec.hops[1] && k !== msgKey(start)));
  for (const [k] of options.slice(0, 6)) {
    const want = fromKey(k), lv = { ...level, want };
    const sol = solve(lv);
    if (!sol.solvable || sol.min < spec.hops[0] || sol.min > spec.hops[1]) continue;
    if (spec.maxMin && sol.countMin > spec.maxMin) continue;
    if (spec.must && !essential(lv, spec.must)) continue;
    if (spec.straight && straightPaths(lv).some(p => walk(lv, p).correct)) continue;
    if (spec.revisit && solve(lv, { simple: true, extra: 0, maxHops: sol.min }).solvable) continue;
    return { ...lv, seed, min: sol.min };
  }
  return null;
}

// Search seeds from `seed` upward until one meets the spec; deterministic for the same arguments.
export function generate(seed, spec, tries = 400) {
  for (let i = 0; i < tries; i++) {
    const lv = build((seed + i * 7919) >>> 0, spec);
    if (lv) return lv;
  }
  return null;
}

// ---------------------------------------------------------------- the daily village

export const DAILY_SPEC = {
  rows: [4, 5], villagers: [7, 9],
  kinds: [['honest', 1], ['paint', 3], ['more', 2], ['less', 2], ['swap', 2], ['carve', 2], ['flip', 2], ['timid', 1], ['parrot', 1]],
  hops: [5, 8], straight: true, maxMin: 6, sleepy: [0, 1],
};
// The seed for a calendar day, from the player's local date (year, month 1..12, day).
export function dailySeed(y, m, d) {
  let h = (y * 10000 + m * 100 + d) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
// The daily village. If no seed in the search meets the spec, a looser spec is tried, then a fixed level.
export function daily(seed, fallback = null) {
  return generate(seed, DAILY_SPEC, 300)
    ?? generate(seed, { ...DAILY_SPEC, hops: [4, 9], maxMin: 0, straight: false }, 300)
    ?? fallback;
}
