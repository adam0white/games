import { useState } from 'react';
import {
  COMMUNITY_PREPARATION_MINUTES,
  type CommunityFormat,
  eventOptions,
} from '../game/community';
import { dayTime } from '../game/engine';
import type { Command, GameState } from '../game/types';
import { inSentence } from '../ui/crises';
import { CommunityScene } from './CommunityScene';

export function CommunityPanel({
  state,
  act,
  onOpenJob,
  onPause,
}: {
  state: GameState;
  act: (command: Command) => void;
  onOpenJob: (jobId: string) => void;
  onPause: () => void;
}) {
  const [selected, setSelected] = useState<CommunityFormat>('garden');
  const [recordStage, setRecordStage] = useState<'prepared' | 'activity' | 'returned'>('activity');
  const event = state.community;
  if (!event) return null;
  const options = eventOptions(state, event);
  const option = options.find((o) => o.format === selected);
  const job = state.jobs.find((j) => j.id === option?.jobId);
  const beforeOpening = state.now < event.opensAt;
  const hasTime = state.now + COMMUNITY_PREPARATION_MINUTES <= event.deadline;
  const participants = event.decisions.filter((d) => d.completed && d.format);
  const content = (
    <section className="community-panel" aria-labelledby="community-title">
      <div className="community-heading">
        <div>
          <p className="eyebrow">A use beyond the workbench</p>
          <h2 id="community-title">One afternoon, three possible plans</h2>
        </div>
        <span className="event-phase">
          {event.phase === 'completed'
            ? 'Afternoon recorded'
            : event.resolvedAt !== undefined
              ? 'Activities underway'
              : event.phase === 'setting-up'
                ? 'Setting up'
                : 'Neighbours invited'}
        </span>
      </div>
      <p className="community-intro">
        Prepared objects make activities possible. Neighbours choose whether to take part.
      </p>
      <div className="event-timeline">
        <span>
          <small>Site opens</small>
          <strong>{dayTime(event.opensAt)}</strong>
        </span>
        <span>
          <small>Preparation closes</small>
          <strong>{dayTime(event.deadline)}</strong>
        </span>
        <span>
          <small>Loans return</small>
          <strong>{dayTime(event.finishesAt)}</strong>
        </span>
      </div>
      {event.phase === 'completed' && (
        <div className="event-record-stages">
          {(
            [
              ['prepared', 'Equipment prepared'],
              ['activity', 'Activities completed'],
              ['returned', 'Loans returned'],
            ] as const
          ).map(([stage, label], index) => (
            <button
              type="button"
              key={stage}
              aria-pressed={recordStage === stage}
              onClick={() => setRecordStage(stage)}
            >
              <small>0{index + 1}</small>
              {label}
            </button>
          ))}
        </div>
      )}
      <CommunityScene
        event={event}
        people={state.people}
        selected={selected}
        stage={event.phase === 'completed' ? recordStage : 'prepared'}
        jobs={state.jobs}
      />
      {event.phase === 'completed' && (
        <p className="recorded-caption">
          Recorded afternoon ·{' '}
          {recordStage === 'prepared'
            ? `Equipment was prepared before ${dayTime(event.deadline)}.`
            : recordStage === 'returned'
              ? `Loan reservations ended at ${dayTime(event.finishesAt)}. Objects returned to their owners or the workshop.`
              : 'People shown here completed these activities. The scene records that afternoon.'}
        </p>
      )}
      {event.phase !== 'completed' && event.resolvedAt === undefined ? (
        <>
          <div className="format-choices" role="tablist" aria-label="Gathering formats">
            {options.map((o, index) => (
              <button
                type="button"
                role="tab"
                key={o.format}
                aria-selected={selected === o.format}
                aria-controls="format-detail"
                id={`format-tab-${o.format}`}
                tabIndex={selected === o.format ? 0 : -1}
                onClick={() => setSelected(o.format)}
                onKeyDown={(e) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                  e.preventDefault();
                  const nextIndex =
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? options.length - 1
                        : (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) %
                          options.length;
                  const next = options[nextIndex];
                  if (!next) return;
                  setSelected(next.format);
                  e.currentTarget.parentElement
                    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                    [nextIndex]?.focus();
                }}
              >
                <span>{o.label}</span>
                <small>
                  {o.prepared ? 'Prepared' : o.ready ? 'Equipment ready' : 'Equipment needed'}
                </small>
              </button>
            ))}
          </div>
          <div
            className="format-detail"
            id="format-detail"
            role="tabpanel"
            aria-labelledby={`format-tab-${selected}`}
          >
            <div>
              <h3>{option?.label}</h3>
              <p>{option?.description}</p>
              <p className="format-readiness">{option?.reason}</p>
              {job && (
                <p className="equipment-selection">
                  <strong>Selected equipment: {job.title}</strong>
                  <span>
                    {job.isPersonal
                      ? option?.prepared || event.reservedJobIds.includes(job.id)
                        ? 'Your retained project · reserved for this activity and returned to the workshop, with no customer promise'
                        : 'Your retained project · available to prepare for this activity, with no customer promise'
                      : job.status === 'delivered'
                        ? 'Returned object, available for this loan'
                        : job.status === 'offer'
                          ? 'Offer not yet accepted'
                          : job.status === 'ready'
                            ? 'Accepted and checked; its return is a separate promise'
                            : 'Accepted favour at the workshop; still needs its use check'}
                  </span>
                </p>
              )}
              <p className="separate-promises">
                {job?.isPersonal
                  ? 'Preparing reserves your retained project for this activity. It stays yours and comes back to the workshop.'
                  : 'Preparing this plan borrows the selected object. Other accepted objects keep their separate return promises.'}
              </p>
              {job && (
                <button type="button" className="text-button" onClick={() => onOpenJob(job.id)}>
                  View {inSentence(job.title)} and its checks →
                </button>
              )}
            </div>
            <div className="preparation-action">
              <strong>{COMMUNITY_PREPARATION_MINUTES} min per format</strong>
              <small>
                At most two fit between 12:00 and 15:00. One prepared format is enough to offer a
                plan.
              </small>
              {beforeOpening ? (
                Math.floor(state.now / 1440) === Math.floor(event.opensAt / 1440) ? (
                  <button type="button" onClick={() => act({ type: 'wait-for-site' })}>
                    Wait until the site opens<small>{dayTime(event.opensAt)}</small>
                  </button>
                ) : (
                  <p>
                    The site opens {dayTime(event.opensAt)}. Restore and check equipment in the
                    workshop first.
                  </p>
                )
              ) : (
                <button
                  type="button"
                  disabled={!option?.ready || option.prepared || !hasTime}
                  onClick={() => act({ type: 'prepare-event', format: selected })}
                >
                  {option?.prepared
                    ? 'Already prepared'
                    : !hasTime
                      ? 'Preparation time has ended'
                      : `Prepare ${option?.label.toLowerCase()}`}
                  <small>
                    {COMMUNITY_PREPARATION_MINUTES} min ·{' '}
                    {job?.isPersonal ? 'project reserved until' : 'borrowed object returns at'}{' '}
                    {dayTime(event.finishesAt)}
                  </small>
                </button>
              )}
              {!beforeOpening && !option?.prepared && (!option?.ready || !hasTime) && (
                <p className="prepare-disabled-reason">
                  {!hasTime
                    ? 'Not enough preparation time remains before the deadline.'
                    : option?.reason}
                </p>
              )}
            </div>
          </div>
          {!beforeOpening && event.preparedFormats.length > 0 && state.now < event.deadline && (
            <div className="community-wait">
              <span>
                {event.preparedFormats.length} format{event.preparedFormats.length === 1 ? '' : 's'}{' '}
                prepared. More setup uses the time before neighbours choose.
              </span>
              <button
                type="button"
                onClick={() => act({ type: 'wait', minutes: event.deadline - state.now })}
              >
                Wait for the afternoon choices
                <small>
                  {event.deadline - state.now} min · until {dayTime(event.deadline)}
                </small>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="event-outcome">
          <p className="eyebrow">
            Prepared {event.preparedFormats.length} · completed attendance {participants.length}
          </p>
          <h3>
            {event.phase === 'completed'
              ? participants.length
                ? 'What the afternoon made possible'
                : 'The prepared plans were not attended'
              : 'People have chosen their afternoon'}
          </h3>
          {event.phase === 'completed' && (
            <div className="format-outcome-details">
              {event.preparedFormats.map((format) => {
                const actors = participants
                  .filter((d) => d.format === format)
                  .map((d) => state.people[d.personId]?.name ?? d.personId);
                return (
                  <p key={format}>
                    <strong>
                      {format === 'garden'
                        ? 'Garden table'
                        : format === 'reading'
                          ? 'Reading room'
                          : 'Paper performance'}
                    </strong>
                    {actors.length
                      ? `${actors.join(', ')} completed ${format === 'garden' ? 'the gathering beside the checked lantern' : format === 'reading' ? 'the reading with a checked fan available' : 'the performance with the working paper stage'}.`
                      : 'Equipment was prepared. No person completed this activity.'}
                  </p>
                );
              })}
            </div>
          )}
          <p>
            {event.outcome ||
              'Activities are underway. Completion is recorded after the actual time passes.'}
          </p>
          {event.phase !== 'completed' && event.finishesAt > state.now && (
            <button
              type="button"
              className="finish-afternoon"
              onClick={() => act({ type: 'wait', minutes: event.finishesAt - state.now })}
            >
              Let the afternoon activities finish
              <small>
                {event.finishesAt - state.now} min · until {dayTime(event.finishesAt)}
              </small>
            </button>
          )}
          <ol>
            {event.decisions.map((d) => (
              <li key={d.personId}>
                <strong>{state.people[d.personId]?.name ?? d.personId}</strong>
                <span>{d.activityLabel}</span>
                <small>
                  {d.completed
                    ? 'Completed'
                    : event.phase === 'completed'
                      ? 'Not completed'
                      : d.startedAt !== undefined
                        ? `In progress until ${dayTime(d.endsAt ?? event.finishesAt)}`
                        : 'No new activity started'}
                </small>
                <details className="decision-quote">
                  <summary>
                    {state.people[d.personId]?.name ?? d.personId}’s recorded choice
                  </summary>
                  <p>“{d.speech}”</p>
                </details>
              </li>
            ))}
          </ol>
          {event.phase === 'completed' && (
            <div className="afternoon-pause">
              <p>This afternoon can be a stopping point. Open promises remain saved.</p>
              <button type="button" className="primary-action" onClick={onPause}>
                Close the workshop for now<small>Pause here · no time passes</small>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
  return beforeOpening && Math.floor(state.now / 1440) < Math.floor(event.opensAt / 1440) ? (
    <details className="community-preview">
      <summary>
        Community afternoon · site opens {dayTime(event.opensAt)}
        <span>{event.preparedFormats.length} formats prepared · view plans and equipment</span>
      </summary>
      {content}
    </details>
  ) : (
    content
  );
}
