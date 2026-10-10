import { describe, expect, it } from 'vitest';
import { optionalStoryChoices, storyBeat } from '../src/game/story';

const context = (unlocked: string[] = []) => ({
  chapter: 'garage',
  focusId: 'personal',
  unlocked,
});

describe('authored story continuity', () => {
  it('reveals linked memories after their subject has been introduced', () => {
    expect(optionalStoryChoices(context()).map((c) => c.id)).not.toContain('lamp-drawing');
    expect(optionalStoryChoices(context(['story:remember-pencil'])).map((c) => c.id)).toContain(
      'lamp-drawing',
    );
    expect(
      optionalStoryChoices(context(['story:remember-pencil', 'story:lamp-drawing'])).map(
        (c) => c.id,
      ),
    ).not.toContain('lamp-drawing');
  });

  it('keeps the opening small and does not repeat a departure at every Sam intake', () => {
    expect(optionalStoryChoices({ ...context(), chapter: 'family' })).toEqual([]);
    expect(
      storyBeat('request-sam')
        .map((l) => l.text)
        .join(' '),
    ).not.toContain('come back after');
    const invite = optionalStoryChoices({ ...context(), focusOwner: 'Sam' }).find(
      (c) => c.id === 'observer-invite',
    );
    expect(invite?.lines.map((l) => l.text).join(' ')).toContain('fifty minutes');
  });
});

it('does not offer a question about the stove before its story has been heard', () => {
  const nora = {
    chapter: 'garage',
    focusId: 'friend-0',
    focusOwner: 'Nora',
    unlocked: ['story:ask-nora-morning'],
  };
  expect(optionalStoryChoices(nora).map((c) => c.id)).not.toContain('nora-stove');
  expect(
    optionalStoryChoices({ ...nora, unlocked: [...nora.unlocked, 'story:kitchen-winter'] }).map(
      (c) => c.id,
    ),
  ).toContain('nora-stove');
});

it('reveals institutional history over school years and reserves regular-work agreements for graduation', () => {
  const early = { chapter: 'garage', focusId: null, unlocked: [], holiday: 0, graduated: false };
  expect(optionalStoryChoices(early).map((c) => c.id)).not.toContain('parts-labels');
  expect(optionalStoryChoices({ ...early, holiday: 1 }).map((c) => c.id)).toContain('parts-labels');
  expect(optionalStoryChoices({ ...early, holiday: 1 }).map((c) => c.id)).not.toContain(
    'nora-repair-street',
  );
  expect(optionalStoryChoices({ ...early, holiday: 2 }).map((c) => c.id)).toContain(
    'nora-repair-street',
  );
  expect(optionalStoryChoices({ ...early, holiday: 3 }).map((c) => c.id)).not.toContain(
    'after-school-work',
  );
  expect(
    optionalStoryChoices({ ...early, holiday: 4, graduated: true }).map((c) => c.id),
  ).toContain('after-school-work');
});
