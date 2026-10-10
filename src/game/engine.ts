/** Synchronous compatibility API. Browser gameplay imports current-engine. */
export * from './current-engine';

import { restoreGame as restoreCurrent } from './current-engine';
import { restoreHistorical } from './historical-runtime';
export function restoreGame(text: string) {
  return restoreCurrent(text, restoreHistorical);
}
export const replayPlaytest = restoreGame;
