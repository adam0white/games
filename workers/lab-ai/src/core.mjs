// games-lab-ai: POST /lab-api/persona and /lab-api/quest ask a small Workers AI model to write a rival
// ("Nemesis") or a meadow quest-giver. The client sends only enumerated fields and small
// integers. The Worker writes the whole prompt itself, so no client text reaches the model. Nothing is logged.

// Every animal name in the game, in sim order. The test checks this list against the game's sim.js.
export const FORM_NAMES = ['Aphid', 'Mite', 'Grub', 'Ant', 'Beetle', 'Fire Ant', 'Spider', 'Scorpion', 'Wasp', 'Mantis', 'Crab', 'Mouse', 'Frog', 'Mole', 'Lizard', 'Bat',
  'Porcupine', 'Squirrel', 'Snake', 'Turtle', 'Rabbit', 'Owl', 'Badger', 'Cat', 'Fox', 'Dog', 'Eagle', 'Lynx', 'Boar', 'Deer', 'Wolf', 'Gorilla', 'Ostrich', 'Panther',
  'Crocodile', 'Cheetah', 'Python', 'Bear', 'Zebra', 'Tiger', 'Hippo', 'Lion', 'Komodo', 'Elephant', 'Giraffe', 'Sabertooth', 'T-Rex', 'Raptor', 'Pterodactyl',
  'Yeti', 'Griffin', 'Basilisk', 'Dragon', 'Thunderbird', 'Hydra'];
export const EVENTS = ['rise', 'kill'];
export const TEMPERAMENTS = ['ambusher', 'stalker', 'brute', 'coward'];
export const GIVERS = ['beetle', 'snail', 'spider', 'frog', 'bird', 'mouse', 'ant-queen', 'firefly'];
export const KINDS = ['fetch', 'hunt', 'escort', 'race', 'hide'];
export const TARGETS = ['seed', 'berry', 'crumb', 'dewdrop', 'feather', 'aphid', 'ladybird', 'lost-ant', 'pebble'];
export const MOODS = ['grumpy', 'kind', 'sly', 'proud', 'sleepy'];
export const QUEST_LIMITS = { name: 24, ask: 70, thanks: 60, scold: 60, secret: 70 };
const TONES = ['grumpy and gruff', 'boastful and showy', 'sly and quiet', 'dramatic and theatrical'];
export const LIMITS = { body: 2048, kills: [1, 9], escapes: [0, 20], kin: [0, 20], variant: [0, 3], name: 24, title: 32, line: 60, maxTokens: 220, timeoutMs: 6000, cacheSeconds: 3600 };
const ALLOWED_ORIGIN = 'https://play.adamwhite.work';
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
export const originAllowed = origin => origin === ALLOWED_ORIGIN || DEV_ORIGIN.test(origin || '');

// Words that make a reply unusable: swearing, gore, real-world religion and politics. A reply that contains one is
// thrown away (502) and the page keeps its offline persona. Cartoon threats ("I will eat you") are allowed.
const BLOCK = new RegExp('\\b(' + [
  'damn', 'hell', 'crap', 'shit\\w*', 'fuck\\w*', 'bitch\\w*', 'bastard\\w*', 'ass', 'arse', 'asshole', 'piss\\w*', 'dick\\w*', 'cock\\w*', 'pussy', 'slut\\w*', 'whore\\w*', 'sex\\w*', 'naked', 'nude',
  'blood\\w*', 'bleed\\w*', 'gore', 'gory', 'guts', 'entrails', 'corpse\\w*', 'murder\\w*', 'torture\\w*', 'behead\\w*', 'decapitat\\w*', 'dismember\\w*', 'slaughter\\w*', 'suicide', 'gun\\w*', 'knife', 'knives', 'stab\\w*', 'drug\\w*', 'beer', 'wine', 'drunk',
  'god', 'gods', 'jesus', 'christ\\w*', 'allah', 'satan\\w*', 'devil\\w*', 'demon\\w*', 'pray\\w*', 'church\\w*', 'mosque\\w*', 'temple', 'bible', 'quran', 'koran', 'religio\\w*', 'heaven', 'holy',
  'president\\w*', 'politic\\w*', 'election\\w*', 'vote\\w*', 'democrat\\w*', 'republican\\w*', 'senator\\w*', 'congress', 'parliament', 'trump', 'biden', 'obama', 'putin', 'hitler', 'nazi\\w*', 'war', 'wars',
].join('|') + ')\\b', 'i');

