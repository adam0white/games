import { dayTime } from '../game/engine';
import type { Job } from '../game/types';

export function TeachingRecord({ job }: { job: Job }) {
  const attended = job.evidence.filter((step) => step.witnessedBy?.includes('sam'));
  const pending = job.pendingLessons.filter((lesson) => lesson.observerId === 'sam');
  return (
    <details className="teaching-record">
      <summary>
        Sam’s observation record · {attended.length} attended steps
        {pending.length ? ` · ${pending.length} awaiting a check` : ''}
      </summary>
      <p>
        Attending a step records an observation. A repair intervention needs an observed outcome
        check before it can become a retained repair method.
      </p>
      {pending.length > 0 && (
        <div className="teaching-pending">
          <strong>Outcome evidence still needed</strong>
          {pending.map((lesson) => (
            <p key={lesson.demonstrationId}>
              {lesson.action.replaceAll(':', ' ').replaceAll('-', ' ')} · run and observe the
              relevant use check with Sam.
            </p>
          ))}
        </div>
      )}
      <ol>
        {job.evidence.slice(-12).map((step) => (
          <li key={step.id}>
            <time>
              {dayTime(step.at)} · {step.kind}
            </time>
            <p>{step.summary}</p>
            <small className="observation-label">
              {step.actorId === 'sam'
                ? 'Sam performed this step'
                : !step.witnessedBy?.includes('sam')
                  ? 'Sam has no recorded observation of this step'
                  : step.kind === 'work'
                    ? pending.some(
                        (lesson) => step.componentId && lesson.action.includes(step.componentId),
                      )
                      ? 'Sam attended · awaiting a relevant observed outcome check'
                      : 'Sam attended · compare the subsequent check and retained methods'
                    : step.kind === 'use' && step.cues.signal !== 'steady-output'
                      ? 'Sam attended · this check did not demonstrate successful use'
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
            Sam did not observe a repair intervention on this object. Watching tests alone does not
            teach that intervention.
          </p>
        )}
    </details>
  );
}
