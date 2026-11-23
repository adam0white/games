import { expect, it } from 'vitest';
import type { Note } from '../../src/sim/valley.ts';
import { morningResult } from '../../src/ui/morning-guide.ts';

it('shows the actual ask-scoped public outcome, not ambiguous speech or a future answer', () => {
  const notes: Note[] = [
    {
      id: 1,
      at: 10,
      kind: 'reply',
      ask: 'first',
      text: 'Three people postponed cutting the landowner’s barley.',
      words: 'I will reap.',
      weight: 1,
    },
    { id: 2, at: 11, kind: 'reply', ask: 'other', text: 'Someone refused another request.', weight: 2 },
    { id: 3, at: 30, kind: 'reply', ask: 'first', text: 'A later answer.', weight: 1 },
  ];
  const state = { minute: 20, notes };
  expect(morningResult(state, 'first')).toEqual({ id: 1, at: 10, text: notes[0]?.text });
  expect(morningResult(state, undefined)).toBeUndefined();
  expect(morningResult(state, 'missing')).toBeUndefined();
});

it('updates rewritten group and individual outcomes even when retained words do not change', () => {
  const note: Note = {
    id: 1,
    at: 10,
    kind: 'reply',
    ask: 'first',
    text: 'Three people postponed cutting.',
    words: 'I will reap.',
    group: 'off-first-0',
    ids: ['a', 'b', 'c'],
    weight: 1,
  };
  const state = { minute: 20, notes: [note] };
  const before = morningResult(state, 'first');
  note.ids?.shift();
  note.text = 'Two people postponed cutting.';
  expect(morningResult(state, 'first')?.text).toBe('Two people postponed cutting.');
  expect(before?.text).toBe('Three people postponed cutting.');
  expect(note.words).toBe('I will reap.');
  const individual: Note = {
    id: 2,
    at: 15,
    kind: 'reply',
    ask: 'first',
    who: 'a',
    text: 'Someone postponed cutting.',
    words: 'I will reap.',
    weight: 1,
  };
  state.notes.push(individual);
  individual.text = 'Someone postponed cutting, then came.';
  expect(morningResult(state, 'first')).toEqual({ id: 2, at: 15, text: individual.text });
});
