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
    await expect(queueFeedback(input)).resolves.toBe('queued');
    expect(lab.sendFeedback).toHaveBeenCalledWith('Verdict: mixed\n\nA note', {
      name: 'Tester',
      run: input.getRun(),
    });
    expect(lab.sendRun).not.toHaveBeenCalled();
  });
  it('queues a note when recording is off', async () => {
    const { lab, input } = setup();
    await expect(queueFeedback({ ...input, off: true, consent: true })).resolves.toBe('queued');
    expect(lab.sendFeedback).toHaveBeenCalled();
    expect(lab.sendRun).not.toHaveBeenCalled();
  });
  it('queues a note without privacy-run consent', async () => {
    const { lab, input } = setup(true);
    await expect(queueFeedback(input)).resolves.toBe('queued');
    expect(lab.sendFeedback).toHaveBeenCalled();
    expect(lab.sendRun).not.toHaveBeenCalled();
  });
  it('sends an explicitly consented privacy run on this page', async () => {
    const { lab, input } = setup(true);
    await queueFeedback({ ...input, consent: true });
    expect(lab.sendRun).toHaveBeenCalledWith(input.getRun(), {
      note: 'Verdict: mixed\n\nA note',
      name: 'Tester',
    });
  });
  it('leaves failure on this page instead of opening a second dialog', async () => {
    const { lab, input } = setup(true);
    vi.mocked(lab.sendRun).mockRejectedValueOnce(new Error('failed'));
    await expect(queueFeedback({ ...input, consent: true })).rejects.toThrow('failed');
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
