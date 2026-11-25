// Raised ridges in plate coordinates. Width is the full width of a ridge.
const tau = Math.PI * 2;
const sample = (steps, point) => Array.from({ length: steps + 1 }, (_, i) => point(i / steps));
const blend = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function bezier(a, b, c, d, steps = 20) {
  return sample(steps, t => {
    const ab = blend(a, b, t), bc = blend(b, c, t), cd = blend(c, d, t);
    return blend(blend(ab, bc, t), blend(bc, cd, t), t);
  });
}

function drawing() {
  const lines = [];
  const stroke = (points, width = 2, height = 0.9) => lines.push({ points, width, height });
  const curve = (a, b, c, d, width, height) => {
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]) + Math.hypot(b[0] - c[0], b[1] - c[1])
      + Math.hypot(c[0] - d[0], c[1] - d[1]);
    stroke(bezier(a, b, c, d, Math.max(3, Math.ceil(length / 3))), width, height);
  };
  const oval = (x, y, rx, ry, width, height) => stroke(sample(36, t => [
    x + rx * Math.cos(tau * t), y + ry * Math.sin(tau * t)
  ]), width, height);
  return { lines, stroke, curve, oval };
}

function scallop() {
  const { lines, stroke, curve } = drawing();
  // The mantle grows away from the hinge; each radial rib ends in its own lobe.
  const rim = (a, r) => {
    const length = (158 - 41 * Math.pow(Math.abs(a / 1.24), 2))
      * (1 + 0.012 * Math.cos(a * Math.PI / 0.0775));
    return [120 + r * length * 0.82 * Math.sin(a), 212 - r * length * Math.cos(a)];
  };
  stroke(sample(150, t => rim(-1.24 + t * 2.48, 1)), 3.7);
  for (let i = -8; i <= 8; i++) {
    const a = i * 0.155;
    stroke(sample(24, t => rim(a * (1 - 0.07 * Math.sin(t * Math.PI)), 0.024 + 0.976 * t)), 2.8, 1);
    if (i < 8) stroke(sample(16, t => rim(a + 0.045, 0.24 + t * 0.74)), 1.1, 0.66);
  }
  for (const [r, strength] of [[0.33, 0.46], [0.47, 0.38], [0.55, 0.47], [0.74, 0.53], [0.79, 0.37], [0.9, 0.64], [0.967, 0.61]]) {
    stroke(sample(130, t => rim(-1.24 + t * 2.48, r)), 1.4, strength);
  }
  for (const side of [-1, 1]) {
    const p = (x, y) => [120 + x * side, y];
    curve(p(2, 212), p(13, 212), p(25, 208), p(31, 206), 3.2);
    stroke([p(31, 206), p(29, 191), p(20, 194)], 2.6);
    for (let i = 1; i < 5; i++) stroke([p(7 + 4 * i, 205), p(10 + 4 * i, 201 - i)], 1.1, 0.6);
  }
  return lines;
}

function fern() {
  const { lines, stroke, curve } = drawing();
  const axis = t => [84 + 74 * t + 11 * t * t, 237 - 188 * t];
  stroke(sample(32, axis), 3.4);
  for (let i = 0; i < 12; i++) {
    for (const side of [-1, 1]) {
      const t = 0.09 + 0.074 * i + (side === 1 ? 0.012 : 0);
      const [x, y] = axis(t);
      const size = (0.28 + 0.72 * Math.sin(Math.PI * Math.pow(t, 0.73))) * (side === 1 ? 72 : 67);
      const rachis = u => [x + side * size * u, y - size * (0.23 * u + 0.35 * u * u) + side * size * 0.23 * u];
      stroke(sample(20, rachis), 1.9);
      for (let j = 1; j < 9; j++) {
        const u = j / 10;
        const [bx, by] = rachis(u);
        const l = 2 + (1 - Math.pow(u, 1.45)) * size * 0.23;
        for (const flank of [-1, 1]) {
          const tip = [bx + side * l * 0.84, by + flank * l * 0.68 - l * 0.21];
          curve([bx, by], [bx + side * l * 0.08, by + flank * l * 0.47],
            [tip[0] - side * l * 0.20, tip[1] + flank * l * 0.06], tip, 1.5, 0.87);
          curve(tip, [tip[0] - side * l * 0.13, tip[1] - flank * l * 0.34],
            [bx + side * 4, by], [bx, by], 1.4, 0.76);
        }
      }
    }
  }
  return lines;
}

