import { useState } from 'react';
import { dayTime } from '../game/engine';
import type { SpokenLine } from '../ui/crises';

type ConversationState = { open: boolean; acknowledgedThrough: number };
const latestId = (lines: SpokenLine[]) => Math.max(0, ...lines.map((line) => line.id));

/** Session-only UI state. Existing speech starts quiet, including imported runs. */
export function initialConversation(lines: SpokenLine[]): ConversationState {
  return { open: false, acknowledgedThrough: latestId(lines) };
}

export function acknowledgeConversation(
  previous: ConversationState,
  lines: SpokenLine[],
  open: boolean,
): ConversationState {
  return {
    open,
    acknowledgedThrough: Math.max(previous.acknowledgedThrough, latestId(lines)),
  };
}

export function conversationCue(state: ConversationState, lines: SpokenLine[]): string {
  if (state.open) return '';
  const unread = lines.filter((line) => line.id > state.acknowledgedThrough);
  if (!unread.length) return '';
  return ` · ${unread.length} new · ${[...new Set(unread.map((line) => line.speaker))].join(', ')}`;
}

export function RecentConversation({
  lines,
  canAskSam,
  onAskSam,
}: {
  lines: SpokenLine[];
  canAskSam: boolean;
  onAskSam: () => void;
}) {
  const [conversation, setConversation] = useState(() => initialConversation(lines));
  if (!lines.length) return null;
  return (
    <details
      className="recent-conversation"
      open={conversation.open}
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setConversation((previous) => acknowledgeConversation(previous, lines, open));
      }}
    >
      <summary>Recent conversation{conversationCue(conversation, lines)}</summary>
      <section className="todays-words" aria-label="What people said today">
        {lines.map((line) => (
          <p key={line.id} className={line.tone === 'warning' ? 'is-warning' : undefined}>
            <strong>{line.speaker}</strong> {line.text} <time>{dayTime(line.at)}</time>
            {line.speaker === 'Sam' &&
              line.text.includes('see how you find the fault') &&
              canAskSam && (
                <button type="button" onClick={onAskSam}>
                  Ask Sam to watch
                </button>
              )}
          </p>
        ))}
      </section>
    </details>
  );
}
