import { useState } from 'react';
import {
  accountParts,
  declinePersonal,
  discoveredAccounts,
  type PersonalRole,
  personalReplies,
  personalReplyBlock,
  personalStatement,
  replyReceiptKey,
} from '../game/cast-content';
import type { Command, GameState } from '../game/types';

/** A public, finite answer to an actually heard account. Leaving it unanswered records nothing. */
export function PersonalReply({
  state,
  personId,
  act,
}: {
  state: GameState;
  personId: PersonalRole;
  act: (command: Command) => void;
}) {
  const [unanswered, setUnanswered] = useState(false);
  const statement = personalStatement(state, personId);
  if (!state.discoveries?.includes(personId)) return null;
  const parts = accountParts(statement?.text ?? discoveredAccounts[personId]);
  const block = statement
    ? personalReplyBlock(state, personId, statement.id, state.selectedJobId)
    : 'That conversation has ended. The account remains in your notes.';
  const receipt = statement
    ? state.log.find(
        (e) => e.speaker === 'You' && e.text.startsWith(replyReceiptKey(personId, statement.id)),
      )
    : undefined;
  const answer = (choice: 'acknowledge' | 'decline') => {
    if (!statement) return;
    act({
      type: 'reply-personal',
      personId,
      statementId: statement.id,
      jobId: state.selectedJobId,
      choice,
    });
  };
  return (
    <details>
      <summary>What {state.people[personId]?.name} told me</summary>
      <p>{parts.words}</p>
      {parts.limits && (
        <details>
          <summary>Narrator limits</summary>
          <p>{parts.limits}</p>
        </details>
      )}
      {receipt ? (
        <p role="status">
          You: {receipt.text.slice(replyReceiptKey(personId, statement?.id ?? 0).length).trim()}{' '}
          {state.people[personId]?.name} received your reply. No agreement or completed work follows
          from it.
        </p>
      ) : unanswered ? (
        <p>You left this account unanswered.</p>
      ) : (
        <>
          <p>
            You can answer this personal statement now, decline the conversation, or leave it
            unanswered. These replies promise no work or money.
          </p>
          <button type="button" disabled={Boolean(block)} onClick={() => answer('acknowledge')}>
            Say: {personalReplies[personId]}
          </button>
          <button type="button" disabled={Boolean(block)} onClick={() => answer('decline')}>
            Say: {declinePersonal}
          </button>
          <button type="button" onClick={() => setUnanswered(true)}>
            Leave unanswered
          </button>
          {block && <p>{block}</p>}
        </>
      )}
    </details>
  );
}
