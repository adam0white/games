import { expect, it } from 'vitest';
import { advanceApprentice } from '../src/game/apprentice';
import { getView, restoreGame } from '../src/game/engine';
import * as thirteen from '../src/game/engine13';
import * as fourteen from '../src/game/engine14';
import * as fifteen from '../src/game/engine15';
import type { GameInput } from '../src/game/types';
import route from './fixtures/fifteen-owner-return-route.json';
import base from './fixtures/fourteen-owner-return-route.json';
import source from './fixtures/owner-thirteen-school-apprentice-route.json';
import { positiveAction } from './support/public-attendance';

it('describes the actual owner model check without announcing yesterday’s session or granting passive verification', () => {
  let historical = thirteen.createGame(source.seed);
  for (const input of source.inputs)
    historical = thirteen.transition(historical, input as GameInput);
  let intermediate = fourteen.restoreGame(thirteen.serializeGame(historical));
  for (const input of base.inputs)
    intermediate = fourteen.transition(intermediate, input as GameInput);
  let modelRun = fifteen.restoreGame(fourteen.serializeGame(intermediate));
  for (const input of route.inputs) {
    if (input.type === 'action' && input.id === 'ask-mum') break;
    modelRun = fifteen.transition(modelRun, input as GameInput);
  }
  let current = restoreGame(fifteen.serializeGame(modelRun));
  const model = () => current.objects.find((item) => item.id === 'paper-street');
  const priorLine = current.nextLineId ?? 0;
  current = positiveAction(current, 'ask-mum');
  const reply = (getView(current).journal ?? []).filter((line) => line.id >= priorLine);
  expect(
    reply.some((line) => line.speaker === 'Mum' && line.text.includes('repeat its movement')),
  ).toBe(true);
  expect(reply.some((line) => line.text.includes('Leave it on'))).toBe(false);
  expect(model()?.verified).toBe(false);
  // Waiting for Mum may already finish elapsed time; it never performs the circuit.
  if (getView(current).actions.some((action) => action.id === 'wait-check'))
    current = positiveAction(current, 'wait-check');
  expect(model()?.verified).toBe(false);
  expect(
    (getView(current).journal ?? [])
      .filter((line) => line.id >= priorLine)
      .some((line) => line.text.includes('The agreed bench session has ended.')),
  ).toBe(false);
  current = positiveAction(current, 'check-result');
  expect(model()?.verified).toBe(true);
}, 30_000);

it('announces an actual session crossing once, preserving the unfinished check', () => {
  const state = thirteen.createGame(42);
  // A controlled timed check crosses the known endpoint during this advance.
  const sam = state.people.sam;
  if (!sam) throw Error('Missing Sam');
  const start = sam.now;
  const item = {
    id: 'expiry-control',
    owner: 'Nora',
    title: 'A kept light',
    story: '',
    form: 'lamp' as const,
    fault: 'battery' as const,
    location: 'bench' as const,
    observations: [],
    inspected: true,
    tested: true,
    attempted: 1,
    repaired: true,
    verified: false,
    discovered: true,
    checkStarted: start,
  };
  state.objects.push(item);
  state.apprentice = {
    visitUntil: start + 5,
    arranged: true,
    supervisedCompleted: false,
    independentCompleted: 0,
    completedJobIds: [],
    role: 'trainee',
    jobId: item.id,
    supervised: true,
  };
  const words: string[] = [];
  advanceApprentice(
    state,
    start + 30,
    (_speaker, text) => words.push(text),
    () => true,
  );
  expect(words.filter((text) => text.includes('session has ended'))).toHaveLength(1);
  advanceApprentice(
    state,
    start + 60,
    (_speaker, text) => words.push(text),
    () => true,
  );
  expect(words.filter((text) => text.includes('session has ended'))).toHaveLength(1);
  expect(item.verified).toBe(false);
});
