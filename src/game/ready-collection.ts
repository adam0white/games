/** Safe labelled property remains in the workshop until its owner actually chooses
 * and completes a short pickup. This is not a meeting with the player, a fee,
 * an idle repair, or permission to ignore a collection promise. */
import {
  type Affordance,
  adoptGoal,
  begin,
  decide,
  finish,
  perceive,
  reviewed,
  tick,
} from '@adam0white/human-framework';
import { liveOrdinaryTime } from './humans';
import type { GameState, RepairObject } from './types';

export function leaveReady(s: GameState, item: RepairObject): void {
  const ownerId = item.owner.toLowerCase(),
    owner = s.people[ownerId];
  if (!owner || !item.verified || item.assignedTo || item.readyCollection)
    throw Error('This object cannot be left for pickup');
  item.readyCollection = {
    labelledAt: s.now,
    ownerId,
    repairCounted: item.location === 'returned',
  };
  item.location = 'shelf';
  item.awaitingCollection = true;
  item.observations.push(
    `The completed check is written on a label beside the same object, ready for ${item.owner} to collect. It remains in the workshop.`,
  );
}
export function safelyAwaitingPickup(item: RepairObject): boolean {
  return (
    !!item.readyCollection &&
    item.readyCollection.ownerId === item.owner.toLowerCase() &&
    Number.isFinite(item.readyCollection.labelledAt) &&
    item.verified &&
    item.awaitingCollection === true &&
    // Older unpublished return controls marked the held labelled object as
    // returned before collection. Its real label and outstanding custody still
    // require the same owner to choose and complete pickup.
    ['shelf', 'returned'].includes(item.location) &&
    !item.assignedTo
  );
}
export function advanceReadyCollections(
  s: GameState,
  until: number,
  here: (id: string, at: number) => boolean,
  collected: (item: RepairObject, at: number) => void,
  clockAvailable: (id: string) => boolean = () => true,
): void {
  for (const item of s.objects.filter(safelyAwaitingPickup)) {
    const kept = item.readyCollection,
      owner = kept && s.people[kept.ownerId];
    if (!kept || !owner) continue;
    // Other attended work owns its actor's clock until that work has stopped.
    if (!clockAvailable(owner.id)) continue;
    const pickupId = `pickup-ready:${item.id}`;
    const duties = (): Affordance[] =>
      owner.agenda.commitments
        .filter(
          (c) =>
            c.status === 'pending' &&
            c.kind === 'appointment' &&
            c.from <= owner.now &&
            c.until > owner.now,
        )
        .map((c) => ({
          id: `attend-${c.id}`,
          action: c.actions[0] ?? 'attend',
          label: c.label ?? 'Keep my appointment',
          duration: c.until - owner.now,
          effort: 0,
          advertises: {},
          fulfills: [c.id],
        }));
    while (owner.now < until && item.awaitingCollection) {
      if (owner.now < kept.labelledAt) {
        liveOrdinaryTime(owner, Math.min(until, kept.labelledAt));
        continue;
      }
      if (owner.activity?.affordanceId === pickupId) {
        const active = owner.activity,
          at = Math.min(until, owner.now + 1);
        tick(owner, at);
        let continued =
          here(owner.id, at) &&
          owner.body.alive &&
          !owner.body.downed &&
          !owner.body.asleep &&
          !active.interrupt &&
          owner.activity === active;
        let next: Affordance | undefined;
        let decision: ReturnType<typeof decide> | undefined;
        if (continued && at < active.endsAt) {
          const options = duties();
          decision = decide(owner, [active.affordance, ...options]);
          continued = decision.chosenAffordanceId === pickupId;
          next = options.find((o) => o.id === decision?.chosenAffordanceId);
          if (continued) reviewed(owner);
        }
        if (!continued) {
          if (owner.activity === active)
            finish(owner, {
              affordanceId: pickupId,
              action: 'collect',
              at,
              status: 'interrupted',
              summary: 'I have not collected the labelled object yet.',
            });
          if (next && decision) begin(owner, next, decision);
          delete kept.pickupStartedAt;
          delete kept.pickupEndsAt;
          continue;
        }
        if (at >= active.endsAt) {
          finish(owner, {
            affordanceId: pickupId,
            action: 'collect',
            at,
            status: 'completed',
            summary: `Read the result label and collected my ${item.title}.`,
          });
          item.location = 'returned';
          item.awaitingCollection = false;
          item.collectedAt = at;
          item.completedBy ??= 'player';
          if (!kept.repairCounted) {
            s.repairs++;
            kept.repairCounted = true;
          }
          delete kept.pickupStartedAt;
          delete kept.pickupEndsAt;
          collected(item, at);
        }
        continue;
      }
      delete kept.pickupStartedAt;
      delete kept.pickupEndsAt;
      if (!here(owner.id, owner.now)) {
        liveOrdinaryTime(owner, Math.min(until, owner.now + 1));
        continue;
      }
      if (!kept.goalId) {
        perceive(owner, [
          {
            at: owner.now,
            channel: 'saw',
            kind: 'labelled-property',
            summary: `My ${item.title} is safely labelled with its completed check, ready for me to collect.`,
            salience: 0.6,
          },
        ]);
        kept.goalId = adoptGoal(
          owner,
          {
            label: `Collect my checked ${item.title} from the labelled shelf`,
            serves: ['autonomy'],
            importance: 0.25,
            advancedBy: [],
          },
          owner.now,
        ).id;
      }
      const pickup: Affordance = {
        id: pickupId,
        action: 'collect',
        label: `Read the label and pick up my checked ${item.title}`,
        duration: 2,
        effort: 0.01,
        focus: 0.05,
        advances: [kept.goalId],
        advertises: { autonomy: 0.04 },
      };
      const options = duties(),
        choice = decide(owner, [pickup, ...options]);
      if (choice.chosenAffordanceId === pickupId) {
        if (owner.activity)
          finish(owner, {
            affordanceId: owner.activity.affordanceId,
            action: owner.activity.action,
            at: owner.now,
            status: 'interrupted',
            summary: 'Set this aside to collect my labelled property.',
          });
        if (begin(owner, pickup, choice)) {
          kept.pickupStartedAt = owner.now;
          kept.pickupEndsAt = owner.now + 2;
          continue;
        }
      }
      const next = options.find((o) => o.id === choice.chosenAffordanceId);
      if (next) begin(owner, next, choice);
      // The next ordinary boundary is a new opportunity, not a player polling ritual.
      const nextAppointment = Math.min(
        ...owner.agenda.commitments
          .filter((c) => c.status === 'pending' && c.kind === 'appointment' && c.from > owner.now)
          .map((c) => c.from),
      );
      liveOrdinaryTime(
        owner,
        Math.min(
          until,
          nextAppointment,
          Math.max(owner.now + 1, owner.activity?.endsAt ?? owner.now + 5),
        ),
      );
    }
  }
}
