import { exportRun } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createCommunity, previewAnswer } from '../src/sim/hf.ts';
import { createPerson } from '../src/sim/hf-person.ts';
import { required } from './required.ts';

it('keeps conditional answers independent of hidden target state and leaves both live runs unchanged', () => {
  const replies = [0.1, 0.99].map((health) => {
    const observer = createPerson({
      id: 'kahya',
      name: 'Steward',
      sex: 'male',
      seed: 7,
      bornAt: -30 * 525600,
    });
    const target = createPerson({
      id: 'target',
      name: 'Resident',
      sex: 'female',
      seed: 7,
      bornAt: -30 * 525600,
      body: { health, satiety: health },
      traits: { conscientiousness: health },
    });
    const community = createCommunity([observer, target]);
    const run = required(community.run);
    const before = exportRun(run);
    const answer = previewAnswer(
      observer,
      target.id,
      [
        {
          id: 'reap-agha',
          label: 'reap the field',
          action: 'reap-agha',
          duration: 120,
          effort: 0.7,
          advertises: { esteem: 0.03 },
        },
        {
          id: 'rest',
          label: 'rest at home',
          action: 'rest',
          duration: 60,
          effort: 0,
          advertises: { rest: 0.3, leisure: 0.1, water: 0.2 },
        },
      ],
      { voiceId: 'kahya', action: 'reap-agha', strength: 0.6, appeal: 'duty', since: 0 },
    );
    expect(exportRun(run)).toEqual(before);
    expect(answer.result.hypothetical).toBe(true);
    expect(answer.result.knowledgeLimit.join(' ')).toMatch(/impression/i);
    expect(answer.result.impression?.cues.every((cue) => cue.confidence === 0)).toBe(true);
    return { resolution: answer.resolution, impression: answer.result.impression };
  });
  expect(replies[0]).toEqual(replies[1]);
});
