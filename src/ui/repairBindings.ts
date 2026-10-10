import type { ActionView, ObjectView } from '../game/types';

export type RepairTarget =
  | 'shell'
  | 'battery'
  | 'contact'
  | 'cap'
  | 'holder'
  | 'mechanism'
  | 'operation';
export interface RepairBinding {
  action: ActionView;
  target: RepairTarget;
  label: string;
}
const targets: Record<string, RepairTarget> = {
  inspect: 'shell',
  'test-battery': 'battery',
  'replace-battery': 'battery',
  'clean-contact': 'contact',
  'twist-cap': 'cap',
  'path-torch-test-cap': 'cap',
  'fit-holder': 'holder',
  'clear-obstruction': 'mechanism',
  'align-striker': 'mechanism',
  'lubricate-hinge': 'mechanism',
  'adjust-catch': 'mechanism',
  'test-catch': 'mechanism',
  'replace-spring': 'mechanism',
  'fit-gear': 'mechanism',
  'fit-case-catch': 'mechanism',
  'check-case-carry': 'operation',
  'check-case-tray': 'operation',
  verify: 'operation',
  'check-result': 'operation',
};
export const repairTargetLabels: Record<RepairTarget, string> = {
  shell: 'Object',
  battery: 'Battery compartment',
  contact: 'Contact',
  cap: 'Threaded cap',
  holder: 'Holder',
  mechanism: 'Mechanism',
  operation: 'Whole object',
};
/** Presentation of currently offered physical work. No prose parsing or host fault access. */
export function getMappedRepairActions(
  object: ObjectView,
  actions: readonly ActionView[],
): RepairBinding[] {
  return actions.flatMap((action) => {
    const target = targets[action.id];
    if (!target || (target !== 'shell' && !object.inspected)) return [];
    return [{ action, target, label: repairTargetLabels[target] }];
  });
}
export function pointerWasDrag(start: { x: number; y: number }, end: { x: number; y: number }) {
  return Math.hypot(end.x - start.x, end.y - start.y) >= 7;
}
export const repairToolNames: Record<string, string> = {
  inspect: 'Look',
  'test-battery': 'Test battery',
  'replace-battery': 'Fit battery',
  'clean-contact': 'Clean contact',
  'twist-cap': 'Seat cap',
  'path-torch-test-cap': 'Test cap',
  'fit-holder': 'Fit holder',
  'clear-obstruction': 'Clear jam',
  'align-striker': 'Align striker',
  'lubricate-hinge': 'Oil hinge',
  'adjust-catch': 'Align catch',
  'test-catch': 'Test catch',
  'replace-spring': 'Fit spring',
  'fit-gear': 'Fit gear',
  'fit-case-catch': 'Fit catch',
  'check-case-carry': 'Check carry',
  'check-case-tray': 'Check tray',
  verify: 'Start check',
  'check-result': 'Read check',
};
export interface RepairGesture {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
}
export function updateRepairGesture(
  prior: RepairGesture,
  id: number,
  x: number,
  y: number,
): RepairGesture {
  if (prior.id !== id) return prior;
  return {
    ...prior,
    x,
    y,
    moved: prior.moved || pointerWasDrag({ x: prior.startX, y: prior.startY }, { x, y }),
  };
}
export function repairClickAllowed(
  prior: RepairGesture | null,
  id: number,
  x: number,
  y: number,
  cancelled = false,
) {
  return Boolean(
    prior && prior.id === id && !cancelled && !updateRepairGesture(prior, id, x, y).moved,
  );
}
export function resolveRepairAction(
  bindings: readonly RepairBinding[],
  selected: string | null,
  target: RepairTarget | null,
  disabled: boolean,
): string | null {
  const binding = bindings.find((b) => b.action.id === selected);
  return !disabled &&
    target &&
    binding &&
    (binding.target === target || binding.target === 'shell' || binding.target === 'operation')
    ? binding.action.id
    : null;
}
