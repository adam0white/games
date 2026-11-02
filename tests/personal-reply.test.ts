import { gunzipSync, gzipSync } from 'node:zlib';
import {
  exportRun,
  readRunHistory,
  replay as replayNative,
  restoreRun,
  step,
} from '@adam0white/human-framework';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PersonalReply } from '../src/components/PersonalReply';
import {
  accountParts,
  discoveredAccounts,
  rafiCustomerBlock,
  rafiCustomerReceipt,
  rafiCustomerReply,
} from '../src/game/cast-content';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { exportPersonRun, noteVoicePromise, promise } from '../src/game/hf';
import { isRecordedCommand } from '../src/game/recording';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';
import { cloneGame, native } from './hf-fixture';

function act(s: GameState, c: Command) {
  const r = dispatch(s, c);
  expect(r.ok, r.message).toBe(true);
  return r.state;
}
function heard() {
  let s = createGame(42);
  s = act(s, { type: 'request-lesson' });
  s = act(s, { type: 'start-lesson' });
  s = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
  return act(s, { type: 'ask-about-work', personId: 'sam' });
}
function reply(s: GameState, choice = 'acknowledge') {
  return {
    type: 'reply-personal',
    personId: 'sam',
    statementId: s.log.find((e) => e.text === discoveredAccounts.sam)?.id ?? 99999,
    jobId: s.selectedJobId,
    choice,
  } as Command;
}