function trilobite() {
  const { lines, stroke, curve } = drawing();
  for (const side of [-1, 1]) {
    const p = (x, y) => [120 + side * x, y];
    curve(p(0, 49), p(33, 47), p(61, 64), p(65, 92), 3.7, 1);
    curve(p(65, 92), p(68, 103), p(67, 130), p(64, 142), 3.3);
    curve(p(64, 142), p(59, 125), p(55, 108), p(51, 102), 2.7);
    curve(p(51, 102), p(36, 100), p(26, 95), p(18, 98), 2.6);
    curve(p(0, 56), p(18, 54), p(19, 63), p(18, 69), 2.5);
    curve(p(18, 69), p(13, 80), p(16, 92), p(18, 98), 2.2);
    curve(p(32, 71), p(46, 73), p(44, 89), p(32, 91), 3.4, 1);
    curve(p(32, 71), p(39, 79), p(38, 85), p(32, 91), 1.6);
    for (let j = 0; j < 4; j++) {
      curve(p(19 + j * 5, 61), p(31 + j * 4, 60), p(49 + j * 3, 73), p(54 + j * 2, 87 + j * 3), 1.1, 0.50);
    }
    for (let j = 0; j < 3; j++) stroke([p(17 - j, 72 + j * 7), p(7, 75 + j * 6)], 1.5, 0.78);
  }
  const axis = t => 18 - 10 * t * t;
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const y = 100 + i * 8, a = axis(t);
    const w = 53 - 23 * t * t;
    curve([120 - a, y], [120 - a + 3, y - 5], [120 + a - 3, y - 5], [120 + a, y], 3.2, 1);
    for (const side of [-1, 1]) {
      const p = (x, dy) => [120 + side * x, y + dy];
      curve(p(a, 0), p(26, -2), p(w, 5), p(w + 4, 19 - t * 4), 2.8);
      curve(p(w + 4, 19 - t * 4), p(w - 3, 12), p(23, 6), p(a, 5), 1.35, 0.68);
      stroke([p(a, 0), p(a + 0.4, 5)], 1.9);
    }
  }
  for (const side of [-1, 1]) {
    const p = (x, y) => [120 + side * x, y];
    curve(p(34, 203), p(29, 224), p(13, 235), p(0, 234), 3);
    for (let j = 0; j < 5; j++) curve(p(8 - j, 195 + j * 5), p(19 - j, 197 + j * 5), p(25 - j, 202 + j * 5), p(33 - 3 * j, 208 + j * 4), 1.6, 0.81);
  }
  return lines;
}

function ammonite() {
  const { lines, stroke } = drawing();
  const angle = 5.95;
  const spiral = (a, inset = 0) => {
    const r = 100 * Math.exp(0.18 * (a - angle) - inset);
    return [114 + r * Math.cos(a), 151 + r * Math.sin(a)];
  };
  stroke(sample(280, t => spiral(angle - 6.4 * Math.PI * (1 - t))), 3.2, 1);
  stroke(sample(160, t => spiral(angle - 3.15 * Math.PI * (1 - t), 0.044)), 1.45, 0.76);
  const chamber = (a, u) => {
    const r = 100 * Math.exp(0.18 * (a - angle)) * (0.327 + 0.673 * u);
    const theta = a + 0.175 * Math.sin(Math.PI * u) - 0.105 * u;
    return [114 + r * Math.cos(theta), 151 + r * Math.sin(theta)];
  };
  for (let i = 0; i <= 62; i++) {
    const a = angle - (62 - i) * 0.19;
    stroke(sample(19, u => chamber(a, u)), 0.85 + 1.65 * (i / 62) ** 2, 0.64 + 0.33 * i / 62);
    if (i > 26) stroke(sample(10, t => chamber(a + 0.077 * t, 0.60 + 0.4 * t)), 1.1, 0.52);
  }
  stroke(sample(25, u => chamber(angle + 0.10, u)), 3.4);
  // Rotate the aperture down and enlarge the coil to fill the plate.
  for (const line of lines) line.points = line.points.map(([x, y]) => {
    const dx = x - 114, dy = y - 151;
    return [94 + 1.23 * (0.826 * dx - 0.564 * dy), 160 + 1.23 * (0.564 * dx + 0.826 * dy)];
  });
  return lines;
}

