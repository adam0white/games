import { expect, it } from 'vitest';
import { apply, fingerprint, newGame, view } from '../src/sim/index.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';
import { addedEvidence, placementDeadline } from '../src/ui/render.ts';

it('counts the answers left in this visit without changing the saved scene or replay', () => {
  const state = newGame(1);
  apply(state, { type: 'interview', candidate: 'sevda' });
  for (const [used, choice] of ['last-family', 'wage', 'q-patient', 'hours'].entries()) {
    expect(view(state).scene?.questionsRemaining).toBe(4 - used);
    apply(state, { type: 'choose', scene: view(state).scene!.id, choice });
  }
  expect(view(state).scene?.questionsRemaining).toBe(0);
  expect(view(state).scene?.choices.map((c) => c.id)).toEqual(['done']);
  expect(state.scene).not.toHaveProperty('questionsRemaining');
  const run = exportRun(state, state.inputs);
  for (const data of [run, compactRun(run)]) {
    expect(fingerprint(verifyImport(JSON.stringify(data)).state)).toBe(fingerprint(state));
  }
});

it('calls a doubtful patience answer evidence without endorsing it', () => {
  const state = newGame(1);
  apply(state, { type: 'interview', candidate: 'sevda' });
  apply(state, { type: 'choose', scene: view(state).scene!.id, choice: 'q-patient' });
  const notes = view(state).scene!.added!;
  expect(addedEvidence(notes)).toBe(`${notes[0]!.from} said this. Nermin’s reading: ${notes[0]!.phrase}`);
  expect(addedEvidence(notes.map((n) => ({ ...n, crossedOut: true })))).toBe('');
});

it('uses the selected household deadline, including another household', () => {
  const state = newGame(1);
  const v = view(state);
  const request = v.requests[0]!;
  expect(placementDeadline(v, request.family)).toContain(`by ${request.byLabel}.`);
  expect(placementDeadline(v, 'missing')).toBe('');
  const next = { ...request, family: 'kayas', byLabel: 'Wednesday 4 November 08:00' };
  expect(placementDeadline({ ...v, requests: [...v.requests, next] }, 'kayas')).toContain(
    'by Wednesday 4 November 08:00.',
  );
});

it('immediate evidence states the speaker and Nermin’s uncertain reading without changing the raw note', () => {
  const state = newGame(1);
  apply(state, { type: 'interview', candidate: 'sevda' });
  apply(state, { type: 'choose', scene: view(state).scene!.id, choice: 'q-patient' });
  const notes = view(state).scene!.added!;
  const original = structuredClone(notes);
  expect(addedEvidence(notes)).toContain(`${notes[0]!.from} said this`);
  expect(addedEvidence(notes)).toContain(notes[0]!.phrase);
  expect(notes).toEqual(original);
});

it('names the actual afternoon placement agreement time without claiming a meal or witnessed work', async () => {
  const { placementTiming } = await import('../src/ui/render.ts');
  expect(placementTiming({ since: 15 * 60 + 38 })).toBe('Placement agreed Monday 2 November at 15:38.');
});

it('keeps an applicant wage private until the applicant says it', () => {
  const state = newGame(1);
  const wage = () => [...view(state).bench, ...view(state).books].find((c) => c.id === 'pinar')!.wage;
  expect(wage()).toBeNull();
  apply(state, { type: 'place', candidate: 'pinar', family: 'arslans', vouch: [] });
  const scene = view(state).scene!;
  const terms = { wage: 9000, startHour: 8, endHour: 16, dayOff: 6, trialDays: 7, fee: 9000 };
  const checkReplayAndNextOffer = () => {
    const full = exportRun(state, state.inputs);
    const next = { type: 'propose-terms', scene: scene.id, terms: { ...terms, wage: 8500 } } as const;
    expect(view(state).scene?.kind).toBe('negotiation');
    expect(view(state).scene?.negotiation).toBeDefined();
    for (const file of [full, compactRun(full)]) {
      const restored = verifyImport(JSON.stringify(file), { requireFull: file === full }).state;
      expect(fingerprint(restored)).toBe(fingerprint(state));
      expect(restored).toEqual(state);
      expect(restored.cards).toEqual(state.cards);
      expect(restored.hf4).toEqual(state.hf4);
      expect(view(restored)).toEqual(view(state));

      const live = structuredClone(state);
      apply(live, next);
      apply(restored, next);
      expect(fingerprint(restored)).toBe(fingerprint(live));
      expect(restored).toEqual(live);
      expect(restored.cards).toEqual(live.cards);
      expect(restored.hf4).toEqual(live.hf4);
      expect(view(restored)).toEqual(view(live));
      expect(view(live).scene?.negotiation?.terms).toEqual(next.terms);
    }
  };
  apply(state, { type: 'propose-terms', scene: scene.id, terms });
  expect(view(state).scene!.negotiation!.worker).toBe('accepted');
  expect(wage()).toBeNull();
  checkReplayAndNextOffer();
  apply(state, { type: 'propose-terms', scene: scene.id, terms: { ...terms, wage: 7500 } });
  expect(view(state).scene!.lines.at(-2)!.text).toContain('I need ₺8500 a month');
  expect(wage()).toBe(8500);
  checkReplayAndNextOffer();
  apply(state, { type: 'propose-terms', scene: scene.id, terms });
  expect(wage()).toBe(8500);

  const interviewed = newGame(1);
  apply(interviewed, { type: 'interview', candidate: 'pinar' });
  apply(interviewed, { type: 'choose', scene: view(interviewed).scene!.id, choice: 'wage' });
  const interviewedCard = [...view(interviewed).bench, ...view(interviewed).books].find(
    (c) => c.id === 'pinar',
  )!;
  expect(interviewedCard.wage).toBe(8500);
});
