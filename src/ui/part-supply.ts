import { PART_PRICES } from '../game/engine';
import type { ComponentKind } from '../game/types';

// Navigation to existing supplies only; does not diagnose a part, buy it, or change workshop state.
export function partSupplyTarget(kind: ComponentKind): string | undefined {
  return PART_PRICES[kind] === undefined ? undefined : `supply-${kind}`;
}
