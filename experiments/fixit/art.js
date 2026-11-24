// Fix-It Stall: every picture, drawn in code. Objects are drawn in object-local units (the bench box is 100 x 100);
// people, the stall and the cat in CSS pixels. Nothing here changes game state.
import { ghost } from './moves.js';
import { SEAM_POINTS, seamAt, OIL_OPEN, THREAD_SIDE, THREAD_UP } from './sim.js';
import { crankPoint, SCALE_BAND, TRACE_OFFSET, WIND_STOPS } from './repairs.js';

export const C = {
  ink: '#3a2216', cream: '#fff1d6', paper: '#fbe6c2',
  copper: '#c8743a', copperLt: '#eea566', copperDk: '#8a4a22',
  teal: '#2f8f8a', tealLt: '#62c6b8', tealDk: '#1d5e5b',
  brass: '#d9a93e', brassLt: '#f6d77e', brassDk: '#9c7420',
  steel: '#9aa3a8', steelLt: '#dfe7ea', steelDk: '#5d666b',
  wood: '#9a5c35', woodLt: '#c07e4f', woodDk: '#6a3a1f',
  red: '#d9493b', green: '#5fae5a', amber: '#f0a830', glow: '#fff3a8',
};
const TAU = Math.PI * 2;
const rad = d => d * Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function shape(g, fill, line = 2.2, ink = C.ink) {
  g.fillStyle = fill; g.fill();
  if (line) { g.lineWidth = line; g.strokeStyle = ink; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
}
function circle(g, x, y, r, fill, line = 2.2) { g.beginPath(); g.arc(x, y, r, 0, TAU); shape(g, fill, line); }
function rrect(g, x, y, w, h, r, fill, line = 2.2) { g.beginPath(); g.roundRect(x, y, w, h, r); shape(g, fill, line); }
function shine(g, x, y, r, a = 0.6) { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.ellipse(x, y, r, r * 0.55, -0.6, 0, TAU); g.fill(); }
function star(g, x, y, r, fill, a = 1) {
  g.save(); g.globalAlpha *= a; g.fillStyle = fill; g.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.35 : r, an = i * Math.PI / 4; g.lineTo(x + rr * Math.cos(an), y + rr * Math.sin(an)); }
  g.closePath(); g.fill(); g.restore();
}
function strokePath(g, points, color, width) {
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(...points[0]);
  for (const p of points.slice(1)) g.lineTo(...p);
  g.stroke();
}
function arrow(g, x, y, a, size, fill) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.moveTo(size, 0); g.lineTo(-size, -size); g.lineTo(-size, size); g.closePath();
  shape(g, fill, 0); g.restore();
}

