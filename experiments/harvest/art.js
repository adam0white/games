// Harvest Morning: drawing in code. Every function draws into a 2D context at a centre point and a size in CSS pixels.
export const C = {
  ink: '#3b2a1a', soil: '#b08850', soilDark: '#94703d', stubble: '#d8b672', stubbleDot: '#b8914f', wet: '#7d6a4c',
  wheat: '#f0c24f', wheatDark: '#c9962e', wheatLight: '#ffe08a', grass: '#86ad55', grassDark: '#6c9442', grassLight: '#a4c76d',
  sky: '#9fd3ef', skyWarm: '#ffe6a6', storm: '#5b6476', stormDark: '#3c4352', cream: '#fff4dc', red: '#d0523f', gold: '#e9b23c',
};
export const TAU = Math.PI * 2;

export function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
export function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }

// A grain icon: a small ear of wheat.
export function grain(g, x, y, s, col = C.gold) {
  g.save(); g.translate(x, y); g.rotate(-0.5);
  g.strokeStyle = C.ink; g.lineWidth = Math.max(1, s * 0.09); g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, s * 0.55); g.lineTo(0, -s * 0.1); g.stroke();
  g.fillStyle = col;
  for (let k = 0; k < 3; k++) for (const side of [-1, 1]) { ell(g, side * s * 0.13, -s * 0.05 - k * s * 0.17, s * 0.12, s * 0.2, side * 0.5); g.fill(); g.stroke(); }
  ell(g, 0, -s * 0.55, s * 0.1, s * 0.17); g.fill(); g.stroke();
  g.restore();
}

export function star(g, x, y, r, on) {
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = on ? '#ffd34d' : '#00000022'; g.fill(); g.lineWidth = Math.max(1.5, r * 0.14); g.strokeStyle = on ? C.ink : '#3b2a1a55'; g.stroke();
}

// People, seen from above at a slant: a shadow, a body, a head with hair or a hat. `bob` (0..1) squashes them as they step.
export const LOOKS = {
  me: { body: '#3e74b8', size: 1, skin: '#f2c49b', hat: '#f3d57e', hair: null },
  strong: { body: '#c4473a', size: 1.25, skin: '#d9a27a', hat: null, hair: '#4a2d1c' },
  child: { body: '#f0b92e', size: 0.72, skin: '#f6cfa6', hat: '#d0523f', hair: null, cap: true },
  old: { body: '#7f5aa3', size: 0.95, skin: '#eec4a2', hat: null, hair: '#f2f0ea', bun: true },
  fast: { body: '#4e9a4c', size: 0.92, skin: '#e8b68c', hat: null, hair: '#a2532b' },
};
export function person(g, x, y, r, look, { bob = 0, face = 0, swing = 0, scythe = false, sheaves = 0, tint = null } = {}) {
  const L = LOOKS[look], R = r * L.size;
  const sq = 1 + 0.08 * Math.sin(bob * TAU), st = 1 / sq;
  g.save(); g.translate(x, y);
  g.fillStyle = '#00000030'; ell(g, 0, R * 0.55, R * 0.95, R * 0.42); g.fill();
  // sheaves on the back
  for (let k = 0; k < sheaves; k++) { const sx = -Math.cos(face) * R * 0.5 + (k % 3 - 1) * R * 0.38, sy = -R * 0.35 - Math.floor(k / 3) * R * 0.32 - Math.sin(face) * R * 0.2; sheaf(g, sx, sy, R * 0.75, -0.3 + (k % 3) * 0.3); }
  // scythe
  if (scythe) {
    const a = face + Math.sin(swing * TAU) * 1.1;
    g.save(); g.rotate(a);
    g.strokeStyle = '#7a5130'; g.lineWidth = Math.max(2, R * 0.16); g.lineCap = 'round';
    g.beginPath(); g.moveTo(R * 0.2, 0); g.lineTo(R * 1.55, 0); g.stroke();
    g.strokeStyle = '#dfe6ea'; g.lineWidth = Math.max(2, R * 0.2);
    g.beginPath(); g.arc(R * 1.55, R * 0.75, R * 0.75, -Math.PI / 2, -Math.PI / 2 + 1.5); g.stroke();
    g.restore();
  }
  g.scale(st, sq);
  g.lineWidth = Math.max(1.5, R * 0.12); g.strokeStyle = C.ink;
  g.fillStyle = tint ?? L.body; ell(g, 0, 0, R * 0.7, R * 0.62); g.fill(); g.stroke();
  // arms
  g.fillStyle = L.skin;
  for (const s of [-1, 1]) { ell(g, s * R * 0.62 + Math.cos(face) * R * 0.15, R * 0.05 + Math.sin(face) * R * 0.1, R * 0.17, R * 0.17); g.fill(); g.stroke(); }
  // head
  const hx = Math.cos(face) * R * 0.08, hy = -R * 0.5 + Math.sin(face) * R * 0.06;
  g.fillStyle = L.skin; ell(g, hx, hy, R * 0.42, R * 0.42); g.fill(); g.stroke();
  if (L.hair) { g.fillStyle = L.hair; ell(g, hx, hy - R * 0.12, R * 0.4, R * 0.3); g.fill(); if (L.bun) { ell(g, hx, hy - R * 0.42, R * 0.18, R * 0.15); g.fill(); g.stroke(); } }
  if (L.hat) {
    g.fillStyle = L.hat;
    if (L.cap) { ell(g, hx, hy - R * 0.14, R * 0.42, R * 0.3); g.fill(); g.stroke(); }
    else { ell(g, hx, hy - R * 0.08, R * 0.72, R * 0.48); g.fill(); g.stroke(); g.fillStyle = '#e2bb5c'; ell(g, hx, hy - R * 0.16, R * 0.36, R * 0.28); g.fill(); g.stroke(); g.strokeStyle = '#c4473a'; g.lineWidth = Math.max(1, R * 0.08); g.beginPath(); g.ellipse(hx, hy - R * 0.1, R * 0.37, R * 0.25, 0, 0.2, Math.PI - 0.2); g.stroke(); }
  }
  // eyes look the way they walk
  g.fillStyle = C.ink; const ex = Math.cos(face) * R * 0.1, ey = Math.max(-0.05, Math.sin(face)) * R * 0.12;
  if (!(L.hat && !L.cap) || Math.sin(face) > -0.3) for (const s of [-1, 1]) { ell(g, hx + s * R * 0.14 + ex, hy + R * 0.05 + ey, R * 0.05, R * 0.07); g.fill(); }
  g.restore();
}

