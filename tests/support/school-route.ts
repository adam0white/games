import { expect } from 'vitest';
import { createGame, getView, transition } from '../../src/game/engine';
import type { GameState } from '../../src/game/types';
import { positiveAction } from './public-attendance';

// A public-input traversal proves the school campaign is reachable and replayable.
// It chooses from received observations and visible offers, never latent faults.
export function choose(s: GameState, id: string): GameState {
  // This shared traversal performs visible physical prerequisites. Boundary
  // tests use raw transition/getView to prove they cannot be skipped.
  const before = getView(s);
  if (
    !before.actions.some((action) => action.id === id) &&
    before.actions.some((action) => action.id === 'reassemble') &&
    ['verify', 'check-result', 'return', 'early-return', 'ask-mum', 'ask-dad'].includes(id)
  )
    s = transition(s, { type: 'action', id: 'reassemble' });
  if (
    !getView(s).actions.some((action) => action.id === id) &&
    getView(s).actions.some((action) => action.id === 'open-access') &&
    [
      'test-battery',
      'clean-contact',
      'replace-battery',
      'fit-holder',
      'twist-cap',
      'align-striker',
      'path-torch-test-cap',
    ].includes(id)
  )
    s = transition(s, { type: 'action', id: 'open-access' });
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
    s = positiveAction(s, id);
  s = transition(s, { type: 'select', id: 'personal' });
  s = positiveAction(s, 'fit-holder');
  s = positiveAction(s, 'verify');
  for (let n = 0; n < 20 && getView(s).actions.some((action) => action.id === 'wait-check'); n++)
    s = positiveAction(s, 'wait-check');
  for (const id of ['check-result', 'return', 'talk-friends']) s = positiveAction(s, id);
  return s;
}
export function nextSchoolAction(s: GameState, eager = false): string {
  const view = getView(s);
  const offers = new Set(view.actions.map((action) => action.id));
  for (const id of ['wait-conversation-activity', 'wait-player-activity', 'wait-dad-activity'])
    if (offers.has(id)) return id;
  if (offers.has('reassemble') && view.focus?.progress === 'repaired') return 'reassemble';
  if (offers.has('open-access') && view.focus?.progress === 'inspected') return 'open-access';
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
