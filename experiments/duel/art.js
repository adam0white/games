// Thumb Duel: drawing in code. Every function draws at screen pixels on a 2D context; nothing here knows the rules.
export const C = {
  night: '#211a33', night2: '#2c2245', ink: '#1b1328', cream: '#fff4dc', paper: '#f7e6c4',
  warm: ['#ff8a5c', '#ffb48f', '#c9502a'], // side 0, at the bottom: ember
  cool: ['#58d0c4', '#9be8de', '#2a8f86'], // side 1, at the top: mint
  gold: '#ffd166', leaf: '#4f9a5e', leafDark: '#2f6b40', rope: '#d9b77a', ropeDark: '#a5834c',
  pads: ['#ff6b6b', '#ffd166', '#3fd49a', '#5aa8ff'],
};
export const side = i => i === 0 ? C.warm : C.cool;
export const TAU = Math.PI * 2;

export function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); }
export function shadow(g, blur = 10, y = 4, color = '#0008') { g.shadowColor = color; g.shadowBlur = blur; g.shadowOffsetY = y; g.shadowOffsetX = 0; }
export function noShadow(g) { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; }

export function star(g, x, y, r, fill, stroke = C.ink, lw = 2) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.lineJoin = 'round'; g.stroke(); }
}

// A round little critter, facing up the screen (toward the middle), in the side's colours.
// lean: -1..1 (leaning back toward its own edge when positive), squash: 0..1, blink: eyes shut.
export function critter(g, x, y, r, cols, { lean = 0, squash = 0, happy = false, sad = false, dizzy = 0, t = 0 } = {}) {
  g.save(); g.translate(x, y); g.rotate(lean * 0.25);
  const sx = 1 + squash * 0.18, sy = 1 - squash * 0.16;
  g.scale(sx, sy);
  shadow(g, 12, 5);
  circle(g, 0, 0, r); g.fillStyle = cols[0]; g.fill(); noShadow(g);
  g.lineWidth = Math.max(2, r * 0.09); g.strokeStyle = C.ink; g.stroke();
  // belly
  g.beginPath(); g.ellipse(0, r * 0.32, r * 0.58, r * 0.45, 0, 0, TAU); g.fillStyle = cols[1]; g.fill();
  // ears
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.62, -r * 0.78, r * 0.22, r * 0.3, s * 0.5, 0, TAU); g.fillStyle = cols[0]; g.fill(); g.stroke(); }
  // eyes look toward the middle (up)
  const ey = -r * 0.25;
  for (const s of [-1, 1]) {
    if (dizzy > 0) { g.beginPath(); for (let a = 0; a < 9; a += 0.4) g.lineTo(s * r * 0.33 + Math.cos(a + t * 8) * a * r * 0.02, ey + Math.sin(a + t * 8) * a * r * 0.02); g.lineWidth = 2; g.stroke(); continue; }
    if (happy) { g.beginPath(); g.arc(s * r * 0.33, ey + r * 0.05, r * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = Math.max(2, r * 0.08); g.stroke(); continue; }
    circle(g, s * r * 0.33, ey, r * 0.17); g.fillStyle = '#fff'; g.fill();
    circle(g, s * r * 0.33, ey - r * 0.05, r * 0.09); g.fillStyle = C.ink; g.fill();
  }
  // mouth
  g.beginPath();
  if (sad) g.arc(0, r * 0.2, r * 0.14, Math.PI * 1.15, Math.PI * 1.85); else g.arc(0, r * 0.02, r * 0.14, Math.PI * 0.15, Math.PI * 0.85);
  g.lineWidth = Math.max(2, r * 0.07); g.strokeStyle = C.ink; g.stroke();
  g.restore();
}