// ---------- shared repair parts
function screwHead(g, x, y, p, slot, big = 1) {
  const h = (1 - p) * 8 * big, R = 8.5 * big;
  circle(g, x, y, R + 6 * big, C.brass); shine(g, x - 6 * big, y - 6 * big, 4 * big, 0.45);
  for (const a of [45, 135, 225, 315]) circle(g, x + Math.cos(rad(a)) * (R + 2.5 * big), y + Math.sin(rad(a)) * (R + 2.5 * big), 1.3 * big, C.brassDk, 0);
  if (h > 0.3) { // the screw stands proud of the plate: its thread shows
    g.beginPath(); g.rect(x - 3.4 * big, y - h, 6.8 * big, h); shape(g, C.steel, 1.6);
    g.strokeStyle = C.steelDk; g.lineWidth = 1; g.beginPath();
    for (let k = 1.5; k < h; k += 2.2) { g.moveTo(x - 3.4 * big, y - k + 1); g.lineTo(x + 3.4 * big, y - k); }
    g.stroke();
  }
  circle(g, x, y - h, R, p >= 1 ? C.steelLt : C.steel); shine(g, x - 3 * big, y - h - 3 * big, 2.6 * big, 0.7);
  g.save(); g.translate(x, y - h); g.rotate(rad(slot)); g.strokeStyle = C.ink; g.lineWidth = 2.6 * big; g.beginPath(); g.moveTo(-R * 0.75, 0); g.lineTo(R * 0.75, 0); g.stroke(); g.restore();
}
function dents(g, r, t) {
  for (const d of r.dents) {
    if (d.out) { star(g, d.x, d.y, 6, '#fff', 0.5 + 0.3 * Math.sin(t * 6 + d.x)); continue; }
    g.fillStyle = 'rgba(40,18,8,.45)'; g.beginPath(); g.ellipse(d.x, d.y, 10.5, 8.5, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(40,18,8,.7)'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(d.x, d.y, 10.5, 8.5, 0, rad(200), rad(340)); g.stroke();
    g.strokeStyle = 'rgba(255,230,190,.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(d.x, d.y + 1, 8, 6, 0, rad(20), rad(160)); g.stroke();
  }
}

// ---------- the objects. Each draws its own repair's progress; w is the "it works" moment, 0..1.
const OBJ = {
  // A brass bell hanging from a wooden bracket; the loose screw holds it on.
  screw(g, r, t, w) {
    const swing = w ? Math.sin(w * TAU * 2.5) * 0.22 * (1 - w) : 0;
    rrect(g, 14, 4, 72, 10, 4, C.wood); rrect(g, 46, 12, 8, 10, 2, C.woodDk);
    g.save(); g.translate(50, 18); g.rotate(swing); g.translate(-50, -18);
    circle(g, 50, 92, 6, C.steelDk);
    g.beginPath(); g.moveTo(50, 18); g.bezierCurveTo(26, 18, 26, 44, 22, 70); g.quadraticCurveTo(14, 84, 10, 88); g.lineTo(90, 88); g.quadraticCurveTo(86, 84, 78, 70); g.bezierCurveTo(74, 44, 74, 18, 50, 18); g.closePath();
    shape(g, C.brass); g.fillStyle = 'rgba(255,240,180,.4)'; g.beginPath(); g.ellipse(36, 48, 6, 20, 0.15, 0, TAU); g.fill();
    rrect(g, 10, 84, 80, 7, 3.5, C.brassDk);
    if (r.kind === 'screw') screwHead(g, r.cx, r.cy, r.p, r.slot);
    g.restore();
    if (w) for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,240,170,${1 - w})`; g.lineWidth = 2.5; g.beginPath(); g.arc(50, 50, 46 + i * 7 + w * 16, rad(-40), rad(40)); g.stroke(); g.beginPath(); g.arc(50, 50, 46 + i * 7 + w * 16, rad(140), rad(220)); g.stroke(); }
  },
  // A music box with a brass drum; one bent pin sticks out of the drum.
  pin(g, r, t, w) {
    g.beginPath(); g.moveTo(14, 58); g.lineTo(22, 18); g.lineTo(78, 18); g.lineTo(86, 58); g.closePath(); shape(g, C.woodLt);
    g.beginPath(); g.moveTo(20, 54); g.lineTo(26, 24); g.lineTo(74, 24); g.lineTo(80, 54); g.closePath(); shape(g, '#7a2f3a', 1.4); // the lid's velvet
    rrect(g, 10, 56, 80, 36, 5, C.wood); g.strokeStyle = C.woodDk; g.lineWidth = 1.4; g.beginPath(); g.moveTo(14, 74); g.lineTo(86, 74); g.stroke();
    circle(g, 50, 83, 3, C.brassDk, 1.2);
    // the drum, lying along the box
    const spin = w ? w * 40 : 0;
    rrect(g, 20, 58, 60, 12, 6, C.brass); shine(g, 30, 61, 5, 0.5);
    g.fillStyle = C.brassDk; for (let i = 0; i < 12; i++) { const x = 23 + ((i * 7 + spin) % 56); g.beginPath(); g.arc(x, 64 + (i % 3) - 1, 1, 0, TAU); g.fill(); }
    if (r.kind === 'pin') {
      if (r.done) { // the new straight pin, in place
        g.strokeStyle = C.steelLt; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(50, 62); g.lineTo(50, 50); g.stroke();
        star(g, 50, 50, 6, '#fff', w ? 1 - w : 0.8);
      } else {
        const up = r.pull * 30;
        g.strokeStyle = C.ink; g.lineWidth = 6.5; g.lineCap = 'round'; g.lineJoin = 'round';
        const path = () => { g.beginPath(); g.moveTo(50, 64 - up); g.lineTo(50, 44 - up); g.lineTo(54, 36 - up); g.lineTo(62, 30 - up); };
        path(); g.stroke(); g.strokeStyle = C.steel; g.lineWidth = 3.6; path(); g.stroke();
        circle(g, 62, 30 - up, 3.6, C.steelLt, 1.6);
        if (up > 2) { g.strokeStyle = 'rgba(58,34,22,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(44, 68); g.lineTo(56, 68); g.stroke(); }
      }
    }
    if (w) for (let i = 0; i < 3; i++) note(g, 30 + i * 20, 40 - w * 30 - i * 6, 1 - w);
  },
  // A copper kettle with dents.
  dent(g, r, t, w) {
    g.strokeStyle = C.ink; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.arc(50, 34, 24, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.strokeStyle = C.woodLt; g.lineWidth = 4; g.stroke();
    g.beginPath(); g.moveTo(18, 62); g.quadraticCurveTo(6, 52, 4, 36); g.lineTo(10, 34); g.quadraticCurveTo(14, 50, 24, 56); g.closePath(); shape(g, C.copper);
    g.beginPath(); g.ellipse(50, 62, 39, 30, 0, 0, TAU); shape(g, C.copper);
    g.fillStyle = 'rgba(255,210,150,.35)'; g.beginPath(); g.ellipse(34, 50, 10, 16, 0.4, 0, TAU); g.fill();
    rrect(g, 18, 86, 64, 7, 3.5, C.copperDk);
    g.beginPath(); g.ellipse(50, 34, 18, 6, 0, 0, TAU); shape(g, C.copperLt); circle(g, 50, 28, 4, C.woodDk, 1.6);
    if (r.kind === 'dent') dents(g, r, t);
    if (w) { for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(255,255,255,${0.7 * (1 - w)})`; g.beginPath(); g.arc(4 - i * 4 - w * 10, 30 - i * 7 - w * 16, 4 + i * 2.5, 0, TAU); g.fill(); } }
  },
  // A cart wheel on a fork. It wobbles until it is spun hard enough to seat.
  wheel(g, r, t, w) {
    g.strokeStyle = C.ink; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(26, 4); g.lineTo(50, 54); g.lineTo(74, 4); g.stroke();
    g.strokeStyle = C.teal; g.lineWidth = 4; g.stroke();
    const wob = 1 - r.seat, ph = rad(r.ang);
    g.save(); g.translate(50 + Math.sin(ph) * 5 * wob, 54); g.scale(1 - 0.28 * wob * (0.5 + 0.5 * Math.sin(ph * 2)), 1); g.rotate(ph);
    circle(g, 0, 0, 34, C.steelDk, 2.4); circle(g, 0, 0, 29, C.wood, 2);
    circle(g, 0, 0, 22, '#f3d3a0', 1.6);
    g.strokeStyle = C.woodDk; g.lineWidth = 4.5; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); g.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); }
    g.stroke();
    circle(g, 0, 0, 7, C.brass, 2); circle(g, 0, 0, 2.4, C.ink, 0);
    g.restore();
    if (r.w > 200 || w) { g.strokeStyle = `rgba(255,255,255,${w ? 1 - w : Math.min(0.6, (r.w - 200) / 600)})`; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = ph * 0.3 + i * 2.1; g.beginPath(); g.arc(50, 54, 38, a, a + 0.9); g.stroke(); } }
  },
  // A table lamp; the dirty contacts in its base stop it lighting.
  rub(g, r, t, w) {
    const lit = r.done ? 1 : r.p > 0.6 && Math.sin(t * 40) > 0.6 ? 0.5 : 0;
    if (lit) { const gl = g.createRadialGradient(50, 44, 2, 50, 44, 60); gl.addColorStop(0, `rgba(255,236,150,${0.85 * lit})`); gl.addColorStop(1, 'rgba(255,236,150,0)'); g.fillStyle = gl; g.fillRect(-10, -10, 120, 120); }
    rrect(g, 46, 40, 8, 26, 3, C.brass);
    circle(g, 50, 46, 9, lit ? C.glow : '#e8e2cf', 2);
    g.beginPath(); g.moveTo(30, 8); g.lineTo(70, 8); g.lineTo(84, 40); g.lineTo(16, 40); g.closePath(); shape(g, C.teal);
    g.strokeStyle = C.tealLt; g.lineWidth = 2; g.beginPath(); g.moveTo(34, 14); g.lineTo(24, 36); g.stroke();
    g.beginPath(); g.ellipse(50, 90, 34, 7, 0, 0, TAU); shape(g, C.copperDk);
    rrect(g, 18, 62, 64, 26, 10, C.copper);
    // the contacts: two brass bars, dull brown until rubbed clean
    for (const x of [30, 56]) { rrect(g, x, 68, 14, 12, 3, C.brassLt, 1.6); }
    const dirt = 1 - (r.kind === 'rub' ? r.p : 1);
    if (dirt > 0) {
      g.fillStyle = `rgba(74,52,30,${0.85 * dirt})`;
      for (const [x, y, s] of [[33, 72, 5], [39, 76, 4], [59, 71, 5], [66, 76, 4], [37, 70, 3], [63, 78, 3], [44, 74, 3], [58, 75, 3]]) { g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); }
    } else star(g, 64, 70, 5, '#fff', 0.8);
    if (w) { g.strokeStyle = `rgba(255,236,150,${1 - w})`; g.lineWidth = 2.5; for (let i = 0; i < 8; i++) { const a = rad(200 + i * 20); g.beginPath(); g.moveTo(50 + Math.cos(a) * 14, 46 - Math.sin(a) * -14); g.lineTo(50 + Math.cos(a) * (22 + w * 12), 46 + Math.sin(a) * (22 + w * 12)); g.stroke(); } }
  },
  // A round clock. Push the minute hand on to the star.
  clock(g, r, t, w) {
    circle(g, 50, 50, 45, C.copper, 2.4); shine(g, 26, 22, 8, 0.35);
    circle(g, 50, 50, 38, C.cream, 2);
    g.strokeStyle = C.ink; g.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = rad(i * 30); g.lineWidth = i % 3 ? 1.6 : 3; g.beginPath(); g.moveTo(50 + Math.cos(a) * 33, 50 + Math.sin(a) * 33); g.lineTo(50 + Math.cos(a) * (i % 3 ? 30 : 27), 50 + Math.sin(a) * (i % 3 ? 30 : 27)); g.stroke(); }
    const target = r.kind === 'clock' ? r.target : -90, hand = r.kind === 'clock' ? r.hand + (w ? w * 30 : 0) : -90;
    if (r.kind === 'clock' && !r.done) { // the star where the hand must go, and the path still to travel
      g.strokeStyle = 'rgba(47,143,138,.35)'; g.lineWidth = 7; g.beginPath(); g.arc(50, 50, 22, rad(hand), rad(target)); g.stroke();
      const sx = 50 + Math.cos(rad(target)) * 33, sy = 50 + Math.sin(rad(target)) * 33;
      star(g, sx, sy, 8 + Math.sin(t * 6), C.teal); star(g, sx, sy, 4, '#fff');
    }
    const hour = (r.kind === 'clock' ? r.a0 : -90) / 12 + 150 + (hand - (r.kind === 'clock' ? r.a0 : -90)) / 12;
    g.strokeStyle = C.ink; g.lineWidth = 5; g.beginPath(); g.moveTo(50, 50); g.lineTo(50 + Math.cos(rad(hour)) * 17, 50 + Math.sin(rad(hour)) * 17); g.stroke();
    g.strokeStyle = C.copperDk; g.lineWidth = 3.4; g.beginPath(); g.moveTo(50, 50); g.lineTo(50 + Math.cos(rad(hand)) * 30, 50 + Math.sin(rad(hand)) * 30); g.stroke();
    circle(g, 50 + Math.cos(rad(hand)) * 30, 50 + Math.sin(rad(hand)) * 30, 3, C.copperDk, 1.4);
    circle(g, 50, 50, 4, C.brass, 1.6);
    if (w || r.done) { const sec = rad(-90 + Math.floor(t * 2) * 30); g.strokeStyle = C.red; g.lineWidth = 1.4; g.beginPath(); g.moveTo(50, 50); g.lineTo(50 + Math.cos(sec) * 32, 50 + Math.sin(sec) * 32); g.stroke(); }
  },
  // A bike's two gears; the chain has slipped off the front one.
  chain(g, r, t, w) {
    g.strokeStyle = C.ink; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(30, 66); g.lineTo(68, 34); g.moveTo(68, 34); g.lineTo(80, 4); g.moveTo(30, 66); g.lineTo(14, 30); g.stroke();
    g.strokeStyle = C.teal; g.lineWidth = 6; g.stroke();
    const spin = w ? w * TAU : 0, hooked = r.kind !== 'chain' || r.hooked;
    gear(g, 30, 66, 12, 10, spin * 1.5);
    gear(g, 68, 34, 18, 16, spin);
    // the pedal crank
    g.save(); g.translate(68, 34); g.rotate(spin + 0.6); g.strokeStyle = C.ink; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 22); g.stroke(); rrect(g, -7, 20, 14, 5, 2, C.steelDk, 1.6); g.restore();
    circle(g, 68, 34, 4, C.brass, 1.6); circle(g, 30, 66, 3, C.brass, 1.4);
    g.lineWidth = 3.4; g.strokeStyle = '#2b2b2b'; g.setLineDash([3, 2.2]); g.lineDashOffset = -spin * 30;
    if (hooked) {
      const dx = 68 - 30, dy = 34 - 66, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      g.beginPath(); g.moveTo(30 + nx * 13, 66 + ny * 13); g.lineTo(68 + nx * 19, 34 + ny * 19); g.moveTo(30 - nx * 13, 66 - ny * 13); g.lineTo(68 - nx * 19, 34 - ny * 19); g.stroke();
      g.setLineDash([]);
    } else {
      const lx = r.lx, ly = r.ly;
      g.beginPath(); g.moveTo(30, 53); g.quadraticCurveTo((30 + lx) / 2 - 8, (53 + ly) / 2 - 4, lx, ly); g.quadraticCurveTo((30 + lx) / 2 + 8, (79 + ly) / 2 + 4, 30, 79); g.stroke();
      g.setLineDash([]);
      circle(g, lx, ly, 6, C.steel, 2); circle(g, lx, ly, 2.4, C.ink, 0);
      g.strokeStyle = `rgba(47,143,138,${0.45 + 0.3 * Math.sin(t * 6)})`; g.lineWidth = 3; g.setLineDash([4, 4]); g.beginPath(); g.arc(68, 34, 24, 0, TAU); g.stroke(); g.setLineDash([]);
    }
    if (w) { g.fillStyle = `rgba(255,255,255,${1 - w})`; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('ding', 84, 16 - w * 10); }
  },
  // A teal vase broken in two. Push the halves together, hold while the glue sets.
  glue(g, r, t, w) {
    const joined = r.kind !== 'glue' || r.joined, set = r.kind === 'glue' ? r.set : 1;
    const zig = [[50, 12], [47, 26], [53, 38], [46, 50], [54, 62], [47, 74], [51, 90]];
    const left = () => { g.beginPath(); g.moveTo(50, 12); g.lineTo(42, 12); g.lineTo(44, 24); g.bezierCurveTo(24, 32, 18, 52, 22, 66); g.quadraticCurveTo(26, 84, 34, 90); g.lineTo(51, 90); for (let i = zig.length - 1; i >= 0; i--) g.lineTo(zig[i][0], zig[i][1]); g.closePath(); };
    const right = () => { g.beginPath(); g.moveTo(50, 12); g.lineTo(58, 12); g.lineTo(56, 24); g.bezierCurveTo(76, 32, 82, 52, 78, 66); g.quadraticCurveTo(74, 84, 66, 90); g.lineTo(51, 90); for (let i = zig.length - 1; i >= 0; i--) g.lineTo(zig[i][0], zig[i][1]); g.closePath(); };
    const band = () => { g.fillStyle = C.copper; g.fillRect(14, 44, 72, 8); };
    if (w) { // a flower pops up out of the mended vase
      const h = clamp(w * 2, 0, 1) * 22;
      g.strokeStyle = C.green; g.lineWidth = 3; g.beginPath(); g.moveTo(50, 14); g.lineTo(50, 14 - h); g.stroke();
      for (let i = 0; i < 5; i++) circle(g, 50 + Math.cos(i * TAU / 5) * 5, 14 - h + Math.sin(i * TAU / 5) * 5, 4, C.red, 1.2);
      circle(g, 50, 14 - h, 3, C.amber, 1.2);
    }
    left(); g.save(); g.clip(); g.fillStyle = C.teal; g.fillRect(0, 0, 100, 100); band(); g.restore(); left(); g.lineWidth = 2.2; g.strokeStyle = C.ink; g.stroke();
    g.save();
    const off = joined ? 0 : Math.hypot(r.ox, r.oy) / r.o0;
    g.translate(joined ? 0 : r.ox, joined ? 0 : r.oy); g.translate(56, 56); g.rotate(off * 0.35); g.translate(-56, -56);
    right(); g.save(); g.clip(); g.fillStyle = C.tealLt; g.fillRect(0, 0, 100, 100); band(); g.restore(); right(); g.lineWidth = 2.2; g.strokeStyle = C.ink; g.stroke();
    g.restore();
    if (joined) { // the glue along the crack, filling as it sets
      g.strokeStyle = set >= 1 ? C.brassLt : `rgba(240,168,48,${0.5 + 0.5 * Math.sin(t * 10)})`; g.lineWidth = 3.4; g.beginPath();
      const n = Math.max(1, Math.round(set * (zig.length - 1)));
      g.moveTo(zig[0][0], zig[0][1]); for (let i = 1; i <= n; i++) g.lineTo(zig[i][0], zig[i][1]); g.stroke();
    }
  },
  // A blunt kitchen knife. Long swipes along the blade put the shine back.
  sharpen(g, r, t, w) {
    const p = r.kind === 'sharpen' ? r.p : 1;
    g.beginPath(); g.moveTo(34, 42); g.lineTo(92, 42); g.quadraticCurveTo(84, 58, 34, 60); g.closePath(); shape(g, '#8d969b');
    g.save(); g.beginPath(); g.moveTo(34, 42); g.lineTo(92, 42); g.quadraticCurveTo(84, 58, 34, 60); g.closePath(); g.clip();
    g.fillStyle = C.steelLt; g.fillRect(34, 50, 58 * p, 12);
    if (p < 1) { g.fillStyle = C.steelDk; for (const x of [44, 58, 71, 82]) if (x > 34 + 58 * p) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x + 2, 55); g.lineTo(x + 4, 60); g.fill(); } }
    if (w) { const x = 30 + w * 70; const gl = g.createLinearGradient(x - 10, 0, x + 10, 0); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,.95)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(x - 10, 40, 20, 22); }
    g.restore();
    g.beginPath(); g.moveTo(34, 42); g.lineTo(92, 42); g.quadraticCurveTo(84, 58, 34, 60); g.closePath(); g.lineWidth = 2.2; g.strokeStyle = C.ink; g.stroke();
    rrect(g, 6, 41, 30, 20, 6, C.wood); rrect(g, 32, 39, 5, 24, 2, C.brassDk, 1.6);
    for (const x of [14, 26]) circle(g, x, 51, 2.4, C.brassLt, 1.2);
    if (w) star(g, 90, 44, 9 * (1 - w) + 2, '#fff');
  },
  // A teddy with its tummy torn open. The needle sews along the dotted zigzag and leaves stitches behind it.
  sew(g, r, t, w) {
    const u = r.kind === 'sew' ? r.u : Infinity, wave = w ? Math.sin(w * TAU * 3) * 0.5 * (1 - w) : 0;
    const fur = '#c98a4e', furLt = '#e8b77c';
    for (const x of [30, 70]) circle(g, x, 92, 10, fur); // feet
    g.save(); g.translate(76, 46); g.rotate(-0.5 - wave); rrect(g, -6, -4, 12, 26, 6, fur); g.restore(); // the waving arm
    g.save(); g.translate(24, 46); g.rotate(0.5); rrect(g, -6, -4, 12, 26, 6, fur); g.restore();
    for (const x of [33, 67]) { circle(g, x, 10, 8, fur); circle(g, x, 10, 4, furLt, 0); }
    g.beginPath(); g.ellipse(50, 66, 28, 28, 0, 0, TAU); shape(g, fur);
    circle(g, 50, 26, 19, fur);
    g.beginPath(); g.ellipse(50, 33, 8, 6, 0, 0, TAU); shape(g, furLt, 1.4);
    circle(g, 50, 30, 2.6, C.ink, 0);
    for (const x of [43, 57]) circle(g, x, 22, 2.4, C.ink, 0);
    g.strokeStyle = C.ink; g.lineWidth = 1.4; g.beginPath(); g.arc(50, 33, 4, rad(20), rad(160)); g.stroke();
    g.beginPath(); g.ellipse(49, 64, 15, 22, 0, 0, TAU); shape(g, furLt, 1.4); // the tummy patch
    // the tear: a dark gap with white stuffing in it where it is not sewn yet; red stitches across it where it is
    const pts = SEAM_POINTS;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#6a3a1f'; g.lineWidth = 7; g.beginPath(); g.moveTo(...seamAt(u)); for (const q of pts) if (pathLen(q) > u) g.lineTo(...q); g.stroke();
    g.strokeStyle = '#fffaf0'; g.lineWidth = 3.4; g.stroke(); // stuffing showing in the gap
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
      for (let d = 2; d < L; d += 5) {
        if (len + d >= u) break;
        const x = ax + (bx - ax) * d / L, y = ay + (by - ay) * d / L;
        g.strokeStyle = C.red; g.lineWidth = 2; g.beginPath(); g.moveTo(x - nx * 4, y - ny * 4); g.lineTo(x + nx * 4, y + ny * 4); g.stroke();
      }
      len += L;
    }
    if (r.kind === 'sew' && !r.done) {
      const [nx, ny] = seamAt(r.u), [ex, ey] = pts.at(-1);
      star(g, ex, ey, 5 + Math.sin(t * 6), C.teal); // where the seam ends
      // the thread runs from the needle back to the last stitch, then off the side
      g.strokeStyle = C.red; g.lineWidth = 1.6; g.beginPath(); g.moveTo(nx, ny); g.quadraticCurveTo(nx - 18, ny + 10, nx - 24, ny - 4); g.stroke();
      g.save(); g.translate(nx, ny); g.rotate(-0.8);
      g.beginPath(); g.moveTo(0, -11); g.lineTo(2, 6); g.lineTo(0, 9); g.lineTo(-2, 6); g.closePath(); shape(g, C.steelLt, 1.6);
      g.strokeStyle = C.ink; g.lineWidth = 1; g.beginPath(); g.ellipse(0, -7, 0.8, 2.2, 0, 0, TAU); g.stroke();
      g.restore();
      circle(g, nx, ny, 7.5 + Math.sin(t * 6) * 0.8, 'rgba(255,255,255,0)', 1.6); // a ring round the needle: grab here
    }
    if (w) for (let i = 0; i < 3; i++) circle(g, 30 + i * 20, 20 - w * 26 - i * 4, 3 * (1 - w) + 1, '#ff8fa8', 0);
  },
  // A flat ball and a bicycle pump. Push the handle down and pull it up; each push puffs the ball up a bit.
  pump(g, r, t, w) {
    const f = r.kind === 'pump' ? r.strokes / r.need : 1, h = r.kind === 'pump' ? r.h : 22;
    const bounce = w ? Math.abs(Math.sin(w * TAU * 1.5)) * 18 * (1 - w) : 0;
    const R = 12 + 16 * f, squash = 1 - 0.45 * (1 - f), bx = 34, by = 90 - R * squash - bounce;
    // the hose from the pump's foot to the ball
    g.strokeStyle = C.ink; g.lineWidth = 4.5; g.beginPath(); g.moveTo(74, 88); g.bezierCurveTo(60, 98, 50, 96, bx + R * 0.6, by + R * squash * 0.4); g.stroke();
    g.strokeStyle = '#3d4d5c'; g.lineWidth = 2.6; g.stroke();
    const rx = R / Math.sqrt(squash), ry = R * squash;
    g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, TAU); shape(g, C.red, 2.4);
    g.save(); g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, TAU); g.clip();
    g.strokeStyle = C.amber; g.lineWidth = ry * 0.45; g.beginPath(); g.ellipse(bx, by + ry * 0.9, rx * 1.1, ry * 0.9, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); // a stripe round the ball
    g.restore();
    g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, TAU); g.lineWidth = 2.4; g.strokeStyle = C.ink; g.stroke();
    shine(g, bx - rx * 0.4, by - ry * 0.45, Math.max(2, R * 0.25), 0.6);
    // the pump: a barrel on a foot, the rod and T handle at height h
    rrect(g, 60, 88, 28, 6, 3, C.steelDk);
    g.strokeStyle = C.ink; g.lineWidth = 4; g.beginPath(); g.moveTo(74, h); g.lineTo(74, 46); g.stroke();
    g.strokeStyle = C.steelLt; g.lineWidth = 2.2; g.stroke();
    rrect(g, 67, 44, 14, 46, 4, C.teal); g.strokeStyle = C.tealLt; g.lineWidth = 1.6; g.beginPath(); g.moveTo(70.5, 48); g.lineTo(70.5, 84); g.stroke();
    rrect(g, 60, h - 5, 28, 9, 4.5, C.wood); shine(g, 66, h - 2, 3, 0.4);
    if (r.kind === 'pump' && !r.done) {
      // the strokes still to go, as little dots up the barrel
      for (let i = 0; i < r.need; i++) circle(g, 86, 86 - i * 6, 1.8, i < r.strokes ? '#7fe0a0' : 'rgba(255,255,255,.55)', 0.8);
    }
  },
  // A squeaky door swinging on its own in a frame, its hinge up on the left; the oil can sits low on the right, away
  // from the hinge, so the tapping thumb never covers the swing. The hinge glows while the door is open enough.
  oil(g, r, t, w) {
    const ph = r.kind === 'oil' ? r.ph : t * 0.3, open = r.kind === 'oil' && !r.done ? 0.5 - 0.5 * Math.cos(2 * Math.PI * ph) : w ? 0.5 - 0.5 * Math.cos(w * Math.PI * 2) : 0.15;
    const ready = r.kind === 'oil' && !r.done && open >= OIL_OPEN, drops = r.kind === 'oil' ? r.drops : 3;
    rrect(g, 12, 6, 62, 74, 4, C.woodDk); rrect(g, 17, 11, 52, 69, 2, '#3a2a22', 1.4); // the frame and the dark room behind
    g.fillStyle = 'rgba(255,230,160,.25)'; g.fillRect(17, 11, 52 * open, 69); // light through the open door
    const dw = 52 * (1 - 0.78 * open), skew = 6 * open; // the door turns away on its hinge: narrower, its far edge taller
    g.beginPath(); g.moveTo(17, 11); g.lineTo(17 + dw, 11 - skew); g.lineTo(17 + dw, 80 + skew); g.lineTo(17, 80); g.closePath(); shape(g, C.woodLt);
    g.strokeStyle = C.wood; g.lineWidth = 1.4; for (const k of [0.33, 0.66]) { g.beginPath(); g.moveTo(17 + dw * k, 13 - skew * k); g.lineTo(17 + dw * k, 78 + skew * k); g.stroke(); }
    circle(g, 17 + dw * 0.82, 46, 2.6, C.brass, 1.2); // the handle
    // the hinges: the top one takes the oil
    for (const hy of [24, 66]) { rrect(g, 13, hy - 6, 9, 12, 2, hy === 24 && ready ? C.glow : C.steel, 1.6); }
    if (ready) { g.strokeStyle = `rgba(255,243,168,${0.6 + 0.4 * Math.sin(t * 20)})`; g.lineWidth = 2.5; g.beginPath(); g.arc(17, 24, 11, 0, TAU); g.stroke(); }
    // the squeak: little lines off the hinge while it swings dry
    if (r.kind === 'oil' && !r.done && drops < r.need && open > 0.2) { g.strokeStyle = `rgba(255,255,255,${0.4 + 0.4 * open})`; g.lineWidth = 1.6; for (let i = 0; i < 3 - drops; i++) { g.beginPath(); g.arc(17, 24, 15 + i * 5, rad(-150), rad(-110)); g.stroke(); } }
    // oil on the hinge so far
    for (let i = 0; i < drops; i++) { g.fillStyle = '#c9a43a'; g.beginPath(); g.ellipse(17, 29 + i * 3, 2.2, 1.6, 0, 0, TAU); g.fill(); }
    // the oil can: body, spout pointing up-left at the hinge, and the drops still to go as dots on it
    const cx = r.kind === 'oil' ? r.cx : 72, cy = r.kind === 'oil' ? r.cy : 80;
    g.strokeStyle = C.ink; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 8, cy - 8); g.lineTo(cx - 20, cy - 24); g.stroke();
    g.strokeStyle = C.brassDk; g.lineWidth = 2.6; g.stroke();
    g.beginPath(); g.ellipse(cx, cy, 13, 11, 0, 0, TAU); shape(g, C.red); shine(g, cx - 5, cy - 5, 3.5, 0.5);
    rrect(g, cx - 4, cy - 15, 8, 5, 2, C.steel, 1.4);
    if (r.kind === 'oil' && !r.done) for (let i = 0; i < r.need; i++) circle(g, cx - 6 + i * 6, cy + 4, 1.9, i < r.drops ? '#ffd860' : 'rgba(255,255,255,.5)', 0.8);
    if (w) for (let i = 0; i < 3; i++) note(g, 34 + i * 14, 30 - w * 20 - i * 5, 1 - w);
  },
  // A jacket with a stuck zip: the open teeth above the slider, closed below. The tab hangs under the slider, where the
  // thumb holds it, so the teeth above stay in sight. Red threads mark the snags; stuck, the slider shakes.
  zip(g, r, t, w) {
    const y = r.kind === 'zip' ? r.y : 24, top = r.kind === 'zip' ? r.top : 24, y0 = r.kind === 'zip' ? r.y0 : 84;
    const stuck = r.kind === 'zip' && !r.done && r.snags.length && y <= r.snags[0] + 0.5;
    const gap = yy => yy < y ? Math.min(16, (y - yy) * 0.3) : 0; // how far apart the two sides are at height yy
    const side = sgn => { // one half of the jacket, its zip edge following the gap
      g.beginPath(); g.moveTo(50, 98); g.lineTo(50 + sgn * 44, 98); g.lineTo(50 + sgn * 46, 26); g.lineTo(50 + sgn * 30, 6); g.lineTo(50 + sgn * 12, 6);
      for (let yy = 8; yy <= 98; yy += 6) g.lineTo(50 + sgn * (gap(yy) + 1), yy);
      g.closePath(); shape(g, sgn < 0 ? C.teal : '#2a807b');
    };
    g.fillStyle = '#e8d0a8'; g.beginPath(); g.ellipse(50, 10, 14, 5, 0, 0, TAU); g.fill(); // the lining at the collar
    side(-1); side(1);
    // pockets and cuffs
    for (const sgn of [-1, 1]) { g.strokeStyle = C.tealDk; g.lineWidth = 1.6; g.beginPath(); g.moveTo(50 + sgn * 24, 70); g.lineTo(50 + sgn * 36, 66); g.stroke(); }
    // the teeth
    for (let yy = 10; yy < 96; yy += 3.2) { const d = gap(yy); for (const sgn of [-1, 1]) { g.fillStyle = C.brassLt; g.fillRect(50 + sgn * (d + 1) - (sgn < 0 ? 3 : 0), yy, 3, 1.8); } }
    // the snags: little red tangles in the teeth
    if (r.kind === 'zip' && !r.done) for (const sy of r.snags) { g.strokeStyle = C.red; g.lineWidth = 2; g.beginPath(); g.moveTo(44, sy - 3); g.quadraticCurveTo(54, sy - 8, 50, sy - 2); g.quadraticCurveTo(44, sy + 2, 56, sy - 4); g.stroke(); }
    // the slider and its tab
    const sx = 50 + (stuck ? Math.sin(t * 40) * 1.2 : 0);
    rrect(g, sx - 6, y - 5, 12, 10, 3, C.steelLt, 1.8);
    g.strokeStyle = C.ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx, y + 4); g.lineTo(sx, y + 7); g.stroke();
    rrect(g, sx - 4.5, y + 7, 9, 13, 3, stuck ? C.amber : C.steel, 1.8); circle(g, sx, y + 16, 1.6, C.ink, 0);
    if (stuck && r.kind === 'zip') { // a side-to-side cue at the stuck slider
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.lineCap = 'round';
      for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(sx + sgn * 10, y); g.lineTo(sx + sgn * 16, y); g.moveTo(sx + sgn * 13, y - 3); g.lineTo(sx + sgn * 16, y); g.lineTo(sx + sgn * 13, y + 3); g.stroke(); }
      for (let i = 0; i < 4; i++) circle(g, sx - 6 + i * 4, y - 9, 1.3, i < r.wig ? '#7fe0a0' : 'rgba(255,255,255,.55)', 0.6);
    }
    if (r.kind === 'zip' && !r.done) star(g, 50, top - 6, 4 + Math.sin(t * 6), C.glow); // where the slider goes
    if (w) star(g, 50, 14, 12 * (1 - w), '#fff', 1 - w);
    void y0;
  },
  // A wind-up toy car. Hold its back and pull it left; the key on its roof turns and a meter fills; when the key glows,
  // let go and it zooms off to the right.
  spring(g, r, t, w) {
    const x = r.kind === 'spring' ? r.x : 64, y = r.kind === 'spring' ? r.y : 60, wind = r.kind === 'spring' ? r.w : 0, ready = r.kind === 'spring' && !r.done && wind >= 1;
    const zoom = r.kind === 'spring' && r.zoom ? w * 70 : 0, cx = x + zoom;
    g.fillStyle = 'rgba(58,34,22,.25)'; g.fillRect(4, y + 13, 92, 4); // the floor line
    if (r.kind === 'spring' && !r.done) { // the wind meter along the top: fills as the car is pulled back
      rrect(g, 14, 16, 72, 9, 4.5, 'rgba(255,255,255,.35)', 1.6);
      if (wind > 0.01) rrect(g, 15, 17, 70 * wind, 7, 3.5, ready ? '#7fe0a0' : C.amber, 0);
      for (let i = 1; i < 4; i++) { g.strokeStyle = 'rgba(58,34,22,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(14 + 18 * i, 17); g.lineTo(14 + 18 * i, 24); g.stroke(); }
      if (!r.grab && wind < 0.05) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.4; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(x - 20, y - 22); g.lineTo(r.x0 - r.need - 14, y - 22); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(r.x0 - r.need - 18, y - 22); g.lineTo(r.x0 - r.need - 12, y - 26); g.lineTo(r.x0 - r.need - 12, y - 18); g.closePath(); g.fill(); }
    }
    if (zoom) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - 22 - i * 4, y - 6 + i * 6); g.lineTo(cx - 40 - i * 6, y - 6 + i * 6); g.stroke(); } }
    g.save(); g.translate(cx, y);
    // body, cab, windows, wheels
    g.beginPath(); g.moveTo(-20, 8); g.lineTo(-20, -2); g.quadraticCurveTo(-18, -6, -12, -6); g.lineTo(-8, -15); g.lineTo(8, -15); g.lineTo(13, -6); g.quadraticCurveTo(20, -6, 21, 0); g.lineTo(21, 8); g.closePath(); shape(g, C.red);
    rrect(g, -6, -13, 6, 6, 1.5, C.steelLt, 1.2); rrect(g, 2, -13, 6, 6, 1.5, C.steelLt, 1.2);
    for (const wx of [-12, 12]) { circle(g, wx, 9, 5.5, '#333', 1.6); circle(g, wx, 9, 2, C.steel, 0); g.save(); g.translate(wx, 9); g.rotate(-wind * 12 - zoom * 0.3); g.strokeStyle = C.steelLt; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-3.5, 0); g.lineTo(3.5, 0); g.stroke(); g.restore(); }
    // the key on the roof, turning as it winds
    g.save(); g.translate(0, -18); g.scale(Math.cos(wind * 10 + (zoom ? t * 20 : 0)), 1);
    g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 3); g.lineTo(0, -1); g.stroke();
    for (const sgn of [-1, 1]) { g.beginPath(); g.ellipse(sgn * 5, -4, 4.5, 3.5, 0, 0, TAU); shape(g, ready ? C.glow : C.brass, 1.6); }
    g.restore();
    if (ready) { g.strokeStyle = `rgba(255,243,168,${0.5 + 0.5 * Math.sin(t * 16)})`; g.lineWidth = 2.5; g.beginPath(); g.arc(0, -22, 11, 0, TAU); g.stroke(); }
    g.restore();
    if (r.kind === 'spring' && !r.done && !r.grab) { circle(g, x - 8, y, 7 + Math.sin(t * 6) * 0.8, 'rgba(255,255,255,0)', 1.6); } // grab here
  },
  // A needle on a pincushion. The stiff thread tip sits above and to the right of the thumb.
  thread(g, r, t, w) {
    const ex = r.kind === 'thread' ? r.ex : 64, ey = r.kind === 'thread' ? r.ey : 28, tx = r.kind === 'thread' ? r.tx : ex, ty = r.kind === 'thread' ? r.ty : ey;
    const inEye = r.kind === 'thread' ? r.inEye : 1;
    // pincushion
    g.beginPath(); g.ellipse(ex, 88, 22, 9, 0, 0, TAU); shape(g, C.red); circle(g, ex, 82, 2.4, C.green, 1);
    // the needle
    g.beginPath(); g.moveTo(ex - 2.5, ey - 12); g.quadraticCurveTo(ex, ey - 16, ex + 2.5, ey - 12); g.lineTo(ex + 1.6, 84); g.lineTo(ex, 88); g.lineTo(ex - 1.6, 84); g.closePath(); shape(g, C.steelLt, 1.6);
    g.fillStyle = '#4a3a30'; g.beginPath(); g.ellipse(ex, ey, 1.4, 5, 0, 0, TAU); g.fill(); // the eye
    // the target ring round the eye, filling as the thread goes through
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.6; g.beginPath(); g.arc(ex, ey, 8, 0, TAU); g.stroke();
    if (inEye > 0) { g.strokeStyle = '#7fe0a0'; g.lineWidth = 3; g.beginPath(); g.arc(ex, ey, 8, -Math.PI / 2, -Math.PI / 2 + TAU * inEye); g.stroke(); }
    // the spool, bottom left, and the thread from it to the tip
    rrect(g, 15, 78, 16, 17, 3, C.woodLt, 1.6);
    rrect(g, 16, 81, 14, 11, 2, '#4f7fd0', 1.2);
    for (const y of [84, 87, 90]) strokePath(g, [[17, y], [29, y - 1]], '#9cc5f9', 0.8);
    g.strokeStyle = '#6a9be4'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(16, 85);
    if (r.kind === 'thread' && !r.done) {
      const fx = tx - THREAD_SIDE, fy = ty + THREAD_UP;
      g.bezierCurveTo(7, 88, Math.max(7, fx - 8), fy + 7, fx, fy); g.lineTo(tx, ty);
    }
    else { g.quadraticCurveTo(40, 70, ex - 4, ey + 4); g.lineTo(ex + 8, ey - 2); g.quadraticCurveTo(ex + 18, ey + 10, ex + 14, ey + 30); }
    g.stroke();
    if (r.kind === 'thread' && !r.done) {
      circle(g, tx, ty, 2.6, '#bbdcff', 1.2);
      if (!r.grab) circle(g, tx - THREAD_SIDE, ty + THREAD_UP, 6.5, '#4f7fd0', 1.8);
    }
    if (w) star(g, ex, ey, 10 * (1 - w), '#fff', 1 - w);
  },
  // A spring behind glass. The lower track gives the crank its two end stops.
  wind(g, r, t, w) {
    rrect(g, 12, 79, 76, 12, 4, '#b55b3b');
    rrect(g, 17, 30, 66, 48, 12, '#cf7448');
    rrect(g, 22, 22, 56, 47, 12, '#f3b374');
    for (const x of [27, 73]) circle(g, x, 59, 2, C.brassLt, 1.1);
    circle(g, 50, 44, 20, '#203e45');
    circle(g, 50, 44, 16.8, '#154b50', 1.4);
    const angle = rad(r.a) + w * TAU * 2;
    const spring = Array.from({ length: 80 }, (_, i) => {
      const v = i / 79, a = v * TAU * 3.5 + angle, R = 2 + 13 * v;
      return [50 + Math.cos(a) * R, 44 + Math.sin(a) * R];
    });
    strokePath(g, spring, C.brassLt, 1.8);
    g.strokeStyle = 'rgba(217,254,248,.4)'; g.lineWidth = 2.1; g.beginPath();
    g.arc(50, 44, 15.2, rad(181), rad(263)); g.stroke();
    for (let i = 0; i < 4; i++) circle(g, 38 + i * 8, 16, 2.5, i < r.leg ? C.glow : C.woodDk, 1);
    const target = WIND_STOPS[1 - r.leg % 2], next = crankPoint(r, target);
    if (!r.done) {
      for (const a of WIND_STOPS) circle(g, ...crankPoint(r, a), a === target ? 7 : 5.2, a === target ? C.tealLt : C.steelDk, 1.8);
      g.strokeStyle = '#ffebc4'; g.lineWidth = 2.2; g.setLineDash([2, 3]); g.beginPath();
      g.arc(r.cx, r.cy, r.radius, rad(Math.min(r.a, target)), rad(Math.max(r.a, target))); g.stroke(); g.setLineDash([]);
      // The chevron is just before the far stop, clear of the handle itself.
      const approach = target + (target > r.a ? -16 : 16);
      arrow(g, ...crankPoint(r, approach), rad(approach + (target > r.a ? 90 : -90)), 3.4, '#fff6dc');
      if (!r.grab) star(g, ...next, 3, C.cream);
    }
    const [x, y] = crankPoint(r);
    strokePath(g, [[r.cx, r.cy], [x, y]], C.ink, 6.5);
    strokePath(g, [[r.cx, r.cy], [x, y]], C.steel, 3.6);
    circle(g, r.cx, r.cy, 4, C.brassLt, 1.5);
    circle(g, x, y, 7, r.done ? C.glow : C.red);
    shine(g, x - 1, y - 1.5, 2.8, 0.5);
    if (w) star(g, 50, 18, 9 * (1 - w), '#fff');
  },
  // A balance with a sliding counterweight under the base. Its pans remain visible above the thumb.
  balance(g, r, t, w) {
    const load = r.loads[r.stage] ?? r.handle, tilt = r.tilt;
    rrect(g, 43, 32, 14, 41, 4, C.brass);
    rrect(g, 14, 67, 72, 22, 7, '#633d62');
    rrect(g, 17, r.y - 5, 66, 10, 5, '#302732', 1.5);
    if (!r.done) {
      rrect(g, load - SCALE_BAND, r.y - 5, SCALE_BAND * 2, 10, 3, C.tealLt, 0);
      arrow(g, load, r.y - 13, Math.PI / 2, 3, C.tealLt);
    }
    rrect(g, r.handle - 7, r.y - 7, 14, 14, 4, r.done ? C.glow : C.brassLt, 1.8);
    strokePath(g, [[r.handle - 2, r.y - 3], [r.handle - 2, r.y + 3]], C.copperDk, 1.2);
    strokePath(g, [[r.handle + 2, r.y - 3], [r.handle + 2, r.y + 3]], C.copperDk, 1.2);
    const h = 29;
    const ends = [-1, 1].map(sign => [50 + sign * 29 * Math.cos(tilt), h + sign * 29 * Math.sin(tilt)]);
    strokePath(g, ends, C.ink, 6); strokePath(g, ends, C.brassLt, 3);
    for (const [i, [x, y]] of ends.entries()) {
      const bottom = y + 23;
      strokePath(g, [[x - 12, bottom], [x, y], [x + 12, bottom]], C.ink, 1.7);
      if ((i === 0) === (load > 50)) {
        rrect(g, x - 7, bottom - 11, 14, 10, 2, C.steel, 1.5);
        circle(g, x, bottom - 12, 2.7, C.steelLt, 1.2);
      } else {
        circle(g, x, bottom - 4, 3.8, C.brassLt, 1.5);
      }
      g.beginPath(); g.moveTo(x - 15, bottom); g.quadraticCurveTo(x, bottom + 15, x + 15, bottom); g.closePath();
      shape(g, '#c87e62', 1.8);
    }
    circle(g, 50, h, 8, '#392c45');
    g.strokeStyle = r.dwell > 0 || r.done ? C.tealLt : C.cream; g.lineWidth = 1.9;
    g.beginPath(); g.moveTo(45, h); g.lineTo(55, h); g.stroke();
    circle(g, 50 + 5 * Math.sin(tilt * 2.5), h - 2, 2.25, r.dwell > 0 || r.done ? C.tealLt : C.brassLt, 0);
    for (let i = 0; i < 3; i++) circle(g, 42 + 8 * i, 14, 2.5, i < r.stage ? C.tealLt : C.steelDk, 1.1);
    if (w) for (const [x, y] of ends) star(g, x, y + 20, 9 * (1 - w), C.glow);
  },
  // A ceramic tile. Gold sealer replaces each completed section of the crack.
  trace(g, r, t, w) {
    rrect(g, 5, 24, 90, 46, 7, '#ab7158');
    rrect(g, 5, 20, 90, 46, 7, '#c3ded7');
    rrect(g, 10, 24, 80, 38, 4, '#357579', 1.5);
    for (const x of [20, 40, 60, 80]) for (const y of [29, 56]) {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
      rrect(g, -3, -3, 6, 6, 1, '#85b4ad', 0); g.restore();
    }
    strokePath(g, r.pts, '#193a43', 5);
    if (!r.done) {
      const [sx, sy] = r.samples[r.next - 1], [ex, ey] = r.pts.at(-1);
      g.setLineDash([0.5, 4]);
      strokePath(g, r.samples.slice(r.next - 1), '#bde6db', 1.35);
      g.setLineDash([]);
      if (!r.grab) circle(g, sx, sy, 5.2, '#e2f5ed', 1.3);
      star(g, ex, ey, 4.7, C.cream);
    }
    if (r.next > 1) {
      const sealed = r.samples.slice(0, r.next);
      strokePath(g, sealed, '#a36624', 5);
      strokePath(g, sealed, C.brassLt, 2.8);
    }
    if (!r.done) {
      const [sx, sy] = r.samples[r.next - 1];
      const tx = r.grab ? r.tx : sx, ty = r.grab ? r.ty : sy;
      const fy = ty + TRACE_OFFSET;
      strokePath(g, [[tx, ty], [tx, fy - 6]], C.ink, 3.5);
      strokePath(g, [[tx, ty], [tx, fy - 6]], C.brassLt, 2.1);
      rrect(g, tx - 5.5, fy - 7, 11, 15, 4, '#bf6655', 1.6);
      circle(g, tx, ty, 2.4, C.glow, 1.05);
    }
    if (w) for (const [i, [x, y]] of r.pts.entries()) star(g, x, y, (7 - i / 2) * (1 - w), '#fff7d5');
  },
};
function gear(g, x, y, R, teeth, a) {
  g.save(); g.translate(x, y); g.rotate(a); g.beginPath();
  for (let i = 0; i < teeth * 2; i++) { const rr = i % 2 ? R : R + 3.5, an = i * Math.PI / teeth; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
  g.closePath(); shape(g, C.steel, 2); circle(g, 0, 0, R * 0.55, C.steelDk, 1.6); g.restore();
}
function note(g, x, y, a) {
  g.save(); g.globalAlpha *= a; g.fillStyle = C.ink; g.strokeStyle = C.ink; g.lineWidth = 2;
  g.beginPath(); g.ellipse(x, y, 4, 3, -0.4, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x + 3.5, y); g.lineTo(x + 3.5, y - 14); g.lineTo(x + 9, y - 11); g.stroke(); g.restore();
}

// How far along the teddy's seam a corner of it is.
function pathLen(q) { let len = 0; for (let i = 1; i < SEAM_POINTS.length; i++) { len += Math.hypot(SEAM_POINTS[i][0] - SEAM_POINTS[i - 1][0], SEAM_POINTS[i][1] - SEAM_POINTS[i - 1][1]); if (SEAM_POINTS[i] === q) return len; } return 0; }

// The job on the bench: the main object, then a second repair (a screw, or dents on the bell) drawn on top.
export function drawJob(g, reps, stepN, t, works) {
  const main = reps[0], second = reps[1];
  OBJ[main.kind](g, main, t, stepN === 0 || !second ? works : 0);
  if (second) {
    if (stepN === 0) g.globalAlpha = 0.5; // the second repair waits its turn: shown, but quieter than the job at hand
    if (second.kind === 'screw') screwHead(g, second.cx, second.cy, second.p, second.slot, 0.85);
    else dents(g, second, t);
    g.globalAlpha = 1;
    if (works) star(g, 50, 50, 14 * (1 - works), '#fff', 1 - works);
  }
}

// Silly things the regular's object wears, more of them each visit.
const SILLY = ['eyes', 'tache', 'hat', 'bow', 'shades', 'flower'];
export function sillyList(visits) { const n = Math.min(3, 1 + Math.floor(visits / 2)); return Array.from({ length: n }, (_, i) => SILLY[(visits + i * 2) % SILLY.length]); }
export function drawSilly(g, list, t) {
  for (const k of list) {
    if (k === 'eyes' || k === 'shades') for (const x of [40, 60]) {
      if (k === 'shades') { rrect(g, x - 8, 18, 16, 9, 4, '#222', 1.6); shine(g, x - 3, 20, 2.4, 0.5); }
      else { circle(g, x, 22, 7, '#fff', 1.8); circle(g, x + Math.sin(t * 5 + x) * 3, 23 + Math.cos(t * 4 + x) * 2, 3, C.ink, 0); }
    }
    if (k === 'eyes' && list.includes('shades')) continue;
    if (k === 'tache') { g.fillStyle = C.ink; g.beginPath(); g.moveTo(50, 32); g.quadraticCurveTo(40, 28, 34, 36); g.quadraticCurveTo(42, 36, 50, 35); g.quadraticCurveTo(58, 36, 66, 36); g.quadraticCurveTo(60, 28, 50, 32); g.fill(); }
    if (k === 'hat') { g.beginPath(); g.moveTo(40, 12); g.lineTo(50, -12); g.lineTo(60, 12); g.closePath(); shape(g, C.red, 1.8); circle(g, 50, -12, 3, C.amber, 1.4); }
    if (k === 'bow') { g.beginPath(); g.moveTo(80, 14); g.lineTo(70, 8); g.lineTo(70, 20); g.closePath(); g.moveTo(80, 14); g.lineTo(90, 8); g.lineTo(90, 20); g.closePath(); shape(g, '#e06a9a', 1.6); circle(g, 80, 14, 2.6, '#b8447a', 1.2); }
    if (k === 'flower') { for (let i = 0; i < 5; i++) circle(g, 16 + Math.cos(i * TAU / 5) * 4, 14 + Math.sin(i * TAU / 5) * 4, 3.4, '#fff', 1); circle(g, 16, 14, 2.6, C.amber, 1); }
  }
}

// The ghost finger: a fingertip that shows the gesture on the thing, with a faint trail of its path.
export function drawGhost(g, gd, t, alpha) {
  if (!gd || alpha <= 0) return;
  const { p, press, tap } = ghost(gd, t);
  g.save(); g.globalAlpha = alpha;
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.4; g.setLineDash([3, 4]); g.beginPath();
  if (gd.type === 'circle' || gd.type === 'flick') g.arc(gd.cx, gd.cy, gd.r, gd.type === 'flick' ? rad(200) : 0, gd.type === 'flick' ? rad(350) : TAU);
  else if (gd.type === 'arc') g.arc(gd.cx, gd.cy, gd.r, rad(gd.from), rad(gd.to));
  else if (gd.type === 'drag' || gd.type === 'swipe') { g.moveTo(gd.from[0], gd.from[1]); g.lineTo(gd.to[0], gd.to[1]); }
  else if (gd.type === 'rub') { g.moveTo(gd.cx - gd.w / 2, gd.cy); g.lineTo(gd.cx + gd.w / 2, gd.cy); }
  else if (gd.type === 'path' && !gd.trace) { g.moveTo(...gd.pts[0]); for (const q of gd.pts.slice(1)) g.lineTo(...q); }
  else if (gd.type === 'balance') { g.moveTo(...gd.from); g.lineTo(gd.targets[0], gd.from[1]); }
  else if (gd.type === 'pump') { g.moveTo(gd.x - 9, gd.top + 6); g.lineTo(gd.x - 9, gd.bottom + 6); }
  else if (gd.type === 'zip') { g.moveTo(gd.at[0] + 14, gd.at[1]); g.lineTo(gd.at[0] + 14, gd.top); }
  else if (gd.type === 'timing') g.arc(gd.at[0], gd.at[1], 16, 0, TAU);
  g.stroke(); g.setLineDash([]);
  // arrowhead at the end of the path, so the way to go is plain
  const end = gd.type === 'circle' ? null : gd.type === 'arc' ? [gd.cx + Math.cos(rad(gd.to)) * gd.r, gd.cy + Math.sin(rad(gd.to)) * gd.r, rad(gd.to + 90)]
    : gd.type === 'flick' ? [gd.cx + Math.cos(rad(350)) * gd.r, gd.cy + Math.sin(rad(350)) * gd.r, rad(80)]
    : gd.type === 'drag' || gd.type === 'swipe' ? [gd.to[0], gd.to[1], Math.atan2(gd.to[1] - gd.from[1], gd.to[0] - gd.from[0])]
    : gd.type === 'path' && !gd.trace && gd.pts.length > 1 ? [...gd.pts.at(-1), Math.atan2(gd.pts.at(-1)[1] - gd.pts.at(-2)[1], gd.pts.at(-1)[0] - gd.pts.at(-2)[0])]
    : gd.type === 'pump' ? [gd.x - 9, gd.bottom + 6, Math.PI / 2]
    : gd.type === 'zip' ? [gd.at[0] + 14, gd.top, -Math.PI / 2] : null;
  if (end) { g.fillStyle = 'rgba(255,255,255,.8)'; g.save(); g.translate(end[0], end[1]); g.rotate(end[2]); g.beginPath(); g.moveTo(5, 0); g.lineTo(-4, -5); g.lineTo(-4, 5); g.closePath(); g.fill(); g.restore(); }
  if (tap && gd.all) for (const a of gd.all) { g.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 8)})`; g.lineWidth = 2.5; g.beginPath(); g.arc(a[0], a[1], 13 + 2 * Math.sin(t * 8), 0, TAU); g.stroke(); }
  // the fingertip itself
  const [x, y] = p;
  if (gd.trace && press) {
    strokePath(g, [[x, y - TRACE_OFFSET], [x, y - 5]], 'rgba(255,243,168,.8)', 1.7);
    star(g, x, y - TRACE_OFFSET, 4, '#fff3a8');
  }
  if (press) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x, y, 12 + (tap ? 6 * ((t * 4) % 1) : 0), 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,248,235,.92)'; g.strokeStyle = 'rgba(58,34,22,.8)'; g.lineWidth = 1.8;
  g.beginPath(); g.ellipse(x + 2, y + 8, 6.5, 9, -0.25, 0, TAU); g.fill(); g.stroke(); // finger pad
  // Near the bottom of the bench, only show the first segment of the finger.
  const stem = clamp(96 - y - 12, 7, 18);
  g.beginPath(); g.roundRect(x - 2, y + 12, 11, stem, Math.min(5, stem / 2)); g.fill(); g.stroke();
  g.fillStyle = 'rgba(230,190,170,.9)'; g.beginPath(); g.ellipse(x + 2, y + 3, 3.5, 3, -0.25, 0, TAU); g.fill(); // nail
  g.restore();
}

// ---------- people
const SKIN = ['#f6d3b3', '#e8b48f', '#c98d63', '#a0653f', '#7a4a2c', '#f1c7a0'];
const HAIR = ['#2b1d14', '#5a3820', '#a8642e', '#d8b46a', '#8f8f8f', '#c2452f', '#1f2b3a'];
const SHIRT = ['#2f8f8a', '#d9493b', '#5b6fb8', '#e0a43a', '#7a4fa0', '#4d9a58', '#e07a5f', '#3d4d5c'];
export function looks(look) {
  return {
    skin: SKIN[look % SKIN.length], hair: HAIR[(look >> 3) % HAIR.length], style: (look >> 6) % 5, hat: (look >> 9) % 6,
    shirt: SHIRT[(look >> 12) % SHIRT.length], glasses: (look >> 15) % 5 === 0, tache: (look >> 17) % 7 === 0, round: 0.92 + ((look >> 19) % 4) * 0.06,
  };
}
export const REGULAR = { skin: '#f1c7a0', hair: '#e8e8e8', style: 1, hat: 9, shirt: '#7a4fa0', glasses: true, tache: true, round: 1.04 };

// A person behind the counter. (x, base) is the middle of their shoulders at the counter's edge; R is the head radius.
// mood: 'happy' | 'ok' | 'wait' | 'cross'. act: 0..1 cheer (arms up) or walk-off lean.
export function person(g, x, base, R, L, mood, t, { cheer = 0, blinkSeed = 0, bob = 0 } = {}) {
  const hy = base - R * 2.15 - bob, hx = x;
  // body
  g.beginPath(); g.moveTo(x - R * 1.45, base + 2); g.quadraticCurveTo(x - R * 1.5, base - R * 1.25, x - R * 0.6, base - R * 1.3); g.lineTo(x + R * 0.6, base - R * 1.3); g.quadraticCurveTo(x + R * 1.5, base - R * 1.25, x + R * 1.45, base + 2); g.closePath();
  shape(g, L.shirt, R * 0.08);
  if (cheer > 0) { // arms up
    g.strokeStyle = L.shirt; g.lineCap = 'round'; g.lineWidth = R * 0.42;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * R * 1.1, base - R * 1.0); g.lineTo(x + s * R * (1.4 + 0.3 * cheer), base - R * (1.8 + 1.2 * cheer)); g.stroke(); circle(g, x + s * R * (1.4 + 0.3 * cheer), base - R * (1.85 + 1.2 * cheer), R * 0.26, L.skin, R * 0.06); }
  }
  // neck and head
  g.fillStyle = L.skin; g.fillRect(x - R * 0.3, hy + R * 0.6, R * 0.6, R * 0.8);
  if (L.style === 3 && L.hat < 3) circle(g, hx, hy - R * 0.95, R * 0.42, L.hair, R * 0.07); // a bun
  g.beginPath(); g.ellipse(hx, hy, R * L.round, R, 0, 0, TAU); shape(g, L.skin, R * 0.08);
  // hair
  g.fillStyle = L.hair; g.strokeStyle = C.ink; g.lineWidth = R * 0.07;
  if (L.style === 0) { g.beginPath(); g.ellipse(hx, hy - R * 0.45, R * 0.95, R * 0.6, 0, Math.PI, TAU); g.fill(); g.stroke(); }
  else if (L.style === 1) { g.beginPath(); g.arc(hx, hy - R * 0.1, R * 1.02, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(hx + R * 1.0, hy + R * 0.5); g.lineTo(hx + R * 0.75, hy + R * 0.5); g.lineTo(hx + R * 0.7, hy - R * 0.3); g.lineTo(hx - R * 0.7, hy - R * 0.3); g.lineTo(hx - R * 0.75, hy + R * 0.5); g.lineTo(hx - R * 1.0, hy + R * 0.5); g.closePath(); g.fill(); g.stroke(); }
  else if (L.style === 2) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = Math.PI + i * Math.PI / 6; g.lineTo(hx + Math.cos(a) * R * (i % 2 ? 1.25 : 0.9), hy - R * 0.15 + Math.sin(a) * R * (i % 2 ? 1.25 : 0.9)); } g.closePath(); g.fill(); g.stroke(); }
  else if (L.style === 4) { for (let i = 0; i < 7; i++) { const a = Math.PI + 0.2 + i * (Math.PI - 0.4) / 6; circle(g, hx + Math.cos(a) * R * 0.85, hy - R * 0.1 + Math.sin(a) * R * 0.85, R * 0.32, L.hair, R * 0.06); } }
  else { g.beginPath(); g.ellipse(hx, hy - R * 0.5, R * 0.9, R * 0.5, 0, Math.PI, TAU); g.fill(); g.stroke(); }
  // hat
  if (L.hat === 3) { rrect(g, hx - R * 0.95, hy - R * 1.0, R * 1.9, R * 0.5, R * 0.2, C.red, R * 0.07); rrect(g, hx - R * 0.2, hy - R * 0.8, R * 1.4, R * 0.25, R * 0.1, C.red, R * 0.07); }
  else if (L.hat === 4) { g.beginPath(); g.ellipse(hx, hy - R * 0.55, R * 0.95, R * 0.75, 0, Math.PI, TAU); shape(g, C.teal, R * 0.07); circle(g, hx, hy - R * 1.3, R * 0.2, C.cream, R * 0.06); }
  else if (L.hat === 5) { rrect(g, hx - R * 1.15, hy - R * 0.75, R * 2.3, R * 0.25, R * 0.1, C.woodDk, R * 0.07); rrect(g, hx - R * 0.75, hy - R * 1.35, R * 1.5, R * 0.7, R * 0.2, C.wood, R * 0.07); }
  else if (L.hat === 9) { rrect(g, hx - R * 1.25, hy - R * 0.8, R * 2.5, R * 0.28, R * 0.1, '#2a2030', R * 0.07); rrect(g, hx - R * 0.7, hy - R * 2.1, R * 1.4, R * 1.4, R * 0.12, '#2a2030', R * 0.07); g.fillStyle = C.copper; g.fillRect(hx - R * 0.7, hy - R * 1.05, R * 1.4, R * 0.22); }
  // face
  const blink = ((t + blinkSeed) % 3.3) < 0.12;
  const ey = hy + R * 0.05, ex = R * 0.36;
  g.strokeStyle = C.ink; g.fillStyle = C.ink; g.lineCap = 'round'; g.lineWidth = R * 0.1;
  if (mood === 'happy') { for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * ex, ey + R * 0.05, R * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }
  else if (blink) { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + s * ex - R * 0.12, ey); g.lineTo(hx + s * ex + R * 0.12, ey); g.stroke(); } }
  else for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * ex, ey, R * 0.11, 0, TAU); g.fill(); }
  if (mood === 'wait' || mood === 'cross') { // brows
    g.lineWidth = R * 0.09;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + s * (ex + R * 0.16), ey - R * (mood === 'cross' ? 0.32 : 0.26)); g.lineTo(hx + s * (ex - R * 0.14), ey - R * (mood === 'cross' ? 0.18 : 0.26)); g.stroke(); }
  }
  if (L.glasses) { g.lineWidth = R * 0.06; g.strokeStyle = C.ink; for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * ex, ey, R * 0.24, 0, TAU); g.stroke(); } g.beginPath(); g.moveTo(hx - ex + R * 0.24, ey); g.lineTo(hx + ex - R * 0.24, ey); g.stroke(); }
  g.fillStyle = 'rgba(230,110,100,.35)'; for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * R * 0.58, hy + R * 0.38, R * 0.15, 0, TAU); g.fill(); }
  const my = hy + R * 0.5;
  g.lineWidth = R * 0.1; g.strokeStyle = C.ink;
  if (mood === 'happy') { g.beginPath(); g.arc(hx, my - R * 0.1, R * 0.3, 0.1, Math.PI - 0.1); g.closePath(); shape(g, '#7a2a2a', R * 0.08); }
  else if (mood === 'ok') { g.beginPath(); g.arc(hx, my - R * 0.15, R * 0.22, 0.4, Math.PI - 0.4); g.stroke(); }
  else if (mood === 'wait') { g.beginPath(); g.moveTo(hx - R * 0.18, my); g.lineTo(hx + R * 0.18, my); g.stroke(); }
  else { g.beginPath(); g.arc(hx, my + R * 0.18, R * 0.22, Math.PI + 0.4, TAU - 0.4); g.stroke(); }
  if (L.tache) { g.fillStyle = L.hair === '#e8e8e8' ? '#f4f4f4' : L.hair; g.strokeStyle = C.ink; g.lineWidth = R * 0.05; g.beginPath(); g.ellipse(hx - R * 0.17, my - R * 0.16, R * 0.2, R * 0.09, 0.2, 0, TAU); g.ellipse(hx + R * 0.17, my - R * 0.16, R * 0.2, R * 0.09, -0.2, 0, TAU); g.fill(); g.stroke(); }
  return { hx, hy };
}

// The stall cat, curled at the end of the bench. Its ears and tail move; it looks up when a job is fixed.
export function cat(g, x, y, s, t, happy) {
  const tail = Math.sin(t * 2) * 0.4;
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.fillStyle = '#e39a4c';
  g.beginPath(); g.moveTo(16, 0); g.quadraticCurveTo(30 + tail * 10, -6, 28 + tail * 14, -22); g.lineWidth = 6; g.strokeStyle = C.ink; g.stroke(); g.lineWidth = 3.6; g.strokeStyle = '#e39a4c'; g.stroke();
  g.beginPath(); g.ellipse(0, -8, 20, 12, 0, 0, TAU); shape(g, '#e39a4c', 2);
  const hy = happy ? -26 : -20;
  g.beginPath(); g.moveTo(-18, hy - 4); g.lineTo(-14, hy - 16); g.lineTo(-8, hy - 8); g.moveTo(-2, hy - 8); g.lineTo(2, hy - 16); g.lineTo(4, hy - 4); shape(g, '#e39a4c', 2);
  g.beginPath(); g.ellipse(-7, hy, 12, 10, 0, 0, TAU); shape(g, '#e39a4c', 2);
  g.strokeStyle = '#b86a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, -16); g.lineTo(0, -4); g.moveTo(4, -15); g.lineTo(8, -4); g.stroke();
  g.fillStyle = C.ink; g.strokeStyle = C.ink; g.lineWidth = 1.5;
  const sleepy = !happy && (t % 6) > 2.5;
  for (const ex of [-11, -3]) { if (sleepy) { g.beginPath(); g.moveTo(ex - 2, hy); g.lineTo(ex + 2, hy); g.stroke(); } else { g.beginPath(); g.arc(ex, hy - 1, 1.6, 0, TAU); g.fill(); } }
  g.beginPath(); g.moveTo(-7, hy + 3); g.lineTo(-8, hy + 5); g.lineTo(-6, hy + 5); g.fill();
  g.restore();
}

// Hearts in the HUD.
export function heart(g, x, y, s, full) {
  g.beginPath(); g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3); g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  g.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3); g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
  shape(g, full ? C.red : 'rgba(58,34,22,.25)', 2);
  if (full) shine(g, x - s * 0.24, y + s * 0.28, s * 0.1, 0.7);
}
// A five-pointed star for ratings.
export function starShape(g, x, y, r, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, an = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(x + rr * Math.cos(an), y + rr * Math.sin(an)); }
  g.closePath(); shape(g, fill, Math.max(1, r * 0.22));
}
// The goal icons: fix (a wrench), list (a ticket), coins, time (a clock face) and safe (a heart).
export function goalIcon(g, kind, x, y, r, t = 0) {
  if (kind === 'coins') return coin(g, x, y, r);
  if (kind === 'safe') return heart(g, x, y - r, r * 1.8, true);
  if (kind === 'time') { circle(g, x, y, r, C.cream, Math.max(1.4, r * 0.16)); g.strokeStyle = C.ink; g.lineWidth = Math.max(1.4, r * 0.15); g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - r * 0.65); g.moveTo(x, y); g.lineTo(x + r * 0.5, y + r * 0.15); g.stroke(); return; }
  if (kind === 'list') { rrect(g, x - r * 0.75, y - r, r * 1.5, r * 2, r * 0.2, C.cream, Math.max(1.4, r * 0.15)); g.strokeStyle = C.ink; g.lineWidth = Math.max(1, r * 0.12); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - r * 0.4, y - r * 0.45 + i * r * 0.45); g.lineTo(x + r * 0.45, y - r * 0.45 + i * r * 0.45); g.stroke(); } return; }
  // fix: a wrench
  g.save(); g.translate(x, y); g.rotate(-Math.PI / 4);
  g.beginPath(); g.roundRect(-r * 0.22, -r * 0.3, r * 0.44, r * 1.25, r * 0.2); shape(g, C.steelLt, Math.max(1.2, r * 0.14));
  g.beginPath(); g.arc(0, -r * 0.55, r * 0.5, rad(-60), rad(240)); g.lineTo(-r * 0.12, -r * 0.75); g.lineTo(r * 0.12, -r * 0.75); g.closePath(); shape(g, C.steelLt, Math.max(1.2, r * 0.14));
  g.restore();
}
export function coin(g, x, y, r) { circle(g, x, y, r, C.brass, Math.max(1.2, r * 0.18)); circle(g, x, y, r * 0.62, C.brassLt, 0); g.fillStyle = C.brassDk; g.font = `bold ${r * 1.1}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('c', x, y + r * 0.05); }
export { circle, rrect, star, shape };
