// Look: a night garden. Each thanks grows as a flower, and each kind of thanks has its own flower, so the garden shows what the days were made of.
// A day's three grow from one root. Flowers lean with a slow wind that crosses the garden, and a new one grows up from the ground.
const TAU = Math.PI * 2;
const KIND = { heart: 'health', moon: 'rest', hands: 'work', sun: 'light' }; // older names for the same pictures
// [shape, hue, saturation %, lightness %, relative size]
const SPECIES = {
  bread: ['wheat', 44, 80, 68, 1.05], water: ['bell', 212, 82, 74, 0.95], home: ['tulip', 8, 84, 68, 1], family: ['daisy', 52, 30, 94, 1.1],
  friend: ['cosmos', 328, 78, 76, 1.05], health: ['rose', 346, 76, 66, 1], rain: ['drop', 190, 40, 92, 0.9], rest: ['moon', 262, 62, 82, 1.05],
  work: ['spike', 276, 60, 70, 1.1], tree: ['sprig', 110, 46, 62, 1.05], light: ['sun', 46, 96, 62, 1.2], spark: ['star', 50, 90, 88, 1],
};
const blades = Array.from({ length: 90 }, (_, i) => ({ x: (i * 0.6180339) % 1, y: (i * 0.3819660 + (i % 5) * 0.07) % 1, h: 4 + (i % 4) * 2, p: i * 1.3 }));
const flies = Array.from({ length: 16 }, (_, i) => ({ x: (i * 0.377) % 1, y: (i * 0.713) % 1, p: i * 2.1 }));
const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 0.7548) % 1, y: (i * 0.5698) % 1, p: i }));
const born = new Map(); let frames = 0;

export function background(g, w, h, time, band, pan) {
  frames++;
  const hz = band.top - 30, sky = g.createLinearGradient(0, 0, 0, hz + 40); sky.addColorStop(0, '#06131f'); sky.addColorStop(1, '#16343a'); g.fillStyle = sky; g.fillRect(0, 0, w, hz + 40);
  for (const s of stars) { g.fillStyle = `rgba(225,240,255,${0.25 + 0.2 * Math.sin(time / 1700 + s.p)})`; g.fillRect(s.x * w, s.y * hz * 0.9, 1.1, 1.1); }
  const mx = w * 0.3, my = hz - 20, glow = g.createRadialGradient(mx, my, 0, mx, my, 130); glow.addColorStop(0, 'rgba(236,244,206,.3)'); glow.addColorStop(1, 'rgba(236,244,206,0)'); g.fillStyle = glow; g.fillRect(mx - 130, my - 130, 260, 260);
  g.fillStyle = '#f1f4d6'; g.beginPath(); g.arc(mx, my, 13, 0, TAU); g.fill(); g.fillStyle = '#0d2530'; g.beginPath(); g.arc(mx + 6, my - 3, 12, 0, TAU); g.fill();
  [['#10292a', hz - 16, 120, 15, 0.12], ['#153328', hz, 76, 10, 0.3], ['#1b3d2b', hz + 16, 160, 6, 0.6]].forEach(([c, y, wave, amp, par], n) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w + 20; x += 20) g.lineTo(x, y + amp * Math.sin((x - pan * par) / wave + n * 2)); g.lineTo(w, h); g.fill(); });
  const ground = g.createLinearGradient(0, hz + 16, 0, h); ground.addColorStop(0, 'rgba(34,74,48,0)'); ground.addColorStop(0.5, 'rgba(34,74,48,.55)'); ground.addColorStop(1, 'rgba(18,44,30,.9)'); g.fillStyle = ground; g.fillRect(0, hz + 16, w, h - hz);
  g.lineWidth = 1; g.lineCap = 'round';
  for (const b of blades) { const x = (((b.x * w * 1.4 + pan * 0.9) % (w * 1.4)) + w * 1.4) % (w * 1.4) - w * 0.2, y = band.top + b.y * (h - band.top - 40), lean = Math.sin(time / 1900 + x / 90) * 2.5; g.strokeStyle = `rgba(110,170,110,${0.16 + 0.2 * b.y})`; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.4, y - b.h * 0.6, x + lean, y - b.h); g.moveTo(x + 2, y); g.lineTo(x + 3 + lean * 0.7, y - b.h * 0.7); g.stroke(); }
  g.globalCompositeOperation = 'lighter';
  for (const f of flies) { const x = f.x * w + Math.sin(time / 3100 + f.p) * 30, y = band.top - 10 + f.y * (band.bottom - band.top + 70) + Math.cos(time / 2700 + f.p) * 18, a = Math.max(0, Math.sin(time / 700 + f.p)); const fg = g.createRadialGradient(x, y, 0, x, y, 7); fg.addColorStop(0, `rgba(226,255,150,${0.75 * a})`); fg.addColorStop(1, 'rgba(226,255,150,0)'); g.fillStyle = fg; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over';
}

