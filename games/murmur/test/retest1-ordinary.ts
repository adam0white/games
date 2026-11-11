/** Shared test-only fixture: every say names an offered choice, quiet is explicitly intended. */
import { expect } from 'vitest';
import type * as game from '../src/sim/game.ts';
import type { GameState } from '../src/sim/types.ts';

type Api = typeof game;

export function ordinarySay(api: Api, s: GameState, option: string, insist = false) {
  expect(s.phase).toBe('day');
  expect(s.card).not.toBeNull();
  expect(
    api.cardView(s)?.options.map((o) => o.id),
    `available ${s.card?.moment}`,
  ).toContain(option);
  api.queueInput(s, { kind: 'say', option, insist });
}
export function ordinaryQuiet(api: Api, s: GameState) {
  expect(s.phase).toBe('day');
  expect(api.cardView(s)?.id).toBe(s.card?.moment);
  expect(s.card).not.toBeNull();
  api.queueInput(s, { kind: 'quiet' });
}
export function ordinaryReach(api: Api, s: GameState, id: string) {
  for (let n = 0; n < 120; n++) {
    if (s.card?.moment === id) return;
    if (s.phase === 'evening' || s.phase === 'end') api.queueInput(s, { kind: 'next' });
    else {
      api.runToCard(s);
      if (s.card?.moment === id) return;
      if (s.card) ordinaryQuiet(api, s);
      else api.step(s);
    }
  }
  throw Error(`Did not reach ${id}`);
}
export function ordinaryHeldMonday(api: Api) {
  const s = api.newGame(3);
  for (const [id, option] of [
    ['alarm-1', 'up'],
    ['note-1', 'reply'],
    ['ece-1', null], // Intentionally say nothing; no unavailable map request.
    ['lunch-1', 'outside'],
    ['slump-1', 'walk'],
  ] as const) {
    ordinaryReach(api, s, id);
    if (option === null) ordinaryQuiet(api, s);
    else ordinarySay(api, s, option, true);
  }
  return s;
}
export function ordinaryLateTuesday(api: Api, option: 'truth' | 'lie') {
  const s = api.newGame(17);
  ordinaryReach(api, s, 'alarm-1');
  ordinarySay(api, s, 'snooze');
  ordinaryReach(api, s, 'late-1');
  ordinarySay(api, s, option, true);
  ordinaryReach(api, s, 'alarm-2');
  ordinarySay(api, s, 'snooze');
  ordinaryReach(api, s, 'late-2');
  return s;
}
