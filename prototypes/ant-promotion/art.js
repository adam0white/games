// Draws every creature from its data, seen from above, facing right, centred on the origin. r is the body radius, t a walk phase.
const TAU = Math.PI * 2;
const ell = (g, x, y, rx, ry, fill, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); g.fillStyle = fill; g.fill(); };
const line = (g, pts, w, stroke) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineWidth = w; g.strokeStyle = stroke; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); };
const poly = (g, pts, fill) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = fill; g.fill(); };
const eyes = (g, x, y, r) => { ell(g, x, -y, r, r, '#0b0b0b'); ell(g, x, y, r, r, '#0b0b0b'); ell(g, x + r * 0.3, -y - r * 0.2, r * 0.35, r * 0.35, '#fff'); ell(g, x + r * 0.3, y - r * 0.2, r * 0.35, r * 0.35, '#fff'); };

export function drawForm(g, F, r, t = 0, skin = null) {
  let { c, d, e } = F; const f = F.f;
  if (skin && F.role === 'ant') { c = skin.c; d = shade(skin.c, -0.4); }
  g.save();
  ({ bug, quad, bird, snake })[F.kind](g, f, r, t, c, d, e);
  if (skin && F.role === 'ant') pattern(g, skin.p, r, e);
  g.restore();
}

function pattern(g, p, r, e) {
  if (p === 'stripes') for (const x of [-1.05, -0.75, -0.45]) line(g, [x * r, -0.36 * r, x * r, 0.36 * r], r * 0.1, '#f4e6c6');
  if (p === 'spots') for (const [x, y] of [[-0.95, -0.15], [-0.6, 0.2], [-0.75, -0.3], [0, 0]]) ell(g, x * r, y * r, r * 0.11, r * 0.11, '#f4e6c6');
  if (p === 'crown') poly(g, [0.45 * r, -0.2 * r, 0.75 * r, -0.32 * r, 0.6 * r, 0, 0.75 * r, 0.32 * r, 0.45 * r, 0.2 * r], '#ffd23a');
}

function bug(g, f, r, t, c, d, e) {
  if (f.long) g.scale(1.3, 0.72);
  if (f.wide) g.scale(0.85, 1.3);
  const pairs = (f.legs || 6) / 2;
  for (let i = 0; i < pairs; i++) {
    const x = (-0.35 + 0.75 * i / (pairs - 1)) * r, sw = Math.sin(t * 6 + i * Math.PI) * 0.3 * r, lean = (i - (pairs - 1) / 2) * 0.35 * r;
    line(g, [x, 0, x + lean * 0.6, -0.7 * r, x + lean + sw, -1.2 * r], r * 0.1, d);
    line(g, [x, 0, x + lean * 0.6, 0.7 * r, x + lean - sw, 1.2 * r], r * 0.1, d);
  }
  if (f.sting) { line(g, [-1.1 * r, 0, -1.8 * r, 0.2 * r, -2.0 * r, -0.5 * r, -1.5 * r, -0.8 * r], r * 0.22, c); ell(g, -1.4 * r, -0.85 * r, r * 0.16, r * 0.16, e); }
  if (f.claws) for (const s of [-1, 1]) { line(g, [0.3 * r, s * 0.2 * r, 0.9 * r, s * 0.85 * r], r * 0.16, d); ell(g, 1.15 * r, s * 0.8 * r, r * 0.34, r * 0.22, c, s * -0.5); line(g, [1.1 * r, s * 0.8 * r, 1.45 * r, s * 0.7 * r], r * 0.05, d); }
  const fat = f.fat || f.round ? 1.2 : 1;
  ell(g, -0.75 * r, 0, 0.7 * r, 0.5 * r * fat, c);
  if (f.stripes) for (const x of [-1.1, -0.8, -0.5]) line(g, [x * r, -0.38 * r, x * r, 0.38 * r], r * 0.13, e);
  if (f.round) line(g, [-1.4 * r, 0, -0.1 * r, 0], r * 0.06, d);
  ell(g, 0, 0, 0.42 * r, 0.36 * r, d);
  ell(g, 0.58 * r, 0, 0.36 * r, 0.34 * r, c);
  if (f.wings) for (const s of [-1, 1]) { g.globalAlpha = 0.55; ell(g, -0.5 * r, s * 0.6 * r, 0.9 * r, 0.3 * r, '#eaf6ff', s * -0.5 + Math.sin(t * 30) * 0.1); g.globalAlpha = 1; }
  if (!f.bare) for (const s of [-1, 1]) line(g, [0.8 * r, s * 0.15 * r, 1.2 * r, s * 0.45 * r, 1.45 * r, s * 0.35 * r], r * 0.06, d);
  if (f.pin) for (const s of [-1, 1]) line(g, [0.85 * r, s * 0.2 * r, 1.08 * r, s * 0.16 * r, 1.12 * r, s * 0.02 * r], r * 0.08, e);
  eyes(g, 0.7 * r, 0.2 * r, r * 0.09);
}

