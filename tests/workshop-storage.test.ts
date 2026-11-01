import { IDBDatabase, IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import {
  LOCAL_KEY,
  OUTCOME_LOCAL_KEY,
  SOURCE_JOURNAL_KEY,
  WorkshopSaveStore,
} from '../src/workshop-storage';

function legacyStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe('WorkshopSaveStore', () => {
  it('persists complete large saves across store instances', async () => {
    const factory = new IDBFactory();
    const legacy = legacyStorage();
    legacy.setItem(LOCAL_KEY, 'old');
    legacy.setItem('unrelated', 'keep');
    const first = new WorkshopSaveStore(legacy, factory);
    await first.initialize();
    expect(first.read(LOCAL_KEY)).toBe('old');
    const save = 'full save data '.repeat(400_000);
    await first.write(LOCAL_KEY, save);
    const second = new WorkshopSaveStore(legacy, factory);
    await second.initialize();
    expect(second.read(LOCAL_KEY)).toBe(save);
    expect(legacy.getItem(LOCAL_KEY)).toBeNull();
    expect(legacy.getItem('unrelated')).toBe('keep');
  });

  it.each([LOCAL_KEY, OUTCOME_LOCAL_KEY, SOURCE_JOURNAL_KEY])(
    'reads another tab’s save after both stores initialize: %s',
    async (key) => {
      const factory = new IDBFactory();
      const legacy = legacyStorage();
      const first = new WorkshopSaveStore(legacy, factory);
      const other = new WorkshopSaveStore(legacy, factory);
      await Promise.all([first.initialize(), other.initialize()]);
      expect(first.read(key)).toBeNull();
      await other.write(key, 'other tab progress');
      expect(await first.readFresh(key)).toBe('other tab progress');
    },
  );

  it.each([LOCAL_KEY, OUTCOME_LOCAL_KEY, SOURCE_JOURNAL_KEY])(
    'refreshes an older cached save after another tab advances: %s',
    async (key) => {
      const factory = new IDBFactory();
      const legacy = legacyStorage();
      const first = new WorkshopSaveStore(legacy, factory);
      const other = new WorkshopSaveStore(legacy, factory);
      await other.write(key, 'older progress');
      await first.initialize();
      await other.write(key, 'latest progress');
      expect(await first.readFresh(key)).toBe('latest progress');
    },
  );

  it('removes a cached value when the database slot is deleted and retains legacy fallback', async () => {
    const factory = new IDBFactory();
    const legacy = legacyStorage();
    const store = new WorkshopSaveStore(legacy, factory);
    await store.write(OUTCOME_LOCAL_KEY, 'old progress');
    await new Promise<void>((resolve, reject) => {
      const request = factory.open('small-works-saves-hf4', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('saves', 'readwrite');
        transaction.objectStore('saves').delete(OUTCOME_LOCAL_KEY);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onabort = () => reject(transaction.error);
      };
    });
    expect(await store.readFresh(OUTCOME_LOCAL_KEY)).toBeNull();
    expect(store.read(OUTCOME_LOCAL_KEY)).toBeNull();
    legacy.setItem(OUTCOME_LOCAL_KEY, 'legacy progress');
    expect(await store.readFresh(OUTCOME_LOCAL_KEY)).toBe('legacy progress');
    expect(store.read(OUTCOME_LOCAL_KEY)).toBe('legacy progress');
  });

  it('preserves source rows appended by another tab before appending this tab’s checkpoint', async () => {
    const factory = new IDBFactory();
    const legacy = legacyStorage();
    const first = new WorkshopSaveStore(legacy, factory);
    const other = new WorkshopSaveStore(legacy, factory);
    await first.write(SOURCE_JOURNAL_KEY, JSON.stringify([{ runId: 'first' }]));
    await other.initialize();
    await other.write(SOURCE_JOURNAL_KEY, JSON.stringify([{ runId: 'first' }, { runId: 'other' }]));
    const rows = JSON.parse((await first.readFresh(SOURCE_JOURNAL_KEY)) ?? '[]');
    rows.push({ runId: 'latest checkpoint' });
    await first.write(SOURCE_JOURNAL_KEY, JSON.stringify(rows));
    expect(JSON.parse((await other.readFresh(SOURCE_JOURNAL_KEY)) ?? '[]')).toEqual([
      { runId: 'first' },
      { runId: 'other' },
      { runId: 'latest checkpoint' },
    ]);
  });

  it('orders a fresh read between writes invoked before and after it', async () => {
    const store = new WorkshopSaveStore(legacyStorage(), new IDBFactory());
    const before = store.write(LOCAL_KEY, 'before');
    const read = store.readFresh(LOCAL_KEY);
    const after = store.write(LOCAL_KEY, 'after');
    await before;
    expect(await read).toBe('before');
    await after;
    expect(await store.readFresh(LOCAL_KEY)).toBe('after');
  });

  it('rejects a failed fresh read without replacing cached or persisted progress', async () => {
    const factory = new IDBFactory();
    const legacy = legacyStorage();
    const store = new WorkshopSaveStore(legacy, factory);
    const other = new WorkshopSaveStore(legacy, factory);
    await store.write(OUTCOME_LOCAL_KEY, 'cached');
    await other.write(OUTCOME_LOCAL_KEY, 'other tab progress');
    const original = IDBDatabase.prototype.transaction;
    const transaction = vi
      .spyOn(IDBDatabase.prototype, 'transaction')
      .mockImplementationOnce(function (this: IDBDatabase, ...args) {
        const result = original.apply(this, args);
        queueMicrotask(() => result.abort());
        return result;
      });
    try {
      await expect(store.readFresh(OUTCOME_LOCAL_KEY)).rejects.toThrow('Could not read');
      expect(store.read(OUTCOME_LOCAL_KEY)).toBe('cached');
    } finally {
      transaction.mockRestore();
    }
    expect(await store.readFresh(OUTCOME_LOCAL_KEY)).toBe('other tab progress');
    await store.write(OUTCOME_LOCAL_KEY, 'continued progress');
    expect(await other.readFresh(OUTCOME_LOCAL_KEY)).toBe('continued progress');
  });

  it('reads the legacy fallback after an earlier queued write fails', async () => {
    const legacy = legacyStorage();
    legacy.setItem(LOCAL_KEY, 'good');
    const store = new WorkshopSaveStore({
      ...legacy,
      setItem() {
        throw new Error('quota exceeded');
      },
    });
    const write = store.write(LOCAL_KEY, 'replacement');
    const read = store.readFresh(LOCAL_KEY);
    await expect(write).rejects.toThrow('quota exceeded');
    expect(await read).toBe('good');
  });

  it('serializes concurrent writes in invocation order', async () => {
    const factory = new IDBFactory();
    const legacy = legacyStorage();
    const store = new WorkshopSaveStore(legacy, factory);
    await Promise.all([store.write(LOCAL_KEY, 'first'), store.write(LOCAL_KEY, 'last')]);
    const other = new WorkshopSaveStore(legacy, factory);
    await other.initialize();
    expect(other.read(LOCAL_KEY)).toBe('last');
  });

  it('preserves the previous fallback save after a quota failure and continues the queue', async () => {
    const legacy = legacyStorage();
    legacy.setItem(LOCAL_KEY, 'good');
    let fail = true;
    const store = new WorkshopSaveStore({
      ...legacy,
      setItem(key, value) {
        if (fail) throw new Error('quota exceeded');
        legacy.setItem(key, value);
      },
    });
    expect(store.read(LOCAL_KEY)).toBe('good');
    await expect(store.write(LOCAL_KEY, 'too large')).rejects.toThrow('quota exceeded');
    expect(store.read(LOCAL_KEY)).toBe('good');
    fail = false;
    await store.write(LOCAL_KEY, 'new');
    expect(store.read(LOCAL_KEY)).toBe('new');
  });

  it('rejects unknown keys and reads before IndexedDB initialization', async () => {
    const store = new WorkshopSaveStore(legacyStorage(), new IDBFactory());
    expect(() => store.read(LOCAL_KEY)).toThrow('initialized');
    expect(() => store.read('unknown')).toThrow('Unknown');
    expect(() => store.write('unknown', 'value')).toThrow('Unknown');
    expect(() => store.readFresh('unknown')).toThrow('Unknown');
    await store.initialize();
    expect(store.read(OUTCOME_LOCAL_KEY)).toBeNull();
  });

  it('rejects an IndexedDB open failure rather than falling back', async () => {
    const factory = new IDBFactory();
    factory.open = () => {
      throw new Error('open failed');
    };
    const legacy = legacyStorage();
    legacy.setItem(LOCAL_KEY, 'old');
    const store = new WorkshopSaveStore(legacy, factory);
    await expect(store.initialize()).rejects.toThrow('open failed');
    expect(() => store.read(LOCAL_KEY)).toThrow('initialized');
  });
});

it('recovers journal saves, continues after reload, and preserves the last commit on abort', async () => {
  const { createGame, dispatch, saveGame } = await import('../src/game/engine');
  const factory = new IDBFactory();
  const legacy = legacyStorage();
  const first = new WorkshopSaveStore(legacy, factory);
  const opening = createGame(42);
  const envelope = (state: typeof opening) =>
    JSON.stringify({ state: saveGame(state), started: true, continuity: {} });
  const original = envelope(opening);
  await first.write(LOCAL_KEY, original);
  const reopened = new WorkshopSaveStore(legacy, factory);
  await reopened.initialize();
  expect(reopened.read(LOCAL_KEY)).toBe(original);
  const result = dispatch(opening, { type: 'wait', minutes: 1 });
  expect(result.ok).toBe(true);
  const next = envelope(result.state);
  const originalTransaction = IDBDatabase.prototype.transaction;
  const abort = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(function (
    this: IDBDatabase,
    ...args
  ) {
    const transaction = originalTransaction.apply(this, args);
    queueMicrotask(() => transaction.abort());
    return transaction;
  });
  try {
    await expect(reopened.write(LOCAL_KEY, next)).rejects.toThrow();
  } finally {
    abort.mockRestore();
  }
  expect(reopened.read(LOCAL_KEY)).toBe(original);
  const afterFailure = new WorkshopSaveStore(legacy, factory);
  await afterFailure.initialize();
  expect(afterFailure.read(LOCAL_KEY)).toBe(original);
  await reopened.write(LOCAL_KEY, next);
  expect(await afterFailure.readFresh(LOCAL_KEY)).toBe(next);
  expect(JSON.parse(JSON.parse(next).state).hf.archive.hashes.full).toBeTruthy();
});

it('appends chunks without rewriting the opening or prior chunks and rejects incomplete journals', async () => {
  const { createGame, dispatch, saveGame } = await import('../src/game/engine');
  const factory = new IDBFactory();
  const legacy = legacyStorage();
  const store = new WorkshopSaveStore(legacy, factory);
  const envelope = (state: ReturnType<typeof createGame>) =>
    JSON.stringify({ state: saveGame(state), started: true, continuity: {} });
  const snapshot = () =>
    new Promise<Map<string, unknown>>((resolve, reject) => {
      const request = factory.open('small-works-saves-hf4', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('saves', 'readonly');
        const keys = tx.objectStore('saves').getAllKeys();
        const values = tx.objectStore('saves').getAll();
        tx.oncomplete = () => {
          db.close();
          resolve(new Map(keys.result.map((key, i) => [String(key), values.result[i]])));
        };
        tx.onabort = () => reject(tx.error);
      };
    });
  const initial = dispatch(createGame(42), { type: 'wait', minutes: 1 });
  expect(initial.ok).toBe(true);
  const opening = initial.state;
  await store.write(LOCAL_KEY, envelope(opening));
  const before = await snapshot();
  const slot = before.get(LOCAL_KEY) as { openingId: string; chunks: string[]; opening?: unknown };
  expect(slot.opening).toBeUndefined();
  expect(slot.chunks.length).toBeGreaterThan(0);
  expect(before.has(slot.openingId)).toBe(true);
  const next = dispatch(opening, { type: 'wait', minutes: 1 });
  expect(next.ok).toBe(true);
  await store.write(LOCAL_KEY, envelope(next.state));
  const after = await snapshot();
  const updated = after.get(LOCAL_KEY) as typeof slot;
  expect(updated.openingId).toBe(slot.openingId);
  expect(after.get(slot.openingId)).toEqual(before.get(slot.openingId));
  expect(updated.chunks.length).toBeGreaterThan(slot.chunks.length);
  for (const id of slot.chunks)
    expect(JSON.stringify(after.get(id))).toBe(JSON.stringify(before.get(id)));
  await new Promise<void>((resolve, reject) => {
    const request = factory.open('small-works-saves-hf4', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').delete(updated.chunks[0]!);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => reject(tx.error);
    };
  });
  const reopened = new WorkshopSaveStore(legacy, factory);
  await expect(reopened.initialize()).rejects.toThrow();
  await expect(store.write(LOCAL_KEY, envelope(next.state))).rejects.toThrow();
});
