import { toneField, marks, violinHalfWidth } from './sim.js';

const SIZE = 400;
const EDGE = 29;
const SPAN = SIZE - 2 * EDGE;
const DIVISIONS = 72;
const backings = new WeakMap();
const crystalAtlases = new WeakMap();
const CRYSTAL_VARIANTS = 32;
const CRYSTAL_CELL = 10;
const CRYSTAL_SCALE = 4;

const PALETTES = {
  steel: {
    body: ['#19383d', '#102c32', '#081c22'],
    plate: ['#345160', '#223d50', '#152b3d'],
    bevel: '#789792', dark: '#091923', etch: '#9bcacb', ink: '#adcecb', powder: '#f0995a',
    salt: ['#d2be98', '#f1dfae', '#fff5d2'],
  },
  oxide: {
    body: ['#462d2b', '#302125', '#1c171e'],
    plate: ['#694e43', '#493539', '#342731'],
    bevel: '#ac8771', dark: '#20151c', etch: '#d5ae8f', ink: '#dac0a1', powder: '#f6b06e',
    salt: ['#d9bd8f', '#f6dcaa', '#fff1cd'],
  },
};

const RED = '#fa674a';

function rng(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function line(ctx, x0, y0, x1, y1) {
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
}

function linear(ctx, x0, y0, x1, y1, colors) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
  return gradient;
}

function circle(ctx, x, y, radius, fill) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function mount(ctx, x, y, angle, palette) {
  circle(ctx, x, y + 1.2, 8.1, palette.dark);
  circle(ctx, x, y, 7.2, linear(ctx, x - 4, y - 5, x + 5, y + 5,
    ['#efcb8c', '#94633d', '#cb9962', '#63402b']));
  circle(ctx, x, y, 5.1, linear(ctx, x, y - 5, x, y + 5,
    ['#724728', '#d5a574', '#a4774c']));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#4d3429';
  ctx.fillRect(-3.1, -0.65, 6.2, 1.1);
  ctx.fillStyle = '#ecc490';
  ctx.fillRect(-2.8, 0.5, 5.6, 0.45);
  ctx.restore();
}

function texture(ctx, palette, outline) {
  const random = rng(22479);
  ctx.save();
  ctx.clip(outline);

  for (let i = 0; i < 5800; i++) {
    const x = EDGE + random() * SPAN;
    const y = EDGE + random() * SPAN;
    const width = random() ** 3 * 18 + 0.4;
    ctx.globalAlpha = random() * 0.085;
    ctx.fillStyle = i % 3 ? palette.dark : palette.etch;
    ctx.fillRect(x, y, width, 0.53);
  }

  // Hairlines left by machining, with breaks where the illumination changes.
  for (let i = 0; i < 48; i++) {
    const y = EDGE + random() * SPAN;
    const x = EDGE + random() * SPAN;
    ctx.globalAlpha = random() * 0.045;
    ctx.fillStyle = palette.etch;
    ctx.fillRect(x, y, 8 + random() * 172, 0.52);
  }
  ctx.restore();
}

// The zero line of a field, as a path in plate units.
function nodalPath(sample, inside) {
  const side = DIVISIONS + 1;
  const values = new Float64Array(side * side);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      values[y * side + x] = sample(x / DIVISIONS, y / DIVISIONS);
    }
  }
  const ctx = new Path2D();

  const step = SPAN / DIVISIONS;
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (let y = 0; y < DIVISIONS; y++) {
    for (let x = 0; x < DIVISIONS; x++) {
      if (inside && !inside((x + 0.5) / DIVISIONS, (y + 0.5) / DIVISIONS)) continue;
      const index = y * side + x;
      const samples = [
        values[index], values[index + 1], values[index + side + 1], values[index + side],
      ];
      const points = [];
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4;
        if ((samples[edge] >= 0) === (samples[next] >= 0)) continue;
        const fraction = samples[edge] / (samples[edge] - samples[next]);
        const [ax, ay] = corners[edge];
        const [bx, by] = corners[next];
        points.push([
          EDGE + (x + ax + fraction * (bx - ax)) * step,
          EDGE + (y + ay + fraction * (by - ay)) * step,
        ]);
      }
      if (points.length === 2) line(ctx, ...points[0], ...points[1]);
      if (points.length === 4) {
        const center = sample((x + 0.5) / DIVISIONS, (y + 0.5) / DIVISIONS);
        if ((center >= 0) === (samples[0] >= 0)) {
          line(ctx, ...points[0], ...points[1]);
          line(ctx, ...points[2], ...points[3]);
        } else {
          line(ctx, ...points[0], ...points[3]);
          line(ctx, ...points[1], ...points[2]);
        }
      }
    }
  }
  return ctx;
}

