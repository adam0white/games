// Sky Kitchen: the 3D view. Models from Kenney (CC0, models/), three.js (MIT, vendor/).
// One scene: the counter with its stations, the dining room in front, sky above the back wall.
// The page asks for views (catch, chop, fry, micro, blend, serve, room) and this file moves the camera there.
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone as cloneSkinned } from './vendor/SkeletonUtils.js';
import { TUNE } from './sim.js';

export { THREE };
const FS = 2.2;            // furniture kit to world
export const TOP = 1.0;    // counter top height
export const PAN = { x: -1.9, z: 0.05 };   // the burner under the pan's bowl
export const LANE = { y0: 1.22, h: 1.42, z: 0.62, s: 1 };   // catch lane to world: x*s, y0 + y*h

// ---------- looks: 2-4 variants for the owner to pick
export const LOOKS = {
  diner: { sky: ['#8fd3ff', '#fff1d6'], wall: '#ffcf9e', trim: '#ff8a5c', floor: ['#fff4e0', '#ffd8b0'], amb: 1.25, sun: 2.4, sunColor: '#fff2dc', toon: false, outline: false, fog: '#ffe6cc', exposure: 1.0, lamps: false, sat: 1 },
  toon: { sky: ['#5ec8ff', '#d8f6ff'], wall: '#ffe066', trim: '#ff5d8f', floor: ['#ffffff', '#a8e6ff'], amb: 1.5, sun: 2.2, sunColor: '#ffffff', toon: true, outline: true, fog: '#d8f6ff', exposure: 1.0, lamps: false, sat: 1.15 },
  night: { sky: ['#1b1440', '#7a3d8c'], wall: '#4b3a6b', trim: '#ffb347', floor: ['#3b2f52', '#2a2140'], amb: 0.55, sun: 0.5, sunColor: '#9fb4ff', toon: false, outline: false, fog: '#2a1f45', exposure: 1.15, lamps: true, sat: 1 },
  // Art directions to pick by playing (?look=...). Each adds a full-screen pass over the 3D render.
  storybook: { sky: ['#bfe3e8', '#fbf1dc'], wall: '#f2d3b0', trim: '#c9714f', floor: ['#f7ecd8', '#eedcc0'], amb: 1.45, sun: 2.0, sunColor: '#fff0d8', toon: false, outline: false, fog: '#f6ead4', exposure: 0.95, lamps: false, sat: 0.85, post: 1 },
  diorama: { sky: ['#6ec6ff', '#e9f7ff'], wall: '#ffd27a', trim: '#ff6b5b', floor: ['#fffaf0', '#cfe9ff'], amb: 1.05, sun: 3.2, sunColor: '#fff4e2', toon: false, outline: false, fog: '#e9f7ff', exposure: 1.05, lamps: false, sat: 1.2, post: 2 },
  comic: { sky: ['#ffd23f', '#fff3c4'], wall: '#7fd1ff', trim: '#ff3d6e', floor: ['#ffffff', '#ffe3ef'], amb: 1.35, sun: 2.4, sunColor: '#ffffff', toon: true, outline: false, fog: '#fff3c4', exposure: 1.0, lamps: false, sat: 1.25, post: 3 },
  clay: { sky: ['#f3e4d7', '#e8d2c0'], wall: '#e9c9b4', trim: '#b98b73', floor: ['#efe2d6', '#e2cfbf'], amb: 1.6, sun: 1.5, sunColor: '#fff6ee', toon: false, outline: false, fog: '#efe2d6', exposure: 0.95, lamps: false, sat: 0.55, clay: true },
};
export const LOOK_IDS = Object.keys(LOOKS);

const loader = new GLTFLoader();
const cache = new Map();
// At most sixteen model fetches at a time: a phone (or a slow test browser) given ~90 at once can drop some.
let busy = 0; const queue = [];
function slot() { return new Promise(go => { if (busy < 16) { busy++; go(); } else queue.push(go); }); }
function free() { const next = queue.shift(); if (next) next(); else busy--; }
async function get(path) { const r = await fetch(path); if (!r.ok) throw new Error(r.status); return loader.parseAsync(await r.arrayBuffer(), path.slice(0, path.lastIndexOf('/') + 1)); }
async function fetchModel(path) { await slot(); try { return await get(path); } catch { try { return await get(path); } catch { return null; } } finally { free(); } }
function load(path) { if (!cache.has(path)) cache.set(path, fetchModel(path)); return cache.get(path); }

// Scale so the largest side (or a named axis) is `size`, centre on x and z, rest on y = 0.
export function fit(obj, size, axis = 'max') {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), d = box.getSize(new THREE.Vector3());
  const side = axis === 'max' ? Math.max(d.x, d.y, d.z) : d[axis];
  const k = side > 0 ? size / side : 1;
  const g = new THREE.Group(); obj.scale.multiplyScalar(k);
  obj.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  g.add(obj); return g;
}

