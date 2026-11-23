import { adoptGoal, recall, satisfy } from 'hfLegacy';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import hf from '../src/minds/hf.ts';
import { Hf2Mind } from '../src/minds/hf2.ts';
import { runIsland } from '../src/run.ts';
import { PERSONA } from '../src/types.ts';
import { apply, createWorld, observe } from '../src/world.ts';

const options = { seed: 1, persona: PERSONA };
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

describe('HF2 experiment', () => {
  it.each([{}, { boredom: false }, { memory: false }, { goals: false }])(
    'offers every legal input exactly once despite multiple targets: %j',
    (ablation) => {
      const mind = new Hf2Mind({ ...options, ...ablation });
      const state = createWorld(1);
      state.objects = [
        { id: 'cube-1', kind: 'cube', at: { x: 3, y: 12 }, level: 0 },
        { id: 'cube-2', kind: 'cube', at: { x: 4, y: 12 }, level: 0 },
      ];
      const obs = observe(state);
      const offers = mind.offers(obs);
      expect(offers.map((o) => o.input).sort()).toEqual(obs.actions.map((a) => a.id).sort());
      expect(new Set(offers.map((o) => o.input)).size).toBe(offers.length);
      const east = offers.find((o) => o.input === 'move E');
      expect(east?.targetId).toBe('cube-1');
      expect(east?.label).toContain('cube-1');
      expect(east?.label).toContain('cube-2');

      // Recalled targets must merge too, after both objects leave current sight.
      obs.actions = obs.actions.filter((a) => a.id === 'look');
      mind.step(obs);
      const unseen = observe(state);
      unseen.seen.things = [];
      unseen.seen.spire = null;
      const recalled = mind.offers(unseen);
      expect(recalled.map((o) => o.input).sort()).toEqual(unseen.actions.map((a) => a.id).sort());
      expect(new Set(recalled.map((o) => o.input)).size).toBe(recalled.length);
      if (ablation.memory !== false) {
        const toward = recalled.find((o) => o.input === 'move E');
        expect(toward?.fromMemory).toBe(true);
        expect(toward?.label).toContain('cube-1');
        expect(toward?.label).toContain('cube-2');
      }
    },
  );

  it('reproduces the committed legacy HF seed 1 hash', async () => {
    const expected = '4e4826d03a20956f54b581eedea3777e551c595837867ec67855ab4186af924d';
    expect(hash(readFileSync('viewer/runs/hf-1.json', 'utf8'))).toBe(expected);
    expect(hash(`${JSON.stringify(await runIsland(hf(options), 1), null, 2)}\n`)).toBe(expected);
  });

  it('recalls unseen object places through HF, with a visible-only ablation', () => {
    const mind = new Hf2Mind(options);
    const state = createWorld(1);
    state.objects = [{ id: 'cube-1', kind: 'cube', at: { x: 3, y: 12 }, level: 0 }];
    mind.step(observe(state));
    expect(recall(mind.person, { targetId: 'cube-1', placeId: 'cell:2,0' }).length).toBeGreaterThan(0);
    const unseen = observe(state);
    unseen.seen.things = [];
    unseen.seen.spire = null;
    expect(mind.offers(unseen).some((o) => o.fromMemory && o.label.includes('cube-1'))).toBe(true);
    const ablation = new Hf2Mind({ ...options, memory: false });
    ablation.step(observe(state));
    expect(ablation.offers(unseen).some((o) => o.fromMemory)).toBe(false);
    expect(ablation.person.memory.episodes.some((e) => e.placeId !== undefined)).toBe(false);
  });

  it('credits the previous action, including the final action, once per observed outcome', () => {
    const mind = new Hf2Mind(options);
    let state = createWorld(1);
    const obs = observe(state);
    obs.actions = obs.actions.filter((a) => a.id === 'look');
    mind.step(obs);
    expect(mind.person.memory.expectations).toHaveLength(0);
    state = apply(state, 'look').state;
    mind.endEpisode(observe(state));
    expect(mind.person.memory.episodes.filter((e) => e.kind === 'outcome')).toHaveLength(1);
    expect(mind.person.memory.episodes.find((e) => e.kind === 'outcome')?.action).toBe('island:look');
    const count = mind.person.memory.episodes.length;
    mind.endEpisode(observe(state));
    expect(mind.person.memory.episodes).toHaveLength(count);
  });

  it('habituates by effect and crosses the engagement line in both directions', () => {
    const mind = new Hf2Mind(options);
    let state = createWorld(1);
    const engagement: number[] = [];
    for (let i = 0; i < 60; i++) {
      const obs = observe(state);
      obs.actions = obs.actions.filter((a) => a.id === 'rest');
      engagement.push(mind.step(obs).inner?.engagement as number);
      state = apply(state, 'rest').state;
    }
    expect(Math.min(...engagement)).toBeLessThan(0.35);
    const obs = observe(state);
    obs.events = ['The ring glows.'];
    const fresh = mind.step(obs).inner?.engagement as number;
    expect(fresh).toBeGreaterThan(0.35);
  });

  it('reaches the hourly proposal path and removes only goal pull in no-goals', () => {
    const mind = new Hf2Mind({ ...options, goals: false });
    const goal = adoptGoal(
      mind.person,
      { label: 'master-skill', serves: ['competence'], advancedBy: [], importance: 1 },
      mind.person.now,
    );
    const state = createWorld(1);
    state.carrying = 'cube-1';
    const obs = observe(state);
    expect(mind.offers(obs).every((o) => !o.advances?.includes(goal.id))).toBe(true);
  });

  it('lets an actually urgent HF need propose a goal and pull on matching offers', async () => {
    const mind = new Hf2Mind(options);
    satisfy(mind.person, { competence: -1 });
    const recording = await runIsland(
      {
        name: mind.name,
        step: (obs) => mind.step({ ...obs, actions: obs.actions.filter((a) => a.id === 'rest') }),
        endEpisode: (obs) => mind.endEpisode(obs),
        closingInner: () => mind.closingInner(),
      },
      1,
      { freeEpisodes: 1, taskSteps: 0 },
    );
    const proposed = recording.frames.flatMap((f) => f.inner?.goals ?? []).find((g) => g.source === 'hf');
    expect(proposed?.label).toBe('master-skill');
    expect(proposed?.minute).toBe(60);
    const state = createWorld(1);
    state.carrying = 'cube-1';
    expect(mind.offers(observe(state)).some((o) => o.advances?.includes(proposed?.id ?? 'missing'))).toBe(
      true,
    );
  });

  it('uses identical placement declarations in free and task time, without routing rules', () => {
    const mind = new Hf2Mind(options);
    const state = createWorld(1);
    state.me = { ...state.spire };
    state.carrying = 'cube-1';
    const free = mind.offers(observe(state));
    const tasked = mind.offers(observe(state, 'Put cubes on the Spire.'));
    expect(tasked).toEqual(free);
    expect(free.find((o) => o.input === 'place here')?.action).toBe('island:place:cube@Spire');
  });

  it('judges familiarity by observed effect records rather than an input-use counter', () => {
    const mind = new Hf2Mind(options);
    let state = createWorld(1);
    const obs = observe(state);
    obs.actions = obs.actions.filter((a) => a.id === 'look');
    mind.step(obs);
    state = apply(state, 'look').state;
    mind.endEpisode(observe(state));
    const seen = mind.person.memory.episodes.filter((e) => e.kind === 'island-effect');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ action: 'look', targetId: 'islander', placeId: 'cell:0,0' });
    const offers = mind.offers(observe(createWorld(1)));
    expect(offers.find((o) => o.input === 'look')?.tags).not.toContain('novel');
    expect(offers.find((o) => o.input === 'move N')?.tags).toContain('novel');
  });

  it('records proposed/adopted labels and lived minutes without inventing projects', async () => {
    const mind = new Hf2Mind(options);
    const recording = await runIsland(mind, 1);
    expect(mind.person.now).toBe(960);
    expect(recording.measures.goalsProposed).toBe(0);
    expect(recording.frames.at(-1)?.inner?.proposalChecks).toBe(4);
    expect(recording.frames.at(-1)?.inner?.proposalMaxUrgency).toBeLessThan(0.6);
    expect(recording.frames.some((f) => f.inner?.goals?.some((g) => g.source === 'task'))).toBe(true);
    expect(recording.measures.boredomMin0).toBeLessThanOrEqual(recording.measures.boredomMax0 as number);
  });
});
