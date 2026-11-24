// Borrowed Time: everything drawn in code. Each function draws on a 2D context `g` and keeps no state.
// Kinds of memory: 0 hat, 1 held thing, 2 pet, 3 place. Values index VALUES in sim.js.

import { t as word } from './words.js';

export const INK = '#1b1430';
export const CREAM = '#fff3dc';
export const GOLD = '#ffd34d';
export const ABILITY_COLOUR = { glow: '#ffd34d', push: '#ff8a5c', leap: '#6fd3ff', rewind: '#c39bff', who: '#ffe9a8' };
const TAU = Math.PI * 2;

export function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function blob(g, x, y, r, fill, line = INK, width = 2) {
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  g.fillStyle = fill; g.fill();
  if (line) { g.lineWidth = width; g.strokeStyle = line; g.stroke(); }
}
function shape(g, fill, line = INK, width = 2) {
  g.fillStyle = fill; g.fill();
  if (line) { g.lineWidth = width; g.strokeStyle = line; g.lineJoin = 'round'; g.stroke(); }
}

// ---------------------------------------------------------------- hats, on a head of radius r centred at (x, y)
export function hat(g, v, x, y, r) {
  const w = Math.max(1.2, r * 0.12);
  if (v === 0) { // crown
    g.beginPath();
    g.moveTo(x - r * 0.8, y - r * 0.55);
    g.lineTo(x - r * 0.9, y - r * 1.35);
    g.lineTo(x - r * 0.45, y - r * 0.95);
    g.lineTo(x, y - r * 1.55);
    g.lineTo(x + r * 0.45, y - r * 0.95);
    g.lineTo(x + r * 0.9, y - r * 1.35);
    g.lineTo(x + r * 0.8, y - r * 0.55);
    g.closePath();
    shape(g, '#ffcc33', INK, w);
    blob(g, x, y - r * 0.8, r * 0.16, '#e8344e', INK, w * 0.7);
    blob(g, x - r * 0.9, y - r * 1.38, r * 0.1, '#fff2a8', null);
    blob(g, x + r * 0.9, y - r * 1.38, r * 0.1, '#fff2a8', null);
    blob(g, x, y - r * 1.58, r * 0.1, '#fff2a8', null);
  } else if (v === 1) { // straw hat: a wide brim
    g.beginPath(); g.ellipse(x, y - r * 0.62, r * 1.55, r * 0.36, 0, 0, TAU); shape(g, '#f2c94c', INK, w);
    g.beginPath(); g.ellipse(x, y - r * 0.85, r * 0.75, r * 0.6, 0, Math.PI, TAU); g.closePath(); shape(g, '#f7d96b', INK, w);
    g.beginPath(); g.rect(x - r * 0.74, y - r * 0.82, r * 1.48, r * 0.2); shape(g, '#d9534f', INK, w * 0.7);
    g.strokeStyle = '#c99a2e'; g.lineWidth = w * 0.6;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * r * 0.3, y - r * 0.5); g.lineTo(x + k * r * 0.42, y - r * 0.38); g.stroke(); }
  } else if (v === 2) { // tall cone with a star
    g.beginPath();
    g.moveTo(x - r * 0.95, y - r * 0.5);
    g.quadraticCurveTo(x - r * 0.1, y - r * 1.1, x + r * 0.35, y - r * 2.3);
    g.quadraticCurveTo(x + r * 0.35, y - r * 1.0, x + r * 0.95, y - r * 0.5);
    g.closePath();
    shape(g, '#6b4bd6', INK, w);
    star(g, x + r * 0.05, y - r * 1.15, r * 0.28, '#ffd34d');
    g.beginPath(); g.ellipse(x, y - r * 0.5, r * 1.1, r * 0.22, 0, 0, TAU); shape(g, '#5038b0', INK, w);
  } else { // beret
    g.beginPath(); g.ellipse(x - r * 0.08, y - r * 0.78, r * 1.08, r * 0.48, -0.18, 0, TAU); shape(g, '#e0413f', INK, w);
    g.beginPath(); g.moveTo(x - r * 0.05, y - r * 1.25); g.lineTo(x + r * 0.05, y - r * 1.5); g.lineWidth = w * 1.6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(x - r * 0.08, y - r * 0.92, r * 0.6, r * 0.18, -0.18, Math.PI * 1.1, Math.PI * 1.9); g.strokeStyle = '#ff7b6e'; g.lineWidth = w; g.stroke();
  }
}
export function star(g, x, y, r, fill, line = INK) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  g.closePath();
  shape(g, fill, line, Math.max(1, r * 0.15));
}

