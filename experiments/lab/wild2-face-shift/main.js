import {create, step, DT, LEVELS, starsFor} from './sim.js';
import {createBooth, stepBooth, RUNGS, PARAMS, PART_PARAM, REACH, PHOTO_TIME, NEXT_TIME, MEMORY_TIME, targetNow, portraitVisible, partAt, likeness, errorOf, tolOf, neutral, CUE_SPOT} from './booth.js';
import {t, lang, setLang, apply} from './words.js';
import {readJson, writeJson} from '../../kit/save.js';
import {sound} from '../../kit/audio.js';
import {onLeave, isPauseKey} from '../../kit/pause.js';
import {screens} from '../../kit/screens.js';
import {stick} from '../../kit/stick.js';
import {hint} from '../../kit/hint.js';
import {noZoom} from '../../kit/zoom.js';
import {lab} from '../../kit/lab.js';
import {home} from '../../kit/home.js';
noZoom();
const $=id=>document.getElementById(id), canvas=$('c'), g=canvas.getContext('2d');
// Save contract (unchanged): the classic four rounds. New state lives under new keys below.
const KEY='wild2-face-shift:save', old=readJson(KEY), save={v:1,best:0,runs:0,stars:[0,0,0,0],sound:true};
if(old && typeof old==='object') {
 for(const k of ['best','runs']) if(Number.isFinite(old[k])&&old[k]>=0)save[k]=old[k];
 if(typeof old.sound==='boolean')save.sound=old.sound;
 if(Array.isArray(old.stars))save.stars=save.stars.map((v,i)=>Math.min(3,Math.max(0,Math.floor(Number(old.stars[i])||0))));
}
// The booth (2026-11-24): {v:1,best,runs,bestStreak,photos}. The daily: {v:1,day,best} for the UTC day.
const BOOTH_KEY='wild2-face-shift:booth', DAILY_KEY='wild2-face-shift:daily';
const nat=v=>Number.isFinite(v)&&v>=0?Math.floor(v):0;
const bo=readJson(BOOTH_KEY), boothSave={v:1,best:nat(bo?.best),runs:nat(bo?.runs),bestStreak:nat(bo?.bestStreak),photos:nat(bo?.photos)};
const query=new URLSearchParams(location.search);
const today=()=>{const d=query.get('day');return d&&/^\d{4}-\d{2}-\d{2}$/.test(d)?d:new Date().toISOString().slice(0,10);};
const dailyBest=day=>{const d=readJson(DAILY_KEY);return d?.v===1&&d.day===day&&Number.isFinite(d.best)?d.best:null;};
const snd=sound({on:()=>save.sound}), store=()=>writeJson(KEY,save), storeBooth=()=>writeJson(BOOTH_KEY,boothSave);
let mode='menu', game='booth', s=null, b=null, allShots=[], total=0, seed=17, cleared=0, input={x:0,y:0,active:false}, keys=new Set();
let W=0,H=0,top=0,bottom=0,unit=1,cx=0,cy=0,clock=0,last=performance.now(),acc=0,flash=0,shake=0,particles=[],visual={x:0,y:0},lastTone=0;
const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
function layout(){W=innerWidth;H=innerHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=W*d;canvas.height=H*d;const css=getComputedStyle($('probe'));top=parseFloat(css.paddingTop)||0;bottom=parseFloat(css.paddingBottom)||0;unit=Math.min((W-40)/360,(H-top-bottom-115)/510,1.25);cx=W/2;cy=top+88+230*unit;g.setTransform(d,0,0,d,0,0);}
addEventListener('resize',layout);layout();
const pad=stick(canvas,{when:()=>mode==='play'&&!pad.touch,reach:85,leash:130,dead:0});
// Where the finger first landed: the booth picks the grabbed part from it (the stick's leash may move its centre later).
let down=null;
canvas.addEventListener('pointerdown',e=>{if(mode==='play'&&pad.touch?.id===e.pointerId)down={id:e.pointerId,x:e.clientX,y:e.clientY};});
canvas.addEventListener('lostpointercapture',e=>{if(pad.touch?.id===e.pointerId)pad.drop();});
const show=screens(['menu','paused','end'],name=>{mode=name;$('pause').style.display=name==='play'?'block':'none';if(name==='menu')menuText();});
const tone=(f=420,d=.09,v=.045,slide=0,type='triangle')=>snd.tone(f,d,v,type,slide);
const tap=()=>{snd.unlock();tone();};
function resetInput(){pad.drop();down=null;keys.clear();input={x:0,y:0,active:false};keyTravel={x:0,y:0};}
let keyTravel={x:0,y:0};
// Play recording for the game lab (kit/lab.js). Classic: one run for each go through the four rounds (unchanged).
// Booth and daily: one run from Play (or Daily face) to the photo strip; event 'rung-cleared' for each rung.
// Opened from the small games' home (?from=small): a way back on the menu and end cards.
const rec=home(lab('wild2-face-shift',{lang}),{back:['#menu .card','#end .card'],lang});let runOpen=false;
function runEnd(outcome){if(!runOpen)return;runOpen=false;if(game==='classic')rec.end(outcome,{rounds:cleared,round:s?s.level+1:null,score:total,photos:allShots.length,best:save.best,stars:save.stars.reduce((a,n)=>a+n,0)});else rec.end(outcome,{mode:game,rungs:b?b.results.length:0,score:b?b.score:0,photos:b?b.shots.filter(x=>!x.missed).length:0,missed:b?b.missed:0,bestStreak:b?b.bestStreak:0,best:game==='daily'?dailyBest(b?.day)??0:boothSave.best});}
function clearFx(){flash=0;shake=0;particles=[];acc=0;visual={x:0,y:0};springs=null;pull=null;strip=[];}
function start(kind=game){runEnd('quit');game=kind;tap();snd.release();resetInput();clearFx();allShots=[];total=0;cleared=0;
 const requestedSeed=query.get('seed');const given=requestedSeed!==null&&requestedSeed.trim()!==''&&Number.isFinite(Number(requestedSeed));
 if(game==='classic'){seed=given?Number(requestedSeed):17;s=create(seed,0);b=null;show('play');runOpen=true;rec.start({mode:'classic',seed});return;}
 s=null;seed=given?Number(requestedSeed):(boothSave.runs*7919+boothSave.photos*31+1);const from=Math.max(0,Math.min(RUNGS.length-1,parseInt(query.get('rung')||'1',10)-1||0));
 b=game==='daily'?createBooth({mode:'daily',day:today()}):createBooth({seed,from});show('play');runOpen=true;rec.start(game==='daily'?{mode:'daily',day:b.day}:{mode:'booth',seed,rung:from+1});}
