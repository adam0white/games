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
}: {
  state: GameState;
  act: (command: Command) => void;
  onOpenJob: (jobId: string) => void;
  onPause?: () => void;
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
          <p className="eyebrow">Use your repaired objects</p>
          <h2 id="community-title">Choose activities for the afternoon</h2>
        </div>
        <span className="event-phase">
          {event.phase === 'completed'
            ? 'The afternoon has been recorded.'
            : event.resolvedAt !== undefined
              ? 'Activities are underway.'
              : event.phase === 'setting-up'
                ? 'Setup is in progress.'
                : 'Neighbours have been invited.'}
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
          This scene records the afternoon.{' '}
          {recordStage === 'prepared'
            ? `Equipment was prepared before ${dayTime(event.deadline)}.`
            : recordStage === 'returned'
              ? `The borrowing period ended at ${dayTime(event.finishesAt)}. Objects returned to their owners or the workshop.`
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
                        ? 'Your project is reserved for this activity. It will return to the workshop. No customer is waiting for it.'
                        : 'You can use your project for this activity. No customer is waiting for it.'
                      : job.status === 'delivered'
                        ? 'The object has been returned and is available for this loan.'
                        : job.status === 'offer'
                          ? 'You have not accepted this offer yet.'
                          : job.status === 'ready'
                            ? 'You have accepted and checked this object. Your promise to return it still applies.'
                            : 'You have accepted this favour. The object is at the workshop and still needs a use check.'}
                  </span>
                </p>
              )}
              <p className="separate-promises">
                {job?.isPersonal
                  ? 'Preparing this activity reserves your project for it. The project stays yours and returns to the workshop.'
                  : 'Preparing this activity borrows the selected object. Your promises to return other accepted objects still apply.'}
              </p>
              {job && (
                <button type="button" className="text-button" onClick={() => onOpenJob(job.id)}>
                  View {inSentence(job.title)} and its checks →
                </button>
              )}
            </div>
            <div className="preparation-action">
              <strong>
                Each activity takes {COMMUNITY_PREPARATION_MINUTES} minutes to prepare.
              </strong>
              <small>
                You have time to prepare at most two activities between 12:00 and 15:00. You can
                choose just one.
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
                    {job?.isPersonal
                      ? 'Your project is reserved until'
                      : 'The borrowed object returns at'}{' '}
                    {dayTime(event.finishesAt)}.
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
                You have prepared {event.preparedFormats.length} activit
                {event.preparedFormats.length === 1 ? 'y' : 'ies'}. More setup uses the time before
                neighbours choose.
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
            You prepared {event.preparedFormats.length}{' '}
            {event.preparedFormats.length === 1 ? 'activity' : 'activities'}. {participants.length}{' '}
            {participants.length === 1 ? 'person' : 'people'} completed an activity.
          </p>
          <h3>
            {event.phase === 'completed'
              ? participants.length
                ? 'What the afternoon made possible'
                : 'No one completed a prepared activity'
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
              'Activities are underway. Completion is recorded after the activity time passes.'}
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
                    ? 'This activity was completed.'
                    : event.phase === 'completed'
                      ? 'This activity was not completed.'
                      : d.startedAt !== undefined
                        ? `This activity is in progress until ${dayTime(d.endsAt ?? event.finishesAt)}.`
                        : 'No new activity has started.'}
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
