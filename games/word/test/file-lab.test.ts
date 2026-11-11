import { beforeEach, expect, it, vi } from 'vitest';
import { fileLab } from '../src/file-lab';

const mock = vi.hoisted(() => {
  const stop = vi.fn();
  const client = {
    preservationStatus: 'existing-local',
    telemetryOn: true,
    setPersonaRecording: vi.fn(),
    allowPersonaRecording: vi.fn(),
    setTelemetryOff: vi.fn(),
    setEventsOff: vi.fn(),
    trackRun: vi.fn(() => stop),
    dispose: vi.fn(),
    sendFeedback: vi.fn(async () => 'receipt'),
  };
  return { client, stop, create: vi.fn(() => client), dialog: vi.fn() };
});
vi.mock('@adam0white/lab-client', () => ({
  createLab: mock.create,
  privacySignal: () => false,
  openSendDialog: mock.dialog,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.client.preservationStatus = 'existing-local';
});

it('keeps the client idle and registers tracking only after recording is explicitly enabled', () => {
  const lab = fileLab('test');
  const getRun = () => ({ seed: 1 });
  lab.setPersonaRecording('file');
  lab.allowPersonaRecording(true);
  const cancel = lab.trackRun(getRun);
  lab.screen('file');
  expect(mock.create).not.toHaveBeenCalled();
  lab.setTelemetryOff(false);
  expect(mock.create).toHaveBeenCalledWith({ game: 'test', preservation: 'preserve', deferRecording: true });
  expect(mock.client.setPersonaRecording).toHaveBeenCalledWith('file');
  expect(mock.client.allowPersonaRecording).toHaveBeenCalledWith(true);
  expect(mock.client.trackRun).toHaveBeenCalledWith(getRun, undefined);
  cancel();
  expect(mock.stop).toHaveBeenCalledOnce();
});

it('does not attach cancelled tracks or resurrect a disposed session', () => {
  const lab = fileLab('test');
  lab.trackRun(() => ({}))();
  lab.setTelemetryOff(false);
  expect(mock.client.trackRun).not.toHaveBeenCalled();
  lab.dispose();
  lab.setTelemetryOff(false);
  lab.setTelemetryOff(true);
  lab.setEventsOff(true);
  lab.setPersonaRecording('late');
  lab.allowPersonaRecording(false);
  expect(mock.client.setTelemetryOff).toHaveBeenCalledTimes(1);
  expect(mock.client.setEventsOff).not.toHaveBeenCalled();
  expect(mock.client.setPersonaRecording).not.toHaveBeenCalledWith('late');
  expect(mock.create).toHaveBeenCalledOnce();
});

it('does not start tracking when preserving the identity fails', () => {
  mock.client.preservationStatus = 'identity-mismatch';
  const lab = fileLab('test');
  lab.trackRun(() => ({}));
  lab.setTelemetryOff(false);
  expect(lab.telemetryOn).toBe(false);
  expect(mock.client.setTelemetryOff).not.toHaveBeenCalled();
  expect(mock.client.trackRun).not.toHaveBeenCalled();
});

it('keeps draft and unshared feedback idle and activates deferred tracking for Share play', async () => {
  const lab = fileLab('test');
  const getRun = () => ({ seed: 1 });
  lab.trackRun(getRun);
  lab.openSendDialog({ getRun });
  expect(mock.create).not.toHaveBeenCalled();
  expect(mock.dialog).toHaveBeenCalledWith(expect.objectContaining({ lab }));
  await lab.sendFeedback('note', { run: getRun(), sharePlay: false });
  expect(mock.client.trackRun).not.toHaveBeenCalled();
  expect(mock.client.setTelemetryOff).not.toHaveBeenCalled();
  await lab.sendFeedback('note', { run: getRun(), sharePlay: true });
  expect(mock.client.trackRun).toHaveBeenCalledWith(getRun, undefined);
});

it('attaches deferred tracking when the events switch is explicitly enabled', () => {
  const lab = fileLab('test');
  const getRun = () => ({ seed: 2 });
  lab.trackRun(getRun);
  lab.setEventsOff(false);
  expect(mock.client.setEventsOff).toHaveBeenCalledWith(false);
  expect(mock.client.trackRun).toHaveBeenCalledWith(getRun, undefined);
});
