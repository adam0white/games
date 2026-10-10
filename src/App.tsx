import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  createGame,
  exportPlaytest,
  getView,
  replayPlaytest,
  restoreGame,
  serializeGame,
  transition,
} from './game/engine';
import { getServiceWeekView } from './game/service-week';
import type { ActionView, ConversationLine, GameInput, GameState, ObjectView } from './game/types';
import { getWorkshopView, type LedgerEntry, type WorkshopState } from './game/workshop';
import { Cabinet } from './ui/Cabinet';
import { createChoiceGate } from './ui/choiceGate';
import { JournalHistory } from './ui/JournalHistory';
import { ObjectIllustration } from './ui/ObjectIllustration';
import { ObjectPresentation } from './ui/ObjectPresentation';
import { readStory, writeStory } from './ui/storage';

const ledgerLabels: Record<LedgerEntry['kind'], string> = {
  'materials-advance': 'Battery advance',
  materials: 'Battery bought',
  'repair-fee': 'Repair payment',
  'sam-pay': 'Sam’s pay',
  'checking-place': 'Second checking tray',
};
const cabinetStageLabels: Record<WorkshopState['cabinet'], string> = {
  unnoticed: 'waiting to begin',
  looked: 'ready to measure',
  measured: 'measurements saved',
  hung: 'doors hung',
  finished: 'finished',
};
const ledgerMoney = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function headerClock(label: string, chapterVisible: boolean): string {
  if (!chapterVisible) return label;
  const [prefix, ...clock] = label.split(' · ');
  return clock.length > 0 && (/^Age \d+$/.test(prefix ?? '') || prefix === 'After school')
    ? clock.join(' · ')
    : label;
}

function initialStory(): { game: GameState; warning: string | null } {
  const saved = readStory();
  if (saved) {
    try {
      return { game: restoreGame(saved), warning: null };
    } catch {
      return {
        game: createGame(),
        warning:
          'The saved story could not be read. A fresh story is open; your old save will remain until you take an action.',
      };
    }
  }
  return { game: createGame(), warning: null };
}

