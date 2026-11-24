// The instrument is drawn in the same coordinate space as the optical model.
const LOOKS = {
  nocturne: { bg: '#080f1c', edge: '#182b3d', plate: '#101d2d', metal: '#9eafbb', ink: '#556c79', glass: '#b9edf3' },
  oxide: { bg: '#171318', edge: '#45312e', plate: '#261e22', metal: '#c6ad96', ink: '#927b6b', glass: '#f0d8b8' },
};
const SPECTRUM = ['#ff6260', '#ffb95c', '#a9ed83', '#76e5e3', '#75aaff', '#c596ff'];
const CX = 180, CY = 196, R = 146;
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
function path(ctx, points) {
  if (!points?.length) return false;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  return true;
}
function screw(ctx, x, y, palette) {
  circle(ctx, x, y, 3.7, '#080e15', palette.ink, 0.8);
  circle(ctx, x - .4, y - .5, 2.1, palette.metal);
  ctx.strokeStyle = '#384650'; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(x - 1.4, y + .9); ctx.lineTo(x + 1.2, y - 1.1); ctx.stroke();
}

export function draw(ctx, state, optics, timeSeconds, look = 'nocturne') {
  const p = LOOKS[look] || LOOKS.nocturne;
  ctx.save();
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, 360, 400);
  const haze = ctx.createRadialGradient(180, 185, 16, 180, 195, 225);
  haze.addColorStop(0, p.edge); haze.addColorStop(1, p.bg);
  ctx.fillStyle = haze; ctx.fillRect(0, 0, 360, 400);

  // The recessed circular dial and its engraved degree marks.
  circle(ctx, CX, CY + 3, 156, '#050a10');
  circle(ctx, CX, CY, 155, p.plate, p.edge, 2);
  circle(ctx, CX, CY, 151, null, p.metal, .65);
  circle(ctx, CX, CY, 139, '#0b1420', p.ink, .6);
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
    const [x, y] = polar(149, a); screw(ctx, x, y, p);
  }
  // Fine concentric grooves make the center feel like a rotating mount.
  circle(ctx, CX, CY, 61, '#0d1824', p.edge, 1);
  circle(ctx, CX, CY, 56, null, p.ink, .6);
  circle(ctx, CX, CY, 51, null, p.edge, 1);
  ctx.strokeStyle = p.ink; ctx.globalAlpha = .32; ctx.lineWidth = .6;
  ctx.beginPath(); ctx.moveTo(CX - 8, CY); ctx.lineTo(CX + 8, CY); ctx.moveTo(CX, CY - 8); ctx.lineTo(CX, CY + 8); ctx.stroke(); ctx.globalAlpha = 1;

  // Receivers sit on the outer rail. The colored sector is the actual angular window.
  for (const target of state.targets || []) {
    const color = target.band < 0 ? '#f2f5ef' : SPECTRUM[target.band] || '#f2f5ef';
    const half = Math.max(.016, target.width);
    ctx.lineCap = 'round';
    arc(ctx, R, target.angle - half, target.angle + half, '#05090e', 13);
    arc(ctx, R, target.angle - half, target.angle + half, p.metal, 9);
    arc(ctx, R, target.angle - half, target.angle + half, '#101820', 6.5);
    ctx.globalAlpha = target.lit ? 1 : .7;
    arc(ctx, R, target.angle - half, target.angle + half, color, target.band < 0 ? 2 : 4);
    ctx.globalAlpha = 1;
    if (target.charge > 0 || target.lit) {
      ctx.shadowColor = color; ctx.shadowBlur = target.lit ? 13 : 8;
      arc(ctx, R, target.angle - half, target.angle - half + 2 * half * (target.lit ? 1 : Math.min(1, target.charge)), color, 5);
      ctx.shadowBlur = 0;
    }
    if (target.band < 0) {
      // Each diode tests its own ray against the complete receiving aperture.
      for (let i = 0; i < 6; i++) {
        const diodeAngle = target.angle - half * .82 + i * half * 1.64 / 5;
        const [x, y] = polar(157, diodeAngle);
        const ray = (optics.rays || []).find(r => r.band === i);
        const delta = ray?.angle == null ? Infinity : Math.abs(Math.atan2(Math.sin(ray.angle - target.angle), Math.cos(ray.angle - target.angle)));
        const active = delta <= half;
        ctx.save();
        if (active) { ctx.shadowColor = SPECTRUM[i]; ctx.shadowBlur = 9; }
        circle(ctx, x, y, 3.1, active ? SPECTRUM[i] : '#111820', SPECTRUM[i], 1.2);
        if (active) circle(ctx, x, y, 1.1, '#ffffff');
        ctx.restore();
      }
    } else {
      const [x, y] = polar(156, target.angle);
      circle(ctx, x, y, 3.2, color, '#edf8fa', .8);
    }
  }

  // Fill only adjacent rays that leave nearly the same point in the same direction.
  // Matching path lengths excludes changes in internal reflection count.
  const rays = optics.rays || [];
  for (let i = 0; i < rays.length - 1; i++) {
    const a = rays[i].points, b = rays[i + 1].points;
    if (!a || !b || a.length !== b.length || a.length < 3) continue;
    const ap = a[a.length - 2], bp = b[b.length - 2], ae = a[a.length - 1], be = b[b.length - 1];
    if (Math.hypot(ap.x - bp.x, ap.y - bp.y) > 5 || Math.hypot(ae.x - be.x, ae.y - be.y) > 38) continue;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .11;
    ctx.fillStyle = SPECTRUM[i]; ctx.beginPath(); ctx.moveTo(ap.x, ap.y); ctx.lineTo(ae.x, ae.y); ctx.lineTo(be.x, be.y); ctx.lineTo(bp.x, bp.y); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // The ray paths come from the simulation, including internal reflections.
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const ray of optics.rays || []) {
    if (!path(ctx, ray.points)) continue;
    const color = SPECTRUM[ray.band] || '#e8f6ff';
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = color; ctx.globalAlpha = .10; ctx.lineWidth = 4; ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.stroke();
    ctx.globalAlpha = .82; ctx.lineWidth = 1.25; ctx.shadowBlur = 3; ctx.stroke(); ctx.restore();
  }
  // The common incident segment is white, independent of the number of bands.
  if (rays[0]?.points?.length > 1) {
    ctx.save(); ctx.strokeStyle = '#efffff'; ctx.globalAlpha = .9; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(rays[0].points[0].x, rays[0].points[0].y); ctx.lineTo(rays[0].points[1].x, rays[0].points[1].y); ctx.stroke(); ctx.restore();
  }
  // Source aperture, set above the incoming beam.
  const source = optics.source;
  if (source) {
    ctx.save(); ctx.translate(source.x, source.y);
    ctx.fillStyle = '#080d13'; ctx.fillRect(-9, -7, 11, 14);
    ctx.fillStyle = p.metal; ctx.fillRect(-5, -5, 5, 10);
    ctx.shadowColor = '#d9faff'; ctx.shadowBlur = 10; ctx.fillStyle = '#f2ffff'; ctx.fillRect(-1, -3, 2, 6); ctx.restore();
  }
  // Translucent prism leaves the simulated paths legible beneath its facets.
  const vertices = optics.vertices || [];
  if (vertices.length >= 3) {
    ctx.save();
    // A narrow offset rim makes the lower edge read as a ground bevel.
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length];
      if ((a.y + b.y) / 2 < CY) continue;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + 2, b.y + 4); ctx.lineTo(a.x + 2, a.y + 4); ctx.closePath();
      ctx.fillStyle = 'rgba(103,165,183,.32)'; ctx.fill(); ctx.strokeStyle = 'rgba(196,242,249,.55)'; ctx.lineWidth = .65; ctx.stroke();
    }
    path(ctx, vertices); ctx.closePath();
    const glass = ctx.createLinearGradient(CX - 35, CY - 40, CX + 35, CY + 40);
    glass.addColorStop(0, 'rgba(220,250,255,.28)'); glass.addColorStop(.5, 'rgba(146,211,229,.08)'); glass.addColorStop(1, 'rgba(202,241,248,.24)');
    ctx.fillStyle = glass; ctx.fill(); ctx.strokeStyle = 'rgba(226,250,255,.9)'; ctx.lineWidth = 1.35; ctx.stroke();
    const centroid = vertices.reduce((v, q) => ({x:v.x + q.x / vertices.length, y:v.y + q.y / vertices.length}), {x:0,y:0});
    // Inset edges follow the actual cut instead of inventing extra facets.
    ctx.beginPath(); vertices.forEach((v, i) => { const x = v.x * .92 + centroid.x * .08, y = v.y * .92 + centroid.y * .08; if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y); }); ctx.closePath();
    ctx.strokeStyle = 'rgba(232,253,255,.36)'; ctx.lineWidth = .7; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
