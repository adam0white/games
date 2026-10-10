import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { ActionView } from '../game/types';
import { Cabinet } from './Cabinet';
import {
  type CabinetAlignment,
  type CabinetTarget,
  cabinetPose,
  cabinetTarget,
  createCabinetModel,
  resolveCabinetAction,
} from './cabinetModel';

const labels: Record<CabinetTarget, string> = {
  handle: 'Door handle',
  upper: 'Upper hinge',
  lower: 'Lower hinge',
  gap: 'Meeting edge',
};
const targets = ['handle', 'upper', 'lower', 'gap'] as const;
export function CabinetAlignment3D({
  alignment,
  actions,
  drawing,
  disabled = false,
  onAction,
}: {
  alignment: CabinetAlignment;
  actions: ActionView[];
  drawing: boolean;
  disabled?: boolean;
  onAction: (id: string) => void;
}) {
  const offered = actions.filter(
    (action) => alignment.actionIds.includes(action.id) && cabinetTarget(action.id),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [front, setFront] = useState(false);
  const [alternative, setAlternative] = useState(false);
  const surface = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const targetButtons = useRef(new Map<CabinetTarget, HTMLButtonElement>());
  const publicState = useRef(alignment);
  publicState.current = alignment;
  const displayedDrawing = useRef(drawing);
  displayedDrawing.current = drawing;
  const cameraFront = useRef(front);
  cameraFront.current = front;
  const key = alignment.position + alignment.door + alignment.observation;
  useEffect(() => {
    if (!offered.some((action) => action.id === selected)) setSelected(null);
  }, [offered, selected]);
  useEffect(() => {
    const canvas = surface.current,
      container = frame.current;
    if (!canvas || !container) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new Scene();
    scene.add(new AmbientLight('#fff3d6', 1.1), new HemisphereLight('#e7f1fb', '#79593e', 2));
    const light = new DirectionalLight('#fff1d6', 3);
    light.position.set(-3, 5, 4);
    scene.add(light);
    const camera = new OrthographicCamera(-2.15, 2.15, 1.8, -1.8, 0.1, 30);
    const model = createCabinetModel();
    scene.add(model.root);
    let current = cabinetPose(publicState.current),
      animation = 0,
      last = performance.now(),
      lastDoor = publicState.current.door,
      caughtAt = -Infinity;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw(now: number) {
      const width = Math.max(container?.clientWidth ?? 1, 1),
        height = Math.max(container?.clientHeight ?? 1, 1);
      if (
        canvas?.width !== Math.round(width * renderer.getPixelRatio()) ||
        canvas?.height !== Math.round(height * renderer.getPixelRatio())
      )
        renderer.setSize(width, height, false);
      camera.left = (-1.8 * width) / height;
      camera.right = (1.8 * width) / height;
      camera.zoom = displayedDrawing.current ? 0.9 : 1;
      camera.position.set(cameraFront.current ? 0 : 2.3, cameraFront.current ? 0.2 : 1.5, 7);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      if (lastDoor !== publicState.current.door) {
        if (publicState.current.door === 'caught') caughtAt = now;
        lastDoor = publicState.current.door;
      }
      const wanted = cabinetPose(publicState.current);
      if (!reduced && publicState.current.door === 'caught' && now - caughtAt < 190)
        wanted.swing = 0;
      const blend = reduced ? 1 : Math.min(1, (now - last) / 100);
      last = now;
      current = {
        tilt: current.tilt + (wanted.tilt - current.tilt) * blend,
        swing: current.swing + (wanted.swing - current.swing) * blend,
      };
      model.right.rotation.set(0, current.swing, current.tilt);
      model.left.rotation.y = publicState.current.door === 'open' ? -0.13 : 0;
      model.paper.visible = publicState.current.observation === 'paper';
      model.drawing.visible = displayedDrawing.current;
      renderer.render(scene, camera);
      for (const [target, object] of model.targets) {
        const button = targetButtons.current.get(target);
        if (!button) continue;
        const point = object.getWorldPosition(new Vector3()).project(camera);
        button.dataset.labelAbove = String(((1 - point.y) * height) / 2 > height - 70);
        button.style.left = `${((point.x + 1) * width) / 2}px`;
        button.style.top = `${((1 - point.y) * height) / 2}px`;
      }
      animation = requestAnimationFrame(draw);
    }
    function lost(event: Event) {
      event.preventDefault();
      cancelAnimationFrame(animation);
      setFailed(true);
    }
    canvas.addEventListener('webglcontextlost', lost);
    animation = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animation);
      canvas.removeEventListener('webglcontextlost', lost);
      model.dispose();
      renderer.dispose();
    };
  }, []);
  const binding = offered.find((action) => action.id === selected);
  function apply(target: CabinetTarget) {
    const id = resolveCabinetAction(alignment.actionIds, selected, target, disabled);
    if (id) onAction(id);
  }
  return (
    <div
      className="cabinet-work-surface"
      data-position={alignment.position}
      data-door={alignment.door}
    >
      <div className="cabinet-physical-view" ref={frame}>
        {failed ? (
          <Cabinet
            stage={alignment.checked ? 'finished' : 'hung'}
            drawing={drawing}
            alignment={alignment}
          />
        ) : (
          <>
            <canvas
              ref={surface}
              aria-label={`Two hung wooden cabinet doors, handles and adjustable hinges${drawing ? ', with your saved drawing beside them' : ''}`}
            />
            {targets.map((target) => (
              <button
                type="button"
                key={target}
                ref={(button) => {
                  if (button) targetButtons.current.set(target, button);
                  else targetButtons.current.delete(target);
                }}
                className={`cabinet-part ${binding && cabinetTarget(binding.id) === target ? 'selected' : ''}`}
                disabled={disabled || !binding || cabinetTarget(binding.id) !== target}
                onClick={() => apply(target)}
                aria-label={`Apply ${binding?.label ?? 'selected action'} at ${labels[target]}`}
              >
                <span>{labels[target]}</span>
              </button>
            ))}
          </>
        )}
      </div>
      <p className="cabinet-state" aria-live="polite" key={key}>
        {alignment.door === 'open'
          ? 'Doors open'
          : alignment.door === 'caught'
            ? 'Right door catches'
            : 'Doors closed'}
      </p>
      <fieldset className="cabinet-tools" aria-label="Choose cabinet work">
        {offered.map((action) => (
          <button
            type="button"
            key={action.id}
            disabled={disabled}
            aria-pressed={selected === action.id}
            onClick={() => setSelected(action.id)}
          >
            {action.label}
          </button>
        ))}
      </fieldset>
      {binding && (
        <p className="cabinet-instruction">
          {binding.detail}{' '}
          <span>Use the {labels[cabinetTarget(binding.id) ?? 'handle'].toLowerCase()}.</span>
        </p>
      )}
      <div className="cabinet-view-controls">
        <button type="button" onClick={() => setFront(!front)}>
          {front ? 'Angled view' : 'Front view'}
        </button>
        <button
          type="button"
          aria-expanded={alternative || failed}
          onClick={() => setAlternative(!alternative)}
        >
          Labeled controls
        </button>
      </div>
      {(alternative || failed) && (
        <fieldset className="cabinet-alternatives" aria-label="Cabinet physical controls">
          {targets.map((target) => (
            <button
              type="button"
              key={target}
              disabled={disabled || !binding || cabinetTarget(binding.id) !== target}
              onClick={() => apply(target)}
            >
              {labels[target]}
            </button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
