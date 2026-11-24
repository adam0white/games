// Pure Node, seeded six-minute comparison. No network; people use a separate scripted forager.
// node loadtest/bots.mjs [--bots ./src/.bots-before.mjs] [--seeds 1,7,42]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as C from '../public/crumbwar/shared/config.js';
import { GRASS, inGrass } from '../public/crumbwar/shared/modes.js';
import { byteOf } from '../public/crumbwar/shared/move.js';
import { createWorld, addAnt, setInput, foodNear, antsNear, step } from '../src/sim.mjs';

// Exact maximum count in a closed radius-r disk with an arbitrary center.
// An optimum disk can move until two points touch its boundary. Check both
// possible centers for every pair, and point centers for coincident points.
export function largestCluster(ants, radius = 40) {
  const points = ants.filter(a => a && a.alive);
  if (!points.length) return 0;
  let best = 1;
  const r2 = radius * radius, epsilon = 1e-7;
  const count = (x, y) => {
    let n = 0;
    for (const p of points) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r2 + epsilon) n++;
    best = Math.max(best, n);
  };
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    count(a.x, a.y);
    for (let j = i + 1; j < points.length; j++) {
      const b = points[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (!d2 || d2 > 4 * r2 + epsilon) continue;
      const h = Math.sqrt(Math.max(0, r2 - d2 / 4) / d2);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      count(mx - dy * h, my + dx * h);
      count(mx + dy * h, my - dx * h);
    }
  }
  return best;
}

// Independent simple foraging control. Same vision, 4 Hz cadence, input call
// and aim error. Nearest visible food; home when carrying; center when searching.
export function drivePerson(w, a) {
  if (!a.alive || (w.tick + a.id) % 5) return;
  let tx = C.WORLD / 2, ty = C.WORLD / 2;
  if (a.carry) [tx, ty] = C.NESTS[a.colony];
  else {
    let best = -1, bd = Infinity;
    foodNear(w, a.x, a.y, C.VIEW, id => {
      const d = (w.fx[id] - a.x) ** 2 + (w.fy[id] - a.y) ** 2;
      if (d < bd) { best = id; bd = d; }
    });
    if (best >= 0) { tx = w.fx[best]; ty = w.fy[best]; }
  }
  const aim = Math.atan2(ty - a.y, tx - a.x) + (w.rand() - 0.5) * 0.35;
  setInput(w, a, byteOf(aim), true, false);
}

