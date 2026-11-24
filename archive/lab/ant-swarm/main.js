import { create, step, paint, lift, setAntLimit, painterPath, DT, LEVELS } from './sim.js';
import { Meadow } from './render.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
import { noZoom } from '../../kit/zoom.js';
noZoom();
const $=id=>document.getElementById(id), query=new URLSearchParams(location.search), KEY='ant-swarm:save';
const raw=readJson(KEY,{}), finite=n=>Number.isFinite(n)&&n>=0;
const save={v:1,best:finite(raw?.best)?raw.best:0,level:Number.isInteger(raw?.level)?Math.max(0,Math.min(8,raw.level)):0,runs:finite(raw?.runs)?raw.runs:0,stars:Array.isArray(raw?.stars)?raw.stars.slice(0,8).map(n=>Math.max(0,Math.min(3,Number(n)||0))):[],sound:raw?.sound!==false,look:['moss','dusk','clay'].includes(raw?.look)?raw.look:'moss',daily:raw?.daily&&typeof raw.daily==='object'?raw.daily:{},name:typeof raw?.name==='string'?raw.name:'',sharing:raw?.sharing===true&&raw?.removePending!==true,removePending:raw?.removePending===true,id:typeof raw?.id==='string'?raw.id:''};
const wasPlayed=save.runs>0;
const store=()=>writeJson(KEY,save), today=new Date().toISOString().slice(0,10), dailySeed=Number(today.replaceAll('-',''));
const snd=sound({on:()=>save.sound});
const canvas=$('c'),ctx=canvas.getContext('2d'), renderer=new Meadow(canvas,{fallback:query.get('renderer')==='canvas',look:save.look});
let W=0,H=0,dpr=1,view={x:0,y:0,w:0,h:0,scale:1};
function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(1.5,devicePixelRatio||1);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const cs=getComputedStyle($('probe')),top=(parseFloat(cs.paddingTop)||0)+92,bottom=(parseFloat(cs.paddingBottom)||0)+65;const scale=Math.min((W-28)/100,(H-top-bottom)/150,4.6);view={x:(W-100*scale)/2,y:top+(H-top-bottom-150*scale)/2,w:100*scale,h:150*scale,scale};}
addEventListener('resize',resize);resize();
let screen='menu',level=0,endless=false,seed=dailySeed,sim=create({seed,ants:600}),ambient=create({seed:42,ants:600}),acc=0,last=0;
let particles=[],rings=[],pointer=null,keys=new Set(),keyPoint={x:50,y:125},paintCount=0,antLimit=900,celebrate=0,shake=0,soundAt=0,frameTimes=[],cpuTimes=[],adapt=0,slowFrames=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const show=screens(['menu','paused','end','board'],name=>{screen=name;const playing=name==='play';$('pause').style.display=playing?'block':'none';$('hud').style.display=playing?'block':'none';$('cue').style.display=playing?'block':'none';});
function updateMenu(){$('sound').textContent=`Sound: ${save.sound?'on':'off'}`;$('daily').style.display=save.level>=8?'inline-block':'none';for(const b of document.querySelectorAll('[data-look]'))b.setAttribute('aria-pressed',String(b.dataset.look===save.look));}
function tone(f=440,d=.07,v=.035,type='sine',slide=0){snd.tone(f,d,v,type,slide);}
function begin({next=false,daily=false,retry=false}={}){
  const initialAnts=next?Math.max(600,Math.min(1500,sim.population)):retry?(sim.initialAnts||600):600;
  snd.unlock();snd.release();
  if(daily){endless=true;level=7;seed=dailySeed;}
  else if(!next&&!retry){endless=false;level=query.has('level')?Math.max(0,Math.min(7,Number(query.get('level'))||0)):Math.min(7,save.level);seed=query.has('seed')?Number(query.get('seed'))>>>0:dailySeed;}
  if(next){if(level>=7){endless=true;seed=dailySeed;}else level++;}
  sim=create({seed:seed+(!endless?level*997:0),level,ants:endless?600:initialAnts,endless});setAntLimit(sim,antLimit);pointer=null;keys.clear();keyPoint={...sim.home};paintCount=0;particles=[];rings=[];acc=0;celebrate=0;shake=0;soundAt=-1;frameTimes=[];cpuTimes=[];adapt=0;save.runs++;store();show('play');hud();tone(392,.18,.05,'triangle',196);
}
function stopInput(){pointer=null;keys.clear();lift(sim);}
function pause(){if(screen!=='play')return;stopInput();show('paused');snd.hold();}
function resume(){if(screen!=='paused')return;snd.release();acc=0;show('play');}
onLeave(pause);
function toMenu(){stopInput();show('menu');snd.release();updateMenu();}
$('play').onclick=()=>begin();$('daily').onclick=()=>begin({daily:true});$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=()=>begin({retry:true});$('again').onclick=()=>begin({retry:true});$('next').onclick=()=>begin({next:true});$('menuBack').onclick=toMenu;$('endMenu').onclick=toMenu;
$('sound').onclick=()=>{save.sound=!save.sound;if(save.sound)snd.unlock();store();updateMenu();};
for(const b of document.querySelectorAll('[data-look]'))b.onclick=()=>{save.look=b.dataset.look;renderer.setLook(save.look);store();updateMenu();};
for(const b of document.querySelectorAll('button'))b.addEventListener('click',()=>tone(330,.05,.025,'triangle',90));
function world(e){return{x:Math.max(1,Math.min(99,(e.clientX-view.x)/view.scale)),y:Math.max(1,Math.min(149,(e.clientY-view.y)/view.scale))};}
function drawScent(p,previous=p){paint(sim,p.x,p.y,previous.x,previous.y);paintCount++;rings.push({x:p.x,y:p.y,life:.42});if(rings.length>22)rings.shift();if(sim.time-soundAt>.09){tone(270+Math.max(0,150-p.y)*2,.07,.017,'sine',35);soundAt=sim.time;}if(!reduced&&paintCount%3===0)burst(p.x,p.y,'#edc775',2);}
canvas.addEventListener('pointerdown',e=>{if(screen!=='play'||pointer)return;e.preventDefault();const p=world(e);pointer={...p,id:e.pointerId,down:true};try{canvas.setPointerCapture(e.pointerId);}catch{}snd.unlock();drawScent(p);});
canvas.addEventListener('pointermove',e=>{if(screen!=='play'||!pointer||e.pointerId!==pointer.id)return;e.preventDefault();const p=world(e);drawScent(p,pointer);pointer={...p,id:e.pointerId,down:true};});
function up(e){if(pointer&&pointer.id===e.pointerId){pointer=null;lift(sim);tone(440,.05,.02);}}
canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',up);
addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(isPauseKey(e)){e.preventDefault();if(screen==='play')pause();else if(screen==='paused')resume();return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)){e.preventDefault();if(screen==='play'){keys.add(e.key);snd.unlock();}}if(e.key==='Enter'){if(screen==='menu')begin();else if(screen==='end')begin({retry:true});}});
addEventListener('keyup',e=>{keys.delete(e.key);if(e.key===' '&&!pointer)lift(sim);});
hint(canvas,{kind:'path',key:'ant-swarm:hint',when:()=>screen==='play',played:wasPlayed,bottom:95,label:'Draw a trail'});
function burst(x,y,color,n){if(reduced)n=Math.ceil(n/4);for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=4+Math.random()*10;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.5+Math.random()*.8,max:1.3,color,size:.45+Math.random()*.65});}if(particles.length>180)particles.splice(0,particles.length-180);}
function finish(){stopInput();const won=sim.status==='won',stars=won?(sim.remaining>sim.duration*.38?3:sim.remaining>sim.duration*.16?2:1):0;save.best=Math.max(save.best,sim.delivered);if(won){save.level=Math.max(save.level,Math.min(8,level+1));save.stars[level]=Math.max(save.stars[level]||0,stars);}if(endless){save.daily[today]=Math.max(Number(save.daily[today])||0,sim.delivered);save.daily=Object.fromEntries(Object.entries(save.daily).sort(([a],[b])=>b.localeCompare(a)).slice(0,30));}store();$('endLabel').textContent=endless?'Daily meadow':`Meadow ${level+1} of 8`;$('endTitle').textContent=won?'The colony grows':'A new trail awaits';$('stars').textContent=won?'✦ '.repeat(stars)+'· '.repeat(3-stars):'❋';$('score').textContent=sim.delivered;$('endLine').textContent=won?'Food brought home.':`Food brought home · goal ${sim.goal}`;$('best').textContent=`Device best ${save.best}`;$('next').style.display=won?'inline-block':'none';$('next').textContent=level===7?'Daily meadow':'Next meadow';$('again').textContent=won?'Play again':'Try again';show('end');celebrate=won?3:0;if(won){burst(sim.home.x,sim.home.y,'#f4c966',65);[0,4,7,12].forEach((v,i)=>setTimeout(()=>tone(392*2**(v/12),.35,.04,'triangle'),i*90));}else tone(220,.3,.04,'triangle',-60);if(save.sharing)sendBest();}
function drain(){let deliveries=0;for(const e of sim.events){if(e.type==='delivery')deliveries++;else if(e.type==='beetle'||e.type==='web'){burst(e.x,e.y,'#e9d0a0',30);shake=reduced?0:1.5;tone(e.type==='beetle'?130:620,.18,.07,'triangle',200);}else if(e.type==='wave'){burst(e.x,e.y,'#b5e1bd',30);tone(784,.24,.05);}}
if(deliveries){burst(sim.home.x,sim.home.y,'#d9bd74',Math.min(6,deliveries));if(sim.time-soundAt>.12){tone(500+(sim.delivered%7)*32,.08,.025,'triangle');soundAt=sim.time;}}sim.events.length=0;}
function hud(){const cfg=LEVELS[level];$('levelLabel').textContent=endless?`Daily meadow · ${sim.wave+1}`:`${level+1} / 8 · ${cfg.title}`;$('progress').textContent=`${sim.delivered} / ${sim.goal}`;$('fill').style.width=`${Math.min(100,sim.delivered/sim.goal*100)}%`;
const message=sim.bird?.warning?'Shadow coming · lift your finger':sim.bird?.active?'Lift your finger. Let them hide.':cfg.cue;$('cue').textContent=message;const small=document.createElement('b');small.textContent=`${sim.count} ants · ${Math.ceil(sim.remaining)}s`;$('cue').append(small);}
function keyboardTick(){if(!keys.size)return;const old={...keyPoint},v=30*DT;keyPoint.x=Math.max(2,Math.min(98,keyPoint.x+v*((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))));keyPoint.y=Math.max(2,Math.min(148,keyPoint.y+v*((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))));if(keys.has(' '))drawScent(keyPoint,old);}
function stats(){const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,a=[...frameTimes].sort((x,y)=>x-y);return{mean:mean(frameTimes),p95:a[Math.floor(a.length*.95)]||0,cpuMean:mean(cpuTimes)};}
function frame(t){const cpuStart=performance.now(),rawElapsed=last?(t-last)/1000:0,elapsed=Math.min(.1,rawElapsed);last=t;
if(screen==='play'){if(elapsed>0){frameTimes.push(rawElapsed*1000);if(frameTimes.length>180)frameTimes.shift();}acc+=elapsed;let ticks=0;while(acc>=DT&&ticks++<4&&sim.status==='play'){keyboardTick();step(sim);drain();acc-=DT;}if(ticks>=4)acc=0;if(sim.status!=='play')finish();hud();}
else if(screen==='menu'){acc+=elapsed;while(acc>=DT){if(ambient.status!=='play')ambient=create({seed:42,ants:600});if(ambient.tick%75===0){const route=painterPath(ambient);for(let i=1;i<route.length;i++)paint(ambient,route[i].x,route[i].y,route[i-1].x,route[i-1].y);lift(ambient);}step(ambient);ambient.events.length=0;acc-=DT;}}
for(const p of particles){p.life-=elapsed;p.x+=p.vx*elapsed;p.y+=p.vy*elapsed;p.vx*=.98;p.vy*=.98;}particles=particles.filter(p=>p.life>0);for(const r of rings)r.life-=elapsed;rings=rings.filter(r=>r.life>0);celebrate=Math.max(0,celebrate-elapsed);shake*=.85;
ctx.setTransform(dpr,0,0,dpr,0,0);renderer.draw(screen==='menu'?ambient:sim,view,{time:t/1000,particles,pointer:pointer||((keys.size&&screen==='play')?{...keyPoint,down:keys.has(' ')}:null),celebrate,shake});
ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);for(const r of rings){ctx.strokeStyle=`rgba(246,208,112,${r.life*.65})`;ctx.lineWidth=.35;ctx.beginPath();ctx.arc(r.x,r.y,1+(1-r.life/.42)*2,0,Math.PI*2);ctx.stroke();}ctx.restore();
const cpu=performance.now()-cpuStart;if(renderer.kind==='webgl2'){slowFrames=cpu>35?slowFrames+1:Math.max(0,slowFrames-1);if(slowFrames>=6){renderer.kind='canvas2d';slowFrames=0;frameTimes=[];cpuTimes=[];}}
if(screen==='play'){cpuTimes.push(cpu);if(cpuTimes.length>180)cpuTimes.shift();if(renderer.kind==='webgl2'&&frameTimes.length>=30){const renderBudget=stats();if(renderBudget.mean>22&&renderBudget.cpuMean>8){renderer.kind='canvas2d';frameTimes=[];cpuTimes=[];}}if(++adapt>=120){const measured=stats();let target=antLimit;if(measured.cpuMean>14||measured.mean>26)target=Math.max(300,antLimit-180);else if(measured.cpuMean<7&&measured.mean<20)target=Math.min(1500,antLimit+120);if(target!==antLimit){antLimit=target;setAntLimit(sim,target);}adapt=0;}}
requestAnimationFrame(frame);}
// Only the board performs network I/O. Reading never creates an identity; sharing is explicit and reversible.
const BOARD='/lab-api/board/ant-swarm';let boardRows=null,boardWaiting=false,boardMessage='';
const cleanName=v=>String(v??'').replace(/[^\p{L}\p{N} _.-]/gu,'').trim().slice(0,16);
async function callBoard(body){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),4000);try{const res=await fetch(BOARD,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:abort.signal}:{signal:abort.signal});if(!res.ok)return null;const out=await res.json();if(!Array.isArray(out?.rows))return null;return out.rows.filter(r=>r&&typeof r.n==='string'&&Number.isFinite(r.s)&&r.s>0).slice(0,20).map(r=>({n:cleanName(r.n),s:Math.floor(r.s)}));}catch{return null;}finally{clearTimeout(timer);}}
function boardShow(){$('deviceBest').textContent=`Device best ${save.best}`;$('share').textContent=save.removePending?'Retry removal':save.sharing?'Stop sharing':'Share my best';$('share').hidden=boardRows===null;$('share').disabled=boardWaiting;$('name').hidden=boardRows===null;$('boardStatus').textContent=boardWaiting?'Finding other colonies…':boardMessage?boardMessage:boardRows===null?'Board unavailable. Your score is safe here.':save.sharing?'Your best is shared.':'Your score stays here until you share.';$('rows').replaceChildren();const rows=boardRows??(save.best?[{n:'This device',s:save.best}]:[]);for(const [i,row]of rows.entries()){const li=document.createElement('li'),n=document.createElement('span'),s=document.createElement('b');n.textContent=`${i+1}. ${row.n||'Colony'}`;s.textContent=row.s;li.append(n,s);$('rows').append(li);}if(document.activeElement!==$('name'))$('name').value=save.name;}
async function sendBest(){if(!save.sharing||!save.id||!save.name||save.best<=0)return false;const rows=await callBoard({id:save.id,n:save.name,s:Math.min(1000000,Math.floor(save.best))});if(rows){boardRows=rows;boardMessage='';}else boardMessage='Score update not sent. Your earlier row remains.';if(screen==='board')boardShow();return rows!==null;}
$('boardOpen').onclick=async()=>{show('board');boardWaiting=true;boardMessage='';boardRows=null;boardShow();boardRows=await callBoard();boardWaiting=false;if(screen==='board')boardShow();};$('boardBack').onclick=toMenu;
$('name').onchange=()=>{save.name=cleanName($('name').value);$('name').value=save.name;store();};
$('share').onclick=async()=>{
 if(boardWaiting)return;
 if(save.sharing||save.removePending){const id=save.id;save.sharing=false;save.removePending=true;store();boardWaiting=true;boardMessage='';boardShow();const rows=await callBoard({id,remove:true});if(rows){boardRows=rows;save.removePending=false;save.id='';store();boardMessage='Your shared row was removed.';}else boardMessage='Removal not sent. Tap Retry removal when connected.';boardWaiting=false;boardShow();return;}
 save.name=cleanName($('name').value);if(!save.name){$('boardStatus').textContent='Give your colony a name first.';$('name').focus();return;}
 if(save.best<=0){$('boardStatus').textContent='Bring some food home first.';return;}
 save.id=save.id||crypto.randomUUID();store();boardWaiting=true;boardMessage='';boardShow();const rows=await callBoard({id:save.id,n:save.name,s:Math.min(1000000,Math.floor(save.best))});if(rows){boardRows=rows;save.sharing=true;boardMessage='';store();}else boardMessage='Score not sent. Tap Share to retry.';boardWaiting=false;boardShow();
};
window.swarmState=()=>({screen,time:sim.time,level,seed:sim.seed,endless,status:sim.status,delivered:sim.delivered,goal:sim.goal,count:sim.count,home:{...sim.home},population:sim.population,initialAnts:sim.initialAnts,food:{...sim.food[0]},path:painterPath(sim),view:{...view},frames:stats(),renderer:renderer.kind,paintCount,best:save.best,dailySeed,save:{...save},antLimit});
updateMenu();requestAnimationFrame(frame);
