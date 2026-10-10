import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import type { GameState } from '../src/game/types';

// A public-input traversal proves the school campaign is reachable and replayable.
// It chooses from received observations and visible offers, never latent faults.
function choose(s: GameState, id: string): GameState {
  expect(
    getView(s).actions.some((action) => action.id === id),
    `Visible action ${id}`,
  ).toBe(true);
  return transition(s, { type: 'action', id });
}
function opening(seed: number): GameState {
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
  for (const id of [
    'fit-holder',
    'verify',
    'wait-check',
    'wait-check',
    'check-result',
    'return',
    'talk-friends',
  ])
    s = choose(s, id);
  return s;
}
function nextSchoolAction(s: GameState, eager = false): string {
  const view = getView(s);
  const offers = new Set(view.actions.map((action) => action.id));
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
    'lubricate-hinge',
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

it('eight distinct public repairs carry people, early work and exact history through four school years', () => {
  for (const seed of [42, 1701]) {
    let s = opening(seed);
    const earlyLamp = structuredClone(s.objects.find((item) => item.id === 'family'));
    const bornAt = s.people.player?.life.bornAt;
    const samBornAt = s.people.sam?.life.bornAt;
    const jumps: number[] = [];
    for (let step = 0; step < 150 && !s.campaign?.graduated; step++) {
      expect(getView(s).actions.some((action) => action.id === 'workshop-priced')).toBe(false);
      const id = nextSchoolAction(s);
      const before = s.now;
      s = choose(s, id);
      if (id === 'back-to-school') jumps.push(s.now - before);
    }
    expect(s.campaign?.graduated).toBe(true);
    expect(jumps).toEqual([365 * 1440, 365 * 1440, 365 * 1440, 365 * 1440]);
    expect(s.people.player?.life.bornAt).toBe(bornAt);
    expect(s.people.sam?.life.bornAt).toBe(samBornAt);
    expect(Math.floor((s.now - (bornAt ?? s.now)) / (365 * 1440))).toBe(18);
    expect(Math.floor((s.now - (samBornAt ?? s.now)) / (365 * 1440))).toBe(19);
    for (const person of Object.values(s.people)) {
      expect(person.body.alive).toBe(true);
      expect(person.now).toBe(s.now);
    }
    expect(s.repairs).toBe(8);
    expect(new Set(s.objects.map((item) => item.title)).size).toBe(8);
    expect(new Set(s.objects.map((item) => item.form)).size).toBeGreaterThanOrEqual(5);
    expect(s.objects.find((item) => item.id === 'family')).toEqual(earlyLamp);
    expect(s.journal?.some((line) => line.text.includes('School'))).toBe(true);
    expect(restoreGame(serializeGame(s))).toEqual(s);
  }
});

it('an eager player cannot exhaust future school work and strand later graduation', () => {
  let s = opening(42);
  const requestsBySummer: number[] = [];
  for (let step = 0; step < 250 && !s.campaign?.graduated; step++) {
    const id = nextSchoolAction(s, true);
    if (id === 'back-to-school') {
      expect(s.objects.some((item) => item.awaitingCollection)).toBe(false);
      requestsBySummer.push(s.requests);
    }
    s = choose(s, id);
  }
  expect(s.campaign?.graduated).toBe(true);
  expect(requestsBySummer).toEqual([2, 4, 6, 8]);
  expect(s.repairs).toBe(10);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
