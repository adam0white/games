// Grid units here are for drawing and hit-testing. Only integer cell IDs reach the sim.
import { COLS, ROWS, cell, col, row, route, random, UNSEAL } from './sim.js';

const PALETTE = ['#ffc172', '#9ce3d9'];
const center = p => [col(p) + .5, row(p) + .5];

export function field(canvas, t) {
  const ctx = canvas.getContext('2d');
  const soil = document.createElement('canvas');
  soil.width = COLS * 32; soil.height = ROWS * 32;
  const dirt = soil.getContext('2d');
  let size = 1, left = 0, top = 0, cw = 0, ch = 0, lastMap;

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (cw !== w || ch !== h || canvas.width !== Math.round(w * dpr)) {
      cw = w; ch = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    size = Math.max(1, Math.min(w / COLS, h / ROWS));
    left = (w - COLS * size) / 2; top = (h - ROWS * size) / 2;
    ctx.setTransform(dpr * size, 0, 0, dpr * size, dpr * left, dpr * top);
    ctx.clearRect(-left / size, -top / size, w / size, h / size);
  }

  function terrain(map, seed) {
    const rand = random(seed);
    dirt.setTransform(32, 0, 0, 32, 0, 0);
    const fill = dirt.createLinearGradient(0, 0, 3, ROWS);
    fill.addColorStop(0, '#21413f'); fill.addColorStop(.31, '#343a33');
    fill.addColorStop(.57, '#514537'); fill.addColorStop(1, '#593d2c');
    dirt.fillStyle = fill; dirt.fillRect(0, 0, COLS, ROWS);
    for (const [p, kind] of map.rows.entries()) {
      const x = col(p), y = row(p);
      if (!kind) {
        dirt.fillStyle = '#222827';
        dirt.fillRect(x, y, 1, 1);
        dirt.fillStyle = rand() % 2 ? '#363c39' : '#303633';
        dirt.beginPath();
        dirt.moveTo(x + .08, y + .31); dirt.lineTo(x + .63, y + .02); dirt.lineTo(x + .94, y + .23);
        dirt.lineTo(x + .86, y + .7); dirt.lineTo(x + .32, y + .95); dirt.lineTo(x + .04, y + .69); dirt.fill();
      } else if (kind > 1) {
        dirt.fillStyle = kind === 3 ? '#192222' : '#745c44';
        dirt.fillRect(x, y, 1, 1);
        dirt.strokeStyle = '#c1a77b55'; dirt.lineWidth = .04;
        dirt.strokeRect(x + .08, y, .84, 1);
        if (kind === 3) {
          dirt.fillStyle = '#88765d';
          dirt.fillRect(x + .06, y + .1, .88, .13);
        }
      }
      for (let i = 0; i < 9; i++) {
        dirt.fillStyle = rand() % 3 ? '#f9edc926' : '#090f0e50';
        dirt.fillRect(x + rand() % 95 / 100, y + rand() % 95 / 100, (1 + rand() % 4) / 100, .035);
      }
    }
    dirt.strokeStyle = '#c1a77b70'; dirt.lineWidth = .08;
    dirt.strokeRect(.04, .04, COLS - .08, ROWS - .08);
  }

  function disk(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function line(points, color, width, dash = []) {
    if (points.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(...points[0]);
    for (const p of points.slice(1)) ctx.lineTo(...p);
    ctx.stroke(); ctx.setLineDash([]);
  }

  function queen(p, side, sealed) {
    const [x, y] = center(p);
    disk(x, y, .48, '#171d1c');
    ctx.strokeStyle = PALETTE[side]; ctx.lineWidth = .055;
    ctx.beginPath(); ctx.arc(x, y, .43, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PALETTE[side];
    ctx.beginPath();
    ctx.moveTo(x - .24, y - .17); ctx.lineTo(x - .12, y - .02); ctx.lineTo(x, y - .23);
    ctx.lineTo(x + .12, y - .02); ctx.lineTo(x + .24, y - .17); ctx.lineTo(x + .18, y + .16);
    ctx.lineTo(x - .18, y + .16); ctx.fill();
    ctx.font = '.56px system-ui'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(t('queen') + (sealed ? ' · ▪' : ''), x + 1.75, y);
  }

  function position(a, side, elapsed) {
    const [fromX, fromY] = center(a.prev), [toX, toY] = center(a.pts);
    const u = Math.max(0, Math.min(1, (elapsed - a.moved) / (a.caste ? 5 : 3)));
    return [fromX + (toX - fromX) * u + ((a.id * 31 + side * 7) % 23 - 11) * .052,
      fromY + (toY - fromY) * u + ((a.id * 43 + side * 13) % 29 - 14) * .035];
  }

  function ant(a, side, xy) {
    const major = a.caste === 1;
    ctx.save(); ctx.translate(...xy);
    const dx = col(a.pts) - col(a.prev), dy = row(a.pts) - row(a.prev);
    ctx.rotate(dx || dy ? Math.atan2(dy, dx) : side ? Math.PI / 2 : -Math.PI / 2);
    if (a.role === 'limp') ctx.globalAlpha = .62;
    const r = major ? .115 : .075;
    for (const x of [-r, 0, r]) for (const sign of [-1, 1]) line([[x, 0], [x - .065, sign * r * 1.75]], '#1b201c', .035);
    disk(-r * 1.6, 0, r * 1.1, PALETTE[side]);
    disk(0, 0, r * .65, PALETTE[side]);
    disk(r * 1.25, 0, r * .83, major ? '#fff0bf' : PALETTE[side]);
    ctx.restore();
  }

  function clash(g, locations) {
    const groups = new Map();
    for (const pin of g.pins) {
      const ends = pin.ants.map((group, side) => group.map(id => locations[side][id]).filter(Boolean));
      if (!ends[0].length || !ends[1].length) continue;
      const [a, b] = ends.map(group => group[0]);
      const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
      for (const edge of ends.flat()) line([edge, [x, y]], '#ffe6a28a', .04);
      const key = pin.lane + ':' + pin.y;
      if (!groups.has(key)) groups.set(key, { lane: pin.lane, front: pin.y, pins: [] });
      groups.get(key).pins.push([x, y]);
    }
    for (const { lane, front, pins } of groups.values()) {
      const [x, y] = [0, 1].map(axis => pins.reduce((sum, p) => sum + p[axis], 0) / pins.length);
      const margin = lane === 0 ? [0.4, 4.6] : lane === 1 ? [5.4, 10.6] : [11.4, 14.6];
      line([[margin[0], front + .7], [margin[1], front + .7]], '#ffc172', .085, [.16, .14]);
      disk(x, y, .42, '#282520');
      ctx.strokeStyle = '#ffe2a8'; ctx.lineWidth = .08;
      ctx.beginPath(); ctx.arc(x, y, .38, 0, Math.PI * 2); ctx.stroke();
      line([[x - .15, y - .15], [x + .15, y + .15]], '#ffe2a8', .09);
      line([[x - .15, y + .15], [x + .15, y - .15]], '#ffe2a8', .09);
      ctx.fillStyle = '#fff1d9'; ctx.font = 'bold .48px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(pins.length), x, y - .68);
    }
  }

  return {
    draw(g, preview, elapsed, flag) {
      fit();
      if (lastMap !== g.map) { terrain(g.map, g.seed); lastMap = g.map; }
      ctx.drawImage(soil, 0, 0, COLS, ROWS);
      for (const [side, p] of g.map.queens.entries()) queen(p, side, g.t < UNSEAL);
      const points = (preview?.length ? preview : g.sides[0].trail);
      const trail = route(g, g.map.queens[0], points);
      line(trail.map(center), '#151a17', .22);
      line(trail.map(center), '#ffbd7466', .115, [.16, .17]);
      if (points.length) disk(...center(points.at(-1)), .19, PALETTE[0]);

      const locations = g.sides.map((s, side) => s.ants.map(a => {
        if (['home', 'rest', 'dead'].includes(a.role)) return null;
        const xy = position(a, side, elapsed);
        ant(a, side, xy);
        return xy;
      }));
      clash(g, locations);

      const alarm = g.sides[0].alarm;
      if (alarm >= 0) {
        const [x, y] = center(alarm);
        ctx.strokeStyle = PALETTE[0]; ctx.lineWidth = .085;
        ctx.beginPath(); ctx.arc(x, y, .75, 0, Math.PI * 2); ctx.stroke();
        if (flag) {
          line([[x - .14, y + .32], [x - .14, y - .45], [x + .34, y - .29], [x - .14, y - .12]], PALETTE[0], .085);
        } else disk(x, y, .16, PALETTE[0]);
      }
    },
    hit(clientX, clientY) {
      const box = canvas.getBoundingClientRect();
      const x = Math.floor((clientX - box.left - left) / size), y = Math.floor((clientY - box.top - top) / size);
      return x >= 0 && x < COLS && y >= 0 && y < ROWS ? cell(x, y) : -1;
    },
    point(p) {
      const box = canvas.getBoundingClientRect(), [x, y] = center(p);
      return { x: box.left + left + x * size, y: box.top + top + y * size };
    },
  };
}
