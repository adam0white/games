// Cinderhill: The Crossing. The page for the war sim (./sim.js): two colonies on one hill. No game rule lives here:
// everything on screen is read from the sim or its events, and every order goes through host.order() under seat 0.
import { Host } from './host.js';
import { NetHost, roomLink, roomSeed, roomOptions, roomSim } from './wire.js';
import { newCode, cleanCode, shareLink } from '../../kit/room.js';
import { CMD, KIND, MODE, CG, EVENT, REASON, TASK, CASTE, STAGE, MAT, ROOM, TRAILS, PATH_MAX, MAX_PILES, C, LEVEL_SHARE, RAID_SHARE, PLUG, PEST } from './sim.js';
import { CAMPAIGN, LINEAGE, LOSS_ANTS, MISSIONS, TRAITS, TIERS, BRANCH, ROAD, VISITOR } from './tables.js';
import { makeGestures } from '../gestures.js';
import { GameRenderer, sky } from '../game/gl.js';
import { noZoom } from '../../kit/zoom.js';
import { onLeave, isPauseKey } from '../../kit/pause.js';
import { sound } from '../../kit/audio.js';
import { music } from '../../kit/music.js';
import { lab } from '../../kit/lab.js';
import { settings } from '../../kit/settings.js';

noZoom();
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
// A friends' room (experimental): ?room=CODE joins it, &side=1 takes the far hill, &bot=0|1|2 lets the machine play the hill
// nobody on this link plays. Everything that shapes the sim comes from the link, so every page builds the same hill.
const NET = cleanCode(query.get('room')), NET_BOT = NET && /^[012]$/.test(query.get('bot') ?? '') ? Number(query.get('bot')) : null;
const ME = NET && query.get('side') === '1' ? 1 : 0, FOE = 1 - ME;
const ROOM_URL = /^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(query.get('roomHost') ?? '') ? query.get('roomHost') : 'wss://games-cinderhill.adamwhite.workers.dev';

// ---- recording and settings: every taste choice is a setting with a default, and each change is recorded ----
const rec = lab('cinderhill', { lang: () => 'en' });
rec.notice($('menuLab')); rec.toggle($('menuLab')); rec.toggle($('pauseLab'));
const set = settings('cinderhill', {
  rival: { values: ['timid', 'steady', 'bold'], def: 'timid', key: 'cinderhill:war:rival' },
  caste: { values: ['spitter', 'warden'], def: 'spitter', key: 'cinderhill:war:caste' },
  view: { values: ['tilt', 'top', 'low'], def: 'tilt', key: 'cinderhill:war:view' },
  light: { values: ['cycle', 'day', 'ember'], def: 'cycle', key: 'cinderhill:war:light' },
  style: { values: ['relief', 'ink'], def: 'relief', key: 'cinderhill:war:style' },
  size: { values: ['1', '1.5'], def: '1.5', key: 'cinderhill:war:size' },
  sound: { values: ['all', 'fx', 'off'], def: 'all', key: 'cinderhill:war:sound' },
  finger: { values: ['hill', 'draw'], def: 'hill', key: 'cinderhill:war:finger' },
  nest: { values: ['full', 'sheet'], def: 'full', key: 'cinderhill:war:nest' },
  guide: { values: ['once', 'always', 'off'], def: 'once', key: 'cinderhill:war:guide' },
  forks: { values: ['kept', 'free'], def: 'kept', key: 'cinderhill:war:forks' },
  growth: { values: ['mission', 'deeds'], def: 'mission', key: 'cinderhill:war:growth' },
  home: { values: ['carried', 'bare'], def: 'carried', key: 'cinderhill:war:home' },
  visitor: { values: ['comes', 'hungry', 'never'], def: 'comes', key: 'cinderhill:war:visitor' },
  day: { values: ['12', '20', '30'], def: '20', key: 'cinderhill:war:day' },
  falls: { values: ['lean', 'fair', 'rich'], def: 'fair', key: 'cinderhill:war:falls' },
}, { rec });
const LABEL = { guide: 'First steps', caste: 'Your third caste', rival: 'Rival', view: 'View', light: 'Light', style: 'Style', size: 'Ants', sound: 'Sound', finger: 'One finger', nest: 'The Nest', forks: 'Forks', growth: 'The tree', home: 'The home hill', visitor: 'The weevil', day: 'High Summer: length', falls: 'High Summer: windfalls' };
const NAME = { once: 'Shown until done once', always: 'Shown every game', off: 'Hidden', full: 'Fills the screen', sheet: 'Slides over the lower half', 12: 'Twelve minutes', 20: 'Twenty minutes', 30: 'Thirty minutes', lean: 'Lean: a third less falls', fair: 'Fair', rich: 'Rich: half as much again', comes: 'Comes for your stores', hungry: 'Comes hungry, and harder to kill', never: 'Never comes', carried: 'Kept from mission to mission', bare: 'A new hill every mission', mission: 'Grow the hill in each mission', deeds: 'Deeds alone open tools (no growth)', spitter: 'Spitters', warden: 'Wardens', timid: 'Timid', steady: 'Steady', bold: 'Bold', tilt: 'Tilted', top: 'Top down', low: 'Low', cycle: 'Day to dusk', day: 'Day', ember: 'Ember', relief: 'Painted', ink: 'Ink', 1: 'True size', 1.5: 'Larger', hill: 'Draws from your hill, moves the view elsewhere', draw: 'Always draws', kept: 'Kept for the campaign', free: 'Can be changed between missions', all: 'Music & effects', fx: 'Effects', off: 'Off' };
const MOOD = { timid: 0, steady: 1, bold: 2 };
const redraw = set.panel($('settings'), { only: set.ids.filter(id => id !== 'caste' && !(NET && ['rival', 'forks', 'growth', 'home', 'visitor', 'day', 'falls'].includes(id))), /* a room's rules come from its link, the same for every page */ label: id => LABEL[id], name: (id, v) => NAME[v] ?? v, what: (id, v) => (id === 'caste' ? (v === 'spitter' ? 'Frail, but they spit from two cells away, over the front line. Applies from the next start.' : 'Slow and very hard to kill: they hold a tunnel. Applies from the next start.') : id === 'rival' ? (v === 'timid' ? 'It never attacks your hill. Applies from the next start.' : v === 'bold' ? 'It raids early, even at even odds. Applies from the next start.' : 'It holds the fords, and raids when it has the numbers. Applies from the next start.') : id === 'growth' ? (v === 'mission' ? 'Each mission you widen the queen\'s chamber, choose a War hill or a Deep hill, and grow into your tools. Applies from the next start.' : 'No growth: what your deeds have opened is yours from the first minute. Applies from the next start.') : id === 'home' ? (v === 'carried' ? 'First Frost, The Stones and The Larder are fought on the hill of The Crossing. Each starts in the nest as you left it, tunnels, stores and nurseries, and the rival starts in its own. Quarters come back as bare tunnels to paint again. Applies from the next start.' : 'Every mission starts in the same small nest. Applies from the next start.') : id === 'visitor' ? (v === 'never' ? 'No weevil in any mission. Applies from the next start.' : `In First Frost a weevil comes in at each door ${VISITOR[v].at.length} times and eats up to ${VISITOR[v].fill} seeds a visit from stores within ${VISITOR[v].reach} steps of the door. Applies from the next start.`) : null), onChange: (id, v) => { if (id === 'forks' || id === 'home' || id === 'visitor') renderPath(); if (id === 'sound') { if (v === 'off') snd.hold(); else { snd.release(); startSong(); } } tone(660, 0.06, 0.03, 'triangle', 80); } });

// ---- the game ----
const qSeed = Math.floor(Number(query.get('seed')));
let seed = NET ? roomSeed(NET) : qSeed > 0 ? qSeed : 1 + Math.floor(Math.random() * 9999);
const PICK = { spitter: CASTE.SPITTER, warden: CASTE.WARDEN };
// A rival that fights takes the caste you did not. Both are set when the run starts, so the menu's settings count.
// The campaign: what has been played to its end, and the forks taken. Its own key; nothing else reads it.
const CAMP_KEY = 'cinderhill:war:campaign';
const TEXT = {
  summer: { sub: 'A long day. The food keeps falling. Build a hill worth the name.', goals: ['Have the larger colony at dusk, or kill the rival queen after noon.', 'Until noon no raid can go down a door and no queen can be hurt. Use the morning to dig: stores, nurseries, quarters, gardens.', 'Food falls all day, on your ground and on the three fords. You are told a little before, and so is the rival.'], clock: ['Noon', 'Dusk'], won: 'The meadow is yours', end: 'dusk' },
  crossing: { sub: 'Two hills. One creek. Not enough food for both.', goals: ['Have the larger colony at dusk, or kill the rival queen.', 'Lose your queen and the hill is lost.', 'The big food lies on the two fords. So does the rival.'], clock: ['Dusk'], won: 'The crossing is yours', end: 'dusk' },
  hunt: { sub: 'Open ground. A great beetle on a dead vole. Two hungry hills.', goals: ['First kill it. Then carry forty loads of its meat home before the rival does. The hill that hurt it more starts six loads ahead.', 'It bites whatever comes inside the red ring, two ants at a time, and it never leaves the body. A few soldiers die there for little: raise a dozen in the Nest first, then tap Raid and tap the beetle.', 'When it falls, draw a Forage trail to the body and send most of your workers. Keep soldiers on it: the rival wants the same meat.', 'At dusk, more meat home wins. If the beetle still lives, more harm wins.'], clock: ['Dusk'], won: 'The beetle is yours', end: 'dusk' },
  stones: { sub: 'Four standing stones. Stand by them longer than the rival does.', goals: ['A stone pays a point a second to the colony with more ants beside it. It takes three ants at least.', 'First to 400 points wins. At dusk, more points wins.', 'Draw a raid trail to a stone and your soldiers stand there.', 'Two stones stand on the fords. One stands on each far flank.'], clock: ['Dusk'], won: 'The stones are yours', end: 'dusk' },
  larder: { sub: 'A lean season. Their stores are full. So are yours.', goals: ['Carry ten loads home from the rival\'s store. A load counts when the thief reaches your own store with it.', 'Tap Raid, then tap the rival door. Every soldier goes, and workers go along to carry. The soldiers hold the store while the workers take from it.', 'Half the rival\'s soldiers stand on a ford. Strike while they are away, and mind your own door.', 'At dusk, more loads carried home wins.'], clock: ['Dusk'], won: 'Their larder is yours', end: 'dusk' },
  narrows: { sub: 'A ridge of stone. One pass. Their queen is frail, and dusk is on her side.', goals: ['Kill the rival queen before dusk. If she lives to see it, you have lost.', 'There is one way through the ridge, and the rich food lies in it.', 'The rival will not march on your hill. It will hold the pass and its own door.', 'Two ways in. Storm the pass: grow, raise soldiers, draw a raid to the rival door. Or go under the ridge: open Nest, pick Tunnel and drag through the clay toward the rival nest, then pick Strike. The ground under the ridge is soft loam: a cell takes half the time and costs no seed. It is the harder way: a long dig, the rival hears it, and its soldiers are at home.'], clock: ['Dusk'], won: 'The ridge is yours', end: 'dusk' },
  wall: { sub: 'A wall of stone, whole. The only way to the other queen is through the clay.', goals: ['Kill the rival queen, or have the larger colony at dusk.', 'No ant can cross the wall. Open Nest, pick Tunnel and drag through the clay toward the rival nest. A seed to dig a cell.', 'When you are through, pick Strike and tap inside the rival nest. Your soldiers go that way for the queen.', 'The rival digs too, and you will hear it. A Guard post where its tunnel comes in keeps soldiers there to meet it.'], clock: ['Dusk'], won: 'The wall did not save them', end: 'dusk' },
  frost: { sub: 'The seeds are falling. The frost is coming.', goals: ['Half way through, the frost takes all the food outside.', 'In the cold the hill eats four times as fast. Dig stores and fill them with seeds.', 'Have the larger colony at the thaw. A small hill with full stores outlives a big hungry one.', 'Raiders can carry off the rival\'s stores.'], clock: ['Frost', 'Thaw'], won: 'The hill sees the thaw', end: 'the thaw' },
};
const FORK = { spitter: ['Spitters', 'Frail. They spit from two cells away, over the front line.'], warden: ['Wardens', 'Slow and very hard to kill. They hold a tunnel.'] };
function loadCamp() { try { const c = JSON.parse(localStorage.getItem(CAMP_KEY)); if (c && c.v === 1 && c.done) { c.forks ??= {}; return c; } } catch { /* a fresh campaign */ } return { v: 1, done: {}, caste: null, forks: {} }; }
let camp = loadCamp();
// A campaign from before the fork in the road, with one of its two missions finished: that one was the road taken.
{ const got = ROAD.pair.filter(x => camp.done[x]); if (!camp.forks.road && got.length === 1) camp.forks.road = got[0]; }
const saveCamp = () => { try { localStorage.setItem(CAMP_KEY, JSON.stringify(camp)); } catch { /* private mode: the campaign lasts the visit */ } };
// The Lineage: the deeds done, by 'mission.deed'. Its own key. A node is yours once any deed that opens it is done.
const LINE_KEY = 'cinderhill:war:lineage';
function loadLine() { try { const c = JSON.parse(localStorage.getItem(LINE_KEY)); if (c && c.v === 1 && c.deeds) return c; } catch { /* none yet */ } return { v: 1, deeds: {} }; }
let line = loadLine();
const saveLine = () => { try { localStorage.setItem(LINE_KEY, JSON.stringify(line)); } catch { /* private mode */ } };
const deedsFor = node => Object.values(MISSIONS).flatMap(m => m.deeds.filter(d => d.opens === node).map(d => ({ ...d, mission: m })));
const hasNode = node => deedsFor(node).some(d => line.deeds[`${d.mission.id}.${d.id}`]);
const nodesNow = () => LINEAGE.flatMap(b => b.nodes).filter(n => n.node && hasNode(n.node)).map(n => n.node);
// The home hill: both nests as they stood at the end of each mission fought on it. Its own key. A mission with `from`
// starts in the nests of that mission, or of the one before it on the same hill when that one was never finished here.
const HILL_KEY = 'cinderhill:war:hills';
function loadHills() { try { const c = JSON.parse(localStorage.getItem(HILL_KEY)); if (c && c.v === 1 && c.after) return c; } catch { /* none yet */ } return { v: 1, after: {} }; }
let hills = loadHills();
// Second doors kept with a hill, by the mission they were left after: the column of each colony's (or -1). Its own key.
const DOOR_KEY = 'cinderhill:war:doors';
let doors = (() => { try { const c = JSON.parse(localStorage.getItem(DOOR_KEY)); if (c && c.v === 1 && c.after) return c; } catch { /* none yet */ } return { v: 1, after: {} }; })();
const saveDoors = () => { try { localStorage.setItem(DOOR_KEY, JSON.stringify(doors)); } catch { /* private mode */ } };
const sidesOf = id => { const h = hillOf(id), s = h && doors.after[h.from]; return Array.isArray(s) && s.length === 2 ? s.map(x => (Number.isInteger(x) ? x : -1)) : null; };
const saveHills = () => { try { localStorage.setItem(HILL_KEY, JSON.stringify(hills)); } catch { /* private mode */ } };
const hillOf = id => { if (set.get('home') !== 'carried') return null; for (let f = MISSIONS[id].from; f; f = MISSIONS[f].from) { const n = hills.after[f]?.nests; if (Array.isArray(n) && Array.isArray(n[0]) && Array.isArray(n[1])) return { from: f, nests: n }; } return null; };
const STEPS = CAMPAIGN.filter(s => s.mission && !s.side).map(s => s.mission), SIDE = CAMPAIGN.filter(s => s.side).map(s => s.mission);
const before = id => STEPS[STEPS.indexOf(id) - 1];
/** A mission is open when the one before it was played to its end and every fork before it is taken. */
// A fork's choice: the caste fork keeps its own field; the rest sit in camp.forks. A fork's options name a caste or a trait.
const taken = fork => (fork === 'caste' ? camp.caste : camp.forks[fork]) ?? null;
const FORK_HEAD = { caste: 'A third caste', way: 'A way of living', craft: 'A craft for your caste' };
// A fork's options: a plain list, or a list that depends on the caste taken earlier. The rival's are the ones you did not
// take; where the list depends on the caste, the rival (which has the other caste) takes the other position in its own list.
const optionsOf = s => s.options ?? s.by?.[camp.caste] ?? [];
const rivalOf = s => { const mine = taken(s.fork); if (s.options) return s.options.filter(v => v !== mine); const i = optionsOf(s).indexOf(mine), other = s.by[camp.caste === 'spitter' ? 'warden' : 'spitter']; return i < 0 ? [] : [other[1 - i]]; };
const optionText = v => FORK[v] ?? [TRAITS[v].name, TRAITS[v].text];
// Traits: yours are the forks you took; the rival takes the other option of each, so the choice is a trade and not a gift.
const traitsNow = () => { const mine = nodesNow(), theirs = nodesNow(); for (const s of CAMPAIGN) if (s.fork && s.fork !== 'caste' && taken(s.fork)) { mine.push(taken(s.fork)); theirs.push(...rivalOf(s)); } return [mine, MOOD[set.get('rival')] ? theirs : []]; };
function isOpen(id) { if (id === query.get('mission')) return true; if (SIDE.includes(id)) return !!camp.done[STEPS[0]]; for (const s of CAMPAIGN) { if (s.mission === id) return true; if (s.mission && !s.side && !camp.done[s.mission] && !(ROAD.pair.includes(s.mission) && ROAD.pair.includes(id))) return false; if (s.fork && !taken(s.fork)) return false; } return false; }
const firstOpen = () => { let last = STEPS[0]; for (const id of STEPS) { if (!isOpen(id)) break; last = id; if (!camp.done[id]) break; } return last; };
const qMission = query.get('mission');
let missionId = MISSIONS[qMission] ? qMission : firstOpen();
const rivalMind = () => { const mood = MOOD[set.get('rival')]; if (!mood) return mood; const m = { mood }; if (camp.caste) m.pick = camp.caste === 'spitter' ? CASTE.WARDEN : CASTE.SPITTER; if (hasNode('door') && (MISSIONS[missionId].from || Object.values(MISSIONS).some(x => x.from === missionId))) m.outpost = 24; /* only on a hill that is kept: elsewhere the dig is never paid back */ return m.pick || m.outpost ? m : mood; };
// A mission lost costs the next one some of its first workers: the colony carries on smaller.
const roadBefore = id => { const [a, b] = ROAD.pair, r = camp.forks.road; if (id === a || id === b) return r && r !== id ? r : before(a); const p = before(id); return (p === a || p === b) && r ? (r === a ? b : a) : p; };
const startAnts = () => { const prev = roadBefore(missionId), ants = MISSIONS[missionId].kit.ants; return prev && camp.done[prev] && !camp.done[prev].won ? [Math.max(10, ants - LOSS_ANTS), MISSIONS[missionId].kit.foeAnts ?? ants] : [ants, MISSIONS[missionId].kit.foeAnts ?? ants]; };
// The fork in the road: the mission of the pair that was not finished first has changed by the time it is played.
const late = id => ROAD.pair.includes(id) && !!camp.forks.road && camp.forks.road !== id;
const lateOpts = id => { if (!late(id)) return {}; const { foePoints, foeHarm, ...o } = ROAD.late[id]; if (foePoints) { o.pointsBy = [0, 0]; o.pointsBy[FOE] = foePoints; } if (foeHarm) { o.harmBy = [0, 0]; o.harmBy[FOE] = foeHarm; } return o; };
// A mission's visitor: the weevil of the strength set, or none.
const visitorOf = id => (MISSIONS[id].visitor && set.get('visitor') !== 'never' ? { ...VISITOR[set.get('visitor')], ...(MISSIONS[id].visits ? { at: MISSIONS[id].visits } : {}) } : null);
// A long mission (High Summer): its length and how much falls are settings. Noon, when the truce ends, stays at two fifths of the day.
const FALLS = { lean: 2, fair: 3, rich: 4.5 };
const longOpts = id => { const m = MISSIONS[id]; if (!m.long) return {}; const duskTick = +set.get('day') * 1200, f = FALLS[set.get('falls')] / 3, fl = m.kit.falls; return { duskTick, truce: Math.round(duskTick * 0.4), falls: { ...fl, amount: Math.round(fl.amount * f), mid: Math.round(fl.mid * f) } }; };
const newHost = () => NET ? new NetHost(roomOptions({ code: NET, mission: missionId, bot: NET_BOT, botSide: query.get('botSide') === '0' ? 0 : 1 }), { team: ME, onStart: () => netStarted(), onSeats: s => netSeats(s) }) : new Host({ seed, mission: missionId, ...lateOpts(missionId), ...longOpts(missionId), ...(visitorOf(missionId) ? { pest: visitorOf(missionId) } : {}), ...(hillOf(missionId) ? { nests: hillOf(missionId).nests } : {}), ...(sidesOf(missionId) ? { sides: sidesOf(missionId) } : {}), antsBy: startAnts(), traits: traitsNow(), tiers: set.get('growth') !== 'deeds', ai: { [FOE]: MOOD[set.get('rival')] } });
let host = newHost(), sim = host.sim;
let screen = 'menu', tool = 'trail', nestOpen = false, running = false, speed = 1, lastT = 0;
const Gs = makeGestures();
const L0 = sim.L;
const doorXY = t => { const c = sim.door[t]; return { x: c % L0.sw + 0.5, y: Math.floor(c / L0.sw) + 0.5 }; };
const g = (t, k) => sim.cg[t * CG.SIZE + k];

