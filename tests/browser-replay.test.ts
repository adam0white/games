import { expect, it } from 'vitest';
import {
  createBrowserReplay,
  HistoricalRuntimeLoadError,
  needsHistoricalRuntime,
} from '../src/game/browser-replay';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as engine3 from '../src/game/engine3';
import * as engine4 from '../src/game/engine4';
import * as engine5 from '../src/game/engine5';
import * as engine6 from '../src/game/engine6';
import * as engine7 from '../src/game/engine7';
import * as engine8 from '../src/game/engine8';
import * as engine9 from '../src/game/engine9';
import * as engine10 from '../src/game/engine10';
import * as engine11 from '../src/game/engine11';
import * as engine12 from '../src/game/engine12';
import * as engine13 from '../src/game/engine13';
import * as engine14 from '../src/game/engine14';
import * as engine15 from '../src/game/engine15';
import * as engine16 from '../src/game/engine16';
import * as engine17 from '../src/game/engine17';
import * as engine18 from '../src/game/engine18';
import { createGame as oldGame, serializeGame as oldSerialize } from '../src/game/engine18';
import { restoreHistorical } from '../src/game/historical-runtime';
import * as legacy from '../src/game/legacy-engine';

it('restores native stories without loading any archive', async () => {
  let calls = 0;
  const replay = createBrowserReplay(async () => {
    calls++;
    return { restoreHistorical };
  });
  const raw = serializeGame(createGame());
  expect(needsHistoricalRuntime(raw)).toBe(false);
  expect(serializeGame(await replay(raw))).toBe(raw);
  expect(calls).toBe(0);
});
it('historical and nested migrated stories match synchronous restoration exactly', async () => {
  let calls = 0;
  const replay = createBrowserReplay(async () => {
    calls++;
    return { restoreHistorical };
  });
  const old = oldSerialize(oldGame());
  const migrated = await replay(old);
  expect(serializeGame(migrated)).toBe(serializeGame(restoreGame(old)));
  const action = getView(migrated).actions[0];
  if (!action) throw Error('Missing continued choice');
  const continued = serializeGame(transition(migrated, { type: 'action', id: action.id }));
  expect(needsHistoricalRuntime(continued)).toBe(true);
  expect(serializeGame(await replay(continued))).toBe(serializeGame(restoreGame(continued)));
  expect(calls).toBe(1);
});
it('network failure preserves caller state and permits retry', async () => {
  let attempts = 0;
  const replay = createBrowserReplay(async () => {
    if (++attempts === 1) throw Error('offline');
    return { restoreHistorical };
  });
  const raw = oldSerialize(oldGame());
  const baseline = serializeGame(createGame());
  await expect(replay(raw)).rejects.toBeInstanceOf(HistoricalRuntimeLoadError);
  expect(serializeGame(await replay(raw))).toBe(serializeGame(restoreGame(raw)));
  expect(attempts).toBe(2);
  expect(serializeGame(createGame())).toBe(baseline);
});
it('rejects tampering, oversized sources and unsupported packets through unchanged validation', async () => {
  const replay = createBrowserReplay(async () => ({ restoreHistorical }));
  const data = JSON.parse(serializeGame(createGame()));
  data.state.now++;
  const malformed = JSON.stringify(data);
  expect(() => restoreGame(malformed)).toThrow('Save does not match its history');
  await expect(replay(malformed)).rejects.toThrow('Save does not match its history');
  await expect(replay('x'.repeat(8_000_001))).rejects.toThrow('Save is too large');
  await expect(replay('{"engine":"unsupported"}')).rejects.toThrow('Unsupported save');
});

it('all supported historical native packets retain archive identity and async-sync migration parity', async () => {
  const replay = createBrowserReplay(async () => ({ restoreHistorical }));
  for (const module of [
    engine3,
    engine4,
    engine5,
    engine6,
    engine7,
    engine8,
    engine9,
    engine10,
    engine11,
    engine12,
    engine13,
    engine14,
    engine15,
    engine16,
    engine17,
    engine18,
  ]) {
    const original = module.serializeGame(module.createGame());
    expect(module.serializeGame(module.restoreGame(original))).toBe(original);
    expect(serializeGame(await replay(original))).toBe(serializeGame(restoreGame(original)));
  }
});

it('legacy engine-two packets retain exact native identity and async migration parity', async () => {
  const raw = legacy.serializeGame(legacy.createGame());
  expect(legacy.serializeGame(legacy.restoreGame(raw))).toBe(raw);
  const replay = createBrowserReplay(async () => ({ restoreHistorical }));
  expect(serializeGame(await replay(raw))).toBe(serializeGame(restoreGame(raw)));
});
