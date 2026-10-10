# Independent 3D workshop playtests

Agent playtests are simulated feedback, not Adam’s acceptance. Browser contexts were isolated; source, game docs, storage and exported contents were not read by the players. These sessions ran against a developing engine-17 candidate at port 5178, so they are feedback artifacts rather than asserted immutable release replays.

## Fresh mobile reader

Model gpt-6.1-sol, low effort, tiny brief to try a repair and room. Actual notes /tmp/repair-fresh-3d-notes.md and its listed screenshots are retained. It completed Mum’s lamp entirely through compact tools and touching the model/parts, explored room rotation, waiting shelf and notebook, and used no illustration fallback.

# Fresh mobile 3D playtest

Fresh isolated 412×891 mobile/touch Chrome context, ordinary visible UI only. No source, game docs, local storage, or export read. No export made. Completed Mum's reading lamp repair; stopped naturally when childhood lamp appeared. About 30 actual taps across an initial room exploration and two restarted sessions (automation resets lost their handles).

## Verbatim reactions

- “I expected Mum’s chair here, but this is just the work corner.”
- “The action disappeared before I could choose it.”
- “The little battery and contact on the tray are understandable once I’ve looked at the lamp.”
- “The longer check gives me a reason to wait instead of calling the first light a success.”
- “Why does touching the stem do nothing? The shade worked.”
- “Mum’s thank-you makes finishing feel worthwhile.”
- “The room is a second navigation layer, but I’m still reading the repair below it.”

## What I did

Opened room, saw isometric bench, rotated right. Initial Notebook attempt timed out during integration/loading; do not infer a room defect from that. Restarted fresh. Sit with Mum initially displayed Look closely, then 3D loaded and replaced it with Look tool; automation attempt on old label failed. Final fresh context waited for current UI, selected Look, touched shade, diagnosed lamp. Selected Test battery and touched visible battery; selected Clean contact and touched little contact on tray. Started longer check by touching shade after stem failed. Watched twice for ten minutes. Selected Read check; stem taps produced only selected-tool description, shade tap completed check. Returned lamp; Mum thanked player, childhood lamp appeared. Reopened room, turned right, selected Waiting shelf then Notebook.

## Observed friction

- Initial ordinary action buttons flash then disappear when 3D loads. This caught me twice.
- Whole-object actions appear to require hitting a visible mesh. Stem taps often did nothing while shade worked. Description said Whole object, so I expected broader activation.
- Mobile room occupies most of the screen, pushing repair/story below; both room and close-work object remain on page when room is open. The room is comprehensible but adds scrolling.
- Room selection buttons and rotation were clear. Waiting shelf and Notebook correctly showed their descriptions/actions.
- First scene says Mum calls me over; immediately after Sit with Mum she had stepped away at 14:00, despite time being 14:04. Slight continuity surprise.

## 3D versus fallback

Entire successful repair used 3D tool selection plus touch on shade/battery/contact. Did not activate illustrated fallback or keyboard alternative controls. Room navigation used visible place buttons, not hidden state or canvas internals. No desktop pass.

## Screenshots

/tmp/repair-fresh-3d-01.png initial page
/tmp/repair-fresh-3d-03.png initial work corner
/tmp/repair-fresh-3d-04.png first room rotation
/tmp/repair-fresh-3d-07.png loaded 3D lamp
/tmp/repair-fresh-3d-09.png examined tray
/tmp/repair-fresh-3d-10.png battery result
/tmp/repair-fresh-3d-finished.png returned lamp/new bedside lamp
/tmp/repair-fresh-3d-room-end.png final room
/tmp/repair-fresh-3d-room-turn.png final rotation


## Almost-unbriefed wildcard

Model gpt-6-sol, low effort, desktop 900×800. Screenshots /tmp/repair-wildcard-3d-01.png through -50.png are retained. No story download was retrieved, so no native replay fixture is claimed. Exact report:

> I liked the physical specificity of the lamps, the pencil mark and paper shopfront, and how a successful first glow still called for a longer check. Mum saying she was busy when I asked her to hold the lamp made her feel like a person. The garage box, matching holder, and measured donor gear made each next step understandable. I was confused by the 3D bench interaction: the room and object views add a large amount of page height, and I could not tell where to click the object after selecting a tool, so I switched to the illustrated bench for every repair. Journal and Notebook seemed to open the same screen. The biggest story confusion was my appointment with Dad at 15:45: helping Evan from 15:25 to 16:05 crossed it, but the appointment disappeared without a response, and Dad immediately helped hang the doors afterward. I stopped at Summer day 2, 17:29, after returning the fully checked paper-street model to its shelf. Dad’s cabinet doors were hung but still needed alignment; the game offered to close summer or leave the bench safe for tomorrow. My roughly 45 meaningful choices felt like enough for this session.

