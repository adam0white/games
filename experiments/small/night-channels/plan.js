// Route planning over visible terrain. Used by the page (par), the bots and the browser check.
export function neighbours(s, n) {
  const x = n % s.cols, out = [];
  if (x > 0) out.push(n - 1);
  if (x + 1 < s.cols) out.push(n + 1);
  if (n - s.cols >= 0) out.push(n - s.cols);
  if (n + s.cols < s.cells.length) out.push(n + s.cols);
  return out;
}
const open = c => c.dug || c.kind === 'spring' || c.kind === 'bed';
// Cells joined to a spring through open ground.
export function wetNetwork(s) {
  const seen = new Set(s.cells.flatMap((c, i) => c.kind === 'spring' ? [i] : []));
  for (const i of seen) for (const n of neighbours(s, i)) if (open(s.cells[n])) seen.add(n);
  return seen;
}
// Cheapest path (in new cuts) from the spring network to each unserved bed, nearest first.
// climb: extra cost for a step uphill. Returns drags: each starts on the network and ends on a bed.
export function routes(s, { climb = 2 } = {}) {
  const dug = new Set(), drags = [], served = new Set();
  const isOpen = i => open(s.cells[i]) || dug.has(i);
  for (let guard = 0; guard < s.beds.length; guard++) {
    const n = s.cells.length, cost = Array(n).fill(Infinity), prev = Array(n).fill(-1);
    const net = new Set(s.cells.flatMap((c, i) => c.kind === 'spring' ? [i] : []));
    for (const i of net) for (const m of neighbours(s, i)) if (isOpen(m)) net.add(m);
    const todo = new Set(net);
    for (const i of net) cost[i] = 0;
    while (todo.size) {
      let best;
      for (const i of todo) if (best === undefined || cost[i] < cost[best]) best = i;
      todo.delete(best);
      for (const m of neighbours(s, best)) {
        const c = s.cells[m];
        if (c.kind === 'rock') continue;
        const d = cost[best] + (isOpen(m) ? 0 : 1) + (m === best - s.cols ? climb : 0) + (c.kind === 'sand' ? .007 : 0) + .0001;
        if (d >= cost[m]) continue;
        cost[m] = d; prev[m] = best; todo.add(m);
      }
    }
    const target = s.beds.filter(i => !net.has(i) && !served.has(i)).sort((a, b) => cost[a] - cost[b])[0];
    if (target === undefined || !Number.isFinite(cost[target])) break;
    const path = [];
    for (let i = target; i !== -1; i = prev[i]) path.unshift(i);
    served.add(target);
    for (const i of path) if (!isOpen(i)) dug.add(i);
    drags.push(path);
  }
  return { drags, cuts: [...dug] };
}

// Par: the fewest cuts of a planned route that the rules confirm flowers every bed within 90 seconds.
// The cheapest connected route can starve a far bed, so each candidate is played out before it counts.
// Returns { cuts, drags } or null when no candidate flowers.
export function par({ create, dig, tick }, level, day = null, { verify = true } = {}) {
  let best = null;
  for (const climb of [2, 0, 1, 4, 8]) {
    const plan = routes(create(level, day), { climb });
    if (best && plan.cuts.length >= best.cuts) continue;
    if (verify && !flowers({ create, dig, tick }, level, day, plan.drags)) continue;
    best = { cuts: plan.cuts.length, drags: plan.drags };
  }
  if (!best && verify) {
    // A terrace route: the trunk straight down to a high cross-channel, then down to each bed.
    for (let row = 1; row < 6 && !best; row++) {
      const s = create(level, day), drags = terrace(s, row);
      if (!drags) continue;
      const cuts = new Set(drags.flat().filter(i => !s.cells[i].dug && (s.cells[i].kind === 'soil' || s.cells[i].kind === 'sand'))).size;
      if (cuts <= s.budget && flowers({ create, dig, tick }, level, day, drags)) best = { cuts, drags };
    }
  }
  return best;
}
export function flowers({ create, dig, tick }, level, day, drags) {
  const s = create(level, day);
  for (const d of drags) for (const i of d) if (dig(s, i)) for (let k = 0; k < 3 && !s.won; k++) tick(s);
  for (let k = 0; k < 2700 && !s.won; k++) tick(s);
  return s.won;
}
function terrace(s, row) {
  const x0 = s.source % s.cols, y0 = Math.floor(s.source / s.cols), drags = [];
  for (const bed of s.beds) {
    const bx = bed % s.cols, by = Math.floor(bed / s.cols), d = [];
    for (let y = y0; y <= row; y++) d.push(y * s.cols + x0);
    for (let x = x0; x !== bx; x += Math.sign(bx - x0)) d.push(row * s.cols + x + Math.sign(bx - x0));
    for (let y = row; y !== by; y += Math.sign(by - row)) d.push((y + Math.sign(by - row)) * s.cols + bx);
    if (d.some(i => s.cells[i].kind === 'rock')) return null;
    drags.push(d);
  }
  return drags;
}

// Par of gardens 1 to 30, from par() above. bots.mjs claims the two agree.
export const PARS = [3, 6, 8, 7, 10, 9, 12, 12, 13, 11, 4, 4, 3, 5, 6, 6, 7, 7, 11, 5, 9, 16, 13, 11, 11, 13, 9, 9, 13, 11];
