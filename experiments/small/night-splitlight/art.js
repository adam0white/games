// The instrument is drawn in the same coordinate space as the optical model (360 × 400 bench units).
// The still parts (plate, dial, screws) are drawn once into a cache; light and glass are drawn each frame.
// Light is drawn from a dense set of wavelengths (drawing only; the rules use six bands), so a split beam is a
// continuous fan, and glow is wide translucent strokes added with 'lighter' (no shadowBlur in the frame loop).
import { CENTER, RAIL, receiverAngle } from './bench.js';

const LOOKS = {
  nocturne: { bg: '#080f1c', edge: '#182b3d', plate: '#101d2d', metal: '#9eafbb', ink: '#556c79', glass: '#b9edf3', well: '#0b1420' },
  oxide: { bg: '#171318', edge: '#45312e', plate: '#261e22', metal: '#c6ad96', ink: '#927b6b', glass: '#f0d8b8', well: '#1d1619' },
};
export const SPECTRUM = ['#ff4f4a', '#ffa43d', '#d6f04a', '#4fe3c2', '#4f8dff', '#b46bff'];
const RGB = SPECTRUM.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
// A colour for a fractional band, interpolated across the six.
export function bandColour(band, alpha = 1) {
  if (band < 0) return `rgba(240,250,255,${alpha})`;
  const lo = Math.max(0, Math.min(5, Math.floor(band))), hi = Math.min(5, lo + 1), w = band - lo;
  const c = RGB[lo].map((v, i) => Math.round(v * (1 - w) + RGB[hi][i] * w));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}
const CX = CENTER.x, CY = CENTER.y, R = RAIL;
const polar = (r, a) => [CX + Math.cos(a) * r, CY + Math.sin(a) * r];

