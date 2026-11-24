// Node-only acceptance against the public rules. No hidden teleport or progress writes.
// --mutate changes the real completion requirement from 1x to 2x. Fetch tasks
// then demand twice as many objects as the meadow contains; acceptance must fail.
import assert from 'node:assert/strict';
import { create, step, guide, DAY, DT, RESIDENTS, peekQuest } from './sim.js';
const mutate = process.argv.includes('--mutate');
assert.equal(DAY,180,'nightfall is three minutes');
const copy = value => JSON.parse(JSON.stringify(value));
function rng(seed) { let v = seed >>> 0; return () => { v = Math.imul(1664525, v) + 1013904223 >>> 0; return v / 4294967296; }; }
function controller(seed, clumsy = false) {
  const rand = rng(seed ^ 0x19a57), state = { next: 0, target: null, pause: false };
  return s => {
    if (!state.target || s.t >= state.next) {
      const g = guide(s);
      state.next = s.t + (clumsy ? .55 + rand() * .65 : DT);
      state.target = { x: g.x + (clumsy ? (rand() - .5) * 32 : 0), y: g.y + (clumsy ? (rand() - .5) * 32 : 0) };
      state.pause = clumsy && rand() < .12;
    }
    const dx = state.target.x - s.player.x, dy = state.target.y - s.player.y, d = Math.hypot(dx, dy);
    const strength = clumsy ? .46 : 1;
    return d < (clumsy ? 8 : 2) || state.pause ? { x: 0, y: 0 } : { x: dx / d * strength, y: dy / d * strength };
  };
}
function run(seed, clumsy = false) {
  const s = create({ seed }), control = controller(seed, clumsy), offered = [], inputs = [];
  if (mutate) s.rules.requirementMultiplier = 2;
  while (s.status === 'play') {
    const input = control(s); inputs.push(input); step(s, input);
    for (const event of s.events) if (event.type === 'offer') offered.push(copy(s));
  }
  return { s, offered, inputs };
}
function oneQuest(snapshot, seed) {
  const s = copy(snapshot), id = s.quest.id, control = controller(seed, true), initial = s.completed.length;
  while (s.status === 'play' && s.quest?.id === id) step(s, control(s));
  return s.completed.length > initial;
}
let kinds = new Set(), times = [], clumsyWins = 0, clumsyFirst = 0;
const stage = [null, { won: 0, n: 0 }, { won: 0, n: 0 }, { won: 0, n: 0 }];
for (let seed = 1; seed <= 40; seed++) {
  const careful = run(seed);
  assert.equal(careful.s.status, 'won', `careful seed ${seed} must befriend all four residents`);
  assert.equal(careful.s.failed, 0, `careful seed ${seed} must finish every first offer`);
  assert.equal(careful.s.completed.length, 12);
  for(const original of careful.offered){
    const snap=copy(original);const move=controller(seed),id=snap.quest.id;while(snap.status==='play'&&snap.quest?.id===id)step(snap,move(snap));
    // Each actual completion removes one more hunter for the frog.
    if(snap.completed.length){assert.equal(snap.hunters.length,3-snap.friends.frog);}
  }
  assert.ok(careful.s.t >= 60 && careful.s.t <= DAY, 'a perfect run lasts one to three minutes');
  for (const task of careful.s.completed) kinds.add(task.kind);
  times.push(careful.s.t);
  for (const snap of careful.offered) {
    stage[snap.quest.stage].n++;
    if (oneQuest(snap, seed * 97 + snap.tick)) stage[snap.quest.stage].won++;
  }
  const clumsy = run(seed, true);
  if (clumsy.s.status === 'won') clumsyWins++;
  if (clumsy.s.completed.some(q => q.giver === 'beetle' && q.stage === 1)) clumsyFirst++;
  // Replay identical input instead of consulting the guide a second time.
  const replay = create({ seed });
  for (const input of careful.inputs) step(replay, input);
  assert.deepEqual(replay, careful.s, `same seed and stick input replay exactly (${seed})`);
}
assert.deepEqual([...kinds].sort(), ['escort', 'fetch', 'hide', 'hunt', 'race']);
assert.equal(clumsyFirst, 40, 'every clumsy bot must finish the opening quest');
assert.equal(clumsyWins, 0, 'the clumsy bot must not befriend everyone');
const rates = stage.slice(1).map(v => v.won / v.n);
assert.ok(rates[0] > rates[1] && rates[1] > rates[2], `success falls at each heart: ${rates}`);

