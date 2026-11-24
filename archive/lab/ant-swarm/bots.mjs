// node bots.mjs; node bots.mjs --mutate must fail.
// Mutation: disable the nest's delivery transition while retaining movement, pickup and scent.
// The very same completion and delivery-rate claims must then reject it.
import {create,step,paint,lift,painterPath,rand,DT,LEVELS,setAntLimit} from './sim.js';
import {createHash} from 'node:crypto';
const mutation=process.argv.includes('--mutate')?'noDelivery':null;
let failures=0;
const claim=(yes,text)=>{console.log(`${yes?'ok  ':'FAIL'} ${text}`);if(!yes)failures++;};
const mean=a=>a.reduce((v,x)=>v+x,0)/Math.max(1,a.length);
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]??0;
// Both painters move one thumb along the visible route, at <=90 meadow units/sec.
// The clumsy painter has a seeded reaction delay, noisy targeting, pauses between strokes,
// and a slow response to the bird. The policy and distribution stay the same at every level.
export function painter(s,clumsy=false){
  const r={r:s.seed+1973};const ability=rand(r),jitter=clumsy?3+ability*11:0;
  const reaction=clumsy?1+ability*4:0,restTime=clumsy?.5+ability*2.5:.3;
  let path=painterPath(s),seg=1,from={...path[0]},rest=reaction,stroke=0;
  return ()=>{
    if(!clumsy&&(s.bird.active||s.bird.warning)){lift(s);return;}
    if(clumsy&&s.bird.active&&s.time%11>7.4){lift(s);return;}
    if(rest>0){rest-=DT;lift(s);return;}
    if(seg>=path.length){lift(s);rest=restTime;stroke++;path=painterPath(s);seg=1;from={...path[0]};return;}
    const to=path[seg],d=Math.hypot(to.x-from.x,to.y-from.y),v=(clumsy?70-ability*25:90)*DT,q=Math.min(1,v/Math.max(.00001,d));
    const x=from.x+(to.x-from.x)*q,y=from.y+(to.y-from.y)*q;
    const jx=clumsy?(rand(r)-.5)*jitter:(stroke%3-1)*3,jy=clumsy?(rand(r)-.5)*jitter:0;
    paint(s,x+jx,y+jy,from.x+jx,from.y+jy);from={x,y};if(q===1)seg++;
  };
}
function play({level=0,seed=1,ants=600,cap=null,endless=false,seconds=Infinity,duration=null}={},policy='careful'){
  const s=create({level,seed,ants,endless,mutation});if(cap)setAntLimit(s,cap);if(duration)s.duration=duration;
  const move=policy==='idle'?()=>{}:painter(s,policy==='clumsy');
  while(s.status==='play'&&s.time<seconds){move();step(s);s.events.length=0;}
  return s;
}
function campaign(){
 const day=Number((process.argv.find(v=>v.startsWith('--day='))??'--day=20261123').split('=')[1]);
 console.log(`campaign seed ${day}`);
 let ants=600,seconds=0,delivered=0,wins=0;
 for(let level=0;level<8;level++){const s=play({level,seed:day+level*997,ants});seconds+=s.time;delivered+=s.delivered;if(s.status==='won')wins++;ants=s.population;console.log(`campaign ${level+1}: ${s.status}, ${s.time.toFixed(2)}s, ${s.delivered}/${s.goal}, colony ${ants}`);}
 claim(wins===8&&seconds>=60&&seconds<=240,`daily campaign carries earned colony between all 8 meadows: ${wins}/8 wins, ${seconds.toFixed(2)}s, ${delivered} crumbs, ${ants} ants`);
}
if(process.argv.includes('--campaign')){campaign();process.exit(failures?1:0);}
const selected=process.argv.find(x=>x.startsWith('--level='));
if(selected){
 const ants=Number((process.argv.find(v=>v.startsWith('--ants='))??'--ants=600').split('=')[1]);
 const seeds=(process.argv.find(v=>v.startsWith('--seed='))?.split('=')[1]??'1,2,3,4,5,6,7,8').split(',').map(Number);
 for(const level of selected.split('=')[1].split(',').map(Number)){
  const careful=[],clumsy=[];
  for(const seed of seeds){careful.push(play({level,seed,ants,duration:90}).time);if(!process.argv.includes('--careful'))clumsy.push(play({level,seed,ants,duration:90},'clumsy').time);}
  console.log(JSON.stringify({level,ants,seeds,careful,clumsy}));
 }
 process.exit(0);
}
if(process.argv.includes('--survey')){for(let level=0;level<8;level++){const careful=[],clumsy=[];for(let seed=1;seed<=16;seed++){careful.push(play({level,seed,duration:90}).time);clumsy.push(play({level,seed,duration:90},'clumsy').time);}console.log(JSON.stringify({level,carefulMax:Math.max(...careful),carefulMedian:median(careful),clumsy:[...clumsy].sort((a,b)=>a-b)}));}process.exit(0);}
const digest=s=>{let h=createHash('sha256');for(const a of [s.x,s.y,s.angle,s.carry,s.toFood,s.toHome,s.ink])h.update(new Uint8Array(a.buffer));h.update(JSON.stringify([s.time,s.delivered,s.r,s.metrics]));return h.digest('hex');};
const start=performance.now();
{const s=create({seed:1,ants:300,mutation});s.x.fill(5);s.y.fill(145);s.x[0]=s.home.x;s.y[0]=s.home.y;s.carry[0]=1;step(s);claim(s.delivered===1&&s.carry[0]===0,'one carried crumb reaching the nest is delivered exactly once');}
if(mutation&&failures){console.log('Mutation rejected by the same delivery assertion.');process.exit(1);}

