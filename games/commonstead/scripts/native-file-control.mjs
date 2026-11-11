import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({ server: { host: '127.0.0.1', port: 5278, strictPort: true } });
await server.listen();
const { control } = await server.ssrLoadModule('/test/native-file.browser.ts');
const browser = await chromium.launch({ headless: true });
try {
  console.log(JSON.stringify(await control(browser, 'http://127.0.0.1:5278/commonstead'), null, 2));
} finally {
  await browser.close();
  await server.close();
}
