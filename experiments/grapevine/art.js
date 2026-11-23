// Grapevine art: everything drawn in code. Pure drawing helpers; the page decides where and when.
import { SHAPES } from './sim.js';

export const INK = '#2b1830';
export const CREAM = '#fff4dc';
export const COLOUR = ['#e8483b', '#f7c63c', '#3f8ff0', '#4fcf6a'];
export const COLOUR_DARK = ['#9c2219', '#b3861a', '#1e5bb0', '#23893a'];
// Villager body colours by kind.
export const BODY = {
  teller: '#f4a259', listener: '#c58fd8', honest: '#a8d99a', paint: '#f59bb0', more: '#ffbf5e', less: '#9aaec4',
  swap: '#b8a2e8', carve: '#d3ad83', flip: '#7fd8cc', timid: '#f9e6a8', parrot: '#5fca78',
};

// ---------------------------------------------------------------- the message token

export function shape(g, s, x, y, r) {
  g.beginPath();
  if (s === 0) g.arc(x, y, r, 0, Math.PI * 2);
  else if (s === 1) { const q = r * 0.88; roundRect(g, x - q, y - q, q * 2, q * 2, r * 0.22); }
  else if (s === 2) { const q = r * 1.12; g.moveTo(x, y - q); g.lineTo(x + q * 0.95, y + q * 0.68); g.lineTo(x - q * 0.95, y + q * 0.68); g.closePath(); }
  else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r * 1.15;
      i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
  }
}
export function roundRect(g, x, y, w, h, r) {
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// One shape with its outline and a highlight.
function piece(g, s, c, x, y, r) {
  shape(g, s, x, y, r);
  g.fillStyle = COLOUR[c]; g.fill();
  g.lineWidth = Math.max(1.5, r * 0.22); g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
  g.save(); g.clip();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.45, r * 0.55, r * 0.3, -0.5, 0, Math.PI * 2); g.fill();
  g.restore();
  mark(g, c, x, s === 2 ? y + r * 0.14 : y, r);
}
// A second cue for each colour, for players who cannot tell red from green:
// red a dot, yellow a ring, blue a bar, green a cross. Drawn small and soft in the middle of a colour patch of radius r.
export function mark(g, c, x, y, r) {
  if (r < 3.5) return;
  const m = r * 0.3;
  g.save();
  g.fillStyle = g.strokeStyle = 'rgba(43,24,48,.58)';
  g.lineCap = 'round'; g.lineWidth = Math.max(1.1, m * 0.5);
  g.beginPath();
  if (c === 0) { g.arc(x, y, m * 0.72, 0, Math.PI * 2); g.fill(); }
  else if (c === 1) { g.arc(x, y, m * 0.78, 0, Math.PI * 2); g.stroke(); }
  else if (c === 2) { g.moveTo(x - m, y); g.lineTo(x + m, y); g.stroke(); }
  else { const q = m * 0.75; g.moveTo(x - q, y - q); g.lineTo(x + q, y + q); g.moveTo(x + q, y - q); g.lineTo(x - q, y + q); g.stroke(); }
  g.restore();
}
// The message: `n` copies of the shape. size is the radius of the whole token.
// sx, sy squash and stretch it (1 is round).
export function token(g, m, x, y, size, { sx = 1, sy = 1, alpha = 1, plate = true } = {}) {
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.scale(sx, sy);
  if (plate) {
    g.beginPath(); g.arc(0, 0, size, 0, Math.PI * 2); g.fillStyle = CREAM; g.fill();
    g.lineWidth = Math.max(1.5, size * 0.09); g.strokeStyle = INK; g.stroke();
  }
  const r = m.n === 1 ? size * 0.55 : m.n === 2 ? size * 0.38 : size * 0.33;
  const spots = m.n === 1 ? [[0, 0.04]] : m.n === 2 ? [[-0.42, 0.04], [0.42, 0.04]] : [[0, -0.38], [-0.42, 0.33], [0.42, 0.33]];
  for (const [px, py] of spots) piece(g, m.s, m.c, px * size, py * size, r);
  g.restore();
}

// ---------------------------------------------------------------- what a villager does, as a small picture

