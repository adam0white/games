import type { Lab } from '@adam0white/lab-client';
import { describe, expect, it, vi } from 'vitest';
import { queueFeedback } from '../src/ui/feedback';

function setup(privacySignalOn = false) {
  const lab = {
    privacySignalOn,
    privacyOverride: false,
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
    expect(lab.sendFeedback).toHaveBeenCalledWith('Verdict: mixed\n\nA note', { name: 'Tester' });
    expect(lab.sendRun).not.toHaveBeenCalled();
  });
  it('refuses every send when the player switched recording off', async () => {
    const { lab, input } = setup();
    await expect(queueFeedback({ ...input, off: true, consent: true })).rejects.toThrow('off');
    expect(lab.sendFeedback).not.toHaveBeenCalled();
    expect(lab.sendRun).not.toHaveBeenCalled();
  });
  it('requires separate consent under a privacy signal and sends an unlinked run', async () => {
    const { lab, input } = setup(true);
    await expect(queueFeedback(input)).rejects.toThrow('Consent');
    await queueFeedback({ ...input, consent: true });
    expect(lab.sendRun).toHaveBeenCalledWith(input.getRun(), {
      note: 'Verdict: mixed\n\nA note',
      name: 'Tester',
    });
    expect(lab.sendFeedback).not.toHaveBeenCalled();
  });
  it('preserves the note and name in the fallback dialog', async () => {
    const { lab, input } = setup(true);
    vi.mocked(lab.sendRun).mockRejectedValueOnce(new Error('failed'));
    await expect(queueFeedback({ ...input, consent: true })).resolves.toBe('dialog');
    expect(lab.openSendDialog).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'Verdict: mixed\n\nA note', name: 'Tester' }),
    );
  });
});
