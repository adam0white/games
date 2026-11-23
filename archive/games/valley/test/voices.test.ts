import { exportRun } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createCommunity, createPerson, perceive } from '../src/sim/hf.ts';
import { visitWords } from '../src/sim/voices.ts';
import { required } from './required.ts';

it('reads an actually retained deed through public current inspection without changing semantic memory', () => {
  const person = createPerson({
    id: 'voice-test',
    name: 'Visitor',
    seed: 7,
    sex: 'female',
    bornAt: -25 * 525600,
  });
  const community = createCommunity([person]);
  const heard = perceive(person, [
    {
      at: 0,
      channel: 'social',
      kind: 'gift',
      actorId: 'kahya',
      valence: 0.8,
      salience: 1,
      summary: 'the kahya sent grain to this house',
    },
  ]);
  expect(heard).toHaveLength(1);
  const run = required(community.run);
  const before = exportRun(run);
  const episodes = structuredClone(person.memory.episodes);
  expect(
    episodes.some((e) => e.actorId === 'kahya' && e.summary === 'the kahya sent grain to this house'),
  ).toBe(true);
  const said: Record<string, number> = {};
  const words = visitWords({ seed: 7, minute: person.now, said, bread: 100, trust: 0.5 }, person, true);
  expect(words).toContain('sent grain to this house');
  expect(person.memory.episodes).toEqual(episodes);
  expect(exportRun(run)).toEqual(before);
});
