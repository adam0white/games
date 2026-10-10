import type { GameView } from '../game/types';
/** Custody is a public host fact. A button's wording cannot attest handback. */
export function handedBackTitle(
  focus: GameView['focus'],
  before: { location: string; awaitingCollection?: boolean } | undefined,
  after: { location: string; awaitingCollection?: boolean } | undefined,
): string | undefined {
  return focus &&
    before &&
    after &&
    (before.location !== 'returned' || before.awaitingCollection) &&
    after.location === 'returned' &&
    !after.awaitingCollection
    ? focus.title
    : undefined;
}
/** Selecting a stored object must not reuse the preceding object's global result. */
export function selectedObjectEvidence(focus: GameView['focus']): string | null {
  return focus?.observations.at(-1) ?? null;
}
