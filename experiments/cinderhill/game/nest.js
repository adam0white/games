// The nest as a cutaway (Canvas 2D), drawn in a panel over the lower part of the screen while the surface stays in
// view above it. Page only: it reads the sim and writes nothing. Soil in bands, tunnels as rounded hollows lit by
// a warm light from the queen's chamber, stores as heaps of grains, brood by stage, the queen, and the ants inside.
import { MAT } from '../sim/grid.js';
import { STAGE } from '../sim/colony.js';
import { NEST, G } from '../host.js';

const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const SOIL = { [MAT.ASH]: [58, 52, 48], [MAT.TOPSOIL]: [92, 66, 44], [MAT.CLAY]: [122, 72, 48], [MAT.STONE]: [84, 82, 84], [MAT.ROOT]: [70, 52, 30], [MAT.WATER]: [40, 70, 92] };

const soil = { canvas: null, host: null, version: -1 };
function paintSoil(host, sim, w, h, base) {
  const S = 4, c = soil.canvas ?? (soil.canvas = document.createElement('canvas')); c.width = w * S; c.height = h * S;
  const g = c.getContext('2d'), img = g.createImageData(w * S, h * S), d = img.data;
  for (let py = 0; py < h * S; py++) for (let px = 0; px < w * S; px++) {
    const x = Math.min(w - 1, Math.floor((px + (hash(px, py) - 0.5) * 3) / S)), y = Math.min(h - 1, Math.max(0, Math.floor((py + (hash(py, px) - 0.5) * 3) / S)));   // a ragged edge between kinds of earth
    const m = sim.mat[base + y * w + Math.max(0, x)], col = SOIL[m === MAT.OPEN ? MAT.TOPSOIL : m] ?? SOIL[MAT.TOPSOIL];
    const k = 0.94 + 0.12 * hash(px >> 1, py >> 1) + 0.06 * Math.sin(py / S * 1.7 + px / S * 0.21) + 0.05 * Math.sin(px / S * 0.37 - py / S * 0.6) - Math.min(0.38, py / S * 0.0065), o = (py * w * S + px) * 4;
    d[o] = col[0] * k; d[o + 1] = col[1] * k; d[o + 2] = col[2] * k; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); soil.host = host; soil.version = host.terrainVersion;
}

