import type {
  DeepReadonly,
  RunJournalArchive,
  RunJournalChunk,
  RunJournalCursor,
  RunJournalHead,
  RunJournalOpening,
} from '@adam0white/human-framework';
import type { KitchenRun } from '../sim/hf4-run.ts';

type Journal = DeepReadonly<RunJournalArchive>;
type Commit<T> = {
  host: T;
  opening: DeepReadonly<RunJournalOpening>;
  chunk: DeepReadonly<RunJournalChunk> | null;
  head: DeepReadonly<RunJournalHead>;
  fresh: boolean;
};
export interface JournalStorage<T> {
  read(): Promise<{ host: T; journal: Journal } | null>;
  commit(value: Commit<T>): Promise<void>;
}

/** One transaction commits a new chunk, the head, and the matching host snapshot. */
/**
 * `retain` protects a stored save whose exact head has not been validated on this page.
 * Replacing it keeps its original head and chunks under a separate key instead of
 * deleting them. The stored original stays intact.
 */
export function indexedJournalStorage<T>(
  retain?: (host: T, lineage: string, head: DeepReadonly<RunJournalHead>) => boolean,
): JournalStorage<T> {
  let db: Promise<IDBDatabase> | undefined;
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pass-journal', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('head');
        request.result.createObjectStore('chunks', { keyPath: ['lineage', 'first'] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Saved game storage is blocked.'));
    }));
  return {
    async read() {
      const database = await open();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(['head', 'chunks'], 'readonly');
        const headRequest = tx.objectStore('head').get('current');
        let result: { host: T; journal: Journal } | null = null;
        headRequest.onsuccess = () => {
          try {
            const value = headRequest.result as Omit<Commit<T>, 'chunk'> | undefined;
            if (value === undefined) return;
            const range = IDBKeyRange.bound(
              [value.head.lineage, 0],
              [value.head.lineage, Number.MAX_SAFE_INTEGER],
            );
            const chunks = tx.objectStore('chunks').getAll(range);
            chunks.onsuccess = () => {
              result = {
                host: value.host,
                journal: { opening: value.opening, head: value.head, chunks: chunks.result },
              };
            };
          } catch {
            tx.abort();
          }
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Save read aborted.'));
      });
    },
    async commit(value) {
      const database = await open();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(['head', 'chunks'], 'readwrite');
        const heads = tx.objectStore('head');
        const chunks = tx.objectStore('chunks');
        const old = heads.get('current');
        old.onsuccess = () => {
          try {
            const previous = old.result as Omit<Commit<T>, 'chunk'> | undefined;
            const replacing = previous && (value.fresh || previous.head.lineage !== value.head.lineage);
            const keep = replacing && retain?.(previous.host as T, previous.head.lineage, previous.head);
            // A journal's lineage is its opening digest. Equal initial data can reuse it.
            // Refuse that collision rather than overwriting any retained raw chunks.
            if (previous && keep && previous.head.lineage === value.head.lineage) {
              tx.abort();
              return;
            }
            const write = () => {
              try {
                if (previous && replacing) {
                  // add, not put: an earlier archive must never be overwritten.
                  if (keep) heads.add(previous, `kept:${previous.head.lineage}`);
                  else
                    chunks.delete(
                      IDBKeyRange.bound(
                        [previous.head.lineage, 0],
                        [previous.head.lineage, Number.MAX_SAFE_INTEGER],
                      ),
                    );
                }
                if (value.fresh && previous?.head.lineage === value.head.lineage)
                  chunks.delete(
                    IDBKeyRange.bound([value.head.lineage, 0], [value.head.lineage, Number.MAX_SAFE_INTEGER]),
                  );
                if (value.chunk) chunks.put(value.chunk);
                heads.put({ host: value.host, opening: value.opening, head: value.head }, 'current');
              } catch {
                tx.abort();
              }
            };
            if (value.fresh || previous?.head.lineage !== value.head.lineage) {
              const archived = heads.getKey(`kept:${value.head.lineage}`);
              const occupied = chunks.getAllKeys(
                IDBKeyRange.bound([value.head.lineage, 0], [value.head.lineage, Number.MAX_SAFE_INTEGER]),
              );
              occupied.onsuccess = () => {
                if (
                  archived.result !== undefined ||
                  (occupied.result.length > 0 && previous?.head.lineage !== value.head.lineage)
                ) {
                  tx.abort();
                } else write();
              };
            } else write();
          } catch {
            tx.abort();
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Save write aborted.'));
      });
    },
  };
}

export class Autosave<T> {
  private run?: KitchenRun;
  private cursor?: RunJournalCursor;
  private opening?: DeepReadonly<RunJournalOpening>;
  private validatedHead?: RunJournalHead;
  private tail: Promise<void> = Promise.resolve();
  constructor(private storage: JournalStorage<T>) {}
  async read() {
    await this.tail;
    try {
      return await this.storage.read();
    } catch (error) {
      this.reset();
      throw error;
    }
  }
  reset() {
    this.run = undefined;
    this.cursor = undefined;
    this.opening = undefined;
    this.validatedHead = undefined;
  }
  matchesValidatedHead(head: DeepReadonly<RunJournalHead>): boolean {
    const known = this.validatedHead;
    return (
      !!known &&
      known.lineage === head.lineage &&
      known.digest === head.digest &&
      known.ordinal === head.ordinal &&
      known.at === head.at
    );
  }
  private rememberHead(head: DeepReadonly<RunJournalHead>) {
    this.validatedHead = {
      lineage: head.lineage,
      digest: head.digest,
      ordinal: head.ordinal,
      at: head.at,
    };
  }
  adopt(run: KitchenRun, journal: Journal, cursor: RunJournalCursor) {
    this.run = run;
    this.cursor = cursor;
    this.opening = journal.opening;
    this.rememberHead(journal.head);
  }
  write(capture: () => { run: KitchenRun; host: T } | null): Promise<boolean> {
    const result = this.tail.then(async () => {
      try {
        // Capture the host and export from the same live run without yielding.
        const value = capture();
        if (!value) return true;
        const same = value.run === this.run;
        const update = value.run.journal(same ? this.cursor : undefined);
        const opening = update.opening ?? (same ? this.opening : undefined);
        if (!opening) throw new Error('Missing journal opening.');
        await this.storage.commit({
          host: value.host,
          opening,
          chunk: update.chunk,
          head: update.head,
          fresh: !!update.opening,
        });
        this.run = value.run;
        this.cursor = update.cursor;
        this.opening = opening;
        this.rememberHead(update.head);
        return true;
      } catch {
        return false;
      }
    });
    this.tail = result.then(() => {});
    return result;
  }
}

/** Only a successfully adopted or committed exact head may be replaced without retention. */
export function indexedAutosave<T>(openable: (host: T) => boolean): Autosave<T> {
  const save: Autosave<T> = new Autosave<T>(
    indexedJournalStorage<T>((host, _lineage, head) => !openable(host) || !save.matchesValidatedHead(head)),
  );
  return save;
}
