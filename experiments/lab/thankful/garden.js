// Look: a night garden. Each thanks is a glowing flower; a day's three grow from one root.
const flies = Array.from({ length: 14 }, (_, i) => ({ x: (i * 0.377) % 1, y: (i * 0.713) % 1, p: i * 2.1 }));
export function background(g, w, h, time, band, pan) {
  const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, '#081c24'); b.addColorStop(0.5, '#12312e'); b.addColorStop(1, '#1d3a26'); g.fillStyle = b; g.fillRect(0, 0, w, h);
  const moon = g.createRadialGradient(w * 0.8, 70, 0, w * 0.8, 70, 150); moon.addColorStop(0, 'rgba(230,240,200,.35)'); moon.addColorStop(0.1, 'rgba(230,240,200,.1)'); moon.addColorStop(1, 'rgba(230,240,200,0)'); g.fillStyle = moon; g.fillRect(0, 0, w, 260);
  const hills = [['#143029', band.top - 34, 110, 16], ['#1a3a2c', band.top - 14, 70, 11], ['#21442f', band.top + 6, 150, 7]];
  hills.forEach(([c, y, wave, amp], n) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w + 20; x += 20) g.lineTo(x, y + amp * Math.sin((x - pan * (0.2 + n * 0.25)) / wave + n * 2)); g.lineTo(w, h); g.fill(); });
  g.globalCompositeOperation = 'lighter';
  for (const f of flies) { const x = f.x * w + Math.sin(time / 3100 + f.p) * 26, y = band.top + f.y * (band.bottom - band.top + 60) + Math.cos(time / 2700 + f.p) * 18, a = 0.25 + 0.25 * Math.sin(time / 600 + f.p); g.fillStyle = `rgba(220,255,150,${a})`; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over';
}
export function cluster(g, ps, time, o) {
  const rx = ps.reduce((n, p) => n + p.x, 0) / ps.length, ry = Math.max(...ps.map(p => p.y)) + o.radius * 0.9;
  g.strokeStyle = '#5f9a62'; g.lineWidth = 1.5; g.lineCap = 'round';
  for (const p of ps) { g.beginPath(); g.moveTo(rx, ry); g.quadraticCurveTo(rx, p.y + 4, p.x, p.y); g.stroke(); }
  g.fillStyle = '#4c8552'; g.beginPath(); g.ellipse(rx - 5, ry - 3, 6, 2.4, -0.6, 0, 7); g.ellipse(rx + 5, ry - 3, 6, 2.4, 0.6, 0, 7); g.fill();
  for (const p of ps) {
    const s = p.size * 4.2 * (o.today ? 1.2 : 1), sway = Math.sin(time / 1700 + p.phase) * 0.12, hue = [48, 330, 275, 190, 20][Math.floor(p.hue * 5)];
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 3.6); halo.addColorStop(0, `hsla(${hue},90%,75%,.4)`); halo.addColorStop(1, `hsla(${hue},90%,75%,0)`); g.fillStyle = halo; g.beginPath(); g.arc(p.x, p.y, s * 3.6, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `hsl(${hue} 78% 80%)`;
    for (let i = 0; i < 6; i++) { const a = sway + i * Math.PI / 3; g.beginPath(); g.ellipse(p.x + Math.cos(a) * s * 0.75, p.y + Math.sin(a) * s * 0.75, s * 0.62, s * 0.3, a, 0, 7); g.fill(); }
    g.fillStyle = '#fff6c2'; g.beginPath(); g.arc(p.x, p.y, s * 0.36, 0, 7); g.fill();
  }
}