function quad(g, f, r, t, c, d, e) {
  if (f.wide) g.scale(1, 1.22);
  if (f.liz) g.scale(1.15, 0.8);
  const wag = Math.sin(t * 5) * 0.25 * r, hx = (f.neck ? 1.75 : 0.95) * r, hr = (f.bigHead ? 0.56 : 0.42) * r;
  // tail
  if (f.tail === 'thin' || f.tail === 'tuft') { line(g, [-0.9 * r, 0, -1.4 * r, wag * 0.5, -1.9 * r, wag], r * 0.1, d); if (f.tail === 'tuft') ell(g, -1.95 * r, wag, r * 0.17, r * 0.17, e); }
  if (f.tail === 'long') line(g, [-0.9 * r, 0, -1.6 * r, wag * 0.6, -2.3 * r, wag], r * 0.2, c);
  if (f.tail === 'bushy') { ell(g, -1.5 * r, wag * 0.5, 0.65 * r, 0.3 * r, c, wag / r * 0.4); ell(g, -1.95 * r, wag * 0.8, 0.22 * r, 0.2 * r, e); }
  if (f.tail === 'stub') ell(g, -1.02 * r, 0, r * 0.2, r * 0.18, d);
  if (f.tail === 'thick') poly(g, [-0.7 * r, -0.42 * r, -2.4 * r, wag, -0.7 * r, 0.42 * r], c);
  // legs
  const reach = f.liz ? 0.95 : f.frog ? 0.8 : 0.68;
  for (const [lx, s, ph] of [[0.5, -1, 0], [0.5, 1, Math.PI], [-0.55, -1, Math.PI], [-0.55, 1, 0]]) {
    const sw = Math.sin(t * 6 + ph) * 0.22 * r, big = f.frog && lx < 0 ? 1.7 : 1;
    ell(g, lx * r + sw, s * reach * r, 0.24 * r * big, 0.17 * r * big, d, f.liz || f.frog ? s * 0.6 : 0);
  }
  if (f.arms) for (const s of [-1, 1]) ell(g, 0.75 * r, s * 0.82 * r, 0.42 * r, 0.24 * r, d, s * 0.5 + Math.sin(t * 6) * 0.15 * s);
  if (f.spikes) for (let i = 0; i < 22; i++) { const a = Math.PI * (0.38 + 1.24 * i / 21), len = (1.25 + (i % 2) * 0.25) * r; line(g, [Math.cos(a) * 0.5 * r, Math.sin(a) * 0.4 * r, Math.cos(a) * len, Math.sin(a) * len * 0.85], r * 0.07, i % 2 ? e : d); }
  ell(g, 0, 0, r, 0.66 * r, c);
  g.save(); g.beginPath(); g.ellipse(0, 0, r, 0.66 * r, 0, 0, TAU); g.clip();
  if (f.stripes) for (let x = -0.8; x <= 0.7; x += 0.3) line(g, [x * r, -0.7 * r, (x + 0.08) * r, -0.2 * r], r * 0.1, d), line(g, [x * r, 0.7 * r, (x + 0.08) * r, 0.2 * r], r * 0.1, d);
  if (f.spots) for (const [x, y] of [[-0.6, -0.3], [-0.2, 0.3], [0.2, -0.35], [0.5, 0.25], [-0.7, 0.3], [-0.1, -0.1], [0.55, -0.1]]) ell(g, x * r, y * r, r * 0.11, r * 0.1, d);
  if (f.headStripe) line(g, [-r, 0, r, 0], r * 0.22, e);
  g.restore();
  if (f.shell) { ell(g, -0.05 * r, 0, 0.88 * r, 0.74 * r, d); for (const [x, y] of [[0, 0], [-0.45, -0.3], [-0.45, 0.3], [0.4, -0.3], [0.4, 0.3]]) ell(g, x * r - 0.05 * r, y * r, r * 0.2, r * 0.17, e); }
  if (f.neck) line(g, [0.7 * r, 0, hx, 0], r * 0.3, c);
  if (f.mane) ell(g, hx - 0.12 * r, 0, hr * 1.45, hr * 1.45, f.mane === 2 ? e : d);
  if (f.bigEars) for (const s of [-1, 1]) ell(g, hx - 0.25 * r, s * 0.62 * r, 0.34 * r, 0.44 * r, d, s * 0.3);
  if (f.ears === 'long') for (const s of [-1, 1]) ell(g, hx - 0.55 * r, s * 0.24 * r, 0.5 * r, 0.13 * r, c, s * -0.25);
  if (f.ears === 'flop') for (const s of [-1, 1]) ell(g, hx - 0.1 * r, s * 0.42 * r, 0.2 * r, 0.3 * r, d, s * 0.3);
  ell(g, hx, 0, hr, hr * 0.92, c);
  if (f.snout || f.bigHead) ell(g, hx + hr * (f.liz ? 1.1 : 0.8), 0, hr * (f.liz ? 1.1 : 0.55), hr * (f.liz ? 0.55 : 0.4), f.liz ? c : e);
  if (f.ears === 'round') for (const s of [-1, 1]) ell(g, hx - 0.12 * r, s * hr * 0.92, r * 0.17, r * 0.17, d);
  if (f.ears === 'point') for (const s of [-1, 1]) poly(g, [hx - 0.3 * r, s * hr * 0.55, hx - 0.25 * r, s * (hr + 0.3 * r), hx + 0.1 * r, s * hr * 0.75], d);
  if (f.antlers) for (const s of [-1, 1]) { line(g, [hx - 0.1 * r, s * 0.2 * r, hx - 0.2 * r, s * 0.9 * r, hx + 0.3 * r, s * 1.15 * r], r * 0.08, e); line(g, [hx - 0.2 * r, s * 0.9 * r, hx - 0.6 * r, s * 1.05 * r], r * 0.08, e); line(g, [hx - 0.15 * r, s * 0.55 * r, hx + 0.25 * r, s * 0.7 * r], r * 0.07, e); }
  if (f.tusks) for (const s of [-1, 1]) line(g, [hx + hr * 0.5, s * hr * 0.6, hx + hr * 1.5, s * hr * 0.75, hx + hr * 1.8, s * hr * 0.35], r * 0.1, e);
  if (f.trunk) line(g, [hx + hr * 0.7, 0, hx + hr * 1.6, wag * 0.3, hx + hr * 2.3, wag * 0.8], r * 0.2, c);
  if (f.frog) { ell(g, hx + 0.05 * r, -hr * 0.6, r * 0.17, r * 0.17, e); ell(g, hx + 0.05 * r, hr * 0.6, r * 0.17, r * 0.17, e); }
  eyes(g, hx + hr * 0.3, hr * 0.5, r * 0.08);
}

