import { getView, transition } from '../../src/game/engine';
import type { GameState } from '../../src/game/types';

/** Positive routes only: try public offers, honour actual refusals, then wait through
 * a disclosed activity or rest before asking again. Negative controls use raw input. */
export function completePublicAction(
  initial: GameState,
  id: string,
  completed: (state: GameState) => boolean,
  attempts = 80,
): GameState {
  let state = initial;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (completed(state)) return state;
    const available = getView(state).actions;
    if (available.some((action) => action.id === id)) {
      state = transition(state, { type: 'action', id });
      if (completed(state)) return state;
    }
    state = waitForPublicAttendance(state);
  }
  throw Error(
    `Public action ${id} did not complete after ${attempts} attempts; now ${state.now}: ${getView(state).note ?? ''}; focus ${JSON.stringify(getView(state).focus)}; apprentice ${JSON.stringify(getView(state).apprenticeship)}; offers ${getView(
      state,
    )
      .actions.map((a) => a.id)
      .join(',')}`,
  );
}
export function waitForPublicAttendance(state: GameState): GameState {
  const actions = getView(state).actions;
  const wait = [
    'wait-conversation-activity',
    'wait-player-activity',
    'wait-dad-activity',
    'rest',
    'wait-person',
    'wait-appointment',
  ].find((id) => actions.some((action) => action.id === id));
  if (!wait) throw Error(`No public wait available at ${state.now}`);
  return transition(state, { type: 'action', id: wait });
}
export function beginPrivateWeek(initial: GameState): GameState {
  let state = completePublicAction(
    initial,
    'service-begin',
    (s) => s.serviceWeek?.startedAt !== undefined,
  );
  state = completePublicAction(state, 'service-private', (s) => s.serviceWeek?.route === 'private');
  for (
    let day = 0;
    day < 10 && !getView(state).actions.some((a) => a.id === 'service-close-small');
    day++
  ) {
    const before = Math.floor(state.now / 1440);
    state = completePublicAction(
      state,
      'service-next-day',
      (s) => Math.floor(s.now / 1440) > before,
    );
  }
  return completePublicAction(
    state,
    'service-close-small',
    (s) => s.serviceWeek?.conclusion === 'small',
  );
}

/** Finish one offered positive command, including received physical access prerequisites.
 * A refused command consumes no game time; its next attempt follows a real public wait. */
export function positiveAction(initial: GameState, id: string): GameState {
  if (id === 'wait-check')
    return completePublicAction(
      initial,
      id,
      (state) => !getView(state).actions.some((action) => action.id === id),
    );
  let state = initial;
  for (let attempt = 0; attempt < 80; attempt++) {
    const offers = new Set(getView(state).actions.map((action) => action.id));
    if (offers.has(id)) {
      const before = state.now;
      const publicBefore = getView(state);
      const unlockedBefore = state.unlocked.length;
      const next = transition(state, { type: 'action', id });
      const publicAfter = getView(next);
      if (
        next.now > before ||
        !publicAfter.actions.some((action) => action.id === id) ||
        next.unlocked.length !== unlockedBefore ||
        JSON.stringify(publicAfter.focus) !== JSON.stringify(publicBefore.focus) ||
        JSON.stringify(publicAfter.parts) !== JSON.stringify(publicBefore.parts)
      )
        return next;
      state = waitForPublicAttendance(next);
      continue;
    }
    const prerequisite =
      offers.has('reassemble') &&
      ['verify', 'check-result', 'return', 'early-return', 'ask-mum', 'ask-dad'].includes(id)
        ? 'reassemble'
        : offers.has('open-access') &&
            [
              'test-battery',
              'clean-contact',
              'replace-battery',
              'fit-holder',
              'twist-cap',
              'align-striker',
              'path-torch-test-cap',
            ].includes(id)
          ? 'open-access'
          : undefined;
    if (prerequisite) {
      state = positiveAction(state, prerequisite);
      continue;
    }
    state = waitForPublicAttendance(state);
  }
  throw Error(
    `Positive ${id} remained refused after 80 public waits; now ${state.now}: ${getView(state).note ?? ''}; focus ${JSON.stringify(getView(state).focus)}; apprentice ${JSON.stringify(getView(state).apprenticeship)}; offers ${getView(
      state,
    )
      .actions.map((a) => a.id)
      .join(',')}`,
  );
}
