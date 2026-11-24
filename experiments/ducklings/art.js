// Drawings for Follow Me. Every picture is made here in code. Sizes are in pixels; `u` is pixels per pond width.
// Nothing here knows the rules: the page passes positions, headings and phases.

export const COL = {
  water: '#8fd0cc', waterDeep: '#6fb8b9', waterLight: '#c4ece4',
  bank: '#9ccf7a', bankDark: '#78b061', bankEdge: '#5f9a55',
  duckling: '#ffd84d', ducklingLight: '#fff2a8', ducklingDark: '#e0a82a',
  bill: '#ff9a3c', mom: '#9a6b45', momLight: '#c89a6c', momDark: '#5e3f27', speculum: '#3d6fd0',
  rock: '#8b9a8a', rockLight: '#b4c2ae', moss: '#7fa864',
  log: '#8a5a35', logLight: '#b98451', logEnd: '#d6ab75',
  reed: '#5e8f45', reedLight: '#8cbf5f', cattail: '#7a4a2a',
  shadow: 'rgba(30,70,80,.22)', ink: '#24464a',
};

// A little hash so decoration is the same every frame and every visit.
export const hash = (a, b = 0) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------------------------------------------------------------- ducks
// The mother, seen from above, facing `a` (radians, 0 = up the screen). `paddle` 0..1 how fast she swims.
export function mother(g, x, y, a, u, t, paddle, blink, hurt) {
  const L = 0.075 * u, Wd = 0.05 * u;
  g.save(); g.translate(x, y); g.rotate(a);
  // shadow
  g.fillStyle = COL.shadow; g.beginPath(); g.ellipse(0.12 * Wd, 0.1 * L, Wd * 0.62, L * 0.6, 0, 0, 7); g.fill();
  const sway = Math.sin(t * 9) * 0.05 * paddle;
  g.rotate(sway);
  // body
  g.fillStyle = hurt ? '#d98a6a' : COL.mom; g.beginPath(); g.ellipse(0, 0.08 * L, Wd * 0.55, L * 0.55, 0, 0, 7); g.fill();
  // feathers: rows of darker scallops
  g.strokeStyle = COL.momDark; g.globalAlpha = 0.45; g.lineWidth = Math.max(1, 0.004 * u);
  for (let r = 0; r < 4; r++) for (let c = -1; c <= 1; c++) {
    const fx = c * Wd * 0.22 + (r % 2) * Wd * 0.11, fy = -0.1 * L + r * L * 0.15;
    g.beginPath(); g.arc(fx, fy, Wd * 0.09, 0.2, Math.PI - 0.2); g.stroke();
  }
  g.globalAlpha = 1;
  // wings folded, with the blue patch
  for (const s of [-1, 1]) {
    g.fillStyle = COL.momDark; g.beginPath(); g.ellipse(s * Wd * 0.33, 0.2 * L, Wd * 0.2, L * 0.36, s * 0.12, 0, 7); g.fill();
    g.fillStyle = COL.speculum; g.beginPath(); g.ellipse(s * Wd * 0.36, 0.15 * L, Wd * 0.07, L * 0.1, s * 0.12, 0, 7); g.fill();
  }
  // tail
  g.fillStyle = COL.momDark; g.beginPath(); g.moveTo(-Wd * 0.18, 0.55 * L); g.lineTo(0, 0.78 * L); g.lineTo(Wd * 0.18, 0.55 * L); g.fill();
  // head
  const hy = -0.5 * L, nod = Math.sin(t * 4.5) * 0.02 * L;
  g.fillStyle = COL.momLight; g.beginPath(); g.ellipse(0, hy + nod, Wd * 0.27, L * 0.21, 0, 0, 7); g.fill();
  g.fillStyle = COL.momDark; g.beginPath(); g.ellipse(0, hy - 0.04 * L + nod, Wd * 0.12, L * 0.15, 0, 0, 7); g.fill(); // crown stripe
  g.fillStyle = COL.bill; g.beginPath(); g.ellipse(0, hy - 0.22 * L + nod, Wd * 0.11, L * 0.1, 0, 0, 7); g.fill();
  g.fillStyle = '#2a1a10';
  for (const s of [-1, 1]) { g.beginPath(); if (blink) g.ellipse(s * Wd * 0.2, hy - 0.02 * L + nod, Wd * 0.05, Wd * 0.012, 0, 0, 7); else g.arc(s * Wd * 0.2, hy - 0.02 * L + nod, Wd * 0.045, 0, 7); g.fill(); }
  g.restore();
}

