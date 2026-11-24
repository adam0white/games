import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addAnt, addFood, step } from '../src/sim.mjs';
import { driveFeastPerson, summarizeFeastFairness } from '../loadtest/bots.mjs';

function scene() {
  const w=createWorld(42,'feast'),a=addAnt(w,0,false,0,0),b=addAnt(w,0,true,0,0);
  Object.assign(a,{x:1600,y:1600,mass:50,protectUntil:0});
  Object.assign(b,{x:1700,y:1600,mass:25,protectUntil:0});
  step(w);w.tick=5;
  return {w,a,b};
}

test('Feast person hunts visible edible ants with ordinary input only',()=>{
  const {w,a}=scene(),before={...a};
  driveFeastPerson(w,a);
  assert.equal(a.sprint,true);assert.equal(a.move,true);assert.equal(a.angle,0);
  for(const key of Object.keys(before))if(!['angle','move','sprint','inputTick'].includes(key))assert.deepEqual(a[key],before[key],key);
});

test('passive Feast person follows crumbs instead of prey; hidden prey has no effect',()=>{
  const {w,a,b}=scene();
  addFood(w,1600,1700,1);
  driveFeastPerson(w,a,true);
  assert.equal(a.sprint,false);assert.equal(a.angle,64);
  b.x=2000; // Outside the phone viewport, even though within network interest.
  driveFeastPerson(w,a);
  assert.equal(a.sprint,false);assert.equal(a.angle,64);
});

test('Feast person flees visible danger and rests inside grass',()=>{
  const {w,a,b}=scene();b.mass=100;
  driveFeastPerson(w,a);assert.equal(a.sprint,true);assert.equal(a.angle,128);
  a.x=1260;a.y=1420;b.x=1350;b.y=1420;
  // The ant grid is refreshed by the simulation, not by the controller.
  step(w);w.tick=10;
  driveFeastPerson(w,a);assert.equal(a.move,false);assert.equal(a.sprint,false);
});

test('fairness assertions reject the reported failure pattern',()=>{
  const person={eats:1,deaths:7,medianRank:19,bestPosition:18,finalRank:19,largestBotRatio60:3};
  const base={people:1,seed:1,person,persons:[person],botEats:2,firstBotQueen:27};
  const [summary]=summarizeFeastFairness([ {...base,passive:false},{...base,passive:true,person:{...person,finalRank:1}} ]);
  assert.deepEqual(Object.values(summary.targets),Array(8).fill(false));
});

test('Feast person respects the visible conservative size threshold',()=>{
  const {w,a,b}=scene();a.mass=32;b.mass=25.1;
  addFood(w,1600,1700,1);
  driveFeastPerson(w,a);
  assert.equal(a.sprint,false);assert.equal(a.angle,64);
});

test('fairness assertions include every equivalent person and every passive round',()=>{
  const good={id:24,eats:8,deaths:0,medianRank:4,bestPosition:1,finalRank:4,largestBotRatio60:1};
  const bad={...good,id:23,eats:0,deaths:7,medianRank:24,bestPosition:24,largestBotRatio60:3};
  const base={people:12,seed:1,person:good,persons:[good,bad],botEats:20,firstBotQueen:null};
  const [summary]=summarizeFeastFairness([
    {...base,passive:false},
    {...base,passive:true,person:{...good,finalRank:24}},
    {...base,seed:7,passive:true,person:{...good,finalRank:12}},
  ]);
  assert.equal(summary.personRounds,2);
  assert.equal(summary.designatedPerson.maxDeaths,0);
  assert.equal(summary.targets.deaths,false);
  assert.equal(summary.targets.sizeRatio,false);
  assert.equal(summary.targets.passive,false);
  assert.equal(summary.topFiveCount,1);
  assert.deepEqual(summary.personFailures,[{seed:1,id:23,failures:['eats','deaths','rank','topFive','sizeRatio']}]);
  assert.deepEqual(summary.passiveFailures,[{seed:7,id:24,finalRank:12}]);
});
