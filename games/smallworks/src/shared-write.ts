import { canonicalCast, portableWriteBlockers } from '@adam0white/lab-client';
/** Public SDK policy only. Local saves and file play do not publish shared people. */
export function requireSharedWrite(castId: string): void {
  const blockers = portableWriteBlockers(castId, 'repair');
  if (blockers.length)
    throw new Error(
      `${canonicalCast(castId).name}: shared history is read-only until ${blockers.join(', ')} supports this person. Keep the workshop export; local play remains available.`,
    );
}
