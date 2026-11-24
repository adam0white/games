// The glasshouse is a fixed print. Only the plant, lamp and light change each frame.
const TAU = Math.PI * 2;
const palettes = {
  vesper: {
    sky: ['#24263e','#54465d','#9e6977','#da9e8b'], mist: '#ead3af',
    far: '#8f7182', hill: '#665a70', cypress: '#4d495c', field: '#514d5f',
    arch: '#29323b', gold: '#9b826c', pane: '#e6c6ae',
    leaf: ['#497e69','#6c9c70','#91ac78'], fold: ['#305f54','#43815f','#678f61'],
    oldLeaf: '#dce1a2', pot: '#397575', potDark: '#234c53',
  },
  cobalt: {
    sky: ['#141f44','#314c76','#847587','#dfaa83'], mist: '#f4ce95',
    far: '#837e92', hill: '#515c79', cypress: '#35485c', field: '#3a5365',
    arch: '#223240', gold: '#aa886a', pane: '#e8cda4',
    leaf: ['#598279','#6ca18b','#a4b888'], fold: ['#325b60','#407d73','#6a946f'],
    oldLeaf: '#fae0a5', pot: '#51728b', potDark: '#30485f',
  },
};
function noise(n) { const x = Math.sin(n * 127.1 + 31.58) * 43758.5453; return x - Math.floor(x); }
function ink(c, d, fill, stroke, width = 1) {
  const path = typeof d === 'string' ? new Path2D(d) : d;
  if (fill) { c.fillStyle = fill; c.fill(path); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(path); }
}
function line(c, x, y, ex, ey, color, width = 1) {
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
function oval(c, x, y, rx, ry, color, angle = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, TAU); c.fillStyle = color; c.fill();
}
function loop(c, x, y, r, color, width = 1) {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
function star(c,x,y,r,color) {
  c.save(); c.translate(x,y); c.scale(r,r);
  ink(c,'M0 -1 Q.06 -.13 .72 0 Q.07 .06 0 1 Q-.07 .07 -.72 0 Q-.08 -.12 0 -1Z',color);
  c.restore();
}
function glow(c, x, y, r, stops) {
  const paint = c.createRadialGradient(x,y,0,x,y,r);
  for (const [at,color] of stops) paint.addColorStop(at,color);
  c.fillStyle = paint; c.fillRect(x-r,y-r,r*2,r*2);
}
function cypress(c,x,y,height,color) {
  c.save(); c.translate(x,y); c.scale(height/60,height/60);
  ink(c,'M-1 1 L-1 -8 Q-9 -12 -6 -23 L-7 -23 Q-4 -31 -5 -34 Q-1 -45 0 -60 Q4 -46 3 -39 Q7 -35 5 -29 Q10 -21 7 -19 Q10 -11 2 -8 L2 1Z',color);
  c.restore();
}
function landscape(c,p) {
  const sky = c.createLinearGradient(0,0,0,397);
  [0,.38,.75,1].forEach((stop,i)=>sky.addColorStop(stop,p.sky[i]));
  c.fillStyle=sky; c.fillRect(0,0,360,480);
  // Long, tapered cloud bands show through the individual panes.
  for(let i=0;i<16;i++) {
    let x=noise(i+40)*390-45, y=120+noise(i+47)*168, w=18+noise(i+52)*56;
    c.globalAlpha=.07+noise(i+59)*.08;
    c.beginPath(); c.moveTo(x,y); c.bezierCurveTo(x+w*.4,y-5,x+w*.65,y-3,x+w,y-2);
    c.bezierCurveTo(x+w*.8,y,x+w*.24,y+1,x,y); c.fillStyle=p.mist; c.fill();
  }
  c.globalAlpha=1;
  for(let i=0;i<93;i++) {
    const x=12+noise(i+110)*336, y=noise(i+215)*242;
    c.globalAlpha=(1-y/280)*(.32+noise(i+324)*.6);
    if(i%12===0) star(c,x,y,2.2+noise(i+205)*1.6,p.mist);
    else oval(c,x,y,.34+noise(i+301)*.65,.44+noise(i+301)*.65,p.mist);
  }
  c.globalAlpha=1;
  glow(c,101,122,52,[[0,'#fff0bf20'],[1,'#fff0bf00']]);
  c.save(); c.translate(101,122); c.rotate(-.35);
  ink(c,'M1 -14 C-15 -14 -18 6 -6 13 Q4 19 14 9 C0 14 -11 -2 1 -14Z','#e4d3b4');
  c.restore();
  ink(c,'M0 324 Q25 298 63 308 Q83 300 101 303 Q134 288 150 291 Q176 275 198 289 Q220 277 245 286 Q271 275 291 280 Q332 260 360 277 L360 440 H0Z',p.far);
  ink(c,'M0 318 Q35 311 75 330 Q132 330 163 306 Q187 296 224 301 Q260 307 293 287 Q320 276 360 292 V440 H0Z',p.hill);
  // A hillside arcade and a row of cypresses give the view a human scale.
  c.save(); c.translate(218,307);
  ink(c,'M-4 -2 L38 -8 L67 -7 V5 H-4Z',p.cypress);
  for(let i=0;i<7;i++) {
    const y=i<4?-i: -3.5;
    c.beginPath(); c.arc(i*9,y,2.5,Math.PI,TAU);
    c.lineTo(i*9+2.5,5); c.lineTo(i*9-2.5,5); c.closePath(); c.fillStyle=p.hill; c.fill();
  }
  c.restore();
  for(let i=0;i<17;i++){
    const x=i<11?i*9+20:289+(i-11)*7, y=i<11?326+i*.55:305-(i-11)*1.4;
    cypress(c,x,y,9+noise(i+631)*16,p.cypress);
  }
  ink(c,'M0 336 Q52 326 103 339 T211 328 Q275 304 360 312 V455 H0Z',p.field);
  c.save(); c.globalAlpha=.33;
  for(let i=0;i<13;i++){
    c.beginPath(); c.moveTo(185+i*6,329); c.bezierCurveTo(166+i*9,348,96+i*15,350,52+i*24,397);
    c.strokeStyle=p.far;c.lineWidth=i%2?.55:1;c.stroke();
  }
  c.restore();
  ink(c,'M0 376 Q62 351 106 364 Q151 375 216 351 Q270 338 360 357 V480 H0Z','#303d46');
  for(let i=0;i<23;i++){
    const x=noise(i+465)*372,y=378+noise(i+447)*16;
    cypress(c,x,y,8+noise(i+481)*20,'#34434a');
  }
}
const archShape = new Path2D('M14 440 V152 C14 78 82 31 180 8 C278 31 346 78 346 152 V440');
function architecture(c,p) {
  // The fanlight has shaped ribs. Reflections stop cleanly at the glass edge.
  c.save(); const inside = new Path2D(archShape); inside.closePath(); c.clip(inside);
  for(const [x,y] of [[34,74],[121,0],[270,81],[184,281],[42,310],[306,295]]) {
    c.globalAlpha=.027; ink(c,`M${x} ${y}l10 0 -76 134 -4 0z`,p.pane);
    c.globalAlpha=.045; ink(c,`M${x+18} ${y}l2 0 -60 105 -1 0z`,p.pane);
  }
  c.globalAlpha=1;
  for(const x of [63,180,297]) line(c,x,159,x,421,'#28343c88',1.45);
  for(const y of [159,263,361]) {
    line(c,0,y,360,y,'#202f3aa8',2.4); line(c,0,y+1.6,360,y+1.6,'#e1bfaa38',.6);
  }
  for(const x of [63,180,297]) for(const y of [159,263,361]){
    oval(c,x,y,2.1,2.1,'#4b4c51');oval(c,x-.45,y-.6,.68,.68,'#ac99936e');
  }
  for(const d of ['M14 158 Q30 86 90 48','M14 158 Q95 123 180 10','M346 158 Q265 123 180 10','M346 158 Q330 86 270 48','M180 159 V11']) {
    ink(c,d,null,'#2c323ec2',2);
  }
  c.restore();
  ink(c,'M0 0 H360 V440 H346 V152 C346 78 278 31 180 8 C82 31 14 78 14 152 V440 H0Z',p.arch);
  ink(c,archShape,null,'#172832',6.5);
  ink(c,archShape,null,p.gold,1.25);
  ink(c,'M5 435 V151 Q6 52 156 4 M355 435 V151 Q354 52 204 4',null,'#7a7569',.85);
  // Engraved foliate corner brackets.
  for(const mirror of [false,true]) {
    c.save(); if(mirror){c.translate(360,0);c.scale(-1,1);}
    ink(c,'M7 13 H85 Q47 29 18 67 Q41 28 55 23 Q35 26 27 39 Q20 51 15 53 Q12 44 26 31 Q35 22 46 18 Q23 19 13 33 Q12 24 18 18Z','#48504e');
    ink(c,'M10 10 H85 M10 10 V70 M14 61 Q34 25 69 17',null,p.gold,.85);
    star(c,16,16,3.2,'#b6a489'); c.restore();
  }
}
function fern(c,x,y,scale,slope,color) {
  c.save();c.translate(x,y);c.rotate(slope);c.scale(scale,scale);
  ink(c,'M0 0 Q-12 -32 0 -75',null,color,1.6);
  for(let i=0;i<13;i++){
    const t=i/13, cx=-5*Math.sin(t*Math.PI), cy=-t*68-3, len=17*Math.pow(Math.sin((t*.85+.12)*Math.PI),.66);
    for(const sign of [-1,1]){
      c.save();c.translate(cx,cy);c.scale(sign,1);
      ink(c,`M0 0 Q${len*.62} -1 ${len} ${-len*.77} Q${len*.85} ${-len*.22} 0 1Z`,color);
      c.restore();
    }
  }
  c.restore();
}
function shelf(c,p) {
  for(const sign of [-1,1]) {
    c.save(); if(sign===1){c.translate(360,0);c.scale(-1,1);}
    for(let i=0;i<5;i++) fern(c,i*7-5,433,1.02-i*.06,-.4+i*.24,i%2?'#48605c':'#283e42');
    c.restore();
  }
  ink(c,'M0 423 Q153 420 360 424 V441 H0Z','#355051');
  for(let i=0;i<170;i++){
    const x=noise(i+721)*360,y=425+noise(i+739)*15;
    line(c,x,y,x+noise(i+751)*6+.5,y-.2,'#a19c7840',.7);
  }
  ink(c,'M0 438 H360 V480 H0Z', '#294044');
  ink(c,'M0 439 H360 V445 H0Z', '#6a6460'); line(c,0,441,360,441,'#b5a184',1.1);
  line(c,0,449,360,449,'#1b3238',2);
  for(let x=-10;x<360;x+=36) {
    ink(c,`M${x} 458 q9 -1 16 7 q-9 3 -16 -7z M${x+35} 458 q-9 -1 -16 7 q9 3 16 -7z`,'#475755');
    star(c,x+17.5,459,3.1,'#7a7968');
  }
  line(c,0,473,360,473,'#77766a',1); line(c,0,476,360,476,'#1c3036',2);
}
let plate=null;
function backdrop(c,p) {
  if(plate?.palette!==p) {
    const sheet=document.createElement('canvas'); sheet.width=720; sheet.height=960;
    const g=sheet.getContext('2d'); g.scale(2,2);
    landscape(g,p); architecture(g,p); shelf(g,p);
    // Grain is baked once at print resolution.
    for(let i=0;i<13500;i++) {
      g.fillStyle=i%3?'#efd8ba13':'#141d2935';
      g.fillRect(noise(i+1221)*360,noise(i+2154)*480,noise(i+3218)*1.1+.3,.42);
    }
    plate={palette:p,sheet};
  }
  c.drawImage(plate.sheet,0,0,360,480);
}
function windowLight(c,w,t,active,ready) {
  c.save();c.translate(w.x,w.y);
  const muted = !ready && !w.reached;
  glow(c,0,0,54,[[0,muted?'#edbe9440':'#ffe6a868'],[.48,'#ffd48d23'],[1,'#e8be8800']]);
  // Two shutters are hinged to a real opening in the greenhouse glass.
  for(const side of [-1,1]) {
    c.save();c.scale(side,1);
    ink(c,'M13 15 V-4 Q14 -15 24 -20 L24 9Z','#3c494d','#b39c7c',1.3);
    ink(c,'M16 9 V-4 Q17 -11 21 -14 V6Z','#7d7c73','#b39c7c',.7);
    line(c,14,0,23,-5,'#413f44',1.3);c.restore();
  }
  const lit=c.createLinearGradient(0,-19,0,17); lit.addColorStop(0,muted?'#968e91':'#fff0c3'); lit.addColorStop(1,muted?'#787b81':'#d99d73');
  ink(c,'M-13 15 V-5 Q-12 -14 0 -22 Q12 -14 13 -5 V15Z',lit,'#514b49',3.1);
  ink(c,'M-13 15 V-5 Q-12 -14 0 -22 Q12 -14 13 -5 V15Z',null,muted?'#b8ab8e':'#f1cc8b',1.2);
  line(c,0,-19,0,15,'#8d7863',.95);line(c,-12,1,12,1,'#8d7863',1.1);
  ink(c,'M-17 15 H17 L14 19 H-14Z','#b28c69','#61504a',1.2);
  if (ready) {
    c.globalAlpha=active?.65:.9;
    const r=29+Math.sin(t*2)*1.5;
    for(let i=0;i<10;i++) {
      const a=i*TAU/10+.15;
      line(c,Math.cos(a)*r,Math.sin(a)*r,Math.cos(a)*(r+3),Math.sin(a)*(r+3),'#f6d899',.9);
    }
    c.globalAlpha=1;
  }
  c.restore();
}
function pot(c,x,p) {
  c.save();c.translate(x,440);
  oval(c,3,30,38,3,'#1e3035');
  ink(c,'M-29 -1 L-23 25 Q-20 32 0 32 Q20 32 23 25 L29 -1Z',p.pot,'#203a41',1.6);
  ink(c,'M13 1 L26 1 L21 24 Q19 29 10 29 Q16 17 13 1Z',p.potDark);
  ink(c,'M-26 7 Q0 12 26 7 M-24 23 Q0 29 24 23',null,'#9abc9e',1);
  ink(c,'M-23 25 Q0 31 23 25 L21 29 Q0 35 -21 29Z','#a57f68');
  for(let i=-2;i<=2;i++) {
    const y=14+2.2*(1-Math.abs(i)/2),dx=i*9.7;
    c.save();c.translate(dx,y);c.rotate(i*.08);
    ink(c,'M0 -3 Q1.2 -1 3.1 .5 Q1 1.6 0 4 Q-1 1.6 -3.1 .5 Q-1.2 -1 0 -3Z','#c9c8a0');c.restore();
  }
  ink(c,'M-32 -3 Q0 -8 32 -3 L31 3 Q0 9 -31 3Z','#558682','#233b41',1.2);
  oval(c,0,-3,31.5,4.5,'#b59672');oval(c,0,-3,28,2.9,'#453d39');
  for(let i=0;i<12;i++) oval(c,noise(i+145)*48-24,-3+noise(i+255)*2,.9,.36,'#aa886a');
  c.restore();
}
const leafPath = new Path2D('M0 0 Q-7 -2 -10 -7 L-8 -8 Q-15 -8 -17 -13 L-14 -14 Q-19 -16 -21 -20 Q-15 -21 -11 -19 Q-11 -23 -14 -27 Q-8 -27 -5 -23 Q-7 -29 -5 -31 L-1 -28 Q-2 -35 1 -39 Q5 -35 6 -27 L10 -30 Q11 -27 10 -23 Q14 -26 18 -26 Q17 -21 13 -18 Q18 -21 22 -20 Q20 -15 15 -13 L18 -13 Q15 -8 9 -8 L11 -7 Q6 -3 0 0Z');
const leafVeins = new Path2D('M0 0 Q3 -18 1 -37 M0 -1 Q3 -10 17 -18 M0 -1 Q-6 -13 -16 -18 M1 -8 Q-2 -16 -8 -24 M2 -9 Q6 -18 11 -23 M2 -18 L-3 -25 M3 -19 L7 -25');
function leaf(c,x,y,n,i,t,p,age) {
  const eased=1-Math.exp(-Math.max(age,0)*1.95);
  const size=n.size*(.12+.88*eased);
  const angle=(n.leaf*(.83+.22*Math.sin(n.phase)) + Math.sin(t*1.32+n.phase)*.057)*(.72+.28*eased);
  c.save();c.translate(x,y);c.rotate(angle);
  const stem=size*.25;
  ink(c,`M0 0 Q1 ${-stem*.6} 0 ${-stem}`,null,p.oldLeaf,Math.max(.7,size*.055));
  c.translate(0,-stem);c.scale(size/39*1.34*(.24+.76*eased),size/39*1.10);c.rotate(.085*Math.sin(n.phase));
  const tone=(i+Math.round(n.phase))%3;
  ink(c,leafPath,p.leaf[tone], '#254b43', 1.4);
  c.save();c.clip(leafPath);
  ink(c,'M0 3 Q4 -19 1 -39 L-26 -40 L-23 1Z',p.fold[tone]);
  c.restore();
  ink(c,leafVeins,null,p.oldLeaf,.88);
  c.restore();
}
function nodePoint(n,t) {
  const lift=Math.min(1,Math.max(0,(440-n.y)/215));
  return [n.x+lift*Math.sin(t*.95-n.y*.012)*1.45,n.y+lift*Math.sin(t*.8+n.x*.024)*.63];
}
function curl(c,x,y,side,t) {
  c.save();c.translate(x,y);c.scale(side,1);c.rotate(.09*Math.sin(t));
  ink(c,'M0 0 Q7 -1 8 -9 C9 -16 19 -13 16 -7 C14 -4 10 -7 12 -10 Q13 -12 15 -10',null,'#b5b986',.9);
  c.restore();
}
function vine(c,s,t,p) {
  const pos=s.nodes.map(n=>nodePoint(n,t));
  // Print the connected contour before applying stem colour so growth joints stay smooth.
  for(const pass of ['outline','stem','glint']) {
    for(let i=1;i<s.nodes.length;i++) {
      const n=s.nodes[i];if(!n.alive||n.parent<0)continue;
      const [x,y]=pos[i],[sx,sy]=pos[n.parent];
      const width=n.depth===0?2.55+Math.max(0,y-230)/200:1.65;
      if(pass==='outline')line(c,sx,sy,x,y,'#233e3c',width+1.35);
      if(pass==='stem')line(c,sx,sy,x,y,n.depth===0?'#9aa779':'#93ac85',width);
      if(pass==='glint')line(c,sx-.45,sy,x-.45,y,'#cfca99',.54);
    }
  }
  for(let i=0;i<s.nodes.length;i++){
    const n=s.nodes[i]; if(!n.alive)continue;
    const [x,y]=pos[i];
    if(n.leaf) leaf(c,x,y,n,i,t,p,s.time-n.born);
    else if(i>0 && i%11===1) curl(c,x,y,i%2?1:-1,t);
  }
  for(const tip of s.tips) {
    const [sx,sy]=pos[tip.node], [x,y]=nodePoint(tip,t);
    line(c,sx,sy,x,y,'#c1c993',2);
    c.save();c.translate(x,y);c.rotate(tip.angle+Math.PI/2);
    ink(c,'M0 2 Q-5 -1 -5 -7 Q0 -5 0 0 Q0 -5 4 -9 Q5 -2 0 2Z','#d3d8a3','#6a8f6e',.65);
    c.restore();
  }
}
function bunch(c,x,y,r,fruit,empty=false) {
  c.save();c.translate(x,y);c.scale(r,r);
  const berries=[[-3,-3],[3,-4],[0,-1],[-3,2],[3,2],[0,5],[0,9]];
  const colors=fruit>.8?['#ce91a3','#ac718f','#d99ba4']:['#94a681','#768b73','#b5bf92'];
  for(let i=0;i<berries.length;i++) {
    const [bx,by]=berries[i];
    if(empty)loop(c,bx,by,2.6,'#eac3a8',.85);
    else {
      oval(c,bx,by,3.3,3.1,'#534252');oval(c,bx-.25,by-.55,2.65,2.4,colors[i%3]);
      oval(c,bx-.9,by-1.35,.8,.55,'#ecdab7');
    }
  }
  c.restore();
}
function fruitArm(c,a,s,t) {
  c.save();c.translate(a.x,a.y);
  const sign=a.x<180?-1:1;
  c.save();c.scale(sign,1);
  ink(c,'M0 0 Q13 1 21 -3 H34 M12 0 Q19 12 34 13',null,'#514445',4);
  ink(c,'M0 -1 Q13 0 21 -4 H34 M12 0 Q19 11 34 12',null,'#b58c71',1.4);
  for(const y of [-4,12]) {oval(c,34,y,2.9,2.9,'#9e8066');oval(c,33.2,y-1,1,1,'#d7b68a');}
  c.restore();
  if(a.grip>=0 && s.nodes[a.grip]?.alive) {
    const [gx,gy]=nodePoint(s.nodes[a.grip],t);
    ink(c,`M${gx-a.x} ${gy-a.y} Q-5 -7 1 0 Q9 7 10 0 Q10 -4 7 -2 Q5 0 8 1`,null,'#a6be87',1.8);
  }
  if(a.fruit>.02) {
    const size=.62+1.09*a.fruit;
    ink(c,'M0 0 Q-5 6 -2 11 Q2 15 -1 20 M-1 17 Q-7 12 -8 8 Q-3 9 -1 17Z', '#6f926c','#a5b58a',1.35);
    bunch(c,-1,22,size,a.fruit);
  } else {
    c.setLineDash([2.2,3.3]);loop(c,0,0,15.4+Math.sin(t*2)*.6,'#e6b898',1);c.setLineDash([]);
    bunch(c,0,-1,.88,0,true);
  }
  c.restore();
}
function flower(c,f,t) {
  c.save();c.translate(f.x,f.y);
  const burden=Math.max(f.stress,f.shade*.55), sway=Math.sin(t*1.2+f.x)*.7;
  ink(c,'M-16 1 Q0 -4 16 1 L12 12 Q0 17 -12 12Z','#ac7564','#433e43',1.2);
  oval(c,0,.3,16,2.7,'#cc9279');oval(c,0,0,13,1.4,'#574844');
  for(const [dx,h] of [[-7,20],[6,25],[1,31]]) {
    const endX=dx+sway+burden*3,endY=-h+burden*8;
    ink(c,`M${dx*.5} 0 Q${dx*.6} -8 ${endX} ${endY}`,null,'#93a886',1.3);
    oval(c,dx-2,-h*.46,4,1.7,'#98ae91',.65);
    for(let i=0;i<6;i++) {
      const a=i*TAU/6;
      oval(c,endX+Math.cos(a)*3,endY+Math.sin(a)*2.8,3.3,2,burden>.65?'#b6a1a6':'#ecc1ac',a);
    }
    oval(c,endX,endY,2.1,2,'#d5a252');
  }
  if(f.shade>.06) {
    c.globalAlpha=Math.min(.65,.16+f.shade*.65);
    ink(c,'M-18 -32 Q0 -37 17 -32 L24 2 Q3 11 -23 2Z','#262d43');c.globalAlpha=1;
  }
  if(f.stress>.12){c.strokeStyle='#e4a486';c.lineWidth=2.25;c.beginPath();c.arc(0,-18,19,-Math.PI/2,-Math.PI/2+TAU*f.stress);c.stroke();}
  c.restore();
}
function lamp(c,l,t) {
  c.save();c.translate(l.x,l.y);
  glow(c,0,0,70,[[0,'#ffeebb58'],[.28,'#ffd98d38'],[.61,'#ffcb7919'],[1,'#ffc87900']]);
  // A loop, vented cap and faceted wick make the thumb control recognizable at rest.
  ink(c,'M-4 -12 V-15 C-4 -21 4 -21 4 -15 V-12',null,'#5b5145',2.8);
  ink(c,'M-4 -12 V-15 C-4 -21 4 -21 4 -15 V-12',null,'#e5bd83',1.15);
  ink(c,'M-6 -9 H6 L8 0 L4 9 H-4 L-8 0Z','#ffe3a6','#795c4b',1.15);
  ink(c,'M-6 -9 L-3 -1 L-2 8 L-6 3 L-7 -1Z','#c6a17a');
  ink(c,'M0 -8 L4 -6 L3 4 L0 8 L-2 3Z','#fff8c8');
  ink(c,'M-9 -8 Q-6 -12 -2 -13 H2 Q6 -12 9 -8 L8 -6 H-8Z','#bd9065','#594e49',1);
  line(c,-6,-9,6,-9,'#f5d39a',.85);
  ink(c,'M-7 7 Q0 10 7 7 L5 11 Q0 14 -5 11Z','#b08964','#554c47',1);
  star(c,-11,-3,1.7+Math.sin(t*3)*.45,'#ffe0a3');
  c.restore();
}
function moth(c,x,y,heading,t) {
  c.save();c.translate(x,y);c.rotate(heading+Math.PI/2);c.scale(.85,.85);
  const beat=.64+.35*Math.cos(t*12);
  c.scale(beat,1);
  ink(c,'M0 2 Q-8 0 -8 -5 Q-5 -7 0 -2 Q5 -7 8 -5 Q8 0 0 2Z','#f9dba4','#ac886d',.7);
  ink(c,'M0 1 Q-6 1 -5 5 Q-3 7 0 3 Q3 7 5 5 Q6 1 0 1Z','#dabc90');
  line(c,0,-2,0,4,'#785f5c',1.1);c.restore();
}
function guide(c,s,t) {
  const target=s.arms.find(a=>!a.ripe) ?? s.window;
  const lamp=s.lamp;
  if(Math.hypot(target.x-lamp.x,target.y-lamp.y)<30)return;
  const at=(t*.24)%1,phase=at*at*(3-2*at);
  const dx=target.x-lamp.x,dy=target.y-lamp.y;
  c.save();c.globalAlpha=.5;
  c.setLineDash([1,6]);
  ink(c,`M${lamp.x} ${lamp.y-7} Q${(lamp.x+target.x)/2-24} ${(lamp.y+target.y)/2-15} ${target.x} ${target.y}`,null,'#f2d1a6',1);
  c.restore();
  const q=2*phase*(1-phase);
  moth(c,lamp.x+dx*phase-24*q,lamp.y+dy*phase-15*q,Math.atan2(dy,dx),t);
}
export function draw(c,s,artTime,{reduced=false,started=false,look='vesper'}={}) {
  const p=palettes[look]??palettes.vesper,t=reduced?0:artTime;
  c.save();c.lineCap='round';c.lineJoin='round';
  backdrop(c,p);
  windowLight(c,s.window,t,started,s.arms.every(a=>a.ripe));
  for(const f of s.flowers)flower(c,f,t);
  pot(c,s.nodes[0].x,p);
  vine(c,s,t,p);
  for(const a of s.arms)fruitArm(c,a,s,t);
  lamp(c,s.lamp,t);
  if(!started&&!s.window.reached)guide(c,s,t);
  c.restore();
}
