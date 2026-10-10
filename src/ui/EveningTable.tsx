import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PointLight,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type { ActionView, ObjectView } from '../game/types';
import { createObjectModel } from './inspection/objectModel';
import { ObjectIllustration } from './ObjectIllustration';

export interface EveningSceneView {
  stage: 'invitation' | 'table' | 'finished';
  title: string;
  detail: string;
  model?: {
    id: string;
    title: string;
    frontage: 'remembered' | 'current';
    circuitAt?: number;
    moving: boolean;
  };
  circuitReceiptId?: string;
  modelObject?: ObjectView;
  lampObject?: ObjectView;
  light: 'room' | 'bedside';
  lampPosition: 'side' | 'near' | 'far';
  modelPosition: 'front' | 'back';
  modelAngle: 'facing' | 'angled';
  packagingRevealed: boolean;
  mumPresent: boolean;
  actionIds: string[];
}
export function eveningTarget(id: string): 'model' | 'light' | null {
  if (/^evening-(model-|turn-|original$|current$|run-circuit$|check-circuit$|look-under$)/.test(id))
    return 'model';
  if (/^evening-light-/.test(id)) return 'light';
  return null;
}
export type EveningActionGroup =
  | 'model'
  | 'light'
  | 'fronts'
  | 'look'
  | 'company'
  | 'keep'
  | 'exit'
  | 'other';
