export const WORLD = Object.freeze({ width: 360, height: 520 });
export const LIMIT_LEVEL = 10;
export const GATE = Object.freeze({ x: 180, y: 118, width: 86 });
export const PEN = Object.freeze({ left: 106, right: 254, top: 38, bottom: GATE.y });
export const FIELD_BOTTOM = 500;
export const HOME_POINTS = 25;
export const RESCUE_POINTS = 2500;
export const HAZARD_TIME = 1.15;

const TICK = 1 / 60;
const TAU = Math.PI * 2;
const DOG_SPEED = 188;
const FIRST_DRIVE_SPEED = 42;
const DOG_BANK_REACH = 25;

const TYPES = {
  ewe: { speed: 43, radius: 82, pressure: 83, response: 5.6, drift: 3, size: 1 },
  lamb: { speed: 31, radius: 73, pressure: 59, response: 3.8, drift: 4, size: 0.74 },
  ram: { speed: 41, radius: 57, pressure: 110, response: 4.6, drift: 2, size: 1.15 }
};

// Each pair after the head counts is a flock centre. The left and right
// groups require a different approach even with the same animals.
const LEVELS = [
  { flock: [[12, 180, 347, 28]], lambs: 0, limit: 50 },
  { flock: [[13, 155, 357, 40], [3, 217, 405, 17]], lambs: 4, limit: 62 },
  { flock: [[15, 197, 350, 43], [5, 111, 375, 19]], lambs: 4, limit: 65 },
  { flock: [[16, 180, 349, 44], [8, 251, 400, 27]], lambs: 5, limit: 71, eyes: 8 },
  { flock: [[13, 121, 313, 33], [14, 234, 374, 34], [1, 95, 442, 0]], lambs: 6, limit: 77, eyes: 11 },
  { flock: [[12, 267, 313, 24], [18, 158, 377, 43], [4, 91, 426, 20]], lambs: 7, limit: 83, eyes: 9 },
  { flock: [[17, 122, 294, 38], [18, 233, 363, 39], [5, 178, 448, 23]], lambs: 8, limit: 89, eyes: 9 },
  { flock: [[18, 124, 278, 41], [20, 221, 351, 46], [8, 264, 424, 25]], lambs: 10, limit: 94, eyes: 7 },
  { flock: [[25, 135, 317, 46], [19, 241, 352, 42], [8, 111, 434, 25]], lambs: 12, limit: 100, eyes: 7 },
  { flock: [[25, 130, 286, 48], [25, 231, 365, 49], [10, 167, 451, 27]], lambs: 14, limit: 105, eyes: 7 }
];

export function leftEdge(y) {
  return 53 + 7 * Math.sin(y * 0.023) + 6 * Math.sin(y * 0.044 + 1.3);
}

