import type { ValleyState } from '../sim/valley.ts';

/** The public record owns the outcome; retained speech and latest replies may differ. */
export function morningResult(state: Pick<ValleyState, 'minute' | 'notes'>, ask: string | undefined) {
  if (!ask) return undefined;
  const note = state.notes.findLast(
    (item) => item.kind === 'reply' && item.ask === ask && item.at <= state.minute,
  );
  return note ? { id: note.id, at: note.at, text: note.text } : undefined;
}
