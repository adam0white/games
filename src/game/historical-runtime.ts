/** Frozen synchronous replay graph; browser loads this on demand. */

import type { HistoricalRestorer } from './current-engine';
import { restoreGame as restoreEngine3 } from './engine3';
import { restoreGame as restoreEngine4 } from './engine4';
import { restoreGame as restoreEngine5 } from './engine5';
import { restoreGame as restoreEngine6 } from './engine6';
import { restoreGame as restoreEngine7 } from './engine7';
import { restoreGame as restoreEngine8 } from './engine8';
import { restoreGame as restoreEngine9 } from './engine9';
import { restoreGame as restoreEngine10 } from './engine10';
import { restoreGame as restoreEngine11 } from './engine11';
import { restoreGame as restoreEngine12 } from './engine12';
import { restoreGame as restoreEngine13 } from './engine13';
import { restoreGame as restoreEngine14 } from './engine14';
import { restoreGame as restoreEngine15 } from './engine15';
import { restoreGame as restoreEngine16 } from './engine16';
import { restoreGame as restoreEngine17 } from './engine17';
import { restoreGame as restoreEngine18 } from './engine18';

const runtimes: Record<string, HistoricalRestorer> = {};
runtimes['home-garage-3'] = (_engine, text) => restoreEngine3(text);
runtimes['home-garage-4'] = (_engine, text) => restoreEngine4(text);
runtimes['home-garage-5'] = (_engine, text) => restoreEngine5(text);
runtimes['home-garage-6'] = (_engine, text) => restoreEngine6(text);
runtimes['home-garage-7'] = (_engine, text) => restoreEngine7(text);
runtimes['home-garage-8'] = (_engine, text) => restoreEngine8(text);
runtimes['home-garage-9'] = (_engine, text) => restoreEngine9(text);
runtimes['home-garage-10'] = (_engine, text) => restoreEngine10(text);
runtimes['home-garage-11'] = (_engine, text) => restoreEngine11(text);
runtimes['home-garage-12'] = (_engine, text) => restoreEngine12(text);
runtimes['home-garage-13'] = (_engine, text) => restoreEngine13(text);
runtimes['home-garage-14'] = (_engine, text) => restoreEngine14(text);
runtimes['home-garage-15'] = (_engine, text) => restoreEngine15(text);
runtimes['home-garage-16'] = (_engine, text) => restoreEngine16(text);
runtimes['home-garage-17'] = (_engine, text) => restoreEngine17(text);
runtimes['home-garage-18'] = (_engine, text) => restoreEngine18(text);
export const restoreHistorical: HistoricalRestorer = (engine, text) => {
  const restore = runtimes[engine];
  if (!restore) throw Error('Unsupported historical engine');
  return restore(engine, text);
};
