/** A finite clearance puzzle for the existing hung kitchen doors. No actors,
 * invented parts or general woodworking simulation: the host supplies actual
 * shared attendance and retains the original finished cabinet history. */
export interface CabinetAlignment {
  position: 'original' | 'worse' | 'aligned';
  door: 'open' | 'closed' | 'caught';
  observedContact: boolean;
  observation?: 'paper' | 'supported';
  checked: boolean;
}
export const freshCabinetAlignment = (): CabinetAlignment => ({
  position: 'original',
  door: 'open',
  observedContact: false,
  checked: false,
});
export const cabinetStepMinutes = {
  'workshop-cabinet-try-close': 1,
  'workshop-cabinet-paper': 3,
  'workshop-cabinet-support': 3,
  'workshop-cabinet-upper': 4,
  'workshop-cabinet-lower': 4,
  'workshop-cabinet-check': 3,
} as const;
export type CabinetStep = keyof typeof cabinetStepMinutes;
export function cabinetSteps(a: CabinetAlignment): CabinetStep[] {
  if (a.checked) return [];
  return [
    'workshop-cabinet-try-close',
    ...(a.door === 'caught' && !a.observedContact
      ? (['workshop-cabinet-paper', 'workshop-cabinet-support'] as const)
      : []),
    ...(a.observedContact ? (['workshop-cabinet-upper', 'workshop-cabinet-lower'] as const) : []),
    ...(a.position === 'aligned' ? (['workshop-cabinet-check'] as const) : []),
  ];
}
export function applyCabinetStep(a: CabinetAlignment, id: CabinetStep): string | undefined {
  if (!cabinetSteps(a).includes(id)) return;
  if (id === 'workshop-cabinet-try-close') {
    a.door = a.position === 'aligned' ? 'closed' : 'caught';
    return a.position === 'aligned'
      ? 'The door reaches the frame without springing back. The other door still needs trying first.'
      : a.position === 'worse'
        ? 'The meeting corner catches sooner now. The gap is narrower than before.'
        : 'The right door reaches the last inch, catches at the meeting edge and springs slightly open.';
  }
  if (id === 'workshop-cabinet-paper' || id === 'workshop-cabinet-support') {
    a.observedContact = true;
    a.observation = id === 'workshop-cabinet-paper' ? 'paper' : 'supported';
    return a.observation === 'paper'
      ? 'The narrow strip of measurement paper slides freely along the bottom edge, but catches at the upper meeting corner. You keep that observation beside the hinge marks.'
      : 'Dad gently supports the attached door while you sight along the gap. The upper meeting corner clears as the top moves away from the other door. You record what changed.';
  }
  if (id === 'workshop-cabinet-check') {
    a.door = 'closed';
    a.checked = true;
    return 'You open both doors and close them in the opposite order. Neither catches; the meeting gap stays even. The bowl can go back inside.';
  }
  a.position =
    id === 'workshop-cabinet-upper'
      ? a.position === 'worse'
        ? 'original'
        : 'aligned'
      : a.position === 'aligned'
        ? 'original'
        : 'worse';
  a.door = 'open';
  return a.position === 'aligned'
    ? 'Dad supports the door while you reposition the upper hinge to the next pencil mark and secure its existing screws. The upper meeting gap opens slightly.'
    : 'Dad supports the door while you reposition the hinge and secure its existing screws. The upper meeting gap narrows. The first pencil mark is still there if you want to undo it.';
}
export interface CabinetAlignmentView extends CabinetAlignment {
  sessionActive: boolean;
  actionIds: string[];
  detail: string;
}
