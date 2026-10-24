import { dispatch } from '../game/engine';
import type { GameState } from '../game/types';

/** Lifecycle actions are ordinary recorded commands, so exports still replay exactly. */
export function pauseForDeparture(state: GameState): GameState {
  return state.chapterPaused ? state : dispatch(state, { type: 'pause-chapter' }).state;
}
export function resumeForPlay(state: GameState): GameState {
  return state.chapterPaused ? dispatch(state, { type: 'resume-chapter' }).state : state;
}
