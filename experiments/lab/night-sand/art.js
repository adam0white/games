import { W, H } from './sim.js';

const inks = {
  basalt: {
    sky: ['#101e26', '#254143', '#8b8061'], vapor: '#aec4ae', moon: '#ead99f',
    ridges: ['#47645c', '#34534e', '#21423e'], cut: '#cfba82', dark: '#152d2d',
    brass: '#d9af68', rim: '#f5dda2', teal: '#84d2bb',
    sand: ['#bc8047','#cf904a','#dca256','#e1ab63'],
    fine: ['#409481','#51aa96','#67b6a1','#7ec6ae']
  },
  plum: {
    sky: ['#251e34', '#57415b', '#b6857a'], vapor: '#d9b5bc', moon: '#f4d6bf',
    ridges: ['#856775', '#635566', '#453747'], cut: '#daabb0', dark: '#31283b',
    brass: '#e8b09e', rim: '#ffe3c3', teal: '#a7d5ed',
    sand: ['#b76e64','#c77e6d','#d4927c','#e0a48b'],
    fine: ['#6797b4','#79a6bf','#8cb7cb','#a1c7d6']
  }
};
const tau = 2 * Math.PI;

function canvasOf(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}
function rng(seed) {
  // A private stream keeps the etched plate independent of play and frame rate.
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function polyline(c, points, ink, width) {
  c.beginPath();
  c.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) c.lineTo(...points[i]);
  c.strokeStyle = ink;
  c.lineWidth = width;
  c.stroke();
}
function ellipse(c, x, y, rx, ry, ink) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, tau);
  c.fillStyle = ink;
  c.fill();
}
function star(c, x, y, size, ink) {
  c.fillStyle = ink;
  c.beginPath();
  c.moveTo(x, y-size);
  c.quadraticCurveTo(x+.12*size,y-.12*size,x+.7*size,y);
  c.quadraticCurveTo(x+.12*size,y+.12*size,x,y+size);
  c.quadraticCurveTo(x-.12*size,y+.12*size,x-.7*size,y);
  c.quadraticCurveTo(x-.12*size,y-.12*size,x,y-size);
  c.fill();
}
function moon(c, x, y, radius, p, random) {
  const halo = c.createRadialGradient(x,y,1,x,y,radius*3);
  halo.addColorStop(0,p.moon+'26');
  halo.addColorStop(1,p.moon+'00');
  c.fillStyle=halo;
  c.fillRect(x-3*radius,y-3*radius,radius*6,radius*6);
  c.save();
  c.beginPath();
  c.arc(x,y,radius,0,tau);
  c.clip();
  c.fillStyle=p.moon;
  c.fillRect(x-radius,y-radius,radius*2,radius*2);
  // The dark limb breaks into progressively shorter lines across the disc.
  for(let i=0;i<42;i++){
    const fraction=(i+.4)/42;
    const localY=(2*fraction-1)*radius;
    const edge=Math.sqrt(radius*radius-localY*localY);
    const lineEnd=-radius*.43+Math.sin(fraction*Math.PI*3)*radius*.25+random()*radius*.33;
    polyline(c,[[x-edge,y+localY],[x+lineEnd,y+localY]],p.sky[1]+'a3',.16+random()*.11);
  }
  for(let i=0;i<75;i++){
    ellipse(c,x+(random()-.5)*radius*2,y+(random()-.5)*radius*2,.07+random()*.3,.10,p.dark+'38');
  }
  c.restore();
  c.strokeStyle=p.moon+'82';
  c.lineWidth=.16;
  c.beginPath(); c.arc(x,y,radius+1.4,-1.6,.9); c.stroke();
}
function ridge(c,p,layer,phase) {
  const crest = x => {
    const a=x/W;
    if (layer===0) return 85 - 10*Math.sin(a*4-.1+phase) - 5*Math.sin(a*9+.5) - 2*Math.sin(a*19)+2*Math.sin(a*38);
    if (layer===1) return 97-11*Math.cos(a*5+.6)+5*Math.sin(a*9.5+phase);
    return 111-15*Math.sin(a*4+1.8+phase)+3*Math.cos(a*11);
  };
  c.save();
  c.beginPath(); c.moveTo(-1,H+1);
  for(let x=-1;x<=W+1;x+=.5)c.lineTo(x,crest(x));
  c.lineTo(W+1,H+1); c.closePath();
  c.fillStyle=p.ridges[layer]; c.fill();
  c.clip();
  // Contours splay across the slip face; shorter flecks interrupt the lines.
  c.strokeStyle=p.cut; c.lineWidth=layer===0?.1:.18;
  c.globalAlpha=layer===0?.29:.45;
  for(let band=0;band<31;band++){
    c.beginPath();
    for(let i=0;i<=W*2;i++){
      const x=i*.5;
      const y=crest(x+band*.65) + .25 + band*(.85+.35*Math.cos(x*.075+layer)) + band*band*.021;
      if(i===0 || Math.cos(x*.095+band*.17+phase)<-.61) c.moveTo(x,y);
      else c.lineTo(x,y);
    }
    c.stroke();
  }
  c.globalAlpha=.66;
  c.beginPath();
  for (let x=0;x<=W;x+=.5) {
    if(x===0)c.moveTo(x,crest(x)); else c.lineTo(x,crest(x));
  }
  c.stroke();
  c.restore();
}
// Wind-cut sandstone in the far basin. Its ledges and opening belong to the
// backdrop; the brighter, squared outlines always identify playable hardware.
function outcrop(c,p){
  c.save();
  c.beginPath();
  c.moveTo(-1,83);c.lineTo(4,78);c.lineTo(7,74);c.lineTo(7.4,70.8);
  c.lineTo(9.2,70.4);c.lineTo(10.5,65.5);c.lineTo(13,64.7);
  c.lineTo(14.2,60.4);c.lineTo(17,59.8);c.lineTo(17.7,56.3);
  c.lineTo(19.8,55.6);c.lineTo(20.8,51.6);c.lineTo(26.1,50.7);
  c.lineTo(27.7,51.1);c.lineTo(28.8,52.8);c.lineTo(36.6,53.7);
  c.lineTo(39.1,54.8);c.lineTo(40,57.5);c.lineTo(43.4,58.7);
  c.lineTo(44.5,64.8);c.lineTo(47.3,66.3);c.lineTo(48.6,72.8);
  c.lineTo(51.7,74.5);c.lineTo(53,80);c.lineTo(64,89);c.lineTo(-1,91);c.closePath();
  c.moveTo(26.5,82);c.bezierCurveTo(28,76,26,72.5,28.5,69);
  c.bezierCurveTo(28.9,65.5,30.5,62.2,34,61);
  c.bezierCurveTo(38.7,59.8,39.2,64.2,39.5,68);
  c.lineTo(41,73);c.lineTo(40,83);c.closePath();
  c.fillStyle=p.ridges[0];c.fill('evenodd');c.clip('evenodd');
  c.fillStyle=p.cut+'3b';
  c.beginPath();c.moveTo(24,50);c.lineTo(43,52);c.lineTo(49,78);c.lineTo(43,75);
  c.lineTo(39,63);c.lineTo(34.3,59.2);c.lineTo(30,56.9);c.lineTo(25.5,55.4);c.closePath();c.fill();
  c.strokeStyle=p.cut+'85';
  for(let i=0;i<64;i++){
    const y=51+i*.54, bend=1.1*Math.sin(i*.15);
    c.beginPath();c.moveTo(4,y+3+bend);
    c.bezierCurveTo(15,y+3+bend,24,y-1.5+bend,30,y-.6);
    c.bezierCurveTo(35,y-.25,40,y+1+bend,51,y+1.3+bend);
    c.lineWidth=i%5===0?.26:.12;c.stroke();
  }
  c.fillStyle=p.sky[0]+'55';c.beginPath();c.moveTo(16,58);c.lineTo(18,60);
  c.lineTo(15.5,65.6);c.lineTo(15.8,69.5);c.lineTo(10.5,78);c.lineTo(6,85);c.lineTo(2,84);c.closePath();c.fill();
  c.restore();
}
function landscape(c,s,p) {
  const random=rng(s.seed);
  const sky=c.createLinearGradient(0,0,0,112);
  p.sky.forEach((color,i)=>sky.addColorStop(i===1?.54:i/2,color));
  c.fillStyle=sky; c.fillRect(0,0,W,H);
  for(let i=0;i<106;i++) {
    const x=2+random()*(W-4),y=2+random()*H*.47;
    const size=.11+random()*.18;
    c.globalAlpha=.25+random()*.65;
    if(i%20===0)star(c,x,y,1.3,p.moon); else ellipse(c,x,y,size,size,p.moon);
  }
  c.globalAlpha=1;
  const celestialX=s.kind==='glass'?(s.hint.x>W/2?15:107):s.kind==='sieve'?98:84;
  moon(c,celestialX,25,7,p,random);
  // An engraved bank of fine wind lines sits above the horizon.
  c.lineWidth=.13; c.strokeStyle=p.vapor;
  for(let i=0;i<43;i++) {
    c.globalAlpha=.11+random()*.18;
    const x=random()*W-8, y=40+Math.pow(random(),.7)*46, length=3+random()*24;
    c.beginPath(); c.moveTo(x,y);
    c.bezierCurveTo(x+length*.3,y-.2,x+length*.75,y-1.5,x+length,y-1.2);
    c.stroke();
  }
  c.globalAlpha=1;
  outcrop(c,p);
  const phase=random()*.65;
  for(let layer=0;layer<3;layer++)ridge(c,p,layer,phase);
  // Printer's stipple shares the contours' palette and stays fixed on the plate.
  for(let i=0;i<5500;i++) {
    c.fillStyle=i%3?p.moon+'12':p.dark+'44';
    c.fillRect(random()*W,random()*H,.1+random()*.22,.12);
  }
}
function drawWalls(c,s,p) {
  for(let i=0;i<s.walls.length;i++){
    const wall=s.walls[i];
    if(!wall)continue;
    const x=i%W, y=Math.floor(i/W);
    if(wall===2){
      c.fillStyle=p.teal+'70'; c.fillRect(x,y,1,1);
      if ((x+y)%3===0) polyline(c,[[x-.3,y+.1],[x+.8,y+1]],p.rim,.28);
      continue;
    }
    c.fillStyle=(x+y)%5===0?p.brass:p.dark;
    c.fillRect(x,y,1,1);
    c.fillStyle=p.brass;
    if(!s.walls[i-W])c.fillRect(x,y,1,.55);
    if(!s.walls[i-1])c.fillRect(x,y,.45,1);
    c.fillStyle=p.rim+'71';
    if(!s.walls[i+1])c.fillRect(x+.74,y,.26,1);
    if(!s.walls[i+W])c.fillRect(x,y+.70,1,.30);
  }
}
function glassRims(c,s,p) {
  const {x,neckY,bottom}=s.goal;
  const upperLeft=[],upperRight=[],lowerLeft=[],lowerRight=[];
  const throat=s.walls.subarray((neckY-2)*W+2,(neckY-1)*W-2);
  const neckX=2+(throat.indexOf(1)+throat.lastIndexOf(1))/2;
  for(let y=4;y<=bottom;y++) {
    let a=W,b=0;
    for(let j=2;j<W-2;j++)if(s.walls[y*W+j]){
      a=Math.min(a,j);b=Math.max(b,j);
    }
    if(a===W)continue;
    const upper=y<=neckY;
    // An asymmetric hopper can reach the outer wall of the tray.
    if(upper&&a>neckX)a=0;
    if(upper&&b<neckX)b=W-1;
    (upper?upperLeft:lowerLeft).push([a+.4,y+.5]);
    (upper?upperRight:lowerRight).push([b+.6,y+.5]);
  }
  // Each drawn face follows the outside of the actual collision cells.
  for(const [left,right] of [[upperLeft,upperRight],[lowerLeft,lowerRight]]){
    if(!left.length)continue;
    const [lx,y]=left[0], [rx]=right[0];
    c.beginPath();
    for(const [i,point] of [...left,...right.toReversed()].entries()){
      if(i===0)c.moveTo(...point);else c.lineTo(...point);
    }
    c.closePath();c.fillStyle=p.teal+'20';c.fill();
    polyline(c,left,p.rim,.56);polyline(c,right,p.brass,.66);
    for(const [side,sign] of [[left,1],[right,-1]]){
      const margin=side.slice(3,-5).map(([a,b])=>[a+sign*1.3,b]);
      if(margin.length)polyline(c,margin,p.teal+'ae',.3);
    }
    ellipse(c,(lx+rx)/2,y,(rx-lx)/2+1.1,.85,p.dark);
    c.strokeStyle=p.brass;c.lineWidth=.48;
    c.beginPath();c.ellipse((lx+rx)/2,y,(rx-lx)/2+1.1,.85,0,0,tau);c.stroke();
  }
  const [left,top]=upperLeft[0], [right]=upperRight[0];
  // The collar follows the upper mouth even when the lower bulb sits off axis.
  c.fillStyle=p.teal+'35';c.fillRect(left,top-3.3,right-left,3.5);
  polyline(c,[[left,top+1],[left,top-3.3],[right,top-3.3],[right,top+1]],p.brass,.65);
  ellipse(c,(left+right)/2,top-3.4,(right-left)/2+.7,.75,p.dark);
  c.strokeStyle=p.rim;c.lineWidth=.45;c.beginPath();
  c.ellipse((left+right)/2,top-3.4,(right-left)/2+.7,.75,0,0,tau);c.stroke();
  const foot=[[x-9,bottom+1],[x+9,bottom+1]];
  polyline(c,foot,p.dark,1.5);polyline(c,foot,p.brass,.7);
  // The etched rail indicates the allowed horizontal motion of the shutter.
  if(!s.gate)return;
  const sy=s.gate.y+.5;
  polyline(c,[[4,sy],[W-4,sy]],p.brass+'70',.22);
  for(let j=8;j<=W-8;j+=4)polyline(c,[[j,sy+.4],[j,sy+(j%12===0?1.6:1)]],p.rim+'70',.24);
}
function plate(s,p) {
  const canvas=canvasOf(W*4,H*4), c=canvas.getContext('2d');
  c.scale(4,4);
  landscape(c,s,p);
  drawWalls(c,s,p);
  if(s.kind==='glass')glassRims(c,s,p);
  return canvas;
}
function packed(hex, adjustment) {
  const n=parseInt(hex.slice(1),16);
  const tone = channel => Math.max(0,Math.min(255,Math.round(channel+adjustment)));
  return (255<<24)|(tone(n&255)<<16)|(tone((n>>8)&255)<<8)|tone(n>>16);
}
function sandInks(p) {
  const shades=['#000000',...p.sand,...p.fine];
  return shades.map(color => Uint32Array.from({length:96},(_,i)=>packed(color,i-58)));
}
function strataMap() {
  const result=new Int8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const layer=y+.083*x+2.1*Math.sin(x*.043)+1.6*Math.sin(x*.054+y*.088);
    result[y*W+x]=Math.round(6*Math.cos(layer*.72)+4*Math.sin(layer*.27));
  }
  return result;
}
function grains(pixels,s,lut,strata,surface) {
  const cells=s.cells;
  const garden=s.kind==='garden';
  surface.fill(-1000);
  for(let i=0;i<cells.length;i++) {
    const tone=cells[i];
    if(tone===0){pixels[i]=0; continue;}
    const x=i%W, y=(i/W)|0;
    if(!cells[i-W])surface[x]=y;
    const depth=y-surface[x];
    const light=depth===0?29:depth===1?15:3-Math.min(26,depth*.6);
    const shade=Math.max(0,Math.min(95,(58+light+strata[i]*(garden?.26:1))|0));
    pixels[i]=lut[tone][shade];
  }
}

