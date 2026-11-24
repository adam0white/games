// Grapevine rules. Pure and deterministic: no window, no document, runs in Node for the bots.
//
// A message has a shape, a colour and a count. The teller hands it to a neighbour; each villager on the
// route changes it in their own fixed way as they pass it on; the listener wants one exact message.
// A route is a list of villager indexes from the teller to the listener along paths.
//
// Route rules (the page, the solver and the bots all use step() below):
//   - each step goes along a path to a neighbour;
//   - a one-way lane can only be walked in its direction;
//   - a gate on a path can only be passed while it is open; each bell ringer on the route swaps every gate
//     (open ones shut, shut ones open);
//   - no straight U-turn (a, b, a): dragging back onto the villager before is how the player undoes;
//   - the route never re-enters the teller, and it ends when it reaches the listener;
//   - a villager may be visited again through a loop, except a sleepy one, who goes home after speaking;
//   - the timid villager will not take news that is red;
//   - the keeper hands on the news they heard last time (at first, the news they hold at the start) and keeps
//     the new news for next time;
//   - at most MAX_HOPS hops.

export const SHAPES = ['circle', 'square', 'triangle', 'star'];
export const COLOURS = ['red', 'yellow', 'blue', 'green'];
export const MAX_COUNT = 3;
export const MAX_HOPS = 14;
export const RED = 0;

