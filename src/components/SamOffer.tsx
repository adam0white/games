import type { ReactNode } from 'react';

export function SamOffer({ available, actions }: { available: boolean; actions: ReactNode }) {
  return (
    <div>
      <h3>Ask Sam to take charge</h3>
      {available ? (
        <>
          <p>Sam decides whether to accept. He may need teaching or help.</p>
          {actions}
        </>
      ) : (
        <p>Ask Sam to watch a lesson, or return three checked objects, to open this offer.</p>
      )}
    </div>
  );
}