// ---------------------------------------------------------------- held things, centred at (x, y), about 2s tall
export function tool(g, v, x, y, s, t = 0) {
  const w = Math.max(1.2, s * 0.14);
  g.save(); g.translate(x, y);
  if (v === 0) { // paintbrush
    g.rotate(-0.5 + Math.sin(t * 3) * 0.08);
    g.beginPath(); roundRect(g, -s * 0.13, -s * 0.2, s * 0.26, s * 1.15, s * 0.1); shape(g, '#a8693a', INK, w);
    g.beginPath(); g.rect(-s * 0.16, -s * 0.42, s * 0.32, s * 0.24); shape(g, '#c9ced6', INK, w);
    g.beginPath(); g.moveTo(-s * 0.18, -s * 0.42); g.quadraticCurveTo(-s * 0.2, -s * 0.9, 0, -s * 1.05); g.quadraticCurveTo(s * 0.2, -s * 0.9, s * 0.18, -s * 0.42); g.closePath();
    shape(g, '#3aa0ff', INK, w);
  } else if (v === 1) { // flute
    g.rotate(-0.35);
    g.beginPath(); roundRect(g, -s * 1.05, -s * 0.13, s * 2.1, s * 0.26, s * 0.12); shape(g, '#d8dde8', INK, w);
    g.fillStyle = INK;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-s * 0.35 + k * s * 0.3, 0, s * 0.055, 0, TAU); g.fill(); }
    g.beginPath(); g.rect(s * 0.75, -s * 0.13, s * 0.08, s * 0.26); g.fillStyle = '#8e95a8'; g.fill();
  } else if (v === 2) { // key
    g.rotate(-0.6);
    g.beginPath(); g.arc(0, -s * 0.62, s * 0.34, 0, TAU); g.arc(0, -s * 0.62, s * 0.15, 0, TAU, true); shape(g, '#f5c542', INK, w);
    g.beginPath(); g.rect(-s * 0.08, -s * 0.3, s * 0.16, s * 1.1); shape(g, '#f5c542', INK, w);
    g.beginPath(); g.rect(s * 0.08, s * 0.5, s * 0.26, s * 0.12); g.rect(s * 0.08, s * 0.7, s * 0.18, s * 0.1); shape(g, '#f5c542', INK, w);
  } else { // flower
    g.rotate(Math.sin(t * 2) * 0.12);
    g.beginPath(); g.moveTo(0, s); g.quadraticCurveTo(s * 0.15, s * 0.3, 0, -s * 0.35); g.strokeStyle = '#2f8a3c'; g.lineWidth = w * 1.3; g.stroke();
    g.beginPath(); g.ellipse(s * 0.2, s * 0.35, s * 0.22, s * 0.1, -0.6, 0, TAU); shape(g, '#4cc35a', INK, w * 0.7);
    for (let k = 0; k < 5; k++) {
      const a = k * TAU / 5;
      g.beginPath(); g.ellipse(Math.cos(a) * s * 0.26, -s * 0.5 + Math.sin(a) * s * 0.26, s * 0.22, s * 0.14, a, 0, TAU); shape(g, '#ff7eb6', INK, w * 0.7);
    }
    blob(g, 0, -s * 0.5, s * 0.16, '#ffd34d', INK, w * 0.7);
  }
  g.restore();
}

