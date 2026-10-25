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
        <p>Your workshop is saved on this device. The game is paused at {dayTime(state.now)}.</p>
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
            This scene shows the activities people completed that afternoon. It does not show where
            people or borrowed objects are now.
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
                    ? `The object was returned to ${state.people[j.ownerId]?.name ?? j.ownerId}.`
                    : 'The object is kept at the workshop.'}{' '}
                  It passed these use checks: {requiredChecks(j).join(', ')}.
                </span>
              </p>
            ))
          ) : (
            <p>No completed required use check is recorded here. Your unfinished work is saved.</p>
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
                : 'Sam has not completed a whole repair independently yet.'}
            </p>
          )}
        </div>
      </section>
      <p className="pause-promise">
        Your unfinished promises and parts stay saved. Returning to the workshop does not advance
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
