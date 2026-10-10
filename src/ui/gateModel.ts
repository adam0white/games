/** Original rail gate and quiet path; no hidden damage or person state enters geometry. */
import {
  BoxGeometry,
  type CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
export function createGateModel() {
  const root = new Group(),
    gate = new Group(),
    company = new Group(),
    dog = new Group();
  const geometries: (BoxGeometry | CylinderGeometry | SphereGeometry | TorusGeometry)[] = [];
  const materials: MeshStandardMaterial[] = [];
  const mat = (color: string, metalness = 0) => {
    const m = new MeshStandardMaterial({ color, metalness, roughness: 0.84 });
    materials.push(m);
    return m;
  };
  const wood = mat('#8a9582'),
    grain = mat('#647561'),
    iron = mat('#626660', 0.35),
    ground = mat('#b8b49b'),
    coat = mat('#5e726d'),
    skin = mat('#b4a184'),
    fur = mat('#a38b6d'),
    nose = mat('#434c45');
  const box = (
    parent: Group,
    w: number,
    h: number,
    d: number,
    m: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
  ) => {
    const g = new BoxGeometry(w, h, d);
    geometries.push(g);
    const mesh = new Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const ball = (
    parent: Group,
    r: number,
    m: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ) => {
    const g = new SphereGeometry(r, 12, 10);
    geometries.push(g);
    const mesh = new Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box(root, 8, 0.08, 7, ground, 0, -0.09, 0);
  for (const x of [-1.2, 1.2]) {
    box(root, 0.22, 1.72, 0.23, wood, x, 0.8, 0);
    box(root, 0.25, 0.07, 0.26, grain, x, 1.67, 0);
  }
  gate.position.set(-1.08, 0, 0);
  root.add(gate);
  for (const y of [0.38, 1.18]) box(gate, 2.12, 0.14, 0.1, wood, 1.05, y, 0.03);
  for (const x of [0.17, 0.47, 0.77, 1.07, 1.37, 1.67, 1.97])
    box(gate, 0.09, 1.16, 0.075, wood, x, 0.76, 0.015);
  const brace = box(gate, 2.14, 0.09, 0.07, grain, 1.05, 0.78, -0.045);
  brace.rotation.z = 0.35;
  const latch = box(gate, 0.36, 0.09, 0.16, iron, 1.95, 1.2, 0.1);
  latch.name = 'gate-latch';
  for (const y of [0.38, 1.18]) box(root, 0.2, 0.1, 0.18, iron, -1.17, y, 0.04);
  const hookGeometry = new TorusGeometry(0.05, 0.012, 8, 16, Math.PI * 1.5);
  geometries.push(hookGeometry);
  const hook = new Mesh(hookGeometry, iron);
  hook.position.set(-0.42, 1.34, 0.16);
  hook.rotation.z = 0.4;
  gate.add(hook); // local rail fixture below top edge
  hook.position.x = 0.66;
  root.add(company);
  company.position.set(1.85, 0, -0.6);
  box(company, 0.38, 0.63, 0.22, coat, 0, 1.02, 0);
  ball(company, 0.17, skin, 0, 1.55, 0, 1, 1.1, 0.95);
  for (const x of [-0.12, 0.12]) {
    box(company, 0.12, 0.68, 0.14, nose, x, 0.36, 0);
    box(company, 0.17, 0.09, 0.28, nose, x, 0.045, 0.07);
  }
  const arm = box(company, 0.11, 0.49, 0.12, coat, -0.25, 1, 0.025);
  arm.rotation.z = -0.18;
  root.add(dog);
  dog.position.set(0.95, 0, 0.9);
  ball(dog, 0.24, fur, 0, 0.38, 0, 1.6, 0.8, 0.8);
  ball(dog, 0.16, fur, -0.36, 0.52, 0, 1.1, 1.2, 1);
  ball(dog, 0.1, fur, -0.52, 0.49, 0.015, 1.5, 0.65, 0.85);
  ball(dog, 0.04, nose, -0.63, 0.5, 0.015);
  for (const z of [-0.12, 0.12]) {
    const ear = box(dog, 0.1, 0.2, 0.045, nose, -0.33, 0.59, z);
    ear.rotation.z = -0.35;
    for (const x of [-0.22, 0.22]) box(dog, 0.065, 0.28, 0.07, fur, x, 0.14, z);
  }
  const tail = box(dog, 0.06, 0.36, 0.055, fur, 0.4, 0.5, 0);
  tail.rotation.z = -0.9;
  return {
    root,
    gate,
    company,
    dog,
    latch,
    hook,
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
