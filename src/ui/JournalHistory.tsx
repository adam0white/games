import type { ConversationLine } from '../game/types';

export interface JournalHistoryProps {
  lines: readonly ConversationLine[];
}

/** Presentation only: use recorded times where present; leave legacy lines
 * untimed. A time group does not imply one event or an object association. */
export function JournalHistory({ lines }: JournalHistoryProps) {
  if (!lines.length) return null;
  type SpeakerGroup = { speaker: string; start: number; lines: ConversationLine[] };
  const periods: {
    at?: number;
    label?: string;
    start: number;
    groups: SpeakerGroup[];
  }[] = [];
  for (const [index, line] of lines.entries()) {
    const timed = Number.isFinite(line.at) && Boolean(line.timeLabel);
    const at = timed ? line.at : undefined;
    const label = timed ? line.timeLabel : undefined;
    let period = periods.at(-1);
    if (!period || period.at !== at || period.label !== label) {
      period = { at, label, start: index + 1, groups: [] };
      periods.push(period);
    }
    const previous = period.groups.at(-1);
    if (previous?.speaker === line.speaker) previous.lines.push(line);
    else period.groups.push({ speaker: line.speaker, start: index + 1, lines: [line] });
  }

  return (
    <div className="journal-history">
      <section className="journal-history-entries" aria-label="Recorded conversations">
        {periods.map((period) => (
          <section className="journal-history-period" key={period.start}>
            <h3 className="journal-history-time">{period.label ?? 'Earlier recorded story'}</h3>
            {!period.label && (
              <p className="journal-history-note">
                Dates and times weren’t recorded with these entries.
              </p>
            )}
            {period.groups.map((group) => (
              <section className="journal-history-group" key={group.start}>
                <h4 className="journal-history-speaker">{group.speaker}</h4>
                <ol className="journal-history-lines" start={group.start}>
                  {group.lines.map((line) => (
                    <li
                      key={line.id}
                      className={`journal-history-line${line.tone ? ` journal-history-line--${line.tone}` : ''}`}
                    >
                      <p>{line.text}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </section>
        ))}
      </section>
    </div>
  );
}