// A bundle of cut wheat lying at angle a.
export function sheaf(g, x, y, s, a = 0.5) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.strokeStyle = C.wheatDark; g.lineWidth = Math.max(1, s * 0.08); g.lineCap = 'round';
  g.beginPath(); for (const o of [-0.12, 0, 0.12]) { g.moveTo(-s * 0.45, o * s); g.lineTo(s * 0.2, o * s * 0.6); } g.stroke();
  g.fillStyle = C.wheat; g.strokeStyle = C.ink; g.lineWidth = Math.max(0.8, s * 0.05);
  ell(g, s * 0.3, 0, s * 0.24, s * 0.17); g.fill(); g.stroke();
  g.fillStyle = '#b5482f'; g.fillRect(-s * 0.08, -s * 0.12, s * 0.07, s * 0.24);
  g.restore();
}

export function cart(g, x, y, c, fill, bounce = 0) {
  const w = c * 2.1, h = c * 1.25;
  g.save(); g.translate(x, y - bounce * c * 0.25);
  g.fillStyle = '#00000030'; ell(g, 0, h * 0.55, w * 0.62, h * 0.3); g.fill();
  g.strokeStyle = C.ink; g.lineWidth = Math.max(1.5, c * 0.07);
  // shafts
  g.strokeStyle = '#7a5130'; g.lineWidth = Math.max(2, c * 0.09);
  g.beginPath(); g.moveTo(w * 0.35, h * 0.1); g.lineTo(w * 0.75, h * 0.45); g.moveTo(w * 0.35, -h * 0.1); g.lineTo(w * 0.8, h * 0.2); g.stroke();
  // wheels
  for (const s of [-1, 1]) { g.fillStyle = '#6d4626'; g.strokeStyle = C.ink; g.lineWidth = Math.max(1.5, c * 0.06); rrect(g, s * w * 0.28 - c * 0.18, h * 0.25, c * 0.36, c * 0.42, c * 0.1); g.fill(); g.stroke(); }
  // box
  g.fillStyle = '#a86e3c'; rrect(g, -w / 2, -h / 2, w, h, c * 0.18); g.fill(); g.stroke();
  g.strokeStyle = '#8a5a30'; g.lineWidth = Math.max(1, c * 0.04);
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(-w / 2 + w * k / 4, -h / 2 + 3); g.lineTo(-w / 2 + w * k / 4, h / 2 - 3); g.stroke(); }
  // the heap of grain
  if (fill > 0) {
    const f = Math.min(1, fill);
    g.fillStyle = C.wheat; g.strokeStyle = C.wheatDark; g.lineWidth = Math.max(1, c * 0.04);
    ell(g, 0, -h * 0.05 - f * h * 0.25, w * (0.2 + 0.25 * f), h * (0.15 + 0.3 * f)); g.fill(); g.stroke();
    g.fillStyle = C.wheatLight; ell(g, -w * 0.08, -h * 0.15 - f * h * 0.3, w * 0.1 * (0.5 + f), h * 0.07 * (0.5 + f)); g.fill();
  }
  g.restore();
}

