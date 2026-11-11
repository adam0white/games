import type { RunJournalArchive } from '@adam0white/human-framework';
import {
  exportRun,
  exportRunJournal,
  readRunHistory,
  restoreRun,
  restoreRunJournal,
  step,
} from '@adam0white/human-framework';

type Slot = {
  kind: 'hf-journal-slot-v1';
  envelope: Record<string, unknown>;
  state: Record<string, unknown>;
  openingId: string;
  head: RunJournalArchive['head'];
  chunks: string[];
};
type RecordValue =
  | string
  | Slot
  | RunJournalArchive['chunks'][number]
  | RunJournalArchive['opening'];
const need = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error(`Invalid workshop journal: ${JSON.stringify(result.error)}`);
  return result.value;
};
const canonical = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  );
const isSlot = (value: RecordValue | undefined): value is Slot =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'hf-journal-slot-v1';
export function unpack(
  value: RecordValue | undefined,
  records: Map<string, RecordValue>,
): string | undefined {
  if (typeof value === 'string') return value;
  if (!isSlot(value)) return undefined;
  const chunks = value.chunks.map((id) => {
    const chunk = records.get(id);
    if (!chunk || typeof chunk === 'string' || isSlot(chunk))
      throw new Error('Missing workshop journal chunk');
    return chunk;
  });
  const restored = need(
    restoreRunJournal({ opening: records.get(value.openingId), chunks, head: value.head }),
  );
  const state = structuredClone(value.state) as { hf: { archive: unknown } };
  state.hf.archive = exportRun(restored.run);
  return JSON.stringify({ ...value.envelope, state: canonical(state) });
}
export function prepare(
  text: string,
  previous: RecordValue | undefined,
  records: Map<string, RecordValue>,
  key: string,
): { slot: RecordValue; additions: [string, RecordValue][]; removals: string[] } {
  let envelope: Record<string, unknown>, state: { hf: { archive: unknown } };
  try {
    envelope = JSON.parse(text);
    state = JSON.parse(envelope.state as string);
    if (!state?.hf?.archive)
      return {
        slot: text,
        additions: [],
        removals: isSlot(previous) ? [previous.openingId, ...previous.chunks] : [],
      };
  } catch {
    return {
      slot: text,
      additions: [],
      removals: isSlot(previous) ? [previous.openingId, ...previous.chunks] : [],
    };
  }
  const incoming = need(restoreRun(state.hf.archive));
  const native = exportRun(incoming);
  let journal: ReturnType<typeof exportRunJournal>;
  let oldIds: string[] = [];
  if (isSlot(previous)) {
    const recovered = need(
      restoreRunJournal({
        opening: records.get(previous.openingId),
        chunks: previous.chunks.map((id) => records.get(id)),
        head: previous.head,
      }),
    );
    const before = exportRun(recovered.run);
    const oldHistory = readRunHistory(before);
    const nextHistory = readRunHistory(native);
    if (
      before.hashes.initial !== native.hashes.initial ||
      oldHistory.length > nextHistory.length ||
      canonical(oldHistory) !== canonical(nextHistory.slice(0, oldHistory.length))
    ) {
      journal = exportRunJournal(incoming);
    } else {
      for (const tx of nextHistory.slice(oldHistory.length))
        need(step(recovered.run, { until: tx.until, inputs: tx.inputs, fidelity: tx.fidelity }));
      if (exportRun(recovered.run).hashes.full !== native.hashes.full)
        throw new Error('Journal continuation mismatch');
      journal = exportRunJournal(recovered.run, recovered.cursor);
      oldIds = previous.chunks;
    }
  } else journal = exportRunJournal(incoming);
  const delta = need(journal);
  const openingId = delta.opening
    ? `${key}:hf-opening:${delta.opening.digest}`
    : isSlot(previous)
      ? previous.openingId
      : undefined;
  if (!openingId) throw new Error('Missing workshop journal opening');
  const id = delta.chunk ? `${key}:hf-journal:${crypto.randomUUID()}` : undefined;
  const chunks = id ? [...oldIds, id] : oldIds;
  const host = structuredClone(state);
  delete (host.hf as { archive?: unknown }).archive;
  const rest = { ...envelope, state: null };
  return {
    slot: {
      kind: 'hf-journal-slot-v1',
      envelope: rest,
      state: host,
      openingId,
      head: structuredClone(delta.head),
      chunks,
    },
    additions: [
      ...(delta.opening
        ? [
            [openingId, structuredClone(delta.opening) as RunJournalArchive['opening']] as [
              string,
              RecordValue,
            ],
          ]
        : []),
      ...(id && delta.chunk
        ? [
            [id, structuredClone(delta.chunk) as RunJournalArchive['chunks'][number]] as [
              string,
              RecordValue,
            ],
          ]
        : []),
    ],
    removals:
      isSlot(previous) && oldIds !== previous.chunks
        ? [...previous.chunks, ...(previous.openingId === openingId ? [] : [previous.openingId])]
        : [],
  };
}
export type { RecordValue };
