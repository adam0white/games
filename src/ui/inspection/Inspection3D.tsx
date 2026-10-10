import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  CircleGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { ActionView, ObjectView } from '../../game/types';
import { ObjectIllustration } from '../ObjectIllustration';
import {
  getMappedRepairActions,
  getRepairTargetLabel,
  getRepairToolName,
  type RepairTarget,
  repairClickAllowed,
  resolveRepairAction,
  updateRepairGesture,
} from '../repairBindings';
import { createObjectModel } from './objectModel';
import { resolveTouchTarget, type ScreenBounds } from './touchTargets';

export interface Inspection3DProps {
  object: ObjectView;
  actions?: ActionView[];
  disabled?: boolean;
  onAction?: (id: string) => void;
  onReady?: (ready: boolean) => void;
}
export default function Inspection3D({
  object,
  actions = [],
  disabled = false,
  onAction,
  onReady,
}: Inspection3DProps) {
  const bindings = getMappedRepairActions(object, actions);
  const [tool, setTool] = useState<string | null>(null);
  const [alternativeControls, setAlternativeControls] = useState(false);
  const [picked, setPicked] = useState<RepairTarget | null>(null);
  const highlight = useRef<((target: RepairTarget | null) => void) | null>(null);
  const selectedTarget = bindings.find((b) => b.action.id === tool)?.target ?? null;
  const selectedTargetRef = useRef(selectedTarget);
  selectedTargetRef.current = selectedTarget;
  useEffect(() => {
    highlight.current?.(selectedTarget);
  }, [selectedTarget]);
  const pick = useRef<((x: number, y: number) => RepairTarget | null) | null>(null);
  const readiness = useRef(onReady);
  readiness.current = onReady;
  const [retry, setRetry] = useState(0);
  const actionAvailable = Boolean(onAction);
  const objectKey = JSON.stringify(object);
  const targetsKey = [...new Set(bindings.map((b) => b.target))].sort().join(',');
  const projection = useRef({ objectKey, showKnownParts: false, targetsKey });
  const replaceModel = useRef<
    ((object: ObjectView, known: boolean, targets: RepairTarget[]) => void) | null
  >(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const render = useRef<((x: number, y: number) => void) | null>(null);
  const angle = useRef({ x: 0, y: -0.35 });
  const dragging = useRef<{
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [showKnownParts, setShowKnownParts] = useState(false);
  projection.current = { objectKey, showKnownParts, targetsKey };
  useEffect(() => {
    // Retry replaces the canvas so a lost WebGL context gets a fresh surface.
    const surfaceGeneration = retry;
    const presentedObject = JSON.parse(projection.current.objectKey) as ObjectView;
    const surface = canvas.current;
    const frame = container.current;
    if (!surface || !frame || surface.dataset.generation !== String(surfaceGeneration)) return;
    readiness.current?.(false);
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
    let model = createObjectModel(
      presentedObject,
      projection.current.showKnownParts,
      projection.current.targetsKey.split(',').filter(Boolean) as RepairTarget[],
    );
    const raycaster = new Raycaster();
    pick.current = (x, y) => {
      const bounds = surface.getBoundingClientRect();
      raycaster.setFromCamera(
        new Vector2(
          ((x - bounds.left) / bounds.width) * 2 - 1,
          (-(y - bounds.top) / bounds.height) * 2 + 1,
        ),
        camera,
      );
      scene.updateMatrixWorld(true);
      const actual =
        (raycaster.intersectObject(model.root, true)[0]?.object.userData.repairTarget as
          | RepairTarget
          | undefined) ?? null;
      const selected = selectedTargetRef.current;
      let projected: ScreenBounds | null = null;
      if (!actual && selected) {
        const assembly = ['shell', 'operation', 'mechanism'].includes(selected);
        const box = new Box3();
        if (assembly) box.setFromObject(model.root);
        else
          for (const mesh of model.hitRegions) {
            if (mesh.userData.repairTarget === selected) box.union(new Box3().setFromObject(mesh));
          }
        if (!box.isEmpty()) {
          const xs: number[] = [],
            ys: number[] = [];
          for (const bx of [box.min.x, box.max.x])
            for (const by of [box.min.y, box.max.y])
              for (const bz of [box.min.z, box.max.z]) {
                const screen = new Vector3(bx, by, bz).project(camera);
                xs.push(bounds.left + ((screen.x + 1) * bounds.width) / 2);
                ys.push(bounds.top + ((1 - screen.y) * bounds.height) / 2);
              }
          projected = {
            left: Math.min(...xs),
            right: Math.max(...xs),
            top: Math.min(...ys),
            bottom: Math.max(...ys),
          };
        }
      }
      return resolveTouchTarget(actual, selected, x, y, projected);
    };
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
    let animationFrame = 0;
    function draw(x: number, y: number) {
      model.root.rotation.set(x, y, 0);
      renderer.render(scene, camera);
    }
    render.current = draw;
    highlight.current = (target) => {
      model.highlight(target);
      draw(angle.current.x, angle.current.y);
    };
    function animatePreview() {
      cancelAnimationFrame(animationFrame);
      if (
        !model.animateOperation(0) ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ) {
        model.animateOperation(1);
        draw(angle.current.x, angle.current.y);
        return;
      }
      let start: number | null = null;
      function frame(now: number) {
        start ??= now;
        const fraction = Math.min(1, (now - start) / 720);
        model.animateOperation(fraction);
        draw(angle.current.x, angle.current.y);
        if (fraction < 1) animationFrame = requestAnimationFrame(frame);
      }
      animationFrame = requestAnimationFrame(frame);
    }
    replaceModel.current = (nextObject, known, targets) => {
      scene.remove(model.root);
      model.dispose();
      model = createObjectModel(nextObject, known, targets);
      scene.add(model.root);
      model.highlight(selectedTargetRef.current);
      draw(angle.current.x, angle.current.y);
      animatePreview();
    };
    function size() {
      const width = frame?.clientWidth ?? 320;
      const height = frame?.clientHeight ?? 300;
      if (width <= 0 || height <= 0) return;
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
    highlight.current?.(selectedTargetRef.current);
    readiness.current?.(actionAvailable);
    function contextLost(event: Event) {
      event.preventDefault();
      cancelAnimationFrame(animationFrame);
      render.current = null;
      highlight.current = null;
      pick.current = null;
      readiness.current?.(false);
      replaceModel.current = null;
      setFailed(true);
    }
    surface.addEventListener('webglcontextlost', contextLost);
    return () => {
      cancelAnimationFrame(animationFrame);
      surface.removeEventListener('webglcontextlost', contextLost);
      resize.disconnect();
      highlight.current = null;
      pick.current = null;
      dragging.current = null;
      readiness.current?.(false);
      render.current = null;
      model.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      replaceModel.current = null;
      renderer.dispose();
    };
  }, [retry, actionAvailable]);
  useEffect(() => {
    replaceModel.current?.(
      JSON.parse(objectKey) as ObjectView,
      showKnownParts,
      targetsKey.split(',').filter(Boolean) as RepairTarget[],
    );
  }, [objectKey, showKnownParts, targetsKey]);
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
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setRetry((n) => n + 1);
          }}
        >
          Try the 3D view again
        </button>
        {!onReady &&
          bindings.map(({ action }) => (
            <button
              type="button"
              key={action.id}
              disabled={disabled || !onAction}
              onClick={() => onAction?.(action.id)}
            >
              {action.label}
            </button>
          ))}
      </div>
    );
  return (
    <div className="inspection-view">
      <div className="inspection-frame" ref={container}>
        <canvas
          key={retry}
          data-generation={retry}
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label={`${object.title}: ${object.condition}. Use arrow keys to turn the object; Home restores the front view.`}
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
            if (event.button !== 0 || dragging.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragging.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              startX: event.clientX,
              startY: event.clientY,
              moved: false,
            };
          }}
          onPointerMove={(event) => {
            const prior = dragging.current;
            if (!prior || event.pointerId !== prior.id) return;
            const next = updateRepairGesture(prior, event.pointerId, event.clientX, event.clientY);
            if (next.moved) turn((event.clientY - prior.y) / 170, (event.clientX - prior.x) / 140);
            dragging.current = next;
          }}
          onPointerUp={(event) => {
            const prior = dragging.current;
            if (!prior || prior.id !== event.pointerId) return;
            if (repairClickAllowed(prior, event.pointerId, event.clientX, event.clientY)) {
              const target = pick.current?.(event.clientX, event.clientY) ?? null;
              setPicked(target);
              const action = resolveRepairAction(bindings, tool, target, disabled);
              if (action) {
                onAction?.(action);
                setTool(null);
              }
            }
            dragging.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (dragging.current?.id === event.pointerId) dragging.current = null;
          }}
          onLostPointerCapture={(event) => {
            if (dragging.current?.id === event.pointerId) dragging.current = null;
          }}
        />
      </div>
      <p className="inspection-hint">Drag to turn it. Arrow keys work too.</p>
      {onAction && object.inspected && (
        <p className="inspection-hint">
          {object.assembly
            ? object.assembly.state === 'open'
              ? 'Open assembly: '
              : 'Assembled object: '
            : 'Examined parts: '}
          {[
            ...new Set(
              bindings
                .filter((b) => !['shell', 'operation', 'mechanism'].includes(b.target))
                .map((b) => b.label),
            ),
          ].join(' · ') ||
            (object.assembly ? getRepairTargetLabel(object, 'cover') : 'Use the whole mechanism')}
        </p>
      )}
      {onAction && bindings.length > 0 && (
        <fieldset className="inspection-tools">
          <legend>Choose a tool, then touch the object or examined part</legend>
          {bindings.map(({ action }) => (
            <button
              type="button"
              key={action.id}
              disabled={disabled}
              data-choice="true"
              aria-pressed={tool === action.id}
              onClick={() => setTool(tool === action.id ? null : action.id)}
            >
              {getRepairToolName(object, action)}
            </button>
          ))}
          {picked && <p className="inspection-hint">{getRepairTargetLabel(object, picked)}</p>}
          {tool && (
            <p role="status">
              {bindings.find((b) => b.action.id === tool)?.action.label} ·{' '}
              {getRepairTargetLabel(object, selectedTarget ?? 'shell')}.{' '}
              {bindings.find((b) => b.action.id === tool)?.action.detail}
            </p>
          )}
          <details
            hidden={!tool}
            open={alternativeControls}
            onToggle={(event) => setAlternativeControls(event.currentTarget.open)}
          >
            <summary>Keyboard and alternative controls</summary>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (tool && bindings.some((b) => b.action.id === tool)) onAction(tool);
                setTool(null);
              }}
            >
              Do the selected work
            </button>
          </details>
        </fieldset>
      )}
      {!onAction && object.inspected && object.observations.length > 0 && (
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
