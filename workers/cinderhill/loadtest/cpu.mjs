// The room's CPU, duration and storage from Cloudflare's Durable Object analytics (GraphQL), per object and minute.
// Usage: node cpu.mjs results/<name>.json   (reads object, startedAt, endedAt; adds `cloudflare` to the file)
// Uses the signed-in wrangler's token (`wrangler auth token`); prints no token. Analytics lag a few minutes.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2], r = JSON.parse(readFileSync(file, 'utf8'));
const token = execSync('wrangler auth token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').at(-1);
const query = `query($a:String!,$o:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){durableObjectsPeriodicGroups(limit:1000,filter:{objectId:$o,datetimeMinute_geq:$s,datetimeMinute_leq:$e},orderBy:[datetimeMinute_ASC]){dimensions{datetimeMinute} sum{cpuTime activeTime duration rowsWritten rowsRead inboundWebsocketMsgCount outboundWebsocketMsgCount exceededCpuErrors exceededMemoryErrors}}}}}`;
const floor = t => new Date(Math.floor(Date.parse(t) / 60000) * 60000).toISOString();
const res = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ query, variables: { a: 'a20259cba74e506296745f9c67c1f3bc', o: r.object, s: floor(r.startedAt), e: floor(r.endedAt) } }) });
const body = await res.json();
if (body.errors?.length) throw new Error(JSON.stringify(body.errors));
const rows = body.data.viewer.accounts[0].durableObjectsPeriodicGroups;
// Full minutes only (the first and last minute of a run are partial).
const full = rows.slice(1, -1), tot = k => full.reduce((a, x) => a + x.sum[k], 0), mins = full.length;
const all = k => rows.reduce((a, x) => a + x.sum[k], 0);
r.cloudflare = {
  minutes: rows.length, fullMinutes: mins,
  cpuMsPerSecond: mins ? tot('cpuTime') / 1000 / (mins * 60) : null,
  cpuMsPerSecondByMinute: full.map(x => +(x.sum.cpuTime / 1000 / 60).toFixed(2)),
  durationGbSecondsPerHour: mins ? tot('duration') / mins * 60 : null,
  rowsWrittenPerHour: mins ? tot('rowsWritten') / mins * 60 : null,
  inboundPerHour: mins ? tot('inboundWebsocketMsgCount') / mins * 60 : null,
  outboundPerHour: mins ? tot('outboundWebsocketMsgCount') / mins * 60 : null,
  exceededCpuErrors: all('exceededCpuErrors'), exceededMemoryErrors: all('exceededMemoryErrors'),
};
// Hibernatable WebSocket messages read 0 in inboundWebsocketMsgCount (seen 2026-11-25); count them from the room instead.
const roomIn = (r.room.hashes + r.room.cmds + r.room.dups + r.room.bad) / r.seconds * 3600;
if (!r.cloudflare.inboundPerHour) r.cloudflare.inboundPerHour = roomIn, r.cloudflare.inboundFrom = 'room counters';
// Prices: developers.cloudflare.com/durable-objects/platform/pricing/ (read 2026-11-25): duration $12.50 per million GB-s,
// requests $0.15 per million (incoming WebSocket messages 20:1), rows written $1.00 per million. Beyond the included amounts.
const c = r.cloudflare;
if (mins) c.costPerRoomHour = { duration: c.durationGbSecondsPerHour * 12.5e-6, requests: c.inboundPerHour / 20 * 0.15e-6, rowsWritten: c.rowsWrittenPerHour * 1e-6,
  total: c.durationGbSecondsPerHour * 12.5e-6 + c.inboundPerHour / 20 * 0.15e-6 + c.rowsWrittenPerHour * 1e-6 };
writeFileSync(file, JSON.stringify(r, null, 1) + '\n');
console.log(JSON.stringify(c, null, 1));
