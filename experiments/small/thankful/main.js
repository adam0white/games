import {LOOKS,ROWS,TRAY,ALIAS,localDay,validDay,load,count,counts,addStar,place,member,demo,celebration,species} from './sim.js';
import {hint} from '../../kit/hint.js';
import * as sky from './sky.js';import * as lamps from './lamps.js';import * as garden from './garden.js';
import {t,lang,setLang,apply} from './words.js';
import {readJson,writeJson} from '../../kit/save.js';import {sound} from '../../kit/audio.js';import {onLeave} from '../../kit/pause.js';import {noZoom} from '../../kit/zoom.js';import {screens} from '../../kit/screens.js';import {lab} from '../../kit/lab.js';import {home} from '../../kit/home.js';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),override=query.get('day'),isDemo=query.has('demo'),KEY='thankful:v1';
let today=validDay(override)?override:localDay(),state=isDemo?demo(today,Number(query.get('demo'))||0):load(readJson(KEY)),W=0,H=0,dpr=1,pan=0,drag=null,hits=[],flight=null,bloom=0,shoot=0,paused=false,card='',labelTimer,lookFade=0;
if(LOOKS.includes(query.get('look')))state.look=query.get('look');
// Variants (2026-11-26) for the owner to compare: a (default) adds today's dug bed with its seeds, the tray's invitation,
// a first-time hint, the flower's name and a burst of petals as it opens, butterflies for completed days and tomorrow's
// flowers; b is the page as it was before them.
const V=query.get('v')==='b'?'b':'a',extras=V==='a';let caption=null,petals=null,arrive=0,bedAt=null,flying=0;
let pad=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,renderers={sky,lamps,garden},cv=$('c'),g=cv.getContext('2d'),snd=sound({on:()=>state.sound,setup:ac=>{pad=ac.createGain();pad.gain.value=0;pad.connect(ac.destination);for(const f of [130.815,196]){const o=ac.createOscillator();o.frequency.value=f;o.connect(pad);o.start();}}}),cards=screens(['settingsCard','confirm','words']);
noZoom();
// Play recording for the game lab. One run is the day's thanks: it starts with the first thank given in this
// visit and ends 'won' with the third. Only the kind of each thanks is sent, never the typed words.
// Opened from the small games' home (?from=small): a way back on the settings card and under the tray, and a finished day reported there.
const rec=home(lab('thankful',{lang}),{back:['#settingsCard .card','#ritual'],lang});let running=false,opened=0;
rec.notice($('ritual'));rec.toggle($('settingsCard').firstElementChild);
function recGive(k,n){if(isDemo)return;if(!running){running=true;opened=n-1;rec.start({day:today===localDay()?'today':'set',look:state.look,already:n-1,lang:lang()});}rec.event('thanks',{kind:k,n,flower:species(today,k)});if(n===3){running=false;rec.event('daily-finished',{look:state.look});rec.end('won',{thanks:3,look:state.look,kinds:(state.days[today]||[]).map(i=>i.k),flowers:(state.days[today]||[]).map(i=>species(today,i.k))});}}