export function crow(g, x, y, s, flap, eating) {
  g.save(); g.translate(x, y);
  if (!eating) { g.fillStyle = '#00000022'; ell(g, s * 0.3, s * 1.1, s * 0.5, s * 0.18); g.fill(); }
  g.fillStyle = '#232631'; g.strokeStyle = '#0e1016'; g.lineWidth = Math.max(1, s * 0.06);
  const w = eating ? 0.15 : Math.sin(flap) * 0.9;
  for (const side of [-1, 1]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(side * s * 1.0, -s * 0.2 - w * s * 0.6); g.lineTo(side * s * 0.75, s * 0.25); g.closePath(); g.fill(); g.stroke(); }
  ell(g, 0, 0, s * 0.35, s * 0.55); g.fill(); g.stroke();
  ell(g, 0, eating ? s * 0.55 : -s * 0.5, s * 0.25, s * 0.25); g.fill(); g.stroke();
  g.fillStyle = '#f0a43a'; g.beginPath(); const by = eating ? s * 0.72 : -s * 0.65; g.moveTo(-s * 0.08, by); g.lineTo(s * 0.08, by); g.lineTo(0, by + (eating ? s * 0.28 : -s * 0.28)); g.closePath(); g.fill();
  g.fillStyle = '#fff'; ell(g, s * 0.09, eating ? s * 0.5 : -s * 0.55, s * 0.06, s * 0.06); g.fill();
  g.restore();
}

export function stone(g, x, y, s) {
  g.fillStyle = '#00000030'; ell(g, x, y + s * 0.2, s * 0.55, s * 0.25); g.fill();
  g.fillStyle = '#9aa1a6'; g.strokeStyle = C.ink; g.lineWidth = Math.max(1, s * 0.07); ell(g, x, y, s * 0.5, s * 0.36); g.fill(); g.stroke();
  g.fillStyle = '#c4cacd'; ell(g, x - s * 0.15, y - s * 0.12, s * 0.18, s * 0.1); g.fill();
}

export function hare(g, x, y, s, peek = 1, t = 0) {
  g.save(); g.translate(x, y);
  g.fillStyle = '#9b7653'; g.strokeStyle = C.ink; g.lineWidth = Math.max(1, s * 0.07);
  const twitch = Math.sin(t * 3) > 0.92 ? 0.25 : 0;
  for (const side of [-1, 1]) { ell(g, side * s * 0.16, -s * 0.45 * peek, s * 0.11, s * 0.36, side * (0.25 + twitch)); g.fill(); g.stroke(); g.fillStyle = '#f0b7b0'; ell(g, side * s * 0.16, -s * 0.45 * peek, s * 0.05, s * 0.24, side * (0.25 + twitch)); g.fill(); g.fillStyle = '#9b7653'; }
  ell(g, 0, 0, s * 0.3, s * 0.24); g.fill(); g.stroke();
  g.fillStyle = C.ink; ell(g, -s * 0.1, -s * 0.03, s * 0.04, s * 0.05); g.fill(); ell(g, s * 0.1, -s * 0.03, s * 0.04, s * 0.05); g.fill();
  g.restore();
}

export function whetstone(g, x, y, s, hot) {
  g.save(); g.translate(x, y); g.rotate(-0.35);
  g.fillStyle = '#00000030'; rrect(g, -s * 0.48, -s * 0.1, s * 0.96, s * 0.34, s * 0.12); g.fill();
  g.fillStyle = hot ? '#b9c2c8' : '#8d969c'; g.strokeStyle = C.ink; g.lineWidth = Math.max(1.5, s * 0.06);
  rrect(g, -s * 0.5, -s * 0.2, s, s * 0.34, s * 0.14); g.fill(); g.stroke();
  g.fillStyle = '#ffffff66'; rrect(g, -s * 0.38, -s * 0.14, s * 0.5, s * 0.07, s * 0.04); g.fill();
  g.restore();
}

