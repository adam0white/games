// Headless semantic play, independent of rendering. Run: node bots.mjs
import assert from 'node:assert/strict';
import {create,step,DT,good} from './sim.js';
import {createPeople,decideRafi,observe,decideAylin,peopleReading} from './people.js';
function wait(s,seconds){const end=s.t+seconds;while(!s.over&&s.t<end)step(s);}
function action(s,a){step(s,[a]);while(s.operation&&!s.over)step(s);}
function cart(s){action(s,{type:'open'});action(s,{type:'tool',tool:'pliers'});action(s,{type:'pull',part:'pin'});assert.equal(s.cart.pin,null);action(s,{type:'fit',part:'pin'});action(s,{type:'test'});assert.equal(s.cart.fixed,true);}
function bell(s,correct=true){action(s,{type:'switch',object:'bell'});action(s,{type:'open'});action(s,{type:'fit',part:'coupling'});action(s,{type:'tool',tool:'wrench'});action(s,{type:'fasten'});if(correct){action(s,{type:'tool',tool:'pliers'});action(s,{type:'spacer-pull'});action(s,{type:'fit',part:'spacer',target:'striker'});}action(s,{type:'test'});}
function end(s){while(!s.over)step(s);return {ending:s.over,seconds:s.t,delivered:s.delivered,cart:s.cart.fixed,bell:s.bell.fixed,lamp:s.lamp.fixed,broken:s.broken,decisions:s.log.filter(x=>x.kind.endsWith('choice')).map(x=>({who:x.kind,action:x.action,reason:x.reason}))};}
const policies={
 'careful bell':s=>{cart(s);action(s,{type:'aylin'});bell(s);},
 'wrong spacer':s=>{cart(s);bell(s,false);assert.equal(s.bell.fixed,false);},
 'loose lamp':s=>{cart(s);action(s,{type:'switch',object:'lamp'});action(s,{type:'open'});action(s,{type:'fit',part:'coupling'});action(s,{type:'test'});assert(s.broken);},
 'lamp reversed':s=>{cart(s);action(s,{type:'switch',object:'lamp'});action(s,{type:'open'});action(s,{type:'fit',part:'coupling'});action(s,{type:'tool',tool:'wrench'});action(s,{type:'fasten'});action(s,{type:'test'});assert(!s.lamp.fixed);action(s,{type:'fasten'});action(s,{type:'rotate'});action(s,{type:'fasten'});action(s,{type:'test'});assert(s.lamp.fixed);},
 'change plan':s=>{cart(s);bell(s);action(s,{type:'tool',tool:'wrench'});action(s,{type:'fasten'});action(s,{type:'tool',tool:'pliers'});action(s,{type:'pull',part:'coupling'});assert.equal(s.coupling,'tray');assert(!s.bell.fixed);action(s,{type:'switch',object:'lamp'});action(s,{type:'open'});action(s,{type:'fit',part:'coupling'});action(s,{type:'rotate'});action(s,{type:'tool',tool:'wrench'});action(s,{type:'fasten'});action(s,{type:'test'});assert(s.lamp.fixed);},
 'neglect':s=>action(s,{type:'open'}),
};
const outcomes=new Set();for(const [name,policy]of Object.entries(policies)){const s=create(17);policy(s);const result=end(s);outcomes.add(result.ending);console.log(name,JSON.stringify(result));assert(result.seconds>=360&&result.seconds<360+DT);}
assert(outcomes.size>1,'Runs must end in more than one way.');
// Independent known bad configurations and recovery: failed silent strike must stay failed.
const repair=create(8);cart(repair);bell(repair,false);assert(!good(repair,'bell'));action(repair,{type:'tool',tool:'pliers'});action(repair,{type:'spacer-pull'});action(repair,{type:'fit',part:'spacer',target:'striker'});action(repair,{type:'test'});assert(good(repair,'bell'));
// Refusal changes sequence. Clamp blocks bell before the cart rolls straight.
const blocked=create(7);action(blocked,{type:'switch',object:'bell'});action(blocked,{type:'open'});assert(!blocked.bell.open);
const helper=create(7);action(helper,{type:'rafi'});assert(helper.rafi.holding);action(helper,{type:'switch',object:'bell'});action(helper,{type:'open'});assert(helper.bell.open);wait(helper,28.5);assert(!helper.rafi.holding);assert(!helper.broken);
const h=createPeople(7);assert(decideRafi(h,0).agreed);assert(!decideRafi(h,70).agreed);assert(decideRafi(h,200).agreed);peopleReading(h);
// Matched memory control: same geometry, same request, actual earlier received promise event differs.
const decisions=[];for(const kept of [true,false]){const p=createPeople(7);observe(p,1,'promise','The repairer promised the bell before return.',.2);observe(p,240,kept?'promise-kept':'promise-broken',kept?'The promise was kept.':'The promise was broken.',kept?.6:-.7);decisions.push(decideAylin(p,240,{bellFixed:true,lampFixed:false,damaged:false}).action);}
assert.notEqual(decisions[0],decisions[1]);console.log('matched HF memory',JSON.stringify(decisions));
// Fixed seed, identical actions, identical outcome and HF decisions.
const one=create(31),two=create(31);policies['careful bell'](one);policies['careful bell'](two);assert.deepEqual(end(one),end(two));assert.deepEqual(one.log,two.log);
console.log('PASS: endings, seeded determinism, bad configurations, recovery, clamp, HF refusal and received memory.');
// Review regressions: disassembly invalidates received test evidence.
const dismantled=create(7);cart(dismantled);bell(dismantled);action(dismantled,{type:'tool',tool:'wrench'});action(dismantled,{type:'fasten'});assert(!dismantled.bell.fixed&&!dismantled.bell.tested);assert(!good(dismantled,'bell'));end(dismantled);assert.equal(dismantled.delivered,null);
const removedSpacer=create(7);cart(removedSpacer);bell(removedSpacer);action(removedSpacer,{type:'spacer-pull'});assert(!removedSpacer.bell.fixed&&!removedSpacer.bell.tested);
// A pre-existing valid test counts when the promise is made afterwards.
const afterTest=create(7);cart(afterTest);bell(afterTest);action(afterTest,{type:'aylin'});wait(afterTest,241-afterTest.t);assert(afterTest.promiseKept);
// HF take actually removes an unrepaired object. A departed coupling cannot be reclaimed.
const returned=create(17);cart(returned);bell(returned);end(returned);assert(returned.bell.gone);const oldCoupling=returned.coupling;returned.over=null;returned.active='bell';action(returned,{type:'tool',tool:'wrench'});action(returned,{type:'fasten'});assert.equal(returned.coupling,oldCoupling);assert(returned.fastened);
const unfinished=create(7);action(unfinished,{type:'open'});end(unfinished);assert(unfinished.bell.gone);assert.equal(unfinished.delivered,null);
console.log('PASS: review regressions: invalidated tests, departed parts, unrepaired return, existing-test promise.');
