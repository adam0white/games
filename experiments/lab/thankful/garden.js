// Look: a night garden. Each thanks grows as a flower, and each kind of thanks has its own flower, so the garden shows what the days were made of.
// A day's three grow from one root. Flowers lean with a slow wind that crosses the garden, and a new one grows up from the ground.
const TAU = Math.PI * 2;
import { species as speciesOf } from './sim.js';
// [shape, hue, saturation %, lightness %, relative size]. The first flower of each kind is the one it always grew;
// the other two came with the daily flowers (2026-11-25), each with one idea of its own (NOTES.md lists them).
export const SPECIES = {
  wheat: ['wheat', 44, 80, 68, 1.05], bluebell: ['bell', 212, 82, 74, 0.95], tulip: ['tulip', 8, 84, 68, 1], daisy: ['daisy', 52, 30, 94, 1.1],
  cosmos: ['cosmos', 328, 78, 76, 1.05], rose: ['rose', 346, 76, 66, 1], snowdrop: ['drop', 190, 40, 92, 0.9], moonflower: ['moon', 262, 62, 82, 1.05],
  lavender: ['spike', 276, 60, 70, 1.1], sprig: ['sprig', 110, 46, 62, 1.05], sunflower: ['sun', 46, 96, 62, 1.2], starflower: ['star', 50, 90, 88, 1],
  barley: ['barley', 40, 62, 66, 1.05], oats: ['oats', 50, 52, 74, 1.05],
  muscari: ['muscari', 232, 70, 62, 1], forgetmenot: ['forget', 205, 85, 72, 1],
  crocus: ['crocus', 280, 66, 72, 1], hollyhock: ['hollyhock', 340, 70, 72, 1.1],
  aster: ['aster', 268, 58, 78, 1.05], gerbera: ['gerbera', 18, 90, 66, 1.1],
  zinnia: ['zinnia', 316, 80, 64, 1], sweetpea: ['sweetpea', 300, 62, 80, 1],
  peony: ['peony', 340, 72, 78, 1.15], camellia: ['camellia', 356, 74, 58, 1],
  lily: ['lily', 120, 20, 95, 1.05], iris: ['iris', 238, 62, 72, 1.1],
  primrose: ['primrose', 56, 90, 82, 1], lotus: ['lotus', 330, 60, 84, 1.1],
  foxglove: ['foxglove', 292, 58, 70, 1.1], lupin: ['lupin', 252, 64, 66, 1.1],
  blossom: ['blossom', 345, 80, 86, 1], fern: ['fern', 105, 50, 52, 1.05],
  marigold: ['marigold', 30, 96, 58, 1.05], dandelion: ['dandelion', 52, 30, 95, 1.05],
  passionflower: ['passion', 270, 50, 86, 1.1], allium: ['allium', 285, 62, 70, 1.1],
};
const TALL = new Set(['wheat', 'spike', 'sprig', 'tulip', 'barley', 'oats', 'muscari', 'hollyhock', 'lily', 'iris', 'foxglove', 'lupin', 'fern', 'crocus', 'lotus']);
const blades = Array.from({ length: 90 }, (_, i) => ({ x: (i * 0.6180339) % 1, y: (i * 0.3819660 + (i % 5) * 0.07) % 1, h: 4 + (i % 4) * 2, p: i * 1.3 }));
const flies = Array.from({ length: 16 }, (_, i) => ({ x: (i * 0.377) % 1, y: (i * 0.713) % 1, p: i * 2.1 }));
const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 0.7548) % 1, y: (i * 0.5698) % 1, p: i }));
const born = new Map(), pokes = new Map(); let frames = 0;
// A tapped flower nods: time of the tap by day and index.
export const poke = (day, index, time) => pokes.set(day + ':' + index, time);

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
    // The daily flowers. Each has one idea of its own.
    case 'barley': g.fillStyle = main; g.strokeStyle = col(h, sat, li, 0.7); g.lineWidth = 0.6; for (let i = 0; i < 6; i++) for (const side of [-1, 1]) { const y = s * 0.6 - i * s * 0.32, x = side * s * 0.16; g.beginPath(); g.ellipse(x, y, s * 0.13, s * 0.2, side * 0.3, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x, y - s * 0.15); g.lineTo(x + side * s * 0.5, y - s * 1.3); g.stroke(); } break; // long whiskers
    case 'oats': g.strokeStyle = col(h, sat * 0.6, li - 20); g.lineWidth = 0.7; g.fillStyle = main; for (let i = 0; i < 5; i++) { const y = -i * s * 0.45, side = i % 2 ? 1 : -1, x = side * s * 0.6, sway = Math.sin(time / 800 + phase + i) * s * 0.08; g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(x * 0.6, y - s * 0.2, x + sway, y + s * 0.1); g.stroke(); g.beginPath(); g.ellipse(x + sway, y + s * 0.35, s * 0.14, s * 0.3, 0, 0, TAU); g.fill(); } g.beginPath(); g.moveTo(0, s * 0.4); g.lineTo(0, -s * 2); g.stroke(); break; // grains hang down
    case 'muscari': for (let i = 0; i < 6; i++) { const y = s * 0.7 - i * s * 0.34, n = 3 - (i >> 1); for (let j = 0; j < n; j++) { const x = (j - (n - 1) / 2) * s * 0.3; g.fillStyle = col(h, sat, li - 18 + i * 5); g.beginPath(); g.arc(x, y, s * 0.17, 0, TAU); g.fill(); g.fillStyle = pale; g.beginPath(); g.arc(x, y + s * 0.1, s * 0.05, 0, TAU); g.fill(); } } break; // a bunch of grapes
    case 'forget': for (const [dx, dy, k] of [[0, 0, 1], [-0.75, 0.2, 0.75], [0.7, 0.3, 0.8], [-0.3, -0.75, 0.7], [0.45, -0.65, 0.75]]) { g.save(); g.translate(dx * s, dy * s); g.fillStyle = main; ring(g, 5, s * 0.42 * k, s * 0.2 * k, 0); g.fillStyle = '#fff3a0'; g.beginPath(); g.arc(0, 0, s * 0.1 * k, 0, TAU); g.fill(); g.restore(); } break; // many small flowers in one head
    case 'crocus': g.save(); g.rotate(-Math.PI / 2); for (const [a, c] of [[-0.55, deep], [0.55, deep], [-0.2, main], [0.2, main], [0, pale]]) { g.fillStyle = c; g.save(); g.rotate(a); petal(g, s * 1.3, s * 0.36, 0.5); g.restore(); } g.restore(); g.strokeStyle = '#ff9a2a'; g.lineWidth = Math.max(0.6, s * 0.08); for (const a of [-0.3, 0, 0.3]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(a) * s * 0.8, -s * 0.9); g.stroke(); } break; // a cup open to the sky
    case 'hollyhock': for (let i = 0; i < 3; i++) { const y = s * 0.5 - i * s * 0.85, r = s * (0.55 - i * 0.12); g.fillStyle = i % 2 ? deep : main; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * TAU / 10, rr = k % 2 ? r * 0.82 : r; g.lineTo(Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9); } g.fill(); g.fillStyle = '#fff2c4'; g.beginPath(); g.arc(0, y, r * 0.22, 0, TAU); g.fill(); } g.fillStyle = '#6aa868'; g.beginPath(); g.ellipse(0, -s * 2.05, s * 0.14, s * 0.24, 0, 0, TAU); g.fill(); break; // cups up a stalk, a bud on top
    case 'aster': g.strokeStyle = main; g.lineWidth = Math.max(0.5, s * 0.09); for (let i = 0; i < 26; i++) { const a = i * TAU / 26, r = s * (i % 2 ? 0.95 : 1.12); g.beginPath(); g.moveTo(Math.cos(a) * s * 0.25, Math.sin(a) * s * 0.25); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); } g.fillStyle = '#f3c64a'; g.beginPath(); g.arc(0, 0, s * 0.28, 0, TAU); g.fill(); break; // many fine rays
    case 'gerbera': g.fillStyle = main; ring(g, 16, s * 1.15, s * 0.16, 0.2); g.fillStyle = pale; ring(g, 16, s * 0.62, s * 0.11, 0.2, 0.2); g.fillStyle = '#3d2a14'; g.beginPath(); g.arc(0, 0, s * 0.28, 0, TAU); g.fill(); break; // two rings of rays
    case 'zinnia': for (let k = 0; k < 3; k++) { g.fillStyle = k === 1 ? deep : k ? pale : main; ring(g, 12 - k * 2, s * (1.05 - k * 0.3), s * (0.3 - k * 0.05), 0, k * 0.26); } g.fillStyle = '#f7d24a'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; g.beginPath(); g.arc(Math.cos(a) * s * 0.12, Math.sin(a) * s * 0.12, s * 0.06, 0, TAU); g.fill(); } break; // tiers
    case 'sweetpea': g.fillStyle = main; g.beginPath(); g.ellipse(0, -s * 0.35, s * 0.85, s * 0.6, 0, 0, TAU); g.fill(); g.fillStyle = deep; g.beginPath(); g.ellipse(-s * 0.35, s * 0.25, s * 0.42, s * 0.3, -0.5, 0, TAU); g.ellipse(s * 0.35, s * 0.25, s * 0.42, s * 0.3, 0.5, 0, TAU); g.fill(); g.fillStyle = pale; g.beginPath(); g.ellipse(0, s * 0.35, s * 0.18, s * 0.3, 0, 0, TAU); g.fill(); break; // shaped like a butterfly
    case 'peony': for (let i = 0; i < 14; i++) { const a = i * 2.4, r = s * 0.62 * Math.sqrt(1 - i / 14); g.fillStyle = i % 3 ? main : i % 2 ? deep : pale; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, s * (0.5 - i * 0.02), 0, TAU); g.fill(); } break; // a ball of petals
    case 'camellia': for (let i = 13; i >= 0; i--) { const a = i * 2.39996, r = s * 0.08 * Math.sqrt(i + 1) * 2.4; g.fillStyle = i < 3 ? pale : i % 2 ? main : deep; g.beginPath(); g.ellipse(Math.cos(a) * r, Math.sin(a) * r, s * 0.42, s * 0.3, a, 0, TAU); g.fill(); } g.fillStyle = '#ffd95a'; g.beginPath(); g.arc(0, 0, s * 0.12, 0, TAU); g.fill(); break; // a spiral
    case 'lily': g.strokeStyle = '#6aa868'; g.lineWidth = Math.max(0.6, s * 0.1); g.beginPath(); g.moveTo(-s * 0.2, s * 0.6); g.quadraticCurveTo(0, -s * 1.6, s * 1.2, -s * 0.9); g.stroke(); for (let i = 0; i < 4; i++) { const u = 0.3 + i * 0.22, x = -s * 0.2 + (s * 1.4) * u, y = -s * 1.5 * Math.sin(u * Math.PI) + s * 0.1 + s * 0.4 * u; g.fillStyle = main; g.beginPath(); g.arc(x, y + s * 0.3, s * (0.24 - i * 0.025), Math.PI, 0); g.lineTo(x + s * 0.28, y + s * 0.42); g.lineTo(x - s * 0.28, y + s * 0.42); g.fill(); } break; // bells hang in a row
    case 'iris': g.fillStyle = deep; for (const side of [-1, 1, 0]) { g.save(); g.rotate(Math.PI / 2 + side * 0.9); petal(g, s * 1.1, s * 0.42, 0.3); g.restore(); } g.fillStyle = main; for (const side of [-1, 1, 0]) { g.save(); g.rotate(-Math.PI / 2 + side * 0.5); petal(g, s * 1.2, s * 0.32, 0.6); g.restore(); } g.fillStyle = '#f6d34a'; g.beginPath(); g.ellipse(0, s * 0.45, s * 0.08, s * 0.3, 0, 0, TAU); g.fill(); break; // petals up and petals down
    case 'primrose': g.fillStyle = main; for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * TAU / 4 + 0.4); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.4, -s * 0.8, s * 1.25, -s * 0.5, s * 1.0, 0); g.lineTo(s * 0.85, 0); g.lineTo(s * 1.0, 0.01); g.bezierCurveTo(s * 1.25, s * 0.5, s * 0.4, s * 0.8, 0, 0); g.fill(); g.fillStyle = col(h, sat, li - 6); g.beginPath(); g.arc(s * 0.95, 0, s * 0.12, 0, TAU); g.fill(); g.fillStyle = main; g.restore(); } g.fillStyle = '#c8e07a'; g.beginPath(); g.arc(0, 0, s * 0.16, 0, TAU); g.fill(); break; // a notch in each petal
    case 'lotus': g.fillStyle = '#3f7d55'; g.beginPath(); g.ellipse(0, s * 0.45, s * 1.2, s * 0.25, 0, 0, TAU); g.fill(); g.save(); g.rotate(-Math.PI / 2); for (const [a, c, l] of [[-1, deep, 1], [1, deep, 1], [-0.6, main, 1.25], [0.6, main, 1.25], [-0.2, pale, 1.4], [0.2, pale, 1.4]]) { g.fillStyle = c; g.save(); g.translate(-s * 0.35, 0); g.rotate(a * 0.8); petal(g, s * l, s * 0.34, 0.9); g.restore(); } g.restore(); break; // a cupped fan on a leaf
    case 'foxglove': for (let i = 0; i < 6; i++) { const y = s * 0.7 - i * s * 0.42, r = s * (0.32 - i * 0.03); g.fillStyle = i % 2 ? main : pale; g.beginPath(); g.moveTo(0, y - r * 0.7); g.quadraticCurveTo(r * 2.2, y - r * 1.1, r * 2.4, y + r * 0.6); g.quadraticCurveTo(r * 1.2, y + r * 1.1, 0, y + r * 0.5); g.fill(); g.fillStyle = col(h, sat, li - 38); for (const [a, b] of [[1.2, 0.35], [1.7, 0.2], [1.5, 0.6]]) { g.beginPath(); g.arc(r * a, y + r * b, r * 0.16, 0, TAU); g.fill(); } } break; // freckled bells on one side
    case 'lupin': for (let i = 0; i < 9; i++) { const y = s * 0.8 - i * s * 0.3, r = s * (0.3 - i * 0.022); g.fillStyle = col(h + i * 8, sat, li - 10 + i * 4); g.beginPath(); g.arc(-r * 0.7, y, r * 0.8, 0, TAU); g.arc(r * 0.7, y - s * 0.12, r * 0.8, 0, TAU); g.fill(); } break; // the colour pales up the cone
    case 'blossom': g.fillStyle = main; for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * TAU / 5); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.3, -s * 0.55, s * 1.0, -s * 0.5, s * 0.95, -s * 0.08); g.lineTo(s * 0.8, 0); g.lineTo(s * 0.95, s * 0.08); g.bezierCurveTo(s * 1.0, s * 0.5, s * 0.3, s * 0.55, 0, 0); g.fill(); g.restore(); } g.fillStyle = deep; g.beginPath(); g.arc(0, 0, s * 0.2, 0, TAU); g.fill(); { const u = (time / 4200 + phase) % 1; g.fillStyle = col(h, sat, li, 1 - u); g.beginPath(); g.ellipse(s * (0.6 + u * 1.4), s * (0.4 + u * 3), s * 0.16, s * 0.1, u * 6, 0, TAU); g.fill(); } break; // a petal falls
    case 'fern': g.strokeStyle = main; g.lineWidth = Math.max(0.7, s * 0.1); g.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, a = u * 4.2, r = s * 1.1 * (1 - u * 0.85); g.lineTo(-s * 0.2 + Math.cos(a) * r * 0.6 - s * 0.4 * (1 - u), -s * 0.9 * u + Math.sin(a) * r * 0.5 + s * 0.6 * (1 - u)); } g.stroke(); g.fillStyle = main; for (let i = 0; i < 6; i++) { const y = s * 0.6 - i * s * 0.25; for (const side of [-1, 1]) { g.save(); g.translate(-s * 0.6 + i * s * 0.08, y); g.rotate(side * 1.2 - 0.3); petal(g, s * 0.4, s * 0.12, 0.5); g.restore(); } } break; // an uncurling spiral
    case 'marigold': for (let k = 0; k < 3; k++) { const n = 14 - k * 4, r = s * (0.85 - k * 0.26); g.fillStyle = k === 1 ? deep : main; for (let i = 0; i < n; i++) { const a = i * TAU / n + k * 0.3; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, s * 0.24, 0, TAU); g.fill(); } } g.fillStyle = col(h + 10, sat, li + 10); g.beginPath(); g.arc(0, 0, s * 0.2, 0, TAU); g.fill(); break; // ruffles
    case 'dandelion': g.strokeStyle = col(h, sat, li, 0.7); g.lineWidth = 0.5; g.fillStyle = main; for (let i = 0; i < 22; i++) { const a = i * TAU / 22; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 1.1, Math.sin(a) * s * 1.1); g.stroke(); g.beginPath(); g.arc(Math.cos(a) * s * 1.1, Math.sin(a) * s * 1.1, s * 0.07, 0, TAU); g.fill(); } g.fillStyle = '#c9b78a'; g.beginPath(); g.arc(0, 0, s * 0.16, 0, TAU); g.fill(); { const u = (time / 5200 + phase) % 1; g.fillStyle = `rgba(255,255,240,${0.8 * (1 - u)})`; g.beginPath(); g.arc(s * (1 + u * 4), -s * (0.8 + u * 2.2) + Math.sin(u * 9) * s * 0.3, s * 0.08, 0, TAU); g.fill(); } break; // a seed drifts away
    case 'passion': g.fillStyle = main; ring(g, 10, s * 1.15, s * 0.24, 0.4); g.strokeStyle = col(h, sat + 20, li - 36); g.lineWidth = Math.max(0.4, s * 0.05); for (let i = 0; i < 30; i++) { const a = i * TAU / 30; g.beginPath(); g.moveTo(Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22); g.lineTo(Math.cos(a) * s * 0.78, Math.sin(a) * s * 0.78); g.stroke(); } g.strokeStyle = '#86b860'; g.lineWidth = Math.max(0.6, s * 0.08); for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36); g.stroke(); } break; // a crown of threads
    case 'allium': for (let i = 0; i < 18; i++) { const a = i * 2.39996, r = s * 0.95 * Math.sqrt((i + 0.5) / 18), x = Math.cos(a) * r, y = Math.sin(a) * r; g.fillStyle = i % 3 ? main : pale; g.save(); g.translate(x, y); ring(g, 6, s * 0.2, s * 0.07, 1, a); g.restore(); } break; // a globe of tiny stars
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
    const key = p.day + ':' + p.index; if (!born.has(key)) born.set(key, o.today && frames > 20 && time ? time : -1e9); // only a flower given just now grows in
    const poked = pokes.get(key), dt = poked ? time - poked : -1, nod = dt >= 0 && dt < 900 ? Math.sin(dt / 70) * 0.35 * (1 - dt / 900) : 0;
    const since = time - born.get(key), age = since < 0 ? 1 : Math.min(1, since / 1400), grow = 1 - (1 - age) ** 3;
    const [shape, hue, sat, li, rel] = SPECIES[p.species || speciesOf(p.day, p.k)] || SPECIES.starflower, zoom = o.zoom || 1;
    const s = zoom * p.size * 3.9 * rel * depth * (o.today ? 1.12 : 1) * (0.25 + 0.75 * grow), wind = Math.sin(time / 1900 + p.x / 90) * 0.11 + Math.sin(time / 700 + p.phase) * 0.03;
    const tall = TALL.has(shape), hx = rx + (p.x - rx) * grow + wind * 14, hy = ry + (p.y - ry) * grow, bend = rx + (hx - rx) * 0.15;
    g.strokeStyle = '#5c9c62'; g.lineWidth = 1.5 * depth * Math.sqrt(zoom); g.beginPath(); g.moveTo(rx, ry); g.quadraticCurveTo(bend, hy + (ry - hy) * 0.3, hx, hy); g.stroke();
    const lx = rx + (hx - rx) * 0.45, ly = ry + (hy - ry) * 0.45, side = p.phase > 3.14 ? 1 : -1; g.fillStyle = '#4f8f58'; g.save(); g.translate(lx, ly); g.rotate(-Math.PI / 2 + side * 0.9 + wind); petal(g, 7 * zoom * depth * grow, 2.4 * zoom * depth, 0.7); g.restore();
    g.globalCompositeOperation = 'lighter'; const R = s * 3.4, halo = g.createRadialGradient(hx, hy, 0, hx, hy, R); halo.addColorStop(0, col(hue, 90, 72, 0.34 * grow)); halo.addColorStop(1, col(hue, 90, 72, 0)); g.fillStyle = halo; g.beginPath(); g.arc(hx, hy, R, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
    g.save(); g.translate(hx, hy); g.rotate(wind * (tall ? 1.6 : 1) + (tall ? 0 : p.phase) + nod); if (nod) g.scale(1 + Math.abs(nod) * 0.4, 1 + Math.abs(nod) * 0.4); head(g, shape, s, hue + (p.hue - 0.5) * 16, sat, li + (p.hue - 0.5) * 8, time, p.phase); g.restore();
  }
}

