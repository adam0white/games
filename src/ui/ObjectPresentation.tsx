import { Component, lazy, memo, type ReactNode, Suspense, useEffect } from 'react';
import type { ActionView, ObjectView } from '../game/types';
import { ObjectIllustration } from './ObjectIllustration';

const Inspection3D = lazy(() => import('./inspection/Inspection3D'));
class InspectionBoundary extends Component<
  {
    object: ObjectView;
    children: ReactNode;
    onReady?: (ready: boolean) => void;
    result?: ReactNode;
  },
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
      <>
        <ObjectIllustration object={this.props.object} />
        {this.props.result}
      </>
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
  result,
}: {
  object: ObjectView;
  actions?: ActionView[];
  disabled?: boolean;
  onAction?: (id: string) => void;
  onReady?: (ready: boolean) => void;
  inHand: boolean;
  onViewChange: (inHand: boolean) => void;
  result?: ReactNode;
}) {
  useEffect(() => {
    if (!inHand) onReady?.(false);
  }, [inHand, onReady]);
  return (
    <div className={`object-presentation ${inHand ? 'in-hand' : ''}`}>
      {inHand ? (
        <InspectionBoundary object={object} onReady={onReady} result={result}>
          <Suspense
            fallback={
              <>
                <ObjectIllustration object={object} />
                {result}
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
              result={result}
            />
          </Suspense>
        </InspectionBoundary>
      ) : (
        <>
          <ObjectIllustration object={object} />
          {result}
        </>
      )}
      <button
        className="inspection-toggle"
        type="button"
        onClick={() => onViewChange(!inHand)}
        aria-expanded={inHand}
      >
        {inHand ? 'Use labelled diagram' : 'Use 3D bench'}
      </button>
    </div>
  );
});
