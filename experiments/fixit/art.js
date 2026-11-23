// Fix-It Stall: every picture, drawn in code. Objects are drawn in object-local units (the bench box is 100 x 100);
// people, the stall and the cat in CSS pixels. Nothing here changes game state.
import { ghost } from './moves.js';

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

// ---------- the nine objects. Each draws its own repair's progress; w is the "it works" moment, 0..1.
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
  g.stroke(); g.setLineDash([]);
  // arrowhead at the end of the path, so the way to go is plain
  const end = gd.type === 'circle' ? null : gd.type === 'arc' ? [gd.cx + Math.cos(rad(gd.to)) * gd.r, gd.cy + Math.sin(rad(gd.to)) * gd.r, rad(gd.to + 90)]
    : gd.type === 'flick' ? [gd.cx + Math.cos(rad(350)) * gd.r, gd.cy + Math.sin(rad(350)) * gd.r, rad(80)]
    : gd.type === 'drag' || gd.type === 'swipe' ? [gd.to[0], gd.to[1], Math.atan2(gd.to[1] - gd.from[1], gd.to[0] - gd.from[0])] : null;
  if (end) { g.fillStyle = 'rgba(255,255,255,.8)'; g.save(); g.translate(end[0], end[1]); g.rotate(end[2]); g.beginPath(); g.moveTo(5, 0); g.lineTo(-4, -5); g.lineTo(-4, 5); g.closePath(); g.fill(); g.restore(); }
  if (tap && gd.all) for (const a of gd.all) { g.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 8)})`; g.lineWidth = 2.5; g.beginPath(); g.arc(a[0], a[1], 13 + 2 * Math.sin(t * 8), 0, TAU); g.stroke(); }
  // the fingertip itself
  const [x, y] = p;
  if (press) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x, y, 12 + (tap ? 6 * ((t * 4) % 1) : 0), 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,248,235,.92)'; g.strokeStyle = 'rgba(58,34,22,.8)'; g.lineWidth = 1.8;
  g.beginPath(); g.ellipse(x + 2, y + 8, 6.5, 9, -0.25, 0, TAU); g.fill(); g.stroke(); // finger pad
  g.beginPath(); g.roundRect(x - 2, y + 12, 11, 18, 5); g.fill(); g.stroke(); // the rest of the finger, below and out of the way
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
export function coin(g, x, y, r) { circle(g, x, y, r, C.brass, Math.max(1.2, r * 0.18)); circle(g, x, y, r * 0.62, C.brassLt, 0); g.fillStyle = C.brassDk; g.font = `bold ${r * 1.1}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('c', x, y + r * 0.05); }
export { circle, rrect, star, shape };
