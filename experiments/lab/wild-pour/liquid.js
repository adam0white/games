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
  return {
    canvas, x0, y0, width: width / scale, height: height / scale,
    draw(particles, colour, light) {
      field.fill(0);
      for (const p of particles) {
        const cx = Math.round((p.x - x0) * scale), cy = Math.round((p.y - y0) * scale);
        for (const [dx, dy, weight] of kernels) {
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < width && y >= 0 && y < height) field[y * width + x] += weight;
        }
      }
      const rgb = v => [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
      const a = rgb(colour), b = rgb(light), data = pixels.data;
      for (let i = 0; i < field.length; i++) {
        // A narrow antialias band around the isosurface; no particle highlights.
        const alpha = Math.max(0, Math.min(1, (field[i] - 0.34) * 12));
        const shine = field[i] > 0.34 && (field[i - width] || 0) < 0.34 ? 0.65 : 0;
        const j = i * 4;
        data[j] = a[0] + (b[0] - a[0]) * shine;
        data[j + 1] = a[1] + (b[1] - a[1]) * shine;
        data[j + 2] = a[2] + (b[2] - a[2]) * shine;
        data[j + 3] = alpha * 255;
      }
      ctx.putImageData(pixels, 0, 0);
    },
  };
}
