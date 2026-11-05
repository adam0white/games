/** Describe only the player's current first-order state. The host remains authoritative. */
export function tutorialPrompt(state: {
  task: { id: number; carried?: boolean; by: number; done?: number };
  minute: number;
  ordersOpen: boolean;
  selected: boolean;
  walking: boolean;
}): { target: 'orders' | 'order' | 'go' | 'travel' | 'outcome'; outcome?: 'on-time' | 'late' } {
  if (state.task.done !== undefined)
    return { target: 'outcome', outcome: state.task.done <= state.task.by ? 'on-time' : 'late' };
  if (state.walking) return { target: 'travel' };
  if (state.selected) return { target: 'go' };
  return { target: state.ordersOpen ? 'order' : 'orders' };
}