function circle(ctx, x, y, r, fill, stroke, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function arc(ctx, radius, a, b, color, width) {
  ctx.beginPath(); ctx.arc(CX, CY, radius, a, b);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function screw(ctx, x, y, p) {
  circle(ctx, x, y, 3.7, '#080e15', p.ink, 0.8);
  circle(ctx, x - .4, y - .5, 2.1, p.metal);
  ctx.strokeStyle = '#384650'; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(x - 1.4, y + .9); ctx.lineTo(x + 1.2, y - 1.1); ctx.stroke();
}

// ---------- the still plate, cached ----------
const cache = { key: '', canvas: null };
function plate(ctx, p) {
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, 360, 400);
  const haze = ctx.createRadialGradient(180, 185, 16, 180, 195, 225);
  haze.addColorStop(0, p.edge); haze.addColorStop(1, p.bg);
  ctx.fillStyle = haze; ctx.fillRect(0, 0, 360, 400);
  circle(ctx, CX, CY + 3, 168, '#050a10');
  circle(ctx, CX, CY, 167, p.plate, p.edge, 2);
  circle(ctx, CX, CY, 163, null, p.metal, .65);
  circle(ctx, CX, CY, 139, p.well, p.ink, .6);
  circle(ctx, CX, CY, 130, null, p.edge, .8);
  ctx.lineCap = 'butt';
  for (let i = 0; i < 120; i++) {
    const a = i * Math.PI / 60 - Math.PI / 2;
    const major = i % 10 === 0, mid = i % 5 === 0;
    const [x1, y1] = polar(major ? 133 : mid ? 135 : 137, a);
    const [x2, y2] = polar(140, a);
    ctx.strokeStyle = major ? p.metal : p.ink; ctx.globalAlpha = major ? .75 : .5;
    ctx.lineWidth = major ? 1 : .55; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
    const [x, y] = polar(160, a); screw(ctx, x, y, p);
  }
  circle(ctx, CX, CY, 61, null, p.edge, 1);
  circle(ctx, CX, CY, 56, null, p.ink, .5);
}
function still(ctx, p, look) {
  const t = ctx.getTransform(), w = ctx.canvas.width, h = ctx.canvas.height;
  const key = look + w + 'x' + h;
  if (cache.key !== key) {
    const c = cache.canvas || (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas'));
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.setTransform(t); plate(g, p);
    cache.canvas = c; cache.key = key;
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cache.canvas, 0, 0); ctx.restore();
}

// ---------- light ----------
// Two neighbouring rays make a band of the fan when they left the same source in the same order and met the same
// faces in the same sequence; their segments are then filled as quadrilaterals.
function sameRoute(a, b) {
  if (a.src !== b.src || a.order !== b.order || a.points.length !== b.points.length || (a.angle === null) !== (b.angle === null)) return false;
  return a.route === b.route;
}
function fan(ctx, rays, strength) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < rays.length - 1; i++) {
    const a = rays[i], b = rays[i + 1];
    if (!sameRoute(a, b)) continue;
    const pa = a.points, pb = b.points;
    ctx.fillStyle = bandColour((a.band + b.band) / 2, .26 * strength);
    for (let j = 1; j < pa.length - 1; j++) {
      // the incident segment is shared: the fan starts where the routes diverge
      ctx.beginPath(); ctx.moveTo(pa[j].x, pa[j].y); ctx.lineTo(pa[j + 1].x, pa[j + 1].y); ctx.lineTo(pb[j + 1].x, pb[j + 1].y); ctx.lineTo(pb[j].x, pb[j].y); ctx.closePath(); ctx.fill();
    }
  }
}
function light(ctx, field, time, strength) {
  const rays = field.rays;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  fan(ctx, rays, strength);
  // glow then core, all added together so overlapping colours make white
  ctx.globalCompositeOperation = 'lighter';
  const n = Math.max(1, rays.length / Math.max(1, field.sources?.length || 1));
  for (const pass of [[7, .028], [2.6, .07], [.9, .34]]) {
    ctx.lineWidth = pass[0];
    for (const ray of rays) {
      if (ray.points.length < 2) continue;
      ctx.strokeStyle = bandColour(ray.band, pass[1] * strength * 25 / Math.max(12, n));
      ctx.beginPath(); ctx.moveTo(ray.points[0].x, ray.points[0].y);
      for (let i = 1; i < ray.points.length; i++) ctx.lineTo(ray.points[i].x, ray.points[i].y);
      ctx.stroke();
    }
  }
  // the end of each beam on the rail sparks a little
  for (const ray of rays) {
    if (ray.angle === null || Math.abs(ray.band - Math.round(ray.band)) > .01) continue;
    const end = ray.points[ray.points.length - 1];
    ctx.fillStyle = bandColour(ray.band, .5 * strength);
    ctx.beginPath(); ctx.arc(end.x, end.y, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- glass, mirrors and the rest ----------
function part(ctx, p, selected, look, time) {
  ctx.save();
  if (selected) {
    // a soft ring and two arrows show which part the dial turns
    ctx.strokeStyle = look === 'oxide' ? 'rgba(243,188,148,.55)' : 'rgba(232,196,147,.55)';
    ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    const r = p.vertices ? (p.r || 55) + 9 : p.len / 2 + 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (p.vertices) {
    const v = p.vertices;
    ctx.beginPath(); ctx.moveTo(v[0].x, v[0].y); for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y); ctx.closePath();
    const g = ctx.createLinearGradient(p.x - 35, p.y - 40, p.x + 35, p.y + 40);
    g.addColorStop(0, 'rgba(220,250,255,.24)'); g.addColorStop(.5, 'rgba(146,211,229,.06)'); g.addColorStop(1, 'rgba(202,241,248,.2)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(226,250,255,.85)'; ctx.lineWidth = 1.3; ctx.stroke();
    const cx = v.reduce((n, q) => n + q.x, 0) / v.length, cy = v.reduce((n, q) => n + q.y, 0) / v.length;
    ctx.beginPath(); v.forEach((q, i) => { const x = q.x * .9 + cx * .1, y = q.y * .9 + cy * .1; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath();
    ctx.strokeStyle = 'rgba(232,253,255,.3)'; ctx.lineWidth = .7; ctx.stroke();
  } else {
    const { a, b } = p;
    const nx = -(b.y - a.y) / p.len, ny = (b.x - a.x) / p.len;
    if (p.kind === 'mirror') {
      ctx.strokeStyle = '#3b4a56'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x + nx * 2.5, a.y + ny * 2.5); ctx.lineTo(b.x + nx * 2.5, b.y + ny * 2.5); ctx.stroke();
      ctx.strokeStyle = '#eef8ff'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else if (p.kind === 'filter') {
      ctx.strokeStyle = bandColour(p.band, .5); ctx.lineWidth = 6; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = bandColour(p.band, .95); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x + nx * 3, a.y + ny * 3); ctx.lineTo(b.x + nx * 3, b.y + ny * 3); ctx.moveTo(a.x - nx * 3, a.y - ny * 3); ctx.lineTo(b.x - nx * 3, b.y - ny * 3); ctx.stroke();
    } else if (p.kind === 'lens') {
      const bulge = Math.min(10, p.len * 30 / p.f / 4);
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(p.x + nx * bulge * 2, p.y + ny * bulge * 2, b.x, b.y);
      ctx.quadraticCurveTo(p.x - nx * bulge * 2, p.y - ny * bulge * 2, a.x, a.y);
      ctx.fillStyle = 'rgba(190,240,255,.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(226,250,255,.85)'; ctx.lineWidth = 1.2; ctx.stroke();
    } else if (p.kind === 'grating') {
      ctx.strokeStyle = 'rgba(210,225,235,.75)'; ctx.lineWidth = 3; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // fine rulings with a sheen that slides along them
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const f = i / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
        ctx.strokeStyle = bandColour(((f * 5 + time * .4) % 6 + 6) % 6 > 5 ? 5 : ((f * 5 + time * .4) % 6 + 6) % 6, .55);
        ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(x - nx * 3.5, y - ny * 3.5); ctx.lineTo(x + nx * 3.5, y + ny * 3.5); ctx.stroke();
      }
    }
  }
  if (p.slide) {
    // the track a sliding part runs on
    ctx.strokeStyle = 'rgba(158,175,187,.35)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(p.at[0], p.at[1]); ctx.lineTo(p.slide[0], p.slide[1]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

function lamp(ctx, src, p) {
  ctx.save(); ctx.translate(src.at[0], src.at[1]); ctx.rotate((src.dir || 0) * Math.PI / 180);
  ctx.fillStyle = '#080d13'; ctx.fillRect(-9, -7, 11, 14);
  ctx.fillStyle = p.metal; ctx.fillRect(-5, -5, 5, 10);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
  g.addColorStop(0, 'rgba(242,255,255,.9)'); g.addColorStop(1, 'rgba(242,255,255,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-12, -12, 24, 24);
  ctx.fillStyle = src.band >= 0 ? bandColour(src.band) : '#f2ffff'; ctx.fillRect(-1, -3, 2, 6); ctx.restore();
}

// ---------- receivers ----------
function bloom(ctx, x, y, r, colour, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, colour(alpha)); g.addColorStop(.35, colour(alpha * .45)); g.addColorStop(1, colour(0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function receivers(ctx, state, rules, time, p) {
  for (const target of state.targets || []) {
    const at = receiverAngle(target, state.elapsed || 0);
    const colour = a => bandColour(target.band, a);
    const half = Math.max(.016, target.width);
    ctx.lineCap = 'round';
    arc(ctx, R, at - half, at + half, '#05090e', 13);
    arc(ctx, R, at - half, at + half, p.metal, 9);
    arc(ctx, R, at - half, at + half, '#101820', 6.5);
    const on = target.fed || target.lit;
    arc(ctx, R, at - half, at + half, colour(on ? 1 : .55), target.band < 0 ? 2.4 : 4);
    if (target.swing) {
      ctx.save(); ctx.setLineDash([1.5, 3]);
      arc(ctx, R + 9, target.angle - target.swing - half, target.angle + target.swing + half, colour(.35), 1);
      ctx.restore();
    }
    if (on) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pulse = .75 + .25 * Math.sin(time * 6 + target.band);
      const [x, y] = polar(R, at);
      const size = state.won ? 30 + 8 * Math.sin(time * 3) : 16 + 12 * (state.charge || 0);
      bloom(ctx, x, y, size, colour, (state.won ? .55 : .35) * pulse);
      arc(ctx, R, at - half, at - half + 2 * half * (state.won ? 1 : Math.min(1, state.charge || 0)), colour(1), 5);
      ctx.restore();
    }
    if (target.band < 0) {
      for (let i = 0; i < 6; i++) {
        const diodeAngle = at - half * .82 + i * half * 1.64 / 5;
        const [x, y] = polar(157, diodeAngle);
        const active = rules.rays.some(r => r.band === i && r.angle !== null && Math.abs(Math.atan2(Math.sin(r.angle - at), Math.cos(r.angle - at))) <= target.width);
        circle(ctx, x, y, 3.1, active ? SPECTRUM[i] : '#111820', SPECTRUM[i], 1.2);
        if (active) circle(ctx, x, y, 1.1, '#ffffff');
      }
    } else {
      const [x, y] = polar(157, at);
      circle(ctx, x, y, 3.4, on ? colour(1) : '#111820', colour(1), 1.2);
      if (on) circle(ctx, x, y, 1.2, '#ffffff');
    }
  }
}

// Where a receiver sits on the rail now (canvas units), for the page's sparks.
export function receiverPoint(target, elapsed) { return polar(R, receiverAngle(target, elapsed || 0)); }
// The exposure (2026-11-26): sparks in each receiver's colour, a ring of light running out from it, and a flash over
// the bench like a plate taking the light. fx: { sparks: [{x, y, vx, vy, life, band}], rings: [{x, y, age, band}], flash }.
export function effects(ctx, fx) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const r of fx.rings) {
    const u = Math.min(1, r.age / .7);
    ctx.strokeStyle = bandColour(r.band, (1 - u) * .8); ctx.lineWidth = 3 * (1 - u) + .5;
    ctx.beginPath(); ctx.arc(r.x, r.y, 6 + u * 46, 0, Math.PI * 2); ctx.stroke();
  }
  for (const s of fx.sparks) {
    const a = Math.max(0, Math.min(1, s.life));
    ctx.strokeStyle = bandColour(s.band, a); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * .035, s.y - s.vy * .035); ctx.stroke();
  }
  if (fx.flash > 0) { ctx.fillStyle = `rgba(255,246,226,${fx.flash * .32})`; ctx.fillRect(0, 0, 360, 400); }
  ctx.restore();
}

// state: the bench; rules: the six-band trace (what the rules see); dense: the drawing trace; time in seconds.
export function draw(ctx, state, rules, dense, time, look = 'nocturne', selectedPart = -1) {
  const p = LOOKS[look] || LOOKS.nocturne;
  ctx.save();
  still(ctx, p, look);
  for (const src of dense.sources || []) lamp(ctx, src, p);
  const strength = state.won ? 1.25 : 1;
  light(ctx, dense, time, strength);
  dense.parts.forEach((q, i) => part(ctx, q, i === selectedPart, look, time));
  receivers(ctx, state, rules, time, p);
  ctx.restore();
}
