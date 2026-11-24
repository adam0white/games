import { WIDTH, HEIGHT, EXITS, REST, CASE, MIRROR, FUSE, STAIR, LIFT, RADIUS, distance, targetFor } from './sim.js';

const ink = '#221e37';
const cream = '#fff1cc';
const brass = '#ecc481';
const mint = '#9ce5c3';
const lilac = '#cfb4f3';
const palettes = {
  statue: ['#8e9cb9', '#c9d2ee', '#e7eafc'],
  armor: ['#67aeb2', '#9ce3db', '#cef7e2'],
  bear: ['#b67e73', '#e3a283', '#f8c19b'],
  dino: ['#c29a69', '#e4c480', '#fbe4a0'],
  painting: ['#b383a5', '#eda8b7', '#ffcfbf'],
  twin: ['#8e7bc4', '#c0acef', '#f0d9ff'],
  shy: ['#83ac8a', '#b4de97', '#e5f5bc'],
  bird: ['#9d83b2', '#d4acdd', '#ffe0e3'],
};

function shape(c, points, fill, stroke, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  if (fill) {
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
  }
}

function oval(c, x, y, rx, ry, color, angle = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}

function box(c, x, y, w, h, radius, color, edge, line = 1) {
  c.beginPath();
  c.roundRect(x, y, w, h, radius);
  if (color) {
    c.fillStyle = color;
    c.fill();
  }
  if (edge) {
    c.strokeStyle = edge;
    c.lineWidth = line;
    c.stroke();
  }
}

function ring(c, x, y, r, color, width = 1, start = 0, end = Math.PI * 2) {
  c.beginPath();
  c.arc(x, y, r, start, end);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.stroke();
}

function diamond(c, x, y, r, fill, stroke) {
  shape(c, [[x, y-r], [x+r, y], [x, y+r], [x-r, y]], fill, stroke);
}

function sparkle(c, x, y, r, color) {
  shape(c, [[x, y-r], [x+r*.24, y-r*.24], [x+r, y], [x+r*.24, y+r*.24], [x, y+r], [x-r*.24, y+r*.24], [x-r, y], [x-r*.24, y-r*.24]], color);
}

function eyes(c, x, y, gap, caught, blink, color = ink) {
  for (const off of [-gap, gap]) {
    if (blink) shape(c, [[x+off-2, y], [x+off+2, y]], null, color, 2);
    else oval(c, x+off, y, caught ? 2.8 : 2, caught ? 3.5 : 2.5, color);
  }
}

function bust(c, colors, caught, blink, stride, twin) {
  const [low, mid, high] = colors;
  shape(c, [[-23,-1],[-18,-15],[-8,-21],[8,-21],[18,-15],[23,-1],[16,3],[-16,3]], low, ink, 2);
  shape(c, [[-20,-7],[-11,-16],[-4,-13],[4,-12],[12,-16],[20,-7],[9,-3],[-8,-3]], mid);
  box(c, -6, -28, 12, 13, 4, mid);
  oval(c, 0, -34, 12, 14, high);
  shape(c, [[-11,-34],[-13,-42],[-7,-49],[4,-49],[11,-45],[12,-39],[5,-42],[-3,-40],[-7,-41]], twin ? '#77598c' : low, ink, 1.3);
  if (twin) {
    oval(c, -10, -45, 5, 6, low, -.3);
    oval(c, 10, -45, 5, 6, low, .3);
    diamond(c, 0,-10,4,brass);
  }
  eyes(c, 1, -34, 4.8, caught, blink);
  if (caught) oval(c, 2, -26, 2.3, 2.7, ink);
  else shape(c, [[1,-26], [5,-27]], null, low, 1.4);
  box(c, -18, 1, 36, 7, 2, mid, ink, 1.5);
  if (stride) {
    box(c, -12, 5 + stride, 9, 8, 3, high, ink, 1.4);
    box(c, 3, 5 - stride, 9, 8, 3, high, ink, 1.4);
  }
}

function armor(c, [low, mid, high], caught, blink, stride) {
  for (const side of [-1, 1]) {
    const y = side * stride;
    box(c, side*9-5, -17, 10, 22+y, 4, low, ink, 1.8);
    box(c, side*10-7, 1+y, 14, 6, 2, mid, ink, 1.5);
    shape(c, [[side*15,-31],[side*23,-25],[side*22,-10+y],[side*16,-12+y]], low, ink, 1.7);
    oval(c, side*19, -29, 7, 6, high);
  }
  shape(c, [[-15,-34],[14,-34],[17,-23],[10,-13],[-10,-13],[-16,-23]], mid, ink, 2);
  shape(c, [[-14,-27],[0,-22],[13,-28],[8,-18],[0,-15]], high);
  diamond(c, 0, -24, 4, '#5a918e');
  box(c, -12, -53, 24, 26, 9, high, ink, 2.2);
  box(c, -10, -43, 20, 9, 2, '#24454e');
  eyes(c, 0, -39, 4.3, caught, blink, '#faf5b4');
  shape(c, [[-2,-52],[-2,-60],[7,-64],[17,-56],[8,-57],[4,-52]], '#e2919a', ink, 1.5);
  for (const x of [-5, 0, 5]) oval(c, x, -30, 1, 1, low);
}

