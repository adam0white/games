import type { ReactNode } from 'react';
export function BenchHistory({
  archived,
  title,
  children,
}: {
  archived: boolean;
  title: string;
  children: ReactNode;
}) {
  return archived ? (
    <details className="bench-history">
      <summary>{title}</summary>
      {children}
    </details>
  ) : (
    children
  );
}
