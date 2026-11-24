import { create, step, view, LEVELS, DT } from './sim.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { lab } from '../../kit/lab.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';

noZoom();
const $ = id => document.getElementById(id), query = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const landscape = matchMedia('(orientation: landscape) and (max-height: 480px)');
const KEY = 'night-bells:save';
const HINT_LIFT = 20, HINT_HEIGHT = 53;
const palettes = {
  amber: { sky:'#111e30', horizon:'#334956', stone:'#304150', edge:'#4d5d65', accent:'#ffcd75', ink:'#f9e7be', panel:'#192b3e', bells:['#f4c878','#98cebf','#d5aece'] },
  moon: { sky:'#101d30', horizon:'#365a73', stone:'#2b425c', edge:'#536b83', accent:'#a6dfef', ink:'#e5f5ff', panel:'#172f49', bells:['#a6dfef','#bab9f0','#f4d8a3'] },
  rose: { sky:'#291e36', horizon:'#725166', stone:'#4a354c', edge:'#715569', accent:'#f0abc1', ink:'#ffe6de', panel:'#3e2a45', bells:['#f0abc1','#e5c48a','#a9cdc8'] },
};
const save = { v:1, stars:Array(LEVELS).fill(0), best:0, sound:true, tries:0, look:'amber' };
const old = readJson(KEY);
if (old && typeof old === 'object') {
  if (Array.isArray(old.stars)) save.stars = save.stars.map((_,i) => Number.isFinite(old.stars[i]) ? Math.max(0,Math.min(3,Math.floor(old.stars[i]))) : 0);
  if (Number.isFinite(old.best)) save.best = Math.max(0,Math.floor(old.best));
  if (Number.isFinite(old.tries)) save.tries = Math.max(0,Math.floor(old.tries));
  if (typeof old.sound === 'boolean') save.sound = old.sound;
  if (Object.hasOwn(palettes,old.look)) save.look = old.look;
}
if (Object.hasOwn(palettes,query.get('look'))) save.look = query.get('look');
const store = () => writeJson(KEY, save);
let palette = palettes[save.look], mode='menu', selected=1, s=create(3,17), W=0,H=0,dpr=1,top=0,bottom=0,safeLeft=0,safeRight=0;
let accumulator=0,last=performance.now(),queue=[],activePointer=null,burst=0,ringTime=0;
let pads=[],positions=[],gallery={},fx=[];
const cv=$('c'),g=cv.getContext('2d'),snd=sound({on:()=>save.sound});
const objective=$('objective');
const unlocked=()=>{let n=1;while(n<LEVELS&&save.stars[n-1])n++;return n;};
selected=unlocked();
const show=screens(['menu','paused','end'],name=>{
  mode=name; $('pause').style.display=name==='play'?'block':'none';
  objective.hidden=name!=='play'||s.endless||s.bells.length===1||s.harmony>0;
  for(let i=0;i<3;i++) $('pad'+i).style.display=name==='play'&&i<s.bells.length?'block':'none';
});
function applyPalette(){
  palette=palettes[save.look];
  for(const [name,value] of Object.entries({ink:palette.ink,accent:palette.accent,panel:palette.panel})) document.documentElement.style.setProperty('--'+name,value);
  document.querySelector('meta[name="theme-color"]').content=palette.sky;
  for(const b of document.querySelectorAll('[data-look]')) b.setAttribute('aria-pressed',String(b.dataset.look===save.look));
}
// Play recording for the game lab: one run is one try at a night (or the endless mode).
const rec=lab('night-bells');let running=false;
function recStart(level,endless){running=true;rec.start({level,endless,look:save.look});}
function recEnd(outcome,extra){if(!running)return;running=false;rec.end(outcome,{level:s.level,endless:!!s.endless,t:Math.round(s.t*10)/10,hits:s.hits,harmony:s.harmony,misses:s.misses,score:Math.floor(s.score),...extra});}
function menu(){
  recEnd('quit');
  queue=[];activePointer=null;snd.hold();show('menu');
  s=create(3,17);selected=Math.min(selected,unlocked());$('levels').replaceChildren();
  for(let i=1;i<=LEVELS;i++){
    const b=document.createElement('button');b.dataset.level=i;b.textContent=save.stars[i-1]?'✦ '+i:String(i);b.disabled=i>unlocked();
    b.className=(save.stars[i-1]?'done ':'')+(selected===i?'selected':'');b.setAttribute('aria-label',`Level ${i}${save.stars[i-1]?', completed':''}`);
    b.onclick=()=>{selected=i;start(i,false);};$('levels').append(b);
  }
  $('best').textContent=`Best on this device · ${save.best}`;
  $('play').setAttribute('aria-label',`Play level ${selected}`);soundLabels();layout();
}
function start(level,endless){
  recEnd('quit');
  const seed=Number(query.get('seed'))||((save.tries+1)*9137);
  s=create(level,seed,endless);save.tries++;store();queue=[];activePointer=null;fx=[];burst=0;accumulator=0;last=performance.now();
  snd.unlock();snd.release();recStart(level,!!endless);show('play');layout();
}
function pause(){if(mode!=='play')return;queue=[];activePointer=null;accumulator=0;snd.hold();show('paused');}
function resume(){if(mode!=='paused')return;queue=[];last=performance.now();accumulator=0;snd.unlock();snd.release();show('play');}
function finish(){
  queue=[];activePointer=null;
  if(s.endless){save.best=Math.max(save.best,Math.floor(s.score));}
  else if(s.won){save.stars[s.level-1]=Math.max(save.stars[s.level-1],s.misses===0?3:s.misses<4?2:1);selected=Math.min(LEVELS,s.level+1);}
  store();
  if(s.won&&!s.endless)rec.event('level-complete',{level:s.level,stars:save.stars[s.level-1]});
  if(s.endless)rec.event('endless-finished',{score:Math.floor(s.score),best:save.best});
  recEnd(s.won?'won':'lost',s.won&&!s.endless?{stars:save.stars[s.level-1]}:{});
  show('end');
  $('endMark').textContent=s.won?'✦ '.repeat(save.stars[s.level-1]).trim():'☾';
  $('endLabel').textContent=s.endless?'Endless · on this device':s.won?`Night ${s.level} complete`:'The bells fell quiet';
  $('endTitle').textContent=s.endless?`${Math.floor(s.score)} lights`:s.won?(s.level===8?'The village is awake.':'A little brighter.'):'One more swing?';
  $('endLine').textContent=s.endless?`Best ${save.best} · ${s.hits} rings · ${s.harmony} together`:`${s.hits} rings${s.bells.length>1?` · ${s.harmony} together`:''} · ${s.t.toFixed(1)} seconds`;
  $('next').textContent=s.won&&!s.endless?(s.level<LEVELS?'Next →':'Endless ∞'):'Try again ↻';
  if(s.won)chime(-1);
}
function chime(i){
  if(!save.sound)return;
  const f=i<0?523.25:[523.25,659.25,783.99][i];
  snd.tone(f,.85,.075);snd.tone(f*2.01,.32,.025);snd.tone(f*3,.18,.009);
}
function soundLabels(){for(const id of ['sound1','sound2'])$(id).textContent=`Sound ${save.sound?'on':'off'}`;}
for(const id of ['sound1','sound2']) $(id).onclick=()=>{save.sound=!save.sound;store();soundLabels();if(save.sound){snd.unlock();if(mode!=='paused')snd.release();chime(0);}else snd.hold();};
$('play').onclick=()=>start(selected,false);$('endless').onclick=()=>start(1,true);
$('pause').onclick=pause;$('resume').onclick=resume;$('quit').onclick=menu;$('toMenu').onclick=menu;
$('retry').onclick=()=>start(s.level,s.endless);
$('next').onclick=()=>s.won&&!s.endless?(s.level<LEVELS?start(s.level+1,false):start(1,true)):start(s.level,s.endless);
for(const b of document.querySelectorAll('[data-look]'))b.onclick=()=>{save.look=b.dataset.look;applyPalette();store();};
onLeave(pause);
const learning=()=>mode==='play'&&!s.endless&&s.level===1;
function tap(i){if(mode!=='play'||i>=s.bells.length||queue.length)return;queue.push(i);if(learning())help.done();snd.unlock();}
for(let i=0;i<3;i++){
  $('pad'+i).addEventListener('pointerdown',e=>{e.preventDefault();if(!e.isPrimary||activePointer!==null)return;activePointer=e.pointerId;tap(i);});
  $('pad'+i).addEventListener('click',e=>{if(e.detail===0)tap(i);});
}
cv.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||activePointer!==null||mode!=='play')return;e.preventDefault();
  let best=-1,d=Infinity;
  positions.forEach((p,i)=>{const n=Math.hypot(e.clientX-p.x,e.clientY-p.y);if(n<d&&n<p.hitRadius){best=i;d=n;}});
  if(best>=0){activePointer=e.pointerId;tap(best);}
});
for(const type of ['pointerup','pointercancel'])addEventListener(type,e=>{if(e.pointerId===activePointer)activePointer=null;});
addEventListener('keydown',e=>{
  if(isPauseKey(e)){e.preventDefault();mode==='play'?pause():resume();return;}
  if(e.repeat)return;
  const i=Number(e.key)-1;if(i>=0&&i<3){e.preventDefault();tap(i);}
  if(e.code==='Space'&&mode==='play'&&s.bells.length===1){e.preventDefault();tap(0);}
});
const help=hint($('pad0'),{kind:'tap',key:'night-bells:hint',when:learning,played:save.stars[0]>0,delay:1600,label:'Tap the circle when its ring shines'});
function layout(){
  W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  const cs=getComputedStyle($('probe'));top=parseFloat(cs.paddingTop)||0;bottom=parseFloat(cs.paddingBottom)||0;
  safeLeft=parseFloat(cs.paddingLeft)||0;safeRight=parseFloat(cs.paddingRight)||0;
  const n=s.bells.length,span=Math.min(W-36,460),left=(W-span)/2;
  const clearance=Math.max(HINT_LIFT+HINT_HEIGHT+5,Math.min(100,H*.13));
  document.documentElement.style.setProperty('--pad-clearance',`${clearance}px`);
  pads=s.bells.map((_,i)=>({x:left+span*(i+.5)/n,y:H-bottom-clearance,r:Math.min(43,(span/n-16)/2)}));
  pads.forEach((p,i)=>Object.assign($('pad'+i).style,{left:`${p.x-p.r-7}px`,top:`${p.y-p.r-7}px`,width:`${2*p.r+14}px`,height:`${2*p.r+14}px`}));
}
addEventListener('resize',layout);
function update(){
  const prevHits=s.hits,prevHarmony=s.harmony,prevMiss=s.misses;
  step(s,queue.splice(0,1));
  if(s.hits>prevHits){const i=s.events.find(e=>e.type==='hit')?.index??0;chime(i);const p=positions[Math.max(0,i)];if(p)fx.push({x:p.x,y:p.y,t:0,c:palette.bells[Math.max(0,i)]});ringTime=s.t;}
  if(s.harmony>prevHarmony){objective.hidden=true;burst=1;chime(-1);}
  if(s.endless&&s.score>save.best){save.best=Math.floor(s.score);store();}
  if(s.misses>prevMiss&&save.sound)snd.tone(130,.08,.015,'triangle',-45);
  burst=Math.max(0,burst-DT*.65);fx=fx.filter(f=>(f.t+=DT)<.8);
  if(s.over)finish();
}
function circle(x,y,r,fill,stroke,width=1){g.beginPath();g.arc(x,y,Math.max(.1,r),0,Math.PI*2);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
function line(x,y,a,b,c,w=1){g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.strokeStyle=c;g.lineWidth=w;g.stroke();}
function bell(x,y,size,color,angle=0,pulse=0){
  g.save();g.translate(x,y);g.rotate(-angle*.4);g.scale(1+pulse*.1,1-pulse*.08);
  const grad=g.createLinearGradient(-size,0,size,0);grad.addColorStop(0,color);grad.addColorStop(.44,'#fff0c5');grad.addColorStop(.6,color);grad.addColorStop(1,color+'88');
  circle(0,size*.48,size*.13,color);g.beginPath();g.moveTo(-size*.48,size*.34);g.quadraticCurveTo(-size*.32,size*.12,-size*.31,-size*.23);g.quadraticCurveTo(-size*.28,-size*.56,0,-size*.56);g.quadraticCurveTo(size*.28,-size*.56,size*.31,-size*.23);g.quadraticCurveTo(size*.32,size*.12,size*.48,size*.34);g.closePath();g.fillStyle=grad;g.fill();g.strokeStyle='#101e3055';g.lineWidth=2;g.stroke();
  line(-size*.48,size*.34,size*.48,size*.34,color,4);circle(0,-size*.6,size*.08,null,color,3);g.restore();
}
function village(){
  const ground=H*.69,n=11,lit=s.endless?Math.min(1,s.score/50):Math.min(1,s.lights/Math.max(1,s.target));
  g.fillStyle=palette.horizon;g.globalAlpha=.38;g.beginPath();g.moveTo(0,H*.65);g.bezierCurveTo(W*.3,H*.5,W*.6,H*.68,W,H*.56);g.lineTo(W,H);g.lineTo(0,H);g.fill();g.globalAlpha=1;
  for(let j=0;j<2;j++)for(let i=0;i<n;i++){
    const width=W/n+3,x=i*W/n+(j? -13:0),height=29+((i*17+j*29)%30),y=ground+j*32-height;
    g.fillStyle=j?'#132638':palette.stone;g.fillRect(x,y,width-2,height+24);
    g.beginPath();g.moveTo(x-4,y+1);g.lineTo(x+width*.47,y-13-(i%3)*3);g.lineTo(x+width+2,y+1);g.closePath();g.fillStyle=j?'#203443':palette.edge;g.fill();
    g.fillStyle='#152538';g.fillRect(x+width*.65,y-16,4,11);
    for(let k=0;k<4;k++){
      const wx=x+6+(k%2)*(width*.43),wy=y+8+Math.floor(k/2)*13;
      const on=((i*13+k*7+j*19)%44)/44<lit||burst>.25;
      if(on){g.shadowColor=palette.accent;g.shadowBlur=reduced?0:8+burst*12;g.fillStyle=palette.accent;}else{g.shadowBlur=0;g.fillStyle='#09192a';}
      g.fillRect(wx,wy,4.5,7);g.shadowBlur=0;
    }
  }
  const grad=g.createLinearGradient(0,ground,0,H*.87);grad.addColorStop(0,'#101e3000');grad.addColorStop(1,palette.sky);g.fillStyle=grad;g.fillRect(0,ground,W,H-ground);
}
function tower(){
  const n=s.bells.length,sideMenu=mode==='menu'&&landscape.matches;
  const span=Math.min(sideMenu?W*.42:W-34,480),center=sideMenu?W*.25:W/2,left=center-span/2;
  const roof=top+Math.max(H*.17,mode==='menu'?0:112),base=roof+H*.29;
  g.fillStyle=palette.stone;g.fillRect(left-10,roof-14,span+20,16);g.fillStyle=palette.edge;g.fillRect(left-15,roof-18,span+30,5);
  g.fillStyle=palette.stone;g.fillRect(left-7,roof,9,base-roof+8);g.fillRect(left+span-2,roof,9,base-roof+8);
  positions=[];
  const lengths=s.bells.map(b=>b.length),shortest=Math.min(...lengths),range=Math.max(...lengths)-shortest;
  const swingLength=Math.min(H*.20,n===1?135:n===2?105:78);
  s.bells.forEach((b,i)=>{
    const v=view(s,i),cx=left+span*(i+.5)/n,py=roof+15;
    const size=n===1?57:n===2?44:36;
    const lengthOffset=range?(b.length-shortest)/range*(n===3?18:25):0;
    const len=Math.max(1,Math.min(base-py-size*.65-4,swingLength+lengthOffset));
    const theta=v.angle,x=cx+Math.sin(theta)*len,y=py+Math.cos(theta)*len;
    positions.push({x,y,hitRadius:Math.max(24,size*.65),lowest:py+len+size*.65});
    // The two apex rings are fixed in the bell's current swing envelope.
    const peak=.68*Math.sqrt(Math.max(.015,v.energy));
    g.save();g.setLineDash([2,6]);g.strokeStyle=palette.bells[i]+'40';g.lineWidth=1;g.beginPath();g.arc(cx,py,len,Math.PI/2-peak,Math.PI/2+peak);g.stroke();g.restore();
    for(const side of [-1,1]){const ax=cx+Math.sin(peak*side)*len,ay=py+Math.cos(peak)*len;circle(ax,ay,size*.62,null,v.ready?palette.bells[i]+'bb':palette.bells[i]+'38',v.ready?2:1);}
    g.strokeStyle=palette.edge;g.lineWidth=3;g.beginPath();g.ellipse(cx,roof+34,span/n*.43,Math.min(55,H*.07),0,Math.PI,0);g.stroke();
    line(cx,py,x,y-size*.49,palette.bells[i]+'99',2.5);circle(cx,py,4,palette.accent);
    if(v.ready){g.shadowColor=palette.bells[i];g.shadowBlur=reduced?0:22;circle(x,y,size*.68,palette.bells[i]+'14');g.shadowBlur=0;}
    bell(x,y,size,palette.bells[i],theta,Math.min(1,v.hitFlash*5));
    if(v.missFlash>0){line(x-7,y-8,x+7,y+6,'#f18f86',3);line(x+7,y-8,x-7,y+6,'#f18f86',3);}
    // A rope visually links each bell to the matching thumb pad.
    if(mode!=='menu')line(cx,base+8,pads[i].x,pads[i].y-pads[i].r-15,palette.bells[i]+'22',1);
  });
  g.fillStyle=palette.stone;g.fillRect(left-10,base,span+20,10);g.fillStyle=palette.edge;g.fillRect(left-12,base-2,span+24,3);
  // The ringer stands on the gallery. A successful ring lifts one arm.
  const rx=n===1?left+span*.08:center,ry=base-23,reach=s.t-ringTime<.25?10:0;
  gallery={left,right:left+span,y:base,ringerX:rx};
  circle(rx,ry-8,5,palette.ink);g.fillStyle=palette.ink;g.beginPath();g.moveTo(rx-4,ry-2);g.lineTo(rx+4,ry-2);g.lineTo(rx+7,base);g.lineTo(rx-7,base);g.fill();line(rx-3,ry,rx-14,ry-7-reach,palette.ink,3);line(rx+3,ry,rx+14,ry-7-reach,palette.ink,3);
}
function controls(){
  s.bells.forEach((b,i)=>{
    const p=pads[i],v=view(s,i),color=palette.bells[i];
    circle(p.x,p.y,p.r+6,null,color+'20',1);
    if(v.ready){g.shadowColor=color;g.shadowBlur=reduced?0:24;circle(p.x,p.y,p.r,color+'30',color,3);g.shadowBlur=0;}
    else circle(p.x,p.y,p.r,palette.panel,color+'60',1.5);
    g.beginPath();g.arc(p.x,p.y,p.r+6,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,v.energy)));g.lineWidth=3;g.strokeStyle=color;g.stroke();
    bell(p.x,p.y,26,color,0,Math.min(1,v.hitFlash*5));
    const phase=v.phase%(Math.PI*2);circle(p.x+Math.sin(phase)*(p.r+6),p.y-Math.cos(phase)*(p.r+6),3.2,palette.ink);
    if(v.missFlash>0){g.fillStyle='#ef9b93';g.font='bold 18px system-ui';g.textAlign='center';g.fillText('×',p.x,p.y-p.r-14);}
  });
}
function draw(){
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,palette.sky);bg.addColorStop(.7,palette.horizon);bg.addColorStop(1,palette.sky);g.fillStyle=bg;g.fillRect(0,0,W,H);
  for(let i=0;i<45;i++){const x=((i*83+19)%397)/397*W,y=((i*47+13)%271)/271*H*.55;circle(x,y,i%5===0?1.4:.7,palette.ink+(i%3===0?'88':'40'));}
  circle(W*.83,H*.11+top,17,palette.ink);circle(W*.83-7,H*.11+top-5,16,palette.sky);
  village();tower();
  if(burst>0&&!reduced){g.globalAlpha=burst*.10;g.fillStyle=palette.accent;g.fillRect(0,0,W,H);g.globalAlpha=1;}
  if(mode!=='menu'){
    const hudX=22+safeLeft;
    g.textAlign='left';g.fillStyle=palette.ink;g.font='11px system-ui';g.fillText(s.endless?'ENDLESS':`NIGHT  ${s.level} / 8`,hudX,top+30);
    g.font='23px Georgia';g.fillText(s.endless?`${Math.floor(s.score)} lights`:`${Math.min(s.target,Math.floor(s.lights))} / ${s.target}`,hudX,top+57);
    const width=Math.min(W-110-safeLeft-safeRight,240);g.fillStyle='#ffffff16';g.fillRect(hudX,top+70,width,3);g.fillStyle=palette.accent;g.fillRect(hudX,top+70,width*(s.endless?Math.min(1,s.bells.reduce((a,b)=>a+b.energy,0)/s.bells.length):Math.min(1,s.lights/Math.max(1,s.target))),3);
    controls();
    // The kit owns help delay, dismissal and persistence. This demonstration follows the actual beat.
    if(help.shown&&!reduced&&s.level===1){
      const p=pads[0],ready=view(s,0).ready,lift=ready?0:HINT_LIFT;
      g.save();g.translate(p.x+8,p.y+lift);g.globalAlpha=.88;g.fillStyle=palette.ink;
      g.shadowColor='#0008';g.shadowBlur=6;
      g.beginPath();g.roundRect(-4,0,9,35,4);g.fill();
      g.beginPath();g.roundRect(-4,24,31,HINT_HEIGHT-24,9);g.fill();
      g.beginPath();g.roundRect(5,16,8,22,4);g.roundRect(13,20,8,20,4);g.roundRect(21,25,7,18,4);g.fill();
      g.restore();if(ready)circle(p.x,p.y,p.r-5,null,palette.ink,2);
    }
    if(s.harmony>0&&burst>.1){g.textAlign='center';g.font='14px Georgia';g.fillStyle=palette.ink;g.fillText(s.bells.length>1?'✦  TOGETHER  ✦':'✦',W/2,H*.58);}
    if(Number.isFinite(s.timeLimit)&&s.timeLimit>0&&!s.endless){g.textAlign='right';g.font='11px system-ui';g.fillStyle=palette.ink+'99';g.fillText(`${Math.ceil(Math.max(0,s.timeLimit-s.t))}s`,W-22-safeRight,H-bottom-25);}
  }
  if(!reduced)for(const f of fx){g.globalAlpha=Math.max(0,1-f.t/.8);circle(f.x,f.y,24+f.t*90,null,f.c,2);g.globalAlpha=1;}
}
function frame(now){
  const elapsed=Math.min(.075,Math.max(0,(now-last)/1000));last=now;
  if(mode==='play'){accumulator+=elapsed;while(accumulator>=DT&&mode==='play'){update();accumulator-=DT;}}
  else if(mode==='menu'){s.t+=elapsed;for(const b of s.bells)b.phase+=elapsed*b.omega;}
  draw();requestAnimationFrame(frame);
}
window.bellsState=()=>({
  ...structuredClone(s),screen:mode,W,H,views:s.bells.map((_,i)=>view(s,i)),saved:structuredClone(save),
  pads:structuredClone(pads),positions:structuredClone(positions),gallery:{...gallery},hintBottom:pads[0]?.y+HINT_LIFT+HINT_HEIGHT,
  minTouchPx:Math.min(...[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height))),
});
if(query.get('test')==='1')window.bellsAdvance=seconds=>{if(mode==='play'){for(let i=0;i<Math.ceil(Math.min(120,Math.max(0,seconds))/DT)&&mode==='play';i++)update();}return window.bellsState();};
applyPalette();menu();requestAnimationFrame(frame);

// The notice is on the menu card, seen before Play; the switch is on the pause card.
rec.notice($('menu').firstElementChild);rec.toggle($('paused').firstElementChild);
