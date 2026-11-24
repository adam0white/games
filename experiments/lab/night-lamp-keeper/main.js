import { create, step, route, dailySeed, LEVELS } from './sim.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';

noZoom();
const $ = id => document.getElementById(id), query = new URLSearchParams(location.search);
const count = Array.isArray(LEVELS) ? LEVELS.length : LEVELS;
const KEY = 'night-lamp-keeper:save', old = readJson(KEY, null);
const saved = {v:1, unlocked:1, sound:true, played:false, daily:null};
if (old && typeof old === 'object') {
  if (Number.isInteger(old.unlocked)) saved.unlocked = Math.max(1, Math.min(count + 1, old.unlocked));
  if (typeof old.sound === 'boolean') saved.sound = old.sound;
  if (typeof old.played === 'boolean') saved.played = old.played;
  if (old.daily && /^\d{4}-\d\d-\d\d$/.test(old.daily.day) && Number.isFinite(old.daily.score) && old.daily.score >= 0) saved.daily = {day:old.daily.day, score:old.daily.score};
}
let saveFailed=false;
const store = () => {saveFailed=!writeJson(KEY,saved);return !saveFailed;};
const date = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const snd = sound({on:() => saved.sound});
const cv = $('c'), ctx = cv.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const palette = query.get('look') === 'rose' ? {sky:'#55445e',horizon:'#e99d91',hill:'#835c72',hill2:'#a2717c',ground:'#b47d80',path:'#ddaaa0',roof:'#8f4e5b',lamp:'#ffe1aa',ink:'#523e4c'} : {sky:'#3c4058',horizon:'#e7a66f',hill:'#786176',hill2:'#a47679',ground:'#b58778',path:'#dfb79b',roof:'#95574a',lamp:'#ffe3a0',ink:'#554550'};
let W, H, dpr, scale, ox, oy;
function layout(){ dpr=Math.min(devicePixelRatio||1,2); W=innerWidth; H=innerHeight; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); const safe=parseFloat(getComputedStyle($('probe')).paddingTop)||0; scale=Math.min((W-20)/100,(H-safe-108)/150); ox=(W-100*scale)/2; oy=safe+68+(H-safe-88-150*scale)/2; }
addEventListener('resize',layout); layout();
let screen='menu', s=null, current=1, daily=null, pointer=null, draft=[], draftStart=null, touched=false, last=0, endAt=0, lastLit=0, lastRescued=0;
const show=screens(['menu','paused','end'], name=>{screen=name; $('pause').style.display=name==='play'?'block':'none'; $('hud').style.display=name==='play'?'block':'none';});
function refresh(){
 $('levels').replaceChildren();
 for(let n=1;n<=count;n++){const b=document.createElement('button');b.textContent=n;b.disabled=n>saved.unlocked;b.className=n===Math.min(saved.unlocked,count)?'current':'';b.setAttribute('aria-label',`Evening ${n}${n<saved.unlocked?', completed':''}`);b.onclick=()=>start(n);$('levels').append(b);}
 $('daily').disabled=saved.unlocked<=count; $('daily').textContent=saved.unlocked>count?'Daily evening':'Daily evening · finish all evenings';
 const day=date(); $('dailyBest').textContent=saveFailed?'Progress could not be saved. This session only.':saved.daily?.day===day?`Today’s best on this device: ${saved.daily.score}`:'A new hillside each day · best kept on this device';
 for(const id of ['sound1','sound2']) $(id).textContent=`Sound: ${saved.sound?'on':'off'}`;
 $('play').textContent=saved.played?'Continue evening':'Begin evening';
}
function start(n, challenge=null){current=n;daily=challenge; snd.unlock();snd.release();s=create(n,challenge?dailySeed(challenge):n);lastLit=s.nodes.filter(n=>n.lit).length;lastRescued=s.rescued;pointer=null;draft=[];touched=false;endAt=0;last=0;show('play');}
function menu(){pointer=null;draft=[];snd.release();refresh();show('menu');}
function pause(){if(screen!=='play')return;pointer=null;draft=[];snd.hold();show('paused');}
function resume(){if(screen!=='paused')return;snd.unlock();snd.release();last=0;show('play');}
onLeave(pause);
$('play').onclick=()=>start(Math.min(saved.unlocked,count));$('daily').onclick=()=>start(count,date());$('pause').onclick=pause;$('resume').onclick=resume;$('quit').onclick=menu;$('toMenu').onclick=menu;$('retry').onclick=()=>start(current,daily?date():null);$('next').onclick=()=>start(Math.min(count,current+1));
for(const id of ['sound1','sound2']) $(id).onclick=()=>{saved.sound=!saved.sound;store();if(saved.sound){snd.unlock();snd.release();snd.tone(660,.12,.04);}else snd.hold();refresh();};
function saveWin(){
 if(daily){if(!saved.daily||saved.daily.day!==daily||s.score>saved.daily.score)saved.daily={day:daily,score:s.score};}
 else saved.unlocked=Math.max(saved.unlocked,Math.min(count+1,current+1));
 store();
}
function finish(){
 if(s.status==='won')snd.tone(660,.3,.045,'sine',180);
 $('endTitle').textContent=s.status==='won'?'Everyone is home':'Night has fallen';
 $('endLine').textContent=s.status==='won'?`${s.rescued} of ${s.total} neighbours found their way home.${daily?' Today’s score: '+s.score+'.':''}`:`${s.rescued} of ${s.total} neighbours made it home. The lamps will be waiting.`;
 $('next').style.display=s.status==='won'&&!daily&&current<count?'':'none';
 if(saveFailed)$('endLine').textContent+=' Progress could not be saved on this device.';
 show('end');refresh();
}
function point(e){return {x:(e.clientX-ox)/scale,y:(e.clientY-oy)/scale};}
function nearest(p,max=8){let best=-1,dist=max; for(let i=0;i<s.nodes.length;i++){const n=s.nodes[i],d=Math.hypot(n.x-p.x,n.y-p.y);if(d<dist){dist=d;best=i;}}return best;}
function adjacent(a,b){return s.edges.some(e=>(e[0]===a&&e[1]===b)||(e[0]===b&&e[1]===a));}
function extend(p){
 const n=nearest(p);
 if(n<0||n===draftStart)return;
 const lastNode=draft[draft.length-1];
 if(n===lastNode){draftStart=null;return;}
 if(adjacent(lastNode,n)){draftStart=null;draft.push(n);snd.tone(480+draft.length*35,.045,.025);}
}
cv.addEventListener('pointerdown',e=>{
 if(screen!=='play'||pointer!==null||!s||s.status!=='play')return;
 const p=point(e),{keeper}=s,anchor=keeper.target??keeper.node;
 const anchored=nearest(p,10)===anchor;
 if(!anchored&&Math.hypot(p.x-keeper.x,p.y-keeper.y)>=10)return;
 e.preventDefault();pointer=e.pointerId;draft=[anchor];snd.unlock();
 draftStart=anchored?null:keeper.node;
 try{cv.setPointerCapture(pointer);}catch{}
});
cv.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;e.preventDefault();extend(point(e));});
cv.addEventListener('pointerup',e=>{
 if(e.pointerId!==pointer)return;
 extend(point(e));
 if(draft.length>1&&route(s,draft)){touched=true;saved.played=true;store();}
 pointer=null;draft=[];
});
function cancelDraft(e){if(e.pointerId===pointer){pointer=null;draft=[];}}
cv.addEventListener('pointercancel',cancelDraft);
cv.addEventListener('lostpointercapture',cancelDraft);
addEventListener('keydown',e=>{
 if(!isPauseKey(e))return;
 if(!e.repeat){
  if(screen==='play')pause();
  else if(screen==='paused')resume();
 }
 e.preventDefault();
});
hint(cv,{kind:'path',key:'night-lamp-keeper:hint',when:()=>screen==='play'&&s?.status==='play'&&current===1,played:!!old?.played,delay:4500,label:'Draw a path from the keeper through the lamps',bottom:()=>H-92});
window.lampState=()=>structuredClone({state:s,screen,saved,transform:{scale,ox,oy}});
refresh();
const X=x=>ox+x*scale,Y=y=>oy+y*scale;
function line(points,color,width,dash=[]){if(points.length<2)return;ctx.strokeStyle=color;ctx.lineWidth=width*scale;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(dash.map(d=>d*scale));ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(X(p.x),Y(p.y)):ctx.moveTo(X(p.x),Y(p.y)));ctx.stroke();ctx.setLineDash([]);}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(X(x),Y(y),r*scale,0,Math.PI*2);ctx.fill();}
function glow(x,y,r,color){const grad=ctx.createRadialGradient(X(x),Y(y),0,X(x),Y(y),r*scale);grad.addColorStop(0,color);grad.addColorStop(1,'#ffd38a00');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(X(x),Y(y),r*scale,0,7);ctx.fill();}
function hill(y,color,phase){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,Y(y));ctx.bezierCurveTo(W*.2,Y(y-10+phase),W*.33,Y(y+7),W*.55,Y(y-4));ctx.bezierCurveTo(W*.77,Y(y-14),W*.89,Y(y+4),W,Y(y-4+phase));ctx.lineTo(W,H);ctx.fill();}
function house(n,i){const x=n.x,y=n.y-4.4;if(n.homeLight)glow(x,y,10,'#ffe6a088');ctx.fillStyle='#f0c3a2';ctx.fillRect(X(x-3),Y(y-3),6*scale,5.6*scale);ctx.fillStyle=palette.roof;ctx.beginPath();ctx.moveTo(X(x-4),Y(y-3));ctx.lineTo(X(x),Y(y-6));ctx.lineTo(X(x+4),Y(y-3));ctx.fill();ctx.fillStyle=n.homeLight?'#fff4b7':'#745866';ctx.fillRect(X(x-.8),Y(y-1.8),1.6*scale,2*scale);}
function person(x,y,keeper=false){circle(x,y+1.4,2.4,'#463c4855');ctx.fillStyle=keeper?'#dfb77f':'#f3cfad';ctx.beginPath();ctx.moveTo(X(x-1.8),Y(y+1));ctx.lineTo(X(x-1.3),Y(y-2));ctx.lineTo(X(x+1.3),Y(y-2));ctx.lineTo(X(x+1.8),Y(y+1));ctx.closePath();ctx.fill();circle(x,y-3,1.3,keeper?'#f4d4aa':'#edc4a2');if(keeper){ctx.fillStyle='#65505a';ctx.fillRect(X(x-1.7),Y(y-4.2),3.4*scale,.65*scale);glow(x+2,y-.5,5,'#ffe7a888');circle(x+2,y-.5,.7,'#fff2be');}}
function draw(t){
 ctx.setTransform(dpr,0,0,dpr,0,0);const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,palette.sky);bg.addColorStop(.62,palette.horizon);bg.addColorStop(1,palette.ground);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 for(let i=0;i<38;i++){let x=((i*73+19)%101)/100*W,y=((i*41+7)%48)/150*H;ctx.globalAlpha=.3+.45*(.5+.5*Math.sin(t*.8+i));ctx.fillStyle='#fff2d1';ctx.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);}ctx.globalAlpha=1;
 hill(20,palette.hill,0);hill(69,palette.hill2,3);hill(108,palette.ground,0);
 // Small tufts and terrace strokes give the paths a hillside to cross.
 ctx.strokeStyle='#5c485044';ctx.lineWidth=.35*scale;ctx.lineCap='round';
 for(const [x,y] of [[5,35],[35,38],[65,35],[94,42],[8,58],[40,59],[71,62],[95,69],[4,83],[30,79],[59,85],[91,92],[7,111],[32,109],[63,115],[92,123],[20,132],[79,135]]){ctx.beginPath();ctx.moveTo(X(x-1.4),Y(y));ctx.quadraticCurveTo(X(x),Y(y-.7),X(x+2),Y(y-.25));ctx.moveTo(X(x),Y(y));ctx.lineTo(X(x-.6),Y(y-1.5));ctx.moveTo(X(x+.3),Y(y));ctx.lineTo(X(x+1),Y(y-1.1));ctx.stroke();}
 const a=s||create(1,1);
 for(const [u,v] of a.edges){const p=[a.nodes[u],a.nodes[v]];line(p,'#664c5355',3.5);line(p,palette.path,2.4);line(p,'#f2c9a455',.23,[1,1.5]);}
 const night=Math.max(0,Math.min(1,a.t/a.budget));ctx.fillStyle=`rgba(30,27,52,${night*.47})`;ctx.fillRect(0,0,W,H);
 const target=a.keeper.target, queue=a.keeper.queue||[];const path=[a.keeper,...[target??a.keeper.node,...queue].map(i=>a.nodes[i]).filter(Boolean)]; if(path.length>1)line(path,'#fff1b7aa',.9,[1.5,1]);
 for(let i=0;i<a.nodes.length;i++){const n=a.nodes[i];if(a.people.some(p=>p.home===i))house(n,i);if(n.lit||n.homeLight)glow(n.x,n.y,8,'#ffdf8aaa');ctx.strokeStyle='#6c5051';ctx.lineWidth=.45*scale;ctx.beginPath();ctx.moveTo(X(n.x),Y(n.y));ctx.lineTo(X(n.x),Y(n.y-2));ctx.stroke();circle(n.x,n.y-2,1,n.lit||n.homeLight?'#fff0b1':'#826771');}
 for(const p of a.people)if(!p.done)person(p.x,p.y);person(a.keeper.x,a.keeper.y,true);
 if(draft.length>1)line(draft.map(i=>a.nodes[i]),'#fff5ca',1.3);
 if(screen==='play'&&current===1&&!touched&&pointer===null&&a.status==='play')drawFirstRoute(a);
 if(screen==='play'){const fraction=Math.max(0,Math.min(1,1-a.t/a.budget));ctx.fillStyle='#3e344c88';ctx.beginPath();ctx.roundRect(X(12),Y(143),76*scale,2*scale,scale);ctx.fill();ctx.fillStyle='#ffe1a8';ctx.beginPath();ctx.roundRect(X(12),Y(143),76*scale*fraction,2*scale,scale);ctx.fill();$('hudTitle').textContent=daily?'Daily evening':`Evening ${current}`;$('hudSub').textContent=`${a.rescued} / ${a.total} home`;drawWind(a,t);}
}
function drawWind(a,t){
 const lamp=a.gust&&a.nodes[a.gust.node];
 const seconds=a.gust?a.gust.at-a.t:Infinity;
 const message=a.status!=='play'?'':seconds>0&&seconds<5?'A breeze is coming':seconds<=0&&!lamp.lit?'Light the marked lamp':'';
 const status=$('hudWind');
 if(status.textContent!==message)status.textContent=message;
 if(!message)return;
 ctx.strokeStyle='#fff0c8';ctx.lineWidth=.55*scale;
 ctx.setLineDash(seconds>0?[1.4*scale,1.2*scale]:[]);
 ctx.beginPath();
 const radius=seconds>0&&!reducedMotion.matches?3.2+.5*Math.sin(t*5):3.7;
 ctx.arc(X(lamp.x),Y(lamp.y-2),radius*scale,0,2*Math.PI);
 ctx.stroke();ctx.setLineDash([]);
}
function drawFirstRoute(a){
 const points=a.nodes;
 line(points,'#fff6d0',1,[1.4,1.4]);
 if(reducedMotion.matches)return;
 const progress=Math.min(2,(a.t%3.8)/1.5), segment=Math.min(1,Math.floor(progress));
 const p=points[segment],q=points[segment+1],u=progress-segment;
 const x=p.x+(q.x-p.x)*u,y=p.y+(q.y-p.y)*u;
 circle(x,y,1.6,'#fff7e5');
 ctx.textAlign='left';ctx.font=`${Math.max(16,4*scale)}px sans-serif`;
 ctx.fillStyle='#fff6d0';ctx.fillText('☝',X(x)-6,Y(y)+16);
}
function frame(now){
 requestAnimationFrame(frame);
 const dt=last?Math.min(.05,(now-last)/1000):0;
 last=now;
 if(screen==='play'&&s){
  if(s.status==='play'){
   step(s,dt,pointer!==null);
   const lit=s.nodes.filter(n=>n.lit).length;
   if(lit>lastLit)snd.tone(760,.16,.035,'sine',110);
   if(s.rescued>lastRescued){snd.tone(660,.25,.045,'sine',180);setTimeout(()=>snd.tone(990,.28,.035),100);}
   lastLit=lit;lastRescued=s.rescued;
   if(s.status!=='play'){
    if(s.status==='won')saveWin();
    pointer=null;draft=[];endAt=now+900;
   }
  }else if(endAt&&now>=endAt){
   endAt=0;finish();
  }
 }
 draw(now/1000);
}
requestAnimationFrame(frame);
