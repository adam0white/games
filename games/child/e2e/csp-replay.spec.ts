import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("strict CSP permits renderer and preserves a replayed export", async ({
  page,
}) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    window.addEventListener("securitypolicyviolation", (event) => {
      (window as typeof window & { cspEvents: string[] }).cspEvents.push(
        `${event.effectiveDirective}:${event.blockedURI}`,
      );
    });
    (window as typeof window & { cspEvents: string[] }).cspEvents = [];
  });
  await page.route("**/child/**", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "content-security-policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'",
      },
    });
  });
  await page.goto("/child/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-renderer", "pixi");
  await page.locator("[data-guide-target]").click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const nativeDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export playtest" }).click();
  const nativePath = await (await nativeDownload).path();
  if (!nativePath) throw new Error("Native export missing");
  const native = JSON.parse(await readFile(nativePath, "utf8"));
  expect(native.inputs).toHaveLength(1);
  violations.push(
    ...(await page.evaluate(
      () => (window as typeof window & { cspEvents: string[] }).cspEvents,
    )),
  );
  await page.goto("/child/file/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-renderer", "pixi");
  await page.getByLabel("Replay playtest").setInputFiles(nativePath);
  await expect(
    page.getByRole("heading", { name: "One ordinary afternoon." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const replayDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export playtest" }).click();
  const replayPath = await (await replayDownload).path();
  if (!replayPath) throw new Error("Replay export missing");
  expect(JSON.parse(await readFile(replayPath, "utf8"))).toEqual(native);
  violations.push(
    ...(await page.evaluate(
      () => (window as typeof window & { cspEvents: string[] }).cspEvents,
    )),
  );
  expect(violations).toEqual([]);
});