const json = (status, body, origin) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(originAllowed(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) },
});

// Accepts only the known fields, each enumerated or a small integer. Returns the clean request or null.
export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const allowed = new Set(['event', 'form', 'playerForm', 'kills', 'escapes', 'kin', 'variant', 'previousName']);
  if (Object.keys(body).some(k => !allowed.has(k))) return null;
  const int = (v, [lo, hi]) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!EVENTS.includes(body.event) || !FORM_NAMES.includes(body.form) || !FORM_NAMES.includes(body.playerForm)) return null;
  if (!int(body.kills, LIMITS.kills) || !int(body.escapes ?? 0, LIMITS.escapes) || !int(body.kin ?? 0, LIMITS.kin) || !int(body.variant ?? 0, LIMITS.variant)) return null;
  // The previous name is checked so a client cannot smuggle text in it, then dropped: it never reaches the prompt or the cache key.
  if (body.previousName !== undefined && !(typeof body.previousName === 'string' && /^[A-Za-z ]{1,24}$/.test(body.previousName))) return null;
  return { event: body.event, form: body.form, playerForm: body.playerForm, kills: body.kills, escapes: body.escapes ?? 0, kin: body.kin ?? 0, variant: body.variant ?? 0 };
}

// Every quest field is required; no free text or defaulted fields reach the prompt.
export function validateQuest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = ['giver', 'kind', 'target', 'count', 'mood', 'variant'];
  if (Object.keys(body).length !== keys.length || Object.keys(body).some(k => !keys.includes(k))) return null;
  if (!GIVERS.includes(body.giver) || !KINDS.includes(body.kind) || !TARGETS.includes(body.target) || !MOODS.includes(body.mood)) return null;
  if (!Number.isInteger(body.count) || body.count < 1 || body.count > 9 || !Number.isInteger(body.variant) || body.variant < 0 || body.variant > 3) return null;
  return { giver: body.giver, kind: body.kind, target: body.target, count: body.count, mood: body.mood, variant: body.variant };
}

export const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' }, title: { type: 'string' },
    temperament: { type: 'string', enum: TEMPERAMENTS },
    persistence: { type: 'integer', minimum: 1, maximum: 3 }, territory: { type: 'integer', minimum: 1, maximum: 3 },
    lines: { type: 'object', properties: { rise: { type: 'string' }, notice: { type: 'string' }, escape: { type: 'string' }, kill: { type: 'string' }, beaten: { type: 'string' } }, required: ['rise', 'notice', 'escape', 'kill', 'beaten'] },
  },
  required: ['name', 'title', 'temperament', 'persistence', 'territory', 'lines'],
};
export const QUEST_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: Object.fromEntries(Object.entries(QUEST_LIMITS).map(([k, maxLength]) => [k, { type: 'string', minLength: 3, maxLength, ...(k === 'name' ? { pattern: "^[A-Za-z' -]+$" } : {}) }])),
  required: Object.keys(QUEST_LIMITS),
};

