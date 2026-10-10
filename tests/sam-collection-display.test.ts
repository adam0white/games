import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame } from '../src/game/engine';
import * as eight from '../src/game/engine8';
import * as twelve from '../src/game/engine12';
import * as thirteen from '../src/game/engine13';
import type { GameInput } from '../src/game/types';
import fixture from './fixtures/candidate-thirteen-paid-continuation.json';

it('keeps the real native thirteen paid story exact while distinguishing checked collection from active work', () => {
  let old = eight.createGame(fixture.seed);
  for (const input of fixture.inputs.slice(0, fixture.baseEightCount))
    old = eight.transition(old, input as GameInput);
  old = twelve.restoreGame(eight.serializeGame(old));
  for (const input of fixture.inputs.slice(fixture.baseEightCount, fixture.baseTwelveCount))
    old = twelve.transition(old, input as GameInput);
  let s = thirteen.restoreGame(twelve.serializeGame(old));
  let seenWorking = false,
    seenChecked = false,
    seenExpired = false;
  for (const input of fixture.inputs.slice(fixture.baseTwelveCount)) {
    s = thirteen.transition(s, input as GameInput);
    const item = s.objects.find((o) => o.id === s.apprentice?.jobId);
    if (item?.id !== 'workshop-evan') continue;
    const before = JSON.stringify(s);
    const view = getView(s);
    expect(JSON.stringify(s)).toBe(before);
    if (!item.verified) {
      expect(view.apprenticeship?.activity).toContain('Working on Evan');
      seenWorking = true;
    } else if (item.awaitingCollection) {
      expect(
        s.journal?.some(
          (line) =>
            line.speaker === 'Sam' && line.text === 'The checked light is labelled for collection.',
        ),
      ).toBe(true);
      expect(view.apprenticeship?.activity).toBe(
        'Checked and labelled for collection: Evan’s folding work light',
      );
      expect(view.apprenticeship?.activity).not.toContain('Working');
      expect(s.people.sam?.activity?.affordanceId).not.toContain('repair');
      seenChecked = true;
      if (s.apprentice && s.now > s.apprentice.visitUntil) seenExpired = true;
    }
  }
  expect([seenWorking, seenChecked, seenExpired]).toEqual([true, true, true]);
  const raw = thirteen.serializeGame(s);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.sha256);
  expect(thirteen.serializeGame(thirteen.restoreGame(raw))).toBe(raw);
  const current = restoreGame(raw);
  expect(current.journal).toEqual(s.journal);
  expect(current.inputs).toEqual(s.inputs);
  expect(serializeGame(restoreGame(serializeGame(current)))).toBe(serializeGame(current));
  expect(s.apprentice?.jobId).toBeUndefined();
  expect(getView(s).apprenticeship?.activity).not.toContain('Working');
}, 20_000);