function engrave(ctx, path, palette, faint = false) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(faint ? [3, 4] : []);
  ctx.lineWidth = 2.3;
  ctx.globalAlpha = faint ? 0.3 : 0.46;
  ctx.strokeStyle = palette.dark;
  ctx.stroke(path);
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = faint ? 0.34 : 0.52;
  ctx.strokeStyle = palette.etch;
  ctx.stroke(path);
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

function graduations(ctx, palette) {
  ctx.globalAlpha = 0.52;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const x = EDGE + i * SPAN / 20;
    const tick = i % 5 === 0 ? 5.5 : i % 2 === 0 ? 3.4 : 1.6;
    line(ctx, x, 22, x, 22 - tick);
    line(ctx, x, 378, x, 378 + tick);
    line(ctx, 22, x, 22 - tick, x);
    line(ctx, 378, x, 378 + tick, x);
  }
  ctx.stroke();

  ctx.strokeStyle = RED;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  line(ctx, 200, 16, 200, 23);
  line(ctx, 200, 377, 200, 384);
  line(ctx, 16, 200, 23, 200);
  line(ctx, 377, 200, 384, 200);
  ctx.stroke();
  ctx.globalAlpha = 1;
}


// The plate's outline in plate units (the square is the old plate exactly).
const outlines = new Map();
export function outline(shape) {
  if (outlines.has(shape)) return outlines.get(shape);
  const path = new Path2D();
  const X = u => EDGE + u * SPAN;
  if (shape === 'disk') path.arc(200, 200, SPAN / 2 - 0.5, 0, Math.PI * 2);
  else if (shape === 'triangle') {
    path.moveTo(X(0), X(0.933));
    path.lineTo(X(1), X(0.933));
    path.lineTo(X(0.5), X(0.067));
    path.closePath();
  } else if (shape === 'violin') {
    const points = [];
    for (let i = 0; i <= 120; i++) {
      const y = 0.03 + 0.94 * i / 120;
      points.push([0.5 + violinHalfWidth(y), y]);
    }
    path.moveTo(X(0.5), X(0.03));
    for (const [x, y] of points) path.lineTo(X(x), X(y));
    for (const [x, y] of points.reverse()) path.lineTo(X(1 - x), X(y));
    path.closePath();
  } else path.rect(EDGE, EDGE, SPAN, SPAN);
  outlines.set(shape, path);
  return path;
}

const engravings = new Map();
// The engraved target (and its lit copy for the moment it prints), per plate.
function engraving(spec) {
  if (engravings.has(spec.id)) return engravings.get(spec.id);
  const result = { lines: null, drone: null, spots: [], crests: [] };
  if (!spec.free) {
    result.lines = nodalPath((x, y) => toneField(spec, 0, x, y), null);
    if (spec.drone !== undefined) result.drone = nodalPath((x, y) => toneField(spec, 1, x, y), null);
    const found = marks(spec);
    result.spots = found.spots;
    result.crests = found.crests;
  }
  engravings.set(spec.id, result);
  return result;
}

function paintBacking(ctx, spec, palette) {
  const shape = spec.shape ?? 'square';
  const plate = outline(shape);
  ctx.fillStyle = linear(ctx, 0, 0, SIZE, SIZE, palette.body);
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = palette.bevel;
  ctx.globalAlpha = 0.33;
  ctx.lineWidth = 0.75;
  ctx.strokeRect(4, 4, 392, 392);
  ctx.globalAlpha = 1;
  if (shape === 'square') {
    ctx.fillStyle = palette.dark;
    ctx.fillRect(25, 25, 350, 351);
    ctx.fillStyle = palette.bevel;
    ctx.fillRect(27, 27, 346, 346);
  } else {
    // A cut plate: a shadow and a bevelled rim instead of the square's frame.
    ctx.save();
    ctx.translate(0, 2.5);
    ctx.fillStyle = palette.dark;
    ctx.fill(plate);
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = palette.bevel;
    ctx.stroke(plate);
  }
  ctx.fillStyle = linear(ctx, 60, 32, 373, 350, palette.plate);
  ctx.fill(plate);
  texture(ctx, palette, plate);
  ctx.strokeStyle = palette.dark;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 0.8;
  if (shape === 'square') ctx.strokeRect(EDGE + 0.5, EDGE + 0.5, SPAN - 1, SPAN - 1);
  else ctx.stroke(plate);
  ctx.globalAlpha = 1;
  const marked = engraving(spec);
  ctx.save();
  ctx.clip(plate);
  if (marked.drone) engrave(ctx, marked.drone, palette, true);
  if (marked.lines) engrave(ctx, marked.lines, palette, !!marked.drone);
  ctx.restore();
  // Two tones: the salt can rest only where both figures cross. Powder: rings where it heaps.
  for (const [x, y] of marked.spots) ring(ctx, EDGE + x * SPAN, EDGE + y * SPAN, 6.5, palette, 0.75);
  for (const [x, y] of marked.crests) ring(ctx, EDGE + x * SPAN, EDGE + y * SPAN, 5, palette, 0.55, true);

  graduations(ctx, palette);
  mount(ctx, 14, 14, -0.67, palette);
  mount(ctx, 386, 14, 0.22, palette);
  mount(ctx, 14, 386, 1.16, palette);
  mount(ctx, 386, 386, -0.31, palette);
}

