import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { LOCAL_KEY, OUTCOME_LOCAL_KEY, WorkshopSaveStore } from '../src/workshop-storage';

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
