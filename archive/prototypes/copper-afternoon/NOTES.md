# Copper Afternoon

A static, six-minute repair bench prototype. Open `index.html` through a static file server. There is no build, install, account, save, recording, analytics, service worker, external asset, or runtime API request. `hf.js` is the supplied HF 4.17.0 bundle, left unchanged. Modules load from the same directory. Browser file-URL module restrictions may require serving the directory.

## Built

- Actual first repair: open the cart axle cap, take pliers, remove a bent pin, fit the straight pin, and roll-test it. The opening has no text. One contextual instruction appears after input, beside the work or tool.
- Bell cutaway: move a spacer between the bell base and the striker mount. The spacer lifts the corresponding assembly. Test it to see a stopped strike or a moving, ringing bell. Neither destination is marked correct.
- Wind-up lamp: fit the asymmetric coupling, turn it, tighten it, and crank-test it. A loose test breaks the coupling permanently. A reversed coupling blocks the gears.
- One physical coupling for the bell or lamp. Unfastening and removal cost visible operations. Disassembly invalidates previous test evidence. A returned object and its parts are no longer available.
- Ochre Canvas drawings, loose screws and removed parts left on the bench, lifted drag shadows, eased part movement, turning tools, wobbling wheels, animated tests, snap sounds, synthesized bell partials, thuds, and damage sound. WebAudio is created by the first input.
- Pointer drag and tap-select/tap-destination. Installed parts can also be pulled with a tool tap and a part tap. The curved arrow turns the current object or loose lamp coupling; triangles test. Desktop keyboard: 1/2/3 select objects, O opens, P selects pliers, W selects wrench, R turns, T tests, arrows/Tab select hotspots, Enter activates, Escape pauses. Pause offers slow time (eight minutes instead of six). Backgrounding pauses all simulation clocks.
- Rafi can hold the axle for thirty seconds or decline because of his competing parts commitment. His real HF selection changes whether the clamp socket is available for another object. He warns and safely releases; interrupted work causes no hidden damage.
- Aylin returns at 240 simulation seconds, sees and receives actual repair/test/damage facts, and chooses through HF whether to wait or take an object. She receives an admission only when present. Tap her contact silhouette before return to make the bell promise. Her return allows eight seconds before the first automatic request. Successful return, missed promise, unrepaired return, and a broken part produce distinct outcomes. The bench closes at 360 seconds.

## HF implementation and boundaries

`people.js` uses the real `createRun`, `createPerson`, `step`, and `inspect` APIs. Offers, `suggestion.received`, `decision.requested`, and admitted action resolutions drive agree/refuse/wait/take. `observation.received` supplies witnessed or told facts. `voice.promise-received` is the closest supported public mechanism for the player's kept/broken word: the player is an advising voice, not a simulated person with an HF agenda. The host checks the actual bell and valid test at the return deadline, then delivers that fact. No parallel trust or forgiveness score is used.

A matched control gives Aylin identical later repaired-bell geometry and the same request. An actual received kept-promise receipt yields wait; a broken-promise receipt yields take (seed 7). This demonstrates the supported receipt mechanism, not empirical human validity. Repair usefulness is explicitly authored as six HF material units, not a calibrated measure.

Profiles, ages, traits, values, cast IDs, and biography text are copied from the canonical revision 1 cast source in `human-framework/packages/lab-client/src/cast.ts`. Workshop appointments are local authored premises. No registry or passport is written. Sam receives actual test observations; his brief acknowledgement is authored presentation of that result. Autonomous reporting or certification is not implemented. The gratitude line after an admission is an authored acknowledgement, not a claim of HF forgiveness.

## Not built

The requested omissions remain omitted: cast registration/admission, replay download, lab client, full keyboard traversal/accessibility, and synthetic panel. Also absent: freeform assembly, undo after damage or return, a second afternoon, saved sessions, and independent Sam tool logistics. The simulation is fixed-step and seeded; render-only particles use visual randomness. There are no paid assets.

## Verification

Run from this directory:

```
node bots.mjs
node client-smoke.mjs
node --check main.js
node --check sim.js
node --check people.js
```

