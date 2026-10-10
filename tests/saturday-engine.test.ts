import { createHash } from 'node:crypto';
import { begin, decide, promise } from '@adam0white/human-framework';
import { beforeAll, expect, it } from 'vitest';
import * as engine from '../src/game/engine';
import * as eighteen from '../src/game/engine18';
import { createSaturdayWindow } from '../src/game/saturday-window';
import type { GameInput, GameState } from '../src/game/types';
import owner from './fixtures/eighteen-owner-exhausted.json';
import { completePublicAction } from './support/public-attendance';

let source: string;
beforeAll(() => {
  let s = eighteen.createGame(owner.seed);
  for (const entry of owner.inputs) s = eighteen.transition(s, entry.input as GameInput);
  source = eighteen.serializeGame(s);
  expect(createHash('sha256').update(source).digest('hex')).toBe(owner.sha256);
}, 20000);
const act = (s: GameState, id: string) => engine.transition(s, { type: 'action', id });
it('an imminent outing cannot rewind the world when the player chooses to finish eating', () => {
  const s = engine.createGame(17);
  s.chapter = 'garage';
  if (!s.campaign || !s.people.player) throw Error('Missing player');
  s.campaign.graduated = true;
  s.objects = [];
  s.saturdayWindow = createSaturdayWindow();
  Object.assign(s.saturdayWindow, { stage: 'ready', display: 'objects', agreedAt: s.now + 5 });
  Object.assign(s.saturdayWindow.shelf, { checked: true, permission: true, custody: 'workshop' });
  const player = s.people.player;
  const meal = {
    id: 'meal-control',
    action: 'eat',
    label: 'Finish eating',
    duration: 30,
    effort: 0,
    advertises: { food: 1 },
  };
  begin(player, meal, decide(player, [meal]));
  expect(engine.getView(s).actions.some((a) => a.id === 'saturday-go-afternoon')).toBe(true);
  const next = act(s, 'saturday-go-afternoon');
  expect(next.now).toBe(s.now);
  expect(next.people.player?.now).toBe(next.now);
  expect(next.people.player?.activity?.affordanceId).toBe('meal-control');
  expect(next.saturdayWindow?.arrived).not.toBe(true);
  expect(next.journal?.at(-1)?.at).toBeGreaterThanOrEqual(s.now);
});
function complete(s: GameState, id: string) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const actions = engine.getView(s).actions;
    const count = s.saturdayWindow?.events.length ?? 0;
    if (actions.some((a) => a.id === id)) {
      s = act(s, id);
      if ((s.saturdayWindow?.events.length ?? 0) > count) return s;
    }
    const next = engine.getView(s).actions;
    if (id === 'saturday-go-afternoon' && next.some((a) => a.id === 'saturday-reschedule')) {
      s = act(s, 'saturday-reschedule');
      continue;
    }
    s = act(
      s,
      next.some((a) => a.id === 'wait-conversation-activity')
        ? 'wait-conversation-activity'
        : next.some((a) => a.id === 'rest')
          ? 'rest'
          : 'wait-person',
    );
  }
  throw Error(`Actual activity did not complete: ${id}`);
}
it('actual exhausted owner retrieves the retained model, repairs the shelf, attends and returns the same property', {
  timeout: 30000,
}, () => {
  let s = engine.restoreGame(source);
  s = complete(s, 'saturday-open-look');
  s = complete(s, 'saturday-agree');
  if (engine.getView(s).actions.some((a) => a.id === 'find-paper-street'))
    s = act(s, 'find-paper-street');
  if (engine.getView(s).actions.some((a) => a.id === 'saturday-fetch-model'))
    s = complete(s, 'saturday-fetch-model');
  s = complete(s, 'saturday-display-remembered-model');
  s = complete(s, 'saturday-compare-loaded');
  s = complete(s, 'saturday-look-under');
  s = complete(s, 'saturday-refit-brace');
  s = complete(s, 'saturday-check-load');
  expect(engine.getView(s).focus?.appearance).toBe('folding-shelf');
  const modelBefore = JSON.stringify({
    ...s.objects.find((o) => o.id === 'paper-street'),
    location: s.saturdayWindow?.itemOrigins?.['paper-street'] ?? 'shelf',
  });
  s = complete(s, 'saturday-go-afternoon');
  s = complete(s, 'saturday-setup');
  expect(s.objects.find((o) => o.id === 'paper-street')?.location).toBe('saturday-window');
  expect(engine.getView(s).shelf.some((o) => o.id === 'paper-street')).toBe(false);
  expect(() => engine.transition(s, { type: 'select', id: 'paper-street' })).toThrow(
    'Unknown object',
  );
  s = complete(s, 'saturday-share-sample');
  expect(s.saturdayWindow?.visitorTried).toBe(true);
  s = complete(s, 'saturday-home');
  expect(JSON.stringify(s.objects.find((o) => o.id === 'paper-street'))).toBe(modelBefore);
  expect(engine.getView(s).saturdayWindow?.scene.items.some((i) => i.id === 'paper-street')).toBe(
    true,
  );
  const learned = JSON.stringify(s.people.sam?.methods);
  s = completePublicAction(s, 'talk-sam-saturday-cloth', (next) =>
    next.unlocked.includes('story:sam-saturday-reply'),
  );
  expect(JSON.stringify(s.people.sam?.methods)).toBe(learned);
  expect(engine.getView(s).actions.some((a) => a.id.startsWith('talk-sam-saturday-'))).toBe(false);
  const saved = engine.serializeGame(s);
  expect(engine.serializeGame(engine.restoreGame(saved))).toBe(saved);
});
it('private solo owner route finishes without borrowing the shelf or needing Sam training', {
  timeout: 20000,
}, () => {
  let s = engine.restoreGame(source);
  s = complete(s, 'saturday-private');
  s = complete(s, 'saturday-setup-solo');
  s = complete(s, 'saturday-home');
  expect(s.saturdayWindow?.stage).toBe('home');
  expect(s.saturdayWindow?.shelf.permission).toBe(false);
  expect(s.saturdayWindow?.shelf.custody).toBe('nora');
  expect(s.apprentice?.completedJobIds ?? []).toEqual([]);
});

