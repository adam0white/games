import { dayTime, PART_PRICES } from '../game/engine';
import type { ComponentKind, GameState } from '../game/types';

// Navigation to existing supplies only; does not diagnose a part, buy it, or change workshop state.
export function partSupplyTarget(kind: ComponentKind): string | undefined {
  return PART_PRICES[kind] === undefined ? undefined : `supply-${kind}`;
}

// Existing supplier terms, beside the selected empty drawer. Navigation still performs no purchase.
export function partSupplyDetail(state: GameState, kind: ComponentKind): string | undefined {
  const price = PART_PRICES[kind];
  if (price === undefined) return undefined;
  const name = kind[0]?.toUpperCase() + kind.slice(1);
  const terms = `${name} · Supplier · £${price} · 20 min supplier trip.`;
  return kind === 'switch' && state.busyWorkshop && state.now < state.busyWorkshop.restockAt
    ? `${terms} No supplier stock until ${dayTime(state.busyWorkshop.restockAt)}. You can recover one from the spare lantern or return work unfinished.`
    : terms;
}