function bear(c, [low, mid, high], caught, blink, stride) {
  for (const side of [-1, 1]) {
    oval(c, side*14, -1+side*stride, 10, 7, low);
    oval(c, side*14+1, 1+side*stride, 5, 3, high);
    oval(c, side*20, -17+side*stride, 8, 13, low, side*-.4);
  }
  oval(c, 0, -17, 23, 21, mid);
  oval(c, 0, -9, 14, 10, high);
  for (const side of [-1, 1]) {
    oval(c, side*15, -41, 9, 9, low);
    oval(c, side*15, -42, 5, 5, high);
  }
  oval(c, 0, -31, 19, 15, mid);
  oval(c, 0, -24, 10, 7, high);
  oval(c, 0, -27, 4, 2.7, ink);
  eyes(c, 0, -34, 7, caught, blink);
  if (caught) oval(c, 0, -20, 2.4, 2.8, ink);
  else shape(c, [[-3,-21],[0,-19],[3,-21]], null, ink, 1.25);
  shape(c, [[-9,-15],[-3,-13],[0,-15],[4,-13],[9,-16],[9,-9],[0,-11],[-9,-9]], '#d3708b', ink, 1.1);
}

function dino(c, [low, mid, high], caught, blink, stride) {
  shape(c, [[-34,-7],[-25,-14],[-14,-26],[1,-27],[11,-33],[12,-44]], null, low, 6);
  shape(c, [[-34,-8],[-25,-16],[-14,-27],[1,-28],[11,-34],[12,-44]], null, high, 3.5);
  for (let i = 0; i < 5; i++) {
    const x = -16 + i*4;
    shape(c, [[x,-26],[x+4,-21],[x+4,-12-i*.5]], null, mid, 2.8);
    oval(c, x, -27, 2, 3, high);
  }
  shape(c, [[-9,-20],[-12,-9],[-7+stride,2],[1+stride,2]], null, high, 5);
  shape(c, [[-3,-20],[2,-9],[-1-stride,3],[7-stride,3]], null, mid, 4.5);
  shape(c, [[7,-26],[11,-18+stride],[17,-19+stride]], null, high, 2.8);
  shape(c, [[6,-45],[12,-50],[27,-48],[33,-41],[29,-34],[16,-35],[9,-38]], high, ink, 1.8);
  shape(c, [[15,-35],[21,-29],[32,-31],[33,-35],[23,-33]], mid, ink, 1.3);
  shape(c, [[22,-37],[24,-33],[27,-37],[29,-34],[31,-38]], high);
  oval(c, 19,-42,4,4.5,ink);
  if (!blink) oval(c, caught ? 19 : 20, -42, 1.4, 1.8, cream);
  oval(c, 28,-42,1.3,1.2,low);
}

function portrait(c, [low, mid, high], caught, blink, stride) {
  shape(c, [[-10,-33],[-19,-22+stride],[-24,-24+stride]], null, high, 4);
  shape(c, [[9,-33],[17,-21-stride],[23,-27-stride]], null, high, 4);
  shape(c, [[-5,-11],[-7,2+stride],[-13,3+stride]], null, high, 4.5);
  shape(c, [[5,-11],[7,2-stride],[13,3-stride]], null, high, 4.5);
  shape(c, [[-9,-32],[9,-31],[15,-9],[2,-6],[-13,-11]], mid, ink, 1.6);
  shape(c, [[-7,-24],[10,-23],[12,-17],[-10,-17]], '#ffcf82');
  oval(c, 0,-39,12,13,high);
  shape(c, [[-12,-38],[-13,-46],[-7,-53],[7,-52],[13,-46],[11,-38],[6,-44],[-1,-41],[-8,-43]],low,ink,1.5);
  eyes(c, 0,-39,4.5,caught,blink);
  oval(c, 1,-32,2,caught ? 2.5 : 1, ink);
}