function bird(g, f, r, t, c, d, e) {
  const flap = 1 + Math.sin(t * 5) * 0.12, span = (f.round ? 1.5 : 2.0) * r * flap;
  if (f.longTail) { line(g, [-0.6 * r, 0, -1.6 * r, Math.sin(t * 4) * 0.2 * r, -2.5 * r, Math.sin(t * 4 + 1) * 0.3 * r], r * 0.2, c); ell(g, -2.55 * r, Math.sin(t * 4 + 1) * 0.3 * r, r * 0.22, r * 0.14, e); }
  else poly(g, [-0.5 * r, -0.2 * r, -1.45 * r, -0.45 * r, -1.3 * r, 0, -1.45 * r, 0.45 * r, -0.5 * r, 0.2 * r], d);
  if (f.four) for (const [lx, s] of [[0.4, -1], [0.4, 1], [-0.5, -1], [-0.5, 1]]) ell(g, lx * r, s * 0.55 * r, 0.24 * r, 0.16 * r, d);
  for (const s of [-1, 1]) {
    if (f.membrane) {
      poly(g, [0.45 * r, 0, 0.5 * r, s * span * 0.6, 0.1 * r, s * span, -0.2 * r, s * span * 0.72, -0.55 * r, s * span * 0.8, -0.5 * r, s * span * 0.4, -0.8 * r, s * span * 0.35, -0.5 * r, 0], d);
      line(g, [0.3 * r, 0, 0.1 * r, s * span], r * 0.07, e); line(g, [0.3 * r, 0, -0.55 * r, s * span * 0.8], r * 0.05, e); line(g, [0.3 * r, 0, -0.8 * r, s * span * 0.35], r * 0.05, e);
    } else {
      poly(g, [0.45 * r, 0, 0.4 * r, s * span * 0.7, 0, s * span, -0.35 * r, s * span * 0.9, -0.6 * r, s * span * 0.6, -0.55 * r, 0], d);
      for (const k of [0.45, 0.7, 0.92]) line(g, [-0.1 * r, s * span * k, -0.55 * r, s * span * k * 0.95], r * 0.06, e);
    }
  }
  ell(g, 0, 0, (f.four ? 1 : 0.85) * r, (f.round ? 0.6 : 0.46) * r, c);
  const hr = (f.round ? 0.5 : 0.36) * r, hx = 0.85 * r;
  if (f.horns) for (const s of [-1, 1]) line(g, [hx, s * hr * 0.6, hx - 0.6 * r, s * hr * 1.5], r * 0.1, e);
  if (f.ears) for (const s of [-1, 1]) poly(g, [hx - 0.2 * r, s * hr * 0.4, hx, s * (hr + 0.3 * r), hx + 0.2 * r, s * hr * 0.5], d);
  ell(g, hx, 0, hr, hr, f.whiteHead ? e : c);
  if (f.crest) poly(g, [hx - hr * 0.3, -hr * 0.3, hx - hr * 2.4, 0, hx - hr * 0.3, hr * 0.3], e);
  if (f.membrane && !f.crest) ell(g, hx + hr * 0.8, 0, hr * 0.6, hr * 0.45, c);
  else poly(g, [hx + hr * 0.7, -hr * 0.4, hx + hr * (f.crest && f.membrane ? 2.6 : 1.7), 0, hx + hr * 0.7, hr * 0.4], '#f2b63a');
  eyes(g, hx + hr * 0.25, hr * 0.5, r * (f.round ? 0.13 : 0.08));
}

