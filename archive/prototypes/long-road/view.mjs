import {create, step, DT} from './sim.mjs';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
let state = create(Math.floor(Math.random() * 1e9));
let started = false, selected = -1, menu = '', wheelArmed = false, hover = null;
let elapsed = 0, last = 0, acc = 0, regions = [], sound = null, nextStep = 0;
let W = 0, H = 0, scale = 1, ox = 0, oy = 0;
// The journey runs a little faster than the simulation clock: first players found it slow.
const SPEED = Number(new URLSearchParams(globalThis.location?.search || '').get('speed')) || 1.3;
// Plain words for everything the player can ask for or set.
const TASK = {mend:'fix cart', scout:'look ahead', carry:'help sick', watch:'guard', forage:'find food'};
const SKILL = {mender:'fixing', scout:'looking ahead', carrier:'carrying', watcher:'guarding', forager:'finding food'};
const PACE = ['slow','steady','fast'], MEALS = ['small','normal','big'];
// Messages: every event and every choice says what happened and what it means. One at a time, newest last.
let messages = [], messageSince = 0;
function tell(str){ if(messages.at(-1)===str)return; messages.push(str); if(messages.length>4)messages.splice(1,messages.length-4); if(messages.length===1)messageSince=elapsed; }
function wrap(str,max=46){const lines=[];let cur='';for(const w of str.split(' ')){if(cur&&(cur+' '+w).length>max){lines.push(cur);cur=w;}else cur=cur?cur+' '+w:w;}if(cur)lines.push(cur);return lines;}
const CW = 600, CH = 900;
const palette = ['#ca805c','#d4ac75','#7e9a8f','#b67769','#d1bc93'];

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  scale = Math.min(W / CW, H / CH); ox = (W - CW * scale) / 2; oy = (H - CH * scale) / 2;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
}
addEventListener('resize', resize); resize();
function poly(points, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(...points[0]); for (const p of points.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); }
function circle(x,y,r,fill) {ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function line(points,color,width=1) {ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.stroke();}
function box(x,y,w,h,r,fill,stroke) {ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function text(str,x,y,size=16,color='#fff1ce',align='center',font='Georgia') {ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`${size}px ${font}`;ctx.fillText(str,x,y);}
function region(x,y,w,h,fn,label) {regions.push({x,y,w,h,fn,label});}
function audioStart(){
  if(sound)return; try {const ac=new (window.AudioContext||window.webkitAudioContext)();const master=ac.createGain();master.gain.value=.18;master.connect(ac.destination);const buffer=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const wind=ac.createBufferSource(),filter=ac.createBiquadFilter(),windGain=ac.createGain();wind.buffer=buffer;wind.loop=true;filter.type='lowpass';filter.frequency.value=480;windGain.gain.value=.012;wind.connect(filter);filter.connect(windGain);windGain.connect(master);wind.start();sound={ac,master,windGain};}catch{}
}
function tone(freq=300,dur=.12,type='sine',vol=.12,slide=0){if(!sound)return;const {ac,master}=sound;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,ac.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),ac.currentTime+dur);g.gain.setValueAtTime(.001,ac.currentTime);g.gain.exponentialRampToValueAtTime(vol,ac.currentTime+.012);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g);g.connect(master);o.start();o.stop(ac.currentTime+dur+.02);}
function begin(){if(!started){started=true;audioStart();tone(210,.3,'sine',.05,80);}if(sound?.ac.state==='suspended')sound.ac.resume();}
function action(a){if(state.over)return; step(state,a); effects();if(a.type==='route')tone(330,.1,'sine',.06,80);if(a.type==='pace')tell(['Slow pace. Easy on everyone, but more days on the road.','Steady pace.','Fast pace. Fewer days, but people tire and the cart wears.'][a.value]);if(a.type==='rations')tell(['Small meals. Food lasts longer, but people grow weak.','Normal meals.','Big meals. People recover, but food runs out sooner.'][a.value]);if(a.type==='route')tell(a.value==='rough'?'Short, rough road next. Quicker, but hard on the cart.':'Long, gentle road next. Slower, but easy on the cart.');}
function effects(){for(const e of state.events||[]){
  const who=state.people[e.person]?.name, left=Math.max(0,Math.ceil(state.snowDay-state.day));
  if(e.type==='crack')tell(state.opening?'A wheel cracked. Tap Tavi to ask for a repair.':'The cart broke down. Tap someone to fix it.');
  else if(e.type==='refuse')tell(`${who} said no: ${String(e.text).toLowerCase()}. Ask someone else.`);
  else if(e.type==='agree')tell(`${who} said yes.`);
  else if(e.type==='mended')tell(`${who} fixed the cart. On you go.`);
  else if(e.type==='forage')tell(`${who} found ${e.text} food.`);
  else if(e.type==='scouted')tell(`${who} found a better path. Less wear on the cart.`);
  else if(e.type==='carried')tell(e.text?`${who} carried ${e.text}'s load. ${e.text} feels better.`:`${who} carried the load.`);
  else if(e.type==='watched')tell(`${who} is on guard. Thieves will stay away at the next stop.`);
  else if(e.type==='theft')tell('Thieves took 9 food in the night. A guard would have stopped them.');
  else if(e.type==='sick')tell(`${who} fell ill. Big meals, a slow pace or help carrying will mend it.`);
  else if(e.type==='tired')tell(`${who} is worn out and may refuse work. Slow down, or wait for a stop.`);
  else if(e.type==='low')tell('Food is running low. Ask someone to find food.');
  else if(e.type==='starve')tell('The food is gone. People are getting weak.');
  else if(e.type==='snow')tell(`Snow in ${e.text} days. ${12-state.stop} stops to go.`);
  else if(e.type==='leave')tell(`${who} has left the party.`);
  else if(e.type==='stop'&&!state.over)tell(`Stop ${state.stop} of 12. Everyone rests. ${left} days until snow.`);
if(e.type==='crack') {tone(85,.3,'sawtooth',.17,-45);tone(620,.1,'triangle',.07,-400);} else if(e.type==='mended') {tone(410,.18,'sine',.1,120);setTimeout(()=>tone(590,.3,'sine',.08,100),90);}else if(e.type==='refuse')tone(180,.19,'triangle',.07,-40);else if(e.type==='agree'||e.type==='forage')tone(440,.15,'sine',.07,90);else if(e.type==='creak'){tone(105,.22,'sawtooth',.035,30);}else if(e.type==='stop'){tone(330,.18,'sine',.06,40);setTimeout(()=>tone(440,.2,'sine',.06,30),140);setTimeout(()=>tone(550,.35,'sine',.05,30),280);}else if(e.type==='leave'||e.type==='end')tone(175,.7,'sine',.1,-60);}}
function reset(){messages=[];state=create(Math.floor(Math.random()*1e9));selected=-1;menu='';wheelArmed=false;acc=0;started=true;tone(240,.3,'sine',.08,100);}
function choosePerson(i){if(state.people[i]?.left)return;if(state.opening&&!state.minds.openingAsked&&i!==0)return; selected=i; if(state.broken && (wheelArmed || state.opening)){action({type:'ask',person:i,task:'mend'});wheelArmed=false;menu='';}else menu='task';tone(360,.09,'sine',.05,35);}
function task(t){if(selected<0)return;action({type:'ask',person:selected,task:t});menu='';selected=-1;}
function wheel(){if(!state.broken)return;menu='';selected=-1;if(state.opening&&!state.minds.openingAsked){action({type:'ask',person:0,task:'mend'});wheelArmed=false;}else wheelArmed=true;tone(280,.12,'triangle',.06);}
function pointer(e){e.preventDefault();canvas.style.outline='none';canvas.focus();begin();let r=canvas.getBoundingClientRect(), x=(e.clientX-r.left-ox)/scale,y=(e.clientY-r.top-oy)/scale;for(let i=regions.length-1;i>=0;i--){const a=regions[i];if(x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.h){a.fn();return;}}if(menu){menu='';selected=-1;}}
canvas.addEventListener('pointerdown',pointer);
// iOS Safari may refuse to start audio on touch-down; try again when the finger lifts.
for(const type of ['pointerup','touchend','click'])addEventListener(type,()=>{if(sound?.ac.state==='suspended')sound.ac.resume();});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-ox)/scale,y=(e.clientY-r.top-oy)/scale;hover=regions.findLast?.(a=>x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.h)||null;canvas.style.cursor=hover?'pointer':'default';});
window.addEventListener('keydown',e=>{canvas.style.outline='';const k=e.key.toLowerCase();if([' ','arrowleft','arrowright','arrowup','arrowdown'].includes(k))e.preventDefault();begin();if(state.over){if(k==='enter'||k===' ')reset();return;}if(k>='1'&&k<='5')choosePerson(+k-1);else if(k==='m')task('mend');else if(k==='s')task('scout');else if(k==='c')task('carry');else if(k==='w')task('watch');else if(k==='f')task('forage');else if(k==='p')action({type:'pace',value:(state.pace+1)%3});else if(k==='r')action({type:'rations',value:(state.rations+1)%3});else if(k==='arrowleft'&&state.phase==='stop')action({type:'route',value:'rough'});else if(k==='arrowright'&&state.phase==='stop')action({type:'route',value:'gentle'});else if(k==='escape'){menu='';selected=-1;} });

