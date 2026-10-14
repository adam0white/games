import { useEffect, useRef, useState } from 'react';
import { BenchHistory } from './components/BenchHistory';
import { CommunityPanel } from './components/CommunityPanel';
import { CommunityScene } from './components/CommunityScene';
import { LessonControl } from './components/LessonControl';
import { ReadingComparison } from './components/ReadingComparison';
import { ReturnedHistory } from './components/ReturnedHistory';
import { ReturnReceipt } from './components/ReturnReceipt';
import { SamRequest } from './components/SamRequest';
import { TeachingRecord } from './components/TeachingRecord';
import { WorkshopPause } from './components/WorkshopPause';
import { eventOptions } from './game/community';
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
} from './game/engine';
import { evidenceContext } from './game/evidence-context';
import { describePerson } from './game/people';
import { replayRecordedRun } from './game/replay';
import type {
  Command,
  ComponentKind,
  GameState,
  Job,
  MeterMode,
  TestCondition,
} from './game/types';
import './styles.css';

const SAVE_KEY = 'small-works-save-v3';
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
function checkLabel(job: Job): string {
  if (job.kind === 'lantern')
    return requiredChecks(job).includes('movement') ? 'Carry the light' : 'Run the reading light';
  if (job.kind === 'fan') return 'Test with filter';
  return job.isPersonal
    ? 'Run the paper figures'
    : job.ownerId === 'sam'
      ? 'Run Sam’s toy'
      : 'Check requested pace';
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
    if (saved) return loadGame(saved);
  } catch {
    /* A damaged save does not overwrite historical saves. */
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
}: {
  probeA: string;
  probeB: string;
  condition: TestCondition;
  collarPreview?: number;
  onTerminal: (terminal: string) => void;
  activeProbe: string;
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
              className={selected === c.id ? 'component selected' : 'component'}
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
                  className="terminal-hit"
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
        {(() => {
          const reading = [...job.evidence]
            .reverse()
            .find((e) => e.kind === 'measurement' && e.request);
          if (!reading?.request) return null;
          const component = job.model.components.find(
            (c) =>
              c.terminals.includes(reading.request?.a ?? '') &&
              c.terminals.includes(reading.request?.b ?? ''),
          );
          const stale = job.evidence.some((e) => e.kind === 'work' && e.id > reading.id);
          return (
            <g
              className="diagram-reading"
              transform={`translate(${component ? component.x * 6 : 310} ${component ? component.y * 4 + 66 : 53})`}
            >
              <rect
                x="-94"
                y="-12"
                width="188"
                height="37"
                rx="3"
                fill="#1d2b22"
                stroke="#6b8056"
              />
              <text textAnchor="middle" fill="#e4d4a5" fontSize="10">
                {reading.value === null
                  ? '—'
                  : `${reading.value?.toFixed(2) ?? '—'} ${reading.unit ?? ''}`}{' '}
                · {reading.request.condition}
                {stale ? ' · recorded' : ''}
              </text>
              <text y="15" textAnchor="middle" fill="#9db78b" fontSize="8">
                {reading.request.a} → {reading.request.b} · {dayTime(reading.at)}
              </text>
            </g>
          );
        })()}
        <text x="20" y="24" className="diagram-caption">
          {`FUNCTIONAL LAYOUT · ${condition.toUpperCase()} CONDITION`}
        </text>
      </svg>
      {lastUse && (
        <p className="observed-use">
          <span>Last observed use</span>
          {job.kind === 'music-box'
            ? lastUse.summary.replaceAll('melody', 'drive')
            : lastUse.summary}
          <small>{dayTime(lastUse.at)} · retained observation</small>
        </p>
      )}
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
  );
}
export default function App() {
  const [state, setState] = useState(initial);
  const [view, setView] = useState('bench');
  const [paused, setPaused] = useState(false);
  const [replayChecking, setReplayChecking] = useState(false);
  const [replayStatus, setReplayStatus] = useState('');
  const stateRef = useRef(state);
  stateRef.current = state;
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<MeterMode>('voltage');
  const [condition, setCondition] = useState<TestCondition>('bench');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [activeProbe, setActiveProbe] = useState<'a' | 'b'>('a');
  const [status, setStatus] = useState('');
  const [lastAction, setLastAction] = useState('');
  const [teachingFeedback, setTeachingFeedback] = useState('');
  const [collarPreview, setCollarPreview] = useState<number | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
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
  const gatheringOptions = state.community ? eventOptions(state, state.community) : [];
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
    setLastAction(commands.at(-1)?.type ?? '');
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

        messages.push(result.message);
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
        { seed: snapshot.seed, inputs: snapshot.inputs, provenance: snapshot.provenance },
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
  if (paused)
    return <WorkshopPause state={state} onReturn={() => setPaused(false)} onExport={exportSave} />;
  return (
    <div className="workshop">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark">sw</span>
          <span>
            Small Works<small>A neighbourhood repair workshop</small>
          </span>
        </div>
        <div className="day-clock">
          <span>
            DAY {state.day} / {state.day <= 7 ? 'FIRST WEEK' : 'CONTINUING WORK'}
          </span>
          <strong>{dayTime(state.now)}</strong>
          <small>{dayRemaining(state)} min until 17:00 closing</small>
        </div>
        <div className="resources">
          <span>
            Workshop cash<strong>{money(state.cash)}</strong>
          </span>
          <span>
            Reputation<strong>{state.reputation}</strong>
          </span>
        </div>
      </header>
      <div className="toolbar">
        <nav aria-label="Workshop">
          <button
            type="button"
            className={view === 'bench' ? 'active' : ''}
            onClick={() => setView('bench')}
          >
            01 <span>Workbench</span>
          </button>
          <button
            type="button"
            className={view === 'board' ? 'active' : ''}
            onClick={() => setView('board')}
          >
            02 <span>Workboard</span>
            <i>{state.jobs.filter((j) => j.status === 'offer').length}</i>
          </button>
          <button
            type="button"
            className={view === 'people' ? 'active' : ''}
            onClick={() => setView('people')}
          >
            03 <span>People & supplies</span>
          </button>
        </nav>
        <div className="time-actions">
          <button type="button" onClick={() => act({ type: 'wait', minutes: 30 })}>
            Wait 30 min
          </button>
          <button type="button" className="end-day" onClick={() => act({ type: 'next-day' })}>
            Close workshop →
          </button>
        </div>
      </div>
      <p
        className="status"
        role={
          view === 'bench' &&
          ['inspect', 'work', 'calibrate', 'verify', 'measure', 'power'].includes(lastAction)
            ? undefined
            : 'status'
        }
      >
        {status || 'Every test and repair uses workshop time. Your people work while you do.'}
        {status &&
        state.pendingRequest?.status === 'ready' &&
        state.pendingRequest.readyUntil !== undefined
          ? ` Start before ${dayTime(state.pendingRequest.readyUntil)}.`
          : ''}
      </p>
      {view === 'bench' && (
        <nav className="mobile-bench-nav" aria-label="Bench shortcuts">
          <a href="#object-bench">Object</a>
          <a href="#repair-controls">Repair</a>
          <a href="#meter-panel">Meter</a>
          <a href="#evidence-panel">Notes</a>
        </nav>
      )}
      {view === 'bench' && job && (
        <main className="bench-layout">
          <aside className="job-shelf">
            <p className="eyebrow">On the shelf</p>
            {state.jobs
              .filter((j) => ['active', 'ready'].includes(j.status))
              .map((j) => (
                <button
                  type="button"
                  key={j.id}
                  className={j.id === job.id ? 'shelf-item active' : 'shelf-item'}
                  onClick={() => chooseJob(j)}
                >
                  <span className="object-glyph">
                    {j.kind === 'lantern' ? '◈' : j.kind === 'fan' ? '✳' : '▧'}
                  </span>
                  <strong>{j.title}</strong>
                  <small>{j.assignedTo ? `With ${j.assignedTo}` : jobReadiness(j)}</small>
                  {gatheringOptions
                    .filter((o) => o.jobId === j.id)
                    .map((o) => (
                      <span className="use-badge" key={o.format}>
                        Gathering · {o.format}
                        {o.prepared ? ' prepared' : o.ready ? ' ready' : ' needs check'}
                      </span>
                    ))}
                </button>
              ))}
            {state.jobs
              .filter(
                (j) => j.status === 'delivered' && !j.returnedUnfinished && j.ownerId === 'mum',
              )
              .map((j) => (
                <div className="keepsake" key={j.id}>
                  <span className="keepsake-object">◈</span>
                  <strong>{j.title}</strong>
                  <small>Back in family use</small>
                  <button type="button" onClick={() => chooseJob(j)}>
                    Read its notebook
                  </button>
                </div>
              ))}
            <button type="button" className="text-button" onClick={() => setView('board')}>
              View incoming work →
            </button>
            {state.independentRepairs > 0 && (
              <div className="capacity-note">
                <p className="eyebrow">A responsibility changed</p>
                <p>
                  {state.jobs
                    .filter(
                      (j) =>
                        j.status === 'delivered' &&
                        j.completedBy === 'sam' &&
                        !j.returnedUnfinished,
                    )
                    .slice(-1)
                    .map((j) => `Sam handled ${j.title.toLowerCase()} through its return.`)
                    .join(' ')}
                </p>
                <small>You can choose another object while he handles a familiar repair.</small>
              </div>
            )}
            <div className="bench-note">
              <span>THE WORKSHOP RULE</span>
              <p>A light on the bench is a start. Check how the owner will use it.</p>
            </div>
          </aside>
          <section className="bench-main" id="object-bench">
            <div className="object-heading">
              <div>
                <p className="eyebrow">
                  {job.isPersonal
                    ? 'Personal work'
                    : job.isDonor
                      ? 'Donor object'
                      : `For ${job.ownerId}`}{' '}
                  · {job.kind.replace('-', ' ')}
                </p>
                <h1>{job.title}</h1>
              </div>
              <button
                type="button"
                className={job.model.power ? 'power on' : 'power'}
                disabled={jobLocked}
                onClick={() => act({ type: 'power', jobId: job.id, on: !job.model.power })}
              >
                <span /> Power {job.model.power ? 'on' : 'off'}
              </button>
            </div>
            <p className="owner-request">{job.description}</p>
            {samFinishedPersonal(job) && (
              <p className="personal-completion">
                Sam finished this piece of work; the project stays here.
              </p>
            )}
            {job.assignedTo && (
              <p className="loan-notice">
                Sam has responsibility for this object. Choose another object while he works, or
                take it back from the workboard.
              </p>
            )}
            {['delivered', 'salvaged', 'declined'].includes(job.status) && (
              <p className="loan-notice">
                Retained notebook. This object is no longer on your bench.
              </p>
            )}
            {gatheringOptions
              .filter((o) => o.jobId === job.id)
              .map((o) => (
                <p className="object-event-use" key={o.format}>
                  <strong>{o.label}</strong> · {o.reason}
                </p>
              ))}{' '}
            <div className="verification required-verification">
              <div>
                <p className="eyebrow">
                  {job.isDonor ? 'Donor function test' : 'Required use check'}
                </p>
                <span>
                  {job.isDonor
                    ? 'This object is for parts. Function tests are optional and do not create a return promise.'
                    : checkPurpose(job)}
                </span>
              </div>
              {requiredChecks(job).map((c) => (
                <button
                  type="button"
                  key={c}
                  className={job.verified.includes(c) ? 'verified' : ''}
                  disabled={jobLocked}
                  onClick={() => act({ type: 'verify', jobId: job.id, condition: c })}
                >
                  {job.verified.includes(c) ? '✓ Checked' : checkLabel(job)}
                  <small>15 min · {c}</small>
                  {state.watching &&
                    state.watchUntil !== undefined &&
                    state.now + 15 > state.watchUntil && (
                      <em className="lesson-overrun">Sam will not observe this check</em>
                    )}
                </button>
              ))}
            </div>
            {job.status === 'ready' && !job.isDonor && !job.isPersonal && (
              <button
                type="button"
                className="bench-return"
                disabled={jobLocked}
                onClick={() => act({ type: 'deliver', jobId: job.id })}
              >
                Return to {state.people[job.ownerId]?.name ?? job.ownerId}
                <small>10 min · checked for the owner’s use</small>
              </button>
            )}
            {job.status === 'delivered' && (
              <ReturnReceipt job={job} people={state.people} onNext={() => setView('board')} />
            )}
            {state.community?.reservedJobIds.includes(job.id) && (
              <p className="loan-notice">
                On loan at the community site until {dayTime(state.community.finishesAt)}. Repair
                and assignment wait until the object returns.
              </p>
            )}
            <div className="bench-companion">
              <div>
                <span className="companion-dot" />
                <strong>Sam</strong>
                <span>
                  {state.npcWork.find((w) => w.personId === 'sam')?.option.label ??
                    (state.people.sam ? describePerson(state.people.sam).state : 'Away')}
                </span>
              </div>
              {state.pendingRequest ? (
                <SamRequest state={state} act={act} compact />
              ) : (
                <LessonControl
                  state={state}
                  act={act}
                  onRequestMore={() =>
                    actSequence([{ type: 'watch', enabled: false }, { type: 'request-lesson' }])
                  }
                />
              )}
              {state.people.sam?.agenda.commitments
                .filter(
                  (c) =>
                    c.status === 'pending' &&
                    c.actions.includes('personal') &&
                    c.until >= state.now,
                )
                .map((c) => (
                  <p key={`${c.label}-${c.from}`}>
                    <strong>{c.label}</strong> · {dayTime(c.from)} – {dayTime(c.until)}
                  </p>
                ))}
              {state.log.filter((l) => l.speaker === 'Sam').at(-1) && (
                <details className="companion-report">
                  <summary>Sam’s latest report</summary>
                  <p>{state.log.filter((l) => l.speaker === 'Sam').at(-1)?.text}</p>
                </details>
              )}
            </div>
            <BenchHistory
              archived={['delivered', 'salvaged', 'declined'].includes(job.status)}
              title="Retained device diagram and repair controls"
            >
              <Device
                job={job}
                selected={selected}
                onSelect={(id) => {
                  setSelected(id);
                  setCollarPreview(undefined);
                }}
                probeA={a}
                probeB={b}
                condition={condition}
                collarPreview={collarPreview}
                onTerminal={chooseTerminal}
                activeProbe={activeProbe}
              />
              {state.watching && part && !jobLocked && !hasComponentBaseline && (
                <p className="baseline-notice">
                  {hasCalibrationBaseline
                    ? 'Sam has an observed motion baseline for calibration only. Cleaning or replacing still needs a relevant component reading or use test.'
                    : 'Sam has no relevant baseline observation after the last intervention. Let him observe a relevant measurement or use test before this work.'}
                </p>
              )}
              <div className="intervention" id="repair-controls">
                <div>
                  <p className="eyebrow">Selected component</p>
                  <h2>{part?.label ?? 'Choose a component'}</h2>
                  <p>
                    {part
                      ? 'Compare observations, then choose what the evidence supports.'
                      : 'The diagram shows the structure, not the hidden fault.'}
                  </p>
                </div>
                <div className="intervention-actions">
                  <button
                    type="button"
                    disabled={!part || jobLocked}
                    onClick={() =>
                      part && act({ type: 'inspect', jobId: job.id, componentId: part.id })
                    }
                  >
                    Inspect <small>10 min</small>
                    {state.watching &&
                      state.watchUntil !== undefined &&
                      state.now + 10 > state.watchUntil && (
                        <em className="lesson-overrun">After Sam’s agreed time</em>
                      )}
                  </button>
                  {(['clean', 'adjust', 'replace'] as const)
                    .filter((action) => !(action === 'adjust' && part?.kind === 'governor'))
                    .map((action) => (
                      <button
                        type="button"
                        disabled={
                          jobLocked ||
                          !part ||
                          (action === 'replace' && !(state.stock[part.kind] ?? 0))
                        }
                        key={action}
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
                        {state.watching &&
                          state.watchUntil !== undefined &&
                          state.now + (action === 'replace' ? 30 : 20) > state.watchUntil && (
                            <em className="lesson-overrun">Sam will not observe this step</em>
                          )}
                        <small>
                          {action === 'replace'
                            ? part
                              ? (state.stock[part.kind] ?? 0) > 0
                                ? `30 min · 1 ${part.kind} (${state.stock[part.kind]} stocked)`
                                : `No ${part.kind} stocked · buy or recover one`
                              : 'Choose a component'
                            : '20 min'}
                        </small>
                      </button>
                    ))}
                  {job.isDonor && (
                    <button
                      type="button"
                      disabled={!part || jobLocked}
                      onClick={() =>
                        part && act({ type: 'salvage', jobId: job.id, componentId: part.id })
                      }
                    >
                      Recover part<small>25 min · sacrifices object</small>
                    </button>
                  )}
                </div>
              </div>
              {['inspect', 'work', 'calibrate', 'verify'].includes(lastAction) && status && (
                <p className="local-status bench-action-status" role="status">
                  {status}
                  {teachingFeedback && (
                    <small className="step-observation">{teachingFeedback}</small>
                  )}
                </p>
              )}
              {part?.kind === 'governor' && (
                <div className="governor-control">
                  <p>
                    <strong>Governor collar · current setting {part.setting ?? 2}</strong>
                    <br />
                    Choose a setting to preview the collar. Applying it uses 20 minutes. Measure the
                    resulting motion before judging the change.
                  </p>
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
                      className="apply-collar"
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
                      Set collar<small>20 min</small>
                      {state.watching &&
                        state.watchUntil !== undefined &&
                        state.now + 20 > state.watchUntil && (
                          <em className="lesson-overrun">After Sam’s agreed time</em>
                        )}
                    </button>
                  </div>
                </div>
              )}
              <details className="bench-reference">
                <summary>Device reference · structure and test conditions</summary>
                <p>
                  {job.kind === 'music-box'
                    ? `The spring is rated at ${job.model.ratedDrive ?? 120} rpm. The gear reduction is ${job.model.gearRatio ?? 4}:1. The owner requests ${job.model.desiredRPM ?? 15} ± ${job.model.tolerance ?? 3} rpm under load. Collar settings 0–4 multiply the governor shaft by 0.4, 0.8, 1.0, 1.2 and 1.6; the drum turns at half that shaft speed. Compare shaft motion on the bench and under load. Choose a setting, then measure again.`
                    : 'The nominal supply is 6 V. A and B share the supply wire. Measure a point against 0 for its voltage level; measure across a component for its drop. A healthy conducting switch or contact usually drops less than 0.2 V. Compare the same probe pair on the bench and under load. Power off before continuity tests. Movement checks handling; load checks performance under demand.'}
                </p>
                <ul>
                  {job.model.components.map((c) => (
                    <li key={c.id}>
                      {c.label}: {c.terminals.join(' → ')}
                    </li>
                  ))}
                </ul>
              </details>
              <details className="optional-checks">
                <summary>Optional diagnostic use tests</summary>
                <p>
                  These observations may help diagnosis. They do not replace the owner’s required
                  use check.
                </p>
                <div>
                  {conditions
                    .filter((c) => !requiredChecks(job).includes(c))
                    .map((c) => (
                      <button
                        type="button"
                        key={c}
                        disabled={jobLocked}
                        onClick={() => act({ type: 'verify', jobId: job.id, condition: c })}
                      >
                        {c === 'bench'
                          ? 'Try basic operation'
                          : c === 'movement'
                            ? 'Test while handling'
                            : 'Test under demand'}
                        <small>15 min · {c}</small>
                      </button>
                    ))}
                </div>
              </details>
            </BenchHistory>
          </section>
          <aside className="instruments">
            <section className="meter" id="meter-panel">
              <div className="instrument-heading">
                <span>WORKSHOP METER</span>
                <small>SW—01</small>
              </div>
              <div className="meter-screen">
                <span>
                  {lastReading?.request?.mode.toUpperCase() ?? 'NO READING'} ·{' '}
                  {lastReading?.request?.condition.toUpperCase() ?? 'READY'}
                </span>
                <strong>
                  {(() => {
                    const reading = [...job.evidence]
                      .reverse()
                      .find((e) => e.kind === 'measurement');
                    return reading?.value === null
                      ? '—'
                      : reading?.value === undefined
                        ? '—'
                        : reading.value.toFixed(2);
                  })()}
                  <small>
                    {[...job.evidence].reverse().find((e) => e.kind === 'measurement')?.unit ?? ' '}
                  </small>
                </strong>
                <small>
                  {lastReading?.request
                    ? `${lastReading.request.a} → ${lastReading.request.b} · ${dayTime(lastReading.at)}`
                    : 'Choose two terminals to begin'}
                  {lastReading &&
                  job.evidence.some((e) => e.kind === 'work' && e.id > lastReading.id)
                    ? ' · before later work'
                    : ''}
                </small>
              </div>
              <BenchHistory
                archived={['delivered', 'salvaged', 'declined'].includes(job.status)}
                title="Retained meter settings · read-only"
              >
                <div className="segmented">
                  {(['voltage', 'continuity', 'motion'] as const).map((m) => (
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
                <label className="field-label">
                  Test condition
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as TestCondition)}
                  >
                    {conditions.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <div className="probe-tabs">
                  <button
                    type="button"
                    aria-pressed={activeProbe === 'a'}
                    onClick={() => setActiveProbe('a')}
                  >
                    Place probe A
                  </button>
                  <button
                    type="button"
                    aria-pressed={activeProbe === 'b'}
                    onClick={() => setActiveProbe('b')}
                  >
                    Place probe B
                  </button>
                </div>
                <div className="terminal-buttons">
                  {terminals.map((t) => (
                    <button
                      type="button"
                      key={t}
                      className={(a === t ? 'probe-a ' : '') + (b === t ? 'probe-b' : '')}
                      onClick={() => {
                        if (activeProbe === 'a') {
                          setA(t);
                          setActiveProbe('b');
                        } else {
                          setB(t);
                          setActiveProbe('a');
                        }
                      }}
                    >
                      {t}
                      <small>
                        {a === t ? 'A' : ''}
                        {b === t ? ' B' : ''}
                      </small>
                    </button>
                  ))}
                </div>
                <p className="probe-pair">
                  Probe A: <strong>{a || 'not placed'}</strong> · Probe B:{' '}
                  <strong>{b || 'not placed'}</strong>
                  <small>Click a diagram terminal or use the terminal buttons.</small>
                </p>
                {(mode === 'continuity' && job.model.power) ||
                (mode !== 'continuity' && !job.model.power) ? (
                  <button
                    type="button"
                    className="meter-power"
                    disabled={jobLocked}
                    onClick={() => act({ type: 'power', jobId: job.id, on: mode !== 'continuity' })}
                  >
                    {mode === 'continuity' ? 'Power off first' : 'Turn power on first'}
                    <small>Required for {mode} · no time cost</small>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="meter-power quiet"
                    disabled={jobLocked}
                    onClick={() => act({ type: 'power', jobId: job.id, on: !job.model.power })}
                  >
                    Power {job.model.power ? 'on' : 'off'} · toggle
                  </button>
                )}
                <button
                  type="button"
                  className="measure-button"
                  disabled={
                    jobLocked ||
                    !a ||
                    !b ||
                    (mode === 'continuity' && job.model.power) ||
                    (mode !== 'continuity' && !job.model.power)
                  }
                  onClick={() =>
                    act({ type: 'measure', jobId: job.id, request: { mode, a, b, condition } })
                  }
                >
                  Take reading <span>10 min →</span>
                  {state.watching &&
                    state.watchUntil !== undefined &&
                    state.now + 10 > state.watchUntil && (
                      <em className="lesson-overrun">After Sam’s agreed time</em>
                    )}
                </button>
                {['measure', 'power'].includes(lastAction) && status && (
                  <p className="local-status" role="status">
                    {status}
                    {lastAction === 'measure' && teachingFeedback && (
                      <small className="step-observation">{teachingFeedback}</small>
                    )}
                  </p>
                )}
                <p className="meter-help">
                  Voltage compares two points with power on. Continuity checks a path with power
                  off. Motion checks the mechanical drive.
                </p>
              </BenchHistory>
            </section>
            <section className="evidence-ledger" id="evidence-panel">
              <p className="eyebrow">Evidence notebook</p>
              <h2>What you know</h2>
              <ReadingComparison job={job} />
              <TeachingRecord job={job} />
              {job.evidence.length === 0 ? (
                <p className="empty">
                  No observations yet.
                  <br />A useful test rules something out.
                </p>
              ) : (
                <>
                  <ol>
                    {job.evidence
                      .slice(-3)
                      .reverse()
                      .map((e) => (
                        <li key={e.id}>
                          <time>{dayTime(e.at)}</time>
                          <p>{e.summary}</p>
                        </li>
                      ))}
                  </ol>
                  <details>
                    <summary>All {job.evidence.length} observations</summary>
                    <ol>
                      {job.evidence.map((e) => (
                        <li key={e.id}>
                          <time>
                            {dayTime(e.at)} · {e.kind}
                          </time>
                          <p>{e.summary}</p>
                          {e.request && (
                            <small>
                              {e.request.a} → {e.request.b} · {e.request.condition}
                            </small>
                          )}
                        </li>
                      ))}
                    </ol>
                  </details>
                </>
              )}
            </section>
          </aside>
        </main>
      )}
      {view === 'board' && (
        <main className="board-page">
          <SamRequest state={state} act={act} />
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
                          {j.ownerId} · {j.kind}
                        </p>
                        <h3>{j.title}</h3>
                        <p>{j.description}</p>
                        {!j.isPersonal && !j.isDonor ? (
                          <div className="promise">
                            <span>
                              Return by <strong>{dayTime(j.due)}</strong>
                            </span>
                            <span>
                              Payment <strong>{money(j.reward)}</strong>
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
                        {j.status === 'ready' && !j.isDonor && !j.isPersonal && !j.assignedTo && (
                          <p className="handoff-knowledge">
                            {evidenceContext(j, 'sam').stage === 'ready'
                              ? 'You repaired and checked it. Sam may choose to handle the return; this is cooperation, not an independent repair.'
                              : 'Your use check is recorded. Sam has not received all required passed checks; he may need to recheck or ask for help.'}
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
                            <small>
                              Still Sam’s responsibility. No repeated work time is spent while
                              blocked.
                            </small>
                          </div>
                        )}
                        <div className="paper-actions">
                          {j.status === 'offer' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => act({ type: 'accept', jobId: j.id })}
                              >
                                Accept promise
                              </button>
                              <button
                                type="button"
                                onClick={() => act({ type: 'decline', jobId: j.id })}
                              >
                                Decline
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
                              ) : j.isDonor || samFinishedPersonal(j) ? null : (
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
          <SamRequest state={state} act={act} />
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
              {!state.pendingRequest && (
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
                    {id === 'sam' ? (
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
      <section className="workshop-feed">
        <p className="eyebrow">Around the workshop</p>
        {state.log
          .filter((l) => view !== 'bench' || l.speaker !== 'Sam')
          .slice(-3)
          .reverse()
          .map((l) => (
            <p key={l.id}>
              <time>{dayTime(l.at)}</time>
              <strong>{l.speaker}</strong>
              <span>{l.text}</span>
            </p>
          ))}
      </section>
      <footer>
        <span>Saved automatically on this device · Seed {state.seed}</span>
        <div>
          <button type="button" onClick={exportSave}>
            Export workshop
          </button>
          <button
            type="button"
            disabled={replayChecking}
            aria-busy={replayChecking}
            onClick={verifyReplay}
          >
            {replayChecking ? 'Verifying replay…' : 'Verify recorded replay'}
          </button>
          <button type="button" onClick={() => input.current?.click()}>
            Import workshop
          </button>
          <button
            type="button"
            onClick={() => {
              const seed = window.prompt(
                'Start a new workshop. Enter a seed number:',
                String(state.seed + 1),
              );
              if (seed !== null && Number.isFinite(Number(seed))) {
                setState(createGame(Number(seed)));
                setStatus('A new workshop day begins.');
              }
            }}
          >
            New workshop
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (file) {
                  setState(loadGame(await file.text()));
                  setStatus('Workshop imported.');
                }
              } catch (error) {
                setStatus(
                  error instanceof Error ? error.message : 'This save is not a Small Works save.',
                );
              }
              e.target.value = '';
            }}
          />
        </div>
      </footer>
      {replayStatus && (
        <p className="replay-status" role="status">
          {replayStatus}
        </p>
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
    </div>
  );
}