// A duckling from above. look: { trait, scared, wait }.
export function duckling(g, x, y, a, u, t, phase, look = {}) {
  const tiny = look.trait === 'tiny' ? 0.82 : 1, R = 0.026 * u * tiny;
  const bob = 1 + Math.sin(t * 7 + phase) * 0.06, wig = Math.sin(t * 11 + phase) * 0.18 * (look.moving ?? 1);
  g.save(); g.translate(x, y);
  g.fillStyle = COL.shadow; g.beginPath(); g.ellipse(R * 0.18, R * 0.25, R * 0.95, R * 1.1, 0, 0, 7); g.fill();
  g.rotate(a + wig * 0.4); g.scale(bob, 1 / bob);
  // fluffy body: a few overlapping circles
  g.fillStyle = look.trait === 'brave' ? '#ffcf3a' : COL.duckling;
  g.beginPath(); g.ellipse(0, R * 0.25, R * 0.82, R, 0, 0, 7); g.fill();
  g.fillStyle = COL.ducklingDark; g.globalAlpha = 0.5;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.55, R * 0.4, R * 0.22, R * 0.42, s * 0.3, 0, 7); g.fill(); } // stubby wings
  g.globalAlpha = 1;
  g.fillStyle = COL.ducklingDark; g.beginPath(); g.moveTo(-R * 0.25, R * 1.1); g.lineTo(0, R * 1.45); g.lineTo(R * 0.25, R * 1.1); g.fill(); // tail tuft
  // head
  const tilt = look.trait === 'curious' ? Math.sin(t * 1.7 + phase) * 0.35 : 0;
  g.rotate(tilt);
  g.fillStyle = COL.ducklingLight; g.beginPath(); g.arc(0, -R * 0.62, R * 0.6, 0, 7); g.fill();
  if (look.trait === 'brave') { g.fillStyle = '#c99018'; g.beginPath(); g.ellipse(0, -R * 0.72, R * 0.32, R * 0.4, 0, 0, 7); g.fill(); } // a darker cap
  if (look.trait === 'eager') { g.strokeStyle = COL.ducklingDark; g.lineWidth = Math.max(1, R * 0.12); g.beginPath(); g.moveTo(0, -R * 1.0); g.quadraticCurveTo(R * 0.3, -R * 1.45, R * 0.05, -R * 1.55); g.stroke(); } // a little crest
  const loud = look.trait === 'loud' ? 1.35 : 1;
  g.fillStyle = COL.bill; g.beginPath(); g.ellipse(0, -R * 1.12, R * 0.26 * loud, R * 0.2 * loud, 0, 0, 7); g.fill();
  if (look.open) { g.fillStyle = '#c0501a'; g.beginPath(); g.ellipse(0, -R * 1.18, R * 0.14, R * 0.06, 0, 0, 7); g.fill(); }
  g.fillStyle = '#1d1a14';
  const sleepy = look.trait === 'sleepy' && !look.scared;
  for (const s of [-1, 1]) {
    g.beginPath();
    if (sleepy || look.blink) g.ellipse(s * R * 0.28, -R * 0.75, R * 0.13, R * 0.04, 0, 0, 7);
    else g.arc(s * R * 0.28, -R * 0.75, R * (look.scared ? 0.14 : 0.1), 0, 7);
    g.fill();
  }
  g.restore();
}

// Warning mark above a waiting duckling or hazard.
export function alert(g, x, y, u, t, col = '#ff6a3d') {
  const s = 1 + Math.max(0, Math.sin(t * 6)) * 0.12, r = 0.028 * u * s;
  g.save(); g.translate(x, y - 0.07 * u - Math.abs(Math.sin(t * 3)) * 0.01 * u);
  g.fillStyle = '#fffdf3'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.beginPath(); g.moveTo(-r * 0.3, r * 0.8); g.lineTo(0, r * 1.5); g.lineTo(r * 0.35, r * 0.75); g.fill();
  g.strokeStyle = col; g.lineWidth = Math.max(1.5, 0.004 * u); g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
  warningMark(g, 0, 0, r * .6, col);
  g.restore();
}

function warningMark(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath(); g.roundRect(x - r * .18, y - r, r * .36, r * 1.2, r * .17); g.fill();
  g.beginPath(); g.arc(x, y + r * .65, r * .19, 0, 7); g.fill();
}

export function chevron(g, x, y, r, angle) {
  g.save(); g.translate(x, y); g.rotate(angle);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-r, r * .4); g.lineTo(0, -r * .65); g.lineTo(r, r * .4);
  g.lineWidth = r * .52; g.strokeStyle = '#416656'; g.stroke();
  g.lineWidth = r * .27; g.strokeStyle = '#fff8d8'; g.stroke();
  g.restore();
}

