import {
  ownerQuestionBlock,
  ownerQuestionEvidence,
  ownerReplacementProposal,
} from '../game/cast-content';
import { dayRemaining, dayTime } from '../game/engine';
import type { Command, GameState } from '../game/types';

/** A public replacement proposal about this selected part; personal accounts stay separate. */
export function ObjectOwnerExchange({
  state,
  jobId,
  componentId,
  act,
}: {
  state: GameState;
  jobId: string;
  componentId: string;
  act: (c: Command) => void;
}) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job || job.isPersonal || job.isDonor || !['active', 'ready'].includes(job.status))
    return null;
  const part = job.model.components.find((c) => c.id === componentId);
  if (!part) return null;
  const owner = state.people[job.ownerId];
  if (!owner) return null;
  const evidence = ownerQuestionEvidence(job);
  const command: Command = {
    type: 'ask-owner-about-object',
    jobId,
    ownerId: owner.id,
    componentId,
    intervention: 'replace',
    evidenceIds: evidence.map((e) => e.id),
    evidenceText: JSON.stringify(evidence),
  };
  const block = ownerQuestionBlock(state, command);
  const current = state.npcWork.find((work) => work.personId === owner.id);
  const wait = current ? current.endsAt - state.now : 0;
  const showCurrent = block?.startsWith('The owner is unavailable.') && current && wait > 0;
  const receipt = state.ownerExchanges?.find(
    (r) => r.jobId === jobId && r.componentId === componentId,
  );
  return (
    <details className="owner-object-question">
      <summary>
        Ask {owner.name} about this {componentId}
      </summary>
      <p>
        <strong>Original request:</strong> {job.description}
      </p>
      <p>{job.importance}</p>
      <p>
        <strong>Your proposal:</strong> {ownerReplacementProposal(job, componentId)}
      </p>
      <p>
        <strong>Observations to show:</strong>
      </p>
      {evidence.length ? (
        <ul>
          {evidence.map((e) => (
            <li key={e.id}>
              [{e.id}] {e.summary}
            </li>
          ))}
        </ul>
      ) : (
        <p>No current observations. Inspect this part and test or measure the object first.</p>
      )}
      <p>
        Asking costs five minutes, even if {owner.name} says no. {owner.name} can refuse the
        replacement or continue with other plans. Agreement covers only the replacement described
        above. Parts, repair time and the final test remain your responsibility.
      </p>
      {owner.activity?.action === 'personal' && (
        <p>
          {owner.name} may continue: {owner.activity.affordance.label}.
        </p>
      )}
      {receipt ? (
        <div role="status">
          <p>
            <strong>Received response:</strong> {receipt.response}
          </p>
          <details>
            <summary>How {owner.name} answered</summary>
            <p>{receipt.decision.answer?.says ?? receipt.decision.narration}</p>
            <p>{receipt.decision.answer?.reason ?? receipt.decision.reason}</p>
          </details>
          <p>
            Only {job.title} · {componentId} · replacement. Asked at workshop minute{' '}
            {receipt.askedAt}; answered at {receipt.answeredAt}. This answer concerns the repair
            proposal, not a separate personal conversation.
          </p>
        </div>
      ) : (
        <>
          <button type="button" disabled={Boolean(block)} onClick={() => act(command)}>
            Ask about replacing this {componentId} · 5 minutes
          </button>
          {block && <p>{block}</p>}
          {showCurrent ? (
            <>
              <p>
                {owner.name} is doing this activity: {current.option.label}. It is due to end at{' '}
                {dayTime(current.endsAt)}. Check again then; another commitment may follow.
              </p>
              {wait <= 480 && wait <= dayRemaining(state) && (
                <button type="button" onClick={() => act({ type: 'wait', minutes: wait })}>
                  Wait for this activity to end · {wait} minutes
                </button>
              )}
            </>
          ) : block?.startsWith('The owner is unavailable.') ? (
            <p>Their next available time is not known. Check again later in People.</p>
          ) : null}
        </>
      )}
      <p>
        You can keep working with the original parts, put this object aside or return it unfinished.
      </p>
    </details>
  );
}