// One flower head on its own, for the buttons, the label and the picture, scaled to fill a box of size `box`
// centred on (x, y). Each head's drawn extent is measured once (static, time 0) so tall and round flowers fill alike.
const fits = new Map();
function fit(name) {
  if (fits.has(name)) return fits.get(name);
  const [shape, hue, sat, li] = SPECIES[name] || SPECIES.starflower, R = 20, N = 200;
  let f = { s: 1 / (2.6 * R) * R, dx: 0, dy: 0, span: 2.6 * R };
  try {
    const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.translate(N / 2, N / 2); head(x, shape, R, hue, sat, li, 0, 1.3);
    const d = x.getImageData(0, 0, N, N).data; let x0 = N, y0 = N, x1 = 0, y1 = 0;
    for (let y = 0; y < N; y++) for (let i = 0; i < N; i++) if (d[(y * N + i) * 4 + 3] > 40) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 > x0) f = { span: Math.max(x1 - x0, y1 - y0) + 1, dx: (x0 + x1) / 2 - N / 2, dy: (y0 + y1) / 2 - N / 2 };
  } catch {}
  fits.set(name, f); return f;
}
export function flower(g, name, x, y, box, time = 0, phase = 1.3) {
  const [shape, hue, sat, li] = SPECIES[name] || SPECIES.starflower, f = fit(name), k = box * 0.9 / f.span, s = 20 * k;
  g.save(); g.translate(x - f.dx * k, y - f.dy * k); head(g, shape, s, hue, sat, li, time, phase); g.restore();
}
