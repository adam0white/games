import {create, step, guide, peekQuest, RESIDENTS, FALLBACK, DT, DAY, WIDTH, HEIGHT, HIDE_RADIUS} from './sim.js';
import {drawForm, setLook} from '../../ant-promotion/art.js';
import {readJson, writeJson} from '../../kit/save.js';
import {sound} from '../../kit/audio.js';
import {onLeave, isPauseKey} from '../../kit/pause.js';
import {screens} from '../../kit/screens.js';
import {noZoom} from '../../kit/zoom.js';
import {stick} from '../../kit/stick.js';
import {hint} from '../../kit/hint.js';
noZoom(); setLook(2);
const $=id=>document.getElementById(id), canvas=$('c'), g=canvas.getContext('2d');
const KEY='ant-quests-save', DIALOGUE_KEY='ant-quests:dialogue', QUEST_TIMEOUT_MS=12000;
const raw=readJson(KEY), save={v:1,best:0,runs:0,sound:true,memory:{},secrets:{}};
if(raw && typeof raw==='object'){
  save.best=Number.isFinite(raw.best)?Math.max(0,Math.min(12,raw.best)):0;
  save.runs=Number.isFinite(raw.runs)?Math.max(0,raw.runs):0; save.sound=raw.sound!==false;
  for(const r of RESIDENTS){const m=raw.memory?.[r.id];if(m&&typeof m==='object')save.memory[r.id]={visits:Math.max(0,Number(m.visits)||0),failed:!!m.failed,hearts:Math.max(0,Math.min(3,Number(m.hearts)||0))};}
  if(raw.secrets&&typeof raw.secrets==='object') for(const [k,v] of Object.entries(raw.secrets).slice(0,48)) if(typeof v==='string')save.secrets[k]=v.slice(0,70);
}
const store=()=>writeJson(KEY,save), snd=sound({on:()=>save.sound});
let mode='menu', s=null, W=0,H=0,scale=1,ox=0,oy=0,last=0,acc=0,shake=0,particles=[],pulses=[],toastFor=0,returnFromBook='play';
let dialogue=readJson(DIALOGUE_KEY),calls=0,activeLines=null,bubbleFor=0,bubbleQuest=null,completeSeen=0;
const requests=new Map(), shown=new Set();
const keys=new Set(), reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const cards=screens(['menu','paused','bookCard','end'],name=>{
  mode=name;pad.drop();keys.clear();acc=0;
  $('hud').style.display=name==='play'?'block':'none';$('bubble').style.display=name==='play'&&bubbleFor>0?'block':'none';
  if(name==='menu')$('bestline').textContent=save.runs?`Best ${save.best} / 12 hearts · ${Object.keys(save.secrets).length} secrets`:'Four friends before nightfall.';
  $('sound').textContent=`Sound: ${save.sound?'on':'off'}`;
});
const pad=stick(canvas,{when:()=>mode==='play',reach:55,leash:70,dead:.15});
hint(canvas,{kind:'stick',key:'ant-quests:hint',when:()=>mode==='play',played:!!raw,reach:55,bottom:170});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), resident=id=>RESIDENTS.find(r=>r.id===id);
const hearts=()=>s?Object.values(s.friends).reduce((a,b)=>a+b,0):0;
function tone(f=440,d=.09,v=.06,type='triangle',slide=0){snd.tone(f,d,v,type,slide);}
function toast(text){$('toast').textContent=text;toastFor=2.4;$('toast').classList.add('on');}
function burst(x,y,color='#efc86b',n=22){if(reduced)n=5;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=25+Math.random()*80;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-25,life:.6+Math.random()*.6,age:0,color,r:2+Math.random()*3});}pulses.push({x,y,age:0,color});}
function cancelRequests(){for(const {controller} of requests.values())controller.abort();requests.clear();}
function start(){
  cancelRequests();calls=0;shown.clear();bubbleQuest=null;activeLines=null;completeSeen=0;particles=[];pulses=[];shake=0;
  toastFor=0;$('toast').classList.remove('on');
  const query=new URLSearchParams(location.search), seed=query.has('seed')?Number(query.get('seed'))>>>0:20261123;
  s=create({seed,memory:save.memory});save.runs++;store();bubbleFor=0;
  snd.unlock();snd.release();tone(392,.12);tone(587,.2,.04);cards('play');
}
function pause(){if(mode!=='play')return;cards('paused');snd.hold();}
function resume(){snd.unlock();snd.release();cards('play');}
function clean(p){if(!p||typeof p!=='object')return null;const out={};for(const k of ['name','ask','thanks','scold','secret']){if(typeof p[k]!=='string'||!p[k].trim())return null;out[k]=p[k].trim().slice(0,70);}return out;}
function fallback(q){const f=FALLBACK[q.giver];return {name:f.name,ask:f.ask[q.kind].replaceAll('{count}',String(q.count)).replaceAll('{target}',q.target),thanks:f.thanks,scold:f.scold,secret:f.secret};}
function dailyDialogue(){
  const day=new Date().toISOString().slice(0,10);
  if(dialogue?.day!==day)dialogue={day,givers:{}};
  return dialogue;
}
// A resident can ask for several different tasks. Only reuse text for matching instructions.
const taskKey=q=>`${q.kind}:${q.target}:${q.count}`;
const cachedLines=q=>clean(dailyDialogue().givers?.[q.giver]?.[taskKey(q)]);
function cacheLines(q,day,lines){
  const today=dailyDialogue();
  if(today.day!==day)return;
  const stored=readJson(DIALOGUE_KEY), givers={...today.givers,...(stored?.day===day?stored.givers:null)};
  givers[q.giver]={...today.givers?.[q.giver],...givers[q.giver],[taskKey(q)]:lines};
  dialogue={day,givers};writeJson(DIALOGUE_KEY,dialogue);
}
// Request at most once per approaching offer. Use the built-in lines while it is pending.
function prefetch(){
  if(!s||calls>=8)return;
  for(const r of RESIDENTS){
    if(Math.hypot(s.player.x-r.x,s.player.y-r.y)>100)continue;
    const q=peekQuest(s,r.id);if(!q||requests.has(q.id)||shown.has(q.id)||cachedLines(q))continue;
    const day=dailyDialogue().day, controller=new AbortController(), entry={controller,lines:null};
    requests.set(q.id,entry);calls++;
    const timer=setTimeout(()=>controller.abort(),QUEST_TIMEOUT_MS);
    const body={giver:q.giver,kind:q.kind,target:q.target,count:q.count,mood:r.mood,variant:q.variant};
    fetch('/lab-api/quest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal})
      .then(r=>r.ok?r.json():null).then(p=>{
        const lines=clean(p);
        if(!lines||controller.signal.aborted)return;
        entry.lines=lines;
        cacheLines(q,day,lines);
        if(s.quest?.id===q.id&&bubbleQuest?.id===q.id){activeLines=lines;speak(bubbleQuest);}
      }).catch(()=>{}).finally(()=>clearTimeout(timer));
    if(calls>=8)break;
  }
}
function speak(q,kind='ask'){
  // A model nickname ("Buzzy-Bug") alone does not say who is talking; the meadow labels say "Beetle".
  const lines=activeLines??fallback(q),r=resident(q.giver);$('name').textContent=lines.name===r.name?r.name:`${r.name} · ${lines.name}`;
  $('line').textContent=lines[kind];$('bubble').style.borderLeftColor=r.color||'#d46e52';bubbleFor=kind==='ask'?999:3.2;
  $('bubble').style.display=mode==='play'?'block':'none';
}
function events(){for(const e of s.events){
  const type=e.type||e.t,q=e.quest||s.quest;
  if(type==='offer'){
    const offered=q??e;shown.add(offered.id);bubbleQuest=structuredClone(offered);
    activeLines=requests.get(offered.id)?.lines??cachedLines(offered);
    const m=save.memory[offered.giver];
    speak(offered);
    if(m?.failed)toast(`${resident(offered.giver).name}: Don't let me down again.`);
    else if(m?.visits)toast(`${resident(offered.giver).name}: Back again, little ant?`);
    tone(440,.13,.06,'sine',100);burst(resident(offered.giver).x,resident(offered.giver).y,'#fff3ca',8);
  }
  if(type==='collect'){tone(620+(s.quest?.progress||0)*75,.09,.07);burst(e.x??s.player.x,e.y??s.player.y,'#f0d27d',12);}
  if(type==='complete'){
    const giver=e.giver||bubbleQuest?.giver;if(!giver)continue;
    const q0=bubbleQuest?.giver===giver?bubbleQuest:{giver,kind:'fetch',count:1};
    speak(q0,'thanks');bubbleQuest=null;
    save.memory[giver]={visits:(save.memory[giver]?.visits||0)+1,failed:false,hearts:Math.max(save.memory[giver]?.hearts||0,s.friends[giver])};
    save.secrets[`${giver}-${s.friends[giver]}`]=(activeLines||fallback(q0)).secret;save.best=Math.max(save.best,hearts());store();
    const changes={beetle:'A stone rolls. A path opens.',snail:'A silver trail. Swift feet.',spider:'Silk across the stream.',frog:'One fewer hunter.'};toast(changes[giver]);
    burst(resident(giver).x,resident(giver).y,'#e18b73',44);shake=.18;[523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,.24,.06),i*85));completeSeen++;
  }
  if(type==='fail'){
    const giver=e.giver||bubbleQuest?.giver;if(giver){save.memory[giver]={...(save.memory[giver]||{}),failed:true};store();if(bubbleQuest)speak(bubbleQuest,'scold');}bubbleQuest=null;tone(240,.25,.07,'sine',-90);toast('Try again. There is still daylight.');
  }
  if(type==='hit'){shake=.25;tone(150,.15,.06,'triangle',-50);burst(s.player.x,s.player.y,'#d97964',15);}
}
if(s.status!=='play')finish();}
function rememberFailure(){if(s?.quest){const id=s.quest.giver;save.memory[id]={...(save.memory[id]||{}),failed:true};store();}}
function finish(){cancelRequests();rememberFailure();save.best=Math.max(save.best,hearts());store();$('endTitle').textContent=s.status==='won'?'Everyone belongs.':'The meadow remembers.';$('endScore').textContent=`${hearts()} / 12 hearts`;$('endLine').textContent=s.status==='won'?'Four friends. A brighter meadow.':'Tomorrow is another little adventure.';$('endBest').textContent=`Best ${save.best} hearts · ${Object.keys(save.secrets).length} secrets`;cards('end');if(s.status==='won'){for(const r of RESIDENTS)burst(r.x,r.y,'#edc66c',45);[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.45,.08),i*130));}else tone(330,.6,.06,'sine',-70);}
function book(){returnFromBook=mode;if(mode==='play')snd.hold();cards('bookCard');const box=$('entries');box.textContent='';for(const r of RESIDENTS){const div=document.createElement('div');div.className='entry';const b=document.createElement('b');b.textContent=r.name;const p=document.createElement('p');const m=save.memory[r.id];p.textContent='♥'.repeat(m?.hearts||0)+'♡'.repeat(3-(m?.hearts||0))+(m?.failed?' · Still waiting':m?.visits?' · Remembers you':' · Not yet friends');div.append(b,p);
  // Each friend's secrets sit under that friend: a separate list after four entries was scrolled out of sight.
  for(const v of new Set(Object.entries(save.secrets).filter(([k])=>k.split('-')[0]===r.id).map(([,v])=>v))){const q=document.createElement('p');q.className='secret';q.textContent=`“${v}”`;div.append(q);}box.append(div);}if(!Object.keys(save.secrets).length){const p=document.createElement('p');p.textContent='Every heart holds a secret.';box.append(p);}}
