import { type ReactNode, useEffect, useRef } from 'react';
import type { ActionView } from '../game/types';
import type { WorkspaceActions } from './workspaceFlow';

export function ActionLane({
  title,
  detail,
  actions,
  renderAction,
  className = '',
}: {
  title?: string;
  detail?: string;
  actions: ActionView[];
  renderAction: (action: ActionView) => ReactNode;
  className?: string;
}) {
  if (!actions.length) return null;
  return (
    <section className={`action-lane ${className}`}>
      {title && <h2>{title}</h2>}
      {detail && <p className="lane-detail">{detail}</p>}
      <div className="choice-buttons">{actions.map(renderAction)}</div>
    </section>
  );
}
const statusLabels = {
  agreed: 'Agreed',
  invitation: 'Invitation',
  routine: 'Usual hours',
  underway: 'In progress',
  late: 'Needs attention',
  kept: 'Kept',
};
export function PromiseCards({
  entries,
  renderAction,
}: {
  entries: WorkspaceActions['plans'];
  renderAction: (action: ActionView) => ReactNode;
}) {
  if (!entries.length) return null;
  return (
    <div className="promise-grid">
      {entries.map((entry) => (
        <article className={`promise-card promise-${entry.status}`} key={entry.id}>
          <span className="card-overline">{statusLabels[entry.status]}</span>
          <h3>{entry.label}</h3>
          <p>{entry.detail}</p>
          <div className="choice-buttons">
            {entry.actions.map((action) =>
              renderAction(
                action.detail === entry.detail ? { ...action, detail: undefined } : action,
              ),
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
export function ChapterCeremony({
  title,
  detail,
  overline,
  children,
  onContinue,
}: {
  title: string;
  detail?: string;
  overline: string;
  children?: ReactNode;
  onContinue: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="chapter-ceremony" aria-label={title}>
      <span className="ceremony-line" aria-hidden="true" />
      <p className="card-overline">{overline}</p>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {detail && <p className="ceremony-detail">{detail}</p>}
      {children}
      <button className="ceremony-continue" type="button" onClick={onContinue}>
        Continue <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
