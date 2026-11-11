# Independent Codex review — 2026-10-26

A fresh Codex reviewer read the design, model, UI, recording adapter and tests without changing them. The reviewer had not implemented any part of this game.

Three blockers were verified and fixed:

- Importing a movement-phase export could remain on “Watch Elif.” The importer now clears stale timers and schedules the imported movement's reveal. Browser regression exports that exact phase and imports it after reload.
- The last preparation could change the queue condition after disclosure. The seeded variant now belongs to the chapter-entry conditions and stays fixed through preparation, cue reception and outcomes. A headless regression checks the last preparation preserves the disclosed conditions.
- A cached Back navigation could restore a destroyed canvas. Persisted pagehide now pauses the timer without destroying the renderer. Persisted pageshow draws and resumes movement when the menu is closed. Browser regression checks the retained canvas.

No additional blockers were found in HF ownership, monthly advancement, situational cue matching, alternative successful approaches or exact replay. This review is source inspection plus a reproduced model control; it is not a human taste verdict. The lab-panel round remains pending.


## Iteration 2 independent Codex review

Two read-only Codex reviewers examined model correctness and presentation separately. Both used GPT-6.1 Sol; the model reviewer used medium effort and the presentation reviewer used low effort. They did not implement the game.

Verified and fixed findings:

- Yearbook prose could invent a lesson detail based only on action and age. The model now stores the actual witnessed task for each practice, and each memory includes its result.
- Changed replay semantics still used edition 1. Exports now use edition 2, so old exports are explicitly identified as requiring the original version. Existing local-save recovery visibly starts a new upbringing.
- Chapter-entry food and rope snapshots needed clearer words. Conditions now say food was set aside, or meals were missed, before these lessons. An exhausted rope needs repair before the next season. These are fixed physical commitments, not undisclosed last-preparation gates.

The model reviewer independently reproduced a real freeze from faded waiting and inspection lessons (seed 21; count at 3; wait and look at 6; later work preparations; refuse gap). A regression checks that conflict and exact replay. No host utility bonus or blanket mixed-exposure penalty was added.

The first browser pass caught one stale assertion expecting the removed “Nobody came before dusk” line. The assertion now checks the honest unfit-practice line. This was an expected text change, not a runtime failure.

The broader field-work control exposed a remaining universal Maryam win. The final day now discloses an empty household water store in one seeded condition, which closes counting and leaves inspection or Danyal available. The model reviewer checked that final gate and its disclosure separately and found no blockers. All-teach and all-work regressions now reject a universal companion win across seeds 21–24.

## Iteration 3 — independent Codex review

One read-only Codex reviewer (GPT-6.1 Sol, medium effort) checked the complete choice-text diff against 400a62a, including the new presentation helper, tests and model semantics. Two P2 copy findings were verified and corrected:

- At six, refusal keeps an empty jar at home. The choice now describes keeping the jar home, rather than retaining water on the way back.
- Final-day carriers have already eaten or missed meals at chapter entry. Field work now describes putting food by for the household, rather than feeding today's carriers.

The reviewer found the remaining age purposes, witnessed-practice markers and adult attribution consistent with the model, and found no simulation or replay change. The fixes only replace these two strings. Final local checks and browser runs are repeated after them.

The first iteration-3 CI run passed 19/20 browser checks but exposed a pre-existing clock race in the four-second reveal assertion: installing the clock left it advancing during driver work. The test now pauses the installed clock before clicking, then explicitly advances 3,900 and 100 milliseconds. No game timer changed. This test-only correction follows the independent product review.

## Iteration 4 — independent Codex review

Two fresh read-only Codex reviewers checked the complete iteration-4 diff against e96171e. Both used GPT-6.1 Sol: medium effort for model correctness and low effort for presentation. Neither implemented the slice.

Verified and corrected findings:

- A possible age-eighteen freeze lacked a visible request to wait. The preparation now attributes the conflicting requests to two neighbours, while the narrator states the physical requirements.
- Failed final movement could still describe completed deliveries. Each failed final action now shows its attempted practice and leaves the last households visibly waiting. The failed counting explanation describes insufficient water rather than claiming completed division.
- Earlier failure copy could claim stored water was spent after the emergency store was empty. Only the conditional emergency-store consequence now states whether stored water covered the shortfall; the base failure text names the shortfall.

The model reviewer independently checked a careful inspection win, a careless loss with the same final inspection, and two distinct successful routes (counting and inspection). Those controls replayed exactly. New regressions caught the failure-copy issues before correction. The new physical water rule does not change HF action selection or introduce framework logic.

The first browser run exposed a pre-existing notice race: the asynchronous first-visit recording notice could appear after the test's one-time check and intercept a later click. The test harness now dismisses the notice whenever it appears, including after reload. Product notice behavior is unchanged. Final checks use the explicit Node 26.12.0 path; the login shell's older Node was detected during verification and excluded from final evidence.
