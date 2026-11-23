// Lantern: how the boats and flames look. Drawing only; nothing here changes the run.
// A boat is drawn about its lantern at (0, 0) with the bow up the screen; u is the river's width in pixels.
// A flame is a small particle simulation that trails behind the boat, leans away from a turn and shrinks as the light fades.

const mix = (hex, f) => { const n = parseInt(hex.slice(1), 16); return `rgb(${[n >> 16, n >> 8 & 255, n & 255].map(v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))})`; };
// Light falls from the left: a hull is brightest left of centre and darkest on its right flank.
function lit(g, col, w) { const q = g.createLinearGradient(-w, 0, w, 0); q.addColorStop(0, mix(col, -0.2)); q.addColorStop(0.35, mix(col, 0.22)); q.addColorStop(1, mix(col, -0.5)); return q; }
function pointed(g, u, bow, wide, stern, half) { g.beginPath(); g.moveTo(0, -bow * u); g.quadraticCurveTo(wide * u, -0.008 * u, half * u, stern * u); g.lineTo(-half * u, stern * u); g.quadraticCurveTo(-wide * u, -0.008 * u, 0, -bow * u); g.closePath(); }
function leaf(g, u, bow, wide, stern) { g.beginPath(); g.moveTo(0, -bow * u); g.quadraticCurveTo(wide * u, 0, 0, stern * u); g.quadraticCurveTo(-wide * u, 0, 0, -bow * u); g.closePath(); }
const bar = (g, u, y, w, h) => g.fillRect(-w * u, y * u, 2 * w * u, h * u);

