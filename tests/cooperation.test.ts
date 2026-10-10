import { createPerson } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame } from '../src/game/engine';
import { earnedHandoff } from './support/earned-handoff';
import { choose } from './support/school-route';

function cabinet(tired = false) {
  const s = createGame(42);
  s.chapter = 'garage';
  s.focusId = null;
  s.people.dad = createPerson({
    id: 'dad',
    name: 'Dad',
    seed: 42,
    now: s.now,
    bornAt: -55 * 365 * 1440,
    sex: 'male',
    needs: { competence: 0.1, belonging: 0.1 },
    body: tired ? { exertion: 0.98, sleepPressure: 0.95 } : { exertion: 0, sleepPressure: 0 },
  });
  return choose(s, 'workshop-cabinet-look');
}
it('Dad’s real choice starts shared work for the full task duration, while competing bodily needs can postpone it', () => {
  const base = cabinet(),
    tired = cabinet(true);
  const accepted = choose(base, 'workshop-cabinet-measure');
  const declined = choose(tired, 'workshop-cabinet-measure');
  expect(accepted.workshop?.cabinet).toBe('measured');
  expect(declined.workshop?.cabinet).toBe('looked');
  expect(declined.conversation.map((line) => line.text).join(' ')).toContain('too tired');
  expect(accepted.now - base.now).toBe(20);
  expect(declined.now - tired.now).toBe(2);
  const dad = accepted.people.dad,
    player = accepted.people.player;
  if (!dad || !player) throw Error('Missing partners');
  expect(dad.trace.at(-1)?.chosenAffordanceId).toBe('cabinet-measure');
  expect(dad.trace.at(-1)?.considered.some((c) => c.affordanceId === 'cabinet-measure')).toBe(true);
  expect(dad.chronicleDay?.actions.some((a) => a.action === 'cabinet-measure')).toBe(true);
  expect(player.chronicleDay?.actions.some((a) => a.action === 'cabinet-measure')).toBe(true);
  expect(dad.activity).toBeNull();
  expect(player.activity).toBeNull();
  expect(getView(accepted).whereabouts?.find((p) => p.id === 'dad')?.activity).toBe(
    'Finished the cabinet step with you',
  );
  for (const person of Object.values(accepted.people)) expect(person.now).toBe(accepted.now);
  expect(declined.people.dad?.trace.at(-1)?.chosenAffordanceId).not.toBe('cabinet-measure');
});
it('a joint cabinet step cannot silently run through Dad’s known hardware-shop absence', () => {
  let s = cabinet();
  s = choose(s, 'workshop-cabinet-measure');
  // An otherwise identical state immediately before the known 17:00 departure.
  const before = s.workshop?.cabinet;
  for (const p of Object.values(s.people)) p.now = 16 * 60 + 45;
  s.now = 16 * 60 + 45;
  const next = choose(s, 'workshop-cabinet-hang');
  expect(next.workshop?.cabinet).toBe(before);
  expect(next.people.dad?.activity?.affordanceId).not.toBe('cabinet-hang');
});
it('actual public cabinet work remains replayable after a genuine school-and-apprentice route', () => {
  let s = earnedHandoff();
  s = choose(s, 'workshop-cabinet-look');
  for (const action of [
    'workshop-cabinet-measure',
    'workshop-cabinet-hang',
    'workshop-cabinet-align',
  ]) {
    for (let n = 0; n < 100; n++) {
      const stage = s.workshop?.cabinet;
      if (!getView(s).actions.some((a) => a.id === action)) s = choose(s, 'rest');
      else s = choose(s, action);
      if (s.workshop?.cabinet !== stage) break;
      s = choose(s, s.now % 1440 >= 21 * 60 ? 'next-day' : 'rest');
    }
  }
  expect(s.workshop?.cabinet).toBe('finished');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('an elapsed earlier check offers an honest direct return to inspect it instead of endless waiting', () => {
  let s = earnedHandoff();
  const earlier = s.objects.find((o) => o.id === 'family');
  const current = s.objects.find((o) => o.id === 'personal');
  if (!earlier || !current) throw Error('Missing actual repaired objects');
  earlier.location = 'shelf';
  earlier.verified = false;
  earlier.checkStarted = s.now - 20;
  current.location = 'bench';
  current.verified = false;
  current.checkStarted = undefined;
  s.focusId = current.id;
  expect(getView(s).actions.some((a) => a.id === 'wait-check-place')).toBe(false);
  expect(getView(s).actions.some((a) => a.id === 'read-other-check')).toBe(true);
  const before = s.now;
  s = choose(s, 'read-other-check');
  expect(s.now).toBe(before);
  expect(s.focusId).toBe(earlier.id);
  expect(s.objects.find((o) => o.id === current.id)?.location).toBe('shelf');
  expect(s.objects.find((o) => o.id === earlier.id)?.verified).toBe(false);
  expect(getView(s).actions.some((a) => a.id === 'check-result')).toBe(true);
  s = choose(s, 'check-result');
  expect(s.objects.find((o) => o.id === earlier.id)?.verified).toBe(true);
});