export default function App() {
  const [initial] = useState(initialStory);
  const [game, setGame] = useState(initial.game);
  const [message, setMessage] = useState<string | null>(initial.warning);
  const [journal, setJournal] = useState(false);
  const [departingObject, setDepartingObject] = useState<ObjectView | null>(null);
  const departureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (departureTimer.current) clearTimeout(departureTimer.current);
    },
    [],
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [settling, setSettling] = useState(false);
  const [attention, setAttention] = useState<{
    lines: ConversationLine[];
    narration: string | null;
    revision: number;
    passage?: string;
    returnedObject?: string;
  } | null>(null);
  const [previousEvidence, setPreviousEvidence] = useState<{
    id: string;
    observations: string[];
  } | null>(null);
  const [choiceGate] = useState(() => createChoiceGate(() => setSettling(false)));
  useEffect(() => () => choiceGate.cancel(), [choiceGate]);
  useEffect(() => {
    function closeJournal(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setJournal(false);
        setConfirmReset(false);
      }
    }
    window.addEventListener('keydown', closeJournal);
    return () => window.removeEventListener('keydown', closeJournal);
  }, []);
  const storyRevision = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const restoreChoiceFocus = useRef(false);
  useEffect(() => {
    if (game.inputs.length > 0 && !settling && restoreChoiceFocus.current) {
      const visibleChoice = [
        ...(actionsRef.current?.querySelectorAll<HTMLButtonElement>('[data-choice]') ?? []),
      ].find((button) => button.getClientRects().length > 0);
      visibleChoice?.focus({ preventScroll: true });
      restoreChoiceFocus.current = false;
    }
  }, [settling, game.inputs.length]);
  const view = getView(game);
  const workshop = getWorkshopView(game);
  const serviceWeek = getServiceWeekView(game);
  const timeAwayIds = new Set(['next-day', 'back-to-school', 'wait-person']);
  const isProjectAction = (action: ActionView) =>
    /^workshop-(cabinet|drawings|display-drawing|keep-drawing)/.test(action.id);
  const immediateWeekIds = new Set([
    'service-begin',
    'service-regular',
    'service-favours',
    'service-private',
    'service-find-model',
    'service-personal-session',
    'service-reflect',
    'service-close-small',
    'service-close-regular',
    'service-measure-donor',
    'service-recover-donor',
    'service-decline-donor',
  ]);
  const isImmediateWeekAction = (action: ActionView) => {
    if (action.id === 'service-paid-help') return action.kind === 'primary';
    if (
      immediateWeekIds.has(action.id) ||
      /^service-(hear|accept|later|decline)-/.test(action.id) ||
      action.id.startsWith('service-revisit-unfinished-')
    )
      return true;
    if (action.id === 'service-invite-donor') return view.focus?.appearance === 'model';
    if (action.id.startsWith('service-delay-')) {
      const objectId = action.id.replace('service-delay-', 'service-');
      return (
        view.focus?.id === objectId ||
        Boolean(
          game.serviceWeek?.jobs.some(
            (job) =>
              job.id === objectId && job.collectionAt !== undefined && job.collectionAt <= game.now,
          ),
        )
      );
    }
    return false;
  };
  const mainChoiceOrder = (action: ActionView) =>
    action.id === 'wait-appointment'
      ? 3
      : action.id === 'rest'
        ? 2
        : isImmediateWeekAction(action)
          ? view.focus
            ? 1
            : 0
          : view.focus
            ? 0
            : 1;
  const isRequestDecision = (action: ActionView) =>
    /^service-(accept|later|decline)-(leila|nora)$/.test(action.id);
  const decidingRequest = view.actions.some(isRequestDecision);
  const isMainCandidate = (action: ActionView) =>
    action.kind !== 'quiet' &&
    !action.id.startsWith('workshop-') &&
    (!action.id.startsWith('service-') || isImmediateWeekAction(action)) &&
    !timeAwayIds.has(action.id);
  const actionGroups = [
    {
      id: 'here',
      label: '',
      actions: view.actions
        .filter(
          (action) => isMainCandidate(action) && (!decidingRequest || isRequestDecision(action)),
        )
        .sort((left, right) => mainChoiceOrder(left) - mainChoiceOrder(right)),
    },
    {
      id: 'elsewhere',
      label: 'Do something else for now',
      actions: decidingRequest
        ? view.actions.filter((action) => isMainCandidate(action) && !isRequestDecision(action))
        : [],
    },
    {
      id: 'conversation',
      label: 'Talk for a while',
      actions: view.actions.filter((action) => action.kind === 'quiet'),
    },
    { id: 'project', label: 'The family project', actions: view.actions.filter(isProjectAction) },
    {
      id: 'workshop',
      label: 'Other repairs and plans',
      actions: view.actions.filter(
        (action) => action.id.startsWith('workshop-') && !isProjectAction(action),
      ),
    },
    {
      id: 'week',
      label: serviceWeek?.label ?? 'A week at the bench',
      actions: view.actions.filter(
        (action) => action.id.startsWith('service-') && !isImmediateWeekAction(action),
      ),
    },
    {
      id: 'time',
      label: 'Take some time',
      actions: view.actions.filter((action) => timeAwayIds.has(action.id)),
    },
  ].filter((group) => group.actions.length > 0 || (group.id === 'week' && serviceWeek));
  const projectChoices = actionGroups.find((group) => group.id === 'project')?.actions ?? [];
  const latest = view.conversation.at(-1);
  const dialogue = attention?.lines ?? view.currentDialogue ?? (latest ? [latest] : []);
  const narration = attention?.narration ?? null;
  const history = view.journal ?? view.conversation;
  const recordedObservations = [...new Set(view.focus?.observations ?? [])].filter(
    (observation) =>
      !dialogue.some((line) => line.text === observation) && observation !== narration,
  );
  function keep(next: GameState) {
    storyRevision.current++;
    choiceGate.cancel();
    setSettling(false);
    setGame(next);
    setMessage(
      writeStory(serializeGame(next))
        ? null
        : 'This story is still playable, but this browser could not save it. Export it from the journal before leaving.',
    );
  }
  function act(input: GameInput) {
    if (choiceGate.locked) return;
    const next = transition(game, input);
    if (next === game) return;
    const nextView = getView(next);
    const freshLines = (nextView.currentDialogue ?? nextView.conversation).filter(
      (line) => line.id > (latest?.id ?? -1),
    );
    if (departureTimer.current) clearTimeout(departureTimer.current);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (view.focus && !nextView.focus && !reducedMotion) {
      setDepartingObject(view.focus);
      departureTimer.current = setTimeout(() => setDepartingObject(null), 620);
    } else setDepartingObject(null);
    setAttention({
      lines: freshLines,
      narration: freshLines.length ? null : (nextView.moment ?? null),
      revision: next.inputs.length,
      returnedObject:
        view.focus &&
        nextView.focus?.id !== view.focus.id &&
        input.type === 'action' &&
        /^(?:(?:Give|Hand)\b.*\bback\b|Return\b)/i.test(
          view.actions.find((action) => action.id === input.id)?.label ?? '',
        )
          ? view.focus.title
          : undefined,
      passage:
        input.type === 'action' && input.id === 'back-to-school'
          ? nextView.lifeChapter?.label.includes('School finished')
            ? 'After the final school year'
            : 'A year later'
          : undefined,
    });
    setPreviousEvidence(
      view.focus ? { id: view.focus.id, observations: view.focus.observations } : null,
    );
    keep(next);
    choiceGate.pause(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    setSettling(choiceGate.locked);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([exportPlaytest(game)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'repair-story.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importStory(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const revision = ++storyRevision.current;
    if (file.size > 8_000_000) {
      setMessage('That file is larger than the 8 MB story limit. Your current story is unchanged.');
      return;
    }
    setMessage('Opening your story…');
    try {
      // Let the status paint before synchronous replay occupies the main thread.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (revision !== storyRevision.current) return;
      const text = await file.text();
      if (revision !== storyRevision.current) return;
      const next = replayPlaytest(text);
      keep(next);
      setJournal(false);
      setAttention(null);
      setDepartingObject(null);
      setPreviousEvidence(null);
    } catch {
      if (revision !== storyRevision.current) return;
      setMessage(
        'That story could not be replayed. Please choose an exported repair story. Your current story is unchanged.',
      );
    }
  }
  function renderAction(action: ActionView) {
    return (
      <button
        type="button"
        data-choice="true"
        key={action.id}
        className={`${action.kind === 'primary' ? 'primary' : ''} intent-${action.intent ?? 'stay'}`}
        disabled={settling}
        title={
          action.intent === 'leave'
            ? 'Move on from this moment'
            : action.intent === 'pause'
              ? 'The work can wait here'
              : 'Continue here'
        }
        onClick={(event) => {
          restoreChoiceFocus.current = event.detail === 0;
          act({ type: 'action', id: action.id });
        }}
      >
        <span className="action-label">
          {action.label}
          {action.intent === 'leave' && <span className="intent-mark">Move on</span>}
        </span>
        {action.id === 'rest' ? (
          <small>Offer company over tea; they may keep their own plans.</small>
        ) : (
          action.detail && action.id !== 'wait-appointment' && <small>{action.detail}</small>
        )}
      </button>
    );
  }
  const response = (
    <div className="attention-channel" aria-live="polite" aria-atomic="true">
      {(dialogue.length > 0 || narration) && (
        <section
          key={`${attention?.revision ?? 0}-${dialogue.map((line) => line.id).join('-')}`}
          className={`conversation ${dialogue.at(-1)?.tone ?? 'warm'} ${attention?.passage ? 'season-turn' : ''} ${attention?.returnedObject ? 'return-response' : ''}`}
        >
          {attention?.returnedObject && (
            <span className="return-label">About: {attention.returnedObject}</span>
          )}
          {attention?.passage && <span className="passage-label">{attention.passage}</span>}
          {narration && <p className="narration">{narration}</p>}
          {dialogue.map((line) => (
            <div className="dialogue-line" key={line.id}>
              <span className="speaker">{line.speaker}</span>
              <p>{line.text}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
  return (
    <main className={`story scene-${view.scene}`}>
      <header className="masthead">
        <div className="place-time">
          <span className="place">{view.scene === 'home' ? 'At home' : 'In the garage'}</span>
          {view.timeLabel && (
            <span className="time">{headerClock(view.timeLabel, Boolean(view.lifeChapter))}</span>
          )}
        </div>
        <button
          type="button"
          className="journal-toggle"
          onClick={() => {
            setJournal(!journal);
            setConfirmReset(false);
          }}
          aria-expanded={journal}
          aria-controls="journal"
        >
          {journal ? 'Back to the bench' : 'Journal'}
        </button>
      </header>
      {journal && (
        <section id="journal" className="journal" aria-label="Story journal">
          <h2>Your story</h2>
          <p className="journal-note">The conversations and small discoveries you have kept.</p>
          <div className="journal-tools">
            <button type="button" onClick={download}>
              Export story
            </button>
            <button type="button" onClick={() => fileInput.current?.click()}>
              Open exported story
            </button>
            <button type="button" onClick={() => setConfirmReset(true)}>
              Start a new story
            </button>
          </div>
          <p className="journal-note">
            Opening a story replaces the current one. Export first if you want to keep both.
          </p>
          {confirmReset && (
            <div className="reset-confirm">
              <p>Leave this story and begin again? Export it first if you want to return.</p>
              <button
                type="button"
                onClick={() => {
                  keep(createGame());
                  setAttention(null);
                  setDepartingObject(null);
                  setPreviousEvidence(null);
                  setConfirmReset(false);
                  setJournal(false);
                }}
              >
                Begin again
              </button>
              <button type="button" onClick={() => setConfirmReset(false)}>
                Keep this story
              </button>
            </div>
          )}
          {message && (
            <p className="message" role="status">
              {message}
            </p>
          )}
          <JournalHistory lines={history} />
        </section>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        onChange={importStory}
        hidden
      />
      {!journal && message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
      <div
        hidden={journal}
        className={`present-story ${view.focus ? 'focused-story' : ''}`}
        ref={actionsRef}
      >
        {view.lifeChapter && (
          <div className="life-chapter">
            <span>{view.lifeChapter.label}</span>
            {view.lifeChapter.detail && <p>{view.lifeChapter.detail}</p>}
          </div>
        )}
        {!view.focus && (
          <section className="story-heading">
            <h1>{view.title}</h1>
            <p>{view.subtitle}</p>
          </section>
        )}
        {attention?.returnedObject && response}
        {view.focus && (
          <section
            className={`workbench ${attention?.returnedObject ? 'next-object' : ''}`}
            aria-label={view.focus.title}
          >
            <ObjectPresentation key={view.focus.id} object={view.focus} />
            <div className="object-story">
              <h1>{view.focus.title}</h1>
              {!view.focus.title
                .toLocaleLowerCase()
                .includes(view.focus.owner.toLocaleLowerCase()) && (
                <p className="owner">{view.focus.owner}</p>
              )}
              <p>{view.focus.story}</p>
              {recordedObservations.length > 0 && (
                <details className="object-notes">
                  <summary>
                    Notes so far · {recordedObservations.length}
                    {previousEvidence?.id === view.focus.id &&
                      recordedObservations.some(
                        (observation) => !previousEvidence.observations.includes(observation),
                      ) && <span className="notes-update">New discovery</span>}
                  </summary>
                  <ul className="observations">
                    {recordedObservations.map((observation) => (
                      <li
                        key={observation}
                        className={
                          previousEvidence?.id === view.focus?.id &&
                          !previousEvidence?.observations.includes(observation)
                            ? 'new-evidence'
                            : ''
                        }
                      >
                        {previousEvidence?.id === view.focus?.id &&
                          !previousEvidence?.observations.includes(observation) && (
                            <span className="evidence-tag">New</span>
                          )}
                        {observation}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>
        )}
        {!view.focus && departingObject && (
          <div className="object-departure" aria-hidden="true">
            <ObjectIllustration object={departingObject} />
          </div>
        )}
        {view.note && !view.collectionPlans?.length && <p className="bench-note">{view.note}</p>}
        {(Boolean(view.collectionPlans?.length) || Boolean(view.knownAppointments?.length)) && (
          <aside className="known-arrangements" aria-label="Agreed visits and collections">
            {view.collectionPlans?.map((plan) => (
              <p key={plan.objectId}>
                <strong>{plan.title}</strong> · {plan.detail}
              </p>
            ))}
            {view.knownAppointments
              ?.filter(
                (appointment) =>
                  !view.collectionPlans?.some(
                    (plan) =>
                      plan.owner.toLocaleLowerCase() === appointment.name.toLocaleLowerCase(),
                  ),
              )
              .map((appointment) => (
                <p key={appointment.personId}>
                  <strong>{appointment.name}</strong> · {appointment.detail}
                </p>
              ))}
          </aside>
        )}
        {workshop?.cabinet?.open && (
          <details className="cabinet-at-side" open={!view.focus && !game.apprentice?.jobId}>
            <summary>Dad’s cabinet doors · {cabinetStageLabels[workshop.cabinet.stage]}</summary>
            <section className="family-project" aria-label="Dad’s cabinet project">
              <Cabinet stage={workshop.cabinet.stage} drawing={workshop.cabinet.drawingDisplayed} />
              <div>
                <p>{workshop.cabinet.description}</p>
                {workshop.cabinet.drawingFound && (
                  <p className="project-memory">
                    {workshop.cabinet.drawingDisplayed
                      ? 'Your drawing is beside the finished cabinet.'
                      : 'The saved drawing is in the flat box.'}
                  </p>
                )}
              </div>
            </section>
            <div className="choice-buttons project-choices">{projectChoices.map(renderAction)}</div>
          </details>
        )}
        {view.apprenticeship && (
          <section
            className="apprentice-presence"
            aria-label={`${view.apprenticeship.name} at the bench`}
          >
            <span className="speaker">{view.apprenticeship.name}</span>
            <p>{view.apprenticeship.activity}</p>
            <small>{view.apprenticeship.responsibility}</small>
          </section>
        )}
        {!attention?.returnedObject && response}
        {serviceWeek && <p className="week-progress">{serviceWeek.label}</p>}
        {view.actions.length > 0 && (
          <section
            className={`actions ${settling ? 'settling' : 'ready'}`}
            aria-busy={settling}
            aria-label="What to do next"
          >
            {actionGroups
              .filter((group) => group.id !== 'project' || !workshop?.cabinet?.open)
              .map((group) =>
                ['elsewhere', 'conversation', 'project', 'workshop', 'week'].includes(group.id) ? (
                  <details className="choice-group choice-more" key={group.id}>
                    <summary>
                      {group.id === 'week' ? 'This week’s arrangements' : group.label}
                    </summary>
                    {group.id === 'week' && serviceWeek && (
                      <div className="week-arrangements">
                        <p>{serviceWeek.detail}</p>
                        {serviceWeek.arrangements.length > 0 && (
                          <ul>
                            {serviceWeek.arrangements.map((arrangement) => (
                              <li key={arrangement}>
                                {serviceWeek.checkingPlace === 'second' &&
                                arrangement ===
                                  'Two stable labelled checking places, bought for £6.'
                                  ? 'The second checking tray is in use.'
                                  : arrangement}
                              </li>
                            ))}
                          </ul>
                        )}
                        {serviceWeek.conclusion && (
                          <p>{serviceWeek.conclusion.replace('This authored week', 'This week')}</p>
                        )}
                      </div>
                    )}
                    <div className="choice-buttons">{group.actions.map(renderAction)}</div>
                  </details>
                ) : (
                  <div className="choice-group" key={group.id}>
                    {group.label && <h2>{group.label}</h2>}
                    <div className="choice-buttons">{group.actions.map(renderAction)}</div>
                  </div>
                ),
              )}
          </section>
        )}
        {workshop && (workshop.jobs.length > 0 || workshop.notebook || workshop.arrangement) && (
          <aside className="workshop-notes" aria-label="Workshop notes">
            {workshop.jobs.length > 0 && (
              <details className="job-slips">
                <summary>Agreed work</summary>
                <div>
                  {workshop.jobs.map((job) => (
                    <article key={job.id}>
                      <h3>{job.title}</h3>
                      <p>{job.note}</p>
                      <small>{job.quote}</small>
                      {job.stage === 'quoted' && (
                        <p className="agreement-status">Discussed, not yet accepted.</p>
                      )}
                    </article>
                  ))}
                </div>
              </details>
            )}
            {workshop.notebook && (
              <details className="cash-notebook">
                <summary>Workshop notebook</summary>
                <section className="cash-ledger-scroll" aria-label="Workshop transactions">
                  <table className="cash-ledger">
                    <caption>Recorded transactions</caption>
                    <thead>
                      <tr>
                        <th scope="col">For</th>
                        <th scope="col">In / out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {game.workshop?.ledger.map((entry) => {
                        const object = game.objects.find((item) => item.id === entry.jobId);
                        return (
                          <tr key={entry.id}>
                            <th scope="row">
                              {object?.title ?? ledgerLabels[entry.kind]}
                              {object && <small>{ledgerLabels[entry.kind]}</small>}
                            </th>
                            <td className={entry.amount > 0 ? 'ledger-income' : undefined}>
                              {entry.amount > 0 ? '+' : entry.amount < 0 ? '−' : ''}
                              {ledgerMoney.format(Math.abs(entry.amount) / 100)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
                <p>{workshop.notebook.cash} kept for the workshop.</p>
              </details>
            )}
            {workshop.arrangement && <p className="workshop-arrangement">{workshop.arrangement}</p>}
          </aside>
        )}
        {view.whereabouts && view.whereabouts.length > 0 && (
          <aside className="people-nearby" aria-label="People">
            {view.whereabouts.map((person) => (
              <p key={person.id}>
                <strong>{person.name}</strong> · {person.activity}
              </p>
            ))}
          </aside>
        )}
        {(view.shelf.length > 0 || view.parts.length > 0) && (
          <aside className="belongings">
            {view.shelf.length > 0 && (
              <section>
                <h2>Put aside</h2>
                <div className="shelf">
                  {view.shelf.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      disabled={settling}
                      onClick={() => act({ type: 'select', id: item.id })}
                    >
                      <span>{item.title}</span>
                      <small>{item.note}</small>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {view.parts.length > 0 && (
              <section>
                <h2>Parts tray</h2>
                <ul className="parts">
                  {view.parts.map((part) => (
                    <li key={part.id}>
                      {part.label}
                      {part.count > 1 ? ` · ${part.count}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        )}
      </div>
      <footer>A little work, a little patience.</footer>
    </main>
  );
}
