import type { Lab } from '@adam0white/lab-client';
import { describe, expect, it, vi } from 'vitest';
import { queueFeedback } from '../src/ui/feedback';

function setup(privacySignalOn = false) {
  const lab = {
    privacySignalOn,
    privacyOverride: false,
    personaRecordingAllowed: true,
    telemetryOn: !privacySignalOn,
    sendFeedback: vi.fn().mockResolvedValue('queue-ref'),
    sendRun: vi.fn().mockResolvedValue('queue-ref'),
    openSendDialog: vi.fn(),
  } as unknown as Lab;
  const input = {
    lab,
    getRun: () => ({ seed: 42, inputs: [] }),
    note: '  A note  ',
    verdict: 'mixed',
    name: '  Tester  ',
    consent: false,
    off: false,
  };
  return { lab, input };
}
describe('Send word consent and names', () => {
  it('queues linked feedback with the trimmed name and optional verdict', async () => {
    const { lab, input } = setup();
    await expect(queueFeedback(input)).resolves.toContain('queued');
    expect(lab.sendFeedback).toHaveBeenCalledWith('Verdict: mixed\n\nA note', {
      name: 'Tester',
      run: input.getRun(),
    });
    expect(lab.sendRun).not.toHaveBeenCalled();
  });
  it('queues a note when automatic recording is unavailable', async () => {
    const { lab, input } = setup(true);
    await expect(queueFeedback(input)).resolves.toContain('queued');
    expect(lab.sendFeedback).toHaveBeenCalled();
    expect(lab.sendRun).not.toHaveBeenCalled();
  });
  it('includes the unlinked run when carried-history linkage is closed and recording is on', async () => {
    const { lab, input } = setup();
    Object.defineProperty(lab, 'personaRecordingAllowed', { value: false });
    const getRun = vi.fn(() => ({ carried: 'private source history' }));
    await expect(queueFeedback({ ...input, getRun })).resolves.toContain('queued');
    expect(getRun).toHaveBeenCalledOnce();
    expect(lab.sendFeedback).toHaveBeenCalledWith('Verdict: mixed\n\nA note', {
      name: 'Tester',
      run: { carried: 'private source history' },
    });
  });
  it('leaves a send failure on this page', async () => {
    const { lab, input } = setup();
    vi.mocked(lab.sendFeedback).mockRejectedValueOnce(new Error('failed'));
    await expect(queueFeedback(input)).rejects.toThrow('failed');
    expect(lab.openSendDialog).not.toHaveBeenCalled();
  });
  it('queues the note when the optional run export fails', async () => {
    const { lab, input } = setup();
    await queueFeedback({
      ...input,
      getRun: () => {
        throw new Error('broken export');
      },
    });
    expect(lab.sendFeedback).toHaveBeenCalledWith('Verdict: mixed\n\nA note', {
      name: 'Tester',
      run: undefined,
    });
  });
});
