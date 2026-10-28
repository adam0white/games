import { evidenceContext } from './evidence-context.ts';
import { methodEvidence, type Person } from './hf.ts';
import type { Job } from './types.ts';

/** Describe received evidence and acquired support, never the hidden physical cause.
 * Choosing help does not itself establish that a person lacks a method.
 */
export function helpFeedback(job: Job, person: Person, legalActions: string[]): string {
  const cues = evidenceContext(job, person.id);
  if (cues.stage === 'ready')
    return job.isPersonal
      ? 'I saw the required use checks pass. Your project works; we can finish this piece of work and leave it here.'
      : 'I saw the required use checks pass. The object is checked; returning it is the remaining task.';
  const actions = new Set(person.methods?.rules.map((rule) => rule.action) ?? []);
  const supported = [...actions].filter(
    (action) =>
      person.methods?.context?.id === job.id && methodEvidence(person, action, job.id).support > 0,
  );
  if (supported.length)
    return supported.some((action) => legalActions.includes(action))
      ? 'I remember a possible next step for these observations. I want to review it with you before continuing.'
      : 'I remember a possible next step, but cannot begin it with the available time or parts. We can review it together.';
  if (cues.stage === 'intake')
    return 'I have not learned where to begin checking this kind of object. Let me watch its first test.';
  if (cues.stage === 'repaired' || cues.stage?.startsWith('checked-'))
    return 'Since the last change, I have not seen it pass every test it needs. Let me watch you test it the way it will be used.';
  const revision = job.evidence.findLast((step) => step.kind === 'work')?.id ?? 0;
  const received = job.evidence.findLast(
    (step) =>
      step.id >= revision && (step.actorId === person.id || step.witnessedBy?.includes(person.id)),
  );
  return received
    ? `I saw “${received.summary.slice(0, 250)}” I have not learned a next step for these observations.`
    : 'I have not received the observations needed to choose a next step. Let me watch a relevant test.';
}
