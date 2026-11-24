// Lantern Ripples: everything drawn over the water, on a 2D canvas laid on top of the WebGL canvas.
// Rocks and the other things in the river are drawn exactly as on the main game (experiments/lantern/index.html), then the
// main game's darkness is laid over them alone ('source-atop'), so a rock is exactly as readable as there. Embers and
// abilities come after the darkness, so they show through it, as there. The boat, flame and marks come from the main game's looks.js.
import { centre, half, fall, fog, wind, rain, dazzle, sight, boat, BOAT, POWERS, LAST, FIELD } from '../../lantern/sim.js';
import { hull, glow as flameGlow, mark, TINT, shine, halo, flood } from '../../lantern/looks.js';

export const FIRE = '255,170,80', BOAT_COL = '#6b4a2f';

// v: { W, H, unit, left, dpr }. o: { now, target, shake, glow, sparks, dawn, day, playing, flame, size, ox, oy }.
export function drawOver(g, s, v, o) {
  const { W, H, unit, left, dpr } = v, now = o.now;
  const sx = x => left + x * unit, sy = y => H * 0.74 - (y - s.y) * unit;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  g.setTransform(1, 0, 0, 1, o.ox, o.oy);
  const top = s.y + 0.74 * H / unit + 0.1, bot = s.y - 0.3 * H / unit - 0.1;
  // the waterfall: bands of white water across the river, sliding with the current
  g.strokeStyle = '#eaf6ff'; g.lineWidth = 3 * dpr;
  for (let i = Math.floor(bot * 14); i < top * 14; i++) {
    const y = i / 14 - (now / 260 % 1) / 14, f = fall(s, y); if (f <= 0) continue;
    const c = centre(s, y), h = half(s, y) - 0.01;
    g.globalAlpha = 0.15 + 0.5 * f; g.beginPath(); g.moveTo(sx(c - h), sy(y));
    for (let j = 1; j <= 8; j++) g.lineTo(sx(c - h + 2 * h * j / 8), sy(y + 0.012 * Math.sin(j * 2.1 + i)));
    g.stroke();
  }
  g.globalAlpha = 1;
  // fog banks and wind streaks lie on their stretch of river
  for (let i = Math.floor(bot * 5); i < top * 5; i++) {
    const y = i / 5, c = centre(s, y), h = half(s, y), wd = wind(s, y);
    if (fog(s, y)) for (const j of [0, 1]) {
      const fx = sx(c + (Math.sin(i * 7.3 + j * 2.1 + now / 4000) * 0.9) * h), fy = sy(y + 0.1 * j), fr = 0.2 * unit, fgr = g.createRadialGradient(fx, fy, 0, fx, fy, fr);
      fgr.addColorStop(0, 'rgba(200,210,220,.2)'); fgr.addColorStop(1, 'rgba(200,210,220,0)'); g.fillStyle = fgr; g.fillRect(fx - fr, fy - fr, 2 * fr, 2 * fr);
    }
    if (wd) { const k = ((i * 0.37 + now / 500 * wd) % 1 + 1) % 1, x = c - h + 2 * h * k; g.strokeStyle = 'rgba(220,235,245,.45)'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(sx(x), sy(y)); g.lineTo(sx(x + 0.09 * wd), sy(y + 0.01)); g.stroke(); }
  }
  // rocks and the other things in the water, as on the main game
  for (const k of s.rocks) {
    const x = sx(k.x), y = sy(k.y), R = k.rad * unit;
    if (y < -R * 4 || y > H + R * 4) continue;
    if (k.kind === 'log') { g.fillStyle = '#7a5632'; g.beginPath(); if (g.roundRect) g.roundRect(x - (k.len + k.rad) * unit, y - R, 2 * (k.len + k.rad) * unit, 2 * R, R); else g.rect(x - (k.len + k.rad) * unit, y - R, 2 * (k.len + k.rad) * unit, 2 * R); g.fill(); g.fillStyle = '#b08a5a'; g.fillRect(x - k.len * unit, y - R * 0.35, 2 * k.len * unit, R * 0.3); continue; }
    if (k.kind === 'pool') { g.strokeStyle = '#bfe0f2'; g.lineWidth = 2 * dpr; for (let i = 1; i <= 4; i++) { g.globalAlpha = 0.6 - i * 0.1; const a = -now / 260 + i * 1.3; g.beginPath(); g.arc(x, y, 0.04 * i * unit, a, a + 4.2); g.stroke(); } g.globalAlpha = 1; g.fillStyle = '#05080f'; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill(); continue; }
    if (k.kind === 'geyser') {
      if (k.on) { g.fillStyle = 'rgba(225,242,255,.9)'; g.beginPath(); g.arc(x, y, R * (1 + 0.08 * Math.sin(now / 50)), 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, R * 0.5, 0, 7); g.fill(); }
      else { g.strokeStyle = 'rgba(200,230,250,.7)'; g.lineWidth = 2 * dpr; g.setLineDash([4 * dpr, 6 * dpr]); g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke(); g.setLineDash([]); }
      continue;
    }
    if (k.kind === 'hidden' && k.y - s.y > 0.45) { g.strokeStyle = 'rgba(159,198,224,.3)'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(x, y, R * 0.8, 0, 7); g.stroke(); continue; }
    if (k.kind === 'spinner') { g.strokeStyle = 'rgba(159,198,224,.25)'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(sx(k.x0), sy(k.y0), k.a * unit, 0, 7); g.stroke(); }
    g.fillStyle = k.ice ? '#a9c9dc' : '#2b2f36'; g.beginPath(); g.ellipse(x, y, R, R * 0.86, 0, 0, 7); g.fill();
    g.fillStyle = k.ice ? '#e8f4fa' : k.kind === 'isle' ? '#4f8f5a' : '#59606b'; g.beginPath(); g.ellipse(sx(k.x - k.rad * 0.25), sy(k.y + k.rad * 0.3), R * 0.45, R * 0.3, -0.5, 0, 7); g.fill();
    g.strokeStyle = '#9fc6e0'; g.globalAlpha = 0.35; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, R * 1.18, 0.2, 2.9); g.stroke(); g.globalAlpha = 1;
    if (k.kind === 'chaser') { g.fillStyle = '#ff4030'; for (const e of [-0.35, 0.35]) { g.beginPath(); g.arc(x + e * R, y + R * 0.2, R * 0.16, 0, 7); g.fill(); } }
  }
  // the boat, drawn a little larger than it collides
  const bx = sx(s.x), by = sy(s.y), lean = Math.max(-0.5, Math.min(0.5, (o.target - s.x) * 4));
  g.save(); g.translate(bx, by); g.rotate(lean * 0.5); g.scale(o.size * 1.2, o.size * 1.2); hull(g, 'oak', unit, BOAT_COL, now / 1000); g.restore();
  // the darkness with a hole of light, laid only over what is drawn so far ('source-atop'); the water under it has its own, the same, in water.js
  const r = lightRadius(s, o, now) * unit, flash = dazzle(s) < 0, dark = darkness(s, o);
  const m = g.createRadialGradient(bx, by - 0.05 * unit, r * 0.15, bx, by - 0.05 * unit, r);
  m.addColorStop(0, 'rgba(4,6,12,0)'); m.addColorStop(0.7, `rgba(4,6,12,${dark * 0.55})`); m.addColorStop(1, `rgba(4,6,12,${dark})`);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = m; g.fillRect(-20, -20, W + 40, H + 40);
  const w = g.createRadialGradient(bx, by, 0, bx, by, r * 0.8); // the warm wash, on these shapes only (the water has its own)
  w.addColorStop(0, `rgba(${FIRE},${0.22 + o.glow * 0.2})`); w.addColorStop(1, `rgba(${FIRE},0)`); g.fillStyle = w; g.fillRect(bx - r, by - r, r * 2, r * 2);
  g.globalCompositeOperation = 'lighter';
  // embers show through the dark: you can see where light is before you can see what guards it
  for (const e of s.embers) if (!e.got) {
    const ex = sx(e.x), ey = sy(e.y) + Math.sin(now / 300 + e.y * 9) * 2 * dpr, er = 0.05 * unit;
    if (ey < -er || ey > H + er) continue;
    const eg = g.createRadialGradient(ex, ey, 0, ex, ey, er);
    if (e.kind === 'wisp') { const f = 0.45 + 0.5 * Math.abs(Math.sin(now / 70 + e.y * 5)); eg.addColorStop(0, `rgba(225,255,200,${f})`); eg.addColorStop(0.3, `rgba(150,235,110,${f * 0.6})`); eg.addColorStop(1, 'rgba(120,220,90,0)'); }
    else if (e.kind === 'heart') { eg.addColorStop(0, 'rgba(255,225,225,.95)'); eg.addColorStop(0.3, 'rgba(255,60,80,.7)'); eg.addColorStop(1, 'rgba(255,30,60,0)'); }
    else if (e.kind === 'shield') { eg.addColorStop(0, 'rgba(210,240,255,.95)'); eg.addColorStop(0.3, 'rgba(90,170,255,.6)'); eg.addColorStop(1, 'rgba(60,120,255,0)'); }
    else { eg.addColorStop(0, 'rgba(255,214,140,.95)'); eg.addColorStop(0.25, 'rgba(255,150,60,.55)'); eg.addColorStop(1, 'rgba(255,120,40,0)'); }
    g.fillStyle = eg; g.fillRect(ex - er, ey - er, er * 2, er * 2);
    shine(g, ex, ey, unit, e.kind === 'wisp' ? '150,235,110' : e.kind === 'heart' ? '255,60,80' : e.kind === 'shield' ? '90,170,255' : '255,150,60', e.kind === 'wisp' ? 0.25 : 0.45, now / 1000, e.y);
    if (e.kind === 'heart') { g.fillStyle = '#ff4d5e'; g.font = `${0.05 * unit}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', ex, ey); }
  }
  for (const p of o.sparks) { g.fillStyle = p.blue ? `rgba(150,210,255,${p.life})` : p.red ? `rgba(255,80,90,${p.life})` : `rgba(255,200,120,${p.life})`; g.fillRect(sx(p.x), sy(p.y), 3 * dpr, 3 * dpr); }
  // abilities waiting in the water: gold arrows boost, violet clock slow water, teal rings size, pink magnet, white sun flare
  for (const e of s.powers) if (!e.got) {
    const ex = sx(e.x), ey = sy(e.y) + Math.sin(now / 300 + e.y * 9) * 2 * dpr, er = 0.06 * unit, col = TINT[e.kind];
    if (ey < -er || ey > H + er) continue;
    const eg = g.createRadialGradient(ex, ey, 0, ex, ey, er); eg.addColorStop(0, `rgba(${col},.75)`); eg.addColorStop(0.35, `rgba(${col},.35)`); eg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = eg; g.fillRect(ex - er, ey - er, er * 2, er * 2); shine(g, ex, ey, unit, col, 0.4, now / 1000, e.y);
    mark(g, e.kind, ex, ey, 0.014 * unit, 2 * dpr, now / 1000);
  }
  // abilities in use: an arc round the boat that runs down with the time left
  let ring = 0.075;
  for (const [l, full, col] of POWERS.map(k => [s[k], LAST[k], k === 'size' && s.big ? '255,110,90' : TINT[k]])) if (l > 0) {
    g.strokeStyle = `rgba(${col},.85)`; g.lineWidth = 3 * dpr; g.beginPath(); g.arc(bx, by, ring * unit, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * l / full); g.stroke(); ring += 0.014;
  }
  if (s.field) { // the force field: a bubble round the boat, its arc running down with the time left
    const full = FIELD + 1.5 * s.st.barrier, R = 0.062 * unit * (1 + Math.sin(now / 160) * 0.04), fade = s.field < 1 && Math.floor(now / 110) % 2 ? 0.45 : 1;
    halo(g, bx, by, unit, fade, now / 1000);
    const bub = g.createRadialGradient(bx, by, R * 0.5, bx, by, R); bub.addColorStop(0, 'rgba(120,190,255,0)'); bub.addColorStop(1, `rgba(140,205,255,${0.35 * fade})`); g.fillStyle = bub; g.beginPath(); g.arc(bx, by, R, 0, 7); g.fill();
    g.strokeStyle = `rgba(170,220,255,${0.9 * fade})`; g.lineWidth = 2.5 * dpr; g.beginPath(); g.arc(bx, by, R, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * s.field / full); g.stroke();
  }
  if (s.safe > 0 && !s.boost && !s.field && Math.floor(now / 90) % 2) { // just after a blow the boat blinks blue
    halo(g, bx, by, unit, 0.5, now / 1000);
    g.strokeStyle = 'rgba(120,190,255,.5)'; g.lineWidth = 2.5 * dpr; g.beginPath(); g.arc(bx, by - 0.005 * unit, 0.06 * unit * (1 + Math.sin(now / 240) * 0.05), 0, 7); g.stroke();
  }
  // the flame itself
  const fr = 0.02 * unit, fg = g.createRadialGradient(bx, by, 0, bx, by, fr);
  fg.addColorStop(0, '#fff6dc'); fg.addColorStop(0.45, `rgba(${FIRE},.8)`); fg.addColorStop(1, `rgba(${FIRE},0)`);
  g.fillStyle = fg; g.fillRect(bx - fr, by - fr, 2 * fr, 2 * fr);
  flameGlow(g, o.flame, 'amber', bx, by, unit, FIRE, s.light, now / 1000);
  if (o.dawn > 0 || o.day > 0) flood(g, W, H, o.dawn, o.day);
  g.globalCompositeOperation = 'source-over';
  // boost: streaks of speed down the screen. slow water: a violet hush at the edges.
  if (o.playing && s.boost) { g.strokeStyle = `rgba(255,235,170,${0.5 * Math.min(1, s.boost * 2)})`; g.lineWidth = 2 * dpr; g.beginPath(); for (let i = 0; i < 18; i++) { const x = (Math.sin(i * 53.1) * 0.5 + 0.5) * W, y = ((Math.sin(i * 17.7) * 0.5 + 0.5) * H + now * 2.4 * dpr) % H; g.moveTo(x, y); g.lineTo(x, y + 46 * dpr); } g.stroke(); }
  if (o.playing && s.slow) { const q = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7); q.addColorStop(0, 'rgba(150,110,255,0)'); q.addColorStop(1, `rgba(150,110,255,${0.3 * Math.min(1, s.slow * 2)})`); g.fillStyle = q; g.fillRect(-20, -20, W + 40, H + 40); }
  // rain and lightning lie over everything
  if (o.playing && rain(s, s.y)) { g.strokeStyle = 'rgba(190,215,235,.4)'; g.lineWidth = 1.5 * dpr; g.beginPath(); for (let i = 0; i < 40; i++) { const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, y = ((Math.sin(i * 47.3) * 0.5 + 0.5) * H + now * 1.6 * dpr) % H; g.moveTo(x, y); g.lineTo(x - 5 * dpr, y + 16 * dpr); } g.stroke(); }
  if (flash) { g.fillStyle = 'rgba(235,240,255,.35)'; g.fillRect(-20, -20, W + 40, H + 40); }
}

// The light's radius in river units, with the main game's flicker; the water uses the same number.
export function lightRadius(s, o, now) { return (sight(s) + o.glow * 0.09) * (1 + Math.sin(now / 90) * 0.015 + Math.sin(now / 37) * 0.01); }
export function darkness(s, o) { return dazzle(s) < 0 ? 0.25 : Math.max(0, 0.97 - o.dawn * 0.75 - o.day); }
export const boatScale = s => boat(s) / BOAT;
