import '@adam0white/lab-kit/stage.css';
import './ui/style.css';
import { fileEntry } from './entry.ts';

const mode = fileEntry(location.search, location.pathname);
if (mode === 'invalid') {
  const app = document.getElementById('app');
  if (app) app.textContent = 'This file address is invalid. Use /warren/file/ to choose a saved file.';
} else if (
  mode === 'file' &&
  (location.pathname !== '/warren/file/' || new URLSearchParams(location.search).has('file'))
) {
  const query = new URLSearchParams(location.search);
  query.delete('file');
  const search = query.toString();
  location.replace(`/warren/file/${search ? `?${search}` : ''}${location.hash}`);
} else {
  const { _debug, start } = await import('./ui/app.ts');
  if (import.meta.env.DEV) (window as unknown as { __warren: typeof _debug }).__warren = _debug;
  void start();
}
