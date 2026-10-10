/** Owns finite tabletop display access and observed mechanical work. The host
 * must finish its real actor/time/attention transaction before supplying a
 * completed receipt. This module consumes no time, teaches no HF method, buys
 * no part, chooses no apprentice answer, and never opens the sealed spring. */
export type MechanicalStep =
  | 'test-mechanical-empty'
  | 'test-mechanical-loaded'
  | 'open-access'
  | 'reassemble'
  | 'clear-obstruction'
  | 'check-result';
export interface MechanicalDisplay {
  permission: boolean;
  tray: 'fitted' | 'removed';
  load: 'empty' | 'loaded';
  emptyObserved: boolean;
  loadedObserved: boolean;
  observed: 'unknown' | 'rim-obstruction' | 'missing-drive-part' | 'clear-rim';
  cleared: boolean;
  checked: boolean;
  revision: number;
  retainedPieceIds: string[];
  events: { action: MechanicalStep; actor: 'player' | 'sam'; at: number; minutes: number }[];
}
export interface MechanicalItem {
  id: string;
  appearance: 'label-stand' | 'display-carousel';
  /** Authored latent condition. Never pass this item to renderer or HF. */
  mechanicalCause: 'rim-obstruction' | 'missing-drive-part';
  mechanicalDisplay: MechanicalDisplay;
}
export interface MechanicalPresentation {
  tray: 'fitted' | 'removed';
  load: 'empty' | 'loaded';
  observed: MechanicalDisplay['observed'];
  cleared: boolean;
  motion: 'stopped' | 'checked';
}
export interface CompletedMechanicalWork {
  completed: boolean;
  objectId: string;
  action: MechanicalStep;
  actor: 'player' | 'sam';
  at: number;
  minutes: number;
  /** Host certifies actual uninterrupted attendance, never passive waiting. */
  attended: boolean;
}
export const mechanicalMinutes: Record<MechanicalStep, number> = {
  'test-mechanical-empty': 4,
  'test-mechanical-loaded': 4,
  'open-access': 3,
  reassemble: 3,
  'clear-obstruction': 6,
  'check-result': 8,
};
export function createMechanicalDisplay(permission: boolean): MechanicalDisplay {
  return {
    permission,
    tray: 'fitted',
    load: 'loaded',
    emptyObserved: false,
    loadedObserved: false,
    observed: 'unknown',
    cleared: false,
    checked: false,
    revision: 0,
    retainedPieceIds: [],
    events: [],
  };
}
export function mechanicalPresentation(
  item: Pick<MechanicalItem, 'mechanicalDisplay'>,
): MechanicalPresentation {
  const s = item.mechanicalDisplay;
  return {
    tray: s.tray,
    load: s.load,
    observed: s.observed,
    cleared: s.cleared,
    motion: s.checked && s.tray === 'fitted' && s.load === 'loaded' ? 'checked' : 'stopped',
  };
}
export function mechanicalSteps(item: MechanicalItem): MechanicalStep[] {
  const s = item.mechanicalDisplay;
  if (!s.permission) return [];
  if (s.tray === 'removed')
    return [
      ...(s.emptyObserved && s.loadedObserved && s.observed === 'rim-obstruction' && !s.cleared
        ? ['clear-obstruction' as const]
        : []),
      'reassemble',
    ];
  return [
    'test-mechanical-empty',
    'test-mechanical-loaded',
    'open-access',
    ...(s.load === 'loaded' && s.emptyObserved && s.loadedObserved
      ? ['check-result' as const]
      : []),
  ];
}
/** Changes are committed only for an actually completed supported interval.
 * Returned next is a fresh value; caller owns assigning it to its saved item. */
