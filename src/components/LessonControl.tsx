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
          Agreed session until {dayTime(state.watchUntil ?? state.now)}
          <small>
            {Math.max(0, (state.watchUntil ?? state.now) - state.now)} min remain. Longer steps will
            finish after his agreed time and will not be observed.
          </small>
          {overlapping.map((c) => (
            <small key={c.id} className="lesson-conflict">
              Another pending promise overlaps: {c.label} · {dayTime(c.from)} – {dayTime(c.until)}.
              Sam chose this lesson and may leave for his other plans.
            </small>
          ))}
          <small className="attention-boundary">
            An agreed window does not guarantee attention to every step.
          </small>
        </span>
        {onRequestMore && (
          <button type="button" onClick={onRequestMore}>
            Ask for more time<small>New request · Sam decides</small>
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
            ? 'Sam has agreed time to start'
            : 'Lesson request waiting'}
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
          Up to {Math.min(90, dayRemaining(state))} min if started now. Sam may decline.
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
