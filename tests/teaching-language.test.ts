import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import { earnedHandoff } from './support/earned-handoff';

it('describes demonstrated work in ordinary language and Sam returns his own lamp in first person', () => {
  const state = earnedHandoff();
  const words = getView(state).journal ?? getView(state).conversation;
  expect(
    words.some(
      (line) => line.speaker === 'Sam' && line.text.includes('trying a known-good battery'),
    ),
  ).toBe(true);
  expect(
    words.some(
      (line) =>
        line.speaker === 'Sam' &&
        line.text.includes('My spare table lamp can go back where I keep it'),
    ),
  ).toBe(true);
  expect(
    words.some((line) => line.speaker === 'Sam' && line.text.includes('test battery is the step')),
  ).toBe(false);
});

it('does not present an unattended bell as a completed timed run', () => {
  const state = transition(createGame(), { type: 'action', id: 'talk-family' });
  const item = state.objects[0];
  if (!item) throw Error('Missing object');
  state.focusId = item.id;
  item.discovered = true;
  item.form = 'bell';
  item.repaired = true;
  item.checkStarted = state.now - 60;
  expect(getView(state).note).toContain('five minutes of repeated ringing');
  expect(getView(state).note).toContain('with you present');
  expect(getView(state).note).not.toContain('ready to read');
  expect(item.verified).toBe(false);
});
