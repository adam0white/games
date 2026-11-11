import type { Job } from '../game/types';
import { theatrePerformance } from '../ui/theatre-performance';

export function TheatrePerformance({ job }: { job: Job }) {
  const use = theatrePerformance(job);
  if (!use) return null;
  if (!use.working) return <p>Last theatre test: {use.summary}</p>;
  return (
    <details className="theatre-performance">
      <summary>Watch the paper theatre</summary>
      <svg
        viewBox="184 64 252 271"
        width="100%"
        height="220"
        role="img"
        aria-label="The paper theatre’s figures move at the checked pace"
      >
        <rect x="184" y="64" width="252" height="271" fill="#223027" />
        <path
          d="M184 64 Q221 130 210 243 L184 243 Z M436 64 Q399 130 411 243 L436 243 Z"
          fill="#716954"
        />
        <path d="M184 76 H436 M184 335 H436" stroke="#cfc7a4" strokeWidth="10" />
        <g className="observed-figures">
          <circle cx="310" cy="110" r="9" fill="#cfc7a4" />
          <path
            d="M310 120 L294 158 H326 Z M298 127 L281 138 M322 127 L340 136 M301 157 L294 179 M319 157 L328 179"
            stroke="#cfc7a4"
            strokeWidth="4"
            fill="#8da080"
          />
          <circle cx="355" cy="134" r="6" fill="#bdc6a1" />
          <path d="M355 143 L343 165 H367 Z" fill="#bdc6a1" />
        </g>
      </svg>
      <p>Last theatre test: {use.summary}</p>
    </details>
  );
}
