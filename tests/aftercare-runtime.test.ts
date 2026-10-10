import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame } from '../src/game/engine';
import type { GameState } from '../src/game/types';
import { earnedHandoff } from './support/earned-handoff';
import { choose } from './support/school-route';

const has = (s: GameState, id: string) => getView(s).actions.some((a) => a.id === id);
function reach(s: GameState, id: string): GameState {
  for (let n = 0; n < 120 && !has(s, id); n++)
    s = choose(
      s,
      has(s, 'wait-appointment')
        ? 'wait-appointment'
        : has(s, 'wait-person')
          ? 'wait-person'
          : 'rest',
    );
  expect(has(s, id)).toBe(true);
  return s;
}
function talk(s: GameState, id: string, flag: string): GameState {
  for (let n = 0; n < 120 && !s.unlocked.includes(flag); n++) {
    const before = s.now;
    const next = choose(s, id);
    if (next.unlocked.includes(flag)) {
      expect(next.now - before).toBe(id.endsWith('-start') ? 2 : 3);
      return next;
    }
    expect(next.now).toBe(before);
    s = choose(next, has(next, 'wait-appointment') ? 'wait-appointment' : 'rest');
  }
  throw Error(`Unreachable conversation ${id}`);
}
it('actual cabinet aftercare starts and finishes joined talk, leaves bench controls, and replays', () => {
  let s = earnedHandoff();
  s = choose(s, 'workshop-cabinet-look');
  for (const [id, stage] of [
    ['workshop-cabinet-measure', 'measured'],
    ['workshop-cabinet-hang', 'hung'],
    ['workshop-cabinet-align', 'finished'],
  ] as const) {
    for (let n = 0; n < 120 && s.workshop?.cabinet !== stage; n++) {
      s = has(s, id) ? choose(s, id) : choose(s, 'rest');
      if (s.workshop?.cabinet !== stage) s = choose(s, 'rest');
    }
  }
  expect(s.workshop?.cabinet).toBe('finished');
  for (const id of ['service-begin', 'service-regular']) s = choose(s, id);
  s = choose(reach(s, 'service-paid-help'), 'service-paid-help');
  s = choose(reach(s, 'service-hear-leila'), 'service-hear-leila');
  s = choose(s, 'service-accept-leila');
  if (!has(s, 'delegate-repair')) s = choose(reach(s, 'arrange-learning'), 'arrange-learning');
  s = choose(s, 'delegate-repair');
  const samBefore = s.people.sam?.now;
  s = talk(s, 'aftercare-door-start', 'aftercare-cabinet-pending');
  expect(getView(s).actions.some((a) => !a.id.startsWith('aftercare-'))).toBe(true);
  s = talk(s, 'aftercare-door-question', 'aftercare-cabinet-done');
  expect(s.people.sam?.now).toBeGreaterThan(samBefore ?? Infinity);
  expect(s.objects.find((o) => o.id === 'service-leila')?.stepDecisions?.length).toBeGreaterThan(0);
  for (const id of ['dad', 'player']) {
    expect(s.people[id]?.chronicleDay?.actions.some((a) => a.action === 'talk')).toBe(true);
    expect(s.people[id]?.now).toBe(s.now);
  }
  expect(s.people.dad?.trace.some((t) => t.chosenAffordanceId === 'aftercare-door-start')).toBe(
    true,
  );
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('an earned donor reflection permits actual Evan conversation without taking another part or reward', () => {
  let s = earnedHandoff();
  for (const id of [
    'service-begin',
    'service-private',
    'service-find-model',
    'service-invite-donor',
  ])
    s = choose(s, id);
  s = choose(reach(s, 'service-hear-donor'), 'service-hear-donor');
  s = choose(s, 'service-decline-donor');
  while (!has(s, 'service-reflect')) s = choose(s, 'service-next-day');
  s = choose(s, 'service-reflect');
  const objects = structuredClone(s.objects),
    parts = structuredClone(s.parts),
    cash = s.workshop?.cash;
  s = talk(s, 'aftercare-label-start', 'aftercare-label-pending');
  const agreedAt = s.now - 2;
  expect(s.people.evan?.activity?.endsAt).toBe(agreedAt + 5);
  expect(s.people.player?.activity?.endsAt).toBe(agreedAt + 5);
  const decisions = structuredClone(s.people.evan?.trace);
  const pending = s;
  s = choose(s, 'aftercare-label-picture');
  expect(s.now).toBe(agreedAt + 5);
  expect(s.people.evan?.trace).toEqual(decisions);
  expect(s.people.evan?.activity).toBeNull();
  expect(s.people.player?.activity).toBeNull();
  let interrupted = choose(pending, 'rest');
  expect(interrupted.unlocked).toContain('aftercare-label-pending');
  expect(interrupted.people.evan?.activity?.affordanceId).not.toBe('aftercare-label-start');
  interrupted = talk(interrupted, 'aftercare-label-list', 'aftercare-label-done');
  expect(restoreGame(serializeGame(interrupted))).toEqual(interrupted);
  expect(s.objects).toEqual(objects);
  expect(s.parts).toEqual(parts);
  expect(s.workshop?.cash).toBe(cash);
  expect(s.people.evan?.trace.some((t) => t.chosenAffordanceId === 'aftercare-label-start')).toBe(
    true,
  );
  for (const person of Object.values(s.people)) expect(person.now).toBe(s.now);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('new journal lines retain their actual observation clock and survive exact replay', () => {
  let s = earnedHandoff();
  const opening = s.journal?.[0];
  expect(opening?.at).toBe(840);
  expect(opening?.timeLabel).toContain('Age 14');
  s = choose(s, 'rest');
  expect(s.journal?.at(-1)?.at).toBe(s.now);
  expect(s.journal?.at(-1)?.timeLabel).toContain('After school');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
