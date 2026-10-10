import type { ChangeEvent } from 'react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { HistoricalRuntimeLoadError, restoreBrowserStory } from './game/browser-replay';
import {
  createGame,
  exportPlaytest,
  getView,
  serializeGame,
  transition,
} from './game/current-engine';
import { getServiceWeekView } from './game/service-week';
import type { ActionView, ConversationLine, GameInput, GameState, ObjectView } from './game/types';
import { getWorkshopView, type LedgerEntry, type WorkshopState } from './game/workshop';
import { Cabinet } from './ui/Cabinet';
import { createChoiceGate } from './ui/choiceGate';
import { JournalHistory } from './ui/JournalHistory';
import { ObjectIllustration } from './ui/ObjectIllustration';
import { ObjectPresentation } from './ui/ObjectPresentation';
import { OperationsBoard } from './ui/OperationsBoard';
import { getMappedRepairActions } from './ui/repairBindings';
import { StoryBootstrap } from './ui/StoryBootstrap';
import { ActionLane, ChapterCeremony, PromiseCards } from './ui/WorkspaceCards';
import { WorkspaceNavigation } from './ui/WorkspaceNavigation';
import {
  type OutcomeCeremony,
  operationsCeremony,
  projectActions,
  projectChapter,
  type WorkspacePanel,
} from './ui/workspaceFlow';
import './ui/workspace.css';
import { writeStory } from './ui/storage';

const WorkshopScene3D = lazy(() => import('./ui/workshop/WorkshopScene3D'));

