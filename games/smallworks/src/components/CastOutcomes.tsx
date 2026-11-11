import { OUTCOME_ACTIONS, OUTCOME_TERMS, outcomeBlock, outcomeDone } from '../game/outcomes';
import type { Command, GameState } from '../game/types';
/** Ordinary authored projects, visible only in the chosen edition and after voluntary disclosure. */
export function CastOutcomes({
  state,
  personId,
  act,
}: {
  state: GameState;
  personId: string;
  act: (c: Command) => void;
}) {
  const o = state.castOutcomes;
  if (!o || !state.discoveries?.includes(personId)) return null;
  const pending = o.pending;
  return (
    <section aria-label={`${state.people[personId]?.name}’s workshop outcomes`}>
      {personId === 'sam' && (
        <details>
          <summary>The original copied report</summary>
          <p>{o.originalReport.text}</p>
          <p>
            {o.originalReport.author} · {o.originalReport.source}. {o.originalReport.status}
          </p>
        </details>
      )}
      {personId === 'rafi' && (
        <p>
          Rafi’s authored account: £12 customer deposit, £8 spent on travel, £4 originally held.
          Returned: £{o.rafi.customerReceived}. Still owed to customer: £
          {12 - o.rafi.customerReceived}. Separate jar restitution: £{o.rafi.jarReceived} of £3.
          Workshop loan debt: £{o.rafi.workshopDebt}. The appliance is a separate repair.
        </p>
      )}
      {personId === 'halil' && (
        <p>
          One bounded contact service, half an hour for £6. Payment follows the physical check. This
          does not settle rent or treat illness. A landlord agreement needs the creditor’s terms and
          assent.
        </p>
      )}
      {personId === 'nora' && (
        <p>
          {o.handle.collar
            ? 'A wide collar is fitted to the prototype.'
            : 'The prototype has a narrow handle.'}{' '}
          {o.handle.credit} A workshop trial records one fictional user’s use. It is no
          accessibility certificate.
        </p>
      )}
      {OUTCOME_ACTIONS.filter(
        (a) => OUTCOME_TERMS[a].person === personId && !outcomeDone(state, a),
      ).map((action) => {
        const block = outcomeBlock(state, action);
        return (
          <div key={action}>
            <button
              type="button"
              disabled={Boolean(block)}
              onClick={() => act({ type: 'cast-outcome', action })}
            >
              {OUTCOME_TERMS[action].label}
            </button>
            {block && <small>{block}</small>}
          </div>
        );
      })}
      {pending && OUTCOME_TERMS[pending.action].person === personId && (
        <div role="status">
          <p>You are attending: {pending.option.label}. No completion or payment yet.</p>
          <button type="button" onClick={() => act({ type: 'wait', minutes: 5 })}>
            Stay together for a few minutes
          </button>
          <button type="button" onClick={() => act({ type: 'stop-cast-outcome' })}>
            Stop this activity
          </button>
        </div>
      )}
      {o.decisions
        .filter((d) => OUTCOME_TERMS[d.action].person === personId)
        .slice(-1)
        .map((d) => (
          <p key={`${d.at}-${d.action}`}>{d.says}</p>
        ))}
      {o.receipts
        .filter((r) => r.person === personId)
        .map((r) => (
          <p key={r.action}>{r.text}</p>
        ))}
      {personId === 'rafi' && o.applianceId && (
        <p>
          The separate appliance is on the Board.{' '}
          {state.jobs.find((j) => j.id === o.applianceId)?.status === 'delivered'
            ? 'It was returned; see its actual repair and use evidence. Deposit and loan accounts above remain separate.'
            : 'Inspect, diagnose, repair and check it on the ordinary bench. Returning it unfinished leaves the repair unresolved.'}
        </p>
      )}
      {personId === 'halil' && o.serviceId && !outcomeDone(state, 'halil-service') && (
        <p>
          The service fan is on the Board. Inspect its contact, then ask Halil whether he will do
          the agreed work.
        </p>
      )}
    </section>
  );
}
