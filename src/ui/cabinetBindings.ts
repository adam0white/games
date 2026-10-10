export type CabinetTarget = 'handle' | 'upper' | 'lower' | 'gap';
const physical: Record<string, CabinetTarget> = {
  'workshop-cabinet-try-close': 'handle',
  'workshop-cabinet-paper': 'gap',
  'workshop-cabinet-support': 'gap',
  'workshop-cabinet-upper': 'upper',
  'workshop-cabinet-lower': 'lower',
  'workshop-cabinet-check': 'handle',
};
export function cabinetTarget(id: string): CabinetTarget | undefined {
  return physical[id];
}
export function resolveCabinetAction(
  ids: readonly string[],
  selected: string | null,
  target: CabinetTarget,
  disabled = false,
): string | null {
  return !disabled && selected && ids.includes(selected) && cabinetTarget(selected) === target
    ? selected
    : null;
}
