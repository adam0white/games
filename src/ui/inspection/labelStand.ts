import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three';
import type { RepairTarget } from '../repairBindings';

/** Temporary structural projection contract; engine20 can supply this without importing renderer code. */
export interface MechanicalPresentation {
  tray: 'fitted' | 'removed';
  load: 'empty' | 'loaded';
  observed: 'unknown' | 'rim-obstruction' | 'missing-drive-part' | 'clear-rim';
  cleared: boolean;
  motion: 'stopped' | 'checked';
}
export interface LabelStandView {
  appearance: string;
  mechanicalPresentation?: MechanicalPresentation;
}

/** Public-only original label stand. The renderer neither diagnoses nor repairs.
 * API parallels createObjectModel(ObjectView, showKnownParts, exposedTargets).
 * No hidden fault is accepted. Exposed comparison geometry needs observations. */
export function createLabelStandModel(
  object: LabelStandView,
  _showKnownParts = false,
  exposedTargets: readonly RepairTarget[] = [],
) {
  const root = new Group(),
    rotor = new Group();
  const geometries: BufferGeometry[] = [],
    materials: MeshStandardMaterial[] = [],
    hitRegions: Mesh[] = [];
  const p = object.mechanicalPresentation;
  const open = p?.tray === 'removed';
  const color = object.appearance === 'display-carousel' ? '#9b866a' : '#728776';
  const metal = new MeshStandardMaterial({ color: '#99968a', metalness: 0.5, roughness: 0.48 });
  const wood = new MeshStandardMaterial({ color, roughness: 0.85 });
  const paper = new MeshStandardMaterial({ color: '#e6d6b4', roughness: 0.96 });
  materials.push(metal, wood, paper);
  function add(
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    name: string,
    position: [number, number, number],
    target?: RepairTarget,
    parent = root,
  ) {
    geometries.push(geometry);
    const ownMaterial = material.clone();
    materials.push(ownMaterial);
    const mesh = new Mesh(geometry, ownMaterial);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    if (target) mesh.userData.repairTarget = target;
    parent.add(mesh);
    return mesh;
  }
  add(new CylinderGeometry(0.66, 0.72, 0.17, 24), wood, 'stand-base', [0, 0.1, 0], 'shell');
  // Spring casing is retained, sealed and never offered as a repair target.
  add(new CylinderGeometry(0.31, 0.31, 0.26, 20), metal, 'sealed-spring-casing', [0, 0.32, 0]);
  add(new CylinderGeometry(0.055, 0.055, 0.37, 12), metal, 'drive-spindle', [0, 0.62, 0]);
  const rim = add(
    new TorusGeometry(0.44, 0.035, 8, 24),
    metal,
    'accessible-drive-rim',
    [0, 0.52, 0],
    'mechanism',
  );
  rim.rotation.x = Math.PI / 2;
  root.add(rotor);
  rotor.name = 'moving-tray-assembly';
  rotor.position.set(open ? 1.08 : 0, open ? 0.22 : 0.73, 0);
  add(
    new CylinderGeometry(0.52, 0.52, 0.055, 24),
    wood,
    'removable-card-tray',
    [0, 0, 0],
    'cover',
    rotor,
  );
  for (let index = 0; index < 4; index++) {
    const angle = (index * Math.PI) / 2;
    const slot = add(
      new BoxGeometry(0.33, 0.05, 0.06),
      metal,
      `retained-card-slot-${index}`,
      [Math.sin(angle) * 0.33, 0.05, Math.cos(angle) * 0.33],
      'cover',
      rotor,
    );
    slot.rotation.y = angle;
    if (p?.load === 'loaded') {
      const card = add(
        new BoxGeometry(0.3, 0.25, 0.018),
        paper,
        `retained-card-${index}`,
        [Math.sin(angle) * 0.33, 0.19, Math.cos(angle) * 0.33],
        'operation',
        rotor,
      );
      card.rotation.y = angle;
    }
  }
  if (p?.load === 'empty') {
    // These are the same four cards removed for comparison, not replacement stock.
    for (let index = 0; index < 4; index++)
      add(
        new BoxGeometry(0.3, 0.018, 0.25),
        paper,
        `retained-unloaded-card-${index}`,
        [0.83, 0.045 + index * 0.022, 0.43],
        'operation',
      );
  }
  // Cause only becomes visible after actual empty/loaded comparison and access.
  if (open && p?.observed === 'rim-obstruction' && !p?.cleared) {
    const scrap = add(
      new BoxGeometry(0.18, 0.07, 0.055),
      paper,
      'observed-folded-card-scrap',
      [0.41, 0.55, 0],
      'mechanism',
    );
    scrap.rotation.z = 0.2;
  }
  if (open && p?.observed === 'missing-drive-part') {
    add(
      new CylinderGeometry(0.025, 0.025, 0.025, 10),
      metal,
      'observed-empty-drive-seat',
      [0.33, 0.53, 0.19],
      'mechanism',
    );
  } else if (open && p?.observed && p?.observed !== 'unknown') {
    add(
      new CylinderGeometry(0.07, 0.07, 0.04, 12),
      metal,
      'retained-drive-wheel',
      [0.33, 0.55, 0.19],
      'mechanism',
    );
  }
  if (p?.cleared)
    add(
      new BoxGeometry(0.18, 0.07, 0.055),
      paper,
      'retained-cleared-scrap',
      [0.88, 0.06, 0.55],
      'mechanism',
    );
  root.traverse((mesh) => {
    if (
      mesh instanceof Mesh &&
      mesh.userData.repairTarget &&
      exposedTargets.includes(mesh.userData.repairTarget)
    )
      hitRegions.push(mesh);
  });
  return {
    root,
    hitRegions,
    animateOperation(fraction: number, reducedMotion = false) {
      if (
        open ||
        p?.load !== 'loaded' ||
        p?.observed === 'missing-drive-part' ||
        p?.motion !== 'checked'
      ) {
        rotor.rotation.y = 0;
        return false;
      }
      const elapsed = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 1));
      rotor.rotation.y = reducedMotion ? 0 : elapsed * Math.PI * 2;
      return !reducedMotion && elapsed < 1;
    },
    highlight(target: RepairTarget | null) {
      for (const mesh of hitRegions) {
        const material = mesh.material as MeshStandardMaterial;
        const selected =
          target === 'shell' || target === 'operation' || mesh.userData.repairTarget === target;
        material.emissive.set(selected ? '#86ad83' : '#000000');
        material.emissiveIntensity = selected ? 0.5 : 0;
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

/** Complete static alternative: describes public state and never infers diagnosis. */
export function describeLabelStand(object: LabelStandView): string {
  const p = object.mechanicalPresentation;
  const lines = [
    'A rotating card stand with a sealed spring casing, exposed drive rim, lift-off tray and four retained cards.',
  ];
  if (!p) return lines.join(' ');
  lines.push(
    p.tray === 'removed'
      ? 'The tray is lifted beside the base.'
      : 'The tray is fitted on its spindle.',
  );
  lines.push(
    p.load === 'loaded'
      ? 'The four cards are fitted in their slots.'
      : 'The same four cards are stacked beside the stand.',
  );
  if (p.tray === 'removed' && p.observed === 'rim-obstruction' && !p.cleared)
    lines.push('Observed folded card scrap bears against the accessible rim.');
  if (p.tray === 'removed' && p.observed === 'missing-drive-part')
    lines.push('The observed drive seat is empty.');
  if (p.cleared) lines.push('The removed scrap is retained beside the stand.');
  if (
    p.tray === 'fitted' &&
    p.load === 'loaded' &&
    p.motion === 'checked' &&
    p.observed !== 'missing-drive-part'
  )
    lines.push('A complete loaded rotation has been attended and checked.');
  return lines.join(' ');
}
