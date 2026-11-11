import { createLab } from '@adam0white/lab-client';
import { fileEntry } from '../entry.ts';
import { fileLab } from './file-lab.ts';

// Resolve file and invalid routes before any SDK initialization.
export const entryMode = fileEntry(location.search, location.pathname);

export const lab = entryMode === 'native' ? createLab({ game: 'glance' }) : fileLab('glance');
