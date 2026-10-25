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
export function rememberFeedbackName(name: string) {
  try {
    const trimmed = name.trim().slice(0, 60);
    if (trimmed) localStorage.setItem(FEEDBACK_NAME_KEY, trimmed);
    else localStorage.removeItem(FEEDBACK_NAME_KEY);
  } catch {
    /* Device storage is optional. */
  }
}
/** Feedback stays available independently of automatic recording. */
export async function queueFeedback({
  lab,
  getRun,
  note,
  verdict,
  name,
  sharePlay = false,
}: {
  lab: Lab;
  getRun: () => unknown;
  note: string;
  verdict: string;
  name: string;
  sharePlay?: boolean;
}): Promise<string> {
  const message = [verdict ? `Verdict: ${verdict}` : '', note.trim()].filter(Boolean).join('\n\n');
  const feedbackRun = () => {
    try {
      return getRun();
    } catch {
      return undefined;
    }
  };
  const cleanName = name.trim().slice(0, 60);
  const receipt = await lab.sendFeedback(message, {
    name: cleanName,
    run: feedbackRun(),
    sharePlay,
  });
  rememberFeedbackName(cleanName);
  return `Sent. Your note is stored. · ${receipt}`;
}
