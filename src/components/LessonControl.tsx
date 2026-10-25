import { dayRemaining, dayTime } from '../game/engine';
import type { Command, GameState } from '../game/types';
export function LessonControl({
  state,
  act,
  onRequestMore,
}: {
  state: GameState;
  act: (command: Command) => void;
  onRequestMore?: () => void;
}) {
  const end = state.watchUntil ?? state.now;
  const overlapping =
    state.people.sam?.agenda.commitments.filter(
      (c) =>
        c.status === 'pending' &&
        c.actions.includes('personal') &&
        c.from < end &&
        c.until > state.now,
    ) ?? [];
  if (state.watching)
    return (
      <div className="lesson-control active">
        <span>
          Sam has agreed to a session until {dayTime(state.watchUntil ?? state.now)}.
          <small>
            {Math.max(0, (state.watchUntil ?? state.now) - state.now)} min remain. Longer steps will
            finish after his agreed time and will not be observed.
          </small>
          {overlapping.map((c) => (
            <small key={c.id} className="lesson-conflict">
              Another pending promise overlaps with this session: {c.label} · {dayTime(c.from)} –{' '}
              {dayTime(c.until)}. Sam chose this lesson and may leave for his other plans.
            </small>
          ))}
          <small className="attention-boundary">
            Sam may not pay attention to every step during the agreed time.
          </small>
        </span>
        {onRequestMore && (
          <button type="button" onClick={onRequestMore}>
            Ask for more time<small>This sends a new request. Sam decides.</small>
          </button>
        )}
        <button type="button" onClick={() => act({ type: 'watch', enabled: false })}>
          End agreed session
        </button>
      </div>
    );
  if (state.pendingRequest?.kind === 'lesson')
    return (
      <div className="lesson-control">
        <span>
          {state.pendingRequest.status === 'ready'
            ? 'Sam has agreed to a time when the lesson can start.'
            : 'Sam has not answered the lesson request yet.'}
          <small>The session has not started.</small>
        </span>
        <button type="button" onClick={() => act({ type: 'cancel-request' })}>
          Cancel request
        </button>
      </div>
    );
  return (
    <div className="lesson-control">
      <span>
        Ask Sam to watch
        <small>
          The lesson can last up to {Math.min(90, dayRemaining(state))} minutes if it starts now.
          Sam may decline.
        </small>
      </span>
      <button
        type="button"
        disabled={dayRemaining(state) < 10}
        onClick={() => act({ type: 'request-lesson' })}
      >
        Request lesson
      </button>
    </div>
  );
}
