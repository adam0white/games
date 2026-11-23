/**
 * A scripted ceiling for the task episode, not a mind: it shows what 60 steps allow. During free time it rests.
 * In the task it carries the nearest cube that is not on the Spire toward the Spire, using `seen` only, looking
 * farther when the Spire or a cube is out of sight, and remembering the Spire's offset as it moves.
 */
import type { MindFactory, Observation } from '../types.ts';

const D: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

const scripted: MindFactory = () => {
  let spire: [number, number] | null = null;
  let lastMove: [number, number] | null = null;
  function toward(obs: Observation, dx: number, dy: number) {
    const dirs = Object.entries(D)
      .filter(
        ([, [x, y]]) =>
          (x !== 0 && Math.sign(x) === Math.sign(dx)) || (y !== 0 && Math.sign(y) === Math.sign(dy)),
      )
      .map(([d]) => d);
    for (const verb of ['move', 'jump'])
      for (const d of dirs) if (obs.actions.some((a) => a.id === `${verb} ${d}`)) return `${verb} ${d}`;
    const any = obs.actions.find((a) => a.kind === 'move');
    return any?.id ?? 'rest';
  }
  return {
    name: 'scripted',
    step(obs) {
      if (!obs.task) return { action: 'rest', why: 'free time: scripted ceiling rests' };
      if (lastMove && spire && obs.events.some((e) => /^You (walk|climb|jump|step)/i.test(e)))
        spire = [spire[0] - lastMove[0], spire[1] - lastMove[1]];
      lastMove = null;
      if (obs.seen.spire) spire = [obs.seen.spire.dx, obs.seen.spire.dy];
      if (obs.seen.here.onSpire) spire = [0, 0];
      const go = (id: string) => {
        const m = id.match(/^(move|jump) ([NSEW])$/);
        lastMove = m ? (D[m[2] as string] ?? null) : null;
        return { action: id };
      };
      const carrying = obs.seen.carrying;
      if (carrying?.startsWith('cube-')) {
        if (obs.seen.here.onSpire && obs.actions.some((a) => a.id === 'place here'))
          return { action: 'place here' };
        if (!spire) return { action: 'look' };
        for (const [d, [x, y]] of Object.entries(D))
          if (x === spire[0] && y === spire[1] && obs.actions.some((a) => a.id === `place ${d}`))
            return { action: `place ${d}` };
        return go(toward(obs, spire[0], spire[1]));
      }
      const onSpire = (t: { dx: number; dy: number }) =>
        spire !== null && t.dx === spire[0] && t.dy === spire[1];
      const cubes = obs.seen.things
        .filter((t) => t.kind === 'cube' && !onSpire(t))
        .sort((a, b) => Math.abs(a.dx) + Math.abs(a.dy) - Math.abs(b.dx) - Math.abs(b.dy));
      for (const c of cubes)
        if (obs.actions.some((a) => a.id === `pick ${c.id}`)) return { action: `pick ${c.id}` };
      const c = cubes[0];
      if (!c) return { action: 'look' };
      return go(toward(obs, c.dx, c.dy));
    },
    endEpisode() {
      return '';
    },
  };
};

export default scripted;