function bird(c, [low, mid, high], caught, blink, stride) {
  shape(c,[[-15,-15],[-28,-17],[-30,-32],[-14,-27]],low,ink,1.3);
  for (const side of [-1, 1]) {
    const x = side * 4;
    shape(c,[[x,-13],[x+side*stride,3],[x+side*stride+5,3]],null,'#e6ac85',2.4);
  }
  oval(c,-9,-19,14,10,mid,-.16);
  shape(c,[[-17,-21],[-7,-19],[-2,-26],[-12,-28]],high,low,1.3);
  shape(c,[[-1,-21],[7,-30],[3,-40],[11,-47]],null,mid,8);
  oval(c,13,-47,10,7,high,-.25);
  shape(c,[[20,-49],[32,-43],[20,-44]],brass,ink,1.2);
  if (blink) shape(c,[[12,-48],[17,-48]],null,ink,1.5);
  else oval(c,15,-48,caught ? 2.6 : 1.8,caught ? 3.4 : 2.1,ink);
  oval(c,11,-43,3,2,'#e691a4');
}

function shy(c, [low, mid, high], caught, blink, stride) {
  box(c,-14,-7+stride,12,12,4,low,ink,1.5);
  box(c,4,-7-stride,12,12,4,low,ink,1.5);
  shape(c,[[-21,-14],[-12,-28],[14,-27],[23,-11],[13,0],[-13,0]],mid,ink,1.8);
  oval(c,0,-29,17,18,high);
  shape(c,[[-15,-30],[-21,-44],[-13,-50],[-6,-42],[6,-42],[15,-49],[20,-42],[15,-29]],mid,ink,1.4);
  box(c,-14,-36,28,13,6,ink);
  eyes(c,0,-30,6,caught,blink,cream);
  if (!stride) shape(c,[[-12,-16],[-5,-23],[5,-23],[12,-16]],null,low,7);
}

export function exhibit(c, kind, x, y, { scale = 1, lit = false, caught = false, motion = 0, walk = false, blink = false, face = 1 } = {}) {
  const stride = walk || caught ? Math.sin(motion*11) * 5 : 0;
  const colors = palettes[kind];
  const toned = lit ? [colors[1], colors[2], '#fff2d0'] : colors;
  c.save();
  c.translate(x, y + (walk ? -Math.abs(stride)*.85 : 0));
  c.scale(scale*face, scale);
  c.rotate(stride*.036);
  if (kind === 'armor') armor(c, toned, caught, blink, stride);
  else if (kind === 'bear') bear(c, toned, caught, blink, stride);
  else if (kind === 'dino') dino(c, toned, caught, blink, stride);
  else if (kind === 'painting') portrait(c, toned, caught, blink, stride);
  else if (kind === 'shy') shy(c, toned, caught, blink, stride);
  else if (kind === 'bird') bird(c, toned, caught, blink, stride);
  else bust(c, toned, caught, blink, stride, kind === 'twin');
  c.restore();
}

function cat(c, x, y, stride, lit) {
  c.save();
  c.translate(x,y);
  const coat = lit ? '#ffdc8d' : '#eab47c';
  shape(c,[[-12,-7],[-21,-10],[-22,-19],[-18,-23]],null,coat,4);
  for (const off of [-1,1]) oval(c, -9*off, off*stride, 5, 3, '#c17b73');
  oval(c,-3,-7,14,8,coat);
  oval(c,8,-11,9,8,coat);
  shape(c,[[1,-14],[1,-23],[8,-17],[12,-17],[17,-23],[17,-13]],coat,ink,1.1);
  eyes(c, 10,-11,3.3,lit,false);
  oval(c, 17,-8,2,2,'#b36b79');
  c.restore();
}

function plinth(c, a) {
  const { x, y } = a.home;
  const [low, mid] = palettes[a.kind];
  if (a.kind === 'painting') {
    box(c,x-27,y-62,54,64,6,'#322942',low,2.5);
    box(c,x-23,y-58,46,54,4,'#513950',brass,1.5);
    box(c,x-18,y-53,36,45,3,'#63536d');
    sparkle(c,x-11,y-43,4,mid);
    oval(c,x+8,y-18,7,5,'#9e6e88');
  } else {
    oval(c,x+3,y+12,33,12,'#151a32');
    shape(c,[[x-28,y],[x-20,y-8],[x+20,y-8],[x+28,y],[x+24,y+11],[x-24,y+11]],'#5e536e','#37364e',2);
    shape(c,[[x-28,y],[x-20,y-8],[x+20,y-8],[x+28,y]],'#8e7697',mid,1.5);
    box(c,x-10,y+3,20,6,2,'#342c44');
    diamond(c,x,y+6,2.6,mid);
  }
}

function arch(c, x, y, w, h, fill, edge, line = 1) {
  c.beginPath();
  c.moveTo(x-w/2,y+h);
  c.lineTo(x-w/2,y+w/2);
  c.arc(x,y+w/2,w/2,Math.PI,0);
  c.lineTo(x+w/2,y+h);
  c.closePath();
  c.fillStyle=fill;
  c.fill();
  if (edge) {
    c.strokeStyle=edge;
    c.lineWidth=line;
    c.stroke();
  }
}