describe('finite personal reply receipt', () => {
  // Catches accepting fabricated speech or awarding a scene outcome for acknowledgment.
  it('requires actual heard words and records literal receipt in HF without solving the account', () => {
    const fresh = createGame(42);
    const rejected = dispatch(fresh, reply(fresh));
    expect(rejected?.ok).toBe(false);
    expect(saveGame(rejected.state)).toBe(saveGame(fresh));
    const before = heard();
    expect(isRecordedCommand(reply(before))).toBe(true);
    const s = act(before, reply(before));
    expect(
      s.log.some(
        (e) =>
          e.speaker === 'You' &&
          e.text.includes('I heard you say you copied the report without checking it.'),
      ),
    ).toBe(true);
    expect(JSON.stringify(readRunHistory(exportPersonRun(s.people.sam!)))).toContain(
      'personal-reply-received',
    );
    expect(s.cash).toBe(before.cash);
    expect(s.jobs).toEqual(before.jobs);
    expect(s.now).toBe(before.now);
    expect(s.castOutcomes).toBeUndefined();
    expect(dispatch(s, reply(before)).ok).toBe(false);
    const raw = saveGame(s);
    expect(saveGame(loadGame(raw))).toBe(raw);
    for (const packet of [s, { seed: s.seed, inputs: s.inputs, provenance: s.provenance }]) {
      const full = JSON.parse(gunzipSync(gzipSync(JSON.stringify(packet))).toString());
      const replay = replayRecordedRun(full, raw);
      expect(replay.ok).toBe(true);
      if (replay.ok) {
        expect(replay.save).toBe(raw);
        expect(saveGame(act(replay.state, { type: 'wait', minutes: 7 }))).toBe(
          saveGame(act(loadGame(raw), { type: 'wait', minutes: 7 })),
        );
      }
    }
  });

  it('allows refusal or no answer and rejects wrong objects, departure and late replies', () => {
    const s = heard();
    const raw = saveGame(s);
    // Reading or leaving the account is not a recorded answer.
    expect(saveGame(loadGame(raw))).toBe(raw);
    const donor = s.jobs.find((j) => j.isDonor);
    if (!donor) throw new Error('No donor object');
    const wrong = { ...reply(s), jobId: donor.id } as Command;
    expect(dispatch(s, wrong)?.ok).toBe(false);
    const paused = act(s, { type: 'pause-chapter' });
    expect(dispatch(paused, reply(s)).ok).toBe(false);
    const late = act(s, { type: 'wait', minutes: 31 });
    expect(dispatch(late, reply(s)).ok).toBe(false);
    const declined = act(s, reply(s, 'decline'));
    expect(
      declined.log.some(
        (e) => e.speaker === 'You' && e.text.includes('I do not want to discuss this now.'),
      ),
    ).toBe(true);
    expect(declined.jobs).toEqual(s.jobs);
    expect(declined.cash).toBe(s.cash);
    expect(isRecordedCommand({ ...reply(s), choice: 'repair-everything' })).toBe(false);
    expect(isRecordedCommand({ ...reply(s), statementId: -1 })).toBe(false);
  });
  it('acknowledges Halil’s actual Nuran statement without changing his body, obligations or activity', () => {
    let s = createGame(42);
    s = act(s, { type: 'next-day' });
    s = act(s, { type: 'next-day' });
    const object = s.jobs.find((j) => j.ownerId === 'halil' && j.status === 'offer');
    if (!object) throw new Error('No Halil visit');
    s = act(s, { type: 'accept', jobId: object.id });
    s = act(s, { type: 'verify', jobId: object.id, condition: 'movement' });
    s = act(s, { type: 'ask-about-work', personId: 'halil' });
    const statement = s.log.find((e) => e.text === discoveredAccounts.halil);
    if (!statement) throw new Error('No actual Halil statement');
    const before = cloneGame(s);
    const command: Command = {
      type: 'reply-personal',
      personId: 'halil',
      statementId: statement.id,
      jobId: object.id,
      choice: 'acknowledge',
    };
    s = act(s, command);
    expect(
      s.log.some(
        (e) =>
          e.speaker === 'You' && e.text.includes('Nuran asking why you would not name a price.'),
      ),
    ).toBe(true);
    // Receiving the words consumes native milliseconds. Compare the body with the same
    // elapsed time without that observation, rather than freezing ordinary physiology.
    const baseline = restoreRun(exportPersonRun(before.people.halil!));
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) throw new Error('The matched body control did not restore.');
    const elapsed = step(baseline.value, {
      until: exportPersonRun(s.people.halil!).current.at,
      inputs: [],
    });
    expect(elapsed.ok).toBe(true);
    expect(native(s.people.halil!).body).toEqual(
      exportRun(baseline.value).current.people.halil!.body,
    );
    expect(s.people.halil?.activity).toEqual(before.people.halil?.activity);
    expect(s.people.halil?.agenda).toEqual(before.people.halil?.agenda);
    expect(s.cash).toBe(before.cash);
    expect(s.jobs).toEqual(before.jobs);
    const occupied = act(before, { type: 'wait', minutes: 5 });
    expect(dispatch(occupied, command).ok).toBe(false);
  });
  it('answers Nora after an honest unfinished return without claiming permission for a repair', () => {
    let s = act(createGame(42), { type: 'next-day' });
    const object = s.jobs.find(
      (j) => j.ownerId === 'nora' && j.kind === 'music-box' && j.status === 'offer',
    );
    if (!object) throw new Error('No keepsake request');
    s = act(s, { type: 'accept', jobId: object.id });
    s = act(s, { type: 'verify', jobId: object.id, condition: 'load' });
    s = act(s, { type: 'deliver', jobId: object.id, unfinished: true });
    s = act(s, { type: 'select', jobId: object.id });
    s = act(s, { type: 'ask-about-work', personId: 'nora' });
    const statement = s.log.find((e) => e.text === discoveredAccounts.nora);
    if (!statement) throw new Error('No actual Nora statement');
    const before = cloneGame(s);
    s = act(s, {
      type: 'reply-personal',
      personId: 'nora',
      statementId: statement.id,
      jobId: object.id,
      choice: 'acknowledge',
    });
    expect(s.jobs).toEqual(before.jobs);
    expect(s.log.some((e) => e.speaker === 'You' && e.text.includes('your brother helped'))).toBe(
      true,
    );
  });
});

function rafiAccount() {
  let s = act(createGame(42), { type: 'next-day' });
  const fan = s.jobs.find((j) => j.ownerId === 'rafi' && j.status === 'offer');
  if (!fan) throw new Error('No ordinary Rafi request');
  s = act(s, { type: 'accept', jobId: fan.id });
  s = act(s, { type: 'verify', jobId: fan.id, condition: 'load' });
  s = act(s, { type: 'ask-about-work', personId: 'rafi' });
  return s;
}
const customerFollowup: Command = { type: 'ask-about-work', personId: 'rafi' };
const rafiMarkup = (state: GameState) =>
  renderToStaticMarkup(createElement(PersonalReply, { state, personId: 'rafi', act: () => {} }));

