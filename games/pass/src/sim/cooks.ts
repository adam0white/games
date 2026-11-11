/**
 * The crew as HF people. Everything about who they are lives in the PersonSpec and a few habits and
 * commitments; the game reads them back through HF (predict, decide, reviewLine, promptings, chronicle) and never
 * keeps a parallel model of their minds. The founders are Nevin's three cooks; hires are rolled from templates.
 * The chef is also an HF person, used only as an observer: the impressions it forms of a new hire drive the
 * pencilled guesses on that hire's job buttons (HF `predictAs`).
 */
import { type Person, promise } from './hf4-person.ts';

export type CookId = string;
export type Station = 'grill' | 'cold' | 'dish' | 'oven';
export const STATIONS: readonly Station[] = ['grill', 'cold', 'dish', 'oven'];
export const CHEF = 'chef';

/** Service window of a night (minutes of day). */
export const OPEN = 17 * 60 + 30;
export const CLOSE = 22 * 60;
export const RUSH_FROM = 18 * 60 + 30;
export const RUSH_TO = 20 * 60 + 30;

export const dayStart = (m: number) => Math.floor(m / 1440) * 1440;

/** Who works here, as the host knows it: name, home station, pay, and when they came or went. */
export interface CrewMember {
  id: CookId;
  castId?: string;
  name: string;
  home: Station;
  founder: boolean;
  /** Week they started. */
  since: number;
  /** Pay per night worked, ₺ (founders' pay sits inside the bills; a hire's is added to the week's bill). */
  wage: number;
  /** Weekday (0 = Monday) they do not work, when agreed. */
  offDay?: number;
  /** Set when they leave: the night and their words. */
  left?: { night: number; words: string };
  /** The hire template, for hires. */
  template?: string;
}

export const FOUNDERS: readonly CrewMember[] = [
  { id: 'selim', name: 'Selim', home: 'grill', founder: true, since: 1, wage: 0 },
  { id: 'dilek', name: 'Dilek', home: 'cold', founder: true, since: 1, wage: 0 },
  { id: 'rafi', name: 'Rafi', home: 'dish', founder: true, since: 1, wage: 0 },
];

/** Every cook's own line: I don't walk out on a service. */
export function acceptKitchenShift(p: Person, now: number) {
  promise(p, {
    kind: 'abstain',
    toId: CHEF,
    label: 'my shift',
    actions: [],
    violatedBy: ['home'],
    from: dayStart(now) + OPEN,
    until: dayStart(now) + CLOSE - 15,
    importance: 0.55,
    recurEvery: 1440,
  });
}

export function makeCook(
  _id: CookId,
  _seed: number,
  _now: number,
  _edition = 'pass@9',
  _plainNarration = true,
): Person {
  throw new Error('Keep this file and start a new game. This kitchen uses an older version.');
}

// ---------- hires ----------

export interface HireTemplate {
  id: string;
  name: string;
  home: Station;
  wage: number;
  /** How they describe themselves at the back door. Words, not the truth. */
  says: string;
  /** One line the chef can see for themself. */
  looks: string;
  /** What they will ask of the chef one night (a request), in their words. */
  asks: string;
}

export const HIRES: readonly HireTemplate[] = [
  {
    id: 'sam',
    name: 'Sam',
    home: 'dish',
    wage: 40,
    says: '“I’m eighteen. I’m a repair apprentice on a paid work exchange. I need someone to show me how the dishes work here.”',
    looks: 'He is eighteen. He keeps a testing notebook beside his lunch.',
    asks: 'Can I finish at nine tonight? I promised Mum I’d call her about the paid hours.',
  },
  {
    id: 'murat',
    name: 'Murat',
    home: 'grill',
    wage: 60,
    says: '“I worked two years at a roast-meat stand in Bornova. I’m fast, Chef, and I never get tired.”',
    looks: 'He is twenty-seven, with quick hands and a phone in his back pocket.',
    asks: 'Chef, the big football match is on. Can I go at nine?',
  },
  {
    id: 'zeynep',
    name: 'Zeynep',
    home: 'cold',
    wage: 70,
    says: '“I worked twenty years in a school canteen. I have to be home by ten for my boys.”',
    looks: 'She is forty-five and steady. She reads the menu on the wall while she talks.',
    asks: 'My youngest has a fever. Can I go at nine tonight?',
  },
  {
    id: 'can',
    name: 'Can',
    home: 'dish',
    wage: 40,
    says: '“I’m Rafi’s cousin. I’ll do anything, Chef. Anything.”',
    looks: 'He is seventeen and too thin, and he is already rolling up his sleeves.',
    asks: 'Can I eat something first? I haven’t eaten since the morning.',
  },
  {
    id: 'hulya',
    name: 'Hülya',
    home: 'oven',
    wage: 90,
    says: '“Six years in a hotel kitchen in Antalya. I left after a fight with the chef. I was right.”',
    looks: 'She is thirty-eight, with burn scars on both forearms. She looks straight at you.',
    asks: 'Let me run the oven my way tonight. Don’t touch it.',
  },
];

export const hireTemplate = (id: string): HireTemplate | undefined => HIRES.find((h) => h.id === id);

export function makeHire(
  _t: HireTemplate,
  _seed: number,
  _now: number,
  _edition = 'pass@9',
  _plainNarration = true,
): Person {
  throw new Error('Keep this file and start a new game. This kitchen uses an older version.');
}

export function makeChef(_seed: number, _now: number, _plainNarration = true): Person {
  throw new Error('Keep this file and start a new game. This kitchen uses an older version.');
}
