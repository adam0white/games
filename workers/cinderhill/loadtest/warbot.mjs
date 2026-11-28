// Wire bots for the war build: machine players that join a room over a WebSocket exactly as a page does.
// Each bot runs the same sim, sends its orders through the room, and reports its hash. Use it to fill a
// room people are in, or to load the room server with many rooms at once.
//
//   node loadtest/warbot.mjs --url wss://games-cinderhill.adamwhite.workers.dev --rooms 4 --ticks 2400
//   node loadtest/warbot.mjs --url ws://127.0.0.1:8787 --code ABCD --side 1 --mood 2 --ticks 0
//
// --code joins one named room (a room people opened); --side picks the hill; --both seats a bot on each hill;
// --bot 0|1|2 and --botSide must match the room's link when it has a machine rival (bot=, botSide=);
// --mood 0 timid, 1 steady, 2 bold; --ticks 0 plays to the end; --start 0 waits for a person to start.
import { NetHost, roomLink, roomOptions, roomSim } from '../../../experiments/cinderhill/war/wire.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1] ?? '1'; };
const url = arg('url', 'ws://127.0.0.1:8787'), rooms = Number(arg('rooms', 1)), ticks = Number(arg('ticks', 2400));
const mission = arg('mission', 'crossing'), mood = Number(arg('mood', 1)), named = arg('code', ''), start = arg('start', '1') !== '0';
const sides = named && !process.argv.includes('--both') ? [Number(arg('side', 1))] : [0, 1];
const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ', newCode = () => Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * 24)]).join('');
const http = url.replace(/^ws/, 'http');
const rules = { mission, bot: process.argv.includes('--bot') ? Number(arg('bot', 1)) : null, botSide: Number(arg('botSide', 1)) };

function seat(code, team, begin) {
  const host = new NetHost(roomOptions({ code, ...rules }), { team, bot: { team, mind: mood } });
  const s = { host, status: '', sent: 0, link: null, begun: false };
  s.link = roomLink({ url, code, seed: roomOptions({ code, ...rules }).seed, sim: roomSim(rules), host: () => host, onStatus: v => { s.status = v; } });
  const post = host.post.bind(host); host.post = ints => { s.sent++; return post(ints); };
  s.pump = setInterval(() => {
    if (begin && !s.begun && s.status === 'live' && host.seats.size >= sides.length && !host.started) { s.begun = true; host.begin(); }
    host.advance(50);
  }, 50);
  return s;
}

const all = [];
for (let r = 0; r < rooms; r++) { const code = named || newCode(); all.push({ code, seats: sides.map((t, i) => seat(code, t, start && i === 0)) }); }
const t0 = Date.now();
const done = () => all.every(r => r.seats.every(s => s.host.sim.result || (ticks > 0 && s.host.sim.tick >= ticks) || s.status === 'full' || s.status === 'version'));
const timer = setInterval(async () => {
  if (!done() && (ticks === 0 || Date.now() - t0 < (ticks / 20 + 30) * 1000)) return;
  clearInterval(timer);
  let bad = 0;
  for (const r of all) {
    let stats = {}; try { stats = await (await fetch(`${http}/room/${r.code.toLowerCase()}/stats`)).json(); } catch { /* the room could not be read */ }
    const line = r.seats.map(s => `${s.status} tick ${s.host.sim.tick} behind ${s.host.behind} sent ${s.sent}${s.host.desync === null ? '' : ` DRIFT at ${s.host.desync}`}${s.host.sim.result ? ` result ${JSON.stringify(s.host.sim.result)}` : ''}`).join(' | ');
    if (stats.mismatches || r.seats.some(s => s.host.desync !== null || s.status !== 'live')) bad++;
    console.log(`${r.code}: ${line} || room cmds ${stats.cmds} compared ${stats.compared} mismatches ${stats.mismatches} late ${stats.late} bad ${stats.bad}`);
    for (const s of r.seats) { clearInterval(s.pump); s.link.leave(); }
  }
  console.log(`${all.length} rooms, ${bad} with trouble, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(bad ? 1 : 0);
}, 500);
