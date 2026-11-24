import {create,step,ripple,pebble,flow,DT,LEVELS} from './sim.js';
import {readJson,writeJson} from '../../kit/save.js';
import {sound} from '../../kit/audio.js';
import {onLeave,isPauseKey} from '../../kit/pause.js';
import {screens} from '../../kit/screens.js';
import {hint} from '../../kit/hint.js';
import {noZoom} from '../../kit/zoom.js';
noZoom();
const $=id=>document.getElementById(id), cv=$('c'), g=cv.getContext('2d');
const saved=readJson('boat-b-save',null);
const save={v:1,best:0,stars:[0,0,0,0,0,0],runs:0,sound:true};
if(saved && typeof saved==='object') {
  for(const k of ['best','runs']) if(Number.isFinite(saved[k])&&saved[k]>=0) save[k]=saved[k];
  if(typeof saved.sound==='boolean') save.sound=saved.sound;
  if(Array.isArray(saved.stars)) save.stars=save.stars.map((_,i)=>Math.max(0,Math.min(3,Number(saved.stars[i])||0)));
}
const store=()=>writeJson('boat-b-save',save), snd=sound({on:()=>save.sound});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let W,H,scale,left,boatY,dpr,bottom,top;
function layout(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);cv.width=W*dpr;cv.height=H*dpr;const cs=getComputedStyle($('insets'));top=parseFloat(cs.paddingTop)||0;bottom=parseFloat(cs.paddingBottom)||0;scale=Math.min(W-52,430)/100;left=(W-scale*100)/2;boatY=top+(H-top-bottom)*.58;}
addEventListener('resize',layout); layout();
let s=create({seed:7}),screen='menu',last=performance.now(),acc=0,clock=0,shake=0,wobble=0,toastTime=0,finishDelay=0;
let points=[],particles=[],rings=[],finger=null,keys=new Set(),keyTicks=0;
let actions={ripple:0,pebble:0},tripScore=0,tripScores=[0,0,0,0,0,0];
const show=screens(['menu','paused','end'],name=>{screen=name;for(const id of ['pause','hud','bottom']) $(id).style.display=name==='play'?'block':'none';});
const X=x=>left+x*scale,Y=y=>boatY-(y-s.boat.y)*scale;
function chord(win=true){[0,1,2,3].forEach((i)=>snd.tone((win?[523,659,784,1047]:[330,294,220,196])[i],.3+i*.08,.045,'triangle'));}
function burst(x,y,color='#f8dda3',count=16){if(reduced)count=Math.min(count,5);for(let i=0;i<count;i++){const a=i*2.399+clock;particles.push({x,y,vx:Math.cos(a)*(25+i%5*10),vy:Math.sin(a)*(25+i%7*9)-20,life:.7+i%4*.15,max:1.15,color,r:2+i%3});}}
function toast(text){$('toast').textContent=text;toastTime=2.3;}
function begin(level=0,reset=false){snd.unlock();snd.release();if(reset){tripScore=0;tripScores.fill(0);}s=create({level,seed:7});actions={ripple:0,pebble:0};points=[];particles=[];rings=[];finger=null;keys.clear();acc=0;finishDelay=0;last=performance.now();show('play');$('street').textContent=`Street ${level+1} / 6`;$('streetName').textContent=LEVELS[level].name;$('progress').innerHTML=LEVELS.map((_,i)=>`<i class="${i<=level?'on':''}"></i>`).join('');document.activeElement?.blur();snd.tone(480,.3,.06,'sine',200);}
function pause(){if(screen!=='play'||s.status!=='play')return;finger=null;keys.clear();show('paused');snd.hold();$('sound').textContent=save.sound?'Sound on':'Sound off';}
function resume(){snd.unlock();snd.release();show('play');last=performance.now();acc=0;}
function menu(){finger=null;keys.clear();snd.release();show('menu');}
function finish(){save.runs++;const won=s.status==='won';if(won){save.stars[s.level]=Math.max(save.stars[s.level],s.stars);tripScores[s.level]=s.score;tripScore=tripScores.reduce((a,b)=>a+b,0);}save.best=Math.max(save.best,tripScore);store();$('endLabel').textContent=won?`Street ${s.level+1} complete`:'The paper got wet';$('endTitle').textContent=won?(s.level===5?'Hello, pond.':'A safe landing.'):'Another little boat?';$('stars').textContent=won?'★'.repeat(s.stars)+'☆'.repeat(3-s.stars):'≈';$('stars').setAttribute('aria-label',`${won?s.stars:0} stars`);const aboard=s.passengers.filter(p=>p.collected).length;$('endStat').textContent=won?`${aboard} ${aboard===1?'passenger':'passengers'} home · ${s.score} points`:'Try a ripple beside the boat.';$('best').textContent=`Best ${save.best} · ${save.stars.reduce((a,b)=>a+b,0)} / 18 stars`;$('next').textContent=won?(s.level<5?'Next street':'Sail again'):'Try again';show('end');}
$('play').onclick=()=>begin(0,true);$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=()=>begin(s.level);$('home').onclick=menu;$('endHome').onclick=menu;$('again').onclick=()=>begin(s.level);$('next').onclick=()=>begin(s.status==='won'?(s.level+1)%6:s.level,s.status==='won'&&s.level===5);
$('sound').onclick=()=>{save.sound=!save.sound;store();$('sound').textContent=save.sound?'Sound on':'Sound off';if(save.sound)snd.unlock();};
onLeave(pause);
function world(e){return {x:(e.clientX-left)/scale,y:s.boat.y+(boatY-e.clientY)/scale};}
function makeRipple(a,b){const dx=b.x-a.x,dy=b.y-a.y;if(Math.hypot(dx,dy)<1)return;ripple(s,{x:a.x,y:a.y,dx,dy});actions.ripple++;wobble=.5;rings.push({x:a.x,y:a.y,age:0,kind:'stroke',dx,dy});snd.noise(.07,.024,1300);snd.tone(540+Math.min(300,Math.abs(dx)*10),.08,.018,'sine',-180);}
function drop(p){pebble(s,p);actions.pebble++;rings.push({...p,age:0,kind:'pebble'});burst(X(p.x),Y(p.y),'#b9eee0',10);snd.tone(560,.18,.09,'sine',-380);snd.noise(.09,.06,800);wobble=.6;}
cv.addEventListener('pointerdown',e=>{if(screen!=='play'||s.status!=='play'||finger)return;e.preventDefault();snd.unlock();const p=world(e);finger={id:e.pointerId,start:p,last:p,total:0};points=[p];try{cv.setPointerCapture(e.pointerId);}catch{}});
cv.addEventListener('pointermove',e=>{if(!finger||finger.id!==e.pointerId||screen!=='play')return;e.preventDefault();const p=world(e),d=Math.hypot(p.x-finger.last.x,p.y-finger.last.y);if(d>=3){makeRipple(finger.last,p);finger.total+=d;finger.last=p;points.push(p);if(points.length>18)points.shift();}});
function release(e){if(!finger||finger.id!==e.pointerId)return;if(screen==='play'&&s.status==='play'&&finger.total<3&&e.type!=='pointercancel')drop(world(e));finger=null;points=[];}
cv.addEventListener('pointerup',release);cv.addEventListener('pointercancel',release);cv.addEventListener('lostpointercapture',()=>{finger=null;points=[];});
addEventListener('keydown',e=>{if(isPauseKey(e)){e.preventDefault();screen==='paused'?resume():pause();return;}if(screen!=='play')return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','a','d'].includes(e.key)){e.preventDefault();keys.add(e.key);if(e.key===' '&&!e.repeat)drop({x:s.boat.x-13,y:s.boat.y+2});}});
addEventListener('keyup',e=>keys.delete(e.key));
hint(cv,{kind:'path',key:'boat-b:hint',when:()=>screen==='play'&&s.status==='play',played:save.runs>0,delay:1800,bottom:()=>H-boatY+10,label:'Swipe the water'});

// Drawing uses a small sampled flow field. The same flow function moves the boat.
function ellipse(x,y,rx,ry,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();}
function line(path,color,width=1){g.beginPath();path.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.stroke();}
function poly(path,color){g.fillStyle=color;g.beginPath();path.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();}
function round(x,y,w,h,r,color){g.fillStyle=color;g.beginPath();g.roundRect(x,y,w,h,r);g.fill();}
function leaf(x,y,r,rotation=0){g.save();g.translate(x,y);g.rotate(rotation);g.shadowColor='#082e3f66';g.shadowBlur=9;g.shadowOffsetY=4;g.fillStyle='#b5aa62';g.beginPath();g.moveTo(0,-r);g.bezierCurveTo(r*1.2,-r*.3,r*.9,r*.6,0,r);g.bezierCurveTo(-r*.9,r*.4,-r,-r*.6,0,-r);g.fill();g.shadowBlur=0;g.shadowOffsetY=0;line([[0,-r*.7],[0,r*.7]],'#5f7a58',1.5);line([[0,0],[r*.45,-r*.2]],'#76885a',1);line([[0,r*.3],[-r*.4,0]],'#76885a',1);g.restore();}
function bug(x,y,kind,size=1){g.save();g.translate(x,y);g.scale(size,size);if(kind==='snail'){ellipse(2,5,13,4,'#d8d3a0');ellipse(-1,-2,9,9,'#c98f64');g.strokeStyle='#825b4a';g.lineWidth=2;g.beginPath();for(let i=0;i<38;i++){let a=i*.19,r=6-i*.14;const x=-1+Math.cos(a)*r,y=-2+Math.sin(a)*r;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();line([[10,4],[12,-5]],'#e6ddb4',2);ellipse(12,-6,2,2,'#263e3e');}else{ellipse(0,-7,4,4,'#2f4142');ellipse(0,0,8,10,'#e8866c');line([[0,-8],[0,9]],'#553f37',1.3);for(const [x,y]of[[-4,-3],[4,1],[-3,5]])ellipse(x,y,1.7,1.7,'#463d37');}g.restore();}
function boat(x,y,size=1){g.save();g.translate(x,y);g.rotate(Math.sin(clock*2.5)*.035+s.boat.vx*.004);g.scale(size*(1+wobble*.035),size*(1-wobble*.045));ellipse(0,20,31,10,'#082c3b55');g.shadowColor='#0a2e3b55';g.shadowBlur=14;g.shadowOffsetY=7;poly([[-32,4],[0,-37],[32,4],[19,21],[-19,21]],'#e6d0a3');g.shadowBlur=0;g.shadowOffsetY=0;poly([[-32,4],[0,-37],[0,10]],'#fff3d5');poly([[0,-37],[32,4],[0,10]],'#dcd1b1');poly([[-32,4],[0,10],[32,4],[19,21],[-19,21]],'#f0d7a1');line([[0,10],[0,21]],'#b1936a',1);if(s.boat.soak>35){g.globalAlpha=Math.min(.65,s.boat.soak*.007);poly([[-25,12],[0,16],[25,12],[19,21],[-19,21]],'#668c83');g.globalAlpha=1;}const aboard=s.passengers.filter(p=>p.collected);aboard.slice(0,2).forEach((p,i)=>bug(i?11:-10,5,p.kind,.52));g.restore();}
function drawWater(){
  const background=g.createLinearGradient(0,0,W,H);background.addColorStop(0,'#234b50');background.addColorStop(1,'#102f3c');g.fillStyle=background;g.fillRect(0,0,W,H);
  // Damp paving blocks and their pale mortar, kept outside the gutter.
  for(let row=-1;row<H/78+1;row++){const yy=((row*78+s.boat.y*scale*.35)% (H+156))-78;for(let side=0;side<2;side++){const xx=side?left+100*scale+12:left-110;round(xx,yy,98,68,8,row%2?'#385653':'#2c4b4c');line([[xx+8,yy+3],[xx+88,yy+3]],'#5b706527',2);}}
  const grad=g.createLinearGradient(left,0,left+100*scale,0);grad.addColorStop(0,'#387674');grad.addColorStop(.14,'#4d9790');grad.addColorStop(.5,'#3d8988');grad.addColorStop(.86,'#347d80');grad.addColorStop(1,'#265a68');
  g.fillStyle=grad;g.fillRect(left,0,100*scale,H);line([[left-4,0],[left-4,H]],'#859b7a',5);line([[left+100*scale+4,0],[left+100*scale+4,H]],'#6e8b77',5);line([[left+2,0],[left+2,H]],'#a3c9ab44',2);
  g.save();g.beginPath();g.rect(left,0,100*scale,H);g.clip();
  // Streamlines are integrated through the simulation's field, including the player's ripples.
  for(let i=0;i<15;i++){let x=3+i*6.7,y=s.boat.y+(boatY+70)/scale;g.beginPath();for(let j=0;j<64;j++){const f=flow(s,x,y);const px=X(x)+Math.sin(y*.09+i)*2,py=Y(y);j?g.lineTo(px,py):g.moveTo(px,py);x-=f.x*.5;y-=f.y*.5;}g.strokeStyle=i%3?'#b1e3cd16':'#c2f0d72e';g.lineWidth=i%3?1:1.6;g.stroke();}
  for(let i=0;i<74;i++){const xx=left+((i*71.19+Math.sin(clock+i)*5)%(100*scale));const yy=((i*113.37+clock*(18+i%5*4))%(H+50))-25;const p=world({clientX:xx,clientY:yy}),f=flow(s,p.x,p.y);line([[xx,yy],[xx-f.x*.12,yy+4+i%7]],i%5?'#c2eee733':'#e4f7dd77',i%5?1:2);}
  // Soft rain rings do not change rules or use random values.
  for(let i=0;i<8;i++){const t=(clock*.65+i*.37)%1,x=left+(12+(i*37)%77)*scale,y=((i*167+64)%(H-60));g.strokeStyle=`rgba(197,239,220,${(1-t)*.17})`;g.lineWidth=1;g.beginPath();g.ellipse(x,y,t*20,t*7,0,0,Math.PI*2);g.stroke();}
  const pondY=Y(LEVELS[s.level].duration*(LEVELS[s.level].speed||10));
  if(s.progress>.78){const py=pondY;g.fillStyle='#b3d5a333';g.fillRect(left,py-20,100*scale,48);for(let i=0;i<5;i++){ellipse(left+(10+i*20)*scale,py,13,7,'#93b779');ellipse(left+(10+i*20)*scale,py-2,4,2,'#dfc8a1');}}
  for(const h of s.hazards){const x=X(h.x),y=Y(h.y),r=h.r*scale;if(y<-80||y>H+80)continue;g.globalAlpha=h.hit?.4:1;g.save();g.translate(x,y);g.scale(1,.5);g.translate(-x,-y);if(h.kind==='leaf'){leaf(x,y,r,Math.sin(clock+h.y)*.15+h.y);}else if(h.kind==='drain'){ellipse(x,y,r+6,r*.65+6,'#377475');ellipse(x,y,r+2,r*.65+2,'#8c9b81');ellipse(x,y,r,r*.65,'#173e47');for(let j=-2;j<=2;j++)line([[x-r*.65,y+j*r*.2],[x+r*.65,y+j*r*.2]],'#678a81',3);g.strokeStyle='#d4e4bc66';g.lineWidth=1;g.beginPath();g.ellipse(x,y,r+7+Math.sin(clock*3)*3,r*.65+5,0,0,Math.PI*2);g.stroke();}else{const edge=h.x<50?left-10:left+100*scale+10;round(Math.min(edge,x),y-r*.6,Math.abs(x-edge),r*1.25,r*.4,'#d7ad89');ellipse(x,y,r,r*.8,'#e8c49b');for(let i=-1;i<=1;i++)ellipse(x+i*r*.44,y-r*.38,r*.3,r*.38,'#f0cfac');ellipse(x,y+r*.16,r*.38,r*.29,'#b87f71');}g.restore();g.globalAlpha=1;}
  for(const p of s.passengers){if(p.collected||p.passed)continue;const x=X(p.x),y=Y(p.y);if(y<-70||y>H+70)continue;ellipse(x,y+7,19,9,'#235c6677');g.strokeStyle='#f6dc9e';g.lineWidth=1.5;g.globalAlpha=.5+Math.sin(clock*3)*.2;g.beginPath();g.ellipse(x,y,23,23,0,0,Math.PI*2);g.stroke();g.globalAlpha=1;bug(x,y+Math.sin(clock*3+p.y)*2,p.kind,1.1);}
  for(const r of rings){const x=X(r.x),y=Y(r.y);g.globalAlpha=Math.max(0,1-r.age/1.2);if(r.kind==='pebble'){for(let i=0;i<3;i++){g.strokeStyle='#e1f5cf';g.lineWidth=2-i*.4;g.beginPath();g.ellipse(x,y,(r.age*36+i*8)*scale/2,(r.age*20+i*5)*scale/2,0,0,Math.PI*2);g.stroke();}ellipse(x,y,3*(1-r.age/1.2),2,'#a8b2a2');}else{line([[x,y],[X(r.x+r.dx),Y(r.y+r.dy)]],'#e7f6d3',3);}g.globalAlpha=1;}
  if(points.length>1)line(points.map(p=>[X(p.x),Y(p.y)]),'#fff4d9',3);
  for(let i=0;i<4;i++){g.strokeStyle=`rgba(216,241,208,${.22-i*.04})`;g.lineWidth=1.5;g.beginPath();g.ellipse(X(s.boat.x),boatY+18+i*10+Math.sin(clock*3)*2,18+i*5,5+i*2,0,0,Math.PI);g.stroke();}
  boat(X(s.boat.x),boatY,Math.min(1.25,scale/3.2));
  g.restore();
}
function draw(){g.setTransform(dpr,0,0,dpr,0,0);g.save();if(shake&&!reduced)g.translate(Math.sin(clock*71)*shake,Math.cos(clock*89)*shake*.5);drawWater();g.restore();for(const p of particles){g.globalAlpha=Math.max(0,p.life/p.max);ellipse(p.x,p.y,p.r,p.r*.6,p.color);}g.globalAlpha=1;
  // A vignette keeps HUD and bottom paper meter readable without a solid panel.
  const shade=g.createLinearGradient(0,0,0,H);shade.addColorStop(0,'#123940dc');shade.addColorStop(.22,'#12394000');shade.addColorStop(.78,'#12394000');shade.addColorStop(1,'#123940e8');g.fillStyle=shade;g.fillRect(0,0,W,H);
}
function events(){for(const e of s.events){const type=e.type;if(type==='hit'||type==='damage'){shake=reduced?0:7;burst(X(s.boat.x),boatY,'#d8ead0',18);snd.noise(.19,.14,550);snd.tone(150,.22,.08,'triangle',-60);toast('Watch the paper');}if(type==='collect'||type==='pickup'||type==='rescue'){burst(X(s.boat.x),boatY,'#ffdc8c',24);snd.tone(880,.3,.06,'triangle');snd.tone(1320,.2,.035);toast('Welcome aboard');}if(type==='win'||type==='won'){burst(X(s.boat.x),boatY,'#ffdd98',55);chord();}if(type==='lose'||type==='lost')chord(false);}s.events.length=0;}
function tick(now){const dt=Math.max(0,Math.min(.08,(now-last)/1000));last=now;if(screen!=='paused'){clock+=dt;rings.forEach(r=>r.age+=dt);rings=rings.filter(r=>r.age<1.2);particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=80*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);shake=Math.max(0,shake-dt*15);wobble=Math.max(0,wobble-dt*2);toastTime=Math.max(0,toastTime-dt);}if(screen==='play'){if(s.status==='play'){acc+=dt;while(acc>=DT){if(++keyTicks%12===0&&(keys.has('ArrowLeft')||keys.has('a')||keys.has('ArrowRight')||keys.has('d'))){const dx=keys.has('ArrowLeft')||keys.has('a')?-14:14;makeRipple({x:s.boat.x,y:s.boat.y+3},{x:s.boat.x+dx,y:s.boat.y+3});}step(s);events();acc-=DT;if(s.status!=='play'){finishDelay=.75;burst(X(s.boat.x),boatY,s.status==='won'?'#f6d59b':'#a8d8ce',s.status==='won'?60:22);chord(s.status==='won');break;}}}else{finishDelay-=dt;if(finishDelay<=0)finish();}$('dry').style.width=`${Math.max(0,1-s.boat.soak/100)*100}%`;$('dry').style.background=s.boat.soak>75?'#ed9d78':'#f3cf93';$('passengers').textContent=`${s.passengers.filter(p=>p.collected).length} aboard`;} $('toast').style.opacity=screen==='play'&&toastTime>0?'1':'0';draw();requestAnimationFrame(tick);}
// A detached snapshot for checks; no rule setters or fast-forward path.
window.boatState=()=>({screen,sim:JSON.parse(JSON.stringify(s)),layout:{left,scale,boatY},save:JSON.parse(JSON.stringify(save)),audio:{state:snd.ctx?.state||null,enabled:save.sound},actions:{...actions}});
show('menu');requestAnimationFrame(tick);
