// Look: a night sky. Each thanks is a star; a finished day is a small constellation.
const dust = Array.from({ length: 140 }, (_, i) => ({ x: (i * 0.61803) % 1, y: (i * 0.41421 + (i % 7) * 0.09) % 1, s: 0.5 + (i % 5) * 0.22, p: i * 1.7 }));
export function background(g, w, h, time, band, pan) {
  const b = g.createLinearGradient(0, 0, 0, h); b.addColorStop(0, '#050d1f'); b.addColorStop(0.55, '#0c2140'); b.addColorStop(1, '#1b3f5e'); g.fillStyle = b; g.fillRect(0, 0, w, h);
  g.save(); g.translate(w * 0.5 + pan * 0.05, h * 0.3); g.rotate(-0.45); g.scale(1, 0.28);
  const m = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.9); m.addColorStop(0, 'rgba(150,180,220,.16)'); m.addColorStop(1, 'rgba(150,180,220,0)'); g.fillStyle = m; g.fillRect(-w * 2, -h * 2, w * 4, h * 4); g.restore();
  for (const d of dust) { const x = (((d.x * w * 1.6 + pan * 0.12 * d.s) % (w * 1.6)) + w * 1.6) % (w * 1.6) - w * 0.3; g.fillStyle = `rgba(215,232,255,${0.18 + 0.16 * Math.sin(time / 1900 + d.p)})`; g.fillRect(x, d.y * h * 0.78, d.s, d.s); }
}
export function cluster(g, ps, time, o) {
  if (ps.length === 3) { g.strokeStyle = o.today ? 'rgba(255,236,190,.5)' : 'rgba(210,225,255,.22)'; g.lineWidth = 1; g.beginPath(); ps.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.stroke(); }
  g.globalCompositeOperation = 'lighter';
  for (const p of ps) {
    const tw = 0.78 + 0.22 * Math.sin(time / 900 + p.phase), r = p.size * 2.6 * (o.today ? 1.25 : 1), warm = p.hue < 0.62, c = warm ? '255,226,170' : '185,214,255';
    const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4.2); halo.addColorStop(0, `rgba(${c},${0.55 * tw})`); halo.addColorStop(0.25, `rgba(${c},${0.16 * tw})`); halo.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = halo; g.beginPath(); g.arc(p.x, p.y, r * 4.2, 0, 7); g.fill();
    g.strokeStyle = `rgba(${c},${0.5 * tw})`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(p.x - r * 2.6, p.y); g.lineTo(p.x + r * 2.6, p.y); g.moveTo(p.x, p.y - r * 2.6); g.lineTo(p.x, p.y + r * 2.6); g.stroke();
    g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(p.x, p.y, r * 0.55, 0, 7); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}
