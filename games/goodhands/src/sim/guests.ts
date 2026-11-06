import { castProfile } from './cast.ts';
import type { Affordance, Person } from './hf4.ts';
import {
  advanceAgenda,
  begin,
  completedAction,
  createPerson,
  decide,
  finish,
  isPresent,
  nextDutyId,
  perceive,
  promise,
  readPerson,
  successChance,
  tick,
} from './hf4.ts';
import type { Input, LogEntry, State } from './types.ts';

export type GuestId = 'zeynep-pass' | 'selin-voice';
export type GuestAction = 'offer-trial' | 'decline' | 'ask-service' | 'end-enquiry';
export interface GuestHistory {
  id: string;
  summary: string;
  at: number;
  sourceGame: string;
  sourceEpisodeId: string;
}
export interface GuestAdmission {
  id: GuestId;
  person: Person;
  arm: 'fresh' | 'biography' | 'continuing';
  history: GuestHistory[];
  familyHistory?: { status: 'kept' | 'broken'; from: number; until: number };
}
export interface GuestView {
  id: GuestId;
  name: string;
  status: 'expected' | 'available' | 'working' | 'complete' | 'unavailable';
  text: string;
  choices: { action: GuestAction; label: string; disabled?: string }[];
  trial?: { verdict: string; chance?: number; succeeded?: boolean };
}
interface Guest extends Omit<GuestAdmission, 'person'> {
  status: GuestView['status'];
  arrival: number;
  text: string;
  trial?: GuestView['trial'];
  encounterEpisode?: string;
  routine?: string;
}
interface GuestState extends State {
  guests: Guest[];
}
const DAY = 1440;
const IDENTITY = {
  'zeynep-pass': {
    name: 'Zeynep',
    age: 45,
    cast: 'hf.cast.zeynep.pass',
    source: 'pass',
    mapping: 'pass-zeynep/1',
  },
  'selin-voice': {
    name: 'Selin',
    age: 32,
    cast: 'hf.cast.selin.voice',
    source: 'voice',
    mapping: 'voice-selin/1',
  },
} as const;
const clone = <T>(x: T): T => structuredClone(x);
const local = (at: number) => ((at % DAY) + DAY) % DAY;
function fail(message: string): never {
  throw new Error(`Good Hands guest: ${message}`);
}
function record(s: State, text: string, kind: LogEntry['kind'] = 'word') {
  const log = s.log as LogEntry[];
  log.push({ id: log.length + 1, at: s.now, kind, text });
}
function family(p: Person) {
  return promise(p, {
    kind: 'promise',
    toId: 'sons',
    targetId: 'home',
    actions: ['leave-for-home'],
    from: Math.floor(p.now / DAY) * DAY + 1290,
    until: Math.floor(p.now / DAY) * DAY + 1330,
    importance: 0.7,
    recurEvery: DAY,
    chain: 'pass-family',
    label: 'Home with my sons',
  });
}
function office(p: Person) {
  const d = Math.floor(p.now / DAY) + (local(p.now) >= 1080 ? 1 : 0);
  return promise(p, {
    kind: 'job',
    actions: ['voice-office-work'],
    from: d * DAY + 540,
    until: d * DAY + 1080,
    importance: 0.8,
    recurEvery: DAY,
    chain: 'voice-office-job',
    label: 'Office work',
  });
}
export function freshGuest(id: GuestId, seed = 1): GuestAdmission {
  const info = IDENTITY[id];
  // An authored zero-duration chapter opening, before the guest's first visible encounter.
  const now = DAY + (id === 'zeynep-pass' ? 570 : 1081);
  const person = createPerson({
    lexicon: { plainEnglish: true },
    id,
    name: info.name,
    seed,
    now,
    bornAt: now - info.age * 365.25 * DAY,
    sex: 'female',
    ...castProfile(id),
    skills: id === 'zeynep-pass' ? { cold: 0.7 } : {},
    voices: [{ voiceId: 'nermin', trust: 0.5 }],
  });
  if (id === 'zeynep-pass') family(person);
  else office(person);
  return { id, person, arm: 'fresh', history: [] };
}
export function initGuests(state: State, admissions: GuestAdmission[]) {
  const supplied = new Map(admissions.map((a) => [a.id, a]));
  if (supplied.size !== admissions.length) fail('The same guest was added more than once.');
  const guests: Guest[] = [];
  for (const id of Object.keys(IDENTITY) as GuestId[]) {
    const admission = clone(supplied.get(id) ?? freshGuest(id, state.seed));
    if (admission.person.id !== id || admission.person.name !== IDENTITY[id].name)
      fail('The saved guest’s identity does not match.');
    state.people[id] = admission.person;
    const { person, ...fields } = admission;
    let arrival = Math.max(DAY + (id === 'zeynep-pass' ? 570 : 1081), person.now);
    if (id === 'zeynep-pass' && local(arrival) > 960) arrival = (Math.floor(arrival / DAY) + 1) * DAY + 570;
    guests.push({ ...fields, status: 'expected', arrival, text: '' });
  }
  (state as GuestState).guests = guests;
}
function offer(id: string, action: string, duration: number, extra: Partial<Affordance> = {}): Affordance {
  return { id, action, label: action, duration, effort: 0.1, advertises: {}, ...extra };
}
function startRoutine(p: Person, a: Affordance) {
  const decision = decide(p, [a]);
  begin(p, a, decision);
}
function attendAnswer(p: Person, text: string): string | undefined {
  const before = new Set(p.memory.episodes.map((e) => e.id));
  perceive(p, [
    {
      kind: 'speech',
      channel: 'told',
      at: p.now,
      actorId: 'nermin',
      targetId: p.id,
      valence: 0,
      salience: 1,
      summary: text,
    },
  ]);
  return p.memory.episodes.findLast((e) => !before.has(e.id))?.id;
}
function finishTrial(s: GuestState, g: Guest, p: Person) {
  g.status = 'complete';
  g.text = `The daytime cold-supper preparation is finished. ${g.trial?.succeeded ? 'The cold dishes were ready as agreed.' : 'The cold dishes needed correction.'} Nermin has ended her duty for this trial. Zeynep still keeps her agreed daily time at home with her family.`;
  const account = `Nermin: The household reports that the cold dishes ${g.trial?.succeeded ? 'were ready as agreed' : 'needed correction'}. Your short trial is finished; you have no further agency duty.`;
  g.encounterEpisode = attendAnswer(p, account) ?? g.encounterEpisode;
  record(s, account);
}
export function stepGuests(state: State) {
  const s = state as GuestState;
  for (const g of s.guests ?? []) {
    if (g.status === 'unavailable') continue;
    const p = s.people[g.id]!;
    // Any actor can advance the shared Run through this guest's completion.
    if (g.status === 'working' && completedAction(p, 'cold-food-trial')) finishTrial(s, g, p);
    if (s.now < p.now) continue;
    if (p.activity && s.now >= p.activity.endsAt) {
      const a = p.activity.affordance;
      tick(p, p.activity.endsAt);
      const trial = a.action === 'cold-food-trial';
      finish(p, {
        affordanceId: a.id,
        action: a.action,
        at: p.now,
        status: 'completed',
        ...(trial ? { quality: g.trial?.succeeded ? 1 : 0.25 } : {}),
        needs: a.action === 'eat' ? { food: 0.8, water: 0.8 } : a.action === 'sleep' ? { sleep: 0.8 } : {},
        summary: trial
          ? `She prepared the cold supper. ${g.trial?.succeeded ? 'The dishes were ready as agreed.' : 'The dishes needed correction.'}`
          : a.label,
      });
      advanceAgenda(p, p.now);
      if (trial) finishTrial(s, g, p);
    }
    tick(p, s.now);
    advanceAgenda(p, s.now);
    if (!isPresent(p)) continue;
    if (g.status === 'expected' && s.now >= g.arrival) {
      g.status = 'available';
      g.text =
        g.id === 'zeynep-pass'
          ? 'Zeynep, 45, spent twenty years in a school canteen. This short daytime job is close enough to her home and sons. She offers cold-supper preparation only. She leaves for home at 21:30.'
          : 'Selin phones after office work about practical help for her father Halil in his Anatolian town. Nermin must check whether a suitable service reaches his address. This is an enquiry.';
      if (g.history.length) g.text += ` Her saved account says: “${g.history.at(-1)!.summary}”`;
      record(s, `${IDENTITY[g.id].name}: ${g.text}`, 'arrival');
    }
    if (p.activity || state.castPauseRequested) continue;
    const t = local(s.now);
    const obligation = p.agenda.commitments.find(
      (c) => c.status === 'pending' && c.from <= s.now && c.until > s.now,
    );
    if (obligation) {
      const z = g.id === 'zeynep-pass';
      startRoutine(
        p,
        offer(
          z ? 'guest-home' : 'guest-office',
          z ? 'leave-for-home' : 'voice-office-work',
          obligation.until - s.now,
          {
            targetId: z ? 'home' : undefined,
            placeId: z ? 'home' : 'voice-office',
            fulfills: [obligation.id],
          },
        ),
      );
    } else if (t === 480 || t === 1110) {
      startRoutine(p, offer('guest-meal', 'eat', 20, { advertises: { food: 0.8, water: 0.8 } }));
    } else if (t === 1350) {
      startRoutine(p, offer('guest-sleep', 'sleep', 570, { mode: 'sleep', advertises: { sleep: 0.8 } }));
    }
  }
}
function answerEnquiry(s: GuestState, g: Guest, p: Person, action: 'ask-service' | 'end-enquiry') {
  const text =
    action === 'ask-service'
      ? 'Nermin: I cannot confirm a suitable service reaches your father’s address. We have made no placement. Please check local availability and ask him what help he wants.'
      : 'Nermin: We have ended the enquiry without arranging help. Your father has not agreed to a service.';
  g.encounterEpisode = attendAnswer(p, text);
  g.text = text;
  g.status = 'complete';
  record(s, `Selin heard ${text}`);
}
export function applyGuest(state: State, input: Extract<Input, { type: 'guest-action' }>) {
  const s = state as GuestState;
  const g = s.guests?.find((row) => row.id === input.guest);
  if (!g || g.status !== 'available') return;
  const p = s.people[g.id]!;
  const t = local(s.now);
  if (g.id === 'zeynep-pass' && input.action === 'offer-trial') {
    if (t < 540 || t > 960 || p.activity) return;
    const a = offer('cold-supper-trial', 'cold-food-trial', 90, {
      skill: { id: 'cold', difficulty: 0.65 },
      advertises: { competence: 0.45 },
      tags: ['work'],
      fulfills: [nextDutyId(p)],
    });
    const rest = offer('guest-wait', 'rest', 15, { advertises: { leisure: 0.05 } });
    const decision = decide(p, [a, rest], {
      suggestion: { voiceId: 'nermin', affordanceId: a.id, strength: 0.7, appeal: 'achievement' },
    });
    const verdict = decision.suggestion?.verdict ?? 'refused';
    g.trial = { verdict };
    if (verdict !== 'assented') {
      g.text = `Zeynep ${verdict === 'deferred' ? 'asks to wait' : 'does not agree to this trial'}. Nermin accepts her answer.`;
      record(s, g.text);
      return;
    }
    const chance = successChance(p, 'cold', 0.65, readPerson(p).body.capacity);
    // Matched seeds share this event draw across all three comparison arms.
    const draw = eventRoll(s.seed, 'zeynep-cold-trial');
    g.trial = { verdict, chance, succeeded: draw < chance };
    promise(p, {
      kind: 'duty',
      actions: ['cold-food-trial'],
      from: s.now,
      until: s.now + 90,
      importance: 0.6,
      label: 'Short cold-supper trial',
    });
    begin(p, a, decision);
    g.status = 'working';
    g.text =
      'Zeynep agreed to the ninety-minute cold-supper preparation. Her time at home with her family stays free.';
    record(s, g.text);
  } else if (g.id === 'selin-voice' && (input.action === 'ask-service' || input.action === 'end-enquiry')) {
    if (t < 1080 || p.activity) return;
    answerEnquiry(s, g, p, input.action);
  } else if (g.id === 'zeynep-pass' && input.action === 'decline') {
    g.text = 'Nermin declined the guest trial. The agency did not arrange a job.';
    g.status = 'complete';
    g.encounterEpisode = attendAnswer(p, g.text);
    record(s, g.text);
  }
}
function eventRoll(seed: number, event: string) {
  let h = 2166136261;
  for (const c of `${seed}:${event}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
export function guestViews(state: State): GuestView[] {
  return ((state as GuestState).guests ?? [])
    .filter((g) => g.status !== 'expected' && g.status !== 'unavailable')
    .map((g) => ({
      id: g.id,
      name: IDENTITY[g.id].name,
      status: g.status,
      text: g.text,
      ...(g.trial ? { trial: clone(g.trial) } : {}),
      choices:
        g.status !== 'available'
          ? []
          : g.id === 'zeynep-pass'
            ? [
                {
                  action: 'offer-trial',
                  label: 'Offer a short cold-supper trial',
                  ...(local(state.now) > 960 || state.people[g.id]!.activity
                    ? { disabled: 'A daytime trial needs ninety free minutes.' }
                    : {}),
                },
                { action: 'decline', label: 'Decline the guest trial' },
              ]
            : [
                {
                  action: 'ask-service',
                  label: 'Check what help the agency can arrange',
                  ...(local(state.now) < 1080 || state.people[g.id]?.activity
                    ? {
                        disabled: 'Selin can speak after office work, from 18:00.',
                      }
                    : {}),
                },
                {
                  action: 'end-enquiry',
                  label: 'End the enquiry without arranging help',
                  ...(local(state.now) < 1080 || state.people[g.id]?.activity
                    ? {
                        disabled: 'Selin can speak after office work, from 18:00.',
                      }
                    : {}),
                },
              ],
    }));
}