// The whole prompt is written here from validated fields only.
export function buildMessages(q) {
  const system = [
    'You write a rival animal for a cartoon phone game for all ages. The player is a small animal that eats weaker animals to grow.',
    'The rival is the animal that just ate the player. It talks in short speech bubbles.',
    'Reply with JSON only, in this shape: {"name": "...", "title": "...", "temperament": "ambusher|stalker|brute|coward", "persistence": 1-3, "territory": 1-3, "lines": {"rise": "...", "notice": "...", "escape": "...", "kill": "...", "beaten": "..."}}.',
    'name: an invented nickname, then "the", then the animal, for example "Old Scar the Wasp" or "Grim Pincers the Crab". At most 24 characters. Never a real person, never a common human first name.',
    'title: a short invented title, at most 30 characters, for example "Terror of the Tall Grass".',
    'temperament: ambusher waits still and watches; stalker follows and strikes when the player is busy; brute charges and chases far; coward bullies small animals and runs from close ones.',
    'persistence 1-3: how long it keeps hunting. territory 1-3: how far it roams.',
    'lines: each one short sentence, at most 45 characters, spoken to the player. rise: just ate the player and claims them as its rival. notice: spots the player again. escape: the player got away. kill: ate the player again. beaten: last words when the player finally eats it.',
    'Keep it playful and silly. Cartoon threats such as "I will eat you" are fine. No swearing, no blood or injuries, no weapons, nothing about real people, religion, politics, countries or brands.',
  ].join('\n');
  const what = q.event === 'rise'
    ? `It just ate the player for the first time.`
    : `It just ate the player again. That makes ${q.kills} times, and it has grown stronger.`;
  const user = [
    `The rival animal is a ${q.form}. The player is now a ${q.playerForm}.`,
    what,
    `The player has escaped it ${q.escapes} times and has eaten ${q.kin} other ${q.form} animals.`,
    `Make its voice ${TONES[q.variant]}.`,
  ].join(' ');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

export function buildQuestMessages(q) {
  const system = [
    'You write a quest-giver for a cheerful meadow phone game for children. Reply in English, with short, warm, funny, child-safe sentences.',
    'Reply with JSON only: {"name":"...","ask":"...","thanks":"...","scold":"...","secret":"..."}.',
    'name: an invented animal nickname, letters, spaces, apostrophes and hyphens only, at most 24 characters. Never a real person.',
    'ask: the giver asks the player to do the given task. Include the exact count as a digit and the target, with a natural plural if needed. At most 70 characters.',
    'thanks: said when the player succeeds, at most 60 characters. scold: a gentle, silly complaint when the player fails or dawdles, at most 60 characters.',
    'secret: one small piece of invented lore about the meadow, at most 70 characters.',
    'fetch means bring things, hunt means find things, escort means guide companions, race means race past markers, hide means hide things. Keep every task harmless.',
    'No swearing, blood, injuries, weapons, real people, religion, politics, countries or brands. Return every field, without any extra fields.',
  ].join('\n');
  const user = `The giver is a ${q.giver}, feeling ${q.mood}. Task: ${q.kind}. Target: ${q.target}. Count: ${q.count}. Voice variation: ${q.variant}.`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

// Plain text only: letters, digits, spaces and simple punctuation. Cut at a word boundary to fit.
export function plain(text, max) {
  if (typeof text !== 'string') return '';
  let t = text.normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/[^A-Za-z0-9 .,!?'"-]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^"+|"+$/g, '').trim();
  if (t.length > max) { const cut = t.slice(0, max + 1); const sp = cut.lastIndexOf(' '); t = (sp > max * 0.5 ? cut.slice(0, sp) : t.slice(0, max)).replace(/[ ,-]+$/, ''); }
  return t;
}

// Parse the model's answer (an object, or a string that may carry code fences) and clamp it. Returns null if unusable.
export function clean(raw) {
  let o = raw;
  if (typeof o === 'string') {
    const a = o.indexOf('{'), b = o.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { o = JSON.parse(o.slice(a, b + 1)); } catch { return null; }
  }
  if (!o || typeof o !== 'object' || !o.lines || typeof o.lines !== 'object') return null;
  const name = plain(o.name, LIMITS.name).replace(/[^A-Za-z' -]/g, '').replace(/\s+/g, ' ').trim();
  const title = plain(o.title, LIMITS.title);
  if (name.length < 3 || title.length < 3) return null;
  if (!TEMPERAMENTS.includes(o.temperament)) return null;
  const knob = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(1, Math.min(3, n)) : null; };
  const persistence = knob(o.persistence), territory = knob(o.territory);
  if (persistence === null || territory === null) return null;
  const lines = {};
  for (const k of ['rise', 'notice', 'escape', 'kill', 'beaten']) { lines[k] = plain(o.lines[k], LIMITS.line); if (lines[k].length < 3) return null; }
  if (BLOCK.test([name, title, ...Object.values(lines)].join(' '))) return null;
  return { name, title, temperament: o.temperament, persistence, territory, lines };
}

// Apply the same text and word filters as persona. A clamped ask must still name its count and target.
export function cleanQuest(raw, q) {
  let o = raw;
  if (typeof o === 'string') {
    const a = o.indexOf('{'), b = o.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { o = JSON.parse(o.slice(a, b + 1)); } catch { return null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const out = {};
  for (const [k, max] of Object.entries(QUEST_LIMITS)) {
    out[k] = plain(o[k], max);
    if (k === 'name') out[k] = out[k].replace(/[^A-Za-z' -]/g, '').replace(/\s+/g, ' ').trim();
    if (out[k].length < 3) return null;
  }
  const target = q.target === 'berry' ? 'berr(?:y|ies)' : q.target === 'lost-ant' ? 'lost[ -]ants?' : `${q.target}s?`;
  if (!new RegExp(`\\b${q.count}\\b`).test(out.ask) || !new RegExp(`\\b${target}\\b`, 'i').test(out.ask)) return null;
  if (BLOCK.test(Object.values(out).join(' '))) return null;
  return out;
}

const cacheKey = q => `https://games-lab-ai.cache/persona/v1/${q.event}/${encodeURIComponent(q.form)}/${encodeURIComponent(q.playerForm)}/${q.kills}/${q.escapes}/${q.kin}/${q.variant}`;
const questCacheKey = q => `https://games-lab-ai.cache/quest/v1/${q.giver}/${q.kind}/${q.target}/${q.count}/${q.mood}/${q.variant}`;
const withTimeout = (p, ms) => { let timer; return Promise.race([p, new Promise((_, no) => { timer = setTimeout(() => no(new Error('timeout')), ms); })]).finally(() => clearTimeout(timer)); };

// The daily cap. DAILY_CAP is a var; anything that is not a whole number from 1 up falls back to the default.
export const DEFAULT_DAILY_CAP = 2000;
export const dailyCap = env => { const n = Number(env.DAILY_CAP); return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_CAP; };
export const utcDay = ms => new Date(ms).toISOString().slice(0, 10);
// The counting, run inside the Durable Object against its SQLite storage (sql.exec as in ctx.storage.sql).
// One object for everyone, so the count is global and exact: a Durable Object handles one call at a time.
function counterTables(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS calls (day TEXT PRIMARY KEY, persona INTEGER NOT NULL, quest INTEGER NOT NULL)');
  // Before quest existed every call was persona. Backfill once, preserving the live days table and cap.
  sql.exec('INSERT OR IGNORE INTO calls (day, persona, quest) SELECT day, n, 0 FROM days');
}
export function readSpend(sql, day) {
  counterTables(sql);
  const row = sql.exec('SELECT persona, quest FROM calls WHERE day = ?', day).toArray()[0];
  return { persona: row?.persona ?? 0, quest: row?.quest ?? 0 };
}
export function takeOne(sql, day, cap, endpoint = 'persona') {
  if (!['persona', 'quest'].includes(endpoint)) throw new Error('endpoint');
  counterTables(sql);
  const n = sql.exec('SELECT n FROM days WHERE day = ?', day).toArray()[0]?.n ?? 0;
  if (n >= cap) return { ok: false, n };
  sql.exec('INSERT INTO days (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1', day);
  sql.exec(`INSERT INTO calls (day, persona, quest) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET ${endpoint} = ${endpoint} + 1`, day, endpoint === 'persona' ? 1 : 0, endpoint === 'quest' ? 1 : 0);
  sql.exec('DELETE FROM days WHERE day < ?', day); // old days are not needed
  sql.exec('DELETE FROM calls WHERE day < ?', day);
  return { ok: true, n: n + 1 };
}

// deps.cache is a Cache (caches.default in the Worker); tests pass a Map-backed stand-in or nothing.
export async function handle(request, env, ctx = { waitUntil() {} }, deps = {}) {
  const url = new URL(request.url), origin = request.headers.get('Origin');
  const endpoint = /^\/lab-api\/(persona|quest|spend)$/.exec(url.pathname)?.[1];
  if (!endpoint) return json(404, { error: 'not found' }, origin);
  // Same-site reads need no Origin, as with boards. A model request always needs an allowed Origin.
  if (origin ? !originAllowed(origin) : endpoint !== 'spend' || request.method !== 'GET') return json(403, { error: 'origin' }, null);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': endpoint === 'spend' ? 'GET' : 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' } });
  }
  if (endpoint === 'spend') {
    if (request.method !== 'GET') return json(405, { error: 'method' }, origin);
    const day = utcDay(deps.now ? deps.now() : Date.now());
    try { return json(200, { day, calls: await env.DAILY.get(env.DAILY.idFromName('global')).spend(day), cap: dailyCap(env) }, origin); }
    catch { return json(503, { error: 'daily cap' }, origin); }
  }
  if (request.method !== 'POST') return json(405, { error: 'method' }, origin);
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return json(400, { error: 'type' }, origin);
  if (Number(request.headers.get('Content-Length') || 0) > LIMITS.body) return json(413, { error: 'size' }, origin);
  let text;
  try { text = await request.text(); } catch { return json(400, { error: 'body' }, origin); }
  if (text.length > LIMITS.body) return json(413, { error: 'size' }, origin);
  let body;
  try { body = JSON.parse(text); } catch { return json(400, { error: 'json' }, origin); }
  const quest = endpoint === 'quest', q = quest ? validateQuest(body) : validate(body);
  if (!q) return json(400, { error: 'fields' }, origin);

  // Repeats of the same request are answered from the cache and cost nothing.
  const cache = deps.cache, key = new Request(quest ? questCacheKey(q) : cacheKey(q));
  if (cache) { const hit = await cache.match(key); if (hit) return json(200, await hit.json(), origin); }

  // Spend guards: one limit per visitor address and one shared by everyone (both counted per Cloudflare location).
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    if (!(await env.PER_IP.limit({ key: ip })).success || !(await env.GLOBAL.limit({ key: 'all' })).success) return json(429, { error: 'busy' }, origin);
  } catch { return json(429, { error: 'busy' }, origin); }

  // Hard cap for the whole world: one Durable Object counts model calls per UTC day. Over the cap, or if the counter
  // cannot be reached, there is no model call and the page keeps its offline text.
  try {
    const day = utcDay(deps.now ? deps.now() : Date.now()), cap = dailyCap(env);
    const counter = env.DAILY.get(env.DAILY.idFromName('global'));
    if (!(await counter.take(day, cap, endpoint)).ok) return json(503, { error: 'daily cap' }, origin);
  } catch { return json(503, { error: 'daily cap' }, origin); }

  let persona = null;
  try {
    const out = await withTimeout(env.AI.run(env.MODEL, { messages: quest ? buildQuestMessages(q) : buildMessages(q), response_format: { type: 'json_schema', json_schema: quest ? QUEST_SCHEMA : SCHEMA }, max_tokens: LIMITS.maxTokens, temperature: 0.9 }, env.AI_GATEWAY ? { gateway: { id: env.AI_GATEWAY, skipCache: true } } : undefined), LIMITS.timeoutMs);
    // Depending on the model the text is in response (string or object) or in an OpenAI-style choices list.
    const raw = out?.choices?.[0]?.message?.content ?? out?.response ?? out;
    persona = quest ? cleanQuest(raw, q) : clean(raw);
  } catch { persona = null; }
  if (!persona) return json(502, { error: 'model' }, origin);
  if (cache) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(persona), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${LIMITS.cacheSeconds}` } })));
  return json(200, persona, origin);
}
