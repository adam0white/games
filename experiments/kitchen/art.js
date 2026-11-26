// Sky Kitchen: the 3D view. Models from Kenney (CC0, models/), three.js (MIT, vendor/).
// One scene: the counter with its stations, the dining room in front, sky above the back wall.
// The page asks for views (catch, chop, fry, micro, blend, serve, room) and this file moves the camera there.
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone as cloneSkinned } from './vendor/SkeletonUtils.js';

export { THREE };
const FS = 2.2;            // furniture kit to world
export const TOP = 1.0;    // counter top height
export const LANE = { y0: 1.22, h: 1.42, z: 0.62, s: 1 };   // catch lane to world: x*s, y0 + y*h

// ---------- looks: 2-4 variants for the owner to pick
export const LOOKS = {
  diner: { sky: ['#8fd3ff', '#fff1d6'], wall: '#ffcf9e', trim: '#ff8a5c', floor: ['#fff4e0', '#ffd8b0'], amb: 1.25, sun: 2.4, sunColor: '#fff2dc', toon: false, outline: false, fog: '#ffe6cc', exposure: 1.0, lamps: false, sat: 1 },
  toon: { sky: ['#5ec8ff', '#d8f6ff'], wall: '#ffe066', trim: '#ff5d8f', floor: ['#ffffff', '#a8e6ff'], amb: 1.5, sun: 2.2, sunColor: '#ffffff', toon: true, outline: true, fog: '#d8f6ff', exposure: 1.0, lamps: false, sat: 1.15 },
  night: { sky: ['#1b1440', '#7a3d8c'], wall: '#4b3a6b', trim: '#ffb347', floor: ['#3b2f52', '#2a2140'], amb: 0.55, sun: 0.5, sunColor: '#9fb4ff', toon: false, outline: false, fog: '#2a1f45', exposure: 1.15, lamps: true, sat: 1 },
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
  const sideR = sideL.clone(); sideR.position.x = 4.5; world.add(sideR);

  // Counter: cabinets with the stove in the row.
  const counter = new THREE.Group(); world.add(counter);
  const slots = [-2.85, -1.9, -0.95, 0, 0.95, 1.9, 2.85];
  const stove = furniture('kitchenStove'); stove.position.set(-1.9, 0, 0); counter.add(stove);
  for (const x of slots) { if (x === -1.9) continue; const c = furniture('kitchenCabinet'); c.position.set(x, 0, 0); counter.add(c); }
  const topMat = new THREE.MeshStandardMaterial({ color: '#f7f2ea', roughness: 0.4 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.06, 1.12), topMat); top.position.set(0, TOP - 0.02, 0); top.receiveShadow = true; counter.add(top);
  for (const x of [-2.85, -0.95, 0.95, 2.85]) { const u = furniture('kitchenCabinetUpper'); u.position.set(x, 1.55, -0.72); counter.add(u); }
  const fridge = furniture('kitchenFridge'); fridge.position.set(-3.9, 0, -0.3); world.add(fridge);
  const hood = furniture('hoodModern'); hood.position.set(-1.9, 1.62, -0.6); world.add(hood);

  // Stations on the counter.
  const board = item('cutting-board', 0.9); board.rotation.y = Math.PI / 2; board.position.set(0, TOP, 0.1); world.add(board);
  const knife = item('cooking-knife', 0.62); knife.position.set(0.55, TOP + 0.02, 0.32); knife.rotation.y = -0.4; world.add(knife);
  const pan = item('frying-pan', 0.75); pan.position.set(-1.9, TOP + 0.02, 0.1); pan.rotation.y = Math.PI * 0.75; world.add(pan);
  const panGlow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: '#ff5a1f', transparent: true, opacity: 0 })); panGlow.rotation.x = -Math.PI / 2; panGlow.position.set(-1.9, TOP + 0.03, 0.05); world.add(panGlow);
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
  async function guest(i) {
    await peopleReady;
    const src = people[i % people.length] ?? people.find(Boolean); if (!src) return null;
    const body = cloneSkinned(src.scene); styleObject(body); track(body);
    const g = fit(body, 1.25, 'y'); g.position.set(5.2, 0, 1.2); world.add(g);
    const mixer = new THREE.AnimationMixer(body), acts = {};
    for (const clip of src.animations) acts[clip.name] = mixer.clipAction(clip);
    let cur = null;
    const play = (name, once = false) => { const a = acts[name]; if (!a || a === cur) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.fadeIn(0.2).play(); cur?.fadeOut(0.2); cur = a; };
    const bubble = makeBubble(); bubble.group.position.set(0, 1.55, 0); g.add(bubble.group); bubble.group.visible = false;
    const me = { g, mixer, play, bubble, target: null, speed: 1.6, onArrive: null, face: null };
    play('walk'); guests.push(me); return me;
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
      if (me.gone) { world.remove(me.g); guests.splice(i, 1); }
    }
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
    menu: { at: [0.6, 1.5, 0.6], half: [2.0, 1.3], dir: [-0.25, 0.35, 1] },
  };
  const cam = { pos: new THREE.Vector3(0, 3, 9), at: new THREE.Vector3(0, 1, 0), wantPos: new THREE.Vector3(), wantAt: new THREE.Vector3(), name: 'menu', shake: 0, orbit: 0, bias: 0 };
  let W = 1, H = 1;
  function framing(name) {
    const v = VIEWS[name], fovY = THREE.MathUtils.degToRad(camera.fov) / 2, aspect = W / H;
    const dist = Math.max(v.half[1] / Math.tan(fovY), v.half[0] / (Math.tan(fovY) * aspect)) * 1.04;
    const dir = new THREE.Vector3(...v.dir).normalize();
    const at = new THREE.Vector3(...v.at);
    // A tall phone gets room above and below; keep the subject a little high so the ticket and gauge sit under it.
    if (name !== 'catch' && aspect < 0.8) at.y -= v.half[0] / aspect * 0.18 * (name === 'room' || name === 'menu' ? 0.4 : 1);
    if (name === 'catch') {
      // The lane fills the screen whatever its shape: the tray a quarter up from the bottom, items from near the top.
      const visH = Math.max(2 * v.half[1], 2 * v.half[0] / aspect) * 1.04;
      LANE.h = visH * 0.6 / 1.15; at.y = LANE.y0 + visH * 0.2;
      const d = Math.max(v.half[1], v.half[0] / aspect) * 1.04 / Math.tan(fovY);
      return { pos: at.clone().addScaledVector(dir, d), at };
    }
    return { pos: at.clone().addScaledVector(dir, dist), at };
  }
  function view(name, instant = false) { cam.name = name; const f = framing(name); cam.wantPos.copy(f.pos); cam.wantAt.copy(f.at); if (instant) { cam.pos.copy(f.pos); cam.at.copy(f.at); } }
  function resize() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
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
  function frame(dt) {
    clock.t += dt; skyMat.uniforms.t.value = clock.t;
    const k = 1 - Math.pow(0.0025, dt);
    cam.pos.lerp(cam.wantPos, k); cam.at.lerp(cam.wantAt, k);
    camera.position.copy(cam.pos);
    if (cam.name === 'room' || cam.name === 'menu') { cam.orbit += dt * 0.12; const r = 0.35; camera.position.x += Math.sin(cam.orbit) * r; }
    if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 3); camera.position.x += (Math.random() - 0.5) * cam.shake * 0.08; camera.position.y += (Math.random() - 0.5) * cam.shake * 0.08; }
    camera.lookAt(cam.at);
    stepGuests(dt); stepParts(dt); register.step(dt); tray.step(dt); sign.step(dt, clock.t);
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; const e = elasticOut(Math.min(1, p.t / 0.7)); p.o.scale.copy(p.s).multiplyScalar(Math.max(0.01, e)); if (p.t >= 0.7) { p.o.scale.copy(p.s); pops.splice(i, 1); } }
    islands.children.forEach((g, i) => { g.position.y = g.userData.y + Math.sin(clock.t * 0.6 + i) * 0.08; g.rotation.y += dt * 0.05; });
    for (const [i, b] of bulbs.children.entries()) b.material.color.offsetHSL(0, 0, Math.sin(clock.t * 3 + i) * 0.002);
    renderer.render(scene, camera);
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
    THREE, scene, camera, renderer, world, food, item, furniture, tray, register, board, knife, pan, panGlow, micro, microLight, microGlass, blender, sign,
    guest, walkTo, guests, view, cam, frame, resize, burst, steam, toScreen, toPlane, toY, setLook, setRestaurant, thumb, popIn,
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
    return {
      group, load,
      setLevel(l) { const half = [0, 0.27, 0.31, 0.35, 0.39, 0.43, 0.47][Math.min(6, l)]; width = half * 2 * LANE.s + 0.1; body.scale.set(width, 1, 1); rims.forEach((r, i) => { if (i >= 2) r.position.x = (i === 2 ? -1 : 1) * 0.52 * width; r.scale.x = i < 2 ? 1 : 1 / width; }); },
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
    const cash = [];
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 16), gold); c.position.set(-0.18 + i * 0.12, 0.1, 0.05); drawer.add(c); cash.push(c); }
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
      step(dt) { open += (want - open) * Math.min(1, dt * (want ? 14 : 18)); drawer.position.z = 0.02 + open * 0.3; wob = Math.max(0, wob - dt * 2.5); group.scale.set(1 + Math.sin(wob * 20) * wob * 0.04, 1 - Math.sin(wob * 20) * wob * 0.05, 1); bell.rotation.z = Math.sin(wob * 30) * wob * 0.5; },
    };
  }
  function makeSign() {
    const group = new THREE.Group();
    const board = new THREE.Mesh(roundedBox(2.2, 0.5, 0.08, 0.08), mat('#fff7ea')); group.add(board);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112; const cx = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.45), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); face.position.z = 0.12; group.add(face); face.userData.noOutline = true;
    board.userData.baseMats = [board.material]; board.userData.styled = true;
    let tier = -1, wob = 0;
    return { group, set(t) { if (t === tier) return; if (tier >= 0) wob = 1; tier = t; cx.clearRect(0, 0, 512, 112); cx.font = '900 54px ui-rounded, "Arial Rounded MT Bold", sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineWidth = 8; cx.strokeStyle = '#2b1d14'; cx.fillStyle = '#ff7a45'; cx.strokeText('SKY KITCHEN', 256, 46); cx.fillText('SKY KITCHEN', 256, 46); cx.font = '40px sans-serif'; cx.fillStyle = '#ffc531'; cx.fillText('★'.repeat(t) + '☆'.repeat(5 - t), 256, 92); tex.needsUpdate = true; },
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
      if (mood === 'happy') { cx.font = '96px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#ff5d8f'; cx.fillText('♥', 96, 84); }
      else if (url) { const img = new Image(); img.src = url; await img.decode().catch(() => {}); cx.drawImage(img, 36, 20, 120, 120); }
      tex.needsUpdate = true; group.visible = true; group.scale.setScalar(0.01); const t0 = performance.now();
      const grow = () => { const k = Math.min(1, (performance.now() - t0) / 350); group.scale.setScalar(Math.max(0.01, elasticOut(k))); if (k < 1) requestAnimationFrame(grow); }; grow();
    }, hide() { group.visible = false; } };
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