function fish() {
  const { lines, stroke, curve, oval } = drawing();
  const back = t => [76 + 108 * t, 138 + 14 * t - 4 * Math.sin(t * Math.PI)];
  curve([80, 136], [68, 115], [43, 111], [23, 134], 3.2);
  stroke([[23, 134], [19, 139], [41, 139]], 3);
  curve([20, 143], [39, 156], [59, 158], [79, 144], 3);
  curve([62, 119], [83, 130], [73, 148], [56, 152], 2.8);
  curve([63, 124], [72, 133], [69, 144], [61, 147], 1.35, 0.7);
  oval(45, 130, 6, 5, 2.5);
  oval(45, 130, 1.7, 1.7, 2.1);
  stroke([[22, 135], [29, 130], [32, 133]], 1.8);
  curve([32, 144], [46, 148], [49, 142], [57, 137], 1.8);
  stroke(sample(48, back), 3.1);
  for (let i = 0; i < 22; i++) {
    const t = i / 22, [x, y] = back(t);
    const arc = Math.sin((0.12 + 0.88 * t) * Math.PI) ** 0.8;
    const rib = 8 + 27 * arc;
    stroke([[x, y - 2], [x + 2, y + 2], [x + 4, y + 2]], 2.35);
    curve([x + 2, y + 2], [x + 7, y + 8], [x + 8, y + rib * 0.60], [x + 15, y + rib], 1.9);
    curve([x + 1, y - 2], [x + 3, y - 7], [x + 8, y - rib * 0.68], [x + 11, y - rib * 0.96], 1.75, 0.79);
  }
  for (let i = 0; i < 12; i++) {
    const t = i / 11, x = 95 + 49 * t, y = 109 + 6 * t;
    stroke([[x, y], [x + 8 + 12 * t, y - 5 - 20 * Math.sin(Math.PI * Math.sqrt(t))]], 1.5, 0.78);
  }
  for (let i = 0; i <= 12; i++) {
    const a = i / 6 - 1;
    curve([181, 152 + a * 3], [192, 152 + a * 9], [198, 152 + a * 18],
      [202 + 17 * Math.abs(a), 152 + a * 28], i % 3 === 0 ? 2.1 : 1.45);
  }
  for (let i = 0; i < 7; i++) stroke([[61, 147], [66 + 2 * i, 157 + i], [72 + 3 * i, 166 + i * 0.6]], 1.6, 0.75);
  // Set the long specimen diagonally on the sheet.
  for (const line of lines) line.points = line.points.map(([x, y]) => [
    120 + (x - 120) * 0.866 - (y - 143) * 0.5,
    144 + (x - 120) * 0.5 + (y - 143) * 0.866
  ]);
  return lines;
}

