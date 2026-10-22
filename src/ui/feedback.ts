import type { Lab } from '@adam0white/lab-client';

export const FEEDBACK_NAME_KEY = 'hf-lab-feedback-name';
export const LAB_PRIVACY = 'https://human.adamwhite.work/lab/privacy/';
export function storedPreference(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
export function recordingIsOff(): boolean {
  return (
    storedPreference('hf-lab-recording-off') === '1' ||
    storedPreference('hf-lab-events-off:repair') === '1'
  );
}
export function rememberFeedbackName(name: string) {
  try {
    const trimmed = name.trim().slice(0, 60);
    if (trimmed) localStorage.setItem(FEEDBACK_NAME_KEY, trimmed);
    else localStorage.removeItem(FEEDBACK_NAME_KEY);
  } catch {
    /* Device storage is optional. */
  }
}
/** A privacy signal allows only an explicitly consented, unlinked run. */
export async function queueFeedback({
  lab,
  getRun,
  note,
  verdict,
  name,
  consent,
  off,
  onSent,
}: {
  lab: Lab;
  getRun: () => unknown;
  note: string;
  verdict: string;
  name: string;
  consent: boolean;
  off: boolean;
  onSent?: () => void;
}): Promise<'queued' | 'dialog'> {
  if (off) throw new Error('Lab recording is off.');
  const privacyOnly = lab.privacySignalOn && !lab.privacyOverride;
  const message = [verdict ? `Verdict: ${verdict}` : '', note.trim()].filter(Boolean).join('\n\n');
  const cleanName = name.trim().slice(0, 60);
  if (privacyOnly) {
    if (!consent) throw new Error('Consent is required to send this run.');
    const run = getRun();
    try {
      await lab.sendRun(run, { note: message, name: cleanName });
    } catch {
      lab.openSendDialog({ getRun: () => run, note: message, name: cleanName, onSent });
      return 'dialog';
    }
  } else {
    if (!lab.telemetryOn) throw new Error('Recording is unavailable.');
    await lab.sendFeedback(message, { name: cleanName });
  }
  rememberFeedbackName(cleanName);
  return 'queued';
}
