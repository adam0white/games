import { createLab } from '@adam0white/lab-client';
import { telemetryNotice } from '@adam0white/lab-kit';
export const lab = createLab({ game: 'repair' });

const notice = telemetryNotice();
if (notice) document.body.append(notice);
