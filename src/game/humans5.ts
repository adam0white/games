/** Released HF owns shared-time relationship updates and Mum's decision. The host
 * supplies two ordinary opportunities, not a learned repair policy. */
import { type Affordance, begin, decide, finish, type Person, tick } from '@repair/hf-engine5';

export function shareTea(player: Person, mum: Person, until: number): boolean {
  const offer: Affordance = {
    id: 'tea-together',
    action: 'talk',
    label: 'Sit together over tea',
    duration: until - mum.now,
    effort: 0,
    focus: 0.05,
    with: [player.id],
    tags: ['social', 'leisure'],
    advertises: { belonging: 0.15, leisure: 0.1 },
  };
  const decision = decide(mum, [offer]);
  if (decision.chosenAffordanceId !== offer.id || !begin(mum, offer, decision)) {
    liveOrdinaryTime(mum, until);
    const alone: Affordance = {
      id: 'quiet-break',
      action: 'rest',
      label: 'Sit quietly for a while',
      duration: until - player.now,
      effort: 0,
      focus: 0,
      advertises: { leisure: 0.1 },
    };
    const chosen = decide(player, [alone]);
    if (chosen.chosenAffordanceId === alone.id && begin(player, alone, chosen)) {
      tick(player, until);
      finish(player, {
        affordanceId: alone.id,
        action: alone.action,
        at: until,
        status: 'completed',
        summary: alone.label,
        needs: alone.advertises,
      });
    } else tick(player, until);
    return false;
  }
  for (const [person, other] of [
    [player, mum],
    [mum, player],
  ] as const) {
    const shared = { ...offer, with: [other.id], duration: until - person.now };
    if (person === player) begin(person, shared, decide(person, [shared]));
    tick(person, until);
    finish(person, {
      affordanceId: offer.id,
      action: offer.action,
      at: until,
      status: 'completed',
      summary: offer.label,
      needs: offer.advertises,
    });
  }
  return true;
}
export function askMumToHelp(mum: Person): boolean {
  const help: Affordance = {
    id: 'hold-light',
    action: 'help',
    label: 'Hold the light for a careful movement check',
    duration: 8,
    effort: 0.05,
    focus: 0.1,
    with: ['player'],
    tags: ['social', 'help'],
    advertises: { competence: 0.02 },
  };
  const read: Affordance = {
    id: 'read-chapter',
    action: 'read',
    label: 'Return to my chapter',
    duration: 8,
    effort: 0,
    focus: 0,
    advertises: { leisure: 0.12 },
  };
  const decision = decide(mum, [help, read]);
  const chosen = [help, read].find((offer) => offer.id === decision.chosenAffordanceId);
  if (!chosen) {
    tick(mum, mum.now + 8);
    return false;
  }
  const started = begin(mum, chosen, decision);
  if (!started) {
    tick(mum, mum.now + 8);
    return false;
  }
  tick(mum, mum.now + 8);
  finish(mum, {
    affordanceId: chosen.id,
    action: chosen.action,
    at: mum.now,
    status: 'completed',
    summary: chosen.label,
    needs: chosen.advertises,
  });
  return chosen.id === help.id;
}

/** Host schedules describe where opportunities exist. HF chooses ordinary activities
 * and owns their bodily, motivational and relationship consequences. */
export function liveOrdinaryTime(person: Person, until: number, _atHome = true): string {
  let label = person.activity?.affordance.label ?? 'Taking a quiet break';
  while (person.now < until) {
    if (!person.body.alive) {
      tick(person, until);
      return 'Unavailable';
    }
    let current = person.activity;
    if (!current) {
      const duration = 30;
      const night = person.now % 1440 >= 22 * 60 || person.now % 1440 < 7 * 60;
      const offers: Affordance[] = [
        {
          id: 'ordinary-rest',
          action: 'rest',
          label: 'Taking a quiet break',
          duration,
          effort: 0,
          focus: 0,
          advertises: { leisure: 0.08 },
        },
        {
          id: 'ordinary-meal',
          action: 'eat',
          label: 'Having something to eat and drink',
          duration,
          effort: 0,
          focus: 0,
          advertises: { food: 0.2, water: 0.2 },
        },
        {
          id: 'ordinary-project',
          action: 'work',
          label:
            person.id === 'mum'
              ? 'Reading a chapter'
              : person.id === 'dad'
                ? 'Sorting his own tools'
                : 'Getting things ready at home',
          duration,
          effort: 0.04,
          focus: 0.1,
          advertises: { competence: 0.04, leisure: 0.04 },
        },
      ];
      if (night)
        offers.push({
          id: 'ordinary-sleep',
          action: 'sleep',
          label: 'Resting for the night',
          duration,
          effort: 0,
          focus: 0,
          mode: 'sleep',
          advertises: { sleep: 0.3 },
        });
      const decision = decide(person, offers);
      const chosen = offers.find((offer) => offer.id === decision.chosenAffordanceId);
      if (!chosen) {
        tick(person, until);
        return 'Not ready to do anything right now';
      }
      current = begin(person, chosen, decision);
      if (!current) {
        tick(person, until);
        return 'Not ready to do anything right now';
      }
    }
    const end = Math.min(until, current.endsAt);
    label = current.affordance.label;
    tick(person, end);
    if (end >= current.endsAt && person.activity)
      finish(person, {
        affordanceId: current.affordanceId,
        action: current.action,
        at: end,
        status: 'completed',
        summary: label,
        needs: current.affordance.advertises,
      });
  }
  return label;
}

export function chooseUncheckedReturn(person: Person, playerId = 'player'): boolean {
  const prior = person.activity;
  if (prior)
    finish(person, {
      affordanceId: prior.affordanceId,
      action: prior.action,
      at: person.now,
      status: 'interrupted',
      summary: 'Paused my own activity to discuss the returned light.',
    });
  const offers: Affordance[] = [
    {
      id: 'take-unchecked',
      action: 'accept',
      label: 'Take the light home with the uncertainty explained',
      duration: 1,
      effort: 0,
      with: [playerId],
      advertises: { autonomy: 0.1, belonging: 0.03 },
    },
    {
      id: 'request-long-check',
      action: 'ask',
      label: 'Ask for the longer check before relying on the light',
      duration: 1,
      effort: 0,
      with: [playerId],
      advertises: { safety: 0.15, competence: 0.05 },
    },
  ];
  const decision = decide(person, offers);
  const chosen = offers.find((offer) => offer.id === decision.chosenAffordanceId);
  if (!chosen || !begin(person, chosen, decision)) return false;
  finish(person, {
    affordanceId: chosen.id,
    action: chosen.action,
    at: person.now,
    status: 'completed',
    summary: chosen.label,
    needs: chosen.advertises,
  });
  return chosen.id === 'request-long-check';
}
export function chooseSamVisit(person: Person): boolean | null {
  const offers: Affordance[] = [
    {
      id: 'watch-repair',
      action: 'learn',
      label: 'Stay and watch how the repair is checked',
      duration: 30,
      effort: 0.02,
      focus: 0.2,
      with: ['player'],
      advertises: { competence: 0.06, belonging: 0.06 },
    },
    {
      id: 'walk-dog',
      action: 'walk',
      label: 'Keep the ordinary afternoon dog walk',
      duration: 50,
      effort: 0.06,
      advertises: { leisure: 0.2, autonomy: 0.1 },
    },
  ];
  const decision = decide(person, offers);
  const chosen = offers.find((offer) => offer.id === decision.chosenAffordanceId);
  if (!chosen || !begin(person, chosen, decision)) return null;
  return chosen.id === 'watch-repair';
}
