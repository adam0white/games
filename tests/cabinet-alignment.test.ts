import { promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import {
  applyCabinetStep,
  cabinetSteps,
  freshCabinetAlignment,
} from '../src/game/cabinet-alignment';
import { createGame, getView, transition } from '../src/game/engine';
import { freshWorkshop } from '../src/game/workshop';

it.each(['workshop-cabinet-paper', 'workshop-cabinet-support'] as const)(
  'retains %s evidence and makes a mistaken adjustment visibly reversible',
  (observation) => {
    const a = freshCabinetAlignment();
    expect(cabinetSteps(a)).not.toContain('workshop-cabinet-upper');
    applyCabinetStep(a, 'workshop-cabinet-try-close');
    applyCabinetStep(a, observation);
    applyCabinetStep(a, 'workshop-cabinet-lower');
    expect(applyCabinetStep(a, 'workshop-cabinet-try-close')).toContain('sooner');
    applyCabinetStep(a, 'workshop-cabinet-upper');
    expect(a.position).toBe('original');
    applyCabinetStep(a, 'workshop-cabinet-upper');
    expect(a.checked).toBe(false);
    applyCabinetStep(a, 'workshop-cabinet-check');
    expect(a.checked).toBe(true);
    expect(a.observation).toBe(observation === 'workshop-cabinet-paper' ? 'paper' : 'supported');
  },
);

function hung() {
  const s = createGame(77);
  s.chapter = 'garage';
  s.workshop = freshWorkshop();
  s.workshop.cabinet = 'hung';
  s.workshop.projectOpen = true;
  return s;
}
const act = (s: ReturnType<typeof createGame>, id: string) => transition(s, { type: 'action', id });

it('an actual shared cabinet session persists across observations and ends only after checked alignment', () => {
  let s = hung();
  s = act(s, 'workshop-cabinet-align');
  expect(s.workshop?.cabinet).toBe('hung');
  expect(getView(s).workshopCabinet?.alignment?.sessionActive).toBe(true);
  for (const id of [
    'workshop-cabinet-try-close',
    'workshop-cabinet-paper',
    'workshop-cabinet-upper',
    'workshop-cabinet-check',
  ]) {
    expect(
      getView(s).actions.some((a) => a.id === id),
      id,
    ).toBe(true);
    s = act(s, id);
  }
  expect(s.workshop?.cabinet).toBe('finished');
  expect(s.people.dad?.activity?.affordanceId).not.toBe('cabinet-align');
  expect(s.people.player?.activity?.affordanceId).not.toBe('cabinet-align');
});

it('safe departure keeps observed evidence without finishing and old finished cabinets gain no fault', () => {
  let s = hung();
  s = act(s, 'workshop-cabinet-align');
  s = act(s, 'workshop-cabinet-try-close');
  s = act(s, 'workshop-cabinet-paper');
  s = act(s, 'workshop-cabinet-leave');
  expect(s.workshop?.cabinet).toBe('hung');
  expect(s.workshop?.cabinetAlignment?.observedContact).toBe(true);
  expect(s.people.dad?.activity?.affordanceId).not.toBe('cabinet-align');
  const old = hung();
  if (!old.workshop) throw Error('Missing cabinet');
  old.workshop.cabinet = 'finished';
  expect(getView(old).workshopCabinet?.alignment).toBeUndefined();
  expect(getView(old).actions.some((a) => a.id === 'workshop-cabinet-align')).toBe(false);
});

it('losing Dad’s actual activity or presence prevents alignment and keeps earlier evidence', () => {
  let s = act(hung(), 'workshop-cabinet-align');
  s = act(s, 'workshop-cabinet-try-close');
  s = act(s, 'workshop-cabinet-paper');
  for (const absent of [false, true]) {
    const control = structuredClone(s);
    if (!control.world || !control.people.dad) throw Error('Missing actual partners');
    if (absent) {
      control.world.presence.dad = { awayUntil: control.now + 60, activity: 'Own plans' };
    } else control.people.dad.activity = null;
    expect(getView(control).workshopCabinet?.alignment?.sessionActive).toBe(false);
    expect(getView(control).actions.some((a) => a.id === 'workshop-cabinet-upper')).toBe(false);
    expect(() => act(control, 'workshop-cabinet-upper')).toThrow('not available');
    const next = control;
    expect(next.workshop?.cabinet).toBe('hung');
    expect(next.workshop?.cabinetAlignment?.position).toBe('original');
    expect(next.workshop?.cabinetAlignment?.observedContact).toBe(true);
  }
});

it('turning to other work ends the actual shared session without erasing the corner observation', () => {
  let s = act(hung(), 'workshop-cabinet-align');
  s = act(s, 'workshop-cabinet-try-close');
  s = act(s, 'workshop-cabinet-paper');
  s = act(s, 'rest');
  expect(s.people.player?.activity?.affordanceId).not.toBe('cabinet-align');
  expect(s.people.dad?.activity?.affordanceId).not.toBe('cabinet-align');
  expect(s.workshop?.cabinet).toBe('hung');
  expect(s.workshop?.cabinetAlignment?.observation).toBe('paper');
});

it.each(['workshop-cabinet-upper', 'workshop-cabinet-check'] as const)(
  'a newly due appointment interrupts %s before its physical result commits',
  (step) => {
    let s = act(hung(), 'workshop-cabinet-align');
    s = act(s, 'workshop-cabinet-try-close');
    s = act(s, 'workshop-cabinet-paper');
    if (step === 'workshop-cabinet-check') s = act(s, 'workshop-cabinet-upper');
    const dad = s.people.dad;
    if (!dad) throw Error('Missing Dad');
    const originalPosition = s.workshop?.cabinetAlignment?.position;
    const before = s.now;
    const commitment = promise(dad, {
      kind: 'appointment',
      toId: 'nora',
      actions: ['visit-nora'],
      from: before + 1,
      until: before + 3,
      importance: 1,
      label: 'Keep the promised visit to Nora',
    });
    const next = act(s, step);
    expect(next.now).toBe(before + 1);
    expect(next.workshop?.cabinetAlignment?.position).toBe(originalPosition);
    expect(next.workshop?.cabinetAlignment?.checked).toBe(false);
    expect(next.workshop?.cabinet).toBe('hung');
    expect(next.people.dad?.activity?.affordance.fulfills).toContain(commitment.id);
    expect(
      next.people.dad?.trace.some(
        (entry) => entry.chosenAffordanceId === `attend-${commitment.id}`,
      ),
    ).toBe(true);
    expect(next.people.player?.activity?.affordanceId).not.toBe('cabinet-align');
  },
);

function dueCabinet() {
  const s = hung();
  const dad = s.people.dad,
    player = s.people.player;
  if (!s.workshop || !dad || !player) throw Error('Missing cabinet partners');
  const definition = {
    kind: 'appointment' as const,
    actions: ['cabinet-align'],
    targetId: 'family-cabinet',
    from: s.now,
    until: s.now + 60,
    importance: 0.6,
    label: 'Cabinet alignment together',
  };
  const dadPromise = promise(dad, { ...definition, toId: 'player' });
  const playerPromise = promise(player, { ...definition, toId: 'dad' });
  s.workshop.cabinetAppointment = {
    task: 'align',
    at: s.now,
    until: s.now + 60,
    dadId: dadPromise.id,
    playerId: playerPromise.id,
    status: 'planned',
  };
  return s;
}
it.each(['absent', 'dad-duty', 'player-duty'] as const)(
  'a due cabinet attempt with %s clears both obligations without work credit or later blame',
  (condition) => {
    const s = dueCabinet();
    if (!s.workshop || !s.world || !s.people.dad || !s.people.player) throw Error('Missing setup');
    s.workshop.projectOpen = condition === 'dad-duty';
    if (condition === 'absent')
      s.world.presence.dad = { awayUntil: s.now + 120, activity: 'Away on his own plans' };
    else {
      const person = condition === 'dad-duty' ? s.people.dad : s.people.player;
      promise(person, {
        kind: 'appointment',
        toId: 'nora',
        actions: ['other-duty'],
        from: s.now,
        until: s.now + 15,
        importance: 1,
        label: 'Keep another promise',
      });
    }
    expect(getView(s).actions.some((a) => a.id === 'workshop-cabinet-attend')).toBe(true);
    let next = act(s, 'workshop-cabinet-attend');
    const slot = next.workshop?.cabinetAppointment;
    expect(slot?.status).toBe('cancelled');
    expect(next.workshop?.cabinet).toBe('hung');
    expect(next.workshop?.cabinetAlignment).toBeUndefined();
    expect(
      next.people.player?.agenda.commitments.find((c) => c.id === slot?.playerId)?.status,
    ).toBe('released');
    expect(next.people.dad?.agenda.commitments.find((c) => c.id === slot?.dadId)?.status).toBe(
      'released',
    );
    for (let i = 0; i < 7; i++) next = act(next, 'rest');
    expect(next.workshop?.cabinetAppointment?.status).toBe('cancelled');
    expect(
      next.conversation.some((l) => l.text.includes('Both commitments remain recorded as missed')),
    ).toBe(false);
  },
);
