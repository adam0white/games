import { expect } from 'vitest';
import { exportRun, type GameState, replayRun } from '../../src/game';

/** The export survives JSON and rebuilds the same host state and HF archive. */
export function expectReplay(s: GameState): GameState {
  const exported = exportRun(s);
  const replayed = replayRun(JSON.parse(JSON.stringify(exported)));
  expect(exportRun(replayed)).toEqual(exported);
  return replayed;
}
