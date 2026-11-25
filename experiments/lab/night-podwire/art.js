// Procedural two-colour botanical plate. All distances are in board units.
import { cueOf, cueWait, podX, plates, COUNT, DOUBLE_WINDOW } from './sim.js';

export const PEG_Y = 304; // brass fret pegs sit under the wire; a tap there clamps the wire above
export const PEG_REACH = 24;

const palettes = {
  herbarium: {
    paper: '#f5efde', disc: '#e6d9b6', ring: '#b6a777', speck: '#a29574',
    ink: '#263a31', wood: '#556e51', leaf: '#809572', leafBack: '#adba92',
    blush: '#b65132', shell: '#d98a4e', ridge: '#f7c78c', brass: '#b69350',
    glint: '#fff4ca', shadow: '#9c9076'
  },
  blueprint: {
    paper: '#15374b', disc: '#244a5b', ring: '#5a8589', speck: '#6b979c',
    ink: '#c4e4d5', wood: '#79a9a0', leaf: '#356c71', leafBack: '#285763',
    blush: '#ffb477', shell: '#995e4b', ridge: '#f1be91', brass: '#9f8f66',
    glint: '#fff0c2', shadow: '#0c2330'
  }
};

const TAU = Math.PI * 2;
const paperCache = new WeakMap();
const podForms = [
  // Width, length and half-widths at five points down the pod.
  {w: 23, h: 56, ribs: [.12, .75, 1, .93, .51]}, // poppy urn
  {w: 24, h: 46, ribs: [.08, .85, 1, .84, 0]}, // honesty silicle
  {w: 17, h: 33, ribs: [.12, .82, 1, .71, .05]}, // flax capsule
  {w: 16, h: 66, ribs: [.21, .86, 1, .59, 0]}, // milkweed follicle
  {w: 21, h: 54, ribs: [.2, .8, 1, .65, .16]}, // inflated capsule
  {w: 15, h: 57, ribs: [.15, .92, 1, .68, .03]}, // cluster of follicles
  {w: 26, h: 40, ribs: [.3, .9, 1, .9, .3]} // inflated calyx that rattles at one pitch
];
// A tuned pod hangs clear of the wire: only its harmonic opens it, never a touch.
const hang = pod => pod.type === 'tuned' ? 66 : pod.height;

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function line(c, x, y, x2, y2, color, width = 1) {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x2, y2);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

function ellipse(c, x, y, rx, ry, fill, stroke, width = 1, angle = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, angle, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}

function leaf(c, p, x, y, angle, len, width, turned) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(len * .27, -width, len * .66, -width * .82, len, -2);
  c.bezierCurveTo(len * .73, width * .5, len * .33, width * .86, 0, 0);
  c.fillStyle = turned ? p.leafBack : p.leaf;
  c.fill();
  c.strokeStyle = p.ink;
  c.lineWidth = .92;
  c.stroke();
  for (let i = 1; i < 11; i++) {
    const t = i / 13;
    const reach = width * Math.sin(Math.PI * t);
    line(c, t * len, -2 * t, (t + .085) * len, -2 * t - reach * .62, p.ink, .47);
    line(c, t * len, -2 * t, (t + .095) * len, -2 * t + reach * .48, p.ink, .39);
  }
  line(c, 0, 0, len - 1, -2, p.ink, .66);
  c.restore();
}

function foliage(c, p, kind, x, y, angle, len, width, turned) {
  if (kind === 4) {
    // Fine divided leaves grow either side of a single needle-like stem.
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    line(c, 0, 0, len, -1, p.wood, 1.4);
    for (let i = 1; i < 6; i++) {
      const t = i / 7;
      for (const side of [-1, 1]) {
        const span = width * Math.sin(Math.PI * t);
        line(c, t * len, -t, (t + .19) * len, side * span, p.ink, .85);
        line(c, (t + .09) * len, side * span * .5, (t + .11) * len, side * span * 1.15, p.wood, .8);
      }
    }
    c.restore();
  } else if (kind === 5) {
    for (let i = -1; i <= 1; i++) {
      leaf(c, p, x, y, angle + i * .47, len * (i === 0 ? .9 : .63), width * .64, turned || i === -1);
    }
  } else {
    const breadth = [1, 1.52, .4, 1.3][kind];
    leaf(c, p, x, y, angle, len, width * breadth, turned);
  }
}