`bots.mjs` imports the simulation in Node, plays six semantic policies through the full 360 seconds, and prints actual endings and HF decisions. It verifies repaired, unrepaired, and broken endings; wrong spacer and reversed coupling failures; repair recovery; one coupling; release of the clamp; actual HF acceptance/refusal; the matched received-memory control; seed determinism; and review regressions for stale test evidence, departed parts, unrepaired return, and a promise made after a valid test.

`client-smoke.mjs` loads the actual client module body in a Node DOM/Canvas/WebAudio shim at 375x812 and 1280x900. It exercises the initial no-text/no-audio frame, input audio unlock, the whole cart tap path, coupling drag, both spacer states, the bell tap repair, pause/resume, and the twelve-word budget during that path. This verifies client logic and coordinate mapping, not real browser painting, touch dispatch, or audible sound.

Two independent read-only reviews found stale test evidence, returned parts remaining usable, an unrepaired departure that removed nothing, a pre-existing valid test wrongly counted as a broken promise, and unclear spacer/rotation drawings. These were corrected. Targeted headless regressions pass.

Real browser and device verification could not run: the sandbox refused the local HTTP listener, the Playwright connection required approval unavailable in this session, and a separate headless Chrome process aborted under the sandbox. No existing personal Chrome session was touched. Real phone audio, visual composition, drag feel, browser compatibility, and six-minute human pacing remain unverified. No game acceptance or fun claim is made by the bots. No commit or push was run.

## Three things most likely to feel bad

1. A quick solver may finish the mechanical work well before Aylin returns. The quiet remainder may feel like waiting rather than anticipation.
2. The bell clearance and lamp coupling orientation may still be hard to infer at phone size. The failed tests must carry most of the explanation.
3. Tool selection, timed operations, and the visitors' contact silhouettes may feel indirect. The motion and sound need a real finger-and-ear check; the Node shim cannot judge them.

## 2026-11-22: first outside play notes

One tester played the 2026-11-22 build on a phone and gave spoken notes, passed on by the owner. The tester could not tell what to drag or tap, tapped many times with no response, could not see the yellow outlines, did not understand the instructions, and could not tell whether a repair had worked. They preferred Lantern.

| Note | Done in this change | Left as a proposal |
| --- | --- | --- |
| No title, menu or tutorial | Start card with the name, the goal and how the guide works | |
| What do I tap or drag, and where | A guide line under the bench names the next tap in plain words, and a blue ring marks that spot, through the cart, the bell and the lamp | A hands-off demonstration; letting the guide fade once the cart is done |
| Tapped twenty times, nothing happened | Hand work takes half as long; a tap during work says "Still working" and the progress bar is larger; a pull without pliers says so | Removing timed work altogether |
| Yellow outlines on a yellow cloth | Sockets, slots, loose-screw marks and selection rings are blue on white | |
| Jargon ("Free the cart clamp first", "Fit the matching socket") | Rewritten; the clamp rule now says "Fix the cart first" | Dropping the clamp rule |
| Did it work or not | "It works!" or "Not working yet." after every test | |
| The finger hides the part being dragged | A dragged part rides above the finger and drops where the part is | |
| Long idle wait | Once a repair is ready and nothing is touched for four seconds, the clock runs eight times faster until Aylin returns | A shorter afternoon |

The guide solves the bell spacer after one failed test and the lamp direction before any test. That trades the puzzle for clarity, on purpose, for this round. The earlier rules "no text before input" and the twelve-word budget are dropped; `client-smoke.mjs` now expects the start card and the guide.

Checked: `bots.mjs` passes (one timing constant in the clamp test changed with the faster work); `client-smoke.mjs` passes; in a Chromium phone profile, tapping only where the blue ring points fixed the cart and the bell in 18 taps with no page errors. Not verified: a person following the guide, the lamp path in a browser, real-phone drag feel and sound.

## 2026-11-22: tester t1's answer (notes #32, #33)

- With the blue ring and guide line, could you fix the cart? "Yes, it was easy" (#32).
- Tester t1 suggests dropping Copper Afternoon and The Long Road to focus on Lantern and Ant Promotion (#33). Recorded as a proposal in `prototypes/NOTES.md`; nothing is removed.
