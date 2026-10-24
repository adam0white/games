import { dayTime, requiredChecks } from '../game/engine';
import type { GameState } from '../game/types';
import { labToolsEnabled } from '../ui/lab-tools';
import { CommunityScene } from './CommunityScene';
export function WorkshopPause({
  state,
  onReturn,
  onExport,
}: {
  state: GameState;
  onReturn: () => void;
  onExport: () => void;
}) {
  const works = state.jobs.filter(
    (j) =>
      !j.isDonor && !j.returnedUnfinished && requiredChecks(j).every((c) => j.verified.includes(c)),
  );
  const event = state.community?.phase === 'completed' ? state.community : undefined;
  return (
    <main className="workshop-pause">
      <div className="pause-heading">
        <span className="brand-mark">sw</span>
        <p className="eyebrow">Workshop paused by you</p>
        <h1>You can leave it here.</h1>
        <p>Saved on this device. Time waits at {dayTime(state.now)}.</p>
      </div>
      {event && (
        <>
          <CommunityScene
            event={event}
            people={state.people}
            selected={event.preparedFormats[0] ?? 'garden'}
            stage="activity"
            jobs={state.jobs}
          />
          <p className="recorded-caption">
            Recorded afternoon · completed activities, not the current location of people or loaned
            objects.
          </p>
        </>
      )}
      <section className="pause-record">
        <div>
          <h2>What works</h2>
          {works.length ? (
            works.map((j) => (
              <p key={j.id}>
                <strong>{j.title}</strong>
                <span>
                  {j.status === 'delivered'
                    ? `Returned to ${state.people[j.ownerId]?.name ?? j.ownerId}`
                    : 'Retained at the workshop'}{' '}
                  · checked for {requiredChecks(j).join(', ')}
                </span>
              </p>
            ))
          ) : (
            <p>No completed required use check is recorded yet. Unfinished work stays saved.</p>
          )}
        </div>
        <div>
          <h2>What people actually did</h2>
          {event ? (
            event.decisions.map((d) => (
              <p key={d.personId}>
                <strong>{state.people[d.personId]?.name ?? d.personId}</strong>
                <span>
                  {d.activityLabel} · {d.completed ? 'completed' : 'not completed'}
                </span>
              </p>
            ))
          ) : (
            <p>
              {state.independentRepairs
                ? `Sam completed ${state.independentRepairs} independent repair${state.independentRepairs === 1 ? '' : 's'}.`
                : 'No independent whole repair is recorded yet.'}
            </p>
          )}
        </div>
      </section>
      <p className="pause-promise">
        Open promises and parts remain exactly where you left them. Returning here does not advance
        the clock.
      </p>
      <div className="pause-actions">
        <button type="button" className="primary-action" onClick={onReturn}>
          Return to the workshop
        </button>
        {labToolsEnabled(window.location.search) && (
          <button type="button" onClick={onExport}>
            Export this moment
          </button>
        )}
      </div>
    </main>
  );
}