export function soundWaves(g, x, y, facing, u, phase) {
  g.save(); g.translate(x, y); g.rotate(facing);
  for (let i = 0; i < 3; i++) {
    const r = (.049 + i * .019 + phase * .02) * u;
    g.globalAlpha = Math.min(1, 2 * (1 - phase));
    g.beginPath(); g.arc(0, -.022 * u, r, -Math.PI * .70, -Math.PI * .30);
    g.lineWidth = .012 * u; g.strokeStyle = '#79532c'; g.stroke();
    g.lineWidth = .006 * u; g.strokeStyle = '#fff3af'; g.stroke();
  }
  g.restore();
}

export function sun(g, x, y, r) {
  g.save(); g.translate(x, y);
  g.lineWidth = r * .21; g.lineCap = 'round'; g.strokeStyle = '#fff6ba';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    g.beginPath(); g.moveTo(.77 * dx, .77 * dy); g.lineTo(1.22 * dx, 1.22 * dy); g.stroke();
  }
  oval(g, '#ffed8b', 0, 0, r * .54, r * .54);
  g.restore();
}

// ---------------------------------------------------------------- the pond
export function lilyPad(g, x, y, r, a, flower) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(30,70,60,.18)'; g.beginPath(); g.arc(r * 0.12, r * 0.15, r, 0, 7); g.fill();
  g.fillStyle = '#6fb15a'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, 0.25, Math.PI * 2 - 0.05); g.closePath(); g.fill();
  g.strokeStyle = '#8fcc6e'; g.lineWidth = Math.max(1, r * 0.06); g.beginPath();
  for (let i = 0; i < 5; i++) { const b = 0.6 + i * 1.15; g.moveTo(0, 0); g.lineTo(Math.cos(b) * r * 0.85, Math.sin(b) * r * 0.85); }
  g.stroke();
  if (flower) {
    for (let i = 0; i < 7; i++) { const b = i / 7 * Math.PI * 2; g.fillStyle = i % 2 ? '#ffd1dc' : '#ffb3c6'; g.beginPath(); g.ellipse(Math.cos(b) * r * 0.32, Math.sin(b) * r * 0.32, r * 0.3, r * 0.14, b, 0, 7); g.fill(); }
    g.fillStyle = '#ffe36b'; g.beginPath(); g.arc(0, 0, r * 0.16, 0, 7); g.fill();
  }
  g.restore();
}
export function rock(g, x, y, r, seed) {
  g.fillStyle = 'rgba(30,70,80,.25)'; g.beginPath(); g.ellipse(x + r * 0.12, y + r * 0.16, r * 1.05, r, 0, 0, 7); g.fill();
  g.fillStyle = COL.rock; g.beginPath();
  for (let i = 0; i <= 12; i++) { const b = i / 12 * Math.PI * 2, k = 0.9 + 0.12 * hash(seed, i); g.lineTo(x + Math.cos(b) * r * k, y + Math.sin(b) * r * k); }
  g.fill();
  g.fillStyle = COL.rockLight; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.3, r * 0.5, r * 0.35, -0.4, 0, 7); g.fill();
  g.fillStyle = COL.moss; g.globalAlpha = 0.8;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + (hash(seed, i + 20) - 0.5) * r, y + (hash(seed, i + 30) - 0.2) * r * 0.8, r * (0.12 + 0.12 * hash(seed, i + 40)), 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // a ring of water lapping at the stone
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, r * 0.06); g.beginPath(); g.arc(x, y, r * 1.12, 0.3, 2.6); g.stroke();
}
export function reeds(g, x, y, r, t, seed) {
  g.fillStyle = 'rgba(70,110,60,.22)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = hash(seed, i) * 7, d = Math.sqrt(hash(seed, i + 9)) * r * 0.85, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    const sway = Math.sin(t * 1.6 + i) * r * 0.05;
    g.strokeStyle = i % 2 ? COL.reed : COL.reedLight; g.lineWidth = Math.max(1.5, r * 0.07); g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k < 4; k++) { const b = k / 4 * Math.PI * 2 + i; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(b) * r * 0.3 + sway, cy + Math.sin(b) * r * 0.3); }
    g.stroke();
    if (i % 3 === 0) { g.fillStyle = COL.cattail; g.beginPath(); g.ellipse(cx + sway, cy, r * 0.08, r * 0.16, a, 0, 7); g.fill(); }
  }
}
export function log(g, x, y, half, r, u, seed) {
  const L = half * u, R = r * u;
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(30,60,60,.25)'; g.beginPath(); g.roundRect(-L - R + R * 0.2, -R + R * 0.35, 2 * (L + R), 2 * R, R); g.fill();
  g.fillStyle = COL.log; g.beginPath(); g.roundRect(-L - R, -R, 2 * (L + R), 2 * R, R); g.fill();
  g.strokeStyle = COL.logLight; g.lineWidth = Math.max(1, R * 0.14); g.beginPath();
  for (let i = 0; i < 5; i++) { const yy = (-0.55 + i * 0.27) * R, x0 = -L + hash(seed, i) * L * 0.6, x1 = x0 + L * (0.5 + hash(seed, i + 5) * 0.7); g.moveTo(x0, yy); g.lineTo(Math.min(L, x1), yy); }
  g.stroke();
  for (const s of [-1, 1]) {
    g.fillStyle = COL.logEnd; g.beginPath(); g.ellipse(s * (L + R * 0.55), 0, R * 0.45, R * 0.92, 0, 0, 7); g.fill();
    g.strokeStyle = COL.log; g.lineWidth = Math.max(1, R * 0.1); g.beginPath(); g.ellipse(s * (L + R * 0.55), 0, R * 0.22, R * 0.5, 0, 0, 7); g.stroke();
  }
  // a twig with leaves
  g.strokeStyle = COL.log; g.lineWidth = Math.max(1, R * 0.18); g.beginPath(); g.moveTo(L * 0.2, -R * 0.7); g.lineTo(L * 0.35, -R * 1.5); g.stroke();
  g.fillStyle = '#7fb85a'; g.beginPath(); g.ellipse(L * 0.37, -R * 1.6, R * 0.3, R * 0.16, 0.6, 0, 7); g.fill();
  g.restore();
}
// The pike's shadow under the water: head at (hx, hy), heading `a`.
export function pike(g, pts, u, t) {
  const R = 0.045 * u;
  g.save(); g.fillStyle = 'rgba(25,55,60,.42)';
  const { hx, hy, mx, my, tx, ty } = pts;
  const ax = hx - tx, ay = hy - ty, len = Math.hypot(ax, ay), ang = Math.atan2(ay, ax);
  g.translate((hx + tx) / 2, (hy + ty) / 2); g.rotate(ang);
  g.beginPath(); g.ellipse(0, 0, len * 0.62, R * 0.7, 0, 0, 7); g.fill();
  const flick = Math.sin(t * 9) * 0.35;
  g.beginPath(); g.moveTo(-len * 0.55, 0); g.lineTo(-len * 0.85, R * 0.6 + flick * R); g.lineTo(-len * 0.8, -R * 0.6 + flick * R); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,235,180,.75)'; g.beginPath(); g.arc(len * 0.46, -R * 0.25, R * 0.12, 0, 7); g.arc(len * 0.46, R * 0.25, R * 0.12, 0, 7); g.fill(); // eyes glint
  g.restore();
}
export function turtle(g, x, y, r, u, phase, f, t) {
  const R = r * u;
  if (phase === 'rest') { // a dark shape deep under the water
    g.fillStyle = 'rgba(30,70,60,.18)'; g.beginPath(); g.ellipse(x, y, R * 0.8, R * 0.7, 0, 0, 7); g.fill();
    return;
  }
  if (phase === 'warn') { // rising: the shape darkens and bubbles come up
    g.fillStyle = `rgba(40,80,50,${0.2 + 0.35 * f})`; g.beginPath(); g.ellipse(x, y, R * 0.85, R * 0.75, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1, 0.003 * u);
    for (let i = 0; i < 6; i++) { const k = (f * 2 + i / 6) % 1, a = i * 2.4; g.beginPath(); g.arc(x + Math.cos(a) * R * 0.6 * k, y + Math.sin(a) * R * 0.6 * k, R * (0.06 + 0.1 * k), 0, 7); g.stroke(); }
    g.strokeStyle = `rgba(255,90,60,${0.4 + 0.5 * f})`; g.lineWidth = Math.max(2, 0.006 * u); g.setLineDash([R * 0.25, R * 0.18]);
    g.beginPath(); g.arc(x, y, R * 1.05, 0, 7); g.stroke(); g.setLineDash([]);
    return;
  }
  // snapping: shell out of the water, head lunging
  const lunge = Math.sin(Math.min(1, f * 2) * Math.PI);
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(x, y, R * (1.1 + f * 0.2), 0, 7); g.fill();
  g.fillStyle = '#5d7d3a'; g.beginPath(); g.ellipse(x, y, R * 0.85, R * 0.72, 0, 0, 7); g.fill();
  g.strokeStyle = '#3e5a26'; g.lineWidth = Math.max(1, 0.004 * u);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a) * R * 0.3, y + Math.sin(a) * R * 0.25); g.lineTo(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.68); g.stroke(); }
  g.beginPath(); g.ellipse(x, y, R * 0.3, R * 0.25, 0, 0, 7); g.stroke();
  for (const s of [-1, 1]) { g.fillStyle = '#7d9c4a'; g.beginPath(); g.ellipse(x + s * R * 0.85, y - R * 0.45, R * 0.18, R * 0.12, s, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + s * R * 0.8, y + R * 0.5, R * 0.16, R * 0.11, -s, 0, 7); g.fill(); }
  const hy = y - R * (0.85 + 0.45 * lunge);
  g.fillStyle = '#7d9c4a'; g.beginPath(); g.ellipse(x, hy, R * 0.22, R * 0.28, 0, 0, 7); g.fill();
  g.fillStyle = '#2b2b22'; g.beginPath(); g.moveTo(x - R * 0.14, hy - R * 0.2); g.lineTo(x, hy - R * (0.32 + 0.1 * lunge)); g.lineTo(x + R * 0.14, hy - R * 0.2); g.fill();
}
// The bike path: a sandy track across the pond on a low boardwalk.
export function path(g, y, u, x0, x1) {
  const h = 0.1 * u;
  g.fillStyle = 'rgba(40,60,50,.2)'; g.fillRect(x0, y - h / 2 + h * 0.15, x1 - x0, h);
  g.fillStyle = '#c9a877'; g.fillRect(x0, y - h / 2, x1 - x0, h);
  g.strokeStyle = '#a8865a'; g.lineWidth = Math.max(1, 0.003 * u); g.beginPath();
  for (let x = x0; x < x1; x += 0.035 * u) { g.moveTo(x, y - h / 2); g.lineTo(x, y + h / 2); }
  g.stroke();
  g.fillStyle = '#8f6c45'; g.fillRect(x0, y - h / 2 - 2, x1 - x0, 3); g.fillRect(x0, y + h / 2 - 1, x1 - x0, 3);
}
export function bike(g, x, y, dir, u, t) {
  const R = 0.045 * u;
  g.save(); g.translate(x, y); g.scale(dir, 1);
  g.fillStyle = 'rgba(30,40,40,.25)'; g.beginPath(); g.ellipse(R * 0.1, R * 0.3, R * 1.3, R * 0.5, 0, 0, 7); g.fill();
  g.strokeStyle = '#2f3a44'; g.lineWidth = Math.max(2, R * 0.16); g.lineCap = 'round';
  g.beginPath(); g.moveTo(-R * 1.15, 0); g.lineTo(R * 1.15, 0); g.stroke(); // wheels seen from above are thin lines
  g.strokeStyle = '#d94f3d'; g.lineWidth = Math.max(2, R * 0.2); g.beginPath(); g.moveTo(-R * 0.6, 0); g.lineTo(R * 0.6, 0); g.stroke();
  g.strokeStyle = '#2f3a44'; g.lineWidth = Math.max(2, R * 0.12); g.beginPath(); g.moveTo(R * 0.75, -R * 0.45); g.lineTo(R * 0.75, R * 0.45); g.stroke(); // handlebar
  g.fillStyle = '#3e7cc8'; g.beginPath(); g.ellipse(-R * 0.05, 0, R * 0.38, R * 0.55, 0, 0, 7); g.fill(); // rider's back
  g.fillStyle = '#f2c79a'; g.beginPath(); g.arc(R * 0.28, 0, R * 0.24, 0, 7); g.fill();
  g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(R * 0.24, 0, R * 0.26, Math.PI * 0.6, Math.PI * 1.4); g.fill(); // helmet
  // speed lines
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = Math.max(1, R * 0.08);
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-R * (1.4 + i * 0.25), (i - 1) * R * 0.3); g.lineTo(-R * (2 + i * 0.25), (i - 1) * R * 0.3); g.stroke(); }
  g.restore();
}
export function bell(g, x, y, u, t) {
  const R = 0.032 * u, ring = Math.sin(t * 30) * 0.3;
  g.save(); g.translate(x, y); g.rotate(ring);
  g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(-R, R * 0.6); g.quadraticCurveTo(-R, -R, 0, -R); g.quadraticCurveTo(R, -R, R, R * 0.6); g.closePath(); g.fill();
  g.fillStyle = '#c98a1e'; g.beginPath(); g.arc(0, R * 0.75, R * 0.22, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1.5, 0.004 * u);
  for (const s of [-1, 1]) { g.beginPath(); g.arc(x, y, R * 1.6, s > 0 ? -0.6 : Math.PI - 0.6, s > 0 ? 0.6 : Math.PI + 0.6); g.stroke(); }
}
// The heron on the bank. `look` is the screen angle it looks along.
export function heronBird(g, x, y, look, u) {
  const R = 0.05 * u;
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(30,50,40,.25)'; g.beginPath(); g.ellipse(R * 0.2, R * 0.3, R * 1.0, R * 0.7, 0, 0, 7); g.fill();
  g.fillStyle = '#9aa7b3'; g.beginPath(); g.ellipse(0, 0, R * 0.95, R * 0.62, 0, 0, 7); g.fill();
  g.fillStyle = '#6f7d8a'; g.beginPath(); g.ellipse(0, 0, R * 0.6, R * 0.45, 0, 0, 7); g.fill();
  g.rotate(look);
  g.strokeStyle = '#c8d1da'; g.lineWidth = R * 0.28; g.lineCap = 'round'; g.beginPath(); g.moveTo(R * 0.3, 0); g.lineTo(R * 1.0, 0); g.stroke();
  g.fillStyle = '#e9eef2'; g.beginPath(); g.arc(R * 1.05, 0, R * 0.22, 0, 7); g.fill();
  g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(R * 1.2, -R * 0.08); g.lineTo(R * 1.75, 0); g.lineTo(R * 1.2, R * 0.08); g.fill();
  g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(R * 1.1, -R * 0.1, R * 0.05, 0, 7); g.fill();
  g.restore();
}
// Its shadow, a wedge from the bank. `dirA` is the pond angle it looks along (up the pond is positive).
export function heronBeam(g, x, y, dirA, half, L, u, phase, f) {
  if (phase === 'rest') return;
  g.save(); g.translate(x, y);
  g.beginPath(); g.moveTo(0, 0);
  g.arc(0, 0, L * u, -(dirA + half), -(dirA - half)); g.closePath(); // screen y runs down
  if (phase === 'warn') { g.strokeStyle = `rgba(200,60,40,${0.4 + 0.4 * f})`; g.lineWidth = Math.max(2, 0.005 * u); g.setLineDash([8, 6]); g.stroke(); g.setLineDash([]); g.fillStyle = `rgba(40,40,60,${0.08 * f})`; g.fill(); }
  else { const gr = g.createRadialGradient(0, 0, 0, 0, 0, L * u); gr.addColorStop(0, 'rgba(30,30,55,.45)'); gr.addColorStop(1, 'rgba(30,30,55,.14)'); g.fillStyle = gr; g.fill(); }
  g.restore();
}
export function nest(g, x, y, u, t, glow) {
  const R = 0.17 * u;
  g.fillStyle = `rgba(255,240,170,${0.25 + 0.25 * glow})`; g.beginPath(); g.arc(x, y, R * 1.45, 0, 7); g.fill();
  g.fillStyle = '#86b866'; g.beginPath(); g.ellipse(x, y + R * 0.1, R * 1.25, R * 1.05, 0, 0, 7); g.fill(); // a little island
  g.fillStyle = '#8a6238'; g.beginPath(); g.arc(x, y, R * 0.92, 0, 7); g.fill();
  g.fillStyle = '#b8935c'; g.beginPath(); g.arc(x, y, R * 0.72, 0, 7); g.fill();
  g.strokeStyle = '#d9b77c'; g.lineWidth = Math.max(1, 0.004 * u);
  for (let i = 0; i < 26; i++) { const a = i / 26 * 7, r1 = R * (0.62 + 0.3 * hash(i, 3)); g.beginPath(); g.arc(x, y, r1, a, a + 0.6); g.stroke(); }
  g.fillStyle = '#e8d3a8'; g.beginPath(); g.arc(x, y, R * 0.5, 0, 7); g.fill(); // soft down inside
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + t * 0.2; reedsTuft(g, x + Math.cos(a) * R * 1.1, y + Math.sin(a) * R * 0.95, R * 0.25, t, i); }
}
function reedsTuft(g, x, y, r, t, i) {
  g.strokeStyle = i % 2 ? COL.reed : COL.reedLight; g.lineWidth = Math.max(1.5, r * 0.15); g.lineCap = 'round'; g.beginPath();
  for (let k = 0; k < 5; k++) { const b = k / 5 * 7 + i; g.moveTo(x, y); g.lineTo(x + Math.cos(b) * r + Math.sin(t + k) * r * 0.1, y + Math.sin(b) * r); }
  g.stroke();
}
// A hand pressing: the ghost finger that shows where to hold.
export function ghostFinger(g, x, y, u, t) {
  const p = (t % 1.6) / 1.6, press = p < 0.3 ? p / 0.3 : 1, R = 0.07 * u;
  g.save(); g.globalAlpha = 0.9;
  for (let i = 0; i < 2; i++) { const k = (p + i * 0.5) % 1; g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, R * (0.5 + 1.4 * k), 0, 7); g.stroke(); }
  g.translate(x + R * 0.35, y + R * 0.55 - press * R * 0.15);
  g.rotate(-0.35);
  g.fillStyle = 'rgba(255,248,235,.95)'; g.strokeStyle = 'rgba(80,60,40,.6)'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(-R * 0.28, -R * 0.75, R * 0.56, R * 1.6, R * 0.28); g.fill(); g.stroke(); // the finger
  g.beginPath(); g.roundRect(-R * 0.55, R * 0.35, R * 1.25, R * 1.1, R * 0.4); g.fill(); g.stroke(); // the hand
  g.restore();
}

