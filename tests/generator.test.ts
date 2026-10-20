import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { runUseTest } from '../src/game/model';
import { teachObserved } from '../src/game/people';
import type { Job } from '../src/game/types';

function laterOffers(seed: number, day: number): Job[] {
  let state = createGame(seed);
  while (state.day < day) {
    if (state.ended) state = dispatch(state, { type: 'continue' }).state;
    state = dispatch(state, { type: 'next-day' }).state;
  }
  return state.jobs.filter((j) => j.status === 'offer' && j.due === (day - 1) * 1440 + 1440 + 1020);
}

describe('later owner requests', () => {
  it('offers Evan a fresh supported carried-light request during the first week regardless of Sam’s learning', () => {
    for (const seed of [2, 4, 69, 416]) {
      let taught = createGame(seed);
      let withheld = createGame(seed);
      const sam = taught.people.sam;
      if (!sam) throw new Error('Missing Sam');
      teachObserved(
        sam,
        'control',
        { family: 'electrical', stage: 'intake' },
        'inspect:switch',
        'control-watch',
        'success',
        taught.now,
      );
      for (let day = 1; day < 4; day++) {
        taught = dispatch(taught, { type: 'next-day' }).state;
        withheld = dispatch(withheld, { type: 'next-day' }).state;
      }
      const path = taught.jobs.find((j) => j.title === 'Evan’s path lantern');
      const samePath = withheld.jobs.find((j) => j.title === 'Evan’s path lantern');
      if (!path || !samePath) throw new Error('Missing held-out request');
      expect(path.model).toEqual(samePath.model);
      expect(path.status).toBe(samePath.status);
      expect(path.due).toBe(samePath.due);
      expect(path.id).not.toBe(taught.jobs[0]?.id);
      expect(path.ownerId).toBe('evan');
      expect(path.requiredConditions).toEqual(['movement']);
      expect(path.description).toContain(
        'The garden path is uneven. I need it to stay on when it is carried.',
      );
      expect(
        path.model.components.filter((c) => c.condition !== 'good').map((c) => [c.id, c.condition]),
      ).toEqual([['switch', 'worn']]);
      expect(runUseTest(path.model, 'bench').passes).toBe(true);
      expect(runUseTest(path.model, 'movement').passes).toBe(false);
    }
  });
  // Recorded under engine-4 rules, where a neighbour still waiting on an overdue object keeps bringing more.
  it('offers each named first-week object only once and never duplicates a day', () => {
    for (const seed of [2, 4, 69, 416]) {
      let state = createGame(seed, 'legacy');
      while (state.day < 8) state = dispatch(state, { type: 'next-day' }).state;
      const requests = state.jobs.filter((j) => j.reward > 0);
      expect(requests).toHaveLength(6);
      expect(new Set(requests.map((j) => `${j.ownerId}:${j.title}`)).size).toBe(6);
      expect(
        state.log.some(
          (e) =>
            e.text ===
            'One neighbour has brought a request. It can wait while you decide what fits.',
        ),
      ).toBe(true);
      expect(
        state.log.some(
          (e) => e.text === 'No new requests today. The existing objects and promises remain.',
        ),
      ).toBe(true);
      expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    }
  });
  it('keeps resolved first-week identity and introduces continuing work as distinct numbered objects', () => {
    let state = createGame(42);
    state = dispatch(state, { type: 'next-day' }).state;
    const original = state.jobs.find((j) => j.title === 'Nora’s keepsake music box');
    if (!original) throw new Error('Missing first request');
    state = dispatch(state, { type: 'accept', jobId: original.id }).state;
    state = dispatch(state, { type: 'deliver', jobId: original.id, unfinished: true }).state;
    while (state.day < 8) state = dispatch(state, { type: 'next-day' }).state;
    expect(state.jobs.filter((j) => j.title === original.title)).toHaveLength(1);
    state = dispatch(state, { type: 'continue' }).state;
    const resumed = loadGame(saveGame(state));
    state = dispatch(state, { type: 'next-day' }).state;
    expect(saveGame(dispatch(resumed, { type: 'next-day' }).state)).toBe(saveGame(state));
    const commissions = state.jobs.filter((j) => j.title.includes(' commission '));
    expect(commissions).toHaveLength(2);
    expect(new Set(commissions.map((j) => `${j.ownerId}:${j.title}`)).size).toBe(2);
    for (const job of commissions) {
      expect(job.description).not.toContain('grandmother');
      expect(job.description).toMatch(/different|another/);
    }
    expect(state.jobs.find((j) => j.id === original.id)?.returnedUnfinished).toBe(true);
  });
  it('does not bring another commission while that family is still assigned or recently returned', () => {
    let state = dispatch(createGame(42), { type: 'next-day' }).state;
    const original = state.jobs.find((j) => j.title === 'Nora’s reading light');
    if (!original) throw new Error('Missing first request');
    state = dispatch(state, { type: 'accept', jobId: original.id }).state;
    while (state.day < 8) state = dispatch(state, { type: 'next-day' }).state;
    state = dispatch(state, { type: 'continue' }).state;
    state = dispatch(state, { type: 'next-day' }).state;
    expect(state.jobs.filter((j) => j.title.startsWith('Nora’s reading light'))).toHaveLength(1);
    state = dispatch(state, { type: 'deliver', jobId: original.id, unfinished: true }).state;
    state = dispatch(state, { type: 'next-day' }).state;
    expect(state.jobs.filter((j) => j.title.startsWith('Nora’s reading light'))).toHaveLength(1);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });
  it.each([2, 4, 69, 72, 416])(
    'keeps seed %s governor faults physically meaningful and clears an old setting with its old fault',
    (seed) => {
      for (const job of [
        ...laterOffers(seed, 3),
        ...laterOffers(seed, 4),
        ...laterOffers(seed, 9),
      ]) {
        const governor = job.model.components.find((c) => c.kind === 'governor');
        if (governor)
          expect(governor.setting, `${seed}/${job.id}/${governor.condition}`).toBe(
            governor.condition === 'misaligned' ? 4 : 2,
          );
        for (const component of job.model.components.filter((c) => c.condition !== 'good')) {
          const baseline = structuredClone(job.model);
          for (const part of baseline.components) {
            part.condition = 'good';
            if (part.kind === 'governor') part.setting = 2;
          }
          const isolated = structuredClone(baseline);
          const fault = isolated.components.find((c) => c.id === component.id);
          if (!fault) throw new Error('Missing generated part');
          Object.assign(fault, component);
          expect(
            ['bench', 'movement', 'load'].some(
              (condition) =>
                runUseTest(baseline, condition as 'bench').output !==
                runUseTest(isolated, condition as 'bench').output,
            ),
            `${seed}/${component.kind}/${component.condition}`,
          ).toBe(true);
        }
      }
    },
  );
  it.each([2, 4, 69])('reports what seed %s actually does under each use condition', (seed) => {
    const jobs = [...laterOffers(seed, 3), ...laterOffers(seed, 4), ...laterOffers(seed, 9)];
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) {
      if (job.kind === 'lantern') {
        const bench = runUseTest(job.model, 'bench');
        const movement = runUseTest(job.model, 'movement');
        expect(job.description).toContain(
          `On the shelf, ${bench.output === 0 ? 'it stays dark' : bench.passes ? 'it stays bright' : 'it stays dim'}`,
        );
        expect(job.description).toContain(
          `when carried, ${movement.output === 0 ? 'it goes dark' : movement.passes ? 'it stays bright' : 'it stays dim'}`,
        );
      } else if (job.kind === 'fan') {
        const air = (condition: 'bench' | 'load') => {
          const result = runUseTest(job.model, condition);
          return result.output === 0
            ? 'there is no airflow'
            : result.passes
              ? 'the airflow stays steady'
              : 'the airflow falls short';
        };
        expect(job.description).toContain(`At rest, ${air('bench')}`);
        expect(job.description).toContain(`through the grille, ${air('load')}`);
      } else {
        const pace = (condition: 'bench' | 'load') => {
          const result = runUseTest(job.model, condition);
          return result.output === 0
            ? 'the melody stops'
            : result.passes
              ? 'the melody keeps its pace'
              : result.output < (job.model.desiredRPM ?? 15)
                ? 'the melody runs too slowly'
                : 'the melody runs too fast';
        };
        expect(job.description).toContain(`On the bench, ${pace('bench')}`);
        expect(job.description).toContain(`while driving the figures, ${pace('load')}`);
      }
      expect(job.description).not.toMatch(
        /\b(dirty|worn|jammed|misaligned|weak cell|open circuit)\b/,
      );
    }
  });
  it('preserves the opening family quote and the three authored first neighbour reports', () => {
    let state = createGame(42);
    expect(state.jobs[0]?.description).toContain(
      'It lights the table. Carry it to the garden and it goes dark.',
    );
    state = dispatch(state, { type: 'next-day' }).state;
    expect(state.jobs.find((j) => j.title === 'Nora’s reading light')?.description).toContain(
      'It is bright for a moment, then fades.',
    );
    expect(state.jobs.find((j) => j.title === 'Evan’s small desk fan')?.description).toContain(
      'It spins here. Press it against the filter and it slows down.',
    );
    expect(state.jobs.find((j) => j.title === 'Nora’s keepsake music box')?.description).toContain(
      'The melody sounds wrong. This was my grandmother’s.',
    );
  });
  it('under engine 5, a neighbour still waiting past the promised time says so and brings nothing new', () => {
    for (const seed of [2, 4, 69, 416]) {
      let state = createGame(seed);
      while (state.day < 8) state = dispatch(state, { type: 'next-day' }).state;
      const requests = state.jobs.filter((j) => j.reward > 0);
      expect(new Set(requests.map((j) => `${j.ownerId}:${j.title}`)).size).toBe(requests.length);
      expect(requests.length).toBeLessThanOrEqual(6);
      expect(state.log.some((e) => e.tone === 'warning' && e.text.startsWith('You said '))).toBe(
        true,
      );
      expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    }
  });
});