// Sound and motion for every action. Each kind has its own note (a pentatonic scale), so a day is a little chord.
const PENT=[0,2,4,7,9,12,14,16,19,21,24,26],note=k=>392*2**(PENT[Math.max(0,TRAY.indexOf(ALIAS[k]||k))]/12);
const sfx={
  tick:()=>snd.tone(660,.06,.025,'sine'),
  open:()=>{snd.tone(523.25,.18,.03,'sine');snd.tone(784,.22,.02,'sine');},
  close:()=>snd.tone(392,.14,.025,'sine',-60),
  look:()=>{snd.tone(587.33,.5,.035,'triangle');setTimeout(()=>snd.tone(880,.6,.025,'sine'),90);},
  flower:k=>snd.tone(note(k)*2,.45,.04,'triangle'),
  rustle:()=>snd.noise(.18,.05,2600),
  clear:()=>{snd.tone(330,.5,.04,'sine',-120);snd.noise(.3,.04,900);},
  share:()=>{for(const [i,f] of [523.25,659.25,783.99,1046.5].entries())setTimeout(()=>snd.tone(f,.5,.03,'sine'),i*70);},
};
function pulse(el){if(!el||reduced)return;el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse');}
for(const b of document.querySelectorAll('button'))b.addEventListener('pointerdown',()=>pulse(b));

// The tray: each button shows the flower that kind grows today, which is the same for everyone that day.
const kindName=k=>t(ALIAS[k]||k);
for(const k of TRAY){const b=document.createElement('button');b.dataset.kind=k;b.innerHTML='<canvas width="64" height="64" aria-hidden="true"></canvas><span></span>';b.onclick=()=>{launchFrom=b.getBoundingClientRect();if(k==='spark'){sfx.open();return show('words');}return give(k);};$('tray').append(b);}
function drawTray(){for(const b of $('tray').children){const k=b.dataset.kind,c=b.querySelector('canvas'),x=c.getContext('2d');x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,64,64);garden.flower(x,species(today,k),32,32,64,0,1.3);b.querySelector('span').textContent=kindName(k);b.setAttribute('aria-label',`${kindName(k)}: ${t(species(today,k))}`);}}
const lookButton=document.createElement('button');lookButton.id='look';lookButton.onclick=()=>{state.look=LOOKS[(LOOKS.indexOf(state.look)+1)%LOOKS.length];lookFade=performance.now();sfx.look();persist();update();};$('looks').append(lookButton);
let launchFrom=null;
const NAME={sky:'Sky',lamps:'Lamps',garden:'Garden'};
if(extras&&!isDemo)hint($('tray'),{kind:'tap',key:'thankful:hint',when:()=>!card&&count(state,today)===0,played:Object.keys(state.days).length>0,delay:3500,bottom:()=>{const r=$('tray').getBoundingClientRect();return Math.max(60,innerHeight-r.top-r.height*.3);}});
function persist(){if(!isDemo&&!writeJson(KEY,state))$('status').textContent=t('noSave');}
function show(name=''){card=name;cards(name);if(name==='words')setTimeout(()=>$('word').focus(),50);}
// Tomorrow's flowers for the kinds given today: a reason to come back, drawn small under the finished day.
const nextDay=day=>{const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()+1);return localDay(d);};
function drawTomorrow(on){const T=$('tomorrow');T.hidden=!on;if(!on)return;const next=nextDay(today),kinds=[...new Set((state.days[today]||[]).map(i=>ALIAS[i.k]||i.k))];T.querySelector('b').textContent=t('tomorrow');const row=T.querySelector('span');row.textContent='';for(const k of kinds){const f=species(next,k),el=document.createElement('i'),c=document.createElement('canvas');c.width=c.height=56;garden.flower(c.getContext('2d'),f,28,28,56,0,1.3);el.append(c,document.createTextNode(t(f)));el.title=kindName(k);row.append(el);}}
function update(){const done=count(state,today)===3,L=NAME[state.look];apply();$('line').textContent=done?t('done'+L):t('line');const n=counts(state);const fresh=extras&&!isDemo&&Object.keys(state.days).length===0;$('info').textContent=done?(n.days===1&&n.lights===3?t('info1'):t('info',{n:n.days,f:n.lights})):fresh?t('firstTap'):'';$('tray').classList.toggle('invite',extras&&count(state,today)===0);drawTomorrow(done&&extras);$('name').textContent=t('name'+L);document.title=t('name'+L);$('ritual').classList.toggle('done',done);$('picture').hidden=!done;for(const b of $('tray').children)b.disabled=done;lookButton.textContent=t('look'+L);lookButton.setAttribute('aria-label',t('changeLook',{look:t('look'+L)}));$('sound').textContent=state.sound?t('soundOn'):t('soundOff');$('word').placeholder=t('fewWords');$('lang').lang=lang()==='tr'?'en':'tr';drawTray();}
function refreshDay(){const day=validDay(override)?override:localDay();if(day!==today){today=day;pan=0;update();}}
function give(k,text=''){refreshDay();if(!addStar(state,today,k,text))return false;const ac=snd.unlock();if(ac&&pad)pad.gain.setTargetAtTime(.006,ac.currentTime,2);const n=count(state,today);if(!reduced)flight={start:performance.now(),index:n-1,x:launchFrom?launchFrom.x+launchFrom.width/2:W*.5,y:launchFrom?launchFrom.y:H*.8};snd.tone([261.63,329.63,392][n-1],1.5,.055,'sine');snd.tone(note(k),.9,.025,'triangle');recGive(k,n);if(extras){caption={start:performance.now()+(reduced?0:1000),index:n-1,k};try{navigator.vibrate?.(n===3?[16,70,28]:12);}catch{}}if(n===3){bloom=performance.now();if(extras)arrive=performance.now()+1200;if(celebration(state))shoot=performance.now();}pan=0;persist();update();return true;}
$('settings').onclick=()=>{sfx.open();show('settingsCard');};for(const b of document.querySelectorAll('.close'))b.onclick=()=>{sfx.close();show();};$('sound').onclick=()=>{state.sound=!state.sound;persist();update();if(state.sound){snd.release();snd.unlock();sfx.open();}else snd.hold();};$('reset').onclick=()=>{sfx.close();show('confirm');};$('clear').onclick=()=>{sfx.clear();state=load(null);snd.release();persist();pan=0;show();update();};$('wordForm').onsubmit=e=>{e.preventDefault();give('spark',$('word').value);$('word').value='';show();};
$('lang').onclick=()=>{setLang(lang()==='tr'?'en':'tr');sfx.tick();update();};
onLeave(()=>{paused=true;snd.hold();drag=null;});document.addEventListener('visibilitychange',()=>{if(!document.hidden){paused=false;snd.release();refreshDay();}});addEventListener('focus',()=>{paused=false;snd.release();refreshDay();});
// Where the words begin: the garden stops above them, so no flower stands behind the text.
let lineTop=0;function measure(){lineTop=$('line').getBoundingClientRect().top;}
function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(2,devicePixelRatio||1);cv.width=W*dpr;cv.height=H*dpr;measure();}addEventListener('resize',resize);resize();
const COL=66,days=()=>[...new Set([...Object.keys(state.days),today])].sort();
const lastCol=()=>Math.floor((days().length-1)/ROWS);
// A young garden is drawn larger and in the middle; from about four columns on it is the full field, anchored right.
const zoomFor=w=>Math.max(1,Math.min(2.1,(w-92)/((lastCol()+1)*COL)));
// With more than one day, a column holds several days one above another: grow them only as far as the rows allow,
// so a day's flowers (two radii plus a head, 20 px at zoom 1) never reach into the next day's.
const rowCap=(z,bandH)=>days().length<2?z:Math.max(1,Math.min(z,bandH*.9/(ROWS+.5)*.95/(2*Math.min(17,bandH/ROWS*.3)+20)));
function band(h,bottom){const top=(state.look==='sky'?84:128);return {top,bottom:Math.max(top+150,bottom)};}
let zoom=zoomFor(innerWidth),bottomNow=0;
const maxPan=()=>Math.max(0,lastCol()*COL*zoom-W+92);
function points(day,i,time,bd,w,offset,z,items=state.days[day]||[]){const q=place(i),lc=lastCol(),col=COL*z,radius=Math.min(17,(bd.bottom-bd.top)/ROWS*.3)*z,anchor=Math.min(w-46,w/2+lc*col/2),cx=anchor+(q.x-lc-.5)*col+offset,cy=bd.top+q.y*(bd.bottom-bd.top),drift=reduced?0:Math.sin(time/2600+i)*2;return items.map((item,n)=>{const p=member(day,n);return {...p,x:cx+p.dx*radius,y:cy+p.dy*radius+drift,cx,cy,item,day,k:item.k,species:species(day,item.k),index:n,radius};});}
function scene(ctx,w,h,offset,time,bottom,z,animate=false){const r=renderers[state.look],bd=band(h,bottom),t=reduced?0:time;r.background(ctx,w,h,t,bd,offset);const found=[],all=days();let mine=null;const garden_=extras&&state.look==='garden',left=3-count(state,today);if(animate){bedAt=null;flying=0;}
if(garden_&&left>0){const i=all.indexOf(today),full=points(today,i,t,bd,w,offset,z,[{k:'spark'},{k:'spark'},{k:'spark'}]);const p0=full[0],depth=p0?.82+.36*(p0.cy-bd.top)/Math.max(1,bd.bottom-bd.top):1,root=p0&&{x:full.reduce((n,p)=>n+p.x,0)/3,y:Math.max(...full.map(p=>p.y))+p0.radius*1.05*depth};
// Only where it is clear of the words below the garden (a short screen leaves the garden little room).
if(root&&p0.cx>-60&&p0.cx<w+60&&(!animate||root.y<lineTop-p0.radius*.6)){garden.bed(ctx,root,left,t,p0.radius,z,reduced||!animate);if(animate)bedAt={...root,seeds:left};}}
for(let i=0;i<all.length;i++){const day=all[i],ps=points(day,i,t,bd,w,offset,z);if(!ps.length||ps[0].cx< -60||ps[0].cx>w+60)continue;const shown=animate&&flight&&day===today?ps.filter(p=>p.index!==flight.index):ps;if(day===today)mine=ps;if(shown.length)r.cluster(ctx,shown,t,{today:day===today,band:bd,radius:ps[0].radius,zoom:z});found.push(...shown);}
if(garden_&&animate)flying=found.length?Math.min(7,counts(state).complete):0;if(garden_)garden.visitors(ctx,Math.min(7,counts(state).complete),t,found,w,h,animate&&!reduced?arrive:0,reduced||!animate,z);
return {found,mine};}
function draw(time){requestAnimationFrame(draw);if(paused)return;g.setTransform(dpr,0,0,dpr,0,0);measure();
const foot=state.look==='garden'?44:26,room=(lineTop-8-band(H,0).top-150)/foot,zt0=Math.max(1,Math.min(zoomFor(W),room)),zt=rowCap(zt0,lineTop-foot*zt0-8-band(H,0).top);zoom+=(zt-zoom)*(reduced?1:.05);const target=lineTop-foot*zoom-8;bottomNow=bottomNow?bottomNow+(target-bottomNow)*(reduced?1:.05):target;
const result=scene(g,W,H,pan,time,bottomNow,zoom,true),mine=result.mine;hits=result.found;
if(lookFade&&!reduced){const u=Math.max(0,(time-lookFade)/600);if(u>1)lookFade=0;else{g.fillStyle=`rgba(7,21,40,${1-u})`;g.fillRect(0,0,W,H);}}
if(flight){const u=(time-flight.start)/1100;const p=mine&&mine[flight.index];if(u>1&&p&&extras&&state.look==='garden'){const sp=garden.SPECIES[p.species]||garden.SPECIES.starflower;petals={start:time,x:p.x,y:p.y,hue:sp[1],z:Math.sqrt(zoom)};}if(u>1||!p)flight=null;else{const e=1-(1-u)**3,x=flight.x+(p.x-flight.x)*e,y=flight.y+(p.y-flight.y)*e-Math.sin(u*Math.PI)*40;g.globalCompositeOperation='lighter';for(let k=0;k<9;k++){const v=Math.max(0,u-k*.025),ev=1-(1-v)**3;g.fillStyle=`rgba(255,238,190,${.5-k*.05})`;g.beginPath();g.arc(flight.x+(p.x-flight.x)*ev,flight.y+(p.y-flight.y)*ev-Math.sin(v*Math.PI)*40,4-k*.35,0,7);g.fill();}g.globalCompositeOperation='source-over';}}
if(bloom&&mine&&mine[0]){const u=(time-bloom)/2400;if(u>1)bloom=0;else{const c=mine[0];g.globalCompositeOperation='lighter';const R=reduced?90:40+u*Math.max(W,H)*.7,gr=g.createRadialGradient(c.cx,c.cy,R*.55,c.cx,c.cy,R);gr.addColorStop(0,'rgba(255,232,180,0)');gr.addColorStop(.8,`rgba(255,232,180,${(1-u)*.22})`);gr.addColorStop(1,'rgba(255,232,180,0)');g.fillStyle=gr;g.beginPath();g.arc(c.cx,c.cy,R,0,7);g.fill();g.globalCompositeOperation='source-over';}}
if(shoot&&!reduced){const u=(time-shoot-900)/1300;if(u>1)shoot=0;else if(u>0){const x=W*(.05+u*.9),y=H*(.08+u*.14),gr=g.createLinearGradient(x-90,y-22,x,y);gr.addColorStop(0,'rgba(255,240,200,0)');gr.addColorStop(1,'rgba(255,240,200,.9)');g.strokeStyle=gr;g.lineWidth=2;g.beginPath();g.moveTo(x-90,y-22);g.lineTo(x,y);g.stroke();}}
if(petals&&!reduced&&!garden.burst(g,petals,time))petals=null;
if(caption&&mine&&mine[caption.index]){const u=(time-caption.start)/1000,p=mine[caption.index];if(u>3.2)caption=null;else if(u>0){const a=Math.min(1,u/.3)*Math.min(1,(3.2-u)/.6),x=Math.max(70,Math.min(W-70,p.x)),y=p.y-24*Math.sqrt(zoom)-14-(reduced?0:u*6);g.textAlign='center';g.fillStyle=`rgba(255,246,222,${a})`;g.font='italic 16px Georgia, serif';g.fillText(t(p.species),x,y);g.font='12px system-ui, sans-serif';g.fillStyle=`rgba(255,246,222,${a*.7})`;g.fillText(p.item.t||kindName(p.k),x,y+16);}}
$('older').style.visibility=maxPan()>0&&!flight?'visible':'hidden';
}
const fmt=day=>new Date(`${day}T12:00:00`).toLocaleDateString(lang()==='tr'?'tr-TR':'en-GB',{weekday:'short',day:'numeric',month:'short'}).replaceAll(',','');
function countLine(n){return n.lights===1?t('countOne'):n.days===1?t('count1',{n:n.lights}):t('count',{n:n.lights,d:n.days});}
// The picture to keep or share: the garden as it is, and below it today's three flowers by name, which are
// the same flowers everyone could grow today.
function pictureBlob(){return new Promise((resolve,reject)=>{try{const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');ctx.scale(2.5,2.5);
const z0=Math.max(1,Math.min(2.1,(432-92)/((lastCol()+1)*COL))),top=band(540,0).top,pb=z=>Math.min(350,410-65*z),z=rowCap(z0,pb(z0)-top);scene(ctx,432,540,0,0,pb(z),z);
const fade=ctx.createLinearGradient(0,350,0,420);fade.addColorStop(0,'rgba(8,20,26,0)');fade.addColorStop(1,'rgba(8,20,26,.92)');ctx.fillStyle=fade;ctx.fillRect(0,350,432,190);
const n=counts(state),items=state.days[today]||[];ctx.textAlign='center';ctx.fillStyle='rgba(255,248,230,.95)';ctx.font='500 13px system-ui, sans-serif';ctx.fillText(t('name'+NAME[state.look]).toLocaleUpperCase(lang()),216,402);
ctx.font='11px system-ui, sans-serif';ctx.fillStyle='rgba(255,248,230,.7)';ctx.fillText(`${fmt(today)} · ${t('dayN',{n:n.days})}`,216,420);
items.forEach((item,i)=>{const x=216+(i-1)*118;ctx.fillStyle='rgba(255,255,255,.06)';ctx.beginPath();ctx.arc(x,458,26,0,7);ctx.fill();garden.flower(ctx,species(today,item.k),x,458,46,0,1.3);ctx.fillStyle='rgba(255,248,230,.9)';ctx.font='11px system-ui, sans-serif';ctx.fillText(item.t||t(species(today,item.k)),x,500);ctx.fillStyle='rgba(255,248,230,.55)';ctx.font='9px system-ui, sans-serif';ctx.fillText(item.t?t(species(today,item.k)):kindName(item.k),x,513);});
ctx.fillStyle='rgba(255,248,230,.6)';ctx.font='10px system-ui, sans-serif';ctx.fillText(countLine(n),216,532);
canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Picture unavailable')),'image/png');}catch(error){reject(error);}});}
async function picture(){const blob=await pictureBlob();return {width:1080,height:1350,bytes:blob.size};}
$('picture').onclick=async()=>{sfx.share();try{const blob=await pictureBlob();let file,canShare=false;try{file=new File([blob],'thankful.png',{type:'image/png'});canShare=!!(navigator.canShare&&navigator.share&&navigator.canShare({files:[file]}));}catch{}if(canShare){await navigator.share({files:[file]});return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='thankful.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{}};
function label(p){const L=$('label');L.textContent='';const c=document.createElement('canvas');c.width=c.height=88;garden.flower(c.getContext('2d'),p.species,44,44,88,0,1.3);const date=document.createElement('p');date.textContent=fmt(p.day);const text=document.createElement('p');text.textContent=p.item.t||(p.item.k==='spark'?t('sparkLabel'):kindName(p.item.k));const fl=document.createElement('p');fl.className='flower';fl.textContent=t(p.species);L.append(c,date,text,fl);L.hidden=false;pulse(L);clearTimeout(labelTimer);labelTimer=setTimeout(()=>L.hidden=true,5000);}
cv.onpointerdown=e=>{refreshDay();$('label').hidden=true;drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan,moved:false};cv.setPointerCapture(e.pointerId);};cv.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;const delta=e.clientX-drag.x;if(Math.abs(delta)>7)drag.moved=true;pan=Math.max(0,Math.min(maxPan(),drag.pan+delta));};cv.onpointerup=e=>{if(!drag)return;if(drag.moved)sfx.rustle();else{const p=[...hits].sort((a,b)=>Math.hypot(a.x-e.clientX,a.y-e.clientY)-Math.hypot(b.x-e.clientX,b.y-e.clientY)).find(p=>Math.hypot(p.x-e.clientX,p.y-e.clientY)<26*Math.max(1,zoom*.8));if(p){label(p);sfx.flower(p.k);garden.poke(p.day,p.index,performance.now());}}drag=null;};cv.onpointercancel=()=>drag=null;
window.__thankful={picture,get state(){return state;},give,get today(){return today;},get look(){return state.look;},get lights(){return hits;},get zoom(){return zoom;},get variant(){return V;},get bed(){return bedAt;},get visitors(){return flying;},get lineTop(){return lineTop;},get bottom(){return bottomNow;}};$('demo').hidden=!isDemo;update();requestAnimationFrame(draw);

addEventListener('pointerdown',()=>{const ac=snd.unlock();if(ac&&pad)pad.gain.setTargetAtTime(.006,ac.currentTime,2);},{once:true});

addEventListener('keydown',e=>{if(e.key==='Escape'&&card){show();$('settings').focus();}});
