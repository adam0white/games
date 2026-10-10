import type { GameView } from '../game/types';
export type GateWalkView = NonNullable<GameView['gateWalk']>;
export type GateTarget = 'loop' | 'latch' | 'gate' | 'path';
export function gateTarget(id: string): GateTarget | null {
  switch (id) {
    case 'gate-walk-hang':
      return 'loop';
    case 'gate-walk-hold-light':
      return 'latch';
    case 'gate-walk-hold-gate':
      return 'gate';
    case 'gate-walk-sam-first':
      return 'path';
    default:
      return null;
  }
}
export function gateAction(view: GateWalkView, id: string, disabled: boolean): string | null {
  if (
    disabled ||
    view.stage !== 'gate' ||
    !view.samWithPlayer ||
    !view.actionIds.includes(id) ||
    !gateTarget(id)
  )
    return null;
  const torch = id === 'gate-walk-hang' || id === 'gate-walk-hold-light';
  return torch === (view.light === 'sam-torch' && Boolean(view.torchObject)) ? id : null;
}
export function gatePose(view: Pick<GateWalkView, 'handling'>): number {
  return view.handling === 'hanging'
    ? 0.25
    : view.handling === 'held'
      ? 0.85
      : view.handling === 'gate-held'
        ? 1.05
        : view.handling === 'sam-first'
          ? 0.8
          : 0;
}