$('play').onclick=start;$('again').onclick=start;$('restart').onclick=()=>{rememberFailure();start();};$('pause').onclick=pause;$('resume').onclick=resume;
$('toMenu').onclick=()=>{rememberFailure();cancelRequests();cards('menu');};$('endMenu').onclick=()=>cards('menu');
for(const id of ['book','secrets','endBook'])$(id).onclick=book;
$('closeBook').onclick=()=>{cards(returnFromBook);if(returnFromBook==='play')snd.release();};
$('sound').onclick=()=>{save.sound=!save.sound;store();$('sound').textContent=`Sound: ${save.sound?'on':'off'}`;if(save.sound){snd.unlock();tone();}};
onLeave(pause);addEventListener('keydown',e=>{if(isPauseKey(e)){e.preventDefault();if(mode==='play')pause();else if(mode==='paused')resume();return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener('pointerdown',e=>{if(mode!=='play')return;snd.unlock();tone(330,.035,.025);pulses.push({x:(e.clientX-ox)/scale,y:(e.clientY-oy)/scale,age:0,color:'#fff7d6'});});
function input(){const v=pad.vector();if(keys.size){v.x=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0);v.y=(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')?1:0);}return v;}
function resize(){W=innerWidth;H=innerHeight;const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);g.setTransform(dpr,0,0,dpr,0,0);const probe=getComputedStyle($('probe')),top=parseFloat(probe.paddingTop)||0,bottom=parseFloat(probe.paddingBottom)||0,reserve=Math.max(205,$('bubble').offsetHeight+112);scale=Math.min((W-18)/WIDTH,(H-top-bottom-reserve)/HEIGHT,1.25);ox=(W-WIDTH*scale)/2;oy=top+80+Math.max(0,(H-top-bottom-reserve-HEIGHT*scale)/2);}
addEventListener('resize',resize);resize();new ResizeObserver(resize).observe($('bubble'));
const INK='#284735',CREAM='#fff5d8';
function ellipse(x,y,rx,ry,color,rot=0){g.fillStyle=color;g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),rot,0,Math.PI*2);g.fill();}
function line(points,color,w=2){g.strokeStyle=color;g.lineWidth=w;g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(...points[0]);for(const p of points.slice(1))g.lineTo(...p);g.stroke();}
function label(text,x,y,color=INK,size=14){g.font=`bold ${size/scale}px 'Trebuchet MS',sans-serif`;g.textAlign='center';g.fillStyle=color;g.fillText(text,x,y);}
function ant(x,y,a=0,phase=0,r=10,color='#784a36'){g.save();g.translate(x,y);g.rotate(a);drawForm(g,{kind:'bug',f:{pin:1},c:color,d:'#422d28',e:'#db9d6a',role:'ant'},r,phase);g.restore();}
function folk(ctx,id,x,y,t=0,heart=0){// Resident shapes drawn with the canvas context passed in.
  ctx.save();ctx.translate(x,y);const bob=reduced?0:Math.sin(t*2+x)*1.5;ctx.translate(0,bob);ctx.shadowColor='#28463236';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
  if(id==='snail'){
    ctx.fillStyle='#b5c58e';ctx.beginPath();ctx.ellipse(0,8,24,10,0,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#c68d64';ctx.beginPath();ctx.arc(-7,-3,19,0,7);ctx.fill();ctx.strokeStyle='#805b48';ctx.lineWidth=2.5;ctx.beginPath();for(let a=0;a<Math.PI*5;a+=.1){const r=a*.9;ctx.lineTo(-7+Math.cos(a)*r,-3+Math.sin(a)*r);}ctx.stroke();ctx.strokeStyle='#658b62';ctx.lineWidth=4;for(const k of [13,23]){ctx.beginPath();ctx.moveTo(k,4);ctx.lineTo(k+2,-12);ctx.stroke();}
  }else if(id==='frog'){
    ctx.fillStyle='#6d9b69';for(const k of [-16,16]){ctx.beginPath();ctx.ellipse(k,8,13,10,k*.025,0,7);ctx.fill();}ctx.beginPath();ctx.ellipse(0,0,23,19,0,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#cee1a0';ctx.beginPath();ctx.ellipse(0,7,16,10,0,0,7);ctx.fill();
  }else{
    ctx.strokeStyle=id==='spider'?'#655071':'#614c36';ctx.lineWidth=3;for(const k of [-1,1])for(let i=0;i<(id==='spider'?4:3);i++){ctx.beginPath();ctx.moveTo(k*8,-9+i*7);ctx.lineTo(k*(24+i%2*3),-17+i*12);ctx.lineTo(k*29,-10+i*12);ctx.stroke();}
    ctx.fillStyle=id==='spider'?'#8b7398':'#8d7850';ctx.beginPath();ctx.ellipse(0,0,18,23,0,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=id==='spider'?'#b9a4bf':'#ac9a63';ctx.beginPath();ctx.ellipse(-5,-5,8,13,-.2,0,7);ctx.fill();if(id==='beetle'){ctx.strokeStyle='#5a5038';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(0,22);ctx.stroke();}
  }
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;const ex=id==='snail'?18:8,ey=id==='snail'?-13:-13;for(const k of [-1,1]){const xx=id==='snail'?ex+k*5:k*ex;ctx.fillStyle=CREAM;ctx.beginPath();ctx.arc(xx,ey,5,0,7);ctx.fill();ctx.fillStyle='#283d32';ctx.beginPath();ctx.arc(xx+1,ey+1,2,0,7);ctx.fill();}ctx.strokeStyle='#3f5742';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(id==='snail'?20:0,id==='snail'?3:0,6,.2,Math.PI-.2);ctx.stroke();ctx.restore();
}
function heart(x,y,r,color){g.save();g.translate(x,y);g.scale(r/10,r/10);g.fillStyle=color;g.beginPath();g.moveTo(0,9);g.bezierCurveTo(-20,-3,-8,-14,0,-6);g.bezierCurveTo(8,-14,20,-3,0,9);g.fill();g.restore();}
function world(now){
  const t=(s?.t||now/1000), world=s?.world||{};
  g.fillStyle='#203e35';g.fillRect(0,0,W,H);const bg=g.createRadialGradient(W/2,H*.45,20,W/2,H*.5,H*.7);bg.addColorStop(0,'#42654b');bg.addColorStop(1,'#1c382f');g.fillStyle=bg;g.fillRect(0,0,W,H);
  g.save();g.translate(ox,oy);g.scale(scale,scale);if(shake>0&&!reduced)g.translate(Math.sin(now*.11)*shake*15,Math.cos(now*.08)*shake*10);
  g.shadowColor='#0d281f66';g.shadowBlur=25;g.shadowOffsetY=12;g.fillStyle='#b6c78a';g.beginPath();g.roundRect(0,0,WIDTH,HEIGHT,42);g.fill();g.shadowBlur=0;g.shadowOffsetY=0;
  // A hand-drawn meadow border, with open walking ground in the middle.
  for(let i=0;i<75;i++){const x=15+(i*137.51)%330,y=15+(i*79.37)%470;if(x>110&&x<240&&y>140&&y<410)continue;const c=i%3===0?'#91af71':'#a6be7c';ellipse(x,y,7,3,c,-.6);if(i%5===0){line([[x,y],[x+1,y-13]],'#86a36a',1.6);for(let k=0;k<5;k++)ellipse(x+Math.cos(k*1.257)*4,y-13+Math.sin(k*1.257)*4,3,3,i%2?'#fff2ce':'#e6a98c');ellipse(x,y-13,2.5,2.5,'#e6bf69');}}
  // Silk opens a shortcut over the slow water.
  line([[15,245],[65,260],[125,245],[180,260],[240,245],[300,260],[345,245]],'#7d9e7c',35);
  line([[15,242],[65,257],[125,242],[180,257],[240,242],[300,257],[345,242]],'#89bdba',27);
  for(let i=0;i<10;i++){const x=22+i*33,y=247+Math.sin(i*2)*6;line([[x,y],[x+10,y]],'#c5e3cf',2);}
  if(world.bridge){const bw=25+world.bridge*17;line([[180,227],[180,280]],'#fff2cf',bw*2);for(let y=231;y<280;y+=8)line([[180-bw,y],[180+bw,y]],'#b7ad88',2);}
  // Beetle's gate and snail's trail reflect functional state in sim.js.
  const rx=180+(world.rockOpen||0)*22,rr=23-(world.rockOpen||0)*3;ellipse(rx,340,rr,rr*.85,'#77856a');ellipse(rx-4,335,rr*.7,rr*.55,'#9aa486');
  if(world.trail){g.save();g.globalAlpha=.55;line([[72,130],[78,190],[70,245],[83,315],[90,395]],'#eef2ca',8+world.trail*4);g.restore();}
  ellipse(286,392,43,28,'#7ea49a');ellipse(285,387,35,20,'#a3c9ac');ellipse(305,390,13,8,'#75995f',-.4);
  for(const r of RESIDENTS){const h=s?.friends[r.id]||0,active=s?.quest?.giver===r.id;ellipse(r.x,r.y,40,31,active?'#cbd59a':'#c4d197');if(active){g.save();g.setLineDash([4,6]);g.lineDashOffset=-t*15;g.strokeStyle='#fff4cf';g.lineWidth=2;g.beginPath();g.ellipse(r.x,r.y,39,33,0,0,7);g.stroke();g.restore();}folk(g,r.id,r.x,r.y,t,h);for(let k=0;k<3;k++)heart(r.x-17+k*17,r.y+39,6,h>k?'#cc7056':'#96aa75');label(r.name,r.x,r.y-40,INK,14);}
  if(s){
    const q=s.quest;
    if(q){
      for(const p of q.points||[]){if(p.taken||p.done||p.gone)continue;if(q.kind==='hide'){ellipse(p.x,p.y,27,23,'#6e985c');for(let k=0;k<4;k++)ellipse(p.x-18+k*11,p.y-8-(k%2)*7,13,15,'#82a96a');}else if(q.kind==='hunt'){ant(p.x,p.y,Math.sin(t)*.2,t,6,'#8b9a42');}else{ellipse(p.x,p.y,6,9,q.target==='berry'?'#cf775a':'#d8ae63',.5);line([[p.x-2,p.y-4],[p.x+2,p.y+4]],'#f5dda2',1);}target(p.x,p.y,t);}
      if(q.lost){target(q.lost.x,q.lost.y,t);ant(q.lost.x,q.lost.y,0,t,8,'#ad6e48');}
      if(q.goal&&(q.ready||q.kind==='escort'))target(q.goal.x,q.goal.y,t);
    }
    for(const h of s.hunters||[]){if(h.gone)continue;ellipse(h.x,h.y+2,14,7,'#2e4e3433');ant(h.x,h.y,h.a||0,t,10,'#a65546');}
    const dest=guide(s);if(dest&&s.status==='play'){
      const dx=dest.x-s.player.x,dy=dest.y-s.player.y,d=Math.hypot(dx,dy);if(d>24){g.save();g.strokeStyle='#fff9d6';g.lineWidth=2;g.globalAlpha=.6;g.setLineDash([3,9]);g.lineDashOffset=-t*15;g.beginPath();g.moveTo(s.player.x,s.player.y);g.lineTo(dest.x,dest.y);g.stroke();g.restore();const a=Math.atan2(dy,dx),x=s.player.x+Math.cos(a)*28,y=s.player.y+Math.sin(a)*28;line([[x+Math.cos(a+2.5)*7,y+Math.sin(a+2.5)*7],[x,y],[x+Math.cos(a-2.5)*7,y+Math.sin(a-2.5)*7]],'#fff9de',3);}}
    const p=s.player;ellipse(p.x,p.y+4,13,7,'#3d563c33');g.save();g.strokeStyle=p.safe>0?'#fff6d7':'#f5e5b0';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,18+Math.sin(t*4),0,7);g.stroke();g.restore();g.save();g.translate(p.x,p.y);const squash=reduced?1:1+Math.sin(t*15)*.04;g.scale(squash,1/squash);ant(0,0,p.a,p.ph||t,10);g.restore();if(q?.kind==='hide')ellipse(p.x,p.y-14,5,4,'#e3d2a5');
    if(q?.kind==='hide'){g.save();g.globalAlpha=.18;ellipse(160+Math.sin(t)*120,100+(t*20)%320,65,27,'#263b38',-.3);g.restore();}
  }
  for(const p of particles){g.globalAlpha=Math.max(0,1-p.age/p.life);ellipse(p.x,p.y,p.r,p.r,p.color);}g.globalAlpha=1;
  for(const p of pulses){g.globalAlpha=Math.max(0,1-p.age/.65);g.strokeStyle=p.color;g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,8+p.age*55,0,7);g.stroke();}g.globalAlpha=1;
  if(s&&s.t>120){g.fillStyle=`rgba(45,42,74,${Math.min(.4,(s.t-120)/150)})`;g.beginPath();g.roundRect(0,0,WIDTH,HEIGHT,42);g.fill();}
  g.restore();const joy=pad.touch;if(joy&&mode==='play'){g.strokeStyle='#fff9e877';g.lineWidth=2;g.fillStyle='#fff9e817';g.beginPath();g.arc(joy.ox,joy.oy,55,0,7);g.fill();g.stroke();g.fillStyle='#fff9e8b0';g.beginPath();g.arc(joy.x,joy.y,22,0,7);g.fill();}
}
function target(x,y,t){g.save();g.strokeStyle='#fff8dc';g.lineWidth=2;g.beginPath();g.arc(x,y,17+Math.sin(t*4)*2,0,7);g.stroke();g.restore();}
function hero(id){const c=$(id),ctx=c.getContext('2d');ctx.clearRect(0,0,600,300);ctx.save();ctx.translate(300,155);ctx.scale(2,2);ctx.fillStyle='#e5e8c5';ctx.beginPath();ctx.ellipse(0,15,135,34,0,0,7);ctx.fill();for(const [i,r]of RESIDENTS.entries())folk(ctx,r.id,-99+i*66,8,i,3);ctx.restore();}
hero('hero');hero('endArt');
function taskStatus(q){
  if(q.ready)return 'Return to giver';
  if(q.kind==='race')return 'Reach the pebble';
  if(q.kind==='escort')return q.escorting?'Lead it back':'Find the lost ant';
  if(q.kind==='hide'){
    const leaf=q.points[0],underLeaf=Math.hypot(s.player.x-leaf.x,s.player.y-leaf.y)<HIDE_RADIUS;
    return underLeaf?`Stay under leaf · ${Math.floor(q.progress*100)}%`:'Reach the leaf';
  }
  return `${q.progress} / ${q.count}`;
}
function frame(now){requestAnimationFrame(frame);const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
  if(mode==='play'&&s){prefetch();acc+=dt;while(acc>=DT&&mode==='play'){acc-=DT;step(s,input());events();}
    $('hearts').textContent=`♥ ${hearts()} / 12`;
    const left=Math.max(0,Math.ceil(DAY-s.t));$('clock').textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;$('sunfill').style.transform=`scaleX(${clamp(1-s.t/DAY,0,1)})`;
    if(s.quest){const q=s.quest;$('progress').textContent=`${taskStatus(q)} · ${Math.ceil(q.remaining)}s`;$('questfill').style.width=`${clamp(q.progress/q.count,0,1)*100}%`;}
    else{$('progress').textContent='';$('questfill').style.width='0%';if(bubbleFor>100){$('line').textContent='Follow the little path to a friend.';$('name').textContent='The meadow';}}
    if(!s.quest&&bubbleFor<=0){$('name').textContent='The meadow';$('line').textContent='Follow the little path to a friend.';bubbleFor=999;$('bubble').style.display='block';}
    if(bubbleFor<100){bubbleFor-=dt;if(bubbleFor<=0)$('bubble').style.display='none';}
  }
  if(mode==='play'||mode==='end'){for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=85*dt;}particles=particles.filter(p=>p.age<p.life);for(const p of pulses)p.age+=dt;pulses=pulses.filter(p=>p.age<.65);shake=Math.max(0,shake-dt);}
  if(toastFor>0){toastFor-=dt;if(toastFor<=0)$('toast').classList.remove('on');}world(now);
}
// Read-only snapshot: phone checks steer with pointer input through the kit stick.
window.meadowState=()=>({mode,audio:!!snd.ctx,s:s?structuredClone(s):null,calls,shown:[...shown],completed:completeSeen,save:structuredClone(save),guide:s?guide(s):null,layout:{scale,ox,oy,W,H},bubble:$('line').textContent,source:bubbleQuest?(activeLines?'model':'fallback'):'none'});
cards('menu');requestAnimationFrame(frame);
