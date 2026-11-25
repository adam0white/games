// Deterministic rule checks. Run with Node; no dependencies.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// --mutate runs the daily-flower claims against a copy of sim.js whose flowers ignore the date cutoff and change
// by visit, not by date. Those claims must then fail (exit 1).
const here = dirname(fileURLToPath(import.meta.url)), mutate = process.argv.includes('--mutate'), scratch = mkdtempSync(join(tmpdir(), 'thankful-bots-'));
let simUrl = './sim.js';
if (mutate) { const src = readFileSync(join(here, 'sim.js'), 'utf8').replace("day < CUTOFF) return 0", "false) return 0").replace("return (dayNumber(day) + i) % 3;", "return (dayNumber(day) + i + Math.floor(Math.random() * 3)) % 3;"); assert.notEqual(src, readFileSync(join(here, 'sim.js'), 'utf8'), 'the mutation applies'); writeFileSync(join(scratch, 'sim.js'), src); simUrl = pathToFileURL(join(scratch, 'sim.js')).href; }
const { KINDS, load, localDay, validDay, count, canAdd, addStar, counts, celebration, place, member, ROWS, demo, TRAY, VARIETIES, CUTOFF, variety, species } = await import(simUrl);
const today = '2026-11-23';
assert.equal(validDay('2026-02-30'), false);
assert.equal(validDay('2024-02-29'), true);
for (const raw of [null, {}, [], {v:2}, {v:1, days:[]}, {v:1, days:{bad:[{k:'bread'}]}}]) assert.deepEqual(load(raw).days, {});
const repaired = load({v:1,look:'bad',sound:'yes',days:{[today]:[{k:'bad'},null,...Array(5).fill({k:'bread'})]}});
assert.equal(repaired.look,'garden'); assert.equal(repaired.sound,true); assert.equal(count(repaired,today),3);
const s=load(null);
for(let i=0;i<3;i++) assert.equal(addStar(s,today,KINDS[i]),true);
const before=JSON.stringify(s);
assert.equal(canAdd(s,today),false); assert.equal(addStar(s,today,'light'),false); assert.equal(JSON.stringify(s),before);
assert.deepEqual(load(JSON.parse(JSON.stringify(s))),s,'save round trip');
assert.equal(addStar(s,'bad','bread'),false); assert.equal(addStar(s,'2026-11-24','unknown'),false);
const custom=load(null); addStar(custom,today,'spark',' 🌟'.repeat(40)); assert.equal(Array.from(custom.days[today][0].t).length,24);
const history=load(null), centres=[];
for(let day=0;day<400;day++) {
  const d=new Date('2025-01-01T12:00:00'); d.setDate(d.getDate()+day); const date=localDay(d);
  const ms=[0,1,2].map(i=>member(date,i));
  assert.deepEqual(ms,[0,1,2].map(i=>member(date,i)),'deterministic lights'); assert.deepEqual(place(day),place(day),'deterministic places');
  for(const m of ms) assert.ok(Math.hypot(m.dx,m.dy)<=1.0001,'a light stays inside its day');
  for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) assert.ok(Math.hypot(ms[i].dx-ms[j].dx,ms[i].dy-ms[j].dy)>.55,'lights of one day stay apart');
  const q=place(day); assert.ok(q.y>0&&q.y<1&&q.row<ROWS,'inside the band'); centres.push(q);
  for(let i=0;i<3;i++) addStar(history,date,KINDS[(day+i)%KINDS.length]);
  assert.equal(celebration(history),(day+1)%7===0,'every seventh completed day');
}
// On the smallest phone the band is about 244 px tall and a column is 66 px wide; a day's lights reach 14 px from its place.
for(let i=0;i<centres.length;i++)for(let j=i+1;j<Math.min(centres.length,i+3*ROWS);j++){const a=centres[i],c=centres[j];assert.ok(Math.hypot((a.x-c.x)*66,(a.y-c.y)*244)>30,`days ${i} and ${j} do not stack`);}
assert.equal(new Set(centres.map(q=>q.col+':'+q.row)).size,400,'every day has its own place');
assert.deepEqual(counts(history),{days:400,lights:1200,complete:400});
// Demo is pure data generation. Any storage access here is an error.
globalThis.localStorage={getItem(){throw Error('demo read storage');},setItem(){throw Error('demo wrote storage');}};
assert.deepEqual(counts(demo(today,40)),{days:40,lights:120,complete:40});
assert.equal(JSON.stringify(s),before,'demo leaves the real save untouched');

