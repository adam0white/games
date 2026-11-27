// The nest view (page only; the sim is not touched): the chambers the colony has dug, named and sized; the stores as
// heaps in the queen's chamber; brood drawn by how far it has grown; the queen as a living ant who lays.
//
// A chamber is a connected group of open nest cells around a core at least three cells wide and two high (so shafts
// and tunnels are not chambers), six cells or more. The one holding the middle of sim.home is the queen's chamber. Found again
// when the terrain changes (host.terrainVersion), not every frame.
import { MAT } from './sim/grid.js';
import { STAGE, C } from './sim/colony.js';
import { LOOKS } from './looks.js';

const INK = LOOKS.ink;

export function findRooms(sim) {
  const L = sim.L, w = L.nw, h = L.nh, base = L.nestBase, mat = sim.mat;
  const open = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mat[base + y * w + x] === MAT.OPEN;
  // Core: open cells whose eight neighbours are open, in a row of three or more such cells and a column of two or
  // more, so shafts and tunnels up to three cells wide are not rooms. A room is a core grown by one cell into open cells.
  const all8 = new Uint8Array(w * h), core = new Uint8Array(w * h), inner = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!open(x, y)) continue;
    let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && open(x + dx, y + dy)) n++;
    if (n === 8) all8[y * w + x] = 1;
  }
  const a8 = (x, y) => x >= 0 && y >= 0 && x < w && y < h && all8[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!a8(x, y)) continue;
    let rx = 1, ry = 1;
    for (let k = 1; a8(x - k, y); k++) rx++; for (let k = 1; a8(x + k, y); k++) rx++;
    for (let k = 1; a8(x, y - k); k++) ry++; for (let k = 1; a8(x, y + k); k++) ry++;
    if (rx >= 3 && ry >= 2) core[y * w + x] = 1;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!open(x, y)) continue;
    for (let dy = -1; dy <= 1 && !inner[y * w + x]; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && core[ny * w + nx]) { inner[y * w + x] = 1; break; } }
  }
  const seen = new Int32Array(w * h).fill(-1), rooms = [], q = [];
  const qn = sim.nursery ?? sim.home, hx = qn.x + (qn.w >> 1), hy = qn.y + (qn.h >> 1); // the queen lives in the nursery (sim 8)
  const px = sim.home.x + (sim.home.w >> 1), py = sim.home.y + (sim.home.h >> 1);
  for (let c0 = 0; c0 < w * h; c0++) {
    if (!inner[c0] || seen[c0] >= 0) continue;
    const id = rooms.length, cells = []; q.length = 0; q.push(c0); seen[c0] = id;
    while (q.length) {
      const c = q.pop(); cells.push(c);
      const x = c % w, y = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nc = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && inner[nc] && seen[nc] < 0) { seen[nc] = id; q.push(nc); }
      }
    }
    let sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const c of cells) { const x = c % w, y = (c / w) | 0; sx += x; sy += y; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    rooms.push({ id, cells, size: cells.length, cx: sx / cells.length + 0.5, cy: sy / cells.length + 0.5, x0, y0, x1, y1, queen: false, store: false });
  }
  const out = rooms.filter(r => r.size >= 6);
  for (const r of out) { if (r.cells.includes(hy * w + hx)) r.queen = true; if (r.cells.includes(py * w + px)) r.store = true; }
  out.sort((a, b) => (b.queen - a.queen) || (a.y0 - b.y0) || (a.x0 - b.x0));
  return out;
}

/** Grows 0..1 for one brood item: an egg by age, a larva by meals (and age within its meal), a pupa by age. */
export function growth(B, k) {
  const age = B.age[k];
  if (B.stage[k] === STAGE.EGG) return Math.min(1, age / C.EGG_TICKS);
  if (B.stage[k] === STAGE.LARVA) return Math.min(1, Math.max(age / C.LARVA_TICKS, B.fed[k] / C.MAJOR_FEEDS));
  return Math.min(1, age / C.PUPA_TICKS);
}