const HULL = {
  // A rowboat: planked hull, a dark well, two thwarts.
  oak(g, u, col) {
    pointed(g, u, 0.052, 0.031, 0.036, 0.017); g.fillStyle = lit(g, col, 0.024 * u); g.fill(); g.strokeStyle = mix(col, -0.6); g.lineWidth = 0.0025 * u; g.stroke();
    g.save(); g.scale(0.7, 0.8); pointed(g, u, 0.052, 0.031, 0.036, 0.017); g.fillStyle = mix(col, -0.55); g.fill(); g.restore();
    g.fillStyle = mix(col, 0.3); bar(g, u, -0.016, 0.0135, 0.005); bar(g, u, 0.014, 0.0125, 0.005);
  },
  // A canoe: long and slim, pointed at both ends, a pale stripe along the rim.
  red(g, u, col) {
    leaf(g, u, 0.06, 0.05, 0.046); g.fillStyle = lit(g, col, 0.022 * u); g.fill(); g.strokeStyle = '#f3e6c8'; g.lineWidth = 0.003 * u; g.stroke();
    g.save(); g.scale(0.62, 0.78); leaf(g, u, 0.06, 0.05, 0.046); g.fillStyle = mix(col, -0.6); g.fill(); g.restore();
    g.fillStyle = '#f3e6c8'; bar(g, u, -0.02, 0.009, 0.004); bar(g, u, 0.018, 0.009, 0.004);
  },
  // A raft: five logs of uneven length, lashed with two ropes.
  birch(g, u, col) {
    [-2, -1, 0, 1, 2].forEach((i, n) => {
      const x = i * 0.0092 * u, top = (-0.044 + [0.006, 0, 0.004, 0.001, 0.007][n]) * u, len = (0.078 - [0.008, 0, 0.005, 0.002, 0.01][n]) * u, w = 0.0086 * u;
      const q = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0); q.addColorStop(0, mix(col, -0.35)); q.addColorStop(0.4, mix(col, 0.25)); q.addColorStop(1, mix(col, -0.5));
      g.fillStyle = q; g.beginPath(); if (g.roundRect) g.roundRect(x - w / 2, top, w, len, w / 2); else g.rect(x - w / 2, top, w, len); g.fill();
      g.fillStyle = '#3a3128'; for (const k of [0.25, 0.55, 0.8]) g.fillRect(x - w / 2, top + len * k + i * 2, w * 0.6, 0.0016 * u); // birch bark marks
    });
    g.fillStyle = '#8a6a3c'; bar(g, u, -0.026, 0.024, 0.0035); bar(g, u, 0.018, 0.024, 0.0035);
  },
  // A steel barge: blunt bow, rivets, a cabin at the stern, a warning stripe at the bow.
  iron(g, u, col) {
    g.beginPath(); for (const [x, y] of [[-0.011, -0.05], [0.011, -0.05], [0.023, -0.03], [0.023, 0.037], [-0.023, 0.037], [-0.023, -0.03]]) g.lineTo(x * u, y * u); g.closePath();
    g.fillStyle = lit(g, col, 0.023 * u); g.fill(); g.strokeStyle = mix(col, -0.65); g.lineWidth = 0.003 * u; g.stroke();
    g.fillStyle = mix(col, -0.45); g.fillRect(-0.016 * u, -0.028 * u, 0.032 * u, 0.034 * u); // the hold
    g.fillStyle = '#e8b93a'; g.beginPath(); g.moveTo(-0.011 * u, -0.046 * u); g.lineTo(0.011 * u, -0.046 * u); g.lineTo(0.017 * u, -0.036 * u); g.lineTo(-0.017 * u, -0.036 * u); g.fill();
    g.fillStyle = mix(col, 0.35); g.fillRect(-0.015 * u, 0.012 * u, 0.03 * u, 0.02 * u); g.fillStyle = '#ffd98a'; g.fillRect(-0.011 * u, 0.015 * u, 0.008 * u, 0.006 * u); g.fillRect(0.003 * u, 0.015 * u, 0.008 * u, 0.006 * u); // cabin and its lit windows
    g.fillStyle = mix(col, 0.5); for (let y = -0.026; y < 0.036; y += 0.0085) for (const x of [-0.0205, 0.0205]) { g.beginPath(); g.arc(x * u, y * u, 0.0013 * u, 0, 7); g.fill(); }
  },
  // A dragon boat: scaled hull, horned head at the bow, a fin at the stern.
  jade(g, u, col, t) {
    g.fillStyle = '#e0b040'; g.beginPath(); g.moveTo(0, 0.04 * u); g.lineTo(0.012 * u, 0.058 * u + Math.sin(t * 5) * 0.002 * u); g.lineTo(0, 0.05 * u); g.lineTo(-0.012 * u, 0.058 * u - Math.sin(t * 5) * 0.002 * u); g.fill(); // tail
    leaf(g, u, 0.05, 0.052, 0.046); g.fillStyle = lit(g, col, 0.024 * u); g.fill(); g.strokeStyle = '#e0b040'; g.lineWidth = 0.0028 * u; g.stroke();
    g.save(); g.clip(); g.strokeStyle = mix(col, -0.45); g.lineWidth = 0.0016 * u;
    for (let r = 0; r < 9; r++) for (let c = -3; c <= 3; c++) { g.beginPath(); g.arc((c + (r % 2) / 2) * 0.009 * u, (-0.04 + r * 0.0095) * u, 0.0048 * u, 0.2, 2.94); g.stroke(); }
    g.restore();
    g.fillStyle = mix(col, 0.15); g.beginPath(); g.ellipse(0, -0.05 * u, 0.0105 * u, 0.013 * u, 0, 0, 7); g.fill(); g.strokeStyle = '#e0b040'; g.lineWidth = 0.002 * u; g.stroke(); // head
    g.strokeStyle = '#f6e3a0'; g.lineWidth = 0.0024 * u; g.lineCap = 'round'; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 0.006 * u, -0.056 * u); g.quadraticCurveTo(d * 0.016 * u, -0.062 * u, d * 0.014 * u, -0.072 * u); g.stroke(); } g.lineCap = 'butt';
    g.fillStyle = '#ffdf5a'; for (const d of [-1, 1]) { g.beginPath(); g.arc(d * 0.005 * u, -0.052 * u, 0.0022 * u, 0, 7); g.fill(); }
  },
  // A royal barge: gilded hull, a red cushion, a scroll at the stern, glints that come and go.
  gold(g, u, col, t) {
    g.strokeStyle = mix(col, 0.2); g.lineWidth = 0.004 * u; g.beginPath(); g.arc(0, 0.043 * u, 0.007 * u, -0.6, 4.4); g.stroke();
    pointed(g, u, 0.056, 0.034, 0.037, 0.019); const q = g.createLinearGradient(-0.026 * u, -0.05 * u, 0.026 * u, 0.04 * u); q.addColorStop(0, '#fff3b8'); q.addColorStop(0.3, col); q.addColorStop(0.62, mix(col, -0.45)); q.addColorStop(1, mix(col, 0.1));
    g.fillStyle = q; g.fill(); g.strokeStyle = '#7a5a12'; g.lineWidth = 0.0022 * u; g.stroke();
    g.save(); g.scale(0.66, 0.74); pointed(g, u, 0.052, 0.031, 0.036, 0.017); g.fillStyle = '#8f1f2a'; g.fill(); g.restore();
    g.fillStyle = '#c23a45'; g.beginPath(); g.ellipse(0, 0.012 * u, 0.009 * u, 0.007 * u, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const a = Math.max(0, Math.sin(t * 2.2 + i * 2.1)) ** 6, x = [-0.014, 0.012, -0.004][i] * u, y = [-0.02, 0.006, -0.042][i] * u, r = 0.006 * u * a; if (a > 0.02) { g.globalAlpha = a; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.2, y - r * 0.2); g.lineTo(x + r, y); g.lineTo(x + r * 0.2, y + r * 0.2); g.lineTo(x, y + r); g.lineTo(x - r * 0.2, y + r * 0.2); g.lineTo(x - r, y); g.lineTo(x - r * 0.2, y - r * 0.2); g.fill(); g.globalAlpha = 1; } }
  },
};
// Draws boat `id` at the origin. t is seconds, for the few parts that move.
export function hull(g, id, u, col, t = 0) { (HULL[id] ?? HULL.oak)(g, u, col, t); }
// The wake behind a moving boat: two lines of foam that open and fade.
export function wake(g, u, t) {
  g.strokeStyle = '#dff1ff'; g.lineWidth = 0.003 * u; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const k = (t * 1.3 + i / 3) % 1, y = (0.04 + 0.1 * k) * u, w = (0.012 + 0.03 * k) * u; g.globalAlpha = 0.3 * (1 - k); for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * w, y); g.lineTo(d * (w + 0.008 * u), y + 0.016 * u); g.stroke(); } }
  g.globalAlpha = 1; g.lineCap = 'butt';
}

