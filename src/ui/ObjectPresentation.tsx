import { Component, lazy, memo, type ReactNode, Suspense, useState } from 'react';
import type { ObjectView } from '../game/types';
import { ObjectIllustration } from './ObjectIllustration';

const Inspection3D = lazy(() => import('./inspection/Inspection3D'));
class InspectionBoundary extends Component<
  { object: ObjectView; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <ObjectIllustration object={this.props.object} />
    ) : (
      this.props.children
    );
  }
}
export const ObjectPresentation = memo(
  function ObjectPresentation({ object }: { object: ObjectView }) {
    const [inHand, setInHand] = useState(false);
    return (
      <div className="object-presentation">
        {inHand ? (
          <InspectionBoundary object={object}>
            <Suspense fallback={<ObjectIllustration object={object} />}>
              <Inspection3D object={object} />
            </Suspense>
          </InspectionBoundary>
        ) : (
          <ObjectIllustration object={object} />
        )}
        <button
          className="inspection-toggle"
          type="button"
          onClick={() => setInHand(!inHand)}
          aria-expanded={inHand}
        >
          {inHand ? 'Set it back down' : 'Turn it over'}
        </button>
      </div>
    );
  },
  (previous, next) => JSON.stringify(previous.object) === JSON.stringify(next.object),
);