let song = null, songOn = false;
const snd = sound({ on: () => set.get('sound') !== 'off', setup: ac => { try { song = music(ac, { preset: 'bell' }); } catch { song = null; } } });
const tone = (...a) => { if (set.get('sound') !== 'off') snd.tone(...a); };
function startSong() { if (songOn || set.get('sound') === 'off') return; snd.unlock(); try { song?.start?.(seed); songOn = !!song; } catch { /* the score is optional */ } }
let danger = 0;
function tuneSong() { try { song?.set?.({ on: set.get('sound') === 'all' && screen === 'play', progress: Math.min(1, sim.tick / sim.cfg.duskTick), danger, light: 1 - light.night }); } catch { /* optional */ } }

addEventListener('error', e => rec.event('error', { m: String(e.message ?? 'error').slice(0, 200) }));

// ---- canvases and the camera (the same arithmetic as gl.js CAM) ----
const glCanvas = $('gl'), ui = $('c'), ctx = ui.getContext('2d'), nestCanvas = $('nest'), nctx = nestCanvas.getContext('2d'), mini = $('miniC'), mctx = mini.getContext('2d');
let dprCap = 2, slow = { sum: 0, n: 0 };
let W = innerWidth, H = innerHeight, dpr = Math.min(dprCap, devicePixelRatio || 1), NW = 1, NH = 1;
let renderer = null, glFailed = '';
try { renderer = GameRenderer.create(glCanvas, { restored: () => { uploadTerrain(); trailSig = '?'; }, lost: () => pauseGame() }); } catch (e) { glFailed = String(e.message || e).slice(0, 300); renderer = null; }
if (!renderer) $('nogl').classList.add('on');
const cam = { x: doorXY(ME).x, y: doorXY(ME).y, z: 10 };
const nestCam = { x: doorXY(ME).x, y: 0, z: 12 }; let nestZoomed = false;
const VIEW = { top: { pitch: 0, fk: 2.2 }, tilt: { pitch: 0.72, fk: 1.7 }, low: { pitch: 1.24, fk: 0.86 } };
const lens = { ...VIEW.low };
let nestLift = 0, eye = null, camGoal = null, shake = 0;
function pose(c = cam) { const f = lens.fk * H, D = f / c.z, s = Math.sin(lens.pitch), co = Math.cos(lens.pitch), y = c.y + nestLift / (c.z * Math.max(0.3, co)); return { ex: c.x, ey: y + D * s, ez: D * co, sin: s, cos: co, f, dist: D }; }
const zMin = () => Math.min(W / L0.sw, H / L0.sh) * 1.1;
function clampCam() { cam.z = Math.max(zMin(), Math.min(44, cam.z)); cam.x = Math.max(0, Math.min(L0.sw, cam.x)); cam.y = Math.max(0, Math.min(L0.sh, cam.y)); eye = pose(); }
function toWorld(sx, sy, h = 0) {
  const v = eye, qx = (sx - W / 2) / v.f;
  let qy = (sy - H / 2) / v.f;
  if (v.sin > 0.05) qy = Math.max(qy, (0.05 - v.cos) / v.sin);
  const dz = -qy * v.sin - v.cos, t = (h - v.ez) / dz;
  return { x: v.ex + qx * t, y: v.ey + (qy * v.cos - v.sin) * t };
}
function toScreen(wx, wy, h = 0) {
  const v = eye, dy = wy - v.ey, dh = h - v.ez, zc = -dy * v.sin - dh * v.cos;
  if (zc < 0.05) return { x: -1e5, y: -1e5, s: 0 };
  return { x: W / 2 + v.f * (wx - v.ex) / zc, y: H / 2 - v.f * (-dy * v.cos + dh * v.sin) / zc, s: v.f / zc };
}
function resize() {
  W = innerWidth; H = innerHeight; dpr = Math.min(dprCap, devicePixelRatio || 1);
  ui.width = Math.round(W * dpr); ui.height = Math.round(H * dpr);
  renderer?.resize(W, H, dpr);
  const r = nestCanvas.getBoundingClientRect(); NW = Math.max(1, r.width); NH = Math.max(1, r.height);
  nestCanvas.width = Math.round(NW * dpr); nestCanvas.height = Math.round(NH * dpr);
  if (!nestZoomed) nestCam.z = Math.max(10, Math.min(18, NW / 30));
  clampCam();
}
addEventListener('resize', resize);
const startZoom = () => Math.max(7, Math.min(13, Math.min(innerWidth, innerHeight) / 44));
resize();

// ---- uploads ----
const inst = new Float32Array(sim.cfg.maxAnts * 8);
let drawnAnts = 0;
const prevOf = new Int32Array(sim.cfg.maxAnts);   // each ant's index a tick ago, or -1 (the dead leave gaps)
function matchPrev() { let j = 0; for (let i = 0; i < sim.n; i++) { let k = j; while (k < host.pn && host.pid[k] !== sim.id[i]) k++; if (k < host.pn) { prevOf[i] = k; j = k + 1; } else prevOf[i] = -1; } }
function uploadAnts() {
  matchPrev();
  if (!renderer) return;
  let k = 0;
  for (let i = 0; i < sim.n; i++) {
    if (sim.layer[i] !== 0) continue;
    const p = prevOf[i], jump = p < 0 || host.pl[p] !== 0, x = sim.x[i] / 256, y = sim.y[i] / 256, ca = sim.caste[i], major = ca === CASTE.MAJOR || ca === CASTE.WARDEN;
    inst[k] = jump ? x : host.px[p] / 256; inst[k + 1] = jump ? y : host.py[p] / 256; inst[k + 2] = x; inst[k + 3] = y;
    inst[k + 4] = sim.heading[i] * (Math.PI / 128); inst[k + 5] = (ca === CASTE.WARDEN ? 3 + 8 : major ? 2 + 8 : ca === CASTE.SPITTER ? 1 : 0) + (sim.team[i] !== ME ? 16 : 0); inst[k + 6] = sim.carry[i] & 3; inst[k + 7] = (sim.id[i] * 0.618034) % 1;
    k += 8;
  }
  drawnAnts = k / 8; renderer.setAnts(inst, drawnAnts);
}
function uploadTerrain() { if (!renderer) return; renderer.setTerrain(L0.sw, L0.sh, sim.mat.subarray(0, L0.sw * L0.sh)); renderer.setScent(L0.sw, L0.sh, new Uint8Array(L0.sw * L0.sh * 4)); }
uploadTerrain(); uploadAnts();

// ---- particles ----
const MAXP = 800, parts = [], dots = new Float32Array(MAXP * 8);
function puff(x, y, h, o = {}) { if (parts.length >= MAXP) parts.shift(); parts.push({ x, y, h, vx: o.vx ?? 0, vy: o.vy ?? 0, vh: o.vh ?? 0, size: o.size ?? 0.5, grow: o.grow ?? 0, col: o.col ?? [1, 0.6, 0.2], a: o.a ?? 1, add: o.add ?? true, life: o.life ?? 1, age: 0, drag: o.drag ?? 0 }); }
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
function burst(x, y, col, n = 8, o = {}) { for (let k = 0; k < n; k++) puff(x + rnd(0.3), y + rnd(0.3), 0.3, { vx: rnd(2.2), vy: rnd(2.2), vh: 1.5 + Math.random() * 2.5, size: 0.35 + Math.random() * 0.3, col, life: 0.5 + Math.random() * 0.5, drag: 2, ...o }); }
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += dt; if (p.age >= p.life) { parts.splice(i, 1); continue; } const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.h = Math.max(0, p.h + p.vh * dt); p.size += p.grow * dt; }
  let k = 0;
  for (const p of parts) { const t = p.age / p.life, a = p.a * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85), o = k++ * 8; dots[o] = p.x; dots[o + 1] = p.y; dots[o + 2] = p.h; dots[o + 3] = p.size; dots[o + 4] = p.col[0] * a; dots[o + 5] = p.col[1] * a; dots[o + 6] = p.col[2] * a; dots[o + 7] = p.add ? 0 : a; }
  renderer?.setDots(dots, k);
}
function ambient(dt) {
  const spanX = W / cam.z, spanY = H / (cam.z * Math.max(0.3, eye.cos)), n = light.night;
  if (Math.random() < dt * 12) puff(cam.x + rnd(spanX / 2), cam.y + rnd(spanY / 2), 1 + Math.random() * 3, { vx: 0.8 + Math.random(), vy: rnd(0.3), vh: rnd(0.2), size: 0.14 + Math.random() * 0.14, col: [0.75, 0.72, 0.7], a: 0.35 * (1 - n * 0.7), add: false, life: 4 + Math.random() * 3 });
  if (Math.random() < dt * (2 + 26 * n)) puff(cam.x + rnd(spanX / 2), cam.y + rnd(spanY / 2), 0.1, { vx: rnd(0.4), vy: rnd(0.2), vh: 0.7 + Math.random() * 1.2, size: 0.16 + Math.random() * 0.16, col: [1, 0.45 + Math.random() * 0.25, 0.1], a: 0.5 + 0.5 * n, life: 2 + Math.random() * 2.5 });
}
let floats = [], pulses = [], beacon = null;
const KIND_COL = [[1, 0.85, 0.4], [1, 0.4, 0.25]];

let toastTimer = 0;
let warnUntil = 0; // a warning holds the toast: a hint that comes while it shows waits its turn
let toastAct = null;
/** `act`: what a tap on the message does (open the Nest, look at the place). The message says so by its arrow. */
function toast(text, ms = 2400, bad = false, act = null) { const t = performance.now(); if (bad) warnUntil = t + ms; else if (t < warnUntil) { setTimeout(() => toast(text, ms, false, act), warnUntil - t + 60); return; } const el = $('toast'); el.textContent = act ? `${text} ›` : text; toastAct = act; el.classList.toggle('tap', !!act); el.classList.toggle('bad', bad); el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms); }

