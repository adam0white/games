# Current episode edition — 2026-11-05

The current candidate uses published HF 4.17.0 and game edition 6. It retains five playable chapters at ages 3, 6, 10, 14 and 18. The intervening 180 fictional months are explicit time skips. Each chapter starts a fresh native Run with authored ages and one new demonstration by the chosen living companion. Food, repairs, water, route knowledge, yearbook and recorded deaths carry as host facts. Native memory, body continuity and offscreen daily care do not carry through the skipped years. Recorded deaths are reasserted through public lifecycle inputs; a dead teacher cannot return to teach. On-screen decisions, work and failures still use HF.

Download includes every visited episode's complete native archive plus the seed, ordered player inputs and complete host state. Import verifies all native archives, reconstructs all chapters and requires exact complete export equality. Old saves need a fresh upbringing. The original continuous fifteen-year simulation and its 36-month/180-month/2-second budgets remain unqualified historical work. This episode edition does not pass or claim those budgets. Exact source CI, hosted review and deployment remain pending.

Stack: Node 26.12.0, pnpm 12.16.1, TypeScript 7.0.2, Vitest 5.1.0, Biome 2.6.5, Wrangler 4.157.0. Use frozen installs and the 1440-minute release-age policy. The monorepo uses published lab client 0.5.17 and kit 0.5.34, and one game engine at HF 4.17.0. Historical fixtures remain unchanged. The /child/file/ view opens an export without native storage or Lab access.

## Historical design and release evidence

# What the Child Saw

The HF 4.16.3 candidate is uncommitted and unqualified. The focused contract suite passed all 16 cases; the required full lane was interrupted. The original 36-month, 180-month, 2,000 ms and public-save gates remain open. See [status and pending checks](docs/hf4151-port-status.md). Descriptions of the released HF3 game below are historical release evidence.

You are Zehra. Elif learns through the work she sees. Choose whose work she watches, pay its cost, and prepare her for five days when she must act alone. At eighteen, get water to every waiting household.

[Play](https://child.adamwhite.work) · [Design](docs/design.md) · [Independent review](docs/review.md)

## How to play

The game opens at age three, or resumes this browser's saved run. You play Zehra, Elif's mother. There is no Start button. If the recording notice appears, **Continue** dismisses it.

Each age has three preparations. Choose an adult for Elif to watch, or work to restore household supplies:

| Control                | Example and cost                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| **Go with Maryam**     | Count before sharing. Maryam leaves meal work undone; food stores fall.                      |
| **Go with Yusuf**      | Check a path first. Field work is left undone; food falls, but the route becomes known.      |
| **Go with Danyal**     | Wait for the keeper. Well repairs are delayed.                                               |
| **Stay home with you** | Keep a jar for home and refuse another request. Staying home uses food stores.               |
| **Work in the field**  | Food stores recover and you mend the well rope. Elif stays home without watching a new task. |

Read the coming conditions before each preparation. After three preparations, choose **Let her go**. Watch Elif move; her explanation and the cost appear automatically. You observe her crisis choice rather than select it.

At ages three, six, ten and fourteen, her goals are to keep an evening jar, bring water home, keep a queue place and share the winter store. The household starts with two emergency household shares. Each shortfall spends one, down to zero, and the run continues. Ordinary daily supplies do not refill this store. Food and well condition also carry forward. Success also has costs, such as thin meals, delayed repairs or neighbours waiting.

After each of these crises, choose **Keep working with Maryam**, **Yusuf**, **Danyal** or **you**. One task with that companion stays with her through the intervening years. The next three lived lessons can change what she does. Counting and refusing reduce food recovery; checking paths reduces it less; waiting reduces repair recovery.

At eighteen, win by bringing water to every waiting household by night. The last deliveries need one emergency household share while carriers return; if earlier shortfalls emptied the store, the last households go without even when her final practice fits. Failure leaves the last households without water. Choose **Close this page** to reach the ending and yearbook; it does not close the browser tab. **Begin again** starts a new upbringing.

**Menu** pauses the reveal. **Resume** continues it. The menu also offers **Feedback**, **Recording: on/off**, **Full screen**, **All games** and **New game** with confirmation. Ordinary play saves locally when browser storage works. Reopening the game continues that saved run. Iteration 4 uses replay edition 3; edition 1 and 2 exports require their original releases, and an old local save starts a new upbringing with a visible notice.

## What HF demonstrates

HF3.2.0 holds Elif's acquired methods and chooses among available actions. The game supplies witnessed examples through `demonstrateMethod`, supplies situation cues through `receiveMethodCues`, and calls `decide` for the crisis. Counting, checking, waiting and refusing fit different situations, but the cues are what a child sees, so she uses the way she has watched most. Two ways watched equally often leave her undecided.

The game authors the settlement conditions, offered actions, goals, costs and success rules. Seed and earlier settlement outcomes affect those conditions. This is a bounded demonstration of acquired methods and cue-based choices, not evidence that the model explains general human learning. This run uses its own authored cast branch; it does not continue people from other games. Player and owner acceptance remain pending.

## Recording and Feedback

The SDK attempts to record and link play on this device while Recording is on. Shared recording identity depends on browser storage, frame access and origin rules; it is not a cross-device identity or a shared character history. The lab persona origin list is a separate configuration.

Feedback offers **I'm stopping** and **I'm confused**. Choosing one sends nothing until **Submit**. Upload attempts and queued records do not prove storage. Only **Sent** or a stored receipt confirms storage.

Central delivery remains pending: the deployed central `00d` build rejects new `child` registration until the coordinator deploys the listing after Voice. Listing source `9b05e3` passed exact CI run `40281412400`; source availability and green CI do not prove deployment or successful recording delivery.

## Develop

Node26.12.0 and pnpm12.14.0. `pnpm install --frozen-lockfile`, then `pnpm dev`.

`pnpm check:lane` runs lint, strict typecheck, headless tests, Chromium and WebKit browser tests, and the production build. `pnpm e2e` checks both browsers at 360×690 and 1280×800. Install their runtimes with `pnpm exec playwright install chromium webkit` when needed.

The released HF3 game used the published HF3.2.0 package. Game code owns settlement resources and consequences. No framework source is vendored. The HF4 candidate pins lab-client 0.5.8 and lab-kit 0.5.25 release assets. The game and current lab-client resolve to the same HF 4.16.3 installation.

Menu offers replay export/import and Other ways to begin → Begin at age six. The separate age-six day leaves the saved upbringing untouched. New game starts a full upbringing. Debug, initially collapsed beside Lab privacy, offers the Canvas2D diagnostic renderer. Ordinary play saves on this device. Feedback and Recording are in Menu.

`node scripts/measure.mjs` serves compressed build assets and measures ready time at360×690, 562ms latency, 180KB/s and4× CPU slowdown. The initial split build measured5.06s; a single startup bundle measured3.77s. This chooses fewer loading round trips at the cost of a larger download (about360KB gzip).

Deploy only after GitHub Actions is green on the exact signed commit. Build from a clean checkout, verify `dist/release.json` has that commit and `dirty:false`, then use `npx wrangler deploy`. Verify both the game and its live `/release.json`. The central listing is published separately by the coordinator.

MIT code. The figures are drawn in code; every word is in the DOM.

Automatic shared-person carryover remains incomplete. Child has no reciprocal native passport contract in the central shelf or receiving games; its teachers are authored roles without portable HF state. Keep their histories untouched. Follow-up: 2026-10-28, define reciprocal Child contracts before connecting shelf heads.
