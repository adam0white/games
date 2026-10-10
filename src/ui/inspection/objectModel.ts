/** Original procedural shells for optional inspection. This module receives
 * only the player's ObjectView: rotating a model cannot disclose a latent fault,
 * teach a method, consume time or change a repair. No downloaded assets. */
import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { ObjectView } from '../../game/types';
import type { RepairTarget } from '../repairBindings';

export function createObjectModel(
  object: ObjectView,
  showKnownParts = false,
  exposedTargets: readonly RepairTarget[] = [],
) {
  const root = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: MeshStandardMaterial[] = [];
  const textures: CanvasTexture[] = [];
  const material = (
    color: string,
    metalness = 0,
    roughness = 0.7,
    extra: Partial<{
      transparent: boolean;
      opacity: number;
      side: typeof DoubleSide;
      map: CanvasTexture;
    }> = {},
  ) => {
    const value = new MeshStandardMaterial({ color, metalness, roughness, ...extra });
    materials.push(value);
    return value;
  };
  const add = (
    geometry: BufferGeometry,
    mat: MeshStandardMaterial,
    x = 0,
    y = 0,
    z = 0,
    parent = root,
  ) => {
    geometries.push(geometry);
    const mesh = new Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    mat: MeshStandardMaterial,
    x = 0,
    y = 0,
    z = 0,
    parent = root,
  ) => add(new BoxGeometry(w, h, d), mat, x, y, z, parent);
  const cylinder = (
    radius: number,
    height: number,
    mat: MeshStandardMaterial,
    x = 0,
    y = 0,
    z = 0,
    parent = root,
  ) => add(new CylinderGeometry(radius, radius, height, 32), mat, x, y, z, parent);
  const rod = (
    start: Vector3,
    end: Vector3,
    radius: number,
    mat: MeshStandardMaterial,
    parent = root,
  ) => {
    const direction = end.clone().sub(start);
    const centre = start.clone().add(end).multiplyScalar(0.5);
    const mesh = add(
      new CylinderGeometry(radius, radius, direction.length(), 16),
      mat,
      centre.x,
      centre.y,
      centre.z,
      parent,
    );
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    return mesh;
  };
  const curve = (points: Vector3[], radius: number, mat: MeshStandardMaterial, parent = root) =>
    add(new TubeGeometry(new CatmullRomCurve3(points), 32, radius, 8, false), mat, 0, 0, 0, parent);
  const ring = (
    radius: number,
    tube: number,
    mat: MeshStandardMaterial,
    x = 0,
    y = 0,
    z = 0,
    parent = root,
  ) => add(new TorusGeometry(radius, tube, 10, 40), mat, x, y, z, parent);
  const appearance = object.appearance ?? (object.form === 'lamp' ? 'reading' : object.form);
  const lit = object.visual === 'steady' || object.visual === 'warm';
  const brass = material('#a7976d', 0.55, 0.4);
  const steel = material('#92978c', 0.55, 0.38);
  const darkMetal = material('#4f5c51', 0.4, 0.5);
  const cream = material('#e7d8b6', 0, 0.83);
  const warmGlass = material(lit ? '#ffe5a9' : '#c5b99e', 0.05, 0.2);
  const green = material('#718371', 0.3, 0.56, { side: DoubleSide });
  if (appearance === 'reading') {
    const base = cylinder(0.48, 0.13, green, 0, 0.12);
    base.scale.z = 0.75;
    rod(new Vector3(0, 0.2, 0), new Vector3(-0.13, 1.0, 0), 0.055, green);

    add(new SphereGeometry(0.095, 16, 12), brass, -0.13, 1, 0);
    const shade = add(new CylinderGeometry(0.18, 0.47, 0.42, 32, 1, true), green, 0.4, 1.56, 0);
    shade.rotation.z = -0.7;
    const top = new Vector3(0, 0.21, 0).applyQuaternion(shade.quaternion).add(shade.position);
    rod(new Vector3(-0.13, 1.0, 0), top, 0.055, green);
    const bottom = new Vector3(0, -0.21, 0).applyQuaternion(shade.quaternion).add(shade.position);
    const lip = ring(0.47, 0.022, darkMetal, bottom.x, bottom.y, bottom.z);
    lip.quaternion.copy(shade.quaternion);
    lip.rotateX(Math.PI / 2);
    const cap = add(new CircleGeometry(0.18, 32), green, top.x, top.y, top.z);
    cap.quaternion.copy(shade.quaternion);
    cap.rotateX(Math.PI / 2);
    const bulb = new Vector3(0, -0.12, 0).applyQuaternion(shade.quaternion).add(shade.position);
    add(new SphereGeometry(0.105, 16, 12), warmGlass, bulb.x, bulb.y, bulb.z);
    curve(
      [new Vector3(-0.25, 0.12, 0), new Vector3(-0.62, 0.06, 0.09), new Vector3(-0.88, 0.04, 0.26)],
      0.012,
      darkMetal,
    );
  } else if (appearance === 'bedside') {
    const clay = material('#b98570', 0, 0.85);
    add(
      new LatheGeometry(
        [
          new Vector2(0.34, 0.06),
          new Vector2(0.42, 0.16),
          new Vector2(0.45, 0.44),
          new Vector2(0.3, 0.7),
          new Vector2(0.16, 0.82),
          new Vector2(0.16, 0.94),
        ],
        32,
      ),
      clay,
    );
    for (const height of [0.28, 0.39]) {
      const mark = ring(0.433, 0.018, cream, 0, height);
      mark.rotation.x = Math.PI / 2;
      mark.scale.z = 0.98;
    }
    add(new CylinderGeometry(0.43, 0.65, 0.66, 32, 1, true), cream, 0, 1.37);
    const rim = ring(0.65, 0.021, brass, 0, 1.04);
    rim.rotation.x = Math.PI / 2;
    add(new SphereGeometry(0.12, 16, 12), warmGlass, 0, 1.13);
    rod(new Vector3(0.4, 1.03, 0.12), new Vector3(0.4, 0.78, 0.12), 0.008, brass);
    add(new SphereGeometry(0.03, 12, 8), brass, 0.4, 0.75, 0.12);
  } else if (appearance === 'kitchen') {
    const blue = material('#66848a', 0.35, 0.5);
    cylinder(0.44, 0.14, blue, 0, 0.11);
    cylinder(0.41, 0.13, blue, 0, 1.32);
    for (const [x, z] of [
      [-0.31, -0.2],
      [0.31, -0.2],
      [-0.31, 0.2],
      [0.31, 0.2],
    ])
      rod(new Vector3(x ?? 0, 0.2, z ?? 0), new Vector3(x ?? 0, 1.28, z ?? 0), 0.027, blue);
    const glass = material('#d7c8a5', 0.06, 0.15, {
      transparent: true,
      opacity: 0.22,
      side: DoubleSide,
    });
    cylinder(0.32, 1.05, glass, 0, 0.72);
    add(new SphereGeometry(0.17, 20, 12), warmGlass, 0, 0.65);
    const handle = add(new TorusGeometry(0.38, 0.026, 10, 32, Math.PI), blue, 0, 1.43);
    handle.rotation.z = 0;
    for (const y of [0.4, 1.02]) {
      const wire = ring(0.325, 0.013, blue, 0, y);
      wire.rotation.x = Math.PI / 2;
    }
  } else if (appearance === 'torch') {
    const brown = material('#ac7449', 0.15, 0.68);
    const body = cylinder(0.21, 1.25, brown, 0, 0.64);
    body.rotation.z = Math.PI / 2;
    const head = add(new CylinderGeometry(0.34, 0.25, 0.32, 32), brown, 0.74, 0.64);
    head.rotation.z = -Math.PI / 2;
    const glass = add(new CircleGeometry(0.3, 32), warmGlass, 0.91, 0.64);
    glass.rotation.y = Math.PI / 2;
    const rim = ring(0.32, 0.025, brass, 0.92, 0.64);
    rim.rotation.y = Math.PI / 2;
    for (const x of [-0.36, -0.18, 0, 0.18]) {
      const grip = ring(0.214, 0.012, darkMetal, x, 0.64);
      grip.rotation.y = Math.PI / 2;
    }
    box(0.16, 0.04, 0.12, darkMetal, 0.18, 0.865);
    curve(
      [
        new Vector3(-0.63, 0.62, 0),
        new Vector3(-0.92, 0.38, 0.08),
        new Vector3(-0.72, 0.2, 0.28),
        new Vector3(-0.59, 0.56, 0.1),
      ],
      0.014,
      material('#a3594d'),
    );
  } else if (appearance === 'timer') {
    const enamel = material('#85977a', 0.12, 0.6);
    const shell = add(new SphereGeometry(0.63, 32, 20), enamel, 0, 0.74);
    shell.scale.set(1, 1.1, 0.67);
    const face = cylinder(0.55, 0.05, cream, 0, 0.78, 0.45);
    face.rotation.x = Math.PI / 2;
    const edge = ring(0.55, 0.015, brass, 0, 0.78, 0.48);
    edge.rotation.z = 0;
    for (const angle of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
      const radians = (angle * Math.PI) / 180;
      const tick = box(
        0.018,
        0.07,
        0.008,
        darkMetal,
        Math.sin(radians) * 0.47,
        0.78 + Math.cos(radians) * 0.47,
        0.483,
      );
      tick.rotation.z = -radians;
    }
    const pointer = box(0.04, 0.3, 0.01, material('#a35d45'), -0.08, 0.91, 0.49);
    pointer.rotation.z = 0.48;
    const knob = cylinder(0.105, 0.08, brass, 0, 0.78, 0.51);
    knob.rotation.x = Math.PI / 2;
    for (const x of [-0.31, 0.31]) box(0.2, 0.1, 0.35, darkMetal, x, 0.09);
  } else if (appearance === 'bell') {
    const dome = add(
      new SphereGeometry(0.6, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      brass,
      0,
      0.5,
    );
    dome.scale.y = 0.85;
    cylinder(0.61, 0.07, steel, 0, 0.48);
    const clamp = ring(0.23, 0.05, steel, 0, 0.2);
    clamp.rotation.y = Math.PI / 2;
    rod(new Vector3(0.52, 0.52, 0), new Vector3(0.77, 0.75, 0), 0.037, darkMetal);
    box(0.14, 0.08, 0.12, steel, 0.8, 0.75);
    cylinder(0.05, 0.04, darkMetal, 0, 1.04);
  } else if (object.id === 'nora-sample-case') {
    const tray = object.casePresentation?.mode === 'stationary-tray';
    const fittedCatch = object.casePresentation?.catch ?? 'original';
    const shell = material('#819079', 0, 0.9);
    const lining = material('#dfd3b5', 0, 0.96);
    const edge = material('#5d6b57', 0, 0.86);
    box(2.35, 0.12, 1.14, shell, 0, 0.17);
    box(2.35, 0.29, 0.09, shell, 0, 0.35, 0.54);
    box(2.35, 0.29, 0.09, shell, 0, 0.35, -0.54);
    for (const x of [-1.13, 1.13]) box(0.09, 0.29, 1.1, edge, x, 0.35);
    box(2.15, 0.025, 0.93, lining, 0, 0.24);
    for (const x of [-0.65, -0.18, 0.29, 0.76]) box(0.025, 0.23, 0.98, edge, x, 0.37);
    for (const [index, color] of ['#b8a271', '#ae8580', '#7b9090', '#80916b'].entries()) {
      const x = -0.89 + index * 0.47;
      box(0.36, 0.07, 0.64, material(color, 0, 0.98), x, 0.29, 0.07);
      box(0.23, 0.016, 0.16, lining, x, 0.34, 0.22).rotation.y = -0.06;
      for (const offset of [-0.03, 0.03])
        box(0.15, 0.005, 0.008, darkMetal, x, 0.352, 0.22 + offset);
    }
    const lid = box(2.35, 0.065, 0.94, shell, 0, tray ? 0.11 : 0.98, tray ? -0.83 : -0.58);
    lid.rotation.x = tray ? 0 : -1.1;
    const lidPanel = box(2.13, 0.02, 0.78, lining, 0, tray ? 0.155 : 0.98, tray ? -0.83 : -0.55);
    lidPanel.rotation.x = tray ? 0 : -1.1;
    if (fittedCatch !== 'none') {
      box(0.19, 0.23, 0.04, brass, -0.02, 0.4, 0.6);
      if (fittedCatch === 'original') box(0.09, 0.028, 0.013, darkMetal, -0.02, 0.4, 0.625);
    }
    box(0.27, 0.11, 0.68, lining, 0.94, 0.31);
    function label(text: string, x: number, y: number, z: number, width: number) {
      const surface = document.createElement('canvas');
      surface.width = 512;
      surface.height = 96;
      const context = surface.getContext('2d');
      if (!context) return;
      context.fillStyle = '#d1c5a6';
      context.fillRect(0, 0, surface.width, surface.height);
      context.fillStyle = '#7d7862';
      context.font = '28px Georgia';
      context.textAlign = 'center';
      context.fillText(text, surface.width / 2, 57);
      const texture = new CanvasTexture(surface);
      texture.colorSpace = SRGBColorSpace;
      textures.push(texture);
      return box(width, 0.11, 0.012, material('#ffffff', 0, 0.9, { map: texture }), x, y, z);
    }
    label('SERVICE · COUNTER', -0.6, 0.36, 0.595, 0.75);
    if (object.inspected) {
      box(0.18, 0.04, 0.15, brass, 0.94, 0.4, -0.13);
      const pocketLabel = label('INTERCHANGEABLE', 0.94, 0.41, 0.21, 0.33);
      if (pocketLabel) pocketLabel.rotation.x = -Math.PI / 2;
    }
  } else if (appearance === 'box') {
    const wood = material('#ae8b63', 0, 0.9);
    const lidMat = material('#c5a77e', 0, 0.86);
    box(1.5, 0.76, 1, wood, 0, 0.46);
    box(1.56, 0.1, 1.06, lidMat, 0, 0.9);
    box(0.18, 0.2, 0.04, brass, 0, 0.86, 0.535);
    for (const x of [-0.43, 0.43]) {
      const hinge = cylinder(0.035, 0.2, brass, x, 0.87, -0.52);
      hinge.rotation.z = Math.PI / 2;
    }
    curve(
      [
        new Vector3(-0.18, 0.96, 0),
        new Vector3(-0.15, 1.13, 0),
        new Vector3(0.15, 1.13, 0),
        new Vector3(0.18, 0.96, 0),
      ],
      0.024,
      darkMetal,
    );
    box(1.3, 0.59, 0.015, lidMat, 0, 0.45, 0.511);
  } else if (appearance === 'clip') {
    const paper = box(0.92, 1.45, 0.025, cream, 0, 0.78);
    paper.rotation.z = -0.045;
    const greenClip = material('#697c70', 0.4, 0.47);
    box(0.48, 0.32, 0.22, greenClip, 0, 1.48, 0.05);
    curve(
      [
        new Vector3(-0.16, 1.53, 0.08),
        new Vector3(-0.21, 1.89, 0.08),
        new Vector3(0.21, 1.89, 0.08),
        new Vector3(0.16, 1.53, 0.08),
      ],
      0.022,
      steel,
    );
    const ink = material('#adab94', 0, 0.95);
    for (const y of [0.3, 0.48, 0.66, 0.84, 1.02, 1.2]) box(0.67, 0.009, 0.005, ink, 0, y, 0.032);
    for (const x of [-0.12, 0.15]) box(0.008, 1.06, 0.005, ink, x, 0.72, 0.032);
  } else if (appearance === 'model') {
    const wood = material('#9c8261', 0, 0.9);
    const paper = material('#dac8a9', 0, 0.92);
    const roofMat = material('#a77e6c', 0, 0.89);
    const window = material('#859da0', 0, 0.8);
    box(2.12, 0.11, 1.2, wood, 0, 0.08);
    for (const [x, height] of [
      [-0.52, 0.65],
      [0.42, 0.82],
    ]) {
      const houseHeight = height ?? 0.65;
      const houseX = x ?? 0;
      box(0.64, houseHeight, 0.58, paper, houseX, houseHeight / 2 + 0.14);
      const shape = new Shape();
      shape.moveTo(-0.38, 0);
      shape.lineTo(0, 0.35);
      shape.lineTo(0.38, 0);
      shape.closePath();
      add(
        new ExtrudeGeometry(shape, { depth: 0.68, bevelEnabled: false }),
        roofMat,
        houseX,
        houseHeight + 0.14,
        -0.34,
      );
      for (const offset of [-0.15, 0.15])
        box(0.13, 0.18, 0.015, window, houseX + offset, houseHeight * 0.62 + 0.14, 0.3);
    }
    rod(new Vector3(0.96, 0.14, 0.35), new Vector3(1.27, 0.14, 0.35), 0.018, brass);
    const key = ring(0.09, 0.018, brass, 1.28, 0.14, 0.35);
    key.rotation.y = Math.PI / 2;
  }
  const hitRegions: Mesh[] = [];
  const workTargets = new Set(exposedTargets);
  const attach = (mesh: Mesh, target: RepairTarget) => {
    const source = mesh.material;
    if (source instanceof MeshStandardMaterial) {
      const own = source.clone();
      materials.push(own);
      mesh.material = own;
    }
    mesh.userData.repairTarget = target;
    hitRegions.push(mesh);
    return mesh;
  };
  // A schematic work tray represents only components involved in offered work.
  // It is a diagram of the examined assembly, not a supply of replacement parts.
  if (object.inspected && (showKnownParts || exposedTargets.length > 0)) {
    const tray = material('#b49a73', 0, 0.92);
    box(1.7, 0.045, 0.55, tray, 0, 0.06, 0.96);
    if (workTargets.has('battery')) {
      const cell = attach(
        cylinder(0.1, 0.44, material('#a77d55', 0.45, 0.45), -0.57, 0.19, 0.96),
        'battery',
      );
      cell.rotation.z = Math.PI / 2;
      attach(cylinder(0.045, 0.025, steel, -0.34, 0.19, 0.96), 'battery').rotation.z = Math.PI / 2;
    }
    if (workTargets.has('contact')) {
      attach(box(0.24, 0.045, 0.18, brass, -0.12, 0.13, 0.96), 'contact');
      attach(ring(0.07, 0.018, steel, -0.12, 0.2, 0.96), 'contact').rotation.x = Math.PI / 2;
    }
    if (workTargets.has('holder')) {
      const polymer = material('#5b6258');
      attach(box(0.38, 0.05, 0.22, polymer, 0.35, 0.12, 0.96), 'holder');
      for (const x of [0.17, 0.53]) attach(box(0.035, 0.14, 0.22, polymer, x, 0.2, 0.96), 'holder');
      attach(box(0.03, 0.12, 0.14, brass, 0.19, 0.2, 0.96), 'holder');
    }
    if (workTargets.has('cap')) {
      const cap = attach(
        cylinder(0.22, 0.16, material('#ac7449', 0.15, 0.68), 0.63, 0.18, 0.96),
        'cap',
      );
      for (const y of [0.13, 0.18, 0.23])
        attach(ring(0.224, 0.012, steel, cap.position.x, y, 0.96), 'cap').rotation.x = Math.PI / 2;
    }
  }
  // The complete mechanism is the honest target when internal geometry is not authored.
  if (workTargets.has('mechanism'))
    root.traverse((child) => {
      if (child instanceof Mesh && !child.userData.repairTarget) attach(child, 'mechanism');
    });
  root.traverse((child) => {
    if (child instanceof Mesh && !child.userData.repairTarget) attach(child, 'shell');
  });
  return {
    root,
    hitRegions,
    highlight(target: RepairTarget | null) {
      for (const mesh of hitRegions) {
        const mat = mesh.material;
        if (mat instanceof MeshStandardMaterial) {
          const whole = target === 'shell' || target === 'operation' || target === 'mechanism';
          mat.emissive.set(whole || mesh.userData.repairTarget === target ? '#274a35' : '#000000');
          mat.emissiveIntensity = 0.65;
        }
      }
    },
    dispose() {
      for (const texture of textures) texture.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const mat of materials) mat.dispose();
    },
  };
}