// What a villager does to the message as they pass it on. A change is a small integer:
//   0 nothing; 1..4 paint it colour 0..3; 5 one more; 6 one fewer; 7 swap circle and square;
//   8 swap triangle and star; 9..12 make it shape 0..3; 13 the opposite colour.
// The keeper's swap is not a change: a parrot after a keeper repeats nothing.
export const KINDS = ['teller', 'listener', 'honest', 'paint', 'more', 'less', 'swap', 'carve', 'flip', 'timid', 'parrot', 'bell', 'keeper'];
export function changeOf(node) {
  switch (node.kind) {
    case 'paint': return 1 + node.arg;
    case 'more': return 5;
    case 'less': return 6;
    case 'swap': return 7 + node.arg;
    case 'carve': return 9 + node.arg;
    case 'flip': return 13;
    default: return 0; // teller, listener, honest, timid, bell, keeper; a parrot is decided by the route
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

// ---------------------------------------------------------------- paths, lanes and gates
// An edge is [a, b] (a two-way path) or [a, b, type]: 1 a one-way lane from a to b, 2 a gate that starts open,
// 3 a gate that starts shut.
export const PATH = 0, ONEWAY = 1, GATE_OPEN = 2, GATE_SHUT = 3;
export const isGate = t => t === GATE_OPEN || t === GATE_SHUT;
// Is a gate of this type open when the bells have been rung `phase` times (0 or 1, the parity)?
export const gateOpen = (t, phase) => (t === GATE_OPEN) !== (phase === 1);

// Neighbour lists: adj[a] is a sorted list of [b, type] for every path a route can take out of a.
// way[a][b] is the type of the path from a to b, -2 for a one-way lane that runs from b to a, and undefined for none.
export function adjacency(level) {
  if (level._adj) return level._adj;
  const adj = level.nodes.map(() => []), way = level.nodes.map(() => ({}));
  for (const [a, b, t = PATH] of level.edges) {
    adj[a].push([b, t]); way[a][b] = t;
    if (t === ONEWAY) way[b][a] = -2;
    else { adj[b].push([a, t]); way[b][a] = t; }
  }
  for (const list of adj) list.sort((x, y) => x[0] - y[0]);
  // both[a]: every neighbour of a, whichever way the lane runs (for the solver's two-way test)
  const both = way.map(w => Object.keys(w).map(Number).sort((x, y) => x - y).map(b => [b, w[b]]));
  Object.defineProperty(level, '_adj', { value: adj, enumerable: false });
  Object.defineProperty(level, '_both', { value: both, enumerable: false });
  Object.defineProperty(level, '_way', { value: way, enumerable: false });
  return adj;
}
export const lane = (level, a, b) => { adjacency(level); return level._way[a][b]; };
export const linked = (level, a, b) => { const t = lane(level, a, b); return t !== undefined && t !== -2; };
const keepersOf = level => {
  if (level._keepers) return level._keepers;
  const k = level.nodes.map((n, i) => (n.kind === 'keeper' ? i : -1)).filter(i => i >= 0);
  Object.defineProperty(level, '_keepers', { value: k, enumerable: false });
  return k;
};

// ---------------------------------------------------------------- one step of a route
// The state of a route after some steps: where it is, where it came from, the message, the last change made
// (for a parrot), how often the bells rang (parity), what each keeper holds (message keys, in keeper order),
// which sleepy villagers have spoken (a bit mask), and the hop count.
export function startState(level) {
  return { node: level.from, prev: -1, m: level.start, last: 0, phase: 0, memo: keepersOf(level).map(i => msgKey(level.nodes[i].memo)), asleep: 0, seen: 0, hops: 0 };
}
// Take one step to villager v. Returns the new state, or the reason the route cannot go there:
// 'done' (it already reached the listener), 'long', 'teller', 'far' (no path), 'oneway' (a lane the other way),
// 'back' (a U-turn), 'shut' (a shut gate), 'red' (a timid villager refuses red news), 'asleep' (a sleepy villager
// already spoke).
//   o.relax: timid villagers take anything and sleepy ones never sleep; o.twoWay: lanes go both ways;
//   o.simple: never visit a villager twice (for the solver's loop test)
const NONE = {};
export function step(level, st, v, o = NONE) {
  if (st.node === level.to) return 'done';
  if (st.hops >= MAX_HOPS) return 'long';
  if (v === level.from) return 'teller';
  const t = lane(level, st.node, v);
  if (t === undefined) return 'far';
  if (t === -2 && !o.twoWay) return 'oneway';
  if (v === st.prev) return 'back';
  if (isGate(t) && !gateOpen(t, st.phase)) return 'shut';
  const node = level.nodes[v];
  if (!o.relax && node.kind === 'timid' && st.m.c === RED) return 'red';
  if (!o.relax && node.once && (st.asleep >> v) & 1) return 'asleep';
  if (o.simple && (st.seen >> v) & 1) return 'seen';
  let m = st.m, change = 0, phase = st.phase, memo = st.memo, asleep = st.asleep;
  if (v !== level.to) {
    if (node.kind === 'keeper') {
      const k = keepersOf(level).indexOf(v);
      memo = memo.slice(); m = fromKey(memo[k]); memo[k] = msgKey(st.m);
    } else {
      change = node.kind === 'parrot' ? st.last : changeOf(node);
      m = apply(change, m);
    }
    if (node.kind === 'bell') phase ^= 1;
    if (node.once) asleep |= 1 << v;
  }
  const seen = o.simple ? st.seen | (1 << st.node) | (1 << v) : 0;
  return { node: v, prev: st.node, m, last: change, phase, memo, asleep, seen, hops: st.hops + 1 };
}
// Can the route step to `next`? null if it can, or the reason it cannot (see step).
export function refuse(level, state, next) {
  const s = step(level, state, next);
  return typeof s === 'string' ? s : null;
}

// Walk a route. msgs[i] is the message as villager route[i] passes it on (for the listener: as heard).
// changes[i] is the change villager route[i] made (a parrot's copied change included); phases[i] and memos[i]
// are the bell parity and the keepers' news after villager route[i]. state is the state at the end.
export function walk(level, route) {
  const out = { valid: true, reason: null, at: -1, msgs: [], changes: [], phases: [], memos: [], arrived: false, correct: false, state: null };
  if (!route.length || route[0] !== level.from) return { ...out, valid: false, reason: 'start', at: 0 };
  let st = startState(level);
  out.msgs.push(st.m); out.changes.push(0); out.phases.push(0); out.memos.push(st.memo);
  for (let i = 1; i < route.length; i++) {
    const next = step(level, st, route[i]);
    if (typeof next === 'string') { out.state = st; return { ...out, valid: false, reason: next, at: i }; }
    st = next;
    out.msgs.push(st.m); out.changes.push(st.last); out.phases.push(st.phase); out.memos.push(st.memo);
  }
  out.state = st;
  out.arrived = route[route.length - 1] === level.to;
  out.correct = out.arrived && same(out.msgs[out.msgs.length - 1], level.want);
  return out;
}

export function stars(hops, min) { return hops <= min ? 3 : hops <= min + 2 ? 2 : 1; }

// The solver: breadth-first over route states (see startState). Counts every distinct route by length, so it
// reports the shortest length, how many shortest routes there are, and how many routes up to `extra` hops longer.
//   options.ban: villager indexes the route may not enter
//   options.relax, options.twoWay, options.simple: as in step()
//   options.want: a message to look for instead of level.want; options.any: report every message the
//     listener can hear and the fewest hops for each, instead of solving
export function solve(level, options = {}) {
  const { ban = [], extra = 2, any = false, maxHops = MAX_HOPS } = options;
  const want = options.want ?? level.want;
  const adj = options.twoWay ? (adjacency(level), level._both) : adjacency(level);
  const banned = new Set(ban);
  const key = s => `${s.node},${s.prev},${msgKey(s.m)},${s.last},${s.phase},${s.memo.join('.')},${s.asleep},${s.seen}`;
  const first = startState(level);
  let layer = new Map([[key(first), { st: first, count: 1, route: [level.from] }]]);
  const hear = new Map(); // message key -> fewest hops (any mode)
  const byLength = []; let min = Infinity, best = null;
  for (let hops = 1; hops <= maxHops && layer.size; hops++) {
    if (!any && hops > min + extra) break;
    const next = new Map();
    let found = 0;
    for (const { st, count, route } of layer.values()) {
      for (const [v] of adj[st.node]) {
        if (banned.has(v)) continue;
        const s = step(level, st, v, options);
        if (typeof s === 'string') continue;
        if (v === level.to) {
          if (any) { const k = msgKey(s.m); if (!hear.has(k)) hear.set(k, hops); continue; }
          if (same(s.m, want)) { found += count; if (!best) best = [...route, v]; }
          continue;
        }
        const k = key(s), old = next.get(k);
        if (old) old.count += count;
        else next.set(k, { st: s, count, route: [...route, v] });
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

// Every shortest path by distance alone, ignoring what villagers do and whether gates are shut: the routes a
// player tries first. One-way lanes are respected.
export function straightPaths(level) {
  const adj = adjacency(level), back = level.nodes.map(() => []);
  adj.forEach((list, a) => { for (const [b] of list) back[b].push(a); });
  const dist = level.nodes.map(() => Infinity);
  dist[level.to] = 0; const queue = [level.to];
  while (queue.length) { const a = queue.shift(); for (const b of back[a]) if (dist[b] === Infinity) { dist[b] = dist[a] + 1; queue.push(b); } }
  const out = [];
  const go = route => {
    const end = route[route.length - 1];
    if (end === level.to) { out.push(route); return; }
    for (const [b] of adj[end]) if (dist[b] === dist[end] - 1) go([...route, b]);
  };
  if (dist[level.from] < Infinity) go([level.from]);
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
    let st = startState(level);
    while (st.node !== level.to && st.hops < MAX_HOPS) {
      const options = [];
      for (const [v] of adj[st.node]) { const n = step(level, st, v); if (typeof n !== 'string') options.push(n); }
      if (!options.length) break;
      st = options[Math.floor(r() * options.length)];
      route.push(st.node);
    }
    if (st.node === level.to && same(st.m, level.want)) return { won: true, sends: s + 1, hops: route.length - 1 };
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

// Does the newest idea in the level matter?
//   a changer (and the keeper): no shortest route avoids every villager of that kind;
//   timid or sleepy: the level would be shorter without the rule;
//   oneway: the level would be shorter if the lanes went both ways;
//   bell: no route of the shortest length avoids every bell ringer (the gates have to be swapped).
export function essential(level, kind) {
  const base = solve(level, { extra: 0 });
  if (!base.solvable) return false;
  if (kind === 'timid' || kind === 'once') return solve(level, { relax: true, extra: 0 }).min < base.min;
  if (kind === 'oneway') return solve(level, { twoWay: true, extra: 0 }).min < base.min;
  const ban = level.nodes.map((n, i) => (n.kind === kind ? i : -1)).filter(i => i >= 0);
  if (!ban.length) return false;
  const without = solve(level, { ban, extra: 0, maxHops: base.min });
  return !without.solvable;
}

// Build one village from a seed and a spec. Returns null when this seed does not meet the spec.
//   spec = { rows: [lo, hi], villagers: [lo, hi] (teller and listener included), kinds: [[kind, weight]...],
//            must: kind or 'timid', 'once', 'oneway', hops: [lo, hi], straight: true to reject levels that a
//            shortest-by-distance path solves, revisit: true to need a villager twice, sleepy: [lo, hi],
//            maxMin: most shortest routes allowed,
//            oneway: [lo, hi] paths made one-way lanes, gates: [lo, hi] paths given a gate (at least one shut),
//            put: { kind: [lo, hi] } villagers turned into that kind (bell, keeper) after the kinds are drawn }
// The draws for oneway, gates and put happen after all the others and only when the spec asks for them, so the
// specs of levels 4 to 30 make the same villages as before these were added.
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
  // Newer board elements, drawn only when the spec asks for them.
  if (spec.put) {
    const spots = r.shuffle(nodes.map((_, i) => i).slice(2).filter(i => !nodes[i].once));
    for (const [kind, [lo, hi]] of Object.entries(spec.put)) {
      for (const i of spots.splice(0, r.int(lo, hi))) {
        nodes[i] = { x: nodes[i].x, y: nodes[i].y, kind };
        if (kind === 'keeper') nodes[i].memo = { s: r.int(0, 3), c: r.int(0, 3), n: r.int(1, 3) };
      }
    }
  }
  if (spec.oneway || spec.gates) {
    const order = r.shuffle(edges.map((_, i) => i));
    const lanes = spec.oneway ? r.int(spec.oneway[0], spec.oneway[1]) : 0;
    const gates = spec.gates ? r.int(spec.gates[0], spec.gates[1]) : 0;
    order.slice(0, lanes).forEach(i => { const [a, b] = edges[i]; edges[i] = r() < 0.5 ? [a, b, ONEWAY] : [b, a, ONEWAY]; });
    order.slice(lanes, lanes + gates).forEach((i, k) => { edges[i] = [edges[i][0], edges[i][1], k === 0 || r() < 0.4 ? GATE_SHUT : GATE_OPEN]; });
  }
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
    if (spec.also && !spec.also.every(kind => essential(lv, kind))) continue;
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

// Tier 0 is the daily village every player has had since the start. A player who has met the newer board elements
// gets them too: tier 1 adds one-way lanes (met at level 31), tier 2 gates and bell ringers (level 36),
// tier 3 the keeper (level 46). The page pins the tier for each date the first time it opens that date.
export const DAILY_SPEC = {
  rows: [4, 5], villagers: [7, 9],
  kinds: [['honest', 1], ['paint', 3], ['more', 2], ['less', 2], ['swap', 2], ['carve', 2], ['flip', 2], ['timid', 1], ['parrot', 1]],
  hops: [5, 8], straight: true, maxMin: 6, sleepy: [0, 1],
};
export const DAILY_TIERS = [
  DAILY_SPEC,
  { ...DAILY_SPEC, oneway: [1, 2], must: 'oneway' },
  { ...DAILY_SPEC, oneway: [0, 2], gates: [1, 2], put: { bell: [1, 1] }, must: 'bell' },
  { ...DAILY_SPEC, oneway: [0, 1], gates: [0, 1], put: { bell: [0, 1], keeper: [1, 1] }, must: 'keeper' },
];
// The level at which each tier opens: the daily uses the highest tier whose level the player has reached.
export const TIER_AT = [1, 32, 37, 47];
export const tierFor = opened => TIER_AT.reduce((t, at, i) => (opened >= at ? i : t), 0);
// The seed for a calendar day, from the player's local date (year, month 1..12, day).
export function dailySeed(y, m, d) {
  let h = (y * 10000 + m * 100 + d) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
// The daily village. If no seed in the search meets the spec, a looser spec is tried, then a lower tier,
// then a fixed level.
export function daily(seed, fallback = null, tier = 0) {
  for (let t = Math.min(tier, DAILY_TIERS.length - 1); t >= 0; t--) {
    const spec = DAILY_TIERS[t];
    const lv = generate(seed, spec, 300) ?? generate(seed, { ...spec, hops: [4, 9], maxMin: 0, straight: false, must: null }, 300);
    if (lv) return t === tier ? lv : { ...lv, tier: t };
  }
  return fallback;
}
