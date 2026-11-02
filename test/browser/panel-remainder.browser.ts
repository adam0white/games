/** Scope: ordinary public presentation and an equivalent input path; no new HF faculty. */
import { expect, type Page, test } from '@playwright/test';
import { validateReplayFile } from '../../src/sim/continuation.ts';
import { communityRun, verifyCommunity } from '../../src/sim/hf4-person.ts';
import { advance } from '../../src/sim/host-policy.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  type GameState,
  type newGame,
  personOf,
  queueInput,
  replay,
  restoreState,
  step,
  trustOf,
} from '../../src/sim/kitchen.ts';
import { heardTopics } from '../../src/sim/kitchen-edition.ts';
import type { ContinuityExport } from '../../src/ui/continuity.ts';
import oldSave from '../fixtures/f34-format2-source.json' with { type: 'json' };
import clearingPrefix from '../fixtures/host-clearing-prefix.json' with { type: 'json' };

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
  );
  await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
  await page.clock.install();
  await page.goto('/');
  await page.locator('#new').click();
});

test('names each plan, keeps full replies and shows actual public timing before opening', async ({
  page,
}) => {
  await expect(page.locator('.kitchen-context')).toContainText('The cold side prepares salads');
  const row = page.locator('[data-board-cook="selim"]').first();
  await expect(row.locator('.plan-warning')).toContainText('18:35–19:20');
  const disclosure = row.locator('.board-answer details');
  await expect(disclosure).not.toHaveAttribute('open');
  await disclosure.locator('summary').click();
  await expect(disclosure.locator('.hand')).toContainText('Chef');
  await row.getByRole('button', { name: 'Change Selim’s plan', exact: true }).click();
  await page.locator('[data-field="break"][data-value="1260"]').click();
  await expect(page.locator('.board-editor .plan-warning')).toContainText('21:00–21:20; it falls outside');
});

