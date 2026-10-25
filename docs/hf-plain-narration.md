# Published HF plain narration

What remains: Adam accepts readability and game feel. This adoption adds no faculties or mechanics and runs no new player playtest round.

Small Works uses exactly published `@adam0white/human-framework` 2.21.0. The root override also deduplicates lab-client's immutable older dependency onto that exact release. Current save provenance, continuity source headers and target chapter claims use 2.21.0. Historical source dialects and archive pins remain historical. The finite Commonstead receiver still requires its actual 2.17.0 source; the existing workshop/Voice mapping also accepts 2.21.0 sources.

`createPeople` sets `lexicon: { plainEnglish: true }` before any HF decision. Every fresh local game and fresh canonical target uses this factory. Calendar admission retains the target lexicon. Replay of pinned opening people and loading a run preserve their saved lexicon, including an explicit false choice and names. HF 2.18.0 exports receive the existing plain start-fresh refusal. The game-side lookup was removed in the preceding text edition. Domain explanations, activity labels and identity mappings remain.

## Upgrade regression and lesson

The focused test is `tests/hf-plain-narration.test.ts`. It checks fresh opt-in, persistence, exact replay with a pinned false lexicon, and earlier-package refusal. The existing whole-cast admission/replay regression also checks every admitted person's opt-in. Lesson: set narration when creating the target person; never enable it in restore, load or generic people-upgrade helpers. Those helpers also run for saved histories and would silently change a player's narration choice. Pin the transitive published client dependency as well as the direct one.

## State proof

Capture both editions with `scripts/check-text-state.mjs`. It now also saves the exact current exports. Compare the two directories with:

```
node scripts/check-hf-narration-state.mjs BEFORE AFTER
```

The original driver's explicit game-prose allowlist remains unchanged. The HF comparator excludes only the known package/engine stamp pair, exactly `{plainEnglish:true}`, decision narration/intention and spoken suggestion text, private recorded intention prose, and the summary of a `missed` episode identified by the retained memory ID. Its chronicle copy uses that same missed ID. Every other memory/history field, ordered array, cue, action, numeric value, RNG value, and any `usedLines` field remains exact. Other lexicon mappings remain exact. HF's recordMissed writes the changed summary; memory matching uses structured episode fields. No new mechanics field is normalized.

Seeds 7, 42 and 1001, with repair, exploration and mentoring policies, each reach day 8. All nine final normalized hashes are equal across HF 2.18.0 and 2.21.0. The ordered commands and acceptance results match across all 2,253 attempts. Each new exact export replays without normalization. The proof establishes final-state equality and identical command outcomes; it does not claim equal normalized intermediate-state hashes.

External captures, review, rendered text, layout metrics, signed delivery and CI receipts are in the owner's `hfadopt/repair-game-report.md` scratch report. The four clipped voice phrases named by the earlier report are package-source findings, not four previously observed screen lines. The mentoring trace exercises the replacement of “Good idea. On it.” with “That is a good idea. I will do it.” Host lesson/repair explanations can replace assent speech on screen. A package trace is not on-screen coverage.