// ---------------------------------------------------------------- pets, sitting with their middle at (x, y), about 2s wide
export function pet(g, v, x, y, s, t = 0, blink = 0) {
  const w = Math.max(1.2, s * 0.12);
  const eye = (ex, ey, r) => {
    if (blink) { g.beginPath(); g.moveTo(ex - r, ey); g.lineTo(ex + r, ey); g.strokeStyle = INK; g.lineWidth = w; g.stroke(); return; }
    blob(g, ex, ey, r, '#fff', INK, w * 0.6); blob(g, ex + r * 0.15, ey + r * 0.1, r * 0.55, INK, null);
  };
  g.save(); g.translate(x, y);
  if (v === 0) { // cat
    const tail = Math.sin(t * 3) * 0.4;
    g.beginPath(); g.moveTo(s * 0.6, s * 0.4); g.quadraticCurveTo(s * 1.3, s * 0.2 + tail * s * 0.3, s * 1.05, -s * 0.5 + tail * s * 0.4); g.strokeStyle = INK; g.lineWidth = s * 0.3; g.lineCap = 'round'; g.stroke();
    g.strokeStyle = '#f39a3d'; g.lineWidth = s * 0.18; g.stroke();
    g.beginPath(); g.ellipse(s * 0.15, s * 0.35, s * 0.65, s * 0.5, 0, 0, TAU); shape(g, '#f39a3d', INK, w);
    g.beginPath(); g.moveTo(-s * 0.75, -s * 0.35); g.lineTo(-s * 0.7, -s * 1.0); g.lineTo(-s * 0.35, -s * 0.6); g.lineTo(-s * 0.05, -s * 1.0); g.lineTo(s * 0.0, -s * 0.35); g.closePath(); shape(g, '#f39a3d', INK, w);
    blob(g, -s * 0.37, -s * 0.25, s * 0.48, '#f39a3d', INK, w);
    eye(-s * 0.55, -s * 0.3, s * 0.11); eye(-s * 0.2, -s * 0.3, s * 0.11);
    g.beginPath(); g.moveTo(-s * 0.42, -s * 0.12); g.lineTo(-s * 0.36, -s * 0.06); g.lineTo(-s * 0.3, -s * 0.12); g.strokeStyle = INK; g.lineWidth = w * 0.7; g.stroke();
    g.strokeStyle = '#c66b1d'; g.lineWidth = w;
    for (const k of [0, 1]) { g.beginPath(); g.moveTo(s * (0.1 + k * 0.3), -s * 0.05); g.lineTo(s * (0.18 + k * 0.3), s * 0.25); g.stroke(); }
  } else if (v === 1) { // bird
    const hop = Math.abs(Math.sin(t * 4)) * s * 0.12;
    g.translate(0, -hop);
    g.beginPath(); g.ellipse(0, s * 0.1, s * 0.62, s * 0.55, 0, 0, TAU); shape(g, '#4aa8ff', INK, w);
    g.beginPath(); g.ellipse(s * 0.15, s * 0.2, s * 0.35, s * 0.25, 0.5 + Math.sin(t * 8) * 0.2, 0, TAU); shape(g, '#2c7fd6', INK, w * 0.8);
    g.beginPath(); g.ellipse(-s * 0.05, s * 0.3, s * 0.3, s * 0.22, 0, 0, TAU); g.fillStyle = '#ffe3a3'; g.fill();
    g.beginPath(); g.moveTo(-s * 0.6, -s * 0.05); g.lineTo(-s * 0.95, s * 0.05); g.lineTo(-s * 0.58, s * 0.15); g.closePath(); shape(g, '#ffb52e', INK, w * 0.8);
    eye(-s * 0.3, -s * 0.12, s * 0.12);
    g.beginPath(); g.moveTo(s * 0.55, s * 0.0); g.lineTo(s * 0.95, -s * 0.2); g.lineTo(s * 0.85, s * 0.15); g.closePath(); shape(g, '#2c7fd6', INK, w * 0.8);
    g.strokeStyle = INK; g.lineWidth = w;
    g.beginPath(); g.moveTo(-s * 0.1, s * 0.62); g.lineTo(-s * 0.1, s * 0.82 + hop); g.moveTo(s * 0.15, s * 0.62); g.lineTo(s * 0.15, s * 0.82 + hop); g.stroke();
  } else if (v === 2) { // frog
    const puff = 1 + Math.max(0, Math.sin(t * 2.5)) * 0.12;
    g.beginPath(); g.ellipse(0, s * 0.35, s * 0.85, s * 0.5, 0, 0, TAU); shape(g, '#5fcf5a', INK, w);
    g.beginPath(); g.ellipse(0, s * 0.5, s * 0.45 * puff, s * 0.25 * puff, 0, 0, TAU); g.fillStyle = '#c9f59a'; g.fill();
    blob(g, -s * 0.42, -s * 0.12, s * 0.3, '#5fcf5a', INK, w); blob(g, s * 0.42, -s * 0.12, s * 0.3, '#5fcf5a', INK, w);
    eye(-s * 0.42, -s * 0.14, s * 0.17); eye(s * 0.42, -s * 0.14, s * 0.17);
    g.beginPath(); g.arc(0, s * 0.2, s * 0.35, 0.3, Math.PI - 0.3); g.strokeStyle = INK; g.lineWidth = w; g.stroke();
  } else { // snail
    const stretch = Math.sin(t * 1.5) * s * 0.08;
    g.beginPath(); g.moveTo(-s * 0.95 - stretch, s * 0.62); g.quadraticCurveTo(-s * 1.0 - stretch, -s * 0.05, -s * 0.65 - stretch, -s * 0.1);
    g.quadraticCurveTo(-s * 0.4, s * 0.2, s * 0.9, s * 0.45); g.quadraticCurveTo(s * 1.0, s * 0.62, s * 0.8, s * 0.65); g.closePath();
    shape(g, '#ffd59e', INK, w);
    g.strokeStyle = INK; g.lineWidth = w * 0.8;
    g.beginPath(); g.moveTo(-s * 0.8 - stretch, -s * 0.05); g.lineTo(-s * 0.95 - stretch, -s * 0.5); g.moveTo(-s * 0.7 - stretch, -s * 0.05); g.lineTo(-s * 0.6 - stretch, -s * 0.5); g.stroke();
    blob(g, -s * 0.95 - stretch, -s * 0.52, s * 0.08, INK, null); blob(g, -s * 0.6 - stretch, -s * 0.52, s * 0.08, INK, null);
    blob(g, s * 0.2, s * 0.05, s * 0.55, '#c0732f', INK, w);
    g.beginPath();
    for (let a = 0; a < 4.5 * Math.PI; a += 0.2) { const q = s * 0.5 * (1 - a / (5 * Math.PI)); g.lineTo(s * 0.2 + Math.cos(a) * q, s * 0.05 + Math.sin(a) * q); }
    g.strokeStyle = '#7a4214'; g.lineWidth = w; g.stroke();
  }
  g.restore();
}