function dragonfly() {
  const { lines, stroke, curve, oval } = drawing();
  // Spanwise veins branch at successive nodes. Crossveins join adjacent ones.
  for (const side of [-1, 1]) {
    const p = (x, y) => [120 + side * x, y];
    for (const hind of [false, true]) {
      const top = hind
        ? bezier(p(7, 126), p(25, 124), p(69, 124), p(94, 135))
        : bezier(p(6, 116), p(27, 101), p(64, 71), p(97, 70));
      const lower = hind
        ? bezier(p(7, 134), p(36, 151), p(66, 167), p(94, 135))
        : bezier(p(6, 125), p(35, 119), p(87, 104), p(97, 70));
      const wing = (t, u) => {
        const f = t * (top.length - 1);
        const i = Math.min(top.length - 2, Math.floor(f));
        return blend(blend(top[i], top[i + 1], f - i), blend(lower[i], lower[i + 1], f - i), u);
      };
      stroke(top, 2.8);
      stroke(lower, 2.15);
      for (const v of [0.22, 0.52, 0.76]) stroke(sample(24, t => wing(t, v + 0.055 * Math.sin(t * 5))), 1.45, 0.78);
      for (let k = 1; k < 12; k++) {
        for (let row = 0; row < 4; row++) {
          const t = k / 13;
          const v = [0, 0.22, 0.52, 0.76, 1];
          stroke([wing(t + (row % 2) * 0.025, v[row]), wing(t + (1 - row % 2) * 0.025, v[row + 1])], 1, 0.60);
        }
      }
      stroke(sample(8, t => wing(0.76 + 0.115 * t, 0.11)), 2.4);
    }
    oval(120 + side * 5.9, 99, 5.1, 6.4, 2.45);
    curve(p(5, 94), p(6, 91), p(9, 91), p(10, 87), 1.6);
    curve(p(4, 105), p(12, 112), p(9, 130), p(5, 136), 3);
    curve(p(5, 136), p(5, 159), p(3, 209), p(1.5, 221), 2.6);
    stroke([p(1.5, 221), p(3.5, 224), p(4.5, 228)], 1.6);
    for (let j = 0; j < 3; j++) stroke([p(7, 115 + j * 5), p(17, 123 + j * 5), p(23 - j * 2, 117 + j * 8)], 1.6, 0.8);
  }
  for (let j = 0; j < 10; j++) {
    const y = 140 + j * 8.1;
    curve([115.6 + j * 0.3, y], [119, y + 2], [121, y + 2], [124.4 - j * 0.3, y], 1.6, 0.84);
  }
  return lines;
}


// Plates 7 to 12 (2026-11-25). Same ridges, same rule; each one asks for a different way to rub.
const moved = (lines, f) => lines.map(line => ({ ...line, points: line.points.map(f) }));

// A young ammonite, small and low on the sheet: the whole sheet is not worth the lead.
function juvenile() {
  return moved(ammonite(), ([x, y]) => [150 + (x - 120) * 0.46, 196 + (y - 150) * 0.46]);
}

// A crinoid stem: a column of flat discs. Almost every ridge runs across the sheet.
function crinoid() {
  const { lines, stroke, curve } = drawing();
  const axis = t => [112 + 14 * Math.sin(t * 2.4), 246 - 168 * t];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, [x, y] = axis(t), w = 16 - 5 * t;
    curve([x - w, y], [x - w * 0.4, y + 2.2], [x + w * 0.4, y + 2.2], [x + w, y], i % 2 ? 1.6 : 2.6, i % 2 ? 0.78 : 1);
  }
  // The crown: arms that branch upward, each with flat pinnules.
  const [cx, cy] = axis(1);
  for (const [dx, lean] of [[-34, -0.5], [-14, -0.15], [10, 0.2], [30, 0.55]]) {
    const arm = u => [cx + dx * u + lean * 24 * u * u, cy - 4 - 52 * u];
    stroke(sample(14, arm), 2.2);
    for (let j = 1; j < 9; j++) {
      const [x, y] = arm(j / 9);
      stroke([[x - 8, y + 1], [x + 8, y - 1]], 1.6, 0.86);
    }
  }
  curve([cx - 26, cy - 2], [cx - 12, cy + 10], [cx + 12, cy + 10], [cx + 26, cy - 2], 3);
  return lines;
}

// A brittle star: five thin arms from a small disc, with stone between them.
function brittleStar() {
  const { lines, stroke, oval } = drawing();
  const cx = 122, cy = 140;
  oval(cx, cy, 17, 16, 2.8);
  oval(cx, cy, 6, 6, 2);
  for (let k = 0; k < 5; k++) {
    const a0 = -Math.PI / 2 + k * Math.PI * 2 / 5;
    const arm = u => {
      const a = a0 + 0.55 * Math.sin(u * 2.6 + k) * u;
      const r = 17 + 88 * u;
      return [cx + r * Math.cos(a), cy + r * 1.05 * Math.sin(a)];
    };
    stroke(sample(30, arm), 3 - 0.8, 1);
    for (let j = 1; j < 15; j++) {
      const u = j / 15, [x, y] = arm(u), [x2, y2] = arm(u + 0.01);
      const nx = -(y2 - y), ny = x2 - x, n = Math.hypot(nx, ny) || 1, l = 6.5 * (1 - 0.55 * u);
      stroke([[x - nx / n * l, y - ny / n * l], [x + nx / n * l, y + ny / n * l]], 1.7, 0.9);
    }
  }
  return lines;
}

