import type { RepairTarget } from '../repairBindings';
export interface ScreenBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
/** A selected, visible assembly/part gets a bounded CSS-pixel touch margin. */
export function withinTouchBounds(x: number, y: number, bounds: ScreenBounds, margin = 22) {
  return (
    Number.isFinite(x + y + bounds.left + bounds.right + bounds.top + bounds.bottom) &&
    bounds.right >= bounds.left &&
    bounds.bottom >= bounds.top &&
    x >= bounds.left - margin &&
    x <= bounds.right + margin &&
    y >= bounds.top - margin &&
    y <= bounds.bottom + margin
  );
}
export function resolveTouchTarget(
  actual: RepairTarget | null,
  selected: RepairTarget | null,
  x: number,
  y: number,
  bounds: ScreenBounds | null,
): RepairTarget | null {
  if (actual) return actual;
  return selected && bounds && withinTouchBounds(x, y, bounds) ? selected : null;
}