function snake(g, f, r, t, c, d, e) {
  const n = f.grub ? 5 : f.long ? 20 : 14, gap = f.grub ? 0.36 : 0.3, body = f.grub ? 0.5 : 0.42;
  const at = i => [(-i * gap + 0.5) * r, Math.sin(t * 4 - i * 0.7) * (f.grub ? 0.08 : 0.3) * r * Math.min(1, i / 3)];
  for (let i = n - 1; i >= 1; i--) { const [x, y] = at(i), w = body * r * (f.grub ? 1 : 1 - 0.65 * i / n); ell(g, x, y, w, w, (f.stripes && i % 3 === 0) || (f.grub && i % 2) ? d : c); if (f.crest && i < 9 && i % 2) ell(g, x, y, w * 0.4, w * 0.4, e); }
  const heads = f.heads || 1;
  for (let h = 0; h < heads; h++) {
    const a = (h - (heads - 1) / 2) * 0.6 + (heads > 1 ? Math.sin(t * 3 + h) * 0.1 : 0);
    g.save(); g.translate(0.3 * r, 0); g.rotate(a);
    if (heads > 1) line(g, [0, 0, 0.75 * r, 0], r * 0.36, c);
    const x = heads > 1 ? 0.95 * r : 0.3 * r;
    if (f.grub) ell(g, x, 0, 0.3 * r, 0.32 * r, e);
    else { if (Math.sin(t * 2 + h) > 0.3) line(g, [x + 0.4 * r, 0, x + 0.8 * r, 0], r * 0.06, '#e0324a'); ell(g, x, 0, 0.5 * r, 0.38 * r, c); if (f.crest) poly(g, [x - 0.1 * r, -0.2 * r, x - 0.7 * r, 0, x - 0.1 * r, 0.2 * r], e); }
    eyes(g, x + 0.15 * r, f.grub ? 0.14 * r : 0.2 * r, r * 0.08);
    g.restore();
  }
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), ch = s => { const v = n >> s & 255; return Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); };
  return '#' + (ch(16) << 16 | ch(8) << 8 | ch(0)).toString(16).padStart(6, '0');
}
