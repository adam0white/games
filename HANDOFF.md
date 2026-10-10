# Handoff

Updated 2026-10-09.

## What remains

Adam reviews the proposed [MVP](docs/mvp.md), especially whether its opening repairs are appealing and whether the first independent repair is a satisfying first prestige. After that, prepare the implementation plan for the accepted milestone. No gameplay code has been written.

## Current state

- Created as a neighboring local repository at /Users/abdul/code/repair-game. Public title undecided; no remote or deployment.
- Broad ambitions recorded in docs/vision.md and docs/roadmap.md. They are not an active implementation queue.
- Proposed MVP: home tinkering → garage repairs → one apprentice's independent completion → a playable period after the handoff.
- HF 2.1.4 is the version recorded by the sibling project's current package and handoff. No dependency has been installed here. Verify the released package when implementation begins.
- Generic conditional procedure learning is a candidate HF capability, not an existing feature or a proven requirement. Existing instruction and observation improve skill; they do not establish learning an arbitrary task policy.
- Personal-PC consult uses PKM for owner context. Project state stays in the owning repository.

## Decisions and boundaries

2026-10-09 owner: create the repo, draft a broad roadmap, preserve future ideas, focus a small MVP, and seek reviews before implementation. Single-player first; simulated economy deferred. First prestige removes the player's expertise from a whole repair, rather than resetting progress.

No HF goal or version is set by these documents. If the chosen game requires HF changes, propose the minimal framework goal, release it in HF and upgrade its existing games under HF's workflow.

## Review and checks

Three read-only reviews ran: game design, framework causality, and adversarial/wildcard scope. Applied their findings:

- Reduced the MVP from three object families to one, with donor and put-aside objects sharing its model.
- Specified the first diagnostic choice, visible payoff and reason to shelve the second object.
- Added a believable friend-to-paid-apprentice progression and one meaningful teaching correction.
- Required independent completion on both supported held-out variants; escalation tests use an out-of-scope case.
- Added changed/withheld teaching and alternative-method controls so an authored host policy cannot masquerade as learned behavior.
- Bounded transfer to learned diagnostic structures; no universal planner or invention of unseen methods.
- Added the two-job post-handoff episode and personal repair so prestige changes play rather than simply removing its enjoyable activity.
- Clarified controls when the existing HF release suffices, and constrained failure outcomes so hidden-roll retries do not replace diagnosis.

Documentation verification: eight Markdown files checked; all local links and referenced headings resolve. Staged whitespace verification passed. No gameplay tests apply yet.
