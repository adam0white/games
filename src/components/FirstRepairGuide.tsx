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
  onSkip: () => void;
}

/**
 * The first real choice, said only as far as the player knows it: a spare part from stock is known to work,
 * the donor's part has never been tested, and stock is not endless.
 */
function repairCue(state: GameState, part: Job['model']['components'][number] | undefined): string {
  if (!part) return 'Replace the part you found failing. Then carry the lantern again.';
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
        ? `You have new ${name}s in stock.`
        : `You have no new ${name} in stock; the shop sells them.`;
  const fromDonor = donor
    ? ` ${donor.title} has one too. Taking it costs nothing, but nobody has tested it.`
    : '';
  return `${stock}${fromDonor} Fit one, then carry the lantern again.`;
}

/** One next operation, not a second copy of the bench controls. */
export function FirstRepairGuide({ state, job, pane, opened, onPane, onSkip }: Props) {
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
    phase === 'try'
      ? 'Try carrying it.'
      : phase === 'open'
        ? opened
          ? 'Choose a part inside, then examine it.'
          : 'Open the cover to look inside.'
        : phase === 'measure-source'
          ? 'Start at the battery. Put a probe on each marked connection.'
          : phase === 'measure-path'
            ? `Now compare both sides of the ${part?.label.toLowerCase() ?? 'next part'} while it moves.`
            : phase === 'inspect'
              ? `The reading points to the ${part?.label.toLowerCase() ?? 'connection'}. Examine it before changing anything.`
              : phase === 'repair'
                ? repairCue(state, part)
                : phase === 'check'
                  ? 'The part has changed. Carry the lantern again to see what changed.'
                  : 'It stays lit when carried. Give it back to Mum.';
  const pair = progress.suggestedPair;
  const showPair = pair && (phase === 'measure-source' || phase === 'measure-path');
  return (
    <section className="first-repair-guide" aria-label="First repair guide">
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
      {showPair && (
        <div
          className="guide-probes"
          role="img"
          aria-label={`Red probe on ${pair.a}, black probe on ${pair.b}; ${pair.condition}`}
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
              ? 'while carried'
              : pair.condition === 'load'
                ? 'under load'
                : 'on the table'}
          </small>
        </div>
      )}
      {target !== pane && phase !== 'try' && phase !== 'open' && (
        <button type="button" className="guide-next" onClick={() => onPane(target)}>
          {target === 'meter'
            ? 'Pick up the meter'
            : target === 'repair'
              ? 'Work on the part'
              : 'Try the lantern'}{' '}
          <span aria-hidden="true">→</span>
        </button>
      )}
      {phase !== 'try' && (
        <button type="button" className="guide-dismiss" onClick={onSkip}>
          Explore freely
        </button>
      )}
    </section>
  );
}
