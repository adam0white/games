/** File play keeps native recording and pending uploads untouched. */
import { createLab, type Lab } from '@adam0white/lab-client';

export const fileMode = globalThis.location?.pathname === '/warren/file/';
const unavailable = async (): Promise<never> => {
  throw new Error('Feedback is unavailable while viewing a saved file.');
};
const fileLab = {
  game: 'warren',
  endpoint: '',
  telemetryOn: false,
  personaRecordingAllowed: false,
  personaRecordingRequired: false,
  privacySignalOn: false,
  privacyOverride: false,
  playerId: null,
  screen() {},
  milestone() {},
  captureSave() {},
  setPrivacyOverride() {},
  setTelemetryOff() {},
  setPersonaRecording() {},
  allowPersonaRecording() {},
  log() {},
  openSendDialog() {},
  trackRun: () => () => {},
  sendFeedback: unavailable,
  sendRun: unavailable,
  sendEnvelopeText: unavailable,
  build: () => ({}),
} as unknown as Lab;
export const lab: Lab = fileMode ? fileLab : createLab({ game: 'warren' });
