/** Good Hands' JSON view of an HF actor. The HF Run remains authoritative. */
import type * as HF from '@adam0white/human-framework';

export type Traits = HF.PersonAuthoring['state']['traits'];
export type Values = HF.PersonAuthoring['state']['values'];
export type Opening = {
  id: string;
  name?: string;
  seed: number;
  now?: number;
  bornAt?: number;
  sex?: 'female' | 'male';
  traits?: Partial<Traits>;
  values?: Partial<Values>;
  needs?: Partial<HF.PersonAuthoring['state']['needs']>;
  skills?: Record<string, number>;
  lexicon?: { plainEnglish: boolean };
  voices?: { voiceId: string; trust?: number }[];
  relationships?: (Partial<HF.PersonAuthoring['state']['relationships'][number]> & { otherId: string })[];
};
export type Affordance = {
  id: string;
  action: string;
  label: string;
  duration: number;
  targetId?: string;
  placeId?: string;
  effort: number;
  mode?: 'awake' | 'sleep';
  skill?: { id: string; difficulty: number };
  advertises: HF.Offer['expected']['needs'];
  tags?: string[];
  norms?: HF.Offer['norms'];
  fulfills?: string[];
};
export type Commitment = Omit<
  HF.PersonAuthoring['state']['agenda']['commitments'][number],
  'id' | 'status' | 'recurEveryMs'
> & { recurEvery?: number };
export type Percept = Pick<HF.PerceptData, 'channel' | 'kind' | 'actorId' | 'targetId'> & {
  at: number;
  salience?: number;
  valence?: number;
  summary?: string;
  claims?: readonly HF.PerceptData['claims'][number][];
};
export type SocialEvent = {
  at: number;
  otherId: string;
  kind: Extract<HF.Input, { kind: 'social.received' }>['payload']['event']['kind'];
  byMe: boolean;
  magnitude: number;
};
export type ObservedAct = { at: number; tags?: string[]; toward?: number; withId?: string };
export type DecideOptions = {
  suggestion?: Omit<
    Extract<
      Extract<HF.Input, { kind: 'suggestion.received' }>['payload']['received'],
      { kind: 'ordinary' }
    >['suggestion'],
    'adviceId'
  >;
};
export type ConversationReceipt = {
  told: Percept[];
  socialEvents: { speaker: SocialEvent[]; listener: SocialEvent[] };
};
export type Person = {
  id: string;
  name: string;
  now: number;
  engine: string;
  traits: Traits;
  values: Values;
  skills: Record<string, { level: number; practice: number; lastPracticed: number }>;
  life: { bornAt: number; sex: 'female' | 'male' };
  body: {
    fitness: number;
    exertion: number;
    sleepPressure: number;
    alive: boolean;
    sleepDebt: number;
    circadianPeak: number;
    downed?: unknown;
  };
  needs: HF.PersonAuthoring['state']['needs'];
  affect: { mood: HF.PersonAuthoring['state']['affect']['mood'] };
  memory: {
    episodes: { id: string }[];
    beliefs: readonly HF.DeepReadonly<HF.BeliefReading>[];
    sourceTrust: Readonly<Record<string, number>>;
    expectations: unknown[];
    gists: unknown[];
    contradictions: unknown[];
  };
  social: {
    relationships: readonly HF.DeepReadonly<HF.PersonAuthoring['state']['relationships'][number]>[];
    impressions: unknown[];
  };
  agenda: {
    commitments: (HF.DeepReadonly<HF.PersonAuthoring['state']['agenda']['commitments'][number]> & {
      recurEvery?: number;
      status: 'pending' | 'kept' | 'broken' | 'released';
    })[];
    owed: readonly unknown[];
    goals: readonly unknown[];
    precommitments?: unknown[];
    exemptions: Record<string, unknown>;
  };
  conscience: { norms: readonly HF.PersonAuthoring['state']['heldNorms'][number][] };
  lexicon: { plainEnglish: boolean };
  rng: Record<string, never>;
  skillRetention: Record<string, never>;
  activity?: { id: string; startedAt: number; endsAt: number; affordance: Affordance } | null;
};
