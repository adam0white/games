// Each point is both a stop on the ink route and the centre of its button.
const width = 356, height = 388;
const stops = [
  [39,353],[96,345],[153,357],[212,339],[275,351],[320,315],
  [274,279],[212,286],[150,274],[90,287],[40,250],[91,218],[154,222],
  [221,208],[280,183],[317,141],[265,109],[202,134],[141,120],[83,139]
];

export function farm(level) {
  if (level <= 6) return 'Low Beck';
  if (level <= 13) return 'Fellside';
  return 'High Tarn';
}

export function valley(canvas, levels, unlocked, current, stars, select) {
  const scale = Math.min(devicePixelRatio || 1, 3);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function mark(path, fill, stroke, weight = 1) {
    const line = new Path2D(path);
    if (fill) { ctx.fillStyle = fill; ctx.fill(line); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = weight; ctx.stroke(line); }
  }
  function pine(x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    mark('M0 2l-1-11M-1-11l-6 7 6-2 5 2-6-7M-1-15l-5 7 5-3 4 3z', '#697d65', '#596e5e', .75);
    ctx.restore();
  }
  function cottage(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    mark('M-12 0l7-9 9-2 11 7-1 9-18 2-8-3z', '#f4e6c1', '#455746', 1.4);
    mark('M-14 0l8-11 12-2 10 8-13 4-8-7-6 9z', '#a9684b', '#485446', 1.1);
    mark('M-2 0l4-1v6l-4 1zM8-2l3-1v3l-3 1z', '#4b5a48');
    mark('M-19 4l-1 7m-6-9v7m-5-8v6m-1-5 13 4', null, '#69715a', .95);
    ctx.restore();
  }
  ctx.fillStyle = '#ece4c9';
  ctx.fillRect(0, 0, width, height);
  mark('M0 0h356v80q-42-14-78 8t-95-5q-35-19-84 1T0 63z', '#e1d7ba');
  // The tarn, river and crossing stay in register with the route.
  mark('M178 50q19-13 31-6t37 2q16-1 6 8t-36 9q-17-5-30 1t-18-2q-4-6 10-12z', '#a9c3ba', '#849e92');
  const beck = 'M217 56Q179 77 173 105T183 163Q201 192 168 207T176 246Q205 277 173 300T185 340Q199 364 180 397';
  mark(beck, null, '#9bb7ae', 6.5);
  mark(beck, null, '#d4d9bd', 1.3);
  const hills = [
    'M-8 103q31-19 58-50l18-28 16 21 13-11 34 45 24 17',
    'M74 47l-6-17-14 24-4-2-13 19M99 40l8 18 5-3 10 18',
    'M253 77l13-17 11 4 23-38 14 19 8-5 38 36',
    'M288 54l12-23 8 16 5-1 13 20'
  ];
  hills.forEach(path => mark(path, null, '#8e947a', 1.3));
  for (let i = 0; i < 9; i++) {
    ctx.save();
    ctx.translate(-i * 2, i * 5);
    mark('M-20 77q39 8 60-16t31-17', null, '#c1b99b', .8);
    mark('M264 59q23 14 39 8t61 8', null, '#c1b99b', .8);
    ctx.restore();
  }
  for (let i = 0; i < 39; i++) {
    const x = 4 + (i * 73) % 352, y = 149 + (i * 61) % 234;
    mark('M' + x + ' ' + y + 'l4-2m1 4 4-2', null, '#b6b89a', .8);
  }
  const groves = [[14,118],[300,233],[14,303],[130,78],[339,186]];
  for (const [x,y] of groves) {
    for (let j = 0; j < 7; j++) pine(x + j * 4, y + (j * 7 % 12), .48 + (j % 3) * .11);
  }
  // A continuous bridleway joins the numbered fields. Each farm marks a change of pasture.
  ctx.beginPath();
  ctx.moveTo(...stops[0]);
  for (let i = 1; i < stops.length; i++) {
    const [x, y] = stops[i - 1], [nx, ny] = stops[i];
    const prior = stops[Math.max(0, i - 2)], after = stops[Math.min(stops.length - 1, i + 1)];
    ctx.bezierCurveTo(x + (nx - prior[0]) / 6, y + (ny - prior[1]) / 6,
      nx - (after[0] - x) / 6, ny - (after[1] - y) / 6, nx, ny);
  }
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#e4c595';
  ctx.stroke();
  ctx.setLineDash([2.2,3.8]);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#806d52';
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#435449';
  ctx.font = 'italic 17px Georgia, serif';
  const farms = [[48,318,'Low Beck'],[213,249,'Fellside'],[34,96,'High Tarn']];
  for (const [x,y,name] of farms) {
    cottage(x, y-5, .77);
    ctx.fillText(name, x + 16, y);
  }
  levels.replaceChildren();
  stops.forEach(([x,y], i) => {
    const n = i + 1;
    const button = document.createElement('button');
    button.type = 'button';
    button.style.left = x / width * 100 + '%';
    button.style.top = y / height * 100 + '%';
    button.disabled = n > unlocked;
    button.setAttribute('aria-label', 'Evening ' + n);
    button.title = farm(n) + ' · Evening ' + n;
    if (current === n) button.setAttribute('aria-current', 'step');
    const count = document.createElement('span');
    count.className = 'stop';
    count.textContent = n;
    button.append(count);
    if (stars[n]) {
      const marks = document.createElement('small');
      marks.textContent = [1,2,4].map(bit => stars[n] & bit ? '★' : '·').join('');
      marks.setAttribute('aria-hidden','true');
      button.setAttribute('aria-description', marks.textContent.split('★').length - 1 + ' of 3 stars');
      button.append(marks);
    }
    button.onclick = () => select(n);
    levels.append(button);
  });
}