test('keyboard insist queues the existing insist action once while preserving the native notebook', async ({
  page,
}) => {
  await page.locator('#open-service').click();
  await page.locator('[data-pick="selim"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-pick="selim"]')).toBeFocused();
  await expect(page.locator('.request-warning')).toContainText('only cook at the grill');
  await expect(page.locator('.insist-choice summary')).toContainText('Ask more firmly: Selim');
  await expect(page.locator('.insist-choice')).toContainText('can cost their trust');
  await expect(page.locator('.insist-choice')).toContainText('can still say no');
  await page.locator('.insist-choice summary').click();
  const insist = page.locator('[data-insist="cold"]');
  await insist.focus();
  await page.keyboard.press('Enter');
  const readInputs = () =>
    page.evaluate(
      () =>
        new Promise<{ kind: string; cook?: string; verb?: string; insist?: boolean }[]>((resolve, reject) => {
          const request = indexedDB.open('pass-journal');
          request.onsuccess = () => {
            const get = request.result.transaction('head', 'readonly').objectStore('head').get('current');
            get.onsuccess = () => resolve(get.result?.host.inputs ?? []);
            get.onerror = () => reject(get.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
  await expect
    .poll(async () => (await readInputs()).filter((i) => i.kind === 'ask' && i.insist).length)
    .toBe(1);
  const inputs = await readInputs();
  expect(inputs.filter((i) => i.kind === 'ask' && i.insist)).toHaveLength(1);
  expect(inputs.at(-1)).toMatchObject({ kind: 'ask', cook: 'selim', verb: 'cold', insist: true });
});

test('keeps the selected third cook focused after a real file receipt changes the sheet', async ({
  page,
}) => {
  test.setTimeout(60000);
  // Real ordinary-input night-two prefix, all actors/history retained; no Person injection.
  const state = replay(
    clearingPrefix.seed,
    clearingPrefix.inputs as Parameters<typeof replay>[1],
    clearingPrefix.minute,
    'pass@20',
  );
  const file = JSON.stringify(exportRun(state, '4.12.0'));
  await page.locator('#game-menu').click();
  await page
    .locator('details')
    .filter({ has: page.locator('#debug-import') })
    .locator('summary')
    .click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#debug-import').click();
  await (await chooser).setFiles({
    name: 'three-cook-control.json',
    mimeType: 'application/json',
    buffer: Buffer.from(file),
  });
  await page.locator('#title-confirm-yes').click();
  await expect(page.locator('#clock')).toBeVisible();
  await page.locator('[data-pick="rafi"]').click();
  await expect(page.locator('[data-pick="rafi"]')).toBeFocused();
  await expect(page.locator('[data-pick="rafi"]')).toHaveAttribute('aria-pressed', 'true');
});

// The file is generated by f34 source; rejection leaves the occupied journal intact.
test('refuses a file claiming the older framework while preserving the native journal', async ({ page }) => {
  const read = () =>
    page.evaluate(
      () =>
        new Promise<string | null>((resolve, reject) => {
          const request = indexedDB.open('pass-journal');
          request.onsuccess = () => {
            const get = request.result.transaction('head', 'readonly').objectStore('head').get('current');
            get.onsuccess = () => resolve(get.result ? JSON.stringify(get.result) : null);
            get.onerror = () => reject(get.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
  await expect.poll(read).not.toBeNull();
  const before = await read();
  await page.locator('#game-menu').click();
  await page
    .locator('details')
    .filter({ has: page.locator('#debug-import') })
    .locator('summary')
    .click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#debug-import').click();
  await (await chooser).setFiles({
    name: 'f34-format2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(oldSave)),
  });
  await expect(page.locator('#title-status')).toContainText('cannot be loaded');
  expect(await read()).toBe(before);
});

const waitWords =
  'I will explain the wait. I am leaving the other tables for three minutes. The cooks will keep the orders they already have.';
const timeOf = (minute: number) => {
  const dayMinute = Math.ceil(minute) % 1440;
  return `${String(Math.floor(dayMinute / 60)).padStart(2, '0')}:${String(dayMinute % 60).padStart(2, '0')}`;
};

type CurrentControlPage = typeof window & {
  f2505Export?: (inputs: GameState['inputs'], minute: number) => ContinuityExport | null;
};

/** Keep the actual producer and its authority records together on this test's page. */
async function freshCurrentControl(page: Page) {
  const initial = await page.evaluate(async () => {
    const continuityPath = '/src/ui/continuity.ts';
    const simPath = '/src/sim/kitchen.ts';
    const { continuity } = await import(continuityPath);
    const { cloneState, replay } = await import(simPath);
    let state: GameState | null = null;
    const producer = continuity(
      () => state,
      () => {},
      () => {},
    );
    const opening: GameState = await producer.fresh(42);
    state = opening;
    (window as CurrentControlPage).f2505Export = (inputs, minute) => {
      state = replay(
        opening.seed,
        inputs,
        minute,
        opening.version,
        opening.castChapter,
        opening.plainNarration,
      );
      return producer.run();
    };
    return cloneState(opening);
  });
  const state = restoreState(initial);
  expect(cloneState(state)).toEqual(initial);
  return state;
}

/** Construct now from ordinary inputs on the producer's actual opening chapter. */
function currentWaitControl(state: GameState) {
  queueInput(state, { kind: 'board', rows: boardDefaults(state) });
  queueInput(state, { kind: 'open' });
  // The kitchen-edition guest control supplies the policy, not a current result.
  for (let turns = 0; state.night < 2 && turns < 1000; turns++) advance(state, 'ask', 'promise-none');
  expect(state.night, 'ordinary first-service inputs must reach night two').toBe(2);
  queueInput(state, { kind: 'board', rows: boardDefaults(state) });
  queueInput(state, { kind: 'open' });
  while (state.phase === 'service') {
    // Answer real station gaps through the ordinary control. The accepted guest
    // can still be speaking after this answer is applied on the next minute.
    for (const decision of state.staffing ?? [])
      if (decision.state === 'asking') queueInput(state, { kind: 'staff', id: decision.id, cover: null });
    step(state);
    // Another cook's later answer must not hide an actual ongoing visit.
    for (const line of state.said
      .filter((entry) => entry.kind === 'answer' && entry.text === waitWords)
      .toReversed()) {
      const active = communityRun(state.chef).active.find(
        (activity) => activity.person === line.who && activity.offer.id === 'explain-wait',
      );
      if (!active) continue;
      const guests = state.kitchen?.guests.filter(
        (guest) => guest.who === line.who && guest.at === line.at && guest.action === 'explain-wait',
      );
      // Retained prior-night speech may have no current guest, or be ambiguous.
      // Select a unique actual visit; the UI keeps raw words for other cases.
      if (guests?.length !== 1) continue;
      expect(guests).toHaveLength(1);
      const guest = guests[0]!;
      // Same cook/action alone could select an older visit. Require its public HF identity.
      if (guest.activity !== active.id) continue;
      expect(['assented', 'complied']).toContain(guest.verdict);
      expect(guest.outcome).toBe('heard');
      expect(active.offer.durationMs).toBe(3 * 60_000);
      const tickets = state.tickets.filter((ticket) => ticket.id === guest.ticket);
      expect(tickets, 'the actual guest must resolve to one ticket').toHaveLength(1);
      expect(personOf(state, line.who).activity?.affordanceId).toBe('explain-wait');
      if (
        state.request?.state === 'asking' ||
        state.staffing?.some((decision) => decision.state === 'asking')
      )
        continue;
      const topic = heardTopics(state, line.who).find(
        (entry) => entry.at === line.at && entry.text === line.text,
      );
      if (!topic) throw new Error('The actual explain-wait utterance must have a heard topic');
      expect(topic.id).toBe(`said:${state.said.indexOf(line)}`);
      return { state, line, guest, ticket: tickets[0]!, topic };
    }
  }
  throw new Error('No real accepted pass@20 explain-wait event in seed 42 night two; control cannot skip');
}

async function loadCurrentControl(page: Page, state: ReturnType<typeof newGame>) {
  // Freeze only the browser timer. All kitchen time below advances through step().
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1)));
  const file = await page.evaluate(
    ({ inputs, minute }) => {
      const fixture = window as CurrentControlPage;
      if (!fixture.f2505Export) throw new Error('Missing actual current control producer');
      const file = fixture.f2505Export(inputs, minute);
      delete fixture.f2505Export;
      return file;
    },
    { inputs: state.inputs, minute: state.minute },
  );
  if (!file) throw new Error('The actual current control producer refused to export');
  // Complete host and native HF state, including RNG, must agree before file admission.
  expect(file.state).toEqual(cloneState(state));
  await page.locator('#game-menu').click();
  await page.locator('.debug-tools summary').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#debug-import').click();
  await (await chooser).setFiles({
    name: 'ordinary-current-control.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await page.locator('#title-confirm-yes').click();
  try {
    await expect(page.locator('#clock')).toBeVisible();
  } catch (error) {
    try {
      const failure = await page.evaluate(async () => {
        const appPath = '/src/ui/app.ts';
        const { _debug } = await import(appPath);
        const failure = _debug.fileImportFailure;
        if (!failure) return null;
        const caught = failure.error;
        return {
          stage: failure.stage,
          error:
            caught instanceof Error
              ? { name: caught.name, message: caught.message, stack: caught.stack }
              : String(caught),
        };
      });
      await test.info().attach('current-file-import-failure', {
        body: JSON.stringify(failure),
        contentType: 'application/json',
      });
    } catch {
      // A failed diagnostic attachment must not replace the original assertion.
    }
    throw error;
  }
  // Full host/HF checkpoint (including RNG), not a prose-only comparator.
  expect(
    await page.evaluate(async () => {
      const appPath = '/src/ui/app.ts';
      const simPath = '/src/sim/kitchen.ts';
      const { _debug } = await import(appPath);
      const { cloneState } = await import(simPath);
      return cloneState(_debug.state);
    }),
  ).toEqual(cloneState(state));
}

for (const viewport of [
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
]) {
  test(`F-2505 actual current speech, topic and changing activity at ${viewport.width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const { state, line, guest, ticket, topic } = currentWaitControl(await freshCurrentControl(page));
    if (viewport.width === 360) {
      // Full current host replay and HF history, including all earlier guest decisions.
      expect(
        cloneState(
          replay(
            state.seed,
            state.inputs,
            state.minute,
            state.version,
            state.castChapter,
            state.plainNarration,
          ),
        ),
      ).toEqual(cloneState(state));
      const verified = verifyCommunity(state.chef);
      expect(verified.verified).toBe(true);
      expect(verified.fullHash).toBe(communityRun(state.chef).checkpoint().archive.hashes.full);
      const oldFile = exportRun(state, '4.12.0');
      const checkpoint = oldFile.state.hf4;
      if (!checkpoint) throw new Error('Missing current checkpoint');
      oldFile.state.hf4 = {
        ...checkpoint,
        archive: { ...checkpoint.archive, host: { ...checkpoint.archive.host, schema: 'pass-hf4/1' } },
      };
      const originalBytes = JSON.stringify(oldFile);
      expect(() => restoreState(oldFile.state)).toThrow('Keep this file');
      await expect(validateReplayFile(oldFile)).rejects.toThrow('Keep this file');
      expect(JSON.stringify(oldFile)).toBe(originalBytes);
      for (const visit of state.kitchen?.guests ?? []) {
        if (['heard', 'washing', 'explained', 'left-before-reply', 'interrupted'].includes(visit.outcome)) {
          expect(['assented', 'complied']).toContain(visit.verdict);
          expect(visit.activity).toBeTruthy();
        }
        if (visit.outcome === 'not-started') {
          expect(['assented', 'complied']).toContain(visit.verdict);
          expect(visit.activity).toBeUndefined();
          expect(
            state.said.some(
              (said) =>
                said.who === 'narrator' && said.at === visit.at && said.text.includes('did not start'),
            ),
          ).toBe(true);
        }
        if (visit.outcome === 'unanswered') {
          expect(visit.activity).toBeUndefined();
          expect(
            state.said.some(
              (said) =>
                said.who === 'narrator' && said.at === visit.at && said.text.includes('did not start'),
            ),
          ).toBe(true);
        }
      }
    }
    // A later run emits its exact ordinary prefix. No captured fixture is invented here.
    await testInfo.attach('F-2505-ordinary-input-witness', {
      body: JSON.stringify({
        game: state.version,
        seed: state.seed,
        inputs: state.inputs,
        minute: state.minute,
        line,
        guest,
        ticket,
        topic,
      }),
      contentType: 'application/json',
    });
    const name = state.crew.find((member) => member.id === guest.who)!.name;
    const paraphrase = `In plain words: I will tell table ${ticket.table} why their food is not here. I will leave my work for three minutes. The cooks will keep the orders they already have.`;
    await loadCurrentControl(page, state);
    await expect(page.locator('#caption')).toContainText(`${timeOf(line.at)} · ${name}: ${paraphrase}`);
    await expect(page.locator('.journal')).toContainText(`${name}: ${paraphrase}`);
    await expect(page.locator('.journal')).toContainText(timeOf(line.at));
    await page.locator(`[data-pick="${guest.who}"]`).click();
    await expect(page.locator('.panel-reply')).toHaveText(`Said at ${timeOf(line.at)}: ${paraphrase}`);
    await expect(page.locator(`[data-pick="${guest.who}"]`)).toContainText('Now: answering a table');
    const topicButton = page.locator(`[data-heard-topic="${topic.id}"]`);
    await expect(topicButton).toHaveText(`Talk about what they said at ${timeOf(line.at)}: ${paraphrase}`);

    // HOST-ONLY request overlay: exercise request-sheet caching across an actual
    // HF activity transition. No fabricated speech, Person, activity or clock.
    const change = await page.evaluate(
      async ({ who }) => {
        const appPath = '/src/ui/app.ts';
        const simPath = '/src/sim/kitchen.ts';
        const { _debug } = await import(appPath);
        const { personOf, stationsTonight, step } = await import(simPath);
        const s = _debug.state;
        const originalRequest = s.request;
        s.request = { kind: 'phone', who: 'dilek', state: 'asking', at: s.minute };
        _debug.draw();
        const before = document.querySelector(`[data-pick="${who}"]`)?.textContent;
        const position = () => {
          const rect = document.querySelector(`#scene [data-cook="${who}"] > rect`);
          return [rect?.getAttribute('x'), rect?.getAttribute('y')];
        };
        const figureBefore = position();
        document.querySelector<HTMLButtonElement>('#yes')?.focus();
        const requestAt = s.request.at;
        const initial = personOf(s, who).activity;
        let turns = 0;
        while (
          turns++ < 8 &&
          s.phase === 'service' &&
          (!personOf(s, who).activity || personOf(s, who).activity?.affordanceId === 'explain-wait')
        ) {
          step(s);
          _debug.draw();
        }
        const activity = personOf(s, who).activity;
        const id = activity?.affordanceId;
        const station = id === 'apron' ? 'grill' : id;
        const atStation = stationsTonight(s).includes(station);
        const atFixture = [
          'room',
          'conversation',
          'no-replies',
          'toilet',
          'pray',
          'eat',
          'break',
          'smoke',
          'phone',
          'skim',
        ].includes(id);
        const result = {
          before,
          after: document.querySelector(`[data-pick="${who}"]`)?.textContent,
          figureBefore,
          figureAfter: position(),
          expectedFigureY: (atStation ? 124 : atFixture ? (id === 'conversation' ? 140 : 22) : 212) - 50,
          activity: activity?.affordanceId,
          startedAt: activity?.startedAt,
          previousStart: initial?.startedAt,
          requestAt,
          request: { ...s.request },
          focused: document.activeElement?.id,
          expectedPlace:
            (
              {
                grill: 'grill',
                apron: 'grill',
                cold: 'cold side',
                dish: 'dishes',
                oven: 'oven',
                room: 'in the dining room',
                conversation: 'talking at the pass',
                toilet: 'in the bathroom',
                pray: 'in the storeroom',
                eat: 'eating',
                break: 'outside',
                smoke: 'outside',
                phone: 'outside',
                skim: 'outside',
                'no-replies': 'has put work and replies aside',
                resign: 'travelling home after leaving the job',
              } as Record<string, string>
            )[activity?.affordanceId ?? ''] ?? 'free',
        };
        // Restore only the host overlay. The cook keeps the actual new activity.
        s.request = originalRequest;
        return result;
      },
      { who: guest.who },
    );
    expect(change.activity, 'cook must actually begin another activity').toBeTruthy();
    expect(change.activity).not.toBe('explain-wait');
    expect(change.startedAt).not.toBe(change.previousStart);
    expect(change.before).toContain('Now: answering a table');
    expect(change.after).not.toBe(change.before);
    expect(change.after).toContain(`Now: ${change.expectedPlace}`);
    expect(Number(change.figureAfter[1])).toBe(change.expectedFigureY);
    expect(change.request).toMatchObject({ kind: 'phone', state: 'asking', at: change.requestAt });
    expect(change.focused).toBe('yes');
    await expect(page.locator('#yes')).toBeEnabled();
    await expect(page.locator('#no')).toBeEnabled();
    // Now redraw outside the host overlay. The old quote remains dated in both
    // its journal entry and its own topic; it does not claim to be current work.
    await page.evaluate(
      async ({ who }) => {
        const appPath = '/src/ui/app.ts';
        const simPath = '/src/sim/kitchen.ts';
        const { _debug } = await import(appPath);
        const { contactAvailable, queueInput, step } = await import(simPath);
        const s = _debug.state;
        // A real later activity can itself be off the line. Wait for actual contact
        // availability; do not change the cook or assume that a new job is obedience.
        while (
          s.phase === 'service' &&
          (!contactAvailable(s, who, 'follow-up') ||
            s.staffing?.some((decision: { state: string }) => decision.state === 'asking'))
        ) {
          for (const decision of s.staffing ?? [])
            if (decision.state === 'asking') queueInput(s, { kind: 'staff', id: decision.id, cover: null });
          step(s);
        }
        if (!contactAvailable(s, who, 'follow-up'))
          throw new Error('Actual explain-wait cook did not become available for the heard-topic follow-up');
        _debug.draw();
      },
      { who: guest.who },
    );
    // Redraw retains the selected cook; close before selecting them again.
    await page.locator('#close').click();
    await page.locator(`[data-pick="${guest.who}"]`).click();
    await expect(topicButton).toHaveText(`Talk about what they said at ${timeOf(line.at)}: ${paraphrase}`);
    const disclosure = page.locator('details').filter({ has: topicButton });
    await disclosure.locator('summary').click();
    await expect(topicButton).toBeEnabled();
    await topicButton.click();
    await expect(page.locator('.journal')).toContainText(`${name}: ${paraphrase}`);
    await expect(page.locator('.journal')).toContainText(
      `In plain words: You asked ${name} about what they said: I will tell table ${ticket.table}`,
    );
    const result = await page.evaluate(
      async ({ who, at, text, topicId }) => {
        const appPath = '/src/ui/app.ts';
        const simPath = '/src/sim/kitchen.ts';
        const kitchenPath = '/src/sim/kitchen-edition.ts';
        const { _debug } = await import(appPath);
        const { cloneState, replay } = await import(simPath);
        const { heardTopics } = await import(kitchenPath);
        const s = _debug.state;
        const replayed = replay(s.seed, s.inputs, s.minute, s.version, s.castChapter, s.plainNarration);
        return {
          input: s.inputs.at(-1),
          source: s.kitchen.conversations.at(-1)?.source,
          raw: s.said.filter(
            (entry: { who: string; at: number; text: string }) =>
              entry.who === who && entry.at === at && entry.text === text,
          ),
          chef: s.said.findLast((entry: { who: string }) => entry.who === 'chef')?.text,
          topic: heardTopics(s, who).find((entry: { id: string }) => entry.id === topicId),
          state: cloneState(s),
          replayed: cloneState(replayed),
        };
      },
      { who: guest.who, at: line.at, text: line.text, topicId: topic.id },
    );
    expect(result.input).toMatchObject({
      kind: 'cast-talk',
      who: guest.who,
      choice: 'follow-up',
      topic: topic.id,
    });
    expect(result.source).toEqual({ at: line.at, text: waitWords });
    expect(result.raw).toEqual([line]);
    expect(result.chef).toBe(`You said, “${waitWords}” Would you like to talk about that, ${name}?`);
    expect(result.topic).toMatchObject({ id: topic.id, at: line.at, text: waitWords });
    expect(result.replayed).toEqual(result.state);
  });
}

// F-2502 source preparation only. All execution gates remain UNRUN.
test('F-2502 deliberate home departure permits paid sequential work by the remaining cook', async ({
  page,
}, testInfo) => {
  // Wider full-night plus two complete replay workloads, not an owner performance relaxation.
  test.setTimeout(120000);
  const opening = await freshCurrentControl(page); // Exactly seed 42, no search or retry.
  queueInput(opening, { kind: 'board', rows: boardDefaults(opening) });
  queueInput(opening, { kind: 'open' });
  const target = opening.tickets
    .filter((ticket) => ticket.grill > 0 && ticket.cold > 0 && ticket.oven === 0)
    .toSorted((a, b) => a.at - b.at || a.id - b.id)[0];
  await loadCurrentControl(page, opening);

  const observe = () =>
    page.evaluate(async () => {
      const appPath = '/src/ui/app.ts';
      const simPath = '/src/sim/kitchen.ts';
      const hfPath = '/src/sim/hf4-person.ts';
      const { _debug } = (await import(appPath)) as typeof import('../../src/ui/app.ts');
      const { personOf, stationOf } = (await import(simPath)) as typeof import('../../src/sim/kitchen.ts');
      const { communityRun } = (await import(hfPath)) as typeof import('../../src/sim/hf4-person.ts');
      const s = _debug.state;
      if (!s) throw new Error('Current game is absent');
      return {
        minute: s.minute,
        phase: s.phase,
        night: s.night,
        till: s.till,
        inputs: s.inputs,
        applied: s.applied,
        tickets: s.tickets,
        answer: s.lastAnswer,
        regulars: s.regulars,
        bookings: s.bookings ?? [],
        crew: s.crew,
        wagesDue: s.wagesDue,
        carry: s.carry,
        reports: s.reports,
        replacement: s.kitchen?.supply.replacement ?? null,
        request: s.request,
        departed: s.cooks.find((cook) => cook.id === 'dilek')?.gone,
        remaining: s.cooks.filter((cook) => cook.here && !cook.gone).map((cook) => cook.id),
        activity: personOf(s, 'selim').activity?.affordanceId,
        station: stationOf(s, 'selim'),
        trust: personOf(s, 'selim').will.voices.find((voice) => voice.voiceId === 'chef')?.trust,
        costs: s.cooks.map((c) => ({
          id: c.id,
          gone: c.gone,
          night: c.night,
          trust: personOf(s, c.id).will.voices.find((v) => v.voiceId === 'chef')?.trust,
        })),
        insisted: s.cooks.find((cook) => cook.id === 'selim')?.night.insisted,
        protest: personOf(s, 'selim').activity?.protest ?? false,
        active: communityRun(s.chef)
          .active.filter((activity) => activity.person === 'selim')
          .map((activity) => ({ id: activity.id, offer: activity.offer.id })),
      };
    });
  type Observation = Awaited<ReturnType<typeof observe>>;
  // These are observations of actual till flow, not report.takings or a second simulation.
  // kitchen.ts: apply(replacement), answerRequest(advance), pass(wedding/table), settle.
  // Only pass can credit the till. Monday has no settle; allowed inputs cannot debit it.
  const ledger: {
    before: Observation;
    after: Observation;
    credit: number;
    debit: number;
    newlyServed: number[];
  }[] = [];
  const minute = async () => {
    const before = await observe(); // Includes pending inputs BEFORE their application.
    await page.evaluate(async () => {
      const appPath = '/src/ui/app.ts';
      const { _debug } = (await import(appPath)) as typeof import('../../src/ui/app.ts');
      _debug.step(1);
      _debug.draw();
    });
    const after = await observe();
    const delta = after.till - before.till;
    ledger.push({
      before,
      after,
      credit: Math.max(0, delta),
      debit: Math.max(0, -delta),
      newlyServed: after.tickets
        .filter(
          (t) =>
            t.status === 'served' && before.tickets.find((prior) => prior.id === t.id)?.status !== 'served',
        )
        .map((t) => t.id),
    });
    return after;
  };
  const leaveGaps = async () => {
    for (let count = 0; await page.locator('[data-cover=""]').count(); count++) {
      if (count >= 8) throw new Error('Cover answers did not settle');
      await page.locator('[data-cover=""]').click();
      await minute();
    }
  };
  const chooseSelim = async () => {
    const cook = page.locator('[data-pick="selim"]');
    if ((await cook.getAttribute('aria-pressed')) !== 'true') await cook.click();
  };
  const snapshot = () =>
    page.evaluate(async () => {
      const appPath = '/src/ui/app.ts';
      const simPath = '/src/sim/kitchen.ts';
      const { _debug } = (await import(appPath)) as typeof import('../../src/ui/app.ts');
      const { cloneState } = (await import(simPath)) as typeof import('../../src/sim/kitchen.ts');
      const state = _debug.state;
      if (!state) throw new Error('Current game is absent');
      return cloneState(state);
    });
  const prerequisites: string[] = [];
  const policy: Record<string, unknown> = {};
  let prefix: GameState | undefined;
  let shownDuringCover = false;
  let shortcutPresent = false;
  let blockedShortcut = false;
  let instruction = '';
  let sameShortcutInputs = false;
  try {
    expect(opening.seed).toBe(42);
    expect(opening.version).toBe('pass@20');
    expect(opening.night).toBe(1);
    expect(target, 'Monday two-station target').toBeDefined();
    await page.locator('[data-pick="dilek"]').click();
    await expect(page.locator('.insist-choice')).toContainText('can cost their trust');
    await expect(page.locator('.insist-choice')).toContainText('can still say no');
    await page.locator('.insist-choice summary').click();
    await page.locator('[data-insist="home"]').click();
    const departure = await minute();
    policy.departure = departure;
    expect(departure.inputs.at(-1)).toMatchObject({
      kind: 'ask',
      cook: 'dilek',
      verb: 'home',
      insist: true,
    });
    expect(departure.answer).toMatchObject({ who: 'dilek', verb: 'home', insisted: true });
    expect(departure.departed, 'Actual home departure').toBe(true);
    expect(departure.remaining).toEqual(['selim']);
    prefix = restoreState(await snapshot());
  } catch (error) {
    prerequisites.push(`INCONCLUSIVE departure prefix: ${String(error)}`);
  }
  if (prefix && target) {
    try {
      const recovery = page.locator('[data-home-recovery]');
      const shortcut = page.locator('[data-recovery-cook="selim"]');
      shownDuringCover = (await recovery.count()) === 1;
      instruction = (await recovery.count()) ? await recovery.innerText() : '';
      const coveredQuestion = (await page.locator('[data-cover=""]').count()) > 0;
      blockedShortcut =
        coveredQuestion && (await shortcut.count()) === 1 ? await shortcut.isDisabled() : !coveredQuestion;
      await leaveGaps();
      shortcutPresent = (await shortcut.count()) === 1;
      if (shortcutPresent) {
        const before = (await observe()).inputs;
        await shortcut.click();
        sameShortcutInputs = JSON.stringify((await observe()).inputs) === JSON.stringify(before);
      }
      await chooseSelim();
      const firstColdAt = (await observe()).minute;
      await page.locator('[data-v="cold"]').focus();
      await page.keyboard.press('Enter');
      let current = await minute();
      policy.initialColdAnswer = current.answer;
      expect(current.answer).toMatchObject({
        who: 'selim',
        verb: 'cold',
        at: firstColdAt,
        verdict: 'modified',
        counter: 'grill',
        insisted: false,
      });
      expect(current.activity).toBe('grill');
      expect(current.active.some((a) => a.offer === 'grill')).toBe(true);
      expect(current.tickets.every((t) => t.status === 'waiting')).toBe(true);
      while (
        current.tickets.find((t) => t.id === target.id)!.status === 'waiting' &&
        current.phase === 'service' &&
        current.minute <= target.at
      ) {
        await leaveGaps();
        current = await minute();
      }
      const arrived = current.tickets.find((t) => t.id === target.id)!;
      policy.arrived = arrived;
      expect(arrived.status).toBe('open');
      expect(arrived.doneCold).toBeLessThan(target.cold);
      expect(arrived.doneGrill).toBeLessThan(target.grill);
      await leaveGaps();
      await chooseSelim();
      await expect(page.locator('.insist-choice')).toContainText('can cost their trust');
      await expect(page.locator('.insist-choice')).toContainText('can still say no');
      const details = page.locator('.insist-choice');
      if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
      const beforeFirm = await observe();
      const coldAt = beforeFirm.minute;
      await page.locator('[data-insist="cold"]').focus();
      await page.keyboard.press('Enter'); // Exactly ONE post-ticket Insist. No retry.
      current = await minute();
      policy.coldAnswer = current.answer;
      policy.coldCost = { before: beforeFirm, after: current };
      expect(current.inputs.at(-1)).toMatchObject({
        kind: 'ask',
        cook: 'selim',
        verb: 'cold',
        insist: true,
        at: coldAt,
      });
      expect(current.insisted).toBe(beforeFirm.insisted! + 1);
      expect(current.answer).toMatchObject({ who: 'selim', verb: 'cold', at: coldAt, insisted: true });
      expect(['assented', 'complied']).toContain(current.answer?.verdict);
      expect(current.activity).toBe('cold');
      const coldActivity = current.active.find((a) => a.offer === 'cold');
      policy.coldActivity = coldActivity;
      expect(coldActivity).toBeDefined();
      expect(current.tickets.find((t) => t.id === target.id)!.doneCold).toBeLessThan(target.cold);
      while (
        current.tickets.find((t) => t.id === target.id)!.doneCold < target.cold &&
        current.phase === 'service' &&
        current.minute <= target.at + target.patience
      ) {
        await leaveGaps();
        current = await minute();
        expect(current.station).toBe('cold');
      }
      const coldDone = current.tickets.find((t) => t.id === target.id)!;
      policy.coldDone = current;
      expect(current.minute).toBeGreaterThan(coldAt + 1);
      expect(coldDone.doneCold).toBe(target.cold);
      expect(coldDone.status).toBe('open');
      expect(coldDone.doneGrill).toBeLessThan(target.grill);
      await leaveGaps();
      await chooseSelim();
      const grillAt = (await observe()).minute;
      await page.locator('[data-v="grill"]').focus();
      await page.keyboard.press('Enter');
      current = await minute();
      policy.grillAt = grillAt;
      policy.grillAnswer = current.answer;
      policy.grillActivity = current.active.find((a) => a.offer === 'grill');
      expect(current.answer).toMatchObject({ who: 'selim', verb: 'grill', at: grillAt });
      expect(['assented', 'complied']).toContain(current.answer?.verdict);
      expect(current.activity).toBe('grill');
      expect(current.active.find((a) => a.offer === 'grill')).toBeDefined();
      expect(current.active.find((a) => a.offer === 'grill')?.id).not.toBe(coldActivity?.id);
    } catch (error) {
      // Absence/refusal is evidence. Stop requesting; never force or find another policy.
      prerequisites.push(`Required fixed policy failed: ${String(error)}`);
    }
    // No outcome-dependent stop. Ordinary step invokes closeNight at 22:00 and
    // nightHours/evening settlement; its final minute can therefore exceed 22:00.
    while ((await observe()).phase === 'service' && (await observe()).minute < 1320) {
      try {
        await leaveGaps();
      } catch (error) {
        prerequisites.push(`Cover policy observation: ${String(error)}`);
      }
      if ((await observe()).phase === 'service') await minute();
    }
  }
  const recovered = restoreState(await snapshot());
  const comparison = prefix ? restoreState(cloneState(prefix)) : undefined;
  const comparisonLedger: { before: ReturnType<typeof financial>; after: ReturnType<typeof financial> }[] =
    [];
  function financial(s: GameState) {
    return {
      minute: s.minute,
      night: s.night,
      phase: s.phase,
      till: s.till,
      inputs: structuredClone(s.inputs),
      applied: s.applied,
      tickets: structuredClone(s.tickets),
      regulars: structuredClone(s.regulars),
      bookings: structuredClone(s.bookings ?? []),
      crew: structuredClone(s.crew),
      wagesDue: s.wagesDue,
      carry: s.carry,
      replacement: structuredClone(s.kitchen?.supply.replacement ?? null),
      request: structuredClone(s.request),
      reports: structuredClone(s.reports),
      costs: s.cooks.map((c) => ({
        id: c.id,
        gone: c.gone,
        night: structuredClone(c.night),
        trust: trustOf(personOf(s, c.id)),
      })),
    };
  }
  if (comparison)
    while (comparison.phase === 'service' && comparison.minute < 1320) {
      for (const decision of comparison.staffing ?? [])
        if (decision.state === 'asking')
          queueInput(comparison, { kind: 'staff', id: decision.id, cover: null });
      const before = financial(comparison);
      step(comparison); // Same actual producer; no duplicate simulation or state writes.
      comparisonLedger.push({ before, after: financial(comparison) });
    }
  const replayErrors: string[] = [];
  const arms = comparison ? [recovered, comparison] : [recovered];
  for (const [index, state] of arms.entries()) {
    // Attach complete native checkpoints/archives and inputs even when verification fails.
    const file = exportRun(state, '4.12.0');
    await testInfo.attach(`F-2502-arm-${index}-native`, {
      body: JSON.stringify(file),
      contentType: 'application/json',
    });
    for (const [label, verify] of [
      ['native restore', () => expect(cloneState(restoreState(file.state))).toEqual(cloneState(state))],
      [
        'full export host/native/HF/RNG replay',
        async () => expect(cloneState(await validateReplayFile(file))).toEqual(cloneState(state)),
      ],
      [
        'HF full archive',
        () => {
          const verified = verifyCommunity(state.chef);
          expect(verified.verified).toBe(true);
          expect(verified.fullHash).toBe(communityRun(state.chef).checkpoint().archive.hashes.full);
        },
      ],
    ] as const) {
      try {
        await verify();
      } catch (error) {
        replayErrors.push(`arm ${index} ${label}: ${String(error)}`);
      }
    }
  }
  const totals = (rows: { before: { till: number }; after: { till: number } }[]) => ({
    actualReceipts: rows.reduce((sum, r) => sum + Math.max(0, r.after.till - r.before.till), 0),
    actualDebits: rows.reduce((sum, r) => sum + Math.max(0, r.before.till - r.after.till), 0),
  });
  const recoveredTotals = totals(ledger);
  const comparisonTotals = totals(comparisonLedger);
  const losses = (state: GameState) => ({
    walked: state.tickets.filter((t) => t.status === 'walked'),
    servedOrders: state.tickets.filter((t) => t.status === 'served').length,
    jar: state.jar,
    jarSkimmed: state.jarSkimmed,
    carry: state.carry,
    lost: state.lost,
    wagesDue: state.wagesDue,
  });
  await testInfo.attach('F-2502-ordinary-input-witness', {
    body: JSON.stringify({
      seed: opening.seed,
      target,
      policy,
      prerequisites,
      replayErrors,
      horizon: 'Monday 22:00 authored close including ordinary closeNight/nightHours',
      priorObservation:
        '17:47 target paid only in recovery; actual till 40 versus 40; greater-cash gate FAILED; full replay/witness/UI unreached',
      prefix: prefix ? cloneState(prefix) : null,
      recovery: {
        ledger,
        totals: recoveredTotals,
        losses: losses(recovered),
        autonomousGuests: recovered.kitchen?.guests,
        final: financial(recovered),
      },
      noRecovery: {
        ledger: comparisonLedger,
        totals: comparisonTotals,
        losses: comparison ? losses(comparison) : null,
        autonomousGuests: comparison?.kitchen?.guests,
        final: comparison ? financial(comparison) : null,
      },
      presentation: { shownDuringCover, shortcutPresent, blockedShortcut, instruction, sameShortcutInputs },
    }),
    contentType: 'application/json',
  });
  // All required failures are asserted AFTER both available archives and the witness.
  expect(replayErrors, 'Complete replay of both available arms').toEqual([]);
  expect(prerequisites, 'Fixed-policy prerequisite; invalid prefix is INCONCLUSIVE, never UI RED').toEqual(
    [],
  );
  expect(prefix).toBeDefined();
  expect(comparison).toBeDefined();
  if (!prefix || !comparison || !target) throw new Error('INCONCLUSIVE: no valid matched scenario');
  expect(recovered.inputs.slice(0, prefix.inputs.length)).toEqual(prefix.inputs);
  expect(comparison.inputs.slice(0, prefix.inputs.length)).toEqual(prefix.inputs);
  expect(
    comparison.inputs.slice(prefix.inputs.length).every((i) => i.kind === 'staff' && i.cover === null),
  ).toBe(true);
  for (const state of arms) {
    expect(state.night).toBe(1);
    expect(state.phase).toBe('evening');
    expect(state.reports).toHaveLength(1);
    expect(state.reports[0]?.bill).toBeUndefined(); // settle only on Saturday, never Monday.
    expect(state.wagesDue).toBe(0); // Founders only; HF material earnings do not mutate host till.
    expect(state.cooks.find((c) => c.id === 'dilek')?.gone).toBe(true);
  }
  const proveReceipts = (
    rows: {
      before: Omit<ReturnType<typeof financial>, 'costs'>;
      after: Omit<ReturnType<typeof financial>, 'costs'>;
    }[],
  ) => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.at(-1)?.before.minute).toBe(1319); // close producer, not an invented phase change.
    for (const [index, { before, after }] of rows.entries()) {
      if (index) {
        expect(before.till).toBe(rows[index - 1]!.after.till);
        expect(before.minute).toBe(rows[index - 1]!.after.minute);
      }
      expect(Number.isFinite(before.till) && Number.isFinite(after.till)).toBe(true);
      expect(before.night).toBe(1);
      expect(before.phase).toBe('service');
      expect(before.bookings).toEqual([]); // No finishParty premium/regular-tab mutation.
      expect(after.bookings).toEqual([]);
      expect(before.tickets.every((t) => t.due === undefined)).toBe(true); // No wedding discount.
      expect(before.crew.every((m) => m.founder)).toBe(true);
      expect(before.wagesDue).toBe(0);
      expect(after.wagesDue).toBe(0);
      expect(before.replacement).toBeNull();
      expect(after.replacement).toBeNull();
      // Regard/visits may change ordinarily. Only tab state excludes old-debt payment.
      const tabs = (regulars: GameState['regulars']) =>
        Object.fromEntries(Object.entries(regulars).map(([id, r]) => [id, r.tab]));
      expect(tabs(before.regulars)).toEqual(tabs(opening.regulars));
      expect(tabs(after.regulars)).toEqual(tabs(opening.regulars));
      expect(Object.values(before.regulars).some((r) => r.tab === 'asked')).toBe(false);
      expect(before.inputs.every((i) => ['board', 'open', 'ask', 'staff'].includes(i.kind))).toBe(true);
      expect(after.inputs).toEqual(before.inputs);
      expect(after.carry).toBe(before.carry);
      // Excludes replacement and advance=yes (answer input), and every Sunday/cast action.
      expect(after.till).toBeGreaterThanOrEqual(before.till);
      const served = after.tickets.filter(
        (t) =>
          t.status === 'served' && before.tickets.find((prior) => prior.id === t.id)?.status !== 'served',
      );
      if (!served.length) expect(after.till).toBe(before.till);
      expect(after.reports.every((r) => r.bill === undefined)).toBe(true);
      if (after.phase === 'service') expect(after.minute).toBe(before.minute + 1);
      else expect(before.minute).toBe(1319);
    }
  };
  expect(opening.inputs).toEqual([
    { kind: 'board', rows: boardDefaults(opening), at: opening.minute },
    { kind: 'open', at: opening.minute },
  ]);
  expect(ledger.every((r) => r.after.departed)).toBe(true);
  expect(opening.till).toBe(0);
  expect(opening.tickets.every((t) => t.status === 'waiting')).toBe(true);
  expect(ledger[0]?.before.minute).toBe(opening.minute);
  expect(comparisonLedger[0]?.before.minute).toBe(prefix.minute);
  proveReceipts(ledger);
  proveReceipts(comparisonLedger);
  expect(recoveredTotals.actualDebits).toBe(0);
  expect(comparisonTotals.actualDebits).toBe(0);
  expect(recovered.till - opening.till).toBe(recoveredTotals.actualReceipts);
  expect(comparison.till - prefix.till).toBe(comparisonTotals.actualReceipts);
  expect(prefix.till).toBe(opening.till); // Identical prefix has no receipts omitted from comparator.
  const served = recovered.tickets.find((t) => t.id === target.id)!;
  expect(served.status, 'Actual target paid only in recovery').toBe('served');
  expect(served.doneCold).toBe(target.cold);
  expect(served.doneGrill).toBe(target.grill);
  expect(Number.isFinite(policy.grillAt)).toBe(true);
  expect(served.servedAt).toBeGreaterThan(Number(policy.grillAt) + 1);
  const payment = ledger.find((r) => r.newlyServed.includes(target.id));
  expect(served.regular).toBeUndefined(); // Fixed target is a cash table, not a tab.
  expect(payment?.newlyServed).toEqual([target.id]); // No other credit in this minute.
  expect(payment?.credit, 'Contemporaneous actual target till payment').toBe(target.price);
  expect(payment?.credit).toBeGreaterThan(0);
  expect(comparison.tickets.find((t) => t.id === target.id)?.status).not.toBe('served');
  expect(
    recoveredTotals.actualReceipts,
    'Strictly greater ACTUAL full-night service receipts',
  ).toBeGreaterThan(comparisonTotals.actualReceipts);
  expect(recovered.tickets.filter((t) => t.status === 'served').length).toBeGreaterThanOrEqual(
    comparison.tickets.filter((t) => t.status === 'served').length,
  );
  // Presentation RED only after physical policy, full replay, receipt coverage and outcomes pass.
  expect(shownDuringCover, 'F-2502 RED TARGET: persistent recovery block after departure').toBe(true);
  expect(shortcutPresent, 'F-2502 RED TARGET: ordinary remaining-cook job shortcut').toBe(true);
  expect(blockedShortcut, 'F-2502 RED TARGET: answer cover before using shortcut').toBe(true);
  expect(sameShortcutInputs, 'Choosing a cook sends no job request').toBe(true);
  for (const word of ['Dilek', 'Selim', 'cold side', 'grill', 'refuse']) expect(instruction).toContain(word);
});

test('F-2505 HOST-ONLY missing or ambiguous evidence keeps the actual recorded words', async ({ page }) => {
  const { state, line, guest, topic } = currentWaitControl(await freshCurrentControl(page));
  await loadCurrentControl(page, state);
  for (const fault of [
    'missing-guest',
    'other-cook',
    'other-time',
    'unaccepted',
    'duplicate-guest',
    'missing-ticket',
    'duplicate-ticket',
  ]) {
    await page.evaluate(
      async ({ fault, who, at, ticket }) => {
        const appPath = '/src/ui/app.ts';
        const { _debug } = await import(appPath);
        const s = _debug.state;
        // Host records only. Save originals on this test's page between variants.
        const fixture = window as typeof window & {
          f2505Host?: { guests: typeof s.kitchen.guests; tickets: typeof s.tickets };
        };
        fixture.f2505Host ??= structuredClone({ guests: s.kitchen.guests, tickets: s.tickets });
        s.kitchen.guests = structuredClone(fixture.f2505Host.guests);
        s.tickets = structuredClone(fixture.f2505Host.tickets);
        const match = s.kitchen.guests.find(
          (entry: { who: string; at: number }) => entry.who === who && entry.at === at,
        );
        if (!match) throw new Error('Missing real guest for labelled host-only fallback fixture');
        if (fault === 'missing-guest') s.kitchen.guests = [];
        if (fault === 'other-cook') match.who = who === 'selim' ? 'dilek' : 'selim';
        if (fault === 'other-time') match.at += 1;
        if (fault === 'unaccepted') {
          match.verdict = 'refused';
          match.outcome = 'unanswered';
        }
        if (fault === 'duplicate-guest') s.kitchen.guests.push(structuredClone(match));
        if (fault === 'missing-ticket')
          s.tickets = s.tickets.filter((entry: { id: number }) => entry.id !== ticket);
        if (fault === 'duplicate-ticket') {
          const original = s.tickets.find((entry: { id: number }) => entry.id === ticket);
          s.tickets.push({ ...original, table: 999 });
        }
        _debug.refresh();
      },
      { fault, who: guest.who, at: line.at, ticket: guest.ticket },
    );
    await expect(page.locator('#caption'), fault).toContainText(`“${waitWords}”`);
    await expect(page.locator('#caption'), fault).not.toContainText('In plain words:');
    await expect(page.locator('.journal'), fault).toContainText(`“${waitWords}”`);
    await page.locator(`[data-pick="${guest.who}"]`).click();
    await expect(page.locator('.panel-reply'), fault).toHaveText(
      `Said at ${timeOf(line.at)}: “${waitWords}”`,
    );
    // Missing guests remove the simulation's topic. Other fallback cases retain
    // the actual ID and raw words; the UI must never invent a replacement topic.
    if (fault !== 'missing-guest' && fault !== 'other-cook' && fault !== 'other-time')
      await expect(page.locator(`[data-heard-topic="${topic.id}"]`), fault).toContainText(`“${waitWords}”`);
    else await expect(page.locator(`[data-heard-topic="${topic.id}"]`), fault).toHaveCount(0);
    expect(
      await page.evaluate(async () => {
        const path = '/src/ui/app.ts';
        return (await import(path))._debug.state.said;
      }),
    ).toEqual(state.said);
  }
  // Restore the actual host records before leaving this page. Nothing from the
  // labelled fallback fixture becomes a saved or captured control.
  await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    const { _debug } = await import(path);
    const s = _debug.state;
    const fixture = window as typeof window & {
      f2505Host?: { guests: typeof s.kitchen.guests; tickets: typeof s.tickets };
    };
    if (!fixture.f2505Host) throw new Error('Missing host-only fixture backup');
    s.kitchen.guests = fixture.f2505Host.guests;
    s.tickets = fixture.f2505Host.tickets;
    delete fixture.f2505Host;
    _debug.refresh();
  });
});

