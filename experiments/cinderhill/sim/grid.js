// The two layers as one cell index space, so flow fields and scent run the same code on both.
//
// Cells 0 .. sw*sh-1 are the surface (top-down), row-major. Cells sw*sh .. sw*sh+nw*nh-1 are the nest
// (side cutaway, row 0 at the top). Entrances link one surface cell to one nest cell; a link is an
// extra neighbour in breadth-first search and the way an ant changes layer.

export const SURFACE = 0, NEST = 1;
export const SUB = 256; // positions are in 1/256 of a cell

export const MAT = { OPEN: 0, ASH: 1, TOPSOIL: 2, CLAY: 3, STONE: 4, ROOT: 5, WATER: 6 };
// Ticks of one ant's digging to open a cell. 0: cannot be dug.
export const HARDNESS = new Uint8Array([0, 8, 16, 32, 0, 48, 0]);

export function makeLayout(cfg) {
  const sw = cfg.sw, sh = cfg.sh, nw = cfg.nw, nh = cfg.nh;
  // Positions are Uint16 sub-cell units, so a layer side may be at most 256 cells.
  if (!(sw > 0 && sh > 0 && nw > 0 && nh > 0 && sw <= 256 && sh <= 256 && nw <= 256 && nh <= 256)) throw new Error('layer sides must be 1..256');
  const nestBase = sw * sh, n = nestBase + nw * nh;
  // nb[c*4 + k]: the k-th neighbour (k: 0 up, 1 right, 2 down, 3 left) inside the same layer, or -1.
  const nb = new Int32Array(n * 4).fill(-1);
  const fill = (base, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = base + y * w + x, o = c * 4;
      if (y > 0) nb[o] = c - w;
      if (x < w - 1) nb[o + 1] = c + 1;
      if (y < h - 1) nb[o + 2] = c + w;
      if (x > 0) nb[o + 3] = c - 1;
    }
  };
  fill(0, sw, sh);
  fill(nestBase, nw, nh);
  // dg[c*4 + k]: the k-th diagonal neighbour (k: 0 up-right, 1 down-right, 2 down-left, 3 up-left), or -1.
  // Diagonal k lies between orthogonal neighbours k and (k + 1) & 3, its two side cells. A step along a
  // diagonal is allowed only when the target and both side cells are open (no cutting a wall's corner):
  // see `diagOpen`.
  const dg = new Int32Array(n * 4).fill(-1);
  for (let c = 0; c < n; c++) for (let k = 0; k < 4; k++) {
    const a = nb[c * 4 + k], b = nb[c * 4 + ((k + 1) & 3)];
    if (a >= 0 && b >= 0) dg[c * 4 + k] = nb[a * 4 + ((k + 1) & 3)];
  }
  return { sw, sh, nw, nh, nestBase, n, nb, dg };
}

/** Diagonal k of cell c, or -1 when it is missing or the step would cut a corner (target or a side closed). */
export function diagOpen(L, mat, c, k) {
  const m = L.dg[c * 4 + k];
  return m >= 0 && mat[m] === MAT.OPEN && mat[L.nb[c * 4 + k]] === MAT.OPEN && mat[L.nb[c * 4 + ((k + 1) & 3)]] === MAT.OPEN ? m : -1;
}

export const layerOf = (L, c) => (c >= L.nestBase ? NEST : SURFACE);
export const widthOf = (L, layer) => (layer === SURFACE ? L.sw : L.nw);
export const heightOf = (L, layer) => (layer === SURFACE ? L.sh : L.nh);
export const baseOf = (L, layer) => (layer === SURFACE ? 0 : L.nestBase);

/** Cell index of (cx, cy) on a layer, or -1 when outside it. */
export function cellAt(L, layer, cx, cy) {
  const w = widthOf(L, layer), h = heightOf(L, layer);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return -1;
  return baseOf(L, layer) + cy * w + cx;
}

export function cellXY(L, c) {
  if (c >= L.nestBase) { const i = c - L.nestBase; return [NEST, i % L.nw, Math.floor(i / L.nw)]; }
  return [SURFACE, c % L.sw, Math.floor(c / L.sw)];
}
