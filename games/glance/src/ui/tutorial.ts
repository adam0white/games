export type TutorialPhase = 'read' | 'waiting-read' | 'gate' | 'waiting-gate' | 'waiting-report' | 'answered';
export function tutorialCue(state: { phase: TutorialPhase; gateOpen: boolean }) {
  if (state.gateOpen && (state.phase === 'read' || state.phase === 'waiting-read')) return 'gate-choice';
  switch (state.phase) {
    case 'read':
      return 'read';
    case 'waiting-read':
    case 'waiting-gate':
    case 'waiting-report':
      return 'radio';
    case 'gate':
      return state.gateOpen ? 'gate-choice' : 'gate';
    case 'answered':
      return 'answer';
  }
}