// ---------------------------------------------------------------- places: a scene filling the box
export function place(g, v, x, y, w, h, t = 0) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  const sky = g.createLinearGradient(0, y, 0, y + h);
  const skies = [['#7fd0ff', '#d8f3ff'], ['#9ee6b8', '#e8ffe0'], ['#f7b37a', '#ffe3c4'], ['#a9b6ff', '#eef0ff']];
  sky.addColorStop(0, skies[v][0]); sky.addColorStop(1, skies[v][1]);
  g.fillStyle = sky; g.fillRect(x, y, w, h);
  const base = y + h * 0.68;
  if (v === 0) { // sea: waves, a sail, a sun
    blob(g, x + w * 0.8, y + h * 0.22, h * 0.12, '#fff3a0', null);
    g.fillStyle = '#2f86d9'; g.fillRect(x, base, w, h);
    g.strokeStyle = '#bfe6ff'; g.lineWidth = Math.max(1.5, h * 0.025);
    for (let row = 0; row < 3; row++) {
      g.beginPath();
      for (let k = 0; k <= 12; k++) { const px = x + k * w / 12, py = base + 6 + row * h * 0.1 + Math.sin(k * 1.3 + t * 2 + row) * h * 0.02; k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    }
    const bx = x + w * 0.25 + Math.sin(t * 0.7) * w * 0.03;
    g.beginPath(); g.moveTo(bx - w * 0.08, base - 2); g.lineTo(bx + w * 0.08, base - 2); g.lineTo(bx + w * 0.05, base + h * 0.04); g.lineTo(bx - w * 0.05, base + h * 0.04); g.closePath(); shape(g, '#8a4b2a', INK, 1.2);
    g.beginPath(); g.moveTo(bx, base - 2); g.lineTo(bx, base - h * 0.22); g.lineTo(bx + w * 0.07, base - h * 0.05); g.closePath(); shape(g, '#fff', INK, 1.2);
  } else if (v === 1) { // forest: rows of pines
    g.fillStyle = '#4c9a4f'; g.fillRect(x, base, w, h);
    for (const [k, sc, col] of [[0, 0.8, '#2e7a46'], [1, 1, '#1f5e38']]) {
      for (let i = -1; i < 6; i++) {
        const px = x + (i + 0.5 * k) * w / 5, ph = h * 0.42 * sc, py = base + k * h * 0.08;
        g.beginPath(); g.moveTo(px, py - ph); g.lineTo(px + ph * 0.38, py); g.lineTo(px - ph * 0.38, py); g.closePath(); shape(g, col, INK, 1.2);
      }
    }
  } else if (v === 2) { // city: towers with windows
    const cols = ['#7b5ea7', '#9a6fb0', '#5d4a8a', '#b07aa1', '#6b5b95'];
    for (let i = 0; i < 6; i++) {
      const bw = w / 5.2, bh = h * (0.3 + ((i * 37) % 5) * 0.08), bx = x + i * w / 5.5 - bw * 0.1;
      g.beginPath(); g.rect(bx, base - bh, bw, bh + h); shape(g, cols[i % 5], INK, 1.2);
      g.fillStyle = '#ffe08a';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) if ((i + r + c) % 3) g.fillRect(bx + bw * (0.2 + c * 0.38), base - bh + h * 0.05 + r * h * 0.08, bw * 0.2, h * 0.04);
    }
    g.fillStyle = '#8f8a9e'; g.fillRect(x, base + h * 0.08, w, h);
  } else { // peaks: snowy mountains
    blob(g, x + w * 0.2, y + h * 0.2, h * 0.1, '#ffffff', null);
    for (const [px, ph, col] of [[0.25, 0.62, '#7c86c9'], [0.62, 0.78, '#5f69ad'], [0.95, 0.55, '#7c86c9']]) {
      const cx = x + px * w, top = base - h * ph;
      g.beginPath(); g.moveTo(cx - w * 0.36, base + 2); g.lineTo(cx, top); g.lineTo(cx + w * 0.36, base + 2); g.closePath(); shape(g, col, INK, 1.2);
      g.beginPath(); g.moveTo(cx - w * 0.1, top + h * 0.16); g.lineTo(cx, top); g.lineTo(cx + w * 0.1, top + h * 0.16); g.lineTo(cx + w * 0.03, top + h * 0.12); g.lineTo(cx - w * 0.03, top + h * 0.17); g.closePath(); shape(g, '#ffffff', null);
    }
    g.fillStyle = '#9fd38a'; g.fillRect(x, base, w, h);
  }
  g.restore();
}