/** Draws rooms, stores, brood and the queen on a 2D context. v: { ctx, sim, toScreen, z, W, H, now, t, rooms, g, look } */
export function drawNest(v) {
  const { ctx, sim, toScreen, z, W, H, now, rooms, t } = v, g = v.g, L = v.look ?? INK;
  // Rooms: a soft warm tint inside, a label with the name and size.
  ctx.save();
  for (const r of rooms) {
    ctx.fillStyle = r.queen ? L.roomQueen : L.roomOther;
    ctx.beginPath(); // one path, filled once: overlapping cell edges do not darken into a grid
    for (const c of r.cells) { const p = toScreen(c % sim.L.nw, (c / sim.L.nw) | 0); ctx.rect(p.x - 0.25, p.y - 0.25, z + 0.5, z + 0.5); }
    ctx.fill();
  }
  ctx.font = `600 ${Math.max(10, Math.min(14, z * 1.4))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  rooms.forEach((r, k) => {
    const p = toScreen((r.x0 + r.x1 + 1) / 2, r.y0);
    if (p.x < -80 || p.x > W + 80 || p.y < -20 || p.y > H + 40) return;
    const label = r.queen ? t('roomQueen', { n: r.size }) : t('roomOther', { k, n: r.size });
    ctx.lineWidth = 3; ctx.strokeStyle = L.halo; ctx.strokeText(label, p.x, p.y - 2);
    ctx.fillStyle = L.label; ctx.fillText(label, p.x, p.y - 2);
  });
  // Stores in the store room (the porch in a colony game, sim 8; the queen's chamber when the porch is too small to be
  // a room, or in the sandbox): sugar as pale grains along the left wall, protein as red-brown bits along the right.
  const ph = sim.home, porch = sim.nursery ? { x0: ph.x, y0: ph.y, x1: ph.x + ph.w - 1, y1: ph.y + ph.h - 1, cx: ph.x + ph.w / 2 } : null;
  const qr = porch ?? rooms.find(r => r.store) ?? rooms.find(r => r.queen); // the porch even when digging joins it to a room
  if (qr) {
    for (const [amount, x, col, rr] of [[sim.g[g.SUGAR], qr.x0 + 0.2, L.sugar, 0.16], [sim.g[g.PROTEIN], qr.x1 + 0.8, L.protein, 0.2]]) {
      const n = Math.min(60, amount); // a grain a load (sim 8: a load is a unit)
      ctx.fillStyle = col; ctx.strokeStyle = L.grainRim; ctx.lineWidth = 0.8;
      for (let i = 0; i < n; i++) {
        const row = Math.floor(Math.sqrt(i)), off = i - row * row; // a heap: more grains low down
        const p = toScreen(x + (x < qr.cx ? 1 : -1) * ((off * 0.37) % 1.2), qr.y1 + 0.8 - row * 0.28 - ((i * 0.618) % 0.1));
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, z * rr), 0, 7); ctx.fill(); if (z > 8) ctx.stroke();
      }
    }
  }
  // Brood: eggs swell, larvae grow and curl with each meal (a hungry one is pale with a red spot), pupae darken toward hatching.
  const B = sim.brood;
  ctx.lineWidth = 1; ctx.strokeStyle = L.broodLine;
  for (let k = 0; k < B.n; k++) {
    const c = B.cell[k], x = (c - sim.L.nestBase) % sim.L.nw, y = ((c - sim.L.nestBase) / sim.L.nw) | 0;
    const p = toScreen(x + 0.25 + ((k * 0.618034) % 1) * 0.5, y + 0.25 + ((k * 0.381966) % 1) * 0.5);
    if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) continue;
    const gr = growth(B, k), st = B.stage[k];
    ctx.beginPath();
    if (st === STAGE.EGG) { ctx.fillStyle = L.egg; ctx.ellipse(p.x, p.y, Math.max(1.5, z * (0.14 + 0.06 * gr)), Math.max(1.2, z * (0.1 + 0.04 * gr)), 0.4, 0, 7); }
    else if (st === STAGE.LARVA) {
      const r = Math.max(2.5, z * (0.26 + 0.24 * gr)), hungry = B.hunger[k] > C.LARVA_STARVE / 2;
      ctx.fillStyle = hungry ? L.larvaHungry : L.larva;
      ctx.arc(p.x, p.y, r, 0.5, 0.5 + Math.PI * (1.3 + 0.4 * gr)); ctx.lineTo(p.x, p.y); // a C-shaped grub that closes as it grows
      ctx.fill(); if (z > 5) ctx.stroke();
      if (hungry) { ctx.fillStyle = '#b8432f'; ctx.beginPath(); ctx.arc(p.x + r * 0.6, p.y - r * 0.6, Math.max(1.2, r * 0.25), 0, 7); ctx.fill(); }
      continue;
    } else {
      const shade = Math.round(L.pupa[0] - L.pupa[1] * gr);
      ctx.fillStyle = `rgb(${shade}, ${Math.round(shade * 0.8)}, ${Math.round(shade * 0.55)})`;
      ctx.ellipse(p.x, p.y, Math.max(2, z * 0.4), Math.max(1.5, z * 0.26), 0.6, 0, 7);
    }
    ctx.fill(); if (z > 6) ctx.stroke();
  }
  if (sim.g[g.QUEEN]) drawQueen(v);
  ctx.restore();
}

/** The queen: head, thorax, a long abdomen that swells as she lays, six legs, antennae. */
function drawQueen({ ctx, sim, toScreen, z, now, g, look }) {
  const L = look ?? INK;
  const h = sim.nursery ?? sim.home, q = toScreen(h.x + h.w / 2, h.y + h.h / 2), u = Math.max(5, z * 1.1);
  const laying = sim.g[g.LAY] > 0 ? 1 - sim.g[g.LAY] / C.LAY_EVERY : 1, pulse = 1 + 0.06 * Math.sin(now / 300) + 0.08 * laying;
  ctx.strokeStyle = L.queenLegs; ctx.lineWidth = Math.max(1, u * 0.1); ctx.lineCap = 'round';
  for (let l = 0; l < 3; l++) for (const s of [-1, 1]) { // legs from the thorax
    const lx = q.x + (l - 1) * u * 0.35, a = (l - 1) * 0.5 + Math.sin(now / 500 + l) * 0.05;
    ctx.beginPath(); ctx.moveTo(lx, q.y); ctx.lineTo(lx + Math.sin(a) * u * 0.5, q.y + s * u * 0.55); ctx.lineTo(lx + Math.sin(a) * u * 0.9, q.y + s * u * 0.85); ctx.stroke();
  }
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(q.x + u * 1.0, q.y); ctx.quadraticCurveTo(q.x + u * 1.4, q.y + s * u * 0.2, q.x + u * 1.6, q.y + s * u * 0.55); ctx.stroke(); }
  ctx.fillStyle = L.queen; ctx.strokeStyle = L.queenRim; ctx.lineWidth = 1.5;
  for (const [dx, rx, ry] of [[-1.25, 0.95 * pulse, 0.62 * pulse], [0, 0.42, 0.32], [0.85, 0.34, 0.3]]) { ctx.beginPath(); ctx.ellipse(q.x + dx * u, q.y, rx * u, ry * u, 0, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.strokeStyle = L.queenBands; ctx.lineWidth = 1; // bands on the abdomen
  for (let b = 0; b < 3; b++) { ctx.beginPath(); ctx.ellipse(q.x - (1.0 + b * 0.32) * u, q.y, 0.08 * u, 0.55 * u * pulse, 0, 0, 7); ctx.stroke(); }
}
