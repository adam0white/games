import { useEffect, useRef, useState } from 'react';
import { CastOutcomes } from './components/CastOutcomes';
import { CommunityPanel } from './components/CommunityPanel';
import { CommunityScene } from './components/CommunityScene';
import { FirstRepairGuide } from './components/FirstRepairGuide';
import { LessonControl } from './components/LessonControl';
import { MethodResponse } from './components/MethodResponse';
import { ObjectOwnerExchange } from './components/ObjectOwnerExchange';
import { PersonalReply } from './components/PersonalReply';
import { PhysicalObjectScene } from './components/PhysicalObjectScene';
import { ReadingComparison } from './components/ReadingComparison';
import { RecentConversation } from './components/RecentConversation';
import { ReturnedHistory } from './components/ReturnedHistory';
import { ReturnReceipt } from './components/ReturnReceipt';
import { SamRequest } from './components/SamRequest';
import { SamWorkAccount } from './components/SamWorkAccount';
import { SendWord } from './components/SendWord';
import { TeachingRecord } from './components/TeachingRecord';
import { TheatrePerformance } from './components/TheatrePerformance';
import { WorkshopTally } from './components/WorkshopTally';
import { continuity, LOCAL_KEY, OUTCOME_LOCAL_KEY } from './continuity';
import { admissionFacts } from './game/cast';
import { accountParts, type PersonalRole, personalReplies } from './game/cast-content';
import {
  canStartBusyWorkshop,
  createGame,
  dayTime,
  dispatch,
  jobReadiness,
  PART_PRICES,
  requiredChecks,
  saveGame,
  UPGRADE_CATALOG,
} from './game/engine';
import { evidenceContext } from './game/evidence-context';
import { governorMultipliers } from './game/model';
import { describePerson, playerWordReading } from './game/people';
import { replayRecordedRun } from './game/replay';
import { stockCount } from './game/stock';
import type {
  Command,
  ComponentKind,
  GameState,
  Job,
  MeterMode,
  TestCondition,
} from './game/types';
import { lab } from './lab';
import { todaysWords, workshopCrises } from './ui/crises';
import { firstRepairProgress } from './ui/first-repair';
import { partSupplyDetail, partSupplyTarget } from './ui/part-supply';
import {
  actionAccount,
  componentWorkReading,
  latestRecoveryAccount,
  ownerPromiseAccount,
} from './ui/workshop-feedback';
import { readFreshWorkshopSave, readWorkshopSave, SOURCE_JOURNAL_KEY } from './workshop-storage';
import './styles.css';
import './focused-layout.css';
import './meter-layout.css';
import './clarity.css';
import './workshop-shell.css';
import './simplify.css';

import { readingUnit, testWords } from './game/test-words';
import { damagedWorkshopMessage, workshopStartError } from './ui/start-error';

