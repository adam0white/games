// A minimal Durable Object harness for spikes S1 and S2 under workerd (`wrangler dev`, local only).
// Never deployed; spikes/workerd.mjs writes a throwaway wrangler config outside the repository.
// One room object holds a sim in memory:
//   POST /new    { cfg, commands, ticks }  builds the sim and queues the commands
//   POST /step   { ticks }                 runs that many ticks; the client times the request
//   POST /replay { cfg, commands, ticks, every }  a whole replay, returns the hash records (S2)
// Clocks do not advance during computation in workerd, so all timing is measured by the client.
import { DurableObject } from 'cloudflare:workers';
import { Sim, encodeCommand } from '../../sim/sim.js';
import { replay } from '../../sim/replay.js';

export class Room extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url), body = request.method === 'POST' ? await request.json() : {};
    if (url.pathname === '/new') {
      this.sim = new Sim(body.cfg);
      for (const c of body.commands) this.sim.queueCommand(encodeCommand(c));
      return Response.json({ n: this.sim.n });
    }
    if (url.pathname === '/step') {
      for (let k = 0; k < body.ticks; k++) this.sim.step();
      return Response.json({ tick: this.sim.tick });
    }
    if (url.pathname === '/replay') return Response.json(replay(body).records);
    return new Response('not found', { status: 404 });
  }
}

export default {
  fetch(request, env) { return env.ROOM.get(env.ROOM.idFromName('spike')).fetch(request); },
};