function twigY(x) {
  const t = (x - 11) / 335;
  return 152 - 77 * Math.sin(t * 2.51) - t * 37;
}

function plate(c, s, p) {
  c.fillStyle = p.paper;
  c.fillRect(0, 0, 360, 380);
  const rng = random(s.seed ^ 0xb927c2);
  ellipse(c, 183, 147, 112, 111, p.disc);
  ellipse(c, 179, 146, 119, 119, null, p.ring, .45);
  // An offset screen of tiny ink flecks gives large flat colours a grain.
  c.fillStyle = p.speck;
  for (let i = 0; i < 2600; i++) {
    const x = rng() * 360, y = rng() * 380;
    c.globalAlpha = .07 + rng() * .16;
    c.fillRect(x, y, .42 + rng() * .65, .32 + rng() * .5);
  }
  c.globalAlpha = 1;

  // The parent spray comes from the left. Hanging stems meet the same curve.
  const start = 10, end = 346;
  c.beginPath();
  for (let x = start; x <= end; x += 2) {
    if (x === start) c.moveTo(x, twigY(x));
    else c.lineTo(x, twigY(x));
  }
  for (let x = end; x >= start; x -= 2) {
    const thickness = 4.4 * (1 - (x - start) / (end - start));
    c.lineTo(x, twigY(x) + thickness);
  }
  c.closePath();
  c.fillStyle = p.wood;
  c.fill();
  c.strokeStyle = p.ink;
  c.lineWidth = .9;
  c.stroke();
  c.lineCap = 'round';
  for (let x = start + 4; x < end - 36; x += 6) {
    line(c, x, twigY(x) + 1.8, x + 2, twigY(x + 2) + 1, p.ink, .41);
  }
  const leafSprays = [
    [34, -1.24, 24, 7], [46, .72, 37, 10], [69, -1.14, 42, 12],
    [88, .56, 32, 8], [107, -1.0, 27, 8], [145, -1.16, 38, 9],
    [166, -.62, 28, 8], [209, -1.18, 27, 7], [232, .75, 33, 9],
    [254, -.6, 39, 10], [289, .76, 31, 7], [306, -.54, 33, 7], [325, .35, 24, 5]
  ];
  for (const [i, [x, angle, len, w]] of leafSprays.entries()) {
    foliage(c, p, (s.level - 1) % 6, x, twigY(x), angle, len, w, i % 3 === 0);
  }
  for (const pod of s.pods) if (!pod.swing) stem(c, p, pod, pod.x);
}

function stem(c, p, pod, x) {
  {
    const f = podForms[pod.kind], top = 250 - hang(pod) - f.h;
    const origin = Math.max(14, (pod.x0 ?? pod.x) - 33);
    c.beginPath();
    c.moveTo(origin, twigY(origin));
    c.bezierCurveTo(origin + 32, twigY(origin) + 6, x - 5, top - 18, x, top + 1);
    c.strokeStyle = p.ink;
    c.lineWidth = 2.3;
    c.stroke();
    c.strokeStyle = p.wood;
    c.lineWidth = 1.15;
    c.stroke();
    leaf(c, p, x - 4, top - 13, 2.65, 20, 5, true);
    leaf(c, p, x - 4, top - 14, -.61, 22, 6, false);
  }
}

function belly(f, t) {
  const z = t * 4;
  const i = Math.min(3, Math.floor(z));
  const a = f.ribs[i], b = f.ribs[i + 1];
  const left = f.ribs[Math.max(0, i - 1)], right = f.ribs[Math.min(4, i + 2)];
  const v = z - i;
  // Cubic interpolation gives the thin tips a clean join with their stems.
  return f.w * .5 * ((2 * a) + (-left + b) * v +
    (2 * left - 5 * a + 4 * b - right) * v * v + (-left + 3 * a - 3 * b + right) * v * v * v);
}

