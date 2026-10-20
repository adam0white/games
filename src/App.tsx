import { useEffect, useRef, useState } from 'react';
import { CommunityPanel } from './components/CommunityPanel';
import { CommunityScene } from './components/CommunityScene';
import { FirstRepairGuide } from './components/FirstRepairGuide';
import { LessonControl } from './components/LessonControl';
import { PhysicalObjectScene } from './components/PhysicalObjectScene';
import { ReadingComparison } from './components/ReadingComparison';
import { RecentConversation } from './components/RecentConversation';
import { ReturnedHistory } from './components/ReturnedHistory';
import { ReturnReceipt } from './components/ReturnReceipt';
import { SamRequest } from './components/SamRequest';
import { SamWorkAccount } from './components/SamWorkAccount';
import { TeachingRecord } from './components/TeachingRecord';
import { WorkshopPause } from './components/WorkshopPause';
import {
  createGame,
  dayRemaining,
  dayTime,
  dispatch,
  jobReadiness,
  loadGame,
  PART_PRICES,
  requiredChecks,
  saveGame,
  UPGRADE_CATALOG,
  upgradeRules,
} from './game/engine';
import { evidenceContext } from './game/evidence-context';
import { governorMultipliers } from './game/model';
import { describePerson, playerWordReading } from './game/people';
import { replayRecordedRun } from './game/replay';
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
import './styles.css';
import './focused-layout.css';
import './meter-layout.css';
import './clarity.css';