export function eveningActionGroup(id: string): EveningActionGroup {
  if (/^evening-(model-|turn-)/.test(id)) return 'model';
  if (/^evening-light-/.test(id) || id === 'evening-bring-lamp') return 'light';
  if (id === 'evening-original' || id === 'evening-current') return 'fronts';
  if (/^evening-(look-under|run-circuit|check-circuit)$/.test(id)) return 'look';
  if (id === 'evening-show-mum' || id === 'evening-ask-print') return 'company';
  if (id === 'evening-keep-wall' || id === 'evening-keep-table') return 'keep';
  if (id === 'evening-put-away') return 'exit';
  return 'other';
}
export function EveningTable({
  view,
  actions,
  disabled,
  onAction,
}: {
  view: EveningSceneView;
  actions: ActionView[];
  disabled: boolean;
  onAction: (id: string) => void;
}) {
  const state = useRef(view);
  state.current = view;
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const offered = actions.filter((action) => view.actionIds.includes(action.id));
  const exit = offered.find((action) => action.id === 'evening-put-away');
  function renderChoices(group: EveningActionGroup) {
    return offered
      .filter((action) => eveningActionGroup(action.id) === group)
      .map((action) => (
        <button
          type="button"
          key={action.id}
          disabled={disabled}
          onClick={() => onAction(action.id)}
        >
          {action.label}
        </button>
      ));
  }
  const has = (group: EveningActionGroup) =>
    offered.some((action) => eveningActionGroup(action.id) === group);
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
    const wallMaterial = new MeshStandardMaterial({ color: '#e9ddc6', roughness: 1 });
    const wallGeometry = new BoxGeometry(20, 9, 0.12);
    const wall = new Mesh(wallGeometry, wallMaterial);
    wall.position.set(0, 2, -2.8);
    wall.receiveShadow = true;
    scene.add(wall);
    const tableGeometry = new BoxGeometry(9, 0.15, 10);
    const tableMaterial = new MeshStandardMaterial({ color: '#8e6345', roughness: 0.85 });
    const table = new Mesh(tableGeometry, tableMaterial);
    table.position.y = -0.2;
    table.receiveShadow = true;
    scene.add(table);
    scene.add(new AmbientLight('#e7edff', 0.4));
    const light = new PointLight('#ffdc98', 55, 18, 1.6);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.001;
    scene.add(light);
    const camera = new OrthographicCamera(-4.3, 4.3, 2.25, -2.25, 0.1, 30);
    camera.position.set(2, 2.7, 9);
    camera.lookAt(0, 0.8, -0.5);
    let model: ReturnType<typeof createObjectModel> | undefined,
      lamp: ReturnType<typeof createObjectModel> | undefined,
      modelKey = '',
      lampKey = '',
      animation = 0,
      receipt: string | undefined,
      started = -Infinity;
    const shutterAngles = new Map<Mesh, number>();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw(now: number) {
      const value = state.current;
      const nextModelKey = JSON.stringify([value.modelObject, value.model?.frontage]);
      if (nextModelKey !== modelKey) {
        if (model) {
          scene.remove(model.root);
          model.dispose();
        }
        model = value.modelObject ? createObjectModel(value.modelObject) : undefined;
        shutterAngles.clear();
        model?.root.traverse((child) => {
          if (child instanceof Mesh) {
            child.castShadow = true;
            if (
              !value.modelObject?.personalPresentation &&
              value.model?.frontage === 'current' &&
              child.name === 'remembered-original-front'
            )
              child.scale.x = 1.35;
            if (/paper-shutter|delivery-gate/.test(child.name))
              shutterAngles.set(child, child.rotation.y);
          }
        });
        if (model) scene.add(model.root);
        modelKey = nextModelKey;
      }
      const nextLampKey = JSON.stringify(value.lampObject);
      if (nextLampKey !== lampKey) {
        if (lamp) {
          scene.remove(lamp.root);
          lamp.dispose();
        }
        lamp = value.lampObject ? createObjectModel(value.lampObject) : undefined;
        if (lamp) scene.add(lamp.root);
        lampKey = nextLampKey;
      }
      const bedside = value.light === 'bedside';
      const x = bedside && value.lampPosition === 'side' ? -2.5 : -0.9;
      const z = bedside
        ? value.lampPosition === 'near'
          ? 1.35
          : value.lampPosition === 'far'
            ? 4
            : 2.4
        : 3.3;
      light.position.set(x, bedside ? 0.72 : 0.55, z);
      if (lamp) {
        lamp.root.visible = bedside;
        lamp.root.position.set(x, 0, z);
        lamp.root.scale.setScalar(0.6);
      }
      if (model) {
        model.root.position.set(0.25, 0, value.modelPosition === 'front' ? 0.6 : -0.6);
        model.root.rotation.y = value.modelAngle === 'angled' ? -0.55 : 0;
        model.root.scale.setScalar(0.95);
      }
      if (value.circuitReceiptId !== receipt) {
        if (value.circuitReceiptId && value.model?.moving) started = now;
        receipt = value.circuitReceiptId;
      }
      const fraction = reduced ? 0 : Math.max(0, Math.min(1, (now - started) / 2400));
      let index = 0;
      for (const [shutter, angle] of shutterAngles) {
        shutter.rotation.y =
          angle +
          Math.sin(Math.max(0, Math.min(1, fraction * 1.5 - index++ * 0.12)) * Math.PI) * 0.85;
      }
      const width = Math.max(container?.clientWidth ?? 1, 1),
        height = Math.max(container?.clientHeight ?? 1, 1);
      if (
        surface?.width !== Math.round(width * renderer.getPixelRatio()) ||
        surface?.height !== Math.round(height * renderer.getPixelRatio())
      )
        renderer.setSize(width, height, false);
      camera.left = (-2.25 * width) / height;
      camera.right = (2.25 * width) / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      animation = requestAnimationFrame(draw);
    }
    const lost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(animation);
      setFailed(true);
    };
    surface.addEventListener('webglcontextlost', lost);
    animation = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animation);
      surface.removeEventListener('webglcontextlost', lost);
      model?.dispose();
      lamp?.dispose();
      wallGeometry.dispose();
      wallMaterial.dispose();
      tableGeometry.dispose();
      tableMaterial.dispose();
      renderer.dispose();
    };
  }, []);
  const updated = view.modelObject?.personalPresentation?.fitted === 'updated';
  const childhoodWide =
    !view.modelObject?.personalPresentation && view.model?.frontage === 'current';
  const scale =
    view.light === 'bedside' && view.lampPosition === 'near'
      ? 1.8
      : view.modelPosition === 'front'
        ? 1.3
        : 0.9;
  const shadowX =
    view.light === 'bedside' && view.lampPosition === 'side'
      ? 420
      : view.modelAngle === 'angled'
        ? 365
        : 310;
  return (
    <section className="evening-table" aria-label="The street on the wall">
      {exit && (
        <div className="evening-exit">
          <button type="button" disabled={disabled} onClick={() => onAction(exit.id)}>
            {exit.label}
          </button>
        </div>
      )}
      <div className="evening-stage" ref={frame}>
        {failed ? (
          <svg
            viewBox="0 0 600 350"
            role="img"
            aria-label="Paper street and its shadow on the wall"
          >
            <rect width="600" height="350" fill="#e9ddc6" />
            <g
              transform={`translate(${shadowX} 220) scale(${scale * (childhoodWide ? 1.18 : 1) * (view.modelAngle === 'angled' ? 0.78 : 1)} 1.2)`}
            >
              <path
                d={
                  updated
                    ? 'M-75 0V-65H-25V-85H25V-50H75V0Z'
                    : 'M-75 0V-55L-40-85L-5-55V0M5 0V-70L40-105L75-70V0'
                }
                fill="#716657"
              />
              <g
                key={view.circuitReceiptId}
                className={
                  view.model?.moving && view.circuitReceiptId
                    ? 'evening-shadow-shutters running'
                    : 'evening-shadow-shutters'
                }
                fill="#716657"
              >
                <rect x="-83" y="-42" width="9" height="30" />
                <rect x="74" y="-45" width="9" height="32" />
              </g>
            </g>
            <path d="M0 280L600 250V350H0" fill="#8e6345" />
          </svg>
        ) : (
          <canvas
            ref={canvas}
            aria-label="Actual paper street on the family table, throwing a shadow on the wall"
          />
        )}
        <p className="evening-source">
          {view.light === 'bedside' ? 'Your checked bedside lamp' : 'The fixed family-room light'}
        </p>
      </div>
      {failed && view.modelObject && (
        <div className={`evening-model-fallback ${childhoodWide ? 'childhood-wide' : ''}`}>
          <ObjectIllustration object={view.modelObject} />
        </div>
      )}
      <div className="evening-arranging">
        {has('model') && (
          <fieldset>
            <legend>Paper street</legend>
            <div className="choice-buttons">{renderChoices('model')}</div>
          </fieldset>
        )}
        {has('light') && (
          <fieldset>
            <legend>Lighting</legend>
            <div className="choice-buttons">{renderChoices('light')}</div>
          </fieldset>
        )}
      </div>
      {has('fronts') && (
        <fieldset className="evening-option-group">
          <legend>Existing fronts</legend>
          <div className="choice-buttons">{renderChoices('fronts')}</div>
        </fieldset>
      )}
      {has('look') && (
        <details className="evening-looking">
          <summary>
            Look closer{' '}
            <small>
              {[
                offered.some((a) => a.id === 'evening-look-under') ? 'Underside' : null,
                offered.some((a) => /evening-(run|check)-circuit/.test(a.id)) ? 'Circuit' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
          </summary>
          <div className="choice-buttons">{renderChoices('look')}</div>
        </details>
      )}
      {has('company') && (
        <fieldset className="evening-option-group">
          <legend>With Mum</legend>
          <div className="choice-buttons">{renderChoices('company')}</div>
        </fieldset>
      )}
      {has('keep') && (
        <fieldset className="evening-option-group">
          <legend>For the evening</legend>
          <div className="choice-buttons">{renderChoices('keep')}</div>
        </fieldset>
      )}
      {has('other') && <div className="choice-buttons">{renderChoices('other')}</div>}
    </section>
  );
}
