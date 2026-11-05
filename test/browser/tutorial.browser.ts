import { expect, type Page, test } from '@playwright/test';

// Check discoverability before locator clicks can scroll hidden controls into view.
async function expectPracticeInView(page: Page, step: string) {
  const cue = page.locator(`[data-tutorial-step="${step}"]`);
  await expect(cue).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      cue.evaluate((element) => {
        const b = element.getBoundingClientRect();
        const points: [number, number][] = [
          [b.left + 12, b.top + 12],
          [b.right - 12, b.top + 12],
          [b.left + 12, b.bottom - 12],
          [b.right - 12, b.bottom - 12],
        ];
        return points.every(([x, y]) => element.contains(document.elementFromPoint(x, y)));
      }),
    )
    .toBe(true);

  for (const control of [page.locator('.teaching-target'), ...(await cue.locator('p, button').all())]) {
    await expect(control).toBeInViewport({ ratio: 1 });
    await expect
      .poll(() =>
        control.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }),
      )
      .toBe(true);
  }
}

// Preserve a seed when a native startup fails before the guide can render.
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  console.log(
    'PRACTICE_GEOMETRY',
    await page.locator('.teaching-cue, .teaching-target, .sheet, .who, .verbs').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          class: element.className,
          step: (element as HTMLElement).dataset.tutorialStep,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scrollTop: element.scrollTop,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          overflow: getComputedStyle(element).overflow,
        };
      }),
    ),
  );
  const seed = await page
    .evaluate(() => (window as unknown as { __pass?: { state?: { seed: number } } }).__pass?.state?.seed)
    .catch(() => undefined);
  if (seed !== undefined)
    await info.attach('failed-kitchen-seed', {
      body: JSON.stringify({ seed }),
      contentType: 'application/json',
    });
});