const SAVE_KEY = 'small-works-save-v5';
/** Engine-4 autosaves are read once, upgraded and written to the v5 key; the v4 key itself is never changed. */
const LEGACY_SAVE_KEY = 'small-works-save-v4';
const conditions: TestCondition[] = ['bench', 'movement', 'load'];
const money = (n: number) => `£${n.toFixed(0)}`;
function checkPurpose(job: Job): string {
  const required = requiredChecks(job);
  if (job.kind === 'lantern')
    return required.includes('movement')
      ? 'Check that the light survives being carried.'
      : 'Check sustained light under demand for the owner’s reading.';
  if (job.kind === 'fan') return 'Check airflow under the resistance of the fitted filter.';
  return `Check the drive at the owner’s requested ${job.model.desiredRPM ?? 15} ± ${job.model.tolerance ?? 3} rpm under load.`;
}
function samFinishedPersonal(job: Job): boolean {
  if (!job.isPersonal || job.completedBy !== 'sam') return false;
  const completion = job.contributions.findLast(
    (c) => c.actorId === 'sam' && c.action === 'complete-project',
  );
  const lastWork = job.evidence.findLast((e) => e.kind === 'work')?.at ?? 0;
  return Boolean(completion && completion.at >= lastWork);
}
function initial(): GameState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) return upgradeRules(loadGame(saved));
  } catch {
    /* A damaged save does not overwrite historical saves. */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacy) return upgradeRules(loadGame(legacy));
  } catch {
    /* An engine-4 save that no longer loads stays untouched under its own key. */
  }
  return createGame(42);
}
function Device({
  job,
  selected,
  onSelect,
  probeA,
  probeB,
  condition,
  collarPreview,
  onTerminal,
  activeProbe,
  suggestedTerminal,
  suggestedPart,
}: {
  probeA: string;
  probeB: string;
  condition: TestCondition;
  collarPreview?: number;
  onTerminal: (terminal: string) => void;
  activeProbe: string;
  suggestedTerminal?: string;
  suggestedPart?: string;
  job: Job;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const lastUse = [...job.evidence].reverse().find((e) => e.kind === 'use');
  const observed = lastUse?.summary.match(/(?:reaches |at )(\d+(?:\.\d+)?)(%| rpm)/);
  const output = observed ? Number(observed[1]) : 0;
  return (
    <div className={`device-stage ${job.kind}`}>
      <svg viewBox="0 0 620 400" role="img" aria-label={`${job.title} component layout`}>
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
          return (
            <g
              key={c.id}
              transform={`translate(${x},${y})`}
              className={`${selected === c.id ? 'component selected' : 'component'} ${suggestedPart === c.id ? 'guide-component' : ''}`}
            >
              <path d="M-35 0 H35" />
              {/* biome-ignore lint/a11y/useSemanticElements: This is the component target in an SVG diagram. */}
              <rect
                x="-29"
                y="-21"
                width="58"
                height="42"
                rx="5"
                role="button"
                tabIndex={0}
                aria-label={`Select ${c.label}`}
                onClick={() => onSelect(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(c.id);
                  }
                }}
              />

              {c.terminals.map((terminal, terminalIndex) => (
                // biome-ignore lint/a11y/useSemanticElements: SVG terminals have native HTML keyboard equivalents in the meter.
                <g
                  key={terminal}
                  className={
                    terminal === suggestedTerminal
                      ? 'terminal-hit suggested-terminal'
                      : 'terminal-hit'
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`Place probe ${activeProbe.toUpperCase()} at terminal ${terminal}`}
                  onClick={() => onTerminal(terminal)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onTerminal(terminal);
                    }
                  }}
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
              <text y="42" textAnchor="middle" className="diagram-label">
                {c.label}
              </text>
            </g>
          );
        })}
        <text x="20" y="24" className="diagram-caption">
          {`FUNCTIONAL LAYOUT · ${condition.toUpperCase()} CONDITION`}
        </text>
      </svg>
      <details className="alternative-parts">
        <summary>Choose a component by name</summary>
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
      </details>
    </div>
  );
}
export default function App() {
  const [state, setState] = useState(initial);
  const [eventsOn, setEventsOn] = useState(lab.eventsOn);
  useEffect(() => {
    lab.screen('play');
    lab.milestone('run started');
    const sync = () => setEventsOn(lab.eventsOn);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('change', sync);
    };
  }, []);
  const [conversationSession, setConversationSession] = useState(0);
  const [view, setView] = useState('bench');
  const [paused, setPaused] = useState(false);
  const [pane, setPane] = useState<'object' | 'meter' | 'repair' | 'notes'>('object');
  const [opened, setOpened] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(
    () => localStorage.getItem(`small-works-intro-${state.seed}`) === 'skipped',
  );
  const progress = firstRepairProgress(state);
  const guided = !introSkipped && !progress.workshopAvailable;
  const skipIntro = () => {
    localStorage.setItem(`small-works-intro-${state.seed}`, 'skipped');
    setIntroSkipped(true);
  };

  const [replayChecking, setReplayChecking] = useState(false);
  const [replayStatus, setReplayStatus] = useState('');
  const stateRef = useRef(state);
  stateRef.current = state;
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
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const job = state.jobs.find((j) => j.id === state.selectedJobId) ?? state.jobs[0];
  const jobLocked = Boolean(
    job &&
      (!['active', 'ready'].includes(job.status) ||
        job.assignedTo ||
        state.community?.reservedJobIds.includes(job.id) ||
        (state.pendingRequest?.kind === 'repair' && state.pendingRequest.jobId === job.id)),
  );
  const lastReading = [...(job?.evidence ?? [])].reverse().find((e) => e.kind === 'measurement');
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
    localStorage.setItem(SAVE_KEY, saveGame(state));
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
              setTeachingFeedback('Sam has no recorded observation of this step.');
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
                  ? 'Sam attended this intervention. A relevant observed outcome check is still needed before it becomes a retained repair method.'
                  : 'Sam saw this work but had no relevant baseline observation after the previous intervention. A later check cannot show what this step changed.',
              );
            } else if (step.kind === 'use' && step.cues.signal !== 'steady-output')
              setTeachingFeedback(
                'Sam attended this check. It did not demonstrate a successful repair.',
              );
            else if (step.kind === 'use') {
              const oldIds = new Set(prior.people.sam?.methods?.rules.map((r) => r.id) ?? []);
              const added = next.people.sam?.methods?.rules.filter((r) => !oldIds.has(r.id)) ?? [];
              setTeachingFeedback(
                added.length
                  ? `Sam attended the check and retained ${added.length} new observed method${added.length === 1 ? '' : 's'}. See his methods in People.`
                  : 'Sam attended this check. No new retained repair method was added by this step.',
              );
            } else setTeachingFeedback('Sam has a recorded observation of this step.');
          }
        }

        if (command.type === 'measure' && result.ok) {
          const reading = next.jobs
            .find((j) => j.id === command.jobId)
            ?.evidence.findLast((e) => e.kind === 'measurement');
          const interpretations: Record<string, string> = {
            'high-drop': 'Large voltage drop across this measured span.',
            'low-source': 'Source voltage is below the normal source reference.',
            voltage: 'Voltage recorded for this probe pair and condition.',
            'open-path': 'No conducting path between these terminals.',
            resistance: 'Resistance is above the conducting-link reference.',
            connected: 'A conducting path is present between these terminals.',
            rotation: 'Shaft motion recorded. Compare with the drive reference in Notes.',
            'slow-drive': 'The observed shaft turns slowly.',
            'blocked-drive': 'No motion at the observed shaft.',
            'power-off': 'The object is switched off.',
          };
          messages.push(
            interpretations[reading?.cues.signal ?? ''] ?? reading?.summary ?? result.message,
          );
        } else messages.push(result.message);
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
    const url = URL.createObjectURL(new Blob([saveGame(state)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `small-works-day-${state.day}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const verifyReplay = async () => {
    if (state.inputs === undefined) {
      setReplayStatus(
        'Replay unavailable: this save has no complete input recording. Older saves and runs beyond the 10,000-action limit cannot be verified this way.',
      );
      return;
    }
    const snapshot = state;
    const expected = saveGame(snapshot);
    setReplayChecking(true);
    setReplayStatus('Replaying recorded actions…');
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
        },
        expected,
      );
      setReplayStatus(
        result.ok
          ? saveGame(stateRef.current) === expected
            ? `Replayed ${snapshot.inputs?.length ?? 0} recorded actions to this exact workshop state.`
            : 'The recorded snapshot replayed exactly, but your workshop has since changed. Verify the current state again.'
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
    if (menu.current) menu.current.open = false;
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
    setIntroSkipped(!fresh && localStorage.getItem(`small-works-intro-${next.seed}`) === 'skipped');
    if (fresh) localStorage.removeItem(`small-works-intro-${next.seed}`);
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
      onTerminal={chooseTerminal}
      activeProbe={activeProbe}
      suggestedTerminal={suggestedTerminal}
      suggestedPart={guided ? progress.suggestedPart : undefined}
    />
  );
  if (paused)
    return <WorkshopPause state={state} onReturn={() => setPaused(false)} onExport={exportSave} />;
  return (
    <div className={`workshop focused-workshop ${guided ? 'is-guided' : ''}`}>
      <header className="focused-header">
        <a className="hf-mark" href="https://human.adamwhite.work">
          ◇ human framework
        </a>
        {!guided && (
          <nav aria-label="Workshop">
            <button
              type="button"
              aria-current={view === 'bench' ? 'page' : undefined}
              onClick={() => setView('bench')}
            >
              Workbench
            </button>
            <button
              type="button"
              aria-current={view === 'board' ? 'page' : undefined}
              onClick={() => setView('board')}
            >
              Workboard
            </button>
            <button
              type="button"
              aria-current={view === 'people' ? 'page' : undefined}
              onClick={() => setView('people')}
            >
              People & supplies
            </button>
          </nav>
        )}
        <details ref={menu} className="workshop-menu">
          <summary>
            Workshop <span aria-hidden="true">☰</span>
          </summary>
          <div className="workshop-menu-content">
            <p>
              {dayTime(state.now)} · {dayRemaining(state)} min until closing
            </p>
            <p>
              {money(state.cash)} available · seed {state.seed}
            </p>
            {guided && (
              <button type="button" onClick={skipIntro}>
                Put this aside · explore workshop
              </button>
            )}
            <button type="button" onClick={() => act({ type: 'wait', minutes: 30 })}>
              Wait 30 min
            </button>
            <button type="button" onClick={() => act({ type: 'next-day' })}>
              Close for the day
            </button>
            <button type="button" onClick={exportSave}>
              Export workshop
            </button>
            <button
              type="button"
              onClick={() => lab.openSendDialog({ getRun: () => JSON.parse(saveGame(state)) })}
            >
              Send this run to the notebook
            </button>
            <label>
              <input
                type="checkbox"
                checked={eventsOn}
                onChange={(e) => {
                  lab.setEventsOff(!e.target.checked);
                  setEventsOn(lab.eventsOn);
                }}
              />{' '}
              Anonymous play events
            </label>
            <a href="https://human.adamwhite.work/lab/privacy/">Privacy</a>
            <button type="button" onClick={() => input.current?.click()}>
              Import workshop
            </button>
            <button type="button" disabled={replayChecking} onClick={verifyReplay}>
              {replayChecking ? 'Verifying replay…' : 'Verify recorded replay'}
            </button>
            <button
              type="button"
              onClick={() => {
                const seed = window.prompt('New workshop seed:', String(state.seed + 1));
                if (seed !== null && Number.isFinite(Number(seed)))
                  resetPresentation(createGame(Number(seed)), true);
              }}
            >
              New workshop
            </button>
            <a href="/experiments/">Earlier experiments</a>
            <small>Saved automatically on this device. Time waits while you are away.</small>
            {replayStatus && <p role="status">{replayStatus}</p>}
            <details>
              <summary>History</summary>
              {[...state.log].reverse().map((l) => (
                <p key={l.id}>
                  <time>{dayTime(l.at)}</time> <strong>{l.speaker}</strong> {l.text}
                </p>
              ))}
            </details>
          </div>
        </details>
        <input
          ref={input}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            try {
              const file = e.target.files?.[0];
              if (file) resetPresentation(upgradeRules(loadGame(await file.text())));
            } catch (error) {
              setStatus(
                error instanceof Error ? error.message : 'This save could not be imported.',
              );
            }
            e.target.value = '';
          }}
        />
      </header>
      {!guided && workshopCrises(state).length > 0 && (
        <ul className="workshop-crises" aria-label="Needs attention">
          {workshopCrises(state)
            .slice(0, 3)
            .map((c) => {
              const target = state.jobs.find((j) => j.id === c.jobId);
              return (
                <li key={`${c.jobId}-${c.text}`} className={c.urgent ? 'is-urgent' : undefined}>
                  <button
                    type="button"
                    onClick={() => (c.people ? setView('people') : target && chooseJob(target))}
                  >
                    {c.text}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
      <RecentConversation
        key={conversationSession}
        lines={todaysWords(state)}
        canAskSam={!state.pendingRequest && !state.watching}
        onAskSam={() => act({ type: 'request-lesson' })}
      />
      {view === 'bench' && job && (
        <main className={`focused-bench ${showTools ? 'tools-visible' : ''} active-${pane}`}>
          <div className="focused-owner">
            <p className="eyebrow">{state.people[job.ownerId]?.name ?? job.ownerId}</p>
            <h1>{job.title}</h1>
            <p>{job.description}</p>
          </div>
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
          {!guided && (
            <div className="focused-shelf">
              <label>
                On the bench{' '}
                <select
                  value={job.id}
                  onChange={(e) => {
                    const next = state.jobs.find((j) => j.id === e.target.value);
                    if (next) chooseJob(next);
                  }}
                >
                  {state.jobs
                    .filter((j) => j.status !== 'declined')
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                        {j.assignedTo ? ' · with Sam' : ''}
                        {j.status === 'delivered' ? ' · returned' : ''}
                      </option>
                    ))}
                </select>
              </label>
              <span>
                {dayTime(state.now)} · {money(state.cash)}
              </span>
            </div>
          )}
          <div
            className={`focused-workspace ${showTools ? 'tools-open' : 'object-only'} ${showTools && pane !== 'object' ? 'instrument-focused' : ''}`}
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
              {!showTools && result}
              {job.status === 'ready' && !job.isDonor && !job.isPersonal && (
                <button
                  type="button"
                  className="primary-action focused-return"
                  disabled={jobLocked}
                  onClick={() => act({ type: 'deliver', jobId: job.id })}
                >
                  Return to {state.people[job.ownerId]?.name ?? job.ownerId}
                  <small>10 min</small>
                </button>
              )}
              {job.status === 'delivered' && (
                <ReturnReceipt job={job} people={state.people} onNext={() => setView('board')} />
              )}
              {jobLocked && job.status !== 'delivered' && (
                <p className="focused-lock">
                  {job.assignedTo
                    ? 'Sam has this object.'
                    : state.community?.reservedJobIds.includes(job.id)
                      ? 'Reserved for the gathering.'
                      : 'This object is read-only.'}
                </p>
              )}
            </section>
            {showTools && (
              <section className="focused-tools" aria-label="Bench tools">
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
                  id={`pane-${pane}`}
                  aria-labelledby={`tab-${pane}`}
                  className={`focused-pane pane-${pane}`}
                >
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
                                : '◉ Under load'}
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
                  {pane === 'object' && (
                    <div className="focused-action">
                      <h2>{part?.label ?? 'Choose a component'}</h2>
                      <button
                        type="button"
                        disabled={!part || jobLocked}
                        onClick={() =>
                          part && act({ type: 'inspect', jobId: job.id, componentId: part.id })
                        }
                      >
                        Look closely <small>10 min</small>
                      </button>
                    </div>
                  )}
                  {pane === 'meter' && (
                    <div className="meter-controls">
                      <div className="meter-screen">
                        <span>
                          {lastReading?.request
                            ? `${lastReading.request.mode} · ${lastReading.request.condition}`
                            : 'No reading yet'}
                        </span>
                        <strong>
                          {lastReading?.value === undefined || lastReading.value === null
                            ? '—'
                            : lastReading.value.toFixed(2)}
                          <small>{lastReading?.unit}</small>
                        </strong>
                        <small>
                          {lastReading?.request
                            ? `${lastReading.request.a} → ${lastReading.request.b} · ${dayTime(lastReading.at)}`
                            : 'Place both probes on terminals'}
                          {lastReading && lastWorkId > lastReading.id
                            ? ' · recorded before later work'
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
                                : '◉ Under load'}
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
                          Switch power {mode === 'continuity' ? 'off' : 'on'} for {mode}.
                        </p>
                      )}
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
                    </div>
                  )}
                  {pane === 'meter' && diagram}
                  {pane === 'repair' && (
                    <>
                      <button
                        type="button"
                        disabled={!part || jobLocked}
                        onClick={() =>
                          part && act({ type: 'inspect', jobId: job.id, componentId: part.id })
                        }
                      >
                        Look closely <small>10 min</small>
                      </button>
                      <h2>{part?.label ?? 'Choose a component'}</h2>
                      {state.watching &&
                        part &&
                        !hasPendingPartLesson &&
                        !hasComponentBaseline &&
                        !hasCalibrationBaseline && (
                          <p className="teaching-baseline-notice">
                            Before another intervention on this part, let Sam watch a relevant test.
                            That gives him an observation to compare with the outcome.
                          </p>
                        )}
                      <div className="focused-repairs">
                        {(['clean', 'adjust', 'replace'] as const)
                          .filter((action) => !(action === 'adjust' && part?.kind === 'governor'))
                          .map((action) => (
                            <button
                              type="button"
                              key={action}
                              className={
                                guided && progress.phase === 'repair' && action === 'replace'
                                  ? 'guided-replace'
                                  : ''
                              }
                              disabled={
                                jobLocked ||
                                !part ||
                                (action === 'replace' && !(state.stock[part.kind] ?? 0))
                              }
                              onClick={() =>
                                part &&
                                act({
                                  type: 'work',
                                  jobId: job.id,
                                  componentId: part.id,
                                  intervention: action,
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
                                    : 'Choose a component'
                                  : '20 min'}
                              </small>
                              {state.watching &&
                                state.watchUntil !== undefined &&
                                state.now + (action === 'replace' ? 30 : 20) > state.watchUntil && (
                                  <em>After Sam’s agreed time</em>
                                )}
                            </button>
                          ))}
                      </div>
                      {part?.kind === 'governor' && (
                        <div className="governor-control">
                          <p>Collar setting {part.setting ?? 2}</p>
                          <div>
                            {[0, 1, 2, 3, 4].map((setting) => (
                              <button
                                type="button"
                                key={setting}
                                aria-pressed={(collarPreview ?? part.setting ?? 2) === setting}
                                onClick={() => setCollarPreview(setting)}
                              >
                                {setting}
                              </button>
                            ))}
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
                          </div>
                        </div>
                      )}
                      {job.isDonor && (
                        <button
                          type="button"
                          disabled={!part || jobLocked}
                          onClick={() =>
                            part && act({ type: 'salvage', jobId: job.id, componentId: part.id })
                          }
                        >
                          Recover part · 25 min
                        </button>
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
                      <details>
                        <summary>Reference</summary>
                        <p>{checkPurpose(job)}</p>
                        {job.kind === 'music-box' ? (
                          <div className="drive-reference">
                            <p>
                              Nominal motion path. Probe a shaft against the stationary frame,
                              terminal 0.
                            </p>
                            <ol>
                              <li>
                                <strong>Spring · A</strong>
                                <span>Rated drive {job.model.ratedDrive ?? 120} rpm</span>
                              </li>
                              <li>
                                <strong>Gear · B</strong>
                                <span>Divide input by {job.model.gearRatio ?? 4}</span>
                              </li>
                              <li>
                                <strong>Governor · C</strong>
                                <span>Multiply by the collar factor</span>
                              </li>
                              <li>
                                <strong>Drum · D</strong>
                                <span>Divide governor output by 2</span>
                              </li>
                            </ol>
                            <table>
                              <caption>Governor collar reference</caption>
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
                                  <th scope="row">Factor</th>
                                  {governorMultipliers.map((factor) => (
                                    <td key={factor}>×{factor}</td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                            <p>
                              Owner’s requested drum output:{' '}
                              <strong>
                                {job.model.desiredRPM ?? 15} ± {job.model.tolerance ?? 3} rpm
                              </strong>
                              . These ratios describe the mechanism; compare actual readings across
                              the path and under the requested condition.
                            </p>
                          </div>
                        ) : (
                          <p>
                            A nominal source supplies {job.model.sourceVolts} V. Healthy conducting
                            links usually drop less than 0.2 V. Compare the same probe pair on the
                            table and under the condition that caused trouble.
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
                        Applying the collar would finish after Sam’s agreed time.
                      </p>
                    )}
                  {result}
                  {pane !== 'notes' && state.watching && job.pendingLessons.length > 0 && (
                    <TeachingRecord job={job} />
                  )}
                </div>
              </section>
            )}
          </div>
          {samPresent && (
            <details className="focused-sam">
              <summary>
                Sam ·{' '}
                {state.people.sam ? describePerson(state.people.sam).state : 'Not at the bench'}
                {state.watching
                  ? ` · ${Math.max(0, (state.watchUntil ?? state.now) - state.now)} min agreed time`
                  : ''}
              </summary>
              {progress.apprenticeshipAvailable && <SamRequest state={state} act={act} />}
              <LessonControl
                state={state}
                act={act}
                onRequestMore={() =>
                  actSequence([{ type: 'watch', enabled: false }, { type: 'request-lesson' }])
                }
              />
            </details>
          )}
        </main>
      )}
      {view !== 'bench' && status && (
        <p className="focused-result" role="status">
          {status}
        </p>
      )}
      {view === 'board' && (
        <main className="board-page">
          {progress.apprenticeshipAvailable && <SamRequest state={state} act={act} />}
          <CommunityPanel
            state={state}
            act={act}
            onPause={() => setPaused(true)}
            onOpenJob={(id) => {
              const object = state.jobs.find((j) => j.id === id);
              if (object) chooseJob(object);
            }}
          />
          <div className="page-heading">
            <p className="eyebrow">Promises, not a queue</p>
            <h1>The workboard</h1>
            <p>Choose what this workshop can finish. Time, parts and people are shared.</p>
          </div>
          <div className="workboard-columns">
            {[
              ['offer', 'Incoming requests'],
              ['active', 'At the workshop'],
              ['delivered', 'Returned objects'],
            ].map(([statusKey, label]) => (
              <section className="board-column" key={statusKey}>
                <h2>{label}</h2>
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
                              ? 'Parts donor · no customer return promise'
                              : 'Your retained project · no customer return promise'}
                          </p>
                        )}
                        <p className="readiness">{jobReadiness(j)}</p>
                        {samFinishedPersonal(j) && (
                          <p className="personal-completion">
                            Sam finished this piece of work; the project stays here.
                          </p>
                        )}
                        {progress.apprenticeshipAvailable &&
                          j.status === 'ready' &&
                          !j.isDonor &&
                          !j.isPersonal &&
                          !j.assignedTo && (
                            <p className="handoff-knowledge">
                              {evidenceContext(j, 'sam').stage === 'ready'
                                ? 'Checked by you; Sam has received the checks.'
                                : 'Checked by you; Sam may need to recheck.'}
                            </p>
                          )}
                        {j.kind === 'lantern' &&
                          j.ownerId === 'evan' &&
                          requiredChecks(j).includes('movement') &&
                          state.people.sam?.methods?.rules.some((rule) =>
                            rule.conditions.some(
                              (c) => c.cue === 'requested-use' && c.value === 'lantern:movement',
                            ),
                          ) && (
                            <p className="practice-opportunity">
                              Sam has watched carried-light work; this is another carried-light
                              request. He may still need help.
                            </p>
                          )}
                        {j.blocked && (
                          <div className="blocked-responsibility">
                            <strong>Sam has put this repair aside</strong>
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
                                {j.due < state.now ? 'Requested time passed' : 'Accept promise'}
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
                              {j.blocked ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      actSequence([
                                        { type: 'recall', jobId: j.id },
                                        { type: 'request-lesson' },
                                      ])
                                    }
                                  >
                                    Review together<small>Take object back · request lesson</small>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => act({ type: 'retry-sam', jobId: j.id })}
                                  >
                                    Retry after teaching
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => act({ type: 'recall', jobId: j.id })}
                                  >
                                    Take over / cancel responsibility
                                  </button>
                                </>
                              ) : !progress.apprenticeshipAvailable ||
                                j.isDonor ||
                                samFinishedPersonal(j) ? null : (
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
                                    ? 'Recall'
                                    : j.status === 'ready' &&
                                        evidenceContext(j, 'sam').stage === 'ready' &&
                                        !j.isPersonal
                                      ? 'Ask Sam to return the checked object'
                                      : 'Ask Sam to take repair responsibility'}
                                </button>
                              )}
                              {!j.isPersonal && !j.isDonor && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => act({ type: 'deliver', jobId: j.id })}
                                  >
                                    Return checked object
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      act({ type: 'deliver', jobId: j.id, unfinished: true })
                                    }
                                  >
                                    Return unfinished
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <span>{j.returnedUnfinished ? 'Returned unfinished' : 'Returned'}</span>
                          )}
                        </div>
                        {!j.isPersonal &&
                          !j.isDonor &&
                          ['active', 'ready'].includes(j.status) &&
                          !requiredChecks(j).every((c) => j.verified.includes(c)) && (
                            <small className="warning">
                              Check the owner’s use before returning, or choose an honest unfinished
                              return.
                            </small>
                          )}
                      </article>
                    ),
                  )}
              </section>
            ))}
          </div>
        </main>
      )}
      {view === 'people' && (
        <main className="people-page">
          {progress.apprenticeshipAvailable && <SamRequest state={state} act={act} />}
          <div className="page-heading">
            <p className="eyebrow">A shared workshop day</p>
            <h1>People & supplies</h1>
          </div>
          <div className="people-supplies">
            <section className="people-section">
              <h2>Working together</h2>
              {state.independentRepairs > 0 && (
                <div className="capacity-milestone">
                  <p className="eyebrow">A whole repair handled independently</p>
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
                    You can spend that workshop time on another object or your own plans. Future
                    unfamiliar faults may still need teaching.
                  </small>
                </div>
              )}
              {progress.apprenticeshipAvailable && !state.pendingRequest && (
                <LessonControl
                  state={state}
                  act={act}
                  onRequestMore={() =>
                    actSequence([{ type: 'watch', enabled: false }, { type: 'request-lesson' }])
                  }
                />
              )}
              {Object.entries(state.people).map(([id, person]) => (
                <article className="person" key={id}>
                  <span className="avatar">{id.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <h3>{person.name}</h3>
                    {id === 'sam' && progress.apprenticeshipAvailable ? (
                      <>
                        <p>
                          {state.npcWork.find((w) => w.personId === id)?.option.label ??
                            describePerson(person).state}
                        </p>
                        {state.npcWork.find((w) => w.personId === id) && (
                          <small>
                            Until{' '}
                            {dayTime(
                              state.npcWork.find((w) => w.personId === id)?.endsAt ?? state.now,
                            )}
                          </small>
                        )}
                        {playerWordReading(person) && (
                          <p className="word-reading">
                            {person.name} {playerWordReading(person)}.
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
                                <strong>{c.label}</strong>
                                <small>
                                  {dayTime(c.from)} – {dayTime(c.until)}
                                </small>
                              </p>
                            ))}
                        </div>
                        <h4 className="knowledge-heading">Observed repair methods</h4>
                        <p className="knowledge-note">
                          Attended demonstrations. Independent whole repairs:{' '}
                          {state.independentRepairs}.
                        </p>
                        <p className="knowledge-note">
                          Conditions observed when taught; not an outcome or a guarantee.
                        </p>
                        <div className="knowledge-list">
                          {person.methods?.rules.length ? (
                            person.methods.rules.map((rule) => {
                              const action = rule.action.split(':');
                              const label =
                                action[0] === 'work'
                                  ? `${action[1]} ${action[2] ?? 'component'}`
                                  : action[0] === 'measure'
                                    ? `Measure ${action[1] ?? 'electrical response'}`
                                    : action[0] === 'verify'
                                      ? `Check ${action[1] ?? 'use'}`
                                      : rule.action.replaceAll('-', ' ').replaceAll(':', ' ');
                              return (
                                <article key={rule.id}>
                                  <strong>Observed: {label}</strong>
                                  <p>
                                    {rule.conditions
                                      .filter((c) => c.cue === 'signal')
                                      .map((c) => String(c.value).replaceAll('-', ' '))
                                      .join(', ') || 'A workshop demonstration'}
                                  </p>
                                </article>
                              );
                            })
                          ) : (
                            <p className="empty-knowledge">
                              Sam has not yet attended a repair demonstration.
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {state.npcWork.find((w) => w.personId === id) && (
                          <p className="customer-activity">
                            Now: {state.npcWork.find((w) => w.personId === id)?.option.label}
                            <small>
                              Until{' '}
                              {dayTime(
                                state.npcWork.find((w) => w.personId === id)?.endsAt ?? state.now,
                              )}
                            </small>
                          </p>
                        )}
                        {playerWordReading(person) && (
                          <p className="word-reading">
                            {person.name} {playerWordReading(person)}.
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
                                <strong>{c.label}</strong>
                                <small>
                                  {dayTime(c.from)} – {dayTime(c.until)}
                                </small>
                              </p>
                            ))}
                        </div>
                      </>
                    )}
                    <details>
                      <summary>Actual reports</summary>
                      {state.log
                        .filter((l) => l.speaker.toLowerCase() === id.toLowerCase())
                        .slice(-8)
                        .map((l) => (
                          <p key={l.id}>{l.text}</p>
                        ))}
                    </details>
                  </div>
                </article>
              ))}
            </section>
            <section className="stock-section">
              <h2>Parts drawer</h2>
              <p>Replacing a component uses one part. Buying stock uses cash.</p>
              <div className="stock-list">
                {Object.entries(PART_PRICES).map(([kind, price]) => (
                  <div key={kind}>
                    <span className="part-name">{kind}</span>
                    <strong>
                      {state.stock[kind as ComponentKind] ?? 0}
                      <small> in stock</small>
                    </strong>
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
                            : 'The shared bench is available during Sam’s breaks and personal plans. A second bench lets both of you do hands-on repair at once.'
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
      {state.ended && (
        <div className="ending-banner">
          <p className="eyebrow">First week complete</p>
          <h2>Your first week, recorded.</h2>
          <p>The calendar closes this chapter. These are the outcomes of your choices.</p>
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
                Recorded afternoon · actual completed activities and prepared equipment.
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
                    : 'retained at the workshop'}{' '}
                  · checked for {requiredChecks(j).join(', ')}
                </p>
              ))}
            {!state.jobs.some(
              (j) =>
                !j.isDonor &&
                !j.returnedUnfinished &&
                requiredChecks(j).every((c) => j.verified.includes(c)),
            ) && <p>No completed required use check is recorded. Unfinished work remains saved.</p>}
          </div>
          <button type="button" className="primary-action" onClick={() => setPaused(true)}>
            Close the workshop for now<small>Saved here · time waits</small>
          </button>
          <SamWorkAccount jobs={state.jobs} />
          <dl className="week-account">
            <div>
              <dt>Checked returns</dt>
              <dd>
                {state.jobs.filter((j) => j.status === 'delivered' && !j.returnedUnfinished).length}
              </dd>
            </div>
            <div>
              <dt>Unfinished returns</dt>
              <dd>
                {state.jobs.filter((j) => j.status === 'delivered' && j.returnedUnfinished).length}
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
                : 'No completed afternoon outcome is recorded yet.'}
            </p>
          )}
          <p>Open promises, parts and acquired methods continue into the next workshop day.</p>
          <button type="button" onClick={() => act({ type: 'continue' })}>
            Keep the workshop open →
          </button>
          <button type="button" onClick={exportSave}>
            Export this milestone
          </button>
          <button
            type="button"
            disabled={replayChecking}
            aria-busy={replayChecking}
            onClick={verifyReplay}
          >
            {replayChecking ? 'Verifying replay…' : 'Verify recorded replay'}
          </button>
        </div>
      )}
      <footer className="hf-notebooks">
        <a href="https://human.adamwhite.work/games/">◇ all notebooks</a>
      </footer>
    </div>
  );
}
