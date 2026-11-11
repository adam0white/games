import { createHash } from 'node:crypto';
import { canonicalPersona } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import * as game from '../src/sim/game.ts';

it('refuses older saves and starts with a plain start-fresh message', () => {
  for (const version of ['0.9.0', '0.9.1', '0.9.2', '0.6.1']) {
    expect(() => game.newGame(17, version)).toThrow(/older rules.*[Ss]tart a new week/);
    expect(() => game.restoreState({ version } as never)).toThrow(/older rules.*[Ss]tart a new week/);
    expect(() => game.replay(17, [], undefined, version)).toThrow(/older rules.*[Ss]tart a new week/);
  }
});

it('starts the new HF4 edition', () => {
  const state = game.newGame(17);
  expect(state.version).toBe('0.10.0');
  expect(state.hf.run).toBeDefined();
});

it('plays the first card through the new game host', () => {
  const state = game.newGame(17);
  game.runToCard(state);
  const card = game.cardView(state);
  expect(card).not.toBeNull();
  const option = card?.options[0];
  if (!option) throw new Error('Missing opening option');
  game.queueInput(state, { kind: 'say', option: option.id });
  game.runToCard(state);
  expect(state.inputs.length).toBeGreaterThan(0);
});

it('renders the new edition journal after an actual choice', async () => {
  const { momentRecords } = await import('../src/ui/journal.ts');
  const { replyWords } = await import('../src/ui/reply.ts');
  const state = game.newGame(17);
  game.runToCard(state);
  const option = game.cardView(state)?.options[0];
  if (!option) throw new Error('Missing opening option');
  game.queueInput(state, { kind: 'say', option: option.id });
  expect(momentRecords(state).length).toBe(1);
  if (state.answer) expect(typeof replyWords(state, state.answer)).toBe('string');
});

it('previews the offered choice through HF without changing any full state value', () => {
  const state = game.newGame(17);
  game.runToCard(state);
  const before = game.fingerprint(state);
  const view = game.cardView(state)!;
  expect(view.options.every((o) => o.lean !== 'unknown' && o.pushed !== 'unknown')).toBe(true);
  expect(game.fingerprint(state)).toBe(before);
});

it('previews low-trust insistence with the same suggestion that holding submits', () => {
  const state = game.newGame(17);
  for (let card = 0; card < 4; card++) {
    game.runToCard(state);
    const view = game.cardView(state)!;
    const option = view.options.find((choice) => !choice.isPull) ?? view.options[0]!;
    game.queueInput(state, { kind: 'say', option: option.id, insist: true });
  }
  game.runToCard(state);
  expect(game.insistCarries(state)).toBe(false);
  const before = game.fingerprint(state);
  const view = game.cardView(state)!;
  const readings = {
    assented: 'yes',
    complied: 'if pushed',
    deferred: 'later',
    modified: 'rather not',
    refused: 'no',
    commanded: 'no',
  };
  for (const option of view.options) {
    const held = game.restoreState(game.cloneState(state));
    game.queueInput(held, { kind: 'say', option: option.id, insist: true });
    expect(option.pushed).toBe(readings[held.answer!.verdict!]);
  }
  expect(game.fingerprint(state)).toBe(before);
}, 60_000);

it('pins the current complete replay hash and cold continuation', () => {
  const state = game.newGame(17);
  game.runToCard(state);
  game.queueInput(state, { kind: 'say', option: 'up' });
  game.runToCard(state);
  const raw = game.cloneState(state);
  // Pin the current HF 4.17.0 complete representation, first excluding only castAdmission.
  const { castAdmission, ...priorRepresentation } = raw;
  expect(castAdmission).toEqual({ kind: 'local' });
  expect(createHash('sha256').update(canonicalPersona(priorRepresentation)).digest('hex')).toBe(
    'c29893c29d0889ca1e642191a87ac760f084057c007b049867225cfb83a88f88',
  );
  expect(createHash('sha256').update(canonicalPersona(raw)).digest('hex')).toBe(
    '21d07c26bbc6e2c529fc03e471389e5f7251ce66b10f1b4dcffb56db32ef9b12',
  );
  const cold = game.restoreState(raw);
  const rebuilt = game.replay(state.seed, state.inputs, state.minute, state.version);
  expect(game.cloneState(rebuilt)).toEqual(raw);
  game.step(state);
  game.step(cold);
  game.step(rebuilt);
  expect(game.cloneState(cold)).toEqual(game.cloneState(state));
  expect(game.cloneState(rebuilt)).toEqual(game.cloneState(state));
});