// rate: particles a second. life: seconds. speed: drift astern. spread and turb: sideways wander. size: radius. Lengths are in river widths.
const FLAME = {
  amber: { rate: 70, life: 0.42, speed: 0.13, spread: 0.035, turb: 0.03, freq: 9, size: 0.017 }, // a candle
  bluef: { rate: 90, life: 0.26, speed: 0.24, spread: 0.008, turb: 0.005, freq: 20, size: 0.011, core: '225,250,255' }, // a tight gas jet
  green: { rate: 40, life: 0.95, speed: 0.055, spread: 0.05, turb: 0.075, freq: 4.5, size: 0.015 }, // marsh fire: slow and wandering
  rose: { rate: 55, life: 0.36, speed: 0.11, spread: 0.03, turb: 0.03, freq: 9, size: 0.013, sparks: 26 }, // a sparkler
  white: { rate: 34, life: 0.5, speed: 0.08, spread: 0.02, turb: 0.02, freq: 7, size: 0.014, star: true }, // a small star
  violetf: { rate: 80, life: 0.55, speed: 0.13, spread: 0, turb: 0, freq: 0, size: 0.011, helix: 0.015 }, // two flames wound round each other
};
export function flame() { return { p: [], acc: 0, sp: 0, n: 0 }; }
export function burn(f, id, dt, lean, light) {
  const k = FLAME[id] ?? FLAME.amber, live = 0.45 + 0.55 * light, R = Math.random;
  f.acc += dt * k.rate;
  for (; f.acc >= 1; f.acc--) f.p.push({ x: (R() - 0.5) * 0.006, y: 0, vx: (R() - 0.5) * k.spread - lean * 0.09, vy: k.speed * (0.7 + 0.6 * R()), age: 0, d: k.life * (0.7 + 0.6 * R()) * live, ph: R() * 6.28, s: f.n++ % 2, r: k.size });
  if (k.sparks) for (f.sp += dt * k.sparks; f.sp >= 1; f.sp--) { const a = R() * 6.28, v = 0.12 + 0.2 * R(); f.p.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 0.05, age: 0, d: 0.22 + 0.2 * R(), ph: 0, s: 0, r: 0, spark: true }); }
  for (const p of f.p) {
    p.age += dt; p.y += p.vy * dt;
    if (k.helix && !p.spark) p.x = k.helix * Math.sin(p.age * 13 + p.s * Math.PI) * (1 - p.age / p.d) - lean * 0.09 * p.age;
    else p.x += (p.vx + k.turb * Math.sin(p.ph + p.age * k.freq)) * dt;
  }
  f.p = f.p.filter(p => p.age < p.d);
}
// Call with the canvas in 'lighter' mode. rgb is the flame's colour as "r,g,b".
export function glow(g, f, id, x, y, u, rgb, light, t = 0) {
  const k = FLAME[id] ?? FLAME.amber, core = k.core ?? '255,246,220';
  for (const p of f.p) {
    const life = 1 - p.age / p.d, px = x + p.x * u, py = y + p.y * u;
    if (p.spark) { g.fillStyle = `rgba(255,240,225,${life})`; const z = 0.004 * u; g.fillRect(px - z / 2, py - z / 2, z, z); continue; }
    const r = p.r * (0.35 + 0.65 * life) * (0.7 + 0.3 * light) * u, q = g.createRadialGradient(px, py, 0, px, py, r);
    q.addColorStop(0, `rgba(${life > 0.6 ? core : rgb},${0.6 * life})`); q.addColorStop(0.5, `rgba(${rgb},${0.34 * life})`); q.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = q; g.fillRect(px - r, py - r, 2 * r, 2 * r);
  }
  if (k.star) { // four long points that turn slowly and twinkle
    const r = (0.028 + 0.008 * Math.sin(t * 7)) * (0.6 + 0.4 * light) * u; g.save(); g.translate(x, y); g.rotate(t * 0.6); g.fillStyle = `rgba(${rgb},.85)`;
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = i % 2 ? r * 0.16 : r; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.fill(); g.restore();
  }
}

