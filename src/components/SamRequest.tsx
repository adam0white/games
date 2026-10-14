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
          {request.status === 'ready' ? 'Sam is ready' : 'Request is waiting'}
        </p>
        <strong>
          {request.kind === 'lesson'
            ? 'Repair lesson'
            : `Responsibility for ${job?.title ?? 'the requested object'}`}
        </strong>
        <p>
          {request.status === 'ready'
            ? request.kind === 'lesson'
              ? `${request.readyUntil !== undefined ? `Start before ${dayTime(request.readyUntil)}. ` : ''}The lesson window begins only when you start.`
              : 'Sam is ready to consider the repair responsibility.'
            : compact
              ? `Waiting for consideration after Sam’s current activity; ${request.kind === 'lesson' ? 'the lesson has not started' : 'responsibility has not been accepted'}.`
              : current
                ? `Sam is finishing: ${current.option.label}. Current activity ends ${dayTime(current.endsAt)}.`
                : 'Sam has the request. His next decision determines whether he can join.'}
        </p>
        <small>Waiting does not count as attended teaching.</small>
      </div>
      <div className="request-actions">
        {request.kind === 'lesson' && request.status === 'ready' && (
          <button
            type="button"
            className="primary-action"
            onClick={() => act({ type: 'start-lesson' })}
          >
            Start lesson<small>Up to {Math.min(90, dayRemaining(state))} min if started now</small>
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
