import { createLab } from '@adam0white/lab-client';
import { telemetryNotice } from '@adam0white/lab-kit';
export const lab = createLab({ game: 'repair' });
// Close every upload path before any persisted or arriving history can attach hooks.
lab.setPersonaRecording('workshop-startup');

const notice = telemetryNotice();
if (notice) {
  const footer = document.createElement('footer');
  footer.className = 'lab-notice-footer';
  footer.append(notice);
  document.body.append(footer);
}