// change ids as in sim.js. Drawn inside a w x h box centred on x, y.
export function change(g, id, x, y, w, h, node = null) {
  const u = h * 0.5;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const arrow = (ax, two = false) => {
    g.strokeStyle = INK; g.lineWidth = Math.max(1.5, u * 0.16);
    g.beginPath(); g.moveTo(ax - u * 0.32, y); g.lineTo(ax + u * 0.32, y);
    g.moveTo(ax + u * 0.12, y - u * 0.22); g.lineTo(ax + u * 0.34, y); g.lineTo(ax + u * 0.12, y + u * 0.22);
    if (two) { g.moveTo(ax - u * 0.12, y - u * 0.22); g.lineTo(ax - u * 0.34, y); g.lineTo(ax - u * 0.12, y + u * 0.22); }
    g.stroke();
  };
  const blank = (bx, s = 0) => { shape(g, s, bx, y, u * 0.5); g.setLineDash([u * 0.18, u * 0.14]); g.strokeStyle = INK; g.lineWidth = Math.max(1.2, u * 0.12); g.stroke(); g.setLineDash([]); };
  const dots = (bx, n) => { for (let i = 0; i < n; i++) { g.beginPath(); g.arc(bx + (i - (n - 1) / 2) * u * 0.42, y, u * 0.19, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); } };
  const outline = (bx, s, fill = '#fff') => { shape(g, s, bx, y, u * 0.48); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(1.2, u * 0.13); g.stroke(); };
  const L = x - w * 0.3, R = x + w * 0.3;
  if (id === 0) { // nothing changes
    outline(L, 0, '#fff'); outline(R, 0, '#fff');
    g.strokeStyle = INK; g.lineWidth = Math.max(1.5, u * 0.15); g.beginPath();
    g.moveTo(x - u * 0.25, y - u * 0.13); g.lineTo(x + u * 0.25, y - u * 0.13); g.moveTo(x - u * 0.25, y + u * 0.13); g.lineTo(x + u * 0.25, y + u * 0.13); g.stroke();
  } else if (id <= 4) { // paint it a colour: a brush stroke of that colour
    blank(L); arrow(x);
    g.beginPath(); g.arc(R, y, u * 0.5, 0, Math.PI * 2); g.fillStyle = COLOUR[id - 1]; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(1.2, u * 0.13); g.stroke();
    mark(g, id - 1, R, y, u * 0.5);
  } else if (id === 5) { dots(L, 1); arrow(x); dots(R + u * 0.05, 2); plus(g, R + u * 0.55, y - u * 0.55, u * 0.22); }
  else if (id === 6) { dots(L - u * 0.05, 2); arrow(x); dots(R, 1); }
  else if (id === 7 || id === 8) { const a = id === 7 ? 0 : 2; outline(L, a); arrow(x, true); outline(R, a + 1); }
  else if (id <= 12) { blank(L); arrow(x); outline(R, id - 9); }
  else if (id === 13) { // opposite colour: red and green trade, yellow and blue trade
    const chip = (cx, cy, c) => { g.beginPath(); g.arc(cx, cy, u * 0.26, 0, Math.PI * 2); g.fillStyle = COLOUR[c]; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(1, u * 0.1); g.stroke(); mark(g, c, cx, cy, u * 0.3); };
    const yy = y; y = yy - u * 0.36; chip(L, y, 0); chip(R, y, 3); arrowSmall(g, x, y, u * 0.7);
    y = yy + u * 0.36; chip(L, y, 1); chip(R, y, 2); arrowSmall(g, x, y, u * 0.7); y = yy;
  }
  g.restore();
}
function plus(g, x, y, r) { g.strokeStyle = INK; g.lineWidth = Math.max(1.2, r * 0.6); g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke(); }
function arrowSmall(g, x, y, w) {
  g.strokeStyle = INK; g.lineWidth = Math.max(1, w * 0.12); g.beginPath();
  g.moveTo(x - w * 0.35, y); g.lineTo(x + w * 0.35, y);
  g.moveTo(x + w * 0.18, y - w * 0.16); g.lineTo(x + w * 0.36, y); g.lineTo(x + w * 0.18, y + w * 0.16);
  g.moveTo(x - w * 0.18, y - w * 0.16); g.lineTo(x - w * 0.36, y); g.lineTo(x - w * 0.18, y + w * 0.16); g.stroke();
}

