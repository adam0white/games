import { boat, centre, half, sight, speed, wind } from './sim.js?v=17';

const LOOKAHEAD = 0.9;
const clamp01 = n => Math.min(1, Math.max(0, n));

export const poolLead = s => s.gentle ? sight(s) * 0.22 : 0;

// Short breaks in the water give the nearest hazards an edge even with an almost empty flame.
// Both views draw the same river-space marks through their own projection.
export function drawHazards(g, s, at, pixel) {
  const slow = s.slow ? 0.5 : 1;
  const advance = speed(s) * slow;
  const flow = slow * (s.boost ? 1.8 : 1) * s.calm;
  const drift = wind(s, s.y) * 0.22;
  const margin = boat(s);
  const fade = seconds => clamp01((LOOKAHEAD - seconds) / 0.35);
  const stroke = (points, alpha) => {
    if (alpha <= 0) return;
    g.strokeStyle = `rgba(182,219,224,${alpha})`;
    g.beginPath();
    g.moveTo(...at(...points[0]));
    for (let i = 1; i < points.length; i++) g.lineTo(...at(...points[i]));
    g.stroke();
  };

  g.save();
  g.lineCap = 'round';
  g.lineWidth = 1.8 * pixel;
  for (const k of s.rocks) {
    if (!k.on || k.y - k.rad < s.y - 0.015) continue;
    const rockSpeed = k.vy * flow + k.b * k.wy * Math.cos(s.t * k.wy + k.ph + k.phy);
    const distance = Math.max(0, k.y - s.y - k.rad - margin);
    const seconds = distance / Math.max(0.05, advance - rockSpeed);
    if (seconds >= LOOKAHEAD) continue;
    const x = k.a ? k.x0 + k.a * Math.sin((s.t + seconds) * k.w + k.ph) : k.x;
    const clearance = Math.abs(x - s.x - drift * seconds) - k.len - k.rad - margin;
    const threat = clamp01((0.17 - clearance) / 0.12);
    const alpha = 0.48 * fade(seconds) * (k.opening ? Math.max(0.65, threat) : threat);
    if (alpha <= 0) continue;
    const r = k.rad + 0.012;
    const points = [];
    for (let i = 0; i <= 8; i++) {
      const a = 0.15 + i * (Math.PI - 0.3) / 8;
      const dx = Math.cos(a);
      points.push([k.x + Math.sign(dx) * k.len + r * dx, k.y - r * Math.sin(a)]);
    }
    stroke(points, alpha);
  }

  g.lineWidth = 1.4 * pixel;
  for (const side of [-1, 1]) {
    const point = seconds => {
      const y = s.y + advance * seconds;
      return [centre(s, y) + side * (half(s, y) - 0.01), y];
    };
    for (let i = 1; i <= 9; i++) {
      const t0 = (i - 1) * 0.1, t1 = i * 0.1, seconds = (t0 + t1) / 2;
      const [x] = point(seconds);
      const clearance = side * (x - s.x - drift * seconds) - margin;
      stroke([point(t0), point(t1)], 0.31 * fade(seconds) * clamp01((0.065 - clearance) / 0.065));
    }
  }
  g.restore();
}