// ---- screens ----
function setScreen(s) {
  screen = s;
  for (const id of ['menu', 'paused', 'over']) $(id).classList.toggle('on', s === id);
  document.body.classList.toggle('playing', s !== 'menu');
  tuneSong();
}
function opening() { const e = doorXY(ME); cam.x = e.x; cam.y = e.y; cam.z = 24; clampCam(); camGoal = { x: e.x + 4, y: e.y, z: startZoom(), rate: 0.8 }; }
// The caste taken at the fork is raised once the chamber has grown to where a third caste opens (at once, without tiers).
function pickCaste() { if (camp.caste && !g(ME, CG.PICK) && sim.mayPick(ME)) host.order({ team: ME, type: CMD.PICK, caste: PICK[camp.caste] }); }
// Growing the queen's chamber: what each branch gives this colony, by name, from the tables and its own nodes.
function branchList(br) {
  const out = branchOpens(br); out.unshift(TIERS.branch[br].text.toLowerCase()); return out.join(', ');
}
// What a branch opens beyond its numbers: the caste taken at the fork (War hill), and this colony's nodes that wait on it.
function branchOpens(br) { const out = []; if (br === TIERS.pick[1] && camp.caste) out.push(`your ${camp.caste}s`); for (const id of sim.cfg.traits?.[ME] ?? []) { const at = TRAITS[id].at; if (at && at[0] === 2 && at[1] === br) out.push(TRAITS[id].name); } return out; }
function lastList() { const out = []; for (const id of sim.cfg.traits?.[ME] ?? []) { const at = TRAITS[id].at; if (at && at[0] === 3) out.push(TRAITS[id].name); } return out; }
let growAsked = -1; // one tap, one order: the order is not applied until the next tick
for (const b of document.querySelectorAll('#grows [data-grow]')) b.addEventListener('click', () => {
  const tier = g(ME, CG.TIER), br = Number(b.dataset.grow) || g(ME, CG.BRANCH);
  if (sim.mayGrow(ME) !== 0 || growAsked === sim.tick) return;
  growAsked = sim.tick;
  const craft = Number(b.dataset.craft) || 0;
  order({ type: CMD.GROW, branch: br, craft }); rec.event('grow', { to: tier + 2, branch: br === BRANCH.WAR ? 'war' : 'deep', craft: TIERS.craft[craft]?.id ?? '', at: sim.tick, ants: g(ME, CG.ADULTS) }); tone(330, 0.3, 0.05, 'triangle', 160); navigator.vibrate?.(10);
});
function growPane() {
  const on = !!sim.cfg.tiers; document.querySelector('#diet .tabs [data-tab="grow"]').hidden = !on; if (!on) return;
  const tier = g(ME, CG.TIER), left = g(ME, CG.GROW), br = g(ME, CG.BRANCH), row = TIERS.grow[tier], may = sim.mayGrow(ME), can = may === 0;
  const craftOf = TIERS.craft[g(ME, CG.CRAFT)], name = (br === BRANCH.WAR ? 'War hill' : br === BRANCH.DEEP ? 'Deep hill' : 'A young hill') + (craftOf && tier >= 2 ? `, ${craftOf.name}` : '');
  $('growHead').textContent = `${name} · tier ${tier + 1} of 3`; $('growInfo').textContent = left ? `growing: ${Math.ceil(left / 20)}s` : !row ? 'full grown' : may > 1 ? `${may - 2} more seeds needed` : `${row.sugar} seeds to grow`;
  for (const b of document.querySelectorAll('#grows [data-grow]')) { const k = Number(b.dataset.grow); const cr = TIERS.craft[Number(b.dataset.craft) || 0]; b.hidden = tier === 0 ? k === 0 : k !== 0 || !row || (!!cr?.branch && cr.branch !== br); b.disabled = !can; }
  if (tier === 1) { // what each craft would do for this hill as it stands: the numbers are the hill's own, read now
    const ad = g(ME, CG.ADULTS), fi = g(ME, CG.MAJORS), ep = sim.stat[ME].eatPer, gd = sim.gardens[ME], meal = n => Math.ceil(ad / n);
    const now = { 1: fi ? `${fi} fighter${fi === 1 ? '' : 's'} now bite harder` : 'no fighters yet', 2: `all ${ad} ants faster`, 3: `a meal: ${meal(ep)} seeds, then ${meal(Math.floor(ep * 3 / 2))}`, 4: gd ? `${gd} garden cell${gd === 1 ? '' : 's'}: ${gd} seeds a minute, then ${2 * gd}` : 'no gardens dug yet' };
    for (const b of document.querySelectorAll('#grows [data-craft]')) b.querySelector('small').textContent = now[b.dataset.craft];
  }
  const done = left && row ? 1 - left / row.ticks : 0; $('growBar').firstElementChild.style.width = `${(100 * done).toFixed(0)}%`; $('growBar').hidden = !left;
  const other = br === BRANCH.WAR ? BRANCH.DEEP : BRANCH.WAR, last = lastList();
  $('growHelp').innerHTML = left ? 'The chamber is being widened. Until it is done the queen lays nothing.'
    : tier === 0 ? `Widen the queen's chamber: <b>${row.sugar} seeds</b>, and for ${row.ticks / 20} seconds she lays nothing. Choose what the hill becomes; it stays that for the mission. <b>War hill</b>: ${branchList(BRANCH.WAR)}. <b>Deep hill</b>: ${branchList(BRANCH.DEEP)}. When it grows again a War hill may take the Legion craft (fighters bite a third harder) and a Deep hill the Granary craft (gardens pay double); either may take Swift or Thrift.${camp.caste ? ` A Deep hill raises ${camp.caste}s only after it grows again.` : ''}`
    : tier === 1 ? (() => { const more = [...branchOpens(other), ...last]; if (other === BRANCH.DEEP) more.unshift('fungus gardens'); return `Grow again: <b>${row.sugar} seeds</b>, ${row.ticks / 20} seconds. Choose a craft; the hill keeps it for the mission. ${TIERS.craft.slice(1).filter(c => !c.branch || c.branch === br).map(c => `<b>${c.name}</b>: ${c.text}`).join('. ')}. Whichever you take, a full-grown hill tends its wounded: ants inside your nest mend.${more.length ? ` It also opens ${more.join(', ')}.` : ''}`; })()
    : 'The chamber is as wide as it will go.';
  document.querySelector('#diet .tabs [data-tab="grow"]').classList.toggle('ready', can);
  const per = r => sim.stat[ME].per[r];
  document.querySelector('#rooms [data-room="store"] small').textContent = `${per(ROOM.STORE)} food each`; document.querySelector('#rooms [data-room="rest"] small').textContent = `${per(ROOM.REST)} ants each`;
  if (can && tier === 0 && sim.tick > 400 && !(nestOpen && $('diet').dataset.tab === 'grow')) once('grow', 'Seeds to spare. Open Nest, then Grow: the queen\'s chamber can be widened.', 4200);
}
function startRun() {
  rec.start({ ...set.snapshot(), caste: camp.caste ?? 'none', way: camp.forks.way ?? 'none', craft: camp.forks.craft ?? 'none', nodes: nodesNow().join('+') || 'none', mode: NET ? 'room' : 'war', mission: missionId, ants: sim.cfg.antsBy?.[ME] ?? sim.cfg.ants, road: late(missionId) ? 'late' : camp.forks.road === missionId ? 'first' : 'none', hill: hillOf(missionId)?.from ?? 'new', dug: sim.cfg.nests ? sim.cfg.nests[ME].length / 3 : 0, look: `war:${set.get('view')}/${set.get('light')}/${set.get('style')}`, seed, v: 1 });
  if (!NET) host.ai[FOE] = rivalMind(); pickCaste();
  running = true; opening(); guideStart();
}
function play() { snd.unlock(); startSong(); if (NET) { if (host.started) { setScreen('play'); lastT = 0; snd.release(); } else host.begin(); return; } if (!isOpen(missionId)) return; if (!running) restart(false); else { setScreen('play'); lastT = 0; snd.release(); } }
// The menu: the campaign's missions in order, the fork between them, and what the chosen mission asks.
function renderPath() {
  const el = $('path'); el.textContent = '';
  let n = 0;
  for (const s of CAMPAIGN) {
    if (s.mission) {
      const m = MISSIONS[s.mission], d = camp.done[s.mission], b = document.createElement('button');
      b.className = 'step' + (d ? (d.won ? ' won' : ' lost') : ''); b.disabled = !isOpen(s.mission); b.setAttribute('aria-pressed', String(s.mission === missionId));
      const i = document.createElement('i'), name = document.createElement('span'), em = document.createElement('em');
      i.textContent = s.side ? '+' : String(++n); name.textContent = m.name; em.textContent = d ? (d.won ? `Won · best ${d.best}` : 'Lost') : b.disabled ? (s.side ? 'Opens after The Crossing' : 'Closed') : s.side ? 'New · the long game' : ROAD.pair.includes(s.mission) && !camp.forks.road ? `New · if left: ${ROAD.price[s.mission]}` : late(s.mission) ? `New · ${ROAD.price[s.mission]}` : 'New';
      b.append(i, name, em); b.addEventListener('click', () => { missionId = s.mission; renderPath(); tone(560, 0.06, 0.03, 'triangle'); });
      el.append(b);
    } else if (s.fork) {
      const open = STEPS.slice(0, n).every(x => camp.done[x]), mine = taken(s.fork), free = set.get('forks') === 'free', box = document.createElement('div'), head = document.createElement('b'), row = document.createElement('div'), note = document.createElement('p');
      box.className = 'fork'; head.textContent = FORK_HEAD[s.fork];
      const undone = STEPS.slice(0, n).filter(x => !camp.done[x]), left = undone.slice(undone.slice(-2).every(x => ROAD.pair.includes(x)) ? -2 : -1).map(x => MISSIONS[x].name), waits = `Opens when ${left.join(' and ')} ${left.length > 1 ? 'have' : 'has'} been played to ${left.length > 1 ? 'their' : 'its'} end.`;
      for (const v of optionsOf(s)) {
        const b = document.createElement('button'), small = document.createElement('small'), [name, what] = optionText(v);
        b.textContent = name; small.textContent = what; b.append(small);
        b.setAttribute('aria-pressed', String(mine === v)); b.disabled = !open || (!!mine && !free);
        b.addEventListener('click', () => { if (mine === v) return; if (mine) rec.event('refork', { fork: s.fork, from: mine, to: v }); if (s.fork === 'caste') { camp.caste = v; set.set('caste', v); for (const c of CAMPAIGN) if (c.by) delete camp.forks[c.fork]; /* a craft belongs to its caste */ } else camp.forks[s.fork] = v; saveCamp(); rec.event('fork', { fork: s.fork, pick: v }); missionId = firstOpen(); renderPath(); tone(700, 0.2, 0.05, 'triangle', 120); });
        row.append(b);
      }
      note.textContent = s.by ? (mine ? (free ? 'Yours for now: tap the other to change. The rival takes a craft for its own caste.' : 'Chosen for this campaign. The rival takes a craft for its own caste.') : open ? 'Choose one. It is kept for the whole campaign. The rival takes a craft for its own caste.' : waits) : mine ? (free ? 'Yours for now: tap the other to change. The rival has the other.' : 'Chosen for this campaign. The rival has the other.') : open ? 'Choose one. It is kept for the whole campaign, and the rival has the other.' : waits;
      box.append(head, row, note); el.append(box);
    }
  }
  const m = MISSIONS[missionId], t = TEXT[missionId], lost = startAnts()[0] < m.kit.ants;
  $('mKicker').textContent = m.name; $('mSub').textContent = t.sub;
  $('mGoals').textContent = ''; const hill = hillOf(missionId), kept = hill ? (() => { const n = [0, 0, 0, 0], l = hill.nests[ME] ?? []; for (let j = 2; j < l.length; j += 3) n[l[j] < 4 ? l[j] : 0]++; return `You start in your hill as you left it at ${MISSIONS[hill.from].name}: ${l.length / 3} cells dug, ${n[ROOM.STORE]} of them stores, ${n[ROOM.NURSERY]} nursery. Your ${n[ROOM.REST]} quarters cells are bare tunnels again: paint them as Quarters when you want the ants, with no digging to do.${(sidesOf(missionId)?.[ME] ?? -1) >= 0 ? ' Your second door is still open.' : ''} The rival starts in its own.`; })() : m.from && set.get('home') === 'carried' ? (camp.done[m.from] ? `This is the hill of ${MISSIONS[m.from].name}. Play that mission again to its end and you start here in the nest you dug there.` : `This is the hill of ${MISSIONS[m.from].name}. Finish that mission and you start here in the nest you dug there.`) : Object.values(MISSIONS).some(x => x.from === missionId) && set.get('home') === 'carried' ? 'What you dig here stays: the next mission on this hill starts in this nest.' : null;
  const other = ROAD.pair.find(x => x !== missionId), road = !ROAD.pair.includes(missionId) ? null : late(missionId) ? `You went to ${MISSIONS[other].name} first. ${ROAD.text[missionId]}` : camp.forks.road || ROAD.pair.some(x => camp.done[x]) ? null : `A fork in the road. ${MISSIONS[ROAD.pair[0]].name} and ${MISSIONS[ROAD.pair[1]].name} are both open, and the one you leave for later changes while you are away. Leave ${MISSIONS[ROAD.pair[0]].name}: ${ROAD.text[ROAD.pair[0]]} Leave ${MISSIONS[ROAD.pair[1]].name}: ${ROAD.text[ROAD.pair[1]]}`;
  for (const line of [...t.goals, ...(m.long ? [`The day is ${set.get('day')} minutes long and noon comes after ${Math.round(+set.get('day') * 0.4)}. It ends at dusk with the ants counted, or sooner if a queen dies. Settings change the length.`] : []), ...(lost ? [`Your last mission was lost: you start with ${startAnts()[0]} workers, not ${m.kit.ants}.`] : []), ...(kept ? [kept] : []), ...(road ? [road] : []), ...(visitorOf(missionId) ? [(V => `A weevil comes ${V.at.length} times for your food. It comes in at your door, eats at the nearest store cell that holds food, up to ${V.fill} seeds a visit, and goes no deeper than ${V.reach} steps from the door. At most it eats ${V.at.length * V.fill} seeds in all. You can pay that, or keep your food past its reach: dig stores deeper and unmark the store by your door (loads go to the store nearest the door first). Then every load of the mission walks about a dozen steps further each way. Or kill it: soldiers beside it bite it, and it is ${V.meat} loads of meat.`)(visitorOf(missionId))] : [])]) { const p = document.createElement('p'); p.textContent = line; $('mGoals').append(p); }
  $('play').textContent = running && host.sim.mission.id === missionId ? 'Resume' : 'Play'; $('play').disabled = !isOpen(missionId);
  $('fresh').hidden = !Object.keys(camp.done).length; $('fresh').textContent = 'New campaign'; freshArmed = false;
  renderDeeds($('mDeeds'), missionId, []); renderTree();
}
/** A mission's two deeds: done or not, and the node each opens. `fresh`: the ids done just now, for the result card. */
function renderDeeds(el, id, fresh) {
  el.textContent = ''; const h = document.createElement('h3'); h.textContent = 'Deeds'; el.append(h);
  for (const d of MISSIONS[id].deeds) {
    const p = document.createElement('p'), span = document.createElement('span'), small = document.createElement('small'), done = !!line.deeds[`${id}.${d.id}`], isNew = fresh.includes(d.id);
    p.className = (done ? 'done' : '') + (isNew ? ' new' : ''); span.textContent = d.text;
    small.textContent = isNew ? `Done. ${TRAITS[d.opens].name} is yours: ${TRAITS[d.opens].text}` : done ? `Done. It opened ${TRAITS[d.opens].name}.` : hasNode(d.opens) ? `Opens ${TRAITS[d.opens].name}, which you have.` : `Opens ${TRAITS[d.opens].name}.`;
    span.append(small); p.append(span); el.append(p);
  }
}
/** The Lineage: four boughs. A fork shows both sides (yours lit, the other struck out); a node is lit when a deed has opened it. */
let treeSel = null;
function renderTree() {
  const el = $('tree'); el.textContent = '';
  let have = 0, all = 0;
  const about = document.createElement('p'); about.className = 'about';
  const say = (key, name, text, how) => { treeSel = key; about.textContent = ''; const b = document.createElement('b'); b.textContent = `${name}. `; const sm = document.createElement('small'); sm.textContent = how; about.append(b, text, sm); for (const x of el.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.key === key)); };
  for (const bough of LINEAGE) {
    const box = document.createElement('div'), head = document.createElement('b'), row = document.createElement('div');
    box.className = 'bough'; row.className = 'row'; head.textContent = bough.name;
    bough.nodes.forEach((n, i) => {
      if (i) { const arrow = document.createElement('span'); arrow.textContent = '›'; row.append(arrow); }
      if (n.fork) {
        const step = CAMPAIGN.find(c => c.fork === n.fork), mine = taken(n.fork), opts = step.options ?? step.by[camp.caste] ?? [], at = CAMPAIGN.indexOf(step), prior = CAMPAIGN.slice(0, at).filter(c => c.mission && !c.side).map(c => c.mission), after = MISSIONS[prior.find(x => !camp.done[x]) ?? CAMPAIGN[at - 1].mission], open = prior.every(x => camp.done[x]);
        all++; if (mine) have++;
        if (!opts.length) { const b = document.createElement('button'); b.className = 'locked'; b.textContent = FORK_HEAD[n.fork]; b.dataset.key = n.fork; b.addEventListener('click', () => say(n.fork, FORK_HEAD[n.fork], 'One of two crafts for the caste you took.', 'Take a third caste first.')); row.append(b); return; }
        opts.forEach((v, j) => {
          if (j) { const or = document.createElement('span'); or.textContent = 'or'; row.append(or); }
          const b = document.createElement('button'), [name, what] = optionText(v);
          b.textContent = name; b.dataset.key = v; b.className = mine === v ? 'have' : mine ? 'shut' : open ? '' : 'locked';
          b.addEventListener('click', () => say(v, name, what, mine === v ? 'Yours for this campaign.' : mine ? 'Closed: you took the other side, and the rival has this one.' : open ? 'Open. Choose it in the list of missions above.' : `A fork. It opens when ${after.name} has been played to its end.`));
          row.append(b);
        });
      } else {
        const tr = TRAITS[n.node], got = hasNode(n.node), b = document.createElement('button');
        all++; if (got) have++;
        b.textContent = tr.name; b.dataset.key = n.node; b.className = got ? 'have' : 'locked';
        b.addEventListener('click', () => say(n.node, tr.name, tr.text, got ? `Yours. The rival has it too.${tr.at ? ` In a mission it opens when the chamber grows${tr.at[1] === BRANCH.WAR ? ' into a War hill' : tr.at[1] === BRANCH.DEEP ? ' into a Deep hill' : ' the second time'}.` : ''}` : `Opened by a deed: ${deedsFor(n.node).map(d => `${d.text.replace(/\.$/, '')} (${d.mission.name})`).join('; or ')}.`));
        row.append(b);
      }
    });
    box.append(head, row); el.append(box);
  }
  about.textContent = 'Tap a node to see what it does and how it opens.'; el.append(about);
  $('treeBtn').textContent = `The Lineage · ${have} of ${all}`;
}
$('treeBtn').addEventListener('click', () => { const open = $('tree').hidden; $('tree').hidden = !open; $('treeBtn').setAttribute('aria-expanded', String(open)); rec.event('lineage', { open: open ? 1 : 0 }); if (open) $('tree').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
let freshArmed = false;
renderPath();
function toMenu() { dropTouches(); if (running) rec.end('left', summary()); running = false; document.body.classList.remove('frost'); if (nestOpen) setNest(false); $('toast').classList.remove('on'); setScreen('menu'); renderPath(); }
function dropTouches() { run(Gs.reset('pause')); strokeW = []; nestDrag = null; }
function pauseGame() { if (screen !== 'play') return; dropTouches(); redraw(); setScreen('paused'); snd.hold(); }
function resume() { if (renderer?.lost) return; setScreen('play'); lastT = 0; snd.release(); startSong(); }
function restart(newSeed = true) {
  if (NET) return; /* a room is one match: a new one is a new room */
  dropTouches();
  if (running) rec.end('restart', summary());
  if (newSeed && !(qSeed > 0)) seed = 1 + Math.floor(Math.random() * 9999);
  host = newHost(); sim = host.sim; document.body.classList.remove('frost'); roomButtons(); sel = -1; floats = []; pulses = []; heard = []; told.heardAt = 0; beacon = null; parts.length = 0; trailSig = '?'; told.clear(); told.fullAt = told.popAt = told.qAt = 0; builds.clear(); firstTrail = false; danger = 0; setSpeed(1);
  if (tool !== 'trail') setTool('trail'); if (nestOpen) setNest(false);
  uploadTerrain(); uploadAnts(); startRun(); resume();
}
// ---- friends' rooms: the menu's block, and what a page in a room shows before the match ----
function roomHref(code, kind, side = 0) { const u = new URL(location.href); u.search = ''; u.searchParams.set('room', code); u.searchParams.set('mission', missionId); if (kind === 'coop') u.searchParams.set('bot', String(MOOD[set.get('rival')])); if (side) u.searchParams.set('side', '1'); if (query.get('roomHost')) u.searchParams.set('roomHost', query.get('roomHost')); if (query.get('labRunSource')) u.searchParams.set('labRunSource', query.get('labRunSource')); return u.href; }
let link = null, netState = 'connecting', netHere = new Map();
const NET_SAY = { connecting: 'Joining the room…', live: '', waiting: 'The room is out of reach. Trying again…', full: 'This room has four players already.', version: 'This room runs other rules or another version of the game. Open the link the room was shared with, or start a new room.', drift: 'This page has drifted from the room. Reload it to catch up.' };
function netCard() {
  if (!NET) return;
  const mates = [...netHere.values()], mine = mates.filter(s => s.team === ME).length, theirs = mates.length - mine, bots = mates.filter(s => s.bot).length;
  $('roomInfo').textContent = NET_SAY[netState] || (host.started ? 'The match is on.' : `Room ${NET}. ${mates.length} here: ${mine} on your hill, ${NET_BOT === null ? `${theirs} on the far hill` : 'the machine plays the far hill'}${bots ? ` (${bots} machine player${bots > 1 ? 's' : ''})` : ''}. Share the link, then start.`);
  $('play').textContent = host.started ? 'Back to the match' : 'Start the match'; $('play').disabled = netState !== 'live';
}
function netSeats(s) { netHere = new Map(s); netCard(); }
function netStarted() { netCard(); if (!running) { uploadTerrain(); uploadAnts(); startRun(); } resume(); toast(host.behind > 40 ? 'Catching up with the room…' : 'The match begins', 2400); }
if (NET) {
  document.body.classList.add('room'); $('speed').hidden = true;
  $('roomShare').addEventListener('click', async () => { const how = await shareLink(roomHref(NET, NET_BOT === null ? 'vs' : 'coop', NET_BOT === null ? 1 - ME : ME), NET_BOT === null ? 'Play Cinderhill against me' : 'Play Cinderhill with me'); toast(how === 'copied' ? 'Link copied' : how === 'shared' ? 'Sent' : 'Copy the link from the address bar', 2400); });
  link = roomLink({ url: ROOM_URL, code: NET, seed, sim: roomSim({ mission: missionId, bot: NET_BOT, botSide: query.get('botSide') === '0' ? 0 : 1 }), host: () => host, store: (() => { try { return sessionStorage; } catch { return null; } })(), onStatus: s => { netState = s; netCard(); if (s !== 'live' && s !== 'connecting' && screen === 'play') toast(NET_SAY[s], 4000, true); } });
  netCard();
} else {
  $('roomVs').addEventListener('click', () => { location.href = roomHref(newCode(), 'vs'); });
  $('roomCoop').addEventListener('click', () => { location.href = roomHref(newCode(), 'coop'); });
}
$('play').addEventListener('click', play);
$('pause').addEventListener('click', pauseGame);
$('resume').addEventListener('click', resume);
$('restart').addEventListener('click', () => restart());
$('again').addEventListener('click', () => restart());
$('toMenu').addEventListener('click', toMenu);
$('next').addEventListener('click', () => { if (NET) { location.href = roomHref(newCode(), NET_BOT === null ? 'vs' : 'coop'); return; } missionId = firstOpen(); toMenu(); });
$('fresh').addEventListener('click', () => { if (!freshArmed) { freshArmed = true; $('fresh').textContent = 'Tap again to erase the campaign'; return; } camp = { v: 1, done: {}, caste: null, forks: {} }; saveCamp(); line = { v: 1, deeds: {} }; saveLine(); hills = { v: 1, after: {} }; saveHills(); doors = { v: 1, after: {} }; saveDoors(); rec.event('campaign', { fresh: 1 }); missionId = STEPS[0]; renderPath(); });
$('harder').addEventListener('click', () => { const v = set.get('rival'); set.set('rival', won ? (v === 'timid' ? 'steady' : 'bold') : v === 'bold' ? 'steady' : 'timid'); restart(); });
onLeave(pauseGame);
addEventListener('keydown', e => { if (isPauseKey(e)) { if (screen === 'play') pauseGame(); else if (screen === 'paused') resume(); e.preventDefault(); } });
for (const c of document.querySelectorAll('.chip[data-say]')) c.addEventListener('click', () => toast(c.dataset.say, 2800));

// ---- tools and orders ----
function setTool(next) {
  if (next === tool) return;
  run(Gs.reset('tool')); tool = next;
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  if (tool === 'raid') toast(g(ME, CG.MAJORS) ? 'Tap where the soldiers should go. Tap the rival door to break in.' : 'You have no soldiers yet. Open Nest, then Young, and raise some.', 2600);
  else if (tool === 'rally') toast('Hold a finger down: guards and resting ants gather there', 3000);
  else if (tool === 'camera') toast('Drag to move the view. Pinch to zoom.');
  tone(520, 0.05, 0.03, 'triangle');
}
document.body.dataset.nest = set.get('nest');
function setNest(on) { nestOpen = on; document.body.dataset.nest = set.get('nest'); document.body.classList.toggle('nest', on); $('nestBtn').setAttribute('aria-pressed', String(on)); $('diet').classList.toggle('on', on); if (on) $('route').classList.remove('on'); if (running) rec.event('nest', { on: on ? 1 : 0, at: sim.tick }); requestAnimationFrame(resize); }
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
$('nestBtn').addEventListener('click', () => setNest(!nestOpen));
function order(o) { const id = host.order({ ...o, team: ME }); if (running) rec.event('order', { at: sim.tick, t: o.type, k: o.kind ?? null, l: o.level ?? o.share ?? o.on ?? null, n: o.points ? o.points.length / 2 : null }); return id; }
$('raise').addEventListener('click', () => { setNest(true); document.querySelector('#diet .tabs [data-tab="young"]').click(); if (!g(ME, CG.DIET)) toast('Pick how many of the young become soldiers. Each costs meat.', 3600); });
$('recall').addEventListener('click', () => { const on = !g(ME, CG.RECALL); order({ type: CMD.RECALL, on: on ? 1 : 0 }); toast(on ? 'Everyone comes home' : 'Out again'); tone(on ? 330 : 520, 0.2, 0.05, 'triangle', on ? -120 : 160); });
const SPEEDS = [1, 2, 4];
function setSpeed(x) { speed = x; $('speedText').textContent = `${x}×`; $('speed').setAttribute('aria-pressed', String(x > 1)); }
$('speed').addEventListener('click', () => { setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]); rec.event('speed', { at: sim.tick, x: speed }); tone(500 + 150 * speed, 0.06, 0.03, 'triangle'); });
for (const b of document.querySelectorAll('#specials [data-special]')) b.addEventListener('click', () => { order({ type: CMD.DIET, share: Math.min(g(ME, CG.DIET), 4 - Number(b.dataset.special)), special: Number(b.dataset.special) }); tone(600 + 60 * Number(b.dataset.special), 0.08, 0.04, 'triangle'); setTimeout(hud, 80); });
for (const b of document.querySelectorAll('#diets [data-diet]')) b.addEventListener('click', () => { order({ type: CMD.DIET, share: Number(b.dataset.diet) }); tone(560 + 60 * Number(b.dataset.diet), 0.08, 0.04, 'triangle'); setTimeout(hud, 80); });
let sel = -1, routeUntil = 0, firstTrail = false;
const showRoute = (ms = 6000) => { routeUntil = performance.now() + ms; };
for (const b of document.querySelectorAll('#modes [data-mode]')) b.addEventListener('click', () => { if (sel < 0) return; order({ type: CMD.CREW, trail: sel, mode: Number(b.dataset.mode) }); rec.event('mode', { mode: Number(b.dataset.mode) }); tone(440 + 110 * Number(b.dataset.mode), 0.08, 0.04, 'triangle'); showRoute(); setTimeout(hud, 80); });
for (const b of document.querySelectorAll('#levels [data-level]')) b.addEventListener('click', () => { if (sel < 0) return; order({ type: CMD.CREW, trail: sel, level: Number(b.dataset.level) }); tone(500 + 90 * Number(b.dataset.level), 0.08, 0.04, 'triangle'); showRoute(); setTimeout(hud, 80); });
$('erase').addEventListener('click', () => { if (sel < 0) return; order({ type: CMD.ERASE, trail: sel }); sel = -1; routeUntil = 0; tone(260, 0.12, 0.05, 'triangle', -80); setTimeout(hud, 80); });

