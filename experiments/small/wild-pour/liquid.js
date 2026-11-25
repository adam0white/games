// A compact scalar field merges nearby drops before any colour is drawn.
// Three samples per world unit; work stays fixed when a phone's pixel ratio rises.
export function liquidSurface() {
  const scale = 3, width = 336, height = 612, x0 = -6, y0 = -34;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(width, height);
  const field = new Float32Array(width * height), radius = 12;
  const kernels = [];
  for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) {
    const d = (x * x + y * y) / (radius * radius);
    if (d < 1) kernels.push([x, y, (1 - d) ** 2]);
  }
  const bounds = { x: 0, y: 0, w: 0, h: 0 };
  const centers = [];
  const rgb = v => [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
  return {
    canvas, x0, y0, scale, bounds,
    draw(particles, colour, light) {
      let left = width, right = 0, top = height, bottom = 0;
      centers.length = 0;
      for (const p of particles) {
        const cx = Math.round((p.x - x0) * scale), cy = Math.round((p.y - y0) * scale);
        if (!(cx + radius > 0 && cx - radius < width && cy + radius > 0 && cy - radius < height)) continue;
        centers.push(cx, cy);
        left = Math.min(left, Math.max(0, cx - radius));
        right = Math.max(right, Math.min(width, cx + radius));
        top = Math.min(top, Math.max(0, cy - radius));
        bottom = Math.max(bottom, Math.min(height, cy + radius));
      }
      bounds.x = left;
      bounds.y = top;
      bounds.w = Math.max(0, right - left);
      bounds.h = Math.max(0, bottom - top);
      if (!bounds.w || !bounds.h) return;
      // Include a clear source pixel around the crop for drawImage's bilinear filter.
      left = Math.max(0, left - 1);
      right = Math.min(width, right + 1);
      top = Math.max(0, top - 1);
      bottom = Math.min(height, bottom + 1);
      for (let y = top; y < bottom; y++) field.fill(0, y * width + left, y * width + right);
      for (let i = 0; i < centers.length; i += 2) {
        const cx = centers[i], cy = centers[i + 1];
        for (const [dx, dy, weight] of kernels) {
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < width && y >= 0 && y < height) field[y * width + x] += weight;
        }
      }
      const a = rgb(colour), b = rgb(light), data = pixels.data;
      for (let y = top; y < bottom; y++) {
        for (let i = y * width + left; i < y * width + right; i++) {
          // A narrow antialias band around the isosurface; no particle highlights.
          const alpha = Math.max(0, Math.min(1, (field[i] - 0.34) * 12));
          const shine = field[i] > 0.34 && (y === top || field[i - width] < 0.34) ? 0.65 : 0;
          const j = i * 4;
          data[j] = a[0] + (b[0] - a[0]) * shine;
          data[j + 1] = a[1] + (b[1] - a[1]) * shine;
          data[j + 2] = a[2] + (b[2] - a[2]) * shine;
          data[j + 3] = alpha * 255;
        }
      }
      // The caller composites only these pixels. Older pixels outside the crop are never drawn.
      ctx.putImageData(pixels, 0, 0, left, top, right - left, bottom - top);
    },
  };
}
