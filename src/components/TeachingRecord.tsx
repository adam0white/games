import { dayTime, requiredChecks } from '../game/engine';
import type { Job } from '../game/types';
import { plainText } from '../ui/plain-text';

function nextObservation(job: Job, lesson: Job['pendingLessons'][number]): string {
  if (lesson.action.startsWith('calibrate:'))
    return `Have Sam observe the requested ${requiredChecks(job).join(' or ')} use check at ${job.model.desiredRPM ?? 15} ± ${job.model.tolerance ?? 3} rpm.`;
  const baseline = lesson.baseline;
  if (baseline?.request) {
    const r = baseline.request;
    const abnormal = [
      'high-drop',
      'low-source',
      'resistance',
      'open-path',
      'slow-drive',
      'blocked-drive',
    ].includes(baseline.cues.signal ?? '');
    return `Repeat ${r.mode} from ${r.a} to ${r.b} under ${r.condition} with Sam. ${abnormal ? `A successful use check under ${r.condition} can also establish the result.` : 'The starting reading was normal. Use the same probes to compare the result.'} A failed test cannot show what this part changed. Use the same probe pair again.`;
  }
  if (baseline?.kind === 'use')
    return `Have Sam observe the same ${baseline.condition ?? 'recorded'} use condition again. Compare it with the recorded baseline; a different condition does not establish this change.`;
  return 'There is no starting measurement here. Review what Sam saw before claiming he learned a repair method.';
}
export function TeachingRecord({ job }: { job: Job }) {
  const attended = job.evidence.filter((step) => step.witnessedBy?.includes('sam'));
  const pending = job.pendingLessons.filter((lesson) => lesson.observerId === 'sam');
  return (
    <div className="teaching-surface">
      {pending.length > 0 && (
        <div className="teaching-pending">
          <strong>Sam needs to see a test</strong>
          {pending.map((lesson) => (
            <p key={lesson.demonstrationId}>
              <strong>{lesson.action.replaceAll(':', ' ').replaceAll('-', ' ')}</strong>
              <span>{nextObservation(job, lesson)}</span>
            </p>
          ))}
        </div>
      )}
      <details className="teaching-record">
        <summary>
          Sam’s observation record · {attended.length} attended steps
          {pending.length ? ` · ${pending.length} awaiting a check` : ''}
        </summary>
        <p>
          Sam learns a repair method by watching a repair step and a test that shows whether it
          worked.
        </p>
        <ol>
          {job.evidence.slice(-12).map((step) => (
            <li key={step.id}>
              <time>
                {dayTime(step.at)} · {step.kind}
              </time>
              <p>{plainText(step.summary)}</p>
              <small className="observation-label">
                {step.actorId === 'sam'
                  ? 'Sam performed this step'
                  : !step.witnessedBy?.includes('sam')
                    ? 'Sam has no recorded observation of this step'
                    : step.kind === 'work'
                      ? pending.some(
                          (lesson) => step.componentId && lesson.action.includes(step.componentId),
                        )
                        ? 'Sam watched. Let him watch a relevant test next.'
                        : 'Sam watched. Compare the later test with what he learned.'
                      : step.kind === 'use' && step.cues.signal !== 'steady-output'
                        ? 'Sam watched. This test did not show that the object worked.'
                        : 'Sam attended this observation'}
              </small>
            </li>
          ))}
        </ol>
        {!attended.length && <p>No attended step is recorded for this object yet.</p>}
        {job.ownerId === 'mum' &&
          job.status === 'delivered' &&
          !job.evidence.some((e) => e.kind === 'work' && e.witnessedBy?.includes('sam')) && (
            <p className="missed-intervention">
              Sam did not watch a repair step on this object. Watching tests alone does not teach
              him how to do that repair.
            </p>
          )}
      </details>
    </div>
  );
}