function doorway(c, x, dawn = false) {
  const y = 57;
  arch(c,x,y,87,77,'#3c435d','#a491b4',2);
  const light = c.createLinearGradient(0,y,0,y+76);
  light.addColorStop(0,dawn ? '#ffa980' : '#28445e');
  light.addColorStop(1,dawn ? '#feeeb2' : '#79bac2');
  arch(c,x,y+8,58,64,light,'#cab2b5',1.6);
  oval(c,x+9,y+36,8,8,dawn ? '#fff8c9' : '#d1ebdb');
  if (!dawn) oval(c,x+12,y+33,7,7,'#426781');
  shape(c,[[x-27,y+67],[x-14,y+51],[x+5,y+65],[x+16,y+48],[x+29,y+64],[x+29,y+71],[x-28,y+71]], dawn ? '#cd828b' : '#405b78');
  box(c,x-50,y+71,100,7,2,'#a288a1');
  box(c,x-55,y+79,110,5,2,'#655b78');
  shape(c,[[x, y+99],[x,y+88],[x-5,y+93]],null,mint,1.8);
  shape(c,[[x,y+88],[x+5,y+93]],null,mint,1.8);
  for (const side of [-1,1]) {
    box(c,x+side*65-4,y+35,8,20,3,'#dd9c85');
    oval(c,x+side*65,y+41,4,7,brass);
    box(c,x+side*65-7,y+54,14,4,2,'#806582');
  }
}

function balcony(c) {
  box(c,201,161,83,96,9,'#4d5374','#9899c2',2);
  box(c,207,166,71,82,7,'#5b6684','#73799f');
  for (let i=0;i<7;i++) {
    const y=159+i*6;
    box(c,253,y,29,5,1,i%2 ? '#8481a6' : '#a9a0bd');
  }
  shape(c,[[204,247],[204,257],[282,257],[282,248]],null,'#b9a4bc',3);
  for (let x=208;x<283;x+=13) {
    shape(c,[[x,246],[x,257]],null,'#c0acc4',2);
    oval(c,x,245,2.5,2.5,brass);
  }
  shape(c,[[269,179],[269,169],[264,174]],null,cream,1.7);
}

function floor(c, s) {
  const wall = c.createLinearGradient(0,0,0,HEIGHT);
  wall.addColorStop(0,'#292941');
  wall.addColorStop(.42,'#4c4668');
  wall.addColorStop(1,'#292a43');
  c.fillStyle=wall;
  c.fillRect(0,0,WIDTH,HEIGHT);
  const crown=c.createRadialGradient(195,107,8,195,136,195);
  crown.addColorStop(0,'#a283927a');
  crown.addColorStop(1,'#6d587000');
  c.fillStyle=crown;
  c.fillRect(0,0,390,HEIGHT);
  for (const side of [-1,1]) {
    const x=195+side*113;
    for (let i=0;i<4;i++) diamond(c,x+side*i*9,89+i*3,2.2,'#af8eae78');
  }
  box(c,19,118,352,475,17,'#363954','#7b6a8e',2);
  c.save();
  c.beginPath();
  c.roundRect(23,123,344,467,13);
  c.clip();
  for (let j=0;j<21;j++) for (let i=-1;i<13;i++) {
    const x=23+i*30+(j%2)*15;
    const y=116+j*24;
    shape(c,[[x,y],[x+15,y-12],[x+30,y],[x+15,y+12]],(i+j)%2 ? '#3e405b' : '#40415d','#4d4863',.6);
    if ((i+j)%4===0) diamond(c,x+15,y,1.5,'#6c60776b');
  }
  box(c,142,136,106,451,17,['#65516f','#694961','#4d586e'][s.wing],'#98718b',2);
  box(c,149,142,92,439,13,null,'#a27c91',1);
  box(c,155,151,80,421,10,null,'#795b7d',1);
  for (let j=0;j<8;j++) {
    const y=177+j*51;
    diamond(c,195,y,17,null,'#927189');
    diamond(c,195,y,8,'#79607e');
    diamond(c,195,y,2.5,'#b1869b');
  }
  c.restore();
  for (const x of [26,364]) {
    for (const y of [174,316,465,567]) {
      box(c,x-8,y-19,16,34,4,'#645977','#84718c',1);
      box(c,x-5,y-23,10,8,2,'#9d829a');
      diamond(c,x,y-2,3.4,brass);
    }
  }
  for (const exit of EXITS) doorway(c,exit.x);
  box(c,169,560,52,32,12,'#47425f','#b894a6',1.4);
  box(c,177,563,36,26,8,'#2a2948','#806a8a',1);
  for (const x of [173,217]) diamond(c,x,576,2.5,brass);
  if (s.stairs) balcony(c);
  for (const a of s.actors) {
    const { x,y }=a.home;
    const tone=palettes[a.kind][0];
    c.save();
    c.translate(x,y);
    c.scale(1,.66);
    const halo=c.createRadialGradient(0,0,8,0,0,47);
    halo.addColorStop(0,tone+'70');
    halo.addColorStop(1,tone+'00');
    oval(c,0,0,47,47,halo);
    ring(c,0,0,38,tone+'50',1);
    c.restore();
    plinth(c,a);
  }
  for (const y of [283,415,540]) {
    const x = y % 2 ? 137 : 253;
    diamond(c,x,y,4,'#b091a4');
  }
  box(c,40,538,72,16,6,'#4f4b69','#8a7993');
  for (let i=0;i<4;i++) shape(c,[[48,541+i*3],[104,541+i*3]],null,'#716788',1);
  box(c,293,538,57,16,6,'#4f4b69','#8a7993');
  for (let i=0;i<4;i++) shape(c,[[300,541+i*3],[342,541+i*3]],null,'#716788',1);
  if (s.mirror) {
    const { x, y, width, height } = CASE;
    box(c,x,y,width,height,10,'#729da325','#9ec4c0',1.5);
    shape(c,[[x+3,y+35],[x+33,y+5]],null,'#97c7c880',2);
    shape(c,[[x+58,y+height-5],[x+width-5,y+height-35]],null,'#97c7c880',2);
  }
}