// A beetle seen from above, horn pointing up the screen.
export function beetle(g, x, y, r, cols, { squash = 0, stun = 0, t = 0, glow = 0 } = {}) {
  g.save(); g.translate(x, y); g.scale(1 + squash * 0.12, 1 - squash * 0.14);
  if (glow > 0) { circle(g, 0, 0, r * 1.45); g.fillStyle = cols[1] + '33'; g.fill(); }
  g.strokeStyle = C.ink; g.lineWidth = Math.max(2, r * 0.08); g.lineCap = 'round';
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { // legs, paddling
    const a = (i - 1) * 0.55 + Math.sin(t * 14 + i * 2 + (s > 0 ? 1 : 0)) * 0.12 * (glow > 0 ? 1 : 0.3);
    g.beginPath(); g.moveTo(s * r * 0.55, (i - 1) * r * 0.45); g.lineTo(s * (r * 1.05 + Math.cos(a) * r * 0.15), (i - 1) * r * 0.55 + Math.sin(a) * r * 0.2); g.stroke();
  }
  shadow(g, 10, 4);
  g.beginPath(); g.ellipse(0, r * 0.1, r * 0.8, r, 0, 0, TAU); g.fillStyle = cols[0]; g.fill(); noShadow(g); g.stroke();
  g.beginPath(); g.moveTo(0, -r * 0.35); g.lineTo(0, r * 1.05); g.stroke(); // wing line
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.35, r * 0.3, r * 0.14, r * 0.22, 0, 0, TAU); g.fillStyle = cols[1]; g.fill(); }
  g.beginPath(); g.ellipse(0, -r * 0.62, r * 0.48, r * 0.34, 0, 0, TAU); g.fillStyle = cols[2]; g.fill(); g.stroke(); // head
  g.beginPath(); g.moveTo(-r * 0.12, -r * 0.85); g.quadraticCurveTo(0, -r * 1.55, r * 0.05, -r * 1.4); g.quadraticCurveTo(r * 0.12, -r * 1.1, r * 0.12, -r * 0.85); g.fillStyle = C.ink; g.fill(); // horn
  for (const s of [-1, 1]) { circle(g, s * r * 0.22, -r * 0.66, r * 0.09); g.fillStyle = '#fff'; g.fill(); }
  g.restore();
  if (stun > 0) for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; star(g, x + Math.cos(a) * r * 0.9, y - r * 0.6 + Math.sin(a) * r * 0.3, r * 0.22, C.gold, C.ink, 1.5); }
}

// A paper lantern; lit 0..1.
export function lantern(g, x, y, r, lit, t) {
  if (lit > 0) {
    const gl = g.createRadialGradient(x, y, r * 0.3, x, y, r * 3.2);
    gl.addColorStop(0, `rgba(255,214,120,${0.75 * lit})`); gl.addColorStop(1, 'rgba(255,214,120,0)');
    g.fillStyle = gl; circle(g, x, y, r * 3.2); g.fill();
    g.save(); g.translate(x, y); g.rotate(t * 0.6);
    g.strokeStyle = `rgba(255,230,160,${0.7 * lit})`; g.lineWidth = 4; g.lineCap = 'round';
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10; g.beginPath(); g.moveTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5); g.lineTo(Math.cos(a) * r * (1.9 + 0.25 * Math.sin(t * 9 + i)), Math.sin(a) * r * (1.9 + 0.25 * Math.sin(t * 9 + i))); g.stroke(); }
    g.restore();
  }
  shadow(g, 14, 5);
  g.beginPath(); g.ellipse(x, y, r * 0.95, r * 1.12, 0, 0, TAU);
  const body = g.createLinearGradient(x - r, y, x + r, y);
  if (lit > 0) { body.addColorStop(0, '#ffb347'); body.addColorStop(0.5, '#fff1a8'); body.addColorStop(1, '#ffb347'); }
  else { body.addColorStop(0, '#7a2f2f'); body.addColorStop(0.5, '#a84a3a'); body.addColorStop(1, '#7a2f2f'); }
  g.fillStyle = body; g.fill(); noShadow(g);
  g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  g.lineWidth = 1.5; g.strokeStyle = lit > 0 ? '#e09a3a' : '#5a2222';
  for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.ellipse(x, y, r * 0.95 * Math.abs(Math.cos(k * 1.3)) * (k ? 0.6 : 0.05) + 0.5, r * 1.1, 0, 0, TAU); g.stroke(); }
  for (const s of [-1, 1]) { rrect(g, x - r * 0.5, y + s * r * 1.12 - r * 0.12, r, r * 0.24, 4); g.fillStyle = '#3a2a1a'; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke(); }
}

