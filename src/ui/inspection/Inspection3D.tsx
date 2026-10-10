import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  CircleGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { ObjectView } from '../../game/types';
import { ObjectIllustration } from '../ObjectIllustration';
import { createObjectModel } from './objectModel';

export default function Inspection3D({ object }: { object: ObjectView }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const render = useRef<((x: number, y: number) => void) | null>(null);
  const angle = useRef({ x: 0, y: -0.35 });
  const dragging = useRef<{ id: number; x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [showKnownParts, setShowKnownParts] = useState(false);
  useEffect(() => {
    const surface = canvas.current;
    const frame = container.current;
    if (!surface || !frame) return;
    let renderer: WebGLRenderer;
    try {
      if (
        !surface.getContext('webgl2', {
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        })
      ) {
        setFailed(true);
        return;
      }
      renderer = new WebGLRenderer({
        canvas: surface,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    const scene = new Scene();
    const camera = new OrthographicCamera(-1.7, 1.7, 2.05, -1.35, 0.1, 20);
    camera.position.set(0, 2.65, 5.2);
    camera.lookAt(new Vector3(0, 0.9, 0));
    scene.add(new HemisphereLight('#fff0d8', '#665d4b', 2.4));
    scene.add(new AmbientLight('#efe4d2', 0.35));
    const keyLight = new DirectionalLight('#fff3dc', 3.1);
    keyLight.position.set(-3, 4, 5);
    scene.add(keyLight);
    const rimLight = new DirectionalLight('#d4e3dc', 1.3);
    rimLight.position.set(3, 2, -3);
    scene.add(rimLight);
    const model = createObjectModel(object, showKnownParts);
    scene.add(model.root);
    const shadowGeometry = new CircleGeometry(0.86, 40);
    const shadowMaterial = new MeshStandardMaterial({
      color: '#665540',
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.025;
    shadow.scale.set(1.25, 0.65, 1);
    scene.add(shadow);
    function draw(x: number, y: number) {
      model.root.rotation.set(x, y, 0);
      renderer.render(scene, camera);
    }
    render.current = draw;
    function size() {
      const width = frame?.clientWidth ?? 320;
      const height = frame?.clientHeight ?? 300;
      renderer.setSize(width, height, false);
      const ratio = width / height;
      camera.left = -1.45 * ratio;
      camera.right = 1.45 * ratio;
      camera.top = 2.0;
      camera.bottom = -1.15;
      camera.updateProjectionMatrix();
      draw(angle.current.x, angle.current.y);
    }
    const resize = new ResizeObserver(size);
    resize.observe(frame);
    size();
    function contextLost(event: Event) {
      event.preventDefault();
      render.current = null;
      setFailed(true);
    }
    surface.addEventListener('webglcontextlost', contextLost);
    return () => {
      surface.removeEventListener('webglcontextlost', contextLost);
      resize.disconnect();
      render.current = null;
      model.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      renderer.dispose();
    };
  }, [object, showKnownParts]);
  function turn(dx: number, dy: number) {
    angle.current = {
      x: Math.max(-0.6, Math.min(0.6, angle.current.x + dx)),
      y: angle.current.y + dy,
    };
    render.current?.(angle.current.x, angle.current.y);
  }
  if (failed)
    return (
      <div className="inspection-still">
        <ObjectIllustration object={object} />
        <p className="inspection-hint">A still view of this object is available here.</p>
      </div>
    );
  return (
    <div className="inspection-view">
      <div className="inspection-frame" ref={container}>
        <canvas
          key={showKnownParts ? 'parts' : 'shell'}
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label={`${object.title}. Use arrow keys to turn the object; Home restores the front view.`}
          onKeyDown={(event) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) {
              event.preventDefault();
              if (event.key === 'Home') {
                angle.current = { x: 0, y: -0.35 };
                render.current?.(0, -0.35);
              } else
                turn(
                  event.key === 'ArrowUp' ? -0.12 : event.key === 'ArrowDown' ? 0.12 : 0,
                  event.key === 'ArrowLeft' ? -0.18 : event.key === 'ArrowRight' ? 0.18 : 0,
                );
            }
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragging.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            const prior = dragging.current;
            if (!prior || event.pointerId !== prior.id) return;
            turn((event.clientY - prior.y) / 170, (event.clientX - prior.x) / 140);
            dragging.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            dragging.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            dragging.current = null;
          }}
        />
      </div>
      <span className="object-condition">{object.condition}</span>
      <p className="inspection-hint">Drag to turn it. Arrow keys work too.</p>
      {object.inspected && object.observations.length > 0 && (
        <button
          type="button"
          className="known-parts-toggle"
          aria-expanded={showKnownParts}
          onClick={() => setShowKnownParts(!showKnownParts)}
        >
          {showKnownParts ? 'Put the known parts away' : 'Lay out what you have examined'}
        </button>
      )}
      {showKnownParts && (
        <p className="inspection-hint">The tray shows only parts you have examined.</p>
      )}
      <fieldset className="inspection-controls">
        <legend className="visually-hidden">Turn the object</legend>
        <button type="button" aria-label="Turn left" onClick={() => turn(0, -0.35)}>
          ←
        </button>
        <button type="button" aria-label="Turn right" onClick={() => turn(0, 0.35)}>
          →
        </button>
        <button
          type="button"
          onClick={() => {
            angle.current = { x: 0, y: -0.35 };
            render.current?.(0, -0.35);
          }}
        >
          Front again
        </button>
      </fieldset>
    </div>
  );
}