function glow(c, x, y, r, power = 1) {
  const g = c.createRadialGradient(x,y,r*.21,x,y,r*1.3);
  g.addColorStop(0,`rgba(255, 235, 168, ${.42*power})`);
  g.addColorStop(.68,`rgba(255, 220, 141, ${.24*power})`);
  g.addColorStop(1,'rgba(255, 220, 141, 0)');
  c.fillStyle=g;
  c.fillRect(x-r*1.3,y-r*1.3,r*2.6,r*2.6);
}

function torch(c,x,y,beam,blackout) {
  if (beam) {
    const cone=c.createLinearGradient(0,y-9,0,y+LIFT+11);
    cone.addColorStop(0,'#ffe6a100');
    cone.addColorStop(.36,blackout ? '#ead2a907' : '#ffe6a14c');
    cone.addColorStop(1,blackout ? '#ead2a91c' : '#ffe9b592');
    c.beginPath();
    c.moveTo(x-7,y+LIFT+2);
    c.quadraticCurveTo(x-29,y+13,x-47,y-5);
    c.quadraticCurveTo(x,y-31,x+47,y-5);
    c.quadraticCurveTo(x+29,y+13,x+7,y+LIFT+2);
    c.closePath();
    c.fillStyle=cone;
    c.fill();
    glow(c,x,y,RADIUS,blackout ? .13 : 1);
    ring(c,x,y,RADIUS,blackout ? '#ffeabb22' : '#ffedb966',1.2);
    if (!blackout) {
      for (let i=0;i<4;i++) {
        const angle=(i+.5)*Math.PI/2;
        ring(c,x,y,RADIUS,'#ffeabea3',2,angle-.11,angle+.11);
      }
    }
  }
  const py=y+LIFT;
  box(c,x-7,py+6,14,24,5,'#b27a66',ink,2);
  box(c,x-11,py,22,12,4,blackout ? '#977b89' : brass,ink,2);
  box(c,x-8,py+1,16,3,1,blackout ? '#ae92a1' : cream);
  shape(c,[[x-4,py+17],[x+4,py+17]],null,'#f5bd92',2);
}

function mirror(c,s) {
  const { x,y }=MIRROR;
  const live=!!s.bounce && !s.blackout;
  if (live) {
    const p=s.bounce;
    const g=c.createLinearGradient(x,y,p.x,p.y);
    g.addColorStop(0,'#b8ffe675');
    g.addColorStop(1,'#c9ffe632');
    shape(c,[[x,y-20],[p.x,p.y-45],[p.x,p.y+44],[x,y+13]],g);
    glow(c,p.x,p.y,RADIUS,.74);
    ring(c,p.x,p.y,RADIUS,'#baffd388',1.4);
  }
  oval(c,x,y,25,19,'#151a33');
  ring(c,x,y,27,'#90d2c8',1.8,Math.PI*.14,Math.PI*.9);
  oval(c,x,y-10,21,26,brass,-.34);
  oval(c,x,y-10,17,22,live ? '#a3decd' : '#6f9baa',-.34);
  shape(c,[[x-12,y-6],[x+8,y-26]],null,'#cbe8e1',2.5);
  shape(c,[[x,y-5],[x+12,y-17]],null,'#b7dcd6',1);
  sparkle(c,x-19,y-26,6,live ? cream : mint);
}