// ---------------------------------------------------------------- a person: feet at (x, y), head radius r
// o: { hat, tool, t, blink, cloak, walk (0..1 phase or null), candle (0..1 or null), face (-1 or 1), lost (draw a ? when the hat is not known),
//      age (0 child: short body; 1 grown; 2 old: white hair and brows, lines by the eyes) }
export function person(g, x, y, r, o = {}) {
  const t = o.t ?? 0, face = o.face ?? 1, w = Math.max(1.4, r * 0.13);
  const step = o.walk != null ? Math.sin(o.walk * TAU) : 0;
  const bob = o.walk != null ? Math.abs(step) * r * 0.12 : Math.sin(t * 2) * r * 0.04;
  const age = o.age ?? 1;
  const hy = y - r * (age === 0 ? 1.65 : 2.05) - bob;
  g.save();
  // shadow
  g.beginPath(); g.ellipse(x, y, r * 0.95, r * 0.25, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
  // feet
  g.fillStyle = INK;
  g.beginPath(); g.ellipse(x - r * 0.35 + step * r * 0.2, y - r * 0.08, r * 0.28, r * 0.16, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(x + r * 0.35 - step * r * 0.2, y - r * 0.08, r * 0.28, r * 0.16, 0, 0, TAU); g.fill();
  // cloak
  const cloak = o.cloak ?? '#5b6fd6';
  g.beginPath();
  g.moveTo(x - r * 0.55, hy + r * 0.55);
  g.quadraticCurveTo(x - r * 1.0, y - r * 0.4 - bob, x - r * 0.85, y - r * 0.15);
  g.quadraticCurveTo(x, y + r * 0.05, x + r * 0.85, y - r * 0.15);
  g.quadraticCurveTo(x + r * 1.0, y - r * 0.4 - bob, x + r * 0.55, hy + r * 0.55);
  g.closePath();
  shape(g, cloak, INK, w);
  g.beginPath(); g.moveTo(x, hy + r * 0.9); g.lineTo(x, y - r * 0.2); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = w; g.stroke();
  // the candle in the front hand
  const arm = age === 0 ? 0.3 : 0; // a child's hands sit lower
  const handF = { x: x + face * r * 0.75, y: y - r * (1.05 - arm) - bob };
  const handB = { x: x - face * r * 0.78, y: y - r * (1.0 - arm) - bob };
  const ts = o.toolSize ?? 1; // portraits draw the held thing larger, so it reads at a glance
  if (o.tool != null) tool(g, o.tool, handB.x - face * (ts - 1) * r * 0.7, handB.y - r * 0.35 * ts, r * 0.55 * ts, t);
  blob(g, handB.x, handB.y, r * 0.2, '#f6c9a0', INK, w * 0.8);
  if (age === 2 && o.candle == null) { // the old one leans on a stick
    g.beginPath(); g.moveTo(handF.x + r * 0.1, y - r * 0.05); g.lineTo(handF.x + r * 0.05, handF.y - r * 0.1); g.quadraticCurveTo(handF.x + r * 0.05, handF.y - r * 0.5, handF.x - r * 0.3, handF.y - r * 0.4);
    g.strokeStyle = INK; g.lineWidth = w * 3.2; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#a0673a'; g.lineWidth = w * 1.8; g.stroke();
  }
  if (o.candle != null) candle(g, handF.x, handF.y + r * 0.05, r * 0.22, r * 1.1 * Math.max(0.08, o.candle), t, o.out);
  blob(g, handF.x, handF.y, r * 0.2, '#f6c9a0', INK, w * 0.8);
  // head
  blob(g, x, hy, r * 0.82, '#f6c9a0', INK, w);
  g.beginPath(); g.arc(x, hy, r * 0.82, Math.PI * 0.95, Math.PI * 2.05); g.lineTo(x + r * 0.6, hy - r * 0.2); g.quadraticCurveTo(x, hy - r * 0.6, x - r * 0.6, hy - r * 0.2); g.closePath();
  shape(g, age === 2 ? '#e4e0ea' : age === 0 ? '#7a4a2e' : '#5a3b2e', INK, w); // hair
  const ex = face * r * 0.12;
  if (o.blink) {
    g.strokeStyle = INK; g.lineWidth = w;
    g.beginPath(); g.moveTo(x + ex - r * 0.4, hy + r * 0.08); g.lineTo(x + ex - r * 0.18, hy + r * 0.08); g.moveTo(x + ex + r * 0.18, hy + r * 0.08); g.lineTo(x + ex + r * 0.4, hy + r * 0.08); g.stroke();
  } else {
    blob(g, x + ex - r * 0.28, hy + r * 0.08, r * 0.11, INK, null);
    blob(g, x + ex + r * 0.28, hy + r * 0.08, r * 0.11, INK, null);
    blob(g, x + ex - r * 0.25, hy + r * 0.05, r * 0.04, '#fff', null);
    blob(g, x + ex + r * 0.31, hy + r * 0.05, r * 0.04, '#fff', null);
  }
  if (age === 2) { // white brows and smile lines
    g.strokeStyle = '#e4e0ea'; g.lineWidth = w * 1.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + ex - r * 0.42, hy - r * 0.14); g.lineTo(x + ex - r * 0.14, hy - r * 0.18); g.moveTo(x + ex + r * 0.14, hy - r * 0.18); g.lineTo(x + ex + r * 0.42, hy - r * 0.14); g.stroke();
    g.strokeStyle = 'rgba(90,50,40,.5)'; g.lineWidth = w * 0.7;
    g.beginPath(); g.moveTo(x + ex - r * 0.62, hy + r * 0.02); g.lineTo(x + ex - r * 0.5, hy + r * 0.12); g.moveTo(x + ex + r * 0.62, hy + r * 0.02); g.lineTo(x + ex + r * 0.5, hy + r * 0.12); g.stroke();
  }
  blob(g, x + ex - r * 0.48, hy + r * 0.32, r * 0.1, 'rgba(255,120,120,.45)', null);
  blob(g, x + ex + r * 0.48, hy + r * 0.32, r * 0.1, 'rgba(255,120,120,.45)', null);
  g.beginPath();
  if (o.mood === 'sad') g.arc(x + ex, hy + r * 0.5, r * 0.15, Math.PI * 1.15, Math.PI * 1.85);
  else if (o.mood === 'happy') g.arc(x + ex, hy + r * 0.25, r * 0.22, 0.2, Math.PI - 0.2);
  else g.arc(x + ex, hy + r * 0.3, r * 0.12, 0.3, Math.PI - 0.3);
  g.strokeStyle = INK; g.lineWidth = w * 0.9; g.stroke();
  if (o.hat != null) hat(g, o.hat, x, hy, r * 0.85);
  else if (o.lost) { // a small question mark floating above a forgotten head
    g.font = `800 ${Math.round(r * 0.9)}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.globalAlpha = 0.6 + 0.3 * Math.sin(t * 3);
    g.lineWidth = w * 1.6; g.strokeStyle = INK; g.strokeText(word('unknownMark'), x + r * 0.1, hy - r * 1.35 + Math.sin(t * 2) * r * 0.1);
    g.fillStyle = CREAM; g.fillText(word('unknownMark'), x + r * 0.1, hy - r * 1.35 + Math.sin(t * 2) * r * 0.1);
    g.globalAlpha = 1;
  }
  g.restore();
}
// A candle: base at (x, y), width w, wax height h.
export function candle(g, x, y, w, h, t = 0, out = false) {
  g.beginPath(); roundRect(g, x - w / 2, y - h, w, h, w * 0.25); shape(g, '#fff0cf', INK, Math.max(1, w * 0.18));
  g.beginPath(); g.moveTo(x - w * 0.3, y - h + w * 0.2); g.quadraticCurveTo(x - w * 0.35, y - h + w * 0.8, x - w * 0.15, y - h + w * 1.1); g.strokeStyle = '#f1d9a6'; g.lineWidth = w * 0.18; g.stroke();
  g.beginPath(); g.moveTo(x, y - h); g.lineTo(x, y - h - w * 0.35); g.strokeStyle = INK; g.lineWidth = Math.max(1, w * 0.12); g.stroke();
  if (out) {
    g.globalAlpha = 0.5; g.beginPath(); g.moveTo(x, y - h - w * 0.4); g.quadraticCurveTo(x + w * 0.6, y - h - w * 1.2, x, y - h - w * 2); g.strokeStyle = '#bbb'; g.lineWidth = w * 0.2; g.stroke(); g.globalAlpha = 1;
    return;
  }
  flame(g, x, y - h - w * 0.4, w * 0.75, t);
}
export function flame(g, x, y, s, t = 0) {
  const f = 1 + Math.sin(t * 17) * 0.08 + Math.sin(t * 11.3) * 0.06, lean = Math.sin(t * 5.1) * s * 0.15;
  const glow = g.createRadialGradient(x, y - s * 0.6, 0, x, y - s * 0.6, s * 3);
  glow.addColorStop(0, 'rgba(255,210,120,.45)'); glow.addColorStop(1, 'rgba(255,210,120,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(x, y - s * 0.6, s * 3, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - s * 0.7, y - s * 0.6, x + lean, y - s * 1.9 * f); g.quadraticCurveTo(x + s * 0.7, y - s * 0.6, x, y); g.fillStyle = '#ff9f2e'; g.fill();
  g.beginPath(); g.moveTo(x, y - s * 0.1); g.quadraticCurveTo(x - s * 0.35, y - s * 0.5, x + lean * 0.6, y - s * 1.2 * f); g.quadraticCurveTo(x + s * 0.35, y - s * 0.5, x, y - s * 0.1); g.fillStyle = '#fff1a8'; g.fill();
}

// ---------------------------------------------------------------- a face card: place behind, person with hat and held thing, pet in front
export function portrait(g, face, x, y, w, h, t = 0, o = {}) {
  g.save();
  g.beginPath(); roundRect(g, x, y, w, h, Math.min(16, w * 0.1)); g.clip();
  place(g, face[3], x, y, w, h, t);
  const r = Math.min(w * 0.17, h * 0.2);
  person(g, x + w * 0.42, y + h * 0.98, r, { hat: face[0], tool: face[1], t, blink: o.blink, face: 1, cloak: o.cloak ?? '#5b6fd6', mood: o.mood, age: o.age, toolSize: 1.6 });
  pet(g, face[2], x + w * 0.8, y + h * 0.82, Math.min(w, h) * 0.12, t, o.blink);
  if (o.dim) { g.fillStyle = 'rgba(20,14,40,.55)'; g.fillRect(x, y, w, h); }
  g.restore();
}

// ---------------------------------------------------------------- one value of one kind, as a picture in a circle of radius s
export function value(g, d, v, x, y, s, t = 0) {
  g.save();
  g.beginPath(); g.arc(x, y, s, 0, TAU); g.clip();
  if (d === 3) place(g, v, x - s, y - s, s * 2, s * 2, t);
  else {
    g.fillStyle = '#fff3dc'; g.fillRect(x - s, y - s, s * 2, s * 2);
    if (d === 0) { // a hat on a pale head
      blob(g, x, y + s * 0.55, s * 0.55, '#f6c9a0', INK, Math.max(1, s * 0.06));
      hat(g, v, x, y + s * 0.55, s * 0.6);
    } else if (d === 1) tool(g, v, x, y + s * 0.15, s * 0.58, t);
    else pet(g, v, x, y + s * 0.05, s * 0.5, t);
  }
  g.restore();
  g.beginPath(); g.arc(x, y, s, 0, TAU); g.lineWidth = Math.max(1.5, s * 0.08); g.strokeStyle = INK; g.stroke();
}

// ---------------------------------------------------------------- frame icons: which kind of memory (hat, hand, paw, home)
export function kindIcon(g, d, x, y, s, col = CREAM) {
  g.save(); g.translate(x, y);
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = Math.max(1.5, s * 0.14); g.lineJoin = 'round'; g.lineCap = 'round';
  if (d === 0) { // hat
    g.beginPath(); g.ellipse(0, s * 0.35, s * 0.95, s * 0.22, 0, 0, TAU); g.fill();
    g.beginPath(); roundRect(g, -s * 0.5, -s * 0.6, s * 1.0, s * 0.95, s * 0.2); g.fill();
  } else if (d === 1) { // open hand
    g.beginPath(); roundRect(g, -s * 0.5, -s * 0.15, s * 0.95, s * 0.9, s * 0.3); g.fill();
    for (let k = 0; k < 4; k++) { g.beginPath(); roundRect(g, -s * 0.5 + k * s * 0.25, -s * 0.85 + Math.abs(k - 1.5) * s * 0.12, s * 0.2, s * 0.85, s * 0.1); g.fill(); }
    g.beginPath(); roundRect(g, s * 0.25, -s * 0.05, s * 0.55, s * 0.22, s * 0.1); g.fill();
  } else if (d === 2) { // paw
    g.beginPath(); g.ellipse(0, s * 0.3, s * 0.45, s * 0.38, 0, 0, TAU); g.fill();
    for (const [px, py] of [[-0.6, -0.15], [-0.22, -0.55], [0.22, -0.55], [0.6, -0.15]]) { g.beginPath(); g.ellipse(px * s, py * s, s * 0.19, s * 0.24, 0, 0, TAU); g.fill(); }
  } else { // home
    g.beginPath(); g.moveTo(-s * 0.85, -s * 0.05); g.lineTo(0, -s * 0.85); g.lineTo(s * 0.85, -s * 0.05); g.closePath(); g.fill();
    g.beginPath(); g.rect(-s * 0.6, -s * 0.1, s * 1.2, s * 0.85); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); roundRect(g, -s * 0.18, s * 0.25, s * 0.36, s * 0.5, s * 0.15); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

// ---------------------------------------------------------------- ability icons
export function abilityIcon(g, id, x, y, s, col, t = 0) {
  g.save(); g.translate(x, y);
  g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(2, s * 0.16);
  if (id === 'glow') { // a sun
    g.beginPath(); g.arc(0, 0, s * 0.38, 0, TAU); g.fill();
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8 + t * 0.6;
      g.beginPath(); g.moveTo(Math.cos(a) * s * 0.58, Math.sin(a) * s * 0.58); g.lineTo(Math.cos(a) * s * 0.88, Math.sin(a) * s * 0.88); g.stroke();
    }
  } else if (id === 'push') { // a burst: a dot with arrows out
    g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.fill();
    for (let k = 0; k < 4; k++) {
      g.save(); g.rotate(k * Math.PI / 2 + Math.PI / 4);
      g.beginPath(); g.moveTo(s * 0.38, 0); g.lineTo(s * 0.85, 0); g.moveTo(s * 0.62, -s * 0.22); g.lineTo(s * 0.88, 0); g.lineTo(s * 0.62, s * 0.22); g.stroke();
      g.restore();
    }
  } else if (id === 'leap') { // an arc with an arrow over a wave
    g.beginPath(); g.arc(0, s * 0.25, s * 0.62, Math.PI * 1.05, Math.PI * 1.85); g.stroke();
    const ax = Math.cos(Math.PI * 1.85) * s * 0.62, ay = s * 0.25 + Math.sin(Math.PI * 1.85) * s * 0.62;
    g.beginPath(); g.moveTo(ax - s * 0.3, ay - s * 0.05); g.lineTo(ax + s * 0.05, ay + s * 0.05); g.lineTo(ax - s * 0.05, ay + s * 0.38); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.85, s * 0.7); for (let k = 0; k <= 6; k++) g.lineTo(-s * 0.85 + k * s * 0.28, s * 0.7 + (k % 2 ? -1 : 1) * s * 0.1); g.lineWidth = Math.max(1.5, s * 0.1); g.stroke();
  } else if (id === 'rewind') { // an hourglass with a turning arrow
    g.beginPath(); g.moveTo(-s * 0.42, -s * 0.62); g.lineTo(s * 0.42, -s * 0.62); g.lineTo(-s * 0.42, s * 0.62); g.lineTo(s * 0.42, s * 0.62); g.closePath(); g.lineWidth = Math.max(2, s * 0.13); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.25, s * 0.5); g.lineTo(s * 0.25, s * 0.5); g.lineTo(0, s * 0.15); g.closePath(); g.fill();
    g.beginPath(); g.arc(0, 0, s * 0.9, -Math.PI * 0.2, Math.PI * 0.35); g.lineWidth = Math.max(1.5, s * 0.1); g.stroke();
    g.beginPath(); g.moveTo(Math.cos(-Math.PI * 0.2) * s * 0.9 - s * 0.2, Math.sin(-Math.PI * 0.2) * s * 0.9 - s * 0.05); g.lineTo(Math.cos(-Math.PI * 0.2) * s * 0.9, Math.sin(-Math.PI * 0.2) * s * 0.9); g.lineTo(Math.cos(-Math.PI * 0.2) * s * 0.9 + s * 0.08, Math.sin(-Math.PI * 0.2) * s * 0.9 + s * 0.2); g.stroke();
  } else if (id === 'who') { // a hand mirror with a face
    g.beginPath(); g.ellipse(0, -s * 0.18, s * 0.55, s * 0.62, 0, 0, TAU); g.lineWidth = Math.max(2, s * 0.14); g.stroke();
    g.beginPath(); g.moveTo(0, s * 0.45); g.lineTo(0, s * 0.95); g.lineWidth = Math.max(3, s * 0.22); g.stroke();
    g.fillStyle = col;
    g.beginPath(); g.arc(-s * 0.18, -s * 0.28, s * 0.07, 0, TAU); g.arc(s * 0.18, -s * 0.28, s * 0.07, 0, TAU); g.fill();
    g.beginPath(); g.arc(0, -s * 0.05, s * 0.18, 0.2, Math.PI - 0.2); g.lineWidth = Math.max(1.5, s * 0.08); g.stroke();
  }
  g.restore();
}

// A ghost finger that taps: tip at (x, y); k in 0..1 is the press.
export function hand(g, x, y, k = 0, alpha = 0.85) {
  const press = Math.sin(Math.min(1, k) * Math.PI);
  g.save(); g.globalAlpha = alpha;
  g.beginPath(); g.arc(x, y, 10 + press * 16, 0, TAU); g.strokeStyle = `rgba(255,243,220,${0.8 * (1 - press * 0.6)})`; g.lineWidth = 3; g.stroke();
  g.translate(x + 4, y + 6 - press * 4); g.rotate(-0.35);
  g.beginPath(); roundRect(g, -7, 0, 14, 34, 7); shape(g, '#fff3dc', INK, 2);
  g.beginPath(); roundRect(g, -9, 24, 26, 30, 10); shape(g, '#fff3dc', INK, 2);
  g.restore();
}