// Independent boundary cases: inactivity ends the run; it cannot award hearts.
const idle = create({ seed: 8 });
while (idle.status === 'play') step(idle, { x: 0, y: 0 });
assert.equal(idle.status, 'night'); assert.equal(idle.completed.length, 0);
assert.ok(idle.t <= DAY + DT);
// Preview is stable, legal and side-effect free, including failed quest retry IDs.
const preview = create({ seed: 12 }), before = copy(preview);
for (const r of RESIDENTS) {
  const q = peekQuest(preview, r.id);
  assert.equal(q.giver, r.id); assert.ok(q.count >= 1 && q.count <= 9);
  assert.ok(q.variant >= 0 && q.variant <= 3); assert.deepEqual(q, peekQuest(preview, r.id));
}
assert.deepEqual(preview, before);
// A timed-out task can be offered and completed again without resetting a run.
const retry = create({ seed: 9 }); retry.player = { ...retry.player, x: 64, y: 385 };
step(retry); const firstId = retry.quest.id;
while (retry.failed === 0) step(retry);
assert.equal(retry.memory.beetle.failed, true);
while (!retry.quest) step(retry);
assert.notEqual(retry.quest.id, firstId);
const retryControl = controller(9);
while (retry.quest && retry.status === 'play') step(retry, retryControl(retry));
assert.equal(retry.friends.beetle, 1); assert.equal(retry.memory.beetle.failed, false);
// World rewards change observable movement, not merely their saved labels.
function travel(world, x, y, input) {
  const s = create({ seed: 3 }); Object.assign(s.world, world); s.player.x = x; s.player.y = y;
  step(s, input); return s.player;
}
assert.ok(travel({ rockOpen: 1 }, 180, 340, { x: 1 }).x > travel({}, 180, 340, { x: 1 }).x);
for(let level=1;level<=3;level++){
  const here=180+22*level;
  assert.ok(travel({rockOpen:level},here,340,{x:1}).x>travel({rockOpen:level-1},here,340,{x:1}).x,'each beetle heart speeds the rocky path');
  assert.ok(travel({trail:level},75,200,{y:1}).y>travel({trail:level-1},75,200,{y:1}).y,'each snail heart speeds its trail');
  const edge=180+25+level*17-2;
  assert.ok(travel({bridge:level},edge,250,{y:1}).y>travel({bridge:level-1},edge,250,{y:1}).y,'each spider heart widens the bridge');
}
assert.ok(travel({ trail: 1 }, 75, 200, { y: 1 }).y > travel({}, 75, 200, { y: 1 }).y);
assert.ok(travel({ bridge: 1 }, 180, 250, { y: 1 }).y > travel({}, 180, 250, { y: 1 }).y);
console.log(JSON.stringify({ careful: { wins: 40, runs: 40, firstOfferFailures: 0, secondsMin: +Math.min(...times).toFixed(2), secondsMax: +Math.max(...times).toFixed(2), allTaskKinds: [...kinds].sort() }, clumsy: { openingCompleted: clumsyFirst, runs: 40, allFriendsWins: clumsyWins }, heartDifficulty: stage.slice(1).map((v, i) => ({ heart: i + 1, ...v, percent: +(100 * v.won / v.n).toFixed(1) })), determinism: '40 full input replays equal', mutation: mutate ? 'ACTIVE' : 'run --mutate; must exit non-zero', idle: 'nightfall with zero hearts' }, null, 2));
