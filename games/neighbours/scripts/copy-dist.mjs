import { cpSync, rmSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
cpSync('neighbours/dist', 'dist', { recursive: true });
