// Small finds hidden in the matrix around each plate's specimen (2026-11-26). Each is a few raised lines drawn round
// (0, 0), about 24 sheet units across, rasterized by the same ridge rule as the plates. They are not shown on the
// paper: a player feels them under the crayon and brings them up by rubbing.
const tau = Math.PI * 2;
const arc = (cx, cy, r, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + (a1 - a0) * i / n;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
const ring = (cx, cy, rx, ry, n = 22) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos(tau * i / n), cy + ry * Math.sin(tau * i / n)]);
const line = (points, width = 2, height = 0.85) => ({ points, width, height });

function tooth() {
  // A shark tooth: a serrated blade on a root.
  const blade = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; blade.push([-9 + 9 * t + (i % 2 ? 0.9 : 0), 6 - 18 * t]); }
  for (let i = 1; i <= 8; i++) { const t = i / 8; blade.push([9 * t - (i % 2 ? 0.9 : 0), -12 + 18 * t]); }
  return [line(blade, 2.2, 0.95), line([[-11, 6], [-6, 10], [0, 8], [6, 10], [11, 6]], 2.4, 0.8), line([[0, -8], [0, 4]], 1.2, 0.55)];
}
function snail() {
  // A high-spired gastropod: stacked whorls narrowing to the tip.
  const lines = [];
  for (let k = 0; k < 6; k++) {
    const y = 10 - k * 4, w = 8.5 - k * 1.3;
    lines.push(line([[-w, y], [-w * 0.6, y - 3.2], [w * 0.7, y - 3.6], [w, y]], 2, 0.9));
  }
  lines.push(line([[-8.5, 10], [0, 12.5], [8.5, 10]], 2.2, 0.85));
  return lines;
}
function brachiopod() {
  // A winged lamp shell with a hinge line and radial ribs.
  const lines = [line([[-13, -4], [13, -4]], 2.4, 0.95), line([[-13, -4], ...arc(0, -4, 13, 0.05 * Math.PI, 0.95 * Math.PI, 16).reverse(), [13, -4]].reverse(), 2.2, 0.9)];
  for (let k = -3; k <= 3; k++) { const a = Math.PI / 2 + k * 0.32; lines.push(line([[0, -3], [12 * Math.cos(a), -4 + 12 * Math.sin(a)]], 1.4, 0.65)); }
  return lines;
}
function leaf() {
  // A ginkgo leaf: a fan on a stalk, veins spreading.
  const lines = [line([[0, 13], [0, 3]], 1.8, 0.8), line(arc(0, 3, 13, -Math.PI * 0.95, -Math.PI * 0.05, 18), 2, 0.9)];
  lines.push(line([[0, 3], ...arc(0, 3, 13, -Math.PI * 0.95, -Math.PI * 0.95, 1).slice(1)], 1.6, 0.8));
  lines.push(line([[0, 3], ...arc(0, 3, 13, -Math.PI * 0.05, -Math.PI * 0.05, 1).slice(1)], 1.6, 0.8));
  for (let k = 1; k < 7; k++) { const a = -Math.PI * (0.95 - 0.9 * k / 7); lines.push(line([[0, 3], [12 * Math.cos(a), 3 + 12 * Math.sin(a)]], 1, 0.55)); }
  return lines;
}
function track() {
  // A three-toed dinosaur footprint.
  return [line([[0, 6], [-9, -10]], 3, 0.8), line([[0, 6], [0, -13]], 3, 0.8), line([[0, 6], [9, -10]], 3, 0.8),
    line(ring(0, 7.5, 4, 3.4, 12), 2.4, 0.7)];
}
function belemnite() {
  // A belemnite guard: a bullet with a groove.
  return [line([[-3.4, -12], [-3.6, 6], [0, 13], [3.6, 6], [3.4, -12], [-3.4, -12]], 2.4, 1), line([[0, -11], [0, 7]], 1.1, 0.5)];
}
function ossicle() {
  // A crinoid ossicle: a disc with a five-pointed star.
  const star = [];
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.4 : 8.5; star.push([r * Math.cos(a), r * Math.sin(a)]); }
  return [line(ring(0, 0, 11.5, 11.5, 24), 2.4, 0.95), line(star, 1.6, 0.75)];
}
function coral() {
  // A honeycomb coral: hexagonal cells.
  const lines = [];
  for (const [cx, cy] of [[0, 0], [-8, -5], [8, -5], [-8, 5], [8, 5], [0, -10], [0, 10]]) {
    lines.push(line(Array.from({ length: 7 }, (_, i) => [cx + 4.6 * Math.cos(tau * i / 6), cy + 4.6 * Math.sin(tau * i / 6)]), 1.5, 0.8));
  }
  return lines;
}
function wing() {
  // An insect wing: an outline with branching veins.
  const lines = [line([[-13, 2], [-6, -5], [6, -6], [13, -2], [8, 4], [-4, 5], [-13, 2]], 1.8, 0.85)];
  for (const [a, b] of [[[-13, 2], [12, -2]], [[-9, 1], [6, 4]], [[-4, -1], [2, -5.5]], [[1, 0], [9, -4]], [[3, 1], [6, 4.4]]]) lines.push(line([a, b], 1.1, 0.6));
  return lines;
}
function cone() {
  // A conifer cone: an oval crossed by diagonal scales.
  const lines = [line(ring(0, 0, 7.5, 12.5, 24), 2.2, 0.95)];
  for (let k = -3; k <= 3; k++) { lines.push(line([[-7, k * 3.6 - 3], [7, k * 3.6 + 3]], 1.2, 0.6)); lines.push(line([[-7, k * 3.6 + 3], [7, k * 3.6 - 3]], 1.2, 0.6)); }
  return lines;
}
function clam() {
  // A small clam: a rounded valve with growth lines and a beak.
  const lines = [line([...arc(0, 0, 11.5, Math.PI * 1.05, Math.PI * 1.95 + tau, 26)], 2.2, 0.95)];
  for (const r of [4, 7, 9.5]) lines.push(line(arc(0, -4, r, Math.PI * 0.12, Math.PI * 0.88, 12), 1.2, 0.6));
  return lines;
}
function vertebra() {
  // A fish vertebra: an hourglass disc with spines.
  return [line(ring(0, 0, 6, 6, 18), 2.4, 1), line(ring(0, 0, 2.4, 2.4, 10), 1.3, 0.6),
    line([[0, -6], [-2, -14]], 1.8, 0.8), line([[0, 6], [2, 14]], 1.8, 0.8), line([[-6, 0], [-12, 2]], 1.6, 0.7), line([[6, 0], [12, -2]], 1.6, 0.7)];
}

export const FINDS = [
  { id: 'tooth', taxon: 'Otodus', lines: tooth() },
  { id: 'snail', taxon: 'Turritella', lines: snail() },
  { id: 'brachiopod', taxon: 'Spirifer', lines: brachiopod() },
  { id: 'leaf', taxon: 'Ginkgo', lines: leaf() },
  { id: 'track', taxon: 'Grallator', lines: track() },
  { id: 'belemnite', taxon: 'Belemnitida', lines: belemnite() },
  { id: 'ossicle', taxon: 'Pentacrinites', lines: ossicle() },
  { id: 'coral', taxon: 'Favosites', lines: coral() },
  { id: 'wing', taxon: 'Meganeura', lines: wing() },
  { id: 'cone', taxon: 'Araucaria', lines: cone() },
  { id: 'clam', taxon: 'Venericardia', lines: clam() },
  { id: 'vertebra', taxon: 'Knightia', lines: vertebra() },
];

// Which finds lie in a plate's matrix: three each, every find in three plates, never twice in one plate.
export function findsFor(level) {
  const n = FINDS.length;
  return [0, 1, 2].map(k => FINDS[(level * 5 + k * 4) % n]);
}
