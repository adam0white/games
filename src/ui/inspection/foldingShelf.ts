import { BoxGeometry, type BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { RepairTarget } from '../repairBindings';
export interface ShelfPresentation {
  position: 'folded' | 'open' | 'low';
  brace: 'original' | 'seated';
  load: 'empty' | 'samples';
  observed: 'unknown' | 'support-walks' | 'brace-high' | 'steady';
  checked: boolean;
}
/** Retained folding shelf. Unknown faults share geometry even when rotated underneath. */
export function createFoldingShelfModel(
  p: ShelfPresentation | undefined,
  exposedTargets: readonly RepairTarget[] = [],
) {
  const root = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: MeshStandardMaterial[] = [];
  const hitRegions: Mesh[] = [];
  function box(
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    color: string,
    target: RepairTarget,
  ) {
    const geometry = new BoxGeometry(...size);
    const material = new MeshStandardMaterial({ color, roughness: 0.88 });
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.userData.repairTarget = target;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    geometries.push(geometry);
    materials.push(material);
    if (exposedTargets.includes(target)) hitRegions.push(mesh);
    return mesh;
  }
  const opened = p?.position === 'open';
  const top = opened ? 0.98 : 0.24;
  box('retained-display-top', [1.8, 0.13, 0.78], [0, top, 0], '#aa8960', 'shell');
  box('unpainted-wall-rectangle', [0.85, 0.015, 0.42], [-0.18, top - 0.074, 0], '#cdb991', 'cover');
  for (const side of [-1, 1]) {
    const support = box(
      `hinged-side-${side}`,
      [0.08, 0.83, 0.62],
      [side * 0.74, opened ? 0.52 : 0.14, 0],
      '#8e7655',
      'cover',
    );
    if (!opened) support.rotation.z = (side * Math.PI) / 2;
    else if (p?.observed === 'support-walks' && p.brace !== 'seated' && side === 1)
      support.rotation.z = 0.12;
    box(
      `retained-hinge-${side}`,
      [0.12, 0.055, 0.2],
      [side * 0.74, top - 0.1, 0],
      '#8b897a',
      'cover',
    );
  }
  const misplaced = opened && p?.observed === 'brace-high' && p.brace !== 'seated';
  const brace = box(
    'retained-cross-brace',
    [1.47, 0.065, 0.075],
    [0, opened ? (misplaced ? 0.67 : 0.5) : 0.12, 0.23],
    '#b6a17c',
    'mechanism',
  );
  if (misplaced) brace.rotation.z = 0.09;
  for (const side of [-1, 1])
    box(
      `locating-stop-${side}`,
      [0.11, 0.07, 0.13],
      [side * 0.69, opened ? 0.46 : 0.11, 0.23],
      '#79664d',
      'mechanism',
    );
  if (p?.load === 'samples')
    for (let i = 0; i < 3; i++)
      box(
        `retained-cloth-sample-${i}`,
        [0.5, 0.035, 0.36],
        [0.44, top + 0.085 + i * 0.035, 0.01],
        ['#758b91', '#b0987e', '#c1b396'][i] ?? '#b0987e',
        'operation',
      );
  // The top is also a clear loading target when the retained samples are off the shelf.
  if (exposedTargets.includes('operation')) {
    box('load-contact', [1.78, 0.012, 0.76], [0, top + 0.072, 0], '#aa8960', 'operation');
  }
  return {
    root,
    hitRegions,
    animateOperation(_fraction: number) {
      return false;
    },
    highlight(target: RepairTarget | null) {
      for (const mesh of hitRegions) {
        const material = mesh.material as MeshStandardMaterial;
        const selected =
          target === 'shell' || target === 'operation' || mesh.userData.repairTarget === target;
        material.emissive.set(selected ? '#86ad83' : '#000000');
        material.emissiveIntensity = selected ? 0.35 : 0;
      }
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
