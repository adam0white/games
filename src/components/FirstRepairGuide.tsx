import type { GameState, Job } from '../game/types';
import { firstRepairProgress } from '../ui/first-repair';
import './first-repair-guide.css';

type Pane = 'object' | 'meter' | 'repair' | 'notes';
interface Props {
  state: GameState;
  job: Job;
  pane: Pane;
  opened: boolean;
  onOpen: () => void;
  onPane: (pane: Pane) => void;
  onTest: () => void;
  disabled: boolean;
  onSkip: () => void;
}

/**
 * The first real choice, said only as far as the player knows it: a new part from stock is known to work,
 * recovering the donor's part costs time and the donor and may yield nothing, and stock is not endless.
 */
function repairCue(state: GameState, part: Job['model']['components'][number] | undefined): string {
  if (!part) return 'Replace the part that failed. Then carry the lantern again.';
  const name = part.label.toLowerCase();
  const inStock = state.stock[part.kind] ?? 0;
  const donor = state.jobs.find(
    (j) =>
      j.isDonor &&
      !['delivered', 'declined', 'salvaged'].includes(j.status) &&
      j.model.components.some((c) => c.kind === part.kind),
  );
  const stock =
    inStock === 1
      ? `You have one new ${name} in stock, and it is your only one.`
      : inStock > 1
        ? `You have more than one new ${name} in stock.`
        : `You have no new ${name} in stock. The shop sells them.`;
  const fromDonor = donor
    ? ` ${donor.title} has one too. Removing it takes time and turns that object into spare parts. The part may be unusable.`
    : '';
  return `${stock}${fromDonor} Fit a replacement. Then carry the lantern again.`;
}

/** Readings exist, but all of them predate the latest work on the object. */
function staleReadings(job: Job): boolean {
  const lastWork = job.evidence.findLast((e) => e.kind === 'work');
  return Boolean(
    lastWork && job.evidence.some((e) => e.kind === 'measurement' && e.id < lastWork.id),
  );
}

/** One next operation, not a second copy of the bench controls. */
export function FirstRepairGuide({
  state,
  job,
  pane,
  opened,
  onPane,
  onTest,
  disabled,
  onSkip,
}: Props) {
  const progress = firstRepairProgress(state);
  if (progress.openingJobId !== job.id || progress.phase === 'complete') return null;
  const part = job.model.components.find((c) => c.id === progress.suggestedPart);
  const phase = progress.phase;
  const target: Pane =
    phase === 'measure-source' || phase === 'measure-path'
      ? 'meter'
      : phase === 'inspect' || phase === 'repair'
        ? 'repair'
        : 'object';
  const cue =
    phase === 'power-on'
      ? 'Switch it on, then carry it again.'
      : phase === 'try'
        ? 'Try carrying it.'
        : phase === 'open'
          ? opened
            ? 'Choose a part inside, then examine it.'
            : 'Open the cover to look inside.'
          : phase === 'measure-source'
            ? staleReadings(job)
              ? 'The repair changed the object. Measure the battery again.'
              : 'Start at the battery. Put a probe on each marked connection.'
            : phase === 'measure-path'
              ? `Now compare both sides of the ${part?.label.toLowerCase() ?? 'next part'} while it moves.`
              : phase === 'inspect'
                ? `The reading points to the ${part?.label.toLowerCase() ?? 'connection'}. Examine it before changing anything.`
                : phase === 'repair'
                  ? repairCue(state, part)
                  : phase === 'check'
                    ? 'The part has changed. Carry the lantern again to see what changed.'
                    : 'It stays lit when carried. Give it back to its owner.';
  const pair = progress.suggestedPair;
  const showPair = pair && (phase === 'measure-source' || phase === 'measure-path');
  return (
    <section className="first-repair-guide" data-phase={phase} aria-label="First repair guide">
      {phase !== 'try' && phase !== 'power-on' && (phase !== 'open' || opened) && (
        <div className="guide-cue">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path d="M9 17h6m-5 3h4M8 14c-6-7 2-15 7-10 4 3 2 7-1 10v3H9Z" />
          </svg>
          <p>{cue}</p>
        </div>
      )}
      {showPair && (
        <div
          className="guide-probes"
          role="img"
          aria-label={`Place the red probe on ${pair.a} and the black probe on ${pair.b}. Use the ${pair.condition} condition.`}
        >
          <span className="guide-red">
            ● <strong>{pair.a}</strong>
          </span>
          <svg
            viewBox="0 0 56 16"
            width="56"
            height="16"
            stroke="currentColor"
            fill="none"
            aria-hidden="true"
          >
            <path d="M0 8h56M6 3 1 8l5 5m44-10 5 5-5 5" />
          </svg>
          <span className="guide-black">
            ● <strong>{pair.b}</strong>
          </span>
          <small>
            {pair.condition === 'movement'
              ? 'Measure while carrying it.'
              : pair.condition === 'load'
                ? 'Measure while it is under load.'
                : 'Measure while it is on the table.'}
          </small>
        </div>
      )}
      {target !== pane && phase !== 'try' && phase !== 'power-on' && phase !== 'open' && (
        <button
          type="button"
          className="guide-next"
          disabled={target === 'object' && phase === 'check' && disabled}
          onClick={() => {
            onPane(target);
            if (target === 'object' && phase === 'check') onTest();
          }}
        >
          {target === 'meter'
            ? 'Pick up the meter'
            : target === 'repair'
              ? 'Work on the part'
              : phase === 'check'
                ? 'Test the lantern'
                : 'Back to lantern'}{' '}
          {target === 'object' && phase === 'check' && <small>15 min · carry</small>}
          <span aria-hidden="true">→</span>
        </button>
      )}
      <button type="button" className="guide-dismiss" onClick={onSkip}>
        Skip tutorial
      </button>
    </section>
  );
}
