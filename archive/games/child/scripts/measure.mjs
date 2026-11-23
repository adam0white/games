import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      root,
      `.${new URL(req.url, "http://localhost").pathname === "/" ? "/index.html" : new URL(req.url, "http://localhost").pathname}`,
    );
    if (!path.startsWith(`${root}/`)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(path);
    res.writeHead(200, {
      "content-type":
        {
          ".js": "application/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".json": "application/json",
        }[extname(path)] ?? "application/octet-stream",
      "content-encoding": "gzip",
    });
    res.end(gzipSync(data));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(5180, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 562,
    downloadThroughput: 180000,
    uploadThroughput: 90000,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const start = performance.now();
  await page.goto("http://127.0.0.1:5180/");
  await page.locator('html[data-ready="true"]').waitFor();
  const readyMs = Math.round(performance.now() - start);
  const info = await page.evaluate(() => ({
    renderer: document.documentElement.dataset.renderer,
    overflow: document.documentElement.scrollWidth > innerWidth,
    transfer: performance
      .getEntriesByType("resource")
      .reduce((sum, r) => sum + r.transferSize, 0),
  }));
  console.log(
    JSON.stringify({
      profile: {
        latencyMs: 562,
        bytesPerSecond: 180000,
        cpu: 4,
        viewport: "360x690",
      },
      readyMs,
      ...info,
    }),
  );
  if (process.env.CHILD_SCREENSHOT) {
    await page
      .getByRole("button", { name: "Continue", exact: true })
      .click()
      .catch(() => {});
    await page.screenshot({ path: process.env.CHILD_SCREENSHOT });
  }
  if (process.env.CHILD_METRICS)
    await writeFile(
      process.env.CHILD_METRICS,
      `${JSON.stringify({ readyMs, ...info })}\n`,
    );
  if (readyMs >= 5000 || info.overflow) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
