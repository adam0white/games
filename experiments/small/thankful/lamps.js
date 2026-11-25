// Look: paper lanterns on dark water. Each thanks is a lantern with its reflection; a day's three drift together.
export function background(g, w, h, time, band, pan) {
  const hz = band.top - 26, b = g.createLinearGradient(0, 0, 0, hz); b.addColorStop(0, '#120d1a'); b.addColorStop(1, '#3a2530'); g.fillStyle = b; g.fillRect(0, 0, w, hz);
  const glow = g.createRadialGradient(w * 0.5, hz, 0, w * 0.5, hz, w * 0.9); glow.addColorStop(0, 'rgba(255,170,90,.22)'); glow.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = glow; g.fillRect(0, 0, w, hz);
  g.fillStyle = '#0d0a12'; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= w + 40; x += 40) g.lineTo(x, hz - 7 - 9 * Math.sin((x - pan * 0.15) / 70) - 5 * Math.sin((x - pan * 0.15) / 23)); g.lineTo(w, hz); g.fill();
  const wb = g.createLinearGradient(0, hz, 0, h); wb.addColorStop(0, '#2a1d2a'); wb.addColorStop(0.5, '#141627'); wb.addColorStop(1, '#0a0f1c'); g.fillStyle = wb; g.fillRect(0, hz, w, h - hz);
  g.strokeStyle = 'rgba(255,190,120,.07)'; g.lineWidth = 1;
  for (let i = 0; i < 16; i++) { const y = hz + 10 + i * i * 2.2 + i * 9, sway = Math.sin(time / 2600 + i) * 14; g.beginPath(); g.moveTo(-20 + sway, y); g.lineTo(w * 0.4 + sway, y); g.moveTo(w * 0.55 - sway, y + 5); g.lineTo(w + 20 - sway, y + 5); g.stroke(); }
}
export function cluster(g, ps, time, o) {
  for (const p of [...ps].sort((a, b) => a.y - b.y)) {
    const depth = 0.7 + 0.5 * (p.y - o.band.top) / Math.max(1, o.band.bottom - o.band.top), s = p.size * 4.4 * depth * (o.today ? 1.15 : 1) * (o.zoom || 1), fl = 0.85 + 0.15 * Math.sin(time / 420 + p.phase * 3);
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 4); halo.addColorStop(0, `rgba(255,165,70,${0.34 * fl})`); halo.addColorStop(1, 'rgba(255,165,70,0)'); g.fillStyle = halo; g.beginPath(); g.arc(p.x, p.y, s * 4, 0, 7); g.fill();
    for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(255,180,95,${0.2 * fl * (1 - k / 5)})`; const wob = Math.sin(time / 700 + p.phase + k) * 1.5; g.beginPath(); g.ellipse(p.x + wob, p.y + s * 1.5 + k * s * 0.75, s * (0.9 - k * 0.12), s * 0.22, 0, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    const body = g.createLinearGradient(p.x, p.y - s, p.x, p.y + s); body.addColorStop(0, '#ffdf9c'); body.addColorStop(0.6, `hsl(${28 + p.hue * 14} 96% ${60 + 6 * fl}%)`); body.addColorStop(1, '#c9662a');
    g.fillStyle = body; g.beginPath(); g.moveTo(p.x - s * 0.62, p.y - s); g.lineTo(p.x + s * 0.62, p.y - s); g.lineTo(p.x + s * 0.8, p.y + s); g.lineTo(p.x - s * 0.8, p.y + s); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,250,225,.85)'; g.beginPath(); g.ellipse(p.x, p.y + s * 0.25, s * 0.2, s * 0.42 * fl, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3418'; g.fillRect(p.x - s * 0.95, p.y + s, s * 1.9, Math.max(1.2, s * 0.16));
  }
}