function pod(c, p, item, t, x = item.x) {
  const f = podForms[item.kind];
  const top = 250 - hang(item) - f.h;
  const age = Math.max(0, t - item.openedAt);
  const split = item.open ? 1 - Math.exp(-age * 13) : 0;
  c.save();
  c.translate(x, top);
  // A tuned pod shivers while its harmonic rings; a cracked pod shows the split it is waiting to finish.
  if (!item.open && item.type === 'tuned' && item.ring > .5) c.rotate(Math.sin(t * 60) * Math.min(.08, item.ring / item.height * .05));
  for (const side of [-1, 1]) {
    c.save();
    c.rotate(-side * split * .73);
    c.beginPath();
    c.moveTo(0, 0);
    for (let j = 0; j <= 32; j++) {
      const v = j / 32;
      c.lineTo(side * belly(f, v), f.h * v);
    }
    c.lineTo(side * split * 3, f.h);
    c.quadraticCurveTo(side * split * 7, f.h * .48, 0, 0);
    c.closePath();
    c.fillStyle = item.open ? p.leafBack : side === -1 ? p.shell : p.blush;
    if (item.kind === 1 && !item.open) c.fillStyle = side === -1 ? p.ridge : p.brass;
    c.fill();
    c.lineWidth = 1;
    c.strokeStyle = p.ink;
    c.stroke();

    for (let i = 1; i <= 3; i++) {
      const fraction = (i + .15) / 4;
      c.beginPath();
      for (let j = 1; j <= 25; j++) {
        const v = j / 26;
        const x = side * belly(f, v) * fraction;
        if (j === 1) c.moveTo(x, v * f.h);
        else c.lineTo(x, v * f.h);
      }
      c.lineWidth = i === 1 ? 1.05 : .53;
      c.strokeStyle = i === 1 || (!item.open && side === 1 && i === 3) ? p.ridge : p.ink;
      c.stroke();
    }

    if (item.kind === 1 && !item.open) {
      for (let k = 1; k <= 2; k++) {
        ellipse(c, side * (4 + k * 2), f.h * (.18 + k * .19), 2.6, 3.7, p.brass, p.ink, .66, side * .5);
      }
    }
    for (let j = 2; j < 23; j++) {
      const v = j / 25, r = belly(f, v);
      line(c, side * r * .56, f.h * v, side * r * .92, f.h * v - 2.7, p.ink, .5);
      if (item.kind === 3 && j % 2 === 0) {
        line(c, side * r, f.h * v, side * (r + 3.4), f.h * v - 3.5, p.ink, .8);
      }
    }
    c.restore();
  }

  if (item.kind === 0) {
    // The stigmatic disc points down with the suspended poppy capsule.
    for (const side of [-1, 1]) {
      c.save();
      c.rotate(-side * split * .73);
      ellipse(c, side * 6, f.h - 2, 7.2, 2.5, p.shell, p.ink, .8);
      for (let k = 0; k < 3; k++) {
        const x = side * (3 + k * 3);
        line(c, x, f.h - 4, x + side, f.h - 1, p.ink, .6);
      }
      c.restore();
    }
  } else if (item.kind === 4 || item.kind === 5) {
    for (const side of [-1, 1]) {
      c.save();
      c.rotate(-side * split * .73);
      c.beginPath();
      c.moveTo(side * 2, f.h);
      c.quadraticCurveTo(side * 9, f.h - 4, side * 12, f.h - 10);
      c.strokeStyle = p.ink;
      c.lineWidth = 1.4;
      c.stroke();
      c.restore();
    }
  }
  if (!item.open) {
    ellipse(c, 0, f.h - .4, 1.9, 1.2, p.glint, p.ink, .6);
    if (item.crackedAt != null) {
      // The first crest split the seam; it closes again unless a second crest comes soon.
      c.globalAlpha = Math.max(0, 1 - (t - item.crackedAt) / DOUBLE_WINDOW);
      line(c, 0, f.h * .15, 0, f.h * .98, p.glint, 2.6);
      line(c, 0, f.h * .15, 0, f.h * .98, p.blush, 1.2);
      c.globalAlpha = 1;
    }
    if (item.type === 'tuned') {
      // Rings beside the calyx: how strongly its harmonic sounds (all lit means it is about to open).
      const level = Math.min(1, (item.ring || 0) / item.height);
      for (let k = 1; k <= item.mode; k++) {
        const r = f.w * .5 + 3 + k * 4;
        c.beginPath();
        c.arc(0, f.h * .5, r, -.9, .9);
        c.moveTo(-r * Math.cos(.9), f.h * .5 - r * Math.sin(.9));
        c.arc(0, f.h * .5, r, Math.PI + .9, Math.PI - .9, true);
        c.strokeStyle = k / item.mode <= level + .02 ? p.blush : p.ring;
        c.lineWidth = 1.5;
        c.stroke();
      }
    }
  }
  c.restore();
}