// The badge under a villager: a cream plate with the picture of what they do.
// `copy` is the change a parrot would copy right now (or null when it is not on the route).
export function badge(g, node, x, y, w, h, { copy = null, dim = false } = {}) {
  const k = node.kind;
  if (k === 'teller' || k === 'listener') return;
  g.save(); if (dim) g.globalAlpha *= 0.45;
  g.beginPath(); roundRect(g, x - w / 2, y - h / 2, w, h, h * 0.45);
  g.fillStyle = CREAM; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
  if (k === 'timid') { // no red news: a red chip crossed out
    const u = h * 0.5;
    g.beginPath(); g.arc(x, y, u * 0.55, 0, Math.PI * 2); g.fillStyle = COLOUR[0]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
    mark(g, 0, x, y, u * 0.55);
    g.beginPath(); g.arc(x, y, u * 0.8, 0, Math.PI * 2); g.moveTo(x - u * 0.57, y + u * 0.57); g.lineTo(x + u * 0.57, y - u * 0.57);
    g.strokeStyle = '#c4161c'; g.lineWidth = Math.max(2, u * 0.2); g.stroke();
  } else if (k === 'parrot') {
    if (copy !== null) change(g, copy, x, y, w * 0.92, h * 0.92);
    else echo(g, x, y, h * 0.5);
  } else {
    const ids = { honest: 0, paint: 1 + node.arg, more: 5, less: 6, swap: 7 + node.arg, carve: 9 + node.arg, flip: 13 };
    change(g, ids[k] ?? 0, x, y, w * 0.92, h * 0.92);
  }
  if (node.once) { // a little moon: speaks once, then goes home
    const mx = x + w / 2 - 1, my = y - h / 2 + 1, mr = h * 0.3;
    g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fillStyle = '#ffe9a0'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(mx + mr * 0.45, my - mr * 0.3, mr * 0.8, 0, Math.PI * 2); g.fillStyle = '#33244a'; g.fill();
  }
  g.restore();
}
// The parrot's picture before it is on a route: a "do it again" loop arrow.
function echo(g, x, y, u) {
  g.strokeStyle = INK; g.lineWidth = Math.max(1.8, u * 0.2); g.lineCap = 'round'; g.lineJoin = 'round';
  const r = u * 0.62;
  g.beginPath(); g.arc(x, y, r, -Math.PI * 0.35, Math.PI * 1.45); g.stroke();
  const a = -Math.PI * 0.35, hx = x + Math.cos(a) * r, hy = y + Math.sin(a) * r;
  g.beginPath(); g.moveTo(hx - u * 0.38, hy - u * 0.12); g.lineTo(hx + u * 0.02, hy + u * 0.02); g.lineTo(hx - u * 0.08, hy + u * 0.42); g.stroke();
}

// ---------------------------------------------------------------- villagers