function pause(){if(mode!=='play')return;resetInput();if(s&&s.phase==='play')s={...s,held:0};if(b&&b.phase==='play')b={...b,held:0,qsum:0,grab:null};snd.hold();show('paused');}
function resume(){tap();snd.release();resetInput();acc=0;show('play');}
function end(won){allShots.push(...s.shots);total+=s.score;save.runs++;save.best=Math.max(save.best,total);store();runEnd(won?'won':'lost');resetInput();show('end');endCard(won);if(won){burst(cx,cy,65);[523,659,784,1047].forEach((f,i)=>setTimeout(()=>{if(mode==='end')tone(f,.28,.055);},i*100));}else tone(180,.24,.05,-60);}
function success(){cleared++;rec.event('round-cleared',{round:s.level+1,stars:starsFor(s)});save.stars[s.level]=Math.max(save.stars[s.level],starsFor(s));store();if(s.level===LEVELS.length-1){end(true);return;}allShots.push(...s.shots);total+=s.score;s=create(seed,s.level+1);visual={x:0,y:0};tone(660,.2,.06,220);}
function boothEnd(){const photos=b.shots.filter(x=>!x.missed).length;if(game==='daily'){const prev=readJson(DAILY_KEY);const keep=prev?.v===1&&typeof prev.day==='string'&&prev.day>b.day?prev:{v:1,day:b.day,best:Math.max(dailyBest(b.day)??0,b.score)};writeJson(DAILY_KEY,keep);}else{boothSave.runs++;boothSave.best=Math.max(boothSave.best,b.score);boothSave.bestStreak=Math.max(boothSave.bestStreak,b.bestStreak);boothSave.photos+=photos;storeBooth();}
 runEnd('won');resetInput();show('end');endCard(true);burst(cx,cy,65);[523,659,784,1047].forEach((f,i)=>setTimeout(()=>{if(mode==='end')tone(f,.28,.055);},i*100));}
$('play').onclick=()=>start('booth');$('daily').onclick=()=>start('daily');$('classic').onclick=()=>start('classic');$('again').onclick=()=>start();$('restart').onclick=()=>start();$('pause').onclick=pause;$('resume').onclick=resume;
for(const id of ['toMenu','endMenu'])$(id).onclick=()=>{runEnd('quit');snd.release();tap();resetInput();show('menu');};
function soundText(){$('sound').textContent=t(save.sound?'soundOn':'soundOff');}
$('sound').onclick=()=>{save.sound=!save.sound;store();soundText();if(save.sound)tap();};
function menuText(){const best=dailyBest(today());$('dailyLine').textContent=best===null?t('dailyNone'):t('dailyBest',{n:best});}
function endCard(won){const booth=game!=='classic';$('stars').classList.toggle('line',booth);$('end-eyebrow').textContent=t(booth?'strip':'contact');$('end-title').textContent=booth?t(game==='daily'?'dailyDone':'boothDone'):t(won?'won':'lost');
 if(booth){$('end-score').textContent=String(b.score);$('stats').textContent=t('statsBooth',{n:b.shots.filter(x=>!x.missed).length,miss:b.missed,b:game==='daily'?dailyBest(b.day)??b.score:boothSave.best});$('stars').textContent=t('streak',{n:b.bestStreak});}
 else{$('end-score').textContent=String(total);$('stats').textContent=t('statsClassic',{n:allShots.length,b:save.best});$('stars').textContent=save.stars.map(n=>'★'.repeat(n)+'☆'.repeat(3-n)).join('  ');}
 drawAlbum();}