const SAVE_KEY = LOCAL_KEY;
const conditions: TestCondition[] = ['bench', 'movement', 'load'];
const money = (n: number) => `£${n.toFixed(0)}`;
function checkPurpose(job: Job): string {
  const required = requiredChecks(job);
  if (job.kind === 'lantern')
    return required.includes('movement')
      ? 'Check that the light stays on while it is carried.'
      : 'Check that the light stays bright while its owner reads.';
  if (job.kind === 'fan') return 'Check that the fan blows strongly with its filter fitted.';
  return `Check that the drive turns at the owner’s requested ${job.model.desiredRPM ?? 15} ± ${job.model.tolerance ?? 3} turns per minute while working harder.`;
}
function samFinishedPersonal(job: Job): boolean {
  if (!job.isPersonal || job.completedBy !== 'sam') return false;
  const completion = job.contributions.findLast(
    (c) => c.actorId === 'sam' && c.action === 'complete-project',
  );
  const lastWork = job.evidence.findLast((e) => e.kind === 'work')?.at ?? 0;
  return Boolean(completion && completion.at >= lastWork);
}
function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
let initialLoadFailed = false;
function initial(): GameState {
  try {
    const saved = readWorkshopSave(SAVE_KEY);
    if (saved) return continuity.loadLocal(saved);
  } catch {
    initialLoadFailed = true;
    /* A damaged save is replaced only after explicit New game confirmation. */
  }
  return createGame(freshSeed());
}
function Device({
  job,
  selected,
  onSelect,
  probeA,
  probeB,
  condition,
  collarPreview,
  suggestedTerminal,
  suggestedPart,
}: {
  probeA: string;
  probeB: string;
  condition: TestCondition;
  collarPreview?: number;
  suggestedTerminal?: string;
  suggestedPart?: string;
  job: Job;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const lastUse = [...job.evidence].reverse().find((e) => e.kind === 'use');
  const observed = lastUse?.summary.match(
    /(?:reaches |at )(\d+(?:\.\d+)?)(%| (?:rpm|turns per minute))/,
  );
  const output = observed ? Number(observed[1]) : 0;
  return (
    <div className={`device-stage ${job.kind}`}>
      <svg viewBox="0 0 620 400" role="img" aria-label={`Parts in ${job.title}`}>
        <defs>
          <pattern id="bench-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth=".5" />
          </pattern>
          <linearGradient id="glass" x2="1" y2="1">
            <stop stopColor="#82958d" stopOpacity=".16" />
            <stop offset="1" stopColor="#c4be9c" stopOpacity=".03" />
          </linearGradient>
        </defs>
        <rect width="620" height="400" fill="url(#bench-grid)" opacity=".3" />
        {job.kind === 'lantern' && observed && (
          <g className="observed-light" opacity={Math.max(0, Math.min(1, output / 100))}>
            <ellipse cx="310" cy="195" rx="76" ry="105" fill="#dfbc76" opacity=".12" />
            <ellipse cx="310" cy="195" rx="33" ry="63" fill="#f1d9a0" opacity=".3" />
          </g>
        )}
        {job.kind === 'fan' && output > 0 && (
          <g
            className="observed-fan"
            style={{ animationDuration: `${Math.max(0.8, 7 - output / 20)}s` }}
          >
            <path
              d="M310 169 Q263 93 285 77 Q321 59 310 169 Q396 160 402 188 Q391 224 310 169 Q283 259 255 247 Q224 215 310 169"
              fill="#9dad80"
              opacity=".26"
            />
          </g>
        )}
        {job.kind === 'music-box' && !job.isPersonal && job.ownerId !== 'sam' && output > 0 && (
          <g className="observed-melody">
            <text x="370" y="80" fill="#c9c5a1" fontSize="26">
              ♫
            </text>
            <text x="410" y="62" fill="#c9c5a1" fontSize="17">
              ♪
            </text>
          </g>
        )}
        {job.kind === 'music-box' && (job.isPersonal || job.ownerId === 'sam') && output > 0 && (
          <g className="observed-figures">
            <circle cx="310" cy="110" r="9" fill="#cfc7a4" />
            <path
              d="M310 120 L294 158 H326 Z M298 127 L281 138 M322 127 L340 136 M301 157 L294 179 M319 157 L328 179"
              stroke="#cfc7a4"
              strokeWidth="4"
              fill="#8da080"
            />
            <circle cx="355" cy="134" r="6" fill="#bdc6a1" />
            <path d="M355 143 L343 165 H367 Z" fill="#bdc6a1" />
          </g>
        )}
        {job.kind === 'lantern' ? (
          <g className="silhouette">
            <path d="M242 76 C242 8 378 8 378 76" fill="none" strokeWidth="12" />
            <path d="M216 85 L404 85 L424 309 L196 309 Z" fill="url(#glass)" />
            <path d="M220 85 H400 M199 310 H421 M213 333 H407" strokeWidth="18" />
            <path d="M237 97 L222 300 M383 97 L398 300" strokeWidth="8" />
          </g>
        ) : job.kind === 'fan' ? (
          <g className="silhouette">
            <circle cx="310" cy="169" r="126" fill="url(#glass)" />
            <circle cx="310" cy="169" r="112" fill="none" />
            <path
              d="M310 49 V289 M190 169 H430 M225 84 L395 254 M225 254 L395 84 M293 295 V329 H236 V347 H384 V329 H327 V295"
              fill="none"
            />
          </g>
        ) : job.isPersonal ? (
          <g className="silhouette">
            <rect x="184" y="64" width="252" height="271" fill="url(#glass)" />
            <path
              d="M184 64 Q221 130 210 243 L184 243 Z M436 64 Q399 130 411 243 L436 243 Z"
              fill="#716954"
              opacity=".3"
            />
            <path d="M184 76 H436 M184 335 H436" strokeWidth="10" />
          </g>
        ) : (
          <g className="silhouette">
            <path d="M154 125 L310 66 L466 125 L466 296 L310 351 L154 296 Z" fill="url(#glass)" />
            <path d="M154 125 L310 181 L466 125 M310 181 V351" fill="none" />
            <path d="M466 225 H506 V250 H527" fill="none" strokeWidth="8" />
          </g>
        )}
        {[
          { terminal: probeA, color: '#e3a086', label: 'A', origin: 42 },
          { terminal: probeB, color: '#17201a', label: 'B', origin: 578 },
        ]
          .filter((probe) => probe.terminal)
          .map((probe) => {
            const target = job.model.components.find((c) => c.terminals.includes(probe.terminal));
            if (!target) return null;
            const x = target.x * 6 + (target.terminals[0] === probe.terminal ? -35 : 35);
            const y = target.y * 4;
            return (
              <g
                key={probe.label}
                className={probe.label === 'B' ? 'probe-lead black-lead' : 'probe-lead'}
              >
                <path
                  d={`M${probe.origin} 355 Q${probe.origin} ${y + 55} ${x} ${y + 12}`}
                  fill="none"
                  stroke={probe.color}
                  strokeWidth="3"
                />
                <path
                  d={`M${x - 3} ${y + 22} V${y + 8} L${x} ${y} L${x + 3} ${y + 8} V${y + 22}`}
                  fill={probe.color}
                />
                <text x={probe.origin} y="373" textAnchor="middle" fill={probe.color} fontSize="9">
                  PROBE {probe.label}
                </text>
              </g>
            );
          })}
        {job.model.components.map((c, i) => {
          const next = job.model.components[(i + 1) % job.model.components.length];
          if (!next || (job.kind === 'music-box' && i === job.model.components.length - 1))
            return null;
          return (
            <path
              key={`wire-${c.id}`}
              d={
                i === job.model.components.length - 1
                  ? `M${c.x * 6 + 35} ${c.y * 4} H555 V335 H65 V${next.y * 4} H${next.x * 6 - 35}`
                  : `M${c.x * 6 + 35} ${c.y * 4} H${(c.x * 6 + next.x * 6) / 2} V${next.y * 4} H${next.x * 6 - 35}`
              }
              fill="none"
              className="wire"
            />
          );
        })}
        {job.model.components.map((c) => {
          const x = c.x * 6;
          const y = c.y * 4;
          const work = componentWorkReading(job, c.id);
          return (
            // biome-ignore lint/a11y/useSemanticElements: SVG selection has a native component chip equivalent.
            <g
              key={c.id}
              transform={`translate(${x},${y})`}
              className={`${selected === c.id ? 'component selected' : 'component'} ${suggestedPart === c.id ? 'guide-component' : ''} ${work ? `worked-${work.kind}` : ''}`}
              data-work={work?.kind}
              role="button"
              tabIndex={0}
              aria-label={`Select ${c.label}`}
              onClick={() => onSelect(c.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(c.id);
                }
              }}
            >
              <rect
                x="-60"
                y="-60"
                width="120"
                height="120"
                style={{ fill: 'transparent', stroke: 'none' }}
              />
              <path d="M-35 0 H35" />
              <rect x="-29" y="-21" width="58" height="42" rx="5" />

              {c.terminals.map((terminal, terminalIndex) => (
                <g
                  key={terminal}
                  className={
                    terminal === suggestedTerminal
                      ? 'terminal-hit suggested-terminal'
                      : 'terminal-hit'
                  }
                >
                  {terminal === suggestedTerminal && (
                    <circle
                      className="probe-hint-ring"
                      cx={terminalIndex === 0 ? -35 : 35}
                      r="14"
                    />
                  )}
                  <circle
                    cx={terminalIndex === 0 ? -35 : 35}
                    r="22"
                    className="terminal-hit-area"
                  />
                  <circle
                    cx={terminalIndex === 0 ? -35 : 35}
                    r={probeA === terminal || probeB === terminal ? 7 : 3}
                    className={
                      probeA === terminal
                        ? 'placed-probe-a'
                        : probeB === terminal
                          ? 'placed-probe-b'
                          : ''
                    }
                  />
                  {(probeA === terminal || probeB === terminal) && (
                    <text x={terminalIndex === 0 ? -47 : 47} y="17" className="probe-diagram-label">
                      {probeA === terminal ? 'A' : ''}
                      {probeB === terminal ? 'B' : ''}
                    </text>
                  )}
                </g>
              ))}
              <text x="-36" y="-12" className="terminal-label">
                {c.terminals[0]}
              </text>
              <text x="36" y="-12" className="terminal-label">
                {c.terminals[1]}
              </text>
              <text y="5" textAnchor="middle">
                {c.kind === 'governor'
                  ? selected === c.id && collarPreview !== undefined
                    ? collarPreview
                    : (c.setting ?? '•')
                  : c.kind === 'cell'
                    ? '+ −'
                    : c.kind === 'bulb'
                      ? '×'
                      : c.kind === 'switch'
                        ? '/ '
                        : c.kind === 'motor'
                          ? 'M'
                          : c.kind === 'gear'
                            ? '⚙'
                            : c.kind === 'spring'
                              ? '∿'
                              : '•'}
              </text>
              {work && (
                <g className="component-work-mark">
                  <path
                    d={
                      work.kind === 'replace'
                        ? 'M-20-8h40v16h-40z'
                        : 'M-17-8v16m34-16v16M-9-4h18M-9 4h18'
                    }
                  />
                </g>
              )}
              <text y="42" textAnchor="middle" className="diagram-label">
                {c.label}
              </text>
            </g>
          );
        })}
        <text x="20" y="24" className="diagram-caption">
          {`PARTS · TEST ${testWords[condition].toUpperCase()}`}
        </text>
      </svg>
      <div className="alternative-parts">
        <div className="component-picker">
          {job.model.components.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={selected === c.id}
              onClick={() => onSelect(c.id)}
            >
              {c.label}
              <span>{c.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
export default function App() {
  const [fileState, setFileState] = useState<{ state: GameState; selection: number } | null>(null);
  const fileSelection = useRef(0);
  useEffect(() => {
    if (!continuity.fileSession) return;
    const invalidateSelection = () => {
      ++fileSelection.current;
      ++continuity.generation;
    };
    window.addEventListener('pagehide', invalidateSelection);
    window.addEventListener('popstate', invalidateSelection);
    return () => {
      window.removeEventListener('pagehide', invalidateSelection);
      window.removeEventListener('popstate', invalidateSelection);
      invalidateSelection();
    };
  }, []);
  const [fileError, setFileError] = useState('');
  if (!continuity.fileSession) return <Workshop />;
  if (fileState)
    return (
      <Workshop
        key={fileState.selection}
        fileState={fileState.state}
        onCloseFile={async () => {
          ++fileSelection.current;
          ++continuity.generation;
          await continuity.depart();
          continuity.closeFile();
          setFileState(null);
        }}
      />
    );
  return (
    <main className="title-page">
      <h1>Small Works</h1>
      <p>
        Open a complete workshop file. Progress stays in this tab. Download the file to keep it.
        Your browser’s saved workshop and shared character histories are not opened or replaced.
      </p>
      <label>
        Open a workshop file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (event) => {
            const selection = ++fileSelection.current;
            ++continuity.generation;
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            try {
              const text = await file.text();
              if (selection !== fileSelection.current) return;
              const state = await continuity.importFile(text);
              if (selection !== fileSelection.current) return;
              setFileError('');
              setFileState({ state, selection });
            } catch (error) {
              if (selection !== fileSelection.current) return;
              setFileError(error instanceof Error ? error.message : 'The file could not open.');
            }
          }}
        />
      </label>
      {fileError && <p role="alert">{fileError}</p>}
    </main>
  );
}
function Workshop({
  fileState,
  onCloseFile,
}: {
  fileState?: GameState;
  onCloseFile?: () => Promise<void>;
}) {
  const [state, setState] = useState(() => fileState ?? initial());
  const [, refreshContinuity] = useState(0);
  const [entering, setEntering] = useState(false);
  const [debugError, setDebugError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [entryError, setEntryError] = useState(() =>
    initialLoadFailed ? damagedWorkshopMessage : '',
  );
  const [eventsOn, setEventsOn] = useState(lab.telemetryOn);
  useEffect(() => {
    lab.screen('play');
    lab.milestone('run started');
    const sync = () => setEventsOn(lab.telemetryOn);
    window.addEventListener('hf-lab-preference', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('change', sync);
    return () => {
      window.removeEventListener('hf-lab-preference', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('change', sync);
    };
  }, []);
  const [conversationSession, setConversationSession] = useState(0);
  const [view, setView] = useState('bench');
  const [supplyTarget, setSupplyTarget] = useState<string | undefined>();
  useEffect(() => {
    if (view !== 'people' || !supplyTarget) return;
    const drawer = document.getElementById(supplyTarget);
    drawer?.scrollIntoView({ block: 'center' });
    drawer?.focus({ preventScroll: true });
    setSupplyTarget(undefined);
  }, [view, supplyTarget]);
  const [screen, setScreen] = useState<'title' | 'play' | 'feedback'>('title');
  const [feedbackSession, setFeedbackSession] = useState(0);
  const openFeedback = () => {
    setFeedbackSession((session) => session + 1);
    setScreen('feedback');
  };
  const [sheet, setSheet] = useState<'menu' | 'day' | 'job' | 'job-actions' | 'history' | null>(
    null,
  );
  const [actionJobId, setActionJobId] = useState('');
  const sheetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const modal = sheetRef.current;
    if (!sheet || !modal) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = Array.from(modal.parentElement?.parentElement?.children ?? []).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && !element.contains(modal),
    );
    const wasInert = background.map((element) => element.inert);
    for (const element of background) element.inert = true;
    const controls = () =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), summary, textarea, [tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const available = controls();
      const first = available[0];
      const last = available.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    modal.addEventListener('keydown', trap);
    return () => {
      modal.removeEventListener('keydown', trap);
      background.forEach((element, index) => {
        element.inert = wasInert[index] ?? false;
      });
      if (previous?.isConnected) previous.focus();
    };
  }, [sheet]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [newConfirmed, setNewConfirmed] = useState(false);
  const [seedText, setSeedText] = useState(String(state.seed + 1));
  const [hasSave, setHasSave] = useState(
    () => continuity.fileSession || Boolean(readWorkshopSave(SAVE_KEY)),
  );
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInfoOpen(false);
        setSheet(null);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const [pane, setPane] = useState<'object' | 'meter' | 'repair' | 'notes'>('object');
  const [opened, setOpened] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const openReference = () => {
    setReferenceOpen(true);
    setPane('notes');
    requestAnimationFrame(() => {
      const entry = document.getElementById('bench-reference');
      entry?.focus();
      entry?.scrollIntoView({ block: 'nearest' });
    });
  };
  const [replacementSource, setReplacementSource] = useState<'new' | 'recovered' | undefined>();
  const [introSkipped, setIntroSkipped] = useState(
    () =>
      !continuity.fileSession &&
      localStorage.getItem(`small-works-canonical-intro-${state.seed}`) === 'skipped',
  );
  const progress = firstRepairProgress(state);
  const guided = !introSkipped && !progress.workshopAvailable;
  const skipIntro = () => {
    if (!continuity.fileSession)
      localStorage.setItem(`small-works-canonical-intro-${state.seed}`, 'skipped');
    setIntroSkipped(true);
  };

  const [replayChecking, setReplayChecking] = useState(false);
  const [replayStatus, setReplayStatus] = useState('');
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(
    () =>
      continuity.bind(
        () => stateRef.current,
        () => refreshContinuity((n) => n + 1),
        (next) => {
          stateRef.current = next;
          setState(next);
        },
      ),
    [],
  );
  useEffect(() => {
    const stop = lab.trackRun(
      () => {
        // The first autosave can precede the shared identity bridge. Recapture
        // the actual stored save after identity settles, without blocking runs.
        try {
          const saved = !continuity.fileSession && readWorkshopSave(SAVE_KEY);
          if (saved) lab.captureSave(JSON.parse(saveGame(stateRef.current)));
        } catch {}
        return JSON.parse(saveGame(stateRef.current));
      },
      {
        runKey: () => stateRef.current.seed,
        getLogs: () => stateRef.current.log.slice(-40).map((line) => line.text),
      },
    );
    return () => {
      stop();
    };
  }, []);
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<MeterMode>('voltage');
  const [condition, setCondition] = useState<TestCondition>('bench');
  const [useCondition, setUseCondition] = useState<TestCondition>('movement');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [activeProbe, setActiveProbe] = useState<'a' | 'b'>('a');
  const [status, setStatus] = useState('');
  const [teachingFeedback, setTeachingFeedback] = useState('');
  const [collarPreview, setCollarPreview] = useState<number | undefined>(undefined);
  const job = state.jobs.find((j) => j.id === state.selectedJobId) ?? state.jobs[0];
  const jobLocked = Boolean(
    job &&
      (!['active', 'ready'].includes(job.status) ||
        job.assignedTo ||
        state.community?.reservedJobIds.includes(job.id) ||
        (state.pendingRequest?.kind === 'repair' && state.pendingRequest.jobId === job.id)),
  );
  const lastReading = [...(job?.evidence ?? [])].reverse().find((e) => e.kind === 'measurement');
  const readingId = lastReading?.id;
  const meterPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Placing probes can scroll the reading out of the phone's short tool panel.
    // Show the new result without moving keyboard focus away from Read meter.
    if (pane === 'meter' && readingId !== undefined) meterPanel.current?.scrollTo({ top: 0 });
  }, [pane, readingId]);
  const part = job?.model.components.find((c) => c.id === selected);
  const lastWorkId = job?.evidence.findLast((e) => e.kind === 'work')?.id ?? 0;
  const samBaseline =
    job?.evidence.filter((e) => e.id > lastWorkId && e.witnessedBy?.includes('sam')) ?? [];
  const hasComponentBaseline = Boolean(
    part &&
      samBaseline.some(
        (e) => e.kind === 'use' || (e.kind === 'measurement' && e.componentId === part.id),
      ),
  );
  const hasCalibrationBaseline =
    part?.kind === 'governor' &&
    samBaseline.some((e) => e.kind === 'measurement' && e.request?.mode === 'motion');
  const hasPendingPartLesson = Boolean(
    part &&
      job?.pendingLessons.some(
        (lesson) => lesson.observerId === 'sam' && lesson.action.split(':')[1] === part.id,
      ),
  );
  const terminals = [...new Set(job?.model.components.flatMap((c) => c.terminals) ?? [])];
  useEffect(() => {
    if (!continuity.isStarted) return;
    if (continuity.recordAfterStart) {
      continuity.recordAfterStart = false;
      void continuity.recording(false).catch((error) => {
        continuity.status = String(error);
        refreshContinuity((n) => n + 1);
      });
    }
    let current = true;
    void continuity.persist(state).then(
      () => {
        if (current) setSaveError('');
      },
      (error) => {
        if (!current) return;
        setSaveError('This workshop could not be saved. Download a copy before leaving.');
        setDebugError(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      current = false;
    };
  }, [state]);
  useEffect(() => {
    if (!job?.id) return;
    setSelected('');
    setCollarPreview(undefined);
    setA('');
    setB('');
    const current = stateRef.current.jobs.find((j) => j.id === job?.id);
    setOpened(
      Boolean(
        current?.evidence.some((e) => ['inspection', 'measurement', 'work'].includes(e.kind)),
      ),
    );
    setPane('object');
    setMode(current?.kind === 'music-box' ? 'motion' : 'voltage');
    if (current)
      setUseCondition(
        requiredChecks(current).find((c) => !current.verified.includes(c)) ??
          requiredChecks(current)[0] ??
          'bench',
      );
  }, [job?.id]);
  const chooseTerminal = (terminal: string) => {
    if (activeProbe === 'a') {
      setA(terminal);
      setActiveProbe('b');
    } else {
      setB(terminal);
      setActiveProbe('a');
    }
  };
  const actSequence = (commands: Command[]) => {
    setTeachingFeedback('');
    setReplayStatus('');
    let next = state;
    const messages: string[] = [];
    try {
      for (const command of commands) {
        const prior = next;
        const result = dispatch(next, command);
        next = result.state;
        if (
          result.ok &&
          ['inspect', 'measure', 'work', 'calibrate', 'verify'].includes(command.type) &&
          'jobId' in command
        ) {
          const object = next.jobs.find((j) => j.id === command.jobId);
          const step = object?.evidence.at(-1);
          if (step) {
            if (!step.witnessedBy?.includes('sam'))
              setTeachingFeedback('Sam did not watch this step.');
            else if (step.kind === 'work') {
              const action =
                command.type === 'work'
                  ? `${command.intervention}:${command.componentId}`
                  : command.type === 'calibrate'
                    ? `calibrate:${command.componentId}:${command.setting}`
                    : undefined;
              const pending = object?.pendingLessons.some(
                (lesson) => lesson.observerId === 'sam' && lesson.action === action,
              );
              setTeachingFeedback(
                pending
                  ? 'Sam watched this repair step. Let him watch a test of the repair next. He can then learn whether it worked.'
                  : 'Sam saw this step. He did not see a test of this part before the work. He cannot tell what this step changed.',
              );
            } else if (step.kind === 'use' && step.cues.signal !== 'steady-output')
              setTeachingFeedback('Sam watched this test. It did not show that the repair worked.');
            else if (step.kind === 'use') {
              const oldIds = new Set(prior.people.sam?.methods?.rules.map((r) => r.id) ?? []);
              const added = next.people.sam?.methods?.rules.filter((r) => !oldIds.has(r.id)) ?? [];
              setTeachingFeedback(
                added.length
                  ? `Sam watched the test and learned ${added.length} new repair method${added.length === 1 ? '' : 's'}. See what he learned in People.`
                  : 'Sam watched this test. He did not learn a new repair method.',
              );
            } else setTeachingFeedback('Sam watched this step.');
          }
        }

        if (command.type === 'measure' && result.ok) {
          const reading = next.jobs
            .find((j) => j.id === command.jobId)
            ?.evidence.findLast((e) => e.kind === 'measurement');
          const interpretations: Record<string, string> = {
            'high-drop': 'The voltage drops sharply between these probes.',
            'low-source': 'The battery voltage is below its normal range.',
            voltage: 'This is the voltage between these probes in the selected condition.',
            'open-path': 'Electricity cannot pass between these terminals.',
            resistance: 'The resistance is higher than expected for a working connection.',
            connected: 'Electricity can pass between these terminals.',
            rotation: 'Compare this shaft speed with the normal speed in Notes.',
            'slow-drive': 'This shaft turns slowly.',
            'blocked-drive': 'This shaft is not turning.',
            'power-off': 'The object is switched off.',
          };
          messages.push(
            interpretations[reading?.cues.signal ?? ''] ?? reading?.summary ?? result.message,
          );
        } else messages.push(actionAccount(prior, command, result));
        if (!result.ok) break;
      }
      setState(next);
      setStatus(messages.join(' '));
    } catch (error) {
      setState(next);
      setStatus(error instanceof Error ? error.message : 'This action could not be completed.');
    }
  };
  const act = (command: Command) => actSequence([command]);
  const exportSave = () => {
    const url = URL.createObjectURL(
      new Blob([continuity.exportRun(state)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `small-works-day-${state.day}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const verifyReplay = async () => {
    if (state.inputs === undefined) {
      setReplayStatus(
        'This save does not record every action, so it cannot be replayed for checking. Older saves and runs beyond the 10,000-action limit cannot be checked this way.',
      );
      return;
    }
    const snapshot = state;
    const expected = saveGame(snapshot);
    setReplayChecking(true);
    setReplayStatus('The recorded actions are being replayed…');
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    try {
      const result = replayRecordedRun(
        {
          seed: snapshot.seed,
          inputs: snapshot.inputs,
          provenance: snapshot.provenance,
          migratedFrom: snapshot.migratedFrom,
          openingPeople: snapshot.openingPeople,
          castChapter: snapshot.castChapter,
        },
        expected,
      );
      setReplayStatus(
        result.ok
          ? saveGame(stateRef.current) === expected
            ? `All ${snapshot.inputs?.length ?? 0} recorded actions replayed. They produced this exact workshop state.`
            : 'The recorded actions produced the saved workshop state exactly. Your workshop has changed since the check began. Check it again.'
          : `Replay failed${result.index === undefined ? '' : ` at action ${result.index + 1}`}: ${result.message}`,
      );
    } catch (error) {
      setReplayStatus(
        `Replay failed: ${error instanceof Error ? error.message : 'Unexpected verification error.'}`,
      );
    } finally {
      setReplayChecking(false);
    }
  };
  const chooseJob = (j: Job) => {
    act({ type: 'select', jobId: j.id });
    setView('bench');
  };
  const resetPresentation = (next: GameState, fresh = false) => {
    setConversationSession((session) => session + 1);
    setSheet(null);
    setScreen('play');
    setHasSave(true);
    setState(next);
    setView('bench');
    setPane('object');
    const selectedJob = next.jobs.find((j) => j.id === next.selectedJobId);
    setOpened(
      Boolean(
        selectedJob?.evidence.some((e) => ['inspection', 'measurement', 'work'].includes(e.kind)),
      ),
    );
    setMode(selectedJob?.kind === 'music-box' ? 'motion' : 'voltage');
    if (selectedJob)
      setUseCondition(
        requiredChecks(selectedJob).find((c) => !selectedJob.verified.includes(c)) ??
          requiredChecks(selectedJob)[0] ??
          'bench',
      );
    setA('');
    setB('');
    setCollarPreview(undefined);
    setSelected('');
    setStatus('');
    setTeachingFeedback('');
    setIntroSkipped(
      !continuity.fileSession &&
        !fresh &&
        localStorage.getItem(`small-works-canonical-intro-${next.seed}`) === 'skipped',
    );
    if (fresh && !continuity.fileSession)
      localStorage.removeItem(`small-works-canonical-intro-${next.seed}`);
  };
  const samPresent =
    state.watching || Boolean(state.pendingRequest) || Boolean(job?.assignedTo === 'sam');
  const hasSamObservation = Boolean(job?.evidence.some((e) => e.witnessedBy?.includes('sam')));
  const powerConflict =
    job &&
    ((mode === 'continuity' && job.model.power) || (mode !== 'continuity' && !job.model.power));
  const showTools = opened || !guided;
  const result = status && (
    <div className="focused-result" role="status">
      <p>{status}</p>
      {teachingFeedback && (state.watching || hasSamObservation) && (
        <small>{teachingFeedback}</small>
      )}
    </div>
  );
  const navigatePane = (next: 'object' | 'meter' | 'repair' | 'notes') => {
    setPane(next);
    if (
      guided &&
      (progress.phase === 'inspect' || progress.phase === 'repair') &&
      next === 'repair' &&
      progress.suggestedPart
    )
      setSelected(progress.suggestedPart);
    if (next === 'meter' && guided && progress.suggestedPair) {
      setCondition(progress.suggestedPair.condition);
      setMode(progress.suggestedPair.mode);
      setActiveProbe(a !== progress.suggestedPair.a ? 'a' : 'b');
    }
  };
  const suggestedTerminal =
    guided && pane === 'meter' && progress.suggestedPair
      ? activeProbe === 'a'
        ? a !== progress.suggestedPair.a
          ? progress.suggestedPair.a
          : undefined
        : b !== progress.suggestedPair.b
          ? progress.suggestedPair.b
          : undefined
      : undefined;
  const diagram = job && (
    <Device
      job={job}
      selected={selected}
      onSelect={setSelected}
      probeA={a}
      probeB={b}
      condition={condition}
      collarPreview={collarPreview}
      suggestedTerminal={suggestedTerminal}
      suggestedPart={guided ? progress.suggestedPart : undefined}
    />
  );
  const crises = workshopCrises(state);
  const dayStart = state.now - (state.now % 1440);
  const dueToday = state.jobs.filter(
    (j) =>
      !j.isDonor &&
      !j.isPersonal &&
      ['active', 'ready'].includes(j.status) &&
      j.due >= dayStart &&
      j.due < dayStart + 1440,
  );
  const elapsed = Math.max(0, Math.min(100, (((state.now % 1440) - 540) / 480) * 100));
  const actionJob = state.jobs.find((j) => j.id === actionJobId);
  const responsibilityActions = (j: Job) => (
    <div className="responsibility-actions">
      {' '}
      {j.blocked ? (
        <>
          <button
            type="button"
            onClick={() =>
              actSequence([{ type: 'recall', jobId: j.id }, { type: 'request-lesson' }])
            }
          >
            Review together
            <small>Take the object back and ask Sam to watch.</small>
          </button>
          <button type="button" onClick={() => act({ type: 'retry-sam', jobId: j.id })}>
            Retry after teaching
          </button>
          <button type="button" onClick={() => act({ type: 'recall', jobId: j.id })}>
            Take the object back
          </button>
        </>
      ) : !progress.apprenticeshipAvailable || j.isDonor || samFinishedPersonal(j) ? null : (
        <button
          type="button"
          onClick={() =>
            act(
              j.assignedTo
                ? { type: 'recall', jobId: j.id }
                : { type: 'assign', jobId: j.id, personId: 'sam' },
            )
          }
        >
          {j.assignedTo
            ? 'Take the object back'
            : j.status === 'ready' && evidenceContext(j, 'sam').stage === 'ready' && !j.isPersonal
              ? 'Ask Sam to return the checked object'
              : 'Ask Sam to take charge of the repair'}
        </button>
      )}
      {!j.isPersonal && !j.isDonor && (
        <>
          <button type="button" onClick={() => act({ type: 'deliver', jobId: j.id })}>
            Return checked object
          </button>
          <button
            type="button"
            onClick={() =>
              act({
                type: 'deliver',
                jobId: j.id,
                unfinished: true,
              })
            }
          >
            Return unfinished
          </button>
        </>
      )}
    </div>
  );
  const isEnd = screen === 'play' && state.ended;
  const startWorkshop = async (seed: number, outcomes = Boolean(state.castOutcomes)) => {
    if (continuity.fileSession) return;
    setEntryError('');
    setEntering(true);
    try {
      await continuity.depart();
      const base = await continuity.fresh(seed);
      const next = outcomes
        ? dispatch(base, { type: 'start-cast-outcomes' })
        : { ok: true, state: base, message: '' };
      if (!next.ok) throw new Error(next.message);
      resetPresentation(next.state, true);
      initialLoadFailed = false;
      setNewConfirmed(false);
    } catch (error) {
      continuity.status = error instanceof Error ? error.message : String(error);
      setDebugError(error instanceof Error ? error.message : String(error));
      setEntryError(workshopStartError());
      console.error('Workshop entry failed:', continuity.status);
      refreshContinuity((n) => n + 1);
    } finally {
      setEntering(false);
    }
  };
  const enterRestoredWorkshop = async (restored: GameState) => {
    const previous = stateRef.current;
    // Resuming a paused chapter checkpoints through continuity's bound state reader.
    stateRef.current = restored;
    setState(restored);
    try {
      const next = await continuity.enter(restored);
      stateRef.current = next;
      return next;
    } catch (error) {
      if (stateRef.current === restored) {
        stateRef.current = previous;
        setState(previous);
      }
      throw error;
    }
  };
  const enterOutcomeWorkshop = async () => {
    if (continuity.fileSession) return;
    if (entering) return;
    setEntering(true);
    setEntryError('');
    try {
      await continuity.depart();
      const saved = await readFreshWorkshopSave(OUTCOME_LOCAL_KEY);
      if (saved) {
        await readFreshWorkshopSave(SOURCE_JOURNAL_KEY);
        const restored = continuity.loadLocal(saved);
        if (!restored.castOutcomes) throw new Error('This is not the cast-outcome chapter.');
        resetPresentation(await enterRestoredWorkshop(restored), true);
      } else {
        const base = await continuity.fresh(freshSeed());
        const result = dispatch(base, { type: 'start-cast-outcomes' });
        if (!result.ok) throw new Error(result.message);
        resetPresentation(result.state, true);
      }
    } catch (error) {
      setDebugError(error instanceof Error ? error.message : String(error));
      setEntryError(workshopStartError());
    } finally {
      setEntering(false);
    }
  };
  const enterWorkshop = async () => {
    if (entering) return;
    if (initialLoadFailed) {
      setEntryError(damagedWorkshopMessage);
      return;
    }
    setEntryError('');
    setEntering(true);
    try {
      let restored = stateRef.current;
      if (!continuity.fileSession) {
        const key = restored.castOutcomes ? OUTCOME_LOCAL_KEY : SAVE_KEY;
        const saved = await readFreshWorkshopSave(key);
        if (!saved) {
          await startWorkshop(restored.seed, Boolean(restored.castOutcomes));
          return;
        }
        await readFreshWorkshopSave(SOURCE_JOURNAL_KEY);
        restored = continuity.loadLocal(saved);
      }
      const next = await enterRestoredWorkshop(restored);
      setState(next);
      setSheet(null);
      setHasSave(true);
      setScreen('play');
    } catch (error) {
      continuity.status = String(error);
      setDebugError(error instanceof Error ? error.message : String(error));
      setEntryError(workshopStartError());
      console.error('Workshop entry failed:', continuity.status);
      refreshContinuity((n) => n + 1);
    } finally {
      setEntering(false);
    }
  };
  useEffect(() => {
    const returnToPlay = () => {
      if (
        document.visibilityState === 'visible' &&
        screen === 'play' &&
        stateRef.current.chapterPaused
      ) {
        const current = stateRef.current;
        void continuity
          .enter(current)
          .then((next) => {
            if (stateRef.current === current) {
              stateRef.current = next;
              setState(next);
            }
          })
          .catch((error) => {
            setDebugError(error instanceof Error ? error.message : String(error));
            setEntryError(workshopStartError());
          });
      }
    };
    document.addEventListener('visibilitychange', returnToPlay);
    window.addEventListener('pageshow', returnToPlay);
    return () => {
      document.removeEventListener('visibilitychange', returnToPlay);
      window.removeEventListener('pageshow', returnToPlay);
    };
  }, [screen]);
  const goToGames = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const destination = event.currentTarget.href;
    await continuity.depart();
    window.location.assign(destination);
  };
  const debugTools = (
    <details className="workshop-debug">
      <summary>Debug</summary>
      <div className="debug-tools">
        <button type="button" disabled={replayChecking} onClick={verifyReplay}>
          {replayChecking ? 'Verifying replay…' : 'Verify the recorded replay'}
        </button>
        {replayStatus && <p role="status">{replayStatus}</p>}
        {!continuity.fileSession && (
          <>
            <label>
              Starting number (seed)
              <input type="number" value={seedText} onChange={(e) => setSeedText(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={entering || !seedText.trim() || !Number.isFinite(Number(seedText))}
              onClick={() => void startWorkshop(Number(seedText))}
            >
              Start with this number
            </button>
          </>
        )}
        {debugError && <p>{debugError}</p>}
      </div>
    </details>
  );
  const privacyTools = (showDebug = true) => (
    <div className="privacy-tools">
      <a href="https://human.adamwhite.work/lab/privacy/" target="_blank" rel="noreferrer">
        Lab privacy
      </a>
      {showDebug && debugTools}
    </div>
  );

  const workday = (large = false) => (
    <div
      role="img"
      className={`workday-track ${large ? 'large' : ''}`}
      aria-label={`${Math.round(elapsed)}% of the workday used`}
    >
      <span>09</span>
      <div className="workday-rail">
        <div className="workday-fill" style={{ width: `${elapsed}%` }} />
        <span className="workday-marker" style={{ left: `${elapsed}%` }} />
        {dueToday.map((j) => (
          <span
            key={j.id}
            className="promise-tick"
            title={`${j.title} · ${dayTime(j.due)}`}
            style={{ left: `${Math.max(0, Math.min(100, (((j.due % 1440) - 540) / 480) * 100))}%` }}
          >
            ◷
          </span>
        ))}
      </div>
      <span>17</span>
    </div>
  );
  const dayActions = (
    <>
      <button type="button" onClick={() => act({ type: 'wait', minutes: 30 })}>
        Wait 30 min
      </button>
      <button type="button" onClick={() => act({ type: 'next-day' })}>
        Close for the day
      </button>
    </>
  );
  const info =
    screen === 'title'
      ? [
          'The workshop',
          'People bring broken things and say how they use them.',
          'Each action takes time. The workshop closes at 17:00.',
          'Each promise has a return time. You may return an object unfinished if you say so.',
        ]
      : isEnd
        ? [
            'Your first week',
            'The record lists returned objects, promises still open and Sam’s work.',
            'The tally uses this game’s own rules. It does not measure people’s worth.',
          ]
        : view === 'people'
          ? [
              'Sam',
              'He learns by watching lessons that he agrees to attend.',
              'You can ask Sam for more time. He loses goodwill towards you if a step takes longer than he agreed to stay.',
            ]
          : view === 'board'
            ? [
                'Promises',
                'Accept a job only if you can return it by the promised time.',
                'Sam can take charge of a repair once he has watched the work.',
              ]
            : pane === 'meter'
              ? [
                  'The meter',
                  'Place the red and black probes on two labelled points, called terminals.',
                  'The voltage reading shows the voltage difference between the probes. The continuity test checks whether electricity can pass between them. Turn the power off before this test.',
                  'Choose Carry to measure while the object moves. Measure again after each repair.',
                ]
              : [
                  'Finding the fault',
                  'First test the object as its owner uses it. Then open the cover.',
                  'Place the probes on two terminals to take a reading. Choose whether to test on the table, while carrying the object or while it works harder.',
                  'Look closely at the part that the reading points to before you replace it. You have limited spare parts.',
                ];
  return (
    <div
      className={`workshop focused-workshop workshop-shell ${guided ? 'is-guided' : ''} screen-${screen} ${isEnd ? 'is-end' : ''}`}
    >
      <header className="shell-topbar">
        {screen === 'title' ? (
          <a href="https://human.adamwhite.work/games/" onClick={(event) => void goToGames(event)}>
            All games
          </a>
        ) : (
          <span className="where-when">
            Day {state.day} · {isEnd ? 'morning' : dayTime(state.now).split(' · ').at(-1)}
          </span>
        )}
        {screen === 'play' && !isEnd && (
          <div className="state-strip">
            <button
              type="button"
              className="workday-button"
              aria-label="The day"
              onClick={() => setSheet('day')}
            >
              {workday()}
            </button>
            <strong className="cash">{money(state.cash)}</strong>
            {!guided && (
              <nav className="view-chips" aria-label="Workshop">
                {(['bench', 'board', 'people'] as const).map((v) => (
                  <button
                    type="button"
                    key={v}
                    aria-current={view === v ? 'page' : undefined}
                    onClick={() => setView(v)}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                    {crises.some((c) =>
                      v === 'people'
                        ? c.people
                        : v === 'board'
                          ? !c.people
                          : c.jobId === job?.id && !c.people,
                    ) && (
                      <span role="img" aria-label="needs attention">
                        {' '}
                        •
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            )}
          </div>
        )}
        <div className="topbar-controls">
          <button
            type="button"
            aria-label="Information"
            aria-expanded={infoOpen}
            onClick={() => {
              setSheet(null);
              setInfoOpen(!infoOpen);
            }}
          >
            i
          </button>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={sheet === 'menu'}
            onClick={() => {
              setInfoOpen(false);
              setNewConfirmed(false);
              setSheet('menu');
            }}
          >
            <span className="desktop-menu-label">Menu </span>≡
          </button>
        </div>
      </header>
      {continuity.historyNotice && (
        <p role="status" className="entry-error">
          {continuity.historyNotice}
        </p>
      )}
      {saveError && (
        <aside className="entry-error" role="alert">
          <p>{saveError}</p>
          <button type="button" onClick={exportSave}>
            Download this workshop
          </button>
        </aside>
      )}
      {screen === 'title' && (
        <main className="title-page">
          <div className="title-art">
            <svg viewBox="0 0 400 230" aria-hidden="true">
              <path
                d="M40 200H360M150 190L160 72H240L250 190ZM170 69V46C170 10 230 10 230 46V69M151 195H249M178 78L173 180M222 78L227 180"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
              />
              <ellipse cx="200" cy="133" rx="18" ry="36" fill="currentColor" opacity=".35" />
            </svg>
            <h1>SMALL WORKS</h1>
          </div>
          <p className="title-goal">Find out why the lantern goes dark.</p>
          {!continuity.fileSession && state.castOutcomes && (
            <p>Current chapter: optional cast outcomes. Its autosave is separate.</p>
          )}
          <div className="title-actions">
            <button
              type="button"
              className="primary-action"
              disabled={entering}
              onClick={() => void enterWorkshop()}
            >
              {hasSave ? 'Resume' : 'Start repairing'}
            </button>
            <small>
              {continuity.fileSession
                ? 'Progress stays in this tab. Download the game file to keep it.'
                : 'Your game is saved on this device.'}
            </small>
            {!continuity.fileSession && (
              <details>
                <summary>What became of Sam, Nora, Rafi and Halil</summary>
                <p>
                  Hear how they are doing and take on one more job. Your saved workshop is kept.
                </p>
                <button
                  type="button"
                  disabled={entering}
                  onClick={() => void enterOutcomeWorkshop()}
                >
                  Open cast outcomes
                </button>
              </details>
            )}
            {entering && <p role="status">Your workshop is opening…</p>}
            {entryError && (
              <div className="entry-error">
                <p role="alert">{entryError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSheet(null);
                    openFeedback();
                  }}
                >
                  Feedback
                </button>
              </div>
            )}

            <a
              href="https://human.adamwhite.work/lab/people/"
              onClick={(event) => void goToGames(event)}
            >
              People across games
            </a>
            {privacyTools(false)}
          </div>
        </main>
      )}
      {screen === 'feedback' && (
        <SendWord
          key={feedbackSession}
          chooseRecording={(allow) =>
            allow ? continuity.recording(true) : continuity.denyRecording()
          }
          getRun={() => JSON.parse(saveGame(stateRef.current))}
          onGame={() => {
            setScreen('play');
            setSheet(null);
          }}
          onBack={() => {
            setScreen('play');
            setNewConfirmed(false);
            setSheet('menu');
          }}
        />
      )}
      {screen === 'play' && !isEnd && (
        <div className={`play-content view-${view}`}>
          {!guided && crises[0] && (
            <button
              className="crisis-banner"
              type="button"
              onClick={() => {
                const c = crises[0];
                if (!c) return;
                const target = state.jobs.find((j) => j.id === c.jobId);
                if (c.people) setView('people');
                else if (target) chooseJob(target);
              }}
            >
              {crises[0].text} ▸
            </button>
          )}
          {view === 'bench' && job && (
            <main className={`focused-bench ${showTools ? 'tools-visible' : ''} active-${pane}`}>
              <div
                className={`focused-workspace ${guided ? `guide-${progress.phase}` : ''} ${showTools ? 'tools-open' : 'object-only'} ${showTools && pane !== 'object' ? 'instrument-focused' : ''}`}
              >
                <section className="focused-object" aria-label="Physical object">
                  <PhysicalObjectScene
                    job={job}
                    disabled={jobLocked}
                    testCondition={guided ? undefined : useCondition}
                    onPower={() => act({ type: 'power', jobId: job.id, on: !job.model.power })}
                    onTry={(condition) => act({ type: 'verify', jobId: job.id, condition })}
                    onOpen={() => {
                      setOpened(true);
                      setPane('object');
                      // This explicit reveal keeps the cue and parts together on a phone.
                      if (window.matchMedia('(max-width: 900px)').matches)
                        requestAnimationFrame(() =>
                          document
                            .querySelector('.first-repair-guide')
                            ?.scrollIntoView({ block: 'start' }),
                        );
                    }}
                    opened={opened}
                    allowOpen={!guided || progress.phase !== 'try'}
                  />
                  <div className="scene-speech">
                    <RecentConversation
                      key={conversationSession}
                      lines={todaysWords(state)}
                      canAskSam={false}
                      onAskSam={() => {}}
                      overlay
                    />
                  </div>
                  {samPresent && !guided && (
                    <button type="button" className="sam-chip" onClick={() => setView('people')}>
                      Sam {state.watching ? 'is watching.' : 'is at work.'}
                    </button>
                  )}
                  <button type="button" className="job-header" onClick={() => setSheet('job')}>
                    {job.title} <span>▾</span>
                  </button>
                </section>
                <section className="focused-tools" aria-label="Bench tools">
                  {guided && (
                    <FirstRepairGuide
                      state={state}
                      job={job}
                      pane={pane}
                      opened={opened}
                      onOpen={() => setOpened(true)}
                      onPane={navigatePane}
                      onTest={() => act({ type: 'verify', jobId: job.id, condition: 'movement' })}
                      disabled={jobLocked}
                      onSkip={skipIntro}
                    />
                  )}
                  {jobLocked && job.status !== 'delivered' && (
                    <p className="focused-lock">
                      {job.assignedTo
                        ? 'Sam has this object.'
                        : state.community?.reservedJobIds.includes(job.id)
                          ? 'This object is reserved for the gathering.'
                          : 'You cannot work on this object.'}
                    </p>
                  )}

                  {job.status === 'delivered' ? (
                    <>
                      <ReturnReceipt
                        job={job}
                        people={state.people}
                        onNext={() => setView('board')}
                        nextLabel="To the board"
                      />
                      <MethodResponse
                        state={state}
                        jobId={job.id}
                        componentId={
                          job.contributions
                            .findLast((w) => /^(clean|adjust|replace|calibrate):/.test(w.action))
                            ?.action.split(':')[1] ??
                          job.model.components[0]?.id ??
                          ''
                        }
                        act={act}
                      />
                    </>
                  ) : (
                    <>
                      {!showTools && <div className="opening-quote">{job.description}</div>}
                      {showTools && (
                        <>
                          <div
                            className="focused-tabs"
                            role="tablist"
                            aria-label="Bench tool"
                            onKeyDown={(e) => {
                              const keys = ['object', 'meter', 'repair', 'notes'] as const;
                              const i = keys.indexOf(pane);
                              const next =
                                e.key === 'ArrowRight'
                                  ? keys[(i + 1) % 4]
                                  : e.key === 'ArrowLeft'
                                    ? keys[(i + 3) % 4]
                                    : e.key === 'Home'
                                      ? keys[0]
                                      : e.key === 'End'
                                        ? keys[3]
                                        : undefined;
                              if (next) {
                                e.preventDefault();
                                navigatePane(next);
                                document.getElementById(`tab-${next}`)?.focus();
                              }
                            }}
                          >
                            {(['object', 'meter', 'repair', 'notes'] as const).map((tab, i) => (
                              <button
                                type="button"
                                key={tab}
                                role="tab"
                                id={`tab-${tab}`}
                                className={
                                  guided &&
                                  ((tab === 'meter' &&
                                    (progress.phase === 'measure-source' ||
                                      progress.phase === 'measure-path')) ||
                                    (tab === 'repair' &&
                                      (progress.phase === 'inspect' ||
                                        progress.phase === 'repair')))
                                    ? 'guide-target'
                                    : undefined
                                }
                                aria-selected={pane === tab}
                                aria-controls={`pane-${tab}`}
                                tabIndex={pane === tab ? 0 : -1}
                                onClick={() => navigatePane(tab)}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  aria-hidden="true"
                                >
                                  {i === 0 ? (
                                    <>
                                      <path d="m12 2 9 5v10l-9 5-9-5V7Z" />
                                      <path d="m3 7 9 5 9-5M12 12v10" />
                                    </>
                                  ) : i === 1 ? (
                                    <>
                                      <rect x="4" y="2" width="16" height="20" rx="2" />
                                      <path d="M7 6h10v5H7zM8 16h2m4 0h2M8 19h2m4 0h2" />
                                    </>
                                  ) : i === 2 ? (
                                    <path d="M14 3a6 6 0 0 0-7 7L2 17a3 3 0 0 0 5 4l7-8a6 6 0 0 0 7-7l-4 4-4-3 1-4Z" />
                                  ) : (
                                    <path d="M5 2h14v20H5zM8 7h8M8 12h8M8 17h5" />
                                  )}
                                </svg>
                                {tab}
                              </button>
                            ))}
                          </div>
                          <div
                            role="tabpanel"
                            ref={meterPanel}
                            id={`pane-${pane}`}
                            aria-labelledby={`tab-${pane}`}
                            className={`focused-pane pane-${pane}`}
                          >
                            {pane !== 'notes' && (
                              <p>
                                Reference in Notes lists the normal voltages and drive ratios to
                                compare with your readings.{' '}
                                <button type="button" onClick={openReference}>
                                  Open Reference
                                </button>
                              </p>
                            )}
                            {job.isPersonal && <TheatrePerformance job={job} />}
                            {(pane === 'object' || pane === 'repair') && diagram}
                            {pane === 'object' && !guided && (
                              <fieldset className="use-conditions">
                                <legend>Try the object</legend>
                                <div>
                                  {conditions.map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      disabled={jobLocked}
                                      aria-pressed={useCondition === c}
                                      onClick={() => setUseCondition(c)}
                                    >
                                      {c === 'bench'
                                        ? '▱ On table'
                                        : c === 'movement'
                                          ? '↝ Carry'
                                          : '◉ Work harder'}
                                      <small>
                                        {job.verified.includes(c)
                                          ? 'Passed'
                                          : requiredChecks(job).includes(c) && !job.isDonor
                                            ? 'Required'
                                            : 'Optional'}
                                      </small>
                                    </button>
                                  ))}
                                </div>
                                <p>
                                  Use the{' '}
                                  {useCondition === 'movement'
                                    ? 'Carry'
                                    : useCondition === 'load' && job.kind === 'lantern'
                                      ? 'Read'
                                      : useCondition === 'bench'
                                        ? 'Try'
                                        : job.kind === 'music-box'
                                          ? 'Play'
                                          : 'Try'}{' '}
                                  button on the object. {checkPurpose(job)}
                                </p>
                              </fieldset>
                            )}
                            {pane === 'object' && <h2>{part?.label ?? 'Choose a part'}</h2>}
                            {pane === 'meter' && (
                              <div className="meter-controls">
                                <div className="meter-screen">
                                  <span>
                                    {lastReading?.request
                                      ? `${lastReading.request.mode} · ${testWords[lastReading.request.condition]}`
                                      : 'There is no reading yet.'}
                                  </span>
                                  <strong>
                                    {lastReading?.value === undefined || lastReading.value === null
                                      ? '—'
                                      : lastReading.value.toFixed(2)}
                                    <small>{readingUnit(lastReading?.unit)}</small>
                                  </strong>
                                  <small>
                                    {lastReading?.request
                                      ? `${lastReading.request.a} → ${lastReading.request.b} · ${dayTime(lastReading.at)}`
                                      : 'Place both probes on terminals.'}
                                    {lastReading && lastWorkId > lastReading.id
                                      ? ' · This reading was taken before the latest work.'
                                      : ''}
                                  </small>
                                </div>
                                <div className="meter-settings">
                                  <div className="segmented">
                                    {(job.kind === 'music-box'
                                      ? (['motion'] as const)
                                      : (['voltage', 'continuity'] as const)
                                    ).map((m) => (
                                      <button
                                        type="button"
                                        key={m}
                                        aria-pressed={mode === m}
                                        onClick={() => setMode(m)}
                                      >
                                        {m}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    className="meter-power-toggle"
                                    disabled={jobLocked}
                                    aria-pressed={job.model.power}
                                    onClick={() =>
                                      act({ type: 'power', jobId: job.id, on: !job.model.power })
                                    }
                                  >
                                    Power {job.model.power ? 'on' : 'off'}
                                  </button>
                                </div>
                                <div className="focused-conditions">
                                  {conditions.map((c) => (
                                    <button
                                      type="button"
                                      key={c}
                                      aria-pressed={condition === c}
                                      onClick={() => setCondition(c)}
                                    >
                                      {c === 'bench'
                                        ? '▱ On table'
                                        : c === 'movement'
                                          ? '↝ Carry'
                                          : '◉ Work harder'}
                                    </button>
                                  ))}
                                </div>
                                <div className="probe-tabs">
                                  <button
                                    type="button"
                                    aria-pressed={activeProbe === 'a'}
                                    onClick={() => setActiveProbe('a')}
                                  >
                                    Red probe · {a || 'place'}
                                  </button>
                                  <button
                                    type="button"
                                    aria-pressed={activeProbe === 'b'}
                                    onClick={() => setActiveProbe('b')}
                                  >
                                    Black probe · {b || 'place'}
                                  </button>
                                </div>
                                <div className="terminal-strip">
                                  {terminals.map((t) => (
                                    <button
                                      type="button"
                                      key={t}
                                      disabled={jobLocked}
                                      onClick={() => chooseTerminal(t)}
                                      aria-label={`Place ${activeProbe === 'a' ? 'red' : 'black'} probe on terminal ${t}`}
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                                {powerConflict && (
                                  <p className="power-hint">
                                    Switch the power {mode === 'continuity' ? 'off' : 'on'} to
                                    measure {mode}.
                                  </p>
                                )}
                              </div>
                            )}
                            {pane === 'meter' && diagram}
                            {pane === 'repair' && (
                              <>
                                <div className="opening-quote">
                                  <strong>
                                    {state.people[job.ownerId]?.name ??
                                      (job.ownerId === 'player' ? 'Your project' : 'Its owner')}
                                  </strong>
                                  <p>{job.description}</p>
                                </div>
                                <h2>{part?.label ?? 'Choose a part'}</h2>
                                {part && (
                                  <>
                                    <ObjectOwnerExchange
                                      state={state}
                                      jobId={job.id}
                                      componentId={part.id}
                                      act={act}
                                    />
                                    <MethodResponse
                                      state={state}
                                      jobId={job.id}
                                      componentId={part.id}
                                      act={act}
                                    />
                                  </>
                                )}
                                {state.watching &&
                                  part &&
                                  !hasPendingPartLesson &&
                                  !hasComponentBaseline &&
                                  !hasCalibrationBaseline && (
                                    <p className="teaching-baseline-notice">
                                      Before you work on this part again, let Sam watch a test of
                                      it. He can then compare the result before and after the work.
                                    </p>
                                  )}
                                {part?.kind === 'governor' && (
                                  <div className="governor-control">
                                    <p>The speed control ring is set to {part.setting ?? 2}.</p>
                                    <div>
                                      {[0, 1, 2, 3, 4].map((setting) => (
                                        <button
                                          type="button"
                                          key={setting}
                                          aria-pressed={
                                            (collarPreview ?? part.setting ?? 2) === setting
                                          }
                                          onClick={() => setCollarPreview(setting)}
                                        >
                                          {setting}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                            {pane === 'notes' && (
                              <>
                                <ReadingComparison job={job} />
                                <details>
                                  <summary>Recorded observations · {job.evidence.length}</summary>
                                  {[...job.evidence].reverse().map((e) => (
                                    <p key={e.id}>
                                      <time>{dayTime(e.at)}</time> {e.summary}
                                    </p>
                                  ))}
                                </details>
                                <details
                                  open={referenceOpen}
                                  onToggle={(event) => setReferenceOpen(event.currentTarget.open)}
                                >
                                  <summary id="bench-reference">Reference</summary>
                                  <p>{checkPurpose(job)}</p>
                                  {job.kind === 'music-box' ? (
                                    <div className="drive-reference">
                                      <p>
                                        Place one probe on a shaft and the other on the fixed frame
                                        at point 0 to measure how fast the shaft turns. The labelled
                                        points show where to place the probes.
                                      </p>
                                      <ol>
                                        <li>
                                          <strong>Spring · A</strong>
                                          <span>
                                            The spring is rated to turn at{' '}
                                            {job.model.ratedDrive ?? 120} turns per minute.
                                          </span>
                                        </li>
                                        <li>
                                          <strong>Gear · B</strong>
                                          <span>
                                            Divide the input speed by {job.model.gearRatio ?? 4}.
                                          </span>
                                        </li>
                                        <li>
                                          <strong>Governor · C</strong>
                                          <span>
                                            The governor controls the speed. Multiply the speed by
                                            the number listed for the ring’s setting.
                                          </span>
                                        </li>
                                        <li>
                                          <strong>Drum · D</strong>
                                          <span>Divide the governor’s output speed by 2.</span>
                                        </li>
                                      </ol>
                                      <table>
                                        <caption>Speed control ring settings</caption>
                                        <thead>
                                          <tr>
                                            <th scope="col">Setting</th>
                                            {governorMultipliers.map((factor, i) => (
                                              <th scope="col" key={factor}>
                                                {i}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr>
                                            <th scope="row">Multiplier</th>
                                            {governorMultipliers.map((factor) => (
                                              <td key={factor}>×{factor}</td>
                                            ))}
                                          </tr>
                                        </tbody>
                                      </table>
                                      <p>
                                        The owner wants the drum to turn at{' '}
                                        <strong>
                                          {job.model.desiredRPM ?? 15} ± {job.model.tolerance ?? 3}{' '}
                                          turns per minute
                                        </strong>
                                        . These ratios describe how the parts change the speed.
                                        Compare readings along the mechanism. Test it as the owner
                                        uses it.
                                      </p>
                                    </div>
                                  ) : (
                                    <p>
                                      The terminals are the labelled points where you place the
                                      probes. A working power source supplies{' '}
                                      {job.model.sourceVolts} volts (V). Working connections usually
                                      lose less than 0.2 volts. Compare readings from the same two
                                      terminals on the table and in the condition that caused the
                                      problem.
                                    </p>
                                  )}
                                </details>
                                {hasSamObservation && <TeachingRecord job={job} />}
                              </>
                            )}
                            {state.watching &&
                              state.watchUntil !== undefined &&
                              (pane === 'object' || pane === 'meter') &&
                              state.now + 10 > state.watchUntil && (
                                <p className="lesson-overrun">
                                  This 10-minute step would finish after Sam’s agreed time.
                                </p>
                              )}
                            {state.watching &&
                              state.watchUntil !== undefined &&
                              pane === 'repair' &&
                              part?.kind === 'governor' &&
                              state.now + 20 > state.watchUntil && (
                                <p className="lesson-overrun">
                                  Changing the speed control ring would finish after Sam’s agreed
                                  time.
                                </p>
                              )}
                            {pane === 'repair' && state.busyWorkshop && part && (
                              <label className="replacement-source">
                                Replacement part
                                <select
                                  aria-label="Replacement part source"
                                  value={replacementSource ?? 'auto'}
                                  onChange={(event) =>
                                    setReplacementSource(
                                      event.target.value === 'auto'
                                        ? undefined
                                        : (event.target.value as 'new' | 'recovered'),
                                    )
                                  }
                                >
                                  <option value="auto">
                                    New if available, otherwise recovered
                                  </option>
                                  <option value="new">
                                    New ({stockCount(state, part.kind, 'new')})
                                  </option>
                                  <option value="recovered">
                                    Recovered ({stockCount(state, part.kind, 'recovered')})
                                  </option>
                                </select>
                              </label>
                            )}
                            {pane !== 'notes' &&
                              state.watching &&
                              job.pendingLessons.length > 0 && <TeachingRecord job={job} />}
                          </div>
                        </>
                      )}
                      {pane === 'repair' && part && componentWorkReading(job, part.id) && (
                        <p className="part-work-reading">
                          {componentWorkReading(job, part.id)?.text}
                        </p>
                      )}
                      <section
                        className="bench-feedback"
                        aria-label="Repair response and next test"
                      >
                        {result}
                        {pane === 'repair' &&
                          job.evidence.some((entry) => entry.kind === 'work') && (
                            <button
                              type="button"
                              disabled={jobLocked}
                              onClick={() =>
                                act({ type: 'verify', jobId: job.id, condition: useCondition })
                              }
                            >
                              Test {testWords[useCondition]} <small>15 min</small>
                            </button>
                          )}
                      </section>
                      <div className={`bench-action-bar ${pane === 'notes' ? 'notes-bar' : ''}`}>
                        {job.status === 'ready' && !job.isDonor && !job.isPersonal && (
                          <button
                            type="button"
                            className="primary-action focused-return"
                            disabled={jobLocked}
                            onClick={() => act({ type: 'deliver', jobId: job.id })}
                          >
                            Return to{' '}
                            {state.people[job.ownerId]?.name ??
                              (job.ownerId === 'player' ? 'Your project' : 'Its owner')}
                            <small>10 min</small>
                          </button>
                        )}
                        {showTools && (
                          <div className="bench-verbs">
                            {(pane === 'object' || pane === 'repair') && (
                              <>
                                {' '}
                                <button
                                  type="button"
                                  disabled={!part || jobLocked}
                                  onClick={() =>
                                    part &&
                                    act({ type: 'inspect', jobId: job.id, componentId: part.id })
                                  }
                                >
                                  Look closely <small>10 min</small>
                                </button>
                              </>
                            )}
                            {pane === 'meter' && (
                              <>
                                {' '}
                                <button
                                  type="button"
                                  className="measure-button"
                                  disabled={jobLocked || !a || !b || Boolean(powerConflict)}
                                  onClick={() =>
                                    act({
                                      type: 'measure',
                                      jobId: job.id,
                                      request: { mode, a, b, condition },
                                    })
                                  }
                                >
                                  Read meter <small>10 min</small>
                                </button>
                              </>
                            )}
                            {pane === 'repair' && !job.isDonor && part?.kind !== 'governor' && (
                              <>
                                {' '}
                                <div className="focused-repairs">
                                  {(['clean', 'adjust', 'replace'] as const)
                                    .filter(
                                      (action) =>
                                        !(action === 'adjust' && part?.kind === 'governor'),
                                    )
                                    .map((action) => (
                                      <button
                                        type="button"
                                        key={action}
                                        className={
                                          guided &&
                                          progress.phase === 'repair' &&
                                          action === 'replace'
                                            ? 'guided-replace'
                                            : ''
                                        }
                                        disabled={
                                          jobLocked ||
                                          !part ||
                                          (action === 'replace' &&
                                            (replacementSource && state.busyWorkshop
                                              ? stockCount(state, part.kind, replacementSource) < 1
                                              : !(state.stock[part.kind] ?? 0)))
                                        }
                                        onClick={() =>
                                          part &&
                                          act({
                                            type: 'work',
                                            jobId: job.id,
                                            componentId: part.id,
                                            intervention: action,
                                            ...(action === 'replace' &&
                                            state.busyWorkshop &&
                                            replacementSource
                                              ? { source: replacementSource }
                                              : {}),
                                          })
                                        }
                                      >
                                        {action}
                                        <small>
                                          {action === 'replace'
                                            ? part
                                              ? (state.stock[part.kind] ?? 0) > 0
                                                ? `30 min · 1 ${part.kind} (${state.stock[part.kind]} stocked)`
                                                : `No ${part.kind} stocked`
                                              : 'Choose a part'
                                            : '20 min'}
                                        </small>
                                        {state.watching &&
                                          state.watchUntil !== undefined &&
                                          state.now + (action === 'replace' ? 30 : 20) >
                                            state.watchUntil && (
                                            <em>This step will finish after Sam’s agreed time.</em>
                                          )}
                                      </button>
                                    ))}
                                  {part &&
                                    partSupplyTarget(part.kind) &&
                                    !(state.stock[part.kind] ?? 0) && (
                                      <div className="selected-part-supply">
                                        <p>{partSupplyDetail(state, part.kind)}</p>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSupplyTarget(partSupplyTarget(part.kind));
                                            setView('people');
                                          }}
                                        >
                                          Find this part
                                          <small>{part.kind} · Supplies</small>
                                        </button>
                                      </div>
                                    )}
                                </div>
                              </>
                            )}
                            {pane === 'repair' && part?.kind === 'governor' && (
                              <>
                                {' '}
                                <button
                                  type="button"
                                  disabled={jobLocked}
                                  onClick={() =>
                                    act({
                                      type: 'calibrate',
                                      jobId: job.id,
                                      componentId: part.id,
                                      setting: collarPreview ?? part.setting ?? 2,
                                    })
                                  }
                                >
                                  Apply setting · 20 min
                                </button>
                              </>
                            )}
                            {pane === 'repair' && (
                              <>
                                {' '}
                                {job.isDonor && (
                                  <button
                                    type="button"
                                    disabled={!part || jobLocked}
                                    onClick={() =>
                                      part &&
                                      act({ type: 'salvage', jobId: job.id, componentId: part.id })
                                    }
                                  >
                                    Recover part · 25 min
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
              </div>
            </main>
          )}
          {view === 'board' && (
            <main className="board-page">
              {progress.apprenticeshipAvailable && <SamRequest state={state} act={act} />}
              <CommunityPanel
                state={state}
                act={act}
                onPause={() => setScreen('title')}
                onOpenJob={(id) => {
                  const object = state.jobs.find((j) => j.id === id);
                  if (object) chooseJob(object);
                }}
              />
              <div className="page-heading">
                <p className="eyebrow">Promises to keep</p>
                <h1>The workboard</h1>
                <p>
                  Choose work that this workshop can finish. All repairs use the workshop’s time and
                  parts. People may have other plans.
                </p>
              </div>
              {canStartBusyWorkshop(state) && (
                <details className="busy-workshop-choice">
                  <summary>Try a busy afternoon</summary>
                  <p>
                    Wait until 13:30 for three urgent requests. They share one new switch and the
                    only bench. The supplier has no further switches until tomorrow. Sam has his own
                    afternoon plans. Accept only the promises you want to make.
                  </p>
                  <p>
                    This changes this workshop’s afternoon. It takes time to wait for the visitors.
                  </p>
                  <button type="button" onClick={() => act({ type: 'start-busy-workshop' })}>
                    Wait for the afternoon visitors
                  </button>
                </details>
              )}
              {state.busyWorkshop && (
                <p className="busy-workshop-note">
                  Busy afternoon · New and recovered parts stay separate. Further switches reach the
                  supplier {dayTime(state.busyWorkshop.restockAt)}.
                </p>
              )}
              {state.jobs
                .filter((project) => project.isPersonal)
                .map((project) => (
                  <TheatrePerformance key={project.id} job={project} />
                ))}
              <div className="workboard-columns">
                {[
                  ['offer', 'Asked of you'],
                  ['active', 'In the workshop'],
                  ['delivered', 'Returned'],
                ].map(([statusKey, label]) => (
                  <details
                    className="board-column"
                    key={statusKey}
                    open={statusKey !== 'delivered'}
                  >
                    <summary>{label}</summary>
                    {state.jobs
                      .filter((j) =>
                        statusKey === 'active'
                          ? ['active', 'ready'].includes(j.status)
                          : j.status === statusKey,
                      )
                      .map((j) =>
                        j.status === 'delivered' ? (
                          <ReturnedHistory
                            key={j.id}
                            job={j}
                            people={state.people}
                            onOpen={() => chooseJob(j)}
                          />
                        ) : (
                          <article className="job-paper" key={j.id}>
                            <p className="eyebrow">
                              <span aria-hidden="true">
                                {j.kind === 'lantern' ? '◈' : j.kind === 'fan' ? '✳' : '♫'}
                              </span>{' '}
                              {state.people[j.ownerId]?.name ??
                                (j.ownerId === 'player' ? 'Your project' : j.ownerId)}
                            </p>
                            <h3>{j.title}</h3>
                            <p>{j.description}</p>
                            {!j.isPersonal && !j.isDonor ? (
                              <div className="promise">
                                <span>
                                  <span aria-hidden="true">◷</span>
                                  <span className="screen-reader-only">Return by </span>{' '}
                                  <strong>{dayTime(j.due)}</strong>
                                </span>
                                <span>
                                  <span className="screen-reader-only">Payment </span>
                                  <strong>{money(j.reward)}</strong>
                                </span>
                              </div>
                            ) : (
                              <p className="personal-purpose">
                                {j.isDonor
                                  ? 'You can recover parts from this object. You have not promised to return it.'
                                  : 'You will keep this project. You have not promised to return it.'}
                              </p>
                            )}
                            <p className="readiness">{jobReadiness(j)}</p>
                            {samFinishedPersonal(j) && (
                              <p className="personal-completion">
                                Sam finished this piece of work. The project stays here.
                              </p>
                            )}
                            {progress.apprenticeshipAvailable &&
                              j.status === 'ready' &&
                              !j.isDonor &&
                              !j.isPersonal &&
                              !j.assignedTo && (
                                <p className="handoff-knowledge">
                                  {evidenceContext(j, 'sam').stage === 'ready'
                                    ? 'You checked the object. Sam has received the results.'
                                    : 'You checked the object. Sam may need to check it again.'}
                                </p>
                              )}
                            {j.kind === 'lantern' &&
                              j.ownerId === 'halil' &&
                              requiredChecks(j).includes('movement') &&
                              state.people.sam?.methods?.rules.some((rule) =>
                                rule.conditions.some(
                                  (c) =>
                                    c.cue === 'requested-use' && c.value === 'lantern:movement',
                                ),
                              ) && (
                                <p className="practice-opportunity">
                                  Sam has watched a repair to a light that is carried. This owner
                                  also needs a light to work while carried. Sam may still need help.
                                </p>
                              )}
                            {j.blocked && (
                              <div className="blocked-responsibility">
                                <strong>Sam has put this repair aside.</strong>
                                <p>{j.blocked.reason}</p>
                              </div>
                            )}
                            <div className="paper-actions">
                              {j.status === 'offer' ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={j.due < state.now}
                                    onClick={() => act({ type: 'accept', jobId: j.id })}
                                  >
                                    {j.due < state.now
                                      ? 'The requested time has passed'
                                      : 'Accept promise'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => act({ type: 'decline', jobId: j.id })}
                                  >
                                    {j.due < state.now ? 'Clear expired request' : 'Decline'}
                                  </button>
                                </>
                              ) : ['active', 'ready'].includes(j.status) ? (
                                <>
                                  <button type="button" onClick={() => chooseJob(j)}>
                                    Open on bench
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionJobId(j.id);
                                      setSheet('job-actions');
                                    }}
                                  >
                                    More ▾
                                  </button>
                                </>
                              ) : (
                                <span>
                                  {j.returnedUnfinished ? 'Returned unfinished' : 'Returned'}
                                </span>
                              )}
                            </div>
                            {!j.isPersonal &&
                              !j.isDonor &&
                              ['active', 'ready'].includes(j.status) &&
                              !requiredChecks(j).every((c) => j.verified.includes(c)) && (
                                <small className="warning">
                                  Test the object as its owner uses it before returning it. You can
                                  also return it unfinished if you say so.
                                </small>
                              )}
                          </article>
                        ),
                      )}
                  </details>
                ))}
              </div>
            </main>
          )}
          {view === 'people' && (
            <main className="people-page">
              {state.pendingRequest?.kind === 'repair' && <SamRequest state={state} act={act} />}
              <div className="page-heading">
                <p className="eyebrow">A shared workshop day</p>
                <h1>People & supplies</h1>
              </div>
              <div className="people-supplies">
                <section className="people-section">
                  <h2>Working together</h2>
                  {state.independentRepairs > 0 && (
                    <div className="capacity-milestone">
                      <p className="eyebrow">Sam completed a whole repair alone.</p>
                      <p>
                        {state.jobs
                          .filter(
                            (j) =>
                              j.status === 'delivered' &&
                              j.completedBy === 'sam' &&
                              !j.returnedUnfinished,
                          )
                          .map((j) => j.title)
                          .join(', ') || 'Sam completed an independent repair.'}
                      </p>
                      <small>
                        You can use that time to repair another object or follow your own plans. Sam
                        may still need teaching when he meets an unfamiliar fault.
                      </small>
                    </div>
                  )}
                  {Object.entries(state.people)
                    .filter(([id]) => id !== 'mum' && (id !== 'halil' || state.day >= 3))
                    .map(([id, person]) => (
                      <article className="person" key={id}>
                        <span className="avatar">{id.slice(0, 1).toUpperCase()}</span>
                        <div>
                          <h3>{person.name}</h3>
                          {admissionFacts(state.castChapter, id) && (
                            <p>
                              {admissionFacts(state.castChapter, id)?.assignment} ·{' '}
                              {admissionFacts(state.castChapter, id)?.life.place.replaceAll(
                                '-',
                                ' ',
                              )}
                            </p>
                          )}
                          <p>
                            {id === 'sam'
                              ? `He is ${Math.floor((state.now - person.life.bornAt) / 525600)} years old. He is a repair apprentice and sometimes works in a kitchen.`
                              : id === 'nora'
                                ? `She is ${Math.floor((state.now - person.life.bornAt) / 525600)} years old. She designs repairs and makes objects.`
                                : id === 'rafi'
                                  ? `He is ${Math.floor((state.now - person.life.bornAt) / 525600)} years old. He washes dishes for work. He is visiting from Bornova, a district in Turkey, to learn repairs.`
                                  : `He is ${Math.floor((state.now - person.life.bornAt) / 525600)} years old. He repairs objects and is visiting the workshop. He now works fewer hours.`}
                          </p>
                          {id in personalReplies && (
                            <PersonalReply state={state} personId={id as PersonalRole} act={act} />
                          )}
                          {!state.discoveries?.includes(id) && (
                            <button
                              type="button"
                              onClick={() =>
                                act({
                                  type: 'ask-about-work',
                                  personId: id as 'sam' | 'nora' | 'rafi' | 'halil',
                                })
                              }
                            >
                              Ask {person.name} about their own experience
                            </button>
                          )}
                          <CastOutcomes state={state} personId={id} act={act} />
                          {id === 'sam' && (
                            <LessonControl
                              state={state}
                              act={act}
                              onBench={() => {
                                setSheet(null);
                                setView('bench');
                              }}
                              onRequestMore={() =>
                                actSequence([
                                  { type: 'watch', enabled: false },
                                  { type: 'request-lesson' },
                                ])
                              }
                            />
                          )}
                          {id === 'sam' && progress.apprenticeshipAvailable ? (
                            <>
                              <p>
                                {state.npcWork.find((w) => w.personId === id)
                                  ? `${person.name} is doing this activity: ${state.npcWork.find((w) => w.personId === id)?.option.label}.`
                                  : describePerson(person).state}
                              </p>
                              {state.npcWork.find((w) => w.personId === id) && (
                                <small>
                                  Until{' '}
                                  {dayTime(
                                    state.npcWork.find((w) => w.personId === id)?.endsAt ??
                                      state.now,
                                  )}
                                </small>
                              )}
                              {playerWordReading(person) && (
                                <p className="word-reading">
                                  {ownerPromiseAccount(person, state.jobs)}
                                </p>
                              )}
                              <div className="commitment-list">
                                {person.agenda.commitments
                                  .filter(
                                    (c) =>
                                      c.status === 'pending' &&
                                      c.actions.includes('personal') &&
                                      c.until >= state.now,
                                  )
                                  .map((c) => (
                                    <p key={`${c.label}-${c.from}`}>
                                      <strong>Planned: {c.label}</strong>
                                      <small>
                                        {dayTime(c.from)} – {dayTime(c.until)}
                                      </small>
                                    </p>
                                  ))}
                              </div>
                              <h4 className="knowledge-heading">Observed repair methods</h4>
                              <p className="knowledge-note">
                                Sam learned by watching. He has completed this many repairs alone:{' '}
                                {state.independentRepairs}.
                              </p>
                              <p className="knowledge-note">
                                These are the conditions Sam saw. They do not guarantee a successful
                                repair.
                              </p>
                              <div className="knowledge-list">
                                {person.methods?.rules.length ? (
                                  describePerson(person).learned.map((method, index) => (
                                    <article key={person.methods?.rules[index]?.id}>
                                      <p>{method}</p>
                                    </article>
                                  ))
                                ) : (
                                  <p className="empty-knowledge">
                                    Sam has not watched a repair demonstration yet.
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              {state.npcWork.find((w) => w.personId === id) && (
                                <p className="customer-activity">
                                  {person.name} is doing this activity:{' '}
                                  {state.npcWork.find((w) => w.personId === id)?.option.label}.
                                  <small>
                                    Until{' '}
                                    {dayTime(
                                      state.npcWork.find((w) => w.personId === id)?.endsAt ??
                                        state.now,
                                    )}
                                  </small>
                                </p>
                              )}
                              {playerWordReading(person) && (
                                <p className="word-reading">
                                  {ownerPromiseAccount(person, state.jobs)}
                                </p>
                              )}
                              <p className="person-role">
                                {id === 'mum'
                                  ? 'Family objects at home'
                                  : id === 'nora'
                                    ? 'Neighbourhood projects'
                                    : 'Household repairs and collection promises'}
                              </p>
                              {state.jobs
                                .filter(
                                  (j) =>
                                    j.ownerId === id &&
                                    !j.isDonor &&
                                    !['declined', 'salvaged'].includes(j.status),
                                )
                                .map((j) => (
                                  <div className="customer-ask" key={j.id}>
                                    <strong>{j.title}</strong>
                                    <p>{j.description}</p>
                                    <small>
                                      {jobReadiness(j)}
                                      {['offer', 'active', 'ready'].includes(j.status)
                                        ? ` · Return ${dayTime(j.due)}`
                                        : ''}
                                    </small>
                                  </div>
                                ))}
                              <div className="commitment-list">
                                {person.agenda.commitments
                                  .filter(
                                    (c) =>
                                      c.status === 'pending' &&
                                      c.actions.includes('personal') &&
                                      c.until >= state.now,
                                  )
                                  .map((c) => (
                                    <p key={`${c.label}-${c.from}`}>
                                      <strong>Planned: {c.label}</strong>
                                      <small>
                                        {dayTime(c.from)} – {dayTime(c.until)}
                                      </small>
                                    </p>
                                  ))}
                              </div>
                            </>
                          )}
                          <details>
                            <summary>What {person.name} said</summary>
                            {state.log
                              .filter((l) => l.speaker.toLowerCase() === id.toLowerCase())
                              .slice(-8)
                              .map((l) => (
                                <div key={l.id}>
                                  <p>{accountParts(l.text).words}</p>
                                  {accountParts(l.text).limits && (
                                    <details>
                                      <summary>Narrator limits</summary>
                                      <p>{accountParts(l.text).limits}</p>
                                    </details>
                                  )}
                                </div>
                              ))}
                          </details>
                        </div>
                      </article>
                    ))}
                </section>
                <section className="stock-section">
                  <h2>Supplies</h2>
                  <h3>Parts drawer</h3>
                  {latestRecoveryAccount(state) && (
                    <p>Latest recovery: {latestRecoveryAccount(state)}</p>
                  )}
                  <p>Replacing a part uses one spare part. Buying spare parts uses cash.</p>
                  {state.busyWorkshop && <p>Recovered counts are included in the totals below.</p>}
                  <div className="stock-list">
                    {Object.entries(PART_PRICES).map(([kind, price]) => (
                      <div key={kind}>
                        <h4
                          className="part-name"
                          id={partSupplyTarget(kind as ComponentKind)}
                          tabIndex={-1}
                        >
                          {kind}
                        </h4>
                        <strong>
                          {state.stock[kind as ComponentKind] ?? 0}
                          <small>
                            {' '}
                            in stock
                            {state.busyWorkshop
                              ? ` · ${state.busyWorkshop.recoveredStock[kind as ComponentKind] ?? 0} recovered`
                              : ''}
                          </small>
                        </strong>
                        <small>{money(price as number)} · 20 min supplier trip</small>
                        <button
                          type="button"
                          onClick={() => act({ type: 'buy', part: kind as ComponentKind })}
                        >
                          Buy · {money(price as number)} · 20 min
                        </button>
                      </div>
                    ))}
                  </div>
                  <h2 className="upgrade-heading">Workshop improvements</h2>
                  <div className="upgrades">
                    {UPGRADE_CATALOG.map((upgrade) => (
                      <div key={upgrade.id}>
                        <strong>{upgrade.name}</strong>
                        <p>
                          {upgrade.id === 'second-bench'
                            ? state.upgrades.includes(upgrade.id)
                              ? 'You and Sam can use separate benches.'
                              : state.npcWork.some(
                                    (w) =>
                                      w.personId === 'sam' &&
                                      w.jobId &&
                                      ![
                                        'rest',
                                        'eat',
                                        'drink',
                                        'personal',
                                        'ask-help',
                                        'accept-repair',
                                        'decline-repair',
                                      ].includes(w.option.action),
                                  )
                                ? `Sam is using the shared bench. A second bench lets you work on another object beside him.`
                                : 'You can use the shared bench when Sam takes a break or follows his own plans. A second bench lets you both repair objects at once.'
                            : upgrade.description}
                        </p>
                        <button
                          type="button"
                          disabled={state.upgrades.includes(upgrade.id)}
                          onClick={() => act({ type: 'upgrade', id: upgrade.id })}
                        >
                          {state.upgrades.includes(upgrade.id)
                            ? 'Installed'
                            : `Buy · ${money(upgrade.price)}`}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </main>
          )}
          {view !== 'bench' && (
            <div className="page-action-bar">
              {result}
              <div>{dayActions}</div>
            </div>
          )}
        </div>
      )}
      {isEnd && (
        <div className="end-page">
          <div className="end-body">
            <p className="eyebrow">Your first week is complete.</p>
            <h2>Your first week</h2>
            <p>The first week is over. Here is what happened.</p>
            <button
              type="button"
              className="primary-action"
              onClick={() => act({ type: 'continue' })}
            >
              Keep the workshop open
            </button>
            <details className="tally-fold">
              <summary>See the tally ▸</summary>
              <WorkshopTally state={state} enabled />
            </details>
            {state.community?.phase === 'completed' && (
              <>
                <CommunityScene
                  event={state.community}
                  people={state.people}
                  selected={state.community.preparedFormats[0] ?? 'garden'}
                  stage="activity"
                  jobs={state.jobs}
                />
                <p className="recorded-caption">
                  This record shows the afternoon’s completed activities and prepared equipment.
                </p>
              </>
            )}
            <div className="week-working-objects">
              <h3>What can be used again</h3>
              {state.jobs
                .filter(
                  (j) =>
                    !j.isDonor &&
                    !j.returnedUnfinished &&
                    requiredChecks(j).every((c) => j.verified.includes(c)),
                )
                .map((j) => (
                  <p key={j.id}>
                    <strong>{j.title}</strong> ·{' '}
                    {j.status === 'delivered'
                      ? `returned to ${state.people[j.ownerId]?.name ?? j.ownerId}`
                      : 'kept at the workshop'}{' '}
                    · tested{' '}
                    {requiredChecks(j)
                      .map((check) => testWords[check])
                      .join(' and ')}
                  </p>
                ))}
              {!state.jobs.some(
                (j) =>
                  !j.isDonor &&
                  !j.returnedUnfinished &&
                  requiredChecks(j).every((c) => j.verified.includes(c)),
              ) && (
                <p>
                  No required use test is recorded as complete. Your unfinished work is still saved.
                </p>
              )}
            </div>
            <section className="end-people">
              <h3>What people did</h3>
              {state.community?.phase === 'completed' ? (
                state.community.decisions.map((d) => (
                  <p key={d.personId}>
                    {state.people[d.personId]?.name ?? d.personId} · {d.activityLabel} ·{' '}
                    {d.completed ? 'completed' : 'not completed'}
                  </p>
                ))
              ) : (
                <p>Sam completed {state.independentRepairs} independent repairs.</p>
              )}
            </section>
            <SamWorkAccount jobs={state.jobs} />
            <dl className="week-account">
              <div>
                <dt>Checked returns</dt>
                <dd>
                  {
                    state.jobs.filter((j) => j.status === 'delivered' && !j.returnedUnfinished)
                      .length
                  }
                </dd>
              </div>
              <div>
                <dt>Unfinished returns</dt>
                <dd>
                  {
                    state.jobs.filter((j) => j.status === 'delivered' && j.returnedUnfinished)
                      .length
                  }
                </dd>
              </div>
              <div>
                <dt>Independent repairs</dt>
                <dd>{state.independentRepairs}</dd>
              </div>
              <div>
                <dt>Workshop cash</dt>
                <dd>{money(state.cash)}</dd>
              </div>
              <div>
                <dt>Open promises</dt>
                <dd>
                  {
                    state.jobs.filter(
                      (j) => ['active', 'ready'].includes(j.status) && !j.isDonor && !j.isPersonal,
                    ).length
                  }
                </dd>
              </div>
            </dl>
            {state.community && (
              <p className="week-community">
                <strong>Community afternoon:</strong>{' '}
                {state.community.phase === 'completed'
                  ? state.community.outcome
                  : 'No completed afternoon is recorded yet.'}
              </p>
            )}
            <p>
              Your promises stay open on the next day. You keep your parts and learned repair
              methods.
            </p>
          </div>
          <div className="end-actions">
            <div>
              <button type="button" onClick={openFeedback}>
                Feedback
              </button>
              {!continuity.fileSession && (
                <button type="button" onClick={exportSave}>
                  Download this workshop
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {infoOpen && (
        <>
          <button
            className="info-backdrop"
            type="button"
            aria-label="Close information"
            onClick={() => setInfoOpen(false)}
          />
          <aside className="info-popover" role="dialog" aria-label={info[0]}>
            <button
              type="button"
              className="close-sheet"
              aria-label="Close information"
              onClick={() => setInfoOpen(false)}
            >
              ×
            </button>
            <h2>{info[0]}</h2>
            {info.slice(1).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </aside>
        </>
      )}
      {sheet && (
        <div className="sheet-backdrop">
          <button
            type="button"
            className="sheet-dismiss"
            aria-label="Close sheet"
            onClick={() => setSheet(null)}
          />
          <section
            ref={sheetRef}
            className={`shell-sheet sheet-${sheet}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              sheet === 'menu'
                ? 'Workshop'
                : sheet === 'job-actions'
                  ? actionJob?.title
                  : sheet === 'job'
                    ? job?.title
                    : sheet === 'day'
                      ? 'The day'
                      : 'The workshop’s history'
            }
          >
            <button
              className="close-sheet"
              type="button"
              aria-label="Close sheet"
              onClick={() => setSheet(null)}
            >
              ×
            </button>
            {sheet === 'menu' && (
              <>
                <h2>Workshop</h2>
                <p>
                  {continuity.fileSession
                    ? 'Progress stays in this tab. Download the game file to keep it.'
                    : 'Your game is saved on this device.'}{' '}
                  Time stops while you are away.
                </p>
                {entryError && <p role="alert">{entryError}</p>}

                {continuity.fileSession && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onCloseFile?.();
                    }}
                  >
                    Close file session
                  </button>
                )}
                <button className="reading-row" type="button" onClick={() => setSheet('history')}>
                  The workshop's history <span>▸</span>
                </button>
                <button
                  className="reading-row"
                  type="button"
                  onClick={() => {
                    setSheet(null);
                    openFeedback();
                  }}
                >
                  Feedback <span>▸</span>
                </button>
                <button type="button" onClick={exportSave}>
                  Download this workshop
                </button>
                {!continuity.fileSession && (
                  <a href="/file/" onClick={(event) => void goToGames(event)}>
                    Open a saved workshop
                  </a>
                )}
                <button
                  className="reading-row fullscreen-row"
                  type="button"
                  onClick={() => {
                    if (document.fullscreenElement) void document.exitFullscreen();
                    else void document.documentElement.requestFullscreen?.();
                  }}
                >
                  Full screen
                </button>
                {!continuity.fileSession && (
                  <button type="button" onClick={() => setNewConfirmed(true)}>
                    New game
                  </button>
                )}
                {!continuity.fileSession && newConfirmed && (
                  <div className="inline-confirm">
                    <p>Replace the saved workshop on this device?</p>
                    <button
                      type="button"
                      disabled={entering}
                      onClick={() => void startWorkshop(freshSeed())}
                    >
                      Start new game
                    </button>
                    <button type="button" onClick={() => setNewConfirmed(false)}>
                      Cancel
                    </button>
                  </div>
                )}
                <a
                  className="reading-row"
                  href="https://human.adamwhite.work/games/"
                  onClick={(event) => void goToGames(event)}
                >
                  All games
                </a>
                <a
                  href="https://human.adamwhite.work/lab/people/"
                  onClick={(event) => void goToGames(event)}
                >
                  People across games
                </a>
                <div className="recording-footer">
                  <label>
                    <input
                      type="checkbox"
                      checked={eventsOn}
                      onChange={(e) => {
                        lab.setTelemetryOff(!e.target.checked);
                        setEventsOn(lab.telemetryOn);
                      }}
                    />{' '}
                    Recording
                  </label>
                  {privacyTools()}
                </div>
                <a href="/experiments/" onClick={(event) => void goToGames(event)}>
                  Older versions of this game
                </a>
                <button
                  className="primary-action"
                  type="button"
                  disabled={entering}
                  onClick={() => void enterWorkshop()}
                >
                  Resume
                </button>
              </>
            )}
            {sheet === 'day' && (
              <>
                <h2>The day</h2>
                <p>{dayTime(state.now)}</p>
                {workday(true)}
                <p>The workshop closes in {Math.max(0, 1020 - (state.now % 1440))} min.</p>
                {dueToday.map((j) => (
                  <p key={j.id}>
                    ◷ {j.title} · {dayTime(j.due)}
                  </p>
                ))}
                <div className="day-sheet-actions">{dayActions}</div>
                {result}
              </>
            )}
            {sheet === 'job' && job && (
              <>
                <h2>{job.title}</h2>
                <p>
                  {state.people[job.ownerId]?.name ??
                    (job.ownerId === 'player' ? 'Your project' : 'Its owner')}
                </p>
                <p>{job.description}</p>
                {!job.isPersonal && !job.isDonor && (
                  <p>The owner requested this object back by {dayTime(job.due)}.</p>
                )}
                <RecentConversation
                  key={conversationSession}
                  lines={todaysWords(state)}
                  canAskSam={!guided && !state.pendingRequest && !state.watching}
                  onAskSam={() => act({ type: 'request-lesson' })}
                />
                {!guided && progress.apprenticeshipAvailable && (
                  <button
                    type="button"
                    disabled={Boolean(state.pendingRequest) || state.watching}
                    onClick={() => act({ type: 'request-lesson' })}
                  >
                    Ask Sam to watch
                  </button>
                )}
                <h3>On the bench</h3>
                {state.jobs
                  .filter((j) => j.status !== 'declined')
                  .map((j) => (
                    <div className="bench-picker-row" key={j.id}>
                      <span>
                        {j.title}
                        {j.assignedTo
                          ? ' · with Sam'
                          : j.status === 'delivered'
                            ? ' · returned'
                            : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          chooseJob(j);
                          setSheet(null);
                        }}
                      >
                        Open
                      </button>
                    </div>
                  ))}
              </>
            )}
            {sheet === 'job-actions' && actionJob && (
              <>
                <h2>{actionJob.title}</h2>
                <p>
                  {state.people[actionJob.ownerId]?.name ??
                    (actionJob.ownerId === 'player' ? 'Your project' : 'Its owner')}
                </p>
                <p>“{actionJob.description}”</p>
                <p>{jobReadiness(actionJob)}</p>
                {actionJob.blocked && (
                  <p>Sam has put this repair aside: {actionJob.blocked.reason}</p>
                )}
                {!actionJob.isPersonal && !actionJob.isDonor && (
                  <p>
                    The owner requested this object back by {dayTime(actionJob.due)}. The payment is{' '}
                    {money(actionJob.reward)}.
                  </p>
                )}
                {!requiredChecks(actionJob).every((c) => actionJob.verified.includes(c)) && (
                  <p>
                    Test the object as its owner uses it before returning it. You can also return it
                    unfinished if you say so.
                  </p>
                )}
                {actionJob.status === 'ready' && progress.apprenticeshipAvailable && (
                  <p>
                    {evidenceContext(actionJob, 'sam').stage === 'ready'
                      ? 'Sam has received your test results.'
                      : 'Sam may need to check the object again.'}
                  </p>
                )}
                {['active', 'ready'].includes(actionJob.status) ? (
                  responsibilityActions(actionJob)
                ) : (
                  <p>{jobReadiness(actionJob)}</p>
                )}
                {result}
              </>
            )}
            {sheet === 'history' && (
              <>
                <h2>The workshop's history</h2>
                {[...state.log].reverse().map((line) => (
                  <div key={line.id}>
                    <p>
                      <time>{dayTime(line.at)}</time> <strong>{line.speaker}</strong>{' '}
                      {accountParts(line.text).words}
                    </p>
                    {accountParts(line.text).limits && (
                      <details>
                        <summary>Narrator limits</summary>
                        <p>{accountParts(line.text).limits}</p>
                      </details>
                    )}
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