// Shade both edges of each groove; unmarked grains on its lip catch the light.
function carve(pixels,s,p){
  const dark=packed(p.sand[0],-43), shadow=packed(p.sand[0],-30);
  const mid=packed(p.sand[0],-25), lip=packed(p.sand[3],38);
  for(let i=W+1;i<pixels.length-W-1;i++){
    if(!s.cells[i])continue;
    if(s.marks[i]){
      pixels[i]=!s.marks[i-1]||!s.marks[i-W]?dark:
        !s.marks[i+1]||!s.marks[i+W]?shadow:mid;
    }else if(s.marks[i-1]||s.marks[i-W]){
      pixels[i]=lip;
    }
  }
}
function lamp(c,x,y,p,progress,time){
  c.save(); c.translate(x,y);
  const glow=c.createRadialGradient(0,-1,0,0,-1,14+progress*11);
  glow.addColorStop(0,'#fff2aece'); glow.addColorStop(.24,'#eca74a90'); glow.addColorStop(1,'#ec9e4400');
  c.fillStyle=glow; c.fillRect(-26,-27,52,54);
  c.lineWidth=.72; c.strokeStyle=p.dark; c.lineJoin='round'; c.lineCap='round';
  c.beginPath(); c.moveTo(-4.5,-6.5);
  c.bezierCurveTo(-6.4,-15.6,5.4,-16.8,4.5,-6.5);
  c.strokeStyle=p.dark; c.lineWidth=1.5; c.stroke(); c.strokeStyle=p.rim;c.lineWidth=.65;c.stroke();
  // Fixed stone footing: its exposed ledges track the depth of the cut.
  c.fillStyle=p.ridges[2];c.fillRect(-4.5,5,9,H-y);
  c.fillStyle=p.ridges[1];c.fillRect(-4.5,5,3.5,H-y);
  for(let j=7;j<H-y;j+=2.7){
    polyline(c,[[-4.5,j],[-1,j+.45],[4.5,j+.25]],p.cut+'80',.3);
  }
  // Turned metal cap, glass lens, crossed guards and a foot.
  c.fillStyle=p.brass; c.strokeStyle=p.dark;c.lineWidth=.58;
  c.beginPath();c.moveTo(-5.9,-5.8);c.lineTo(-3.2,-8.1);c.quadraticCurveTo(-3.1,-9.1,0,-9.2);
  c.quadraticCurveTo(3.1,-9,3.2,-8.1);c.lineTo(5.9,-5.8);c.lineTo(5,-4.8);c.lineTo(-5,-4.8);c.closePath();c.fill();c.stroke();
  c.fillStyle='#ffce73'; c.beginPath();c.moveTo(-4.7,-4.9);c.lineTo(-3.9,3.6);
  c.quadraticCurveTo(0,5,3.9,3.6);c.lineTo(4.7,-4.9);c.closePath();c.fill();c.stroke();
  c.fillStyle='#fff7d4';
  c.beginPath();c.moveTo(-1.5,2.7);c.quadraticCurveTo(-2,-.1,.6+Math.sin(time*6)*.4,-3.8);
  c.quadraticCurveTo(.1,-1.9,1.1,-1.2);c.quadraticCurveTo(2.7,1.8,.6,2.8);c.fill();
  polyline(c,[[-4.6,-4.8],[-2.4,2.7],[3.6,3.7]],p.brass,.43);
  polyline(c,[[4.6,-4.8],[2.4,2.7],[-3.6,3.7]],p.brass,.43);
  c.fillStyle=p.brass;c.fillRect(-4.5,3.8,9,1);
  ellipse(c,0,5.5,5.5,1.3,p.dark);ellipse(c,0,5.1,5.2,.9,p.brass);
  polyline(c,[[-4.1,-6.3],[4,-6.3]],p.rim,.42);
  c.restore();
}
function depthMark(c,x,y,width,p) {
  c.save();
  c.strokeStyle=p.dark; c.lineWidth=1.2;
  c.setLineDash([1,1.45]); c.beginPath(); c.moveTo(x-width,y);c.lineTo(x+width,y);c.stroke();
  c.lineWidth=.42; c.strokeStyle=p.rim;c.stroke();
  c.setLineDash([]);
  for (const sign of [-1,1]){
    const edge=x+sign*width;
    const points=[[edge+sign*1.7,y-1.4],[edge,y],[edge+sign*1.7,y+1.4]];
    polyline(c,points,p.dark,1.05);
    polyline(c,points,p.rim,.65);
  }
  c.restore();
}
function seed(c,g,p,progress,won){
  const {x,y}=g;
  c.save();c.translate(x,y);
  c.fillStyle=p.teal;c.strokeStyle=p.dark;c.lineWidth=.65;
  c.beginPath();c.moveTo(-2,1.3);c.bezierCurveTo(-4,-1.2,-1.3,-3.2,2.9,-3.2);
  c.bezierCurveTo(2.1,.8,.1,3.3,-2,1.3);c.fill();c.stroke();
  polyline(c,[[-2,1.8],[.2,-.4],[1.9,-2]],p.dark,.3);
  if(won){
    const stem=-(g.minDepth+g.maxDepth)/2-5;
    c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-2,stem*.6,0,stem);
    c.strokeStyle=p.teal;c.lineWidth=.7;c.stroke();
    c.fillStyle=p.teal;c.beginPath();c.moveTo(0,stem+2);c.quadraticCurveTo(-5,stem+1,-5,stem-3);
    c.quadraticCurveTo(-1,stem-3,0,stem+2);c.fill();
    c.beginPath();c.moveTo(0,stem);c.quadraticCurveTo(1,stem-4,5,stem-5);
    c.quadraticCurveTo(5,stem-1,0,stem);c.fill();
  }
  c.restore();
}
function catchSymbol(c,x,y,teal,p) {
  const ink=teal?p.teal:p.brass;
  c.save(); c.translate(x,y);
  polyline(c,[[-3.6,-1.1],[-2.5,1.1],[2.5,1.1],[3.6,-1.1]],p.dark,1.4);
  polyline(c,[[-3.6,-1.1],[-2.5,1.1],[2.5,1.1],[3.6,-1.1]],ink,.65);
  for(let i=-1;i<=1;i++)ellipse(c,i*1.5,-1-Number(i===0)*1.15,teal?.35:.65,teal?.35:.65,ink);
  c.restore();
}
function slide(c,gate,p){
  c.save();c.translate(gate.x,gate.y);
  const a=gate.half+.5;
  c.fillStyle=p.dark;c.fillRect(-a,-.8,2*a,2.5);
  c.fillStyle=p.brass;c.fillRect(-a,-.5,2*a,1.3);
  for(let x=-a+1.25;x<a;x+=2.5) polyline(c,[[x,-.4],[x-.8,.65]],p.dark,.27);
  c.fillStyle=p.dark;c.fillRect(-3,-2,6,2.8);c.fillStyle=p.brass;c.fillRect(-2.5,-1.7,5,1.9);
  for(let x=-1.4;x<=1.4;x+=1.4)polyline(c,[[x,-1.3],[x,-.15]],p.dark,.24);
  c.restore();
}
function goalMarks(c,s,p,time) {
  const g=s.goal;
  if(s.kind==='glass'){
    depthMark(c,g.x,g.y,g.half,p);
    if(g.topLine){
      // The upper mark is a limit: drawn in the warning ink.
      depthMark(c,g.x,g.topLine,g.topHalf,{...p,rim:'#f0a08a'});
    }
    if(s.gate)slide(c,s.gate,p);
  }else if(s.kind==='pile'){
    c.save();c.lineWidth=.35;c.strokeStyle=p.rim+'90';c.setLineDash([.8,1.8]);
    c.beginPath();c.moveTo(g.x,g.y+2.5);c.lineTo(g.x,g.base);c.stroke();c.restore();
    const pulse=s.progress>=1?1.25:.9+.12*Math.cos(time*3);
    star(c,g.x,g.y,3.4*pulse,p.dark);star(c,g.x,g.y,2.6*pulse,p.moon);
  }else if(s.kind==='layers'){
    const {jar}=g, half=(jar.x2-jar.x1)/2-.5, mid=(jar.x1+jar.x2)/2+.5;
    c.fillStyle=p.teal+'14';c.fillRect(jar.x1+1,jar.top,jar.x2-jar.x1-1,jar.bottom-jar.top);
    depthMark(c,mid,jar.lower,half,{...p,rim:p.sand[3]});
    depthMark(c,mid,jar.upper,half,{...p,rim:p.fine[3]});
  }else if(s.kind==='sieve'){
    catchSymbol(c,g.x,g.y,true,p);
    catchSymbol(c,g.coarseX,g.y,false,p);
  }else if(s.kind==='seed'){
    // Section marks show both limits even when the seed is below sand.
    const top=g.y-g.maxDepth,bottom=g.y-g.minDepth;
    c.fillStyle=p.teal+'23';c.fillRect(g.x-8,top,16,bottom-top);
    for(const sign of [-1,1]){
      const x=g.x+sign*8;
      const bracket=[[x-1.6*sign,top],[x,top],[x,bottom],[x-1.6*sign,bottom]];
      polyline(c,bracket,p.dark,1.3);polyline(c,bracket,p.teal,.58);
    }
    seed(c,g,p,s.progress,s.status==='won');
  }else if(s.kind==='garden'){
    c.save();c.lineWidth=.3;c.strokeStyle=p.rim+'96';
    c.setLineDash([.9,2.4]);c.beginPath();c.moveTo(W/2,4);c.lineTo(W/2,H-3);c.stroke();
    c.restore();
  }else if(s.kind==='lamp'){
    if(s.gate)slide(c,s.gate,p);
    if(s.progress<.8){
      // A buried lamp still shows through the sand as a warm glow, so the player knows where to dig.
      const pulse=.65+.35*Math.cos(time*2.8);
      c.save();c.globalCompositeOperation='lighter';
      const glow=c.createRadialGradient(g.x,g.y,0,g.x,g.y,16);
      const a=n=>Math.round(n).toString(16).padStart(2,'0');
      glow.addColorStop(0,'#fff0c0'+a(110+70*pulse));glow.addColorStop(.45,'#ffb84a'+a(40+40*pulse));glow.addColorStop(1,'#ffb84a00');
      c.fillStyle=glow;c.fillRect(g.x-16,g.y-16,32,32);
      c.restore();
      // A glint on the surface right above the lamp.
      let top=1;while(top<H-1&&!s.cells[top*W+Math.round(g.x)])top++;
      c.save();c.globalAlpha=pulse;
      star(c,g.x,top-3,1.8,p.rim);
      c.restore();
    }
  }
}
function ghost(c,s,p,time) {
  const h=s.hint;
  if(!h) return;
  const dx=h.toX-h.x,dy=h.toY-h.y;
  const dist=Math.hypot(dx,dy);
  if(dist<1)return;
  const sweep=.5-.5*Math.cos(Math.PI*Math.min(1,(time%3)/2.15));
  const x=h.x+dx*sweep, y=h.y+dy*sweep;
  c.save();c.lineCap='round';c.lineJoin='round';
  const route=[[h.x,h.y],[h.toX,h.toY]];
  c.setLineDash([.8,2.1]);polyline(c,route,p.dark+'b0',1.2);polyline(c,route,p.rim+'c9',.65);
  c.setLineDash([]);
  const angle=Math.atan2(dy,dx);
  const wing=offset=>[h.toX-3.35*Math.cos(angle+offset),h.toY-3.35*Math.sin(angle+offset)];
  const arrow=[wing(.52),[h.toX,h.toY],wing(-.52)];
  polyline(c,arrow,p.dark,1.4);polyline(c,arrow,p.rim,.7);
  c.beginPath();c.arc(x,y,2.45,0,tau);c.fillStyle=p.dark+'61';c.fill();
  c.strokeStyle=p.rim;c.lineWidth=.55;c.stroke();
  ellipse(c,x,y,.7,.7,p.rim);
  c.restore();
}
function tool(c,s,p,focused){
  if(!s.hand.down){
    if(focused){
      const {x,y}=s.hand;
      c.save();
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2;
        const segment=[2.4,4.3].map(r=>[x+Math.cos(a)*r,y+Math.sin(a)*r]);
        polyline(c,segment,p.dark,.9);polyline(c,segment,p.rim,.45);
      }
      c.restore();
    }
    return;
  }
  const {x,y,load}=s.hand;
  c.save();c.translate(x,y);c.strokeStyle=p.rim;c.lineWidth=.55;
  c.setLineDash([2.2,1.3]);c.beginPath();c.arc(0,0,5.9,0,tau);c.stroke();c.setLineDash([]);
  if(s.kind==='garden'){
    for(let i=-1;i<=1;i++)polyline(c,[[i*2,-2.4],[i*2,2.3]],p.rim,.55);
  }else if(load>0&&!s.hand.board){
    // The handful is real sand: a little heap of the very grains held, sitting on the fingertip.
    const shown=Math.min(load,150);
    let k=0;
    for(let row=0;k<shown;row++){
      const width=Math.min(2*row+1,13);
      for(let j=0;j<width&&k<shown;j++,k++){
        const grain=s.scoop[s.scoop.length-1-k]%16;
        c.fillStyle=grain>=5?p.fine[grain-5]:p.sand[Math.max(0,grain-1)];
        c.fillRect(j-(width>>1)-.5,row-Math.ceil(Math.sqrt(shown))+.2,1,1);
      }
    }
  }
  c.restore();
}

