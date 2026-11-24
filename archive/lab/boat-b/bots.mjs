// Bots apply only public ripple/pebble inputs. No teleporting or state edits in measured runs.
// --mutate disables the ripple input: a broken current rule must fail the same assertions.
import { DT, LEVELS, create, ripple as realRipple, pebble, step, flow, guide } from './sim.js';
const mutate = process.argv.includes('--mutate');
const ripple = mutate ? () => false : realRipple;
let failures = 0;
function check(ok, message) { if (!ok) { failures++; console.error('FAIL', message); } }
function rng(seed) { let n = seed | 0; return () => { n = Math.imul(n, 1664525) + 1013904223 | 0; return (n >>> 0) / 4294967296; }; }
function play(level, seed, clumsy = false) {
  const s = create({level, seed}), random = rng(seed * 1337 + 99);
  let next = 0;
  while (s.status === 'play' && s.tick < 60 * 30) {
    if (s.t >= next) {
      let target = guide(s);
      if (clumsy) target += (random() - .5) * 50;
      const dx = Math.max(-20, Math.min(20, (target - s.boat.x) * 1.15 - s.boat.vx * .28));
      ripple(s, {x: s.boat.x, y: s.boat.y + 2, dx, dy: 0});
      next = s.t + (clumsy ? .8 + random() * 1.3 : .13);
    }
    step(s);
  }
  return s;
}
const a = create({seed: 88}), b = create({seed: 88});
for (let i = 0; i < 900; i++) {
  if (i % 31 === 0) for (const s of [a,b]) ripple(s, {x: 40, y: s.boat.y, dx: i % 62 ? -13 : 13, dy: 2});
  if (i % 71 === 0) for (const s of [a,b]) pebble(s, {x: 60, y: s.boat.y + 2});
  step(a); step(b);
}
check(JSON.stringify(a) === JSON.stringify(b), 'identical seed/input replay is byte identical');
check(JSON.stringify(create({seed: 1})) !== JSON.stringify(create({seed: 2})), 'seed changes the course variation');
{
 const s = create(), base = flow(s, 50, 0).x;
 ripple(s, {x:50,y:0,dx:12,dy:0});
 check(flow(s,50,0).x > base + 25, 'right swipe creates a rightward local current');
 check(Math.abs(flow(s,90,0).x - base) < .001, 'swipe current is local');
 const left = create(), right = create();
 pebble(left, {x:40,y:0}); pebble(right, {x:60,y:0});
 check(flow(left,50,0).x > 20 && flow(right,50,0).x < -20, 'pebble pushes water away on each side');
 const idle = create(), driven = create(); ripple(driven,{x:50,y:0,dx:16,dy:0});
 for(let i=0;i<30;i++){step(idle);step(driven);}
 check(driven.boat.x > idle.boat.x + 4, 'boat follows ripple flow rather than pointer position');
 check(driven.boat.y === idle.boat.y, 'boat always moves downstream automatically');
 for(let i=0;i<80;i++) step(driven);
 check(driven.ripples.length === 0, 'currents expire');
}
// Controlled fixtures verify outcomes independently of the route controller.
for (const kind of ['drain', 'leaf', 'paw']) {
 const s = create({level:2});
 s.hazards = [{kind,x:50,y:0,r:20,hit:false,passed:false}];
 const before = s.boat.soak; step(s);
 check(s.hits === 1 && s.boat.soak > before + 30, `${kind} contact damages the hull`);
 const after = s.boat.soak;
 for(let i=0;i<5;i++) step(s);
 check(s.hits === 1 && s.boat.soak < after + 1, `${kind} contact cannot damage the hull every frame`);
}
{
 const s = create(); s.passengers = [{kind:'snail',x:50,y:0,r:12,collected:false,passed:false}]; step(s);
 check(s.rescued === 1 && s.passengers[0].collected, 'contact picks up a passenger once');
 for(let i=0;i<5;i++) step(s);
 check(s.rescued === 1, 'passenger cannot be collected twice');
 const soaked = create(); soaked.boat.soak = 99.999; step(soaked);
 check(soaked.status === 'lost' && soaked.boat.soak === 100, 'soaked paper ends the run at 100');
}
// Opposite vertical strokes must change longitudinal travel, not only the drawn streamlines.
{
 const upstream = create(), downstream = create(), idle = create();
 ripple(upstream,{x:50,y:0,dx:0,dy:-12});
 ripple(downstream,{x:50,y:0,dx:0,dy:12});
 for(let i=0;i<30;i++){step(upstream);step(downstream);step(idle);}
 check(downstream.boat.y > idle.boat.y + .5 && upstream.boat.y < idle.boat.y - .5, 'opposite vertical ripples alter actual downstream travel');
 for(const s of [upstream,downstream,idle]) check(Math.abs(s.progress - s.boat.y / (LEVELS[0].duration * LEVELS[0].speed)) < 1e-12, 'progress measures travelled distance');
}
const N = 240, rows = [];
for (let level = 0; level < LEVELS.length; level++) {
 const careful = [], clumsy = [];
 for (let seed=1; seed<=N; seed++) {careful.push(play(level,seed));clumsy.push(play(level,seed,true));}
 const wins = list => list.filter(s=>s.status==='won').length;
 const c = wins(careful), w = wins(clumsy);
 check(c === N, `careful wins street ${level+1}: ${c}/${N}`);
 check(careful.every(s=>s.stars===3 && s.hits===0 && s.rescued===2), `careful rescues both passengers without a hit on street ${level+1}`);
 rows.push({street:level+1,seconds:LEVELS[level].duration,careful:c,clumsy:w,clumsyPercent:Math.round(w/N*100),carefulMinStars:Math.min(...careful.map(s=>s.stars)),carefulMeanHits:(careful.reduce((a,s)=>a+s.hits,0)/N).toFixed(2),carefulSecondsMin:Math.min(...careful.map(s=>s.t)).toFixed(2),carefulSecondsMax:Math.max(...careful.map(s=>s.t)).toFixed(2)});
}
check(rows[0].clumsy >= N * .9, 'clumsy wins street 1 at least 90%');
for(let i=1;i<rows.length;i++) check(rows[i].clumsy < rows[i-1].clumsy, `clumsy success falls from street ${i} to ${i+1}`);
const total = LEVELS.reduce((a,l)=>a+l.duration,0);
check(total >= 60 && total <= 240, 'complete journey is 1–4 minutes');
// Terminal state is inert, including input. This catches retries changing a finished score.
{
 const s = play(0,7), before=JSON.stringify(s); step(s); ripple(s,{x:50,y:10,dx:10}); pebble(s,{x:30,y:10});
 check(JSON.stringify(s) === before, 'finished state ignores simulation and input');
}
console.table(rows);
console.log(`Deterministic replay: 900 frames. Seeds: ${N} per bot per street. Nominal journey: ${total}s (actual time follows water flow). Mutation: ${mutate ? 'ripple disabled' : 'none'}.`);
console.log(failures ? `${failures} checks FAILED` : 'All checks passed');
process.exitCode = failures ? 1 : 0;
