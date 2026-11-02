import { methodAccount, methodBlock, methodQuestion, methodReport } from '../game/method-response';
import type { Command, GameState } from '../game/types';
/** Public discussion of this object's performed work. It does not perform or accept a repair. */
export function MethodResponse({
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
  const j = state.jobs.find((j) => j.id === jobId),
    report = methodReport(state, jobId, componentId);
  if (
    !j ||
    j.isPersonal ||
    j.isDonor ||
    !['active', 'ready', 'delivered'].includes(j.status) ||
    !report
  )
    return null;
  const owner = state.people[j.ownerId];
  if (!owner) return null;
  const q = methodQuestion(state, jobId, componentId),
    block = methodBlock(state, q);
  const receipt = state.methodResponses?.find((r) => r.jobId === j.id);
  return (
    <details className="method-response">
      <summary>Discuss this repair method with {owner.name}</summary>
      <p>
        <strong>Original request:</strong> {j.description}
      </p>
      <p>{j.importance}</p>
      <p>
        {report.known
          ? methodAccount(report)
          : 'The complete repair method is unknown. The list below shows only the work and object tests recorded so far.'}
      </p>
      <details>
        <summary>Performed work and test records</summary>
        <ul>
          {report.evidence
            .filter((e) => e.kind === 'work' || e.kind === 'use')
            .map((e) => (
              <li key={e.id}>
                [{e.id}] Minute {e.at} · {e.actorId ?? 'unknown actor'} · {e.summary}
              </li>
            ))}
        </ul>
      </details>
      <p>
        Ask after you have worked on this part and tested the object. The exchange takes five
        minutes, including a refusal. {owner.name} may choose to keep{' '}
        {j.ownerId === 'mum' ? 'her' : 'their'} own plans instead of discussing the work.
      </p>
      {receipt ? (
        <div role="status">
          <p>
            <strong>Received method response:</strong> {receipt.response}
          </p>
          <p>
            Asked at minute {receipt.askedAt}; answered at {receipt.answeredAt}.
          </p>
          <details>
            <summary>How {owner.name} chose</summary>
            <p>{receipt.decision.answer?.says ?? receipt.decision.narration}</p>
            <p>{receipt.decision.answer?.reason ?? receipt.decision.reason}</p>
          </details>
        </div>
      ) : (
        <>
          <button type="button" disabled={Boolean(block)} onClick={() => act(q)}>
            Show performed work and tests · 5 minutes
          </button>
          {block && <p>{block}</p>}
        </>
      )}
    </details>
  );
}
