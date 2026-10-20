import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { requiredChecks } from '../game/engine';
import { runUseTest } from '../game/model';
import type { Evidence, Job, TestCondition, UseResult } from '../game/types';
import './physical-object.css';

interface Props {
  job: Job;
  disabled: boolean;
  onPower: () => void;
  onTry: (condition: TestCondition) => void;
  onOpen: () => void;
  opened?: boolean;
  allowOpen?: boolean;
  testCondition?: TestCondition;
}

function ActionIcon({ action }: { action: 'Carry' | 'Read' | 'Try' | 'Play' | 'Air' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {action === 'Carry' ? (
        <>
          <circle cx="14" cy="4" r="2" />
          <path d="m10 21 3-7-3-4 4-3 3 5 4 1M4 14l5-4M15 15l4 6" />
        </>
      ) : action === 'Read' ? (
        <path d="M12 5C8 2 4 3 2 4v15c3-2 6-2 10 1m0-15c4-3 8-2 10-1v15c-3-2-6-2-10 1V5Z" />
      ) : action === 'Air' ? (
        <path d="M3 7h12c5 0 5-5 1-5M3 12h16c5 0 5 7 0 7M3 17h8" />
      ) : action === 'Play' ? (
        <path d="m8 4 12 8-12 8Z" />
      ) : (
        <path d="M3 10h18M5 10v10m14-10v10M7 10V5h10v5" />
      )}
    </svg>
  );
}

/** Keep the latest observed use visible until work invalidates it; animation does not change evidence. */
export function physicalSceneOutput(job: Job): { output: number; signal: string } {
  if (!job.model.power) return { output: 0, signal: 'power-off' };
  const revision = job.evidence.findLast((entry) => entry.kind === 'work')?.id ?? 0;
  const observed = job.evidence.findLast((entry) => entry.kind === 'use' && entry.id > revision);
  if (observed) {
    const signal = observed.cues.signal ?? 'no-output';
    const percent = observed.summary.match(/reaches (\d+(?:\.\d+)?)%/);
    const rpm = observed.summary.match(/turns at (\d+(?:\.\d+)?) rpm/);
    const recorded = (observed as Evidence & Partial<UseResult>).output;
    const output =
      typeof recorded === 'number' && Number.isFinite(recorded)
        ? recorded
        : percent
          ? Number(percent[1]) / 100
          : rpm
            ? Number(rpm[1])
            : 0;
    return { output, signal };
  }
  const bench = runUseTest(job.model, 'bench');
  return { output: bench.output, signal: bench.cues.signal ?? 'no-output' };
}