function oval(g, color, x, y, rx, ry, angle = 0) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  g.fill();
}

export function road(g, y, u, x0, x1) {
  const h = .17 * u;
  g.fillStyle = '#b8c499'; g.fillRect(x0, y - h * .63, x1 - x0, h * 1.26);
  g.fillStyle = '#515d67'; g.fillRect(x0, y - h / 2, x1 - x0, h);
  g.fillStyle = '#fff2b6';
  for (const edge of [-1, 1]) g.fillRect(x0, y + edge * h * .43, x1 - x0, 2 * u / 390);
  g.fillStyle = '#a5a99f';
  for (let x = x0; x < x1; x += .11 * u) g.fillRect(x, y - .002 * u, .058 * u, .004 * u);
}

export function car(g, x, y, u, dir, warn = false) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  if (warn) {
    g.fillStyle = '#ffdb73';
    g.beginPath(); g.moveTo(0, -.023 * u); g.lineTo(.16 * u, -.046 * u); g.lineTo(.16 * u, .046 * u); g.lineTo(0, .023 * u); g.closePath(); g.fill();
  }
  const body = (color, x, y, w, h, r) => {
    g.fillStyle = color; g.beginPath(); g.roundRect(x * u, y * u, w * u, h * u, r * u); g.fill();
  };
  body('#37434c', -.085, -.065, .16, .134, .025);
  body(dir > 0 ? '#e37b5f' : '#f0bb54', -.09, -.054, .18, .108, .024);
  body('#343e48', -.045, -.039, .088, .078, .016);
  body('#afdeef', -.028, -.035, .062, .07, .010);
  body(dir > 0 ? '#d48374' : '#dbad60', -.025, -.032, .039, .064, .007);
  for (const d of [-1, 1]) oval(g, '#fff6c7', .077 * u, d * .033 * u, .009 * u, .012 * u);
  g.restore();
}