let preview = null, strokeW = [], pending = [], rallyAt = null;
function strokeTake(pts) { if (pts.length < strokeW.length) strokeW = []; for (let i = strokeW.length; i < pts.length; i++) { const w = toWorld(pts[i][0], pts[i][1]); strokeW.push([w.x, w.y]); } }
function trailPoints() {
  const pts = [];
  for (const [wx, wy] of strokeW) { const x = Math.floor(wx), y = Math.floor(wy), l = pts[pts.length - 1]; if (!l || l[0] !== x || l[1] !== y) pts.push([x, y]); }
  if (pts.length < 2) return null;
  return (pts.length <= 64 ? pts : Array.from({ length: 64 }, (_, k) => pts[Math.round(k * (pts.length - 1) / 63)])).flat();
}
const trailMid = new Map();
function pickTrailAt(sx, sy) {
  let best = -1, bd = 30 * 30;
  for (const [k, m] of trailMid) { if (k >= TRAILS) continue; const p = toScreen(m.x, m.y, 1.6), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < bd) { bd = d; best = k; } }
  if (best < 0) {
    // A tap is a short order: Raid sends the soldiers to that spot, Forage sends workers to a food pile under the finger.
    routeUntil = 0;
    const w = toWorld(sx, sy), x = Math.floor(w.x), y = Math.floor(w.y);
    const fd = doorXY(FOE), nearDoor = Math.abs(w.x - fd.x) <= 6 && Math.abs(w.y - fd.y) <= 6 || (() => { const b = toScreen(fd.x, fd.y, 3.2); return Math.abs(b.x - sx) < 34 && Math.abs(b.y - sy) < 20; })();
    if (tool === 'raid' && nearDoor) { const p2 = [Math.floor(fd.x), Math.floor(fd.y)]; pending.push({ id: order({ type: CMD.TRAIL, kind: KIND.RAID, level: sim.mission.goals.haul ? 3 : 2, points: p2 }), points: p2, kind: KIND.RAID }); }
    else if (tool === 'raid' && sim.beast[0] > 0 && (() => { const bc = sim.beast[1], b = toScreen(bc % L0.sw + 0.5, Math.floor(bc / L0.sw) + 0.5, 1); return Math.abs(w.x - bc % L0.sw) <= 4 && Math.abs(w.y - Math.floor(bc / L0.sw)) <= 4 || Math.hypot(b.x - sx, b.y - sy) < 44; })()) { const bc = sim.beast[1], p2 = [bc % L0.sw, Math.floor(bc / L0.sw)]; pending.push({ id: order({ type: CMD.TRAIL, kind: KIND.RAID, level: 2, points: p2 }), points: p2, kind: KIND.RAID }); toast(g(ME, CG.MAJORS) ? 'Half your soldiers go for the beetle. Tap the trail to send more.' : 'A raid trail to the beetle. You have no soldiers yet: raise some in the Nest.', 3200); }
    else if (tool === 'raid') pending.push({ id: order({ type: CMD.TRAIL, kind: KIND.RAID, level: 2, points: [x, y] }), points: [x, y], kind: KIND.RAID });
    else if (tool === 'trail') {
      // The nearest pile to the tap, not the first in the list: beside the fallen beetle lies other meat, and only the beetle's own counts.
      let best = -1, bd = 99; const bc = sim.fallen ? sim.beast[1] : -1;
      for (let p = 0; p < MAX_PILES; p++) { if (sim.pileAmount[p] <= 0) continue; const c = sim.pileCell[p], px = c % L0.sw, py = Math.floor(c / L0.sw); if (Math.abs(px - x) > 2 || Math.abs(py - y) > 2) continue; const d = c === bc ? -1 : Math.abs(px - x) + Math.abs(py - y); if (d < bd) { bd = d; best = p; } }
      if (best >= 0) { const c = sim.pileCell[best], px = c % L0.sw, py = Math.floor(c / L0.sw); pending.push({ id: order({ type: CMD.TRAIL, kind: KIND.FORAGE, level: 2, points: [px, py] }), points: [px, py], kind: KIND.FORAGE }); }
    }
    return;
  }
  sel = best; showRoute(); hud(); tone(600, 0.05, 0.03, 'triangle');
}
function act(a) {
  switch (a.type) {
    case 'preview': preview = a; strokeTake(a.points); break;
    case 'clear': preview = null; break;
    case 'pan': { const o = toWorld(W / 2, H / 2), w = toWorld(W / 2 + a.dx, H / 2 + a.dy); cam.x -= w.x - o.x; cam.y -= w.y - o.y; camGoal = null; clampCam(); break; }
    case 'zoom': { const b = toWorld(a.x, a.y); cam.z *= a.f; clampCam(); const c = toWorld(a.x, a.y); cam.x += b.x - c.x; cam.y += b.y - c.y; camGoal = null; clampCam(); break; }
    case 'order': {
      strokeTake(a.points);
      const points = trailPoints(); strokeW = []; if (!points) break;
      const kind = tool === 'raid' ? KIND.RAID : KIND.FORAGE;
      pending.push({ id: order({ type: CMD.TRAIL, kind, level: 2, points }), points, kind });
      tone(520, 0.05, 0.03, 'triangle');
      break;
    }
    case 'alarm': {
      if (a.phase === 'start') {
        const w = toWorld(a.x, a.y); rallyAt = { x: Math.floor(w.x) + 0.5, y: Math.floor(w.y) + 0.5, at: performance.now() };
        order({ type: CMD.RALLY, x: Math.floor(w.x), y: Math.floor(w.y), hold: 600 });
        tone(880, 0.25, 0.05, 'sawtooth', -300); shake = 0.2; navigator.vibrate?.(12); toast('They gather there for half a minute');
      }
      break;
    }
    case 'tap': pickTrailAt(a.x, a.y); break;
  }
}
function run(actions) { for (const a of actions) act(a); }
const P = e => ({ id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), kind: e.pointerType, button: e.button, primary: e.isPrimary });
// With the "hill" finger setting a trail or raid stroke starts at your own door; a drag that starts anywhere else moves
// the view, so the Move tool is never needed. A tap still acts as a tap either way.
const DOOR_PX = 64;
function gestureTool(p) {
  if (tool === 'rally') return 'alarm';
  if (tool === 'camera') return tool;
  if (set.get('finger') === 'hill' && p) { const d = doorXY(ME), q = toScreen(d.x, d.y, 0); if (Math.hypot(q.x - p.x, q.y - p.y) > DOOR_PX) return 'camera'; }
  return 'trail';
}
ui.addEventListener('pointerdown', e => { if (screen !== 'play') return; if (!Gs.state.stroke) strokeW = []; try { ui.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ } { const p = P(e); run(Gs.down(p, gestureTool(p))); }; });
ui.addEventListener('pointermove', e => { if (screen === 'play') run(Gs.move(P(e))); });
ui.addEventListener('pointerup', e => { if (screen === 'play') run(Gs.move(P(e))); run(Gs.up(P(e))); });
ui.addEventListener('pointercancel', e => run(Gs.cancel(e.pointerId, 'pointercancel')));
ui.addEventListener('lostpointercapture', e => run(Gs.cancel(e.pointerId, 'lostpointercapture')));
ui.addEventListener('contextmenu', e => e.preventDefault());
ui.addEventListener('wheel', e => { if (screen !== 'play') return; e.preventDefault(); act({ type: 'zoom', f: Math.exp(-e.deltaY * 0.0015), x: e.clientX, y: e.clientY }); }, { passive: false });
$('mini').addEventListener('pointerdown', e => { const r = $('mini').getBoundingClientRect(); camGoal = null; cam.x = (e.clientX - r.left) / r.width * L0.sw; cam.y = (e.clientY - r.top) / r.height * L0.sh; clampCam(); e.stopPropagation(); });
// The nest: with Look, a drag moves the view; with a room tool, a drag paints cells and lifting the finger sends the orders.
let nestDrag = null, nestTool = 'look', paint = null;
const builds = new Set(); // ids of the build orders sent, to tell a refused one from a refused trail
const ROOM_OF = { store: ROOM.STORE, nursery: ROOM.NURSERY, rest: ROOM.REST, post: ROOM.POST, garden: ROOM.GARDEN, mess: ROOM.MESS };
const ROOM_CSS = ['', '255, 196, 90', '240, 232, 214', '140, 214, 150', '255, 120, 96', '196, 150, 255', '120, 200, 255'];
const nestCell = e => { const r = nestCanvas.getBoundingClientRect(); return [Math.floor((e.clientX - r.left - NW / 2) / nestCam.z + nestCam.x), Math.floor((e.clientY - r.top - 26) / nestCam.z + nestCam.y)]; };
function paintAt(e) {
  const r = nestCanvas.getBoundingClientRect(); if (e.clientY < r.top + 26 || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) return; // only what is on screen
  const [x, y] = nestCell(e), k = y * L0.nw + x;
  if (x < 0 || x >= L0.nw || y < 0 || y >= L0.nh || (sim.owner(k) !== ME && !(sim.mayBreach(ME) && (paint.tool === 'tunnel' || paint.tool === 'clear'))) || paint.seen.has(k)) return; // the sim refuses what it must
  paint.seen.add(k); paint.cells.push(x, y);
}
$('need').addEventListener('click', () => { const r = $('need').dataset.room; setNestTab('dig'); if (r) setNestTool(r); });
function setNestTab(t) { $('diet').dataset.tab = t; for (const b of document.querySelectorAll('#diet .tabs [data-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tab === t)); if (t !== 'dig' && nestTool !== 'look') setNestTool('look'); }
for (const b of document.querySelectorAll('#diet .tabs [data-tab]')) b.addEventListener('click', () => { setNestTab(b.dataset.tab); tone(480, 0.05, 0.03, 'triangle'); });
const DIG_HELP = { door: `Second door: tap the end of a tunnel dug along the top of your ground (the third row down), at least ${C.DOOR_APART} cells from your door. ${C.DOOR_SUGAR} seeds. New trails start at the nearer door, and it is still open in the next mission on this hill.`, plug: `Plug: tap an open tunnel of yours to pack it shut, ${C.PLUG_SUGAR} seeds. It takes five times as long to dig out. Not in a room, not with the rival near, and no more than ${C.PLUGS_MAX} at once.`, look: 'Pick a room, then drag one finger in the earth beside a tunnel. Two fingers move and zoom the view.', tunnel: 'Tunnel: drag through the earth, a seed to dig a cell. Seeds showing in the clay are an old cache: dig to it and it is carried to your stores.', store: 'Store: each cell holds 8 more seeds and 8 more meat. Drag in the earth: a seed to dig a cell.', nursery: 'Nursery: each cell holds one more egg or grub. Drag in the earth: a seed to dig a cell.', rest: 'Quarters: each cell houses 4 more ants. Drag in the earth: a seed to dig a cell.', garden: `Fungus garden: each cell pays a seed a minute with no trail to guard, and houses one ant fewer (its gardeners live in it). A raid can still carry the seeds off.`, mess: `Mess: a soldier eats as three ants. Each cell feeds ${C.MESS_FEEDS} soldiers as one ant each, so a cell saves most of a seed a minute once you have the soldiers to fill it. It houses nobody. Drag in the earth: a seed to dig a cell.`, post: 'Guard post: each cell keeps one in eight of your idle soldiers standing here, inside, and not out by the door.', clear: 'Drag over marks or rooms to take them off. Dug earth stays dug.', strike: 'Strike: tap an open cell in the rival nest. Half your soldiers go there under ground and on to the queen. Tap the mark again to send them all, and again to call them back.' };
function roomButtons() { for (const b of document.querySelectorAll('#rooms [data-room]')) b.hidden = b.dataset.room === 'door' ? !sim.mayDoor(ME) || sim.side[ME] >= 0 : b.dataset.room === 'strike' ? !sim.mayBreach(ME) : b.dataset.room === 'plug' ? !sim.mayPlug() : !!ROOM_OF[b.dataset.room] && !sim.mayRoom(ME, ROOM_OF[b.dataset.room]); if (nestTool === 'strike' && !sim.mayBreach(ME)) setNestTool('look'); if (nestTool === 'door' && (!sim.mayDoor(ME) || sim.side[ME] >= 0)) setNestTool('look'); if (nestTool === 'plug' && !sim.mayPlug()) setNestTool('look'); if (ROOM_OF[nestTool] && !sim.mayRoom(ME, ROOM_OF[nestTool])) setNestTool('look'); }
roomButtons();
function setNestTool(t) { nestTool = t; delete $('digHelp').dataset.text; $('digHelp').textContent = sim.cfg.digSugar ? DIG_HELP[t] : DIG_HELP[t].replace(/a seed to dig a cell/g, 'soft ground here, no seed to dig'); if (t !== 'look' && $('diet').dataset.tab !== 'dig') setNestTab('dig'); for (const b of document.querySelectorAll('#rooms [data-room]')) b.setAttribute('aria-pressed', String(b.dataset.room === t)); }
for (const b of document.querySelectorAll('#rooms [data-room]')) b.addEventListener('click', () => { setNestTool(b.dataset.room); tone(500, 0.06, 0.03, 'triangle'); });
// One finger digs with a room in hand and moves the view with none; two fingers always move and zoom, as on the surface.
// A second finger ends a stroke unsent, so a pinch never spends seeds. A stroke that starts off your ground moves the view.
const nestPts = new Map(); let nestPinch = null;
const NEST_Z = [6, 28];
function nestPan(dx, dy) { nestCam.x = Math.max(8, Math.min(L0.nw - 8, nestCam.x - dx / nestCam.z)); nestCam.y = Math.max(0, Math.min(L0.nh - 10, nestCam.y - dy / nestCam.z)); }
function nestZoomAt(f, cx, cy) {
  const r = nestCanvas.getBoundingClientRect(), z0 = nestCam.z, z1 = Math.max(NEST_Z[0], Math.min(NEST_Z[1], z0 * f)); if (z1 === z0) return;
  const wx = (cx - r.left - NW / 2) / z0 + nestCam.x, wy = (cy - r.top - 26) / z0 + nestCam.y;
  nestCam.z = z1; nestZoomed = true; nestCam.x = wx - (cx - r.left - NW / 2) / z1; nestCam.y = wy - (cy - r.top - 26) / z1; nestPan(0, 0);
}
const paintCost = () => { if (!paint || paint.tool === 'clear' || paint.tool === 'plug') return 0; let n = 0; for (let j = 0; j < paint.cells.length; j += 2) { const k = paint.cells[j + 1] * L0.nw + paint.cells[j]; if (sim.mat[L0.nestBase + k] === MAT.CLAY && sim.mark[k] !== ME + 1) n++; } return n * sim.cfg.digSugar; };
nestCanvas.addEventListener('pointerdown', e => {
  try { nestCanvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  nestPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (nestPts.size === 2) { const [p, q] = [...nestPts.values()]; if (paint) rec.event('nestPinch', { cut: paint.cells.length / 2, at: sim.tick }); paint = null; nestDrag = null; nestPinch = { d: Math.hypot(p.x - q.x, p.y - q.y) || 1, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; return; }
  if (nestPts.size > 2 || nestDrag) return;
  nestDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
  if (nestTool !== 'look' && nestTool !== 'strike' && nestTool !== 'door' && running) { paint = { cells: [], seen: new Set(), tool: nestTool }; paintAt(e); if (!paint.cells.length) paint = null; }
});
nestCanvas.addEventListener('pointermove', e => {
  const pt = nestPts.get(e.pointerId); if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
  if (nestPinch && nestPts.size >= 2) { const [p, q] = [...nestPts.values()], d = Math.hypot(p.x - q.x, p.y - q.y) || 1, x = (p.x + q.x) / 2, y = (p.y + q.y) / 2; nestPan(x - nestPinch.x, y - nestPinch.y); nestZoomAt(d / nestPinch.d, x, y); nestPinch = { d, x, y }; return; }
  if (!nestDrag || e.pointerId !== nestDrag.id) return;
  if (paint) { const n = Math.max(1, Math.ceil(Math.hypot(e.clientX - nestDrag.x, e.clientY - nestDrag.y) / (nestCam.z * 0.5))); for (let j = 1; j <= n; j++) paintAt({ clientX: nestDrag.x + (e.clientX - nestDrag.x) * j / n, clientY: nestDrag.y + (e.clientY - nestDrag.y) * j / n }); }
  else nestPan(e.clientX - nestDrag.x, e.clientY - nestDrag.y);
  nestDrag.x = e.clientX; nestDrag.y = e.clientY; nestDrag.far = Math.max(nestDrag.far | 0, Math.hypot(e.clientX - nestDrag.x0, e.clientY - nestDrag.y0));
});
nestCanvas.addEventListener('pointerup', e => {
  nestPts.delete(e.pointerId);
  if (nestPinch) { if (nestPts.size < 2) nestPinch = null; if (nestPts.size === 0) nestDrag = null; return; }
  if (!nestDrag || e.pointerId !== nestDrag.id) return;
  if (paint && paint.cells.length) {
    const cells = paint.cells, nestTool = paint.tool; // the tool the stroke began with
    const cost = paintCost();
    builds.add(order(nestTool === 'plug' ? { type: CMD.FILL, cells: cells.slice(0, 2 * C.PLUGS_MAX) } : nestTool === 'tunnel' ? { type: CMD.DIG, cells } : { type: CMD.ROOM, cells, kind: nestTool === 'clear' ? ROOM.NONE : ROOM_OF[nestTool], dig: 1 }));
    rec.event('build', { tool: nestTool, cells: cells.length / 2, at: sim.tick, cost, seeds: sim.g(ME, CG.SUGAR) }); tone(380, 0.1, 0.04, 'triangle', 90); navigator.vibrate?.(8);
  }
  if (nestTool === 'strike' && running && (nestDrag.far | 0) < 10) strikeAt(...nestCell(e));
  if (nestTool === 'door' && running && (nestDrag.far | 0) < 10) { const [x] = nestCell(e); builds.add(order({ type: CMD.DOOR, x })); }
  paint = null; nestDrag = null;
});
nestCanvas.addEventListener('wheel', e => { e.preventDefault(); nestZoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
// A raid under ground. One at a time: a tap on its mark sends every soldier, the next tap calls it off; a tap elsewhere moves it.
const underTrail = t => { for (let k = 0; k < TRAILS; k++) { const s2 = t * TRAILS + k; if (sim.trLive[s2] && sim.trPath[s2 * PATH_MAX] >= L0.nestBase) return k; } return -1; };
function strikeAt(x, y) {
  if (x < 0 || x >= L0.nw || y < 0 || y >= L0.nh) return;
  const k = underTrail(ME), m = L0.nestBase + y * L0.nw + x;
  if (k >= 0) {
    const s2 = ME * TRAILS + k, e = sim.trPath[s2 * PATH_MAX] - L0.nestBase, near = Math.abs(e % L0.nw - x) <= 1 && Math.abs(Math.floor(e / L0.nw) - y) <= 1;
    if (near && sim.trLevel[s2] < 3) { order({ type: CMD.CREW, trail: k, level: 3 }); toast('Every soldier goes, and workers with them'); tone(700, 0.12, 0.05, 'sawtooth', 120); return; }
    if (near) { order({ type: CMD.ERASE, trail: k }); toast('The strike is called off'); tone(330, 0.2, 0.05, 'triangle', -80); return; }
  }
  if (sim.mat[m] !== MAT.OPEN) { toast('Tap an open cell: a tunnel or a room.', 2200); return; }
  if (sim.owner(m - L0.nestBase) !== ME && !sim.linked) { toast('Your tunnel is not through yet. Dig until it meets theirs.', 2600); return; }
  if (k >= 0) order({ type: CMD.ERASE, trail: k });
  if (!g(ME, CG.MAJORS)) toast('You have no soldiers yet. Raise some under Young.', 2600);
  order({ type: CMD.TRAIL, kind: KIND.RAID, level: 2, under: [x, y] }); navigator.vibrate?.(20);
}
for (const n of ['pointercancel', 'lostpointercapture']) nestCanvas.addEventListener(n, e => { nestPts.delete(e.pointerId); if (nestPts.size < 2) nestPinch = null; if (nestDrag && e.pointerId !== nestDrag.id) return; nestDrag = null; paint = null; });

// ---- what the sim reports, shown ----
const told = new Set();
// First steps: six things to do in the first mission, each ticked off by what the hill shows, not by a tap.
// The page reads sim state only; the steps give no order and change no rule.
const GUIDE_KEY = 'cinderhill:war:guided';
const myTrails = kind => { let n = 0; for (let k = 0; k < TRAILS; k++) if (sim.trLive[ME * TRAILS + k] && sim.trKind[ME * TRAILS + k] === kind) n++; return n; };
const GUIDE = [
  { say: '<b>Feed the hill.</b> Tap Forage, then drag from your hill to a pile of food.', done: () => myTrails(KIND.FORAGE) > 0 },
  { say: '<b>Yellow is seeds, red is meat.</b> Draw a second trail, to red food: soldiers are raised on meat.', done: () => myTrails(KIND.FORAGE) > 1 || g(ME, CG.LOADS_P) > 0 },
  { say: '<b>Open the Nest</b> on the bar below. The hill lives down there.', done: () => nestOpen },
  { say: '<b>Dig a room.</b> Tap Dig rooms, pick Store, and drag one finger in the earth beside a tunnel. Each cell costs a seed.', done: () => g(ME, CG.MARKS) > 0 || g(ME, CG.CAP_FOOD) > guideCap },
  { say: '<b>Raise soldiers.</b> In the Nest, on Young, tap 1 in 4. A soldier grub eats 3 meat.', done: () => g(ME, CG.DIET) > 0 },
  { say: '<b>Hold a ford.</b> Back on the surface, tap Raid and drag from your hill to a ford: your soldiers stand there.', done: () => myTrails(KIND.RAID) > 0 },
];
let guideStep = -1, guideCap = 0, guideEnd = 0;
function guideStart() {
  let seen = false; try { seen = !!localStorage.getItem(GUIDE_KEY); } catch { /* no storage */ }
  const v = set.get('guide'); guideStep = !NET && missionId === STEPS[0] && v !== 'off' && (v === 'always' || !seen) ? 0 : -1; guideCap = g(ME, CG.CAP_FOOD); guideEnd = 0; guideShow();
}
function guideShow() {
  const el = $('guide'), on = guideStep >= 0; el.hidden = !on; document.body.classList.toggle('guided', on); if (!on) return;
  $('guideText').innerHTML = guideStep < GUIDE.length ? GUIDE[guideStep].say : '<b>That is the whole hill:</b> feed, dig, raise, raid. The larger colony at dusk wins.';
  $('guideN').textContent = guideStep < GUIDE.length ? `${guideStep + 1} of ${GUIDE.length}` : ''; $('guideSkip').textContent = guideStep < GUIDE.length ? 'Skip' : 'Done';
}
function guideStop(why) { if (guideStep < 0) return; rec.event('guide', { step: guideStep, at: sim.tick, end: why }); try { localStorage.setItem(GUIDE_KEY, '1'); } catch { /* no storage */ } guideStep = -1; guideShow(); }
$('guideSkip').addEventListener('click', () => guideStop(guideStep >= GUIDE.length ? 'done' : 'skip'));
function guideTick() {
  if (guideStep < 0 || screen !== 'play') return;
  if (guideStep >= GUIDE.length) { if (performance.now() > guideEnd) guideStop('done'); return; }
  let moved = false; while (guideStep < GUIDE.length && GUIDE[guideStep].done()) { rec.event('guide', { step: guideStep, at: sim.tick }); guideStep++; moved = true; }
  if (moved) { if (guideStep >= GUIDE.length) guideEnd = performance.now() + 7000; tone(740, 0.08, 0.03, 'triangle', 120); guideShow(); }
}
let heard = []; // cells a colony opened in the other's ground, lately: drawn as rings in the nest view
$('toast').addEventListener('click', () => { const f = toastAct; if (!f) return; toastAct = null; $('toast').classList.remove('on', 'tap'); f(); });
const lookAt = (x, y) => { if (nestOpen) setNest(false); camGoal = { x, y, z: Math.max(cam.z, startZoom()), rate: 3 }; };
const once = (key, text, ms, bad) => { if (told.has(key)) return; told.add(key); toast(text, ms, bad); };
let won = false, beastBit = -1e9, beastTold = false;
const summary = () => ({ tick: sim.tick, door: sim.side[ME] >= 0 ? 1 : 0, foeDoor: sim.side[FOE] >= 0 ? 1 : 0, ...(sim.cfg.pest ? { weevilAte: sim.pest[ME * 8 + 5], weevilsKilled: sim.pest[ME * 8 + 6], foeWeevilAte: sim.pest[FOE * 8 + 5] } : {}), harm: g(ME, CG.HARM), foeHarm: g(FOE, CG.HARM), meat: sim.carried(ME), foeMeat: sim.carried(FOE), haul: g(ME, CG.HAUL), foeHaul: g(FOE, CG.HAUL), points: g(ME, CG.POINTS), foePoints: g(FOE, CG.POINTS), adults: g(ME, CG.ADULTS), majors: g(ME, CG.MAJORS), foe: g(FOE, CG.ADULTS), born: g(ME, CG.BORN), died: g(ME, CG.DIED), kills: g(ME, CG.KILLS), loads: g(ME, CG.LOADS_S) + g(ME, CG.LOADS_P), stolen: g(ME, CG.STOLEN), lost: g(ME, CG.LOST), queen: g(ME, CG.QUEEN_HP), foeQueen: g(FOE, CG.QUEEN_HP), orders: host.log.filter(o => o.team === ME).length });
function news() {
  const ev = host.drain(), now = performance.now(), sw = L0.sw;
  let deaths = 0;
  for (let k = 0; k < ev.length; k += 4) {
    const type = ev[k], a = ev[k + 1], b = ev[k + 2], c = ev[k + 3];
    if (type === EVENT.HOME && a === ME) {
      const e = doorXY(ME), f = floats.find(f => f.kind === b && now - f.at < 500);
      burst(e.x, e.y, KIND_COL[b], 4, { size: 0.3 });
      if (f) { f.n++; f.at = now; } else floats.push({ x: e.x + (b ? 1.6 : -1.6), y: e.y, at: now, t0: now, n: 1, kind: b, col: b ? '#ff9d7a' : '#ffe08a' });
      if (!(set.get('sound') === 'all' && song?.ember?.())) tone(1500 + Math.random() * 500, 0.04, 0.02, 'sine', 300);
    } else if (type === EVENT.BORN && a === ME) {
      const e = doorXY(ME); burst(e.x, e.y, b ? [1, 0.5, 0.35] : [1, 0.95, 0.7], b ? 14 : 6, { vh: 5, life: 1.1 });
      if (b === CASTE.MAJOR) { once('major', 'A soldier is born. She guards the door until you draw a raid.', 3600); tone(440, 0.2, 0.05, 'sawtooth', 200); }
      else if (b) { once('special', b === CASTE.SPITTER ? 'A spitter is born. She spits from two cells away.' : 'A warden is born. Slow, and very hard to kill.', 3600); tone(520, 0.2, 0.05, 'sawtooth', 240); }
    } else if (type === EVENT.DIED) {
      if (b < L0.nestBase) { const x = b % sw + 0.5, y = Math.floor(b / sw) + 0.5; burst(x, y, a === ME ? [1, 0.45, 0.2] : [0.45, 0.6, 1], c ? 9 : 5, { vh: 3, size: 0.3 }); }
      if (a === ME) deaths++;
    } else if (type === EVENT.PILE_EMPTY) { /* its trail goes dry: see DRY */ }
    else if (type === EVENT.DRY && a === ME) { toast('That food is gone. The trail waits for more.'); tone(300, 0.2, 0.04, 'triangle', -90); }
    else if (type === EVENT.FOUND) { if (a === ME) { toast(c >> 1 ? `A cache: ${c >> 1} loads of ${c & 1 ? 'meat' : 'seed'} carried to your stores` : 'A cache, and no room in your stores: it spoiled', 3200, !(c >> 1)); rec.event('cache', { at: sim.tick, loads: c >> 1, kind: c & 1 }); } }
    else if (type === EVENT.HEARD) {
      if (a === ME) heard.push({ k: b - L0.nestBase, at: now });
      if (a === ME && now - (told.heardAt ?? 0) > 15000) { told.heardAt = now; if (!told.has('heard')) { told.add('heard'); rec.event('heard', { at: sim.tick }); } toast('Digging under your hill. Open Nest and look toward the rival.', 4200, true); tone(140, 0.5, 0.06, 'square', -20); navigator.vibrate?.([10, 40, 10]); }
    } else if (type === EVENT.PLUG) {
      if (a === ME) { toast('Packed shut'); tone(180, 0.25, 0.06, 'square', -60); rec.event('plug', { at: sim.tick }); } else if (sim.owner(b - L0.nestBase) !== ME && underTrail(ME) >= 0) toast('They have packed the tunnel shut. Mark it with Tunnel to dig it out.', 4200, true);
    } else if (type === EVENT.TIER) {
      const what = c === BRANCH.WAR ? 'War hill' : 'Deep hill';
      if (a === ME) { pickCaste(); roomButtons(); toast(b === 2 ? `The chamber is wider. You are a ${what} now.` : TIERS.craft[g(ME, CG.CRAFT)] ? `The chamber is full grown. Your hill has the ${TIERS.craft[g(ME, CG.CRAFT)].name} craft.` : 'The chamber is full grown.', 3600); tone(392, 0.5, 0.06, 'triangle', 240); shake = 0.15; rec.event('tier', { tier: b, branch: c === BRANCH.WAR ? 'war' : 'deep', at: sim.tick }); }
      else { toast(b === 2 ? `The rival has grown into a ${what}.` : 'The rival\'s chamber is full grown.', 3600, true); rec.event('rivalTier', { tier: b, branch: c === BRANCH.WAR ? 'war' : 'deep', at: sim.tick }); }
    } else if (type === EVENT.BREACH) {
      rec.event('breach', { by: a === ME ? 'me' : 'rival', at: sim.tick }); shake = 0.3; roomButtons();
      toast(a === ME ? 'You are through! Pick Strike in the Nest and tap where your soldiers should go.' : 'The rival has broken into your nest. A Guard post where it comes in holds them.', 6000, a !== ME);
      tone(a === ME ? 520 : 110, 0.6, 0.07, 'sawtooth', a === ME ? 200 : -40);
    }
    else if (type === EVENT.FALL) {
      /* a windfall: a is its cell, b the food, c the loads landed (0: told beforehand) */
      const fx = a % L0.sw, fy = Math.floor(a / L0.sw), mid = Math.abs(fx - (L0.sw >> 1)) <= 3, mine = !mid && (fx < L0.sw >> 1) === (doorXY(ME).x < L0.sw >> 1);
      if (mid || mine) {
        const where = mid ? `on the ${fy < L0.sh / 3 ? 'north' : fy > (2 * L0.sh) / 3 ? 'south' : 'middle'} ford` : 'on your ground', what = b ? 'Meat' : 'Seeds';
        beacon = { x: fx + 0.5, y: fy + 0.5, at: now };
        if (c) { toast(`${what} ${b ? 'has' : 'have'} fallen ${where}. Draw a trail to ${b ? 'it' : 'them'}.`, 5200, false, () => lookAt(fx + 0.5, fy + 0.5)); tone(660, 0.18, 0.05, 'triangle', 120); burst(fx + 0.5, fy + 0.5, KIND_COL[b], 18, { vh: 6, life: 1.2 }); }
        else { beacon.life = 15000; toast(`${what} will fall ${where} soon.${mid ? ' The rival knows too.' : ''}`, 5200, false, () => lookAt(fx + 0.5, fy + 0.5)); tone(520, 0.12, 0.04, 'sine', 80); }
      }
    }
    else if (type === EVENT.DOOR) {
      roomButtons();
      if (a === ME) { toast('Your second door is open. New trails start at the nearer door. Mark a Store beside it.', 5200); tone(392, 0.25, 0.06, 'triangle', 200); beacon = { x: b % L0.sw + 0.5, y: Math.floor(b / L0.sw) + 0.5, at: now }; rec.event('door', { x: c, at: sim.tick }); }
      else toast('The rival has opened a second door.', 3200);
    }
    else if (type === EVENT.DUG && a === ME) { if (nestOpen) tone(210 + Math.random() * 60, 0.05, 0.03, 'square', -60); }
    else if (type === EVENT.FULL && a === ME) { if (now - (told.fullAt ?? 0) > 20000) { told.fullAt = now; toast(`No room for more ${b ? 'meat' : 'seeds'}. Dig a store in the Nest.`, 3600, true); } }
    else if (type === EVENT.REJECTED && a === ME) {
      if (builds.has(b)) { builds.delete(b); tone(150, 0.12, 0.05, 'sawtooth', -40); toast(nestTool === 'door' ? `No door there. It needs your own open tunnel in the third row down, ${C.DOOR_APART} cells or more from your door, open ground above, and ${C.DOOR_SUGAR} seeds to spare.` : nestTool === 'clear' ? 'Nothing to clear there.' : nestTool === 'plug' ? 'No plug there: it needs an open tunnel of yours, no rival near, seeds to spare, and a way left to your door.' : 'Nothing to dig or change there.', nestTool === 'plug' ? 3600 : 2200); continue; }
      const q = pending.find(q => q.id === b); if (q) { pulses.push({ pts: q.points, at: now, bad: true }); q.done = true; }
      tone(150, 0.22, 0.07, 'sawtooth', -40); toast(c === 1 ? 'Six trails is the most. Erase one first.' : 'No ant can walk that.', 2600, true);
    } else if (type === EVENT.TRAIL) {
      if (sim.trPath[(a * TRAILS + b) * PATH_MAX] >= L0.nestBase) {
        // A raid under ground: there is no line to draw outside.
        if (a === ME) { tone(620, 0.14, 0.06, 'sawtooth', -180); toast(sim.linked ? 'Your soldiers go under ground' : 'There is no way under ground yet: they go by the door', 2600); }
        else { toast('Rival soldiers are coming under ground!', 4200, true); tone(196, 0.5, 0.07, 'sawtooth', -30); setTimeout(() => tone(185, 0.6, 0.07, 'sawtooth', -30), 380); navigator.vibrate?.([20, 60, 20]); }
      } else if (a === ME) {
        const q = pending.find(q => !q.done); if (q) { q.done = true; pulses.push({ pts: q.points, at: now, bad: false }); }
        sel = b; showRoute(7000); tone(620, 0.14, 0.06, 'triangle', -180); setTimeout(() => tone(930, 0.18, 0.05, 'triangle', 120), 110); navigator.vibrate?.(30);
        if (!firstTrail) { firstTrail = true; clearTimeout(toastTimer); $('toast').classList.remove('on'); }
      } else if (c === KIND.RAID) {
        // Warn about where the raid is going: the hill only when its trail ends by your door.
        const s2 = a * TRAILS + b, e = sim.trPath[s2 * PATH_MAX + sim.trLen[s2] - 1], ex = e % L0.sw + 0.5, ey = Math.floor(e / L0.sw) + 0.5, d = doorXY(ME), home = Math.abs(ex - d.x) <= 8 && Math.abs(ey - d.y) <= 8;
        if (!home) { toast(sim.sites.length ? 'Rival soldiers are marching on a stone' : 'Rival soldiers are on the move', 3200, true); tone(196, 0.3, 0.05, 'sawtooth', -30); beacon = { x: ex, y: ey, at: now }; }
        else { toast('The rival is marching on your hill', 4200, true); tone(196, 0.5, 0.07, 'sawtooth', -30); setTimeout(() => tone(185, 0.6, 0.07, 'sawtooth', -30), 380); beacon = { ...doorXY(ME), at: now }; navigator.vibrate?.([20, 60, 20]); } }
    } else if (type === EVENT.QUEEN_HIT) {
      if (a === ME) { shake = 0.3; danger = 1; if (!told.has('qhit') || now - (told.qAt ?? 0) > 6000) { told.add('qhit'); told.qAt = now; toast('Your queen is being bitten!', 3200, true); tone(120, 0.4, 0.08, 'sawtooth'); } }
      else once('fqhit', 'Your soldiers have reached the rival queen', 3200);
    } else if (type === EVENT.STOLEN) { if (a === ME) once('robbed', 'Raiders are carrying off your stores', 3200, true); else once('stole', 'Your raiders are bringing home their stores', 3200); }
    else if (type === EVENT.BEAST_BIT) { beastBit = now; if (!beastTold) { let mine = false; const bx = a % L0.sw, by = Math.floor(a / L0.sw); for (let i = 0; i < sim.n && !mine; i++) if (sim.team[i] === ME && sim.layer[i] === 0 && Math.abs((sim.x[i] >> 8) - bx) <= 3 && Math.abs((sim.y[i] >> 8) - by) <= 3) mine = true; if (mine) { beastTold = true; toast(`The beetle bites. ${['', 'One bite kills', 'Two bites kill', 'Three bites kill', 'Four bites kill'][Math.ceil(sim.stat[ME].hp[0] / sim.mission.beast.bite)] ?? 'A few bites kill'} a worker: send soldiers, and keep trails outside the red ring.`, 4200, true); tone(120, 0.3, 0.06, 'sawtooth', -40); } } }
    else if (type === EVENT.PEST && a === ME) {
      const V = sim.cfg.pest;
      if (b === PEST.NEAR) { toast(`A weevil is coming for your stores. It eats from stores within ${V.reach} steps of your door.`, 5200, true); tone(240, 0.3, 0.05, 'square', -40); }
      else if (b === PEST.CAME) { toast('The weevil is in your hill. Tap to see it.', 5200, true, () => setNest(true)); tone(200, 0.5, 0.07, 'sawtooth', -60); beacon = { ...doorXY(ME), at: now }; navigator.vibrate?.([20, 40, 20]); rec.event('weevil', { what: 'came', at: sim.tick }); }
      else if (b === PEST.ATE) { if (c % 5 === 1) tone(900, 0.05, 0.03, 'square', -300); }
      else if (b === PEST.LEFT) { toast(c ? `The weevil has gone, ${c} of your seeds inside it.` : 'The weevil found nothing near your door, and has gone.', 4200); tone(c ? 180 : 620, 0.3, 0.05, 'triangle', c ? -40 : 120); rec.event('weevil', { what: 'left', ate: c, at: sim.tick }); }
      else if (b === PEST.DIED) { toast(`The weevil is dead: ${V.meat} loads of meat for your stores.`, 4200); tone(330, 0.4, 0.06, 'triangle', 260); shake = 0.12; rec.event('weevil', { what: 'died', at: sim.tick }); }
    }
    else if (type === EVENT.BEAST_DEAD) { toast(sim.mission.goals.carry ? (b === ME ? `The beetle is down. You hurt it more: you start ${sim.mission.goals.lead} loads ahead. Draw a Forage trail to the body!` : `The beetle is down. The rival starts ${sim.mission.goals.lead} loads ahead. Draw a Forage trail to the body!`) : b === ME ? 'The beetle is down, and yours was the greater harm.' : 'The beetle is down. The rival hurt it more.', 6000, b !== ME); rec.event('beast', { at: sim.tick, lead: b === ME ? 'me' : 'rival', harm: g(ME, CG.HARM), foeHarm: g(FOE, CG.HARM) }); tone(b === ME ? 520 : 180, 0.5, 0.06, 'triangle', b === ME ? 260 : -60); shake = 0.4; }
    else if (type === EVENT.SITE) { if (b === ME) { toast('A stone is yours. It pays while you outnumber the rival there.', 2800); tone(660, 0.25, 0.05, 'triangle', 200); } else if (c === ME) { toast(b === FOE ? 'The rival has taken a stone from you' : 'You no longer hold that stone', 3000, true); tone(240, 0.3, 0.05, 'sawtooth', -60); } }
    else if (type === EVENT.FROST) { document.body.classList.add('frost'); toast('The frost has come. Nothing is left outside: the hill lives on its stores.', 5200, true); tone(1200, 0.9, 0.05, 'sine', -500); }
    else if (type === EVENT.RESULT) finish(a === ME, b);
  }
  if (deaths >= 3) { shake = Math.max(shake, 0.12); tone(170, 0.12, 0.04, 'square', -40); }
  pending = pending.filter(q => !q.done);
  danger = Math.max(0, danger - 0.01);
}
function finish(w, reason) {
  won = w;
  const s = summary(), T = (t, k) => g(t, k);
  rec.end(w ? 'won' : 'lost', { ...s, reason });
  const text = TEXT[missionId], was = camp.done[missionId];
  if (!NET) camp.done[missionId] = { won: w || !!was?.won, best: Math.max(was?.best ?? 0, w ? s.adults : 0) }; saveCamp();
  if (!NET && ROAD.pair.includes(missionId) && !camp.forks.road && !camp.done[ROAD.pair.find(x => x !== missionId)]) { camp.forks.road = missionId; saveCamp(); rec.event('road', { first: missionId }); }
  if (!NET && set.get('home') === 'carried' && (sim.mission.from || Object.values(MISSIONS).some(x => x.from === missionId))) { hills.after[missionId] = { nests: sim.nests() }; saveHills(); doors.after[missionId] = [0, 1].map(t => (sim.side[t] >= 0 ? sim.side[t] % L0.sw : -1)); saveDoors(); }
  // Deeds: the sim judges them; the page only keeps which were done, and which are new this time.
  const did = sim.deeds(ME), fresh = [];
  if (!NET) sim.mission.deeds.forEach((d, i) => { const key = `${missionId}.${d.id}`; if (did[i] && !line.deeds[key]) { const had = hasNode(d.opens); line.deeds[key] = 1; fresh.push(d.id); rec.event('deed', { deed: key, opens: had ? 'had' : d.opens }); } });
  if (fresh.length) saveLine();
  renderDeeds($('overDeeds'), missionId, fresh);
  /* What goes with you: the campaign so far, the nest if this hill is kept, what the deeds opened, and what comes next. */
  { const el = $('carry'); el.textContent = ''; el.hidden = !!NET;
    if (!NET) {
      const add = (head, body) => { const p = document.createElement('p'), sp = document.createElement('span'), b = document.createElement('b'); b.textContent = head; sp.append(b, ` ${body}`); p.append(sp); el.append(p); };
      const h = document.createElement('div'); h.className = 'kicker'; h.textContent = 'What goes with you'; el.append(h);
      const doneN = STEPS.filter(id => camp.done[id]?.won).length; add('Campaign.', `${doneN} of ${STEPS.length} missions won.${w ? '' : ' A lost mission still opens the next one; you can come back to it.'}`);
      const heir = Object.keys(MISSIONS).find(x => MISSIONS[x].from === missionId), kept = set.get('home') === 'carried' && (sim.mission.from || heir), nest = sim.nests()[ME];
      if (kept) { let rooms = 0; for (let k = 2; k < nest.length; k += 3) if (nest[k]) rooms++; add('Your nest.', `${nest.length / 3} dug cells, ${rooms} of them rooms, are kept${heir ? `: ${MISSIONS[heir].name} starts in this nest` : ' on this hill'}. Quarters come back as bare tunnel.`); }
      else add('Your nest.', set.get('home') === 'carried' ? 'This hill is not fought on again. The next mission starts in a small new nest.' : 'Every mission starts in the same small nest (a setting).');
      const open = fresh.map(id => sim.mission.deeds.find(d => d.id === id)).filter(d => d && d.opens && TRAITS[d.opens]).map(d => TRAITS[d.opens].name);
      add('The Lineage.', open.length ? `New: ${open.join(', ')}. ${nodesNow().length === 1 ? '1 node' : `${nodesNow().length} nodes`} open in all, yours in every mission.` : `${nodesNow().length === 1 ? '1 node' : `${nodesNow().length} nodes`} open, yours in every mission. Deeds open more; they are listed above.`);
      add('Not kept.', 'Ants, food and the growth of the queen\'s chamber start again each mission.');
    } }
  // Where "next" leads: the first fork that is open and not taken, else the first mission not yet played to its end.
  const forkNext = (() => { for (const c of CAMPAIGN) { if (c.side) continue; if (c.mission) { if (!camp.done[c.mission]) return null; } else if (c.fork && !taken(c.fork)) return c.fork; } return null; })(), nx = firstOpen();
  $('next').hidden = false; $('next').textContent = forkNext ? (forkNext === 'caste' ? 'Choose a third caste' : forkNext === 'craft' ? 'Choose a craft' : 'Choose a way of living') : !camp.done[nx] ? `Next: ${MISSIONS[nx].name}` : 'The missions';
  $('overKicker').textContent = reason === REASON.BEAST ? 'The beetle is carried off' : reason === REASON.POINTS ? 'The stones have chosen' : reason === REASON.HAUL ? 'The larder is bare' : reason === REASON.QUEEN ? (w ? 'The rival queen is dead' : 'Your queen is dead') : text.end === 'dusk' ? 'Dusk' : 'The thaw';
  $('overTitle').textContent = w ? text.won : sim.mission.goals.beast && g(ME, CG.QUEEN_HP) > 0 ? 'The rival took the beetle' : 'The hill is lost'; $('overTitle').classList.toggle('lost', !w);
  $('overWhy').textContent = reason === REASON.QUEEN ? (w ? (sim.mission.map === 'wall' ? 'Her colony scatters. The wall did not save her.' : sim.mission.map === 'pass' ? 'Her colony scatters. The ridge is yours.' : sim.mission.map === 'meadow' ? 'Her colony scatters. The meadow is yours to the far bank.' : 'Her colony scatters. Both fords are yours now.') : 'Without her the colony has no tomorrow.') : sim.mission.goals.carry && sim.fallen ? `${sim.carried(ME)} loads of the beetle home to the rival's ${sim.carried(FOE)}.` : sim.mission.goals.beast ? `Your ants did it ${T(ME, CG.HARM)} harm. The rival's did it ${T(FOE, CG.HARM)}.` : sim.mission.goals.points ? `${T(ME, CG.POINTS)} points to the rival's ${T(FOE, CG.POINTS)}.` : sim.mission.goals.dusk === 'holder' ? 'Dusk fell and their queen still lives.' : sim.mission.goals.haul ? `You carried home ${T(ME, CG.HAUL)} of their loads. They carried home ${T(FOE, CG.HAUL)} of yours.` : w ? `At ${text.end} you stood ${s.adults} to ${s.foe}.` : `At ${text.end} the rival stood ${s.foe} to your ${s.adults}.`;
  const rows = [['', 'You', 'Rival'], ['Ants at the end', T(ME, CG.ADULTS), T(FOE, CG.ADULTS)], ['Soldiers', T(ME, CG.MAJORS), T(FOE, CG.MAJORS)], ['Born', T(ME, CG.BORN), T(FOE, CG.BORN)], ['Fallen', T(ME, CG.DIED), T(FOE, CG.DIED)], ['Loads carried home', T(ME, CG.LOADS_S) + T(ME, CG.LOADS_P), T(FOE, CG.LOADS_S) + T(FOE, CG.LOADS_P)], ['Loads stolen', T(ME, CG.STOLEN), T(FOE, CG.STOLEN)]]; if (sim.mission.beast) rows.splice(1, 0, ['Harm to the beetle', T(ME, CG.HARM), T(FOE, CG.HARM)], ['Its meat carried home', sim.carried(ME), sim.carried(FOE)]);
  $('tally').textContent = '';
  rows.forEach((r, i) => r.forEach((v, j) => { const el = document.createElement(j ? 'b' : 'span'); el.textContent = v; if (!i) el.className = 'h'; if (j === 2) el.classList.add('foe'); $('tally').append(el); }));
  const v = set.get('rival');
  $('harder').textContent = w ? (v === 'bold' ? 'Play the bold rival again' : `Play a ${v === 'timid' ? 'steady' : 'bold'} rival`) : v === 'timid' ? 'Play the timid rival again' : `Play a ${v === 'bold' ? 'steady' : 'timid'} rival`;
  if (NET) { $('next').textContent = 'A new room'; $('again').hidden = $('harder').hidden = true; }
  running = false; dropTouches(); if (nestOpen) setNest(false);
  const mine = host;
  setTimeout(() => { if (host !== mine) return; setScreen('over'); (w ? [523, 659, 784, 1047] : [392, 330, 262, 196]).forEach((f, i) => setTimeout(() => tone(f, 0.5, 0.06, 'triangle'), i * 160)); }, 900);
}
function bump(id, value) { const el = $(id), span = el.querySelector('span'), text = String(value); if (span.textContent === text) return; const up = Number(text) > Number(span.textContent); span.textContent = text; if (up) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
function hud() {
  guideTick();
  let brood = 0; for (let k = 0; k < sim.bn; k++) if (sim.bTeam[k] === ME) brood++;
  bump('chipAnts', g(ME, CG.ADULTS) - g(ME, CG.MAJORS)); bump('chipMajors', g(ME, CG.MAJORS)); bump('chipSugar', g(ME, CG.SUGAR)); bump('chipProtein', g(ME, CG.PROTEIN)); bump('chipBrood', brood);
  const G2 = sim.mission.goals, goal = (G2.points | 0) || (G2.haul | 0), slot = G2.points ? CG.POINTS : G2.haul ? CG.HAUL : G2.beast ? CG.HARM : CG.ADULTS, meat = !!G2.carry && sim.fallen, us = meat ? sim.carried(ME) : g(ME, slot), them = meat ? sim.carried(FOE) : g(FOE, slot);
  const plain = !meat && !goal && !G2.beast, qp = n => Math.max(0, Math.ceil(100 * g(n, CG.QUEEN_HP) / sim.cfg.queenHp)), ql = plain && (qp(ME) < 100 || qp(FOE) < 100) ? `Queens: yours ${qp(ME)}% · rival ${qp(FOE)}%` : ''; if ($('queens').textContent !== ql) $('queens').textContent = ql;
  $('vsUs').textContent = meat ? `Meat home: you ${us} / ${G2.carry}` : goal ? `You ${us} / ${goal}` : G2.beast ? `Harm: you ${us}` : `Ants: you ${us}`; $('vsThem').textContent = G2.beast ? `rival ${them}` : plain ? `rival ${them}` : `${them} Rival`; $('bar2').firstElementChild.style.width = `${(100 * us / Math.max(1, us + them)).toFixed(1)}%`;
  if (G2.dusk === 'holder') { const pct = Math.max(0, Math.ceil(100 * g(FOE, CG.QUEEN_HP) / sim.cfg.queenHp)); $('vsUs').textContent = `Ants: you ${us}`; $('vsThem').textContent = `Rival queen ${pct}%`; $('bar2').firstElementChild.style.width = `${100 - pct}%`; }
  if (sim.cfg.truce && sim.tick >= sim.cfg.truce && !told.has('noon')) { told.add('noon'); toast('Noon. The truce is over: a raid can go down a door now, and the queens can be hurt.', 6000, true); tone(294, 0.5, 0.06, 'sawtooth', -20); }
  const toFrost = sim.cfg.frostTick > sim.tick || sim.cfg.truce > sim.tick, left = Math.max(0, (sim.cfg.frostTick > sim.tick ? sim.cfg.frostTick : sim.cfg.truce > sim.tick ? sim.cfg.truce : sim.cfg.duskTick) - sim.tick) / 20; $('dusk').textContent = `${TEXT[sim.mission.id].clock[toFrost ? 0 : TEXT[sim.mission.id].clock.length - 1]} in ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  if (g(ME, CG.SUGAR) === 0 && sim.tick > 600) once('hungry', 'No seeds in store. The colony starves without them.', 3600, true);
  trailMesh();
  const s = sel >= 0 && sim.trLive[ME * TRAILS + sel] ? ME * TRAILS + sel : -1;
  if (s < 0) sel = -1;
  $('route').classList.toggle('on', s >= 0 && screen === 'play' && !nestOpen && performance.now() < routeUntil);
  if (s >= 0) {
    const raid = sim.trKind[s] === KIND.RAID, lv = sim.trLevel[s];
    $('routeDot').style.background = raid ? '#ff5a3c' : TRAIL_CSS[sel]; $('routeName').textContent = raid ? 'Raid' : 'Forage';
    $('routeInfo').textContent = sim.trDry[s] ? 'nothing left at its end' : `${sim.crew[s]} on it, ${sim.want[s]} wanted`;
    const sh = raid ? RAID_SHARE : LEVEL_SHARE, words = raid ? ['1 soldier in 4', 'half the soldiers', 'all, and workers'] : ['1 worker in 10', '1 worker in 4', 'half the workers'];
    $('noSoldiers').hidden = !(raid && !g(ME, CG.MAJORS));
    const st = { loot: sim.has(ME, 'loot'), hold: sim.has(ME, 'hold') }, canMode = raid && (st.loot || st.hold); $('modes').hidden = !canMode;
    if (canMode) for (const b of document.querySelectorAll('#modes [data-mode]')) { const m = Number(b.dataset.mode); b.hidden = (m === MODE.LOOT && !st.loot) || (m === MODE.HOLD && !st.hold); b.setAttribute('aria-pressed', String(m === sim.trMode[s])); }
    for (const b of document.querySelectorAll('#levels [data-level]')) { const l = Number(b.dataset.level); b.setAttribute('aria-pressed', String(l === lv)); b.querySelector('small').textContent = words[l - 1]; void sh; }
  }
  growPane();
  const diet = g(ME, CG.DIET);
  for (const b of document.querySelectorAll('#diets [data-diet]')) b.setAttribute('aria-pressed', String(Number(b.dataset.diet) === diet));
  const d2 = g(ME, CG.DIET2), pk = g(ME, CG.PICK);
  for (const b of document.querySelectorAll('#specials [data-special]')) { b.setAttribute('aria-pressed', String(Number(b.dataset.special) === d2)); const sm = b.querySelector('small'); if (sm && Number(b.dataset.special)) sm.textContent = pk === CASTE.WARDEN ? 'wardens' : 'spitters'; }
  $('specialName').textContent = pk === CASTE.WARDEN ? 'Wardens · 4 meat each' : 'Spitters · 2 meat each';
  $('specialName').parentElement.hidden = $('specials').hidden = !pk; // no third caste yet: nothing to set
  $('dietInfo').textContent = g(ME, CG.PROTEIN) === 0 ? 'no meat: bring red food' : `${g(ME, CG.PROTEIN)} meat in store · a soldier eats 3`;
  const capA = g(ME, CG.CAP_ADULTS), capB = g(ME, CG.CAP_BROOD), capF = g(ME, CG.CAP_FOOD), pop = g(ME, CG.ADULTS) + brood;
  const cap = (id, n, of) => { const el = $(id); el.textContent = `${n}/${of}`; el.parentElement.classList.toggle('tight', n >= of); };
  cap('capFood', Math.max(g(ME, CG.SUGAR), g(ME, CG.PROTEIN)), capF); cap('capBrood', brood, capB); cap('capAnts', pop, capA);
  if (pop >= capA && sim.tick > 200 && performance.now() - (told.popAt ?? 0) > 45000) { told.popAt = performance.now(); toast('The hill is full: the queen stops laying. Dig quarters in the Nest.', 4200, true); }
  needLine(pop, capA, brood, capB, capF);
  $('recall').setAttribute('aria-pressed', String(!!g(ME, CG.RECALL)));
  drawMini(); tuneSong();
}

// What holds the hill back now: one line above the room buttons, with the room that answers it ringed. It reads the
// sim's own counts and caps; nothing here decides anything.
let seedLog = [];
let markAt = -1, markN = 0;
function needLine(pop, capA, brood, capB, capF) {
  const g = (t, k) => sim.g(t, k), seeds = g(ME, CG.SUGAR), home = g(ME, CG.LOADS_S);
  if (seedLog.length && seedLog[seedLog.length - 1][0] > sim.tick) seedLog = [];
  if (!seedLog.length || sim.tick - seedLog[seedLog.length - 1][0] >= 100) seedLog.push([sim.tick, home]);
  while (seedLog.length > 1 && sim.tick - seedLog[1][0] >= 1200) seedLog.shift();
  const span = sim.tick - seedLog[0][0], grown = sim.gardens[ME] * sim.stat[ME].garden;
  const income = span >= 1100 ? Math.round((home - seedLog[0][1]) * 1200 / span) + grown : -1;
  const fed = C.MESS_FEEDS * sim.mess[ME], sol = g(ME, CG.MAJORS), meal = Math.ceil((g(ME, CG.ADULTS) + 2 * Math.max(0, sol - fed)) / sim.stat[ME].eatPer);
  const can = r => { const b = document.querySelector(`#rooms [data-room="${r}"]`); return b && !b.hidden; };
  let text = '', room = '', dig = '';
  if (sim.tick < 400) text = ''; /* the opening brood is over the nursery's count for a moment: not a thing to act on */
  else if (pop >= capA) { room = 'rest'; text = `<b>The hill is full</b> (${pop} of ${capA}): the queen has stopped laying.`; dig = 'Dig quarters.'; }
  else if (income >= 0 && income < meal && seeds < 3 * meal) { room = 'garden'; text = `<b>Seeds are running out</b>: the hill eats ${meal} a minute and ${income} came in.`; dig = 'A garden cell grows one a minute.'; if (!can('garden') && can('mess') && sol - fed >= C.MESS_FEEDS) { room = 'mess'; dig = `A mess cell feeds ${C.MESS_FEEDS} soldiers for a third.`; } }
  else if (g(ME, CG.DIET) > 0 && g(ME, CG.PROTEIN) < 3 && sim.tick >= 600) text = `<b>No soldier can hatch</b>: a soldier grub eats 3 meat and the store holds ${g(ME, CG.PROTEIN)}. Red food is meat: draw a trail to it.`;
  else if (brood >= capB) { room = 'nursery'; text = `<b>The nursery is full</b> (${brood} of ${capB}): new eggs wait.`; dig = 'Dig nursery.'; }
  else if (Math.max(seeds, g(ME, CG.PROTEIN)) >= capF) { room = 'store'; text = `<b>The store is full</b> (${capF}): loads are left outside.`; dig = 'Dig store.'; }
  else if (pop * 10 >= capA * 9) { room = 'rest'; text = `<b>The hill is nearly full</b> (${pop} of ${capA}).`; dig = 'Dig quarters soon.'; }
  else if (income >= 0 && income < meal) text = `The hill eats ${meal} seeds a minute and ${income} came in. The store covers it for now.`;
  if (markAt > sim.tick || sim.tick - markAt >= 20) { markAt = sim.tick; markN = 0; for (let k = 0; k < sim.mark.length; k++) if (sim.mark[k] === ME + 1) markN++; }
  { const spare = Math.max(0, seeds - C.DIG_KEEP), cost = markN * sim.cfg.digSugar, q = $('digQueue'), want = !markN ? '' : cost > spare ? `<b>${markN} cells marked</b>, ${spare} seeds to spend: <b class="short">${markN - Math.floor(spare / sim.cfg.digSugar)} wait for seeds</b>. The hill keeps ${C.DIG_KEEP} to eat.` : `${markN} cells marked, ${cost ? cost + ' seeds' : 'no seed'} to dig them.`; if (q.dataset.text !== want) { q.dataset.text = want; q.innerHTML = want; }
    if (!text && markN && cost > spare && markN - spare >= 8) text = `<b>Diggers are waiting for seeds</b>: ${markN} cells marked and ${spare} seeds to spend. Each cell costs a seed.`; }
  if (room && !can(room)) { dig = room === 'garden' ? 'Put more workers on a seed trail.' : ''; room = ''; } /* a room this hill may not dig is not offered */
  if (dig) text += ' ' + dig;
  const el = $('need'); if (el.dataset.text !== text) { el.dataset.text = text; el.innerHTML = text; } el.dataset.room = room;
  /* On the Dig tab the line takes the help row's place while no room is picked, so the panel grows no taller there. */
  if (nestTool === 'look') { const h = $('digHelp'), want = text || DIG_HELP.look; if (h.dataset.text !== want) { h.dataset.text = want; h.innerHTML = want; } }
  for (const b of document.querySelectorAll('#rooms [data-room]')) b.classList.toggle('want', b.dataset.room === room);
}

// ---- trails as ribbons: yours in six colours, raids red, the rival's a cold blue ----
const TRAIL_COL = [[1, 0.70, 0.22], [0.30, 0.82, 1], [1, 0.42, 0.72], [0.62, 0.95, 0.32], [0.80, 0.62, 1], [1, 0.92, 0.45]];
const TRAIL_CSS = ['#ffb338', '#4dd1ff', '#ff6bb8', '#9ef252', '#cc9eff', '#ffeb73'];
let trailSig = '', trailBuf = new Float32Array(0);
function trailMesh() {
  let sig = '';
  for (let s = 0; s < 2 * TRAILS; s++) if (sim.trLive[s]) sig += `${s}:${sim.trSeq[s]}:${sim.trLevel[s]}:${sim.trKind[s]}:${sim.trDry[s]};`;
  if (sig === trailSig) return; trailSig = sig; trailMid.clear();
  const out = [];
  for (let s = 0; s < 2 * TRAILS; s++) {
    if (!sim.trLive[s]) continue;
    if (sim.trPath[s * PATH_MAX] >= L0.nestBase) continue; // a raid under ground has no line outside
    const mine = s < TRAILS, raid = sim.trKind[s] === KIND.RAID, len = sim.trLen[s], HW = mine ? 0.42 : 0.3;
    let col = mine ? (raid ? [1, 0.25, 0.15] : TRAIL_COL[s % TRAILS]) : raid ? [0.75, 0.3, 1] : [0.35, 0.5, 0.95];
    if (sim.trDry[s] || !mine) col = col.map(v => v * (sim.trDry[s] ? 0.3 : 0.6));
    const speed = sim.trDry[s] ? 0 : 1.6 + 0.9 * sim.trLevel[s];
    let pts = []; const stepN = Math.max(2, Math.ceil(len / 300));
    for (let j = 0; j < len; j += stepN) { const c = sim.trPath[s * PATH_MAX + j]; pts.push([c % L0.sw + 0.5, Math.floor(c / L0.sw) + 0.5]); }
    const last = sim.trPath[s * PATH_MAX + len - 1]; pts.push([last % L0.sw + 0.5, Math.floor(last / L0.sw) + 0.5]);
    for (let pass = 0; pass < 2 && pts.length > 2; pass++) { const r = [pts[0]]; for (let j = 0; j < pts.length - 1; j++) { const a = pts[j], b = pts[j + 1]; r.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } r.push(pts[pts.length - 1]); pts = r; }
    const mid = pts[pts.length >> 1]; trailMid.set(s, { x: mid[0], y: mid[1] });
    let d = 0, pl = null, pr = null, ps = 0;
    for (let j = 0; j < pts.length; j++) {
      const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx = nx / nl * HW; ny = ny / nl * HW;
      if (j) d += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
      const l = [pts[j][0] + nx, pts[j][1] + ny], r = [pts[j][0] - nx, pts[j][1] - ny];
      if (pl) for (const [q, u, ss] of [[pl, -1, ps], [pr, 1, ps], [l, -1, d], [pr, 1, ps], [r, 1, d], [l, -1, d]]) out.push(q[0], q[1], u, ss, col[0], col[1], col[2], speed);
      pl = l; pr = r; ps = d;
    }
  }
  if (out.length > trailBuf.length) trailBuf = new Float32Array(out.length * 2);
  trailBuf.set(out); renderer?.setTrails(trailBuf, out.length / 8);
}

// ---- the small map: both hills, the creek, food, and where the ants are ----
let miniBase = null;
function drawMini() {
  const w = L0.sw, h = L0.sh;
  if (!miniBase || miniBase.sim !== sim) { const img = mctx.createImageData(w, h); for (let i = 0; i < w * h; i++) { const m = sim.mat[i], o = i * 4, c = m === MAT.WATER ? [40, 74, 110] : m === MAT.STONE ? [96, 92, 90] : [52, 44, 40]; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; } miniBase = { sim, img }; }
  mctx.putImageData(miniBase.img, 0, 0);
  for (let p = 0; p < MAX_PILES; p++) if (sim.pileAmount[p] > 0) { const c = sim.pileCell[p], r = sim.pileAmount[p] > 40 ? 2.4 : 1.4; mctx.fillStyle = sim.pileKind[p] ? '#e0603c' : '#f3d77a'; mctx.beginPath(); mctx.arc(c % w + 0.5, Math.floor(c / w) + 0.5, r, 0, 7); mctx.fill(); }
  for (let i = 0; i < sim.n; i++) if (sim.layer[i] === 0) { mctx.fillStyle = sim.team[i] !== ME ? '#8fb0ff' : '#ffb057'; mctx.fillRect(sim.x[i] >> 8, sim.y[i] >> 8, 1.4, 1.4); }
  if (sim.beast[1] >= 0 && sim.beast[0] > 0) { mctx.fillStyle = '#ff6048'; mctx.beginPath(); mctx.arc(sim.beast[1] % w, Math.floor(sim.beast[1] / w), 3, 0, 7); mctx.fill(); }
  for (let k = 0; k < sim.sites.length; k++) { const c = sim.sites[k], hold = sim.siteHold[k]; mctx.fillStyle = hold === ME ? '#ffb057' : hold === FOE ? '#8fb0ff' : '#e8e0d6'; mctx.fillRect(c % w - 2, Math.floor(c / w) - 4, 4, 8); }
  for (const t of [ME, FOE]) { const d = doorXY(t); mctx.strokeStyle = t !== ME ? '#8fb0ff' : '#ffb057'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(d.x, d.y, 3.5, 0, 7); mctx.stroke(); if (sim.side[t] >= 0) { mctx.beginPath(); mctx.arc(sim.side[t] % L0.sw + 0.5, Math.floor(sim.side[t] / L0.sw) + 0.5, 2, 0, 7); mctx.stroke(); } }
  if (eye) { const a = toWorld(0, 0), b = toWorld(W, H), c = toWorld(W, 0), d = toWorld(0, H); mctx.strokeStyle = 'rgba(255,255,255,0.8)'; mctx.lineWidth = 1; mctx.beginPath(); mctx.moveTo(a.x, a.y); mctx.lineTo(c.x, c.y); mctx.lineTo(b.x, b.y); mctx.lineTo(d.x, d.y); mctx.closePath(); mctx.stroke(); }
}

// ---- the overlay ----
function drawOverlay(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pu of pulses) {
    const k = (now - pu.at) / 900; if (k > 1) continue;
    ctx.strokeStyle = pu.bad ? `rgba(255, 70, 50, ${1 - k})` : `rgba(255, 210, 120, ${1 - k})`; ctx.lineWidth = pu.bad ? 4 : 3 + 8 * k;
    if (pu.bad) ctx.setLineDash([6, 8]);
    ctx.beginPath(); for (let i = 0; i < pu.pts.length; i += 2) { const p = toScreen(pu.pts[i] + 0.5, pu.pts[i + 1] + 0.5); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]);
  }
  pulses = pulses.filter(pu => now - pu.at < 900);
  if (screen === 'play') {
    const shown = performance.now() < routeUntil ? sel : -1;
    for (const [s, m] of trailMid) {
      if (s >= TRAILS || !sim.trLive[s]) continue;
      const p = toScreen(m.x, m.y, 1.6), q = toScreen(m.x, m.y, 0.05), raid = sim.trKind[s] === KIND.RAID, css = raid ? '#ff5a3c' : TRAIL_CSS[s];
      if (p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
      ctx.strokeStyle = css; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      const label = sim.trDry[s] ? 'dry' : sim.crew[s] >= sim.want[s] ? String(sim.crew[s]) : `${sim.crew[s]}/${sim.want[s]}`, w = 30 + label.length * 7.5;
      ctx.fillStyle = s === shown ? css : 'rgba(26, 18, 14, 0.92)'; ctx.strokeStyle = s === shown ? '#fff8ea' : css; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - 12, w, 22, 11); ctx.fill(); ctx.stroke();
      ctx.fillStyle = s === shown ? '#1b0f08' : '#f3e6d6';
      const ax = p.x - w / 2 + 12; for (const [dx, r] of raid ? [[-3.6, 2.8], [0, 2.1], [3.6, 3.2]] : [[-3.6, 2.6], [0, 1.9], [3.2, 2.2]]) { ctx.beginPath(); ctx.arc(ax + dx, p.y - 1, r, 0, 7); ctx.fill(); }
      ctx.font = '700 12px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, ax + 9, p.y - 0.5);
    }
    // The beast: a great beetle that never leaves its cell, the ground it can reach, and its health over it.
    if (sim.beast[1] >= 0 && sim.beast[0] > 0) {
      const bc = sim.beast[1], B = sim.mission.beast, x = bc % L0.sw + 0.5, y = Math.floor(bc / L0.sw) + 0.5, p = toScreen(x, y, 0.6), q = toScreen(x + 1, y, 0.6), r2 = toScreen(x, y + 1, 0.6);
      if (p.s) {
        const ux = (q.x - p.x) * 1.7, uy = (q.y - p.y) * 1.7, vx = (r2.x - p.x) * 1.7, vy = (r2.y - p.y) * 1.7, lunge = Math.max(0, 1 - (now - beastBit) / 260), t = now / 400;
        ctx.strokeStyle = 'rgba(255, 96, 72, 0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.beginPath();
        for (let a = 0; a <= 24; a++) { const w2 = toScreen(x + Math.cos(a * 0.2618) * (B.range + 0.5), y + Math.sin(a * 0.2618) * (B.range + 0.5), 0); if (a) ctx.lineTo(w2.x, w2.y); else ctx.moveTo(w2.x, w2.y); }
        ctx.stroke(); ctx.setLineDash([]);
        const at = (a, b2) => [p.x + ux * a + vx * b2, p.y + uy * a + vy * b2];
        ctx.strokeStyle = '#120b08'; ctx.lineWidth = Math.max(1.5, Math.hypot(ux, uy) * 0.12); ctx.lineCap = 'round';
        for (let k = 0; k < 6; k++) { const side = k < 3 ? -1 : 1, j = k % 3, sway = Math.sin(t + k * 1.7) * 0.12, a0 = at((j - 1) * 0.55, side * 0.5), a1 = at((j - 1) * 0.8 + sway, side * 1.25), a2 = at((j - 1) * 1.0 + sway, side * 1.7); ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.stroke(); }
        const body = (cx2, rx, ry, col) => { const c0 = at(cx2, 0); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(c0[0], c0[1], Math.hypot(ux, uy) * rx, Math.hypot(vx, vy) * ry, Math.atan2(uy, ux), 0, 7); ctx.fill(); };
        body(-0.25, 1.15, 0.85, '#1c1210'); body(-0.3, 0.95, 0.66, '#3a1f18'); body(0.95 + lunge * 0.35, 0.5, 0.5, '#241512');
        ctx.strokeStyle = '#5a2c1e'; ctx.lineWidth = 1; const s0 = at(-1.3, 0), s1 = at(0.6, 0); ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
        ctx.strokeStyle = '#0d0806'; ctx.lineWidth = Math.max(2, Math.hypot(ux, uy) * 0.16);
        for (const side of [-1, 1]) { const j0 = at(1.3 + lunge * 0.35, side * 0.22), j1 = at(1.9 + lunge * 0.5, side * (0.5 - lunge * 0.3)), j2 = at(2.3 + lunge * 0.5, side * (0.15 - lunge * 0.1)); ctx.beginPath(); ctx.moveTo(j0[0], j0[1]); ctx.quadraticCurveTo(j1[0], j1[1], j2[0], j2[1]); ctx.stroke(); }
        const hp = sim.beast[0] / (sim.cfg.beastHp ?? B.hp), top = toScreen(x, y, 5.5);
        ctx.fillStyle = 'rgba(20, 14, 10, 0.85)'; ctx.strokeStyle = '#ff6048'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(top.x - 30, top.y - 8, 60, 12, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff6048'; ctx.beginPath(); ctx.roundRect(top.x - 28, top.y - 6, 56 * hp, 8, 4); ctx.fill();
      }
    }
    // Standing stones: the ground they claim, and a stone in the colour of the colony that holds it.
    for (let k = 0; k < sim.sites.length; k++) {
      const c = sim.sites[k], x = c % L0.sw + 0.5, y = Math.floor(c / L0.sw) + 0.5, hold = sim.siteHold[k], col = hold === ME ? '#ffb057' : hold === FOE ? '#8fb0ff' : '#d8cfc4';
      const top = toScreen(x, y, 5), foot = toScreen(x, y, 0); if (!foot.s) continue;
      ctx.strokeStyle = col; ctx.lineWidth = hold < 0 ? 1.5 : 2.5; ctx.setLineDash(hold < 0 ? [5, 5] : []); ctx.beginPath();
      for (let a = 0; a <= 24; a++) { const q = toScreen(x + Math.cos(a * 0.2618) * (C.SITE_R + 0.5), y + Math.sin(a * 0.2618) * (C.SITE_R + 0.5), 0); if (a) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
      ctx.stroke(); ctx.setLineDash([]);
      const wd = Math.max(11, Math.abs(foot.y - top.y) * 0.42);
      ctx.fillStyle = '#4a4440'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(foot.x - wd / 2, top.y, wd, foot.y - top.y, wd * 0.4); ctx.fill(); ctx.stroke();
      if (hold >= 0) { ctx.fillStyle = col; ctx.font = '800 11px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('+1', foot.x, top.y - 3); }
    }
    // Second doors: a small banner each.
    for (const t of [ME, FOE]) {
      const c = sim.side[t]; if (c < 0) continue;
      const p = toScreen(c % L0.sw + 0.5, Math.floor(c / L0.sw) + 0.5, 2.4); if (!p.s) continue;
      const col = t !== ME ? '#8fb0ff' : '#ffb057';
      ctx.fillStyle = 'rgba(20, 14, 10, 0.85)'; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(p.x - 20, p.y - 8, 40, 16, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.font = '800 9.5px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('DOOR', p.x, p.y);
    }
    // The two doors: a banner over each, and the queen's strength when she has been hurt.
    for (const t of [ME, FOE]) {
      const d = doorXY(t), p = toScreen(d.x, d.y, 3.2); if (!p.s) continue;
      const hp = g(t, CG.QUEEN_HP) / sim.cfg.queenHp, col = t !== ME ? '#8fb0ff' : '#ffb057';
      ctx.fillStyle = 'rgba(20, 14, 10, 0.85)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(p.x - 26, p.y - 9, 52, 18, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.font = '800 10.5px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t !== ME ? 'RIVAL' : 'HOME', p.x, p.y);
      if (hp < 1) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - 24, p.y + 12, 48, 5); ctx.fillStyle = hp > 0.4 ? '#9ef252' : '#ff5a3c'; ctx.fillRect(p.x - 24, p.y + 12, 48 * hp, 5); }
    }
    if (rallyAt && now - rallyAt.at < 30000 && g(ME, CG.RALLY_HOLD) > 0) { const p = toScreen(rallyAt.x, rallyAt.y, 0), k = (now / 900) % 1; ctx.strokeStyle = `rgba(255, 90, 60, ${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * (1 + 2.5 * k), p.s * (1 + 2.5 * k) * Math.max(0.3, eye.cos), 0, 0, 7); ctx.stroke(); }
    // Food off screen near home: an arrow at the edge until the first trail is laid.
    if (!firstTrail) drawGhost(now);
  }
  for (const f of floats) {
    const k = (now - f.at) / 1100; if (k > 1) continue;
    const p = toScreen(f.x, f.y, 1.6 + Math.min(1, (now - f.t0) / 900) * 1.6), text = `+${f.n}`;
    ctx.globalAlpha = 1 - k * k; ctx.fillStyle = f.col; ctx.font = `800 ${15 + Math.min(8, f.n)}px ui-rounded, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(20, 10, 6, 0.85)'; ctx.lineWidth = 3.5; ctx.strokeText(text, p.x, p.y); ctx.fillText(text, p.x, p.y);
  }
  ctx.globalAlpha = 1; floats = floats.filter(f => now - f.at < 1100);
  if (preview?.points.length && strokeW.length) {
    const raid = tool === 'raid'; ctx.shadowColor = raid ? '#ff3c2a' : '#ff9a3c'; ctx.shadowBlur = 14; ctx.strokeStyle = raid ? '#ffb0a0' : '#ffd9a0'; ctx.lineWidth = 5;
    ctx.beginPath(); strokeW.forEach(([x, y], i) => { const p = toScreen(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke(); ctx.shadowBlur = 0;
  }
}
/** Until the first trail: a ghost finger draws from the door to the nearest food. */
let ghostT0 = 0;
function drawGhost(now) {
  if (tool !== 'trail' || nestOpen || preview || camGoal) { ghostT0 = 0; return; }
  const e = doorXY(ME); let best = -1, bd = Infinity;
  for (let p = 0; p < MAX_PILES; p++) { if (sim.pileAmount[p] <= 0) continue; const c = sim.pileCell[p], d = (c % L0.sw - e.x) ** 2 + (Math.floor(c / L0.sw) - e.y) ** 2; if (d < bd) { bd = d; best = c; } }
  if (best < 0) return;
  if (!ghostT0) ghostT0 = now + 600; if (now < ghostT0) return;
  const t = ((now - ghostT0) % 2600) / 2600, bx = best % L0.sw + 0.5, by = Math.floor(best / L0.sw) + 0.5, dx = bx - e.x, dy = by - e.y, Ln = Math.hypot(dx, dy) || 1, cx = (e.x + bx) / 2 - dy / Ln * Ln * 0.22, cy = (e.y + by) / 2 + dx / Ln * Ln * 0.22;
  const at = u => toScreen((1 - u) * (1 - u) * e.x + 2 * u * (1 - u) * cx + u * u * bx, (1 - u) * (1 - u) * e.y + 2 * u * (1 - u) * cy + u * u * by);
  const k = Math.min(1, t / 0.62), u = k * k * (3 - 2 * k), fade = t < 0.08 ? t / 0.08 : t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.2) : 1;
  ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = '#ffe2b0'; ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = 12; ctx.lineWidth = 5; ctx.setLineDash([2, 10]);
  ctx.beginPath(); for (let j = 0; j <= 24; j++) { const p = at(u * j / 24); j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
  const f = at(u); ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, 19, 0, 7); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
}

// ---- the nest, cut away: both colonies' rooms lie in one layer of earth ----
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function drawNest(now) {
  const c = nctx, w = L0.nw, h = L0.nh, base = L0.nestBase, z = nestCam.z;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, NW, NH);
  const sx = x => (x - nestCam.x) * z + NW / 2, sy = y => (y - nestCam.y) * z + 26;
  const x0 = Math.max(0, Math.floor(nestCam.x - NW / 2 / z) - 1), x1 = Math.min(w - 1, Math.ceil(nestCam.x + NW / 2 / z) + 1), y0 = Math.max(0, Math.floor(nestCam.y) - 1), y1 = Math.min(h - 1, Math.ceil(nestCam.y + (NH - 26) / z) + 1);
  const soil = c.createLinearGradient(0, 26, 0, NH); soil.addColorStop(0, '#6b4a30'); soil.addColorStop(0.5, '#70402a'); soil.addColorStop(1, '#3a2218');
  c.fillStyle = soil; c.fillRect(0, 26, NW, NH);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const r = hash(x + 91, y + 17); if (r > 0.82) { c.fillStyle = 'rgba(20, 14, 10, 0.3)'; c.beginPath(); c.ellipse(sx(x + r), sy(y + hash(x, y + 5)), z * 0.2, z * 0.13, r * 6, 0, 7); c.fill(); } else if (r < 0.12) { c.fillStyle = 'rgba(255, 226, 190, 0.09)'; c.beginPath(); c.ellipse(sx(x + r * 5), sy(y + hash(x + 3, y)), z * 0.12, z * 0.08, r * 40, 0, 7); c.fill(); } }
  const open = (x, y) => sim.mat[base + y * w + x] === MAT.OPEN;
  for (const [r, col] of [[0.78, '#120c09'], [0.62, '#2a1c14']]) { c.fillStyle = col; c.beginPath(); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (open(x, y)) { const px = sx(x + 0.5), py = sy(y + 0.5); c.moveTo(px + z * r, py); c.arc(px, py, z * r, 0, 7); } c.fill(); }
  // The weevil's reach from your door, while it is in your hill or the store tool is in hand: stores inside it are not safe.
  const V = sim.cfg.pest, D = sim.doorF?.[ME];
  if (V && D && (sim.pest[ME * 8] > 0 || nestTool === 'store')) { let told = false; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (!open(x, y) || sim.owner(y * w + x) !== ME) continue; const d = D[base + y * w + x]; if (d <= V.reach) { c.fillStyle = 'rgba(255, 60, 40, 0.2)'; c.fillRect(sx(x), sy(y), z, z); } else if (d === V.reach + 1) { c.fillStyle = 'rgba(150, 240, 130, 0.5)'; c.fillRect(sx(x), sy(y), z, z); if (!told) { told = true; c.font = '800 11px ui-rounded, system-ui, sans-serif'; c.textAlign = 'left'; const tw = c.measureText('safe from the weevil past here').width; c.fillStyle = 'rgba(18, 12, 9, 0.8)'; c.fillRect(sx(x + 1.2), sy(y) - 15, tw + 10, 15); c.fillStyle = '#b8f28a'; c.fillText('safe from the weevil past here', sx(x + 1.2) + 5, sy(y) - 4); } } } }
  // Rooms by tint, cells waiting to be dug as hatched squares, the stroke under the finger brighter.
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * w + x, r = sim.room[k], m = sim.mark[k];
    if (!r && !m && !(sim.binS[k] | sim.binP[k]) && !sim.cache[k]) continue;
    const px = sx(x), py = sy(y);
    if (r && open(x, y)) {
      c.fillStyle = `rgba(${ROOM_CSS[r]}, 0.16)`; c.fillRect(px + 0.5, py + 0.5, z - 1, z - 1);
      // A small sign of the room's use in each cell's corner, so an empty room still reads: a seed, an egg, a bed.
      c.fillStyle = `rgba(${ROOM_CSS[r]}, 0.55)`; c.beginPath();
      if (r === ROOM.STORE) c.arc(px + z * 0.22, py + z * 0.22, z * 0.09, 0, 7); else if (r === ROOM.NURSERY) c.ellipse(px + z * 0.22, py + z * 0.22, z * 0.11, z * 0.07, 0.6, 0, 7); else if (r === ROOM.GARDEN) { c.arc(px + z * 0.2, py + z * 0.24, z * 0.07, 0, 7); c.arc(px + z * 0.32, py + z * 0.18, z * 0.05, 0, 7); } else if (r === ROOM.MESS) { c.arc(px + z * 0.22, py + z * 0.24, z * 0.09, 0, 3.15); } else if (r === ROOM.POST) { c.moveTo(px + z * 0.12, py + z * 0.3); c.lineTo(px + z * 0.23, py + z * 0.1); c.lineTo(px + z * 0.34, py + z * 0.3); } else c.rect(px + z * 0.12, py + z * 0.17, z * 0.22, z * 0.09);
      c.fill();
    }
    // A plug: packed earth, drawn as a block of cross-hatched clay.
    if (r === PLUG && !open(x, y)) { c.fillStyle = 'rgba(214, 178, 120, 0.3)'; c.fillRect(px + 1, py + 1, z - 2, z - 2); c.strokeStyle = 'rgba(240, 214, 160, 0.85)'; c.lineWidth = 1.2; c.beginPath(); for (let j = 1; j < 4; j++) { c.moveTo(px + z * j / 4, py + 1); c.lineTo(px + z * j / 4, py + z - 1); c.moveTo(px + 1, py + z * j / 4); c.lineTo(px + z - 1, py + z * j / 4); } c.stroke(); }
    // A cache in the clay: a few seeds or a scrap of meat showing in the earth.
    if (sim.cache[k]) { const v = sim.cache[k], big = v >> 1 >= 18; c.fillStyle = `rgba(${v & 1 ? '224, 96, 60' : '243, 215, 122'}, ${0.13 + 0.05 * Math.sin(now / 420 + x)})`; c.beginPath(); c.arc(sx(x + 0.5), sy(y + 0.5), z * 0.7, 0, 7); c.fill(); c.fillStyle = v & 1 ? 'rgba(224, 96, 60, 0.85)' : 'rgba(243, 215, 122, 0.85)'; c.beginPath(); for (const [ax, ay] of big ? [[0.3, 0.38], [0.6, 0.34], [0.45, 0.6], [0.72, 0.62], [0.26, 0.7]] : [[0.35, 0.4], [0.62, 0.45], [0.48, 0.66]]) { c.moveTo(sx(x) + z * (ax + 0.09), sy(y) + z * ay); c.arc(sx(x) + z * ax, sy(y) + z * ay, z * 0.09, 0, 7); } c.fill(); }
    // What lies in a store cell: one seed drawn for a load, sugar pale along the floor, meat red above it.
    const bs = sim.binS[k], bp = sim.binP[k];
    if (bs | bp) for (const [n, col, row] of [[bs, '#f3d77a', 0], [bp, '#e0603c', 2]]) { c.fillStyle = col; c.beginPath(); for (let j = 0; j < Math.min(n, 8); j++) { const gx = px + z * (0.2 + 0.2 * (j % 4)), gy = py + z * (0.86 - 0.17 * (row + (j >> 2))); c.moveTo(gx + z * 0.075, gy); c.arc(gx, gy, z * 0.075, 0, 7); } c.fill(); }
    if (m) { c.fillStyle = `rgba(${ROOM_CSS[r] || '255, 255, 255'}, ${0.2 + 0.08 * Math.sin(now / 260 + x + y)})`; c.fillRect(px + 1, py + 1, z - 2, z - 2); c.strokeStyle = `rgba(${ROOM_CSS[r] || '255, 255, 255'}, 0.8)`; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 2, py + z - 2); c.lineTo(px + z - 2, py + 2); c.stroke(); const left = sim.digLeft[k] / sim.cfg.digTicks; if (left < 1) { c.fillStyle = '#120c09'; c.fillRect(px + 1, py + 1, (z - 2) * (1 - left), z - 2); } }
  }
  if (paint) { c.fillStyle = paint.tool === 'clear' ? 'rgba(255, 90, 60, 0.4)' : `rgba(${ROOM_CSS[ROOM_OF[paint.tool]] || '255, 255, 255'}, 0.45)`; for (let j = 0; j < paint.cells.length; j += 2) c.fillRect(sx(paint.cells[j]) + 1, sy(paint.cells[j + 1]) + 1, z - 2, z - 2); }
  if (paint && paint.cells.length) { const n = paint.cells.length / 2, cost = paintCost(), have = sim.g(ME, CG.SUGAR), spare = Math.max(0, have - C.DIG_KEEP), txt = paint.tool === 'clear' ? `${n} unmarked` : cost ? `${n} cells · ${cost} seeds to dig · ${spare} to spend` : `${n} cells`; c.font = '800 13px ui-rounded, system-ui, sans-serif'; const tw = c.measureText(txt).width + 18, lx = paint.cells[paint.cells.length - 2], ly = paint.cells[paint.cells.length - 1], bx = Math.max(6, Math.min(NW - tw - 6, sx(lx + 0.5) - tw / 2)), by = Math.max(30, sy(ly) - 46); c.fillStyle = cost > spare ? 'rgba(120, 30, 20, 0.92)' : 'rgba(20, 14, 10, 0.88)'; c.beginPath(); c.roundRect(bx, by, tw, 24, 12); c.fill(); c.fillStyle = cost > spare ? '#ffd0c4' : '#ffe9c4'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, bx + 9, by + 12.5); }
  // Digging heard in the other's ground: a ring that fades. A raid under ground: a mark on the cell it is sent to.
  heard = heard.filter(hd => now - hd.at < 5000);
  for (const hd of heard) { const u = (now - hd.at) / 5000; c.strokeStyle = `rgba(255, 80, 60, ${0.9 * (1 - u)})`; c.lineWidth = 2; c.beginPath(); c.arc(sx(hd.k % w + 0.5), sy(Math.floor(hd.k / w) + 0.5), z * (0.6 + 2.2 * u), 0, 7); c.stroke(); }
  for (let s2 = 0; s2 < 2 * TRAILS; s2++) {
    if (!sim.trLive[s2] || sim.trPath[s2 * PATH_MAX] < base) continue;
    const e = sim.trPath[s2 * PATH_MAX] - base, px = sx(e % w + 0.5), py = sy(Math.floor(e / w) + 0.5), r = z * (0.9 + 0.12 * Math.sin(now / 200)), all = sim.trLevel[s2] >= 3;
    c.strokeStyle = s2 < TRAILS ? '#ff5a3c' : '#b98cff'; c.lineWidth = all ? 3.5 : 2; c.beginPath(); c.arc(px, py, r, 0, 7); c.moveTo(px - r * 1.4, py); c.lineTo(px + r * 1.4, py); c.moveTo(px, py - r * 1.4); c.lineTo(px, py + r * 1.4); c.stroke();
  }
  for (const t of [ME, FOE]) {
    const st = sim.store[t] - base, stx = st % w, sty = Math.floor(st / w), q = sim.queen[t] - base, qx = sx(q % w + 0.5), qy = sy(Math.floor(q / w) + 0.5), tint = t !== ME ? '120, 150, 255' : '255, 170, 80';
    const gl = c.createRadialGradient(qx, qy, 0, qx, qy, z * 7); gl.addColorStop(0, `rgba(${tint}, ${0.28 + 0.05 * Math.sin(now / 700)})`); gl.addColorStop(1, `rgba(${tint}, 0)`); c.fillStyle = gl; c.fillRect(qx - z * 7, qy - z * 7, z * 14, z * 14);
    if (g(t, CG.QUEEN_HP) > 0) {
      const u = Math.max(8, z * 1.5), pulse = 1 + 0.06 * Math.sin(now / 300);
      c.fillStyle = t !== ME ? '#27345e' : '#6a2a16'; c.strokeStyle = t !== ME ? '#9fb8ff' : '#ffc070'; c.lineWidth = 1.5; c.shadowColor = t !== ME ? '#6a8cff' : '#ff9a3c'; c.shadowBlur = 14;
      for (const [dx, rx, ry] of [[-1.05, 0.9 * pulse, 0.55 * pulse], [0, 0.4, 0.3], [0.8, 0.32, 0.28]]) { c.beginPath(); c.ellipse(qx + dx * u, qy, rx * u, ry * u, 0, 0, 7); c.fill(); c.stroke(); }
      c.shadowBlur = 0;
      const hp = g(t, CG.QUEEN_HP) / sim.cfg.queenHp; if (hp < 1) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(qx - 24, qy - u - 6, 48, 5); c.fillStyle = hp > 0.4 ? '#9ef252' : '#ff5a3c'; c.fillRect(qx - 24, qy - u - 6, 48 * hp, 5); }
    }
  }
  for (let k = 0; k < sim.bn; k++) {
    const cc = sim.bCell[k] - base, bx = sx((cc % w) + 0.2 + ((k * 0.618034) % 1) * 0.6), by = sy(Math.floor(cc / w) + 0.25 + ((k * 0.381966) % 1) * 0.5), s = sim.bStage[k];
    if (bx < -10 || bx > NW + 10) continue;
    c.beginPath();
    if (s === STAGE.EGG) { c.fillStyle = '#f4efe2'; c.ellipse(bx, by, Math.max(1.4, z * 0.15), Math.max(1.1, z * 0.11), 0.5, 0, 7); }
    else if (s === STAGE.LARVA) { const big = sim.bMajor[k] ? 1.35 : 1; c.fillStyle = sim.bFed[k] ? (sim.bFed[k] > 1 ? '#f0b48a' : '#f3e4b4') : '#cfc8ba'; const r = Math.max(1.3, z * 0.17) * big * (1 + 0.06 * Math.sin(now / 400 + k)); for (let j = 0; j < 4; j++) { const a = 0.9 + (k % 5) * 0.25 + j * 0.62, gx = bx + Math.cos(a) * r * 1.25, gy = by + Math.sin(a) * r * 1.25; c.moveTo(gx + r, gy); c.arc(gx, gy, r * (1 - j * 0.1), 0, 7); } }
    else { const big = sim.bFed[k] > 1 ? 1.4 : 1; c.fillStyle = sim.bFed[k] > 1 ? '#b8743e' : '#c59a62'; c.ellipse(bx, by, Math.max(2, z * 0.4) * big, Math.max(1.5, z * 0.25) * big, 0.6, 0, 7); }
    c.fill();
  }
  const a = host.alpha;
  for (let i = 0; i < sim.n; i++) {
    if (sim.layer[i] !== 1) continue;
    const p = prevOf[i], jump = p < 0 || host.pl[p] !== 1, ax = sx((jump ? sim.x[i] : host.px[p] + (sim.x[i] - host.px[p]) * a) / 256), ay = sy((jump ? sim.y[i] : host.py[p] + (sim.y[i] - host.py[p]) * a) / 256);
    if (ax < -8 || ax > NW + 8 || ay > NH + 8) continue;
    const th = sim.heading[i] * (Math.PI / 128), co = Math.cos(th), si = Math.sin(th), u = Math.max(2.2, z * 0.5) * (sim.caste[i] === CASTE.WARDEN ? 1.8 : sim.caste[i] === CASTE.SPITTER ? 1.1 : sim.caste[i] ? 1.5 : 1);
    c.fillStyle = sim.team[i] !== ME ? (sim.caste[i] === CASTE.SPITTER ? '#5f7fd8' : '#3a4f9a') : sim.caste[i] === CASTE.SPITTER ? '#8a5a1c' : sim.caste[i] ? '#5a1410' : '#0d0705';
    c.beginPath(); c.ellipse(ax - co * u * 0.55, ay - si * u * 0.55, u * 0.5, u * 0.34, th, 0, 7); c.fill();
    c.beginPath(); c.arc(ax + co * u * 0.1, ay + si * u * 0.1, u * 0.24, 0, 7); c.fill();
    c.beginPath(); c.arc(ax + co * u * 0.55, ay + si * u * 0.55, u * (sim.caste[i] ? 0.36 : 0.27), 0, 7); c.fill();
    if (sim.carry[i]) { c.fillStyle = (sim.carry[i] & 3) > 1 ? '#b0452f' : '#f3d77a'; c.beginPath(); c.arc(ax + co * u * 0.95, ay + si * u * 0.95, u * 0.26, 0, 7); c.fill(); }
  }
  // A weevil: a grey domed body with a long snout, and its health over it.
  if (V) for (const t of [ME, FOE]) {
    const hp = sim.pest[t * 8], pc = sim.pest[t * 8 + 1]; if (hp <= 0 || pc < base) continue;
    const k = pc - base, px = sx(k % w + 0.5), py = sy(Math.floor(k / w) + 0.5), u = z * 1.3, bob = Math.sin(now / 130) * u * 0.05, out = sim.pest[t * 8 + 3] === 2 ? -1 : 1;
    c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.beginPath(); c.ellipse(px, py + u * 0.55, u * 0.8, u * 0.2, 0, 0, 7); c.fill();
    c.strokeStyle = '#1c1a17'; c.lineWidth = Math.max(1, u * 0.12); c.beginPath(); for (const lx of [-0.45, 0, 0.45]) { c.moveTo(px + lx * u, py + u * 0.2); c.lineTo(px + lx * u * 1.3, py + u * 0.6 + bob); } c.stroke();
    c.fillStyle = '#5b5a52'; c.beginPath(); c.ellipse(px, py + bob, u * 0.72, u * 0.5, 0, 0, 7); c.fill();
    c.fillStyle = '#7d7b70'; c.beginPath(); c.ellipse(px - u * 0.1, py - u * 0.14 + bob, u * 0.42, u * 0.2, 0, 0, 7); c.fill();
    c.strokeStyle = '#3a3934'; c.lineWidth = Math.max(1.5, u * 0.16); c.beginPath(); c.moveTo(px + out * u * 0.6, py + bob); c.quadraticCurveTo(px + out * u * 1.0, py + bob, px + out * u * 1.05, py + u * 0.4 + bob); c.stroke();
    c.font = '800 10px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffb59a'; c.fillText('weevil', px, py - u * 0.95 - 3); c.fillStyle = 'rgba(0, 0, 0, 0.6)'; c.fillRect(px - u, py - u * 0.95, u * 2, 4); c.fillStyle = '#ff7a4a'; c.fillRect(px - u, py - u * 0.95, u * 2 * hp / V.hp, 4);
  }
  const skyG = c.createLinearGradient(0, 0, 0, 26); skyG.addColorStop(0, light.night > 0.5 ? '#0b0d18' : '#6f7f8f'); skyG.addColorStop(1, light.night > 0.5 ? '#241a1c' : '#c9b59a');
  c.fillStyle = skyG; c.fillRect(0, 0, NW, 26); c.fillStyle = '#4a4340'; c.fillRect(0, 22, NW, 5);
  for (const t of [ME, FOE]) { const d = sx(doorXY(t).x); c.fillStyle = '#120c09'; c.fillRect(d - z * 0.8, 22, z * 1.6, 6); c.fillStyle = t !== ME ? '#8fb0ff' : '#ffb057'; c.font = '800 10px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(t !== ME ? 'RIVAL' : 'HOME', d, 14); }
}

// ---- the frame ----
let light = sky(0.2);
const lightNow = now => sky(set.get('light') === 'day' ? 0.2 : set.get('light') === 'ember' ? 0.85 : screen === 'menu' ? 0.5 + 0.07 * Math.sin(now / 9000) : 0.12 + 0.57 * Math.min(1, sim.tick / sim.cfg.duskTick));
let lastHud = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 0.016);
  run(Gs.tick(performance.now()));
  let stepped = 0;
  if (screen === 'play' || (NET && host.started)) stepped = host.advance(lastT ? Math.min(100, now - lastT) : 0, speed);
  if (stepped) { news(); uploadAnts(); }
  if (sim.result && running) finish(sim.result - 1 === ME, g(ME, CG.QUEEN_HP) <= 0 || g(FOE, CG.QUEEN_HP) <= 0 ? REASON.QUEEN : sim.mission.goals.beast && sim.beast[0] <= 0 && !sim.mission.goals.carry ? REASON.BEAST : sim.mission.goals.points && Math.max(g(ME, CG.POINTS), g(FOE, CG.POINTS)) >= sim.mission.goals.points ? REASON.POINTS : sim.mission.goals.haul && Math.max(g(ME, CG.HAUL), g(FOE, CG.HAUL)) >= sim.mission.goals.haul ? REASON.HAUL : REASON.DUSK); // the result event was lost in a full buffer
  light = lightNow(now);
  const want = screen === 'menu' ? VIEW.low : VIEW[set.get('view')], e = Math.min(1, dt * 3.5); lens.pitch += (want.pitch - lens.pitch) * e; lens.fk += (want.fk - lens.fk) * e;
  if (screen === 'menu') { const en = doorXY(ME); cam.x = en.x + 6 + 5 * Math.sin(now / 7000); cam.y = en.y + 3; cam.z = startZoom(); }
  nestLift += ((nestOpen ? NH / 2 : 0) - nestLift) * Math.min(1, dt * 6);
  if (camGoal && screen === 'play') { const k = Math.min(1, dt * camGoal.rate); cam.x += (camGoal.x - cam.x) * k; cam.y += (camGoal.y - cam.y) * k; cam.z *= Math.exp(Math.log(camGoal.z / cam.z) * k); if (Math.abs(Math.log(camGoal.z / cam.z)) < 0.03 && Math.abs(camGoal.x - cam.x) < 0.05) camGoal = null; }
  clampCam();
  if (screen !== 'paused') { ambient(dt); stepParts(dt); }
  shake = Math.max(0, shake - dt);
  const view = shake ? pose({ x: cam.x + rnd(shake * 0.6), y: cam.y + rnd(shake * 0.6), z: cam.z }) : eye;
  const piles = [];
  for (let p = 0; p < MAX_PILES; p++) if (sim.pileAmount[p] > 0) { const c = sim.pileCell[p], x = c % L0.sw, y = Math.floor(c / L0.sw); piles.push({ x, y, amount: sim.pileAmount[p], kind: sim.pileKind[p] ? 1 : 0, d: (x - cam.x) ** 2 + (y - cam.y) ** 2 }); }
  piles.sort((a, b) => a.d - b.d);
  const b = beacon && now - beacon.at < (beacon.life ?? 7000) ? { x: beacon.x, y: beacon.y, age: (now - beacon.at) / 1000 } : null;
  const rally = rallyAt && g(ME, CG.RALLY_HOLD) > 0 ? rallyAt : null;
  if (renderer && renderer.draw({ view, light, ink: set.get('style') === 'ink', alpha: screen === 'play' ? host.alpha : 1, running: screen === 'play', time: now / 1000, piles, entrances: [{ ...doorXY(ME), w: 3 }, { ...doorXY(FOE), w: 3 }], alarm: rally, beacon: b, big: Number(set.get('size')) })) frames++;
  drawOverlay(now);
  if (nestOpen) drawNest(now);
  if (now - lastHud > 250) { lastHud = now; if (screen !== 'menu') hud(); }
  if (lastT && screen === 'play') { slow.sum += now - lastT; if (++slow.n >= 120) { const mean = slow.sum / slow.n; slow = { sum: 0, n: 0 }; if (mean > 24 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); resize(); rec.event('dpr', { at: sim.tick, cap: dprCap, ms: Math.round(mean) }); } } }
  lastT = now;
}
requestAnimationFrame(frame);

// ---- hooks for checks ----
window.game = {
  state: () => ({ screen, tool, nest: nestOpen, t: sim.tick, ants: sim.n, drawn: drawnAnts, gl: !!renderer && !renderer.lost, glFailed, frames, result: sim.result, sel, set: set.snapshot(), ...summary() }),
  toScreen: (x, y, h) => toScreen(x, y, h), camera: () => ({ ...cam }), setCamera: c => { camGoal = null; Object.assign(cam, c); clampCam(); },
  door: t => doorXY(t), caches: t => { const o = []; for (let k = 0; k < sim.cache.length; k++) if (sim.cache[k] && sim.owner(k) === t) o.push({ x: k % L0.nw, y: Math.floor(k / L0.nw), loads: sim.cache[k] >> 1, kind: sim.cache[k] & 1 }); return o; }, bins: t => sim.bins[t].map(k => ({ x: k % L0.nw, y: Math.floor(k / L0.nw), s: sim.binS[k], p: sim.binP[k] })), piles: () => { const o = []; for (let p = 0; p < MAX_PILES; p++) if (sim.pileAmount[p] > 0) o.push({ x: sim.pileCell[p] % L0.sw, y: Math.floor(sim.pileCell[p] / L0.sw), kind: sim.pileKind[p], amount: sim.pileAmount[p] }); return o; },
  run: n => { host.run(n); }, // tests: run the sim ahead
  traits: () => sim.cfg.traits,
  auto: mood => { host.ai[ME] = mood; }, // tests: the rival's mind plays your seat too
  modes: () => Array.from(sim.trMode.subarray(ME * TRAILS, ME * TRAILS + TRAILS)), select: k => { sel = k; showRoute(); hud(); },
  linked: () => sim.linked, strike: (x, y) => strikeAt(x, y), queen: t => { const q = sim.queen[t] - L0.nestBase; return [q % L0.nw, Math.floor(q / L0.nw)]; },
  trails: () => { let n = 0; for (let k = 0; k < TRAILS; k++) if (sim.trLive[ME * TRAILS + k]) n++; return n; },
  order, marks: () => { const n = [0, 0]; for (let k = 0; k < sim.mark.length; k++) if (sim.mark[k]) n[sim.mark[k] - 1]++; return n; },
  setTool, setNest, setNestTool, canPaint: (x, y) => sim.owner(y * L0.nw + x) === ME && sim.mat[L0.nestBase + y * L0.nw + x] === MAT.CLAY && !sim.mark[y * L0.nw + x], nestXY: (x, y) => { const r = nestCanvas.getBoundingClientRect(); return [r.left + (x + 0.5 - nestCam.x) * nestCam.z + NW / 2, r.top + (y + 0.5 - nestCam.y) * nestCam.z + 26]; }, setSpeed, order, run: n => { host.run(n); news(); uploadAnts(); }, log: () => JSON.parse(JSON.stringify(host.log)), hash: () => sim.hash(),
};
void TASK;