## Changes and bounded verification

The initial 3D-loading handoff now keeps one control surface instead of showing then replacing ordinary physical buttons. Selected whole-object tools highlight the assembly; bounded projected touch areas assist thin meshes. Room mode hides close bench content rather than appending another full scene. A selected place performs only an explicit exposed operation. Notebook is intentionally the same journal, situated in the room rather than a second history.

The cabinet promise was a 15:45–16:45 window, not a missed appointment at 16:05; the old projection hid it at its start. The corrected view exposes its whole actual window and keeps due/kept/missed plans. No timer grants work or interrupts Dad. Independent affected review cleared actual 40-minute crossing, real deadline breach and once-only notice controls.

Root isolated narrow dark/mobile checks established byte-identical export before/after camera movement, actual canvas inspection adding exactly one input, synthetic WebGL-loss recovery with one copy of action controls, successful retry and no overflow/runtime errors. These are browser simulations rather than physical-device acceptance. The returned illustration remains a complete legitimate play route; the wildcard’s preference is not treated as a failure verdict or enjoyment acceptance.


## Refined mobile and keyboard recheck

The returning fresh reader completed another lamp using keyboard-operated controls and exported the actual UI story to /tmp/repair-keyboard-3d-story.json without reading it. At 360×780 the stem touch activated Look, room mode hid close work, and loading showed its explicit opening status without obsolete action buttons. Exact notes follow.

# Refined 3D UI recheck

Fresh desktop 1280×900 Chrome context, keyboard-only complete lamp repair. Initial opening used Tab through Journal, Look around, Sit with Mum and Enter. Remaining steps used ordinary DOM focus of visible controls plus Enter/Tab; no mouse or 3D click, no source/hidden state read. Selected each tool, focused Keyboard and alternative controls summary, expanded with Enter, Tab to Do the selected work, Enter. Tested battery, cleaned contact, started check, watched twice, read check, gave back. Entered Journal and exported actual UI story to /tmp/repair-keyboard-3d-story.json without reading it.

Fresh 360×780 mobile/touch context: Sit with Mum, wait for loaded 3D, selected Look, tapped thin stem at visible x174 y496. Observation action immediately advanced 14:04 to 14:08. Room opened and only room navigation remained; close-work lamp/story/action section was hidden until returning.

## Verbatim reactions
- “Opening the 3D bench is better than showing me a button that disappears.”
- “Keyboard repair works, but I reopen the same expandable controls for every step.”
- “Tab moves across the other tools before the keyboard controls; I almost selected the wrong tool.”
- “The thin stem now works when I touch it.”
- “The room feels cleaner with only room navigation on screen.”

## Limits and friction
Keyboard work was completed using explicit ordinary DOM focus for some visible controls, so this proves operability, not an uninterrupted sequential Tab journey. Initial focus after loading landed on arrow rotation controls; Shift+Tab recovered Look. I accidentally selected Clean contact and Fit battery while trying sequential Tab from Test battery; no work happened because execution requires Do the selected work. Tool execution collapses/removes alternative-controls panel, so every subsequent action needs expansion. This is understandable but repetitive. Opening pending state was observed; no old Look closely flash in this pass.

A rapid sequence of focus/Enter for two wait actions did not advance time; individually paced steps did, and full repair completed. Treat as automation pacing observation, not confirmed ordinary-user defect.

## Artifacts
/tmp/repair-keyboard-3d-look.png
/tmp/repair-keyboard-3d-finished.png
/tmp/repair-keyboard-3d-story.json (saved, not read)
/tmp/repair-narrow-3d-before.png
/tmp/repair-narrow-3d-stem.png
/tmp/repair-narrow-3d-room.png


The keyboard alternative now retains its open/closed choice between tools on the same object, addressing repeated reopening. A continuous Tab-only journey remains a separate accessibility test; the reader used ordinary DOM focus for some controls.

The final independent 360×780 recheck initially disproved the keyboard persistence refinement: recreated details elements collapsed again. Keeping the same panel mounted between tools corrected it. The reader then confirmed: “Expanded controls once for Look; after executing it, Test battery displayed ‘Do the selected work’ immediately. After executing Test battery, Clean contact also kept the controls expanded.” Screenshot: /tmp/repair-keyboard-persistence-corrected.png.
