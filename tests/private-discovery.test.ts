import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/current-engine';
import { freshOperations } from '../src/game/operations';
import { actionDestination } from '../src/ui/workspaceFlow';

it('extends optional canonical discovery to an adult private bench outside the garage', () => {
  const s = createGame(7);
  if (!s.campaign) throw Error('Missing campaign');
  s.campaign.graduated = true;
  s.chapter = 'bench';
  s.operations = freshOperations(s.now);
  s.operations.route = 'private';
  const before = structuredClone(s.parts);
  expect(getView(s).actions.some((a) => a.id === 'find-paper-street')).toBe(true);
  const next = transition(s, { type: 'action', id: 'find-paper-street' });
  const model = next.objects.find((o) => o.id === 'paper-street');
  expect(model).toMatchObject({
    owner: 'You',
    fault: 'gear',
    repaired: false,
    verified: false,
    appearance: 'model',
  });
  expect(next.parts).toEqual(before);
  expect(getView(next).actions.some((a) => a.id === 'find-paper-street')).toBe(false);
  expect(getView(next).actions.some((a) => a.id === 'evening-bring-model')).toBe(true);
  expect(() => transition(next, { type: 'action', id: 'find-paper-street' })).toThrow();
});
it('does not grant discovery to a fresh school opening or automatically create the model', () => {
  const s = createGame(7);
  expect(getView(s).actions.some((a) => a.id === 'find-paper-street')).toBe(false);
  expect(s.objects.some((o) => o.id === 'paper-street')).toBe(false);
});
it('keeps discovery and the solo shadow-scene entry at the personal bench', () => {
  for (const id of ['find-paper-street', 'evening-bring-model']) {
    expect(actionDestination({ id, label: id }, false)).toBe('bench');
    expect(actionDestination({ id, label: id }, true)).toBe('bench');
  }
});