export function renderer(canvas) {
  const ctx=canvas.getContext('2d',{alpha:false});
  const layer=canvasOf(W,H), grit=layer.getContext('2d');
  const image=grit.createImageData(W,H), pixels=new Uint32Array(image.data.buffer);
  const strata=strataMap(), surface=new Int16Array(W);
  let cached=null, previousState, previousPalette, lut;
  function size(){
    const box=canvas.getBoundingClientRect();
    if(!box.width||!box.height)return;
    const density=Math.min(2,window.devicePixelRatio||1);
    const width=Math.round(box.width*density), height=Math.round(box.height*density);
    if(width!==canvas.width)canvas.width=width;
    if(height!==canvas.height)canvas.height=height;
  }
  size();
  new ResizeObserver(size).observe(canvas);
  return (s,{look='basalt',time=s.ticks/60,intro=false,focused=false,glow=0}={})=>{
    const p=inks[look]||inks.basalt;
    if(previousState!==s||previousPalette!==p){
      cached=plate(s,p);
      if(s.kind==='garden'){
        const muted=look==='plum'?['#c38d7c','#c8917f','#cb9481','#cd9783']:['#cba062','#d0a363','#d2a566','#d6a969'];
        lut=sandInks({...p,sand:muted});
      }else lut=sandInks(p);
      previousState=s;previousPalette=p;
    }
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    ctx.drawImage(cached,0,0,W,H);
    if(s.kind==='lamp') lamp(ctx,s.goal.x,s.goal.y,p,s.progress,time);
    grains(pixels,s,lut,strata,surface);
    if(s.kind==='garden')carve(pixels,s,p);
    grit.putImageData(image,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(layer,0,0);
    ctx.imageSmoothingEnabled=true;
    goalMarks(ctx,s,p,time);
    if(intro&&s.status==='play'&&!s.hand.down)ghost(ctx,s,p,time);
    tool(ctx,s,p,focused);
    if(glow>0){
      // A bed that is done lights up for a moment.
      ctx.fillStyle=`rgba(255,226,160,${(.28*glow).toFixed(3)})`;ctx.fillRect(0,0,W,H);
    }
  };
}