export const median = values => {
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
export function scoreCV(scores) {
  const mean = scores.reduce((sum, x) => sum + x, 0) / scores.length;
  return mean ? Math.sqrt(scores.reduce((sum, x) => sum + (x - mean) ** 2, 0) / scores.length) / mean : 0;
}

export function measure(bots, people, seed) {
  const w = createWorld(seed);
  // Match room joins: balance after each person joins.
  for (let i = 0; i < people; i++) { addAnt(w, bots.pickColony(w), false, 0, 0); bots.balance(w); }
  bots.balance(w);
  const occupancy = [];
  let bites = 0, humanBittenTicks = 0, humanKilled = 0, humanNestDeaths = 0;
  for (let t = 0; t < 6 * 60 * C.TICK_HZ; t++) {
    for (const a of w.ants) if (a) (a.bot ? bots.think : drivePerson)(w, a);
    const previousBiteAt = w.ants.map(a => a?.biteAt);
    step(w);
    for (const a of w.ants) if (a && a.biteAt > previousBiteAt[a.id]) bites++;
    for (const [type, killer, victim] of w.events) if (type === 1 && !w.ants[victim].bot) {
      if (killer === 255) humanNestDeaths++;
      else humanKilled++;
    }
    // Applied damage ticks, including lethal bites. Simultaneous bites count
    // once. Exclude enemy-nest guard damage (this forager stays near home/food).
    for (const a of w.ants) if (a && !a.bot && a.hurtAt === w.tick &&
      !C.NESTS.some(([x, y], c) => c !== a.colony && Math.hypot(a.x - x, a.y - y) < C.NEST_R)) humanBittenTicks++;
    // No startup exclusion. Seconds 1 through 360, all living ants.
    if (w.tick % C.TICK_HZ === 0) occupancy.push(largestCluster(w.ants));
  }
  const foodPoints = [...w.colonyScore];
  return {
    people, seed, seconds: occupancy.length, median: median(occupancy), max: Math.max(...occupancy),
    crowdedSeconds: occupancy.filter(n => n >= 6).length,
    crowdedPercent: occupancy.filter(n => n >= 6).length / occupancy.length * 100,
    foodPoints, bites, deaths: w.ants.reduce((sum, a) => sum + (a?.deaths ?? 0), 0),
    colonyDeaths: Array.from({ length: 4 }, (_, c) => w.ants.reduce((sum, a) => sum + (a?.colony === c ? a.deaths : 0), 0)),
    humanBittenTicks, humanKilled, humanNestDeaths, humanDeaths: w.ants.reduce((sum, a) => sum + (a && !a.bot ? a.deaths : 0), 0),
    scoreCV: scoreCV(foodPoints), occupancy,
  };
}

// Time only the full bot decision pass, including staggered no-op calls.
// Sim and human work are outside the interval. Warm the JIT for 200 ticks.
export function timeDecisions(bots, seed = 42) {
  const w = createWorld(seed);
  const person = addAnt(w, bots.pickColony(w), false, 0, 0);
  bots.balance(w);
  let ms = 0, ticks = 0;
  for (let t = 0; t < 6 * 60 * C.TICK_HZ; t++) {
    drivePerson(w, person);
    const start = performance.now();
    for (const a of w.ants) if (a?.bot) bots.think(w, a);
    const elapsed = performance.now() - start;
    if (t >= 200) { ms += elapsed; ticks++; }
    step(w);
  }
  return ms / ticks;
}

// Phone viewport follows client.js: the longer side displays 1100 world units.
// These are screen encounters, rather than the larger interest-management square.
export const TARGETS = Object.freeze({ firstGrowthSeconds: 10, firstScoreSeconds: 15,
  deathsPerMinute: 2, socialPercent: 70, feastTopHalfBySeconds: 120,
  feastLeaderChanges: 1, rushEventKinds: 3, rushScoreCV: 0.4 });

export function driveModePerson(w, a) {
  if (w.rules.name === 'classic') return drivePerson(w, a);
  if (!a.alive || (w.tick + a.id) % 5) return;
  let tx = C.WORLD / 2, ty = C.WORLD / 2, best = -1, bd = Infinity;
  if (w.rules.colonies && a.carry) [tx, ty] = C.NESTS[a.colony];
  else {
    foodNear(w, a.x, a.y, C.VIEW, id => {
      const d = (w.fx[id] - a.x) ** 2 + (w.fy[id] - a.y) ** 2;
      if (d < bd) { best = id; bd = d; }
    });
    if (best >= 0) { tx = w.fx[best]; ty = w.fy[best]; }
  }
  // Follow one visible personal goal at a time. The map marker is public.
  let holdHill = false;
  if (w.rules.name === 'rush' && !a.carry) {
    if (a.goal === 1) { tx = 1600; ty = 1600; holdHill = Math.hypot(a.x - tx, a.y - ty) < w.rules.hillRadius * .6; }
    else if (a.goal === 2 && w.feature.kind === 2) { tx = w.feature.x; ty = w.feature.y; }
  }
  // A simple person also retreats from a visibly larger ant. This uses the
  // readable size ratio and the same 4 Hz decision cadence, not future state.
  let danger = null, nearest = 180;
  if (w.rules.name === 'feast') antsNear(w, a.x, a.y, C.VIEW, other => {
    if (other === a || w.tick < other.protectUntil || other.mass < a.mass * w.rules.eatRatio) return;
    const d = Math.hypot(other.x - a.x, other.y - a.y);
    if (d < nearest) { nearest = d; danger = other; }
  });
  if (danger) { tx = a.x + a.x - danger.x; ty = a.y + a.y - danger.y; }
  // No combat targeting, global food coordinates, sprint, or hidden state.
  // Stop on a visible cake to chew it; ordinary crumbs are picked up while moving.
  const chewing = w.rules.name === 'feast' && best >= 0 && w.fkind[best] === 3 && bd < 12 * 12 && !danger;
  setInput(w, a, byteOf(Math.atan2(ty - a.y, tx - a.x) + (w.rand() - .5) * .35), !chewing && !holdHill, false);
}

export function measureMode(bots, mode, people = 1, seed = 42, warmupSeconds = 10) {
  const w = createWorld(seed, mode), humans = [];
  // Match a fresh room: bots already forage before the first person joins.
  bots.balance(w);
  for (let t = 0; t < warmupSeconds * C.TICK_HZ; t++) {
    for (const a of w.ants) if (a?.bot) bots.think(w, a);
    step(w);
  }
  const joinedTick = w.tick;
  for (let i = 0; i < people; i++) { humans.push(addAnt(w, bots.pickColony(w), false, 0, 0)); bots.balance(w); }
  bots.balance(w);
  const person = humans[0], startMass = person.mass, seconds = (w.roundEnd - joinedTick) / C.TICK_HZ;
  let firstProgress = null, deaths = 0, social = 0, seenSeconds = 0, firstTopHalf = null;
  let leader = null, leaderChanges = 0, bestRank = 0;
  const eventKinds = new Set(), leaderIds = new Set();
  for (let t = 0; t < seconds * C.TICK_HZ; t++) {
    for (const a of w.ants) if (a) (a.bot ? bots.think : driveModePerson)(w, a);
    step(w);
    if (firstProgress === null && (mode === 'feast' ? person.mass > startMass : person.score > 0)) firstProgress = (w.tick - joinedTick) / C.TICK_HZ;
    for (const [type, , victim] of w.events) {
      if (type === 1 && victim === person.id) deaths++;
      // Rush participation is counted from its cumulative per-ant bitset below.
    }
    bestRank = Math.max(bestRank, person.rank ?? 0);
    if (w.tick % C.TICK_HZ === 0) {
      seenSeconds++;
      if (person.alive && w.ants.some(a => a && a !== person && a.alive &&
        Math.abs(a.x - person.x) <= 1100 * 390 / 844 / 2 && Math.abs(a.y - person.y) <= 550)) social++;
      if (mode === 'feast') {
        const ranked = w.ants.filter(a => a?.alive).sort((a, b) => b.mass - a.mass || a.id - b.id);
        const position = ranked.indexOf(person);
        if (firstTopHalf === null && person.mass > startMass && position >= 0 && position < ranked.length / 2) firstTopHalf = (w.tick - joinedTick) / C.TICK_HZ;
        if (ranked[0]) { const id = ranked[0].id; if (leader !== null && id !== leader) leaderChanges++; leader = id; leaderIds.add(id); }
      }
    }
  }
  const result = { mode, people, seed, warmupSeconds, seconds, ants: w.count, firstProgressSeconds: firstProgress,
    deaths, deathsPerMinute: deaths / (seconds / 60), socialPercent: social / seenSeconds * 100 };
  result[mode === 'feast' ? 'firstGrowthSeconds' : 'firstScoreSeconds'] = firstProgress;
  if (mode === 'feast') Object.assign(result, { firstTopHalfSeconds: firstTopHalf, bestRank,
    leaderChanges, distinctLeaders: leaderIds.size });
  if (mode === 'rush') for (let bit = 1; bit <= 16; bit *= 2) if ((person.participation ?? 0) & bit) eventKinds.add(bit);
  if (mode === 'rush') Object.assign(result, { eventKinds: [...eventKinds].sort((a,b)=>a-b),
    distinctEventKinds: eventKinds.size, colonyScores: [...w.colonyScore],
    colonyScoreRange: Math.max(...w.colonyScore) - Math.min(...w.colonyScore), scoreCV: scoreCV(w.colonyScore) });
  result.targets = { firstProgress: firstProgress !== null && firstProgress <= (mode === 'feast' ? TARGETS.firstGrowthSeconds : TARGETS.firstScoreSeconds),
    deaths: result.deathsPerMinute <= TARGETS.deathsPerMinute, social: result.socialPercent >= TARGETS.socialPercent };
  if (mode === 'feast') Object.assign(result.targets, { topHalf: firstTopHalf !== null && firstTopHalf <= TARGETS.feastTopHalfBySeconds, leaderChanges: leaderChanges >= TARGETS.feastLeaderChanges });
  if (mode === 'rush') Object.assign(result.targets, { variety: eventKinds.size >= TARGETS.rushEventKinds, colonySpread: result.scoreCV <= TARGETS.rushScoreCV });
  return result;
}

// The controller reads only information drawn on the phone: positions and rounded
// sizes in its 390×844 viewport, protection, grass and food. It writes normal input.
// No velocity, bot intent, future state, global prey search or mass mutation.
export function driveFeastPerson(w, a, passive = false) {
  if (!a.alive || (w.tick + a.id) % 5) return;
  const own = Math.round(a.mass * 4) / 4;
  const visible = (x, y) => Math.abs(x-a.x) <= 1100*390/844/2 && Math.abs(y-a.y) <= 550;
  let danger = null, dangerDistance = 200, prey = null, preyDistance = Infinity;
  antsNear(w, a.x, a.y, C.VIEW, b => {
    if (b === a || !visible(b.x,b.y) || w.tick < b.protectUntil || inGrass(b.x,b.y)) return;
    const distance = Math.hypot(b.x-a.x,b.y-a.y), size = Math.floor(b.mass);
    if (size+1 >= Math.max(10,own-.125)*w.rules.eatRatio && distance < dangerDistance) { danger=b; dangerDistance=distance; }
    if (!passive && Math.max(10,own-.125) >= (size+1)*w.rules.eatRatio && distance < preyDistance) { prey=b; preyDistance=distance; }
  });
  let tx=1600,ty=1600,food=-1,foodDistance=Infinity,sprint=false;
  foodNear(w,a.x,a.y,C.VIEW,id=>{
    if (!visible(w.fx[id],w.fy[id]) || passive && w.fkind[id]===3) return;
    const distance=Math.hypot(w.fx[id]-a.x,w.fy[id]-a.y);
    if(distance<foodDistance){food=id;foodDistance=distance;tx=w.fx[id];ty=w.fy[id];}
  });
  if(prey && preyDistance < 330 && w.tick >= a.protectUntil) {tx=prey.x;ty=prey.y;sprint=true;}
  if(danger) {
    sprint=true;
    tx=a.x+(a.x-danger.x)*3;ty=a.y+(a.y-danger.y)*3;
    // Take a nearby grass refuge only when it lies away from the predator.
    let best=Infinity;
    for(const [gx,gy] of GRASS) {
      const distance=Math.hypot(gx-a.x,gy-a.y);
      if(distance<220 && distance<best && (gx-a.x)*(a.x-danger.x)+(gy-a.y)*(a.y-danger.y)>0){tx=gx;ty=gy;best=distance;}
    }
    if(inGrass(a.x,a.y)) {setInput(w,a,a.angle,false,false);return;}
  }
  const chewing=food>=0 && w.fkind[food]===3 && foodDistance<12 && !danger && !sprint;
  setInput(w,a,byteOf(Math.atan2(ty-a.y,tx-a.x)),!chewing,sprint);
}

export function measureFeastFairness(bots, people=1, seed=42, passive=false, warmupSeconds=0) {
  const w=createWorld(seed,'feast'), humans=[];
  bots.balance(w);
  for(let t=0;t<warmupSeconds*C.TICK_HZ;t++) {for(const a of w.ants) if(a?.bot) bots.think(w,a);step(w);}
  const joinedTick=w.tick;
  for(let i=0;i<people;i++){humans.push(addAnt(w,0,false,0,0));bots.balance(w);}
  const ranks=humans.map(()=>[]),best=humans.map(()=>w.count),ratios=humans.map(()=>null);
  let botEats=0,firstBotQueen=null;
  const seconds=(w.roundEnd-joinedTick)/C.TICK_HZ;
  for(let t=0;t<seconds*C.TICK_HZ;t++) {
    for(const a of w.ants) if(a) a.bot?bots.think(w,a):driveFeastPerson(w,a,passive && a===humans[0]);
    step(w);
    const elapsed=(w.tick-joinedTick)/C.TICK_HZ;
    for(const [type,killer,victim] of w.events) if(type===1 && w.ants[killer]?.bot && w.ants[victim]?.bot) botEats++;
    const allBots=w.ants.filter(a=>a?.bot);
    if(firstBotQueen===null && allBots.some(a=>a.bestRank>=5)) firstBotQueen=(w.tick-w.roundStart)/C.TICK_HZ;
    if(w.tick%C.TICK_HZ===0) {
      // Match room.mjs: integer score, stable ant-ID ties, including respawns.
      // No dead seconds are excluded from the median.
      const ordered=w.ants.filter(Boolean).sort((a,b)=>b.score-a.score || a.id-b.id);
      humans.forEach((a,i)=>{const rank=ordered.indexOf(a)+1;ranks[i].push(rank);if(elapsed>=10)best[i]=Math.min(best[i],rank);
        if(elapsed===60)ratios[i]=Math.max(0,...allBots.map(b=>b.mass))/a.mass;});
    }
  }
  const ordered=w.ants.filter(Boolean).sort((a,b)=>b.score-a.score || a.id-b.id);
  const persons=humans.map((a,i)=>({id:a.id,eats:a.kills,deaths:a.deaths,medianRank:median(ranks[i]),bestPosition:best[i],finalRank:ordered.indexOf(a)+1,largestBotRatio60:ratios[i]}));
  return {mode:'feast',people,seed,passive,warmupSeconds,seconds,ants:w.count,botEats,firstBotQueen,person:persons[0],persons};
}

export function summarizeFeastFairness(runs) {
  const groups=[];
  const summarizePeople=persons=>({personRounds:persons.length,
    medianEats:median(persons.map(p=>p.eats)),medianDeaths:median(persons.map(p=>p.deaths)),
    maxDeaths:Math.max(...persons.map(p=>p.deaths)),medianRank:median(persons.map(p=>p.medianRank)),
    topFiveCount:persons.filter(p=>p.bestPosition<=5).length,
    topFiveFraction:persons.filter(p=>p.bestPosition<=5).length/persons.length,
    maxLargestBotRatio60:Math.max(...persons.map(p=>p.largestBotRatio60))});
  for(const people of [...new Set(runs.map(r=>r.people))]) {
    const active=runs.filter(r=>r.people===people&&!r.passive),passive=runs.filter(r=>r.people===people&&r.passive);
    const all=active.flatMap(r=>r.persons),allPassive=passive.map(r=>r.person);
    const result={people,seeds:active.map(r=>r.seed),rounds:active.length,...summarizePeople(all),
      designatedPerson:summarizePeople(active.map(r=>r.person)),
      firstBotQueen:Math.min(...active.map(r=>r.firstBotQueen??Infinity)),minBotEats:Math.min(...active.map(r=>r.botEats)),
      passiveMedianFinalRank:median(allPassive.map(p=>p.finalRank)),
      passiveBottomHalfCount:allPassive.filter(p=>p.finalRank>12).length,
      passiveRounds:allPassive.length,
      passiveBottomHalfFraction:allPassive.filter(p=>p.finalRank>12).length/allPassive.length};
    result.personFailures=active.flatMap(r=>r.persons.flatMap(p=>{
      const failures=[];
      if(p.eats<4)failures.push('eats');
      if(p.deaths>6)failures.push('deaths');
      if(p.medianRank>12)failures.push('rank');
      if(p.bestPosition>5)failures.push('topFive');
      if(p.largestBotRatio60>2)failures.push('sizeRatio');
      return failures.length?[{seed:r.seed,id:p.id,failures}]:[];
    }));
    result.passiveFailures=passive.filter(r=>r.person.finalRank<=12).map(r=>({seed:r.seed,id:r.person.id,finalRank:r.person.finalRank}));
    result.targets={eats:result.medianEats>=4,deaths:result.maxDeaths<=6,rank:result.medianRank<=12,
      topFive:result.topFiveFraction>=.5,sizeRatio:result.maxLargestBotRatio60<=2,queen:result.firstBotQueen>=150,
      passive:allPassive.length>0 && result.passiveBottomHalfCount===allPassive.length,botEats:result.minBotEats>=10};
    if(!Number.isFinite(result.firstBotQueen))result.firstBotQueen=null;
    groups.push(result);
  }
  return groups;
}

async function main() {
  const args = process.argv.slice(2);
  const value = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
  const botsPath = value('--bots');
  const bots = await import(botsPath ? pathToFileURL(resolve(botsPath)).href : '../src/bots.mjs');
  const seeds = (value('--seeds') ?? (args.includes('--feast-fairness') ? '1,7,42,73,101,211' : '1,7,42')).split(',').map(Number);
  if (seeds.some(seed => !Number.isSafeInteger(seed))) throw new Error('Seeds must be integers');
  if(args.includes('--feast-fairness')) {
    const runs=[];
    console.log(JSON.stringify({controller:'phone viewport, quantized size, 4 Hz, nearest edible hunt with sprint, flee to grass, nearest food; passive never hunts or eats cake',seeds}));
    for(const people of [1,12])for(const seed of seeds)for(const passive of [false,true]){const run=measureFeastFairness(bots,people,seed,passive,Number(value('--warmup')??0));runs.push(run);console.log(JSON.stringify(run));}
    const summary=summarizeFeastFairness(runs);console.log(JSON.stringify({summary}));
    if(args.includes('--assert-targets') && summary.some(r=>Object.values(r.targets).some(pass=>!pass)))process.exitCode=1;
    return;
  }
  if (!args.includes('--classic-regression') && !args.includes('--timing-only')) {
    console.log(JSON.stringify({ targets: TARGETS, viewport: [390, 844], controller: 'nearest visible food, home when carrying, retreat from visible Feast predator within180, follow Rush hill/golden goals, no sprint or combat' }));
    for (const mode of (value('--modes') ?? 'classic,feast,rush').split(',')) for (const people of [1, 12]) for (const seed of seeds) console.log(JSON.stringify(measureMode(bots, mode, people, seed, Number(value('--warmup') ?? 10))));
    return;
  }
  const timings = Array.from({ length: 3 }, () => timeDecisions(bots));
  console.log(JSON.stringify({ people: 1, bots: 31, decisionMeanMsPerTick: timings, lowest: Math.min(...timings) }));
  if (args.includes('--timing-only')) return;
  console.log('people seed seconds cluster-median cluster-max >=6-percent food-points[Red,Blue,Green,Gold] bites deaths score-CV colony-deaths human-bitten-ticks human-killed human-nest-deaths');
  for (const people of [1, 12]) {
    const runs = seeds.map(seed => measure(bots, people, seed));
    for (const r of runs) console.log(`${people} ${r.seed} ${r.seconds} ${r.median} ${r.max} ${r.crowdedPercent.toFixed(2)} ${r.foodPoints.join('/')} ${r.bites} ${r.deaths} ${r.scoreCV.toFixed(3)} ${r.colonyDeaths.join('/')} ${r.humanBittenTicks} ${r.humanKilled} ${r.humanNestDeaths}`);
    const samples = runs.flatMap(r => r.occupancy);
    const meanFoodPoints = Array.from({ length: 4 }, (_, c) => runs.reduce((sum, r) => sum + r.foodPoints[c], 0) / runs.length);
    console.log(JSON.stringify({ people, seeds, seconds: samples.length, median: median(samples), max: Math.max(...samples), crowdedPercent: samples.filter(n => n >= 6).length / samples.length * 100, meanFoodPoints, meanBites: runs.reduce((sum, r) => sum + r.bites, 0) / runs.length, meanDeaths: runs.reduce((sum, r) => sum + r.deaths, 0) / runs.length, meanColonyDeaths: Array.from({ length: 4 }, (_, c) => runs.reduce((sum, r) => sum + r.colonyDeaths[c], 0) / runs.length), meanHumanBittenTicks: runs.reduce((sum, r) => sum + r.humanBittenTicks, 0) / runs.length, meanHumanKilled: runs.reduce((sum, r) => sum + r.humanKilled, 0) / runs.length, meanScoreCV: runs.reduce((sum, r) => sum + r.scoreCV, 0) / runs.length }));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
