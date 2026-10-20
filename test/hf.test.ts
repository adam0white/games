import { emotionLevel, feel } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import createMind, { HfMind, inputOffers, scoreInputs, taskAdvances } from '../src/minds/hf.ts';
import { type Action, type Observation, PERSONA } from '../src/types.ts';

const actions: Action[] = [
  { id: 'move N', kind: 'move', label: 'Move north' },
  { id: 'jump E', kind: 'climb', label: 'Jump east' },
  { id: 'pick cube-1', kind: 'pick', label: 'Pick up cube-1' },
  { id: 'place here', kind: 'place', label: 'Place here' },
  { id: 'place N', kind: 'place', label: 'Place north' },
  { id: 'throw rock N hard', kind: 'throw', label: 'Throw north hard' },
  { id: 'rest', kind: 'rest', label: 'Rest' },
  { id: 'look', kind: 'look', label: 'Look' },
];

function observation(step = 0, changes: Partial<Observation> = {}): Observation {
  return {
    episode: Math.floor(step / 60),
    step: step % 60,
    stepsLeft: 60 - (step % 60),
    text: 'Grass. The Spire is north. Cube-1 is here.',
    events: ['You rest.'],
    actions,
    task: '',
    seen: {
      here: { height: 1, onSpire: false, terrain: 'grass' },
      spire: { dx: 0, dy: -1 },
      things: [{ id: 'cube-1', kind: 'cube', dx: 0, dy: 0, level: 0, inRing: false }],
      carrying: null,
    },
    ...changes,
  };
}

const options = { seed: 712, persona: PERSONA };