export function sleepingCat(g, x, y, r, phase, t) {
  g.save(); g.translate(x, y);
  if (phase !== 'rest') {
    g.fillStyle = phase === 'warn' ? '#ffe49666' : '#ca665b8a';
    g.strokeStyle = phase === 'warn' ? '#916032' : '#853c44';
    g.lineWidth = r * .034; g.setLineDash([r * .08, r * .06]);
    g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke(); g.setLineDash([]);
  }
  oval(g, '#e4c5a4', 0, r * .08, r * .52, r * .42, .18);
  const p = r * (phase === 'act' ? .47 : .34);
  g.strokeStyle = '#a4583b'; g.lineWidth = r * .1; g.lineCap = 'round';
  g.beginPath(); g.arc(r * .09, r * .06, p, .17, Math.PI * 1.48); g.stroke();
  oval(g, '#c77952', -r * .03, r * .06, r * .32, r * .25, -.25);
  for (const side of [-1, 1]) {
    g.fillStyle = '#9a533a';
    g.beginPath(); g.moveTo((-.24 + side * .13) * r, -.20 * r);
    g.lineTo((-.24 + side * .18) * r, -.43 * r);
    g.lineTo((-.24 + side * .02) * r, -.28 * r); g.closePath(); g.fill();
  }
  oval(g, '#df9365', -.24 * r, -.19 * r, .18 * r, .145 * r);
  for (const side of [-1, 1]) oval(g, '#472b2c', (-.24 + side * .068) * r, -.19 * r, .025 * r, (phase === 'rest' ? .009 : .028) * r);
  if (phase === 'rest') {
    for (let i = 0; i < 3; i++) oval(g, '#efdcc7', r * (.05 + .12 * i), -r * (.27 + .07 * i + .025 * Math.sin(t * 3)), r * (.028 + i * .013), r * (.024 + i * .01));
  } else if (phase === 'warn') warningMark(g, r * .27, -r * .32, r * .12, '#61496b');
  g.restore();
}

