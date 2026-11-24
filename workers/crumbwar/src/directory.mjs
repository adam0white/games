// One per region. It answers one question: which room should the next person join? Rooms tell it how many
// people they hold. It keeps nothing on disk: if it restarts it knows no rooms, sends the next person to room
// 0, and every running room reports again within 15 seconds. A wrong answer costs one retry, because a full
// room refuses the join and the Worker asks again with that room excluded.
import { DurableObject } from 'cloudflare:workers';
import { assign } from './assign.mjs';

export class Directory extends DurableObject {
  rooms = new Map();
  // The object named 'alerts' also keeps the short list of things a person should hear about (a room that was
  // lost, a room that ran slow). This is the only thing Crumbwar stores, and it names rooms, never players.
  alert(kind, room, test, detail) {
    const sql = this.ctx.storage.sql, now = Date.now();
    sql.exec('CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, kind TEXT, room TEXT, test INTEGER, detail TEXT)');
    sql.exec('INSERT INTO alerts (at, kind, room, test, detail) VALUES (?, ?, ?, ?, ?)', now, String(kind).slice(0, 40), String(room).slice(0, 40), test ? 1 : 0, String(detail).slice(0, 400));
    sql.exec('DELETE FROM alerts WHERE at < ?', now - 14 * 86400_000);
  }
  alerts(since, tests) {
    const sql = this.ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, kind TEXT, room TEXT, test INTEGER, detail TEXT)');
    return sql.exec('SELECT id, at, kind, room, test, detail FROM alerts WHERE at >= ? AND (test = 0 OR ?) ORDER BY id DESC LIMIT 100', Number(since) || 0, tests ? 1 : 0).toArray();
  }
  assign(prefix, cap, exclude) { return assign(this.rooms, prefix, cap, exclude, Date.now()); }
  report(name, people) {
    if (people <= 0) { this.rooms.delete(name); return; }
    const r = this.rooms.get(name);
    if (r) { r.people = people; r.at = Date.now(); } else this.rooms.set(name, { people, at: Date.now(), pending: [] });
  }
  list() { return [...this.rooms].map(([name, r]) => ({ name, people: r.people, pending: r.pending.length, age: Date.now() - r.at })); }
}
