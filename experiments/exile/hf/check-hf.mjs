import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform } from 'node:os';
import { gzipSync } from 'node:zlib';

const bundleUrl = new URL('./exile-hf.js', import.meta.url);
const bundle = await readFile(bundleUrl);
globalThis.window = {};
await import(bundleUrl.href);

const hf = window.exileHF;
const call = (method, input) => {
  const wire = hf[method](JSON.stringify(input));
  assert.equal(typeof wire, 'string', method);
  const output = JSON.parse(wire);
  assert.notEqual(output.ok, false, `${method} at ${input?.t ?? ''}: ${output.error}`);
  return output;
};
const sampleSeconds = 5;
const durationSeconds = 1200;
const sizes = [8, 16];
const seeds = [5, 17, 29, 43, 71];
const work = ['wood', 'stone', 'farm', 'guard'];
const acts = [...work, 'eat', 'rest', 'follow', 'idle'];
const verdicts = ['assented', 'deferred', 'modified', 'refused', 'complied', 'commanded'];
const counts = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));
const sum = (values) => values.reduce((a, b) => a + b, 0);
const round = (number) => Number(number.toFixed(3));
const share = (count, total) => total ? round(count / total) : null;
function timing(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p) => sorted[Math.ceil(sorted.length * p) - 1];
  return { p50: round(at(0.5)), p95: round(at(0.95)), max: round(at(1)) };
}

function run(size, seed) {
  const villagers = Array.from({ length: size }, (_, i) => ({ id: i + 1, name: `Villager ${i + 1}` }));
  const { ms: initMs, version } = call('init', { seed, villagers });
  assert.equal(version, '4.17.0');
  const present = villagers.map(({ id }) => id);
  const stores = { wood: 1, stone: 1, food: size * 2 };
  let farmCredit = 0;
  let foodEaten = 0;
  let previousActs = [];
  const trace = [];
  const tickMs = [];
  const bridgeTickMs = [];
  const rallyTickMs = [];
  const byAct = counts(acts);
  const stockedActs = counts(acts);
  const zeroFoodActs = counts(acts);
  const rallyVerdicts = counts(verdicts);
  const zeroFoodRallyVerdicts = counts(verdicts);
  const zeroFoodLines = new Map();
  let zeroFoodSeconds = 0;
  let firstZeroFoodSecond = null;
  let zeroFoodNeed = null;
  let priorRally = false;
  const rallyEdges = [];
  for (let t = 0; t <= durationSeconds; t += sampleSeconds) {
    // The midpoint ration loss produces a lean period. Failed harvests contribute zero food then.
    if (t === 480) stores.food = 0;
    for (const { act } of previousActs) {
      if (act === 'wood' || act === 'stone') stores[act] += 1;
      if (act === 'farm' && (t < 480 || t >= 750)) farmCredit += 0.12;
    }
    const harvested = Math.floor(farmCredit);
    stores.food += harvested;
    farmCredit -= harvested;

    const rally = (t >= 240 && t < 320) || (t >= 600 && t < 680);
    const edge = rally !== priorRally;
    priorRally = rally;
    const foodBefore = stores.food;
    const started = performance.now();
    const output = call('tick', { t, stores, rally, present, night: t >= 540 && t < 900, homes: 4 });
    bridgeTickMs.push(performance.now() - started);
    assert.deepEqual(output.acts.map(({ id }) => id), present);
    assert(Number.isInteger(output.food) && output.food <= 0 && foodBefore + output.food >= 0);
    assert(Number.isFinite(output.ms) && output.ms >= 0);
    stores.food += output.food;
    foodEaten -= output.food;
    previousActs = output.acts;
    trace.push(JSON.stringify({ acts: output.acts, food: output.food }));
    tickMs.push(output.ms);
    if (edge) rallyTickMs.push(output.ms);
    const zero = foodBefore === 0;
    if (zero) {
      firstZeroFoodSecond ??= t;
      if (t < durationSeconds) zeroFoodSeconds += sampleSeconds;
      if (zeroFoodNeed === null) {
        zeroFoodNeed = round(sum(present.map((id) => call('inspect', { id }).needs.food)) / size);
      }
    }
    if (edge) {
      const following = output.acts.filter(({ act }) => act === 'follow').length;
      rallyEdges.push({ t, rally, following });
    }
    for (const { act, verdict, line } of output.acts) {
      assert(acts.includes(act));
      if (!rally) assert.notEqual(act, 'follow');
      if (t < durationSeconds) {
        byAct[act]++;
        (zero ? zeroFoodActs : stockedActs)[act]++;
      }
      if (edge) {
        assert(verdicts.includes(verdict), `missing verdict at ${t}: ${JSON.stringify(output.acts)}`);
        assert.equal(typeof line, 'string');
        if (rally && verdict === 'assented') assert.equal(act, 'follow', `assent at ${t}`);
        rallyVerdicts[verdict]++;
        if (zero && rally) zeroFoodRallyVerdicts[verdict]++;
      } else assert.equal(verdict, undefined);
      if (zero && line) zeroFoodLines.set(line, (zeroFoodLines.get(line) ?? 0) + 1);
    }
  }
  const stats = call('stats');
  assert.equal(stats.steps, tickMs.length);
  assert.equal(stats.suggestions, size * 4);
  assert.deepEqual(stats.verdicts, rallyVerdicts);
  for (const act of acts) assert.equal(stats.byAct[act], byAct[act] + previousActs.filter((a) => a.act === act).length);
  const panel = call('inspect', { id: present[0] });
  assert(Object.values(panel.needs).every((level) => level >= 0 && level <= 1));
  assert.equal(panel.act, previousActs[0].act);
  assert.equal(typeof panel.mood.valence, 'number');

  const totalActs = sum(Object.values(byAct));
  return {
    trace, tickMs, bridgeTickMs, rallyTickMs,
    measures: {
      size, seed, initMs: round(initMs), tickMs: timing(tickMs), bridgeTickMs: timing(bridgeTickMs), rallyEdges, byAct, foodEaten,
      eatingShare: share(byAct.eat, totalActs), restingShare: share(byAct.rest, totalActs),
      rallyVerdicts, decisions: stats.decisions,
      zeroFood: {
        firstSecond: firstZeroFoodSecond, seconds: zeroFoodSeconds, byAct: zeroFoodActs,
        workShare: share(sum(work.map((act) => zeroFoodActs[act])), sum(Object.values(zeroFoodActs))),
        stockedWorkShare: share(sum(work.map((act) => stockedActs[act])), sum(Object.values(stockedActs))),
        meanFoodNeedLevelAtFirstZero: zeroFoodNeed,
        rallyOnVerdicts: zeroFoodRallyVerdicts,
        narratedLines: [...zeroFoodLines].map(([line, count]) => ({ line, count })),
      },
    },
  };
}