// Each input method is exercised once; viewport geometry is covered above.
for (const mode of ['tap', 'hold', 'keyboard'] as const) {
  const width = mode === 'keyboard' ? 1280 : 360;
  test(`F-2505 ${mode} keeps the current request, trust, refusal and replay path at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 360 ? 690 : 800 });
    const state = await freshCurrentControl(page);
    queueInput(state, { kind: 'board', rows: boardDefaults(state) });
    queueInput(state, { kind: 'open' });
    await loadCurrentControl(page, state);
    await page.locator('[data-pick="selim"]').click();
    await expect(page.locator('.insist-choice')).toContainText('can cost their trust');
    await expect(page.locator('.insist-choice')).toContainText('can still say no');
    await expect(page.locator('#sheet .hint')).toContainText('Press and keep holding');
    if (mode === 'tap') {
      await page.locator('.insist-choice summary').tap();
      await page.locator('[data-insist="cold"]').tap();
    } else if (mode === 'keyboard') {
      await page.locator('.insist-choice summary').focus();
      await page.keyboard.press('Enter');
      await page.locator('[data-insist="cold"]').focus();
      await page.keyboard.press('Enter');
    } else {
      const job = page.locator('[data-v="cold"]');
      await job.scrollIntoViewIfNeeded();
      const box = await job.boundingBox();
      if (!box) throw new Error('Expected reachable cold-side hold control');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.clock.runFor(449);
      expect(
        await page.evaluate(async () => {
          const path = '/src/ui/app.ts';
          return (await import(path))._debug.state.inputs.filter(
            (input: { kind: string }) => input.kind === 'ask',
          ).length;
        }),
      ).toBe(0);
      await page.clock.runFor(1);
      await page.mouse.up();
    }
    const actual = await page.evaluate(async () => {
      const appPath = '/src/ui/app.ts';
      const simPath = '/src/sim/kitchen.ts';
      const { _debug } = await import(appPath);
      const { cloneState, personOf, step, trustOf } = await import(simPath);
      const s = _debug.state;
      const asks = s.inputs.filter((input: { kind: string }) => input.kind === 'ask');
      step(s);
      _debug.draw();
      return { asks, answer: s.lastAnswer, trust: trustOf(personOf(s, 'selim')), state: cloneState(s) };
    });
    expect(actual.asks).toEqual([
      { at: state.minute, kind: 'ask', cook: 'selim', verb: 'cold', insist: true },
    ]);
    // Compare with the unchanged direct ordinary input, including its actual
    // refusal/defer/compliance verdict and trust. No promised yes is imposed.
    queueInput(state, { kind: 'ask', cook: 'selim', verb: 'cold', insist: true });
    step(state);
    expect(actual.answer).toEqual(state.lastAnswer);
    expect(actual.trust).toBe(trustOf(personOf(state, 'selim')));
    expect(actual.state).toEqual(cloneState(state));
    expect(
      cloneState(
        replay(
          state.seed,
          state.inputs,
          state.minute,
          state.version,
          state.castChapter,
          state.plainNarration,
        ),
      ),
    ).toEqual(actual.state);
  });
}

// One opening-board journey. The fixture is an actual current producer export;
// every changed plan and answer below comes through the rendered editor.
test('F-2507 current draft intervals, rush and cover answers stay truthful in the rendered board', async ({
  page,
}) => {
  const opening = await freshCurrentControl(page);
  expect(opening.version).toBe('pass@20');
  expect(opening.phase).toBe('board');
  expect(opening.seed).toBe(42);
  // The existing service loader waits for #clock. A board has no #clock, so
  // use its same producer/export/chooser path and assert the actual board instead.
  const file = await page.evaluate(
    ({ inputs, minute }) => {
      const fixture = window as CurrentControlPage;
      if (!fixture.f2505Export) throw new Error('Missing actual current producer');
      const file = fixture.f2505Export(inputs, minute);
      delete fixture.f2505Export;
      return file;
    },
    { inputs: opening.inputs, minute: opening.minute },
  );
  if (!file) throw new Error('Current producer refused its opening export');
  expect(file.state).toEqual(cloneState(opening));
  await page.locator('#game-menu').click();
  await page.locator('.debug-tools summary').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#debug-import').click();
  await (await chooser).setFiles({
    name: 'current-opening-board.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await page.locator('#title-confirm-yes').click();
  await expect(page.locator('.people-board')).toBeVisible();
  const card = (cook: string) => page.locator(`.board-row[data-board-cook="${cook}"]`);
  const editor = page.locator('.board-editor');
  const edit = async (cook: string) => card(cook).locator('.board-change').click();
  const choose = async (field: string, value: string) =>
    editor.locator(`[data-field="${field}"][data-value="${value}"]`).click();
  const read = (): Promise<GameState> =>
    page.evaluate(async () => {
      const path = '/src/ui/app.ts';
      const simPath = '/src/sim/kitchen.ts';
      return (await import(simPath)).cloneState((await import(path))._debug.state);
    });
  expect(await read()).toEqual(cloneState(opening));
  // CAUSAL RED: the current editor renders a gap sentence without this interval.
  // No proposed helper is imported by this test.
  await edit('dilek');
  await choose('break', '1185');
  await expect(editor.locator('.board-gap')).toContainText(
    'Dilek’s planned meal break is 19:45–20:05 at the cold side.',
  );
  await page.locator('#board-done').click();
  for (const [cook, name, station] of [
    ['selim', 'Selim', 'grill'],
    ['dilek', 'Dilek', 'cold side'],
  ]) {
    await edit(cook!);
    for (const [minute, interval, overlap] of [
      ['1090', '18:10–18:30', false],
      ['1115', '18:35–18:55', true],
      ['1185', '19:45–20:05', true],
      ['1260', '21:00–21:20', false],
    ] as const) {
      await choose('break', minute);
      await expect(editor.locator(`[data-field="break"][data-value="${minute}"]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(editor.locator('.board-gap')).toContainText(
        `${name}’s planned meal break is ${interval} at the ${station}.`,
      );
      await expect(card(cook!).locator('.board-summary')).toContainText(interval);
      if (overlap) {
        const warning = `${name}’s planned meal break (${interval}) overlaps the rush (18:30–20:30) at the ${station}.`;
        await expect(editor.locator('.board-rush')).toHaveText(warning);
        await expect(card(cook!).locator('.board-rush')).toHaveText(warning);
      } else {
        await expect(editor.locator('.board-rush')).toHaveCount(0);
        await expect(card(cook!).locator('.board-rush')).toHaveCount(0);
      }
    }
    await page.locator('#board-done').click();
  }
  // The draft did not change the actual board, inputs or native state.
  expect(await read()).toEqual(cloneState(opening));
  // The fixed public plan asks for relief; its actual refusal stays a refusal.
  await edit('dilek');
  await choose('break', '1185');
  await page.locator('#board-done').click();
  await edit('selim');
  await choose('break', '1090');
  await choose('cover', 'dilek');
  await expect(editor.locator('.board-gap')).toContainText(
    'You will ask Dilek to cover the grill for this interval. Cover is not agreed.',
  );
  await expect(card('selim').locator('.board-summary')).not.toContainText('Dilek agreed');
  await page.locator('#board-done').click();
  await page.locator('#ask-board').click();
  const accepted = await read();
  const selim = accepted.board?.rows.find((row) => row.cook === 'selim');
  // Require the actual station assent and distinct relief refusal; do not set either field.
  expect(selim?.accepted, 'fixed fixture requires the real station assent').toBe(true);
  expect(selim?.coverAccepted, 'the fixed public plan records actual relief refusal').toBe(false);
  await expect(card('selim').locator('.board-summary')).toContainText(
    'Dilek did not agree to cover the grill for this interval.',
  );
  await edit('selim');
  await expect(editor.locator('.board-gap')).toContainText(
    'Dilek did not agree to cover the grill for this interval.',
  );
  await page.locator('#board-done').click();
  // Keep the selected cover while moving its own break into collision.
  await edit('dilek');
  await choose('break', '1090');
  await page.locator('#board-done').click();
  await edit('selim');
  await expect(editor.locator('.board-gap')).toContainText('Cover is not agreed.');
  await expect(editor.locator('.board-gap')).not.toContainText('Dilek agreed');
  await page.locator('#board-done').click();
  await page.locator('#ask-board').click();
  const refused = await read();
  expect(refused.board?.rows.find((row) => row.cook === 'selim')?.coverAccepted).toBe(false);
  await expect(card('selim').locator('.board-summary')).toContainText(
    'Dilek did not agree to cover the grill for this interval.',
  );
  await edit('selim');
  await expect(editor.locator('.board-gap')).toContainText(
    'Dilek did not agree to cover the grill for this interval.',
  );
  await page.locator('#board-done').click();
  // A second worker on the same station in the proposed plan is not an empty station.
  await edit('dilek');
  await choose('station', 'grill');
  await choose('break', '1260');
  await page.locator('#board-done').click();
  await edit('selim');
  await choose('cover', '');
  await choose('break', '1185');
  await expect(editor.locator('.board-gap')).toContainText(
    'In this proposed plan, Dilek is also assigned to the grill throughout this interval.',
  );
  await expect(editor.locator('.board-gap')).not.toContainText('Nobody will work');
  await expect(card('selim').locator('.board-summary')).toContainText('Dilek is also assigned to the grill');
  await expect(card('selim').locator('.board-summary')).not.toContainText('Nobody will work');
  await page.locator('#board-done').click();
  // Reading and editing preserve the refused native answer until another submission.
  expect(await read()).toEqual(refused);
  const final = restoreState(await read());
  expect(
    cloneState(
      replay(final.seed, final.inputs, final.minute, final.version, final.castChapter, final.plainNarration),
    ),
  ).toEqual(cloneState(final));
  expect(verifyCommunity(final.chef).verified).toBe(true);
});
