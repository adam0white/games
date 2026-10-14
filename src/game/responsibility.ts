import {
  type Affordance,
  AGENDA_DEFAULTS,
  abandonGoal,
  adoptGoal,
  type Goal,
  onFinished,
  type Person,
} from '@adam0white/human-framework';

/** Save this handle beside the job. It links host responsibility to one native HF goal. */
export interface Responsibility {
  jobId: string;
  goalId: string;
  lastHelpEvidenceRevision?: number;
}

export const MASTERY_LABEL = 'Learn to handle a whole repair myself';
const masteryCompletion = 'mastery:independent-repair';

/** Authored personal direction, independent of whether any particular repair is accepted. */
export function adoptRepairAspiration(person: Person, now: number): void {
  if (person.id !== 'sam' || person.agenda.goals.some((goal) => goal.label === MASTERY_LABEL))
    return;
  adoptGoal(
    person,
    {
      label: MASTERY_LABEL,
      serves: ['achievement'],
      importance: 0.2,
      advancedBy: [{ action: masteryCompletion, amount: 1 }],
    },
    now,
  );
}

export function aspirationAdvances(person: Person, action: string): string[] {
  if (!['accept-repair', 'observe', 'ask-help'].includes(action)) return [];
  return person.agenda.goals
    .filter((goal) => goal.label === MASTERY_LABEL && goal.status === 'active')
    .map((goal) => goal.id);
}

/** Diagnosis, intervention and required checks by the actor are validated by the host before this call. */
export function completeRepairAspiration(
  person: Person,
  independentRepair: boolean,
  now: number,
): boolean {
  if (person.id !== 'sam' || !independentRepair) return false;
  return onFinished(person, {
    affordanceId: masteryCompletion,
    action: masteryCompletion,
    at: now,
    status: 'completed',
    advances: [],
    fulfills: [],
  }).achieved.some((goal) => goal.label === MASTERY_LABEL);
}

export const responsibilityCompletionAction = (responsibility: Responsibility) =>
  `responsibility-delivered:${encodeURIComponent(responsibility.jobId)}:${responsibility.goalId}`;

function activeGoal(person: Person, responsibility: Responsibility): Goal | undefined {
  return person.agenda.goals.find(
    (goal) => goal.id === responsibility.goalId && goal.status === 'active',
  );
}

/** Call only after the person accepts the repair offer. This does not create a delivery promise. */
export function adoptResponsibility(person: Person, jobId: string, now: number): Responsibility {
  const goal = adoptGoal(
    person,
    {
      label: `Resolve accepted repair ${jobId}`,
      serves: ['achievement'],
      importance: 0.2,
      advancedBy: [],
    },
    now,
  );
  const responsibility = { jobId, goalId: goal.id };
  // HF action matching has no target check for goals. Use a unique completion action.
  goal.advancedBy.push({ action: responsibilityCompletionAction(responsibility), amount: 1 });
  return responsibility;
}

/** Every legal repair operation receives the same purpose term; this reveals no correct repair. */
export function responsibilityAdvances(
  person: Person,
  responsibility: Responsibility | undefined,
  jobId: string,
  action: string,
): string[] {
  if (!responsibility || responsibility.jobId !== jobId || !activeGoal(person, responsibility))
    return [];
  const work = /^(inspect|measure|probe|clean|adjust|replace|calibrate|verify):/.test(action);
  return work || action === 'ask-help' || action === 'deliver' || action === 'complete-project'
    ? [responsibility.goalId]
    : [];
}

/** Override the advertised advance on every actual physical outcome to prevent progress by repetition. */
export function responsibilityOutcomeAdvances(
  person: Person,
  responsibility: Responsibility | undefined,
  jobId: string,
  action: string,
  communicatedHelp: boolean,
  receivedEvidenceRevision: number,
): string[] {
  if (
    !responsibility ||
    responsibility.jobId !== jobId ||
    action !== 'ask-help' ||
    !communicatedHelp
  )
    return [];
  const goal = activeGoal(person, responsibility);
  if (
    !goal ||
    !Number.isSafeInteger(receivedEvidenceRevision) ||
    receivedEvidenceRevision < 0 ||
    receivedEvidenceRevision <= (responsibility.lastHelpEvidenceRevision ?? -1)
  )
    return [];
  responsibility.lastHelpEvidenceRevision = receivedEvidenceRevision;
  // Asking identifies an unresolved block. It cannot finish the repair, even after many new observations.
  return goal.progress + AGENDA_DEFAULTS.defaultAdvanceAmount <= 0.2 + Number.EPSILON
    ? [goal.id]
    : [];
}

/** Only the host's validated successful delivery may finish this purpose. */
export function completeResponsibility(
  person: Person,
  responsibility: Responsibility | undefined,
  jobId: string,
  validatedDelivery: boolean,
  now: number,
): boolean {
  if (
    !responsibility ||
    responsibility.jobId !== jobId ||
    !validatedDelivery ||
    !activeGoal(person, responsibility)
  )
    return false;
  return onFinished(person, {
    affordanceId: responsibilityCompletionAction(responsibility),
    action: responsibilityCompletionAction(responsibility),
    targetId: jobId,
    at: now,
    status: 'completed',
    advances: [],
    fulfills: [],
  }).achieved.some((goal) => goal.id === responsibility.goalId);
}

export function abandonResponsibility(
  person: Person,
  responsibility: Responsibility | undefined,
): boolean {
  return responsibility ? abandonGoal(person, responsibility.goalId) : false;
}

/** Useful for adapters that construct HF affordances outside the workshop choice helper. */
export function advertiseResponsibility(
  person: Person,
  responsibility: Responsibility | undefined,
  affordance: Affordance,
): Affordance {
  return {
    ...affordance,
    advances: responsibilityAdvances(
      person,
      responsibility,
      affordance.targetId ?? '',
      affordance.action,
    ),
  };
}