function fuse(c,s) {
  const {x,y}=FUSE;
  box(c,x-20,y-23,40,31,6,'#242943','#9e839f',2);
  box(c,x-15,y-17,30,20,4,s.fused ? '#648f7d' : '#896987');
  shape(c,[[x+1,y-16],[x-5,y-6],[x+1,y-6],[x-1,y+1],[x+7,y-9],[x+1,y-9]],s.fused ? mint : brass);
  if (s.fuseHold > 0 && !s.fused) ring(c,x,y-8,26,cream,3,-Math.PI/2,-Math.PI/2+Math.PI*2*s.fuseHold/.56);
}

function gesture(c,s,reduced) {
  if (!s.practice || s.hintDone || s.time > s.practice) return;
  const a=s.actors[s.tutorIds[0]];
  const targets = {
    drag:a, hold:a, painting:a, twins:a, mirror:a && targetFor(a),
    shy:a, cat:s.catAt, fuse:FUSE, stairs:a,
  };
  const to=targets[s.lesson];
  if (!to || (a?.frozen && ['drag', 'hold', 'painting'].includes(s.lesson))) return;
  const cycle=reduced ? 2 : (s.time+.25)%3.5;
  const park={x:REST.x,y:REST.y+LIFT};
  const subject={x:to.x,y:Math.min(HEIGHT-43,to.y+LIFT)};
  const avoid=s.lesson==='shy' || s.lesson==='cat';
  const from=avoid ? subject : park;
  const end=avoid ? park : subject;
  const travel=avoid
    ? Math.min(1,Math.max(0,(cycle-.82)/.85))
    : Math.min(1,Math.max(0,(cycle-.28)/1.18));
  const x=from.x+(end.x-from.x)*travel;
  const y=from.y+(end.y-from.y)*travel;
  c.save();
  c.globalAlpha=cycle>3.03 ? (3.5-cycle)/.47 : .84;
  const highlight=avoid ? mint : '#ffda92';
  c.setLineDash([2,9]);
  shape(c,[[from.x,from.y],[end.x,end.y]],null,'#fae4aeab',2);
  c.setLineDash([]);
  ring(c,to.x,to.y,s.lesson==='cat' ? 26 : 48,highlight,2);
  if (s.lesson==='twins') {
    const b=s.actors[s.tutorIds[1]];
    c.setLineDash([4,7]);
    shape(c,[[a.x,a.y],[b.x,b.y]],null,lilac,2);
    c.setLineDash([]);
    ring(c,b.x,b.y,34,lilac,1.5);
  }
  if (s.lesson==='stairs') ring(c,STAIR.x,STAIR.y-18,20,mint,1.6);
  if (s.lesson==='mirror' && !s.bounce && a.y>=CASE.y) {
    const subject=a;
    c.setLineDash([4,7]);
    shape(c,[[to.x,to.y-12],[subject.x,subject.y-16]],null,mint,1.6);
    c.setLineDash([]);
  }
  if (avoid && travel>.2) {
    shape(c,[[to.x-7,to.y-14],[to.x+7,to.y]],null,cream,2.5);
    shape(c,[[to.x+7,to.y-14],[to.x-7,to.y]],null,cream,2.5);
  }
  ring(c,x,y,12+2*travel,cream,2);
  shape(c,[[x-4,y+10],[x-4,y-1],[x,y-3],[x+4,y],[x+4,y+9],[x+10,y+7],[x+19,y+14],[x+18,y+27],[x+5,y+29],[x-5,y+19],[x-10,y+12],[x-8,y+9]],'#fff1ce', '#73627e',1.6);
  c.restore();
}