/** v: { ctx, host, W, H, cam: { x, y, z }, now, night (0..1), dig: preview cells or null } in CSS px. */
export function drawCutaway(v) {
  const { ctx, host, W, H, cam, now, night = 0 } = v, sim = host.sim, L = sim.L, w = L.nw, h = L.nh, base = L.nestBase, z = cam.z;
  const sx = x => (x - cam.x) * z + W / 2, sy = y => (y - cam.y) * z + 26;   // the surface line sits 26 px down the panel
  const x0 = Math.max(0, Math.floor(cam.x - W / 2 / z) - 1), x1 = Math.min(w - 1, Math.ceil(cam.x + W / 2 / z) + 1);
  const y0 = Math.max(0, Math.floor(cam.y) - 1), y1 = Math.min(h - 1, Math.ceil(cam.y + (H - 26) / z) + 1);
  // The sky strip and the ground line.
  const sky = ctx.createLinearGradient(0, 0, 0, 26);
  sky.addColorStop(0, night > 0.5 ? '#0b0d18' : '#6f7f8f'); sky.addColorStop(1, night > 0.5 ? '#241a1c' : '#c9b59a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 26);
  // Soil: painted once a terrain version into a small picture (4 px a cell) and stretched smooth, so the bands of
  // earth blend and no cell shows as a square; then grit and pebbles on top, fixed to the ground.
  if (soil.host !== host || soil.version !== host.terrainVersion) paintSoil(host, sim, w, h, base);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(soil.canvas, sx(0), sy(0), w * z, h * z);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (sim.mat[base + y * w + x] === MAT.OPEN) continue;
    const r = hash(x + 91, y + 17);
    if (r > 0.8) { ctx.fillStyle = 'rgba(20, 14, 10, 0.32)'; ctx.beginPath(); ctx.ellipse(sx(x + r), sy(y + hash(x, y + 5)), z * 0.2, z * 0.13, r * 6, 0, 7); ctx.fill(); }
    else if (r < 0.14) { ctx.fillStyle = 'rgba(255, 226, 190, 0.10)'; ctx.beginPath(); ctx.ellipse(sx(x + r * 5), sy(y + hash(x + 3, y)), z * 0.12, z * 0.08, r * 40, 0, 7); ctx.fill(); }
  }
  // Hollows: each open cell a disc; the union reads as rounded tunnels. First a dark rim, then the floor.
  const open = (x, y) => x >= 0 && y >= 0 && x < w && y < h && sim.mat[base + y * w + x] === MAT.OPEN;
  for (const [r, col] of [[0.78, '#120c09'], [0.62, '#2a1c14']]) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (open(x, y)) { const px = sx(x + 0.5), py = sy(y + 0.5); ctx.moveTo(px + z * r, py); ctx.arc(px, py, z * r, 0, 7); }
    ctx.fill();
  }
  // The queen's light: a warm glow that fills her chamber.
  const nur = sim.nursery ?? sim.home, qx = sx(nur.x + nur.w / 2), qy = sy(nur.y + nur.h / 2);
  if (sim.nursery) {
    const g = ctx.createRadialGradient(qx, qy, 0, qx, qy, z * 11);
    g.addColorStop(0, `rgba(255, 170, 80, ${0.30 + 0.05 * Math.sin(now / 700)})`); g.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.save(); ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (open(x, y)) { const px = sx(x + 0.5), py = sy(y + 0.5); ctx.moveTo(px + z * 0.62, py); ctx.arc(px, py, z * 0.62, 0, 7); }
    ctx.clip(); ctx.fillStyle = g; ctx.fillRect(qx - z * 11, qy - z * 11, z * 22, z * 22); ctx.restore();
  }
  // Cells marked to dig: amber hatching that pulses.
  ctx.strokeStyle = `rgba(255, 196, 90, ${0.55 + 0.25 * Math.sin(now / 250)})`; ctx.lineWidth = Math.max(1, z * 0.12); ctx.beginPath();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (sim.dig[base + y * w + x] && !open(x, y)) { const px = sx(x), py = sy(y); ctx.moveTo(px + z * 0.15, py + z * 0.85); ctx.lineTo(px + z * 0.85, py + z * 0.15); }
  ctx.stroke();
  if (v.dig?.length) { ctx.fillStyle = 'rgba(255, 210, 110, 0.4)'; for (let k = 0; k < v.dig.length; k += 2) ctx.fillRect(sx(v.dig[k]), sy(v.dig[k + 1]), z, z); }
  // Stores: a grain a load, heaped on the floor of the store by the door. Sugar pale gold, protein dark red.
  const st = sim.home, g = sim.g;
  if (host.colony) for (const [amount, left, col, rim] of [[g[G.SUGAR], true, '#f3d77a', '#8a6a22'], [g[G.PROTEIN], false, '#b0452f', '#4a1810']]) {
    const n = Math.min(80, amount); ctx.fillStyle = col; ctx.strokeStyle = rim; ctx.lineWidth = 0.8;
    for (let i = 0; i < n; i++) {
      const per = 9, row = Math.floor(i / per), off = (i % per) + (row & 1) * 0.5, span = st.w / 2 - 0.4;
      const gx = left ? st.x + 0.25 + off * span / per : st.x + st.w - 0.25 - off * span / per, gy = st.y + st.h - 0.1 - row * 0.2 - hash(i, 3) * 0.06;
      ctx.beginPath(); ctx.arc(sx(gx), sy(gy), Math.max(1.2, z * 0.15), 0, 7); ctx.fill(); if (z > 9) ctx.stroke();
    }
  }
  // Brood: eggs small and pearly, larvae curled grubs, pupae darker cocoons.
  const B = sim.brood;
  if (B) for (let k = 0; k < B.n; k++) {
    const c = B.cell[k] - base, bx = sx((c % w) + 0.2 + ((k * 0.618034) % 1) * 0.6), by = sy(((c / w) | 0) + 0.25 + ((k * 0.381966) % 1) * 0.5), s = B.stage[k];
    if (bx < -10 || bx > W + 10) continue;
    const breathe = 1 + 0.06 * Math.sin(now / 400 + k);
    ctx.beginPath();
    if (s === STAGE.EGG) { ctx.fillStyle = '#f4efe2'; ctx.ellipse(bx, by, Math.max(1.4, z * 0.15), Math.max(1.1, z * 0.11), 0.5, 0, 7); }
    else if (s === STAGE.LARVA) { ctx.fillStyle = B.fed?.[k] ? '#f3e4b4' : '#ddd5c6'; const r = Math.max(1.3, z * 0.17) * breathe, bend = 0.9 + (k % 5) * 0.25; for (let j = 0; j < 4; j++) { const a = bend + j * 0.62, gx = bx + Math.cos(a) * r * 1.25, gy = by + Math.sin(a) * r * 1.25; ctx.moveTo(gx + r * (1 - j * 0.1), gy); ctx.arc(gx, gy, r * (1 - j * 0.1), 0, 7); } }
    else { ctx.fillStyle = '#c59a62'; ctx.ellipse(bx, by, Math.max(2, z * 0.4), Math.max(1.5, z * 0.25), 0.6, 0, 7); }
    ctx.fill();
  }
  // The queen: a long abdomen that pulses as she lays.
  if (host.colony && g[G.QUEEN]) {
    const u = Math.max(8, z * 1.75), pulse = 1 + 0.06 * Math.sin(now / 300);
    ctx.strokeStyle = '#1a0d08'; ctx.lineWidth = Math.max(1, u * 0.1); ctx.lineCap = 'round';
    for (let l = 0; l < 3; l++) for (const s of [-1, 1]) { const lx = qx + (l - 1) * u * 0.35; ctx.beginPath(); ctx.moveTo(lx, qy); ctx.lineTo(lx + (l - 1) * u * 0.3, qy + s * u * 0.75); ctx.stroke(); }
    ctx.fillStyle = '#6a2a16'; ctx.strokeStyle = '#ffc070'; ctx.lineWidth = 1.5; ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 14;
    for (const [dx, rx, ry] of [[-1.25, 0.95 * pulse, 0.6 * pulse], [0, 0.42, 0.32], [0.85, 0.34, 0.3]]) { ctx.beginPath(); ctx.ellipse(qx + dx * u, qy, rx * u, ry * u, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.shadowBlur = 0;
  }
  // The ants inside, between ticks.
  const a = host.alpha, n = sim.n;
  for (let i = 0; i < n; i++) {
    if (sim.layer[i] !== NEST) continue;
    const jump = i >= host.pn || host.pl[i] !== NEST;
    const ax = sx((jump ? sim.x[i] : host.px[i] + (sim.x[i] - host.px[i]) * a) / 256), ay = sy((jump ? sim.y[i] : host.py[i] + (sim.y[i] - host.py[i]) * a) / 256);
    if (ax < -8 || ax > W + 8 || ay > H + 8) continue;
    const th = sim.heading[i] * (Math.PI / 128), c = Math.cos(th), s = Math.sin(th), u = Math.max(2.2, z * 0.5);
    ctx.fillStyle = '#0d0705';
    ctx.beginPath(); ctx.ellipse(ax - c * u * 0.55, ay - s * u * 0.55, u * 0.5, u * 0.34, th, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(ax + c * u * 0.1, ay + s * u * 0.1, u * 0.24, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(ax + c * u * 0.55, ay + s * u * 0.55, u * 0.27, 0, 7); ctx.fill();
    if (sim.carry[i]) { ctx.fillStyle = sim.carry[i] > 1 ? '#b0452f' : '#f3d77a'; ctx.beginPath(); ctx.arc(ax + c * u * 0.95, ay + s * u * 0.95, u * 0.26, 0, 7); ctx.fill(); }
  }
  if (v.mark >= 0 && v.mark < sim.n && sim.layer[v.mark] === NEST) {     // the ant the player is following
    const i = v.mark, a = host.alpha ?? 1, ax = sx((host.px[i] + (sim.x[i] - host.px[i]) * a) / 256), ay = sy((host.py[i] + (sim.y[i] - host.py[i]) * a) / 256);
    ctx.strokeStyle = 'rgba(255, 226, 150, 0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, z * 1.1 + 2 * Math.sin(now / 200), 0, 7); ctx.stroke();
  }
  // The surface: a line of ash with the door in it.
  ctx.fillStyle = night > 0.5 ? '#1c1614' : '#4a4340'; ctx.fillRect(0, 22, W, 5);
  const door = sx(w / 2 + 0.5); ctx.fillStyle = '#120c09'; ctx.fillRect(door - z * 1.5, 22, z * 3, 6);
  return { sx, sy, toCell: (px, py) => [Math.floor((px - W / 2) / z + cam.x), Math.floor((py - 26) / z + cam.y)] };
}