// Each neighbour's reason for working, as a small picture: a baby's empty bowl, a sweet, a loaf for winter, a wedding ring.
export function reason(g, id, x, y, s) {
  g.save(); g.translate(x, y); g.strokeStyle = C.ink; g.lineWidth = Math.max(1.2, s * 0.08);
  if (id === 'strong') { // an empty bowl and a baby's rattle
    g.fillStyle = '#e8d8c0'; g.beginPath(); g.arc(0, -s * 0.05, s * 0.42, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#f39bb1'; ell(g, s * 0.3, -s * 0.35, s * 0.14, s * 0.14); g.fill(); g.stroke(); g.beginPath(); g.moveTo(s * 0.22, -s * 0.25); g.lineTo(s * 0.08, -s * 0.08); g.stroke();
  } else if (id === 'child') { // a wrapped sweet
    g.fillStyle = '#e64f73'; ell(g, 0, 0, s * 0.28, s * 0.2); g.fill(); g.stroke();
    for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * s * 0.26, 0); g.lineTo(k * s * 0.5, -s * 0.18); g.lineTo(k * s * 0.5, s * 0.18); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#ffffff99'; ell(g, -s * 0.06, -s * 0.06, s * 0.08, s * 0.05); g.fill();
  } else if (id === 'old') { // a loaf and a snowflake
    g.fillStyle = '#d58b3c'; ell(g, -s * 0.08, s * 0.06, s * 0.36, s * 0.24); g.fill(); g.stroke();
    g.strokeStyle = '#7a4a1e'; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(-s * 0.08 + k * s * 0.14 - s * 0.06, -s * 0.06); g.lineTo(-s * 0.08 + k * s * 0.14 + s * 0.06, s * 0.08); g.stroke(); }
    g.strokeStyle = '#5aa7d6'; g.lineWidth = Math.max(1, s * 0.06); for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(s * 0.34 - Math.cos(a) * s * 0.16, -s * 0.3 - Math.sin(a) * s * 0.16); g.lineTo(s * 0.34 + Math.cos(a) * s * 0.16, -s * 0.3 + Math.sin(a) * s * 0.16); g.stroke(); }
  } else if (id === 'fast') { // a ring with a gem
    g.strokeStyle = '#d9a52c'; g.lineWidth = Math.max(2, s * 0.12); g.beginPath(); g.arc(0, s * 0.08, s * 0.26, 0, TAU); g.stroke();
    g.fillStyle = '#7fd3f0'; g.strokeStyle = C.ink; g.lineWidth = Math.max(1, s * 0.06); g.beginPath(); g.moveTo(0, -s * 0.38); g.lineTo(s * 0.14, -s * 0.2); g.lineTo(0, -s * 0.1); g.lineTo(-s * 0.14, -s * 0.2); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}

// What each neighbour does, as a small picture under them.
export function job(g, id, x, y, s) {
  g.save(); g.translate(x, y);
  if (id === 'strong') { sheaf(g, -s * 0.15, 0, s * 0.7, -0.3); sheaf(g, s * 0.15, -s * 0.05, s * 0.7, 0.3); arrowR(g, s * 0.45, 0, s * 0.3); }
  else if (id === 'child') { crow(g, 0, 0, s * 0.32, 1, false); g.strokeStyle = C.red; g.lineWidth = Math.max(2, s * 0.1); g.beginPath(); g.moveTo(-s * 0.4, -s * 0.35); g.lineTo(s * 0.4, s * 0.35); g.stroke(); }
  else if (id === 'old') { sheaf(g, 0, 0, s * 0.8, 0); g.fillStyle = C.ink; g.font = `bold ${Math.round(s * 0.42)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x2', s * 0.42, -s * 0.25); }
  else if (id === 'fast') { g.strokeStyle = '#dfe6ea'; g.lineWidth = Math.max(2, s * 0.12); g.beginPath(); g.arc(0, s * 0.1, s * 0.32, -2.6, -0.4); g.stroke(); for (const k of [0, 1, 2]) { g.strokeStyle = '#ffffffaa'; g.lineWidth = 2; g.beginPath(); g.moveTo(-s * 0.55, -s * 0.2 + k * s * 0.15); g.lineTo(-s * 0.3, -s * 0.2 + k * s * 0.15); g.stroke(); } }
  g.restore();
}
function arrowR(g, x, y, s) { g.fillStyle = C.ink; g.beginPath(); g.moveTo(x - s * 0.3, y - s * 0.3); g.lineTo(x + s * 0.3, y); g.lineTo(x - s * 0.3, y + s * 0.3); g.closePath(); g.fill(); }

export function cloud(g, x, y, s, dark = false) {
  g.fillStyle = dark ? C.stormDark : C.storm;
  g.beginPath();
  for (const [dx, dy, r] of [[-0.55, 0.1, 0.38], [-0.15, -0.15, 0.5], [0.35, -0.05, 0.42], [0.7, 0.15, 0.3], [0.05, 0.2, 0.45]]) { g.moveTo(x + dx * s + r * s, y + dy * s); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); }
  g.fill();
}
export function sun(g, x, y, r, t) {
  g.save(); g.translate(x, y); g.rotate(t * 0.2);
  g.fillStyle = '#ffd34d'; g.strokeStyle = '#f2a93b'; g.lineWidth = Math.max(1.5, r * 0.15);
  for (let k = 0; k < 8; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(r * 1.15, 0); g.lineTo(r * 1.55, 0); g.stroke(); }
  ell(g, 0, 0, r, r); g.fill(); g.stroke();
  g.restore();
}
