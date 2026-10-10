import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { GameInput, GameView } from '../../game/types';
import { createWorkshopModel } from './workshopModel';
import {
  moveRoomGesture,
  type RoomGesture,
  roomSelectionAllowed,
  validPlaceInput,
  type WorkshopGeometry,
  workshopGeometry,
  workshopPlaces,
} from './workshopView';

export interface WorkshopScene3DProps {
  view: GameView;
  disabled?: boolean;
  onInput: (input: GameInput) => void;
  onFocus?: () => void;
  onCabinetFocus?: () => void;
  onOpenJournal?: () => void;
}

export default function WorkshopScene3D({
  view,
  disabled = false,
  onInput,
  onFocus,
  onCabinetFocus,
  onOpenJournal,
}: WorkshopScene3DProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const draw = useRef<(() => void) | null>(null);
  const hit = useRef<((x: number, y: number) => string | null) | null>(null);
  const yaw = useRef(-0.12);
  const pointer = useRef<RoomGesture | null>(null);
  const updateModel = useRef<((geometry: WorkshopGeometry) => void) | null>(null);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string>('bench');
  const [hovered, setHovered] = useState<string | null>(null);
  const places = workshopPlaces(view, !!onOpenJournal);
  const place = places.find((item) => item.id === selected);
  const hover = places.find((item) => item.id === hovered);
  const geometryKey = JSON.stringify(workshopGeometry(view, !!onOpenJournal));
  const geometry = useMemo(() => JSON.parse(geometryKey) as WorkshopGeometry, [geometryKey]);

  useEffect(() => {
    const surface = canvas.current;
    if (!surface || failed) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas: surface,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = SRGBColorSpace;
    const scene = new Scene();
    scene.background = new Color('#ded1ba');
    scene.add(new HemisphereLight('#fff5de', '#77654c', 2.6));
    scene.add(new AmbientLight('#fce8c5', 0.7));
    const sun = new DirectionalLight('#fff2d3', 2.4);
    sun.position.set(-3, 6, 4);
    scene.add(sun);
    let model: ReturnType<typeof createWorkshopModel> | null = null;
    const camera = new OrthographicCamera(-4.6, 4.6, 3.1, -3.1, 0.1, 40);
    camera.position.set(5.4, 5.2, 8.4);
    camera.lookAt(0, 0.85, 0);
    const raycaster = new Raycaster();
    const point = new Vector2();
    function render() {
      if (model) model.root.rotation.y = yaw.current;
      renderer.render(scene, camera);
    }
    draw.current = render;
    updateModel.current = (projection) => {
      if (model) {
        scene.remove(model.root);
        model.dispose();
      }
      model = createWorkshopModel(projection);
      scene.add(model.root);
      render();
    };
    hit.current = (x, y) => {
      if (!model) return null;
      const bounds = surface?.getBoundingClientRect();
      if (!bounds?.width || !bounds.height) return null;
      point.set(
        ((x - bounds.left) / bounds.width) * 2 - 1,
        -((y - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(point, camera);
      // Include room walls and other solids in occlusion, not just interactive meshes.
      const first = raycaster.intersectObject(model.root, true)[0];
      return typeof first?.object.userData.placeId === 'string'
        ? first.object.userData.placeId
        : null;
    };
    function resize() {
      const width = surface?.clientWidth ?? 640;
      const height = surface?.clientHeight ?? 340;
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const halfWidth = Math.max(4.5, 3.15 * aspect);
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfWidth / aspect;
      camera.bottom = -halfWidth / aspect;
      camera.updateProjectionMatrix();
      render();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    const lost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
      draw.current = null;
      hit.current = null;
    };
    surface.addEventListener('webglcontextlost', lost);
    return () => {
      observer.disconnect();
      surface.removeEventListener('webglcontextlost', lost);
      draw.current = null;
      hit.current = null;
      model?.dispose();
      updateModel.current = null;
      pointer.current = null;
      renderer.dispose();
    };
  }, [failed]);

  useEffect(() => {
    if (!failed) updateModel.current?.(geometry);
  }, [geometry, failed]);

  function turn(delta: number) {
    yaw.current = Math.max(-0.52, Math.min(0.36, yaw.current + delta));
    draw.current?.();
  }
  function activate() {
    if (!place || disabled) return;
    if (place.navigation === 'focus') {
      onFocus?.();
      return;
    }
    if (place.navigation === 'cabinet') {
      onCabinetFocus?.();
      return;
    }
    if (place.kind === 'journal') {
      onOpenJournal?.();
      return;
    }
    const input = validPlaceInput(view, place.id);
    if (input) onInput(input);
  }
  return (
    <section
      className="workshop-scene"
      aria-label={view.scene === 'home' ? 'Home work corner' : 'Garage workshop'}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '1rem',
        }}
      >
        <h2>{view.scene === 'home' ? 'The work corner' : 'Your garage'}</h2>
        <span style={{ fontSize: '0.85em' }}>Look around · choose a place</span>
      </div>
      {!failed ? (
        <canvas
          key={retry}
          ref={canvas}
          role="img"
          aria-label="A cutaway workshop. Drag to turn the room, or use the turn controls. Choose places using the buttons below."
          style={{
            display: 'block',
            width: '100%',
            height: 'clamp(230px, 42vw, 420px)',
            borderRadius: '12px',
            touchAction: 'pan-y',
            cursor: hovered ? 'pointer' : 'grab',
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary || pointer.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointer.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              lastX: event.clientX,
              moved: false,
            };
          }}
          onPointerMove={(event) => {
            const active = pointer.current;
            if (active?.id === event.pointerId) {
              const next = moveRoomGesture(active, event.pointerId, event.clientX, event.clientY);
              if (next.moved) turn((event.clientX - active.lastX) / 330);
              pointer.current = next;
            } else if (event.pointerType === 'mouse')
              setHovered(hit.current?.(event.clientX, event.clientY) ?? null);
          }}
          onPointerUp={(event) => {
            const active = pointer.current;
            if (active?.id !== event.pointerId) return;
            pointer.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
            if (!roomSelectionAllowed(active, event.pointerId, event.clientX, event.clientY))
              return;
            const id = hit.current?.(event.clientX, event.clientY);
            if (id) setSelected(id);
          }}
          onPointerCancel={(event) => {
            if (pointer.current?.id === event.pointerId) pointer.current = null;
          }}
          onLostPointerCapture={(event) => {
            if (pointer.current?.id === event.pointerId) pointer.current = null;
          }}
          onPointerLeave={() => setHovered(null)}
        />
      ) : (
        <div>
          <p>The room view is unavailable. Every place and operation is available below.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setRetry((value) => value + 1);
            }}
          >
            Try the room view again
          </button>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBlock: '0.5rem',
        }}
      >
        {!failed && (
          <>
            <button type="button" aria-label="Turn workshop left" onClick={() => turn(-0.18)}>
              Turn left
            </button>
            <button type="button" aria-label="Turn workshop right" onClick={() => turn(0.18)}>
              Turn right
            </button>
            <button
              type="button"
              onClick={() => {
                yaw.current = -0.12;
                draw.current?.();
              }}
            >
              Front view
            </button>
          </>
        )}
        <span aria-hidden="true">{hover?.label ?? 'Tap a place, then choose what to do.'}</span>
      </div>
      <fieldset
        className="workshop-places"
        aria-label="Places and known objects"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
      >
        {places.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={selected === item.id}
            onClick={() => setSelected(item.id)}
            style={{ minHeight: 44 }}
          >
            {item.kind === 'object'
              ? `${view.shelf.findIndex((object) => `object:${object.id}` === item.id) + 1}. `
              : ''}
            {item.label}
          </button>
        ))}
      </fieldset>
      <div
        className="workshop-selection"
        aria-live="polite"
        style={{
          marginTop: '0.75rem',
          padding: '0.85rem',
          border: '1px solid currentColor',
          borderRadius: '10px',
        }}
      >
        {place ? (
          <>
            <strong>{place.label}</strong>
            <p>{place.detail}</p>
            {(place.input ||
              (place.navigation === 'focus' && onFocus) ||
              (place.navigation === 'cabinet' && onCabinetFocus) ||
              place.kind === 'journal') && (
              <button type="button" disabled={disabled} onClick={activate}>
                {place.actionLabel ??
                  (place.kind === 'journal' ? 'Open notebook' : 'Work at the bench')}
              </button>
            )}
          </>
        ) : (
          <p>Choose a place to see what is there.</p>
        )}
      </div>
    </section>
  );
}
