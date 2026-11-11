import { dayRemaining, dayTime } from '../game/engine';
import type { Command, GameState } from '../game/types';
import { SamRequest } from './SamRequest';

function SessionControl({
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

/** Route to existing voluntary attendance and physical tests; never grants a witness or method. */
export function LessonControl({
  state,
  act,
  onRequestMore,
  onBench,
}: {
  state: GameState;
  act: (command: Command) => void;
  onRequestMore?: () => void;
  onBench?: () => void;
}) {
  const job = state.jobs.find((j) => j.id === state.selectedJobId);
  const tests =
    job?.evidence.filter((e) => e.kind === 'use' && e.witnessedBy?.includes('sam')) ?? [];
  return (
    <section aria-label="Share an observation with Sam">
      <h4>Share an observation with Sam</h4>
      <p>
        Request a lesson. If Sam agrees, choose Start lesson. Then go to the held object and try it
        or read the meter while he attends. A request alone teaches nothing.
      </p>
      {state.pendingRequest?.kind === 'lesson' ? (
        <SamRequest state={state} act={act} compact />
      ) : (
        <SessionControl state={state} act={act} onRequestMore={onRequestMore} />
      )}
      {onBench && (
        <button type="button" onClick={onBench}>
          Go to the held object
          <small>
            {job?.title ?? 'Choose an active object on Board'} · testing spends workshop time
          </small>
        </button>
      )}
      {tests.length ? (
        <p>
          Witnessed test: {tests.at(-1)?.summary} Sam attended this test; this does not prove a
          diagnosis or that he learned every step.
        </p>
      ) : (
        <p>
          No witnessed use test on this object yet. The test record will name Sam only if he
          actually attends.
        </p>
      )}
    </section>
  );
}
