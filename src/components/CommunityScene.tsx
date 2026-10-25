import type { CommunityFormat, CommunityState } from '../game/community';
import type { GameState } from '../game/types';

export function CommunityScene({
  event,
  people,
  selected,
  stage = 'activity',
  jobs,
}: {
  event: CommunityState;
  people: GameState['people'];
  selected: CommunityFormat;
  stage?: 'prepared' | 'activity' | 'returned';
  jobs?: GameState['jobs'];
}) {
  const participants = event.decisions.filter((d) => d.completed && d.format);
  const completed = stage === 'activity' ? participants : [];
  const theatreJob = jobs?.find(
    (j) => j.id === event.preparations.find((p) => p.format === 'theatre')?.jobId,
  );
  const theatreUse = [...(theatreJob?.evidence ?? [])].reverse().find((e) => e.kind === 'use');
  const rpm = Number(theatreUse?.summary.match(/at (\d+(?:\.\d+)?) rpm/)?.[1] ?? 0);
  const names = { garden: 'The garden', reading: 'The reading room', theatre: 'The paper stage' };
  return (
    <svg
      className="community-scene"
      viewBox="0 0 870 290"
      role="img"
      aria-label={`This scene shows the recorded ${stage} stage. ${event.preparedFormats.length} activities were prepared. ${participants.length} people completed an activity overall.`}
    >
      <defs>
        <pattern id="garden-fence" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M9 0 V18" stroke="#7f8a68" strokeWidth="2" />
        </pattern>
        <linearGradient id="community-wall" x2="0" y2="1">
          <stop stopColor="#6c765b" stopOpacity=".3" />
          <stop offset="1" stopColor="#6c765b" stopOpacity=".08" />
        </linearGradient>
      </defs>
      <rect width="870" height="290" fill="#223027" />
      {stage === 'activity' && participants.length > 0 && (
        <path
          d="M15 230 Q160 205 285 230 Q425 216 565 230 Q705 208 855 230"
          fill="none"
          stroke="#c0c89a"
          strokeWidth="2"
          opacity=".25"
        />
      )}
      <path d="M17 238 H852" stroke="#85926b" strokeWidth="2" />
      <path
        d="M285 89 L565 40 L848 89 V238 H285 Z"
        fill="url(#community-wall)"
        stroke="#6b7c5a"
        strokeWidth="2"
      />
      <path d="M565 43 V238" stroke="#6b7c5a" strokeWidth="2" />
      <path d="M310 106 H536 V118 H310 Z M588 106 H823 V118 H588 Z" fill="#78825f" opacity=".5" />
      <rect x="31" y="171" width="220" height="57" fill="url(#garden-fence)" opacity=".55" />
      <path
        d="M24 230 Q44 207 68 223 Q88 203 115 223 M199 227 Q221 192 253 221"
        fill="none"
        stroke="#758969"
        strokeWidth="4"
      />
      <g opacity={selected === 'garden' || completed.some((d) => d.format === 'garden') ? 1 : 0.65}>
        <path d="M112 197 H221 M123 200 V239 M207 200 V239" stroke="#abac7d" strokeWidth="5" />
        <path
          d="M102 206 H87 V238 M235 207 H249 V239"
          fill="none"
          stroke="#81936b"
          strokeWidth="3"
        />
        {stage !== 'returned' && event.preparedFormats.includes('garden') && (
          <g>
            <ellipse
              cx="167"
              cy="176"
              rx="62"
              ry="46"
              fill="#e5c078"
              opacity={completed.some((d) => d.format === 'garden') ? 0.24 : 0.07}
            />
            <path
              d="M158 162 Q158 148 175 162 M153 163 H180 L185 194 H148 Z"
              fill="#c4b884"
              stroke="#dcce9f"
              strokeWidth="2"
            />
            <rect x="158" y="171" width="16" height="18" fill="#efda9e" />
            <path d="M149 195 H184" stroke="#dcce9f" strokeWidth="3" />
          </g>
        )}
      </g>
      <g
        opacity={selected === 'reading' || completed.some((d) => d.format === 'reading') ? 1 : 0.65}
      >
        <rect x="327" y="131" width="60" height="73" fill="#344936" stroke="#809475" />
        <path
          d="M331 155 H383 M331 177 H383 M339 135 V151 M350 135 V151 M362 135 V151 M345 159 V173 M358 159 V173 M369 181 V199"
          stroke="#9daa83"
          strokeWidth="4"
        />
        <path
          d="M440 191 H489 V209 H440 Z M440 209 V238 M489 209 V238 M447 191 V172 H482 V191"
          fill="none"
          stroke="#a4b08c"
          strokeWidth="3"
        />
        {stage !== 'returned' && event.preparedFormats.includes('reading') && (
          <g
            className={
              completed.some((d) => d.format === 'reading') ? 'community-reading-active' : undefined
            }
          >
            <circle
              cx="508"
              cy="149"
              r="22"
              fill="#829878"
              opacity=".25"
              stroke="#a9b895"
              strokeWidth="2"
            />
            {completed.some((d) => d.format === 'reading') && (
              <path
                className="community-fan-rotor"
                d="M508 149 Q499 125 505 130 Q519 123 508 149 Q534 148 527 153 Q525 170 508 149 Q497 173 494 165 Q487 153 508 149"
                fill="#bccda2"
                opacity=".45"
              />
            )}
            <path
              d="M508 127 V170 M487 149 H529 M493 134 L524 165 M493 165 L524 134 M508 173 V186 H493 H523"
              stroke="#acba92"
              strokeWidth="2"
            />
            <path d="M447 185 L464 180 L480 185 V194 L464 189 L447 194 Z" fill="#d9d5ac" />
          </g>
        )}
      </g>
      <g
        opacity={selected === 'theatre' || completed.some((d) => d.format === 'theatre') ? 1 : 0.65}
      >
        <path d="M637 195 H785 M649 195 V238 M772 195 V238" stroke="#a1ab85" strokeWidth="4" />
        {stage !== 'returned' && event.preparedFormats.includes('theatre') && (
          <g>
            <rect
              x="659"
              y="140"
              width="106"
              height="55"
              fill="#29372d"
              stroke="#c4b891"
              strokeWidth="3"
            />
            <path
              d="M659 140 Q675 147 678 180 L666 180 Z M765 140 Q748 147 747 180 L758 180 Z"
              fill="#a07f69"
            />
            <path d="M681 186 H744" stroke="#b1bc96" strokeWidth="2" />
            <path
              className={
                completed.some((d) => d.format === 'theatre') && rpm > 0
                  ? 'community-paper-performance'
                  : undefined
              }
              style={{ animationDuration: rpm > 0 ? `${60 / rpm}s` : undefined }}
              d="M705 158 L704 171 L695 184 H715 L708 171 Z M731 164 L724 183 H738 Z"
              fill="#d6ccaa"
            />
            <circle cx="705" cy="155" r="4" fill="#d6ccaa" />
            <circle cx="731" cy="162" r="3" fill="#d6ccaa" />
          </g>
        )}
      </g>
      {stage === 'returned' && (
        <g>
          <rect x="364" y="178" width="139" height="59" fill="#344b31" stroke="#8da673" />
          <path d="M369 186 H498 M405 179 V235 M462 179 V235" stroke="#8da673" />
          <text x="434" y="205" textAnchor="middle" fill="#d0dabb" fontSize="10">
            LOANS RETURNED
          </text>
          <text x="434" y="223" textAnchor="middle" fill="#a9bd96" fontSize="8">
            {event.preparedFormats.length} prepared object
            {event.preparedFormats.length === 1 ? '' : 's'}
          </text>
        </g>
      )}
      {completed.map((d) => {
        const index = completed.filter((other) => other.format === d.format).indexOf(d);
        const x = (d.format === 'garden' ? 45 : d.format === 'reading' ? 310 : 596) + index * 43;
        return (
          <g key={d.personId} transform={`translate(${x} 213)`}>
            <circle
              cy="-23"
              r="7"
              fill={
                d.personId === 'mum'
                  ? '#d6c190'
                  : d.personId === 'sam'
                    ? '#a6bf99'
                    : d.personId === 'nora'
                      ? '#c9a894'
                      : '#a0b2af'
              }
            />
            <path
              d="M-9 -12 Q0 -18 9 -12 L12 8 H-12 Z"
              fill={d.personId === 'sam' ? '#728f68' : '#9ba58a'}
            />
            <text y="38" textAnchor="middle" fill="#dce0bd" fontSize="9">
              {people[d.personId]?.name ?? d.personId}
            </text>
          </g>
        );
      })}
      {(['garden', 'reading', 'theatre'] as const).map((format, i) => (
        <g key={format}>
          <text
            x={145 + i * 280}
            y="271"
            textAnchor="middle"
            fill={selected === format ? '#e3d8ae' : '#a2b391'}
            fontSize="11"
          >
            {names[format]}
          </text>
          <text x={145 + i * 280} y="285" textAnchor="middle" fill="#8fa182" fontSize="8">
            {stage === 'returned'
              ? event.preparedFormats.includes(format)
                ? 'OBJECT RETURNED'
                : 'NO LOAN'
              : event.preparedFormats.includes(format)
                ? stage === 'activity'
                  ? participants.some((d) => d.format === format)
                    ? 'ACTIVITY COMPLETED'
                    : 'PREPARED · NO COMPLETED ATTENDANCE'
                  : 'EQUIPMENT PREPARED'
                : 'NO EQUIPMENT PREPARED'}
          </text>
        </g>
      ))}
    </svg>
  );
}
