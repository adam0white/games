// Drawing rocks and tall grass (cover.js) in every look. The page calls these; nothing here changes the world.
// 2D (Flat 0, Cartoon 1, Soft 2, Living 4): grassUnder, then rocks2d after the sight wedges, then bodies, then grassOver on top.
// 3D (look 3): rocks3d and grass3d into the look3d renderer.
import { COVER, patchAt } from './cover.js';

const hash = (a, b) => { let h = Math.imul(a * 2654435761 ^ b * 40503, 0x9e3779b1); h ^= h >>> 15; h = Math.imul(h, 0x85ebca77); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const inView = (o, v) => o.x + o.r > v[0] && o.x - o.r < v[2] && o.y + o.r > v[1] && o.y - o.r < v[3];
const BLADES = g => Math.round(g.r * 0.75);

// A rock's outline: a lumpy circle, the same every frame.
function rockPath(g, k) {
  const n = 9, seed = Math.floor(k.k * 1e6); g.beginPath();
  for (let i = 0; i <= n; i++) { const a = i / n * 6.283 + k.k, r = k.r * (0.93 + hash(seed, i % n) * 0.12), x = k.x + Math.cos(a) * r, y = k.y + Math.sin(a) * r * 0.94; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath();
}
export function rocks2d(g, rocks, look, view) {
  for (const k of rocks) {
    if (!inView(k, view)) continue;
    g.fillStyle = '#00000030'; g.beginPath(); g.ellipse(k.x + k.r * 0.12, k.y + k.r * 0.22, k.r * 1.05, k.r * 0.9, 0, 0, 7); g.fill(); // its shadow on the grass
    rockPath(g, k); g.fillStyle = look === 0 ? '#8f8b7c' : '#9a9586'; g.fill();
    if (look === 0) { g.fillStyle = '#aaa596'; g.beginPath(); g.ellipse(k.x - k.r * 0.2, k.y - k.r * 0.25, k.r * 0.55, k.r * 0.4, -0.4, 0, 7); g.fill(); continue; }
    g.save(); rockPath(g, k); g.clip();
    g.fillStyle = '#6d695d'; g.beginPath(); g.ellipse(k.x + k.r * 0.35, k.y + k.r * 0.45, k.r * 0.95, k.r * 0.7, 0, 0, 7); g.fill(); // shade, lit from the top left like the animals
    g.fillStyle = look === 2 ? '#d8d4c6' : '#bdb8a8'; g.beginPath(); g.ellipse(k.x - k.r * 0.3, k.y - k.r * 0.35, k.r * (look === 2 ? 0.5 : 0.42), k.r * 0.3, -0.5, 0, 7); g.fill();
    g.strokeStyle = '#5a564c'; g.lineWidth = Math.max(1, k.r * 0.05); g.lineCap = 'round'; g.beginPath(); g.moveTo(k.x + k.r * 0.1, k.y - k.r * 0.5); g.lineTo(k.x + k.r * 0.22, k.y - k.r * 0.1); g.lineTo(k.x + k.r * 0.05, k.y + k.r * 0.2); g.stroke(); // a crack
    g.restore();
    rockPath(g, k); g.strokeStyle = look === 2 ? '#4f4b42' : '#1d1410'; g.lineWidth = Math.max(1, k.r * (look === 2 ? 0.04 : 0.07)); g.lineJoin = 'round'; g.stroke();
  }
}
// The patch on the ground, under the bodies.
export function grassUnder(g, grass, view) {
  for (const p of grass) { if (!inView(p, view)) continue; g.fillStyle = '#3f7a30aa'; g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 0.96, 0, 0, 7); g.fill(); }
}
// Where blade i of a patch stands, and how tall it is.
function blade(p, i) {
  const a = hash(Math.floor(p.k * 1e6), i) * 6.283, d = Math.sqrt(hash(i, Math.floor(p.k * 1e6) + 7)) * p.r * 0.95;
  return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, h: 13 + hash(i * 3, 11) * 9, w: hash(i, 5) };
}
// Where a blade's tip goes: sway with the wind, and pushed aside by any body near its foot (the grass parts round you).
function tip(b, i, now, bodies) {
  let tx = Math.sin(now / 650 + b.x * 0.05 + i) * 2.4 + (b.w - 0.5) * 5, ty = -b.h;
  for (const o of bodies) {
    const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy), R = o.r * 1.7; if (d >= R) continue;
    const k = (1 - d / R) * b.h * 1.1; tx += dx / (d || 1) * k; ty += dy / (d || 1) * k * 0.6 + k * 0.4;
  }
  return [b.x + tx, b.y + ty];
}
// The blades, over the bodies. bodies: [{ x, y, r }] near the screen.
export function grassOver(g, grass, look, now, bodies, view) {
  g.lineCap = 'round';
  for (const p of grass) {
    if (!inView(p, view)) continue;
    const near = bodies.filter(o => Math.hypot(o.x - p.x, o.y - p.y) < p.r + o.r * 2), n = BLADES(p), tips = [];
    for (let i = 0; i < n; i++) { const b = blade(p, i); tips.push([b, ...tip(b, i, now, near)]); }
    for (const [pass, colour, width] of look === 0 ? [[1, '#4f8a3e', 2.4]] : [[0, look === 2 ? '#2f5a26' : '#1d3a16', 3.6], [1, '#5c9a45', 2.2], [2, '#8cc46a', 1]]) {
      g.strokeStyle = colour; g.lineWidth = width; g.beginPath();
      for (const [b, x, y] of tips) { if (pass === 2 && b.w < 0.6) continue; g.moveTo(b.x, b.y); g.quadraticCurveTo(b.x + (x - b.x) * 0.2, b.y + (y - b.y) * 0.6, x, y); }
      g.stroke();
    }
  }
}
// A hidden animal shows only its eyes. World units; a is the way it faces.
export function eyes2d(g, x, y, a, r, now) {
  const blink = Math.sin(now / 900 + x) > 0.97 ? 0.25 : 1, s = Math.max(1.7, r * 0.15);
  for (const side of [-1, 1]) {
    const ex = x + Math.cos(a) * r * 0.35 - Math.sin(a) * side * r * 0.28, ey = y + Math.sin(a) * r * 0.35 + Math.cos(a) * side * r * 0.28;
    g.fillStyle = '#fff6c8'; g.beginPath(); g.ellipse(ex, ey, s, s * blink, 0, 0, 7); g.fill();
    g.fillStyle = '#14100c'; g.beginPath(); g.arc(ex + Math.cos(a) * s * 0.35, ey + Math.sin(a) * s * 0.35, s * 0.5 * blink, 0, 7); g.fill();
  }
}
// What the player sees of an animal in grass: only eyes when it creeps, outside the player's patch and not very close.
export function hiddenFromPlayer(C, m, M, p, F) {
  const at = patchAt(C, m.x, m.y); if (!at || !(m.v <= M.speed * COVER.still)) return false;
  if ((p.x - at.x) ** 2 + (p.y - at.y) ** 2 < at.r * at.r) return false;
  return Math.hypot(p.x - m.x, p.y - m.y) > COVER.near * (M.r + F.r);
}
// The player creeping in grass (hidden from outside): drawn faint.
export const playerHidden = (C, p) => !!patchAt(C, p.x, p.y) && p.v <= p.speed * COVER.still;

