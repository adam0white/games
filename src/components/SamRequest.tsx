import { dayRemaining, dayTime } from '../game/engine';
import type { Command, GameState } from '../game/types';

export function SamRequest({
  state,
  act,
  compact = false,
}: {
  state: GameState;
  act: (command: Command) => void;
  compact?: boolean;
}) {
  const request = state.pendingRequest;
  if (!request) return null;
  const current = state.npcWork.find((work) => work.personId === 'sam');
  const job = state.jobs.find((object) => object.id === request.jobId);
  return (
    <section className="sam-request" aria-label="Sam’s pending request">
      <div>
        <p className="eyebrow">
          {request.status === 'ready' ? 'Sam is ready' : 'Sam has not answered yet.'}
        </p>
        <strong>
          {request.kind === 'lesson'
            ? 'Repair lesson'
            : `Responsibility for ${job?.title ?? 'the requested object'}`}
        </strong>
        <p>
          {request.status === 'ready'
            ? request.kind === 'lesson'
              ? `${request.readyUntil !== undefined ? `Start before ${dayTime(request.readyUntil)}. ` : ''}The lesson time starts when you begin.`
              : 'Sam is ready to decide whether to take the repair.'
            : compact
              ? `Sam will consider this after his current activity; ${request.kind === 'lesson' ? 'the lesson has not started' : 'responsibility has not been accepted'}.`
              : current
                ? `Sam is finishing this activity: ${current.option.label}. It ends at ${dayTime(current.endsAt)}.`
                : 'Sam has the request. His next decision determines whether he can join.'}
        </p>
        <small>Sam does not learn from you while he is busy elsewhere.</small>
      </div>
      <div className="request-actions">
        {request.kind === 'lesson' && request.status === 'ready' && (
          <button
            type="button"
            className="primary-action"
            onClick={() => act({ type: 'start-lesson' })}
          >
            Start lesson
            <small>
              The lesson can last up to {Math.min(90, dayRemaining(state))} minutes if it starts
              now.
            </small>
          </button>
        )}
        {request.status === 'requested' && current && current.endsAt > state.now && (
          <button
            type="button"
            onClick={() => act({ type: 'wait', minutes: current.endsAt - state.now })}
          >
            Wait for current activity
            <small>{current.endsAt - state.now} min · shared workshop time</small>
          </button>
        )}
        <button type="button" onClick={() => act({ type: 'cancel-request' })}>
          Cancel request
        </button>
      </div>
    </section>
  );
}