// Parity with the rules before the daily flowers (main at 1264f14): saves, the daily cap, places and lights behave the same.
const BASE = '1264f1499273de29da52d0d7f2ca5f635d7707f5';
let parity = 'skipped (no git history)';
try {
  const old = execFileSync('git', ['show', `${BASE}:experiments/lab/thankful/sim.js`], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  writeFileSync(join(scratch, 'old-sim.js'), old); const O = await import(pathToFileURL(join(scratch, 'old-sim.js')).href);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const a = O.load(null), b = load(null); let ops = 0;
  for (let i = 0; i < 5000; i++) { const d = new Date('2025-06-01T12:00:00'); d.setDate(d.getDate() + Math.floor(rnd() * 700)); const day = localDay(d), k = [...KINDS, 'bad'][Math.floor(rnd() * (KINDS.length + 1))], w = rnd() < 0.3 ? 'hi ' + i : ''; assert.equal(addStar(b, day, k, w), O.addStar(a, day, k, w)); ops++; }
  assert.deepEqual(b, a, 'same saves after 5000 random thanks'); assert.deepEqual(load(JSON.parse(JSON.stringify(a))), O.load(JSON.parse(JSON.stringify(a))), 'same load');
  for (let i = 0; i < 600; i++) { assert.deepEqual(place(i), O.place(i)); const day = Object.keys(a.days)[i % Object.keys(a.days).length]; for (let n = 0; n < 3; n++) assert.deepEqual(member(day, n), O.member(day, n)); }
  assert.deepEqual(counts(b), O.counts(a)); assert.deepEqual(demo('2026-11-23', 60), O.demo('2026-11-23', 60), 'same demo garden');
  // The flower a kind grew before the change is the first of its three, with the same drawing numbers.
  const oldGarden = execFileSync('git', ['show', `${BASE}:experiments/lab/thankful/garden.js`], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const oldSpecies = Function(`return ${oldGarden.match(/const SPECIES = (\{[\s\S]*?\});/)[1]}`)();
  const { SPECIES } = await import('./garden.js');
  for (const k of TRAY) assert.deepEqual(SPECIES[VARIETIES[k][0]], oldSpecies[k], `${k} keeps its old flower`);
  parity = `${ops} random thanks, 600 places, demo and old flowers match main`;
} catch (e) { if (e instanceof assert.AssertionError) throw e; parity += ` (${e.message.split("\n")[0]})`; }

// Daily flowers: three for each kind, 36 in all, each with a drawing and a name in both languages.
const { SPECIES } = await import('./garden.js');
const tables = readFileSync(join(here, 'words.js'), 'utf8'), en = tables.slice(tables.indexOf('en: {'), tables.indexOf('tr: {')), tr = tables.slice(tables.indexOf('tr: {'));
const names = TRAY.flatMap(k => VARIETIES[k]);
assert.equal(new Set(names).size, 36, '36 different flowers'); assert.equal(names.length, 3 * TRAY.length, 'three times the twelve flowers there were');
for (const n of [...names, ...TRAY]) { assert.ok(SPECIES[n] || TRAY.includes(n), `${n} has a drawing`); assert.match(en, new RegExp(`\\b${n}: '`), `${n} in English`); assert.match(tr, new RegExp(`\\b${n}: '`), `${n} in Turkish`); }
const enKeys = [...en.matchAll(/(\w+): '/g)].map(m => m[1]).sort(), trKeys = [...tr.matchAll(/(\w+): '/g)].map(m => m[1]).sort();
assert.deepEqual(trKeys, enKeys, 'English and Turkish have the same words');
for (const k of ['heart', 'moon', 'hands', 'sun']) assert.ok(SPECIES[species('2026-12-01', k)], `old kind ${k} grows a flower`);
// Before the cutoff every day grows the first flower, so an old garden looks as it did.
for (let i = 1; i <= 800; i++) { const d = new Date(`${CUTOFF}T12:00:00`); d.setDate(d.getDate() - i); const day = localDay(d); for (const k of KINDS) assert.equal(variety(day, k), 0, `${day} ${k} is drawn as before`); }
// From the cutoff the flower depends only on the date (the same for everyone), every kind shows all three in any
// three days in a row, and each day's tray is a mix.
const seen = new Map();
for (let i = 0; i < 1000; i++) {
  const d = new Date(`${CUTOFF}T12:00:00`); d.setDate(d.getDate() + i); const day = localDay(d);
  const tray = TRAY.map(k => species(day, k)); assert.deepEqual(TRAY.map(k => species(day, k)), tray, `${day}: the same flowers on every look`);
  assert.ok(new Set(TRAY.map(k => variety(day, k))).size >= 2, `${day}: a mix`); seen.set(day, tray);
  if (i >= 2) for (const [j, k] of TRAY.entries()) { const three = [0, 1, 2].map(b => { const e = new Date(d); e.setDate(e.getDate() - b); return seen.get(localDay(e))[j]; }); assert.equal(new Set(three).size, 3, `${k}: three days, three flowers`); }
}
for (const day of seen.keys()) assert.deepEqual(TRAY.map(k => species(day, k)), seen.get(day), 'a second visit sees the same flowers');
console.log(`ok thankful: deterministic layout, 400 days, daily cap, save repair, demo isolation, weekly celebration; daily flowers: 36 flowers, en/tr, same for everyone, old gardens unchanged; parity: ${parity}`);
