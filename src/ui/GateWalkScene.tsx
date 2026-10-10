import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  Quaternion,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { ActionView } from '../game/types';
import { type GateWalkView, gateAction, gatePose, gateTarget } from './gateBindings';
import { createGateModel } from './gateModel';
import { createObjectModel } from './inspection/objectModel';

function GateIllustration({ view }: { view: GateWalkView }) {
  const opened = Boolean(view.handling);
  return (
    <svg viewBox="0 0 600 350" role="img" aria-label="The rail gate, latch and shaded path">
      <rect width="600" height="350" fill="#dbe3d7" />
      <path d="M0 180L600 135V350H0" fill="#b8b49b" />
      <path d="M110 150L440 130L565 350H240Z" fill="#c9c7af" />
      <g fill="#8a9582" stroke="#66765e" strokeWidth="4">
        <path d="M120 255V95H138V255M442 232V80H460V232" />
        <g transform={opened ? 'translate(135 0) skewY(-12) scale(.56 1) translate(-135 0)' : ''}>
          <path d="M138 125H442V141H138ZM138 207H442V221H138Z" />
          {[160, 202, 244, 286, 328, 370, 412].map((x) => (
            <path key={x} d={`M${x} 107V233h10V107Z`} />
          ))}
          <path d="M148 215L422 126" />
          <path d="M419 125h38v8h-38Z" fill="#626660" />
        </g>
      </g>
      {view.samWithPlayer && (
        <g>
          <g fill="#5e726d">
            <path d="M480 100h28v74h-28Z" />
            <path d="M483 172v69h9v-69M500 172v69h9v-69" fill="#434c45" />
            <circle cx="494" cy="84" r="15" fill="#b4a184" />
          </g>
          <g fill="#a38b6d">
            <ellipse cx={opened ? 480 : 378} cy="264" rx="35" ry="17" />
            <ellipse cx={opened ? 444 : 342} cy="248" rx="15" ry="18" />
            <path
              d={
                opened
                  ? 'M455 277v26M488 277v26M513 264l15-22'
                  : 'M353 277v26M386 277v26M411 264l15-22'
              }
              stroke="#a38b6d"
              strokeWidth="7"
            />
          </g>
        </g>
      )}
      {view.torchObject && view.light === 'sam-torch' && (
        <g
          transform={
            view.handling === 'hanging'
              ? 'translate(232 170) rotate(70)'
              : view.handling === 'held'
                ? 'translate(140 180) rotate(-10)'
                : 'translate(470 170) rotate(160)'
          }
        >
          <path d="M60 -10L170 -38V38L60 10Z" fill="#ffedb0" opacity=".4" />
          <rect x="-24" y="-12" width="73" height="24" rx="5" fill="#ac7449" />
          <path d="M48-18h20v36H48Z" fill="#ac7449" />
          <path d="M66-16v32" stroke="#e5bd73" strokeWidth="4" />
          <path d="M-24-5Q-63-24-48 17Q-38 35-24 6" fill="none" stroke="#a3594d" strokeWidth="4" />
        </g>
      )}
    </svg>
  );
}
export function GateWalkScene({
  view,
  actions,
  disabled,
  onAction,
}: {
  view: GateWalkView;
  actions: ActionView[];
  disabled: boolean;
  onAction: (id: string) => void;
}) {
  const state = useRef(view);
  state.current = view;
  const canvas = useRef<HTMLCanvasElement>(null),
    frame = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [failed, setFailed] = useState(false),
    [illustrated, setIllustrated] = useState(false);
  const alternative = useRef(false);
  alternative.current = failed || illustrated;
  const offered = actions.filter((action) => view.actionIds.includes(action.id));
  const exit = offered.find((action) => action.id === 'gate-walk-return');
  const physical = offered.filter(
    (action) => gateTarget(action.id) && gateAction(view, action.id, false),
  );
  useEffect(() => {
    if (failed || illustrated)
      for (const button of buttons.current.values()) {
        button.style.left = '';
        button.style.top = '';
      }
  }, [failed, illustrated]);
  useEffect(() => {
    const surface = canvas.current,
      container = frame.current;
    if (!surface || !container) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: surface, antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    const scene = new Scene();
    scene.background = new Color('#dbe3d7');
    scene.add(new AmbientLight('#ecf3e3', 1.7));
    const sun = new DirectionalLight('#fff3d1', 3);
    sun.position.set(-3, 5, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const camera = new OrthographicCamera(-3.6, 3.6, 2.05, -1.1, 0.1, 25);
    camera.position.set(3, 2.9, 6);
    camera.lookAt(0, 0.65, 0);
    const model = createGateModel();
    scene.add(model.root);
    const holder = new Group();
    scene.add(holder);
    const spot = new SpotLight('#ffe1a0', 8, 5, 0.28, 0.6, 1);
    scene.add(spot, spot.target);
    const beamGeometry = new ConeGeometry(0.42, 2.4, 24, 1, true),
      beamMaterial = new MeshBasicMaterial({
        color: '#ffeda9',
        transparent: true,
        opacity: 0.09,
        side: DoubleSide,
        depthWrite: false,
      });
    const beam = new Mesh(beamGeometry, beamMaterial);
    scene.add(beam);
    let torch: ReturnType<typeof createObjectModel> | undefined,
      torchKey = '',
      lastHandling = state.current.handling,
      swingAt = -Infinity,
      animation = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw(now: number) {
      const value = state.current;
      const key = JSON.stringify(value.torchObject);
      if (key !== torchKey) {
        if (torch) {
          holder.remove(torch.root);
          torch.dispose();
        }
        torch = value.torchObject ? createObjectModel(value.torchObject) : undefined;
        if (torch) {
          torch.root.scale.setScalar(0.55);
          holder.add(torch.root);
          torch.root.traverse((child) => {
            if (child instanceof Mesh) child.castShadow = true;
          });
        }
        torchKey = key;
      }
      if (value.handling !== lastHandling) {
        if (value.handling === 'hanging') swingAt = now;
        lastHandling = value.handling;
      }
      const swing = reduced
        ? 0
        : now - swingAt < 1500
          ? Math.sin((now - swingAt) / 105) * 0.07 * Math.max(0, 1 - (now - swingAt) / 1500)
          : 0;
      model.gate.rotation.y = gatePose(value);
      model.company.visible = model.dog.visible = value.samWithPlayer;
      model.company.position.set(
        value.handling === 'gate-held' || value.handling === 'sam-first' ? 1.5 : 1.85,
        0,
        value.handling === 'gate-held' || value.handling === 'sam-first' ? -1.45 : -0.6,
      );
      model.dog.position.set(
        value.handling === 'gate-held' || value.handling === 'sam-first' ? 1.7 : 0.95,
        0,
        value.handling === 'gate-held' || value.handling === 'sam-first' ? -1.85 : 0.9,
      );
      const hanging = value.handling === 'hanging';
      if (hanging) {
        model.gate.add(holder);
        holder.position.set(0.485, 0.965, 0.11);
        holder.rotation.set(0, 0, -Math.PI / 2 + swing);
        if (torch) torch.root.position.set(0, 0, 0);
      } else {
        scene.add(holder);
        holder.position.set(
          value.handling === 'held' ? -1.2 : 1.55,
          value.handling === 'held' ? 0.95 : 1,
          value.handling === 'held' ? 0.8 : -0.45,
        );
        holder.rotation.set(
          0,
          value.handling === 'held' ? 0.4 : Math.PI,
          value.handling === 'held' ? 0 : 0.35,
        );
        if (torch) torch.root.position.set(0, -0.64 * 0.55, 0);
      }
      holder.visible = Boolean(torch && value.light === 'sam-torch');
      beam.visible = spot.visible = holder.visible;
      if (torch && holder.visible) {
        scene.updateMatrixWorld(true);
        const lens = new Vector3(0.92, 0.64, 0).applyMatrix4(torch.root.matrixWorld);
        const direction = new Vector3(1, 0, 0).applyQuaternion(
          torch.root.getWorldQuaternion(new Quaternion()),
        );
        spot.position.copy(lens);
        spot.target.position.copy(lens).addScaledVector(direction, 3);
        beam.position.copy(lens).addScaledVector(direction, 1.2);
        beam.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), direction);
      }
      const width = Math.max(container?.clientWidth ?? 1, 1),
        height = Math.max(container?.clientHeight ?? 1, 1);
      if (
        surface?.width !== Math.round(width * renderer.getPixelRatio()) ||
        surface?.height !== Math.round(height * renderer.getPixelRatio())
      )
        renderer.setSize(width, height, false);
      const span = width < 500 ? 2.25 : 1.75;
      camera.left = (-span * width) / height;
      camera.right = (span * width) / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      for (const [id, button] of buttons.current) {
        const target = gateTarget(id);
        const point =
          target === 'loop'
            ? model.hook.getWorldPosition(new Vector3())
            : target === 'latch'
              ? model.latch.getWorldPosition(new Vector3())
              : target === 'gate'
                ? new Vector3(-0.65, 0.85, 0.1)
                : new Vector3(1.6, 0.6, -0.5);
        if (alternative.current) {
          button.style.left = target === 'loop' || target === 'gate' ? '25%' : '75%';
          button.style.top = '68%';
          continue;
        }
        point.project(camera);
        button.style.left = `${width < 500 ? width * (target === 'loop' || target === 'gate' ? 0.25 : 0.75) : target === 'loop' || target === 'gate' ? Math.max(95, Math.min(width * 0.4, ((point.x + 1) * width) / 2)) : Math.min(width - 95, Math.max(width * 0.6, ((point.x + 1) * width) / 2))}px`;
        button.style.top = `${Math.max(40, Math.min(height - 90, ((1 - point.y) * height) / 2))}px`;
      }
      animation = requestAnimationFrame(draw);
    }
    function lost(event: Event) {
      event.preventDefault();
      cancelAnimationFrame(animation);
      setFailed(true);
    }
    surface.addEventListener('webglcontextlost', lost);
    animation = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animation);
      surface.removeEventListener('webglcontextlost', lost);
      model.dispose();
      torch?.dispose();
      beamGeometry.dispose();
      beamMaterial.dispose();
      renderer.dispose();
    };
  }, []);
  return (
    <section
      className="gate-walk-scene"
      aria-label="As far as the gate"
      data-handling={view.handling ?? 'waiting'}
      data-company={view.samWithPlayer}
    >
      <div className="gate-walk-toolbar">
        {exit && (
          <button type="button" disabled={disabled} onClick={() => onAction(exit.id)}>
            {exit.label}
          </button>
        )}
        <button
          type="button"
          aria-pressed={illustrated}
          onClick={() => setIllustrated(!illustrated)}
        >
          {illustrated ? 'Use 3D scene' : 'Use labelled diagram'}
        </button>
      </div>
      <div className={`gate-walk-stage ${failed || illustrated ? 'illustrated' : ''}`} ref={frame}>
        <canvas
          ref={canvas}
          hidden={failed || illustrated}
          aria-label="Rail gate, latch and quiet path"
        />
        {(failed || illustrated) && <GateIllustration view={view} />}
        {physical.map((action) => (
          <button
            type="button"
            key={action.id}
            ref={(button) => {
              if (button) buttons.current.set(action.id, button);
              else buttons.current.delete(action.id);
            }}
            className={`gate-context-target gate-target-${gateTarget(action.id)}`}
            disabled={disabled}
            onClick={() => {
              const id = gateAction(view, action.id, disabled);
              if (id) onAction(id);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="gate-replies choice-buttons">
        {offered
          .filter((action) => !gateTarget(action.id) && action.id !== 'gate-walk-return')
          .map((action) => (
            <button
              type="button"
              key={action.id}
              disabled={disabled}
              onClick={() => onAction(action.id)}
            >
              {action.label}
            </button>
          ))}
      </div>
    </section>
  );
}
