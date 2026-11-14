/**
 * Page-level actions for the tester driver, shared by the local lab:play server and the Worker cron.
 * It needs only this structural Playwright subset, so either Playwright build can supply the page.
 * It exposes no hidden state, arbitrary evaluation or network inspection.
 */
import { namedTapRoles, type PlayOp } from './play-helpers.ts';
import { textControlPoint } from './play-text.ts';

export interface Locator {
  first(): Locator;
  nth(index: number): Locator;
  or(other: Locator): Locator;
  isEnabled(): Promise<boolean>;
  filter(options: { visible: boolean }): Locator;
  count(): Promise<number>;
  click(options: { timeout: number }): Promise<void>;
  fill(text: string, options: { timeout: number }): Promise<void>;
  selectOption(option: { label: string } | { value: string }, options: { timeout: number }): Promise<unknown>;
  innerText(options: { timeout: number }): Promise<string>;
  ariaSnapshot(options: { timeout: number }): Promise<string>;
  scrollIntoViewIfNeeded(options: { timeout: number }): Promise<void>;
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
  evaluate<T, A>(fn: (el: Element, arg: A) => T, arg: A): Promise<T>;
}
export interface Page {
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<unknown>;
  locator(selector: string): Locator;
  getByRole(role: string, options: { name: string | RegExp; exact?: boolean }): Locator;
  getByLabel(name: string, options: { exact: boolean }): Locator;
  getByText(text: string, options: { exact: boolean }): Locator;
  evaluate<T, A>(fn: (arg: A) => T, arg: A): Promise<T>;
  /** Without a path the bytes are returned; the Worker stores them itself. */
  screenshot(options: { path?: string; fullPage: boolean; timeout: number }): Promise<unknown>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  viewportSize(): { width: number; height: number };
  mouse: {
    click(x: number, y: number): Promise<void>;
    move(x: number, y: number): Promise<void>;
    wheel(dx: number, dy: number): Promise<void>;
  };
  touchscreen: { tap(x: number, y: number): Promise<void> };
  keyboard: { press(key: string): Promise<void>; insertText(text: string): Promise<void> };
}
const visible = (locator: Locator) => locator.filter({ visible: true }).first();
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// An on-screen point where the element (or the container it sits in) receives the tap, or null
// when something else covers it.
function uncoveredPoint(el: Element, centre: boolean): { x: number; y: number } | null {
  if (el.matches(':disabled, [aria-disabled="true"]') || el.closest('[aria-disabled="true"]')) return null;
  if (centre) el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const box = el.getBoundingClientRect();
  for (const fy of [0.5, 0.3, 0.7, 0.15, 0.85])
    for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const x = box.left + box.width * fx;
      const y = box.top + box.height * fy;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      // An ancestor counts too: scene cards may pass taps to a delegating parent.
      if (hit && (hit === el || el.contains(hit) || hit.contains(el))) return { x, y };
    }
  return null;
}

