# The Stairwell

You are the building’s caretaker at Lale Apartmanı, a seven-flat block with five occupied flats in Istanbul. Rıza left you his notebook. Deliver bread, shopping and parcels, do small jobs, and take down the bins through Saturday. On Sunday, residents vote on your tea money, the extra pay for your work.

[Play The Stairwell](https://stairwell.adamwhite.work).

## How to play

- Tap an order, a resident’s name or a place on the building to preview a trip. Choose **Go** to walk there. You pick up and deliver items automatically on arrival. You cannot turn back during a walk.
- Ask residents for news. Choose **Tell…** to repeat a story and say whether you are certain. You can also sit together or make up stories. Residents remember what you do and say. From Thursday, you can ask for support for your Sunday raise.
- Read the notebook and orders during play. **Clock speed** offers Automatic, Slow, Steady and Fast. Reading and conversation pause time in the default week and slow it in the optional month; waiting orders slow it. The Game menu pauses play and offers Resume, Feedback, Full screen, All games, Recording and New game with confirmation.
- Your notebook saves in this browser’s storage. **Continue** restores the saved week or month. New game replaces it after confirmation. The caretaker’s week does not advance while the game is closed.

The new-game option **Play four weeks, ending with a vote on whether you stay.** starts
unchecked. It selects the optional month, including private work, a storm, Sunday seating,
sealed-parcel custody and private dues payments. Invitations need the people’s agreement;
parcel handovers need an actual trip and both people’s consent. Dues payments transfer
actual cash before reporting payment. Four weeks end with a vote on renewing your work.

## Recording, files and continuing people

Feedback offers **I'm stopping** and **I'm confused**. Choosing or clearing one sends
nothing and leaves your edited note intact. **Submit** includes the selected words,
optional verdict and current note.

Recording links recorded play across games on this device. The menu has one Recording switch. Feedback can include the available run when Recording is on or you choose Share; otherwise it sends the note, answer and optional name.

File controls are public. The Game menu and ending offer **Download this run**. Feedback offers **Keep a copy of this run**. On the title page, **Other ways to begin → Play a saved file** opens the isolated `/stairwell/file/` page. File play never replaces the local notebook or changes shared people. Its complete download preserves source bytes, replay state and provenance. Cancel or an invalid file keeps the current file run available. Native downloads contain the edition, seed, timed inputs, minute and pinned continuity data; they omit the derived `state` summary. **Other ways to begin** also exposes eligible morning returns and accepted local recovery copies. All menu diagnostics live in one closed **Debug** item beside **Lab privacy**.

The native week, month and Start work editions use `stairwell@14`, `stairwell@15` and `stairwell@16`. Unsupported old notebooks are refused with a keep-file and start-fresh message. Current files replay under their recorded supported edition; importing a file does not grant ownership of a continuing person. Historical HF3 admission and replay records remain in the source history and the [HF3 adoption note](docs/hf3-adoption.md); they do not establish current cross-game admission.

## Framework and development

[Human Framework](https://github.com/adam0white/human-framework) supplies the simulated people: their beliefs, trust, relationships, memory and decisions. Stairwell supplies the building, errands, schedules, stories and consequences. The workspace pins `@adam0white/human-framework` to `4.17.0` and the released lab client and kit in its lockfile. Native editions 14, 15 and 16 are current; earlier engine and edition claims in this document are historical. App version `0.1.0`, notebook editions and engine version are separate identifiers. The package requires TypeScript 7 or later; this repository uses `7.0.2`.

From the [games workspace root](../../README.md), use its pinned Node and pnpm versions. Run `pnpm install --frozen-lockfile`, `pnpm --filter ./games/stairwell dev`, and the root and game `check:lane` commands. Full suites use the shared suite lock. The workspace owns complete builds and deployment; the game deploy commands forward to it. The scoped game path is `/stairwell/`, with file play at `/stairwell/file/`.

Design and open work: [docs/design.md](docs/design.md). HF requests: [docs/hf-requests.md](docs/hf-requests.md). Historical playtests: [docs/playtests/](docs/playtests/). Technical delivery does not establish owner acceptance. Owner review remains 2026-11-03.

MIT licence.

Dependency changes use pnpm and the committed `pnpm-lock.yaml`. The npm lock was imported with exact dependency versions preserved. Do not regenerate an npm lock or install a separate runtime per worktree. The pnpm policy uses strict engines/peers, no hoisting, hardlinks, a 24-hour third-party release delay and a scoped exemption for owned `@adam0white/*` packages.