// A sea urchin seen from above: rings of knobs round a five-petal star. Its ridges face every way.
function urchin() {
  const { lines, stroke, oval } = drawing();
  const cx = 120, cy = 146;
  for (const [r, w] of [[64, 3.2], [52, 1.6], [38, 1.6], [24, 1.6]]) oval(cx, cy, r, r * 0.96, w, r === 64 ? 1 : 0.84);
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
    for (const side of [-1, 1]) {
      const petal = u => {
        const r = 8 + 46 * u, spread = side * 0.16 * Math.sin(Math.PI * u);
        return [cx + r * Math.cos(a + spread), cy + r * 0.96 * Math.sin(a + spread)];
      };
      stroke(sample(16, petal), 1.9);
    }
  }
  oval(cx, cy, 7, 7, 2.4);
  return lines;
}

// A horseshoe crab: a broad head shield, a shorter body and a long tail spine.
function horseshoeCrab() {
  const { lines, stroke, curve } = drawing();
  for (const side of [-1, 1]) {
    const p = (x, y) => [118 + side * x, y];
    curve(p(0, 46), p(46, 46), p(70, 82), p(68, 124), 3.4);
    curve(p(68, 124), p(50, 116), p(30, 114), p(20, 118), 2.6);
    curve(p(20, 64), p(28, 80), p(30, 98), p(22, 114), 2);
    curve(p(34, 70), p(40, 74), p(42, 80), p(38, 84), 2.4);
    curve(p(20, 118), p(44, 124), p(48, 150), p(36, 172), 3);
    curve(p(36, 172), p(22, 180), p(10, 182), p(0, 182), 2.8);
    for (let j = 0; j < 6; j++) stroke([p(26 + j * 1.5, 128 + j * 8), p(44 - j * 1.5, 130 + j * 8)], 1.6, 0.84);
  }
  stroke([[118, 52], [118, 112]], 1.8, 0.8);
  stroke(sample(20, t => [118 + 6 * Math.sin(t * 2), 182 + 64 * t]), 2.8);
  return lines;
}

// A feather: an upright shaft and two vanes of nearly level barbs, pressed into stone. Level ridges and grit:
// the stick has to go up and down the barbs, and stay off the stone.
function feather() {
  const { lines, stroke, curve } = drawing();
  const shaft = t => [118 + 10 * Math.sin(t * 2.2), 236 - 182 * t];
  stroke(sample(30, shaft), 3);
  for (let i = 2; i < 30; i++) {
    const t = i / 30, [x, y] = shaft(t);
    for (const side of [-1, 1]) {
      const len = (side < 0 ? 46 : 38) * Math.sin(Math.PI * Math.min(1, t * 1.05)) + 6;
      stroke([[x, y], [x + side * len, y - 2]], 1.8, 0.9);
    }
  }
  return lines;
}

// Grit cells a stone plate lets darken before the print is spoiled.
export const SMUDGE_LIMIT = 48;

