import { expect, it } from 'vitest';
import type { ObjectView } from '../src/game/types';
import { handedBackTitle, selectedObjectEvidence } from '../src/ui/transitionPresentation';

const timer: ObjectView = {
  id: 'nora-timer',
  title: 'Nora’s timer',
  owner: 'Nora',
  story: '',
  condition: 'Checked',
  visual: 'off',
  form: 'timer',
  observations: ['The timer rings after the checked interval.'],
};
it('a handback banner follows actual settled custody, not return-button wording or a lost focus', () => {
  expect(
    handedBackTitle(timer, { location: 'bench' }, { location: 'bench', awaitingCollection: true }),
  ).toBeUndefined();
  expect(
    handedBackTitle(timer, { location: 'shelf' }, { location: 'shelf', awaitingCollection: true }),
  ).toBeUndefined();
  expect(
    handedBackTitle(
      timer,
      { location: 'bench' },
      { location: 'returned', awaitingCollection: true },
    ),
  ).toBeUndefined();
  expect(handedBackTitle(timer, { location: 'bench' }, { location: 'returned' })).toBe(
    'Nora’s timer',
  );
  expect(
    handedBackTitle(timer, { location: 'returned' }, { location: 'returned' }),
  ).toBeUndefined();
});
it('selecting the paper street uses only its own evidence; no evidence is an empty result', () => {
  const model = {
    ...timer,
    id: 'paper-street',
    title: 'Your paper street',
    observations: ['The saved paper shutters are still here.'],
  };
  expect(selectedObjectEvidence(model)).toBe('The saved paper shutters are still here.');
  expect(selectedObjectEvidence({ ...model, observations: [] })).toBeNull();
  expect(selectedObjectEvidence(null)).toBeNull();
  expect(timer.observations[0]).toBe('The timer rings after the checked interval.');
});
