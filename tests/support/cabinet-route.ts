import { getView, transition } from '../../src/game/engine';
import type { GameState } from '../../src/game/types';
/** Complete the current tactile cabinet using only offered inputs. */
export function finishCabinetAlignment(initial: GameState): GameState {
  let s = initial;
  for (let n = 0; n < 160 && s.workshop?.cabinet !== 'finished'; n++) {
    const ids = new Set(getView(s).actions.map((a) => a.id));
    const id =
      [
        'workshop-cabinet-check',
        'workshop-cabinet-upper',
        'workshop-cabinet-paper',
        'workshop-cabinet-try-close',
        'workshop-cabinet-align',
      ].find((candidate) => ids.has(candidate)) ??
      (s.now % 1440 >= 21 * 60 && ids.has('next-day') ? 'next-day' : 'rest');
    s = transition(s, { type: 'action', id });
  }
  if (s.workshop?.cabinet !== 'finished')
    throw Error('Could not finish the cabinet through offered actions');
  return s;
}
