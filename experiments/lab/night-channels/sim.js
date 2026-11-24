// Coordinates are cell centres, x across the hill and y downhill. One tick is 1/30 s.
// A digit is a seedbed, ~ is an existing furrow, : is sand and # is bedrock.
const gardens = [
  [5, ['...S...', '.#.~...', '...~..#', '.......', '#.....:', '.......', '...1...', '.:...#.', '.......']],
  [8, ['.S.....', '.~...#.', '...#...', '.##....', '.......', '.:..1..', '..:....', '.....#.', '.......']],
  [10,['...S...', '...~...', '.#.....', '...#...', '....#..', '.1...2.', '.......', '.:....:', '...#...']],
  [12,['..S....', '..~..#.', '..::...', '.::::..', '...#...', '.1...:.', '....2..', '.......', '.#.....']],
  [13,['....S..', '....~..', '..###..', '...:...', '.1...#.', '.####..', '.......', '..2....', '......:']],
  [13,['...S...', '#..~...', '..:...#', '.:...:.', '.1.#.2.', '.......', '..#....', '...3...', '.:...:.']],
  [14,['.S.....', '.~..#..', '.###...', '....:..', '....#1.', '..#....', '..:##..', '.2...3.', '......:']],
  [14,['.....S.', '...#.~.', '.1...:.', '..##.:.', '......2', '..:##..', '..:....', '..3....', '.....#.']],
  [16,['...S...', '...~..#', '.:###..', '.....1.', '..#..#.', '.2:....', '.####..', '....3..', '...:...']],
  [17,['...S...', '.#.~.#.', '.1...2.', '..:.:..', '..###..', '.:...:.', '...#...', '.3...4.', '#.....#']]
];

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function generator(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function dailyGarden(random) {
  const rows = Array.from({length: 9}, () => Array(7).fill('.'));
  const start = 2 + Math.floor(random() * 3);
  const targets = [
    [Math.floor(random()*2), 3 + Math.floor(random()*3)],
    [5 + Math.floor(random()*2), 4 + Math.floor(random()*3)],
    [2 + Math.floor(random()*3), 7 + Math.floor(random()*2)]
  ];
  // Protect a spanning tree. Other available ground still offers shorter routes.
  const junction = 2 + Math.floor(random()*2);
  const open = new Set();
  for (const [x,y] of targets) {
    for (let row=0; row<=junction; row++) open.add(row*7+start);
    for (let col=Math.min(start,x); col<=Math.max(start,x); col++) open.add(junction*7+col);
    for (let row=junction; row<=y; row++) open.add(row*7+x);
  }
  for (let i=0; i<63; i++) {
    const r = random();
    if (r < .22 && !open.has(i)) rows[Math.floor(i/7)][i%7] = '#';
    else if (r < .38) rows[Math.floor(i/7)][i%7] = ':';
  }
  rows[0][start] = 'S';
  rows[1][start] = '~';
  targets.forEach(([x,y]) => { rows[y][x] = '1'; });
  return [open.size + 1, rows.map(row => row.join(''))];
}

const LOWER = 1.55;
const DT = 1/30;

export function create(level, day=null) {
  if (!Number.isInteger(level) || level<1 || level>10) throw new RangeError('Garden must be 1 to 10');
  const seed = hash(day === null ? 'garden/' + level : 'day/' + day);
  const random = generator(seed);
  const [budget, map] = day === null ? gardens[level-1] : dailyGarden(random);
  const rows=map.length, cols=map[0].length;
  const cells=[], beds=[], edges=[];
  let source;
  for (const [y,row] of map.entries()) {
    for (const [x,mark] of [...row].entries()) {
      const i = y*cols+x;
      const kind = ({'#':'rock', ':':'sand', S:'spring'})[mark] || (/\d/.test(mark) ? 'bed' : 'soil');
      const dug = mark==='~';
      const low = dug || kind==='bed' || kind==='spring';
      const height = (rows-1-y)*.052 + random()*.022 + (low ? 0 : LOWER);
      const water = kind==='spring' ? .57 : dug ? .33 : 0;
      cells.push({kind, height, dug, water, moisture:dug ? .26 : 0, growth:0, flowX:0, flowY:0});
      if (kind==='bed') beds.push(i);
      if (kind==='spring') source=i;
      if (x) edges.push([i-1,i,1,0]);
      if (y) edges.push([i-cols,i,0,1]);
    }
  }
  const initialWater = cells.reduce((sum,c) => sum+c.water+c.moisture,0);
  return {cols, rows, seed, level, source, cells, beds, budget, remaining:budget, ticks:0, won:false,
    initialWater, supplied:0, drained:0, edges};
}

export function dig(s,index) {
  const c = s.cells[index];
  if (!Number.isInteger(index) || !c || s.won || !s.remaining || c.dug ||
      (c.kind!=='soil' && c.kind!=='sand')) return false;
  c.dug=true;
  c.height-=LOWER;
  s.remaining--;
  return true;
}

// Horizontal flux depends on the difference in free-surface elevation across a face.
// All faces use the same snapshot. A donor can give at most its available depth.
export function tick(s) {
  if (s.won) return;
  s.ticks++;
  const cells = s.cells;
  const source = cells[s.source];
  const feed = Math.min(.078,Math.max(0,.66-source.water));
  source.water+=feed;
  s.supplied+=feed;

  const outgoing = new Float64Array(cells.length);
  const flux = new Float64Array(s.edges.length);
  for (let i=0; i<s.edges.length; i++) {
    const [a,b]=s.edges[i];
    const u=cells[a], v=cells[b];
    if (u.kind==='rock' || v.kind==='rock') continue;
    const diff=u.height+u.water-v.height-v.water;
    const q=diff*.23;
    if (q>0 && u.water>0) { outgoing[a]+=q; flux[i]=q; }
    if (q<0 && v.water>0) { outgoing[b]-=q; flux[i]=q; }
  }
  for (let i=0; i<cells.length; i++) {
    outgoing[i]=outgoing[i] ? Math.min(1,cells[i].water/outgoing[i]) : 0;
    cells[i].flowX=0;
    cells[i].flowY=0;
  }
  for (let i=0; i<s.edges.length; i++) {
    if (!flux[i]) continue;
    const [a,b,dx,dy]=s.edges[i];
    const q=flux[i]*outgoing[flux[i]>0 ? a : b];
    cells[a].water-=q;
    cells[b].water+=q;
    // Signed through-flow for the renderer. A stream keeps its direction in a full cell.
    cells[a].flowX += q*dx;
    cells[b].flowX += q*dx;
    cells[a].flowY += q*dy;
    cells[b].flowY += q*dy;
  }

  for (const c of cells) {
    if (c.kind==='rock' || c.kind==='spring') continue;
    const sand=c.kind==='sand', bed=c.kind==='bed';
    const rate = sand ? .022 : bed ? .009 : .0023;
    const soak = Math.min(Math.max(0,c.water), (1-c.moisture)*rate);
    c.water-=soak;
    c.moisture+=soak;
    const deep = Math.min(c.moisture, sand ? .003 : bed ? .0016 : .00055);
    s.drained+=deep;
    c.moisture-=deep;
    if (bed && c.growth<1) {
      const wet=c.moisture>=.065;
      c.growth=Math.max(0,Math.min(1,c.growth + DT*(wet ? .34 : -.2)));
    }
  }
  s.won=s.beds.every(i=>cells[i].growth===1);
}