// ---- 3D
const GREY = [0.6, 0.58, 0.53], GREY2 = [0.5, 0.48, 0.44], BL = [[0.24, 0.47, 0.17], [0.33, 0.58, 0.24], [0.45, 0.68, 0.3]];
export function rocks3d(R, rocks, view) {
  for (const k of rocks) {
    if (!inView(k, view)) continue;
    R.ball(k.x, k.r * 0.28, k.y, k.r, 0, 0, k.r * 0.9, k.r * 0.62, GREY);
    R.ball(k.x - k.r * 0.25, k.r * 0.55, k.y - k.r * 0.1, k.r * 0.55, 0.2 * k.r, -0.15 * k.r, k.r * 0.5, k.r * 0.4, GREY2);
  }
}
export function grass3d(R, grass, now, bodies, view) {
  for (const p of grass) {
    if (!inView(p, view)) continue;
    R.ring(p.x, p.y, 0, p.r, [0.22, 0.42, 0.15], 0.55);
    const near = bodies.filter(o => Math.hypot(o.x - p.x, o.y - p.y) < p.r + o.r * 2), n = Math.round(BLADES(p) * 0.6);
    for (let i = 0; i < n; i++) {
      const b = blade(p, i), [x, y] = tip(b, i, now, near), lean = [x - b.x, y - b.y + b.h];
      R.rod(b.x, 0, b.y, b.x + lean[0], b.h * 1.25 - Math.hypot(...lean) * 0.4, b.y + lean[1], 1.2, BL[i % 3]);
    }
  }
}
export function eyes3d(R, x, y, a, r) {
  for (const side of [-1, 1]) {
    const ex = x + Math.cos(a) * r * 0.35 - Math.sin(a) * side * r * 0.28, ey = y + Math.sin(a) * r * 0.35 + Math.cos(a) * side * r * 0.28, s = Math.max(1.8, r * 0.16);
    R.ball(ex, r * 0.7, ey, s, 0, 0, s, s, [1, 0.96, 0.78]); R.ball(ex + Math.cos(a) * s * 0.5, r * 0.7 + s * 0.3, ey + Math.sin(a) * s * 0.5, s * 0.5, 0, 0, s * 0.5, s * 0.5, [0.08, 0.06, 0.05]);
  }
}
