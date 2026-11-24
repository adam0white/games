import { field, LEVELS } from './sim.js';

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
    bevel: '#789792', dark: '#091923', etch: '#9bcacb', ink: '#adcecb',
    salt: ['#d2be98', '#f1dfae', '#fff5d2'],
  },
  oxide: {
    body: ['#462d2b', '#302125', '#1c171e'],
    plate: ['#694e43', '#493539', '#342731'],
    bevel: '#ac8771', dark: '#20151c', etch: '#d5ae8f', ink: '#dac0a1',
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

function texture(ctx, palette) {
  const random = rng(22479);
  ctx.save();
  ctx.beginPath();
  ctx.rect(EDGE, EDGE, SPAN, SPAN);
  ctx.clip();

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

function contour(ctx, level, drive, palette) {
  const side = DIVISIONS + 1;
  const values = new Float64Array(side * side);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      values[y * side + x] = field(level, drive, x / DIVISIONS, y / DIVISIONS);
    }
  }

  const step = SPAN / DIVISIONS;
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  ctx.beginPath();
  for (let y = 0; y < DIVISIONS; y++) {
    for (let x = 0; x < DIVISIONS; x++) {
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
        const center = field(level, drive, (x + 0.5) / DIVISIONS, (y + 0.5) / DIVISIONS);
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
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.3;
  ctx.globalAlpha = 0.46;
  ctx.strokeStyle = palette.dark;
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.52;
  ctx.strokeStyle = palette.etch;
  ctx.stroke();
  ctx.globalAlpha = 1;
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

function paintBacking(ctx, level, palette) {
  ctx.fillStyle = linear(ctx, 0, 0, SIZE, SIZE, palette.body);
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = palette.bevel;
  ctx.globalAlpha = 0.33;
  ctx.lineWidth = 0.75;
  ctx.strokeRect(4, 4, 392, 392);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.dark;
  ctx.fillRect(25, 25, 350, 351);
  ctx.fillStyle = palette.bevel;
  ctx.fillRect(27, 27, 346, 346);
  ctx.fillStyle = linear(ctx, 60, 32, 373, 350, palette.plate);
  ctx.fillRect(EDGE, EDGE, SPAN, SPAN);
  texture(ctx, palette);
  ctx.strokeStyle = palette.dark;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(EDGE + 0.5, EDGE + 0.5, SPAN - 1, SPAN - 1);
  ctx.globalAlpha = 1;
  contour(ctx, level, LEVELS[level - 1].target, palette);

  graduations(ctx, palette);
  mount(ctx, 14, 14, -0.67, palette);
  mount(ctx, 386, 14, 0.22, palette);
  mount(ctx, 14, 386, 1.16, palette);
  mount(ctx, 386, 386, -0.31, palette);
}

function backing(canvas, level, look, palette) {
  const { width, height } = canvas;
  const cached = backings.get(canvas);
  if (cached?.level === level && cached.look === look && cached.width === width &&
      cached.height === height) {
    return cached.surface;
  }

  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  const ctx = surface.getContext('2d');
  ctx.scale(width / SIZE, height / SIZE);
  paintBacking(ctx, level, palette);
  backings.set(canvas, { surface, width, height, level, look });
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

function salt(ctx, grains, palette) {
  const atlas = crystalAtlas(palette);
  const pixels = CRYSTAL_CELL * CRYSTAL_SCALE;
  ctx.save();
  ctx.beginPath();
  ctx.rect(EDGE + 1, EDGE + 1, SPAN - 2, SPAN - 2);
  ctx.clip();

  for (let i = 0; i < grains.length; i++) {
    const { x, y } = grains[i];
    const variant = (Math.imul(i ^ (i >>> 4), 13) ^ (i >>> 2)) & (CRYSTAL_VARIANTS - 1);
    ctx.drawImage(atlas, variant * pixels, 0, pixels, pixels,
      EDGE + x * SPAN - CRYSTAL_CELL / 2, EDGE + y * SPAN - CRYSTAL_CELL / 2,
      CRYSTAL_CELL, CRYSTAL_CELL);
  }

  ctx.restore();
}

export function drawPlate(ctx, state, { look = 'steel', active = false, time = 0 } = {}) {
  const { width, height } = ctx.canvas;
  const palette = look === 'oxide' ? PALETTES.oxide : PALETTES.steel;
  const surface = backing(ctx.canvas, state.level, look, palette);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(surface, 0, 0);
  ctx.scale(width / SIZE, height / SIZE);
  salt(ctx, state.grains, palette);

  // The rim lamp marks vibration and remains lit when the print has settled.
  const lamp = state.won ? '#ffc783' : RED;
  const intensity = state.won ? 1 : active ? 0.78 + 0.22 * Math.sin(time * 5.7) : 0.26;
  ctx.globalAlpha = intensity * 0.17;
  circle(ctx, 200, 10, 4.4, lamp);
  ctx.globalAlpha = intensity;
  circle(ctx, 200, 10, 1.5, lamp);
  ctx.restore();
}
