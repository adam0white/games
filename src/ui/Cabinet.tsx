import { useId } from 'react';
import type { WorkshopState } from '../game/workshop';

/** The project shows only the work already done; no unseen condition is disclosed. */
export function Cabinet({ stage, drawing }: { stage: WorkshopState['cabinet']; drawing: boolean }) {
  const titleId = useId();
  const hung = stage === 'hung' || stage === 'finished';
  return (
    <div className={`cabinet-art cabinet-${stage}`}>
      <svg viewBox="0 0 340 230" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          {hung
            ? 'The kitchen cabinet with its doors hung'
            : 'Two kitchen cabinet doors beside Dad’s notebook'}
          {drawing ? ', with a saved childhood drawing' : ''}
        </title>
        <ellipse className="cabinet-shadow" cx="176" cy="207" rx="131" ry="13" />
        {hung ? (
          <>
            <path className="cabinet-side" d="M64 66 L91 45 L289 45 L289 184 L267 204 L64 204 Z" />
            <path className="cabinet-top" d="M64 66 L91 45 L289 45 L267 66 Z" />
            <path className="cabinet-frame" d="M64 66 L267 66 L267 204 L64 204 Z" />
            <g className="cabinet-left-door">
              <path className="cabinet-door" d="M71 73 L162 73 L162 196 L71 196 Z" />
              <path className="cabinet-panel" d="M81 84 L151 84 L151 183 L81 183 Z" />
              <circle className="cabinet-knob" cx="153" cy="136" r="4" />
            </g>
            <g className="cabinet-right-door">
              <path className="cabinet-door" d="M170 73 L260 73 L260 196 L170 196 Z" />
              <path className="cabinet-panel" d="M181 84 L249 84 L249 183 L181 183 Z" />
              <circle className="cabinet-knob" cx="179" cy="136" r="4" />
            </g>
          </>
        ) : (
          <>
            <path className="cabinet-side" d="M86 42 L160 37 L177 202 L100 207 Z" />
            <path className="cabinet-door" d="M80 43 L154 38 L171 201 L94 205 Z" />
            <path className="cabinet-panel" d="M92 58 L143 54 L157 187 L105 191 Z" />
            <path className="cabinet-side" d="M174 65 L249 58 L262 206 L187 208 Z" />
            <path className="cabinet-door" d="M168 66 L244 60 L257 205 L181 208 Z" />
            <path className="cabinet-panel" d="M180 80 L233 76 L245 190 L193 194 Z" />
            {stage === 'measured' && (
              <g className="hinge-marks">
                <path d="M82 71 L97 70 M93 176 L108 175 M172 91 L187 90 M181 180 L196 179" />
              </g>
            )}
            <path className="notebook-cover" d="M42 188 L109 180 L138 208 L72 218 Z" />
            <path className="notebook-page" d="M47 187 L107 182 L131 207 L74 214 Z" />
            <path
              className="notebook-pencil"
              d="M63 191 L97 187 M70 198 L110 194 M78 205 L114 201"
            />
          </>
        )}
        {drawing && (
          <g className="saved-drawing">
            <path className="drawing-paper" d="M221 27 L286 34 L278 91 L213 84 Z" />
            <path
              className="drawing-pencil"
              d="M224 72 L228 50 L245 39 L260 55 L257 76 Z M228 50 L260 55 M237 74 L239 60 L248 61 L247 75 M245 39 L257 41 L267 54 L260 55"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
