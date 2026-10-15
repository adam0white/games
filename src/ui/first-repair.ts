import { requiredChecks } from '../game/engine';
import type { GameState, MeasurementRequest } from '../game/types';

export type FirstRepairPhase =
  | 'try'
  | 'open'
  | 'measure-source'
  | 'measure-path'
  | 'inspect'
  | 'repair'
  | 'check'
  | 'return'
  | 'complete';
export interface FirstRepairProgress {
  openingJobId?: string;
  phase: FirstRepairPhase;
  workshopAvailable: boolean;
  apprenticeshipAvailable: boolean;
  suggestedPart?: string;
  suggestedPair?: MeasurementRequest;
}

/** Presentation only. No hidden condition, elapsed time or acquired person state is changed. */
export function firstRepairProgress(state: GameState): FirstRepairProgress {
  const job = state.jobs.find((j) => j.ownerId === 'mum' && j.kind === 'lantern' && !j.isDonor);
  const returns = state.jobs.filter(
    (j) => j.status === 'delivered' && !j.returnedUnfinished && !j.isPersonal && !j.isDonor,
  ).length;
  const samAlreadyInvolved = Boolean(
    state.watching ||
      state.pendingRequest ||
      state.people.sam?.methods?.rules.length ||
      state.people.sam?.agenda.commitments.some((c) => c.actions.includes('complete-lesson')) ||
      state.inputs?.some(
        (command) =>
          command.type === 'request-lesson' ||
          command.type === 'start-lesson' ||
          (command.type === 'watch' && command.enabled) ||
          (command.type === 'assign' && command.personId === 'sam'),
      ) ||
      state.jobs.some(
        (j) =>
          j.assignedTo === 'sam' ||
          j.completedBy === 'sam' ||
          j.contributions.some((c) => c.actorId === 'sam'),
      ),
  );
  const finished = !job || ['delivered', 'declined', 'salvaged'].includes(job.status);
  const progress: FirstRepairProgress = {
    openingJobId: job?.id,
    phase: 'try',
    workshopAvailable:
      finished ||
      state.day > 1 ||
      samAlreadyInvolved ||
      state.jobs.some(
        (j) => j.id !== job?.id && (j.evidence.length > 0 || j.status === 'delivered'),
      ),
    apprenticeshipAvailable: returns >= 3 || samAlreadyInvolved,
  };
  if (finished || !job) return { ...progress, phase: 'complete' };
  if (job.status === 'ready') return { ...progress, phase: 'return' };
  const lastWork = job.evidence.findLast((e) => e.kind === 'work');
  const lastUse = job.evidence.findLast((e) => e.kind === 'use');
  if (lastWork && (!lastUse || lastUse.id < lastWork.id)) return { ...progress, phase: 'check' };
  const measurements = job.evidence.filter(
    (e) =>
      e.kind === 'measurement' &&
      e.id > (lastWork?.id ?? 0) &&
      e.request &&
      !['invalid', 'power-off'].includes(e.cues.signal ?? ''),
  );
  const abnormal = measurements.findLast((e) =>
    ['high-drop', 'low-source', 'resistance', 'open-path', 'slow-drive', 'blocked-drive'].includes(
      e.cues.signal ?? '',
    ),
  );
  if (abnormal?.componentId)
    return {
      ...progress,
      phase: job.inspected.includes(abnormal.componentId) ? 'repair' : 'inspect',
      suggestedPart: abnormal.componentId,
      suggestedPair: abnormal.request,
    };
  if (!lastUse && !job.inspected.length && !measurements.length) return progress;
  const condition = requiredChecks(job)[0] ?? 'movement';
  if (
    !job.inspected.length &&
    !measurements.length &&
    !job.evidence.some((e) => e.kind === 'use' && e.condition === condition)
  )
    return progress;
  if (!job.inspected.length && !measurements.length) return { ...progress, phase: 'open' };
  const cell = job.model.components.find((c) => c.kind === 'cell');
  if (cell && !measurements.some((e) => e.componentId === cell.id))
    return {
      ...progress,
      phase: 'measure-source',
      suggestedPart: cell.id,
      suggestedPair: { mode: 'voltage', a: cell.terminals[1], b: cell.terminals[0], condition },
    };
  const nextPart = job.model.components.find(
    (c) =>
      c.kind !== 'cell' &&
      !measurements.some((e) => e.componentId === c.id && e.request?.condition === condition),
  );
  if (nextPart)
    return {
      ...progress,
      phase: 'measure-path',
      suggestedPart: nextPart.id,
      suggestedPair: {
        mode: 'voltage',
        a: nextPart.terminals[0],
        b: nextPart.terminals[1],
        condition,
      },
    };
  return { ...progress, phase: 'repair' };
}