// A firefly: a glowing dot with a little body.
export function firefly(g, x, y, r, t) {
  const pulse = 0.75 + 0.25 * Math.sin(t * 12);
  const gl = g.createRadialGradient(x, y, 0, x, y, r * 4.5);
  gl.addColorStop(0, `rgba(230,255,140,${0.9 * pulse})`); gl.addColorStop(0.35, `rgba(200,255,120,${0.35 * pulse})`); gl.addColorStop(1, 'rgba(200,255,120,0)');
  g.fillStyle = gl; circle(g, x, y, r * 4.5); g.fill();
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * r * 0.9, y - r * 0.5, r * 0.8, r * 0.45, s * (0.4 + 0.3 * Math.sin(t * 40)), 0, TAU); g.fillStyle = '#ffffffaa'; g.fill(); }
  circle(g, x, y, r); g.fillStyle = '#f4ff9a'; g.fill();
}

// A seed (the air-hockey puck), pointing along its motion.
export function seed(g, x, y, r, angle) {
  g.save(); g.translate(x, y); g.rotate(angle);
  shadow(g, 8, 3);
  g.beginPath(); g.moveTo(r * 1.25, 0); g.bezierCurveTo(r * 0.6, -r * 1.1, -r * 1.1, -r * 0.9, -r * 1.05, 0); g.bezierCurveTo(-r * 1.1, r * 0.9, r * 0.6, r * 1.1, r * 1.25, 0);
  g.fillStyle = '#c98a4a'; g.fill(); noShadow(g); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
  g.beginPath(); g.moveTo(r * 0.9, 0); g.quadraticCurveTo(0, -r * 0.25, -r * 0.7, 0); g.strokeStyle = '#8a5a2a'; g.lineWidth = 2; g.stroke();
  circle(g, -r * 0.3, -r * 0.35, r * 0.18); g.fillStyle = '#f2c48a'; g.fill();
  g.restore();
}

export function paddle(g, x, y, r, cols, press = 0) {
  shadow(g, 12, 5);
  circle(g, x, y, r); g.fillStyle = cols[2]; g.fill(); noShadow(g);
  g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  circle(g, x, y, r * 0.78); g.fillStyle = cols[0]; g.fill();
  circle(g, x, y - r * 0.05, r * 0.38 * (1 - press * 0.1)); g.fillStyle = cols[1]; g.fill(); g.lineWidth = 2.5; g.stroke();
  circle(g, x - r * 0.12, y - r * 0.18, r * 0.12); g.fillStyle = '#ffffffaa'; g.fill();
}

// A dewdrop sitting on a surface at (x, y); squash from speed.
export function drop(g, x, y, r, squash = 0) {
  g.save(); g.translate(x, y - r * (1 - squash * 0.25)); g.scale(1 + squash * 0.3, 1 - squash * 0.25);
  const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#bfefff'); gr.addColorStop(1, '#4fa9d8');
  shadow(g, 10, 4, '#0006');
  g.beginPath(); g.moveTo(0, -r * 1.25); g.bezierCurveTo(r * 0.55, -r * 0.7, r, -r * 0.2, r, r * 0.2); g.arc(0, r * 0.2, r, 0, Math.PI); g.bezierCurveTo(-r, -r * 0.2, -r * 0.55, -r * 0.7, 0, -r * 1.25);
  g.fillStyle = gr; g.fill(); noShadow(g); g.lineWidth = 2.5; g.strokeStyle = '#1b3a55'; g.stroke();
  circle(g, -r * 0.35, -r * 0.2, r * 0.18); g.fillStyle = '#fff'; g.fill();
  g.restore();
}

// A pointing finger for the pictograms. Fingertip at (x, y); press 0..1 squashes it.
export function finger(g, x, y, s, press = 0) {
  g.save(); g.translate(x, y + press * s * 0.1); g.scale(s / 40, s / 40 * (1 - press * 0.08));
  shadow(g, 6, 3, '#0007');
  g.fillStyle = '#fff4dc'; g.strokeStyle = C.ink; g.lineWidth = 3;
  rrect(g, -7, 0, 14, 40, 7); g.fill(); g.stroke();
  rrect(g, -13, 26, 34, 32, 12); g.fill(); g.stroke(); noShadow(g);
  rrect(g, -7, 0, 14, 40, 7); g.fill();
  rrect(g, -4, 3, 8, 8, 3); g.fillStyle = '#f2cfb0'; g.fill();
  g.restore();
}
