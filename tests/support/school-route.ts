import { expect } from 'vitest';
import { createGame, getView, transition } from '../../src/game/engine';
import type { GameState } from '../../src/game/types';

// A public-input traversal proves the school campaign is reachable and replayable.
// It chooses from received observations and visible offers, never latent faults.
export function choose(s: GameState, id: string): GameState {
  expect(
    getView(s).actions.some((action) => action.id === id),
    `Visible action ${id}`,
  ).toBe(true);
  return transition(s, { type: 'action', id });
}
export function opening(seed: number): GameState {
  let s = createGame(seed);
  for (const id of [
    'talk-family',
    'inspect',
    'test-battery',
    'clean-contact',
    'verify',
    'wait-check',
    'wait-check',
    'check-result',
    'return',
    'inspect',
    'shelve',
    'talk-garage',
    'search-donor',
  ])
    s = choose(s, id);
  s = transition(s, { type: 'select', id: 'personal' });
  s = choose(s, 'fit-holder');
  s = choose(s, 'verify');
  while (getView(s).actions.some((action) => action.id === 'wait-check'))
    s = choose(s, 'wait-check');
  for (const id of ['check-result', 'return', 'talk-friends']) s = choose(s, id);
  return s;
}
export function nextSchoolAction(s: GameState, eager = false): string {
  const view = getView(s);
  const offers = new Set(view.actions.map((action) => action.id));
  const catchMotion = view.focus?.observations.findLast(
    (text) => text.includes('still drags') || text.includes('pivots freely'),
  );
  if (offers.has('test-catch') && !catchMotion) return 'test-catch';
  if (catchMotion?.includes('still drags') && offers.has('lubricate-hinge'))
    return 'lubricate-hinge';
  if (catchMotion?.includes('pivots freely') && offers.has('adjust-catch')) return 'adjust-catch';
  const preferred = [
    ...(eager ? [] : ['back-to-school']),
    'return',
    'check-result',
    'verify',
    'wait-check',
    'inspect',
    'test-battery',
    'clear-obstruction',
    'align-striker',
    'search-spring',
    'replace-spring',
    'twist-cap',
  ];
  for (const id of preferred) if (offers.has(id)) return id;
  if (
    offers.has('replace-battery') &&
    view.focus?.observations.some((observation) => observation.includes('old battery is tired'))
  )
    return 'replace-battery';
  for (const id of ['clean-contact', 'accept-request', 'back-to-school', 'wait-person', 'rest'])
    if (offers.has(id)) return id;
  throw Error(`No school continuation: ${view.actions.map((action) => action.id).join(', ')}`);
}