function assertDeterministic(actual, repeat) {
  assert.equal(actual.length, repeat.length);
  for (const [index, observation] of actual.entries()) {
    assert.equal(repeat[index], observation, `determinism mismatch at game second ${index * sampleSeconds}`);
  }
}

function verifyArrival() {
  call('init', { seed: 13, villagers: [{ id: 'one', name: 'Villager One' }] });
  const snapshot = { t: 0, stores: { wood: 0, stone: 0, food: 0 }, rally: false, present: ['one'], night: false, homes: 0 };
  call('tick', snapshot);
  assert.deepEqual(call('add', { id: 2, name: 'Villager Two' }), { ok: true });
  assert.equal(JSON.parse(hf.inspect('{"id":2}')).ok, false);
  const arrived = call('tick', { ...snapshot, t: 5, present: ['one', 2] });
  assert.deepEqual(arrived.acts.map(({ id }) => id), ['one', 2]);
  assert.equal(call('inspect', { id: 2 }).act, arrived.acts[1].act);
  assert.deepEqual(call('tick', { ...snapshot, t: 10, present: [] }).acts, []);
  assert.equal(call('inspect', { id: 2 }).act, 'idle');
  assert.equal(JSON.parse(hf.tick(JSON.stringify(snapshot))).ok, false);
}

verifyArrival();
const runs = [];
const aggregates = [];
if (process.argv.includes('--mutate-determinism')) {
  const actual = run(sizes[0], seeds[0]).trace;
  const repeat = run(sizes[0], seeds[0]).trace;
  assertDeterministic(actual, repeat);
  const changed = JSON.parse(repeat[3]);
  changed.acts[0].act = changed.acts[0].act === 'idle' ? 'wood' : 'idle';
  repeat[3] = JSON.stringify(changed);
  assertDeterministic(actual, repeat);
  throw new Error('determinism verifier accepted a mutated action');
}
for (const size of sizes) {
  const results = seeds.map((seed) => {
    const result = run(size, seed);
    console.error(`Measured ${size} villagers, seed ${seed}, tick p95 ${result.measures.tickMs.p95} ms`);
    return result;
  });
  const repeat = run(size, seeds[0]).trace;
  assertDeterministic(results[0].trace, repeat);
  runs.push(...results.map(({ measures }) => measures));
  aggregates.push({
    size, initMs: timing(results.map(({ measures }) => measures.initMs)),
    tickMs: timing(results.flatMap(({ tickMs }) => tickMs)),
    bridgeTickMs: timing(results.flatMap(({ bridgeTickMs }) => bridgeTickMs)),
    rallyTickMs: timing(results.flatMap(({ rallyTickMs }) => rallyTickMs)),
    deterministicSeed: seeds[0],
  });
}
const measures = {
  environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0].model },
  bundleBytes: { raw: bundle.length, gzip: gzipSync(bundle).length },
  sampleSeconds, durationSeconds, minutesPerSecond: 2, aggregates, runs,
};
const json = JSON.stringify(measures, null, 2) + '\n';
await writeFile(new URL('./hf-measures.json', import.meta.url), json);
process.stdout.write(json);