function seeds(c, p, item, age, seed, px = item.x) {
  if (age < 0 || age > 3) return;
  const rng = random(seed ^ Math.round(item.x * 197));
  const alpha = Math.min(1, (3 - age) * 1.8);
  c.save();
  c.globalAlpha = alpha;
  for (let i = 0; i < 21; i++) {
    const angle = .24 + rng() * (Math.PI - .48);
    const speed = 24 + rng() * 82, flutter = rng() * TAU;
    const x = px + Math.cos(angle) * speed * age + 8 * age * Math.sin(age * 4 + flutter);
    const y = 250 - hang(item) - 15 - Math.sin(angle) * speed * age + 32 * age * age;
    const tilt = flutter + age * 3;
    ellipse(c, x, y, 1.15, 2.1, i % 3 ? p.ink : p.blush, null, 0, tilt);
    c.save();
    c.translate(x, y);
    c.rotate(tilt);
    line(c, 0, -1, 1, -5.5, p.wood, .55);
    for (let k = -2; k <= 2; k++) line(c, 1, -5.5, k * 1.7, -8.3 + Math.abs(k), p.wood, .44);
    c.restore();
  }
  c.restore();
}

const X = i => 24 + 312 * i / (COUNT - 1);
function trace(c, u, offset, colour, width) {
  c.beginPath();
  for (let i = 0; i < u.length; i++) {
    if (i === 0) c.moveTo(X(i), 250 + u[i] + offset);
    else c.lineTo(X(i), 250 + u[i] + offset);
  }
  c.strokeStyle = colour;
  c.lineWidth = width;
  c.stroke();
}
function heightAt(u, x) {
  const n = (x - 24) * (u.length - 1) / 312;
  const i = Math.min(u.length - 2, Math.max(0, Math.floor(n)));
  return 250 + u[i] + (u[i + 1] - u[i]) * (n - i);
}

// The standing-wave shape a tuned pod listens for, drawn faintly along the wire with its still points.
function modeGhost(c, p, s, pod) {
  const level = Math.min(1, (pod.ring || 0) / pod.height);
  c.save();
  c.globalAlpha = .35 + .5 * level;
  c.setLineDash([1.5, 3]);
  for (const sign of [-1, 1]) {
    c.beginPath();
    for (let i = 0; i < COUNT; i++) {
      const y = 250 + sign * 11 * Math.sin(pod.mode * Math.PI * i / (COUNT - 1));
      if (i === 0) c.moveTo(X(i), y); else c.lineTo(X(i), y);
    }
    c.strokeStyle = p.blush;
    c.lineWidth = .9;
    c.stroke();
  }
  c.setLineDash([]);
  for (let k = 1; k < pod.mode; k++) {
    const x = 24 + 312 * k / pod.mode;
    ellipse(c, x, 250, 2.6, 2.6, p.paper, p.blush, 1.1);
  }
  c.restore();
}

function fittings(c, s, p, u) {
  const spec = plates[s.level - 1];
  if (spec.heavy) {
    // A heavier stretch: the wire is wrapped in a twisted bine.
    const [a, b] = spec.heavy;
    c.save();
    c.setLineDash([3, 2.2]);
    c.beginPath();
    for (let x = a; x <= b; x += 3) { const y = heightAt(u, x); if (x === a) c.moveTo(x, y); else c.lineTo(x, y); }
    c.strokeStyle = p.wood;
    c.lineWidth = 6.2;
    c.stroke();
    c.restore();
  }
  if (spec.felt) {
    const [a, b] = spec.felt;
    for (let x = a; x <= b; x += 5.5) {
      const y = heightAt(u, x);
      ellipse(c, x, y, 4.4, 5.6, p.leafBack, p.ink, .55, (x * 7 % 3 - 1) * .3);
    }
  }
  for (const [x, m] of spec.beads || []) {
    const y = heightAt(u, x), r = 3 + m * .55;
    ellipse(c, x + .8, y + 1.4, r, r, p.shadow);
    ellipse(c, x, y, r, r, p.ridge, p.ink, 1.1);
    ellipse(c, x - r * .35, y - r * .35, r * .3, r * .22, p.glint);
  }
  if (spec.bridge) {
    const [x] = spec.bridge, y = heightAt(u, x);
    c.beginPath();
    c.moveTo(x - 4, y + 2);
    c.lineTo(x + 4, y + 2);
    c.lineTo(x + 10, 292);
    c.lineTo(x - 10, 292);
    c.closePath();
    c.fillStyle = p.wood;
    c.fill();
    c.strokeStyle = p.ink;
    c.lineWidth = 1;
    c.stroke();
    line(c, x - 14, 292, x + 14, 292, p.ink, 1.6);
  }
}