it('offers Rafi’s real follow-up separately from acknowledgment and replays completed words exactly', () => {
  const before = rafiAccount();
  const rawBefore = saveGame(before);
  expect(rafiMarkup(before)).toContain('What will you tell the customer');
  expect(rafiMarkup(before)).not.toContain(rafiCustomerReply);
  expect(saveGame(before)).toBe(rawBefore);
  const statement = before.log.find((e) => e.text === discoveredAccounts.rafi);
  if (!statement) throw new Error('No actual account');
  let acknowledged = act(before, {
    type: 'reply-personal',
    personId: 'rafi',
    statementId: statement.id,
    jobId: before.selectedJobId,
    choice: 'acknowledge',
  });
  expect(rafiCustomerReceipt(acknowledged)).toBeUndefined();
  expect(rafiMarkup(acknowledged)).not.toContain(rafiCustomerReply);
  // Rafi is eating until 09:25; acknowledgment itself takes no workshop time.
  acknowledged = act(acknowledged, { type: 'wait', minutes: 11 });
  const after = act(acknowledged, customerFollowup);
  expect(rafiCustomerReceipt(after)?.text).toBe(rafiCustomerReply);
  expect(rafiMarkup(after)).toContain(rafiCustomerReply);
  const archive = exportPersonRun(after.people.rafi!);
  // The host trace caches only the latest background decision. Check the retained native record.
  expect(
    archive.current.events.some(
      (e) =>
        e.person === 'rafi' &&
        e.data.kind === 'decision' &&
        e.data.decision.chosenAffordanceId === 'rafi-customer-account' &&
        e.data.decision.suggestion?.verdict === 'assented',
    ),
  ).toBe(true);
  const completed = archive.current.events.filter(
    (e) =>
      e.person === 'rafi' &&
      e.data.kind === 'action-requested' &&
      e.data.request.offerId === 'rafi-customer-account' &&
      e.data.request.stage === 'finish',
  );
  expect(completed).toHaveLength(1);
  const started = archive.current.events.find(
    (e) =>
      e.person === 'rafi' &&
      e.data.kind === 'action-requested' &&
      e.data.request.offerId === 'rafi-customer-account' &&
      e.data.request.stage === 'start',
  );
  if (!started || started.data.kind !== 'action-requested') throw new Error('No native start');
  const startRequest = started.data.request;
  expect(
    archive.current.events.some(
      (e) =>
        e.data.kind === 'action-settled' &&
        e.data.requestId === startRequest.id &&
        e.data.disposition === 'accepted',
    ),
  ).toBe(true);
  const finish = completed[0];
  if (!finish || finish.data.kind !== 'action-requested') throw new Error('No native finish');
  const finishRequest = finish.data.request;
  expect(finishRequest.activityId).toBe(startRequest.activityId);
  expect(finishRequest.boundaryAt - startRequest.boundaryAt).toBe(5 * 60000);
  expect(
    archive.current.events.some(
      (e) =>
        e.data.kind === 'action-settled' &&
        e.data.requestId === finishRequest.id &&
        e.data.disposition === 'completed',
    ),
  ).toBe(true);
  expect(after.now).toBe(acknowledged.now + 5);
  // Other people may finish work during these five minutes in either arm.
  const elapsed = act(acknowledged, { type: 'wait', minutes: 5 });
  expect(after.jobs).toEqual(elapsed.jobs);
  expect(after.jobs.find((j) => j.ownerId === 'rafi')).toEqual(
    acknowledged.jobs.find((j) => j.ownerId === 'rafi'),
  );
  expect(after.cash).toBe(before.cash);
  expect(after.stock).toEqual(before.stock);
  expect(after.castOutcomes).toBeUndefined();
  expect(dispatch(after, customerFollowup).ok).toBe(false);
  const nativeReplay = replayNative(archive);
  expect(nativeReplay.ok).toBe(true);
  if (!nativeReplay.ok) throw new Error('Native replay failed');
  expect(nativeReplay.value.verified).toBe(true);
  expect(nativeReplay.value.fullHash).toBe(archive.hashes.full);
  expect(exportRun(nativeReplay.value.run).hashes.full).toBe(archive.hashes.full);
  const raw = saveGame(after);
  expect(saveGame(loadGame(raw))).toBe(raw);
  const replay = replayRecordedRun(
    { seed: after.seed, inputs: after.inputs, provenance: after.provenance },
    raw,
  );
  expect(replay.ok).toBe(true);
  if (replay.ok) {
    expect(replay.save).toBe(raw);
    expect(saveGame(act(replay.state, { type: 'wait', minutes: 7 }))).toBe(
      saveGame(act(loadGame(raw), { type: 'wait', minutes: 7 })),
    );
  }
});