export function leaves(g, x, y, r, kind, phase, t) {
  g.save(); g.translate(x, y);
  const closed = phase === 'act';
  const danger = kind === 'weed' || closed;
  g.fillStyle = danger ? '#35596a6b' : '#e7e79870';
  g.strokeStyle = danger ? '#412f588c' : '#fff1b6';
  g.lineWidth = r * .032; g.setLineDash([r * .08, r * .055]);
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke(); g.setLineDash([]);
  const count = kind === 'weed' ? 22 : 7;
  for (let i = 0; i < count; i++) {
    const a = i * 2.399, d = r * Math.sqrt(i / count) * .84;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (kind === 'weed') {
      oval(g, i % 3 ? '#67527d' : '#9c6a9c', x, y, r * .14, r * .035, a + .10 * Math.sin(t + i));
      oval(g, '#bc9ac1', x + r * .06, y - r * .05, r * .025, r * .025);
    } else {
      lilyPad(g, x, y, r * (closed ? .14 : .27), a + (phase === 'warn' ? Math.sin(t * 18 + i) * .20 : 0), i === 2 && !closed);
    }
  }
  g.restore();
}

// marks: screen-space {x, y, angle, len, fade} from feedback.driftMarks, moving at the current's own speed.
export function current(g, x, y0, y1, w, u, marks) {
  g.save();
  const shade = g.createLinearGradient(x - w, 0, x + w, 0);
  shade.addColorStop(0, '#2e8eaa00'); shade.addColorStop(.45, '#358eac8c');
  shade.addColorStop(.6, '#358eac8c'); shade.addColorStop(1, '#2e8eaa00');
  g.fillStyle = shade; g.fillRect(x - w, y0, 2 * w, y1 - y0);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const m of marks) {
    g.save(); g.translate(m.x, m.y); g.rotate(m.angle); g.globalAlpha = m.fade;
    // a streak behind the chevron: the longer the streak, the harder the push
    g.strokeStyle = '#edfef070'; g.lineWidth = .005 * u;
    g.beginPath(); g.moveTo(0, .004 * u); g.lineTo(0, m.len * u); g.stroke();
    g.strokeStyle = '#edfef0e0'; g.lineWidth = .007 * u;
    g.beginPath(); g.moveTo(-.022 * u, .012 * u); g.lineTo(0, -.014 * u); g.lineTo(.022 * u, .012 * u); g.stroke();
    g.restore();
  }
  g.restore();
}

