# The Left Hand

Three winter nights. Carry help to a family. Decide what to say when someone sees you.

Godot 4.7.2 draws a deterministic TypeScript host running Human Framework 4.10.0.

Node 26.12.0, pnpm 12.14.0. Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, `pnpm e2e`. Godot and matching templates download to `.godot-tools` on first build.

See [design](docs/design.md). Code is MIT.

Third-party copyright and license texts are retained in [public/third-party-notices.txt](public/third-party-notices.txt), also linked from Licenses in the game menu.

Deploy with `npm run deploy` from clean, pushed main after exact green CI. The command builds, uploads and verifies the live commit and `dirty:false` at `/release.json`. Download run is public in Menu. Replay verification is in the collapsed Debug item beside Lab privacy.

Yusuf, Idris, Samira, Danyal and Tariq use the shared-person route through the central shelf when continuity is on. Menu links to [People across games](https://human.adamwhite.work/lab/people/). Current runs save locally at chapter boundaries, on pause and when leaving the page; reload resumes the saved run without fetching a different person. A refused older save stays downloadable until you choose New game. Complete the three nights before leaving people on the shared shelf. Tariq can arrive and depart because Well and Warren now run client 0.5.5+ with per-person skips. Every actor remains subject to the general write gate: an unverified peer keeps that actor’s shared record unchanged. The menu names skipped people. A person whose source history does not fit the authored opening is skipped by name and remains with their source chapter.

The HF 4 port uses the public run API for actors and one portable shelf route for admission and departure. Godot keeps its drawing/movement protocol. `node scripts/hf4-control.ts` plays three nights and verifies both replay hashes; pass receipt/export paths to retain artifacts. `node scripts/shelf-control.ts <completed-export.json>` proves a real current-actor shelf arrival and local resume.

Menu → People tonight shows HF self narration through a winter-evening phrasebook. HF records each wording choice; opening the menu does not advance its random stream. The shared Lab kit supplies the collapsed Debug footer.
