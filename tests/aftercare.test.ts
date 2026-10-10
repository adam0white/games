import { describe, expect, it } from 'vitest';
import {
  type AftercareContext,
  type AftercareGame,
  aftercareActions,
  applyAftercareAction,
} from '../src/game/aftercare';

const willing: AftercareContext = {
  dadHere: true,
  evanHere: true,
  wantsConversation: () => true,
};
function fixture(): AftercareGame {
  return {
    now: 840,
    unlocked: [],
    workshop: { cabinet: 'finished' },
    serviceWeek: { reflection: true, donorInvited: true, part: 'declined' },
  };
}
const ids = (s: AftercareGame) => aftercareActions(s, willing).map((a) => a.id);

it('requires actual cabinet completion and actual donor reflection, not an invitation', () => {
  const s = fixture();
  s.workshop = { cabinet: 'hung' };
  s.serviceWeek = { reflection: false, donorInvited: true, part: 'offered' };
  expect(ids(s)).toEqual([]);
  expect(applyAftercareAction(s, 'aftercare-door-start', willing)).toBeNull();
  expect(applyAftercareAction(s, 'aftercare-label-start', willing)).toBeNull();
  s.serviceWeek.reflection = true;
  s.serviceWeek.part = 'unknown';
  expect(ids(s)).toEqual([]);
  s.serviceWeek.part = 'measured';
  s.serviceWeek.donorInvited = false;
  expect(ids(s)).toEqual([]);
});

describe.each([
  ['aftercare-door-start', 'aftercare-door-question', 'dadHere', 'dad'],
  ['aftercare-label-start', 'aftercare-label-picture', 'evanHere', 'evan'],
] as const)('%s', (start, branch, presence, personId) => {
  it('postpones absence, refusal and missing willingness without consuming the beat', () => {
    const s = fixture();
    const before = structuredClone(s);
    const absent = { ...willing, [presence]: false };
    const refusal = { ...willing, wantsConversation: () => false };
    const unknown = { dadHere: true, evanHere: true };
    for (const ctx of [absent, refusal, unknown]) {
      const r = applyAftercareAction(s, start, ctx);
      expect(r?.minutes).toBe(0);
      expect(r?.lines.every((l) => l.speaker === 'You')).toBe(true);
      expect(s).toEqual(before);
    }
    const speakers: string[] = [];
    const ctx = {
      ...willing,
      wantsConversation: (id: string) => {
        speakers.push(id);
        return true;
      },
    };
    expect(applyAftercareAction(s, start, ctx)?.minutes).toBe(2);
    expect(speakers).toEqual([personId]);
    const pending = structuredClone(s);
    expect(applyAftercareAction(s, branch, absent)?.minutes).toBe(0);
    expect(applyAftercareAction(s, branch, refusal)?.minutes).toBe(0);
    expect(s).toEqual(pending);
    const restored = JSON.parse(JSON.stringify(s)) as AftercareGame;
    expect(applyAftercareAction(restored, branch, ctx)?.minutes).toBe(3);
    expect(applyAftercareAction(restored, start, ctx)).toBeNull();
    expect(applyAftercareAction(restored, branch, ctx)).toBeNull();
    expect(restored.now).toBe(before.now);
    expect(restored.workshop).toEqual(before.workshop);
    expect(restored.serviceWeek).toEqual(before.serviceWeek);
  });
});

it.each(['aftercare-door-ceremony', 'aftercare-door-question', 'aftercare-door-leave'])(
  'allows %s only after Dad joins and records the chosen branch',
  (branch) => {
    const s = fixture();
    expect(applyAftercareAction(s, branch, willing)).toBeNull();
    applyAftercareAction(s, 'aftercare-door-start', willing);
    expect(applyAftercareAction(s, 'aftercare-door-start', willing)).toBeNull();
    const r = applyAftercareAction(s, branch, willing);
    expect(r?.minutes).toBe(3);
    expect(s.unlocked).toContain(branch);
    expect(s.unlocked).not.toContain('aftercare-cabinet-pending');
    expect(r?.lines.map((l) => l.text).join(' ')).not.toMatch(/gear|wage|learned|repaired/);
  },
);

it.each(['aftercare-label-picture', 'aftercare-label-list'])(
  'lets Evan discuss %s even when the gear was declined without inventing its outcome',
  (branch) => {
    const s = fixture();
    expect(applyAftercareAction(s, branch, willing)).toBeNull();
    applyAftercareAction(s, 'aftercare-label-start', willing);
    const r = applyAftercareAction(s, branch, willing);
    expect(s.unlocked).toContain(branch);
    expect(r?.lines.map((l) => l.text).join(' ')).not.toMatch(
      /gear|moving|rebuilding|cancelled|owned/,
    );
    expect(s.serviceWeek?.part).toBe('declined');
  },
);
