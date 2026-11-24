import { heatAt } from './sim.js';

const ink = '#302a2c', flax = '#fff0bf', TAU = Math.PI * 2;
const palettes = {
  indigo: { night: '#172c42', dawn: '#b88c98', hills: '#516276', wall: '#436460', tile: '#63847a', cloth: '#486b73' },
  mulberry: { night: '#38283f', dawn: '#e8a089', hills: '#80657a', wall: '#725058', tile: '#966b6b', cloth: '#855675' }
};
function dye(c, x, y, xx, yy, stops) {
  const g = c.createLinearGradient(x,y,xx,yy);
  stops.forEach(([n, color]) => g.addColorStop(n,color));
  return g;
}
function patch(c, path, fill, stroke, width = 1) {
  const p = new Path2D(path);
  if (fill) { c.fillStyle = fill; c.fill(p); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(p); }
}
function oval(c,x,y,rx,ry,fill) {
  c.beginPath(); c.ellipse(x,y,rx,ry,0,0,TAU); c.fillStyle=fill; c.fill();
}
function rect(c,x,y,w,h,color) { c.fillStyle=color; c.fillRect(x,y,w,h); }
function random(seed) {
  let n=seed>>>0;
  return () => ((n=(Math.imul(1664525,n)+1013904223)>>>0)/4294967296);
}
function grain(c, r, count, x,y,w,h,color) {
  c.fillStyle=color;
  for(let i=0;i<count;i++) c.fillRect(x+r()*w,y+r()*h,.3+r()*1.2,.35+r()*.7);
}
function windowView(c,p,r) {
  const windowPath='M-8 226V83Q-6 13 70 6Q136 7 155 76L158 226Z';
  patch(c,windowPath,ink,'#ac9b7b',5);
  c.save();c.clip(new Path2D('M-4 221V81Q2 26 71 17Q132 22 147 78L149 221Z'));
  rect(c,0,0,158,223,dye(c,0,15,0,212,[[0,p.night],[.5,p.hills],[.86,p.dawn],[1,'#e8b282']]));
  grain(c,r,80,1,22,148,106,'#ead7b9');
  patch(c,'M75 33Q65 53 88 53Q74 66 64 54Q55 40 75 33Z','#fce4b1');
  patch(c,'M-3 142Q35 110 71 121Q117 98 160 107V170H0Z',p.hills);
  for(let i=0;i<9;i++){
    const x=-21+i*23,y=145+r()*24,w=22+r()*9;
    rect(c,x,y,w,42,i%2?'#737a79':'#959181');
    patch(c,`M${x-3} ${y+2}l${w*.53} -${12+i%4}l${w*.59} ${12+i%4}Z`,i%2?'#424f57':'#596068');
    rect(c,x+3,y+7,3,5,i%3?'#dac28d':'#384854');
  }
  for(const [x,y,w] of [[-4,154,44],[107,144,33],[32,178,45],[73,167,36]]) {
    rect(c,x,y,w,68,'#495758');rect(c,x+w*.2,y-13,4,10,'#37444b');
    patch(c,`M${x-5} ${y+2}l${w*.57} -22l${w*.6} 22Z`,'#343f49','#a29183');
    patch(c,`M${x+2} ${y-2}l${w*.46} -16M${x+5} ${y+1}l${w*.42} -15`,null,'#899192',.6);
    rect(c,x+6,y+7,6,9,'#ffce83');rect(c,x+8.4,y+7,.9,9,'#525451');
    rect(c,x+20,y+16,8,31,'#34454c');
    patch(c,`M${x+2} ${y+23}h5m4 -3h4m2 -15h4`,null,'#819086',.7);
  }
  c.restore();
  patch(c,'M3 89Q15 37 62 26M90 24Q129 37 141 76',null,'#c9b395',1.3);
  patch(c,'M0 218L158 214L163 225L0 233Z','#9e7459',ink,2);
}
function oven(c){
  patch(c,'M139 -8L358 -8L372 224L333 248L146 226Q160 186 153 151Q144 107 138 72Q130 21 139 -8Z',
    dye(c,142,21,349,202,[[0,'#8b6861'],[.45,'#b79177'],[.7,'#c2a281'],[1,'#95735e']]),ink,2);
  // A wheat ear pressed into the plaster over the mouth.
  c.save();c.translate(251,21);c.rotate(.18);
  patch(c,'M0 15Q-2 0 0 -14M-16 9Q-31 12 -48 10M17 9Q33 11 50 7',null,'#755d50',.95);
  for(let i=0;i<3;i++){
    c.save();c.translate(0,9-i*6);
    patch(c,'M-1 0Q-9 0 -10 -7Q-3 -6 -1 0ZM0 -2Q1 -8 8 -11Q8 -4 0 -2Z','#896b54');c.restore();
  }
  c.restore();
  // Limewash and repairs around the brick arch.
  patch(c,'M161 9L169 18L168 28L179 36M345 12L330 28L332 40L322 53M154 172L163 184L158 194',null,'#81685c',1.1);
  patch(c,'M157 206L164 133Q173 58 224 48Q278 26 319 63Q349 89 359 155L363 210Z','#815749',ink,2);
  const cx=258, cy=159;
  for(let i=0;i<15;i++){
    const a=Math.PI+i*Math.PI/15+.009,b=a+Math.PI/15-.021;
    const brick=new Path2D();
    brick.ellipse(cx,cy,98,112,0,a,b);brick.ellipse(cx,cy,69,82,0,b,a,true);brick.closePath();
    c.fillStyle=['#ad7660','#bd8466','#a97158','#c08c6d'][i%4]; c.fill(brick);
    c.strokeStyle='#715747';c.lineWidth=1.3;c.stroke(brick);
  }
  patch(c,'M179 187L184 145Q190 80 244 76Q308 66 328 137L335 189Z',dye(c,0,74,0,190,[[0,'#271f2b'],[.6,'#542e32'],[1,'#df753b']]),'#594136',4);
  patch(c,'M183 163Q253 147 331 160L336 187L179 188Z','#a05e43');
  patch(c,'M151 189L335 180L365 190L348 206L157 211Z','#b58565',ink,2);
  patch(c,'M157 211L348 206L365 190L364 207L350 218L158 224Z','#755445',ink,1.4);
  patch(c,'M154 192L326 185M165 215L333 209',null,'#ddb18b',1.4);
}
function timber(c,p,r) {
  patch(c,'M-5 232L360 216L368 490H-5Z',dye(c,0,224,140,490,[[0,'#8b5945'],[.16,'#af7753'],[.67,'#bf8a61'],[1,'#ad785a']]),ink,3);
  for(const y of [256,315,396,480]){
    const yy=y-14;
    patch(c,`M-5 ${y}Q170 ${y-5} 365 ${yy}`,null,'#704e3f',1.6);
    patch(c,`M-5 ${y+2}Q170 ${y-2} 365 ${yy+2}`,null,'#deb58a',1);
  }
  for(let i=0;i<210;i++){
    const x=r()*390-25,y=233+r()*258,w=2+r()**2*52;
    patch(c,`M${x} ${y}q${w*.6} ${-2.4+r()*3} ${w} ${-w*.045}`,null,i%3?'#714b391e':'#ffcf9c4d',.4+r()*.8);
  }
  // A folded herringbone cloth hangs over the near corner.
  const linen='M-10 374L32 383Q41 389 83 400L73 420L41 415L23 477L-10 471Z';
  patch(c,linen,'#59453866',ink,1.5);c.save();c.clip(new Path2D(linen));
  rect(c,-9,368,103,126,'#dbc6a4');c.rotate(.30);
  for(let x=73;x<265;x+=11){rect(c,x,320,2.2,190,p.cloth);rect(c,x+4,320,.8,190,p.cloth);}
  c.restore();patch(c,'M0 402L41 415L73 420M32 383L23 403',null,'#967d64',1.5);
  // A shallow earthenware flour dish tucked against the table edge.
  patch(c,'M-15 248Q10 233 51 240Q52 259 35 266Q8 272 -13 265Z','#748781',ink,1.7);
  oval(c,16,243,37,11,'#3f595b');oval(c,16,242,32,7,'#cdbc9d');
  patch(c,'M-9 243Q0 240 7 236Q13 231 17 234Q29 236 39 243Q15 249 -9 243Z','#f0dcb4');
  // Flour settles in a swept ring around the work.
  for(let i=0;i<1250;i++) {
    const a=r()*TAU, d=(r()+r())*.54;
    const x=171+Math.cos(a)*d*118,y=351+Math.sin(a)*d*52;
    if(a>4 && a<5.1 && r()<.78)continue;
    rect(c,x,y,.5+r()*1.9,.45+r()*1.1,'#fff0ca77');
  }
  // The rolling pin has turned handles and flour rubbed into the grain.
  c.save();c.translate(316,452);c.rotate(-.34);
  patch(c,'M-68 4Q-70 1 -65 0L-47 0L-42 -8Q-41 -11 -35 -11H43Q50 -10 50 -3L65 -3Q72 -2 67 4L50 5Q49 12 44 13H-38Q-44 13 -45 7L-63 8Z','#594237',ink,1.5);
  patch(c,'M-42 -6Q-41 -11 -35 -11H44Q50 -8 49 2Q49 11 43 12H-36Q-45 9 -42 -6Z',dye(c,0,-12,0,13,[[0,'#ddad7c'],[.29,'#e7bd8a'],[.57,'#be8b61'],[.87,'#a97150'],[1,'#74533f']]),'#866347');
  grain(c,r,112,-34,-5,76,12,'#fff2ce68');patch(c,'M-32 -7Q-3 -6 34 -7M-29 8Q-14 7 9 8',null,'#976f52',.65);
  c.restore();
  // A bench knife on the far right.
  c.save();c.translate(351,290);c.rotate(.30);
  patch(c,'M-14 0H16L17 30Q4 34 -15 29Z','#a4a8a0',ink,1.4);
  patch(c,'M-12 1H13V23Q2 27 -12 25Z','#c0beb0');rect(c,-17,-3,34,7,'#604438');
  oval(c,-11,0,1.2,1.2,'#debc85');oval(c,11,0,1.2,1.2,'#debc85');c.restore();
}
const plates=new Map();
function backdrop(look) {
  if(plates.has(look))return plates.get(look);
  const p=palettes[look]||palettes.indigo,r=random(1078);
  const cv=document.createElement('canvas');cv.width=720;cv.height=980;
  const c=cv.getContext('2d');c.scale(2,2);c.lineJoin='round';c.lineCap='round';
  rect(c,0,0,360,490,p.wall);windowView(c,p,r);oven(c);
  timber(c,p,r);grain(c,r,15500,0,0,360,490,'#301d2a12');grain(c,r,7700,0,0,360,490,'#fff4c712');
  plates.set(look,cv);return cv;
}
function fire(c,g,t){
  const mouth='M183 177L187 145Q195 85 246 80Q305 70 325 139L330 174Z';
  c.save();c.clip(new Path2D(mouth));
  const glow=c.createRadialGradient(287,159,4,287,157,83);
  glow.addColorStop(0,'#ffbb5caa');glow.addColorStop(1,'#ea583300');
  rect(c,179,78,154,112,glow);
  for(let i=0;i<10;i++){
    const x=204+i*13, y=152+Math.cos(i)*4, k=heatAt(g,x,146);
    const h=(9+k*12)*(1+.42*Math.sin(3.4*t+i*2.7)), sway=3+Math.sin(t*3+i*4)*5;
    patch(c,`M${x-5} ${y}q-3 -6 2 -${h*.6}q3 -5 ${sway} -${h*.45}q12 ${h*.8} 4 ${h}Z`,i%2?'#e77a40':'#ef8b43');
    oval(c,x+1,y-1,3.8,h*.31,'#ffd377');
  }
  for(let i=0;i<7;i++){
    const x=184+i*23,y=155+Math.sin(i)*3;
    patch(c,`M${x} ${y}l14 -4l4 5l-17 4Z`,'#5d3734','#d9854b',1.1);
  }
  patch(c,'M204 158L264 147L275 153L217 166Z','#523a35','#a96343',1.2);
  patch(c,'M216 162L241 155L246 156L264 151M224 161L230 157M246 153L254 150',null,'#e78a50',1.1);
  patch(c,'M259 154L311 147L316 153L267 163Z','#654137','#b06a44',1.3);
  patch(c,'M273 159L286 153L291 154L306 150',null,'#ec9956',1);
  // Surface warmth across the hearth beneath the moving loaf.
  for(let x=189;x<=315;x+=5) {
    const h=Math.max(0,Math.min(1,(heatAt(g,x,139)-.25)/1.25));
    c.globalAlpha=.1+h*.52;rect(c,x,162,4,9,'#ffc56d');
  }
  c.restore();
}
function visitor(c,x,y,late,t,age,served){
  c.save();c.translate(x+Math.sin(t*1.8)*.8,y+Math.max(0,1-age/.55)*41);
  patch(c,'M-26 3Q-27 -31 -17 -46Q-2 -58 13 -45Q23 -36 28 3Z',late?'#94889a':served%2?'#ad7260':'#67847e',ink,1.8);
  patch(c,'M-11 -49Q-18 -57 -12 -69Q-2 -79 8 -68L11 -60L15 -56L11 -53Q11 -43 2 -44L1 -39Z',late?'#d7a686':'#b88569',ink,1.3);
  patch(c,late?'M-16 -50Q-22 -77 -6 -80Q10 -83 14 -61L7 -65Q2 -71 -3 -61L-2 -45L-12 -41Z':'M-16 -60Q-22 -68 -12 -77Q0 -83 10 -73L14 -68Q-1 -70 -15 -58Z',late?'#725b73':'#4a5255',ink,1.4);
  oval(c,7,-59,1,1,'#403238');
  patch(c,'M-15 -30Q-11 -13 -1 -10L12 -12L15 -7Q-1 1 -11 -4L-22 -18',late?'#928199':'#6c817a',ink,1.4);
  patch(c,'M-1 -10L4 -15Q7 -17 6 -12L17 -16Q21 -16 18 -13L10 -7L0 -5Z','#e2af88',ink,1);
  c.restore();
}
function mix(a,b,n){return 'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*n)).join(',')+')';}
function dough(c,g,t){
  const ns=g.nodes;if(!ns?.length)return;
  const xs=ns.map(p=>p.x),ys=ns.map(p=>p.y);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const w=x1-x0,h=y1-y0, x=(x1+x0)/2,y=(y1+y0)/2;
  const crust=Math.min(1,Math.max(0,g.brown||0)),char=Math.min(1,Math.max(0,((g.brown||0)-.88)*4.1));
  oval(c,x+2,y1-1,w*.49,h*.15,'#4c322b38');oval(c,x+1,y1-2,w*.41,h*.09,'#51382d52');
  const body=new Path2D();
  const last=ns.at(-1);body.moveTo((last.x+ns[0].x)/2,(last.y+ns[0].y)/2);
  ns.forEach((p,i)=>{const q=ns[(i+1)%ns.length];body.quadraticCurveTo(p.x,p.y,(p.x+q.x)/2,(p.y+q.y)/2);});body.closePath();
  const highlight=char?mix([223,151,71],[91,62,50],char):mix([254,230,184],[235,161,79],crust);
  const mid=char?mix([195,115,51],[66,48,43],char):mix([239,206,156],[190,106,47],crust);
  const low=mix([187,143,105],[87,48,38],crust);
  c.save();c.clip(body);
  rect(c,x0,y0,w+1,h+1,dye(c,x0,y0,x0+w*.35,y1,[[0,highlight],[.43,highlight],[.77,mid],[1,low]]));
  c.save();c.translate(x0,y0);c.scale(w/100,h/70);
  if(g.shaped||crust>.04){
    for(let i=0;i<3;i++){
      c.save();c.translate(22+i*20,30-4*Math.sin(i));c.rotate(-.28);
      patch(c,'M-4 9Q-1 -4 14 -14Q11 -2 -4 9Z',mix([191,156,111],[109,58,41],crust));
      patch(c,'M-4 9Q5 -2 14 -14Q9 -1 -4 9Z','#f5dcaa');c.restore();
    }
  }else{
    patch(c,'M7 42Q22 58 44 45Q60 36 58 26Q61 39 50 48Q31 62 13 50Z','#ba8d653e');
    patch(c,'M7 41Q26 59 44 44Q54 38 58 29',null,'#fff2cd9c',1.6);
  }
  const r=random(g.seed||1);
  for(let i=0;i<145;i++){
    const sx=4+r()*92, sy=4+r()*59;
    oval(c,sx,sy,.28+r()*.63,.22+r()*.52,i%4?'#fff4d36b':'#98725161');
  }
  if(g.stage==='rise'){
    for(let i=0;i<7;i++){
      const sx=20+r()*60,sy=15+r()*32,rad=(1+.25*Math.sin(t*2+i))*(.8+g.proof*2.5);
      oval(c,sx,sy,rad,rad*.7,'#f7e3b7');patch(c,`M${sx-rad} ${sy}q${rad} ${rad*1.35} ${rad*2} 0`,null,'#c09b7766',.8);
    }
  }
  c.restore();c.restore();c.strokeStyle=crust>.5?'#674437':'#9a765a';c.lineWidth=1.5;c.stroke(body);
}
function smallLoaf(c,x,y,scale,g){
  c.save();c.translate(x,y);c.scale(scale,scale);
  const crust=Math.min(1,g.brown||0);
  const crown=mix([255,230,185],[232,153,71],crust);
  const side=mix([201,163,116],[143,78,42],crust);
  oval(c,1,4,24,6,'#51382d44');
  patch(c,'M-22 1Q-22 -11 -9 -15Q8 -19 20 -9Q29 2 16 7Q4 12 -13 8Q-23 6 -22 1Z',dye(c,0,-14,0,10,[[0,crown],[.47,crown],[1,side]]),'#976f50',1);
  for(const dx of [-10,0,10])patch(c,`M${dx-3} -3q0 -6 6 -8q0 5 -6 8Z`,'#fff0bd');
  c.restore();
}
function batch(c,g){
  const spare=g.remaining-1;
  if(spare<1)return;
  if(g.stage==='serve'){
    // Cooling loaves stay on the cloth when the player picks up the front one.
    for(let i=spare-1;i>=0;i--)smallLoaf(c,76-i*18,389+i*6,.91,g);
  }else if(g.shaped){
    // Every loaf rides the same short peel. The front loaf is the deformable body.
    const k=g.stage==='bake'?.67:1;
    c.save();c.translate(g.x,g.y);c.scale(k,k);
    patch(c,'M-63 12L-70 -22Q-67 -47 -41 -49L34 -51Q63 -48 66 -19L66 7Q58 28 28 31L17 33L13 52L3 53L4 30L-40 29Q-57 29 -63 12Z',dye(c,-20,-50,30,48,[[0,'#d8ae7b'],[.71,'#b8885c'],[1,'#9a6747']]),'#795641',1.5);
    c.restore();
    for(let i=spare-1;i>=0;i--){
      const dx=spare===1?-31:-40+39*i;
      smallLoaf(c,g.x+dx*k,g.y-(36-i%2*2)*k,1.05*k,g);
    }
  }
}
function gesture(c,x,y,tx,ty,t,bend=0) {
  const dx=tx-x,dy=ty-y, length=Math.hypot(dx,dy)||1;
  const mx=(x+tx)/2-bend*dy/length,my=(y+ty)/2+bend*dx/length;
  const path=new Path2D();path.moveTo(x,y);path.quadraticCurveTo(mx,my,tx,ty);
  c.save();c.strokeStyle='#52382d70';c.lineWidth=3;c.setLineDash([2,6]);c.stroke(path);
  c.strokeStyle='#fff2c8';c.lineWidth=1.6;c.stroke(path);c.setLineDash([]);
  c.translate(tx,ty);c.rotate(Math.atan2(ty-my,tx-mx));patch(c,'M-7 -4L0 0L-7 4',null,flax,2);
  c.restore();
  const f=Math.min(1,(t%2.25)/1.6),q=f*f*(3-2*f);
  const px=(1-q)**2*x+2*q*(1-q)*mx+q*q*tx,py=(1-q)**2*y+2*q*(1-q)*my+q*q*ty;
  c.save();c.translate(px,py);c.globalAlpha=.9-.4*f;c.beginPath();c.arc(0,0,6,0,TAU);c.strokeStyle='#fff4d2';c.lineWidth=1.1;c.stroke();
  patch(c,'M3 7L1 1Q1 -2 3 -1L8 6Q9 3 11 5L14 7Q16 6 18 9L21 14Q22 18 17 21Q13 23 10 21L3 15L-1 10Q-2 7 1 8L6 11Z','#f9e9c8','#594940',1.2);
  c.restore();
}
function meter(c,x,y,value,oven){
  const w=58;
  rect(c,x-2,y-2,w+4,7,'#513d37');rect(c,x,y,w,3,'#bd9a77');
  if(oven){rect(c,x+w*.66/1.13,y,w*.34/1.13,3,'#ffc952');rect(c,x+w/1.13,y,w*.13/1.13,3,'#59423d');}
  else rect(c,x,y,w*value,3,'#ffe8af');
  const at=x+w*Math.min(1,value/(oven?1.13:1));
  patch(c,`M${at-3.5} ${y+8}l3.5 -4l3.5 4Z`,flax,ink,.7);
}
function heart(c,x,y){
  c.save();c.translate(x,y);patch(c,'M0 5C-14 -3 -5 -12 0 -5C7 -13 14 -3 0 5Z','#f2a29a','#65424a',1.2);c.restore();
}
export function draw(c,g,t,look='indigo'){
  c.save();c.lineJoin='round';c.lineCap='round';
  c.drawImage(backdrop(look),0,0,360,490);
  fire(c,g,t);
  if(g.stage==='serve'||g.stage==='done'){
    visitor(c,59,216,false,t,g.served ? 1 : g.age,g.served);
    oval(c,69,205,4.5,4.5,'#9a663b');oval(c,69,204,3.8,3.8,'#f3ce7c');
    if(g.remaining===1&&g.age>=1||g.gifts>0){
      visitor(c,127,218,true,t,g.gifts?1:g.age-1,0);heart(c,139,190+Math.sin(t*2));
    }
  }
  if((g.stage==='serve'||g.stage==='done')&&g.served>0&&g.age<1.25){
    const gift=g.last==='gift';
    const fade=Math.min(1,(1.25-g.age)*4);
    c.save();c.globalAlpha=fade;
    smallLoaf(c,gift?135:65,202,.61,g);
    if(gift)heart(c,141,183-8*g.age);
    c.restore();
  }
  batch(c,g);
  if(g.stage!=='done')dough(c,g,t);
  for(const d of g.dust){
    c.globalAlpha=Math.min(1,d.life*3);
    oval(c,d.x,d.y,1.1,.8,'#fff1c8');
  }
  c.globalAlpha=1;
  if(g.stage==='knead'&&g.work>0)meter(c,g.x-29,g.y+57,g.work,false);
  if(g.stage==='rise'){
    meter(c,g.x-29,g.y+60,g.proof,false);
    for(let i=0;i<3;i++){
      const x=g.x-11+i*10,y=g.y-51-((t*.8+i/3)%1)*8;
      patch(c,`M${x} ${y}q-3 -4 0 -8q3 -4 0 -8`,null,'#fff0bcab',1.4);
    }
  }
  if(g.stage==='bake')meter(c,227,209,g.brown,true);
  if(!g.grip){
    if(g.stage==='knead')gesture(c,g.x-37,g.y-2,g.x+30,g.y+5,t,-13);
    if(g.stage==='shape'&&!g.shaped)gesture(c,g.x+44,g.y-6,g.x+2,g.y+1,t,8);
    if(g.stage==='shape'&&g.shaped)gesture(c,g.x,g.y-10,246,145,t,16);
    if(g.stage==='bake'&&g.brown>=.66)gesture(c,g.x,g.y+2,164,350,t,-22);
    if(g.stage==='serve')gesture(c,g.x,g.y-7,g.remaining===1&&g.age>=1?136:67,214,t,-7);
  }
  c.restore();
}