export function rightEdge(y) {
  return 307 + 10 * Math.sin(y * 0.018 + 1.5) + 5 * Math.sin(y * 0.039);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function randomFrom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function endless(wave, random) {
  const count = Math.min(60, 32 + (wave - 1) * 4);
  const left = Math.floor(count * 0.38);
  const right = Math.floor(count * 0.40);
  return {
    flock: [
      [left, 109 + random() * 44, 272 + random() * 48, 37],
      [right, 207 + random() * 46, 324 + random() * 52, 40],
      [count - left - right, 98 + random() * 165, 414 + random() * 31, 27]
    ],
    lambs: Math.floor(count / 4),
    limit: Math.min(106, 84 + wave * 3),
    eyes: Math.max(5, 11 - wave)
  };
}

export function createGame(level = 1, seed = 1) {
  level = Number.isFinite(level) ? Math.max(1, Math.trunc(level)) : 1;
  seed = Number(seed) >>> 0;
  const random = randomFrom(seed ^ Math.imul(level, 0x9E3779B1));
  const wave = Math.max(0, level - LIMIT_LEVEL);
  const rules = wave ? endless(wave, random) : LEVELS[level - 1];
  const sheep = [];
  const rotation = random() * TAU;

  for (const [count, x, y, spread] of rules.flock) {
    for (let i = 0; i < count; i++) {
      const phase = i * 2.399963 + rotation + (random() - 0.5) * 0.25;
      const radius = Math.sqrt((i + 0.3) / count) * spread;
      const sy = y + Math.sin(phase) * radius;
      const sx = clamp(x + Math.cos(phase) * radius, leftEdge(sy) + 15, rightEdge(sy) - 15);
      sheep.push({
        id: sheep.length, x: sx, y: sy, vx: 0, vy: 0, angle: -Math.PI / 2,
        kind: 'ewe', status: 'field', stray: count === 1, rescued: false,
        phase: random() * TAU, isolatedFor: 0, hazardFor: 0, panic: 0
      });
    }
  }

  // Give the rearmost animals a slight bias toward lambs so they visibly lag.
  const byAge = sheep.map(animal => ({ animal, position: animal.y + random() * 105 }));
  byAge.sort((a, b) => b.position - a.position);
  for (const { animal } of byAge.slice(0, rules.lambs)) animal.kind = 'lamb';
  if (level >= 3) {
    const ramIndex = Math.floor((byAge.length + rules.lambs) / 2);
    byAge[ramIndex].animal.kind = 'ram';
  }

  return {
    level, wave, seed, status: 'play', started: false, time: 0, limit: rules.limit,
    dog: { x: 180, y: 414, vx: 0, vy: 0, angle: -Math.PI / 2 },
    gate: GATE, pen: PEN, sheep, wolf: null, home: 0, lost: 0, rescued: 0, score: 0,
    required: sheep.length, accumulator: 0,
    nextWolf: rules.eyes ? rules.eyes + random() * 2 : Infinity,
    wolfCount: 0, wolfOffset: random() * TAU
  };
}

function moveDog(game, target) {
  const { dog } = game;
  const dx = (target?.x ?? dog.x) - dog.x;
  const dy = (target?.y ?? dog.y) - dog.y;
  const distance = Math.hypot(dx, dy);
  // On the first evening the dog approaches slowly when driving uphill.
  // It can still run around the flock and cross the field.
  const driving = game.level === 1 && dy < 0 && Math.abs(dx) < Math.min(44, -dy * 0.7) &&
    game.sheep.some(animal => animal.status === 'field' && animal.y < dog.y && Math.abs(animal.x - dog.x) < 75);
  const speed = driving ? FIRST_DRIVE_SPEED : DOG_SPEED;
  const part = distance > 0 ? Math.min(1, speed * TICK / distance) : 0;
  const y = clamp(dog.y + dy * part, GATE.y + 8, FIELD_BOTTOM + 2);
  const x = clamp(dog.x + dx * part, leftEdge(y) - DOG_BANK_REACH, rightEdge(y) + DOG_BANK_REACH);
  dog.vx = (x - dog.x) / TICK;
  dog.vy = (y - dog.y) / TICK;
  dog.x = x;
  dog.y = y;
  if (Math.abs(dog.vx) + Math.abs(dog.vy) > 1) dog.angle = Math.atan2(dog.vy, dog.vx);
}

function moveWolf(game) {
  const { dog, time } = game;
  let wolf = game.wolf;
  if (!wolf && time >= game.nextWolf) {
    const y = 290 + Math.sin(game.wolfOffset + game.wolfCount * 2.4) * 67;
    wolf = { x: leftEdge(y) - 12, y, phase: 'eyes', active: false, age: 0, angle: 0, pathY: y };
    game.wolf = wolf;
    game.wolfCount++;
  }
  if (!wolf) return;

  wolf.age += TICK;
  if (wolf.phase === 'eyes') {
    if (wolf.age >= 2.3) {
      wolf.phase = 'run';
      wolf.active = true;
      wolf.age = 0;
    }
    return;
  }

  if (wolf.phase === 'run') {
    if (Math.hypot(dog.x - wolf.x, dog.y - wolf.y) < 43 || wolf.age >= 4.0) {
      wolf.phase = 'leave';
      wolf.active = false;
      wolf.age = 0;
      wolf.angle = Math.PI;
    } else {
      wolf.x += (game.level >= 8 ? 51 : 43) * TICK;
      const nextY = wolf.pathY + 29 * Math.sin(wolf.age);
      wolf.angle = Math.atan2(nextY - wolf.y, 43 * TICK);
      wolf.y = nextY;
    }
    return;
  }

  wolf.x -= 94 * TICK;
  if (wolf.x <= leftEdge(wolf.y) - 19) {
    game.wolf = null;
    game.nextWolf = time + Math.max(9, 23 - game.level * 0.85);
  }
}

function enterPen(game, animal) {
  const row = Math.floor(game.home / 12);
  const column = game.home % 12;
  animal.x = PEN.left + 13 + column * 11 + (row % 2) * 3;
  animal.y = PEN.bottom - 15 - row * 12;
  animal.angle = -Math.PI / 2;
  animal.status = 'home';
  animal.homeAt = game.time;
  animal.vx = 0;
  animal.vy = 0;
  game.home++;
  game.score += HOME_POINTS;
  if (animal.stray) {
    animal.rescued = true;
    game.rescued++;
    game.score += RESCUE_POINTS;
  }
}

function loseSheep(game, animal) {
  animal.status = 'lost';
  animal.lostTo = animal.x < leftEdge(animal.y) ? 'woods' : 'stream';
  animal.lostAt = game.time;
  animal.vx = 0;
  animal.vy = 0;
  game.lost++;
}

function guideSheep(game, field, index, out) {
  const animal = field[index];
  const { x, y, kind, phase } = animal;
  const type = TYPES[kind];
  let vx = Math.sin(game.time * 0.57 + phase) * type.drift;
  let vy = Math.cos(game.time * 0.72 + phase) * type.drift;
  let groupX = 0;
  let groupY = 0;
  let alignX = 0;
  let alignY = 0;
  let neighbours = 0;
  let near = false;

  for (let j = 0; j < field.length; j++) {
    if (j === index) continue;
    const other = field[j];
    const dx = other.x - x;
    const dy = other.y - y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= 67 * 67) continue;
    groupX += dx;
    groupY += dy;
    alignX += other.vx;
    alignY += other.vy;
    neighbours++;
    if (distanceSquared < 50 * 50) near = true;
    const spacing = 8 + type.size * 5;
    if (distanceSquared < spacing * spacing) {
      const distance = Math.sqrt(distanceSquared);
      if (distance > 0.001) {
        const force = (spacing - distance) * 4 / distance;
        vx -= dx * force;
        vy -= dy * force;
      } else {
        vx += animal.id < other.id ? -12 : 12;
      }
    }
  }

  const { dog, wolf } = game;
  const dogX = x - dog.x;
  const dogY = y - dog.y;
  const dogDistance = Math.hypot(dogX, dogY);
  const underPressure = dogDistance < type.radius;
  if (underPressure && dogDistance > 0.001) {
    const force = type.pressure * (1 - dogDistance / type.radius) / dogDistance;
    // The first flock follows the straight drive with less lateral spread.
    vx += dogX * force * (game.level === 1 && dogY < 0 ? 0.15 : 1);
    vy += dogY * force;
  }

  if (wolf?.active) {
    const dx = x - wolf.x;
    const dy = y - wolf.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 87 && distance > 0.001) {
      const force = 160 * (1 - distance / 87) / distance;
      vx += dx * force;
      vy += dy * force;
      animal.panic = Math.max(animal.panic, 1 - distance / 87);
    }
  }
  animal.panic = Math.max(0, animal.panic - TICK * 0.7);

  if (neighbours) {
    const cohesion = game.level === 1 ? 0.95 : animal.panic > 0 ? 0.10 : underPressure ? 0.29 : 0.35;
    vx += (groupX * cohesion + alignX * 0.16) / neighbours;
    vy += (groupY * cohesion + alignY * 0.16) / neighbours;
  }

  const left = leftEdge(y);
  const right = rightEdge(y);
  const edgeDistance = Math.min(x - left, right - x);
  if (edgeDistance < 15) {
    const bank = Math.min(12, (15 - edgeDistance) * 0.65);
    vx += x < WORLD.width / 2 ? bank : -bank;
  }
  if (y > FIELD_BOTTOM - 16) vy -= Math.min(12, (y - FIELD_BOTTOM + 16) * 0.85);

  const gateDx = game.gate.x - x;
  const gateDy = y - game.gate.y;
  const gateHalf = game.gate.width / 2;
  if (gateDy < 34 && Math.abs(gateDx) < gateHalf + 20) {
    vx += gateDx * (1 - gateDy / 34) * 0.60;
    if (Math.abs(gateDx) < gateHalf - 5) vy -= 22 * (1 - gateDy / 34);
  }

  // Mark an animal that has spent time separated from the flock or is
  // already on a bank. The mark stays with it until it comes home.
  animal.isolatedFor = near ? 0 : animal.isolatedFor + TICK;
  if ((animal.isolatedFor > 2.5 && y > GATE.y + 90) || edgeDistance < 2) animal.stray = true;

  const speed = Math.hypot(vx, vy);
  const topSpeed = type.speed + animal.panic * 24;
  if (speed > topSpeed) {
    vx *= topSpeed / speed;
    vy *= topSpeed / speed;
  }
  out.vx = animal.vx + (vx - animal.vx) * TICK * type.response;
  out.vy = animal.vy + (vy - animal.vy) * TICK * type.response;
}

