import {
  ownerQuestionBlock,
  ownerQuestionEvidence,
  ownerReplacementProposal,
} from '../game/cast-content';
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
        The question costs five minutes, including a refusal. {owner.name} can keep the original
        parts or keep their plans. Agreement covers only this proposed replacement. Parts, repair
        time and the final test remain your responsibility.
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
            {receipt.askedAt}; answered at {receipt.answeredAt}. Personal acknowledgment is
            separate.
          </p>
        </div>
      ) : (
        <>
          <button type="button" disabled={Boolean(block)} onClick={() => act(command)}>
            Ask about replacing this {componentId} · 5 minutes
          </button>
          {block && <p>{block}</p>}
        </>
      )}
      <p>
        You can keep working with the original parts, put this object aside or return it unfinished.
      </p>
    </details>
  );
}
