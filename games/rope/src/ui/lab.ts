import { createLab } from '@adam0white/lab-client';
import { fileEntry } from './continuity.ts';
import { fileLab } from './file-lab.ts';

export { fileEntry };

// The entry path alone selects preservation. Legacy URLs redirect before this module loads.
export const startupEntry = fileEntry(location.pathname);
export const lab = startupEntry === 'file' ? fileLab('rope') : createLab({ game: 'rope' });