// A petal lying along +x from the origin.
function petal(g, len, wid, point = 0.5) { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.25, -wid, len * (0.6 + point * 0.3), -wid * (1 - point * 0.6), len, 0); g.bezierCurveTo(len * (0.6 + point * 0.3), wid * (1 - point * 0.6), len * 0.25, wid, 0, 0); g.fill(); }
function ring(g, n, len, wid, point, turn = 0) { for (let i = 0; i < n; i++) { g.save(); g.rotate(turn + i * TAU / n); petal(g, len, wid, point); g.restore(); } }
const col = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

function head(g, shape, s, h, sat, li, time, phase) {
  const main = col(h, sat, li), deep = col(h, sat, li - 16), pale = col(h, sat * 0.6, Math.min(97, li + 14));
  switch (shape) {
    case 'daisy': g.fillStyle = main; ring(g, 12, s * 1.15, s * 0.2, 0.3); g.fillStyle = '#f6c945'; g.beginPath(); g.arc(0, 0, s * 0.36, 0, TAU); g.fill(); g.fillStyle = '#d99a22'; g.beginPath(); g.arc(s * 0.08, s * 0.08, s * 0.18, 0, TAU); g.fill(); break;
    case 'cosmos': g.fillStyle = deep; ring(g, 8, s * 1.1, s * 0.34, 0.1, 0.39); g.fillStyle = main; ring(g, 8, s * 1.05, s * 0.3, 0.1); g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(0, 0, s * 0.26, 0, TAU); g.fill(); break;
    case 'rose': g.fillStyle = deep; ring(g, 5, s * 1.0, s * 0.62, 0); g.fillStyle = main; ring(g, 5, s * 0.74, s * 0.5, 0, 0.63); g.fillStyle = pale; ring(g, 4, s * 0.46, s * 0.34, 0, 0.2); g.fillStyle = deep; g.beginPath(); g.arc(0, 0, s * 0.13, 0, TAU); g.fill(); break;
    case 'moon': g.fillStyle = main; ring(g, 5, s * 1.1, s * 0.66, 0); g.strokeStyle = pale; g.lineWidth = Math.max(0.6, s * 0.07); for (let i = 0; i < 5; i++) { const a = i * TAU / 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.9); g.stroke(); } g.fillStyle = '#fff7d0'; g.beginPath(); g.arc(0, 0, s * 0.2, 0, TAU); g.fill(); break;
    case 'sun': g.fillStyle = col(h - 8, sat, li - 8); ring(g, 16, s * 1.2, s * 0.17, 0.8, 0.2); g.fillStyle = main; ring(g, 16, s * 1.12, s * 0.17, 0.8); g.fillStyle = '#6b4320'; g.beginPath(); g.arc(0, 0, s * 0.46, 0, TAU); g.fill(); g.fillStyle = '#8f5f2c'; for (let i = 0; i < 7; i++) { const a = i * 2.4; g.beginPath(); g.arc(Math.cos(a) * s * 0.06 * i, Math.sin(a) * s * 0.06 * i, s * 0.07, 0, TAU); g.fill(); } break;
    case 'star': g.fillStyle = main; ring(g, 5, s * 1.25, s * 0.3, 1, -Math.PI / 2); g.fillStyle = pale; ring(g, 5, s * 0.6, s * 0.2, 1, -Math.PI / 2 + TAU / 10); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, s * 0.16, 0, TAU); g.fill(); { const tw = 0.5 + 0.5 * Math.sin(time / 500 + phase); g.strokeStyle = `rgba(255,255,255,${0.7 * tw})`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-s * 1.7, 0); g.lineTo(s * 1.7, 0); g.moveTo(0, -s * 1.7); g.lineTo(0, s * 1.7); g.stroke(); } break;
    case 'tulip': g.fillStyle = deep; g.save(); g.rotate(-Math.PI / 2); g.save(); g.rotate(-0.42); petal(g, s * 1.5, s * 0.5, 0.7); g.restore(); g.save(); g.rotate(0.42); petal(g, s * 1.5, s * 0.5, 0.7); g.restore(); g.fillStyle = main; petal(g, s * 1.6, s * 0.56, 0.6); g.restore(); break;
    case 'bell': for (const [dx, dy, k] of [[-0.75, 0.15, 0.85], [0.7, 0.3, 0.8], [0, -0.35, 1]]) { g.save(); g.translate(dx * s, dy * s); g.fillStyle = k === 1 ? main : deep; g.beginPath(); g.moveTo(-s * 0.1 * k, -s * 0.5 * k); g.bezierCurveTo(-s * 0.6 * k, -s * 0.4 * k, -s * 0.5 * k, s * 0.4 * k, -s * 0.62 * k, s * 0.62 * k); g.lineTo(s * 0.62 * k, s * 0.62 * k); g.bezierCurveTo(s * 0.5 * k, s * 0.4 * k, s * 0.6 * k, -s * 0.4 * k, s * 0.1 * k, -s * 0.5 * k); g.fill(); g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(0, s * 0.68 * k, s * 0.1, 0, TAU); g.fill(); g.restore(); } break;
    case 'drop': g.save(); g.rotate(Math.PI / 2); g.fillStyle = main; for (const a of [-0.5, 0.5, 0]) { g.save(); g.rotate(a); petal(g, s * 1.35, s * 0.36, 0.5); g.restore(); } g.restore(); g.fillStyle = '#7fbf7a'; g.beginPath(); g.arc(0, 0, s * 0.24, 0, TAU); g.fill(); break;
    case 'wheat': g.fillStyle = main; for (let i = 0; i < 5; i++) for (const side of [-1, 1]) { g.save(); g.translate(0, -i * s * 0.42 + s * 0.5); g.rotate(-Math.PI / 2 + side * 0.55); petal(g, s * 0.75, s * 0.2, 0.8); g.restore(); } g.save(); g.translate(0, -s * 1.5); g.rotate(-Math.PI / 2); petal(g, s * 0.8, s * 0.2, 0.9); g.restore(); g.strokeStyle = col(h, sat, li, 0.6); g.lineWidth = 0.7; for (const side of [-1, 1]) { g.beginPath(); g.moveTo(0, -s * 1.6); g.lineTo(side * s * 0.5, -s * 2.5); g.stroke(); } break;
    case 'spike': for (let i = 0; i < 7; i++) { const y = s * 0.7 - i * s * 0.38, r = s * (0.3 - i * 0.025); g.fillStyle = i % 2 ? main : deep; g.beginPath(); g.arc(-r * 0.8, y, r, 0, TAU); g.arc(r * 0.8, y - s * 0.16, r, 0, TAU); g.fill(); } g.fillStyle = pale; g.beginPath(); g.arc(0, -s * 2.05, s * 0.14, 0, TAU); g.fill(); break;
    case 'sprig': g.fillStyle = main; for (let i = 0; i < 4; i++) for (const side of [-1, 1]) { g.save(); g.translate(0, s * 0.6 - i * s * 0.5); g.rotate(-Math.PI / 2 + side * (1.1 - i * 0.12)); petal(g, s * (0.95 - i * 0.12), s * 0.26, 0.6); g.restore(); } g.fillStyle = '#fdfbe6'; for (const [dx, dy] of [[0, -1.75], [-0.5, -1.2], [0.5, -0.9]]) { g.beginPath(); g.arc(dx * s, dy * s, s * 0.17, 0, TAU); g.fill(); } break;
  }
}