function renderActor(c,s,a,alpha,reduce) {
  if (a.state==='gone') return;
  const x=a.prevX+(a.x-a.prevX)*alpha;
  const y=a.prevY+(a.y-a.prevY)*alpha;
  const walk=(a.state==='roam' && !a.frozen && a.motion>a.oldMotion) || a.state==='return';
  const caught=a.state==='roam' && a.frozen;
  const motion=reduce ? 0 : a.oldMotion+(a.motion-a.oldMotion)*alpha;
  const source = a.lit && s.bounce && distance(a,s.bounce) < RADIUS ? s.bounce : s.light;
  const shadowX=a.lit ? (x-source.x)*.37 : 3;
  const shadowY=a.lit ? Math.min(22,9+(y-source.y)*.19) : 7;
  c.save();
  c.translate(x+shadowX,y+shadowY);
  c.rotate(shadowX*.014);
  c.scale(1,.43);
  const shade=c.createRadialGradient(0,0,3,0,0,a.lit ? 33 : 29);
  shade.addColorStop(0,'#1a1735ca');
  shade.addColorStop(.61,'#1a173597');
  shade.addColorStop(1,'#1a173500');
  oval(c,0,0,34,34,shade);
  c.restore();
  oval(c,x+2,y+3,14,4,'#211c3670');
  if (a.state==='roam' && !caught) {
    const dot = a.kind==='shy' ? mint : a.progress>.67 ? '#ffae9f' : brass;
    const ox = y <= 170 ? x+(x>195 ? 20 : -20) : x;
    diamond(c,ox,y+16,3.4,dot);
    if (a.progress>.67) ring(c,x,y,27,'#ed9b8555',1.5);
  }
  exhibit(c,a.kind,x,y,{
    scale:a.upstairs && a.progress < .32 ? .82 : 1,
    caught:caught || a.state==='return',lit:a.lit,motion,walk,
    blink:!reduce && !caught && (s.time+a.id*.53)%4.1<.11,
    face:a.kind==='dino' && x>195 ? -1 : 1,
  });
  if (caught && a.hold > 0) {
    ring(c,x,y+5,31,'#28203caf',3,-Math.PI*.9,-Math.PI*.1);
    ring(c,x,y+5,31,cream,3,-Math.PI*.9,-Math.PI*.9+Math.PI*.8*a.hold/a.holdTime);
    sparkle(c,x+16,y-48,5,cream);
  }
}

export function renderer(canvas) {
  const c=canvas.getContext('2d',{ alpha:false });
  const backdrop=document.createElement('canvas');
  backdrop.width=WIDTH*2;
  backdrop.height=HEIGHT*2;
  const b=backdrop.getContext('2d');
  b.scale(2,2);
  let last=null;
  return {
    draw(s, alpha, now, effects, reduced, tutorial) {
      if (last!==s) {
        floor(b,s);
        last=s;
      }
      c.setTransform(canvas.width/WIDTH,0,0,canvas.height/HEIGHT,0,0);
      c.drawImage(backdrop,0,0,WIDTH,HEIGHT);
      const time=s.time;
      const dawn=Number.isFinite(s.duration) ? Math.max(0,time-s.duration+8)/8 : 0;
      if (dawn) {
        c.fillStyle=`rgba(238,174,128,${dawn*.13})`;
        c.fillRect(20,118,350,475);
        for (const exit of EXITS) doorway(c,exit.x,dawn>.38);
      }
      const x=s.oldLight.x+(s.light.x-s.oldLight.x)*alpha;
      const y=s.oldLight.y+(s.light.y-s.oldLight.y)*alpha;
      torch(c,x,y,true,s.blackout);
      if (s.mirror) mirror(c,s);
      if (s.fuse) fuse(c,s);
      for (const e of effects) if (e.type==='foot') {
        c.save();
        c.globalAlpha=reduced ? .92 : .75*Math.max(0,1-(now-e.at)/e.life);
        oval(c,e.x-4,e.y+5,3.2,5,'#ffd29c',-.35);
        oval(c,e.x+5,e.y+9,2.7,4,'#ffd29c',.38);
        c.restore();
      }
      for (const a of [...s.actors].sort((p,q)=>p.y-q.y)) renderActor(c,s,a,alpha,reduced);
      if (s.catAt) cat(c,s.catAt.x,s.catAt.y,reduced ? 0 : Math.sin(time*18)*3,s.catLit);
      for (const e of effects) {
        if (e.type==='foot') continue;
        const age=Math.min(1,(now-e.at)/e.life);
        c.save();
        c.globalAlpha=1-age;
        if (e.type==='touch') ring(c,e.x,e.y,8+(reduced ? 6 : age*22),cream,2);
        if (e.type==='escape') {
          ring(c,e.x,e.y-22,21+age*25,'#ff9b9f',3);
          sparkle(c,e.x+18,e.y-28,10,'#ffd0b8');
        }
        if (e.type==='return' || e.type==='fuse') {
          for (let i=0;i<5;i++) {
            const r=reduced ? 24 : 15+age*25;
            const centerY=e.y-(e.type==='fuse' ? 8 : 23);
            sparkle(c,e.x+Math.cos(i*1.26)*r,centerY+Math.sin(i*1.26)*r,5,cream);
          }
        }
        c.restore();
      }
      if (tutorial) gesture(c,s,reduced);
    },
  };
}