// Directed hazard references: hold all other inputs fixed and change one observed condition.
{
 const thin=create({seed:1,level:4,ants:300,mutation}),thick=create({seed:1,level:4,ants:300,mutation});
 for(const [s,n] of [[thin,8],[thick,30]]){s.x.fill(5);s.y.fill(140);for(let i=0;i<n;i++){s.x[i]=s.webs[0].x;s.y[i]=s.webs[0].y;}step(s);}
 const thinMove=Math.hypot(thin.x[0]-thin.webs[0].x,thin.y[0]-thin.webs[0].y),thickMove=Math.hypot(thick.x[0]-thick.webs[0].x,thick.y[0]-thick.webs[0].y);
 claim(!thin.webs[0].broken&&thick.webs[0].broken&&thinMove<.1&&thickMove>.25,`a thin trail is trapped (${thinMove.toFixed(3)} units/tick); a thick column breaks free (${thickMove.toFixed(3)})`);
 const s=create({seed:1,level:3,ants:300,mutation}),b=s.beetles[0];s.x.fill(5);s.y.fill(140);for(let i=0;i<b.need-1;i++){s.x[i]=b.x;s.y[i]=b.y;}step(s);const thinHeld=!b.defeated;s.x[b.need-1]=b.x;s.y[b.need-1]=b.y;step(s);claim(thinHeld&&b.defeated,'beetle needs a simultaneous mob, not cumulative visits');
 const rain=create({seed:1,level:5,ants:300,mutation});rain.tick=120;rain.ink.fill(1);rain.toFood.fill(1);step(rain);const wet=25*50+10,dry=65*50+10;
 claim(rain.rain.active&&rain.ink[wet]<rain.ink[dry]*.8&&rain.toFood[wet]<rain.toFood[dry]*.8,'rain washes both painted and ant scent in its moving band');
 const held=create({seed:1,level:6,ants:300,mutation}),hidden=create({seed:1,level:6,ants:300,mutation});for(const s of [held,hidden]){s.tick=209;s.x.fill(32.5);s.y.fill(91);s.carry.fill(1);}held.painting=true;lift(hidden);step(held);step(hidden);
 claim(held.metrics.birdScatters===300&&hidden.metrics.birdScatters===0&&hidden.carry.slice(0,300).every(Boolean),'holding scent under the bird scatters carriers; lifting preserves the hidden column');
}

