import { createLab } from '@adam0white/lab-client';
import { telemetryNotice } from '@adam0white/lab-kit';
import { fileLab } from './file-lab';

const fileEntry = /^\/smallworks\/file\/?$/.test(location.pathname);
export const lab = fileEntry ? fileLab('repair') : createLab({ game: 'repair' });
// Close every upload path before any persisted or arriving history can attach hooks.
lab.setPersonaRecording('workshop-startup');

const notice = fileEntry ? null : telemetryNotice();
if (notice) {
  const footer = document.createElement('footer');
  footer.className = 'lab-notice-footer';
  footer.append(notice);
  document.body.append(footer);
}