const ledgerLabels: Record<LedgerEntry['kind'], string> = {
  'materials-advance': 'Battery advance',
  materials: 'Battery bought',
  'repair-fee': 'Repair payment',
  'sam-pay': 'Sam’s pay',
  'delivery-pay': 'Delivery pay',
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

function preferredObjectView(): boolean {
  try {
    return localStorage.getItem('repair-game.object-view') !== 'illustrated';
  } catch {
    return true;
  }
}

export default function App() {
  return (
    <StoryBootstrap
      render={(game, warning) => <PlayableStory initialGame={game} initialWarning={warning} />}
    />
  );
}
function PlayableStory({
  initialGame,
  initialWarning,
}: {
  initialGame: GameState;
  initialWarning?: string | null;
}) {
  const [game, setGame] = useState(initialGame);
  const [message, setMessage] = useState<string | null>(initialWarning ?? null);
  const [runtimeLoadFailed, setRuntimeLoadFailed] = useState(false);
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
  const [roomOpen, setRoomOpen] = useState(false);
  const [inHand, setInHand] = useState(preferredObjectView);
  useEffect(() => {
    try {
      localStorage.setItem('repair-game.object-view', inHand ? '3d' : 'illustrated');
    } catch {
      // A view preference remains usable when browser storage is unavailable.
    }
  }, [inHand]);
  const [repairSurface, setRepairSurface] = useState<{ id: string; ready: boolean } | null>(null);
  const benchRef = useRef<HTMLElement>(null);
  const cabinetRef = useRef<HTMLDetailsElement>(null);
  const [attention, setAttention] = useState<{
    lines: ConversationLine[];
    narration: string | null;
    revision: number;
    passage?: string;
    outcome?: OutcomeCeremony;
    returnedObject?: string;
  } | null>(null);
  const [previousEvidence, setPreviousEvidence] = useState<{
    id: string;
    observations: string[];
  } | null>(null);
  const [choiceGate] = useState(() => createChoiceGate(() => setSettling(false)));
  useEffect(() => () => choiceGate.cancel(), [choiceGate]);
  const journalToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!journal) return;
    function closeJournal(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setJournal(false);
        setConfirmReset(false);
        journalToggle.current?.focus({ preventScroll: true });
      }
    }
    window.addEventListener('keydown', closeJournal);
    return () => window.removeEventListener('keydown', closeJournal);
  }, [journal]);
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
  const focusId = view.focus?.id;
  const onRepairReady = useCallback(
    (ready: boolean) => {
      if (!focusId) return;
      setRepairSurface((prior) =>
        prior?.id === focusId && prior.ready === ready ? prior : { id: focusId, ready },
      );
    },
    [focusId],
  );
  const mappedActionIds = new Set(
    inHand && view.focus && repairSurface?.id === focusId && repairSurface?.ready === true
      ? getMappedRepairActions(view.focus, view.actions).map((binding) => binding.action.id)
      : [],
  );
  const workshop = getWorkshopView(game);
  const serviceWeek = getServiceWeekView(game);
  const chapter = projectChapter(view);
  const groups = projectActions(view, mappedActionIds);
  const dayPlans = groups.plans;
  const activePlans = dayPlans.filter(
    (entry) => entry.status !== 'kept' && (entry.status !== 'late' || entry.actions.length > 0),
  );
  const previousPlans = dayPlans.filter(
    (entry) => entry.status === 'kept' || (entry.status === 'late' && entry.actions.length === 0),
  );
  const urgentPlan =
    activePlans.find((entry) =>
      entry.actions.some((action) => action.id === 'wait-conversation-activity'),
    ) ??
    activePlans.find(
      (entry) => ['underway', 'late'].includes(entry.status) && entry.actions.length > 0,
    );
  const boardPlans = activePlans.filter((entry) => entry !== urgentPlan);
  const [selectedPanel, setSelectedPanel] = useState<WorkspacePanel | null>(null);
  const panel = selectedPanel ?? (view.focus || chapter.tutorial ? 'bench' : 'work');
  const [dismissedCeremonies, setDismissedCeremonies] = useState<string[]>([]);
  const latest = view.conversation.at(-1);
  const dialogue = attention?.lines ?? view.currentDialogue ?? (latest ? [latest] : []);
  const earlierNotices =
    dialogue.length > 1 &&
    dialogue.every((line) => line.speaker === 'You' && line.tone === 'notice')
      ? dialogue.slice(0, -1)
      : [];
  const visibleDialogue = earlierNotices.length ? dialogue.slice(-1) : dialogue;
  const narration = attention?.narration ?? null;
  const history = view.journal ?? view.conversation;
  const recordedObservations = [...new Set(view.focus?.observations ?? [])].filter(
    (observation) =>
      !dialogue.some((line) => line.text === observation) && observation !== narration,
  );
  function keep(next: GameState) {
    storyRevision.current++;
    setRuntimeLoadFailed(false);
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
      outcome: operationsCeremony(view, nextView, next.inputs.length) ?? undefined,
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
        input.type === 'action' && ['back-to-school', 'leave-school-holiday'].includes(input.id)
          ? nextView.lifeChapter?.label.includes('School finished')
            ? 'After the final school year'
            : 'A year later'
          : input.type === 'action' && input.id === 'service-quiet-week'
            ? 'After a quiet week'
            : undefined,
    });
    if (nextView.focus?.id !== view.focus?.id) setSelectedPanel(nextView.focus ? 'bench' : null);
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
    setRuntimeLoadFailed(false);
    setMessage('Opening your story…');
    try {
      // Let the status paint before synchronous replay occupies the main thread.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (revision !== storyRevision.current) return;
      const text = await file.text();
      if (revision !== storyRevision.current) return;
      const next = await restoreBrowserStory(text);
      if (revision !== storyRevision.current) return;
      keep(next);
      setJournal(false);
      setAttention(null);
      setSelectedPanel(null);
      setDismissedCeremonies([]);
      setDepartingObject(null);
      setPreviousEvidence(null);
    } catch (error) {
      if (revision !== storyRevision.current) return;
      setRuntimeLoadFailed(error instanceof HistoricalRuntimeLoadError);
      setMessage(
        error instanceof HistoricalRuntimeLoadError
          ? 'The saved-story runtime could not be loaded. Check your connection, reload this page, then open the file again. Your current story is unchanged.'
          : 'That story could not be replayed. Please choose an exported repair story. Your current story is unchanged.',
      );
    }
  }
  function renderAction(action: ActionView) {
    if (mappedActionIds.has(action.id)) return null;
    if (
      action.id === 'workshop-delay-evan-timer' &&
      view.actions.some((candidate) => candidate.id === 'workshop-return-unfixed-evan-timer')
    ) {
      action = {
        ...action,
        label: 'Ask Evan to leave the unsupported timer another day',
        detail:
          'The gear is missing and no compatible part is available here. Extra time alone will not make this repair possible.',
      };
    }
    return (
      <button
        type="button"
        data-choice="true"
        data-action-id={action.id}
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
        {action.detail && action.id !== 'wait-appointment' && <small>{action.detail}</small>}
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
          {narration && <p className="narration">{narration}</p>}
          {visibleDialogue.map((line) => (
            <div className="dialogue-line" key={line.id}>
              {!(line.speaker === 'You' && line.tone === 'notice') && (
                <span className="speaker">{line.speaker}</span>
              )}
              <p>{line.text}</p>
            </div>
          ))}
          {earlierNotices.length > 0 && (
            <details className="earlier-notices">
              <summary>Earlier in this moment · {earlierNotices.length}</summary>
              {earlierNotices.map((line) => (
                <p key={line.id}>{line.text}</p>
              ))}
            </details>
          )}
        </section>
      )}
    </div>
  );
  const ceremony =
    attention?.outcome ??
    (view.milestone
      ? {
          key: view.milestone.sourcekey,
          title: view.milestone.title,
          detail: view.milestone.detail,
          overline: view.milestone.sourcekey.startsWith('graduation:')
            ? 'A new chapter'
            : 'Something earned',
        }
      : attention?.passage
        ? {
            key: `passage:${attention.revision}`,
            title: attention.passage,
            detail: view.lifeChapter?.detail,
            overline: view.lifeChapter?.label ?? 'Time passes',
          }
        : attention?.returnedObject
          ? {
              key: `returned:${attention.revision}`,
              title: attention.returnedObject,
              detail: undefined,
              overline: 'Back with its owner',
            }
          : view.chapterClosure && !view.operations
            ? {
                key: view.chapterClosure.sourcekey,
                title: view.chapterClosure.title,
                detail: view.chapterClosure.detail,
                overline: 'A chapter you made your own',
              }
            : null);
  const ceremonyOpen = ceremony && !dismissedCeremonies.includes(ceremony.key);
  const selectPanel = (next: WorkspacePanel) => {
    setSelectedPanel(next);
    setRoomOpen(false);
  };
  const focusBench = () => {
    selectPanel('bench');
    requestAnimationFrame(() =>
      benchRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }),
    );
  };
  return (
    <main className={`story workspace-shell phase-${chapter.stage} scene-${view.scene}`}>
      <header className="masthead workspace-masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            a.
          </span>
          <div>
            <span className="brand-name">A little light</span>
            {chapter.period !== view.timeLabel && (
              <span className="brand-period">{chapter.period}</span>
            )}
          </div>
        </div>
        <div className="header-tools">
          {view.timeLabel && <span className="time workspace-clock">{view.timeLabel}</span>}
          {workshop?.notebook && (
            <span className="header-cash">
              <small>Cash</small>
              <strong>{workshop.notebook.cash}</strong>
            </span>
          )}
          <button
            type="button"
            className="journal-toggle"
            ref={journalToggle}
            onClick={() => {
              setJournal(!journal);
              setConfirmReset(false);
            }}
            aria-expanded={journal}
            aria-controls="journal"
          >
            {journal ? 'Close journal' : 'Journal'}
          </button>
        </div>
      </header>
      {journal && (
        <section id="journal" className="journal" aria-label="Story journal">
          <h2>Your story</h2>
          <p className="journal-note">The conversations and small discoveries you have kept.</p>
          <p className="journal-note">
            <a href="/third-party-notices.txt" target="_blank" rel="noreferrer">
              Third-party notices
            </a>
          </p>
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
                  setSelectedPanel(null);
                  setDismissedCeremonies([]);
                  setRoomOpen(false);
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
          {runtimeLoadFailed && (
            <button type="button" onClick={() => window.location.reload()}>
              Reload story code
            </button>
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
        <div className="chapter-heading">
          <div>
            <span className="card-overline">
              {chapter.tutorial
                ? 'School holidays'
                : chapter.stage === 'service'
                  ? 'A working life'
                  : 'After school'}
            </span>
            <h1>{chapter.title}</h1>
          </div>
          <button
            type="button"
            className="room-toggle"
            aria-expanded={roomOpen}
            onClick={() => setRoomOpen(!roomOpen)}
          >
            {roomOpen ? 'Close room' : 'Look around'} <span aria-hidden="true">↗</span>
          </button>
        </div>
        <WorkspaceNavigation
          chapter={chapter}
          selected={panel}
          onSelect={selectPanel}
          visiblePanels={
            chapter.tutorial
              ? [
                  'bench',
                  ...(view.shelf.length || boardPlans.length ? ['work' as const] : []),
                  ...(groups.people.length || view.whereabouts?.length ? ['people' as const] : []),
                ]
              : ['bench', 'work', 'people']
          }
          counts={{
            bench: groups.bench.length,
            work: groups.work.length + boardPlans.filter((entry) => entry.actions.length).length,
            people: groups.people.length,
          }}
        />
        {roomOpen && (
          <section className="room-stage" aria-label="Look around your workspace">
            <Suspense fallback={<p className="bench-note">Opening the room…</p>}>
              <WorkshopScene3D
                view={view}
                disabled={settling}
                onInput={(input) => {
                  restoreChoiceFocus.current = true;
                  act(input);
                  focusBench();
                }}
                onFocus={focusBench}
                onWorkboard={() => selectPanel('work')}
                onPeople={() => selectPanel('people')}
                onCabinetFocus={() => {
                  focusBench();
                  requestAnimationFrame(() => {
                    const details = cabinetRef.current;
                    if (details) {
                      details.open = true;
                      details.querySelector('summary')?.focus({ preventScroll: true });
                      details.scrollIntoView({ block: 'start', behavior: 'instant' });
                    }
                  });
                }}
                onOpenJournal={() => {
                  setJournal(true);
                  setConfirmReset(false);
                }}
              />
            </Suspense>
          </section>
        )}
        <div className="workspace-body" hidden={roomOpen}>
          {ceremonyOpen && (
            <ChapterCeremony
              title={ceremony.title}
              detail={ceremony.detail}
              overline={ceremony.overline}
              onContinue={() => {
                setDismissedCeremonies((prior) => [...prior, ceremony.key]);
                requestAnimationFrame(() => {
                  document
                    .getElementById(`workspace-${panel}`)
                    ?.querySelector<HTMLButtonElement>('button:not([disabled])')
                    ?.focus({ preventScroll: true });
                });
              }}
            >
              {response}
            </ChapterCeremony>
          )}
          <div hidden={Boolean(ceremonyOpen)}>
            <div className="current-moment">
              {response}
              {urgentPlan && (
                <section className="attention-task" aria-label="Current work needs you">
                  <span className="card-overline">
                    {urgentPlan.actions.some((action) => action.id === 'wait-conversation-activity')
                      ? 'Before you continue'
                      : 'Current work'}
                  </span>
                  <h2>{urgentPlan.label}</h2>
                  <p>{urgentPlan.detail}</p>
                  <div className="choice-buttons">{urgentPlan.actions.map(renderAction)}</div>
                </section>
              )}
            </div>
            <section
              id="workspace-bench"
              className="workspace-panel"
              hidden={panel !== 'bench'}
              aria-label={chapter.tutorial ? 'At home' : 'Workbench'}
            >
              <div className={`bench-layout ${!view.focus ? 'empty-bench-layout' : ''}`}>
                <div className="bench-stage">
                  {view.focus && (
                    <section
                      ref={benchRef}
                      className={`workbench ${attention?.returnedObject ? 'next-object' : ''}`}
                      aria-label={view.focus.title}
                    >
                      <ObjectPresentation
                        key={view.focus.id}
                        object={view.focus}
                        inHand={inHand}
                        onViewChange={setInHand}
                        actions={view.actions}
                        disabled={settling}
                        onAction={(id) => act({ type: 'action', id })}
                        onReady={onRepairReady}
                      />
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
                                  (observation) =>
                                    !previousEvidence.observations.includes(observation),
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
                  {!view.focus && (
                    <section className="empty-bench">
                      <span className="bench-outline" aria-hidden="true">
                        ⌁
                      </span>
                      <h2>{view.title}</h2>
                      <p>{view.subtitle}</p>
                      {view.note && <p className="bench-note">{view.note}</p>}
                      {!chapter.tutorial && (
                        <button type="button" onClick={() => selectPanel('work')}>
                          See work & promises <span aria-hidden="true">→</span>
                        </button>
                      )}
                    </section>
                  )}
                </div>
                <aside className="bench-decisions">
                  <ActionLane
                    title={view.focus ? 'At this bench' : 'Begin here'}
                    actions={groups.bench.filter(
                      (action) =>
                        !(
                          workshop?.cabinet?.open &&
                          /^workshop-(cabinet|drawings|display-drawing|keep-drawing)/.test(
                            action.id,
                          ) &&
                          action.id !== 'workshop-cabinet-close'
                        ),
                    )}
                    renderAction={renderAction}
                  />
                  {chapter.tutorial && (
                    <ActionLane
                      title="Around the house"
                      actions={groups.work}
                      renderAction={renderAction}
                    />
                  )}
                  {view.parts.length > 0 && (
                    <section className="parts-well">
                      <h2>Parts at hand</h2>
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
                  {view.focus && (
                    <p className="bench-quiet-note">
                      Your observations stay with this object when you put it aside.
                    </p>
                  )}
                </aside>
              </div>
              {workshop?.cabinet?.open && (
                <details
                  ref={cabinetRef}
                  className="cabinet-at-side"
                  open={!view.focus && !game.apprentice?.jobId}
                >
                  <summary>
                    Dad’s cabinet doors · {cabinetStageLabels[workshop.cabinet.stage]}
                  </summary>
                  <section className="family-project" aria-label="Dad’s cabinet project">
                    <Cabinet
                      stage={workshop.cabinet.stage}
                      drawing={workshop.cabinet.drawingDisplayed}
                    />
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
                  <div className="choice-buttons project-choices">
                    {groups.bench
                      .filter(
                        (action) =>
                          /^workshop-(cabinet|drawings|display-drawing|keep-drawing)/.test(
                            action.id,
                          ) && action.id !== 'workshop-cabinet-close',
                      )
                      .map(renderAction)}
                  </div>
                </details>
              )}
            </section>
            <section
              id="workspace-work"
              className="workspace-panel"
              hidden={panel !== 'work'}
              aria-label={chapter.tutorial ? 'Kept things' : 'Work and promises'}
            >
              <div className="panel-heading">
                <div>
                  <span className="card-overline">
                    {chapter.tutorial ? 'Nothing lost' : 'Your workboard'}
                  </span>
                  <h2>{chapter.tutorial ? 'Things worth keeping' : 'Work & promises'}</h2>
                </div>
                <span className="panel-caption">
                  {chapter.tutorial
                    ? 'Unfinished work can wait.'
                    : 'One place for the work you have agreed.'}
                </span>
              </div>
              {serviceWeek && !view.chapterClosure && (
                <section className="chapter-strip">
                  <h3>{serviceWeek.label}</h3>
                  <p>{serviceWeek.detail}</p>
                </section>
              )}
              {view.operations && (
                <OperationsBoard
                  operations={view.operations}
                  actions={groups.work.filter((action) => action.id.startsWith('operations-'))}
                  renderAction={renderAction}
                />
              )}
              {!chapter.tutorial && (
                <ActionLane
                  title="Next decisions"
                  actions={groups.work.filter(
                    (action) => !view.operations || !action.id.startsWith('operations-'),
                  )}
                  renderAction={renderAction}
                />
              )}
              <PromiseCards entries={boardPlans} renderAction={renderAction} />
              {dayPlans.length === 0 &&
                (Boolean(view.collectionPlans?.length) ||
                  Boolean(view.knownAppointments?.length)) && (
                  <section className="promise-grid" aria-label="Known visits and collections">
                    {view.collectionPlans?.map((plan) => (
                      <article className="promise-card" key={plan.objectId}>
                        <span className="card-overline">Collection</span>
                        <h3>{plan.title}</h3>
                        <p>{plan.detail}</p>
                      </article>
                    ))}
                    {view.knownAppointments
                      ?.filter(
                        (appointment) =>
                          !view.collectionPlans?.some(
                            (plan) => plan.owner.toLowerCase() === appointment.name.toLowerCase(),
                          ),
                      )
                      .map((appointment) => (
                        <article className="promise-card" key={appointment.personId}>
                          <span className="card-overline">Known availability</span>
                          <h3>{appointment.name}</h3>
                          <p>{appointment.detail}</p>
                        </article>
                      ))}
                  </section>
                )}

              <section className="kept-work">
                <h2>
                  {chapter.tutorial ? 'The waiting shelf' : 'Waiting work & personal projects'}
                </h2>
                {view.shelf.length > 0 ? (
                  <div className="shelf work-shelf">
                    {view.shelf.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        disabled={settling}
                        onClick={() => {
                          act({ type: 'select', id: item.id });
                          selectPanel('bench');
                        }}
                      >
                        <span className="shelf-object-mark" aria-hidden="true">
                          ◇
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.note}</small>
                        </span>
                        <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-note">Nothing is put aside here.</p>
                )}
              </section>
              {workshop?.jobs && workshop.jobs.length > 0 && (
                <section className="recorded-work">
                  <h2>Agreed work</h2>
                  <div className="job-grid">
                    {workshop.jobs.map((job) => (
                      <article key={job.id}>
                        <span className="card-overline">
                          {job.stage === 'quoted'
                            ? 'Discussed · not accepted'
                            : 'Recorded agreement'}
                        </span>
                        <h3>{job.title}</h3>
                        <p>{job.note}</p>
                        <small>{job.quote}</small>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {workshop?.notebook && (
                <details className="cash-notebook">
                  <summary>Cash notebook · {workshop.notebook.cash}</summary>
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
                </details>
              )}
              {view.chapterClosure && (
                <details className="chapter-record">
                  <summary>{view.chapterClosure.title}</summary>
                  <p>{view.chapterClosure.detail}</p>
                  <ul>
                    {view.chapterClosure.outcomes.map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                </details>
              )}
              {previousPlans.length > 0 && (
                <details className="past-promises">
                  <summary>Previous arrangements</summary>
                  <PromiseCards entries={previousPlans} renderAction={renderAction} />
                </details>
              )}
            </section>
            <section
              id="workspace-people"
              className="workspace-panel"
              hidden={panel !== 'people'}
              aria-label="People"
            >
              <div className="panel-heading">
                <div>
                  <span className="card-overline">Their own lives, too</span>
                  <h2>People around you</h2>
                </div>
              </div>
              {view.apprenticeship && !dayPlans.some((entry) => entry.id === 'sam-work') && (
                <article className="person-card apprentice-card">
                  <span className="card-overline">At the bench</span>
                  <h3>{view.apprenticeship.name}</h3>
                  <p>{view.apprenticeship.activity}</p>
                  <p>{view.apprenticeship.responsibility}</p>
                </article>
              )}
              {view.whereabouts && (
                <div className="people-grid">
                  {view.whereabouts
                    .filter((person) => !(person.id === 'sam' && view.apprenticeship))
                    .map((person) => (
                      <article className="person-card" key={person.id}>
                        <span className="person-initial" aria-hidden="true">
                          {person.name.charAt(0)}
                        </span>
                        <div>
                          <h3>{person.name}</h3>
                          <p>{person.activity}</p>
                        </div>
                      </article>
                    ))}
                </div>
              )}
              <ActionLane
                title="Conversations & shared work"
                actions={groups.people}
                renderAction={renderAction}
              />
              {groups.people.length === 0 && (
                <p className="empty-note">
                  There is no new conversation offered just now. Known arrangements are on your
                  workboard.
                </p>
              )}
            </section>
            <section className="time-bar" aria-label="Take some time">
              <div>
                <span className="card-overline">Time moves with your choices</span>
                {view.lifeChapter?.detail && <p>{view.lifeChapter.detail}</p>}
              </div>
              <div className="choice-buttons">{groups.time.map(renderAction)}</div>
            </section>
          </div>
        </div>
      </div>
      <footer>
        <span>A little light</span>
        <span>Keep what matters.</span>
      </footer>
    </main>
  );
}