export function chapterBadge(g, x, y, u, icon) {
  if (icon === 'car') car(g, x, y, u * 1.8, 1);
  else if (icon === 'cat') sleepingCat(g, x, y, u * .27, 'rest', 0);
  else if (icon === 'current') {
    oval(g, '#46899d', x, y, u * .20, u * .19);
    g.strokeStyle = '#fff7d8'; g.lineWidth = u * .024; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    for (const dy of [-.055, .055]) {
      g.moveTo(x - .07 * u, y + dy * u);
      g.lineTo(x, y + (dy - .055) * u);
      g.lineTo(x + .07 * u, y + dy * u);
    }
    g.stroke();
  }
  else if (icon === 'weed' || icon === 'bridge') leaves(g, x, y, u * .15, icon, 'rest', 0);
  else if (icon === 'bend') rock(g, x, y, u * .12, 5);
  else if (icon === 'clock') {
    oval(g, '#f4bc59', x, y, u * .13, u * .13);
    g.strokeStyle = '#704638'; g.lineWidth = u * .022; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y - .075 * u); g.lineTo(x, y); g.lineTo(x + .055 * u, y + .035 * u); g.stroke();
  } else if (icon === 'rescue') duckling(g, x, y, .45, u * 5, 0, 1, { trait: 'eager' });
  else lilyPad(g, x, y, .14 * u, .25, true);
}
