import { create, step, progress, score, DT, NIGHTS, createControl, tap, release, advanceControl } from './sim.js';
import { createRenderer } from './render.js';
import { readJson, writeJson } from '../../kit/save.js';
import { sound } from '../../kit/audio.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { noZoom } from '../../kit/zoom.js';
import { screens } from '../../kit/screens.js';
import { hint } from '../../kit/hint.js';
const $ = id => document.getElementById(id), query = new URLSearchParams(location.search);
noZoom();
const old = readJson('lantern-fp-save', null), save = { best: 0, opened: 1, runs: 0, sound: true, name: '', sharing: false, boardId: '', pendingRemove: '' };
if (old && typeof old === 'object') {
  for (const k of ['best','opened','runs']) if (Number.isFinite(old[k]) && old[k] >= 0) save[k] = Math.floor(old[k]);
  if (typeof old.sound === 'boolean') save.sound = old.sound;
  if (typeof old.name === 'string') save.name = old.name.slice(0,16);
  if (typeof old.boardId === 'string' && /^[\w-]{1,64}$/.test(old.boardId)) save.boardId = old.boardId;
  if (typeof old.pendingRemove === 'string' && /^[\w-]{1,64}$/.test(old.pendingRemove)) save.pendingRemove = old.pendingRemove;
  save.sharing = old.sharing === true && !!save.boardId && !save.pendingRemove;
}
save.opened = Math.max(1, Math.min(NIGHTS, save.opened));
const store = () => writeJson('lantern-fp-save', save);
const canvas = $('c');
let R = null;
try { R = createRenderer(canvas); } catch { /* A context lost during setup uses the same 2D fallback. */ }
const showCards = screens(['menu','paused','end','board','nogl']);
let screen = 'menu', playing = false, paused = false;
function show(name) {
  screen = name; showCards(name);
  for (const id of ['hud','pause','steer']) $(id).style.display = name === 'play' ? (id === 'steer' ? 'flex' : 'block') : 'none';
  $('warn').style.display = 'none';
  if (name === 'menu') $('bestLine').textContent = save.runs ? `Night ${stage} · Best ${distance(save.best)}` : '';
}
if (!R || R.errors.length) {
  canvas.hidden = true; show('nogl');
  window.lanternFPState = () => ({screen:'nogl',webgl:false});
} else {
  startPage();
}
function distance(n) { return `night ${Math.min(NIGHTS,Math.floor(Math.max(0,n-1)/100)+1)} · ${n > 0 && n % 100 === 0 ? 100 : n % 100}%`; }
// The page owns the date; the simulation owns every seeded rule.
function seedForDay() { let n=2166136261; for(const c of new Date().toISOString().slice(0,10)) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0; }
let stage = Math.min(NIGHTS,Math.max(1,Math.floor(Number(query.get('night'))||save.opened)));
function startPage() {
  // Defer one microtask so stage is initialized before the menu renders.
  queueMicrotask(run);
}
function run() {
  const speed = Math.max(1,Math.min(8,Number(query.get('speed'))||1)); // validation only: extra fixed ticks, never altered rules
  let s = create(1,stage), control=createControl(s.x), last=0, acc=0, shake=0, glow=0, sparks=[], ended=0, snap=true, pointer=null, key=null;
  let lastRepeat=0, boardRows=null, boardBusy=false, boardEpoch=0, soundTimers=[];
  const snd=sound({on:()=>save.sound});
  const tone=(f,d=.12,v=.06,type='triangle')=>snd.tone(f,d,v,type);
  const later=(fn,ms)=>{soundTimers.push(setTimeout(()=>{if(!paused)fn();},ms));};
  const clearTones=()=>{soundTimers.forEach(clearTimeout);soundTimers=[];};
  function resize(){const d=Math.min(1.25,devicePixelRatio||1);R.resize(Math.round(innerWidth*d),Math.round(innerHeight*d));}
  addEventListener('resize',resize);resize();
  const drop=()=>{pointer=null;key=null;release(control);$('left').classList.remove('on');$('right').classList.remove('on');};
  function begin(){
    clearTones(); snd.unlock();snd.release();
    const seed=query.has('seed') ? (Number(query.get('seed'))||0) : (seedForDay()+stage*977)>>>0;
    s=create(seed,stage);control=createControl(s.x);playing=true;paused=false;acc=0;last=performance.now();shake=glow=0;sparks=[];snap=true;drop();show('play');
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
    tone(392,.3);later(()=>tone(587,.4),100);hud();
  }
  function burst(red=false,blue=false,n=18){for(let i=0;i<n;i++){const a=i/n*Math.PI*2;sparks.push({x:s.x,y:s.y,vx:Math.cos(a)*.22,vy:Math.sin(a)*.25,life:.7,red,blue});}}
  function finish(){
    playing=false;drop();ended=performance.now();clearTones();save.runs++;
    const won=s.over==='dawn', pct=Math.floor(progress(s)*100), result=(stage-1)*100+pct;
    save.best=Math.max(save.best,result);
    $('endTitle').textContent=won?'Dawn':s.over==='dark'?'Light lost':s.over==='bank'?'Run aground':'Wrecked';$('score').textContent=`${pct}%`;
    $('endLine').textContent=won?`Night ${stage} complete · ${s.taken} embers`:`Night ${stage} · ${s.taken} embers · Best ${distance(save.best)}`;
    if(won){save.opened=Math.max(save.opened,Math.min(NIGHTS,stage+1));if(stage<NIGHTS)stage++;$('again').textContent=`Play night ${stage}`;burst(false,false,60);[523,659,784,1047].forEach((f,i)=>later(()=>tone(f,1,.08),i*150));}
    else{$('again').textContent='Try again';shake=1;burst(true);tone(90,.6,.12,'sine');snd.noise(.25,.13,500);}
    store();void sendBest();
    show('end');$('end').firstElementChild.classList.remove('celebrate');void $('end').offsetWidth;$('end').firstElementChild.classList.add('celebrate');
  }
  function hud(){const p=progress(s);$('night').textContent=`Night ${s.stage}`;$('pct').textContent=`${Math.floor(p*100)}%`;$('embers').textContent=s.taken;$('hearts').textContent=`♥ ${s.hearts}`;$('progress').firstElementChild.style.width=`${p*100}%`;$('wick').firstElementChild.style.width=`${Math.max(0,s.light)*100}%`;$('warn').style.display=screen==='play'&&s.light<.28?'block':'none';}
  function pulse(side,x=innerWidth*(side<0?.23:.77),y=innerHeight*.8){
    $('left').classList.toggle('on',side<0);$('right').classList.toggle('on',side>0);
    const ripple=document.createElement('i');ripple.className='ripple';ripple.style.left=`${x-24}px`;ripple.style.top=`${y-24}px`;$('ripples').append(ripple);setTimeout(()=>ripple.remove(),600);
    snd.unlock();tone(side<0?220:294,.07,.035);glow=Math.max(glow,.12);
  }
  function press(side,x,y){tap(control,side);lastRepeat=control.taps;pulse(side,x,y);}
  // Two thumbs overlap during quick alternating taps: the newest press wins, and lifting an older thumb does nothing.
  canvas.addEventListener('pointerdown',e=>{if(!playing||paused||key)return;e.preventDefault();pointer=e.pointerId;try{canvas.setPointerCapture(e.pointerId);}catch{}press(e.clientX<innerWidth/2?-1:1,e.clientX,e.clientY);});
  function up(e){if(e.pointerId!==pointer)return;drop();}
  canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',up);
  // Pointer movement is deliberately ignored: the half where the press began owns the whole press.
  hint(canvas,{kind:'tap',key:'lantern-fp:hint',delay:2500,bottom:70,when:()=>playing&&!paused&&screen==='play',played:save.runs>0,label:'Tap left or right to steer'});
  function pause(){if(!playing||paused)return;paused=true;drop();clearTones();show('paused');snd.hold();}
  function resume(){if(!playing||!paused)return;paused=false;control.target=s.x;drop();acc=0;last=performance.now();snd.release();show('play');}
  $('play').onclick=begin;$('again').onclick=begin;$('pause').onclick=pause;$('resume').onclick=resume;
  $('quit').onclick=()=>{playing=false;paused=false;drop();clearTones();snd.release();show('menu');};
  $('endMenu').onclick=()=>show('menu');
  $('sound').onclick=()=>{save.sound=!save.sound;store();$('sound').textContent=`Sound: ${save.sound?'on':'off'}`;if(save.sound){snd.unlock();tone(660);}else snd.hold();};
  $('sound').textContent=`Sound: ${save.sound?'on':'off'}`;
  onLeave(pause);
  addEventListener('keydown',e=>{
    if(e.target instanceof HTMLInputElement)return;
    if(isPauseKey(e)){e.preventDefault();if(!e.repeat)paused?resume():pause();return;}
    if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(playing&&!paused&&!e.repeat&&pointer===null){key=e.key;press(key==='ArrowLeft'?-1:1);}}
    if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();if(paused)resume();else if(screen==='menu'||screen==='end')begin();}
  });
  addEventListener('keyup',e=>{if(e.key===key)drop();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('nogl').querySelector('p').textContent='The 3D drawing stopped. Reload to try again.';show('nogl');});
  // Board: same {rows:[{n,s}], place} response and {id,n,s}/{id,remove} requests as Lantern.
  // GET only on opening this card. POST only after an explicit opt-in with a typed name.
  const clean=t=>String(t??'').replace(/[^\p{L}\p{N} _.-]/gu,'').trim().slice(0,16);
  $('shareName').value=save.name;
  async function boardFetch(body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);try{const response=await fetch('/lab-api/board/lantern-fp',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal}:{signal:controller.signal});if(!response.ok)return null;const data=await response.json();if(!Array.isArray(data?.rows))return null;return data.rows.filter(r=>r&&Number.isFinite(r.s)&&r.s>0).slice(0,20).map(r=>({n:clean(r.n),s:Math.floor(r.s)}));}catch{return null;}finally{clearTimeout(timer);}}
  // Preserve write order: an automatic score upload must finish before removal.
  // Skip a queued score if the player has revoked its consent before it starts.
  let boardWrites=Promise.resolve();
  function boardCall(body){
    if(!body)return boardFetch();
    const result=boardWrites.then(()=>{
      if(!body.remove&&(!save.sharing||body.id!==save.boardId))return null;
      return boardFetch(body);
    });
    boardWrites=result.catch(()=>null);return result;
  }
  function boardDraw(){
    $('share').disabled=boardBusy;$('share').textContent=save.pendingRemove?'Retry removal':save.sharing?'Stop sharing':'Share';$('rows').textContent='';
    const rows=boardRows??(save.best?[{n:'This device',s:save.best}]:[]);
    for(const r of rows){const li=document.createElement('li');li.textContent=`${r.n||'Anonymous'} · ${distance(r.s)}`;$('rows').append(li);}
    $('boardStatus').textContent=save.pendingRemove?'Sharing off · row removal unconfirmed. Retry when online.':boardRows===null?'Offline board · best on this device':rows.length?'Best distance · shared by choice':'No shared runs yet';
  }
  async function sendBest(){if(!save.sharing||!save.boardId||!save.name||save.best<=0)return;const epoch=boardEpoch;const rows=await boardCall({id:save.boardId,n:save.name,s:Math.min(save.best,1000000)});if(epoch!==boardEpoch)return;if(rows)boardRows=rows;if(screen==='board')boardDraw();}
  async function openBoard(){show('board');boardDraw();const epoch=boardEpoch;const rows=await boardCall();if(epoch!==boardEpoch)return;boardRows=rows;if(screen==='board')boardDraw();}
  $('toBoard').onclick=openBoard;$('endBoard').onclick=openBoard;$('boardBack').onclick=()=>show('menu');
  $('share').onclick=async()=>{
    if(boardBusy)return;
    if(!save.sharing&&!save.pendingRemove){const name=clean($('shareName').value);if(!name){$('boardStatus').textContent='Type a name first.';$('shareName').focus();return;}save.name=name;$('shareName').value=name;if(!save.best){$('boardStatus').textContent='Play once, then share your best.';return;}save.boardId=crypto.randomUUID();save.sharing=true;store();boardEpoch++;boardBusy=true;boardDraw();await sendBest();}
    else{const id=save.pendingRemove||save.boardId;save.sharing=false;save.boardId='';save.pendingRemove=id;boardEpoch++;store();boardBusy=true;boardDraw();const rows=await boardCall({id,remove:true});if(rows){boardRows=rows;save.pendingRemove='';store();}}
    boardBusy=false;boardDraw();
  };
  function tick(){
    const target=advanceControl(control);if(control.taps!==lastRepeat){lastRepeat=control.taps;pulse(control.side);}step(s,target);
    for(const e of s.events){
      if(['ember','graze','heart','shield','boost','slow','small','big','magnet','flare'].includes(e)){glow=1;burst(false,e==='shield');tone(e==='graze'?440:784,.2,.055);}
      if(['hurt','break','wisp'].includes(e)){shake=.6;burst(e!=='break',e==='break');snd.noise(.15,.08,1000);tone(160,.2);}
    }
    hud();if(s.over)finish();
  }
  window.lanternFPState=()=>({screen,playing,paused,stage:s.stage,target:control.target,x:s.x,y:s.y,t:s.t,over:s.over,seed:s.seed,taps:control.taps,best:save.best,opened:save.opened,webgl:true,sharing:save.sharing,progress:progress(s),score:score(s)});
  window.lanternFPSim=()=>s;
  window.lanternFPView=R;
  function frame(now){
    const dt=Math.min(.05,(now-last)/1000||0);last=now;
    if(playing&&!paused){acc+=dt*speed;while(acc>=DT&&playing){tick();acc-=DT;}}
    if(!paused){shake=Math.max(0,shake-dt*3);glow=Math.max(0,glow-dt*2);for(const p of sparks){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}sparks=sparks.filter(p=>p.life>0);}
    const dawn=Math.max(0,(progress(s)-.86)/.14),day=s.over==='dawn'?Math.min(1,(now-ended)/2200):0;
    R.draw(s,{now:paused?lastPauseTime:now,dt:paused?0:dt,target:control.target,shake,glow,sparks,dawn,day,playing,snap});snap=false;if(!paused)lastPauseTime=now;
    requestAnimationFrame(frame);
  }
  let lastPauseTime=0;show('menu');requestAnimationFrame(frame);
}