export const PLATES = [
  { id: 'scallop', name: 'Scallop', taxon: 'Pectinidae', age: 'miocene', lines: scallop(), par: 1110 },
  { id: 'fern', name: 'Fern frond', taxon: 'Filicopsida', age: 'carboniferous', lines: fern(), par: 1280 },
  { id: 'trilobite', name: 'Trilobite', taxon: 'Trilobita', age: 'devonian', lines: trilobite(), par: 1300 },
  { id: 'ammonite', name: 'Ammonite', taxon: 'Ammonoidea', age: 'jurassic', lines: ammonite(), par: 1400 },
  { id: 'fish', name: 'Fish skeleton', taxon: 'Actinopterygii', age: 'eocene', lines: fish(), par: 1010 },
  { id: 'dragonfly', name: 'Dragonfly', taxon: 'Anisoptera', age: 'jurassic', lines: dragonfly(), par: 1310 },
  // par: sheet units of stick for three stars (a quarter more than the careful rubber in plan.js needed on the
  // plate's own paper); lead: the stick's length, twice what it needed. bots.mjs recomputes both and fails on drift.
  // From here on the stick has a length (lead), some plates are glazed (only the flank a stroke climbs takes
  // graphite) and some sit in stone (grit that must stay clean). radius and goal as in sim.js PROOFS.
  { id: 'juvenile', name: 'Young ammonite', taxon: 'Ammonoidea', age: 'jurassic', lines: juvenile(), radius: 22, goal: 0.84, par: 450, lead: 710 },
  { id: 'crinoid', name: 'Crinoid stem', taxon: 'Crinoidea', age: 'silurian', lines: crinoid(), radius: 22, goal: 0.78, glaze: true, par: 2730, lead: 4360 },
  { id: 'brittle', name: 'Brittle star', taxon: 'Ophiuroidea', age: 'ordovician', lines: brittleStar(), radius: 16, goal: 0.80, stone: 101, par: 1160, lead: 1860, smudge: SMUDGE_LIMIT },
  { id: 'urchin', name: 'Sea urchin', taxon: 'Echinoidea', age: 'cretaceous', lines: urchin(), radius: 20, goal: 0.82, glaze: true, par: 3390, lead: 5430 },
  { id: 'crab', name: 'Horseshoe crab', taxon: 'Xiphosura', age: 'jurassic', lines: horseshoeCrab(), radius: 13, goal: 0.82, stone: 202, par: 3220, lead: 5140, smudge: SMUDGE_LIMIT },
  { id: 'feather', name: 'Feather', taxon: 'Archaeopteryx', age: 'jurassic', lines: feather(), radius: 15, goal: 0.78, glaze: true, stone: 303, par: 4870, lead: 7790, smudge: SMUDGE_LIMIT },
];

// How each plate is played: 'free' (plates 1 to 6, the stick never runs out), 'lead' (the stick wears down),
// 'glaze' and 'stone' (as above, with the stick wearing down too).
export const kindOf = plate => plate.glaze && plate.stone ? 'glaze-stone' : plate.glaze ? 'glaze' : plate.stone ? 'stone' : plate.lead ? 'lead' : 'free';

// The daily plate: one of the twelve specimens, one way of rubbing it, maybe mirrored, and its own paper,
// chosen by the date (UTC), the same for everyone. Its par and stick length come from the careful rubber
// (plan.js rate), so they are the same for everyone too. The bots finish every specimen in every way.
export const DAILY_KINDS = [
  { kind: 'lead', radius: 22, goal: 0.80, scale: 0.7 },
  { kind: 'glaze', radius: 20, goal: 0.80, glaze: true },
  { kind: 'stone', radius: 15, goal: 0.80 },
];
export function dayHash(day) {
  let hash = 2166136261;
  for (const char of String(day)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
export function dailySpec(day, pick = null) {
  const hash = dayHash(day);
  const plate = PLATES[pick?.plate ?? hash % PLATES.length];
  const way = DAILY_KINDS[pick?.kind ?? (hash >>> 8) % DAILY_KINDS.length];
  const mirror = pick?.mirror ?? ((hash >>> 16) & 1) === 1;
  // A lead day shrinks the specimen to seven tenths, somewhere on the sheet: sweeping the whole sheet never pays.
  const k = way.scale ?? 1, cx = 120 + (k < 1 ? ((hash >>> 20) % 41) - 20 : 0), cy = 145 + (k < 1 ? ((hash >>> 26) % 41) - 20 : 0);
  const place = ([x, y]) => [cx + ((mirror ? 240 - x : x) - 120) * k, cy + (y - 145) * k];
  const lines = mirror || k !== 1 ? plate.lines.map(line => ({ ...line, points: line.points.map(place) })) : plate.lines;
  return { day, plate: plate.id, kind: way.kind, mirror, lines, radius: way.radius, goal: way.goal,
    ...(way.glaze ? { glaze: true } : {}), ...(way.kind === 'stone' ? { stone: (hash | 1) >>> 0, smudge: SMUDGE_LIMIT } : {}),
    seed: (hash ^ 0x5bd1e995) >>> 0 };
}
