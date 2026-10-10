import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';

// Actual native-17 keyboard/3D browser export, 2026-10-10. The nine input
// records reconstruct its exact bytes; keep the observed times as provenance.
const sourceSha256 = '5170799d439874eeab4caab67d8a7b97d843fb1aca26214deb24191089f20439';
const route = [
  [840, 'talk-family'],
  [844, 'inspect'],
  [848, 'test-battery'],
  [852, 'clean-contact'],
  [864, 'verify'],
  [868, 'wait-check'],
  [878, 'wait-check'],
  [888, 'check-result'],
  [892, 'return'],
] as const;

it('replays the actual native-17 keyboard repair, retaining its checked result without independent apprentice credit', () => {
  let s = createGame(1701);
  for (const [at, id] of route) {
    expect(s.now).toBe(at);
    expect(getView(s).actions.some((action) => action.id === id)).toBe(true);
    s = transition(s, { type: 'action', id });
    const lamp = s.objects.find((item) => item.id === 'family');
    if (id === 'verify' || id === 'wait-check') expect(lamp?.verified).toBe(false);
  }
  const raw = serializeGame(s);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(sourceSha256);
  expect(
    s.inputs.map((entry) => [entry.at, entry.input.type === 'action' ? entry.input.id : null]),
  ).toEqual(route);
  expect(s.journal).toHaveLength(11);
  const lamp = s.objects.find((item) => item.id === 'family');
  expect(lamp?.repaired).toBe(true);
  expect(lamp?.verified).toBe(true);
  expect(lamp?.location).toBe('returned');
  expect(lamp?.completedBy).toBe('player');
  expect(lamp?.playerAssisted).toBe(true);
  expect(lamp?.independent).not.toBe(true);
  expect(s.apprentice?.independentCompleted ?? 0).toBe(0);
  expect(s.objects.find((item) => item.id === 'personal')?.repaired).toBe(false);
  expect(restoreGame(raw)).toEqual(s);
  expect(serializeGame(restoreGame(raw))).toBe(raw);
});