// mood: { t seconds, blink 0..1, bob, react 0..1 (just passed the message), refuse 0..1, gone 0..1, look -1..1 }
export function villager(g, node, x, y, r, mood) {
  const { t = 0, react = 0, refuse = 0, gone = 0, happy = 0, puzzled = 0 } = mood;
  const k = node.kind;
  g.save();
  if (gone) g.globalAlpha *= 1 - gone * 0.6;
  // a refusal shakes; a reaction bounces with squash and stretch
  const shake = refuse ? Math.sin(t * 50) * r * 0.12 * refuse : 0;
  const hop = react ? Math.sin(react * Math.PI) * r * 0.35 : 0;
  const squash = 1 + Math.sin(react * Math.PI * 2) * 0.12 * react;
  const bob = Math.sin(t * 2.2 + x * 0.05) * r * 0.03;
  g.translate(x + shake, y - hop + bob);
  // shadow
  g.save(); g.translate(0, hop + r * 0.92); g.scale(1, 0.3); g.beginPath(); g.arc(0, 0, r * 0.85, 0, Math.PI * 2); g.fillStyle = 'rgba(10,5,20,.35)'; g.fill(); g.restore();
  g.scale(squash, 1 / squash);
  const body = BODY[k] ?? '#ccc';
  const tall = k === 'timid' ? 1.12 : k === 'less' ? 0.9 : 1;
  // arms behind the body (the exaggerator throws them wide)
  if (k === 'more' || k === 'flip' || k === 'teller') arms(g, k, r, react, body);
  if (k === 'listener') { for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.95, -r * 0.05, r * 0.3, r * 0.42, s * 0.3, 0, Math.PI * 2); g.fillStyle = body; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke(); g.beginPath(); g.ellipse(s * r * 0.98, -r * 0.05, r * 0.13, r * 0.24, s * 0.3, 0, Math.PI * 2); g.fillStyle = '#f2b5c8'; g.fill(); } }
  // body
  g.beginPath(); g.ellipse(0, 0, r, r * tall, 0, 0, Math.PI * 2);
  if (k === 'parrot') { g.beginPath(); g.ellipse(0, 0, r * 0.92, r * 1.02, 0, 0, Math.PI * 2); }
  g.fillStyle = body; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
  // belly light
  g.beginPath(); g.ellipse(0, r * 0.35, r * 0.6, r * 0.45, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill();
  face(g, k, r, mood, tall);
  hat(g, node, r, t, react, tall);
  if (k === 'more' && react > 0) { // "so big!" lines
    g.strokeStyle = '#fff3c4'; g.lineWidth = 2;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.6; g.beginPath(); g.moveTo(s * r * (1.5 + react * 0.2) * Math.cos(a), r * 1.2 * Math.sin(a) - r * 0.2); g.lineTo(s * r * (1.8 + react * 0.4) * Math.cos(a), r * 1.4 * Math.sin(a) - r * 0.2); g.stroke(); }
  }
  if (k === 'less' && react > 0) { // a little storm cloud of grumbling
    g.globalAlpha *= react; g.fillStyle = '#6c6f80';
    for (const [cx, cy, cr] of [[-0.3, -1.75, 0.25], [0, -1.85, 0.3], [0.3, -1.75, 0.25]]) { g.beginPath(); g.arc(cx * r, cy * r, cr * r, 0, Math.PI * 2); g.fill(); }
  }
  if (happy > 0) hearts(g, r, happy);
  if (puzzled > 0) { // question marks spin around the head
    g.fillStyle = '#fff'; g.font = `bold ${Math.round(r * 0.8)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; g.globalAlpha = Math.min(1, puzzled * 2); g.fillText('?', Math.cos(a) * r * 1.4, -r * 1.3 + Math.sin(a) * r * 0.35); }
  }
  if (gone > 0) { // asleep at home: z z
    g.globalAlpha = gone; g.fillStyle = '#e8e0ff'; g.font = `bold ${Math.round(r * 0.55)}px system-ui, sans-serif`; g.textAlign = 'left';
    g.fillText('z', r * 0.7, -r * 0.9 - Math.sin(t * 2) * 3); g.fillText('z', r * 1.05, -r * 1.35 - Math.sin(t * 2 + 1) * 3);
  }
  g.restore();
}
function arms(g, k, r, react, body) {
  const wide = k === 'more' ? 0.4 + react * 1.1 : 0;
  g.strokeStyle = INK; g.lineWidth = 2.5; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    let ex, ey, hx, hy;
    if (k === 'flip') { ex = s * r * 0.95; ey = r * 0.35; hx = -s * r * 0.35; hy = r * 0.45; } // arms crossed
    else if (k === 'teller') { ex = s * r * 1.05; ey = r * 0.1; hx = s * r * 1.15; hy = -r * 0.25; }
    else { const a = -0.4 - wide; ex = s * r * 1.05; ey = r * 0.1; hx = s * r * (1.2 + wide * 0.4) ; hy = r * Math.sin(a) * 1.4; }
    g.beginPath(); g.moveTo(s * r * 0.75, r * 0.2); g.quadraticCurveTo(ex, ey, hx, hy); g.lineWidth = r * 0.28; g.strokeStyle = INK; g.stroke(); g.lineWidth = r * 0.18; g.strokeStyle = body; g.stroke();
    g.beginPath(); g.arc(hx, hy, r * 0.16, 0, Math.PI * 2); g.fillStyle = body; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
  }
}
function face(g, k, r, mood, tall) {
  const { t = 0, blink = 0, refuse = 0, happy = 0, puzzled = 0, look = 0 } = mood;
  const ey = -r * 0.12 * tall, ex = r * 0.34, er = k === 'timid' ? r * 0.2 : r * 0.13;
  const lx = look * r * 0.06;
  g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round';
  if (k === 'parrot') { // a beak and side eyes
    g.beginPath(); g.moveTo(-r * 0.2, -r * 0.02); g.quadraticCurveTo(r * 0.05, -r * 0.3, r * 0.25, 0); g.quadraticCurveTo(r * 0.05, r * 0.4, -r * 0.2, r * 0.1); g.closePath(); g.fillStyle = '#ffb02e'; g.fill(); g.stroke();
    g.fillStyle = INK;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.45 + lx, -r * 0.3, r * 0.11, 0, Math.PI * 2); g.fill(); }
    return;
  }
  const shut = blink > 0.5 || (happy > 0) || k === 'less' && refuse === 0 && false;
  for (const s of [-1, 1]) {
    const x = s * ex + lx;
    if (k === 'swap' && !shut) { // spiral eyes
      g.beginPath(); for (let a = 0; a < 9; a += 0.4) { const rr = er * 0.15 * a; g.lineTo(x + Math.cos(a + t * 4 * s) * rr, ey + Math.sin(a + t * 4 * s) * rr); } g.lineWidth = 1.6; g.stroke();
    } else if (shut || k === 'teller' && false) {
      g.beginPath(); g.arc(x, ey, er, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 2; g.stroke();
    } else {
      if (k === 'timid') { g.beginPath(); g.arc(x, ey, er, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.6; g.stroke(); g.beginPath(); g.arc(x + lx, ey + er * 0.2, er * 0.55, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); }
      else { g.beginPath(); g.arc(x, ey, er, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); g.beginPath(); g.arc(x - er * 0.3, ey - er * 0.35, er * 0.35, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); }
    }
    if (k === 'less' || refuse > 0) { // cross brows
      g.beginPath(); g.moveTo(x - s * er * 1.6, ey - er * 2.2); g.lineTo(x + s * er * 1.2, ey - er * 1.3); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
    }
    if (k === 'more') { g.beginPath(); g.arc(x, ey - er * 2.4, er * 1.2, Math.PI * 1.15, Math.PI * 1.85); g.lineWidth = 2; g.stroke(); }
  }
  // cheeks
  g.fillStyle = 'rgba(255,110,120,.35)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.55, r * 0.15, r * 0.14, r * 0.09, 0, 0, Math.PI * 2); g.fill(); }
  // mouth
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath();
  const my = r * 0.22 * tall;
  if (happy > 0 || k === 'more') { g.arc(0, my - r * 0.05, r * (k === 'more' ? 0.24 : 0.2), 0.1, Math.PI - 0.1); g.closePath(); g.fillStyle = '#7a2438'; g.fill(); g.stroke(); }
  else if (refuse > 0 || k === 'less') { g.arc(0, my + r * 0.16, r * 0.17, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  else if (puzzled > 0 || k === 'timid') { g.ellipse(0, my + r * 0.03, r * 0.08, r * 0.1, 0, 0, Math.PI * 2); g.fillStyle = '#7a2438'; g.fill(); g.stroke(); }
  else if (k === 'flip') { g.moveTo(-r * 0.15, my + r * 0.05); g.lineTo(r * 0.15, my); g.stroke(); }
  else { g.arc(0, my - r * 0.04, r * 0.16, 0.25, Math.PI - 0.25); g.stroke(); }
}
function hat(g, node, r, t, react, tall) {
  const k = node.kind, top = -r * tall;
  g.lineWidth = 2.2; g.strokeStyle = INK;
  if (node.once) { // a nightcap with a pom-pom
    g.beginPath(); g.moveTo(-r * 0.62, top + r * 0.28); g.quadraticCurveTo(-r * 0.1, top - r * 0.75, r * 0.85, top - r * 0.25); g.quadraticCurveTo(r * 0.3, top - r * 0.1, r * 0.62, top + r * 0.28); g.closePath();
    g.fillStyle = '#5b6bd6'; g.fill(); g.stroke();
    g.beginPath(); g.arc(r * 0.88, top - r * 0.24, r * 0.15, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.stroke();
    return;
  }
  if (k === 'paint') { // a beret in their colour
    g.beginPath(); g.ellipse(-r * 0.1, top + r * 0.12, r * 0.75, r * 0.26, -0.2, 0, Math.PI * 2); g.fillStyle = COLOUR[node.arg]; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-r * 0.15, top - r * 0.12); g.lineTo(-r * 0.1, top - r * 0.32); g.stroke();
  } else if (k === 'honest') { // a sprout
    g.beginPath(); g.moveTo(0, top + r * 0.05); g.lineTo(0, top - r * 0.3); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.17, top - r * 0.33, r * 0.18, r * 0.09, s * -0.5, 0, Math.PI * 2); g.fillStyle = '#5fbf5a'; g.fill(); g.stroke(); }
  } else if (k === 'less') { // a flat cap
    g.beginPath(); g.ellipse(0, top + r * 0.18, r * 0.8, r * 0.28, 0, Math.PI, Math.PI * 2); g.closePath(); g.fillStyle = '#5d6a7c'; g.fill(); g.stroke();
    g.beginPath(); g.ellipse(r * 0.45, top + r * 0.2, r * 0.45, r * 0.1, 0.1, 0, Math.PI * 2); g.fillStyle = '#4a5566'; g.fill(); g.stroke();
  } else if (k === 'swap') { // a curl of hair
    g.beginPath(); g.moveTo(0, top + r * 0.1); g.bezierCurveTo(r * 0.5, top - r * 0.5, -r * 0.4, top - r * 0.6, -r * 0.05, top - r * 0.2); g.lineWidth = 3; g.stroke();
  } else if (k === 'carve') { // a hard hat
    g.beginPath(); g.arc(0, top + r * 0.3, r * 0.68, Math.PI, Math.PI * 2); g.closePath(); g.fillStyle = '#f0b429'; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-r * 0.85, top + r * 0.3); g.lineTo(r * 0.85, top + r * 0.3); g.lineWidth = 3.5; g.stroke();
  } else if (k === 'flip') { // a hat worn upside down
    g.beginPath(); g.moveTo(-r * 0.4, top + r * 0.02); g.lineTo(-r * 0.55, top - r * 0.45); g.lineTo(r * 0.55, top - r * 0.45); g.lineTo(r * 0.4, top + r * 0.02); g.closePath(); g.fillStyle = '#39456b'; g.fill(); g.stroke();
    g.beginPath(); g.ellipse(0, top - r * 0.48, r * 0.75, r * 0.12, 0, 0, Math.PI * 2); g.fillStyle = '#39456b'; g.fill(); g.stroke();
  } else if (k === 'more') { // a party hat
    g.beginPath(); g.moveTo(-r * 0.32, top + r * 0.12); g.lineTo(r * 0.05, top - r * 0.62); g.lineTo(r * 0.38, top + r * 0.1); g.closePath(); g.fillStyle = '#ff6f91'; g.fill(); g.stroke();
    g.beginPath(); g.arc(r * 0.05, top - r * 0.64, r * 0.1, 0, Math.PI * 2); g.fillStyle = '#fff3a8'; g.fill(); g.stroke();
  } else if (k === 'parrot') { // crest feathers
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(i * r * 0.18, top - r * 0.12, r * 0.1, r * 0.3, i * 0.4, 0, Math.PI * 2); g.fillStyle = ['#ff6b5a', '#ffd23f', '#4aa8ff'][i + 1]; g.fill(); g.stroke(); }
  } else if (k === 'teller') { // a scarf
    g.beginPath(); g.ellipse(0, r * 0.62, r * 0.7, r * 0.16, 0, 0, Math.PI * 2); g.fillStyle = '#d64550'; g.fill(); g.stroke();
  } else if (k === 'timid') { // a bow
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.2, top + r * 0.05, r * 0.2, r * 0.13, 0, 0, Math.PI * 2); g.fillStyle = '#ff8fb3'; g.fill(); g.stroke(); }
  }
}
function hearts(g, r, a) {
  g.save(); g.globalAlpha *= Math.min(1, a * 1.5);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * r * 0.8, y = -r * 1.5 - a * r * (0.6 + i * 0.25);
    g.beginPath(); const s = r * 0.22;
    g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.6, y - s * 0.3, x - s * 0.6, y - s * 1.4, x, y - s * 0.4); g.bezierCurveTo(x + s * 0.6, y - s * 1.4, x + s * 1.6, y - s * 0.3, x, y + s * 0.9);
    g.fillStyle = '#ff5d7a'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
  }
  g.restore();
}

// A thought bubble with puffs leading down to (fx, fy).
export function bubble(g, x, y, w, h, fx, fy, fill = CREAM) {
  g.save();
  g.fillStyle = fill; g.strokeStyle = INK; g.lineWidth = 2.5;
  const puffs = [[0.4, 0.45], [0.7, 0.75]];
  for (const [p, s] of puffs) { const px = fx + (x - fx) * p, py = fy + (y + h / 2 - fy) * p; g.beginPath(); g.arc(px, py, 4 * s + 2, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.beginPath(); roundRect(g, x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.45); g.fill(); g.stroke();
  g.restore();
}

// A ghost hand that shows the gesture.
// flip draws it mirrored, reaching in from the left.
export function hand(g, x, y, press, scale = 1, flip = false) {
  g.save(); g.translate(x, y); g.scale(flip ? -scale : scale, scale); g.rotate(-0.35);
  g.globalAlpha *= 0.85;
  if (press > 0) { g.beginPath(); g.arc(0, 0, 14 + press * 10, 0, Math.PI * 2); g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - press)})`; g.lineWidth = 3; g.stroke(); }
  g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5;
  g.beginPath(); roundRect(g, -6, -2, 12, 30, 6); g.fill(); g.stroke(); // finger
  g.beginPath(); roundRect(g, -10, 16, 34, 34, 12); g.fill(); g.stroke(); // palm
  g.beginPath(); roundRect(g, 6, 12, 10, 18, 5); g.fill(); g.stroke();
  g.beginPath(); roundRect(g, 15, 15, 10, 16, 5); g.fill(); g.stroke();
  g.restore();
}

