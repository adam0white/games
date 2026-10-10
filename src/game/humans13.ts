/** Released HF owns shared-time relationship updates and Mum's decision. The host
 * supplies two ordinary opportunities, not a learned repair policy. */
import {
  type Affordance,
  begin,
  decide,
  finish,
  type Person,
  reviewed,
  tick,
} from '@repair/hf-engine5';
import { quietPracticeOffers } from './practices13';

export type TeaReport = {
  kind: 'joined' | 'refused' | 'shortened';
  participant?: 'player' | 'mum';
  elapsed: number;
};

/** Both people choose company; HF reviews and actual elapsed activity determine
 * completion. Declining or stopping company leaves the remaining time ordinary. */
export function shareTea(
  player: Person,
  mum: Person,
  until: number,
  onResult?: (report: TeaReport) => void,
): boolean {
  const startedAt = player.now;
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
  const playerOffer = { ...offer, with: [mum.id], duration: until - player.now };
  const choices = [
    [mum, offer, 'mum'],
    [player, playerOffer, 'player'],
  ] as const;
  const decisions = choices.map(([person, opportunity]) => decide(person, [opportunity]));
  const refusal = choices.findIndex(
    ([, opportunity], i) => decisions[i]?.chosenAffordanceId !== opportunity.id,
  );
  const ordinary = () => {
    liveOrdinaryTime(player, until);
    liveOrdinaryTime(mum, until);
  };
  if (refusal >= 0 || until <= startedAt || mum.now !== startedAt) {
    ordinary();
    onResult?.({
      kind: 'refused',
      participant: choices[refusal >= 0 ? refusal : 0]?.[2],
      elapsed: 0,
    });
    return false;
  }
  const activities = choices.map(([person, opportunity], i) => {
    const decision = decisions[i];
    if (!decision) return null;
    const prior = person.activity;
    if (prior)
      finish(person, {
        affordanceId: prior.affordanceId,
        action: prior.action,
        at: person.now,
        status: 'interrupted',
        summary: 'Set my activity aside for agreed company.',
      });
    return begin(person, opportunity, decision);
  });
  let stopped: 'player' | 'mum' | undefined = activities[0]
    ? activities[1]
      ? undefined
      : 'player'
    : 'mum';
  while (player.now < until && !stopped) {
    // Observe interruptions at minute precision, then retain the remainder as ordinary time.
    const step = Math.min(until, player.now + 1);
    for (const [person] of choices) tick(person, step);
    for (let i = 0; i < choices.length; i++) {
      const entry = choices[i];
      const activity = activities[i];
      if (!entry) continue;
      const [person, opportunity, who] = entry;
      if (
        !activity ||
        !person.body.alive ||
        person.body.downed ||
        person.activity !== activity ||
        activity.interrupt
      ) {
        stopped = who;
        break;
      }
      if (person.now < until && person.now >= activity.reviewAt) {
        const choice = decide(person, [opportunity]);
        if (choice.chosenAffordanceId !== opportunity.id) {
          stopped = who;
          break;
        }
        reviewed(person);
      }
    }
  }
  const elapsed = Math.max(0, Math.min(player.now, mum.now, until) - startedAt);
  const completed =
    !stopped && activities.every((activity) => activity && activity.endsAt <= until);
  for (let i = 0; i < choices.length; i++) {
    const entry = choices[i];
    if (!entry || entry[0].activity !== activities[i]) continue;
    const [person, opportunity] = entry;
    finish(person, {
      affordanceId: opportunity.id,
      action: opportunity.action,
      at: person.now,
      status: completed ? 'completed' : 'interrupted',
      summary: completed ? opportunity.label : 'Our time together ended early.',
      ...(completed ? { needs: opportunity.advertises } : {}),
    });
  }
  ordinary();
  onResult?.({
    kind: completed ? 'joined' : 'shortened',
    ...(stopped ? { participant: stopped } : {}),
    elapsed,
  });
  return completed;
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
export function liveOrdinaryTime(
  person: Person,
  until: number,
  atHome: boolean | ((at: number) => boolean) = true,
  onStarted?: (offer: Affordance) => void,
): string {
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
      offers.push(
        ...quietPracticeOffers(person, typeof atHome === 'function' ? atHome(person.now) : atHome),
      );
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
      onStarted?.(chosen);
    }
    const end = Math.min(until, current.endsAt);
    label = current.affordance.label;
    tick(person, end);
    if (end >= current.endsAt && person.activity)
      finish(person, {
        affordanceId: current.affordanceId,
        action: current.action,
        targetId: current.targetId,
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

/** Consent starts a real shared activity; normal HF completion owns its outcome. */
export function beginSharedWork(
  player: Person,
  partner: Person,
  offer: Affordance,
  onDeclined?: (id: string) => void,
): boolean {
  const personal: Affordance = {
    id: 'own-tools',
    action: 'work',
    label: 'Finish sorting my own tools',
    duration: 8,
    effort: 0.03,
    advertises: { competence: 0.05, autonomy: 0.04 },
  };
  const decision = decide(partner, [offer, personal]);
  if (decision.chosenAffordanceId !== offer.id) {
    onDeclined?.(partner.id);
    return false;
  }
  const playerOffer = { ...offer, with: [partner.id] };
  const playerDecision = decide(player, [playerOffer]);
  if (playerDecision.chosenAffordanceId !== playerOffer.id) {
    onDeclined?.(player.id);
    return false;
  }
  for (const person of [player, partner]) {
    const prior = person.activity;
    if (prior)
      finish(person, {
        affordanceId: prior.affordanceId,
        action: prior.action,
        at: person.now,
        status: 'interrupted',
        summary: 'Set my ordinary activity aside for agreed shared work.',
      });
  }
  return Boolean(begin(partner, offer, decision) && begin(player, playerOffer, playerDecision));
}

/** A short, optional conversation competes with the partner's own plans. */
export type ConversationRefusal = {
  participant: 'player' | 'partner';
  kind: 'declined' | 'begin-failed';
  alternativeId?: string;
  activity?: { id: string; label: string; endsAt: number };
};

export function beginSharedConversation(
  player: Person,
  partner: Person,
  id: string,
  label: string,
  duration: number,
  onRefusal?: (report: ConversationRefusal) => void,
  purpose?: {
    action: string;
    physical?: boolean;
    partnerGoals?: string[];
    playerGoals?: string[];
    alternative?: Affordance;
  },
): boolean {
  const refused = (
    person: Person,
    participant: ConversationRefusal['participant'],
    kind: ConversationRefusal['kind'],
    alternativeId?: string,
    continued = false,
  ) => {
    const activity = continued ? person.activity : undefined;
    onRefusal?.({
      participant,
      kind,
      ...(alternativeId ? { alternativeId } : {}),
      ...(activity
        ? {
            activity: {
              id: activity.affordanceId,
              label: activity.affordance.label,
              endsAt: activity.endsAt,
            },
          }
        : {}),
    });
    return false;
  };
  const offer: Affordance = {
    id,
    action: purpose?.physical ? 'work' : 'talk',
    label,
    duration,
    effort: purpose?.physical ? 0.05 : 0.02,
    focus: purpose?.physical ? 0.15 : 0.1,
    with: [player.id],
    tags: purpose?.physical
      ? ['case-work', purpose.action]
      : purpose
        ? ['social', 'case-work', purpose.action]
        : ['social', 'reflection'],
    ...(purpose?.partnerGoals?.length ? { advances: purpose.partnerGoals } : {}),
    advertises: purpose?.physical ? { competence: 0.08 } : { belonging: 0.07, leisure: 0.06 },
  };
  const own: Affordance = {
    id: 'keep-own-plans',
    action: 'rest',
    label: 'Keep my own plans for now',
    duration,
    effort: 0,
    advertises: { leisure: 0.03, autonomy: 0.02 },
  };
  const decision = decide(partner, [offer, purpose?.alternative ?? own]);
  if (decision.chosenAffordanceId !== offer.id)
    return refused(
      partner,
      'partner',
      'declined',
      purpose?.alternative && decision.chosenAffordanceId === purpose.alternative.id
        ? purpose.alternative.id
        : undefined,
      decision.chosenAffordanceId === partner.activity?.affordanceId,
    );
  const playerOffer = { ...offer, with: [partner.id], advances: purpose?.playerGoals };
  const playerDecision = decide(player, [playerOffer]);
  if (playerDecision.chosenAffordanceId !== id)
    return refused(
      player,
      'player',
      'declined',
      undefined,
      playerDecision.chosenAffordanceId === player.activity?.affordanceId,
    );
  for (const person of [player, partner]) {
    const prior = person.activity;
    if (prior)
      finish(person, {
        affordanceId: prior.affordanceId,
        action: prior.action,
        at: person.now,
        status: 'interrupted',
        summary: 'Paused my own activity for a short agreed conversation.',
      });
  }
  if (!begin(partner, offer, decision)) return refused(partner, 'partner', 'begin-failed');
  if (!begin(player, playerOffer, playerDecision)) {
    finish(partner, {
      affordanceId: id,
      action: offer.action,
      at: partner.now,
      status: 'interrupted',
      summary: 'The conversation could not begin together.',
    });
    return refused(player, 'player', 'begin-failed');
  }
  return true;
}