it('a private afternoon has no unheard cloth reply, and a stronger Sam duty withholds the answer without consuming it', () => {
  const s = engine.createGame(17);
  s.saturdayWindow = createSaturdayWindow();
  Object.assign(s.saturdayWindow, {
    stage: 'home',
    display: 'private',
    events: [
      { action: 'saturday-setup-solo', at: s.now - 12, minutes: 10, participants: ['player'] },
      { action: 'saturday-home', at: s.now - 2, minutes: 2, participants: ['player'] },
    ],
  });
  expect(engine.getView(s).actions.some((a) => a.id === 'talk-sam-saturday-cloth')).toBe(false);
  const sam = s.people.sam;
  if (!sam) throw Error('Sam missing');
  promise(sam, {
    kind: 'appointment',
    toId: 'self',
    actions: ['attend'],
    from: s.now,
    until: s.now + 30,
    importance: 1,
    label: 'An earlier agreed visit',
  });
  const before = s.journal?.length ?? 0;
  const n = act(s, 'talk-sam-saturday-afternoon');
  expect(n.unlocked.includes('story:sam-saturday-reply')).toBe(false);
  expect(n.journal?.slice(before).some((line) => line.text.includes('opening time'))).toBe(false);
  expect(engine.getView(n).actions.some((a) => a.id === 'talk-sam-saturday-private')).toBe(true);
  const absent = structuredClone(s);
  if (absent.world) absent.world.presence.sam = { awayUntil: s.now + 60, activity: 'Away' };
  expect(engine.getView(absent).actions.some((a) => a.id.startsWith('talk-sam-saturday-'))).toBe(
    false,
  );
});

it('an evening collection promise does not block an afternoon visit, while overlapping collection still does', () => {
  const s = engine.createGame(17);
  s.chapter = 'garage';
  if (!s.campaign || !s.people.player) throw Error('Missing player');
  s.campaign.graduated = true;
  s.objects = [];
  s.saturdayWindow = createSaturdayWindow();
  Object.assign(s.saturdayWindow, {
    stage: 'ready',
    display: 'objects',
    agreedAt: s.now,
    arrivalBy: s.now + 30,
  });
  Object.assign(s.saturdayWindow.shelf, { checked: true, permission: true, custody: 'workshop' });
  const collection = promise(s.people.player, {
    kind: 'promise',
    toId: 'nora',
    targetId: 'nora',
    actions: ['deliver:service-nora'],
    from: s.now - 60,
    until: s.now + 255,
    importance: 0.8,
    label: 'Checked collection: service-nora',
  });
  s.serviceWeek = {
    startedAt: s.now - 1440,
    route: 'regular',
    jobs: [
      {
        id: 'service-nora',
        stage: 'accepted',
        collectionAt: s.now + 240,
        collectionUntil: s.now + 255,
        fee: 500,
        samFee: 0,
        delayed: false,
      },
    ],
    checkingPlace: 'shared',
    personalSession: 'unplanned',
    part: 'unknown',
    reflection: false,
    paidHelp: false,
    introductionsArranged: false,
    donorInvited: false,
    conclusion: 'open',
  };
  const before = structuredClone(collection);
  expect(engine.getView(s).actions.some((a) => a.id === 'saturday-go-afternoon')).toBe(true);
  const conflict = structuredClone(s);
  const job = conflict.serviceWeek?.jobs[0];
  if (!job) throw Error('Missing collection');
  job.collectionAt = s.now + 60;
  // Even a generous later deadline does not erase the agreed arrival time.
  expect(engine.getView(conflict).actions.some((a) => a.id === 'saturday-go-afternoon')).toBe(
    false,
  );
  const next = act(s, 'saturday-go-afternoon');
  expect(next.saturdayWindow?.arrived).toBe(true);
  expect(next.now - s.now).toBe(10);
  expect(next.people.player?.agenda.commitments.find((c) => c.id === collection.id)).toEqual(
    before,
  );
  expect(next.serviceWeek?.jobs[0]?.stage).toBe('accepted');
  expect(next.workshop?.cash ?? 0).toBe(0);
});
