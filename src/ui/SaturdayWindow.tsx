import type { ReactNode } from 'react';
export interface SaturdaySceneView {
  location: 'garage' | 'window';
  items: { id: string; title: string; appearance: string }[];
  caption: string;
  visitor?: string;
}
/** A place to anticipate and look at. Only actually chosen, present objects are shown. */
export function SaturdayWindow({
  scene,
  children,
  sampleAccess,
}: {
  scene: SaturdaySceneView;
  sampleAccess?: 'within-reach' | 'protected';
  children?: ReactNode;
}) {
  return (
    <section
      className="saturday-scene"
      aria-label={scene.location === 'window' ? 'The low window' : 'An afternoon at the bench'}
    >
      <div className={`saturday-view saturday-view--${scene.location}`}>
        <div className="saturday-window-frame" aria-hidden="true">
          <i />
          <i />
        </div>
        <div className="saturday-display">
          {scene.items.map((item) => (
            <div className={`saturday-kept saturday-kept--${item.appearance}`} key={item.id}>
              <svg viewBox="0 0 120 90" role="img" aria-label={item.title}>
                {['model', 'model-remembered', 'model-current'].includes(item.appearance) ? (
                  <g fill="#bb976e" stroke="#685d48" strokeWidth="2">
                    <path d="M8 73h104v8H8z" />
                    <path d="M16 72V35l14-12 14 12v37M46 72V23h28v49M78 72V40h24v32" />
                    <path
                      d={
                        item.appearance === 'model-current'
                          ? 'M25 72V51h12v21M50 40h21v14M86 50h9v11'
                          : 'M25 72V51h12v21M54 35h12v15M86 50h9v11'
                      }
                      fill="#e7d8ac"
                    />
                  </g>
                ) : item.appearance === 'label-stand' || item.appearance === 'display-carousel' ? (
                  <g stroke="#61735e" strokeWidth="4">
                    <ellipse cx="60" cy="78" rx="29" ry="6" fill="#78886c" />
                    <path d="M60 78V39M30 43h60" />
                    <path
                      d="M29 42V16h18v26M54 42V10h18v32M78 42V20h17v22"
                      fill="#e7d8ac"
                      strokeWidth="2"
                    />
                  </g>
                ) : (
                  <g stroke="#796e57" strokeWidth="2" fill="#ad9875">
                    <path d="M18 39h83v39H18z" />
                    <path d="M18 39l12-13h58l13 13" />
                    <path d="M53 40v10h13V40" fill="#cab77e" />
                  </g>
                )}
              </svg>
              <span>{item.title}</span>
            </div>
          ))}
        </div>
      </div>
      {sampleAccess && (
        <section className="saturday-sample" aria-label="Nora’s retained cloth sample">
          <svg
            width="64"
            height="42"
            viewBox="0 0 64 42"
            role="img"
            aria-label={
              sampleAccess === 'within-reach'
                ? 'Folded cloth showing its less faded reverse'
                : 'Nora’s protected folded cloth'
            }
          >
            <path d="M4 7h42l12 29H12z" fill="#839b9c" stroke="#667b7c" />
            {sampleAccess === 'within-reach' && (
              <>
                <path d="M4 7l22 5-14 24z" fill="#b6c6be" stroke="#667b7c" />
                <path d="M10 12l16 2" stroke="#dae0d2" />
              </>
            )}
          </svg>
          <span>
            {sampleAccess === 'within-reach'
              ? 'Nora’s sample, within reach'
              : 'Nora’s sample, kept protected'}
          </span>
        </section>
      )}
      <p className="saturday-caption">{scene.caption}</p>
      {scene.visitor && <p className="saturday-visitor">{scene.visitor}</p>}
      {children}
    </section>
  );
}

interface SaturdayPreparationView {
  stage: string;
  display?: string;
  title?: string;
  selectedDisplay?: string;
  appointmentLabel?: string;
  scene: { caption: string };
  shelf: { checked: boolean; position: string };
  departureBlockers: string[];
}
export function SaturdayPreparation({ saturday }: { saturday: SaturdayPreparationView }) {
  const displays: Record<string, string> = {
    'remembered-model': 'The street as you remember it',
    'current-model': 'The street as it is now',
    objects: 'Useful repaired objects',
    private: 'A quiet afternoon at your bench',
  };
  return (
    <section className="saturday-preparation" aria-label="Saturday afternoon plan">
      <span className="card-overline">
        {saturday.stage === 'invitation' ? 'A note from Nora' : 'An afternoon to look forward to'}
      </span>
      <h2>{saturday.title ?? 'A window for Saturday'}</h2>
      {saturday.stage === 'invitation' ? (
        <p>{saturday.scene.caption}</p>
      ) : (
        <>
          {saturday.appointmentLabel && (
            <p className="saturday-appointment">{saturday.appointmentLabel}</p>
          )}
          <dl>
            <div>
              <dt>Your display</dt>
              <dd>
                {saturday.selectedDisplay ??
                  (saturday.display ? displays[saturday.display] : 'Still yours to choose')}
              </dd>
            </div>
            {saturday.display !== 'private' && (
              <div>
                <dt>The shelf</dt>
                <dd>
                  {saturday.shelf.checked
                    ? 'Ready to hold the display'
                    : saturday.shelf.position === 'low'
                      ? 'Using the low counter, as agreed'
                      : 'Still needs a stable place for the display'}
                </dd>
              </div>
            )}
          </dl>
          {saturday.departureBlockers.length > 0 && (
            <div className="saturday-before-leaving">
              <strong>Before you leave</strong>
              <ul>
                {saturday.departureBlockers.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
