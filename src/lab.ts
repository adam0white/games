import { createLab } from '@adam0white/lab-client';
import { telemetryNotice } from '@adam0white/lab-kit';
export const lab = createLab({ game: 'repair' });
// Close every upload path before any persisted or arriving history can attach hooks.
lab.setPersonaRecording('workshop-startup');

const notice = telemetryNotice();
if (notice) {
  // Keep the menu available so the player can turn recording off immediately.
  notice.style.top = 'calc(env(safe-area-inset-top, 0px) + 56px)';
  const dismiss = notice.querySelector('button');
  if (dismiss) {
    dismiss.style.minHeight = '44px';
    dismiss.style.minWidth = '44px';
  }
  document.body.append(notice);
}
