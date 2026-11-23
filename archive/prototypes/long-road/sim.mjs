// The Long Road. Pure seeded host simulation; one tick is 1/30 second.
// People choose through the bundled HF run API in people.mjs. The host owns the road.
import { createPeople, choose } from './people.mjs';
export const DT = 1 / 30;
export const STOPS = 12;
const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
function random(seed) { let x=seed>>>0; return ()=>{ x=(x+0x6d2b79f5)>>>0;let n=Math.imul(x^(x>>>15),x|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296; }; }
export function create(seed=1) {
  const minds=createPeople(seed),r=random(seed);
  return {seed,t:0,day:0,snowDay:30,stop:0,progress:0,food:102,cart:78,pace:1,rations:1,route:'gentle',phase:'travel',broken:false,opening:false,over:null,
    people:minds.travellers.map((p,i)=>({...p,fatigue:i===0?.94:.12+i*.025,health:1,neglect:0,left:false,job:null,jobUntil:0,speech:'',speechUntil:0,asks:0})),
    minds,events:[],log:[],stopUntil:0,scouted:false,watch:false,carrying:false,forageDone:false,cracked:false,weather:r(),hazards:Array.from({length:13},()=>r()),nextStrain:24,refusals:0};
}
function event(s,type,person,text) { const e={type,...(person!==undefined?{person}:{}),...(text?{text}:{})};s.events.push(e);s.log.push({t:Math.round(s.t*30),...e}); }
function say(s,i,text,type) {const p=s.people[i];s.people.forEach(q=>{q.speech='';q.speechUntil=0;});p.speech=text;p.speechUntil=s.t+5;event(s,type,i,text);}
function finish(s,ending) {s.over=ending;event(s,'end',undefined,ending);}
function complete(s,i) {
  const p=s.people[i], task=p.job; p.job=null;
  const expert=p.skill===({mend:'mender',scout:'scout',carry:'carrier',watch:'watcher',forage:'forager'}[task]);
  p.fatigue=clamp(p.fatigue+(expert?.09:.16));p.neglect=clamp(p.neglect+.025);
  if(task==='mend') {s.cart=clamp(s.cart+(expert?65:45),0,100);s.broken=false;s.opening=false;event(s,'mended',i);}
  if(task==='forage') {const found=expert?22:15;s.food=clamp(s.food+found,0,140);event(s,'forage',i,String(found));}
  if(task==='scout') {s.scouted=true;if(s.phase==='travel')s.progress=Math.min(.96,s.progress+.055);event(s,'scouted',i);}
  if(task==='carry') {s.carrying=true;const sick=s.people.filter(q=>!q.left&&q!==p).sort((a,b)=>a.health-b.health)[0];if(sick){sick.health=clamp(sick.health+.12);sick.fatigue=clamp(sick.fatigue-.2);}event(s,'carried',i,sick?.name);}
  if(task==='watch') {s.watch=true;event(s,'watched',i);}
}
function ask(s,i,task) {
  const p=s.people[i];if(!p||p.left||p.job||p.speechUntil>s.t||!['mend','scout','carry','watch','forage'].includes(task))return;
  if(s.opening&&task!=='mend')return;
  if(task==='forage'&&s.forageDone)return;
  if(task==='mend'&&s.people.some(q=>q.job==='mend'))return;
  const decision=choose(s.minds,i,task,{fatigue:p.fatigue,hunger:s.food<=0?1:s.rations===0?.6:s.rations===2?.05:.25,health:p.health,neglect:p.neglect,pace:s.pace,rations:s.rations,stop:s.stop,opening:s.opening});
  p.asks++; s.log.push({t:Math.round(s.t*30),type:'hf',person:i,task,decision});
  if(!decision.accepted) {s.refusals++;say(s,i,decision.reason||'Need rest','refuse');return;}
  p.job=task;p.jobUntil=s.t+({mend:11,scout:13,carry:12,watch:14,forage:15}[task]);
  if(task==='forage')s.forageDone=true;
  say(s,i,task==='mend'?'I’ll fix it':task==='scout'?'I’ll look ahead':task==='carry'?'I’ll help carry':task==='watch'?'I’ll keep guard':'I’ll find food','agree');
}
function stop(s) {
  s.stop++;s.progress=0;event(s,'stop');
  // A stop is a genuine safe place to leave. Only HF's selected departure is enacted.
  for(let i=0;i<s.people.length;i++) {
    const p=s.people[i];if(p.left)continue;
    // Jobs keep their real timers across arrival; departure can cancel unfinished work.
    const decision=choose(s.minds,i,'journey',{fatigue:p.fatigue,hunger:s.food<=0?1:s.rations===0?.65:.2,health:p.health,neglect:p.neglect,pace:s.pace,rations:s.rations,stop:s.stop,opening:false});
    s.log.push({t:Math.round(s.t*30),type:'hf',person:i,task:'journey',decision});
    if(decision.action==='leave') {p.left=true;p.job=null;say(s,i,decision.reason||'I’m staying here','leave');}
  }
  const remaining=s.people.filter(p=>!p.left).length;
  if(!remaining)return finish(s,'alone');
  if(s.stop>=STOPS)return finish(s,remaining===5?'together':'parted');
  if(!s.watch&&(s.stop===3||s.stop===7)){s.food=Math.max(0,s.food-9);event(s,'theft');}
  if(s.stop===4||s.stop===8){const candidates=s.people.filter(p=>!p.left);const p=candidates[Math.floor(s.hazards[s.stop]*candidates.length)];p.health=clamp(p.health-.24);event(s,'sick',s.people.indexOf(p));}
  s.phase='stop';s.stopUntil=s.t+12;s.queuedRoute=null;
  s.scouted=false;s.carrying=false;s.watch=false;
  s.weather=s.hazards[s.stop];
}
function depart(s,route=s.route) {s.route=route;s.phase='travel';s.queuedRoute=null;s.forageDone=false;event(s,'depart');}
export function step(s,action) {
  s.events.length=0;if(s.over)return s;
  if(action) {
    if(action.type==='ask')ask(s,action.person,action.task);
    if(action.type==='pace')s.pace=clamp(action.value|0,0,2);
    if(action.type==='rations')s.rations=clamp(action.value|0,0,2);
    if(action.type==='route'&&s.phase==='stop'){s.queuedRoute=action.value==='rough'?'rough':'gentle';s.route=s.queuedRoute;}
  }
  s.t+=DT;
  if(!s.cracked&&s.t>=3) {s.cracked=true;s.broken=true;s.opening=true;s.cart=12;event(s,'crack');}
  for(let i=0;i<s.people.length;i++) {
    const p=s.people[i];if(p.left)continue;
    if(p.job&&s.t>=p.jobUntil)complete(s,i);
    const resting=s.phase==='stop'||s.broken;
    p.fatigue=clamp(p.fatigue+DT*(resting?-.0045:[.0007,.0018,.0044][s.pace])+(s.carrying&&p.health<.8?-DT*.001:0));
    p.neglect=clamp(p.neglect+DT*((s.pace===2?.0014:.0001)+(s.rations===0?.0012:s.rations===2?-.001:-.0003)));
    p.health=clamp(p.health+DT*(s.food<=0?-.0024:s.rations===0?-.00065:s.rations===2?.0007:.00015)-(s.pace===2?DT*.00045:0));
    // Tell the player when someone wears out, once per spell of tiredness.
    if(!p.worn&&p.fatigue>.8){p.worn=true;event(s,'tired',i);}else if(p.worn&&p.fatigue<.55)p.worn=false;
  }
  const count=s.people.filter(p=>!p.left).length;
  s.food=Math.max(0,s.food-DT*[.105,.185,.275][s.rations]*(count/5));
  if(!s.lowFood&&s.food<25&&s.food>0){s.lowFood=true;event(s,'low');}else if(s.lowFood&&s.food>40)s.lowFood=false;
  if(!s.noFood&&s.food<=0){s.noFood=true;event(s,'starve');}else if(s.noFood&&s.food>0)s.noFood=false;
  s.day+=DT*(s.phase==='stop'?.047:s.broken?.06:.056)*(1+(s.weather>.78?.12:0));
  for(const days of [10,5])if(!s['snow'+days]&&s.snowDay-s.day<=days){s['snow'+days]=true;event(s,'snow',undefined,String(days));}
  if(s.phase==='travel'&&!s.broken) {
    s.progress+=DT*[.84,1,1.24][s.pace]/(s.route==='rough'?26:34);
    s.cart=Math.max(0,s.cart-DT*(s.route==='rough'?.078:.027)*(s.pace===2?1.8:1)*(s.scouted?.45:1));
    if(s.t>s.nextStrain) {s.nextStrain=s.t+26;event(s,'creak');}
    if(s.cart<=8){s.broken=true;event(s,'crack');}
    if(s.progress>=1)stop(s);
  }
  if(s.phase==='stop'&&((s.queuedRoute&&s.t>=s.stopUntil-3)||s.t>=s.stopUntil))depart(s,s.queuedRoute||s.route);
  if(!s.over&&s.day>=s.snowDay)finish(s,'snow');
  // A broken cart can be recovered until snow; don't substitute an arbitrary timeout.
  if(!s.over&&count&&s.people.filter(p=>!p.left).every(p=>p.health<=.08))finish(s,'stranded');
  return s;
}
