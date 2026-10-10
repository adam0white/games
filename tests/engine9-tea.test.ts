import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createGame, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as nine from '../src/game/engine9';
import type { GameInput } from '../src/game/types';
import fixture from './fixtures/published-nine-timer-route.json';

it('preserves the actual native nine timer checkpoint hash before ten continuation', () => {
  let old = nine.createGame(fixture.seed);
  for (const input of fixture.inputs) old = nine.transition(old, input as GameInput);
  const raw = nine.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.sha256);
  let s = restoreGame(raw);
  const { engine3Save, engine3InputCount, ...preserved } = s;
  expect(preserved).toEqual(old);
  expect(engine3Save).toBe(raw);
  expect(engine3InputCount).toBe(64);
  s = transition(s, { type: 'action', id: 'rest' });
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('tea refers to the real timer cycle rather than a light and never awards its check result', () => {
  let s = createGame(fixture.seed);
  for (const input of fixture.inputs) {
    s = transition(s, input as GameInput);
    if (input.type === 'action' && input.id === 'rest' && s.now > 529000) break;
  }
  expect(s.journal?.at(-1)?.text).toContain('timer had time for its cycle');
  expect(s.journal?.at(-1)?.text).not.toContain('light');
  const timer = s.objects.find((o) => o.id === s.focusId);
  expect(timer?.form).toBe('timer');
  expect(timer?.verified).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('company alone does not invent a running test when the timer has not been started', () => {
  let s = createGame(fixture.seed);
  for (const input of fixture.inputs.slice(0, 57)) s = transition(s, input as GameInput);
  expect(s.objects.find((o) => o.id === s.focusId)?.checkStarted).toBeUndefined();
  for (const id of [
    'workshop-cabinet-open',
    'workshop-cabinet-close',
    'workshop-cabinet-open',
    'workshop-cabinet-close',
  ])
    s = transition(s, { type: 'action', id });
  s = transition(s, { type: 'action', id: 'rest' });
  expect(s.journal?.at(-1)?.speaker).toBe('Mum');
  expect(s.journal?.at(-1)?.text).toBe('It’s nice having you here.');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('a real light check keeps its light-specific tea wording', () => {
  let s = createGame(42);
  for (const id of [
    'talk-family',
    'inspect',
    'test-battery',
    'clean-contact',
    'verify',
    'wait-check',
    'rest',
  ])
    s = transition(s, { type: 'action', id });
  expect(s.journal?.at(-1)?.speaker).toBe('Mum');
  expect(s.journal?.at(-1)?.text).toContain('light had time for its check');
  expect(s.objects.find((o) => o.id === s.focusId)?.verified).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
