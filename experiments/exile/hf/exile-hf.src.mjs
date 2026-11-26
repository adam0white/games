import { createPerson, createRun, inspect as inspectRun, step } from '@adam0white/human-framework';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const START = 7 * 60 * MINUTE;
const CAMP = { type: 'host', id: 'camp' };
const PRINCE = { type: 'voice', id: 'prince' };
const WORK = ['wood', 'stone', 'farm', 'guard'];
const LABELS = {
  wood: 'gather wood', stone: 'gather stone', farm: 'work the farm', eat: 'eat',
  rest: 'rest', guard: 'stand watch', follow: 'follow the prince', idle: 'wait',
};
const ACTS = Object.keys(LABELS);
const VERDICTS = ['assented', 'deferred', 'modified', 'refused', 'complied', 'commanded'];
const EFFORT = { wood: 0.55, stone: 0.62, farm: 0.38, guard: 0.22, follow: 0.48, eat: 0, rest: 0, idle: 0 };
const zeros = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));
const need = (result) => {
  if (!result.ok) throw new Error(`${result.error.code} ${result.error.path}: ${result.error.message}`);
  return result.value;
};

function randomFor(seed, id) {
  let state = seed | 0;
  for (const char of JSON.stringify(id)) state = Math.imul(state ^ char.codePointAt(0), 16777619);
  return () => {
    let bits = state = (state + 0x6d2b79f5) | 0;
    bits = Math.imul(bits ^ (bits >>> 15), bits | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    return ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
  };
}

function person(seed, { key, id, name }, at) {
  const random = randomFor(seed, id);
  const profile = (keys) => Object.fromEntries(keys.map((key) => [key, 0.15 + 0.7 * random()]));
  return {
    id: key,
    identity: { name, birthAt: at - (20 + Math.floor(random() * 36)) * 365 * DAY, sex: random() < 0.5 ? 'female' : 'male' },
    biography: [],
    origin: {
      kind: 'authored',
      basis: { kind: 'evidence', id: 'exile:cast' },
      traits: { kind: 'explicit-authoring', evidence: { kind: 'evidence', id: 'exile:traits' } },
    },
    state: {
      traits: profile(['honesty', 'emotionality', 'extraversion', 'agreeableness', 'conscientiousness', 'openness']),
      values: profile(['benevolence', 'universalism', 'tradition', 'conformity', 'security', 'achievement', 'power', 'hedonism', 'stimulation', 'selfDirection']),
      body: {
        satiety: 0.36 + 0.57 * random(), hydration: 0.95, sleepPressure: 0.13 + 0.17 * random(),
        exertion: 0.05 + 0.45 * random(), fitness: 0.32 + 0.61 * random(), health: 1, pain: 0,
        sleepDebtHours: 0, depletion: 0, circadianPeakMs: 16 * 60 * MINUTE, asleep: false, since: at,
        doze: { context: { posture: 'upright', stimulation: 0.7 }, basis: { kind: 'authored', author: CAMP.id, at } },
        bladder: { fill: 0, pending: 0 }, injuries: [], illnesses: [], exposures: [],
      },
      needs: Object.fromEntries(['safety', 'belonging', 'esteem', 'autonomy', 'competence', 'leisure', 'meaning']
        .map((key) => [key, 0.38 + 0.42 * random()])),
      skills: [], heldNorms: [], beliefs: [], consequences: [], sourceTrust: [],
      context: { scarcity: { kind: 'unobserved' }, smoking: { kind: 'unobserved' } },
      relationships: [], voices: [{ voiceId: PRINCE.id, trust: 0.15 + 0.7 * random() }],
      agenda: {
        exemptions: { traveling: { kind: 'unobserved' }, illnessSeverity: { kind: 'unobserved' } },
        commitments: [], goals: [], precommitments: [], owed: [],
      },
      family: { contactCovered: [], aptitudes: {} }, groups: [], reserve: {},
      retention: { trace: 0, chronicleDays: 31 }, habits: [], expectations: [],
      affect: { mood: { valence: 0, arousal: 0.3 }, regulation: 0.35, emotions: [] },
      promptings: { reading: 'none', responses: [] },
      review: { style: 'accounting', atMsOfDay: 21 * 60 * MINUTE },
      bonds: { courtships: [], marriages: [] },
    },
  };
}

const demands = (act) => ({ effort: EFFORT[act], focus: 0, mode: 'awake', requires: {} });

function spec(seed) {
  return {
    id: 'exile', seed, start: START,
    host: { id: CAMP.id, edition: 'exile-hf', schema: '1' },
    definitions: {
      actions: ACTS.map((id) => ({ id, label: LABELS[id], demands: demands(id), tags: [], norms: [] })),
      norms: [], marriageCustoms: [], skills: [], skillTransfers: [], methods: [], routines: [],
      sources: [CAMP, PRINCE],
      lexicon: {
        names: {}, roles: {}, prefer: 'name',
        actions: Object.fromEntries(ACTS.map((act) => [act, { base: LABELS[act] }])),
      },
      calendar: {
        id: 'camp-day', epoch: { id: 'epoch', simulationAt: 0, dayIndex: 0, msOfDay: 0 }, dayMs: DAY,
        days: [{ dayIndex: 0, start: 0, windows: [] }, { dayIndex: 1, start: DAY, windows: [] }],
      },
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    world: { revision: 0, facts: [], hostState: {} },
  };
}

function offers(villager, { stores, night, homes, rally }, present) {
  if (!present) return [];
  const available = [...WORK, 'rest', 'idle'];
  if (stores.food >= 1) available.push('eat');
  if (rally) available.push('follow');
  const expected = {
    wood: { competence: (stores.wood < 8 ? 0.32 : 0.12) * villager.work.wood, meaning: 0.12 },
    stone: { competence: (stores.stone < 8 ? 0.32 : 0.12) * villager.work.stone, meaning: 0.12 },
    farm: { meaning: (stores.food < 8 ? 0.42 : 0.22) * villager.work.farm, competence: 0.12 },
    guard: { safety: (night ? 0.45 : 0.18) * villager.work.guard },
    follow: { belonging: 0.23 },
    eat: { food: 0.64 },
    rest: { rest: homes > 0 ? 0.50 : 0.37 },
    idle: {},
  };
  return available.map((act) => ({
    id: act, actionId: act, label: LABELS[act], person: villager.key,
    durationMs: (act === 'eat' ? 8 : act === 'rest' ? 24 : 40) * MINUTE,
    demands: demands(act), participants: [], alongside: [], tags: [], norms: [],
    expected: { needs: expected[act], followedBy: [], provenance: ['authored:exile-camp'] },
    fulfills: [], advances: [], diminishes: [],
  }));
}

function failUnless(condition, message) {
  if (!condition) throw new Error(message);
}

class Camp {
  constructor({ seed, minutesPerSecond = 2, villagers }) {
    failUnless(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'seed must be a uint32');
    failUnless(Number.isFinite(minutesPerSecond) && minutesPerSecond > 0, 'minutesPerSecond must be positive');
    failUnless(Array.isArray(villagers), 'villagers must be an array');
    this.seed = seed;
    this.rate = minutesPerSecond;
    this.run = need(createRun(spec(seed)));
    this.roster = new Map();
    this.byKey = new Map();
    this.at = START;
    this.time = -1;
    this.rally = false;
    this.sequence = 0;
    this.metrics = { decisions: 0, byAct: zeros(ACTS), suggestions: 0, verdicts: zeros(VERDICTS) };
    this.samples = [];
    this.msTotal = 0;
    this.msMax = 0;
    for (const entry of villagers) {
      const villager = this.add(entry);
      need(createPerson(this.run, person(seed, villager, START)));
      villager.admitted = true;
    }
  }

  add({ id, name }) {
    failUnless((typeof id === 'string' && id.length > 0) || Number.isSafeInteger(id), 'id must be a string or integer');
    failUnless(typeof name === 'string' && name.trim().length > 0, 'name must be a nonempty string');
    failUnless(!this.roster.has(id), 'villager ID already exists');
    const key = `villager-${this.roster.size + 1}`;
    const random = randomFor(this.seed, id);
    const work = Object.fromEntries(WORK.map((act) => [act, 0.65 + 0.7 * random()]));
    const lastWork = [...WORK].sort((a, b) => work[b] - work[a])[0];
    const villager = { id, key, name: name.normalize('NFC'), work, lastWork, revision: 0, lastLine: null, activity: null };
    this.roster.set(id, villager);
    this.byKey.set(key, villager);
    return villager;
  }

  input(at, kind, payload, source = CAMP) {
    return { id: `exile:${++this.sequence}`, at, source, kind, payload };
  }

  readEvents(events, frame) {
    for (const event of events) {
      const villager = this.byKey.get(event.person);
      if (!villager) continue;
      const data = event.data;
      if (data.kind === 'decision') {
        this.metrics.decisions++;
        const { chosenAction, considered, chosenAffordanceId, intention } = data.decision;
        const chosen = considered.find((option) => option.affordanceId === chosenAffordanceId);
        const motive = chosen?.terms.reduce((top, term) => term.value > top.value ? term : top, { value: 0 });
        const bodily = motive?.value >= 0.10 && (motive.source === 'need:food' || motive.source === 'need:rest');
        if (bodily && (chosenAction === 'eat' || chosenAction === 'rest') && intention && intention !== villager.lastLine) {
          frame.lines.set(villager.id, intention);
          villager.lastLine = intention;
        }
      }
      if (data.kind !== 'suggestion-resolved' || frame.advice.get(villager.id) !== data.adviceId) continue;
      const { verdict } = data.resolution;
      this.metrics.verdicts[verdict]++;
      frame.verdicts.set(villager.id, verdict);
      const line = event.narration.map(({ text }) => text).join(' ');
      if (line) {
        frame.lines.set(villager.id, line);
        villager.lastLine = line;
      }
    }
  }

  settle(request, frame) {
    if (request.kind === 'communication') {
      return this.input(request.boundaryAt, 'communication.resolved', {
        requestId: request.id, requestHash: request.requestHash, worldRevision: request.worldRevision,
        speaker: request.speaker, emittedItemIds: [], received: [],
      });
    }
    const villager = this.byKey.get(request.person);
    const { id, person, offerId, activityId, stage, worldRevision, requestHash, boundaryAt } = request;
    const base = { requestId: id, person, activityId, stage, worldRevision, requestHash, observations: [] };
    if (stage === 'start') {
      const accepted = frame.present.has(villager.id) && (offerId !== 'eat' || frame.food >= 1);
      if (accepted) {
        villager.activity = { id: activityId, act: offerId, start: boundaryAt };
        if (WORK.includes(offerId)) villager.lastWork = offerId;
      }
      return this.input(boundaryAt, 'action.resolved', { ...base, disposition: accepted ? 'accepted' : 'rejected' });
    }
    const activity = villager.activity;
    failUnless(activity?.id === activityId, 'HF settlement has no matching activity');
    const eating = activity.act === 'eat';
    const status = stage === 'interrupt' ? 'interrupted' :
      eating && (!frame.present.has(villager.id) || frame.food < 1) ? 'failed' : 'completed';
    const actual = { exposures: [], observedProgress: [] };
    if (status === 'completed' && eating) {
      frame.food--;
      frame.eaten++;
      actual.consumed = { food: 0.65 };
    }
    villager.activity = null;
    return this.input(boundaryAt, 'action.resolved', {
      ...base, disposition: status,
      outcome: {
        activityId, offerId, actionId: activity.act, start: activity.start, end: boundaryAt,
        status, evidenceId: `outcome:${id}`, actual, fulfills: [], advances: [],
      },
    });
  }

  advance(until, inputs, frame) {
    for (let boundary = 0; boundary < 10_000; boundary++) {
      const result = need(step(this.run, { until, inputs }));
      this.at = result.at;
      this.readEvents(result.events, frame);
      if (result.boundary.type === 'until') return;
      inputs = result.boundary.requests.map((request) => this.settle(request, frame));
    }
    throw new Error('Exile settlement budget exhausted');
  }

  tick(snapshot) {
    const started = performance.now();
    failUnless(!this.faulted, 'HF tick failed; initialize a new camp');
    const { t, stores, rally, present, night, homes } = snapshot;
    failUnless(Number.isFinite(t) && t >= 0 && t >= this.time, 't must be nonnegative and nondecreasing');
    failUnless(stores && ['wood', 'stone', 'food'].every((key) => Number.isFinite(stores[key]) && stores[key] >= 0), 'stores must be nonnegative numbers');
    failUnless(typeof rally === 'boolean' && typeof night === 'boolean' && Number.isInteger(homes) && homes >= 0, 'invalid camp conditions');
    failUnless(Array.isArray(present) && present.every((id) => this.roster.has(id)) && new Set(present).size === present.length, 'present must contain unique registered IDs');
    const rallyEdge = rally !== this.rally;
    const presentIds = new Set(present);
    const departing = [...this.roster.values()].some((v) => v.activity && !presentIds.has(v.id));
    const prepare = rallyEdge || departing;
    const arrivals = present.map((id) => this.roster.get(id)).filter((villager) => !villager.admitted);
    const mapped = START + Math.round(t * this.rate * MINUTE);
    const until = Math.max(mapped, this.at + (arrivals.length || prepare ? 3 : 2));
    const ingressAt = until - 1;
    failUnless(Number.isSafeInteger(until), 'mapped time is outside the safe integer range');
    const frame = { present: presentIds, food: stores.food, eaten: 0, advice: new Map(), verdicts: new Map(), lines: new Map() };
    try {
      if (arrivals.length || prepare) {
        const at = ingressAt - 1;
        this.advance(at, arrivals.map((villager) => this.input(at, 'person.arrived', {
          authored: person(this.seed, villager, at), arrivalEvidenceId: `arrival:${villager.key}`,
        })), frame);
        for (const villager of arrivals) villager.admitted = true;
      }
      const conditions = { ...snapshot, stores: { ...stores, food: frame.food } };
      const offerKey = [rally, night, homes > 0, stores.wood < 8, stores.stone < 8, frame.food < 8, frame.food >= 1].join('/');
      const inputs = [];
      for (const villager of this.roster.values()) {
        if (!villager.admitted) continue;
        const person = villager.key;
        const isPresent = frame.present.has(villager.id);
        const nextKey = isPresent ? offerKey : '';
        if (villager.offerKey !== nextKey) {
          inputs.push(this.input(ingressAt, 'offers.received', {
            person, revision: ++villager.revision, offers: offers(villager, conditions, isPresent),
          }));
          villager.offerKey = nextKey;
        }
        // Explicitly settle a current activity at a rally edge. HF otherwise uses the advice
        // in a review, interrupts the activity, then chooses again without that advice.
        if (villager.activity && (!isPresent || rallyEdge)) {
          inputs.push(this.input(ingressAt, 'activity.interrupted', {
            person, activityId: villager.activity.id, reason: isPresent ? 'rally-choice' : 'left-camp',
          }));
        }
        if (isPresent && rallyEdge) {
          const adviceId = `advice:${this.sequence + 1}`;
          frame.advice.set(villager.id, adviceId);
          inputs.push(this.input(ingressAt, 'suggestion.received', {
            person, received: { kind: 'ordinary', suggestion: {
              adviceId, voiceId: PRINCE.id, affordanceId: rally ? 'follow' : villager.lastWork, strength: 0.8,
            } },
          }, PRINCE));
        }
      }
      this.advance(until, inputs, frame);
    } catch (error) {
      this.faulted = true;
      throw error;
    }
    this.time = t;
    this.rally = rally;
    this.metrics.suggestions += frame.advice.size;
    const acts = present.map((id) => {
      const act = this.roster.get(id).activity?.act ?? 'idle';
      this.metrics.byAct[act]++;
      const verdict = frame.verdicts.get(id);
      const line = frame.lines.get(id);
      return { id, act, ...(line && { line }), ...(verdict && { verdict }) };
    });
    const ms = performance.now() - started;
    this.samples.push(ms);
    this.msTotal += ms;
    this.msMax = Math.max(this.msMax, ms);
    return { acts, food: -frame.eaten, ms };
  }

  inspect(id) {
    const villager = this.roster.get(id);
    failUnless(villager?.admitted, 'unknown or not-yet-present villager');
    const { parts } = need(inspectRun(this.run, {
      perspective: { kind: 'host' }, people: [villager.key], select: ['needs', 'affect'],
    })).people[0];
    return {
      needs: Object.fromEntries(parts.find(({ select }) => select === 'needs').value.map(({ id, level }) => [id, level])),
      mood: parts.find(({ select }) => select === 'affect').value.mood,
      act: villager.activity?.act ?? 'idle', lastLine: villager.lastLine,
    };
  }

  stats() {
    const sorted = [...this.samples].sort((a, b) => a - b);
    return {
      steps: sorted.length, msTotal: this.msTotal, msMax: this.msMax,
      msP95: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0,
      ...this.metrics,
    };
  }
}

let camp;
function bridge(fn, requiresCamp = true) {
  return (json) => {
    try {
      if (requiresCamp && !camp) throw new Error('Initialize Exile HF first');
      return JSON.stringify(fn(json === undefined ? undefined : JSON.parse(json)));
    } catch (error) {
      return JSON.stringify({ ok: false, error: error.message });
    }
  };
}

globalThis.exileHF = Object.freeze({
  init: bridge((options) => {
    const started = performance.now();
    camp = new Camp(options);
    return { ok: true, version: HF_VERSION, ms: performance.now() - started };
  }, false),
  add: bridge((entry) => { camp.add(entry); return { ok: true }; }),
  tick: bridge((snapshot) => camp.tick(snapshot)),
  inspect: bridge(({ id }) => camp.inspect(id)),
  stats: bridge(() => camp.stats()),
});
