import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeWorkshopStorage } from './workshop-storage';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
async function start() {
  if (!/^\/file\/?$/.test(location.pathname)) await initializeWorkshopStorage();
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start().catch((error) => {
  console.error('Workshop storage could not open:', error);
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent =
    'This browser could not open the saved workshop. Your saved data has not been replaced. Reload to try again, or open a workshop file.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Try again';
  retry.onclick = () => location.reload();
  const file = document.createElement('a');
  file.href = '/file/';
  file.textContent = 'Open a workshop file';
  root!.replaceChildren(message, retry, file);
});
