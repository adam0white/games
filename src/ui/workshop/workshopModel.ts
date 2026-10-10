import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
} from 'three';
import { createObjectModel } from '../inspection/objectModel';
import type { WorkshopGeometry } from './workshopView';

/** Fit the complete assembly, including retained open pieces, within its own shelf bay. */
export function fitWorkshopObject(root: Object3D, centre: Vector3, size: Vector3) {
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  const extent = bounds.getSize(new Vector3());
  const scale = Math.min(
    size.x / Math.max(extent.x, 0.001),
    size.y / Math.max(extent.y, 0.001),
    size.z / Math.max(extent.z, 0.001),
  );
  const originalCentre = bounds.getCenter(new Vector3());
  root.scale.multiplyScalar(scale);
  root.position.set(
    centre.x - originalCentre.x * scale,
    centre.y - bounds.min.y * scale,
    centre.z - originalCentre.z * scale,
  );
  root.updateMatrixWorld(true);
}

export function shelfBay(index: number, count: number) {
  const rows = Math.max(2, Math.ceil(count / 3));
  const step = 1.85 / rows;
  return {
    centre: new Vector3(1.5 + (index % 3) * 0.58, 0.35 + Math.floor(index / 3) * step, -1.24),
    size: new Vector3(0.47, step * 0.73, 0.55),
  };
}

