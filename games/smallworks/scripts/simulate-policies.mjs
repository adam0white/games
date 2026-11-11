import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const engine=await server.ssrLoadModule('/src/game/engine.ts');
const output=process.argv[2]??'/tmp/small-works-policies';
mkdirSync(output,{recursive:true});
function publicView(s){return {now:s.now,day:s.day,cash:s.cash,stock:s.stock,ended:s.ended,jobs:s.jobs.filter(j=>!['delivered','declined','salvaged'].includes(j.status)).map(j=>({id:j.id,title:j.title,kind:j.kind,status:j.status,isDonor:j.isDonor,isPersonal:j.isPersonal,assignedTo:j.assignedTo,verified:j.verified,components:j.model.components.map(c=>({id:c.id,kind:c.kind,terminals:c.terminals,setting:c.setting})),evidence:j.evidence.map(e=>({kind:e.kind,summary:e.summary,request:e.request,value:e.value,unit:e.unit,componentId:e.componentId,cues:e.cues}))}))};}
function lcg(seed){let x=seed;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
for(const policy of ['random','replace-everything']){
 const outcomes=[];
 for(let seed=1;seed<=12;seed++){
  let state=engine.createGame(seed);const rng=lcg(seed+123);const trace=[];
  for(let i=0;i<400&&!state.ended;i++){
   const v=publicView(state);let command;
   {const active=v.jobs.filter(j=>['active','ready'].includes(j.status)&&!j.isDonor&&!j.isPersonal);const j=active[Math.floor(rng()*active.length)];
    if(!j){const offer=v.jobs.find(j=>j.status==='offer');command=offer?{type:'accept',jobId:offer.id}:{type:'next-day'};}
    else if(policy==='replace-everything'){const c=j.components.find(c=>!j.evidence.some(e=>e.kind==='work'&&e.componentId===c.id));if(c)command=(v.stock[c.kind]??0)>0?{type:'work',jobId:j.id,componentId:c.id,intervention:'replace'}:v.cash>=(engine.PART_PRICES[c.kind]??0)?{type:'buy',part:c.kind}:{type:'deliver',jobId:j.id,unfinished:true};else command=j.verified.length?{type:'deliver',jobId:j.id}:{type:'verify',jobId:j.id,condition:j.kind==='lantern'?'movement':'load'};}
    else{const c=j.components[Math.floor(rng()*j.components.length)];const choice=Math.floor(rng()*10);command=choice===0?{type:'inspect',jobId:j.id,componentId:c.id}:choice<4?{type:'work',jobId:j.id,componentId:c.id,intervention:['clean','adjust','replace'][choice-1]}:choice===4?{type:'verify',jobId:j.id,condition:['bench','movement','load'][Math.floor(rng()*3)]}:choice===5?{type:'deliver',jobId:j.id,unfinished:rng()<0.5}:choice===6?{type:'buy',part:c.kind}:choice===7&&j.kind==='music-box'?{type:'calibrate',jobId:j.id,componentId:'governor',setting:Math.floor(rng()*5)}:choice===8?{type:'measure',jobId:j.id,request:{mode:j.kind==='music-box'?'motion':'voltage',a:c.terminals[0],b:c.terminals[1],condition:['bench','movement','load'][Math.floor(rng()*3)]}}:{type:'next-day'};}
   }
   if(engine.dayRemaining(state)<30&&command.type!=='next-day')command={type:'next-day'};
   const result=engine.dispatch(state,command);trace.push({at:state.now,command,ok:result.ok,message:result.message});state=result.state;
   if(!result.ok&&trace.slice(-5).every(t=>!t.ok))state=engine.dispatch(state,{type:'next-day'}).state;
  }
  const checked=state.jobs.filter(j=>j.status==='delivered'&&!j.returnedUnfinished).length;
  outcomes.push({seed,cash:state.cash,reputation:state.reputation,checked,unfinished:state.jobs.filter(j=>j.returnedUnfinished).length,commands:trace.length,day:state.day});
  writeFileSync(`${output}/${policy}-${seed}.json`,JSON.stringify({outcome:outcomes.at(-1),trace},null,2));
 }
 console.log(policy,JSON.stringify(outcomes));
 writeFileSync(`${output}/${policy}-summary.json`,JSON.stringify(outcomes,null,2));
}
await server.close();
