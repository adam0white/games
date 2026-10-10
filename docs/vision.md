# Vision

Recorded 2026-10-09. Owner directions below are from the current conversation. Design details elsewhere are proposals, not additional owner requirements.

## The experience

Begin with one familiar object and a person trying to understand it. Repair family things at home; then friends' things in the parents' garage. Some repairs take longer than expected. Work can be put aside, returned honestly as unfinished, or revisited when knowledge, tools or parts improve.

Grow by teaching people and transferring responsibility. The player moves from direct repair to supervision to business management; eventually, an idle conglomerate could run through trained people and managers. Earlier work stays causally useful: methods, recovered parts, workers, relationships and customer history continue to affect later decisions. Returning to cozy repair is a legitimate way to play, not a replay of a discarded tutorial.

The long-term economy could connect repair, refurbishment, salvage, parts supply, logistics and other businesses. Multiplayer might eventually connect those organizations. These are ambitions, not reasons to build servers or markets now.

## Owner's words

> “the feel of the game to shift as well; like this theme can start as a cozy game where you try to repair interesting stuff, then shift to more of a biz management, then eventually shift into an idle conglomerate game, but even at that late stage you benefit from what you did at the start, remember it and have it affect gameplay, and can even go back and play cozy.”

> “the start of the game to be as micro as possible while also being realistic, like you find your own family's stuff and try to tinker around at home, then repair friends' stuff in the parents' garage”

> “some items take longer and may be put down/returned to be revisited later; varying difficulty and randomness.”

> “Your first prestige is to let your apprentice handle an entire repair by themselves; you remove your own expertise from the process, thus removing a layer, which is a prestige that lets you focus own broader areas.”

> “Reduce waste of your biz by reusing little parts or recycling them; satisfy your inner needs.”

The owner also proposed that this micro-to-macro progression could apply across themes and beyond games: an application could learn a user's repeated practice and offer an apprentice-like automation when wanted. That transfer is worth revisiting after the game demonstrates it, rather than building an application platform alongside the MVP.

## Faith and inner life

The owner clarified that faith should have a central role in HF, expressed naturally rather than conspicuously. Different people may draw meaning and support from different religious traditions. This is a direction for future representation, not evidence that everyone has identical needs or that traditions are interchangeable. HF's existing Islam-guided provenance and limits remain authoritative until its owner adopts a broader sourced design.

In this game, meaningful work, relationships, service, financial ambition, spiritual practices and ordinary obligations can compete or reinforce one another. No universal spirituality-to-profit coefficient, ranking of religious worth or calculation of divine acceptance is proposed.

## Design principles proposed from the direction

1. Earn a change in responsibility by developing someone who can carry it.
2. Preserve the work, people and objects that earned the transition.
3. Reveal new controls when the player's role makes them useful. A home repair should not begin with a conglomerate dashboard.
4. Let hands-on work remain worthwhile after delegation without making it permanently mandatory.
5. Uncertainty changes judgment; it does not invalidate a diagnosis through an unexplained reroll.
6. Reuse is both a material decision and a possible source of meaning, with suitability and quality tradeoffs.
7. A standalone small game comes before an endlessly expanding one.

## Implementation direction, 2026-10-09

The owner authorized autonomous implementation and delegated execution after reviewing the proposal. Start as little as possible. Use **progressive disclosure**: reveal an action when a story or observation makes it meaningful, rather than showing disabled future business controls or a tutorial checklist. Minimal visuals still need a tangible object and visible state changes.

Opening sequence: cozy fictional family conversation → flickering lamp → small repairs discovered naturally during conversation → an object that cannot be solved now → voluntary shelving → garage discoveries → bounded free play. Failure is another discovery, not an instruction to repeat a hidden roll. Do not force shelving as a tutorial gate if the player finds a valid alternative.

Objects, friends' requests and future business contacts have discoverable provenance. A household does not immediately become a company; an unknown attic machine does not appear in an omniscient catalog, and enterprise contracts do not arrive before capability, trust and contacts justify them.

> “I need this thing to keep moving forward, and my limited time and attention to be spent on meaningful input; hence I'm delegating this to you and you should do onto your subagents”

Always review game work. Use asynchronous Gemini review as an additional independent perspective when its local CLI and authentication work; record real completion or failure, not just dispatch. Keep progressing while reviews run. Stop at a genuinely useful playtest, not a plan approval.

## Personal sources (continued)

Earlier ideas are in the private PKM at ../pkm/00-inbox/ideas.md: procedural adaptation (line 37), micro-to-macro agent training (line 195), and small simulated-NPC games (line 51). The current conversation supplies the more specific repair-game direction. Those notes contain later AI elaboration; the quoted original wording is the authority on the earlier idea. Do not publish private PKM content or paths as part of a public site.

## First playtest direction, 2026-10-10

Adam found the curious start intriguing and the first diagnostic choices believable. He wants a larger, reviewed iteration before the next delivery: optional backstory and ordinary conversation choices; distinctive objects and repair methods; light previews of whether actions continue work, put it aside or leave the scene; clearer changed/revised evidence; and dialogue feedback noticeable from the buttons. A short fade and delay before fresh choices can help process consequences, with reduced-motion support. More elaborate animations remain deferred.

Tea and time together should affect real HF people, such as relationships and willingness. Verification can take time while the player does something else, with an option to hand an item back prematurely and understand the consequences. These suggestions are direction for an integrated design, not a requirement to simulate caffeine or urination immediately.

The controller should stay focused on overview and taste, delegate almost all implementation, and let workers contribute interpretations and nuances. Review includes small unbiased tester briefs and an almost unbriefed wildcard. Owner attention goes to meaningful playtesting rather than repeated design gates. Exact feedback excerpts are retained in docs/games/opening-playtest-2026-10-10.md.