/** Original room geometry from known public objects only. */
export function createWorkshopModel(view: WorkshopGeometry) {
  const root = new Group();
  const resources: { dispose(): void }[] = [];
  const targets: Object3D[] = [];
  const palette = {
    wood: '#946746',
    edge: '#674632',
    plaster: '#ddd0b8',
    floor: '#b69370',
    green: '#697b6a',
    paper: '#f4e5c9',
  };
  function box(
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    target?: string,
  ) {
    const geometry = new BoxGeometry(w, h, d);
    const material = new MeshStandardMaterial({ color, roughness: 0.88 });
    resources.push(geometry, material);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    root.add(mesh);
    if (target) {
      mesh.userData.placeId = target;
      targets.push(mesh);
    }
    return mesh;
  }
  function label(
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    target?: string,
    height = 0.17,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#403428';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const title = text.length > 30 ? `${text.slice(0, 27)}…` : text;
    ctx.fillText(title, 256, 48, 480);
    const texture = new CanvasTexture(canvas);
    resources.push(texture);
    const mesh = box(width, height, 0.035, palette.paper, x, y, z, target);
    mesh.material.map = texture;
  }
  box(7, 0.16, 4.6, palette.floor, 0, -0.08, 0);
  box(7, 2.95, 0.12, palette.plaster, 0, 1.45, -2.25);
  box(0.12, 2.95, 4.6, '#c5b99f', -3.5, 1.45, 0);
  for (let i = 0; i < 9; i++) box(0.018, 0.012, 4.5, '#9f7f60', -3.25 + i * 0.8, 0.007, 0);
  // Warm daylight and a simple frame, rather than a costly shadow simulation.
  box(1.7, 1.28, 0.07, '#b59b74', -2.2, 2.02, -2.13);
  box(1.48, 1.08, 0.08, '#f3dca5', -2.2, 2.02, -2.07);
  box(0.06, 1.12, 0.1, '#b59b74', -2.2, 2.02, -2.0);
  box(1.52, 0.06, 0.1, '#b59b74', -2.2, 2.02, -2.0);
  box(3.6, 0.18, 1.45, palette.wood, -1.02, 1.02, -0.4, 'bench');
  for (const x of [-2.52, 0.47])
    for (const z of [-0.94, 0.12]) box(0.14, 0.95, 0.14, palette.edge, x, 0.48, z, 'bench');
  box(1.75, 0.025, 0.85, palette.green, -1.25, 1.13, -0.35, 'bench');
  label('WORK BENCH', -1.05, 0.93, 0.35, 1.65, 'bench');
  if (view.focus) {
    const object = createObjectModel(view.focus, false);
    fitWorkshopObject(object.root, new Vector3(-1.25, 1.15, -0.35), new Vector3(1.6, 1.1, 0.78));
    object.root.traverse((node) => {
      if (node instanceof Mesh) {
        node.userData.placeId = 'bench';
        targets.push(node);
      }
    });
    root.add(object.root);
    resources.push({ dispose: object.dispose });
  }
  if (view.mechanicalCorner) {
    box(1.15, 0.15, 0.65, palette.wood, 0.25, 1.02, -1.62, 'sam-corner');
    box(1.04, 0.025, 0.55, '#7b8793', 0.25, 1.11, -1.62, 'sam-corner');
    for (const x of [-0.25, 0.75]) box(0.1, 1, 0.1, palette.edge, x, 0.5, -1.75, 'sam-corner');
    label('SAM’S CORNER', 0.25, 1.05, -1.27, 1, 'sam-corner');
    if (view.apprenticeObject) {
      const model = createObjectModel(view.apprenticeObject, false);
      fitWorkshopObject(model.root, new Vector3(0.25, 1.14, -1.62), new Vector3(0.98, 0.75, 0.51));
      model.root.traverse((node) => {
        if (node instanceof Mesh) {
          node.userData.placeId = 'sam-corner';
          targets.push(node);
        }
      });
      root.add(model.root);
      resources.push({ dispose: model.dispose });
    }
  }
  const unfinished = view.shelf.filter((item) => !item.awaitingCollection);
  const checked = view.shelf.filter((item) => item.awaitingCollection);
  if (view.showShelf) {
    const rows = Math.max(2, Math.ceil(unfinished.length / 3));
    const step = 1.85 / rows;
    for (let row = 0; row < rows; row++)
      box(1.9, 0.07, 0.84, palette.wood, 2.1, 0.3 + row * step, -1.24, 'shelf');
    for (const x of [1.18, 3.02]) box(0.11, 2.1, 0.8, palette.edge, x, 1.08, -1.24, 'shelf');
    label('WAITING SHELF', 2.1, 2.18, -0.79, 1.65, 'shelf');
    unfinished.forEach((item, index) => {
      const bay = shelfBay(index, unfinished.length);
      if (item.object) {
        const model = createObjectModel(item.object, false);
        fitWorkshopObject(model.root, bay.centre, bay.size);
        model.root.traverse((node) => {
          if (node instanceof Mesh) {
            node.userData.placeId = `object:${item.id}`;
            targets.push(node);
          }
        });
        root.add(model.root);
        resources.push({ dispose: model.dispose });
      } else {
        // Historical views may have no form projection: retain an honest generic parcel.
        box(
          0.42,
          Math.min(0.32, bay.size.y),
          0.39,
          '#9e8f78',
          bay.centre.x,
          bay.centre.y + Math.min(0.32, bay.size.y) / 2,
          -1.24,
          `object:${item.id}`,
        );
      }
      label(
        String(index + 1),
        bay.centre.x,
        bay.centre.y - 0.025,
        -0.79,
        0.3,
        `object:${item.id}`,
        Math.min(0.12, bay.size.y * 0.3),
      );
    });
  }

  // A lower collection rack is physically separate from unfinished shelf bays.
  if (checked.length) {
    box(1.85, 0.1, 0.8, '#728c84', 2.1, 0.73, 0.16, 'collection');
    for (const x of [1.28, 2.92]) box(0.09, 0.7, 0.09, palette.edge, x, 0.35, 0.16, 'collection');
    label('CHECKED · HANDOVER', 2.1, 0.65, 0.59, 1.65, 'collection');
    checked.forEach((item, index) => {
      if (!item.object) return;
      const model = createObjectModel(item.object, false);
      const columns = Math.max(3, checked.length);
      fitWorkshopObject(
        model.root,
        new Vector3(1.3 + (index * 1.6) / columns, 0.79, 0.16),
        new Vector3(1.5 / columns, 0.64, 0.6),
      );
      model.root.traverse((node) => {
        if (node instanceof Mesh) {
          node.userData.placeId = `object:${item.id}`;
          targets.push(node);
        }
      });
      root.add(model.root);
      resources.push({ dispose: model.dispose });
    });
  }
  if (view.intakeSpace) {
    // Agreed space adds a real writing surface, a pinned workboard and an open book.
    box(1.35, 0.12, 0.75, palette.wood, -2.6, 0.79, 1.29, 'intake');
    for (const x of [-3.14, -2.06]) box(0.09, 0.74, 0.09, palette.edge, x, 0.37, 1.29, 'intake');
    box(0.63, 0.045, 0.43, '#425d70', -2.6, 0.89, 1.25, 'intake');
    for (const x of [-2.75, -2.45]) box(0.27, 0.014, 0.36, palette.paper, x, 0.922, 1.25, 'intake');
    for (let i = 0; i < 4; i++)
      box(0.22, 0.005, 0.008, '#baae91', -2.45, 0.932, 1.12 + i * 0.075, 'intake');
    label('INTAKE WORKBOOK', -2.6, 0.74, 1.7, 1.18, 'intake');
    box(0.08, 0.95, 1.05, '#726956', -3.4, 1.7, 0.65, 'people');
    const board = box(0.095, 0.8, 0.91, '#d6c3a1', -3.34, 1.7, 0.65, 'people');
    board.userData.station = 'received-arrangements';
    for (const z of [0.37, 0.72]) box(0.015, 0.29, 0.25, palette.paper, -3.28, 1.74, z, 'people');
  }
  if (view.checkingPlaces > 0) {
    box(1.64, 0.12, 0.74, palette.wood, 0.64, 0.76, 1.25, 'checking');
    for (const x of [-0.07, 1.35]) box(0.09, 0.7, 0.09, palette.edge, x, 0.35, 1.25, 'checking');
    for (let i = 0; i < Math.min(2, view.checkingPlaces); i++) {
      const x = view.checkingPlaces === 1 ? 0.64 : 0.24 + i * 0.8;
      box(0.63, 0.028, 0.54, '#8d9b97', x, 0.84, 1.25, 'checking').userData.station =
        'checking-tray';
      for (const z of [1, 1.5]) box(0.66, 0.07, 0.035, '#526b69', x, 0.875, z, 'checking');
      for (const side of [-1, 1])
        box(0.035, 0.07, 0.54, '#526b69', x + side * 0.315, 0.875, 1.25, 'checking');
    }
    label('ATTENDED CHECKING', 0.64, 0.69, 1.67, 1.44, 'checking');
  }
  if (view.storeCratesAtBench) {
    for (let i = 0; i < 2; i++) {
      const x = -1.4 + i * 0.75;
      const color = i ? '#557e71' : '#526f88';
      box(0.63, 0.055, 0.54, color, x, 0.07, 1.28, 'crates');
      for (let row = 0; row < 3; row++) {
        for (const z of [1.03, 1.53])
          box(0.66, 0.09, 0.035, color, x, 0.14 + row * 0.12, z, 'crates');
        for (const side of [-1, 1])
          box(0.035, 0.09, 0.54, color, x + side * 0.315, 0.14 + row * 0.12, 1.28, 'crates');
      }
      label('STORE LOAN', x, 0.28, 1.56, 0.51, 'crates', 0.1);
    }
  }

  if (view.showParts) {
    box(0.65, 0.1, 0.55, '#66594b', 0.21, 1.18, -0.45, 'parts');
    box(0.51, 0.04, 0.43, '#bcb19b', 0.21, 1.24, -0.45, 'parts');
    label('PARTS', 0.21, 1.22, -0.13, 0.5, 'parts');
  }
  if (view.showCabinet) {
    if (!view.cabinetStage || ['looked', 'measured'].includes(view.cabinetStage)) {
      for (const x of [2.2, 2.76]) {
        const door = box(0.48, 1.12, 0.075, '#b18b5e', x, 0.61, 1.25, 'cabinet');
        door.rotation.x = -0.13;
        if (view.cabinetStage === 'measured') {
          for (const y of [0.27, 0.94])
            box(0.1, 0.025, 0.025, '#625b50', x - 0.12, y, 1.34, 'cabinet');
        }
      }
      label('CABINET DOORS', 2.48, 0.13, 1.46, 1.08, 'cabinet');
    } else {
      // The doors are now in the kitchen, not invented as installed garage furniture.
      label('KITCHEN CABINET', 1.1, 2.54, -2.15, 1.72, 'cabinet');
      label(
        view.cabinetStage === 'finished' ? 'FITTED AND ALIGNED' : 'HUNG · ALIGNMENT NEXT',
        1.1,
        2.3,
        -2.15,
        1.72,
        'cabinet',
      );
    }
  }
  if (view.journal) {
    box(0.52, 0.06, 0.6, '#526674', -2.47, 1.16, -0.34, 'journal');
    label('NOTES', -2.47, 1.2, 0.0, 0.47, 'journal');
  }
  return {
    root,
    targets,
    dispose: () => {
      for (const item of resources) item.dispose();
    },
  };
}
