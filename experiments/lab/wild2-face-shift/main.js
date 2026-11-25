import {create, step, DT, LEVELS, starsFor} from './sim.js';
import {readJson, writeJson} from '../../kit/save.js';
import {sound} from '../../kit/audio.js';
import {onLeave, isPauseKey} from '../../kit/pause.js';
import {screens} from '../../kit/screens.js';
import {stick} from '../../kit/stick.js';
import {hint} from '../../kit/hint.js';
import {noZoom} from '../../kit/zoom.js';
import {lab} from '../../kit/lab.js';
noZoom();
const $=id=>document.getElementById(id), canvas=$('c'), g=canvas.getContext('2d');
const KEY='wild2-face-shift:save', old=readJson(KEY), save={v:1,best:0,runs:0,stars:[0,0,0,0],sound:true};
if(old && typeof old==='object') {
 for(const k of ['best','runs']) if(Number.isFinite(old[k])&&old[k]>=0)save[k]=old[k];
 if(typeof old.sound==='boolean')save.sound=old.sound;
 if(Array.isArray(old.stars))save.stars=save.stars.map((v,i)=>Math.min(3,Math.max(0,Math.floor(Number(old.stars[i])||0))));
}
const snd=sound({on:()=>save.sound}), store=()=>writeJson(KEY,save);
let mode='menu', s=null, allShots=[], total=0, seed=17, cleared=0, input={x:0,y:0,active:false}, keys=new Set();
let W=0,H=0,top=0,bottom=0,unit=1,cx=0,cy=0,clock=0,last=performance.now(),acc=0,flash=0,shake=0,particles=[],visual={x:0,y:0},lastTone=0;
const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
function layout(){W=innerWidth;H=innerHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=W*d;canvas.height=H*d;const css=getComputedStyle($('probe'));top=parseFloat(css.paddingTop)||0;bottom=parseFloat(css.paddingBottom)||0;unit=Math.min((W-40)/360,(H-top-bottom-115)/510,1.25);cx=W/2;cy=top+88+230*unit;g.setTransform(d,0,0,d,0,0);}
addEventListener('resize',layout);layout();
const pad=stick(canvas,{when:()=>mode==='play'&&!pad.touch,reach:85,leash:130,dead:0});
canvas.addEventListener('lostpointercapture',e=>{if(pad.touch?.id===e.pointerId)pad.drop();});
const show=screens(['menu','paused','end'],name=>{mode=name;$('pause').style.display=name==='play'?'block':'none';});
const tone=(f=420,d=.09,v=.045,slide=0)=>snd.tone(f,d,v,'triangle',slide);
const tap=()=>{snd.unlock();tone();};
function resetInput(){pad.drop();keys.clear();input={x:0,y:0,active:false};}
// Play recording for the game lab (kit/lab.js): one run for each go through the four rounds, from Play to the contact sheet.
const rec=lab('wild2-face-shift');let runOpen=false;
function runEnd(outcome){if(!runOpen)return;runOpen=false;rec.end(outcome,{rounds:cleared,round:s?s.level+1:null,score:total,photos:allShots.length,best:save.best,stars:save.stars.reduce((a,n)=>a+n,0)});}
function start(){runEnd('quit');tap();snd.release();resetInput();allShots=[];total=0;cleared=0;const requestedSeed=new URLSearchParams(location.search).get('seed');seed=requestedSeed!==null&&requestedSeed.trim()!==''&&Number.isFinite(Number(requestedSeed))?Number(requestedSeed):17;s=create(seed,0);visual={x:0,y:0};flash=0;shake=0;particles=[];acc=0;show('play');runOpen=true;rec.start({seed});}
function pause(){if(mode!=='play')return;resetInput();if(s.phase==='play')s={...s,held:0};snd.hold();show('paused');}
function resume(){tap();snd.release();resetInput();acc=0;show('play');}
function end(won){allShots.push(...s.shots);total+=s.score;save.runs++;save.best=Math.max(save.best,total);store();runEnd(won?'won':'lost');resetInput();show('end');$('end-title').textContent=won?'Picture perfect.':'One more take?';$('end-score').textContent=String(total);$('stats').textContent=`${allShots.length} photos · Best ${save.best}`;$('stars').textContent=save.stars.map(n=>'★'.repeat(n)+'☆'.repeat(3-n)).join('  ');drawAlbum();if(won){burst(cx,cy,65);[523,659,784,1047].forEach((f,i)=>setTimeout(()=>{if(mode==='end')tone(f,.28,.055);},i*100));}else tone(180,.24,.05,-60);}
function success(){cleared++;rec.event('round-cleared',{round:s.level+1,stars:starsFor(s)});save.stars[s.level]=Math.max(save.stars[s.level],starsFor(s));store();if(s.level===LEVELS.length-1){end(true);return;}allShots.push(...s.shots);total+=s.score;s=create(seed,s.level+1);visual={x:0,y:0};tone(660,.2,.06,220);}
$('play').onclick=start;$('again').onclick=start;$('restart').onclick=start;$('pause').onclick=pause;$('resume').onclick=resume;
for(const id of ['toMenu','endMenu'])$(id).onclick=()=>{runEnd('quit');snd.release();tap();resetInput();show('menu');};
$('sound').textContent=`Sound: ${save.sound?'on':'off'}`;$('sound').onclick=()=>{save.sound=!save.sound;store();$('sound').textContent=`Sound: ${save.sound?'on':'off'}`;if(save.sound)tap();};
// The recording notice is on the menu card, which the player sees before Play; its switch is on the pause card.
rec.notice($('menu').firstElementChild);rec.toggle($('paused').firstElementChild);
onLeave(pause);
canvas.addEventListener('pointerdown',()=>{if(mode==='play'){snd.unlock();tone(240,.12,.05,130);}});
canvas.addEventListener('pointerup',()=>{if(mode==='play')tone(280,.09,.035,-80);});
const help=hint(canvas,{kind:'stick',key:'wild2-face-shift:hint',when:()=>mode==='play'&&s?.phase==='play',played:save.runs>0,delay:1600,bottom:()=>Math.max(95,H-(cy+150*unit)),reach:55,label:'Drag to stretch the face'});
addEventListener('keydown',e=>{if(isPauseKey(e)){e.preventDefault();if(mode==='play')pause();else if(mode==='paused')resume();return;}if(mode==='play'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)){e.preventDefault();if(mode==='play'){keys.add(e.key);snd.unlock();help.done();}else if(e.key===' '&&mode==='menu')start();}});
addEventListener('keyup',e=>keys.delete(e.key));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function tick(){if(mode!=='play')return;const pv=pad.vector();if(pad.touch)input={x:clamp(pv.x,-1,1),y:clamp(pv.y,-1,1),active:true};else if(keys.size){input.x=clamp(input.x+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*DT*.8,-1,1);input.y=clamp(input.y+((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*DT*.8,-1,1);input.active=true;}else input.active=false;
 const before=s;s=step(s,input,DT);if((pad.touch||keys.size)&&clock-lastTone>.14&&Math.hypot(s.x-before.x,s.y-before.y)>.004){tone(220+(s.x+1)*120+(s.y+1)*60,.09,.022);lastTone=clock;}
 if(s.shots.length>before.shots.length){flash=1;shake=calm?0:5;burst(cx,cy,26);snd.noise(.065,.07,2200);tone(880,.18,.06);}
 if(s.phase==='won')success();else if(s.phase==='lost')end(false);
}
function rounded(q,x,y,w,h,r,fill){q.fillStyle=fill;q.beginPath();q.roundRect(x,y,w,h,r);q.fill();}
function ellipse(q,x,y,rx,ry,fill){q.fillStyle=fill;q.beginPath();q.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);q.fill();}
function text(q,str,x,y,size=16,color='#fff6e4',align='center'){q.fillStyle=color;q.font=`800 ${size}px ui-rounded, Trebuchet MS, sans-serif`;q.textAlign=align;q.textBaseline='middle';q.fillText(str,x,y);}
const colors=['#f68e7f','#e9b4f2','#b9db8d','#f8c96d'];
function face(q,x,y,r,a,b,color=colors[0],ghost=false){q.save();q.translate(x,y);q.scale(r/100,r/100);const wide=1+a*.26,tall=1-a*.16;q.scale(wide,tall);if(ghost)q.globalAlpha=.18;
 q.shadowColor='#0b2b3430';q.shadowBlur=16;q.shadowOffsetY=8;
 q.beginPath();q.moveTo(-77,-43);q.bezierCurveTo(-75,-107,68,-110,78,-46);q.bezierCurveTo(113,10,82,89,20,92);q.bezierCurveTo(-33,108,-110,54,-77,-43);q.fillStyle=color;q.fill();q.shadowColor='transparent';
 const grad=q.createRadialGradient(-30,-48,1,0,0,105);grad.addColorStop(0,'#fff8');grad.addColorStop(.55,'#fff0');grad.addColorStop(1,'#932a371b');q.fillStyle=grad;q.fill();
 ellipse(q,-47,24,16,9,'#db5b6738');ellipse(q,47,24,16,9,'#db5b6738');
 for(const side of [-1,1]){const ex=side*32,ey=-19+b*9,eh=15+b*6;ellipse(q,ex,ey,18,eh,'#fffbef');ellipse(q,ex+a*5,ey+b*2,6.5,9+b*3,'#283641');ellipse(q,ex+a*5-2,ey-3,2.4,3,'#fff');q.strokeStyle='#713d48';q.lineWidth=5;q.lineCap='round';q.beginPath();q.moveTo(ex-12,-44-b*12);q.quadraticCurveTo(ex,-51-b*13,ex+12,-44-b*12);q.stroke();}
 const mh=8+(b+1)*13,mw=25+(a+1)*4;ellipse(q,a*5,43,mw,mh,'#633b4b');q.save();q.beginPath();q.ellipse(a*5,43,mw,mh,0,0,Math.PI*2);q.clip();ellipse(q,a*5+4,43+mh,24,13,'#f37b85');rounded(q,a*5-17,43-mh-2,34,9,3,'#fff7e7');q.restore();ellipse(q,0,11,6,4,'#d66c6a');q.restore();}
function photo(q,x,y,w,h,target,color,rotation=0){q.save();q.translate(x,y);q.rotate(rotation);q.shadowColor='#081f3940';q.shadowBlur=16;q.shadowOffsetY=8;rounded(q,-w/2,-h/2,w,h,5,'#fff9eb');q.shadowColor='transparent';rounded(q,-w/2+8,-h/2+8,w-16,h-33,3,'#d5e4d4');face(q,0,-9,Math.min(w*.40,(h-35)*.43),target.x,target.y,color);q.strokeStyle='#cabfa9';q.lineWidth=2;q.beginPath();q.moveTo(-w*.2,h/2-13);q.lineTo(w*.2,h/2-13);q.stroke();q.restore();}
function burst(x,y,n){if(calm)return;for(let i=0;i<n;i++){const a=i*2.399;particles.push({x,y,vx:Math.cos(a)*(60+i*3),vy:Math.sin(a)*(60+i*3)-80,life:1,rot:a,color:['#d9f681','#f68e7f','#f8eedb'][i%3]});}}
// Reapply backing scale each frame; initial WebKit painting can lose it.
function draw(){g.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);g.clearRect(0,0,W,H);g.fillStyle='#173a42';g.fillRect(0,0,W,H);const bg=g.createRadialGradient(cx,H*.4,20,cx,H*.4,H*.7);bg.addColorStop(0,'#2e5960');bg.addColorStop(1,'#102e36');g.fillStyle=bg;g.fillRect(0,0,W,H);
 g.strokeStyle='#ffffff05';g.lineWidth=1;for(let x=0;x<W;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}for(let y=0;y<H;y+=32){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
 if(mode==='play'||mode==='paused'){const config=LEVELS[s.level],target=s.targets[Math.min(s.index,s.targets.length-1)];text(g,`ROUND ${s.level+1} / 4`,cx-145*unit,top+36,14,'#bcd4cf','left');text(g,`${allShots.length+s.shots.length} photos`,cx-145*unit,top+58,14,'#8daeb0','left');
 const time=clamp(1-s.elapsed/config.limit,0,1);rounded(g,cx-145*unit,top+76,290*unit,4,2,'#ffffff15');rounded(g,cx-145*unit,top+76,290*unit*time,4,2,time<.2?'#f68e7f':'#d9f681');
 const py=top+88+68*unit;photo(g,cx,py,110*unit,130*unit,target,colors[s.level],-.045);text(g,'COPY',cx+89*unit,py,14,'#c2d8d1');
 g.save();g.translate(cx,cy+75*unit);g.scale(unit,unit);if(shake)g.translate(Math.sin(clock*80)*shake,Math.cos(clock*70)*shake);ellipse(g,0,125,108,13,'#061d2830');
 const err=Math.max(Math.abs(s.x-target.x),Math.abs(s.y-target.y));const near=err<=config.tolerance;const meter=clamp(Math.min(s.held/config.hold,s.age/3),0,1);g.strokeStyle=near?'#d9f681':'#ffffff17';g.lineWidth=3;g.beginPath();g.arc(0,0,137,0,Math.PI*2);g.stroke();if(meter){g.lineWidth=7;g.strokeStyle='#d9f681';g.beginPath();g.arc(0,0,137,-Math.PI/2,-Math.PI/2+Math.PI*2*meter);g.stroke();}
 visual.x+=(s.x-visual.x)*(calm?1:.25);visual.y+=(s.y-visual.y)*(calm?1:.25);face(g,0,0,112,visual.x,visual.y,colors[s.level]);if(s.level===0&&s.index===0&&!input.active&&s.age<5){g.strokeStyle='#fff6e477';g.lineWidth=3;for(const side of [-1,1]){g.beginPath();g.moveTo(side*136,-6);g.lineTo(side*146,0);g.lineTo(side*136,6);g.stroke();}}
 g.restore();const under=cy+237*unit;text(g,near?(s.phase==='photo'?'GOT IT!':'HOLD IT…'):'',cx,under,16,'#d9f681');
 for(let i=0;i<config.count;i++){const dx=cx+(i-(config.count-1)/2)*23;ellipse(g,dx,under+32,4.5,4.5,i<s.shots.length?'#d9f681':i===s.index?'#fff6e4':'#ffffff22');}
 if(pad.touch){const p=pad.touch;g.strokeStyle='#fff5';g.lineWidth=2;g.beginPath();g.arc(p.ox,p.oy,30,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(p.ox,p.oy);g.lineTo(p.x,p.y);g.stroke();ellipse(g,p.x,p.y,12,12,'#fff8');}
 }
 for(const p of particles){g.save();g.globalAlpha=p.life;g.translate(p.x,p.y);g.rotate(p.rot+clock*3);rounded(g,-3,-5,6,10,2,p.color);g.restore();}if(flash>0){g.fillStyle=`rgba(255,249,224,${flash*.6})`;g.fillRect(0,0,W,H);}
}
function drawHero(){const c=$('hero'),q=c.getContext('2d');c.width=600;c.height=320;photo(q,120,165,150,190,{x:-.8,y:.6},colors[2],-.17);photo(q,465,166,150,190,{x:.7,y:-.7},colors[1],.16);photo(q,300,150,170,218,{x:.15,y:.8},colors[0],-.035);}
function drawAlbum(){const c=$('album'),q=c.getContext('2d');c.width=640;c.height=280;const photos=[...new Map(allShots.map(p=>[p.level,p])).values()];if(!photos.length){rounded(q,215,78,210,135,24,'#d6ddce');rounded(q,250,53,72,40,10,'#d6ddce');ellipse(q,320,146,48,48,'#29474b');ellipse(q,320,146,31,31,'#82a7a3');ellipse(q,310,135,10,10,'#e8efdf');rounded(q,375,96,26,13,4,'#fff9eb');}photos.forEach((p,i)=>photo(q,105+i*143,139,137,180,p,colors[p.level],(i%2?1:-1)*.07));}
// Paint after the first surface is ready, including a fresh WebKit context.
requestAnimationFrame(drawHero);
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(mode==='play'){clock+=dt;acc+=dt;while(acc>=DT){tick();acc-=DT;}}flash=Math.max(0,flash-dt*3.5);shake=Math.max(0,shake-dt*20);particles=particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=190*dt;return p.life>0;});draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
// Read-only snapshots for browser assertions; no state setters or shortcuts.
window.faceShiftState=()=>({mode,state:s?structuredClone(s):null,score:total,cleared,shots:allShots.length,reach:85,center:{x:cx,y:cy+75*unit},dragging:!!pad.touch,effects:{flash,shake,particles:particles.length},hint:help.shown,audio:!!snd.ctx,saved:structuredClone(save)});
