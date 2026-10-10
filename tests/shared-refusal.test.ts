import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as nine from '../src/game/engine9';
import * as ten from '../src/game/engine10';
import type { GameInput } from '../src/game/types';
import blocked from './fixtures/published-nine-intake-final-route.json';
import golden from './fixtures/published-ten-route.json';

function oldAt(count: number) {
  let s = nine.createGame(blocked.seed);
  for (const input of blocked.inputs.slice(0, count)) s = nine.transition(s, input as GameInput);
  return s;
}
it('pins the actual public ten export and preserves its raw history through eleven', () => {
  let prior = nine.createGame(golden.seed);
  for (const input of golden.inputs) prior = nine.transition(prior, input as GameInput);
  const old = ten.restoreGame(nine.serializeGame(prior));
  const raw = ten.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(golden.sha256);
  let s = restoreGame(raw);
  const { engine3Save, engine3InputCount, ...same } = s;
  const { engine3Save: base, engine3InputCount: cutoff, ...original } = old;
  expect(same).toEqual(original);
  expect(base).toBeTruthy();
  expect(cutoff).toBe(64);
  expect(engine3Save).toBe(raw);
  expect(engine3InputCount).toBe(64);
  s = transition(s, { type: 'action', id: 'rest' });
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('attributes the actual player-side continuation to the player and waits to their exact endpoint', () => {
  const index = blocked.playerRefusalIndex;
  expect(index).toBeGreaterThan(0);
  let s = restoreGame(nine.serializeGame(oldAt(index)));
  const at = s.now;
  s = transition(s, { type: 'action', id: 'workshop-intake-space' });
  expect(
    s.people.dad?.trace.findLast(
      (t) => t.at === at && t.considered.some((c) => c.affordanceId === 'cabinet-space'),
    )?.chosenAffordanceId,
  ).toBe('cabinet-space');
  expect(
    s.people.player?.trace.findLast(
      (t) => t.at === at && t.considered.some((c) => c.affordanceId === 'cabinet-space'),
    )?.chosenAffordanceId,
  ).toBe('ordinary-rest');
  expect(s.journal?.at(-1)?.speaker).toBe('You');
  expect(s.journal?.at(-1)?.text).toContain('Dad was ready');
  expect(s.workshop?.intakeSpace).toBe(false);
  expect(getView(s).actions.some((a) => a.id === 'wait-player-activity')).toBe(true);
  expect(getView(s).actions.some((a) => a.id === 'wait-dad-activity')).toBe(false);
  const end = s.people.player?.activity?.endsAt;
  s = transition(s, { type: 'action', id: 'wait-player-activity' });
  expect(s.now).toBe(end);
  expect(s.people.player?.activity).toBeNull();
  expect(s.workshop?.intakeSpace).toBe(false);
  for (const p of Object.values(s.people)) expect(p.now).toBe(s.now);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('real Dad continuation remains his own refusal and the actual day-three run can reach consent', () => {
  let s = restoreGame(nine.serializeGame(oldAt(blocked.inputs.length)));
  expect(
    createHash('sha256')
      .update(nine.serializeGame(oldAt(blocked.inputs.length)))
      .digest('hex'),
  ).toBe(blocked.sha256);

  for (let n = 0; n < 40 && !s.workshop?.intakeSpace; n++) {
    const available = getView(s).actions;
    const id = available.some((a) => a.id === 'workshop-intake-space')
      ? 'workshop-intake-space'
      : available.some((a) => a.id === 'wait-person')
        ? 'wait-person'
        : 'rest';
    s = transition(s, { type: 'action', id });
    if (
      id === 'workshop-intake-space' &&
      !s.workshop?.intakeSpace &&
      s.journal?.at(-1)?.speaker === 'Dad'
    )
      expect(s.workshop?.intakeSpace).toBe(false);
    if (!s.workshop?.intakeSpace) {
      const wait = getView(s).actions.find(
        (a) => a.id === 'wait-player-activity' || a.id === 'wait-dad-activity',
      );
      if (wait) s = transition(s, { type: 'action', id: wait.id });
    }
  }
  expect(s.workshop?.intakeSpace).toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('a real Dad activity continuation still produces his own refusal without granting work', () => {
  const index = blocked.inputs.findIndex(
    (i) => i.type === 'action' && i.id === 'workshop-intake-space',
  );
  let s = restoreGame(nine.serializeGame(oldAt(index)));
  const at = s.now;
  s = transition(s, { type: 'action', id: 'workshop-intake-space' });
  const d = s.people.dad?.trace.findLast(
    (t) => t.at === at && t.considered.some((c) => c.affordanceId === 'cabinet-space'),
  );
  expect(d?.chosenAffordanceId).not.toBe('cabinet-space');
  expect(s.journal?.at(-1)?.speaker).toBe('Dad');
  expect(s.workshop?.intakeSpace).toBe(false);
  expect(getView(s).actions.some((a) => a.id === 'wait-dad-activity')).toBe(true);
  expect(getView(s).actions.some((a) => a.id === 'wait-player-activity')).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