function scrollPanel(arg: { x: number; y: number; dy: number; previous?: number[] }): number[] {
  const panels: Element[] = [];
  for (let element = document.elementFromPoint(arg.x, arg.y); element; element = element.parentElement) {
    if (
      /(auto|scroll)/.test(getComputedStyle(element).overflowY) &&
      element.scrollHeight > element.clientHeight
    )
      panels.push(element);
  }
  if (document.scrollingElement && !panels.includes(document.scrollingElement))
    panels.push(document.scrollingElement);
  if (arg.previous && panels.every((panel, i) => panel.scrollTop === arg.previous?.[i])) {
    const panel = panels.find((p) =>
      arg.dy > 0 ? p.scrollTop + p.clientHeight < p.scrollHeight : p.scrollTop > 0,
    );
    panel?.scrollBy({ top: arg.dy, behavior: 'instant' });
  }
  return panels.map((panel) => panel.scrollTop);
}
export interface PageActorOptions {
  phone: boolean;
  url: string;
  /** True once the first open has started the session clock. */
  opened(): boolean;
  startClock(): void;
  /** Stores a viewport screenshot and returns where it was stored. */
  screenshot(file: string): Promise<string>;
}
/** Returns the one function that performs a validated operation on the page. */
export function pageActor(page: Page, o: PageActorOptions): (op: PlayOp) => Promise<string | undefined> {
  const click = async (locator: Locator) => {
    const target = locator;
    if (!(await target.count()) || !(await target.isEnabled())) return false;
    try {
      await target.click({ timeout: 1500 });
      return true;
    } catch {
      // A moving or partly covered control (re-laid-out scene cards, a sticky footer) fails
      // Playwright's stability check. Tap an uncovered point of it instead, centring it first.
      for (const centre of [false, true]) {
        const point = await target.evaluate(uncoveredPoint, centre);
        if (point) {
          await tapPoint(point.x, point.y);
          return true;
        }
      }
      return false;
    }
  };
  const tapPoint = async (x: number, y: number) => {
    if (o.phone) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  };
  const act = async (op: PlayOp): Promise<string | undefined> => {
    switch (op.op) {
      case 'open':
        if (o.opened()) throw new Error('Already opened; the session clock cannot be reset');
        o.startClock();
        await page.goto(o.url, { waitUntil: 'load', timeout: 30_000 });
        break;
      case 'tap':
        if ('x' in op && typeof op.x === 'number' && typeof op.y === 'number') await tapPoint(op.x, op.y);
        else if ('name' in op && typeof op.name === 'string') {
          const roles = op.role ? [op.role] : namedTapRoles;
          let matches = page.getByRole(roles[0] ?? 'button', { name: op.name, exact: true });
          for (const role of roles.slice(1))
            matches = matches.or(page.getByRole(role, { name: op.name, exact: true }));
          matches = matches.filter({ visible: true });
          const enabled: Locator[] = [];
          const count = await matches.count();
          for (let i = 0; i < count; i++) {
            const target = matches.nth(i);
            if (await target.isEnabled()) enabled.push(target);
          }
          if (!count)
            throw new Error(
              `${op.name} left the page just before the tap (game state, not a driver failure)`,
            );
          if (!enabled.length)
            throw new Error(`${op.name} is shown but disabled right now (game state, not a driver failure)`);
          if (enabled.length > 1) {
            const points = await Promise.all(
              enabled.map(async (target) => {
                const box = await target.boundingBox();
                return box
                  ? `(${Math.round(box.x + box.width / 2)},${Math.round(box.y + box.height / 2)})`
                  : '(unavailable)';
              }),
            );
            throw new Error(
              `${enabled.length} enabled controls are named ${op.name}; tap one by point: ${points.join(', ')} (game state, not a driver failure)`,
            );
          }
          if (!enabled[0] || !(await click(enabled[0])))
            throw new Error(
              `Cannot tap ${op.name}: control is covered or off screen; close the covering panel or scroll, then retry (game state, not a driver failure)`,
            );
        } else if ('text' in op && typeof op.text === 'string') {
          const point = await page.evaluate(textControlPoint, op.text);
          if ('reason' in point) {
            if (point.reason === 'disabled')
              throw new Error(
                `${op.text} is shown but disabled right now (game state, not a driver failure)`,
              );
            const why: Record<string, string> = {
              'not found': 'is not on the page now (game state, not a driver failure)',
              'covered by another element':
                'is covered by another element on the page; deal with what covers it or tap by point (game state, not a driver failure)',
            };
            throw new Error(
              `${op.text} ${
                why[point.reason] ??
                (point.reason.endsWith('controls match')
                  ? `matches ${point.reason.split(' ')[0]} controls; tap by point from a screenshot (ambiguous target, not a driver failure)`
                  : `could not be tapped: ${point.reason} (driver failure)`)
              }`,
            );
          }
          await tapPoint(point.x, point.y);
        }
        break;
      case 'select': {
        let target = visible(
          'label' in op && typeof op.label === 'string'
            ? page.getByLabel(op.label, { exact: true })
            : page.getByRole('combobox', { name: op.name ?? '', exact: true }),
        );
        if (!('label' in op) && !(await target.count()))
          target = visible(page.getByRole('listbox', { name: op.name ?? '', exact: true }));
        try {
          await target.selectOption({ label: op.option }, { timeout: 1500 });
        } catch {
          await target.selectOption({ value: op.option }, { timeout: 1500 });
        }
        break;
      }
      case 'type':
        if (op.name !== undefined)
          await visible(page.getByRole('textbox', { name: op.name, exact: true })).fill(op.text, {
            timeout: 5000,
          });
        else await page.keyboard.insertText(op.text);
        break;
      case 'scroll': {
        const viewport = page.viewportSize();
        let x = op.x ?? viewport.width / 2;
        let y = op.y ?? viewport.height / 2;
        if (op.text !== undefined) {
          const target = visible(page.getByText(op.text, { exact: true }));
          await target.scrollIntoViewIfNeeded({ timeout: 5000 });
          const box = await target.boundingBox();
          if (!box) throw new Error(`No visible scroll target: ${op.text}`);
          x = Math.max(1, Math.min(viewport.width - 1, box.x + box.width / 2));
          y = Math.max(1, Math.min(viewport.height - 1, box.y + box.height / 2));
        }
        const previous = await page.evaluate(scrollPanel, { x, y, dy: op.dy });
        await page.mouse.move(x, y);
        await page.mouse.wheel(0, op.dy);
        await sleep(150);
        await page.evaluate(scrollPanel, { x, y, dy: op.dy, previous });
        break;
      }
      case 'key':
        await page.keyboard.press(op.key);
        break;
      case 'wait':
        await sleep(op.s * 1000);
        break;
      case 'shot':
        return o.screenshot(op.file);
      case 'resize':
        await page.setViewportSize({ width: op.width, height: op.height });
        break;
      case 'log':
        break;
    }
    return undefined;
  };
  return act;
}
