import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

/** Reveal a newly useful project once, then leave folding to the reader. */
export function ChoiceDetails({ reveal, children }: { reveal: boolean; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  const revealed = useRef(false);
  useEffect(() => {
    if (!reveal || revealed.current) return;
    revealed.current = true;
    if (details.current) details.current.open = true;
  }, [reveal]);
  return (
    <details className="choice-group choice-more" ref={details}>
      {children}
    </details>
  );
}