function advanceSheep(game) {
  const field = game.sheep.filter(animal => animal.status === 'field');
  const velocities = field.map((_, index) => {
    const out = {};
    guideSheep(game, field, index, out);
    return out;
  });

  for (let i = 0; i < field.length; i++) {
    const animal = field[i];
    const { vx, vy } = velocities[i];
    animal.vx = vx;
    animal.vy = vy;
    animal.x += vx * TICK;
    animal.y = clamp(animal.y + vy * TICK, game.gate.y, FIELD_BOTTOM);
    if (Math.abs(vx) + Math.abs(vy) > 2) animal.angle = Math.atan2(vy, vx);

    if (animal.y <= game.gate.y) {
      if (Math.abs(animal.x - game.gate.x) < game.gate.width / 2 - 4) {
        enterPen(game, animal);
        continue;
      }
      animal.vy = Math.max(0, animal.vy);
    }
    const left = leftEdge(animal.y);
    const right = rightEdge(animal.y);
    if (animal.x < left || animal.x > right) {
      animal.hazardFor += TICK;
      if (animal.hazardFor >= HAZARD_TIME) loseSheep(game, animal);
      animal.x = clamp(animal.x, left - 21, right + 21);
    } else {
      animal.hazardFor = 0;
    }
  }
}

export function step(game, dt, target = null) {
  if (game.status !== 'play' || !Number.isFinite(dt) || dt <= 0) return game;
  if (target && (!Number.isFinite(target.x) || !Number.isFinite(target.y))) target = null;
  if (!game.started) {
    if (!target) return game;
    game.started = true;
  }

  game.accumulator += dt;
  while (game.accumulator + 1e-9 >= TICK && game.status === 'play') {
    game.accumulator -= TICK;
    game.time = Math.min(game.limit, game.time + TICK);
    moveDog(game, target);
    moveWolf(game);
    advanceSheep(game);
    if (game.home === game.sheep.length) game.status = 'won';
    else if (game.lost) game.status = 'lost';
    else if (game.time + 1e-9 >= game.limit) {
      game.time = game.limit;
      game.status = 'lost';
    }
  }
  return game;
}
