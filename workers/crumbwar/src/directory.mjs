// One per region. It answers one question: which room should the next person join? Rooms tell it how many
// people they hold and which protocol they run. The room list is memory only: if it restarts it knows no rooms,
// sends the next person to room 0, and every running room reports again within 15 seconds. A wrong answer costs
// one retry, because a full room (or a room of another protocol) refuses the join and the Worker asks again with
// that room excluded.
// It also keeps hourly totals for its region on disk (14 days), fed by the rooms' once-a-minute reports and by the
// Worker's batched refusal counts. The object `dir:lt` holds load test totals only and never has rooms.
import { DurableObject } from 'cloudflare:workers';
import { assign } from './assign.mjs';
import { PROTO } from '../public/crumbwar/shared/config.js';
import { fold, hourOf, isPeak, HOUR, KEEP_HOURS } from './metrics.mjs';

const FRESH = 45_000;

export class Directory extends DurableObject {
  rooms = new Map();
  peak = { hour: 0, peakPeople: 0, peakRoom: 0 };
  // The object named 'alerts' also keeps the short list of things a person should hear about (a room that was
  // lost, a room that ran slow). It names rooms, never players.
  alert(kind, room, test, detail) {
    const sql = this.ctx.storage.sql, now = Date.now();
    sql.exec('CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, kind TEXT, room TEXT, test INTEGER, detail TEXT)');
    sql.exec('INSERT INTO alerts (at, kind, room, test, detail) VALUES (?, ?, ?, ?, ?)', now, String(kind).slice(0, 40), String(room).slice(0, 40), test ? 1 : 0, String(detail).slice(0, 400));
    sql.exec('DELETE FROM alerts WHERE at < ?', now - 14 * 86400_000);
  }
  alerts(since, tests) {
    const sql = this.ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, kind TEXT, room TEXT, test INTEGER, detail TEXT)');
    return sql.exec('SELECT id, at, kind, room, test, detail FROM alerts WHERE at >= ? AND (test = 0 OR ?) ORDER BY id DESC LIMIT 100', Number(since) || 0, tests ? 1 : 0).toArray().map(row => {
      let mode = 'classic';
      try { mode = JSON.parse(row.detail).mode || 'classic'; } catch {}
      return { ...row, mode };
    });
  }
  assign(prefix, cap, exclude, proto) { return assign(this.rooms, prefix, cap, exclude, Date.now(), proto); }
  // name '' carries only counts (the Worker's refusals); an `lt-` name carries only counts (load test rooms are
  // never offered). `proto` and `counts` are optional, so a room from before this change still reports.
  report(name, people, proto, counts) {
    const now = Date.now();
    if (name && !name.startsWith('lt-')) {
      // An empty room of another protocol stays listed (with no people) until it goes stale, so its name is not
      // handed out again while the old code may still be running there.
      if (people <= 0 && (proto === undefined || proto === PROTO)) this.rooms.delete(name);
      else {
        const r = this.rooms.get(name);
        if (r) { r.people = Math.max(0, people); r.at = now; } else this.rooms.set(name, { people: Math.max(0, people), at: now, pending: [] });
        if (proto !== undefined) this.rooms.get(name).proto = proto;
      }
      // Peak people: the sum over this region's rooms that reported in the last 45 s, at the moment of a report.
      const hour = hourOf(now);
      if (hour !== this.peak.hour) this.peak = { hour, peakPeople: 0, peakRoom: 0 };
      let sum = 0;
      for (const r of this.rooms.values()) if (now - r.at < FRESH) sum += r.people;
      this.peak.peakPeople = Math.max(this.peak.peakPeople, sum);
      this.peak.peakRoom = Math.max(this.peak.peakRoom, people);
    }
    if (counts && typeof counts === 'object') this.tally(counts, now);
  }
  // One write per report that carries counts: at most one a minute per running room, plus the Worker's batches.
  tally(counts, now = Date.now()) {
    const sql = this.ctx.storage.sql, hour = hourOf(now), d = fold({}, counts);
    if (hour === this.peak.hour) { if (this.peak.peakPeople) d.peakPeople = this.peak.peakPeople; if (this.peak.peakRoom) d.peakRoom = this.peak.peakRoom; }
    const keys = Object.keys(d);
    if (!keys.length) return;
    sql.exec('CREATE TABLE IF NOT EXISTS metrics (hour INTEGER, key TEXT, v REAL, PRIMARY KEY (hour, key))');
    for (const k of keys) {
      if (isPeak(k)) sql.exec('INSERT INTO metrics VALUES (?, ?, ?) ON CONFLICT (hour, key) DO UPDATE SET v = max(v, excluded.v)', hour, k, d[k]);
      else sql.exec('INSERT INTO metrics VALUES (?, ?, ?) ON CONFLICT (hour, key) DO UPDATE SET v = v + excluded.v', hour, k, d[k]);
    }
    if (hour !== this.prunedHour) { this.prunedHour = hour; sql.exec('DELETE FROM metrics WHERE hour < ?', hour - KEEP_HOURS * HOUR); }
  }
  metrics(since) {
    const sql = this.ctx.storage.sql;
    if (!sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'metrics'").toArray().length) return [];
    return sql.exec('SELECT hour, key, v FROM metrics WHERE hour >= ? ORDER BY hour', Number(since) || 0).toArray();
  }
  list() { return [...this.rooms].map(([name, r]) => ({ name, people: r.people, proto: r.proto ?? null, pending: r.pending.length, age: Date.now() - r.at })); }
}
