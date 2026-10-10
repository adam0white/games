import type { ReactNode } from 'react';
export interface WorkCompanionState {
  name: string;
  state: 'watching' | 'away' | 'working' | 'present';
  detail: string;
  departure?: string;
}

export function companionHeading(companion: WorkCompanionState): string {
  switch (companion.state) {
    case 'watching':
      return `${companion.name} is watching your work`;
    case 'working':
      return `${companion.name} is doing his own work`;
    case 'away':
      return `${companion.name} is away`;
    case 'present':
      return `${companion.name} is here, occupied elsewhere`;
  }
}

/** Actual attendance supplied by the host; invitations never imply observation. */
export function WorkCompanion({
  companion,
  children,
}: {
  companion?: WorkCompanionState;
  children?: ReactNode;
}) {
  if (!companion) return null;
  return (
    <aside
      className={`work-companion work-companion--${companion.state}`}
      aria-label="Sam at the bench"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="work-companion-mark" aria-hidden="true">
        {companion.state === 'watching' ? '●' : companion.state === 'working' ? '◒' : '○'}
      </span>
      <div>
        <strong>{companionHeading(companion)}</strong>
        <p>{companion.detail}</p>
        {children}
        {companion.departure && <p className="work-companion-departure">{companion.departure}</p>}
      </div>
    </aside>
  );
}