function ring(ctx, x, y, radius, palette, alpha, dashed = false) {
  ctx.save();
  ctx.setLineDash(dashed ? [2, 2.5] : []);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = palette.dark;
  ctx.stroke();
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = dashed ? palette.powder : palette.etch;
  ctx.stroke();
  ctx.restore();
}

function backing(canvas, spec, look, palette) {
  const { width, height } = canvas;
  const cached = backings.get(canvas);
  if (cached?.id === spec.id && cached.look === look && cached.width === width &&
      cached.height === height) {
    return cached.surface;
  }

  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  const ctx = surface.getContext('2d');
  ctx.scale(width / SIZE, height / SIZE);
  paintBacking(ctx, spec, palette);
  backings.set(canvas, { surface, width, height, id: spec.id, look });
  return surface;
}

function crystal(ctx, x, y, radius, angle, color, highlight) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-radius, radius * 0.34);
  ctx.lineTo(-radius * 0.57, -radius * 0.81);
  ctx.lineTo(radius * 0.43, -radius);
  ctx.lineTo(radius, -radius * 0.1);
  ctx.lineTo(radius * 0.49, radius * 0.77);
  ctx.lineTo(-radius * 0.26, radius);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-radius * 0.57, -radius * 0.81);
  ctx.lineTo(radius * 0.43, -radius);
  ctx.lineTo(radius * 0.8, -radius * 0.29);
  ctx.lineTo(-radius * 0.13, -radius * 0.21);
  ctx.closePath();
  ctx.fillStyle = highlight;
  ctx.fill();
  ctx.restore();
}

function crystalAtlas(palette) {
  const cached = crystalAtlases.get(palette);
  if (cached) return cached;

  const atlas = document.createElement('canvas');
  const pixels = CRYSTAL_CELL * CRYSTAL_SCALE;
  atlas.width = CRYSTAL_VARIANTS * pixels;
  atlas.height = pixels;
  const ctx = atlas.getContext('2d');
  ctx.scale(CRYSTAL_SCALE, CRYSTAL_SCALE);
  const random = rng(17907);
  for (let i = 0; i < CRYSTAL_VARIANTS; i++) {
    const center = (i + 0.5) * CRYSTAL_CELL;
    const width = 0.9 + random() * 1.15;
    const parts = 3 + Math.floor(random() * 4);
    const fragments = [];
    for (let j = 0; j < parts; j++) {
      const heading = j / parts * 2 * Math.PI + random() * 0.8;
      const distance = j === 0 ? 0 : width * (0.4 + 0.65 * random());
      fragments.push({
        x: center + Math.cos(heading) * distance,
        y: CRYSTAL_CELL / 2 + Math.sin(heading) * distance,
        radius: j === 0 ? 0.9 + random() * 0.48 : 0.33 + random() * 0.67,
        angle: random() * 2 * Math.PI,
      });
    }

    ctx.globalAlpha = 0.44;
    for (const { x, y, radius } of fragments) {
      circle(ctx, x + 0.12, y + 0.38, radius * 1.15, palette.dark);
    }
    ctx.globalAlpha = 0.9;
    for (const { x, y, radius, angle } of fragments) {
      crystal(ctx, x, y, radius, angle, palette.salt[0], palette.salt[1]);
    }
    const { x, y, radius, angle } = fragments[0];
    crystal(ctx, x, y, radius * 0.82, angle, palette.salt[1], palette.salt[2]);

    ctx.globalAlpha = 0.58;
    for (let j = 0; j < 3; j++) {
      const heading = random() * 2 * Math.PI;
      const distance = width + 0.4 + random() * 1.25;
      circle(ctx, center + Math.cos(heading) * distance, CRYSTAL_CELL / 2 +
        Math.sin(heading) * distance, 0.23 + random() * 0.26, palette.salt[1]);
    }
  }
  crystalAtlases.set(palette, atlas);
  return atlas;
}


