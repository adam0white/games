import { Component, lazy, memo, type ReactNode, Suspense, useEffect } from 'react';
import type { ActionView, ObjectView } from '../game/types';
import { ObjectIllustration } from './ObjectIllustration';

const Inspection3D = lazy(() => import('./inspection/Inspection3D'));
class InspectionBoundary extends Component<
  { object: ObjectView; children: ReactNode; onReady?: (ready: boolean) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onReady?.(false);
  }
  render() {
    return this.state.failed ? (
      <ObjectIllustration object={this.props.object} />
    ) : (
      this.props.children
    );
  }
}
export const ObjectPresentation = memo(function ObjectPresentation({
  object,
  actions,
  disabled,
  onAction,
  onReady,
  inHand,
  onViewChange,
}: {
  object: ObjectView;
  actions?: ActionView[];
  disabled?: boolean;
  onAction?: (id: string) => void;
  onReady?: (ready: boolean) => void;
  inHand: boolean;
  onViewChange: (inHand: boolean) => void;
}) {
  useEffect(() => {
    if (!inHand) onReady?.(false);
  }, [inHand, onReady]);
  return (
    <div className={`object-presentation ${inHand ? 'in-hand' : ''}`}>
      {inHand ? (
        <InspectionBoundary object={object} onReady={onReady}>
          <Suspense
            fallback={
              <>
                <ObjectIllustration object={object} />
                <p className="inspection-hint" role="status">
                  Opening the 3D bench…
                </p>
              </>
            }
          >
            <Inspection3D
              object={object}
              actions={actions}
              disabled={disabled}
              onAction={onAction}
              onReady={onReady}
            />
          </Suspense>
        </InspectionBoundary>
      ) : (
        <ObjectIllustration object={object} />
      )}
      <button
        className="inspection-toggle"
        type="button"
        onClick={() => onViewChange(!inHand)}
        aria-expanded={inHand}
      >
        {inHand ? 'Use the illustrated bench' : 'Work on the 3D object'}
      </button>
    </div>
  );
});
