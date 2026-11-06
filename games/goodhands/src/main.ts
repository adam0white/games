import '@adam0white/lab-kit/tokens.css';
import './ui/style.css';
import { initializeLab } from './ui/lab.ts';

// The public path selects preservation before App, Shelf or native-save startup.
initializeLab(location.pathname === '/goodhands/file/' || location.pathname === '/goodhands/file/index.html');
await import('./ui/app.ts');