// Every word on the page and the canvas comes from words.js; switching redraws the card in view.
function allText(){apply();soundText();menuText();for(const id of ['lang','lang2']){$(id).textContent=t('otherLang');$(id).lang=lang()==='en'?'tr':'en';}if(mode==='end')endCard(s?.phase==='won'||game!=='classic');}
for(const id of ['lang','lang2'])$(id).onclick=()=>{setLang(lang()==='en'?'tr':'en');tap();allText();};
allText();
// The recording notice is on the menu card, which the player sees before Play; its switch is on the pause card.
rec.notice($('menu').firstElementChild);rec.toggle($('paused').firstElementChild);
onLeave(pause);
canvas.addEventListener('pointerdown',()=>{if(mode==='play'){snd.unlock();tone(240,.12,.05,130);}});
canvas.addEventListener('pointerup',()=>{if(mode==='play'){if(game==='classic')tone(280,.09,.035,-80);else boing();}});
const help=hint(canvas,{kind:'stick',key:'wild2-face-shift:hint',when:()=>mode==='play'&&(game==='classic'?s?.phase==='play':b?.phase==='play'),played:save.runs>0||boothSave.runs>0,delay:1600,bottom:()=>Math.max(95,H-(cy+150*unit)),reach:55,label:t('hint')});
addEventListener('keydown',e=>{if(isPauseKey(e)){e.preventDefault();if(mode==='play')pause();else if(mode==='paused')resume();return;}if(mode==='play'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)){e.preventDefault();if(mode==='play'){keys.add(e.key);snd.unlock();help.done();}else if(e.key===' '&&mode==='menu')start();}});
addEventListener('keyup',e=>keys.delete(e.key));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ---- Classic: the four rounds, unchanged rules (sim.js).
function tickClassic(){const pv=pad.vector();if(pad.touch)input={x:clamp(pv.x,-1,1),y:clamp(pv.y,-1,1),active:true};else if(keys.size){input.x=clamp(input.x+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*DT*.8,-1,1);input.y=clamp(input.y+((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*DT*.8,-1,1);input.active=true;}else input.active=false;
 const before=s;s=step(s,input,DT);if((pad.touch||keys.size)&&clock-lastTone>.14&&Math.hypot(s.x-before.x,s.y-before.y)>.004){tone(220+(s.x+1)*120+(s.y+1)*60,.09,.022);lastTone=clock;}
 if(s.shots.length>before.shots.length){flash=1;shake=calm?0:5;burst(cx,cy,26);snd.noise(.065,.07,2200);tone(880,.18,.06);}
 if(s.phase==='won')success();else if(s.phase==='lost')end(false);
}

// ---- Booth geometry. One face in the middle, or two (twins) side by side.
const FACE_R=112;
function faceSpots(state=b){const twins=state?.faces.length===2;const fy=cy+75*unit;return twins?[{x:cx-92*unit,y:fy,r:FACE_R*.56*unit},{x:cx+92*unit,y:fy,r:FACE_R*.56*unit}]:[{x:cx,y:fy,r:FACE_R*unit}];}
const shapeOf=p=>({wide:1+p.w*.3,tall:1-p.w*.2});
// A client point in a face's own frame (the unstretched head is about 100 from centre to cheek).
function local(px,py,spot,p){const {wide,tall}=shapeOf(p);return {x:(px-spot.x)/(spot.r/100)/wide,y:(py-spot.y)/(spot.r/100)/tall};}
function grabAt(px,py){const spots=faceSpots();const face=spots.length===2&&px>cx?1:0;const v=springs?.[face]?.p??b.faces[face];const q=local(px,py,spots[face],v);return {face,part:partAt(q.x,q.y,b.open)};}
let springs=null,pull=null,lastPart=null,strip=[],leftAt=-9,laughAt=-9;
function tickBooth(){
 let inp={active:false};
 if(pad.touch){if(!down||down.id!==pad.touch.id)down={id:pad.touch.id,x:pad.touch.ox,y:pad.touch.oy};if(!down.grab)down.grab=grabAt(down.x,down.y);inp={active:true,part:down.grab.part,face:down.grab.face,dx:(pad.touch.x-down.x)/REACH,dy:(pad.touch.y-down.y)/REACH};}
 else if(keys.size){keyTravel.x+=((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*DT*.8;keyTravel.y+=((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*DT*.8;inp={active:true,part:'head',face:0,dx:keyTravel.x,dy:keyTravel.y};}
 else{keyTravel={x:0,y:0};if(down&&!pad.touch)down=null;}
 const before=b;b=stepBooth(b,inp,DT);
 if(b.grab&&b.phase==='play'){lastPart=b.grab.part;let moved=0;for(const k of PARAMS)moved+=Math.abs(b.faces[b.grab.face][k]-before.faces[b.grab.face][k]);
  if(moved>.004&&clock-lastTone>.07){const stretch=PARAMS.reduce((a,k)=>a+Math.abs(b.faces[b.grab.face][k]),0);tone(260+stretch*90+(b.grab.part==='head'?0:120),.07,.02,40,'sine');lastTone=clock;}}
 const shot=b.shots.length>before.shots.length?b.shots[b.shots.length-1]:null;
 if(shot&&!shot.missed){flash=1;shake=calm?0:5;const sp=faceSpots(before);burst(sp[0].x,sp[0].y,26);snd.noise(.065,.07,2200);tone(880,.18,.06);if(b.streak>1)tone(520+b.streak*90,.14,.04,160);if(shot.mod==='laugh'){laughAt=clock;[0,1,2,3].forEach(i=>setTimeout(()=>{if(mode==='play')tone(520-i*30,.08,.05,-60,'square');},i*120));}strip.push({...shot,at:clock});}
 if(shot&&shot.missed){leftAt=clock;tone(330,.16,.045,-120);setTimeout(()=>{if(mode==='play')tone(220,.22,.045,-80);},150);strip.push({...shot,at:clock});}
 if(before.phase==='photo'&&b.phase!=='photo'&&!calm)boing(.7);
 if(b.results.length>before.results.length){const r=b.results[b.results.length-1];rec.event('rung-cleared',{rung:b.ri+1,kind:r.rung,photos:r.photos,of:r.of,score:r.score});}
 if(b.phase==='done')boothEnd();
}
function boing(v=1){if(game==='classic'||mode!=='play')return;tone(180,.22,.05*v,260,'sine');}
function tick(){if(mode!=='play')return;if(game==='classic')tickClassic();else tickBooth();}

// ---- Drawing.
function rounded(q,x,y,w,h,r,fill){q.fillStyle=fill;q.beginPath();q.roundRect(x,y,w,h,r);q.fill();}
function ellipse(q,x,y,rx,ry,fill){q.fillStyle=fill;q.beginPath();q.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);q.fill();}
function text(q,str,x,y,size=16,color='#fff6e4',align='center'){q.fillStyle=color;q.font=`800 ${size}px ui-rounded, Trebuchet MS, sans-serif`;q.textAlign=align;q.textBaseline='middle';q.fillText(str,x,y);}
const colors=['#f68e7f','#e9b4f2','#b9db8d','#f8c96d'];
const rungColor=i=>colors[i%4];
// The face. p: the seven numbers (w o b m l n e). o.look: where the pupils look (face frame); o.pull: a part being
// pulled and by how much (rubber: it bulges toward the finger); o.laugh: 0..1 for the laughing sitter.
function face(q,x,y,r,a,bb,color=colors[0],ghost=false,o={}){const p=typeof a==='object'?{...neutral(),...a}:{...neutral(),w:a,o:bb};color=typeof a==='object'?bb||colors[0]:color;o=typeof a==='object'?(ghost&&typeof ghost==='object'?ghost:{}):o;
 q.save();q.translate(x,y);q.scale(r/100,r/100);const {wide,tall}=shapeOf(p);const pl=o.pull||null;const off=part=>pl&&pl.part===part?{x:pl.x,y:pl.y}:{x:0,y:0};
 if(pl&&pl.part==='head'){q.transform(1+Math.abs(pl.x)*.004,0,pl.x*.004,1+Math.abs(pl.y)*.004,0,0);}
 q.scale(wide,tall);
 // Ears behind the head: tall and pointed (up), floppy (down), none at zero.
 const ear=off('ears');for(const side of [-1,1]){if(p.e>.04){const hgt=18+p.e*72;q.fillStyle=color;q.beginPath();q.moveTo(side*40,-70);q.quadraticCurveTo(side*(66+ear.x*side*.3),-76-hgt+ear.y,side*(70+p.e*6),-78-hgt+ear.y);q.quadraticCurveTo(side*88,-60,side*82,-30);q.closePath();q.fill();q.fillStyle='#f3a3a8aa';q.beginPath();q.moveTo(side*52,-66);q.quadraticCurveTo(side*66,-70-hgt*.75+ear.y*.8,side*(68+p.e*5),-74-hgt*.85+ear.y*.8);q.quadraticCurveTo(side*78,-56,side*74,-38);q.closePath();q.fill();}
  if(p.e<-.04){const len=24+(-p.e)*70;q.save();q.translate(side*70,-58+ear.y*.3);q.rotate(side*(.35+(-p.e)*.25)+ear.x*.004);ellipse(q,side*10,len*.55,20+(-p.e)*6,len*.6,'#8a5a4f');q.restore();}}
 q.shadowColor='#0b2b3430';q.shadowBlur=16;q.shadowOffsetY=8;
 q.beginPath();q.moveTo(-77,-43);q.bezierCurveTo(-75,-107,68,-110,78,-46);q.bezierCurveTo(113,10,82,89,20,92);q.bezierCurveTo(-33,108,-110,54,-77,-43);q.fillStyle=color;q.fill();q.shadowColor='transparent';
 const grad=q.createRadialGradient(-30,-48,1,0,0,105);grad.addColorStop(0,'#fff8');grad.addColorStop(.55,'#fff0');grad.addColorStop(1,'#932a371b');q.fillStyle=grad;q.fill();
 const blush=(o.laugh||0)*.5;ellipse(q,-47,24,16,9,blush?`rgba(219,91,103,${.22+blush})`:'#db5b6738');ellipse(q,47,24,16,9,blush?`rgba(219,91,103,${.22+blush})`:'#db5b6738');
 const lk=o.look||{x:0,y:-60};const eye=off('eyes'),brow=off('brow');const wideEye=Math.max(0,p.l),lid=Math.max(0,-p.l);
 for(const side of [-1,1]){const ex=side*32+eye.x*.4,ey=-19+p.o*9+eye.y*.4,ew=18*(1+wideEye*.18),eh=(15+p.o*6)*(1+wideEye*.25);ellipse(q,ex,ey,ew,eh,'#fffbef');
  const dx=lk.x-ex,dy=lk.y-ey,d=Math.hypot(dx,dy)||1,look=Math.min(6,d*.08);const pr=6.5*(1-wideEye*.3);ellipse(q,ex+p.w*3+dx/d*look,ey+p.o*2+dy/d*look,pr,(9+p.o*3)*(1-wideEye*.3),'#283641');ellipse(q,ex+p.w*3+dx/d*look-2,ey+dy/d*look-3,2.4,3,'#fff');
  if(lid>.02){q.save();q.beginPath();q.ellipse(ex,ey,ew+1,eh+1,0,0,Math.PI*2);q.clip();q.fillStyle=color;q.fillRect(ex-ew-2,ey-eh-2,ew*2+4,(eh*2+4)*lid*.85);q.strokeStyle='#713d48';q.lineWidth=3;q.beginPath();q.moveTo(ex-ew,ey-eh+(eh*2)*lid*.85);q.lineTo(ex+ew,ey-eh+(eh*2)*lid*.85);q.stroke();q.restore();}
  // Brows: up raises them, down knits them (inner ends drop).
  const base=-44-p.o*12-p.b*13+brow.y*.5,inner=base+(p.b<0?-p.b*12:p.b*3),outer=base+(p.b<0?-p.b*2:0),bx=ex+brow.x*.3;q.strokeStyle='#713d48';q.lineWidth=5+Math.abs(p.b)*1.5;q.lineCap='round';q.beginPath();q.moveTo(bx-side*12,inner);q.quadraticCurveTo(bx,base-7-Math.max(0,p.b)*4,bx+side*12,outer);q.stroke();}
 // Mouth: corners up smile, down frown; open by o; width by w.
 const mo=off('mouth');const mh=8+(p.o+1)*13+(o.laugh||0)*10,mw=25+(p.w+1)*4+p.m*4,my=43+mo.y*.5,mxo=p.w*5+mo.x*.4,corner=my-p.m*14,topC=my-1.5*mh+p.m*22,botC=my+1.5*mh+p.m*22,tm=(corner+topC)/2,bm=(corner+botC)/2;
 q.beginPath();q.moveTo(mxo-mw,corner);q.quadraticCurveTo(mxo,topC,mxo+mw,corner);q.quadraticCurveTo(mxo,botC,mxo-mw,corner);q.closePath();q.fillStyle='#633b4b';q.fill();
 q.save();q.clip();ellipse(q,mxo+4,bm,24,13,'#f37b85');rounded(q,mxo-17,tm-3,34,9,3,'#fff7e7');q.restore();
 // Nose: up shrinks to a button, down grows it long and round; a big one gets nostrils.
 const no=off('nose');const nr=6+(p.n+1)*5,nl=1+Math.max(0,p.n)*.5;ellipse(q,no.x*.5,11+Math.max(0,p.n)*6+no.y*.5,nr,nr*nl*.75,p.n>.55?'#e0525a':'#d66c6a');if(p.n>.3){ellipse(q,no.x*.5-nr*.35,13+p.n*8+no.y*.5,nr*.14,nr*.2,'#7a2f3a');ellipse(q,no.x*.5+nr*.35,13+p.n*8+no.y*.5,nr*.14,nr*.2,'#7a2f3a');}
 q.restore();}
function photo(q,x,y,w,h,target,color,rotation=0){q.save();q.translate(x,y);q.rotate(rotation);q.shadowColor='#081f3940';q.shadowBlur=16;q.shadowOffsetY=8;rounded(q,-w/2,-h/2,w,h,5,'#fff9eb');q.shadowColor='transparent';rounded(q,-w/2+8,-h/2+8,w-16,h-33,3,'#d5e4d4');
 const fr=Math.min(w*.40,(h-35)*.43);if(target.p)face(q,0,-9+fr*.08,fr*.86,target.p,color);else face(q,0,-9,fr,target.x,target.y,color);q.strokeStyle='#cabfa9';q.lineWidth=2;q.beginPath();q.moveTo(-w*.2,h/2-13);q.lineTo(w*.2,h/2-13);q.stroke();q.restore();}
function burst(x,y,n){if(calm)return;for(let i=0;i<n;i++){const a=i*2.399;particles.push({x,y,vx:Math.cos(a)*(60+i*3),vy:Math.sin(a)*(60+i*3)-80,life:1,rot:a,color:['#d9f681','#f68e7f','#f8eedb'][i%3]});}}
function background(){g.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);g.clearRect(0,0,W,H);g.fillStyle='#173a42';g.fillRect(0,0,W,H);const bg=g.createRadialGradient(cx,H*.4,20,cx,H*.4,H*.7);bg.addColorStop(0,'#2e5960');bg.addColorStop(1,'#102e36');g.fillStyle=bg;g.fillRect(0,0,W,H);
 g.strokeStyle='#ffffff05';g.lineWidth=1;for(let x=0;x<W;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}for(let y=0;y<H;y+=32){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}}
// Reapply backing scale each frame; initial WebKit painting can lose it.
function draw(){background();
 if((mode==='play'||mode==='paused')&&game==='classic'&&s)drawClassic();
 if((mode==='play'||mode==='paused')&&game!=='classic'&&b)drawBooth();
 for(const p of particles){g.save();g.globalAlpha=p.life;g.translate(p.x,p.y);g.rotate(p.rot+clock*3);rounded(g,-3,-5,6,10,2,p.color);g.restore();}if(flash>0){g.fillStyle=`rgba(255,249,224,${flash*.6})`;g.fillRect(0,0,W,H);}
}
function drawClassic(){const config=LEVELS[s.level],target=s.targets[Math.min(s.index,s.targets.length-1)];text(g,t('round',{n:s.level+1}),cx-145*unit,top+36,14,'#bcd4cf','left');text(g,t('photos',{n:allShots.length+s.shots.length}),cx-145*unit,top+58,14,'#8daeb0','left');
 const time=clamp(1-s.elapsed/config.limit,0,1);rounded(g,cx-145*unit,top+76,290*unit,4,2,'#ffffff15');rounded(g,cx-145*unit,top+76,290*unit*time,4,2,time<.2?'#f68e7f':'#d9f681');
 const py=top+88+68*unit;photo(g,cx,py,110*unit,130*unit,target,colors[s.level],-.045);text(g,t('copy'),cx+89*unit,py,14,'#c2d8d1');
 g.save();g.translate(cx,cy+75*unit);g.scale(unit,unit);if(shake)g.translate(Math.sin(clock*80)*shake,Math.cos(clock*70)*shake);ellipse(g,0,125,108,13,'#061d2830');
 const err=Math.max(Math.abs(s.x-target.x),Math.abs(s.y-target.y));const near=err<=config.tolerance;const meter=clamp(Math.min(s.held/config.hold,s.age/3),0,1);g.strokeStyle=near?'#d9f681':'#ffffff17';g.lineWidth=3;g.beginPath();g.arc(0,0,137,0,Math.PI*2);g.stroke();if(meter){g.lineWidth=7;g.strokeStyle='#d9f681';g.beginPath();g.arc(0,0,137,-Math.PI/2,-Math.PI/2+Math.PI*2*meter);g.stroke();}
 visual.x+=(s.x-visual.x)*(calm?1:.25);visual.y+=(s.y-visual.y)*(calm?1:.25);face(g,0,0,112,visual.x,visual.y,colors[s.level]);if(s.level===0&&s.index===0&&!input.active&&s.age<5){g.strokeStyle='#fff6e477';g.lineWidth=3;for(const side of [-1,1]){g.beginPath();g.moveTo(side*136,-6);g.lineTo(side*146,0);g.lineTo(side*136,6);g.stroke();}}
 g.restore();const under=cy+237*unit;text(g,near?(s.phase==='photo'?t('gotIt'):t('holdIt')):'',cx,under,16,'#d9f681');
 for(let i=0;i<config.count;i++){const dx=cx+(i-(config.count-1)/2)*23;ellipse(g,dx,under+32,4.5,4.5,i<s.shots.length?'#d9f681':i===s.index?'#fff6e4':'#ffffff22');}
 if(pad.touch){const p=pad.touch;g.strokeStyle='#fff5';g.lineWidth=2;g.beginPath();g.arc(p.ox,p.oy,30,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(p.ox,p.oy);g.lineTo(p.x,p.y);g.stroke();ellipse(g,p.x,p.y,12,12,'#fff8');}
}
// Springs give the rubber its wobble: the drawn face chases the rules' face and overshoots. Drawing only.
function springStep(dt){if(!b)return;if(!springs||springs.length!==b.faces.length)springs=b.faces.map(f=>({p:{...f},v:neutral()}));
 springs.forEach((sp,i)=>{for(const k of PARAMS){const goal=b.faces[i][k];if(calm){sp.p[k]=goal;sp.v[k]=0;continue;}const a=(goal-sp.p[k])*190-sp.v[k]*11;sp.v[k]+=a*dt;sp.p[k]+=sp.v[k]*dt;}});
 // The grabbed part bulges toward the finger and springs back with a wobble when let go.
 const grabbing=b.grab&&pad.touch&&down?.grab;if(!pull)pull={part:null,x:0,y:0,vx:0,vy:0,face:0};
 if(grabbing){const sp=faceSpots()[down.grab.face];const k=100/sp.r;const tx=clamp((pad.touch.x-down.x)*k*.22,-16,16),ty=clamp((pad.touch.y-down.y)*k*.22,-16,16);pull.part=b.grab.part;pull.face=down.grab.face;pull.x+=(tx-pull.x)*(calm?1:.35);pull.y+=(ty-pull.y)*(calm?1:.35);pull.vx=0;pull.vy=0;}
 else if(calm){pull.x=pull.y=0;}else{pull.vx+=(-pull.x*260-pull.vx*9)*dt;pull.vy+=(-pull.y*260-pull.vy*9)*dt;pull.x+=pull.vx*dt;pull.y+=pull.vy*dt;}}
function drawBooth(){const state=b,ri=state.ri,rung=state.rung,color=rungColor(ri),target=state.targets[Math.min(state.index,state.targets.length-1)],twins=state.faces.length===2;
 const hud=game==='daily'?t('dailyHud',{d:state.day}):t('booth',{n:ri+1,m:state.rungs.length});text(g,hud,cx-145*unit,top+30,14,'#bcd4cf','left');text(g,String(state.score),cx-145*unit,top+54,20,'#fff6e4','left');
 if(state.streak>1){const sx=cx-145*unit+g.measureText(String(state.score)).width+14;rounded(g,sx,top+43,46,22,11,'#d9f681');text(g,`×${(1+.25*Math.min(state.streak,4)).toFixed(2).replace(/0$/,'').replace(/\.0$/,'')}`,sx+23,top+54,13,'#19343b');}
 // Sitter dots: taken, missed, now, to come.
 for(let i=0;i<state.targets.length;i++){const r0=state.shots.filter(x=>x.rung===rung.id&&x.index===i);const sh=r0[r0.length-1];const dx=cx+60*unit+i*16;ellipse(g,dx,top+54,5,5,sh?(sh.missed?'#f68e7f':'#d9f681'):i===state.index?'#fff6e4':'#ffffff22');}
 const py=top+80+70*unit,pw=(twins?92:112)*unit,ph=(twins?110:132)*unit;
 const patience=state.phase==='play'?clamp(1-state.age/rung.patience,0,1):1;const fidget=patience<.35&&!calm?Math.sin(clock*18)*.04*(1-patience/.35):0;
 if(state.phase==='next'){drawIntro(state);return;}
 // The portrait(s).
 const visible=portraitVisible(state),leaving=state.phase==='leave'?state.phaseTime/.8:0;
 const portraits=twins?[{x:cx-62*unit,p:targetNow(state,0),name:target.name},{x:cx+62*unit,p:targetNow(state,1),name:target.name2}]:[{x:cx,p:targetNow(state,0),name:target.name}];
 for(const pt of portraits){g.save();g.translate(pt.x+leaving*W*.7,py);g.rotate(-.045+fidget);
  if(target.mod==='laugh'){photo(g,0,0,pw,ph,{p:{...neutral(),m:.6+.4*Math.min(1,state.laugh),o:-.2+state.laugh*1.1,l:state.laugh>.7?-.6:0}},color);}
  else if(!visible){rounded(g,-pw/2,-ph/2,pw,ph,6,'#f6d98f');g.strokeStyle='#d3b264';g.lineWidth=3;for(let i=-4;i<=4;i++){g.beginPath();g.moveTo(-pw/2+8,i*ph/10);g.lineTo(pw/2-8,i*ph/10+ph/6);g.stroke();}text(g,'?',0,0,48*unit,'#a9692c');}
  else if(target.mod==='spoon'){g.save();g.fillStyle='#c9d3d6';g.beginPath();g.ellipse(0,-6,pw*.46,ph*.5,0,0,Math.PI*2);g.fill();g.fillStyle='#e9f0f1';g.beginPath();g.ellipse(-8,-16,pw*.36,ph*.4,0,0,Math.PI*2);g.fill();rounded(g,-6,ph*.4,12,ph*.16,6,'#c9d3d6');g.beginPath();g.ellipse(0,-6,pw*.42,ph*.46,0,0,Math.PI*2);g.clip();g.rotate(Math.PI);g.scale(1.3,.72);face(g,0,4,Math.min(pw,ph)*.4,pt.p,color);g.restore();}
  else photo(g,0,0,pw,ph,{p:pt.p},color);
  g.restore();
  if(target.mod!=='laugh'&&leaving===0)text(g,t('face.'+pt.name).toUpperCase(),pt.x,py+ph/2+14*unit,12,'#c2d8d1');}
 if(target.mod==='mirror'){g.strokeStyle='#cfe6ef55';g.lineWidth=2;for(const side of [-1,1]){g.beginPath();g.moveTo(cx+side*(pw/2+22*unit),py-30);g.lineTo(cx+side*(pw/2+30*unit),py);g.lineTo(cx+side*(pw/2+22*unit),py+30);g.stroke();}}
 // Patience: the bar under the portrait drains; the sitter fidgets when it is low; at zero the sitter leaves.
 const barY=py+ph/2+(target.mod==='laugh'?30:28)*unit;rounded(g,cx-60*unit,barY,120*unit,5,3,'#ffffff18');rounded(g,cx-60*unit,barY,120*unit*patience,5,3,patience<.35?'#f68e7f':'#f8c96d');
 if(state.phase==='leave')text(g,t('leftEarly'),cx,py,22,'#f68e7f');
 // The face(s).
 const spots=faceSpots(state),lk=likeness(state),tol=tolOf(state),err=errorOf(state);const near=target.mod!=='laugh'&&err<=tol;
 spots.forEach((sp,i)=>{g.save();g.translate(sp.x,sp.y);g.scale(sp.r/100,sp.r/100);if(shake)g.translate(Math.sin(clock*80)*shake,Math.cos(clock*70)*shake);ellipse(g,0,112,96,12,'#061d2830');
  const ring=target.mod==='laugh'?Math.min(1,state.laugh):clamp(state.held/rung.hold,0,1);g.strokeStyle=near?'#d9f681':'#ffffff17';g.lineWidth=3;g.beginPath();g.arc(0,0,122,0,Math.PI*2);g.stroke();if(ring>0){g.lineWidth=7;g.strokeStyle='#d9f681';g.beginPath();g.arc(0,0,122,-Math.PI/2,-Math.PI/2+Math.PI*2*ring);g.stroke();}
  const v=springs?.[i]?.p??state.faces[i];let look={x:0,y:-120};if(pad.touch){const q=local(pad.touch.x,pad.touch.y,sp,v);look=q;}
  const laughNow=clock-laughAt<1.4?1:0;face(g,0,0,100,v,color,{look,pull:pull&&pull.face===i&&pull.part?{part:pull.part,x:pull.x,y:pull.y}:null,laugh:laughNow});
  // After a while without a match, the part furthest off gets a pulsing ring and an arrow showing which way.
  if(state.phase==='play'&&target.mod!=='laugh'&&state.age>2.5&&!near&&visible){const goal=targetNow(state,i);let worst=null,size=0;for(const k of PARAMS){const e=Math.abs(state.faces[i][k]-goal[k]);if(e>size){size=e;worst=k;}}if(worst&&size>tol)drawCue(worst,goal[worst]-state.faces[i][worst],v,target.mod==='mirror');}
  // A part that just opened pulses for the first sitter of its rung.
  if(state.phase==='play'&&state.index===0&&state.age<3&&rung.unlock.length&&rung.unlock[0]!=='w'&&rung.unlock[0]!=='o'){const k=rung.unlock[0];drawCue(k,0,v,false,true);}
  g.restore();});
 // Likeness meter: how close, with the line a photo needs.
 const my=spots[0].y+(twins?82:132)*unit,mw=200*unit;rounded(g,cx-mw/2,my,mw,10,5,'#ffffff18');rounded(g,cx-mw/2,my,mw*lk,10,5,near||target.mod==='laugh'&&lk>.9?'#d9f681':lk>.5?'#f8c96d':'#f68e7f');if(target.mod!=='laugh'){g.fillStyle='#fff6e4';g.fillRect(cx-mw/2+mw*2/3-1,my-4,2,18);}
 text(g,target.mod==='laugh'?t('pullFaces'):`${t('likeness')} ${Math.round(lk*100)}%`,cx-mw/2,my+24,11,'#bcd4cf','left');text(g,near?(state.phase==='photo'?t('gotIt'):t('holdIt')):state.phase==='photo'?t('gotIt'):'',cx+mw/2,my+24,13,'#d9f681','right');
 // The strip: the photos so far, newest on the right; a missed sitter is an empty frame.
 const sy=H-bottom-48,shown=strip.slice(-7);shown.forEach((sh,i)=>{const age=clock-sh.at;const fly=calm?1:clamp(age/.45,0,1);const x=cx+(i-(shown.length-1)/2)*48;const y=sy+(1-fly)*(spots[0].y-sy);g.save();g.translate(x,y);g.rotate((i%2?1:-1)*.06);rounded(g,-20,-25,40,50,3,sh.missed?'#ffffff22':'#fff9eb');if(!sh.missed){rounded(g,-16,-21,32,32,2,'#d5e4d4');face(g,0,-5,12,sh.faces[0],rungColor(RUNGS.findIndex(r=>r.id===sh.rung)<0?0:RUNGS.findIndex(r=>r.id===sh.rung)));text(g,String(sh.points),0,18,9,'#5a6b6b');}g.restore();});
 if(pad.touch&&!calm){const p=pad.touch;ellipse(g,p.x,p.y,10,10,'#fff6');}
}
// A ring on a part and an arrow for the way to pull it (part directions as in booth.js; mirror flips them).
const CUE=CUE_SPOT;
function drawCue(k,need,v,mirror,pulse=false){const [x,y,axis]=CUE[k];const pa=pulse?.5+.5*Math.sin(clock*8):.5+.5*Math.sin(clock*6);g.strokeStyle=`rgba(217,246,129,${.45+.45*pa})`;g.lineWidth=4;g.beginPath();g.arc(x*(1+v.w*.3),y*(1-v.w*.2),18+pa*5,0,Math.PI*2);g.stroke();
 if(pulse||Math.abs(need)<1e-6)return;let dir=Math.sign(need)*(axis.startsWith('-')?-1:1)*(mirror?-1:1);const ax=x*(1+v.w*.3)+(axis.endsWith('x')?dir*34:0),ay=y*(1-v.w*.2)+(axis.endsWith('y')?dir*34:0);const bx=x*(1+v.w*.3)+(axis.endsWith('x')?dir*54:0),by=y*(1-v.w*.2)+(axis.endsWith('y')?dir*54:0);
 g.beginPath();g.moveTo(ax,ay);g.lineTo(bx,by);g.stroke();const ang=Math.atan2(by-ay,bx-ax);g.beginPath();g.moveTo(bx,by);g.lineTo(bx-Math.cos(ang-.6)*10,by-Math.sin(ang-.6)*10);g.moveTo(bx,by);g.lineTo(bx-Math.cos(ang+.6)*10,by-Math.sin(ang+.6)*10);g.stroke();}
// Between rungs: the next rung's name, with what is new shown on a small face.
function drawIntro(state){const nextI=state.ri+1;const done=nextI>=state.rungs.length;const r=done?null:state.rungs[nextI];const u=clamp(state.phaseTime/.25,0,1);const res=state.results[state.results.length-1];
 g.save();g.globalAlpha=u;text(g,done?t('rung.done'):t('rung.'+r.id),cx,cy-10*unit,28*unit,'#fff6e4');
 if(res)text(g,`${res.photos} / ${res.of} · +${res.score}`,cx,cy+28*unit,16,'#d9f681');
 if(r&&!done){const demo={...neutral()};const ph=Math.sin(state.phaseTime*5);const k=r.unlock[0];if(k){demo[k]=ph*.8;}else if(r.mod==='mirror'){demo.w=ph*.7;}else if(r.mod==='twins'){demo.o=ph*.6;}g.save();g.translate(cx+(r.mod==='twins'?-50*unit:0),cy+120*unit);g.scale(.62*unit,.62*unit);face(g,0,0,100,demo,rungColor(nextI));if(k&&k!=='w'&&k!=='o')drawCue(k,0,demo,false,true);g.restore();if(r.mod==='twins'){g.save();g.translate(cx+50*unit,cy+120*unit);g.scale(.62*unit,.62*unit);face(g,0,0,100,{...demo,o:-demo.o},rungColor(nextI+1));g.restore();}}
 g.restore();}
function drawHero(){const c=$('hero'),q=c.getContext('2d');c.width=600;c.height=320;photo(q,120,165,150,190,{p:{w:-.6,o:.5,e:.9,n:-.5,m:.3}},colors[2],-.17);photo(q,465,166,150,190,{p:{w:.6,o:-.5,b:-.8,m:-.6}},colors[1],.16);photo(q,300,150,170,218,{p:{w:.2,o:.8,b:.8,l:.6}},colors[0],-.035);}
function drawAlbum(){const c=$('album'),q=c.getContext('2d');c.width=640;c.height=380;c.style.height=game==='classic'?'150px':'';q.clearRect(0,0,640,380);
 if(game==='classic'){c.height=280;const photos=[...new Map(allShots.map(p=>[p.level,p])).values()];if(!photos.length){rounded(q,215,78,210,135,24,'#d6ddce');rounded(q,250,53,72,40,10,'#d6ddce');ellipse(q,320,146,48,48,'#29474b');ellipse(q,320,146,31,31,'#82a7a3');ellipse(q,310,135,10,10,'#e8efdf');rounded(q,375,96,26,13,4,'#fff9eb');}photos.forEach((p,i)=>photo(q,105+i*143,139,137,180,p,colors[p.level],(i%2?1:-1)*.07));return;}
 // The booth strip: the best photos of the session, in order, each with its points (the sitter is the small inset).
 const taken=b.shots.filter(x=>!x.missed);const pick=taken.length<=8?taken:[...taken].sort((a,b2)=>b2.points-a.points).slice(0,8).sort((a,b2)=>b.shots.indexOf(a)-b.shots.indexOf(b2));
 pick.forEach((sh,i)=>{const col=i%4,row=Math.floor(i/4);const x=85+col*157,y=95+row*190;q.save();q.translate(x,y);q.rotate(((i*7)%5-2)*.025);q.shadowColor='#081f3940';q.shadowBlur=12;q.shadowOffsetY=6;rounded(q,-68,-85,136,170,5,'#fff9eb');q.shadowColor='transparent';rounded(q,-60,-77,120,120,3,'#d5e4d4');const ci=Math.max(0,RUNGS.findIndex(r=>r.id===sh.rung));face(q,sh.faces.length===2?-24:0,-14,sh.faces.length===2?26:44,sh.faces[0],rungColor(ci));if(sh.faces.length===2)face(q,24,-14,26,sh.faces[1],rungColor(ci));
  if(sh.target){q.fillStyle='#fff9eb';q.beginPath();q.roundRect(26,-80,40,46,3);q.fill();face(q,46,-58,14,sh.target,rungColor(ci));}
  text(q,String(sh.points),0,64,22,'#d35f51');q.restore();});}
// Paint after the first surface is ready, including a fresh WebKit context.
requestAnimationFrame(drawHero);
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(mode==='play'){clock+=dt;acc+=dt;while(acc>=DT){tick();acc-=DT;}}if(game!=='classic')springStep(dt);flash=Math.max(0,flash-dt*3.5);shake=Math.max(0,shake-dt*20);particles=particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=190*dt;return p.life>0;});draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
// Read-only snapshots for browser assertions; no state setters or shortcuts. In the booth, `state.x`/`state.y` are
// the head's width and opening (the first face) and `state.elapsed` its play clock, as in the classic rounds.
function boothView(){if(!b)return null;const v=structuredClone(b);delete v.rungs;return {...v,x:b.faces[0].w,y:b.faces[0].o,elapsed:b.elapsed,likeness:likeness(b),target:targetNow(b,0),visible:portraitVisible(b)};}
window.faceShiftState=()=>({mode,game,state:game==='classic'?(s?structuredClone(s):null):boothView(),score:game==='classic'?total:b?.score??0,cleared,shots:game==='classic'?allShots.length:b?.shots.filter(x=>!x.missed).length??0,reach:85,center:{x:cx,y:cy+75*unit},faces:b?faceSpots().map(f=>({...f})):null,dragging:!!pad.touch,effects:{flash,shake,particles:particles.length},hint:help.shown,audio:!!snd.ctx,saved:structuredClone(save),booth:structuredClone(boothSave),daily:readJson(DAILY_KEY),lang:lang(),day:today()});
