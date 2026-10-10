import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame } from '../src/game/engine';
import type { GameState } from '../src/game/types';
import { earnedHandoff } from './support/earned-handoff';
import { positiveAction as choose } from './support/public-attendance';

const has = (s: GameState, id: string) => getView(s).actions.some((a) => a.id === id);
function reach(s: GameState, id: string): GameState {
  for (let n = 0; n < 160 && !has(s, id); n++)
    s = choose(
      s,
      has(s, 'wait-appointment')
        ? 'wait-appointment'
        : has(s, 'wait-person')
          ? 'wait-person'
          : 'rest',
    );
  expect(
    has(s, id),
    `${id}: ${getView(s)
      .actions.map((a) => a.id)
      .join(',')}`,
  ).toBe(true);
  return s;
}
function repair(s: GameState, suffix: string): GameState {
  for (const id of [
    `workshop-quote-${suffix}`,
    `workshop-accept-${suffix}`,
    'inspect',
    'test-battery',
  ])
    s = choose(s, id);
  s = choose(
    s,
    getView(s).focus?.observations.some((x) => x.includes('old battery is tired'))
      ? 'replace-battery'
      : 'clean-contact',
  );
  s = choose(s, 'verify');
  for (let waits = 0; waits < 80 && has(s, 'wait-check'); waits++) s = choose(s, 'wait-check');
  s = choose(s, 'check-result');
  s = choose(reach(s, 'return'), 'return');
  return s;
}
it('keeps the model-specific donor gear out of Evan’s unsupported winding timer', () => {
  let s = earnedHandoff(true);
  for (const id of [
    'service-begin',
    'service-private',
    'service-find-model',
    'service-invite-donor',
  ])
    s = choose(s, id);
  s = choose(reach(s, 'service-hear-donor'), 'service-hear-donor');
  for (const id of ['service-measure-donor', 'service-recover-donor']) s = choose(s, id);
  expect(s.parts.gears).toBe(1);
  s = choose(reach(s, 'workshop-referral-ask'), 'workshop-referral-ask');
  s = choose(s, 'workshop-favours');
  s = choose(reach(s, 'workshop-intake-space'), 'workshop-intake-space');
  s = choose(reach(s, 'workshop-leila-arrival'), 'workshop-leila-arrival');
  s = repair(s, 'leila');
  s = choose(reach(s, 'workshop-nora-arrival'), 'workshop-nora-arrival');
  s = repair(s, 'nora');
  s = choose(reach(s, 'workshop-next-batch'), 'workshop-next-batch');
  s = choose(s, 'workshop-next-referral-yes');
  s = choose(reach(s, 'workshop-evan-arrival'), 'workshop-evan-arrival');
  s = repair(s, 'evan');
  s = choose(reach(s, 'workshop-evan-timer-arrival'), 'workshop-evan-timer-arrival');
  for (const id of ['workshop-quote-evan-timer', 'workshop-accept-evan-timer', 'inspect'])
    s = choose(s, id);
  expect(getView(s).focus?.observations.join(' ')).toContain(
    'None of the parts in this tray match it',
  );
  expect(restoreGame(serializeGame(s))).toEqual(s);
  expect(has(s, 'fit-gear')).toBe(false);
}, 20_000);
