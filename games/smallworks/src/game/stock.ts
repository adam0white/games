import type { ComponentKind, GameState, NpcWork } from './types.ts';

/** Recovered stock is a subset of total stock, never extra inventory. Legacy worlds keep their old pool. */
export function stockCount(s: GameState, part: ComponentKind, source: 'new' | 'recovered'): number {
  const recovered = s.busyWorkshop?.recoveredStock[part] ?? 0;
  return source === 'recovered' ? recovered : (s.stock[part] ?? 0) - recovered;
}
export function takePart(s: GameState, part: ComponentKind, source?: 'new' | 'recovered'): boolean {
  const recovered =
    Boolean(s.busyWorkshop) &&
    (source === 'recovered' || (source === undefined && stockCount(s, part, 'new') === 0));
  s.stock[part] = (s.stock[part] ?? 0) - 1;
  if (recovered && s.busyWorkshop)
    s.busyWorkshop.recoveredStock[part] = (s.busyWorkshop.recoveredStock[part] ?? 0) - 1;
  return recovered;
}
export function refundPart(s: GameState, work: NpcWork): void {
  if (!work.reservedPart) return;
  s.stock[work.reservedPart] = (s.stock[work.reservedPart] ?? 0) + 1;
  if (work.reservedRecovered && s.busyWorkshop)
    s.busyWorkshop.recoveredStock[work.reservedPart] =
      (s.busyWorkshop.recoveredStock[work.reservedPart] ?? 0) + 1;
}