function fretsAndEnds(c, s, p, u) {
  for (const f of s.frets || []) {
    const x = X(f.i);
    // Lever from the peg up to the clamp on the wire.
    c.save();
    c.setLineDash([2, 2.5]);
    line(c, x, PEG_Y - 8, x, 262, p.wood, 1.1);
    c.restore();
    if (f.on) {
      line(c, x - 5, 250, x + 5, 250, p.ink, 4.4);
      line(c, x - 4, 250, x + 4, 250, p.brass, 2.2);
      line(c, x, 244, x, 256, p.ink, 1.4);
    } else {
      line(c, x - 4, 262, x + 4, 262, p.brass, 2);
    }
    ellipse(c, x + .8, PEG_Y + 1.6, 9, 9, p.shadow);
    ellipse(c, x, PEG_Y, 9, 9, f.on ? p.blush : p.brass, p.ink, 1.3);
    ellipse(c, x, PEG_Y, 3.6, 3.6, f.on ? p.glint : p.ridge, p.ink, .7);
  }
  for (const x of s.free ? [24] : [24, 336]) {
    ellipse(c, x + .8, 251.8, 6.5, 6.5, p.shadow);
    ellipse(c, x, 250, 6.2, 6.2, p.brass, p.ink, 1.3);
    ellipse(c, x, 250, 3.7, 3.7, p.ridge, p.ink, .7);
    line(c, x - 1.9, 252, x + 1.9, 248, p.ink, 1.15);
  }
  if (s.free) {
    // A ring that slides on an upright stem: the free end.
    line(c, 340, 168, 340, 334, p.wood, 2.4);
    line(c, 340, 168, 340, 334, p.ink, .6);
    const y = 250 + u[u.length - 1];
    ellipse(c, 338, y, 5.5, 3.2, null, p.ink, 2.6);
    ellipse(c, 338, y, 5.5, 3.2, null, p.brass, 1.2);
  }
}

function wire(c, s, p, u, trail) {
  for (const [left, right] of s.zones) {
    const mid = (left + right) / 2;
    const y = 266;
    line(c, left, y, right, y, p.ring, .72);
    line(c, left, y - 2, left, y + 2, p.wood, .85);
    line(c, right, y - 2, right, y + 2, p.wood, .85);
    for (let k = -1; k <= 1; k++) {
      line(c, mid + k * 2.9, y - 2, mid + k * 2.9 - 1.2, y + 2, p.blush, .95);
    }
  }
  // Where the wire was a moment ago: the wave leaves a fading wake so its travel reads at a glance.
  trail.forEach((old, k) => {
    c.globalAlpha = .1 + .07 * k;
    trace(c, old, 0, p.blush, 2.2);
  });
  c.globalAlpha = .28;
  trace(c, u, 3, p.shadow, 2);
  c.globalAlpha = 1;
  trace(c, u, 0, p.paper, 7.5);
  trace(c, u, 0, p.ink, 3.4);
  trace(c, u, -.6, p.brass, .9);
  // Copper winding marks precisely which part will take a finger.
  for (const [left, right] of s.zones) {
    c.beginPath();
    c.moveTo(left, heightAt(u, left));
    for (let i = 1; i < u.length; i++) {
      const x = X(i);
      if (x > left && x < right) c.lineTo(x, 250 + u[i]);
    }
    c.lineTo(right, heightAt(u, right));
    c.strokeStyle = p.ink;
    c.lineWidth = 5.4;
    c.stroke();
    c.strokeStyle = p.blush;
    c.lineWidth = 3.8;
    c.stroke();
    for (let x = left + 2; x < right - 1; x += 4.3) {
      const y = heightAt(u, x);
      line(c, x - .6, y + 1.4, x + .6, y - 1.6, p.ridge, .8);
    }
  }
  fittings(c, s, p, u);
  // The crest: a bright bead rides the highest point of an upward wave.
  let top = 0, at = -1;
  for (let i = 1; i < u.length - 1; i++) if (u[i] < top) { top = u[i]; at = i; }
  if (at > 0 && top < -7 && !s.grip) {
    ellipse(c, X(at), 250 + top, 4.2, 4.2, p.glint, p.blush, 1.6);
  }
  if (s.grip) {
    const i = s.grip.i, x = X(i);
    ellipse(c, x, 250 + u[i], 5.7, 5.7, p.glint, p.blush, 1.5);
  }
}

