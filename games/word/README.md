# His Word

[Play His Word](https://word.adamwhite.work).

Your uncle Nuri, an Istanbul tailor, died last week. He promised Halil morning
repair work and Rıza cart storage on the same floor. Ferda must decide whether
to reopen the shop. Osman owns the room and leaves in twenty-four minutes.
Get all four to sign one workable agreement on work, storage and rent.
Your ₺100 journey fund can help pay for it, at a cost to your trip home.
Without agreement, the shop stays shut and Osman rents it to someone else.

## How to play

Tap or click a choice. With a keyboard, use Tab to focus it and Enter or Space
to choose it. Read the reply and the minutes left before choosing again.

- Choose **Hear what someone needs**, then ask a person. Each conversation
  takes two minutes. Ask to learn both their needs and what they can change:
  a paid break, cart storage in Rıza’s yard, a trial lease or a smaller service.
- **Fetch Nuri's letter** takes six minutes. It supplies evidence that the
  clothing order can fund late work. Ask which changes people will accept.
- **Speak to someone in private** offers conflicting promises. Each takes two
  minutes and can save a guarantee fee. Halil and Rıza can compare your accounts
  when both are present. Being caught cancels the unfinished agreement and
  requires a deposit. You can also withdraw the promises openly.
- **Write an agreement** offers practical arrangements. Writing takes two
  minutes. Read the terms and your contribution. Terms follow your questions:
  the same title can print different terms after you ask Halil or Rıza, and each
  option names which asks it reflects. Anyone not yet asked stays unknown. A refusal tells you what is
  missing. Ask about it, then write a new agreement with the needed concessions.
- **Ask the next person to sign** takes one minute. All four must sign the same
  agreement. Changing it clears every signature. Rıza’s delivery round can delay
  his signature; use **Wait for Rıza to return** when offered. Halil can leave
  with his signed copy. Calling him back for changed terms takes two minutes.
- Decisions advance the clock; reading does not. Choices show their minute cost.
  The signing page includes the time still needed, including a delivery wait.
  The last signature can use the last minute. Running out before completion,
  or choosing **End the meeting**, ends without agreement.

The ending shows the arrangement and relationships one month later.
**Open notebook** reviews what was said. **Menu** has **Resume**, **Notebook**,
**Feedback**, **Open a file**, **New game**, **All games** and, where supported,
**Fullscreen**. **Back** returns to play. New game asks before replacing your
current place. Browser storage keeps your place when available. A collapsed **Debug** item beside recording privacy contains export and replay tools.

## What Human Framework supplies

[Human Framework](https://human.adamwhite.work) is pinned to exactly **4.17.0**.
The game creates one HF run with five people and sends every
change as a timed input to `step`. It reads people back only through `inspect`
and the run export. This game demonstrates testimony with sources, learned
beliefs, changes in trust in a source, and relationships.

- Asking someone is a `conversation.requested` input. HF chooses what they say
  from their current beliefs and trust. The host answers each communication
  request exactly once, and the nephew hears every item at full attention.
- The supplier’s letter reaches Ferda as an observation that she read, with its
  source and confidence. A private word reaches Halil or Rıza as an observation
  told by the nephew. No belief is written into a person after the run starts.
- Ferda’s stated need is a fixed host line stored unchanged in the run. After the
  letter the screen labels it as her standing need, not a reply to the letter. The
  label is presentation only, so word-5 exports made at 349 still replay.
- A comparison between Halil and Rıza is a contradiction input that names the
  other man as reporter. A confession is a contradiction with no reporter,
  because the game does not know who first passes it on. Discovered deceit and
  signing are social inputs that change HF relationships.
- The later greetings read source trust and relationships.

The host authors the practical arrangements, concessions, presence, money,
deadline, signature rules and month-later work and rent outcomes. Consent means
meeting those authored conditions and signing the exact agreement; it is not
an HF persuasion prediction. This is a bounded authored negotiation, not a
general autonomous simulation. It starts fresh people, with no imported saves.

## Replay, recording and Feedback

**Export playtest** downloads the seed, input log, complete state, edition and
HF pin. Open **Menu → Debug → Replay tools → Import a playtest export** to
reconstruct a run and check its state and hash. **Resume replay** returns to play.
Only the current `word-5` edition with HF 4.17.0 is accepted. An earlier export
or save, including every HF 3 run, is refused before any state changes, with a
message to start a fresh meeting. Old saves are not migrated.

The monorepo uses the published **@adam0white/lab-client 0.5.19** and
**@adam0white/lab-kit 0.5.36** artifacts. The original vendored client remains
in the source archive.
Recording attempts uploads of decisions, run snapshots and event/error logs.
Use **Record my play for the lab** on first visit or in Menu to change it.
Browser privacy signals default recording to off. **Feedback** offers
**I'm stopping** and **I'm confused**; selecting one opens a draft with that text
and sends nothing until you choose **Submit**. **Not now** sends nothing.
With recording off, a submitted note is unlinked. Feedback success requires a stored-note
receipt; queued automatic records and upload attempts do not prove storage.

His Word registration is in central source commit `5fb4d98`. The live central
service remains at `00d`, held for coordinator deployment after Voice.
This does not establish a production receipt, lab panel or owner acceptance.
Cross-game recording linkage needs the same browser and shared identity, subject
to frame access, storage and origin rules. A blocked frame or different origin
can leave separate identities. Fictional-person continuity is separate and is
not guaranteed by recording linkage; this game does not import continuing people.
See the [recording and privacy notice](https://human.adamwhite.work/lab/privacy/).

### Open a file without replacing your browser save

Open **Menu → Open a file** (the `/word/file/` route) and choose a complete current `word-5` / HF 4.17.0 export.
This route opens the chooser before reading your saved meeting or creating a
new one. It does not read or write the Word save or notice keys. The opened
meeting and its complete five-person state stay in memory. Continue playing,
then use **Menu → Debug → Export playtest** to download the current complete run.
That download can be imported through ordinary Replay tools or opened in file mode.
Download before closing: reloading or closing the tab loses undownloaded play.
**Choose another file** keeps the last accepted meeting until a new file passes
full replay. Canceling or rejecting a file keeps that meeting available.
**Close file** returns to the chooser. New game is available on the ordinary route.

Files must be valid UTF-8 JSON and no larger than 16 MiB. One leading UTF-8 BOM
is accepted. The original bytes and their SHA-256 stay in memory beside the
validated complete export. The chooser shows that original byte count and hash
when you return to it. A continued export contains the current state; its JSON
formatting can differ from the original file. No people, logs or provenance are
trimmed to meet the size limit.

File mode starts with recording off. Client 0.5.19 uses preserving, deferred
initialization after an explicit feedback or recording action. It leaves stored
identity, preferences and queued recordings unchanged before recording opt-in.
An unshared feedback note is sent alone, unlinked; it does not start delivery of
old recordings. Turning Recording on or selecting Share play explicitly enables
recording after the existing identity/session checks. Missing identity,
incompatible session or an identity mismatch blocks recording and is shown
explicitly. File mode never creates or copies a player identity as a fallback.
The switch becomes disabled when preservation is blocked. This informational
notice does not claim the ordinary notice key. Selecting a feedback choice only
prefills the note; Submit sends it.

An agent can explicitly open `/word/file/?labRunSource=agent`. The public SDK marker
labels newly captured linked records; it does not change imported authorship,
turn recording on, change prior queued records or prove delivery. File mode
makes no fictional-person Shelf request. Pending recording is retained until
the SDK receives its exact stored receipt. Host source tests do not establish
owner-profile admission, a production receipt, panel readiness or acceptance.

## Develop

Use Node **26.12.0** and pnpm **12.16.1**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`src/story.ink` is the authored story. `pnpm story` compiles it to generated
`src/story.json`. Ink external functions only read state; Ink may call them more than once.
Run `pnpm check:lane` and `pnpm build`. Browser checks use
`pnpm exec playwright install chromium webkit`, then `pnpm e2e`.
The four projects cover Chromium and WebKit at 360×690 and 1280×800.

## Release

Use the root monorepo workflow for release and deployment. Verify the scoped
`/word/release.json` after deployment.
Code is MIT licensed. See [docs/design.md](docs/design.md) for scope and design.

The cold policy in `test/support/cold-policy.ts` reads only the displayed text,
choice labels and its own prior choices. It cannot read the seed, actor state,
agreement fields or exported run. It tries asking before offering and recovering
from a full-shop refusal. Both approaches are checked over 32 seeds with exact
replay, then driven through DOM text in all four browser/viewport projects.
This is a scripted discoverability check; it does not replace a human playtest.
