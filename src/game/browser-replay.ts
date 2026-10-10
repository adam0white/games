import {
  CURRENT_ENGINE,
  HISTORICAL_ENGINE_IDS,
  type HistoricalRestorer,
  restoreGame as restoreCurrent,
} from './current-engine';
import type { GameState } from './types';

const historicalEngines = new Set(HISTORICAL_ENGINE_IDS);
export class HistoricalRuntimeLoadError extends Error {
  constructor(options?: ErrorOptions) {
    super(
      'The saved-story runtime could not be loaded. Retry when the connection is available.',
      options,
    );
    this.name = 'HistoricalRuntimeLoadError';
  }
}
/** Metadata chooses code to load; the original replay validator alone accepts a story. */
export function needsHistoricalRuntime(text: string): boolean {
  if (typeof text !== 'string' || text.length > 8_000_000) throw Error('Save is too large');
  const packet = JSON.parse(text);
  return (
    historicalEngines.has(packet?.engine) ||
    (packet?.engine === CURRENT_ENGINE &&
      typeof packet?.state?.engine3Save === 'string' &&
      packet.state.engine3Save.length > 0)
  );
}
export function createBrowserReplay(
  load: () => Promise<{ restoreHistorical: HistoricalRestorer }> = () =>
    import('./historical-runtime'),
) {
  let archive: Promise<{ restoreHistorical: HistoricalRestorer }> | null = null;
  return async (text: string): Promise<GameState> => {
    if (!needsHistoricalRuntime(text)) return restoreCurrent(text);
    archive ??= load().catch((cause) => {
      archive = null;
      throw new HistoricalRuntimeLoadError({ cause });
    });
    const loaded = await archive;
    return restoreCurrent(text, loaded.restoreHistorical);
  };
}
export const restoreBrowserStory = createBrowserReplay();