function mountainLayer(base, amp, color, shift, detail=0){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-40,base+100);for(let x=-40;x<=640;x+=10){let z=x+shift;let y=base-Math.abs(Math.sin(z*.008)+.42*Math.sin(z*.019+1.8))*amp-detail*Math.sin(z*.043);ctx.lineTo(x,y);}ctx.lineTo(640,base+120);ctx.closePath();ctx.fill();}
function pine(x,y,h,col){poly([[x,y-h],[x-h*.22,y-h*.45],[x-h*.12,y-h*.46],[x-h*.3,y],[x+h*.3,y],[x+h*.12,y-h*.46],[x+h*.22,y-h*.45]],col);line([[x,y-4],[x,y+8]],col,4);}
function landscape(t){
  const late=Math.min(1,Math.max(0,(state.day||0)/30));const cycle=(elapsed/75)%1;const night=(1-Math.cos(cycle*Math.PI*2))/2;
  let g=ctx.createLinearGradient(0,0,0,650);g.addColorStop(0,night>.5?'#192e48':'#315263');g.addColorStop(.53,night>.5?'#5a6174':'#cf9a7b');g.addColorStop(1,'#e8bc83');ctx.fillStyle=g;ctx.fillRect(0,0,CW,CH);
  const orbY=235-90*Math.sin(cycle*Math.PI);if(night<.55){circle(432,orbY,56,'#f2c48866');circle(432,orbY,39,'#f8d5a0');}else{circle(432,orbY,27,'#e4e7d8');circle(443,orbY-8,25,'#42566b');}
  ctx.globalAlpha=.18;for(let i=0;i<5;i++){let x=((i*173+t*1.2)%780)-100;box(x,110+i*43,160,3,3,'#f7d8b1');}ctx.globalAlpha=1;
  const shift=started?(state.stop*140+state.progress*140)*.22:elapsed*4;
  mountainLayer(475,132,'#9b9b9a',shift*.3,5);
  mountainLayer(523,110,'#71858a',shift*.65,9);
  mountainLayer(555,86,'#526e72',shift,10);
  ctx.globalAlpha=.45;for(let i=0;i<15;i++){let x=((i*71-shift*1.1)%800+800)%800-100;pine(x,550+Math.sin(i)*13,36+(i%3)*13,'#304f51');}ctx.globalAlpha=1;
  poly([[0,550],[88,520],[192,546],[293,516],[393,539],[495,514],[600,540],[600,900],[0,900]],'#506860');
  poly([[0,629],[100,594],[204,614],[312,588],[436,611],[600,579],[600,900],[0,900]],'#637360');
  poly([[0,701],[101,671],[232,683],[385,649],[600,672],[600,900],[0,900]],'#b59b78');
  poly([[0,761],[146,730],[280,739],[425,708],[600,721],[600,900],[0,900]],'#806e59');
  line([[0,783],[150,753],[290,760],[441,729],[600,744]],'#d2b28a',2);
  for(let i=0;i<28;i++){let x=((i*83-(state.stop*140+state.progress*140)*1.9)%710+710)%710-40;let y=780+(i*37)%130;line([[x,y],[x+10+(i%4)*4,y-2]],i%2?'#a68b6e':'#6f6755',1.4);}
  for(let i=0;i<9;i++){let x=((i*113-shift*2)%760+760)%760-80;let y=696+(i%3)*24;line([[x,y],[x+1,y-15]],'#4e6654',1.3);line([[x+1,y-7],[x-5,y-13]],'#4e6654',1);}
  if(state.weather>.62){ctx.globalAlpha=.3;for(let i=0;i<6;i++){let x=((i*150+t*(6+state.weather*8))%800)-100;box(x,155+i%3*34,125,12,8,'#425b64');}ctx.globalAlpha=1;for(let i=0;i<55;i++){let x=((i*101+t*90)%680)-40,y=((i*71+t*180)%760);line([[x,y],[x-5,y+12]],'#dce7df88',1);}}
  if(late>.62){ctx.globalAlpha=(late-.62)*1.2;for(let i=0;i<70;i++){let x=((i*89+t*(12+i%5))%650)-25,y=((i*67+t*(23+i%7))%800);circle(x,y,1+i%2,'#f5eee0');}ctx.globalAlpha=1;}
  const vignette=ctx.createRadialGradient(300,430,180,300,430,650);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#142d3838');ctx.fillStyle=vignette;ctx.fillRect(0,0,600,900);
}
function cart(t){
  let x=302,y=625,tilt=state.broken?.12:0;
  ctx.save();ctx.translate(x,y);ctx.rotate(tilt);
  // Shadow and drawbars.
  ctx.fillStyle='#283f3a55';ctx.beginPath();ctx.ellipse(5,91,133,17,-.03,0,7);ctx.fill();
  line([[-102,42],[-156,72]],'#604437',8);line([[-99,53],[-156,83]],'#c29a68',3);
  poly([[-94,-1],[92,-1],[80,60],[-80,60]],'#84573d');
  poly([[-87,8],[83,8],[77,48],[-78,48]],'#bc855a');
  for(let i=0;i<7;i++)line([[-75+i*25,10],[-71+i*23,48]],'#8f6047',1.5);
  line([[-93,0],[93,0]],'#e3b782',5);line([[-85,55],[84,55]],'#604235',6);
  // Canvas cover, stitched seams and parcels.
  ctx.fillStyle='#d9bc8e';ctx.beginPath();ctx.moveTo(-83,-4);ctx.quadraticCurveTo(-76,-74,-5,-79);ctx.quadraticCurveTo(71,-75,84,-4);ctx.closePath();ctx.fill();
  ctx.fillStyle='#b99a75';ctx.beginPath();ctx.moveTo(7,-77);ctx.quadraticCurveTo(64,-73,84,-4);ctx.lineTo(41,-4);ctx.quadraticCurveTo(35,-57,7,-77);ctx.fill();
  line([[-83,-4],[-77,-31],[-58,-58],[-31,-72],[-5,-77]],'#f1d4a5',2);
  line([[-25,-72],[-20,-36],[-18,-4]],'#ab8b6b',1.5);line([[31,-69],[41,-34],[43,-4]],'#9c8064',1.5);
  box(-69,-18,36,15,3,'#806e58');line([[-57,-17],[-57,-4]],'#e0bc83',2);
  // Lantern glow.
  const glow=ctx.createRadialGradient(73,25,2,73,25,62);glow.addColorStop(0,'#ffd38a99');glow.addColorStop(1,'#ffcf7700');ctx.fillStyle=glow;ctx.fillRect(11,-37,124,124);
  box(68,8,13,20,2,'#493d32');box(71,12,7,11,1,'#ffd47f');line([[74,3],[74,8]],'#5c4736',2);
  let wx=-46,wy=66;circle(wx,wy,33,'#4c382e');circle(wx,wy,27,'#bd8c5d');circle(wx,wy,22,'#574236');ctx.save();ctx.translate(wx,wy);ctx.rotate(state.broken?.35:(state.phase==='stop'?0:-t*2.2));for(let a=0;a<8;a++){let q=a*Math.PI/4;line([[0,0],[Math.cos(q)*22,Math.sin(q)*22]],'#d0a372',3);}circle(0,0,5,'#e6bd82');ctx.restore();
  if(state.broken){line([[-67,50],[-57,57],[-61,65],[-49,70],[-54,79]],'#eee0b9',2);line([[-76,80],[-86,87]],'#d6b68a',3);}
  ctx.restore();
  region(x-88,y+35,83,92,wheel,'wheel');
  return {x:x-46,y:y+65};
}
function person(i,x,y,t){
  const p=state.people[i];if(!p||p.left)return;
  const fatigue=Math.min(1,p.fatigue||0), health=Math.max(0,Math.min(1,p.health??1)), moving=(!started||(!state.broken&&state.phase==='travel'&&!state.over))&&!p.job;
  const walk=moving?Math.sin(t*(6.1+i*.35)+i*.9)*(1-(1-health)*.45):0;
  ctx.save();ctx.translate(x,y);ctx.rotate(fatigue*.13+(1-health)*.22);
  ctx.fillStyle='#263c3555';ctx.beginPath();ctx.ellipse(0,47,25,7,0,0,7);ctx.fill();
  const legs=walk*(7+i*.8); line([[-5,15],[-8+legs,42]],'#3c4540',7);line([[6,15],[7-legs,42]],'#3b4140',7);
  line([[-8+legs,42],[-14+legs,44]],'#332f2b',5);line([[7-legs,42],[13-legs,44]],'#332f2b',5);
  poly([[-13,-22],[8,-25],[17,12],[6,23],[-14,18],[-20,2]],palette[i]);
  poly([[-13,-22],[-19,-5],[-14,18],[-7,17],[-7,-19]],'#344e4b55');
  line([[8,-18],[17,-1],[13+walk*3,12]],'#d5ab84',5);line([[-13,-17],[-20,-1],[-17-walk*3,9]],'#d5ab84',5);
  circle(-2,-32,10,'#d0a27c');poly([[-12,-34],[-9,-43],[0,-47],[8,-42],[10,-34],[3,-38],[-6,-38]],i===1?'#d1c1a5':'#3e3c38');
  if(i===0){poly([[-13,-39],[-7,-49],[7,-48],[12,-39]],'#745541');line([[-15,-38],[13,-38]],'#52463c',3);}
  if(i===2){box(-20,-19,10,19,3,'#74543e');}
  if(i===3){line([[-8,-22],[8,-19]],'#e6c18b',3);}
  if(i===4){poly([[-12,-39],[-7,-47],[4,-49],[10,-38]],'#b4a27f');}
  if(p.job){ctx.strokeStyle='#f9d591';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,-15,37,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,1-(p.jobUntil-state.t)/({mend:11,scout:13,carry:12,watch:14,forage:15}[p.job]||15))));ctx.stroke();icon(p.job,0,-68,'#fff0c9');}
  if(state.opening&&!state.minds.openingAsked&&i===0){ctx.strokeStyle='#f8d18c';ctx.globalAlpha=.6+.3*Math.sin(t*4);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-15,39,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  if(selected===i){ctx.strokeStyle='#f7d594';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-15,37,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
  region(x-36,y-60,72,110,()=>choosePerson(i),`person ${i+1}`);
  if(started && p.speech && p.speechUntil>state.t && i===state.people.findIndex(q=>q.speech && q.speechUntil>state.t)){let words=String(p.speech).split(/\s+/).slice(0,4).join(' ');const bx=Math.max(100,Math.min(500,x));box(bx-95,y-105,190,42,12,'#263b3aee','#e9c595aa');text(words,bx,y-84,24);}
}
function icon(type,x,y,col='#f6dfb8'){
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=col;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
  const path=(pts)=>{ctx.beginPath();ctx.moveTo(...pts[0]);for(const p of pts.slice(1))ctx.lineTo(...p);ctx.stroke();};
  if(type==='pace'){path([[-13,6],[-6,-5],[0,5],[7,-5],[14,6]]);}
  if(type==='rations'){ctx.beginPath();ctx.ellipse(0,3,12,8,0,0,Math.PI*2);ctx.stroke();path([[-8,1],[-5,-5],[4,-7],[9,0]]);}
  if(type==='mend'){path([[-10,10],[9,-9],[12,-5],[5,2]]);ctx.beginPath();ctx.arc(-10,10,3,0,7);ctx.stroke();}
  if(type==='scout'){ctx.beginPath();ctx.arc(-5,0,6,0,7);ctx.arc(7,0,6,0,7);ctx.stroke();path([[-9,-5],[-7,-10],[7,-10],[10,-5]]);}
  if(type==='carry'){path([[-10,10],[-10,-7],[10,-7],[10,10],[-10,10]]);path([[-5,-7],[-5,-12],[5,-12],[5,-7]]);}
  if(type==='watch'){ctx.beginPath();ctx.ellipse(0,0,13,8,0,0,7);ctx.stroke();circle(0,0,3,col);}
  if(type==='forage'){path([[0,12],[0,-9],[-8,-4],[0,0],[8,-8],[0,-4]]);}
  if(type==='rough'){path([[-14,9],[-7,-4],[0,7],[7,-10],[14,9]]);}
  if(type==='gentle'){path([[-15,7],[-7,3],[0,4],[7,-2],[15,-4]]);}
  ctx.restore();
}
function control(x,y,type,fn,sub){box(x-36,y-36,72,72,20,'#263e3eea','#e9c99a80');icon(type,x,y-4);if(sub!==undefined){for(let i=0;i<3;i++)circle(x-8+i*8,y+20,2,i<=sub?'#f7d48d':'#75877a');}region(x-36,y-36,72,72,fn,type);}
function hud(){
  if(!started){
    // Start card: where you are going, what you do, and that a tap begins.
    box(60,150,480,330,20,'#203a3bee','#e4c39a99');text('The Long Road',300,200,38,'#f8d9a0');
    ['Lead five travellers and their cart','over the mountain pass before the snow.','12 stops. 30 days.'].forEach((l,i)=>text(l,300,255+i*30,21));
    ['Tap a traveller to ask for help.','They are people. They can say no.'].forEach((l,i)=>text(l,300,365+i*28,19,'#d9cfb6'));
    text('Tap to set out',300,448,22,'#f5d492');return;
  }
  if(state.over){box(52,275,496,278,18,'#203a3bea','#e4c39a99');const n=state.people.filter(p=>!p.left).length;const endings={together:'All five reached the pass',parted:`${n} of five reached the pass`,snow:'Snow closed the pass',stranded:'No one can walk farther',alone:'Everyone left you'};
    const why={together:'You kept the whole party together.',parted:'Tired, hungry people leave at stops.',snow:`You reached stop ${state.stop} of 12. Try a faster pace or rough roads.`,stranded:'Sick people need big meals and a slow pace.',alone:'Push people too hard and they walk away.'};
    text(endings[state.over]||'The journey ends',300,340,27);text(why[state.over]||'',300,392,18,'#d9cfb6');text('Tap to walk again',300,480,21,'#f5d492');region(52,275,496,278,reset,'restart');return;}
  if(menu==='task' && selected>=0){let p=state.people[selected];box(34,716,532,160,20,'#233b3bf2','#e4c59b88');text(`Ask ${p.name} to…`,300,741,22);text(`good at ${SKILL[p.skill]||p.skill}`,300,766,16,'#d9cfb6');const tasks=['mend','scout','carry','watch','forage'];tasks.forEach((v,i)=>{let x=92+i*104;box(x-48,784,96,80,12,'#2f4a48','#e9c99a55');icon(v,x,812);text(TASK[v],x,848,16);region(x-48,784,96,80,()=>task(v),v);});return;}
  // Status: every number carries its name.
  const days=Math.max(0,Math.ceil(state.snowDay-state.day)),food=Math.max(0,Math.floor(state.food)),cartNow=Math.round(state.cart);
  box(16,20,568,48,14,'#263f40d8','#f3d5a155');
  text(`Stop ${Math.min(12,state.stop)}/12`,30,44,19,'#f7e3bc','left');text(`Snow in ${days} days`,150,44,19,days<=5?'#ff9d8a':'#dfe9e5','left');text(`Food ${food}`,350,44,19,food<25?'#ff9d8a':'#f7e3bc','left');text(`Cart ${cartNow}%`,570,44,19,cartNow<25?'#ff9d8a':'#f7e3bc','right');
  if(state.broken){let label=state.opening&&!state.minds.openingAsked?'Tap Tavi to fix the wheel':state.opening?'Tavi said no. Tap someone else':wheelArmed?'Now tap a traveller':'Tap a traveller to fix the cart';box(102,550,300,42,13,'#273d3de8','#f0d1a388');text(label,252,571,19);line([[252,592],[252,621]],'#f0d1a3',1.5);}
  if(state.phase==='stop' && !state.broken){box(60,716,480,166,19,'#233c3bea','#ebc99b88');text(`Stop ${state.stop} of 12. Choose the next road`,300,738,19);control(190,794,'rough',()=>action({type:'route',value:'rough'}));control(410,794,'gentle',()=>action({type:'route',value:'gentle'}));text('Short, rough',190,845,19);text('quick, hard on cart',190,866,14,'#d9cfb6');text('Long, gentle',410,845,19);text('slow, easy on cart',410,866,14,'#d9cfb6');if(state.queuedRoute){const rx=state.queuedRoute==='rough'?190:410;ctx.strokeStyle='#ffdf9a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(rx,794,42,0,Math.PI*2);ctx.stroke();}return;}
  control(66,806,'pace',()=>action({type:'pace',value:(state.pace+1)%3}),state.pace);text(`Pace: ${PACE[state.pace]}`,66,862,16);
  control(534,806,'rations',()=>action({type:'rations',value:(state.rations+1)%3}),state.rations);text(`Meals: ${MEALS[state.rations]}`,534,862,16);
}
function messageBar(){
  if(!started||!messages.length)return;
  // A waiting message shortens the current one, so news never runs far behind the road.
  if(elapsed>messageSince+(messages.length>1?1.7:4)){messages.shift();messageSince=elapsed;if(!messages.length)return;}
  const lines=wrap(messages[0]),h=22+lines.length*24;
  box(40,84,520,h,14,'#1d3334f0','#f0d1a3aa');lines.forEach((l,i)=>text(l,300,84+23+i*24,18));
}
function frame(ms){
  if(!last)last=ms;let delta=Math.min(.1,(ms-last)/1000);last=ms;elapsed+=delta;
  if(sound)sound.windGain.gain.setTargetAtTime(.012+.035*Math.min(1,state.day/state.snowDay),sound.ac.currentTime,.5);
  if(started&&!state.over){acc+=delta*SPEED;while(acc>=DT&&!state.over){step(state);effects();acc-=DT;}if(!state.broken&&state.phase==='travel'&&elapsed>nextStep){tone(65,.05,'triangle',.025,-20);nextStep=elapsed+(.58-(state.pace||0)*.08);}}
  regions=[];ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.restore();ctx.save();ctx.beginPath();ctx.rect(0,0,CW,CH);ctx.clip();landscape(elapsed);
  const order=[{i:0,x:62,y:716},{i:1,x:180,y:735},{i:2,x:300,y:752},{i:3,x:420,y:731},{i:4,x:538,y:713}];
  cart(elapsed);for(const q of order)person(q.i,q.x,q.y,elapsed);hud();messageBar();ctx.restore();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
