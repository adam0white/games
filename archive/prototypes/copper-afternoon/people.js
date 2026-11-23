// Real HF4 run adapter. All quantities below are explicit fictional authoring.
// The host supplies affordances and observations; HF selects each person's action.
import {createRun,createPerson,step,inspect} from './hf.js';
const DAY=86400000, HOST={type:'host',id:'bench'}, VOICE={type:'voice',id:'player'};
const must=r=>{if(!r.ok)throw Error(`${r.error.code}: ${r.error.path}: ${r.error.message}`);return r.value;};
const demands={effort:0,focus:0,mode:'awake',requires:{}};
// Profiles and biography copied from HF packages/lab-client/src/cast.ts, revision 1.
const CAST={"rafi":{"castId":"hf.cast.rafi.pass","age":19,"traits":{"honesty":0.55,"emotionality":0.5,"extraversion":0.5,"agreeableness":0.65,"conscientiousness":0.45,"openness":0.5},"values":{"benevolence":0.5,"universalism":0.5,"tradition":0.5,"conformity":0.5,"security":0.5,"achievement":0.5,"power":0.5,"hedonism":0.5,"stimulation":0.5,"selfDirection":0.5},"introduction":"Rafi can tell when an adult has decided that he is a good boy or a bad one. He tries to be entertaining before the decision hardens. At nineteen he has already learned enough service work to know that a kitchen needs him, but not enough confidence to ask clearly for what that work is worth. He sometimes takes a little from the shared jar. The act is theft in the source situation, not a lovable shortcut. He can also stay late washing a pan nobody asked him to touch. Neither act cancels the other."},"sam":{"castId":"hf.cast.sam.smallworks","age":18,"traits":{"honesty":0.65,"emotionality":0.55,"extraversion":0.6,"agreeableness":0.65,"conscientiousness":0.5,"openness":0.8},"values":{"benevolence":0.5,"universalism":0.5,"tradition":0.5,"conformity":0.5,"security":0.5,"achievement":0.8,"power":0.5,"hedonism":0.5,"stimulation":0.7,"selfDirection":0.5},"introduction":"Sam wants to become useful quickly enough that people stop saying he has potential. At eighteen he has spent years hearing that praise, which describes a future he cannot yet show anybody. Repair work gives him visible attempts: the wheel turns or it does not. Games appeal for a similar reason, though he is learning that finding a reproducible problem can be more useful than winning. At Commonstead his in-world playtesting work means recording what he tried and what happened. It does not stand in for actual owner play or an independent lab review."},"aylin":{"castId":"hf.cast.aylin.murmur","age":36,"traits":{"honesty":0.8,"emotionality":0.55,"extraversion":0.55,"agreeableness":0.65,"conscientiousness":0.8,"openness":0.55},"values":{"benevolence":0.5,"universalism":0.5,"tradition":0.5,"conformity":0.5,"security":0.5,"achievement":0.5,"power":0.5,"hedonism":0.5,"stimulation":0.5,"selfDirection":0.5},"introduction":"Aylin keeps a list on the refrigerator because she likes waking without renegotiating the whole day. She became the organised sister gradually: first remembering a school form, then a birthday, then the errand everyone assumed she would handle. Cooking gave that competence a wage and a recognizable endpoint. A hundred lunches served is evidence of work. A family that expects another quiet favour can consume the same effort without ever naming it. She loves Dilan and sometimes needs to stop organizing long enough to enjoy her."}};
const ACTIONS=['hold','errand','wait','take','report','check'];
function author(id,name){return {id,identity:{name,birthAt:-CAST[id].age*365*DAY,castId:CAST[id].castId,sex:id==='aylin'?'female':'male'},biography:[{id:'e0',at:-DAY,kind:'biography',valence:0,salience:.5,summary:CAST[id].introduction,tags:[],basis:{kind:'authored',author:'bench'},provenance:['hf-cast-revision-1']}],origin:{kind:'authored',basis:{kind:'evidence',id:`opening:${id}`},traits:{kind:'explicit-authoring',evidence:{kind:'evidence',id:`profile:${id}`}}},state:{
traits:CAST[id].traits,values:CAST[id].values,
body:{satiety:.8,hydration:.85,sleepPressure:.2,exertion:0,fitness:.5,health:1,pain:0,sleepDebtHours:0,depletion:0,circadianPeakMs:16*3600000,asleep:false,since:0,doze:{context:{posture:'upright',stimulation:.5},basis:{kind:'authored',author:'bench',at:0}},bladder:{fill:0,pending:0},injuries:[],illnesses:[],exposures:[]},
needs:{safety:.8,belonging:.7,esteem:.6,autonomy:.7,competence:.6,leisure:.6,meaning:.6},skills:[],heldNorms:[],beliefs:[],consequences:[],sourceTrust:[],context:{scarcity:{kind:'prior',value:0,basis:'authored:bench'},smoking:{kind:'unobserved'}},relationships:[],voices:[{voiceId:'player',trust:.65}],agenda:{exemptions:{traveling:{kind:'unobserved'},illnessSeverity:{kind:'unobserved'}},commitments:id==='rafi'?[{id:'rafi-errand',kind:'appointment',actions:['errand'],from:45000,until:150000,importance:.9,firm:true,label:'I promised to collect parts.'}]:id==='aylin'?[{id:'aylin-home',kind:'appointment',actions:['take'],from:300000,until:360000,importance:.95,firm:true,label:'My family needs me home.'}]:[],goals:[],precommitments:[],owed:[]},family:{contactCovered:[],aptitudes:{}},groups:[],reserve:{},retention:{trace:32,chronicleDays:120},habits:[],expectations:[],affect:{mood:{valence:0,arousal:.3},regulation:.3,emotions:[]},promptings:{reading:'none',responses:[]},review:{style:'accounting',atMsOfDay:21*3600000},bonds:{courtships:[],marriages:[]}}};}
export function createPeople(seed=1){
 const run=must(createRun({id:'copper-afternoon',seed:seed>>>0,start:0,host:{id:'bench',edition:'prototype-1',schema:'bench-1'},definitions:{actions:ACTIONS.map(id=>({id,label:id,demands,tags:[],norms:[]})),norms:[],marriageCustoms:[],skills:[],skillTransfers:[],methods:[],routines:[],sources:[HOST,VOICE],lexicon:{names:{rafi:'Rafi',aylin:'Aylin',sam:'Sam'},roles:{},prefer:'name',actions:{}},calendar:{id:'afternoon',epoch:{id:'opening',simulationAt:0,dayIndex:0,msOfDay:0},dayMs:DAY,days:[{dayIndex:0,start:0,windows:[]},{dayIndex:1,start:DAY,windows:[]}]}},lifecycle:{kinPremises:[],kinScopes:[]},world:{revision:0,facts:[],hostState:{}}}));
 for(const [id,name]of[['rafi','Rafi'],['aylin','Aylin'],['sam','Sam']])must(createPerson(run,author(id,name)));
 return {run,at:0,serial:0,revisions:{rafi:0,aylin:0,sam:0},active:{},events:[],receipts:[],decisions:[]};
}
function input(p,at,kind,payload,source=HOST){return {id:`bench:${++p.serial}`,at,source,kind,payload};}
// Settle only the activity HF requested. No host person-choice rule is used.
function advance(p,at,inputs=[]){
 let batch=inputs;
 for(let guard=0;guard<100;guard++){
  const result=must(step(p.run,{until:at,inputs:batch}));p.events.push(...result.events);p.at=result.at;
  if(result.boundary.type==='until')return result;
  batch=result.boundary.requests.map(r=>{
   if(r.kind==='communication')return input(p,r.boundaryAt,'communication.resolved',{requestId:r.id,requestHash:r.requestHash,worldRevision:0,speaker:r.speaker,emittedItemIds:[],received:[]});
   const base={requestId:r.id,requestHash:r.requestHash,person:r.person,activityId:r.activityId,stage:r.stage,worldRevision:0,observations:[]};
   if(r.stage==='start'){p.active[r.person]={action:r.offerId,start:r.boundaryAt,id:r.activityId};return input(p,r.boundaryAt,'action.resolved',{...base,disposition:'accepted'});}
   const a=p.active[r.person];delete p.active[r.person];const status=r.stage==='interrupt'?'interrupted':'completed';
   return input(p,r.boundaryAt,'action.resolved',{...base,disposition:status,outcome:{activityId:r.activityId,offerId:r.offerId,actionId:a?.action||r.offerId,start:a?.start??r.boundaryAt,end:r.boundaryAt,status,evidenceId:`outcome:${r.id}`,summary:'The offered action ended.',actual:{exposures:[],observedProgress:[]},fulfills:a?.action==='errand'?['rafi-errand']:[],advances:[]}});
  });
 }
 throw Error('HF boundary budget exceeded');
}
function offer(person,id,duration,needs,extra={}){return {id,actionId:id,label:id,person,durationMs:duration,participants:[],alongside:[],demands,tags:[],norms:[],expected:{needs,followedBy:[],provenance:['authored:bench']},fulfills:[],advances:[],diminishes:[],...extra};}
function choose(p,time,person,offers,request){
 const at=Math.max(p.at+1,Math.round(time*1000));advance(p,at-1);
 if(p.active[person])return {action:p.active[person].action,pending:true};
 const rev=++p.revisions[person],before=p.events.length;
 advance(p,at,[input(p,at,'offers.received',{person,revision:rev,offers}),input(p,at,'suggestion.received',{person,received:{kind:'ordinary',suggestion:{adviceId:`request:${p.serial}`,voiceId:'player',affordanceId:request,strength:.8}}},VOICE),input(p,at,'decision.requested',{person,reason:'A request at the repair bench',treatment:'ordinary',offerRevision:rev})]);
 const action=p.active[person]?.action;
 const events=p.events.slice(before);const resolution=events.find(e=>e.data?.kind==='suggestion-resolved')?.data.resolution;
 // Withdraw stale choices while preserving the accepted activity through its true end.
 advance(p,at+1,[input(p,at+1,'offers.received',{person,revision:++p.revisions[person],offers:[]})]);
 const result={action:action||'none',resolution};p.decisions.push({person,at,...result});return result;
}
export function decideRafi(p,time){
 const r=choose(p,time,'rafi',[offer('rafi','hold',30000,{belonging:.16,competence:.08},{target:'player'}),offer('rafi','errand',30000,{meaning:.08},{fulfills:['rafi-errand']})],'hold');
 const agreed=r.action==='hold';return {...r,agreed,until:agreed?(p.active.rafi.start+30000)/1000:time,reason:agreed?'Thirty seconds. Then I go.':'I promised to collect parts.'};
}
export function observe(p,time,kind,summary,valence=0){
 let at=Math.max(p.at+1,Math.round(time*1000));const received=[];
 for(const person of ['rafi','sam','aylin']){
  at=Math.max(at,p.at+1);
  // Aylin is away until the real return; never invent witness knowledge.
  if(person==='aylin'&&time<240&&kind!=='promise')continue;
  const id=`seen:${++p.serial}:${person}`;received.push(person);
  const payload={person,evidenceId:id,percepts:[{id,occurredAt:at,channel:['promise','admission','promise-kept','promise-broken'].includes(kind)?'told':'saw',kind,actorId:'player',targetId:person,valence,salience:1,summary,claims:[],norms:[],advice:[],consequences:[],withdrawConsequences:[],witnesses:[],reports:[],provenance:['bench']}]};
  advance(p,at,[input(p,at,'observation.received',payload)]);
  if(person==='aylin'&&(kind==='promise-kept'||kind==='promise-broken'))advance(p,at+1,[input(p,at+1,'voice.promise-received',{person,evidenceId:`promise:${id}`,voiceId:'player',promise:{kept:kind==='promise-kept',action:'wait'}})]);
 }
 const receipt={at,kind,summary,received};p.receipts.push(receipt);return receipt;
}
export function decideAylin(p,time,options={}){
 // Offer consequences are explicit world premises, not a host score or final choice.
 const ready=Boolean(options.bellFixed||options.lampFixed);
 const r=choose(p,time,'aylin',[offer('aylin','wait',30000,{belonging:.08,competence:ready?0:.12},{target:'player'}),offer('aylin','take',1000,{autonomy:.12,safety:ready?.16:.04},{fulfills:['aylin-home'],expected:{needs:{autonomy:.12,safety:ready?.16:.04},material:ready?6:.5,followedBy:[],provenance:['authored:repaired-object-usefulness']}})],'wait');
 const wait=r.action==='wait';return {...r,wait,reason:wait?'Thirty more seconds. Please.':r.resolution?.reason==='commitment:aylin-home'?'My family needs me home.':ready?'I will take this home.':'I need to take it home.'};
}
export function peopleReading(p){return must(inspect(p.run,{perspective:{kind:'host'},people:['rafi','aylin','sam'],select:['summary','events','agenda']}));}