// The drawn finger plays the plate's cue gestures on a loop. Each pull reaches down, holds and lets go;
// each tap presses a fret peg. Releases are spaced exactly as cueWait says, so copying it works.
const APPROACH = .35, TUG = 1.15, HOLD = .3, LIFT = .5;
function timeline(s) {
  const gestures = cueOf(s);
  if (gestures.length === 1 && gestures[0].phase !== undefined) {
    // Let go when the swinging pod reaches the drawn phase: the loop is the pod's swing.
    const g = gestures[0], period = s.pods.find(p => p.swing).swing[1];
    const release = cueWait(s, g) + s.time;
    const local = s.time - (release - period);
    return { local, length: period, events: [{ ...g, kind: 'pull', start: period - APPROACH - TUG - HOLD, release: period }] };
  }
  const events = [];
  let clock = 0, previous = null;
  for (const g of gestures) {
    if (g.fret !== undefined) {
      if (s.frets[g.fret]?.on) continue; // already clamped: nothing to show
      events.push({ kind: 'tap', fret: g.fret, start: clock, end: clock + .9 });
      clock += 1.1;
      continue;
    }
    if (previous === null || !g.after) {
      const release = clock + APPROACH + TUG + HOLD;
      events.push({ ...g, kind: 'pull', start: clock, release, tug: TUG });
      previous = release;
    } else {
      const release = previous + g.after, tug = Math.max(.25, g.after - .45);
      events.push({ ...g, kind: 'pull', start: release - tug - .2, release, tug });
      previous = release;
    }
    clock = previous + LIFT;
  }
  const length = clock + 1.3;
  return { local: s.time % length, length, events };
}
export function cuePose(s) {
  const { local, events } = timeline(s);
  const pulls = events.filter(e => e.kind === 'pull');
  let pose = null;
  for (const e of events) {
    if (e.kind === 'tap' && local >= e.start && local < e.end) pose = { kind: 'tap', fret: e.fret, t: (local - e.start) / (e.end - e.start) };
    if (e.kind === 'pull' && local >= e.start && local < e.release + LIFT) {
      const tug = e.tug ?? TUG;
      const pulling = Math.min(1, Math.max(0, (local - e.start - (e.release - e.start - tug - HOLD)) / tug));
      pose = { kind: 'pull', x: e.x, depth: e.depth, tug: local < e.release ? pulling : 0, lifted: local >= e.release ? (local - e.release) / LIFT : 0 };
    }
  }
  return { pose, pulls };
}

function hand(c, p) {
  c.beginPath();
  c.moveTo(-3, 14);
  c.lineTo(-3, 1.5);
  c.quadraticCurveTo(-3, -4.2, .3, -4.2);
  c.quadraticCurveTo(3.6, -4.2, 3.6, 1);
  c.lineTo(3.6, 10);
  c.quadraticCurveTo(7.2, 6.8, 9.2, 10.2);
  c.quadraticCurveTo(12.5, 8.9, 14, 12);
  c.quadraticCurveTo(17.8, 11.7, 18.1, 15.3);
  c.bezierCurveTo(19.3, 20, 16.5, 26.2, 15.9, 29);
  c.lineTo(3.5, 29);
  c.bezierCurveTo(2, 25, -5.8, 20, -7.8, 15.7);
  c.quadraticCurveTo(-9.5, 11.1, -6.4, 11.6);
  c.closePath();
  c.fillStyle = p.paper;
  c.fill();
  c.strokeStyle = p.blush;
  c.lineWidth = 1.7;
  c.stroke();
}

