/** Current source publication contract. Old guest return projections are never generated. */
import type { CastKey } from '../sim/cast.ts';
import { agencyTransfer } from '../sim/cast-chapter.ts';
import type { State } from '../sim/types.ts';

export const PORTABLE_RETURN_LIMITATION =
  'Current portable history only; older Voice and Pass return formats are not produced.';

export async function nativePublicationTransfer(state: State, id: CastKey): Promise<Record<string, unknown>> {
  const transfer: Record<string, unknown> = await agencyTransfer(state, id);
  if (id === 'zeynep-pass' || id === 'selin-voice') {
    const guest = (state.guests as Array<Record<string, unknown>>).find((g) => g.id === id);
    if (guest) {
      const { person: _person, ...metadata } = guest;
      transfer.guestMetadata = metadata;
    }
    transfer.returnDisposition = 'portable-v2-only';
    transfer.currentFormatLimitations = [PORTABLE_RETURN_LIMITATION];
  }
  return transfer;
}