describe('HF island person', () => {
  it('makes identical legal choices for 240 steps including three resets', async () => {
    const a = createMind(options);
    const b = createMind(options);
    const picked = new Set<string>();
    for (let step = 0; step < 240; step++) {
      const obs = observation(step, {
        events: step % 11 === 0 ? ['The ring glows.'] : ['You move north.'],
        task: step >= 180 ? 'Put as many cubes as you can on the Spire before the hour ends.' : '',
      });
      const first = await a.step(obs);
      expect(await b.step(obs)).toEqual(first);
      expect(obs.actions.some((action) => action.id === first.action)).toBe(true);
      picked.add(first.action);
      for (const value of Object.values(first.inner ?? {})) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      if (step % 60 === 59) {
        const terminal = { ...obs, step: 60, stepsLeft: 0, events: ['The ring glows.'] };
        expect(await a.endEpisode(terminal)).toEqual(await b.endEpisode(terminal));
      }
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it('habituates to identical events and only the enabled arm feels boredom', () => {
    const on = new HfMind(options);
    const off = new HfMind({ ...options, boredom: false });
    let firstEngagement = 0;
    let finalEngagement = 0;
    for (let step = 0; step < 180; step++) {
      const obs = observation(step, { actions: [actions[6] as Action] });
      const enabled = on.step(obs);
      const disabled = off.step(obs);
      expect(disabled.inner?.boredom).toBe(0);
      expect(disabled.inner?.engagement).toBe(enabled.inner?.engagement);
      expect(disabled.inner?.leisure).toBe(enabled.inner?.leisure);
      if (step === 0) firstEngagement = enabled.inner?.engagement ?? 0;
      finalEngagement = enabled.inner?.engagement ?? 1;
    }
    expect(finalEngagement).toBeLessThan(firstEngagement);
    expect(emotionLevel(on.state.person, 'boredom')).toBeGreaterThan(0.2);
    expect(emotionLevel(off.state.person, 'boredom')).toBe(0);
    expect(on.state.person.memory).toEqual(off.state.person.memory);
    expect(on.state.person.rng).toEqual(off.state.person.rng);
    expect(on.state.person.needs).toEqual(off.state.person.needs);
  });

  it('changes input scores only through the HF boredom tendency', () => {
    const mind = new HfMind(options);
    const quiet = structuredClone(mind.state.person);
    const bored = structuredClone(quiet);
    feel(bored, 'boredom', 0.8, 'test:dull');
    const offers = inputOffers(quiet, observation());
    const a = scoreInputs(quiet, offers);
    const b = scoreInputs(bored, offers);
    expect(a.map((item) => item.affordanceId)).toEqual(b.map((item) => item.affordanceId));
    let changed = false;
    for (const [i, plain] of a.entries()) {
      const withBoredom = b[i];
      expect(withBoredom).toBeDefined();
      const withoutBoredom = withBoredom?.terms.filter((term) => !term.source.startsWith('emotion:boredom:'));
      expect(withoutBoredom).toEqual(plain.terms);
      changed ||= plain.utility !== withBoredom?.utility;
    }
    expect(changed).toBe(true);
  });

  it('the actual boredom-off flag changes scores only through the boredom term', () => {
    const on = new HfMind(options);
    const off = new HfMind({ ...options, boredom: false });
    for (let step = 0; step < 30; step++) {
      const obs = observation(step, { actions: [{ id: 'rest', kind: 'rest', label: 'Rest' }] });
      on.step(obs);
      off.step(obs);
    }
    const enabledOffers = inputOffers(on.state.person, observation(30));
    const disabledOffers = inputOffers(off.state.person, observation(30));
    expect(enabledOffers).toEqual(disabledOffers);
    const enabled = scoreInputs(on.state.person, enabledOffers);
    const disabled = scoreInputs(off.state.person, disabledOffers);
    let boredomTerms = 0;
    for (const [index, scored] of enabled.entries()) {
      const other = disabled[index];
      expect(other).toBeDefined();
      const boredom = scored.terms.filter((term) => term.source.startsWith('emotion:boredom:'));
      boredomTerms += boredom.length;
      expect(scored.terms.filter((term) => !term.source.startsWith('emotion:boredom:'))).toEqual(
        other?.terms,
      );
      expect(scored.utility - (other?.utility ?? 0)).toBeCloseTo(
        boredom.reduce((sum, term) => sum + term.value, 0),
        5,
      );
    }
    expect(boredomTerms).toBeGreaterThan(0);
  });

  it('retains Person memory and learned episode expectations, not an observation', () => {
    const mind = new HfMind(options);
    const person = mind.state.person;
    for (let step = 0; step < 60; step++) mind.step(observation(step));
    expect(person.now).toBe(12 * 60 + 60);
    expect(person.memory.expectations).toHaveLength(0);
    const gist = mind.endEpisode(observation(59));
    expect(gist).not.toContain('\n');
    expect(mind.state.person).toBe(person);
    expect(person.memory.expectations.length).toBeGreaterThan(0);
    const memories = person.memory.episodes.length;
    mind.step(observation(60, { events: [] }));
    expect(person.memory.episodes.length).toBeGreaterThanOrEqual(memories);
    expect(JSON.parse(JSON.stringify(mind.state))).toEqual(mind.state);
    expect(mind.state).not.toHaveProperty('seen');
    expect(mind.state).not.toHaveProperty('observation');
  });

  it('gives all inputs the same base promise and remembers kind/target novelty', () => {
    const mind = new HfMind(options);
    const obs = observation(0, { actions: [actions[0] as Action] });
    mind.step(obs);
    const offers = inputOffers(mind.state.person, observation());
    expect(new Set(offers.map((offer) => JSON.stringify(offer.advertises))).size).toBe(1);
    expect(offers.find((offer) => offer.id === 'move N')?.tags).not.toContain('novel');
    expect(offers.find((offer) => offer.id === 'jump E')?.tags).toContain('novel');
    expect(offers.find((offer) => offer.id === 'rest')?.tags).toContain('rest');
    expect(offers.find((offer) => offer.id === 'look')?.tags).toContain('rest');
  });

  it('rejects an empty legal action list', () => {
    expect(() => createMind(options).step(observation(0, { actions: [] }))).toThrow(/legal action/i);
  });

  it.each(['The ring glows.', 'A new cube appears.', 'The rock cracks, and a small cube breaks off.'])(
    'appraises observed good news mildly: %s',
    (event) => {
      const mind = new HfMind(options);
      mind.step(observation(0, { events: [event] }));
      expect(emotionLevel(mind.state.person, 'joy')).toBeGreaterThan(0);
      expect(emotionLevel(mind.state.person, 'joy')).toBeLessThan(0.3);
    },
  );

  it.each(['The object is lost.', 'Your move is blocked.'])('appraises observed bad news: %s', (event) => {
    const mind = new HfMind(options);
    mind.step(observation(0, { events: [event] }));
    expect(emotionLevel(mind.state.person, 'distress')).toBeGreaterThan(0);
  });

  it('recognizes arriving on a visible hilltop, without treating every hilltop action as an arrival', () => {
    const arrival = new HfMind(options);
    const resting = new HfMind(options);
    const obs = observation(0, { events: ['You walk north.'] });
    obs.seen.here = { height: 4, onSpire: true, terrain: 'the Spire' };
    arrival.step(obs);
    resting.step({ ...obs, events: ['You rest.'] });
    expect(emotionLevel(arrival.state.person, 'joy')).toBeGreaterThan(0);
    expect(emotionLevel(resting.state.person, 'joy')).toBe(0);
  });

  it('habituates walking as one event kind across directions', () => {
    const mind = new HfMind(options);
    mind.step(observation(0, { events: ['You walk north.'] }));
    mind.step(observation(1, { events: ['You walk south.'] }));
    const events = mind.state.person.memory.episodes.filter((episode) => episode.kind === 'witnessed');
    expect(events).toHaveLength(2);
    expect(new Set(events.map((episode) => episode.action)).size).toBe(1);
  });

  it('uses one habituation factor in the playtester engagement equation', () => {
    const mind = new HfMind(options);
    const decay = 2 ** (-60 / (20 + 70 * 0.2));
    const first = mind.step(observation());
    const firstExpected = 0.6 * decay + (1 - 0.6 * decay) * 0.12;
    expect(first.inner?.engagement).toBeCloseTo(firstExpected, 12);
    const second = mind.step(observation(1));
    const novelty = 1 / (1 + (0.3 + 0.7 * 0.8) * 0.5);
    const secondExpected = firstExpected * decay + (1 - firstExpected * decay) * 0.12 * novelty;
    expect(second.inner?.engagement).toBeCloseTo(secondExpected, 12);
  });

  it('perceives the final action outcome before learning the episode expectation, without adding a minute', () => {
    const mind = new HfMind(options);
    mind.step(observation());
    const now = mind.state.person.now;
    mind.endEpisode(observation(0, { step: 1, stepsLeft: 0, events: ['A new cube appears.'] }));
    expect(mind.state.person.now).toBe(now);
    expect(
      mind.state.person.memory.episodes.some((episode) => episode.summary === 'A new cube appears.'),
    ).toBe(true);
    expect(mind.state.person.memory.expectations.some((item) => (item.needs.competence ?? 0) > 0)).toBe(true);
  });

  it('continues a JSON-restored state identically across a reset and task transition', () => {
    const original = new HfMind(options);
    for (let step = 0; step < 55; step++) original.step(observation(step));
    const restored = new HfMind(options);
    Object.assign(restored.state, JSON.parse(JSON.stringify(original.state)));
    for (let step = 55; step < 70; step++) {
      const obs = observation(step, { task: step >= 60 ? 'Put cubes on the Spire.' : '' });
      expect(restored.step(obs)).toEqual(original.step(obs));
      if (step === 59) {
        const terminal = { ...obs, step: 60, stepsLeft: 0, events: ['A new cube appears.'] };
        expect(restored.endEpisode(terminal)).toEqual(original.endEpisode(terminal));
      }
      expect(restored.state).toEqual(original.state);
    }
  });
});

describe('task mapping', () => {
  it('never advances a goal during free time, even for cube placement on the Spire', () => {
    const obs = observation();
    obs.seen.carrying = 'cube-1';
    obs.seen.here.onSpire = true;
    for (const action of actions) expect(taskAdvances(obs, action)).toBe(false);
  });

  it('uses only visible cube identities, the carried cube, and the visible Spire direction', () => {
    const obs = observation(0, { task: 'Put as many cubes as you can on the Spire before the hour ends.' });
    const hasGoal = (id: string) => taskAdvances(obs, { id, kind: id.split(' ')[0] ?? '', label: id });
    expect(hasGoal('pick cube-1')).toBe(true);
    expect(hasGoal('pick cube-99')).toBe(false);
    expect(hasGoal('move N')).toBe(false);
    obs.seen.carrying = 'cube-1';
    expect(hasGoal('move N')).toBe(true);
    expect(hasGoal('move S')).toBe(false);
    expect(hasGoal('place N')).toBe(true);
    expect(hasGoal('place here')).toBe(false);
    expect(hasGoal('throw N hard')).toBe(false);
    obs.seen.spire = null;
    expect(hasGoal('move N')).toBe(false);
    expect(hasGoal('place N')).toBe(false);
    obs.seen.here.onSpire = true;
    expect(hasGoal('place here')).toBe(true);
    obs.seen.carrying = 'rock';
    expect(hasGoal('place here')).toBe(false);
  });
});