export async function createView(canvas, lookId) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
  let look = LOOKS[lookId] ?? LOOKS.diner;

  // ---------- models
  const food = {}, room = {}, people = [];
  const FOOD = ['carrot', 'onion', 'onion-half', 'tomato', 'tomato-slice', 'cabbage', 'broccoli', 'mushroom', 'mushroom-half', 'paprika', 'paprika-slice', 'eggplant', 'corn', 'leek', 'radish', 'cheese', 'cheese-cut', 'egg', 'egg-cooked', 'egg-half', 'meat-raw', 'meat-cooked', 'meat-patty', 'bacon-raw', 'bacon', 'fish', 'fish-bones', 'bread', 'loaf', 'apple', 'apple-half', 'banana', 'lemon', 'lemon-half', 'strawberry', 'pear', 'orange', 'grapes', 'pineapple', 'watermelon', 'cherries', 'coconut', 'coconut-half', 'hot-dog-raw', 'hot-dog', 'sausage', 'avocado', 'advocado-half', 'celery-stick', 'beet', 'pumpkin-basic', 'salad', 'bowl-soup', 'bowl-broth', 'bowl', 'burger', 'burger-cheese', 'sandwich', 'pizza', 'taco', 'skewer-vegetables', 'fries', 'pancakes', 'sub', 'frappe', 'soda-glass', 'cocktail', 'frying-pan', 'cutting-board', 'cooking-knife', 'pot', 'pot-stew', 'plate', 'plate-dinner', 'cooking-spatula', 'soda-can-crushed', 'plate-broken', 'cupcake', 'cake', 'donut-sprinkles', 'sundae', 'croissant'];
  const ROOM = ['kitchenMicrowave', 'kitchenStove', 'kitchenBlender', 'kitchenFridge', 'kitchenCabinet', 'kitchenCabinetUpper', 'kitchenSink', 'kitchenCoffeeMachine', 'hoodModern', 'stoolBar', 'pottedPlant', 'plantSmall1', 'plantSmall2', 'lampRoundTable', 'lampSquareCeiling', 'tableRound', 'tableCloth', 'table', 'chair', 'chairCushion', 'chairRounded', 'rugRound', 'rugRectangle', 'bench', 'speakerSmall', 'toaster', 'trashcan', 'ceilingFan'];
  const PEOPLE = ['character-female-a', 'character-male-a', 'character-female-b', 'character-male-b', 'character-female-c', 'character-male-c', 'character-female-d', 'character-male-e'];
  await Promise.all([
    ...FOOD.map(async n => { const g = await load(`models/food/${n}.glb`); if (g) food[n] = g.scene; }),
    ...ROOM.map(async n => { const g = await load(`models/room/${n}.glb`); if (g) room[n] = g.scene; }),
  ]);
  food.potato = makePotato();
  // Guests load after the room so the menu shows sooner.
  const peopleReady = Promise.all(PEOPLE.map(async (n, i) => { const g = await load(`models/people/${n}.glb`); if (g) people[i] = g; }));

  const mats = new Set();
  const track = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; for (const mm of [].concat(m.material)) mats.add(mm); } }); return o; };
  // A food item `size` wide (largest side), ready to drop in the scene.
  function item(name, size = 0.3) { const src = food[name] ?? food.potato; const o = fit(src.clone(true), size); styleObject(o); return track(o); }
  function furniture(name, s = FS) { if (!room[name]) return track(new THREE.Group()); const o = room[name].clone(true); o.scale.setScalar(s); const g = new THREE.Group(); g.add(o); o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b.min.y; styleObject(g); return track(g); }

  // ---------- look: materials, outlines, light
  const toonGrad = (() => { const d = new Uint8Array([90, 170, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const outlineMat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { w: { value: 0.012 } },
    vertexShader: 'uniform float w; void main(){ vec3 p = position + normal * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.17,0.11,0.08,1.0); }' });
  const variants = new WeakMap(), baseOf = new WeakMap();
  function styleObject(root) {
    root.traverse(m => {
      if (!m.isMesh || m.userData.styled || m.userData.outline) return;
      m.userData.styled = true;
      const src = [].concat(m.material).map(x => baseOf.get(x) ?? x);
      m.userData.baseMats = src;
      applyLook(m);
    });
  }
  function applyLook(m) {
    const base = m.userData.baseMats; if (!base) return;
    const out = base.map(b => {
      const key = look.toon ? 'toon' : look.clay ? 'clay' : 'std';
      let vs = variants.get(b); if (!vs) variants.set(b, vs = {});
      if (vs[key]) return vs[key];
      let mm;
      if (look.toon) mm = new THREE.MeshToonMaterial({ color: b.color?.clone() ?? new THREE.Color('#fff'), map: b.map ?? null, gradientMap: toonGrad });
      else if (look.clay) { mm = new THREE.MeshStandardMaterial({ color: b.color?.clone() ?? new THREE.Color('#fff'), map: b.map ?? null, roughness: 1, metalness: 0 }); }
      else { mm = b.clone(); if (mm.roughness !== undefined) mm.roughness = Math.min(1, (mm.roughness ?? 0.6) * 0.85); }
      mm.skinning = b.skinning;
      if (look.sat !== 1 && mm.color) { const hsl = {}; mm.color.getHSL(hsl); mm.color.setHSL(hsl.h, hsl.s * look.sat, Math.min(1, hsl.l * (look.clay ? 1.08 : 1))); }
      if (look.clay && mm.map) mm.color.multiplyScalar(1); // keep texture
      vs[key] = mm; baseOf.set(mm, b); return mm;
    });
    m.material = out.length === 1 ? out[0] : out;
    const hasLine = m.children.some(c => c.userData.outline);
    if (look.outline && !m.isSkinnedMesh && !hasLine && !m.userData.noOutline) { const o = new THREE.Mesh(m.geometry, outlineMat); o.userData.outline = true; o.castShadow = false; o.raycast = () => {}; m.add(o); }
    for (const c of [...m.children]) if (c.userData.outline) c.visible = look.outline;
  }

  // Sky: a gradient dome with soft clouds; a few floating islands of garden where food comes from.
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { a: { value: new THREE.Color() }, b: { value: new THREE.Color() }, t: { value: 0 }, night: { value: 0 } },
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 a; uniform vec3 b; uniform float t; uniform float night; varying vec3 vp;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec3 d = normalize(vp); float k = clamp(d.y * 1.3 + 0.25, 0.0, 1.0); vec3 c = mix(b, a, k);
        vec2 q = d.xz / max(0.15, d.y + 0.25) * 1.6 + vec2(t * 0.02, 0.0);
        float cl = n(q) * 0.6 + n(q * 2.1) * 0.3 + n(q * 4.3) * 0.1; cl = smoothstep(0.55, 0.8, cl) * smoothstep(-0.05, 0.25, d.y);
        c = mix(c, mix(vec3(1.0), vec3(0.55, 0.45, 0.75), night), cl * 0.85);
        float st = step(0.995, h(floor(d.xy * 220.0))) * night * smoothstep(0.1, 0.4, d.y); c += st;
        gl_FragColor = vec4(c, 1.0); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), skyMat); scene.add(sky);

  const hemi = new THREE.HemisphereLight('#ffffff', '#c89f7a', 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 2); sun.position.set(3, 7, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 20 }); sun.shadow.bias = -0.0008; sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.PointLight('#ffd7a8', 0, 6); fill.position.set(0, 2.2, 1.5); scene.add(fill);

  // ---------- the room
  const world = new THREE.Group(); scene.add(world);
  const floorTex = checker(look.floor[0], look.floor[1]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 3); floor.receiveShadow = true; world.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: look.wall, roughness: 0.95 });
  const trimMat = new THREE.MeshStandardMaterial({ color: look.trim, roughness: 0.7 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(9, 2.45, 0.2), wallMat); backWall.position.set(0, 1.225, -0.95); backWall.receiveShadow = true; world.add(backWall);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(9.1, 0.16, 0.3), trimMat); trim.position.set(0, 2.5, -0.92); world.add(trim);
  // Scalloped awning over the wall top: the open sky kitchen.
  const awning = new THREE.Group(); world.add(awning);
  for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 16, 1, false, 0, Math.PI), i % 2 ? trimMat : new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 })); s.rotation.set(Math.PI / 2, 0, Math.PI / 2); s.position.set(-4.25 + i * 0.5, 2.42, -0.78); s.rotation.z = -Math.PI / 2; s.rotation.y = 0; s.rotation.x = 0; s.geometry.rotateX(Math.PI / 2); s.geometry.rotateZ(Math.PI); awning.add(s); }
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.45, 7), wallMat); sideL.position.set(-4.5, 1.225, 2.5); world.add(sideL);
  // The right wall has the way in: a doorway at z 0.9-2.4 that guests walk through (and get thrown out of).
  const sideR1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.45, 1.9), wallMat); sideR1.position.set(4.5, 1.225, -0.05); world.add(sideR1);
  const sideR2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.45, 3.6), wallMat); sideR2.position.set(4.5, 1.225, 4.2); world.add(sideR2);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 1.5), wallMat); lintel.position.set(4.5, 2.25, 1.65); world.add(lintel);
  for (const z of [0.9, 2.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.1, 0.12), trimMat); post.position.set(4.5, 1.05, z); world.add(post); }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 1.62), trimMat); head.position.set(4.5, 2.1, 1.65); world.add(head);
  const doormat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 1.2), new THREE.MeshStandardMaterial({ color: "#7a4b2a", roughness: 1 })); doormat.position.set(4.0, 0.012, 1.65); doormat.receiveShadow = true; world.add(doormat);

  // Counter: cabinets with the stove in the row.
  const counter = new THREE.Group(); world.add(counter);
  const slots = [-2.85, -1.9, -0.95, 0, 0.95, 1.9, 2.85];
  const stove = furniture('kitchenStove'); stove.position.set(-1.9, 0, 0); counter.add(stove);
  for (const x of slots) { if (x === -1.9) continue; const c = furniture('kitchenCabinet'); c.position.set(x, 0, 0); counter.add(c); }
  const topMat = new THREE.MeshStandardMaterial({ color: '#f7f2ea', roughness: 0.4 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.06, 1.12), topMat); top.position.set(0, TOP - 0.02, 0); top.receiveShadow = true; counter.add(top);
  for (const x of [-2.85, -0.95, 0.95, 2.85]) { const u = furniture('kitchenCabinetUpper'); u.position.set(x, 1.55, -0.72); counter.add(u); }
  const fridge = furniture('kitchenFridge'); fridge.position.set(-3.9, 0, -0.3); world.add(fridge);
  // The Manners Wheel's trash can, out front by the counter's end.
  const trash = furniture('trashcan', 0.9); trash.position.set(4.25, 0, 0.35); world.add(trash);
  const hood = furniture('hoodModern'); hood.position.set(-1.9, 1.62, -0.6); world.add(hood);

  // Stations on the counter.
  const board = item('cutting-board', 0.9); board.rotation.y = Math.PI / 2; board.position.set(0, TOP, 0.1); world.add(board);
  // The knife, held by the handle. knife (aim and rest) > knifeLift (the chop stroke, pivots at the grip) > the blade on its
  // edge, pointing away from the camera. The model's handle is its +x end (brown in the colormap).
  const knife = new THREE.Group(), knifeLift = new THREE.Group(), bladeG = new THREE.Group(); knife.add(knifeLift); knifeLift.add(bladeG);
  { const kb = item('cooking-knife', 0.62); kb.rotation.y = -Math.PI / 2; bladeG.add(kb); bladeG.rotation.z = Math.PI / 2;
    bladeG.position.z = -0.21; bladeG.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(bladeG); bladeG.position.y -= b.min.y; }
  // A cartoon glove around the handle.
  const glove = new THREE.Group(), gm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  { const fist = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), gm); fist.scale.set(1.15, 0.95, 1.25); glove.add(fist);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 16), gm); cuff.rotation.x = Math.PI / 2; cuff.position.set(0.0, 0.01, 0.065); glove.add(cuff);
    glove.position.set(0, 0.035, 0.02); glove.traverse(o => { if (o.isMesh) o.castShadow = true; }); knifeLift.add(glove); }
  knife.userData.glove = glove;
  // Tool skins: the same stroke with a different thing in the glove. Built in knifeLift's frame: handle at the grip
  // (z near 0), working end toward -z, bottom edge at y = 0.
  const skins = {};
  const alongZ = (o, len, z0 = -0.24) => { const g = new THREE.Group(); g.add(o); o.updateMatrixWorld(true); let b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()); if (sz.x > sz.z) { o.rotation.y += Math.PI / 2; o.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(o); sz = b.getSize(new THREE.Vector3()); } const k = len / Math.max(1e-3, sz.z); g.scale.setScalar(k); g.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(g); const c = b.getCenter(new THREE.Vector3()); g.position.set(-c.x, -b.min.y, z0 - c.z); return g; };
  const steel = mat('#c9d2db', 0.25, 0.85), wood = mat('#8a5a33', 0.7), black = mat('#2b2622', 0.5);
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
  const handleCyl = (m, len = 0.16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, len, 12), m); o.rotation.x = Math.PI / 2; o.position.set(0, 0.035, 0.02); o.castShadow = true; return o; };
  function buildSkin(id) {
    const g = new THREE.Group();
    if (id === 'cleaver') { g.add(handleCyl(wood)); g.add(box(0.012, 0.13, 0.22, steel, 0, 0.065, -0.17)); const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 14), black); hole.rotation.z = Math.PI / 2; hole.position.set(0, 0.1, -0.24); g.add(hole); }
    else if (id === 'machete') { g.add(handleCyl(black, 0.15)); g.add(box(0.008, 0.055, 0.42, steel, 0, 0.03, -0.27)); const tip = box(0.008, 0.05, 0.1, steel, 0, 0.045, -0.5); tip.rotation.x = -0.35; g.add(tip); }
    else if (id === 'chopsticks') { for (const x of [-0.012, 0.012]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.46, 8), mat('#c9894b', 0.6)); c.rotation.x = Math.PI / 2 - 0.12; c.position.set(x, 0.03, -0.16); c.castShadow = true; g.add(c); } }
    else if (id === 'fish') g.add(alongZ(item('fish', 1), 0.42, -0.2));
    else if (id === 'spatula') g.add(alongZ(item('cooking-spatula', 1), 0.48, -0.2));
    else if (id === 'golden') { const k = bladeG.clone(true); k.visible = true; const gm2 = mat('#ffc531', 0.35, 0.35); gm2.emissive = new THREE.Color('#7a5200'); gm2.emissiveIntensity = 0.35; k.traverse(o => { if (o.isMesh) o.material = gm2; }); g.add(k); }
    return g;
  }
  knife.setSkin = id => {
    bladeG.visible = id === 'chef' || !id;
    for (const k in skins) skins[k].visible = false;
    if (bladeG.visible) return;
    skins[id] ??= (() => { const g = buildSkin(id); knifeLift.add(g); return g; })();
    skins[id].visible = true;
  };
  // Rest: lying flat beside the board, no glove.
  knife.rest = () => { knife.position.set(0.55, TOP + 0.03, 0.42); knife.rotation.set(0, 0.5, 0); knifeLift.rotation.set(0, 0, -Math.PI / 2); knifeLift.position.set(0, 0.0, 0); glove.visible = false; };
  knife.rest(); world.add(knife);
  const pan = item('frying-pan', 0.75); pan.rotation.y = Math.PI * 0.75; world.add(pan);
  // Put the pan's bowl, not the middle of bowl and handle, over the burner at PAN. Measured unrotated: the long axis runs
  // from handle to bowl, and the bowl is the end where the model is wider.
  const panR = (() => {
    const ry = pan.rotation.y; pan.rotation.y = 0; pan.position.set(0, 0, 0); pan.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pan), d = box.getSize(new THREE.Vector3());
    const ax = d.x >= d.z ? 'x' : 'z', other = ax === 'x' ? 'z' : 'x', lo = box.min[ax], hi = box.max[ax], len = hi - lo;
    const span = { lo: [Infinity, -Infinity], hi: [Infinity, -Infinity] }, v = new THREE.Vector3();
    pan.traverse(m => { if (!m.isMesh || m.userData.outline) return; const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); const end = v[ax] < lo + len * 0.2 ? span.lo : v[ax] > hi - len * 0.2 ? span.hi : null; if (end) { end[0] = Math.min(end[0], v[other]); end[1] = Math.max(end[1], v[other]); } } });
    const wide = (span.hi[1] - span.hi[0]) >= (span.lo[1] - span.lo[0]) ? 'hi' : 'lo', r = d[other] / 2;
    const bowl = new THREE.Vector3(); bowl[ax] = wide === 'hi' ? hi - r : lo + r; bowl[other] = (box.min[other] + box.max[other]) / 2;
    bowl.applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); pan.rotation.y = ry;
    pan.position.set(PAN.x - bowl.x, TOP + 0.02, PAN.z - bowl.z);
    return r * 0.8;
  })();
  const panGlow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: '#ff5a1f', transparent: true, opacity: 0 })); panGlow.rotation.x = -Math.PI / 2; panGlow.position.set(PAN.x, TOP + 0.03, PAN.z); world.add(panGlow);
  const micro = furniture('kitchenMicrowave', 2.6); micro.position.set(1.05, TOP, -0.12); world.add(micro);
  const microLight = new THREE.PointLight('#ffe08a', 0, 1.2); microLight.position.set(1.05, TOP + 0.25, 0.2); world.add(microLight);
  const microGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0 })); microGlass.position.set(0.98, TOP + 0.24, 0.195); world.add(microGlass);
  const blender = furniture('kitchenBlender', 3.2); blender.position.set(-0.9, TOP, -0.15); world.add(blender);
  const register = makeRegister(); register.group.position.set(2.3, TOP, 0.05); register.group.rotation.y = -0.35; world.add(register.group);
  const coffee = furniture('kitchenCoffeeMachine'); coffee.position.set(2.95, TOP, -0.25); world.add(coffee);
  const toaster = furniture('toaster'); toaster.position.set(-2.9, TOP, -0.25); world.add(toaster);

  // Tray: rounded wood with a rim. Caught items sit on it.
  const tray = makeTray(); tray.group.position.set(0, LANE.y0 - 0.06, LANE.z); world.add(tray.group);

  // Dining room: tables and decor appear with upgrades (setRestaurant).
  const dining = new THREE.Group(); world.add(dining);
  const lights = new THREE.Group(); world.add(lights);
  const sign = makeSign(); sign.group.position.set(0, 2.95, -0.85); world.add(sign.group);

  // Night market string lights.
  const bulbs = new THREE.Group(); world.add(bulbs);
  for (let i = 0; i < 26; i++) { const x = -4.2 + i * 0.34, y = 2.75 - Math.sin(i / 25 * Math.PI) * 0.25; const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: ['#ffcf5c', '#ff7a9c', '#7ad7ff', '#a6ff8f'][i % 4] })); b.position.set(x, y, -0.6); bulbs.add(b); }
  const lampGlow = []; for (const x of [-2.4, 0, 2.4]) { const p = new THREE.PointLight('#ffbe73', 0, 4.5, 1.6); p.position.set(x, 2.4, 0.9); lights.add(p); lampGlow.push(p); }

  // Sky gardens: little floating islands with a tree, where the food falls from.
  const islands = new THREE.Group(); world.add(islands);
  for (const [x, y, z, s] of [[-2.2, 4.3, -3, 1], [1.8, 4.8, -4, 1.3], [0, 5.6, -6, 1.6], [3.6, 3.9, -3.5, 0.8], [-4, 5, -5, 1.1]]) islands.add(makeIsland(x, y, z, s));

  // ---------- particles: juice, steam, sparkles, coins
  const parts = [];
  const partGeo = new THREE.SphereGeometry(1, 8, 6), cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  function burst(pos, { n = 10, color = '#ff6b4a', speed = 1.6, size = 0.035, life = 0.6, up = 1.2, gravity = -6, cube = false, fade = true, glow = false }) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(cube ? cubeGeo : partGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: !glow, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending }));
      m.position.copy(pos); m.scale.setScalar(size * (0.6 + Math.random() * 0.8)); scene.add(m);
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      parts.push({ m, v: new THREE.Vector3(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s * 0.6), life, t: 0, g: gravity, fade, spin: (Math.random() - 0.5) * 10 });
    }
  }
  function steam(pos, n = 3) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false })); m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.2)); m.scale.setScalar(0.04); scene.add(m); parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.45, 0), life: 1.2, t: 0, g: 0.1, fade: true, grow: 0.09 }); } }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt; p.v.y += p.g * dt; p.m.position.addScaledVector(p.v, dt);
      if (p.grow) p.m.scale.addScalar(p.grow * dt); if (p.spin) { p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt; }
      if (p.fade) p.m.material.opacity = Math.max(0, 1 - p.t / p.life) * (p.grow ? 0.55 : 1);
      if (p.t >= p.life) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); }
    }
  }

  // ---------- guests
  const guests = [];
  async function guest(i, tall = 1.25) {
    await peopleReady;
    const src = people[i % people.length] ?? people.find(Boolean); if (!src) return null;
    const body = cloneSkinned(src.scene); styleObject(body); track(body);
    const g = fit(body, tall, 'y'); g.position.set(5.2, 0, 1.2); world.add(g);
    const mixer = new THREE.AnimationMixer(body), acts = {};
    for (const clip of src.animations) acts[clip.name] = mixer.clipAction(clip);
    let cur = null;
    const play = (name, once = false) => { const a = acts[name]; if (!a || a === cur) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.fadeIn(0.2).play(); cur?.fadeOut(0.2); cur = a; };
    const bubble = makeBubble(); bubble.group.position.set(0, tall + 0.3, 0); g.add(bubble.group); bubble.group.visible = false;
    const me = { g, mixer, play, bubble, target: null, speed: 1.6, onArrive: null, face: null };
    play('walk'); guests.push(me); return me;
  }
  // The guest under a screen point (CSS pixels), or null.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function guestAt(sx, sy) {
    ndc.set(sx / W * 2 - 1, -(sy / H * 2 - 1)); ray.setFromCamera(ndc, camera);
    let best = null, bestD = Infinity;
    for (const me of guests) { if (me.gone) continue; const hit = ray.intersectObject(me.g, true)[0]; if (hit && hit.distance < bestD) { best = me; bestD = hit.distance; } }
    return best;
  }
  function walkTo(me, x, z, done) { me.target = new THREE.Vector3(x, 0, z); me.onArrive = done; me.play('walk'); }
  function stepGuests(dt) {
    for (let i = guests.length - 1; i >= 0; i--) {
      const me = guests[i]; me.mixer.update(dt);
      if (me.target) {
        const d = me.target.clone().sub(me.g.position); d.y = 0; const L = d.length();
        if (L < 0.03) { me.target = null; me.play('idle'); const f = me.onArrive; me.onArrive = null; f?.(); }
        else { const step = Math.min(L, me.speed * dt); me.g.position.addScaledVector(d.normalize(), step); const want = Math.atan2(d.x, d.z); me.g.rotation.y += angleTo(me.g.rotation.y, want) * Math.min(1, dt * 10); }
      } else if (me.face != null) me.g.rotation.y += angleTo(me.g.rotation.y, me.face) * Math.min(1, dt * 6);
      me.bubble.group.lookAt(camera.position.x, me.bubble.group.getWorldPosition(new THREE.Vector3()).y, camera.position.z);
      if (me.gone) { me.onArrive = null; me.target = null; world.remove(me.g); me.bubble.dispose(); me.mixer.stopAllAction(); me.g.traverse(o => { if (o.isSkinnedMesh) o.skeleton.dispose(); }); guests.splice(i, 1); }   // each clone has its own bone texture
    }
  }

  // ---------- stunts: the Manners Wheel's slapstick. A stunt is a list of timed segments run on a guest.
  const stunts = [];
  const SPOTS = { fridge: [-3.9, 0.2, 0.25], micro: [1.05, TOP + 0.15, -0.1], stove: [-1.9, TOP + 0.05, 0.05], trash: [4.25, 0.55, 0.35] };
  // Staff wait between the dining tables, facing the room.
  const STAFF_SPOTS = [[-3.4, 3.4], [3.2, 3.5]];
  // The line: guests wait in front of the dining tables, facing the counter, clear of the door path and the staff.
  const WAIT_SPOTS = [[-2.4, 1.55], [0.9, 1.75], [-0.3, 2.55], [-1.5, 3.4]];
  function stunt(me, kind, { at = null, staffSlot = 0 } = {}, done = () => {}) {
    const g = me.g, home = g.position.clone(), seg = [];
    const arc = (to, dur, height, spin = 0, shrink = 1) => { let from; seg.push({ dur, start() { from = g.position.clone(); me.target = null; me.play('jump', true); }, step(k) { g.position.lerpVectors(from, to, k); g.position.y += Math.sin(k * Math.PI) * height; g.rotation.x = spin * k * Math.PI * 2; g.scale.setScalar(1 + (shrink - 1) * k); } }); };
    const hold = (dur, fn = null) => seg.push({ dur, start() { fn?.(); }, step() {} });
    const back = () => seg.push({ dur: 0, start() { g.visible = true; g.rotation.x = 0; g.rotation.z = 0; g.scale.setScalar(1); } });
    const walkIn = (from) => seg.push({ wait: true, start(next) { g.position.set(...from); g.visible = true; walkTo(me, home.x, home.z, next); } });
    if (kind === 'fly') { arc(new THREE.Vector3(6.6, 0, 2.8), 1.2, 2.4, 2); hold(1.0, () => { g.visible = false; }); back(); walkIn([5.2, 0, 1.2]); }
    else if (kind === 'spin') { seg.push({ dur: 0.9, start() { me.play('die', true); }, step(k) { g.rotation.y += 0.5; g.position.y = home.y + Math.sin(k * Math.PI) * 0.3; } }); hold(0.5, () => me.play('emote-no', true)); }
    else if (kind === 'hop') { seg.push({ dur: 1.4, start() { me.play('jump'); }, step(k) { g.position.y = home.y + Math.abs(Math.sin(k * Math.PI * 3)) * 0.45; if (Math.random() < 0.3) burst(g.position.clone(), { n: 2, color: Math.random() < 0.5 ? '#ff6a10' : '#ffc531', speed: 0.6, up: 1.5, life: 0.4, glow: true }); } }); hold(0.4, () => steam(g.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 4)); }
    else if (kind === 'into') { const p = new THREE.Vector3(...SPOTS[at]); arc(p, 0.9, 1.4, 1, 0.25); hold(0.25, () => { g.visible = false; burst(p, { n: 12, color: at === 'fridge' ? '#bfe8ff' : at === 'trash' ? '#8a8f7a' : '#ffb347', speed: 1.2, up: 1.2 }); }); hold(1.2); seg.push({ dur: 0, start() { g.visible = true; } }); arc(home.clone(), 0.9, 1.4, -1, 4); back(); hold(0.5, () => { me.play('emote-no', true); if (at === 'fridge') me.shiver = 1.2; else steam(g.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 5); }); }
    else if (kind === 'out') { seg.push({ wait: true, start(next) { walkTo(me, 6.8, 2.6, next); } }); hold(1.6, () => me.play('emote-no')); walkIn([6.8, 0, 2.6]); }
    else if (kind === 'shake') { seg.push({ dur: 1.4, start() { me.play('fall'); }, step(k) { g.rotation.z = Math.min(1, k * 4) * Math.PI; g.position.y = home.y + 1.2 * Math.min(1, k * 4); g.position.x = home.x + Math.sin(k * 40) * 0.08; if (Math.random() < 0.25) burst(g.position.clone().add(new THREE.Vector3(0, 0.4, 0)), { n: 2, color: '#ffc531', speed: 0.8, up: 0.5, cube: false, life: 0.8 }); } }); back(); seg.push({ dur: 0, start() { g.position.copy(home); } }); }
    else if (kind === 'join') { const [x, z] = STAFF_SPOTS[staffSlot % STAFF_SPOTS.length]; seg.push({ wait: true, start(next) { walkTo(me, 2.0, 2.2, () => walkTo(me, x, z, next)); } }); seg.push({ dur: 0, start() { me.face = 0; me.play('idle'); } }); }
    else if (kind === 'boot') { arc(new THREE.Vector3(home.x + 5.5, 0, home.z + 1.2), 1.0, 2.6, 2); hold(0.05, () => { g.visible = false; }); }
    else if (kind === 'fight') { seg.push({ dur: 0.01, start() { me.play('attack-melee-right'); } }); }
    stunts.push({ me, seg, i: -1, t: 0, done, waiting: false });
  }
  function stepStunts(dt) {
    if (!(dt > 0)) return;   // paused: a stunt that spawns sparks every frame would pile them up
    for (let n = stunts.length - 1; n >= 0; n--) if (stunts[n].me.gone) stunts.splice(n, 1);   // the guest was removed mid-stunt
    for (let n = stunts.length - 1; n >= 0; n--) {
      const s = stunts[n];
      if (s.waiting) continue;
      const cur = s.seg[s.i];
      if (cur && !cur.wait) { s.t += dt; cur.step?.(Math.min(1, s.t / Math.max(1e-3, cur.dur))); if (s.t < cur.dur) continue; }
      s.i++; s.t = 0;
      const nx = s.seg[s.i];
      if (!nx) { stunts.splice(n, 1); s.done(); continue; }
      if (nx.wait) { s.waiting = true; nx.start(() => { s.waiting = false; }); } else nx.start?.();
    }
    for (const me of guests) if (me.shiver > 0) { me.shiver -= dt; me.g.position.x += Math.sin(me.shiver * 90) * 0.006; }
  }

  // ---------- camera
  const VIEWS = {
    catch: { at: [0, 1.98, 0.55], half: [1.18, 1.0], dir: [0, 0.12, 1] },
    chop: { at: [0, 1.02, 0.12], half: [0.62, 0.42], dir: [0, 1.0, 0.85] },
    fry: { at: [-1.9, 1.04, 0.08], half: [0.6, 0.42], dir: [0.15, 1.0, 0.85] },
    micro: { at: [1.02, 1.22, 0.05], half: [0.55, 0.42], dir: [-0.1, 0.35, 1] },
    blend: { at: [-0.9, 1.25, 0.0], half: [0.45, 0.45], dir: [0.1, 0.35, 1] },
    serve: { at: [2.75, 1.25, 0.4], half: [1.2, 0.85], dir: [-0.28, 0.34, 1] },
    room: { at: [0, 0.9, 1.6], half: [3.4, 2.0], dir: [0.0, 0.85, 1] },
    // Wheel stunts: the counter front and the door side; the cooking side for the fridge, stove and microwave.
    stunt: { at: [3.4, 1.4, 1.3], half: [2.8, 1.9], dir: [-0.15, 0.45, 1] },
    left: { at: [-0.3, 1.3, 1.0], half: [4.0, 2.0], dir: [0.05, 0.45, 1] },
    menu: { at: [0.6, 1.5, 0.6], half: [2.0, 1.3], dir: [-0.25, 0.35, 1] },
    // Focus views for looking around while guests wait: the line up close, the door, the kitchen side.
    tables: { at: [-0.75, 0.9, 2.0], half: [2.7, 1.5], dir: [0.05, 0.8, 1] },
    door: { at: [4.2, 1.1, 1.65], half: [1.5, 1.3], dir: [-0.9, 0.45, 0.6] },
    kitchen: { at: [-2.4, 1.3, 0.6], half: [2.0, 1.4], dir: [0.45, 0.45, 1] },
  };
  const cam = { pos: new THREE.Vector3(0, 3, 9), at: new THREE.Vector3(0, 1, 0), wantPos: new THREE.Vector3(), wantAt: new THREE.Vector3(), name: 'menu', shake: 0, orbit: 0, bias: 0 };
  let W = 1, H = 1;
  // Wide: any screen that is not a tall phone. Measured now, not at the last resize; sticky between 0.56 and 0.62 so a
  // browser bar sliding in or out does not flip it mid-shift.
  let wasWide = false;
  const wide = () => { const a = (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight); wasWide = wasWide ? a > 0.575 : a > 0.63; return wasWide; };   // two edges so a window near the line does not flip; a 16:9 phone held upright (0.5625) is always tall
  let catchRoom = 1; const catchUp = 0.03;   // with room: the tray near the middle of the screen, guests under it
  function setRoom(k) { if (k === catchRoom) return; catchRoom = k; if (cam.name === 'catch') view('catch'); }
  function framing(name) {
    const v = VIEWS[name], fovY = THREE.MathUtils.degToRad(camera.fov) / 2, aspect = W / H;
    const dist = Math.max(v.half[1] / Math.tan(fovY), v.half[0] / (Math.tan(fovY) * aspect)) * 1.04;
    const dir = new THREE.Vector3(...v.dir).normalize();
    const at = new THREE.Vector3(...v.at);
    // A tall phone gets room above and below; keep the subject a little high so the ticket and gauge sit under it.
    if (name !== 'catch' && aspect < 0.8) at.y -= v.half[0] / aspect * 0.18 * (name === 'room' || name === 'menu' ? 0.4 : 1);
    if (name === 'catch') {
      // The lane fills the screen whatever its shape: the tray a quarter up from the bottom, items from near the top.
      const room = wide() ? catchRoom : 1;   // only a screen that is not a tall phone needs it; checked here so a turned phone is right at once
      const fit = Math.max(v.half[1], v.half[0] / aspect) * room * 1.04, visH = 2 * fit;   // catchRoom: a wide screen steps back so guests under the tray show
      LANE.h = visH * 0.6 / 1.15; at.y = LANE.y0 + visH * (room > 1 ? catchUp : 0.2);
      const d = fit / Math.tan(fovY);
      return { pos: at.clone().addScaledVector(dir, d), at };
    }
    return { pos: at.clone().addScaledVector(dir, dist), at };
  }
  function view(name, instant = false) { cam.name = name; const f = framing(name); cam.wantPos.copy(f.pos); cam.wantAt.copy(f.at); if (instant) { cam.pos.copy(f.pos); cam.at.copy(f.at); } }
  function resize() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight; wide();   // sampled on every resize, the menu's too, so the two edges remember
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); view(cam.name, true);
  }
  addEventListener('resize', resize);

  // ---------- look switch
  function setLook(id) {
    look = LOOKS[id] ?? LOOKS.diner;
    skyMat.uniforms.a.value.set(look.sky[0]); skyMat.uniforms.b.value.set(look.sky[1]); skyMat.uniforms.night.value = look.lamps ? 1 : 0;
    scene.fog = new THREE.Fog(look.fog, 14, 34);
    hemi.intensity = look.amb; sun.intensity = look.sun; sun.color.set(look.sunColor);
    renderer.toneMappingExposure = look.exposure;
    wallMat.color.set(look.wall); trimMat.color.set(look.trim);
    floor.material.map = checker(look.floor[0], look.floor[1]); floor.material.needsUpdate = true;
    bulbs.visible = look.lamps; for (const p of lampGlow) p.intensity = look.lamps ? 6 : 0; fill.intensity = look.lamps ? 2.5 : 0;
    sun.shadow.radius = look.clay ? 10 : 4;
    scene.traverse(m => { if (m.isMesh && m.userData.baseMats) applyLook(m); });
    document.documentElement.style.setProperty('--page', look.sky[1]);
  }
  setLook(lookId);

  // ---------- restaurant upgrades shown in the room
  function setRestaurant(save, pop = null) {
    dining.clear();
    const tables = save.built.tables, decor = save.built.decor, tier = save.tier;
    const spots = [[-2.4, 2.4], [2.0, 2.6], [-0.3, 3.4], [-2.5, 4.4], [1.9, 4.6], [0.2, 5.4]];
    for (let i = 0; i < Math.min(spots.length, tables); i++) {
      const [x, z] = spots[i]; const t = furniture(tier >= 3 ? 'tableCloth' : tier >= 1 ? 'tableRound' : 'table', tier >= 3 ? 2.3 : 2.0); t.position.set(x, 0, z); dining.add(t);
      for (const s of [-1, 1]) { const c = furniture(tier >= 2 ? 'chairCushion' : 'chair', 2.3); c.position.set(x + s * 0.75, 0, z); c.rotation.y = -s * Math.PI / 2; dining.add(c); }
      if (decor >= 3) { const v = item(['cupcake', 'donut-sprinkles', 'sundae', 'croissant'][i % 4], 0.2); v.position.set(x, 0.78, z); dining.add(v); }
      if (decor >= 4) { const l = furniture('lampRoundTable', 1.6); l.position.set(x + 0.2, 0.75, z - 0.12); dining.add(l); }
      if (pop === 'tables' && i === tables - 1) popIn(t);
    }
    if (decor >= 2) for (const [x, z] of [[-4.0, 1.4], [4.0, 1.4], [-4.0, 5.5], [4.0, 5.5]]) { const p = furniture('pottedPlant', 1.6); p.position.set(x, 0, z); dining.add(p); if (pop === 'decor') popIn(p); }
    if (decor >= 3) { const r = furniture('rugRectangle', 3); r.position.set(0, 0.01, 3.8); dining.add(r); }
    if (decor >= 5) for (const x of [-2.4, 0, 2.4]) { const l = furniture('lampSquareCeiling', 2); l.position.set(x, 2.0, 2.4); dining.add(l); }
    if (decor >= 6) { const f = furniture('ceilingFan', 2.5); f.position.set(0, 2.1, 4); dining.add(f); }
    if (decor >= 1) for (const x of [-3.3, 3.4]) { const p = furniture('plantSmall1', 1.8); p.position.set(x, TOP, -0.3); dining.add(p); }
    stoveGroup.visible = true;
    micro.visible = save.built.micro > 0; blender.visible = save.built.blender > 0;
    pan.visible = save.built.stove > 0; panGlow.visible = pan.visible;
    sign.set(tier); tray.setLevel(save.built.tray);
    if (pop === 'micro') popIn(micro); if (pop === 'blender') popIn(blender); if (pop === 'stove') popIn(pan); if (pop === 'tray') popIn(tray.group);
  }
  const stoveGroup = stove;
  const pops = [];
  function popIn(o, sparkle = true) { pops.push({ o, t: 0, s: o.scale.clone() }); o.scale.multiplyScalar(0.01); if (sparkle) burst(o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0)), { n: 26, color: '#ffd84a', speed: 2.2, up: 2.4, size: 0.05, life: 1, cube: true }); }

  // ---------- loop helpers
  const clock = { t: 0 };
  // ---------- art-direction pass: the scene renders to a texture, then one shader draws it to the screen.
  // 1 storybook: pencil lines from depth, paper grain, soft washes. 2 diorama: tilt-shift blur and toy colours.
  // 3 comic: thick ink lines, three tones, halftone dots in the shadows.
  const post = (() => {
    let rt = null;
    const qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2(1, 1) }, mode: { value: 0 }, near: { value: 0.1 }, far: { value: 100 }, time: { value: 0 }, dpr: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform int mode; uniform float near, far, time, dpr;
        varying vec2 vUv;
        float lin(vec2 uv) { float d = texture2D(tDepth, uv).x; return (near * far) / (far - d * (far - near)); }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        float edge(vec2 uv, float w) { vec2 px = w / res; float c = lin(uv);
          float e = abs(lin(uv + vec2(px.x, 0.0)) - c) + abs(lin(uv - vec2(px.x, 0.0)) - c) + abs(lin(uv + vec2(0.0, px.y)) - c) + abs(lin(uv - vec2(0.0, px.y)) - c);
          return e / max(c, 0.5); }
        float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
        vec3 sat(vec3 c, float s) { return mix(vec3(lum(c)), c, s); }
        void main() {
          vec2 uv = vUv; vec3 col;
          vec2 sp = gl_FragCoord.xy / dpr;
          if (mode == 1) {
            // Watercolour: a Kuwahara filter flattens shapes into painted patches, ink lines from depth and colour,
            // pigment pooling at patch edges, and paper grain.
            vec2 px = dpr / res; float wob = (noise(sp * 0.04) - 0.5) * 1.5;
            vec3 m[4]; vec3 v[4];
            for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); v[k] = vec3(0.0); }
            for (int j = 0; j <= 3; j++) for (int i = 0; i <= 3; i++) {
              vec3 a = texture2D(tColor, uv + vec2(-i, -j) * px).rgb; m[0] += a; v[0] += a * a;
              vec3 b = texture2D(tColor, uv + vec2(i, -j) * px).rgb; m[1] += b; v[1] += b * b;
              vec3 c = texture2D(tColor, uv + vec2(-i, j) * px).rgb; m[2] += c; v[2] += c * c;
              vec3 d = texture2D(tColor, uv + vec2(i, j) * px).rgb; m[3] += d; v[3] += d * d;
            }
            float best = 1e9;
            for (int k = 0; k < 4; k++) { vec3 mu = m[k] / 16.0; vec3 s2 = abs(v[k] / 16.0 - mu * mu); float q = s2.r + s2.g + s2.b;
              if (q < best) { best = q; col = mu; } }
            col = sat(col, 1.3); col = (col - 0.5) * 1.08 + 0.5;
            float le = 0.0; vec3 c0 = texture2D(tColor, uv).rgb;
            le += length(texture2D(tColor, uv + vec2(px.x, 0.0)).rgb - c0) + length(texture2D(tColor, uv + vec2(0.0, px.y)).rgb - c0);
            float e = max(smoothstep(0.012, 0.045, edge(uv + vec2(wob) * px, 1.5 * dpr)), smoothstep(0.25, 0.6, le) * 0.6);
            col *= 1.0 - smoothstep(0.0, 0.15, best) * 0.25;
            col = mix(col, vec3(0.22, 0.13, 0.1), e * 0.85);
            float paper = noise(sp * 0.7) * 0.6 + noise(sp * 0.13) * 0.4;
            col *= 0.9 + paper * 0.14;
            col = mix(col, vec3(1.0, 0.97, 0.9), 0.04);
            float vg = length((uv - 0.5) * vec2(1.0, 1.2)); col *= 1.0 - smoothstep(0.5, 1.0, vg) * 0.3;
          } else if (mode == 2) {
            float k = max(smoothstep(0.9, 1.0, uv.y), smoothstep(0.3, 0.0, uv.y)); // sharp where food falls, toy-blur at the very top and bottom
            vec3 acc = texture2D(tColor, uv).rgb; float n = 1.0;
            for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996; float r = sqrt(float(i) + 0.5) / sqrt(12.0);
              vec2 o = vec2(cos(a), sin(a)) * r * k * 7.0 * dpr / res; acc += texture2D(tColor, uv + o).rgb; n += 1.0; }
            col = acc / n;
            col = sat(col, 1.35); col = (col - 0.5) * 1.12 + 0.5;
            float v = length(uv - 0.5); col *= 1.0 - smoothstep(0.35, 0.85, v) * 0.45;
          } else {
            col = texture2D(tColor, uv).rgb;
            float l = lum(col);
            float band = l < 0.18 ? 0.55 : l < 0.5 ? 0.85 : 1.08;
            col = sat(col / max(l, 0.001) * band * 0.55, 1.3);
            vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * sp / 5.0;
            float dots = length(fract(g) - 0.5);
            if (l < 0.5) col *= mix(1.0, 0.55, step(dots, (0.5 - l) * 0.9));
            float e = smoothstep(0.05, 0.1, edge(uv, 2.0 * dpr));
            col = mix(col, vec3(0.06, 0.03, 0.08), e);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    qScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    const size = new THREE.Vector2();
    return {
      render(mode) {
        renderer.getDrawingBufferSize(size);
        if (!rt || rt.width !== size.x || rt.height !== size.y) {
          rt?.dispose();
          rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: mode === 3 ? 0 : 4 });
          rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
        }
        renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
        const u = mat.uniforms; u.tColor.value = rt.texture; u.tDepth.value = rt.depthTexture; u.res.value.copy(size); u.mode.value = mode;
        u.near.value = camera.near; u.far.value = camera.far; u.time.value = clock.t; u.dpr.value = renderer.getPixelRatio();
        renderer.render(qScene, qCam);
      },
    };
  })();

  function frame(dt) {
    clock.t += dt; skyMat.uniforms.t.value = clock.t;
    const k = 1 - Math.pow(0.0025, dt);
    cam.pos.lerp(cam.wantPos, k); cam.at.lerp(cam.wantAt, k);
    camera.position.copy(cam.pos);
    if (cam.name === 'room' || cam.name === 'menu') { cam.orbit += dt * 0.12; const r = 0.35; camera.position.x += Math.sin(cam.orbit) * r; }
    if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 3); camera.position.x += (Math.random() - 0.5) * cam.shake * 0.08; camera.position.y += (Math.random() - 0.5) * cam.shake * 0.08; }
    camera.lookAt(cam.at);
    stepGuests(dt); stepStunts(dt); stepParts(dt); register.step(dt); tray.step(dt); sign.step(dt, clock.t);
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; const e = elasticOut(Math.min(1, p.t / 0.7)); p.o.scale.copy(p.s).multiplyScalar(Math.max(0.01, e)); if (p.t >= 0.7) { p.o.scale.copy(p.s); pops.splice(i, 1); } }
    islands.children.forEach((g, i) => { g.position.y = g.userData.y + Math.sin(clock.t * 0.6 + i) * 0.08; g.rotation.y += dt * 0.05; });
    for (const [i, b] of bulbs.children.entries()) b.material.color.offsetHSL(0, 0, Math.sin(clock.t * 3 + i) * 0.002);
    if (look.post) post.render(look.post); else renderer.render(scene, camera);
  }

  // Screen point of a world position (CSS pixels).
  function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, z: p.z }; }
  // World point at the plane z = zPlane under a screen point.
  function toPlane(sx, sy, zPlane) {
    const ndc = new THREE.Vector3(sx / W * 2 - 1, -(sy / H * 2 - 1), 0.5).unproject(camera);
    const dir = ndc.sub(camera.position).normalize(); const t = (zPlane - camera.position.z) / dir.z;
    return camera.position.clone().addScaledVector(dir, t);
  }
  function toY(sx, sy, yPlane) {
    const ndc = new THREE.Vector3(sx / W * 2 - 1, -(sy / H * 2 - 1), 0.5).unproject(camera);
    const dir = ndc.sub(camera.position).normalize(); const t = (yPlane - camera.position.y) / dir.y;
    return camera.position.clone().addScaledVector(dir, t);
  }

  // Small pictures of food for the ticket and the shop, drawn by this renderer with the current look.
  const thumbCache = new Map();
  function thumb(name, size = 96) {
    const key = name + '|' + size + '|' + (look.toon ? 't' : look.clay ? 'c' : 's');
    if (thumbCache.has(key)) return thumbCache.get(key);
    const rt = new THREE.WebGLRenderTarget(size * 2, size * 2, { samples: 4 });
    const s = new THREE.Scene(); s.add(new THREE.HemisphereLight('#fff', '#b98', 2.2)); const d = new THREE.DirectionalLight('#fff', 2.2); d.position.set(1, 2, 2); s.add(d);
    const o = name.startsWith('room:') ? furniture(name.slice(5), 1) : name === 'register' ? makeRegister().group : name === 'tray' ? makeTray().group : item(name, 1);
    if (name === 'register' || name === 'tray') styleObject(o);
    const g = name.startsWith('room:') || name === 'register' || name === 'tray' ? fit(o, 1) : o;
    s.add(g); g.rotation.y = -0.5; g.rotation.x = 0.25;
    const c = new THREE.PerspectiveCamera(30, 1, 0.1, 10); c.position.set(0, 0.55, 2.2); c.lookAt(0, 0.38, 0);
    const before = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(s, c);
    const px = new Uint8Array(size * 2 * size * 2 * 4); renderer.readRenderTargetPixels(rt, 0, 0, size * 2, size * 2, px); renderer.setRenderTarget(before);
    const cv = document.createElement('canvas'); cv.width = cv.height = size * 2; const cx = cv.getContext('2d'); const img = cx.createImageData(size * 2, size * 2);
    for (let y = 0; y < size * 2; y++) img.data.set(px.subarray((size * 2 - 1 - y) * size * 8, (size * 2 - y) * size * 8), y * size * 8);
    cx.putImageData(img, 0, 0); rt.dispose();
    const url = cv.toDataURL(); thumbCache.set(key, url); return url;
  }

  resize(); view('menu', true);
  return {
    THREE, scene, camera, renderer, world, food, item, furniture, tray, register, board, knife, knifeLift, pan, panR, panGlow, micro, microLight, microGlass, blender, sign,
    memory: () => ({ ...renderer.info.memory, parts: parts.length }), setRoom, wide, guest, guestAt, walkTo, guests, stunt, staffSpots: STAFF_SPOTS, waitSpots: WAIT_SPOTS, view, cam, frame, resize, burst, steam, toScreen, toPlane, toY, setLook, setRestaurant, thumb, popIn,
    get look() { return look; }, peopleReady,
    shake(n = 1) { cam.shake = Math.max(cam.shake, n); },
    flashThumbs() { thumbCache.clear(); },
  };

  // ---------- made in code
  function makeTray() {
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
    const wood = new THREE.MeshStandardMaterial({ color: '#c98a4f', roughness: 0.6 });
    const rim = new THREE.MeshStandardMaterial({ color: '#9a5e2e', roughness: 0.6 });
    const base = new THREE.Mesh(roundedBox(1, 0.05, 0.42, 0.06), wood); base.castShadow = base.receiveShadow = true; body.add(base);
    const rims = [];
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.04), rim); r.position.set(0, 0.05, s * 0.2); body.add(r); rims.push(r); }
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16, Math.PI), rim); h.position.set(s * 0.52, 0.05, 0); h.rotation.set(0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0); body.add(h); rims.push(h); }
    for (const m of [base, ...rims]) { m.userData.baseMats = [m.material]; m.userData.styled = true; }
    const load = new THREE.Group(); group.add(load);
    let width = 0.6, squash = 0, tilt = 0, lastX = 0;
    // Tray skins (cosmetic, earned with missions): body colour, rim colour, roughness, metalness.
    const SKINS = { wood: null, enamel: ['#2f9c95', '#f4efe6', 0.3, 0.1], golden: ['#f5c63a', '#d99a1c', 0.3, 0.25, 0.22] }, skinMats = { wood: [wood, rim] };
    return {
      group, load,
      setSkin(id) {
        if (!Object.hasOwn(SKINS, id)) id = 'wood';
        const [a, b] = skinMats[id] ??= [0, 1].map(i => new THREE.MeshStandardMaterial({ color: SKINS[id][i], roughness: SKINS[id][2], metalness: SKINS[id][3], emissive: SKINS[id][i], emissiveIntensity: SKINS[id][4] ?? 0 }));
        body.traverse(m => { if (!m.isMesh) return; const mat = m === base ? a : b; if (m.userData.baseMats) { m.userData.baseMats = [mat]; applyLook(m); } else m.material = mat; });
      },
      setLevel(l) { const half = TUNE.trayHalf[Math.min(TUNE.trayHalf.length - 1, l)]; width = half * 2 * LANE.s + 0.1; body.scale.set(width, 1, 1); rims.forEach((r, i) => { if (i >= 2) r.position.x = (i === 2 ? -1 : 1) * 0.52 * width; r.scale.x = i < 2 ? 1 : 1 / width; }); },
      setX(x) { group.position.x = x; },
      bump() { squash = 1; },
      step(dt) { squash = Math.max(0, squash - dt * 5); const vx = (group.position.x - lastX) / Math.max(dt, 1e-3); lastX = group.position.x; tilt += (Math.max(-0.25, Math.min(0.25, -vx * 0.04)) - tilt) * Math.min(1, dt * 12); group.rotation.z = tilt; group.scale.set(1 + squash * 0.12, 1 - squash * 0.25, 1); },
      get width() { return width; },
    };
  }
  function makeRegister() {
    const group = new THREE.Group();
    const red = mat('#e8524a'), cream = mat('#fff1d6'), dark = mat('#3b2a24'), gold = mat('#ffc531', 0.35, 0.6), teal = mat('#46c2b5');
    const body = new THREE.Mesh(roundedBox(0.62, 0.3, 0.5, 0.06), red); body.position.y = 0.2; group.add(body);
    const slope = new THREE.Mesh(roundedBox(0.6, 0.06, 0.34, 0.03), cream); slope.position.set(0, 0.38, 0.06); slope.rotation.x = -0.45; group.add(slope);
    const keys = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), c === 3 ? teal : cream); k.position.set(-0.18 + c * 0.12, 0.42 - r * 0.045 + 0.0, -0.02 + r * 0.09); k.rotation.x = -0.45; group.add(k); keys.push(k); }
    const tower = new THREE.Mesh(roundedBox(0.36, 0.22, 0.12, 0.03), red); tower.position.set(0, 0.52, -0.17); group.add(tower);
    const screenCv = document.createElement('canvas'); screenCv.width = 256; screenCv.height = 96; const sx = screenCv.getContext('2d');
    const screenTex = new THREE.CanvasTexture(screenCv); screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.11), new THREE.MeshBasicMaterial({ map: screenTex })); screen.position.set(0, 0.54, -0.04); group.add(screen);
    screen.userData.noOutline = true;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold); bell.position.set(0.2, 0.64, -0.17); group.add(bell);
    const drawer = new THREE.Group(); drawer.position.set(0, 0.04, 0.02); group.add(drawer);
    const dbox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.46), cream); dbox.position.y = 0.04; drawer.add(dbox);
    const front = new THREE.Mesh(roundedBox(0.6, 0.12, 0.04, 0.02), dark); front.position.set(0, 0.04, 0.24); drawer.add(front);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.03), gold); handle.position.set(0, 0.05, 0.27); drawer.add(handle);
    // Inside the drawer: four bill slots (20, 10, 5, 1) and a coin cup. The stacks grow with the day's takings.
    const DENOMS = [20, 10, 5, 1], BILL_COL = { 20: '#5fae6b', 10: '#7cc4d8', 5: '#e7b85a', 1: '#d98ab8' };
    const billTex = {};
    for (const d of DENOMS) {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d');
      c.fillStyle = BILL_COL[d]; c.fillRect(0, 0, 128, 64); c.strokeStyle = '#ffffffcc'; c.lineWidth = 5; c.strokeRect(6, 6, 116, 52);
      c.fillStyle = '#ffffffdd'; c.beginPath(); c.arc(64, 32, 17, 0, 7); c.fill();
      c.fillStyle = '#2b1d14'; c.font = '900 26px ui-rounded, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(d), 64, 33);
      c.font = '900 15px sans-serif'; c.fillText(String(d), 20, 18); c.fillText(String(d), 108, 48);
      billTex[d] = new THREE.CanvasTexture(cv); billTex[d].colorSpace = THREE.SRGBColorSpace;
    }
    const billGeo = new THREE.BoxGeometry(0.11, 0.006, 0.19);
    const billMat = d => new THREE.MeshStandardMaterial({ map: billTex[d], roughness: 0.8 });
    const slots = DENOMS.map((d, i) => { const g = new THREE.Group(); g.position.set(-0.2 + i * 0.133, 0.095, -0.02); drawer.add(g); return { d, g, n: 0, m: billMat(d) }; });
    for (const sl of slots) for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(billGeo, sl.m); b.position.y = k * 0.007; b.rotation.y = (k - 0.5) * 0.08; sl.g.add(b); sl.n++; }
    const cup = new THREE.Group(); cup.position.set(0, 0.095, 0.17); drawer.add(cup);
    const coinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14);
    const coinMat = gold, silver = mat('#d9dde3', 0.3, 0.7);
    let coinsIn = 0;
    const addCoin = () => { if (coinsIn >= 30) return; const c = new THREE.Mesh(coinGeo, coinsIn % 3 ? coinMat : silver); const k = coinsIn++; c.position.set(-0.2 + (k % 8) * 0.057, Math.floor(k / 8) * 0.013, ((k * 7) % 3 - 1) * 0.02); cup.add(c); };
    for (let i = 0; i < 5; i++) addCoin();
    const addBill = d => { const sl = slots.find(x => x.d === d); if (!sl || sl.n >= 14) return; const b = new THREE.Mesh(billGeo, sl.m); b.position.y = sl.n * 0.007; b.rotation.y = Math.sin(sl.n * 2.3) * 0.08; sl.g.add(b); sl.n++; };
    // Money in the air: bills flutter, coins spin, each lands in its slot.
    const flying = [];
    const split = total => { const out = []; let left = Math.max(0, Math.round(total)); for (const d of DENOMS) while (left >= d && out.length < 12) { out.push(d); left -= d; } return out; };
    group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.userData.baseMats = [m.material]; m.userData.styled = true; } });
    let open = 0, want = 0, wob = 0, shown = '';
    const draw = text => { if (text === shown) return; shown = text; sx.fillStyle = '#14302b'; sx.fillRect(0, 0, 256, 96); sx.fillStyle = '#7dffb0'; sx.font = 'bold 64px ui-monospace, monospace'; sx.textAlign = 'right'; sx.textBaseline = 'middle'; sx.fillText(text, 240, 52); screenTex.needsUpdate = true; };
    draw('0');
    return {
      group, keys,
      display: draw,
      open() { want = 1; wob = 1; }, close() { want = 0; wob = 0.6; },
      press(i) { const k = keys[i % keys.length]; k.position.y -= 0.015; setTimeout(() => { k.position.y += 0.015; }, 90); },
      get isOpen() { return want === 1; },
      drawerWorld() { return drawer.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0.25)); },
      // The guest's money flies from `from` (world) into the open drawer: bills to their slots, the rest as coins.
      // onLand(kind) fires as each piece lands. Returns the pieces in the order they fly.
      pay(total, from, onLand) {
        const pieces = split(total);
        pieces.forEach((d, i) => {
          const isCoin = d === 1;
          const m = isCoin ? new THREE.Mesh(coinGeo, coinMat) : new THREE.Mesh(billGeo, slots.find(x => x.d === d).m);
          m.castShadow = true; m.position.copy(from); m.scale.setScalar(1.4); world.add(m);
          flying.push({ m, d, isCoin, t: -i * 0.07, from: from.clone(), spin: (i % 2 ? 1 : -1) * (6 + i), onLand });
        });
        return pieces;
      },
      reset() { for (const sl of slots) { while (sl.g.children.length > 2) sl.g.remove(sl.g.children.at(-1)); sl.n = 2; } while (cup.children.length > 5) cup.remove(cup.children.at(-1)); coinsIn = Math.min(coinsIn, 5); },
      step(dt) {
        open += (want - open) * Math.min(1, dt * (want ? 14 : 18)); drawer.position.z = 0.02 + open * 0.3; wob = Math.max(0, wob - dt * 2.5); group.scale.set(1 + Math.sin(wob * 20) * wob * 0.04, 1 - Math.sin(wob * 20) * wob * 0.05, 1); bell.rotation.z = Math.sin(wob * 30) * wob * 0.5;
        for (let i = flying.length - 1; i >= 0; i--) {
          const f = flying[i]; f.t += dt; if (f.t < 0) { f.m.visible = false; continue; } f.m.visible = true;
          const k = Math.min(1, f.t / 0.45), to = drawer.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, f.isCoin ? 0.17 : 0));
          f.m.position.lerpVectors(f.from, to, k); f.m.position.y += Math.sin(k * Math.PI) * 0.35;
          if (f.isCoin) { f.m.rotation.x = f.t * f.spin; } else { f.m.rotation.set(Math.sin(f.t * 14) * 0.5 * (1 - k), group.rotation.y + Math.sin(f.t * 9) * 0.6 * (1 - k), Math.cos(f.t * 11) * 0.4 * (1 - k)); }
          f.m.scale.setScalar(1.4 - 0.4 * k);
          if (k >= 1) { world.remove(f.m); flying.splice(i, 1); if (f.isCoin) addCoin(); else addBill(f.d); f.onLand?.(f.isCoin ? 'coin' : 'bill'); }
        }
      },
    };
  }
  function makeSign() {
    const group = new THREE.Group();
    const board = new THREE.Mesh(roundedBox(2.2, 0.5, 0.08, 0.08), mat('#fff7ea')); group.add(board);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112; const cx = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.45), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); face.position.z = 0.12; group.add(face); face.userData.noOutline = true;
    board.userData.baseMats = [board.material]; board.userData.styled = true;
    let tier = -1, wob = 0;
    return { group, set(t) { if (t === tier) return; if (tier >= 0) wob = 1; tier = t; cx.clearRect(0, 0, 512, 112); cx.font = '900 54px ui-rounded, "Arial Rounded MT Bold", sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineWidth = 8; cx.strokeStyle = '#2b1d14'; cx.fillStyle = '#ff7a45'; cx.strokeText('SKY KITCHEN', 256, 46); cx.fillText('SKY KITCHEN', 256, 46); cx.font = '40px sans-serif'; cx.fillStyle = '#ffc531'; cx.fillText('★'.repeat(Math.min(5, t)) + '☆'.repeat(Math.max(0, 5 - t)) + '☾'.repeat(Math.max(0, t - 5)), 256, 92); tex.needsUpdate = true; },
      step(dt, time) { wob = Math.max(0, wob - dt); group.rotation.z = Math.sin(time * 1.3) * 0.02 + Math.sin(wob * 25) * wob * 0.12; group.scale.setScalar(1 + wob * 0.25); } };
  }
  function makeBubble() {
    const group = new THREE.Group();
    const cv = document.createElement('canvas'); cv.width = cv.height = 192; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })); sp.scale.set(0.55, 0.55, 1); sp.renderOrder = 10; group.add(sp);
    const cx = cv.getContext('2d');
    return { group, async show(url, mood = 'want') {
      cx.clearRect(0, 0, 192, 192); cx.fillStyle = '#fff'; cx.strokeStyle = '#2b1d14'; cx.lineWidth = 8;
      cx.beginPath(); cx.roundRect(10, 10, 172, 140, 40); cx.moveTo(80, 148); cx.lineTo(96, 182); cx.lineTo(112, 148); cx.fill(); cx.stroke();
      cx.fillStyle = '#fff'; cx.fillRect(84, 140, 24, 12);
      const glyph = { happy: '♥', angry: '💢', picky: '🧐', sneaky: '👀', rude: '😤', dizzy: '💫', cold: '🥶', sorry: '😇' }[mood];
      if (glyph) { cx.font = '96px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#ff5d8f'; cx.fillText(glyph, 96, 84); }
      else if (url) { const img = new Image(); img.src = url; await img.decode().catch(() => {}); cx.drawImage(img, 36, 20, 120, 120); }
      tex.needsUpdate = true; group.visible = true; group.scale.setScalar(0.01); const t0 = performance.now();
      const grow = () => { const k = Math.min(1, (performance.now() - t0) / 350); group.scale.setScalar(Math.max(0.01, elasticOut(k))); if (k < 1) requestAnimationFrame(grow); }; grow();
    }, hide() { group.visible = false; }, dispose() { tex.dispose(); sp.material.dispose(); } };
  }
  function makeIsland(x, y, z, s) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.userData.y = y; g.scale.setScalar(s);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 7), mat('#b98a64')); rock.rotation.x = Math.PI; rock.position.y = -0.45; g.add(rock);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.6, 0.14, 7), mat('#7cc95a')); g.add(grass);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 6), mat('#8a5a3a')); trunk.position.y = 0.25; g.add(trunk);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat('#4fae4f')); leaves.position.y = 0.55; g.add(leaves);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(['#ff5a4a', '#ffb347', '#ffe066'][i])); f.position.set(Math.cos(i * 2.1) * 0.24, 0.5, Math.sin(i * 2.1) * 0.24); g.add(f); }
    g.traverse(m => { if (m.isMesh) { m.userData.baseMats = [m.material]; m.userData.styled = true; } });
    return g;
  }
}

