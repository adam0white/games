/** Real SDK only. Refused preservation never falls back to a standard client. */
import { createLab, type Lab, type PreservationStatus } from '@adam0white/lab-client';
import { fileLab } from './file-lab.ts';
export let fileMode = false;
export let preservationStatus: PreservationStatus = 'standard';
export let lab: Lab | null = null;
/** Called once by the entry, before importing the full App. */
export function initializeLab(preservingFile: boolean): void {
  fileMode = preservingFile;
  if (fileMode) {
    preservationStatus = 'standard';
    lab = fileLab('goodhands');
    return;
  }
  const client = createLab({ game: 'goodhands' });
  preservationStatus = client.preservationStatus;
  if (fileMode && preservationStatus !== 'existing-local') {
    client.dispose();
    return;
  }
  lab = client;
}