// The evening village behind the board: sky, roofs, a string of lanterns, grass.
export function backdrop(g, W, H, top) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#241a46'); sky.addColorStop(0.35, '#3b2a5c'); sky.addColorStop(1, '#2a3b3a');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // ground glow in the middle of the square
  const glow = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, Math.max(W, H) * 0.7);
  glow.addColorStop(0, 'rgba(255,190,120,.16)'); glow.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // stars
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = 'rgba(255,240,210,.7)';
  for (let i = 0; i < 40; i++) { const x = rand() * W, y = rand() * top * 0.9; g.beginPath(); g.arc(x, y, rand() * 1.2 + 0.3, 0, Math.PI * 2); g.fill(); }
  // cobbles
  g.fillStyle = 'rgba(255,230,200,.04)';
  for (let i = 0; i < 160; i++) { const x = rand() * W, y = top + rand() * (H - top); g.beginPath(); g.ellipse(x, y, 6 + rand() * 8, 4 + rand() * 4, rand(), 0, Math.PI * 2); g.fill(); }
  // On a wide screen the board stays a phone-wide column (see BOARD_HALF); the street fills both sides.
  if (W >= WIDE) {
    const inner = BOARD_HALF + 30;
    street(g, 0, W / 2 - inner, top, H, rand, 0);
    street(g, W / 2 + inner, W, top, H, rand, 1);
    return;
  }
  // houses along both sides
  for (const side of [0, 1]) {
    for (let i = 0; i < 4; i++) {
      const hw = 34 + rand() * 10, hh = 40 + rand() * 20;
      const x = side ? W - hw * 0.45 : -hw * 0.55, y = top + 40 + i * (H - top - 60) / 4 + rand() * 20;
      g.fillStyle = ['#4a3352', '#3e3a5e', '#523a3f', '#3b4a4f'][(i + side) % 4];
      g.fillRect(x, y, hw, hh);
      g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + hw / 2, y - 18); g.lineTo(x + hw + 4, y); g.closePath(); g.fillStyle = '#2a1d33'; g.fill();
      const wx = side ? x + 6 : x + hw - 16;
      const win = g.createRadialGradient(wx + 5, y + 16, 1, wx + 5, y + 16, 22); win.addColorStop(0, 'rgba(255,200,110,.45)'); win.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = win; g.fillRect(wx - 20, y - 6, 50, 46);
      g.fillStyle = '#ffd27a'; g.fillRect(wx, y + 10, 10, 12);
    }
  }
}
// Wide screens: the board keeps this half-width, and the rest is street.
export const WIDE = 700, BOARD_HALF = 300;
// Rows of houses facing the square, with lit windows, doors, trees and lamp posts, between x0 and x1.
// side 0 is the left street, 1 the right; the house nearest the board is the lowest.
function street(g, x0, x1, top, H, rand, side) {
  if (x1 - x0 < 40) return;
  const rows = Math.max(3, Math.round((H - top) / 150));
  const step = (H - top - 90) / rows;
  for (let row = 0; row < rows; row++) {
    const base = top + 120 + row * step; // the street level of this row
    let x = x0 - 20 + rand() * 30;
    while (x < x1) {
      const hw = 54 + rand() * 46, hh = 52 + rand() * 46, far = side ? (x - x0) / (x1 - x0 + 1) : 1 - (x - x0) / (x1 - x0 + 1);
      const shade = 0.6 + 0.25 * far; // houses further from the square sit a little darker
      const wall = ['#4a3352', '#3e3a5e', '#523a3f', '#3b4a4f', '#463a55'][Math.floor(rand() * 5)];
      g.save(); g.globalAlpha = shade;
      g.fillStyle = wall; g.fillRect(x, base - hh, hw, hh);
      // roof
      g.beginPath(); g.moveTo(x - 5, base - hh); g.lineTo(x + hw / 2, base - hh - 16 - rand() * 12); g.lineTo(x + hw + 5, base - hh); g.closePath();
      g.fillStyle = '#2a1d33'; g.fill();
      // chimney, sometimes
      if (rand() < 0.4) { g.fillStyle = '#2a1d33'; g.fillRect(x + hw * 0.7, base - hh - 22, 7, 14); }
      // windows: some lit, with a glow
      const cols = Math.max(1, Math.floor(hw / 28));
      for (let c = 0; c < cols; c++) {
        for (let w = 0; w < (hh > 70 ? 2 : 1); w++) {
          const wx = x + (c + 0.5) * hw / cols - 5, wy = base - hh + 12 + w * 26;
          if (rand() < 0.7) {
            const glow = g.createRadialGradient(wx + 5, wy + 6, 1, wx + 5, wy + 6, 22);
            glow.addColorStop(0, 'rgba(255,200,110,.38)'); glow.addColorStop(1, 'rgba(255,200,110,0)');
            g.fillStyle = glow; g.fillRect(wx - 18, wy - 16, 46, 44);
            g.fillStyle = '#ffd27a';
          } else g.fillStyle = '#2b2338';
          g.fillRect(wx, wy, 10, 12);
          g.fillStyle = 'rgba(43,24,48,.6)'; g.fillRect(wx + 4.5, wy, 1, 12); g.fillRect(wx, wy + 5.5, 10, 1);
        }
      }
      // door
      g.fillStyle = '#2a1d33'; g.beginPath(); roundRect(g, x + hw / 2 - 6, base - 18, 12, 18, 4); g.fill();
      g.restore();
      // a tree or a lamp post in the gap
      const gap = 10 + rand() * 26;
      if (gap > 22 && rand() < 0.6) {
        const tx = x + hw + gap / 2;
        if (rand() < 0.5) {
          g.fillStyle = '#3a2a2a'; g.fillRect(tx - 2, base - 16, 4, 16);
          g.fillStyle = ['#2f5a45', '#355f4a', '#2b4f43'][Math.floor(rand() * 3)];
          g.beginPath(); g.arc(tx, base - 24, 12, 0, Math.PI * 2); g.arc(tx - 7, base - 18, 8, 0, Math.PI * 2); g.arc(tx + 7, base - 18, 8, 0, Math.PI * 2); g.fill();
        } else {
          g.fillStyle = '#2a1d33'; g.fillRect(tx - 1.5, base - 40, 3, 40);
          const glow = g.createRadialGradient(tx, base - 42, 1, tx, base - 42, 26);
          glow.addColorStop(0, 'rgba(255,214,140,.5)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
          g.fillStyle = glow; g.fillRect(tx - 26, base - 68, 52, 52);
          g.fillStyle = '#ffe3a0'; g.beginPath(); g.arc(tx, base - 42, 4, 0, Math.PI * 2); g.fill();
        }
      }
      x += hw + gap;
    }
  }
}
// The strings of lanterns across each street on a wide screen, between the rows of houses.
function sideStrings(g, W, H, top, t) {
  const inner = BOARD_HALF + 30, rows = Math.max(3, Math.round((H - top) / 150)), step = (H - top - 90) / rows;
  for (const [x0, x1] of [[0, W / 2 - inner], [W / 2 + inner, W]]) {
    if (x1 - x0 < 80) continue;
    for (let row = 0; row < rows; row++) {
      const y = top + 120 + row * step - step * 0.55, sag = 18;
      g.strokeStyle = 'rgba(30,20,30,.7)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x0 - 4, y); g.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1 + 4, y); g.stroke();
      const n = Math.max(3, Math.round((x1 - x0) / 60));
      for (let i = 0; i < n; i++) {
        const p = (i + 0.5) / n, x = x0 + p * (x1 - x0), yy = y + sag * 2 * 2 * p * (1 - p) + 1;
        g.save(); g.translate(x, yy); g.rotate(Math.sin(t * 1.1 + i + row * 2) * 0.09);
        const glow = g.createRadialGradient(0, 7, 1, 0, 7, 18); glow.addColorStop(0, 'rgba(255,170,90,.45)'); glow.addColorStop(1, 'rgba(255,170,90,0)');
        g.fillStyle = glow; g.fillRect(-18, -11, 36, 36);
        g.fillStyle = ['#ff8a5c', '#ffcf5c', '#ff6f8a', '#9be07a'][(i + row) % 4];
        g.beginPath(); g.ellipse(0, 7, 5, 6.5, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  }
}
// A string of lanterns across the top, swaying. On a wide screen, more strings across the side streets.
export function lanterns(g, W, y, t, H = 0, top = 0) {
  if (W >= WIDE && H) sideStrings(g, W, H, top, t);
  g.strokeStyle = 'rgba(30,20,30,.8)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-10, y); g.quadraticCurveTo(W / 2, y + 26, W + 10, y); g.stroke();
  const n = Math.max(5, Math.round(W / 70));
  for (let i = 0; i < n; i++) {
    const p = (i + 0.5) / n, x = p * W, yy = y + 26 * 2 * p * (1 - p) * 2 * 0.5 + 2, sw = Math.sin(t * 1.3 + i) * 0.08;
    g.save(); g.translate(x, yy); g.rotate(sw);
    const glow = g.createRadialGradient(0, 10, 1, 0, 10, 26); glow.addColorStop(0, 'rgba(255,170,90,.55)'); glow.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = glow; g.fillRect(-26, -16, 52, 52);
    g.fillStyle = ['#ff8a5c', '#ffcf5c', '#ff6f8a', '#9be07a'][i % 4];
    g.beginPath(); g.ellipse(0, 10, 7, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(40,20,20,.6)'; g.fillRect(-4, 0, 8, 2); g.fillRect(-4, 18, 8, 2);
    g.restore();
  }
}
export { SHAPES };
