import { createHash } from 'node:crypto';
import { exportRun, readRunHistory, replay, restoreRun } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { physicalReplay, statisticsFor } from '../scripts/rerun-hf4.ts';
import { Hf4Mind } from '../src/minds/hf4.ts';
import random from '../src/minds/random.ts';
import { runIsland } from '../src/run.ts';
import { PERSONA } from '../src/types.ts';
import { apply, createWorld, observe } from '../src/world.ts';

const options = { seed: 1, persona: PERSONA };
describe('published HF4 observation-only host', () => {
  it('maps every legal action once, identically in free and task time', () => {
    const mind = new Hf4Mind(options),
      world = createWorld(1);
    const obs = observe(world);
    const offers = mind.offers(obs);
    expect(offers.map((o) => o.id)).toEqual(obs.actions.map((a) => a.id));
    expect(mind.offers({ ...obs, task: 'Put cubes on the Spire' })).toEqual(offers);
    expect(offers.every((o) => o.durationMs === 60_000)).toBe(true);
  });
  it('credits only cube placements on the observed Spire, and marks removal from a project as diminishing', () => {
    const world = createWorld(1);
    world.me = { ...world.spire };
    world.carrying = 'cube-1';
    world.objects = [{ id: 'cube-1', kind: 'cube', at: null, level: 0 }];
    const mind = new Hf4Mind(options),
      offers = mind.offers(observe(world));
    expect(offers.filter((o) => o.actionId === 'place-spire').map((o) => o.id)).toEqual(['place here']);
    expect(offers.find((o) => o.id === 'place here')?.advances).toHaveLength(1);
    expect(offers.filter((o) => o.id.startsWith('throw')).every((o) => o.advances.length === 0)).toBe(true);
    world.carrying = null;
    world.objects[0] = { id: 'cube-1', kind: 'cube', at: { ...world.spire }, level: 0 };
    expect(mind.offers(observe(world)).find((o) => o.id === 'pick cube-1')?.diminishes).toHaveLength(1);
  });
  it('does not turn an unseen Spire stack into zero observed progress', () => {
    const world = createWorld(1);
    world.objects = [{ id: 'cube-1', kind: 'cube', at: { ...world.spire }, level: 0 }];
    world.me = { x: world.spire.x + 5, y: world.spire.y };
    const mind = new Hf4Mind(options);
    const unseen = mind.prospects(observe(world)).find((p) => p.label === 'a pile on the Spire');
    expect(unseen).toBeDefined();
    expect(unseen?.progress).toBeUndefined();
    const restOnly = observe(world);
    restOnly.actions = restOnly.actions.filter((a) => a.id === 'rest');
    mind.step(restOnly);
    mind.endEpisode({ ...observe(apply(world, 'rest').state), stepsLeft: 0 });
    const outcomes = readRunHistory(mind.archive())
      .flatMap((t) => t.inputs)
      .flatMap((i) => (i.kind === 'action.resolved' && i.payload.outcome ? [i.payload.outcome] : []));
    expect(outcomes[0]?.actual.observedProgress).toEqual([]);
    const looked = mind
      .prospects(observe(apply(world, 'look').state))
      .find((p) => p.label === 'a pile on the Spire');
    expect(looked?.progress).toBe(0.1);
    world.me = { ...world.spire };
    world.objects = [];
    expect(mind.prospects(observe(world)).find((p) => p.label === 'a pile on the Spire')?.progress).toBe(0);
  });
  it('settles every action once and preserves exact physical and HF archive replay across resets', async () => {
    const mind = new Hf4Mind(options);
    const run = await runIsland(mind, 1, { freeEpisodes: 1, stepsPerEpisode: 4, taskSteps: 4 });
    expect(run.hf).toBe('4.17.0');
    expect(physicalReplay(run)).toBe(8);
    const archive = mind.archive(),
      verified = replay(archive),
      restored = restoreRun(archive);
    expect(verified.ok && verified.value.fullHash).toBe(archive.hashes.full);
    expect(restored.ok && exportRun(restored.value).hashes.full).toBe(archive.hashes.full);
    const outcomes = readRunHistory(archive)
      .flatMap((t) => t.inputs)
      .filter((i) => i.kind === 'action.resolved' && i.payload.disposition === 'completed');
    expect(outcomes).toHaveLength(8);
    const repeated = await runIsland(new Hf4Mind(options), 1, {
      freeEpisodes: 1,
      stepsPerEpisode: 4,
      taskSteps: 4,
    });
    const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    expect(hash(repeated)).toBe(hash(run));
    expect(archive.current.people.islander?.agenda.goals.some((g) => g.id === 'island-task')).toBe(true);
  }, 120_000);
  it('physically replays a complete headless random control', async () => {
    const run = await runIsland(random(options), 1);
    expect(physicalReplay(run)).toBe(240);
    const stats = statisticsFor([run], [run]);
    expect(stats.find((s) => s.key === 'manipulationShare')?.randomMedian).toBeGreaterThan(0);
    expect(stats.find((s) => s.key === 'freeMaxStack')?.randomMedian).toBeGreaterThan(0);
  });
});
