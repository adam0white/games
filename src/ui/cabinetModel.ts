import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { CabinetTarget } from './cabinetBindings';

export { type CabinetTarget, cabinetTarget, resolveCabinetAction } from './cabinetBindings';

export interface CabinetAlignment {
  position: 'original' | 'worse' | 'aligned';
  door: 'open' | 'closed' | 'caught';
  observedContact: boolean;
  observation?: 'paper' | 'supported';
  checked: boolean;
  sessionActive: boolean;
  detail: string;
  actionIds: string[];
}
/** Finite public clearance positions, never a hidden fault or simulation result. */
export function cabinetPose(state: Pick<CabinetAlignment, 'position' | 'door'>) {
  return {
    tilt: state.position === 'worse' ? 0.045 : state.position === 'original' ? 0.02 : 0,
    swing:
      state.door === 'open'
        ? 0.92
        : state.door === 'caught'
          ? state.position === 'worse'
            ? 0.27
            : 0.14
          : 0,
  };
}
export function createCabinetModel() {
  const root = new Group();
  const materials: MeshStandardMaterial[] = [];
  const geometries: BoxGeometry[] = [];
  function box(
    parent: Group,
    name: string,
    size: [number, number, number],
    at: [number, number, number],
    color: string,
    target?: CabinetTarget,
  ) {
    const geometry = new BoxGeometry(...size);
    geometries.push(geometry);
    const material = new MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: target === 'upper' || target === 'lower' ? 0.55 : 0,
    });
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...at);
    if (target) mesh.userData.target = target;
    parent.add(mesh);
    return mesh;
  }
  box(root, 'back', [2.5, 2.25, 0.08], [0, 0, -0.33], '#6f563b');
  for (const x of [-1.26, 1.26]) box(root, 'side', [0.13, 2.5, 0.65], [x, 0, -0.05], '#a47e52');
  for (const y of [-1.22, 1.22]) box(root, 'rail', [2.6, 0.14, 0.65], [0, y, -0.05], '#bc9766');
  box(root, 'shelf', [2.4, 0.06, 0.54], [0, -0.2, -0.03], '#ad8657');
  const left = new Group();
  left.position.set(-1.18, 0, 0.32);
  root.add(left);
  const right = new Group();
  right.name = 'moving-door';
  right.position.set(1.18, 0, 0.32);
  root.add(right);
  for (const [door, direction] of [
    [left, 1],
    [right, -1],
  ] as const) {
    box(door, 'door', [1.14, 2.28, 0.085], [direction * 0.57, 0, 0], '#b99260');
    box(door, 'raised-panel', [0.87, 1.93, 0.025], [direction * 0.57, 0, 0.058], '#c5a376');
    box(door, 'panel-inset', [0.72, 1.76, 0.016], [direction * 0.57, 0, 0.078], '#b18b5d');
    box(door, 'handle', [0.055, 0.26, 0.12], [direction * 1.02, -0.03, 0.13], '#7c694b', 'handle');
    for (const [y, target] of [
      [0.83, 'upper'],
      [-0.83, 'lower'],
    ] as const) {
      box(
        door,
        `${target}-hinge`,
        [0.13, 0.17, 0.08],
        [direction * 0.015, y, 0.07],
        '#978769',
        door === right ? target : undefined,
      );
      box(door, `${target}-screw`, [0.035, 0.012, 0.025], [direction * 0.035, y, 0.118], '#514b40');
    }
  }
  box(right, 'meeting-edge', [0.025, 1.96, 0.025], [-1.13, 0, 0.11], '#8b6e4b', 'gap');
  const paper = box(
    root,
    'retained-paper-strip',
    [0.065, 0.52, 0.007],
    [0.09, 0.83, 0.48],
    '#ede2c8',
    'gap',
  );
  paper.visible = false;
  const drawing = new Group();
  drawing.name = 'displayed-saved-drawing';
  drawing.position.set(1.64, -0.86, 0.42);
  drawing.rotation.z = -0.09;
  drawing.visible = false;
  root.add(drawing);
  box(drawing, 'drawing-sheet', [0.63, 0.47, 0.008], [0, 0, 0], '#e4d9be');
  const ink = '#777765';
  for (const x of [-0.15, 0.13]) {
    box(drawing, 'pencilled-shop-base', [0.2, 0.009, 0.004], [x, -0.13, 0.008], ink);
    for (const dx of [-0.1, 0.1])
      box(drawing, 'pencilled-shop-wall', [0.008, 0.17, 0.004], [x + dx, -0.045, 0.008], ink);
    for (const dx of [-0.058, 0.058]) {
      const roof = box(drawing, 'pencilled-roof', [0.14, 0.008, 0.004], [x + dx, 0.07, 0.008], ink);
      roof.rotation.z = dx < 0 ? 0.55 : -0.55;
    }
    box(drawing, 'pencilled-window', [0.065, 0.055, 0.004], [x - 0.03, -0.025, 0.008], '#9a9b87');
    box(drawing, 'pencilled-door', [0.036, 0.095, 0.004], [x + 0.056, -0.08, 0.008], ink);
  }
  const targets = new Map<CabinetTarget, Group | Mesh>([
    ['handle', right.getObjectByName('handle') as Mesh],
    ['upper', right.getObjectByName('upper-hinge') as Mesh],
    ['lower', right.getObjectByName('lower-hinge') as Mesh],
    ['gap', right.getObjectByName('meeting-edge') as Mesh],
  ]);
  return {
    root,
    right,
    left,
    paper,
    drawing,
    targets,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