export function cover(canvas, mode = 'menu', count = 0, day = '', escapes = 0) {
  const c=canvas.getContext('2d');
  const w=canvas.width;
  const h=canvas.height;
  const card=mode==='share' || mode==='share-loss';
  const win=mode==='dawn' || mode==='share';
  if (card) {
    const picture = document.createElement('canvas');
    picture.width = 680;
    picture.height = 364;
    cover(picture, win ? 'dawn' : 'escaped');
    c.setTransform(w / 340, 0, 0, h / 270, 0, 0);
    c.fillStyle = '#302b46';
    c.fillRect(0, 0, 340, 270);
    c.fillStyle = cream;
    c.textAlign = 'center';
    c.font = 'bold 26px Georgia,serif';
    c.fillText('Tiptoe Museum', 170, 31);
    c.font = 'bold 15px system-ui';
    c.fillText('Daily · ' + day, 170, 54);
    c.drawImage(picture, 12, 64, 316, 169);
    c.fillStyle = cream;
    c.font = 'bold 17px system-ui';
    c.fillText(escapes + ' escaped', 89, 258);
    c.fillText('Streak ' + count, 251, 258);
    return;
  }
  c.setTransform(w/340,0,0,h/182,0,0);
  c.clearRect(0,0,340,182);
  const top=win ? '#724866' : '#302d50';
  const g=c.createLinearGradient(0,0,0,180);
  g.addColorStop(0,top);
  g.addColorStop(1,win ? '#db927e' : '#625372');
  box(c,1,1,338,180,22,g,'#a68ba8',1.4);
  c.save();
  c.beginPath();
  c.roundRect(2,2,336,178,21);
  c.clip();
  for (let i=0;i<25;i++) {
    const x=(i*79+11)%343;
    const y=(i*47+19)%130;
    sparkle(c,x,y,i%5===0 ? 3.3 : 1.2,'#f5cfb089');
  }
  for (let i=0;i<8;i++) shape(c,[[0,129+i*9],[340,129+i*9]],null,'#947b9850',1);
  for (let i=-4;i<11;i++) shape(c,[[i*42,182],[132+i*14,108]],null,'#b497a258',1);
  arch(c,171,14,108,126,'#262b48','#a188a2',3);
  arch(c,171,22,85,111,win ? '#f3b392' : '#526180','#bd9cab',1.5);
  oval(c,173,66,22,22,win ? '#ffe9a9' : '#fae3bd');
  if (!win) oval(c,181,59,19,20,'#526180');
  shape(c,[[128,116],[147,96],[170,111],[194,91],[214,111],[214,134],[128,134]],win ? '#b7788d' : '#374764');
  shape(c,[[145,132],[194,132],[250,182],[89,182]],win ? '#ffddaa60' : '#fff1b658');
  glow(c,171,119,51,.52);
  oval(c,96,147,47,12,'#251f39a0');
  oval(c,250,146,46,12,'#251f39a0');
  exhibit(c,'armor',93,141,{scale:1.37,lit:true,caught:true,motion:.41});
  exhibit(c,'bear',180,155,{scale:1.02,lit:true,caught:true,motion:.18});
  exhibit(c,'dino',252,143,{scale:1.34,face:-1,caught:true,motion:.38});
  if (mode==='escaped') {
    cat(c,43,163,2,true);
    sparkle(c,57,131,6,cream);
  }
  c.restore();
}

export function clock(canvas, state) {
  const c=canvas.getContext('2d');
  c.setTransform(canvas.width/118,0,0,canvas.height/50,0,0);
  c.clearRect(0,0,118,50);
  const finite=Number.isFinite(state.duration);
  const t=finite ? Math.min(1,state.time/state.duration) : (state.time%60)/60;
  box(c,1,1,116,48,18,'#26243f','#8e7898',1.5);
  for (let i=0;i<5;i++) oval(c,11+i*24,42,1.5,1.5,'#b294b1');
  box(c,11,38,96,2,1,'#705976');
  box(c,11,38,96*t,2,1,brass);
  oval(c,20,19,7,7,'#c9b2eb');
  oval(c,23,16,6.5,6.5,'#26243f');
  ring(c,59,19,11,'#bca3c2',1.35);
  for (let i=0;i<4;i++) diamond(c,59+Math.cos(i*Math.PI/2)*8,19+Math.sin(i*Math.PI/2)*8,1.15,brass);
  const angle=t*Math.PI*2-Math.PI/2;
  shape(c,[[59,19],[59+Math.cos(angle)*7,19+Math.sin(angle)*7]],null,cream,1.6);
  oval(c,59,19,1.6,1.6,brass);
  oval(c,97,19,5,5,brass);
  for (let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    shape(c,[[97+Math.cos(a)*8,19+Math.sin(a)*8],[97+Math.cos(a)*10,19+Math.sin(a)*10]],null,brass,1.3);
  }
}
