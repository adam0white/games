import { readDilan } from './hf4-read.ts';
import type { GameState } from './types.ts';
export interface DepartureReceipt {
  v: 1;
  boundaryDay: number;
  at: number;
  purposes: { id: string; label: string; progress: number }[];
  shelf: { status: 'active' | 'achieved' | 'abandoned'; progress: number } | null;
}
export const departureReleaseDescription = (s: GameState) =>
  readDilan(s.hf.run)
    .agenda.goals.filter((g) => g.status === 'active')
    .map((g) => g.label);
export function releaseOneCastDeparture(_s: GameState): never {
  throw new Error(
    'Use the current cast checkpoint. Keep old source notebooks; start a separate fresh story.',
  );
}