function cue(c, s, p, reduced) {
  const { pose, pulls } = cuePose(s);
  c.save();
  c.globalAlpha = .9;
  // Where to pull to: a dashed drop line, an arrowhead and a target dot under each grip the cue uses.
  const seen = new Set();
  for (const g of pulls) {
    const key = g.x + ':' + g.depth;
    if (seen.has(key)) continue;
    seen.add(key);
    const x = g.x, end = 250 + g.depth + 3;
    c.setLineDash([2, 3.5]);
    line(c, x, 257, x, end, p.blush, 1.6);
    c.setLineDash([]);
    line(c, x, end, x - 4.5, end - 5, p.blush, 1.6);
    line(c, x, end, x + 4.5, end - 5, p.blush, 1.6);
    ellipse(c, x, end + 3, 2.4, 2.4, p.blush);
  }
  if (reduced && !pose) {
    const g = pulls[0];
    if (g) { c.translate(g.x, 250 + g.depth * .55); c.rotate(-.27); hand(c, p); }
    c.restore();
    return;
  }
  if (pose?.kind === 'tap') {
    const f = s.frets[pose.fret], x = X(f.i);
    const press = pose.t < .5 ? pose.t * 2 : 1;
    c.globalAlpha = .9;
    ellipse(c, x, PEG_Y, 9 + press * 9, 9 + press * 9, null, p.blush, 1.4 * (1 - press * .6));
    c.translate(x, PEG_Y - 2 + (pose.t > .35 && pose.t < .7 ? 2 : 0));
    c.rotate(-.27);
    hand(c, p);
  } else if (pose?.kind === 'pull') {
    const x = pose.x, y = 250 + pose.depth * pose.tug;
    if (pose.tug > 0 && !reduced) {
      const span = 40;
      c.beginPath();
      c.moveTo(x - span, 250);
      c.lineTo(x, y);
      c.lineTo(x + span, 250);
      c.strokeStyle = p.blush;
      c.lineWidth = 1.3;
      c.stroke();
    }
    if (pose.lifted > 0) {
      // Let go: the finger springs off and the wire snaps back with a flick.
      c.globalAlpha = .9 * (1 - pose.lifted);
      for (const k of [-1, 0, 1]) line(c, x + k * 6, 244 - pose.lifted * 6, x + k * 9, 236 - pose.lifted * 10, p.blush, 1.3);
      c.globalAlpha = .9;
      c.translate(x + 14 * Math.min(1, pose.lifted * 2), 250 + pose.depth * .35 - 18 * pose.lifted);
    } else c.translate(x, y);
    c.rotate(-.27);
    hand(c, p);
  }
  c.restore();
}

export function draw(c, s, { look = 'herbarium', cue: showCue = false, reduced = false, wire: u = s.u, trail = [] } = {}) {
  if (!s) return;
  const p = palettes[look] || palettes.herbarium;
  const cache = backdrop(s, p);
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.drawImage(cache.board, 0, 0, 360, 380);
  for (const item of s.pods) {
    const x = podX(s, item);
    if (item.swing) stem(c, p, item, x);
    if (item.type === 'tuned' && !item.open) modeGhost(c, p, s, item);
    pod(c, p, item, s.time, x);
  }
  fretsAndEnds(c, s, p, u);
  wire(c, s, p, u, reduced ? [] : trail);
  for (const item of s.pods) {
    if (item.open && !reduced) seeds(c, p, item, s.time - item.openedAt, s.seed, podX(s, item));
  }
  if (showCue && !s.grip && s.zones.length) cue(c, s, p, reduced);
  c.restore();
}
// The paper, branch and fixed stems never move: draw them once per plate and palette.
export function backdrop(s, p = palettes.herbarium) {
  if (typeof p === 'string') p = palettes[p] || palettes.herbarium;
  let cache = paperCache.get(s);
  if (!cache || cache.palette !== p) {
    const board = document.createElement('canvas');
    board.width = 720;
    board.height = 760;
    const background = board.getContext('2d');
    background.scale(2, 2);
    plate(background, s, p);
    cache = { board, palette: p };
    paperCache.set(s, cache);
  }
  return cache;
}