export function cluster(g, ps, time, o) {
  const depth = 0.82 + 0.36 * (ps[0].cy - o.band.top) / Math.max(1, o.band.bottom - o.band.top);
  const rx = ps.reduce((n, p) => n + p.x, 0) / ps.length, ry = Math.max(...ps.map(p => p.y)) + o.radius * 1.05 * depth;
  const shade = g.createRadialGradient(rx, ry, 0, rx, ry, o.radius * 1.5); shade.addColorStop(0, 'rgba(6,20,14,.5)'); shade.addColorStop(1, 'rgba(6,20,14,0)'); g.fillStyle = shade; g.beginPath(); g.ellipse(rx, ry + 1, o.radius * 1.5, o.radius * 0.45, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(120,180,116,.75)'; g.lineWidth = 1; g.lineCap = 'round';
  for (let i = -2; i <= 2; i++) { const lean = Math.sin(time / 1900 + rx / 90 + i) * 2; g.beginPath(); g.moveTo(rx + i * 3, ry); g.quadraticCurveTo(rx + i * 4, ry - 5, rx + i * 5.5 + lean, ry - 7 - (2 - Math.abs(i)) * 2); g.stroke(); }
  const drawn = [...ps].sort((a, b) => a.y - b.y);
  for (const p of drawn) {
    const key = p.day + ':' + p.index; if (!born.has(key)) born.set(key, frames > 20 && time ? time : -1e9);
    const age = Math.max(0, Math.min(1, (time - born.get(key)) / 1400)), grow = 1 - (1 - age) ** 3;
    const [shape, hue, sat, li, rel] = SPECIES[KIND[p.k] || p.k] || SPECIES.spark;
    const s = p.size * 3.9 * rel * depth * (o.today ? 1.12 : 1) * (0.25 + 0.75 * grow), wind = Math.sin(time / 1900 + p.x / 90) * 0.11 + Math.sin(time / 700 + p.phase) * 0.03;
    const tall = ['wheat', 'spike', 'sprig', 'tulip'].includes(shape), hx = rx + (p.x - rx) * grow + wind * 14, hy = ry + (p.y - ry) * grow, bend = rx + (hx - rx) * 0.15;
    g.strokeStyle = '#5c9c62'; g.lineWidth = 1.5 * depth; g.beginPath(); g.moveTo(rx, ry); g.quadraticCurveTo(bend, hy + (ry - hy) * 0.3, hx, hy); g.stroke();
    const lx = rx + (hx - rx) * 0.45, ly = ry + (hy - ry) * 0.45, side = p.phase > 3.14 ? 1 : -1; g.fillStyle = '#4f8f58'; g.save(); g.translate(lx, ly); g.rotate(-Math.PI / 2 + side * 0.9 + wind); petal(g, 7 * depth * grow, 2.4 * depth, 0.7); g.restore();
    g.globalCompositeOperation = 'lighter'; const R = s * 3.4, halo = g.createRadialGradient(hx, hy, 0, hx, hy, R); halo.addColorStop(0, col(hue, 90, 72, 0.34 * grow)); halo.addColorStop(1, col(hue, 90, 72, 0)); g.fillStyle = halo; g.beginPath(); g.arc(hx, hy, R, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
    g.save(); g.translate(hx, hy); g.rotate(wind * (tall ? 1.6 : 1) + (tall ? 0 : p.phase)); head(g, shape, s, hue + (p.hue - 0.5) * 16, sat, li + (p.hue - 0.5) * 8, time, p.phase); g.restore();
  }
}
