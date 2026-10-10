import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as seventeen from '../src/game/engine17';
import type { GameInput } from '../src/game/types';
import route from './fixtures/wildcard-seventeen-route.json';

it('preserves the actual native17 wildcard route and distinguishes planning from completed cabinet work in current projection', () => {
  let old = seventeen.createGame(route.seed);
  for (const entry of route.inputs) {
    expect(old.now).toBe(entry.at);
    old = seventeen.transition(old, entry.input as GameInput);
    if (entry.input.id === 'workshop-cabinet-plan') {
      const current = restoreGame(seventeen.serializeGame(old));
      expect(current.workshop?.cabinet).toBe('looked');
      expect(current.workshop?.cabinetAppointment?.status).toBe('planned');
      const dad = getView(current).whereabouts?.find((person) => person.id === 'dad');
      expect(dad?.activity).not.toBe('Finished the cabinet step with you');
      expect(dad?.activity).toBe('Finished agreeing a cabinet time with you');
    }
  }
  const raw = seventeen.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(route.sha256);
  expect(seventeen.serializeGame(seventeen.restoreGame(raw))).toBe(raw);
  const current = restoreGame(raw);
  expect(current.engine3Save).toBe(raw);
  expect(current.inputs).toEqual(old.inputs);
  expect(current.journal).toEqual(old.journal);
});

// Actual candidate18 UI export /tmp/repair-wildcard-v3-story.json, native17
// source SHA256: 75ca158059564b12da88b21019e9cc2277e77b1d26792209d45a14ed3b4d7619.
// The prefix is followed by recorded choices; no private actor dump is embedded.
it('the actual wildcard cabinet route keeps hung doors in place and promotes the current agreed window over Evan’s later visit', () => {
  let old = seventeen.createGame(route.seed);
  for (const entry of route.inputs) old = seventeen.transition(old, entry.input as GameInput);
  let s = restoreGame(seventeen.serializeGame(old));
  const continuation: GameInput[] = [
    { type: 'select', id: 'paper-street' },
    ...[
      'inspect',
      'service-invite-donor',
      'childhood-rebuild-frontage',
      'childhood-make-label',
      'rest',
      'wait-appointment',
    ].map((id): GameInput => ({ type: 'action', id })),
  ];
  for (const input of continuation) s = transition(s, input);
  expect(s.now).toBe(2385);
  expect(s.workshop?.cabinet).toBe('looked');
  expect(s.workshop?.cabinetAppointment?.status).toBe('planned');
  const view = getView(s);
  expect(view.actions.some((action) => action.id === 'workshop-cabinet-measure')).toBe(true);
  expect(view.dayPlan?.entries[0]?.id).toBe('known-dad-2385');
  expect(view.dayPlan?.entries[0]?.detail).toContain('open now');
  expect(view.dayPlan?.entries[0]?.actionIds).toContain('workshop-cabinet-measure');
  expect(view.dayPlan?.entries.some((entry) => entry.label.includes('Evan'))).toBe(true);
  for (const id of ['workshop-cabinet-measure', 'workshop-cabinet-hang'])
    s = transition(s, { type: 'action', id });
  expect(s.now).toBe(2445);
  expect(s.workshop?.cabinet).toBe('hung');
  s = transition(s, { type: 'action', id: 'workshop-cabinet-close' });
  expect(s.workshop?.cabinet).toBe('hung');
  expect(s.workshop?.projectOpen).toBe(false);
  expect(s.journal?.at(-1)?.text).toContain('stay hung on the kitchen cabinet');
  expect(s.journal?.at(-1)?.text).not.toContain('against the wall');
  s = transition(s, { type: 'action', id: 'workshop-cabinet-open' });
  expect(s.workshop?.cabinet).toBe('hung');
  expect(s.journal?.at(-1)?.text).toContain('remain hung on the kitchen cabinet');
  expect(s.journal?.at(-1)?.text).toContain('alignment is still unfinished');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