export function completeMechanicalWork(
  item: MechanicalItem,
  receipt: CompletedMechanicalWork,
): {
  next: MechanicalDisplay;
  lines: string[];
  verified: boolean;
  deferred: boolean;
  performed: boolean;
} {
  const unchanged = (line: string) => ({
    next: structuredClone(item.mechanicalDisplay),
    lines: [line],
    verified: false,
    deferred: false,
    performed: false,
  });
  if (!receipt.completed || !receipt.attended)
    return unchanged(
      'The mechanical work was not completed; the tray, observations and retained parts are unchanged.',
    );
  if (
    receipt.objectId !== item.id ||
    receipt.minutes !== mechanicalMinutes[receipt.action] ||
    !Number.isFinite(receipt.at)
  )
    throw Error('Mechanical receipt does not match its real work interval');
  if (!mechanicalSteps(item).includes(receipt.action))
    return unchanged(
      'This mechanical step is not available with the current permission, access and observations.',
    );
  const next = structuredClone(item.mechanicalDisplay);
  const lines: string[] = [];
  const carousel = item.appearance === 'display-carousel';
  let verified = false;
  let deferred = false;
  switch (receipt.action) {
    case 'test-mechanical-empty':
      next.load = 'empty';
      next.emptyObserved = true;
      next.checked = false;
      lines.push(
        item.mechanicalCause === 'missing-drive-part'
          ? 'You retain the same four cards beside the stand. The spring ticks and the exposed hub moves, but the empty tray does not turn with it.'
          : carousel
            ? 'You set Evan’s four parts cards beside the base in order. Without them, the tray turns past all four faces without catching.'
            : 'You retain the same four cards beside the stand. The empty tray turns freely above the rim. Compare the same tray carrying its cards before drawing a conclusion.',
      );
      break;
    case 'test-mechanical-loaded':
      next.load = 'loaded';
      next.loadedObserved = true;
      next.checked = false;
      lines.push(
        item.mechanicalCause === 'rim-obstruction' && !next.cleared
          ? carousel
            ? 'You refit the same four parts cards. Their weight seats the tray lower; one card reaches the front, the next starts to come round, and the rim catches. Another try stops at the same point.'
            : 'With the same four cards fitted, their weight seats the tray lower. It rubs at the rim and stops at the same place on each attempt.'
          : item.mechanicalCause === 'missing-drive-part'
            ? 'With the same four cards fitted, the hub still moves without engaging the tray. Removing the load made no difference; inspect the accessible connection.'
            : 'With the same four cards fitted, the tray now moves past the previously obstructed rim. A complete loaded circuit still needs attention.',
      );
      break;
    case 'open-access':
      next.tray = 'removed';
      next.checked = false;
      next.retainedPieceIds = ['display-tray'];
      if (next.emptyObserved && next.loadedObserved) {
        next.observed =
          item.mechanicalCause === 'missing-drive-part'
            ? 'missing-drive-part'
            : next.cleared
              ? 'clear-rim'
              : 'rim-obstruction';
      }
      lines.push(
        next.observed === 'rim-obstruction'
          ? 'You lift the tray beside the stand. The comparisons and exposed rim reveal folded card scrap bearing against the accessible drive.'
          : next.observed === 'missing-drive-part'
            ? 'You lift the tray beside the stand. The exposed drive seat is missing its wheel; no compatible replacement is available.'
            : 'You lift and retain the tray. The sealed spring stays closed; the comparison remains unfinished.',
      );
      break;
    case 'reassemble':
      next.tray = 'fitted';
      next.retainedPieceIds = [];
      next.checked = false;
      lines.push(
        'You refit the same tray on its spindle. Its four cards remain in their current fitted or retained position; a functional check is still required.',
      );
      break;
    case 'clear-obstruction':
      next.cleared = true;
      next.checked = false;
      next.observed = 'clear-rim';
      lines.push(
        'You remove the observed folded card scrap from the accessible rim and retain it beside the stand. The enclosed spring remains untouched.',
      );
      break;
    case 'check-result':
      verified = item.mechanicalCause === 'rim-obstruction' && next.cleared;
      next.checked = verified;
      deferred = next.observed === 'missing-drive-part';
      lines.push(
        verified
          ? carousel
            ? 'You watch all four parts cards come to the front in turn. The first comes round again without the rim catching: one complete loaded revolution, with Evan’s own cards fitted.'
            : 'You attend one complete loaded revolution. The fitted tray carries the same four cards through the full circuit.'
          : deferred
            ? 'The attended check cannot engage the missing drive wheel. Clearing cannot replace it; keep the unfinished object with permission or return it unchanged.'
            : 'The attended loaded circuit does not pass. The observed mechanical work remains unfinished.',
      );
      break;
  }
  next.revision++;
  next.events.push({
    action: receipt.action,
    actor: receipt.actor,
    at: receipt.at,
    minutes: receipt.minutes,
  });
  return { next, lines, verified, deferred, performed: true };
}