const a=play({seed:271,level:4},'careful'),b=play({seed:271,level:4},'careful');
claim(digest(a)===digest(b),`deterministic typed arrays, RNG and metrics: ${digest(a).slice(0,16)}`);
// Emergence is tested with no painting. Compare first journeys with return journeys;
// also remove food scent as an independent ablation, keeping innate nest navigation unchanged.
function emergence(disableTrail=false){const s=create({seed:71,level:1,endless:true,mutation});setAntLimit(s,600);s.duration=80;s.goal=1e9;s.food[0].amount=20000;while(s.time<45){if(disableTrail)s.toFood.fill(0);step(s);s.events.length=0;}return s;}
const learned=emergence(),ablated=emergence(true);
const first=mean(learned.metrics.firstFindTimes),repeat=mean(learned.metrics.repeatFindTimes);
claim(learned.metrics.repeatFindTimes.length>100&&repeat<first*.8,`trails form without input: mean first find ${first.toFixed(2)}s; repeat find ${repeat.toFixed(2)}s (${learned.metrics.repeatFindTimes.length} repeats)`);
claim(learned.delivered>ablated.delivered*1.03,`food-scent ablation reduces deliveries: ${learned.delivered} with trails vs ${ablated.delivered} without`);
const drawn=play({seed:91,level:2,endless:true,seconds:32,cap:600},'careful'),idle=play({seed:91,level:2,endless:true,seconds:32,cap:600},'idle');
claim(drawn.delivered>idle.delivered*1.5&&drawn.delivered>100,`drawn trail raises 32s delivery rate: ${drawn.delivered} vs idle ${idle.delivered}`);
if(mutation&&failures){console.log('Mutation rejected by the same emergence and delivery assertions.');process.exit(1);}
const seeds=Array.from({length:8},(_,i)=>i+1),rows=[];
console.log('\nlevel careful wins /8  clumsy wins /8  careful median seconds');
for(let level=0;level<LEVELS.length;level++){
 const careful=seeds.map(seed=>play({level,seed})),clumsy=seeds.map(seed=>play({level,seed},'clumsy'));
 const row={level,careful:careful.filter(s=>s.status==='won').length,clumsy:clumsy.filter(s=>s.status==='won').length,seconds:median(careful.map(s=>s.time)),delivered:clumsy.map(s=>s.delivered)};rows.push(row);
 console.log(`${level+1}        ${row.careful}              ${row.clumsy}                  ${row.seconds.toFixed(2)}`);
 claim(row.careful===seeds.length,`level ${level+1}: careful painter completes every seed`);
}
claim(rows[0].clumsy===seeds.length,'clumsy slow painter completes the first level on every seed');
claim(rows.every((r,i)=>i===0||r.clumsy<=rows[i-1].clumsy)&&rows.at(-1).clumsy<rows[0].clumsy,'clumsy success never rises as levels add hazards, and falls overall');
claim(new Set(rows.map(r=>r.clumsy)).size>=4,'clumsy success has at least four distinct difficulty steps');
if(!rows.every((r,i)=>i===0||r.clumsy<rows[i-1].clumsy))console.log('INFO limitation: strict success drop on every adjacent level is unmet; levels 3–5 have a plateau.');
for(const ants of [300,1500])for(let level=0;level<8;level++){const s=play({seed:9,level,ants,cap:ants});claim(s.status==='won',`careful painter level ${level+1} with device population ${ants} (${s.delivered}/${s.goal})`);}
const endless=play({seed:20261123,level:7,endless:true,seconds:240});claim(endless.wave>=1&&endless.delivered>1000,`daily endless progresses beyond the first quota: wave ${endless.wave+1}, ${endless.delivered} deliveries, ${endless.time.toFixed(1)}s`);
campaign();
console.log(`\n${failures?failures+' FAILED':'All claims hold'}; ${((performance.now()-start)/1000).toFixed(1)}s; mutation=${mutation??'none'}`);
process.exitCode=failures?1:0;
