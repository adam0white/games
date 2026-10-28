export const LOCAL_KEY = 'small-works-cast-local-v2';
export const OUTCOME_LOCAL_KEY = 'small-works-cast-outcomes-v1';
export const SOURCE_JOURNAL_KEY = 'small-works-source-journal-v2';

const KEYS = [LOCAL_KEY, OUTCOME_LOCAL_KEY, SOURCE_JOURNAL_KEY] as const;
const DB_NAME = 'small-works-saves-hf4';
const STORE_NAME = 'saves';

function checkKey(key: string): void {
  if (!KEYS.some((known) => known === key)) throw new Error(`Unknown workshop save key: ${key}`);
}

export class WorkshopSaveStore {
  private db: IDBDatabase | undefined;
  private initialized = false;
  private initialization: Promise<void> | undefined;
  private cache = new Map<string, string>();
  private queue: Promise<void> = Promise.resolve();

  private readonly legacy: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  private readonly factory: IDBFactory | undefined;

  constructor(legacy: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, factory?: IDBFactory) {
    this.legacy = legacy;
    this.factory = factory;
  }

  initialize(): Promise<void> {
    if (!this.initialization) this.initialization = this.load();
    return this.initialization;
  }

  private async load(): Promise<void> {
    if (!this.factory) {
      this.initialized = true;
      return;
    }
    const factory = this.factory;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME))
          request.result.createObjectStore(STORE_NAME);
      };
      request.onerror = () =>
        reject(new Error('Could not open workshop save database', { cause: request.error }));
      request.onblocked = () => reject(new Error('Opening workshop save database was blocked'));
      request.onsuccess = () => resolve(request.result);
    });
    db.onversionchange = () => {
      db.close();
      this.db = undefined;
    };
    try {
      const records = await new Promise<Map<string, string>>((resolve, reject) => {
        const values = new Map<string, string>();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        for (const key of KEYS) {
          const request = store.get(key);
          request.onsuccess = () => {
            if (typeof request.result === 'string') values.set(key, request.result);
          };
        }
        transaction.oncomplete = () => resolve(values);
        transaction.onabort = transaction.onerror = () =>
          reject(new Error('Could not read workshop save database', { cause: transaction.error }));
      });
      this.cache = records;
      this.db = db;
      this.initialized = true;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  read(key: string): string | null {
    checkKey(key);
    if (this.factory && !this.initialized)
      throw new Error('Workshop save storage must be initialized before reading');
    if (!this.factory) return this.legacy.getItem(key);
    return this.cache.get(key) ?? this.legacy.getItem(key);
  }

  write(key: string, text: string): Promise<void> {
    checkKey(key);
    const operation = this.queue.then(async () => {
      await this.initialize();
      if (!this.factory) {
        this.legacy.setItem(key, text);
        this.cache.set(key, text);
        return;
      }
      const db = this.db;
      if (!db) throw new Error('Workshop save database connection is closed');
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(text, key);
        transaction.oncomplete = () => resolve();
        transaction.onabort = transaction.onerror = () =>
          reject(new Error('Could not write workshop save database', { cause: transaction.error }));
      });
      this.cache.set(key, text);
      try {
        this.legacy.removeItem(key);
      } catch {
        // The IndexedDB transaction already committed.
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}

let singleton: WorkshopSaveStore | undefined;
function getStore(): WorkshopSaveStore {
  if (!singleton) singleton = new WorkshopSaveStore(globalThis.localStorage, globalThis.indexedDB);
  return singleton;
}
export function initializeWorkshopStorage(): Promise<void> {
  return getStore().initialize();
}
export function readWorkshopSave(key: string): string | null {
  return getStore().read(key);
}
export function writeWorkshopSave(key: string, text: string): Promise<void> {
  return getStore().write(key, text);
}
