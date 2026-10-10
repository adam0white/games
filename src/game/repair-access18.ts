/** Saved physical access for fictional low-voltage lamps, torches and bells.
 * This host module owns covers, retained pieces and performed-work markers;
 * it teaches no method and grants no repair, part, skill or independent credit.
 * Older abstract objects adopt these rules only on a new actual inspection.
 * Timers, boxes, clips and sealed spring housings remain outside this slice. */
import type { RepairObject } from './types18';
export type AccessKind = 'lamp' | 'torch' | 'bell';
export interface RepairAccess {
  kind: AccessKind;
  state: 'assembled' | 'open';
  revision: number;
  retainedPieceIds: string[];
  workMarkers: string[];
  events: {
    at: number;
    actor: 'player' | 'sam';
    action: 'open-access' | 'reassemble' | 'temporary-refit' | 'temporary-remove';
    minutes: number;
    triggeredBy: string;
  }[];
}
const pieces: Record<AccessKind, string> = {
  lamp: 'lamp-base-cover',
  torch: 'torch-cap',
  bell: 'bell-dome',
};
export const ACCESS_MINUTES = 3;
export function accessKind(item: Pick<RepairObject, 'form'>): AccessKind | undefined {
  return ['lamp', 'torch', 'bell'].includes(item.form) ? (item.form as AccessKind) : undefined;
}
export function accessLabel(item: Pick<RepairObject, 'form'>): string {
  return item.form === 'torch' ? 'threaded cap' : item.form === 'bell' ? 'bell dome' : 'base cover';
}
export function isInternalStep(step: string): boolean {
  return [
    'test-battery',
    'clean-contact',
    'replace-battery',
    'fit-holder',
    'twist-cap',
    'align-striker',
    'path-torch-test-cap',
  ].includes(step);
}
export function requiresAssembled(step: string): boolean {
  return [
    'verify',
    'check-result',
    'return',
    'early-return',
    'return-unchecked',
    'ask-mum',
    'ask-dad',
  ].includes(step);
}
export function canPerformAccessStep(item: RepairObject, step: string): boolean {
  if (!item.access) return true;
  return isInternalStep(step)
    ? item.access.state === 'open'
    : requiresAssembled(step)
      ? item.access.state === 'assembled'
      : true;
}
export function assertAccessStep(item: RepairObject, step: string): void {
  if (!canPerformAccessStep(item, step))
    throw Error(
      isInternalStep(step)
        ? 'Open the named access before internal work'
        : 'Reassemble the object before functional checking or return',
    );
}
export function openAccess(
  item: RepairObject,
  actor: 'player' | 'sam',
  at: number,
  triggeredBy = 'open-access',
  minutes = ACCESS_MINUTES,
): string {
  const kind = accessKind(item);
  if (!kind) throw Error('This object has no supported removable access');
  item.access ??= {
    kind,
    state: 'assembled',
    revision: 0,
    retainedPieceIds: [],
    workMarkers: [],
    events: [],
  };
  if (item.access.state === 'open')
    return `The ${accessLabel(item)} is already open; its retained piece remains beside the object.`;
  item.access.state = 'open';
  item.access.revision++;
  item.access.retainedPieceIds = [pieces[kind]];
  item.access.events.push({ at, actor, action: 'open-access', minutes, triggeredBy });
  delete item.checkStarted;
  item.verified = false;
  item.evidence = item.evidence?.filter(
    (cue) => !['checked', 'check-running', 'check-ready'].includes(cue),
  );
  return `You open the ${accessLabel(item)} and keep it beside the object. Any earlier functional check is cancelled; the repair and parts remain unchanged.`;
}
export function reassemble(
  item: RepairObject,
  actor: 'player' | 'sam',
  at: number,
  triggeredBy = 'reassemble',
): string {
  if (item.access?.state !== 'open') throw Error('There is no open access to reassemble');
  item.access.state = 'assembled';
  item.access.revision++;
  item.access.retainedPieceIds = [];
  item.access.events.push({
    at,
    actor,
    action: 'reassemble',
    minutes: ACCESS_MINUTES,
    triggeredBy,
  });
  return item.repaired
    ? `You refit the retained ${accessLabel(item)}. The repaired object is ready for an ordinary-use check; refitting alone does not verify it.`
    : `You refit the retained ${accessLabel(item)}. The fault remains; closing alone has not repaired or verified the object.`;
}
export function markPerformedWork(item: RepairObject, step: string): void {
  if (item.access && !item.access.workMarkers.includes(step)) item.access.workMarkers.push(step);
}
/** A required host preparation belongs to the selected semantic action; it
 * does not enter HF's conditional-method vocabulary or prove learned access. */
export function hostPreparation(
  item: RepairObject,
  step: string,
): 'open-access' | 'reassemble' | undefined {
  if (!item.access) return undefined;
  if (isInternalStep(step) && item.access.state === 'assembled') return 'open-access';
  if (requiresAssembled(step) && item.access.state === 'open') return 'reassemble';
  return undefined;
}
export function assemblyView(item: RepairObject) {
  if (!item.access) {
    if (item.inspected) return undefined;
    const kind = accessKind(item);
    return kind
      ? { kind, state: 'assembled' as const, revision: 0, retainedPieceIds: [], workMarkers: [] }
      : undefined;
  }
  const { kind, state, revision, retainedPieceIds, workMarkers } = item.access;
  return {
    kind,
    state,
    revision,
    retainedPieceIds: [...retainedPieceIds],
    workMarkers: [...workMarkers],
  };
}

/** A disconnected torch is tested only through a real temporary fit. Its cap
 * is removed again afterward; this neither restores the fault nor verifies use. */
export function temporaryTorchTest(
  item: RepairObject,
  actor: 'player' | 'sam',
  at: number,
  step: string,
  perform: () => string,
): string {
  if (item.form !== 'torch' || item.access?.state !== 'open') return perform();
  const access = item.access;
  access.state = 'assembled';
  access.revision++;
  access.retainedPieceIds = [];
  access.events.push({
    at: at - 7,
    actor,
    action: 'temporary-refit',
    minutes: ACCESS_MINUTES,
    triggeredBy: step,
  });
  let observation: string;
  try {
    observation = perform();
  } finally {
    access.state = 'open';
    access.revision++;
    access.retainedPieceIds = ['torch-cap'];
    access.events.push({
      at,
      actor,
      action: 'temporary-remove',
      minutes: ACCESS_MINUTES,
      triggeredBy: step,
    });
  }
  return `You temporarily refit the retained cap for the four-minute diagnostic test. ${observation} You remove the cap again and keep it beside the torch; the temporary fit has not repaired the fault or verified ordinary use.`;
}
export function physicalStepDuration(
  item: RepairObject,
  step: string,
  semanticMinutes: number,
): number {
  return item.form === 'torch' &&
    item.access?.state === 'open' &&
    ['test-battery', 'path-torch-test-cap'].includes(step)
    ? semanticMinutes + ACCESS_MINUTES * 2
    : semanticMinutes;
}