for (const viewport of [
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('first minute uses only controls to change the real staffing plan', async ({ page }) => {
      await page.goto('/?lab=1');
      await page.locator('#new').click();
      await expectPracticeInView(page, 'plan');
      await page.screenshot({ path: `test-results/practice-${viewport.width}-plan.png` });
      await page.locator('.board-change').first().click();
      await expectPracticeInView(page, 'station');
      await page.locator('[data-field="station"][data-value="cold"]').click();
      await expectPracticeInView(page, 'break');
      await page.locator('[data-field="break"][aria-pressed="false"]').first().click();
      await expectPracticeInView(page, 'cover');
      await page.locator('[data-field="cover"][data-value=""]').click();
      await expectPracticeInView(page, 'done');
      await expect(page.locator('.tutorial-plan [data-gap="true"]')).toBeVisible();
      await page.locator('#board-done').click();
      await page.locator('#ask-board').click();
      await expectPracticeInView(page, 'open');
      await page.locator('#open-service').click();
      await expectPracticeInView(page, 'crew');
      await page.locator('[data-pick]').first().click();
      await expectPracticeInView(page, 'ask');
      await expect(page.locator('.verbs .h').first()).toBeVisible();
      await page.locator('#close').click();
      await expectPracticeInView(page, 'crew');
      await page.locator('[data-pick]').first().click();
      await page.locator('[data-v]:not([disabled])').first().click();
      await expectPracticeInView(page, 'result');
      if (viewport.width === 360) {
        await expect
          .poll(() =>
            page.evaluate(() => {
              const till = document.querySelector('#till')?.getBoundingClientRect();
              const stock = document.querySelector('#kitchen-stock')?.getBoundingClientRect();
              return !!till && !!stock && till.bottom <= stock.top;
            }),
          )
          .toBe(true);
        await page.locator('[data-tutorial-skip]').focus();
        await page.setViewportSize({ width: 820, height: 1180 });
        await expect(page.locator('[data-tutorial-skip]')).toBeFocused();
        await expectPracticeInView(page, 'result');
        await page.setViewportSize(viewport);
        await expectPracticeInView(page, 'result');
      }
      // The private invitation has a warning and optional topics, unlike the two-button check-in row.
      const invitation = page.locator('[data-contact="invite"]');
      await expect(invitation).toBeAttached();
      const contactLayout = await invitation.evaluate((button) => {
        const parent = button.parentElement?.getBoundingClientRect();
        const action = button.getBoundingClientRect();
        const warning = button.nextElementSibling?.getBoundingClientRect();
        if (!parent || !warning) return false;
        return action.width >= parent.width * 0.9 && warning.top >= action.bottom;
      });
      expect(contactLayout).toBe(true);
      await page.screenshot({ path: `test-results/practice-${viewport.width}-reply.png` });
      await page.evaluate(() => {
        const game = (window as unknown as { __pass: { state: { till: number }; draw(): void } }).__pass;
        game.state.till = 321;
        game.draw();
      });
      await expect(page.locator('.tutorial-stakes meter')).toHaveAttribute('value', '321');
      await page.locator('#close').click();
      await expectPracticeInView(page, 'result');
      await expect(page.locator('[data-tutorial-finish]')).toHaveCount(0);
      await page.locator('[data-pick]').first().click();
      await page.locator('[data-tutorial-finish]').click();
      await page.locator('#game-menu').click();
      await page.locator('#menu-tutorial').click();
      await expectPracticeInView(page, 'crew');
      await page.locator('[data-tutorial-skip]').click();
      await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
    });

    test('menu replay keeps an unsubmitted plan and opening directly still teaches service', async ({
      page,
    }) => {
      await page.goto('/');
      await page.locator('#new').click();
      await page.locator('.board-change').first().click();
      await page.locator('[data-field="station"][data-value="cold"]').click();
      await page.locator('[data-field="break"][aria-pressed="false"]').first().click();
      const chosenBreak = await page
        .locator('[data-field="break"][aria-pressed="true"]')
        .getAttribute('data-value');
      await page.locator('#board-done').click();
      await expect(page.locator('#ask-board')).toBeVisible();
      await page.locator('#game-menu').click();
      await page.locator('#menu-tutorial').click();
      await expect(page.locator('#ask-board')).toBeVisible();
      await page.locator('.board-change').first().click();
      await expect(page.locator('[data-field="station"][data-value="cold"]')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.locator(`[data-field="break"][data-value="${chosenBreak}"]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.locator('#board-done').click();
      await page.locator('#ask-board').click();
      await page.locator('#game-menu').click();
      await page.locator('#menu-tutorial').click();
      await page.locator('#open-service').click();
      await expect(page.locator('[data-tutorial-step="crew"]')).toBeVisible();
      await page.locator('[data-tutorial-skip]').click();
    });

    test('practice replay before starting and after dismissing an editor stays visible and skippable', async ({
      page,
    }) => {
      await page.goto('/');
      await page.locator('#game-menu').click();
      await page.locator('#menu-tutorial').click();
      await expect(page.locator('[data-tutorial-step="continue"]')).toBeVisible();
      await page.locator('#new').click();
      await page.locator('.board-change').first().click();
      await expect(page.locator('[data-tutorial-step="station"]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
      await expect(page.locator('.tutorial-stakes meter')).toBeVisible();
      await page.locator('[data-tutorial-skip]').click();
      await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
    });
  });
}

test('starting a new kitchen resets a replayed guide after an earlier skip', async ({ page }) => {
  await page.goto('/');
  await page.locator('#new').click();
  await page.locator('[data-tutorial-skip]').click();
  await page.locator('#open-service').click();
  await page.locator('#game-menu').click();
  await page.locator('#menu-tutorial').click();
  await page.locator('[data-pick]').first().click();
  await page.locator('[data-v]:not([disabled])').first().click();
  await expect(page.locator('[data-tutorial-step="result"]')).toBeVisible();
  await page.locator('#game-menu').click();
  await page.locator('#menu-new').click();
  await page.locator('#menu-new-yes').click();
  await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
  await page.locator('[data-tutorial-skip]').click();
});

// DOM-only phase control: this isolates guide recovery, not native night progression.
test('unfinished service practice remains dismissible at evening and the next board', async ({ page }) => {
  await page.goto('/');
  for (const serviceStep of ['crew', 'waiting', 'result']) {
    await page.evaluate(async (phase) => {
      const teachingPath = '/src/ui/teaching.ts';
      const teaching = await import(teachingPath);
      document.body.innerHTML =
        '<main class="people-service"><button data-pick="selim" aria-pressed="true">Selim</button><div class="panel-reply"></div></main>';
      teaching.beginTeaching('service', true);
      if (phase !== 'crew') {
        document.querySelector<HTMLButtonElement>('[data-pick]')?.click();
        teaching.teachingRequestSent(() => phase === 'result', 'selim');
      }
      teaching.refreshTeaching();
      teaching.mountTeaching();
    }, serviceStep);
    await expect(page.locator(`[data-tutorial-step="${serviceStep}"]`)).toBeVisible();
    await page.evaluate(async () => {
      const teachingPath = '/src/ui/teaching.ts';
      const teaching = await import(teachingPath);
      document.body.innerHTML = '<button id="open">Open on Friday</button>';
      teaching.mountTeaching();
    });
    await expect(page.locator('[data-tutorial-step="continue"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-skip]')).toBeVisible();
    await page.evaluate(async () => {
      const teachingPath = '/src/ui/teaching.ts';
      const teaching = await import(teachingPath);
      document.body.innerHTML = '<button class="board-change">Change Selim’s plan</button>';
      teaching.mountTeaching();
    });
    await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
    await page.locator('[data-tutorial-skip]').click();
    await expect(page.locator('[data-tutorial-step]')).toHaveCount(0);
  }
});

test('native closing time keeps unfinished practice on the evening continuation', async ({ page }) => {
  await page.addInitScript(() => {
    Date.now = () => 42;
    Math.random = () => 0;
  });
  await page.goto('/?lab=1');
  await page.locator('#new').click();
  await page.locator('#open-service').click();
  await expect(page.locator('[data-tutorial-step="crew"]')).toBeVisible();
  // Advance real native minutes, not a fabricated phase or report. The ordinary frame closes service.
  await page.evaluate(() => {
    const game = (window as unknown as { __pass: { step(n: number): void } }).__pass;
    game.step(600);
  });
  await expect(page.locator('#open')).toBeVisible();
  await expect(page.locator('[data-tutorial-step="continue"]')).toBeVisible();
  await page.locator('#open').click();
  await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
  await page.locator('[data-tutorial-skip]').click();
});

test('replaying practice from the saved-game title points to Resume', async ({ page }) => {
  await page.goto('/');
  await page.locator('#new').click();
  await expect(page.locator('.board-change').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('#cont')).toBeVisible();
  await page.locator('#game-menu').click();
  await page.locator('#menu-tutorial').click();
  await expect(page.locator('#cont')).toHaveClass(/teaching-target/);
  await page.locator('#cont').click();
  await expect(page.locator('[data-tutorial-step="plan"]')).toBeVisible();
  await page.locator('[data-tutorial-skip]').click();
});

test('phone practice stays visible for the second cook after a late covered break', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 690 });
  await page.goto('/?lab=1');
  await page.locator('#new').click();
  await page.locator('.board-change').first().click();
  await page.locator('[data-field="station"][data-value="cold"]').click();
  await page.locator('[data-field="break"]').filter({ hasText: '19:45' }).click();
  await page.locator('[data-field="cover"][data-value="dilek"]').click();
  await page.locator('#board-done').click();
  await page.locator('#ask-board').click();
  await page.locator('#open-service').click();
  await expectPracticeInView(page, 'crew');
  await page.evaluate(() => {
    const game = (window as unknown as { __pass: { step(minutes: number): void; draw(): void } }).__pass;
    game.step(8);
    game.draw();
  });
  await page.locator('[data-pick="dilek"]').click();
  await expectPracticeInView(page, 'ask');
  await expect(page.locator('.verbs .h').first()).toBeVisible();
  await page.waitForTimeout(1200);
  await expectPracticeInView(page, 'ask');
});

test('speech highlight expiry preserves the active practice cue immediately', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.setTimeout;
    const callbacks: (() => void)[] = [];
    (window as unknown as { highlightCallbacks: (() => void)[] }).highlightCallbacks = callbacks;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 4000 && typeof handler === 'function') callbacks.push(() => handler(...args));
      return original(handler, delay, ...args);
    }) as typeof window.setTimeout;
  });
  await page.goto('/?lab=1');
  await page.locator('#new').click();
  await page.locator('#open-service').click();
  await expectPracticeInView(page, 'crew');
  const immediateCue = await page.evaluate(() => {
    const callbacks = (window as unknown as { highlightCallbacks: (() => void)[] }).highlightCallbacks;
    if (!callbacks.length) throw new Error('No real speech-highlight timer was scheduled');
    callbacks.at(-1)?.();
    return !!document.querySelector('[data-tutorial-step="crew"]');
  });
  expect(immediateCue).toBe(true);
  await expectPracticeInView(page, 'crew');
  await page.locator('[data-pick]').first().click();
  await expectPracticeInView(page, 'ask');
  await page.locator('[data-v]:not([disabled])').first().focus();
  expect(
    await page.evaluate(() => {
      const before = document.activeElement;
      (window as unknown as { highlightCallbacks: (() => void)[] }).highlightCallbacks.at(-1)?.();
      return before?.isConnected && document.activeElement === before;
    }),
  ).toBe(true);
  await page.locator('[data-tutorial-skip]').focus();
  expect(
    await page.evaluate(() => {
      (window as unknown as { highlightCallbacks: (() => void)[] }).highlightCallbacks.at(-1)?.();
      return document.activeElement?.hasAttribute('data-tutorial-skip');
    }),
  ).toBe(true);
});