const POWDER = { steel: ['#f07a32', '#ffa65c', '#ffe1ad'], oxide: ['#c8692c', '#f0a05a', '#ffe0b0'] };
function atlasFor(palette, powder) {
  if (!powder) return crystalAtlas(palette);
  const key = palette.powderKey ??= { ...palette, salt: palette === PALETTES.oxide ? POWDER.oxide : POWDER.steel };
  return crystalAtlas(key);
}

// Grains: salt crystals, and the fine orange powder on plates that carry it. Before the first touch
// the salt is still falling onto the plate (intro below 1); after a print every grain hops (hop 0..1).
function salt(ctx, grains, palette, shape, { intro = 1, hop = -1, time = 0 } = {}) {
  const pixels = CRYSTAL_CELL * CRYSTAL_SCALE;
  const saltAtlas = atlasFor(palette, false);
  const powderAtlas = atlasFor(palette, true);
  ctx.save();
  ctx.clip(outline(shape));
  for (let i = 0; i < grains.length; i++) {
    const grain = grains[i];
    let { x, y } = grain;
    let lift = 0;
    let size = grain.powder ? CRYSTAL_CELL * 0.95 : CRYSTAL_CELL;
    if (grain.powder && shape === 'disk') {
      // Powder heaps against the rim; draw it just inside, so the rim's clip does not cut the heap in half.
      const r = Math.hypot(x - 0.5, y - 0.5);
      if (r > 0.47) { x = 0.5 + (x - 0.5) * 0.47 / r; y = 0.5 + (y - 0.5) * 0.47 / r; }
    }
    if (grain.gone) {
      // Shaken off: the grain jumps away and fades over half a second.
      const age = time - grain.goneAt;
      if (!(age >= 0 && age < 0.5)) continue;
      ctx.globalAlpha = 1 - age * 2;
      lift = age * 60;
      x += (x - 0.5) * age * 0.6;
    }
    if (intro < 1) {
      const delay = ((i * 0.618034) % 1) * 0.55;
      const fall = Math.min(1, Math.max(0, (intro - delay) / 0.45));
      if (fall <= 0) continue;
      lift += (1 - fall) ** 2 * 120;
      ctx.globalAlpha = Math.min(1, fall * 2);
    }
    if (hop >= 0 && hop < 1) {
      const phase = ((i * 0.381966) % 1) * 0.35;
      const local = Math.min(1, Math.max(0, (hop - phase) / 0.6));
      lift += Math.sin(local * Math.PI) * 7;
    }
    const variant = (Math.imul(i ^ (i >>> 4), 13) ^ (i >>> 2)) & (CRYSTAL_VARIANTS - 1);
    ctx.drawImage(grain.powder ? powderAtlas : saltAtlas, variant * pixels, 0, pixels, pixels,
      EDGE + x * SPAN - size / 2, EDGE + y * SPAN - size / 2 - lift, size, size);
    if (grain.gone || intro < 1) ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// The bow (a strip of rosined hair against the plate) or the damping finger.
function handle(ctx, state, palette, time, active) {
  const spec = state.spec;
  const kind = spec?.handle ?? (spec?.free && state.handle ? 'bow' : null);
  if (!kind) return;
  if (!state.handle) {
    if (kind === 'damp') {
      // No finger yet: a fingerprint waits at the rim.
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 3);
      fingertip(ctx, 372, 372, palette);
      ctx.globalAlpha = 1;
    }
    return;
  }
  const x = EDGE + state.handle[0] * SPAN;
  const y = EDGE + state.handle[1] * SPAN;
  if (kind === 'damp') return fingertip(ctx, x, y, palette);
  const pulse = active ? 0.5 + 0.5 * Math.sin(time * 18) : 0;
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.25 * pulse;
  circle(ctx, x, y, 14 + 3 * pulse, '#ffcf8a');
  ctx.globalAlpha = 1;
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.fillStyle = '#3b2417';
  ctx.fillRect(-20, -4.5, 40, 9);
  ctx.fillStyle = '#f3e6c4';
  ctx.fillRect(-19, -1.6, 38, 3.2);
  ctx.fillStyle = '#c99a5b';
  ctx.fillRect(-21, -5, 5, 10);
  ctx.restore();
  circle(ctx, x, y, 3, RED);
}

function fingertip(ctx, x, y, palette) {
  ctx.save();
  ctx.globalAlpha *= 0.85;
  circle(ctx, x, y + 1.5, 13, '#00000055');
  circle(ctx, x, y, 12, '#e9b99a');
  ctx.strokeStyle = '#a3705a';
  ctx.lineWidth = 0.7;
  for (let r = 3; r <= 10; r += 2.3) {
    ctx.beginPath();
    ctx.ellipse(x, y + 1, r, r * 0.8, 0, Math.PI * 1.1, Math.PI * 1.9 + r * 0.05);
    ctx.stroke();
  }
  ctx.restore();
  void palette;
}

// options: look, active, time, progress (0..1, the print taking hold), lit (seconds since the print,
// or -1), intro (0..1 while the salt first falls)
export function drawPlate(ctx, state, { look = 'steel', active = false, time = 0, progress = 0, lit = -1, intro = 1 } = {}) {
  const { width, height } = ctx.canvas;
  const palette = look === 'oxide' ? PALETTES.oxide : PALETTES.steel;
  const spec = state.spec;
  const surface = backing(ctx.canvas, spec, look, palette);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(surface, 0, 0);
  ctx.scale(width / SIZE, height / SIZE);

  // The engraving lights as the print takes hold and stays lit once it is taken.
  const glow = lit >= 0 ? 1 : progress;
  const marked = !spec.free && engraving(spec);
  if (marked && glow > 0.02) {
    ctx.save();
    ctx.clip(outline(spec.shape));
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffd99a';
    ctx.globalAlpha = 0.18 * glow;
    ctx.lineWidth = 9;
    if (!marked.drone) ctx.stroke(marked.lines);
    ctx.globalAlpha = 0.5 * glow;
    ctx.lineWidth = 2.2;
    if (!marked.drone) ctx.stroke(marked.lines);
    ctx.restore();
    ctx.fillStyle = '#ffd99a';
    for (const [x, y] of marked.spots) {
      ctx.globalAlpha = 0.35 * glow;
      ctx.beginPath();
      ctx.arc(EDGE + x * SPAN, EDGE + y * SPAN, 11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  salt(ctx, state.grains, palette, spec.shape, { intro, hop: lit >= 0 ? lit / 0.9 : -1, time });
  handle(ctx, state, palette, time, active);

  // A sweep of light across the plate when the print is taken.
  if (lit >= 0 && lit < 1.2) {
    const along = lit / 1.2;
    const x = -80 + along * 560;
    const sweep = ctx.createLinearGradient(x - 70, x - 140, x + 70, x + 0);
    sweep.addColorStop(0, '#fff3d000');
    sweep.addColorStop(0.5, '#fff3d055');
    sweep.addColorStop(1, '#fff3d000');
    ctx.save();
    ctx.clip(outline(spec.shape));
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();
  }

  // The rim lamp marks vibration and remains lit when the print has settled.
  const lamp = state.won ? '#ffc783' : RED;
  const intensity = state.won ? 1 : active ? 0.78 + 0.22 * Math.sin(time * 5.7) : 0.26;
  ctx.globalAlpha = intensity * 0.17;
  circle(ctx, 200, 10, 4.4, lamp);
  ctx.globalAlpha = intensity;
  circle(ctx, 200, 10, 1.5, lamp);
  ctx.restore();
}

// A picture of the plate for sharing: the plate as drawn, with a caption strip under it.
export function picture(canvas, caption, sub, look) {
  const out = document.createElement('canvas');
  const side = 1080;
  out.width = side;
  out.height = side + 150;
  const c = out.getContext('2d');
  c.fillStyle = look === 'oxide' ? '#efe3cf' : '#f1ead8';
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(canvas, 0, 0, side, side);
  c.fillStyle = look === 'oxide' ? '#392821' : '#172f32';
  c.font = '400 64px Georgia, serif';
  c.fillText(caption, 40, side + 88);
  c.font = '600 30px ui-monospace, Menlo, monospace';
  c.textAlign = 'right';
  c.fillText(sub, side - 40, side + 86);
  return out;
}
