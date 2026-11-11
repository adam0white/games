import { createPersona, preparePersonaLife } from "@adam0white/lab-client";
import { expect, test } from "@playwright/test";
import { departure, ENGINE } from "../src/actors.ts";
import { createGame } from "../src/host.ts";

// Disposable shelf only. The source is an idle synthetic actor, not a completed
// player chapter. The headless control separately uses a played three-night run.
test("Tariq arrives through the ordinary browser shelf and resumes locally", async ({
  page,
  baseURL,
}) => {
  const parent = await createPersona({
    format: "hf-persona/1",
    castId: "hf.cast.tariq.well",
    castRevision: "1",
    branchId: "browser-control",
    parentRevision: null,
    source: {
      game: "lefthand",
      engine: ENGINE,
      build: "synthetic",
      rules: "left-hand-5",
    },
    transfer: departure(createGame(9), "tariq"),
    limitations: [],
  });
  const input = preparePersonaLife(parent, 0);
  const calls: {
    action: string;
    castIds?: string[];
    envelopes?: { castId: string }[];
  }[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/__tariq-call") {
      calls.push(request.postDataJSON());
      await route.fulfill({ body: "ok" });
    } else if (url.pathname === "/lab/identity/") {
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><script>
        const input = ${JSON.stringify(input)};
        addEventListener('message', async event => {
          const m = event.data;
          if (!m?.type?.startsWith('hf-')) return;
          await fetch('/__tariq-call', {method:'POST', body:JSON.stringify(m)});
          let value = true;
          if (m.type === 'hf-persona-request') {
            if (m.action === 'prepareBatch') value = {
              inputs: [input], blocked: [],
              expectedHeads: Object.fromEntries(m.castIds.map(id => [id, id === input.parent.castId ? input.parent.revision : null]))
            };
            else value = m.envelopes ?? [];
          }
          const reply = {id:m.id, type:m.type === 'hf-persona-consent' ? 'hf-persona-consent-reply' : 'hf-persona-reply', value};
          event.ports[0].postMessage(reply);
        });</script>`,
      });
    } else if (url.hostname === "play.adamwhite.work") {
      const response = await route.fetch({
        url: `${baseURL}${url.pathname}${url.search}`,
      });
      await route.fulfill({ response });
    } else if (!["GET", "HEAD"].includes(request.method())) await route.abort();
    else await route.continue();
  });
  // The SDK intentionally permits continuity only at registered game origins.
  await page.goto("https://play.adamwhite.work/lefthand/");
  await page.waitForFunction(
    () => window.Lefthand?.snapshot().carryover.inputs.length === 1,
  );
  await page.waitForFunction(() => window.Lefthand.metrics().rendererReady);
  const incoming = await page.evaluate(
    () => window.Lefthand.snapshot().carryover.inputs[0]?.parent.castId,
  );
  expect(incoming).toBe(parent.castId);
  expect(calls.find((c) => c.action === "prepareBatch")?.castIds).toContain(
    parent.castId,
  );
  expect(
    calls
      .filter((c) => c.action === "putBatch")
      .flatMap((c) => c.envelopes ?? [])
      .map((p) => p.castId),
  ).toEqual([parent.castId]);
  const reads = calls.filter((c) => c.action === "prepareBatch").length;
  await page.reload();
  await page.waitForFunction(
    () => window.Lefthand?.snapshot().carryover.inputs.length === 1,
  );
  expect(calls.filter((c) => c.action === "prepareBatch")).toHaveLength(reads);
  await page.waitForFunction(() => window.Lefthand.metrics().rendererReady);
  await page.locator("#menu-open").click();
  await expect(page.locator("#shelf-status")).toContainText(
    "Saved run resumed",
  );
});