export function PhysicalObjectScene({
  job,
  disabled,
  onPower,
  onTry,
  onOpen,
  opened = false,
  allowOpen = true,
  testCondition,
}: Props) {
  const revision = job.evidence.findLast((entry) => entry.kind === 'work')?.id ?? 0;
  const lastUse = job.evidence.findLast((entry) => entry.kind === 'use' && entry.id > revision);
  const lastSeen = useRef(lastUse?.id);
  const useId = lastUse?.id;
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (lastSeen.current === useId) return;
    lastSeen.current = useId;
    if (useId === undefined) {
      setMoving(false);
      return;
    }
    setMoving(true);
    const timer = window.setTimeout(() => setMoving(false), 600);
    return () => window.clearTimeout(timer);
  }, [useId]);
  const { output, signal } = physicalSceneOutput(job);
  const working = output > 0;
  const steady = signal === 'steady-output';
  const condition =
    testCondition ?? requiredChecks(job)[0] ?? (job.kind === 'lantern' ? 'movement' : 'load');
  const action =
    condition === 'bench'
      ? 'Try'
      : job.kind === 'lantern'
        ? condition === 'movement'
          ? 'Carry'
          : 'Read'
        : job.kind === 'music-box'
          ? 'Play'
          : 'Try';
  const icon = job.kind === 'fan' && condition === 'load' ? 'Air' : action;
  const mechanical = job.kind === 'music-box';
  return (
    <div
      className={`physical-scene physical-${job.kind}${opened ? ' is-open' : ''}${moving ? ' is-testing' : ''}${working ? ' has-output' : ''}${working && !steady ? ' has-uneven-output' : ''}`}
      style={{ '--physical-light-strength': Math.max(0, Math.min(0.95, output)) } as CSSProperties}
    >
      <div className="physical-stage">
        <div className="physical-bench-shadow" />
        <div className="physical-object">
          <svg
            className="physical-silhouette"
            viewBox="0 0 400 320"
            role="img"
            aria-label={`${job.title}, exterior`}
          >
            {job.kind === 'lantern' ? (
              <>
                <path className="physical-handle" d="M145 97V64c0-66 110-66 110 0v33" />
                <path className="physical-metal" d="m132 94 15-18h106l15 18v24H132Z" />
                <path className="physical-glass" d="M140 120h120l13 134H127Z" />
                <path className="physical-light" d="M154 125h92l10 123H144Z" />
                <path
                  className="physical-bulb"
                  d="M185 190c-20-24-6-54 15-54s35 30 15 54l-5 20h-20Z"
                />
                <path className="physical-wire" d="M193 211h14m-13 7h12m-6-7v-35" />
                <path className="physical-rail" d="m141 115-9 138m127-138 9 138M126 251h148" />
                <path className="physical-metal" d="M124 252h152l7 31H117Z" />
                <path className="physical-highlight" d="m151 133-7 90" />
              </>
            ) : job.kind === 'fan' ? (
              <>
                <path className="physical-metal" d="M185 231h30l8 39h35l13 17H129l13-17h35Z" />
                <circle className="physical-fan-case" cx="200" cy="139" r="104" />
                <g className="physical-rotor">
                  {[0, 120, 240].map((rotation) => (
                    <path
                      key={rotation}
                      transform={`rotate(${rotation} 200 139)`}
                      className="physical-blade"
                      d="M200 139c-8-33-41-77-64-43-22 34 14 63 64 43Z"
                    />
                  ))}
                </g>
                <g className="physical-grille">
                  {[28, 52, 76, 99].map((radius) => (
                    <circle key={radius} cx="200" cy="139" r={radius} />
                  ))}
                  {[0, 45, 90, 135].map((rotation) => (
                    <path
                      key={rotation}
                      transform={`rotate(${rotation} 200 139)`}
                      d="M98 139h204"
                    />
                  ))}
                </g>
                <circle className="physical-hub" cx="200" cy="139" r="16" />
              </>
            ) : (
              <>
                <path className="physical-box-lid" d="m104 105 96-48 96 48v53H104Z" />
                <path className="physical-box" d="m94 146 106-39 106 39v113l-106 43-106-43Z" />
                <path className="physical-box-top" d="m94 146 106-39 106 39-106 43Z" />
                <path className="physical-box-edge" d="M200 189v113m-106-43 106 43 106-43" />
                <g className="physical-melody">
                  <path d="M168 144v-20l18-4v18m-18-10 18-4" />
                  <ellipse cx="163" cy="146" rx="5" ry="3" />
                  <ellipse cx="181" cy="140" rx="5" ry="3" />
                </g>
                <path className="physical-box-inlay" d="m108 168 76 29v78l-76-29Z" />
              </>
            )}
          </svg>
          <button
            className="physical-power-switch"
            type="button"
            role="switch"
            aria-checked={job.model.power}
            aria-label={
              mechanical
                ? `${job.model.power ? 'Stop' : 'Run'} ${job.title} mechanism`
                : `Switch ${job.title} ${job.model.power ? 'off' : 'on'}`
            }
            disabled={disabled}
            onClick={onPower}
          >
            <span className="physical-switch-mark" aria-hidden="true">
              I
            </span>
            <span className="physical-rocker" aria-hidden="true">
              <i />
            </span>
            <span className="physical-switch-mark" aria-hidden="true">
              O
            </span>
          </button>
          {allowOpen && (
            <button
              className="physical-cover-latch"
              type="button"
              disabled={disabled}
              onClick={onOpen}
              aria-expanded={opened}
              aria-label={`Look inside ${job.title}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 8h14v11H5Zm4 0V5h6v3M9 13h6" />
              </svg>
              <span>{opened ? 'Inside' : 'Look inside'}</span>
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        className="physical-use-action"
        disabled={disabled}
        onClick={() => onTry(condition)}
      >
        <ActionIcon action={icon} />
        <span>{action}</span>
        <small>15 min</small>
      </button>
      <p className="physical-observation">{lastUse ? `Last test: ${lastUse.summary}` : ''}</p>
    </div>
  );
}