// The mark of each power, in white line on its colour: used in the water and on the shop's buttons. t is seconds.
export const TINT = { boost: '255,215,90', slow: '190,140,255', size: '90,230,205', magnet: '255,140,190', flare: '235,240,255' };
export function mark(g, kind, x, y, u, w, t = 0) {
  g.strokeStyle = '#fff'; g.lineWidth = w; g.lineJoin = g.lineCap = 'round'; g.beginPath();
  if (kind === 'boost') { const b = (t * 2.5 % 1) * u * 0.5; for (const o of [-0.5, 0.6]) { g.moveTo(x - u, y + o * u + u * 0.5 - b); g.lineTo(x, y + o * u - u * 0.5 - b); g.lineTo(x + u, y + o * u + u * 0.5 - b); } }
  else if (kind === 'slow') { const a = t * 1.1; g.arc(x, y, u * 1.1, 0, 7); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * u * 0.8, y - Math.cos(a) * u * 0.8); g.moveTo(x, y); g.lineTo(x + u * 0.5, y); }
  else if (kind === 'size') { const k = 0.75 + 0.35 * Math.sin(t * 3.8); g.arc(x, y, u * 1.2 * k, 0, 7); g.moveTo(x + u * 0.4 / k, y); g.arc(x, y, u * 0.4 / k, 0, 7); }
  else if (kind === 'magnet') { g.moveTo(x - u * 0.8, y - u); g.lineTo(x - u * 0.8, y + u * 0.2); g.arc(x, y + u * 0.2, u * 0.8, Math.PI, 0, true); g.lineTo(x + u * 0.8, y - u); const p = (t * 2 % 1) * u * 0.6; g.moveTo(x - u * 0.3, y - u * 1.3 - p); g.lineTo(x - u * 0.3, y - u * 1.6 - p); g.moveTo(x + u * 0.3, y - u * 1.3 - p); g.lineTo(x + u * 0.3, y - u * 1.6 - p); }
  else { g.arc(x, y, u * 0.5, 0, 7); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * 0.8; g.moveTo(x + Math.cos(a) * u * 0.85, y + Math.sin(a) * u * 0.85); g.lineTo(x + Math.cos(a) * u * 1.3, y + Math.sin(a) * u * 1.3); } }
  g.stroke(); g.lineJoin = 'miter'; g.lineCap = 'butt';
}