it('keeps Rafi’s unknown, busy and independent choice branches without inventing an answer', () => {
  const fresh = createGame(42);
  expect(rafiCustomerBlock(fresh)).toContain('Hear Rafi');
  expect(rafiMarkup(fresh)).not.toContain('What will you tell the customer');
  const rawFresh = saveGame(fresh);
  expect(dispatch(fresh, customerFollowup).ok).toBe(false);
  expect(saveGame(fresh)).toBe(rawFresh);
  const before = act(rafiAccount(), { type: 'wait', minutes: 11 });
  const busy = cloneGame(before);
  const person = busy.people.rafi;
  if (!person) throw new Error('No Rafi');
  promise(person, {
    kind: 'promise',
    actions: ['personal'],
    from: busy.now,
    until: busy.now + 20,
    importance: 1,
    label: 'Keep my agreed appointment',
  });
  const rawBusy = saveGame(busy);
  expect(rafiCustomerBlock(busy)).toContain('unavailable');
  expect(dispatch(busy, customerFollowup).ok).toBe(false);
  expect(saveGame(busy)).toBe(rawBusy);
  expect(rafiMarkup(busy)).not.toContain(rafiCustomerReply);
  const distrust = cloneGame(before);
  const rafi = distrust.people.rafi;
  if (!rafi) throw new Error('No Rafi');
  for (let n = 0; n < 12; n++)
    noteVoicePromise(rafi, 'player', {
      kept: false,
      at: distrust.now,
      action: 'deliver',
    });
  const after = act(distrust, customerFollowup);
  const event = exportPersonRun(after.people.rafi!).current.events.findLast(
    (e) =>
      e.person === 'rafi' &&
      e.data.kind === 'decision' &&
      e.data.decision.considered.some((o) => o.affordanceId === 'rafi-customer-account'),
  );
  const decision = event?.data.kind === 'decision' ? event.data.decision : undefined;
  expect(decision).toBeDefined();
  if (
    decision?.chosenAffordanceId !== 'rafi-customer-account' ||
    decision.suggestion?.verdict !== 'assented'
  ) {
    expect(rafiCustomerReceipt(after)).toBeUndefined();
    expect(rafiMarkup(after)).not.toContain(rafiCustomerReply);
    expect(
      after.log.some((e) => e.speaker === 'Rafi' && e.text === 'I cannot talk about that now.'),
    ).toBe(true);
  }
  expect(after.jobs).toEqual(act(before, { type: 'wait', minutes: 5 }).jobs);
  expect(after.cash).toBe(before.cash);
});

it('identifies Nora’s separate handle prototype while preserving the original saved account', () => {
  const original = discoveredAccounts.nora;
  const display = accountParts(original);
  expect(display.words).toContain('her separate handle prototype');
  expect(display.words).toContain('It is not a design for the object on your bench.');
  expect(display.words).toContain('The first shape came from my older brother’s repair.');
  expect(display.limits).toContain('no user trial or reconciliation');
  expect(discoveredAccounts.nora).toBe(original);
  expect(accountParts('An unknown account.').words).toBe('An unknown account.');
});
