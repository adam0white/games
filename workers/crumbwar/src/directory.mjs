// One per region. It answers one question: which room should the next person join? Rooms tell it how many
// people they hold. It keeps nothing on disk: if it restarts it knows no rooms, sends the next person to room
// 0, and every running room reports again within 15 seconds. A wrong answer costs one retry, because a full
// room refuses the join and the Worker asks again with that room excluded.
import { DurableObject } from 'cloudflare:workers';
import { assign } from './assign.mjs';

export class Directory extends DurableObject {
  rooms = new Map();
  assign(prefix, cap, exclude) { return assign(this.rooms, prefix, cap, exclude, Date.now()); }
  report(name, people) {
    if (people <= 0) { this.rooms.delete(name); return; }
    const r = this.rooms.get(name);
    if (r) { r.people = people; r.at = Date.now(); } else this.rooms.set(name, { people, at: Date.now(), pending: [] });
  }
  list() { return [...this.rooms].map(([name, r]) => ({ name, people: r.people, pending: r.pending.length, age: Date.now() - r.at })); }
}
