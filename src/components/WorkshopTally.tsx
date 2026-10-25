import type { GameState } from '../game/types';

/** An optional first-week account of workshop jobs. It does not grade people or alter play. */
export function WorkshopTally({ state, enabled }: { state: GameState; enabled: boolean }) {
  if (!enabled || !state.ended) return null;
  const checked = state.jobs.filter(
    (j) => j.status === 'delivered' && !j.returnedUnfinished,
  ).length;
  const unfinished = state.jobs.filter(
    (j) => j.status === 'delivered' && j.returnedUnfinished,
  ).length;
  const open = state.jobs.filter(
    (j) => ['active', 'ready'].includes(j.status) && !j.isDonor && !j.isPersonal,
  ).length;
  return (
    <section aria-label="Workshop tally">
      <h3>Workshop tally · {2 * checked + unfinished - open}</h3>
      <p>
        2 × checked returns ({checked}) + unfinished returns ({unfinished}) − open promises ({open}
        ).
      </p>
      <p>
        This game awards two points for each checked return and one point for each unfinished
        return. Each open promise removes one point. This score does not measure people.
      </p>
    </section>
  );
}
