// One "now" for a phone-check run, shared by the saves a check seeds and the pages it opens, so a check that seeds
// "today's" daily result cannot fail because midnight UTC passed between the two (Node used to take the day when the
// check module loaded, the page when it loaded, minutes later).
//   CHECK_NOW=2026-11-24T23:59:58Z node experiments/kit/check/phone.mjs flock   run as if it were that moment
// Without CHECK_NOW it is the moment the run started. A registration with `clock: true` has its pages' Date pinned to
// it (Playwright's clock.setFixedTime: Date.now() and new Date() stand still; timers, animation frames and
// performance.now() run as usual).
export const CHECK_NOW = (() => { const t = Date.parse(process.env.CHECK_NOW ?? ''); return Number.isFinite(t) ? t : Date.now(); })();
export const checkDay = new Date(CHECK_NOW).toISOString().slice(0, 10);
export const pinClock = page => page.clock.setFixedTime(CHECK_NOW);
