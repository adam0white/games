import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine18';

// Actual fresh keyboard UI download, 2026-10-10; room/camera navigation adds no input.
const sourceSha256 = 'c5439f2628f85da3f0bb278a7b618ed332aa8ee4b97b9ed05fea861cb78626ea';
const route = [
  [840, 'talk-family'],
  [844, 'inspect'],
  [848, 'test-battery'],
  [852, 'clean-contact'],
  [864, 'reassemble'],
  [867, 'verify'],
  [871, 'rest'],
  [901, 'check-result'],
  [905, 'return'],
] as const;

it('reconstructs the actual keyboard physical repair and its exact saved history without independent credit', () => {
  let s = createGame(1701);
  for (const [at, id] of route) {
    expect(s.now).toBe(at);
    expect(getView(s).actions.some((action) => action.id === id)).toBe(true);
    s = transition(s, { type: 'action', id });
    if (id === 'reassemble') {
      const lamp = s.objects.find((item) => item.id === 'family');
      expect(lamp?.access?.state).toBe('assembled');
      expect(lamp?.access?.retainedPieceIds).toEqual([]);
      expect(lamp?.verified).toBe(false);
    }
  }
  const raw = serializeGame(s);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(sourceSha256);
  expect(serializeGame(restoreGame(raw))).toBe(raw);
  expect(s.inputs.map((entry) => [entry.at, entry.input.id])).toEqual(route);
  expect(s.journal).toHaveLength(11);
  const lamp = s.objects.find((item) => item.id === 'family');
  expect(lamp?.verified).toBe(true);
  expect(lamp?.location).toBe('returned');
  expect(lamp?.access?.workMarkers).toEqual(['clean-contact']);
  expect(lamp?.playerAssisted).toBe(true);
  expect(lamp?.independent).not.toBe(true);
  expect(s.apprentice?.independentCompleted ?? 0).toBe(0);
});