// A potato: a lumpy brown stone with eyes. The food kit has none.
function makePotato() {
  const geo = new THREE.IcosahedronGeometry(0.1, 2); const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + 0.12 * Math.sin(v.x * 40) * Math.cos(v.y * 33) + 0.08 * Math.sin(v.z * 51); v.multiplyScalar(n); v.x *= 1.35; p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const g = new THREE.Group(); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#c8955a', roughness: 0.9, flatShading: true })); g.add(m);
  for (let i = 0; i < 6; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), new THREE.MeshStandardMaterial({ color: '#7a5230' })); const a = i * 1.7, b = i * 0.9; e.position.set(Math.cos(a) * 0.12, Math.sin(b) * 0.07, Math.sin(a) * 0.09); g.add(e); }
  return g;
}
function mat(c, rough = 0.6, metal = 0) { return new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }); }
function roundedBox(w, h, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: Math.min(r, h / 3), bevelSize: Math.min(r, h / 3) * 0.8, bevelSegments: 3 });
  g.rotateX(-Math.PI / 2); g.translate(0, -h / 2, 0); g.computeVertexNormals(); return g;
}
function checker(a, b) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = a; c.fillRect(0, 0, 128, 128); c.fillStyle = b; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function angleTo(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
export function elasticOut(t) { return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1; }
