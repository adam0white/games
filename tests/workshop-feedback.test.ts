import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import type { Command } from '../src/game/types';
import {
  actionAccount as account,
  componentWorkReading,
  latestRecoveryAccount as latestRecovery,
  ownerPromiseAccount,
} from '../src/ui/workshop-feedback';

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture value');
  return value;
}

describe('observed workshop feedback', () => {
  it('shows only performed work and does not claim a cleaned contact fixes a worn switch', () => {
    let state = createGame(42);
    const id = present(state.jobs[0]).id;
    expect(componentWorkReading(present(state.jobs[0]), 'contact')).toBeUndefined();
    state = dispatch(state, {
      type: 'work',
      jobId: id,
      componentId: 'contact',
      intervention: 'clean',
    }).state;
    expect(componentWorkReading(present(state.jobs[0]), 'contact')?.kind).toBe('clean');
    expect(componentWorkReading(present(state.jobs[0]), 'contact')?.text).toContain('cleaned');
    state = dispatch(state, { type: 'verify', jobId: id, condition: 'movement' }).state;
    expect(present(state.jobs[0]).verified).not.toContain('movement');
    expect(componentWorkReading(present(state.jobs[0]), 'switch')).toBeUndefined();
    state = dispatch(state, {
      type: 'work',
      jobId: id,
      componentId: 'switch',
      intervention: 'replace',
    }).state;
    expect(componentWorkReading(present(state.jobs[0]), 'switch')?.kind).toBe('replace');
    expect(componentWorkReading(present(state.jobs[0]), 'switch')?.text).toContain(
      'replacement switch',
    );
    expect(present(state.jobs[0]).verified).toEqual([]);
    expect(componentWorkReading(present(loadGame(saveGame(state)).jobs[0]), 'switch')).toEqual(
      componentWorkReading(present(state.jobs[0]), 'switch'),
    );
  });

  it('distinguishes an honest late return from an outstanding overdue object without erasing missed time', () => {
    let state = createGame(416);
    const job = present(state.jobs[0]);
    state = dispatch(state, { type: 'next-day' }).state;
    state = dispatch(state, { type: 'next-day' }).state;
    const neglected = ownerPromiseAccount(present(state.people[job.ownerId]), state.jobs);
    expect(neglected).toContain('still waiting');
    const late = dispatch(state, { type: 'deliver', jobId: job.id, unfinished: true });
    expect(late.ok).toBe(true);
    const account = ownerPromiseAccount(present(late.state.people[job.ownerId]), late.state.jobs);
    expect(account).toContain('honestly unfinished');
    expect(account).toContain('after the promised time');
    expect(account).not.toBe(neglected);
    expect(account).not.toContain('still waiting');
    expect(
      ownerPromiseAccount(
        present(loadGame(saveGame(late.state)).people[job.ownerId]),
        late.state.jobs,
      ),
    ).toBe(account);
  });
});

// These controls use actual public commands; the account must not alter their saved outcomes.
describe('money and parts action accounts', () => {
  it('explains the actual fee only after earned paid work and preserves the morning message', () => {
    let state = createGame(42);
    const run = (command: Command) => {
      const prior = state;
      const result = dispatch(prior, command);
      expect(result.ok, result.message).toBe(true);
      const before = saveGame(prior);
      const raw = saveGame(result.state);
      const text = account(prior, command, result);
      expect(saveGame(result.state)).toBe(raw);
      expect(saveGame(prior)).toBe(before);
      expect(saveGame(dispatch(loadGame(before), command).state)).toBe(raw);
      state = result.state;
      return text;
    };
    const family = state.selectedJobId;
    run({ type: 'work', jobId: family, componentId: 'switch', intervention: 'replace' });
    run({ type: 'verify', jobId: family, condition: 'movement' });
    run({ type: 'deliver', jobId: family });
    const fan = present(
      state.jobs.find((job) => job.model.kind === 'fan' && job.status === 'offer'),
    );
    run({ type: 'accept', jobId: fan.id });
    run({ type: 'work', jobId: fan.id, componentId: 'cell', intervention: 'replace' });
    run({ type: 'verify', jobId: fan.id, condition: 'load' });
    run({ type: 'deliver', jobId: fan.id });
    expect(state.jobs.find((job) => job.id === fan.id)?.status).toBe('delivered');
    const beforeDay2 = state.cash;
    expect(run({ type: 'next-day' })).toContain('No workshop cost was taken');
    expect(state.cash).toBe(beforeDay2);
    const cash = state.cash;
    const text = run({ type: 'next-day' });
    expect(state.cash).toBe(cash - 4);
    expect(text).toContain('£4 covers supplies and shared workshop costs');
    expect(text).toContain(`Cash £${cash} → £${cash - 4}`);
    expect(text).toContain('A new workshop morning has begun');
    // Legal supplier trips leave £2; the existing cost must take two, not invent four.
    for (let i = 0; i < 4; i++) run({ type: 'buy', part: 'gear' });
    run({ type: 'buy', part: 'motor' });
    expect(state.cash).toBe(2);
    expect(run({ type: 'next-day' })).toContain('£2 covers supplies and shared workshop costs');
    expect(state.cash).toBe(0);
    expect(run({ type: 'next-day' })).toContain('£0 covers supplies and shared workshop costs');
    expect(state.cash).toBe(0);
  });

  it('reports unusable donor cells, working contacts and actual replacement consumption without changing state', () => {
    let state = createGame(42);
    const donor = present(state.jobs.find((job) => job.isDonor));
    const perform = (command: Command) => {
      const prior = state;
      const before = saveGame(prior);
      const direct = dispatch(prior, command);
      const expected = saveGame(direct.state);
      const text = account(prior, command, direct);
      expect(saveGame(prior)).toBe(before);
      expect(saveGame(direct.state)).toBe(expected);
      expect(saveGame(dispatch(loadGame(before), command).state)).toBe(expected);
      state = direct.state;
      return { text, result: direct };
    };
    const cells = state.stock.cell;
    const failedYield = perform({ type: 'salvage', jobId: donor.id, componentId: 'cell' });
    expect(failedYield.result.ok).toBe(true);
    expect(state.stock.cell).toBe(cells);
    expect(failedYield.text).toContain('recovered cell is not usable');
    expect(failedYield.text).toContain(`Drawer cell: ${cells} → ${cells}`);
    const repeated = perform({ type: 'salvage', jobId: donor.id, componentId: 'cell' });
    expect(repeated.result.ok).toBe(false);
    expect(repeated.text).toBe(repeated.result.message);
    const contacts = state.stock.contact ?? 0;
    const good = perform({ type: 'salvage', jobId: donor.id, componentId: 'contact' });
    expect(state.stock.contact).toBe(contacts + 1);
    expect(good.text).toContain(`Drawer contact: ${contacts} → ${contacts + 1}`);
    expect(latestRecovery(state)).toContain('one working contact');
    const fitted = perform({
      type: 'work',
      jobId: state.selectedJobId,
      componentId: 'contact',
      intervention: 'replace',
    });
    expect(fitted.result.ok).toBe(true);
    expect(state.stock.contact).toBe(contacts);
    expect(fitted.text).toContain(`Drawer contact: ${contacts + 1} → ${contacts}`);
    expect(latestRecovery(state)).toContain('one working contact');
    const noPart = perform({
      type: 'work',
      jobId: state.selectedJobId,
      componentId: 'contact',
      intervention: 'replace',
    });
    expect(noPart.result.ok).toBe(false);
    expect(noPart.text).toBe(noPart.result.message);
    expect(noPart.text).not.toContain('Drawer contact:');
  });
});
